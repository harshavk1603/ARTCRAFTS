import { randomUUID, randomBytes, scryptSync } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';
import { products as initialProducts } from '../src/data/products.js';
import { categories as initialCategories } from '../src/data/categories.js';
import { artisans as initialArtisans } from '../src/data/artisans.js';
import { gallery as initialGallery } from '../src/data/gallery.js';

try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
// Runtime traffic on managed hosts should prefer Supabase's pooler URL. DIRECT_URL is
// supported as a fallback for local development and schema administration.
const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!connectionString) throw new Error('Supabase Postgres requires DIRECT_URL or DATABASE_URL.');
function secureConnectionString(value) {
  const url = new URL(value);
  if (!url.searchParams.has('sslmode')) url.searchParams.set('sslmode', 'require');
  // Preserve libpq's documented `require` semantics with current node-postgres:
  // encrypt the socket while allowing Supabase's pooler certificate chain.
  if (url.searchParams.get('sslmode')?.toLowerCase() === 'require') url.searchParams.set('uselibpqcompat', 'true');
  return url.toString();
}
const pool = new pg.Pool({ connectionString: secureConnectionString(connectionString), max: Number(process.env.PG_POOL_MAX || 5) });
const requestContext = new AsyncLocalStorage();
function postgresSql(sql) { let i=0; return sql.replace(/\s+COLLATE NOCASE/gi,'').replace(/\?/g,()=>`$${++i}`); }
async function execute(sql, params=[]) {
  const context = requestContext.getStore();
  return (context?.transactionClient || pool).query(postgresSql(sql), params);
}
export const db = {
  withRequestContext: callback => requestContext.run({}, callback),
  async ping() { await pool.query('SELECT 1'); },
  prepare(sql) { return {
    async get(...params) { return (await execute(sql, params)).rows[0]; },
    async all(...params) { return (await execute(sql, params)).rows; },
    async run(...params) { const result=await execute(sql, params); return { changes: result.rowCount, lastInsertRowid: undefined }; },
  }; },
  async exec(sql) {
    const command=sql.trim().toUpperCase();
    const context = requestContext.getStore();
    if (command === 'BEGIN' || command === 'BEGIN IMMEDIATE') {
      if (!context) throw new Error('Transactions require a request context.');
      context.transactionClient = await pool.connect();
      try { await context.transactionClient.query('BEGIN'); }
      catch (error) { context.transactionClient.release(); context.transactionClient = null; throw error; }
      return;
    }
    if (command === 'COMMIT' || command === 'ROLLBACK') {
      const client = context?.transactionClient;
      if (!client) throw new Error(`Cannot ${command.toLowerCase()} without an active transaction.`);
      try { await client.query(command); } finally { client.release(); context.transactionClient = null; }
      return;
    }
    await pool.query(sql);
  },
  close: () => pool.end(),
};

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(password, salt, 64).toString('hex') };
}
const now = () => new Date().toISOString();
// node-postgres returns TIMESTAMPTZ columns as Date objects; the API and UI
// expect ISO strings, so normalize at the mapper boundary.
const iso = value => value instanceof Date ? value.toISOString() : value;
const bool = value => value ? 1 : 0;
const here = dirname(fileURLToPath(import.meta.url));
const schema = await readFile(resolve(here, '../supabase/migrations/001_artcrafts_schema.sql'), 'utf8');
await pool.query(schema);

