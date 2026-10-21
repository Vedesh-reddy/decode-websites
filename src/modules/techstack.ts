import { truncate } from '../lib/domain-utils.js';
import type { DetectedTech, TechReport } from '../types.js';
import { SIGNATURES } from './signatures.js';

export interface TechInputs {
  headers: Record<string, string>;
  cookieNames: string[];
  requestUrls: string[];
  html: string;
  globals: string[];
  flags: Record<string, string | boolean>;
  metas: Record<string, string>;
  cssVarNames: string[];
}

const SECURITY_HEADERS = [
  'strict-transport-security',
  'content-security-policy',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'cross-origin-opener-policy',
];

const isVersion = (v: string | undefined) => !!v && /^\d+(\.\d+)*$/.test(v);

export function detectTech(input: TechInputs): DetectedTech[] {
  const out: DetectedTech[] = [];
  for (const sig of SIGNATURES) {
    const evidence: string[] = [];
    let version: string | null = null;

    for (const [h, re] of Object.entries(sig.headers ?? {})) {
      const v = input.headers[h];
      if (v !== undefined && re.test(v)) evidence.push(`header ${h}: ${truncate(v, 80)}`);
    }
    for (const re of sig.cookies ?? []) {
      const c = input.cookieNames.find((n) => re.test(n));
      if (c) evidence.push(`cookie ${c}`);
    }
    for (const re of sig.urls ?? []) {
      const u = input.requestUrls.find((x) => re.test(x));
      if (!u) continue;
      evidence.push(`request ${truncate(u, 100)}`);
      const m = u.match(re)?.[1];
      if (!version && isVersion(m)) version = m!;
    }
    for (const re of sig.html ?? []) {
      if (re.test(input.html)) evidence.push(`html /${re.source}/`);
    }
    for (const g of sig.globals ?? []) {
      if (input.globals.includes(g)) evidence.push(`window.${g}`);
    }
    for (const f of sig.flags ?? []) {
      const v = input.flags[f];
      if (!v) continue;
      evidence.push(`runtime check: ${f}`);
      if (!version && typeof v === 'string') version = v;
    }
    for (const [k, re] of Object.entries(sig.meta ?? {})) {
      const v = input.metas[k];
      if (!v || !re.test(v)) continue;
      evidence.push(`meta ${k}: ${truncate(v, 80)}`);
      const m = v.match(/(\d+(?:\.\d+)+)/)?.[1];
      if (!version && m) version = m;
    }
    for (const re of sig.cssVars ?? []) {
      const n = input.cssVarNames.find((x) => re.test(x));
      if (n) evidence.push(`css variable ${n}`);
    }
    if (evidence.length) out.push({ name: sig.name, category: sig.category, version, evidence: evidence.slice(0, 6) });
  }
  return out.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

export function buildTech(input: TechInputs): TechReport {
  return {
    detected: detectTech(input),
    securityHeaders: SECURITY_HEADERS.map((h) => ({
      header: h,
      present: h in input.headers,
      value: input.headers[h] ?? null,
    })),
    responseHeaders: Object.entries(input.headers)
      .map(([name, value]) => ({
        name,
        value: name === 'set-cookie' ? value.split('\n').map((c) => c.split('=')[0]).join(', ') + ' (values hidden)' : truncate(value, 300),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}
