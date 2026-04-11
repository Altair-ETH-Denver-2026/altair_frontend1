# Configuration Overview

Runtime behavior is driven by code-first config in [`config`](config/ui_config.ts:1), with host/env wiring in [`.env`](.env:1) and server routing in [`next.config.ts`](next.config.ts:1).

## `ui_config.ts`

Primary UI control surface: [`config/ui_config.ts`](config/ui_config.ts:1).

### Wallet + panel surfaces
- [`WALLET_DISPLAY`](config/ui_config.ts:64): wallet mode (`panel` / `drop_down`), sizing, typography, withdraw controls, and links.
- [`ADD_PANEL_DISPLAY`](config/ui_config.ts:332): ADD_PANEL sizing, icon button styling, and chain dropdown styling.
- [`WALLET_DISPLAY.chainDropdown`](config/ui_config.ts:154) and [`ADD_PANEL_DISPLAY.chainDropdown`](config/ui_config.ts:340): width, font, casing, letter spacing, item base/hover colors, item height.

### Token icon config
- [`WALLET_DISPLAY.tokenIcons`](config/ui_config.ts:95) controls:
  - file path: `fileType`, `fileSize`
  - visual size: `size`
  - placeholders: `placeholderColor`, `placeholderFontColor`, `placeholderFontSize`
  - motion: `spin`
  - border: `borderColor`, `borderWidth` / `borderSize`, `borderPosition` (`inner`/`outer`)

### Chain icon config
- [`ACTIVE_NETWORK_DROPDOWN.chainIcons`](config/ui_config.ts:46)
- [`WALLET_DISPLAY.chainIcons`](config/ui_config.ts:107)
- [`WALLET_DISPLAY.title.chainIcon`](config/ui_config.ts:124)
- [`ADD_PANEL_DISPLAY.chainIcons`](config/ui_config.ts:354)

Each supports dynamic pathing, placeholder settings, spin, and border behavior (including outward ring via `borderPosition: 'outer'`).

### Active-network dropdown enhancements
- [`ACTIVE_NETWORK_DROPDOWN.selectedItemColor`](config/ui_config.ts:26): selected row background.
- [`ACTIVE_NETWORK_DROPDOWN.MENU_ICONS_override`](config/ui_config.ts:29): optional override for top network-button content.
  - [`buttonText`](config/ui_config.ts:30): optional typography overrides.
  - [`chainIcon`](config/ui_config.ts:33): selected-chain icon in the top button (replaces globe when configured).

## `chain_info.ts`

Chain metadata source: [`config/chain_info.ts`](config/chain_info.ts:1).

Beyond RPC/explorer fields, wallet/network icon resolution now depends on per-chain icon symbol metadata (used to build paths under [`public/image/tokens`](public/image/tokens/webp/64px)).

## `external_links.ts`

Affiliate links are centralized in [`config/external_links.ts`](config/external_links.ts:1) and consumed by [`WALLET_DISPLAY.getCrypto`](config/ui_config.ts:170).

## Frontend host -> backend host routing

Server-side API proxy routing is now host-based (not dev-vs-start mode based) in [`next.config.ts`](next.config.ts:75):
- local frontend host -> local backend
- Vercel preview pattern -> dev backend
- prod frontend host -> prod backend
- optional hard override via [`NEXT_PUBLIC_BACKEND_URL_OVERRIDE`](.env:1)

Configured via:
- [`NEXT_PUBLIC_LOCAL_FRONTEND_URL`](.env:8)
- [`NEXT_PUBLIC_DEV_FRONTEND_URL_PREFIX`](.env:7)
- [`NEXT_PUBLIC_PROD_FRONTEND_URL`](.env:9)
- backend counterparts in [`.env`](.env:2)

## Asset caching + perceived performance

### Static cache headers
Long-lived cache headers are set in [`next.config.ts`](next.config.ts:113) for:
- [`/image/tokens/:path*`](next.config.ts:124)
- [`/image/chains/:path*`](next.config.ts:134)

Header value: `Cache-Control: public, max-age=31536000, immutable`.

### Above-the-fold icon preloading
Wallet/menu icon preloading is implemented in [`UserMenu.tsx`](src/components/UserMenu.tsx:1322):
- selected chain icon
- first 5 token icons
- deduped and warmed with `new window.Image().src`

## General import rules

- Chain keys/types from [`config/blockchain_config.ts`](config/blockchain_config.ts:1)
- Chain metadata/symbols from [`config/chain_info.ts`](config/chain_info.ts:1)
- Token metadata from [`config/token_info`](config/token_info/base_tokens.ts:1)
- UI behavior from [`config/ui_config.ts`](config/ui_config.ts:1)
- External URLs from [`config/external_links.ts`](config/external_links.ts:1)
