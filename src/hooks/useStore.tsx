import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { CreditCard, Activity, ActionRequired } from '../types';
import { differenceInDays, parseISO, addMonths, subMonths, formatISO } from 'date-fns';
import { calculateUtilization } from '../lib/utils';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { encryptData, decryptData } from '../lib/crypto';

interface AppState {
  cards: CreditCard[];
  activities: Activity[];
  alerts: ActionRequired[];
  decryptError: boolean;
  addCard: (card: Omit<CreditCard, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => Promise<void>;
  updateCard: (id: string, cardUpdate: Partial<CreditCard>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  markPaid: (cardId: string, amount: number) => Promise<void>;
  markScheduled: (cardId: string, amount: number, date: string) => Promise<void>;
  updateBalance: (cardId: string, newBalance: number) => Promise<void>;
  addActivity: (activity: Omit<Activity, 'id' | 'date' | 'createdAt' | 'userId'>) => Promise<void>;
  dismissAlert: (alertId: string) => void;
  getCardStatus: (card: CreditCard) => 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | 'SCHEDULED' | 'PAID';
}

const StoreContext = createContext<AppState | null>(null);

const DISMISSED_ALERTS_KEY = 'carddue-dismissed-alerts';

const newId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

// Returns the start of the current billing cycle: one month before dueDate.
// Activities within this window count as "this cycle".
function cycleStart(card: CreditCard): Date {
  return subMonths(parseISO(card.dueDate), 1);
}

function findCycleActivity(card: CreditCard, activities: Activity[], type: Activity['type']) {
  const startMs = cycleStart(card).getTime();
  return activities.find(a =>
    a.cardId === card.id &&
    a.type === type &&
    parseISO(a.date).getTime() >= startMs
  );
}

function generateAlerts(cards: CreditCard[], activities: Activity[]): ActionRequired[] {
  const alerts: ActionRequired[] = [];
  const today = new Date();

  cards.forEach(card => {
    const dueDate = parseISO(card.dueDate);
    const diffDays = differenceInDays(dueDate, today);

    const handled =
      findCycleActivity(card, activities, 'PAYMENT_PAID') ||
      findCycleActivity(card, activities, 'PAYMENT_SCHEDULED');

    if (!handled) {
      if (diffDays < 0) {
        alerts.push({
          id: `alert-overdue-${card.id}`,
          cardId: card.id,
          type: 'OVERDUE',
          message: `Action Required: Your ${card.issuer} payment is OVERDUE.`
        });
      } else if (diffDays <= 3) {
        alerts.push({
          id: `alert-due-${card.id}`,
          cardId: card.id,
          type: 'DUE_TOMORROW',
          message: `Action Required: Your ${card.issuer} payment is due ${diffDays === 0 ? 'today' : 'in ' + diffDays + ' day' + (diffDays === 1 ? '' : 's')}.`
        });
      }
    }

    const utilization = calculateUtilization(card.balance, card.creditLimit);
    if (utilization > 30) {
      alerts.push({
        id: `alert-util-${card.id}`,
        cardId: card.id,
        type: 'HIGH_UTILIZATION',
        message: `Tip: Your utilization on ${card.name} is ${utilization}%. Consider keeping it below 30% to improve your score.`
      });
    }
  });

  return alerts;
}

function decryptList<T>(rows: { payload: string }[], key: string): { items: T[]; allFailed: boolean; partialFailures: number } {
  if (rows.length === 0) return { items: [], allFailed: false, partialFailures: 0 };
  let partialFailures = 0;
  const items: T[] = [];
  for (const row of rows) {
    try {
      items.push(decryptData(row.payload, key) as T);
    } catch {
      partialFailures++;
    }
  }
  return { items, allFailed: items.length === 0, partialFailures };
}

export function StoreProvider({ children, encryptionKey, onDecryptFailure }: { children: React.ReactNode, encryptionKey: string, onDecryptFailure?: () => void }) {
  const encryptedCards = useLiveQuery(() => db.cards.toArray()) || [];
  const encryptedActivities = useLiveQuery(() => db.activities.toArray()) || [];

  const decrypted = useMemo(() => {
    const cardsResult = decryptList<CreditCard>(encryptedCards, encryptionKey);
    const activitiesResult = decryptList<Activity>(encryptedActivities, encryptionKey);
    // Sort activities by their internal (encrypted) date, newest first.
    const activities = activitiesResult.items.sort((a, b) => b.date.localeCompare(a.date));
    const totalRows = encryptedCards.length + encryptedActivities.length;
    const totalFails = cardsResult.partialFailures + activitiesResult.partialFailures;
    // Treat as a wrong-key event only when there is data and *every* row failed.
    const wholeVaultFailed = totalRows > 0 && totalFails === totalRows;
    if (cardsResult.partialFailures > 0 || activitiesResult.partialFailures > 0) {
      console.warn(`Decryption: ${totalFails}/${totalRows} record(s) unreadable.`);
    }
    return {
      cards: cardsResult.items,
      activities,
      decryptError: wholeVaultFailed,
    };
  }, [encryptedCards, encryptedActivities, encryptionKey]);

  const { cards, activities, decryptError } = decrypted;

  useEffect(() => {
    if (decryptError && onDecryptFailure) onDecryptFailure();
  }, [decryptError, onDecryptFailure]);

  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(DISMISSED_ALERTS_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });

  const alerts = useMemo(() => {
    return generateAlerts(cards, activities).filter(a => !dismissedAlerts.has(a.id));
  }, [cards, activities, dismissedAlerts]);

  // Drop dismissals whose underlying alert no longer exists, so an alert that
  // returns next cycle can show up again instead of being permanently silenced.
  useEffect(() => {
    if (dismissedAlerts.size === 0) return;
    const live = new Set(generateAlerts(cards, activities).map(a => a.id));
    let changed = false;
    const next = new Set<string>();
    dismissedAlerts.forEach(id => {
      if (live.has(id)) next.add(id);
      else changed = true;
    });
    if (changed) {
      setDismissedAlerts(next);
      localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify([...next]));
    }
  }, [cards, activities]); // eslint-disable-line react-hooks/exhaustive-deps

