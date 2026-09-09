'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, LockKeyhole, LogIn } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!supabase) { setError('A conexão com o Supabase não está disponível neste deployment.'); return; }
    setLoading(true);
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (loginError) { setError(`Não foi possível entrar: ${loginError.message}`); return; }
    if (!data.session) { setError('Login realizado, mas a sessão não foi criada.'); return; }
    window.location.assign('/admin');
  }

  return <main className="admin-login"><div className="login-topbar">2P BOX <span>•</span> ÁREA RESTRITA</div><section className="login-shell"><div className="login-brand"><Link href="/" className="login-mark">2P</Link><span><strong>2P BOX</strong><small>ADMINISTRAÇÃO DA LOJA</small></span></div><div className="login-card"><div className="login-icon"><LockKeyhole size={24}/></div><p className="login-eyebrow">ACESSO SEGURO</p><h1>Entrar</h1><p className="login-subtitle">Acesse o painel para administrar produtos, pedidos e configurações.</p><form onSubmit={handleSubmit}><label>E-mail<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="seu@email.com" /></label><label>Senha<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Sua senha" /></label>{error&&<div className="login-error">{error}</div>}<button className="login-submit" type="submit" disabled={loading}><LogIn size={17}/>{loading?'Entrando...':'Entrar no painel'}</button></form><Link href="/" className="login-store"><ArrowLeft size={15}/> Voltar para a loja</Link></div><p className="login-foot">Acesso restrito à equipe 2P Box</p></section><style jsx global>{`
.admin-login{min-height:100vh;background:#f6f6f3;color:#111;font-family:Inter,Arial,sans-serif}.login-topbar{height:34px;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;gap:9px;font-size:9px;font-weight:800;letter-spacing:.2em}.login-topbar span{color:#ffc400}.login-shell{min-height:calc(100vh - 34px);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:35px 20px}.login-brand{display:flex;align-items:center;gap:10px;margin-bottom:18px}.login-brand>span:last-child{display:grid;gap:3px}.login-brand strong{font-size:15px;letter-spacing:.08em}.login-brand small{font-size:8px;color:#888;font-weight:800;letter-spacing:.13em}.login-mark{width:50px;height:44px;border-radius:12px;background:#ffc400;display:grid;place-items:center;color:#111;text-decoration:none;font-family:'Barlow Condensed';font-size:25px;font-style:italic;font-weight:800}.login-card{width:min(100%,430px);background:#fff;border:1px solid #e0e0dc;border-radius:20px;padding:28px;box-shadow:0 18px 50px rgba(0,0,0,.06)}.login-icon{width:46px;height:46px;border-radius:13px;background:#ffc400;display:grid;place-items:center;margin-bottom:18px}.login-eyebrow{margin:0 0 8px;color:#a07800;font-size:10px;font-weight:900;letter-spacing:.22em}.login-card h1{margin:0;font-family:'Barlow Condensed';font-size:53px;line-height:.9;text-transform:uppercase;font-style:italic}.login-subtitle{color:#777;font-size:12px;line-height:1.55;margin:12px 0 24px}.login-card form{display:grid;gap:14px}.login-card label{display:grid;gap:7px;font-size:10px;font-weight:900;text-transform:uppercase}.login-card input{width:100%;height:48px;padding:0 13px;border:1px solid #ddd;border-radius:10px;outline:0;background:#fff;color:#111;font:600 13px Inter,Arial,sans-serif;text-transform:none}.login-card input:focus{border-color:#111;box-shadow:0 0 0 3px rgba(255,196,0,.16)}.login-error{padding:10px 11px;border:1px solid #edcaca;border-radius:9px;background:#fff5f5;color:#a52626;font-size:11px;line-height:1.4}.login-submit{height:48px;border:0;border-radius:10px;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;gap:8px;font:800 12px Inter,Arial,sans-serif;cursor:pointer}.login-submit:disabled{opacity:.6;cursor:wait}.login-store{display:flex;align-items:center;justify-content:center;gap:6px;color:#555;text-decoration:none;font-size:11px;font-weight:800;margin-top:18px}.login-foot{color:#aaa;font-size:9px;margin:16px 0 0}@media(max-width:520px){.login-shell{padding:25px 14px}.login-card{padding:22px;border-radius:17px}.login-card h1{font-size:48px}}
`}</style></main>;
}
