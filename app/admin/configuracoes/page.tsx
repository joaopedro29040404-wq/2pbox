'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bike,
  Check,
  Clock3,
  CreditCard,
  Link2,
  MapPin,
  MessageCircle,
  Percent,
  Plus,
  Save,
  ShieldAlert,
  Store,
  Trash2,
  Truck,
  Unlink,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SiteHeader } from '@/components/site-header';
import { AddressAutocomplete, type AddressValue } from '@/components/address-autocomplete';
import { CheckboxField, SelectField, TextField } from '@/components/ui/field';
import { InlineLoader, PageLoader } from '@/components/ui/loader';
import { useToast } from '@/components/ui/toast';
import {
  DEFAULT_PRICE_TABLE,
  PICKUP_MODES,
  SHIPPING_MODES,
  WEEK_DAYS,
  describeHours,
  type DeliveryTier,
} from '@/lib/store-operations';

type Operations = {
  id: string | null;
  name: string;
  whatsapp: string;
  businessDays: string[];
  opensAt: string;
  closesAt: string;
  shippingMode: string;
  pickupMode: string;
  serviceFeePercent: number;
  serviceFeeFixed: number;
  minOrderTotal: number;
  freeShippingFrom: number | null;
  address: AddressValue;
  pickupEnabled: boolean;
  ownDeliveryEnabled: boolean;
  appDeliveryEnabled: boolean;
  subsidyPercent: number;
  maxKm: number;
  priceTable: DeliveryTier[];
  cycleHour: number;
};

type MpStatus = {
  connected: boolean;
  mpUserId: string | null;
  liveMode: boolean;
  expiresAt: string | null;
  connectedAt: string | null;
  commissionPercent: number;
  oauthConfigured: boolean;
};

const SECTIONS = [
  { key: 'front', label: 'Frente', icon: Store },
  { key: 'address', label: 'Endereço', icon: MapPin },
  { key: 'hours', label: 'Horário', icon: Clock3 },
  { key: 'shipping', label: 'Frete e retirada', icon: Truck },
  { key: 'fees', label: 'Taxas', icon: Percent },
  { key: 'delivery', label: 'Entregas', icon: Bike },
  { key: 'integrations', label: 'Integrações', icon: CreditCard },
] as const;

type SectionKey = (typeof SECTIONS)[number]['key'];

const CYCLE_HOURS = Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: `${String(hour).padStart(2, '0')}:00`,
}));