  const addActivity = async (activity: Omit<Activity, 'id' | 'date' | 'createdAt' | 'userId'>) => {
    const id = newId();
    const newActivity: Activity = {
      ...activity,
      id,
      date: formatISO(new Date()),
      createdAt: Date.now(),
      userId: 'local'
    };
    await db.activities.add({
      id,
      payload: encryptData(newActivity, encryptionKey),
    });
  };

  const addCard = async (card: Omit<CreditCard, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => {
    const id = newId();
    const newCard: CreditCard = {
      ...card,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      userId: 'local'
    };
    await db.cards.add({
      id,
      payload: encryptData(newCard, encryptionKey)
    });
    await addActivity({
      cardId: id,
      type: 'CARD_ADDED',
      text: `Added new card: ${card.issuer} ${card.name}`,
    });
  };

  const updateCard = async (id: string, cardUpdate: Partial<CreditCard>) => {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    const updatedCard = { ...card, ...cardUpdate, updatedAt: Date.now() };
    await db.cards.update(id, { payload: encryptData(updatedCard, encryptionKey) });
  };

  const deleteCard = async (id: string) => {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    await db.cards.delete(id);
    await addActivity({
      cardId: id,
      type: 'CARD_DELETED',
      text: `Removed card: ${card.issuer} ${card.name}`,
    });
  };

  const markPaid = async (cardId: string, amount: number) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    // Subtract the payment and roll dueDate forward one month so the next
    // cycle is tracked correctly.
    const nextDue = formatISO(addMonths(parseISO(card.dueDate), 1), { representation: 'date' });
    await updateCard(cardId, {
      balance: Math.max(0, card.balance - amount),
      dueDate: nextDue,
    });
    await addActivity({
      cardId,
      type: 'PAYMENT_PAID',
      amount,
      text: `${card.issuer} marked as paid: $${amount}`
    });
  };

  const markScheduled = async (cardId: string, amount: number, date: string) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    await addActivity({
      cardId,
      type: 'PAYMENT_SCHEDULED',
      amount,
      text: `${card.issuer} payment scheduled for ${date}`
    });
  };

  const updateBalance = async (cardId: string, newBalance: number) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    await updateCard(cardId, { balance: newBalance });
    await addActivity({
      cardId,
      type: 'BALANCE_UPDATED',
      amount: newBalance,
      text: `${card.issuer} balance updated to $${newBalance}`
    });
  };

  const dismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => {
      const next = new Set(prev);
      next.add(alertId);
      localStorage.setItem(DISMISSED_ALERTS_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const getCardStatus = (card: CreditCard) => {
    const paidThisCycle = findCycleActivity(card, activities, 'PAYMENT_PAID');
    if (paidThisCycle) return 'PAID';
    const scheduledThisCycle = findCycleActivity(card, activities, 'PAYMENT_SCHEDULED');
    if (scheduledThisCycle) return 'SCHEDULED';

    const today = new Date();
    const dueDate = parseISO(card.dueDate);
    const diffDays = differenceInDays(dueDate, today);

    if (diffDays < 0) return 'OVERDUE';
    if (diffDays <= 7) return 'DUE_SOON';
    return 'UPCOMING';
  };

  return (
    <StoreContext.Provider value={{
      cards,
      activities,
      alerts,
      decryptError,
      addCard,
      updateCard,
      deleteCard,
      markPaid,
      markScheduled,
      updateBalance,
      addActivity,
      dismissAlert,
      getCardStatus
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore must be used within StoreProvider');
  return context;
}

