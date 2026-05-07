'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function RealLoginPage() {
  return (
    <Suspense fallback={<div className="text-sm text-[color:var(--charcoal-mute)]">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const reason = params.get('reason');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/real/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Login failed (${res.status})`);
      }
      router.replace('/real');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 max-w-md">
      <header>
        <p className="eyebrow">Real mode</p>
        <h1 className="serif text-3xl text-[color:var(--forest)]">Sign in</h1>
        <p className="text-sm text-[color:var(--charcoal-soft)] mt-2">
          Real mode connects Stride to live Outlook + Calendar and Google accounts. Visitors should
          use the synthetic demo on the home page; this gate is for Chantel's daily-driver use.
        </p>
      </header>

      {reason === 'not-configured' && (
        <div className="card card-pad rag-amber border border-current text-sm">
          Real mode isn't configured on this deploy. Set <code className="mono">STRIDE_REAL_MODE_PASSWORD</code>
          {' '}in your environment to enable it.
        </div>
      )}

      <form onSubmit={submit} className="grid gap-3">
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          placeholder="Real-mode password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="card-tight bg-white border border-[color:var(--rule)] focus:border-[color:var(--forest)] outline-none"
        />
        {error && <div className="text-xs rag-red">{error}</div>}
        <button className="btn btn-primary" disabled={submitting || password.length === 0}>
          {submitting ? 'Signing in…' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
