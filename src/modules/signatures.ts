export interface Signature {
  name: string;
  category: string;
  /** header name (lowercase) -> pattern on its value */
  headers?: Record<string, RegExp>;
  cookies?: RegExp[];
  /** matched against every request URL; capture group 1 = version */
  urls?: RegExp[];
  html?: RegExp[];
  /** window globals that must exist */
  globals?: string[];
  /** runtime flags from collect-page.js; a string value is the version */
  flags?: string[];
  /** meta name (lowercase) -> pattern */
  meta?: Record<string, RegExp>;
  cssVars?: RegExp[];
}

export const SIGNATURES: Signature[] = [
  // Ecommerce
  {
    name: 'Salesforce Commerce Cloud (SFCC)',
    category: 'Ecommerce',
    cookies: [/^dwsid$/, /^dwanonymous_/, /^dwac_/, /^dw_dnt$/, /^__cq_/],
    urls: [/\/on\/demandware\.(?:store|static)\//, /demandware\.net/, /dx\.commercecloud\.salesforce\.com/],
    html: [/demandware\.(?:store|static)/i],
  },
  {
    name: 'Salesforce Composable Storefront (PWA Kit)',
    category: 'Ecommerce',
    urls: [/\/mobify\/(?:bundle|proxy)\//, /api\.commercecloud\.salesforce\.com/, /\/shopper\/auth\/v1\//],
    html: [/pwa-kit|mobify-/i],
  },
  {
    name: 'Shopify',
    category: 'Ecommerce',
    globals: ['Shopify'],
    cookies: [/^_shopify_[ys]$/, /^cart_sig$/],
    urls: [/cdn\.shopify\.com/, /\/cdn\/shop\//],
    headers: { 'x-shopid': /.+/, 'x-shopify-stage': /.+/ },
  },
  {
    name: 'Magento / Adobe Commerce',
    category: 'Ecommerce',
    cookies: [/^mage-/, /^form_key$/],
    html: [/Magento_[A-Z]|mage\/cookies|text\/x-magento-init/],
    urls: [/\/static\/version\d+\/frontend\//],
  },
  { name: 'WooCommerce', category: 'Ecommerce', cookies: [/^woocommerce_/, /^wp_woocommerce_session/], html: [/woocommerce(?:-|_)/i] },
  { name: 'BigCommerce', category: 'Ecommerce', globals: ['BCData'], urls: [/cdn\d*\.bigcommerce\.com/] },
  { name: 'Wix', category: 'CMS / Site builder', headers: { 'x-wix-request-id': /.+/ }, urls: [/static\.wixstatic\.com|static\.parastorage\.com/] },
  { name: 'Squarespace', category: 'CMS / Site builder', urls: [/static1\.squarespace\.com|assets\.squarespace\.com/] },
  { name: 'Webflow', category: 'CMS / Site builder', html: [/data-wf-page=/], meta: { generator: /webflow/i } },
  { name: 'WordPress', category: 'CMS / Site builder', html: [/\/wp-content\/|\/wp-includes\//], meta: { generator: /wordpress/i } },
  { name: 'Drupal', category: 'CMS / Site builder', headers: { 'x-generator': /drupal/i }, globals: ['Drupal'], meta: { generator: /drupal/i } },
  { name: 'Ghost', category: 'CMS / Site builder', meta: { generator: /ghost/i } },
  { name: 'Contentful', category: 'CMS / Site builder', urls: [/ctfassets\.net|cdn\.contentful\.com/] },
  { name: 'Sanity', category: 'CMS / Site builder', urls: [/cdn\.sanity\.io|\.api\.sanity\.io/] },
  { name: 'Amplience', category: 'CMS / Site builder', urls: [/\.amplience\.net|cdn\.media\.amplience/] },

  // JS frameworks
  { name: 'Next.js', category: 'JS framework', globals: ['__NEXT_DATA__', 'next'], html: [/\/_next\/static\//], headers: { 'x-powered-by': /next\.js/i } },
  { name: 'Nuxt', category: 'JS framework', globals: ['__NUXT__', '$nuxt'], html: [/\/_nuxt\//] },
  { name: 'Gatsby', category: 'JS framework', html: [/id="___gatsby"/] },
  { name: 'Remix', category: 'JS framework', globals: ['__remixContext'] },
  { name: 'Astro', category: 'JS framework', html: [/<astro-island/], meta: { generator: /astro/i } },
  { name: 'SvelteKit', category: 'JS framework', html: [/__sveltekit/] },
  { name: 'React', category: 'JS framework', flags: ['react'] },
  { name: 'Vue.js', category: 'JS framework', flags: ['vue'] },
  { name: 'Angular', category: 'JS framework', flags: ['angular'] },
  { name: 'Svelte', category: 'JS framework', flags: ['svelte'] },
  { name: 'Alpine.js', category: 'JS framework', flags: ['alpine'], globals: ['Alpine'] },
  { name: 'htmx', category: 'JS framework', flags: ['htmx'], globals: ['htmx'] },

  // Libraries & CSS
  { name: 'jQuery', category: 'JS library', flags: ['jquery'], urls: [/jquery[.-](\d+\.\d+\.\d+)(?:\.min)?\.js/] },
  { name: 'Lodash', category: 'JS library', globals: ['_'], urls: [/lodash(?:\.min)?\.js/] },
  { name: 'GSAP', category: 'JS library', globals: ['gsap'] },
  { name: 'Swiper', category: 'JS library', globals: ['Swiper'], urls: [/swiper(?:-bundle)?(?:\.min)?\.(?:js|css)/] },
  { name: 'Slick carousel', category: 'JS library', urls: [/slick(?:\.min)?\.(?:js|css)/] },
  { name: 'Bootstrap', category: 'CSS framework', flags: ['bootstrap'], cssVars: [/^--bs-/], urls: [/bootstrap(?:\.bundle)?(?:\.min)?\.(?:css|js)/] },
  { name: 'Tailwind CSS', category: 'CSS framework', cssVars: [/^--tw-/] },
  { name: 'Font Awesome', category: 'Fonts / Icons', urls: [/fontawesome|font-awesome/i] },
  { name: 'Google Fonts', category: 'Fonts / Icons', urls: [/fonts\.googleapis\.com|fonts\.gstatic\.com/] },
  { name: 'Adobe Fonts (Typekit)', category: 'Fonts / Icons', urls: [/use\.typekit\.net|p\.typekit\.net/] },

  // Analytics & tags
  { name: 'Google Tag Manager', category: 'Tag manager', globals: ['google_tag_manager'], urls: [/googletagmanager\.com\/gtm\.js/] },
  { name: 'Google Analytics 4', category: 'Analytics', urls: [/googletagmanager\.com\/gtag\/js\?id=G-/, /google-analytics\.com\/g\/collect/, /analytics\.google\.com\/g\/collect/] },
  { name: 'Google Ads', category: 'Marketing', urls: [/googleadservices\.com|googlesyndication\.com|gtag\/js\?id=AW-/] },
  { name: 'Meta Pixel', category: 'Marketing', globals: ['fbq'], urls: [/connect\.facebook\.net\/.*fbevents\.js/, /facebook\.com\/tr\?/] },
  { name: 'LinkedIn Insight', category: 'Marketing', urls: [/snap\.licdn\.com|px\.ads\.linkedin\.com/] },
  { name: 'TikTok Pixel', category: 'Marketing', urls: [/analytics\.tiktok\.com/] },
  { name: 'Hotjar', category: 'Analytics', globals: ['hj'], urls: [/static\.hotjar\.com/] },
  { name: 'Microsoft Clarity', category: 'Analytics', globals: ['clarity'], urls: [/clarity\.ms/] },
  { name: 'Segment', category: 'Analytics', urls: [/cdn\.segment\.com/] },
  { name: 'Mixpanel', category: 'Analytics', globals: ['mixpanel'], urls: [/cdn\.mxpnl\.com|api-js\.mixpanel\.com/] },
  { name: 'Adobe Analytics', category: 'Analytics', globals: ['s_c_il'], urls: [/\.omtrdc\.net|\/b\/ss\//] },
  { name: 'Klaviyo', category: 'Marketing', urls: [/static\.klaviyo\.com|a\.klaviyo\.com/] },
  { name: 'MoEngage', category: 'Marketing', urls: [/moengage\.com/] },
  { name: 'CleverTap', category: 'Marketing', urls: [/clevertap/] },
  { name: 'WebEngage', category: 'Marketing', urls: [/webengage\.com/] },

  // Commerce add-ons
  { name: 'Salesforce Einstein Recommendations', category: 'Personalization', urls: [/cquotient\.com/] },
  { name: 'Algolia', category: 'Search', globals: ['algoliasearch'], urls: [/algolia(?:net)?\.(?:net|io|com)|algolianet\.com/] },
  { name: 'Razorpay', category: 'Payments', globals: ['Razorpay'], urls: [/checkout\.razorpay\.com|api\.razorpay\.com/] },
  { name: 'Stripe', category: 'Payments', globals: ['Stripe'], urls: [/js\.stripe\.com|api\.stripe\.com/] },
  { name: 'PayPal', category: 'Payments', urls: [/paypal\.com\/sdk\/js|paypalobjects\.com/] },
  { name: 'Paytm', category: 'Payments', urls: [/paytm\.(?:in|com)/] },
  { name: 'Cashfree', category: 'Payments', urls: [/cashfree\.com/] },
  { name: 'Adyen', category: 'Payments', urls: [/adyen\.com/] },

  // Support & consent
  { name: 'Intercom', category: 'Customer support', globals: ['Intercom'], urls: [/widget\.intercom\.io|js\.intercomcdn\.com/] },
  { name: 'Zendesk', category: 'Customer support', urls: [/static\.zdassets\.com|zopim/] },
  { name: 'Freshchat / Freshdesk', category: 'Customer support', urls: [/freshchat\.com|freshdesk\.com|freshworks\.com/] },
  { name: 'Tawk.to', category: 'Customer support', urls: [/embed\.tawk\.to/] },
  { name: 'Salesforce Service Cloud chat', category: 'Customer support', urls: [/salesforceliveagent\.com|\.my\.salesforce-scrt\.com|embeddedservice/] },
  { name: 'OneTrust', category: 'Security / Consent', globals: ['OneTrust'], urls: [/cdn\.cookielaw\.org|onetrust\.com/] },
  { name: 'Cookiebot', category: 'Security / Consent', urls: [/consent\.cookiebot\.com/] },
  { name: 'Google reCAPTCHA', category: 'Security / Consent', globals: ['grecaptcha'], urls: [/google\.com\/recaptcha|recaptcha\.net/] },
  { name: 'hCaptcha', category: 'Security / Consent', urls: [/hcaptcha\.com/] },
  { name: 'Sentry', category: 'Monitoring', globals: ['Sentry'], urls: [/browser\.sentry-cdn\.com|ingest\.sentry\.io/] },
  { name: 'New Relic', category: 'Monitoring', globals: ['newrelic', 'NREUM'], urls: [/js-agent\.newrelic\.com|bam\.nr-data\.net/] },
  { name: 'Datadog RUM', category: 'Monitoring', globals: ['DD_RUM'], urls: [/datadoghq-browser-agent|browser-intake-datadoghq/] },

  // CDN, hosting, servers
  { name: 'Cloudflare', category: 'CDN / Hosting', headers: { server: /cloudflare/i, 'cf-ray': /.+/ }, cookies: [/^__cf_bm$/, /^cf_clearance$/] },
  { name: 'Akamai', category: 'CDN / Hosting', headers: { server: /akamai/i, 'x-akamai-transformed': /.+/, 'akamai-grn': /.+/ }, cookies: [/^_abck$/, /^bm_sz$/, /^ak_bmsc$/] },
  { name: 'Fastly', category: 'CDN / Hosting', headers: { 'x-fastly-request-id': /.+/, 'x-served-by': /cache-/i } },
  { name: 'Amazon CloudFront', category: 'CDN / Hosting', headers: { 'x-amz-cf-id': /.+/, via: /cloudfront/i } },
  { name: 'Vercel', category: 'CDN / Hosting', headers: { 'x-vercel-id': /.+/, server: /vercel/i } },
  { name: 'Netlify', category: 'CDN / Hosting', headers: { 'x-nf-request-id': /.+/, server: /netlify/i } },
  { name: 'Azure Front Door', category: 'CDN / Hosting', headers: { 'x-azure-ref': /.+/ } },
  { name: 'Nginx', category: 'Web server', headers: { server: /nginx/i } },
  { name: 'Apache', category: 'Web server', headers: { server: /apache/i } },
  { name: 'Microsoft IIS', category: 'Web server', headers: { server: /microsoft-iis/i } },
  { name: 'LiteSpeed', category: 'Web server', headers: { server: /litespeed/i } },
  { name: 'Express', category: 'Web server', headers: { 'x-powered-by': /express/i } },
  { name: 'PHP', category: 'Web server', headers: { 'x-powered-by': /php/i }, cookies: [/^PHPSESSID$/] },
  { name: 'ASP.NET', category: 'Web server', headers: { 'x-powered-by': /asp\.net/i, 'x-aspnet-version': /.+/ }, cookies: [/^ASP\.NET_SessionId$/] },
];

export const GLOBAL_PROBES = [...new Set(SIGNATURES.flatMap((s) => s.globals ?? []))];
