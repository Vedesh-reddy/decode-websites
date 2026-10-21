import dns from 'node:dns/promises';
import net from 'node:net';

// The server fetches arbitrary URLs, so block internal addresses (SSRF).
// Set ALLOW_PRIVATE=true only for local development against localhost.
const allowPrivate = () => process.env.ALLOW_PRIVATE === 'true';

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6 === '::' || v6 === '::1') return true;
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIp(mapped[1]);
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v6);
}

const cache = new Map<string, Promise<boolean>>();

export function isPublicHost(hostname: string): Promise<boolean> {
  if (allowPrivate()) return Promise.resolve(true);
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    return Promise.resolve(false);
  }
  if (net.isIP(host)) return Promise.resolve(!isPrivateIp(host));
  let hit = cache.get(host);
  if (!hit) {
    hit = dns
      .lookup(host, { all: true })
      .then((addrs) => addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address)))
      .catch(() => false);
    cache.set(host, hit);
    if (cache.size > 5000) cache.clear();
  }
  return hit;
}

export async function validateTarget(input: string): Promise<URL> {
  let raw = input.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('That does not look like a valid URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https URLs are supported.');
  }
  if (url.username || url.password) throw new Error('URLs with credentials are not allowed.');
  if (!(await isPublicHost(url.hostname))) {
    throw new Error('Host is private, internal or could not be resolved.');
  }
  url.hash = '';
  return url;
}
