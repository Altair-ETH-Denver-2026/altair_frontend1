import { none } from '@solana/kit';
import { AFFILIATE_LINKS } from './external_links';

export const BALANCE_DECIMALS = 8; // Token balance display precision used in renderBalances in altair_frontend1/src/components/UserMenu.tsx
export const LOGO_SPIN_MIN_MS = 400; // Min logo spin duration used by logo animation logic (see altair_frontend1/src/components/SpinningLogo.tsx)
export const LOGO_SPIN_MAX_MS = 2000; // Max logo spin duration used by logo animation logic (see altair_frontend1/src/components/SpinningLogo.tsx)
export const X_SIZE = 25; // Base close icon size referenced by panel close sizing conventions (see altair_frontend1/src/components/UserMenu.tsx)

export const PANEL_DISPLAY = {
  logo: {
    size: 20,
    paddingLeft: 3,
    paddingTop: 1,
    opacity: 75,
  },
};

export const ACTIVE_NETWORK_DROPDOWN = {
  width: 360, // w-48 = 48 * 4 = 192px (Tailwind w-48 = 12rem = 192px)
  fontSize: 14, // text-sm = 14px
  fontName: 'monospace', // default font
  fontColor: '#d1d5db', // text-gray-300
  itemColor: '#101828', // bg-gray-900
  itemHighlightColor: '#1f2937', // hover:bg-gray-800
  itemHeight: 36, // py-3 = 12px top + bottom, estimated total height
  selectedItemColor: '#1f2937',
  allCaps: true,
  letterSpacing: '0.3em',
  MENU_ICONS_override: {
    buttonText: {
      
    },
    chainIcon: {
      fileType: 'webp',
      fileSize: '64px',
      size: 25,
      borderPosition: 'outer',
      borderColor: null,
      borderWidth: null,
      placeholderColor: '#1F2937',
      placeholderFontColor: '#d1d5db',
      placeholderFontSize: 14,
      spin: true,
    },
  },
  chainIcons: {
    fileType: 'webp',
    fileSize: '64px',
    size: 23,
    borderPosition: 'outer',
    borderColor: null,
    borderWidth: null,
    selectedBorder: true,
    selectedBorderColor: '#d1d5db',
    selectedBorderWidth: 3,
    selectedPlaceholder: false,
    placeholderColor: '#1F2937',
    placeholderFontColor: '#09ff00',
    placeholderFontSize: 116,
    spin: true,
  },
}

