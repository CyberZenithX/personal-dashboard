'use client';
import { useState } from 'react';

export default function Login() {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !pw) return;
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw }) });
      if (res.ok) {
        window.location.href = '/';
        return;
      }
      const j = await res.json().catch(() => ({}));
      setErr(j.error || 'Something went wrong');
    } catch {
      setErr("Couldn't reach the server");
    }
    setBusy(false);
  };

  return (
    <main style={{ minHeight: '100dvh', background: '#07080B', color: '#E9ECF2', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form onSubmit={submit} style={{ width: '100%', maxWidth: 400, borderRadius: 24, background: '#14171D', border: '1px solid #262B36', padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: '#C6F432', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E1014" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M4 12h4l3-7 4 14 3-7h2" /></svg>
          </div>
          <span style={{ fontFamily: "'Space Grotesk Variable', sans-serif", fontWeight: 700, fontSize: 20 }}>Daylog</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ margin: 0, fontFamily: "'Space Grotesk Variable', sans-serif", fontSize: 26 }}>Welcome back</h1>
          <span style={{ fontSize: 14, color: '#A7AFBD' }}>Enter your password to open your log.</span>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, fontWeight: 600 }}>
          Password
          <input
            type="password" autoFocus autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)}
            style={{ padding: 14, borderRadius: 12, background: '#0E1014', border: '1px solid #3A404D', color: '#fff', fontSize: 16, outline: 'none' }}
          />
        </label>
        {err && <span role="alert" style={{ fontSize: 13, color: '#FF9E92' }}>{err}</span>}
        <button type="submit" disabled={busy || !pw} style={{ padding: 14, borderRadius: 14, border: 'none', background: '#C6F432', color: '#0E1014', fontSize: 15, fontWeight: 700, opacity: busy || !pw ? 0.6 : 1, cursor: 'pointer' }}>
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </main>
  );
}
