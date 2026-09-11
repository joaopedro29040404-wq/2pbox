'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Bike,
  QrCode,
  CheckCircle2,
  CreditCard,
  FileText,
  LockKeyhole,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Store,
  UserRound,
} from 'lucide-react';
import { useCart } from '@/components/cart-provider';
import { supabase } from '@/lib/supabase';
import { getStoreSettings } from '@/lib/store-settings';
import PaymentBrick from '@/components/payment-brick';
import PixPayment from '@/components/pix-payment';
import { SiteHeader } from '@/components/site-header';
import { RadioGroup, TextAreaField, TextField } from '@/components/ui/field';
import { AddressAutocomplete, type AddressValue } from '@/components/address-autocomplete';
import { InlineLoader, PageLoader } from '@/components/ui/loader';
import { useToast } from '@/components/ui/toast';
import { isValidCep, isValidCpf, isValidEmail, isValidPhone, onlyDigits, toWhatsAppNumber } from '@/lib/masks';
import { money } from '@/lib/order-format';

type Delivery = 'pickup' | 'whatsapp_shipping';
type DeliveryOption = { provider: 'pickup' | 'own' | 'app'; label: string; description: string; fee: number | null; distanceKm: number | null; available: boolean };

const EMPTY_ADDRESS: AddressValue = { line: '', number: '', complement: '', district: '', city: '', state: '', zip: '', placeId: null, lat: null, lng: null };
type AuthUser = { id: string; email?: string | null; user_metadata?: { full_name?: string; phone?: string; cpf?: string } };
type Errors = Record<string, string>;

