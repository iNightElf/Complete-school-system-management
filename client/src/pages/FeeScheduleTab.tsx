import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSchoolStore } from '../store';
import { Plus, Save, Trash2, BookOpen } from 'lucide-react';
import { toast } from '../components/Toast';

const FREQUENCIES = ['MONTHLY', 'YEARLY', 'ONETIME'];

const FeeScheduleTab: React.FC = () => {
  const { classes, fetchClasses } = useSchoolStore();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ academicYearId: '', classId: '', category: '', amount: '', frequency: 'MONTHLY' });

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/finance/fee-schedules');
      setSchedules(res.data);
    } catch { toast('Failed to load fee schedules', 'error'); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchClasses(); load(); }, []);

  const activeYear = '2025-2026';

  // Get academicYearId — we need to fetch it or derive it
  // For now use 2025-2026 hardcoded name

  const handleCreate = async () => {
    if (!form.category || !form.amount) { toast('Category and amount required', 'error'); return; }
    // Fetch the academic year id from the name
    try {
      const yearRes = await axios.get('/api/academic-years');
      const years: any[] = yearRes.data;
      const year = years.find((y: any) => y.name === activeYear);
      if (!year) { toast('No active academic year found', 'error'); return; }
      await axios.post('/api/finance/fee-schedules', {
        academicYearId: year.id,
        classId: form.classId || null,
        category: form.category,
        amount: Number(form.amount),
        frequency: form.frequency,
      });
      toast('Fee schedule created ✓', 'success');
      setShowForm(false);
      setForm({ academicYearId: '', classId: '', category: '', amount: '', frequency: 'MONTHLY' });
      load();
    } catch { toast('Failed to create fee schedule', 'error'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`/api/finance/fee-schedules/${id}`);
      toast('Fee schedule deleted ✓', 'success');
      load();
    } catch { toast('Failed to delete', 'error'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-sm text-school-primary flex items-center gap-2"><BookOpen size={16} /> Fee Schedules</h3>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-2 bg-school-primary text-white rounded-xl text-xs font-bold">
          <Plus size={14} /> {showForm ? 'Cancel' : 'Add Schedule'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-school-border p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-school-muted block mb-1">Category</label>
              <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Tuition Fee" className="w-full border border-school-border rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-school-muted block mb-1">Class (optional)</label>
              <select value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value })} className="w-full border border-school-border rounded-xl px-3 py-2 text-sm bg-white">
                <option value="">All Classes</option>
                {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-school-muted block mb-1">Amount (৳)</label>
              <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="w-full border border-school-border rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-school-muted block mb-1">Frequency</label>
              <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} className="w-full border border-school-border rounded-xl px-3 py-2 text-sm bg-white">
                {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>
          <button onClick={handleCreate} className="flex items-center gap-1.5 px-4 py-2 bg-school-primary text-white rounded-xl text-sm font-bold">
            <Save size={14} /> Create Schedule
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-school-muted">Loading...</div>
      ) : schedules.length === 0 ? (
        <div className="bg-white rounded-2xl border border-school-border p-8 text-center text-school-muted text-sm">
          No fee schedules defined. Add one to get started.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-school-border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-school-primary text-white text-[10px] uppercase">
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-left">Class</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-left">Frequency</th>
              <th className="px-3 py-2 text-left">Year</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr></thead>
            <tbody>
              {schedules.map((s: any) => (
                <tr key={s.id} className="border-t border-school-border/50">
                  <td className="px-3 py-2 font-medium">{s.category}</td>
                  <td className="px-3 py-2 text-xs">{s.classRel?.name || 'All'}</td>
                  <td className="px-3 py-2 text-right font-bold">{Number(s.amount).toLocaleString()} /-</td>
                  <td className="px-3 py-2 text-[10px] uppercase">{s.frequency}</td>
                  <td className="px-3 py-2 text-xs">{s.academicYear?.name || '-'}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => handleDelete(s.id)} className="text-rose-600 hover:text-rose-800 p-1" title="Delete" aria-label="Delete schedule">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default FeeScheduleTab;
