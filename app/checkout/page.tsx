'use client';

import {FormEvent,useEffect,useState,Suspense} from 'react';
import Link from 'next/link';
import {ArrowLeft,CheckCircle2,Loader2,UserRound,Store,MessageCircle,FileText,LockKeyhole,ShieldCheck} from 'lucide-react';
import {useSearchParams} from 'next/navigation';
import {useCart} from '@/components/cart-provider';
import {supabase} from '@/lib/supabase';

const WHATSAPP=process.env.NEXT_PUBLIC_WHATSAPP||'5511999999999';
type Delivery='pickup'|'whatsapp_shipping';

function CheckoutForm(){
 const {items,total,clear}=useCart();
 const searchParams=useSearchParams();
 const [name,setName]=useState(''),[phone,setPhone]=useState(''),[email,setEmail]=useState(''),[cpf,setCpf]=useState(''),[password,setPassword]=useState(''),[type,setType]=useState<Delivery>('pickup'),[notes,setNotes]=useState('');
 const [user,setUser]=useState<any>(null),[status,setStatus]=useState(''),[done,setDone]=useState(false),[orderId,setOrderId]=useState('');
 useEffect(()=>{setType(searchParams.get('entrega')==='shipping'?'whatsapp_shipping':'pickup');if(!supabase)return;supabase.auth.getUser().then(({data})=>{if(data.user){setUser(data.user);setEmail(data.user.email||'');setName(data.user.user_metadata?.full_name||'');setPhone(data.user.user_metadata?.phone||'');setCpf(data.user.user_metadata?.cpf||'')}})},[searchParams]);
 async function submit(e:FormEvent){
  e.preventDefault();
  if(!supabase||!items.length)return;
  setStatus('Preparando seu acesso...');
  let currentUser=user;
  if(!currentUser){
   if(!email.trim()){setStatus('Informe seu e-mail para criar sua conta.');return}
   if(password.length<6){setStatus('Crie uma senha com pelo menos 6 caracteres.');return}
   const {data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{data:{full_name:name.trim(),phone:phone.trim(),cpf:cpf.replace(/\D/g,'')||null}}});
   if(error){setStatus(error.message.includes('already')?'Este e-mail já possui uma conta. Entre em /conta antes de finalizar a compra.':error.message);return}
   if(!data.session||!data.user){setStatus('Sua conta foi criada, mas é necessário confirmar o e-mail antes de concluir o pedido.');return}
   currentUser=data.user;setUser(currentUser);
  }else{
   await supabase.auth.updateUser({data:{full_name:name.trim(),phone:phone.trim(),cpf:cpf.replace(/\D/g,'')||null}});
  }
  setStatus('Conferindo estoque e criando pedido...');
  const {data,error}=await supabase.rpc('create_order_with_stock',{p_customer_name:name.trim(),p_customer_phone:phone.trim(),p_customer_email:email.trim()||null,p_delivery_type:type,p_notes:notes.trim()||null,p_items:items.map(i=>({id:i.id,quantity:i.quantity}))});
  if(error){setStatus(error.message.replace(/^.*?: /,''));return}
  const id=data as string;setOrderId(id);clear();setDone(true);
  const list=items.map(i=>`${i.quantity}x ${i.name} — R$ ${(i.price*i.quantity).toFixed(2).replace('.',',')}`).join('\n');
  const msg=`Olá, 2P Box!\n\nPedido: ${id}\nCliente: ${name}\nTelefone: ${phone}\nE-mail: ${email}\n\n${list}\n\nTotal dos produtos: R$ ${total.toFixed(2).replace('.',',')}\nEntrega: ${type==='pickup'?'Retirada na loja':'Calcular frete pelo WhatsApp'}${notes?`\nObservações: ${notes}`:''}`;
  window.setTimeout(()=>{window.location.href=`https://wa.me/${WHATSAPP.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}`},700)
 }
 if(done)return <main><div className="topbar">Pedido recebido • 2P Box</div><section className="container section checkout-success"><div className="category checkout-success-card"><div className="success-icon"><CheckCircle2 size={42}/></div><p className="eyebrow">TUDO CERTO</p><h1 className="checkout-title">Pedido recebido!</h1><p>Seu pedido <strong>{orderId}</strong> foi registrado. Sua conta também está pronta para você acompanhar a compra.</p><div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap',marginTop:18}}><Link href="/conta" className="primary">Minha conta</Link><Link href="/loja" className="secondary">Voltar à loja</Link></div></div></section></main>;
 const deliveryLabel=type==='pickup'?'Retirar na loja':'Calcular frete pelo WhatsApp';
 return <main><div className="topbar">Finalizar pedido <span>•</span> 2P Box</div><header className="header container checkout-header"><Link href="/" className="brand"><img className="brand-logo" src="/logo.pnh.png" alt="2P Box"/><div className="store-brand-copy"><strong>FINALIZAR PEDIDO</strong><small>INFORMAÇÕES PARA O SEU PEDIDO</small></div></Link></header><section className="container section checkout-page"><Link href="/carrinho" className="secondary"><ArrowLeft size={16}/> Voltar ao carrinho</Link><div className="checkout-intro"><p className="eyebrow">ÚLTIMA ETAPA</p><h1 className="checkout-title">Finalizar pedido</h1><p>{user?'Seus dados já estão preenchidos. Confira antes de confirmar.':'Compre sem cadastro prévio: no final da compra criamos sua conta automaticamente.'}</p></div><form onSubmit={submit} className="checkout-form category"><div className="checkout-section"><div className="checkout-section-heading"><UserRound size={20}/><div><h2>Seus dados</h2><p>{user?'Dados da sua conta':'Telefone é obrigatório • CPF é opcional'}</p></div></div><div className="form-grid"><label>Nome completo<input required placeholder="Digite seu nome" value={name} onChange={e=>setName(e.target.value)}/></label><label>WhatsApp / telefone<input required placeholder="(11) 99999-9999" value={phone} onChange={e=>setPhone(e.target.value)}/></label><label>E-mail<input required type="email" placeholder="seuemail@email.com" value={email} onChange={e=>setEmail(e.target.value)} disabled={!!user}/></label><label>CPF <span>(opcional)</span><input inputMode="numeric" placeholder="000.000.000-00" value={cpf} onChange={e=>setCpf(e.target.value)}/></label>{!user&&<label>Crie uma senha<input required type="password" minLength={6} placeholder="Mínimo de 6 caracteres" value={password} onChange={e=>setPassword(e.target.value)}/></label>}</div>{!user&&<div className="account-notice"><ShieldCheck size={18}/><span>Ao concluir, seu e-mail e senha criam automaticamente sua conta 2P Box. Assim você poderá acompanhar pedidos e acessar seus dados nas próximas compras.</span></div>}</div><div className="checkout-section delivery-confirmation"><div className="checkout-section-heading"><Store size={20}/><div><h2>Forma de recebimento</h2><p>Escolhida no carrinho</p></div></div><div className="delivery-confirmed"><div className="delivery-confirmed-icon">{type==='pickup'?<Store size={22}/>:<MessageCircle size={22}/>}</div><div><strong>{deliveryLabel}</strong><span>{type==='pickup'?'Seu pedido ficará disponível para retirada na loja.':'O valor e os detalhes do frete serão combinados pelo WhatsApp.'}</span></div><LockKeyhole size={16}/></div><Link href="/carrinho" className="change-delivery">Voltar ao carrinho para alterar a forma de recebimento</Link></div><div className="checkout-section"><div className="checkout-section-heading"><FileText size={20}/><div><h2>Observações</h2><p>Alguma informação adicional?</p></div></div><textarea placeholder="Escreva uma observação, se necessário..." value={notes} onChange={e=>setNotes(e.target.value)}/></div>{status&&<div className="checkout-status"><Loader2 size={17}/>{status}</div>}<div className="checkout-footer"><div><span>Total dos produtos</span><strong>R$ {total.toFixed(2).replace('.',',')}</strong></div><button className="primary checkout-submit" disabled={!items.length||!!done}>{items.length?'Criar conta e finalizar pedido':'Carrinho vazio'}</button></div></form></section><style jsx global>{`.delivery-confirmed{display:flex;align-items:center;gap:14px;padding:17px;border:1px solid #d9d9d9;border-radius:12px;background:#fafafa;color:#111}.delivery-confirmed-icon{width:42px;height:42px;flex:none;border-radius:9px;background:#ffc400;display:grid;place-items:center}.delivery-confirmed>div:nth-child(2){display:grid;gap:5px;flex:1}.delivery-confirmed strong{font-size:14px}.delivery-confirmed span{font-size:11px;color:#666;line-height:1.4}.delivery-confirmed>svg{color:#888;flex:none}.change-delivery{display:inline-block;margin-top:11px;font-size:11px;color:#777;text-decoration:underline}.change-delivery:hover{color:#111}.account-notice{display:flex;align-items:flex-start;gap:10px;padding:13px 14px;margin-top:16px;background:#fff9d9;border:1px solid #f0d65b;border-radius:9px;color:#5c5000;font-size:11px;line-height:1.5}.account-notice svg{flex:none;color:#a47700;margin-top:1px}`}</style></main>;
}

export default function Checkout(){return <Suspense fallback={<main><div className="topbar">Finalizar pedido • 2P Box</div><section className="container section"><p>Carregando checkout...</p></section></main>}><CheckoutForm/></Suspense>}
