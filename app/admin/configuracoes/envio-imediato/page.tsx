'use client';

import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/toast';
import { InlineLoader, PageLoader } from '@/components/ui/loader';
import { TextField } from '@/components/ui/field';
import type { DeliveryTier } from '@/lib/store-operations';

type Operations = { id: string | null; expressEnabled: boolean; expressPriceTable: DeliveryTier[]; expressMaxKm: number; };

const DEFAULT_EXPRESS_TABLE: DeliveryTier[] = [
  { upToKm: 2, price: 18 },
  { upToKm: 5, price: 22 },
  { upToKm: 10, price: 30 },
  { upToKm: 15, price: 40 },
  { upToKm: 20, price: 50 },
];

export default function ExpressDeliverySettingsPage() {
  const [data, setData] = useState<Operations | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!supabase) return;
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { window.location.href = '/admin/login'; return; }
      const response = await fetch('/api/admin/configuracoes', { cache: 'no-store' });
      if (!response.ok) throw new Error('Não foi possível carregar as configurações.');
      const payload = await response.json();
      if (mounted) {
        const operations = payload.operations;
        setData({
          id: operations.id,
          expressEnabled: Boolean(operations.expressEnabled),
          expressPriceTable: Array.isArray(operations.expressPriceTable) && operations.expressPriceTable.length ? operations.expressPriceTable : DEFAULT_EXPRESS_TABLE,
          expressMaxKm: Number(operations.expressMaxKm) || 20,
        });
        setLoading(false);
      }
    })().catch((error) => { if (mounted) { toast.error('Não foi possível carregar', error instanceof Error ? error.message : undefined); setLoading(false); } });
    return () => { mounted = false; };
  }, [toast]);

  function updateTier(index: number, changes: Partial<DeliveryTier>) {
    setData((current) => current ? { ...current, expressPriceTable: current.expressPriceTable.map((tier, position) => position === index ? { ...tier, ...changes } : tier) } : current);
  }
  function addTier() {
    setData((current) => {
      if (!current) return current;
      const last = current.expressPriceTable[current.expressPriceTable.length - 1];
      return { ...current, expressPriceTable: [...current.expressPriceTable, { upToKm: (last?.upToKm || 0) + 5, price: (last?.price || 0) + 10 }] };
    });
  }
  function removeTier(index: number) {
    setData((current) => current ? { ...current, expressPriceTable: current.expressPriceTable.filter((_, position) => position !== index) } : current);
  }

  async function save() {
    if (!data || saving) return;
    setSaving(true);
    try {
      const response = await fetch('/api/admin/configuracoes', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expressEnabled: data.expressEnabled, expressPriceTable: data.expressPriceTable, expressMaxKm: data.expressMaxKm }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível salvar.');
      toast.success('Configuração publicada', 'O envio imediato agora calcula o frete pela distância.');
    } catch (error) { toast.error('Não foi possível salvar', error instanceof Error ? error.message : undefined); }
    finally { setSaving(false); }
  }

  if (loading || !data) return <PageLoader title="Carregando envio imediato" description="Buscando a configuração atual da loja." />;

  return (
    <main className="express-settings-page">
      <section className="express-settings-shell">
        <div className="express-card">
          <header className="express-head">
            <div className="express-icon"><Zap size={22} /></div>
            <div><p>ENTREGAS</p><h1>Envio imediato</h1><span>Frete calculado pela distância, com tabela independente da entrega no mesmo dia.</span></div>
          </header>

          <div className="express-body">
            <div className="express-grid">
              <div>
                <TextField label="Raio máximo do envio imediato (km)" type="number" step="0.5" min="0.5" value={String(data.expressMaxKm)} onValueChange={(value) => setData((current) => current ? { ...current, expressMaxKm: Number(value) || 0 } : current)} hint="Acima desse limite, o envio imediato não é oferecido." />
              </div>
            </div>

            <div className="express-table-block">
              <div className="express-table-head"><div><strong>Tabela de preços por distância</strong><small>Esta tabela é exclusiva do envio imediato. A tabela do motoboy próprio permanece independente.</small></div><button type="button" onClick={addTier}><Plus size={15} /> Adicionar faixa</button></div>
              <ul>
                {data.expressPriceTable.map((tier, index) => (
                  <li key={index}>
                    <TextField label="Até (km)" type="number" step="0.5" min="0.5" value={String(tier.upToKm)} onValueChange={(value) => updateTier(index, { upToKm: Number(value) || 0 })} />
                    <TextField label="Valor (R$)" type="number" step="0.01" min="0" value={String(tier.price)} onValueChange={(value) => updateTier(index, { price: Number(value) || 0 })} />
                    <button type="button" onClick={() => removeTier(index)} aria-label="Remover faixa"><Trash2 size={16} /></button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <footer><span>Salvar atualiza o cálculo usado no checkout.</span><button type="button" onClick={save} disabled={saving}>{saving ? <InlineLoader label="Salvando..." /> : <><Save size={17} /> Salvar alterações</>}</button></footer>
        </div>
      </section>
      <style jsx>{`
        .express-settings-page{min-height:100vh;background:#f6f6f3;color:#111;font-family:Inter,Arial,sans-serif;padding:48px 20px}.express-settings-shell{width:min(980px,100%);margin:0 auto}.express-card{background:#fff;border:1px solid #dedede;border-radius:20px;box-shadow:0 16px 45px rgba(0,0,0,.055);overflow:hidden}.express-head{display:flex;align-items:center;gap:14px;padding:28px 30px;border-bottom:1px solid #ececec}.express-icon{width:46px;height:46px;display:grid;place-items:center;background:#ffc400;border-radius:13px;flex:none}.express-head p{margin:0 0 4px;color:#9a7200;font:900 9px Inter,Arial,sans-serif;letter-spacing:.2em}.express-head h1{margin:0;font-family:'Barlow Condensed',Inter,sans-serif;font-size:34px;line-height:1;text-transform:uppercase}.express-head span{display:block;margin-top:8px;color:#777;font-size:12px}.express-body{padding:30px}.express-grid{display:grid;grid-template-columns:minmax(0,1fr);gap:20px;margin-bottom:26px}.express-table-block{padding-top:4px}.express-table-head{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin-bottom:16px}.express-table-head strong{display:block;font:900 11px Inter,Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase}.express-table-head small{display:block;margin-top:5px;color:#777;font-size:11px}.express-table-head button{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 14px;border:1px solid #dcdcd6;border-radius:9px;background:#fff;font:800 11px Inter,Arial,sans-serif;cursor:pointer;white-space:nowrap}.express-table-block ul{display:grid;gap:12px;margin:0;padding:0;list-style:none}.express-table-block li{display:grid;grid-template-columns:1fr 1fr 44px;align-items:end;gap:14px;padding:15px;background:#fafaf7;border:1px solid #ecece4;border-radius:12px}.express-table-block li>button{display:grid;place-items:center;width:44px;height:44px;border:1px solid #e6d6d6;border-radius:9px;background:#fff;color:#a52626;cursor:pointer}.express-card footer{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:20px 30px;background:#fafafa;border-top:1px solid #ececec}.express-card footer span{color:#777;font-size:10px}.express-card footer button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 22px;border:0;border-radius:10px;background:#ffc400;color:#111;font:900 12px Inter,Arial,sans-serif;cursor:pointer}.express-card footer button:disabled{opacity:.7;cursor:wait}@media(max-width:620px){.express-settings-page{padding:24px 12px}.express-head,.express-body,.express-card footer{padding-left:18px;padding-right:18px}.express-head{align-items:flex-start}.express-head h1{font-size:28px}.express-table-head{align-items:stretch;flex-direction:column}.express-table-head button{width:100%;justify-content:center}.express-table-block li{grid-template-columns:1fr 1fr}.express-table-block li>button{width:100%}.express-card footer{align-items:stretch;flex-direction:column}.express-card footer button{width:100%}}
      `}</style>
    </main>
  );
}
