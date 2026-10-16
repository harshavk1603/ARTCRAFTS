# ARTCRAFTS storefront

A responsive React/Vite storefront with a local Node.js API and SQLite database. Guest visitors can browse without an account. Customer accounts are only required to save delivery details, view orders, and check out. Admin routes require a server authenticated administrator account.

## Requirements

- Node.js 22.13 or newer (the API uses the built-in `node:sqlite` module).
- pnpm (or npm; scripts are also defined for npm).

## First-time local setup

1. Install dependencies: `pnpm install`.
2. Copy `.env.example` to `.env`. Set `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` of at least 12 characters before starting. This creates the initial admin account once.
3. Start both frontend and backend: `pnpm dev`.
4. Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The API runs on port 3001 and Vite proxies `/api`.
5. Sign in at `/login` and choose Admin, or visit `/admin/login`. The admin email/password are those in your `.env`. Normal users can register at `/login` or just browse as guests.

The API creates `data/artcrafts.sqlite` and seeds the catalog on first launch. Keep `.env` and the SQLite database private and backed up. To reset the local app completely, stop the servers and remove the SQLite database and its `-shm` / `-wal` files; this permanently removes local accounts, orders, and edits.

## Payment setup

Checkout is integrated with Razorpay Standard Checkout, but it is disabled until the owner supplies Razorpay test credentials. Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` from a Razorpay test account to `.env`, then restart `pnpm dev`. Use only test-mode keys for local testing. Set `RAZORPAY_WEBHOOK_SECRET` and configure the webhook URL when testing asynchronous payment events. The server creates the order and verifies the checkout signature; never place the secret in frontend code. Payment gateway account approval, real settlement, shipping/tax rules, refunds, notifications, and legal/business policy remain owner setup items.

## Useful commands

- `pnpm dev`: starts API and Vite together.
- `pnpm dev:api`: API only on port 3001.
- `pnpm dev:frontend`: Vite only on port 5173; run API separately.
- `pnpm build`: production frontend build.

## Features

- Public storefront browsing with no login requirement.
- Customer registration/login, saved profile and multiple delivery addresses, and customer order history.
- Admin login enforced on the server, with product editing, inventory adjustment, orders/enquiries, and local persistence.
- Razorpay order creation, stock reservation/expiry, server-side signature verification, and optional webhook handling.
- Contact and custom-order forms saved to SQLite for admin review. Reference image selection is currently not uploaded or stored.

## Production readiness

This is a local development backend, not a production deployment. Before handling real customers, deploy behind HTTPS, use a production-grade managed database and backups, configure persistent rate limiting, trusted proxy/cookie settings, email notifications, image storage, monitoring, data retention and privacy policies, shipping/tax/refund workflows, and review the application's legal copy. Node's built-in SQLite module is marked active development in current Node documentation; SQLite is suitable for local/single-instance use here, not a multi-instance production store.

Photographs are remote Unsplash samples and artisan/catalog content remains demonstration copy. Replace these with approved business content before launch.

## License

This project is licensed under the terms of the [MIT License](LICENSE).
Copyright (c) 2026 Harshavardhan Kancharlapalli (ARTCRAFTS).
