# ARTCRAFTS — Crafting Memories, Creating Art

A full-stack handmade arts & crafts e-commerce storefront with React 19 frontend and Node.js 22 API backend.

**Architecture**: React SPA on **Vercel** (frontend) + Node.js API on **Render** (backend) with SQLite, Supabase Storage, Razorpay payments, and Resend emails.

## Requirements

- Node.js 22.0 or newer (the API uses the built-in `node:sqlite` module)
- npm or pnpm

## Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Copy environment config
cp .env.example .env
# Edit .env — set ADMIN_EMAIL and ADMIN_PASSWORD (≥10 chars)

# 3. Start both frontend and backend
npm run dev

# 4. Open http://127.0.0.1:5173
#    API runs on port 3001, Vite proxies /api automatically
```

The API creates `data/artcrafts.sqlite` and seeds the catalog on first launch.

## Deployment

| Layer | Platform | Config File |
|-------|----------|-------------|
| Frontend (React SPA) | Vercel | `vercel.json` |
| Backend (Node.js API) | Render | `render.yaml` |

**📖 See [`DEPLOYMENT_GUIDE.md`](DEPLOYMENT_GUIDE.md) for full step-by-step deployment instructions.**

### Quick Deploy

1. **Render** (backend): Connect repo → Render auto-detects `render.yaml` → set env vars → deploy
2. **Vercel** (frontend): Import repo → set `VITE_API_URL` to your Render URL → deploy
3. On Render, set `FRONTEND_URL` to your Vercel URL → redeploy

## Features

- 🛍️ Public storefront browsing (no login required)
- 👤 Customer registration/login, saved addresses, order history
- 🎨 Custom order request form with reference image upload
- 🛒 Full checkout with Razorpay (UPI, Cards, Net Banking) + COD
- 📦 Admin dashboard with product/inventory/order/artisan/gallery management
- 🖼️ Image uploads via Supabase Storage (local disk fallback)
- 📧 Email notifications via Resend (order confirmations, enquiries)
- 🔒 Server-side auth with secure session cookies
- 💾 SQLite database with WAL mode and automatic seeding

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
- **Backend**: Node.js 22 (zero dependencies — native HTTP, SQLite, crypto)
- **Database**: SQLite via `node:sqlite` (built-in)
- **Storage**: Supabase Storage / local disk
- **Payments**: Razorpay Standard Checkout
- **Email**: Resend API

## License

This project is licensed under the terms of the [MIT License](LICENSE).
Copyright (c) 2026 Harshavardhan Kancharlapalli (ARTCRAFTS).
