import { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomBytes, scryptSync } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { products as initialProducts } from '../src/data/products.js';
import { categories as initialCategories } from '../src/data/categories.js';
import { artisans as initialArtisans } from '../src/data/artisans.js';
import { gallery as initialGallery } from '../src/data/gallery.js';

const here = dirname(fileURLToPath(import.meta.url));
const rawDbPath = (process.env.DB_PATH || 'data/artcrafts.sqlite').trim();
const dbPath = isAbsolute(rawDbPath) ? rawDbPath : resolve(here, '..', rawDbPath);
mkdirSync(dirname(dbPath), { recursive: true });
export const db = new DatabaseSync(dbPath, { timeout: 5000 });

// ── SQLite hardening pragmas ────────────────────────────────────────────
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;
`);

// ── Schema ──────────────────────────────────────────────────────────────
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
 phone TEXT NOT NULL DEFAULT '', role TEXT NOT NULL CHECK(role IN ('customer','admin')),
 password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL, created_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS addresses (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 full_name TEXT NOT NULL, phone TEXT NOT NULL, line1 TEXT NOT NULL, line2 TEXT NOT NULL DEFAULT '',
 city TEXT NOT NULL, state TEXT NOT NULL, postal_code TEXT NOT NULL, country TEXT NOT NULL,
 is_default INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS categories (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '',
 image TEXT NOT NULL DEFAULT '', published INTEGER NOT NULL DEFAULT 1
) STRICT;
CREATE TABLE IF NOT EXISTS products (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '',
 price INTEGER NOT NULL CHECK(price >= 0), category_id TEXT REFERENCES categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
 images TEXT NOT NULL DEFAULT '[]', materials TEXT NOT NULL DEFAULT '', available INTEGER NOT NULL DEFAULT 1,
 stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0), published INTEGER NOT NULL DEFAULT 0,
 personalized INTEGER NOT NULL DEFAULT 0, sku TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS artisans (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, bio TEXT NOT NULL DEFAULT '',
 specialty TEXT NOT NULL DEFAULT '', image TEXT NOT NULL DEFAULT '', published INTEGER NOT NULL DEFAULT 1
) STRICT;
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), address_snapshot TEXT NOT NULL,
 subtotal INTEGER NOT NULL CHECK(subtotal >= 0), currency TEXT NOT NULL DEFAULT 'INR',
 status TEXT NOT NULL DEFAULT 'Pending', payment_status TEXT NOT NULL DEFAULT 'created',
 payment_method TEXT NOT NULL DEFAULT 'gateway',
 gateway_order_id TEXT, gateway_payment_id TEXT, gateway_signature TEXT,
 inventory_released INTEGER NOT NULL DEFAULT 0,
 expires_at INTEGER NOT NULL, paid_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
) STRICT;
CREATE INDEX IF NOT EXISTS orders_owner ON orders(user_id, created_at);
CREATE TABLE IF NOT EXISTS order_items (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 product_id TEXT NOT NULL, product_name TEXT NOT NULL, unit_price INTEGER NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity > 0)
) STRICT;
CREATE TABLE IF NOT EXISTS custom_requests (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '',
 craft TEXT NOT NULL, occasion TEXT NOT NULL DEFAULT '', design TEXT NOT NULL DEFAULT '',
 personalization TEXT NOT NULL DEFAULT '', budget TEXT NOT NULL DEFAULT '', required_by TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '', reference_image_url TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'Pending', created_at TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS contact_messages (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, subject TEXT NOT NULL DEFAULT '',
 message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'New', created_at TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS processed_webhooks (
 event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, processed_at TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS gallery_items (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT '',
 image_url TEXT NOT NULL DEFAULT '', artisan_name TEXT NOT NULL DEFAULT '',
 description TEXT NOT NULL DEFAULT '', alt TEXT NOT NULL DEFAULT '',
 featured INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
) STRICT;
`);

// ── Safe column migrations (idempotent) ─────────────────────────────────
const safeAlter = sql => { try { db.exec(sql); } catch {} };
safeAlter("ALTER TABLE orders ADD COLUMN payment_method TEXT DEFAULT 'gateway'");
safeAlter("ALTER TABLE orders ADD COLUMN gateway_signature TEXT DEFAULT ''");
safeAlter("ALTER TABLE orders ADD COLUMN paid_at TEXT DEFAULT ''");
safeAlter("ALTER TABLE custom_requests ADD COLUMN reference_image_url TEXT DEFAULT ''");

// ── Helpers ─────────────────────────────────────────────────────────────
const bool = value => value ? 1 : 0;
const now = () => new Date().toISOString();

