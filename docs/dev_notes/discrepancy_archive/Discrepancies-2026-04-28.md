# Discrepancies — `altair_frontend1/docs/dev_notes`

This document lists places where the dev notes in this folder disagree with the actual code as of the current branch (`feature/take-altair-fees`). Each section names the doc, the claim, and what the code actually does.

---

## `Config.md`

### Substantive

- **`chain_info.ts` icon-metadata claim is misleading.** Doc says: "wallet/network icon resolution now depends on per-chain icon symbol metadata" inside `chain_info.ts`. Actually, `chain_info.ts` contains no icon-related fields at all (only `chainId`, `rpcUrls`, `explorerUrl`, `name`, `isTestnet`, and EVM-only `uniswapAddresses`). Token/chain icon resolution is built **from chain keys via convention**, e.g. `resolveTokenIconSrc()` in `UserMenu.tsx:1604` constructs paths like `public/image/tokens/<fileType>/<fileSize>/<symbol>.<fileType>` from `WALLET_DISPLAY.tokenIcons`, and `resolveChainIconSrcByConfig()` (`UserMenu.tsx:335`) does the same with chain symbols. There is no icon-symbol metadata living in `chain_info.ts`.

- **`.env` line references can't be verified** (no `.env` file is committed), but the env-var **names** referenced (`NEXT_PUBLIC_BACKEND_URL_OVERRIDE`, `NEXT_PUBLIC_LOCAL_FRONTEND_URL`, `NEXT_PUBLIC_DEV_FRONTEND_URL_PREFIX`, `NEXT_PUBLIC_PROD_FRONTEND_URL`) are all consumed at the documented spots in `next.config.ts:49–62`, and the host-based rewrite logic (local → local backend, `*.vercel.app` → dev backend, prod → prod backend, with `NEXT_PUBLIC_BACKEND_URL_OVERRIDE` as a hard override) matches `next.config.ts:75–112`. ✓

- **Static cache headers** for `/image/tokens/:path*` and `/image/chains/:path*` with `Cache-Control: public, max-age=31536000, immutable` match `next.config.ts:113–142`. ✓

### Stale line numbers (`config/ui_config.ts`)

Most line refs are accurate at the time of writing. Exceptions:

- `ADD_PANEL_DISPLAY` at `:332` → actual **line 334**.
- `ADD_PANEL_DISPLAY.chainDropdown` at `:340` → actual **line 361**.
- `ADD_PANEL_DISPLAY.chainIcons` at `:354` → actual **line 372**.
- `/image/tokens/:path*` at `next.config.ts:124` → actual **line 125** (off by one).

Accurate (confirmed):
- `WALLET_DISPLAY` at `:64`, `WALLET_DISPLAY.tokenIcons` at `:95`, `WALLET_DISPLAY.chainIcons` at `:107`, `WALLET_DISPLAY.title.chainIcon` at `:124`, `WALLET_DISPLAY.chainDropdown` at `:154`, `WALLET_DISPLAY.getCrypto` at `:170`. `ACTIVE_NETWORK_DROPDOWN.selectedItemColor` at `:26`, `MENU_ICONS_override` at `:29`, `chainIcons` at `:46`. `next.config.ts` `rewrites()` at `:75`, `headers()` at `:113`, `/image/chains/:path*` at `:134`. ✓

---

## `Panels.md`

### Substantive

- **Panel-mode behavior** described in the doc matches the code:
  - Panels persist across unrelated interactions and dismiss only via `×`. Confirmed.
  - Each `WALLET_PANEL` carries `{ id, chainKey, isChainOpen }`. Matches `WalletPanelState` type in `usePanels.ts:6`. ✓
  - "When the last `WALLET_PANEL` closes, the wallet icon returns to its inactive state" is implemented via the `onCloseLast` callback in `closeWalletPanel` (`usePanels.ts:68–76`) which the caller wires to `setIsWalletPanelOpen(false)` (`UserMenu.tsx:1083`, `:1902`). ✓
  - Panel state persistence across open/close cycles matches `UserMenu.tsx:2447`: `setWalletPanels((existing) => (existing.length === 1 ? [] : existing));` and `usePanels.ts:46–58` (`initWalletPanels` skips re-init when `existing.length > 0`). ✓

- **"All non-spinning icon branches use Next `Image`"** is broadly correct, but the specific line refs are wrong (see below). The pattern is `SpinningLogo` for spin-enabled rendering and Next `<Image>` for static rendering — confirmed at `UserMenu.tsx:1678 / 1692`, `:2216 / 2230`, `:2344 / 2358`, `:2567 / 2581`.

### Stale line numbers (`UserMenu.tsx`)

- `handleSwapComplete()` at `:919` → actual **line 1131**.
- `renderBalances()` at `:1346` → actual **line 1658**.
- `resolveBalanceForSymbol()` at `:1036` → actual **line 1323**.
- `resolveTokenIconSrc()` at `:1317` → actual **line 1604**.
- Next `<Image>` at `:1380` → first non-spinning `<Image>` inside `renderBalances` is at **line 1692**.
- `resolveChainIconSrcByConfig` at `:334` → actual **line 335** (off by one).
- `balancesByChain` at `:69` → actual **line 70** (off by one).

