'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { getStoreSettings } from '@/lib/store-settings';
import { toWhatsAppNumber } from '@/lib/masks';

const HIDDEN_PREFIXES = ['/admin', '/checkout/pagamento', '/diagnostico-mercadopago'];

export function WhatsAppFloat() {
  const pathname = usePathname();
  const [number, setNumber] = useState('');

  useEffect(() => {
    let active = true;
    getStoreSettings()
      .then((settings) => {
        if (!active) return;
        const configured = toWhatsAppNumber(settings.whatsapp || '');
        setNumber(configured || toWhatsAppNumber(process.env.NEXT_PUBLIC_STORE_WHATSAPP || ''));
      })
      .catch(() => {
        if (active) setNumber(toWhatsAppNumber(process.env.NEXT_PUBLIC_STORE_WHATSAPP || ''));
      });
    return () => {
      active = false;
    };
  }, []);

  const hidden = HIDDEN_PREFIXES.some((prefix) => pathname?.startsWith(prefix));
  if (hidden || !number) return null;

  const message = encodeURIComponent('Olá! Vim pela loja e gostaria de ajuda.');

  return (
    <>
      <a
        className="wa-float"
        href={`https://wa.me/${number}?text=${message}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar com a loja no WhatsApp"
      >
        <MessageCircle size={24} strokeWidth={2.1} />
        <span>Fale com a loja</span>
      </a>
      <style jsx global>{`
        .wa-float{position:fixed;z-index:120;right:20px;bottom:20px;display:inline-flex;align-items:center;gap:10px;height:56px;padding:0 20px 0 17px;border-radius:28px;background:#25d366;color:#fff;text-decoration:none;font:800 13px Inter,Arial,sans-serif;box-shadow:0 10px 28px rgba(37,211,102,.38);transition:transform .18s ease,box-shadow .18s ease}
        .wa-float:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(37,211,102,.46)}
        .wa-float:focus-visible{outline:3px solid #111;outline-offset:3px}
        .wa-float svg{flex:none}
        @media(max-width:820px){
          .wa-float{right:16px;bottom:16px;width:56px;padding:0;justify-content:center}
          .wa-float span{display:none}
        }
        @media(prefers-reduced-motion:reduce){.wa-float{transition:none}}
        @media print{.wa-float{display:none}}
      `}</style>
    </>
  );
}