export const WALLET_DISPLAY = { // Wallet panel/dropdown sizing and typography config consumed in altair_frontend1/src/components/UserMenu.tsx
  logo: true,
  options: ['panel', 'drop_down'] as const, // Allowed wallet UI modes read in UserMenu.tsx
  active: 'panel', // Active mode switch used in UserMenu.tsx
  width: 270, // Panel/dropdown width in UserMenu.tsx
  paddingLeft: 14, // Left padding for wallet rows in UserMenu.tsx
  paddingRight: 8, // Right padding for wallet rows in UserMenu.tsx
  buttonWidth: 25, // Button horizontal padding multiplier in UserMenu.tsx
  buttonHeight: 32, // Button height base in UserMenu.tsx
  buttonColor: 'rgba(31, 41, 55, 0.6)', // Default top-row button background (bg-gray-800/60) in UserMenu.tsx
  buttonBorderColor: '#374151', // Default top-row button border (border-gray-700) in UserMenu.tsx
  buttonHighlightColor: '#2a3748', // Hover top-row button background (bg-gray-800) in UserMenu.tsx
  buttonHighlightBorderColor: '#6b7280', // Hover top-row button border (border-gray-500) in UserMenu.tsx
  buttonActiveColor: 'rgba(59, 130, 246, 0.2)', // Active top-row button background (bg-blue-500/20) in UserMenu.tsx
  buttonActiveBorderColor: '#60a5fa', // Active top-row button border (border-blue-400) in UserMenu.tsx
  buttonSize: 1, // Global wallet size scalar in UserMenu.tsx
  rows: { // Token row vertical padding config used in renderBalances in UserMenu.tsx
    paddingTop: 5, // Top padding per token row in UserMenu.tsx
    paddingBottom: 5, // Bottom padding per token row in UserMenu.tsx
  },
  tokenSymbols: { // Token symbol typography in renderBalances in UserMenu.tsx
    fontSize: 13, // Token symbol font size in UserMenu.tsx
    fontName: 'sans-serif', // Token symbol font family in UserMenu.tsx
    color: '#ffffff', // Token symbol color in UserMenu.tsx
    lineHeight: 1.2, // Unitless line-height; <1 lets the line box hug the glyph, removing residual leading
    paddingBottom: 0, // Bottom padding between symbol and the price beneath it in UserMenu.tsx
  },
  tokenBalances: { // Token balance typography and precision in renderBalances in UserMenu.tsx
    fontSize: 15, // Token balance font size in UserMenu.tsx
    fontName: 'sans-serif', // Token balance font family in UserMenu.tsx
    color: '#f3f4f6', // Token balance color in UserMenu.tsx
    decimals: 6, // Token balance decimal precision in UserMenu.tsx
  },
  tokenIcons: { // Token icon config used in renderBalances in UserMenu.tsx
    fileType: 'webp', // Image file extension in UserMenu.tsx
    fileSize: '64px', // Subfolder name under public/image/tokens/<fileType>/ in UserMenu.tsx
    size: 25, // Rendered icon size in pixels in UserMenu.tsx
    borderPosition: 'inner',
    borderColor: null,
    borderWidth: null,
    placeholderColor: '#1F2937',
    placeholderFontColor: '#d1d5db',
    placeholderFontSize: 14,
    spin: true,
  },
  chainIcons: {
    fileType: 'webp',
    fileSize: '64px',
    size: 20,
    borderPosition: 'outer',
    borderColor: null,
    borderWidth: null,
    placeholderColor: '#1F2937',
    placeholderFontColor: '#d1d5db',
    placeholderFontSize: 14,
    spin: true,
  },
  title: { // Wallet panel title padding and font in UserMenu.tsx
    paddingTop: 2, // Title top padding in UserMenu.tsx
    paddingBottom: 2, // Title bottom padding in UserMenu.tsx
    fontSize: 11, // Title font size in UserMenu.tsx
    fontName: 'monospace', // Title font family in UserMenu.tsx
    chainIcon: {
      fileType: 'webp',
      fileSize: '64px',
      size: 15,
      borderPosition: 'outer',
      borderColor: null,
      borderWidth: null,
      placeholderColor: '#1F2937',
      placeholderFontColor: '#d1d5db',
      placeholderFontSize: 14,
      spin: true,
    },
  },
  x: { // Wallet panel close “×” placement and sizing in UserMenu.tsx
    ENABLED: true,
    paddingTop: 0, // Close top offset in UserMenu.tsx
    paddingRight: 6, // Close right offset in UserMenu.tsx
    size: 23, // Close icon size in UserMenu.tsx
    fontName: 'sans-serif', // Close font family in UserMenu.tsx
  },
  walletAddressButton: {
    activeDuration: 1.5,
    fontSize: 13,
    fontName: 'sans-serif',
    fontColor: '#f3f4f6',
    label: {
      fontSize: 14,
      fontName: 'sans-serif',
      fontColor: '#d1d5db'
    }
  },
  chainDropdown: { // Wallet chain dropdown sizing in UserMenu.tsx
    width: 220, // Dropdown width in UserMenu.tsx
    fontSize: 12, // Dropdown font size in UserMenu.tsx
    fontName: 'monospace',
    fontColor: '#d1d5db',
    allCaps: true,
    letterSpacing: '0.3em',
    itemColor: '#111827',
    itemHighlightColor: '#1f2937',
    itemHeight: 32,
  },
  tokenDropdown: { 
    width: 124,
    fontSize: 12,
    fontName: 'sans-serif',
  },
  getCrypto: {
    link: AFFILIATE_LINKS.Coinbase
  },
  withdraw: {
    symbolInput: {
      paddingLeft: 4,
      paddingRight: 4,
    },
    MAX: {
      fontSize: 11,
      color: '#60a5fa',
      highlightColor: '#a2c7ff',
      inactiveColor: '#676869'
    },
    dollarValue: {
      fontSize: 14,
      fontName: 'sans-serif',
      color: '#d1d5db',
      paddingLeft: 0,
      paddingRight: 0,
      width: 60,
    },
    amountInput: {
      paddingLeft: 5,
      paddingRight: 40,
      fontSize: 14,
      color: '#f3f4f6',
    },
    addressInput: {
      paddingLeft: 5,
      paddingRight: 5,
      fontSize: 12,
      color: '#f3f4f6',
    },
    submitButton: {
      textColor: '#f3f4f6',
      borderColor: "#f3f4f6",
      buttonColor: "#3b8b4f",
      highlightColor: '#47a45e',
      activeColor: '#55be6f',
      activeBorderColor: "#ffffff",
      borderWidth: 1,
      paddingLeft: 8,
      paddingRight: 8,
      fontSize: 12,
    },
    cancelButton: {
      textColor: '#f3f4f6',
      borderColor: "#f3f4f6",
      buttonColor: "#c74848",
      highlightColor: '#e65757',
      activeColor: '#ff7575',
      activeBorderColor: "#ffffff",
      borderWidth: 1,
      fontSize: 12,
      paddingLeft: 8,
      paddingRight: 8
    }
  },
  tokenPrices: { // USD price shown below each token symbol in renderBalances in UserMenu.tsx
    fontSize: 11, // Token price font size in UserMenu.tsx
    fontName: 'sans-serif', // Token price font family in UserMenu.tsx
    color: '#8f96a0', // Token price color in UserMenu.tsx
    decimals: 2, // Token price decimal precision in UserMenu.tsx
    lineHeight: 1, // Unitless line-height; <1 lets the line box hug the glyph, removing residual leading
    paddingTop: 2, // Top padding between symbol and price in UserMenu.tsx
  },
  balanceValues: { // USD value of the user's balance shown to the right of each balance in renderBalances in UserMenu.tsx
    fontSize: 11, // Balance dollar-value font size in UserMenu.tsx
    fontName: 'sans-serif', // Balance dollar-value font family in UserMenu.tsx
    color: '#8f96a0', // Balance dollar-value color in UserMenu.tsx
    decimals: 2, // Balance dollar-value decimal precision in UserMenu.tsx
    paddingLeft: 12, // Left padding separating dollar value from balance in UserMenu.tsx
  },
};

