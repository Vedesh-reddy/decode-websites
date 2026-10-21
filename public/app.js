'use strict';

const $ = (sel) => document.querySelector(sel);
const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

let report = null;
let activeTab = 'overview';

const TABS = [
  ['overview', 'Overview', () => null],
  ['design', 'Design', (r) => r.design?.palette.length],
  ['tech', 'Tech stack', (r) => r.tech?.detected.length],
  ['network', 'Network & APIs', (r) => r.network?.endpoints.length],
  ['structure', 'Structure & SEO', (r) => r.structure?.sitemap?.urlCount],
  ['domain', 'Domain', (r) => r.domain?.subdomains.length],
  ['raw', 'Raw JSON', () => null],
];

/* ---------- small render helpers ---------- */

const card = (title, body, extra = '') =>
  `<section class="card"><div class="card-head"><h2>${esc(title)}</h2>${extra}</div>${body}</section>`;
const empty = (msg = 'Nothing found.') => `<p class="muted small">${esc(msg)}</p>`;
const table = (headers, rows) =>
  rows.length
    ? `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
        .join('')}</tbody></table></div>`
    : empty();
const kv = (pairs) =>
  `<dl class="kv">${pairs
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`)
    .join('')}</dl>`;
const badge = (text, kind = '') => `<span class="badge ${kind}">${esc(text)}</span>`;
const link = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label ?? url)}</a>`;
const code = (v) => `<code>${esc(v)}</code>`;
const chips = (list, fmt = (x) => esc(x.value)) =>
  list?.length ? `<div class="chips">${list.map((x) => `<span class="chip">${fmt(x)}${x.count != null ? `<small>${x.count}×</small>` : ''}</span>`).join('')}</div>` : empty();
const swatch = (hex, count) =>
  `<button type="button" class="swatch" data-copy="${esc(hex)}" aria-label="Copy ${esc(hex)}"><span class="swatch-color"><span style="background:${esc(hex)}"></span></span><span class="swatch-meta"><code>${esc(hex)}</code>${
    count != null ? `<small>${count}×</small>` : ''
  }</span></button>`;
const swatches = (list) => (list?.length ? `<div class="swatches">${list.map((c) => swatch(c.value, c.count)).join('')}</div>` : empty());
const bytes = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n > 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null);
const pretty = (s) => {
  if (!s) return '';
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
};

/* ---------- tab renderers ---------- */

