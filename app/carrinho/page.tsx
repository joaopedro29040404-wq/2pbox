import Link from 'next/link';
import { ArrowLeft, ShoppingBag } from 'lucide-react';

export default function CarrinhoPage() {
  return <main><header className="header container"><Link href="/" className="brand"><div className="brand-mark">2P</div><div><strong>2P BOX</strong><small>TUDO QUE VOCÊ PRECISA, EM UM SÓ LUGAR.</small></div></Link></header><section className="container section empty-cart"><ShoppingBag size={54}/><h1>Seu carrinho está vazio</h1><p>Adicione produtos para continuar sua compra.</p><Link className="primary" href="/#produtos"><ArrowLeft size={17}/> Voltar para a loja</Link></section></main>;
}
