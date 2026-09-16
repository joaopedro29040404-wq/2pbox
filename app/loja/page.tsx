'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Check, ChevronLeft, ChevronRight, Heart, Search, SlidersHorizontal } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/components/cart-provider';
import { SiteHeader } from '@/components/site-header';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { ProductImage, productCover } from '@/components/ui/product-image';
import { SkeletonGrid } from '@/components/ui/loader';
import { SelectField, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';

type Category = { id: string; name: string; slug: string; parent_id: string | null };
type ProductCategory = { id: string; name: string; slug: string; parent_id: string | null };
type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  images?: string[] | null;
  category_id: string | null;
  categories?: ProductCategory | null;
  product_categories?: { category_id: string; categories?: ProductCategory | null }[] | null;
};
type AuthUser = { id: string; user_metadata?: { full_name?: string } };

type Department = Category & { icon: typeof Search; description: string };

const PAGE_SIZE = 12;
const SORTS = [
  { value: 'recent', label: 'Mais recentes' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
  { value: 'name', label: 'Ordem alfabética' },
];

const DEPARTMENT_META: Record<string, { icon: typeof Search; description: string }> = {
  papelaria: { icon: Search, description: 'Materiais para estudo, escritório e criatividade.' },
  eletronicos: { icon: Search, description: 'Tecnologia, energia, áudio e periféricos.' },
  'acessorios-para-celular': { icon: Search, description: 'Acessórios para proteger e complementar seu celular.' },
  variedades: { icon: Search, description: 'Produtos para casa, presentes, lazer e muito mais.' },
};

export default function LojaPage() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const { add } = useCart();
  const categorySlug = searchParams.get('categoria');

  const [products, setProducts] = useState<Product[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [added, setAdded] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) { setLoading(false); return; }
    let mounted = true;

    async function loadFavorites(userId: string) {
      const { data } = await client.from('customer_favorites').select('product_id').eq('customer_id', userId);
      if (mounted) setFavorites((data ?? []).map((row: { product_id: string }) => row.product_id));
    }

    async function load() {
      const [{ data, error }, { data: categoryRows }, { data: auth }] = await Promise.all([
        client.from('products').select('id,name,slug,description,price,stock,image_url,images,category_id,categories(id,name,slug,parent_id),product_categories(category_id,categories(id,name,slug,parent_id))').eq('active', true).order('created_at', { ascending: false }),
        client.from('categories').select('id,name,slug,parent_id').eq('active', true).order('name'),
        client.auth.getUser(),
      ]);

      if (!mounted) return;
      if (error) toast.error('Não foi possível carregar o catálogo', error.message);
      else setProducts((data ?? []) as unknown as Product[]);
      setAllCategories((categoryRows ?? []) as Category[]);
      setUser((auth.user ?? null) as AuthUser | null);
      if (auth.user) await loadFavorites(auth.user.id);
      setLoading(false);
    }

    load();
    const { data: listener } = client.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      setUser((session?.user ?? null) as AuthUser | null);
      if (session?.user) await loadFavorites(session.user.id); else setFavorites([]);
    });

    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [toast]);

  const roots = useMemo(() => allCategories.filter((c) => !c.parent_id), [allCategories]);
  const selectedCategory = useMemo(() => allCategories.find((c) => c.slug === categorySlug) ?? null, [allCategories, categorySlug]);
  const selectedRoot = useMemo(() => {
    if (!selectedCategory) return null;
    return selectedCategory.parent_id
      ? allCategories.find((c) => c.id === selectedCategory.parent_id) ?? null
      : selectedCategory;
  }, [allCategories, selectedCategory]);
  const subcategories = useMemo(() => selectedRoot ? allCategories.filter((c) => c.parent_id === selectedRoot.id) : [], [allCategories, selectedRoot]);
  const departments = useMemo(() => roots.map((root) => ({ ...root, ...(DEPARTMENT_META[root.slug] ?? { icon: Search, description: 'Confira os produtos desta categoria.' }) })), [roots]);

  const productMatchesCategory = (product: Product) => {
    if (!selectedCategory) return true;
    const relations = product.product_categories ?? [];
    const ids = relations.map((row) => row.category_id);
    if (product.category_id && !ids.includes(product.category_id)) ids.push(product.category_id);
    if (ids.includes(selectedCategory.id)) return true;
    if (!selectedCategory.parent_id) {
      return relations.some((row) => row.categories?.parent_id === selectedCategory.id);
    }
    return false;
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = products.filter((product) => productMatchesCategory(product) && (!query || product.name.toLowerCase().includes(query) || (product.description ?? '').toLowerCase().includes(query)));
    switch (sort) {
      case 'price_asc': return [...list].sort((a, b) => Number(a.price) - Number(b.price));
      case 'price_desc': return [...list].sort((a, b) => Number(b.price) - Number(a.price));
      case 'name': return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      default: return list;
    }
  }, [products, selectedCategory, search, sort]);

  const paginationKey = `${categorySlug ?? 'all'}|${search}|${sort}`;
  const { page, setPage, totalPages, pageItems, from, to, total } = usePagination(filtered, PAGE_SIZE, paginationKey);

  function addProduct(product: Product) {
    add({ id: product.id, name: product.name, price: Number(product.price), stock: product.stock, image_url: productCover(product) ?? undefined });
    setAdded(product.id);
    window.setTimeout(() => setAdded(null), 1400);
  }

  async function toggleFavorite(productId: string) {
    const client = supabase;
    if (!client) return;
    if (!user) {
      toast.info('Entre para salvar favoritos', 'Crie sua conta para guardar produtos.');
      window.location.href = '/conta';
      return;
    }
    if (favorites.includes(productId)) {
      const { error } = await client.from('customer_favorites').delete().eq('customer_id', user.id).eq('product_id', productId);
      if (error) return toast.error('Não foi possível remover dos favoritos', error.message);
      setFavorites((current) => current.filter((id) => id !== productId));
      toast.info('Removido dos favoritos');
      return;
    }
    const { error } = await client.from('customer_favorites').insert({ customer_id: user.id, product_id: productId });
    if (error) return toast.error('Não foi possível favoritar', error.message);
    setFavorites((current) => [...current, productId]);
    toast.success('Salvo nos favoritos');
  }

  return (
    <main className="loja-shell">
      <SiteHeader subtitle="CATÁLOGO" />
      <section className="container section loja-page" id="catalogo">
        <div className="shop-breadcrumb">
          <Link href="/">Início</Link><ChevronRight size={14} /><span>Produtos</span>
          {selectedRoot && <><ChevronRight size={14} /><span className="current">{selectedRoot.name}</span></>}
          {selectedCategory?.parent_id && <><ChevronRight size={14} /><span className="current">{selectedCategory.name}</span></>}
        </div>

        {!selectedCategory ? (
          <>
            <header className="catalog-hero">
              <div>
                <p className="eyebrow">CATÁLOGO 2P BOX</p>
                <h1>Encontre o que você precisa.</h1>
                <p>Explore nossos departamentos e encontre produtos de forma rápida e simples.</p>
              </div>
              <div className="hero-search"><TextField aria-label="Buscar produtos" placeholder="Buscar por nome ou descrição" value={search} icon={<Search size={17} />} onValueChange={setSearch} /></div>
            </header>

            <div className="section-title-row"><div><span>DEPARTAMENTOS</span><h2>Escolha uma categoria</h2></div><small>{products.length} produtos disponíveis</small></div>
            <div className="department-grid">
              {departments.map((department) => {
                const Icon = department.icon;
                return (
                  <Link key={department.id} href={`/loja?categoria=${encodeURIComponent(department.slug)}`} className="department-card">
                    <div className="department-icon"><Icon size={22} /></div>
                    <div className="department-copy"><h3>{department.name}</h3><p>{department.description}</p><span>Ver produtos <ChevronRight size={15} /></span></div>
                  </Link>
                );
              })}
            </div>

            {search && <CatalogResults search={search} setSearch={setSearch} sort={sort} setSort={setSort} filtered={filtered} loading={loading} pageItems={pageItems} favorites={favorites} toggleFavorite={toggleFavorite} added={added} addProduct={addProduct} page={page} setPage={setPage} totalPages={totalPages} from={from} to={to} total={total} />}
          </>
        ) : (
          <>
            <header className="category-header">
              <div className="category-header-top">
                <Link href="/loja" className="back-link"><ChevronLeft size={16} /> Todos os produtos</Link>
                <span className="category-kicker">DEPARTAMENTO</span>
              </div>
              <h1>{selectedRoot?.name ?? selectedCategory.name}</h1>
              <p>{selectedCategory.parent_id ? `Produtos de ${selectedCategory.name}.` : `Todos os produtos de ${selectedCategory.name}.`}</p>
            </header>

            {selectedRoot && subcategories.length > 0 && (
              <nav className="subcategory-bar" aria-label={`Subcategorias de ${selectedRoot.name}`}>
                <div className="subcategory-heading"><span>Explore</span><strong>Subcategorias</strong></div>
                <div className="subcategory-list">
                  <Link href={`/loja?categoria=${encodeURIComponent(selectedRoot.slug)}`} className={!selectedCategory.parent_id ? 'sub-active' : 'sub-button'}>Todos</Link>
                  {subcategories.map((sub) => <Link key={sub.id} href={`/loja?categoria=${encodeURIComponent(sub.slug)}`} className={selectedCategory.id === sub.id ? 'sub-active' : 'sub-button'}>{sub.name}</Link>)}
                </div>
              </nav>
            )}

            <div className="catalog-toolbar">
              <TextField aria-label="Buscar produtos" placeholder={`Buscar em ${selectedCategory.parent_id ? selectedCategory.name : selectedRoot?.name ?? selectedCategory.name}`} value={search} icon={<Search size={17} />} onValueChange={setSearch} />
              <div className="toolbar-right"><div className="catalog-count"><SlidersHorizontal size={15} /><span>{filtered.length} {filtered.length === 1 ? 'produto' : 'produtos'}</span></div><SelectField aria-label="Ordenar produtos" value={sort} options={SORTS} onValueChange={setSort} /></div>
            </div>

            <div className="results-heading"><div><span>CATÁLOGO</span><h2>{selectedCategory.parent_id ? selectedCategory.name : `Todos de ${selectedCategory.name}`}</h2></div><small>{filtered.length} resultados</small></div>
            <ProductResults loading={loading} filtered={filtered} pageItems={pageItems} favorites={favorites} toggleFavorite={toggleFavorite} added={added} addProduct={addProduct} page={page} setPage={setPage} totalPages={totalPages} from={from} to={to} total={total} />
          </>
        )}
      </section>
      <footer className="shop-footer"><div className="container"><span>2P Box</span><span>Qualidade • Variedade • Confiança</span></div></footer>
      <style jsx global>{`
        .loja-shell{background:#fff;color:#111;min-height:100vh;display:flex;flex-direction:column}.loja-page{max-width:1240px;flex:1;padding-top:26px;padding-bottom:54px}.shop-breadcrumb{display:flex;align-items:center;gap:5px;margin-bottom:28px;color:#999;font-size:12px}.shop-breadcrumb a{color:#555!important;text-decoration:none!important}.shop-breadcrumb .current{color:#111;font-weight:700}.catalog-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,460px);gap:42px;align-items:end;padding:12px 0 42px}.catalog-hero h1,.category-header h1{font-family:'Barlow Condensed';font-size:58px;line-height:.92;letter-spacing:-1.8px;font-style:italic;text-transform:uppercase;margin:6px 0 14px;max-width:760px}.catalog-hero p:not(.eyebrow),.category-header p{color:#666;font-size:15px;line-height:1.6;max-width:600px;margin:0}.hero-search{padding-bottom:3px}.section-title-row,.results-heading{display:flex;justify-content:space-between;align-items:end;gap:20px;margin:0 0 16px}.section-title-row span,.results-heading span{font-size:10px;letter-spacing:.13em;color:#999;font-weight:800}.section-title-row h2,.results-heading h2{font-family:'Barlow Condensed';font-size:28px;text-transform:uppercase;font-style:italic;margin:4px 0 0}.section-title-row small,.results-heading small{color:#888;font-size:11px}.department-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:30px}.department-card{min-height:215px;border:1px solid #e4e4e4;border-radius:14px;padding:20px;display:flex;flex-direction:column;justify-content:space-between;text-decoration:none!important;color:#111!important;background:#fff;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease}.department-card:hover{transform:translateY(-2px);box-shadow:0 12px 28px rgba(0,0,0,.07);border-color:#cfcfcf}.department-icon{width:44px;height:44px;border-radius:11px;background:#f2f2f2;display:grid;place-items:center}.department-copy h3{font-size:18px;margin:0 0 6px}.department-copy p{font-size:12px;line-height:1.5;color:#777;margin:0 0 16px}.department-copy span{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.category-header{padding:4px 0 28px}.category-header-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.back-link{display:inline-flex;align-items:center;gap:4px;color:#555!important;text-decoration:none!important;font-size:12px;font-weight:700}.category-kicker{font-size:10px;color:#999;font-weight:800;letter-spacing:.13em}.category-header h1{margin-bottom:8px}.subcategory-bar{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.96);backdrop-filter:blur(10px);border-top:1px solid #eee;border-bottom:1px solid #eee;padding:13px 0;margin-bottom:22px;display:flex;align-items:center;gap:22px}.subcategory-heading{display:flex;flex-direction:column;min-width:115px}.subcategory-heading span{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#999}.subcategory-heading strong{font-size:12px}.subcategory-list{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none}.subcategory-list::-webkit-scrollbar{display:none}.sub-button,.sub-active{display:inline-flex;align-items:center;border:1px solid #ddd;background:#fff;color:#333;border-radius:999px;padding:9px 14px;font:700 11px Inter,Arial,sans-serif;white-space:nowrap;text-decoration:none!important}.sub-active{background:#111;color:#fff;border-color:#111}.catalog-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;margin-bottom:24px}.toolbar-right{display:flex;align-items:center;gap:14px}.catalog-count{display:flex;align-items:center;gap:7px;color:#777;font-size:11px;white-space:nowrap}.results-heading{margin-bottom:14px}.product-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}.product{background:#fff;border:1px solid #e6e6e6;border-radius:12px;overflow:hidden;transition:box-shadow .18s ease,transform .18s ease}.product:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(0,0,0,.06)}.product-image-wrap{position:relative}.product-image-link{display:block;text-decoration:none}.product-image{height:260px;background:#f7f7f7;position:relative}.product-image img{width:100%;height:100%;object-fit:contain}.product-favorite{position:absolute;right:10px;top:10px;width:34px;height:34px;border:1px solid #e5e5e5;border-radius:50%;background:rgba(255,255,255,.94);display:grid;place-items:center;color:#222;cursor:pointer}.product-favorite.is-favorite{background:#111;color:#fff;border-color:#111}.low-stock{position:absolute;left:10px;bottom:10px;background:#111;color:#fff;border-radius:5px;padding:5px 7px;font-size:9px;font-weight:800;text-transform:uppercase}.product-body{padding:14px}.product-info-link{text-decoration:none!important;color:#111!important;display:block}.product-info-link small{display:block;color:#888;font-size:9px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.product-info-link h2{font-size:15px;line-height:1.25;margin:0 0 7px}.product-info-link p{font-size:11px;line-height:1.45;color:#777;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:32px}.product-buy{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:14px}.product-buy strong{font-size:17px}.catalog-add-button{border:0;background:#111;color:#fff;border-radius:7px;padding:9px 11px;font:800 10px Inter,Arial,sans-serif;cursor:pointer}.catalog-add-button:hover{background:#333}.catalog-add-button:disabled{background:#ddd;color:#888;cursor:not-allowed}.catalog-add-button.added{display:inline-flex;align-items:center;gap:4px}.shop-footer{border-top:1px solid #eee;padding:22px 0;color:#777;font-size:11px}.shop-footer .container{display:flex;justify-content:space-between;gap:20px}@media(max-width:900px){.catalog-hero{grid-template-columns:1fr;gap:20px}.department-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.product-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.catalog-toolbar{grid-template-columns:1fr}.toolbar-right{justify-content:space-between}.subcategory-bar{align-items:flex-start}.catalog-hero h1,.category-header h1{font-size:48px}}@media(max-width:640px){.loja-page{padding-top:18px}.catalog-hero{padding-bottom:28px}.catalog-hero h1,.category-header h1{font-size:42px}.department-grid{grid-template-columns:1fr 1fr;gap:9px}.department-card{min-height:180px;padding:15px;border-radius:11px}.department-copy h3{font-size:15px}.department-copy p{font-size:10px}.product-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.product-image{height:190px}.product-body{padding:10px}.product-info-link h2{font-size:13px}.product-info-link p{display:none}.product-buy{align-items:flex-end;flex-direction:column;gap:8px}.catalog-add-button{width:100%}.product-buy strong{align-self:flex-start}.subcategory-bar{gap:12px;display:block;padding:11px 0}.subcategory-heading{margin-bottom:9px}.shop-breadcrumb{margin-bottom:20px}.shop-footer .container{flex-direction:column;gap:7px}.hero-search{padding:0}}
      `}</style>
    </main>
  );
}

