import React from 'react';
import { useStore } from '../hooks/useStore';
import { formatCurrency, calculateUtilization } from '../lib/utils';
import { format, parseISO, isPast, isToday, differenceInDays } from 'date-fns';
import { AlertCircle, Lightbulb } from 'lucide-react';

export default function Dashboard({ onTabChange }: { onTabChange: (tab: 'dashboard' | 'cards' | 'activity' | 'settings') => void }) {
  const { cards, alerts, dismissAlert, getCardStatus } = useStore();

  const totalDebt = cards.reduce((sum, card) => sum + card.balance, 0);
  const totalLimit = cards.reduce((sum, card) => sum + card.creditLimit, 0);
  const totalUtilization = calculateUtilization(totalDebt, totalLimit);
  
  // Calculate minimum due this month
  const today = new Date();
  
  // A card's minimum is due this month if it's upcoming or overdue, and hasn't been paid/scheduled recently
  // For simplicity, we sum the minimum payment of all cards that are OVERDUE, DUE_SOON, or UPCOMING
  const unpaidCards = cards.filter(card => {
    const status = getCardStatus(card);
    return ['OVERDUE', 'DUE_SOON', 'UPCOMING'].includes(status);
  });
  
  const minimumDue = unpaidCards.reduce((sum, card) => sum + card.minimumPayment, 0);

  // Find next due date
  const sortedByDueDate = [...unpaidCards].sort((a, b) => {
    return parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime();
  });
  
  const nextCardDue = sortedByDueDate[0];
  let nextDueText = 'None';
  if (nextCardDue) {
    const date = parseISO(nextCardDue.dueDate);
    if (isToday(date)) nextDueText = 'Today';
    else if (isPast(date)) nextDueText = 'Overdue';
    else {
      const days = differenceInDays(date, today);
      nextDueText = `In ${days} day${days === 1 ? '' : 's'}`;
    }
  }

  // Calculate status counts for the month
  const statusCounts = {
    paid: 0,
    scheduled: 0,
    upcoming: 0
  };

  cards.forEach(card => {
    const status = getCardStatus(card);
    if (status === 'PAID') statusCounts.paid++;
    else if (status === 'SCHEDULED') statusCounts.scheduled++;
    else statusCounts.upcoming++;
  });

  return (
    <div className="md:grid md:grid-cols-12 md:auto-rows-min md:gap-6 space-y-3 sm:space-y-6 md:space-y-0 animate-in fade-in duration-500">
      {alerts.length > 0 && (
        <div className="space-y-3 md:col-span-12">
          {alerts.map(alert => (
            <div key={alert.id} className={`p-3 sm:p-4 rounded-xl flex items-start gap-2 sm:gap-3 ${
              alert.type === 'OVERDUE' ? 'bg-red-50 text-red-900 border border-red-100' :
              alert.type === 'DUE_TOMORROW' ? 'bg-amber-50 text-amber-900 border border-amber-100' :
              'bg-blue-50 text-blue-900 border border-blue-100'
            }`}>
              <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${
                alert.type === 'OVERDUE' ? 'text-red-500' :
                alert.type === 'DUE_TOMORROW' ? 'text-amber-500' :
                'text-blue-500'
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium break-words">{alert.message}</p>
              </div>
              <button
                onClick={() => dismissAlert(alert.id)}
                className="text-[10px] sm:text-xs font-semibold opacity-60 hover:opacity-100 uppercase tracking-wider shrink-0 px-2 py-1"
              >
                Dismiss
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Stats Card */}
      <div className="md:col-span-8 bg-white rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-8 md:p-10 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] flex flex-col justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mb-2">Total Outstanding</p>
          <div
            className="leading-none tracking-tighter font-bold tabular-nums mb-5 sm:mb-10 md:mb-12 text-black break-words max-w-full"
            style={{ fontSize: 'clamp(2.125rem, 11vw, 5rem)' }}
          >
            {formatCurrency(totalDebt)}
          </div>
        </div>

        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-4 sm:gap-8 md:gap-12 pt-5 sm:pt-8 border-t border-black/[0.03]">
          <div className="min-w-0">
            <p className="text-[10px] font-bold mb-2 uppercase tracking-widest text-black/40">Min Required</p>
            <p className="text-xl sm:text-3xl tracking-tight font-bold tabular-nums text-black break-words">{formatCurrency(minimumDue)}</p>
          </div>
          <div className="min-w-0">
            <div className="flex justify-between text-[10px] font-bold mb-3 uppercase tracking-widest text-black/40 gap-2">
              <span className="truncate">Utilization</span>
              <span className="text-black shrink-0">{Math.min(100, totalUtilization)}%</span>
            </div>
            <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-black rounded-full"
                style={{ width: `${Math.min(100, totalUtilization)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Next Payment Snippet */}
      {nextCardDue ? (
        <button
          type="button"
          className="md:col-span-4 w-full text-left bg-black text-white rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-8 md:p-10 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.2)] flex flex-col justify-between cursor-pointer md:hover:scale-[1.02] transition-transform active:scale-[0.99]"
          onClick={() => onTabChange('cards')}
        >
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-50 mb-2">Next Due</p>
            <h3 className="text-base sm:text-xl font-medium tracking-tight opacity-90 break-words [overflow-wrap:anywhere]">{nextCardDue.issuer} {nextCardDue.name}</h3>
          </div>
          <div className="mt-5 md:mt-12">
            <p className="leading-none tracking-tight font-bold mb-3 sm:mb-4 break-words" style={{ fontSize: 'clamp(1.75rem, 9vw, 2.5rem)' }}>{nextDueText}</p>
            <span className="px-3 py-1 bg-white/10 text-white text-[10px] font-bold uppercase tracking-widest rounded-full inline-block">
              Action Required
            </span>
          </div>
        </button>
      ) : (
        <button type="button" className="md:col-span-4 w-full bg-black text-white rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.2)] flex items-center justify-center cursor-pointer md:hover:scale-[1.02] transition-transform" onClick={() => onTabChange('cards')}>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">All Caught Up</p>
        </button>
      )}

      {/* Status Summary */}
      <div className="md:col-span-8 bg-transparent">
        <h2 className="text-[10px] uppercase tracking-widest font-bold text-black/40 mb-4 sm:mb-6 px-1">Activity Summary</h2>
        <div className="grid grid-cols-3 gap-3 sm:gap-4 md:gap-8">
          <div className="flex flex-col px-1 min-w-0">
            <p className="text-3xl sm:text-4xl tracking-tight font-bold tabular-nums text-black mb-1">{statusCounts.paid}</p>
            <span className="text-[10px] text-black/40 uppercase font-bold tracking-widest truncate">Paid</span>
          </div>
          <div className="flex flex-col px-1 min-w-0">
            <p className="text-3xl sm:text-4xl tracking-tight font-bold tabular-nums text-black mb-1">{statusCounts.scheduled}</p>
            <span className="text-[10px] text-black/40 uppercase font-bold tracking-widest truncate">Scheduled</span>
          </div>
          <div className="flex flex-col px-1 min-w-0">
            <p className="text-3xl sm:text-4xl tracking-tight font-bold tabular-nums text-black mb-1">{statusCounts.upcoming}</p>
            <span className="text-[10px] text-black/40 uppercase font-bold tracking-widest truncate">Upcoming</span>
          </div>
        </div>
      </div>

      {/* Tip */}
      <div className="md:col-span-4 bg-white rounded-[1.5rem] sm:rounded-[2rem] p-5 sm:p-8 md:p-10 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] flex flex-col justify-center leading-tight">
        <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Lightbulb className="w-3 h-3" /> Smart Tip
        </p>
        <p className="text-sm text-black font-medium leading-relaxed tracking-tight">Paying more than the minimum can reduce interest faster and improve your score over time.</p>
      </div>

    </div>
  );
}
