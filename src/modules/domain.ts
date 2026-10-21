import dns from 'node:dns/promises';
import net from 'node:net';
import tls from 'node:tls';
import { fetchJson } from '../lib/http.js';
import { rootDomain } from '../lib/domain-utils.js';
import type { CertInfo, DomainReport, RegistrationInfo } from '../types.js';

const SERVICE_PATTERNS: { type: string; re: RegExp; name: string }[] = [
  { type: 'MX', re: /google\.com|googlemail\.com/i, name: 'Google Workspace (email)' },
  { type: 'MX', re: /outlook\.com/i, name: 'Microsoft 365 (email)' },
  { type: 'MX', re: /zoho/i, name: 'Zoho Mail' },
  { type: 'MX', re: /mimecast/i, name: 'Mimecast' },
  { type: 'MX', re: /pphosted|proofpoint/i, name: 'Proofpoint' },
  { type: 'MX', re: /secureserver\.net/i, name: 'GoDaddy email' },
  { type: 'TXT', re: /google-site-verification/i, name: 'Google Search Console' },
  { type: 'TXT', re: /^MS=/, name: 'Microsoft 365' },
  { type: 'TXT', re: /_spf\.google\.com/i, name: 'Google Workspace (SPF)' },
  { type: 'TXT', re: /spf\.protection\.outlook\.com/i, name: 'Microsoft 365 (SPF)' },
  { type: 'TXT', re: /facebook-domain-verification/i, name: 'Meta Business' },
  { type: 'TXT', re: /apple-domain-verification/i, name: 'Apple' },
  { type: 'TXT', re: /atlassian-domain-verification/i, name: 'Atlassian' },
  { type: 'TXT', re: /docusign/i, name: 'DocuSign' },
  { type: 'TXT', re: /zoho-verification|zoho\.com/i, name: 'Zoho' },
  { type: 'TXT', re: /adobe-idp-site-verification/i, name: 'Adobe' },
  { type: 'TXT', re: /hubspot|hs-site-verification/i, name: 'HubSpot' },
  { type: 'TXT', re: /salesforce\.com/i, name: 'Salesforce (SPF)' },
  { type: 'TXT', re: /mcsv\.net|mailchimp/i, name: 'Mailchimp' },
  { type: 'TXT', re: /sendgrid\.net/i, name: 'SendGrid' },
  { type: 'TXT', re: /mailgun/i, name: 'Mailgun' },
  { type: 'TXT', re: /amazonses/i, name: 'Amazon SES' },
  { type: 'TXT', re: /stripe-verification/i, name: 'Stripe' },
  { type: 'NS', re: /cloudflare/i, name: 'Cloudflare DNS' },
  { type: 'NS', re: /awsdns/i, name: 'AWS Route 53' },
  { type: 'NS', re: /azure-dns/i, name: 'Azure DNS' },
  { type: 'NS', re: /domaincontrol\.com/i, name: 'GoDaddy DNS' },
  { type: 'NS', re: /googledomains|ns-cloud/i, name: 'Google Cloud DNS' },
  { type: 'NS', re: /akam/i, name: 'Akamai DNS' },
  { type: 'NS', re: /nsone/i, name: 'NS1' },
  { type: 'NS', re: /ultradns/i, name: 'UltraDNS' },
  { type: 'NS', re: /registrar-servers/i, name: 'Namecheap DNS' },
  { type: 'CNAME', re: /cloudfront\.net/i, name: 'Amazon CloudFront' },
  { type: 'CNAME', re: /edgekey|akamaiedge|edgesuite/i, name: 'Akamai' },
  { type: 'CNAME', re: /fastly/i, name: 'Fastly' },
  { type: 'CNAME', re: /azureedge|azurefd/i, name: 'Azure Front Door / CDN' },
  { type: 'CNAME', re: /vercel/i, name: 'Vercel' },
  { type: 'CNAME', re: /netlify/i, name: 'Netlify' },
  { type: 'CNAME', re: /myshopify/i, name: 'Shopify' },
  { type: 'CNAME', re: /demandware\.net|commercecloud\.salesforce/i, name: 'Salesforce Commerce Cloud' },
  { type: 'CNAME', re: /herokudns|herokuapp/i, name: 'Heroku' },
  { type: 'CNAME', re: /github\.io/i, name: 'GitHub Pages' },
  { type: 'CNAME', re: /cdn\.cloudflare\.net/i, name: 'Cloudflare' },
];

const safe = async <T>(p: Promise<T>, fallback: T): Promise<T> => {
  try {
    return await p;
  } catch {
    return fallback;
  }
};

