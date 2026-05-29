import React, { useState, useEffect } from 'react';
import { useSchoolStore, useAuthStore } from '../store';
import axios from 'axios';
import {
  ArrowUpCircle,
  ArrowDownCircle,
  ArrowRightLeft,
  Plus,
  History,
  Clock,
  AlertCircle
} from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

const FinanceSection: React.FC = () => {
  const { balances, transactions, fetchFinance, fetchTransactions } = useSchoolStore();

  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [source, setSource] = useState('');
  const [dest, setDest] = useState('');
  const [category, setCategory] = useState('');
  const [desc, setDescription] = useState('');

  const [isEmergency, setIsEmergency] = useState(false);
  const [totalCollected, setTotalCollected] = useState('');
  const [emergencyExpense, setEmergencyExpense] = useState('');

  useEffect(() => {
    fetchFinance();
    fetchTransactions();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API_URL}/finance/transactions`, {
        date,
        amount: Number(amount),
        sourceAccount: source || undefined,
        destinationAccount: dest || undefined,
        category,
        description: desc,
        totalIncomeCollected: isEmergency ? Number(totalCollected) : undefined,
        directExpenseBeforeDeposit: isEmergency ? Number(emergencyExpense) : undefined
      }, {
        withCredentials: true
      });

      setAmount(''); setSource(''); setDest(''); setCategory(''); setDescription('');
      setIsEmergency(false); setTotalCollected(''); setEmergencyExpense('');
      setShowForm(false);
      fetchFinance();
      fetchTransactions();
    } catch (error) {
      alert('Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  const getTxIcon = (type: string) => {
    if (type === 'INCOME') return <ArrowUpCircle className="text-emerald-500" size={20} />;
    if (type === 'EXPENSE') return <ArrowDownCircle className="text-rose-500" size={20} />;
    return <ArrowRightLeft className="text-blue-500" size={20} />;
  };

  return (
    <div className="space-y-6">
      {/* Account Balances */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { id: 'AL_RAWA_BANK', label: 'AL RAWA Bank', amt: balances.AL_RAWA_BANK, color: 'border-blue-200 bg-blue-50/50' },
          { id: 'GLOBAL_FORUM_BANK', label: 'Global Forum', amt: balances.GLOBAL_FORUM_BANK, color: 'border-indigo-200 bg-indigo-50/50' },
          { id: 'CASH_IN_HAND', label: 'Cash in Hand', amt: balances.CASH_IN_HAND, color: 'border-emerald-200 bg-emerald-50/50' },
        ].map(item => (
          <div key={item.id} className={`p-5 rounded-2xl border ${item.color} shadow-sm`}>
            <p className="text-[10px] uppercase font-black tracking-widest text-school-muted mb-1">{item.label}</p>
            <h3 className="text-2xl font-serif text-school-primary">৳ {item.amt.toLocaleString()}</h3>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h4 className="font-serif text-xl text-school-primary flex items-center gap-2">
          <History size={24} className="text-school-accent" />
          Audit Trail
        </h4>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-school-primary text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-school-secondary transition-all shadow-md active:scale-95 text-sm font-bold"
        >
          {showForm ? 'Cancel' : <><Plus size={18} /> New Transaction</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl border border-school-border shadow-xl space-y-4 animate-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-school-muted ml-1">Date</label>
              <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full bg-school-paper/50 border border-school-border p-3 rounded-xl outline-none focus:ring-2 focus:ring-school-accent" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-school-muted ml-1">Amount (৳)</label>
              <input type="number" required placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-school-paper/50 border border-school-border p-3 rounded-xl outline-none focus:ring-2 focus:ring-school-accent" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-school-muted ml-1">Source Account</label>
              <select value={source} onChange={e => setSource(e.target.value)} className="w-full bg-school-paper/50 border border-school-border p-3 rounded-xl outline-none focus:ring-2 focus:ring-school-accent">
                <option value="">External / None</option>
                <option value="AL_RAWA_BANK">AL RAWA Bank</option>
                <option value="GLOBAL_FORUM_BANK">Global Forum</option>
                <option value="CASH_IN_HAND">Cash in Hand</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-school-muted ml-1">Destination Account</label>
              <select value={dest} onChange={e => setDest(e.target.value)} className="w-full bg-school-paper/50 border border-school-border p-3 rounded-xl outline-none focus:ring-2 focus:ring-school-accent">
                <option value="">External / None</option>
                <option value="AL_RAWA_BANK">AL RAWA Bank</option>
                <option value="GLOBAL_FORUM_BANK">Global Forum</option>
                <option value="CASH_IN_HAND">Cash in Hand</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="flex items-center gap-2 cursor-pointer py-2">
              <input type="checkbox" checked={isEmergency} onChange={e => setIsEmergency(e.target.checked)} className="w-4 h-4 rounded text-school-accent" />
              <span className="text-xs font-bold text-school-primary uppercase tracking-tighter">Emergency Spending Before Deposit?</span>
            </label>
            {isEmergency && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-rose-50 rounded-2xl border border-rose-100 animate-in fade-in duration-300">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-rose-400">Total Collected</label>
                  <input type="number" placeholder="e.g. 50000" value={totalCollected} onChange={e => setTotalCollected(e.target.value)} className="w-full bg-white border border-rose-200 p-2 rounded-lg text-sm" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase text-rose-400">Emergency Expense</label>
                  <input type="number" placeholder="e.g. 10000" value={emergencyExpense} onChange={e => setEmergencyExpense(e.target.value)} className="w-full bg-white border border-rose-200 p-2 rounded-lg text-sm" />
                </div>
                <p className="col-span-2 text-[10px] text-rose-500 italic">Net deposit to bank will be ৳{Number(totalCollected) - Number(emergencyExpense)}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-school-muted ml-1">Category</label>
              <input type="text" placeholder="e.g. Fees, Salary, Rent" value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-school-paper/50 border border-school-border p-3 rounded-xl outline-none focus:ring-2 focus:ring-school-accent" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase text-school-muted ml-1">Description</label>
              <input type="text" placeholder="Optional notes" value={desc} onChange={e => setDescription(e.target.value)} className="w-full bg-school-paper/50 border border-school-border p-3 rounded-xl outline-none focus:ring-2 focus:ring-school-accent" />
            </div>
          </div>

          <button disabled={loading} className="w-full bg-school-accent text-white py-4 rounded-2xl font-bold shadow-lg hover:shadow-xl active:scale-[0.99] transition-all disabled:opacity-50">
            {loading ? 'Processing...' : 'Record Transaction'}
          </button>
        </form>
      )}

      {/* Transaction List */}
      <div className="bg-white rounded-3xl border border-school-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-school-paper/50 border-b border-school-border text-school-muted text-[10px] uppercase tracking-widest font-bold">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-school-border">
              {transactions.length > 0 ? transactions.map((tx: any) => (
                <tr key={tx.id} className="hover:bg-school-paper/10 transition-colors">
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-school-muted" />
                      <span className="font-mono text-xs font-bold">{new Date(tx.transactionDate).toLocaleDateString()}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-school-paper rounded-lg">{getTxIcon(tx.transactionType)}</div>
                      <div className="min-w-0">
                        <p className="font-bold text-school-primary truncate">{tx.category || 'Uncategorized'}</p>
                        <p className="text-[10px] text-school-muted font-medium truncate">
                          {tx.sourceAccount || 'Ext'} → {tx.destinationAccount || 'Ext'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className={`px-4 py-4 text-right font-bold text-base ${tx.transactionType === 'EXPENSE' ? 'text-rose-600' : tx.transactionType === 'INCOME' ? 'text-emerald-600' : 'text-blue-600'}`}>
                    {tx.transactionType === 'EXPENSE' ? '-' : '+'} ৳{Number(tx.amount).toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="bg-school-primary/5 text-school-primary px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter">Approved</span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-school-muted italic">No transactions recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 flex gap-3 items-start">
        <AlertCircle className="text-amber-600 shrink-0" size={20} />
        <div>
          <p className="text-xs font-bold text-amber-800 uppercase tracking-tighter">Financial Notice</p>
          <p className="text-[11px] text-amber-700 leading-relaxed mt-0.5">
            Internal transfers between AL RAWA BANK and CASH IN HAND do not affect the profit/loss ledger.
            All other transactions are audited for annual reports.
          </p>
        </div>
      </div>
    </div>
  );
};

export default FinanceSection;
