import React, { useState, useEffect, useMemo } from 'react';
import { useSchoolStore, useAuthStore, useUserManagementStore, useUIStore } from '../store';
import axios from 'axios';
import { Clock, BarChart3, AlertTriangle, Users, Upload, Ban, ChevronLeft, ChevronRight, DollarSign, TrendingDown, RefreshCw, BookOpen } from 'lucide-react';
import { toast } from '../components/Toast';
import FinanceReports from './FinanceReports';
import DefaulterTab from './DefaulterTab';
import FeeAssignmentTab from './FeeAssignmentTab';
import ExcelImportTab from './ExcelImportTab';
import FeeScheduleTab from './FeeScheduleTab';

const API_URL = '/api';

const ACCOUNTS = [
  { id: 'AL_RAWA_BANK', label: 'AL RAWA English School Bank', short: 'AL RAWA Bank', color: 'from-blue-500 to-blue-600', ring: 'ring-blue-200' },
  { id: 'GLOBAL_FORUM_BANK', label: 'Global Forum Bank Account', short: 'Global Forum', color: 'from-indigo-500 to-indigo-600', ring: 'ring-indigo-200' },
  { id: 'CASH_IN_HAND', label: 'Cash in Hand', short: 'Cash', color: 'from-emerald-500 to-emerald-600', ring: 'ring-emerald-200' },
] as const;

const INCOME_CATEGORIES = ['Tuition Fee', 'Admission Fee', 'Hifz Tuition Fee', 'Hifz Admission Fee', 'Books Fee', 'Copy Fee', 'Stationary Fee', 'Accessories Fee', 'Transfer from Global Forum', 'Donation', 'Other Income'];
const EXPENSE_CATEGORIES = ['Salary', 'Rent', 'Bills', 'Supplies', 'Other Expense'];

type MainTab = 'transactions' | 'reports' | 'fee-assignment' | 'defaulter' | 'import' | 'fee-schedule';
type TxTab = 'income' | 'expense' | 'transfer';

const PAGE_SIZE = 25;

