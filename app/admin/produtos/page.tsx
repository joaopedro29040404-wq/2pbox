'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Edit3, Eye, Image as ImageIcon, Package, Plus, Power, Search, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Product = { id: string; name: string; description: string | null; price: number; stock: number; active: boolean; category_id: string | null; image_url?: string | null; images?: string[]; slug?: string };
type Category = { id: string; name: string };
type AiCopy = { title: string; description: string; features: string[] };
type FormState = { name: string; description: string; price: string; stock: string; category_id: string; image_url: string; images: string[] };
const empty: FormState = { name: '', description: '', price: '', stock: '0', category_id: '', image_url: '', images: [] };
const PAGE_SIZE = 1000;

export default function ProductsAdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<FormState>(empty);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [aiSource, setAiSource] = useState<File | null>(null);
  const [aiPreview, setAiPreview] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiCopy, setAiCopy] = useState<AiCopy | null>(null);

  useEffect(() => {
    if (!aiSource) { setAiPreview(''); return; }
    const url = URL.createObjectURL(aiSource);
    setAiPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [aiSource]);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    try {
      const allProducts: Product[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from('products')
          .select('id,name,description,price,stock,active,category_id,image_url,images,slug')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const batch = (data ?? []) as Product[];
        allProducts.push(...batch);
        if (batch.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      const { data: c, error: ce } = await supabase.from('categories').select('id,name').eq('active', true).order('name');
      if (ce) throw ce;
      setProducts(allProducts);
      setCategories((c ?? []) as Category[]);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar o catálogo.');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function resetAi() { setAiSource(null); setAiCopy(null); setAiError(''); }
  function startNew() { setEditing(null); setForm(empty); resetAi(); setMessage(''); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function startEdit(p: Product) {
    const imgs = Array.isArray(p.images) ? p.images : [];
    setEditing(p.id);
    setForm({ name: p.name, description: p.description || '', price: String(p.price), stock: String(p.stock), category_id: p.category_id || '', image_url: p.image_url || imgs[0] || '', images: imgs.length ? imgs : (p.image_url ? [p.image_url] : []) });
    resetAi(); setMessage(''); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleAiFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setAiError('Escolha uma imagem.'); return; }
    if (file.size > 10 * 1024 * 1024) { setAiError('A foto deve ter no máximo 10 MB.'); return; }
    setAiSource(file); setAiCopy(null); setAiError('');
  }

  async function analyzeWithAI() {
    if (!aiSource) { setAiError('Envie uma foto do produto para começar.'); return; }
    setAiLoading(true); setAiError(''); setMessage('');
    try {
      const body = new FormData();
      body.append('image', aiSource);
      body.append('productName', form.name);
      body.append('category', categories.find(c => c.id === form.category_id)?.name || '');
      const response = await fetch('/api/admin/ai-copy', { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível analisar a imagem.');
      if (!data.copy) throw new Error('A IA não retornou o conteúdo do produto.');
      setAiCopy(data.copy);
      setForm(current => ({ ...current, name: data.copy.title || current.name, description: data.copy.description || current.description }));
      setMessage('IA analisou a foto. Revise o título e a descrição antes de salvar.');
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Erro ao analisar a imagem.');
    } finally { setAiLoading(false); }
  }

  async function uploadImages(files: FileList | null) {
    if (!supabase || !files) return;
    const selected = Array.from(files);
    if (form.images.length + selected.length > 8) { setMessage('Você pode cadastrar no máximo 8 imagens por produto.'); return; }
    setMessage('Enviando imagens...');
    const urls: string[] = [];
    for (const file of selected) {
      if (file.size > 5 * 1024 * 1024) { setMessage(`A imagem ${file.name} deve ter no máximo 5 MB.`); continue; }
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('products').upload(path, file, { contentType: file.type, upsert: false });
      if (error) { setMessage(error.message); continue; }
      const { data } = supabase.storage.from('products').getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    setForm(current => ({ ...current, images: [...current.images, ...urls], image_url: current.images[0] || urls[0] || current.image_url }));
    setMessage(urls.length ? `${urls.length} imagem(ns) carregada(s)!` : 'Não foi possível carregar as imagens.');
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    if (!form.name.trim() || !form.price) { setMessage('Preencha o nome e o preço do produto.'); return; }
    setMessage('Salvando produto...');
    const images = form.images;
    const main = images[0] || form.image_url || null;
    const payload = { name: form.name.trim(), description: form.description.trim() || null, price: Number(form.price), stock: Number(form.stock), category_id: form.category_id || null, image_url: main, images, updated_at: new Date().toISOString() };
    let error;
    if (editing) {
      ({ error } = await supabase.from('products').update(payload).eq('id', editing));
    } else {
      const slug = form.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
      ({ error } = await supabase.from('products').insert({ ...payload, slug }));
    }
    if (error) setMessage(error.message);
    else { setMessage(editing ? 'Produto atualizado!' : 'Produto cadastrado!'); setForm(empty); setEditing(null); resetAi(); setShowForm(false); load(); }
  }

  function removeImage(index: number) { setForm(current => { const images = current.images.filter((_, i) => i !== index); return { ...current, images, image_url: images[0] || '' }; }); }
  function setMain(index: number) { setForm(current => { const images = [current.images[index], ...current.images.filter((_, i) => i !== index)]; return { ...current, images, image_url: images[0] }; }); }
  async function toggle(id: string, active: boolean) { if (!supabase) return; const { error } = await supabase.from('products').update({ active: !active, updated_at: new Date().toISOString() }).eq('id', id); if (error) setMessage(error.message); else load(); }
  async function remove(id: string) { if (!supabase || !confirm('Excluir este produto? Esta ação não pode ser desfeita.')) return; const { error } = await supabase.from('products').delete().eq('id', id); if (error) setMessage(error.message); else load(); }
  function cancel() { setShowForm(false); setEditing(null); setForm(empty); setMessage(''); resetAi(); }

  const filtered = useMemo(() => products.filter(p => {
    const q = search.trim().toLowerCase();
    return (!q || p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)) &&
      (statusFilter === 'all' || (statusFilter === 'active' ? p.active : !p.active)) &&
      (categoryFilter === 'all' || p.category_id === categoryFilter);
  }), [products, search, statusFilter, categoryFilter]);
  const activeCount = products.filter(p => p.active).length;
  const inactiveCount = products.length - activeCount;
  const stockCount = products.reduce((n, p) => n + Number(p.stock || 0), 0);

  return <main className="admin-products-page">
    <div className="topbar">Painel administrativo <span>•</span> 2P Box</div>
    <header className="header container admin-products-header">
      <Link href="/admin" className="brand"><img className="brand-logo" src="/logo.pnh.png" alt="2P Box" /><div className="store-brand-copy"><strong>2P BOX</strong><small>ADMINISTRAÇÃO</small></div></Link>
      <Link className="secondary" href="/admin"><ArrowLeft size={16} /> Painel</Link>
    </header>
    <section className="container admin-catalog">
      <div className="admin-breadcrumb"><Link href="/admin">Painel</Link><span>/</span><strong>Produtos</strong></div>
      <div className="admin-catalog-hero"><div><p className="eyebrow">CATÁLOGO</p><h1>Produtos</h1><p>Gerencie catálogo, estoque, preços, fotos e conteúdo.</p></div><button type="button" className="primary admin-new-btn" onClick={startNew}><Plus size={18} /> Novo produto</button></div>
      <div className="catalog-stats"><div><span>Produtos</span><strong>{products.length.toLocaleString('pt-BR')}</strong><small>Total carregado do catálogo</small></div><div><span>Ativos</span><strong>{activeCount.toLocaleString('pt-BR')}</strong><small>Visíveis na loja</small></div><div><span>Estoque</span><strong>{stockCount.toLocaleString('pt-BR')}</strong><small>Unidades disponíveis</small></div><div><span>Inativos</span><strong>{inactiveCount.toLocaleString('pt-BR')}</strong><small>Fora da loja</small></div></div>
      <div className="catalog-note"><span className="catalog-note-dot" /><strong>{loading ? 'Carregando catálogo completo…' : `${products.length.toLocaleString('pt-BR')} produtos disponíveis para busca e gestão.`}</strong><span>A lista não fica limitada aos primeiros 1.000 registros.</span></div>

      {showForm && <form onSubmit={saveProduct} className="product-editor">
        <div className="editor-head"><div><p className="eyebrow">{editing ? 'EDIÇÃO' : 'NOVO CADASTRO'}</p><h2>{editing ? 'Editar produto' : 'Adicionar produto'}</h2><p>Use uma foto real para a IA criar título e descrição precisos. A imagem não é modificada.</p></div><button type="button" className="icon-btn" onClick={cancel} aria-label="Fechar"><X size={20} /></button></div>
        <section className="ai-copy-box">
          <div className="ai-copy-heading"><div className="ai-icon"><Sparkles size={21} /></div><div><strong>Gerar título e descrição com IA</strong><span>Envie a foto real. A IA lê textos visíveis, identifica o produto e preenche o cadastro sem gerar ou alterar fotos.</span></div></div>
          <div className="ai-copy-row"><label className="ai-copy-upload"><input type="file" accept="image/*" onChange={e => handleAiFile(e.target.files?.[0] || null)} /><Upload size={22} /><strong>{aiSource ? 'Foto selecionada' : 'Enviar foto do produto'}</strong><span>{aiSource ? aiSource.name : 'JPG, PNG ou WEBP · até 10 MB'}</span></label>{aiSource && <div className="ai-source-preview"><img src={aiPreview} alt="Foto enviada para análise" /><button type="button" onClick={resetAi} aria-label="Remover foto"><X size={16} /></button></div>}</div>
          {aiError && <div className="ai-error">{aiError}</div>}
          <button type="button" className="ai-primary" onClick={analyzeWithAI} disabled={aiLoading || !aiSource}>{aiLoading ? 'Analisando foto...' : <><Sparkles size={16} /> Analisar foto com IA</>}</button>
          {aiCopy && <div className="ai-result"><div className="ai-result-title"><Check size={15} /> Conteúdo identificado pela IA</div><label>TÍTULO<input value={aiCopy.title} onChange={e => { const value = e.target.value; setAiCopy(c => c ? { ...c, title: value } : c); setForm(f => ({ ...f, name: value })); }} /></label><label>DESCRIÇÃO<textarea value={aiCopy.description} onChange={e => { const value = e.target.value; setAiCopy(c => c ? { ...c, description: value } : c); setForm(f => ({ ...f, description: value })); }} /></label>{aiCopy.features.length > 0 && <div><span className="result-label">CARACTERÍSTICAS CONFIRMADAS</span><div className="feature-list">{aiCopy.features.map((feature, index) => <em key={index}><Check size={13} /> {feature}</em>)}</div></div>}</div>}
        </section>
        <div className="editor-grid"><div className="editor-main"><label>Nome do produto<input required placeholder="Ex.: Carregador iPhone" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label>Descrição<textarea placeholder="Descreva o produto para seus clientes..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><div className="editor-cols"><label>Preço<input required type="number" min="0" step="0.01" placeholder="0,00" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></label><label>Estoque<input required type="number" min="0" placeholder="0" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} /></label></div><label>Categoria<select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}><option value="">Sem categoria</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div><div className="editor-media"><div className="media-head"><div><strong>Imagens do produto</strong><span>Até 8 fotos · a primeira é a principal</span></div><label className="upload-btn"><Upload size={16} /> Adicionar fotos<input type="file" accept="image/*" multiple hidden onChange={e => uploadImages(e.target.files)} /></label></div>{form.images.length ? <div className="editor-gallery">{form.images.map((src, i) => <div className="editor-thumb" key={src}><img src={src} alt="" /><div className="thumb-overlay"><button type="button" onClick={() => setMain(i)} disabled={i === 0}>{i === 0 ? <><Check size={12} /> Principal</> : 'Definir principal'}</button><button type="button" onClick={() => removeImage(i)} aria-label="Remover"><Trash2 size={14} /></button></div></div>)}</div> : <label className="dropzone"><ImageIcon size={30} /><strong>Adicione as fotos do produto</strong><span>PNG, JPG ou WEBP · até 5 MB por imagem</span><input type="file" accept="image/*" multiple hidden onChange={e => uploadImages(e.target.files)} /></label>}</div></div>
        {message && <div className="editor-message">{message}</div>}
        <div className="editor-footer"><button type="button" className="secondary" onClick={cancel}>Cancelar</button><button className="primary" type="submit">{editing ? 'Salvar alterações' : 'Cadastrar produto'}</button></div>
      </form>}

      {!showForm && <div className="catalog-toolbar"><div className="search-box"><Search size={18} /><input placeholder="Buscar produto por nome ou descrição..." value={search} onChange={e => setSearch(e.target.value)} />{search && <button type="button" onClick={() => setSearch('')} aria-label="Limpar"><X size={15} /></button>}</div><div className="toolbar-filters"><select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="all">Todas as categorias</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="status-tabs"><button type="button" className={statusFilter === 'all' ? 'selected' : ''} onClick={() => setStatusFilter('all')}>Todos</button><button type="button" className={statusFilter === 'active' ? 'selected' : ''} onClick={() => setStatusFilter('active')}>Ativos</button><button type="button" className={statusFilter === 'inactive' ? 'selected' : ''} onClick={() => setStatusFilter('inactive')}>Inativos</button></div></div></div>}

      {loading ? <div className="catalog-loading"><Package size={24} /><span>Carregando catálogo completo…</span><small>Buscando todos os registros, não apenas os primeiros 1.000.</small></div> : filtered.length === 0 ? <div className="catalog-empty"><Package size={34} /><h3>{products.length ? 'Nenhum produto encontrado' : 'Seu catálogo está vazio'}</h3><p>{products.length ? 'Tente outra busca ou filtro.' : 'Cadastre seu primeiro produto para começar.'}</p>{!products.length && <button type="button" className="primary" onClick={startNew}><Plus size={17} /> Cadastrar primeiro produto</button>}</div> : <div className="admin-product-grid">{filtered.map(p => <article className="admin-product-card" key={p.id}><div className="card-image"><span className={`status-pill ${p.active ? 'active' : 'inactive'}`}>{p.active ? 'Ativo' : 'Inativo'}</span>{p.image_url ? <img src={p.image_url} alt={p.name} loading="lazy" /> : <div className="product-placeholder"><Package size={42} /><span>Sem foto</span></div>}</div><div className="card-content"><div className="card-category">{categories.find(c => c.id === p.category_id)?.name || 'Sem categoria'}</div><h3>{p.name}</h3><p className="card-description">{p.description || 'Sem descrição cadastrada.'}</p><div className="card-meta"><strong>R$ {Number(p.price).toFixed(2).replace('.', ',')}</strong><span>{Number(p.stock) <= 0 ? 'Sem estoque' : `${p.stock} ${p.stock === 1 ? 'unidade' : 'unidades'}`}</span></div><div className="card-actions"><Link className="view-btn" href={`/produto/${p.slug || p.id}`} target="_blank"><Eye size={15} /> Ver loja</Link><button type="button" className="edit-btn" onClick={() => startEdit(p)}><Edit3 size={15} /> Editar</button><button type="button" className="more-btn" onClick={() => toggle(p.id, p.active)} title={p.active ? 'Desativar produto' : 'Ativar produto'}><Power size={15} /></button><button type="button" className="more-btn danger" onClick={() => remove(p.id)} title="Excluir produto"><Trash2 size={15} /></button></div></div></article>)}</div>}
    </section>
    <style jsx global>{`
      .admin-products-page{min-height:100vh;background:#f6f6f3;color:#111}.admin-products-header{background:#fff}.admin-catalog{padding:30px 16px 76px}.admin-breadcrumb{display:flex;gap:8px;margin-bottom:25px;font-size:12px;color:#777}.admin-breadcrumb a{color:#555}.admin-catalog-hero{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:24px}.admin-catalog-hero h1{font-family:'Barlow Condensed',sans-serif;font-style:italic;text-transform:uppercase;font-size:clamp(46px,7vw,64px);line-height:.88;margin:0 0 10px;letter-spacing:-.02em}.admin-catalog-hero p{margin:0;color:#777;font-size:14px}.eyebrow{font-size:10px!important;letter-spacing:.18em;text-transform:uppercase;font-weight:900;color:#a47c00!important;margin-bottom:9px!important}.primary,.secondary,.ai-primary,.upload-btn,.edit-btn,.view-btn,.more-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:10px;border:0;cursor:pointer;text-decoration:none}.primary{background:#111;color:#fff;padding:13px 18px;font-weight:800}.secondary{background:#fff;color:#111;padding:11px 15px;border:1px solid #ddd}.catalog-stats{display:grid;grid-template-columns:repeat(4,1fr);background:#fff;border:1px solid #e2e2de;border-radius:17px;overflow:hidden;margin-bottom:12px;box-shadow:0 5px 18px rgba(0,0,0,.025)}.catalog-stats>div{padding:18px 20px;border-right:1px solid #e7e7e4}.catalog-stats>div:last-child{border-right:0}.catalog-stats span,.catalog-stats small{display:block;color:#777;font-size:11px}.catalog-stats strong{display:block;font-size:32px;font-family:'Barlow Condensed';margin:4px 0;line-height:1}.catalog-note{display:flex;align-items:center;gap:7px;margin:0 0 24px;color:#777;font-size:10px}.catalog-note strong{color:#444}.catalog-note-dot{width:7px;height:7px;background:#36a35a;border-radius:50%;flex:none}.product-editor{background:#fff;border:1px solid #e4e4e0;border-radius:20px;padding:24px;margin-bottom:28px;box-shadow:0 7px 22px rgba(0,0,0,.03)}.editor-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:22px}.editor-head h2{font-size:28px;margin:0 0 5px}.editor-head p{color:#777;font-size:13px;margin:0}.icon-btn{border:0;background:#f0f0ed;border-radius:9px;width:40px;height:40px;cursor:pointer}.ai-copy-box{border:1px solid #e6dba9;background:linear-gradient(135deg,#fffdf1,#fff);border-radius:18px;padding:18px;margin-bottom:24px}.ai-copy-heading{display:flex;gap:12px;align-items:center;margin-bottom:16px}.ai-icon{width:40px;height:40px;border-radius:12px;background:#ffc400;display:grid;place-items:center}.ai-copy-heading strong,.ai-copy-heading span{display:block}.ai-copy-heading span{font-size:12px;color:#777;margin-top:4px;line-height:1.45}.ai-copy-row{display:flex;gap:12px;align-items:stretch}.ai-copy-upload{min-height:150px;flex:1;border:1.5px dashed #cfc7a0;border-radius:14px;background:#fffef7;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:7px;cursor:pointer;padding:18px}.ai-copy-upload input{display:none}.ai-copy-upload span{font-size:11px;color:#888;max-width:300px;overflow:hidden;text-overflow:ellipsis}.ai-source-preview{width:150px;min-width:150px;position:relative;border-radius:14px;overflow:hidden;background:#eee}.ai-source-preview img{width:100%;height:100%;object-fit:cover}.ai-source-preview button{position:absolute;right:7px;top:7px;width:30px;height:30px;border:0;border-radius:50%;background:#fff;display:grid;place-items:center;cursor:pointer}.ai-primary{background:#111;color:#fff;padding:11px 16px;font-weight:800;margin-top:13px}.ai-primary:disabled{opacity:.45;cursor:not-allowed}.ai-error{margin-top:12px;padding:10px;border-radius:9px;background:#fff0f0;color:#a22;font-size:12px}.ai-result{display:grid;gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid #ece8d0}.ai-result-title{font-size:11px;font-weight:900;display:flex;align-items:center;gap:6px}.ai-result label{font-size:10px;font-weight:900}.ai-result input,.ai-result textarea,.editor-main input,.editor-main textarea,.editor-main select{width:100%;box-sizing:border-box;border:1px solid #dddcd7;border-radius:9px;padding:11px;background:#fff;outline:none;font:inherit;margin-top:6px}.ai-result textarea{min-height:110px;resize:vertical}.result-label{display:block;font-size:10px;font-weight:900;margin-bottom:7px}.feature-list{display:flex;flex-wrap:wrap;gap:7px}.feature-list em{font-style:normal;background:#f1f1ee;border-radius:20px;padding:7px 10px;font-size:11px;display:inline-flex;gap:5px;align-items:center}.editor-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:25px}.editor-main{display:grid;gap:14px}.editor-main label{font-size:11px;font-weight:800}.editor-main textarea{min-height:130px;resize:vertical}.editor-cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}.media-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}.media-head strong,.media-head span{display:block}.media-head span{font-size:10px;color:#888;margin-top:3px}.upload-btn{background:#111;color:#fff;padding:9px 12px;font-size:11px;font-weight:800}.upload-btn input{display:none}.dropzone{min-height:210px;border:1.5px dashed #ddd;border-radius:14px;display:grid;place-items:center;align-content:center;gap:7px;text-align:center;color:#888;cursor:pointer}.dropzone strong{color:#333;font-size:13px}.dropzone span{font-size:10px}.dropzone input{display:none}.editor-gallery{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.editor-thumb{position:relative;aspect-ratio:1;border-radius:12px;overflow:hidden;background:#eee}.editor-thumb img{width:100%;height:100%;object-fit:cover}.thumb-overlay{position:absolute;left:7px;right:7px;bottom:7px;display:flex;justify-content:space-between}.thumb-overlay button{border:0;background:#fff;border-radius:7px;padding:6px 8px;font-size:10px;cursor:pointer}.editor-message{margin-top:14px;padding:10px 12px;border-radius:9px;background:#f4f4f1;font-size:12px}.editor-footer{display:flex;justify-content:flex-end;gap:10px;margin-top:22px;padding-top:18px;border-top:1px solid #eee}.catalog-toolbar{display:flex;justify-content:space-between;gap:12px;margin-bottom:18px}.search-box{height:46px;min-width:280px;background:#fff;border:1px solid #ddd;border-radius:11px;display:flex;align-items:center;gap:8px;padding:0 12px;flex:1;max-width:600px}.search-box svg{color:#888;flex:none}.search-box input{border:0;outline:0;width:100%;background:transparent;font:inherit}.search-box button{border:0;background:#eee;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;cursor:pointer;flex:none}.toolbar-filters{display:flex;gap:8px}.toolbar-filters select{border:1px solid #ddd;border-radius:11px;padding:0 11px;background:#fff;min-height:46px}.status-tabs{display:flex;align-items:center;background:#eaeae7;border-radius:11px;padding:3px}.status-tabs button{border:0;background:transparent;border-radius:8px;padding:9px 12px;font-size:11px;cursor:pointer;white-space:nowrap}.status-tabs .selected{background:#111;color:#fff}.admin-product-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.admin-product-card{background:#fff;border:1px solid #e5e5e1;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.025)}.card-image{aspect-ratio:1.15;position:relative;background:#f0f0ed}.card-image>img{width:100%;height:100%;object-fit:contain}.status-pill{position:absolute;z-index:2;left:10px;top:10px;padding:5px 8px;border-radius:20px;background:#fff;font-size:10px;font-weight:800;box-shadow:0 2px 7px rgba(0,0,0,.06)}.status-pill.inactive{color:#a22}.product-placeholder{height:100%;display:grid;place-items:center;align-content:center;color:#aaa}.card-content{padding:15px}.card-category{font-size:9px;text-transform:uppercase;color:#a07800;font-weight:800}.card-content h3{margin:5px 0;font-size:17px;line-height:1.25}.card-description{font-size:11px;color:#777;min-height:32px;line-height:1.45}.card-meta{display:flex;justify-content:space-between;align-items:center;margin:12px 0;gap:8px}.card-meta strong{font-size:17px}.card-meta span{font-size:11px;color:#777;text-align:right}.card-actions{display:grid;grid-template-columns:1fr 1fr auto auto;gap:6px}.view-btn,.edit-btn,.more-btn{padding:8px 9px;font-size:10px;font-weight:800}.view-btn{background:#f0f0ed;color:#111}.edit-btn{background:#ffc400;color:#111}.more-btn{background:#eee;color:#111}.more-btn.danger{color:#b22}.catalog-loading,.catalog-empty{min-height:260px;padding:50px 20px;text-align:center;color:#888;background:#fff;border:1px dashed #ddd;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center}.catalog-loading small{margin-top:7px;font-size:10px;color:#aaa}@media(max-width:950px){.catalog-stats{grid-template-columns:repeat(2,1fr)}.catalog-stats>div:nth-child(2){border-right:0}.catalog-stats>div{border-bottom:1px solid #e7e7e4}.editor-grid{grid-template-columns:1fr}.admin-product-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.catalog-toolbar{flex-direction:column}.search-box{max-width:none}.toolbar-filters{width:100%}.toolbar-filters select{flex:1}}@media(max-width:640px){.admin-products-header{padding:0 12px}.admin-catalog{padding-left:12px;padding-right:12px}.admin-catalog-hero{align-items:flex-start;flex-direction:column}.admin-catalog-hero h1{font-size:53px}.admin-new-btn{width:100%;min-height:48px}.catalog-stats{grid-template-columns:1fr 1fr}.catalog-stats>div{padding:14px 12px}.catalog-stats strong{font-size:27px}.catalog-note{align-items:flex-start;flex-wrap:wrap;line-height:1.4}.product-editor{padding:16px;border-radius:15px}.editor-head h2{font-size:25px}.ai-copy-box{padding:13px}.ai-copy-row{flex-direction:column}.ai-source-preview{width:100%;height:220px}.toolbar-filters{overflow:auto}.toolbar-filters select{min-width:160px}.status-tabs{flex:none}.status-tabs button{padding:9px 10px}.admin-product-grid{grid-template-columns:1fr}.card-actions{grid-template-columns:1fr 1fr auto auto}.editor-cols{grid-template-columns:1fr}.editor-footer{flex-direction:column}.editor-footer>*{width:100%}.media-head{align-items:flex-start;flex-direction:column}.upload-btn{width:100%}.secondary,.primary{min-height:44px}}
    `}</style>
  </main>;
}
