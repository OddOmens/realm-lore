import { useState } from 'react';
import { Layers, AlertCircle } from 'lucide-react';

export default function SignIn({ unreachable, onSignedIn }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(unreachable ? "Can't reach the Realm Lore server. Check that it's running." : '');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) { onSignedIn(); return; }
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'That password is wrong.');
    } catch {
      setError("Can't reach the Realm Lore server. Check that it's running.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dark theme-dark flex h-[100dvh] w-screen items-center justify-center bg-background text-foreground p-4">
      <form onSubmit={submit} className="w-full max-w-sm flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-3">
          <Layers size={24} className="text-violet-400" />
          <h1 className="text-xl font-bold tracking-tight">Realm Lore</h1>
        </div>
        <label className="flex flex-col gap-1.5 text-sm">
          Password
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="h-10 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </label>
        {error && (
          <p className="flex items-start gap-2 text-sm text-red-400">
            <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || !password}
          className="h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
