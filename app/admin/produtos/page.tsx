'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  Edit3,
  Eye,
  Image as ImageIcon,
  LayoutGrid,
  Package,
  Plus,
  Power,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SiteHeader } from '@/components/site-header';
import { SelectField, TextAreaField, TextField } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { ProductImage, productCover } from '@/components/ui/product-image';
import { InlineLoader, SkeletonGrid } from '@/components/ui/loader';
import { useToast } from '@/components/ui/toast';

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  active: boolean;
  category_id: string | null;
  image_url?: string | null;
  images?: string[];
  slug?: string;
  updated_at?: string | null;
  created_at?: string | null;
};
type Category = { id: string; name: string };
type AiCopy = { title: string; description: string; features: string[] };
type FormState = { name: string; description: string; price: string; stock: string; category_id: string; image_url: string; images: string[] };

const empty: FormState = { name: '', description: '', price: '', stock: '0', category_id: '', image_url: '', images: [] };
const FETCH_SIZE = 1000;
const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos os status' },
  { value: 'active', label: 'Somente ativos' },
  { value: 'inactive', label: 'Somente inativos' },
];

export default function ProductsAdminPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState<FormState>(empty);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [aiSource, setAiSource] = useState<File | null>(null);
  const [aiPreview, setAiPreview] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiCopy, setAiCopy] = useState<AiCopy | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (!aiSource) {
      setAiPreview('');
      return;
    }
    const url = URL.createObjectURL(aiSource);
    setAiPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [aiSource]);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    try {
      const all: Product[] = [];
      let from = 0;
      for (;;) {
        const { data, error } = await supabase
          .from('products')
          .select('id,name,description,price,stock,active,category_id,image_url,images,slug,updated_at,created_at')
          .order('updated_at', { ascending: false, nullsFirst: false })
          .range(from, from + FETCH_SIZE - 1);
        if (error) throw error;
        const batch = (data ?? []) as Product[];
        all.push(...batch);
        if (batch.length < FETCH_SIZE) break;
        from += FETCH_SIZE;
      }
      const { data: categoryRows, error: categoryError } = await supabase.from('categories').select('id,name').eq('active', true).order('name');
      if (categoryError) throw categoryError;
      setProducts(all);
      setCategories((categoryRows ?? []) as Category[]);
    } catch (error) {
      toast.error('Não foi possível carregar o catálogo', error instanceof Error ? error.message : undefined);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function resetAi() {
    setAiSource(null);
    setAiCopy(null);
    setAiError('');
  }

  function startNew() {
    setEditing(null);
    setForm(empty);
    resetAi();
    setFormError('');
    setShowForm(true);
  }

  function startEdit(product: Product) {
    const images = Array.isArray(product.images) ? product.images : [];
    setEditing(product.id);
    setForm({
      name: product.name,
      description: product.description || '',
      price: String(product.price),
      stock: String(product.stock),
      category_id: product.category_id || '',
      image_url: product.image_url || images[0] || '',
      images: images.length ? images : product.image_url ? [product.image_url] : [],
    });
    resetAi();
    setFormError('');
    setShowForm(true);
  }

  function handleAiFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setAiError('Escolha um arquivo de imagem.');
    if (file.size > 10 * 1024 * 1024) return setAiError('A foto deve ter no máximo 10 MB.');
    setAiSource(file);
    setAiCopy(null);
    setAiError('');
  }

  async function analyzeWithAI() {
    if (!aiSource) return setAiError('Envie uma foto do produto para começar.');
    setAiLoading(true);
    setAiError('');
    try {
      const body = new FormData();
      body.append('image', aiSource);
      body.append('productName', form.name);
      body.append('category', categories.find((c) => c.id === form.category_id)?.name || '');
      const response = await fetch('/api/admin/ai-copy', { method: 'POST', body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível analisar a imagem.');
      if (!data.copy) throw new Error('A IA não retornou o conteúdo do produto.');
      setAiCopy(data.copy);
      setForm((current) => ({ ...current, name: data.copy.title || current.name, description: data.copy.description || current.description }));
      toast.success('Foto analisada', 'Revise o título e a descrição antes de salvar.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao analisar a imagem.';
      setAiError(message);
      toast.error('A análise falhou', message);
    } finally {
      setAiLoading(false);
    }
  }

  async function uploadImages(files: FileList | null) {
    if (!supabase || !files?.length) return;
    const selected = Array.from(files);
    if (form.images.length + selected.length > 8) {
      toast.warning('Limite de imagens', 'Você pode cadastrar no máximo 8 imagens por produto.');
      return;
    }
    setUploading(true);
    const urls: string[] = [];
    for (const file of selected) {
      if (file.size > 5 * 1024 * 1024) {
        toast.warning('Imagem muito grande', `${file.name} passa de 5 MB.`);
        continue;
      }
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
      const { error } = await supabase.storage.from('products').upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        toast.error('Falha ao enviar imagem', error.message);
        continue;
      }
      const { data } = supabase.storage.from('products').getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    setUploading(false);
    if (!urls.length) return;
    setForm((current) => ({ ...current, images: [...current.images, ...urls], image_url: current.images[0] || urls[0] || current.image_url }));
    toast.success(`${urls.length} imagem(ns) carregada(s)`, 'A primeira imagem é a principal do produto.');
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    if (!supabase || saving) return;
    if (!form.name.trim()) return setFormError('Informe o nome do produto.');
    if (!form.price || Number(form.price) <= 0) return setFormError('Informe um preço válido.');

    setFormError('');
    setSaving(true);
    const images = form.images;
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Number(form.price),
      stock: Number(form.stock || 0),
      category_id: form.category_id || null,
      image_url: images[0] || form.image_url || null,
      images,
      updated_at: new Date().toISOString(),
    };

    const { error } = editing
      ? await supabase.from('products').update(payload).eq('id', editing)
      : await supabase.from('products').insert({
          ...payload,
          slug:
            form.name
              .toLowerCase()
              .normalize('NFD')
              .replace(/[̀-ͯ]/g, '')
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '') + `-${Date.now()}`,
        });

    setSaving(false);
    if (error) {
      setFormError(error.message);
      toast.error('Não foi possível salvar', error.message);
      return;
    }

    toast.success(editing ? 'Produto atualizado' : 'Produto cadastrado', payload.name);
    setForm(empty);
    setEditing(null);
    resetAi();
    setShowForm(false);
    load();
  }

  function removeImage(index: number) {
    setForm((current) => {
      const images = current.images.filter((_, position) => position !== index);
      return { ...current, images, image_url: images[0] || '' };
    });
  }

  function setMain(index: number) {
    setForm((current) => {
      const images = [current.images[index], ...current.images.filter((_, position) => position !== index)];
      return { ...current, images, image_url: images[0] };
    });
  }

  async function toggle(product: Product) {
    if (!supabase) return;
    const { error } = await supabase.from('products').update({ active: !product.active, updated_at: new Date().toISOString() }).eq('id', product.id);
    if (error) return toast.error('Não foi possível alterar o produto', error.message);
    toast.success(product.active ? 'Produto desativado' : 'Produto ativado', product.name);
    load();
  }

  async function remove(product: Product) {
    if (!supabase) return;
    if (!confirm(`Excluir "${product.name}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from('products').delete().eq('id', product.id);
    if (error) return toast.error('Não foi possível excluir', error.message);
    toast.success('Produto excluído', product.name);
    load();
  }

  function cancel() {
    setShowForm(false);
    setEditing(null);
    setForm(empty);
    setFormError('');
    resetAi();
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery = !query || product.name.toLowerCase().includes(query) || (product.description || '').toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? product.active : !product.active);
      const matchesCategory = categoryFilter === 'all' || product.category_id === categoryFilter;
      return matchesQuery && matchesStatus && matchesCategory;
    });
  }, [products, search, statusFilter, categoryFilter]);

  const { page, setPage, totalPages, pageItems, from, to, total } = usePagination(
    filtered,
    PAGE_SIZE,
    `${search}|${statusFilter}|${categoryFilter}`,
  );
  const activeCount = products.filter((product) => product.active).length;
  const stockCount = products.reduce((sum, product) => sum + Number(product.stock || 0), 0);

  return (
    <main className="admin-products-page">
      <SiteHeader variant="admin" subtitle="CATÁLOGO" />
      <section className="container admin-catalog">
        <div className="admin-breadcrumb">
          <Link href="/admin">Painel</Link>
          <span>/</span>
          <strong>Produtos</strong>
        </div>

        <div className="admin-catalog-hero">
          <div>
            <p className="eyebrow">CATÁLOGO</p>
            <h1>Produtos</h1>
            <p>Gerencie catálogo, estoque, preços, fotos e conteúdo.</p>
          </div>
          <button type="button" className="primary admin-new-btn" onClick={startNew}>
            <Plus size={18} /> Novo produto
          </button>
        </div>

        <div className="catalog-stats">
          <div>
            <span>Produtos</span>
            <strong>{products.length.toLocaleString('pt-BR')}</strong>
            <small>Total do catálogo</small>
          </div>
          <div>
            <span>Ativos</span>
            <strong>{activeCount.toLocaleString('pt-BR')}</strong>
            <small>Visíveis na loja</small>
          </div>
          <div>
            <span>Estoque</span>
            <strong>{stockCount.toLocaleString('pt-BR')}</strong>
            <small>Unidades disponíveis</small>
          </div>
          <div>
            <span>Inativos</span>
            <strong>{(products.length - activeCount).toLocaleString('pt-BR')}</strong>
            <small>Fora da loja</small>
          </div>
        </div>

        <Modal
          open={showForm}
          onClose={cancel}
          eyebrow={editing ? 'EDIÇÃO' : 'NOVO CADASTRO'}
          title={editing ? 'Editar produto' : 'Adicionar produto'}
          description="Use uma foto real para a IA criar título e descrição precisos. A imagem não é modificada."
          footer={
            <>
              <button type="button" className="secondary" onClick={cancel}>
                Cancelar
              </button>
              <button className="primary" type="submit" form="product-form" disabled={saving}>
                {saving ? <InlineLoader label="Salvando..." /> : editing ? 'Salvar alterações' : 'Cadastrar produto'}
              </button>
            </>
          }
        >
          <form id="product-form" onSubmit={saveProduct} className="product-editor">

            <section className="ai-copy-box">
              <div className="ai-copy-heading">
                <div className="ai-icon">
                  <Sparkles size={21} />
                </div>
                <div>
                  <strong>Gerar título e descrição com IA</strong>
                  <span>Envie a foto real. A IA lê textos visíveis, identifica o produto e preenche o cadastro sem gerar ou alterar fotos.</span>
                </div>
              </div>
              <div className="ai-copy-row">
                <label className="ai-copy-upload">
                  <input type="file" accept="image/*" onChange={(event) => handleAiFile(event.target.files?.[0] || null)} />
                  <Upload size={22} />
                  <strong>{aiSource ? 'Foto selecionada' : 'Enviar foto do produto'}</strong>
                  <span>{aiSource ? aiSource.name : 'JPG, PNG ou WEBP · até 10 MB'}</span>
                </label>
                {aiSource && (
                  <div className="ai-source-preview">
                    <img src={aiPreview} alt="Foto enviada para análise" />
                    <button type="button" onClick={resetAi} aria-label="Remover foto">
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
              {aiError && <div className="ai-error">{aiError}</div>}
              <button type="button" className="ai-primary" onClick={analyzeWithAI} disabled={aiLoading || !aiSource}>
                {aiLoading ? <InlineLoader label="Analisando foto..." /> : <><Sparkles size={16} /> Analisar foto com IA</>}
              </button>
              {aiCopy && (
                <div className="ai-result">
                  <div className="ai-result-title">
                    <Check size={15} /> Conteúdo identificado pela IA
                  </div>
                  <TextField
                    label="Título"
                    value={aiCopy.title}
                    onValueChange={(value) => {
                      setAiCopy((current) => (current ? { ...current, title: value } : current));
                      setForm((current) => ({ ...current, name: value }));
                    }}
                  />
                  <TextAreaField
                    label="Descrição"
                    value={aiCopy.description}
                    onValueChange={(value) => {
                      setAiCopy((current) => (current ? { ...current, description: value } : current));
                      setForm((current) => ({ ...current, description: value }));
                    }}
                  />
                  {aiCopy.features.length > 0 && (
                    <div>
                      <span className="result-label">CARACTERÍSTICAS CONFIRMADAS</span>
                      <div className="feature-list">
                        {aiCopy.features.map((feature, index) => (
                          <em key={index}>
                            <Check size={13} /> {feature}
                          </em>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <div className="editor-grid">
              <div className="editor-main">
                <TextField
                  label="Nome do produto"
                  required
                  placeholder="Ex.: Carregador iPhone"
                  value={form.name}
                  onValueChange={(value) => setForm({ ...form, name: value })}
                  fullWidth
                />
                <TextAreaField
                  label="Descrição"
                  placeholder="Descreva o produto para seus clientes..."
                  value={form.description}
                  onValueChange={(value) => setForm({ ...form, description: value })}
                  fullWidth
                />
                <div className="editor-cols">
                  <TextField
                    label="Preço"
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    value={form.price}
                    onValueChange={(value) => setForm({ ...form, price: value })}
                  />
                  <TextField
                    label="Estoque"
                    required
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.stock}
                    onValueChange={(value) => setForm({ ...form, stock: value })}
                  />
                </div>
                <SelectField
                  label="Categoria"
                  value={form.category_id}
                  placeholder="Sem categoria"
                  options={categories.map((category) => ({ value: category.id, label: category.name }))}
                  onValueChange={(value) => setForm({ ...form, category_id: value })}
                  fullWidth
                />
              </div>

              <div className="editor-media">
                <div className="media-head">
                  <div>
                    <strong>Imagens do produto</strong>
                    <span>Até 8 fotos · a primeira é a principal</span>
                  </div>
                  <label className="upload-btn">
                    <Upload size={16} /> {uploading ? 'Enviando...' : 'Adicionar fotos'}
                    <input type="file" accept="image/*" multiple hidden disabled={uploading} onChange={(event) => uploadImages(event.target.files)} />
                  </label>
                </div>
                {form.images.length ? (
                  <div className="editor-gallery">
                    {form.images.map((source, index) => (
                      <div className="editor-thumb" key={source}>
                        <ProductImage src={source} alt={`Imagem ${index + 1}`} fit="cover" />
                        <div className="thumb-overlay">
                          <button type="button" onClick={() => setMain(index)} disabled={index === 0}>
                            {index === 0 ? <><Check size={12} /> Principal</> : 'Definir principal'}
                          </button>
                          <button type="button" onClick={() => removeImage(index)} aria-label="Remover">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <label className="dropzone">
                    <ImageIcon size={30} />
                    <strong>Adicione as fotos do produto</strong>
                    <span>PNG, JPG ou WEBP · até 5 MB por imagem</span>
                    <input type="file" accept="image/*" multiple hidden onChange={(event) => uploadImages(event.target.files)} />
                  </label>
                )}
              </div>
            </div>

            {formError && <div className="editor-message">{formError}</div>}
          </form>
        </Modal>

        <div className="admin-filters">
          <div className="span-6">
            <TextField
              aria-label="Buscar produto"
              placeholder="Buscar por nome ou descrição..."
              value={search}
              icon={<Search size={17} />}
              onValueChange={setSearch}
              fullWidth
            />
          </div>
          <div className="span-3">
            <SelectField
              aria-label="Filtrar por categoria"
              value={categoryFilter}
              options={[{ value: 'all', label: 'Todas as categorias' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
              onValueChange={setCategoryFilter}
              fullWidth
            />
          </div>
          <div className="span-3">
            <SelectField
              aria-label="Filtrar por status"
              value={statusFilter}
              options={STATUS_OPTIONS}
              onValueChange={setStatusFilter}
              fullWidth
            />
          </div>
        </div>

        <div className="catalog-list-head" id="lista-produtos">
          <div>
            <p className="eyebrow">CATÁLOGO COMPLETO</p>
            <h2>
              <LayoutGrid size={18} /> Todos os produtos
            </h2>
            <span>
              {filtered.length === products.length
                ? `${products.length.toLocaleString('pt-BR')} produto(s) no catálogo.`
                : `${filtered.length.toLocaleString('pt-BR')} de ${products.length.toLocaleString('pt-BR')} produto(s) com os filtros atuais.`}
            </span>
          </div>
        </div>

        {loading ? (
          <SkeletonGrid count={6} height={330} />
        ) : pageItems.length === 0 ? (
          <div className="catalog-empty">
            <Package size={34} />
            <h3>{products.length ? 'Nenhum produto encontrado' : 'Seu catálogo está vazio'}</h3>
            <p>{products.length ? 'Tente outra busca ou filtro.' : 'Cadastre seu primeiro produto para começar.'}</p>
            {!products.length && (
              <button type="button" className="primary" onClick={startNew}>
                <Plus size={17} /> Cadastrar primeiro produto
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="admin-product-grid">
              {pageItems.map((product) => (
                <article className="admin-product-card" key={product.id}>
                  <div className="card-image">
                    <span className={`status-pill ${product.active ? 'active' : 'inactive'}`}>{product.active ? 'Ativo' : 'Inativo'}</span>
                    <ProductImage src={productCover(product)} alt={product.name} sizes="(max-width:950px) 50vw, 320px" />
                  </div>
                  <div className="card-content">
                    <div className="card-category">{categories.find((category) => category.id === product.category_id)?.name || 'Sem categoria'}</div>
                    <h3>{product.name}</h3>
                    <p className="card-description">{product.description || 'Sem descrição cadastrada.'}</p>
                    <div className="card-meta">
                      <strong>R$ {Number(product.price).toFixed(2).replace('.', ',')}</strong>
                      <span>{Number(product.stock) <= 0 ? 'Sem estoque' : `${product.stock} ${product.stock === 1 ? 'unidade' : 'unidades'}`}</span>
                    </div>
                    <div className="card-actions">
                      <Link className="view-btn" href={`/produto/${product.slug || product.id}`} target="_blank">
                        <Eye size={15} /> Ver loja
                      </Link>
                      <button type="button" className="edit-btn" onClick={() => startEdit(product)}>
                        <Edit3 size={15} /> Editar
                      </button>
                      <button type="button" className="more-btn" onClick={() => toggle(product)} title={product.active ? 'Desativar produto' : 'Ativar produto'}>
                        <Power size={15} />
                      </button>
                      <button type="button" className="more-btn danger" onClick={() => remove(product)} title="Excluir produto">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} from={from} to={to} total={total} label="produtos" scrollTargetId="lista-produtos" />
          </>
        )}
      </section>

      <style jsx global>{`
        .admin-products-page{min-height:100vh;background:#f6f6f3;color:#111}
        .admin-catalog{padding:30px 16px 76px}
        .admin-breadcrumb{display:flex;gap:8px;margin-bottom:25px;font-size:12px;color:#777}
        .admin-breadcrumb a{color:#555;text-decoration:none}
        .admin-catalog-hero{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-bottom:24px}
        .admin-catalog-hero h1{font-family:'Barlow Condensed',sans-serif;font-style:italic;text-transform:uppercase;font-size:clamp(46px,7vw,64px);line-height:.88;margin:0 0 10px;letter-spacing:-.02em}
        .admin-catalog-hero p{margin:0;color:#777;font-size:14px}
        .eyebrow{font-size:10px;letter-spacing:.18em;text-transform:uppercase;font-weight:900;color:#a47c00;margin:0 0 9px}
        .primary,.secondary,.ai-primary,.upload-btn,.edit-btn,.view-btn,.more-btn,.catalog-toggle{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:10px;border:0;cursor:pointer;text-decoration:none}
        .primary{background:#111;color:#fff;padding:13px 18px;font-weight:800}
        .primary:disabled{opacity:.6;cursor:wait}
        .secondary{background:#fff;color:#111;padding:11px 15px;border:1px solid #ddd}
        .catalog-stats{display:grid;grid-template-columns:repeat(4,1fr);background:#fff;border:1px solid #e2e2de;border-radius:17px;overflow:hidden;margin-bottom:26px;box-shadow:0 5px 18px rgba(0,0,0,.025)}
        .catalog-stats>div{padding:18px 20px;border-right:1px solid #e7e7e4}
        .catalog-stats>div:last-child{border-right:0}
        .catalog-stats span,.catalog-stats small{display:block;color:#777;font-size:11px}
        .catalog-stats strong{display:block;font-size:32px;font-family:'Barlow Condensed';margin:4px 0;line-height:1}
        .product-editor{background:transparent;border:0;padding:0;margin:0}
        .editor-head{display:flex;justify-content:space-between;gap:15px;margin-bottom:22px}
        .editor-head h2{font-size:28px;margin:0 0 5px}
        .editor-head p{color:#777;font-size:13px;margin:0}
        .icon-btn{border:0;background:#f0f0ed;border-radius:9px;width:40px;height:40px;cursor:pointer;flex:none}
        .ai-copy-box{border:1px solid #e6dba9;background:linear-gradient(135deg,#fffdf1,#fff);border-radius:18px;padding:18px;margin-bottom:24px}
        .ai-copy-heading{display:flex;gap:12px;align-items:center;margin-bottom:16px}
        .ai-icon{width:40px;height:40px;border-radius:12px;background:#ffc400;display:grid;place-items:center;flex:none}
        .ai-copy-heading strong,.ai-copy-heading span{display:block}
        .ai-copy-heading span{font-size:12px;color:#777;margin-top:4px;line-height:1.45}
        .ai-copy-row{display:flex;gap:12px;align-items:stretch}
        .ai-copy-upload{min-height:150px;flex:1;border:1.5px dashed #cfc7a0;border-radius:14px;background:#fffef7;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:7px;cursor:pointer;padding:18px}
        .ai-copy-upload input{display:none}
        .ai-copy-upload span{font-size:11px;color:#888;max-width:300px;overflow:hidden;text-overflow:ellipsis}
        .ai-source-preview{width:150px;min-width:150px;position:relative;border-radius:14px;overflow:hidden;background:#eee}
        .ai-source-preview img{width:100%;height:100%;object-fit:cover}
        .ai-source-preview button{position:absolute;right:7px;top:7px;width:30px;height:30px;border:0;border-radius:50%;background:#fff;display:grid;place-items:center;cursor:pointer}
        .ai-primary{background:#111;color:#fff;padding:11px 16px;font-weight:800;margin-top:13px;min-height:42px}
        .ai-primary:disabled{opacity:.45;cursor:not-allowed}
        .ai-error{margin-top:12px;padding:10px;border-radius:9px;background:#fff0f0;color:#a22;font-size:12px}
        .ai-result{display:grid;gap:14px;margin-top:16px;padding-top:16px;border-top:1px solid #ece8d0}
        .ai-result-title{font-size:11px;font-weight:900;display:flex;align-items:center;gap:6px}
        .result-label{display:block;font-size:10px;font-weight:900;margin-bottom:7px}
        .feature-list{display:flex;flex-wrap:wrap;gap:7px}
        .feature-list em{font-style:normal;background:#f1f1ee;border-radius:20px;padding:7px 10px;font-size:11px;display:inline-flex;gap:5px;align-items:center}
        .editor-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:25px}
        .editor-main{display:grid;gap:16px;align-content:start}
        .editor-cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .media-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}
        .media-head strong,.media-head span{display:block}
        .media-head span{font-size:10px;color:#888;margin-top:3px}
        .upload-btn{background:#111;color:#fff;padding:9px 12px;font-size:11px;font-weight:800}
        .upload-btn input{display:none}
        .dropzone{min-height:210px;border:1.5px dashed #ddd;border-radius:14px;display:grid;place-items:center;align-content:center;gap:7px;text-align:center;color:#888;cursor:pointer}
        .dropzone strong{color:#333;font-size:13px}
        .dropzone span{font-size:10px}
        .dropzone input{display:none}
        .editor-gallery{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
        .editor-thumb{position:relative;aspect-ratio:1;border-radius:12px;overflow:hidden;background:#eee}
        .thumb-overlay{position:absolute;left:7px;right:7px;bottom:7px;display:flex;justify-content:space-between;z-index:2}
        .thumb-overlay button{border:0;background:#fff;border-radius:7px;padding:6px 8px;font-size:10px;cursor:pointer;display:inline-flex;align-items:center;gap:4px}
        .editor-message{margin-top:14px;padding:10px 12px;border-radius:9px;background:#fff0f0;color:#a22;font-size:12px}
        .editor-footer{display:flex;justify-content:flex-end;gap:10px;margin-top:22px;padding-top:18px;border-top:1px solid #eee}
        .catalog-toolbar{display:grid;grid-template-columns:minmax(0,1fr) 220px 200px;gap:12px;align-items:end;margin-bottom:26px}
        .catalog-list-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:16px}
        .catalog-list-head h2{display:flex;align-items:center;gap:9px;margin:0 0 7px;font-family:'Barlow Condensed';font-size:29px;text-transform:uppercase}
        .catalog-list-head span{font-size:12px;color:#777}
        .catalog-toggle{flex:none;background:#ffc400;color:#111;padding:12px 17px;font:900 11px Inter,Arial,sans-serif}
        .catalog-toggle:hover{background:#111;color:#fff}
        .admin-product-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
        .admin-product-card{background:#fff;border:1px solid #e5e5e1;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.025)}
        .card-image{position:relative;aspect-ratio:1.15;background:#f0f0ed}
        .status-pill{position:absolute;z-index:3;left:10px;top:10px;padding:5px 8px;border-radius:20px;background:#fff;font-size:10px;font-weight:800;box-shadow:0 2px 7px rgba(0,0,0,.06)}
        .status-pill.inactive{color:#a22}
        .card-content{padding:15px}
        .card-category{font-size:9px;text-transform:uppercase;color:#a07800;font-weight:800}
        .card-content h3{margin:5px 0;font-size:17px;line-height:1.25}
        .card-description{font-size:11px;color:#777;min-height:32px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .card-meta{display:flex;justify-content:space-between;align-items:center;margin:12px 0;gap:8px}
        .card-meta strong{font-size:17px}
        .card-meta span{font-size:11px;color:#777;text-align:right}
        .card-actions{display:grid;grid-template-columns:1fr 1fr auto auto;gap:6px}
        .view-btn,.edit-btn,.more-btn{padding:8px 9px;font-size:10px;font-weight:800}
        .view-btn{background:#f0f0ed;color:#111}
        .edit-btn{background:#ffc400;color:#111}
        .more-btn{background:#eee;color:#111}
        .more-btn.danger{color:#b22}
        .catalog-empty{min-height:260px;padding:50px 20px;text-align:center;color:#888;background:#fff;border:1px dashed #ddd;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}
        .catalog-empty h3{margin:10px 0 0;color:#222}
        @media(max-width:950px){
          .catalog-stats{grid-template-columns:repeat(2,1fr)}
          .catalog-stats>div:nth-child(2){border-right:0}
          .catalog-stats>div{border-bottom:1px solid #e7e7e4}
          .editor-grid{grid-template-columns:1fr}
          .admin-product-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
          .catalog-toolbar{grid-template-columns:1fr}
        }
        @media(max-width:640px){
          .admin-catalog{padding-left:12px;padding-right:12px}
          .admin-catalog-hero{align-items:flex-start;flex-direction:column}
          .admin-catalog-hero h1{font-size:50px}
          .admin-new-btn{width:100%;min-height:48px}
          .catalog-stats{grid-template-columns:1fr 1fr}
          .catalog-stats>div{padding:14px 12px}
          .catalog-stats strong{font-size:27px}
          .product-editor{padding:16px;border-radius:15px}
          .editor-head h2{font-size:25px}
          .ai-copy-box{padding:13px}
          .ai-copy-row{flex-direction:column}
          .ai-source-preview{width:100%;height:220px}
          .catalog-list-head{align-items:flex-start;flex-direction:column}
          .catalog-toggle{width:100%;min-height:46px}
          .admin-product-grid{grid-template-columns:1fr}
          .editor-cols{grid-template-columns:1fr}
          .editor-footer{flex-direction:column}
          .editor-footer>*{width:100%}
          .media-head{align-items:flex-start;flex-direction:column}
          .upload-btn{width:100%}
        }
      `}</style>
    </main>
  );
}
