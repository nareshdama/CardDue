import React from 'react';
import { useStore } from '../hooks/useStore';
import { format, parseISO } from 'date-fns';
import { CheckCircle2, CalendarPlus, RefreshCw, Bell, Lightbulb, CreditCard as CardIcon, AlertTriangle, Trash2 } from 'lucide-react';
import { Activity } from '../types';

function ActivityIcon({ type }: { type: Activity['type'] }) {
  const baseClass = "w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-black/[0.03]";
  switch (type) {
    case 'PAYMENT_PAID':
      return <div className={baseClass}><CheckCircle2 className="w-4 h-4 text-black" /></div>;
    case 'PAYMENT_SCHEDULED':
      return <div className={baseClass}><CalendarPlus className="w-4 h-4 text-black" /></div>;
    case 'BALANCE_UPDATED':
      return <div className={baseClass}><RefreshCw className="w-4 h-4 text-black" /></div>;
    case 'REMINDER_SENT':
      return <div className={baseClass}><Bell className="w-4 h-4 text-black" /></div>;
    case 'TIP_VIEWED':
      return <div className={baseClass}><Lightbulb className="w-4 h-4 text-black" /></div>;
    case 'CARD_ADDED':
      return <div className={baseClass}><CardIcon className="w-4 h-4 text-black" /></div>;
    case 'CARD_DELETED':
      return <div className={baseClass}><Trash2 className="w-4 h-4 text-black" /></div>;
    case 'ALERT':
      return <div className={baseClass}><AlertTriangle className="w-4 h-4 text-black" /></div>;
    default:
      return <div className={baseClass}><div className="w-2 h-2 rounded-full bg-black/20" /></div>;
  }
}

export default function ActivityTimeline() {
  const { activities } = useStore();

  return (
    <div className="flex flex-col">
      <h1 className="text-xl font-bold tracking-tight text-black mb-8 px-2">Recent Activity</h1>
      
      {activities.length === 0 ? (
        <div className="text-center py-12 text-black/40">
          <p>No activity yet.</p>
        </div>
      ) : (
        <div className="space-y-8 relative">
          {activities.map((activity, index) => {
            const date = parseISO(activity.date);
            const isDifferentDay = index === 0 || format(parseISO(activities[index - 1].date), 'yyyy-MM-dd') !== format(date, 'yyyy-MM-dd');

            return (
              <div key={activity.id} className="relative">
                {isDifferentDay && (
                  <div className="mb-6 mt-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-black/40 px-2">
                      {format(date, 'MMM d, yyyy')}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-5 px-2">
                  <div className="relative z-10">
                    <ActivityIcon type={activity.type} />
                  </div>
                  <div className="flex-1 py-1">
                    <p className="text-sm font-bold text-black tracking-tight leading-none mb-1.5">{activity.text}</p>
                    <p className="text-[10px] font-bold tracking-widest uppercase text-black/30">{format(date, 'h:mm a')}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
