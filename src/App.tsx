/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { StoreProvider } from './hooks/useStore';
import Dashboard from './components/Dashboard';
import CardsList from './components/CardsList';
import ActivityTimeline from './components/ActivityTimeline';
import LocalLogin from './components/LocalLogin';
import NotificationSettings from './components/NotificationSettings';
import Settings from './components/Settings';
import { Home, CreditCard as CardIcon, Activity as ActivityIcon, Lock, Settings as SettingsIcon } from 'lucide-react';
import { sendLocalNotification } from './lib/notifications';
import { useStore } from './hooks/useStore';

function AppLayout({ onLogout, encryptionKey }: { onLogout: () => void, encryptionKey: string }) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cards' | 'activity' | 'settings'>('dashboard');
  const { alerts } = useStore();

  useEffect(() => {
    // Notify user of new critical alerts once per session
    const notifiedKeys = JSON.parse(sessionStorage.getItem('carddue-notified') || '[]');
    const newCriticalAlerts = alerts.filter(a => 
      (a.type === 'OVERDUE' || a.type === 'DUE_TOMORROW') && 
      !notifiedKeys.includes(a.id)
    );

    if (newCriticalAlerts.length > 0) {
      newCriticalAlerts.forEach(alert => {
        sendLocalNotification('CardDue Alert', {
          body: alert.message,
          tag: alert.id
        });
        notifiedKeys.push(alert.id);
      });
      sessionStorage.setItem('carddue-notified', JSON.stringify(notifiedKeys));
    }
  }, [alerts]);

  return (
    <div className="min-h-screen pb-20 md:pb-0 md:pl-20">
      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 w-full bg-[#f5f5f7]/90 backdrop-blur-xl border-t border-black/[0.03] flex justify-around p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] z-50 md:hidden">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center ${activeTab === 'dashboard' ? 'text-black' : 'text-black/40'}`}>
          <Home className="w-6 h-6 mb-1" />
          <span className="text-[10px] font-bold tracking-wide">Home</span>
        </button>
        <button onClick={() => setActiveTab('cards')} className={`flex flex-col items-center ${activeTab === 'cards' ? 'text-black' : 'text-black/40'}`}>
          <CardIcon className="w-6 h-6 mb-1" />
          <span className="text-[10px] font-bold tracking-wide">Cards</span>
        </button>
        <button onClick={() => setActiveTab('activity')} className={`flex flex-col items-center ${activeTab === 'activity' ? 'text-black' : 'text-black/40'}`}>
          <ActivityIcon className="w-6 h-6 mb-1" />
          <span className="text-[10px] font-bold tracking-wide">Activity</span>
        </button>
        <NotificationSettings isMobile />
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center ${activeTab === 'settings' ? 'text-black' : 'text-black/40'}`}>
          <SettingsIcon className="w-6 h-6 mb-1" />
          <span className="text-[10px] font-bold tracking-wide">Settings</span>
        </button>
      </nav>

      {/* Desktop Sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 h-full w-20 flex-col items-center py-8 gap-8 z-50">
        <div className="w-10 h-10 flex items-center justify-center text-black mb-4">
          <CardIcon className="w-7 h-7" />
        </div>
        <button onClick={() => setActiveTab('dashboard')} className={`p-3 transition-transform duration-300 ${activeTab === 'dashboard' ? 'text-black scale-110' : 'text-black/30 hover:text-black'}`}>
          <Home className="w-6 h-6" />
        </button>
        <button onClick={() => setActiveTab('cards')} className={`p-3 transition-transform duration-300 ${activeTab === 'cards' ? 'text-black scale-110' : 'text-black/30 hover:text-black'}`}>
          <CardIcon className="w-6 h-6" />
        </button>
        <button onClick={() => setActiveTab('activity')} className={`p-3 transition-transform duration-300 ${activeTab === 'activity' ? 'text-black scale-110' : 'text-black/30 hover:text-black'}`}>
          <ActivityIcon className="w-6 h-6" />
        </button>
        <div className="flex-1" />
        <button onClick={() => setActiveTab('settings')} className={`p-3 transition-transform duration-300 ${activeTab === 'settings' ? 'text-black scale-110' : 'text-black/30 hover:text-black'}`}>
          <SettingsIcon className="w-6 h-6" />
        </button>
        <NotificationSettings />
        <button onClick={onLogout} title="Lock Vault" className={`p-3 font-bold transition-colors text-black/30 hover:text-red-500`}>
          <Lock className="w-5 h-5" />
        </button>
      </nav>

      <main className="max-w-md mx-auto md:max-w-5xl px-4 py-8 pb-32 md:py-12 relative">
        {activeTab === 'dashboard' && <Dashboard onTabChange={setActiveTab} />}
        {activeTab === 'cards' && <CardsList />}
        {activeTab === 'activity' && <ActivityTimeline />}
        {activeTab === 'settings' && <Settings encryptionKey={encryptionKey} />}
      </main>
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);

  const lock = () => {
    setIsAuthenticated(false);
    setEncryptionKey(null);
  };

  if (!isAuthenticated || !encryptionKey) {
    return <LocalLogin onLogin={(key) => {
      setEncryptionKey(key);
      setIsAuthenticated(true);
    }} />;
  }

  return (
    <StoreProvider encryptionKey={encryptionKey} onDecryptFailure={lock}>
      <AppLayout onLogout={lock} encryptionKey={encryptionKey} />
    </StoreProvider>
  );
}
