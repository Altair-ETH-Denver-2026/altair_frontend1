'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ethers } from 'ethers';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets, useSignAndSendTransaction } from '@privy-io/react-auth/solana';
import { useSwap } from '../lib/useSwap';
import { useSolanaSwap } from '../lib/useSolanaSwap';
import { withWaitLogger } from '../lib/waitLogger';
import { UserRound, LogOut, Settings, Wallet, Wrench, Copy, Globe2, Check } from 'lucide-react';
import { useEffect as useClientEffect, useState as useClientState } from 'react';
import { BLOCKCHAIN, CHAINS, GAS_RESERVES, GAS_TOKENS, type ChainKey } from '../../config/blockchain_config';
import { BASE_MAINNET, BASE_SEPOLIA, ETH_MAINNET, ETH_SEPOLIA, SOLANA_MAINNET, resolveRpcUrls } from '../../config/chain_info';
import * as BaseTokens from '../../config/token_info/base_tokens';
import * as BaseSepoliaTokens from '../../config/token_info/base_testnet_sepolia_tokens';
import * as EthTokens from '../../config/token_info/eth_tokens';
import * as EthSepoliaTokens from '../../config/token_info/eth_sepolia_testnet_tokens';
import * as SolanaTokens from '../../config/token_info/solana_tokens';
import { ADD_PANEL_DISPLAY, BALANCE_DECIMALS, MENU_ICONS, WALLET_CHAIN_LABELS, WALLET_CHAIN_OPTIONS, WALLET_DISPLAY } from '../../config/ui_config';

