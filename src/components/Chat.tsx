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
import { BLOCKCHAIN, CHAINS, type ChainKey } from '../../config/blockchain_config';
import * as SolanaTokens from '../../config/token_info/solana_tokens';
import { CHAT_PANEL } from '../../config/ui_config';
import { CHAT_BUTTON_ROW_TEMPLATES } from '../../config/ai_config';
import {
  buildChatButtonRowFromIntent,
  buildChatButtonRowFromLogicTrigger,
  type ChatButtonItem,
  type ChatButtonRowModel,
  type ChatSwapIntent,
} from '../lib/chatButtonRows';
import ChatButtonRow from './ChatButtonRow';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  displayContent?: string;
  isTyping?: boolean;
  zgHash?: string | null;
  zgError?: string | null;
  cid?: string | null;
  chatButtonRow?: ChatButtonRowModel | null;
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
  const typingSpeedMs = CHAT_PANEL.typingSpeedMs;
  const logoAsset = useLogoAsset();

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
                fetch('/api/token-mint', {
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
                fetch('/api/token-mint', {
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
      const result =
        selectedChain === 'SOLANA_MAINNET'
          ? await executeSolanaSwap(normalizedSell, amount, normalizedBuy, cid)
          : await executeSwap(sell, amount, buy, cid);
      const { txHash, buyAmount } =
        selectedChain === 'SOLANA_MAINNET'
          ? { txHash: result as string, buyAmount: 'unknown' }
          : { txHash: result as string, buyAmount: 'unknown' };
      const action = 'swapped';
      console.log('[ChatButtonRow] executeIntentNow swap success', {
        action,
        amount,
        sell: normalizedSell,
        buy: normalizedBuy,
      });
      return `Swap executed: ${action} ${amount} ${normalizedSell} for ${buyAmount} ${normalizedBuy}.\n${txHash}`;
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

  const addInstantAssistantMessage = (content: string) => {
    const normalized = content.replace(/^[\s\r\n]+/, '');
    setMessages((prev) => [
      ...prev,
      {
        role: 'assistant',
        content: normalized,
        displayContent: normalized,
        isTyping: false,
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

  const requestChatResponse = async (params: {
    userMessage: string;
    history: Message[];
  }): Promise<{ content: string; zgHash?: string | null; zgError?: string | null; cid?: string | null }> => {
    const { userMessage, history } = params;
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

    const maxAttempts = 3;
    let response: Response | null = null;
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        response = await withWaitLogger(
          {
            file: 'altair_frontend1/src/components/Chat.tsx',
            target: '/api/chat',
            description: 'chat response',
          },
          () =>
            fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: userMessage,
                history: history.map((m) => ({ role: m.role, content: m.content })),
                accessToken: privyAccessToken ?? null,
                selectedChain: resolveSelectedChain(),
                solanaAddress: solanaWallets?.[0]?.address ?? null,
              }),
            })
        );
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Chat request failed with status ${response.status}: ${errorText}`);
        }
        break;
      } catch (err) {
        lastError = err;
        console.warn('[0G][frontend] chat request failed', { attempt, error: err });
        if (attempt < maxAttempts) {
          await withWaitLogger(
            {
              file: 'altair_frontend1/src/components/Chat.tsx',
              target: 'retry backoff',
              description: `waiting before chat retry ${attempt + 1}`,
            },
            () => new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
          );
        }
      }
    }

    if (!response) {
      throw lastError ?? new Error('Chat request failed after retries');
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
    const historySnapshot = messages;

    if (appendUserMessage) {
      setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    }

    setIsLoading(true);
    try {
      const data = await requestChatResponse({ userMessage, history: historySnapshot });
      const intent = extractSwapIntent(data.content);
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
          const execution = await executeIntentNow(intent, row.context?.cid ?? null);
          if (execution) {
            const swapFollowupRow = buildChatButtonRowFromLogicTrigger({
              trigger: 'TRANSACTION_SUBMITTED',
              intent,
              cid: row.context?.cid ?? null,
            });
            appendToLatestAssistantMessageWithRow({
              content: execution,
              chatButtonRow: swapFollowupRow,
            });
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
