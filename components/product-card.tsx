'use client';

import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/components/cart-provider';

type Product={id:string;name:string;price:number;stock:number;image_url?:string|null;description?:string|null;category?:string};
export function ProductCard({product}:{product:Product}){const {add}=useCart();return <article className="product"><div className="product-image">{product.image_url?<img src={product.image_url} alt={product.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<div className="product-placeholder">2P</div>}</div><div className="product-body"><small>{product.category||'2P Box'}</small><h3>{product.name}</h3>{product.description&&<p>{product.description}</p>}<strong>R$ {Number(product.price).toFixed(2).replace('.',',')}</strong><button disabled={product.stock<=0} onClick={()=>add({id:product.id,name:product.name,price:Number(product.price),stock:product.stock})}><ShoppingCart size={16}/>{product.stock>0?'Adicionar ao carrinho':'Sem estoque'}</button></div></article>}
