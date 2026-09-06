'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Clock3, Loader2, MessageCircle, Save, ShieldAlert, Store, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const initial = {
  name: '2P Box',
  whatsapp: '',
  hours: '',
  pickup: 'Retirada na loja',
  shipping: 'Frete via WhatsApp',
};

type Settings = typeof initial;

type StoreRow = Settings & { id: string; updated_at?: string | null };

export default function SettingsPage() {
  const [data, setData] = useState<Settings>(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!supabase) {
        if (mounted) { setError('Supabase não configurado.'); setLoading(false); }
        return;
      }

      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        window.location.href = '/admin/login';
        return;
      }

      const { data: rows, error: err } = await supabase
        .from('store_settings')
        .select('id,name,whatsapp,hours,pickup,shipping,updated_at')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(1);

      if (!mounted) return;
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }

      const row = rows?.[0] as StoreRow | undefined;
      if (row) setData({
        name: row.name || initial.name,
        whatsapp: row.whatsapp || '',
        hours: row.hours || '',
        pickup: row.pickup || initial.pickup,
        shipping: row.shipping || initial.shipping,
      });

      setAllowed(true);
      setLoading(false);
    }

    load().catch((err) => {
      if (mounted) {
        setError(err instanceof Error ? err.message : 'Não foi possível carregar as configurações.');
        setLoading(false);
      }
    });

    return () => { mounted = false; };
  }, []);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !allowed || saving) return;

    setSaving(true);
    setSaved(false);
    setError('');

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

      const { data: savedRows, error: reloadError } = await supabase
        .from('store_settings')
        .select('name,whatsapp,hours,pickup,shipping,updated_at')
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(1);

      if (reloadError) throw reloadError;
      const row = savedRows?.[0];
      if (row) {
        setData({
          name: row.name || '2P Box',
          whatsapp: row.whatsapp || '',
          hours: row.hours || '',
          pickup: row.pickup || 'Retirada na loja',
          shipping: row.shipping || 'Frete via WhatsApp',
        });
      }

      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar as configurações.');
    } finally {
      setSaving(false);
    }
  }

  if (!loading && !allowed) {
    return (
      <main className="settings-page">
        <section className="settings-container settings-section">
          <div className="settings-alert-card">
            <ShieldAlert size={30} />
            <h2>Acesso restrito</h2>
            <p>É necessário estar autenticado para acessar as configurações.</p>
            <Link href="/admin/login" className="settings-primary">Entrar no Admin</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="settings-page">
      <div className="settings-topbar">PAINEL ADMINISTRATIVO <span>•</span> 2P BOX</div>

      <header className="settings-header">
        <div className="settings-container settings-header-inner">
          <Link href="/admin" className="settings-brand" aria-label="Voltar ao painel">
            <img src="/logo.pnh.png" alt="2P Box" />
            <div className="settings-brand-copy">
              <strong>CONFIGURAÇÕES</strong>
              <small>ADMINISTRAÇÃO DA LOJA</small>
            </div>
          </Link>
          <Link href="/admin" className="settings-back"><ArrowLeft size={18} /><span>Painel</span></Link>
        </div>
      </header>

      <section className="settings-container settings-section">
        <div className="settings-heading">
          <div>
            <p className="settings-eyebrow">CONFIGURAÇÕES DA LOJA</p>
            <h1>Configurações</h1>
            <p className="settings-subtitle">Edite os dados que aparecem no site e são usados no checkout. O site sempre lê a configuração mais recente.</p>
          </div>
          <div className="settings-status"><span className={saved ? 'status-dot saved' : 'status-dot'} />{saved ? 'Alterações publicadas' : 'Dados da loja'}</div>
        </div>

        {loading ? (
          <div className="settings-loading"><Loader2 size={20} className="spin" /> Carregando configurações...</div>
        ) : (
          <form className="settings-card" onSubmit={save}>
            <div className="settings-card-head">
              <div className="settings-card-icon"><Store size={22} /></div>
              <div><p>INFORMAÇÕES PRINCIPAIS</p><h2>Dados da loja</h2></div>
            </div>

            <div className="settings-grid">
              <label className="settings-field full">
                <span>Nome da loja</span>
                <input value={data.name} onChange={e => setData({ ...data, name: e.target.value })} placeholder="2P Box" />
              </label>
              <label className="settings-field">
                <span><MessageCircle size={15} /> WhatsApp</span>
                <input value={data.whatsapp} onChange={e => setData({ ...data, whatsapp: e.target.value })} placeholder="(11) 9 9999-9999" inputMode="tel" />
                <small>Contato e cálculo de frete pelo WhatsApp.</small>
              </label>
              <label className="settings-field">
                <span><Clock3 size={15} /> Horário de atendimento</span>
                <input value={data.hours} onChange={e => setData({ ...data, hours: e.target.value })} placeholder="Seg–Sex • 9h às 18h" />
              </label>
              <label className="settings-field">
                <span><Store size={15} /> Modalidade de retirada</span>
                <input value={data.pickup} onChange={e => setData({ ...data, pickup: e.target.value })} placeholder="Retirada na loja" />
              </label>
              <label className="settings-field">
                <span><Truck size={15} /> Frete</span>
                <input value={data.shipping} onChange={e => setData({ ...data, shipping: e.target.value })} placeholder="Frete via WhatsApp" />
              </label>
            </div>

            <div className="settings-card-foot">
              <div><strong>Publicação</strong><p>Salvar atualiza a configuração usada pela loja.</p></div>
              <button className="settings-primary settings-save" type="submit" disabled={saving}>
                {saving ? <><Loader2 size={18} className="spin" /> Salvando...</> : saved ? <><Check size={18} /> Publicado</> : <><Save size={18} /> Salvar alterações</>}
              </button>
            </div>

            {error && <div className="settings-error" role="alert"><ShieldAlert size={18} /><div><strong>Não foi possível salvar</strong><span>{error}</span></div></div>}
          </form>
        )}
      </section>

      <style jsx>{`
        .settings-page{min-height:100vh;background:#fff;color:#111;overflow-x:hidden;font-family:Inter,Arial,sans-serif}
        .settings-page *{box-sizing:border-box}
        .settings-container{width:min(1180px,calc(100% - 56px));margin:0 auto}
        .settings-topbar{height:38px;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;letter-spacing:.24em;text-transform:uppercase;white-space:nowrap}
        .settings-topbar span{color:#ffc400;margin:0 10px}
        .settings-header{background:#fff;border-bottom:1px solid #e7e7e7}
        .settings-header-inner{min-height:102px;display:flex;align-items:center;justify-content:space-between;gap:20px}
        .settings-brand{display:flex;align-items:center;gap:18px;min-width:0;text-decoration:none;color:#111}
        .settings-brand img{width:96px;height:64px;object-fit:contain;display:block;flex:none}
        .settings-brand-copy{min-width:0}
        .settings-brand-copy strong{display:block;font-size:22px;line-height:1;letter-spacing:-.035em;white-space:nowrap}
        .settings-brand-copy small{display:block;margin-top:7px;color:#888;font-size:9px;font-weight:800;letter-spacing:.15em;white-space:nowrap}
        .settings-back{display:inline-flex;align-items:center;gap:9px;flex:none;padding:14px 19px;border:1px solid #171717;border-radius:12px;color:#111;background:#fff;text-decoration:none;font-size:13px;font-weight:900}
        .settings-back:hover{background:#ffc400;border-color:#ffc400}
        .settings-section{padding:62px 0 90px}
        .settings-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:28px;margin-bottom:32px}
        .settings-heading>div:first-child{min-width:0}
        .settings-eyebrow{margin:0 0 12px;color:#9a7200;font-size:10px;font-weight:900;letter-spacing:.3em}
        .settings-heading h1{margin:0;font-family:'Barlow Condensed',Inter,sans-serif;font-size:70px;line-height:.86;letter-spacing:-.025em;font-style:italic;text-transform:uppercase}
        .settings-subtitle{max-width:700px;margin:16px 0 0;color:#747474;font-size:14px;line-height:1.6}
        .settings-status{display:flex;align-items:center;gap:8px;padding:9px 13px;border:1px solid #e3e3e3;border-radius:999px;white-space:nowrap;font-size:10px;font-weight:800;flex:none}
        .status-dot{width:8px;height:8px;border-radius:50%;background:#bbb}.status-dot.saved{background:#2e9954}
        .settings-card{border:1px solid #dedede;border-radius:22px;background:#fff;box-shadow:0 16px 45px rgba(0,0,0,.055);overflow:hidden}
        .settings-card-head{display:flex;align-items:center;gap:14px;padding:27px 32px;border-bottom:1px solid #ececec}
        .settings-card-icon{width:46px;height:46px;display:grid;place-items:center;background:#ffc400;border-radius:13px;flex:none}
        .settings-card-head p{margin:0 0 4px;color:#9a7200;font-size:9px;font-weight:900;letter-spacing:.2em}.settings-card-head h2{margin:0;font-family:'Barlow Condensed',Inter,sans-serif;font-size:31px;line-height:1;text-transform:uppercase}
        .settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;padding:30px 32px}
        .settings-field{display:grid;gap:8px;min-width:0}.settings-field.full{grid-column:1/-1}
        .settings-field>span{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:900;letter-spacing:.04em;text-transform:uppercase}.settings-field>span svg{color:#9a7200}
        .settings-field input{width:100%;height:52px;padding:0 15px;border:1px solid #dcdcdc;border-radius:11px;background:#fff;color:#111;outline:none;font:600 14px Inter,Arial,sans-serif}.settings-field input:focus{border-color:#111;box-shadow:0 0 0 3px rgba(255,196,0,.18)}
        .settings-field small{color:#888;font-size:10px;line-height:1.4}
        .settings-card-foot{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:21px 32px;background:#fafafa;border-top:1px solid #ececec}.settings-card-foot strong{font-size:12px}.settings-card-foot p{margin:4px 0 0;color:#777;font-size:10px}
        .settings-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 20px;border:0;border-radius:10px;background:#ffc400;color:#111;text-decoration:none;font-size:12px;font-weight:900;cursor:pointer}.settings-primary:disabled{opacity:.65;cursor:wait}.settings-save{min-width:190px;flex:none}
        .settings-error{margin:0 32px 28px;padding:14px 16px;border:1px solid #edcaca;border-radius:11px;background:#fff5f5;color:#a52626;display:flex;gap:10px;align-items:flex-start}.settings-error strong,.settings-error span{display:block}.settings-error span{margin-top:3px;font-size:11px;line-height:1.45;overflow-wrap:anywhere}
        .settings-loading{min-height:250px;border:1px solid #e7e7e7;border-radius:18px;display:flex;align-items:center;justify-content:center;gap:9px;color:#777;font-size:12px}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
        .settings-alert-card{max-width:520px;margin:60px auto;padding:38px;border:1px solid #e5e5e5;border-radius:20px;text-align:center}.settings-alert-card svg{color:#a52626}.settings-alert-card h2{margin:13px 0 7px;font-family:'Barlow Condensed',Inter,sans-serif;font-size:36px;text-transform:uppercase}.settings-alert-card p{color:#777;font-size:13px;margin:0 0 20px}
        @media(max-width:900px){.settings-container{width:min(100% - 36px,680px)}.settings-header-inner{min-height:88px}.settings-brand img{width:76px;height:54px}.settings-brand-copy strong{font-size:18px}.settings-brand-copy small{font-size:8px}.settings-heading{align-items:flex-start;flex-direction:column;gap:16px}.settings-heading h1{font-size:58px}.settings-status{align-self:flex-start}.settings-card-head,.settings-grid,.settings-card-foot{padding-left:22px;padding-right:22px}}
        @media(max-width:620px){.settings-topbar{height:32px;font-size:8px;letter-spacing:.17em}.settings-topbar span{margin:0 7px}.settings-container{width:calc(100% - 28px)}.settings-header-inner{min-height:76px;gap:10px}.settings-brand{gap:9px}.settings-brand img{width:58px;height:46px}.settings-brand-copy strong{font-size:14px}.settings-brand-copy small{margin-top:4px;font-size:6px;letter-spacing:.1em}.settings-back{padding:10px 11px;border-radius:10px;font-size:11px}.settings-back svg{width:15px;height:15px}.settings-section{padding:38px 0 60px}.settings-eyebrow{font-size:8px;letter-spacing:.23em;margin-bottom:10px}.settings-heading h1{font-size:43px}.settings-subtitle{font-size:12px;line-height:1.55;margin-top:12px}.settings-status{font-size:9px;padding:8px 11px}.settings-card{border-radius:17px}.settings-card-head{padding:20px 17px;gap:11px}.settings-card-icon{width:40px;height:40px;border-radius:11px}.settings-card-icon svg{width:19px}.settings-card-head p{font-size:7px}.settings-card-head h2{font-size:25px}.settings-grid{grid-template-columns:1fr;gap:17px;padding:20px 17px}.settings-field.full{grid-column:auto}.settings-field>span{font-size:10px}.settings-field input{height:49px;font-size:13px;padding:0 13px}.settings-card-foot{align-items:stretch;flex-direction:column;padding:18px 17px;gap:15px}.settings-card-foot p{font-size:9px}.settings-save{width:100%;min-width:0;height:49px}.settings-error{margin:0 17px 18px;padding:12px 13px}.settings-error span{font-size:10px}.settings-alert-card{margin:35px auto;padding:28px 20px}}
        @media(max-width:370px){.settings-brand-copy small{display:none}.settings-brand-copy strong{font-size:12px}.settings-brand img{width:52px}.settings-back span{display:none}.settings-back{width:40px;height:40px;padding:0;justify-content:center}.settings-heading h1{font-size:39px}}
      `}</style>
    </main>
  );
}
