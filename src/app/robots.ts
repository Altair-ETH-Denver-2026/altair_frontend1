import type { MetadataRoute } from 'next';
import { SITE_URL, SITE_ROBOTS_RULES } from '../../config/site_metadata';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: SITE_ROBOTS_RULES,
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
