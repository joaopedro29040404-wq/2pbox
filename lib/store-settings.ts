import { supabase } from '@/lib/supabase';

export type StoreSettings = {
  name: string;
  whatsapp: string;
  hours: string;
  pickup: string;
  shipping: string;
  socialLinks: { instagram: string; tiktok: string; facebook: string; youtube: string; whatsapp: string };
};

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  name: '2P Box',
  whatsapp: '',
  hours: 'Seg–Sex • 9h às 18h',
  pickup: 'Retirada na loja',
  shipping: 'Frete via WhatsApp',
  socialLinks: { instagram: '', tiktok: '', facebook: '', youtube: '', whatsapp: '' },
};

export async function getStoreSettings(): Promise<StoreSettings> {
  try {
    const { data: rows, error } = await supabase
      .from('store_settings')
      .select('name,whatsapp,hours,pickup,shipping,social_links,updated_at')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1);

    if (error || !rows?.length) return DEFAULT_STORE_SETTINGS;

    const data = rows[0];
    return {
      ...DEFAULT_STORE_SETTINGS,
      name: data.name || DEFAULT_STORE_SETTINGS.name,
      whatsapp: data.whatsapp || DEFAULT_STORE_SETTINGS.whatsapp,
      hours: data.hours || DEFAULT_STORE_SETTINGS.hours,
      pickup: data.pickup || DEFAULT_STORE_SETTINGS.pickup,
      shipping: data.shipping || DEFAULT_STORE_SETTINGS.shipping,
      socialLinks: { instagram: String(data.social_links?.instagram || ''), tiktok: String(data.social_links?.tiktok || ''), facebook: String(data.social_links?.facebook || ''), youtube: String(data.social_links?.youtube || ''), whatsapp: String(data.social_links?.whatsapp || '') },
    };
  } catch {
    return DEFAULT_STORE_SETTINGS;
  }
}

export function normalizeWhatsApp(value: string) {
  return value.replace(/\D/g, '');
}