function CatalogResults({ search, setSearch, sort, setSort, filtered, loading, pageItems, favorites, toggleFavorite, added, addProduct, page, setPage, totalPages, from, to, total }: any) {
  return (
    <div className="search-results-block">
      <div className="catalog-toolbar"><TextField aria-label="Buscar produtos" placeholder="Buscar por nome ou descrição" value={search} icon={<Search size={17} />} onValueChange={setSearch} /><SelectField aria-label="Ordenar produtos" value={sort} options={SORTS} onValueChange={setSort} /></div>
      <div className="results-heading"><div><span>BUSCA</span><h2>Resultados encontrados</h2></div><small>{filtered.length} resultados</small></div>
      <ProductResults loading={loading} filtered={filtered} pageItems={pageItems} favorites={favorites} toggleFavorite={toggleFavorite} added={added} addProduct={addProduct} page={page} setPage={setPage} totalPages={totalPages} from={from} to={to} total={total} />
    </div>
  );
}

function ProductResults({ loading, filtered, pageItems, favorites, toggleFavorite, added, addProduct, page, setPage, totalPages, from, to, total }: any) {
  if (loading) return <SkeletonGrid count={PAGE_SIZE} height={330} />;
  if (!filtered.length) return <div className="empty-catalog"><div className="empty-icon"><Search size={24} /></div><h3>Nenhum produto encontrado</h3><p>Tente outra busca ou selecione outra categoria.</p></div>;
  return <><div className="product-grid">{pageItems.map((product: Product) => {
    const names = (product.product_categories ?? []).map((row) => row.categories?.name).filter(Boolean) as string[];
    return <article className="product" key={product.id}><div className="product-image-wrap"><Link href={`/produto/${product.slug}`} className="product-image-link"><div className="product-image"><ProductImage src={productCover(product)} alt={product.name} sizes="(max-width:640px) 50vw, 280px" />{product.stock > 0 && product.stock <= 5 && <span className="low-stock">Últimas unidades</span>}</div></Link><button type="button" aria-label={favorites.includes(product.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} className={`product-favorite ${favorites.includes(product.id) ? 'is-favorite' : ''}`} onClick={() => toggleFavorite(product.id)}><Heart size={15} strokeWidth={1.8} fill={favorites.includes(product.id) ? 'currentColor' : 'none'} /></button></div><div className="product-body"><Link href={`/produto/${product.slug}`} className="product-info-link"><small>{names.slice(0, 2).join(' • ') || '2P Box'}</small><h2>{product.name}</h2>{product.description && <p>{product.description}</p>}</Link><div className="product-buy"><strong>R$ {Number(product.price).toFixed(2).replace('.', ',')}</strong><button type="button" className={`catalog-add-button ${added === product.id ? 'added' : ''}`} disabled={product.stock <= 0} onClick={() => addProduct(product)}>{added === product.id ? <><Check size={16} /> Adicionado</> : product.stock > 0 ? 'Adicionar' : 'Indisponível'}</button></div></div></article>;
  })}</div><Pagination page={page} totalPages={totalPages} onPageChange={setPage} from={from} to={to} total={total} label="produtos" scrollTargetId="catalogo" /></>;
}
