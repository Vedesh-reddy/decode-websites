export interface Counted {
  value: string;
  count: number;
}

export interface TextStyle {
  role: string;
  fontFamily: string;
  fontSize: string;
  fontWeight: string;
  lineHeight: string;
  letterSpacing: string;
  color: string | null;
  textTransform: string;
  sample: string;
}

export interface CssVariable {
  name: string;
  value: string;
  hex: string | null;
}

export interface LoadedFont {
  family: string;
  weight: string;
  style: string;
  status: string;
}

/** Shape returned by browser-scripts/collect-design.js */
export interface RawDesign {
  textColors: Counted[];
  backgroundColors: Counted[];
  borderColors: Counted[];
  fontStacks: Counted[];
  fontSizes: Counted[];
  fontWeights: Counted[];
  lineHeights: Counted[];
  letterSpacings: Counted[];
  radii: Counted[];
  shadows: Counted[];
  spacing: Counted[];
  gradients: Counted[];
  roles: TextStyle[];
  cssVariables: CssVariable[];
  loadedFonts: LoadedFont[];
  elementsScanned: number;
}

export interface FontFaceRule {
  family: string;
  weight: string;
  style: string;
  sources: string[];
}

export interface DesignReport extends RawDesign {
  palette: Counted[];
  fontFamilies: Counted[];
  fontFaces: FontFaceRule[];
  fontFiles: string[];
  tokens: Record<string, Record<string, string>>;
  tokensCss: string;
}

export interface PageTiming {
  ttfbMs: number;
  domContentLoadedMs: number;
  loadMs: number;
  transferSize: number;
  decodedBodySize: number;
}

/** Shape returned by browser-scripts/collect-page.js */
export interface PageInfo {
  title: string;
  lang: string | null;
  metas: { key: string; content: string }[];
  canonical: string | null;
  alternates: { hreflang: string; href: string }[];
  jsonLd: { types: string[]; raw: string }[];
  headings: { level: number; text: string }[];
  links: { total: number; internal: number; external: number };
  images: { total: number; missingAlt: number };
  forms: number;
  iframes: string[];
  scripts: string[];
  inlineScripts: number;
  stylesheets: string[];
  manifest: string | null;
  favicon: string | null;
  timing: PageTiming | null;
  flags: Record<string, string | boolean>;
  globals: string[];
}

export interface ApiCall {
  method: string;
  url: string;
  host: string;
  path: string;
  query: string;
  status: number;
  contentType: string;
  resourceType: string;
  requestBody: string | null;
  responsePreview: string | null;
  hasAuthHeader: boolean;
  graphqlOperation: string | null;
}

export interface Endpoint {
  method: string;
  host: string;
  path: string;
  count: number;
  statuses: number[];
  contentType: string;
  graphqlOperations: string[];
  firstParty: boolean;
  sample: ApiCall;
}

export interface CookieInfo {
  name: string;
  domain: string;
  path: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string;
  expires: string;
  valuePreview: string;
  firstParty: boolean;
}

export interface NetworkReport {
  totalRequests: number;
  failedRequests: number;
  byType: Counted[];
  firstPartyRequests: number;
  thirdPartyRequests: number;
  thirdPartyHosts: { host: string; count: number; types: string[] }[];
  endpoints: Endpoint[];
  websockets: string[];
  cookies: CookieInfo[];
}

export interface DetectedTech {
  name: string;
  category: string;
  version: string | null;
  evidence: string[];
}

export interface TechReport {
  detected: DetectedTech[];
  securityHeaders: { header: string; present: boolean; value: string | null }[];
  responseHeaders: { name: string; value: string }[];
}

export interface RobotsInfo {
  sitemaps: string[];
  disallow: string[];
  allow: string[];
  userAgents: string[];
  raw: string;
}

export interface SitemapInfo {
  sources: string[];
  urlCount: number;
  urls: string[];
  sections: Counted[];
  truncated: boolean;
}

export interface StructureReport {
  page: PageInfo | null;
  robots: RobotsInfo | null;
  sitemap: SitemapInfo | null;
  securityTxt: string | null;
}

export interface CertInfo {
  subject: string | null;
  issuer: string | null;
  validFrom: string;
  validTo: string;
  daysRemaining: number;
  altNames: string[];
  protocol: string | null;
  cipher: string | null;
  authorized: boolean;
  authorizationError: string | null;
}

export interface RegistrationInfo {
  registrar: string | null;
  registered: string | null;
  expires: string | null;
  updated: string | null;
  nameservers: string[];
  status: string[];
}

export interface DomainReport {
  host: string;
  rootDomain: string;
  dns: Record<string, string[]>;
  services: string[];
  tls: CertInfo | null;
  registration: RegistrationInfo | null;
  subdomains: string[];
  subdomainsError: string | null;
}

export interface Overview {
  title: string;
  description: string | null;
  finalUrl: string;
  status: number;
  redirects: { url: string; status: number }[];
  timing: PageTiming | null;
  screenshot: string | null;
  lang: string | null;
  favicon: string | null;
}

export interface Report {
  meta: {
    input: string;
    url: string;
    analyzedAt: string;
    durationMs: number;
  };
  overview: Overview | null;
  design: DesignReport | null;
  tech: TechReport | null;
  network: NetworkReport | null;
  structure: StructureReport;
  domain: DomainReport | null;
  errors: Record<string, string>;
}
