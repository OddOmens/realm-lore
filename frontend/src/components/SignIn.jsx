import { useState } from 'react';
import { AlertCircle } from 'lucide-react';

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
    <div className="flex h-full w-full items-center justify-center bg-surface text-foreground p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/icon-192.png" alt="" aria-hidden className="size-12 rounded-xl" />
          <h1 className="mt-4 text-xl font-bold tracking-[-0.02em]">Sign in to Realm Lore</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter the password set on this server.</p>
        </div>
        <form onSubmit={submit} className="card flex flex-col gap-4 p-6 shadow-sm">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input h-9"
            />
          </div>
          {error && (
            <p className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy || !password}
            className="btn btn-primary h-9 w-full"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
