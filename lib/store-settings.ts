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
      .select('name,whatsapp,hours,pickup,shipping')
      .limit(1)
      .maybeSingle();

    if (error || !data) return DEFAULT_STORE_SETTINGS;

    return {
      ...DEFAULT_STORE_SETTINGS,
      ...data,
      whatsapp: data.whatsapp || DEFAULT_STORE_SETTINGS.whatsapp,
      hours: data.hours || DEFAULT_STORE_SETTINGS.hours,
    };
  } catch {
    return DEFAULT_STORE_SETTINGS;
  }
}

export function normalizeWhatsApp(value: string) {
  return value.replace(/\D/g, '');
}
