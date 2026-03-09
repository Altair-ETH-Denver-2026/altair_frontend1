'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useWallets as useSolanaWallets, useSignAndSendTransaction } from '@privy-io/react-auth/solana';
import {
  AddressLookupTableAccount,
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { getCachedPrivyAccessToken } from './privyTokenCache';
import { withWaitLogger } from './waitLogger';
import type { RelayQuoteRequest, RelayQuoteResponse } from './relayTypes';
import { resolveRelayChainId, resolveRelayToken, toBaseUnits } from './relayMapping';
import { getBackendBaseUrl } from './backendUrl';

type RelayIntent = {
  type: 'CROSS_CHAIN_SWAP_INTENT' | 'BRIDGE_INTENT';
  sell: string;
  buy?: string;
  amount: string;
  sellTokenChain: string;
  buyTokenChain: string;
};

export const useRelay = () => {
  const { authenticated, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { wallets: solanaWallets } = useSolanaWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();

  const buildJupiterError = (err: unknown, logs?: string[] | null) => {
    const serialized = err ? JSON.stringify(err) : '';
    const hasJupiterLog = logs?.some((line) => line.includes('JUP6LkbZ') || line.includes('Jupiter'));
    if (!hasJupiterLog && !serialized.includes('0x1788') && !serialized.includes('6024')) return null;
    return new Error(
      'Relay Solana route failed inside Jupiter (program error 0x1788). This usually means the Solana swap route is unavailable for the requested amount/token. Try a different amount/token or wait for liquidity to improve.'
    );
  };

  return async (intent: RelayIntent, cid?: string | null) => {
    if (!authenticated || !wallets?.length) {
      throw new Error('No authenticated wallet available.');
    }

    const wallet = wallets[0];
    const evmAddress = wallet.address ?? null;

    console.log('[Relay] intent chains', {
      sellTokenChain: intent.sellTokenChain,
      buyTokenChain: intent.buyTokenChain,
    });
    const originChainId = resolveRelayChainId(intent.sellTokenChain);
    const destinationChainId = resolveRelayChainId(intent.buyTokenChain);
    console.log('[Relay] resolved chain ids', {
      originChainId,
      destinationChainId,
    });
    if (!originChainId || !destinationChainId) {
      throw new Error('Unsupported chain for Relay execution.');
    }

    const originToken = resolveRelayToken(intent.sellTokenChain, intent.sell);
    console.log('[Relay] resolved origin token', {
      chain: intent.sellTokenChain,
      symbol: intent.sell,
      token: originToken ?? null,
    });
    if (!originToken) {
      throw new Error('Unsupported sell token for Relay execution.');
    }

    const buySymbol = intent.type === 'BRIDGE_INTENT' ? intent.sell : intent.buy;
    if (!buySymbol) {
      throw new Error('Missing buy token for Relay execution.');
    }
    const destinationToken = resolveRelayToken(intent.buyTokenChain, buySymbol);
    console.log('[Relay] resolved destination token', {
      chain: intent.buyTokenChain,
      symbol: buySymbol,
      token: destinationToken ?? null,
    });
    if (!destinationToken) {
      throw new Error('Unsupported buy token for Relay execution.');
    }

    const amountBase = toBaseUnits(intent.amount, originToken.decimals);
    console.log('[Relay] amount conversion', {
      amount: intent.amount,
      decimals: originToken.decimals,
      amountBase,
    });
    const isSolanaOrigin = originChainId === 792703809;
    const isSolanaDestination = destinationChainId === 792703809;
    let solanaRecipient = isSolanaDestination ? solanaWallets?.[0]?.address ?? null : null;
    let solanaUser = isSolanaOrigin ? solanaWallets?.[0]?.address ?? null : null;
    if ((isSolanaOrigin || isSolanaDestination) && (!solanaRecipient || !solanaUser)) {
      const cachedToken = await getCachedPrivyAccessToken(getAccessToken).catch(() => null);
      const response = cachedToken
        ? await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: 'resolve solana address',
              history: [],
              accessToken: cachedToken,
              selectedChain: 'SOLANA_MAINNET',
              solanaAddress: null,
            }),
          }).catch(() => null)
        : null;
      if (response?.ok) {
        const payload = await response.json().catch(() => ({}));
        const resolved = typeof payload?.solAddress === 'string' ? payload.solAddress : null;
        if (isSolanaDestination) solanaRecipient = resolved;
        if (isSolanaOrigin) solanaUser = resolved;
      }
      if ((isSolanaDestination && !solanaRecipient) || (isSolanaOrigin && !solanaUser)) {
        throw new Error('Missing Solana wallet address for Relay. Connect a Solana wallet in Privy.');
      }
    }

    if (!isSolanaOrigin && !evmAddress) {
      throw new Error('Missing EVM wallet address for Relay execution.');
    }

    const originCurrency = isSolanaOrigin
      ? originToken.address
      : originToken.address.toLowerCase();
    const destinationCurrency = isSolanaDestination
      ? destinationToken.address
      : destinationToken.address.toLowerCase();
    const relayRequest: RelayQuoteRequest = {
      user: isSolanaOrigin ? solanaUser ?? '' : evmAddress ?? '',
      originChainId,
      destinationChainId,
      originCurrency,
      destinationCurrency,
      amount: amountBase,
      tradeType: 'EXACT_INPUT',
      recipient: isSolanaDestination && solanaRecipient ? solanaRecipient : evmAddress ?? '',
      forceSolverExecution: true,
      useReceiver: true,
      useDepositAddress: false,
      strict: false,
      useExternalLiquidity: true,
      useFallbacks: true,
      ...(isSolanaOrigin
        ? {
            includeComputeUnitLimit: true,
            maxRouteLength: 3,
            useSharedAccounts: true,
            overridePriceImpact: true,
            disableOriginSwaps: false,
          }
        : {}),
    };
    console.log('[Relay] quote request', relayRequest);

    const backendBaseUrl = getBackendBaseUrl();
    const relayQuote = await withWaitLogger(
      {
        file: 'altair_frontend1/src/lib/useRelay.ts',
        target: '/api/relay/quote',
        description: 'Relay quote request',
      },
      async () => {
        const res = await fetch(`${backendBaseUrl}/api/relay/quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(relayRequest),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Relay quote failed: ${errText}`);
        }
        return (await res.json()) as RelayQuoteResponse;
      }
    );

    let requestId: string | null = null;
    for (const step of relayQuote.steps) {
      if (!requestId && step.requestId) requestId = step.requestId;
      for (const item of step.items) {
        if (item?.check?.endpoint && !requestId) {
          const match = item.check.endpoint.match(/requestId=([^&]+)/i);
          if (match?.[1]) requestId = match[1];
        }
      }
    }

    for (const step of relayQuote.steps) {
      if (step.kind === 'signature') {
        throw new Error('Relay returned a signature step; signing is not implemented for Solana execution.');
      }
      if (step.kind !== 'transaction') {
        throw new Error(`Unsupported Relay step kind: ${step.kind}`);
      }
      const item = step.items[0];
      const data = item?.data;
      console.log('[Relay] step payload', {
        id: step.id,
        kind: step.kind,
        action: step.action,
        description: step.description,
        data,
      });

      const hasSolanaPayload = Boolean(
        data?.transaction ||
          (Array.isArray(data?.instructions) && data?.instructions.length > 0) ||
          (Array.isArray(data?.addressLookupTableAddresses) && data?.addressLookupTableAddresses.length > 0)
      );
      const isSolanaStep = data?.chainId
        ? String(data.chainId) === '792703809'
        : hasSolanaPayload;

      if (isSolanaStep) {
        if (!solanaUser) {
          throw new Error('Missing Solana wallet address for Relay Solana transaction.');
        }
        const solanaWallet = solanaWallets?.[0];
        if (!solanaWallet) {
          throw new Error('Missing Solana wallet for Relay Solana transaction.');
        }
        const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
        const connection = new Connection(rpcUrl && rpcUrl.trim() ? rpcUrl.trim() : 'https://api.mainnet-beta.solana.com', 'confirmed');
        if (typeof data?.transaction === 'string' && data.transaction.length > 0) {
          const txBuffer = Buffer.from(data.transaction, 'base64');
          const versionedTx = VersionedTransaction.deserialize(txBuffer);
          const serialized = versionedTx.serialize();
          try {
            const sim = await withWaitLogger(
              {
                file: 'altair_frontend1/src/lib/useRelay.ts',
                target: 'Solana simulateTransaction',
                description: 'Relay Solana simulation (base64 tx)'
              },
              () => connection.simulateTransaction(versionedTx, { sigVerify: false, replaceRecentBlockhash: true })
            );
            if (sim?.value?.err) {
              console.warn('[Relay] Solana simulation error', sim.value.err, sim.value.logs ?? []);
              const jupiterError = buildJupiterError(sim.value.err, sim.value.logs);
              if (jupiterError) throw jupiterError;
            }
          } catch (err) {
            console.warn('[Relay] Solana simulation failed', err);
          }

          const { signature } = await withWaitLogger(
            {
              file: 'altair_frontend1/src/lib/useRelay.ts',
              target: 'Privy signAndSendTransaction',
              description: 'Relay Solana transaction signing and submission',
            },
            () =>
              signAndSendTransaction({
                transaction: serialized,
                wallet: solanaWallet,
                chain: 'solana:mainnet',
              })
          );
          const txHash = typeof signature === 'string' ? signature : bs58.encode(signature);
          console.log('[Relay] Solana transaction signature', txHash);
          continue;
        }

        const instructions = data?.instructions ?? [];
        if (!instructions.length) {
          console.warn('[Relay] Missing Solana tx data for step', step);
          throw new Error('Relay step missing transaction data.');
        }
        const payer = new PublicKey(data?.payer ?? solanaUser);
        const tx = new Transaction();
        tx.feePayer = payer;
        if (data?.recentBlockhash) {
          tx.recentBlockhash = data.recentBlockhash;
        } else {
          const latest = await withWaitLogger(
            {
              file: 'altair_frontend1/src/lib/useRelay.ts',
              target: 'Solana getLatestBlockhash',
              description: 'Relay Solana blockhash',
            },
            () => connection.getLatestBlockhash('confirmed')
          );
          tx.recentBlockhash = latest.blockhash;
        }
        instructions.forEach((ix) => {
          const keys = ix.keys.map((key) => ({
            pubkey: new PublicKey(key.pubkey),
            isSigner: key.isSigner,
            isWritable: key.isWritable,
          }));
          tx.add(
            new TransactionInstruction({
              programId: new PublicKey(ix.programId),
              data: Buffer.from(ix.data, 'hex'),
              keys,
            })
          );
        });

        const lutAddresses = data?.addressLookupTableAddresses ?? [];
        if (lutAddresses.length > 0) {
          const lookupTables = await withWaitLogger(
            {
              file: 'altair_frontend1/src/lib/useRelay.ts',
              target: 'Solana getAddressLookupTable',
              description: 'Relay Solana lookup tables',
            },
            () =>
              Promise.all(
                lutAddresses.map(async (address) => {
                  const res = await connection.getAddressLookupTable(new PublicKey(address));
                  return res.value;
                })
              )
          );
          const compiled = new TransactionMessage({
            payerKey: tx.feePayer ?? payer,
            recentBlockhash: tx.recentBlockhash ?? '',
            instructions: tx.instructions,
          }).compileToV0Message(lookupTables.filter(Boolean) as AddressLookupTableAccount[]);
          const versionedTx = new VersionedTransaction(compiled);
          try {
            const sim = await withWaitLogger(
              {
                file: 'altair_frontend1/src/lib/useRelay.ts',
                target: 'Solana simulateTransaction',
                description: 'Relay Solana simulation (v0 tx)'
              },
              () => connection.simulateTransaction(versionedTx, { sigVerify: false, replaceRecentBlockhash: true })
            );
            if (sim?.value?.err) {
              console.warn('[Relay] Solana simulation error', sim.value.err, sim.value.logs ?? []);
              const jupiterError = buildJupiterError(sim.value.err, sim.value.logs);
              if (jupiterError) throw jupiterError;
            }
          } catch (err) {
            console.warn('[Relay] Solana simulation failed', err);
          }
          const serialized = versionedTx.serialize();
          const { signature } = await withWaitLogger(
            {
              file: 'altair_frontend1/src/lib/useRelay.ts',
              target: 'Privy signAndSendTransaction',
              description: 'Relay Solana transaction signing and submission',
            },
            () =>
              signAndSendTransaction({
                transaction: serialized,
                wallet: solanaWallet,
                chain: 'solana:mainnet',
              })
          );
          const txHash = typeof signature === 'string' ? signature : bs58.encode(signature);
          console.log('[Relay] Solana transaction signature', txHash);
        } else {
          try {
            const sim = await withWaitLogger(
              {
                file: 'altair_frontend1/src/lib/useRelay.ts',
                target: 'Solana simulateTransaction',
                description: 'Relay Solana simulation (legacy tx)'
              },
              () => connection.simulateTransaction(tx)
            );
            if (sim?.value?.err) {
              console.warn('[Relay] Solana simulation error', sim.value.err, sim.value.logs ?? []);
              const jupiterError = buildJupiterError(sim.value.err, sim.value.logs);
              if (jupiterError) throw jupiterError;
            }
          } catch (err) {
            console.warn('[Relay] Solana simulation failed', err);
          }
          const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
          const { signature } = await withWaitLogger(
            {
              file: 'altair_frontend1/src/lib/useRelay.ts',
              target: 'Privy signAndSendTransaction',
              description: 'Relay Solana transaction signing and submission',
            },
            () =>
              signAndSendTransaction({
                transaction: serialized,
                wallet: solanaWallet,
                chain: 'solana:mainnet',
              })
          );
          const txHash = typeof signature === 'string' ? signature : bs58.encode(signature);
          console.log('[Relay] Solana transaction signature', txHash);
        }
        continue;
      }

      if (!data?.to || !data?.data || data?.value === undefined || !data?.chainId) {
        console.warn('[Relay] Missing tx data for step', step);
        throw new Error('Relay step missing transaction data.');
      }

      const ethereumProvider = await wallet.getEthereumProvider();
      await withWaitLogger(
        {
          file: 'altair_frontend1/src/lib/useRelay.ts',
          target: 'eth_sendTransaction',
          description: 'Relay deposit transaction',
        },
        () =>
          ethereumProvider.request?.({
            method: 'eth_sendTransaction',
            params: [
              {
                from: data.from ?? evmAddress,
                to: data.to,
                data: data.data,
                value: data.value,
                chainId: `0x${Number(data.chainId).toString(16)}`,
              },
            ],
          })
      );
    }

      const relayWritebackPayload = {
        cid: cid ?? null,
        intentString: intent.type,
        sellToken: {
          amount: intent.amount,
          symbol: originToken.symbol ?? intent.sell,
          contractAddress: originToken.address,
          chain: intent.sellTokenChain,
          chainId: originChainId,
          walletAddress: isSolanaOrigin ? solanaUser ?? null : evmAddress ?? null,
          balanceBefore: null,
          balanceAfter: null,
        },
        buyToken: {
          amount: '',
          symbol: destinationToken.symbol ?? buySymbol,
          contractAddress: destinationToken.address,
          chain: intent.buyTokenChain,
          chainId: destinationChainId,
          walletAddress: isSolanaDestination ? solanaRecipient ?? null : evmAddress ?? null,
          balanceBefore: null,
          balanceAfter: null,
        },
        requestId: requestId ?? null,
      };
    try {
      const backendBaseUrl = getBackendBaseUrl();
      await fetch(`${backendBaseUrl}/api/relay/writeback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(relayWritebackPayload),
      });
    } catch (err) {
      console.warn('[Relay] writeback failed', err);
    }

    return {
      requestId: requestId ?? null,
    };
  };
};