function Ledger({ transactions, students: _students, fmt, fetchTransactions, fetchFinance, userMap }: { transactions: any[]; students: any[]; fmt: (n: number) => string; fetchTransactions: () => void; fetchFinance: () => void; userMap: Record<string, string> }) {
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = role === 'admin' || role === 'accountant';
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const filtered = useMemo(() => {
    return transactions
      .filter((tx: any) => {
        const d = new Date(tx.transactionDate).toISOString().split('T')[0];
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        if (typeFilter !== 'all' && tx.transactionType !== typeFilter) return false;
        return true;
      })
      .sort((a: any, b: any) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime() || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [transactions, dateFrom, dateTo, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [dateFrom, dateTo, typeFilter]);

  const handleCancel = async () => {
    if (!cancelId || !canWrite) return;
    setCancelling(true);
    try {
      await axios.post(`${API_URL}/finance/transactions/${cancelId}/cancel`, { reason: cancelReason }, { withCredentials: true });
      toast('Transaction cancelled', 'success');
      setCancelId(null);
      setCancelReason('');
      fetchTransactions();
      fetchFinance();
    } catch {
      toast('Failed to cancel', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const cancelled = transactions.filter((tx: any) => tx.isCancelled);

  return (
    <div className="bg-white rounded-2xl border border-school-border overflow-hidden">
      <div className="px-5 py-4 border-b border-school-border flex items-center gap-2">
        <Clock size={18} className="text-school-muted" />
        <h4 className="font-serif text-sm text-school-primary">Ledger</h4>
        <span className="text-[10px] text-school-muted">({filtered.length} rows{cancelled.length ? `, ${cancelled.length} cancelled` : ''})</span>
      </div>

      {/* Filters */}
      <div className="px-5 py-3 border-b border-school-border flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-school-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-school-accent" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-school-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-school-accent" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Type</label>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border border-school-border rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:border-school-accent">
            <option value="all">All</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expense</option>
            <option value="INTERNAL_TRANSFER">Transfer</option>
          </select>
        </div>
        {(dateFrom || dateTo || typeFilter !== 'all') && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); setTypeFilter('all'); }} className="text-xs text-school-accent hover:underline">Clear filters</button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-school-paper/50 text-[10px] uppercase tracking-widest text-school-muted font-bold">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Class</th>
              <th className="px-4 py-3 text-left">Student</th>
              <th className="px-4 py-3 text-left">Accounts</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3 text-center">Type</th>
              {canWrite && <th className="px-4 py-3 text-center">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-school-border/50">
            {paged.length > 0 ? paged.map((tx: any) => {
              const isCancelled = tx.isCancelled;
              const isReversal = !!tx.reversalOfId;
              return (
              <tr key={tx.id} className={`border-t border-school-border/50 transition-colors ${isCancelled ? 'bg-gray-50 line-through opacity-60' : isReversal ? 'bg-violet-50/50 border-l-2 border-l-violet-400' : 'hover:bg-school-paper/30'}`}>
                <td className="px-4 py-3 whitespace-nowrap text-xs font-mono font-bold">
                  {new Date(tx.transactionDate).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 font-bold text-xs">
                  {tx.category || 'Uncategorized'}
                  {isCancelled && <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-red-100 text-red-600 line-through-none">CANCELLED</span>}
                  {isReversal && <span className="ml-2 inline-block px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-violet-100 text-violet-700">REVERSAL</span>}
                </td>
                <td className="px-4 py-3 text-xs">{tx.student?.class || tx.className || '—'}</td>
                <td className="px-4 py-3 text-xs">{tx.student?.name || '—'}</td>
                <td className="px-4 py-3 text-[10px] text-school-muted">
                  {tx.sourceAccount ? tx.sourceAccount.replace(/_/g, ' ') : 'External'} → {tx.destinationAccount ? tx.destinationAccount.replace(/_/g, ' ') : 'External'}
                </td>
                <td className={`px-4 py-3 text-right font-bold ${isCancelled ? 'text-gray-400' : isReversal ? 'text-violet-600' : tx.transactionType === 'EXPENSE' ? 'text-rose-600' : tx.transactionType === 'INCOME' ? 'text-emerald-600' : 'text-blue-600'}`}>
                  {tx.transactionType === 'EXPENSE' ? '−' : '+'} ৳{fmt(Number(tx.amount))}
                </td>
                <td className="px-4 py-3 text-center">
                  {isReversal ? (
                    <span className="text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded bg-violet-50 text-violet-700">
                      Reversal
                    </span>
                  ) : (
                    <span className={`text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded ${tx.transactionType === 'INCOME' ? 'bg-emerald-50 text-emerald-700' : tx.transactionType === 'EXPENSE' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>
                      {tx.transactionType === 'INTERNAL_TRANSFER' ? 'Transfer' : tx.transactionType}
                    </span>
                  )}
                </td>
                {canWrite && (
                  <td className="px-4 py-3 text-center">
                    {isCancelled ? (
                      <span className="text-[9px] text-school-muted" title={`Cancelled by ${userMap[tx.cancelledBy] || tx.cancelledBy} on ${tx.cancelledAt ? new Date(tx.cancelledAt).toLocaleDateString() : ''}: ${tx.cancelReason || 'No reason'}`}>
                        {userMap[tx.cancelledBy] || tx.cancelledBy || 'system'}
                      </span>
                    ) : isReversal ? (
                      <span className="text-[9px] text-violet-500">auto</span>
                    ) : (
                      <button onClick={() => setCancelId(tx.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded p-1" title="Cancel transaction">
                        <Ban size={14} />
                      </button>
                    )}
                  </td>
                )}
              </tr>
              );
            }) : (
              <tr><td colSpan={canWrite ? 8 : 7} className="px-4 py-12 text-center text-sm text-school-muted italic">
                {transactions.length ? 'No transactions match filters.' : 'No transactions yet.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-5 py-3 border-t border-school-border flex items-center justify-between">
          <span className="text-xs text-school-muted">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-school-border hover:bg-school-paper disabled:opacity-30">
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-bold">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border border-school-border hover:bg-school-paper disabled:opacity-30">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setCancelId(null)}>
          <div className="bg-white rounded-2xl border border-school-border p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h4 className="font-serif text-sm text-school-primary">Cancel Transaction</h4>
            <p className="text-xs text-school-muted">This will cancel the transaction and return the money to the original account. The cancelled row will remain in the ledger with a strikethrough.</p>
            <div>
              <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Reason (required)</label>
              <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3} required placeholder="Why is this being cancelled?" className="w-full border border-school-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-school-accent resize-none" />
              {!cancelReason.trim() && <p className="text-[10px] text-red-500 mt-1">Reason is required to cancel a transaction</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setCancelId(null); setCancelReason(''); }} className="px-4 py-2 border border-school-border rounded-xl text-xs hover:bg-school-paper">Keep</button>
              <button onClick={handleCancel} disabled={cancelling || !cancelReason.trim()} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-50">
                {cancelling ? 'Cancelling...' : 'Cancel Transaction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const FinanceSection: React.FC = () => {
  const { balances, transactions, fetchFinance, fetchTransactions, classes, students, fetchClasses, fetchStudents } = useSchoolStore();
  const { users, fetchUsers } = useUserManagementStore();
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = role === 'admin' || role === 'accountant';

  const userMap = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach((u: any) => { map[u.id] = u.name; });
    return map;
  }, [users]);

  const [mainTab, setMainTab] = useState<MainTab>('transactions');
  const [activeTab, setActiveTab] = useState<TxTab>('income');
  const [loading, setLoading] = useState(false);

  // Form state
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [desc, setDesc] = useState('');
  const [sourceAccount, setSourceAccount] = useState('AL_RAWA_BANK');
  const [transferTo, setTransferTo] = useState('AL_RAWA_BANK');
  const [depositTo, setDepositTo] = useState('CASH_IN_HAND');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [feeMonth, setFeeMonth] = useState('');

  useEffect(() => { fetchFinance(); fetchTransactions(); fetchClasses(); fetchStudents(); fetchUsers(); }, []);
  useEffect(() => { useUIStore.getState().registerSwipeBack(() => setMainTab('transactions')); }, []);

  // Compute totals from transactions (exclude cancelled)
  const activeTransactions = transactions.filter((t: any) => !t.isCancelled);

  const totalIncome = activeTransactions
    .filter((t: any) => t.transactionType === 'INCOME' && t.destinationAccount === 'CASH_IN_HAND')
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  const totalDepositedToBank = activeTransactions
    .filter((t: any) => t.sourceAccount === 'CASH_IN_HAND' && t.destinationAccount === 'AL_RAWA_BANK')
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  const depositRemaining = totalIncome - totalDepositedToBank;

  const resetForm = () => {
    setAmount(''); setCategory(''); setCustomCategory(''); setDesc('');
    setDate(new Date().toISOString().split('T')[0]);
    setSelectedClass(''); setSelectedStudent(''); setFeeMonth('');
    setDepositTo('CASH_IN_HAND');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let source: string | undefined;
      let destination: string | undefined;
      const finalCategory = customCategory || category;

      if (activeTab === 'income') {
        source = undefined; // external
        destination = depositTo;
      } else if (activeTab === 'expense') {
        source = sourceAccount;
        destination = undefined; // external
      } else {
        source = sourceAccount;
        destination = transferTo;
      }

      await axios.post(`${API_URL}/finance/transactions`, {
        date,
        amount: Number(amount),
        sourceAccount: source,
        destinationAccount: destination,
        category: finalCategory,
        description: desc,
        studentId: selectedStudent || undefined,
        className: selectedClass || undefined,
        feeMonth: feeMonth || undefined,
      }, { withCredentials: true });

      toast(activeTab === 'income' ? 'Income recorded ✓' : activeTab === 'expense' ? 'Expense recorded ✓' : 'Transfer recorded ✓', 'success');
      resetForm();
      fetchFinance();
      fetchTransactions();
    } catch (err: any) {
      const msg = err?.response?.data?.error;
      toast(msg || 'Failed to save transaction', 'error');
    } finally {
      setLoading(false);
    }
  };



  const fmt = (n: number) => n.toLocaleString('en-BD', { minimumFractionDigits: 0 });

  return (
    <div className="space-y-5">
      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white p-5 shadow-md">
          <p className="text-[10px] uppercase font-bold tracking-widest opacity-70 mb-1">AL RAWA Bank</p>
          <h3 className="text-2xl font-serif">৳ {fmt(balances.AL_RAWA_BANK || 0)}</h3>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-5 shadow-md">
          <p className="text-[10px] uppercase font-bold tracking-widest opacity-70 mb-1">Global Forum</p>
          <h3 className="text-2xl font-serif">৳ {fmt(balances.GLOBAL_FORUM_BANK || 0)}</h3>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-5 shadow-md">
          <p className="text-[10px] uppercase font-bold tracking-widest opacity-70 mb-1">Cash in Hand</p>
          <h3 className="text-2xl font-serif">৳ {fmt(balances.CASH_IN_HAND || 0)}</h3>
        </div>
      </div>

      {/* Target & Deposit Remaining */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-school-border p-4">
          <p className="text-[10px] uppercase font-bold tracking-widest text-school-muted mb-1">Target Deposit (Total Income)</p>
          <h3 className="text-xl font-serif text-school-primary">৳ {fmt(totalIncome)}</h3>
        </div>
        <div className="bg-white rounded-2xl border border-school-border p-4">
          <p className="text-[10px] uppercase font-bold tracking-widest text-school-muted mb-1">Deposit Remaining</p>
          <h3 className={`text-xl font-serif ${depositRemaining > 0 ? 'text-red-600' : 'text-emerald-600'}`}>৳ {fmt(depositRemaining)}</h3>
        </div>
      </div>

      {/* Deposit Alert */}
      {depositRemaining > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            <strong>৳ {fmt(depositRemaining)}</strong> still in Cash in Hand waiting to be deposited to AL RAWA Bank.
          </p>
        </div>
      )}

      {/* Main Tab Bar */}
      <div className="flex gap-2">
        <button onClick={() => setMainTab('transactions')} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${mainTab === 'transactions' ? 'bg-school-primary text-white border-school-primary shadow-sm' : 'bg-white border-school-border text-school-muted hover:border-school-accent'}`}>
          <Clock size={14} /> Transactions
        </button>
        <button onClick={() => setMainTab('reports')} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${mainTab === 'reports' ? 'bg-school-primary text-white border-school-primary shadow-sm' : 'bg-white border-school-border text-school-muted hover:border-school-accent'}`}>
          <BarChart3 size={14} /> Reports
        </button>
        <button onClick={() => setMainTab('defaulter')} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${mainTab === 'defaulter' ? 'bg-school-primary text-white border-school-primary shadow-sm' : 'bg-white border-school-border text-school-muted hover:border-school-accent'}`}>
          <AlertTriangle size={14} /> Defaulter
        </button>
        <button onClick={() => setMainTab('fee-assignment')} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${mainTab === 'fee-assignment' ? 'bg-school-primary text-white border-school-primary shadow-sm' : 'bg-white border-school-border text-school-muted hover:border-school-accent'}`}>
          <Users size={14} /> Fee Assignment
        </button>
        {canWrite && <button onClick={() => setMainTab('import')} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${mainTab === 'import' ? 'bg-school-primary text-white border-school-primary shadow-sm' : 'bg-white border-school-border text-school-muted hover:border-school-accent'}`}>
          <Upload size={14} /> Import Excel
        </button>}
        <button onClick={() => setMainTab('fee-schedule')} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${mainTab === 'fee-schedule' ? 'bg-school-primary text-white border-school-primary shadow-sm' : 'bg-white border-school-border text-school-muted hover:border-school-accent'}`}>
          <BookOpen size={14} /> Fee Schedules
        </button>
      </div>

      {mainTab === 'reports' ? <FinanceReports /> : null}
      {mainTab === 'defaulter' ? <DefaulterTab /> : null}
      {mainTab === 'fee-assignment' ? <FeeAssignmentTab /> : null}
      {mainTab === 'import' ? <ExcelImportTab /> : null}
      {mainTab === 'fee-schedule' ? <FeeScheduleTab /> : null}

      {mainTab === 'transactions' && (<div className="space-y-4">
          {/* Tab Bar */}
          <div className="flex gap-2">
            {[
              { k: 'income', lbl: <><DollarSign size={14} /> Income</>, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
              { k: 'expense', lbl: <><TrendingDown size={14} /> Expense</>, cls: 'text-rose-700 bg-rose-50 border-rose-200' },
              { k: 'transfer', lbl: <><RefreshCw size={14} /> Transfer</>, cls: 'text-blue-700 bg-blue-50 border-blue-200' },
            ].map(({ k, lbl, cls }) => (
              <button key={k} onClick={() => { setActiveTab(k as TxTab); resetForm(); }}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-all flex items-center gap-1.5 ${activeTab === k ? cls + ' shadow-sm' : 'bg-white border-school-border text-school-muted hover:border-school-accent'}`}>
                {lbl}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-school-border p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Date</label>
                <input type="date" required value={date} onChange={e => setDate(e.target.value)}
                  className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Amount (৳)</label>
                <input type="number" required min="1" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)}
                  className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent" />
              </div>
            </div>

            {activeTab === 'income' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Category</label>
                    <select value={category} onChange={e => setCategory(e.target.value)}
                      className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent bg-white">
                      <option value="">Select...</option>
                      {INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Deposit To</label>
                    <select value={depositTo} onChange={e => setDepositTo(e.target.value)}
                      className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent bg-white">
                      <option value="CASH_IN_HAND">Cash in Hand</option>
                      <option value="AL_RAWA_BANK">AL RAWA Bank</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Class (optional)</label>
                    <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedStudent(''); }}
                      className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent bg-white">
                      <option value="">None</option>
                      {classes.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                {selectedClass && (
                  <div>
                    <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Student (optional)</label>
                    <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}
                      className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent bg-white">
                      <option value="">Select student...</option>
                      {students.filter((s: any) => s.class === selectedClass).map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name}{s.fatherName ? ` (${s.fatherName})` : ''}{s.roll ? ` - Roll ${s.roll}` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}
                {(category === 'Tuition Fee' || category === 'Hifz Tuition Fee') && (
                  <div>
                    <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Fee for Month</label>
                    <input type="month" value={feeMonth} onChange={e => setFeeMonth(e.target.value)}
                      className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent" />
                  </div>
                )}
              </div>
            )}

            {activeTab === 'expense' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Pay From</label>
                  <select value={sourceAccount} onChange={e => setSourceAccount(e.target.value)}
                    className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent bg-white">
                    <option value="AL_RAWA_BANK">AL RAWA English School Bank</option>
                    <option value="CASH_IN_HAND">Cash in Hand</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent bg-white">
                    <option value="">Select...</option>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'transfer' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">From</label>
                  <select value={sourceAccount} onChange={e => setSourceAccount(e.target.value)}
                    className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent bg-white">
                    {ACCOUNTS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">To</label>
                  <select value={transferTo} onChange={e => setTransferTo(e.target.value)}
                    className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent bg-white">
                    {ACCOUNTS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            {category && !customCategory && (
              <div>
                <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Or type custom category</label>
                <input type="text" placeholder="Custom category..." value={customCategory} onChange={e => setCustomCategory(e.target.value)}
                  className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent" />
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Description (optional)</label>
              <input type="text" placeholder="Notes..." value={desc} onChange={e => setDesc(e.target.value)}
                className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent" />
            </div>

            <button disabled={loading} className="w-full py-3 bg-school-primary text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
              {loading ? 'Processing...' : activeTab === 'income' ? <><DollarSign size={16} /> Record Income</> : activeTab === 'expense' ? <><TrendingDown size={16} /> Record Expense</> : <><RefreshCw size={16} /> Record Transfer</>}
            </button>
          </form>

      {/* Ledger */}
      <Ledger transactions={transactions} students={students} fmt={fmt} fetchTransactions={fetchTransactions} fetchFinance={fetchFinance} userMap={userMap} />
      </div>)}

    </div>
  );
};

export default FinanceSection;
