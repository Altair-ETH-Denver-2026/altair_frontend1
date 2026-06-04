import './globals.css';
import type { Metadata, Viewport } from 'next';
import Providers from './providers';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';
import {
  SITE_URL,
  SITE_NAME,
  SITE_TITLE,
  SITE_TITLE_TEMPLATE,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_OG_IMAGE,
  SITE_OG_IMAGE_WIDTH,
  SITE_OG_IMAGE_HEIGHT,
  SITE_OG_IMAGE_ALT,
  SITE_TWITTER_HANDLE,
  SITE_LOCALE,
  SITE_THEME_COLOR,
  SITE_COLOR_SCHEME,
  SITE_VIEWPORT_WIDTH,
  SITE_VIEWPORT_INITIAL_SCALE,
} from '../../config/site_metadata';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: SITE_TITLE_TEMPLATE,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: SITE_LOCALE,
    images: [
      {
        url: SITE_OG_IMAGE,
        width: SITE_OG_IMAGE_WIDTH,
        height: SITE_OG_IMAGE_HEIGHT,
        alt: SITE_OG_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE],
    ...(SITE_TWITTER_HANDLE ? { creator: SITE_TWITTER_HANDLE, site: SITE_TWITTER_HANDLE } : {}),
  },
};

export const viewport: Viewport = {
  width: SITE_VIEWPORT_WIDTH,
  initialScale: SITE_VIEWPORT_INITIAL_SCALE,
  themeColor: SITE_THEME_COLOR,
  colorScheme: SITE_COLOR_SCHEME,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-black text-white">
        <Providers>{children}</Providers>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
