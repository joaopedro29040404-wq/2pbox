'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, FolderTree, Plus, Power, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Category = { id: string; name: string; description: string | null; active: boolean };

export default function CategoriesAdminPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase.from('categories').select('*').order('name');
    if (error) setMessage(error.message);
    setItems((data ?? []) as Category[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const cleanName = name.trim();
    if (!cleanName) return;
    const slug = cleanName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
    const { error } = await supabase.from('categories').insert({ name: cleanName, description: description.trim(), slug });
    if (error) setMessage(error.message); else { setMessage('Categoria criada!'); setName(''); setDescription(''); load(); }
  }
  async function toggle(id: string, active: boolean) { if (!supabase) return; const { error } = await supabase.from('categories').update({ active: !active }).eq('id', id); if (error) setMessage(error.message); else load(); }
  async function remove(id: string) { if (!supabase || !confirm('Excluir esta categoria?')) return; const { error } = await supabase.from('categories').delete().eq('id', id); if (error) setMessage(error.message); else load(); }

  return <main className="admin-categories">
    <div className="cat-topbar">2P BOX <span>•</span> CATEGORIAS</div>
    <header className="cat-header"><div className="cat-header-inner"><Link href="/admin" className="cat-brand"><span className="cat-mark">2P</span><span><strong>2P BOX</strong><small>ADMINISTRAÇÃO</small></span></Link><Link className="cat-back" href="/admin"><ArrowLeft size={16} /> Painel</Link></div></header>
    <section className="cat-content">
      <div className="cat-breadcrumb"><Link href="/admin">Painel</Link><span>/</span><strong>Categorias</strong></div>
      <div className="cat-heading"><div><p>CATÁLOGO</p><h1>Categorias</h1><span>Organize os produtos da loja por departamentos.</span></div><div className="cat-count"><strong>{items.length}</strong><span>categorias</span></div></div>
      <div className="cat-layout">
        <form onSubmit={add} className="cat-create"><div className="cat-card-icon"><FolderTree size={20} /></div><p className="cat-kicker">NOVA CATEGORIA</p><h2>Adicionar categoria</h2><p className="cat-help">Crie uma categoria clara e fácil de encontrar no catálogo.</p><label>Nome<input required placeholder="Ex.: Eletrônicos" value={name} onChange={e => setName(e.target.value)} /></label><label>Descrição <small>opcional</small><input placeholder="Breve descrição" value={description} onChange={e => setDescription(e.target.value)} /></label><button className="cat-primary" type="submit"><Plus size={17} /> Criar categoria</button></form>
        <div className="cat-list-card"><div className="cat-list-head"><div><p className="cat-kicker">CATÁLOGO</p><h2>Categorias cadastradas</h2></div><span>{items.filter(i => i.active).length} ativas</span></div>{message && <div className="cat-message">{message}</div>}{loading ? <div className="cat-empty">Carregando categorias...</div> : items.length === 0 ? <div className="cat-empty"><FolderTree size={30} /><strong>Nenhuma categoria</strong><span>Crie a primeira categoria ao lado.</span></div> : <div className="cat-list">{items.map(c => <article className={`cat-item ${c.active ? '' : 'inactive'}`} key={c.id}><div className="cat-item-icon"><FolderTree size={18} /></div><div className="cat-item-copy"><h3>{c.name}</h3><p>{c.description || 'Sem descrição cadastrada.'}</p><span><i className={c.active ? 'on' : ''} />{c.active ? 'Ativa na loja' : 'Inativa'}</span></div><div className="cat-actions"><button type="button" onClick={() => toggle(c.id, c.active)} title={c.active ? 'Desativar' : 'Ativar'}>{c.active ? <Power size={15} /> : <Check size={15} />}</button><button type="button" className="danger" onClick={() => remove(c.id)} title="Excluir"><Trash2 size={15} /></button></div></article>)}</div>}</div>
      </div>
      <Link href="/admin" className="cat-bottom-back"><ArrowLeft size={16} /> Painel</Link>
    </section>
    <style jsx global>{`
      .admin-categories{min-height:100vh;background:#f6f6f3;color:#111;font-family:Inter,Arial,sans-serif}.cat-topbar{height:34px;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;gap:9px;font-size:9px;font-weight:800;letter-spacing:.2em}.cat-topbar:first-letter{color:#ffc400}.cat-topbar span{color:#ffc400}.cat-header{background:#fff;border-bottom:1px solid #e5e5e2}.cat-header-inner{width:min(1180px,calc(100% - 40px));min-height:82px;margin:auto;display:flex;align-items:center;justify-content:space-between;gap:15px}.cat-brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:#111}.cat-brand>span:last-child{display:grid;gap:3px}.cat-brand strong{font-size:14px;letter-spacing:.08em}.cat-brand small{font-size:8px;color:#888;font-weight:800;letter-spacing:.13em}.cat-mark{width:48px;height:42px;border-radius:11px;background:#ffc400;display:grid;place-items:center;font-family:'Barlow Condensed';font-size:23px;font-style:italic;font-weight:800}.cat-back{height:42px;padding:0 14px;border:1px solid #ddd;border-radius:10px;display:inline-flex;align-items:center;gap:7px;text-decoration:none;font-size:12px;font-weight:800;background:#fff}.cat-content{width:min(1180px,calc(100% - 40px));margin:auto;padding:30px 0 70px}.cat-breadcrumb{display:flex;gap:8px;color:#777;font-size:12px;margin-bottom:26px}.cat-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:26px}.cat-heading p,.cat-kicker{margin:0 0 8px;color:#a07800;font-size:10px;font-weight:900;letter-spacing:.2em}.cat-heading h1{margin:0;font-family:'Barlow Condensed';font-size:64px;line-height:.88;font-style:italic;text-transform:uppercase}.cat-heading>div:first-child>span{display:block;color:#777;font-size:13px;margin-top:12px}.cat-count{background:#fff;border:1px solid #e1e1dd;border-radius:12px;padding:11px 15px;display:flex;align-items:baseline;gap:7px}.cat-count strong{font-size:22px}.cat-count span{font-size:10px;color:#777}.cat-layout{display:grid;grid-template-columns:330px minmax(0,1fr);gap:18px;align-items:start}.cat-create,.cat-list-card{background:#fff;border:1px solid #e1e1dd;border-radius:18px;box-shadow:0 5px 18px rgba(0,0,0,.025)}.cat-create{padding:21px}.cat-card-icon{width:42px;height:42px;border-radius:11px;background:#ffc400;display:grid;place-items:center;margin-bottom:15px}.cat-create h2,.cat-list-head h2{font-family:'Barlow Condensed';text-transform:uppercase;font-size:26px;margin:0 0 6px}.cat-help{color:#777;font-size:11px;line-height:1.5;margin:0 0 19px}.cat-create label{display:grid;gap:7px;font-size:10px;font-weight:900;margin-top:14px}.cat-create label small{font-weight:500;color:#999}.cat-create input{height:46px;border:1px solid #ddd;border-radius:9px;padding:0 12px;outline:0;font:inherit;font-weight:500}.cat-create input:focus{border-color:#111;box-shadow:0 0 0 3px rgba(255,196,0,.15)}.cat-primary{width:100%;height:46px;border:0;border-radius:10px;background:#111;color:#fff;display:inline-flex;align-items:center;justify-content:center;gap:7px;font:800 12px Inter,Arial,sans-serif;margin-top:18px;cursor:pointer}.cat-list-card{overflow:hidden}.cat-list-head{display:flex;justify-content:space-between;align-items:center;padding:21px;border-bottom:1px solid #eee}.cat-list-head p{margin-bottom:7px}.cat-list-head h2{font-size:25px}.cat-list-head>span{font-size:10px;color:#777;background:#f3f3ef;padding:7px 9px;border-radius:999px;font-weight:800}.cat-message{margin:14px 17px 0;padding:10px;border-radius:9px;background:#fff8d9;border:1px solid #f0dc82;font-size:11px}.cat-list{padding:10px 14px 14px}.cat-item{display:flex;align-items:center;gap:12px;padding:13px 7px;border-bottom:1px solid #eee}.cat-item:last-child{border-bottom:0}.cat-item.inactive{opacity:.62}.cat-item-icon{width:38px;height:38px;border-radius:10px;background:#f2f2ee;display:grid;place-items:center;flex:none;color:#555}.cat-item-copy{min-width:0;flex:1}.cat-item-copy h3{margin:0 0 3px;font-size:14px}.cat-item-copy p{margin:0;color:#777;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cat-item-copy span{display:flex;align-items:center;gap:5px;color:#888;font-size:9px;margin-top:6px}.cat-item-copy i{width:6px;height:6px;border-radius:50%;background:#aaa}.cat-item-copy i.on{background:#31a258}.cat-actions{display:flex;gap:6px}.cat-actions button{width:34px;height:34px;border:0;border-radius:8px;background:#eee;display:grid;place-items:center;cursor:pointer}.cat-actions button.danger{color:#a22}.cat-empty{min-height:190px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:#888;font-size:11px}.cat-empty strong{color:#333}.cat-bottom-back{display:inline-flex;align-items:center;gap:7px;margin-top:20px;color:#111;font-size:11px;font-weight:800;text-decoration:none}@media(max-width:800px){.cat-header-inner,.cat-content{width:min(100% - 28px,680px)}.cat-layout{grid-template-columns:1fr}.cat-heading{align-items:flex-start}.cat-create{order:2}.cat-list-card{order:1}}@media(max-width:560px){.cat-header-inner{min-height:72px}.cat-brand>span:last-child{display:none}.cat-mark{width:46px}.cat-content{padding-top:25px}.cat-heading{flex-direction:column;gap:12px}.cat-heading h1{font-size:53px}.cat-count{align-self:flex-start}.cat-list-head{align-items:flex-start;gap:10px}.cat-list-head h2{font-size:23px}.cat-item{align-items:flex-start}.cat-actions{flex:none}.cat-item-copy p{white-space:normal;line-height:1.4}.cat-back{font-size:0;width:42px;padding:0;justify-content:center}.cat-back svg{margin:0}}
    `}</style>
  </main>;
}
