// A fictional storefront ("Aurum & Co.") used as a local test target and to generate the demo report.
// Run: npm run demo:site   →  http://127.0.0.1:4100
// Analyze it with: ALLOW_PRIVATE=true npm run dev
import http from 'node:http';

const PORT = Number(process.env.FIXTURE_PORT ?? 4100);
const ORIGIN = `http://127.0.0.1:${PORT}`;

const products = [
  { id: 101, name: 'Lotus Gold Bangle', price: 84500, cat: 'bangles' },
  { id: 102, name: 'Temple Kemp Necklace', price: 212000, cat: 'necklaces' },
  { id: 103, name: 'Polki Drop Earrings', price: 56800, cat: 'earrings' },
  { id: 104, name: 'Solitaire Diamond Ring', price: 129900, cat: 'rings' },
  { id: 105, name: 'Antique Jhumka', price: 41200, cat: 'earrings' },
  { id: 106, name: 'Navratna Pendant', price: 67300, cat: 'pendants' },
];
const inr = (n) => '₹' + n.toLocaleString('en-IN');

const page = `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Aurum &amp; Co. | Handcrafted Gold &amp; Diamond Jewellery</title>
<meta name="description" content="Handcrafted gold, polki and diamond jewellery since 1952. Free insured shipping across India.">
<meta property="og:title" content="Aurum &amp; Co. — Heirloom jewellery">
<meta property="og:description" content="Temple, polki and diamond collections, crafted in Bengaluru.">
<meta property="og:site_name" content="Aurum &amp; Co.">
<meta name="theme-color" content="#7a1f2b">
<link rel="canonical" href="${ORIGIN}/">
<link rel="alternate" hreflang="en-in" href="${ORIGIN}/">
<link rel="alternate" hreflang="hi-in" href="${ORIGIN}/hi/">
<link rel="stylesheet" href="/static/css/global.css">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"Aurum & Co.","url":"${ORIGIN}"},{"@type":"WebSite","url":"${ORIGIN}","potentialAction":{"@type":"SearchAction","target":"${ORIGIN}/search?q={q}","query-input":"required name=q"}}]}</script>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Lotus Gold Bangle","offers":{"@type":"Offer","price":"84500","priceCurrency":"INR"}}</script>
<style>
:root{--brand-maroon:#7a1f2b;--brand-gold:#c9a24b;--brand-ivory:#fbf7ef;--ink:#1f1a17;--ink-muted:#6f655c;--radius-card:14px;--radius-pill:999px;--shadow-card:0 6px 24px rgba(31,26,23,.08);--font-display:"Cormorant Garamond",Georgia,serif;--font-body:"Inter",system-ui,sans-serif}
</style>
</head>
<body>
<div class="promo">Free insured shipping on orders above ₹25,000 · BIS hallmarked</div>
<header class="site-header">
  <a class="logo" href="/">Aurum <span>&amp;</span> Co.</a>
  <nav class="main-nav" aria-label="Main">
    <a href="/necklaces">Necklaces</a><a href="/earrings">Earrings</a><a href="/bangles">Bangles</a><a href="/rings">Rings</a><a href="/collections/bridal">Bridal</a>
  </nav>
  <a class="nav-cta" href="/store-locator">Visit a store</a>
</header>
<main>
  <section class="hero">
    <p class="eyebrow">The Heritage Edit</p>
    <h1>Heirlooms, handcrafted<br>for the next generation</h1>
    <p class="lede">Temple, polki and diamond jewellery crafted by our karigars in Bengaluru since 1952.</p>
    <div class="hero-actions"><a class="btn btn-primary" href="/collections/heritage">Explore the collection</a><a class="btn btn-outline" href="/book-appointment">Book an appointment</a></div>
  </section>
  <section class="collection">
    <div class="section-head"><h2>Bestsellers</h2><a href="/bestsellers">View all</a></div>
    <ul class="product-grid">
      ${products.map((p) => `<li class="product-card"><div class="product-media"></div><p class="product-cat">${p.cat}</p><h3>${p.name}</h3><p class="price">${inr(p.price)}</p><button class="btn btn-small" data-pid="${p.id}">Add to bag</button></li>`).join('')}
    </ul>
  </section>
  <section class="newsletter">
    <h2>Be first to see new collections</h2>
    <form class="newsletter-form" action="/subscribe" method="post"><label for="nl-email" class="sr-only">Email</label><input id="nl-email" type="email" placeholder="you@example.com"><button class="btn btn-primary" type="submit">Subscribe</button></form>
  </section>
</main>
<footer class="site-footer"><p>© 1952–2026 Aurum &amp; Co. (fictional demo store)</p><a href="/privacy">Privacy</a> · <a href="/returns">Returns</a> · <a href="https://example.org/careers">Careers</a></footer>
<script src="/static/js/vendor/jquery-3.7.1.min.js"></script>
<script>
  // Simulated storefront traffic for the analyzer to capture.
  fetch('/api/v1/products?category=bestsellers&limit=6').then(r => r.json());
  fetch('/api/v1/products/101').then(r => r.json());
  fetch('/graphql', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ operationName: 'GetCart', query: 'query GetCart { cart { id items { sku qty } total } }' }) });
  fetch('/api/v1/gold-rate?karat=22').then(r => r.json());
  document.querySelectorAll('[data-pid]').forEach(b => b.addEventListener('click', () =>
    fetch('/graphql', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ operationName: 'AddToCart', query: 'mutation AddToCart($id: ID!) { addToCart(id: $id) { id } }', variables: { id: b.dataset.pid } }) })));
</script>
</body>
</html>`;

