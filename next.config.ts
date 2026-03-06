import type { NextConfig } from 'next';
import path from 'path';

const DEFAULT_LOCAL_BACKEND_URL = 'http://localhost:3001';
const DEFAULT_DEV_BACKEND_URL = 'https://altair-backend-dev.onrender.com';
const DEFAULT_PROD_BACKEND_URL = 'https://altair-backend1.onrender.com';

const backendOverride = process.env.NEXT_PUBLIC_BACKEND_URL_OVERRIDE?.trim();
const backendBaseUrl =
  backendOverride ||
  (process.env.NODE_ENV === 'development'
    ? process.env.NEXT_PUBLIC_LOCAL_BACKEND_URL?.trim() || DEFAULT_LOCAL_BACKEND_URL
    : process.env.VERCEL_ENV === 'preview'
      ? process.env.NEXT_PUBLIC_DEV_BACKEND_URL?.trim() || DEFAULT_DEV_BACKEND_URL
      : process.env.NEXT_PUBLIC_PROD_BACKEND_URL?.trim() || DEFAULT_PROD_BACKEND_URL) ||
  DEFAULT_LOCAL_BACKEND_URL;

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
    return [
      {
        source: '/api/:path*',
        destination: `${backendBaseUrl}/api/:path*`,
      },
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
    ];
  },
};

export default nextConfig;
