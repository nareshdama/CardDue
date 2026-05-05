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
import Settings from './components/Settings';
import { Home, CreditCard as CardIcon, Activity as ActivityIcon, Settings as SettingsIcon } from 'lucide-react';
import { sendLocalNotification } from './lib/notifications';
import { useStore } from './hooks/useStore';

type Tab = 'dashboard' | 'cards' | 'activity' | 'settings';

function NavTab({ tab, label, icon: Icon, activeTab, onSelect }: { tab: Tab; label: string; icon: React.ComponentType<{ className?: string }>; activeTab: Tab; onSelect: (t: Tab) => void }) {
  const active = activeTab === tab;
  return (
    <button
      onClick={() => onSelect(tab)}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-col items-center justify-center min-w-0 flex-1 py-1 ${active ? 'text-black' : 'text-black/40'}`}
    >
      <Icon className="w-5 h-5 sm:w-6 sm:h-6 mb-0.5 shrink-0" />
      <span className="text-[10px] font-bold tracking-wide truncate max-w-full">{label}</span>
    </button>
  );
}

function AppLayout({ onLogout, encryptionKey }: { onLogout: () => void, encryptionKey: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const { alerts } = useStore();

  useEffect(() => {
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
    <div className="min-h-screen pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-20">
      <nav
        aria-label="Primary"
        className="fixed bottom-0 inset-x-0 bg-[#f5f5f7]/90 backdrop-blur-xl border-t border-black/[0.03] flex items-stretch px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] z-50 md:hidden"
      >
        <NavTab tab="dashboard" label="Home" icon={Home} activeTab={activeTab} onSelect={setActiveTab} />
        <NavTab tab="cards" label="Cards" icon={CardIcon} activeTab={activeTab} onSelect={setActiveTab} />
        <NavTab tab="activity" label="Activity" icon={ActivityIcon} activeTab={activeTab} onSelect={setActiveTab} />
        <NavTab tab="settings" label="Settings" icon={SettingsIcon} activeTab={activeTab} onSelect={setActiveTab} />
      </nav>

      <nav aria-label="Primary" className="hidden md:flex fixed left-0 top-0 h-full w-20 flex-col items-center py-8 gap-8 z-50">
        <div className="w-10 h-10 flex items-center justify-center text-black mb-4">
          <CardIcon className="w-7 h-7" />
        </div>
        <button onClick={() => setActiveTab('dashboard')} aria-label="Dashboard" className={`p-3 transition-transform duration-300 ${activeTab === 'dashboard' ? 'text-black scale-110' : 'text-black/30 hover:text-black'}`}>
          <Home className="w-6 h-6" />
        </button>
        <button onClick={() => setActiveTab('cards')} aria-label="Cards" className={`p-3 transition-transform duration-300 ${activeTab === 'cards' ? 'text-black scale-110' : 'text-black/30 hover:text-black'}`}>
          <CardIcon className="w-6 h-6" />
        </button>
        <button onClick={() => setActiveTab('activity')} aria-label="Activity" className={`p-3 transition-transform duration-300 ${activeTab === 'activity' ? 'text-black scale-110' : 'text-black/30 hover:text-black'}`}>
          <ActivityIcon className="w-6 h-6" />
        </button>
        <div className="flex-1" />
        <button onClick={() => setActiveTab('settings')} aria-label="Settings" className={`p-3 transition-transform duration-300 ${activeTab === 'settings' ? 'text-black scale-110' : 'text-black/30 hover:text-black'}`}>
          <SettingsIcon className="w-6 h-6" />
        </button>
      </nav>

      <main className="w-full max-w-md sm:max-w-xl md:max-w-5xl mx-auto px-3 sm:px-6 py-5 sm:py-8 md:py-12 pb-10 md:pb-12 relative">
        {activeTab === 'dashboard' && <Dashboard onTabChange={setActiveTab} />}
        {activeTab === 'cards' && <CardsList />}
        {activeTab === 'activity' && <ActivityTimeline />}
        {activeTab === 'settings' && <Settings encryptionKey={encryptionKey} onLogout={onLogout} />}
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
