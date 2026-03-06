const DEFAULT_LOCAL_BACKEND_URL = 'http://localhost:3001';
const DEFAULT_DEV_BACKEND_URL = 'https://altair-backend-dev.onrender.com';
const DEFAULT_PROD_BACKEND_URL = 'https://altair-backend1.onrender.com';
const DEFAULT_PROD_FRONTEND_URL = 'https://askaltair.com';

const normalizeHost = (value: string): string => value.replace(/\/+$/, '').toLowerCase();

const getHostFromUrl = (value: string | undefined): string | null => {
  if (!value) return null;
  try {
    return normalizeHost(new URL(value).host);
  } catch {
    return null;
  }
};

export const getBackendBaseUrl = (): string => {
  const override = process.env.NEXT_PUBLIC_BACKEND_URL_OVERRIDE?.trim();
  if (override) return override;

  const localBackend =
    process.env.NEXT_PUBLIC_LOCAL_BACKEND_URL?.trim() || DEFAULT_LOCAL_BACKEND_URL;
  const devBackend = process.env.NEXT_PUBLIC_DEV_BACKEND_URL?.trim() || DEFAULT_DEV_BACKEND_URL;
  const prodBackend =
    process.env.NEXT_PUBLIC_PROD_BACKEND_URL?.trim() || DEFAULT_PROD_BACKEND_URL;
  const prodFrontendUrl =
    process.env.NEXT_PUBLIC_PROD_FRONTEND_URL?.trim() || DEFAULT_PROD_FRONTEND_URL;
  const prodHost = getHostFromUrl(prodFrontendUrl) ?? 'askaltair.com';
  const vercelHost = process.env.VERCEL_URL ? normalizeHost(process.env.VERCEL_URL) : null;

  if (typeof window !== 'undefined') {
    const host = normalizeHost(window.location.host);
    if (host === 'localhost:3000') return localBackend;
    if (host.endsWith('.vercel.app')) return devBackend;
    if (host === prodHost) return prodBackend;
  } else if (process.env.NODE_ENV === 'development') {
    return localBackend;
  } else if (vercelHost) {
    if (vercelHost.endsWith('.vercel.app')) return devBackend;
    if (vercelHost === prodHost) return prodBackend;
  } else if (process.env.VERCEL_ENV === 'preview') {
    return devBackend;
  }

  return prodBackend;
};
