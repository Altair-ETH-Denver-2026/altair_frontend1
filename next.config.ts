import type { NextConfig } from 'next';
import path from 'path';

const DEFAULT_LOCAL_BACKEND_URL = 'http://localhost:3001';
const DEFAULT_DEV_BACKEND_URL = 'https://altair-backend-dev.onrender.com';
const DEFAULT_PROD_BACKEND_URL = 'https://altair-backend1.onrender.com';
const DEFAULT_LOCAL_FRONTEND_URL = 'http://localhost:3000';
const DEFAULT_DEV_FRONTEND_URL_PREFIX = 'https://*.vercel.app';
const DEFAULT_PROD_FRONTEND_URL = 'https://askaltair.com';

const extractHostToken = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.includes('://')) {
    try {
      return new URL(trimmed).host.toLowerCase();
    } catch {
      // fall through
    }
  }
  return trimmed
    .replace(/^https?:\/\//i, '')
    .replace(/^\*\./, '*.')
    .split('/')[0]
    .toLowerCase();
};

const stripPort = (host: string): string => host.split(':')[0].toLowerCase();

const resolveHostCandidates = (value: string): string[] => {
  const host = extractHostToken(value);
  const hostname = stripPort(host);
  return Array.from(new Set([host, hostname].filter(Boolean)));
};

const hostPatternFromWildcard = (value: string): string => {
  const host = extractHostToken(value);
  if (!host) return '';
  const hostnameOnly = stripPort(host);
  if (hostnameOnly === '*.vercel.app') return ':vercelSubdomain.vercel.app';
  if (hostnameOnly.includes('*')) {
    const [prefix, suffix] = hostnameOnly.split('*');
    const normalizedSuffix = suffix?.startsWith('.') ? suffix : `.${suffix ?? ''}`;
    return `${prefix || ':wildcardPart'}${normalizedSuffix}`;
  }
  return hostnameOnly;
};

const backendOverride = process.env.NEXT_PUBLIC_BACKEND_URL_OVERRIDE?.trim();
const localBackendUrl = process.env.NEXT_PUBLIC_LOCAL_BACKEND_URL?.trim() || DEFAULT_LOCAL_BACKEND_URL;
const devBackendUrl = process.env.NEXT_PUBLIC_DEV_BACKEND_URL?.trim() || DEFAULT_DEV_BACKEND_URL;
const prodBackendUrl = process.env.NEXT_PUBLIC_PROD_BACKEND_URL?.trim() || DEFAULT_PROD_BACKEND_URL;

const localFrontendHosts = resolveHostCandidates(
  process.env.NEXT_PUBLIC_LOCAL_FRONTEND_URL?.trim() || DEFAULT_LOCAL_FRONTEND_URL
);
const prodFrontendHosts = resolveHostCandidates(
  process.env.NEXT_PUBLIC_PROD_FRONTEND_URL?.trim() || DEFAULT_PROD_FRONTEND_URL
);
const devFrontendHostPattern = hostPatternFromWildcard(
  process.env.NEXT_PUBLIC_DEV_FRONTEND_URL_PREFIX?.trim() || DEFAULT_DEV_FRONTEND_URL_PREFIX
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  turbopack: {},
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      tailwindcss: path.resolve(__dirname, 'node_modules/tailwindcss'),
    };
    return config;
  },
  async rewrites() {
    if (backendOverride) {
      return [
        {
          source: '/api/:path*',
          destination: `${backendOverride}/api/:path*`,
        },
      ];
    }

    return [
      ...(localFrontendHosts.length > 0
        ? localFrontendHosts.map((host) => ({
            source: '/api/:path*',
            has: [{ type: 'host' as const, value: host }],
            destination: `${localBackendUrl}/api/:path*`,
          }))
        : []),
      ...(prodFrontendHosts.length > 0
        ? prodFrontendHosts.map((host) => ({
            source: '/api/:path*',
            has: [{ type: 'host' as const, value: host }],
            destination: `${prodBackendUrl}/api/:path*`,
          }))
        : []),
      ...(devFrontendHostPattern
        ? [{
            source: '/api/:path*',
            has: [{ type: 'host' as const, value: devFrontendHostPattern }],
            destination: `${devBackendUrl}/api/:path*`,
          }]
        : []),
      {
        source: '/api/:path*',
        destination: `${prodBackendUrl}/api/:path*`,
      }
    ];
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'x-forwarded-timeout-ms',
            value: '60000',
          },
        ],
      },
      {
        source: '/image/tokens/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/image/chains/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
