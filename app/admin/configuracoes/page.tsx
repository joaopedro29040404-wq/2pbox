'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Clock3, MessageCircle, Save, ShieldAlert, Store, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SiteHeader } from '@/components/site-header';
import { TextField } from '@/components/ui/field';
import { InlineLoader, PageLoader } from '@/components/ui/loader';
import { useToast } from '@/components/ui/toast';

const initial = {
  name: '2P Box',
  whatsapp: '',
  hours: '',
  pickup: 'Retirada na loja',
  shipping: 'Frete via WhatsApp',
};

type Settings = typeof initial;
type StoreRow = Settings & { id: string; updated_at?: string | null };

const SELECT = 'id,name,whatsapp,hours,pickup,shipping,updated_at';

export default function SettingsPage() {
  const [data, setData] = useState<Settings>(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!supabase) {
        if (mounted) setLoading(false);
        return;
      }
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        window.location.href = '/admin/login';
        return;
      }
      const { data: rows, error } = await supabase
        .from('store_settings')
        .select(SELECT)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(1);
      if (!mounted) return;
      if (error) {
        toast.error('Não foi possível carregar as configurações', error.message);
        setLoading(false);
        return;
      }
      const row = rows?.[0] as StoreRow | undefined;
      if (row) {
        setData({
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

    load().catch((error) => {
      if (!mounted) return;
      toast.error('Não foi possível carregar as configurações', error instanceof Error ? error.message : undefined);
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [toast]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !allowed || saving) return;

    setSaving(true);
    setSaved(false);
    const payload = {
      name: data.name.trim() || '2P Box',
      whatsapp: data.whatsapp.trim(),
      hours: data.hours.trim(),
      pickup: data.pickup.trim() || 'Retirada na loja',
      shipping: data.shipping.trim() || 'Frete via WhatsApp',
      updated_at: new Date().toISOString(),
    };

    try {
      const { data: rows, error: findError } = await supabase
        .from('store_settings')
        .select('id')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(1);
      if (findError) throw findError;

      const id = rows?.[0]?.id as string | undefined;
      const result = id
        ? await supabase.from('store_settings').update(payload).eq('id', id)
        : await supabase.from('store_settings').insert(payload);
      if (result.error) throw result.error;

      setSaved(true);
      toast.success('Configurações publicadas', 'A loja já está usando os novos dados.');
      window.setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      toast.error('Não foi possível salvar', error instanceof Error ? error.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="settings-page">
        <SiteHeader variant="admin" subtitle="CONFIGURAÇÕES" />
        <PageLoader title="Carregando configurações" description="Buscando os dados atuais da loja." />
      </main>
    );
  }

  if (!allowed) {
    return (
      <main className="settings-page">
        <SiteHeader variant="admin" subtitle="CONFIGURAÇÕES" />
        <section className="settings-container settings-section">
          <div className="settings-alert-card">
            <ShieldAlert size={30} />
            <h2>Acesso restrito</h2>
            <p>É necessário estar autenticado para acessar as configurações.</p>
            <Link href="/admin/login" className="settings-primary">
              Entrar no Admin
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="settings-page">
      <SiteHeader variant="admin" subtitle="CONFIGURAÇÕES" />
      <section className="settings-container settings-section">
        <div className="settings-heading">
          <div>
            <p className="settings-eyebrow">CONFIGURAÇÕES DA LOJA</p>
            <h1>Configurações</h1>
            <p className="settings-subtitle">Edite os dados que aparecem no site e são usados no checkout. A loja sempre lê a configuração mais recente.</p>
          </div>
          <div className="settings-status">
            <span className={saved ? 'status-dot saved' : 'status-dot'} />
            {saved ? 'Alterações publicadas' : 'Dados da loja'}
          </div>
        </div>

        <form className="settings-card" onSubmit={save}>
          <div className="settings-card-head">
            <div className="settings-card-icon">
              <Store size={22} />
            </div>
            <div>
              <p>INFORMAÇÕES PRINCIPAIS</p>
              <h2>Dados da loja</h2>
            </div>
          </div>

          <div className="settings-grid">
            <TextField label="Nome da loja" placeholder="2P Box" value={data.name} onValueChange={(value) => setData({ ...data, name: value })} fullWidth />
            <TextField
              label={<><MessageCircle size={15} /> WhatsApp</>}
              mask="phone"
              inputMode="tel"
              placeholder="(11) 9 9999-9999"
              hint="Contato e cálculo de frete pelo WhatsApp."
              value={data.whatsapp}
              onValueChange={(value) => setData({ ...data, whatsapp: value })}
            />
            <TextField
              label={<><Clock3 size={15} /> Horário de atendimento</>}
              placeholder="Seg–Sex • 9h às 18h"
              value={data.hours}
              onValueChange={(value) => setData({ ...data, hours: value })}
            />
            <TextField
              label={<><Store size={15} /> Modalidade de retirada</>}
              placeholder="Retirada na loja"
              value={data.pickup}
              onValueChange={(value) => setData({ ...data, pickup: value })}
            />
            <TextField
              label={<><Truck size={15} /> Frete</>}
              placeholder="Frete via WhatsApp"
              value={data.shipping}
              onValueChange={(value) => setData({ ...data, shipping: value })}
            />
          </div>

          <div className="settings-card-foot">
            <div>
              <strong>Publicação</strong>
              <p>Salvar atualiza a configuração usada pela loja imediatamente.</p>
            </div>
            <button className="settings-primary settings-save" type="submit" disabled={saving}>
              {saving ? <InlineLoader label="Salvando..." /> : saved ? <><Check size={18} /> Publicado</> : <><Save size={18} /> Salvar alterações</>}
            </button>
          </div>
        </form>
      </section>

      <style jsx global>{`
        .settings-page{min-height:100vh;background:#f6f6f3;color:#111;font-family:Inter,Arial,sans-serif}
        .settings-container{width:min(1180px,calc(100% - 40px));margin:0 auto}
        .settings-section{padding:48px 0 80px}
        .settings-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:28px;margin-bottom:30px}
        .settings-heading>div:first-child{min-width:0}
        .settings-eyebrow{margin:0 0 12px;color:#9a7200;font:900 10px Inter,Arial,sans-serif;letter-spacing:.3em}
        .settings-heading h1{margin:0;font-family:'Barlow Condensed',Inter,sans-serif;font-size:66px;line-height:.86;letter-spacing:-.025em;font-style:italic;text-transform:uppercase}
        .settings-subtitle{max-width:700px;margin:16px 0 0;color:#747474;font-size:14px;line-height:1.6}
        .settings-status{display:flex;align-items:center;gap:8px;padding:9px 13px;border:1px solid #e3e3e3;background:#fff;border-radius:999px;white-space:nowrap;font:800 10px Inter,Arial,sans-serif;flex:none}
        .status-dot{width:8px;height:8px;border-radius:50%;background:#bbb}
        .status-dot.saved{background:#2e9954}
        .settings-card{border:1px solid #dedede;border-radius:20px;background:#fff;box-shadow:0 16px 45px rgba(0,0,0,.055);overflow:hidden}
        .settings-card-head{display:flex;align-items:center;gap:14px;padding:26px 30px;border-bottom:1px solid #ececec}
        .settings-card-icon{width:46px;height:46px;display:grid;place-items:center;background:#ffc400;border-radius:13px;flex:none}
        .settings-card-head p{margin:0 0 4px;color:#9a7200;font:900 9px Inter,Arial,sans-serif;letter-spacing:.2em}
        .settings-card-head h2{margin:0;font-family:'Barlow Condensed',Inter,sans-serif;font-size:31px;line-height:1;text-transform:uppercase}
        .settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;padding:30px}
        .settings-card-foot{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:21px 30px;background:#fafafa;border-top:1px solid #ececec}
        .settings-card-foot strong{font-size:12px}
        .settings-card-foot p{margin:4px 0 0;color:#777;font-size:10px}
        .settings-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 22px;border:0;border-radius:10px;background:#ffc400;color:#111;text-decoration:none;font:900 12px Inter,Arial,sans-serif;cursor:pointer}
        .settings-primary:disabled{opacity:.7;cursor:wait}
        .settings-save{min-width:190px;flex:none}
        .settings-alert-card{max-width:520px;margin:60px auto;padding:38px;background:#fff;border:1px solid #e5e5e5;border-radius:20px;text-align:center}
        .settings-alert-card svg{color:#a52626}
        .settings-alert-card h2{margin:13px 0 7px;font-family:'Barlow Condensed',Inter,sans-serif;font-size:36px;text-transform:uppercase}
        .settings-alert-card p{color:#777;font-size:13px;margin:0 0 20px}
        @media(max-width:900px){
          .settings-container{width:min(100% - 28px,760px)}
          .settings-heading{align-items:flex-start;flex-direction:column;gap:16px}
          .settings-heading h1{font-size:54px}
          .settings-status{align-self:flex-start}
          .settings-card-head,.settings-grid,.settings-card-foot{padding-left:20px;padding-right:20px}
          .settings-grid{grid-template-columns:1fr;gap:18px}
        }
        @media(max-width:620px){
          .settings-section{padding:32px 0 56px}
          .settings-heading h1{font-size:42px}
          .settings-subtitle{font-size:12px}
          .settings-card{border-radius:16px}
          .settings-card-head h2{font-size:26px}
          .settings-card-foot{align-items:stretch;flex-direction:column;gap:14px}
          .settings-save{width:100%;min-width:0}
        }
      `}</style>
    </main>
  );
}