export const CHAIN_OPTIONS = {
  enableTestnets: true, // Toggles display of testnets
  enableMainnets: true, // Toggles display of mainnets

  // Ethereum
  ETH_MAINNET: {
    enabled: true, // Toggles display
    isTestnet: false, // Indicates if chain is testnet
    activeNetwork: { // Refers to the primary chain dropdown that lets users set an "active chain" for the LLM to assume the user wants to use if they don't mention a chain
      dropdownLabel: 'Ethereum', // How this chain appears in the dropdown
      selectedLabel: 'Ethereum', // How this chain appears on the button after being selected
    },
    walletDisplay: { // Refers to the chain dropdown that appears at the top of wallet UIs such as WALLET_PANELs and the WALLET_DROPDOWN
      dropdownLabel: 'Ethereum', // How this chain appears in the dropdown
      selectedLabel: 'Ethereum Wallet', // How this chain appears on the button after being selected
    },
    transactionPanel: {
      inChat: 'Ethereum',
      sidePanel: 'Ethereum',
    },
  },

  // Ethereum Sepolia Testnet
  ETH_SEPOLIA: {
    enabled: true,
    isTestnet: true,
    activeNetwork: {
      dropdownLabel: 'Ethereum Sepolia Testnet',
      selectedLabel: 'Ethereum Sepolia Testnet',
    },
    walletDisplay: {
      dropdownLabel: 'Ethereum Testnet',
      selectedLabel: 'Ethereum Testnet',
    },
    transactionPanel: {
      inChat: 'Ethereum Testnet',
      sidePanel: 'Ethereum Testnet',
    },
  },

  // Base
  BASE_MAINNET: {
    enabled: true,
    isTestnet: false,
    activeNetwork: {
      dropdownLabel: 'Base',
      selectedLabel: 'Base',
    },
    walletDisplay: {
      dropdownLabel: 'Base',
      selectedLabel: 'Base Wallet',
    },
    transactionPanel: {
      inChat: 'Base',
      sidePanel: 'Base',
    },
  },

  // Base Sepolia Testnet
  BASE_SEPOLIA: {
    enabled: true,
    isTestnet: true,
    activeNetwork: {
      dropdownLabel: 'Base Sepolia Testnet',
      selectedLabel: 'Base Sepolia Testnet',
    },
    walletDisplay: {
      dropdownLabel: 'Base Testnet',
      selectedLabel: 'Base Testnet',
    },
    transactionPanel: {
      inChat: 'Base Testnet',
      sidePanel: 'Base Testnet',
    },
  },

  // Solana
  SOLANA_MAINNET: {
    enabled: true,
    isTestnet: false,
    activeNetwork: {
      dropdownLabel: 'Solana',
      selectedLabel: 'Solana',
    },
    walletDisplay: {
      dropdownLabel: 'Solana',
      selectedLabel: 'Solana Wallet',
    },
    transactionPanel: {
      inChat: 'Solana',
      sidePanel: 'Solana',
    },
  },

  // Solana Devnet
  SOLANA_DEVNET: {
    enabled: true,
    isTestnet: true,
    activeNetwork: {
      dropdownLabel: 'Solana Devnet',
      selectedLabel: 'Solana Devnet',
    },
    walletDisplay: {
      dropdownLabel: 'Solana Devnet',
      selectedLabel: 'Solana Devnet',
    },
    transactionPanel: {
      inChat: 'Solana Devnet',
      sidePanel: 'Solana Devnet',
    },
  },

  // All Chains
  ALL_CHAINS: {
    enabled: true,
    isTestnet: false,
    activeNetwork: {
      dropdownLabel: false,
      selectedLabel: false,
    },
    walletDisplay: {
      dropdownLabel: 'All Chains',
      selectedLabel: 'All Chains',
    }
  }
};

