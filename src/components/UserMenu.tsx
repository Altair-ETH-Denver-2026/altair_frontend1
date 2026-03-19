'use client';

import React, { useState, useRef, useEffect } from 'react';
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
import { useEffect as useClientEffect } from 'react';
import { BLOCKCHAIN, CHAINS, GAS_RESERVES, GAS_TOKENS, FORCE_QUERY_CHAINS, type ChainKey } from '../../config/blockchain_config';
import { BASE_MAINNET, BASE_SEPOLIA, ETH_MAINNET, ETH_SEPOLIA, SOLANA_MAINNET, resolveRpcUrls } from '../../config/chain_info';
import * as BaseTokens from '../../config/token_info/base_tokens';
import * as BaseSepoliaTokens from '../../config/token_info/base_testnet_sepolia_tokens';
import * as EthTokens from '../../config/token_info/eth_tokens';
import * as EthSepoliaTokens from '../../config/token_info/eth_sepolia_testnet_tokens';
import * as SolanaTokens from '../../config/token_info/solana_tokens';
import type { ApiChainBalances, ApiTokenBalance } from '../../config/balance_types';
import { normalizeBalancesResponse, resolveTokenRowsForChain } from '../lib/balanceTransforms';
import { ADD_PANEL_DISPLAY, BALANCE_DECIMALS, MENU_ICONS, WALLET_CHAIN_LABELS, WALLET_CHAIN_OPTIONS, WALLET_DISPLAY } from '../../config/ui_config';