const RENDER = {
  overview(r) {
    const o = r.overview;
    const stats = [
      ['Colors', r.design?.palette.length],
      ['Font families', r.design?.fontFamilies.length],
      ['CSS variables', r.design?.cssVariables.length],
      ['Technologies', r.tech?.detected.length],
      ['API endpoints', r.network?.endpoints.length],
      ['Requests', r.network?.totalRequests],
      ['Sitemap URLs', r.structure?.sitemap?.urlCount],
      ['Subdomains', r.domain?.subdomains.length],
    ];
    const statHtml = `<div class="stats">${stats.map(([l, v]) => `<div class="stat"><b>${v ?? '–'}</b><span>${esc(l)}</span></div>`).join('')}</div>`;
    const errors = Object.entries(r.errors || {});
    const errHtml = errors.length
      ? card('Partial results', `<ul class="error-list">${errors.map(([k, v]) => `<li><b>${esc(k)}</b>: ${esc(v)}</li>`).join('')}</ul>`)
      : '';
    if (!o) return statHtml + errHtml;

    const t = o.timing;
    const details = kv([
      ['Status', badge(o.status, o.status < 400 ? 'ok' : 'bad')],
      ['Final URL', link(o.finalUrl)],
      ['Redirects', o.redirects.length ? o.redirects.map((x) => `${code(x.status)} ${esc(x.url)}`).join('<br>') : null],
      ['Description', o.description ? esc(o.description) : null],
      ['Language', o.lang ? code(o.lang) : null],
      ['TTFB', t ? `${t.ttfbMs} ms` : null],
      ['DOM ready', t ? `${t.domContentLoadedMs} ms` : null],
      ['Load', t ? `${t.loadMs} ms` : null],
      ['HTML size', t && t.decodedBodySize ? bytes(t.decodedBodySize) : null],
      ['Analyzed in', `${(r.meta.durationMs / 1000).toFixed(1)} s`],
    ]);
    const shot = o.screenshot ? `<img class="screenshot" src="${o.screenshot}" alt="Screenshot of ${esc(o.title || o.finalUrl)}">` : empty('No screenshot.');
    return `${errHtml}${card('At a glance', statHtml)}<div class="row">${card('Screenshot (1440×900)', shot)}${card('Page', details)}</div>`;
  },

  design(r) {
    const d = r.design;
    if (!d) return empty('Design data unavailable (the browser step failed).');

    const exportBtns = `<div class="chips"><button type="button" class="btn-small" data-action="copy-css">Copy CSS variables</button><button type="button" class="btn-small" data-action="download-tokens">Download tokens.json</button></div>`;

    const palette = card(
      'Color palette',
      `${swatches(d.palette)}<h3>Text</h3>${swatches(d.textColors)}<h3>Backgrounds</h3>${swatches(d.backgroundColors)}<h3>Borders</h3>${swatches(d.borderColors)}`,
      exportBtns,
    );

    const varRows = d.cssVariables.map((v) => [
      code(v.name),
      `${v.hex ? `<span class="dot" style="background:${esc(v.hex)}"></span>` : ''}${code(v.value)}`,
    ]);
    const vars = card(
      `CSS variables (${d.cssVariables.length})`,
      d.cssVariables.length > 12
        ? `<input type="search" class="filter-input" data-filter="vars" placeholder="Filter variables…" aria-label="Filter variables"><div id="vars-table" style="margin-top:10px">${table(['Name', 'Value'], varRows)}</div>`
        : table(['Name', 'Value'], varRows),
    );

    const families = d.fontStacks
      .slice(0, 8)
      .map(
        (f) =>
          `<div class="font-item"><div class="type-sample" style="font-family:${esc(f.value)}">The quick brown fox — 0123456789</div><code class="muted">${esc(f.value)}</code> <span class="badge">${f.count}×</span></div>`,
      )
      .join('');

    const roleRows = d.roles.map((s) => [
      code(s.role),
      `<span class="role-preview" style="font-family:${esc(s.fontFamily)};font-size:${esc(s.fontSize)};font-weight:${esc(s.fontWeight)};letter-spacing:${esc(s.letterSpacing)};text-transform:${esc(s.textTransform)}">${esc(s.sample || 'Body text sample')}</span>`,
      code(s.fontSize),
      code(s.fontWeight),
      code(s.lineHeight),
      s.color ? `<span class="dot" style="background:${esc(s.color)}"></span>${code(s.color)}` : '–',
      code(s.fontFamily.split(',')[0]),
    ]);

    const typography = card(
      'Typography',
      `<h3>Font stacks (rendered with your local fallbacks)</h3><div class="font-list">${families || empty()}</div>
       <h3>Text roles</h3>${table(['Role', 'Preview', 'Size', 'Weight', 'Line height', 'Color', 'Family'], roleRows)}
       <h3>Type scale</h3>${chips([...d.fontSizes].sort((a, b) => parseFloat(b.value) - parseFloat(a.value)))}
       <h3>Weights</h3>${chips(d.fontWeights)}
       <h3>Line heights</h3>${chips(d.lineHeights)}
       <h3>Letter spacing</h3>${chips(d.letterSpacings)}`,
    );

    const faceRows = d.fontFaces.map((f) => [esc(f.family), code(f.weight), code(f.style), f.sources.map((s) => (s.startsWith('http') ? link(s, s.split('/').pop()) : esc(s))).join('<br>')]);
    const loadedRows = d.loadedFonts.map((f) => [esc(f.family), code(f.weight), code(f.style), badge(f.status, f.status === 'loaded' ? 'ok' : '')]);
    const fonts = card(
      'Font files',
      `<h3>@font-face rules</h3>${table(['Family', 'Weight', 'Style', 'Source'], faceRows)}
       <h3>Fonts registered in the page</h3>${table(['Family', 'Weight', 'Style', 'Status'], loadedRows)}
       <h3>Downloaded font files</h3>${d.fontFiles.length ? `<ul class="list-mono">${d.fontFiles.map((f) => `<li>${link(f)}</li>`).join('')}</ul>` : empty()}
       <p class="muted small">Identifying a font is fine; using a commercial font in your own project needs a license.</p>`,
    );

    const shapes = (list, styleFn) =>
      list.length
        ? `<div class="shape-previews">${list
            .slice(0, 10)
            .map((x) => `<div class="shape"><div class="shape-box" style="${styleFn(x.value)}"></div><code>${esc(x.value)}</code> <span class="badge">${x.count}×</span></div>`)
            .join('')}</div>`
        : empty();

    const surfaces = card(
      'Shapes & effects',
      `<h3>Border radius</h3>${shapes(d.radii, (v) => `border-radius:${esc(v)}`)}
       <h3>Shadows</h3>${shapes(d.shadows, (v) => `box-shadow:${esc(v)};border-color:transparent`)}
       <h3>Gradients</h3>${shapes(d.gradients, (v) => `background-image:${esc(v)}`)}
       <h3>Spacing values</h3>${chips([...d.spacing].sort((a, b) => parseFloat(a.value) - parseFloat(b.value)))}`,
    );

    const tokens = card('Generated tokens', `<pre class="code">${esc(d.tokensCss)}</pre>`);

    return `${palette}${typography}${fonts}${surfaces}${vars}${tokens}<p class="muted small">Scanned ${d.elementsScanned} visible elements.</p>`;
  },

  tech(r) {
    const t = r.tech;
    if (!t) return empty('Tech data unavailable.');
    const groups = {};
    for (const x of t.detected) (groups[x.category] ||= []).push(x);
    const cards = Object.entries(groups)
      .map(([cat, items]) =>
        card(
          cat,
          items
            .map(
              (x) =>
                `<details class="tech-item"><summary><b>${esc(x.name)}</b>${x.version ? badge(`v${x.version}`, 'accent') : ''}</summary><ul>${x.evidence
                  .map((e) => `<li>${esc(e)}</li>`)
                  .join('')}</ul></details>`,
            )
            .join(''),
        ),
      )
      .join('');

    const sec = table(
      ['Header', 'Status', 'Value'],
      t.securityHeaders.map((h) => [code(h.header), h.present ? badge('present', 'ok') : badge('missing', 'bad'), h.value ? code(h.value) : '–']),
    );
    const headers = table(['Header', 'Value'], t.responseHeaders.map((h) => [code(h.name), code(h.value)]));

    return `${t.detected.length ? `<div class="tech-grid">${cards}</div>` : card('Technologies', empty('No known signatures matched.'))}
      ${card('Security headers', sec)}${card('Main document response headers', headers)}
      <p class="muted small">Detection is signature-based (headers, cookies, script URLs, HTML, runtime globals). Click an item to see the evidence.</p>`;
  },

  network(r) {
    const n = r.network;
    if (!n) return empty('Network data unavailable.');
    const stats = `<div class="stats">${[
      ['Requests', n.totalRequests],
      ['First-party', n.firstPartyRequests],
      ['Third-party', n.thirdPartyRequests],
      ['Failed / blocked', n.failedRequests],
      ['API endpoints', n.endpoints.length],
      ['Cookies', n.cookies.length],
    ]
      .map(([l, v]) => `<div class="stat"><b>${v}</b><span>${esc(l)}</span></div>`)
      .join('')}</div><h3 style="margin-top:16px">By resource type</h3>${chips(n.byType)}`;

    const epRows = n.endpoints.map((e) => {
      const s = e.sample;
      const sample = `<details class="sample"><summary>sample</summary>
        <div class="small muted">Full URL</div><pre class="code">${esc(s.url)}</pre>
        ${s.requestBody ? `<div class="small muted">Request body</div><pre class="code">${esc(pretty(s.requestBody))}</pre>` : ''}
        ${s.responsePreview ? `<div class="small muted">Response (first 2 KB)</div><pre class="code">${esc(pretty(s.responsePreview))}</pre>` : ''}
        </details>`;
      return [
        `<span class="method">${esc(e.method)}</span>`,
        `<code>${esc(e.host)}</code><br><code>${esc(e.path)}</code>${e.graphqlOperations.length ? `<br>${e.graphqlOperations.map((op) => badge(`gql: ${op}`, 'accent')).join(' ')}` : ''}${sample}`,
        e.statuses.map((st) => badge(st, st < 400 ? 'ok' : 'bad')).join(' '),
        code(e.contentType || '–'),
        String(e.count),
        e.firstParty ? badge('1st', 'accent') : badge('3rd'),
        s.hasAuthHeader ? badge('auth') : '',
      ];
    });

    const hostRows = n.thirdPartyHosts.map((h) => [code(h.host), String(h.count), h.types.map((t) => badge(t)).join(' ')]);
    const cookieRows = n.cookies.map((c) => [
      code(c.name),
      code(c.domain),
      [c.httpOnly && badge('HttpOnly'), c.secure && badge('Secure'), badge(c.sameSite)].filter(Boolean).join(' '),
      c.expires === 'session' ? 'session' : esc(fmtDate(c.expires)),
      c.firstParty ? badge('1st', 'accent') : badge('3rd'),
      code(c.valuePreview),
    ]);

    return `${card('Traffic summary', stats)}
      ${card(`API endpoints (${n.endpoints.length})`, table(['Method', 'Endpoint', 'Status', 'Type', 'Hits', 'Party', ''], epRows))}
      ${n.websockets.length ? card('WebSockets', `<ul class="list-mono">${n.websockets.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>`) : ''}
      ${card(`Third-party hosts (${n.thirdPartyHosts.length})`, table(['Host', 'Requests', 'Types'], hostRows))}
      ${card(`Cookies (${n.cookies.length})`, table(['Name', 'Domain', 'Flags', 'Expires', 'Party', 'Value'], cookieRows))}`;
  },

  structure(r) {
    const s = r.structure;
    const p = s.page;
    let html = '';
    if (p) {
      const meta = (k) => p.metas.find((m) => m.key.toLowerCase() === k)?.content;
      const og = { title: meta('og:title'), desc: meta('og:description'), image: meta('og:image'), site: meta('og:site_name') };
      const ogCard =
        og.title || og.image
          ? `<div class="og-card">${og.image ? `<img src="${esc(og.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : ''}<div><div class="small muted">${esc(og.site || '')}</div><b>${esc(og.title || '')}</b><div class="small muted">${esc(og.desc || '')}</div></div></div>`
          : empty('No Open Graph tags.');

      html += `<div class="row">${card(
        'Page',
        kv([
          ['Title', esc(p.title)],
          ['Canonical', p.canonical ? link(p.canonical) : null],
          ['Language', p.lang ? code(p.lang) : null],
          ['Links', `${p.links.total} total · ${p.links.internal} internal · ${p.links.external} external`],
          ['Images', `${p.images.total} total · ${p.images.missingAlt} missing alt`],
          ['Forms', String(p.forms)],
          ['Scripts', `${p.scripts.length} external · ${p.inlineScripts} inline`],
          ['Stylesheets', String(p.stylesheets.length)],
          ['Manifest', p.manifest ? link(p.manifest) : null],
          ['Favicon', p.favicon ? link(p.favicon) : null],
        ]),
      )}${card('Social preview (Open Graph)', ogCard)}</div>`;

      html += card(`Meta tags (${p.metas.length})`, table(['Key', 'Content'], p.metas.map((m) => [code(m.key), esc(m.content)])));
      html += card(
        'Headings outline',
        p.headings.length
          ? `<ul class="list-mono">${p.headings.map((h) => `<li style="margin-left:${(h.level - 1) * 16}px"><span class="muted">h${h.level}</span> ${esc(h.text)}</li>`).join('')}</ul>`
          : empty(),
      );
      html += card(
        `Structured data (JSON-LD: ${p.jsonLd.length})`,
        p.jsonLd.length
          ? p.jsonLd.map((j) => `<details class="sample"><summary>${j.types.map((t) => esc(t)).join(', ') || 'untyped'}</summary><pre class="code">${esc(pretty(j.raw))}</pre></details>`).join('')
          : empty(),
      );
      if (p.alternates.length) html += card('hreflang alternates', table(['Lang', 'URL'], p.alternates.map((a) => [code(a.hreflang), link(a.href)])));
      if (p.iframes.length) html += card('Iframes', `<ul class="list-mono">${p.iframes.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>`);
    }

    const rb = s.robots;
    html += card(
      'robots.txt',
      rb
        ? `${kv([
            ['User agents', rb.userAgents.map(code).join(' ')],
            ['Sitemaps', rb.sitemaps.map((x) => link(x)).join('<br>')],
          ])}<h3>Disallowed paths (${rb.disallow.length})</h3>${rb.disallow.length ? `<ul class="list-mono">${rb.disallow.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : empty()}
          <details class="sample" style="margin-top:10px"><summary>raw file</summary><pre class="code">${esc(rb.raw)}</pre></details>`
        : empty('No robots.txt found.'),
    );

    const sm = s.sitemap;
    html += card(
      `Sitemap${sm ? ` (${sm.urlCount}${sm.truncated ? '+' : ''} URLs)` : ''}`,
      sm
        ? `${kv([['Sources', sm.sources.map((x) => link(x)).join('<br>')]])}<h3>Sections</h3>${chips(sm.sections)}
           <h3>URLs</h3><input type="search" class="filter-input" data-filter="sitemap" placeholder="Filter URLs…" aria-label="Filter sitemap URLs">
           <ul class="list-mono" id="sitemap-list" style="margin-top:10px">${sm.urls.map((u) => `<li>${link(u)}</li>`).join('')}</ul>`
        : empty('No sitemap found.'),
    );
    html += card('security.txt', s.securityTxt ? `<pre class="code">${esc(s.securityTxt)}</pre>` : empty('Not published.'));
    return html;
  },

  domain(r) {
    const d = r.domain;
    if (!d) return empty('Domain data unavailable.');
    const dnsRows = Object.entries(d.dns)
      .filter(([, v]) => v.length)
      .map(([k, v]) => [code(k), v.map((x) => code(x)).join('<br>')]);
    const tls = d.tls;
    const reg = d.registration;
    const tlsHtml = tls
      ? kv([
          ['Subject', code(tls.subject)],
          ['Issuer', esc(tls.issuer)],
          ['Valid', `${esc(fmtDate(tls.validFrom))} → ${esc(fmtDate(tls.validTo))} ${badge(`${tls.daysRemaining} days left`, tls.daysRemaining > 14 ? 'ok' : 'bad')}`],
          ['Trusted', tls.authorized ? badge('yes', 'ok') : badge(tls.authorizationError || 'no', 'bad')],
          ['Protocol', code(tls.protocol)],
          ['Cipher', code(tls.cipher)],
          ['SAN names', `${tls.altNames.length}: ${tls.altNames.slice(0, 20).map(code).join(' ')}${tls.altNames.length > 20 ? ' …' : ''}`],
        ])
      : empty('Could not read the certificate.');
    const regHtml = reg
      ? kv([
          ['Registrar', esc(reg.registrar)],
          ['Registered', esc(fmtDate(reg.registered))],
          ['Expires', esc(fmtDate(reg.expires))],
          ['Updated', esc(fmtDate(reg.updated))],
          ['Nameservers', reg.nameservers.map(code).join('<br>')],
          ['Status', reg.status.map((x) => badge(x)).join(' ')],
        ])
      : empty('RDAP lookup returned nothing for this TLD.');

    return `<div class="row">${card('Domain', kv([['Host', code(d.host)], ['Root domain', code(d.rootDomain)], ['Detected services', d.services.length ? chips(d.services.map((x) => ({ value: x }))) : '–']]))}${card('Registration (RDAP)', regHtml)}</div>
      ${card('DNS records', table(['Type', 'Values'], dnsRows))}
      ${card('TLS certificate', tlsHtml)}
      ${card(
        `Subdomains from certificate logs (${d.subdomains.length})`,
        d.subdomainsError
          ? empty(d.subdomainsError)
          : `<input type="search" class="filter-input" data-filter="subs" placeholder="Filter subdomains…" aria-label="Filter subdomains"><ul class="list-mono" id="subs-list" style="margin-top:10px">${d.subdomains.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>`,
      )}`;
  },

  raw(r) {
    return card('Full report', `<pre class="code" style="max-height:70vh">${esc(JSON.stringify(stripShot(r), null, 2))}</pre>`, '<button type="button" class="btn-small" data-action="download-report">Download JSON</button>');
  },
};

const stripShot = (r) => ({ ...r, overview: r.overview ? { ...r.overview, screenshot: r.overview.screenshot ? '(omitted)' : null } : null });

/* ---------- rendering & events ---------- */

function renderTabs() {
  $('#tabs').innerHTML = TABS.map(([id, label, count]) => {
    const c = report ? count(report) : null;
    return `<button type="button" role="tab" class="tab" id="tab-${id}" data-tab="${id}" aria-selected="${id === activeTab}" aria-controls="panel">${esc(label)}${c != null ? `<span class="count">${c}</span>` : ''}</button>`;
  }).join('');
}

function renderPanel() {
  $('#panel').innerHTML = RENDER[activeTab](report);
  $('#panel').setAttribute('aria-labelledby', `tab-${activeTab}`);
}

function renderReport() {
  const o = report.overview;
  $('#result-title').textContent = o?.title || report.meta.url;
  const a = $('#result-url');
  a.href = o?.finalUrl || report.meta.url;
  a.textContent = o?.finalUrl || report.meta.url;
  $('#results').hidden = false;
  renderTabs();
  renderPanel();
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 1600);
}

function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = () => {
  try {
    return new URL(report.overview?.finalUrl || report.meta.url).hostname.replace(/[^a-z0-9.-]/gi, '_');
  } catch {
    return 'site';
  }
};

async function copy(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`Copied ${label}`);
  } catch {
    toast('Clipboard unavailable');
  }
}

document.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]');
  if (tab) {
    activeTab = tab.dataset.tab;
    renderTabs();
    renderPanel();
    $(`#tab-${activeTab}`).focus();
    return;
  }
  const c = e.target.closest('[data-copy]');
  if (c) return copy(c.dataset.copy, c.dataset.copy);

  const action = e.target.closest('[data-action]')?.dataset.action;
  if (!action || !report) return;
  if (action === 'download-report') download(`${slug()}-report.json`, JSON.stringify(report, null, 2));
  if (action === 'download-tokens') download(`${slug()}-tokens.json`, JSON.stringify(report.design.tokens, null, 2));
  if (action === 'copy-css') copy(report.design.tokensCss, 'CSS variables');
});

// Arrow-key navigation between tabs.
$('#tabs').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  const ids = TABS.map((t) => t[0]);
  const i = ids.indexOf(activeTab);
  activeTab = ids[(i + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length];
  renderTabs();
  renderPanel();
  $(`#tab-${activeTab}`).focus();
});

