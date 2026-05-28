# Configuration Overview

Runtime behavior is driven by code-first config in [`config`](config/ui_config.ts:1), with host/env wiring in [`.env`](.env:1) and server routing in [`next.config.ts`](next.config.ts:1).

## `ui_config.ts`

Primary UI control surface: [`config/ui_config.ts`](config/ui_config.ts:1).

### Wallet + panel surfaces
- [`WALLET_DISPLAY`](../../config/ui_config.ts:64): wallet mode (`panel` / `drop_down`), sizing, typography, withdraw controls, and links.
- [`ADD_PANEL_DISPLAY`](../../config/ui_config.ts:334): ADD_PANEL sizing, icon button styling, and chain dropdown styling.
- [`WALLET_DISPLAY.chainDropdown`](../../config/ui_config.ts:154) and [`ADD_PANEL_DISPLAY.chainDropdown`](../../config/ui_config.ts:361): width, font, casing, letter spacing, item base/hover colors, item height.
- [`CHAIN_OPTIONS`](../../config/ui_config.ts:231): per-chain enable flags + label groups (`activeNetwork`, `walletDisplay`) consumed by both the top network selector and the wallet panel/dropdown chain options.

### Token icon config
- [`WALLET_DISPLAY.tokenIcons`](../../config/ui_config.ts:95) controls:
  - file path: `fileType`, `fileSize`
  - visual size: `size`
  - placeholders: `placeholderColor`, `placeholderFontColor`, `placeholderFontSize`
  - motion: `spin`
  - border: `borderColor`, `borderWidth` / `borderSize`, `borderPosition` (`inner`/`outer`)

### Chain icon config
- [`ACTIVE_NETWORK_DROPDOWN.chainIcons`](../../config/ui_config.ts:46)
- [`WALLET_DISPLAY.chainIcons`](../../config/ui_config.ts:107)
- [`WALLET_DISPLAY.title.chainIcon`](../../config/ui_config.ts:124)
- [`ADD_PANEL_DISPLAY.chainIcons`](../../config/ui_config.ts:372)

Each supports dynamic pathing, placeholder settings, spin, and border behavior (including outward ring via `borderPosition: 'outer'`).

### Active-network dropdown enhancements
- [`ACTIVE_NETWORK_DROPDOWN.selectedItemColor`](../../config/ui_config.ts:26): selected row background.
- [`ACTIVE_NETWORK_DROPDOWN.MENU_ICONS_override`](../../config/ui_config.ts:29): optional override for top network-button content.
  - [`buttonText`](../../config/ui_config.ts:30): optional typography overrides.
  - [`chainIcon`](../../config/ui_config.ts:33): selected-chain icon in the top button (replaces globe when configured).

## `chain_info.ts`

Chain metadata source: [`config/chain_info.ts`](../../config/chain_info.ts). This file is mirrored from the backend (see synchronization warning at the top of both copies). It exports per-chain `chainId`, `rpcUrls`, `explorerUrl`, and (for EVM chains) `uniswapAddresses`. There is **no icon-symbol metadata in this file**.

Wallet/network icon resolution is convention-based, not metadata-driven: [`resolveTokenIconSrc()`](../../src/components/UserMenu.tsx:1604) builds paths like `/image/tokens/<fileType>/<fileSize>/<symbol>.<fileType>` from `WALLET_DISPLAY.tokenIcons`, and [`resolveChainIconSrcByConfig()`](../../src/components/UserMenu.tsx:335) does the same with chain symbols (`/image/chains/...`). `ALL_CHAINS` is special-cased to `/globe.svg`.

## `external_links.ts`

Affiliate links are centralized in [`config/external_links.ts`](../../config/external_links.ts) and consumed by [`WALLET_DISPLAY.getCrypto`](../../config/ui_config.ts:170).

## `site_metadata.ts`

Site-wide metadata, SEO, social-card, and PWA settings live in [`config/site_metadata.ts`](../../config/site_metadata.ts). All literal strings, URLs, colors, and icon paths used by Next.js's metadata, viewport, robots, sitemap, and manifest exports are defined here.

### Sections

- **Core site info**: [`SITE_URL`](../../config/site_metadata.ts:8), [`SITE_NAME`](../../config/site_metadata.ts:11), [`SITE_TITLE`](../../config/site_metadata.ts:14), [`SITE_TITLE_TEMPLATE`](../../config/site_metadata.ts:18), [`SITE_DESCRIPTION`](../../config/site_metadata.ts:22), [`SITE_KEYWORDS`](../../config/site_metadata.ts:26), [`SITE_LOCALE`](../../config/site_metadata.ts:62).
- **Open Graph / Twitter card**: [`SITE_OG_IMAGE`](../../config/site_metadata.ts:52), [`SITE_OG_IMAGE_WIDTH`](../../config/site_metadata.ts:53), [`SITE_OG_IMAGE_HEIGHT`](../../config/site_metadata.ts:54), [`SITE_OG_IMAGE_ALT`](../../config/site_metadata.ts:55), [`SITE_TWITTER_HANDLE`](../../config/site_metadata.ts:59).
- **Viewport / theming**: [`SITE_THEME_COLOR`](../../config/site_metadata.ts), [`SITE_COLOR_SCHEME`](../../config/site_metadata.ts), [`SITE_VIEWPORT_WIDTH`](../../config/site_metadata.ts), [`SITE_VIEWPORT_INITIAL_SCALE`](../../config/site_metadata.ts).
- **Robots**: [`SITE_ROBOTS_RULES`](../../config/site_metadata.ts) — array of `{ userAgent, allow, disallow }` rules.
- **Sitemap**: [`SITE_SITEMAP_ROUTES`](../../config/site_metadata.ts) — array of `{ url, changeFrequency, priority }`. **Per Rule #5, update this array whenever a new public route is added.**
- **PWA manifest**: [`SITE_PWA_SHORT_NAME`](../../config/site_metadata.ts), [`SITE_PWA_BACKGROUND_COLOR`](../../config/site_metadata.ts), [`SITE_PWA_DISPLAY`](../../config/site_metadata.ts), [`SITE_PWA_START_URL`](../../config/site_metadata.ts), [`SITE_PWA_ICONS`](../../config/site_metadata.ts).
- **Status pages**: [`NOT_FOUND_TITLE`](../../config/site_metadata.ts), [`NOT_FOUND_MESSAGE`](../../config/site_metadata.ts), [`NOT_FOUND_CTA_LABEL`](../../config/site_metadata.ts), [`ERROR_TITLE`](../../config/site_metadata.ts), [`ERROR_MESSAGE`](../../config/site_metadata.ts), [`ERROR_RETRY_LABEL`](../../config/site_metadata.ts), [`ERROR_HOME_LABEL`](../../config/site_metadata.ts), [`ERROR_SHOW_DETAILS_IN_DEV`](../../config/site_metadata.ts), [`LOADING_LABEL`](../../config/site_metadata.ts).

