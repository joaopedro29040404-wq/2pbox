'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Category = { id: string; name: string; description: string | null; active: boolean };

export default function CategoriesAdminPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [message, setMessage] = useState('');
  async function load(){ if(!supabase)return; const {data,error}=await supabase.from('categories').select('*').order('name'); if(error)setMessage(error.message); setItems((data??[]) as Category[]); }
  useEffect(()=>{load()},[]);
  async function add(e:FormEvent){e.preventDefault();if(!supabase)return;const slug=name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')+'-'+Date.now();const {error}=await supabase.from('categories').insert({name,description,slug});if(error)setMessage(error.message);else{setMessage('Categoria criada!');setName('');setDescription('');load();}}
  async function toggle(id:string,active:boolean){if(!supabase)return;await supabase.from('categories').update({active:!active}).eq('id',id);load()}
  async function remove(id:string){if(!supabase||!confirm('Excluir esta categoria?'))return;await supabase.from('categories').delete().eq('id',id);load()}
  return <main><div className="topbar">Painel administrativo • 2P Box</div><header className="header container"><Link href="/admin" className="brand"><div className="brand-mark">2P</div><div><strong>2P BOX</strong><small>ADMINISTRAÇÃO</small></div></Link><Link className="secondary" href="/admin">Voltar ao painel</Link></header><section className="container section"><div className="section-head"><div><p className="eyebrow">CATÁLOGO</p><h2>Categorias</h2></div></div><form onSubmit={add} className="category" style={{display:'grid',gap:14,marginBottom:28}}><h3>Nova categoria</h3><input required placeholder="Nome da categoria" value={name} onChange={e=>setName(e.target.value)} style={{padding:13,border:'1px solid #ddd',borderRadius:8}}/><input placeholder="Descrição (opcional)" value={description} onChange={e=>setDescription(e.target.value)} style={{padding:13,border:'1px solid #ddd',borderRadius:8}}/><button className="primary" type="submit" style={{border:0,cursor:'pointer',justifyContent:'center'}}><Plus size={17}/> Criar categoria</button></form>{message&&<p>{message}</p>}<div style={{display:'grid',gap:12}}>{items.map(c=><div key={c.id} className="category" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16}}><div><h3 style={{marginBottom:5}}>{c.name}</h3><p style={{margin:0}}>{c.description||'Sem descrição'} • {c.active?'Ativa':'Inativa'}</p></div><div style={{display:'flex',gap:8}}><button className="secondary" onClick={()=>toggle(c.id,c.active)}>{c.active?'Desativar':'Ativar'}</button><button className="secondary" onClick={()=>remove(c.id)}><Trash2 size={16}/></button></div></div>)}</div></section><div className="container" style={{paddingBottom:50}}><Link href="/admin" className="secondary"><ArrowLeft size={16}/> Painel</Link></div></main>;
}
