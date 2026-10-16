// server/notifications.mjs – Transactional email via Resend + console logging (zero dependencies)

function env(key) { return (process.env[key] || '').trim(); }

function resendConfigured() {
  return Boolean(env('RESEND_API_KEY'));
}

async function sendEmail({ to, subject, html }) {
  if (!resendConfigured()) return null;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${env('RESEND_API_KEY')}`,
      },
      body: JSON.stringify({
        from: env('NOTIFICATION_FROM_EMAIL') || 'orders@artcrafts.com',
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) console.warn('Resend email error:', data);
    else console.log(`Email sent to ${to}: "${subject}"`);
    return data;
  } catch (err) {
    console.warn('Email dispatch failed:', err.message);
    return null;
  }
}

const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

/**
 * Send order confirmation after payment is verified.
 */
export async function notifyOrderConfirmed(order, customerEmail, customerName) {
  const items = (order.items || []).map(i => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${i.name}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${money(i.unitPrice * i.quantity)}</td></tr>`).join('');

  const receipt = `
  ══════════════════════════════════════════
   ARTCRAFTS — Order Confirmed
  ══════════════════════════════════════════
   Order ID:     ${order.id}
   Payment:      ${order.paymentMethod?.toUpperCase() || 'GATEWAY'}
   Status:       ${order.paymentStatus?.toUpperCase() || 'PAID'}
   Total:        ${money(order.subtotal)}
   Customer:     ${customerName} (${customerEmail})
   Address:      ${order.address?.line1}, ${order.address?.city}, ${order.address?.state}
  ──────────────────────────────────────────
   Items:
${(order.items || []).map(i => `   • ${i.name} × ${i.quantity}  ${money(i.unitPrice * i.quantity)}`).join('\n')}
  ══════════════════════════════════════════`;

  console.log(receipt);

  const html = `
  <div style="max-width:560px;margin:0 auto;font-family:'Helvetica Neue',Arial,sans-serif;color:#29180F">
    <div style="background:#29180F;padding:28px;text-align:center">
      <h1 style="color:#D2B16F;margin:0;font-size:22px;letter-spacing:3px">ARTCRAFTS</h1>
      <p style="color:#c4b29a;margin:6px 0 0;font-size:11px">Crafting Memories, Creating Art</p>
    </div>
    <div style="padding:30px;background:#FAF6EC;border:1px solid #E5D5BB">
      <p style="color:#A8792E;font-size:10px;letter-spacing:2px;margin:0 0 6px">ORDER CONFIRMED</p>
      <h2 style="margin:0 0 18px;font-size:26px;font-family:Georgia,serif">Thank you, ${customerName}!</h2>
      <p style="font-size:13px;color:#827263;line-height:1.7">Your handcrafted piece has been reserved and your order is officially placed.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0">
        <tr style="background:#f3e8d7"><td style="padding:8px;font-weight:600;font-size:11px">ITEM</td><td style="padding:8px;font-weight:600;font-size:11px;text-align:center">QTY</td><td style="padding:8px;font-weight:600;font-size:11px;text-align:right">PRICE</td></tr>
        ${items}
      </table>
      <div style="border-top:2px solid #A8792E;padding-top:14px;display:flex;justify-content:space-between;font-size:16px;font-weight:600">
        <span>Total Paid</span>
        <span style="color:#A8792E">${money(order.subtotal)}</span>
      </div>
      <div style="margin-top:20px;padding:14px;background:#FFFCF6;border:1px solid #E5D5BB;font-size:11px;color:#827263">
        <p style="margin:0 0 4px"><strong>Order ID:</strong> ${order.id}</p>
        ${order.gatewayPaymentId ? `<p style="margin:0 0 4px"><strong>Payment Ref:</strong> ${order.gatewayPaymentId}</p>` : ''}
        <p style="margin:0"><strong>Delivery:</strong> ${order.address?.fullName || customerName}, ${order.address?.city || ''}, ${order.address?.state || ''}</p>
      </div>
    </div>
    <div style="padding:16px;text-align:center;font-size:10px;color:#827263">
      Made with care · ARTCRAFTS
    </div>
  </div>`;

  await sendEmail({ to: customerEmail, subject: `ARTCRAFTS Order Confirmed — ${order.id}`, html });
}

/**
 * Notify studio about a new custom order enquiry.
 */
export async function notifyCustomOrder(request) {
  const receipt = `
  ══════════════════════════════════════════
   ARTCRAFTS — New Custom Order Enquiry
  ══════════════════════════════════════════
   Reference:    ${request.id}
   Customer:     ${request.name} (${request.email})
   Craft Type:   ${request.craft}
   Budget:       ${request.budget || 'Not specified'}
   Needed By:    ${request.requiredBy || 'Flexible'}
   Notes:        ${request.notes || '—'}
  ══════════════════════════════════════════`;
  console.log(receipt);

  const adminEmail = env('ADMIN_EMAIL') || 'admin@artcrafts.com';
  const html = `
  <div style="max-width:500px;margin:0 auto;font-family:Arial,sans-serif;color:#29180F">
    <div style="background:#29180F;padding:20px;text-align:center">
      <h1 style="color:#D2B16F;margin:0;font-size:18px;letter-spacing:3px">ARTCRAFTS STUDIO</h1>
    </div>
    <div style="padding:24px;background:#FAF6EC;border:1px solid #E5D5BB">
      <p style="color:#A8792E;font-size:10px;letter-spacing:2px;margin:0 0 6px">NEW CUSTOM ORDER ENQUIRY</p>
      <h2 style="margin:0 0 14px;font-size:22px;font-family:Georgia,serif">${request.craft}</h2>
      <p style="font-size:12px"><strong>Customer:</strong> ${request.name} · ${request.email}${request.phone ? ` · ${request.phone}` : ''}</p>
      <p style="font-size:12px"><strong>Budget:</strong> ${request.budget || 'Not specified'}</p>
      <p style="font-size:12px"><strong>Design Notes:</strong> ${request.design || 'None'}</p>
      <p style="font-size:12px"><strong>Personalization:</strong> ${request.personalization || 'None'}</p>
      ${request.referenceImageUrl ? `<p style="font-size:12px"><strong>Reference Image:</strong> <a href="${request.referenceImageUrl}" style="color:#A8792E">View Image</a></p>` : ''}
      <p style="font-size:11px;color:#827263;margin-top:14px">Reference: <strong>${request.id}</strong></p>
    </div>
  </div>`;

  await sendEmail({ to: adminEmail, subject: `New Custom Order Enquiry — ${request.id}`, html });
}

/**
 * Notify studio about a new contact message.
 */
export async function notifyContactMessage(message) {
  console.log(`\n── New Contact Message ──\nFrom: ${message.name} (${message.email})\nSubject: ${message.subject || '(none)'}\nMessage: ${message.message}\n────────────────────────`);

  const adminEmail = env('ADMIN_EMAIL') || 'admin@artcrafts.com';
  if (!resendConfigured()) return;
  await sendEmail({
    to: adminEmail,
    subject: `ARTCRAFTS Contact: ${message.subject || 'New message'}`,
    html: `<div style="font-family:Arial,sans-serif;padding:20px"><h2 style="color:#29180F">New Contact Message</h2><p><strong>From:</strong> ${message.name} (${message.email})</p><p><strong>Subject:</strong> ${message.subject || '—'}</p><p>${message.message}</p></div>`,
  });
}
