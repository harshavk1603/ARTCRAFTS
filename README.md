# ARTCRAFTS — Crafting Memories, Creating Art

A full-stack handmade arts & crafts e-commerce storefront with React 19 frontend and Node.js 22 API backend.

**Architecture**: React SPA on **Vercel** (frontend) + Node.js API on **Render** (backend) with Supabase Postgres and Storage, Razorpay payments, and Resend emails.

## Requirements

- Node.js 22.12 or newer
- npm (the repo ships a single `package-lock.json`)

## Quick Start (Local Development)

```bash
# 1. Install dependencies
npm ci

# 2. Copy environment config, then add Supabase pooler connection details
cp .env.example .env
# Set DATABASE_URL, ADMIN_EMAIL, and ADMIN_PASSWORD (≥10 chars)

# 3. Create the Supabase tables and seed the catalog on first API launch
npm run supabase:migrate

# Optional: import existing local data before starting the app (target tables must be empty)
npm run supabase:import-sqlite

# 4. Start both frontend and backend
npm run dev

# 5. Open http://127.0.0.1:5173
#    API runs on port 3001, Vite proxies /api automatically
```

The API uses Supabase Postgres for accounts, sessions, products, addresses, orders, and messages, and Supabase Storage for images. Render is stateless: no persistent disk is required. If you are transferring an existing local store, run `npm run supabase:import-sqlite` after the schema migration and before the API's first launch against that Supabase project.

## Deployment

| Layer | Platform | Config File |
|-------|----------|-------------|
| Frontend (React SPA) | Vercel | `vercel.json` |
| Backend (Node.js API) | Render | `render.yaml` |

**📖 See [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) for full step-by-step deployment instructions.**

### Quick Deploy

1. **Render** (backend): Connect repo → Render auto-detects `render.yaml` → set env vars → deploy
2. **Vercel** (frontend): Import repo → set `VITE_API_URL` to your Render URL → deploy
3. On Render, set `FRONTEND_URL` to your exact Vercel origin (comma-separated for previews/custom domains) → redeploy

## Features

- 🛍️ Public storefront browsing (no login required)
- 👤 Customer registration/login, saved addresses, order history
- 🎨 Custom order request form with reference image upload
- 🛒 Full checkout with Razorpay (UPI, Cards, Net Banking) + COD
- 📦 Admin dashboard with product/inventory/order/artisan/gallery management
- 🖼️ Image uploads via Supabase Storage (local disk fallback for development)
- 📧 Email notifications via Resend (order confirmations, enquiries)
- 🔒 Server-side auth with secure session cookies
- 💾 Supabase Postgres database with automatic catalog seeding

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API + Vite dev server together |
| `npm run dev:api` | API only on port 3001 |
| `npm run dev:frontend` | Vite only on port 5173 |
| `npm run build` | Production frontend build |
| `npm start` | Production backend server |

## Tech Stack

- **Frontend**: React 19, React Router 7, Vite 8, Lucide Icons
- **Backend**: Node.js 22, native HTTP, PostgreSQL client
- **Database**: Supabase Postgres
- **Storage**: Supabase Storage / local disk
- **Payments**: Razorpay Standard Checkout
- **Email**: Resend API

## License

This project is licensed under the terms of the [MIT License](LICENSE).
Copyright (c) 2026 Harshavardhan Kancharlapalli (ARTCRAFTS).
