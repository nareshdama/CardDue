import React, { useState } from 'react';
import { useStore } from '../hooks/useStore';
import { formatCurrency, calculateUtilization } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { Check, Calendar, Edit3, Plus, Trash2, X } from 'lucide-react';
import { CreditCard as CardType } from '../types';

type CardFormValues = {
  issuer: string;
  name: string;
  balance: string;
  creditLimit: string;
  statementBalance: string;
  minimumPayment: string;
  interestRate: string;
  dueDate: string;
};

const emptyForm = (): CardFormValues => ({
  issuer: '',
  name: '',
  balance: '',
  creditLimit: '',
  statementBalance: '',
  minimumPayment: '',
  interestRate: '',
  dueDate: format(new Date(), 'yyyy-MM-dd'),
});

const fromCard = (c: CardType): CardFormValues => ({
  issuer: c.issuer,
  name: c.name,
  balance: String(c.balance),
  creditLimit: String(c.creditLimit),
  statementBalance: String(c.statementBalance),
  minimumPayment: String(c.minimumPayment),
  interestRate: String(c.interestRate),
  dueDate: c.dueDate,
});

const toPayload = (f: CardFormValues) => ({
  issuer: f.issuer.trim(),
  name: f.name.trim(),
  balance: Number(f.balance) || 0,
  creditLimit: Number(f.creditLimit) || 0,
  statementBalance: Number(f.statementBalance) || 0,
  minimumPayment: Number(f.minimumPayment) || 0,
  interestRate: Number(f.interestRate) || 0,
  dueDate: f.dueDate || format(new Date(), 'yyyy-MM-dd'),
  autopayStatus: 'OFF' as const,
});

type CardFormProps = {
  initial: CardFormValues;
  onCancel: () => void;
  onSubmit: (values: CardFormValues) => Promise<void>;
  submitLabel: string;
};

const CardForm: React.FC<CardFormProps> = ({ initial, onCancel, onSubmit, submitLabel }) => {
  const [values, setValues] = useState<CardFormValues>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!values.issuer.trim() || !values.name.trim()) {
      setError('Issuer and Card Name are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the card. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof CardFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues(v => ({ ...v, [k]: e.target.value }));

  const inputCls = "w-full bg-black/[0.03] border border-transparent rounded-xl px-4 py-3 mt-1 text-sm font-medium focus:outline-none focus:border-black/20 focus:bg-white transition-all";

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-[2rem] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.08)] animate-in slide-in-from-top-2">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-black/40">{submitLabel}</h2>
        <button type="button" onClick={onCancel} className="text-black/40 hover:text-black"><X className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <input type="text" placeholder="Issuer (e.g. Chase)" required value={values.issuer} onChange={set('issuer')} className={`col-span-2 ${inputCls}`} />
        <input type="text" placeholder="Card Name" required value={values.name} onChange={set('name')} className={`col-span-2 ${inputCls}`} />

        <div><label className="text-[10px] uppercase font-bold text-black/40 tracking-widest px-1">Balance $</label><input type="number" step="0.01" required value={values.balance} onChange={set('balance')} className={inputCls} /></div>
        <div><label className="text-[10px] uppercase font-bold text-black/40 tracking-widest px-1">Limit $</label><input type="number" step="0.01" required value={values.creditLimit} onChange={set('creditLimit')} className={inputCls} /></div>

        <div><label className="text-[10px] uppercase font-bold text-black/40 tracking-widest px-1">Statement Bal $</label><input type="number" step="0.01" value={values.statementBalance} onChange={set('statementBalance')} className={inputCls} /></div>
        <div><label className="text-[10px] uppercase font-bold text-black/40 tracking-widest px-1">Min Pay $</label><input type="number" step="0.01" required value={values.minimumPayment} onChange={set('minimumPayment')} className={inputCls} /></div>

        <div><label className="text-[10px] uppercase font-bold text-black/40 tracking-widest px-1">Interest %</label><input type="number" step="0.01" value={values.interestRate} onChange={set('interestRate')} className={inputCls} /></div>
        <div><label className="text-[10px] uppercase font-bold text-black/40 tracking-widest px-1">Due Date</label><input type="date" required value={values.dueDate} onChange={set('dueDate')} className={inputCls} /></div>
      </div>
      {error && <p className="mt-4 text-red-500 text-[10px] font-bold uppercase tracking-widest">{error}</p>}
      <button type="submit" disabled={busy} className="w-full mt-6 bg-black text-white rounded-xl px-4 py-4 text-sm font-bold hover:bg-black/90 transition-transform active:scale-[0.98] disabled:opacity-60">
        {busy ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}

