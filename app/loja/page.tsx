'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, Heart, Search, SlidersHorizontal, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/components/cart-provider';
import { SiteHeader } from '@/components/site-header';
import { Pagination } from '@/components/ui/pagination';
import { ProductImage, productCover } from '@/components/ui/product-image';
import { SkeletonGrid } from '@/components/ui/loader';
import { SelectField, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';

type Category = { id: string; name: string; parent_id: string | null };
type ProductCategory = { id: string; name: string; parent_id: string | null };
type Promotion = { promotional_price: number; starts_at: string; ends_at: string; active: boolean };
type Product = {
  id: string; name: string; slug: string; description: string | null; price: number; stock: number;
  image_url: string | null; category_id: string | null; promotionalPrice?: number | null;
  promotions?: Promotion[] | null;
  product_categories?: { category_id: string; categories?: ProductCategory | null }[] | null;
};
type AuthUser = { id: string; user_metadata?: { full_name?: string } };

const PAGE_SIZE = 12;
const SORTS = [
  { value: 'recent', label: 'Mais recentes' }, { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' }, { value: 'name', label: 'Ordem alfabética' },
];
const ROOT_ORDER = ['Papelaria', 'Eletrônicos', 'Acessórios para celular', 'Variedades'];

function positivePage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function cleanSearch(value: string) {
  return value.replace(/[,%()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
}

export default function LojaPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [category, setCategory] = useState('Todas');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [offersOnly, setOffersOnly] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const { add } = useCart();
  const toast = useToast();

  useEffect(() => {
    const client = supabase;
    if (!client) { setLoading(false); setInitialized(true); return; }
    let mounted = true;

    async function loadFavorites(userId: string) {
      const { data } = await client.from('customer_favorites').select('product_id').eq('customer_id', userId);
      if (mounted) setFavorites((data ?? []).map((row: { product_id: string }) => row.product_id));
    }

    async function bootstrap() {
      const [{ data: categoryRows }, { data: auth }] = await Promise.all([
        client.from('categories').select('id,name,parent_id').eq('active', true).order('name'),
        client.auth.getUser(),
      ]);
      if (!mounted) return;
      setAllCategories((categoryRows ?? []) as Category[]);
      setUser((auth.user ?? null) as AuthUser | null);
      if (auth.user) await loadFavorites(auth.user.id);

      const params = new URLSearchParams(window.location.search);
      setCategory(params.get('categoria') || 'Todas');
      setSearch(params.get('busca') || '');
      const requestedSort = params.get('ordem') || 'recent';
      setSort(SORTS.some((item) => item.value === requestedSort) ? requestedSort : 'recent');
      setAvailableOnly(params.get('disponivel') === '1');
      setOffersOnly(params.get('ofertas') === '1');
      setPage(positivePage(params.get('page')));
      setInitialized(true);
    }

    void bootstrap();
    const { data: listener } = client.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      setUser((session?.user ?? null) as AuthUser | null);
      if (session?.user) await loadFavorites(session.user.id); else setFavorites([]);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  const roots = useMemo(() => allCategories.filter((c) => !c.parent_id).sort((a, b) => {
    const ai = ROOT_ORDER.indexOf(a.name), bi = ROOT_ORDER.indexOf(b.name);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  }), [allCategories]);
  const subcategories = useMemo(() => allCategories.filter((c) => c.parent_id === category).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [allCategories, category]);
  const selected = allCategories.find((c) => c.id === category) || roots.find((c) => c.id === category);
  const categoryLabel = selected?.name || (category === 'Todas' ? 'Todas' : 'Categoria selecionada');
  const categoryIds = useMemo(() => {
    if (category === 'Todas') return [];
    const selectedCategory = allCategories.find((item) => item.id === category);
    if (!selectedCategory || selectedCategory.parent_id) return [category];
    return [category, ...allCategories.filter((item) => item.parent_id === category).map((item) => item.id)];
  }, [allCategories, category]);

  useEffect(() => {
    if (!initialized || !supabase) return;
    let cancelled = false;
    setLoading(true);

    const loadProducts = async () => {
      const now = new Date().toISOString();
      const categoryRelation = category !== 'Todas'
        ? 'product_categories!inner(category_id,categories(id,name,parent_id))'
        : 'product_categories(category_id,categories(id,name,parent_id))';
      const promotionRelation = offersOnly
        ? 'promotions!inner(promotional_price,starts_at,ends_at,active)'
        : 'promotions(promotional_price,starts_at,ends_at,active)';

      let query = supabase
        .from('products')
        .select(`id,name,slug,description,price,stock,image_url,category_id,created_at,${categoryRelation},${promotionRelation}`, { count: 'exact' })
        .eq('active', true);

      if (categoryIds.length) query = query.in('product_categories.category_id', categoryIds);
      if (availableOnly) query = query.gt('stock', 0);
      if (offersOnly) {
        query = query
          .eq('promotions.active', true)
          .lte('promotions.starts_at', now)
          .gte('promotions.ends_at', now)
          .gt('promotions.promotional_price', 0);
      }

      const safeSearch = cleanSearch(deferredSearch);
      if (safeSearch) query = query.or(`name.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`);

      if (sort === 'price_asc') query = query.order('price', { ascending: true });
      else if (sort === 'price_desc') query = query.order('price', { ascending: false });
      else if (sort === 'name') query = query.order('name', { ascending: true });
      else query = query.order('created_at', { ascending: false });

      const fromIndex = (page - 1) * PAGE_SIZE;
      const { data, error, count } = await query.range(fromIndex, fromIndex + PAGE_SIZE - 1);
      if (cancelled) return;

      if (error) {
        setProducts([]);
        setTotal(0);
        toast.error('Não foi possível carregar o catálogo', error.message);
      } else {
        const mapped = ((data ?? []) as unknown as Product[]).map((product) => {
          const active = (Array.isArray(product.promotions) ? product.promotions : []).find((promotion) =>
            promotion?.active &&
            Number(promotion.promotional_price) > 0 &&
            Number(promotion.promotional_price) < Number(product.price) &&
            new Date(promotion.starts_at).getTime() <= Date.now() &&
            new Date(promotion.ends_at).getTime() >= Date.now()
          );
          return { ...product, promotionalPrice: active ? Number(active.promotional_price) : null };
        });
        setProducts(mapped);
        setTotal(count ?? 0);
      }
      setLoading(false);
    };

    void loadProducts();
    return () => { cancelled = true; };
  }, [initialized, categoryIds, category, deferredSearch, sort, page, availableOnly, offersOnly, toast]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  useEffect(() => {
    if (!loading && page > totalPages) setPage(totalPages);
  }, [loading, page, totalPages]);

  useEffect(() => {
    if (!initialized) return;
    const url = new URL(window.location.href);
    if (category === 'Todas') url.searchParams.delete('categoria'); else url.searchParams.set('categoria', category);
    if (search.trim()) url.searchParams.set('busca', search.trim()); else url.searchParams.delete('busca');
    if (sort === 'recent') url.searchParams.delete('ordem'); else url.searchParams.set('ordem', sort);
    if (availableOnly) url.searchParams.set('disponivel', '1'); else url.searchParams.delete('disponivel');
    if (offersOnly) url.searchParams.set('ofertas', '1'); else url.searchParams.delete('ofertas');
    if (page > 1) url.searchParams.set('page', String(page)); else url.searchParams.delete('page');
    window.history.replaceState({}, '', url);
  }, [initialized, category, search, sort, availableOnly, offersOnly, page]);

  function selectCategory(id: string) {
    setCategory(id);
    setPage(1);
  }

  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function changeSort(value: string) {
    setSort(value);
    setPage(1);
  }

  function addProduct(product: Product) {
    add({ id: product.id, name: product.name, price: Number(product.price), stock: product.stock, image_url: productCover(product) ?? undefined });
    setAdded(product.id); window.setTimeout(() => setAdded(null), 1400);
  }

  async function toggleFavorite(productId: string) {
    const client = supabase; if (!client) return;
    if (!user) { toast.info('Entre para salvar favoritos', 'Crie sua conta para guardar produtos.'); window.location.href = '/conta'; return; }
    if (favorites.includes(productId)) {
      const { error } = await client.from('customer_favorites').delete().eq('customer_id', user.id).eq('product_id', productId);
      if (error) return toast.error('Não foi possível remover dos favoritos', error.message);
      setFavorites((current) => current.filter((id) => id !== productId)); toast.info('Removido dos favoritos'); return;
    }
    const { error } = await client.from('customer_favorites').insert({ customer_id: user.id, product_id: productId });
    if (error) return toast.error('Não foi possível favoritar', error.message);
    setFavorites((current) => [...current, productId]); toast.success('Salvo nos favoritos');
  }

  return (
    <main className="loja-shell">
      <SiteHeader subtitle="CATÁLOGO" />
      <section className="container section loja-page" id="catalogo">
        <div className="shop-breadcrumb"><Link href="/">Início</Link><ChevronRight size={14} /><span>Produtos</span></div>
        <div className="loja-heading"><p className="eyebrow">CATÁLOGO 2P BOX</p><h1>Produtos</h1><p className="loja-subtitle">Encontre o que precisa, escolha seus favoritos e compre de forma simples.</p></div>
        <div className="catalog-controls"><TextField aria-label="Buscar produtos" placeholder="Buscar por nome ou descrição" value={search} icon={<Search size={17} />} onValueChange={changeSearch} /><SelectField aria-label="Ordenar produtos" value={sort} options={SORTS} onValueChange={changeSort} /></div>
        <div className="catalog-toolbar">
          <div className="category-filters">
            <button type="button" className={category === 'Todas' ? 'filter-active' : 'filter-button'} onClick={() => selectCategory('Todas')}>Todas</button>
            {roots.map((item) => <button key={item.id} type="button" className={category === item.id ? 'filter-active' : 'filter-button'} onClick={() => selectCategory(item.id)}>{item.name}</button>)}
          </div>
          <div className="catalog-quick-filters">
            <button type="button" className={availableOnly ? 'quick-filter is-active' : 'quick-filter'} onClick={() => { setAvailableOnly((value) => !value); setPage(1); }}>Disponíveis</button>
            <button type="button" className={offersOnly ? 'quick-filter is-active' : 'quick-filter'} onClick={() => { setOffersOnly((value) => !value); setPage(1); }}>Em oferta</button>
          </div>
          <div className="catalog-count"><SlidersHorizontal size={15} /><span>{total} {total === 1 ? 'produto' : 'produtos'}</span></div>
        </div>
        {category !== 'Todas' && (
          <div className="category-subnav">
            <div className="category-subnav-head"><strong>{categoryLabel}</strong><span>Subcategorias</span></div>
            <div className="category-subnav-list">
              <button type="button" className={category === selected?.id ? 'sub-active' : 'sub-button'} onClick={() => selectCategory(selected?.parent_id ? selected.parent_id : category)}>Todos de {categoryLabel}</button>
              {subcategories.map((item) => <button key={item.id} type="button" className={category === item.id ? 'sub-active' : 'sub-button'} onClick={() => selectCategory(item.id)}>{item.name}</button>)}
            </div>
          </div>
        )}
        {category !== 'Todas' && <div className="active-filter">Você está vendo: <strong>{categoryLabel}</strong><button type="button" onClick={() => selectCategory('Todas')}><X size={12} /> Limpar</button></div>}
        {loading ? <SkeletonGrid count={PAGE_SIZE} height={340} /> : products.length === 0 ? (
          <div className="empty-catalog"><div className="empty-icon"><Search size={24} /></div><h3>Nenhum produto encontrado</h3><p>Tente outra busca ou escolha uma categoria diferente.</p><button type="button" className="primary" onClick={() => { setSearch(''); setAvailableOnly(false); setOffersOnly(false); selectCategory('Todas'); }}>Ver todos os produtos</button></div>
        ) : (
          <><div className="product-grid ui-product-grid">{products.map((product) => {
            const rootNames = new Set<string>();
            (product.product_categories ?? []).forEach((row) => {
              const relation = row.categories;
              const categoryRow = relation || allCategories.find((item) => item.id === row.category_id);
              if (!categoryRow) return;
              const root = categoryRow.parent_id ? allCategories.find((item) => item.id === categoryRow.parent_id) : categoryRow;
              if (root && !root.parent_id) rootNames.add(root.name);
            });
            if (product.category_id) {
              const legacyCategory = allCategories.find((item) => item.id === product.category_id);
              if (legacyCategory) {
                const root = legacyCategory.parent_id ? allCategories.find((item) => item.id === legacyCategory.parent_id) : legacyCategory;
                if (root && !root.parent_id) rootNames.add(root.name);
              }
            }
            const mainCategory = ROOT_ORDER.find((name) => rootNames.has(name)) || Array.from(rootNames)[0] || 'Sem categoria';
            const promo = product.promotionalPrice != null && product.promotionalPrice > 0 && product.promotionalPrice < Number(product.price);
            return <article className={`product ui-product-card${promo ? ' is-offer' : ''}`} key={product.id}><div className="product-image-wrap"><Link href={`/produto/${product.slug}`} className="product-image-link"><div className="product-image ui-product-card-media"><ProductImage src={productCover(product)} alt={product.name} sizes="(max-width:700px) 50vw, 280px" />{promo ? <span className="home-product-badge ui-product-card-offer">OFERTA</span> : product.stock > 0 && product.stock <= 5 ? <span className="low-stock">Últimas unidades</span> : null}</div></Link><button type="button" aria-label={favorites.includes(product.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} className={`product-favorite ui-product-card-favorite ${favorites.includes(product.id) ? 'is-favorite' : ''}`} onClick={() => toggleFavorite(product.id)}><Heart size={16} strokeWidth={1.8} fill={favorites.includes(product.id) ? 'currentColor' : 'none'} /></button></div><div className="product-body ui-product-card-body"><Link href={`/produto/${product.slug}`} className="product-info-link ui-product-card-info"><small className="ui-product-card-eyebrow">{mainCategory}</small><h2 className="ui-product-card-title">{product.name}</h2>{product.description && <p className="ui-product-card-summary">{product.description}</p>}</Link><div className="product-buy ui-product-card-footer"><div className="catalog-price" data-marketing-promotion-price={promo ? 'true' : undefined}>{promo ? <del className="ui-product-card-old-price">R$ {Number(product.price).toFixed(2).replace('.', ',')}</del> : null}<strong className={`ui-product-card-price${promo ? ' is-promo' : ''}`}>R$ {Number(promo ? product.promotionalPrice : product.price).toFixed(2).replace('.', ',')}</strong></div><button type="button" className={`catalog-add-button ui-product-card-action ${added === product.id ? 'added' : ''}`} disabled={product.stock <= 0} onClick={() => addProduct(product)}>{added === product.id ? <><Check size={16} /> Adicionado</> : product.stock > 0 ? 'Adicionar' : 'Indisponível'}</button></div></div></article>;
          })}</div><Pagination page={page} totalPages={totalPages} onPageChange={setPage} from={from} to={to} total={total} label="produtos" scrollTargetId="catalogo" /></>
        )}
      </section>
      <footer className="shop-footer"><div className="container"><span>2P Box</span><span>Qualidade • Variedade • Confiança</span></div></footer>
      <style jsx global>{`
        .loja-shell{background:#fff;color:#111;min-height:100vh;display:flex;flex-direction:column}.loja-page{max-width:1240px;flex:1;padding-top:26px}.shop-breadcrumb{display:flex;align-items:center;gap:5px;margin-bottom:20px;color:#888;font-size:12px}.shop-breadcrumb a{color:#555!important;text-decoration:none!important}.loja-heading{margin-bottom:26px}.loja-heading h1{font-family:'Barlow Condensed';font-size:52px;line-height:.95;letter-spacing:-1.8px;font-style:italic;text-transform:uppercase;margin:5px 0 12px}.loja-subtitle{color:#686868;margin:0;max-width:590px;font-size:15px;line-height:1.6}.catalog-controls{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px;align-items:end;margin-bottom:18px}.catalog-controls>*:first-child{grid-column:span 8}.catalog-controls>*:last-child{grid-column:span 4}.catalog-toolbar{border-top:1px solid #e8e8e8;border-bottom:1px solid #e8e8e8;padding:14px 0;display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:18px}.category-filters{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none}.category-filters::-webkit-scrollbar{display:none}.filter-button,.filter-active,.sub-button,.sub-active{border:1px solid #dedede;background:#fff;color:#333;border-radius:22px;padding:9px 15px;font:700 12px Inter,Arial,sans-serif;white-space:nowrap;cursor:pointer}.filter-active,.sub-active{background:#111;color:#fff;border-color:#111}.catalog-quick-filters{display:flex;align-items:center;gap:7px;margin-left:auto}.quick-filter{border:1px solid #dedede;background:#fff;color:#555;border-radius:999px;padding:8px 11px;font:800 10px Inter,Arial,sans-serif;cursor:pointer;white-space:nowrap}.quick-filter.is-active{background:#111;color:#fff;border-color:#111}.catalog-count{display:flex;align-items:center;gap:7px;color:#777;font-size:11px;white-space:nowrap}.category-subnav{padding:14px 16px;background:#fafafa;border:1px solid #e8e8e8;border-radius:12px;margin-bottom:18px}.category-subnav-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}.category-subnav-head strong{font-size:13px}.category-subnav-head span{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.1em}.category-subnav-list{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none}.category-subnav-list::-webkit-scrollbar{display:none}.sub-button,.sub-active{padding:8px 12px;font-size:11px}.active-filter{display:flex;align-items:center;gap:6px;margin:0 0 18px;padding:10px 13px;background:#f7f7f7;border-radius:8px;color:#666;font-size:11px}.active-filter strong{color:#111}.active-filter button{display:inline-flex;align-items:center;gap:4px;margin-left:auto;border:0;background:none;color:#111;font:700 11px Inter,Arial,sans-serif;cursor:pointer;text-decoration:underline}.product-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px;align-items:stretch}.product{background:#fff;border:1px solid #e6e6e6;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;min-width:0;height:100%;transition:border-color .18s,box-shadow .18s}.product:hover{border-color:#dcd0a0;box-shadow:0 10px 26px rgba(0,0,0,.06)}.product-image-wrap{position:relative;width:100%;min-width:0}.product-image-link{text-decoration:none!important;display:block;width:100%}.product-image{position:relative;aspect-ratio:1/1;width:100%;background:#f7f7f7;overflow:hidden}.low-stock{position:absolute;left:12px;top:12px;z-index:2;padding:6px 9px;background:#111;color:#fff;border-radius:5px;font-size:9px;font-weight:900}.product .product-favorite{position:absolute;right:10px;top:10px;width:32px;height:32px;border:1px solid rgba(17,17,17,.08);border-radius:9px;background:rgba(255,255,255,.72);color:rgba(17,17,17,.68);display:grid;place-items:center;cursor:pointer;z-index:5}.product .product-favorite.is-favorite{background:rgba(255,196,0,.86);color:#111}.product-body{padding:16px;display:flex;flex-direction:column;flex:1;min-width:0;min-height:178px;box-sizing:border-box}.product-info-link{color:inherit!important;text-decoration:none!important;display:block}.product-info-link small{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#a37b00;font-weight:900}.product-info-link h2{font-size:16px;line-height:1.2;margin:7px 0;min-height:38px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.product-info-link p{color:#777;font-size:11px;line-height:1.45;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:31.9px}.product-buy{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto;padding-top:16px}.catalog-price{display:flex;flex-direction:column;gap:2px;min-width:0}.catalog-price del{color:#999;font-size:11px;line-height:1.1}.product-buy strong{font-size:18px;white-space:nowrap}.product-buy strong.is-promo{color:#e7ad00}.product .catalog-add-button{border:0;margin:0;background:#ffc400;color:#111;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:0 12px;border-radius:7px;font:900 11px Inter,Arial,sans-serif;cursor:pointer;white-space:nowrap}.product .catalog-add-button.added{background:#111;color:#fff}.product .catalog-add-button:disabled{background:#eee;color:#999;cursor:not-allowed}.empty-catalog{border:1px solid #e5e5e5;border-radius:12px;text-align:center;padding:70px 20px}.empty-catalog .empty-icon{width:52px;height:52px;margin:0 auto 16px;border-radius:14px;background:#fff4bf;display:grid;place-items:center}.empty-catalog h3{margin:0 0 6px;font-size:19px}.empty-catalog p{margin:0 0 20px;color:#777;font-size:13px}.shop-footer{background:#0b0b0b;color:#aaa;padding:26px 0;margin-top:40px}.shop-footer .container{display:flex;justify-content:space-between;gap:16px;font-size:11px}@media(max-width:1000px){.product-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:700px){.loja-page{padding-top:22px}.loja-heading h1{font-size:40px}.loja-subtitle{font-size:13px}.catalog-controls{grid-template-columns:1fr}.catalog-controls>*:first-child,.catalog-controls>*:last-child{grid-column:auto}.catalog-toolbar{align-items:flex-start;flex-direction:column;gap:11px}.category-filters{width:100%;padding-bottom:2px}.catalog-quick-filters{width:100%;margin-left:0}.catalog-count{align-self:flex-end}.product-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.product-body{padding:11px;min-height:160px}.product-info-link h2{font-size:14px;min-height:34px}.product-info-link p{min-height:30.8px}.product-buy{align-items:stretch;flex-direction:column}.product-buy strong{font-size:17px}.product .catalog-add-button{width:100%}}@media(max-width:390px){.product-grid{grid-template-columns:1fr}.shop-footer .container{flex-direction:column}}
      `}</style>
    </main>
  );
}