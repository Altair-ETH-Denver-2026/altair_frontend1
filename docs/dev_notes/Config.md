# Configuration Overview

This project centralizes runtime and UI configuration in the root-level [`config`](config/blockchain_config.ts) directory. The application code imports these modules directly instead of relying on scattered constants or `.env` values for chain and token metadata. This file documents each config module, what it contains, and where it is consumed.

## `blockchain_config.ts`

**Purpose:** Defines the chain key system used throughout the app.

**Exports:**
- `BLOCKCHAIN`: the default chain key (e.g., `ETH_SEPOLIA`).
- `WRAP_ETH`: whether ETH should be wrapped to WETH before swaps.
- `CHAINS`: enum-like map of supported chain keys.
- `ChainKey`: union type derived from `CHAINS` keys.

**Usage:**
- Chain resolution and validation are driven by `CHAINS`/`ChainKey` in [`useSwap`](src/lib/useSwap.ts:5), [`balances` API](src/app/api/balances/route.ts:4), and [`test-swap` API](src/app/api/test-swap/route.ts:5).
- UI chain switching uses the same keys in [`UserMenu`](src/components/UserMenu.tsx:8).

## `chain_info.ts`

**Purpose:** Holds per-chain metadata (RPC endpoints, scan URLs, Uniswap addresses). RPC endpoints are stored as lists with the Alchemy URL first. At runtime, the Alchemy API key is substituted via `resolveRpcUrls()`.

**Exports:**
- `BASE_SEPOLIA`, `ETH_SEPOLIA`, `ETH_MAINNET`, `BASE_MAINNET`: each contains:
  - `chainId`
  - `rpcUrls` (array; Alchemy first)
  - `explorerUrl`
  - `uniswapAddresses` (`router`, `factory`, `swapRouter`)
- `resolveRpcUrls(rpcUrls)`: replaces `ALCHEMY_API_KEY` placeholder using env vars.

**Usage:**
- RPC URL lists are resolved and used in [`balances` API](src/app/api/balances/route.ts:62) and [`test-swap` API](src/app/api/test-swap/route.ts:81).
- Chain IDs and RPC URLs are consumed in [`useSwap`](src/lib/useSwap.ts:38).

## `token_info/*`

**Purpose:** Per-network token metadata for WETH and USDC. All token addresses are defined here (no `.env` dependency).

**Files:**
- [`base_testnet_sepolia_tokens.ts`](config/token_info/base_testnet_sepolia_tokens.ts:1)
- [`eth_sepolia_testnet_tokens.ts`](config/token_info/eth_sepolia_testnet_tokens.ts:1)
- [`eth_tokens.ts`](config/token_info/eth_tokens.ts:1)
- [`base_tokens.ts`](config/token_info/base_tokens.ts:1)

**Each file exports:**
- `WETH` and `USDC` objects with:
  - `symbol`
  - `name`
  - `address`

**Usage:**
- Token addresses are used in [`balances` API](src/app/api/balances/route.ts:86), [`test-swap` API](src/app/api/test-swap/route.ts:92), and [`useSwap`](src/lib/useSwap.ts:108).

## `ui_config.ts`

**Purpose:** UI and display constants.

**Exports:**
- `BALANCE_DECIMALS`: formatting precision for balance display.
- `LOGO_SPIN_MIN_MS` / `LOGO_SPIN_MAX_MS`: hover spin timings.
- `X_SIZE`: close "×" font size.
- `WALLET_DISPLAY`: UI mode config (`panel` vs `drop_down`), including `getCrypto.link` for external affiliate links.
  - `WALLET_DISPLAY.tokenIcons`: token icon path and fallback behavior controls (`fileType`, `fileSize`, `size`, `placeholderColor`, `placeholderFontColor`, `spin`).
  - `WALLET_DISPLAY.chainDropdown`: wallet chain dropdown style controls (`width`, `fontSize`, `fontName`, `fontColor`, `allCaps`, `letterSpacing`, `itemColor`, `itemHighlightColor`, `itemHeight`).
  - `ADD_PANEL_DISPLAY.chainDropdown`: add-panel chain dropdown style controls (`width`, `fontSize`, `fontName`, `fontColor`, `allCaps`, `letterSpacing`, `itemColor`, `itemHighlightColor`, `itemHeight`).
