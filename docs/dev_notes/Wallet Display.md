# Wallet Display

## Overview

Wallet UI behavior is orchestrated by [`UserMenu`](../../src/components/UserMenu.tsx:40) and controlled by [`WALLET_DISPLAY`](../../config/ui_config.ts:64) in [`ui_config.ts`](../../config/ui_config.ts).

Supported modes:
- `panel` -> persistent stacked wallet panels + add panel
- `drop_down` -> transient single wallet dropdown

Both modes share the same balance state (`balancesByChain`) and token renderer via [`renderBalances()`](../../src/components/UserMenu.tsx:1658).

---

## Mode switching

- Mode flag: [`WALLET_DISPLAY.active`](../../config/ui_config.ts:67)
- Panel path: [`isWalletPanel`](../../src/components/UserMenu.tsx:91) + `isWalletPanelOpen` (declared via `usePanels` at [`UserMenu.tsx:52`](../../src/components/UserMenu.tsx:52))
- Dropdown path: [`isWalletDropDown`](../../src/components/UserMenu.tsx:90) + [`isWalletOpen`](../../src/components/UserMenu.tsx:47)

---

## Chain dropdown + chain icon system

Chain labels/options are derived from [`CHAIN_OPTIONS`](../../config/ui_config.ts:231) and normalized via a `useMemo` over `Object.entries(CHAIN_OPTIONS)` ([`UserMenu.tsx:370`](../../src/components/UserMenu.tsx:370)) that filters by `enabled`, `enableTestnets`, and `enableMainnets`.

### Config surfaces

- Active network list: [`ACTIVE_NETWORK_DROPDOWN.chainIcons`](../../config/ui_config.ts:46)
- Wallet dropdown/panel chain options: [`WALLET_DISPLAY.chainIcons`](../../config/ui_config.ts:107)
- Wallet panel title icon: [`WALLET_DISPLAY.title.chainIcon`](../../config/ui_config.ts:124)
- Add panel chain options: [`ADD_PANEL_DISPLAY.chainIcons`](../../config/ui_config.ts:372)

Each icon surface supports:
- `fileType`, `fileSize`, `size`
- `placeholderColor`, `placeholderFontColor`, `placeholderFontSize`
- `spin`
- `borderPosition`, `borderColor`, `borderWidth`

Border behavior uses [`resolveIconBorderStyle()`](../../src/components/UserMenu.tsx:345) (and matching helpers in panel components) with:
- `inner` -> regular border
- `outer` -> outward ring via box-shadow

### ALL_CHAINS globe

For wallet/add-panel chain dropdowns, `ALL` resolves to [`/globe.svg`](../../public/globe.svg) in [`resolveChainIconSrcByConfig()`](../../src/components/UserMenu.tsx:335).

Globe color comes from the SVG `fill` in [`public/globe.svg`](../../public/globe.svg), not from `ui_config`.

---

## Active network dropdown enhancements

- Selected row background uses [`ACTIVE_NETWORK_DROPDOWN.selectedItemColor`](../../config/ui_config.ts:26) (consumed when rendering the active-network dropdown items in [`UserMenu`](../../src/components/UserMenu.tsx)).
- Top network button can override menu icon presentation via [`ACTIVE_NETWORK_DROPDOWN.MENU_ICONS_override`](../../config/ui_config.ts:29):
  - optional text overrides via `buttonText`
  - selected-chain icon override via `chainIcon` (replaces globe in top button when configured)

---

## Token icon rendering (wallet rows)

Token rows in both modes use [`WALLET_DISPLAY.tokenIcons`](../../config/ui_config.ts:95) and [`resolveTokenIconSrc()`](../../src/components/UserMenu.tsx:1604).

Runtime behavior:
1. Render placeholder circle immediately.
2. If icon URL exists, load icon.
3. If icon URL is missing or load fails, show centered `?`.
4. If spin is enabled, use [`SpinningLogo`](../../src/components/SpinningLogo.tsx); otherwise use Next [`Image`](../../src/components/UserMenu.tsx:1692).

Other non-spinning icon branches across wallet/add/network surfaces in `UserMenu.tsx` are at [line 2230](../../src/components/UserMenu.tsx:2230), [line 2358](../../src/components/UserMenu.tsx:2358), and [line 2581](../../src/components/UserMenu.tsx:2581). The panel components ([`WalletPanel.tsx`](../../src/components/panels/WalletPanel.tsx), [`AddPanel.tsx`](../../src/components/panels/AddPanel.tsx)) follow the same pattern.

---

## Performance updates

### Above-the-fold preloading

[`UserMenu`](../../src/components/UserMenu.tsx) preloads (around lines 1612–1631):
- selected chain icon
- first N token icons for the visible chain

The preload set is deduped and warmed via `new window.Image().src`.

### Static asset caching

[`next.config.ts`](../../next.config.ts:113) applies long-lived cache headers for icon assets:
- [`/image/tokens/:path*`](../../next.config.ts:125)
- [`/image/chains/:path*`](../../next.config.ts:134)

Header: `Cache-Control: public, max-age=31536000, immutable`.

---

## Backend routing behavior relevant to wallet balances

Frontend `/api/*` calls (including `/api/balances`, called from `fetchBalancesForChain` at [`UserMenu.tsx:741`](../../src/components/UserMenu.tsx:741)) are routed by request host in [`rewrites()`](../../next.config.ts:75), using env-configured frontend host mappings.

This ensures local/prod runtime selection is based on frontend URL host, not on `dev` vs `start` command. `NEXT_PUBLIC_BACKEND_URL_OVERRIDE` (read at [`next.config.ts:49`](../../next.config.ts:49)) is a hard override that bypasses host-based routing.
