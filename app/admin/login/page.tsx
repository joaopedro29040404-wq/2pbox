'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, KeyRound, LockKeyhole, LogIn, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { TextField } from '@/components/ui/field';
import { InlineLoader } from '@/components/ui/loader';
import { useToast } from '@/components/ui/toast';
import { isValidEmail } from '@/lib/masks';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;

    const next: Record<string, string> = {};
    if (!isValidEmail(email)) next.email = 'Informe um e-mail válido.';
    if (password.length < 6) next.password = 'A senha precisa ter ao menos 6 caracteres.';
    setErrors(next);
    if (Object.keys(next).length) return;

    if (!supabase) {
      toast.error('Conexão indisponível', 'O Supabase não está configurado neste deployment.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);

    if (error) {
      setErrors({ password: 'E-mail ou senha inválidos.' });
      toast.error('Não foi possível entrar', error.message);
      return;
    }
    if (!data.session) {
      toast.error('Sessão não criada', 'Tente novamente em instantes.');
      return;
    }

    toast.success('Acesso liberado', 'Redirecionando para o painel...');
    window.location.assign('/admin');
  }

  return (
    <main className="admin-login">
      <div className="login-topbar">
        2P BOX <span>•</span> ÁREA RESTRITA
      </div>
      <section className="login-shell">
        <Link href="/" className="login-brand">
          <span className="login-logo">
            <Image src="/logo.pnh.png" alt="2P Box" width={705} height={487} priority />
          </span>
          <span>
            <strong>2P BOX</strong>
            <small>ADMINISTRAÇÃO DA LOJA</small>
          </span>
        </Link>

        <div className="login-card">
          <div className="login-icon">
            <LockKeyhole size={24} />
          </div>
          <p className="login-eyebrow">ACESSO SEGURO</p>
          <h1>Entrar</h1>
          <p className="login-subtitle">Acesse o painel para administrar produtos, pedidos e configurações.</p>

          <form onSubmit={handleSubmit}>
            <TextField
              label="E-mail"
              required
              type="email"
              mask="email"
              autoComplete="email"
              placeholder="seu@email.com"
              value={email}
              error={errors.email}
              icon={<Mail size={16} />}
              onValueChange={setEmail}
              fullWidth
            />
            <TextField
              label="Senha"
              required
              type="password"
              autoComplete="current-password"
              placeholder="Sua senha"
              value={password}
              error={errors.password}
              icon={<KeyRound size={16} />}
              onValueChange={setPassword}
              fullWidth
            />
            <button className="login-submit" type="submit" disabled={loading}>
              {loading ? <InlineLoader label="Entrando..." /> : <><LogIn size={17} /> Entrar no painel</>}
            </button>
          </form>

          <Link href="/" className="login-store">
            <ArrowLeft size={15} /> Voltar para a loja
          </Link>
        </div>

        <p className="login-foot">Acesso restrito à equipe 2P Box</p>
      </section>

      <style jsx global>{`
        .admin-login{min-height:100vh;background:#f6f6f3;color:#111;font-family:Inter,Arial,sans-serif}
        .login-topbar{height:34px;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;gap:9px;font:800 9px Inter,Arial,sans-serif;letter-spacing:.2em}
        .login-topbar span{color:#ffc400}
        .login-shell{min-height:calc(100vh - 34px);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:35px 20px}
        .login-brand{display:flex;align-items:center;gap:12px;margin-bottom:20px;text-decoration:none;color:#111}
        .login-brand>span:last-child{display:grid;gap:3px}
        .login-brand strong{font-size:15px;letter-spacing:.08em}
        .login-brand small{font-size:8px;color:#888;font-weight:800;letter-spacing:.13em}
        .login-logo{width:74px;height:50px;display:grid;place-items:center;overflow:hidden}
        .login-logo img{width:100%;height:100%;object-fit:contain}
        .login-card{width:min(100%,430px);background:#fff;border:1px solid #e0e0dc;border-radius:20px;padding:30px;box-shadow:0 18px 50px rgba(0,0,0,.06)}
        .login-icon{width:46px;height:46px;border-radius:13px;background:#ffc400;display:grid;place-items:center;margin-bottom:18px}
        .login-eyebrow{margin:0 0 8px;color:#a07800;font:900 10px Inter,Arial,sans-serif;letter-spacing:.22em}
        .login-card h1{margin:0;font-family:'Barlow Condensed';font-size:52px;line-height:.9;text-transform:uppercase;font-style:italic}
        .login-subtitle{color:#777;font-size:12px;line-height:1.55;margin:12px 0 24px}
        .login-card form{display:grid;gap:16px}
        .login-submit{min-height:50px;border:0;border-radius:10px;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;font:800 12px Inter,Arial,sans-serif;cursor:pointer}
        .login-submit:disabled{opacity:.7;cursor:wait}
        .login-store{display:flex;align-items:center;justify-content:center;gap:6px;color:#555;text-decoration:none;font:800 11px Inter,Arial,sans-serif;margin-top:20px}
        .login-foot{color:#aaa;font-size:9px;margin:16px 0 0}
        @media(max-width:520px){.login-shell{padding:25px 14px}.login-card{padding:22px;border-radius:17px}.login-card h1{font-size:46px}}
      `}</style>
    </main>
  );
}