export default function CardsList() {
  const { cards, getCardStatus, markPaid, markScheduled, updateBalance, addCard, updateCard, deleteCard } = useStore();
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [actionAmount, setActionAmount] = useState<string>('');
  const [actionDate, setActionDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [balanceDraft, setBalanceDraft] = useState<string>('');
  const [balanceMode, setBalanceMode] = useState<boolean>(false);

  const handleExpand = (id: string) => {
    if (expandedCardId === id) {
      setExpandedCardId(null);
      setBalanceMode(false);
    } else {
      setExpandedCardId(id);
      setActionAmount('');
      setBalanceMode(false);
      setActionError(null);
    }
  };

  const runAction = async (label: string, fn: () => Promise<void>) => {
    setActionError(null);
    try {
      await fn();
    } catch (err) {
      setActionError(`${label} failed. ${err instanceof Error ? err.message : ''}`.trim());
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OVERDUE': return 'text-red-500';
      case 'DUE_SOON': return 'text-amber-500';
      case 'UPCOMING': return 'text-black/40';
      case 'SCHEDULED': return 'text-blue-500';
      case 'PAID': return 'text-green-500';
      default: return 'text-black/40';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between px-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-black">Cards</h1>
          <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest mt-1">{cards.length} Active</p>
        </div>
        <button
          onClick={() => { setShowAddForm(s => !s); setEditingCardId(null); }}
          className="bg-black text-white px-4 py-2 flex items-center gap-2 text-sm font-bold rounded-full hover:bg-black/80 transition-transform active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {showAddForm && (
        <CardForm
          initial={emptyForm()}
          submitLabel="Save Card"
          onCancel={() => setShowAddForm(false)}
          onSubmit={async values => {
            await addCard(toPayload(values));
            setShowAddForm(false);
          }}
        />
      )}

      {actionError && (
        <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-xs font-medium flex items-start justify-between gap-3">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="opacity-60 hover:opacity-100"><X className="w-3 h-3" /></button>
        </div>
      )}

      <div className="space-y-4">
        {cards.map(card => {
          const status = getCardStatus(card);
          const isExpanded = expandedCardId === card.id;
          const isEditing = editingCardId === card.id;

          if (isEditing) {
            return (
              <CardForm
                key={card.id}
                initial={fromCard(card)}
                submitLabel="Save Changes"
                onCancel={() => setEditingCardId(null)}
                onSubmit={async values => {
                  await updateCard(card.id, toPayload(values));
                  setEditingCardId(null);
                }}
              />
            );
          }

          return (
            <div key={card.id} className={`bg-white rounded-[2rem] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.06)] transition-all overflow-hidden ${isExpanded ? 'my-8 scale-[1.02]' : 'my-4'}`}>
              <div
                className="p-6 cursor-pointer flex items-center justify-between hover:bg-black/[0.01] transition-colors"
                onClick={() => handleExpand(card.id)}
              >
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center text-[10px] text-white font-bold tracking-widest uppercase shrink-0">
                    {card.issuer.slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-black tracking-tight leading-none mb-1.5">{card.issuer} {card.name}</h3>
                    <p className="text-[10px] text-black/40 font-bold tracking-widest uppercase">
                      Due {format(parseISO(card.dueDate), 'MMM d')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-base font-bold text-black tracking-tight leading-none mb-1.5">{formatCurrency(card.balance)}</p>
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${getStatusColor(status)}`}>
                      {status.replace('_', ' ')}
                    </p>
                  </div>
                  {status !== 'PAID' && card.minimumPayment > 0 && (
                    <button
                      title={`Quick Pay Minimum (${formatCurrency(card.minimumPayment)})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        runAction('Quick pay', () => markPaid(card.id, card.minimumPayment));
                      }}
                      className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center border-2 border-green-500/20 text-green-500 hover:bg-green-500 hover:text-white transition-all active:scale-95"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="px-6 pb-6 pt-0 animate-in slide-in-from-top-2 duration-300">
                  <div className="grid grid-cols-2 gap-y-6 gap-x-8 mb-8 mt-2 md:pl-[68px]">
                    <div>
                      <p className="text-[10px] text-black/40 uppercase tracking-widest font-bold mb-1">Due Date</p>
                      <p className="text-sm font-bold text-black">{format(parseISO(card.dueDate), 'MMM d, yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-black/40 uppercase tracking-widest font-bold mb-1">Min Payment</p>
                      <p className="text-sm font-bold text-black">{formatCurrency(card.minimumPayment)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-black/40 uppercase tracking-widest font-bold mb-1">Utilization</p>
                      <p className="text-sm font-bold text-black">{calculateUtilization(card.balance, card.creditLimit)}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-black/40 uppercase tracking-widest font-bold mb-1">Statement Bal</p>
                      <p className="text-sm font-bold text-black">{formatCurrency(card.statementBalance)}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pt-6 border-t border-black/[0.03]">
                    {balanceMode ? (
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="New balance"
                          value={balanceDraft}
                          onChange={e => setBalanceDraft(e.target.value)}
                          className="flex-1 bg-black/[0.03] border border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-black/20 focus:bg-white transition-all"
                          autoFocus
                        />
                        <button
                          onClick={() => {
                            const n = parseFloat(balanceDraft);
                            if (Number.isNaN(n) || n < 0) {
                              setActionError('Please enter a valid balance.');
                              return;
                            }
                            runAction('Update balance', async () => {
                              await updateBalance(card.id, n);
                              setBalanceDraft('');
                              setBalanceMode(false);
                            });
                          }}
                          className="bg-black text-white px-5 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-black/90 transition-transform active:scale-95"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setBalanceMode(false); setBalanceDraft(''); }}
                          className="bg-black/[0.05] text-black px-4 py-3 rounded-xl text-sm font-bold"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Amount"
                            value={actionAmount}
                            onChange={(e) => setActionAmount(e.target.value)}
                            className="sm:flex-1 w-full bg-black/[0.03] border border-transparent rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-black/20 focus:bg-white transition-all"
                          />
                          <input
                            type="date"
                            value={actionDate}
                            onChange={(e) => setActionDate(e.target.value)}
                            className="sm:w-auto w-full bg-black/[0.03] border border-transparent rounded-xl px-3 py-3 text-sm font-medium focus:outline-none focus:border-black/20 focus:bg-white transition-all"
                          />
                          <button
                            onClick={() => {
                              const n = parseFloat(actionAmount);
                              if (Number.isNaN(n) || n <= 0) {
                                setActionError('Enter an amount greater than zero.');
                                return;
                              }
                              runAction('Pay', async () => {
                                await markPaid(card.id, n);
                                setActionAmount('');
                                setExpandedCardId(null);
                              });
                            }}
                            className="bg-black text-white px-5 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-black/90 transition-transform active:scale-95"
                          >
                            <Check className="w-4 h-4" /> Pay
                          </button>
                          <button
                            onClick={() => {
                              const n = parseFloat(actionAmount);
                              if (Number.isNaN(n) || n <= 0) {
                                setActionError('Enter an amount greater than zero.');
                                return;
                              }
                              runAction('Schedule', async () => {
                                await markScheduled(card.id, n, actionDate);
                                setActionAmount('');
                                setExpandedCardId(null);
                              });
                            }}
                            className="bg-blue-500 text-white px-5 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-600 transition-transform active:scale-95"
                          >
                            <Calendar className="w-4 h-4" /> Schedule
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-2 justify-between">
                          <div className="flex gap-2">
                            <button
                              onClick={() => { setBalanceMode(true); setBalanceDraft(String(card.balance)); }}
                              className="bg-black/[0.05] text-black px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-black/[0.1] transition-colors"
                            >
                              Update Balance
                            </button>
                            <button
                              onClick={() => { setEditingCardId(card.id); setExpandedCardId(null); }}
                              className="bg-black/[0.05] text-black px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-black/[0.1] transition-colors"
                            >
                              <Edit3 className="w-3 h-3" /> Edit
                            </button>
                          </div>
                          {confirmDeleteId === card.id ? (
                            <div className="flex gap-2 items-center">
                              <span className="text-red-500 font-bold text-xs mr-1">Are you sure?</span>
                              <button
                                onClick={() =>
                                  runAction('Delete', async () => {
                                    await deleteCard(card.id);
                                    setConfirmDeleteId(null);
                                  })
                                }
                                className="bg-red-500 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-600 active:scale-95"
                              >
                                Yes
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="bg-black/10 text-black px-4 py-2 rounded-xl text-xs font-bold"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(card.id)}
                              className="text-red-500 bg-red-500/10 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-red-500 hover:text-white transition-all active:scale-95"
                            >
                              <Trash2 className="w-3 h-3" /> Remove
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
