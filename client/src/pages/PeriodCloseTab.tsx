import { useState, useEffect } from 'react';
import axios from 'axios';
import { Lock, Unlock, Plus, X } from 'lucide-react';
import { toast } from '../components/Toast';
import { useAuthStore } from '../store';

const API_URL = '/api';

const CURRENT_YEAR = new Date().getFullYear();

export default function PeriodCloseTab() {
  const role = useAuthStore(s => s.user?.role);
  const isAdmin = role === 'admin';
  const [periods, setPeriods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [fiscalYear, setFiscalYear] = useState(CURRENT_YEAR);
  const [notes, setNotes] = useState('');

  const fetchPeriods = async () => {
    try {
      const res = await axios.get(`${API_URL}/finance/period-closes`, { withCredentials: true });
      setPeriods(res.data);
    } catch { /* empty */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPeriods(); }, []);

  const handleClose = async () => {
    if (!fiscalYear) return;
    setClosing(true);
    try {
      await axios.post(`${API_URL}/finance/period-closes`, { fiscalYear, notes }, { withCredentials: true });
      toast(`Fiscal year ${fiscalYear} closed`, 'success');
      setShowForm(false);
      setNotes('');
      fetchPeriods();
    } catch (e: any) {
      toast(e.response?.data?.error || 'Failed to close period', 'error');
    } finally {
      setClosing(false);
    }
  };

  const handleReopen = async (year: number) => {
    try {
      await axios.delete(`${API_URL}/finance/period-closes/${year}`, { withCredentials: true });
      toast(`Fiscal year ${year} reopened`, 'success');
      fetchPeriods();
    } catch (e: any) {
      toast(e.response?.data?.error || 'Failed to reopen', 'error');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-school-border overflow-hidden">
      <div className="px-5 py-4 border-b border-school-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock size={18} className="text-school-muted" />
          <h4 className="font-serif text-sm text-school-primary">Period Close</h4>
        </div>
        {isAdmin && (
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-school-primary text-white hover:bg-school-primary/90 transition-all">
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'Cancel' : 'Close Period'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="px-5 py-4 border-b border-school-border bg-amber-50/50 space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Fiscal Year</label>
            <input type="number" value={fiscalYear} onChange={e => setFiscalYear(Number(e.target.value))} className="border border-school-border rounded-lg px-3 py-1.5 text-xs w-32 focus:outline-none focus:border-school-accent" />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="border border-school-border rounded-lg px-3 py-1.5 text-xs w-full focus:outline-none focus:border-school-accent" />
          </div>
          <button onClick={handleClose} disabled={closing} className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-all">
            {closing ? 'Closing...' : `Close FY ${fiscalYear}`}
          </button>
        </div>
      )}

      <div className="divide-y divide-school-border">
        {loading ? (
          <div className="px-5 py-8 text-center text-xs text-school-muted">Loading...</div>
        ) : periods.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-school-muted">No closed periods</div>
        ) : periods.map(p => (
          <div key={p.id} className="px-5 py-3 flex items-center justify-between">
            <div>
              <span className="text-sm font-bold text-school-primary">FY {p.fiscalYear}</span>
              {p.notes && <p className="text-xs text-school-muted mt-0.5">{p.notes}</p>}
              <p className="text-[10px] text-school-muted mt-0.5">Closed: {new Date(p.closedAt).toLocaleString()}</p>
            </div>
            {isAdmin && (
              <button onClick={() => handleReopen(p.fiscalYear)} className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border border-school-border text-school-muted hover:text-emerald-600 hover:border-emerald-300 transition-all">
                <Unlock size={12} /> Reopen
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