// ── Seed data ───────────────────────────────────────────────────────────
const categoryCount = db.prepare('SELECT COUNT(*) AS count FROM categories').get().count;
if (categoryCount === 0) {
  const add = db.prepare('INSERT INTO categories(id,name,slug,description,image,published) VALUES(?,?,?,?,?,?)');
  for (const c of initialCategories) add.run(c.id,c.name,c.slug,c.description,c.image,bool(c.published));
}
const productCount = db.prepare('SELECT COUNT(*) AS count FROM products').get().count;
if (productCount === 0) {
  const add = db.prepare(`INSERT INTO products(id,name,slug,description,price,category_id,images,materials,available,stock,published,personalized,sku,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const p of initialProducts) add.run(p.id,p.name,p.slug,p.description,p.price,p.categoryId,JSON.stringify(p.images||[]),p.materials||'',bool(p.available),p.stock,bool(p.published),bool(p.personalized),p.sku||'',now());
}
const artisanCount = db.prepare('SELECT COUNT(*) AS count FROM artisans').get().count;
if (artisanCount === 0) {
  const add = db.prepare('INSERT INTO artisans(id,name,slug,bio,specialty,image,published) VALUES(?,?,?,?,?,?,?)');
  for (const a of initialArtisans) add.run(a.id,a.name,a.slug,a.bio,a.specialty,a.image,bool(a.published));
}
const galleryCount = db.prepare('SELECT COUNT(*) AS count FROM gallery_items').get().count;
if (galleryCount === 0) {
  const add = db.prepare('INSERT INTO gallery_items(id,title,category,image_url,artisan_name,description,alt,featured,created_at) VALUES(?,?,?,?,?,?,?,?,?)');
  for (const g of initialGallery) add.run(randomUUID(), g.title, g.category, g.image, '', g.description || '', g.alt || '', 0, now());
}

// ── Password hashing ────────────────────────────────────────────────────
export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(password, salt, 64).toString('hex') };
}

// ── Admin provisioning (NO hardcoded password fallback) ─────────────────
export function provisionAdminFromEnvironment() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD?.trim();
  const name = process.env.ADMIN_NAME?.trim() || 'ARTCRAFTS Administrator';

  const adminCount = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='admin'").get().count;

  if (!email || !password) {
    if (adminCount === 0 && process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are mandatory in production to provision the initial administrator account.');
    }
    if (adminCount === 0) {
      console.warn('⚠  ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env to provision the admin account.');
    }
    return;
  }
  if (password.length < 10) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: ADMIN_PASSWORD must be at least 10 characters long.');
    }
    console.warn('⚠  ADMIN_PASSWORD must be at least 10 characters long.');
    return;
  }

  const exists = db.prepare('SELECT id,role FROM users WHERE email = ? COLLATE NOCASE').get(email);
  if (exists) {
    const { salt, hash } = hashPassword(password);
    db.prepare("UPDATE users SET role='admin', name=?, password_salt=?, password_hash=? WHERE id=?")
      .run(name, salt, hash, exists.id);
    return;
  }
  const { salt, hash } = hashPassword(password);
  db.prepare("INSERT INTO users(id,email,name,role,password_salt,password_hash,created_at) VALUES(?,?,?,'admin',?,?,?)")
    .run(randomUUID(), email, name, salt, hash, now());
  console.log(`Admin account provisioned for ${email}.`);
}

// ── Row mappers ─────────────────────────────────────────────────────────
export const toProduct = row => row && ({
  id: row.id, name: row.name, slug: row.slug, description: row.description, price: row.price,
  categoryId: row.category_id, images: JSON.parse(row.images || '[]'), materials: row.materials,
  available: Boolean(row.available), stock: row.stock, published: Boolean(row.published),
  personalized: Boolean(row.personalized), sku: row.sku,
});
export const toCategory = row => row && ({
  id: row.id, name: row.name, slug: row.slug, description: row.description, image: row.image,
  published: Boolean(row.published),
});
export const toArtisan = row => row && ({
  id: row.id, name: row.name, slug: row.slug, bio: row.bio, specialty: row.specialty,
  image: row.image, published: Boolean(row.published),
});
export const toAddress = row => row && ({
  id: row.id, fullName: row.full_name, phone: row.phone, line1: row.line1, line2: row.line2,
  city: row.city, state: row.state, postalCode: row.postal_code, country: row.country,
  isDefault: Boolean(row.is_default),
});
export const toOrder = (row, includeLines = true) => row && ({
  id: row.id, status: row.status, paymentStatus: row.payment_status,
  paymentMethod: row.payment_method || 'gateway',
  subtotal: row.subtotal,
  currency: row.currency, createdAt: row.created_at,
  gatewayOrderId: row.gateway_order_id, gatewayPaymentId: row.gateway_payment_id,
  paidAt: row.paid_at || null,
  address: JSON.parse(row.address_snapshot),
  items: includeLines ? db.prepare('SELECT product_id AS productId, product_name AS name, unit_price AS unitPrice, quantity FROM order_items WHERE order_id = ?').all(row.id) : undefined,
});
export const toGalleryItem = row => row && ({
  id: row.id, title: row.title, category: row.category, image: row.image_url,
  artisanName: row.artisan_name, description: row.description, alt: row.alt,
  featured: Boolean(row.featured),
});

export function publicUser(row) {
  return row && { id: row.id, email: row.email, name: row.name, phone: row.phone, role: row.role };
}

export const makeId = () => randomUUID();
export const timestamp = now;
