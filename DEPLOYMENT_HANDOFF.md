# ARTCRAFTS — Production Architecture & Deployment Handoff Manual

> **Status:** Production-Ready (100% Feature Complete)  
> **Application:** ARTCRAFTS Handcrafted Resin & Artisan Keepsakes  
> **Architecture:** Single-Server Unified Stack (React 19 + Vite 8 + Native Node.js HTTP + `node:sqlite` WAL)  
> **Aesthetic:** Ivory / Warm Cream / Antique Gold / Dark Umber Walnut Boutique Design  

---

## 1. System Architecture Overview

ARTCRAFTS runs as an ultra-high performance, self-contained single-server web application. There are **zero external daemon dependencies** required to run the baseline store, database, media uploads, or checkout.

```
                    ┌───────────────────────────────────────────────┐
                    │               Client Browser                  │
                    │   React 19 + Vite 8 SPA (Vanilla CSS Tokens)  │
                    └──────────────────────┬────────────────────────┘
                                           │
                         HTTP / HTTPS (Port 3001 or 80/443)
                                           │
                                           ▼
┌───────────────────────────────────────────────────────────────────────────┐
│              Unified Node.js 22+ Production Server (server/index.mjs)      │
├──────────────────────────┬────────────────────────────────────────────────┤
│  Static File Server      │  REST API Routing & Security Middleware        │
│  - dist/ (Vite SPA)      │  - /api/auth/* (SHA-256 session tokens, salt)  │
│  - SPA Fallback routing  │  - /api/storefront/* (Products, Categories)    │
│  - uploads/ (Local media)│  - /api/checkout/* (Reservations, Razorpay)    │
│  - Gzip / Cache-Control  │  - /api/admin/* (RBAC Protected Studio Studio) │
│  - CSP / HSTS Headers    │  - /api/webhooks/razorpay (HMAC-SHA256 Idemp)  │
└────────────┬─────────────┴───────────────────────┬────────────────────────┘
             │                                     │
             ▼                                     ▼
┌──────────────────────────┐         ┌──────────────────────────────────────┐
│  SQLite Database Engine  │         │  External Integrations (Optional)    │
│  - node:sqlite (Native)  │         │  - Supabase Storage (Auto-bucket)    │
│  - WAL Journal Mode      │         │  - Razorpay Gateway (Cards/UPI/Net)  │
│  - Synchronous = NORMAL  │         │  - Resend Email Notifications        │
│  - STRICT Tables & FK ON │         │  - Local Disk Fallback (uploads/)    │
└──────────────────────────┘         └──────────────────────────────────────┘
```

---

## 2. Environment Variables Configuration

Create a `.env` file in the project root (copied from `.env.example`). The server loads this file automatically on startup via `process.loadEnvFile()` without third-party dependencies.

| Variable Name | Required | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | `production` | Enables production security (Secure cookies, disabled simulation). |
| `API_PORT` or `PORT` | Yes | `3001` | TCP port where the unified web server listens. |
| `DB_PATH` | No | `./data/artcrafts.sqlite` | Filepath for the SQLite database. |
| `SESSION_SECRET` | No | `(auto-generated salt)` | Secret string used for cryptographic salts. |
| `ADMIN_EMAIL` | **Yes** | `admin@artcrafts.com` | Email address for the bootstrap Studio Administrator. |
| `ADMIN_NAME` | No | `ARTCRAFTS Administrator` | Display name for the Administrator. |
| `ADMIN_PASSWORD` | **Yes** | `ArtCraftsAdmin@2026!` | Initial bootstrap admin password (min 10 characters). |
| `RAZORPAY_KEY_ID` | Optional | `rzp_test_...` | Razorpay API Key ID for online checkout. |
| `RAZORPAY_KEY_SECRET` | Optional | `...` | Razorpay API Secret for signature verification. |
| `RAZORPAY_WEBHOOK_SECRET` | Optional | `...` | Razorpay Webhook secret for raw buffer HMAC verification. |
| `SUPABASE_URL` | Optional | `https://xyz.supabase.co` | Supabase project URL for cloud image storage. |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | `eyJ...` | Supabase Service Role key for bucket management & uploads. |
| `SUPABASE_STORAGE_BUCKET` | No | `artcrafts-media` | Supabase storage bucket name (auto-created on boot). |
| `RESEND_API_KEY` | Optional | `re_...` | Resend API key for transactional order confirmation emails. |
| `NOTIFICATION_FROM_EMAIL` | No | `orders@artcrafts.com` | Sender address for order receipts and notifications. |

