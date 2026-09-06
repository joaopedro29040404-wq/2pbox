'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Store, Loader2, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const initial = {
  name: '2P Box',
  whatsapp: '',
  hours: '',
  pickup: 'Retirada na loja',
  shipping: 'Frete via WhatsApp',
};

type Settings = typeof initial;

export default function SettingsPage() {
  const [data, setData] = useState<Settings>(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [allowed, setAllowed] = useState(false);

  async function loadSettings() {
    if (!supabase) {
      setError('Supabase não configurado.');
      setLoading(false);
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      window.location.href = '/admin/login';
      return;
    }

    const { data: row, error: err } = await supabase
      .from('store_settings')
      .select('id,name,whatsapp,hours,pickup,shipping,updated_at')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    if (row) {
      setData({
        ...initial,
        name: row.name || initial.name,
        whatsapp: row.whatsapp || '',
        hours: row.hours || '',
        pickup: row.pickup || initial.pickup,
        shipping: row.shipping || initial.shipping,
      });
    }

    setAllowed(true);
    setLoading(false);
  }

  useEffect(() => {
    let mounted = true;
    loadSettings().catch((err) => {
      if (mounted) {
        setError(err instanceof Error ? err.message : 'Não foi possível carregar as configurações.');
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !allowed) return;

    setSaving(true);
    setSaved(false);
    setError('');

    const { data: row, error: findError } = await supabase
      .from('store_settings')
      .select('id')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (findError) {
      setError(findError.message);
      setSaving(false);
      return;
    }

    const payload = {
      ...data,
      whatsapp: data.whatsapp.trim(),
      updated_at: new Date().toISOString(),
    };

    const result = row?.id
      ? await supabase.from('store_settings').update(payload).eq('id', row.id).select('id,name,whatsapp,hours,pickup,shipping,updated_at').single()
      : await supabase.from('store_settings').insert(payload).select('id,name,whatsapp,hours,pickup,shipping,updated_at').single();

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    // Recarrega o registro salvo para garantir que a tela e o banco estão sincronizados.
    const savedRow = result.data;
    if (savedRow) {
      setData({
        name: savedRow.name || initial.name,
        whatsapp: savedRow.whatsapp || '',
        hours: savedRow.hours || '',
        pickup: savedRow.pickup || initial.pickup,
        shipping: savedRow.shipping || initial.shipping,
      });
    }

    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
    setSaving(false);
  }

  if (!loading && !allowed) {
    return (
      <main>
        <section className="container section">
          <div className="category">
            <ShieldAlert size={28} />
            <h3>Acesso restrito</h3>
            <p>É necessário estar autenticado para acessar as configurações.</p>
            <Link href="/admin/login" className="primary">Entrar no Admin</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <div className="topbar">Painel administrativo • 2P Box</div>
      <header className="header container">
        <Link href="/admin" className="brand">
          <img className="brand-logo" src="/logo.pnh.png" alt="2P Box" />
          <div><strong>CONFIGURAÇÕES</strong><small>ADMINISTRAÇÃO</small></div>
        </Link>
        <Link href="/admin" className="secondary"><ArrowLeft size={16} /> Painel</Link>
      </header>

      <section className="container section">
        <p className="eyebrow">CONFIGURAÇÕES DA LOJA</p>
        <h1 className="admin-heading">Configurações</h1>

        {loading ? (
          <p><Loader2 size={18} className="spin" /> Carregando configurações...</p>
        ) : (
          <form className="category settings-form" onSubmit={save}>
            <div className="settings-icon"><Store size={25} /></div>
            <h3>Dados da loja</h3>

            <label>Nome da loja
              <input value={data.name} onChange={e => setData({ ...data, name: e.target.value })} />
            </label>
            <label>WhatsApp
              <input value={data.whatsapp} onChange={e => setData({ ...data, whatsapp: e.target.value })} placeholder="(11) 99999-9999" inputMode="tel" />
            </label>
            <label>Horário de atendimento
              <input value={data.hours} onChange={e => setData({ ...data, hours: e.target.value })} />
            </label>
            <label>Modalidade de retirada
              <input value={data.pickup} onChange={e => setData({ ...data, pickup: e.target.value })} />
            </label>
            <label>Frete
              <input value={data.shipping} onChange={e => setData({ ...data, shipping: e.target.value })} />
            </label>

            <button className="primary" type="submit" disabled={saving}>
              {saving ? <><Loader2 size={17} className="spin" /> Salvando...</> : saved ? <><CheckCircle2 size={17} /> Salvo e publicado</> : <><Save size={17} /> Salvar configurações</>}
            </button>

            {error && <p style={{ color: '#b00020', fontSize: 13 }}>Não foi possível salvar: {error}</p>}
            <p className="settings-note">O WhatsApp, horário, retirada e frete salvos aqui são usados pela loja e pelo checkout. O sistema sempre lê a configuração mais recente.</p>
          </form>
        )}
      </section>
    </main>
  );
}
