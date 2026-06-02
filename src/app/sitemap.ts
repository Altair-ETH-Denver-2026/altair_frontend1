import type { MetadataRoute } from 'next';
import { SITE_URL, SITE_SITEMAP_ROUTES } from '../../config/site_metadata';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return SITE_SITEMAP_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.url}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