async function dnsRecords(host: string, root: string): Promise<Record<string, string[]>> {
  const [a, aaaa, cname, mx, txt, ns, dmarc] = await Promise.all([
    safe(dns.resolve4(host), [] as string[]),
    safe(dns.resolve6(host), [] as string[]),
    safe(dns.resolveCname(host), [] as string[]),
    safe(dns.resolveMx(root), [] as { priority: number; exchange: string }[]),
    safe(dns.resolveTxt(root), [] as string[][]),
    safe(dns.resolveNs(root), [] as string[]),
    safe(dns.resolveTxt(`_dmarc.${root}`), [] as string[][]),
  ]);
  return {
    A: a,
    AAAA: aaaa,
    CNAME: cname,
    MX: mx.sort((x, y) => x.priority - y.priority).map((m) => `${m.priority} ${m.exchange}`),
    TXT: txt.map((t) => t.join('')),
    NS: ns.sort(),
    DMARC: dmarc.map((t) => t.join('')),
  };
}

function detectServices(records: Record<string, string[]>): string[] {
  const found = new Set<string>();
  for (const p of SERVICE_PATTERNS) {
    if ((records[p.type] ?? []).some((v) => p.re.test(v))) found.add(p.name);
  }
  return [...found].sort();
}

function getCertificate(host: string): Promise<CertInfo | null> {
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port: 443, servername: net.isIP(host) ? undefined : host, rejectUnauthorized: false, timeout: 10_000 }, () => {
      const c = socket.getPeerCertificate();
      if (!c || !c.valid_to) {
        socket.end();
        return resolve(null);
      }
      const validTo = new Date(c.valid_to);
      const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
      resolve({
        subject: pick(c.subject?.CN),
        issuer: [pick(c.issuer?.O), pick(c.issuer?.CN)].filter(Boolean).join(' / ') || null,
        validFrom: new Date(c.valid_from).toISOString(),
        validTo: validTo.toISOString(),
        daysRemaining: Math.floor((validTo.getTime() - Date.now()) / 86_400_000),
        altNames: (c.subjectaltname ?? '')
          .split(', ')
          .map((n) => n.replace(/^DNS:/, ''))
          .filter(Boolean)
          .slice(0, 200),
        protocol: socket.getProtocol(),
        cipher: socket.getCipher()?.name ?? null,
        authorized: socket.authorized,
        authorizationError: socket.authorizationError ? String(socket.authorizationError) : null,
      });
      socket.end();
    });
    socket.on('error', () => resolve(null));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(null);
    });
  });
}

interface RdapEntity {
  roles?: string[];
  vcardArray?: [string, [string, unknown, string, string][]];
}
interface RdapResponse {
  entities?: RdapEntity[];
  events?: { eventAction: string; eventDate: string }[];
  nameservers?: { ldhName: string }[];
  status?: string[];
}

async function registration(root: string): Promise<RegistrationInfo | null> {
  // RDAP is the structured, JSON successor to WHOIS.
  const data = await fetchJson<RdapResponse>(`https://rdap.org/domain/${encodeURIComponent(root)}`);
  if (!data) return null;
  const registrar = data.entities?.find((e) => e.roles?.includes('registrar'));
  const fn = registrar?.vcardArray?.[1]?.find((x) => x[0] === 'fn')?.[3] ?? null;
  const event = (action: string) => data.events?.find((e) => e.eventAction === action)?.eventDate ?? null;
  return {
    registrar: fn,
    registered: event('registration'),
    expires: event('expiration'),
    updated: event('last changed'),
    nameservers: (data.nameservers ?? []).map((n) => n.ldhName.toLowerCase()),
    status: data.status ?? [],
  };
}

async function subdomains(root: string): Promise<{ list: string[]; error: string | null }> {
  // Certificate Transparency logs list every hostname a public cert was issued for.
  const rows = await fetchJson<{ name_value: string }[]>(
    `https://crt.sh/?q=${encodeURIComponent(`%.${root}`)}&output=json`,
    25_000,
  );
  if (!rows) return { list: [], error: 'crt.sh did not respond (it is often slow; try again later).' };
  const names = new Set<string>();
  for (const r of rows) {
    for (const n of r.name_value.split('\n')) {
      const h = n.trim().toLowerCase().replace(/^\*\./, '');
      if (h && (h === root || h.endsWith(`.${root}`))) names.add(h);
    }
  }
  return { list: [...names].sort().slice(0, 1000), error: null };
}

export async function analyzeDomain(host: string): Promise<DomainReport> {
  const root = rootDomain(host);
  const [records, cert, reg, subs] = await Promise.all([
    dnsRecords(host, root),
    getCertificate(host),
    registration(root),
    subdomains(root),
  ]);
  return {
    host,
    rootDomain: root,
    dns: records,
    services: detectServices(records),
    tls: cert,
    registration: reg,
    subdomains: subs.list,
    subdomainsError: subs.error,
  };
}
