'use client';

import bs58 from 'bs58';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets, useSignAndSendTransaction } from '@privy-io/react-auth/solana';
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { resolveSelectedChain } from './useSwap';
import { withWaitLogger } from './waitLogger';
import { SOLANA_MAINNET, resolveRpcUrls } from '../../config/chain_info';
import type { ChainKey } from '../../config/blockchain_config';
import * as SolanaTokens from '../../config/token_info/solana_tokens';

type TokenMeta = { address?: string; decimals?: number; symbol?: string };

const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const ASSOCIATED_TOKEN_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';

const getTokenProgramId = () => new PublicKey(TOKEN_PROGRAM_ID);
const getAssociatedTokenProgramId = () => new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID);

const buildTokenMap = (): Record<string, { mint: PublicKey; decimals: number }> => {
  const map: Record<string, { mint: PublicKey; decimals: number }> = {};
  Object.values(SolanaTokens as Record<string, TokenMeta>).forEach((token) => {
    if (!token || typeof token !== 'object') return;
    const symbol = typeof token.symbol === 'string' ? token.symbol.toUpperCase() : null;
    const address = typeof token.address === 'string' ? token.address : null;
    const decimals = typeof token.decimals === 'number' ? token.decimals : null;
    if (!symbol || !address || decimals === null) return;
    map[symbol] = { mint: new PublicKey(address), decimals };
  });
  return map;
};

const resolveSolanaRpcUrl = () => {
  const envRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (envRpc && envRpc.trim()) return envRpc.trim();
  const resolved = resolveRpcUrls(SOLANA_MAINNET.rpcUrls);
  return resolved[0] ?? SOLANA_MAINNET.rpcUrls[0];
};

const parseAmountToBaseUnits = (amount: string, decimals: number): bigint => {
  const normalized = amount.trim();
  if (!normalized) throw new Error('Amount is required.');
  const negative = normalized.startsWith('-');
  if (negative) throw new Error('Amount must be positive.');
  const [wholeRaw, fractionRaw = ''] = normalized.split('.');
  const whole = wholeRaw.replace(/[^0-9]/g, '') || '0';
  const fraction = fractionRaw.replace(/[^0-9]/g, '');
  if (decimals <= 0) return BigInt(whole);
  const padded = fraction.slice(0, decimals).padEnd(decimals, '0');
  const combined = `${whole}${padded}`.replace(/^0+/, '') || '0';
  return BigInt(combined);
};

const getAssociatedTokenAddress = (mint: PublicKey, owner: PublicKey): PublicKey => {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), getTokenProgramId().toBuffer(), mint.toBuffer()],
    getAssociatedTokenProgramId()
  );
  return address;
};

const buildCreateAssociatedTokenAccountInstruction = (params: {
  payer: PublicKey;
  ata: PublicKey;
  owner: PublicKey;
  mint: PublicKey;
}): TransactionInstruction => {
  const { payer, ata, owner, mint } = params;
  return new TransactionInstruction({
    programId: getAssociatedTokenProgramId(),
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: getTokenProgramId(), isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data: Buffer.alloc(0),
  });
};

const buildTransferCheckedInstruction = (params: {
  source: PublicKey;
  mint: PublicKey;
  destination: PublicKey;
  owner: PublicKey;
  amount: bigint;
  decimals: number;
}): TransactionInstruction => {
  const data = Buffer.alloc(10);
  data.writeUInt8(12, 0); // TransferChecked instruction
  data.writeBigUInt64LE(params.amount, 1);
  data.writeUInt8(params.decimals, 9);
  return new TransactionInstruction({
    programId: getTokenProgramId(),
    keys: [
      { pubkey: params.source, isSigner: false, isWritable: true },
      { pubkey: params.mint, isSigner: false, isWritable: false },
      { pubkey: params.destination, isSigner: false, isWritable: true },
      { pubkey: params.owner, isSigner: true, isWritable: false },
    ],
    data,
  });
};