export const ADD_PANEL_DISPLAY = { // ADD_PANEL sizing, label, and icon styles in UserMenu.tsx
  logo: false,
  width: 270, // ADD_PANEL width in UserMenu.tsx
  paddingLeft: 14, // ADD_PANEL left padding in UserMenu.tsx
  paddingRight: 8, // ADD_PANEL right padding in UserMenu.tsx
  paddingTop: 2, // ADD_PANEL row top padding in UserMenu.tsx
  paddingBottom: 2, // ADD_PANEL row bottom padding in UserMenu.tsx
  label: { // “Add Panel:” label typography in UserMenu.tsx
    fontSize: 14, // Label font size in UserMenu.tsx
    fontName: 'sans-serif', // Label font family in UserMenu.tsx
    color: '#d1d5db', // Label color in UserMenu.tsx
  },
  iconButtons: { // Wallet icon button colors/sizing in UserMenu.tsx
    icon_color: '#dbd1db', // Wallet icon color in UserMenu.tsx
    container_color: '#1f2937', // Icon ring fill color in UserMenu.tsx
    border_color: '#676869', // Icon ring border color in UserMenu.tsx
    highlight_color: '#3b82f6', // Icon ring hover/active color in UserMenu.tsx
    size: 5, // Icon size scalar used in UserMenu.tsx
    paddingTop: 5, // ADD_PANEL icon row top padding in UserMenu.tsx
    paddingBottom: 5, // ADD_PANEL icon row bottom padding in UserMenu.tsx
  },
  x: { // ADD_PANEL close “×” placement and sizing in UserMenu.tsx
    ENABLED: true,
    paddingTop: 0, // Close top offset in UserMenu.tsx
    paddingRight: 6, // Close right offset in UserMenu.tsx
    size: 23, // Close icon size in UserMenu.tsx
    fontName: 'sans-serif', // Close font family in UserMenu.tsx
  },
  chainDropdown: { // Wallet chain dropdown sizing in UserMenu.tsx
    width: 220, // Dropdown width in UserMenu.tsx
    fontSize: 12, // Dropdown font size in UserMenu.tsx
    fontName: 'monospace',
    fontColor: '#d1d5db',
    allCaps: true,
    letterSpacing: '0.3em',
    itemColor: '#111827',
    itemHighlightColor: '#1f2937',
    itemHeight: 32,
  },
  chainIcons: {
    fileType: 'webp',
    fileSize: '64px',
    size: 20,
    borderPosition: 'outer',
    borderColor: null,
    borderWidth: null,
    placeholderColor: '#1F2937',
    placeholderFontColor: '#d1d5db',
    placeholderFontSize: 14,
    spin: true,
  },
};

