# Wallet Display

## Overview

Wallet display in the frontend is controlled by [`WALLET_DISPLAY`](../../config/ui_config.ts) in [`ui_config.ts`](../../config/ui_config.ts). The system supports two UI modes:

- `panel` → persistent multi-panel wallet UI (WALLET_PANEL + ADD_PANEL)
- `drop_down` → transient single dropdown wallet UI (WALLET_DROPDOWN)

Both modes are orchestrated by [`UserMenu.tsx`](../../src/components/UserMenu.tsx) and share the same balance source (`balancesByChain`) and token-row renderer (`renderBalances`).

---

## Mode selection

`WALLET_DISPLAY.active` in [`ui_config.ts`](../../config/ui_config.ts) determines which mode renders when users click the wallet icon.

- Panel mode path in [`UserMenu.tsx`](../../src/components/UserMenu.tsx): `isWalletPanel` + `isWalletPanelOpen`
- Dropdown mode path in [`UserMenu.tsx`](../../src/components/UserMenu.tsx): `isWalletDropDown` + `isWalletOpen`

This means wallet behavior is config-driven without changing component architecture.

---

## WALLET_PANEL (panel mode)

In panel mode, the wallet UI renders a stack of wallet panels plus an add-panel control:

- Panel container and orchestration: [`UserMenu.tsx`](../../src/components/UserMenu.tsx)
- Base panel wrapper: [`Panel.tsx`](../../src/components/Panel.tsx)
- Wallet panel component: [`WalletPanel.tsx`](../../src/components/panels/WalletPanel.tsx)
- Add-panel component: [`AddPanel.tsx`](../../src/components/panels/AddPanel.tsx)
- Panel state hook: [`usePanels.ts`](../../src/lib/usePanels.ts)

Each wallet panel instance has:

- `id`
- `chainKey`
- `isChainOpen`

Panel mode supports multiple concurrent chains by opening multiple WALLET_PANEL instances.

---

## WALLET_DROPDOWN (dropdown mode)

In dropdown mode, users see one wallet surface with:

- chain selector
- withdraw/get-crypto row
- wallet address row
- token balance rows

Dropdown rows and panel rows intentionally use the same data and renderer so balance/token presentation stays consistent across modes.

---

## Shared balance rendering model

Both wallet modes use:

- `balancesByChain` state in [`UserMenu.tsx`](../../src/components/UserMenu.tsx)
- `resolveBalanceForSymbol` for per-row values
- `renderBalances` for token row UI

After swap/bridge operations, frontend emits `altair:swap-complete`; wallet UI applies immediate local updates, marks cache stale, then triggers reconciliation fetches.

---

## Token icon functionality (new)

Token rows in both WALLET_PANEL and WALLET_DROPDOWN now include configurable token icons.

### Config

Defined in [`WALLET_DISPLAY.tokenIcons`](../../config/ui_config.ts):

- `fileType`
- `fileSize`
- `size`
- `placeholderColor`
- `placeholderFontColor`
- `spin`

### Asset path

Icon paths are built as:

`/image/tokens/<fileType>/<fileSize>/<SYMBOL>.<fileType>`

Images are served from `public/image/tokens/...`.

### Runtime behavior

Implemented in [`resolveTokenIconSrc`](../../src/components/UserMenu.tsx) and [`renderBalances`](../../src/components/UserMenu.tsx):

1. A placeholder circle always renders immediately using `placeholderColor`.
2. If `iconSrc` is truthy, the icon image is attempted.
3. If `iconSrc` is falsy, a centered `?` is shown immediately.
4. If `iconSrc` is truthy but image loading fails (`onError`), image is hidden and centered `?` is shown.

Spin behavior:

- If `tokenIcons.spin` is `true`, icons render through [`SpinningLogo`](../../src/components/SpinningLogo.tsx), inheriting the same mouse/touch spin trigger behavior as primary logos.
- If `tokenIcons.spin` is `false`, icons render as static images.

This guarantees instant row stability and visible fallback semantics in all cases.

---

## Styling ownership

Wallet display styling is intentionally centralized in [`ui_config.ts`](../../config/ui_config.ts):

- global wallet dimensions and button style
- chain dropdown sizing + typography + casing + spacing + fill/hover fill
- token row typography and spacing
- token icon dimensions, fallback colors, and spin toggle

Component code in [`UserMenu.tsx`](../../src/components/UserMenu.tsx) consumes config values directly, keeping runtime behavior predictable and adjustable without structural UI refactors.

---

## Chain dropdown styling surfaces (config-driven)

Wallet-related chain dropdowns are now fully style-driven from [`ui_config.ts`](../../config/ui_config.ts):

1. **Active Network dropdown**
   - Config: `ACTIVE_NETWORK_DROPDOWN`
   - UI path: [`UserMenu.tsx`](../../src/components/UserMenu.tsx)
   - Supports: width, font, text color, `allCaps`, `letterSpacing`, item fill, item hover fill, item height

2. **Wallet chain dropdowns (panel + wallet dropdown mode)**
   - Config: `WALLET_DISPLAY.chainDropdown`
   - UI paths: [`WalletPanel.tsx`](../../src/components/panels/WalletPanel.tsx), [`UserMenu.tsx`](../../src/components/UserMenu.tsx)
   - Supports: width, font size/family/color, `allCaps`, `letterSpacing`, item fill, item hover fill, item height

3. **ADD_PANEL chain dropdown**
   - Config: `ADD_PANEL_DISPLAY.chainDropdown`
   - UI paths: [`AddPanel.tsx`](../../src/components/panels/AddPanel.tsx), prop plumbing in [`UserMenu.tsx`](../../src/components/UserMenu.tsx)
   - Supports: width, font size/family/color, `allCaps`, `letterSpacing`, item fill, item hover fill, item height
