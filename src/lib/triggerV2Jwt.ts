// In-memory JWT cache + acquisition flow for Jupiter Trigger V2.
//
// V2 authentication is a three-step dance per wallet:
//   1. POST /api/jupiter/trigger-v2/auth/challenge { walletPubkey } → { challenge }
//   2. Wallet signs the challenge bytes via Privy's useSignMessage.
//   3. POST /api/jupiter/trigger-v2/auth/verify { type, walletPubkey, signature } → { token }
//
// JWT TTL is 24h (Jupiter-enforced). We cache per-wallet in-process; we do NOT
// persist to localStorage to keep the leaked-credential blast radius small —
// re-authenticating just costs one signMessage round trip.
//
// This module exposes a thin imperative API the hook layer (useTriggerV2Auth)
// wraps with React state + Privy plumbing. We keep it imperative so the cron
// /scheduler flows (future, server-side) can share logic if we extract that.

import bs58 from 'bs58';

export type TriggerV2JwtEntry = {
  token: string;
  /** Absolute expiry (ms since epoch). We refresh ~1h before this. */
  expiresAt: number;
  walletPubkey: string;
};

// Refresh JWTs a bit before Jupiter's 24h hard expiry so an inflight request
// doesn't race the boundary. 60 minutes of slack is plenty.
const REFRESH_SLACK_MS = 60 * 60 * 1000;

// JWT TTL is 24h on Jupiter's side. We mirror it locally so the cache evicts
// even when getOrFetchJwt is never called explicitly.
const JWT_TTL_MS = 24 * 60 * 60 * 1000;

const cache = new Map<string, TriggerV2JwtEntry>();

const isFresh = (entry: TriggerV2JwtEntry): boolean =>
  entry.expiresAt - Date.now() > REFRESH_SLACK_MS;

/** Get the cached JWT for this wallet, or null if missing/expired. */
export function getCachedJwt(walletPubkey: string): string | null {
  const entry = cache.get(walletPubkey);
  if (!entry) return null;
  if (!isFresh(entry)) {
    cache.delete(walletPubkey);
    return null;
  }
  return entry.token;
}

/** Store a freshly-issued JWT in the cache. */
export function setCachedJwt(walletPubkey: string, token: string): void {
  cache.set(walletPubkey, {
    token,
    walletPubkey,
    expiresAt: Date.now() + JWT_TTL_MS,
  });
}

/** Wipe the entire cache (useful on wallet disconnect / sign-out). */
export function clearJwtCache(): void {
  cache.clear();
}

export type ChallengeResponse =
  | { type: 'message'; challenge: string }
  | { type: 'transaction'; transaction: string };

/** POST /api/jupiter/trigger-v2/auth/challenge — request a challenge for this wallet. */
export async function requestChallenge(walletPubkey: string): Promise<ChallengeResponse> {
  const res = await fetch('/api/jupiter/trigger-v2/auth/challenge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletPubkey, type: 'message' }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body?.error ?? `Trigger V2 challenge failed (${res.status})`);
  }
  return (await res.json()) as ChallengeResponse;
}

/** POST /api/jupiter/trigger-v2/auth/verify — exchange signature for a JWT. */
export async function verifyChallenge(params: {
  walletPubkey: string;
  signature: Uint8Array;
}): Promise<string> {
  const res = await fetch('/api/jupiter/trigger-v2/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'message',
      walletPubkey: params.walletPubkey,
      signature: bs58.encode(params.signature),
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body?.error ?? `Trigger V2 verify failed (${res.status})`);
  }
  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new Error('Trigger V2 verify returned no token');
  return body.token;
}

/**
 * Acquire a JWT for the given wallet. If we have a fresh cached token, returns
 * it. Otherwise runs the full challenge → sign → verify flow using the caller-
 * supplied `signMessage` (so this module stays React-agnostic).
 *
 * The `signMessage` callback should:
 *   - Take the challenge bytes
 *   - Prompt the user to sign with their Solana wallet
 *   - Return the raw 64-byte signature
 */
export async function getOrFetchJwt(params: {
  walletPubkey: string;
  signMessage: (challengeBytes: Uint8Array) => Promise<Uint8Array>;
}): Promise<string> {
  const cached = getCachedJwt(params.walletPubkey);
  if (cached) return cached;

  const challenge = await requestChallenge(params.walletPubkey);
  if (challenge.type !== 'message') {
    // Transaction-based challenges are only needed for hardware wallets. We
    // only request type='message', so this branch firing means Jupiter changed
    // their default — surface it instead of silently mis-signing.
    throw new Error('Trigger V2 returned an unexpected challenge type (expected "message")');
  }
  const challengeBytes = new TextEncoder().encode(challenge.challenge);
  const signature = await params.signMessage(challengeBytes);
  const token = await verifyChallenge({ walletPubkey: params.walletPubkey, signature });
  setCachedJwt(params.walletPubkey, token);
  return token;
}
