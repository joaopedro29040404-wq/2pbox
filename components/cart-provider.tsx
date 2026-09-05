'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type CartItem={
  id:string;
  name:string;
  price:number;
  quantity:number;
  stock:number;
  image_url?:string;
};

type CartContext={
  items:CartItem[];
  add:(p:Omit<CartItem,'quantity'>)=>void;
  remove:(id:string)=>void;
  setQty:(id:string,q:number)=>void;
  clear:()=>void;
  total:number;
};

const C=createContext<CartContext|null>(null);

export function CartProvider({children}:{children:React.ReactNode}){
  const [items,setItems]=useState<CartItem[]>([]);
  useEffect(()=>{
    try{
      const x=localStorage.getItem('2pbox-cart');
      if(x)setItems(JSON.parse(x));
    }catch{}
  },[]);
  useEffect(()=>{
    localStorage.setItem('2pbox-cart',JSON.stringify(items));
  },[items]);
  const value=useMemo(()=>({
    items,
    add:(p:Omit<CartItem,'quantity'>)=>setItems(x=>{
      const e=x.find(i=>i.id===p.id);
      return e
        ? x.map(i=>i.id===p.id?{...i,quantity:Math.min(i.quantity+1,p.stock)}:i)
        : [...x,{...p,quantity:1}];
    }),
    remove:(id:string)=>setItems(x=>x.filter(i=>i.id!==id)),
    setQty:(id:string,q:number)=>setItems(x=>x.map(i=>i.id===id?{...i,quantity:Math.max(1,Math.min(q,i.stock))}:i)),
    clear:()=>setItems([]),
    total:items.reduce((s,i)=>s+i.price*i.quantity,0)
  }),[items]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useCart(){
  const c=useContext(C);
  if(!c)throw new Error('useCart must be used inside CartProvider');
  return c;
}