export const TRANSACTION_INFO_PANEL_DISPLAY = { // TRANSACTION_INFO_PANEL sizing, typography, and icon styles in UserMenu.tsx
  displayLocation: {
    sidePanel: false,
    inChat: true
  },
  sidePanel: {
    logo: true,
    width: 270, // Panel width (rectangle wider than tall) in UserMenu.tsx
    paddingLeft: 23, // Panel content left padding in UserMenu.tsx
    paddingRight: 23, // Panel content right padding in UserMenu.tsx
    paddingTop: 5, // Panel content top padding in UserMenu.tsx
    paddingBottom: 5, // Panel content bottom padding in UserMenu.tsx
    arrow: { // Center arrow separating sell side from buy side
      color: '#9ca3af',
      fontSize: 28,
      fontName: 'sans-serif',
    },
    statusText: { // "Executing"/"Executed" label rendered above the arrow
      executingLabel: 'Executing...',
      executedLabel: 'Executed!',
      fontSize: 12,
      fontName: 'sans-serif',
      executingFontStyle: 'italic',
      executedFontStyle: 'italic',
      executingColor: '#9ca3af',
      executedColor: '#9ca3af',
      paddingBottom: 0,
    },
    viewTransaction: { // "View Transaction" link rendered below the arrow after execution
      label: 'View Transaction',
      fontSize: 11,
      fontName: 'sans-serif',
      color: '#60a5fa',
      highlightColor: '#93c5fd',
      paddingTop: 2,
      underline: true,
    },
    leftSection: {
      alignItems: 'center',
    },
    rightSection: {
      alignItems: 'center',
    },
    chainName: { // Chain name shown above each token icon (sourced from CHAIN_OPTIONS[key].transactionPanel.sidePanel)
      fontSize: 11,
      fontName: 'monospace',
      color: '#9ca3af',
      allCaps: true,
      letterSpacing: '0.15em',
      paddingBottom: 4,
    },
    tokenSymbol: { // Token symbol shown below the token icon
      fontSize: 13,
      fontName: 'sans-serif',
      color: '#d1d5db',
      paddingTop: 4,
    },
    tokenAmount: { // Token amount shown below the token symbol
      fontSize: 14,
      fontName: 'sans-serif',
      color: '#f3f4f6',
      decimals: 6,
      paddingTop: 0,
    },
    pendingText: { // Italic "Pending" string shown for the buy amount while the swap is in flight
      label: 'Pending...',
      fontStyle: 'italic',
      color: '#9ca3af',
    },
    tokenIcons: {
      fileType: 'webp',
      fileSize: '64px',
      size: 42,
      borderPosition: 'inner',
      borderColor: null,
      borderWidth: null,
      placeholderColor: '#1F2937',
      placeholderFontColor: '#d1d5db',
      placeholderFontSize: 18,
      spin: true,
    },
    x: { // Close "×" placement and sizing
      ENABLED: true,
      paddingTop: 0,
      paddingRight: 6,
      size: 23,
      fontName: 'sans-serif',
    },
  },
  inChat: {
    logo: false,
    width: 270, // Panel width (rectangle wider than tall) in UserMenu.tsx
    paddingLeft: 23, // Panel content left padding in UserMenu.tsx
    paddingRight: 23, // Panel content right padding in UserMenu.tsx
    paddingTop: 5, // Panel content top padding in UserMenu.tsx
    paddingBottom: 5, // Panel content bottom padding in UserMenu.tsx
    arrow: { // Center arrow separating sell side from buy side
      color: '#9ca3af',
      fontSize: 28,
      fontName: 'sans-serif',
    },
    statusText: { // "Executing"/"Executed" label rendered above the arrow
      executingLabel: 'Executing...',
      executedLabel: 'Executed!',
      fontSize: 12,
      fontName: 'sans-serif',
      executingFontStyle: 'italic',
      executedFontStyle: 'italic',
      executingColor: '#9ca3af',
      executedColor: '#9ca3af',
      paddingBottom: 0,
    },
    viewTransaction: { // "View Transaction" link rendered below the arrow after execution
      label: 'View Transaction',
      fontSize: 11,
      fontName: 'sans-serif',
      color: '#60a5fa',
      highlightColor: '#93c5fd',
      paddingTop: 2,
      underline: true,
    },
    leftSection: {
      alignItems: 'center',
    },
    rightSection: {
      alignItems: 'center',
    },
    chainName: { // Chain name shown above each token icon (sourced from CHAIN_OPTIONS[key].transactionPanel.sidePanel)
      fontSize: 11,
      fontName: 'monospace',
      color: '#9ca3af',
      allCaps: true,
      letterSpacing: '0.15em',
      paddingBottom: 4,
    },
    tokenSymbol: { // Token symbol shown below the token icon
      fontSize: 13,
      fontName: 'sans-serif',
      color: '#d1d5db',
      paddingTop: 4,
    },
    tokenAmount: { // Token amount shown below the token symbol
      fontSize: 14,
      fontName: 'sans-serif',
      color: '#f3f4f6',
      decimals: 6,
      paddingTop: 0,
    },
    pendingText: { // Italic "Pending" string shown for the buy amount while the swap is in flight
      label: 'Pending...',
      fontStyle: 'italic',
      color: '#9ca3af',
    },
    tokenIcons: {
      fileType: 'webp',
      fileSize: '64px',
      size: 42,
      borderPosition: 'inner',
      borderColor: null,
      borderWidth: null,
      placeholderColor: '#1F2937',
      placeholderFontColor: '#d1d5db',
      placeholderFontSize: 18,
      spin: true,
    },
    x: { // Close "×" placement and sizing
      ENABLED: false,
      paddingTop: 0,
      paddingRight: 6,
      size: 23,
      fontName: 'sans-serif',
    },
  }
};

