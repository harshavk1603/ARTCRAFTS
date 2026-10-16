# ARTCRAFTS — Complete Render Deployment Guide

> **Repository:** [https://github.com/harshavk1603/ARTCRAFTS](https://github.com/harshavk1603/ARTCRAFTS)  
> **Branch:** `main`  
> **Tech Stack:** React 19, Vite 8, Native Node.js 22+ HTTP Server, `node:sqlite` (WAL Mode), Supabase Storage, Razorpay Payments.

---

## 1. Selected Deployment Architectures

ARTCRAFTS is designed to be **Dual-Mode Compatible**. You can deploy it using either of the following two architectures on Render:

### Architecture A: Unified Single Web Service (Recommended & Simplest)
- **Why it is recommended:**
  - **Zero CORS:** Both the compiled Vite SPA (`/`) and the API (`/api/*`) are served by the same native Node.js HTTP server on the same domain (`https://artcrafts.onrender.com`).
  - **100% Reliable First-Party Cookies:** Immune to browser third-party cookie restrictions (Safari ITP, Chrome Privacy Sandbox, Brave).
  - **Single Service Management:** Only 1 Render Web Service to configure, monitor, and attach a persistent disk to.
  - **Native SPA Fallback:** Client-side React Router navigation (e.g. `/shop`, `/account`, `/admin/dashboard`) works automatically on page refreshes via the built-in static router in `server/index.mjs`.

### Architecture B: Decoupled Two-Service Blueprint (Static Site + Web Service)
- **Why use it:** If you prefer serving frontend assets via Render's global CDN (`artcrafts-frontend.onrender.com`) and running the API separately on a backend Web Service (`artcrafts-backend.onrender.com`).
- **How it connects:**
  - Frontend configured with `VITE_API_URL=https://artcrafts-backend.onrender.com`.
  - Backend configured with `FRONTEND_URL=https://artcrafts-frontend.onrender.com`.
  - Authentication supports both `SameSite=None; Secure` cookies and `Authorization: Bearer <token>` fallback headers.

---

## 2. Step-by-Step Render Deployment

### Method 1: Blueprint Deployment (One-Click Automated via `render.yaml`)

1. Log into your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** in the top navigation bar and select **Blueprint**.
3. Connect your GitHub repository: `https://github.com/harshavk1603/ARTCRAFTS`.
4. Render will automatically read `render.yaml` and configure both services:
   - `artcrafts-backend` (Web Service with 1GB persistent disk at `/app/data`)
   - `artcrafts-frontend` (Static Site with SPA rewrite rules)
5. Populate the secret environment variables when prompted by Render (see Section 3).
6. Click **Apply**.

---

### Method 2: Manual Service Creation

#### Deploying Architecture A: Unified Web Service (Recommended)
1. In the Render Dashboard, click **New +** → **Web Service**.
2. Select your repository `harshavk1603/ARTCRAFTS` and branch `main`.
3. Fill in the service settings:
   - **Name:** `artcrafts`
   - **Region:** Choose closest to your users (e.g., Singapore, Frankfurt, Oregon).
   - **Branch:** `main`
   - **Root Directory:** *(leave blank)*
   - **Runtime:** `Node`
   - **Build Command:** `npm ci && npm run build`
   - **Start Command:** `node server/index.mjs`
   - **Instance Type:** `Starter` ($7/month — required to attach a Persistent Disk).
4. **Attach Persistent Disk:**
   - Scroll to the **Disks** section and click **Add Disk**.
   - **Name:** `artcrafts-data`
   - **Mount Path:** `/app/data`
   - **Size:** `1 GB` (can be scaled up as your store grows).
5. **Health Check Path:**
   - Set **Health Check Path** to `/api/health`.
6. Add Environment Variables (see Section 3) and click **Create Web Service**.

---

#### Deploying Architecture B: Two Separate Services

##### Service 1: Backend Web Service
1. **New +** → **Web Service** → Select `harshavk1603/ARTCRAFTS`, branch `main`.
2. **Name:** `artcrafts-backend`
3. **Runtime:** `Node`
4. **Build Command:** `npm ci`
5. **Start Command:** `node server/index.mjs`
6. **Plan:** `Starter`
7. **Disk:** Mount Path `/app/data`, Size `1 GB`.
8. **Health Check:** `/api/health`.
9. **Environment Variables:** Set all backend variables (Section 3). Note your backend URL (e.g., `https://artcrafts-backend.onrender.com`).

##### Service 2: Frontend Static Site
1. **New +** → **Static Site** → Select `harshavk1603/ARTCRAFTS`, branch `main`.
2. **Name:** `artcrafts-frontend`
3. **Build Command:** `npm ci && npm run build`
4. **Publish Directory:** `dist`
5. **Redirects/Rewrites:**
   - Click **Redirects/Rewrites** → **Add Rule**:
     - **Type:** `Rewrite`
     - **Source:** `/*`
     - **Destination:** `/index.html`
6. **Environment Variables:**
   - `VITE_API_URL` = `https://artcrafts-backend.onrender.com` (your backend Web Service URL).

---

## 3. Environment Variables Reference

Configure these in the **Environment** tab of your Render Web Service:

| Variable | Required | Recommended Production Value / Description |
| :--- | :--- | :--- |
| `NODE_ENV` | **Yes** | `production` *(activates production security, disables simulated checkout rails, sets Secure cookies)* |
| `DB_PATH` | **Yes** | `/app/data/artcrafts.sqlite` *(points SQLite to the persistent disk mount)* |
| `PORT` | Auto | Render injects this automatically; `server/index.mjs` reads `process.env.PORT` |
| `ADMIN_EMAIL` | **Yes** | `admin@artcrafts.com` *(studio administrator email)* |
| `ADMIN_PASSWORD` | **Yes** | *Your secure admin password (minimum 10 characters)* |
| `ADMIN_NAME` | No | `ARTCRAFTS Administrator` |
| `FRONTEND_URL` | Decoupled only | `https://artcrafts-frontend.onrender.com` *(allowed CORS origin; not needed for Unified architecture)* |
| `SUPABASE_URL` | Optional | `https://ycbwqqcgqxbtltiaugxl.supabase.co` |
| `SUPABASE_SECRET_KEY` | Optional | `sb_secret_...` *(used for cloud media storage & private database backups)* |
| `SUPABASE_PUBLISHABLE_KEY` | Optional | `sb_publishable_...` |
| `SUPABASE_STORAGE_BUCKET` | No | `artcrafts-media` *(default public bucket)* |
| `RAZORPAY_KEY_ID` | Optional | `rzp_test_...` *(Razorpay Test Key ID for checkout)* |
| `RAZORPAY_KEY_SECRET` | Optional | `...` *(Razorpay Key Secret for HMAC verification)* |
| `RAZORPAY_WEBHOOK_SECRET` | Optional | `...` *(Razorpay Webhook secret for event deduplication)* |
| `RESEND_API_KEY` | Optional | `re_...` *(for customer order confirmation emails)* |
| `NOTIFICATION_FROM_EMAIL`| No | `orders@artcrafts.com` |

> [!WARNING]
> Never commit your `.env` file to Git. All production secrets should be set exclusively in Render's dashboard.

---

## 4. SQLite Database & Persistent Disk Management

1. **Storage Location:**  
   The database and write-ahead logs (`artcrafts.sqlite`, `artcrafts.sqlite-wal`, and `artcrafts.sqlite-shm`) reside at `/app/data/`.
2. **Persistence Guarantee:**  
   Render Persistent Disks survive container rebuilds, deploys, and restarts.
3. **Automatic Schema & Seeding Safety:**  
   On startup, `server/db.mjs` checks `SELECT COUNT(*) FROM products`. It **only seeds initial demonstration catalog items if the database is brand new (count = 0)**. Your existing products, stock adjustments, orders, and customer accounts will never be overwritten on redeployment.
4. **Backup & Disaster Recovery:**  
   - **One-Click Cloud Backup:** As an administrator, click **Cloud Backup** in the Studio dashboard. The server snapshots all tables to a timestamped JSON file and uploads it to a private Supabase bucket (`artcrafts-backups`) or `./data/backups/`.
   - **Direct Download:** Administrators can stream database snapshots directly to their browser via `POST /api/admin/backup?download=1`.
   - Public requests to `/uploads/backups/*` or `/data/*` are rejected with `403 Forbidden`.

---

## 5. Razorpay Payment Setup (Test Mode)

1. Obtain your Test API Keys from the [Razorpay Dashboard](https://dashboard.razorpay.com) (`Settings` → `API Keys`).
2. Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to your Render Backend Environment Variables.
3. **Configure the Webhook in Razorpay:**
   - In Razorpay Dashboard, go to **Settings** → **Webhooks** → **Add New Webhook**.
   - **Webhook URL:** `https://<YOUR-RENDER-BACKEND-URL>/api/webhooks/razorpay`
   - **Secret:** Generate a secret string and save it as `RAZORPAY_WEBHOOK_SECRET` in Render.
   - **Active Events:**
     - `payment.captured`
     - `payment.failed`
     - `order.paid`
4. **Verification:**
   - In production mode (`NODE_ENV=production`), simulated checkout rails are locked down. Test transactions require either:
     - Real Razorpay modal execution using Razorpay Test Cards (e.g. `4111 1111 1111 1111`).
     - Cash on Delivery (`COD`).

---

## 6. Verifying a Successful Deployment

Once Render displays **Deploy live**:

1. **Health Check:**  
   Visit `https://<your-service>.onrender.com/api/health`. You should receive:
   ```json
   {
     "status": "ok",
     "database": "ok",
     "razorpayConfigured": true,
     "supabaseConfigured": true,
     "timestamp": "2026-10-16T..."
   }
   ```
2. **Storefront & Catalog:**  
   Visit `https://<your-service>.onrender.com/` and navigate to `/shop` and `/collections`.
3. **SPA Deep Linking:**  
   Hard refresh (`Ctrl + F5`) on `/shop` and `/custom-orders`. The page should render directly without a 404 error.
4. **Customer Lifecycle:**  
   Register a test customer at `/login`, add a delivery address, and view `/profile`.
5. **Admin Studio:**  
   Sign in at `/admin/login` using your configured `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Verify the Studio Dashboard metrics load.

---

## 7. Common Deployment Failures & Solutions

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **Server fails with `FATAL: ADMIN_EMAIL and ADMIN_PASSWORD...`** | Missing administrator credentials in production on first boot | Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (min 10 characters) in Render Environment Variables. |
| **Database disappears on restart** | Persistent disk not mounted or `DB_PATH` incorrect | Verify the disk is mounted at `/app/data` and `DB_PATH` is set to `/app/data/artcrafts.sqlite`. |
| **Cross-Origin / CORS Error (`403 Forbidden`)** | Decoupled frontend URL not recognized by backend | Add `FRONTEND_URL=https://artcrafts-frontend.onrender.com` in backend environment variables. |
| **Razorpay Checkout modal fails to open** | Missing `RAZORPAY_KEY_ID` or invalid key | Ensure `RAZORPAY_KEY_ID` is set and begins with `rzp_test_` or `rzp_live_`. |
| **404 on `/shop` refresh (Decoupled Static Site)** | Missing SPA rewrite rule | Add a rewrite rule in Render Static Site settings: Source `/*` → Destination `/index.html`. |
| **Health Check Timeout** | Port misconfiguration | Ensure backend binds to `0.0.0.0` and listens on `process.env.PORT` (already handled in `server/index.mjs`). |
