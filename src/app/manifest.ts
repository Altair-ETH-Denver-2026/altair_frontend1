import type { MetadataRoute } from 'next';
import {
  SITE_NAME,
  SITE_DESCRIPTION,
  SITE_THEME_COLOR,
  SITE_PWA_SHORT_NAME,
  SITE_PWA_BACKGROUND_COLOR,
  SITE_PWA_DISPLAY,
  SITE_PWA_START_URL,
  SITE_PWA_ICONS,
} from '../../config/site_metadata';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_PWA_SHORT_NAME,
    description: SITE_DESCRIPTION,
    start_url: SITE_PWA_START_URL,
    display: SITE_PWA_DISPLAY,
    background_color: SITE_PWA_BACKGROUND_COLOR,
    theme_color: SITE_THEME_COLOR,
    icons: SITE_PWA_ICONS,
  };
}
