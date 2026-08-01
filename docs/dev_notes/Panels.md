
## Panel Behavior

Panels are persistent UI blocks that appear below the top-right action row and remain visible until explicitly dismissed by a close affordance. Unlike dropdowns, panels do **not** dismiss on outside clicks or unrelated UI interactions.

Panel rendering in the frontend is controlled by [`altair_frontend1/config/ui_config.ts`](../../../altair_frontend1/config/ui_config.ts). The [`WALLET_DISPLAY`](../../../altair_frontend1/config/ui_config.ts:64) setting defines the allowed display options (`panel`, `drop_down`) and selects which mode is active via `active`. When `active` is `panel`, the UI renders the persistent panel variant; when `active` is `drop_down`, the UI renders the transient dropdown variant instead.

### Wallet panels (WALLET_PANEL)

The current implementation applies panel behavior to the wallet display in [`altair_frontend1/src/components/UserMenu.tsx`](../../../altair_frontend1/src/components/UserMenu.tsx). When the active mode is `panel`, clicking the wallet control shows a **stack** of wallet panels. Each WALLET_PANEL is an independent instance with its own chain selection dropdown state and close “×”.

The wallet panel stack is stored in state as a list of panel objects (`walletPanels`) and rendered in order. Each panel object includes:
- `id` (stable key)
- `chainKey` (which chain’s balances are shown)
- `isChainOpen` (whether that panel’s chain dropdown is open)

Each WALLET_PANEL uses [`WALLET_DISPLAY`](../../../altair_frontend1/config/ui_config.ts:64) for sizing, padding, fonts, and dropdown sizing. Token row styling comes from `WALLET_DISPLAY.rows`, `WALLET_DISPLAY.tokenSymbols`, and `WALLET_DISPLAY.tokenBalances`.

Chain labels and dropdown options are config-driven through [`CHAIN_OPTIONS`](../../../altair_frontend1/config/ui_config.ts:231):
- Each entry has `enabled`, `isTestnet`, and two label groups: `activeNetwork` (used by the top network selector) and `walletDisplay` (used by panel/dropdown titles and chain dropdowns).
- `walletDisplay.dropdownLabel` and `walletDisplay.selectedLabel` populate the WALLET_PANEL title and the per-chain options. Testnet vs mainnet inclusion is gated by `enableTestnets` / `enableMainnets`.
- `ALL_CHAINS` is a synthetic entry used by the wallet/add-panel dropdowns to render an "All Chains" view; it has no `activeNetwork` labels.
### ADD_PANEL (panel adder)

The ADD_PANEL is the compact panel used to add new WALLET_PANEL instances. It is rendered beneath the wallet panel stack and persists across outside clicks. The ADD_PANEL includes:
- A left-aligned “Add Panel:” label (styled by `ADD_PANEL_DISPLAY.label`).
- A wallet icon button with a ring (colors + sizing from `ADD_PANEL_DISPLAY.iconButtons`).
- A chain dropdown that **excludes** chains already represented by open WALLET_PANEL instances.

Selecting a chain from the ADD_PANEL dropdown creates a new WALLET_PANEL instance using that chain. The new panel appears between the existing panels and the ADD_PANEL, pushing the ADD_PANEL downward.

Close behavior:
- Each WALLET_PANEL "×" removes only that panel.
- If the last WALLET_PANEL closes, the wallet icon in the top-right menu returns to its inactive state.

### TRANSACTION_INFO_PANEL

The TRANSACTION_INFO_PANEL is a wide-rectangle panel that surfaces the sell/buy summary of a swap-in-flight, transitioning from a pending state to a completed state once the swap settles. It is the third panel type registered in the PANEL System and was designed to feel like a peer of WALLET_PANEL and ADD_PANEL.

#### Layout

- Left section: sell token info — chain name (top), token icon (center), token symbol, token amount.
- Center: vertical stack of `"Executing"` (italic, while pending) → arrow `→` → `"View Transaction"` link (only after completion, links to the block explorer for the sell-chain transaction). On completion, `"Executing"` flips to `"Executed"`.
- Right section: buy token info — chain name, token icon, token symbol, token amount. Until the swap completes, the amount renders as `"Pending"` in italics, because the received amount is not knowable until balances are reconciled.

The component lives at [`altair_frontend1/src/components/panels/TransactionInfoPanel.tsx`](../../../altair_frontend1/src/components/panels/TransactionInfoPanel.tsx) and wraps the shared [`Panel`](../../../altair_frontend1/src/components/Panel.tsx) primitive (so the Altair logo, close "×", and `x.ENABLED` flag behave the same as on the other panel types).

#### Two display locations

A TRANSACTION_INFO_PANEL can appear in two places independently, both gated by `TRANSACTION_INFO_PANEL_DISPLAY.displayLocation`:

