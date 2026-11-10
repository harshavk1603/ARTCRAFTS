# ARTCRAFTS — Deployment Guide

> **Architecture**: React 19 SPA on **Vercel** + stateless Node.js 22 API on **Render** + **Supabase** Postgres and Storage.
>
> Supabase is the source of truth for data and images. Render holds no persistent disk; `data/` and `uploads/` are not used for production persistence when Supabase is configured.

---

## 0. Architecture at a glance

| Layer | Platform | What it serves |
|-------|----------|----------------|
| Frontend | Vercel | Vite-built React SPA (`dist/`) |
| Backend | Render | Node API (`server/index.mjs`) |
| Database | Supabase Postgres | Users, sessions, products, orders, enquiries |
| Images | Supabase Storage | `artcrafts-media` public bucket |
| Payments | Razorpay | Cards, UPI, net banking, plus COD |
| Email | Resend | Order confirmations and contact notifications |

Deploy in this order: **GitHub → Supabase → Render → Vercel → set `FRONTEND_URL` → redeploy Render**.

---

## 1. Push to GitHub

```bash
git add .
git commit -m "deploy: Render backend + Vercel frontend"
git push origin main
```

Do not commit `.env`, `data/`, `uploads/`, or `node_modules/`. They are already covered by `.gitignore`. Only `package-lock.json` is used; do not add a second lockfile.

---

## 2. Prepare Supabase

### 2.1 Database

1. Open the Supabase project → **Connect** → **Session pooler**.
2. Copy the complete PostgreSQL URI exactly as shown. Do not construct or edit the pooler host or username. Replace only the password placeholder, and percent-encode reserved characters such as `@`, `#`, or `?` inside the password.
3. Use that URI as `DATABASE_URL` on Render and in your local `.env`. Do not use an `anon`, `publishable`, or `service_role` key as the database password.
4. Apply the schema locally (the API also applies it idempotently on startup):

```bash
npm ci
# put DATABASE_URL and ADMIN_EMAIL/ADMIN_PASSWORD in .env first
npm run supabase:migrate
```

5. Optional, only when moving an existing local store: stop the local API and run the one-time import while the Supabase tables are still empty:

```bash
npm run supabase:import-sqlite
```

The import copies users, sessions, addresses, products, orders, enquiries, and gallery rows in a single transaction. It refuses to run if any target table already has rows. The SQLite file is treated as a read-only legacy source; it is not used at runtime.

If startup reports “tenant/user not found”, copy a fresh Session pooler URI from **Connect**. If it reports password authentication failure, replace the URI password with the current database password. Never paste the URI into chat or commit it.

### 2.2 Storage

1. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`) on Render.
2. The public `artcrafts-media` bucket is created automatically on first boot. You can also create it manually with public read access.
3. Uploads are limited to JPEG, PNG, and WebP files up to 5 MB.
4. Keep the service-role/secret key server-side only. It must never appear in `VITE_*` variables or frontend code.

If storage is not configured, the API falls back to local disk and logs a production warning. On Render that disk is ephemeral, so those images will be lost on the next deploy or restart.

---

## 3. Deploy the backend on Render

### Option A — Blueprint

1. Open [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
2. Connect the GitHub repo.
3. Render reads `render.yaml` and creates the `artcrafts-api` web service.
4. Fill in the secret variables marked `sync: false` (see the table below).
5. Deploy.

### Option B — Manual web service

| Setting | Value |
|---------|-------|
| Runtime | Node |
| Build command | `npm ci --omit=dev` |
| Start command | `node server/index.mjs` |
| Health check path | `/api/health` |
| Persistent disk | **Not needed** (Supabase stores data and images) |

### Required backend environment variables

| Variable | Required | Value |
|----------|----------|-------|
| `NODE_ENV` | Yes | `production` |
| `SERVE_FRONTEND` | Yes | `0` (Vercel serves the SPA) |
| `PORT` | Yes | `10000` (Render injects it; the server binds `0.0.0.0`) |
| `DATABASE_URL` | Yes | Supabase **Session pooler** URI |
| `FRONTEND_URL` | Yes | Vercel production origin; set after Vercel deploy. Comma-separated for extra origins. |
| `ADMIN_EMAIL` | Yes | Admin login email |
| `ADMIN_PASSWORD` | Yes | Strong password, at least 10 characters |
| `ADMIN_NAME` | No | Defaults to `ARTCRAFTS Administrator` |
| `SUPABASE_URL` | Yes | `https://<project>.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service-role or secret key (server-side only) |
| `SUPABASE_STORAGE_BUCKET` | No | Defaults to `artcrafts-media` |
| `PG_POOL_MAX` | No | Defaults to `5` |
| `RAZORPAY_KEY_ID` | No | Enables online payments |
| `RAZORPAY_KEY_SECRET` | No | Razorpay secret |
| `RAZORPAY_WEBHOOK_SECRET` | No | Required for webhook verification |
| `RESEND_API_KEY` | No | Enables transactional email |
| `NOTIFICATION_FROM_EMAIL` | No | Defaults to `orders@artcrafts.com` |
| `API_PUBLIC_URL` | No | Only needed for local-disk uploads on non-Render hosts. Render provides `RENDER_EXTERNAL_URL` automatically. |

