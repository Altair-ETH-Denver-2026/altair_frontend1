# Manual testing (localhost:3000)

Use these steps to confirm features that are not fully covered by unit tests (e.g. Privy wallet flows, Solana swap E2E).

## Prerequisites

- Backend running: `cd altair_backend1 && npm run dev` (port 3001)
- Frontend running: `cd altair_frontend1 && npm run dev` (port 3000)
- `.env` (and backend `.env`) populated with Privy, RPC, and API keys as needed

---

## 1. Login & wallet (Privy)

- Open http://localhost:3000
- Log in with email or Google (Privy)
- Confirm wallet dropdown shows and you can switch chains (Base, Ethereum, Arbitrum, Solana)

## 2. Network selector & Solana (Group 9, PR #14)

- In the wallet/header UI, open the network selector
- Confirm **Solana Mainnet** and **Arbitrum One** appear
- Select **Solana Mainnet** and confirm SOL balance (and USDC) are shown; withdraw option should be hidden on Solana

## 3. Chat & sample prompts (Commits: 4c4aff4, f12aaca)

- Open the chat view
- Confirm welcome message and **Swap** / **Stake** / **Yield** sample prompt buttons
- Click **Swap** and confirm the prompt is sent and the AI responds
- Send a swap intent in natural language (e.g. “Swap 0.01 ETH for USDC on Base”) and confirm the app executes or prompts correctly

## 4. Withdraw (Commit: 4c4aff4)

- Select an EVM network (e.g. Base)
- Open withdraw modal (e.g. from UserMenu)
- Enter recipient address and amount; click **Max** and confirm amount is balance minus a small gas buffer (e.g. 0.001 ETH)
- Cancel or complete send and confirm balance updates

## 5. Solana swap (Group 9, PR #14)

- Select **Solana Mainnet**
- In chat, ask to swap SOL for USDC (or USDC for SOL)
- Confirm Jupiter quote is requested and, after you approve in Privy, the transaction is signed and sent via Privy’s Solana flow
- Confirm success and that the tx link goes to Solscan

## 6. Tx explorer links (Commit: 6cbd782)

- After any swap (EVM or Solana), confirm the success message includes a tx hash link
- Solana → Solscan; Base → Basescan; Ethereum → Etherscan; Arbitrum → Arbiscan

## 7. Portfolio / balances (Commits: b4deff2, 778008d)

- In chat, ask for “my portfolio” or “balances on all chains”
- Confirm the AI can respond with balances for Solana, Base, Ethereum, Arbitrum (when configured)

---

## Running automated tests (no server required)

```bash
# Frontend
cd altair_frontend1 && npm run test

# Backend
cd altair_backend1 && npm run test
```

## Backend integration scripts (server must be running on 3001)

```bash
# Swap history (401 without auth; 200 with ACCESS_TOKEN)
./scripts/test-swap-history.sh
ACCESS_TOKEN=<privy_token> ./scripts/test-swap-history.sh

# Positive balances (requires ACCESS_TOKEN)
ACCESS_TOKEN=<privy_token> ./scripts/test-positive-balances.sh
```
