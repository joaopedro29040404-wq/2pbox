import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/server/env';
import { getAdminSupabase } from '@/lib/server/supabase-admin';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = getSiteUrl();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: site, changeFrequency: 'daily', priority: 1 },
    { url: `${site}/loja`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${site}/impressao`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${site}/acompanhar-pedido`, changeFrequency: 'monthly', priority: 0.3 },
  ];

  const client = getAdminSupabase();
  if (!client) return staticRoutes;

  const { data, error } = await client
    .from('products')
    .select('slug,updated_at')
    .eq('active', true)
    .not('slug', 'is', null)
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(5000);

  if (error || !Array.isArray(data)) return staticRoutes;

  const products: MetadataRoute.Sitemap = data
    .filter((product) => String(product.slug || '').trim())
    .map((product) => ({
      url: `${site}/produto/${encodeURIComponent(String(product.slug))}`,
      lastModified: product.updated_at || undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }));

  return [...staticRoutes, ...products];
}