function CheckoutForm() {
  const { items, total, clear } = useCart();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [type, setType] = useState<Delivery>('pickup');
  const [notes, setNotes] = useState('');
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('');
  const [done, setDone] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [accessSent, setAccessSent] = useState(false);
  const [storeWhatsApp, setStoreWhatsApp] = useState('5511999999999');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'pix'>('card');
  const [lookingUpCep, setLookingUpCep] = useState(false);
  const [geoAddress, setGeoAddress] = useState<AddressValue>(EMPTY_ADDRESS);
  const [options, setOptions] = useState<DeliveryOption[]>([]);
  const [provider, setProvider] = useState<'whatsapp' | 'own' | 'app'>('whatsapp');
  const [quoting, setQuoting] = useState(false);
  const [payableTotal, setPayableTotal] = useState<number | null>(null);
  const [feeBreakdown, setFeeBreakdown] = useState<{ fee: number; serviceFee: number; subtotal: number } | null>(null);
  const [paymentsOnline, setPaymentsOnline] = useState(true);
  const [mpPublicKey, setMpPublicKey] = useState('');
  const [mpMethods, setMpMethods] = useState({ card: true, pix: true });
  const lastPaymentError = useRef({ message: '', at: 0 });

  useEffect(() => {
    setType(searchParams.get('entrega') === 'shipping' ? 'whatsapp_shipping' : 'pickup');
    const client = supabase;
    if (!client) return;

    fetch('/api/mercadopago/disponibilidade', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        setPaymentsOnline(data?.available !== false);
        setMpPublicKey(String(data?.publicKey || ''));
        if (data?.methods) {
          const methods = { card: data.methods.card !== false, pix: data.methods.pix === true };
          setMpMethods(methods);
          setPaymentMethod(methods.card ? 'card' : 'pix');
        }
      })
      .catch(() => setPaymentsOnline(true));

    Promise.all([client.auth.getUser(), getStoreSettings()]).then(([authResult, settings]) => {
      const currentUser = authResult.data.user as AuthUser | null;
      if (currentUser) {
        setUser(currentUser);
        setEmail(currentUser.email || '');
        setName(currentUser.user_metadata?.full_name || '');
        setPhone(currentUser.user_metadata?.phone || '');
        setCpf(currentUser.user_metadata?.cpf || '');
      }
      if (settings.whatsapp?.trim()) setStoreWhatsApp(settings.whatsapp.trim());
    });
  }, [searchParams]);

  useEffect(() => {
    if (type !== 'whatsapp_shipping') return;
    if (geoAddress.lat == null && !geoAddress.placeId) {
      setOptions([]);
      return;
    }

    let active = true;
    setQuoting(true);
    fetch('/api/entrega/cotacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placeId: geoAddress.placeId, lat: geoAddress.lat, lng: geoAddress.lng }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        const list = (Array.isArray(data?.options) ? data.options : []).filter((option: DeliveryOption) => option.provider !== 'pickup');
        setOptions(list);
        const first = list.find((option: DeliveryOption) => option.available);
        setProvider(first ? first.provider : 'whatsapp');
      })
      .catch(() => {
        if (active) setOptions([]);
      })
      .finally(() => {
        if (active) setQuoting(false);
      });

    return () => {
      active = false;
    };
  }, [type, geoAddress.placeId, geoAddress.lat, geoAddress.lng]);

  async function lookupCep(value: string) {
    const digits = onlyDigits(value);
    if (digits.length !== 8) return;
    setLookingUpCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await response.json();
      if (data?.erro) {
        setErrors((current) => ({ ...current, cep: 'CEP não encontrado.' }));
        return;
      }
      setErrors((current) => ({ ...current, cep: '' }));
      setStreet((current) => data.logradouro || current);
      setNeighborhood((current) => data.bairro || current);
      setCity((current) => data.localidade || current);
      setState((current) => data.uf || current);
    } catch {
    } finally {
      setLookingUpCep(false);
    }
  }

  function reportPaymentError(message: string) {
    const now = Date.now();
    if (lastPaymentError.current.message === message && now - lastPaymentError.current.at < 8000) return;
    lastPaymentError.current = { message, at: now };

    const whatsapp = toWhatsAppNumber(storeWhatsApp);
    toast.error(
      'Não foi possível concluir o pagamento',
      whatsapp ? `${message} Seu pedido está salvo. Fale com a gente no WhatsApp para finalizar.` : message,
    );
  }

  function applyGeoAddress(value: AddressValue) {
    setGeoAddress(value);
    if (value.line) setStreet(value.line);
    if (value.number) setNumber(value.number);
    if (value.district) setNeighborhood(value.district);
    if (value.city) setCity(value.city);
    if (value.state) setState(value.state);
    if (value.zip) setCep(value.zip);
  }

  function validate(): boolean {
    const next: Errors = {};
    if (!name.trim() || name.trim().split(/\s+/).length < 2) next.name = 'Informe seu nome completo.';
    if (!isValidPhone(phone)) next.phone = 'Informe um telefone válido com DDD.';
    if (!isValidEmail(email)) next.email = 'Informe um e-mail válido.';
    if (cpf.trim() && !isValidCpf(cpf)) next.cpf = 'CPF inválido.';

    if (type === 'whatsapp_shipping') {
      if (!isValidCep(cep)) next.cep = 'Informe um CEP válido.';
      if (!street.trim()) next.street = 'Informe a rua.';
      if (!number.trim()) next.number = 'Informe o número.';
      if (!neighborhood.trim()) next.neighborhood = 'Informe o bairro.';
      if (!city.trim()) next.city = 'Informe a cidade.';
      if (state.trim().length !== 2) next.state = 'UF inválida.';
    }

    setErrors(next);
    if (Object.keys(next).length) {
      toast.warning('Revise os dados do pedido', 'Alguns campos precisam de correção.');
      return false;
    }
    return true;
  }

  async function submitCheckout() {
    const client = supabase;
    if (!client || !items.length || submitting) return;
    if (!validate()) return;

    setSubmitting(true);
    setStatus('Registrando seu pedido...');

    try {
      if (user) {
        const { error } = await client.auth.updateUser({
          data: { full_name: name.trim(), phone: phone.trim(), cpf: onlyDigits(cpf) || null },
        });
        if (error) throw new Error(error.message);
      }

      const address =
        type === 'whatsapp_shipping'
          ? {
              postal_code: cep.trim(),
              street: street.trim(),
              number: number.trim(),
              complement: complement.trim(),
              neighborhood: neighborhood.trim(),
              city: city.trim(),
              state: state.trim(),
              recipient_name: name.trim(),
              phone: phone.trim(),
            }
          : null;

      const deliveryType = type === 'pickup' ? 'pickup' : provider === 'own' ? 'own_delivery' : provider === 'app' ? 'app_delivery' : 'whatsapp_shipping';
      const args = {
        p_customer_name: name.trim(),
        p_customer_phone: phone.trim(),
        p_customer_email: email.trim(),
        p_notes: notes.trim() || null,
        p_items: items.map((item) => ({ id: item.id, quantity: item.quantity })),
        p_delivery_address: address,
      };

      let result = await client.rpc('create_order_with_stock_v3', { ...args, p_delivery_type: deliveryType });
      if (result.error && /create_order_with_stock_v3|schema cache|not find/i.test(result.error.message)) {
        result = await client.rpc('create_order_with_stock_v2', { ...args, p_delivery_type: type });
      }
      if (result.error) throw new Error(result.error.message.replace(/^.*?: /, ''));

      const id = result.data as string;
      setOrderId(id);
      const cleanCpf = onlyDigits(cpf);
      const normalizedEmail = email.trim().toLowerCase();

      try {
        localStorage.setItem('2p_guest_order_email', normalizedEmail);
        localStorage.setItem('2p_last_order_id', id);
        localStorage.setItem('2p_checkout_name', name.trim());
        localStorage.setItem('2p_checkout_cpf', cleanCpf);
      } catch {}

      if (!user) {
        const { error: otpError } = await client.auth.signInWithOtp({
          email: normalizedEmail,
          options: { emailRedirectTo: `${window.location.origin}/conta`, shouldCreateUser: true },
        });
        setAccessSent(!otpError);
        if (!otpError) {
          fetch('/api/conta/notificar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'account_created', email: normalizedEmail, name: name.trim() }),
          }).catch(() => undefined);
        }
      }

      if ((type === 'pickup' || provider === 'own') && !paymentsOnline) {
        setStatus('');
        toast.warning(
          'Pedido registrado, falta combinar o pagamento',
          'O pagamento online ainda não está disponível nesta loja. Fale com a gente no WhatsApp para concluir a compra.',
        );
        return;
      }

      if (type === 'pickup' || provider === 'own') {
        const isOwnDelivery = provider === 'own' && type !== 'pickup';
        setStatus(isOwnDelivery ? 'Calculando a entrega...' : 'Confirmando o valor...');

        const quote = await fetch('/api/pedido/entrega', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: id,
            provider: isOwnDelivery ? 'own' : 'pickup',
            email: normalizedEmail,
            ...(isOwnDelivery ? { placeId: geoAddress.placeId, lat: geoAddress.lat, lng: geoAddress.lng, address } : {}),
          }),
        });
        const quoteData = await quote.json().catch(() => null);
        if (!quote.ok) {
          if (isOwnDelivery) throw new Error(quoteData?.error || 'Não foi possível calcular a entrega.');
          console.error('[checkout] cotação de retirada falhou:', quoteData?.error);
        } else {
          setPayableTotal(Number(quoteData.total));
          setFeeBreakdown({ fee: Number(quoteData.fee || 0), serviceFee: Number(quoteData.serviceFee || 0), subtotal: Number(quoteData.subtotal || 0) });
          if (quoteData.warning && isOwnDelivery) toast.warning('Entrega registrada parcialmente', quoteData.warning);
        }

        setStatus('');
        return;
      }

      const list = items.map((item) => `${item.quantity}x ${item.name}: ${money(item.price * item.quantity)}`).join('\n');
      const addressText = address
        ? `\n\nENDEREÇO PARA FRETE\n${address.street}, ${address.number}${address.complement ? `, ${address.complement}` : ''}\n${address.neighborhood}, ${address.city}/${address.state}\nCEP: ${address.postal_code}`
        : '';
      const message = `Olá, 2P Box!\n\nQuero calcular o frete para o pedido ${id}.\n\nCliente: ${name}\nTelefone: ${phone}\nE-mail: ${email}\n\n${list}\n\nTotal dos produtos: ${money(total)}\nForma de recebimento: Entrega com cálculo de frete pelo WhatsApp${addressText}${notes ? `\n\nObservações: ${notes}` : ''}`;

      clear({ silent: true });
      setDone(true);
      window.setTimeout(() => {
        window.location.href = `https://wa.me/${toWhatsAppNumber(storeWhatsApp)}?text=${encodeURIComponent(message)}`;
      }, 700);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Não foi possível concluir o pedido.';
      setStatus(detail);
      toast.error('Não foi possível concluir o pedido', detail);
    } finally {
      setSubmitting(false);
    }
  }

  const payableOnline = (type === 'pickup' || provider === 'own') && paymentsOnline;
  const awaitingContact = (type === 'pickup' || provider === 'own') && !paymentsOnline && Boolean(orderId);
  const paymentReady = payableOnline && Boolean(orderId);
  const chargeTotal = payableTotal ?? total;

  if (done) {
    return (
      <main className="checkout-shell">
        <SiteHeader subtitle="PEDIDO RECEBIDO" showCart={false} />
        <section className="container section checkout-success">
          <div className="checkout-success-card">
            <div className="success-icon">
              <CheckCircle2 size={42} />
            </div>
            <p className="eyebrow">TUDO CERTO</p>
            <h1 className="checkout-title">Pedido recebido!</h1>
            <p>
              Seu pedido <strong>#{orderId.slice(0, 8).toUpperCase()}</strong> foi registrado. O WhatsApp será aberto para calcular o frete.
            </p>
            {!user && (
              <div className="guest-access-note">
                <ShieldCheck size={18} />
                <div>
                  <strong>Seu acesso à 2P Box</strong>
                  <span>
                    {accessSent
                      ? 'Enviamos um link de acesso para o seu e-mail. Abra o e-mail para entrar na sua conta sem precisar criar senha agora.'
                      : 'Seu pedido foi concluído. Você poderá acompanhar pelo e-mail informado.'}
                  </span>
                </div>
              </div>
            )}
            <div className="success-actions">
              <Link href={`/pedido/${encodeURIComponent(orderId)}`} className="primary">
                Acompanhar pedido
              </Link>
              <Link href="/loja" className="secondary">
                Voltar à loja
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="checkout-shell">
      <SiteHeader subtitle="FINALIZAR PEDIDO" />
      <section className="container section checkout-page">
        <Link href="/carrinho" className="checkout-back">
          <ArrowLeft size={16} /> Voltar ao carrinho
        </Link>

        <div className="checkout-intro">
          <p className="eyebrow">ÚLTIMA ETAPA</p>
          <h1 className="checkout-title">Finalizar pedido</h1>
          <p>{user ? 'Seus dados já estão preenchidos. Confira antes de confirmar.' : 'Compre sem cadastro e sem criar senha. Informe apenas seus dados para concluir o pedido.'}</p>
        </div>

        <div className="checkout-form">
          <div className="checkout-section">
            <div className="checkout-section-heading">
              <UserRound size={20} />
              <div>
                <h2>Seus dados</h2>
                <p>{user ? 'Dados da sua conta' : 'Usados para identificar e confirmar seu pedido'}</p>
              </div>
            </div>
            <div className="form-grid">
              <TextField label="Nome completo" required placeholder="Digite seu nome" value={name} error={errors.name} onValueChange={setName} />
              <TextField
                label="WhatsApp / telefone"
                required
                mask="phone"
                inputMode="tel"
                placeholder="(11) 99999-9999"
                value={phone}
                error={errors.phone}
                icon={<Phone size={16} />}
                onValueChange={setPhone}
              />
              <TextField
                label="E-mail"
                required
                type="email"
                mask="email"
                placeholder="seuemail@email.com"
                value={email}
                error={errors.email}
                icon={<Mail size={16} />}
                disabled={Boolean(user)}
                onValueChange={setEmail}
              />
              <TextField
                label="CPF"
                optional
                mask="cpf"
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={cpf}
                error={errors.cpf}
                hint="Ajuda o Mercado Pago a aprovar o pagamento."
                onValueChange={setCpf}
              />
            </div>
            {!user && (
              <div className="account-notice">
                <ShieldCheck size={18} />
                <span>Você não precisa criar senha para comprar. Depois do pedido, enviaremos um link de acesso ao seu e-mail para entrar na sua conta com segurança.</span>
              </div>
            )}
          </div>

          <div className="checkout-section">
            <div className="checkout-section-heading">
              <Store size={20} />
              <div>
                <h2>Forma de recebimento</h2>
                <p>Escolhida no carrinho</p>
              </div>
            </div>
            <div className="delivery-confirmed">
              <div className="delivery-confirmed-icon">{type === 'pickup' ? <Store size={22} /> : <MessageCircle size={22} />}</div>
              <div>
                <strong>{type === 'pickup' ? 'Retirada na loja' : 'Calcular frete pelo WhatsApp'}</strong>
                <span>
                  {type === 'pickup'
                    ? 'Sem endereço e sem frete. Você concluirá o pagamento pelo Mercado Pago.'
                    : 'O endereço só é solicitado para calcular o frete e será enviado junto com o pedido pelo WhatsApp.'}
                </span>
              </div>
              <LockKeyhole size={16} />
            </div>
            <Link href="/carrinho" className="change-delivery">
              Voltar ao carrinho para alterar a forma de recebimento
            </Link>
          </div>

          {type === 'whatsapp_shipping' && (
            <div className="checkout-section">
              <div className="checkout-section-heading">
                <MapPin size={20} />
                <div>
                  <h2>Endereço para o frete</h2>
                  <p>Preencha para enviarmos ao WhatsApp e calcularmos o valor da entrega.</p>
                </div>
              </div>
              <div className="form-grid">
                <AddressAutocomplete
                  label="Buscar endereço"
                  hint="Selecionar o endereço na busca libera o cálculo automático da entrega."
                  value={geoAddress}
                  onChange={applyGeoAddress}
                />
                <TextField
                  label="CEP"
                  required
                  mask="cep"
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={cep}
                  error={errors.cep}
                  hint="Preenchemos o resto automaticamente."
                  icon={lookingUpCep ? <InlineLoader /> : undefined}
                  onValueChange={(value) => {
                    setCep(value);
                    void lookupCep(value);
                  }}
                />
                <TextField label="Rua / avenida" required placeholder="Nome da rua" value={street} error={errors.street} onValueChange={setStreet} />
                <TextField label="Número" required placeholder="123" value={number} error={errors.number} onValueChange={setNumber} />
                <TextField label="Complemento" optional placeholder="Apto, bloco..." value={complement} onValueChange={setComplement} />
                <TextField label="Bairro" required placeholder="Seu bairro" value={neighborhood} error={errors.neighborhood} onValueChange={setNeighborhood} />
                <TextField label="Cidade" required placeholder="Sua cidade" value={city} error={errors.city} onValueChange={setCity} />
                <TextField label="Estado" required mask="state" maxLength={2} placeholder="SP" value={state} error={errors.state} onValueChange={setState} />
              </div>
              {(quoting || options.length > 0) && (
                <div className="delivery-options">
                  {quoting ? (
                    <InlineLoader label="Calculando as opções de entrega..." />
                  ) : (
                    <RadioGroup
                      name="delivery-provider"
                      label="Como você quer receber"
                      value={provider}
                      options={options
                        .filter((option) => option.available)
                        .map((option) => ({
                          value: String(option.provider),
                          label: option.label,
                          description: option.fee != null && option.fee > 0 ? `${option.description} • ${money(option.fee)}` : option.fee === 0 ? `${option.description} • grátis` : option.description,
                          icon: option.provider === 'own' ? <Bike size={19} /> : <MessageCircle size={19} />,
                        }))
                        .concat([{ value: 'whatsapp', label: 'Combinar pelo WhatsApp', description: 'A loja informa o valor do frete no atendimento', icon: <MessageCircle size={19} /> }])}
                      onValueChange={(value) => setProvider(value as 'whatsapp' | 'own' | 'app')}
                      fullWidth
                    />
                  )}

                  {options.some((option) => !option.available) && (
                    <ul className="delivery-unavailable">
                      {options
                        .filter((option) => !option.available)
                        .map((option) => (
                          <li key={option.provider}>
                            {option.label}: {option.description}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}

              {provider === 'own' ? (
                <div className="shipping-whatsapp-note">
                  <Bike size={17} />
                  <span>
                    O frete já está calculado pela distância até a loja. Você <strong>paga tudo aqui</strong>, produtos e
                    entrega, e o motoboy sai no ciclo de entregas.
                  </span>
                </div>
              ) : (
                <div className="shipping-whatsapp-note">
                  <MessageCircle size={17} />
                  <span>
                    Ao clicar no botão abaixo, enviaremos <strong>o pedido completo + endereço</strong> para a 2P Box no WhatsApp, já identificado como pedido de cálculo de frete.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="checkout-section">
            <div className="checkout-section-heading">
              <FileText size={20} />
              <div>
                <h2>Observações</h2>
                <p>Alguma informação adicional?</p>
              </div>
            </div>
            <TextAreaField placeholder="Escreva uma observação, se necessário..." value={notes} onValueChange={setNotes} fullWidth />
          </div>

          {awaitingContact && (
            <div className="checkout-section contact-section">
              <div className="checkout-section-heading">
                <MessageCircle size={20} />
                <div>
                  <h2>Pedido registrado</h2>
                  <p>Falta combinar o pagamento com a loja</p>
                </div>
              </div>

              <p className="contact-copy">
                O pagamento online ainda não está disponível nesta loja. Seu pedido{' '}
                <strong>#{orderId.slice(0, 8).toUpperCase()}</strong> já está salvo e reservado. É só chamar a gente no
                WhatsApp para combinar a forma de pagamento.
              </p>

              {toWhatsAppNumber(storeWhatsApp) && (
                <a
                  className="primary contact-button"
                  href={`https://wa.me/${toWhatsAppNumber(storeWhatsApp)}?text=${encodeURIComponent(`Olá, 2P Box! Quero combinar o pagamento do pedido ${orderId}.`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle size={17} /> Falar no WhatsApp
                </a>
              )}
            </div>
          )}

          {paymentReady && feeBreakdown && (
            <div className="checkout-charge">
              <div>
                <span>Produtos</span>
                <strong>{money(feeBreakdown.subtotal)}</strong>
              </div>
              {feeBreakdown.fee > 0 && (
                <div>
                  <span>Entrega</span>
                  <strong>{money(feeBreakdown.fee)}</strong>
                </div>
              )}
              {feeBreakdown.serviceFee > 0 && (
                <div>
                  <span>Taxa de serviço</span>
                  <strong>{money(feeBreakdown.serviceFee)}</strong>
                </div>
              )}
              <div className="checkout-charge-total">
                <span>Total a pagar</span>
                <strong>{money(chargeTotal)}</strong>
              </div>
            </div>
          )}

          {paymentReady && (
            <div className="checkout-section payment-section">
              <div className="checkout-section-heading">
                <CreditCard size={20} />
                <div>
                  <h2>Pagamento seguro</h2>
                  <p>Escolha como pagar pelo Mercado Pago</p>
                </div>
              </div>

              <RadioGroup
                name="payment-method"
                label="Forma de pagamento"
                value={paymentMethod}
                columns={2}
                options={[
                  ...(mpMethods.card ? [{ value: 'card', label: 'Cartão de crédito', description: 'Aprovação imediata', icon: <CreditCard size={19} /> }] : []),
                  ...(mpMethods.pix ? [{ value: 'pix', label: 'PIX', description: 'Confirmação em segundos', icon: <QrCode size={19} /> }] : []),
                ]}
                onValueChange={(value) => setPaymentMethod(value as 'card' | 'pix')}
                fullWidth
              />

              <div className="payment-method-body">
                {paymentMethod === 'card' ? (
                  <PaymentBrick
                    amount={chargeTotal}
                    publicKey={mpPublicKey}
                    orderId={orderId}
                    email={email}
                    cpf={cpf}
                    onResult={() => clear({ silent: true })}
                    onError={reportPaymentError}
                  />
                ) : (
                  <PixPayment
                    amount={chargeTotal}
                    orderId={orderId}
                    email={email}
                    cpf={cpf}
                    name={name}
                    onApproved={() => {
                      clear({ silent: true });
                      window.location.assign(`/pagamento/${encodeURIComponent(orderId)}`);
                    }}
                    onError={reportPaymentError}
                  />
                )}
              </div>
            </div>
          )}

          {!paymentReady && status && (
            <div className="checkout-status">
              <InlineLoader label={status} />
            </div>
          )}

          {!paymentReady && (
            <div className="checkout-footer">
              <div>
                <span>Total dos produtos</span>
                <strong>{money(total)}</strong>
              </div>
              <button type="button" onClick={submitCheckout} className="primary checkout-submit" disabled={!items.length || submitting}>
                {submitting ? 'Processando...' : !items.length ? 'Carrinho vazio' : type === 'pickup' || provider === 'own' ? 'Continuar para pagamento' : 'Calcular frete pelo WhatsApp'}
              </button>
            </div>
          )}
        </div>
      </section>

      <style jsx global>{`
        .checkout-shell{background:#fff;color:#111;min-height:100vh}
        .checkout-page{max-width:900px}
        .checkout-back{display:inline-flex;align-items:center;gap:7px;color:#666;text-decoration:none;font:800 11px Inter,Arial,sans-serif}
        .checkout-intro{margin:26px 0 24px}
        .checkout-title{font-family:'Barlow Condensed';font-size:56px;text-transform:uppercase;font-style:italic;line-height:.95;margin:0 0 12px}
        .checkout-intro>p:last-child{color:#686868;margin:0;font-size:15px}
        .checkout-form{border:1px solid #e9e9e9;border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 8px 28px rgba(0,0,0,.04)}
        .checkout-section{padding:28px;border-bottom:1px solid #e9e9e9}
        .checkout-section:last-of-type{border-bottom:0}
        .checkout-section-heading{display:flex;gap:13px;align-items:flex-start;margin-bottom:22px}
        .checkout-section-heading>svg{flex:none;color:#111;margin-top:2px}
        .checkout-section-heading h2{font-family:'Barlow Condensed';font-size:27px;text-transform:uppercase;margin:0 0 4px}
        .checkout-section-heading p{font-size:12px;color:#686868;margin:0}
        .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
        .delivery-confirmed{display:flex;align-items:center;gap:14px;padding:17px;border:1px solid #d9d9d9;border-radius:12px;background:#fafafa;color:#111}
        .delivery-confirmed-icon{width:42px;height:42px;flex:none;border-radius:9px;background:#ffc400;display:grid;place-items:center}
        .delivery-confirmed>div:nth-child(2){display:grid;gap:5px;flex:1}
        .delivery-confirmed strong{font-size:14px}
        .delivery-confirmed span{font-size:11px;color:#666;line-height:1.4}
        .delivery-confirmed>svg{color:#888;flex:none}
        .change-delivery{display:inline-block;margin-top:11px;font-size:11px;color:#777;text-decoration:underline}
        .account-notice{display:flex;align-items:flex-start;gap:10px;padding:13px 14px;margin-top:18px;background:#fff9d9;border:1px solid #f0d65b;border-radius:9px;color:#5c5000;font-size:11px;line-height:1.5}
        .account-notice svg{flex:none;color:#a47700;margin-top:1px}
        .shipping-whatsapp-note{display:flex;align-items:flex-start;gap:9px;margin-top:16px;padding:13px 14px;border-radius:9px;background:#f4f4f4;color:#555;font-size:11px;line-height:1.5}
        .shipping-whatsapp-note svg{flex:none;color:#111}
        .checkout-status{padding:16px 28px;border-top:1px solid #e9e9e9;background:#fafafa}
        .checkout-footer{padding:22px 28px;background:#fafafa;border-top:1px solid #e9e9e9;display:flex;align-items:center;justify-content:space-between;gap:20px}
        .checkout-footer>div{display:grid;gap:4px}
        .checkout-footer span{font-size:12px;color:#686868}
        .checkout-footer strong{font-size:25px}
        .checkout-submit{border:0;cursor:pointer;min-height:52px;padding:0 26px;border-radius:9px;background:#ffc400;color:#111;font:900 14px Inter,Arial,sans-serif}
        .checkout-submit:hover:not(:disabled){background:#111;color:#fff}
        .checkout-submit:disabled{opacity:.55;cursor:not-allowed}
        .payment-section{overflow:visible}
        .contact-copy{margin:0 0 18px;color:#4d4d4d;font-size:13.5px;line-height:1.65}
        .contact-button{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:52px;padding:0 24px;border:0;border-radius:10px;background:#ffc400;color:#111;text-decoration:none;font:900 12px Inter,Arial,sans-serif;letter-spacing:.04em;text-transform:uppercase}
        .contact-button:hover{background:#111;color:#fff}
        @media(max-width:600px){.contact-button{width:100%}}
        .checkout-charge{display:grid;gap:9px;padding:22px 28px;border-bottom:1px solid #e9e9e9;background:#fafaf7}
        .checkout-charge>div{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
        .checkout-charge span{font:800 10px Inter,Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#777}
        .checkout-charge strong{font:800 14px Inter,Arial,sans-serif}
        .checkout-charge-total{padding-top:10px;border-top:1px solid #e6e6e0}
        .checkout-charge-total strong{font:900 24px 'Barlow Condensed',Inter,sans-serif}
        .delivery-options{margin-top:20px;padding-top:20px;border-top:1px solid #eee;display:grid;gap:12px}
        .delivery-unavailable{margin:0;padding:0 0 0 18px;color:#8a8a86;font-size:11.5px;line-height:1.6}
        .payment-method-body{margin-top:22px;padding-top:22px;border-top:1px solid #eee}
        .checkout-success{display:grid;place-items:center;min-height:60vh}
        .checkout-success-card{max-width:620px;text-align:center;border:1px solid #e9e9e9;border-radius:20px;padding:42px 34px}
        .success-icon{width:68px;height:68px;margin:0 auto 18px;border-radius:50%;background:#ffc400;display:grid;place-items:center}
        .checkout-success-card p:not(.eyebrow){color:#686868;line-height:1.6}
        .guest-access-note{display:flex;align-items:flex-start;gap:11px;margin-top:20px;padding:14px;text-align:left;background:#fff9d9;border:1px solid #f0d65b;border-radius:10px}
        .guest-access-note svg{flex:none;color:#a47700;margin-top:2px}
        .guest-access-note strong{display:block;font-size:12px;color:#5c5000}
        .guest-access-note span{display:block;margin-top:4px;font-size:11px;line-height:1.5;color:#6b5d00}
        .success-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:22px}
        .success-actions .primary{background:#ffc400;color:#111;padding:14px 22px;border-radius:9px;text-decoration:none;font:900 12px Inter,Arial,sans-serif}
        .success-actions .secondary{border:1px solid #111;color:#111;padding:14px 22px;border-radius:9px;text-decoration:none;font:900 12px Inter,Arial,sans-serif;background:#fff}
        @media(max-width:700px){
          .checkout-page{width:min(100% - 28px,900px)}
          .checkout-intro{margin:22px 0}
          .checkout-title{font-size:44px}
          .checkout-form{border-radius:16px}
          .checkout-section{padding:22px 18px}
          .checkout-section-heading h2{font-size:24px}
          .form-grid{grid-template-columns:1fr;gap:16px}
          .checkout-footer{padding:18px;display:grid;gap:14px}
          .checkout-submit{width:100%}
          .checkout-status{padding:14px 18px}
          .checkout-success-card{padding:28px 20px}
          .checkout-success-card .checkout-title{font-size:40px}
          .success-actions>*{width:100%}
        }
      `}</style>
    </main>
  );
}

export default function Checkout() {
  return (
    <Suspense fallback={<PageLoader title="Carregando checkout" description="Preparando o resumo do seu pedido." />}>
      <CheckoutForm />
    </Suspense>
  );
}
