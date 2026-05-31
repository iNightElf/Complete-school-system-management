import React, { useState, useEffect, useMemo } from 'react';
import { useSchoolStore, useAuthStore } from '../store';
import axios from 'axios';
import { ArrowUpCircle, ArrowDownCircle, ArrowRightLeft, Clock, BarChart3, AlertTriangle, Users, Upload, Ban, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from '../components/Toast';
import FinanceReports from './FinanceReports';
import DefaulterTab from './DefaulterTab';
import FeeAssignmentTab from './FeeAssignmentTab';
import ExcelImportTab from './ExcelImportTab';

const API_URL = '/api';

const ACCOUNTS = [
  { id: 'AL_RAWA_BANK', label: 'AL RAWA English School Bank', short: 'AL RAWA Bank', color: 'from-blue-500 to-blue-600', ring: 'ring-blue-200' },
  { id: 'GLOBAL_FORUM_BANK', label: 'Global Forum Bank Account', short: 'Global Forum', color: 'from-indigo-500 to-indigo-600', ring: 'ring-indigo-200' },
  { id: 'CASH_IN_HAND', label: 'Cash in Hand', short: 'Cash', color: 'from-emerald-500 to-emerald-600', ring: 'ring-emerald-200' },
] as const;

const INCOME_CATEGORIES = ['Tuition Fee', 'Admission Fee', 'Hifz Tuition Fee', 'Hifz Admission Fee', 'Books Fee', 'Copy Fee', 'Stationary Fee', 'Accessories Fee', 'Transfer from Global Forum', 'Donation', 'Other Income'];
const EXPENSE_CATEGORIES = ['Salary', 'Rent', 'Bills', 'Supplies', 'Other Expense'];

type MainTab = 'transactions' | 'reports' | 'fee-assignment' | 'defaulter' | 'import';
type TxTab = 'income' | 'expense' | 'transfer';

const PAGE_SIZE = 25;

function Ledger({ transactions, students, fmt, fetchTransactions }: { transactions: any[]; students: any[]; fmt: (n: number) => string; fetchTransactions: () => void }) {
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
    return transactions.filter((tx: any) => {
      if (tx.isCancelled) return false;
      const d = new Date(tx.transactionDate).toISOString().split('T')[0];
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      if (typeFilter !== 'all' && tx.transactionType !== typeFilter) return false;
      return true;
    });
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
        <span className="text-[10px] text-school-muted">({filtered.length} active{cancelled.length ? `, ${cancelled.length} cancelled` : ''})</span>
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
            {paged.length > 0 ? paged.map((tx: any) => (
              <tr key={tx.id} className="hover:bg-school-paper/30 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap text-xs font-mono font-bold">{new Date(tx.transactionDate).toLocaleDateString()}</td>
                <td className="px-4 py-3 font-bold text-xs">{tx.category || 'Uncategorized'}</td>
                <td className="px-4 py-3 text-xs">{tx.student?.class || tx.className || '—'}</td>
                <td className="px-4 py-3 text-xs">{tx.student?.name || '—'}</td>
                <td className="px-4 py-3 text-[10px] text-school-muted">
                  {tx.sourceAccount ? tx.sourceAccount.replace(/_/g, ' ') : 'External'} → {tx.destinationAccount ? tx.destinationAccount.replace(/_/g, ' ') : 'External'}
                </td>
                <td className={`px-4 py-3 text-right font-bold ${tx.transactionType === 'EXPENSE' ? 'text-rose-600' : tx.transactionType === 'INCOME' ? 'text-emerald-600' : 'text-blue-600'}`}>
                  {tx.transactionType === 'EXPENSE' ? '−' : '+'} ৳{fmt(Number(tx.amount))}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded ${tx.transactionType === 'INCOME' ? 'bg-emerald-50 text-emerald-700' : tx.transactionType === 'EXPENSE' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>
                    {tx.transactionType === 'INTERNAL_TRANSFER' ? 'Transfer' : tx.transactionType}
                  </span>
                </td>
                {canWrite && (
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => setCancelId(tx.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded p-1" title="Cancel transaction">
                      <Ban size={14} />
                    </button>
                  </td>
                )}
              </tr>
            )) : (
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

      {/* Cancelled Transactions Audit Trail */}
      {cancelled.length > 0 && (
        <div className="border-t border-school-border">
          <details className="group">
            <summary className="px-5 py-3 cursor-pointer text-xs font-bold text-school-muted hover:text-school-primary flex items-center gap-2">
              <Ban size={12} /> Cancelled Transactions ({cancelled.length})
            </summary>
            <div className="px-5 pb-3">
              <table className="w-full text-xs">
                <thead className="text-[10px] uppercase text-school-muted">
                  <tr><th className="px-2 py-1 text-left">Date</th><th className="px-2 py-1 text-left">Category</th><th className="px-2 py-1 text-right">Amount</th><th className="px-2 py-1 text-left">Cancelled By</th><th className="px-2 py-1 text-left">Reason</th></tr>
                </thead>
                <tbody className="divide-y divide-school-border/50">
                  {cancelled.map((tx: any) => (
                    <tr key={tx.id} className="text-school-muted line-through">
                      <td className="px-2 py-1.5 font-mono">{new Date(tx.transactionDate).toLocaleDateString()}</td>
                      <td className="px-2 py-1.5">{tx.category || '—'}</td>
                      <td className="px-2 py-1.5 text-right">৳{fmt(Number(tx.amount))}</td>
                      <td className="px-2 py-1.5">{tx.cancelledBy || '—'} {tx.cancelledAt ? `on ${new Date(tx.cancelledAt).toLocaleDateString()}` : ''}</td>
                      <td className="px-2 py-1.5 text-school-accent">{tx.cancelReason || 'No reason'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setCancelId(null)}>
          <div className="bg-white rounded-2xl border border-school-border p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h4 className="font-serif text-sm text-school-primary">Cancel Transaction</h4>
            <p className="text-xs text-school-muted">This will mark the transaction as cancelled. It will still appear in the audit trail.</p>
            <div>
              <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Reason (optional)</label>
              <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3} placeholder="Why is this being cancelled?" className="w-full border border-school-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-school-accent resize-none" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setCancelId(null); setCancelReason(''); }} className="px-4 py-2 border border-school-border rounded-xl text-xs hover:bg-school-paper">Keep</button>
              <button onClick={handleCancel} disabled={cancelling} className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-50">
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
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = role === 'admin' || role === 'accountant';

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
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [feeMonth, setFeeMonth] = useState('');

  useEffect(() => { fetchFinance(); fetchTransactions(); fetchClasses(); fetchStudents(); }, []);

  // Compute totals from transactions
  const totalIncome = transactions
    .filter((t: any) => t.transactionType === 'INCOME' && t.destinationAccount === 'CASH_IN_HAND')
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  const totalDepositedToBank = transactions
    .filter((t: any) => t.sourceAccount === 'CASH_IN_HAND' && t.destinationAccount === 'AL_RAWA_BANK')
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  const depositRemaining = totalIncome - totalDepositedToBank;

  const resetForm = () => {
    setAmount(''); setCategory(''); setCustomCategory(''); setDesc('');
    setDate(new Date().toISOString().split('T')[0]);
    setSelectedClass(''); setSelectedStudent(''); setFeeMonth('');
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
        destination = 'CASH_IN_HAND';
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
    } catch {
      toast('Failed to save transaction', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getTxIcon = (type: string) => {
    if (type === 'INCOME') return <ArrowUpCircle className="text-emerald-500" size={18} />;
    if (type === 'EXPENSE') return <ArrowDownCircle className="text-rose-500" size={18} />;
    return <ArrowRightLeft className="text-blue-500" size={18} />;
  };

  const fmt = (n: number) => n.toLocaleString('en-BD', { minimumFractionDigits: 0 });

  return (
    <div className="space-y-5">
      {/* Balance Cards — 2 accounts only */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white p-5 shadow-md">
          <p className="text-[10px] uppercase font-bold tracking-widest opacity-70 mb-1">AL RAWA Bank</p>
          <h3 className="text-2xl font-serif">৳ {fmt(balances.AL_RAWA_BANK || 0)}</h3>
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
          <span className="text-lg">⚠️</span>
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
      </div>

      {mainTab === 'reports' ? <FinanceReports /> : null}
      {mainTab === 'defaulter' ? <DefaulterTab /> : null}
      {mainTab === 'fee-assignment' ? <FeeAssignmentTab /> : null}
      {mainTab === 'import' ? <ExcelImportTab /> : null}

      {mainTab === 'transactions' && (<div className="space-y-4">
          {/* Tab Bar */}
          <div className="flex gap-2">
            {([['income', '💰 Income', 'text-emerald-700 bg-emerald-50 border-emerald-200'], ['expense', '💸 Expense', 'text-rose-700 bg-rose-50 border-rose-200'], ['transfer', '🔄 Transfer', 'text-blue-700 bg-blue-50 border-blue-200']] as const).map(([key, label, active]) => (
              <button key={key} onClick={() => { setActiveTab(key); resetForm(); }}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${activeTab === key ? active + ' shadow-sm' : 'bg-white border-school-border text-school-muted hover:border-school-accent'}`}>
                {label}
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

            <button disabled={loading} className="w-full py-3 bg-school-primary text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50">
              {loading ? 'Processing...' : activeTab === 'income' ? '💰 Record Income' : activeTab === 'expense' ? '💸 Record Expense' : '🔄 Record Transfer'}
            </button>
          </form>

      {/* Ledger */}
      <Ledger transactions={transactions} students={students} fmt={fmt} fetchTransactions={fetchTransactions} />
      </div>)}

    </div>
  );
};

export default FinanceSection;
