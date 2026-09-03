'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { LockKeyhole, LogIn } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!supabase) {
      setError('Configure as variáveis do Supabase na Vercel antes de entrar.');
      return;
    }
    setLoading(true);
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (loginError) {
      setError('E-mail ou senha inválidos.');
      return;
    }
    window.location.href = '/admin';
  }

  return (
    <main>
      <div className="topbar">Área restrita • 2P Box</div>
      <section className="container section" style={{ minHeight: '75vh', display: 'grid', placeItems: 'center' }}>
        <div className="category" style={{ width: '100%', maxWidth: 440 }}>
          <div className="category-icon"><LockKeyhole size={28} /></div>
          <p className="eyebrow">ADMINISTRAÇÃO</p>
          <h1 style={{ fontFamily: 'Barlow Condensed', fontSize: 46, textTransform: 'uppercase', fontStyle: 'italic', margin: '0 0 8px' }}>Entrar</h1>
          <p>Use o e-mail e a senha cadastrados no Supabase.</p>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14, marginTop: 24 }}>
            <label style={{ display: 'grid', gap: 7, fontSize: 13, fontWeight: 700 }}>E-mail<input required type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ padding: 13, border: '1px solid #ddd', borderRadius: 8, font: 'inherit' }} /></label>
            <label style={{ display: 'grid', gap: 7, fontSize: 13, fontWeight: 700 }}>Senha<input required type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ padding: 13, border: '1px solid #ddd', borderRadius: 8, font: 'inherit' }} /></label>
            {error && <p style={{ color: '#b00020', fontSize: 13, margin: 0 }}>{error}</p>}
            <button className="primary" type="submit" disabled={loading} style={{ border: 0, justifyContent: 'center', cursor: loading ? 'wait' : 'pointer' }}><LogIn size={17} />{loading ? 'Entrando...' : 'Entrar no painel'}</button>
          </form>
          <Link href="/" className="secondary" style={{ display: 'inline-flex', marginTop: 14 }}>Voltar para a loja</Link>
        </div>
      </section>
    </main>
  );
}
