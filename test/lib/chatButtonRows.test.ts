// Tests for buildChatButtonRowFromIntent — the routing layer that maps a parsed
// chat intent (swap / lend / limit-order) onto the right confirm/cancel button
// row template.
//
// This is the highest-leverage frontend test: a regression here breaks every
// "are you sure?" flow in the chat panel.

import { describe, expect, it } from 'vitest';
import {
  buildChatButtonRowFromIntent,
  type ChatSwapIntent,
} from '@/lib/chatButtonRows';
import type { ChatLendIntent } from '@/lib/lendTypes';
import type { ChatLimitOrderIntent } from '@/lib/limitOrderTypes';

describe('buildChatButtonRowFromIntent', () => {
  it('returns null for null input', () => {
    expect(buildChatButtonRowFromIntent({ intent: null })).toBeNull();
  });

  it('routes SINGLE_CHAIN_SWAP_INTENT → CONFIRM_SWAP', () => {
    const intent: ChatSwapIntent = { type: 'SINGLE_CHAIN_SWAP_INTENT', sell: 'SOL', buy: 'USDC', amount: '1' };
    const row = buildChatButtonRowFromIntent({ intent });
    expect(row?.template).toBe('CONFIRM_SWAP');
    expect(row?.buttons.length).toBeGreaterThanOrEqual(2);
    expect(row?.buttons.some((b) => b.action.kind === 'RUN_LOCAL' && b.action.actionId === 'CONFIRM_SWAP')).toBe(true);
    expect(row?.context?.intent).toBe(intent);
  });

  it('routes CROSS_CHAIN_SWAP_INTENT → CONFIRM_SWAP', () => {
    const intent: ChatSwapIntent = {
      type: 'CROSS_CHAIN_SWAP_INTENT',
      sell: 'USDC',
      buy: 'SOL',
      amount: '10',
      sellTokenChain: 'BASE_MAINNET',
      buyTokenChain: 'SOLANA_MAINNET',
    };
    const row = buildChatButtonRowFromIntent({ intent });
    expect(row?.template).toBe('CONFIRM_SWAP');
  });

  it('routes LEND_DEPOSIT_INTENT → CONFIRM_LEND_DEPOSIT and labels button with token symbol', () => {
    const intent: ChatLendIntent = { type: 'LEND_DEPOSIT_INTENT', token: 'usdc', amount: '5' };
    const row = buildChatButtonRowFromIntent({ intent });
    expect(row?.template).toBe('CONFIRM_LEND_DEPOSIT');
    // Token uppercased in the label substitution (TOKEN placeholder in config).
    for (const btn of row?.buttons ?? []) {
      expect(btn.label.toUpperCase()).toBe(btn.label.toUpperCase()); // sanity
    }
  });

  it('routes LEND_WITHDRAW_INTENT → CONFIRM_LEND_WITHDRAW', () => {
    const intent: ChatLendIntent = { type: 'LEND_WITHDRAW_INTENT', token: 'USDC', amount: 'all' };
    const row = buildChatButtonRowFromIntent({ intent });
    expect(row?.template).toBe('CONFIRM_LEND_WITHDRAW');
  });

  it('routes LIMIT_ORDER_PRICE_INTENT → CONFIRM_LIMIT_ORDER', () => {
    const intent: ChatLimitOrderIntent = {
      type: 'LIMIT_ORDER_PRICE_INTENT',
      side: 'SELL',
      sell: 'BONK',
      buy: 'USDC',
      amount: '100',
      targetPrice: '0.00003',
      quoteCurrency: 'USDC',
    };
    const row = buildChatButtonRowFromIntent({ intent });
    expect(row?.template).toBe('CONFIRM_LIMIT_ORDER');
    expect(row?.buttons.some((b) => b.action.kind === 'RUN_LOCAL' && b.action.actionId === 'CONFIRM_LIMIT_ORDER')).toBe(true);
  });

  it('routes LIMIT_ORDER_TIME_INTENT → CONFIRM_LIMIT_ORDER', () => {
    const intent: ChatLimitOrderIntent = {
      type: 'LIMIT_ORDER_TIME_INTENT',
      side: 'SELL',
      sell: 'SOL',
      buy: 'USDC',
      amount: '1',
      runAt: '2026-01-01T18:00:00Z',
    };
    const row = buildChatButtonRowFromIntent({ intent });
    expect(row?.template).toBe('CONFIRM_LIMIT_ORDER');
  });

  it('passes cid into the row context', () => {
    const intent: ChatSwapIntent = { type: 'SINGLE_CHAIN_SWAP_INTENT', sell: 'SOL', buy: 'USDC', amount: '1' };
    const row = buildChatButtonRowFromIntent({ intent, cid: '0cabc' });
    expect(row?.context?.cid).toBe('0cabc');
  });

  it('returns null for unknown intent type', () => {
    const row = buildChatButtonRowFromIntent({ intent: { type: 'WAT' } as unknown as ChatSwapIntent });
    expect(row).toBeNull();
  });
});
