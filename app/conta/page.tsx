'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  Clock3,
  Heart,
  KeyRound,
  LogIn,
  Mail,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Settings,
  UserRound,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SiteHeader } from '@/components/site-header';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/components/order-tracker';
import { TextField } from '@/components/ui/field';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { InlineLoader, PageLoader } from '@/components/ui/loader';
import { useToast } from '@/components/ui/toast';
import { isValidCpf, isValidEmail, isValidPhone, onlyDigits } from '@/lib/masks';
import { money } from '@/lib/order-format';

type UserMeta = { full_name?: string; phone?: string; cpf?: string };
type AuthUser = { id: string; email?: string | null; user_metadata?: UserMeta };
type Order = {
  id: string;
  customer_name: string;
  delivery_type: string;
  status: string;
  payment_status?: string;
  total: number;
  created_at: string;
};

const ORDER_FIELDS = 'id,customer_name,customer_phone,customer_email,delivery_type,status,payment_status,total,created_at';
const PAGE_SIZE = 5;

export default function AccountPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const toast = useToast();

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }
    client.auth.getUser().then(({ data }) => {
      setUser((data.user as AuthUser | null) ?? null);
      setLoading(false);
    });
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => setUser((session?.user as AuthUser | null) ?? null));
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadOrders = useCallback(
    async (silent = false) => {
      const client = supabase;
      if (!client || !user) return;
      if (!silent) setOrdersLoading(true);

      const emailValue = user.email?.trim().toLowerCase() || '';
      const [byUser, byEmail] = await Promise.all([
        client.from('orders').select(ORDER_FIELDS).eq('customer_id', user.id).order('created_at', { ascending: false }),
        emailValue
          ? client.from('orders').select(ORDER_FIELDS).is('customer_id', null).ilike('customer_email', emailValue).order('created_at', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (byUser.error || byEmail.error) {
        if (!silent) toast.error('Não foi possível carregar seus pedidos');
      } else {
        const merged = [...((byUser.data ?? []) as Order[]), ...((byEmail.data ?? []) as Order[])];
        const unique = Array.from(new Map(merged.map((order) => [order.id, order])).values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        setOrders(unique);
      }
      if (!silent) setOrdersLoading(false);
    },
    [user, toast],
  );

  useEffect(() => {
    if (!user) return;
    void loadOrders();
    const timer = window.setInterval(() => void loadOrders(true), 15000);
    return () => window.clearInterval(timer);
  }, [user, loadOrders]);

  const { page, setPage, totalPages, pageItems, from, to, total } = usePagination(orders, PAGE_SIZE, user?.id);

  function validate() {
    const next: Record<string, string> = {};
    if (!isValidEmail(email)) next.email = 'Informe um e-mail válido.';
    if (mode === 'login') {
      if (password.length < 6) next.password = 'A senha precisa ter ao menos 6 caracteres.';
    } else {
      if (!name.trim() || name.trim().split(/\s+/).length < 2) next.name = 'Informe seu nome completo.';
      if (!isValidPhone(phone)) next.phone = 'Informe um telefone válido com DDD.';
      if (cpf.trim() && !isValidCpf(cpf)) next.cpf = 'CPF inválido.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = supabase;
    if (!client || authLoading) return;
    if (!validate()) return;

    setAuthLoading(true);
    try {
      if (mode === 'login') {
        const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) {
          setErrors({ password: 'E-mail ou senha inválidos.' });
          toast.error('Não foi possível entrar', 'Confira o e-mail e a senha informados.');
          return;
        }
        setUser(data.user as AuthUser);
        toast.success('Bem-vindo de volta!', data.user?.user_metadata?.full_name || email.trim());
        return;
      }

      const normalizedPhone = onlyDigits(phone);
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password: normalizedPhone,
        options: { data: { full_name: name.trim(), phone: phone.trim(), cpf: onlyDigits(cpf) || null } },
      });

      if (error) {
        const message = error.message.toLowerCase().includes('already') ? 'Este e-mail já possui uma conta. Entre para continuar.' : error.message;
        setErrors({ email: message });
        toast.error('Não foi possível criar a conta', message);
        return;
      }

      fetch('/api/conta/notificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'account_created', email: email.trim().toLowerCase(), name: name.trim() }),
      }).catch(() => undefined);

      if (data.session) {
        setUser(data.user as AuthUser);
        toast.success('Conta criada!', 'Sua senha inicial é o número do telefone informado.');
      } else {
        toast.info('Conta criada', 'Confirme o e-mail enviado para concluir o primeiro acesso.');
      }
    } finally {
      setAuthLoading(false);
    }
  }

  async function requestPasswordReset() {
    if (!isValidEmail(email)) {
      setErrors({ email: 'Informe o e-mail da sua conta para redefinir a senha.' });
      return;
    }
    try {
      const response = await fetch('/api/conta/notificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'password_reset', email: email.trim().toLowerCase() }),
      });
      if (!response.ok) throw new Error();
      toast.success('Link enviado', 'Se existir uma conta com esse e-mail, você receberá o link de redefinição.');
    } catch {
      toast.error('Não foi possível enviar o link', 'Tente novamente em instantes.');
    }
  }

  if (loading) {
    return (
      <main className="customer-page">
        <SiteHeader subtitle="ÁREA DO CLIENTE" showCart={false} />
        <PageLoader title="Carregando sua conta" description="Verificando sua sessão na 2P Box." />
        <style jsx global>{styles}</style>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="customer-page">
        <SiteHeader subtitle="ÁREA DO CLIENTE" />
        <section className="customer-shell">
          <div className="auth-card">
            <div className="auth-icon">
              <UserRound size={24} />
            </div>
            <p className="eyebrow">ÁREA DO CLIENTE</p>
            <h1>{mode === 'login' ? 'Entrar na sua conta' : 'Criar minha conta'}</h1>
            <p className="auth-copy">
              {mode === 'login'
                ? 'Acompanhe pedidos, favoritos, endereços e suas compras em um só lugar.'
                : 'Informe apenas seus dados básicos. Nesta fase, a senha inicial é o seu telefone.'}
            </p>

            <form onSubmit={submit}>
              {mode === 'signup' && (
                <>
                  <TextField label="Nome completo" required placeholder="Seu nome" value={name} error={errors.name} onValueChange={setName} fullWidth />
                  <TextField
                    label="Telefone"
                    required
                    mask="phone"
                    inputMode="tel"
                    placeholder="(11) 99999-9999"
                    value={phone}
                    error={errors.phone}
                    icon={<Phone size={16} />}
                    onValueChange={setPhone}
                    fullWidth
                  />
                  <TextField
                    label="CPF"
                    optional
                    mask="cpf"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={cpf}
                    error={errors.cpf}
                    onValueChange={setCpf}
                    fullWidth
                  />
                </>
              )}

              <TextField
                label="E-mail"
                required
                type="email"
                mask="email"
                placeholder="seuemail@email.com"
                value={email}
                error={errors.email}
                icon={<Mail size={16} />}
                onValueChange={setEmail}
                fullWidth
              />

              {mode === 'login' ? (
                <TextField
                  label="Senha"
                  required
                  type="password"
                  minLength={6}
                  placeholder="Sua senha"
                  value={password}
                  error={errors.password}
                  icon={<KeyRound size={16} />}
                  onValueChange={setPassword}
                  fullWidth
                />
              ) : (
                <div className="test-password-note">
                  <strong>Senha inicial</strong>
                  <span>Sua senha será o número do telefone informado, somente com os dígitos. Você pode alterá-la depois.</span>
                </div>
              )}

              <button className="primary auth-submit" disabled={authLoading}>
                {authLoading ? <InlineLoader label="Aguarde..." /> : <><LogIn size={17} /> {mode === 'login' ? 'Entrar' : 'Criar conta'}</>}
              </button>
            </form>

            {mode === 'login' && (
              <button type="button" className="forgot-password" onClick={requestPasswordReset}>
                Esqueci minha senha
              </button>
            )}

            <button
              type="button"
              className="mode-switch"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setErrors({});
              }}
            >
              {mode === 'login' ? 'Ainda não tenho conta' : 'Já tenho uma conta'} <strong>{mode === 'login' ? 'Criar agora' : 'Entrar'}</strong>
            </button>
          </div>
        </section>
        <style jsx global>{styles}</style>
      </main>
    );
  }

  return (
    <main className="customer-page">
      <SiteHeader subtitle="ÁREA DO CLIENTE" />
      <section className="customer-shell account-shell">
        <div className="account-welcome">
          <div>
            <p className="eyebrow">MINHA CONTA</p>
            <h1>Olá, {user.user_metadata?.full_name?.split(' ')[0] || 'cliente'}!</h1>
            <p>Tenha seus pedidos, favoritos, endereços e dados sempre à mão.</p>
          </div>
          <div className="account-avatar">
            <UserRound size={24} />
          </div>
        </div>

        <nav className="account-quick">
          <a href="#pedidos">
            <Package />
            <span>
              <b>Pedidos</b>
              <small>
                {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}
              </small>
            </span>
          </a>
          <Link href="/favoritos">
            <Heart />
            <span>
              <b>Favoritos</b>
              <small>Produtos salvos</small>
            </span>
          </Link>
          <a href="#enderecos">
            <MapPin />
            <span>
              <b>Endereços</b>
              <small>Gerenciar locais</small>
            </span>
          </a>
          <a href="#dados">
            <Settings />
            <span>
              <b>Meus dados</b>
              <small>Perfil e contato</small>
            </span>
          </a>
        </nav>

        <div className="account-grid">
          <aside className="account-menu">
            <a className="menu-active" href="#pedidos">
              <Package size={17} /> Meus pedidos <span>{orders.length}</span>
            </a>
            <Link href="/favoritos">
              <Heart size={17} /> Favoritos
            </Link>
            <a href="#enderecos">
              <MapPin size={17} /> Meus endereços
            </a>
            <a href="#dados">
              <Settings size={17} /> Meus dados
            </a>
          </aside>

          <div className="account-content">
            <section id="pedidos" className="account-section">
              <div className="section-title">
                <div>
                  <p className="eyebrow">HISTÓRICO</p>
                  <h2>Meus pedidos</h2>
                </div>
                <button className="refresh" type="button" onClick={() => void loadOrders()} disabled={ordersLoading}>
                  <RefreshCw size={15} className={ordersLoading ? 'spin' : ''} /> Atualizar
                </button>
              </div>

              {ordersLoading && orders.length === 0 ? (
                <div className="empty-account">
                  <InlineLoader label="Carregando pedidos..." />
                </div>
              ) : orders.length === 0 ? (
                <div className="empty-account">
                  <Package size={30} />
                  <h3>Você ainda não fez pedidos</h3>
                  <p>Quando fizer sua primeira compra, ela aparecerá aqui.</p>
                  <Link href="/loja" className="primary">
                    Conhecer a loja
                  </Link>
                </div>
              ) : (
                <>
                  <div className="customer-orders">
                    {pageItems.map((order) => (
                      <Link className="customer-order" href={`/pedido/${order.id}`} key={order.id}>
                        <div>
                          <small>PEDIDO #{order.id.slice(0, 8).toUpperCase()}</small>
                          <h3>{new Date(order.created_at).toLocaleDateString('pt-BR', { dateStyle: 'long' })}</h3>
                          <span>{order.delivery_type === 'pickup' ? 'Retirada na loja' : 'Entrega via WhatsApp'}</span>
                        </div>
                        <div className="customer-order-right">
                          <strong>{money(order.total)}</strong>
                          <span className={`order-status status-${order.status}`}>
                            <Clock3 size={13} />
                            {ORDER_STATUS_LABELS[order.status] || order.status}
                          </span>
                          {order.payment_status && (
                            <small className={`payment-status payment-${order.payment_status}`}>
                              {PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status}
                            </small>
                          )}
                          <ChevronRight size={16} />
                        </div>
                      </Link>
                    ))}
                  </div>
                  <Pagination page={page} totalPages={totalPages} onPageChange={setPage} from={from} to={to} total={total} label="pedidos" scrollTargetId="pedidos" />
                </>
              )}
            </section>

            <section id="enderecos" className="account-section">
              <div className="section-title">
                <div>
                  <p className="eyebrow">ENTREGA</p>
                  <h2>Meus endereços</h2>
                </div>
              </div>
              <div className="address-empty">
                <MapPin size={26} />
                <div>
                  <h3>Seus endereços ficam aqui</h3>
                  <p>Informe o endereço no checkout para agilizar suas próximas compras.</p>
                </div>
                <Link href="/checkout" className="secondary-link">
                  Ir para o checkout
                </Link>
              </div>
            </section>

            <section id="dados" className="account-section">
              <div className="section-title">
                <div>
                  <p className="eyebrow">PERFIL</p>
                  <h2>Meus dados</h2>
                </div>
              </div>
              <div className="profile-grid">
                <div>
                  <span>Nome</span>
                  <strong>{user.user_metadata?.full_name || 'Não informado'}</strong>
                </div>
                <div>
                  <span>E-mail</span>
                  <strong>{user.email}</strong>
                </div>
                <div>
                  <span>Telefone</span>
                  <strong>{user.user_metadata?.phone || 'Não informado'}</strong>
                </div>
                <div>
                  <span>CPF</span>
                  <strong>{user.user_metadata?.cpf || 'Não informado'}</strong>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
      <style jsx global>{styles}</style>
    </main>
  );
}

