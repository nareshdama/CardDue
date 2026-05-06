export type CardStatus = 'OVERDUE' | 'DUE_SOON' | 'UPCOMING' | 'SCHEDULED' | 'PAID' | 'AT_RISK' | 'MISSED';

export interface CreditCard {
  id: string;
  userId: string;
  name: string;
  issuer: string;
  balance: number;
  creditLimit: number;
  statementBalance: number;
  minimumPayment: number;
  dueDate: string; // ISO date string YYYY-MM-DD
  interestRate: number;
  autopayStatus: 'OFF' | 'MINIMUM' | 'STATEMENT' | 'FULL' | 'CUSTOM';
  autopayCustomAmount?: number;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Activity {
  id: string;
  userId: string;
  cardId?: string;
  type: 'PAYMENT_PAID' | 'PAYMENT_SCHEDULED' | 'BALANCE_UPDATED' | 'REMINDER_SENT' | 'TIP_VIEWED' | 'CARD_ADDED' | 'ALERT' | 'CARD_DELETED' | 'AUTOPAY_BOUNCED';
  text: string;
  date: string; // ISO date string
  amount?: number;
  createdAt: number;
  // For PAYMENT_PAID / PAYMENT_SCHEDULED: the dueDate (YYYY-MM-DD) of the
  // billing cycle this payment was made for. Lets cycle membership be an
  // exact match instead of a fuzzy date window.
  cycleDueDate?: string;
}

export type ActionRequiredType =
  | 'DUE_TOMORROW'
  | 'OVERDUE'
  | 'HIGH_UTILIZATION'
  | 'NO_BALANCE_UPDATE'
  | 'AUTOPAY_TOMORROW'
  | 'AUTOPAY_VERIFY'
  | 'AUTOPAY_AT_RISK';

export interface ActionRequired {
  id: string;
  cardId: string;
  type: ActionRequiredType;
  message: string;
}