Accurate:
- `WALLET_DISPLAY.active` at `ui_config.ts:67`, `WALLET_DISPLAY` at `:64`, `WALLET_DISPLAY.tokenIcons` at `:95`, `WALLET_DISPLAY.chainIcons` at `:107`, `WALLET_DISPLAY.title.chainIcon` at `:124`, `ADD_PANEL_DISPLAY.chainIcons` at — actually **line 372**, doc says `:354` (stale).
- `SpinningLogo` import at `UserMenu.tsx:18` (not 11 as the doc says — doc says `SpinningLogo.tsx:11` referring to the component itself, which is fine).

---

## `Wallet Display.md`

### Substantive

- **Mode-flag behavior** (`WALLET_DISPLAY.active` toggles between `panel` and `drop_down`) matches `UserMenu.tsx:90–91` (`isWalletDropDown`, `isWalletPanel`). ✓
- **Both modes share `balancesByChain` and `renderBalances`** — confirmed: `balancesByChain` is a single state hook at `UserMenu.tsx:70`, and `renderBalances` (`:1658`) is used in both the dropdown branch and passed as a prop to `WalletPanel`.
- **`ALL_CHAINS` globe behavior** (`/globe.svg`, fill from SVG) — the resolution path in `resolveChainIconSrcByConfig` (`UserMenu.tsx:335`) does fall back to the globe asset for `ALL`. ✓
- **Active-network `MENU_ICONS_override`** — the override surface (`buttonText`, `chainIcon`) exists in `ui_config.ts:29–45`. ✓
- **Token-icon runtime behavior** (placeholder → load → fallback `?` → spin or static `Image`) is implemented; render branches are at `UserMenu.tsx:1678–1700+`.
- **Above-the-fold preloading** (selected chain icon + first 5 token icons, deduped) — implemented in the preload block around `UserMenu.tsx:1612–1631`. The preload set is collected from `walletTokenSymbols` and warmed via `new window.Image()`.

### Stale line numbers (`UserMenu.tsx`)

- `UserMenu` cited at `:38` → actual default export at **line 40**.
- `isWalletPanel` at `:90` → actual **line 91**.
- `isWalletDropDown` at `:89` → actual **line 90**.
- `isWalletOpen` at `:46` → actual **line 47** (off by one; declaration `useState(false)` is at 47).
- `isWalletPanelOpen` at `:52` → actual **line 52**. ✓
- "Selected row background uses … `selectedItemColor` in `UserMenu`" cited at `:313` → line 313 is inside an unrelated chain-options `useMemo` block; the `selectedItemColor` consumer is elsewhere in the active-network dropdown render (further down the file).
- `useMemo()` for chain options at `:361` → actual `Object.entries(CHAIN_OPTIONS)` block at **line 370** (`useMemo` likely starts a few lines earlier).
- Token icon spin / `SpinningLogo` at `:11` → actual `SpinningLogo` component declaration is at `SpinningLogo.tsx`, but the *import* is at `UserMenu.tsx:18`.
- `resolveBalanceForSymbol` at `:1036` → actual **line 1323**.
- `resolveTokenIconSrc` at `:1317` → actual **line 1604**.
- `renderBalances` at `:1346` → actual **line 1658**.
- `resolveIconBorderStyle` at `:343` → actual **line 345** (off by two).
- `resolveChainIconSrcByConfig` at `:334` → actual **line 335**.
- Above-the-fold preload block at `:1322` → actual **line ~1612**.
- `<Image>` references at `WalletPanel.tsx:336`, `AddPanel.tsx:263`, `UserMenu.tsx:1919` — `UserMenu.tsx:1919` is unrelated bookkeeping code (`setTokenDropdownOpen`); the `<Image>` calls are at the lines listed under Panels.md (1692, 2230, 2358, 2581). The frontend `<Image>` references in `WalletPanel.tsx` and `AddPanel.tsx` were not re-verified here but the pattern (Next `<Image>` for non-spin branches) is consistent in the codebase.
- `/api/balances` cited at `UserMenu.tsx:719` — `fetchBalancesForChain` (which calls `/api/balances`) is at **line 741**; line 719 is inside that function's call site context.

---

## Summary

Substantive issues are limited:

1. **`Config.md`** overstates `chain_info.ts` — chain icon resolution is convention-based, not driven by metadata in that file.
2. **All three docs reference many stale `:NN` line numbers** in `UserMenu.tsx` (which has grown to ~2800 lines), in `ui_config.ts` (the `ADD_PANEL_DISPLAY` block shifted), and in `next.config.ts` (off-by-ones). The architectural descriptions are otherwise accurate.

The frontend doc set is in better shape than the backend's: no broken cross-references to non-existent constants, no contradictions about which functions handle which write paths, and no field-name drift in shared schemas.