const css = `
@font-face{font-family:"Cormorant Garamond";src:url(../fonts/cormorant-garamond-600.woff2) format("woff2");font-weight:600;font-display:swap}
@font-face{font-family:"Inter";src:url(../fonts/inter-400.woff2) format("woff2");font-weight:400;font-display:swap}
@font-face{font-family:"Inter";src:url(../fonts/inter-600.woff2) format("woff2");font-weight:600;font-display:swap}
*{box-sizing:border-box}
body{margin:0;font-family:var(--font-body);color:var(--ink);background:var(--brand-ivory);line-height:1.6;font-size:16px}
a{color:var(--brand-maroon);text-decoration:none}
.promo{background:var(--brand-maroon);color:#f6e7c8;text-align:center;font-size:13px;letter-spacing:.04em;padding:8px 16px}
.site-header{display:flex;align-items:center;justify-content:space-between;padding:20px 48px;background:#fff;border-bottom:1px solid #eadfcd}
.logo{font-family:var(--font-display);font-size:28px;font-weight:600;color:var(--ink);letter-spacing:.01em}
.logo span{color:var(--brand-gold)}
.main-nav{display:flex;gap:28px}
.main-nav a{color:var(--ink);font-size:14px;font-weight:600;letter-spacing:.06em;text-transform:uppercase}
.nav-cta{border:1px solid var(--brand-gold);padding:8px 18px;border-radius:var(--radius-pill);font-size:14px}
.hero{padding:96px 48px;background:linear-gradient(120deg,#2b0d12 0%,#7a1f2b 55%,#b0773a 100%);color:#fbf7ef}
.eyebrow{text-transform:uppercase;letter-spacing:.2em;font-size:12px;color:var(--brand-gold);margin:0 0 12px}
.hero h1{font-family:var(--font-display);font-size:56px;line-height:1.1;font-weight:600;margin:0 0 16px}
.lede{font-size:18px;max-width:520px;color:#f1e4d0;margin:0 0 32px}
.hero-actions{display:flex;gap:12px}
.btn{display:inline-block;border:0;border-radius:var(--radius-pill);padding:14px 28px;font:600 15px var(--font-body);cursor:pointer}
.btn-primary{background:var(--brand-gold);color:#2b0d12;box-shadow:0 4px 14px rgba(201,162,75,.35)}
.btn-outline{background:transparent;color:#fbf7ef;border:1px solid rgba(251,247,239,.6)}
.btn-small{padding:8px 16px;font-size:13px;background:var(--ink);color:#fff}
.collection{padding:64px 48px}
.section-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:24px}
.section-head h2,.newsletter h2{font-family:var(--font-display);font-size:36px;font-weight:600;margin:0}
.product-grid{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:24px}
.product-card{flex:1 1 280px;background:#fff;border-radius:var(--radius-card);box-shadow:var(--shadow-card);padding:16px;border:1px solid #f0e6d6}
.product-media{height:180px;border-radius:10px;background:radial-gradient(circle at 30% 30%,#f6e7c8,#c9a24b 60%,#7a5a1e)}
.product-cat{text-transform:uppercase;font-size:11px;letter-spacing:.12em;color:var(--ink-muted);margin:14px 0 4px}
.product-card h3{font-family:var(--font-display);font-size:22px;font-weight:600;margin:0 0 4px}
.price{font-weight:600;margin:0 0 12px;color:var(--brand-maroon)}
.newsletter{padding:56px 48px;background:#f3eadb;text-align:center}
.newsletter-form{display:flex;justify-content:center;gap:8px;margin-top:20px}
.newsletter-form input{padding:12px 16px;border:1px solid #d9c9ad;border-radius:var(--radius-pill);min-width:280px;font:15px var(--font-body)}
.site-footer{padding:32px 48px;background:#1f1a17;color:#bfb3a5;font-size:13px}
.site-footer a{color:#e7d3a8}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
`;