- **Side panel** (`displayLocation.sidePanel: true`) — rendered in `UserMenu.tsx`'s right-column panel stack, always second-to-last (immediately above the ADD_PANEL). The column auto-opens for a transaction panel even if the wallet menu itself is closed.
- **In-chat** (`displayLocation.inChat: true`) — rendered inline in `Chat.tsx` as a separate assistant message that appears immediately after the agent's randomly-selected `SWAP_SUBMITTED` text message (from [`altair_frontend1/config/ui_messages.ts`](../../../altair_frontend1/config/ui_messages.ts)). The panel-only message renders with the agent icon on the left but no text bubble.

The two locations use different chain-label sources: side-panel reads `CHAIN_OPTIONS[chainKey].transactionPanel.sidePanel`, in-chat reads `CHAIN_OPTIONS[chainKey].transactionPanel.inChat`. Both surfaces exist on every enabled chain in [`CHAIN_OPTIONS`](../../../altair_frontend1/config/ui_config.ts:231).

#### Config-driven styling

All visual properties for both variants are pulled from [`TRANSACTION_INFO_PANEL_DISPLAY`](../../../altair_frontend1/config/ui_config.ts:410) in `ui_config.ts`. The styling is split into two parallel sub-blocks so the two display locations can diverge cosmetically:

- `TRANSACTION_INFO_PANEL_DISPLAY.sidePanel.*` — consumed by `UserMenu.tsx` for the right-column panel.
- `TRANSACTION_INFO_PANEL_DISPLAY.inChat.*` — consumed by `Chat.tsx` for the in-chat message.

Each sub-block exposes the same surface: `logo` (Altair logo top-left toggle), `width`, paddings, `arrow` (color/size/font), `statusText` (`executingLabel`/`executedLabel`/font styles/colors/padding), `viewTransaction` (label, color, hover color, underline, padding), `leftSection.alignItems` / `rightSection.alignItems` (accept `'left'`/`'center'`/`'right'` and map to the corresponding `flex-*` value), `chainName`, `tokenSymbol`, `tokenAmount` (with `decimals` for rounding), `pendingText` (label + font style + color), `tokenIcons` (icon-resolution config mirroring `WALLET_DISPLAY.tokenIcons`), and `x` (with `ENABLED` flag).

#### State model

