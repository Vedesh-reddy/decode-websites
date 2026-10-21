import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page, type Response } from 'playwright';
import { isPublicHost } from '../lib/url-guard.js';
import type { ApiCall, PageInfo, RawDesign } from '../types.js';
import { cssVarNames } from './design.js';

const scriptsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../browser-scripts');
const loadScript = (name: string) => readFileSync(path.join(scriptsDir, name), 'utf8').trim().replace(/;\s*$/, '');
const DESIGN_SCRIPT = loadScript('collect-design.js');
const PAGE_SCRIPT = loadScript('collect-page.js');

const TEXT_BODY = /json|text|javascript|xml|graphql|x-www-form-urlencoded/i;
const MAX_REQUESTS = 3000;
const MAX_API_CALLS = 400;

export interface RawRequest {
  url: string;
  resourceType: string;
  status: number | null;
  method: string;
}

export interface RawCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string;
}

export interface BrowserResult {
  finalUrl: string;
  status: number;
  redirects: { url: string; status: number }[];
  mainHeaders: Record<string, string>;
  html: string;
  screenshot: string | null;
  page: PageInfo;
  rawDesign: RawDesign;
  cssTexts: { url: string; text: string }[];
  fontFiles: string[];
  requests: RawRequest[];
  apiCalls: ApiCall[];
  websockets: string[];
  cookies: RawCookie[];
}

function evalScript<T>(page: Page, script: string, arg: unknown): Promise<T> {
  return page.evaluate(`(${script})(${JSON.stringify(arg)})`) as Promise<T>;
}

async function autoScroll(page: Page) {
  // Triggers lazy-loaded sections, images and their API calls.
  await page
    .evaluate(`(async () => {
      if (!document.body) return;
      for (let i = 0; i < 12; i++) {
        window.scrollBy(0, window.innerHeight);
        await new Promise((r) => setTimeout(r, 250));
        if (window.scrollY + window.innerHeight >= document.body.scrollHeight) break;
      }
      window.scrollTo(0, 0);
    })()`)
    .catch(() => {});
}

function detectGraphql(url: URL, postData: string | null): string | null {
  if (!/graphql/i.test(url.pathname) && !(postData && /"query"\s*:/.test(postData))) return null;
  if (!postData) return url.searchParams.get('operationName') ?? 'anonymous';
  try {
    const body = JSON.parse(postData);
    const one = Array.isArray(body) ? body[0] : body;
    if (one?.operationName) return String(one.operationName);
    if (typeof one?.query === 'string') return one.query.match(/(?:query|mutation|subscription)\s+(\w+)/)?.[1] ?? 'anonymous';
  } catch {
    /* not JSON */
  }
  return 'anonymous';
}

export async function runBrowser(url: string, globals: string[]): Promise<BrowserResult> {
  // CHROMIUM_PATH lets you point at an installed Chrome/Chromium instead of Playwright's download.
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    const userAgent = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browser.version()} Safari/537.36`;
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent,
      locale: 'en-US',
      ignoreHTTPSErrors: true,
    });

    await context.route('**/*', async (route) => {
      const req = route.request();
      if (req.resourceType() === 'media') return route.abort();
      let u: URL;
      try {
        u = new URL(req.url());
      } catch {
        return route.continue();
      }
      if ((u.protocol === 'http:' || u.protocol === 'https:') && !(await isPublicHost(u.hostname))) {
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });

    const page = await context.newPage();
    const requests: RawRequest[] = [];
    const apiCalls: ApiCall[] = [];
    const cssTexts: { url: string; text: string }[] = [];
    const fontFiles = new Set<string>();
    const websockets: string[] = [];
    const pending: Promise<void>[] = [];

    const handleResponse = async (res: Response) => {
      const req = res.request();
      const type = req.resourceType();
      const resUrl = res.url();
      if (requests.length < MAX_REQUESTS) {
        requests.push({ url: resUrl, resourceType: type, status: res.status(), method: req.method() });
      }
      if (type === 'font') {
        fontFiles.add(resUrl);
        return;
      }
      if (type === 'stylesheet') {
        if (cssTexts.length < 80 && res.status() < 300) {
          try {
            cssTexts.push({ url: resUrl, text: (await res.text()).slice(0, 3_000_000) });
          } catch {
            /* body unavailable */
          }
        }
        return;
      }
      if ((type !== 'xhr' && type !== 'fetch') || apiCalls.length >= MAX_API_CALLS) return;

      const contentType = (res.headers()['content-type'] ?? '').split(';')[0].trim();
      let responsePreview: string | null = null;
      const status = res.status();
      if (TEXT_BODY.test(contentType) && (status < 300 || status >= 400)) {
        try {
          responsePreview = (await res.text()).slice(0, 2000);
        } catch {
          /* body unavailable */
        }
      }
      const postData = req.postData();
      const u = new URL(resUrl);
      apiCalls.push({
        method: req.method(),
        url: resUrl,
        host: u.hostname,
        path: u.pathname,
        query: u.search.slice(0, 500),
        status,
        contentType,
        resourceType: type,
        requestBody: postData ? postData.slice(0, 2000) : null,
        responsePreview,
        hasAuthHeader: 'authorization' in req.headers(),
        graphqlOperation: detectGraphql(u, postData),
      });
    };

    page.on('response', (res) => {
      pending.push(handleResponse(res).catch(() => {}));
    });
    page.on('requestfailed', (req) => {
      if (requests.length < MAX_REQUESTS) {
        requests.push({ url: req.url(), resourceType: req.resourceType(), status: null, method: req.method() });
      }
    });
    page.on('websocket', (ws) => {
      if (websockets.length < 50) websockets.push(ws.url());
    });

    const mainRes = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    if (!mainRes) throw new Error('The page returned no response.');
    await page.waitForLoadState('load', { timeout: 20_000 }).catch(() => {});
    await autoScroll(page);
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.evaluate('document.fonts ? document.fonts.ready.then(() => true) : true').catch(() => {});
    await page.waitForTimeout(800);

    const redirects: { url: string; status: number }[] = [];
    let prev = mainRes.request().redirectedFrom();
    while (prev) {
      const r = await prev.response();
      redirects.unshift({ url: prev.url(), status: r?.status() ?? 0 });
      prev = prev.redirectedFrom();
    }

    const screenshot = await page
      .screenshot({ type: 'jpeg', quality: 60 })
      .then((b) => `data:image/jpeg;base64,${b.toString('base64')}`)
      .catch(() => null);

    await Promise.allSettled(pending.slice());
    const html = (await page.content()).slice(0, 1_500_000);
    const extraVarNames = cssVarNames([...cssTexts.map((c) => c.text), html]);

    const rawDesign = await evalScript<RawDesign>(page, DESIGN_SCRIPT, { maxElements: 4000, extraVarNames });
    const pageInfo = await evalScript<PageInfo>(page, PAGE_SCRIPT, { globals });
    const cookies = (await context.cookies()) as RawCookie[];
    const mainHeaders = await mainRes.allHeaders();

    await Promise.allSettled(pending.slice());

    return {
      finalUrl: page.url(),
      status: mainRes.status(),
      redirects,
      mainHeaders,
      html,
      screenshot,
      page: pageInfo,
      rawDesign,
      cssTexts,
      fontFiles: [...fontFiles],
      requests,
      apiCalls,
      websockets,
      cookies,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}
