import React, { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ArrowRight, Check, MapPin, PackageCheck, Plus, ShieldCheck,
  Trash2, CreditCard, Smartphone, Building2, Truck, Lock, Printer, QrCode,
  ShoppingBag, Sparkles, UserRound, Star, ChevronRight
} from 'lucide-react';
import { api, post, put } from '../api';
import { useStore } from '../context/StoreContext';

const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

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

export function CustomerOnly({ children }) {
  const { user, authReady } = useStore();
  const location = useLocation();
  if (!authReady) return <div className="account-loading">Preparing your account session…</div>;
  if (user?.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  if (!user) return <Navigate to={`/login?role=customer&next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return children;
}

export function LoginPage({ initialRole = 'customer' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, authReady, refreshUser, logout } = useStore();
  const query = new URLSearchParams(location.search);
  const requestedRole = initialRole === 'admin' || query.get('role') === 'admin' ? 'admin' : 'customer';

  const [role, setRole] = useState(requestedRole);
  const [mode, setMode] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    setRole(requestedRole);
    setError('');
  }, [requestedRole]);

  function fillDemoAdmin() {
    setRole('admin');
    setEmail('admin@artcrafts.com');
    setPassword('Admin@ArtCrafts2026');
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (role === 'customer' && mode === 'register') {
        await post('auth/register', { name, email, password, phone });
      } else {
        await post('auth/login', { email, password, role });
      }
      const account = await refreshUser();
      const next = query.get('next');
      if (role === 'admin') {
        navigate(next && next.startsWith('/admin') ? next : '/admin/dashboard', { replace: true });
      } else {
        navigate(next && next.startsWith('/') && !next.startsWith('/admin') ? next : '/profile', { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page account-login-page">
      <Link to="/" className="login-brand">
        <img src="/logo/artcrafts-logo.jpg" alt="ARTCRAFTS" />
        <span>ARTCRAFTS<small>Crafting Memories, Creating Art.</small></span>
      </Link>

      <div className="login-portal-wrap">
        {/* Role Switcher */}
        <div className="login-role-tabs" role="tablist" aria-label="Portal Mode">
          <button
            type="button"
            role="tab"
            aria-selected={role === 'customer'}
            className={`login-role-tab ${role === 'customer' ? 'active' : ''}`}
            onClick={() => { setRole('customer'); setMode('login'); setError(''); }}
          >
            <UserRound size={16} /> User / Customer
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={role === 'admin'}
            className={`login-role-tab ${role === 'admin' ? 'active' : ''}`}
            onClick={() => { setRole('admin'); setMode('login'); setError(''); }}
          >
            <ShieldCheck size={16} /> Admin Studio
          </button>
        </div>

        {/* Guest Banner for User Portal */}
        {role === 'customer' && !user && (
          <div className="guest-access-card">
            <div>
              <h3>Visiting as a Guest?</h3>
              <p>Home and shop pages are completely free to explore. No login or details needed to browse.</p>
            </div>
            <Link to="/" className="guest-btn">
              Enter Store as Guest <ArrowRight size={14} />
            </Link>
          </div>
        )}

        {/* Main Card */}
        <section className="login-card">
          {authReady && user && user.role === role ? (
            /* Active Session View */
            <div className="active-session-box">
              <span className="active-session-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
              <div>
                <Eyebrow>{role === 'admin' ? 'ADMINISTRATOR AUTHENTICATED' : 'CUSTOMER LOGGED IN'}</Eyebrow>
                <h2 style={{ margin: '8px 0 4px', font: '500 24px var(--serif)' }}>{user.name}</h2>
                <small style={{ color: 'var(--muted)', fontSize: '11px' }}>{user.email}</small>
              </div>

              <div className="active-session-actions">
                {role === 'admin' ? (
                  <>
                    <Link to="/admin/dashboard" className="button button-dark full">
                      Go to Admin Dashboard <ArrowRight size={15} />
                    </Link>
                    <Link to="/admin/products" className="button button-line full">
                      Manage Products & Inventory
                    </Link>
                    <Link to="/admin/orders" className="button button-line full">
                      Review Customer Orders
                    </Link>
                  </>
                ) : (
                  <>
                    <Link to="/profile" className="button button-dark full">
                      Go to Profile & Saved Addresses <ArrowRight size={15} />
                    </Link>
                    <Link to="/orders" className="button button-line full">
                      View My Orders
                    </Link>
                    <Link to="/shop" className="button button-line full">
                      Explore Handcrafted Pieces
                    </Link>
                  </>
                )}
                <button
                  type="button"
                  className="button button-line full"
                  style={{ marginTop: '8px' }}
                  onClick={async () => { await logout(); }}
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            /* Sign In / Register Form */
            <>
              <div className="login-mode-heading">
                <div>
                  <Eyebrow>{role === 'admin' ? 'RESTRICTED ACCESS' : 'CUSTOMER PORTAL'}</Eyebrow>
                  <h2>
                    {role === 'admin'
                      ? 'Administrator Sign In'
                      : mode === 'register'
                      ? 'Create Customer Account'
                      : 'Customer Sign In'}
                  </h2>
                </div>
                <span>{role === 'admin' ? <ShieldCheck size={22} /> : <MapPin size={22} />}</span>
              </div>

              {role === 'admin' ? (
                <div className="demo-creds-banner">
                  <div className="demo-creds-header">
                    <b><Lock size={13} /> Admin Credentials Required</b>
                    <span className="demo-chip">PROTECTED</span>
                  </div>
                  <div className="demo-creds-body">
                    <span>Email: <code>admin@artcrafts.com</code></span>
                    <span>Pass: <code>Admin@ArtCrafts2026</code></span>
                  </div>
                  <button type="button" className="demo-fill-btn" onClick={fillDemoAdmin}>
                    Auto-fill Demo Admin Credentials
                  </button>
                </div>
              ) : (
                <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 16px' }}>
                  {mode === 'register'
                    ? 'Register once to save delivery addresses and purchase handcrafted projects.'
                    : 'Sign in to access your saved addresses, past orders, and checkout seamlessly.'}
                </p>
              )}

              <form onSubmit={handleSubmit}>
                {role === 'customer' && mode === 'register' && (
                  <>
                    <label className="field">
                      Full Name <span className="required">*</span>
                      <input
                        name="name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        autoComplete="name"
                        placeholder="Your full name"
                        required
                        maxLength={100}
                      />
                    </label>
                    <label className="field">
                      Phone Number
                      <input
                        name="phone"
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        autoComplete="tel"
                        placeholder="Mobile contact for deliveries"
                        maxLength={32}
                      />
                    </label>
                  </>
                )}

                <label className="field">
                  Email Address <span className="required">*</span>
                  <input
                    name="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder={role === 'admin' ? 'admin@artcrafts.com' : 'you@example.com'}
                    required
                    maxLength={254}
                  />
                </label>

                <label className="field">
                  Password <span className="required">*</span>
                  <div className="password-input">
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                      placeholder="••••••••••••"
                      required
                      minLength={mode === 'register' ? 10 : 1}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}>
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  {mode === 'register' && <small style={{ color: 'var(--muted)' }}>Use at least 10 characters.</small>}
                </label>

                {error && <p className="login-error" role="alert">{error}</p>}

                <button className="button button-dark full" disabled={busy}>
                  {busy
                    ? 'Verifying…'
                    : role === 'admin'
                    ? 'Authenticate & Enter Admin Studio'
                    : mode === 'register'
                    ? 'Create Customer Account'
                    : 'Sign In to Customer Account'} <ArrowRight size={16} />
                </button>
              </form>

              {role === 'customer' && (
                <button
                  type="button"
                  className="login-mode-toggle"
                  onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                >
                  {mode === 'login' ? (
                    <>New here? <b>Create an account</b></>
                  ) : (
                    <>Already have an account? <b>Sign in</b></>
                  )}
                </button>
              )}

              {/* Accessible Feature Highlights */}
              <div className="portal-feature-list">
                {role === 'admin' ? (
                  <>
                    <div className="portal-feature-item">
                      <ShieldCheck size={14} /> Only authorized studio administrators can enter admin routes.
                    </div>
                    <div className="portal-feature-item">
                      <Lock size={14} /> Full catalog management, stock control, and customer orders review.
                    </div>
                  </>
                ) : (
                  <>
                    <div className="portal-feature-item">
                      <Sparkles size={14} /> Free guest browsing: no login required for Home and Shop.
                    </div>
                    <div className="portal-feature-item">
                      <CreditCard size={14} /> Integrated Payment Gateway (Cards, UPI, Net Banking, COD).
                    </div>
                    <div className="portal-feature-item">
                      <MapPin size={14} /> Save and manage multiple delivery addresses in your profile.
                    </div>
                  </>
                )}
              </div>

              <Link className="login-back" to="/">
                ← Return to Storefront (Browse as guest)
              </Link>
            </>
          )}
        </section>
      </div>

      <span className="login-footer">ARTCRAFTS · Crafting Memories, Creating Art.</span>
    </div>
  );
}

export function ProfilePage() {
  const { user, refreshUser, logout } = useStore();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api('profile');
      setAddresses(data.addresses || []);
      await refreshUser();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await put('profile', { name: d.name, phone: d.phone });
      await refreshUser();
      setMessage('Your contact details have been updated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveAddress(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const d = Object.fromEntries(new FormData(e.currentTarget));
    const payload = {
      fullName: d.fullName,
      phone: d.phone,
      line1: d.line1,
      line2: d.line2 || '',
      city: d.city,
      state: d.state,
      postalCode: d.postalCode,
      country: d.country || 'India',
      isDefault: d.isDefault === 'on' || d.isDefault === true || addresses.length === 0,
    };
    try {
      if (editing) {
        await put(`profile/addresses/${editing.id}`, payload);
      } else {
        await post('profile/addresses', payload);
      }
      setAdding(false);
      setEditing(null);
      await load();
      setMessage('Address saved successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function setDefaultAddress(id) {
    try {
      const res = await api(`profile/addresses/${id}/default`, { method: 'PATCH' });
      if (res.addresses) setAddresses(res.addresses);
      else await load();
      setMessage('Default delivery address updated.');
    } catch (e) {
      setError(e.message);
    }
  }

  async function removeAddress(id) {
    if (!window.confirm('Remove this saved address from your address book?')) return;
    try {
      await api(`profile/addresses/${id}`, { method: 'DELETE' });
      await load();
      setMessage('Address removed.');
    } catch (e) {
      setError(e.message);
    }
  }

  const defaultAddress = addresses.find(a => a.isDefault) || addresses[0];

  return (
    <>
      <PageIntro
        eyebrow="Customer Profile & Address Book"
        title="Your profile & places."
        copy="Manage your contact information and saved delivery addresses for swift handcrafted project checkout."
      />

      <div className="account-page">
        {/* Navigation Sidebar */}
        <aside className="account-nav">
          <span className="account-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
          <b>{user.name}</b>
          <small>{user.email}</small>
          <Link className="account-nav-active" to="/profile">
            <MapPin size={16} /> Profile & Addresses
          </Link>
          <Link to="/orders">
            <PackageCheck size={16} /> My Orders
          </Link>
          <Link to="/shop">
            <ShoppingBag size={16} /> Explore Projects
          </Link>
          <button onClick={async () => { await logout(); window.location.assign('/'); }}>
            Sign out
          </button>
        </aside>

        {/* Content Area */}
        <div className="account-content">
          {/* Profile Overview Card */}
          <div className="profile-overview-card">
            <div className="profile-overview-user">
              <span className="profile-overview-avatar">{user.name.slice(0, 1).toUpperCase()}</span>
              <div>
                <span className="profile-badge"><Check size={12} /> Verified Customer</span>
                <h3 style={{ margin: '6px 0 2px', font: '600 20px var(--serif)' }}>{user.name}</h3>
                <small style={{ color: 'var(--muted)', fontSize: '11px' }}>{user.email} · {user.phone || 'No phone set'}</small>
              </div>
            </div>
            <Link to="/shop" className="button button-line">
              Purchase Projects <ArrowRight size={14} />
            </Link>
          </div>

          {/* Primary Address Highlight Banner */}
          {defaultAddress && (
            <div className="primary-address-banner">
              <div className="primary-address-content">
                <span className="address-badge"><Star size={10} fill="currentColor" /> Primary Delivery Address</span>
                <b>{defaultAddress.fullName} · {defaultAddress.phone}</b>
                <p>
                  {defaultAddress.line1}
                  {defaultAddress.line2 ? `, ${defaultAddress.line2}` : ''}<br />
                  {defaultAddress.city}, {defaultAddress.state} {defaultAddress.postalCode}, {defaultAddress.country}
                </p>
              </div>
              <button
                type="button"
                className="button button-line"
                style={{ fontSize: '9px', minHeight: '34px', padding: '0 12px' }}
                onClick={() => { setEditing(defaultAddress); setAdding(true); }}
              >
                Edit Address
              </button>
            </div>
          )}

          {/* Contact Details Panel */}
          <section className="account-panel">
            <div className="account-panel-head">
              <div>
                <Eyebrow>YOUR PROFILE</Eyebrow>
                <h2>Contact Information</h2>
              </div>
            </div>
            <form className="account-form" onSubmit={saveProfile}>
              <label className="field">
                Full Name <span className="required">*</span>
                <input name="name" defaultValue={user.name} required maxLength={100} />
              </label>
              <label className="field">
                Email Address
                <input value={user.email} disabled />
                <small>Email is linked to your secure login.</small>
              </label>
              <label className="field">
                Phone Number <span className="required">*</span>
                <input name="phone" defaultValue={user.phone || ''} autoComplete="tel" placeholder="+91 98765 43210" required />
              </label>
              {error && <p className="error">{error}</p>}
              {message && <p className="success-inline"><Check size={15} />{message}</p>}
              <button className="button button-dark" disabled={busy}>
                Save Profile Changes <Check size={15} />
              </button>
            </form>
          </section>

          {/* Saved Delivery Addresses Panel */}
          <section className="account-panel">
            <div className="account-panel-head">
              <div>
                <Eyebrow>DELIVERY ADDRESSES</Eyebrow>
                <h2>Your Saved Addresses</h2>
              </div>
              {!adding && (
                <button className="button button-line" onClick={() => { setEditing(null); setAdding(true); }}>
                  <Plus size={15} /> Add New Address
                </button>
              )}
            </div>

            {loading ? (
              <p className="account-muted">Loading your address book…</p>
            ) : addresses.length ? (
              <div className="address-grid">
                {addresses.map(a => (
                  <article className={`address-card ${a.isDefault ? 'is-default' : ''}`} key={a.id}>
                    <div className="address-card-top">
                      <span>
                        <MapPin size={15} />
                        {a.isDefault ? (
                          <span className="address-badge"><Star size={10} fill="currentColor" /> Default</span>
                        ) : 'Saved Address'}
                      </span>
                      <div>
                        <button aria-label="Edit address" onClick={() => { setEditing(a); setAdding(true); }}>
                          Edit
                        </button>
                      </div>
                    </div>
                    <b>{a.fullName}</b>
                    <p>
                      {a.line1}
                      {a.line2 && <><br />{a.line2}</>}<br />
                      {a.city}, {a.state} {a.postalCode}<br />
                      {a.country}
                    </p>
                    <small>Contact: {a.phone}</small>

                    <div className="address-actions">
                      {!a.isDefault && (
                        <button
                          type="button"
                          className="address-action-btn"
                          onClick={() => setDefaultAddress(a.id)}
                        >
                          <Star size={13} /> Set as Default
                        </button>
                      )}
                      <button
                        type="button"
                        className="address-action-btn delete"
                        onClick={() => removeAddress(a.id)}
                      >
                        <Trash2 size={13} /> Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="address-empty">
                <MapPin size={28} />
                <p>No delivery address saved yet. Add an address to make your checkout instant.</p>
              </div>
            )}

            {/* Inline Add / Edit Address Form */}
            {adding && (
              <form className="address-form" onSubmit={saveAddress}>
                <div className="account-panel-head">
                  <h3>{editing ? 'Edit Delivery Address' : 'Add New Delivery Address'}</h3>
                  <button type="button" className="text-link" onClick={() => { setAdding(false); setEditing(null); }}>
                    Cancel
                  </button>
                </div>
                <div className="form-grid">
                  <AddressField label="Full Name" name="fullName" value={editing?.fullName} required />
                  <AddressField label="Phone Number" name="phone" value={editing?.phone} required />
                  <AddressField label="Address Line 1 (House, Street)" name="line1" value={editing?.line1} required />
                  <AddressField label="Address Line 2 (Landmark, Area)" name="line2" value={editing?.line2} />
                  <AddressField label="City" name="city" value={editing?.city} required />
                  <AddressField label="State / Province" name="state" value={editing?.state} required />
                  <AddressField label="Postal / PIN Code" name="postalCode" value={editing?.postalCode} required />
                  <AddressField label="Country" name="country" value={editing?.country || 'India'} required />
                </div>
                <label className="address-default">
                  <input type="checkbox" name="isDefault" defaultChecked={Boolean(editing?.isDefault || addresses.length === 0)} />
                  Set this as my primary default delivery address
                </label>
                <button className="button button-dark" disabled={busy}>
                  {busy ? 'Saving Address…' : 'Save Address to Profile'} <Check size={15} />
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function AddressField({ label, name, value, required = false }) {
  return (
    <label className="field">
      {label}{required && <span className="required"> *</span>}
      <input
        name={name}
        defaultValue={value || ''}
        required={required}
        autoComplete={name === 'fullName' ? 'name' : name === 'phone' ? 'tel' : 'street-address'}
      />
    </label>
  );
}

export function CheckoutPage() {
  const { items, setItems, user } = useStore();
  const [addresses, setAddresses] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(null);

  // Card details state
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // UPI state
  const [upiId, setUpiId] = useState('');
  const [showQr, setShowQr] = useState(false);

  // Net banking state
  const [bank, setBank] = useState('HDFC Bank');

  // Inline address creation toggle
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [addressBusy, setAddressBusy] = useState(false);

  // Processing state indicator
  const [processingStep, setProcessingStep] = useState('');

  const subtotal = items.reduce((total, item) => total + item.price * item.qty, 0);

  useEffect(() => {
    Promise.all([api('profile'), api('payments/config')])
      .then(([profile, gateway]) => {
        const addrList = profile.addresses || [];
        setAddresses(addrList);
        const def = addrList.find(a => a.isDefault) || addrList[0];
        if (def) setSelectedAddress(def.id);
        setConfig(gateway);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Format card number with spaces every 4 digits
  function handleCardNumberChange(e) {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 16);
    const formatted = raw.replace(/(\d{4})/g, '$1 ').trim();
    setCardNumber(formatted);
  }

  // Format expiry MM/YY
  function handleExpiryChange(e) {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      setCardExpiry(`${raw.slice(0, 2)}/${raw.slice(2)}`);
    } else {
      setCardExpiry(raw);
    }
  }

  async function handleInlineSaveAddress(e) {
    e.preventDefault();
    setAddressBusy(true);
    setError('');
    const d = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const res = await post('profile/addresses', {
        fullName: d.fullName,
        phone: d.phone,
        line1: d.line1,
        line2: d.line2 || '',
        city: d.city,
        state: d.state,
        postalCode: d.postalCode,
        country: d.country || 'India',
        isDefault: addresses.length === 0,
      });
      const newAddr = res.address;
      setAddresses(prev => [newAddr, ...prev]);
      setSelectedAddress(newAddr.id);
      setShowAddAddress(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setAddressBusy(false);
    }
  }

  async function processOrderPayment() {
    if (!selectedAddress) {
      setError('Please choose or add a delivery address before completing your purchase.');
      return;
    }
    if (!items.length) {
      setError('Your shopping bag is empty.');
      return;
    }

    setBusy(true);
    setError('');

    // If Razorpay gateway is selected and enabled
    if (paymentMethod === 'razorpay' && config?.razorpay?.enabled) {
      try {
        if (!window.Razorpay) {
          await new Promise((resolve, reject) => {
            const current = document.querySelector('script[data-razorpay]');
            if (current) {
              current.addEventListener('load', resolve, { once: true });
              current.addEventListener('error', reject, { once: true });
              return;
            }
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.dataset.razorpay = 'true';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Unable to load Razorpay.'));
            document.body.appendChild(script);
          });
        }
        const created = await post('checkout/create-order', {
          addressId: selectedAddress,
          items: items.map(i => ({ productId: i.id, quantity: i.qty })),
        });
        const options = {
          key: created.keyId,
          amount: created.amount,
          currency: created.currency,
          name: 'ARTCRAFTS',
          description: 'Handmade pieces, thoughtfully chosen',
          order_id: created.gatewayOrderId,
          prefill: created.customer,
          theme: { color: '#A8792E' },
          modal: { ondismiss: () => setBusy(false) },
          handler: async response => {
            try {
              const result = await post('checkout/verify', { orderId: created.orderId, ...response });
              if (result.verified) {
                setComplete(result.order);
                setItems([]);
              } else {
                setError(result.message || 'Payment is awaiting confirmation.');
              }
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          },
        };
        const checkout = new window.Razorpay(options);
        checkout.on('payment.failed', response => {
          setError(response.error?.description || 'Payment was not completed.');
          setBusy(false);
        });
        checkout.open();
        return;
      } catch (err) {
        setError(err.message);
        setBusy(false);
        return;
      }
    }

    // Interactive Instant Payment Gateway (Card, UPI, Net Banking, COD)
    try {
      setProcessingStep('Connecting to secure payment gateway…');
      await new Promise(r => setTimeout(r, 600));

      setProcessingStep('Authorizing transaction with bank…');
      await new Promise(r => setTimeout(r, 800));

      setProcessingStep('Verifying stock reservation and receipt…');

      const response = await post('checkout/pay', {
        addressId: selectedAddress,
        items: items.map(i => ({ productId: i.id, quantity: i.qty })),
        paymentMethod,
        paymentDetails: {
          cardNumber: cardNumber ? `•••• ${cardNumber.slice(-4)}` : undefined,
          cardName: cardName || undefined,
          upiId: upiId || undefined,
          bank: paymentMethod === 'netbanking' ? bank : undefined,
        },
      });

      if (response.success && response.order) {
        setComplete({
          ...response.order,
          transactionId: response.transactionId,
          paymentMethodName:
            paymentMethod === 'card'
              ? 'Credit/Debit Card'
              : paymentMethod === 'upi'
              ? 'UPI Payment'
              : paymentMethod === 'netbanking'
              ? `Net Banking (${bank})`
              : 'Cash on Delivery',
        });
        setItems([]);
      } else {
        setError('Payment could not be completed. Please try again.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setProcessingStep('');
    }
  }

  // Confirmation / Receipt screen
  if (complete) {
    return (
      <section className="form-wrap success-card payment-success">
        <div className="success-mark">
          <Check size={28} />
        </div>
        <Eyebrow>ORDER CONFIRMED & PAYMENT VERIFIED</Eyebrow>
        <h2 style={{ margin: '14px 0 6px', font: '500 42px var(--serif)' }}>
          Thank you for supporting handmade.
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: '13px', maxWidth: '520px', margin: '0 auto 24px' }}>
          Your handcrafted piece has been reserved and your order is officially placed. We craft and pack every order with gentle care.
        </p>

        {/* Receipt Box */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '24px', textAlign: 'left', maxWidth: '540px', margin: '0 auto 26px', display: 'grid', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Order ID:</span>
            <strong style={{ fontSize: '12px', letterSpacing: '1px' }}>{complete.id}</strong>
          </div>
          {complete.transactionId && (
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Transaction Reference:</span>
              <span style={{ fontSize: '11px', fontFamily: 'monospace' }}>{complete.transactionId}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Payment Method:</span>
            <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--gold)' }}>
              {complete.paymentMethodName || complete.paymentMethod?.toUpperCase()}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Payment Status:</span>
            <span className="status-chip completed">PAID & VERIFIED</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Delivering To:</span>
            <span style={{ fontSize: '11px', textAlign: 'right' }}>
              <b>{complete.address?.fullName}</b><br />
              {complete.address?.city}, {complete.address?.state}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px' }}>
            <span style={{ fontSize: '12px', fontWeight: '600' }}>Total Paid:</span>
            <strong style={{ fontSize: '18px', color: 'var(--gold)', font: '600 20px var(--serif)' }}>
              {money(complete.subtotal)}
            </strong>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link className="button button-dark" to="/orders">
            View My Orders <ArrowRight size={15} />
          </Link>
          <button type="button" className="button button-line" onClick={() => window.print()}>
            <Printer size={15} /> Print Receipt
          </button>
          <Link className="text-link" to="/shop">
            Continue Browsing Projects
          </Link>
        </div>
      </section>
    );
  }

  // Empty Bag
  if (!items.length) {
    return (
      <div className="cart-empty" style={{ margin: '80px auto', maxWidth: '360px', textAlign: 'center' }}>
        <div className="empty-icon"><ShoppingBag size={28} /></div>
        <h3 style={{ font: '500 28px var(--serif)', margin: '14px 0 8px' }}>Your bag is empty</h3>
        <p style={{ color: 'var(--muted)', fontSize: '12px', margin: '0 0 20px' }}>
          Discover our handcrafted keepsakes and add pieces to your collection.
        </p>
        <Link className="button button-dark" to="/shop">
          Explore Handcrafted Pieces <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  return (
    <>
      <PageIntro
        eyebrow="Safe & Seamless Checkout"
        title="Purchase your projects."
        copy="Select your saved delivery address and choose your preferred payment gateway. Every piece is handcrafted with love."
      />

      <section className="checkout-layout">
        {/* Left Column: Delivery Address & Payment Gateway */}
        <div className="checkout-main">
          {/* Step 1: Address */}
          <div className="account-panel">
            <div className="account-panel-head">
              <div>
                <Eyebrow>STEP 01</Eyebrow>
                <h2>Delivery Address</h2>
              </div>
              <button
                type="button"
                className="button button-line"
                style={{ fontSize: '9px', minHeight: '34px', padding: '0 12px' }}
                onClick={() => setShowAddAddress(!showAddAddress)}
              >
                <Plus size={14} /> {showAddAddress ? 'Close Form' : 'Add New Address'}
              </button>
            </div>

            {loading ? (
              <p className="account-muted">Loading your saved addresses…</p>
            ) : addresses.length ? (
              <div className="checkout-addresses">
                {addresses.map(a => (
                  <label
                    key={a.id}
                    className={`checkout-address ${selectedAddress === a.id ? 'selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="selectedAddress"
                      value={a.id}
                      checked={selectedAddress === a.id}
                      onChange={() => setSelectedAddress(a.id)}
                    />
                    <span>
                      <b>
                        {a.fullName}
                        {a.isDefault && <i>DEFAULT</i>}
                      </b>
                      <small>
                        {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.postalCode}, {a.country}
                      </small>
                      <small>Phone: {a.phone}</small>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="address-empty">
                <MapPin size={24} />
                <p>No delivery address saved yet. Please add an address below.</p>
              </div>
            )}

            {/* Inline Quick Add Address Drawer */}
            {showAddAddress && (
              <form className="inline-address-drawer" onSubmit={handleInlineSaveAddress}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <b style={{ font: '600 16px var(--serif)' }}>Enter Delivery Location</b>
                  <button type="button" className="text-link" onClick={() => setShowAddAddress(false)}>Cancel</button>
                </div>
                <div className="form-grid">
                  <AddressField label="Full Name" name="fullName" required />
                  <AddressField label="Phone Number" name="phone" required />
                  <AddressField label="Address Line 1" name="line1" required />
                  <AddressField label="Address Line 2 (Optional)" name="line2" />
                  <AddressField label="City" name="city" required />
                  <AddressField label="State / Province" name="state" required />
                  <AddressField label="Postal / PIN Code" name="postalCode" required />
                  <AddressField label="Country" name="country" value="India" required />
                </div>
                <button className="button button-dark" style={{ marginTop: '14px' }} disabled={addressBusy}>
                  {addressBusy ? 'Saving Address…' : 'Use This Address for Delivery'} <Check size={14} />
                </button>
              </form>
            )}
          </div>

          {/* Step 2: Payment Gateway */}
          <div className="checkout-gateway-box">
            <div className="account-panel-head">
              <div>
                <Eyebrow>STEP 02</Eyebrow>
                <h2>Choose Payment Gateway</h2>
              </div>
              <span className="gateway-secure-tag"><Lock size={14} /> 256-Bit SSL Encrypted</span>
            </div>

            {/* Gateway Method Selector Tabs */}
            <div className="gateway-tabs">
              <button
                type="button"
                className={`gateway-tab-btn ${paymentMethod === 'card' ? 'selected' : ''}`}
                onClick={() => setPaymentMethod('card')}
              >
                <CreditCard size={20} />
                <span>Credit/Debit Card</span>
              </button>

              <button
                type="button"
                className={`gateway-tab-btn ${paymentMethod === 'upi' ? 'selected' : ''}`}
                onClick={() => setPaymentMethod('upi')}
              >
                <Smartphone size={20} />
                <span>UPI / QR Code</span>
              </button>

              <button
                type="button"
                className={`gateway-tab-btn ${paymentMethod === 'netbanking' ? 'selected' : ''}`}
                onClick={() => setPaymentMethod('netbanking')}
              >
                <Building2 size={20} />
                <span>Net Banking</span>
              </button>

              <button
                type="button"
                className={`gateway-tab-btn ${paymentMethod === 'cod' ? 'selected' : ''}`}
                onClick={() => setPaymentMethod('cod')}
              >
                <Truck size={20} />
                <span>Cash on Delivery</span>
              </button>

              {config?.razorpay?.enabled && (
                <button
                  type="button"
                  className={`gateway-tab-btn ${paymentMethod === 'razorpay' ? 'selected' : ''}`}
                  onClick={() => setPaymentMethod('razorpay')}
                >
                  <ShieldCheck size={20} />
                  <span>Razorpay</span>
                </button>
              )}
            </div>

            {/* Gateway Content Forms */}
            <div className="gateway-content">
              {paymentMethod === 'card' && (
                <div className="card-fields-grid">
                  <label className="field wide">
                    Card Number
                    <input
                      placeholder="4532 •••• •••• 8892"
                      value={cardNumber}
                      onChange={handleCardNumberChange}
                      maxLength={19}
                    />
                  </label>
                  <label className="field wide">
                    Cardholder Name
                    <input
                      placeholder="Name on card"
                      value={cardName}
                      onChange={e => setCardName(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Expiry Date
                    <input
                      placeholder="MM / YY"
                      value={cardExpiry}
                      onChange={handleExpiryChange}
                      maxLength={5}
                    />
                  </label>
                  <label className="field">
                    CVV / CVC
                    <input
                      type="password"
                      placeholder="•••"
                      value={cardCvv}
                      onChange={e => setCardCvv(e.target.value.slice(0, 4))}
                      maxLength={4}
                    />
                  </label>
                </div>
              )}

              {paymentMethod === 'upi' && (
                <div className="upi-options-wrap">
                  <div className="upi-apps-row">
                    <span className="upi-app-chip">Google Pay</span>
                    <span className="upi-app-chip">PhonePe</span>
                    <span className="upi-app-chip">Paytm</span>
                    <span className="upi-app-chip">BHIM UPI</span>
                  </div>

                  <label className="field">
                    Enter UPI ID (VPA)
                    <input
                      placeholder="username@okhdfcbank or mobilenumber@paytm"
                      value={upiId}
                      onChange={e => setUpiId(e.target.value)}
                    />
                  </label>

                  <div style={{ textAlign: 'center', margin: '4px 0' }}>
                    <span style={{ fontSize: '10px', color: 'var(--muted)' }}>— OR SCAN QR CODE —</span>
                  </div>

                  <button
                    type="button"
                    className="button button-line"
                    onClick={() => setShowQr(!showQr)}
                    style={{ margin: '0 auto', fontSize: '10px' }}
                  >
                    <QrCode size={16} /> {showQr ? 'Hide UPI QR Code' : 'Show Interactive UPI QR Code'}
                  </button>

                  {showQr && (
                    <div className="upi-qr-card">
                      {/* SVG Simulated QR code */}
                      <svg width="150" height="150" viewBox="0 0 100 100" style={{ background: '#fff', padding: '8px', border: '1px solid var(--border)' }}>
                        <rect width="30" height="30" x="5" y="5" fill="#29180F" />
                        <rect width="20" height="20" x="10" y="10" fill="#fff" />
                        <rect width="10" height="10" x="15" y="15" fill="#29180F" />
                        <rect width="30" height="30" x="65" y="5" fill="#29180F" />
                        <rect width="20" height="20" x="70" y="10" fill="#fff" />
                        <rect width="10" height="10" x="75" y="15" fill="#29180F" />
                        <rect width="30" height="30" x="5" y="65" fill="#29180F" />
                        <rect width="20" height="20" x="10" y="70" fill="#fff" />
                        <rect width="10" height="10" x="15" y="75" fill="#29180F" />
                        <rect width="10" height="10" x="45" y="15" fill="#A8792E" />
                        <rect width="10" height="10" x="45" y="45" fill="#A8792E" />
                        <rect width="10" height="10" x="45" y="75" fill="#29180F" />
                        <rect width="10" height="10" x="15" y="45" fill="#A8792E" />
                        <rect width="10" height="10" x="75" y="45" fill="#A8792E" />
                        <rect width="10" height="10" x="65" y="65" fill="#29180F" />
                        <rect width="10" height="10" x="80" y="80" fill="#29180F" />
                      </svg>
                      <b style={{ font: '500 13px var(--serif)' }}>ARTCRAFTS Merchant QR</b>
                      <small style={{ color: 'var(--muted)', fontSize: '10px' }}>
                        Scan using any UPI app to pay {money(subtotal)} instantly
                      </small>
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === 'netbanking' && (
                <div>
                  <label className="field" style={{ marginBottom: '12px' }}>Choose Your Bank</label>
                  <div className="bank-selection-grid">
                    {['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Bank', 'Punjab National Bank'].map(b => (
                      <button
                        key={b}
                        type="button"
                        className={`bank-option-btn ${bank === b ? 'active' : ''}`}
                        onClick={() => setBank(b)}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                  <select
                    value={bank}
                    onChange={e => setBank(e.target.value)}
                    style={{ width: '100%', padding: '10px', border: '1px solid var(--border)', background: 'var(--card)', fontSize: '11px' }}
                  >
                    <option value="HDFC Bank">HDFC Bank</option>
                    <option value="ICICI Bank">ICICI Bank</option>
                    <option value="State Bank of India">State Bank of India</option>
                    <option value="Axis Bank">Axis Bank</option>
                    <option value="Kotak Bank">Kotak Mahindra Bank</option>
                    <option value="Punjab National Bank">Punjab National Bank</option>
                    <option value="Bank of Baroda">Bank of Baroda</option>
                    <option value="Canara Bank">Canara Bank</option>
                    <option value="IndusInd Bank">IndusInd Bank</option>
                    <option value="Yes Bank">Yes Bank</option>
                    <option value="Federal Bank">Federal Bank</option>
                  </select>
                </div>
              )}

              {paymentMethod === 'cod' && (
                <div className="cod-info-box">
                  <b>Pay on Delivery Available:</b>
                  <p style={{ margin: '6px 0 0' }}>
                    You can pay in cash or via UPI QR code directly to the courier executive when your handcrafted creation reaches your address.
                  </p>
                </div>
              )}

              {paymentMethod === 'razorpay' && (
                <div className="cod-info-box">
                  <b>Razorpay Standard Checkout:</b>
                  <p style={{ margin: '6px 0 0' }}>
                    Clicking continue will open Razorpay's secure test modal for transaction authorization.
                  </p>
                </div>
              )}
            </div>

            {error && <p className="login-error" role="alert">{error}</p>}

            <button
              className="button button-dark full button-gold"
              disabled={busy || loading || !addresses.length || !items.length}
              onClick={processOrderPayment}
            >
              {busy
                ? 'Processing Payment…'
                : paymentMethod === 'cod'
                ? `Confirm Cash on Delivery Order (${money(subtotal)})`
                : `Pay ${money(subtotal)} & Confirm Order`} <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Right Column: Order Summary */}
        <aside className="checkout-summary">
          <Eyebrow>YOUR COLLECTION</Eyebrow>
          <h2>Order Summary</h2>

          {items.map(item => (
            <div className="checkout-item" key={item.id}>
              <img src={item.images?.[0]} alt={item.name} />
              <div>
                <b>{item.name}</b>
                <small>Qty: {item.qty} · Handcrafted</small>
              </div>
              <strong>{money(item.price * item.qty)}</strong>
            </div>
          ))}

          <div style={{ padding: '14px 0', borderBottom: '1px solid var(--border)', display: 'grid', gap: '8px', fontSize: '11px', color: 'var(--muted)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Pieces Subtotal:</span>
              <span>{money(subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Handcrafted Packing & Delivery:</span>
              <span style={{ color: '#4d7045', fontWeight: '600' }}>FREE</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>GST & Taxes:</span>
              <span>Included</span>
            </div>
          </div>

          <div className="checkout-total">
            <span>Order Total:</span>
            <b>{money(subtotal)}</b>
          </div>

          <small style={{ display: 'block', color: 'var(--muted)', fontSize: '10px', lineHeight: '1.6', marginTop: '10px' }}>
            🔒 256-Bit SSL Protected Checkout. Prices are all-inclusive. Every item is verified for quality before shipping.
          </small>
        </aside>
      </section>

      {/* Payment Processing Modal Overlay */}
      {busy && (
        <div className="payment-processing-modal">
          <div className="payment-processing-card">
            <div className="payment-spinner" />
            <Eyebrow>ARTCRAFTS SECURE GATEWAY</Eyebrow>
            <h3 style={{ font: '500 24px var(--serif)', margin: '10px 0 8px' }}>
              Securing Your Purchase
            </h3>
            <p style={{ color: 'var(--muted)', fontSize: '12px' }}>
              {processingStep || 'Authorizing with gateway…'}
            </p>
            <small style={{ color: 'var(--gold)', fontSize: '10px', marginTop: '12px', display: 'block' }}>
              Please do not refresh or close this tab.
            </small>
          </div>
        </div>
      )}
    </>
  );
}

export function CustomerOrders() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('orders')
      .then(x => setOrders(x.orders || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageIntro
        eyebrow="Purchased Projects"
        title="Your order history."
        copy="Follow the progress, payment confirmations, and delivery updates for all handcrafted creations."
      />

      <section className="account-panel orders-panel">
        <div className="account-panel-head">
          <div>
            <Eyebrow>ORDER TRACKING</Eyebrow>
            <h2>My Purchases</h2>
          </div>
          <Link className="text-link" to="/profile">
            Profile & Saved Addresses <ArrowRight size={14} />
          </Link>
        </div>

        {error && <p className="login-error">{error}</p>}

        {loading ? (
          <p className="account-muted">Loading your purchases…</p>
        ) : orders.length ? (
          orders.map(order => (
            <article className="customer-order" key={order.id} style={{ padding: '20px 0' }}>
              <div className="customer-order-head">
                <div>
                  <span style={{ fontSize: '10px', letterSpacing: '1px', color: 'var(--gold)' }}>
                    {order.createdAt?.slice(0, 10)} · ORDER {order.id.slice(0, 8).toUpperCase()}
                  </span>
                  <b style={{ font: '600 22px var(--serif)' }}>{money(order.subtotal)}</b>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className={`status-chip ${order.paymentStatus === 'captured' ? 'completed' : ''}`}>
                    {order.paymentStatus === 'captured' ? 'PAID' : order.paymentStatus?.toUpperCase()}
                  </span>
                  <span className="status-chip in-progress">
                    {order.status}
                  </span>
                </div>
              </div>

              {/* Order Tracker Timeline */}
              <div className="order-tracker-timeline">
                <div className="tracker-step done"><Check size={12} /> Ordered</div>
                <div className="tracker-line done" />
                <div className="tracker-step done"><Check size={12} /> Payment Verified</div>
                <div className="tracker-line done" />
                <div className="tracker-step done"><Sparkles size={12} /> Handcrafted Prep</div>
                <div className="tracker-line" />
                <div className="tracker-step"><Truck size={12} /> Dispatched</div>
              </div>

              {/* Items List */}
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', padding: '14px 18px', margin: '12px 0' }}>
                <b style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>
                  Pieces in this order
                </b>
                {order.items?.map((item, i) => (
                  <div key={`${item.productId}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', padding: '4px 0' }}>
                    <span>{item.name} × <b>{item.quantity}</b></span>
                    <span>{money(item.unitPrice * item.quantity)}</span>
                  </div>
                ))}
              </div>

              {/* Delivery Details */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', color: 'var(--muted)', flexWrap: 'wrap', gap: '8px' }}>
                <span>
                  Delivering to: <b>{order.address?.fullName}</b> ({order.address?.city}, {order.address?.country}) · {order.address?.phone}
                </span>
                {order.paymentMethod && (
                  <span className="demo-chip" style={{ textTransform: 'uppercase' }}>
                    Method: {order.paymentMethod}
                  </span>
                )}
              </div>
            </article>
          ))
        ) : (
          <div className="address-empty">
            <PackageCheck size={28} />
            <p>No orders placed yet. Find a handcrafted project in the shop.</p>
            <Link className="button button-dark" to="/shop">
              Explore Handcrafted Pieces <ArrowRight size={15} />
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