export const MENU_ICONS = { // Top-right menu icon styling in UserMenu.tsx
  x_offset: 3, // Icon x offset in UserMenu.tsx
  y_offset: 3, // Icon y offset in UserMenu.tsx
  x_justify: 'right', // X justification for menu icons in UserMenu.tsx
  x_justifyOptions: ['right', 'left'],
  y_justify: 'top', // Y justification for menu icons in UserMenu.tsx
  y_justifyOptions: ['top', 'bottom'],
  size: 6, // Base icon size used in UserMenu.tsx
  icon_color: '#dbd1dbf7', // Icon stroke/fill color in UserMenu.tsx
  container_color: '#1f2937', // Icon button background color in UserMenu.tsx
  border_color: '#676869', // Icon button border color in UserMenu.tsx
  highlight_color: '#3b82f6', // Icon button active/hover border color in UserMenu.tsx
  border_width: 1, // Icon button border width in UserMenu.tsx
  buttonText: {
    fontSize: 14,
    fontName: 'sans-serif',
    fontColor: '#f3f4f6',
  }
};


export const HOME_ICON = { // Home icon layout config used in top-left UI (altair_frontend1/src/components/SpinningLogo.tsx)
  x_offset: 3, // Home icon x offset in SpinningLogo.tsx
  y_offset: 3, // Home icon y offset in SpinningLogo.tsx
  x_justify: 'left', // Home icon x justification in SpinningLogo.tsx
  x_justifyOptions: ['right', 'left'],
  y_justify: 'top', // Home icon y justification in SpinningLogo.tsx
  y_justifyOptions: ['top', 'bottom'],
  size: 15, // Home icon size in SpinningLogo.tsx
};

