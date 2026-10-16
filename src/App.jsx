import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, Camera, Check, ChevronDown, Database, Download, ExternalLink, Heart, Image as ImageIcon, MapPin, Menu, Minus, PackageCheck, Plus, Search, ShoppingBag, SlidersHorizontal, Sparkles, UserRound, X } from 'lucide-react';
import { products as seedProducts } from './data/products';
import { categories as seedCategories } from './data/categories';
import { artisans as seedArtisans } from './data/artisans';
import { gallery as seedGallery } from './data/gallery';
import { faqs } from './data/faqs';
import { api, post, put, patch, del, uploadReferenceImage, setAuthToken } from './api';
import { StoreContext, useStore } from './context/StoreContext';
import { CheckoutPage, CustomerOnly, CustomerOrders, LoginPage, ProfilePage } from './pages/account.jsx';
import { PrivacyPolicy, ShippingPolicy, ReturnsPolicy, TermsConditions } from './pages/legal.jsx';
import { ImageUploader } from './components/ImageUploader.jsx';

const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const img = (src, alt, props={}) => <img src={src} alt={alt} loading="lazy" onError={e => { e.currentTarget.src='https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=900&q=75'; }} {...props}/>;

function App(){
  const [items,setItems]=useState(()=>JSON.parse(localStorage.getItem('artcrafts-cart')||'[]'));
  const [products,setProducts]=useState(seedProducts);
  const [categories,setCategories]=useState(seedCategories);
  const [artisans,setArtisans]=useState(seedArtisans);
  const [cartOpen,setCartOpen]=useState(false);
  const [user,setUser]=useState(null);
  const [authReady,setAuthReady]=useState(false);
  useEffect(()=>localStorage.setItem('artcrafts-cart',JSON.stringify(items)),[items]);
  useEffect(()=>{Promise.all([api('storefront/products'),api('storefront/categories'),api('storefront/artisans'),api('auth/me')]).then(([p,c,a,auth])=>{setProducts(p.products);setCategories(c.categories);setArtisans(a.artisans);setUser(auth.user)}).catch(error=>console.error('ARTCRAFTS API unavailable:',error)).finally(()=>setAuthReady(true))},[]);
  const refreshUser=async()=>{const result=await api('auth/me');setUser(result.user);return result.user};
  const logout=async()=>{await post('auth/logout',{}).catch(()=>{});setAuthToken(null);setUser(null)};
  const add=(product,qty=1)=>setItems(curr=>{const old=curr.find(x=>x.id===product.id);return old?curr.map(x=>x.id===product.id?{...x,qty:x.qty+qty}:x):[...curr,{...product,qty}];});
  const value={items,setItems,products,setProducts,categories,setCategories,artisans,setArtisans,add,cartOpen,setCartOpen,user,setUser,authReady,refreshUser,logout};
  return <StoreContext.Provider value={value}><Routes><Route path="/login" element={<LoginPage/>}/><Route path="/admin/login" element={<LoginPage initialRole="admin"/>}/><Route path="/admin/*" element={<AdminGate/>}/><Route path="/*" element={<PublicLayout/>}/></Routes><CartDrawer/></StoreContext.Provider>;
}

function PublicLayout(){return <><Header/><main><Routes>
  <Route path="/" element={<Home/>}/><Route path="/shop" element={<Shop/>}/><Route path="/collections" element={<Collections/>}/><Route path="/collections/:slug" element={<CategoryPage/>}/><Route path="/products/:slug" element={<ProductPage/>}/>
  <Route path="/custom-orders" element={<CustomOrders/>}/><Route path="/gallery" element={<Gallery/>}/><Route path="/about" element={<About/>}/><Route path="/artisans" element={<ArtisanDirectory/>}/><Route path="/artisans/:slug" element={<ArtisanProfile/>}/><Route path="/contact" element={<Contact/>}/><Route path="/faq" element={<FAQ/>}/><Route path="/profile" element={<CustomerOnly><ProfilePage/></CustomerOnly>}/><Route path="/checkout" element={<CustomerOnly><CheckoutPage/></CustomerOnly>}/><Route path="/orders" element={<CustomerOnly><CustomerOrders/></CustomerOnly>}/>
  <Route path="/privacy-policy" element={<PrivacyPolicy/>}/>
  <Route path="/shipping-policy" element={<ShippingPolicy/>}/>
  <Route path="/returns-policy" element={<ReturnsPolicy/>}/>
  <Route path="/terms" element={<TermsConditions/>}/>
  <Route path="*" element={<NotFound/>}/>
</Routes></main><Footer/></>}

