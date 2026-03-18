import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeBalancesResponse, resolveTokenRowsForChain } from './balanceTransforms';
import type { ApiChainBalances } from '../../config/balance_types';
import type { ChainKey } from '../../config/blockchain_config';

test('normalizeBalancesResponse keeps new tokens payload shape intact', () => {
    const normalized = normalizeBalancesResponse({
      chainKey: 'ETH_MAINNET',
      payload: {
        chain: 'ETH_MAINNET',
        tokens: {
          ETH: {
            symbol: 'ETH',
            decimals: 18,
            balance: '1.23',
            balanceRaw: '1230000000000000000',
            source: 'mongo',
          },
        },
        address: '0xabc',
        source: 'mongo',
        timestamp: 1700000000000,
      },
    });

    assert.equal(normalized.tokens.ETH?.balance, '1.23');
    assert.equal(normalized.address, '0xabc');
    assert.equal(normalized.timestamp, 1700000000000);
});

test('normalizeBalancesResponse ignores legacy flattened payload shape', () => {
    const normalized = normalizeBalancesResponse({
      chainKey: 'ETH_MAINNET',
      payload: {
        eth: '2.5',
        usdc: '100',
        address: '0xdef',
        source: 'blockchain',
        timestamp: 1700000001000,
      },
    });

    assert.equal(Object.keys(normalized.tokens).length, 0);
    assert.equal(normalized.address, '0xdef');
    assert.equal(normalized.timestamp, 1700000001000);
});

test('normalizeBalancesResponse applies fallback Solana address when payload omits it', () => {
    const normalized = normalizeBalancesResponse({
      chainKey: 'SOLANA_MAINNET',
      payload: {
        tokens: {
          SOL: { symbol: 'SOL', balance: '0.4', decimals: 9 },
        },
      },
      fallbackSolanaAddress: 'So11111111111111111111111111111111111111112',
    });

    assert.equal(normalized.solanaAddress, 'So11111111111111111111111111111111111111112');
});

const balancesByChain = {
    ETH_MAINNET: {
      tokens: {
        ETH: { symbol: 'ETH', balance: '1', decimals: 18 },
        USDC: { symbol: 'USDC', balance: '2', decimals: 6 },
      },
    },
    BASE_MAINNET: {
      tokens: {
        ETH: { symbol: 'ETH', balance: '3', decimals: 18 },
        DAI: { symbol: 'DAI', balance: '4', decimals: 18 },
      },
    },
    ETH_SEPOLIA: {
      tokens: {
        ETH: { symbol: 'ETH', balance: '999', decimals: 18 },
      },
    },
} as Partial<Record<ChainKey, ApiChainBalances>> as Record<ChainKey, ApiChainBalances>;

test('resolveTokenRowsForChain returns per-chain token rows', () => {
    const rows = resolveTokenRowsForChain(balancesByChain, 'BASE_MAINNET');
    assert.equal(rows.includes('ETH'), true);
    assert.equal(rows.includes('DAI'), true);
});

test('resolveTokenRowsForChain returns deduped ALL rows without testnet entries', () => {
    const rows = resolveTokenRowsForChain(balancesByChain, 'ALL');
    assert.equal(rows.includes('ETH'), true);
    assert.equal(rows.includes('USDC'), true);
    assert.equal(rows.includes('DAI'), true);
    assert.equal(rows.length, 3);
});
