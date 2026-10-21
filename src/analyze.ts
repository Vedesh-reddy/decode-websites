import { rootDomain } from './lib/domain-utils.js';
import { validateTarget } from './lib/url-guard.js';
import { runBrowser, type BrowserResult } from './modules/browser.js';
import { analyzeCrawlFiles } from './modules/crawl-files.js';
import { buildDesign, cssVarNames } from './modules/design.js';
import { analyzeDomain } from './modules/domain.js';
import { buildNetwork } from './modules/network.js';
import { GLOBAL_PROBES } from './modules/signatures.js';
import { buildTech } from './modules/techstack.js';
import type { Report } from './types.js';

export async function analyze(input: string): Promise<Report> {
  const started = Date.now();
  const target = await validateTarget(input);
  const errors: Record<string, string> = {};

  const attempt = async <T>(name: string, fn: () => Promise<T> | T): Promise<T | null> => {
    try {
      return await fn();
    } catch (e) {
      errors[name] = e instanceof Error ? e.message.split('\n')[0] : String(e);
      return null;
    }
  };

  // Browser and domain lookups are independent; crawl files need the final origin.
  const [browser, domain] = await Promise.all([
    attempt('browser', () => runBrowser(target.href, GLOBAL_PROBES)),
    attempt('domain', () => analyzeDomain(target.hostname)),
  ]);

  const finalUrl = new URL(browser?.finalUrl ?? target.href);
  const crawl = await attempt('crawl', () => analyzeCrawlFiles(finalUrl.origin));
  const siteRoot = rootDomain(finalUrl.hostname);

  const design = browser ? await attempt('design', () => buildDesign(browser.rawDesign, browser.cssTexts, browser.fontFiles)) : null;
  const network = browser ? await attempt('network', () => buildNetwork(browser, siteRoot)) : null;
  const tech = browser ? await attempt('tech', () => buildTech(techInputs(browser))) : null;

  const page = browser?.page ?? null;
  const metaValue = (k: string) => page?.metas.find((m) => m.key.toLowerCase() === k)?.content ?? null;

  return {
    meta: {
      input,
      url: target.href,
      analyzedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
    },
    overview: browser
      ? {
          title: browser.page.title,
          description: metaValue('description') ?? metaValue('og:description'),
          finalUrl: browser.finalUrl,
          status: browser.status,
          redirects: browser.redirects,
          timing: browser.page.timing,
          screenshot: browser.screenshot,
          lang: browser.page.lang,
          favicon: browser.page.favicon,
        }
      : null,
    design,
    tech,
    network,
    structure: {
      page,
      robots: crawl?.robots ?? null,
      sitemap: crawl?.sitemap ?? null,
      securityTxt: crawl?.securityTxt ?? null,
    },
    domain,
    errors,
  };
}

function techInputs(b: BrowserResult) {
  const metas: Record<string, string> = {};
  for (const m of b.page.metas) metas[m.key.toLowerCase()] = m.content;
  return {
    headers: b.mainHeaders,
    cookieNames: b.cookies.map((c) => c.name),
    requestUrls: [...b.requests.map((r) => r.url), ...b.page.scripts, ...b.page.stylesheets],
    html: b.html,
    globals: b.page.globals,
    flags: b.page.flags,
    metas,
    cssVarNames: [...cssVarNames([...b.cssTexts.map((c) => c.text), b.html]), ...b.rawDesign.cssVariables.map((v) => v.name)],
  };
}