const categoryCount = Number((await db.prepare('SELECT COUNT(*) AS count FROM categories').get()).count);
if (!categoryCount) for (const c of initialCategories) await db.prepare('INSERT INTO categories(id,name,slug,description,image,published) VALUES(?,?,?,?,?,?)').run(c.id,c.name,c.slug,c.description,c.image,bool(c.published));
const productCount = Number((await db.prepare('SELECT COUNT(*) AS count FROM products').get()).count);
if (!productCount) for (const p of initialProducts) await db.prepare(`INSERT INTO products(id,name,slug,description,price,category_id,images,materials,available,stock,published,personalized,sku,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(p.id,p.name,p.slug,p.description,p.price,p.categoryId,JSON.stringify(p.images||[]),p.materials||'',bool(p.available),p.stock,bool(p.published),bool(p.personalized),p.sku||'',now());
const artisanCount = Number((await db.prepare('SELECT COUNT(*) AS count FROM artisans').get()).count);
if (!artisanCount) for (const a of initialArtisans) await db.prepare('INSERT INTO artisans(id,name,slug,bio,specialty,image,published) VALUES(?,?,?,?,?,?,?)').run(a.id,a.name,a.slug,a.bio,a.specialty,a.image,bool(a.published));
const galleryCount = Number((await db.prepare('SELECT COUNT(*) AS count FROM gallery_items').get()).count);
if (!galleryCount) for (const g of initialGallery) await db.prepare('INSERT INTO gallery_items(id,title,category,image_url,artisan_name,description,alt,featured,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(randomUUID(),g.title,g.category,g.image,'',g.description||'',g.alt||'',0,now());

export async function provisionAdminFromEnvironment() {
  const email=process.env.ADMIN_EMAIL?.trim().toLowerCase(), password=process.env.ADMIN_PASSWORD?.trim(), name=process.env.ADMIN_NAME?.trim()||'ARTCRAFTS Administrator';
  const adminCount=Number((await db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='admin'").get()).count);
  if (!email || !password) { if (!adminCount && process.env.NODE_ENV==='production') throw new Error('FATAL: ADMIN_EMAIL and ADMIN_PASSWORD are required to provision the administrator.'); if (!adminCount) console.warn('ADMIN_EMAIL and ADMIN_PASSWORD are required to provision the administrator.'); return; }
  if (password.length<10) throw new Error('ADMIN_PASSWORD must be at least 10 characters long.');
  const existing=await db.prepare('SELECT id,role FROM users WHERE lower(email)=lower(?)').get(email);
  const {salt,hash}=hashPassword(password);
  if (existing) await db.prepare("UPDATE users SET role='admin',name=?,password_salt=?,password_hash=? WHERE id=?").run(name,salt,hash,existing.id);
  else await db.prepare("INSERT INTO users(id,email,name,role,password_salt,password_hash,created_at) VALUES(?,?,?,'admin',?,?,?)").run(randomUUID(),email,name,salt,hash,now());
}

export const toProduct=row=>row&&({id:row.id,name:row.name,slug:row.slug,description:row.description,price:row.price,categoryId:row.category_id,images:typeof row.images==='string'?JSON.parse(row.images||'[]'):row.images||[],materials:row.materials,available:Boolean(row.available),stock:row.stock,published:Boolean(row.published),personalized:Boolean(row.personalized),sku:row.sku});
export const toCategory=row=>row&&({id:row.id,name:row.name,slug:row.slug,description:row.description,image:row.image,published:Boolean(row.published)});
export const toArtisan=row=>row&&({id:row.id,name:row.name,slug:row.slug,bio:row.bio,specialty:row.specialty,image:row.image,published:Boolean(row.published)});
export const toAddress=row=>row&&({id:row.id,fullName:row.full_name,phone:row.phone,line1:row.line1,line2:row.line2,city:row.city,state:row.state,postalCode:row.postal_code,country:row.country,isDefault:Boolean(row.is_default)});
export const toOrder=async(row,includeLines=true)=>row&&({id:row.id,status:row.status,paymentStatus:row.payment_status,paymentMethod:row.payment_method||'gateway',subtotal:row.subtotal,currency:row.currency,createdAt:iso(row.created_at),gatewayOrderId:row.gateway_order_id,gatewayPaymentId:row.gateway_payment_id,paidAt:row.paid_at?iso(row.paid_at):null,address:typeof row.address_snapshot==='string'?JSON.parse(row.address_snapshot):row.address_snapshot,items:includeLines?await db.prepare('SELECT product_id AS "productId", product_name AS name, unit_price AS "unitPrice", quantity FROM order_items WHERE order_id=?').all(row.id):undefined});
export const toGalleryItem=row=>row&&({id:row.id,title:row.title,category:row.category,image:row.image_url,artisanName:row.artisan_name,description:row.description,alt:row.alt,featured:Boolean(row.featured)});
export const publicUser=row=>row&&({id:row.id,email:row.email,name:row.name,phone:row.phone,role:row.role});
export const makeId=()=>randomUUID();
export const timestamp=now;
