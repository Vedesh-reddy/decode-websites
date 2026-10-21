import net from 'node:net';

// Small public-suffix subset; enough for common ccTLD second levels.
const MULTI_LEVEL = new Set([
  'co.in', 'net.in', 'org.in', 'firm.in', 'gen.in', 'ind.in', 'ac.in', 'gov.in',
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk',
  'com.au', 'net.au', 'org.au', 'co.nz', 'co.jp', 'co.kr', 'co.za',
  'com.br', 'com.sg', 'com.my', 'com.mx', 'com.tr', 'com.cn', 'com.hk', 'com.ar',
]);

export function rootDomain(host: string): string {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (net.isIP(h)) return h;
  const parts = h.split('.');
  if (parts.length <= 2) return h;
  const last2 = parts.slice(-2).join('.');
  return MULTI_LEVEL.has(last2) ? parts.slice(-3).join('.') : last2;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function truncate(s: string, n = 120): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export function topCounts(map: Map<string, number>, limit: number) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}
