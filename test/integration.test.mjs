// test/integration.test.mjs — Automated End-to-End Verification Test
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const TEST_PORT = 3098;
const BASE = `http://127.0.0.1:${TEST_PORT}`;

let serverProcess;
let failures = 0;
let passed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failures++;
  }
}

async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options.body && typeof options.body === 'object' && !(options.body instanceof FormData)
        ? { 'content-type': 'application/json' }
        : {}),
      ...options.headers,
    },
    body:
      options.body && typeof options.body === 'object' && !(options.body instanceof FormData)
        ? JSON.stringify(options.body)
        : options.body,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, headers: res.headers, text, json };
}

async function startServer() {
  return new Promise((resolvePromise, rejectPromise) => {
    serverProcess = spawn(process.execPath, ['server/index.mjs'], {
      cwd: root,
      env: {
        ...process.env,
        API_PORT: String(TEST_PORT),
        NODE_ENV: 'test',
        ADMIN_EMAIL: 'admin@artcrafts.com',
        ADMIN_PASSWORD: 'ArtCraftsAdmin@2026!',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    serverProcess.stdout.on('data', (d) => {
      const msg = d.toString();
      if (msg.includes('ARTCRAFTS API listening')) {
        resolvePromise();
      }
    });

    serverProcess.stderr.on('data', (d) => {
      // console.error('[server err]', d.toString());
    });

    serverProcess.on('error', rejectPromise);
    setTimeout(() => resolvePromise(), 2500);
  });
}

async function runTests() {
  console.log('\n🚀 Starting ARTCRAFTS Automated Integration Test Suite...\n');
  await startServer();
  console.log(`✓ Test Server started on port ${TEST_PORT}\n`);

  try {
    // ── 1. Health Endpoint ──────────────────────────────────────────
    console.log('1. Health & Status Checks:');
    const health = await request('/api/health');
    assert(health.status === 200, 'GET /api/health returns 200 OK');
    assert(health.json?.status === 'ok', 'health status is "ok"');
    assert(health.json?.database === 'ok', 'database status is "ok"');

    // ── 2. Payment Config ───────────────────────────────────────────
    console.log('\n2. Payment Configuration:');
    const payConfig = await request('/api/payments/config');
    assert(payConfig.status === 200, 'GET /api/payments/config returns 200');
    assert(payConfig.json?.enabled === true, 'payments are enabled');
    assert(Array.isArray(payConfig.json?.gateways), 'returns gateways list');

    // ── 3. Public Storefront ────────────────────────────────────────
    console.log('\n3. Storefront Catalog:');
    const prods = await request('/api/storefront/products');
    assert(prods.status === 200, 'GET /api/storefront/products returns 200');
    assert(Array.isArray(prods.json?.products) && prods.json.products.length > 0, 'products are seeded');
    const firstProduct = prods.json.products.find(p => p.stock > 0);
    const initialStock = firstProduct.stock;
    assert(initialStock > 0, `purchasable product (${firstProduct.name}) has stock: ${initialStock}`);

    const cats = await request('/api/storefront/categories');
    assert(cats.status === 200, 'GET /api/storefront/categories returns 200');
    assert(Array.isArray(cats.json?.categories) && cats.json.categories.length > 0, 'categories are seeded');

    const artisans = await request('/api/storefront/artisans');
    assert(artisans.status === 200, 'GET /api/storefront/artisans returns 200');
    assert(Array.isArray(artisans.json?.artisans) && artisans.json.artisans.length > 0, 'artisans are seeded');

    const gallery = await request('/api/gallery');
    assert(gallery.status === 200, 'GET /api/gallery returns 200');
    assert(Array.isArray(gallery.json?.gallery), 'gallery items returned');

    // ── 4. Customer Authentication & Profile ─────────────────────────
    console.log('\n4. Customer Lifecycle & Addresses:');
    const testCustomerEmail = `customer_${Date.now()}@example.com`;
    const reg = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Tara Sharma',
        email: testCustomerEmail,
        password: 'Password123!',
        phone: '+91 98765 43210',
      },
    });
    assert(reg.status === 201, 'POST /api/auth/register returns 201 Created');
    const cookieHeader = reg.headers.get('set-cookie');
    assert(Boolean(cookieHeader && cookieHeader.includes('artcrafts_session')), 'Session cookie was issued');
    assert(Boolean(reg.json?.token), 'Session token returned in registration JSON payload');
    const authHeaders = { cookie: cookieHeader };

    const profile = await request('/api/profile', { headers: authHeaders });
    assert(profile.status === 200, 'GET /api/profile returns 200 with session');
    assert(profile.json?.user?.email === testCustomerEmail, 'profile email matches registered user');

    const bearerProfile = await request('/api/profile', { headers: { authorization: `Bearer ${reg.json.token}` } });
    assert(bearerProfile.status === 200, 'GET /api/profile works via Authorization: Bearer token header');

    const addr = await request('/api/profile/addresses', {
      method: 'POST',
      headers: authHeaders,
      body: {
        fullName: 'Tara Sharma',
        phone: '+91 98765 43210',
        line1: '12 Art Lane, Bandra West',
        line2: 'Apt 4B',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400050',
        country: 'India',
        isDefault: true,
      },
    });
    assert(addr.status === 201, 'POST /api/profile/addresses saves new delivery address');
    const addressId = addr.json?.address?.id;
    assert(Boolean(addressId), 'Address ID generated');

    // ── 5. Instant Multi-Rail Checkout & Stock Decrement ────────────
    console.log('\n5. Checkout & Inventory Reservation:');
    const orderRes = await request('/api/checkout/pay', {
      method: 'POST',
      headers: authHeaders,
      body: {
        addressId,
        paymentMethod: 'card',
        items: [{ productId: firstProduct.id, quantity: 1 }],
      },
    });
    assert(orderRes.status === 201, 'POST /api/checkout/pay completes successfully');
    assert(orderRes.json?.success === true, 'payment is marked success');
    assert(orderRes.json?.order?.status === 'Paid', 'order status is "Paid"');

    // Verify stock decreased
    const prodsAfter = await request('/api/storefront/products');
    const updatedProd = prodsAfter.json.products.find(p => p.id === firstProduct.id);
    assert(updatedProd.stock === initialStock - 1, `stock decreased by 1: from ${initialStock} to ${updatedProd.stock}`);

    // Verify order listed in customer orders
    const ordersList = await request('/api/orders', { headers: authHeaders });
    assert(ordersList.status === 200, 'GET /api/orders returns customer orders');
    assert(ordersList.json?.orders?.length > 0, 'new order is present in customer history');

    // ── 5b. Production Security: Simulated Payments Locked Down in Production
    console.log('\n5b. Production Security Guard for Payments:');
    const prodServer = await new Promise((resP) => {
      const p = spawn(process.execPath, ['server/index.mjs'], {
        cwd: root,
        env: {
          ...process.env,
          API_PORT: String(TEST_PORT + 1),
          NODE_ENV: 'production',
          ADMIN_EMAIL: 'admin@artcrafts.com',
          ADMIN_PASSWORD: 'ArtCraftsAdmin@2026!',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      p.stdout.on('data', (d) => {
        if (d.toString().includes('ARTCRAFTS API listening')) resP(p);
      });
      setTimeout(() => resP(p), 1500);
    });

    try {
      const prodPayConfig = await fetch(`http://127.0.0.1:${TEST_PORT + 1}/api/payments/config`).then(r => r.json());
      assert(prodPayConfig.allowDevSimulation === false, 'Production payments config disables dev simulation');

      const prodSimPay = await fetch(`http://127.0.0.1:${TEST_PORT + 1}/api/checkout/pay`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: cookieHeader,
        },
        body: JSON.stringify({
          addressId,
          paymentMethod: 'card',
          items: [{ productId: firstProduct.id, quantity: 1 }],
        }),
      });
      assert(prodSimPay.status === 403, 'POST /api/checkout/pay rejects unverified simulated card with 403 Forbidden in production');

      const codProduct = prods.json.products.find(p => p.id !== firstProduct.id && p.stock > 0) || prods.json.products[1];
      const prodCodPay = await fetch(`http://127.0.0.1:${TEST_PORT + 1}/api/checkout/pay`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: cookieHeader,
        },
        body: JSON.stringify({
          addressId,
          paymentMethod: 'cod',
          items: [{ productId: codProduct.id, quantity: 1 }],
        }),
      });
      assert(prodCodPay.status === 201, 'POST /api/checkout/pay allows Cash on Delivery (COD) in production');
    } finally {
      prodServer.kill('SIGTERM');
    }

    // ── 6. Custom Order Enquiry with Reference Image ────────────────
    console.log('\n6. Custom Order Enquiries:');
    const customReq = await request('/api/custom-orders', {
      method: 'POST',
      body: {
        name: 'Aarav Patel',
        email: 'aarav@example.com',
        phone: '+91 91234 56789',
        craft: 'Ocean Wave Resin Tray',
        budget: '₹2,500',
        referenceImageUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800',
        notes: 'Would love deep sapphire blue with metallic gold dust.',
      },
    });
    assert(customReq.status === 201, 'POST /api/custom-orders records enquiry');
    assert(Boolean(customReq.json?.reference), `reference generated: ${customReq.json?.reference}`);

    // ── 7. Admin Authentication & Studio Capabilities ───────────────
    console.log('\n7. Admin Studio & Privileged Actions:');
    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: {
        email: 'admin@artcrafts.com',
        password: 'ArtCraftsAdmin@2026!',
        role: 'admin',
      },
    });
    assert(adminLogin.status === 200, 'POST /api/auth/login succeeds for administrator');
    const adminCookie = adminLogin.headers.get('set-cookie');
    const adminHeaders = { cookie: adminCookie };

    const dashboard = await request('/api/admin/dashboard', { headers: adminHeaders });
    assert(dashboard.status === 200, 'GET /api/admin/dashboard returns studio metrics');
    assert(typeof dashboard.json?.metrics?.products === 'number', 'metrics contains products count');

    const adminOrders = await request('/api/admin/orders', { headers: adminHeaders });
    assert(adminOrders.status === 200, 'GET /api/admin/orders returns combined orders & enquiries');
    const foundCustom = adminOrders.json.records.find(r => r.type === 'Custom request');
    assert(Boolean(foundCustom), 'custom enquiry is visible in admin ledger');
    assert(Boolean(foundCustom?.referenceImageUrl), 'reference image URL is attached to custom enquiry');

    // ── 8. Dynamic Gallery CRUD ─────────────────────────────────────
    console.log('\n8. Dynamic Gallery CRUD:');
    const newGalleryItem = await request('/api/admin/gallery', {
      method: 'POST',
      headers: adminHeaders,
      body: {
        title: 'Amber Sunrise Coaster Set',
        category: 'Resin Art',
        imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800',
        artisanName: 'Kavita Roy',
        description: 'Honey tones suspended in clear epoxy with crushed quartz.',
        featured: true,
      },
    });
    assert(newGalleryItem.status === 201, 'POST /api/admin/gallery creates new gallery item');
    const galleryItemId = newGalleryItem.json?.item?.id;

    const publicGalleryAfter = await request('/api/gallery');
    const foundInPublic = publicGalleryAfter.json.gallery.find(g => g.id === galleryItemId);
    assert(Boolean(foundInPublic), 'new gallery item is immediately live on public gallery');

    // Delete gallery item
    const delGallery = await request(`/api/admin/gallery/${galleryItemId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    assert(delGallery.status === 200, 'DELETE /api/admin/gallery/:id removes item');

    // ── 9. Database Backup ──────────────────────────────────────────
    console.log('\n9. Database Backup & Disaster Recovery:');
    const backup = await request('/api/admin/backup', {
      method: 'POST',
      headers: adminHeaders,
    });
    assert(backup.status === 200, 'POST /api/admin/backup exports complete JSON snapshot');
    assert(Boolean(backup.json?.location), `backup location generated: ${backup.json?.location}`);
    assert(Boolean(backup.json?.filename), `backup filename: ${backup.json?.filename}`);
    assert(!backup.json?.location.startsWith('uploads/'), 'backup is NOT stored inside public uploads/');

    // Test direct streaming download
    const backupDownload = await request('/api/admin/backup?download=1', {
      method: 'POST',
      headers: adminHeaders,
    });
    assert(backupDownload.status === 200, 'POST /api/admin/backup?download=1 streams attachment directly');
    const disp = backupDownload.headers.get('content-disposition') || '';
    assert(disp.includes('attachment') && disp.includes('.json'), 'Content-Disposition header includes attachment filename');

    // Test explicit 403 Forbidden for public /uploads/backups/* requests
    const blockedUploadBackup = await request('/uploads/backups/artcrafts-backup-test.json');
    assert(blockedUploadBackup.status === 403, 'GET /uploads/backups/* is explicitly blocked with 403 Forbidden');

    // ── 10. Static File Serving & SPA Fallback ──────────────────────
    console.log('\n10. Static File Serving & SPA Fallback:');
    const spaHome = await request('/');
    assert(spaHome.status === 200, 'GET / serves Vite index.html');
    assert(spaHome.text.includes('<html') || spaHome.text.includes('<!DOCTYPE') || spaHome.text.includes('ARTCRAFTS'), 'contains HTML document');

    const spaDeepLink = await request('/shop');
    assert(spaDeepLink.status === 200, 'GET /shop (deep link) falls back to index.html for SPA router');

  } catch (err) {
    console.error('Unexpected test error:', err);
    failures++;
  } finally {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  }

  console.log(`\n══════════════════════════════════════════`);
  console.log(` Test Results: ${passed} Passed, ${failures} Failed`);
  console.log(`══════════════════════════════════════════\n`);

  if (failures > 0) process.exit(1);
}

runTests();
