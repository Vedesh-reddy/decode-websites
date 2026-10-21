// Runs inside the analyzed page (Playwright page.evaluate). Must be self-contained.
(function collectPage(opts) {
  const abs = (u) => {
    try { return new URL(u, location.href).href; } catch (e) { return u; }
  };
  const clean = (s, n) => String(s || '').trim().replace(/\s+/g, ' ').slice(0, n);

  const metas = [];
  document.querySelectorAll('meta').forEach((m) => {
    const key = m.getAttribute('name') || m.getAttribute('property') || m.getAttribute('http-equiv') || m.getAttribute('itemprop') || (m.hasAttribute('charset') ? 'charset' : null);
    const content = m.hasAttribute('content') ? m.getAttribute('content') : m.getAttribute('charset');
    if (key && content !== null) metas.push({ key, content: content.slice(0, 500) });
  });

  const canonicalEl = document.querySelector('link[rel="canonical"]');
  const alternates = Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]'))
    .map((l) => ({ hreflang: l.getAttribute('hreflang') || '', href: abs(l.getAttribute('href') || '') }))
    .slice(0, 100);

  const jsonLd = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    const raw = (s.textContent || '').trim();
    const types = [];
    try {
      const collect = (o) => {
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o)) { o.forEach(collect); return; }
        const t = o['@type'];
        if (t) (Array.isArray(t) ? t : [t]).forEach((x) => types.push(String(x)));
        if (o['@graph']) collect(o['@graph']);
      };
      collect(JSON.parse(raw));
    } catch (e) {
      types.push('(invalid JSON)');
    }
    jsonLd.push({ types: Array.from(new Set(types)), raw: raw.slice(0, 5000) });
  });

  const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
    .map((h) => ({ level: Number(h.tagName[1]), text: clean(h.innerText || h.textContent, 150) }))
    .filter((h) => h.text)
    .slice(0, 80);

  const anchors = Array.from(document.querySelectorAll('a[href]'));
  let internal = 0;
  let external = 0;
  anchors.forEach((a) => {
    try {
      const u = new URL(a.getAttribute('href'), location.href);
      if (!/^https?:$/.test(u.protocol)) return;
      if (u.hostname === location.hostname) internal++;
      else external++;
    } catch (e) { /* ignore */ }
  });

  const imgs = Array.from(document.images);
  const iconEl = document.querySelector('link[rel~="icon"]') || document.querySelector('link[rel="apple-touch-icon"]');
  const manifestEl = document.querySelector('link[rel="manifest"]');

  const nav = performance.getEntriesByType('navigation')[0];
  const timing = nav
    ? {
        ttfbMs: Math.round(nav.responseStart - nav.requestStart),
        domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
        loadMs: Math.round(nav.loadEventEnd),
        transferSize: nav.transferSize || 0,
        decodedBodySize: nav.decodedBodySize || 0,
      }
    : null;

  // Runtime framework fingerprints that aren't visible in HTML.
  const w = window;
  const sample = Array.from(document.querySelectorAll('body *')).slice(0, 1500);
  const hasKey = (prefixes) => sample.some((el) => Object.keys(el).some((k) => prefixes.some((p) => k.startsWith(p))));
  const flags = {};
  flags.react = !!document.querySelector('[data-reactroot], [data-reactid]') ||
    hasKey(['__reactFiber', '__reactContainer', '_reactRootContainer', '__reactProps']);
  const vueApp = document.querySelector('[data-v-app]');
  flags.vue = vueApp && vueApp.__vue_app__ && vueApp.__vue_app__.version
    ? vueApp.__vue_app__.version
    : !!w.__VUE__ || !!vueApp || hasKey(['__vue__', '__vue_app__', '__vnode']);
  const ng = document.querySelector('[ng-version]');
  flags.angular = ng ? ng.getAttribute('ng-version') : !!w.getAllAngularRootElements || !!document.querySelector('[ng-app], [data-ng-app]');
  flags.jquery = w.jQuery && w.jQuery.fn ? (w.jQuery.fn.jquery || true) : false;
  flags.bootstrap = (w.bootstrap && w.bootstrap.Tooltip && w.bootstrap.Tooltip.VERSION) ||
    (w.jQuery && w.jQuery.fn && w.jQuery.fn.tooltip && w.jQuery.fn.tooltip.Constructor && w.jQuery.fn.tooltip.Constructor.VERSION) || false;
  flags.svelte = !!document.querySelector('[class*="svelte-"]');
  flags.alpine = !!document.querySelector('[x-data]');
  flags.htmx = !!document.querySelector('[hx-get], [hx-post], [hx-trigger]');

  const globals = (opts.globals || []).filter((n) => {
    try { return typeof w[n] !== 'undefined'; } catch (e) { return false; }
  });

  return {
    title: clean(document.title, 300),
    lang: document.documentElement.getAttribute('lang') || null,
    metas,
    canonical: canonicalEl ? abs(canonicalEl.getAttribute('href') || '') : null,
    alternates,
    jsonLd,
    headings,
    links: { total: anchors.length, internal, external },
    images: { total: imgs.length, missingAlt: imgs.filter((i) => !i.hasAttribute('alt')).length },
    forms: document.forms.length,
    iframes: Array.from(document.querySelectorAll('iframe[src]')).map((f) => abs(f.getAttribute('src'))).slice(0, 50),
    scripts: Array.from(document.scripts).filter((s) => s.src).map((s) => s.src).slice(0, 200),
    inlineScripts: Array.from(document.scripts).filter((s) => !s.src).length,
    stylesheets: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((l) => abs(l.getAttribute('href') || '')).slice(0, 100),
    manifest: manifestEl ? abs(manifestEl.getAttribute('href') || '') : null,
    favicon: iconEl ? abs(iconEl.getAttribute('href') || '') : abs('/favicon.ico'),
    timing,
    flags,
    globals,
  };
})
