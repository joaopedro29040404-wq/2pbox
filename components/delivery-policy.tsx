'use client';

import { useEffect, useState } from 'react';
import { Bike, MapPin, Store, Truck } from 'lucide-react';

type Option = { provider: string; label: string; description: string; fee: number | null; needsAddress: boolean };
type Info = { sameDay: { enabled: boolean; cutoff: string }; address: string; options: Option[] };

const ICONS: Record<string, React.ReactNode> = {
  pickup: <Store size={16} />,
  own: <Bike size={16} />,
  express: <Truck size={16} />,
  app: <Bike size={16} />,
};

export function DeliveryPolicy() {
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/entrega/cotacao', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (active) setInfo(data as Info);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  if (!info) return null;

  const pickup = info.options.find((option) => option.provider === 'pickup');
  const deliveries = info.options.filter((option) => option.provider !== 'pickup');
  if (!info.sameDay.enabled && !deliveries.length && !pickup) return null;

  return (
    <section className="delivery-policy" aria-label="Política de entrega">
      {info.sameDay.enabled && (
        <div className="policy-highlight">
          <Bike size={19} />
          <div>
            <strong>Entrega no mesmo dia</strong>
            <span>Pedidos feitos até {info.sameDay.cutoff} são entregues no mesmo dia.</span>
          </div>
        </div>
      )}

      {deliveries.length > 0 && (
        <ul className="policy-list">
          {deliveries.map((option) => (
            <li key={option.provider}>
              {ICONS[option.provider] || <Truck size={16} />}
              <span>
                <strong>{option.label}</strong>
                {option.fee != null && option.fee > 0
                  ? ` · frete a partir de ${money(option.fee)}`
                  : ' · frete calculado pelo endereço no checkout'}
              </span>
            </li>
          ))}
        </ul>
      )}

      {pickup && info.address && (
        <div className="policy-pickup">
          <MapPin size={16} />
          <span>
            <strong>Retirar na loja</strong>
            <small>{info.address}</small>
          </span>
        </div>
      )}

      <style jsx>{`
        .delivery-policy{display:grid;gap:11px;margin:0 0 26px;padding:16px;background:#fafaf7;border:1px solid #ecece4;border-radius:12px}
        .policy-highlight{display:flex;align-items:flex-start;gap:11px;padding:12px 13px;background:#fff7d6;border:1px solid #f0d65b;border-radius:10px}
        .policy-highlight svg{flex:none;margin-top:1px;color:#8a6d00}
        .policy-highlight div{display:grid;gap:3px}
        .policy-highlight strong{font:800 12.5px Inter,Arial,sans-serif;color:#5c5000}
        .policy-highlight span{font-size:11.5px;line-height:1.5;color:#8a6d00}
        .policy-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}
        .policy-list li{display:flex;align-items:flex-start;gap:9px;font-size:11.5px;line-height:1.5;color:#5d5d5d}
        .policy-list svg{flex:none;margin-top:1px;color:#8a8a86}
        .policy-list strong{font-weight:800;color:#111}
        .policy-pickup{display:flex;align-items:flex-start;gap:9px;padding-top:10px;border-top:1px solid #ecece4}
        .policy-pickup svg{flex:none;margin-top:2px;color:#a58a2e}
        .policy-pickup span{display:grid;gap:3px}
        .policy-pickup strong{font:800 11.5px Inter,Arial,sans-serif}
        .policy-pickup small{font-size:11px;line-height:1.5;color:#8a8a86}
      `}</style>
    </section>
  );
}

function money(value: number) {
  return `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;
}
