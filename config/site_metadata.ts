// Site-wide metadata used by Next.js `metadata` export in altair_frontend1/src/app/layout.tsx.
// Drives <title>, <meta description>, Open Graph (Facebook/LinkedIn/Discord/Slack link previews),
// and Twitter/X card previews.

// Production URL of the deployed site. Must be an absolute URL with protocol.
// Used as the base for resolving relative OG/Twitter image paths.
// TODO: update this to the real production domain when known.
export const SITE_URL = 'https://askaltair.com';

// Short site name. Appears as the suffix on browser tabs and as og:site_name.
export const SITE_NAME = 'Altair';

// Default page title. Shown in the browser tab and in link previews.
export const SITE_TITLE = 'Altair - Your Web3 Wingbot';

// Title template applied to child pages. `%s` is replaced with the page's own title.
// e.g. a page with title "Settings" becomes "Settings | Altair".
export const SITE_TITLE_TEMPLATE = `%s | ${SITE_NAME}`;

// One-to-two sentence pitch. Shown beneath the title in Google results and link previews.
// Aim for 150–160 characters.
export const SITE_DESCRIPTION =
  'Altair makes crypto easy. Type your intent, and Altair AI executes it for you, on-chain. No wallet required.';

// Keywords array (largely ignored by Google now but still used by some crawlers).
export const SITE_KEYWORDS = [
  'crypto',
  'cryptocurrency',
  'DEX',
  'blockchain',
  'web3',
  'swap',
  'bridge',
  'AI',
  'machine learning',
  'DeFi',
  'wallet',
  'Ethereum',
  'Solana',
  'bitcoin',
  'base',
  'earn',
  'liquidity pool',
  'liquidity pools',
  'stake',
  'staking',
  'Privy',
];

// Path (relative to /public or the app dir) of the social preview image used in OG and Twitter cards.
// Recommended dimensions: 1200x630. See altair_frontend1/src/app/opengraph-image.* convention as an alternative.
export const SITE_OG_IMAGE = '/og-image.png';
export const SITE_OG_IMAGE_WIDTH = 1200;
export const SITE_OG_IMAGE_HEIGHT = 630;
export const SITE_OG_IMAGE_ALT = `${SITE_NAME} - ChatGPT for crypto`;

// Twitter/X handle for attribution in Twitter card previews (include the leading @).
// Leave as empty string to omit. TODO: set to the real handle when known.
export const SITE_TWITTER_HANDLE = '@AskAltair';

// Default OpenGraph locale.
export const SITE_LOCALE = 'en_US';

// Color of the mobile browser chrome (Android Chrome status bar, iOS Safari address bar tint,
// PWA splash screen). Matches the body's bg-black so the browser frame blends with the page.
// Consumed by the Next.js `viewport` export in altair_frontend1/src/app/layout.tsx.
export const SITE_THEME_COLOR = '#000000';

// Tells the browser this site is dark-mode by default. Prevents a white flash before our
// CSS loads on first paint, and tints native form controls/scrollbars to dark variants.
export const SITE_COLOR_SCHEME: 'dark' | 'light' | 'normal' | 'dark light' | 'light dark' =
  'dark';

// Viewport meta tag settings. Defaults match Next.js's own defaults — set explicitly here
// so they live alongside the other site metadata and can be tuned in one place.
export const SITE_VIEWPORT_WIDTH = 'device-width';
export const SITE_VIEWPORT_INITIAL_SCALE = 1;

// -----------------------------------------------------------------------------
// robots.txt — consumed by altair_frontend1/src/app/robots.ts
// -----------------------------------------------------------------------------

// User-agent rules. Empty disallow array = allow all crawlers full access.
// Add rules like { userAgent: 'GPTBot', disallow: '/' } to block specific AI crawlers,
// or { userAgent: '*', disallow: ['/api/', '/admin/'] } to hide specific paths.
export const SITE_ROBOTS_RULES: Array<{
  userAgent: string | string[];
  allow?: string | string[];
  disallow?: string | string[];
}> = [
  {
    userAgent: '*',
    allow: '/',
    disallow: [],
  },
];

// -----------------------------------------------------------------------------
// sitemap.xml — consumed by altair_frontend1/src/app/sitemap.ts
// -----------------------------------------------------------------------------

// List every public route that should appear in search engines.
// `url` is appended to SITE_URL. `changeFrequency` and `priority` are advisory hints.
export const SITE_SITEMAP_ROUTES: Array<{
  url: string;
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
}> = [
  { url: '/', changeFrequency: 'weekly', priority: 1.0 },
];

// -----------------------------------------------------------------------------
// PWA manifest — consumed by altair_frontend1/src/app/manifest.ts
// -----------------------------------------------------------------------------

// Short name shown under the icon on the home screen / app launcher (max ~12 chars).
export const SITE_PWA_SHORT_NAME = 'Altair';

// Background color shown on the PWA splash screen while the app loads. Usually matches the body bg.
export const SITE_PWA_BACKGROUND_COLOR = '#000000';

// How the installed PWA renders: 'standalone' (no browser chrome, app-like — most common),
// 'fullscreen' (no chrome at all), 'minimal-ui' (minimal browser controls), 'browser' (normal tab).
export const SITE_PWA_DISPLAY: 'standalone' | 'fullscreen' | 'minimal-ui' | 'browser' = 'standalone';

// URL the PWA opens to when launched from the home screen.
export const SITE_PWA_START_URL = '/';

// -----------------------------------------------------------------------------
// 404 / not-found page — consumed by altair_frontend1/src/app/not-found.tsx
// -----------------------------------------------------------------------------

// Headline shown on the 404 page.
export const NOT_FOUND_TITLE = '404';

// One-line message shown beneath the headline.
export const NOT_FOUND_MESSAGE = "That page drifted off into space.";

// Label on the "go home" button.
export const NOT_FOUND_CTA_LABEL = 'Back to Altair';

// -----------------------------------------------------------------------------
// Error boundary page — consumed by altair_frontend1/src/app/error.tsx
// -----------------------------------------------------------------------------

// Headline shown when an unhandled exception is thrown anywhere in the app.
export const ERROR_TITLE = 'Something went wrong';

// One-line message shown beneath the headline. Keep it user-friendly — the raw error
// details are logged to the console (and to your monitoring service if wired up).
export const ERROR_MESSAGE = "We hit a snag. You can try again, or head back home.";

// Label on the "try again" button that re-runs the failed render.
export const ERROR_RETRY_LABEL = 'Try again';

// Label on the secondary "go home" button.
export const ERROR_HOME_LABEL = 'Go home';

// Whether to show the raw error message to the user. Useful in dev, noisy in production.
// Driven by NODE_ENV so it auto-hides on the deployed site.
export const ERROR_SHOW_DETAILS_IN_DEV = true;

// -----------------------------------------------------------------------------
// Loading page — consumed by altair_frontend1/src/app/loading.tsx
// -----------------------------------------------------------------------------

// Text shown beneath the spinning logo during route transitions. Leave empty for spinner-only.
export const LOADING_LABEL = '';

// PWA icons. Paths are relative to /public. Each entry needs `src`, `sizes`, `type`,
// and optionally `purpose` ('maskable' lets the OS crop to its shape — round on iOS, squircle on Android).
// At minimum you need a 192x192 and a 512x512 PNG. The maskable variant should have padding
// inside a "safe zone" — see https://maskable.app/ to test.
export const SITE_PWA_ICONS: Array<{
  src: string;
  sizes: string;
  type: string;
  purpose?: 'any' | 'maskable' | 'monochrome';
}> = [
  { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];
