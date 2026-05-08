import { useState } from 'react';
import { useWorldStore } from '../store/useWorldStore';
import { ShieldCheck, Lock, ArrowRight, FolderOpen } from 'lucide-react';
import { connectLocalFolder } from '../store/browserFs';

export default function Login() {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState(false);
  const login = useWorldStore(state => state.login);
  const initialize = useWorldStore(state => state.initialize);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(false);
    
    // Test the passcode by trying to initialize
    localStorage.setItem('passcode', passcode);
    try {
      await initialize();
      login(passcode);
    } catch {
      localStorage.removeItem('passcode');
      setError(true);
    }
  };

  const handleBrowserMode = async () => {
    const success = await connectLocalFolder();
    if (success) {
      localStorage.setItem('passcode', 'browser-mode');
      try {
        await initialize();
        login('browser-mode');
      } catch (err) {
        console.error('Failed to initialize browser mode', err);
        setError(true);
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
            <ShieldCheck size={32} className="text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Vault Access</h1>
          <p className="text-muted-foreground mt-2">Enter your passcode to unlock your worlds.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
              <Lock size={18} />
            </div>
            <input
              autoFocus
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="Enter passcode"
              className={`w-full bg-secondary text-foreground rounded-lg pl-10 pr-4 py-3 border transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 ${error ? 'border-destructive' : 'border-border focus:border-primary'}`}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive text-center font-medium animate-in fade-in slide-in-from-top-1">
              Could not connect. Please try again.
            </p>
          )}

          <button
            type="submit"
            className="w-full h-12 bg-primary text-primary-foreground rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
          >
            Unlock Local Server <ArrowRight size={18} />
          </button>
        </form>

        <div className="mt-8 relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or</span>
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={handleBrowserMode}
            className="w-full h-12 bg-secondary text-secondary-foreground rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-secondary/80 transition-colors border border-border"
          >
            <FolderOpen size={18} />
            Open Local Folder (Web Mode)
          </button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            No server needed. Select a folder on your computer to store your worlds.
          </p>
        </div>
      </div>
    </div>
  );
}
