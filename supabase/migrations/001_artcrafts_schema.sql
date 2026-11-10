-- ARTCRAFTS application schema for Supabase Postgres.
-- Apply with Supabase CLI or paste into the Supabase SQL Editor before switching DATABASE_URL.
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 phone TEXT NOT NULL DEFAULT '', role TEXT NOT NULL CHECK(role IN ('customer','admin')),
 password_salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at BIGINT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS addresses (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 full_name TEXT NOT NULL, phone TEXT NOT NULL, line1 TEXT NOT NULL, line2 TEXT NOT NULL DEFAULT '',
 city TEXT NOT NULL, state TEXT NOT NULL, postal_code TEXT NOT NULL, country TEXT NOT NULL,
 is_default SMALLINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS categories (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '', image TEXT NOT NULL DEFAULT '', published SMALLINT NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS products (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT NOT NULL DEFAULT '',
 price INTEGER NOT NULL CHECK(price >= 0), category_id TEXT REFERENCES categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
 images TEXT NOT NULL DEFAULT '[]', materials TEXT NOT NULL DEFAULT '', available SMALLINT NOT NULL DEFAULT 1,
 stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0), published SMALLINT NOT NULL DEFAULT 0,
 personalized SMALLINT NOT NULL DEFAULT 0, sku TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS artisans (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, bio TEXT NOT NULL DEFAULT '',
 specialty TEXT NOT NULL DEFAULT '', image TEXT NOT NULL DEFAULT '', published SMALLINT NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), address_snapshot TEXT NOT NULL,
 subtotal INTEGER NOT NULL CHECK(subtotal >= 0), currency TEXT NOT NULL DEFAULT 'INR',
 status TEXT NOT NULL DEFAULT 'Pending', payment_status TEXT NOT NULL DEFAULT 'created',
 payment_method TEXT NOT NULL DEFAULT 'gateway', gateway_order_id TEXT, gateway_payment_id TEXT, gateway_signature TEXT,
 inventory_released SMALLINT NOT NULL DEFAULT 0, expires_at BIGINT NOT NULL, paid_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_owner ON orders(user_id, created_at);
CREATE TABLE IF NOT EXISTS order_items (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 product_id TEXT NOT NULL, product_name TEXT NOT NULL, unit_price INTEGER NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity > 0)
);
CREATE TABLE IF NOT EXISTS custom_requests (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', craft TEXT NOT NULL,
 occasion TEXT NOT NULL DEFAULT '', design TEXT NOT NULL DEFAULT '', personalization TEXT NOT NULL DEFAULT '',
 budget TEXT NOT NULL DEFAULT '', required_by TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
 reference_image_url TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'Pending', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS contact_messages (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, subject TEXT NOT NULL DEFAULT '',
 message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'New', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS processed_webhooks (
 event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS gallery_items (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL DEFAULT '', image_url TEXT NOT NULL DEFAULT '',
 artisan_name TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', alt TEXT NOT NULL DEFAULT '',
 featured SMALLINT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
