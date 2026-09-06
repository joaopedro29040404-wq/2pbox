import { supabase } from '@/lib/supabase';

export type StoreSettings = {
  name: string;
  whatsapp: string;
  hours: string;
  pickup: string;
  shipping: string;
};

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  name: '2P Box',
  whatsapp: '',
  hours: 'Seg–Sex • 9h às 18h',
  pickup: 'Retirada na loja',
  shipping: 'Frete via WhatsApp',
};

export async function getStoreSettings(): Promise<StoreSettings> {
  try {
    const { data, error } = await supabase
      .from('store_settings')
      .select('name,whatsapp,hours,pickup,shipping,updated_at')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return DEFAULT_STORE_SETTINGS;

    return {
      ...DEFAULT_STORE_SETTINGS,
      name: data.name || DEFAULT_STORE_SETTINGS.name,
      whatsapp: data.whatsapp || DEFAULT_STORE_SETTINGS.whatsapp,
      hours: data.hours || DEFAULT_STORE_SETTINGS.hours,
      pickup: data.pickup || DEFAULT_STORE_SETTINGS.pickup,
      shipping: data.shipping || DEFAULT_STORE_SETTINGS.shipping,
    };
  } catch {
    return DEFAULT_STORE_SETTINGS;
  }
}

export function normalizeWhatsApp(value: string) {
  return value.replace(/\D/g, '');
}
