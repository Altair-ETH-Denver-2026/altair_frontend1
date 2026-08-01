// Tests for the isLendIntent type guard.

import { describe, expect, it } from 'vitest';
import { isLendIntent } from '@/lib/lendTypes';

describe('isLendIntent', () => {
  it('accepts a valid deposit intent', () => {
    expect(
      isLendIntent({ type: 'LEND_DEPOSIT_INTENT', token: 'USDC', amount: '10', tokenChain: 'SOLANA_MAINNET' })
    ).toBe(true);
  });

  it('accepts a valid withdraw intent (string amount "all")', () => {
    expect(isLendIntent({ type: 'LEND_WITHDRAW_INTENT', token: 'USDC', amount: 'all' })).toBe(true);
  });

  it('accepts numeric amount', () => {
    expect(isLendIntent({ type: 'LEND_DEPOSIT_INTENT', token: 'USDC', amount: 10 })).toBe(true);
  });

  it('rejects when token is missing or blank', () => {
    expect(isLendIntent({ type: 'LEND_DEPOSIT_INTENT', amount: '10' })).toBe(false);
    expect(isLendIntent({ type: 'LEND_DEPOSIT_INTENT', token: '   ', amount: '10' })).toBe(false);
  });

  it('rejects when amount is missing', () => {
    expect(isLendIntent({ type: 'LEND_DEPOSIT_INTENT', token: 'USDC' })).toBe(false);
  });

  it('rejects other intent types', () => {
    expect(isLendIntent({ type: 'SINGLE_CHAIN_SWAP_INTENT', sell: 'SOL', buy: 'USDC', amount: '1' })).toBe(false);
    expect(isLendIntent({ type: 'LIMIT_ORDER_PRICE_INTENT' })).toBe(false);
  });

  it('rejects null / non-objects', () => {
    expect(isLendIntent(null)).toBe(false);
    expect(isLendIntent('string')).toBe(false);
  });
});