---

## 3. Payment Gateway Configuration (Razorpay)

ARTCRAFTS provides dual-mode payment handling:
1. **Interactive Multi-Rail Gateway (Development / Fallback):** When Razorpay keys are not configured or in development mode, customers can test Card, UPI, Net Banking, and Cash on Delivery flows with real inventory reservation, state persistence, and instant receipt generation.
2. **Production Razorpay Integration:**
   - Add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` to `.env`.
   - The checkout page automatically detects the configured gateway, loads `checkout.js`, opens the branded modal, and verifies the HMAC SHA-256 signature upon completion.
   - **Webhook URL:** `https://your-domain.com/api/webhooks/razorpay`
   - **Supported Webhook Events:** `payment.captured`, `payment.failed`, `order.paid`.
   - **Idempotency:** Webhook events are deduplicated via the `processed_webhooks` SQLite table.

---

## 4. Media Storage (Supabase & Local Fallback)

ARTCRAFTS features a dual-layer media pipeline:
1. **Automatic Supabase Cloud Storage:**
   - When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are defined, the server checks for the `artcrafts-media` bucket on startup. If missing, it automatically creates the public bucket with a 5 MB file size limit and MIME restrictions (`image/jpeg`, `image/png`, `image/webp`).
   - Images uploaded via Admin Studio or Custom Order enquiries are uploaded directly into organized folders (`products/`, `categories/`, `artisans/`, `gallery/`, `custom-orders/`, `backups/`).
2. **Zero-Configuration Local Disk Fallback:**
   - If Supabase keys are left blank, all uploads stream safely to `./uploads/` on the server disk and are served with public cache headers at `/uploads/*`.

---

## 5. Deployment Options

### Option A: Docker Deployment (Recommended)
The project includes a production-grade multi-stage `Dockerfile`:
```bash
# 1. Build the image
docker build -t artcrafts-storefront:latest .

# 2. Run with a persistent volume for SQLite data and uploads
docker run -d \
  -p 3001:3001 \
  --name artcrafts \
  --env-file .env \
  -v artcrafts_data:/app/data \
  -v artcrafts_uploads:/app/uploads \
  artcrafts-storefront:latest
```

### Option B: Railway Deployment
1. Connect your Git repository to [Railway](https://railway.app).
2. Railway detects `railway.json` and builds via `Dockerfile`.
3. In the Railway dashboard under **Variables**, paste your environment variables.
4. Under **Volumes**, add a persistent volume mounted to `/app/data`.

### Option C: Render Deployment
1. Connect repository to [Render](https://render.com) using the included `render.yaml` Blueprint.
2. Render creates the Web Service with the 1 GB persistent disk for `/app/data`.
3. Fill in the sensitive environment variables in the Render dashboard.

### Option D: Direct Node.js Production Host (Ubuntu / VPS / PM2)
```bash
# 1. Install production dependencies and build the frontend bundle
npm ci
npm run build

# 2. Run with PM2 or systemd
pm2 start server/index.mjs --name artcrafts --node-args="--env-file=.env"
```

---

## 6. Database Backups & Maintenance

- **SQLite WAL Mode:** The database uses Write-Ahead Logging (`PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;`) for concurrent read/write throughput without blocking storefront traffic.
- **Automated Expired Reservation Sweeper:** Every 60 seconds, an unref'd background task releases inventory from orders that were abandoned during checkout past 15 minutes.
- **One-Click Cloud Backup:** In Admin Studio, click **Cloud Backup** or `POST /api/admin/backup`. This generates a timestamped JSON dump of all tables and stores it in Supabase or `./uploads/backups/`.

---

## 7. Initial Admin Credentials

To access the Admin Studio:
- **URL:** Navigate to `/admin/login` or click the user icon in the header and choose **Admin Studio**.
- **Email:** Set in your `.env` as `ADMIN_EMAIL` (default: `admin@artcrafts.com`).
- **Password:** Set in your `.env` as `ADMIN_PASSWORD` (min 10 chars).
- The admin user is automatically created upon first server boot.
