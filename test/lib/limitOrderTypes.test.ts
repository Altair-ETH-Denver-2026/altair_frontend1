// Tests for the isLimitOrderIntent type guard. Pure function; no setup needed.

import { describe, expect, it } from 'vitest';
import { isLimitOrderIntent } from '@/lib/limitOrderTypes';

describe('isLimitOrderIntent', () => {
  it('returns true for LIMIT_ORDER_PRICE_INTENT', () => {
    expect(
      isLimitOrderIntent({ type: 'LIMIT_ORDER_PRICE_INTENT', side: 'SELL', sell: 'BONK', buy: 'USDC', amount: '100' })
    ).toBe(true);
  });

  it('returns true for LIMIT_ORDER_TIME_INTENT', () => {
    expect(
      isLimitOrderIntent({ type: 'LIMIT_ORDER_TIME_INTENT', side: 'SELL', sell: 'SOL', buy: 'USDC', amount: '1' })
    ).toBe(true);
  });

  it('returns false for swap intents', () => {
    expect(isLimitOrderIntent({ type: 'SINGLE_CHAIN_SWAP_INTENT', sell: 'SOL', buy: 'USDC', amount: '1' })).toBe(false);
    expect(isLimitOrderIntent({ type: 'CROSS_CHAIN_SWAP_INTENT' })).toBe(false);
    expect(isLimitOrderIntent({ type: 'BRIDGE_INTENT' })).toBe(false);
  });

  it('returns false for lend intents', () => {
    expect(isLimitOrderIntent({ type: 'LEND_DEPOSIT_INTENT', token: 'USDC', amount: '10' })).toBe(false);
  });

  it('returns false for null / undefined / non-objects', () => {
    expect(isLimitOrderIntent(null)).toBe(false);
    expect(isLimitOrderIntent(undefined)).toBe(false);
    expect(isLimitOrderIntent('string')).toBe(false);
    expect(isLimitOrderIntent(42)).toBe(false);
  });

  it('returns false for objects missing a type field', () => {
    expect(isLimitOrderIntent({ side: 'SELL' })).toBe(false);
  });
});
