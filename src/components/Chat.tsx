'use client';

import React, { useState, useRef, useEffect } from 'react';
import { SpinningLogo } from './SpinningLogo';
import { ShieldCheck, Send, Loader2 } from 'lucide-react';
import { useLogoAsset } from '../lib/logo';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import { withWaitLogger } from '../lib/waitLogger';
import { getBackendBaseUrl } from '../lib/backendUrl';
import { useSwap } from '../lib/useSwap';
import { useSolanaSwap } from '../lib/useSolanaSwap';
import { useRelay } from '../lib/useRelay';
import { getCachedPrivyAccessToken } from '../lib/privyTokenCache';
import { dispatchSwapInitiated, dispatchSwapConfirmed } from '../lib/eventTypes';
import { BLOCKCHAIN, CHAINS, type ChainKey } from '../../config/blockchain_config';
import * as SolanaTokens from '../../config/token_info/solana_tokens';
import { CHAT_PANEL, CHAIN_OPTIONS, TRANSACTION_INFO_PANEL_DISPLAY } from '../../config/ui_config';
import { CHAT_BUTTON_ROW_TEMPLATES } from '../../config/ai_config';
import {
  buildChatButtonRowFromIntent,
  buildChatButtonRowFromLogicTrigger,
  type ChatButtonItem,
  type ChatButtonRowModel,
  type ChatSwapIntent,
} from '../lib/chatButtonRows';
import ChatButtonRow from './ChatButtonRow';
import TransactionInfoPanel, { type TransactionInfoPanelState } from './panels/TransactionInfoPanel';
import { readCachedTokenSnapshot } from '../lib/useSwap';
import { useWallets } from '@privy-io/react-auth';
import { BASE_MAINNET, BASE_SEPOLIA, ETH_MAINNET, ETH_SEPOLIA, SOLANA_MAINNET } from '../../config/chain_info';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  displayContent?: string;
  isTyping?: boolean;
  zgHash?: string | null;
  zgError?: string | null;
  cid?: string | null;
  chatButtonRow?: ChatButtonRowModel | null;
  transactionInfoPanel?: TransactionInfoPanelState | null;
}

type SwapIntent = ChatSwapIntent;

type ExecutableSwapIntent = SwapIntent & {
  type: 'SINGLE_CHAIN_SWAP_INTENT' | 'CROSS_CHAIN_SWAP_INTENT' | 'BRIDGE_INTENT';
};

type SolanaTokenConfig = { symbol?: string; name?: string; address?: string; decimals?: number };

const SOLANA_TOKEN_MAP = Object.values(SolanaTokens as Record<string, SolanaTokenConfig>)
  .reduce<Record<string, SolanaTokenConfig>>((acc, token) => {
    if (!token || typeof token !== 'object') return acc;
    const symbol = typeof token.symbol === 'string' ? token.symbol.toUpperCase() : null;
    if (symbol) acc[symbol] = token;
    return acc;
  }, {});

const isMissingSolanaToken = (symbol: string) => {
  const entry = SOLANA_TOKEN_MAP[symbol.toUpperCase()];
  return !entry || !entry.address;
};