export default function UserMenu() {
  const { logout, authenticated, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { wallets: solanaWallets } = useSolanaWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const cachedEvmKey = 'cached:evmAddress';
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
  const balanceOverrideRef = useRef<Record<string, { value: string; expiresAt: number }>>({});
  const executeSwap = useSwap(selectedChain);
  const executeSolanaSwap = useSolanaSwap(selectedChain);
  const executeSolanaTransfer = useSolanaTransfer(selectedChain);
  const menuRef = useRef<HTMLDivElement>(null);
  const isWalletDropDown = WALLET_DISPLAY.active === 'drop_down';
  const isWalletPanel = WALLET_DISPLAY.active === 'panel';
  const chainLabels: Record<ChainKey, string> = WALLET_CHAIN_LABELS;
  const solanaDisplayAddress = solanaAddress || solanaWallets[0]?.address || '';
  const displayAddress = selectedChain === 'SOLANA_MAINNET' ? solanaDisplayAddress : evmAddress;
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
  const tokenRowPaddingTop = tokenRowConfig.paddingTop * buttonSize;
  const tokenRowPaddingBottom = tokenRowConfig.paddingBottom * buttonSize;
  const tokenSymbolFontSize = tokenSymbolsConfig.fontSize * buttonSize;
  const tokenSymbolFontFamily = tokenSymbolsConfig.fontName;
  const tokenSymbolColor = tokenSymbolsConfig.color;
  const tokenBalanceFontSize = tokenBalancesConfig.fontSize * buttonSize;
  const tokenBalanceFontFamily = tokenBalancesConfig.fontName;
  const tokenBalanceColor = tokenBalancesConfig.color;
  const tokenBalanceDecimals = tokenBalancesConfig.decimals;
  const walletWidth = WALLET_DISPLAY.width;
  const titleConfig = WALLET_DISPLAY.title;
  const titlePaddingTop = titleConfig.paddingTop * buttonSize;
  const titlePaddingBottom = titleConfig.paddingBottom * buttonSize;
  const titleFontSize = titleConfig.fontSize * buttonSize;
  const titleFontFamily = titleConfig.fontName;
  const closeConfig = WALLET_DISPLAY.x;
  const closePaddingTop = closeConfig.paddingTop * buttonSize;
  const closePaddingRight = closeConfig.paddingRight * buttonSize;
  const closeSize = closeConfig.size * buttonSize;
  const closeFontFamily = closeConfig.fontName;
  const chainDropdownConfig = WALLET_DISPLAY.chainDropdown;
  const chainDropdownWidth = chainDropdownConfig.width * buttonSize;
  const chainDropdownFontSize = chainDropdownConfig.fontSize * buttonSize;
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
  const menuButtonTextConfig = MENU_ICONS.buttonText ?? { fontSize: 13, fontName: 'sans-serif', fontColor: '#f3f4f6' };
  const menuButtonTextFontSize = Number(menuButtonTextConfig.fontSize ?? 13);
  const menuButtonTextFontFamily = menuButtonTextConfig.fontName ?? 'sans-serif';
  const menuButtonTextFontColor = menuButtonTextConfig.fontColor ?? '#f3f4f6';
  const networkOptions: ReadonlyArray<{ label: string; key: ChainKey }> = [
    { label: 'ETH Mainnet', key: 'ETH_MAINNET' },
    { label: 'Sepolia Testnet', key: 'ETH_SEPOLIA' },
    { label: 'Base Mainnet', key: 'BASE_MAINNET' },
    { label: 'Base Testnet', key: 'BASE_SEPOLIA' },
    { label: 'Solana Mainnet', key: 'SOLANA_MAINNET' },
  ];
  const selectedNetworkLabel = networkOptions.find((option) => option.key === selectedChain)?.label ?? 'Network';
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
  const formatDisplayAddress = (address: string) => {
    if (!address) return '—';
    const isEvm = address.startsWith('0x');
    const head = isEvm ? 6 : 4;
    return `${address.slice(0, head)}...${address.slice(-4)}`;
  };
  const balanceCacheTtlMs = 30_000;
  const inFlightBalanceKey = useRef<string | null>(null);

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
      const nextTokens: Record<string, ApiTokenBalance> = {
        ...(existing.tokens ?? {}),
        ...(snapshot.tokens ?? {}),
      };

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

      return {
        ...prev,
        [chainKey]: merged,
      };
    });
  };

  const loadCachedBalances = (cacheKey: string, chainKey: ChainKey, solanaAddressValue?: string | null) => {
    if (typeof window === 'undefined') return false;
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return false;
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
      if (!cached?.timestamp || !cached.tokens) return false;
      
      // Check if cache is marked as stale (e.g., from swap completion)
      const isStale = cached.source === 'stale';
      if (isStale) return false;
      
      // No TTL check - cache persists indefinitely
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
      return true;
    } catch {
      return false;
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
    { forceRefresh, skipNetworkIfCached = false }: { forceRefresh: boolean; skipNetworkIfCached?: boolean }
  ) => {
    if (!authenticated) return;

    let token: string | null = null;
    try {
      token = await getCachedPrivyAccessToken(getAccessToken);
    } catch {
      token = null;
    }
    const cachedAddress = typeof window !== 'undefined' ? localStorage.getItem(cachedEvmKey) : null;
    const cachedSolana = typeof window !== 'undefined' ? localStorage.getItem(cachedSolKey) : null;
    const solanaAddressValue = chainKey === 'SOLANA_MAINNET'
      ? solanaWallets[0]?.address ?? cachedSolana ?? null
      : null;

    if (chainKey === 'SOLANA_MAINNET') {
      if (!solanaAddressValue) return;
    } else if (!token && !cachedAddress) {
      return;
    }

    const cacheKey = `cached:balances:${chainKey}:${chainKey === 'SOLANA_MAINNET' ? solanaAddressValue : cachedAddress ?? 'unknown'}`;
    
    // Step 1: Always try to load cached balances for immediate UI display
    let cacheHit = false;
    if (!forceRefresh) {
      cacheHit = loadCachedBalances(cacheKey, chainKey, solanaAddressValue);
      if (cacheHit && skipNetworkIfCached) {
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
              walletAddress: chainKey === 'SOLANA_MAINNET' ? solanaAddressValue ?? undefined : cachedAddress ?? undefined,
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
    } catch {
      setBalancesByChain((prev) => ({
        ...prev,
        [chainKey]: {
          ...(prev[chainKey] ?? {}),
          tokens: {},
        },
      }));
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
          expiresAt: Date.now() + 25_000,
        };
        const bucket = (snapshotByChain[chainKey] ??= { tokens: {} });
        bucket.tokens[symbol] = {
          symbol,
          balance: human,
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
    }: {
      forceRefresh: boolean;
      chainKey: ChainKey;
      skipNetworkIfCached?: boolean;
    }) => {
      if (!authenticated) {
        setEvmAddress('');
        setSolanaAddress('');
        setBalancesByChain({} as Record<ChainKey, ApiChainBalances>);
        setIsWalletPanelOpen(false);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(cachedEvmKey);
          localStorage.removeItem(cachedSolKey);
        }
        return;
      }

      await fetchBalancesForChain(chainKey, { forceRefresh, skipNetworkIfCached });
    };

    const preloadAllChainsOnLogin = async () => {
      const chainKeys = Object.keys(CHAINS) as ChainKey[];
      await Promise.all(
        chainKeys.map(async (chainKey) => {
          await run({ forceRefresh: false, chainKey });
        })
      );
    };

    // Login/refresh preload across all chains so every token in Mongo-backed balances is cached client-side.
    void preloadAllChainsOnLogin();

    const handleWalletOpen = () => {
      // Wallet-open should render from cache; only hit API when cache entry is missing.
      void run({ forceRefresh: false, chainKey: selectedChain, skipNetworkIfCached: true });
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
          if (chainKey === 'SOLANA_MAINNET') {
            const solanaAddress = solanaWallets[0]?.address ??
              (typeof window !== 'undefined' ? localStorage.getItem(cachedSolKey) : null);
            if (solanaAddress) {
              markCacheAsStale(chainKey, solanaAddress);
            }
          } else {
            const evmAddress = typeof window !== 'undefined' ? localStorage.getItem(cachedEvmKey) : null;
            if (evmAddress) {
              markCacheAsStale(chainKey, evmAddress);
            }
          }
        });
      }

      if (detail?.chain && detail.chain !== selectedChain) return;
      void run({ forceRefresh: true, chainKey: selectedChain });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('altair:swap-complete', handleSwapComplete);
    }

    return () => {
      controller.abort();
      if (typeof window !== 'undefined') {
        window.removeEventListener('altair:swap-complete', handleSwapComplete);
        window.removeEventListener('altair:wallet-open', handleWalletOpen);
      }
    };
  }, [authenticated, selectedChain, wallets, solanaWallets]);

  if (!authenticated) return null;

  const showSwapMessage = (message: { type: 'success' | 'error'; text: string }) => {
    setSwapMessage(message);
    window.setTimeout(() => {
      setSwapMessage((current) => (current === message ? null : current));
    }, 6000);
  };

  const walletChainOptions = WALLET_CHAIN_OPTIONS;
  const resolveWalletTitle = (chainKey: ChainKey | 'ALL') => {
    if (chainKey === 'ALL') return 'ALL CHAINS ▼';
    if (chainKey === 'ETH_SEPOLIA' || chainKey === 'BASE_SEPOLIA') {
      return `${chainLabels[chainKey].toUpperCase()} ▼`;
    }
    return `${chainLabels[chainKey].toUpperCase()} WALLET ▼`;
  };
  const resolveWalletAddress = (chainKey: ChainKey | 'ALL') => {
    if (chainKey === 'ALL') return '';
    const snapshot = balancesByChain[chainKey as ChainKey];
    if (chainKey === 'SOLANA_MAINNET') return snapshot?.solanaAddress ?? solanaDisplayAddress;
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
    };
    return tokenConfigs[chainKey];
  };
  const isSolanaChain = (chainKey: ChainKey | 'ALL') => chainKey === 'SOLANA_MAINNET';
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
    const gasToken = GAS_TOKENS[params.chainKey];
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
    if (chainKey === 'SOLANA_MAINNET') {
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
  const renderBalances = (chainKey: ChainKey | 'ALL') => {
    const rows = resolveTokenRows(chainKey);
    return rows.map((symbol, index) => {
      const balanceValue = resolveBalanceForSymbol(chainKey, symbol);
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
            <span
              className="flex-1"
              style={{
                fontSize: `${tokenSymbolFontSize}px`,
                fontFamily: tokenSymbolFontFamily,
                color: tokenSymbolColor,
              }}
            >
              {symbol}
            </span>
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
    const gasToken = chainKeyNormalized ? GAS_TOKENS[chainKeyNormalized] : null;
    const reserve = chainKeyNormalized ? Number(GAS_RESERVES[chainKeyNormalized] ?? 0) : 0;
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
      chainDropdownFontSize={chainDropdownFontSize}
      chainDropdownWidth={chainDropdownWidth}
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
          void fetchBalancesForChain(chainKey, { forceRefresh: false, skipNetworkIfCached: true });
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
        const gasToken = GAS_TOKENS[chainKey] ?? null;
        if (gasToken) {
          console.log('[UserMenu] gasToken', gasToken);
          const reserve = Number(GAS_RESERVES[chainKey] ?? 0);
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
              [panel.id]: chainKey === 'SOLANA_MAINNET'
                ? 'Insufficient SOL to pay gas fee'
                : 'Insufficient ETH to pay gas fee',
            }));
            return;
          }
          if (isGasToken && amountNumber > gasEffective) {
            clearWithdrawReceipt(panel.id);
            setWithdrawErrors((prev) => ({
              ...prev,
              [panel.id]: chainKey === 'SOLANA_MAINNET'
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
        if (chainKey === 'SOLANA_MAINNET') {
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
          void fetchBalancesForChain(chainKey, { forceRefresh: false, skipNetworkIfCached: true });
        }
      }}
    />
  );

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
          <Globe2
            className=""
            style={{ width: `${MENU_ICONS.size * 4}px`, height: `${MENU_ICONS.size * 4}px` }}
            color={MENU_ICONS.icon_color}
          />
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
          <div className="absolute right-0 mt-3 w-48 rounded-xl bg-gray-900 border border-gray-700 shadow-2xl z-[100] overflow-hidden flex flex-col">
            {networkOptions.map(({ label, key }) => {
              const isSelected = key ? selectedChain === key : false;
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
                  className="flex w-full items-center px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors text-left cursor-pointer"
                >
                  <span className="mr-3 w-4 flex justify-center">{isSelected ? <Check className="w-4 h-4 text-white" /> : null}</span>
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
                  void fetchBalancesForChain(selectedChain, { forceRefresh: false, skipNetworkIfCached: true });
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
                  className="absolute left-1/2 top-full z-[120] -translate-x-1/2 rounded-xl border border-gray-500 bg-gray-900 shadow-2xl"
                  style={{
                    fontSize: `${chainDropdownFontSize}px`,
                    fontFamily: titleFontFamily,
                    marginTop: `${titlePaddingBottom}px`,
                    width: `${chainDropdownWidth}px`,
                  }}
                >
                  {walletChainOptions.filter((option) => option.key !== walletDropdownChain).map((option) => {
                    const isSelected = walletDropdownChain === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => {
                          setWalletDropdownChain(option.key);
                          setWalletDropdownHasCustomChain(true);
                          setIsWalletDropdownChainOpen(false);
                        }}
                        className="flex w-full items-center uppercase tracking-[0.3em] text-gray-300 hover:bg-gray-800 transition-colors"
                        style={{
                          paddingLeft: `${containerPaddingLeft}px`,
                          paddingRight: `${containerPaddingRight}px`,
                          paddingTop: '8px',
                          paddingBottom: '8px',
                        }}
                      >
                        <span className="mr-2 w-4 flex justify-center">
                          {isSelected ? <Check className="w-4 h-4 text-white" /> : null}
                        </span>
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
                Get Crypto
              </button>
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

      {isWalletPanel && isWalletPanelOpen && (
        <div className="absolute right-0 top-full mt-3 z-[90] flex flex-col gap-3">
          {walletPanels.map((panel) => (
            <React.Fragment key={panel.id}>
              {renderWalletPanel(panel)}
            </React.Fragment>
          ))}
          {isAddPanelOpen ? renderAddPanel() : null}
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