function Header(){const [open,setOpen]=useState(false),[search,setSearch]=useState(false),[query,setQuery]=useState('');const {items,setCartOpen,products,user}=useStore();const navigate=useNavigate();const count=items.reduce((n,x)=>n+x.qty,0);const matches=products.filter(p=>p.published&&p.name.toLowerCase().includes(query.toLowerCase())).slice(0,5);const nav=[['Home','/'],['Shop','/shop'],['Collections','/collections'],['Custom Orders','/custom-orders'],['Our Story','/about'],['Contact','/contact']];const accountTo=user?.role==='admin'?'/admin/dashboard':user?'/profile':'/login';return <header className="site-header"><div className="header-inner"><Link className="brand" to="/" aria-label="ARTCRAFTS home"><img src="/logo/artcrafts-logo.jpg" alt="ARTCRAFTS — Crafting Memories, Creating Art"/><span>ARTCRAFTS<small>Crafting Memories, Creating Art.</small></span></Link><nav className={open?'main-nav is-open':'main-nav'} aria-label="Primary navigation">{nav.map(([label,to])=><NavLink key={to} onClick={()=>setOpen(false)} to={to} end={to==='/'}>{label}</NavLink>)}</nav><div className="header-actions"><button className="icon-button" aria-label="Search products" onClick={()=>setSearch(!search)}><Search size={19}/></button><Link className="icon-button" to={accountTo} aria-label={user?`Account for ${user.name}`:'Sign in'}><UserRound size={19}/></Link><button className="icon-button bag-button" aria-label={`Shopping bag, ${count} items`} onClick={()=>setCartOpen(true)}><ShoppingBag size={20}/>{count>0&&<span className="cart-count">{count}</span>}</button><button className="icon-button menu-toggle" aria-label={open?'Close menu':'Open menu'} onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button></div></div>{search&&<div className="search-pop"><form onSubmit={e=>{e.preventDefault();navigate(`/shop?q=${encodeURIComponent(query)}`);setSearch(false)}}><Search size={18}/><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search handmade pieces…" aria-label="Search products"/><button type="button" onClick={()=>{setSearch(false);setQuery('')}} aria-label="Close search"><X size={17}/></button></form>{query&&<div className="search-results">{matches.length?matches.map(p=><Link key={p.id} to={`/products/${p.slug}`} onClick={()=>setSearch(false)}>{p.name}<span>{money(p.price)}</span></Link>):<p>No pieces found. Try another search.</p>}</div>}</div>}</header>}

function Footer(){return <footer className="footer"><div className="footer-main"><div className="footer-brand"><div className="footer-mark">A<span>✦</span></div><div><strong>ARTCRAFTS</strong><p>Crafting Memories, Creating Art.</p></div><p className="footer-note">Thoughtfully made, lovingly kept.<br/>Little works of art for everyday moments.</p><div className="social-placeholder"><Camera size={17}/><span>Social accounts and WhatsApp — configure before launch</span></div></div><div className="footer-links"><div><h4>Explore</h4><Link to="/shop">Shop all</Link><Link to="/collections">Collections</Link><Link to="/gallery">Gallery</Link><Link to="/artisans">Our artisans</Link></div><div><h4>Here to help</h4><Link to="/custom-orders">Custom orders</Link><Link to="/about">Our story</Link><Link to="/contact">Contact</Link><Link to="/faq">FAQs</Link></div><div><h4>Small print</h4><Link to="/privacy-policy">Privacy</Link><Link to="/shipping-policy">Shipping</Link><Link to="/returns-policy">Returns</Link><Link to="/terms">Terms</Link></div></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} ARTCRAFTS. Made with care.</span><span>Sample storefront · Configure contact and social links before launch</span></div></footer>}

function Eyebrow({children}){return <span className="eyebrow"><i/> {children}</span>}
function SectionTitle({eyebrow,title,copy,link,to}){return <div className="section-title"><div><Eyebrow>{eyebrow}</Eyebrow><h2>{title}</h2>{copy&&<p>{copy}</p>}</div>{link&&<Link className="text-link" to={to}>{link}<ArrowRight size={16}/></Link>}</div>}
function ProductCard({product,index=0}){const {add}=useStore();return <article className="product-card" style={{'--delay':`${index*70}ms`}}><Link className="product-image" to={`/products/${product.slug}`}>{img(product.images?.[0],product.name)}<span className={product.stock===0?'availability sold':'availability'}>{product.stock===0?'Unavailable':product.stock<5?'Few left':'Ready to ship'}</span><span className="quick-view"><ArrowUpRight size={18}/></span></Link><div className="product-info"><div><Link className="product-name" to={`/products/${product.slug}`}>{product.name}</Link><span className="product-category">{product.categoryId?.replaceAll('-',' ')}</span></div><strong>{money(product.price)}</strong></div><button className="add-button" disabled={product.stock<1} onClick={()=>add(product)}>{product.stock<1?'Currently unavailable':<>Add to bag <Plus size={15}/></>}</button></article>}
function CollectionCard({category,index=0}){return <Link className={`collection-card coll-${index}`} to={`/collections/${category.slug}`}><div className="collection-image">{img(category.image,category.name)}</div><div className="collection-caption"><span>0{index+1} / ARTCRAFTS COLLECTION</span><h3>{category.name}</h3><ArrowUpRight size={21}/></div></Link>}

function Home(){const {products,categories}=useStore();const featured=products.filter(p=>p.published).slice(0,4);return <><section className="hero"><div className="hero-copy"><Eyebrow>Handcrafted with love.</Eyebrow><h1>Every piece<br/>tells a <em>story.</em></h1><p>Thoughtful handmade art and personalized gifts, made slowly and meant to be kept close.</p><div className="hero-buttons"><Link className="button button-dark" to="/collections">Explore our collection <ArrowRight size={16}/></Link><Link className="button button-line" to="/custom-orders">Create something personal</Link></div><div className="hero-signoff"><span className="gold-rule"/><span>Made by hand, just for you</span></div></div><div className="hero-art"><div className="hero-photo">{img('https://images.unsplash.com/photo-1490312278390-ab64016e0aa9?auto=format&fit=crop&w=1500&q=90','An artisan workspace with colorful handmade resin art')}</div><div className="hero-stamp"><span>Made<br/>with</span><Heart size={15} fill="currentColor"/><b>love</b></div><div className="hero-number">01 <i/> HANDMADE, ALWAYS</div></div><div className="hero-side-note">THE ART OF THE EVERYDAY <i>✳</i></div></section><div className="marquee"><span>HANDMADE WITH HEART</span><i>✳</i><span>MADE TO BE KEPT</span><i>✳</i><span>GIFT A LITTLE WONDER</span><i>✳</i><span>HANDMADE WITH HEART</span></div>
<section className="section featured-section"><SectionTitle eyebrow="Little things, made lovely" title="Made to find a home." copy="One-of-a-kind details, hand-finished with care. Find the piece that feels like yours." link="Shop all pieces" to="/shop"/><div className="product-grid">{featured.map((p,i)=><ProductCard product={p} index={i} key={p.id}/>)}</div></section>
<section className="section collections-section"><SectionTitle eyebrow="A little of everything" title="Find your kind of handmade." link="All collections" to="/collections"/><div className="collection-grid">{categories.filter(c=>c.published).map((c,i)=><CollectionCard key={c.id} category={c} index={i}/>)}</div></section>
<section className="story-band"><div className="story-image">{img('https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=1100&q=85','Hands carefully arranging art and craft materials')}</div><div className="story-copy"><Eyebrow>A slower kind of making</Eyebrow><h2>Made with feeling.<br/><em>Meant to be felt.</em></h2><p>We believe the best things carry a little of the person who made them. Each ARTCRAFTS piece is an invitation to give more thoughtfully, keep what matters, and find beauty in the everyday.</p><Link className="text-link" to="/about">A little about us <ArrowRight size={16}/></Link><span className="story-flower">✳</span></div></section>
<section className="custom-band"><div><Eyebrow>Your idea, our hands</Eyebrow><h2>Some things are<br/>too personal <em>for ordinary.</em></h2><p>Tell us what you have in mind. We’ll help you imagine a piece that feels like it could only belong to you.</p><Link className="button button-dark" to="/custom-orders">Request a custom creation <ArrowRight size={16}/></Link></div><div className="custom-visual">{img('https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=1100&q=85','A thoughtful handmade gift, wrapped with care')}<span className="round-note">A GIFT<br/>WITH A<br/><b>STORY</b></span></div></section>
<section className="section gallery-preview"><SectionTitle eyebrow="From the making table" title="A few things we’ve made." copy="Every piece begins somewhere. Here are a few moments along the way." link="Visit the gallery" to="/gallery"/><div className="gallery-strip">{seedGallery.slice(0,3).map((g,i)=><Link to="/gallery" className={`gallery-tile tile-${i}`} key={g.title}>{img(g.image,g.alt)}<span>{g.title}<ArrowUpRight size={17}/></span></Link>)}</div></section>
<section className="values-band"><Eyebrow>The little things matter</Eyebrow><h2>Made with <em>heart</em>, down to the detail.</h2><div className="values-grid"><div><span>01</span><Sparkles/><h3>Handmade, always</h3><p>No two pieces are exactly alike. That’s the lovely part.</p></div><div><span>02</span><Heart/><h3>Personal by nature</h3><p>Made to carry the colors, words, and moments that matter.</p></div><div><span>03</span><ArrowDown/><h3>Thoughtful gifting</h3><p>A little something that says a little more.</p></div><div><span>04</span><Check/><h3>Finished with care</h3><p>Every edge, detail, and final wrap gets a second look.</p></div></div></section>
<section className="final-cta"><div className="cta-sun">✳</div><Eyebrow>A good place to begin</Eyebrow><h2>Find a piece that<br/><em>feels like you.</em></h2><div><Link className="button button-dark" to="/shop">Browse the shop <ArrowRight size={16}/></Link><Link className="text-link" to="/custom-orders">Dream up something new <ArrowRight size={16}/></Link></div></section></>}

function Shop(){const {products,categories}=useStore();const location=useLocation();const [q,setQ]=useState(new URLSearchParams(location.search).get('q')||''),[cat,setCat]=useState('all'),[sort,setSort]=useState('featured'),[filters,setFilters]=useState(false);const list=useMemo(()=>products.filter(p=>p.published&&p.name.toLowerCase().includes(q.toLowerCase())&&(cat==='all'||p.categoryId===cat)).sort((a,b)=>sort==='price-up'?a.price-b.price:sort==='price-down'?b.price-a.price:sort==='az'?a.name.localeCompare(b.name):0),[products,q,cat,sort]);return <><PageIntro eyebrow="The whole little world" title="Shop all" copy="A considered collection of handmade pieces, made for gifting, gathering, and keeping."/><div className="catalog section"><div className="catalog-top"><span>{list.length} {list.length===1?'piece':'pieces'} to love</span><button className="filter-toggle" onClick={()=>setFilters(!filters)}><SlidersHorizontal size={16}/> Filters</button><label className="sort-select">Sort by <select value={sort} onChange={e=>setSort(e.target.value)}><option value="featured">Featured</option><option value="price-up">Price: low to high</option><option value="price-down">Price: high to low</option><option value="az">Name: A to Z</option></select><ChevronDown size={14}/></label></div><div className={filters?'catalog-filters show':'catalog-filters'}><label>Search pieces<input value={q} onChange={e=>setQ(e.target.value)} placeholder="Try ‘coaster’"/></label><label>Collection<select value={cat} onChange={e=>setCat(e.target.value)}><option value="all">All collections</option>{categories.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label><button className="text-link clear-filters" onClick={()=>{setQ('');setCat('all');setSort('featured')}}>Clear filters <X size={14}/></button></div>{list.length?<div className="product-grid">{list.map((p,i)=><ProductCard key={p.id} product={p} index={i}/>)}</div>:<EmptyState title="Nothing in this little corner just yet" copy="Try another search or clear your filters." action="Clear filters" onClick={()=>{setQ('');setCat('all')}}/>}</div></>}
function Collections(){const {categories}=useStore();return <><PageIntro eyebrow="A little world of its own" title="Collections" copy="Browse by the things we love to make: fluid color, thoughtful keepsakes, and objects for home."/><section className="section collection-index">{categories.filter(c=>c.published).map((c,i)=><CollectionCard key={c.id} category={c} index={i}/>)}</section></>}
function CategoryPage(){const {slug}=useParams();const {categories,products}=useStore();const [sort,setSort]=useState('featured'),[q,setQ]=useState('');const category=categories.find(c=>c.slug===slug&&c.published);if(!category)return <NotFound compact title="Collection not found"/>;const list=products.filter(p=>p.published&&p.categoryId===category.id&&p.name.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>sort==='price-up'?a.price-b.price:sort==='price-down'?b.price-a.price:0);return <><div className="category-hero">{img(category.image,category.name)}<div><Link className="back-link" to="/collections"><ArrowLeft size={15}/> All collections</Link><Eyebrow>ARTCRAFTS COLLECTION</Eyebrow><h1>{category.name}</h1><p>{category.description}</p></div></div><div className="section catalog"><div className="catalog-top"><span>{list.length} pieces</span><input className="inline-search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search this collection"/><label className="sort-select">Sort <select value={sort} onChange={e=>setSort(e.target.value)}><option value="featured">Featured</option><option value="price-up">Price: low to high</option><option value="price-down">Price: high to low</option></select></label></div>{list.length?<div className="product-grid">{list.map((p,i)=><ProductCard product={p} key={p.id} index={i}/>)}</div>:<EmptyState title="No pieces here just now" copy="Try a different search, or browse all collections." action="All collections" to="/collections"/>}</div></>}
function ProductPage(){const {slug}=useParams();const {products,add,categories}=useStore();const navigate=useNavigate();const product=products.find(p=>p.slug===slug&&p.published);const [qty,setQty]=useState(1),[personal,setPersonal]=useState('');if(!product)return <NotFound compact title="Piece not found"/>;const category=categories.find(c=>c.id===product.categoryId);const buyNow=()=>{add(product,qty);navigate('/checkout');};return <div className="product-detail section"><div className="detail-photo">{img(product.images[0],product.name)}<span className="photo-caption">HANDMADE WITH CARE · ARTCRAFTS</span></div><div className="detail-info"><Link className="back-link" to={category?`/collections/${category.slug}`:'/shop'}><ArrowLeft size={15}/>{category?.name||'Shop all'}</Link><Eyebrow>{category?.name||'Handmade piece'}</Eyebrow><h1>{product.name}</h1><div className="detail-price">{money(product.price)} <span>INR</span></div><p className="detail-description">{product.description}</p><div className="detail-availability"><i className={product.stock<1?'dot muted':''}/>{product.stock<1?'Currently unavailable':product.stock<5?'Only a few left':'Ready to ship'}</div>{product.materials&&<div className="spec-row"><span>Materials</span><span>{product.materials}</span></div>}{product.personalized&&<label className="personal-field">A note for your maker <span>optional</span><input value={personal} onChange={e=>setPersonal(e.target.value)} placeholder="Colors, initials, or a little note…"/></label>}<div className="buy-row"><div className="quantity"><button aria-label="Decrease quantity" onClick={()=>setQty(Math.max(1,qty-1))}><Minus size={14}/></button><span>{qty}</span><button aria-label="Increase quantity" onClick={()=>setQty(qty+1)}><Plus size={14}/></button></div><button className="button button-dark" disabled={!product.stock} onClick={()=>{add(product,qty);setQty(1)}}>{product.stock?'Add to bag':'Unavailable'} <ShoppingBag size={16}/></button>{product.stock>0&&<button className="button button-gold buy-now-btn" onClick={buyNow}>Purchase Project <ArrowRight size={15}/></button>}</div><div className="detail-note"><Heart size={16}/><span>Small-batch and made by hand, so each piece has its own lovely little differences.</span></div><div className="detail-custom"><span>Have something special in mind?</span><Link to="/custom-orders">Let’s make it personal <ArrowRight size={15}/></Link></div></div><section className="related-products"><SectionTitle eyebrow="You might also love" title="More little treasures" link="Shop all" to="/shop"/><div className="product-grid">{products.filter(p=>p.published&&p.id!==product.id).slice(0,3).map((p,i)=><ProductCard key={p.id} product={p} index={i}/>)}</div></section></div>}

function CartDrawer(){const {cartOpen,setCartOpen,items,setItems}=useStore();const total=items.reduce((s,x)=>s+x.price*x.qty,0);return <><div className={cartOpen?'drawer-scrim open':'drawer-scrim'} aria-hidden={!cartOpen} onClick={()=>setCartOpen(false)}/><aside className={cartOpen?'cart-drawer open':'cart-drawer'} aria-label="Shopping bag" aria-hidden={!cartOpen} inert={!cartOpen}><div className="drawer-head"><div><Eyebrow>Your little collection</Eyebrow><h2>Shopping bag <span>({items.reduce((n,x)=>n+x.qty,0)})</span></h2></div><button className="icon-button" onClick={()=>setCartOpen(false)} aria-label="Close shopping bag"><X/></button></div>{items.length?<><div className="cart-lines">{items.map(x=><div className="cart-line" key={x.id}>{img(x.images?.[0],x.name)}<div className="cart-line-info"><Link to={`/products/${x.slug}`} onClick={()=>setCartOpen(false)}>{x.name}</Link><b>{money(x.price)}</b><div className="quantity small"><button aria-label="Decrease" onClick={()=>setItems(items.map(y=>y.id===x.id?{...y,qty:Math.max(1,y.qty-1)}:y))}><Minus size={12}/></button><span>{x.qty}</span><button aria-label="Increase" onClick={()=>setItems(items.map(y=>y.id===x.id?{...y,qty:y.qty+1}:y))}><Plus size={12}/></button><button className="remove-line" onClick={()=>setItems(items.filter(y=>y.id!==x.id))}>Remove</button></div></div></div>)}</div><div className="cart-foot"><div className="subtotal"><span>Subtotal</span><strong>{money(total)}</strong></div><p>Secure checkout requires a customer account and a saved delivery address.</p><Link className="button button-dark full" to="/checkout" onClick={()=>setCartOpen(false)}>Continue to checkout <ArrowRight size={16}/></Link></div></>:<div className="cart-empty"><div className="empty-icon"><ShoppingBag/></div><h3>Your bag is taking a little rest.</h3><p>Find something handmade to bring home.</p><button className="button button-dark" onClick={()=>setCartOpen(false)}>Explore the shop <ArrowRight size={16}/></button></div>}</aside></>}

function PageIntro({eyebrow,title,copy}){return <section className="page-intro"><Eyebrow>{eyebrow}</Eyebrow><h1>{title}</h1><p>{copy}</p><span className="intro-spark">✳</span></section>}
function EmptyState({title,copy,action,to,onClick}){return <div className="empty-state"><span>✳</span><h3>{title}</h3><p>{copy}</p>{to?<Link className="button button-line" to={to}>{action} <ArrowRight size={16}/></Link>:<button className="button button-line" onClick={onClick}>{action} <ArrowRight size={16}/></button>}</div>}
function NotFound({compact=false,title='This page wandered off',copy='We can help you find your way back to something lovely.'}){return <div className={compact?'not-found compact':'not-found'}><span>404 · A LITTLE DETOUR</span><h1>{title}</h1><p>{copy}</p><Link className="button button-dark" to="/">Back to the beginning <ArrowRight size={16}/></Link></div>}

function CustomOrders(){
  const [file,setFile]=useState(null);
  const [referenceImageUrl,setReferenceImageUrl]=useState('');
  const [busy,setBusy]=useState(false);
  const [done,setDone]=useState('');
  const [errors,setErrors]=useState({});

  async function submit(e){
    e.preventDefault();
    const f=e.currentTarget;
    const data=Object.fromEntries(new FormData(f));
    const err={};
    ['name','email','craft'].forEach(k=>{if(!String(data[k]||'').trim())err[k]='Please fill this in.'});
    if(data.email&&!/^\S+@\S+\.\S+$/.test(data.email))err.email='Enter a valid email address.';
    setErrors(err);
    if(Object.keys(err).length)return;
    setBusy(true);
    try{
      let uploadedUrl = referenceImageUrl;
      if(file && !uploadedUrl){
        uploadedUrl = await uploadReferenceImage(file);
      }
      const result=await post('custom-orders',{...data,requiredBy:data.date, referenceImageUrl: uploadedUrl});
      setDone(result.reference);
      f.reset();
      setFile(null);
      setReferenceImageUrl('');
    }catch(error){
      setErrors({submit:error.message});
    }finally{
      setBusy(false);
    }
  }

  return (
    <>
      <PageIntro eyebrow="A piece with your name on it" title="Let’s make it personal." copy="Tell us what you’re dreaming up. Requests are recorded in the studio database for our artisans to review."/>
      {done ? (
        <section className="form-wrap success-card">
          <div className="success-mark"><Check/></div>
          <Eyebrow>Request recorded</Eyebrow>
          <h2>What a lovely idea.</h2>
          <p>Your reference is <b>{done}</b>. Our studio team will review your custom enquiry and get back to you shortly.</p>
          <button className="button button-dark" onClick={()=>setDone('')}>Send another idea <ArrowRight size={16}/></button>
        </section>
      ) : (
        <form className="form-wrap request-form" onSubmit={submit} noValidate>
          <div className="form-heading">
            <span>01</span>
            <div><h2>Start with the basics</h2><p>A few details to help us picture it.</p></div>
          </div>
          <div className="form-grid">
            <Field label="Your name" name="name" error={errors.name} required/>
            <Field label="Email address" name="email" type="email" error={errors.email} required/>
            <Field label="Phone number" name="phone" type="tel"/>
            <Field label="What would you like made?" name="craft" error={errors.craft} required placeholder="A keepsake tray, a gift set…"/>
            <Field label="The occasion" name="occasion" placeholder="Birthday, wedding, just because…"/>
            <Field label="Budget range (INR)" name="budget" placeholder="e.g. ₹1,000–₹2,000"/>
            <label className="field wide">Preferred colors or design<textarea name="design" rows="3" placeholder="Tell us the colors, mood, or little details you have in mind."/></label>
            <label className="field wide">Personalization text <span className="optional">optional</span><input name="personalization" placeholder="A name, date, or short message"/></label>
            <Field label="When do you need it?" name="date" type="date"/>
            <label className="field wide">A little more about your idea<textarea name="notes" rows="4" placeholder="Anything else that would help us imagine it?"/></label>
            <ImageUploader label="Reference image" value={referenceImageUrl} onChange={setReferenceImageUrl} folder="custom-orders" endpoint="upload/reference-image" hint="Upload a sketch, photo, or mood board (JPG, PNG, WebP up to 5 MB)"/>
          </div>
          <div className="form-submit">
            <p>Requests are recorded securely for the ARTCRAFTS studio to review.</p>
            <button className="button button-dark" disabled={busy}>{busy?'Saving your idea…':'Send your idea'} <ArrowRight size={16}/></button>
          </div>
          {errors.submit&&<p className="error">{errors.submit}</p>}
        </form>
      )}
    </>
  );
}

function Field({label,name,type='text',placeholder='',error,required}){return <label className="field">{label}{required&&<span className="required"> *</span>}<input name={name} type={type} placeholder={placeholder}/>{error&&<small className="error">{error}</small>}</label>}

function Gallery(){
  const [items,setItems]=useState(seedGallery);
  const [filter,setFilter]=useState('All');
  const [selected,setSelected]=useState(null);

  useEffect(()=>{
    api('gallery')
      .then(res => {
        if (Array.isArray(res.gallery) && res.gallery.length > 0) {
          setItems(res.gallery);
        }
      })
      .catch(() => {});
  },[]);

  const types=['All',...new Set(items.map(g=>g.category).filter(Boolean))];
  const shown=filter==='All'?items:items.filter(g=>g.category===filter);

  useEffect(()=>{
    function key(e){if(e.key==='Escape')setSelected(null)}
    window.addEventListener('keydown',key);
    return()=>window.removeEventListener('keydown',key);
  },[]);

  return (
    <>
      <PageIntro eyebrow="Made along the way" title="The little things we make." copy="A collection of color, craft, and the details that make each piece its own."/>
      <div className="section gallery-page">
        <div className="gallery-filters">
          {types.map(t=><button className={filter===t?'active':''} key={t} onClick={()=>setFilter(t)}>{t}</button>)}
        </div>
        <div className="gallery-grid">
          {shown.map((g,i)=>(
            <button key={g.id || g.title} className={`gallery-card gallery-${i%3}`} onClick={()=>setSelected(g)}>
              {img(g.image,g.alt || g.title)}
              <span className="gallery-card-meta">
                <span>{g.category}</span>
                <b>{g.title}</b>
              </span>
              <span className="gallery-open"><ArrowUpRight size={18}/></span>
            </button>
          ))}
        </div>
      </div>
      {selected&&(
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={selected.title} onClick={()=>setSelected(null)}>
          <button className="lightbox-close" aria-label="Close preview"><X/></button>
          {img(selected.image,selected.alt || selected.title)}
          <div>
            <Eyebrow>{selected.category}</Eyebrow>
            <h2>{selected.title}</h2>
            {selected.artisanName && <small style={{display:'block',color:'var(--gold)',marginBottom:'6px'}}>Crafted by {selected.artisanName}</small>}
            <p>{selected.description}</p>
          </div>
        </div>
      )}
    </>
  );
}

function About(){return <><PageIntro eyebrow="A note from the making table" title="A little more feeling in the everyday." copy="ARTCRAFTS is a home for handmade art, considered details, and gifts that say a little more."/><section className="about-story"><div className="about-image">{img('https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=1200&q=85','A warm artisan studio full of art materials')}</div><div><Eyebrow>Our creative philosophy</Eyebrow><h2>Made by hand.<br/><em>Kept by heart.</em></h2><p>We think a handmade piece carries something a factory-made one can’t: a little patience, a human touch, and the happy knowledge that no other piece is quite the same.</p><p>At ARTCRAFTS, we bring together resin art, handmade crafts, customized gifts, and home accents. Each idea begins with curiosity, takes shape through careful making, and leaves the table only when the details feel right.</p><Link className="text-link" to="/gallery">See what we make <ArrowRight size={16}/></Link></div></section><section className="values-band about-values"><Eyebrow>What we hold close</Eyebrow><h2>Good things take <em>care.</em></h2><div className="values-grid"><div><span>01</span><Sparkles/><h3>Make with intention</h3><p>Every color, finish, and final detail has a reason.</p></div><div><span>02</span><Heart/><h3>Celebrate the personal</h3><p>The best keepsakes feel like they belong to one person.</p></div><div><span>03</span><Check/><h3>Honor the handmade</h3><p>Small differences are part of the story, not a flaw.</p></div></div><Link className="button button-dark" to="/shop">Find your piece <ArrowRight size={16}/></Link></section></>}

function ArtisanDirectory(){const {artisans}=useStore();return <><PageIntro eyebrow="The hands behind the making" title="Meet our makers." copy="A directory of the creative hands and thoughtful perspectives behind ARTCRAFTS."/><section className="section artisan-grid">{artisans.filter(a=>a.published).map((a,i)=><Link className="artisan-card" to={`/artisans/${a.slug}`} key={a.id}>{img(a.image,a.name)}<span className="artisan-index">MAKER 0{i+1}</span><h2>{a.name}</h2><span className="artisan-specialty">{a.specialty}</span><span className="text-link">Meet the maker <ArrowRight size={15}/></span></Link>)}</section></>}
function ArtisanProfile(){const {slug}=useParams();const {artisans,products}=useStore();const person=artisans.find(a=>a.slug===slug&&a.published);if(!person)return <NotFound compact title="Maker not found"/>;const related=products.filter(p=>p.published);return <><div className="artisan-profile section"><div className="artisan-portrait">{img(person.image,person.name)}<span>ARTISAN</span></div><div className="artisan-bio"><Link className="back-link" to="/artisans"><ArrowLeft size={15}/> All makers</Link><Eyebrow>ARTCRAFTS MAKER</Eyebrow><h1>{person.name}</h1><span className="artisan-specialty">{person.specialty}</span><p>{person.bio}</p><Link className="button button-dark" to="/shop">Explore handmade pieces <ArrowRight size={16}/></Link></div></div><section className="section"><SectionTitle eyebrow="Made with a maker’s touch" title="Pieces to explore" link="Shop all" to="/shop"/><div className="product-grid">{related.slice(0,4).map((p,i)=><ProductCard key={p.id} product={p} index={i}/>)}</div></section></>}

function Contact(){const [sent,setSent]=useState(false),[err,setErr]=useState(''),[busy,setBusy]=useState(false);async function send(e){e.preventDefault();const d=Object.fromEntries(new FormData(e.currentTarget));if(!d.name||!d.email||!d.message){setErr('Please complete your name, email, and message.');return}if(!/^\S+@\S+\.\S+$/.test(d.email)){setErr('Please enter a valid email address.');return}setBusy(true);setErr('');try{await post('contact',d);setSent(true)}catch(error){setErr(error.message)}finally{setBusy(false)}}return <><PageIntro eyebrow="We’d love to hear from you" title="A note, a question, a hello." copy="Contact form submissions are sent to the studio and logged in the database for prompt response."/><section className="contact-layout"><div className="contact-aside"><Eyebrow>Here for the little details</Eyebrow><h2>Let’s talk<br/><em>handmade.</em></h2><p>Have a question about a piece, or an idea you’d like to make real? Leave us a note for the studio.</p><div className="contact-placeholder"><span>Studio Inquiries</span><b>orders@artcrafts.com</b><small>We respond to all handmade enquiries within 24 business hours.</small></div></div><form className="contact-form" onSubmit={send}>{sent?<div className="success-card"><div className="success-mark"><Check/></div><h2>Message received.</h2><p>Thank you for reaching out! Our studio team will review your message and reply promptly.</p><button type="button" className="text-link" onClick={()=>setSent(false)}>Write another <ArrowRight size={15}/></button></div>:<><Field label="Your name" name="name" required/><Field label="Email address" name="email" type="email" required/><Field label="Subject" name="subject"/><label className="field">Your message <span className="required">*</span><textarea name="message" rows="5" required/></label>{err&&<p className="error">{err}</p>}<button className="button button-dark" disabled={busy}>{busy?'Saving…':'Send a note'} <ArrowRight size={16}/></button><small>Submissions are transmitted securely to the studio.</small></>}</form></section></>}
function FAQ(){const [open,setOpen]=useState(0);return <><PageIntro eyebrow="A few helpful things" title="Frequently asked." copy="A little more detail on custom pieces, materials, care, and order tracking."/><section className="faq-list">{faqs.map((f,i)=><div className={open===i?'faq-item open':'faq-item'} key={f.q}><button onClick={()=>setOpen(open===i?-1:i)} aria-expanded={open===i}><span>{String(i+1).padStart(2,'0')}</span><b>{f.q}</b>{open===i?<Minus/>:<Plus/>}</button>{open===i&&<p>{f.a}</p>}</div>)}</section></>}

function AdminGate(){const {user,authReady,logout}=useStore();const location=useLocation();if(!authReady)return <div className="account-loading">Checking administrator session…</div>;if(user?.role!=='admin')return <Navigate to={`/login?role=admin&next=${encodeURIComponent(location.pathname)}`} replace/>;return <AdminLayout onLogout={logout} user={user}/>}

function AdminLayout({onLogout,user}){
  const {setProducts,setCategories,setArtisans}=useStore();
  const [backupStatus,setBackupStatus]=useState('');

  useEffect(()=>{
    Promise.all([api('admin/products'),api('admin/categories'),api('admin/artisans')])
      .then(([p,c,a])=>{setProducts(p.products);setCategories(c.categories);setArtisans(a.artisans)})
      .catch(error=>console.error('Unable to load admin data:',error))
  },[]);

  async function handleBackup(){
    setBackupStatus('Exporting database snapshot…');
    try{
      const res = await post('admin/backup',{});
      setBackupStatus(`✓ Backup exported (${res.storage}): ${res.filename}`);
      setTimeout(()=>setBackupStatus(''), 7000);
    }catch(err){
      setBackupStatus(`Backup error: ${err.message}`);
      setTimeout(()=>setBackupStatus(''), 7000);
    }
  }

  const loc=useLocation();
  const path=loc.pathname.split('/')[2]||'dashboard';
  const names={
    dashboard:'Dashboard',
    products:'Manage products',
    categories:'Manage categories',
    inventory:'Inventory',
    orders:'Manage orders',
    artisans:'Manage artisans',
    gallery:'Manage gallery'
  };
  const initials=user.name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="admin-logo" to="/admin/dashboard">
          <span>A</span><b>ARTCRAFTS<small>STUDIO</small></b>
        </Link>
        <div className="admin-user">
          <span>{initials}</span><div><b>{user.name}</b><small>{user.email}</small></div>
        </div>
        <nav>
          {[
            ['dashboard','Dashboard'],
            ['products','Products'],
            ['categories','Categories'],
            ['inventory','Inventory'],
            ['orders','Orders'],
            ['artisans','Artisans'],
            ['gallery','Gallery']
          ].map(([slug,label],i)=>(
            <NavLink key={slug} to={`/admin/${slug}`} className={({isActive})=>isActive?'admin-nav active':'admin-nav'}>
              <span>{['⌂','▤','◈','◷','▧','♙','🖼'][i]}</span>{label}
            </NavLink>
          ))}
        </nav>
        <div className="admin-side-foot">
          <button type="button" onClick={handleBackup} style={{marginBottom:'8px',color:'var(--light-gold)',display:'flex',alignItems:'center',gap:'6px',width:'100%',background:'none',border:0,cursor:'pointer',fontSize:'10px'}}>
            <Database size={13}/> Cloud Backup
          </button>
          {backupStatus && <small style={{fontSize:'8px',color:'#c4b29a',display:'block',marginBottom:'6px'}}>{backupStatus}</small>}
          <Link to="/">View Store <ArrowUpRight size={15}/></Link>
          <button onClick={onLogout}>Log out <ArrowLeft size={15}/></button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-top">
          <div><span>ARTCRAFTS STUDIO</span><h1>{names[path]||'Admin'}</h1></div>
          <div>
            <button type="button" className="button button-line" onClick={handleBackup} style={{padding:'6px 12px',fontSize:'9px',gap:'6px'}}>
              <Database size={13}/> Backup DB
            </button>
            <span className="demo-chip">SQLITE WAL</span>
            <button className="admin-avatar" title={user.email}>{initials}</button>
          </div>
        </header>
        <Routes>
          <Route path="dashboard" element={<Dashboard/>}/>
          <Route path="products" element={<AdminProducts/>}/>
          <Route path="categories" element={<AdminCategories/>}/>
          <Route path="inventory" element={<Inventory/>}/>
          <Route path="orders" element={<AdminOrders/>}/>
          <Route path="artisans" element={<AdminArtisans/>}/>
          <Route path="gallery" element={<AdminGallery/>}/>
          <Route path="*" element={<Dashboard/>}/>
        </Routes>
      </main>
    </div>
  );
}

function Dashboard(){
  const {categories}=useStore();
  const [data,setData]=useState({}),[error,setError]=useState('');
  useEffect(()=>{api('admin/dashboard').then(setData).catch(e=>setError(e.message))},[]);
  const m=data.metrics||{};
  return (
    <div className="admin-content">
      {error&&<p className="login-error">{error}</p>}
      <div className="metric-grid">
        <Metric label="Total products" value={m.products??'—'} sub="Across all collections"/>
        <Metric label="Published" value={m.publishedProducts??'—'} sub="Visible in store"/>
        <Metric label="Low stock" value={m.lowStock??'—'} sub="Fewer than 5 pieces"/>
        <Metric label="Pending requests" value={(m.pendingOrders||0)+(m.pendingRequests||0)} sub="Needs attention"/>
      </div>
      <div className="admin-panels">
        <div className="admin-panel">
          <div className="panel-heading"><div><span>RECENT ACTIVITY</span><h2>Latest orders</h2></div><Link to="/admin/orders">View all <ArrowRight size={14}/></Link></div>
          <AdminTable heads={['CUSTOMER','ORDER','STATUS']} rows={(data.recent||[]).map(o=>[o.customer,o.id,o.status])}/>
        </div>
        <div className="admin-panel">
          <div className="panel-heading"><div><span>QUICK LINKS</span><h2>Studio shortcuts</h2></div></div>
          <div className="quick-links">
            {[['Products','products'],['Inventory','inventory'],['Categories','categories'],['Artisans','artisans'],['Gallery','gallery']].map(([n,to])=><Link key={to} to={'/admin/'+to}>{n}<ArrowUpRight size={16}/></Link>)}
          </div>
          <div className="category-count"><span>COLLECTIONS</span><b>{m.categories??categories.length}</b></div>
        </div>
      </div>
    </div>
  );
}

function Metric({label,value,sub}){return <div className="metric-card"><span>{label}</span><b>{value}</b><small>{sub}</small></div>}
function AdminTable({heads,rows}){return <div className="table-wrap"><table><thead><tr>{heads.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{r.map((x,j)=><td key={j}>{j===r.length-1?<span className={`status-chip ${String(x).toLowerCase().replaceAll(' ','-')}`}>{x}</span>:x}</td>)}</tr>)}</tbody></table></div>}