export const TITLE_PANEL = { // Title panel styling used in altair_frontend1/src/components/SpinningLogo.tsx
  x_offset: 0, // Title panel x offset in SpinningLogo.tsx
  y_offset: 0, // Title panel y offset in SpinningLogo.tsx
  logo_size: 23, // Logo size in SpinningLogo.tsx
  text_color: '#9ca3af', // Title text color in SpinningLogo.tsx
  size: 1, // Title panel scale in SpinningLogo.tsx
  text_spacing: -1, // Title text spacing in SpinningLogo.tsx
  title_gradient: { // Gradient colors for title text in SpinningLogo.tsx
    color_start: '#60a5fa', // Gradient start color in SpinningLogo.tsx
    color_end: '#9333ea', // Gradient end color in SpinningLogo.tsx
  },
};

export const CHAT_PANEL = { // Chat panel styling used in altair_frontend1/src/components/Chat.tsx
  container_color: '#11182780', // Chat panel background color in Chat.tsx
  border_color: '#1f2937', // Chat panel border color in Chat.tsx
  border_width: 1, // Chat panel border width in Chat.tsx
  user_chat_container_color: '#2563eb', // User message bubble color in Chat.tsx
  agent_chat_container_color: '#1f2937', // Agent message bubble color in Chat.tsx
  user_chat_text_color: '#ffffff', // User text color in Chat.tsx
  agent_chat_text_color: '#e5e7eb', // Agent text color in Chat.tsx
  width: 672, // Chat panel width in Chat.tsx
  height: 500, // Chat panel height in Chat.tsx
  agent_icon_border_color: '#374151', // Agent icon border color in Chat.tsx
  chat_highlight_color: '#3b82f6', // Chat highlight color in Chat.tsx
  chat_button_container_color: '#2563eb', // Chat button background in Chat.tsx
  chat_button_icon_color: '#ffffff', // Chat button icon color in Chat.tsx
  typingSpeedMs: .5, // Rate of characters printed by AI per millisecond. Lower numbers are faster
  agentChatWidth: "85%",
  userChatMaxWidth: "75%",
  chatButtonRow: {
    textColor: '#ffffff',
    borderColor: "#ffffff",
    buttonColor: "#2563eb",
    highlightColor: '#6495ff',
    activeColor: '#000000',
    activeBorderColor: "#ffffff",
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 12,
    fontSize: 14,
    fontName: 'sans-serif',
    borderRadius: 20,
    paddingTop: 5,
    paddingBottom: 5,
  },
};

export const LOGO_DISPLAY = {
  logoFile: 'random',
  logoFileOptions: ['random', 'logo.png']
};
