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
  product_categories?: { category_id: string; categories?: ProductCategory | null }[] | null;
};
type AuthUser = { id: string; user_metadata?: { full_name?: string } };

const PAGE_SIZE = 12;
const SORTS = [
  { value: 'recent', label: 'Mais recentes' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
  { value: 'name', label: 'Ordem alfabética' },
];

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
        client.from('products').select('id,name,slug,description,price,stock,image_url,images,category_id,product_categories(category_id,categories(id,name,slug,parent_id))').eq('active', true).order('created_at', { ascending: false }),
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

  const productMatchesCategory = (product: Product) => {
    if (!selectedCategory) return true;
    const relations = product.product_categories ?? [];
    const ids = relations.map((row) => row.category_id);
    if (product.category_id && !ids.includes(product.category_id)) ids.push(product.category_id);
    if (ids.includes(selectedCategory.id)) return true;
    if (!selectedCategory.parent_id) return relations.some((row) => row.categories?.parent_id === selectedCategory.id);
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

  const catalogTitle = selectedCategory
    ? selectedCategory.parent_id ? selectedCategory.name : `Todos de ${selectedCategory.name}`
    : 'Todos os produtos';
  const catalogDescription = selectedCategory
    ? selectedCategory.parent_id ? `Produtos de ${selectedCategory.name}.` : `Todos os produtos de ${selectedCategory.name}.`
    : 'Encontre todos os produtos da 2P Box.';

  return (
    <main className="loja-shell">
      <SiteHeader subtitle="CATÁLOGO" />
      <section className="container section loja-page" id="catalogo">
        <div className="shop-breadcrumb">
          <Link href="/">Início</Link><ChevronRight size={14} /><span>Produtos</span>
          {selectedRoot && <><ChevronRight size={14} /><span className="current">{selectedRoot.name}</span></>}
          {selectedCategory?.parent_id && <><ChevronRight size={14} /><span className="current">{selectedCategory.name}</span></>}
        </div>

        <header className="category-header">
          {selectedCategory && (
            <div className="category-header-top">
              <Link href="/loja" className="back-link"><ChevronLeft size={16} /> Todos os produtos</Link>
              <span className="category-kicker">DEPARTAMENTO</span>
            </div>
          )}
          <h1>{catalogTitle}</h1>
          <p>{catalogDescription}</p>
        </header>

        {selectedRoot && subcategories.length > 0 && (
          <nav className="subcategory-bar" aria-label={`Subcategorias de ${selectedRoot.name}`}>
            <div className="subcategory-heading"><span>Explore</span><strong>Subcategorias</strong></div>
            <div className="subcategory-list">
              <Link href={`/loja?categoria=${encodeURIComponent(selectedRoot.slug)}`} className={!selectedCategory?.parent_id ? 'sub-active' : 'sub-button'}>Todos</Link>
              {subcategories.map((sub) => <Link key={sub.id} href={`/loja?categoria=${encodeURIComponent(sub.slug)}`} className={selectedCategory?.id === sub.id ? 'sub-active' : 'sub-button'}>{sub.name}</Link>)}
            </div>
          </nav>
        )}

        <div className="catalog-toolbar">
          <TextField aria-label="Buscar produtos" placeholder={selectedRoot ? `Buscar em ${selectedRoot.name}` : 'Buscar por nome ou descrição'} value={search} icon={<Search size={17} />} onValueChange={setSearch} />
          <div className="toolbar-right"><div className="catalog-count"><SlidersHorizontal size={15} /><span>{filtered.length} {filtered.length === 1 ? 'produto' : 'produtos'}</span></div><SelectField aria-label="Ordenar produtos" value={sort} options={SORTS} onValueChange={setSort} /></div>
        </div>

        <div className="results-heading"><div><span>CATÁLOGO</span><h2>{catalogTitle}</h2></div><small>{filtered.length} resultados</small></div>
        <ProductResults loading={loading} filtered={filtered} pageItems={pageItems} favorites={favorites} toggleFavorite={toggleFavorite} added={added} addProduct={addProduct} page={page} setPage={setPage} totalPages={totalPages} from={from} to={to} total={total} />
      </section>
      <footer className="shop-footer"><div className="container"><span>2P Box</span><span>Qualidade • Variedade • Confiança</span></div></footer>
      <style jsx global>{`
        .loja-shell{background:#fff;color:#111;min-height:100vh;display:flex;flex-direction:column}.loja-page{max-width:1240px;flex:1;padding-top:26px;padding-bottom:54px}.shop-breadcrumb{display:flex;align-items:center;gap:5px;margin-bottom:28px;color:#999;font-size:12px}.shop-breadcrumb a{color:#555!important;text-decoration:none!important}.shop-breadcrumb .current{color:#111;font-weight:700}.category-header{padding:4px 0 28px}.category-header-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.back-link{display:inline-flex;align-items:center;gap:4px;color:#555!important;text-decoration:none!important;font-size:12px;font-weight:700}.category-kicker{font-size:10px;color:#999;font-weight:800;letter-spacing:.13em}.category-header h1{font-family:'Barlow Condensed';font-size:58px;line-height:.92;letter-spacing:-1.8px;font-style:italic;text-transform:uppercase;margin:6px 0 10px;max-width:760px}.category-header p{color:#666;font-size:15px;line-height:1.6;max-width:600px;margin:0}.subcategory-bar{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.96);backdrop-filter:blur(10px);border-top:1px solid #eee;border-bottom:1px solid #eee;padding:13px 0;margin-bottom:22px;display:flex;align-items:center;gap:22px}.subcategory-heading{display:flex;flex-direction:column;min-width:115px}.subcategory-heading span{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#999}.subcategory-heading strong{font-size:12px}.subcategory-list{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none}.subcategory-list::-webkit-scrollbar{display:none}.sub-button,.sub-active{display:inline-flex;align-items:center;border:1px solid #ddd;background:#fff;color:#333;border-radius:999px;padding:9px 14px;font:700 11px Inter,Arial,sans-serif;white-space:nowrap;text-decoration:none!important}.sub-active{background:#111;color:#fff;border-color:#111}.catalog-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;margin-bottom:24px}.toolbar-right{display:flex;align-items:center;gap:14px}.catalog-count{display:flex;align-items:center;gap:7px;color:#777;font-size:11px;white-space:nowrap}.results-heading{display:flex;justify-content:space-between;align-items:end;gap:20px;margin:0 0 14px}.results-heading span{font-size:10px;letter-spacing:.13em;color:#999;font-weight:800}.results-heading h2{font-family:'Barlow Condensed';font-size:28px;text-transform:uppercase;font-style:italic;margin:4px 0 0}.results-heading small{color:#888;font-size:11px}.product-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}.product{background:#fff;border:1px solid #e6e6e6;border-radius:12px;overflow:hidden;transition:box-shadow .18s ease,transform .18s ease}.product:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(0,0,0,.06)}.product-image-wrap{position:relative}.product-image-link{display:block;text-decoration:none}.product-image{height:260px;background:#f7f7f7;position:relative}.product-image img{width:100%;height:100%;object-fit:contain}.product-favorite{position:absolute;right:10px;top:10px;width:34px;height:34px;border:1px solid #e5e5e5;border-radius:50%;background:rgba(255,255,255,.94);display:grid;place-items:center;color:#222;cursor:pointer}.product-favorite.is-favorite{background:#111;color:#fff;border-color:#111}.low-stock{position:absolute;left:10px;bottom:10px;background:#111;color:#fff;border-radius:5px;padding:5px 7px;font-size:9px;font-weight:800;text-transform:uppercase}.product-body{padding:14px}.product-info-link{text-decoration:none!important;color:#111!important;display:block}.product-info-link small{display:block;color:#888;font-size:9px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.product-info-link h2{font-size:15px;line-height:1.25;margin:0 0 7px}.product-info-link p{font-size:11px;line-height:1.45;color:#777;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:32px}.product-buy{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:14px}.product-buy strong{font-size:17px}.catalog-add-button{border:0;background:#111;color:#fff;border-radius:7px;padding:9px 11px;font:800 10px Inter,Arial,sans-serif;cursor:pointer}.catalog-add-button:hover{background:#333}.catalog-add-button:disabled{background:#ddd;color:#888;cursor:not-allowed}.catalog-add-button.added{display:inline-flex;align-items:center;gap:4px}.empty-catalog{border:1px solid #e6e6e6;border-radius:12px;padding:55px 20px;text-align:center}.empty-icon{width:48px;height:48px;margin:0 auto 14px;border-radius:50%;background:#f3f3f3;display:grid;place-items:center}.empty-catalog h3{margin:0 0 6px;font-size:18px}.empty-catalog p{margin:0;color:#777;font-size:12px}.shop-footer{border-top:1px solid #eee;padding:22px 0;color:#777;font-size:11px}.shop-footer .container{display:flex;justify-content:space-between;gap:20px}@media(max-width:900px){.product-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.catalog-toolbar{grid-template-columns:1fr}.toolbar-right{justify-content:space-between}.subcategory-bar{align-items:flex-start}.category-header h1{font-size:48px}}@media(max-width:640px){.loja-page{padding-top:18px}.category-header{padding-bottom:22px}.category-header h1{font-size:42px}.product-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.product-image{height:190px}.product-body{padding:10px}.product-info-link h2{font-size:13px}.product-info-link p{display:none}.product-buy{align-items:flex-end;flex-direction:column;gap:8px}.catalog-add-button{width:100%}.product-buy strong{align-self:flex-start}.subcategory-bar{gap:12px;display:block;padding:11px 0}.subcategory-heading{margin-bottom:9px}.shop-breadcrumb{margin-bottom:20px}.shop-footer .container{flex-direction:column;gap:7px}}
      `}</style>
    </main>
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