function AdminProducts(){
  const {products,setProducts,categories}=useStore();
  const [q,setQ]=useState(''),[modal,setModal]=useState(false),[edit,setEdit]=useState(null),[error,setError]=useState('');
  const [formImage,setFormImage]=useState('');
  const list=products.filter(p=>p.name.toLowerCase().includes(q.toLowerCase()));

  async function save(e){
    e.preventDefault();
    setError('');
    const d=Object.fromEntries(new FormData(e.currentTarget));
    const item={
      ...d,
      price:Number(d.price),
      stock:Number(d.stock),
      published:d.published==='true',
      personalized:d.personalized==='true',
      available:true,
      images:[formImage || d.image || edit?.images?.[0] || ''],
      slug:d.slug||d.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')
    };
    try{
      const r=edit?await put('admin/products/'+edit.id,item):await post('admin/products',item);
      setProducts(edit?products.map(p=>p.id===edit.id?r.product:p):[r.product,...products]);
      setModal(false);
      setEdit(null);
      setFormImage('');
    }catch(e){
      setError(e.message);
    }
  }

  async function delProd(id){
    if(!confirm('Delete this product?'))return;
    try{
      await del('admin/products/'+id);
      setProducts(products.filter(p=>p.id!==id));
    }catch(e){
      setError(e.message);
    }
  }

  return (
    <AdminPage title="Products · Studio Catalog" action="Add product" onAction={()=>{setEdit(null);setFormImage('');setModal(true);}}>
      <div className="admin-toolbar"><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search products…"/><span>{list.length} products</span></div>
      {error&&<p className="login-error">{error}</p>}
      <div className="admin-product-list">
        {list.map(p=>(
          <div className="admin-product-row" key={p.id}>
            {img(p.images?.[0],p.name)}
            <div className="admin-prod-name"><b>{p.name}</b><small>{categories.find(c=>c.id===p.categoryId)?.name||p.categoryId} · {p.sku||'No SKU'}</small></div>
            <strong>{money(p.price)}</strong>
            <span className={p.published?'status-chip published':'status-chip draft'}>{p.published?'Published':'Draft'}</span>
            <button onClick={()=>{setEdit(p);setFormImage(p.images?.[0]||'');setModal(true);}}>Edit</button>
            <button className="delete-button" onClick={()=>delProd(p.id)}>Delete</button>
          </div>
        ))}
      </div>
      {modal&&(
        <AdminModal title={edit?'Edit product':'Add product'} onClose={()=>setModal(false)} onSubmit={save}>
          <label>Name<input name="name" defaultValue={edit?.name} required/></label>
          <label>Slug<input name="slug" defaultValue={edit?.slug}/></label>
          <label>SKU<input name="sku" defaultValue={edit?.sku}/></label>
          <label>Category
            <select name="categoryId" defaultValue={edit?.categoryId||categories[0]?.id}>
              {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>Price (INR)<input type="number" min="0" name="price" defaultValue={edit?.price} required/></label>
          <label>Stock<input type="number" min="0" name="stock" defaultValue={edit?.stock??0}/></label>
          <ImageUploader label="Product Image" value={formImage} onChange={setFormImage} folder="products" endpoint="admin/upload-image" required/>
          <label>Description<textarea name="description" defaultValue={edit?.description}/></label>
          <label>Status
            <select name="published" defaultValue={String(edit?.published??true)}>
              <option value="true">Published</option>
              <option value="false">Draft</option>
            </select>
          </label>
          <label>Personalization
            <select name="personalized" defaultValue={String(edit?.personalized??false)}>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </label>
        </AdminModal>
      )}
    </AdminPage>
  );
}

function AdminPage({title,action,onAction,children}){return <div className="admin-content"><div className="admin-page-head"><p>{title}</p>{action&&<button className="admin-primary" onClick={onAction}><Plus size={16}/>{action}</button>}</div>{children}</div>}
function AdminModal({title,onClose,onSubmit,children}){return <div className="modal-scrim" onClick={onClose}><form className="admin-modal" onClick={e=>e.stopPropagation()} onSubmit={onSubmit}><header><h2>{title}</h2><button type="button" onClick={onClose}><X/></button></header><div className="admin-modal-body">{children}</div><footer><button type="button" onClick={onClose}>Cancel</button><button className="admin-primary">Save changes</button></footer></form></div>}

function AdminCategories(){
  const {categories,setCategories,products}=useStore();
  const [modal,setModal]=useState(false),[edit,setEdit]=useState(null),[error,setError]=useState('');
  const [formImage,setFormImage]=useState('');

  async function save(e){
    e.preventDefault();
    const d=Object.fromEntries(new FormData(e.currentTarget)),slug=d.slug||d.name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
    const item={...d,slug,image:formImage||d.image||edit?.image||'',published:d.published==='true'};
    try{
      const r=edit?await put('admin/categories/'+edit.id,item):await post('admin/categories',item);
      setCategories(edit?categories.map(c=>c.id===edit.id?r.category:c):[...categories,r.category]);
      setModal(false);
      setFormImage('');
    }catch(e){
      setError(e.message);
    }
  }

  async function delCat(c){
    if(products.some(p=>p.categoryId===c.id)){alert('Reassign products from this category before deleting.');return}
    if(!confirm('Delete '+c.name+'?'))return;
    try{
      await del('admin/categories/'+c.id);
      setCategories(categories.filter(x=>x.id!==c.id));
    }catch(e){
      setError(e.message);
    }
  }

  return (
    <AdminPage title="Collections · Studio Taxonomy" action="Add category" onAction={()=>{setEdit(null);setFormImage('');setModal(true);}}>
      {error&&<p className="login-error">{error}</p>}
      <div className="admin-entity-grid">
        {categories.map(c=>(
          <div className="admin-entity" key={c.id}>
            {img(c.image,c.name)}
            <div><b>{c.name}</b><small>/{c.slug} · {c.published?'Published':'Draft'}</small><p>{c.description}</p></div>
            <button onClick={()=>{setEdit(c);setFormImage(c.image||'');setModal(true);}}>Edit</button>
            <button className="delete-button" onClick={()=>delCat(c)}>Delete</button>
          </div>
        ))}
      </div>
      {modal&&(
        <AdminModal title={edit?'Edit category':'Add category'} onClose={()=>setModal(false)} onSubmit={save}>
          <label>Name<input name="name" defaultValue={edit?.name} required/></label>
          <label>Slug<input name="slug" defaultValue={edit?.slug}/></label>
          <ImageUploader label="Category Banner Image" value={formImage} onChange={setFormImage} folder="categories" endpoint="admin/upload-image" required/>
          <label>Description<textarea name="description" defaultValue={edit?.description}/></label>
          <label>Status
            <select name="published" defaultValue={String(edit?.published??true)}>
              <option value="true">Published</option>
              <option value="false">Draft</option>
            </select>
          </label>
        </AdminModal>
      )}
    </AdminPage>
  );
}

function Inventory(){
  const {products,setProducts,categories}=useStore();
  const [q,setQ]=useState(''),[cat,setCat]=useState('all'),[low,setLow]=useState(false),[error,setError]=useState('');
  const list=products.filter(p=>p.name.toLowerCase().includes(q.toLowerCase())&&(cat==='all'||p.categoryId===cat)&&(!low||p.stock<5));

  async function adjust(p,delta){
    try{
      const r=await patch('admin/products/'+p.id+'/stock',{delta});
      setProducts(products.map(x=>x.id===p.id?r.product:x));
      setError('');
    }catch(e){
      setError(e.message);
    }
  }

  return (
    <AdminPage title="Live stock · Stock levels updated in real-time">
      <div className="admin-toolbar">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search inventory…"/>
        <select value={cat} onChange={e=>setCat(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="check-filter"><input type="checkbox" checked={low} onChange={e=>setLow(e.target.checked)}/> Low stock only</label>
      </div>
      {error&&<p className="login-error">{error}</p>}
      <div className="inventory-list">
        {list.map(p=>(
          <div className="inventory-row" key={p.id}>
            <div><b>{p.name}</b><small>{p.sku||'SKU not set'} · {categories.find(c=>c.id===p.categoryId)?.name}</small></div>
            <span className={p.stock===0?'stock-status out':p.stock<5?'stock-status low':'stock-status in'}>
              {p.stock===0?'Out of stock':p.stock<5?'Low stock':'In stock'}
            </span>
            <div className="quantity">
              <button disabled={!p.stock} onClick={()=>adjust(p,-1)}><Minus size={14}/></button>
              <b>{p.stock}</b>
              <button onClick={()=>adjust(p,1)}><Plus size={14}/></button>
            </div>
          </div>
        ))}
      </div>
    </AdminPage>
  );
}

function AdminOrders(){
  const [orders,setOrders]=useState([]),[q,setQ]=useState(''),[filter,setFilter]=useState('all'),[error,setError]=useState('');
  useEffect(()=>{api('admin/orders').then(r=>setOrders(r.records)).catch(e=>setError(e.message))},[]);

  async function update(o,status){
    try{
      await patch('admin/orders/'+o.id,{status});
      setOrders(orders.map(x=>x.id===o.id?{...x,status}:x));
    }catch(e){
      setError(e.message);
    }
  }

  const filtered=orders.filter(o=>(o.customer+(o.request||'')+(o.id||'')+(o.email||'')).toLowerCase().includes(q.toLowerCase())&&(filter==='all'||o.status===filter));

  return (
    <AdminPage title="Orders, Payments & Enquiries · Studio Ledger">
      <div className="admin-toolbar">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search orders, customers, IDs…"/>
        <select value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {['New','Pending','Paid','In Progress','Completed','Cancelled'].map(s=><option key={s}>{s}</option>)}
        </select>
        <span>{filtered.length} records</span>
      </div>
      {error&&<p className="login-error">{error}</p>}
      <div className="orders-list">
        {filtered.map(o=>(
          <div className="order-row" key={o.id} style={{display:'grid',gridTemplateColumns:'1fr auto auto',alignItems:'center',gap:'15px',padding:'16px 20px'}}>
            <div>
              <span style={{fontSize:'10px',letterSpacing:'1px',color:'var(--gold)'}}>
                {o.type?.toUpperCase()} · {new Date(o.date).toLocaleDateString()} · ID: {o.id.slice(0,12)}
                {o.paymentMethod&&<strong style={{marginLeft:'8px',padding:'2px 6px',background:'#eee4cf',borderRadius:'2px',fontSize:'9px',color:'var(--brown)'}}>PAYMENT: {o.paymentMethod.toUpperCase()}</strong>}
              </span>
              <b style={{fontSize:'16px',margin:'3px 0',display:'block'}}>{o.request}</b>
              <small style={{color:'var(--muted)'}}>Customer: <b>{o.customer}</b> ({o.email}{o.phone?` · ${o.phone}`:''})</small>
              {o.address&&<small style={{display:'block',color:'var(--muted)',fontSize:'10px'}}>Shipping: {o.address.line1}, {o.address.city}, {o.address.state} {o.address.postalCode}</small>}
              {o.referenceImageUrl&&(
                <div style={{marginTop:'6px',display:'flex',alignItems:'center',gap:'8px'}}>
                  <img src={o.referenceImageUrl} alt="Reference" style={{width:'40px',height:'40px',objectFit:'cover',border:'1px solid var(--border)'}}/>
                  <a href={o.referenceImageUrl} target="_blank" rel="noreferrer" style={{fontSize:'10px',color:'var(--gold)',display:'inline-flex',alignItems:'center',gap:'3px'}}>
                    <ExternalLink size={11}/> View Reference Image
                  </a>
                </div>
              )}
              {o.subtotal>0&&<span style={{display:'inline-block',marginTop:'4px',fontSize:'13px',fontWeight:'600',color:'var(--gold)'}}>{money(o.subtotal)}</span>}
            </div>
            <div>
              <span className={`status-chip ${o.paymentStatus==='captured'?'completed':''}`} style={{marginRight:'8px'}}>
                {o.paymentStatus==='captured'?'PAID':o.paymentStatus||'PENDING'}
              </span>
            </div>
            <select value={o.status} onChange={e=>update(o,e.target.value)}>
              {['New','Pending','Paid','In Progress','Completed','Cancelled'].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        ))}
      </div>
    </AdminPage>
  );
}

function AdminArtisans(){
  const {artisans,setArtisans}=useStore();
  const [modal,setModal]=useState(false),[edit,setEdit]=useState(null),[error,setError]=useState('');
  const [formImage,setFormImage]=useState('');

  async function save(e){
    e.preventDefault();
    const d=Object.fromEntries(new FormData(e.currentTarget)),slug=d.slug||d.name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
    try{
      const payload={...d,slug,image:formImage||d.image||edit?.image||'',published:d.published==='true'};
      const r=edit?await put('admin/artisans/'+edit.id,payload):await post('admin/artisans',payload);
      setArtisans(edit?artisans.map(a=>a.id===edit.id?r.artisan:a):[...artisans,r.artisan]);
      setModal(false);
      setFormImage('');
    }catch(e){
      setError(e.message);
    }
  }

  async function delArtisan(a){
    if(!confirm('Delete '+a.name+'?'))return;
    try{
      await del('admin/artisans/'+a.id);
      setArtisans(artisans.filter(x=>x.id!==a.id));
    }catch(e){
      setError(e.message);
    }
  }

  return (
    <AdminPage title="Artisans · Maker Profiles" action="Add artisan" onAction={()=>{setEdit(null);setFormImage('');setModal(true);}}>
      {error&&<p className="login-error">{error}</p>}
      <div className="admin-entity-grid">
        {artisans.map(a=>(
          <div className="admin-entity" key={a.id}>
            {img(a.image,a.name)}
            <div><b>{a.name}</b><small>{a.specialty} · {a.published?'Published':'Draft'}</small><p>{a.bio}</p></div>
            <button onClick={()=>{setEdit(a);setFormImage(a.image||'');setModal(true);}}>Edit</button>
            <button className="delete-button" onClick={()=>delArtisan(a)}>Delete</button>
          </div>
        ))}
      </div>
      {modal&&(
        <AdminModal title={edit?'Edit artisan':'Add artisan'} onClose={()=>setModal(false)} onSubmit={save}>
          <label>Name<input name="name" defaultValue={edit?.name} required/></label>
          <label>Slug<input name="slug" defaultValue={edit?.slug}/></label>
          <ImageUploader label="Maker Portrait" value={formImage} onChange={setFormImage} folder="artisans" endpoint="admin/upload-image" required/>
          <label>Craft specialty<input name="specialty" defaultValue={edit?.specialty} required/></label>
          <label>Biography<textarea name="bio" defaultValue={edit?.bio} rows="4"/></label>
          <label>Status
            <select name="published" defaultValue={String(edit?.published??true)}>
              <option value="true">Published</option>
              <option value="false">Draft</option>
            </select>
          </label>
        </AdminModal>
      )}
    </AdminPage>
  );
}

function AdminGallery(){
  const [items,setItems]=useState([]);
  const [q,setQ]=useState('');
  const [modal,setModal]=useState(false);
  const [edit,setEdit]=useState(null);
  const [error,setError]=useState('');
  const [formImage,setFormImage]=useState('');

  useEffect(()=>{
    api('admin/gallery').then(r=>setItems(r.gallery||[])).catch(e=>setError(e.message));
  },[]);

  const list=items.filter(g=>(g.title+(g.category||'')).toLowerCase().includes(q.toLowerCase()));

  async function save(e){
    e.preventDefault();
    setError('');
    const d=Object.fromEntries(new FormData(e.currentTarget));
    const payload={
      title:d.title,
      category:d.category||'Resin Art',
      imageUrl:formImage||d.imageUrl||edit?.image||'',
      artisanName:d.artisanName||'',
      description:d.description||'',
      alt:d.alt||d.title,
      featured:d.featured==='true',
    };
    try{
      const r=edit?await put('admin/gallery/'+edit.id,payload):await post('admin/gallery',payload);
      setItems(edit?items.map(x=>x.id===edit.id?r.item:x):[r.item,...items]);
      setModal(false);
      setEdit(null);
      setFormImage('');
    }catch(err){
      setError(err.message);
    }
  }

  async function delItem(id){
    if(!confirm('Remove this piece from the gallery?'))return;
    try{
      await del('admin/gallery/'+id);
      setItems(items.filter(x=>x.id!==id));
    }catch(err){
      setError(err.message);
    }
  }

  return (
    <AdminPage title="Gallery Showcase · Studio Works" action="Add gallery piece" onAction={()=>{setEdit(null);setFormImage('');setModal(true);}}>
      <div className="admin-toolbar">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search gallery by title, craft…"/>
        <span>{list.length} pieces</span>
      </div>
      {error&&<p className="login-error">{error}</p>}
      <div className="admin-entity-grid">
        {list.map(g=>(
          <div className="admin-entity" key={g.id}>
            {img(g.image,g.title)}
            <div>
              <b>{g.title}</b>
              <small>{g.category} {g.featured&&'· ★ Featured'}</small>
              <p>{g.description||'No description added.'}</p>
            </div>
            <button onClick={()=>{setEdit(g);setFormImage(g.image||'');setModal(true);}}>Edit</button>
            <button className="delete-button" onClick={()=>delItem(g.id)}>Delete</button>
          </div>
        ))}
      </div>
      {modal&&(
        <AdminModal title={edit?'Edit gallery piece':'Add gallery piece'} onClose={()=>setModal(false)} onSubmit={save}>
          <label>Title<input name="title" defaultValue={edit?.title} required/></label>
          <label>Category<input name="category" defaultValue={edit?.category||'Resin Art'} required/></label>
          <label>Artisan / Maker Name<input name="artisanName" defaultValue={edit?.artisanName}/></label>
          <label>Featured Piece
            <select name="featured" defaultValue={String(edit?.featured??false)}>
              <option value="false">Standard Showcase</option>
              <option value="true">Featured On Top</option>
            </select>
          </label>
          <ImageUploader label="Gallery Piece Photo" value={formImage} onChange={setFormImage} folder="gallery" endpoint="admin/upload-image" required/>
          <label>Alt Text<input name="alt" defaultValue={edit?.alt||''} placeholder="Descriptive text for accessibility"/></label>
          <label>Description<textarea name="description" defaultValue={edit?.description} rows="3" placeholder="Artisan techniques, materials, inspiration…"/></label>
        </AdminModal>
      )}
    </AdminPage>
  );
}

export default App;

