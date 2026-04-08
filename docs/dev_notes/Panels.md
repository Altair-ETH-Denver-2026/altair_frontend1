
## Panel Behavior

Panels are persistent UI blocks that appear below the top-right action row and remain visible until explicitly dismissed by a close affordance. Unlike dropdowns, panels do **not** dismiss on outside clicks or unrelated UI interactions.

Panel rendering in the frontend is controlled by [`altair_frontend1/config/ui_config.ts`](../../altair_frontend1/config/ui_config.ts:1). The [`WALLET_DISPLAY`](../../altair_frontend1/config/ui_config.ts:6) setting defines the allowed display options (`panel`, `drop_down`) and selects which mode is active via `active`. When `active` is `panel`, the UI renders the persistent panel variant; when `active` is `drop_down`, the UI renders the transient dropdown variant instead.

### Wallet panels (WALLET_PANEL)

The current implementation applies panel behavior to the wallet display in [`altair_frontend1/src/components/UserMenu.tsx`](../../altair_frontend1/src/components/UserMenu.tsx:14). When the active mode is `panel`, clicking the wallet control shows a **stack** of wallet panels. Each WALLET_PANEL is an independent instance with its own chain selection dropdown state and close “×”.

The wallet panel stack is stored in state as a list of panel objects (`walletPanels`) and rendered in order. Each panel object includes:
- `id` (stable key)
- `chainKey` (which chain’s balances are shown)
- `isChainOpen` (whether that panel’s chain dropdown is open)

Each WALLET_PANEL uses [`WALLET_DISPLAY`](../../altair_frontend1/config/ui_config.ts:6) for sizing, padding, fonts, and dropdown sizing. Token row styling comes from `WALLET_DISPLAY.rows`, `WALLET_DISPLAY.tokenSymbols`, and `WALLET_DISPLAY.tokenBalances`.

### Token icon behavior in WALLET_PANEL rows

Token rows in WALLET_PANEL now include icon rendering logic from [`renderBalances`](../../altair_frontend1/src/components/UserMenu.tsx:1122), which is shared by both panel and dropdown wallet UIs.

Config source: `WALLET_DISPLAY.tokenIcons` in [`ui_config.ts`](../../altair_frontend1/config/ui_config.ts:58)

- `fileType` + `fileSize` build the icon path in [`resolveTokenIconSrc`](../../altair_frontend1/src/components/UserMenu.tsx:1119).
- `size` controls rendered icon diameter.
- `placeholderColor` controls the immediate placeholder circle.
- `placeholderFontColor` controls the fallback question-mark color.

Runtime flow:

1. A circular placeholder is rendered immediately (no network dependency).
2. If `iconSrc` is truthy, the icon file is attempted.
3. If image loading fails (`onError`) **or** if `iconSrc` is falsy, a centered `?` fallback is shown.

Icon files are served from `public/image/tokens/<fileType>/<fileSize>/<SYMBOL>.<fileType>`.

Chain labels and dropdown options are config-driven:
- `WALLET_CHAIN_LABELS` controls panel titles (including testnet naming rules).
- `WALLET_CHAIN_OPTIONS` drives dropdown option lists.
### ADD_PANEL (panel adder)

The ADD_PANEL is the compact panel used to add new WALLET_PANEL instances. It is rendered beneath the wallet panel stack and persists across outside clicks. The ADD_PANEL includes:
- A left-aligned “Add Panel:” label (styled by `ADD_PANEL_DISPLAY.label`).
- A wallet icon button with a ring (colors + sizing from `ADD_PANEL_DISPLAY.iconButtons`).
- A chain dropdown that **excludes** chains already represented by open WALLET_PANEL instances.

Selecting a chain from the ADD_PANEL dropdown creates a new WALLET_PANEL instance using that chain. The new panel appears between the existing panels and the ADD_PANEL, pushing the ADD_PANEL downward.

Close behavior:
- Each WALLET_PANEL "×" removes only that panel.
- If the last WALLET_PANEL closes, the wallet icon in the top-right menu returns to its inactive state.

### Panel state persistence across open/close cycles

When the wallet button is clicked to dismiss the panel stack (toggling `isWalletPanelOpen` off), the code in [`altair_frontend1/src/components/UserMenu.tsx`](../../altair_frontend1/src/components/UserMenu.tsx) only clears the `walletPanels` array if there is exactly **one** panel open at the time of dismissal. If two or more panels are open, the array is left intact.

On the next wallet button click, `initWalletPanels` (in [`altair_frontend1/src/lib/usePanels.ts`](../../altair_frontend1/src/lib/usePanels.ts)) detects `existing.length > 0` and skips re-initialization, so the previous panel configuration (all open chains) is restored. This is intentional: panels remember their state across open/close cycles when more than one panel was open.

---

## Balance update behavior in wallet panels

Wallet panels and the wallet dropdown render from the same balance state (`balancesByChain`) in [`UserMenu.tsx`](../../altair_frontend1/src/components/UserMenu.tsx:37).

### Rendering path

- `renderBalances` drives token rows.
- `resolveBalanceForSymbol` reads current per-chain token balances.
- `WalletPanel` receives `renderBalances` as a prop.

This means panel-mode and dropdown-mode are consistent by design.

### Swap/bridge completion flow

When frontend receives `altair:swap-complete`:

1. Immediate local state update is applied for responsiveness.
2. Affected chain caches are marked stale.
3. All affected chains are force-refreshed from `/api/balances`.

Reference: [`handleSwapComplete()`](../../altair_frontend1/src/components/UserMenu.tsx:723).

### Why this matters for panel mode

Historically, selected-chain gating could delay destination-chain persistence/reconciliation in panel views for cross-chain operations. Current behavior force-refreshes all chains in `balanceUpdates`, so wallet panels should converge quickly even when the selected chain is different from the swap origin chain.

---

## Panel mode vs durability nuances

- Panel-mode balance changes can appear instantly due to local event-driven updates.
- Durable Mongo persistence is handled by backend write paths (`/api/balances` reconciliation + relay writeback persistence).
- Panel rendering is intentionally non-blocking: UI responsiveness first, authoritative convergence shortly after.

For full backend persistence details, see [`Balances.md`](./Balances.md) and [`MongoDB.md`](./MongoDB.md).
