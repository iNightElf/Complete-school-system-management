import { useState } from 'react';
import type { FormEvent } from 'react';
import { DollarSign, TrendingDown, RefreshCw } from 'lucide-react';

type TxTab = 'income' | 'expense' | 'transfer';

interface TransactionFormProps {
  activeTab: TxTab;
  onTabChange: (tab: TxTab) => void;
  onSubmit: (data: TransactionFormData) => Promise<void>;
  loading?: boolean;
  classes?: { id: string; name: string }[];
  students?: { id: string; name: string; class: string; fatherName?: string | null; roll?: string | null }[];
  accounts?: { id: string; label: string }[];
  expenseCategories?: string[];
  incomeCategories?: string[];
}

export interface TransactionFormData {
  date: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE' | 'INTERNAL_TRANSFER';
  category?: string;
  description?: string;
  sourceAccount?: string;
  destinationAccount?: string;
  studentId?: string;
  className?: string;
}

const DEFAULT_ACCOUNTS = [
  { id: 'AL_RAWA_BANK', label: 'AL RAWA Bank' },
  { id: 'CASH_IN_HAND', label: 'Cash in Hand' },
];

export default function TransactionForm({
  activeTab,
  onTabChange,
  onSubmit,
  loading = false,
  classes = [],
  students = [],
  accounts = DEFAULT_ACCOUNTS,
  expenseCategories = [],
  incomeCategories = [],
}: TransactionFormProps) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [desc, setDesc] = useState('');
  const [sourceAccount, setSourceAccount] = useState('AL_RAWA_BANK');
  const [transferTo, setTransferTo] = useState('AL_RAWA_BANK');
  const [depositTo, setDepositTo] = useState('CASH_IN_HAND');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!date) errs.date = 'Date is required';
    if (!amount || Number(amount) <= 0) errs.amount = 'Amount must be positive';
    if (activeTab === 'income') {
      if (!selectedClass) errs.className = 'Class is required';
      if (!selectedStudent) errs.studentId = 'Student is required';
    }
    if (activeTab === 'transfer' && sourceAccount === transferTo) {
      errs.transferTo = 'Source and destination must be different';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    await onSubmit({
      date,
      amount: Number(amount),
      type: activeTab === 'income' ? 'INCOME' : activeTab === 'expense' ? 'EXPENSE' : 'INTERNAL_TRANSFER',
      category: category || undefined,
      description: desc || undefined,
      sourceAccount: activeTab === 'expense' || activeTab === 'transfer' ? sourceAccount : undefined,
      destinationAccount: activeTab === 'income' ? depositTo : activeTab === 'transfer' ? transferTo : undefined,
      studentId: selectedStudent || undefined,
      className: selectedClass || undefined,
    });
  };

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setAmount('');
    setCategory('');
    setDesc('');
    setSelectedClass('');
    setSelectedStudent('');
    setSourceAccount('AL_RAWA_BANK');
    setTransferTo('AL_RAWA_BANK');
    setDepositTo('CASH_IN_HAND');
    setErrors({});
  };

  const handleTabChange = (tab: TxTab) => {
    resetForm();
    onTabChange(tab);
  };

  const filteredStudents = selectedClass
    ? students.filter((s) => s.class === selectedClass)
    : [];

  const tabs: { key: TxTab; label: string; icon: React.ReactNode }[] = [
    { key: 'income', label: 'Income', icon: <DollarSign size={14} /> },
    { key: 'expense', label: 'Expense', icon: <TrendingDown size={14} /> },
    { key: 'transfer', label: 'Transfer', icon: <RefreshCw size={14} /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => handleTabChange(key)}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition-all flex items-center gap-1.5 ${
              activeTab === key
                ? key === 'income'
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200 shadow-sm'
                  : key === 'expense'
                  ? 'text-rose-700 bg-rose-50 border-rose-200 shadow-sm'
                  : 'text-blue-700 bg-blue-50 border-blue-200 shadow-sm'
                : 'bg-white border-school-border text-school-muted hover:border-school-accent'
            }`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-school-border p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent"
            />
            {errors.date && <p className="text-[10px] text-red-500 mt-1">{errors.date}</p>}
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Amount (৳)</label>
            <input
              type="number"
              required
              min="1"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent"
            />
            {errors.amount && <p className="text-[10px] text-red-500 mt-1">{errors.amount}</p>}
          </div>
        </div>

        {activeTab === 'income' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Deposit To</label>
                <select value={depositTo} onChange={(e) => setDepositTo(e.target.value)}
                  className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent bg-white">
                  <option value="CASH_IN_HAND">Cash in Hand</option>
                  <option value="AL_RAWA_BANK">AL RAWA Bank</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Class <span className="text-red-500">*</span></label>
                <select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setSelectedStudent(''); }}
                  className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent bg-white">
                  <option value="">— Select Class —</option>
                  {classes.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                {errors.className && <p className="text-[10px] text-red-500 mt-1">{errors.className}</p>}
              </div>
            </div>

            {selectedClass && (
              <div>
                <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Student <span className="text-red-500">*</span></label>
                <select value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent bg-white">
                  <option value="">— Select Student —</option>
                  {filteredStudents.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}{s.roll ? ` - Roll ${s.roll}` : ''}</option>
                  ))}
                </select>
                {errors.studentId && <p className="text-[10px] text-red-500 mt-1">{errors.studentId}</p>}
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent bg-white">
                <option value="">Select...</option>
                {incomeCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}

        {activeTab === 'expense' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Pay From</label>
              <select value={sourceAccount} onChange={(e) => setSourceAccount(e.target.value)}
                className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent bg-white">
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent bg-white">
                <option value="">Select...</option>
                {expenseCategories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}

        {activeTab === 'transfer' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">From</label>
              <select value={sourceAccount} onChange={(e) => setSourceAccount(e.target.value)}
                className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent bg-white">
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">To</label>
              <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)}
                className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent bg-white">
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
              {errors.transferTo && <p className="text-[10px] text-red-500 mt-1">{errors.transferTo}</p>}
            </div>
          </div>
        )}

        <div>
          <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Description (optional)</label>
          <input type="text" placeholder="Notes..." value={desc} onChange={(e) => setDesc(e.target.value)}
            className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-school-accent" />
        </div>

        <button disabled={loading} type="submit"
          className="w-full py-3 bg-school-primary text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
          {loading ? 'Processing...' : activeTab === 'income' ? <><DollarSign size={16} /> Record Income</> : activeTab === 'expense' ? <><TrendingDown size={16} /> Record Expense</> : <><RefreshCw size={16} /> Record Transfer</>}
        </button>
      </form>
    </div>
  );
}