### Consumers

| Constant group | Consumer file | Effect |
|---|---|---|
| Core info, OG, Twitter | [`src/app/layout.tsx`](../../src/app/layout.tsx) (`metadata` export) | `<title>`, `<meta description>`, OG tags, Twitter card |
| Viewport / theming | [`src/app/layout.tsx`](../../src/app/layout.tsx) (`viewport` export) | viewport meta tag, mobile browser chrome color, color scheme |
| Robots | [`src/app/robots.ts`](../../src/app/robots.ts) | `/robots.txt` |
| Sitemap | [`src/app/sitemap.ts`](../../src/app/sitemap.ts) | `/sitemap.xml` |
| PWA manifest | [`src/app/manifest.ts`](../../src/app/manifest.ts) | `/manifest.webmanifest` |
| Status pages | [`src/app/not-found.tsx`](../../src/app/not-found.tsx), [`src/app/error.tsx`](../../src/app/error.tsx), [`src/app/loading.tsx`](../../src/app/loading.tsx) | 404 page, error boundary, route-transition spinner |

### Icon / image asset locations

- **Tab favicon**: [`src/app/icon.png`](../../src/app/icon.png) — auto-served as the browser-tab favicon at every requested size (recommend 512×512 source).
- **iOS home-screen icon**: [`src/app/apple-icon.png`](../../src/app/apple-icon.png) — used when users "Add to Home Screen" on iOS. iOS ignores the PWA manifest's icons array.
- **Social card**: [`src/app/opengraph-image.png`](../../src/app/opengraph-image.png) — used as the OG/Twitter preview when [`SITE_OG_IMAGE`](../../config/site_metadata.ts:52) is unset, or alongside it. Recommend 1200×630.
- **PWA install icons** (Android Chrome): paths declared in [`SITE_PWA_ICONS`](../../config/site_metadata.ts), files belong in `public/icons/` (e.g. `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`).

### Analytics

[`src/app/layout.tsx`](../../src/app/layout.tsx) renders both `<SpeedInsights />` (from `@vercel/speed-insights`) and `<Analytics />` (from `@vercel/analytics`). Both require the corresponding tab in the Vercel dashboard to be toggled on per-project; no config or env vars needed. View at `vercel.com/[org]/altair-frontend/{analytics,speed-insights}`.

## Frontend host -> backend host routing

Server-side API proxy routing is host-based (not dev-vs-start mode based) in [`next.config.ts`](../../next.config.ts:75):
- local frontend host -> local backend
- Vercel preview pattern (`*.vercel.app`) -> dev backend
- prod frontend host -> prod backend
- optional hard override via `NEXT_PUBLIC_BACKEND_URL_OVERRIDE` (read at [`next.config.ts:49`](../../next.config.ts:49)) — when set, all `/api/*` traffic is rewritten to that URL.

Configured via the following env vars (read at the top of [`next.config.ts`](../../next.config.ts:49)):
- `NEXT_PUBLIC_LOCAL_FRONTEND_URL`
- `NEXT_PUBLIC_DEV_FRONTEND_URL_PREFIX`
- `NEXT_PUBLIC_PROD_FRONTEND_URL`
- `NEXT_PUBLIC_LOCAL_BACKEND_URL`, `NEXT_PUBLIC_DEV_BACKEND_URL`, `NEXT_PUBLIC_PROD_BACKEND_URL`

If env vars are unset, sensible defaults baked into `next.config.ts` are used.

## Asset caching + perceived performance

### Static cache headers
Long-lived cache headers are set in [`next.config.ts`](../../next.config.ts:113) for:
- [`/image/tokens/:path*`](../../next.config.ts:125)
- [`/image/chains/:path*`](../../next.config.ts:134)

Header value: `Cache-Control: public, max-age=31536000, immutable`.

### Above-the-fold icon preloading
Wallet/menu icon preloading is implemented in [`UserMenu.tsx`](../../src/components/UserMenu.tsx) around lines 1612–1631:
- selected chain icon
- first N token icons for the visible chain
- deduped and warmed with `new window.Image().src`

## General import rules

- Chain keys/types from [`config/blockchain_config.ts`](../../config/blockchain_config.ts)
- Chain metadata from [`config/chain_info.ts`](../../config/chain_info.ts)
- Token metadata from [`config/token_info`](../../config/token_info)
- UI behavior from [`config/ui_config.ts`](../../config/ui_config.ts)
- External URLs from [`config/external_links.ts`](../../config/external_links.ts)
- Site metadata / SEO / PWA from [`config/site_metadata.ts`](../../config/site_metadata.ts)
