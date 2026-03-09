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

interface Message {
  role: 'user' | 'assistant';
  content: string;
  displayContent?: string;
  isTyping?: boolean;
  zgHash?: string | null;
  zgError?: string | null;
  cid?: string | null;
}

interface SwapIntent {
  type: 'SINGLE_CHAIN_SWAP_INTENT' | 'CROSS_CHAIN_SWAP_INTENT' | 'BRIDGE_INTENT';
  sell: string;
  buy?: string;
  amount: number | string;
  sellTokenChain?: string | null;
  buyTokenChain?: string | null;
}

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
    if (!effectiveIntent) {
      return null;
    }
    setPendingIntent(null);

    const sell = effectiveIntent.sell?.toUpperCase();
    const buy = effectiveIntent.buy?.toUpperCase();
    const amount = typeof effectiveIntent.amount === 'number' ? effectiveIntent.amount.toString() : effectiveIntent.amount;

    if (!sell) {
      return null;
    }

    if (!amount || Number(amount) <= 0) {
      return null;
    }

    if (effectiveIntent.type === 'BRIDGE_INTENT' || effectiveIntent.type === 'CROSS_CHAIN_SWAP_INTENT') {
      if (!effectiveIntent.sellTokenChain || !effectiveIntent.buyTokenChain) {
        return null;
      }
      const relayResult = await executeRelay({
        type: effectiveIntent.type,
        sell,
        buy,
        amount,
        sellTokenChain: effectiveIntent.sellTokenChain,
        buyTokenChain: effectiveIntent.buyTokenChain,
      }, cid ?? null);
      return `Relay request submitted: ${relayResult.requestId ?? 'pending'}`;
    }

    if (!buy) {
      return null;
    }

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
      const action = normalizedSell === 'ETH' && normalizedBuy === 'WETH'
        ? 'wrapped'
        : 'swapped';
      return `Swap executed: ${action} ${amount} ${normalizedSell} for ${buyAmount} ${normalizedBuy}.\n${txHash}`;
    } finally {
      setIsExecutingSwap(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || isExecutingSwap) return;

    const userMessage = input;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
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
        historyCount: messages.length,
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
                  history: messages.map(m => ({ role: m.role, content: m.content })),
                  // Include Privy access token for backend verification
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
        data = JSON.parse(responseText) as { content?: string; zgHash?: string | null; zgError?: string | null };
      } catch (err) {
        throw new Error(`Chat response was not valid JSON: ${responseText}`);
      }
      const content = typeof data.content === 'string' ? data.content : '';
      console.log('[0G][frontend] chat response', {
        zgHash: data?.zgHash ?? null,
        zgError: data?.zgError ?? null,
        hasContent: typeof data?.content === 'string',
      });

      const intent = extractSwapIntent(content);
      if (intent && intent.type === 'SINGLE_CHAIN_SWAP_INTENT') {
        await prefetchSolanaTokensForIntent(intent);
      }

      const executionNote = await maybeExecuteSwapIntent(intent, data?.cid ?? null, userMessage);
      if (executionNote) {
        console.log('[Swap Intent]', data.content);
      }

      setMessages((prev) => {
        if (executionNote) {
          const normalized = executionNote.replace(/^[\s\r\n]+/, '');
          return [
            ...prev,
            { role: 'assistant', content: normalized, displayContent: '', isTyping: true },
          ];
        }

        const normalized = stripIntentJson(content).replace(/^[\s\r\n]+/, '');
        return [
          ...prev,
          {
            role: 'assistant',
            content: normalized,
            displayContent: '',
            isTyping: true,
            zgHash: data.zgHash,
            zgError: data.zgError,
            cid: data?.cid ?? null,
          },
        ];
      });
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
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
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
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
