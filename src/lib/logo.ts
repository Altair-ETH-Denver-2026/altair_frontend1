'use client';

import { useEffect, useState } from 'react';
import type { StaticImageData } from 'next/image';
import { LOGO_DISPLAY } from '../../config/ui_config';
import DefaultLogo from '../image/logo.png';
import LogoV2LightYellow from '../image/logos/Altair Logo V2 Light Yellow.png';
import LogoV2Purple from '../image/logos/Altair Logo V2 Purple.png';
import LogoV2Reddish from '../image/logos/Altair Logo V2 Reddish.png';
import LogoV2YellowGreen from '../image/logos/Altair Logo V2 Yellow and Green.png';
import LogoV2 from '../image/logos/Altair Logo V2.png';

type RequireWithContext = NodeRequire & {
  context: (path: string, recursive: boolean, regExp: RegExp) => {
    keys: () => string[];
    (key: string): { default?: StaticImageData } | StaticImageData;
  };
};

const imageContext = (require as RequireWithContext).context(
  '../image',
  true,
  /\.(png|jpg|jpeg|gif|svg)$/
);

const STATIC_LOGO_MAP: Record<string, StaticImageData> = {
  'logo.png': DefaultLogo,
  'Altair Logo V2 Light Yellow.png': LogoV2LightYellow,
  'Altair Logo V2 Purple.png': LogoV2Purple,
  'Altair Logo V2 Reddish.png': LogoV2Reddish,
  'Altair Logo V2 Yellow and Green.png': LogoV2YellowGreen,
  'Altair Logo V2.png': LogoV2,
};

const RANDOM_LOGO_POOL: StaticImageData[] = [
  LogoV2LightYellow,
  LogoV2Purple,
  LogoV2Reddish,
  LogoV2YellowGreen,
  LogoV2,
];

let cachedRandomLogo: StaticImageData | null = null;

const resolveFromContext = (filename: string): StaticImageData | null => {
  const normalized = filename.replace(/^\.?\//, '');
  const matchKey = imageContext
    .keys()
    .find((key) => key === `./${normalized}` || key.endsWith(`/${normalized}`));
  if (!matchKey) return null;
  const mod = imageContext(matchKey);
  return (mod as { default?: StaticImageData })?.default ?? (mod as StaticImageData);
};

const resolveRandomLogo = (): StaticImageData => {
  if (!cachedRandomLogo) {
    const pool = RANDOM_LOGO_POOL.length > 0 ? RANDOM_LOGO_POOL : [DefaultLogo];
    cachedRandomLogo = pool[Math.floor(Math.random() * pool.length)];
  }
  return cachedRandomLogo;
};

const resolveConfiguredLogo = (logoFile: string): StaticImageData => {
  if (!logoFile || logoFile === 'logo.png') return DefaultLogo;
  const direct = STATIC_LOGO_MAP[logoFile];
  if (direct) return direct;
  return resolveFromContext(logoFile) ?? DefaultLogo;
};

export const getLogoAsset = (): StaticImageData => {
  const logoFile = (LOGO_DISPLAY.logoFile ?? '').trim();
  if (logoFile === 'random') return resolveRandomLogo();
  return resolveConfiguredLogo(logoFile);
};

export const useLogoAsset = (): StaticImageData => {
  const logoFile = (LOGO_DISPLAY.logoFile ?? '').trim();
  const [randomLogo, setRandomLogo] = useState<StaticImageData>(DefaultLogo);

  useEffect(() => {
    if (logoFile !== 'random') return;
    const timer = window.setTimeout(() => {
      setRandomLogo(resolveRandomLogo());
    }, 0);
    return () => window.clearTimeout(timer);
  }, [logoFile]);

  return logoFile === 'random' ? randomLogo : resolveConfiguredLogo(logoFile);
};
