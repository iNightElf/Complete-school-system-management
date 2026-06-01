import { useState, useEffect, useMemo, useCallback } from 'react';
import type { ReactNode, FormEvent } from 'react';
import { useSchoolStore, useAuthStore, useUserManagementStore, useUIStore } from '../store';
import axios from 'axios';
import { Clock, BarChart3, AlertTriangle, Users, Upload, Ban, ChevronLeft, ChevronRight, DollarSign, TrendingDown, RefreshCw, BookOpen, Shield, Lock, Scale } from 'lucide-react';
import { toast } from '../components/Toast';
import FinanceReports from './FinanceReports';
import DefaulterTab from './DefaulterTab';
import OptionalFeesTab from './OptionalFeesTab';
import ExcelImportTab from './ExcelImportTab';
import FeeScheduleTab from './FeeScheduleTab';
import StudentWaiversTab from './StudentWaiversTab';
import PeriodCloseTab from './PeriodCloseTab';
import ReconciliationTab from './ReconciliationTab';
import { API_URL } from '../lib/config';

const ACCOUNTS = [
  { id: 'AL_RAWA_BANK', label: 'AL RAWA English School Bank', short: 'AL RAWA Bank', color: 'from-blue-500 to-blue-600', ring: 'ring-blue-200' },
  { id: 'GLOBAL_FORUM_BANK', label: 'Global Forum Bank Account', short: 'Global Forum', color: 'from-indigo-500 to-indigo-600', ring: 'ring-indigo-200' },
  { id: 'CASH_IN_HAND', label: 'Cash in Hand', short: 'Cash', color: 'from-emerald-500 to-emerald-600', ring: 'ring-emerald-200' },
] as const;



type MainTab = 'transactions' | 'reports' | 'optional-fees' | 'defaulter' | 'fee-schedule' | 'waivers' | 'period-close' | 'reconciliation';
type TxTab = 'income' | 'expense' | 'transfer' | 'import';

const PAGE_SIZE = 25;

const ACCOUNTS_LEDGER = [
  { id: 'CASH_IN_HAND' as const, label: 'Cash in Hand', short: 'Cash', color: 'bg-emerald-500' },
  { id: 'AL_RAWA_BANK' as const, label: 'AL RAWA Bank', short: 'Bank', color: 'bg-blue-500' },
];