- `MENU_ICONS`: spacing, size, and visual styling for the top-right icon row (offsets, justification, size, icon/container colors, border color/width, highlight color).
- `ACTIVE_NETWORK_DROPDOWN`: styling configuration for the active network dropdown menu (`width`, `fontSize`, `fontName`, `fontColor`, `allCaps`, `letterSpacing`, `itemColor`, `itemHighlightColor`, `itemHeight`). Note: This configures only the dropdown itself; the button that triggers the dropdown uses `MENU_ICONS` for styling.
- `HOME_ICON`: independent position/size config for the top-left home logo.
- `TITLE_PANEL`: offsets, text spacing, logo size, gradient colors, and overall scale for the title block.
- `CHAT_PANEL`: sizing, border, and color palette for the chat container and bubbles (panel size, border, bubble/text colors, input focus highlight, agent icon border, and send button colors).

**Usage:**
- Menu icon layout and styling in [`UserMenu`](src/components/UserMenu.tsx:8).
- Active network dropdown styling in [`UserMenu`](src/components/UserMenu.tsx:1650).
- Wallet chain dropdown styling (panel + dropdown modes) in [`UserMenu`](src/components/UserMenu.tsx:135) and [`WalletPanel`](src/components/panels/WalletPanel.tsx:232).
- Add-panel chain dropdown styling in [`UserMenu`](src/components/UserMenu.tsx:303) and [`AddPanel`](src/components/panels/AddPanel.tsx:138).
- Home logo positioning/sizing in [`page.tsx`](src/app/page.tsx:16).
- Title block sizing/spacing/gradient in [`page.tsx`](src/app/page.tsx:51).
- Chat container/bubble/button/input styling in [`Chat`](src/components/Chat.tsx:145).
- Logo hover animation timing in [`SpinningLogo`](src/components/SpinningLogo.tsx:5).
- Token icon rendering + fallback behavior in [`UserMenu`](src/components/UserMenu.tsx:1147) and spin behavior in [`SpinningLogo`](src/components/SpinningLogo.tsx:11).
- "Get Crypto" button linking via `WALLET_DISPLAY.getCrypto.link` in [`UserMenu`](src/components/UserMenu.tsx:1745) and [`WalletPanel`](src/components/panels/WalletPanel.tsx:397).

## `external_links.ts`

**Purpose:** Centralized configuration for external affiliate links and third-party URLs.

**Exports:**
- `AFFILIATE_LINKS`: Object containing affiliate/referral links for external services.
  - `Coinbase`: Coinbase Advanced affiliate link for cryptocurrency purchases.

**Usage:**
- Imported by `ui_config.ts` to provide `WALLET_DISPLAY.getCrypto.link` value.
- Used by "Get Crypto" buttons in [`UserMenu`](src/components/UserMenu.tsx:1745) and [`WalletPanel`](src/components/panels/WalletPanel.tsx:397) to link users to external cryptocurrency purchase platforms.
- Provides a single source of truth for external URLs, making it easy to update affiliate links or add new external services.

## General Import Rules

- Chain key logic (`BLOCKCHAIN`, `CHAINS`, `ChainKey`) comes from [`blockchain_config`](config/blockchain_config.ts:1).
- Chain RPC/scan/Uniswap metadata comes from [`chain_info`](config/chain_info.ts:1).
- Token addresses come from the appropriate file under [`token_info`](config/token_info/base_tokens.ts:1).
- UI constants and display flags come from [`ui_config`](config/ui_config.ts:1).
- External affiliate links and third-party URLs come from [`external_links`](config/external_links.ts:1).
