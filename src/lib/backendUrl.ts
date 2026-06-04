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

// In the browser we deliberately return '' so fetch('/api/...') stays same-origin
// and Next.js rewrites in next.config.ts handle proxying to the right backend per
// host. Returning an absolute URL would force CORS preflights and break local dev
// unless the backend is running and CORS env vars are perfectly aligned.
//
// On the server (SSR / Node) we fall back to an absolute URL because there is no
// browser origin to be relative to.
export const getBackendBaseUrl = (): string => {
  if (typeof window !== 'undefined') return '';

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

  if (process.env.NODE_ENV === 'development') return localBackend;
  if (vercelHost) {
    if (vercelHost.endsWith('.vercel.app')) return devBackend;
    if (vercelHost === prodHost) return prodBackend;
  }
  if (process.env.VERCEL_ENV === 'preview') return devBackend;

  return prodBackend;
};
