import { gunzipSync } from 'node:zlib';
import { isPublicHost } from './url-guard.js';

export interface FetchResult {
  status: number;
  text: string;
  finalUrl: string;
  contentType: string;
}

const UA = 'SiteRecon/1.0 (+passive website analysis)';

export async function fetchText(
  url: string,
  opts: { timeoutMs?: number; maxBytes?: number; accept?: string } = {},
): Promise<FetchResult | null> {
  try {
    if (!(await isPublicHost(new URL(url).hostname))) return null;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
      headers: { 'user-agent': UA, accept: opts.accept ?? '*/*' },
      redirect: 'follow',
    });
    let data: Buffer = Buffer.from(await res.arrayBuffer()).subarray(0, opts.maxBytes ?? 5_000_000);
    // Sitemaps are often served as raw .gz files without content-encoding.
    if (data[0] === 0x1f && data[1] === 0x8b) {
      try {
        data = gunzipSync(data);
      } catch {
        /* truncated or not gzip */
      }
    }
    return {
      status: res.status,
      text: data.toString('utf8'),
      finalUrl: res.url,
      contentType: res.headers.get('content-type') ?? '',
    };
  } catch {
    return null;
  }
}

export async function fetchJson<T>(url: string, timeoutMs = 15_000): Promise<T | null> {
  const r = await fetchText(url, { timeoutMs, accept: 'application/json, application/rdap+json' });
  if (!r || r.status >= 400) return null;
  try {
    return JSON.parse(r.text) as T;
  } catch {
    return null;
  }
}
