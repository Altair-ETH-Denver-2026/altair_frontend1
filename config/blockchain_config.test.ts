/**
 * Tests for frontend blockchain config (Commits: 7e223ef, 3d52d29, Group 9).
 */
import { describe, it, expect } from 'vitest';
import { CHAINS, isSolanaChain, type ChainKey } from './blockchain_config';

describe('blockchain_config', () => {
  it('exports CHAINS including SOLANA_MAINNET', () => {
    expect(CHAINS.SOLANA_MAINNET).toBe('SOLANA_MAINNET');
    expect(CHAINS.BASE_MAINNET).toBe('BASE_MAINNET');
    expect(CHAINS.ARBITRUM_ONE).toBe('ARBITRUM_ONE');
  });

  it('isSolanaChain returns true only for SOLANA_MAINNET', () => {
    expect(isSolanaChain('SOLANA_MAINNET')).toBe(true);
    expect(isSolanaChain('BASE_MAINNET')).toBe(false);
    expect(isSolanaChain('ARBITRUM_ONE')).toBe(false);
  });
});