export function useSolanaTransfer(explicitChain?: ChainKey) {
  const { authenticated } = usePrivy();
  const { wallets, ready } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();

  return async (tokenSymbol: string, amount: string, recipient: string): Promise<string> => {
    if (!authenticated || !ready || !wallets?.length) {
      throw new Error('No authenticated Solana wallet available. Connect a Solana wallet in the app.');
    }

    const selectedChain = resolveSelectedChain(explicitChain);
    if (selectedChain !== 'SOLANA_MAINNET') {
      throw new Error('Solana transfers are only available on SOLANA_MAINNET.');
    }

    const wallet = wallets[0];
    const sender = new PublicKey(wallet.address);
    const recipientKey = new PublicKey(recipient);
    const normalizedSymbol = tokenSymbol.trim().toUpperCase();
    const tx = new Transaction();
    tx.feePayer = sender;

    if (normalizedSymbol === 'SOL') {
      const lamports = parseAmountToBaseUnits(amount, 9);
      if (lamports <= 0n) throw new Error('Amount must be greater than zero.');
      tx.add(
        SystemProgram.transfer({
          fromPubkey: sender,
          toPubkey: recipientKey,
          lamports,
        })
      );
    } else {
      const tokenMap = buildTokenMap();
      const tokenInfo = tokenMap[normalizedSymbol];
      if (!tokenInfo) {
        throw new Error(`Unsupported Solana token ${normalizedSymbol}.`);
      }
      const amountRaw = parseAmountToBaseUnits(amount, tokenInfo.decimals);
      if (amountRaw <= 0n) throw new Error('Amount must be greater than zero.');
      const connection = new Connection(resolveSolanaRpcUrl(), 'confirmed');
      const senderAta = getAssociatedTokenAddress(tokenInfo.mint, sender);
      const recipientAta = getAssociatedTokenAddress(tokenInfo.mint, recipientKey);
      let senderInfo: Awaited<ReturnType<typeof connection.getAccountInfo>> | null = null;
      let recipientInfo: Awaited<ReturnType<typeof connection.getAccountInfo>> | null = null;
      try {
        [senderInfo, recipientInfo] = await withWaitLogger(
          {
            file: 'altair_frontend1/src/lib/useSolanaTransfer.ts',
            target: 'Solana ATA lookups',
            description: 'check token accounts',
          },
          () => Promise.all([
            connection.getAccountInfo(senderAta),
            connection.getAccountInfo(recipientAta),
          ])
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('403') || msg.includes('Access forbidden')) {
          throw new Error(
            'Solana RPC returned 403 (rate limit). Set NEXT_PUBLIC_SOLANA_RPC_URL in .env to a custom RPC (Helius, QuickNode, Alchemy) and restart the dev server.'
          );
        }
        throw err;
      }
      if (!senderInfo) {
        throw new Error(`No ${normalizedSymbol} token account found for sender.`);
      }
      if (!recipientInfo) {
        tx.add(
          buildCreateAssociatedTokenAccountInstruction({
            payer: sender,
            ata: recipientAta,
            owner: recipientKey,
            mint: tokenInfo.mint,
          })
        );
      }
      tx.add(
        buildTransferCheckedInstruction({
          source: senderAta,
          mint: tokenInfo.mint,
          destination: recipientAta,
          owner: sender,
          amount: amountRaw,
          decimals: tokenInfo.decimals,
        })
      );
    }

    const connection = new Connection(resolveSolanaRpcUrl(), 'confirmed');
    const latestBlockhash = await withWaitLogger(
      {
        file: 'altair_frontend1/src/lib/useSolanaTransfer.ts',
        target: 'Solana getLatestBlockhash',
        description: 'fetch recent blockhash',
      },
      () => connection.getLatestBlockhash('confirmed')
    );
    tx.recentBlockhash = latestBlockhash.blockhash;

    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    const result = await withWaitLogger(
      {
        file: 'altair_frontend1/src/lib/useSolanaTransfer.ts',
        target: 'Privy signAndSendTransaction',
        description: 'Solana transfer signing and submission',
      },
      () => signAndSendTransaction({ transaction: serialized, wallet, chain: 'solana:mainnet' })
    );
    const signature = result?.signature;
    return typeof signature === 'string' ? signature : bs58.encode(signature);
  };
}
