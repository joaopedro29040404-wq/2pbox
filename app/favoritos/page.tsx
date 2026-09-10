'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Heart, Trash2, UserRound } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/components/cart-provider';
import { SiteHeader } from '@/components/site-header';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { ProductImage } from '@/components/ui/product-image';
import { SkeletonGrid } from '@/components/ui/loader';
import { useToast } from '@/components/ui/toast';
import { money } from '@/lib/order-format';

type Product = { id: string; name: string; slug: string; description: string | null; price: number; stock: number; image_url: string | null };
type AuthUser = { id: string; user_metadata?: { full_name?: string } };

const PAGE_SIZE = 8;

export default function FavoritesPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { add } = useCart();
  const toast = useToast();

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }
    let mounted = true;

    (async () => {
      const { data: auth } = await client.auth.getUser();
      if (!auth.user) {
        if (mounted) setLoading(false);
        return;
      }
      if (mounted) setUser(auth.user as AuthUser);

      const { data: favorites } = await client.from('customer_favorites').select('product_id').eq('customer_id', auth.user.id);
      const ids = (favorites ?? []).map((row: { product_id: string }) => row.product_id);
      if (!ids.length) {
        if (mounted) {
          setProducts([]);
          setLoading(false);
        }
        return;
      }

      const { data } = await client.from('products').select('id,name,slug,description,price,stock,image_url').in('id', ids).eq('active', true);
      if (mounted) {
        setProducts((data ?? []) as Product[]);
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const { page, setPage, totalPages, pageItems, from, to, total } = usePagination(products, PAGE_SIZE, user?.id);

  async function remove(product: Product) {
    if (!user || !supabase) return;
    const { error } = await supabase.from('customer_favorites').delete().eq('customer_id', user.id).eq('product_id', product.id);
    if (error) return toast.error('Não foi possível remover', error.message);
    setProducts((current) => current.filter((item) => item.id !== product.id));
    toast.info('Removido dos favoritos', product.name);
  }

  function buy(product: Product) {
    add({ id: product.id, name: product.name, price: Number(product.price), stock: product.stock, image_url: product.image_url ?? undefined });
  }

  if (!loading && !user) {
    return (
      <main className="favorites-page">
        <SiteHeader subtitle="MEUS FAVORITOS" />
        <section className="favorites-empty">
          <div className="fav-icon">
            <Heart size={25} />
          </div>
          <p className="eyebrow">MEUS FAVORITOS</p>
          <h1>Entre para salvar seus favoritos.</h1>
          <p>Crie sua conta ou entre para guardar produtos e encontrar tudo novamente.</p>
          <Link href="/conta" className="primary">
            <UserRound size={16} /> Entrar / criar conta
          </Link>
        </section>
        <style jsx global>{styles}</style>
      </main>
    );
  }

  return (
    <main className="favorites-page">
      <SiteHeader subtitle="MEUS FAVORITOS" />
      <section className="container section favorites-shell" id="favoritos">
        <Link href="/loja" className="back-link">
          <ArrowLeft size={16} /> Voltar para a loja
        </Link>

        <div className="favorites-title">
          <div>
            <p className="eyebrow">LISTA PESSOAL</p>
            <h1>Meus favoritos</h1>
            <p>Produtos que você quer encontrar de novo, em um só lugar.</p>
          </div>
          <div className="favorites-count">
            <Heart size={17} />
            <strong>{products.length}</strong>
            <span>salvos</span>
          </div>
        </div>

        {loading ? (
          <SkeletonGrid count={PAGE_SIZE} height={330} />
        ) : products.length === 0 ? (
          <div className="favorites-empty">
            <div className="fav-icon">
              <Heart size={25} />
            </div>
            <h2>Sua lista está vazia</h2>
            <p>Toque no coração dos produtos que você gosta para guardá-los aqui.</p>
            <Link href="/loja" className="primary">
              Explorar produtos
            </Link>
          </div>
        ) : (
          <>
            <div className="favorite-grid">
              {pageItems.map((product) => (
                <article className="favorite-card" key={product.id}>
                  <Link href={`/produto/${product.slug}`} className="fav-image">
                    <ProductImage src={product.image_url} alt={product.name} sizes="(max-width:650px) 50vw, 260px" />
                  </Link>
                  <div className="fav-body">
                    <Link href={`/produto/${product.slug}`}>
                      <small>PRODUTO 2P BOX</small>
                      <h2>{product.name}</h2>
                    </Link>
                    <strong>{money(product.price)}</strong>
                    <div className="fav-actions">
                      <button type="button" className="primary" disabled={product.stock <= 0} onClick={() => buy(product)}>
                        {product.stock > 0 ? 'Adicionar ao carrinho' : 'Indisponível'}
                      </button>
                      <button type="button" className="remove-fav" onClick={() => remove(product)} aria-label="Remover dos favoritos">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} from={from} to={to} total={total} label="favoritos" scrollTargetId="favoritos" />
          </>
        )}
      </section>
      <style jsx global>{styles}</style>
    </main>
  );
}

const styles = `
.favorites-page{min-height:100vh;background:#f8f8f6;color:#111}
.favorites-shell{max-width:1180px;padding-top:44px;padding-bottom:70px}
.back-link{display:inline-flex;align-items:center;gap:7px;color:#666;text-decoration:none;font:700 11px Inter,Arial,sans-serif;margin-bottom:26px}
.favorites-title{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:28px}
.favorites-title .eyebrow{margin:0 0 7px;color:#ad8600;font:900 10px Inter,Arial,sans-serif;letter-spacing:.18em}
.favorites-title h1{font-family:'Barlow Condensed';font-size:54px;text-transform:uppercase;font-style:italic;line-height:.95;margin:0 0 8px}
.favorites-title p{margin:0;color:#777;font-size:13px}
.favorites-count{display:flex;align-items:center;gap:7px;padding:11px 14px;border:1px solid #ddd;background:#fff;border-radius:10px;flex:none}
.favorite-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.favorite-card{background:#fff;border:1px solid #e5e5e2;border-radius:12px;overflow:hidden;display:flex;flex-direction:column}
.fav-image{display:block;height:250px;background:#f4f4f2;text-decoration:none}
.fav-body{padding:15px;display:grid;gap:9px;align-content:start;flex:1}
.fav-body>a{text-decoration:none;color:#111}
.fav-body small{font-size:8px;letter-spacing:.12em;color:#888;font-weight:900}
.fav-body h2{font-size:15px;line-height:1.2;margin:6px 0 0}
.fav-body>strong{font-size:17px}
.fav-actions{display:flex;gap:8px;margin-top:auto}
.fav-actions .primary{flex:1;display:inline-flex;align-items:center;justify-content:center;border:0;background:#ffc400;color:#111;border-radius:8px;min-height:42px;padding:0 10px;font:900 11px Inter,Arial,sans-serif;cursor:pointer}
.fav-actions .primary:disabled{background:#eee;color:#999;cursor:not-allowed}
.remove-fav{width:42px;border:1px solid #ddd;background:#fff;border-radius:8px;display:grid;place-items:center;cursor:pointer;color:#666}
.remove-fav:hover{color:#c62828;border-color:#e3b7b7}
.favorites-empty{text-align:center;max-width:560px;margin:60px auto;padding:45px 20px;background:#fff;border:1px solid #e5e5e2;border-radius:18px}
.fav-icon{width:54px;height:54px;margin:0 auto 18px;border-radius:14px;background:#ffc400;display:grid;place-items:center;color:#111}
.favorites-empty .eyebrow{color:#ad8600;font:900 10px Inter,Arial,sans-serif;letter-spacing:.18em;margin:0 0 10px}
.favorites-empty h1{font-family:'Barlow Condensed';font-size:40px;text-transform:uppercase;font-style:italic;margin:0 0 10px}
.favorites-empty h2{font-size:22px;margin:12px 0 7px}
.favorites-empty p{color:#777;font-size:12px;line-height:1.6;margin:0 auto 20px}
.favorites-empty .primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#ffc400;color:#111;border-radius:9px;padding:14px 20px;text-decoration:none;font:900 12px Inter,Arial,sans-serif}
@media(max-width:1000px){.favorite-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:700px){
  .favorites-shell{padding-top:28px}
  .favorites-title{align-items:flex-start;flex-direction:column}
  .favorites-title h1{font-size:42px}
  .favorite-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
  .fav-image{height:180px}
  .fav-body{padding:11px}
  .fav-actions .primary{font-size:10px}
  .remove-fav{width:38px}
  .favorites-empty{margin:34px auto;padding:30px 18px}
}`;
