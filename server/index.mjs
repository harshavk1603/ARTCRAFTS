import { createServer } from 'node:http';
import { createHash, createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { resolve, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, hashPassword, makeId, publicUser, timestamp, toAddress, toArtisan, toCategory, toOrder, toProduct, toGalleryItem, provisionAdminFromEnvironment } from './db.mjs';
import { ensureBucket, uploadFile, uploadBackup, parseMultipart, parseBase64DataUrl, supabaseConfigured } from './supabase.mjs';
import { notifyOrderConfirmed, notifyCustomOrder, notifyContactMessage } from './notifications.mjs';

// ── Environment ─────────────────────────────────────────────────────────
try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
provisionAdminFromEnvironment();
ensureBucket().catch(err => console.warn('Supabase bucket init skipped:', err.message));

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');
const DIST = resolve(ROOT, 'dist');
const UPLOADS = resolve(ROOT, 'uploads');

const PORT = Number(process.env.PORT || process.env.API_PORT || 3000);
const SESSION_COOKIE = 'artcrafts_session';
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;
const RESERVATION_MS = 15 * 60 * 1000;
const RATE = new Map();
const text = (value, max = 3000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const integer = value => Number.isSafeInteger(Number(value)) ? Number(value) : NaN;
const hashToken = token => createHash('sha256').update(token).digest('hex');
const bool = value => value ? 1 : 0;

// ── Helpers ─────────────────────────────────────────────────────────────
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function respond(res, status, payload, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(JSON.stringify(payload));
}

function cookie(res, token, maxAge) {
  const secure = (process.env.NODE_ENV === 'production') ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAge / 1000)}${secure}`);
}

function clearCookie(res) {
  const secure = (process.env.NODE_ENV === 'production') ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
}

function rateLimit(req, key, max, windowMs) {
  const ip = req.socket.remoteAddress || 'unknown';
  const id = `${key}:${ip}`;
  const now = Date.now();
  const entries = (RATE.get(id) || []).filter(t => t > now - windowMs);
  if (entries.length >= max) throw new HttpError(429, 'Too many attempts. Please wait and try again.');
  entries.push(now);
  RATE.set(id, entries);
}

async function readRaw(req, maxBytes = 128 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw new HttpError(413, 'Request is too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function parseJson(raw) {
  if (!raw.length) return {};
  try { return JSON.parse(raw.toString('utf8')); }
  catch { throw new HttpError(400, 'Request must contain valid JSON.'); }
}

function safeEqualHex(a, b) {
  if (!/^[a-f\d]+$/i.test(a) || !/^[a-f\d]+$/i.test(b) || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

function currentUser(req) {
  const header = req.headers.cookie || '';
  const token = header.split(';').map(x => x.trim()).find(x => x.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (!token) return null;
  const session = db.prepare(`SELECT u.*, s.expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?`).get(hashToken(token));
  if (!session) return null;
  if (session.expires_at < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token));
    return null;
  }
  return session;
}

function requireUser(user, role) {
  if (!user) throw new HttpError(401, 'Please sign in to continue.');
  if (role && user.role !== role) throw new HttpError(403, 'You do not have access to this area.');
  return user;
}

function requiredString(value, label, max = 300) {
  const out = text(value, max);
  if (!out) throw new HttpError(400, `${label} is required.`);
  return out;
}

function passwordMatches(user, password) {
  if (!user || typeof password !== 'string') return false;
  const actual = scryptSync(password, user.password_salt, 64);
  const expected = Buffer.from(user.password_hash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function createSession(res, user) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + (user.role === 'admin' ? ADMIN_SESSION_MS : SESSION_MS);
  db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)')
    .run(hashToken(token), user.id, expiresAt, timestamp());
  cookie(res, token, expiresAt - Date.now());
}

// ── Reservation / stock management ──────────────────────────────────────
function cleanExpiredReservations() {
  const expired = db.prepare("SELECT id FROM orders WHERE payment_status='created' AND expires_at < ? AND inventory_released=0").all(Date.now());
  for (const { id } of expired) releaseReservation(id, 'Expired', 'expired');
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
}

function reserveOrder(user, addressId, requestedItems) {
  if (!Array.isArray(requestedItems) || requestedItems.length < 1 || requestedItems.length > 20) throw new HttpError(400, 'Your bag must contain between 1 and 20 different products.');
  const addressRow = db.prepare('SELECT * FROM addresses WHERE id=? AND user_id=?').get(addressId, user.id);
  if (!addressRow) throw new HttpError(400, 'Choose a saved delivery address before checkout.');
  const unique = new Map();
  for (const line of requestedItems) {
    const id = text(line?.productId, 80);
    const qty = integer(line?.quantity);
    if (!id || !Number.isInteger(qty) || qty < 1 || qty > 10) throw new HttpError(400, 'Product quantities must be between 1 and 10.');
    unique.set(id, (unique.get(id) || 0) + qty);
  }
  if ([...unique.values()].some(qty => qty > 10)) throw new HttpError(400, 'Maximum quantity per product is 10.');
  const orderId = randomUUID();
  const lines = [];
  let subtotal = 0;
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const [id, qty] of unique) {
      const productRow = db.prepare('SELECT * FROM products WHERE id=? AND published=1 AND available=1').get(id);
      if (!productRow) throw new HttpError(409, 'One of the selected pieces is no longer available.');
      if (productRow.stock < qty) throw new HttpError(409, `${productRow.name} does not have enough stock for that quantity.`);
      db.prepare('UPDATE products SET stock=stock-? WHERE id=? AND stock>=?').run(qty, id, qty);
      const lineTotal = productRow.price * qty;
      if (!Number.isSafeInteger(lineTotal) || subtotal + lineTotal > 10_000_000) throw new HttpError(400, 'Order total is outside the supported limit.');
      subtotal += lineTotal;
      lines.push({ product: toProduct(productRow), quantity: qty });
    }
    const address = toAddress(addressRow);
    db.prepare(`INSERT INTO orders(id,user_id,address_snapshot,subtotal,status,payment_status,expires_at,created_at,updated_at)
      VALUES(?,?,?,?,'Pending','created',?,?,?)`).run(orderId, user.id, JSON.stringify(address), subtotal, Date.now() + RESERVATION_MS, timestamp(), timestamp());
    const addLine = db.prepare('INSERT INTO order_items(id,order_id,product_id,product_name,unit_price,quantity) VALUES(?,?,?,?,?,?)');
    for (const line of lines) addLine.run(makeId(), orderId, line.product.id, line.product.name, line.product.price, line.quantity);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { orderId, subtotal, address: toAddress(addressRow), lines };
}

function releaseReservation(id, status, paymentStatus) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id=?').get(id);
    if (!order || order.inventory_released || order.payment_status === 'captured') { db.exec('COMMIT'); return; }
    const lines = db.prepare('SELECT product_id,quantity FROM order_items WHERE order_id=?').all(id);
    for (const line of lines) db.prepare('UPDATE products SET stock=stock+? WHERE id=?').run(line.quantity, line.product_id);
    db.prepare('UPDATE orders SET status=?,payment_status=?,inventory_released=1,updated_at=? WHERE id=?')
      .run(status, paymentStatus, timestamp(), id);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

// ── Razorpay helpers ────────────────────────────────────────────────────
function razorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

async function razorpayRequest(path, method = 'GET', payload) {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method, headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new HttpError(502, data?.error?.description || 'Payment gateway request failed.');
  return data;
}

async function createGatewayOrder(reserved, user) {
  const receipt = `ac_${reserved.orderId.replaceAll('-', '').slice(0, 32)}`;
  try {
    const gateway = await razorpayRequest('orders', 'POST', {
      amount: reserved.subtotal * 100, currency: 'INR', receipt,
      notes: { artcrafts_order_id: reserved.orderId, customer_id: user.id },
    });
    db.prepare('UPDATE orders SET gateway_order_id=?,updated_at=? WHERE id=?').run(gateway.id, timestamp(), reserved.orderId);
    return gateway;
  } catch (error) {
    releaseReservation(reserved.orderId, 'Payment setup failed', 'failed');
    throw error;
  }
}

function toAdminOrder(row) {
  const lines = db.prepare('SELECT product_name AS name,quantity,unit_price AS unitPrice FROM order_items WHERE order_id=?').all(row.id);
  const address = JSON.parse(row.address_snapshot);
  return {
    id: row.id,
    customer: address.fullName,
    email: row.customer_email || '',
    phone: address.phone || '',
    address,
    request: lines.map(x => `${x.name} × ${x.quantity}`).join(', '),
    date: row.created_at,
    status: row.status,
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method || 'gateway',
    gatewayPaymentId: row.gateway_payment_id || '',
    subtotal: row.subtotal,
    items: lines,
  };
}

// ── Upload helper (handles both multipart and JSON base64) ──────────────
async function handleUpload(raw, contentType, folder) {
  let buffer, mimeType;

  if (contentType && contentType.includes('multipart/form-data')) {
    const { file } = parseMultipart(raw, contentType);
    if (!file) throw new HttpError(400, 'No image file found in the upload.');
    buffer = file.buffer;
    mimeType = file.mimeType;
  } else {
    const body = parseJson(raw);
    if (body.imageUrl && typeof body.imageUrl === 'string' && !body.imageUrl.startsWith('data:')) {
      return { url: body.imageUrl, storage: 'external' };
    }
    const parsed = parseBase64DataUrl(body.image || body.imageUrl || body.file);
    if (!parsed) throw new HttpError(400, 'Provide an image file or a base64 data URL.');
    buffer = parsed.buffer;
    mimeType = parsed.mimeType;
  }

  return uploadFile(buffer, mimeType, folder);
}

// ── Static file serving ─────────────────────────────────────────────────
const MIME_TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.mjs': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf',
};

function serveStatic(res, filePath, cacheControl = 'public, max-age=31536000, immutable') {
  if (!existsSync(filePath)) return false;
  const stat = statSync(filePath);
  if (!stat.isFile()) return false;
  const ext = extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': mime, 'content-length': stat.size, 'cache-control': cacheControl });
  createReadStream(filePath).pipe(res);
  return true;
}

// ══════════════════════════════════════════════════════════════════════════
// ── MAIN ROUTER ─────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;
  const method = req.method || 'GET';

  // ── Block access to backups and internal private directories ────────
  if (path.startsWith('/uploads/backups') || path.startsWith('/data/')) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' }).end('403 Forbidden');
    return;
  }

  // ── Health check ────────────────────────────────────────────────────
  if (path === '/api/health' && method === 'GET') {
    return respond(res, 200, {
      status: 'ok', database: 'ok',
      razorpayConfigured: razorpayConfigured(),
      supabaseConfigured: supabaseConfigured(),
      timestamp: new Date().toISOString(),
    });
  }

  // ── Payment config (public, never expose secret) ────────────────────
  if (path === '/api/payments/config' && method === 'GET') {
    const rz = razorpayConfigured();
    const isProd = process.env.NODE_ENV === 'production';
    return respond(res, 200, {
      enabled: true,
      isConfigured: rz,
      keyId: rz ? process.env.RAZORPAY_KEY_ID : null,
      allowDevSimulation: !isProd,
      razorpay: { enabled: rz, keyId: rz ? process.env.RAZORPAY_KEY_ID : null },
      gateways: isProd
        ? [
            ...(rz ? [{ id: 'razorpay', name: 'Razorpay Gateway', description: 'Credit / Debit Card, UPI, Net Banking' }] : []),
            { id: 'cod', name: 'Cash on Delivery', description: 'Pay at your doorstep upon receiving your piece' },
          ]
        : [
            { id: 'card', name: 'Credit / Debit Card', description: 'Visa, MasterCard, RuPay, Amex' },
            { id: 'upi', name: 'UPI & QR Code', description: 'Instant payment via GPay, PhonePe, Paytm, or Scan QR' },
            { id: 'netbanking', name: 'Net Banking', description: 'Major Indian retail & corporate banks' },
            { id: 'cod', name: 'Cash on Delivery', description: 'Pay at your doorstep upon receiving your piece' },
            ...(rz ? [{ id: 'razorpay', name: 'Razorpay Gateway', description: 'Standard Razorpay checkout' }] : []),
          ],
      name: 'ARTCRAFTS',
    });
  }

  if (path === '/api/auth/demo-info' && method === 'GET') {
    return respond(res, 200, {
      adminEmail: process.env.ADMIN_EMAIL || 'admin@artcrafts.com',
      adminPasswordHint: 'Set in .env (ADMIN_PASSWORD)',
    });
  }

  // ── Public gallery ──────────────────────────────────────────────────
  if (path === '/api/gallery' && method === 'GET') {
    const items = db.prepare('SELECT * FROM gallery_items ORDER BY featured DESC, created_at DESC').all().map(toGalleryItem);
    return respond(res, 200, { gallery: items });
  }

  // ── CORS / Origin check for unsafe methods ──────────────────────────
  const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  if (unsafe && path !== '/api/webhooks/razorpay' && path !== '/api/payments/webhook' && req.headers.origin) {
    const expected = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
    if (req.headers.origin !== expected) throw new HttpError(403, 'Cross-origin request rejected.');
  }

  // ── Read body ───────────────────────────────────────────────────────
  const isWebhook = path === '/api/webhooks/razorpay' || path === '/api/payments/webhook';
  const isUpload = path.startsWith('/api/upload/') || path === '/api/admin/upload-image';
  const maxBody = isWebhook ? 1024 * 1024 : isUpload ? 6 * 1024 * 1024 : 128 * 1024;
  const raw = unsafe ? await readRaw(req, maxBody) : Buffer.alloc(0);
  const contentType = req.headers['content-type'] || '';
  const body = (!isUpload && !isWebhook) || contentType.includes('application/json') ? parseJson(raw) : {};
  const user = currentUser(req);

  // ══════════════════════════════════════════════════════════════════════
  // ── AUTH ROUTES ─────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════
  if (path === '/api/auth/me' && method === 'GET') return respond(res, 200, { user: publicUser(user) });

  if (path === '/api/auth/register' && method === 'POST') {
    rateLimit(req, 'register', 6, 60 * 60 * 1000);
    const name = requiredString(body.name, 'Name', 100);
    const email = requiredString(body.email, 'Email', 254).toLowerCase();
    const password = body.password;
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.');
    if (typeof password !== 'string' || password.length < 10 || password.length > 128) throw new HttpError(400, 'Password must be at least 10 characters long.');
    if (process.env.ADMIN_EMAIL?.toLowerCase() === email) throw new HttpError(409, 'That address is reserved for the administrator.');
    const { salt, hash } = hashPassword(password);
    const account = { id: makeId(), email, name, phone: text(body.phone, 32), role: 'customer' };
    try { db.prepare('INSERT INTO users(id,email,name,phone,role,password_salt,password_hash,created_at) VALUES(?,?,?,?,?,?,?,?)').run(account.id, email, name, account.phone, 'customer', salt, hash, timestamp()); }
    catch (error) { if (String(error.message).includes('UNIQUE')) throw new HttpError(409, 'An account with that email already exists.'); throw error; }
    createSession(res, { ...account });
    return respond(res, 201, { user: account });
  }

  if (path === '/api/auth/login' && method === 'POST') {
    rateLimit(req, 'login', 12, 15 * 60 * 1000);
    const email = requiredString(body.email, 'Email', 254).toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    const requestedRole = body.role === 'admin' ? 'admin' : 'customer';
    const account = db.prepare('SELECT * FROM users WHERE email=? COLLATE NOCASE').get(email);
    const matches = passwordMatches(account, password);
    if (!matches || account.role !== requestedRole) throw new HttpError(401, 'Email, password, or account type is incorrect.');
    createSession(res, account);
    return respond(res, 200, { user: publicUser(account) });
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    const token = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token));
    clearCookie(res);
    return respond(res, 200, { ok: true });
  }

  // ══════════════════════════════════════════════════════════════════════
  // ── STOREFRONT ROUTES ───────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════
  if (path === '/api/storefront/products' && method === 'GET') return respond(res, 200, { products: db.prepare('SELECT * FROM products WHERE published=1 ORDER BY created_at DESC,name').all().map(toProduct) });
  if (path === '/api/storefront/categories' && method === 'GET') return respond(res, 200, { categories: db.prepare('SELECT * FROM categories WHERE published=1 ORDER BY name').all().map(toCategory) });
  if (path === '/api/storefront/artisans' && method === 'GET') return respond(res, 200, { artisans: db.prepare('SELECT * FROM artisans WHERE published=1 ORDER BY name').all().map(toArtisan) });

  // ══════════════════════════════════════════════════════════════════════
  // ── PROFILE ROUTES ──────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════
  if (path === '/api/profile' && method === 'GET') {
    const account = requireUser(user, 'customer');
    return respond(res, 200, { user: publicUser(account), addresses: db.prepare('SELECT * FROM addresses WHERE user_id=? ORDER BY is_default DESC,created_at DESC').all(account.id).map(toAddress) });
  }
  if (path === '/api/profile' && method === 'PUT') {
    const account = requireUser(user, 'customer');
    const name = requiredString(body.name, 'Name', 100);
    const phone = requiredString(body.phone, 'Phone', 32);
    db.prepare('UPDATE users SET name=?,phone=? WHERE id=?').run(name, phone, account.id);
    return respond(res, 200, { user: publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(account.id)) });
  }
  if (path === '/api/profile/addresses' && method === 'POST') {
    const account = requireUser(user, 'customer');
    const fields = {
      fullName: requiredString(body.fullName, 'Full name', 100), phone: requiredString(body.phone, 'Phone', 32),
      line1: requiredString(body.line1, 'Address line', 180), line2: text(body.line2, 180),
      city: requiredString(body.city, 'City', 80), state: requiredString(body.state, 'State', 80),
      postalCode: requiredString(body.postalCode, 'Postal code', 20), country: requiredString(body.country, 'Country', 80),
    };
    const id = makeId();
    const hasExisting = Boolean(db.prepare('SELECT 1 FROM addresses WHERE user_id=? LIMIT 1').get(account.id));
    const isDefault = (body.isDefault || !hasExisting) ? 1 : 0;
    if (isDefault) db.prepare('UPDATE addresses SET is_default=0 WHERE user_id=?').run(account.id);
    db.prepare(`INSERT INTO addresses(id,user_id,full_name,phone,line1,line2,city,state,postal_code,country,is_default,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, account.id, fields.fullName, fields.phone, fields.line1, fields.line2, fields.city, fields.state, fields.postalCode, fields.country, isDefault, timestamp());
    return respond(res, 201, { address: toAddress(db.prepare('SELECT * FROM addresses WHERE id=?').get(id)) });
  }
  const addressId = path.match(/^\/api\/profile\/addresses\/([\w-]+)$/)?.[1];
  if (addressId && method === 'PUT') {
    const account = requireUser(user, 'customer');
    const current = db.prepare('SELECT * FROM addresses WHERE id=? AND user_id=?').get(addressId, account.id);
    if (!current) throw new HttpError(404, 'Address not found.');
    const fields = {
      fullName: requiredString(body.fullName, 'Full name', 100), phone: requiredString(body.phone, 'Phone', 32),
      line1: requiredString(body.line1, 'Address line', 180), line2: text(body.line2, 180),
      city: requiredString(body.city, 'City', 80), state: requiredString(body.state, 'State', 80),
      postalCode: requiredString(body.postalCode, 'Postal code', 20), country: requiredString(body.country, 'Country', 80),
    };
    const isDefault = bool(body.isDefault);
    db.exec('BEGIN IMMEDIATE');
    try {
      if (isDefault) db.prepare('UPDATE addresses SET is_default=0 WHERE user_id=?').run(account.id);
      db.prepare(`UPDATE addresses SET full_name=?,phone=?,line1=?,line2=?,city=?,state=?,postal_code=?,country=?,is_default=? WHERE id=? AND user_id=?`)
        .run(fields.fullName, fields.phone, fields.line1, fields.line2, fields.city, fields.state, fields.postalCode, fields.country, isDefault, addressId, account.id);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return respond(res, 200, { address: toAddress(db.prepare('SELECT * FROM addresses WHERE id=?').get(addressId)) });
  }
  if (addressId && method === 'DELETE') {
    const account = requireUser(user, 'customer');
    const result = db.prepare('DELETE FROM addresses WHERE id=? AND user_id=?').run(addressId, account.id);
    if (!result.changes) throw new HttpError(404, 'Address not found.');
    return respond(res, 200, { ok: true });
  }
  const addressDefaultMatch = path.match(/^\/api\/profile\/addresses\/([\w-]+)\/default$/);
  if (addressDefaultMatch && method === 'PATCH') {
    const account = requireUser(user, 'customer');
    const targetId = addressDefaultMatch[1];
    const current = db.prepare('SELECT id FROM addresses WHERE id=? AND user_id=?').get(targetId, account.id);
    if (!current) throw new HttpError(404, 'Address not found.');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE addresses SET is_default=0 WHERE user_id=?').run(account.id);
      db.prepare('UPDATE addresses SET is_default=1 WHERE id=? AND user_id=?').run(targetId, account.id);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return respond(res, 200, { ok: true, addresses: db.prepare('SELECT * FROM addresses WHERE user_id=? ORDER BY is_default DESC,created_at DESC').all(account.id).map(toAddress) });
  }

  // ══════════════════════════════════════════════════════════════════════
  // ── CUSTOM ORDERS ───────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════
  if (path === '/api/custom-orders' && method === 'POST') {
    rateLimit(req, 'custom-order', 8, 60 * 60 * 1000);
    const values = {
      name: requiredString(body.name, 'Name', 100), email: requiredString(body.email, 'Email', 254).toLowerCase(),
      phone: text(body.phone, 32), craft: requiredString(body.craft, 'Craft type', 180),
      occasion: text(body.occasion, 120), design: text(body.design, 1200), personalization: text(body.personalization, 500),
      budget: text(body.budget, 80), requiredBy: text(body.requiredBy, 32), notes: text(body.notes, 3000),
      referenceImageUrl: text(body.referenceImageUrl, 2000),
    };
    if (!/^\S+@\S+\.\S+$/.test(values.email)) throw new HttpError(400, 'Enter a valid email address.');
    const id = `AC-${randomBytes(4).toString('hex').toUpperCase()}`;
    db.prepare(`INSERT INTO custom_requests(id,name,email,phone,craft,occasion,design,personalization,budget,required_by,notes,reference_image_url,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id, values.name, values.email, values.phone, values.craft, values.occasion, values.design, values.personalization, values.budget, values.requiredBy, values.notes, values.referenceImageUrl, timestamp());
    notifyCustomOrder({ ...values, id }).catch(() => {});
    return respond(res, 201, { reference: id, message: 'Your request has been recorded.' });
  }

  // ── Upload reference image (for custom orders) ──────────────────────
  if (path === '/api/upload/reference-image' && method === 'POST') {
    rateLimit(req, 'upload', 10, 60 * 60 * 1000);
    const result = await handleUpload(raw, contentType, 'custom-orders');
    return respond(res, 201, { url: result.url, storage: result.storage });
  }

  // ══════════════════════════════════════════════════════════════════════
  // ── CONTACT ─────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════
  if (path === '/api/contact' && method === 'POST') {
    rateLimit(req, 'contact', 8, 60 * 60 * 1000);
    const name = requiredString(body.name, 'Name', 100), email = requiredString(body.email, 'Email', 254).toLowerCase();
    const subject = text(body.subject, 180), message = requiredString(body.message, 'Message', 5000);
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Enter a valid email address.');
    db.prepare('INSERT INTO contact_messages(id,name,email,subject,message,created_at) VALUES(?,?,?,?,?,?)').run(makeId(), name, email, subject, message, timestamp());
    notifyContactMessage({ name, email, subject, message }).catch(() => {});
    return respond(res, 201, { ok: true, message: 'Your message has been recorded.' });
  }

  // ══════════════════════════════════════════════════════════════════════
  // ── CUSTOMER ORDERS ─────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════
  if (path === '/api/orders' && method === 'GET') {
    const account = requireUser(user, 'customer');
    return respond(res, 200, { orders: db.prepare('SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC').all(account.id).map(row => toOrder(row)) });
  }

  // ══════════════════════════════════════════════════════════════════════
  // ── CHECKOUT / PAYMENT ROUTES ───────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════
  if (path === '/api/checkout/create-order' && method === 'POST') {
    const account = requireUser(user, 'customer');
    rateLimit(req, 'checkout', 12, 60 * 60 * 1000);
    const reserved = reserveOrder(account, text(body.addressId, 80), body.items);

    if (razorpayConfigured()) {
      const gateway = await createGatewayOrder(reserved, account);
      return respond(res, 201, { orderId: reserved.orderId, gatewayOrderId: gateway.id, amount: gateway.amount, currency: gateway.currency, keyId: process.env.RAZORPAY_KEY_ID, customer: { name: account.name, email: account.email, contact: account.phone } });
    }
    // Dev simulation when Razorpay keys not set
    if (process.env.NODE_ENV !== 'production') {
      const simOrderId = `sim_order_${Date.now()}`;
      db.prepare('UPDATE orders SET gateway_order_id=?,updated_at=? WHERE id=?').run(simOrderId, timestamp(), reserved.orderId);
      return respond(res, 201, { orderId: reserved.orderId, gatewayOrderId: simOrderId, amount: reserved.subtotal * 100, currency: 'INR', keyId: null, devSimulation: true, customer: { name: account.name, email: account.email, contact: account.phone } });
    }
    throw new HttpError(503, 'Checkout is not configured yet. Add Razorpay keys to .env and restart the server.');
  }

  if (path === '/api/checkout/verify' && method === 'POST') {
    const account = requireUser(user, 'customer');
    const orderId = requiredString(body.orderId, 'Order ID', 80);
    const paymentId = requiredString(body.razorpay_payment_id, 'Payment reference', 80);
    const gatewayOrderId = requiredString(body.razorpay_order_id, 'Gateway order reference', 80);
    const signature = requiredString(body.razorpay_signature, 'Payment signature', 256);
    const order = db.prepare('SELECT * FROM orders WHERE id=? AND user_id=?').get(orderId, account.id);
    if (!order || !order.gateway_order_id || order.gateway_order_id !== gatewayOrderId) throw new HttpError(404, 'Order not found.');

    // Dev simulation path
    if (!razorpayConfigured() && process.env.NODE_ENV !== 'production') {
      db.prepare(`UPDATE orders SET status='Paid',payment_status='captured',gateway_payment_id=?,gateway_signature=?,paid_at=?,updated_at=? WHERE id=? AND payment_status!='captured'`)
        .run(paymentId, 'dev-simulated', timestamp(), timestamp(), order.id);
      const updatedOrder = toOrder(db.prepare('SELECT * FROM orders WHERE id=?').get(order.id));
      notifyOrderConfirmed(updatedOrder, account.email, account.name).catch(() => {});
      return respond(res, 200, { verified: true, order: updatedOrder });
    }

    const expected = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '').update(`${order.gateway_order_id}|${paymentId}`).digest('hex');
    if (!razorpayConfigured() || !safeEqualHex(signature, expected)) throw new HttpError(400, 'Payment verification failed.');
    const payment = await razorpayRequest(`payments/${encodeURIComponent(paymentId)}`);
    if (payment.order_id !== order.gateway_order_id || Number(payment.amount) !== order.subtotal * 100 || payment.currency !== 'INR') throw new HttpError(400, 'Payment details do not match this order.');
    if (payment.status !== 'captured') return respond(res, 202, { verified: false, status: payment.status, message: 'Payment is not captured yet. The order will update when the gateway confirms it.' });
    db.prepare(`UPDATE orders SET status='Paid',payment_status='captured',gateway_payment_id=?,gateway_signature=?,paid_at=?,updated_at=? WHERE id=? AND payment_status!='captured'`)
      .run(paymentId, signature, timestamp(), timestamp(), order.id);
    const updatedOrder = toOrder(db.prepare('SELECT * FROM orders WHERE id=?').get(order.id));
    notifyOrderConfirmed(updatedOrder, account.email, account.name).catch(() => {});
    return respond(res, 200, { verified: true, order: updatedOrder });
  }

  // ── Instant checkout (simulated gateway for Card/UPI/NetBanking/COD) ──
  if (path === '/api/checkout/pay' && method === 'POST') {
    const account = requireUser(user, 'customer');
    rateLimit(req, 'checkout-pay', 25, 60 * 60 * 1000);
    const addressIdForPay = requiredString(body.addressId, 'Delivery address', 80);
    const items = body.items;
    const paymentMethod = requiredString(body.paymentMethod, 'Payment method', 30);

    if (!['card', 'upi', 'netbanking', 'cod', 'razorpay'].includes(paymentMethod)) {
      throw new HttpError(400, 'Invalid payment method selected.');
    }

    // Lock Down Simulated Payments in Production:
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction && paymentMethod !== 'cod') {
      const razorpayPaymentId = text(body.razorpay_payment_id || body.paymentId, 80);
      const razorpayOrderId = text(body.razorpay_order_id || body.gatewayOrderId, 80);
      const signature = text(body.razorpay_signature || body.signature, 256);

      if (!razorpayConfigured() || !signature || !razorpayPaymentId || !razorpayOrderId) {
        throw new HttpError(403, 'Simulated online payment rails are disabled in production. Please complete checkout via verified Razorpay or Cash on Delivery.');
      }

      const expected = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');
      if (!safeEqualHex(signature, expected)) {
        throw new HttpError(400, 'Payment verification failed: invalid gateway signature.');
      }
    }
    if (!Array.isArray(items) || items.length < 1 || items.length > 20) {
      throw new HttpError(400, 'Your bag must contain between 1 and 20 different products.');
    }

    const addressRow = db.prepare('SELECT * FROM addresses WHERE id=? AND user_id=?').get(addressIdForPay, account.id);
    if (!addressRow) throw new HttpError(400, 'Choose a saved delivery address before checkout.');

    const unique = new Map();
    for (const line of items) {
      const id = text(line?.productId, 80);
      const qty = integer(line?.quantity);
      if (!id || !Number.isInteger(qty) || qty < 1 || qty > 10) throw new HttpError(400, 'Product quantities must be between 1 and 10.');
      unique.set(id, (unique.get(id) || 0) + qty);
    }

    const payOrderId = `ORD-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const txnId = `TXN-${paymentMethod.toUpperCase()}-${randomBytes(5).toString('hex').toUpperCase()}`;
    let subtotal = 0;
    const lines = [];

    db.exec('BEGIN IMMEDIATE');
    try {
      for (const [id, qty] of unique) {
        const productRow = db.prepare('SELECT * FROM products WHERE id=? AND published=1 AND available=1').get(id);
        if (!productRow) throw new HttpError(409, 'One of the selected pieces is no longer available.');
        if (productRow.stock < qty) throw new HttpError(409, `${productRow.name} does not have enough stock for that quantity (only ${productRow.stock} left).`);
        db.prepare('UPDATE products SET stock=stock-? WHERE id=? AND stock>=?').run(qty, id, qty);
        const lineTotal = productRow.price * qty;
        if (!Number.isSafeInteger(lineTotal) || subtotal + lineTotal > 10_000_000) throw new HttpError(400, 'Order total is outside the supported limit.');
        subtotal += lineTotal;
        lines.push({ product: toProduct(productRow), quantity: qty });
      }

      const address = toAddress(addressRow);
      const isCod = paymentMethod === 'cod';
      const orderStatus = isCod ? 'Confirmed' : 'Paid';
      const paymentStatus = isCod ? 'cod_pending' : 'captured';

      db.prepare(`INSERT INTO orders(id,user_id,address_snapshot,subtotal,currency,status,payment_status,payment_method,gateway_order_id,gateway_payment_id,inventory_released,expires_at,paid_at,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,0,?,?,?,?)`).run(
          payOrderId, account.id, JSON.stringify(address), subtotal, 'INR',
          orderStatus, paymentStatus, paymentMethod, payOrderId, txnId,
          Date.now() + (365 * 24 * 60 * 60 * 1000), isCod ? null : timestamp(), timestamp(), timestamp()
        );

      const addLine = db.prepare('INSERT INTO order_items(id,order_id,product_id,product_name,unit_price,quantity) VALUES(?,?,?,?,?,?)');
      for (const line of lines) {
        addLine.run(makeId(), payOrderId, line.product.id, line.product.name, line.product.price, line.quantity);
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

    const createdOrder = toOrder(db.prepare('SELECT * FROM orders WHERE id=?').get(payOrderId));
    notifyOrderConfirmed(createdOrder, account.email, account.name).catch(() => {});
    return respond(res, 201, {
      success: true, verified: true, order: createdOrder, transactionId: txnId, paymentMethod,
      message: paymentMethod === 'cod' ? 'Order placed! Pay with cash or UPI on delivery.' : 'Payment completed and verified successfully!'
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // ── RAZORPAY WEBHOOK (with idempotency) ─────────────────────────────
  // ══════════════════════════════════════════════════════════════════════
  if ((path === '/api/payments/webhook' || path === '/api/webhooks/razorpay') && method === 'POST') {
    if (!process.env.RAZORPAY_WEBHOOK_SECRET) throw new HttpError(503, 'Payment webhook is not configured.');
    const rawBuffer = raw;
    const signature = text(req.headers['x-razorpay-signature'], 256);
    const expectedSig = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBuffer).digest('hex');
    if (!safeEqualHex(signature, expectedSig)) throw new HttpError(400, 'Invalid webhook signature.');

    // Idempotency check
    const eventId = text(req.headers['x-razorpay-event-id'], 256);
    if (eventId) {
      const already = db.prepare('SELECT 1 FROM processed_webhooks WHERE event_id=?').get(eventId);
      if (already) return respond(res, 200, { received: true, duplicate: true });
    }

    const webhookBody = parseJson(rawBuffer);
    const event = webhookBody.event;
    const entity = webhookBody.payload?.payment?.entity;
    const gatewayOrderId = entity?.order_id || webhookBody.payload?.order?.entity?.id;
    if (gatewayOrderId) {
      const order = db.prepare('SELECT * FROM orders WHERE gateway_order_id=?').get(gatewayOrderId);
      if (order && event === 'payment.captured' && entity?.amount === order.subtotal * 100) {
        db.prepare(`UPDATE orders SET status='Paid',payment_status='captured',gateway_payment_id=?,paid_at=?,updated_at=? WHERE id=? AND payment_status!='captured'`)
          .run(entity.id, timestamp(), timestamp(), order.id);
      } else if (order && event === 'payment.failed' && order.payment_status !== 'captured') {
        releaseReservation(order.id, 'Payment failed', 'failed');
      }
    }

    // Record event for idempotency
    if (eventId) {
      try { db.prepare('INSERT INTO processed_webhooks(event_id,event_type,processed_at) VALUES(?,?,?)').run(eventId, event || 'unknown', timestamp()); } catch {}
    }
    return respond(res, 200, { received: true });
  }

  // ══════════════════════════════════════════════════════════════════════
  // ── ADMIN ROUTES ────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════
  const admin = path.startsWith('/api/admin/');
  if (admin) requireUser(user, 'admin');

  // ── Admin image upload ──────────────────────────────────────────────
  if (path === '/api/admin/upload-image' && method === 'POST') {
    const folder = text(body.folder || (contentType.includes('multipart') ? 'products' : 'products'), 50);
    const validFolders = ['products', 'artisans', 'gallery', 'categories'];
    const targetFolder = validFolders.includes(folder) ? folder : 'products';
    const result = await handleUpload(raw, contentType, targetFolder);
    return respond(res, 201, { url: result.url, storage: result.storage });
  }

  // ── Admin dashboard ─────────────────────────────────────────────────
  if (path === '/api/admin/dashboard' && method === 'GET') {
    const metrics = {
      products: db.prepare('SELECT COUNT(*) AS count FROM products').get().count,
      publishedProducts: db.prepare('SELECT COUNT(*) AS count FROM products WHERE published=1').get().count,
      lowStock: db.prepare('SELECT COUNT(*) AS count FROM products WHERE stock BETWEEN 1 AND 4').get().count,
      pendingOrders: db.prepare("SELECT COUNT(*) AS count FROM orders WHERE status IN ('Pending','Paid')").get().count,
      pendingRequests: db.prepare("SELECT COUNT(*) AS count FROM custom_requests WHERE status='Pending'").get().count,
      categories: db.prepare('SELECT COUNT(*) AS count FROM categories').get().count,
    };
    const recent = db.prepare(`SELECT o.*,u.email AS customer_email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.created_at DESC LIMIT 5`).all().map(toAdminOrder);
    return respond(res, 200, { metrics, recent });
  }

  if (path === '/api/admin/products' && method === 'GET') return respond(res, 200, { products: db.prepare('SELECT * FROM products ORDER BY created_at DESC,name').all().map(toProduct) });
  if (path === '/api/admin/categories' && method === 'GET') return respond(res, 200, { categories: db.prepare('SELECT * FROM categories ORDER BY name').all().map(toCategory) });
  if (path === '/api/admin/artisans' && method === 'GET') return respond(res, 200, { artisans: db.prepare('SELECT * FROM artisans ORDER BY name').all().map(toArtisan) });

  // ── Admin Product CRUD ──────────────────────────────────────────────
  const productMatch = path.match(/^\/api\/admin\/products\/([\w-]+)(?:\/(stock))?$/);
  if (path === '/api/admin/products' && method === 'POST' || productMatch && !productMatch[2] && method === 'PUT') {
    const existing = productMatch && !productMatch[2] ? db.prepare('SELECT * FROM products WHERE id=?').get(productMatch[1]) : null;
    if (productMatch && !existing) throw new HttpError(404, 'Product not found.');
    const data = { id: existing?.id || makeId(), name: requiredString(body.name, 'Product name', 180), slug: requiredString(body.slug, 'Slug', 180),
      description: text(body.description, 5000), price: integer(body.price), categoryId: requiredString(body.categoryId, 'Category', 100),
      images: Array.isArray(body.images) ? body.images.slice(0, 8).map(x => text(x, 1000)) : (body.image ? [text(body.image, 1000)] : JSON.parse(existing?.images || '[]')),
      materials: text(body.materials, 500), available: body.available === undefined ? 1 : bool(body.available), stock: integer(body.stock),
      published: bool(body.published), personalized: bool(body.personalized), sku: text(body.sku, 80) };
    if (!Number.isInteger(data.price) || data.price < 0 || !Number.isInteger(data.stock) || data.stock < 0) throw new HttpError(400, 'Price and stock must be whole numbers greater than or equal to zero.');
    if (!db.prepare('SELECT 1 FROM categories WHERE id=?').get(data.categoryId)) throw new HttpError(400, 'Choose an existing category.');
    try {
      if (existing) db.prepare(`UPDATE products SET name=?,slug=?,description=?,price=?,category_id=?,images=?,materials=?,available=?,stock=?,published=?,personalized=?,sku=? WHERE id=?`)
        .run(data.name,data.slug,data.description,data.price,data.categoryId,JSON.stringify(data.images),data.materials,data.available,data.stock,data.published,data.personalized,data.sku,data.id);
      else db.prepare(`INSERT INTO products(id,name,slug,description,price,category_id,images,materials,available,stock,published,personalized,sku,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(data.id,data.name,data.slug,data.description,data.price,data.categoryId,JSON.stringify(data.images),data.materials,data.available,data.stock,data.published,data.personalized,data.sku,timestamp());
    } catch (error) { if (String(error.message).includes('UNIQUE')) throw new HttpError(409, 'That slug is already in use.'); throw error; }
    return respond(res, existing ? 200 : 201, { product: toProduct(db.prepare('SELECT * FROM products WHERE id=?').get(data.id)) });
  }
  if (productMatch?.[2] === 'stock' && method === 'PATCH') {
    const delta = integer(body.delta);
    if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 5000) throw new HttpError(400, 'Enter a stock adjustment between -5000 and 5000.');
    const result = db.prepare('UPDATE products SET stock=stock+? WHERE id=? AND stock+?>=0').run(delta, productMatch[1], delta);
    if (!result.changes) throw new HttpError(409, 'Stock cannot fall below zero, or the product was not found.');
    return respond(res, 200, { product: toProduct(db.prepare('SELECT * FROM products WHERE id=?').get(productMatch[1])) });
  }
  if (productMatch && !productMatch[2] && method === 'DELETE') {
    const existing = db.prepare('SELECT * FROM products WHERE id=?').get(productMatch[1]);
    if (!existing) throw new HttpError(404, 'Product not found.');
    if (db.prepare('SELECT 1 FROM order_items WHERE product_id=? LIMIT 1').get(existing.id)) {
      db.prepare('UPDATE products SET published=0,available=0 WHERE id=?').run(existing.id);
      return respond(res, 200, { archived: true });
    }
    db.prepare('DELETE FROM products WHERE id=?').run(existing.id);
    return respond(res, 200, { ok: true });
  }

  // ── Admin Category CRUD ─────────────────────────────────────────────
  const categoryMatch = path.match(/^\/api\/admin\/categories\/([\w-]+)$/);
  if (path === '/api/admin/categories' && method === 'POST' || categoryMatch && method === 'PUT') {
    const existing = categoryMatch ? db.prepare('SELECT * FROM categories WHERE id=?').get(categoryMatch[1]) : null;
    if (categoryMatch && !existing) throw new HttpError(404, 'Category not found.');
    const data = { id: existing?.id || makeId(), name: requiredString(body.name, 'Category name', 120), slug: requiredString(body.slug, 'Slug', 140),
      description: text(body.description, 2000), image: text(body.image || existing?.image, 1000), published: bool(body.published) };
    try {
      if (existing) db.prepare('UPDATE categories SET name=?,slug=?,description=?,image=?,published=? WHERE id=?').run(data.name,data.slug,data.description,data.image,data.published,data.id);
      else db.prepare('INSERT INTO categories(id,name,slug,description,image,published) VALUES(?,?,?,?,?,?)').run(data.id,data.name,data.slug,data.description,data.image,data.published);
    } catch (error) { if (String(error.message).includes('UNIQUE')) throw new HttpError(409, 'That slug is already in use.'); throw error; }
    return respond(res, existing ? 200 : 201, { category: toCategory(db.prepare('SELECT * FROM categories WHERE id=?').get(data.id)) });
  }
  if (categoryMatch && method === 'DELETE') {
    try { db.prepare('DELETE FROM categories WHERE id=?').run(categoryMatch[1]); }
    catch (error) { if (String(error.message).includes('FOREIGN KEY')) throw new HttpError(409, 'Reassign or remove products in this collection first.'); throw error; }
    return respond(res, 200, { ok: true });
  }

  // ── Admin Artisan CRUD ──────────────────────────────────────────────
  const artisanMatch = path.match(/^\/api\/admin\/artisans\/([\w-]+)$/);
  if (path === '/api/admin/artisans' && method === 'POST' || artisanMatch && method === 'PUT') {
    const existing = artisanMatch ? db.prepare('SELECT * FROM artisans WHERE id=?').get(artisanMatch[1]) : null;
    if (artisanMatch && !existing) throw new HttpError(404, 'Artisan not found.');
    const data = { id: existing?.id || makeId(), name: requiredString(body.name, 'Name', 120), slug: requiredString(body.slug, 'Slug', 140),
      bio: text(body.bio, 3000), specialty: requiredString(body.specialty, 'Craft specialty', 180), image: text(body.image || existing?.image, 1000), published: bool(body.published) };
    try {
      if (existing) db.prepare('UPDATE artisans SET name=?,slug=?,bio=?,specialty=?,image=?,published=? WHERE id=?').run(data.name,data.slug,data.bio,data.specialty,data.image,data.published,data.id);
      else db.prepare('INSERT INTO artisans(id,name,slug,bio,specialty,image,published) VALUES(?,?,?,?,?,?,?)').run(data.id,data.name,data.slug,data.bio,data.specialty,data.image,data.published);
    } catch (error) { if (String(error.message).includes('UNIQUE')) throw new HttpError(409, 'That slug is already in use.'); throw error; }
    return respond(res, existing ? 200 : 201, { artisan: toArtisan(db.prepare('SELECT * FROM artisans WHERE id=?').get(data.id)) });
  }
  if (artisanMatch && method === 'DELETE') {
    const result = db.prepare('DELETE FROM artisans WHERE id=?').run(artisanMatch[1]);
    if (!result.changes) throw new HttpError(404, 'Artisan not found.');
    return respond(res, 200, { ok: true });
  }

  // ── Admin Gallery CRUD ──────────────────────────────────────────────
  if (path === '/api/admin/gallery' && method === 'GET') {
    return respond(res, 200, { gallery: db.prepare('SELECT * FROM gallery_items ORDER BY featured DESC, created_at DESC').all().map(toGalleryItem) });
  }
  if (path === '/api/admin/gallery' && method === 'POST') {
    const data = {
      id: makeId(),
      title: requiredString(body.title, 'Title', 200),
      category: text(body.category, 100),
      imageUrl: text(body.imageUrl || body.image, 1000),
      artisanName: text(body.artisanName, 100),
      description: text(body.description, 2000),
      alt: text(body.alt, 300),
      featured: bool(body.featured),
    };
    db.prepare('INSERT INTO gallery_items(id,title,category,image_url,artisan_name,description,alt,featured,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
      .run(data.id, data.title, data.category, data.imageUrl, data.artisanName, data.description, data.alt, data.featured, timestamp());
    return respond(res, 201, { item: toGalleryItem(db.prepare('SELECT * FROM gallery_items WHERE id=?').get(data.id)) });
  }
  const galleryMatch = path.match(/^\/api\/admin\/gallery\/([\w-]+)$/);
  if (galleryMatch && method === 'PUT') {
    const existing = db.prepare('SELECT * FROM gallery_items WHERE id=?').get(galleryMatch[1]);
    if (!existing) throw new HttpError(404, 'Gallery item not found.');
    const data = {
      title: requiredString(body.title, 'Title', 200),
      category: text(body.category, 100),
      imageUrl: text(body.imageUrl || body.image || existing.image_url, 1000),
      artisanName: text(body.artisanName, 100),
      description: text(body.description, 2000),
      alt: text(body.alt, 300),
      featured: bool(body.featured),
    };
    db.prepare('UPDATE gallery_items SET title=?,category=?,image_url=?,artisan_name=?,description=?,alt=?,featured=? WHERE id=?')
      .run(data.title, data.category, data.imageUrl, data.artisanName, data.description, data.alt, data.featured, galleryMatch[1]);
    return respond(res, 200, { item: toGalleryItem(db.prepare('SELECT * FROM gallery_items WHERE id=?').get(galleryMatch[1])) });
  }
  if (galleryMatch && method === 'DELETE') {
    const result = db.prepare('DELETE FROM gallery_items WHERE id=?').run(galleryMatch[1]);
    if (!result.changes) throw new HttpError(404, 'Gallery item not found.');
    return respond(res, 200, { ok: true });
  }

  // ── Admin Orders ────────────────────────────────────────────────────
  if (path === '/api/admin/orders' && method === 'GET') {
    const orders = db.prepare(`SELECT o.*,u.email AS customer_email FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.created_at DESC`).all().map(toAdminOrder);
    const requests = db.prepare('SELECT * FROM custom_requests ORDER BY created_at DESC').all().map(x => ({ id:x.id, customer:x.name, email:x.email, request:x.craft, notes:x.notes, date:x.created_at, status:x.status, type:'Custom request', referenceImageUrl: x.reference_image_url || '' }));
    const messages = db.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC').all().map(x => ({ id:x.id, customer:x.name, email:x.email, request:x.subject || 'Contact message', notes:x.message, date:x.created_at, status:x.status, type:'Contact' }));
    return respond(res, 200, { records: [...orders.map(x=>({...x,type:'Order'})), ...requests, ...messages].sort((a,b)=>b.date.localeCompare(a.date)) });
  }
  const orderMatch = path.match(/^\/api\/admin\/orders\/([\w-]+)$/);
  if (orderMatch && method === 'PATCH') {
    const status = text(body.status, 40);
    if (!['Pending','Paid','In Progress','Completed','Cancelled'].includes(status)) throw new HttpError(400, 'Choose a valid order status.');
    const order = db.prepare('SELECT * FROM orders WHERE id=?').get(orderMatch[1]);
    if (!order) {
      const request = db.prepare('SELECT id FROM custom_requests WHERE id=?').get(orderMatch[1]);
      const message = db.prepare('SELECT id FROM contact_messages WHERE id=?').get(orderMatch[1]);
      if (request) db.prepare('UPDATE custom_requests SET status=? WHERE id=?').run(status, orderMatch[1]);
      else if (message) db.prepare('UPDATE contact_messages SET status=? WHERE id=?').run(status, orderMatch[1]);
      else throw new HttpError(404, 'Order or request not found.');
      return respond(res, 200, { ok: true });
    }
    if (status === 'Cancelled' && order.payment_status !== 'captured') releaseReservation(order.id, 'Cancelled', 'cancelled');
    else db.prepare('UPDATE orders SET status=?,updated_at=? WHERE id=?').run(status, timestamp(), order.id);
    return respond(res, 200, { order: toOrder(db.prepare('SELECT * FROM orders WHERE id=?').get(order.id)) });
  }

  // ── Admin Backup ────────────────────────────────────────────────────
  if (path === '/api/admin/backup' && (method === 'POST' || method === 'GET')) {
    const tables = ['users', 'categories', 'products', 'artisans', 'orders', 'order_items', 'addresses', 'custom_requests', 'contact_messages', 'gallery_items'];
    const backup = {};
    for (const table of tables) {
      try { backup[table] = db.prepare(`SELECT * FROM ${table}`).all(); } catch { backup[table] = []; }
    }
    backup._meta = { exportedAt: timestamp(), tables: tables.length };
    const buf = Buffer.from(JSON.stringify(backup, null, 2), 'utf8');
    const filename = `artcrafts-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

    // Stream directly as a downloadable file if requested via query param or body
    if (url.searchParams.get('download') === '1' || body?.download) {
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
        'content-length': buf.length,
        'cache-control': 'no-store',
      });
      res.end(buf);
      return;
    }

    const result = await uploadBackup(buf, filename);
    return respond(res, 200, { ok: true, location: result.location, storage: result.storage, filename, size: buf.length });
  }

  // ── API 404 ─────────────────────────────────────────────────────────
  if (path.startsWith('/api/')) throw new HttpError(404, 'API route not found.');

  // ══════════════════════════════════════════════════════════════════════
  // ── STATIC FILE SERVING ─────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════

  // Serve /uploads/* from local disk
  if (path.startsWith('/uploads/') && method === 'GET') {
    if (path.startsWith('/uploads/backups')) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' }).end('403 Forbidden');
      return;
    }
    const filePath = resolve(UPLOADS, path.replace('/uploads/', ''));
    if (!filePath.startsWith(UPLOADS)) { res.writeHead(403).end(); return; }
    if (serveStatic(res, filePath, 'public, max-age=86400')) return;
    res.writeHead(404).end('Not found');
    return;
  }

  // In production, serve Vite build from dist/
  if (method === 'GET' && existsSync(resolve(DIST, 'index.html'))) {
    // Try exact file in dist/
    const filePath = resolve(DIST, path === '/' ? 'index.html' : path.slice(1));
    if (filePath.startsWith(DIST) && serveStatic(res, filePath, path.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600')) return;
    // SPA fallback — serve index.html for React Router deep links
    serveStatic(res, resolve(DIST, 'index.html'), 'public, max-age=0, must-revalidate');
    return;
  }

  // If no dist and not an API route, return 404
  res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found — run `npm run build` first for static serving.');
}

// ══════════════════════════════════════════════════════════════════════════
// ── SERVER SETUP ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════
const server = createServer(async (req, res) => {
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('content-security-policy', "default-src 'self'; script-src 'self' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'self' https://api.razorpay.com; frame-src https://api.razorpay.com https://checkout.razorpay.com; base-uri 'self'; form-action 'self'");
  try { await route(req, res); }
  catch (error) {
    const status = Number.isInteger(error.status) ? error.status : 500;
    if (status >= 500) console.error(error);
    if (!res.headersSent) respond(res, status, { error: status >= 500 ? 'The server could not complete this request.' : error.message });
    else res.destroy();
  }
});

cleanExpiredReservations();
const cleanup = setInterval(cleanExpiredReservations, 60_000);
cleanup.unref();

server.listen(PORT, '0.0.0.0', () => console.log(`ARTCRAFTS API listening at http://127.0.0.1:${PORT}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { clearInterval(cleanup); server.close(() => { db.close(); process.exit(0); }); });
