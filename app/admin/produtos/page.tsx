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
import { Pagination } from '@/components/ui/pagination';
import { ProductImage, productCover } from '@/components/ui/product-image';
import { optimizeImageForStorage } from '@/lib/image-optimization';
import { InlineLoader, SkeletonGrid } from '@/components/ui/loader';
import { useToast } from '@/components/ui/toast';

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  cost: number;
  barcode: string | null;
  stock: number;
  active: boolean;
  category_id: string | null;
  product_categories?: { category_id: string }[] | null;
  image_url?: string | null;
  images?: string[];
  slug?: string;
  updated_at?: string | null;
  created_at?: string | null;
};
type Category = { id: string; name: string; parent_id: string | null };
type AiCopy = { title: string; description: string; features: string[] };
type FormState = { name: string; description: string; price: string; cost: string; barcode: string; stock: string; category_ids: string[]; image_url: string; images: string[] };
type CatalogStats = { total: number; active: number; inactive: number };

const empty: FormState = { name: '', description: '', price: '', cost: '', barcode: '', stock: '0', category_ids: [], image_url: '', images: [] };
const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const ROOT_ORDER = ['Papelaria', 'Eletrônicos', 'Acessórios para celular', 'Variedades'];

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
  const [page, setPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [catalogStats, setCatalogStats] = useState<CatalogStats>({ total: 0, active: 0, inactive: 0 });
  const [reloadToken, setReloadToken] = useState(0);
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

  async function loadCatalogMeta() {
    if (!supabase) return;
    try {
      const [
        { data: categoryRows, error: categoryError },
        { count: totalCount, error: totalError },
        { count: activeProductCount, error: activeError },
      ] = await Promise.all([
        supabase.from('categories').select('id,name,parent_id').eq('active', true).order('name'),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('active', true),
      ]);
      if (categoryError) throw categoryError;
      if (totalError) throw totalError;
      if (activeError) throw activeError;
      const total = totalCount ?? 0;
      const active = activeProductCount ?? 0;
      setCategories((categoryRows ?? []) as Category[]);
      setCatalogStats({ total, active, inactive: Math.max(0, total - active) });
    } catch (error) {
      toast.error('Não foi possível carregar os dados do catálogo', error instanceof Error ? error.message : undefined);
    }
  }

  function refreshCatalog() {
    setReloadToken((current) => current + 1);
    void loadCatalogMeta();
  }

  useEffect(() => {
    void loadCatalogMeta();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, categoryFilter]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const delay = search.trim() ? SEARCH_DEBOUNCE_MS : 0;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const relationSelect = categoryFilter === 'all' ? '' : ',product_categories!inner(category_id)';
          let query = supabase
            .from('products')
            .select(
              `id,name,description,price,cost,barcode,stock,active,category_id,image_url,images,slug,updated_at,created_at${relationSelect}`,
              { count: 'exact' },
            );

          const term = search.trim().replace(/[%_,()]/g, ' ').replace(/\s+/g, ' ').trim();
          if (term) query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%,barcode.ilike.%${term}%`);
          if (statusFilter === 'active') query = query.eq('active', true);
          if (statusFilter === 'inactive') query = query.eq('active', false);
          if (categoryFilter !== 'all') query = query.eq('product_categories.category_id', categoryFilter);

          const start = (page - 1) * PAGE_SIZE;
          const { data, error, count } = await query
            .order('updated_at', { ascending: false, nullsFirst: false })
            .range(start, start + PAGE_SIZE - 1);

          if (error) throw error;
          if (cancelled) return;

          const total = count ?? 0;
          const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
          if (page > lastPage) {
            setPage(lastPage);
            return;
          }

          const pageProducts = (data ?? []) as Product[];
          if (pageProducts.length) {
            const { data: relationRows, error: relationError } = await supabase
              .from('product_categories')
              .select('product_id,category_id')
              .in('product_id', pageProducts.map((product) => product.id));
            if (relationError) throw relationError;
            const relationsByProduct = new Map<string, { category_id: string }[]>();
            for (const relation of relationRows ?? []) {
              const productId = String(relation.product_id);
              const current = relationsByProduct.get(productId) ?? [];
              current.push({ category_id: String(relation.category_id) });
              relationsByProduct.set(productId, current);
            }
            for (const product of pageProducts) {
              product.product_categories = relationsByProduct.get(product.id) ?? [];
            }
          }

          if (cancelled) return;
          setProducts(pageProducts);
          setTotalProducts(total);
        } catch (error) {
          if (!cancelled) {
            setProducts([]);
            setTotalProducts(0);
            toast.error('Não foi possível carregar o catálogo', error instanceof Error ? error.message : undefined);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [page, search, statusFilter, categoryFilter, reloadToken]);

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
    const relationIds = (product.product_categories ?? []).map((relation) => relation.category_id).filter(Boolean);
    const categoryIds = relationIds.length ? Array.from(new Set(relationIds)) : product.category_id ? [product.category_id] : [];
    setEditing(product.id);
    setForm({
      name: product.name,
      description: product.description || '',
      price: String(product.price),
      cost: String(product.cost ?? 0),
      barcode: product.barcode || '',
      stock: String(product.stock),
      category_ids: categoryIds,
      image_url: product.image_url || images[0] || '',
      images: images.length ? images : product.image_url ? [product.image_url] : [],
    });
    resetAi();
    setFormError('');
    setShowForm(true);
  }

  function toggleCategory(categoryId: string) {
    setForm((current) => {
      const category = categories.find((item) => item.id === categoryId);
      const selected = new Set(current.category_ids);
      if (selected.has(categoryId)) {
        selected.delete(categoryId);
        if (!category?.parent_id) {
          categories.filter((item) => item.parent_id === categoryId).forEach((child) => selected.delete(child.id));
        }
      } else {
        selected.add(categoryId);
        if (category?.parent_id) selected.add(category.parent_id);
      }
      return { ...current, category_ids: Array.from(selected) };
    });
  }

  function categoryNameList() {
    return form.category_ids
      .map((id) => categories.find((category) => category.id === id)?.name)
      .filter(Boolean)
      .slice(0, 4)
      .join(', ');
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
      body.append('category', categoryNameList());
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
      const optimizedFile = await optimizeImageForStorage(file);
      const path = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
      const { error } = await supabase.storage.from('products').upload(path, optimizedFile, {
        contentType: optimizedFile.type,
        cacheControl: '31536000',
        upsert: false,
      });
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
    const primaryCategoryId = form.category_ids[0] || null;
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      price: Number(form.price),
      cost: Number(form.cost || 0),
      barcode: form.barcode.trim() || null,
      stock: Number(form.stock || 0),
      category_id: primaryCategoryId,
      image_url: images[0] || form.image_url || null,
      images,
      updated_at: new Date().toISOString(),
    };

    let productId = editing;
    let error: Error | null = null;

    if (editing) {
      const result = await supabase.from('products').update(payload).eq('id', editing);
      error = result.error;
    } else {
      const result = await supabase
        .from('products')
        .insert({
          ...payload,
          slug:
            form.name
              .toLowerCase()
              .normalize('NFD')
              .replace(/[̀-ͯ]/g, '')
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/(^-|-$)/g, '') + `-${Date.now()}`,
        })
        .select('id')
        .single();
      error = result.error;
      productId = result.data?.id ?? null;
    }

    if (error) {
      setSaving(false);
      setFormError(error.message);
      toast.error('Não foi possível salvar', error.message);
      return;
    }

    if (!productId) {
      setSaving(false);
      const message = 'O produto foi salvo, mas não foi possível identificar o ID para salvar as categorias.';
      setFormError(message);
      toast.error('Categorias não salvas', message);
      return;
    }

    const { error: categoryError } = await supabase.rpc('set_product_categories', {
      p_product_id: productId,
      p_category_ids: form.category_ids,
    });

    setSaving(false);
    if (categoryError) {
      setFormError(`Produto salvo, mas não foi possível salvar as categorias: ${categoryError.message}`);
      toast.error('Categorias não salvas', categoryError.message);
      return;
    }

    toast.success(editing ? 'Produto atualizado' : 'Produto cadastrado', payload.name);
    setForm(empty);
    setEditing(null);
    resetAi();
    setShowForm(false);
    refreshCatalog();
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
    refreshCatalog();
  }

  async function remove(product: Product) {
    if (!supabase) return;
    if (!confirm(`Excluir "${product.name}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from('products').delete().eq('id', product.id);
    if (error) return toast.error('Não foi possível excluir', error.message);
    toast.success('Produto excluído', product.name);
    refreshCatalog();
  }

  function cancel() {
    setShowForm(false);
    setEditing(null);
    setForm(empty);
    setFormError('');
    resetAi();
  }

  const totalPages = Math.max(1, Math.ceil(totalProducts / PAGE_SIZE));
  const from = totalProducts === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalProducts);
  const stockCount = products.reduce((sum, product) => sum + Number(product.stock || 0), 0);
  const filtersActive = Boolean(search.trim()) || statusFilter !== 'all' || categoryFilter !== 'all';

  const roots = useMemo(() => {
    return categories
      .filter((category) => !category.parent_id)
      .sort((a, b) => {
        const ai = ROOT_ORDER.indexOf(a.name);
        const bi = ROOT_ORDER.indexOf(b.name);
        if (ai >= 0 && bi >= 0) return ai - bi;
        if (ai >= 0) return -1;
        if (bi >= 0) return 1;
        return a.name.localeCompare(b.name, 'pt-BR');
      });
  }, [categories]);

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
            <strong>{catalogStats.total.toLocaleString('pt-BR')}</strong>
            <small>Total do catálogo</small>
          </div>
          <div>
            <span>Ativos</span>
            <strong>{catalogStats.active.toLocaleString('pt-BR')}</strong>
            <small>Visíveis na loja</small>
          </div>
          <div>
            <span>Estoque</span>
            <strong>{stockCount.toLocaleString('pt-BR')}</strong>
            <small>Unidades nesta página</small>
          </div>
          <div>
            <span>Inativos</span>
            <strong>{catalogStats.inactive.toLocaleString('pt-BR')}</strong>
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
                    label="Preço de venda"
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    value={form.price}
                    onValueChange={(value) => setForm({ ...form, price: value })}
                  />
                  <TextField
                    label="Preço de custo"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    value={form.cost}
                    onValueChange={(value) => setForm({ ...form, cost: value })}
                  />
                </div>
                <div className="editor-cols">
                  <TextField
                    label="Estoque"
                    required
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.stock}
                    onValueChange={(value) => setForm({ ...form, stock: value })}
                  />
                  <TextField
                    label="EAN / Código de barras"
                    inputMode="numeric"
                    placeholder="Escaneie ou digite o EAN"
                    value={form.barcode}
                    onValueChange={(value) => setForm({ ...form, barcode: value })}
                  />
                </div>

                <section className="category-picker" aria-labelledby="product-categories-label">
                  <div className="category-picker-head">
                    <div>
                      <span id="product-categories-label" className="field-label">Categorias do produto</span>
                      <p>Selecione uma ou várias categorias. Subcategorias também vinculam o departamento correspondente.</p>
                    </div>
                    <strong>{form.category_ids.length} selecionada{form.category_ids.length === 1 ? '' : 's'}</strong>
                  </div>
                  <div className="category-tree">
                    {roots.map((root) => {
                      const children = categories.filter((category) => category.parent_id === root.id).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
                      const rootSelected = form.category_ids.includes(root.id);
                      return (
                        <div className="category-group" key={root.id}>
                          <label className={`category-option category-root ${rootSelected ? 'selected' : ''}`}>
                            <input type="checkbox" checked={rootSelected} onChange={() => toggleCategory(root.id)} />
                            <span className="category-check"><Check size={13} /></span>
                            <strong>{root.name}</strong>
                          </label>
                          {children.length > 0 && (
                            <div className="category-children">
                              {children.map((child) => {
                                const selected = form.category_ids.includes(child.id);
                                return (
                                  <label className={`category-option category-child ${selected ? 'selected' : ''}`} key={child.id}>
                                    <input type="checkbox" checked={selected} onChange={() => toggleCategory(child.id)} />
                                    <span className="category-check"><Check size={12} /></span>
                                    <span>{child.name}</span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {form.category_ids.length > 0 && (
                    <div className="selected-category-list">
                      {form.category_ids.map((id) => {
                        const category = categories.find((item) => item.id === id);
                        if (!category) return null;
                        return (
                          <button type="button" key={id} className="selected-category-chip" onClick={() => toggleCategory(id)}>
                            {category.name} <X size={12} />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
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
              placeholder="Buscar por nome, descrição ou EAN..."
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
              {filtersActive
                ? `${totalProducts.toLocaleString('pt-BR')} de ${catalogStats.total.toLocaleString('pt-BR')} produto(s) com os filtros atuais.`
                : `${catalogStats.total.toLocaleString('pt-BR')} produto(s) no catálogo.`}
            </span>
          </div>
        </div>

        {loading ? (
          <SkeletonGrid count={6} height={330} />
        ) : products.length === 0 ? (
          <div className="catalog-empty">
            <Package size={34} />
            <h3>{catalogStats.total ? 'Nenhum produto encontrado' : 'Seu catálogo está vazio'}</h3>
            <p>{catalogStats.total ? 'Tente outra busca ou filtro.' : 'Cadastre seu primeiro produto para começar.'}</p>
            {!catalogStats.total && (
              <button type="button" className="primary" onClick={startNew}>
                <Plus size={17} /> Cadastrar primeiro produto
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="admin-product-grid">
              {products.map((product) => {
                const productCategoryNames = (product.product_categories ?? [])
                  .map((relation) => categories.find((category) => category.id === relation.category_id)?.name)
                  .filter(Boolean) as string[];
                const displayCategoryNames = Array.from(new Set(productCategoryNames));
                if (!displayCategoryNames.length && product.category_id) {
                  const legacy = categories.find((category) => category.id === product.category_id)?.name;
                  if (legacy) displayCategoryNames.push(legacy);
                }
                return (
                  <article className="admin-product-card" key={product.id}>
                    <div className="card-image">
                      <span className={`status-pill ${product.active ? 'active' : 'inactive'}`}>{product.active ? 'Ativo' : 'Inativo'}</span>
                      <ProductImage src={productCover(product)} alt={product.name} sizes="(max-width:950px) 50vw, 320px" />
                    </div>
                    <div className="card-content">
                      <div className="card-category" title={displayCategoryNames.join(' · ')}>{displayCategoryNames.length ? displayCategoryNames.join(' · ') : 'Sem categoria'}</div>
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
                );
              })}
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} from={from} to={to} total={totalProducts} label="produtos" scrollTargetId="lista-produtos" />
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
        .category-picker{border:1px solid #e1e1dc;background:#fff;border-radius:14px;padding:14px}
        .category-picker-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}
        .category-picker-head p{margin:4px 0 0;color:#777;font-size:11px;line-height:1.4}
        .category-picker-head>strong{font-size:10px;white-space:nowrap;background:#f0f0ed;border-radius:20px;padding:6px 9px}
        .field-label{display:block;font-size:12px;font-weight:800;color:#222}
        .category-tree{display:grid;gap:8px;max-height:310px;overflow:auto;padding-right:2px}
        .category-group{border:1px solid #ecece8;border-radius:11px;overflow:hidden}
        .category-option{display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none}
        .category-option input{position:absolute;opacity:0;pointer-events:none}
        .category-root{padding:10px 11px;background:#f7f7f4;font-size:12px}
        .category-root.selected{background:#fff8d9}
        .category-children{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #ecece8}
        .category-child{padding:8px 10px 8px 28px;font-size:11px;color:#555;border-right:1px solid #f0f0ed;border-bottom:1px solid #f0f0ed}
        .category-child.selected{background:#fffdf1;color:#111;font-weight:700}
        .category-check{width:18px;height:18px;border:1px solid #cfcfca;border-radius:5px;background:#fff;display:grid;place-items:center;flex:none;color:transparent}
        .category-option.selected .category-check{background:#ffc400;border-color:#ffc400;color:#111}
        .selected-category-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;padding-top:10px;border-top:1px solid #eee}
        .selected-category-chip{display:inline-flex;align-items:center;gap:5px;border:1px solid #e2d58d;background:#fff9d9;color:#333;border-radius:20px;padding:6px 9px;font-size:10px;font-weight:700;cursor:pointer}
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
        .card-category{font-size:9px;text-transform:uppercase;color:#a07800;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
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
          .category-children{grid-template-columns:1fr}
          .category-picker-head{flex-direction:column}
          .category-picker-head>strong{align-self:flex-start}
        }
      `}</style>
    </main>
  );
}
