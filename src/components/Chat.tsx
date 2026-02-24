'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { SpinningLogo } from './SpinningLogo';
import { ShieldCheck, Send, Loader2 } from 'lucide-react';
import Logo from '../image/logo.png';
import { usePrivy } from '@privy-io/react-auth';
import { useSwap } from '../lib/useSwap';
import { CHAT_PANEL } from '../../config/ui_config';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  zgHash?: string | null;
  zgError?: string | null;
}

interface SwapIntent {
  type: 'SWAP_INTENT';
  sell: string;
  buy: string;
  amount: number | string;
}

export default function Chat() {
  const { authenticated, getAccessToken } = usePrivy();
  const executeSwap = useSwap();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExecutingSwap, setIsExecutingSwap] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const extractSwapIntent = (text: string): SwapIntent | null => {
    const trimmed = text.trim();
    const parseCandidate = (candidate: string) => {
      try {
        const parsed = JSON.parse(candidate) as SwapIntent;
        return parsed?.type === 'SWAP_INTENT' ? parsed : null;
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

    // JSON inside markdown code block (e.g. ```json ... ```)
    const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      const inner = codeBlockMatch[1].trim();
      const innerFirst = inner.indexOf('{');
      const innerLast = inner.lastIndexOf('}');
      if (innerFirst >= 0 && innerLast > innerFirst) {
        return parseCandidate(inner.slice(innerFirst, innerLast + 1));
      }
    }

    return null;
  };


  const maybeExecuteSwapIntent = async (aiResponse: string, accessToken: string | null) => {
    const intent = extractSwapIntent(aiResponse);
    if (!intent || intent.type !== 'SWAP_INTENT') return null;

    const sell = intent.sell?.toUpperCase();
    const buy = intent.buy?.toUpperCase();
    const amount = typeof intent.amount === 'number' ? intent.amount.toString() : intent.amount;

    if (!amount || Number(amount) <= 0) {
      return null;
    }

    setIsExecutingSwap(true);
    try {
      // Supported pairs (must match /api/test-swap: ETH, WETH, USDC, USDT, DAI in any direction)
      const txHash = await executeSwap(sell, amount, buy);
      const chain =
        (typeof window !== 'undefined' && localStorage.getItem('selectedChain')) || 'BASE_SEPOLIA';
      if (accessToken) {
        try {
          await fetch('/api/record-swap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              accessToken,
              chain,
              sellToken: sell,
              buyToken: buy,
              sellAmount: amount,
              txHash,
            }),
          });
        } catch (e) {
          console.warn('[record-swap] failed', e);
        }
      }
      const action =
        sell === 'ETH' && buy === 'WETH' ? 'wrapped' : 'swapped';
      return `Swap executed: ${action} ${amount} ${sell} for ${buy}.\n${txHash}`;
    } catch (err) {
      console.error('[Swap execution failed]', err);
      const rawMsg = err instanceof Error ? err.message : 'Swap failed';
      const isInsufficientFunds =
        rawMsg.toLowerCase().includes('insufficient funds') ||
        (err as { code?: string })?.code === 'INSUFFICIENT_FUNDS';
      const isReplacementUnderpriced =
        rawMsg.toLowerCase().includes('replacement') ||
        rawMsg.toLowerCase().includes('underpriced') ||
        (err as { code?: string })?.code === 'REPLACEMENT_UNDERPRICED';
      let msg = rawMsg;
      if (isInsufficientFunds) {
        msg =
          "Your wallet doesn't have enough ETH on this network (for the swap and gas). Get testnet ETH from a faucet (Base Sepolia) or add more ETH on mainnet.";
      } else if (isReplacementUnderpriced) {
        msg =
          'A previous transaction may still be pending. Wait a minute and try again, or use Base Sepolia testnet (network selector → Base Testnet) to test with faucet ETH.';
      }
      return `Swap could not be executed: ${msg}`;
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
      // Prefer Privy SDK access token (refreshes if needed); fallback to localStorage for legacy/cookie-only flows
      let accessToken: string | null = null;
      if (authenticated && typeof getAccessToken === 'function') {
        try {
          accessToken = (await getAccessToken()) ?? null;
        } catch {
          accessToken = null;
        }
      }
      if (!accessToken && typeof window !== 'undefined') {
        accessToken = localStorage.getItem('privy:token');
      }
      console.log('[0G][frontend] chat request', {
        backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001',
        messageBytes: new TextEncoder().encode(userMessage).length,
        historyCount: messages.length,
        hasAccessToken: Boolean(accessToken),
      });
      const maxAttempts = 3;
      let response: Response | null = null;
      let lastError: unknown = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              message: userMessage,
              history: messages.map(m => ({ role: m.role, content: m.content })),
              accessToken,
            }),
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Chat request failed with status ${response.status}: ${errorText}`);
          }
          break;
        } catch (err) {
          lastError = err;
          console.warn('[0G][frontend] chat request failed', { attempt, error: err });
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          }
        }
      }

      if (!response) {
        throw lastError ?? new Error('Chat request failed after retries');
      }

      const responseText = await response.text();
      let data: { content?: string; zgHash?: string | null; zgError?: string | null } = {};
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
      
      const executionNote = await maybeExecuteSwapIntent(content, accessToken);
      if (executionNote) {
        console.log('[Swap Intent]', data.content);
      }

      setMessages((prev) => {
        if (executionNote) {
          return [...prev, { role: 'assistant', content: executionNote }];
        }

        return [
          ...prev,
            {
              role: 'assistant',
              content,
              zgHash: data.zgHash,
              zgError: data.zgError,
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
                <SpinningLogo src={Logo} alt="Altair" className="h-9 w-9 object-contain" />
              </div>
              <div className="flex flex-col items-start">
                <div
                  className="max-w-[85%] px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words"
                  style={{
                    backgroundColor: CHAT_PANEL.agent_chat_container_color,
                    color: CHAT_PANEL.agent_chat_text_color,
                  }}
                >
                  {m.content}
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
                className="max-w-[85%] px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words"
                style={{
                  backgroundColor: CHAT_PANEL.user_chat_container_color,
                  color: CHAT_PANEL.user_chat_text_color,
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
              <SpinningLogo src={Logo} alt="Altair" className="h-9 w-9 object-contain" />
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
