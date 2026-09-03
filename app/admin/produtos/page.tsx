'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Product = { id: string; name: string; price: number; stock: number; active: boolean; category_id: string | null };
type Category = { id: string; name: string };

export default function ProductsAdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ name: '', description: '', price: '', stock: '0', category_id: '' });

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from('products').select('id,name,price,stock,active,category_id').order('created_at', { ascending: false }),
      supabase.from('categories').select('id,name').eq('active', true).order('name')
    ]);
    setProducts((p ?? []) as Product[]); setCategories((c ?? []) as Category[]); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function addProduct(e: FormEvent) {
    e.preventDefault(); if (!supabase) return;
    const slug = form.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
    const { error } = await supabase.from('products').insert({ name: form.name, description: form.description, price: Number(form.price), stock: Number(form.stock), category_id: form.category_id || null, slug });
    if (error) setMessage(error.message); else { setMessage('Produto cadastrado!'); setForm({ name:'', description:'', price:'', stock:'0', category_id:'' }); setShowForm(false); load(); }
  }

  async function toggle(id: string, active: boolean) { if (!supabase) return; await supabase.from('products').update({ active: !active, updated_at: new Date().toISOString() }).eq('id', id); load(); }
  async function remove(id: string) { if (!supabase || !confirm('Excluir este produto?')) return; await supabase.from('products').delete().eq('id', id); load(); }

  return <main><div className="topbar">Painel administrativo • 2P Box</div><header className="header container"><Link href="/admin" className="brand"><div className="brand-mark">2P</div><div><strong>2P BOX</strong><small>ADMINISTRAÇÃO</small></div></Link><Link className="secondary" href="/admin">Voltar ao painel</Link></header>
    <section className="container section"><div className="section-head"><div><p className="eyebrow">CATÁLOGO</p><h2>Produtos</h2></div><button className="primary" onClick={() => setShowForm(!showForm)} style={{border:0,cursor:'pointer'}}><Plus size={17}/> Novo produto</button></div>
      {showForm && <form onSubmit={addProduct} className="category" style={{display:'grid',gap:14,marginBottom:28}}><h3>Novo produto</h3><input required placeholder="Nome do produto" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} style={{padding:13,border:'1px solid #ddd',borderRadius:8}}/><textarea placeholder="Descrição" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} style={{padding:13,border:'1px solid #ddd',borderRadius:8,minHeight:100}}/><div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}><input required type="number" min="0" step="0.01" placeholder="Preço" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} style={{padding:13,border:'1px solid #ddd',borderRadius:8}}/><input required type="number" min="0" placeholder="Estoque" value={form.stock} onChange={e=>setForm({...form,stock:e.target.value})} style={{padding:13,border:'1px solid #ddd',borderRadius:8}}/></div><select value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})} style={{padding:13,border:'1px solid #ddd',borderRadius:8}}><option value="">Sem categoria</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="primary" type="submit" style={{border:0,cursor:'pointer',justifyContent:'center'}}>Salvar produto</button></form>}
      {message && <p>{message}</p>}
      {loading ? <p>Carregando...</p> : products.length === 0 ? <div className="category"><h3>Nenhum produto cadastrado</h3><p>Clique em “Novo produto” para começar o catálogo.</p></div> : <div style={{display:'grid',gap:12}}>{products.map(p=><div key={p.id} className="category" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:16}}><div><h3 style={{marginBottom:5}}>{p.name}</h3><p style={{margin:0}}>R$ {Number(p.price).toFixed(2).replace('.',',')} • estoque: {p.stock} • {p.active ? 'Ativo' : 'Inativo'}</p></div><div style={{display:'flex',gap:8}}><button className="secondary" onClick={()=>toggle(p.id,p.active)}>{p.active?'Desativar':'Ativar'}</button><button className="secondary" onClick={()=>remove(p.id)} aria-label="Excluir"><Trash2 size={16}/></button></div></div>)}</div>}
    </section><div className="container" style={{paddingBottom:50}}><Link href="/admin" className="secondary"><ArrowLeft size={16}/> Painel</Link></div></main>;
}
