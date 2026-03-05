'use client';

import { createClient as relayCreateClient, getClient } from '@relayprotocol/relay-sdk';

const RELAY_CLIENT_KEY = '__altair_relay_client_initialized';

function getRelayBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/api/relay`;
}

/**
 * Ensure the Relay SDK client is created with our proxy as baseApiUrl.
 * Call once before getQuote/execute. Use testnet when in Playground mode.
 */
export function ensureRelayClient(testnet: boolean = false): void {
  if (typeof window === 'undefined') return;
  const key = testnet ? `${RELAY_CLIENT_KEY}_testnet` : RELAY_CLIENT_KEY;
  if ((window as unknown as Record<string, boolean>)[key]) return;

  relayCreateClient({
    baseApiUrl: getRelayBaseUrl(),
  });
  (window as unknown as Record<string, boolean>)[key] = true;
}

export function getRelayClient(): ReturnType<typeof getClient> {
  return getClient();
}

export { getRelayBaseUrl };
