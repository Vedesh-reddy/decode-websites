import { hostOf, rootDomain, topCounts, truncate } from '../lib/domain-utils.js';
import type { CookieInfo, Endpoint, NetworkReport } from '../types.js';
import type { BrowserResult } from './browser.js';

// Collapse IDs so /api/product/123 and /api/product/456 group together.
export function normalizePath(p: string): string {
  return p
    .split('/')
    .map((seg) => {
      if (/^\d+$/.test(seg)) return ':id';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return ':uuid';
      if (/^[0-9a-f]{24,}$/i.test(seg)) return ':hash';
      return seg;
    })
    .join('/');
}

export function buildNetwork(b: BrowserResult, siteRoot: string): NetworkReport {
  const isFirst = (host: string) => rootDomain(host) === siteRoot;
  const byType = new Map<string, number>();
  const thirdParty = new Map<string, { count: number; types: Set<string> }>();
  let first = 0;
  let third = 0;
  let failed = 0;

  for (const r of b.requests) {
    byType.set(r.resourceType, (byType.get(r.resourceType) ?? 0) + 1);
    if (r.status === null) failed++;
    const host = hostOf(r.url);
    if (!host) continue;
    if (isFirst(host)) {
      first++;
    } else {
      third++;
      const entry = thirdParty.get(host) ?? { count: 0, types: new Set<string>() };
      entry.count++;
      entry.types.add(r.resourceType);
      thirdParty.set(host, entry);
    }
  }

  const groups = new Map<string, Endpoint>();
  for (const call of b.apiCalls) {
    const path = normalizePath(call.path);
    const key = `${call.method} ${call.host}${path}`;
    const g = groups.get(key);
    if (!g) {
      groups.set(key, {
        method: call.method,
        host: call.host,
        path,
        count: 1,
        statuses: [call.status],
        contentType: call.contentType,
        graphqlOperations: call.graphqlOperation ? [call.graphqlOperation] : [],
        firstParty: isFirst(call.host),
        sample: call,
      });
      continue;
    }
    g.count++;
    if (!g.statuses.includes(call.status)) g.statuses.push(call.status);
    if (call.graphqlOperation && !g.graphqlOperations.includes(call.graphqlOperation)) g.graphqlOperations.push(call.graphqlOperation);
  }

  const cookies: CookieInfo[] = b.cookies.map((c) => ({
    name: c.name,
    domain: c.domain,
    path: c.path,
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: c.sameSite,
    expires: c.expires > 0 ? new Date(c.expires * 1000).toISOString() : 'session',
    valuePreview: truncate(c.value, 40),
    firstParty: isFirst(c.domain.replace(/^\./, '')),
  }));

  return {
    totalRequests: b.requests.length,
    failedRequests: failed,
    byType: topCounts(byType, 20),
    firstPartyRequests: first,
    thirdPartyRequests: third,
    thirdPartyHosts: [...thirdParty.entries()]
      .map(([host, v]) => ({ host, count: v.count, types: [...v.types] }))
      .sort((a, b2) => b2.count - a.count)
      .slice(0, 100),
    endpoints: [...groups.values()].sort((a, b2) => Number(b2.firstParty) - Number(a.firstParty) || b2.count - a.count),
    websockets: b.websockets,
    cookies: cookies.sort((a, b2) => Number(b2.firstParty) - Number(a.firstParty) || a.name.localeCompare(b2.name)),
  };
}
