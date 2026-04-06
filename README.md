# Altair Frontend (`altair_frontend1`)

This package is the user-facing Next.js frontend for Altair. It handles chat UX, wallet/panel UX, chain selection, swap/bridge execution orchestration, immediate balance rendering, and frontend-side reconciliation triggers.

---

## Frontend responsibilities

The frontend is responsible for:

- rendering the conversation UI and action confirmations,
- orchestrating swap/bridge flows through backend APIs and wallet providers,
- managing wallet display modes (panel vs dropdown),
- maintaining fast local balance state/cache,
- dispatching and reacting to swap completion events for immediate UI updates and follow-up refresh.

Backend remains the authority for durable persistence and blockchain verification.

---

## Tech stack

- Next.js App Router + React + TypeScript
- Privy React SDK (`@privy-io/react-auth` + Solana module)
- Ethers + Solana Web3 helpers in frontend execution hooks

Core entry points:

- App shell: [`src/app/layout.tsx`](src/app/layout.tsx)
- Main page: [`src/app/page.tsx`](src/app/page.tsx)
- Providers: [`src/app/providers.tsx`](src/app/providers.tsx)

---

## Key frontend modules

### 1) Chat UI and intent execution

- Component: [`src/components/Chat.tsx`](src/components/Chat.tsx)
- Responsibilities:
  - parse/track chat messages,
  - call backend chat API,
  - trigger swap or relay execution via hooks,
  - manage confirmation button rows and chat flow state.

### 2) Wallet UI + panel system

- Main wallet controller: [`src/components/UserMenu.tsx`](src/components/UserMenu.tsx)
- Panel components:
  - [`src/components/panels/WalletPanel.tsx`](src/components/panels/WalletPanel.tsx)
  - [`src/components/panels/AddPanel.tsx`](src/components/panels/AddPanel.tsx)
  - Base panel: [`src/components/Panel.tsx`](src/components/Panel.tsx)
- Panel state helper: [`src/lib/usePanels.ts`](src/lib/usePanels.ts)

Wallet display mode is configured in [`config/ui_config.ts`](config/ui_config.ts) (`WALLET_DISPLAY`).

### 3) Swap and relay execution hooks

- EVM swap: [`src/lib/useSwap.ts`](src/lib/useSwap.ts)
- Solana swap: [`src/lib/useSolanaSwap.ts`](src/lib/useSolanaSwap.ts)
- Solana transfer: [`src/lib/useSolanaTransfer.ts`](src/lib/useSolanaTransfer.ts)
- Cross-chain relay: [`src/lib/useRelay.ts`](src/lib/useRelay.ts)

These hooks execute chain actions and emit `altair:swap-complete` to drive wallet/balance UI updates.

---

## Balance behavior in the frontend

The frontend uses a two-speed balance model:

1. **Immediate UX path**
   - local state (`balancesByChain`) + localStorage cache in [`UserMenu.tsx`](src/components/UserMenu.tsx)
   - immediate optimistic-style updates from `altair:swap-complete` `balanceUpdates`

2. **Reconciliation path**
   - `/api/balances` fetch per affected chain,
   - forced refresh after swap-complete for all affected chains,
   - state + cache replacement with normalized server payload.

Important behavior:

- Wallet panel and wallet dropdown read from the same state source in [`UserMenu.tsx`](src/components/UserMenu.tsx), so both reflect the same balance snapshot.
- Cache stale markers are applied on swap-complete before forced refetch.

---

## Relay frontend reliability improvements

The relay execution flow in [`useRelay.ts`](src/lib/useRelay.ts) includes:

- quote freshness gating (stale quote detection),
- stricter EVM preflight checks (chain sanity, nonce snapshot, `eth_estimateGas`, `eth_call`),
- smarter retries (re-quote path + transient transport retry backoff).

These reduce avoidable estimate-gas reverts and improve convergence reliability.

---

## How frontend functionality is used by the backend

Strictly speaking, the backend does not import frontend code directly. Instead, backend behavior depends on the **request/event contracts** produced by frontend components and hooks.

### 1) Chat contract consumed by backend

- [`Chat.tsx`](src/components/Chat.tsx) sends user prompts and context to [`POST /api/chat`](../altair_backend1/src/app/api/chat/route.ts).
- Backend uses this payload to produce assistant responses, intent metadata, and chat persistence.

### 2) Balance request contract consumed by backend

- [`UserMenu.tsx`](src/components/UserMenu.tsx) sends chain/address/access-token context to [`POST /api/balances`](../altair_backend1/src/app/api/balances/route.ts).
- Backend uses those inputs to resolve UID/wallet scope, choose Mongo-fast vs chain-refresh path, and persist verified balances.

### 3) Swap writeback contract consumed by backend

- [`useSwap.ts`](src/lib/useSwap.ts) and [`useSolanaSwap.ts`](src/lib/useSolanaSwap.ts) post execution writeback payloads to [`POST /api/test-swap`](../altair_backend1/src/app/api/test-swap/route.ts).
- Backend uses those payload fields to create swap records and link chat intent execution state.

### 4) Relay route + writeback contracts consumed by backend

- [`useRelay.ts`](src/lib/useRelay.ts) submits quote requests to [`POST /api/relay/quote`](../altair_backend1/src/app/api/relay/quote/route.ts).
- After execution, frontend submits writeback payload (`sellToken`, `buyToken`, `balanceBefore`, `balanceAfter`, chain/symbol/address data) to [`POST /api/relay/writeback`](../altair_backend1/src/app/api/relay/writeback/route.ts).
- Backend uses this payload for:
  - swap history persistence,
  - CID/SID chat linkage,
  - durable `User.balances` writes from frontend-reported post-trade snapshots.

### 5) `altair:swap-complete` as reconciliation trigger source

- Frontend emits `altair:swap-complete` from swap/relay hooks.
- Wallet UI consumes it and force-refreshes affected chains via `/api/balances`.
- This frontend trigger pattern drives backend reconciliation/persistence cadence for near-term convergence after execution.

### 6) Config values that shape backend behavior indirectly

- Frontend chain/token/relay config in [`config`](config) determines request fields (chain keys, symbols, addresses, decimals) sent to backend endpoints.
- Backend route logic relies on those values being aligned with backend config modules.

---

## Configuration files

- UI config: [`config/ui_config.ts`](config/ui_config.ts)
- AI client config: [`config/ai_config.ts`](config/ai_config.ts)
- Chain/key config: [`config/blockchain_config.ts`](config/blockchain_config.ts)
- RPC and explorer config: [`config/chain_info.ts`](config/chain_info.ts)
- Token lists per chain: [`config/token_info`](config/token_info)

---

## Running the frontend

From repository root:

```bash
cd altair_frontend1
corepack yarn install
corepack yarn dev
```

Default local URL: `http://localhost:3000`

Type check:

```bash
yarn tsc --noEmit
```

---

## Related documentation

- Root overview: [`../README.md`](../README.md)
- Backend balance details: [`../altair_backend1/docs/dev_notes/Balances.md`](../altair_backend1/docs/dev_notes/Balances.md)
- Mongo details: [`../altair_backend1/docs/dev_notes/MongoDB.md`](../altair_backend1/docs/dev_notes/MongoDB.md)
- Panel behavior details: [`../altair_backend1/docs/dev_notes/Panels.md`](../altair_backend1/docs/dev_notes/Panels.md)
