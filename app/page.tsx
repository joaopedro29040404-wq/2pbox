'use client';

import { useEffect, useState } from 'react';
import HomeCurrent from '@/components/home/home-current';
import HomeModern from '@/components/home/home-modern';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [template, setTemplate] = useState<'default' | 'modern'>('default');
  useEffect(() => {
    let mounted = true;
    if (!supabase) return;
    supabase.from('store_settings').select('home_template').order('updated_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (mounted) setTemplate(data?.home_template === 'modern' ? 'modern' : 'default'); })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, []);
  return template === 'modern' ? <HomeModern /> : <HomeCurrent />;
}