function Ledger({ fmt, fetchFinance, userMap }: { fmt: (n: number) => string; fetchFinance: () => void; userMap: Record<string, string> }) {
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = role === 'admin' || role === 'accountant';
  const [ledgerAccount, setLedgerAccount] = useState<'AL_RAWA_BANK' | 'CASH_IN_HAND'>('CASH_IN_HAND');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [totalDebits, setTotalDebits] = useState(0);
  const [totalCredits, setTotalCredits] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { account: ledgerAccount };
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      params.page = String(p);
      params.limit = String(PAGE_SIZE);
      const res = await axios.get('/api/finance/ledger', { params, withCredentials: true });
      if (res.data?.data) {
        setData(res.data.data);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
        setOpeningBalance(res.data.openingBalance);
        setClosingBalance(res.data.closingBalance);
        setTotalDebits(res.data.totalDebits);
        setTotalCredits(res.data.totalCredits);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [ledgerAccount, dateFrom, dateTo]);

  useEffect(() => { setPage(1); fetchData(1); }, [ledgerAccount, dateFrom, dateTo]);
  useEffect(() => { fetchData(page); }, [page, fetchData]);

  const handleCancel = async () => {
    if (!cancelId || !canWrite) return;
    setCancelling(true);
    try {
      await axios.post(`${API_URL}/finance/transactions/${cancelId}/cancel`, { reason: cancelReason }, { withCredentials: true });
      toast('Transaction cancelled', 'success');
      setCancelId(null);
      setCancelReason('');
      fetchData(page);
      fetchFinance();
    } catch {
      toast('Failed to cancel', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const params: Record<string, string> = { account: ledgerAccount };
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await axios.get('/api/finance/ledger', { params, withCredentials: true });
      const allEntries = res.data?.data || [];
      const { pdfLedger } = await import('../lib/financeReportPdf');
      pdfLedger(allEntries, ledgerAccount, dateFrom, dateTo, res.data.openingBalance, res.data.closingBalance);
      toast('PDF downloaded ✓', 'success');
    } catch { toast('PDF generation failed', 'error'); }
  };

  const handlePrint = async () => {
    try {
      const params: Record<string, string> = { account: ledgerAccount };
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const res = await axios.get('/api/finance/ledger', { params, withCredentials: true });
      const allEntries = res.data?.data || [];
      const { buildLedgerPrintHtml } = await import('../lib/financeReportPdf');
      const html = buildLedgerPrintHtml(allEntries, ledgerAccount, dateFrom, dateTo, res.data.openingBalance, res.data.closingBalance, fmt);
      const w = window.open('', '_blank');
      if (!w) { toast('Please allow pop-ups for printing', 'error'); return; }
      w.document.write(html);
      w.document.close();
      w.print();
    } catch { toast('Print failed', 'error'); }
  };

  const accLabel = ACCOUNTS_LEDGER.find(a => a.id === ledgerAccount)?.label || ledgerAccount;

  return (
    <div className="bg-white rounded-xl border border-school-border overflow-hidden">
      <div className="px-5 py-4 border-b border-school-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-school-muted" />
          <h4 className="font-serif text-sm text-school-primary">{accLabel} Ledger</h4>
          {!loading && <span className="text-[10px] text-school-muted">({total} rows{totalPages > 1 ? `, p.${page}/${totalPages}` : ''})</span>}
          {loading && <span className="text-[10px] text-school-muted animate-pulse">Loading...</span>}
        </div>
        <div className="flex gap-1 bg-school-paper/50 rounded-lg p-0.5">
          {ACCOUNTS_LEDGER.map(a => (
            <button key={a.id} onClick={() => setLedgerAccount(a.id)}
              className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all ${ledgerAccount === a.id ? 'bg-white shadow-sm text-school-primary' : 'text-school-muted hover:text-school-primary'}`}>
              {a.short}
            </button>
          ))}
        </div>
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
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-school-accent hover:underline">Clear</button>
        )}
        <div className="flex-1" />
        <button onClick={handleDownloadPdf} disabled={loading} className="px-3 py-1.5 border border-school-border rounded-lg text-[10px] font-bold uppercase tracking-wider text-school-primary hover:bg-school-paper disabled:opacity-40 flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          PDF
        </button>
        <button onClick={handlePrint} disabled={loading} className="px-3 py-1.5 border border-school-border rounded-lg text-[10px] font-bold uppercase tracking-wider text-school-primary hover:bg-school-paper disabled:opacity-40 flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-school-paper/50 text-[10px] uppercase tracking-widest text-school-muted font-bold">
            <tr>
              <th className="px-4 py-3 text-left w-[110px]">Date</th>
              <th className="px-4 py-3 text-left w-[60px]">Type</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-right w-[100px]">Debit (৳)</th>
              <th className="px-4 py-3 text-right w-[100px]">Credit (৳)</th>
              <th className="px-4 py-3 text-right w-[110px]">Balance (৳)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-school-border/50">
            <tr className="bg-school-paper/30 text-xs font-bold text-school-muted">
              <td className="px-4 py-2" colSpan={3}>Opening Balance</td>
              <td className="px-4 py-2 text-right" colSpan={3}>{fmt(openingBalance)}</td>
            </tr>
            {data.length > 0 ? data.map((entry: any) => (
              <tr key={entry.id} className="hover:bg-school-paper/30 text-xs">
                <td className="px-4 py-2.5 whitespace-nowrap font-mono font-bold">{new Date(entry.date).toLocaleDateString()}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${entry.transactionType === 'INCOME' ? 'bg-emerald-50 text-emerald-700' : entry.transactionType === 'EXPENSE' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'}`}>
                    {entry.transactionType === 'INTERNAL_TRANSFER' ? 'Transfer' : entry.transactionType}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-school-muted max-w-[200px] truncate">{entry.description}</td>
                <td className="px-4 py-2.5 text-right font-bold text-emerald-600">{entry.debit ? fmt(entry.debit) : '—'}</td>
                <td className="px-4 py-2.5 text-right font-bold text-rose-600">{entry.credit ? fmt(entry.credit) : '—'}</td>
                <td className="px-4 py-2.5 text-right font-bold font-mono">{fmt(entry.runningBalance)}</td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-school-muted italic">
                {loading ? 'Loading...' : total > 0 ? 'No entries match filters.' : 'No entries yet.'}
              </td></tr>
            )}
            <tr className="bg-school-primary/5 text-xs font-bold border-t-2 border-school-primary/20">
              <td className="px-4 py-2.5" colSpan={3}>
                <span className="text-school-muted font-normal">Total Dr:</span> {fmt(totalDebits)}
                <span className="mx-2 text-school-muted">│</span>
                <span className="text-school-muted font-normal">Total Cr:</span> {fmt(totalCredits)}
              </td>
              <td className="px-4 py-2.5 text-right font-bold text-school-primary">{fmt(closingBalance)}</td>
              <td className="px-4 py-2.5 text-right text-[9px] text-school-muted">Closing</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-5 py-3 border-t border-school-border flex items-center justify-between">
          <span className="text-xs text-school-muted">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg border border-school-border hover:bg-school-paper disabled:opacity-30" aria-label="Previous page">
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-bold">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg border border-school-border hover:bg-school-paper disabled:opacity-30" aria-label="Next page">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setCancelId(null)}>
          <div className="bg-white rounded-xl border border-school-border p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
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

const FinanceSection = () => {
  const { balances, transactions, fetchFinance, fetchTransactions, classes, students, fetchClasses, fetchStudents } = useSchoolStore();
  const { users, fetchUsers } = useUserManagementStore();
  const role = useAuthStore((s) => s.user?.role);
  const canWrite = role === 'admin' || role === 'accountant';

  useEffect(() => { document.title = 'Finance - AL RAWA English School'; }, []);

  const userMap = useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach((u: any) => { map[u.id] = u.name; });
    return map;
  }, [users]);

  const [mainTab, setMainTab] = useState<MainTab>('transactions');
  const [activeTab, setActiveTab] = useState<TxTab>('income');
  const [loading, setLoading] = useState(false);
  const [feeSchedules, setFeeSchedules] = useState<any[]>([]);
  const [assignedStudentIds, setAssignedStudentIds] = useState<string[] | null>(null);

  useEffect(() => {
    axios.get('/api/finance/fee-schedules', { withCredentials: true }).then(res => {
      setFeeSchedules(res.data);
    }).catch(() => {});
    axios.get('/api/categories?type=EXPENSE').then(res => {
      setExpenseCategories(res.data.map((c: any) => c.name));
    }).catch(() => {});
  }, []);

  // Form state
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [desc, setDesc] = useState('');
  const [sourceAccount, setSourceAccount] = useState('AL_RAWA_BANK');
  const [transferTo, setTransferTo] = useState('AL_RAWA_BANK');
  const [depositTo, setDepositTo] = useState('CASH_IN_HAND');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [feeMonth, setFeeMonth] = useState('');
  const [expenseCategories, setExpenseCategories] = useState<string[]>([]);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [selectedFeeScheduleId, setSelectedFeeScheduleId] = useState('');

  const matchedSchedule = selectedFeeScheduleId
    ? feeSchedules.find((f: any) => f.id === selectedFeeScheduleId)
    : feeSchedules.find((f: any) => f.category === category && (!f.classId || f.classRel?.name === selectedClass));
  const isMonthlyFee = matchedSchedule?.frequency === 'MONTHLY';

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchFinance(); fetchTransactions(); fetchClasses(); fetchStudents(); fetchUsers(); }, []);
  useEffect(() => { useUIStore.getState().registerSwipeBack(() => setMainTab('transactions')); }, []);
  // Re-fetch students when class changes (ensures student data is current)
  useEffect(() => { if (selectedClass) fetchStudents(); }, [selectedClass]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill amount from fee schedule minus waiver when category + student selected
  useEffect(() => {
    if (!category || category === 'Other Fee' || !selectedStudent || !selectedClass) {
      return;
    }
    const sched = feeSchedules.find((fs: any) => fs.category === category && (!fs.classId || fs.classRel?.name === selectedClass));
    if (!sched) return;
    axios.get(`/api/finance/fee-waivers`, { params: { studentId: selectedStudent, feeScheduleId: sched.id, active: 'true' }, withCredentials: true })
      .then(res => {
        const waiver = res.data?.[0];
        const amount = waiver ? Number(waiver.value) : Number(sched.amount);
        setAmount(String(amount));
      })
      .catch(() => {});
  }, [category, selectedStudent, selectedClass, feeSchedules]);

  // When category or class changes, determine if ASSIGNED_ONLY and fetch assignments
  useEffect(() => {
    if (!category || category === 'Other Fee' || !selectedClass) {
      setAssignedStudentIds(null);
      return;
    }
    const sched = feeSchedules.find((fs: any) => fs.category === category && (!fs.classId || fs.classRel?.name === selectedClass));
    if (sched?.applicability === 'ASSIGNED_ONLY') {
      axios.get(`/api/finance/student-fee-assignments`, { params: { feeScheduleId: sched.id }, withCredentials: true })
        .then(res => setAssignedStudentIds(res.data.map((a: any) => a.studentId)))
        .catch(() => setAssignedStudentIds(null));
    } else {
      setAssignedStudentIds(null);
    }
  }, [category, selectedClass, feeSchedules]);

  const availableStudents = useMemo(() => {
    const classStudents = students.filter((s: any) => s.class === selectedClass);
    if (!assignedStudentIds) return classStudents;
    return classStudents.filter((s: any) => assignedStudentIds.includes(s.id));
  }, [students, selectedClass, assignedStudentIds]);

  // Clear selected student if no longer in available list
  useEffect(() => {
    if (selectedStudent && availableStudents.length > 0 && !availableStudents.some((s: any) => s.id === selectedStudent)) {
      setSelectedStudent('');
    }
  }, [availableStudents, selectedStudent]);

  // Compute totals from transactions (exclude cancelled)
  const activeTransactions = transactions.filter((t: any) => !t.isCancelled);

  const totalIncome = activeTransactions
    .filter((t: any) => t.transactionType === 'INCOME' && (t.destinationAccount === 'CASH_IN_HAND' || t.destinationAccount === 'AL_RAWA_BANK'))
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  const totalDepositedToBank = activeTransactions
    .filter((t: any) => t.sourceAccount === 'CASH_IN_HAND' && t.destinationAccount === 'AL_RAWA_BANK')
    .reduce((sum: number, t: any) => sum + Number(t.amount), 0);

  const depositRemaining = totalIncome - totalDepositedToBank;

  const resetForm = () => {
    setAmount(''); setCategory(''); setDesc('');
    setDate(new Date().toISOString().split('T')[0]);
    setSelectedClass(''); setSelectedStudent(''); setFeeMonth(''); setSelectedFeeScheduleId('');
    setDepositTo('CASH_IN_HAND');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let source: string | undefined;
      let destination: string | undefined;
      const finalCategory = category;

      if (activeTab === 'income') {
        if (!selectedClass) { toast('Class is required for income', 'error'); setLoading(false); return; }
        if (!selectedStudent) { toast('Student is required for income', 'error'); setLoading(false); return; }
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
        feeScheduleId: selectedFeeScheduleId || undefined,
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
      {/* Balance Cards — dedicated mobile card row */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide sm:grid sm:grid-cols-3 snap-x snap-mandatory scrollbar-none">
        <div className="flex-shrink-0 w-[200px] sm:w-auto snap-start rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 text-white p-4 shadow-md sm:flex-1">
          <p className="text-[9px] uppercase font-bold tracking-widest opacity-70 mb-1">AL RAWA Bank</p>
          <h3 className="text-xl sm:text-2xl font-serif">৳ {fmt(balances.AL_RAWA_BANK || 0)}</h3>
        </div>
        <div className="flex-shrink-0 w-[200px] sm:w-auto snap-start rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white p-4 shadow-md sm:flex-1">
          <p className="text-[9px] uppercase font-bold tracking-widest opacity-70 mb-1">Global Forum</p>
          <h3 className="text-xl sm:text-2xl font-serif">৳ {fmt(balances.GLOBAL_FORUM_BANK || 0)}</h3>
        </div>
        <div className="flex-shrink-0 w-[200px] sm:w-auto snap-start rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white p-4 shadow-md sm:flex-1">
          <p className="text-[9px] uppercase font-bold tracking-widest opacity-70 mb-1">Cash in Hand</p>
          <h3 className="text-xl sm:text-2xl font-serif">৳ {fmt(balances.CASH_IN_HAND || 0)}</h3>
        </div>
      </div>

      {/* Income Collected & Undeposited Income */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="bg-white rounded-xl border border-school-border p-3 sm:p-4">
          <p className="text-[9px] sm:text-[10px] uppercase font-bold tracking-widest text-school-muted mb-1">Income Collected</p>
          <h3 className="text-base sm:text-xl font-serif text-school-primary">৳ {fmt(totalIncome)}</h3>
        </div>
        <div className="bg-white rounded-xl border border-school-border p-3 sm:p-4">
          <p className="text-[9px] sm:text-[10px] uppercase font-bold tracking-widest text-school-muted mb-1">Undeposited Income</p>
          <h3 className={`text-base sm:text-xl font-serif ${depositRemaining > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>৳ {fmt(depositRemaining)}</h3>
        </div>
      </div>

      {/* Undeposited Alert */}
      {depositRemaining > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center gap-3">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            <strong>৳ {fmt(depositRemaining)}</strong> in cash not yet deposited to AL RAWA Bank.
          </p>
        </div>
      )}

      {/* Main Tab Bar */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setMainTab('transactions')} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${mainTab === 'transactions' ? 'bg-school-primary text-white border-school-primary shadow-sm' : 'bg-white border-school-border text-school-muted hover:border-school-accent'}`}>
          <Clock size={14} /> Transactions
        </button>
        <button onClick={() => setMainTab('reports')} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${mainTab === 'reports' ? 'bg-school-primary text-white border-school-primary shadow-sm' : 'bg-white border-school-border text-school-muted hover:border-school-accent'}`}>
          <BarChart3 size={14} /> Reports
        </button>
        <button onClick={() => setMainTab('defaulter')} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${mainTab === 'defaulter' ? 'bg-school-primary text-white border-school-primary shadow-sm' : 'bg-white border-school-border text-school-muted hover:border-school-accent'}`}>
          <AlertTriangle size={14} /> Defaulter
        </button>
        <button onClick={() => setMainTab('optional-fees')} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${mainTab === 'optional-fees' ? 'bg-school-primary text-white border-school-primary shadow-sm' : 'bg-white border-school-border text-school-muted hover:border-school-accent'}`}>
          <Users size={14} /> Optional Fees
        </button>
        <button onClick={() => setMainTab('fee-schedule')} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${mainTab === 'fee-schedule' ? 'bg-school-primary text-white border-school-primary shadow-sm' : 'bg-white border-school-border text-school-muted hover:border-school-accent'}`}>
          <BookOpen size={14} /> Fee Schedules
        </button>
        <button onClick={() => setMainTab('waivers')} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${mainTab === 'waivers' ? 'bg-school-primary text-white border-school-primary shadow-sm' : 'bg-white border-school-border text-school-muted hover:border-school-accent'}`}>
          <Shield size={14} /> Waivers
        </button>
        {role === 'admin' && <>
          <button onClick={() => setMainTab('period-close')} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${mainTab === 'period-close' ? 'bg-amber-600 text-white border-amber-600 shadow-sm' : 'bg-white border-school-border text-school-muted hover:border-amber-400'}`}>
            <Lock size={14} /> Period Close
          </button>
          <button onClick={() => setMainTab('reconciliation')} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${mainTab === 'reconciliation' ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white border-school-border text-school-muted hover:border-blue-400'}`}>
            <Scale size={14} /> Reconcile
          </button>
        </>}
      </div>

      {mainTab === 'reports' ? <FinanceReports /> : null}
      {mainTab === 'defaulter' ? <DefaulterTab /> : null}
      {mainTab === 'optional-fees' ? <OptionalFeesTab /> : null}
      {mainTab === 'fee-schedule' ? <FeeScheduleTab /> : null}
      {mainTab === 'waivers' ? <StudentWaiversTab /> : null}
      {mainTab === 'period-close' ? <PeriodCloseTab /> : null}
      {mainTab === 'reconciliation' ? <ReconciliationTab /> : null}

      {mainTab === 'transactions' && (<div className="space-y-4">
          {/* Tab Bar */}
          <div className="flex gap-2 flex-wrap">
            {( [
              { k: 'income' as TxTab, lbl: <><DollarSign size={14} /> Income</>, cls: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
              { k: 'expense' as TxTab, lbl: <><TrendingDown size={14} /> Expense</>, cls: 'text-rose-700 bg-rose-50 border-rose-200' },
              { k: 'transfer' as TxTab, lbl: <><RefreshCw size={14} /> Transfer</>, cls: 'text-blue-700 bg-blue-50 border-blue-200' },
              ...(canWrite ? [{ k: 'import' as TxTab, lbl: <><Upload size={14} /> Import Excel</>, cls: 'text-violet-700 bg-violet-50 border-violet-200' }] : []),
            ] as { k: TxTab; lbl: ReactNode; cls: string }[]).map(({ k, lbl, cls }) => (
              <button key={k} onClick={() => { setActiveTab(k); if (k !== 'import') resetForm(); }}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-all flex items-center gap-1.5 ${activeTab === k ? cls + ' shadow-sm' : 'bg-white border-school-border text-school-muted hover:border-school-accent'}`}>
                {lbl}
              </button>
            ))}
          </div>

          {activeTab === 'import' ? <ExcelImportTab /> : (
          <>
          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-school-border p-5 space-y-4">
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
                    <select value={category} onChange={e => { setCategory(e.target.value); setSelectedStudent(''); }}
                      className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent bg-white">
                      <option value="">Select...</option>
                      {[...new Set(feeSchedules.map((fs: any) => fs.category))].map(c => <option key={c} value={c}>{c}</option>)}
                      <option disabled>──────────</option>
                      <option value="Other Fee">Other Fee</option>
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
                    <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Class <span className="text-red-500">*</span></label>
                    <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedStudent(''); }}
                      className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent bg-white">
                      <option value="">— Select Class —</option>
                      {classes.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                {selectedClass && (
                  <div>
                    <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Student <span className="text-red-500">*</span></label>
                    <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}
                      className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent bg-white">
                      <option value="">— Select Student —</option>
                      {availableStudents.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name}{s.fatherName ? ` (${s.fatherName})` : ''}{s.roll ? ` - Roll ${s.roll}` : ''}</option>
                      ))}
                    </select>
                    {assignedStudentIds && (
                      <p className="text-[10px] text-school-muted mt-1">Only students assigned to this fee are shown.</p>
                    )}
                  </div>
                )}
                {selectedStudent && (
                  <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {isMonthlyFee && (
                      <div>
                        <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Fee for Month</label>
                        <div className="relative cursor-pointer" onClick={e => { const input = e.currentTarget.querySelector<HTMLInputElement>('input[type="month"]'); if (input) { if (typeof input.showPicker === 'function') input.showPicker(); else input.focus(); } }}>
                          <input type="month" value={feeMonth} onChange={e => setFeeMonth(e.target.value)}
                            className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent cursor-pointer" />
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Fee Schedule</label>
                      <select value={selectedFeeScheduleId} onChange={e => {
                        setSelectedFeeScheduleId(e.target.value);
                        const fs = feeSchedules.find((f: any) => f.id === e.target.value);
                        if (fs) { setCategory(fs.category); setAmount(String(fs.amount)); }
                      }}
                        className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent bg-white">
                        <option value="">Auto-detect</option>
                        {feeSchedules
                          .filter((fs: any) => !fs.classId || fs.classRel?.name === selectedClass || (selectedStudent && students.length > 0 && students.find((s: any) => s.id === selectedStudent)?.classId === fs.classId))
                          .map((fs: any) => (
                            <option key={fs.id} value={fs.id}>
                              {fs.category} ({fs.frequency}) — {Number(fs.amount).toLocaleString()} ৳
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                  </>
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
                  <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block flex items-center gap-2">
                    Category
                    <button type="button" onClick={() => setShowManageCategories(!showManageCategories)} className="text-[9px] text-blue-600 hover:text-blue-800 font-bold">
                      {showManageCategories ? 'Done' : 'Manage'}
                    </button>
                  </label>
                  <select value={category} onChange={e => setCategory(e.target.value)}
                    className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent bg-white">
                    <option value="">Select...</option>
                    {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {showManageCategories && (
                    <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-school-border space-y-2">
                      <div className="flex gap-2">
                        <input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)}
                          placeholder="New category name"
                          className="flex-1 border border-school-border rounded-lg px-3 py-1.5 text-xs" />
                        <button onClick={async () => {
                          if (!newCategoryName.trim()) return;
                          try {
                            await axios.post('/api/categories', { type: 'EXPENSE', name: newCategoryName.trim() });
                            const res = await axios.get('/api/categories?type=EXPENSE');
                            setExpenseCategories(res.data.map((c: any) => c.name));
                            setNewCategoryName('');
                            toast('Category added', 'success');
                          } catch { toast('Failed to add category', 'error'); }
                        }} className="px-3 py-1.5 bg-school-primary text-white rounded-lg text-xs font-bold">
                          Add
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {expenseCategories.map(c => (
                          <div key={c} className="flex items-center gap-1 px-2 py-1 bg-white rounded-lg border border-school-border text-[10px]">
                            <span>{c}</span>
                            <button onClick={async () => {
                              try {
                                const res = await axios.get('/api/categories?type=EXPENSE');
                                const cat = res.data.find((x: any) => x.name === c);
                                if (cat) await axios.delete(`/api/categories/${cat.id}`);
                                setExpenseCategories(expenseCategories.filter(x => x !== c));
                                toast('Category deleted', 'success');
                              } catch { toast('Failed to delete', 'error'); }
                            }} className="text-rose-500 hover:text-rose-700 ml-1" title="Delete">
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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

            <div>
              <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Description (optional)</label>
              <input type="text" placeholder="Notes..." value={desc} onChange={e => setDesc(e.target.value)}
                className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent" />
            </div>

            <button disabled={loading} className="w-full py-3 bg-school-primary text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
              {loading ? 'Processing...' : activeTab === 'income' ? <><DollarSign size={16} /> Record Income</> : activeTab === 'expense' ? <><TrendingDown size={16} /> Record Expense</> : <><RefreshCw size={16} /> Record Transfer</>}
            </button>
          </form>
          </>
          )}

      {/* Ledger */}
      <Ledger fmt={fmt} fetchFinance={fetchFinance} userMap={userMap} />
      </div>)}

    </div>
  );
};

export default FinanceSection;