export default function UserMenu() {
  const { logout, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { wallets: solanaWallets } = useSolanaWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const cachedEvmKey = 'cached:evmAddress';
  const cachedSolKey = 'cached:solAddress';
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [isWalletPanelOpen, setIsWalletPanelOpen] = useState(false);
  const [isAddPanelOpen, setIsAddPanelOpen] = useState(true);
  const [isDevOpen, setIsDevOpen] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapMessage, setSwapMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [ethBalance, setEthBalance] = useClientState<string>('0');
  const [usdcBalance, setUsdcBalance] = useClientState<string>('0');
  const [wethBalance, setWethBalance] = useClientState<string>('0');
  const [daiBalance, setDaiBalance] = useClientState<string>('0');
  const [solBalance, setSolBalance] = useClientState<string>('0');
  const [balancesByChain, setBalancesByChain] = useState<
    Record<ChainKey, {
      eth?: string;
      usdc?: string;
      weth?: string;
      dai?: string;
      sol?: string;
      address?: string;
      solanaAddress?: string;
    }>
  >({} as Record<ChainKey, {
      eth?: string;
      usdc?: string;
      weth?: string;
      dai?: string;
      sol?: string;
      address?: string;
      solanaAddress?: string;
    }>);
  const [evmAddress, setEvmAddress] = useClientState<string>('');
  const [solanaAddress, setSolanaAddress] = useClientState<string>('');
  const [isNetworkOpen, setIsNetworkOpen] = useState(false);
  const [isWalletDropdownChainOpen, setIsWalletDropdownChainOpen] = useState(false);
  const [isAddPanelChainOpen, setIsAddPanelChainOpen] = useState(false);
  const [isAddPanelIconHovered, setIsAddPanelIconHovered] = useState(false);
  const [walletDropdownChain, setWalletDropdownChain] = useState<ChainKey | 'ALL'>('ALL');
  const [addPanelChain, setAddPanelChain] = useState<ChainKey | 'ALL'>('ALL');
  const [walletPanels, setWalletPanels] = useState<
    Array<{ id: number; chainKey: ChainKey | 'ALL'; isChainOpen: boolean }>
  >([]);
  const walletPanelIdRef = useRef(0);
  const [walletDropdownHasCustomChain, setWalletDropdownHasCustomChain] = useState(false);
  const [walletPanelHasCustomChain, setWalletPanelHasCustomChain] = useState(false);
  const [addPanelHasCustomChain, setAddPanelHasCustomChain] = useState(false);
  const [selectedChain, setSelectedChain] = useState<ChainKey>(BLOCKCHAIN);
  const [withdrawPanels, setWithdrawPanels] = useState<Record<number, { active: boolean; token: string; amount: string; address: string }>>({});
  const executeSwap = useSwap(selectedChain);
  const executeSolanaSwap = useSolanaSwap(selectedChain);
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

  const applyBalanceSnapshot = (
    chainKey: ChainKey,
    snapshot: {
      eth?: string;
      usdc?: string;
      weth?: string;
      dai?: string;
      sol?: string;
      address?: string;
      solanaAddress?: string;
    },
    solanaAddressValue?: string | null,
  ) => {
    setBalancesByChain((prev) => ({
      ...prev,
      [chainKey]: {
        eth: snapshot.eth,
        usdc: snapshot.usdc,
        weth: snapshot.weth,
        dai: snapshot.dai,
        sol: snapshot.sol,
        address: snapshot.address,
        solanaAddress: solanaAddressValue ?? snapshot.solanaAddress,
      },
    }));
    if (chainKey === selectedChain) {
      if (snapshot.eth) setEthBalance(snapshot.eth);
      if (snapshot.usdc) setUsdcBalance(snapshot.usdc);
      if (snapshot.weth) setWethBalance(snapshot.weth);
      if (snapshot.dai) setDaiBalance(snapshot.dai);
      if (snapshot.sol) setSolBalance(snapshot.sol);
      if (snapshot.address) setEvmAddress(snapshot.address);
      if (solanaAddressValue) setSolanaAddress(solanaAddressValue);
    }
  };

  const loadCachedBalances = (cacheKey: string, chainKey: ChainKey, solanaAddressValue?: string | null) => {
    if (typeof window === 'undefined') return false;
    const raw = localStorage.getItem(cacheKey);
    if (!raw) return false;
    try {
      const cached = JSON.parse(raw) as {
        timestamp: number;
        data: {
          eth?: string;
          usdc?: string;
          weth?: string;
          dai?: string;
          sol?: string;
          address?: string;
          solanaAddress?: string;
        };
      };
      if (!cached?.timestamp || !cached.data) return false;
      const isFresh = Date.now() - cached.timestamp <= balanceCacheTtlMs;
      if (!isFresh) return false;
      applyBalanceSnapshot(chainKey, cached.data, solanaAddressValue);
      return true;
    } catch {
      return false;
    }
  };

  const fetchBalancesForChain = async (chainKey: ChainKey, { forceRefresh }: { forceRefresh: boolean }) => {
    if (!authenticated) return;

    const token = typeof window !== 'undefined' ? localStorage.getItem('privy:token') : null;
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
    if (!forceRefresh) {
      const didUseCache = loadCachedBalances(cacheKey, chainKey, solanaAddressValue);
      if (didUseCache) return;
    }

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
              accessToken: token,
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

      applyBalanceSnapshot(chainKey, data ?? {}, solanaAddressValue);

      if (typeof window !== 'undefined') {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({
            timestamp: Date.now(),
            data: {
              eth: data?.eth,
              usdc: data?.usdc,
              weth: data?.weth,
              dai: data?.dai,
              sol: data?.sol,
              address: data?.address,
              solanaAddress: solanaAddressValue ?? undefined,
            },
          })
        );
      }
    } catch {
      setBalancesByChain((prev) => ({
        ...prev,
        [chainKey]: {
          eth: '0',
          usdc: '0',
          weth: '0',
          dai: '0',
          sol: '0',
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
  }, []);

  useClientEffect(() => {
    const controller = new AbortController();

    const run = async ({ forceRefresh, chainKey }: { forceRefresh: boolean; chainKey: ChainKey }) => {
      if (!authenticated) {
        setEthBalance('0');
        setUsdcBalance('0');
        setWethBalance('0');
        setDaiBalance('0');
        setSolBalance('0');
        setEvmAddress('');
        setSolanaAddress('');
        setBalancesByChain({} as Record<ChainKey, {
          eth?: string;
          usdc?: string;
          weth?: string;
          dai?: string;
          sol?: string;
          address?: string;
          solanaAddress?: string;
        }>);
        setIsWalletPanelOpen(false);
        if (typeof window !== 'undefined') {
          localStorage.removeItem(cachedEvmKey);
          localStorage.removeItem(cachedSolKey);
        }
        return;
      }

      await fetchBalancesForChain(chainKey, { forceRefresh });
    };

    void run({ forceRefresh: false, chainKey: selectedChain });

    const handleWalletOpen = () => {
      void run({ forceRefresh: true, chainKey: selectedChain });
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('altair:wallet-open', handleWalletOpen);
    }

    const handleSwapComplete = (event: Event) => {
      const detail = (event as CustomEvent).detail as { chain?: ChainKey } | undefined;
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
    const snapshot = chainKey === 'ALL'
      ? null
      : balancesByChain[chainKey as ChainKey];
    const fallback = {
      eth: ethBalance,
      usdc: usdcBalance,
      weth: wethBalance,
      dai: daiBalance,
      sol: solBalance,
    };
    const data = snapshot ?? fallback;
    const normalized = symbol.trim().toUpperCase();
    if (normalized === 'ETH') return data.eth ?? '0';
    if (normalized === 'SOL') return data.sol ?? '0';
    if (normalized === 'USDC') return data.usdc ?? '0';
    if (normalized === 'WETH') return data.weth ?? '0';
    if (normalized === 'DAI') return data.dai ?? '0';
    return '0';
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
  const resolveTokenRows = (chainKey: ChainKey | 'ALL') =>
    chainKey === 'SOLANA_MAINNET'
      ? ['SOL', 'USDC']
      : chainKey === 'ALL'
        ? ['ETH', 'SOL', 'USDC', 'WETH', 'DAI']
        : ['ETH', 'USDC', 'WETH', 'DAI'];
  const resolveWithdrawState = (panelId: number) =>
    withdrawPanels[panelId] ?? { active: false, token: '', amount: '', address: '' };
  const toggleWithdrawPanel = (panelId: number) => {
    setWithdrawPanels((prev) => {
      const current = prev[panelId] ?? { active: false, token: '', amount: '', address: '' };
      return {
        ...prev,
        [panelId]: { ...current, active: !current.active },
      };
    });
  };
  const updateWithdrawToken = (panelId: number, token: string) => {
    setWithdrawPanels((prev) => {
      const current = prev[panelId] ?? { active: false, token: '', amount: '', address: '' };
      return {
        ...prev,
        [panelId]: { ...current, token },
      };
    });
  };
  const updateWithdrawAmount = (panelId: number, amount: string) => {
    setWithdrawPanels((prev) => {
      const current = prev[panelId] ?? { active: false, token: '', amount: '', address: '' };
      return {
        ...prev,
        [panelId]: { ...current, amount },
      };
    });
  };
  const updateWithdrawAddress = (panelId: number, address: string) => {
    setWithdrawPanels((prev) => {
      const current = prev[panelId] ?? { active: false, token: '', amount: '', address: '' };
      return {
        ...prev,
        [panelId]: { ...current, address },
      };
    });
  };
  const renderBalances = (chainKey: ChainKey | 'ALL') => {
    const chainSnapshot = chainKey === 'ALL' ? null : balancesByChain[chainKey as ChainKey];
    const snapshot = chainSnapshot ?? {
      eth: ethBalance,
      usdc: usdcBalance,
      weth: wethBalance,
      dai: daiBalance,
      sol: solBalance,
    };
    const rows = resolveTokenRows(chainKey);
    return rows.map((symbol, index) => {
      const balanceValue =
        symbol === 'ETH'
          ? snapshot.eth
          : symbol === 'SOL'
            ? snapshot.sol
            : symbol === 'USDC'
              ? snapshot.usdc
              : symbol === 'WETH'
                ? snapshot.weth
                : snapshot.dai;
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
  const renderWalletPanelInstance = (
    panel: { id: number; chainKey: ChainKey | 'ALL'; isChainOpen: boolean },
    options?: {
      hideClose?: boolean;
      onClose?: () => void;
    },
  ) => (
    <div
      className="relative rounded-xl bg-gray-900 border border-gray-700 shadow-2xl overflow-visible flex flex-col"
      style={{ width: `${walletWidth}px` }}
    >
      {!options?.hideClose ? (
        <button
          type="button"
          onClick={options?.onClose ?? (() => {
            setWalletPanels((current) => {
              const next = current.filter((entry) => entry.id !== panel.id);
              if (next.length === 0) {
                setIsWalletPanelOpen(false);
              }
              return next;
            });
            setWithdrawPanels((prev) => {
              if (!prev[panel.id]) return prev;
              const { [panel.id]: _removed, ...rest } = prev;
              return rest;
            });
          })}
          aria-label="Close wallet panel"
          className="absolute z-10 text-gray-400 hover:text-gray-200 cursor-pointer"
          style={{
            top: `${closePaddingTop}px`,
            right: `${closePaddingRight}px`,
            fontSize: `${closeSize}px`,
            fontFamily: closeFontFamily,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      ) : null}
      <div
        className="relative flex items-center justify-center pointer-events-none"
        style={{
          paddingTop: `${titlePaddingTop}px`,
          paddingBottom: `${titlePaddingBottom}px`,
          paddingLeft: `${containerPaddingLeft}px`,
          paddingRight: `${containerPaddingRight}px`,
        }}
      >
        <button
          type="button"
          onClick={() => {
            setWalletPanels((current) =>
              current.map((entry) =>
                entry.id === panel.id ? { ...entry, isChainOpen: !entry.isChainOpen } : entry,
              ),
            );
          }}
          className="group inline-flex items-center justify-center cursor-pointer pointer-events-auto"
        >
          <span
            className="uppercase tracking-[0.3em] text-gray-400 group-hover:text-gray-200"
            style={{ fontSize: `${titleFontSize}px`, fontFamily: titleFontFamily }}
          >
            {resolveWalletTitle(panel.chainKey)}
          </span>
        </button>
        {panel.isChainOpen && (
          <div
            className="absolute left-1/2 top-full z-[120] -translate-x-1/2 rounded-xl border border-gray-500 bg-gray-900 shadow-2xl pointer-events-auto overflow-hidden"
            style={{
              fontSize: `${chainDropdownFontSize}px`,
              fontFamily: titleFontFamily,
              marginTop: `${titlePaddingBottom}px`,
              width: `${chainDropdownWidth}px`,
            }}
          >
            {walletChainOptions.filter((option) => option.key !== panel.chainKey).map((option) => {
              const isSelected = panel.chainKey === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    setWalletPanels((current) =>
                      current.map((entry) =>
                        entry.id === panel.id
                          ? { ...entry, chainKey: option.key, isChainOpen: false }
                          : entry,
                      ),
                    );
                    if (option.key !== 'ALL') {
                      void fetchBalancesForChain(option.key, { forceRefresh: true });
                    }
                  }}
                  className="flex w-full items-center uppercase tracking-[0.3em] text-gray-300 hover:bg-gray-800 transition-colors cursor-pointer"
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
        {(() => {
          const withdrawState = resolveWithdrawState(panel.id);
          const withdrawActive = withdrawState.active;
          const tokenOptions = resolveTokenRows(panel.chainKey);
          const withdrawInputId = `withdraw-token-${panel.id}`;
          return (
            <>
              <button
                type="button"
                onClick={() => toggleWithdrawPanel(panel.id)}
                className={`flex items-center justify-center rounded-lg border transition-colors cursor-pointer ${withdrawActive
                  ? 'border-blue-400 bg-blue-500/20 text-blue-100'
                  : 'border-gray-700 bg-gray-800/60 text-gray-100 hover:border-gray-500 hover:bg-gray-800'
                }`}
                style={{
                  height: `${buttonHeight}px`,
                  paddingLeft: `${buttonPaddingX}px`,
                  paddingRight: `${buttonPaddingX}px`,
                  fontSize: `${buttonFontSize}px`,
                }}
              >
                Withdraw
              </button>
              {withdrawActive ? (
                <div className="flex-1">
                  <input
                    type="text"
                    list={withdrawInputId}
                    value={withdrawState.token}
                    onChange={(event) => updateWithdrawToken(panel.id, event.target.value)}
                    placeholder="Select token..."
                    className="w-full rounded-lg border border-gray-700 bg-gray-800/60 text-gray-100 placeholder-gray-500 focus:border-gray-500 focus:outline-none"
                    style={{
                      height: `${buttonHeight}px`,
                      paddingLeft: `${withdrawSymbolPaddingLeft}px`,
                      paddingRight: `${withdrawSymbolPaddingRight}px`,
                      fontSize: `${buttonFontSize}px`,
                    }}
                  />
                  <datalist id={withdrawInputId}>
                    {tokenOptions.map((symbol) => (
                      <option key={symbol} value={symbol} />
                    ))}
                  </datalist>
                </div>
              ) : (
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
              )}
            </>
          );
        })()}
      </div>
      {resolveWithdrawState(panel.id).active ? (
        <>
          <div
            className="flex w-full items-center gap-2 py-1.5 text-sm text-gray-300"
            style={{
              paddingLeft: `${containerPaddingLeft}px`,
              paddingRight: `${containerPaddingRight}px`,
            }}
          >
            <span className="text-sm text-gray-300 whitespace-nowrap">Amount:</span>
            <div className="relative flex flex-1 min-w-0">
              <input
                type="text"
                inputMode="decimal"
                value={resolveWithdrawState(panel.id).amount}
                onChange={(event) => updateWithdrawAmount(panel.id, event.target.value)}
                placeholder="0.00"
                className="flex w-full items-center justify-center rounded-lg border border-gray-700 bg-gray-800/60 leading-none focus:border-gray-500 focus:outline-none"
                style={{
                  height: `${buttonHeight}px`,
                  paddingLeft: `${withdrawAmountInputPaddingLeft}px`,
                  paddingRight: `${withdrawAmountInputPaddingRight}px`,
                  fontSize: `${withdrawAmountInputFontSize}px`,
                  color: withdrawAmountInputColor,
                }}
              />
              {(() => {
                const selectedToken = resolveWithdrawState(panel.id).token;
                const hasSelectedToken = Boolean(selectedToken && selectedToken.trim());
                const maxColor = !hasSelectedToken
                  ? withdrawMaxInactiveColor
                  : isMaxHovering
                    ? withdrawMaxHighlightColor
                    : withdrawMaxColor;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      if (!hasSelectedToken) return;
                      const normalizedToken = selectedToken.trim().toUpperCase();
                      const chainKey = panel.chainKey === 'ALL' ? null : panel.chainKey;
                      const gasToken = chainKey ? GAS_TOKENS[chainKey] : null;
                      const reserve = chainKey ? Number(GAS_RESERVES[chainKey] ?? 0) : 0;
                      const balanceValue = resolveBalanceForSymbol(panel.chainKey, normalizedToken);
                      const balanceNumber = Number(balanceValue);
                      const isGasToken = gasToken && normalizedToken === gasToken;
                      const effective = isGasToken && Number.isFinite(balanceNumber)
                        ? Math.max(0, balanceNumber - reserve)
                        : balanceValue;
                      updateWithdrawAmount(panel.id, effective.toString());
                    }}
                    onMouseEnter={() => {
                      if (hasSelectedToken) setIsMaxHovering(true);
                    }}
                    onMouseLeave={() => setIsMaxHovering(false)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 font-semibold cursor-pointer"
                    style={{
                      fontSize: `${withdrawMaxFontSize}px`,
                      color: maxColor,
                    }}
                  >
                    MAX
                  </button>
                );
              })()}
            </div>
            <span
              className="whitespace-nowrap text-center"
              style={{
                fontSize: `${withdrawDollarValueFontSize}px`,
                fontFamily: withdrawDollarValueFontFamily,
                color: withdrawDollarValueColor,
                width: withdrawDollarValueWidth ? `${withdrawDollarValueWidth}px` : undefined,
                paddingLeft: `${withdrawDollarValuePaddingLeft}px`,
                paddingRight: `${withdrawDollarValuePaddingRight}px`,
                textAlign: 'center',
              }}
            >
              ($XX.XX)
            </span>
          </div>
          <div
            className="flex w-full items-center gap-2 py-1.5 text-sm text-gray-300"
            style={{
              paddingLeft: `${containerPaddingLeft}px`,
              paddingRight: `${containerPaddingRight}px`,
            }}
          >
            <span className="text-sm text-gray-300 whitespace-nowrap">Recipient:</span>
            <textarea
              rows={1}
              value={resolveWithdrawState(panel.id).address}
              onChange={(event) => updateWithdrawAddress(panel.id, event.target.value)}
              placeholder="Recipient Address..."
              className="flex w-full rounded-lg border border-gray-700 bg-gray-800/60 leading-snug focus:border-gray-500 focus:outline-none resize-none text-center"
              style={{
                minHeight: `${buttonHeight + 2}px`,
                paddingLeft: `${withdrawAddressInputPaddingLeft}px`,
                paddingRight: `${withdrawAddressInputPaddingRight}px`,
                fontSize: `${withdrawAddressInputFontSize}px`,
                color: withdrawAddressInputColor,
                textAlign: 'center',
              }}
            />
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
              onClick={() => {
                const state = resolveWithdrawState(panel.id);
                const token = state.token?.trim();
                const amount = state.amount?.trim();
                const address = state.address?.trim();
                if (!token || !amount || !address) return;
                if (panel.chainKey === 'ALL') return;
                const chainKey = panel.chainKey as ChainKey;
                const run = async () => {
                  if (isSolanaChain(chainKey)) {
                    console.info('[Withdraw] Solana withdrawals coming soon.');
                    return;
                  }
                  await sendEvmTransfer({ chainKey, recipient: address, tokenSymbol: token, amount });
                };
                void run().catch((err) => {
                  console.warn('[Withdraw] submit failed', err);
                });
              }}
              className="flex items-center justify-center rounded-lg transition-colors cursor-pointer"
              style={{
                height: `${buttonHeight}px`,
                paddingLeft: `${withdrawSubmitButtonConfig.paddingLeft}px`,
                paddingRight: `${withdrawSubmitButtonConfig.paddingRight}px`,
                fontSize: `${buttonFontSize}px`,
                color: withdrawSubmitButtonConfig.textColor,
                backgroundColor: withdrawSubmitButtonConfig.buttonColor,
                borderColor: withdrawSubmitButtonConfig.borderColor,
                borderWidth: `${withdrawSubmitBorderWidth}px`,
                borderStyle: 'solid',
              }}
            >
              Submit Withdrawawal
            </button>
            <button
              type="button"
              onClick={() => toggleWithdrawPanel(panel.id)}
              className="flex items-center justify-center rounded-lg transition-colors cursor-pointer"
              style={{
                height: `${buttonHeight}px`,
                paddingLeft: `${withdrawCancelButtonConfig.paddingLeft}px`,
                paddingRight: `${withdrawCancelButtonConfig.paddingRight}px`,
                fontSize: `${buttonFontSize}px`,
                color: withdrawCancelButtonConfig.textColor,
                backgroundColor: withdrawCancelButtonConfig.buttonColor,
                borderColor: withdrawCancelButtonConfig.borderColor,
                borderWidth: `${withdrawCancelBorderWidth}px`,
                borderStyle: 'solid',
              }}
            >
              Cancel
            </button>
          </div>
          {isSolanaChain(panel.chainKey) ? (
            <div
              className="w-full text-center text-xs text-gray-400"
              style={{
                paddingLeft: `${containerPaddingLeft}px`,
                paddingRight: `${containerPaddingRight}px`,
              }}
            >
              Coming Soon
            </div>
          ) : null}
          <div className="h-[1px] bg-gray-700 w-full" />
        </>
      ) : null}
      <div
        className="flex w-full items-center gap-2 py-1.5 text-sm text-gray-300"
        style={{
          paddingLeft: `${containerPaddingLeft}px`,
          paddingRight: `${containerPaddingRight}px`,
        }}
      >
        <span className="text-sm text-gray-300 whitespace-nowrap">Wallet Address:</span>
        <button
          type="button"
          onClick={() => {
            const address = resolveWalletAddress(panel.chainKey);
            if (address) navigator.clipboard?.writeText(address).catch(() => {});
          }}
          title={resolveWalletAddress(panel.chainKey) || 'Unknown'}
          className="flex flex-1 min-w-0 items-center justify-center rounded-lg border border-gray-700 bg-gray-800/60 text-gray-100 leading-none hover:border-gray-500 hover:bg-gray-800 transition-colors cursor-pointer overflow-hidden"
          style={{
            height: `${buttonHeight}px`,
            paddingLeft: `${buttonPaddingX / 2}px`,
            paddingRight: `${buttonPaddingX / 2}px`,
            fontSize: `${buttonFontSize}px`,
          }}
        >
          <span
            className="flex h-full items-center text-right text-sm leading-none relative top-[1px] truncate"
            title={resolveWalletAddress(panel.chainKey) || 'Unknown'}
          >
            {formatDisplayAddress(resolveWalletAddress(panel.chainKey))}
          </span>
          <span className="flex w-4 justify-start ml-2">
            <Copy className="w-4 h-4 inline-flex" />
          </span>
        </button>
      </div>
      <div className="h-[1px] bg-gray-700 w-full" />
      {renderBalances(panel.chainKey)}
    </div>
  );

  const renderWalletPanel = (panel: { id: number; chainKey: ChainKey | 'ALL'; isChainOpen: boolean }) =>
    renderWalletPanelInstance(panel);

  const renderAddPanel = () => (
    <div
      className="relative rounded-xl bg-gray-900 border border-gray-700 shadow-2xl overflow-visible flex flex-col"
      style={{ width: `${addPanelWidth}px` }}
    >
      <button
        type="button"
        onClick={() => setIsAddPanelOpen(false)}
        aria-label="Close wallet panel"
        className="absolute z-10 text-gray-400 hover:text-gray-200 cursor-pointer"
        style={{
          top: `${addPanelClosePaddingTop}px`,
          right: `${addPanelClosePaddingRight}px`,
          fontSize: `${addPanelCloseSize}px`,
          fontFamily: addPanelCloseFontFamily,
          lineHeight: 1,
        }}
      >
        ×
      </button>
      <div
        className="relative flex items-center justify-start gap-3 pointer-events-none"
        style={{
          paddingTop: `${addPanelIconPaddingTop}px`,
          paddingBottom: `${addPanelIconPaddingBottom}px`,
          paddingLeft: `${addPanelPaddingLeft}px`,
          paddingRight: `${addPanelPaddingRight}px`,
        }}
      >
        <span
          className="text-left"
          style={{
            fontSize: `${addPanelLabelFontSize}px`,
            fontFamily: addPanelLabelFontFamily,
            color: addPanelLabelColor,
          }}
        >
          Add Panel:
        </span>
        <button
          type="button"
          onClick={() => setIsAddPanelChainOpen((current) => !current)}
          onMouseEnter={() => setIsAddPanelIconHovered(true)}
          onMouseLeave={() => setIsAddPanelIconHovered(false)}
          className="group inline-flex items-center justify-center cursor-pointer pointer-events-auto"
        >
          <span
            className="flex items-center justify-center rounded-full border transition-colors"
            style={{
              width: `${addPanelIconContainerSize}px`,
              height: `${addPanelIconContainerSize}px`,
              backgroundColor: addPanelIconButtons.container_color,
              borderColor: isAddPanelChainOpen || isAddPanelIconHovered
                ? addPanelIconButtons.highlight_color
                : addPanelIconButtons.border_color,
              borderWidth: `${addPanelIconBorderWidth}px`,
              boxSizing: 'content-box',
            }}
          >
            <Wallet
              className="transition-colors"
              color={addPanelIconButtons.icon_color}
              style={{ width: `${addPanelIconSize}px`, height: `${addPanelIconSize}px` }}
            />
          </span>
        </button>
        {isAddPanelChainOpen && (
          <div
            className="absolute left-1/2 top-full z-[120] -translate-x-1/2 rounded-xl border border-gray-500 bg-gray-900 shadow-2xl pointer-events-auto overflow-hidden"
            style={{
              fontSize: `${addPanelChainDropdownFontSize}px`,
              fontFamily: addPanelLabelFontFamily,
              marginTop: `${addPanelTitlePaddingBottom}px`,
              width: `${addPanelChainDropdownWidth}px`,
            }}
          >
            {walletChainOptions
              .filter((option) => option.key !== addPanelChain)
              .filter((option) => {
                const openChains = new Set<ChainKey | 'ALL'>(walletPanels.map((panel) => panel.chainKey));
                return !openChains.has(option.key);
              })
              .map((option) => {
              const isSelected = addPanelChain === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => {
                    setAddPanelChain(option.key);
                    setAddPanelHasCustomChain(true);
                    setIsAddPanelChainOpen(false);
                    setWalletPanels((current) => [
                      ...current,
                      {
                        id: walletPanelIdRef.current + 1,
                        chainKey: option.key,
                        isChainOpen: false,
                      },
                    ]);
                    if (option.key !== 'ALL') {
                      void fetchBalancesForChain(option.key, { forceRefresh: true });
                    }
                    walletPanelIdRef.current += 1;
                  }}
                  className="flex w-full items-center uppercase tracking-[0.3em] text-gray-300 hover:bg-gray-800 transition-colors cursor-pointer"
                  style={{
                    paddingLeft: `${addPanelPaddingLeft}px`,
                    paddingRight: `${addPanelPaddingRight}px`,
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
    </div>
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
      {/* Dev tools dropdown */}
      <div className="relative">
        <button
          onClick={() => {
        setIsDevOpen(!isDevOpen);
        setIsWalletOpen(false);
        setIsProfileOpen(false);
        setIsNetworkOpen(false);
      }}
          title="Dev Tools"
          className="flex items-center justify-center rounded-full border-[var(--border-color)] hover:border-[var(--highlight-color)] transition-all shadow-md cursor-pointer"
          style={{
            width: `${MENU_ICONS.size * 4 * 1.6}px`,
            height: `${MENU_ICONS.size * 4 * 1.6}px`,
            backgroundColor: MENU_ICONS.container_color,
            borderColor: isDevOpen ? MENU_ICONS.highlight_color : undefined,
            borderWidth: `${MENU_ICONS.border_width}px`,
            boxSizing: 'content-box',
            ['--border-color' as never]: MENU_ICONS.border_color,
            ['--highlight-color' as never]: MENU_ICONS.highlight_color,
          }}
        >
          <Wrench
            className=""
            style={{ width: `${MENU_ICONS.size * 4}px`, height: `${MENU_ICONS.size * 4}px` }}
            color={MENU_ICONS.icon_color}
          />
        </button>
        {isDevOpen && (
          <div className="absolute right-0 mt-3 w-48 rounded-xl bg-gray-900 border border-gray-700 shadow-2xl z-[100] overflow-hidden flex flex-col">
            <button
              onClick={async () => {
                setIsSwapping(true);
                try {
                  const result =
                    selectedChain === 'SOLANA_MAINNET'
                      ? await executeSolanaSwap('SOL', '0.0001', 'USDC')
                      : await executeSwap('ETH', '0.000001', 'USDC');
                  const txHash = result as string;
                  console.log('[Test Swap] Swap complete:', txHash);
                  showSwapMessage({
                    type: 'success',
                    text: `Swap complete.\n${txHash}`,
                  });
                } catch (error) {
                  console.error('[Test Swap] Swap failed:', error);
                  const message = error instanceof Error ? error.message : 'Swap failed';
                  showSwapMessage({
                    type: 'error',
                    text: message,
                  });
                } finally {
                  setIsSwapping(false);
                  setIsDevOpen(false);
                }
              }}
              disabled={isSwapping}
              className="flex w-full items-center px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors text-left"
            >
              <span className="flex-1">
                {selectedChain === 'SOLANA_MAINNET'
                  ? 'Test Swap: 0.0001 SOL for USDC'
                  : 'Test Swap: 0.000001 ETH for USDC'}
              </span>
            </button>
            <div className="h-[1px] bg-gray-700 w-full" />
            <button
              onClick={async () => {
                setIsSwapping(true);
                try {
                  const result =
                    selectedChain === 'SOLANA_MAINNET'
                      ? await executeSolanaSwap('USDC', '0.1', 'SOL')
                      : await executeSwap('ETH', '0.000001', 'WETH');
                  const txHash = result as string;
                  console.log('[Test Swap] Swap complete:', txHash);
                  showSwapMessage({
                    type: 'success',
                    text: `Swap complete.\n${txHash}`,
                  });
                } catch (error) {
                  console.error('[Test Swap] Swap failed:', error);
                  const message = error instanceof Error ? error.message : 'Swap failed';
                  showSwapMessage({
                    type: 'error',
                    text: message,
                  });
                } finally {
                  setIsSwapping(false);
                  setIsDevOpen(false);
                }
              }}
              disabled={isSwapping}
              className="flex w-full items-center px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors text-left"
            >
              <span className="flex-1">
                {selectedChain === 'SOLANA_MAINNET'
                  ? 'Test Swap: 0.1 USDC for SOL'
                  : 'Test Swap: 0.000001 ETH for WETH'}
              </span>
            </button>
            <div className="h-[1px] bg-gray-700 w-full" />
            <button
              onClick={async () => {
                setIsSwapping(true);
                try {
                  const result =
                    selectedChain === 'SOLANA_MAINNET'
                      ? await executeSolanaSwap('SOL', '0.0001', 'USDC')
                      : await executeSwap('WETH', '0.000001', 'USDC');
                  const txHash = result as string;
                  console.log('[Test Swap] Swap complete:', txHash);
                  showSwapMessage({
                    type: 'success',
                    text: `Swap complete.\n${txHash}`,
                  });
                } catch (error) {
                  console.error('[Test Swap] Swap failed:', error);
                  const message = error instanceof Error ? error.message : 'Swap failed';
                  showSwapMessage({
                    type: 'error',
                    text: message,
                  });
                } finally {
                  setIsSwapping(false);
                  setIsDevOpen(false);
                }
              }}
              disabled={isSwapping}
              className="flex w-full items-center px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors text-left"
            >
              <span className="flex-1">
                {selectedChain === 'SOLANA_MAINNET'
                  ? 'Test Swap: 0.0001 SOL for USDC'
                  : 'Test Swap: 0.000001 WETH for USDC'}
              </span>
            </button>
            <div className="h-[1px] bg-gray-700 w-full" />
            <button
              onClick={async () => {
                setIsSwapping(true);
                try {
                  const result =
                    selectedChain === 'SOLANA_MAINNET'
                      ? await executeSolanaSwap('USDC', '0.1', 'SOL')
                      : await executeSwap('WETH', '0.00001', 'USDC');
                  const txHash = result as string;
                  console.log('[Test Swap] Swap complete:', txHash);
                  showSwapMessage({
                    type: 'success',
                    text: `Swap complete.\n${txHash}`,
                  });
                } catch (error) {
                  console.error('[Test Swap] Swap failed:', error);
                  const message = error instanceof Error ? error.message : 'Swap failed';
                  showSwapMessage({
                    type: 'error',
                    text: message,
                  });
                } finally {
                  setIsSwapping(false);
                  setIsDevOpen(false);
                }
              }}
              disabled={isSwapping}
              className="flex w-full items-center px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors text-left"
            >
              <span className="flex-1">
                {selectedChain === 'SOLANA_MAINNET'
                  ? 'Test Swap: 0.1 USDC for SOL'
                  : 'Test Swap: 0.00001 WETH for USDC'}
              </span>
            </button>
            <div className="h-[1px] bg-gray-700 w-full" />
            <button
              onClick={() => setIsDevOpen(false)}
              className="flex w-full items-center px-4 py-3 text-sm text-gray-300 hover:bg-gray-800 transition-colors text-left"
            >
              <span className="flex-1">Test Withdraw</span>
            </button>
          </div>
        )}
      </div>

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
            width: `${MENU_ICONS.size * 4 * 1.6}px`,
            height: `${MENU_ICONS.size * 4 * 1.6}px`,
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
        </button>
        {isNetworkOpen && (
          <div className="absolute right-0 mt-3 w-48 rounded-xl bg-gray-900 border border-gray-700 shadow-2xl z-[100] overflow-hidden flex flex-col">
            {[{ label: 'ETH Mainnet', key: 'ETH_MAINNET' as ChainKey }, { label: 'Sepolia Testnet', key: 'ETH_SEPOLIA' as ChainKey }, { label: 'Base Mainnet', key: 'BASE_MAINNET' as ChainKey }, { label: 'Base Testnet', key: 'BASE_SEPOLIA' as ChainKey }, { label: 'Solana Mainnet', key: 'SOLANA_MAINNET' as ChainKey }].map(({ label, key }) => {
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
                  setWalletPanels((existing) =>
                    existing.length > 0
                      ? existing
                      : [
                          {
                            id: walletPanelIdRef.current + 1,
                            chainKey: selectedChain,
                            isChainOpen: false,
                          },
                        ],
                  );
                  void fetchBalancesForChain(selectedChain, { forceRefresh: true });
                  if (walletPanelIdRef.current === 0) {
                    walletPanelIdRef.current += 1;
                  }
                  setWalletPanelHasCustomChain(false);
                  setAddPanelChain(selectedChain);
                  setAddPanelHasCustomChain(false);
                  setIsAddPanelOpen(true);
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
              <span className="text-sm text-gray-300 whitespace-nowrap">Wallet Address:</span>
              <button
                type="button"
                onClick={() => {
                  const address = resolveWalletAddress(walletDropdownChain);
                  if (address) navigator.clipboard?.writeText(address).catch(() => {});
                }}
                title={resolveWalletAddress(walletDropdownChain) || 'Unknown'}
                className="flex flex-1 min-w-0 items-center justify-center rounded-lg border border-gray-700 bg-gray-800/60 text-gray-100 leading-none hover:border-gray-500 hover:bg-gray-800 transition-colors cursor-pointer overflow-hidden"
                style={{
                  height: `${buttonHeight}px`,
                  paddingLeft: `${buttonPaddingX / 2}px`,
                  paddingRight: `${buttonPaddingX / 2}px`,
                  fontSize: `${buttonFontSize}px`,
                }}
              >
                <span className="flex h-full items-center text-right text-sm leading-none relative top-[1px] truncate" title={resolveWalletAddress(walletDropdownChain) || 'Unknown'}>
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
              onClick={() => { logout(); setIsProfileOpen(false); }}
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
