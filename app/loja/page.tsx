'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronRight, Heart, Search, SlidersHorizontal, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/components/cart-provider';
import { SiteHeader } from '@/components/site-header';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { ProductImage, productCover } from '@/components/ui/product-image';
import { SkeletonGrid } from '@/components/ui/loader';
import { SelectField, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';

type Category = { id: string; name: string };
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
  categories?: Category | null;
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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('Todas');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [added, setAdded] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [user, setUser] = useState<AuthUser | null>(null);
  const { add } = useCart();
  const toast = useToast();

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }
    let mounted = true;

    async function loadFavorites(userId: string) {
      const { data } = await client.from('customer_favorites').select('product_id').eq('customer_id', userId);
      if (mounted) setFavorites((data ?? []).map((row: { product_id: string }) => row.product_id));
    }

    async function load() {
      const [{ data, error }, { data: auth }] = await Promise.all([
        client
          .from('products')
          .select('id,name,slug,description,price,stock,image_url,images,category_id,categories(id,name)')
          .eq('active', true)
          .order('created_at', { ascending: false }),
        client.auth.getUser(),
      ]);
      if (!mounted) return;
      if (error) toast.error('Não foi possível carregar o catálogo', error.message);
      else setProducts((data ?? []) as unknown as Product[]);
      setUser((auth.user ?? null) as AuthUser | null);
      if (auth.user) await loadFavorites(auth.user.id);
      setLoading(false);
      const id = new URLSearchParams(window.location.search).get('categoria');
      if (id) setCategory(id);
    }

    load();

    const { data: listener } = client.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      setUser((session?.user ?? null) as AuthUser | null);
      if (session?.user) await loadFavorites(session.user.id);
      else setFavorites([]);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [toast]);

  const categories = useMemo<Category[]>(
    () => [
      { id: 'Todas', name: 'Todas' },
      ...Array.from(new Map(products.map((p) => p.categories).filter(Boolean).map((c) => [c!.id, c!])).values()),
    ],
    [products],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = products.filter((product) => {
      const matchesCategory = category === 'Todas' || product.category_id === category || product.categories?.id === category;
      const matchesSearch =
        !query || product.name.toLowerCase().includes(query) || (product.description || '').toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });

    switch (sort) {
      case 'price_asc':
        return [...list].sort((a, b) => Number(a.price) - Number(b.price));
      case 'price_desc':
        return [...list].sort((a, b) => Number(b.price) - Number(a.price));
      case 'name':
        return [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      default:
        return list;
    }
  }, [products, category, search, sort]);

  const { page, setPage, totalPages, pageItems, from, to, total } = usePagination(filtered, PAGE_SIZE, `${category}|${search}|${sort}`);

  function selectCategory(id: string) {
    setCategory(id);
    const url = new URL(window.location.href);
    if (id === 'Todas') url.searchParams.delete('categoria');
    else url.searchParams.set('categoria', id);
    window.history.replaceState({}, '', url);
  }

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
          <Link href="/">Início</Link>
          <ChevronRight size={14} />
          <span>Produtos</span>
        </div>

        <div className="loja-heading">
          <p className="eyebrow">CATÁLOGO 2P BOX</p>
          <h1>Produtos</h1>
          <p className="loja-subtitle">Encontre o que precisa, escolha seus favoritos e compre de forma simples.</p>
        </div>

        <div className="catalog-controls">
          <TextField
            aria-label="Buscar produtos"
            placeholder="Buscar por nome ou descrição"
            value={search}
            icon={<Search size={17} />}
            onValueChange={setSearch}
          />
          <SelectField aria-label="Ordenar produtos" value={sort} options={SORTS} onValueChange={setSort} />
        </div>

        <div className="catalog-toolbar">
          <div className="category-filters">
            {categories.map((item) => (
              <button
                key={item.id}
                type="button"
                className={category === item.id ? 'filter-active' : 'filter-button'}
                onClick={() => selectCategory(item.id)}
              >
                {item.name}
              </button>
            ))}
          </div>
          <div className="catalog-count">
            <SlidersHorizontal size={15} />
            <span>
              {filtered.length} {filtered.length === 1 ? 'produto' : 'produtos'}
            </span>
          </div>
        </div>

        {category !== 'Todas' && (
          <div className="active-filter">
            Você está vendo: <strong>{categories.find((item) => item.id === category)?.name || 'Categoria selecionada'}</strong>
            <button type="button" onClick={() => selectCategory('Todas')}>
              <X size={12} /> Limpar
            </button>
          </div>
        )}

        {loading ? (
          <SkeletonGrid count={PAGE_SIZE} height={340} />
        ) : filtered.length === 0 ? (
          <div className="empty-catalog">
            <div className="empty-icon">
              <Search size={24} />
            </div>
            <h3>Nenhum produto encontrado</h3>
            <p>Tente outra busca ou escolha uma categoria diferente.</p>
            <button
              type="button"
              className="primary"
              onClick={() => {
                setSearch('');
                selectCategory('Todas');
              }}
            >
              Ver todos os produtos
            </button>
          </div>
        ) : (
          <>
            <div className="product-grid">
              {pageItems.map((product) => (
                <article className="product" key={product.id}>
                  <div className="product-image-wrap">
                    <Link href={`/produto/${product.slug}`} className="product-image-link">
                      <div className="product-image">
                        <ProductImage src={productCover(product)} alt={product.name} sizes="(max-width:700px) 50vw, 280px" />
                        {product.stock > 0 && product.stock <= 5 && <span className="low-stock">Últimas unidades</span>}
                      </div>
                    </Link>
                    <button
                      type="button"
                      aria-label={favorites.includes(product.id) ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                      className={`product-favorite ${favorites.includes(product.id) ? 'is-favorite' : ''}`}
                      onClick={() => toggleFavorite(product.id)}
                    >
                      <Heart size={15} strokeWidth={1.8} fill={favorites.includes(product.id) ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  <div className="product-body">
                    <Link href={`/produto/${product.slug}`} className="product-info-link">
                      <small>{product.categories?.name || '2P Box'}</small>
                      <h2>{product.name}</h2>
                      {product.description && <p>{product.description}</p>}
                    </Link>
                    <div className="product-buy">
                      <strong>R$ {Number(product.price).toFixed(2).replace('.', ',')}</strong>
                      <button
                        type="button"
                        className={`catalog-add-button ${added === product.id ? 'added' : ''}`}
                        disabled={product.stock <= 0}
                        onClick={() => addProduct(product)}
                      >
                        {added === product.id ? (
                          <>
                            <Check size={16} /> Adicionado
                          </>
                        ) : product.stock > 0 ? (
                          'Adicionar'
                        ) : (
                          'Indisponível'
                        )}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} from={from} to={to} total={total} label="produtos" scrollTargetId="catalogo" />
          </>
        )}
      </section>

      <footer className="shop-footer">
        <div className="container">
          <span>2P Box</span>
          <span>Qualidade • Variedade • Confiança</span>
        </div>
      </footer>

      <style jsx global>{`
        .loja-shell{background:#fff;color:#111;min-height:100vh;display:flex;flex-direction:column}
        .loja-page{max-width:1240px;flex:1;padding-top:26px}
        .shop-breadcrumb{display:flex;align-items:center;gap:5px;margin-bottom:20px;color:#888;font-size:12px}
        .shop-breadcrumb a{color:#555!important;text-decoration:none!important}
        .loja-heading{margin-bottom:26px}
        .loja-heading h1{font-family:'Barlow Condensed';font-size:52px;line-height:.95;letter-spacing:-1.8px;font-style:italic;text-transform:uppercase;margin:5px 0 12px}
        .loja-subtitle{color:#686868;margin:0;max-width:590px;font-size:15px;line-height:1.6}
        .catalog-controls{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:12px;align-items:end;margin-bottom:18px}
        .catalog-controls>*:first-child{grid-column:span 8}
        .catalog-controls>*:last-child{grid-column:span 4}
        .catalog-toolbar{border-top:1px solid #e8e8e8;border-bottom:1px solid #e8e8e8;padding:14px 0;display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:22px}
        .category-filters{display:flex;gap:7px;overflow-x:auto;scrollbar-width:none}
        .category-filters::-webkit-scrollbar{display:none}
        .filter-button,.filter-active{border:1px solid #dedede;background:#fff;color:#333;border-radius:22px;padding:9px 15px;font:700 12px Inter,Arial,sans-serif;white-space:nowrap;cursor:pointer}
        .filter-active{background:#111;color:#fff;border-color:#111}
        .catalog-count{display:flex;align-items:center;gap:7px;color:#777;font-size:11px;white-space:nowrap}
        .active-filter{display:flex;align-items:center;gap:6px;margin:0 0 18px;padding:10px 13px;background:#f7f7f7;border-radius:8px;color:#666;font-size:11px}
        .active-filter strong{color:#111}
        .active-filter button{display:inline-flex;align-items:center;gap:4px;margin-left:auto;border:0;background:none;color:#111;font:700 11px Inter,Arial,sans-serif;cursor:pointer;text-decoration:underline}
        .product-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}
        .product{background:#fff;border:1px solid #e6e6e6;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;min-width:0;transition:border-color .18s,box-shadow .18s}
        .product:hover{border-color:#dcd0a0;box-shadow:0 10px 26px rgba(0,0,0,.06)}
        .product-image-wrap{position:relative;width:100%;min-width:0}
        .product-image-link{text-decoration:none!important;display:block;width:100%}
        .product-image{position:relative;aspect-ratio:1/1;width:100%;background:#f7f7f7;overflow:hidden}
        .low-stock{position:absolute;left:12px;top:12px;z-index:2;padding:6px 9px;background:#111;color:#fff;border-radius:5px;font-size:9px;font-weight:900}
        .product .product-favorite{position:absolute;right:10px;top:10px;width:32px;height:32px;min-width:32px;max-width:32px;flex:none;margin:0;padding:0;box-sizing:border-box;border:1px solid rgba(17,17,17,.08);border-radius:9px;background:rgba(255,255,255,.72);color:rgba(17,17,17,.68);box-shadow:0 2px 8px rgba(0,0,0,.06);backdrop-filter:blur(6px);display:grid;place-items:center;cursor:pointer;z-index:5;transition:transform .18s,background .18s,color .18s}
        .product .product-favorite:hover{background:#fff;color:#111;transform:scale(1.04)}
        .product .product-favorite.is-favorite{background:rgba(255,196,0,.86);color:#111;border-color:rgba(255,196,0,.45)}
        .product .product-favorite:focus-visible{outline:2px solid #111;outline-offset:2px}
        .product-body{padding:16px;display:flex;flex-direction:column;flex:1;min-width:0}
        .product-info-link{color:inherit!important;text-decoration:none!important;display:block}
        .product-info-link small{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#a37b00;font-weight:900}
        .product-info-link h2{font-size:16px;line-height:1.2;margin:7px 0;min-height:38px}
        .product-info-link p{color:#777;font-size:11px;line-height:1.45;margin:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .product-buy{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto;padding-top:16px}
        .product-buy strong{font-size:18px;white-space:nowrap}
        .product .catalog-add-button{border:0;margin:0;background:#ffc400;color:#111;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;padding:0 12px;border-radius:7px;font:900 11px Inter,Arial,sans-serif;cursor:pointer;white-space:nowrap}
        .product .catalog-add-button.added{background:#111;color:#fff}
        .product .catalog-add-button:disabled{background:#eee;color:#999;cursor:not-allowed}
        .empty-catalog{border:1px solid #e5e5e5;border-radius:12px;text-align:center;padding:70px 20px}
        .empty-catalog .empty-icon{width:52px;height:52px;margin:0 auto 16px;border-radius:14px;background:#fff4bf;display:grid;place-items:center}
        .empty-catalog h3{margin:0 0 6px;font-size:19px}
        .empty-catalog p{margin:0 0 20px;color:#777;font-size:13px}
        .shop-footer{background:#0b0b0b;color:#aaa;padding:26px 0;margin-top:40px}
        .shop-footer .container{display:flex;justify-content:space-between;gap:16px;font-size:11px}
        @media(max-width:1000px){.product-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
        @media(max-width:700px){
          .loja-page{padding-top:22px}
          .loja-heading h1{font-size:40px}
          .loja-subtitle{font-size:13px}
          .catalog-controls{grid-template-columns:1fr}
          .catalog-toolbar{align-items:flex-start;flex-direction:column;gap:11px}
          .category-filters{width:100%;padding-bottom:2px}
          .catalog-count{align-self:flex-end}
          .product-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
          .product-body{padding:11px}
          .product-info-link h2{font-size:14px;min-height:34px}
          .product-info-link p{font-size:10px}
          .product-buy{display:block;padding-top:12px}
          .product-buy strong{display:block;font-size:16px;margin-bottom:9px}
          .product .catalog-add-button{width:100%}
          .shop-footer .container{flex-direction:column;text-align:center}
        }
        @media(max-width:360px){.product-grid{gap:8px}.product-body{padding:9px}.product-info-link h2{font-size:13px}}
      `}</style>
    </main>
  );
}
