import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Truck, RotateCcw, FileText, Sparkles, Mail, Heart } from 'lucide-react';

function Eyebrow({ children }) {
  return <span className="eyebrow"><i /> {children}</span>;
}

function PageIntro({ eyebrow, title, copy }) {
  return (
    <section className="page-intro">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1>{title}</h1>
      <p>{copy}</p>
      <span className="intro-spark">✳</span>
    </section>
  );
}

export function PrivacyPolicy() {
  return (
    <>
      <PageIntro
        eyebrow="Trust & Transparency"
        title="Privacy Policy"
        copy="How we safeguard your personal details, order records, and checkout information with gentle care."
      />
      <article className="policy-content">
        <h2>1. Overview & Commitment</h2>
        <p>
          At ARTCRAFTS, we value the trust you place in us when browsing our artisan collections or commissioning custom handmade keepsakes. We are dedicated to maintaining the confidentiality, integrity, and security of your personal data.
        </p>

        <h2>2. Information We Collect</h2>
        <ul>
          <li><b>Account Information:</b> Your name, email address, contact phone number, and encrypted credentials when creating a customer profile.</li>
          <li><b>Delivery Addresses:</b> Recipient names, street addresses, postal codes, and delivery instructions to route your handmade packages accurately.</li>
          <li><b>Order History:</b> Details of handcrafted pieces purchased, custom request specifications, and transactional timestamps.</li>
          <li><b>Customer Enquiries:</b> Messages submitted via our contact desk and reference images uploaded for custom commissions.</li>
        </ul>

        <h2>3. Payment Security & Tokenization</h2>
        <p>
          All online transactions are processed through 256-bit encrypted SSL communication directly with certified payment gateways (such as Razorpay). ARTCRAFTS never stores complete credit card numbers, debit card numbers, CVVs, or bank net banking credentials on our servers.
        </p>

        <h2>4. Cookie & Session Policy</h2>
        <p>
          We use secure, HTTP-only, SameSite session cookies strictly for maintaining your authenticated customer or administrative studio session. We do not use intrusive third-party cross-site advertising trackers or sell customer data to data brokers.
        </p>

        <h2>5. Your Rights</h2>
        <p>
          You have the right to view, modify, or update your saved delivery addresses and account profile at any time through the customer dashboard. For account deletion or comprehensive data requests, please write to us at <b>studio@artcrafts.com</b>.
        </p>

        <div style={{ marginTop: '36px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
          <Link className="text-link" to="/contact">
            Have privacy questions? Contact the Studio <ArrowRight size={15} />
          </Link>
        </div>
      </article>
    </>
  );
}

export function ShippingPolicy() {
  return (
    <>
      <PageIntro
        eyebrow="From Table to Doorstep"
        title="Shipping Policy"
        copy="Handcrafted pieces, packaged with extreme care and shipped securely across India."
      />
      <article className="policy-content">
        <h2>1. Making & Dispatch Timelines</h2>
        <p>
          Every item in our shop is handcrafted. Ready-to-ship items (curated resin pieces, art keepsakes) are dispatched within <b>2 to 4 business days</b>. Made-to-order and personalized pieces require slow curing and finishing, typically dispatching within <b>7 to 10 business days</b>.
        </p>

        <h2>2. Packaging Standards</h2>
        <p>
          Because resin, ceramics, and mixed-media crafts can be delicate, every shipment is wrapped in multiple layers of protective bubble cushion, secured within sturdy corrugated cartons, and sealed with tamper-evident tape.
        </p>

        <h2>3. Delivery Estimates & Couriers</h2>
        <ul>
          <li><b>Metros & Tier 1 Cities:</b> 3 to 5 business days following dispatch.</li>
          <li><b>Rest of India:</b> 5 to 7 business days following dispatch.</li>
          <li><b>Courier Partners:</b> We partner with trusted courier networks including BlueDart, Delhivery, and India Post Speed Post.</li>
        </ul>

        <h2>4. Shipping Rates</h2>
        <p>
          We provide <b>Complimentary Free Shipping</b> on all prepaid domestic orders across India exceeding ₹1,500. Standard shipping for orders under ₹1,500 is calculated at checkout based on weight and destination.
        </p>

        <h2>5. Tracking Your Piece</h2>
        <p>
          Once your package is handed to the courier, tracking information will be updated in your <b>My Orders</b> dashboard, and confirmation will be communicated to your registered email address.
        </p>

        <div style={{ marginTop: '36px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
          <Link className="text-link" to="/orders">
            Track My Orders <ArrowRight size={15} />
          </Link>
        </div>
      </article>
    </>
  );
}

export function ReturnsPolicy() {
  return (
    <>
      <PageIntro
        eyebrow="Our Promise & Care"
        title="Returns & Cancellations"
        copy="Honest guidelines that respect both the customer experience and the nature of handmade work."
      />
      <article className="policy-content">
        <h2>1. The Beauty of the Handmade</h2>
        <p>
          Handcrafted resin, wood, and artisan pieces naturally exhibit subtle organic variations — such as minor micro-bubble patterns, distinct wood grain, or soft tonal resin swirls. These characteristics are hallmarks of authentic handmade artistry, not defects.
        </p>

        <h2>2. Transit Damage & Defect Claims</h2>
        <p>
          If your item arrives broken or damaged during transit, please notify us within <b>48 hours of delivery</b>:
        </p>
        <ul>
          <li>Take clear photographs or an unboxing video showing the outer carton and the damaged piece.</li>
          <li>Send the details along with your Order ID to <b>studio@artcrafts.com</b> or submit a message through our Contact page.</li>
          <li>We will review your claim within 24 business hours and immediately arrange a free replacement or a full refund.</li>
        </ul>

        <h2>3. Custom & Personalized Pieces</h2>
        <p>
          Items customized with personal names, bespoke color combinations, or custom dates cannot be returned or cancelled once fabrication has commenced, unless they arrived damaged in transit.
        </p>

        <h2>4. Cancellation Window</h2>
        <p>
          Standard orders may be cancelled within <b>12 hours of placement</b> for a 100% full refund before packaging and dispatch.
        </p>

        <h2>5. Refund Process</h2>
        <p>
          Approved refunds are processed back to the original source payment method (card, UPI, net banking) within <b>5 to 7 business days</b>.
        </p>

        <div style={{ marginTop: '36px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
          <Link className="text-link" to="/contact">
            Request Return Support <ArrowRight size={15} />
          </Link>
        </div>
      </article>
    </>
  );
}

export function TermsConditions() {
  return (
    <>
      <PageIntro
        eyebrow="Studio Agreement"
        title="Terms & Conditions"
        copy="The terms governing purchases, artisan commissions, and browsing on ARTCRAFTS."
      />
      <article className="policy-content">
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing ARTCRAFTS, creating a customer account, or placing an order, you agree to comply with and be bound by these Terms and Conditions and all applicable Indian consumer laws.
        </p>

        <h2>2. Artisan Intellectual Property</h2>
        <p>
          All artwork designs, photographs, brand identity assets, and written stories published on this website are the proprietary intellectual property of ARTCRAFTS and our affiliated artisans. Unauthorized reproduction, commercial distribution, or copying is strictly prohibited.
        </p>

        <h2>3. Product Availability & Pricing</h2>
        <p>
          All prices are quoted in Indian Rupees (INR) and are inclusive of applicable taxes. Because our collections are small-batch and handcrafted, pieces may sell out quickly. We reserve the right to correct accidental typographical pricing errors and cancel orders affected by them with immediate full refund.
        </p>

        <h2>4. Custom Commissions & Enquiries</h2>
        <p>
          Submitting a custom order enquiry does not constitute a binding purchase contract until our studio confirms feasibility, final price quote, delivery timeframe, and payment is authorized.
        </p>

        <h2>5. Limitation of Liability & Jurisdiction</h2>
        <p>
          ARTCRAFTS is not liable for indirect or consequential damages arising from the use of products purchased. Any legal disputes arising out of purchases from ARTCRAFTS shall be subject to the exclusive jurisdiction of the courts in India.
        </p>

        <div style={{ marginTop: '36px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
          <Link className="text-link" to="/shop">
            Return to Storefront <ArrowRight size={15} />
          </Link>
        </div>
      </article>
    </>
  );
}
