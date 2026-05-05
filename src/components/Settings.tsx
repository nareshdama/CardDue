import React, { useState, useEffect } from 'react';
import { KeyRound, ShieldAlert, Copy, Check, Bell, BellOff, Lock } from 'lucide-react';
import { requestNotificationPermission } from '../lib/notifications';

export default function Settings({ encryptionKey, onLogout }: { encryptionKey: string; onLogout?: () => void }) {
  const [showKey, setShowKey] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [notifSupported, setNotifSupported] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [notifMessage, setNotifMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setNotifSupported(true);
    const stored = localStorage.getItem('carddue-notifications-enabled');
    setNotifEnabled(stored === 'true' && Notification.permission === 'granted');
  }, []);

  const toggleNotifications = async () => {
    setNotifMessage(null);
    if (notifEnabled) {
      setNotifEnabled(false);
      localStorage.setItem('carddue-notifications-enabled', 'false');
      return;
    }
    const granted = await requestNotificationPermission();
    if (granted) {
      setNotifEnabled(true);
      localStorage.setItem('carddue-notifications-enabled', 'true');
    } else {
      setNotifMessage('Notification permission was not granted. Enable it in your browser settings.');
    }
  };

  const handleCopy = async () => {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(encryptionKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError('Could not copy to clipboard. Select the key and copy manually.');
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black">Settings</h1>
        <p className="text-black/50 text-sm mt-1">Manage your vault and security.</p>
      </header>

      <div className="space-y-4 sm:space-y-6">
        <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-black/5 rounded-full flex items-center justify-center text-black">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg text-black tracking-tight leading-none mb-1">Recovery Key</h2>
              <p className="text-sm text-black/50 leading-tight">Backup this key to recover your account if you lose your User ID or Password.</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs font-medium text-amber-900 leading-relaxed">
              Anyone with this key can decrypt your vault. Do not share it with anyone. Store it in a secure password manager or write it down.
            </p>
          </div>

          {showKey ? (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="relative">
                <textarea 
                  readOnly 
                  value={encryptionKey}
                  className="w-full bg-black/[0.03] border border-transparent rounded-xl p-4 text-xs font-mono font-medium text-black focus:outline-none resize-none break-all"
                  rows={4}
                />
                <button 
                  onClick={handleCopy}
                  className="absolute top-3 right-3 p-2 bg-white rounded-lg shadow-sm hover:bg-black/5 transition-colors text-black"
                  title="Copy to clipboard"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              {copyError && (
                <p className="mt-3 text-red-500 text-[10px] font-bold uppercase tracking-widest">{copyError}</p>
              )}
              <button
                onClick={() => setShowKey(false)}
                className="w-full mt-4 bg-black/[0.05] text-black font-bold py-3 rounded-xl hover:bg-black/[0.1] transition-colors"
              >
                Hide Key
              </button>
            </div>
          ) : showConfirm ? (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col gap-2">
              <p className="text-center text-sm font-bold text-red-500 mb-2">Are you sure? Ensure no one is looking at your screen.</p>
              <div className="flex gap-2">
                <button 
                  onClick={() => { setShowKey(true); setShowConfirm(false); }}
                  className="flex-1 bg-red-500 text-white font-bold py-3 rounded-xl hover:bg-red-600 transition-transform active:scale-[0.98]"
                >
                  Yes, Reveal Key
                </button>
                <button 
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 bg-black/[0.05] text-black font-bold py-3 rounded-xl hover:bg-black/[0.1] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full bg-black text-white font-bold py-3 rounded-xl hover:bg-black/90 transition-transform active:scale-[0.98]"
            >
              Reveal Recovery Key
            </button>
          )}
        </div>

        {notifSupported && (
          <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-black/5 rounded-full flex items-center justify-center text-black shrink-0">
                {notifEnabled ? <Bell className="w-6 h-6" /> : <BellOff className="w-6 h-6" />}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-lg text-black tracking-tight leading-none mb-1">Alerts</h2>
                <p className="text-sm text-black/50 leading-tight">
                  Browser notifications when a card is overdue or due in the next 3 days.
                </p>
              </div>
            </div>
            <button
              onClick={toggleNotifications}
              className={`w-full font-bold py-3 rounded-xl transition-transform active:scale-[0.98] ${notifEnabled ? 'bg-black/[0.05] text-black hover:bg-black/[0.1]' : 'bg-black text-white hover:bg-black/90'}`}
            >
              {notifEnabled ? 'Disable Notifications' : 'Enable Notifications'}
            </button>
            {notifMessage && (
              <p className="mt-3 text-red-500 text-[10px] font-bold uppercase tracking-widest">{notifMessage}</p>
            )}
          </div>
        )}

        {onLogout && (
          <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-6 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-black/5 rounded-full flex items-center justify-center text-black shrink-0">
                <Lock className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-lg text-black tracking-tight leading-none mb-1">Lock Vault</h2>
                <p className="text-sm text-black/50 leading-tight">
                  Sign out of this device. You'll need your password to come back in.
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="w-full bg-red-500 text-white font-bold py-3 rounded-xl hover:bg-red-600 transition-transform active:scale-[0.98]"
            >
              Lock Vault
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
