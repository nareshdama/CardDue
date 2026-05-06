import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { addMonths, formatISO, parseISO } from 'date-fns';
import type { CreditCard } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format numbers as currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

// Calculate utilization
export function calculateUtilization(balance: number, limit: number): number {
  if (limit === 0) return 0;
  return Math.round((balance / limit) * 100);
}

// The effective dueDate for the cycle the card is currently in. The stored
// card.dueDate is the day-of-month anchor; we roll it forward by whole
// months until it isn't in the past, so display and cycle math stay in sync
// without mutating storage on every payment.
export function effectiveDueDate(card: Pick<CreditCard, 'dueDate'>): string {
  let d = parseISO(card.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  while (d.getTime() < today.getTime()) {
    d = addMonths(d, 1);
  }
  return formatISO(d, { representation: 'date' });
}