document.addEventListener('input', (e) => {
  const kind = e.target.dataset?.filter;
  if (!kind) return;
  const q = e.target.value.trim().toLowerCase();
  const scope = { vars: '#vars-table tbody tr', sitemap: '#sitemap-list li', subs: '#subs-list li' }[kind];
  document.querySelectorAll(scope).forEach((el) => {
    el.hidden = q && !el.textContent.toLowerCase().includes(q);
  });
});

// GitHub Pages has no backend, so the hosted demo shows a saved sample report.
const STATIC_DEMO = location.hostname.endsWith('github.io') || new URLSearchParams(location.search).has('demo');

async function loadDemo() {
  $('#demo-banner').hidden = false;
  try {
    const res = await fetch('demo/sample-report.json');
    report = await res.json();
    $('#url-input').value = report.meta.url;
    renderReport();
  } catch {
    $('#status').className = 'status error';
    $('#status').textContent = 'Could not load the demo report.';
  }
}
if (STATIC_DEMO) loadDemo();

$('#analyze-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = $('#url-input').value.trim();
  if (!url) return $('#url-input').focus();
  if (STATIC_DEMO) {
    $('#status').className = 'status';
    $('#status').textContent = 'Live analysis runs on the Node server. Clone the repo and run it locally to analyze any URL.';
    return;
  }

  const btn = $('#analyze-btn');
  const status = $('#status');
  btn.disabled = true;
  status.className = 'status';
  const started = Date.now();
  const tick = () => {
    status.innerHTML = `<span class="spinner" aria-hidden="true"></span>Rendering page, capturing traffic, reading DNS… ${Math.round((Date.now() - started) / 1000)}s`;
  };
  tick();
  const timer = setInterval(tick, 1000);

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = await res.json().catch(() => ({ error: `Server returned ${res.status}` }));
    if (!res.ok) throw new Error(data.error || `Server returned ${res.status}`);
    report = data;
    activeTab = 'overview';
    status.textContent = '';
    renderReport();
  } catch (err) {
    status.className = 'status error';
    status.textContent = err.message;
  } finally {
    clearInterval(timer);
    btn.disabled = false;
  }
});
