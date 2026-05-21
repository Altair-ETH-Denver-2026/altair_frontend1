'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { ethers } from 'ethers';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets, useSignAndSendTransaction } from '@privy-io/react-auth/solana';
import { useSwap } from '../lib/useSwap';
import { useSolanaSwap } from '../lib/useSolanaSwap';
import { useSolanaTransfer } from '../lib/useSolanaTransfer';
import { withWaitLogger } from '../lib/waitLogger';
import { usePanels } from '../lib/usePanels';
import { getCachedPrivyAccessToken } from '../lib/privyTokenCache';
import { PublicKey } from '@solana/web3.js';
import { UserRound, LogOut, Settings, Wallet, Wrench, Copy, Globe2, Check } from 'lucide-react';
import WalletPanel from './panels/WalletPanel';
import AddPanel from './panels/AddPanel';
import TransactionInfoPanel from './panels/TransactionInfoPanel';
import { SpinningLogo } from './SpinningLogo';
import { useEffect as useClientEffect } from 'react';
import { BLOCKCHAIN, CHAINS, GAS_RESERVES, GAS_TOKENS, FORCE_QUERY_CHAINS, BALANCE_RULES, type ChainKey } from '../../config/blockchain_config';
import { BASE_MAINNET, BASE_SEPOLIA, ETH_MAINNET, ETH_SEPOLIA, SOLANA_MAINNET, SOLANA_DEVNET, resolveRpcUrls } from '../../config/chain_info';
import * as BaseTokens from '../../config/token_info/base_tokens';
import * as BaseSepoliaTokens from '../../config/token_info/base_testnet_sepolia_tokens';
import * as EthTokens from '../../config/token_info/eth_tokens';
import * as EthSepoliaTokens from '../../config/token_info/eth_sepolia_testnet_tokens';
import * as SolanaTokens from '../../config/token_info/solana_tokens';
import type { ApiChainBalances, ApiTokenBalance } from '../lib/balanceTypes';
import { normalizeBalancesResponse, resolveTokenRowsForChain } from '../lib/balanceTransforms';
import { dispatchBalanceUpdated, dispatchBalanceStale } from '../lib/eventTypes';
import { ACTIVE_NETWORK_DROPDOWN, ADD_PANEL_DISPLAY, BALANCE_DECIMALS, CHAIN_OPTIONS, MENU_ICONS, TRANSACTION_INFO_PANEL_DISPLAY, WALLET_DISPLAY } from '../../config/ui_config';

type UiChainKey = ChainKey | 'ALL';
type ChainOptionConfig = {
  enabled: boolean;
  isTestnet: boolean;
  activeNetwork: { dropdownLabel: string | false; selectedLabel: string | false };
  walletDisplay: { dropdownLabel: string | false; selectedLabel: string | false };
};

