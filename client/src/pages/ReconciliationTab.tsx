import { useState, useEffect } from 'react';
import axios from 'axios';
import { Scale, Plus, X } from 'lucide-react';
import { toast } from '../components/Toast';
import { useAuthStore } from '../store';

const API_URL = '/api';

const ACCOUNTS = ['AL_RAWA_BANK', 'GLOBAL_FORUM_BANK', 'CASH_IN_HAND'];

export default function ReconciliationTab() {
  const role = useAuthStore(s => s.user?.role);
  const isAdmin = role === 'admin';
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [account, setAccount] = useState(ACCOUNTS[0]);
  const [statementDate, setStatementDate] = useState(new Date().toISOString().split('T')[0]);
  const [closingBalance, setClosingBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRecords = async () => {
    try {
      const res = await axios.get(`${API_URL}/finance/reconciliations`, { withCredentials: true });
      setRecords(res.data);
    } catch { /* empty */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRecords(); }, []);

  const handleSubmit = async () => {
    if (!account || !statementDate || !closingBalance) return;
    setSubmitting(true);
    try {
      await axios.post(`${API_URL}/finance/reconciliations`, {
        account, statementDate, closingBalance: Number(closingBalance), notes: notes || undefined,
      }, { withCredentials: true });
      toast('Reconciliation recorded', 'success');
      setShowForm(false);
      setClosingBalance('');
      setNotes('');
      fetchRecords();
    } catch (e: any) {
      toast(e.response?.data?.error || 'Failed to record reconciliation', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-school-border overflow-hidden">
      <div className="px-5 py-4 border-b border-school-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale size={18} className="text-school-muted" />
          <h4 className="font-serif text-sm text-school-primary">Bank Reconciliation</h4>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-school-primary text-white hover:bg-school-primary/90 transition-all">
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'Cancel' : 'Record'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="px-5 py-4 border-b border-school-border bg-blue-50/50 space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Account</label>
            <select value={account} onChange={e => setAccount(e.target.value)} className="border border-school-border rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-none focus:border-school-accent">
              {ACCOUNTS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Statement Date</label>
            <input type="date" value={statementDate} onChange={e => setStatementDate(e.target.value)} className="border border-school-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-school-accent" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Closing Balance</label>
            <input type="number" step="0.01" value={closingBalance} onChange={e => setClosingBalance(e.target.value)} className="border border-school-border rounded-lg px-3 py-1.5 text-xs w-40 focus:outline-none focus:border-school-accent" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="border border-school-border rounded-lg px-3 py-1.5 text-xs w-full focus:outline-none focus:border-school-accent" />
          </div>
          <button onClick={handleSubmit} disabled={submitting} className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-all">
            {submitting ? 'Saving...' : 'Record Reconciliation'}
          </button>
        </div>
      )}

      <div className="divide-y divide-school-border">
        {loading ? (
          <div className="px-5 py-8 text-center text-xs text-school-muted">Loading...</div>
        ) : records.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-school-muted">No reconciliations recorded</div>
        ) : records.map(r => (
          <div key={r.id} className="px-5 py-3 flex items-center justify-between">
            <div>
              <span className="text-sm font-bold text-school-primary">{r.account.replace(/_/g, ' ')}</span>
              <span className="ml-2 text-xs font-bold text-school-muted">{Number(r.closingBalance).toLocaleString()} IQD</span>
              {r.notes && <p className="text-xs text-school-muted mt-0.5">{r.notes}</p>}
              <p className="text-[10px] text-school-muted mt-0.5">Statement: {new Date(r.statementDate).toLocaleDateString()} &middot; Recorded: {new Date(r.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
