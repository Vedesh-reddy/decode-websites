import { fetchText } from '../lib/http.js';
import { topCounts } from '../lib/domain-utils.js';
import type { RobotsInfo, SitemapInfo } from '../types.js';

const looksLikeHtml = (t: string) => /^\s*<(!doctype|html)/i.test(t);

function parseRobots(text: string): RobotsInfo {
  const sitemaps = new Set<string>();
  const disallow = new Set<string>();
  const allow = new Set<string>();
  const userAgents = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const m = line.replace(/#.*$/, '').trim().match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (!value) continue;
    if (key === 'sitemap') sitemaps.add(value);
    else if (key === 'disallow') disallow.add(value);
    else if (key === 'allow') allow.add(value);
    else if (key === 'user-agent') userAgents.add(value);
  }
  return {
    sitemaps: [...sitemaps].slice(0, 20),
    disallow: [...disallow].slice(0, 300),
    allow: [...allow].slice(0, 150),
    userAgents: [...userAgents].slice(0, 50),
    raw: text.slice(0, 20_000),
  };
}

const decodeXml = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

async function readSitemaps(candidates: string[]): Promise<SitemapInfo | null> {
  const MAX_FETCHES = 6;
  const MAX_URLS = 2000;
  const urls = new Set<string>();
  const sources: string[] = [];
  const queue = candidates.slice(0, 3);
  let fetches = 0;

  while (queue.length && fetches < MAX_FETCHES && urls.size < MAX_URLS) {
    const sm = queue.shift()!;
    fetches++;
    const r = await fetchText(sm, { timeoutMs: 15_000, maxBytes: 20_000_000 });
    if (!r || r.status >= 400 || !/<(urlset|sitemapindex)\b/i.test(r.text)) continue;
    sources.push(sm);
    const locs = [...r.text.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\]\s]+)\s*(?:\]\]>)?\s*<\/loc>/gi)].map((m) => decodeXml(m[1]));
    if (/<sitemapindex\b/i.test(r.text)) {
      queue.push(...locs.slice(0, 10));
    } else {
      for (const l of locs) {
        if (urls.size >= MAX_URLS) break;
        urls.add(l);
      }
    }
  }
  if (!sources.length) return null;

  const sections = new Map<string, number>();
  for (const u of urls) {
    try {
      const seg = new URL(u).pathname.split('/').filter(Boolean)[0];
      const key = seg ? `/${seg}` : '/';
      sections.set(key, (sections.get(key) ?? 0) + 1);
    } catch {
      /* skip malformed */
    }
  }
  return {
    sources,
    urlCount: urls.size,
    urls: [...urls].slice(0, 500),
    sections: topCounts(sections, 30),
    truncated: urls.size >= MAX_URLS || queue.length > 0,
  };
}

export async function analyzeCrawlFiles(origin: string) {
  const [robotsRes, securityRes] = await Promise.all([
    fetchText(`${origin}/robots.txt`),
    fetchText(`${origin}/.well-known/security.txt`),
  ]);

  const robots =
    robotsRes && robotsRes.status < 400 && !looksLikeHtml(robotsRes.text) ? parseRobots(robotsRes.text) : null;
  const candidates = robots?.sitemaps.length ? robots.sitemaps : [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  const sitemap = await readSitemaps(candidates);
  const securityTxt =
    securityRes && securityRes.status < 400 && /contact\s*:/i.test(securityRes.text) && !looksLikeHtml(securityRes.text)
      ? securityRes.text.slice(0, 5000)
      : null;

  return { robots, sitemap, securityTxt };
}
