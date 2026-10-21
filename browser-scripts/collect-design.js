// Runs inside the analyzed page (Playwright page.evaluate). Must be self-contained.
(function collectDesign(opts) {
  const maxElements = opts.maxElements || 4000;
  const extraVarNames = opts.extraVarNames || [];

  // Normalise any CSS colour (rgb, hsl, oklch, named...) to hex via a 1px canvas.
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const colorCache = new Map();
  const hex2 = (n) => n.toString(16).padStart(2, '0');
  function toHex(value) {
    if (!value) return null;
    const v = String(value).trim();
    if (!v || v === 'transparent' || v === 'none' || v.toLowerCase() === 'currentcolor') return null;
    if (colorCache.has(v)) return colorCache.get(v);
    let out = null;
    if (ctx && CSS.supports('color', v)) {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      if (d[3] > 0) out = '#' + hex2(d[0]) + hex2(d[1]) + hex2(d[2]) + (d[3] < 255 ? hex2(d[3]) : '');
    }
    colorCache.set(v, out);
    return out;
  }

  const maps = {
    text: new Map(), bg: new Map(), border: new Map(), stacks: new Map(), sizes: new Map(),
    weights: new Map(), lineHeights: new Map(), letterSpacings: new Map(), radii: new Map(),
    shadows: new Map(), spacing: new Map(), gradients: new Map(),
  };
  const bump = (m, k) => {
    if (k === null || k === undefined || k === '') return;
    m.set(k, (m.get(k) || 0) + 1);
  };
  const top = (m, n) =>
    Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([value, count]) => ({ value, count }));

  const isVisible = (el, cs) => {
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
    if (parseFloat(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 || r.height > 0;
  };
  const hasOwnText = (el) => {
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.textContent && n.textContent.trim()) return true;
    }
    return false;
  };

  const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'META', 'LINK', 'BR', 'HEAD', 'TITLE']);
  const formTags = new Set(['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT']);
  const all = document.body ? document.body.querySelectorAll('*') : [];
  let scanned = 0;

  for (const el of all) {
    if (scanned >= maxElements) break;
    if (skipTags.has(el.tagName)) continue;
    const cs = getComputedStyle(el);
    if (!isVisible(el, cs)) continue;
    scanned++;

    if (hasOwnText(el) || formTags.has(el.tagName)) {
      bump(maps.text, toHex(cs.color));
      bump(maps.stacks, cs.fontFamily);
      bump(maps.sizes, cs.fontSize);
      bump(maps.weights, cs.fontWeight);
      bump(maps.lineHeights, cs.lineHeight);
      bump(maps.letterSpacings, cs.letterSpacing);
    }
    bump(maps.bg, toHex(cs.backgroundColor));
    if (cs.backgroundImage && cs.backgroundImage.includes('gradient(')) bump(maps.gradients, cs.backgroundImage);

    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      if (parseFloat(cs['border' + side + 'Width']) > 0 && cs['border' + side + 'Style'] !== 'none') {
        bump(maps.border, toHex(cs['border' + side + 'Color']));
        break;
      }
    }
    if (cs.borderRadius && cs.borderRadius !== '0px') bump(maps.radii, cs.borderRadius);
    if (cs.boxShadow && cs.boxShadow !== 'none') bump(maps.shadows, cs.boxShadow);
    for (const p of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom', 'rowGap', 'columnGap']) {
      const v = cs[p];
      if (v && v.endsWith('px') && v !== '0px' && !v.startsWith('-')) bump(maps.spacing, v);
    }
  }

  // Typography per semantic role: first visible example of each.
  const roleSelectors = ['body', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'button', 'label', 'input', 'li', 'small'];
  const roles = [];
  for (const sel of roleSelectors) {
    const candidates = sel === 'body' ? [document.body] : document.querySelectorAll(sel);
    for (const el of candidates) {
      if (!el) continue;
      const cs = getComputedStyle(el);
      let sample = '';
      if (sel !== 'body') {
        if (!isVisible(el, cs)) continue;
        sample = (el.innerText || el.value || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 80);
        if (!sample) continue;
      }
      roles.push({
        role: sel,
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing,
        color: toHex(cs.color),
        textTransform: cs.textTransform,
        sample,
      });
      break;
    }
  }

  // CSS custom properties declared on :root / html (same-origin sheets),
  // plus names found server-side in cross-origin CSS.
  const rootSel = /(^|,)\s*(:root|html)([.[:][^\s,]*)?\s*(,|$)/i;
  const varRaw = new Map();
  const walk = (rules) => {
    for (const r of rules) {
      if (r.selectorText !== undefined && r.style && rootSel.test(r.selectorText)) {
        for (let i = 0; i < r.style.length; i++) {
          const name = r.style[i];
          if (name.startsWith('--') && !varRaw.has(name)) varRaw.set(name, r.style.getPropertyValue(name).trim());
        }
      }
      if (r.cssRules) {
        try { walk(r.cssRules); } catch (e) { /* ignore */ }
      }
    }
  };
  for (const sheet of document.styleSheets) {
    try { walk(sheet.cssRules); } catch (e) { /* cross-origin sheet */ }
  }
  for (const n of extraVarNames) if (!varRaw.has(n)) varRaw.set(n, '');

  const rootCs = getComputedStyle(document.documentElement);
  const cssVariables = [];
  for (const [name, raw] of varRaw) {
    const resolved = rootCs.getPropertyValue(name).trim();
    const value = resolved || raw;
    if (!value) continue;
    cssVariables.push({ name, value: value.slice(0, 300), hex: toHex(value) });
    if (cssVariables.length >= 800) break;
  }
  cssVariables.sort((a, b) => a.name.localeCompare(b.name));

  const loadedFonts = [];
  const seen = new Set();
  if (document.fonts) {
    document.fonts.forEach((f) => {
      const family = String(f.family).replace(/^["']|["']$/g, '');
      const key = family + '|' + f.weight + '|' + f.style;
      if (seen.has(key)) return;
      seen.add(key);
      loadedFonts.push({ family, weight: f.weight, style: f.style, status: f.status });
    });
  }

  return {
    textColors: top(maps.text, 40),
    backgroundColors: top(maps.bg, 40),
    borderColors: top(maps.border, 30),
    fontStacks: top(maps.stacks, 20),
    fontSizes: top(maps.sizes, 40),
    fontWeights: top(maps.weights, 20),
    lineHeights: top(maps.lineHeights, 30),
    letterSpacings: top(maps.letterSpacings, 20),
    radii: top(maps.radii, 20),
    shadows: top(maps.shadows, 20),
    spacing: top(maps.spacing, 40),
    gradients: top(maps.gradients, 15),
    roles,
    cssVariables,
    loadedFonts: loadedFonts.slice(0, 120),
    elementsScanned: scanned,
  };
})