There is no session signing secret to set: sessions are random tokens stored hashed in Postgres. `SESSION_SECRET` is not used by the application.

### Verify the backend

```bash
curl https://artcrafts-api.onrender.com/api/health
```

Expected:

```json
{"status":"ok","database":"ok","razorpayConfigured":false,"supabaseConfigured":true,"timestamp":"..."}
```

- `database` must be `ok`.
- `supabaseConfigured` must be `true` for persistent image uploads.
- Render free instances sleep after inactivity; the first request can take 30–60 seconds.
- `GET /` on the Render URL should return `404`. That is expected: the API does not serve the frontend in production.

---

## 4. Deploy the frontend on Vercel

1. Open [Vercel Dashboard](https://vercel.com/dashboard) → **Add New Project**.
2. Import the same GitHub repo.
3. Vercel reads `vercel.json`:
   - Framework: Vite
   - Install command: `npm ci`
   - Build command: `npm run build`
   - Output directory: `dist`
   - SPA rewrite: all non-file routes go to `/index.html`
4. Add the environment variable:

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://artcrafts-api.onrender.com` (your Render URL, no trailing slash) |

5. Deploy.

`VITE_API_URL` is compiled into the bundle at build time. If you change it, redeploy the frontend.

Local development does not need `VITE_API_URL`: Vite proxies `/api` and `/uploads` to `http://127.0.0.1:3001`.

---

## 5. Connect the two services (CORS)

1. Copy the Vercel production URL, for example `https://artcrafts.vercel.app`.
2. On Render, set:

```text
FRONTEND_URL=https://artcrafts.vercel.app
```

3. To allow preview deployments or a custom domain, use a comma-separated list with no trailing slashes:

```text
FRONTEND_URL=https://artcrafts.vercel.app,https://artcrafts-git-main-you.vercel.app,https://www.your-domain.com
```

4. Redeploy the Render service so the new origin list is loaded.

What this enables:

- CORS `Access-Control-Allow-Origin` for the exact configured origins only.
- `Access-Control-Allow-Credentials: true` for cookie-based sessions.
- Production cross-site session cookies use `SameSite=None; Secure`; local and same-site runs use `SameSite=Lax`.
- The API also returns a bearer token, stored by the SPA, so login still works if a browser blocks third-party cookies.
- CSP headers include the configured frontend origins.

Unknown origins are rejected: unsafe cross-origin requests receive `403`, and no CORS headers are sent to them.

---

## 6. Post-deploy checklist

Run these in order after both services are live.

| # | Check | Expected |
|---|-------|----------|
| 1 | `GET https://<render>/api/health` | `200`, `database: ok`, `supabaseConfigured: true` |
| 2 | CORS on `/api/health`, `/api/gallery`, `/api/payments/config` with `Origin: https://<vercel>` | `access-control-allow-origin` echoes the Vercel origin |
| 3 | CORS with `Origin: https://evil.example` | No CORS header; unsafe requests get `403` |
| 4 | Register a customer and refresh the page | Session and bearer token persist |
| 5 | Add a delivery address | Saved in Supabase |
| 6 | Place a Cash on Delivery order | Order created; stock decreases |
| 7 | Razorpay test payment (if keys are set) | Signature verified; order marked Paid |
| 8 | Admin login and product image upload | URL starts with your Supabase project URL and renders on Vercel |
| 9 | Custom order with a reference image | Image uploads and appears in the admin ledger |
| 10 | Gallery item create/edit/delete | Changes appear on the public gallery |
| 11 | Order/contact emails (if Resend is set) | Delivered without errors in Render logs |
| 12 | Razorpay webhook | URL `https://<render>/api/payments/webhook`, secret matches `RAZORPAY_WEBHOOK_SECRET` |
| 13 | Refresh a deep link such as `/shop` on Vercel | SPA loads instead of `404` |
| 14 | `GET https://<render>/` | `404` (the API does not serve the SPA) |
| 15 | Render logs after a test upload | No “Supabase Storage is not configured” warning |
| 16 | Mobile browser | Storefront, login, and checkout work |

---

## 7. Local development

```bash
npm ci
cp .env.example .env
# Fill DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, and Supabase Storage values

npm run supabase:migrate   # optional on first run; the API also applies the schema
npm run dev                # API on :3001 + Vite on :5173
```

Open `http://127.0.0.1:5173`.

| Command | Description |
|---------|-------------|
| `npm run dev` | API + Vite together |
| `npm run dev:api` | API only on port 3001 |
| `npm run dev:frontend` | Vite only on port 5173 |
| `npm run build` | Production frontend build into `dist/` |
| `npm start` | Production backend (`node server/index.mjs`) |
| `npm test` | Integration test suite |
| `npm run supabase:migrate` | Apply the Postgres schema |
| `npm run supabase:import-sqlite` | One-time legacy SQLite import |

If you want to test the single-service layout locally, set `SERVE_FRONTEND=1` and run `npm run build && npm start`. Production must keep `SERVE_FRONTEND=0`.

---

## 8. Troubleshooting

| Symptom | Cause and fix |
|---------|---------------|
| Browser console: CORS policy error | `FRONTEND_URL` must match the browser origin exactly: `https://`, host, port, and no trailing slash. Comma-separate multiple origins. Redeploy Render after changing it. |
| API calls return HTML or “unexpected response” | `VITE_API_URL` is missing or wrong in Vercel. Set it to the Render URL and redeploy the frontend. |
| Login succeeds but the session disappears | Third-party cookie blocking. Confirm HTTPS, `FRONTEND_URL`, and that the SPA's bearer token is present in localStorage. |
| Uploaded images vanish after a Render redeploy | Supabase Storage is not configured. Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; check `supabaseConfigured: true` on `/api/health`. |
| Old images show `/uploads/...` and 404 | Rows were created with the local fallback. Re-upload them with Supabase configured, or set `API_PUBLIC_URL` to the Render URL. |
| `/api/health` returns `500` | `DATABASE_URL` is wrong. Re-copy the Session pooler URI, percent-encode the password, and run `npm run supabase:migrate`. |
| Render crash: administrator required | `ADMIN_EMAIL` and `ADMIN_PASSWORD` must be set in production; the password must be at least 10 characters. |
| Vercel deep link returns `404` | Confirm `vercel.json` still contains the SPA rewrite to `/index.html`. |
| `npm ci` fails on Render or Vercel | `package-lock.json` is out of sync. Run `npm install`, commit the updated lockfile, and redeploy. |
| First request takes 30–60 seconds | Render free tier sleeping. Upgrade the plan or ping `/api/health` periodically. |
| Razorpay verification fails | Check key pair, webhook secret, and that the webhook URL uses HTTPS. |

---

## 9. Security notes

- Secrets come from environment variables only. No `.env`, `data/`, or `uploads/` content is copied into the Docker image (see `.dockerignore`).
- The API rejects unknown browser origins for unsafe methods.
- The database and upload paths reject direct access to `.sqlite`, `.db`, `/data/`, and `/uploads/backups`.
- The production server does not serve `dist/`; Vercel owns the SPA.
- Supabase service-role/secret keys stay on Render. Never expose them through `VITE_*` variables.