const styles = `
.customer-page{min-height:100vh;background:#f7f7f5;color:#111}
.customer-shell{width:min(100% - 40px,720px);margin:0 auto;padding:48px 0 70px}
.account-shell{width:min(100% - 40px,1180px)}
.auth-card{width:min(100%,470px);margin:0 auto;background:#fff;border:1px solid #e4e4df;border-radius:16px;padding:34px}
.auth-icon,.account-avatar{width:48px;height:48px;display:grid;place-items:center;border-radius:12px;background:#ffc400;color:#111}
.customer-page .eyebrow{font:900 9px Inter,Arial,sans-serif;letter-spacing:.18em;color:#b68c00;margin:22px 0 7px}
.auth-card h1{font-size:30px;margin:0}
.auth-copy{color:#777;font-size:12px;line-height:1.6}
.auth-card form{display:grid;gap:16px;margin-top:24px}
.primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:#ffc400;color:#111;border:0;border-radius:9px;padding:14px 18px;text-decoration:none;font:900 12px Inter,Arial,sans-serif;cursor:pointer}
.auth-submit{min-height:50px;margin-top:4px}
.auth-submit:disabled{opacity:.7;cursor:wait}
.forgot-password{display:block;width:100%;margin-top:14px;border:0;background:none;color:#777;font:700 11px Inter,Arial,sans-serif;text-decoration:underline;cursor:pointer}
.mode-switch{display:block;width:100%;margin-top:12px;border:0;background:transparent;color:#777;font:400 11px Inter,Arial,sans-serif;cursor:pointer}
.mode-switch strong{color:#111}
.test-password-note{display:grid;gap:5px;padding:13px;border:1px solid #f0d36a;background:#fff9df;border-radius:9px;color:#604c00}
.test-password-note strong{font:900 10px Inter,Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em}
.test-password-note span{font:400 11px/1.5 Inter,Arial,sans-serif}
.spin{animation:ui-spin 1s linear infinite}
.account-welcome{display:flex;align-items:center;justify-content:space-between;gap:20px;background:#111;color:#fff;border-radius:16px;padding:28px 30px}
.account-welcome .eyebrow{margin:0 0 8px;color:#ffc400}
.account-welcome h1{margin:0 0 7px;font-size:32px}
.account-welcome p:last-child{margin:0;color:#aaa;font-size:12px}
.account-quick{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:15px 0}
.account-quick a{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e4e4df;border-radius:11px;padding:15px;text-decoration:none;color:#111;transition:.15s}
.account-quick a:hover{border-color:#ffc400;transform:translateY(-1px)}
.account-quick svg{width:20px;height:20px;color:#111;flex:none}
.account-quick b{display:block;font-size:11px}
.account-quick small{display:block;color:#999;font-size:9px;margin-top:3px}
.account-grid{display:grid;grid-template-columns:230px minmax(0,1fr);gap:20px}
.account-menu{background:#fff;border:1px solid #e4e4df;border-radius:12px;padding:10px;height:max-content;display:grid;gap:2px;position:sticky;top:110px}
.account-menu a{display:flex;align-items:center;gap:9px;padding:13px 12px;border-radius:8px;text-decoration:none;color:#555;font:800 11px Inter,Arial,sans-serif}
.account-menu .menu-active{background:#ffc400;color:#111}
.account-menu a span{margin-left:auto}
.account-content{display:grid;gap:20px;min-width:0}
.account-section{background:#fff;border:1px solid #e4e4df;border-radius:12px;padding:25px;scroll-margin-top:110px}
.section-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:20px}
.section-title .eyebrow{margin:0 0 5px}
.section-title h2{margin:0;font-size:23px}
.refresh{display:flex;align-items:center;gap:6px;border:1px solid #ddd;background:#fff;border-radius:8px;padding:10px 12px;font:800 10px Inter,Arial,sans-serif;cursor:pointer;flex:none}
.refresh:disabled{opacity:.6;cursor:wait}
.empty-account{text-align:center;padding:35px 10px;color:#777}
.empty-account svg{color:#c39a00}
.empty-account h3{color:#111;font-size:15px;margin:12px 0 5px}
.empty-account p{font-size:11px;margin:0 0 18px}
.customer-orders{display:grid;gap:10px}
.customer-order{display:flex;align-items:center;justify-content:space-between;gap:20px;border:1px solid #eee;border-radius:10px;padding:16px;text-decoration:none;color:#111;transition:.15s}
.customer-order:hover{border-color:#ffc400;transform:translateY(-1px)}
.customer-order small{font-size:8px;color:#999;letter-spacing:.12em}
.customer-order h3{font-size:13px;margin:6px 0}
.customer-order>div>span{font-size:10px;color:#888}
.customer-order-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end}
.customer-order-right strong{font-size:14px}
.order-status{display:inline-flex;align-items:center;gap:5px;border-radius:20px;padding:5px 8px;background:#f4f4f4;font-size:9px;font-weight:800}
.status-confirmed,.status-completed{background:#e9f7ec;color:#27733b}
.status-cancelled{background:#ffecec;color:#a22}
.payment-status{display:block;width:100%;text-align:right;font-size:8px;color:#888}
.payment-approved{color:#27733b}
.payment-rejected,.payment-cancelled{color:#a22}
.payment-pending,.payment-in_process{color:#9a7200}
.address-empty{display:flex;align-items:center;gap:14px;border:1px dashed #ddd;border-radius:10px;padding:20px}
.address-empty>svg{color:#111;flex:none}
.address-empty h3{font-size:13px;margin:0 0 4px}
.address-empty p{font-size:10px;color:#888;margin:0}
.secondary-link{margin-left:auto;color:#111;text-decoration:underline;font:800 10px Inter,Arial,sans-serif;white-space:nowrap}
.profile-grid{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #eee}
.profile-grid div{display:grid;gap:5px;padding:15px 10px;border-bottom:1px solid #eee}
.profile-grid span{font-size:9px;color:#999;text-transform:uppercase;letter-spacing:.08em}
.profile-grid strong{font-size:11px;overflow-wrap:anywhere}
@media(max-width:900px){
  .account-quick{grid-template-columns:1fr 1fr}
  .account-grid{grid-template-columns:1fr}
  .account-menu{position:static;display:flex;overflow:auto}
  .account-menu a{white-space:nowrap}
  .account-welcome h1{font-size:26px}
}
@media(max-width:600px){
  .customer-shell{width:min(100% - 28px,720px);padding:32px 0 56px}
  .auth-card{padding:24px}
  .customer-order{align-items:flex-start;flex-direction:column}
  .customer-order-right{justify-content:flex-start}
  .payment-status{text-align:left}
  .profile-grid{grid-template-columns:1fr}
  .address-empty{align-items:flex-start;flex-wrap:wrap}
  .secondary-link{margin-left:0}
  .account-quick a{padding:12px 10px}
  .account-section{padding:19px}
  .account-welcome{padding:22px}
  .account-avatar{display:none}
}`;