The panel state model lives in [`altair_frontend1/src/lib/usePanels.ts:8`](../../../altair_frontend1/src/lib/usePanels.ts) as `TransactionInfoPanelState`:
- `id` (stable key, monotonic from `transactionInfoPanelIdRef`)
- `txKey` (`txHash` ?? `requestId` from the swap event, for cross-event matching)
- `txHash` (used to build the explorer URL after completion)
- `sellChain` / `buyChain` (`ChainKey`)
- `sellToken` / `buyToken` (uppercase symbols)
- `sellAmount` (string, captured from the swap-submitted event)
- `buyAmount` (string | null — null while pending, computed delta on completion)
- `buyBalanceBeforeRaw` / `buyTokenDecimals` (snapshot of the buyToken's pre-swap balance, used to compute the received amount as a raw-units delta on completion)
- `status` (`'pending' | 'complete'`)

For the side panel, this state lives in `usePanels()` (`transactionInfoPanels` array + `addTransactionInfoPanel` / `updateTransactionInfoPanel` / `closeTransactionInfoPanel` helpers at [`usePanels.ts:119-144`](../../../altair_frontend1/src/lib/usePanels.ts)). For the in-chat variant, the state lives on the chat `Message` itself (`message.transactionInfoPanel`).

#### Lifecycle (event-driven)

The panel reacts to two browser-level swap events emitted from the swap libraries ([`useSwap.ts`](../../../altair_frontend1/src/lib/useSwap.ts), [`useSolanaSwap.ts`](../../../altair_frontend1/src/lib/useSolanaSwap.ts), [`useRelay.ts`](../../../altair_frontend1/src/lib/useRelay.ts)) via the typed dispatchers in [`altair_frontend1/src/lib/eventTypes.ts`](../../../altair_frontend1/src/lib/eventTypes.ts):

1. **`altair:swap-submitted`** — fires after the chain transaction is broadcast. Carries `sellToken`, `buyToken`, `sellChain`, `buyChain`, `amount`, `txHash`/`requestId`. Each display location listens and creates a new pending panel:
   - Side panel: `handleSwapSubmittedForPanel` at [`UserMenu.tsx:1449`](../../../altair_frontend1/src/components/UserMenu.tsx) — calls `addTransactionInfoPanel(...)` and snapshots the buy-token balance from `balancesByChain`.
   - In-chat: `handleSwapSubmittedInChat` at [`Chat.tsx:530`](../../../altair_frontend1/src/components/Chat.tsx) — appends a new panel-only assistant message and snapshots the buy-token balance from `localStorage` via `readCachedTokenSnapshot`.

2. **`altair:swap-complete`** — fires after the backend writeback completes. Carries `chain` (sell chain), `sellToken`, `buyToken`, and a `balanceUpdates` array of `{ chain, symbol, balanceAfterRaw, decimals }`. Both listeners:
   - Match the existing pending panel by `txKey` if available, otherwise by sell/buy tokens + sell chain.
   - Find the `balanceUpdate` entry for the buy token on the buy chain.
   - Compute `received = balanceAfterRaw - buyBalanceBeforeRaw` (raw units → human readable via `rawDeltaToHuman`).
   - Flip the panel to `status: 'complete'` with `buyAmount` set to the delta.
   - Side panel handler: `handleSwapCompleteForPanel` at [`UserMenu.tsx:1485`](../../../altair_frontend1/src/components/UserMenu.tsx).
   - In-chat handler: `handleSwapCompleteInChat` at [`Chat.tsx:588`](../../../altair_frontend1/src/components/Chat.tsx).

#### Surfacing the computed buyAmount to the agent's reply

After a single-chain swap completes, the agent emits a third chat message: `"Swap executed: ${action} ${amount} ${sellToken} for ${buyAmount} ${buyToken}."`. To make `buyAmount` real (instead of `'unknown'`), `Chat.tsx` writes the buyToken pre-swap balance snapshot to `pendingSwapSnapshotsRef` synchronously on `swap-submitted`, then computes and writes the delta to `completedSwapBuyAmountsRef` synchronously on `swap-complete` — both *outside* of `setMessages` so the refs are populated before React flushes any render. `executeIntentNow` then reads `completedSwapBuyAmountsRef.get(\`${sellToken}:${buyToken}:${sellChain}\`)` after `await executeSwap` / `executeSolanaSwap` resolves and substitutes it into the message text. If the ref is empty (e.g., relay/cross-chain path returns before writeback), the message falls back to `'unknown'`.

#### In-chat message sequence for a single-chain swap

The user-perceived chat sequence after clicking **Confirm** on a CONFIRM_SWAP button row is:

1. Assistant message with random `SWAP_SUBMITTED` text from `ui_messages.ts`.
2. Panel-only assistant message (agent icon + TRANSACTION_INFO_PANEL, pending state).
3. (The panel-only message updates in place to the completed state when `altair:swap-complete` fires.)
4. Assistant message with `Swap executed: ...` text plus the `TRANSACTION_SUBMITTED` follow-up button row.

The panel is created/updated by the event listeners; the surrounding text messages are added by the CONFIRM_SWAP handler in [`Chat.tsx`](../../../altair_frontend1/src/components/Chat.tsx) (`handleChatButtonRowAction`).

#### View Transaction link

When the panel is in the completed state and `txHash` is present, a `"View Transaction"` anchor is rendered below the arrow. The URL is built by chain-key lookup against `explorerUrl` values in [`altair_frontend1/config/chain_info.ts`](../../../altair_frontend1/config/chain_info.ts). The five canonical chains use `${explorerUrl}/tx/${txHash}`; Solana devnet is special-cased to `https://solscan.io/tx/${txHash}?cluster=devnet` because its `explorerUrl` is a query-string base.

#### Side-panel ordering

In the wallet panel column, TRANSACTION_INFO_PANELs always render between the wallet panels and the ADD_PANEL, regardless of how many are open. The visibility gate is `txInfoPanelShowInSidePanel` ([`UserMenu.tsx:525`](../../../altair_frontend1/src/components/UserMenu.tsx)), and the render position is enforced at [`UserMenu.tsx:3069`](../../../altair_frontend1/src/components/UserMenu.tsx).

### Panel state persistence across open/close cycles

When the wallet button is clicked to dismiss the panel stack (toggling `isWalletPanelOpen` off), the dismissal handler in [`altair_frontend1/src/components/UserMenu.tsx:2447`](../../../altair_frontend1/src/components/UserMenu.tsx) only clears the `walletPanels` array if there is exactly **one** panel open at the time of dismissal: `setWalletPanels((existing) => (existing.length === 1 ? [] : existing));`. If two or more panels are open, the array is left intact.

On the next wallet button click, `initWalletPanels` (in [`altair_frontend1/src/lib/usePanels.ts:46`](../../../altair_frontend1/src/lib/usePanels.ts)) detects `existing.length > 0` and skips re-initialization, so the previous panel configuration (all open chains) is restored. This is intentional: panels remember their state across open/close cycles when more than one panel was open.

---

## Balance update behavior in wallet panels

Wallet panels and the wallet dropdown render from the same balance state (`balancesByChain`) in [`UserMenu.tsx:70`](../../../altair_frontend1/src/components/UserMenu.tsx).

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

Reference: [`handleSwapComplete()`](../../../altair_frontend1/src/components/UserMenu.tsx) at line 1131.

### Why this matters for panel mode

Historically, selected-chain gating could delay destination-chain persistence/reconciliation in panel views for cross-chain operations. Current behavior force-refreshes all chains in `balanceUpdates`, so wallet panels should converge quickly even when the selected chain is different from the swap origin chain.

---

## Panel mode vs durability nuances

- Panel-mode balance changes can appear instantly due to local event-driven updates.
- Durable Mongo persistence is handled by backend write paths (`/api/balances` reconciliation + relay writeback persistence).
- Panel rendering is intentionally non-blocking: UI responsiveness first, authoritative convergence shortly after.

For full backend persistence details, see [`Balances.md`](./Balances.md) and [`MongoDB.md`](./MongoDB.md).
