import type { Metadata } from 'next';
import { getSiteUrl } from '@/lib/server/env';
import { getAdminSupabase } from '@/lib/server/supabase-admin';

type ProductMetadataProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ProductMetadataProps): Promise<Metadata> {
  const { slug } = await params;
  const client = getAdminSupabase();
  const canonical = `${getSiteUrl()}/produto/${encodeURIComponent(slug)}`;
  if (!client) return { alternates: { canonical } };

  const { data } = await client
    .from('products')
    .select('name,description,image_url,images')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();

  if (!data) {
    return {
      title: 'Produto | 2P Box',
      alternates: { canonical },
      robots: { index: false, follow: false },
    };
  }

  const title = `${String(data.name || 'Produto')} | 2P Box`;
  const description = String(data.description || 'Encontre este produto na 2P Box.').trim().slice(0, 160);
  const image = (Array.isArray(data.images) ? data.images.find(Boolean) : null) || data.image_url || '/logo.pnh.png';

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, type: 'website', locale: 'pt_BR', url: canonical, images: [String(image)] },
    twitter: { card: 'summary_large_image', title, description, images: [String(image)] },
  };
}

export default function ProductLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