export default function SettingsPage() {
  const [data, setData] = useState<Operations | null>(null);
  const [section, setSection] = useState<SectionKey>('front');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [schemaReady, setSchemaReady] = useState(true);
  const [manualAddress, setManualAddress] = useState(false);
  const [mp, setMp] = useState<MpStatus | null>(null);
  const [mpBusy, setMpBusy] = useState(false);
  const toast = useToast();

  const loadMp = useCallback(async () => {
    const response = await fetch('/api/mercadopago/oauth', { cache: 'no-store' });
    if (!response.ok) return;
    setMp((await response.json()) as MpStatus);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!supabase) {
        if (mounted) setLoading(false);
        return;
      }
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        window.location.href = '/admin/login';
        return;
      }

      const response = await fetch('/api/admin/configuracoes', { cache: 'no-store' });
      if (!mounted) return;
      if (!response.ok) {
        toast.error('Não foi possível carregar as configurações');
        setLoading(false);
        return;
      }

      const payload = await response.json();
      if (!mounted) return;
      setData(payload.operations as Operations);
      setSchemaReady(Boolean(payload.operationsSchema));
      setAllowed(true);
      setLoading(false);
    }

    load().catch((error) => {
      if (!mounted) return;
      toast.error('Não foi possível carregar as configurações', error instanceof Error ? error.message : undefined);
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [toast]);

  useEffect(() => {
    if (!allowed) return;
    void loadMp();

    const params = new URLSearchParams(window.location.search);
    const result = params.get('mp');
    if (!result) return;
    if (result === 'conectado') toast.success('Mercado Pago conectado', 'A loja passa a operar com split de pagamento.');
    else if (result === 'conectado-teste') toast.warning('Conectado em modo de teste', 'Use credenciais de produção para vender de verdade.');
    else toast.error('Não foi possível conectar', params.get('detalhe') || undefined);
    setSection('integrations');
    window.history.replaceState({}, '', '/admin/configuracoes');
  }, [allowed, loadMp, toast]);

  function patch(changes: Partial<Operations>) {
    setData((current) => (current ? { ...current, ...changes } : current));
  }

  function toggleDay(day: string) {
    if (!data) return;
    const active = data.businessDays.includes(day);
    patch({ businessDays: active ? data.businessDays.filter((item) => item !== day) : [...data.businessDays, day] });
  }

  function updateTier(index: number, changes: Partial<DeliveryTier>) {
    if (!data) return;
    patch({ priceTable: data.priceTable.map((tier, position) => (position === index ? { ...tier, ...changes } : tier)) });
  }

  function addTier() {
    if (!data) return;
    const last = data.priceTable[data.priceTable.length - 1];
    patch({ priceTable: [...data.priceTable, { upToKm: last ? last.upToKm + 2 : 2, price: last ? last.price + 5 : 8 }] });
  }

  function removeTier(index: number) {
    if (!data) return;
    patch({ priceTable: data.priceTable.filter((_, position) => position !== index) });
  }

  async function connectMercadoPago() {
    setMpBusy(true);
    try {
      const response = await fetch('/api/mercadopago/oauth', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok || !payload?.url) throw new Error(payload?.error || 'Falha ao iniciar a conexão.');
      window.location.assign(payload.url);
    } catch (error) {
      toast.error('Não foi possível conectar', error instanceof Error ? error.message : undefined);
      setMpBusy(false);
    }
  }

  async function disconnectMercadoPago() {
    if (!confirm('Desconectar a conta Mercado Pago? Os pagamentos deixam de usar split.')) return;
    setMpBusy(true);
    try {
      const response = await fetch('/api/mercadopago/oauth', { method: 'DELETE' });
      if (!response.ok) throw new Error();
      toast.info('Conta desconectada');
      await loadMp();
    } catch {
      toast.error('Não foi possível desconectar');
    } finally {
      setMpBusy(false);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || saving) return;

    setSaving(true);
    setSaved(false);
    try {
      const shippingLabel = SHIPPING_MODES.find((mode) => mode.value === data.shippingMode)?.label || '';
      const pickupLabel = PICKUP_MODES.find((mode) => mode.value === data.pickupMode)?.label || '';
      const response = await fetch('/api/admin/configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, shippingLabel, pickupLabel }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Não foi possível salvar.');

      setData(payload.operations as Operations);
      setSchemaReady(Boolean(payload.operationsSchema));
      setSaved(true);
      if (payload.warning) toast.warning('Salvo parcialmente', payload.warning);
      else toast.success('Configurações publicadas', 'A loja já está usando os novos dados.');
      window.setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      toast.error('Não foi possível salvar', error instanceof Error ? error.message : undefined);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="settings-page">
        <SiteHeader variant="admin" subtitle="CONFIGURAÇÕES" />
        <PageLoader title="Carregando configurações" description="Buscando os dados atuais da loja." />
      </main>
    );
  }

  if (!allowed || !data) {
    return (
      <main className="settings-page">
        <SiteHeader variant="admin" subtitle="CONFIGURAÇÕES" />
        <section className="settings-container settings-section">
          <div className="settings-alert-card">
            <ShieldAlert size={30} />
            <h2>Acesso restrito</h2>
            <p>É necessário estar autenticado para acessar as configurações.</p>
            <Link href="/admin/login" className="settings-primary">
              Entrar no Admin
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const active = SECTIONS.find((item) => item.key === section) || SECTIONS[0];
  const ActiveIcon = active.icon;

  return (
    <main className="settings-page">
      <SiteHeader variant="admin" subtitle="CONFIGURAÇÕES" />
      <section className="settings-container settings-section">
        <div className="settings-heading">
          <div>
            <p className="settings-eyebrow">CONFIGURAÇÕES DA LOJA</p>
            <h1>Configurações</h1>
            <p className="settings-subtitle">Edite os dados que aparecem no site e são usados no checkout. A loja sempre lê a configuração mais recente.</p>
          </div>
          <div className="settings-status">
            <span className={saved ? 'status-dot saved' : 'status-dot'} />
            {saved ? 'Alterações publicadas' : 'Dados da loja'}
          </div>
        </div>

        {!schemaReady && (
          <div className="settings-schema-warning">
            <ShieldAlert size={17} />
            <span>
              As seções de operação exigem a migration <code>20260913_store_operations.sql</code>. Até aplicá-la, apenas
              nome, WhatsApp e os rótulos básicos são gravados.
            </span>
          </div>
        )}

        <nav className="settings-tabs">
          {SECTIONS.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.key} type="button" className={item.key === section ? 'is-active' : ''} onClick={() => setSection(item.key)}>
                <Icon size={15} /> {item.label}
              </button>
            );
          })}
        </nav>

        {section === 'integrations' ? (
          <section className="settings-card mp-card">
            <div className="settings-card-head">
              <div className="settings-card-icon">
                <CreditCard size={22} />
              </div>
              <div>
                <p>INTEGRAÇÕES</p>
                <h2>Mercado Pago</h2>
              </div>
              {mp && (
                <span className={`mp-pill ${mp.connected ? (mp.liveMode ? 'is-live' : 'is-test') : 'is-off'}`}>
                  {mp.connected ? (mp.liveMode ? 'Conectado' : 'Modo de teste') : 'Não conectado'}
                </span>
              )}
            </div>

            <div className="mp-body">
              <p className="mp-copy">
                Conecte a conta Mercado Pago da loja. O dinheiro cai direto na conta do lojista e a plataforma retém
                automaticamente <strong>{mp?.commissionPercent ?? 6}%</strong> de cada venda, sem passar por outra conta.
                Vale para cartão de crédito e PIX.
              </p>

              {mp?.connected ? (
                <>
                  <dl className="mp-data">
                    <div>
                      <dt>Conta Mercado Pago</dt>
                      <dd>{mp.mpUserId || '—'}</dd>
                    </div>
                    <div>
                      <dt>Ambiente</dt>
                      <dd>{mp.liveMode ? 'Produção' : 'Teste'}</dd>
                    </div>
                    <div>
                      <dt>Conectado em</dt>
                      <dd>{mp.connectedAt ? new Date(mp.connectedAt).toLocaleString('pt-BR') : '—'}</dd>
                    </div>
                    <div>
                      <dt>Autorização expira</dt>
                      <dd>{mp.expiresAt ? new Date(mp.expiresAt).toLocaleDateString('pt-BR') : 'Sem prazo informado'}</dd>
                    </div>
                  </dl>
                  <button type="button" className="mp-secondary" onClick={disconnectMercadoPago} disabled={mpBusy}>
                    <Unlink size={16} /> Desconectar conta
                  </button>
                </>
              ) : (
                <>
                  {mp && !mp.oauthConfigured && (
                    <div className="mp-warning">
                      <ShieldAlert size={17} />
                      <span>Faltam as credenciais da aplicação (MERCADOPAGO_APP_ID e MERCADOPAGO_CLIENT_SECRET).</span>
                    </div>
                  )}
                  <button type="button" className="settings-primary" onClick={connectMercadoPago} disabled={mpBusy || !mp?.oauthConfigured}>
                    {mpBusy ? <InlineLoader label="Abrindo o Mercado Pago..." /> : <><Link2 size={17} /> Conectar Mercado Pago</>}
                  </button>
                </>
              )}
            </div>
          </section>
        ) : (
          <form className="settings-card" onSubmit={save}>
            <div className="settings-card-head">
              <div className="settings-card-icon">
                <ActiveIcon size={22} />
              </div>
              <div>
                <p>{active.label.toUpperCase()}</p>
                <h2>{sectionTitle(section)}</h2>
              </div>
            </div>

            {section === 'front' && (
              <div className="settings-grid">
                <TextField label="Nome da loja" placeholder="2P Box" value={data.name} onValueChange={(value) => patch({ name: value })} fullWidth />
                <TextField
                  label={<><MessageCircle size={15} /> WhatsApp</>}
                  mask="phone"
                  inputMode="tel"
                  placeholder="(11) 9 9999-9999"
                  hint="Contato exibido na loja e usado nos e-mails."
                  value={data.whatsapp}
                  onValueChange={(value) => patch({ whatsapp: value })}
                />
                <TextField label="Resumo do atendimento" value={describeHours(data.businessDays, data.opensAt, data.closesAt)} hint="Gerado a partir da aba Horário." readOnly />
              </div>
            )}

            {section === 'address' && (
              <div className="settings-grid">
                <AddressAutocomplete
                  value={data.address}
                  onChange={(address) => patch({ address })}
                  onUnavailable={setManualAddress}
                  hint="O endereço é a origem das rotas e do cálculo de distância das entregas."
                />
                <TextField label="Rua" value={data.address.line} onValueChange={(value) => patch({ address: { ...data.address, line: value } })} readOnly={!manualAddress && Boolean(data.address.placeId)} />
                <TextField label="Número" value={data.address.number} onValueChange={(value) => patch({ address: { ...data.address, number: value } })} />
                <TextField label="Complemento" placeholder="Sala, andar, referência" value={data.address.complement} onValueChange={(value) => patch({ address: { ...data.address, complement: value } })} />
                <TextField label="Bairro" value={data.address.district} onValueChange={(value) => patch({ address: { ...data.address, district: value } })} />
                <TextField label="Cidade" value={data.address.city} onValueChange={(value) => patch({ address: { ...data.address, city: value } })} />
                <TextField label="Estado" mask="state" placeholder="SP" value={data.address.state} onValueChange={(value) => patch({ address: { ...data.address, state: value } })} />
                <TextField label="CEP" mask="cep" inputMode="numeric" value={data.address.zip} onValueChange={(value) => patch({ address: { ...data.address, zip: value } })} />
                <TextField
                  label="Coordenadas"
                  value={data.address.lat != null && data.address.lng != null ? `${data.address.lat}, ${data.address.lng}` : ''}
                  hint="Preenchido ao selecionar o endereço na busca. Sem coordenadas, a entrega própria não calcula distância."
                  readOnly
                />
              </div>
            )}

            {section === 'hours' && (
              <div className="settings-grid">
                <div className="settings-days">
                  <span className="settings-block-label">Dias de atendimento</span>
                  <div className="settings-days-grid">
                    {WEEK_DAYS.map((day) => (
                      <CheckboxField
                        key={day.value}
                        label={day.label}
                        checked={data.businessDays.includes(day.value)}
                        onCheckedChange={() => toggleDay(day.value)}
                      />
                    ))}
                  </div>
                </div>
                <TextField label="Abre às" type="time" value={data.opensAt} onValueChange={(value) => patch({ opensAt: value })} />
                <TextField label="Fecha às" type="time" value={data.closesAt} onValueChange={(value) => patch({ closesAt: value })} />
                <TextField label="Como aparece na loja" value={describeHours(data.businessDays, data.opensAt, data.closesAt)} readOnly fullWidth />
              </div>
            )}

            {section === 'shipping' && (
              <div className="settings-grid">
                <SelectField
                  label={<><Truck size={15} /> Frete</>}
                  value={data.shippingMode}
                  options={SHIPPING_MODES.map((mode) => ({ value: mode.value, label: mode.label }))}
                  onValueChange={(value) => patch({ shippingMode: value })}
                  hint="Define o texto e o fluxo de entrega apresentado no checkout."
                />
                <SelectField
                  label={<><Store size={15} /> Modalidade de retirada</>}
                  value={data.pickupMode}
                  options={PICKUP_MODES.map((mode) => ({ value: mode.value, label: mode.label }))}
                  onValueChange={(value) => patch({ pickupMode: value })}
                />
                <div className="settings-toggles">
                  <span className="settings-block-label">Modalidades oferecidas ao cliente</span>
                  <CheckboxField label="Retirada na loja" description="Sem custo de entrega." checked={data.pickupEnabled} onCheckedChange={(checked) => patch({ pickupEnabled: checked })} />
                  <CheckboxField label="Motoboy da loja" description="Usa a tabela de distância da aba Entregas." checked={data.ownDeliveryEnabled} onCheckedChange={(checked) => patch({ ownDeliveryEnabled: checked })} />
                  <CheckboxField label="Motofrete por aplicativo" description="Valor combinado com o cliente após o pedido." checked={data.appDeliveryEnabled} onCheckedChange={(checked) => patch({ appDeliveryEnabled: checked })} />
                </div>
              </div>
            )}

            {section === 'fees' && (
              <div className="settings-grid">
                <TextField label="Taxa de serviço (%)" type="number" step="0.01" min="0" max="100" value={String(data.serviceFeePercent)} onValueChange={(value) => patch({ serviceFeePercent: Number(value) || 0 })} hint="Aplicada sobre o subtotal do pedido." />
                <TextField label="Taxa fixa (R$)" type="number" step="0.01" min="0" value={String(data.serviceFeeFixed)} onValueChange={(value) => patch({ serviceFeeFixed: Number(value) || 0 })} />
                <TextField label="Pedido mínimo (R$)" type="number" step="0.01" min="0" value={String(data.minOrderTotal)} onValueChange={(value) => patch({ minOrderTotal: Number(value) || 0 })} hint="Zero libera qualquer valor." />
                <TextField label="Frete grátis a partir de (R$)" type="number" step="0.01" min="0" value={data.freeShippingFrom == null ? '' : String(data.freeShippingFrom)} onValueChange={(value) => patch({ freeShippingFrom: value === '' ? null : Number(value) || 0 })} hint="Vazio desativa o frete grátis." />
                <div className="settings-note">
                  A comissão da plataforma ({mp?.commissionPercent ?? 6}%) é retida pelo Mercado Pago no split e não é
                  configurada aqui.
                </div>
              </div>
            )}

            {section === 'delivery' && (
              <div className="settings-grid">
                <TextField label="Subsídio da loja (%)" type="number" step="1" min="0" max="100" value={String(data.subsidyPercent)} onValueChange={(value) => patch({ subsidyPercent: Number(value) || 0 })} hint="Parte do frete que a loja absorve." />
                <TextField label="Raio máximo (km)" type="number" step="0.5" min="0.5" value={String(data.maxKm)} onValueChange={(value) => patch({ maxKm: Number(value) || 0 })} hint="Acima disso a entrega própria não é oferecida." />
                <SelectField
                  label="Virada do ciclo de entregas"
                  value={String(data.cycleHour)}
                  options={CYCLE_HOURS}
                  onValueChange={(value) => patch({ cycleHour: Number(value) })}
                  hint="Pedidos feitos após esse horário entram no ciclo do dia seguinte."
                />

                <div className="tier-block">
                  <div className="tier-head">
                    <span className="settings-block-label">Tabela por distância</span>
                    <button type="button" onClick={addTier}>
                      <Plus size={14} /> Adicionar faixa
                    </button>
                  </div>

                  {data.priceTable.length === 0 ? (
                    <p className="tier-empty">
                      Nenhuma faixa configurada — a loja usa a tabela padrão ({DEFAULT_PRICE_TABLE.map((tier) => `até ${tier.upToKm}km R$ ${tier.price}`).join(' • ')}).
                    </p>
                  ) : (
                    <ul className="tier-list">
                      {data.priceTable.map((tier, index) => {
                        const discount = Math.round(tier.price * (data.subsidyPercent / 100) * 100) / 100;
                        return (
                          <li key={index}>
                            <TextField label="Até (km)" type="number" step="0.5" min="0.5" value={String(tier.upToKm)} onValueChange={(value) => updateTier(index, { upToKm: Number(value) || 0 })} />
                            <TextField label="Valor cheio (R$)" type="number" step="0.01" min="0" value={String(tier.price)} onValueChange={(value) => updateTier(index, { price: Number(value) || 0 })} />
                            <div className="tier-result">
                              <span>Cliente paga</span>
                              <strong>R$ {(tier.price - discount).toFixed(2).replace('.', ',')}</strong>
                              <small>loja absorve R$ {discount.toFixed(2).replace('.', ',')}</small>
                            </div>
                            <button type="button" onClick={() => removeTier(index)} aria-label="Remover faixa">
                              <Trash2 size={15} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}

            <div className="settings-card-foot">
              <div>
                <strong>Publicação</strong>
                <p>Salvar atualiza a configuração usada pela loja imediatamente.</p>
              </div>
              <button className="settings-primary settings-save" type="submit" disabled={saving}>
                {saving ? <InlineLoader label="Salvando..." /> : saved ? <><Check size={18} /> Publicado</> : <><Save size={18} /> Salvar alterações</>}
              </button>
            </div>
          </form>
        )}
      </section>

      <style jsx global>{`
        .settings-page{min-height:100vh;background:#f6f6f3;color:#111;font-family:Inter,Arial,sans-serif}
        .settings-container{width:min(1180px,calc(100% - 40px));margin:0 auto}
        .settings-section{padding:48px 0 80px}
        .settings-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:28px;margin-bottom:30px}
        .settings-heading>div:first-child{min-width:0}
        .settings-eyebrow{margin:0 0 12px;color:#9a7200;font:900 10px Inter,Arial,sans-serif;letter-spacing:.3em}
        .settings-heading h1{margin:0;font-family:'Barlow Condensed',Inter,sans-serif;font-size:66px;line-height:.86;letter-spacing:-.025em;font-style:italic;text-transform:uppercase}
        .settings-subtitle{max-width:700px;margin:16px 0 0;color:#747474;font-size:14px;line-height:1.6}
        .settings-status{display:flex;align-items:center;gap:8px;padding:9px 13px;border:1px solid #e3e3e3;background:#fff;border-radius:999px;white-space:nowrap;font:800 10px Inter,Arial,sans-serif;flex:none}
        .status-dot{width:8px;height:8px;border-radius:50%;background:#bbb}
        .status-dot.saved{background:#2e9954}
        .settings-schema-warning{display:flex;align-items:flex-start;gap:10px;margin-bottom:18px;padding:14px 16px;background:#fff9d9;border:1px solid #f0d65b;border-radius:12px;color:#5c5000;font-size:12.5px;line-height:1.55}
        .settings-schema-warning svg{flex:none;color:#a47700;margin-top:1px}
        .settings-schema-warning code{font:700 11.5px ui-monospace,Menlo,monospace}
        .settings-tabs{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px}
        .settings-tabs button{display:inline-flex;align-items:center;gap:7px;min-height:42px;padding:0 15px;border:1px solid #e0e0da;border-radius:999px;background:#fff;color:#5d5d5d;font:800 11.5px Inter,Arial,sans-serif;cursor:pointer}
        .settings-tabs button:hover{border-color:#111;color:#111}
        .settings-tabs button.is-active{background:#111;border-color:#111;color:#fff}
        .settings-card{border:1px solid #dedede;border-radius:20px;background:#fff;box-shadow:0 16px 45px rgba(0,0,0,.055)}
        .settings-card-head{display:flex;align-items:center;gap:14px;padding:26px 30px;border-bottom:1px solid #ececec}
        .settings-card-icon{width:46px;height:46px;display:grid;place-items:center;background:#ffc400;border-radius:13px;flex:none}
        .settings-card-head p{margin:0 0 4px;color:#9a7200;font:900 9px Inter,Arial,sans-serif;letter-spacing:.2em}
        .settings-card-head h2{margin:0;font-family:'Barlow Condensed',Inter,sans-serif;font-size:31px;line-height:1;text-transform:uppercase}
        .settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:22px;padding:30px}
        .settings-block-label{display:block;margin-bottom:11px;font:800 10px Inter,Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#555}
        .settings-days,.settings-toggles{grid-column:1/-1}
        .settings-days-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
        .settings-toggles{display:grid;gap:13px}
        .settings-note{grid-column:1/-1;padding:13px 15px;background:#fafaf7;border:1px solid #e8e8df;border-radius:10px;color:#5d5d5d;font-size:12px;line-height:1.55}
        .tier-block{grid-column:1/-1}
        .tier-head{display:flex;align-items:center;justify-content:space-between;gap:14px}
        .tier-head button{display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 14px;border:1px solid #dcdcd6;border-radius:9px;background:#fff;font:800 11px Inter,Arial,sans-serif;cursor:pointer}
        .tier-head button:hover{border-color:#111}
        .tier-empty{margin:0;padding:14px 15px;background:#fafaf7;border:1px solid #e8e8df;border-radius:10px;color:#777;font-size:12px;line-height:1.55}
        .tier-list{display:grid;gap:14px;margin:0;padding:0;list-style:none}
        .tier-list li{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1.1fr) 44px;align-items:end;gap:14px;padding:15px;background:#fafaf7;border:1px solid #ecece4;border-radius:12px}
        .tier-result{display:grid;gap:2px;padding-bottom:4px}
        .tier-result span{font:800 9px Inter,Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8a8a86}
        .tier-result strong{font:900 19px 'Barlow Condensed',Inter,sans-serif}
        .tier-result small{color:#8a8a86;font-size:10px}
        .tier-list li>button{display:grid;place-items:center;width:44px;height:44px;border:1px solid #e6d6d6;border-radius:9px;background:#fff;color:#a52626;cursor:pointer}
        .tier-list li>button:hover{background:#fff2f2;border-color:#c62828}
        .settings-card-foot{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:21px 30px;background:#fafafa;border-top:1px solid #ececec;border-radius:0 0 20px 20px}
        .settings-card-foot strong{font-size:12px}
        .settings-card-foot p{margin:4px 0 0;color:#777;font-size:10px}
        .settings-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;padding:0 22px;border:0;border-radius:10px;background:#ffc400;color:#111;text-decoration:none;font:900 12px Inter,Arial,sans-serif;cursor:pointer}
        .settings-primary:disabled{opacity:.7;cursor:wait}
        .settings-save{min-width:190px;flex:none}
        .mp-pill{margin-left:auto;flex:none;padding:8px 12px;border-radius:999px;font:800 10px Inter,Arial,sans-serif;white-space:nowrap}
        .mp-pill.is-live{background:#e9f7ec;color:#27733b}
        .mp-pill.is-test{background:#fff7d6;color:#8a6d00}
        .mp-pill.is-off{background:#f2f2ef;color:#777}
        .mp-body{padding:26px 30px}
        .mp-copy{margin:0 0 20px;color:#5d5d5d;font-size:13.5px;line-height:1.65;max-width:660px}
        .mp-data{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 24px;margin:0 0 22px}
        .mp-data>div{padding:12px 0;border-bottom:1px solid #f1f1ee}
        .mp-data dt{margin:0 0 5px;font:900 9px Inter,Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#999}
        .mp-data dd{margin:0;font:700 13px Inter,Arial,sans-serif;overflow-wrap:anywhere}
        .mp-secondary{display:inline-flex;align-items:center;gap:8px;min-height:46px;padding:0 18px;border:1px solid #dcdcd6;border-radius:10px;background:#fff;color:#111;font:800 12px Inter,Arial,sans-serif;cursor:pointer}
        .mp-secondary:hover:not(:disabled){border-color:#c62828;color:#c62828}
        .mp-secondary:disabled{opacity:.6;cursor:wait}
        .mp-warning{display:flex;align-items:flex-start;gap:10px;margin-bottom:18px;padding:14px 15px;background:#fff9d9;border:1px solid #f0d65b;border-radius:10px;color:#5c5000;font-size:12px;line-height:1.5}
        .mp-warning svg{flex:none;color:#a47700;margin-top:1px}
        @media(max-width:620px){.mp-body{padding:20px 17px}.mp-data{grid-template-columns:1fr}.mp-secondary,.mp-body .settings-primary{width:100%}}
        .settings-alert-card{max-width:520px;margin:60px auto;padding:38px;background:#fff;border:1px solid #e5e5e5;border-radius:20px;text-align:center}
        .settings-alert-card svg{color:#a52626}
        .settings-alert-card h2{margin:13px 0 7px;font-family:'Barlow Condensed',Inter,sans-serif;font-size:36px;text-transform:uppercase}
        .settings-alert-card p{color:#777;font-size:13px;margin:0 0 20px}
        @media(max-width:900px){
          .settings-container{width:min(100% - 28px,760px)}
          .settings-heading{align-items:flex-start;flex-direction:column;gap:16px}
          .settings-heading h1{font-size:54px}
          .settings-status{align-self:flex-start}
          .settings-card-head,.settings-grid,.settings-card-foot{padding-left:20px;padding-right:20px}
          .settings-grid{grid-template-columns:1fr;gap:18px}
          .settings-days-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
          .tier-list li{grid-template-columns:repeat(2,minmax(0,1fr))}
          .tier-list li>button{width:100%}
        }
        @media(max-width:620px){
          .settings-section{padding:32px 0 56px}
          .settings-heading h1{font-size:42px}
          .settings-subtitle{font-size:12px}
          .settings-card{border-radius:16px}
          .settings-card-head h2{font-size:26px}
          .settings-card-foot{align-items:stretch;flex-direction:column;gap:14px}
          .settings-save{width:100%;min-width:0}
          .settings-days-grid{grid-template-columns:1fr}
        }
      `}</style>
    </main>
  );
}

function sectionTitle(section: SectionKey) {
  switch (section) {
    case 'front':
      return 'Frente da loja';
    case 'address':
      return 'Endereço da loja';
    case 'hours':
      return 'Horário de atendimento';
    case 'shipping':
      return 'Frete e retirada';
    case 'fees':
      return 'Taxas do pedido';
    case 'delivery':
      return 'Operação de entregas';
    default:
      return 'Integrações';
  }
}