const sections = { necklaces: 9, earrings: 8, bangles: 6, rings: 7, collections: 4, blog: 5 };
const sitemapUrls = [
  `${ORIGIN}/`,
  ...Object.entries(sections).flatMap(([s, n]) => Array.from({ length: n }, (_, i) => `${ORIGIN}/${s}/${s.slice(0, -1)}-${i + 1}`)),
];

const json = (res, body, headers = {}) => {
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(body));
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, ORIGIN);
    const p = url.pathname;
    if (p === '/' || p === '/hi/') {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        server: 'nginx/1.25.4',
        'x-powered-by': 'Express',
        'strict-transport-security': 'max-age=31536000; includeSubDomains',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'set-cookie': [
          'session_id=s%3Aa81f2c9e; Path=/; HttpOnly; SameSite=Lax',
          'cart_token=ct_5d21e8; Path=/; Max-Age=2592000; SameSite=Lax',
          'currency=INR; Path=/; Max-Age=31536000',
        ],
      });
      return res.end(page);
    }
    if (p === '/static/css/global.css') {
      res.writeHead(200, { 'content-type': 'text/css' });
      return res.end(css);
    }
    if (p === '/static/js/vendor/jquery-3.7.1.min.js') {
      res.writeHead(200, { 'content-type': 'application/javascript' });
      return res.end('window.jQuery=window.$=function(){};window.jQuery.fn={jquery:"3.7.1"};');
    }
    if (p === '/api/v1/products') return json(res, { total: products.length, items: products });
    if (/^\/api\/v1\/products\/\d+$/.test(p)) {
      const item = products.find((x) => String(x.id) === p.split('/').pop());
      return json(res, { ...item, karat: 22, weightGrams: 18.4, hallmark: 'BIS 916', images: [`/media/${item?.id}-1.jpg`] });
    }
    if (p === '/api/v1/gold-rate') return json(res, { karat: 22, perGramInr: 7185, updatedAt: '2026-10-21T09:00:00+05:30' }, { 'cache-control': 'max-age=300' });
    if (p === '/graphql' && req.method === 'POST') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const op = JSON.parse(body || '{}').operationName;
        json(res, op === 'AddToCart' ? { data: { addToCart: { id: 'cart_5d21e8' } } } : { data: { cart: { id: 'cart_5d21e8', items: [], total: 0 } } });
      });
      return;
    }
    if (p === '/robots.txt') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      return res.end(`User-agent: *\nDisallow: /checkout\nDisallow: /account\nDisallow: /cart\nDisallow: /search?\nAllow: /search?q=\n\nUser-agent: GPTBot\nDisallow: /\n\nSitemap: ${ORIGIN}/sitemap_index.xml\n`);
    }
    if (p === '/sitemap_index.xml') {
      res.writeHead(200, { 'content-type': 'application/xml' });
      return res.end(`<?xml version="1.0" encoding="UTF-8"?><sitemapindex><sitemap><loc>${ORIGIN}/sitemap-products.xml</loc></sitemap></sitemapindex>`);
    }
    if (p === '/sitemap-products.xml') {
      res.writeHead(200, { 'content-type': 'application/xml' });
      return res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset>${sitemapUrls.map((u) => `<url><loc>${u}</loc></url>`).join('')}</urlset>`);
    }
    if (p === '/.well-known/security.txt') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      return res.end('Contact: mailto:security@example.org\nExpires: 2027-12-31T00:00:00Z\nPreferred-Languages: en\n');
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  })
  .listen(PORT, '127.0.0.1', () => console.log(`Fixture store running at ${ORIGIN}`));
