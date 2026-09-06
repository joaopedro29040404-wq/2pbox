'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Clock3, Loader2, MessageCircle, Save, Store, Truck, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const initial = { name: '2P Box', whatsapp: '', hours: '', pickup: 'Retirada na loja', shipping: 'Frete via WhatsApp' };
type Settings = typeof initial;

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
      if (!supabase) { setError('Supabase não configurado.'); setLoading(false); return; }
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { window.location.href = '/admin/login'; return; }
      const { data: rows, error: err } = await supabase.from('store_settings').select('name,whatsapp,hours,pickup,shipping,updated_at').order('updated_at', { ascending: false, nullsFirst: false }).limit(1);
      if (err) { if (mounted) { setError(err.message); setLoading(false); } return; }
      const row = rows?.[0];
      if (row && mounted) setData({ ...initial, name: row.name || initial.name, whatsapp: row.whatsapp || '', hours: row.hours || '', pickup: row.pickup || initial.pickup, shipping: row.shipping || initial.shipping });
      if (mounted) { setAllowed(true); setLoading(false); }
    }
    load().catch(err => { if (mounted) { setError(err instanceof Error ? err.message : 'Não foi possível carregar as configurações.'); setLoading(false); } });
    return () => { mounted = false; };
  }, []);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase || !allowed) return;
    setSaving(true); setSaved(false); setError('');
    const payload = { name: data.name.trim() || '2P Box', whatsapp: data.whatsapp.trim(), hours: data.hours.trim(), pickup: data.pickup.trim(), shipping: data.shipping.trim(), updated_at: new Date().toISOString() };
    const { data: rows, error: findError } = await supabase.from('store_settings').select('id').order('updated_at', { ascending: false, nullsFirst: false }).limit(1);
    if (findError) { setError(findError.message); setSaving(false); return; }
    const id = rows?.[0]?.id;
    const result = id ? await supabase.from('store_settings').update(payload).eq('id', id) : await supabase.from('store_settings').insert(payload);
    if (result.error) { setError(result.error.message); setSaving(false); return; }
    const { data: savedRows, error: reloadError } = await supabase.from('store_settings').select('name,whatsapp,hours,pickup,shipping,updated_at').order('updated_at', { ascending: false, nullsFirst: false }).limit(1);
    if (reloadError) { setError(`Salvo, mas não foi possível confirmar os dados: ${reloadError.message}`); setSaving(false); return; }
    const savedRow = savedRows?.[0];
    if (savedRow) setData({ ...initial, name: savedRow.name || initial.name, whatsapp: savedRow.whatsapp || '', hours: savedRow.hours || '', pickup: savedRow.pickup || initial.pickup, shipping: savedRow.shipping || initial.shipping });
    setSaved(true); setSaving(false); window.setTimeout(() => setSaved(false), 2500);
  }

  if (!loading && !allowed) return <main className="settings-page"><section className="settings-container settings-section"><div className="settings-alert-card"><ShieldAlert size={30}/><h2>Acesso restrito</h2><p>É necessário estar autenticado para acessar as configurações.</p><Link href="/admin/login" className="settings-primary">Entrar no Admin</Link></div></section></main>;

  return (
    <main className="settings-page">
      <div className="settings-topbar">PAINEL ADMINISTRATIVO <span>•</span> 2P BOX</div>
      <header className="settings-header settings-container">
        <Link href="/admin" className="settings-brand" aria-label="Voltar ao painel"><img src="/logo.pnh.png" alt="2P Box"/><div><strong>CONFIGURAÇÕES</strong><small>ADMINISTRAÇÃO DA LOJA</small></div></Link>
        <Link href="/admin" className="settings-back"><ArrowLeft size={18}/><span>Painel</span></Link>
      </header>
      <section className="settings-container settings-section">
        <div className="settings-heading"><div className="settings-heading-copy"><p className="settings-eyebrow">CONFIGURAÇÕES DA LOJA</p><h1>Configurações</h1><p className="settings-subtitle">Controle as informações que aparecem para seus clientes no site e no checkout.</p></div><div className="settings-status"><span className={saved ? 'status-dot saved' : 'status-dot'}/>{saved ? 'Publicado' : 'Dados da loja'}</div></div>
        {loading ? <div className="settings-loading"><Loader2 size={20} className="spin"/> Carregando configurações...</div> : (
          <form className="settings-card" onSubmit={save}>
            <div className="settings-card-head"><div className="settings-card-icon"><Store size={22}/></div><div><p>INFORMAÇÕES PRINCIPAIS</p><h2>Dados da loja</h2></div></div>
            <div className="settings-grid">
              <label className="settings-field full"><span>Nome da loja</span><input value={data.name} onChange={e=>setData({...data,name:e.target.value})} placeholder="2P Box"/></label>
              <label className="settings-field"><span><MessageCircle size={15}/> WhatsApp</span><input value={data.whatsapp} onChange={e=>setData({...data,whatsapp:e.target.value})} placeholder="(11) 9 9999-9999" inputMode="tel"/><small>Usado no contato e no cálculo de frete pelo WhatsApp.</small></label>
              <label className="settings-field"><span><Clock3 size={15}/> Horário de atendimento</span><input value={data.hours} onChange={e=>setData({...data,hours:e.target.value})} placeholder="Seg–Sex • 9h às 18h"/></label>
              <label className="settings-field"><span><Store size={15}/> Modalidade de retirada</span><input value={data.pickup} onChange={e=>setData({...data,pickup:e.target.value})} placeholder="Retirada na loja"/></label>
              <label className="settings-field"><span><Truck size={15}/> Frete</span><input value={data.shipping} onChange={e=>setData({...data,shipping:e.target.value})} placeholder="Frete via WhatsApp"/></label>
            </div>
            <div className="settings-card-foot"><div><strong>Publicação</strong><p>As alterações são refletidas na loja após salvar.</p></div><button className="settings-primary settings-save" type="submit" disabled={saving}>{saving?<><Loader2 size={18} className="spin"/> Salvando...</>:saved?<><Check size={18}/> Publicado</>:<><Save size={18}/> Salvar alterações</>}</button></div>
            {error && <div className="settings-error" role="alert"><ShieldAlert size={18}/><div><strong>Não foi possível salvar</strong><span>{error}</span></div></div>}
          </form>
        )}
      </section>
      <style jsx>{`
        .settings-page{min-height:100vh;width:100%;overflow-x:hidden;background:#fff;color:#101010;box-sizing:border-box}.settings-page *{box-sizing:border-box}.settings-container{width:min(1180px,calc(100% - 48px));margin:0 auto}.settings-topbar{height:38px;background:#101010;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;letter-spacing:.24em;text-transform:uppercase;white-space:nowrap}.settings-topbar span{color:#ffc400;margin:0 10px}.settings-header{min-height:102px;border-bottom:1px solid #e8e8e8;display:flex;align-items:center;justify-content:space-between;gap:24px}.settings-brand{display:flex;align-items:center;gap:18px;text-decoration:none;color:#101010;min-width:0;flex:1}.settings-brand img{width:145px;height:auto;display:block;object-fit:contain;flex:none}.settings-brand div{min-width:0}.settings-brand strong{display:block;font-size:24px;letter-spacing:-.04em;line-height:1;white-space:nowrap}.settings-brand small{display:block;margin-top:7px;color:#8a8a8a;font-size:9px;font-weight:800;letter-spacing:.16em;white-space:nowrap}.settings-back{display:inline-flex;align-items:center;gap:10px;padding:14px 20px;border:1px solid #171717;border-radius:12px;text-decoration:none;color:#101010;font-weight:800;font-size:14px;background:#fff;flex:none}.settings-back:hover{background:#ffc400;border-color:#ffc400}.settings-section{padding:68px 0 90px}.settings-heading{display:flex;align-items:end;justify-content:space-between;gap:30px;margin-bottom:34px}.settings-heading-copy{min-width:0}.settings-eyebrow{margin:0 0 13px;color:#9a7600;font-size:11px;font-weight:900;letter-spacing:.24em;text-transform:uppercase}.settings-heading h1{font-family:'Barlow Condensed',sans-serif;font-size:76px;line-height:.86;letter-spacing:-.025em;text-transform:uppercase;font-style:italic;margin:0}.settings-subtitle{max-width:650px;color:#747474;font-size:15px;line-height:1.6;margin:17px 0 0}.settings-status{display:flex;align-items:center;gap:8px;border:1px solid #e5e5e5;border-radius:999px;padding:10px 14px;font-size:11px;font-weight:800;white-space:nowrap;flex:none}.status-dot{width:8px;height:8px;border-radius:50%;background:#c7c7c7}.status-dot.saved{background:#2d9b55}.settings-card{border:1px solid #dedede;border-radius:24px;background:#fff;box-shadow:0 18px 50px rgba(16,16,16,.06);overflow:hidden}.settings-card-head{display:flex;align-items:center;gap:15px;padding:30px 34px;border-bottom:1px solid #ececec}.settings-card-icon{width:48px;height:48px;border-radius:14px;background:#ffc400;display:grid;place-items:center;flex:none}.settings-card-head p{margin:0 0 5px;color:#9a7600;font-size:9px;font-weight:900;letter-spacing:.2em}.settings-card-head h2{margin:0;font-family:'Barlow Condensed',sans-serif;text-transform:uppercase;font-size:34px;line-height:1}.settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:22px;padding:30px 34px}.settings-field{display:grid;gap:9px;min-width:0}.settings-field.full{grid-column:1/-1}.settings-field>span{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.05em}.settings-field>span svg{color:#9a7600;flex:none}.settings-field input{width:100%;min-width:0;height:52px;padding:0 16px;border:1px solid #dcdcdc;border-radius:11px;background:#fff;color:#111;font:600 15px Inter,Arial,sans-serif;outline:none}.settings-field input:focus{border-color:#111;box-shadow:0 0 0 3px rgba(255,196,0,.2)}.settings-field small{color:#888;font-size:11px;line-height:1.4}.settings-card-foot{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:23px 34px;background:#fafafa;border-top:1px solid #ececec}.settings-card-foot>div{min-width:0}.settings-card-foot strong{font-size:13px}.settings-card-foot p{margin:4px 0 0;color:#777;font-size:11px}.settings-primary{display:inline-flex;align-items:center;justify-content:center;gap:9px;border:0;border-radius:11px;background:#ffc400;color:#101010;padding:15px 22px;text-decoration:none;font-size:13px;font-weight:900;cursor:pointer}.settings-primary:disabled{opacity:.65;cursor:wait}.settings-save{min-width:190px;flex:none}.settings-error{margin:0 34px 30px;padding:15px 17px;border-radius:12px;background:#fff4f4;border:1px solid #efcaca;color:#a52626;display:flex;gap:12px;align-items:flex-start}.settings-error strong,.settings-error span{display:block}.settings-error span{margin-top:4px;font-size:12px;line-height:1.4;overflow-wrap:anywhere}.settings-loading{min-height:250px;border:1px solid #e8e8e8;border-radius:20px;display:flex;align-items:center;justify-content:center;gap:10px;color:#777;font-size:13px}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.settings-alert-card{max-width:560px;margin:80px auto;padding:40px;border:1px solid #e5e5e5;border-radius:22px;text-align:center}.settings-alert-card svg{color:#a52626}.settings-alert-card h2{font-family:'Barlow Condensed';font-size:38px;text-transform:uppercase;margin:14px 0 8px}.settings-alert-card p{color:#777;margin:0 0 24px}
        @media(max-width:900px){.settings-container{width:calc(100% - 32px)}.settings-brand{gap:12px}.settings-brand img{width:118px}.settings-brand strong{font-size:20px}.settings-back{padding:12px 15px}.settings-heading{align-items:flex-start;flex-direction:column;gap:15px}.settings-status{align-self:flex-start}}
        @media(max-width:700px){.settings-container{width:calc(100% - 28px)}.settings-topbar{height:34px;font-size:8px;letter-spacing:.13em;padding:0 10px}.settings-topbar span{margin:0 6px}.settings-header{width:calc(100% - 28px);min-height:82px;gap:12px}.settings-brand{flex:none}.settings-brand img{width:104px;max-width:30vw}.settings-brand div{display:none}.settings-back{padding:11px 13px;font-size:11px;border-radius:10px;gap:7px}.settings-section{padding:38px 0 56px}.settings-heading{margin-bottom:24px;gap:14px}.settings-eyebrow{font-size:9px;letter-spacing:.19em;margin-bottom:10px}.settings-heading h1{font-size:54px;line-height:.9}.settings-subtitle{font-size:13px;line-height:1.55;margin-top:12px}.settings-status{font-size:10px;padding:9px 12px}.settings-card{border-radius:18px}.settings-card-head{padding:20px 17px;gap:12px}.settings-card-icon{width:40px;height:40px;border-radius:11px}.settings-card-head p{font-size:8px;letter-spacing:.15em}.settings-card-head h2{font-size:27px}.settings-grid{grid-template-columns:1fr;padding:20px 17px;gap:18px}.settings-field.full{grid-column:auto}.settings-field>span{font-size:11px}.settings-field input{height:50px;font-size:14px;padding:0 14px}.settings-field small{font-size:10px}.settings-card-foot{align-items:stretch;flex-direction:column;padding:18px 17px;gap:15px}.settings-save{width:100%;min-width:0}.settings-error{margin:0 17px 18px;padding:13px 14px}.settings-error span{font-size:11px}.settings-loading{min-height:200px;font-size:12px;text-align:center;padding:20px}}
        @media(max-width:380px){.settings-container{width:calc(100% - 24px)}.settings-header{width:calc(100% - 24px);min-height:76px}.settings-brand img{width:92px}.settings-back{padding:10px 11px}.settings-section{padding-top:32px}.settings-heading h1{font-size:48px}.settings-card-head h2{font-size:24px}.settings-grid{padding:18px 14px}.settings-card-foot{padding:16px 14px}.settings-error{margin-left:14px;margin-right:14px}}
      `}</style>
    </main>
  );
}
