type GetAccessToken = () => Promise<string | null>;

let cachedToken: string | null = null;
let cachedExpiresAtMs: number | null = null;

const DEFAULT_TTL_MS = 5 * 60 * 1000;
const EXPIRY_SKEW_MS = 30 * 1000;

const decodeJwtExpiryMs = (token: string): number | null => {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson) as { exp?: number };
    if (typeof payload.exp !== 'number') return null;
    return payload.exp * 1000;
  } catch {
    return null;
  }
};

export const getCachedPrivyAccessToken = async (getAccessToken: GetAccessToken): Promise<string> => {
  const now = Date.now();
  if (cachedToken && cachedExpiresAtMs && cachedExpiresAtMs - EXPIRY_SKEW_MS > now) {
    return cachedToken;
  }

  const freshToken = await getAccessToken();
  if (!freshToken) {
    throw new Error('Missing Privy access token');
  }
  const expiryMs = decodeJwtExpiryMs(freshToken) ?? now + DEFAULT_TTL_MS;
  cachedToken = freshToken;
  cachedExpiresAtMs = expiryMs;
  return freshToken;
};
