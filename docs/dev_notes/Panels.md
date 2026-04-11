
## Panel Behavior

Panels are persistent UI blocks shown under the top-right action row. They remain visible until closed explicitly and are not dismissed by unrelated interactions.

Panel rendering is controlled by [`WALLET_DISPLAY.active`](../../config/ui_config.ts:67) in [`ui_config.ts`](../../config/ui_config.ts:1):
- `panel` -> persistent wallet panels
- `drop_down` -> transient wallet dropdown

### Wallet panels (WALLET_PANEL)

In panel mode, [`UserMenu.tsx`](../../src/components/UserMenu.tsx:1) renders a stack of wallet panels. Each WALLET_PANEL is independent with its own chain dropdown state and close button.

The wallet panel stack is stored in state as a list of panel objects (`walletPanels`) and rendered in order. Each panel object includes:
- `id` (stable key)
- `chainKey` (which chain’s balances are shown)
- `isChainOpen` (whether that panel’s chain dropdown is open)

Each WALLET_PANEL uses [`WALLET_DISPLAY`](../../config/ui_config.ts:64) for sizing, spacing, fonts, and row/dropdown behavior.

### Token icon behavior in wallet panel rows

Token rows are rendered by shared [`renderBalances()`](../../src/components/UserMenu.tsx:1346) (used by panel + dropdown modes).

Config source: [`WALLET_DISPLAY.tokenIcons`](../../config/ui_config.ts:95)

Supported behavior:
- dynamic pathing (`fileType`, `fileSize`) via [`resolveTokenIconSrc()`](../../src/components/UserMenu.tsx:1317)
- placeholder + fallback `?`
- spin toggle via [`SpinningLogo`](../../src/components/SpinningLogo.tsx:11)
- configurable border model via `borderPosition` + `borderColor` + `borderWidth`/`borderSize`

Rendering now uses Next [`Image`](../../src/components/UserMenu.tsx:1380) for non-spinning branches.

### Chain icons in panel-related dropdowns

Wallet panel + add-panel chain options use icon resolution from chain symbol metadata and config surfaces:
- [`WALLET_DISPLAY.chainIcons`](../../config/ui_config.ts:107)
- [`WALLET_DISPLAY.title.chainIcon`](../../config/ui_config.ts:124)
- [`ADD_PANEL_DISPLAY.chainIcons`](../../config/ui_config.ts:354)

`ALL_CHAINS` uses the globe asset [`/globe.svg`](../../public/globe.svg:1) in wallet/add-panel dropdowns via shared resolver logic in [`UserMenu.tsx`](../../src/components/UserMenu.tsx:334).

Notes:
- Globe color is currently defined by the SVG `fill` value in [`public/globe.svg`](../../public/globe.svg:1).
- Chain icon containers support `inner` and `outer` border modes.
### ADD_PANEL (panel adder)

ADD_PANEL is the compact control for adding new WALLET_PANEL instances. It is rendered beneath the wallet stack and includes:
- A left-aligned “Add Panel:” label (styled by `ADD_PANEL_DISPLAY.label`).
- A wallet icon button with a ring (colors + sizing from `ADD_PANEL_DISPLAY.iconButtons`).
- A chain dropdown that excludes chains already represented by open WALLET_PANEL instances.

Selecting a chain from the ADD_PANEL dropdown creates a new WALLET_PANEL instance using that chain. The new panel appears between the existing panels and the ADD_PANEL, pushing the ADD_PANEL downward.

Close behavior:
- Each WALLET_PANEL "×" removes only that panel.
- If the last WALLET_PANEL closes, the wallet icon in the top-right menu returns to its inactive state.

### Panel state persistence across open/close cycles

When wallet panel mode is toggled closed, panel list state is only fully reset in specific conditions; otherwise, panel configuration is preserved and restored on reopen via [`usePanels.ts`](../../src/lib/usePanels.ts:1).

---

## Balance update behavior in wallet panels

Wallet panels and wallet dropdown mode share `balancesByChain` in [`UserMenu.tsx`](../../src/components/UserMenu.tsx:69).

### Rendering path

- [`renderBalances()`](../../src/components/UserMenu.tsx:1346) drives token rows.
- [`resolveBalanceForSymbol()`](../../src/components/UserMenu.tsx:1036) reads per-chain balances.
- [`WalletPanel`](../../src/components/panels/WalletPanel.tsx:1) receives `renderBalances` as prop.

This means panel-mode and dropdown-mode are consistent by design.

### Swap/bridge completion flow

When frontend receives `altair:swap-complete`:

1. Immediate local state update is applied for responsiveness.
2. Affected chain caches are marked stale.
3. All affected chains are force-refreshed from `/api/balances`.

Reference: [`handleSwapComplete()`](../../src/components/UserMenu.tsx:919).

### Why this matters for panel mode

Historically, selected-chain gating could delay destination-chain persistence/reconciliation in panel views for cross-chain operations. Current behavior force-refreshes all chains in `balanceUpdates`, so wallet panels should converge quickly even when the selected chain is different from the swap origin chain.

---

## Panel mode vs durability nuances

- Panel-mode balance changes can appear instantly due to local event-driven updates.
- Durable Mongo persistence is handled by backend write paths (`/api/balances` reconciliation + relay writeback persistence).
- Panel rendering is intentionally non-blocking: UI responsiveness first, authoritative convergence shortly after.

For backend persistence details, see corresponding balance and Mongo notes in this docs set.
