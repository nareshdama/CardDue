import React, { useState, useEffect } from 'react';
import { generateSalt, hashPassword, deriveKey, DEFAULT_PBKDF2_ITERATIONS, LEGACY_PBKDF2_ITERATIONS } from '../lib/crypto';
import { rekeyDatabase } from '../db';
import { CreditCard, KeyRound } from 'lucide-react';

const MIN_PASSWORD_LENGTH = 8;

export default function LocalLogin({ onLogin }: { onLogin: (key: string) => void }) {
  const [view, setView] = useState<'login' | 'setup' | 'recover'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('carddue-auth-user');
    const savedHash = localStorage.getItem('carddue-auth-hash');
    if (!savedUser || !savedHash) setView('setup');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    if (view === 'recover') {
      if (!username || !password || !recoveryKey) {
        setError('Please fill in all fields');
        return;
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
        return;
      }

      setBusy(true);
      try {
        const salt = generateSalt();
        const hash = hashPassword(password, salt);
        const newEncryptionKey = deriveKey(password, salt, DEFAULT_PBKDF2_ITERATIONS);

        // Rekey throws if the recovery key can't decrypt existing records,
        // so we mutate localStorage only after a successful rekey.
        await rekeyDatabase(recoveryKey, newEncryptionKey);

        localStorage.setItem('carddue-auth-user', username);
        localStorage.setItem('carddue-auth-hash', hash);
        localStorage.setItem('carddue-auth-salt', salt);
        localStorage.setItem('carddue-auth-iter', String(DEFAULT_PBKDF2_ITERATIONS));
        onLogin(newEncryptionKey);
      } catch {
        setError('Invalid Recovery Key. Your existing data was not modified.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (view === 'setup') {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
        return;
      }

      setBusy(true);
      try {
        const salt = generateSalt();
        const hash = hashPassword(password, salt);
        const encryptionKey = deriveKey(password, salt, DEFAULT_PBKDF2_ITERATIONS);

        localStorage.setItem('carddue-auth-user', username);
        localStorage.setItem('carddue-auth-hash', hash);
        localStorage.setItem('carddue-auth-salt', salt);
        localStorage.setItem('carddue-auth-iter', String(DEFAULT_PBKDF2_ITERATIONS));
        onLogin(encryptionKey);
      } finally {
        setBusy(false);
      }
    } else {
      const savedUser = localStorage.getItem('carddue-auth-user');
      const savedHash = localStorage.getItem('carddue-auth-hash');
      const savedSalt = localStorage.getItem('carddue-auth-salt');
      const savedIter = Number(localStorage.getItem('carddue-auth-iter')) || LEGACY_PBKDF2_ITERATIONS;

      if (!savedUser || !savedHash || !savedSalt) {
         setError("Configuration error. Please reinstall.");
         return;
      }

      setBusy(true);
      try {
        if (username === savedUser && hashPassword(password, savedSalt) === savedHash) {
          const encryptionKey = deriveKey(password, savedSalt, savedIter);
          onLogin(encryptionKey);
        } else {
          setError('Invalid credentials');
          setPassword('');
        }
      } finally {
        setBusy(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-[2rem] p-8 md:p-10 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] border border-black/[0.03] text-center max-w-sm w-full animate-in fade-in zoom-in-95 duration-300">
        <div className="w-20 h-20 bg-gradient-to-b from-zinc-700 to-black rounded-[24px] flex items-center justify-center text-white mx-auto shadow-xl border border-black/10 mb-8 relative">
          <div className="absolute inset-0 rounded-[24px] border border-white/20" style={{ clipPath: 'inset(0 0 auto auto)' }}></div>
          {view === 'recover' ? <KeyRound className="w-10 h-10 text-white" /> : <CreditCard className="w-10 h-10 text-white" />}
        </div>
        
        <h1 className="text-2xl font-bold text-black tracking-tight mb-2">
          {view === 'setup' ? 'Create Local Vault' : view === 'recover' ? 'Recover Account' : 'Welcome Back'}
        </h1>
        <p className="text-black/50 text-sm font-medium mb-8 leading-tight">
          {view === 'setup' 
            ? 'Set a local User ID and password. Data stays strictly on your device.' 
            : view === 'recover'
            ? 'Enter your Recovery Key to recover your data and set a new User ID and password.'
            : 'Enter your User ID and password to unlock your vault.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {view === 'recover' && (
            <div>
              <input
                type="text"
                value={recoveryKey}
                onChange={(e) => {
                  setRecoveryKey(e.target.value);
                  setError('');
                }}
                placeholder="Recovery Key"
                className="w-full bg-black/[0.03] border border-transparent rounded-xl px-4 py-3 text-center text-sm font-medium focus:outline-none focus:border-black/20 focus:bg-white transition-all"
                autoFocus
              />
            </div>
          )}
          <div>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              placeholder={view === 'recover' ? 'New User ID' : 'User ID'}
              className="w-full bg-black/[0.03] border border-transparent rounded-xl px-4 py-3 text-center text-sm font-medium focus:outline-none focus:border-black/20 focus:bg-white transition-all"
              autoFocus={view !== 'recover'}
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder={view === 'setup' ? 'Create Password' : view === 'recover' ? 'New Password' : 'Enter Password'}
              className="w-full bg-black/[0.03] border border-transparent rounded-xl px-4 py-3 text-center text-xl tracking-widest font-medium focus:outline-none focus:border-black/20 focus:bg-white transition-all"
            />
          </div>
          {error && <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full mt-2 bg-black text-white rounded-xl py-4 font-bold hover:bg-black/90 transition-transform active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy
              ? 'Working…'
              : view === 'setup' ? 'Secure & Continue' : view === 'recover' ? 'Recover Vault' : 'Unlock Vault'}
          </button>
        </form>

        {view === 'login' && (
          <button 
            onClick={() => { setView('recover'); setError(''); setPassword(''); setUsername(''); }}
            className="mt-6 text-xs font-bold text-black/50 hover:text-black transition-colors"
          >
            Lost User ID or Password?
          </button>
        )}
        {view === 'recover' && (
          <button 
            onClick={() => { setView('login'); setError(''); setPassword(''); setUsername(''); setRecoveryKey(''); }}
            className="mt-6 text-xs font-bold text-black/50 hover:text-black transition-colors"
          >
            Cancel Recovery
          </button>
        )}
      </div>
    </div>
  );
}
