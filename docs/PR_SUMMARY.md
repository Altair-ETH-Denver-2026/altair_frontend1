# PR Summary: Altair dev branch (Backend 7 commits + Frontend 6 commits)

This document summarizes what the **7 commits** on the dev branch of **altair_backend1** and the **6 commits** on the dev branch of **altair_frontend1** deliver together: new features, new functionality, and improvements/issues resolved.

---

## Summary

The two-repo split (frontend on port 3000, backend on 3001) now includes full 0G storage integration, 0x and Jupiter swap flows, Privy auth across EVM and Solana, AI chat with wallet-aware context and swap intent execution, withdraw on EVM chains, and Solana mainnet support with Jupiter and Privy’s recommended @solana/kit sign-and-send flow. Fixes cover 0x v2 mainnet native ETH, EVM balance fetching with viem chains, RPC/WebSocket handling for Solana, and build/type safety.

---

## New features and functionality

- **0G diagnostics and storage**  
  GET `/api/test-zg-inference-storage-e2e`, `scripts/diag-0g-submit.js` (npm `diag:0g-submit`), chat token from cookie then body, `[0G]` pre-read/post-write logging.

- **Swap (0x)**  
  0x Swap API v2 for mainnets (Base, Ethereum) with chainId; v1 fallback for ETH_SEPOLIA/BASE_SEPOLIA; native ETH sentinel for v2; sell/buy ETH and ERC20 (WETH, USDC, USDT, DAI); default chain BASE_SEPOLIA; WRAP_ETH support.

- **Swap history (0G)**  
  Swap history persisted per user; GET `/api/swap-history` (cookie or `accessToken`, optional limit); chat injects last 10 swaps into system prompt; POST `/api/record-swap`; `scripts/test-swap-history.sh` and npm `test:swap-history`.

- **Chat**  
  Base prompt (personality, rules, SWAP_INTENT); `buildSystemPrompt`; OPENAI_CHAT_MODEL env; welcome message and sample prompts (Swap / Stake / Yield) that submit on click; getAccessToken + localStorage fallback; credentials include; code-block SWAP_INTENT parsing; clearer swap errors (insufficient funds, replacement underpriced); send `selectedChain` for balance context.

- **AI balance context**  
  Server-side `fetchUserBalanceForChain` (EVM: ETH, USDC, WETH); chat injects wallet balances into system prompt; portfolio balances for Base, Ethereum, Arbitrum mainnets in prompt; viem chains for correct EVM client.

- **Positive-balances API**  
  GET/POST `/api/balances/positive` — only tokens with balance > 0; optional chains filter; `scripts/test-positive-balances.sh` and npm `test:positive-balances`.

- **Withdraw**  
  `useWithdraw(chainKey)` (send native ETH on selected chain); withdraw modal in UserMenu (recipient, amount, Max = balance − 0.001 ETH gas buffer); Cancel/Send; balance refresh after send.

- **Docs**  
  MODEL_README.md (base prompt, personality, file locations); README diagnostics, swap section, env notes, testnet vs mainnet.

- **Privy**  
  Support for `PRIVY_WALLET_AUTH_PRIVATE_KEY` or `PRIVY_WALLET_AUTHORIZATION_PRIVATE_KEY`.

- **Solana (backend)**  
  SOLANA_MAINNET in config; `getPrivySolanaWalletAddress`; Jupiter Swap API (GET quote, POST swap → base64); `fetchUserBalanceForChain` Solana branch (SOL, USDC, JUP, RAY, KMNO, DRIFT, W); balances and positive-balances/chat portfolio include Solana; `config/solana_config.ts`, `config/token_info/solana_tokens.ts`.

- **Solana (frontend)**  
  SOLANA_MAINNET in config and network selector; Arbitrum One + Solana in dropdown; SOL balance and USDC in wallet when chain is Solana; withdraw hidden on Solana; `useSolanaSwap` (Jupiter quote + swap via backend, sign/send via Privy); Chat uses Solana swap for SOL/USDC when chain is Solana; tx hash links (Solscan for Solana, Etherscan/Basescan/Arbiscan for EVM).

- **@solana/kit + Privy signAndSendTransaction (PR #14)**  
  PrivyProvider `config.solana.rpcs['solana:mainnet']` via `createSolanaRpc` / `createSolanaRpcSubscriptions` (@solana/kit); `useWallets` + `useSignAndSendTransaction` from `@privy-io/react-auth/solana`; bs58 for signature; 403 hint for public RPC.

- **Automated tests**  
  Backend: Vitest unit tests for config, swap-history, jupiter-swap, balances/positive, record-swap; frontend: Vitest config and blockchain_config tests; manual testing docs in both repos.

---

## Improvements and issues resolved

- **0x v2 mainnet**  
  Use lowercase native ETH sentinel `0xeeee...eeee` for v2 (fixes “Invalid ethereum address” when swapping USDC→ETH or ETH→USDT on mainnet); v1 testnets keep string `'ETH'`.

- **Balances API**  
  DAI typing for testnet chains; handle missing DAI in config.

- **Database**  
  `MONGODB_URI` check before `mongoose.connect` (throw if undefined).

- **Privy user type**  
  Assert `profile` / `wallet` on Privy user where type lacked optional fields.

- **Chat route**  
  `history`/`message` types and `buildUpdatedChatSummary` message arg (Array.isArray(history), typeof message === 'string' ? message : '').

- **Build**  
  Exclude `working_swap_code` from tsconfig so backend build succeeds.

- **EVM balance fetch**  
  Try/catch `getPrivyEvmWalletAddress` with log on failure; guard empty RPC URL; use viem chain objects (mainnet, base, arbitrum) for correct EVM client config.

- **Solana RPC / WebSocket**  
  RPC 403 handling; derive WebSocket URL from HTTP when `NEXT_PUBLIC_SOLANA_RPC_WS` unset (e.g. Helius); README notes on public RPC limits and custom RPC.
