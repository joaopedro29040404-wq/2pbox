'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Heart, MessageCircle, Minus, Plus, ShoppingCart, Store, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/components/cart-provider';
import { SiteHeader } from '@/components/site-header';
import { ProductImage } from '@/components/ui/product-image';
import { PageLoader } from '@/components/ui/loader';
import { useToast } from '@/components/ui/toast';
import { money } from '@/lib/order-format';

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  images?: string[] | null;
  categories?: { name: string } | null;
};
type AuthUser = { id: string };

export default function ProductPage() {
  const params = useParams();
  const slug = String(params.slug);
  const { add, count } = useCart();
  const toast = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const [selected, setSelected] = useState(0);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let mounted = true;

    (async () => {
      const [{ data }, { data: auth }] = await Promise.all([
        client.from('products').select('*,categories(name)').eq('slug', slug).eq('active', true).maybeSingle(),
        client.auth.getUser(),
      ]);
      if (!mounted) return;

      setProduct((data ?? null) as Product | null);
      setUser((auth.user ?? null) as AuthUser | null);

      if (auth.user && data?.id) {
        const { data: favoriteRow } = await client
          .from('customer_favorites')
          .select('product_id')
          .eq('customer_id', auth.user.id)
          .eq('product_id', data.id)
          .maybeSingle();
        if (mounted) setFavorite(Boolean(favoriteRow));
      }
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <main className="product-page">
        <SiteHeader subtitle="PRODUTO" />
        <PageLoader title="Carregando produto" description="Buscando as informações e as fotos deste item." />
      </main>
    );
  }

  if (!product) {
    return (
      <main className="product-page">
        <SiteHeader subtitle="PRODUTO" />
        <section className="container product-loading">
          <h1>Produto não encontrado</h1>
          <Link href="/loja" className="product-back">
            <ArrowLeft size={16} /> Voltar à loja
          </Link>
        </section>
      </main>
    );
  }

  const gallery = Array.from(new Set([product.image_url, ...(Array.isArray(product.images) ? product.images : [])].filter(Boolean))) as string[];
  const image = gallery[selected] || gallery[0] || null;

  function addProduct() {
    if (!product) return;
    add(
      { id: product.id, name: product.name, price: Number(product.price), stock: product.stock, image_url: gallery[0] || undefined },
      { quantity },
    );
    setAdded(true);
  }

  async function toggleFavorite() {
    const client = supabase;
    if (!client || !product) return;
    if (!user) {
      toast.info('Entre para salvar favoritos', 'Crie sua conta para guardar produtos.');
      window.location.href = '/conta';
      return;
    }
    if (favorite) {
      const { error } = await client.from('customer_favorites').delete().eq('customer_id', user.id).eq('product_id', product.id);
      if (error) return toast.error('Não foi possível remover dos favoritos', error.message);
      setFavorite(false);
      toast.info('Removido dos favoritos', product.name);
      return;
    }
    const { error } = await client.from('customer_favorites').insert({ customer_id: user.id, product_id: product.id });
    if (error) return toast.error('Não foi possível favoritar', error.message);
    setFavorite(true);
    toast.success('Salvo nos favoritos', product.name);
  }

  return (
    <main className="product-page">
      <SiteHeader subtitle="PRODUTO" />
      <section className="container product-main">
        <Link href="/loja" className="product-back">
          <ArrowLeft size={16} /> Voltar à loja
        </Link>
        <div className="product-breadcrumb">
          2P BOX <span>/</span> {product.categories?.name || 'Produto'}
        </div>

        <div className="product-layout">
          <div className="product-gallery">
            <div className="main-product-image">
              <ProductImage src={image} alt={product.name} sizes="(max-width:900px) 100vw, 620px" priority />
              {gallery.length > 1 && (
                <>
                  <button type="button" className="gallery-arrow left" onClick={() => setSelected((selected - 1 + gallery.length) % gallery.length)} aria-label="Imagem anterior">
                    <ChevronLeft size={20} />
                  </button>
                  <button type="button" className="gallery-arrow right" onClick={() => setSelected((selected + 1) % gallery.length)} aria-label="Próxima imagem">
                    <ChevronRight size={20} />
                  </button>
                </>
              )}
            </div>
            {gallery.length > 1 && (
              <div className="thumbnail-row">
                {gallery.map((source, index) => (
                  <button type="button" key={`${source}-${index}`} className={`thumbnail ${index === selected ? 'active' : ''}`} onClick={() => setSelected(index)}>
                    <ProductImage src={source} alt={`${product.name} ${index + 1}`} sizes="78px" />
                  </button>
                ))}
              </div>
            )}
            <div className="product-gallery-note">
              {gallery.length} {gallery.length === 1 ? 'imagem do produto' : 'imagens do produto'}
            </div>
          </div>

          <div className="product-info">
            <div className="product-info-top">
              <p className="product-category">{product.categories?.name || '2P BOX'}</p>
              <button
                type="button"
                className={`favorite-btn ${favorite ? 'is-favorite' : ''}`}
                aria-label={favorite ? 'Remover dos favoritos' : 'Favoritar'}
                onClick={toggleFavorite}
              >
                <Heart size={20} fill={favorite ? 'currentColor' : 'none'} />
              </button>
            </div>

            <h1>{product.name}</h1>
            {product.description && <p className="product-description">{product.description}</p>}
            <div className="product-price">{money(product.price)}</div>
            <div className={`availability ${product.stock > 0 ? 'available' : 'unavailable'}`}>
              {product.stock > 0 ? `Em estoque · ${product.stock} unidade(s)` : 'Produto sem estoque'}
            </div>

            {product.stock > 0 && (
              <div className="purchase-box">
                <div className="purchase-label">Quantidade</div>
                <div className="purchase-row">
                  <div className="quantity-premium">
                    <button type="button" className="quantity-control-btn" aria-label="Diminuir" onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}>
                      <Minus size={15} />
                    </button>
                    <strong>{quantity}</strong>
                    <button
                      type="button"
                      className="quantity-control-btn"
                      aria-label="Aumentar"
                      onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                      disabled={quantity >= product.stock}
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                  {added ? (
                    <Link className="primary add-product" href="/carrinho">
                      <Check size={18} /> Ir para o carrinho
                    </Link>
                  ) : (
                    <button type="button" className="primary add-product" onClick={addProduct}>
                      <ShoppingCart size={18} /> Adicionar ao carrinho
                    </button>
                  )}
                </div>
                {count > 0 && (
                  <Link href="/carrinho" className="view-cart-link">
                    <ShoppingCart size={14} /> Ver carrinho · {count} {count === 1 ? 'item' : 'itens'}
                  </Link>
                )}
              </div>
            )}

            <div className="delivery-panel">
              <div className="delivery-panel-head">
                <div>
                  <p className="product-category">RECEBIMENTO</p>
                  <h2>Veja como você pode receber</h2>
                </div>
                <span>
                  <Truck size={12} /> Escolha no carrinho
                </span>
              </div>
              <div className="delivery-options-info">
                <div>
                  <Store size={19} />
                  <div>
                    <strong>Retirar na loja</strong>
                    <span>Sem custo de entrega</span>
                  </div>
                  <Check size={15} />
                </div>
                <div>
                  <MessageCircle size={19} />
                  <div>
                    <strong>Calcular frete no WhatsApp</strong>
                    <span>Combine o frete e a entrega pelo WhatsApp</span>
                  </div>
                  <Check size={15} />
                </div>
              </div>
              <div className="delivery-selection-note">
                <strong>Você escolhe depois.</strong>
                <span>As opções ficam disponíveis no carrinho. Assim você decide a melhor forma de receber antes de finalizar.</span>
              </div>
            </div>

            <div className="product-trust">
              <div>
                <strong>Compra simples</strong>
                <span>Pedido direto e seguro</span>
              </div>
              <div>
                <strong>Estoque atualizado</strong>
                <span>Disponibilidade em tempo real</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style jsx global>{`
        .product-page{background:#fff;color:#111;min-height:100vh}
        .product-main{padding-top:24px;padding-bottom:90px}
        .product-back{display:inline-flex;align-items:center;gap:7px;color:#555;font:700 12px Inter,Arial,sans-serif;text-decoration:none;margin-bottom:18px}
        .product-back:hover{color:#111}
        .product-breadcrumb{font-size:10px;letter-spacing:.14em;color:#999;text-transform:uppercase;margin-bottom:28px}
        .product-breadcrumb span{margin:0 8px;color:#ccc}
        .product-layout{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(380px,.92fr);gap:64px;align-items:start}
        .product-gallery{min-width:0}
        .main-product-image{position:relative;width:100%;height:min(60vw,600px);min-height:440px;background:#f7f7f5;border-radius:8px;overflow:hidden}
        .main-product-image .ui-product-image img{padding:34px}
        .gallery-arrow{position:absolute;top:50%;transform:translateY(-50%);z-index:3;width:42px;height:42px;border:1px solid #ddd;background:rgba(255,255,255,.94);border-radius:50%;display:grid;place-items:center;cursor:pointer;color:#111}
        .gallery-arrow.left{left:16px}
        .gallery-arrow.right{right:16px}
        .thumbnail-row{display:flex;gap:10px;margin-top:12px;overflow-x:auto;padding-bottom:3px}
        .thumbnail{width:78px;height:78px;flex:0 0 78px;border:1px solid #ddd;background:#f7f7f5;padding:0;border-radius:6px;overflow:hidden;cursor:pointer}
        .thumbnail.active{border:2px solid #111}
        .thumbnail .ui-product-image img{padding:6px}
        .product-gallery-note{font-size:9px;color:#999;text-transform:uppercase;letter-spacing:.12em;margin-top:10px}
        .product-info{padding:14px 0 0;min-width:0}
        .product-info-top{display:flex;justify-content:space-between;align-items:center}
        .product-category{font:800 10px Inter,Arial,sans-serif;letter-spacing:.16em;color:#777;text-transform:uppercase;margin:0}
        .favorite-btn{width:42px;height:42px;border:1px solid #ddd;background:#fff;border-radius:50%;display:grid;place-items:center;cursor:pointer;color:#555;transition:.18s}
        .favorite-btn:hover{border-color:#111;color:#111}
        .favorite-btn.is-favorite{background:#ffc400;border-color:#ffc400;color:#111}
        .product-info h1{font-family:'Barlow Condensed';font-size:52px;line-height:.95;text-transform:uppercase;font-style:italic;margin:18px 0}
        .product-description{font-size:14px;line-height:1.7;color:#666;max-width:510px;margin:0 0 28px}
        .product-price{font-size:30px;font-weight:900;margin-bottom:9px}
        .availability{font-size:11px;font-weight:800;margin-bottom:26px}
        .availability.available{color:#2e7d4f}
        .availability.unavailable{color:#a00}
        .purchase-box{border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:20px 0}
        .purchase-label{font:900 10px Inter,Arial,sans-serif;text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px}
        .purchase-row{display:flex;gap:12px;align-items:stretch}
        .quantity-premium{height:52px;width:124px;flex:0 0 124px;border:1px solid #d5d5d5;border-radius:10px;background:#fff;display:grid;grid-template-columns:38px 1fr 38px;align-items:center;overflow:hidden}
        .quantity-premium strong{text-align:center;font-size:14px;font-weight:800;border-left:1px solid #eee;border-right:1px solid #eee;height:100%;display:grid;place-items:center}
        .quantity-control-btn{height:100%;width:100%;border:0;background:#fff;display:grid;place-items:center;color:#111;cursor:pointer}
        .quantity-control-btn:hover:not(:disabled){background:#f5f5f5}
        .quantity-control-btn:disabled{opacity:.35;cursor:not-allowed}
        .add-product{display:inline-flex;align-items:center;justify-content:center;gap:9px;height:52px;flex:1;border:0;border-radius:10px;background:#ffc400;color:#111;text-decoration:none;font:900 13px Inter,Arial,sans-serif;cursor:pointer}
        .add-product:hover{background:#111;color:#fff}
        .view-cart-link{display:inline-flex;align-items:center;gap:6px;margin-top:12px;color:#555;text-decoration:underline;text-underline-offset:3px;font:700 11px Inter,Arial,sans-serif}
        .delivery-panel{margin-top:28px;border:1px solid #dedede;border-radius:14px;padding:20px;background:#fff}
        .delivery-panel-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}
        .delivery-panel-head h2{font-family:'Barlow Condensed';font-size:25px;text-transform:uppercase;font-style:italic;margin:4px 0 0}
        .delivery-panel-head>span{display:inline-flex;align-items:center;gap:5px;font:900 9px Inter,Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em;background:#f7f7f7;border:1px solid #eee;border-radius:20px;padding:8px 10px;white-space:nowrap}
        .delivery-options-info{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}
        .delivery-options-info>div{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:start;padding:14px;background:#fafafa;border:1px solid #eee;border-radius:9px}
        .delivery-options-info>div>svg:first-child{flex:none;margin-top:1px;color:#111}
        .delivery-options-info div div{display:grid;gap:4px}
        .delivery-options-info strong{font-size:11px}
        .delivery-options-info span{font-size:9px;color:#777;line-height:1.35}
        .delivery-options-info>div>svg:last-child{color:#777;margin-top:1px}
        .delivery-selection-note{display:grid;gap:3px;margin-top:13px;padding-top:13px;border-top:1px solid #eee}
        .delivery-selection-note strong{font:900 10px Inter,Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em}
        .delivery-selection-note span{font-size:10px;color:#777;line-height:1.45}
        .product-trust{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}
        .product-trust>div{padding:16px;border:1px solid #eee;background:#fafafa;border-radius:9px;display:grid;gap:5px}
        .product-trust strong{font-size:12px}
        .product-trust span{font-size:10px;color:#777}
        .product-loading{padding:80px 0;text-align:center}
        @media(max-width:900px){
          .product-layout{grid-template-columns:1fr;gap:36px}
          .main-product-image{height:min(82vw,540px);min-height:320px}
          .product-info{padding-top:0}
          .product-info h1{font-size:46px}
        }
        @media(max-width:520px){
          .product-main{padding-top:18px;padding-bottom:60px}
          .product-breadcrumb{margin-bottom:18px}
          .main-product-image{height:86vw;min-height:290px;max-height:420px}
          .main-product-image .ui-product-image img{padding:22px}
          .gallery-arrow{width:36px;height:36px}
          .gallery-arrow.left{left:9px}
          .gallery-arrow.right{right:9px}
          .thumbnail{width:64px;height:64px;flex-basis:64px}
          .product-info h1{font-size:38px;margin-top:13px}
          .product-description{font-size:13px;margin-bottom:22px}
          .product-price{font-size:28px}
          .purchase-row{gap:8px}
          .quantity-premium{width:108px;flex-basis:108px;grid-template-columns:32px 1fr 32px}
          .add-product{font-size:12px;padding:0 12px}
          .delivery-panel{padding:16px;margin-top:22px}
          .delivery-panel-head h2{font-size:22px}
          .delivery-options-info,.product-trust{grid-template-columns:1fr}
          .favorite-btn{width:38px;height:38px}
        }
      `}</style>
    </main>
  );
}
