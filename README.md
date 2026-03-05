# Altair Frontend (UI)

This repository contains the Next.js UI for Altair and proxies API requests to the backend service.

## Run Locally

```bash
corepack yarn install
corepack yarn dev
```

Frontend runs at `http://localhost:3000`.

## Environment Variables

Copy `.env.example` to `.env` and fill in values.

- `NEXT_PUBLIC_PRIVY_APP_ID`
- `NEXT_PUBLIC_ALCHEMY_API_KEY` (optional but recommended)
- `NEXT_PUBLIC_BACKEND_URL` (default `http://localhost:3001`)
- `NEXT_PUBLIC_SOLANA_RPC_URL` (optional; recommended for Solana/Relay — e.g. Helius)

## Relay (bridging & cross-chain swaps)

The frontend integrates with [Relay](https://relay.link) for **bridging** (same token across chains) and **cross-chain swapping** (e.g. ETH on Base → SOL on Solana). All Relay API calls go through the backend proxy; no API key is used on the client.

- **Chat-driven:** Ask in chat to bridge or cross-chain swap (e.g. “Bridge 0.1 ETH from Base to Ethereum”, “Swap 0.1 ETH from Base mainnet for SOL on Solana mainnet”). The model returns a bridge or cross-chain swap intent and the app executes it via the Relay proxy.
- **Playground vs Mainnet:** A **Playground** pill (testnets: Base Sepolia, Ethereum Sepolia) or **Mainnet** pill appears next to the network selector. Relay uses testnet when you’re in Playground.
- **Dependency:** `@relayprotocol/relay-sdk` is in `package.json`. If install fails due to peer conflicts, run `npm install --legacy-peer-deps` (or use your project’s package manager).
- **Backend:** Requires the backend Relay proxy routes (`/api/relay/quote`, `/api/relay/chains`, etc.); see the backend README for optional `RELAY_API_KEY` and rate limits.

**Backend proxy (best practice):** The backend should expose the Relay proxy routes as public (no auth) so the frontend can call them. The API key must never be sent from the frontend: keep `RELAY_API_KEY` only in backend env (e.g. Render). With no key set, Relay default rate limits apply; when you add a key, the proxy sends it server-side only. No change needed to exposing the routes—they are meant to be called by your app.