export default function Chat() {
  const { authenticated, getAccessToken } = usePrivy();
  const { wallets: solanaWallets } = useSolanaWallets();
  const { wallets: evmWallets } = useWallets();
  const executeSwap = useSwap();
  const executeSolanaSwap = useSolanaSwap();
  const executeRelay = useRelay();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExecutingSwap, setIsExecutingSwap] = useState(false);
  const [pendingIntent, setPendingIntent] = useState<SwapIntent | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowActionsInFlightRef = useRef<Set<string>>(new Set());
  const inFlightClientRequestIdsRef = useRef<Set<string>>(new Set());
  const sendInFlightRef = useRef(false);
  const typingSpeedMs = CHAT_PANEL.typingSpeedMs;
  const logoAsset = useLogoAsset();

  const createClientRequestId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  };

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    const pendingIndex = messages.findIndex((m) => m.role === 'assistant' && m.isTyping);
    if (pendingIndex === -1) return;

    const timer = setTimeout(() => {
      setMessages((prev) => {
        const next = [...prev];
        const msg = next[pendingIndex];
        if (!msg || msg.role !== 'assistant' || !msg.isTyping) return prev;

        const current = msg.displayContent ?? '';
        const nextChar = msg.content.charAt(current.length);
        if (!nextChar) {
          next[pendingIndex] = { ...msg, displayContent: msg.content, isTyping: false };
          return next;
        }

        next[pendingIndex] = { ...msg, displayContent: current + nextChar };
        return next;
      });
    }, typingSpeedMs);

    return () => clearTimeout(timer);
  }, [messages, typingSpeedMs]);

  const extractSwapIntent = (text: string): SwapIntent | null => {
    const trimmed = text.trim();
    const parseCandidate = (candidate: string) => {
      try {
        return JSON.parse(candidate) as SwapIntent;
      } catch {
        return null;
      }
    };

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return parseCandidate(trimmed);
    }

    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return parseCandidate(trimmed.slice(firstBrace, lastBrace + 1));
    }

    return null;
  };

  const extractIntentJsonSlice = (text: string): { intent: SwapIntent; start: number; end: number } | null => {
    const trimmed = text.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const intent = extractSwapIntent(trimmed);
      if (intent?.type) {
        return { intent, start: text.indexOf('{'), end: text.lastIndexOf('}') + 1 };
      }
      return null;
    }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const candidate = text.slice(firstBrace, lastBrace + 1);
      const intent = extractSwapIntent(candidate);
      if (intent?.type) {
        return { intent, start: firstBrace, end: lastBrace + 1 };
      }
    }
    return null;
  };

  const stripIntentJson = (text: string): string => {
    const slice = extractIntentJsonSlice(text);
    if (!slice) return text;
    const before = text.slice(0, slice.start);
    const after = text.slice(slice.end);
    return `${before}${after}`.trim();
  };


  const resolveSelectedChain = (): ChainKey => {
    if (typeof window === 'undefined') return BLOCKCHAIN;
    const stored = localStorage.getItem('selectedChain');
    if (stored && stored in CHAINS) return stored as ChainKey;
    return BLOCKCHAIN;
  };

  const resolveIntentChain = (intent?: SwapIntent | null): ChainKey => {
    const sellChain = intent?.sellTokenChain ?? null;
    const buyChain = intent?.buyTokenChain ?? null;
    if (sellChain && sellChain in CHAINS) return sellChain as ChainKey;
    if (buyChain && buyChain in CHAINS) return buyChain as ChainKey;
    return resolveSelectedChain();
  };

  const deriveConfirmedSwapMeta = (
    intent: ExecutableSwapIntent
  ): {
    sellToken: string;
    buyToken: string;
    sellChain: ChainKey;
    buyChain: ChainKey;
    amount: string;
    intentType: 'SINGLE_CHAIN_SWAP_INTENT' | 'CROSS_CHAIN_SWAP_INTENT' | 'BRIDGE_INTENT';
  } | null => {
    const sell = intent.sell?.toUpperCase();
    const buy = intent.buy?.toUpperCase();
    if (!sell || !buy) return null;
    const amount = typeof intent.amount === 'number' ? intent.amount.toString() : intent.amount;
    if (!amount) return null;
    let sellChain: ChainKey;
    let buyChain: ChainKey;
    if (intent.type === 'CROSS_CHAIN_SWAP_INTENT' || intent.type === 'BRIDGE_INTENT') {
      if (!intent.sellTokenChain || !intent.buyTokenChain) return null;
      if (!(intent.sellTokenChain in CHAINS) || !(intent.buyTokenChain in CHAINS)) return null;
      sellChain = intent.sellTokenChain as ChainKey;
      buyChain = intent.buyTokenChain as ChainKey;
    } else {
      const single = resolveIntentChain(intent);
      sellChain = single;
      buyChain = single;
    }
    const normalizedSell = sellChain === 'SOLANA_MAINNET' && sell === 'ETH' ? 'SOL' : sell;
    const normalizedBuy = buyChain === 'SOLANA_MAINNET' && buy === 'ETH' ? 'SOL' : buy;
    return {
      sellToken: normalizedSell,
      buyToken: normalizedBuy,
      sellChain,
      buyChain,
      amount,
      intentType: intent.type,
    };
  };

  const isConfirmationMessage = (text: string): boolean => {
    const normalized = text.trim().toLowerCase();
    if (!normalized) return false;
    const phrases = ['confirm', 'yes', 'execute', 'do it', 'ok', 'okay'];
    return phrases.some((phrase) => normalized === phrase || normalized.includes(phrase));
  };

  const prefetchSolanaTokensForIntent = async (intent: SwapIntent) => {
    const sell = intent.sell?.toUpperCase();
    const buy = intent.buy?.toUpperCase();
    if (!sell || !buy) return;
    const selectedChain = resolveIntentChain(intent);
    if (selectedChain !== 'SOLANA_MAINNET') return;
    const sellNeedsLookup = isMissingSolanaToken(sell);
    const buyNeedsLookup = isMissingSolanaToken(buy);
    if (!sellNeedsLookup && !buyNeedsLookup) return;
    try {
      console.log('[Swap Intent] Solana token prefetch', {
        sell,
        buy,
        sellNeedsLookup,
        buyNeedsLookup,
      });
      const [sellRes, buyRes] = await Promise.all([
        sellNeedsLookup
          ? withWaitLogger(
              {
                file: 'altair_frontend1/src/components/Chat.tsx',
                target: '/api/token-mint',
                description: 'Solana sell token mint lookup',
              },
              () =>
                fetch(`${getBackendBaseUrl()}/api/token-mint`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ q: sell }),
                })
            )
          : Promise.resolve(null),
        buyNeedsLookup
          ? withWaitLogger(
              {
                file: 'altair_frontend1/src/components/Chat.tsx',
                target: '/api/token-mint',
                description: 'Solana buy token mint lookup',
              },
              () =>
                fetch(`${getBackendBaseUrl()}/api/token-mint`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ q: buy }),
                })
            )
          : Promise.resolve(null),
      ]);
      if (sellRes && sellRes.ok) {
        const payload = await sellRes.json();
        console.log('[Swap Intent] Solana token lookup (sell)', {
          query: sell,
          mint: payload?.mint ?? null,
          token: payload?.token ?? null,
          candidates: payload?.candidates ?? null,
        });
      }
      if (buyRes && buyRes.ok) {
        const payload = await buyRes.json();
        console.log('[Swap Intent] Solana token lookup (buy)', {
          query: buy,
          mint: payload?.mint ?? null,
          token: payload?.token ?? null,
          candidates: payload?.candidates ?? null,
        });
      }
    } catch (prefetchErr) {
      console.warn('[Swap Intent] Solana token prefetch failed:', prefetchErr);
    }
  };

  const maybeExecuteSwapIntent = async (
    intent: SwapIntent | null,
    cid: string | null | undefined,
    userMessage: string
  ) => {
    const isConfirm = isConfirmationMessage(userMessage);
    if (!isConfirm) {
      if (intent) {
        setPendingIntent(intent);
      }
      return null;
    }

    const effectiveIntent = (pendingIntent ?? intent) as ExecutableSwapIntent | null;
    if (!effectiveIntent) return null;
    setPendingIntent(null);
    return executeIntentNow(effectiveIntent, cid ?? null);
  };

  const executeIntentNow = async (
    effectiveIntent: ExecutableSwapIntent,
    cid: string | null | undefined
  ) => {
    console.log('[ChatButtonRow] executeIntentNow start', {
      intentType: effectiveIntent.type,
      cid: cid ?? null,
    });
    const sell = effectiveIntent.sell?.toUpperCase();
    const buy = effectiveIntent.buy?.toUpperCase();
    const amount = typeof effectiveIntent.amount === 'number' ? effectiveIntent.amount.toString() : effectiveIntent.amount;

    if (!sell) return null;
    if (!amount || Number(amount) <= 0) return null;

    if (effectiveIntent.type === 'BRIDGE_INTENT' || effectiveIntent.type === 'CROSS_CHAIN_SWAP_INTENT') {
      if (!effectiveIntent.sellTokenChain || !effectiveIntent.buyTokenChain) return null;
      const relayResult = await executeRelay(
        {
          type: effectiveIntent.type,
          sell,
          buy,
          amount,
          sellTokenChain: effectiveIntent.sellTokenChain,
          buyTokenChain: effectiveIntent.buyTokenChain,
        },
        cid ?? null
      );
      console.log('[ChatButtonRow] executeIntentNow relay success', {
        requestId: relayResult.requestId ?? null,
      });
      return `Relay request submitted: ${relayResult.requestId ?? 'pending'}`;
    }

    if (!buy) return null;

    const selectedChain = resolveIntentChain(effectiveIntent);
    setIsExecutingSwap(true);
    try {
      const normalizedSell = selectedChain === 'SOLANA_MAINNET' && sell === 'ETH' ? 'SOL' : sell;
      const normalizedBuy = selectedChain === 'SOLANA_MAINNET' && buy === 'ETH' ? 'SOL' : buy;
      await (selectedChain === 'SOLANA_MAINNET'
        ? executeSolanaSwap(normalizedSell, amount, normalizedBuy, cid)
        : executeSwap(sell, amount, buy, cid));
      const buyAmountKey = `${normalizedSell.toUpperCase()}:${normalizedBuy.toUpperCase()}:${selectedChain}`;
      const resolvedBuyAmount = completedSwapBuyAmountsRef.current.get(buyAmountKey) ?? null;
      if (resolvedBuyAmount) completedSwapBuyAmountsRef.current.delete(buyAmountKey);
      const buyAmount = resolvedBuyAmount ?? 'unknown';
      const action = 'swapped';
      console.log('[ChatButtonRow] executeIntentNow swap success', {
        action,
        amount,
        sell: normalizedSell,
        buy: normalizedBuy,
      });
      return `Swap executed: ${action} ${amount} ${normalizedSell} for ${buyAmount} ${normalizedBuy}.`;
    } catch (swapErr) {
      const err = swapErr as {
        message?: string;
        code?: string;
        payload?: {
          candidates?: Array<{ symbol?: string; address?: string; name?: string }>;
        };
      };
      const code = typeof err?.code === 'string' ? err.code : '';
      const candidates = Array.isArray(err?.payload?.candidates) ? err.payload.candidates : [];
      if (
        (code === 'AMBIGUOUS_SELL_TOKEN' || code === 'AMBIGUOUS_BUY_TOKEN') &&
        selectedChain !== 'SOLANA_MAINNET' &&
        candidates.length > 0
      ) {
        const lines = candidates.slice(0, 5).map((candidate) => {
          const symbolText = typeof candidate?.symbol === 'string' ? candidate.symbol : '?';
          const nameText = typeof candidate?.name === 'string' && candidate.name.trim().length > 0
            ? ` (${candidate.name})`
            : '';
          const addressText = typeof candidate?.address === 'string' ? candidate.address : 'unknown-address';
          return `- ${symbolText}${nameText}: ${addressText}`;
        });
        throw new Error(
          [
            typeof err?.message === 'string' && err.message.trim().length > 0
              ? err.message
              : 'Token symbol is ambiguous on this chain.',
            'Specify the token contract address in your next message, for example:',
            '"swap 10 <SELL_TOKEN_ADDRESS> to <BUY_TOKEN_ADDRESS> on base"',
            ...lines,
          ].join('\n')
        );
      }
      throw swapErr;
    } finally {
      setIsExecutingSwap(false);
    }
  };

  const lockChatButtonRow = (params: { targetRowId: string; selectedButtonId: string }) => {
    setMessages((prev) =>
      prev.map((message) => {
        const row = message.chatButtonRow;
        if (!row || row.id !== params.targetRowId) return message;
        return {
          ...message,
          chatButtonRow: {
            ...row,
            isLocked: true,
            selectedButtonId: params.selectedButtonId,
          },
        };
      })
    );
  };

  const isRowCurrentlyActive = (rowId: string) =>
    messages.some((message) => {
      const row = message.chatButtonRow;
      return row?.id === rowId && row?.isActive === true && row?.isLocked !== true;
    });

  const addInstantAssistantMessage = (content: string, options?: { chatButtonRow?: ChatButtonRowModel | null }) => {
    const normalized = content.replace(/^[\s\r\n]+/, '');
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: normalized,
        displayContent: normalized,
        isTyping: false,
        chatButtonRow: options?.chatButtonRow ?? null,
      },
    ]);
  };

  const appendToLatestAssistantMessage = (content: string) => {
    const normalized = content.replace(/^[\s\r\n]+/, '');
    setMessages((prev) => {
      for (let i = prev.length - 1; i >= 0; i -= 1) {
        const message = prev[i];
        if (message.role !== 'assistant') continue;
        const base = message.content ?? '';
        const suffix = normalized.length > 0 ? `\n\n${normalized}` : '';
        const merged = `${base}${suffix}`;
        const next = [...prev];
        next[i] = {
          ...message,
          content: merged,
          displayContent: merged,
          isTyping: false,
        };
        return next;
      }
      return [
        ...prev,
        {
          role: 'assistant',
          content: normalized,
          displayContent: normalized,
          isTyping: false,
        },
      ];
    });
  };

  const appendToLatestAssistantMessageWithRow = (params: {
    content: string;
    chatButtonRow: ChatButtonRowModel | null;
  }) => {
    const normalized = params.content.replace(/^[\s\r\n]+/, '');
    setMessages((prev) => {
      for (let i = prev.length - 1; i >= 0; i -= 1) {
        const message = prev[i];
        if (message.role !== 'assistant') continue;
        const base = message.content ?? '';
        const suffix = normalized.length > 0 ? `\n\n${normalized}` : '';
        const merged = `${base}${suffix}`;
        const next = [...prev];
        next[i] = {
          ...message,
          content: merged,
          displayContent: merged,
          isTyping: false,
          chatButtonRow: params.chatButtonRow ?? message.chatButtonRow ?? null,
        };
        return next;
      }
      return [
        ...prev,
        {
          role: 'assistant',
          content: normalized,
          displayContent: normalized,
          isTyping: false,
          chatButtonRow: params.chatButtonRow,
        },
      ];
    });
  };

  const getRandomSwapSubmittedMessage = () => {
    const responseList = [...CHAT_BUTTON_ROW_TEMPLATES.CONFIRM_SWAP.responseList] as string[];
    if (responseList.length <= 0) {
      return 'Swap confirmed!';
    }
    const randomIndex = Math.floor(Math.random() * responseList.length);
    return responseList[randomIndex] ?? 'Swap confirmed!';
  };

  const txInfoPanelInChatEnabled = Boolean(
    (TRANSACTION_INFO_PANEL_DISPLAY as { displayLocation?: { inChat?: unknown } }).displayLocation?.inChat
  );

  const evmWalletAddressRef = useRef<string | null>(null);
  evmWalletAddressRef.current = evmWallets[0]?.address?.toLowerCase() ?? null;
  const solanaWalletAddressRef = useRef<string | null>(null);
  solanaWalletAddressRef.current = solanaWallets[0]?.address ?? null;
  const txPanelIdRef = useRef(0);
  const completedSwapBuyAmountsRef = useRef<Map<string, string>>(new Map());
  const pendingSwapSnapshotsRef = useRef<Map<string, { buyBalanceBeforeRaw: string | null; buyTokenDecimals: number | null }>>(new Map());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!txInfoPanelInChatEnabled) return;

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

    const writeSnapshotIfMissing = (sellToken: string, buyToken: string, sellChain: ChainKey, buyChain: ChainKey) => {
      const snapshotKey = `${sellToken}:${buyToken}:${sellChain}`;
      if (pendingSwapSnapshotsRef.current.has(snapshotKey)) {
        return pendingSwapSnapshotsRef.current.get(snapshotKey)!;
      }
      const isSolana = buyChain === 'SOLANA_MAINNET' || buyChain === 'SOLANA_DEVNET';
      const walletForChain = isSolana ? solanaWalletAddressRef.current : evmWalletAddressRef.current;
      const snapshot = readCachedTokenSnapshot({
        chainKey: buyChain,
        walletAddress: walletForChain,
        symbol: buyToken,
      });
      const entry = { buyBalanceBeforeRaw: snapshot.raw, buyTokenDecimals: snapshot.decimals };
      pendingSwapSnapshotsRef.current.set(snapshotKey, entry);
      return entry;
    };

    const handleSwapConfirmedInChat = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        sellToken?: string;
        buyToken?: string;
        sellChain?: ChainKey;
        buyChain?: ChainKey;
        amount?: string;
      } | undefined;
      if (!detail?.sellChain || !detail?.buyChain) return;
      const sellChain = detail.sellChain;
      const buyChain = detail.buyChain;
      const sellToken = (detail.sellToken ?? '').toUpperCase();
      const buyToken = (detail.buyToken ?? '').toUpperCase();
      if (!sellToken || !buyToken) return;

      const snapshotEntry = writeSnapshotIfMissing(sellToken, buyToken, sellChain, buyChain);
      const nextId = txPanelIdRef.current + 1;
      txPanelIdRef.current = nextId;

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '',
          displayContent: '',
          isTyping: false,
          transactionInfoPanel: {
            id: nextId,
            txKey: null,
            txHash: null,
            sellChain,
            buyChain,
            sellToken,
            buyToken,
            sellAmount: detail.amount ?? '',
            buyAmount: null,
            buyBalanceBeforeRaw: snapshotEntry.buyBalanceBeforeRaw,
            buyTokenDecimals: snapshotEntry.buyTokenDecimals,
            status: 'pending',
          },
        },
      ]);
    };

    const handleSwapSubmittedInChat = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        sellToken?: string;
        buyToken?: string;
        sellChain?: ChainKey;
        buyChain?: ChainKey;
        amount?: string;
        txHash?: string;
        requestId?: string;
      } | undefined;
      if (!detail?.sellChain || !detail?.buyChain) return;
      const sellChain = detail.sellChain;
      const buyChain = detail.buyChain;
      const sellToken = (detail.sellToken ?? '').toUpperCase();
      const buyToken = (detail.buyToken ?? '').toUpperCase();
      if (!sellToken || !buyToken) return;
      const txKey = detail.txHash ?? detail.requestId ?? null;

      setMessages((prev) => {
        for (let i = prev.length - 1; i >= 0; i -= 1) {
          const message = prev[i];
          const panel = message.transactionInfoPanel;
          if (!panel) continue;
          if (panel.status !== 'pending') continue;
          if (panel.txKey !== null) continue;
          if (panel.sellToken !== sellToken) continue;
          if (panel.buyToken !== buyToken) continue;
          if (panel.sellChain !== sellChain) continue;
          const next = prev.slice();
          next[i] = {
            ...message,
            transactionInfoPanel: {
              ...panel,
              txKey,
              txHash: detail.txHash ?? null,
              sellAmount: detail.amount ?? panel.sellAmount,
            },
          };
          return next;
        }

        const snapshotEntry = writeSnapshotIfMissing(sellToken, buyToken, sellChain, buyChain);
        const nextId = txPanelIdRef.current + 1;
        txPanelIdRef.current = nextId;
        return [
          ...prev,
          {
            role: 'assistant',
            content: '',
            displayContent: '',
            isTyping: false,
            transactionInfoPanel: {
              id: nextId,
              txKey,
              txHash: detail.txHash ?? null,
              sellChain,
              buyChain,
              sellToken,
              buyToken,
              sellAmount: detail.amount ?? '',
              buyAmount: null,
              buyBalanceBeforeRaw: snapshotEntry.buyBalanceBeforeRaw,
              buyTokenDecimals: snapshotEntry.buyTokenDecimals,
              status: 'pending',
            },
          },
        ];
      });
    };

    const handleSwapCompleteInChat = (event: Event) => {
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

      // Resolve buyAmount synchronously (before setMessages) so executeIntentNow can read it.
      let resolvedBuyAmount: string | null = null;
      let resolvedDecimals: number | null = null;
      if (sellChainFromDetail) {
        const snapshotKey = `${sellToken}:${buyToken}:${sellChainFromDetail}`;
        const snapshotForSwap = pendingSwapSnapshotsRef.current.get(snapshotKey);
        const buyEntry = (detail.balanceUpdates ?? []).find(
          (entry) => (entry.symbol ?? '').toUpperCase() === buyToken
        );
        if (buyEntry?.balanceAfterRaw) {
          resolvedDecimals = snapshotForSwap?.buyTokenDecimals ?? buyEntry.decimals ?? 0;
          resolvedBuyAmount = rawDeltaToHuman(
            buyEntry.balanceAfterRaw,
            snapshotForSwap?.buyBalanceBeforeRaw ?? null,
            resolvedDecimals
          );
          completedSwapBuyAmountsRef.current.set(snapshotKey, resolvedBuyAmount);
          pendingSwapSnapshotsRef.current.delete(snapshotKey);
        }
      }

      setMessages((prev) => {
        let matchedIndex = -1;
        if (txKey) {
          for (let i = prev.length - 1; i >= 0; i -= 1) {
            const panel = prev[i]?.transactionInfoPanel;
            if (!panel) continue;
            if (panel.status !== 'pending') continue;
            if (panel.txKey && panel.txKey === txKey) {
              matchedIndex = i;
              break;
            }
          }
        }
        if (matchedIndex === -1) {
          for (let i = prev.length - 1; i >= 0; i -= 1) {
            const panel = prev[i]?.transactionInfoPanel;
            if (!panel) continue;
            if (panel.status !== 'pending') continue;
            if (panel.sellToken !== sellToken) continue;
            if (panel.buyToken !== buyToken) continue;
            if (sellChainFromDetail && panel.sellChain !== sellChainFromDetail) continue;
            matchedIndex = i;
            break;
          }
        }
        if (matchedIndex === -1) {
          for (let i = prev.length - 1; i >= 0; i -= 1) {
            const panel = prev[i]?.transactionInfoPanel;
            if (!panel) continue;
            if (panel.status !== 'pending') continue;
            if (panel.buyToken !== buyToken) continue;
            matchedIndex = i;
            break;
          }
        }
        if (matchedIndex === -1) {
          console.warn('[TransactionInfoPanel] swap-complete fired with no matching pending in-chat panel', {
            txKey,
            sellToken,
            buyToken,
            sellChainFromDetail,
          });
          return prev;
        }
        const message = prev[matchedIndex];
        const panel = message.transactionInfoPanel!;
        const buyEntry = (detail.balanceUpdates ?? []).find(
          (entry) =>
            (entry.symbol ?? '').toUpperCase() === panel.buyToken &&
            entry.chain === panel.buyChain
        );
        let nextBuyAmount: string | null = panel.buyAmount;
        let nextDecimals = panel.buyTokenDecimals;
        if (buyEntry?.balanceAfterRaw) {
          nextDecimals = panel.buyTokenDecimals ?? buyEntry.decimals ?? 0;
          nextBuyAmount = rawDeltaToHuman(buyEntry.balanceAfterRaw, panel.buyBalanceBeforeRaw, nextDecimals);
        } else if (resolvedBuyAmount) {
          nextBuyAmount = resolvedBuyAmount;
          nextDecimals = resolvedDecimals ?? nextDecimals;
        }
        const next = prev.slice();
        next[matchedIndex] = {
          ...message,
          transactionInfoPanel: {
            ...panel,
            status: 'complete',
            buyAmount: nextBuyAmount,
            buyTokenDecimals: nextDecimals,
            txKey: panel.txKey ?? txKey,
            txHash: panel.txHash ?? (detail.txHash ?? null),
          },
        };
        return next;
      });
    };

    window.addEventListener('altair:swap-confirmed', handleSwapConfirmedInChat);
    window.addEventListener('altair:swap-submitted', handleSwapSubmittedInChat);
    window.addEventListener('altair:swap-complete', handleSwapCompleteInChat);
    return () => {
      window.removeEventListener('altair:swap-confirmed', handleSwapConfirmedInChat);
      window.removeEventListener('altair:swap-submitted', handleSwapSubmittedInChat);
      window.removeEventListener('altair:swap-complete', handleSwapCompleteInChat);
    };
  }, [txInfoPanelInChatEnabled]);

  const txInfoPanelInChatConfig = TRANSACTION_INFO_PANEL_DISPLAY.inChat;
  const txInfoPanelWidth = txInfoPanelInChatConfig.width;
  const txInfoPanelPaddingLeft = txInfoPanelInChatConfig.paddingLeft;
  const txInfoPanelPaddingRight = txInfoPanelInChatConfig.paddingRight;
  const txInfoPanelPaddingTop = txInfoPanelInChatConfig.paddingTop;
  const txInfoPanelPaddingBottom = txInfoPanelInChatConfig.paddingBottom;
  const txInfoPanelCloseConfig = txInfoPanelInChatConfig.x;
  const txInfoPanelClosePaddingTop = txInfoPanelCloseConfig.paddingTop;
  const txInfoPanelClosePaddingRight = txInfoPanelCloseConfig.paddingRight;
  const txInfoPanelCloseSize = txInfoPanelCloseConfig.size;
  const txInfoPanelCloseFontFamily = txInfoPanelCloseConfig.fontName;
  const txInfoPanelArrowConfig = txInfoPanelInChatConfig.arrow;
  const txInfoPanelArrowColor = txInfoPanelArrowConfig.color;
  const txInfoPanelArrowFontSize = txInfoPanelArrowConfig.fontSize;
  const txInfoPanelArrowFontFamily = txInfoPanelArrowConfig.fontName;
  const txResolveAlignItems = (value: string | undefined, fallback: 'flex-start' | 'center' | 'flex-end'): string => {
    const normalized = (value ?? '').toString().trim().toLowerCase();
    if (normalized === 'left' || normalized === 'flex-start' || normalized === 'start') return 'flex-start';
    if (normalized === 'center' || normalized === 'centre') return 'center';
    if (normalized === 'right' || normalized === 'flex-end' || normalized === 'end') return 'flex-end';
    return fallback;
  };
  const txInfoPanelLeftAlignItems = txResolveAlignItems(
    (txInfoPanelInChatConfig as { leftSection?: { alignItems?: string } }).leftSection?.alignItems,
    'flex-start'
  );
  const txInfoPanelRightAlignItems = txResolveAlignItems(
    (txInfoPanelInChatConfig as { rightSection?: { alignItems?: string } }).rightSection?.alignItems,
    'flex-end'
  );
  const txInfoPanelChainNameConfig = txInfoPanelInChatConfig.chainName;
  const txInfoPanelTokenSymbolConfig = txInfoPanelInChatConfig.tokenSymbol;
  const txInfoPanelTokenAmountConfig = txInfoPanelInChatConfig.tokenAmount;
  const txInfoPanelPendingConfig = txInfoPanelInChatConfig.pendingText;
  const txInfoPanelTokenIconsConfig = txInfoPanelInChatConfig.tokenIcons;
  const txInfoPanelStatusTextConfig = (txInfoPanelInChatConfig as { statusText?: Record<string, unknown> }).statusText ?? {};
  const txInfoPanelViewTxConfig = (txInfoPanelInChatConfig as { viewTransaction?: Record<string, unknown> }).viewTransaction ?? {};
  const resolveInChatTokenIconSrc = (symbol: string): string | null => {
    const fileType = typeof txInfoPanelTokenIconsConfig.fileType === 'string' ? txInfoPanelTokenIconsConfig.fileType : 'webp';
    const fileSize = typeof txInfoPanelTokenIconsConfig.fileSize === 'string' ? txInfoPanelTokenIconsConfig.fileSize : '64px';
    if (!symbol) return null;
    return `/image/tokens/${fileType}/${fileSize}/${symbol}.${fileType}`;
  };
  const resolveInChatChainLabel = (chainKey: ChainKey): string => {
    const config = (CHAIN_OPTIONS as Record<string, unknown>)[chainKey] as { transactionPanel?: { inChat?: string; sidePanel?: string } } | undefined;
    return config?.transactionPanel?.inChat ?? String(chainKey);
  };
  const formatInChatAmount = (value: string): string => {
    if (!value) return '0';
    const num = Number(value);
    const decimals = typeof txInfoPanelTokenAmountConfig.decimals === 'number' ? txInfoPanelTokenAmountConfig.decimals : 6;
    if (!Number.isFinite(num)) return value;
    return num.toFixed(decimals).replace(/\.?0+$/, '') || '0';
  };
  const resolveInChatExplorerUrl = (chainKey: ChainKey, txHash: string): string | null => {
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
    return `${explorerBase.replace(/\/+$/, '')}/tx/${txHash}`;
  };
  const renderInChatTransactionInfoPanel = (panel: TransactionInfoPanelState, messageIndex: number) => (
    <TransactionInfoPanel
      panel={panel}
      panelType="transaction-inchat"
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
      chainNameFontSize={txInfoPanelChainNameConfig.fontSize}
      chainNameFontFamily={txInfoPanelChainNameConfig.fontName}
      chainNameColor={txInfoPanelChainNameConfig.color}
      chainNameAllCaps={Boolean(txInfoPanelChainNameConfig.allCaps)}
      chainNameLetterSpacing={txInfoPanelChainNameConfig.letterSpacing ?? '0'}
      chainNamePaddingBottom={txInfoPanelChainNameConfig.paddingBottom}
      tokenSymbolFontSize={txInfoPanelTokenSymbolConfig.fontSize}
      tokenSymbolFontFamily={txInfoPanelTokenSymbolConfig.fontName}
      tokenSymbolColor={txInfoPanelTokenSymbolConfig.color}
      tokenSymbolPaddingTop={txInfoPanelTokenSymbolConfig.paddingTop}
      tokenAmountFontSize={txInfoPanelTokenAmountConfig.fontSize}
      tokenAmountFontFamily={txInfoPanelTokenAmountConfig.fontName}
      tokenAmountColor={txInfoPanelTokenAmountConfig.color}
      tokenAmountDecimals={txInfoPanelTokenAmountConfig.decimals}
      tokenAmountPaddingTop={txInfoPanelTokenAmountConfig.paddingTop}
      pendingLabel={txInfoPanelPendingConfig.label}
      pendingFontStyle={txInfoPanelPendingConfig.fontStyle}
      pendingColor={txInfoPanelPendingConfig.color}
      tokenIconSize={Number(txInfoPanelTokenIconsConfig.size)}
      tokenIconBorderPosition={typeof txInfoPanelTokenIconsConfig.borderPosition === 'string' ? txInfoPanelTokenIconsConfig.borderPosition : 'inner'}
      tokenIconBorderColor={typeof txInfoPanelTokenIconsConfig.borderColor === 'string' ? txInfoPanelTokenIconsConfig.borderColor : null}
      tokenIconBorderWidth={typeof txInfoPanelTokenIconsConfig.borderWidth === 'number' ? txInfoPanelTokenIconsConfig.borderWidth : null}
      tokenIconPlaceholderColor={typeof txInfoPanelTokenIconsConfig.placeholderColor === 'string' ? txInfoPanelTokenIconsConfig.placeholderColor : '#1F2937'}
      tokenIconPlaceholderFontColor={typeof txInfoPanelTokenIconsConfig.placeholderFontColor === 'string' ? txInfoPanelTokenIconsConfig.placeholderFontColor : '#d1d5db'}
      tokenIconPlaceholderFontSize={typeof txInfoPanelTokenIconsConfig.placeholderFontSize === 'number' ? txInfoPanelTokenIconsConfig.placeholderFontSize : 18}
      tokenIconSpinEnabled={Boolean(txInfoPanelTokenIconsConfig.spin)}
      statusExecutingLabel={typeof txInfoPanelStatusTextConfig.executingLabel === 'string' ? txInfoPanelStatusTextConfig.executingLabel : 'Executing'}
      statusExecutedLabel={typeof txInfoPanelStatusTextConfig.executedLabel === 'string' ? txInfoPanelStatusTextConfig.executedLabel : 'Executed'}
      statusFontSize={typeof txInfoPanelStatusTextConfig.fontSize === 'number' ? txInfoPanelStatusTextConfig.fontSize : 12}
      statusFontFamily={typeof txInfoPanelStatusTextConfig.fontName === 'string' ? txInfoPanelStatusTextConfig.fontName : 'sans-serif'}
      statusExecutingFontStyle={typeof txInfoPanelStatusTextConfig.executingFontStyle === 'string' ? txInfoPanelStatusTextConfig.executingFontStyle : 'italic'}
      statusExecutedFontStyle={typeof txInfoPanelStatusTextConfig.executedFontStyle === 'string' ? txInfoPanelStatusTextConfig.executedFontStyle : 'normal'}
      statusExecutingColor={typeof txInfoPanelStatusTextConfig.executingColor === 'string' ? txInfoPanelStatusTextConfig.executingColor : '#9ca3af'}
      statusExecutedColor={typeof txInfoPanelStatusTextConfig.executedColor === 'string' ? txInfoPanelStatusTextConfig.executedColor : '#d1d5db'}
      statusPaddingBottom={typeof txInfoPanelStatusTextConfig.paddingBottom === 'number' ? txInfoPanelStatusTextConfig.paddingBottom : 2}
      viewTransactionLabel={typeof txInfoPanelViewTxConfig.label === 'string' ? txInfoPanelViewTxConfig.label : 'View Transaction'}
      viewTransactionFontSize={typeof txInfoPanelViewTxConfig.fontSize === 'number' ? txInfoPanelViewTxConfig.fontSize : 11}
      viewTransactionFontFamily={typeof txInfoPanelViewTxConfig.fontName === 'string' ? txInfoPanelViewTxConfig.fontName : 'sans-serif'}
      viewTransactionColor={typeof txInfoPanelViewTxConfig.color === 'string' ? txInfoPanelViewTxConfig.color : '#60a5fa'}
      viewTransactionHighlightColor={typeof txInfoPanelViewTxConfig.highlightColor === 'string' ? txInfoPanelViewTxConfig.highlightColor : '#93c5fd'}
      viewTransactionPaddingTop={typeof txInfoPanelViewTxConfig.paddingTop === 'number' ? txInfoPanelViewTxConfig.paddingTop : 2}
      viewTransactionUnderline={Boolean(txInfoPanelViewTxConfig.underline)}
      resolveTransactionUrl={resolveInChatExplorerUrl}
      resolveTokenIconSrc={resolveInChatTokenIconSrc}
      resolveChainLabel={resolveInChatChainLabel}
      formatAmount={formatInChatAmount}
      onClose={() => {
        setMessages((prev) => {
          const target = prev[messageIndex];
          if (!target) return prev;
          const isPanelOnly = !target.content && (!target.displayContent || target.displayContent.length === 0);
          if (isPanelOnly) {
            return prev.filter((_, idx) => idx !== messageIndex);
          }
          const next = [...prev];
          next[messageIndex] = { ...target, transactionInfoPanel: null };
          return next;
        });
      }}
    />
  );

  const requestChatResponse = async (params: {
    userMessage: string;
    history: Message[];
    clientRequestId: string;
  }): Promise<{ content: string; zgHash?: string | null; zgError?: string | null; cid?: string | null }> => {
    const { userMessage, history, clientRequestId } = params;
    const privyAccessToken = authenticated
      ? await withWaitLogger(
          {
            file: 'altair_frontend1/src/components/Chat.tsx',
            target: 'Privy getAccessToken',
            description: 'access token for chat request',
          },
          () => getCachedPrivyAccessToken(getAccessToken)
        )
      : null;
    const backendUrl = getBackendBaseUrl();

    console.log('[0G][frontend] chat request', {
      backendUrl,
      messageBytes: new TextEncoder().encode(userMessage).length,
      historyCount: history.length,
      hasAccessToken: Boolean(privyAccessToken),
    });

    const response = await withWaitLogger(
      {
        file: 'altair_frontend1/src/components/Chat.tsx',
        target: '/api/chat',
        description: 'chat response',
      },
      () =>
        fetch(`${backendUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage,
            history: history.map((m) => ({ role: m.role, content: m.content })),
            accessToken: privyAccessToken ?? null,
            selectedChain: resolveSelectedChain(),
            solanaAddress: solanaWallets?.[0]?.address ?? null,
            clientRequestId,
          }),
        })
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Chat request failed with status ${response.status}: ${errorText}`);
    }

    const responseText = await withWaitLogger(
      {
        file: 'altair_frontend1/src/components/Chat.tsx',
        target: 'chat response.text()',
        description: 'read chat response body',
      },
      () => response.text()
    );

    let data: { content?: string; zgHash?: string | null; zgError?: string | null; cid?: string | null } = {};
    try {
      data = JSON.parse(responseText) as { content?: string; zgHash?: string | null; zgError?: string | null; cid?: string | null };
    } catch {
      throw new Error(`Chat response was not valid JSON: ${responseText}`);
    }

    const content = typeof data.content === 'string' ? data.content : '';
    console.log('[0G][frontend] chat response', {
      zgHash: data?.zgHash ?? null,
      zgError: data?.zgError ?? null,
      hasContent: typeof data?.content === 'string',
    });

    return {
      content,
      zgHash: data.zgHash,
      zgError: data.zgError,
      cid: data.cid ?? null,
    };
  };

  const setOnlyLatestActiveRow = (nextRowId: string | null) => {
    setMessages((prev) =>
      prev.map((message) => {
        const row = message.chatButtonRow;
        if (!row) return message;
        return {
          ...message,
          chatButtonRow: {
            ...row,
            isActive: nextRowId !== null && row.id === nextRowId,
          },
        };
      })
    );
  };

  const sendPromptToChat = async (params: {
    userMessage: string;
    appendUserMessage: boolean;
    allowAutoExecution: boolean;
  }) => {
    const { userMessage, appendUserMessage, allowAutoExecution } = params;
    if (sendInFlightRef.current) {
      return;
    }
    sendInFlightRef.current = true;
    const historySnapshot = messages;
    const clientRequestId = createClientRequestId();
    if (inFlightClientRequestIdsRef.current.has(clientRequestId)) {
      sendInFlightRef.current = false;
      return;
    }
    inFlightClientRequestIdsRef.current.add(clientRequestId);

    if (appendUserMessage) {
      setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    }

    setIsLoading(true);
    try {
      const data = await requestChatResponse({ userMessage, history: historySnapshot, clientRequestId });
      const intent = extractSwapIntent(data.content);
      
      // Dispatch swap-initiated event when AI generates a swap intent
      if (intent && intent.type) {
        const selectedChain = resolveIntentChain(intent);
        
        // Helper to normalize chain string to ChainKey
        const normalizeToChainKey = (chainStr: string | null | undefined, fallback: ChainKey): ChainKey => {
          if (!chainStr) return fallback;
          const chainKeys = Object.keys(CHAINS) as ChainKey[];
          if (chainKeys.includes(chainStr as ChainKey)) return chainStr as ChainKey;
          const normalized = chainStr.trim().toUpperCase();
          if (chainKeys.includes(normalized as ChainKey)) return normalized as ChainKey;
          return fallback;
        };
        
        dispatchSwapInitiated({
          sellToken: intent.sell?.toUpperCase() || '',
          buyToken: intent.buy?.toUpperCase() || '',
          sellChain: normalizeToChainKey(intent.sellTokenChain, selectedChain),
          buyChain: normalizeToChainKey(intent.buyTokenChain, selectedChain),
          amount: intent.amount?.toString() || '',
          intentType: intent.type,
          timestamp: Date.now(),
        });
      }
      
      if (intent && intent.type === 'SINGLE_CHAIN_SWAP_INTENT') {
        await prefetchSolanaTokensForIntent(intent);
      }

      let executionNote: string | null = null;
      if (allowAutoExecution) {
        executionNote = await maybeExecuteSwapIntent(intent, data?.cid ?? null, userMessage);
      }

      const chatButtonRow = executionNote
        ? null
        : buildChatButtonRowFromIntent({
            intent,
            cid: data?.cid ?? null,
          });

      if (chatButtonRow) {
        console.log('[ChatButtonRow] row attached', {
          rowId: chatButtonRow.id,
          template: chatButtonRow.template,
          buttonCount: chatButtonRow.buttons.length,
        });
      }

      setMessages((prev) => {
        const withInactiveRows = prev.map((message) => {
          const row = message.chatButtonRow;
          if (!row?.isActive) return message;
          return {
            ...message,
            chatButtonRow: {
              ...row,
              isActive: false,
              isLocked: true,
            },
          };
        });

        if (executionNote) {
          const normalizedExecution = executionNote.replace(/^[\s\r\n]+/, '');
          return [
            ...withInactiveRows,
            { role: 'assistant', content: normalizedExecution, displayContent: '', isTyping: true },
          ];
        }

        const normalized = stripIntentJson(data.content).replace(/^[\s\r\n]+/, '');
        return [
          ...withInactiveRows,
          {
            role: 'assistant',
            content: normalized,
            displayContent: '',
            isTyping: true,
            zgHash: data.zgHash,
            zgError: data.zgError,
            cid: data?.cid ?? null,
            chatButtonRow,
          },
        ];
      });

      setOnlyLatestActiveRow(chatButtonRow?.id ?? null);
    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      inFlightClientRequestIdsRef.current.delete(clientRequestId);
      sendInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const handleChatButtonRowAction = async (button: ChatButtonItem, row: ChatButtonRowModel) => {
    const inFlightKey = `${row.id}:${button.id}`;
    if (row.isActive === false || row.isLocked === true) return;
    if (!isRowCurrentlyActive(row.id)) return;
    if (rowActionsInFlightRef.current.has(inFlightKey)) return;

    rowActionsInFlightRef.current.add(inFlightKey);

    console.log('[ChatButtonRow] action click (lock-only mode)', {
      rowId: row.id,
      template: row.template,
      buttonId: button.id,
      buttonLabel: button.label,
      actionKind: button.action.kind,
    });

    lockChatButtonRow({ targetRowId: row.id, selectedButtonId: button.id });

    try {
      if (button.action.kind === 'RUN_LOCAL') {
        const instantMessage = button.action.actionId === 'CONFIRM_SWAP'
          ? getRandomSwapSubmittedMessage()
          : button.action.presetAssistantMessage;
        addInstantAssistantMessage(instantMessage);
        if (button.action.actionId === 'CANCEL_SWAP') {
          setPendingIntent(null);
          console.log('[ChatButtonRow] action cancel swap', { rowId: row.id });
          return;
        }
        if (button.action.actionId === 'CONFIRM_SWAP') {
          const intent = row.context?.intent as ExecutableSwapIntent | null | undefined;
          if (!intent) return;
          const confirmedMeta = deriveConfirmedSwapMeta(intent);
          if (confirmedMeta) {
            dispatchSwapConfirmed({
              ...confirmedMeta,
              timestamp: Date.now(),
            });
          }
          const execution = await executeIntentNow(intent, row.context?.cid ?? null);
          if (execution) {
            const swapFollowupRow = buildChatButtonRowFromLogicTrigger({
              trigger: 'TRANSACTION_SUBMITTED',
              intent,
              cid: row.context?.cid ?? null,
            });
            addInstantAssistantMessage(execution, { chatButtonRow: swapFollowupRow });
            if (swapFollowupRow) {
              setOnlyLatestActiveRow(swapFollowupRow.id);
            }
          }
          return;
        }

        if (button.action.actionId === 'START_EARNING') {
          addInstantAssistantMessage('Start Earning flow is not wired yet. Placeholder response.');
          return;
        }

        if (button.action.actionId === 'LEARN_MORE') {
          addInstantAssistantMessage('Learn More flow is not wired yet. Placeholder response.');
          return;
        }

        return;
      }

      if (button.action.kind === 'ASK_LLM') {
        console.log('[ChatButtonRow] action ask llm', {
          rowId: row.id,
          promptSeed: button.action.promptSeed,
        });
        await sendPromptToChat({
          userMessage: button.action.promptSeed,
          appendUserMessage: false,
          allowAutoExecution: false,
        });
      }
    } finally {
      rowActionsInFlightRef.current.delete(inFlightKey);
    }
  };

  const getLatestActiveConfirmSwapRow = (): ChatButtonRowModel | null => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const row = messages[i]?.chatButtonRow;
      if (!row) continue;
      if (row.template !== 'CONFIRM_SWAP') continue;
      if (row.isActive === false) continue;
      if (row.isLocked === true) continue;
      return row;
    }
    return null;
  };

  const triggerChatButtonRowActionById = async (params: {
    row: ChatButtonRowModel;
    buttonId: string;
  }) => {
    const button = params.row.buttons.find((entry) => entry.id === params.buttonId);
    if (!button) return;
    await handleChatButtonRowAction(button, params.row);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || isExecutingSwap) return;

    const userMessage = input;
    setInput('');
    await sendPromptToChat({ userMessage, appendUserMessage: true, allowAutoExecution: true });
  };

  return (
    <div
      className="w-full rounded-2xl flex flex-col shadow-2xl backdrop-blur-sm"
      style={{
        backgroundColor: CHAT_PANEL.container_color,
        borderColor: CHAT_PANEL.border_color,
        borderWidth: `${CHAT_PANEL.border_width}px`,
        borderStyle: 'solid',
        boxSizing: 'content-box',
        width: `${CHAT_PANEL.width}px`,
        height: `${CHAT_PANEL.height}px`,
      }}
    >
      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
        {messages.length === 0 && (
          <p className="text-gray-500 text-center mt-20">Ask me to swap ETH for USDC or check your balance...</p>
        )}
        {messages.map((m, i) => (
          m.role === 'assistant' ? (
            <div key={i} className="flex items-start gap-3">
                <div
                  className="shrink-0 h-10 w-10 rounded-full bg-white/5 border flex items-center justify-center overflow-hidden"
                  style={{ borderColor: CHAT_PANEL.agent_icon_border_color }}
                >
                <SpinningLogo src={logoAsset} alt="Altair" className="h-9 w-9 object-contain" />
              </div>
              <div className="flex w-full flex-col items-start">
                {m.transactionInfoPanel && (!m.displayContent || m.displayContent.length === 0) && !m.content ? (
                  txInfoPanelInChatEnabled ? renderInChatTransactionInfoPanel(m.transactionInfoPanel, i) : null
                ) : (
                  <>
                    <div
                      className="px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words"
                      style={{
                        backgroundColor: CHAT_PANEL.agent_chat_container_color,
                        color: CHAT_PANEL.agent_chat_text_color,
                        width: CHAT_PANEL.agentChatWidth,
                        overflowWrap: 'break-word',
                        wordBreak: 'normal',
                      }}
                    >
                      {m.role === 'assistant' ? (m.displayContent ?? '') : m.content}
                    {m.chatButtonRow && (
                      <ChatButtonRow
                        row={m.chatButtonRow}
                        disabled={isLoading || isExecutingSwap}
                        onAction={handleChatButtonRowAction}
                      />
                      )}
                    </div>
                    {m.zgHash && !m.zgError && (
                      <div className="flex items-center gap-2 mt-1">
                        <a
                          href={`https://scan-testnet.0g.ai/tx/${m.zgHash}`}
                          target="_blank"
                          className="flex items-center gap-1 text-[10px] text-green-500 hover:underline"
                        >
                          <ShieldCheck className="w-3 h-3" />
                          Verified by 0g
                        </a>
                      </div>
                    )}
                    {m.zgError && (
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-yellow-400">
                        0G upload failed
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div key={i} className="flex flex-col items-end">
              <div
                className="px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words"
                style={{
                  backgroundColor: CHAT_PANEL.user_chat_container_color,
                  color: CHAT_PANEL.user_chat_text_color,
                  maxWidth: CHAT_PANEL.userChatMaxWidth,
                  overflowWrap: 'break-word',
                  wordBreak: 'normal',
                }}
              >
                {m.content}
              </div>
            </div>
          )
        ))}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="shrink-0 h-10 w-10 rounded-full bg-white/5 border border-gray-700 flex items-center justify-center overflow-hidden">
              <SpinningLogo src={logoAsset} alt="Altair" className="h-9 w-9 object-contain" />
            </div>
            <div className="bg-gray-800 p-3 rounded-2xl animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div
        className="p-4 border-t flex gap-2"
        style={{
          borderColor: CHAT_PANEL.border_color,
          borderTopWidth: `${CHAT_PANEL.border_width}px`,
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              const row = getLatestActiveConfirmSwapRow();
              if (!row) return;
              e.preventDefault();
              void triggerChatButtonRowActionById({ row, buttonId: 'cancel' });
              return;
            }

            if (e.key === 'Enter') {
              if (!input.trim()) {
                const row = getLatestActiveConfirmSwapRow();
                if (!row) return;
                e.preventDefault();
                void triggerChatButtonRowActionById({ row, buttonId: 'confirm' });
                return;
              }
              void handleSendMessage();
            }
          }}
          placeholder="I want to swap 0.1 ETH for USDC..."
          className="flex-1 bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-[var(--chat-highlight-color)] transition-colors"
          style={{ ['--chat-highlight-color' as never]: CHAT_PANEL.chat_highlight_color }}
        />
        <button 
          onClick={handleSendMessage}
          disabled={isLoading || isExecutingSwap}
          className="disabled:opacity-50 p-2 rounded-xl transition-all cursor-pointer"
          style={{ backgroundColor: CHAT_PANEL.chat_button_container_color }}
        >
          <Send className="w-5 h-5" color={CHAT_PANEL.chat_button_icon_color} />
        </button>
      </div>
    </div>
  );
}