export default function UserMenu() {
  const { logout, authenticated, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { wallets: solanaWallets } = useSolanaWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const cachedSolKey = 'cached:solAddress';
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [selectedChain, setSelectedChain] = useState<ChainKey>(BLOCKCHAIN);
  const {
    walletPanels,
    setWalletPanels,
    isWalletPanelOpen,
    setIsWalletPanelOpen,
    isAddPanelOpen,
    setIsAddPanelOpen,
    isAddPanelChainOpen,
    setIsAddPanelChainOpen,
    addPanelChain,
    setAddPanelChain,
    setAddPanelHasCustomChain,
    addPanelIconHovered: isAddPanelIconHovered,
    setAddPanelIconHovered,
    initWalletPanels,
    closeWalletPanel,
    addWalletPanel,
    transactionInfoPanels,
    setTransactionInfoPanels,
    addTransactionInfoPanel,
    closeTransactionInfoPanel,
  } = usePanels({ initialChain: selectedChain });
  const [isDevOpen, setIsDevOpen] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapMessage, setSwapMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [balancesByChain, setBalancesByChain] = useState<Record<ChainKey, ApiChainBalances>>({} as Record<ChainKey, ApiChainBalances>);
  const [evmAddress, setEvmAddress] = useState<string>('');
  const [solanaAddress, setSolanaAddress] = useState<string>('');
  const [isNetworkOpen, setIsNetworkOpen] = useState(false);
  const [isWalletDropdownChainOpen, setIsWalletDropdownChainOpen] = useState(false);
  const [walletDropdownChain, setWalletDropdownChain] = useState<ChainKey | 'ALL'>('ALL');
  const [walletDropdownHasCustomChain, setWalletDropdownHasCustomChain] = useState(false);
  const [withdrawPanels, setWithdrawPanels] = useState<Record<number, { active: boolean; token: string; amount: string; address: string }>>({});
  const [withdrawReceipt, setWithdrawReceipt] = useState<Record<number, { active: boolean; status?: 'submitted' | 'executed'; txHash?: string | null }>>({});
  const [withdrawErrors, setWithdrawErrors] = useState<Record<number, string | null>>({});
  const [withdrawSubmittedDots, setWithdrawSubmittedDots] = useState<Record<number, number>>({});
  const [tokenDropdownOpen, setTokenDropdownOpen] = useState<Record<number, boolean>>({});
  const [tokenDropdownForceAll, setTokenDropdownForceAll] = useState<Record<number, boolean>>({});
  const [walletAddressCopyState, setWalletAddressCopyState] = useState<Record<string, boolean>>({});
  const walletAddressCopyTimers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  const balanceOverrideRef = useRef<Record<string, { value: string; raw?: string; expiresAt: number }>>({});
  const balancesByChainRef = useRef<Record<ChainKey, ApiChainBalances>>({} as Record<ChainKey, ApiChainBalances>);
  balancesByChainRef.current = balancesByChain;
  const executeSwap = useSwap(selectedChain);
  const executeSolanaSwap = useSolanaSwap(selectedChain);
  const executeSolanaTransfer = useSolanaTransfer();
  const menuRef = useRef<HTMLDivElement>(null);
  const isWalletDropDown = WALLET_DISPLAY.active === 'drop_down';
  const isWalletPanel = WALLET_DISPLAY.active === 'panel';
  const solanaDisplayAddress = solanaAddress || solanaWallets[0]?.address || '';
  const displayAddress = selectedChain === 'SOLANA_MAINNET' || selectedChain === 'SOLANA_DEVNET' ? solanaDisplayAddress : evmAddress;
  const buttonSize = WALLET_DISPLAY.buttonSize;
  const buttonPaddingX = WALLET_DISPLAY.buttonWidth * buttonSize;
  const buttonHeight = WALLET_DISPLAY.buttonHeight * buttonSize;
  const buttonFontSize = 14 * buttonSize;
  const topRowButtonColor = WALLET_DISPLAY.buttonColor ?? 'rgba(31, 41, 55, 0.6)';
  const topRowButtonBorderColor = WALLET_DISPLAY.buttonBorderColor ?? '#374151';
  const topRowButtonHighlightColor = WALLET_DISPLAY.buttonHighlightColor ?? '#1f2937';
  const topRowButtonHighlightBorderColor = WALLET_DISPLAY.buttonHighlightBorderColor ?? topRowButtonBorderColor;
  const topRowButtonActiveColor = WALLET_DISPLAY.buttonActiveColor ?? 'rgba(59, 130, 246, 0.2)';
  const topRowButtonActiveBorderColor = WALLET_DISPLAY.buttonActiveBorderColor ?? '#60a5fa';
  const containerPaddingLeft = WALLET_DISPLAY.paddingLeft * buttonSize;
  const containerPaddingRight = WALLET_DISPLAY.paddingRight * buttonSize;
  const tokenRowConfig = WALLET_DISPLAY.rows;
  const tokenSymbolsConfig = WALLET_DISPLAY.tokenSymbols;
  const tokenBalancesConfig = WALLET_DISPLAY.tokenBalances;
  const tokenIconsConfig = WALLET_DISPLAY.tokenIcons;
  const tokenRowPaddingTop = tokenRowConfig.paddingTop * buttonSize;
  const tokenRowPaddingBottom = tokenRowConfig.paddingBottom * buttonSize;
  const tokenSymbolFontSize = tokenSymbolsConfig.fontSize * buttonSize;
  const tokenSymbolFontFamily = tokenSymbolsConfig.fontName;
  const tokenSymbolColor = tokenSymbolsConfig.color;
  const tokenSymbolPaddingBottom = Number(
    (tokenSymbolsConfig as unknown as { paddingBottom?: number }).paddingBottom ?? 0
  );
  const tokenSymbolLineHeight = Number(
    (tokenSymbolsConfig as unknown as { lineHeight?: number }).lineHeight ?? 1
  );
  const tokenBalanceFontSize = tokenBalancesConfig.fontSize * buttonSize;
  const tokenBalanceFontFamily = tokenBalancesConfig.fontName;
  const tokenBalanceColor = tokenBalancesConfig.color;
  const tokenBalanceDecimals = tokenBalancesConfig.decimals;
  const tokenPricesConfig = WALLET_DISPLAY.tokenPrices;
  const tokenPriceFontSize = Number(tokenPricesConfig.fontSize ?? 11) * buttonSize;
  const tokenPriceFontFamily = tokenPricesConfig.fontName ?? 'sans-serif';
  const tokenPriceColor = tokenPricesConfig.color ?? '#9ca3af';
  const tokenPriceDecimals = Number(tokenPricesConfig.decimals ?? 4);
  const tokenPricePaddingTop = Number(tokenPricesConfig.paddingTop ?? 1);
  const tokenPriceLineHeight = Number(
    (tokenPricesConfig as unknown as { lineHeight?: number }).lineHeight ?? 1
  );
  const balanceValuesConfig = WALLET_DISPLAY.balanceValues;
  const balanceValueFontSize = Number(balanceValuesConfig.fontSize ?? 11) * buttonSize;
  const balanceValueFontFamily = balanceValuesConfig.fontName ?? 'sans-serif';
  const balanceValueColor = balanceValuesConfig.color ?? '#9ca3af';
  const balanceValueDecimals = Number(balanceValuesConfig.decimals ?? 2);
  const balanceValuePaddingLeft = Number(balanceValuesConfig.paddingLeft ?? 6);
  const tokenIconSize = Number(tokenIconsConfig.size) * buttonSize;
  const tokenIconFileType = tokenIconsConfig.fileType;
  const tokenIconFileSize = tokenIconsConfig.fileSize;
  const tokenIconBorderPosition = tokenIconsConfig.borderPosition ?? 'inner';
  const tokenIconBorderColor =
    typeof tokenIconsConfig.borderColor === 'string' ? tokenIconsConfig.borderColor : null;
  const tokenIconBorderWidth =
    typeof (tokenIconsConfig as unknown as Record<string, unknown>).borderSize === 'number'
      ? Number((tokenIconsConfig as unknown as Record<string, unknown>).borderSize)
      : typeof tokenIconsConfig.borderWidth === 'number'
        ? tokenIconsConfig.borderWidth
        : null;
  const tokenIconPlaceholderColor = tokenIconsConfig.placeholderColor;
  const tokenIconPlaceholderFontColor = tokenIconsConfig.placeholderFontColor;
  const tokenIconPlaceholderFontSize = Number(
    tokenIconsConfig.placeholderFontSize ?? Math.round(tokenIconSize * 0.55)
  );
  const tokenIconSpinEnabled = Boolean(tokenIconsConfig.spin);
  const walletWidth = WALLET_DISPLAY.width;
  const titleConfig = WALLET_DISPLAY.title;
  const titlePaddingTop = titleConfig.paddingTop * buttonSize;
  const titlePaddingBottom = titleConfig.paddingBottom * buttonSize;
  const titleFontSize = titleConfig.fontSize * buttonSize;
  const titleFontFamily = titleConfig.fontName;
  const titleChainIconConfig = (titleConfig as unknown as { chainIcon?: Record<string, unknown> }).chainIcon;
  const titleChainIconSize = Number(titleChainIconConfig?.size ?? 25) * buttonSize;
  const titleChainIconBorderPosition =
    typeof titleChainIconConfig?.borderPosition === 'string' ? titleChainIconConfig.borderPosition : 'inner';
  const titleChainIconBorderColor = typeof titleChainIconConfig?.borderColor === 'string' ? titleChainIconConfig.borderColor : null;
  const titleChainIconBorderWidth = typeof titleChainIconConfig?.borderWidth === 'number' ? titleChainIconConfig.borderWidth : null;
  const titleChainIconPlaceholderColor = typeof titleChainIconConfig?.placeholderColor === 'string' ? titleChainIconConfig.placeholderColor : '#1F2937';
  const titleChainIconPlaceholderFontColor = typeof titleChainIconConfig?.placeholderFontColor === 'string' ? titleChainIconConfig.placeholderFontColor : '#d1d5db';
  const titleChainIconPlaceholderFontSize = typeof titleChainIconConfig?.placeholderFontSize === 'number' ? titleChainIconConfig.placeholderFontSize : 14;
  const titleChainIconSpinEnabled = Boolean(titleChainIconConfig?.spin);
  const closeConfig = WALLET_DISPLAY.x;
  const closePaddingTop = closeConfig.paddingTop * buttonSize;
  const closePaddingRight = closeConfig.paddingRight * buttonSize;
  const closeSize = closeConfig.size * buttonSize;
  const closeFontFamily = closeConfig.fontName;
  const chainDropdownConfig = WALLET_DISPLAY.chainDropdown;
  const chainDropdownWidth = chainDropdownConfig.width * buttonSize;
  const chainDropdownFontSize = chainDropdownConfig.fontSize * buttonSize;
  const chainDropdownItemColor = chainDropdownConfig.itemColor ?? '#111827';
  const chainDropdownItemHighlightColor = chainDropdownConfig.itemHighlightColor ?? '#1f2937';
  const walletChainIconsConfig = (WALLET_DISPLAY as unknown as { chainIcons?: Record<string, unknown> }).chainIcons;
  const walletChainIconSize = Number(walletChainIconsConfig?.size ?? 25) * buttonSize;
  const walletChainIconFileType = typeof walletChainIconsConfig?.fileType === 'string' ? walletChainIconsConfig.fileType : 'webp';
  const walletChainIconFileSize = typeof walletChainIconsConfig?.fileSize === 'string' ? walletChainIconsConfig.fileSize : '128px';
  const walletChainIconBorderPosition =
    typeof walletChainIconsConfig?.borderPosition === 'string' ? walletChainIconsConfig.borderPosition : 'inner';
  const walletChainIconBorderColor = typeof walletChainIconsConfig?.borderColor === 'string' ? walletChainIconsConfig.borderColor : null;
  const walletChainIconBorderWidth = typeof walletChainIconsConfig?.borderWidth === 'number' ? walletChainIconsConfig.borderWidth : null;
  const walletChainIconPlaceholderColor = typeof walletChainIconsConfig?.placeholderColor === 'string' ? walletChainIconsConfig.placeholderColor : '#1F2937';
  const walletChainIconPlaceholderFontColor = typeof walletChainIconsConfig?.placeholderFontColor === 'string' ? walletChainIconsConfig.placeholderFontColor : '#d1d5db';
  const walletChainIconPlaceholderFontSize = typeof walletChainIconsConfig?.placeholderFontSize === 'number' ? walletChainIconsConfig.placeholderFontSize : 14;
  const walletChainIconSpinEnabled = Boolean(walletChainIconsConfig?.spin);
  const tokenDropdownConfig = WALLET_DISPLAY.tokenDropdown ?? { width: chainDropdownWidth, fontSize: 12, fontName: 'sans-serif' };
  const tokenDropdownWidthRaw = tokenDropdownConfig.width ?? chainDropdownWidth;
  const tokenDropdownWidthValue = tokenDropdownWidthRaw ? tokenDropdownWidthRaw : '100%';
  const tokenDropdownWidth = typeof tokenDropdownWidthValue === 'number'
    ? tokenDropdownWidthValue * buttonSize
    : tokenDropdownWidthValue;
  const tokenDropdownFontSize = Number(tokenDropdownConfig.fontSize) * buttonSize;
  const tokenDropdownFontFamily = tokenDropdownConfig.fontName;
  const withdrawSymbolInputConfig = WALLET_DISPLAY.withdraw?.symbolInput ?? { paddingLeft: buttonPaddingX, paddingRight: buttonPaddingX };
  const withdrawSymbolPaddingLeft = withdrawSymbolInputConfig.paddingLeft * buttonSize;
  const withdrawSymbolPaddingRight = withdrawSymbolInputConfig.paddingRight * buttonSize;
  const withdrawMaxConfig = WALLET_DISPLAY.withdraw?.MAX ?? { fontSize: 11, color: '#d1d5db', highlightColor: '#ffffff', inactiveColor: '#676869' };
  const withdrawMaxFontSize = Number(withdrawMaxConfig.fontSize) * buttonSize;
  const withdrawMaxColor = withdrawMaxConfig.color;
  const withdrawMaxHighlightColor = withdrawMaxConfig.highlightColor;
  const withdrawMaxInactiveColor = withdrawMaxConfig.inactiveColor;
  const withdrawDollarValueConfig = WALLET_DISPLAY.withdraw?.dollarValue ?? { fontSize: 12, fontName: 'sans-serif', color: '#d1d5db', width: 0, paddingLeft: 0, paddingRight: 0 };
  const withdrawDollarValueFontSize = Number(withdrawDollarValueConfig.fontSize) * buttonSize;
  const withdrawDollarValueFontFamily = withdrawDollarValueConfig.fontName;
  const withdrawDollarValueColor = withdrawDollarValueConfig.color;
  const withdrawDollarValueWidth = Number(withdrawDollarValueConfig.width) * buttonSize;
  const withdrawDollarValuePaddingLeft = Number(withdrawDollarValueConfig.paddingLeft) * buttonSize;
  const withdrawDollarValuePaddingRight = Number(withdrawDollarValueConfig.paddingRight) * buttonSize;
  const withdrawAmountInputConfig = WALLET_DISPLAY.withdraw?.amountInput ?? { paddingLeft: buttonPaddingX / 2, paddingRight: buttonPaddingX / 2 + 36, fontSize: buttonFontSize, color: '#f3f4f6' };
  const withdrawAmountInputPaddingLeft = Number(withdrawAmountInputConfig.paddingLeft) * buttonSize;
  const withdrawAmountInputPaddingRight = Number(withdrawAmountInputConfig.paddingRight) * buttonSize;
  const withdrawAmountInputFontSize = Number(withdrawAmountInputConfig.fontSize) * buttonSize;
  const withdrawAmountInputColor = withdrawAmountInputConfig.color;
  const withdrawAddressInputConfig = WALLET_DISPLAY.withdraw?.addressInput ?? { paddingLeft: buttonPaddingX / 2, paddingRight: buttonPaddingX / 2, fontSize: buttonFontSize, color: '#f3f4f6' };
  const withdrawAddressInputPaddingLeft = Number(withdrawAddressInputConfig.paddingLeft) * buttonSize;
  const withdrawAddressInputPaddingRight = Number(withdrawAddressInputConfig.paddingRight) * buttonSize;
  const withdrawAddressInputFontSize = Number(withdrawAddressInputConfig.fontSize) * buttonSize;
  const withdrawAddressInputColor = withdrawAddressInputConfig.color;
  const withdrawSubmitButtonConfig = WALLET_DISPLAY.withdraw?.submitButton ?? { textColor: '#f3f4f6', borderColor: '#f3f4f6', buttonColor: '#60c178', borderWidth: 1 };
  const withdrawCancelButtonConfig = WALLET_DISPLAY.withdraw?.cancelButton ?? { textColor: '#f3f4f6', borderColor: '#f3f4f6', buttonColor: '#c74848', borderWidth: 1 };
  const withdrawSubmitBorderWidth = Number(withdrawSubmitButtonConfig.borderWidth) * buttonSize;
  const withdrawCancelBorderWidth = Number(withdrawCancelButtonConfig.borderWidth) * buttonSize;
  const withdrawSubmitHighlightColor = withdrawSubmitButtonConfig.highlightColor ?? withdrawSubmitButtonConfig.buttonColor;
  const withdrawSubmitActiveColor = withdrawSubmitButtonConfig.activeColor ?? withdrawSubmitButtonConfig.buttonColor;
  const withdrawSubmitActiveBorderColor = withdrawSubmitButtonConfig.activeBorderColor ?? withdrawSubmitButtonConfig.borderColor;
  const withdrawCancelHighlightColor = withdrawCancelButtonConfig.highlightColor ?? withdrawCancelButtonConfig.buttonColor;
  const withdrawCancelActiveColor = withdrawCancelButtonConfig.activeColor ?? withdrawCancelButtonConfig.buttonColor;
  const withdrawCancelActiveBorderColor = withdrawCancelButtonConfig.activeBorderColor ?? withdrawCancelButtonConfig.borderColor;
  const activeNetworkMenuIconsOverride = (
    ACTIVE_NETWORK_DROPDOWN as unknown as {
      MENU_ICONS_override?: {
        buttonText?: Record<string, unknown>;
        chainIcon?: Record<string, unknown>;
      };
    }
  ).MENU_ICONS_override;
  const menuButtonTextConfig = MENU_ICONS.buttonText ?? { fontSize: 13, fontName: 'sans-serif', fontColor: '#f3f4f6' };
  const activeNetworkMenuButtonTextConfig = activeNetworkMenuIconsOverride?.buttonText ?? {};
  const menuButtonTextFontSize = Number(
    typeof activeNetworkMenuButtonTextConfig.fontSize === 'number'
      ? activeNetworkMenuButtonTextConfig.fontSize
      : menuButtonTextConfig.fontSize ?? 13
  );
  const menuButtonTextFontFamily =
    typeof activeNetworkMenuButtonTextConfig.fontName === 'string'
      ? activeNetworkMenuButtonTextConfig.fontName
      : menuButtonTextConfig.fontName ?? 'sans-serif';
  const menuButtonTextFontColor =
    typeof activeNetworkMenuButtonTextConfig.fontColor === 'string'
      ? activeNetworkMenuButtonTextConfig.fontColor
      : menuButtonTextConfig.fontColor ?? '#f3f4f6';
  const activeNetworkMenuChainIconConfig = activeNetworkMenuIconsOverride?.chainIcon;
  const activeNetworkMenuChainIconEnabled = Boolean(activeNetworkMenuChainIconConfig);
  const activeNetworkMenuChainIconSize = Number(
    typeof activeNetworkMenuChainIconConfig?.size === 'number'
      ? activeNetworkMenuChainIconConfig.size
      : MENU_ICONS.size * 4
  );
  const activeNetworkMenuChainIconFileType =
    typeof activeNetworkMenuChainIconConfig?.fileType === 'string'
      ? activeNetworkMenuChainIconConfig.fileType
      : 'webp';
  const activeNetworkMenuChainIconFileSize =
    typeof activeNetworkMenuChainIconConfig?.fileSize === 'string'
      ? activeNetworkMenuChainIconConfig.fileSize
      : '128px';
  const activeNetworkMenuChainIconBorderPosition =
    typeof activeNetworkMenuChainIconConfig?.borderPosition === 'string'
      ? activeNetworkMenuChainIconConfig.borderPosition
      : 'inner';
  const activeNetworkMenuChainIconBorderColor =
    typeof activeNetworkMenuChainIconConfig?.borderColor === 'string'
      ? activeNetworkMenuChainIconConfig.borderColor
      : null;
  const activeNetworkMenuChainIconBorderWidth =
    typeof activeNetworkMenuChainIconConfig?.borderWidth === 'number'
      ? activeNetworkMenuChainIconConfig.borderWidth
      : null;
  const activeNetworkMenuChainIconPlaceholderColor =
    typeof activeNetworkMenuChainIconConfig?.placeholderColor === 'string'
      ? activeNetworkMenuChainIconConfig.placeholderColor
      : '#1F2937';
  const activeNetworkMenuChainIconPlaceholderFontColor =
    typeof activeNetworkMenuChainIconConfig?.placeholderFontColor === 'string'
      ? activeNetworkMenuChainIconConfig.placeholderFontColor
      : '#d1d5db';
  const activeNetworkMenuChainIconPlaceholderFontSize = Number(
    typeof activeNetworkMenuChainIconConfig?.placeholderFontSize === 'number'
      ? activeNetworkMenuChainIconConfig.placeholderFontSize
      : Math.round(activeNetworkMenuChainIconSize * 0.55)
  );
  const activeNetworkMenuChainIconSpinEnabled = Boolean(activeNetworkMenuChainIconConfig?.spin);
  const activeNetworkChainIconsConfig = ACTIVE_NETWORK_DROPDOWN.chainIcons;
  const activeNetworkChainIconSize = Number(activeNetworkChainIconsConfig?.size ?? 0);
  const activeNetworkChainIconFileType = activeNetworkChainIconsConfig?.fileType ?? 'webp';
  const activeNetworkChainIconFileSize = activeNetworkChainIconsConfig?.fileSize ?? '128px';
  const activeNetworkChainIconPlaceholderColor = activeNetworkChainIconsConfig?.placeholderColor ?? '#1F2937';
  const activeNetworkChainIconPlaceholderFontColor = activeNetworkChainIconsConfig?.placeholderFontColor ?? '#d1d5db';
  const activeNetworkChainIconPlaceholderFontSize = Number(
    activeNetworkChainIconsConfig?.placeholderFontSize ?? Math.round(activeNetworkChainIconSize * 0.55)
  );
  const activeNetworkChainIconBorderPosition =
    typeof activeNetworkChainIconsConfig?.borderPosition === 'string'
      ? activeNetworkChainIconsConfig.borderPosition
      : 'inner';
  const activeNetworkChainIconBorderColor =
    typeof activeNetworkChainIconsConfig?.borderColor === 'string'
      ? activeNetworkChainIconsConfig.borderColor
      : null;
  const activeNetworkChainIconBorderWidth =
    typeof activeNetworkChainIconsConfig?.borderWidth === 'number'
      ? activeNetworkChainIconsConfig.borderWidth
      : null;
  const activeNetworkChainIconSelectedBorderEnabled = Boolean(activeNetworkChainIconsConfig?.selectedBorder);
  const activeNetworkChainIconSelectedBorderColor =
    typeof activeNetworkChainIconsConfig?.selectedBorderColor === 'string'
      ? activeNetworkChainIconsConfig.selectedBorderColor
      : '#09ff00';
  const activeNetworkChainIconSelectedBorderWidth =
    typeof activeNetworkChainIconsConfig?.selectedBorderWidth === 'number'
      ? activeNetworkChainIconsConfig.selectedBorderWidth
      : 1;
  const activeNetworkChainIconSelectedPlaceholder =
    activeNetworkChainIconsConfig?.selectedPlaceholder !== false;
  const activeNetworkSelectedItemColor =
    ACTIVE_NETWORK_DROPDOWN.selectedItemColor ?? ACTIVE_NETWORK_DROPDOWN.itemHighlightColor;
  const activeNetworkChainIconSpinEnabled = Boolean(activeNetworkChainIconsConfig?.spin);
  const activeNetworkChainIconSymbolByKey: Partial<Record<ChainKey, string>> = {
    BASE_MAINNET: BASE_MAINNET.iconSymbol,
    BASE_SEPOLIA: BASE_SEPOLIA.iconSymbol,
    ETH_MAINNET: ETH_MAINNET.iconSymbol,
    ETH_SEPOLIA: ETH_SEPOLIA.iconSymbol,
    SOLANA_MAINNET: SOLANA_MAINNET.iconSymbol,
    SOLANA_DEVNET: SOLANA_DEVNET.iconSymbol,
  };
  const resolveActiveNetworkChainIconSrc = (chainKey: ChainKey): string | null => {
    const iconSymbol = activeNetworkChainIconSymbolByKey[chainKey];
    if (!iconSymbol || !activeNetworkChainIconFileType || !activeNetworkChainIconFileSize) return null;
    return `/image/tokens/${activeNetworkChainIconFileType}/${activeNetworkChainIconFileSize}/${iconSymbol}.${activeNetworkChainIconFileType}`;
  };
  const resolveActiveNetworkMenuChainIconSrc = (chainKey: ChainKey): string | null => {
    const iconSymbol = activeNetworkChainIconSymbolByKey[chainKey];
    if (!iconSymbol || !activeNetworkMenuChainIconFileType || !activeNetworkMenuChainIconFileSize) return null;
    return `/image/tokens/${activeNetworkMenuChainIconFileType}/${activeNetworkMenuChainIconFileSize}/${iconSymbol}.${activeNetworkMenuChainIconFileType}`;
  };
  const resolveChainIconSrcByConfig = (
    chainKey: ChainKey | 'ALL',
    fileType: string,
    fileSize: string
  ): string | null => {
    if (chainKey === 'ALL') return '/globe.svg';
    const iconSymbol = activeNetworkChainIconSymbolByKey[chainKey];
    if (!iconSymbol || !fileType || !fileSize) return null;
    return `/image/tokens/${fileType}/${fileSize}/${iconSymbol}.${fileType}`;
  };
  const resolveIconBorderStyle = (
    borderPosition: string,
    borderColor: string | null,
    borderWidth: number | null
  ): React.CSSProperties => {
    if (!borderColor || borderWidth === null || borderWidth <= 0) return {};
    if (borderPosition === 'outer') {
      return {
        boxShadow: `0 0 0 ${borderWidth}px ${borderColor}`,
      };
    }
    return {
      borderStyle: 'solid',
      borderColor,
      borderWidth: `${borderWidth}px`,
    };
  };
  const {
    activeNetworkOptions,
    walletChainOptions,
    activeSelectedLabelByKey,
    walletSelectedLabelByKey,
  } = useMemo(() => {
    const includeTestnets = CHAIN_OPTIONS.enableTestnets !== false;
    const includeMainnets = CHAIN_OPTIONS.enableMainnets !== false;
    const rawEntries = Object.entries(CHAIN_OPTIONS)
      .filter(([key]) => key !== 'enableTestnets' && key !== 'enableMainnets')
      .flatMap(([rawKey, value]) => {
        const uiKey: UiChainKey | null = rawKey === 'ALL_CHAINS'
          ? 'ALL'
          : (rawKey in CHAINS ? (rawKey as ChainKey) : null);
        if (!uiKey) return [];
        return [{ key: uiKey, config: value as ChainOptionConfig }];
      });

    const visibleEntries = rawEntries.filter(({ key, config }) => {
      if (!config?.enabled) return false;
      if (key === 'ALL') return true;
      if (config.isTestnet) return includeTestnets;
      return includeMainnets;
    });

    const nextActiveSelectedLabelByKey: Partial<Record<ChainKey, string>> = {};
    const nextWalletSelectedLabelByKey: Partial<Record<UiChainKey, string>> = {};

    const nextActiveNetworkOptions = visibleEntries
      .filter(({ key, config }) => key !== 'ALL' && typeof config.activeNetwork?.dropdownLabel === 'string')
      .map(({ key, config }) => {
        const dropdownLabel = config.activeNetwork.dropdownLabel as string;
        const selectedLabel = typeof config.activeNetwork.selectedLabel === 'string'
          ? config.activeNetwork.selectedLabel
          : dropdownLabel;
        nextActiveSelectedLabelByKey[key as ChainKey] = selectedLabel;
        return { key: key as ChainKey, label: dropdownLabel };
      });

    const nextWalletChainOptions = visibleEntries
      .filter(({ config }) => typeof config.walletDisplay?.dropdownLabel === 'string')
      .map(({ key, config }) => {
        const dropdownLabel = config.walletDisplay.dropdownLabel as string;
        const selectedLabel = typeof config.walletDisplay.selectedLabel === 'string'
          ? config.walletDisplay.selectedLabel
          : dropdownLabel;
        nextWalletSelectedLabelByKey[key] = selectedLabel;
        return { key, label: dropdownLabel };
      });

    return {
      activeNetworkOptions: nextActiveNetworkOptions,
      walletChainOptions: nextWalletChainOptions,
      activeSelectedLabelByKey: nextActiveSelectedLabelByKey,
      walletSelectedLabelByKey: nextWalletSelectedLabelByKey,
    };
  }, []);
  const selectedNetworkLabel = activeSelectedLabelByKey[selectedChain]
    ?? activeNetworkOptions.find((option) => option.key === selectedChain)?.label
    ?? 'Network';
  const walletChainKeySet = useMemo(() => new Set<UiChainKey>(walletChainOptions.map((option) => option.key)), [walletChainOptions]);
  const fallbackWalletChain = useMemo<UiChainKey>(() => {
    if (walletChainKeySet.has('ALL')) return 'ALL';
    if (walletChainKeySet.has(selectedChain)) return selectedChain;
    return walletChainOptions[0]?.key ?? 'ALL';
  }, [walletChainKeySet, selectedChain, walletChainOptions]);
  const gasTokensByChain = GAS_TOKENS as Partial<Record<ChainKey, string>>;
  const gasReservesByChain = GAS_RESERVES as Partial<Record<ChainKey, string>>;
  const walletAddressButtonConfig = WALLET_DISPLAY.walletAddressButton ?? {
    activeDuration: 1.5,
    fontSize: 14,
    fontName: 'sans-serif',
    fontColor: '#f3f4f6',
    label: {
      fontSize: 14,
      fontName: 'sans-serif',
      fontColor: '#d1d5db',
    },
  };
  const walletAddressButtonFontSize = Number(walletAddressButtonConfig.fontSize ?? 14) * buttonSize;
  const walletAddressButtonFontFamily = walletAddressButtonConfig.fontName ?? 'sans-serif';
  const walletAddressButtonFontColor = walletAddressButtonConfig.fontColor ?? '#f3f4f6';
  const walletAddressLabelConfig = walletAddressButtonConfig.label ?? {
    fontSize: 14,
    fontName: 'sans-serif',
    fontColor: '#d1d5db',
  };
  const walletAddressLabelFontSize = Number(walletAddressLabelConfig.fontSize ?? 14) * buttonSize;
  const walletAddressLabelFontFamily = walletAddressLabelConfig.fontName ?? 'sans-serif';
  const walletAddressLabelFontColor = walletAddressLabelConfig.fontColor ?? '#d1d5db';
  const walletAddressCopyDurationMs = Math.max(
    0,
    Number(WALLET_DISPLAY.walletAddressButton?.activeDuration ?? 0) * 1000
  );
  const [isMaxHovering, setIsMaxHovering] = useState(false);
  const addPanelIconButtons = ADD_PANEL_DISPLAY.iconButtons;
  const addPanelButtonSize = addPanelIconButtons.size;
  const addPanelIconPaddingTop = addPanelIconButtons.paddingTop;
  const addPanelIconPaddingBottom = addPanelIconButtons.paddingBottom;
  const addPanelWidth = ADD_PANEL_DISPLAY.width;
  const addPanelPaddingLeft = ADD_PANEL_DISPLAY.paddingLeft;
  const addPanelPaddingRight = ADD_PANEL_DISPLAY.paddingRight;
  const addPanelTitlePaddingTop = ADD_PANEL_DISPLAY.paddingTop;
  const addPanelTitlePaddingBottom = ADD_PANEL_DISPLAY.paddingBottom;
  const addPanelIconSize = addPanelButtonSize * 4;
  const addPanelIconContainerSize = addPanelIconSize * 1.6;
  const addPanelIconBorderWidth = MENU_ICONS.border_width * (addPanelButtonSize / MENU_ICONS.size);
  const addPanelLabelConfig = ADD_PANEL_DISPLAY.label;
  const addPanelLabelFontSize = addPanelLabelConfig.fontSize;
  const addPanelLabelFontFamily = addPanelLabelConfig.fontName;
  const addPanelLabelColor = addPanelLabelConfig.color;
  const addPanelCloseConfig = ADD_PANEL_DISPLAY.x;
  const addPanelClosePaddingTop = addPanelCloseConfig.paddingTop;
  const addPanelClosePaddingRight = addPanelCloseConfig.paddingRight;
  const addPanelCloseSize = addPanelCloseConfig.size;
  const addPanelCloseFontFamily = addPanelCloseConfig.fontName;
  const addPanelChainDropdownConfig = ADD_PANEL_DISPLAY.chainDropdown;
  const addPanelChainDropdownWidth = addPanelChainDropdownConfig.width;
  const addPanelChainDropdownFontSize = addPanelChainDropdownConfig.fontSize;
  const addPanelChainDropdownFontName = addPanelChainDropdownConfig.fontName ?? addPanelLabelFontFamily;
  const addPanelChainDropdownFontColor = addPanelChainDropdownConfig.fontColor ?? '#d1d5db';
  const addPanelChainDropdownAllCaps = addPanelChainDropdownConfig.allCaps ?? true;
  const addPanelChainDropdownLetterSpacing = addPanelChainDropdownConfig.letterSpacing ?? '0.3em';
  const addPanelChainDropdownItemColor = addPanelChainDropdownConfig.itemColor ?? '#111827';
  const addPanelChainDropdownItemHighlightColor = addPanelChainDropdownConfig.itemHighlightColor ?? '#1f2937';
  const addPanelChainDropdownItemHeight = Number(addPanelChainDropdownConfig.itemHeight ?? 32);
  const addPanelChainIconsConfig = (ADD_PANEL_DISPLAY as unknown as { chainIcons?: Record<string, unknown> }).chainIcons;
  const addPanelChainIconSize = Number(addPanelChainIconsConfig?.size ?? 25);
  const addPanelChainIconFileType = typeof addPanelChainIconsConfig?.fileType === 'string' ? addPanelChainIconsConfig.fileType : 'webp';
  const addPanelChainIconFileSize = typeof addPanelChainIconsConfig?.fileSize === 'string' ? addPanelChainIconsConfig.fileSize : '128px';
  const addPanelChainIconBorderPosition =
    typeof addPanelChainIconsConfig?.borderPosition === 'string' ? addPanelChainIconsConfig.borderPosition : 'inner';
  const addPanelChainIconBorderColor = typeof addPanelChainIconsConfig?.borderColor === 'string' ? addPanelChainIconsConfig.borderColor : null;
  const addPanelChainIconBorderWidth = typeof addPanelChainIconsConfig?.borderWidth === 'number' ? addPanelChainIconsConfig.borderWidth : null;
  const addPanelChainIconPlaceholderColor = typeof addPanelChainIconsConfig?.placeholderColor === 'string' ? addPanelChainIconsConfig.placeholderColor : '#1F2937';
  const addPanelChainIconPlaceholderFontColor = typeof addPanelChainIconsConfig?.placeholderFontColor === 'string' ? addPanelChainIconsConfig.placeholderFontColor : '#d1d5db';
  const addPanelChainIconPlaceholderFontSize = typeof addPanelChainIconsConfig?.placeholderFontSize === 'number' ? addPanelChainIconsConfig.placeholderFontSize : 14;
  const addPanelChainIconSpinEnabled = Boolean(addPanelChainIconsConfig?.spin);

  // TRANSACTION_INFO_PANEL styling derivations (side-panel variant)
  const txInfoPanelSidePanelConfig = TRANSACTION_INFO_PANEL_DISPLAY.sidePanel;
  const txInfoPanelWidth = txInfoPanelSidePanelConfig.width;
  const txInfoPanelPaddingLeft = txInfoPanelSidePanelConfig.paddingLeft;
  const txInfoPanelPaddingRight = txInfoPanelSidePanelConfig.paddingRight;
  const txInfoPanelPaddingTop = txInfoPanelSidePanelConfig.paddingTop;
  const txInfoPanelPaddingBottom = txInfoPanelSidePanelConfig.paddingBottom;
  const txInfoPanelCloseConfig = txInfoPanelSidePanelConfig.x;
  const txInfoPanelClosePaddingTop = txInfoPanelCloseConfig.paddingTop;
  const txInfoPanelClosePaddingRight = txInfoPanelCloseConfig.paddingRight;
  const txInfoPanelCloseSize = txInfoPanelCloseConfig.size;
  const txInfoPanelCloseFontFamily = txInfoPanelCloseConfig.fontName;
  const txInfoPanelArrowConfig = txInfoPanelSidePanelConfig.arrow;
  const txInfoPanelArrowColor = txInfoPanelArrowConfig.color;
  const txInfoPanelArrowFontSize = txInfoPanelArrowConfig.fontSize;
  const txInfoPanelArrowFontFamily = txInfoPanelArrowConfig.fontName;
  const txInfoPanelDisplayLocation = (TRANSACTION_INFO_PANEL_DISPLAY as { displayLocation?: { sidePanel?: unknown; inChat?: unknown } }).displayLocation;
  const txInfoPanelShowInSidePanel = Boolean(txInfoPanelDisplayLocation?.sidePanel);
  const txInfoPanelStatusTextConfig = (txInfoPanelSidePanelConfig as { statusText?: Record<string, unknown> }).statusText ?? {};
  const txInfoPanelStatusExecutingLabel = typeof txInfoPanelStatusTextConfig.executingLabel === 'string' ? txInfoPanelStatusTextConfig.executingLabel : 'Executing';
  const txInfoPanelStatusExecutedLabel = typeof txInfoPanelStatusTextConfig.executedLabel === 'string' ? txInfoPanelStatusTextConfig.executedLabel : 'Executed';
  const txInfoPanelStatusFontSize = typeof txInfoPanelStatusTextConfig.fontSize === 'number' ? txInfoPanelStatusTextConfig.fontSize : 12;
  const txInfoPanelStatusFontFamily = typeof txInfoPanelStatusTextConfig.fontName === 'string' ? txInfoPanelStatusTextConfig.fontName : 'sans-serif';
  const txInfoPanelStatusExecutingFontStyle = typeof txInfoPanelStatusTextConfig.executingFontStyle === 'string' ? txInfoPanelStatusTextConfig.executingFontStyle : 'italic';
  const txInfoPanelStatusExecutedFontStyle = typeof txInfoPanelStatusTextConfig.executedFontStyle === 'string' ? txInfoPanelStatusTextConfig.executedFontStyle : 'normal';
  const txInfoPanelStatusExecutingColor = typeof txInfoPanelStatusTextConfig.executingColor === 'string' ? txInfoPanelStatusTextConfig.executingColor : '#9ca3af';
  const txInfoPanelStatusExecutedColor = typeof txInfoPanelStatusTextConfig.executedColor === 'string' ? txInfoPanelStatusTextConfig.executedColor : '#d1d5db';
  const txInfoPanelStatusPaddingBottom = typeof txInfoPanelStatusTextConfig.paddingBottom === 'number' ? txInfoPanelStatusTextConfig.paddingBottom : 2;
  const txInfoPanelViewTxConfig = (txInfoPanelSidePanelConfig as { viewTransaction?: Record<string, unknown> }).viewTransaction ?? {};
  const txInfoPanelViewTxLabel = typeof txInfoPanelViewTxConfig.label === 'string' ? txInfoPanelViewTxConfig.label : 'View Transaction';
  const txInfoPanelViewTxFontSize = typeof txInfoPanelViewTxConfig.fontSize === 'number' ? txInfoPanelViewTxConfig.fontSize : 11;
  const txInfoPanelViewTxFontFamily = typeof txInfoPanelViewTxConfig.fontName === 'string' ? txInfoPanelViewTxConfig.fontName : 'sans-serif';
  const txInfoPanelViewTxColor = typeof txInfoPanelViewTxConfig.color === 'string' ? txInfoPanelViewTxConfig.color : '#60a5fa';
  const txInfoPanelViewTxHighlightColor = typeof txInfoPanelViewTxConfig.highlightColor === 'string' ? txInfoPanelViewTxConfig.highlightColor : '#93c5fd';
  const txInfoPanelViewTxPaddingTop = typeof txInfoPanelViewTxConfig.paddingTop === 'number' ? txInfoPanelViewTxConfig.paddingTop : 2;
  const txInfoPanelViewTxUnderline = Boolean(txInfoPanelViewTxConfig.underline);
  const resolveTransactionExplorerUrl = (chainKey: ChainKey, txHash: string): string | null => {
    if (!txHash) return null;
    if (chainKey === 'SOLANA_DEVNET') return `https://solscan.io/tx/${txHash}?cluster=devnet`;
    const explorerBase = (
      chainKey === 'SOLANA_MAINNET' ? SOLANA_MAINNET.explorerUrl
      : chainKey === 'ETH_MAINNET' ? ETH_MAINNET.explorerUrl
      : chainKey === 'ETH_SEPOLIA' ? ETH_SEPOLIA.explorerUrl
      : chainKey === 'BASE_MAINNET' ? BASE_MAINNET.explorerUrl
      : chainKey === 'BASE_SEPOLIA' ? BASE_SEPOLIA.explorerUrl
      : null
    );
    if (!explorerBase) return null;
    const trimmed = explorerBase.replace(/\/+$/, '');
    return `${trimmed}/tx/${txHash}`;
  };
  const resolveAlignItems = (value: string | undefined, fallback: 'flex-start' | 'center' | 'flex-end'): string => {
    const normalized = (value ?? '').toString().trim().toLowerCase();
    if (normalized === 'left' || normalized === 'flex-start' || normalized === 'start') return 'flex-start';
    if (normalized === 'center' || normalized === 'centre') return 'center';
    if (normalized === 'right' || normalized === 'flex-end' || normalized === 'end') return 'flex-end';
    return fallback;
  };
  const txInfoPanelLeftAlignItems = resolveAlignItems(
    (txInfoPanelSidePanelConfig as { leftSection?: { alignItems?: string } }).leftSection?.alignItems,
    'flex-start'
  );
  const txInfoPanelRightAlignItems = resolveAlignItems(
    (txInfoPanelSidePanelConfig as { rightSection?: { alignItems?: string } }).rightSection?.alignItems,
    'flex-end'
  );
  const txInfoPanelChainNameConfig = txInfoPanelSidePanelConfig.chainName;
  const txInfoPanelChainNameFontSize = txInfoPanelChainNameConfig.fontSize;
  const txInfoPanelChainNameFontFamily = txInfoPanelChainNameConfig.fontName;
  const txInfoPanelChainNameColor = txInfoPanelChainNameConfig.color;
  const txInfoPanelChainNameAllCaps = Boolean(txInfoPanelChainNameConfig.allCaps);
  const txInfoPanelChainNameLetterSpacing = txInfoPanelChainNameConfig.letterSpacing ?? '0';
  const txInfoPanelChainNamePaddingBottom = txInfoPanelChainNameConfig.paddingBottom;
  const txInfoPanelTokenSymbolConfig = txInfoPanelSidePanelConfig.tokenSymbol;
  const txInfoPanelTokenSymbolFontSize = txInfoPanelTokenSymbolConfig.fontSize;
  const txInfoPanelTokenSymbolFontFamily = txInfoPanelTokenSymbolConfig.fontName;
  const txInfoPanelTokenSymbolColor = txInfoPanelTokenSymbolConfig.color;
  const txInfoPanelTokenSymbolPaddingTop = txInfoPanelTokenSymbolConfig.paddingTop;
  const txInfoPanelTokenAmountConfig = txInfoPanelSidePanelConfig.tokenAmount;
  const txInfoPanelTokenAmountFontSize = txInfoPanelTokenAmountConfig.fontSize;
  const txInfoPanelTokenAmountFontFamily = txInfoPanelTokenAmountConfig.fontName;
  const txInfoPanelTokenAmountColor = txInfoPanelTokenAmountConfig.color;
  const txInfoPanelTokenAmountDecimals = txInfoPanelTokenAmountConfig.decimals;
  const txInfoPanelTokenAmountPaddingTop = txInfoPanelTokenAmountConfig.paddingTop;
  const txInfoPanelPendingConfig = txInfoPanelSidePanelConfig.pendingText;
  const txInfoPanelPendingLabel = txInfoPanelPendingConfig.label;
  const txInfoPanelPendingFontStyle = txInfoPanelPendingConfig.fontStyle;
  const txInfoPanelPendingColor = txInfoPanelPendingConfig.color;
  const txInfoPanelTokenIconsConfig = txInfoPanelSidePanelConfig.tokenIcons;
  const txInfoPanelTokenIconSize = Number(txInfoPanelTokenIconsConfig.size);
  const txInfoPanelTokenIconFileType = typeof txInfoPanelTokenIconsConfig.fileType === 'string' ? txInfoPanelTokenIconsConfig.fileType : 'webp';
  const txInfoPanelTokenIconFileSize = typeof txInfoPanelTokenIconsConfig.fileSize === 'string' ? txInfoPanelTokenIconsConfig.fileSize : '64px';
  const txInfoPanelTokenIconBorderPosition = typeof txInfoPanelTokenIconsConfig.borderPosition === 'string' ? txInfoPanelTokenIconsConfig.borderPosition : 'inner';
  const txInfoPanelTokenIconBorderColor = typeof txInfoPanelTokenIconsConfig.borderColor === 'string' ? txInfoPanelTokenIconsConfig.borderColor : null;
  const txInfoPanelTokenIconBorderWidth = typeof txInfoPanelTokenIconsConfig.borderWidth === 'number' ? txInfoPanelTokenIconsConfig.borderWidth : null;
  const txInfoPanelTokenIconPlaceholderColor = typeof txInfoPanelTokenIconsConfig.placeholderColor === 'string' ? txInfoPanelTokenIconsConfig.placeholderColor : '#1F2937';
  const txInfoPanelTokenIconPlaceholderFontColor = typeof txInfoPanelTokenIconsConfig.placeholderFontColor === 'string' ? txInfoPanelTokenIconsConfig.placeholderFontColor : '#d1d5db';
  const txInfoPanelTokenIconPlaceholderFontSize = typeof txInfoPanelTokenIconsConfig.placeholderFontSize === 'number' ? txInfoPanelTokenIconsConfig.placeholderFontSize : 18;
  const txInfoPanelTokenIconSpinEnabled = Boolean(txInfoPanelTokenIconsConfig.spin);
  const resolveTransactionPanelChainLabel = (chainKey: ChainKey): string => {
    const config = (CHAIN_OPTIONS as Record<string, unknown>)[chainKey] as { transactionPanel?: { sidePanel?: string; inChat?: string } } | undefined;
    return config?.transactionPanel?.sidePanel ?? String(chainKey);
  };
  const formatTransactionInfoAmount = (value: string): string => {
    if (!value) return '0';
    const num = Number(value);
    if (!Number.isFinite(num)) return value;
    return num.toFixed(txInfoPanelTokenAmountDecimals).replace(/\.?0+$/, '') || '0';
  };

  const formatDisplayAddress = (address: string) => {
    if (!address) return '—';
    const isEvm = address.startsWith('0x');
    const head = isEvm ? 6 : 4;
    return `${address.slice(0, head)}...${address.slice(-4)}`;
  };
  const balanceCacheTtlMs = 30_000;
  const inFlightBalanceKey = useRef<string | null>(null);
  const loginPreloadKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (Object.keys(withdrawReceipt).length === 0) return;
    const timer = setInterval(() => {
      setWithdrawSubmittedDots((prev) => {
        let updated = false;
        const next: Record<number, number> = { ...prev };
        Object.entries(withdrawReceipt).forEach(([key, receipt]) => {
          const panelId = Number(key);
          if (!receipt?.active || receipt.status !== 'submitted') {
            if (next[panelId] !== undefined) {
              delete next[panelId];
              updated = true;
            }
            return;
          }
          const current = next[panelId] ?? 0;
          next[panelId] = (current + 1) % 4;
          updated = true;
        });
        return updated ? next : prev;
      });
    }, 500);
    return () => clearInterval(timer);
  }, [withdrawReceipt]);

  const applyBalanceSnapshot = (
    chainKey: ChainKey,
    snapshot: Partial<ApiChainBalances>,
    solanaAddressValue?: string | null,
  ) => {
    setBalancesByChain((prev) => {
      const existing = prev[chainKey] ?? { tokens: {} };
      const existingTokens = existing.tokens ?? {};
      const snapshotTokens = snapshot.tokens ?? {};
      
      // Merge tokens intelligently, preserving staleness fields from existing unless overridden
      const nextTokens: Record<string, ApiTokenBalance> = {};
      
      // First, copy all existing tokens
      Object.entries(existingTokens).forEach(([symbol, existingToken]) => {
        nextTokens[symbol] = { ...existingToken };
      });
      
      // Then apply snapshot updates, merging staleness fields appropriately
      Object.entries(snapshotTokens).forEach(([symbol, snapshotToken]) => {
        const existingToken = existingTokens[symbol];
        if (existingToken) {
          // Merge: keep existing staleness fields unless snapshot provides new ones
          nextTokens[symbol] = {
            ...existingToken,
            ...snapshotToken,
            // If snapshot provides balance, we should clear staleness (balance is fresh)
            ...(snapshotToken.balance !== undefined ? {
              isStale: false,
              staleReason: undefined,
              staleSince: undefined,
            } : {
              // Otherwise preserve existing staleness fields
              isStale: existingToken.isStale,
              staleReason: existingToken.staleReason,
              staleSince: existingToken.staleSince,
            }),
          };
        } else {
          // New token from snapshot
          nextTokens[symbol] = snapshotToken;
        }
      });

      const now = Date.now();
      Object.entries(nextTokens).forEach(([symbol, token]) => {
        const cacheKey = `${chainKey}:${symbol.toUpperCase()}`;
        const override = balanceOverrideRef.current[cacheKey];
        if (!override) return;
        if (override.expiresAt <= now) {
          delete balanceOverrideRef.current[cacheKey];
          return;
        }
        nextTokens[symbol] = {
          ...token,
          balance: override.value,
          ...(typeof override.raw === 'string' && override.raw.trim().length > 0
            ? { balanceRaw: override.raw.trim() }
            : {}),
        };
      });

      const merged: ApiChainBalances = {
        ...existing,
        ...snapshot,
        tokens: nextTokens,
        ...(solanaAddressValue !== undefined && solanaAddressValue !== null
          ? { solanaAddress: solanaAddressValue }
          : {}),
      };

      if (chainKey === selectedChain) {
        if (merged.address !== undefined) setEvmAddress(merged.address);
        if (merged.solanaAddress !== undefined) setSolanaAddress(merged.solanaAddress);
      }

      // Dispatch balance-updated events for tokens that changed
      Object.entries(nextTokens).forEach(([symbol, token]) => {
        const existingToken = existingTokens[symbol];
        if (!existingToken || existingToken.balance !== token.balance) {
          // Balance changed or new token
          dispatchBalanceUpdated({
            chainKey,
            symbol,
            balance: token.balance,
            decimals: token.decimals,
            source: 'cache', // or 'mongo'? We don't know source here, use 'cache' as default
            timestamp: Date.now(),
          });
        }
      });

      return {
        ...prev,
        [chainKey]: merged,
      };
    });
  };

  const loadCachedBalances = (
    cacheKey: string,
    chainKey: ChainKey,
    solanaAddressValue?: string | null,
    context?: 'login' | 'refresh' | 'openWallet' | 'changeChain' | 'swapComplete' | 'swapStart'
  ): { hit: boolean; stale: boolean } => {
    if (typeof window === 'undefined') return { hit: false, stale: false };
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return { hit: false, stale: false };
    try {
      const cached = JSON.parse(raw) as {
        timestamp: number;
        verifiedAt?: number; // Timestamp of last blockchain verification
        source?: 'cache' | 'mongo' | 'blockchain' | 'stale';
        chain?: ChainKey;
        tokens: Record<string, ApiTokenBalance>;
        address?: string;
        solanaAddress?: string;
      };
      if (!cached?.timestamp || !cached.tokens) return { hit: false, stale: false };

      const isSourceStale = cached.source === 'stale';
      
      // Check time-based staleness only if context matches staleTimerCheckConditions
      const staleTimer = BALANCE_RULES.staleness.staleTimer;
      let isTimeStale = false;
      if (staleTimer > 0 && context) {
        const staleTimerConditions = BALANCE_RULES.staleness.staleTimerCheckConditions;
        // Check if this context should trigger time-based staleness checking
        // Use type assertion to safely check property existence
        if (context in staleTimerConditions && staleTimerConditions[context as keyof typeof staleTimerConditions]) {
          const now = Date.now();
          const cacheAge = now - cached.timestamp;
          isTimeStale = cacheAge > staleTimer;
        }
      }

      const isStale = isSourceStale || isTimeStale;

      applyBalanceSnapshot(
        chainKey,
        {
          tokens: cached.tokens,
          address: cached.address,
          solanaAddress: cached.solanaAddress,
          source: cached.source,
          verifiedAt: cached.verifiedAt,
          timestamp: cached.timestamp,
        },
        solanaAddressValue
      );
      return { hit: true, stale: isStale };
    } catch {
      return { hit: false, stale: false };
    }
  };

  /**
   * Mark cache as stale to trigger refresh on next load
   */
  const markCacheAsStale = (chainKey: ChainKey, address: string) => {
    if (typeof window === 'undefined') return;
    
    const cacheKey = `cached:balances:${chainKey}:${address}`;
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return;
    
    try {
      const cached = JSON.parse(raw);
      // Update cache entry to mark it as stale
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          ...cached,
          source: 'stale' as const,
          timestamp: Date.now(), // Update timestamp so we know when it was marked stale
        })
      );
    } catch {
      // If we can't parse the cache, just remove it
      localStorage.removeItem(cacheKey);
    }
  };

  /**
   * Clear all balance caches on logout for privacy
   */
  const clearBalanceCaches = () => {
    if (typeof window === 'undefined') return;
    
    // Get all localStorage keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('cached:balances:')) {
        keysToRemove.push(key);
      }
    }
    
    // Remove all balance cache entries
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
    });
    
    console.log(`Cleared ${keysToRemove.length} balance cache entries on logout`);
  };

  const fetchBalancesForChain = async (
    chainKey: ChainKey,
    {
      forceRefresh,
      skipNetworkIfCached = false,
      skipAsyncVerification = false,
      includeAllChains = false,
      refreshSelectedChain = false,
    }: {
      forceRefresh: boolean;
      skipNetworkIfCached?: boolean;
      skipAsyncVerification?: boolean;
      includeAllChains?: boolean;
      refreshSelectedChain?: boolean;
    },
    context?: 'login' | 'refresh' | 'openWallet' | 'changeChain' | 'swapComplete' | 'swapStart'
  ) => {
    if (!authenticated) return;

    // Apply FORCE_QUERY_CHAINS configuration: force blockchain query for specific contexts
    let effectiveForceRefresh = forceRefresh;
    let effectiveSkipAsyncVerification = skipAsyncVerification;
    
    if (context && FORCE_QUERY_CHAINS.balances[context]) {
      // Force blockchain query for this context
      effectiveForceRefresh = true;
      // Don't skip async verification when forcing blockchain query
      effectiveSkipAsyncVerification = false;
      console.log(`[balances] FORCE_QUERY_CHAINS: context="${context}" forcing blockchain query`);
    }

    let token: string | null = null;
    try {
      token = await getCachedPrivyAccessToken(getAccessToken);
    } catch {
      token = null;
    }
    // Use the live Privy wallet address (always lowercase) as the EVM address for cache keying.
    const evmWalletAddress = wallets[0]?.address?.toLowerCase() ?? null;
    const cachedSolana = typeof window !== 'undefined' ? localStorage.getItem(cachedSolKey) : null;
    const solanaAddressValue = chainKey === 'SOLANA_MAINNET' || chainKey === 'SOLANA_DEVNET'
      ? solanaWallets[0]?.address ?? cachedSolana ?? null
      : null;

    if (chainKey === 'SOLANA_MAINNET' || chainKey === 'SOLANA_DEVNET') {
      if (!solanaAddressValue) return;
    } else if (!token && !evmWalletAddress) {
      return;
    }

    const cacheKey = `cached:balances:${chainKey}:${chainKey === 'SOLANA_MAINNET' || chainKey === 'SOLANA_DEVNET' ? solanaAddressValue : evmWalletAddress ?? 'unknown'}`;
    
    // Step 1: Always try to load cached balances for immediate UI display
    let cacheState: { hit: boolean; stale: boolean } = { hit: false, stale: false };
    if (!forceRefresh) {
      cacheState = loadCachedBalances(cacheKey, chainKey, solanaAddressValue, context);
      if (cacheState.hit && skipNetworkIfCached && !cacheState.stale) {
        return;
      }
      // Don't return - we still want to trigger async verification
    }

    // Step 2: Check if we already have an async verification in flight
    if (inFlightBalanceKey.current === cacheKey) return;
    inFlightBalanceKey.current = cacheKey;

    try {
      const res = await withWaitLogger(
        {
          file: 'altair_frontend1/src/components/UserMenu.tsx',
          target: '/api/balances',
          description: 'wallet balance response',
        },
        () =>
          fetch('/api/balances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              ...(token ? { accessToken: token } : {}),
              chain: chainKey,
              ...(effectiveForceRefresh ? { forceRefresh: true } : {}),
              ...(effectiveSkipAsyncVerification ? { skipAsyncVerification: true } : {}),
              ...(includeAllChains ? { includeAllChains: true } : {}),
              ...(refreshSelectedChain ? { refreshSelectedChain: true } : {}),
              walletAddress: chainKey === 'SOLANA_MAINNET' || chainKey === 'SOLANA_DEVNET' ? solanaAddressValue ?? undefined : evmWalletAddress ?? undefined,
            }),
          })
      );

      const data = await withWaitLogger(
        {
          file: 'altair_frontend1/src/components/UserMenu.tsx',
          target: 'balances response.json()',
          description: 'parse balances response JSON',
        },
        () => res.json()
      );

      const applyAndCacheChainPayload = (targetChainKey: ChainKey, payload: unknown) => {
        const fallbackAddress = targetChainKey === 'SOLANA_MAINNET' || targetChainKey === 'SOLANA_DEVNET'
          ? (solanaWallets[0]?.address ?? cachedSolana ?? null)
          : null;
        const normalizedByChain = normalizeBalancesResponse({
          chainKey: targetChainKey,
          payload,
          fallbackSolanaAddress: fallbackAddress,
        });
        const normalizedTokensByChain = normalizedByChain.tokens ?? {};

        applyBalanceSnapshot(
          targetChainKey,
          {
            tokens: normalizedTokensByChain,
            address: normalizedByChain.address,
            solanaAddress: normalizedByChain.solanaAddress,
            source: normalizedByChain.source,
            verifiedAt: normalizedByChain.verifiedAt,
            timestamp: normalizedByChain.timestamp,
          },
          fallbackAddress
        );

        if (typeof window !== 'undefined') {
          const addressForCache = targetChainKey === 'SOLANA_MAINNET' || targetChainKey === 'SOLANA_DEVNET'
            ? (normalizedByChain.solanaAddress ?? fallbackAddress ?? 'unknown')
            : (normalizedByChain.address ?? evmWalletAddress ?? 'unknown');
          const perChainCacheKey = `cached:balances:${targetChainKey}:${addressForCache}`;
          localStorage.setItem(
            perChainCacheKey,
            JSON.stringify({
              chain: targetChainKey,
              tokens: normalizedTokensByChain,
              address: normalizedByChain.address,
              solanaAddress: normalizedByChain.solanaAddress ?? fallbackAddress ?? undefined,
              timestamp: normalizedByChain.timestamp ?? Date.now(),
              verifiedAt: normalizedByChain.verifiedAt ?? Date.now(),
              source: normalizedByChain.source ?? 'blockchain',
            })
          );
        }

        return normalizedByChain;
      };

      const allChainsPayloadRaw =
        data && typeof data === 'object' && (data as Record<string, unknown>).allChains
          ? ((data as Record<string, unknown>).allChains as Partial<Record<ChainKey, unknown>>)
          : null;

      if (allChainsPayloadRaw && includeAllChains) {
        const chainKeys = Object.keys(CHAINS) as ChainKey[];
        chainKeys.forEach((targetChainKey) => {
          const payloadForChain = allChainsPayloadRaw[targetChainKey];
          if (!payloadForChain) return;
          applyAndCacheChainPayload(targetChainKey, payloadForChain);
        });

        if (!forceRefresh && !skipAsyncVerification) {
          window.setTimeout(() => {
            void fetchBalancesForChain(chainKey, {
              forceRefresh: false,
              skipNetworkIfCached: false,
              skipAsyncVerification: true,
              includeAllChains: true,
            });
          }, 1500);
        }

        return;
      }

      const normalized = normalizeBalancesResponse({
        chainKey,
        payload: data,
        fallbackSolanaAddress: solanaAddressValue,
      });
      const normalizedTokens = normalized.tokens ?? {};
      applyBalanceSnapshot(
        chainKey,
        {
          tokens: normalizedTokens,
          address: normalized.address,
          solanaAddress: normalized.solanaAddress,
          source: normalized.source,
          verifiedAt: normalized.verifiedAt,
          timestamp: normalized.timestamp,
        },
        solanaAddressValue
      );

      if (typeof window !== 'undefined') {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            chain: chainKey,
            tokens: normalizedTokens,
            address: normalized.address,
            solanaAddress: normalized.solanaAddress ?? solanaAddressValue ?? undefined,
            timestamp: normalized.timestamp ?? Date.now(),
            verifiedAt: normalized.verifiedAt ?? Date.now(),
            source: normalized.source ?? 'blockchain',
          })
        );
      }

      if (!forceRefresh && !skipAsyncVerification && normalized.source === 'mongo') {
        window.setTimeout(() => {
          void fetchBalancesForChain(chainKey, {
            forceRefresh: false,
            skipNetworkIfCached: false,
            skipAsyncVerification: true,
          });
        }, 1500);
      }
    } catch {
      // Preserve last-known snapshot on network/parse failures.
      // If local cache exists, re-apply it; otherwise keep current in-memory state untouched.
      void loadCachedBalances(cacheKey, chainKey, solanaAddressValue, context);
    } finally {
      if (inFlightBalanceKey.current === cacheKey) {
        inFlightBalanceKey.current = null;
      }
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedChain = localStorage.getItem('selectedChain');
      if (storedChain && storedChain in CHAINS) {
        setSelectedChain(storedChain as ChainKey);
      }
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
        setIsWalletOpen(false);
        setIsDevOpen(false);
        setIsNetworkOpen(false);
        setIsWalletDropdownChainOpen(false);
        setIsAddPanelChainOpen(false);
        setWalletPanels((current) => current.map((panel) => ({ ...panel, isChainOpen: false })));
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsAddPanelChainOpen, setWalletPanels, setSelectedChain]);

  useClientEffect(() => {
    const controller = new AbortController();

    const formatRawToHuman = (raw: string, decimals: number): string => {
      try {
        const value = BigInt(raw);
        const isNegative = value < 0n;
        const abs = isNegative ? -value : value;
        const base = 10n ** BigInt(decimals);
        const whole = abs / base;
        const fraction = abs % base;
        if (fraction === 0n) return `${isNegative ? '-' : ''}${whole.toString()}`;
        const padded = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
        return `${isNegative ? '-' : ''}${whole.toString()}.${padded}`;
      } catch {
        return '0';
      }
    };

    const applyInstantBalanceUpdates = (updates: Array<{
      chain: ChainKey;
      symbol: string;
      balanceAfterRaw: string | null;
      decimals: number;
    }>) => {
      if (!updates.length) return;

      const normalizeChainKey = (input: string): ChainKey | null => {
        const raw = input.trim();
        if (!raw) return null;
        const upper = raw.toUpperCase();
        if (upper in CHAINS) return upper as ChainKey;
        const normalized = raw.toLowerCase().replace(/[\s_-]+/g, '');
        if (normalized === 'solana' || normalized === 'solanamainnet') return 'SOLANA_MAINNET';
        if (normalized === 'base' || normalized === 'basemainnet') return 'BASE_MAINNET';
        if (normalized === 'basesepolia' || normalized === 'basesepoliatestnet') return 'BASE_SEPOLIA';
        if (normalized === 'eth' || normalized === 'ethereum' || normalized === 'ethmainnet' || normalized === 'ethereummainnet') return 'ETH_MAINNET';
        if (normalized === 'sepolia' || normalized === 'ethsepolia' || normalized === 'ethereumsepolia') return 'ETH_SEPOLIA';
        return null;
      };

      const snapshotByChain: Record<string, { tokens: Record<string, ApiTokenBalance> }> = {};

      updates.forEach((entry) => {
        if (!entry.balanceAfterRaw || !entry.chain) return;
        const chainKey = normalizeChainKey(entry.chain);
        if (!chainKey) return;
        const symbol = entry.symbol.trim().toUpperCase();
        const human = formatRawToHuman(entry.balanceAfterRaw, entry.decimals);
        balanceOverrideRef.current[`${chainKey}:${symbol}`] = {
          value: human,
          raw: entry.balanceAfterRaw,
          expiresAt: Date.now() + 25_000,
        };
        const bucket = (snapshotByChain[chainKey] ??= { tokens: {} });
        bucket.tokens[symbol] = {
          symbol,
          balance: human,
          balanceRaw: entry.balanceAfterRaw,
          decimals: entry.decimals,
        };
      });

      (Object.entries(snapshotByChain) as Array<[string, { tokens: Record<string, ApiTokenBalance> }]>).forEach(
        ([chainKeyRaw, snapshot]) => {
          const chainKey = chainKeyRaw as ChainKey;
          applyBalanceSnapshot(chainKey, snapshot);
        }
      );
    };

    const run = async ({
      forceRefresh,
      chainKey,
      skipNetworkIfCached = false,
      skipAsyncVerification = false,
      includeAllChains = false,
      refreshSelectedChain = false,
    }: {
      forceRefresh: boolean;
      chainKey: ChainKey;
      skipNetworkIfCached?: boolean;
      skipAsyncVerification?: boolean;
      includeAllChains?: boolean;
      refreshSelectedChain?: boolean;
    },
    context?: 'login' | 'refresh' | 'openWallet' | 'changeChain' | 'swapComplete' | 'swapStart'
    ) => {
      if (!authenticated) {
        loginPreloadKeyRef.current = null;
        setEvmAddress('');
        setSolanaAddress('');
        setBalancesByChain({} as Record<ChainKey, ApiChainBalances>);
        setIsWalletPanelOpen(false);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(cachedSolKey);
        }
        return;
      }

      await fetchBalancesForChain(chainKey, {
        forceRefresh,
        skipNetworkIfCached,
        skipAsyncVerification,
        includeAllChains,
        refreshSelectedChain,
      }, context);
    };

    const preloadAllChainsOnLogin = async () => {
      const preloadIdentityKey = [
        selectedChain,
        wallets[0]?.address ?? '',
        solanaWallets[0]?.address ?? '',
      ].join('|');

      if (loginPreloadKeyRef.current === preloadIdentityKey) return;
      loginPreloadKeyRef.current = preloadIdentityKey;

      const firstChain = selectedChain;
      await run({
        forceRefresh: false,
        chainKey: firstChain,
        includeAllChains: true,
        skipAsyncVerification: true,
        refreshSelectedChain: true,
      }, 'login');
    };

    // Login/refresh preload across all chains so every token in Mongo-backed balances is cached client-side.
    void preloadAllChainsOnLogin();

    const handleWalletOpen = () => {
      // Wallet-open should render from cache; only hit API when cache entry is missing.
      void run({ forceRefresh: false, chainKey: selectedChain, skipNetworkIfCached: true }, 'openWallet');
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('altair:wallet-open', handleWalletOpen);
    }

    const handleSwapComplete = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        chain?: ChainKey;
        balanceUpdates?: Array<{
          chain: ChainKey;
          symbol: string;
          balanceAfterRaw: string | null;
          decimals: number;
        }>;
      } | undefined;

      if (Array.isArray(detail?.balanceUpdates) && detail.balanceUpdates.length > 0) {
        applyInstantBalanceUpdates(detail.balanceUpdates);
        
        // Mark cache as stale for affected chains
        const affectedChains = new Set<ChainKey>();
        detail.balanceUpdates.forEach(update => {
          if (update.chain) {
            affectedChains.add(update.chain);
          }
        });
        
        // Get addresses for affected chains and mark cache stale
        affectedChains.forEach(chainKey => {
          if (chainKey === 'SOLANA_MAINNET' || chainKey === 'SOLANA_DEVNET') {
            const solanaAddress = solanaWallets[0]?.address ??
              (typeof window !== 'undefined' ? localStorage.getItem(cachedSolKey) : null);
            if (solanaAddress) {
              markCacheAsStale(chainKey, solanaAddress);
            }
          } else {
            const evmAddressForStale = wallets[0]?.address?.toLowerCase() ?? null;
            if (evmAddressForStale) {
              markCacheAsStale(chainKey, evmAddressForStale);
            }
          }
        });

        // Force-refresh every affected chain for durable reconciliation,
        // independent of currently selectedChain.
        affectedChains.forEach((chainKey) => {
          void run({ forceRefresh: false, chainKey, skipAsyncVerification: true }, 'swapComplete');
        });
      }

      if (detail?.chain) {
        void run({ forceRefresh: false, chainKey: detail.chain, skipAsyncVerification: true }, 'swapComplete');
        if (detail.chain !== selectedChain) return;
      }
      void run({ forceRefresh: false, chainKey: selectedChain, skipAsyncVerification: true }, 'swapComplete');
    };

    const handleBalanceStale = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        chainKey: ChainKey;
        symbol: string;
        reason: 'swap' | 'timer' | 'manual';
        timestamp: number;
      };
      
      // Update the token's staleness state in balancesByChain
      setBalancesByChain((prev) => {
        const chainBalances = prev[detail.chainKey];
        if (!chainBalances?.tokens?.[detail.symbol]) return prev;
        
        const updatedTokens = { ...chainBalances.tokens };
        updatedTokens[detail.symbol] = {
          ...updatedTokens[detail.symbol],
          isStale: true,
          staleReason: detail.reason,
          staleSince: detail.timestamp,
        };
        
        return {
          ...prev,
          [detail.chainKey]: {
            ...chainBalances,
            tokens: updatedTokens,
          },
        };
      });

      // Trigger balance verification when swap starts
      if (detail.reason === 'swap') {
        // Use swapStart context to trigger time-based staleness checking
        fetchBalancesForChain(detail.chainKey, {
          forceRefresh: false,
          skipNetworkIfCached: false,
          skipAsyncVerification: false,
          includeAllChains: false,
          refreshSelectedChain: false,
        }, 'swapStart');
      }
    };

    const handleBalanceUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        chainKey: ChainKey;
        symbol: string;
        balance: string;
        decimals: number;
        source: 'cache' | 'mongo' | 'blockchain' | 'stale';
        timestamp: number;
      };
      
      // Update the token balance and clear staleness
      setBalancesByChain((prev) => {
        const chainBalances = prev[detail.chainKey];
        const existingToken = chainBalances?.tokens?.[detail.symbol];
        
        const updatedTokens = { ...(chainBalances?.tokens ?? {}) };
        updatedTokens[detail.symbol] = {
          ...existingToken,
          balance: detail.balance,
          decimals: detail.decimals,
          isStale: false,
          staleReason: undefined,
          staleSince: undefined,
        };
        
        return {
          ...prev,
          [detail.chainKey]: {
            ...(chainBalances ?? { tokens: {} }),
            tokens: updatedTokens,
          },
        };
      });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('altair:swap-complete', handleSwapComplete);
      window.addEventListener('altair:balance-stale', handleBalanceStale);
      window.addEventListener('altair:balance-updated', handleBalanceUpdated);
    }

    return () => {
      controller.abort();
      if (typeof window !== 'undefined') {
        window.removeEventListener('altair:swap-complete', handleSwapComplete);
        window.removeEventListener('altair:wallet-open', handleWalletOpen);
        window.removeEventListener('altair:balance-stale', handleBalanceStale);
        window.removeEventListener('altair:balance-updated', handleBalanceUpdated);
      }
    };
  }, [authenticated, selectedChain, wallets, solanaWallets, activeNetworkOptions]);

  // TRANSACTION_INFO_PANEL: pre-create on swap-confirmed, populate txHash on swap-submitted, update on swap-complete.
  const addTransactionInfoPanelRef = useRef(addTransactionInfoPanel);
  const setTransactionInfoPanelsRef = useRef(setTransactionInfoPanels);
  addTransactionInfoPanelRef.current = addTransactionInfoPanel;
  setTransactionInfoPanelsRef.current = setTransactionInfoPanels;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const toRawString = (token: { balance?: string; balanceRaw?: string; decimals?: number } | undefined): {
      raw: string | null;
      decimals: number | null;
    } => {
      if (!token) return { raw: null, decimals: null };
      const decimals = typeof token.decimals === 'number' ? token.decimals : null;
      if (typeof token.balanceRaw === 'string' && token.balanceRaw.length > 0) {
        return { raw: token.balanceRaw, decimals };
      }
      if (typeof token.balance === 'string' && token.balance.length > 0 && decimals !== null) {
        const num = Number(token.balance);
        if (Number.isFinite(num) && num >= 0) {
          try {
            const whole = Math.floor(num);
            const fraction = num - whole;
            const scale = 10 ** decimals;
            const raw = BigInt(whole) * BigInt(scale) + BigInt(Math.round(fraction * scale));
            return { raw: raw.toString(), decimals };
          } catch {
            return { raw: null, decimals };
          }
        }
      }
      return { raw: null, decimals };
    };

    const rawDeltaToHuman = (afterRaw: string, beforeRaw: string | null, decimals: number): string => {
      try {
        const after = BigInt(afterRaw);
        const before = beforeRaw ? BigInt(beforeRaw) : 0n;
        const diff = after - before;
        const sign = diff < 0n ? '-' : '';
        const abs = diff < 0n ? -diff : diff;
        const base = 10n ** BigInt(decimals);
        const whole = abs / base;
        const fraction = abs % base;
        if (fraction === 0n) return `${sign}${whole.toString()}`;
        const padded = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
        return `${sign}${whole.toString()}.${padded}`;
      } catch {
        return '0';
      }
    };

    const handleSwapConfirmedForPanel = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        sellToken?: string;
        buyToken?: string;
        sellChain?: ChainKey;
        buyChain?: ChainKey;
        amount?: string;
      } | undefined;
      if (!detail) return;
      const sellChain = detail.sellChain;
      const buyChain = detail.buyChain;
      const sellToken = (detail.sellToken ?? '').toUpperCase();
      const buyToken = (detail.buyToken ?? '').toUpperCase();
      if (!sellChain || !buyChain || !sellToken || !buyToken) return;

      const buyTokenSnapshot = balancesByChainRef.current?.[buyChain]?.tokens?.[buyToken];
      const { raw: buyBalanceBeforeRaw, decimals: buyTokenDecimals } = toRawString(buyTokenSnapshot);

      addTransactionInfoPanelRef.current({
        txKey: null,
        txHash: null,
        sellChain,
        buyChain,
        sellToken,
        buyToken,
        sellAmount: detail.amount ?? '',
        buyAmount: null,
        buyBalanceBeforeRaw,
        buyTokenDecimals,
        status: 'pending',
      });
    };

    const handleSwapSubmittedForPanel = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        sellToken?: string;
        buyToken?: string;
        sellChain?: ChainKey;
        buyChain?: ChainKey;
        amount?: string;
        txHash?: string;
        requestId?: string;
      } | undefined;
      if (!detail) return;
      const sellChain = detail.sellChain;
      const buyChain = detail.buyChain;
      const sellToken = (detail.sellToken ?? '').toUpperCase();
      const buyToken = (detail.buyToken ?? '').toUpperCase();
      if (!sellChain || !buyChain || !sellToken || !buyToken) return;
      const txKey = detail.txHash ?? detail.requestId ?? null;

      setTransactionInfoPanelsRef.current((current) => {
        for (let i = current.length - 1; i >= 0; i -= 1) {
          const panel = current[i];
          if (panel.status !== 'pending') continue;
          if (panel.txKey !== null) continue;
          if (panel.sellToken !== sellToken) continue;
          if (panel.buyToken !== buyToken) continue;
          if (panel.sellChain !== sellChain) continue;
          const next = current.slice();
          next[i] = {
            ...panel,
            txKey,
            txHash: detail.txHash ?? null,
            sellAmount: detail.amount ?? panel.sellAmount,
          };
          return next;
        }

        const buyTokenSnapshot = balancesByChainRef.current?.[buyChain]?.tokens?.[buyToken];
        const { raw: buyBalanceBeforeRaw, decimals: buyTokenDecimals } = toRawString(buyTokenSnapshot);
        const nextId = (current.reduce((max, p) => Math.max(max, p.id), 0)) + 1;
        return [
          ...current,
          {
            id: nextId,
            txKey,
            txHash: detail.txHash ?? null,
            sellChain,
            buyChain,
            sellToken,
            buyToken,
            sellAmount: detail.amount ?? '',
            buyAmount: null,
            buyBalanceBeforeRaw,
            buyTokenDecimals,
            status: 'pending',
          },
        ];
      });
    };

    const handleSwapCompleteForPanel = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        chain?: ChainKey;
        sellToken?: string;
        buyToken?: string;
        txHash?: string;
        requestId?: string;
        balanceUpdates?: Array<{
          chain: ChainKey;
          symbol: string;
          balanceAfterRaw: string | null;
          decimals: number;
        }>;
      } | undefined;
      if (!detail) return;
      const sellToken = (detail.sellToken ?? '').toUpperCase();
      const buyToken = (detail.buyToken ?? '').toUpperCase();
      const sellChainFromDetail = detail.chain;
      const txKey = detail.txHash ?? detail.requestId ?? null;

      setTransactionInfoPanelsRef.current((current) => {
        let matchedIndex = -1;
        if (txKey) {
          for (let i = current.length - 1; i >= 0; i -= 1) {
            const panel = current[i];
            if (panel.status !== 'pending') continue;
            if (panel.txKey && panel.txKey === txKey) {
              matchedIndex = i;
              break;
            }
          }
        }
        if (matchedIndex === -1) {
          for (let i = current.length - 1; i >= 0; i -= 1) {
            const panel = current[i];
            if (panel.status !== 'pending') continue;
            if (panel.sellToken !== sellToken) continue;
            if (panel.buyToken !== buyToken) continue;
            if (sellChainFromDetail && panel.sellChain !== sellChainFromDetail) continue;
            matchedIndex = i;
            break;
          }
        }
        if (matchedIndex === -1) {
          for (let i = current.length - 1; i >= 0; i -= 1) {
            const panel = current[i];
            if (panel.status !== 'pending') continue;
            if (panel.buyToken !== buyToken) continue;
            matchedIndex = i;
            break;
          }
        }
        if (matchedIndex === -1) {
          console.warn('[TransactionInfoPanel] swap-complete fired with no matching pending side panel', {
            txKey,
            sellToken,
            buyToken,
            sellChainFromDetail,
          });
          return current;
        }
        const panel = current[matchedIndex];
        const buyEntry = (detail.balanceUpdates ?? []).find(
          (entry) =>
            (entry.symbol ?? '').toUpperCase() === panel.buyToken &&
            (entry.chain === panel.buyChain)
        );
        const next = current.slice();
        if (buyEntry?.balanceAfterRaw) {
          const decimals = panel.buyTokenDecimals ?? buyEntry.decimals ?? 0;
          next[matchedIndex] = {
            ...panel,
            status: 'complete',
            buyAmount: rawDeltaToHuman(buyEntry.balanceAfterRaw, panel.buyBalanceBeforeRaw, decimals),
            buyTokenDecimals: decimals,
            txKey: panel.txKey ?? txKey,
            txHash: panel.txHash ?? (detail.txHash ?? null),
          };
        } else {
          next[matchedIndex] = {
            ...panel,
            status: 'complete',
            txKey: panel.txKey ?? txKey,
            txHash: panel.txHash ?? (detail.txHash ?? null),
          };
        }
        return next;
      });
    };

    window.addEventListener('altair:swap-confirmed', handleSwapConfirmedForPanel);
    window.addEventListener('altair:swap-submitted', handleSwapSubmittedForPanel);
    window.addEventListener('altair:swap-complete', handleSwapCompleteForPanel);
    return () => {
      window.removeEventListener('altair:swap-confirmed', handleSwapConfirmedForPanel);
      window.removeEventListener('altair:swap-submitted', handleSwapSubmittedForPanel);
      window.removeEventListener('altair:swap-complete', handleSwapCompleteForPanel);
    };
  }, []);

  useEffect(() => {
    if (!activeNetworkOptions.some((option) => option.key === selectedChain)) {
      const fallback = activeNetworkOptions[0]?.key;
      if (fallback) {
        setSelectedChain(fallback);
        if (typeof window !== 'undefined') {
          localStorage.setItem('selectedChain', fallback);
        }
      }
    }
  }, [activeNetworkOptions, selectedChain]);

  useEffect(() => {
    if (!walletChainKeySet.has(walletDropdownChain)) {
      setWalletDropdownChain(fallbackWalletChain);
    }
    if (!walletChainKeySet.has(addPanelChain)) {
      setAddPanelChain(fallbackWalletChain);
    }
    setWalletPanels((current) =>
      current.map((panel) =>
        walletChainKeySet.has(panel.chainKey)
          ? panel
          : { ...panel, chainKey: fallbackWalletChain }
      )
    );
  }, [walletChainKeySet, walletDropdownChain, addPanelChain, fallbackWalletChain, setAddPanelChain, setWalletPanels]);

  const showSwapMessage = (message: { type: 'success' | 'error'; text: string }) => {
    setSwapMessage(message);
    window.setTimeout(() => {
      setSwapMessage((current) => (current === message ? null : current));
    }, 6000);
  };

  const resolveWalletTitle = (chainKey: ChainKey | 'ALL') => {
    const base = walletSelectedLabelByKey[chainKey] ?? walletChainOptions.find((option) => option.key === chainKey)?.label ?? 'All Chains';
    return `${base} ▼`;
  };
  const resolveWalletAddress = (chainKey: ChainKey | 'ALL') => {
    if (chainKey === 'ALL') return '';
    const snapshot = balancesByChain[chainKey as ChainKey];
    if (chainKey === 'SOLANA_MAINNET' || chainKey === 'SOLANA_DEVNET') return snapshot?.solanaAddress ?? solanaDisplayAddress;
    return snapshot?.address ?? evmAddress;
  };
  const resolveBalanceForSymbol = (chainKey: ChainKey | 'ALL', symbol: string) => {
    const normalized = symbol.trim().toUpperCase();
    
    if (chainKey === 'ALL') {
      // Sum balances across all MAINNET chains for this token (exclude testnets)
      let total = 0;
      Object.entries(balancesByChain).forEach(([chain, balances]) => {
        // Skip testnet chains (ETH_SEPOLIA, BASE_SEPOLIA)
        if (chain === 'ETH_SEPOLIA' || chain === 'BASE_SEPOLIA') {
          return;
        }
        
        const balanceStr = balances.tokens?.[normalized]?.balance;
        if (balanceStr !== undefined) {
          const balanceNum = parseFloat(balanceStr);
          if (!isNaN(balanceNum)) {
            total += balanceNum;
          }
        }
      });
      return total.toString();
    }
    
    // For specific chain
    const snapshot = balancesByChain[chainKey as ChainKey];
    return snapshot?.tokens?.[normalized]?.balance ?? '0';
  };
  const resolveRpcUrl = (chainKey: ChainKey) => {
    const chainConfigs = {
      BASE_SEPOLIA,
      ETH_SEPOLIA,
      ETH_MAINNET,
      BASE_MAINNET,
      SOLANA_MAINNET,
      SOLANA_DEVNET,
    } as const;
    const chainConfig = chainConfigs[chainKey];
    if (!chainConfig || !('rpcUrls' in chainConfig)) return null;
    const resolved = resolveRpcUrls(chainConfig.rpcUrls);
    return resolved[0] ?? chainConfig.rpcUrls[0];
  };
  const buildTokenMap = (tokensModule: Record<string, { address?: string; decimals?: number; symbol?: string }>) => {
    const map: Record<string, { address: string; decimals: number; symbol: string }> = {};
    Object.entries(tokensModule).forEach(([key, token]) => {
      if (!token || typeof token !== 'object') return;
      const address = typeof token.address === 'string' ? token.address : '';
      const decimals = typeof token.decimals === 'number' ? token.decimals : undefined;
      if (!address || decimals === undefined) return;
      const symbol = typeof token.symbol === 'string' && token.symbol.length > 0 ? token.symbol : key;
      map[symbol.toUpperCase()] = { address, decimals, symbol };
    });
    return map;
  };
  const getTokenConfigMap = (chainKey: ChainKey) => {
    const tokenConfigs: Record<ChainKey, Record<string, { address: string; decimals: number; symbol: string }>> = {
      BASE_SEPOLIA: buildTokenMap(BaseSepoliaTokens as Record<string, { address?: string; decimals?: number; symbol?: string }>),
      ETH_SEPOLIA: buildTokenMap(EthSepoliaTokens as Record<string, { address?: string; decimals?: number; symbol?: string }>),
      ETH_MAINNET: buildTokenMap(EthTokens as Record<string, { address?: string; decimals?: number; symbol?: string }>),
      BASE_MAINNET: buildTokenMap(BaseTokens as Record<string, { address?: string; decimals?: number; symbol?: string }>),
      SOLANA_MAINNET: buildTokenMap(SolanaTokens as Record<string, { address?: string; decimals?: number; symbol?: string }>),
      SOLANA_DEVNET: buildTokenMap(SolanaTokens as Record<string, { address?: string; decimals?: number; symbol?: string }>),
    };
    return tokenConfigs[chainKey];
  };
  const isSolanaChain = (chainKey: ChainKey | 'ALL') => chainKey === 'SOLANA_MAINNET' || chainKey === 'SOLANA_DEVNET';
  const sendEvmTransfer = async (params: {
    chainKey: ChainKey;
    recipient: string;
    tokenSymbol: string;
    amount: string;
  }) => {
    if (!wallets?.length) throw new Error('No authenticated wallet available.');
    const rpcUrl = resolveRpcUrl(params.chainKey);
    if (!rpcUrl) throw new Error('Missing RPC URL for chain.');
    const tokenMap = getTokenConfigMap(params.chainKey);
    const normalizedSymbol = params.tokenSymbol.toUpperCase();
    const gasToken = gasTokensByChain[params.chainKey];
    const wallet = wallets[0];
    const ethereumProvider = await wallet.getEthereumProvider();
    const provider = new ethers.BrowserProvider(ethereumProvider);
    const signer = await provider.getSigner();
    if (normalizedSymbol === gasToken) {
      const tx = await signer.sendTransaction({
        to: params.recipient,
        value: ethers.parseEther(params.amount),
      });
      await tx.wait();
      return tx.hash as string;
    }
    const tokenInfo = tokenMap[normalizedSymbol];
    if (!tokenInfo) throw new Error(`Unsupported token ${normalizedSymbol} on ${params.chainKey}.`);
    const tokenContract = new ethers.Contract(
      tokenInfo.address,
      ['function transfer(address to, uint256 value) returns (bool)'],
      signer
    );
    const amountRaw = ethers.parseUnits(params.amount, tokenInfo.decimals);
    const tx = await tokenContract.transfer(params.recipient, amountRaw);
    await tx.wait();
    return tx.hash as string;
  };
  const resolveTokenRows = (chainKey: ChainKey | 'ALL') => resolveTokenRowsForChain(balancesByChain, chainKey);
  const resolveWithdrawState = (panelId: number) =>
    withdrawPanels[panelId] ?? { active: false, token: '', amount: '', address: '' };
  const resolveWithdrawReceipt = (panelId: number) =>
    withdrawReceipt[panelId] ?? { active: false, status: undefined, txHash: null };
  const resolveWithdrawError = (panelId: number) => withdrawErrors[panelId] ?? null;
  const resolveWithdrawDots = (panelId: number) => withdrawSubmittedDots[panelId] ?? 0;
  const clearWithdrawError = (panelId: number) => {
    setWithdrawErrors((prev) => {
      if (!prev[panelId]) return prev;
      const { [panelId]: _removed, ...rest } = prev;
      return rest;
    });
  };
  const clearWithdrawReceipt = (panelId: number) => {
    setWithdrawReceipt((prev) => {
      if (!prev[panelId]) return prev;
      const { [panelId]: _removed, ...rest } = prev;
      return rest;
    });
    setWithdrawSubmittedDots((prev) => {
      if (!prev[panelId]) return prev;
      const { [panelId]: _removed, ...rest } = prev;
      return rest;
    });
  };
  const isValidWithdrawToken = (chainKey: ChainKey | 'ALL', token: string) => {
    if (chainKey === 'ALL') return false;
    const normalized = token.trim().toUpperCase();
    if (!normalized) return false;
    return resolveTokenRows(chainKey).includes(normalized);
  };
  const isValidRecipientAddress = (chainKey: ChainKey | 'ALL', address: string) => {
    const trimmed = address.trim();
    if (!trimmed || chainKey === 'ALL') return false;
    if (chainKey === 'SOLANA_MAINNET' || chainKey === 'SOLANA_DEVNET') {
      try {
        const pubkey = new PublicKey(trimmed);
        return PublicKey.isOnCurve(pubkey.toBuffer());
      } catch {
        return false;
      }
    }
    return ethers.isAddress(trimmed);
  };
  const isValidWithdrawAmount = (chainKey: ChainKey | 'ALL', token: string, amount: string) => {
    const trimmed = amount.trim();
    if (!trimmed) return false;
    const amountNumber = Number(trimmed);
    if (!Number.isFinite(amountNumber) || amountNumber <= 0) return false;
    if (chainKey === 'ALL') return false;
    const normalizedToken = token.trim().toUpperCase();
    if (!normalizedToken) return false;
    const balanceValue = resolveBalanceForSymbol(chainKey, normalizedToken);
    const balanceNumber = Number(balanceValue);
    if (!Number.isFinite(balanceNumber)) return false;
    return amountNumber <= balanceNumber;
  };
  const resolveTokenDropdownOpen = (panelId: number) => Boolean(tokenDropdownOpen[panelId]);
  const resolveTokenDropdownForceAll = (panelId: number) => Boolean(tokenDropdownForceAll[panelId]);
  const resolveWalletCopyActive = (key: string) => Boolean(walletAddressCopyState[key]);
  const triggerWalletCopyState = (key: string) => {
    setWalletAddressCopyState((prev) => ({ ...prev, [key]: true }));
    const existing = walletAddressCopyTimers.current[key];
    if (existing) {
      clearTimeout(existing);
    }
    if (walletAddressCopyDurationMs > 0) {
      walletAddressCopyTimers.current[key] = setTimeout(() => {
        setWalletAddressCopyState((prev) => {
          if (!prev[key]) return prev;
          const { [key]: _removed, ...rest } = prev;
          return rest;
        });
      }, walletAddressCopyDurationMs);
    }
  };
  const toggleWithdrawPanel = (panelId: number, options?: { clearOnClose?: boolean }) => {
    setWithdrawPanels((prev) => {
      const current = prev[panelId] ?? { active: false, token: '', amount: '', address: '' };
      const nextActive = !current.active;
      if (!nextActive && options?.clearOnClose) {
        const { [panelId]: _removed, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [panelId]: { ...current, active: nextActive },
      };
    });
    setTokenDropdownOpen((prev) => {
      if (!prev[panelId]) return prev;
      const { [panelId]: _removed, ...rest } = prev;
      return rest;
    });
    setTokenDropdownForceAll((prev) => {
      if (!prev[panelId]) return prev;
      const { [panelId]: _removed, ...rest } = prev;
      return rest;
    });
    setWithdrawReceipt((prev) => {
      const current = prev[panelId] ?? { active: false, txHash: null };
      if (current.active) {
        const { [panelId]: _removed, ...rest } = prev;
        return rest;
      }
      return prev;
    });
    clearWithdrawReceipt(panelId);
    setWithdrawSubmittedDots((prev) => {
      if (!prev[panelId]) return prev;
      const { [panelId]: _removed, ...rest } = prev;
      return rest;
    });
    if (options?.clearOnClose) {
      setWithdrawErrors((prev) => {
        if (!prev[panelId]) return prev;
        const { [panelId]: _removed, ...rest } = prev;
        return rest;
      });
    }
  };
  const updateWithdrawToken = (panelId: number, token: string) => {
    setWithdrawPanels((prev) => {
      const current = prev[panelId] ?? { active: false, token: '', amount: '', address: '' };
      return {
        ...prev,
        [panelId]: { ...current, token },
      };
    });
    if (resolveWithdrawError(panelId) === 'Invalid token') {
      const chainKey = (walletPanels.find((panel) => panel.id === panelId)?.chainKey ?? 'ALL') as ChainKey | 'ALL';
      if (isValidWithdrawToken(chainKey, token)) {
        clearWithdrawError(panelId);
      }
      return;
    }
    if (resolveWithdrawError(panelId) === 'No token selected' && token.trim()) {
      clearWithdrawError(panelId);
    }
  };
  const updateWithdrawAmount = (panelId: number, amount: string) => {
    setWithdrawPanels((prev) => {
      const current = prev[panelId] ?? { active: false, token: '', amount: '', address: '' };
      return {
        ...prev,
        [panelId]: { ...current, amount },
      };
    });
    const existing = resolveWithdrawError(panelId);
    if (existing === 'No token amount' && amount.trim()) {
      clearWithdrawError(panelId);
    } else if (existing && existing.startsWith('Insufficient ') && existing.endsWith(' in Wallet')) {
      const chainKey = (walletPanels.find((panel) => panel.id === panelId)?.chainKey ?? 'ALL') as ChainKey | 'ALL';
      const token = resolveWithdrawState(panelId).token;
      if (isValidWithdrawAmount(chainKey, token, amount)) {
        clearWithdrawError(panelId);
      }
    }
  };
  const updateWithdrawAddress = (panelId: number, address: string) => {
    setWithdrawPanels((prev) => {
      const current = prev[panelId] ?? { active: false, token: '', amount: '', address: '' };
      return {
        ...prev,
        [panelId]: { ...current, address },
      };
    });
    const existing = resolveWithdrawError(panelId);
    if (existing === 'No recipient address' && address.trim()) {
      clearWithdrawError(panelId);
      return;
    }
    if (existing === 'Invalid recipient address') {
      const chainKey = (walletPanels.find((panel) => panel.id === panelId)?.chainKey ?? 'ALL') as ChainKey | 'ALL';
      if (isValidRecipientAddress(chainKey, address)) {
        clearWithdrawError(panelId);
      }
    }
  };
  const resolveTokenIconSrc = (symbol: string): string | null => {
    if (!symbol || !tokenIconFileType || !tokenIconFileSize) return null;
    return `/image/tokens/${tokenIconFileType}/${tokenIconFileSize}/${symbol}.${tokenIconFileType}`;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const preload = (src: string) => {
      const image = new window.Image();
      image.src = src;
    };

    const urls = new Set<string>();

    const selectedChainIconSrc = resolveActiveNetworkMenuChainIconSrc(selectedChain)
      ?? resolveActiveNetworkChainIconSrc(selectedChain);
    if (selectedChainIconSrc) {
      urls.add(selectedChainIconSrc);
    }

    const topTokenSymbols = resolveTokenRows(walletDropdownChain).slice(0, 5);
    topTokenSymbols.forEach((symbol) => {
      const iconSrc = resolveTokenIconSrc(symbol);
      if (iconSrc) urls.add(iconSrc);
    });

    urls.forEach(preload);
  }, [selectedChain, walletDropdownChain]);

  const placeholderCircleStyle: React.CSSProperties = {
    width: `${tokenIconSize}px`,
    height: `${tokenIconSize}px`,
    borderRadius: '50%',
    backgroundColor: tokenIconPlaceholderColor,
    ...resolveIconBorderStyle(tokenIconBorderPosition, tokenIconBorderColor, tokenIconBorderWidth),
    flexShrink: 0,
    marginRight: `${Math.round(tokenIconSize * 0.4)}px`,
    position: 'relative',
    overflow: 'hidden',
  };

  const questionMarkStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: `${tokenIconPlaceholderFontSize}px`,
    color: tokenIconPlaceholderFontColor,
    userSelect: 'none',
    pointerEvents: 'none',
  };

  const resolveTokenPriceForSymbol = (chainKey: ChainKey | 'ALL', symbol: string): number | null => {
    const normalized = symbol.trim().toUpperCase();
    if (chainKey === 'ALL') {
      for (const [chain, balances] of Object.entries(balancesByChain)) {
        if (chain === 'ETH_SEPOLIA' || chain === 'BASE_SEPOLIA') continue;
        const p = balances?.tokens?.[normalized]?.price;
        if (typeof p === 'number' && Number.isFinite(p)) return p;
      }
      return null;
    }
    const p = balancesByChain[chainKey as ChainKey]?.tokens?.[normalized]?.price;
    return typeof p === 'number' && Number.isFinite(p) ? p : null;
  };

  const resolveTokenDollarValueForSymbol = (
    chainKey: ChainKey | 'ALL',
    symbol: string
  ): number | null => {
    const normalized = symbol.trim().toUpperCase();
    if (chainKey === 'ALL') {
      let total = 0;
      let anyFound = false;
      for (const [chain, balances] of Object.entries(balancesByChain)) {
        if (chain === 'ETH_SEPOLIA' || chain === 'BASE_SEPOLIA') continue;
        const token = balances?.tokens?.[normalized];
        if (!token) continue;
        const balanceNum = parseFloat(token.balance ?? '0');
        const price = typeof token.price === 'number' && Number.isFinite(token.price) ? token.price : null;
        if (!isNaN(balanceNum) && price !== null) {
          total += balanceNum * price;
          anyFound = true;
        }
      }
      return anyFound ? total : null;
    }
    const token = balancesByChain[chainKey as ChainKey]?.tokens?.[normalized];
    if (!token) return null;
    const balanceNum = parseFloat(token.balance ?? '0');
    const price = typeof token.price === 'number' && Number.isFinite(token.price) ? token.price : null;
    if (price === null || isNaN(balanceNum)) return null;
    return balanceNum * price;
  };

  // USD values are truncated (not rounded) to `decimals` places so the visible
  // figure never overstates the underlying amount — e.g. $3.149 renders $3.14,
  // not $3.15.
  const formatUsd = (value: number, decimals: number): string => {
    const factor = Math.pow(10, decimals);
    const truncated = Math.trunc(value * factor) / factor;
    return (
      '$' +
      truncated.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    );
  };

  const renderBalances = (chainKey: ChainKey | 'ALL') => {
    const rows = resolveTokenRows(chainKey);
    return rows.map((symbol, index) => {
      const balanceValue = resolveBalanceForSymbol(chainKey, symbol);
      const tokenPrice = resolveTokenPriceForSymbol(chainKey, symbol);
      const dollarValue = resolveTokenDollarValueForSymbol(chainKey, symbol);
      const iconSrc = resolveTokenIconSrc(symbol);
      return (
        <React.Fragment key={symbol}>
          <div
            className="flex w-full items-center"
            style={{
              paddingLeft: `${containerPaddingLeft}px`,
              paddingRight: `${containerPaddingRight}px`,
              paddingTop: `${tokenRowPaddingTop}px`,
              paddingBottom: `${tokenRowPaddingBottom}px`,
            }}
          >
            <div style={placeholderCircleStyle}>
              {iconSrc ? (
                <>
                  {tokenIconSpinEnabled ? (
                    <SpinningLogo
                      src={iconSrc}
                      alt={symbol}
                      width={tokenIconSize}
                      height={tokenIconSize}
                      className="absolute inset-0 h-full w-full object-contain"
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement;
                        img.style.display = 'none';
                        const fallback = img.nextSibling as HTMLElement | null;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  ) : (
                    <Image
                      src={iconSrc}
                      alt={symbol}
                      width={tokenIconSize}
                      height={tokenIconSize}
                      className="absolute inset-0 h-full w-full object-contain"
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement;
                        img.style.display = 'none';
                        const fallback = img.nextSibling as HTMLElement | null;
                        if (fallback) fallback.style.display = 'flex';
                      }}
                    />
                  )}
                  <span style={{ ...questionMarkStyle, display: 'none' }}>?</span>
                </>
              ) : (
                <span style={questionMarkStyle}>?</span>
              )}
            </div>
            <div className="flex flex-1 flex-col">
              <span
                style={{
                  fontSize: `${tokenSymbolFontSize}px`,
                  fontFamily: tokenSymbolFontFamily,
                  color: tokenSymbolColor,
                  lineHeight: tokenSymbolLineHeight,
                  paddingBottom: `${tokenSymbolPaddingBottom}px`,
                }}
              >
                {symbol}
              </span>
              {tokenPrice !== null ? (
                <span
                  style={{
                    fontSize: `${tokenPriceFontSize}px`,
                    fontFamily: tokenPriceFontFamily,
                    color: tokenPriceColor,
                    lineHeight: tokenPriceLineHeight,
                    paddingTop: `${tokenPricePaddingTop}px`,
                  }}
                >
                  {formatUsd(tokenPrice, tokenPriceDecimals)}
                </span>
              ) : null}
            </div>
            <span
              className="px-3 text-center whitespace-nowrap hover:whitespace-normal"
              style={{
                fontSize: `${tokenBalanceFontSize}px`,
                fontFamily: tokenBalanceFontFamily,
                color: tokenBalanceColor,
                paddingTop: `${tokenRowPaddingTop}px`,
                paddingBottom: `${tokenRowPaddingBottom}px`,
              }}
              title={balanceValue}
            >
              {Number.isNaN(Number(balanceValue))
                ? balanceValue
                : Number(balanceValue).toFixed(tokenBalanceDecimals)}
            </span>
            {dollarValue !== null ? (
              <span
                className="whitespace-nowrap"
                style={{
                  fontSize: `${balanceValueFontSize}px`,
                  fontFamily: balanceValueFontFamily,
                  color: balanceValueColor,
                  paddingLeft: `${balanceValuePaddingLeft}px`,
                }}
              >
                {formatUsd(dollarValue, balanceValueDecimals)}
              </span>
            ) : null}
          </div>
          {index < rows.length - 1 ? <div className="h-[1px] bg-gray-700 w-full" /> : null}
        </React.Fragment>
      );
    });
  };
  const handleMaxClick = (panelId: number) => {
    const selectedToken = resolveWithdrawState(panelId).token;
    const hasSelectedToken = Boolean(selectedToken && selectedToken.trim());
    if (!hasSelectedToken) return;
    const normalizedToken = selectedToken.trim().toUpperCase();
    const chainKey = (walletPanels.find((panel) => panel.id === panelId)?.chainKey ?? 'ALL') as ChainKey | 'ALL';
    const chainKeyNormalized = chainKey === 'ALL' ? null : chainKey;
    const gasToken = chainKeyNormalized ? gasTokensByChain[chainKeyNormalized] ?? null : null;
    const reserve = chainKeyNormalized ? Number(gasReservesByChain[chainKeyNormalized] ?? 0) : 0;
    const balanceValue = resolveBalanceForSymbol(chainKey, normalizedToken);
    const balanceNumber = Number(balanceValue);
    const isGasToken = gasToken && normalizedToken === gasToken;
    const effective = isGasToken && Number.isFinite(balanceNumber)
      ? Math.max(0, balanceNumber - reserve)
      : balanceValue;
    updateWithdrawAmount(panelId, effective.toString());
  };

  const resolveTxUrl = (panelId: number, chainKey: ChainKey | 'ALL') => {
    const txHash = resolveWithdrawReceipt(panelId).txHash;
    if (!txHash) return '#';
    if (isSolanaChain(chainKey)) return `https://solscan.io/tx/${txHash}`;
    if (chainKey === 'ETH_MAINNET') return `https://etherscan.io/tx/${txHash}`;
    if (chainKey === 'ETH_SEPOLIA') return `https://sepolia.etherscan.io/tx/${txHash}`;
    if (chainKey === 'BASE_MAINNET') return `https://basescan.org/tx/${txHash}`;
    if (chainKey === 'BASE_SEPOLIA') return `https://sepolia.basescan.org/tx/${txHash}`;
    return '#';
  };

  const renderWalletPanel = (panel: { id: number; chainKey: ChainKey | 'ALL'; isChainOpen: boolean }) => (
    <WalletPanel
      panel={panel}
      walletWidth={walletWidth}
      closePaddingTop={closePaddingTop}
      closePaddingRight={closePaddingRight}
      closeSize={closeSize}
      closeFontFamily={closeFontFamily}
      titlePaddingTop={titlePaddingTop}
      titlePaddingBottom={titlePaddingBottom}
      containerPaddingLeft={containerPaddingLeft}
      containerPaddingRight={containerPaddingRight}
      titleFontSize={titleFontSize}
      titleFontFamily={titleFontFamily}
      titleChainIconSize={titleChainIconSize}
      titleChainIconBorderPosition={titleChainIconBorderPosition}
      titleChainIconBorderColor={titleChainIconBorderColor}
      titleChainIconBorderWidth={titleChainIconBorderWidth}
      titleChainIconPlaceholderColor={titleChainIconPlaceholderColor}
      titleChainIconPlaceholderFontColor={titleChainIconPlaceholderFontColor}
      titleChainIconPlaceholderFontSize={titleChainIconPlaceholderFontSize}
      titleChainIconSpinEnabled={titleChainIconSpinEnabled}
      chainDropdownFontSize={chainDropdownFontSize}
      chainDropdownWidth={chainDropdownWidth}
      chainDropdownItemColor={chainDropdownItemColor}
      chainDropdownItemHighlightColor={chainDropdownItemHighlightColor}
      chainIconSize={walletChainIconSize}
      chainIconBorderPosition={walletChainIconBorderPosition}
      chainIconBorderColor={walletChainIconBorderColor}
      chainIconBorderWidth={walletChainIconBorderWidth}
      chainIconPlaceholderColor={walletChainIconPlaceholderColor}
      chainIconPlaceholderFontColor={walletChainIconPlaceholderFontColor}
      chainIconPlaceholderFontSize={walletChainIconPlaceholderFontSize}
      chainIconSpinEnabled={walletChainIconSpinEnabled}
      resolveChainIconSrc={(chainKey) =>
        resolveChainIconSrcByConfig(chainKey, walletChainIconFileType, walletChainIconFileSize)
      }
      walletChainOptions={walletChainOptions}
      resolveWalletTitle={resolveWalletTitle}
      onToggleChainOpen={(panelId) => {
        setWalletPanels((current) =>
          current.map((entry) =>
            entry.id === panelId ? { ...entry, isChainOpen: !entry.isChainOpen } : entry,
          ),
        );
      }}
      onSelectChain={(panelId, chainKey) => {
        setWalletPanels((current) =>
          current.map((entry) =>
            entry.id === panelId
              ? { ...entry, chainKey, isChainOpen: false }
              : entry,
          ),
        );
        if (chainKey !== 'ALL') {
          void fetchBalancesForChain(chainKey, { forceRefresh: false, skipNetworkIfCached: true }, 'changeChain');
        }
      }}
      buttonHeight={buttonHeight}
      buttonPaddingX={buttonPaddingX}
      buttonFontSize={buttonFontSize}
      walletAddressButtonFontSize={walletAddressButtonFontSize}
      walletAddressButtonFontFamily={walletAddressButtonFontFamily}
      walletAddressButtonFontColor={walletAddressButtonFontColor}
      walletAddressLabelFontSize={walletAddressLabelFontSize}
      walletAddressLabelFontFamily={walletAddressLabelFontFamily}
      walletAddressLabelFontColor={walletAddressLabelFontColor}
      topRowButtonColor={topRowButtonColor}
      topRowButtonBorderColor={topRowButtonBorderColor}
      topRowButtonHighlightColor={topRowButtonHighlightColor}
      topRowButtonHighlightBorderColor={topRowButtonHighlightBorderColor}
      topRowButtonActiveColor={topRowButtonActiveColor}
      topRowButtonActiveBorderColor={topRowButtonActiveBorderColor}
      withdrawSymbolPaddingLeft={withdrawSymbolPaddingLeft}
      withdrawSymbolPaddingRight={withdrawSymbolPaddingRight}
      tokenDropdownWidth={tokenDropdownWidth}
      tokenDropdownFontSize={tokenDropdownFontSize}
      tokenDropdownFontFamily={tokenDropdownFontFamily}
      withdrawAmountInputPaddingLeft={withdrawAmountInputPaddingLeft}
      withdrawAmountInputPaddingRight={withdrawAmountInputPaddingRight}
      withdrawAmountInputFontSize={withdrawAmountInputFontSize}
      withdrawAmountInputColor={withdrawAmountInputColor}
      withdrawMaxFontSize={withdrawMaxFontSize}
      withdrawMaxColor={withdrawMaxColor}
      withdrawMaxHighlightColor={withdrawMaxHighlightColor}
      withdrawMaxInactiveColor={withdrawMaxInactiveColor}
      withdrawDollarValueFontSize={withdrawDollarValueFontSize}
      withdrawDollarValueFontFamily={withdrawDollarValueFontFamily}
      withdrawDollarValueColor={withdrawDollarValueColor}
      withdrawDollarValueWidth={withdrawDollarValueWidth}
      withdrawDollarValuePaddingLeft={withdrawDollarValuePaddingLeft}
      withdrawDollarValuePaddingRight={withdrawDollarValuePaddingRight}
      withdrawAddressInputPaddingLeft={withdrawAddressInputPaddingLeft}
      withdrawAddressInputPaddingRight={withdrawAddressInputPaddingRight}
      withdrawAddressInputFontSize={withdrawAddressInputFontSize}
      withdrawAddressInputColor={withdrawAddressInputColor}
      withdrawSubmitButtonConfig={withdrawSubmitButtonConfig}
      withdrawCancelButtonConfig={withdrawCancelButtonConfig}
      withdrawSubmitBorderWidth={withdrawSubmitBorderWidth}
      withdrawCancelBorderWidth={withdrawCancelBorderWidth}
      withdrawSubmitHighlightColor={withdrawSubmitHighlightColor}
      withdrawSubmitActiveColor={withdrawSubmitActiveColor}
      withdrawSubmitActiveBorderColor={withdrawSubmitActiveBorderColor}
      withdrawCancelHighlightColor={withdrawCancelHighlightColor}
      withdrawCancelActiveColor={withdrawCancelActiveColor}
      withdrawCancelActiveBorderColor={withdrawCancelActiveBorderColor}
      resolveTokenRows={resolveTokenRows}
      resolveWithdrawState={resolveWithdrawState}
      resolveWithdrawReceipt={resolveWithdrawReceipt}
      resolveWithdrawError={resolveWithdrawError}
      resolveWithdrawDots={resolveWithdrawDots}
      resolveTokenDropdownOpen={resolveTokenDropdownOpen}
      resolveTokenDropdownForceAll={resolveTokenDropdownForceAll}
      resolveWalletCopyActive={resolveWalletCopyActive}
      resolveWalletAddress={resolveWalletAddress}
      formatDisplayAddress={formatDisplayAddress}
      triggerWalletCopyState={triggerWalletCopyState}
      toggleWithdrawPanel={toggleWithdrawPanel}
      updateWithdrawToken={updateWithdrawToken}
      updateWithdrawAmount={updateWithdrawAmount}
      updateWithdrawAddress={updateWithdrawAddress}
      setTokenDropdownOpen={setTokenDropdownOpen}
      setTokenDropdownForceAll={setTokenDropdownForceAll}
      isMaxHovering={isMaxHovering}
      setIsMaxHovering={setIsMaxHovering}
      onMaxClick={handleMaxClick}
      resolveTxUrl={resolveTxUrl}
      getCryptoLink={WALLET_DISPLAY.getCrypto.link}
      onClose={() => {
        closeWalletPanel(panel.id, () => {
          setIsWalletPanelOpen(false);
        });
        setWithdrawPanels((prev) => {
          if (!prev[panel.id]) return prev;
          const { [panel.id]: _removed, ...rest } = prev;
          return rest;
        });
        setWithdrawReceipt((prev) => {
          if (!prev[panel.id]) return prev;
          const { [panel.id]: _removed, ...rest } = prev;
          return rest;
        });
        setWithdrawErrors((prev) => {
          if (!prev[panel.id]) return prev;
          const { [panel.id]: _removed, ...rest } = prev;
          return rest;
        });
        setTokenDropdownOpen((prev) => {
          if (!prev[panel.id]) return prev;
          const { [panel.id]: _removed, ...rest } = prev;
          return rest;
        });
        setTokenDropdownForceAll((prev) => {
          if (!prev[panel.id]) return prev;
          const { [panel.id]: _removed, ...rest } = prev;
          return rest;
        });
        setWalletAddressCopyState((prev) => {
          const key = `panel-${panel.id}`;
          if (!prev[key]) return prev;
          const { [key]: _removed, ...rest } = prev;
          return rest;
        });
      }}
      onSubmitWithdraw={() => {
        console.log('[UserMenu] "Submit Withdrawal" clicked');
        const state = resolveWithdrawState(panel.id);
        console.log('[UserMenu] "State resolved, state:', state);
        const token = state.token?.trim();
        console.log('[UserMenu] token (state.token):', state.token);
        const amount = state.amount?.trim();
        console.log('[UserMenu] amount (state.amount):', state.amount);
        const address = state.address?.trim();
        console.log('[UserMenu] address (state.address):', state.address);
        const chainKey = panel.chainKey as ChainKey;
        const tokenOptions = resolveTokenRows(chainKey);
        if (!token) {
          clearWithdrawReceipt(panel.id);
          setWithdrawErrors((prev) => ({ ...prev, [panel.id]: 'No token selected' }));
          return;
        }
        const normalizedToken = token.toUpperCase();
        if (!tokenOptions.includes(normalizedToken)) {
          clearWithdrawReceipt(panel.id);
          setWithdrawErrors((prev) => ({ ...prev, [panel.id]: 'Invalid token' }));
          return;
        }
        if (!amount) {
          clearWithdrawReceipt(panel.id);
          setWithdrawErrors((prev) => ({ ...prev, [panel.id]: 'No token amount' }));
          return;
        }
        const amountNumber = Number(amount);
        console.log('[UserMenu] amount:', amountNumber);
        if (!isValidWithdrawAmount(chainKey, token, amount)) {
          const tokenLabel = token.trim().toUpperCase() || 'TOKEN';
          clearWithdrawReceipt(panel.id);
          setWithdrawErrors((prev) => ({
            ...prev,
            [panel.id]: `Insufficient ${tokenLabel} in Wallet`,
          }));
          return;
        }
        const gasToken = gasTokensByChain[chainKey] ?? null;
        if (gasToken) {
          console.log('[UserMenu] gasToken', gasToken);
          const reserve = Number(gasReservesByChain[chainKey] ?? 0);
          console.log('[UserMenu] reserve', reserve);
          const gasBalanceValue = resolveBalanceForSymbol(chainKey, gasToken);
          console.log('[UserMenu] gasBalanceValue', gasBalanceValue);
          const gasBalanceNumber = Number(gasBalanceValue);
          console.log('[UserMenu] gasBalanceNumber', gasBalanceNumber);
          const gasEffective = Number.isFinite(gasBalanceNumber)
            ? Math.max(0, gasBalanceNumber - reserve)
            : Number.NaN;
          console.log('[UserMenu] gasEffective', gasEffective);
          const isGasToken = normalizedToken === gasToken;
          if (!Number.isFinite(gasEffective) || gasEffective <= 0) {
            clearWithdrawReceipt(panel.id);
            setWithdrawErrors((prev) => ({
              ...prev,
              [panel.id]: chainKey === 'SOLANA_MAINNET' || chainKey === 'SOLANA_DEVNET'
                ? 'Insufficient SOL to pay gas fee'
                : 'Insufficient ETH to pay gas fee',
            }));
            return;
          }
          if (isGasToken && amountNumber > gasEffective) {
            clearWithdrawReceipt(panel.id);
            setWithdrawErrors((prev) => ({
              ...prev,
              [panel.id]: chainKey === 'SOLANA_MAINNET' || chainKey === 'SOLANA_DEVNET'
                ? 'Insufficient SOL to pay gas fee'
                : 'Insufficient ETH to pay gas fee',
            }));
            return;
          }
        }
        if (!address) {
          clearWithdrawReceipt(panel.id);
          setWithdrawErrors((prev) => ({ ...prev, [panel.id]: 'No recipient address' }));
          return;
        }
        if (chainKey === 'SOLANA_MAINNET' || chainKey === 'SOLANA_DEVNET') {
          try {
            new PublicKey(address);
          } catch {
            clearWithdrawReceipt(panel.id);
            setWithdrawErrors((prev) => ({ ...prev, [panel.id]: 'Invalid recipient address' }));
            return;
          }
        } else if (!ethers.isAddress(address)) {
          clearWithdrawReceipt(panel.id);
          setWithdrawErrors((prev) => ({ ...prev, [panel.id]: 'Invalid recipient address' }));
          return;
        }
        if (panel.chainKey === 'ALL') return;
        console.log('[UserMenu] chainKey:', chainKey);
        setWithdrawErrors((prev) => {
          if (!prev[panel.id]) return prev;
          const { [panel.id]: _removed, ...rest } = prev;
          return rest;
        });
        setWithdrawReceipt((prev) => ({
          ...prev,
          [panel.id]: { active: true, status: 'submitted', txHash: null },
        }));
        setWithdrawSubmittedDots((prev) => ({ ...prev, [panel.id]: 0 }));
        const run = async () => {
          if (isSolanaChain(chainKey)) {
            const txHash = await executeSolanaTransfer(token, amount, address);
            setWithdrawReceipt((prev) => ({
              ...prev,
              [panel.id]: { active: true, status: 'executed', txHash },
            }));
            setWithdrawSubmittedDots((prev) => {
              if (!prev[panel.id]) return prev;
              const { [panel.id]: _removed, ...rest } = prev;
              return rest;
            });
            return;
          }
          const txHash = await sendEvmTransfer({ chainKey, recipient: address, tokenSymbol: token, amount });
          setWithdrawReceipt((prev) => ({
            ...prev,
            [panel.id]: { active: true, status: 'executed', txHash },
          }));
          setWithdrawSubmittedDots((prev) => {
            if (!prev[panel.id]) return prev;
            const { [panel.id]: _removed, ...rest } = prev;
            return rest;
          });
        };
        void run().catch((err) => {
          console.warn('[Withdraw] submit failed', err);
        });
      }}
      renderBalances={renderBalances}
    />
  );

  const renderAddPanel = () => (
    <AddPanel
      width={addPanelWidth}
      closePaddingTop={addPanelClosePaddingTop}
      closePaddingRight={addPanelClosePaddingRight}
      closeSize={addPanelCloseSize}
      closeFontFamily={addPanelCloseFontFamily}
      iconPaddingTop={addPanelIconPaddingTop}
      iconPaddingBottom={addPanelIconPaddingBottom}
      paddingLeft={addPanelPaddingLeft}
      paddingRight={addPanelPaddingRight}
      labelFontSize={addPanelLabelFontSize}
      labelFontFamily={addPanelLabelFontFamily}
      labelColor={addPanelLabelColor}
      iconContainerSize={addPanelIconContainerSize}
      iconBorderWidth={addPanelIconBorderWidth}
      iconSize={addPanelIconSize}
      iconButtons={addPanelIconButtons}
      chainDropdownFontSize={addPanelChainDropdownFontSize}
      chainDropdownWidth={addPanelChainDropdownWidth}
      chainDropdownFontName={addPanelChainDropdownFontName}
      chainDropdownFontColor={addPanelChainDropdownFontColor}
      chainDropdownAllCaps={addPanelChainDropdownAllCaps}
      chainDropdownLetterSpacing={addPanelChainDropdownLetterSpacing}
      chainDropdownItemColor={addPanelChainDropdownItemColor}
      chainDropdownItemHighlightColor={addPanelChainDropdownItemHighlightColor}
      chainDropdownItemHeight={addPanelChainDropdownItemHeight}
      chainIconSize={addPanelChainIconSize}
      chainIconBorderPosition={addPanelChainIconBorderPosition}
      chainIconBorderColor={addPanelChainIconBorderColor}
      chainIconBorderWidth={addPanelChainIconBorderWidth}
      chainIconPlaceholderColor={addPanelChainIconPlaceholderColor}
      chainIconPlaceholderFontColor={addPanelChainIconPlaceholderFontColor}
      chainIconPlaceholderFontSize={addPanelChainIconPlaceholderFontSize}
      chainIconSpinEnabled={addPanelChainIconSpinEnabled}
      resolveChainIconSrc={(chainKey) =>
        resolveChainIconSrcByConfig(chainKey, addPanelChainIconFileType, addPanelChainIconFileSize)
      }
      titlePaddingBottom={addPanelTitlePaddingBottom}
      isChainOpen={isAddPanelChainOpen}
      isIconHovered={isAddPanelIconHovered}
      addPanelChain={addPanelChain}
      walletPanels={walletPanels}
      walletChainOptions={walletChainOptions}
      onToggleChainOpen={() => setIsAddPanelChainOpen((current) => !current)}
      onHoverStart={() => setAddPanelIconHovered(true)}
      onHoverEnd={() => setAddPanelIconHovered(false)}
      onClose={() => setIsAddPanelOpen(false)}
      onSelectChain={(chainKey) => {
        setAddPanelChain(chainKey);
        setAddPanelHasCustomChain(true);
        setIsAddPanelChainOpen(false);
        addWalletPanel(chainKey);
        if (chainKey !== 'ALL') {
          void fetchBalancesForChain(chainKey, { forceRefresh: false, skipNetworkIfCached: true }, 'changeChain');
        }
      }}
    />
  );

  const resolveTxPanelTokenIconSrc = (symbol: string): string | null => {
    if (!symbol || !txInfoPanelTokenIconFileType || !txInfoPanelTokenIconFileSize) return null;
    return `/image/tokens/${txInfoPanelTokenIconFileType}/${txInfoPanelTokenIconFileSize}/${symbol}.${txInfoPanelTokenIconFileType}`;
  };

  const renderTransactionInfoPanel = (panel: import('../lib/usePanels').TransactionInfoPanelState) => (
    <TransactionInfoPanel
      panel={panel}
      panelType="transaction-sidepanel"
      width={txInfoPanelWidth}
      paddingLeft={txInfoPanelPaddingLeft}
      paddingRight={txInfoPanelPaddingRight}
      paddingTop={txInfoPanelPaddingTop}
      paddingBottom={txInfoPanelPaddingBottom}
      closePaddingTop={txInfoPanelClosePaddingTop}
      closePaddingRight={txInfoPanelClosePaddingRight}
      closeSize={txInfoPanelCloseSize}
      closeFontFamily={txInfoPanelCloseFontFamily}
      arrowColor={txInfoPanelArrowColor}
      arrowFontSize={txInfoPanelArrowFontSize}
      arrowFontFamily={txInfoPanelArrowFontFamily}
      leftAlignItems={txInfoPanelLeftAlignItems}
      rightAlignItems={txInfoPanelRightAlignItems}
      statusExecutingLabel={txInfoPanelStatusExecutingLabel}
      statusExecutedLabel={txInfoPanelStatusExecutedLabel}
      statusFontSize={txInfoPanelStatusFontSize}
      statusFontFamily={txInfoPanelStatusFontFamily}
      statusExecutingFontStyle={txInfoPanelStatusExecutingFontStyle}
      statusExecutedFontStyle={txInfoPanelStatusExecutedFontStyle}
      statusExecutingColor={txInfoPanelStatusExecutingColor}
      statusExecutedColor={txInfoPanelStatusExecutedColor}
      statusPaddingBottom={txInfoPanelStatusPaddingBottom}
      viewTransactionLabel={txInfoPanelViewTxLabel}
      viewTransactionFontSize={txInfoPanelViewTxFontSize}
      viewTransactionFontFamily={txInfoPanelViewTxFontFamily}
      viewTransactionColor={txInfoPanelViewTxColor}
      viewTransactionHighlightColor={txInfoPanelViewTxHighlightColor}
      viewTransactionPaddingTop={txInfoPanelViewTxPaddingTop}
      viewTransactionUnderline={txInfoPanelViewTxUnderline}
      resolveTransactionUrl={resolveTransactionExplorerUrl}
      chainNameFontSize={txInfoPanelChainNameFontSize}
      chainNameFontFamily={txInfoPanelChainNameFontFamily}
      chainNameColor={txInfoPanelChainNameColor}
      chainNameAllCaps={txInfoPanelChainNameAllCaps}
      chainNameLetterSpacing={txInfoPanelChainNameLetterSpacing}
      chainNamePaddingBottom={txInfoPanelChainNamePaddingBottom}
      tokenSymbolFontSize={txInfoPanelTokenSymbolFontSize}
      tokenSymbolFontFamily={txInfoPanelTokenSymbolFontFamily}
      tokenSymbolColor={txInfoPanelTokenSymbolColor}
      tokenSymbolPaddingTop={txInfoPanelTokenSymbolPaddingTop}
      tokenAmountFontSize={txInfoPanelTokenAmountFontSize}
      tokenAmountFontFamily={txInfoPanelTokenAmountFontFamily}
      tokenAmountColor={txInfoPanelTokenAmountColor}
      tokenAmountDecimals={txInfoPanelTokenAmountDecimals}
      tokenAmountPaddingTop={txInfoPanelTokenAmountPaddingTop}
      pendingLabel={txInfoPanelPendingLabel}
      pendingFontStyle={txInfoPanelPendingFontStyle}
      pendingColor={txInfoPanelPendingColor}
      tokenIconSize={txInfoPanelTokenIconSize}
      tokenIconBorderPosition={txInfoPanelTokenIconBorderPosition}
      tokenIconBorderColor={txInfoPanelTokenIconBorderColor}
      tokenIconBorderWidth={txInfoPanelTokenIconBorderWidth}
      tokenIconPlaceholderColor={txInfoPanelTokenIconPlaceholderColor}
      tokenIconPlaceholderFontColor={txInfoPanelTokenIconPlaceholderFontColor}
      tokenIconPlaceholderFontSize={txInfoPanelTokenIconPlaceholderFontSize}
      tokenIconSpinEnabled={txInfoPanelTokenIconSpinEnabled}
      resolveTokenIconSrc={resolveTxPanelTokenIconSrc}
      resolveChainLabel={resolveTransactionPanelChainLabel}
      formatAmount={formatTransactionInfoAmount}
      onClose={() => closeTransactionInfoPanel(panel.id)}
    />
  );

  if (!authenticated) return null;

  return (
    <div className="relative flex items-center gap-3" ref={menuRef}>
      {swapMessage && (
        <div
          className={`absolute right-0 top-12 z-[110] w-64 rounded-xl border px-4 py-3 text-xs shadow-2xl whitespace-pre-wrap break-words ${
            swapMessage.type === 'success'
              ? 'bg-emerald-900/90 border-emerald-700 text-emerald-100'
              : 'bg-red-900/90 border-red-700 text-red-100'
          }`}
        >
          {swapMessage.text}
        </div>
      )}
      

      {/* Network dropdown */}
      <div className="relative">
        <button
          onClick={() => {
            setIsNetworkOpen(!isNetworkOpen);
            setIsWalletOpen(false);
            setIsProfileOpen(false);
            setIsDevOpen(false);
          }}
          title="Switch Chain"
          className="flex items-center justify-center rounded-full border-[var(--border-color)] hover:border-[var(--highlight-color)] transition-all shadow-md cursor-pointer"
          style={{
            minWidth: `${MENU_ICONS.size * 4 * 1.6}px`,
            height: `${MENU_ICONS.size * 4 * 1.6}px`,
            paddingLeft: `${MENU_ICONS.size * 1.5}px`,
            paddingRight: `${MENU_ICONS.size * 2}px`,
            gap: `${MENU_ICONS.size}px`,
            backgroundColor: MENU_ICONS.container_color,
            borderColor: isNetworkOpen ? MENU_ICONS.highlight_color : undefined,
            borderWidth: `${MENU_ICONS.border_width}px`,
            boxSizing: 'content-box',
            ['--border-color' as never]: MENU_ICONS.border_color,
            ['--highlight-color' as never]: MENU_ICONS.highlight_color,
          }}
        >
          {activeNetworkMenuChainIconEnabled ? (
            <div
              className="relative flex items-center justify-center shrink-0"
              style={{
                width: `${activeNetworkMenuChainIconSize}px`,
                height: `${activeNetworkMenuChainIconSize}px`,
                borderRadius: '50%',
                backgroundColor: activeNetworkMenuChainIconPlaceholderColor,
                ...resolveIconBorderStyle(
                  activeNetworkMenuChainIconBorderPosition,
                  activeNetworkMenuChainIconBorderColor,
                  activeNetworkMenuChainIconBorderWidth
                ),
                overflow: 'hidden',
              }}
            >
              {(() => {
                const iconSrc = resolveActiveNetworkMenuChainIconSrc(selectedChain);
                if (!iconSrc) {
                  return (
                    <span
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: `${activeNetworkMenuChainIconPlaceholderFontSize}px`,
                        color: activeNetworkMenuChainIconPlaceholderFontColor,
                        userSelect: 'none',
                        pointerEvents: 'none',
                      }}
                    >
                      ?
                    </span>
                  );
                }

                return (
                  <>
                    {activeNetworkMenuChainIconSpinEnabled ? (
                      <SpinningLogo
                        src={iconSrc}
                        alt={selectedNetworkLabel}
                        width={activeNetworkMenuChainIconSize}
                        height={activeNetworkMenuChainIconSize}
                        className="absolute inset-0 h-full w-full object-contain"
                        onError={(e) => {
                          const img = e.currentTarget as HTMLImageElement;
                          img.style.display = 'none';
                          const fallback = img.nextSibling as HTMLElement | null;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : (
                      <Image
                        src={iconSrc}
                        alt={selectedNetworkLabel}
                        width={activeNetworkMenuChainIconSize}
                        height={activeNetworkMenuChainIconSize}
                        className="absolute inset-0 h-full w-full object-contain"
                        onError={(e) => {
                          const img = e.currentTarget as HTMLImageElement;
                          img.style.display = 'none';
                          const fallback = img.nextSibling as HTMLElement | null;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    )}
                    <span
                      style={{
                        display: 'none',
                        position: 'absolute',
                        inset: 0,
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: `${activeNetworkMenuChainIconPlaceholderFontSize}px`,
                        color: activeNetworkMenuChainIconPlaceholderFontColor,
                        userSelect: 'none',
                        pointerEvents: 'none',
                      }}
                    >
                      ?
                    </span>
                  </>
                );
              })()}
            </div>
          ) : (
            <Globe2
              className=""
              style={{ width: `${MENU_ICONS.size * 4}px`, height: `${MENU_ICONS.size * 4}px` }}
              color={MENU_ICONS.icon_color}
            />
          )}
          <span
            className="whitespace-nowrap leading-none"
            style={{
              fontSize: `${menuButtonTextFontSize}px`,
              fontFamily: menuButtonTextFontFamily,
              color: menuButtonTextFontColor,
            }}
          >
            {selectedNetworkLabel}
          </span>
        </button>
        {isNetworkOpen && (
          <div
            className="absolute right-0 mt-3 rounded-xl border border-gray-700 shadow-2xl z-[100] overflow-hidden flex flex-col"
            style={{
              width: `${ACTIVE_NETWORK_DROPDOWN.width}px`,
              backgroundColor: ACTIVE_NETWORK_DROPDOWN.itemColor,
            }}
          >
            {activeNetworkOptions.map(({ label, key }) => {
              const isSelected = key ? selectedChain === key : false;
              const iconSrc = resolveActiveNetworkChainIconSrc(key);
              const handleClick = () => {
                setSelectedChain(key);
                if (typeof window !== 'undefined') {
                  localStorage.setItem('selectedChain', key);
                }
                setIsNetworkOpen(false);
              };
              return (
                <button
                  key={label}
                  onClick={handleClick}
                  className="flex w-full items-center px-4 transition-colors text-left cursor-pointer"
                  style={{
                    height: `${ACTIVE_NETWORK_DROPDOWN.itemHeight}px`,
                    fontSize: `${ACTIVE_NETWORK_DROPDOWN.fontSize}px`,
                    fontFamily: ACTIVE_NETWORK_DROPDOWN.fontName,
                    color: ACTIVE_NETWORK_DROPDOWN.fontColor,
                    textTransform: ACTIVE_NETWORK_DROPDOWN.allCaps ? 'uppercase' : 'none',
                    letterSpacing: ACTIVE_NETWORK_DROPDOWN.letterSpacing,
                    backgroundColor: isSelected ? activeNetworkSelectedItemColor : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = ACTIVE_NETWORK_DROPDOWN.itemHighlightColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isSelected
                      ? activeNetworkSelectedItemColor
                      : 'transparent';
                  }}
                >
                  <div
                    className="mr-3 relative flex items-center justify-center shrink-0"
                    style={{
                      width: `${activeNetworkChainIconSize}px`,
                      height: `${activeNetworkChainIconSize}px`,
                      borderRadius: '50%',
                      backgroundColor: activeNetworkChainIconPlaceholderColor,
                      ...resolveIconBorderStyle(
                        activeNetworkChainIconBorderPosition,
                        isSelected && activeNetworkChainIconSelectedBorderEnabled
                          ? activeNetworkChainIconSelectedBorderColor
                          : activeNetworkChainIconBorderColor,
                        isSelected && activeNetworkChainIconSelectedBorderEnabled
                          ? activeNetworkChainIconSelectedBorderWidth
                          : activeNetworkChainIconBorderWidth
                      ),
                      overflow: 'hidden',
                    }}
                  >
                    {iconSrc ? (
                      <>
                        {activeNetworkChainIconSpinEnabled ? (
                          <SpinningLogo
                            src={iconSrc}
                            alt={label}
                            width={activeNetworkChainIconSize}
                            height={activeNetworkChainIconSize}
                            className="absolute inset-0 h-full w-full object-contain"
                            onError={(e) => {
                              const img = e.currentTarget as HTMLImageElement;
                              img.style.display = 'none';
                              const fallback = img.nextSibling as HTMLElement | null;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                        ) : (
                          <Image
                            src={iconSrc}
                            alt={label}
                            width={activeNetworkChainIconSize}
                            height={activeNetworkChainIconSize}
                            className="absolute inset-0 h-full w-full object-contain"
                            onError={(e) => {
                              const img = e.currentTarget as HTMLImageElement;
                              img.style.display = 'none';
                              const fallback = img.nextSibling as HTMLElement | null;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                        )}
                        <span
                          style={{
                            display: 'none',
                            position: 'absolute',
                            inset: 0,
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: `${activeNetworkChainIconPlaceholderFontSize}px`,
                            color: activeNetworkChainIconPlaceholderFontColor,
                            userSelect: 'none',
                            pointerEvents: 'none',
                          }}
                        >
                          ?
                        </span>
                      </>
                    ) : (
                      <span
                        style={{
                          position: 'absolute',
                          inset: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: `${activeNetworkChainIconPlaceholderFontSize}px`,
                          color: activeNetworkChainIconPlaceholderFontColor,
                          userSelect: 'none',
                          pointerEvents: 'none',
                        }}
                      >
                        ?
                      </span>
                    )}
                    {isSelected && activeNetworkChainIconSelectedPlaceholder ? (
                      <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <Check
                          style={{
                            width: `${activeNetworkChainIconPlaceholderFontSize}px`,
                            height: `${activeNetworkChainIconPlaceholderFontSize}px`,
                            color: activeNetworkChainIconPlaceholderFontColor,
                          }}
                        />
                      </span>
                    ) : null}
                  </div>
                  <span className="flex-1">{label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Wallet dropdown */}
      <div className="relative">
        <button
          onClick={() => {
            if (isWalletDropDown) {
              setIsWalletOpen((current) => {
                const next = !current;
                if (next) {
                  setWalletDropdownChain(selectedChain);
                  setWalletDropdownHasCustomChain(false);
                }
                return next;
              });
              setIsWalletDropdownChainOpen(false);
            }
            if (isWalletPanel) {
              setIsWalletPanelOpen((current) => {
                const next = !current;
                if (next) {
                  initWalletPanels();
                  void fetchBalancesForChain(selectedChain, { forceRefresh: false, skipNetworkIfCached: true }, 'openWallet');
                } else {
                  setWalletPanels((existing) => (existing.length === 1 ? [] : existing));
                }
                return next;
              });
              setIsAddPanelChainOpen(false);
            }
            setIsProfileOpen(false);
            setIsDevOpen(false);
            setIsNetworkOpen(false);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new Event('altair:wallet-open'));
            }
          }}
          title="Wallet"
          className="flex items-center justify-center rounded-full border-[var(--border-color)] hover:border-[var(--highlight-color)] transition-all shadow-md cursor-pointer"
          style={{
            width: `${MENU_ICONS.size * 4 * 1.6}px`,
            height: `${MENU_ICONS.size * 4 * 1.6}px`,
            borderColor:
              (isWalletDropDown && isWalletOpen) || (isWalletPanel && isWalletPanelOpen)
                ? MENU_ICONS.highlight_color
                : undefined,
            backgroundColor: MENU_ICONS.container_color,
            borderWidth: `${MENU_ICONS.border_width}px`,
            boxSizing: 'content-box',
            ['--border-color' as never]: MENU_ICONS.border_color,
            ['--highlight-color' as never]: MENU_ICONS.highlight_color,
          }}
        >
          <Wallet
            className=""
            style={{ width: `${MENU_ICONS.size * 4}px`, height: `${MENU_ICONS.size * 4}px` }}
            color={MENU_ICONS.icon_color}
          />
        </button>
            {isWalletDropDown && isWalletOpen && (
          <div
            className="absolute right-0 mt-3 rounded-xl bg-gray-900 border border-gray-700 shadow-2xl z-[100] overflow-visible flex flex-col"
            style={{ width: `${walletWidth}px` }}
          >
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsWalletDropdownChainOpen((current) => !current)}
                className="group grid w-full grid-cols-[16px_1fr_16px] items-center text-center cursor-pointer"
                style={{
                  paddingTop: `${titlePaddingTop}px`,
                  paddingBottom: `${titlePaddingBottom}px`,
                  paddingLeft: `${containerPaddingLeft}px`,
                  paddingRight: `${containerPaddingRight}px`,
                }}
              >
                <span aria-hidden="true" />
                <span
                  className="uppercase tracking-[0.3em] text-gray-400 group-hover:text-gray-200"
                  style={{ fontSize: `${titleFontSize}px`, fontFamily: titleFontFamily }}
                >
                  {resolveWalletTitle(walletDropdownChain)}
                </span>
              </button>
              {isWalletDropdownChainOpen && (
                <div
                  className="absolute left-1/2 top-full z-[120] -translate-x-1/2 rounded-xl border border-gray-500 shadow-2xl"
                  style={{
                    fontSize: `${chainDropdownFontSize}px`,
                    fontFamily: titleFontFamily,
                    marginTop: `${titlePaddingBottom}px`,
                    width: `${chainDropdownWidth}px`,
                    backgroundColor: chainDropdownItemColor,
                  }}
                >
                  {walletChainOptions.filter((option) => option.key !== walletDropdownChain).map((option) => {
                    const isSelected = walletDropdownChain === option.key;
                    const chainIconSrc = resolveChainIconSrcByConfig(
                      option.key,
                      walletChainIconFileType,
                      walletChainIconFileSize
                    );
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => {
                          setWalletDropdownChain(option.key);
                          setWalletDropdownHasCustomChain(true);
                          setIsWalletDropdownChainOpen(false);
                        }}
                        className="flex w-full items-center uppercase tracking-[0.3em] text-gray-300 transition-colors"
                        onMouseEnter={(event) => {
                          event.currentTarget.style.backgroundColor = chainDropdownItemHighlightColor;
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        style={{
                          paddingLeft: `${containerPaddingLeft}px`,
                          paddingRight: `${containerPaddingRight}px`,
                          paddingTop: '8px',
                          paddingBottom: '8px',
                          backgroundColor: 'transparent',
                        }}
                      >
                        <div
                          className="mr-2 relative flex items-center justify-center shrink-0"
                          style={{
                            width: `${walletChainIconSize}px`,
                            height: `${walletChainIconSize}px`,
                            borderRadius: '50%',
                            backgroundColor: walletChainIconPlaceholderColor,
                            ...resolveIconBorderStyle(
                              walletChainIconBorderPosition,
                              walletChainIconBorderColor,
                              walletChainIconBorderWidth
                            ),
                            overflow: 'hidden',
                          }}
                        >
                          {chainIconSrc ? (
                            <>
                              {walletChainIconSpinEnabled ? (
                                <SpinningLogo
                                  src={chainIconSrc}
                                  alt={option.label}
                                  width={walletChainIconSize}
                                  height={walletChainIconSize}
                                  className="absolute inset-0 h-full w-full object-contain"
                                  onError={(e) => {
                                    const img = e.currentTarget as HTMLImageElement;
                                    img.style.display = 'none';
                                    const fallback = img.nextSibling as HTMLElement | null;
                                    if (fallback) fallback.style.display = 'flex';
                                  }}
                                />
                              ) : (
                                <Image
                                  src={chainIconSrc}
                                  alt={option.label}
                                  width={walletChainIconSize}
                                  height={walletChainIconSize}
                                  className="absolute inset-0 h-full w-full object-contain"
                                  onError={(e) => {
                                    const img = e.currentTarget as HTMLImageElement;
                                    img.style.display = 'none';
                                    const fallback = img.nextSibling as HTMLElement | null;
                                    if (fallback) fallback.style.display = 'flex';
                                  }}
                                />
                              )}
                              <span
                                style={{
                                  display: 'none',
                                  position: 'absolute',
                                  inset: 0,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: `${walletChainIconPlaceholderFontSize}px`,
                                  color: walletChainIconPlaceholderFontColor,
                                  userSelect: 'none',
                                  pointerEvents: 'none',
                                }}
                              >
                                ?
                              </span>
                            </>
                          ) : (
                            <span
                              style={{
                                position: 'absolute',
                                inset: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: `${walletChainIconPlaceholderFontSize}px`,
                                color: walletChainIconPlaceholderFontColor,
                                userSelect: 'none',
                                pointerEvents: 'none',
                              }}
                            >
                              ?
                            </span>
                          )}
                          {isSelected ? (
                            <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <Check className="w-4 h-4 text-white" />
                            </span>
                          ) : null}
                        </div>
                        <span className="flex-1 text-left">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div
              className="flex w-full items-center justify-center gap-2 py-1.5 text-sm text-gray-300"
              style={{
                paddingLeft: `${containerPaddingLeft}px`,
                paddingRight: `${containerPaddingRight}px`,
              }}
            >
              <button
                type="button"
                className="flex items-center justify-center rounded-lg border border-gray-700 bg-gray-800/60 text-gray-100 hover:border-gray-500 hover:bg-gray-800 transition-colors cursor-pointer"
                style={{
                  height: `${buttonHeight}px`,
                  paddingLeft: `${buttonPaddingX}px`,
                  paddingRight: `${buttonPaddingX}px`,
                  fontSize: `${buttonFontSize}px`,
                }}
              >
                Withdraw
              </button>
              <a
                href={WALLET_DISPLAY.getCrypto.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center rounded-lg border border-gray-700 bg-gray-800/60 text-gray-100 hover:border-gray-500 hover:bg-gray-800 transition-colors cursor-pointer no-underline"
                style={{
                  height: `${buttonHeight}px`,
                  paddingLeft: `${buttonPaddingX}px`,
                  paddingRight: `${buttonPaddingX}px`,
                  fontSize: `${buttonFontSize}px`,
                  textDecoration: 'none',
                }}
              >
                Get Crypto
              </a>
            </div>
            <div className="h-[1px] bg-gray-700 w-full" />
            <div
              className="flex w-full items-center gap-2 py-1.5 text-sm text-gray-300"
              style={{
                paddingLeft: `${containerPaddingLeft}px`,
                paddingRight: `${containerPaddingRight}px`,
              }}
            >
              <span
                className="whitespace-nowrap"
                style={{
                  fontSize: `${walletAddressLabelFontSize}px`,
                  fontFamily: walletAddressLabelFontFamily,
                  color: walletAddressLabelFontColor,
                }}
              >
                Wallet Address:
              </span>
              <button
                type="button"
                onClick={() => {
                  const address = resolveWalletAddress(walletDropdownChain);
                  if (address) navigator.clipboard?.writeText(address).catch(() => {});
                }}
                title={resolveWalletAddress(walletDropdownChain) || 'Unknown'}
                className="flex flex-1 min-w-0 items-center justify-center rounded-lg border border-gray-700 bg-gray-800/60 leading-none hover:border-gray-500 hover:bg-gray-800 transition-colors cursor-pointer overflow-hidden"
                style={{
                  height: `${buttonHeight}px`,
                  paddingLeft: `${buttonPaddingX / 2}px`,
                  paddingRight: `${buttonPaddingX / 2}px`,
                  fontSize: `${walletAddressButtonFontSize}px`,
                  fontFamily: walletAddressButtonFontFamily,
                  color: walletAddressButtonFontColor,
                }}
              >
                <span
                  className="flex h-full items-center text-right leading-none relative top-[1px] truncate"
                  style={{
                    fontSize: `${walletAddressButtonFontSize}px`,
                    fontFamily: walletAddressButtonFontFamily,
                    color: walletAddressButtonFontColor,
                  }}
                  title={resolveWalletAddress(walletDropdownChain) || 'Unknown'}
                >
                  {formatDisplayAddress(resolveWalletAddress(walletDropdownChain))}
                </span>
                <span className="flex w-4 justify-start ml-2">
                  <Copy className="w-4 h-4 inline-flex" />
                </span>
              </button>
            </div>
            <div className="h-[1px] bg-gray-700 w-full" />
            {renderBalances(walletDropdownChain)}
          </div>
        )}
      </div>

      {isWalletPanel && (isWalletPanelOpen || (txInfoPanelShowInSidePanel && transactionInfoPanels.length > 0)) && (
        <div className="absolute right-0 top-full mt-3 z-[90] flex flex-col gap-3">
          {isWalletPanelOpen && walletPanels.map((panel) => (
            <React.Fragment key={panel.id}>
              {renderWalletPanel(panel)}
            </React.Fragment>
          ))}
          {txInfoPanelShowInSidePanel && transactionInfoPanels.map((panel) => (
            <React.Fragment key={`tx-${panel.id}`}>
              {renderTransactionInfoPanel(panel)}
            </React.Fragment>
          ))}
          {isWalletPanelOpen && isAddPanelOpen ? renderAddPanel() : null}
        </div>
      )}

      {/* Profile dropdown */}
      <div className="relative">
        <button
          onClick={() => {
            setIsProfileOpen(!isProfileOpen);
            setIsWalletOpen(false);
          }}
          title="Profile"
          className="flex items-center justify-center rounded-full border-[var(--border-color)] hover:border-[var(--highlight-color)] transition-all shadow-md cursor-pointer"
          style={{
            width: `${MENU_ICONS.size * 4 * 1.6}px`,
            height: `${MENU_ICONS.size * 4 * 1.6}px`,
            backgroundColor: MENU_ICONS.container_color,
            borderColor: isProfileOpen ? MENU_ICONS.highlight_color : undefined,
            borderWidth: `${MENU_ICONS.border_width}px`,
            boxSizing: 'content-box',
            ['--border-color' as never]: MENU_ICONS.border_color,
            ['--highlight-color' as never]: MENU_ICONS.highlight_color,
          }}
        >
          <UserRound
            className=""
            style={{ width: `${MENU_ICONS.size * 4}px`, height: `${MENU_ICONS.size * 4}px` }}
            color={MENU_ICONS.icon_color}
          />
        </button>

        {isProfileOpen && (
          // right-0 ensures the menu grows to the left, staying on screen
          <div className="absolute right-0 mt-3 w-48 rounded-xl bg-gray-900 border border-gray-700 shadow-2xl z-[100] overflow-hidden flex flex-col">
            <button
              onClick={() => { alert('Coming soon!'); setIsProfileOpen(false); }}
              className="flex w-full items-center px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors text-left"
            >
              <Settings className="w-4 h-4 mr-3" />
              <span className="flex-1">Edit Profile</span>
            </button>
            
            <div className="h-[1px] bg-gray-700 w-full" />
            
            <button
              onClick={() => {
                clearBalanceCaches();
                logout();
                setIsProfileOpen(false);
              }}
              className="flex w-full items-center px-4 py-3 text-sm text-red-400 hover:bg-gray-800 transition-colors text-left"
            >
              <LogOut className="w-4 h-4 mr-3" />
              <span className="flex-1">Log Out</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
