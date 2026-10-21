import type { Counted, DesignReport, FontFaceRule, RawDesign } from '../types.js';
import { topCounts } from '../lib/domain-utils.js';

/** Every custom property name declared in the given CSS/HTML text. */
export function cssVarNames(texts: string[]): string[] {
  const names = new Set<string>();
  for (const t of texts) {
    for (const m of t.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) {
      names.add(m[1]);
      if (names.size >= 2000) return [...names];
    }
  }
  return [...names];
}

const unquote = (s: string) => s.trim().replace(/^["']|["']$/g, '');

function parseFontFaces(cssTexts: { url: string; text: string }[]): FontFaceRule[] {
  const out = new Map<string, FontFaceRule>();
  for (const { url, text } of cssTexts) {
    for (const block of text.matchAll(/@font-face\s*\{([^}]*)\}/gi)) {
      const body = block[1];
      const family = body.match(/font-family\s*:\s*([^;]+)/i)?.[1];
      if (!family) continue;
      const weight = body.match(/font-weight\s*:\s*([^;]+)/i)?.[1]?.trim() ?? 'normal';
      const style = body.match(/font-style\s*:\s*([^;]+)/i)?.[1]?.trim() ?? 'normal';
      const sources: string[] = [];
      for (const s of body.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
        if (s[2].startsWith('data:')) {
          sources.push('(inline data URI)');
        } else {
          try {
            sources.push(new URL(s[2], url).href);
          } catch {
            sources.push(s[2]);
          }
        }
        if (sources.length >= 3) break;
      }
      const rule = { family: unquote(family), weight, style, sources };
      const key = `${rule.family}|${weight}|${style}`;
      if (!out.has(key)) out.set(key, rule);
      if (out.size >= 150) return [...out.values()];
    }
  }
  return [...out.values()];
}

const px = (v: string) => parseFloat(v);
const tokenKey = (v: string) => String(px(v)).replace('.', '_');

function buildTokens(d: Omit<DesignReport, 'tokens' | 'tokensCss'>) {
  const color: Record<string, string> = {};
  d.palette.slice(0, 16).forEach((c, i) => (color[`color-${i + 1}`] = c.value));

  const font: Record<string, string> = {};
  d.fontStacks.slice(0, 4).forEach((f, i) => (font[`font-${i + 1}`] = f.value));

  const fontSize: Record<string, string> = {};
  [...new Set(d.fontSizes.slice(0, 14).map((s) => s.value))]
    .filter((v) => v.endsWith('px'))
    .sort((a, b) => px(b) - px(a))
    .forEach((v) => (fontSize[`text-${tokenKey(v)}`] = v));

  const fontWeight: Record<string, string> = {};
  [...new Set(d.fontWeights.map((w) => w.value))]
    .sort((a, b) => Number(a) - Number(b))
    .forEach((w) => (fontWeight[`weight-${w}`] = w));

  const radius: Record<string, string> = {};
  d.radii.slice(0, 6).forEach((r, i) => (radius[`radius-${i + 1}`] = r.value));

  const shadow: Record<string, string> = {};
  d.shadows.slice(0, 4).forEach((s, i) => (shadow[`shadow-${i + 1}`] = s.value));

  const spacing: Record<string, string> = {};
  [...new Set(d.spacing.slice(0, 14).map((s) => s.value))]
    .sort((a, b) => px(a) - px(b))
    .forEach((v) => (spacing[`space-${tokenKey(v)}`] = v));

  const tokens = { color, font, fontSize, fontWeight, radius, shadow, spacing };
  const lines = Object.entries(tokens).flatMap(([group, entries]) => [
    `  /* ${group} */`,
    ...Object.entries(entries).map(([k, v]) => `  --${k}: ${v};`),
  ]);
  return { tokens, tokensCss: `:root {\n${lines.join('\n')}\n}\n` };
}

export function buildDesign(
  raw: RawDesign,
  cssTexts: { url: string; text: string }[],
  fontFiles: string[],
): DesignReport {
  const merged = new Map<string, number>();
  for (const list of [raw.textColors, raw.backgroundColors, raw.borderColors]) {
    for (const c of list) merged.set(c.value, (merged.get(c.value) ?? 0) + c.count);
  }
  const palette: Counted[] = topCounts(merged, 32);

  const families = new Map<string, number>();
  for (const s of raw.fontStacks) {
    const primary = unquote(s.value.split(',')[0] ?? s.value);
    families.set(primary, (families.get(primary) ?? 0) + s.count);
  }

  const base = {
    ...raw,
    palette,
    fontFamilies: topCounts(families, 20),
    fontFaces: parseFontFaces(cssTexts),
    fontFiles: fontFiles.slice(0, 100),
  };
  return { ...base, ...buildTokens(base) };
}
