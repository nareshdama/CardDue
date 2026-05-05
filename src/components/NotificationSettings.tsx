import React, { useState, useEffect } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { requestNotificationPermission } from '../lib/notifications';

export default function NotificationSettings({ isMobile }: { isMobile?: boolean }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      const stored = localStorage.getItem('carddue-notifications-enabled');
      if (stored === 'true' && Notification.permission === 'granted') {
        setEnabled(true);
      }
    }
  }, []);

  const handleToggle = async () => {
    if (enabled) {
      setEnabled(false);
      localStorage.setItem('carddue-notifications-enabled', 'false');
    } else {
      const granted = await requestNotificationPermission();
      if (granted) {
        setEnabled(true);
        localStorage.setItem('carddue-notifications-enabled', 'true');
      } else {
        alert('Please allow notifications in your browser settings to enable this feature.');
      }
    }
  };

  if (!('Notification' in window)) return null;

  if (isMobile) {
    return (
      <button 
        onClick={handleToggle}
        className={`flex flex-col items-center ${enabled ? 'text-black' : 'text-black/40 hover:text-black'}`}
        title="Notification Settings"
      >
        {enabled ? <Bell className="w-6 h-6 mb-1" /> : <BellOff className="w-6 h-6 mb-1" />}
        <span className="text-[10px] font-bold tracking-wide">Alerts</span>
      </button>
    );
  }

  return (
    <button 
      onClick={handleToggle}
      className={`p-3 transition-transform duration-300 ${enabled ? 'text-black scale-110' : 'text-black/30 hover:text-black'}`}
      title="Notification Settings"
    >
      {enabled ? <Bell className="w-6 h-6" /> : <BellOff className="w-6 h-6" />}
    </button>
  );
}
