import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useSchoolStore } from '../store';
import { Save, X } from 'lucide-react';
import { toast } from '../components/Toast';

const WAIVER_TYPES = [
  { value: 'FULL', label: 'Full Waiver (pays 0)' },
  { value: 'PERCENTAGE', label: 'Percentage Off (e.g. 50)' },
  { value: 'FIXED_AMOUNT', label: 'Fixed Amount Off (e.g. 300)' },
  { value: 'CUSTOM_AMOUNT', label: 'Custom Amount (pays X)' },
];

const API_URL = '/api';

const StudentWaiversTab: React.FC = () => {
  const { classes, students, fetchClasses, fetchStudents } = useSchoolStore();
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [schedules, setSchedules] = useState<any[]>([]);
  const [waivers, setWaivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => { fetchClasses(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedClass) fetchStudents({ class: selectedClass }); }, [selectedClass]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = useCallback(async () => {
    if (!selectedStudent) return;
    setLoading(true);
    try {
      const [schedRes, waiverRes, historyRes] = await Promise.all([
        axios.get(`${API_URL}/finance/fee-schedules`),
        axios.get(`${API_URL}/finance/fee-waivers`, { params: { studentId: selectedStudent } }),
        axios.get(`${API_URL}/finance/fee-waivers`, { params: { studentId: selectedStudent, active: 'false' } }),
      ]);
      setSchedules(schedRes.data);
      setWaivers(waiverRes.data);
      setHistory(historyRes.data);
    } catch { toast('Failed to load data', 'error'); }
    finally { setLoading(false); }
  }, [selectedStudent]);

  useEffect(() => { loadData(); }, [loadData]);

  const classStudents = students.filter((s: any) => !selectedClass || s.class === selectedClass);

  const getWaiver = (feeScheduleId: string) => waivers.find(w => w.feeScheduleId === feeScheduleId);

  const [form, setForm] = useState<Record<string, { type: string; value: string; reason: string; approvedBy: string }>>({});

  const initForm = (feeScheduleId: string) => {
    if (form[feeScheduleId]) return;
    const existing = getWaiver(feeScheduleId);
    setForm(prev => ({ ...prev, [feeScheduleId]: { type: existing?.type || '', value: existing ? String(existing.value) : '', reason: existing?.reason || '', approvedBy: existing?.approvedBy || '' } }));
  };

  const saveWaiver = async (feeScheduleId: string) => {
    const f = form[feeScheduleId];
    if (!f || !f.type) { toast('Select a waiver type', 'error'); return; }
    setSaving(feeScheduleId);
    try {
      await axios.post(`${API_URL}/finance/fee-waivers`, {
        studentId: selectedStudent, feeScheduleId, type: f.type, value: Number(f.value), reason: f.reason, approvedBy: f.approvedBy,
      }, { withCredentials: true });
      toast('Waiver saved ✓', 'success');
      await loadData();
    } catch (e: any) { toast(e?.response?.data?.error || 'Failed to save waiver', 'error'); }
    finally { setSaving(null); }
  };

  const deactivateWaiver = async (waiverId: string) => {
    try {
      await axios.post(`${API_URL}/finance/fee-waivers/${waiverId}/deactivate`, {}, { withCredentials: true });
      toast('Waiver deactivated', 'success');
      await loadData();
    } catch { toast('Failed to deactivate', 'error'); }
  };

  const activeSchedules = schedules.filter((s: any) => {
    if (!selectedClass) return true;
    return !s.classId || s.classRel?.name === selectedClass;
  });

  if (!selectedStudent) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-school-primary">Student Fee Waivers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Class</label>
            <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedStudent(''); }}
              className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm bg-white">
              <option value="">— All —</option>
              {[...classes].sort((a: any, b: any) => a.order - b.order).map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Student</label>
            <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}
              className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm bg-white">
              <option value="">— Select Student —</option>
              {classStudents.map((s: any) => <option key={s.id} value={s.id}>{s.name}{s.roll ? ` (Roll ${s.roll})` : ''}</option>)}
            </select>
          </div>
        </div>
      </div>
    );
  }

  const student = classStudents.find((s: any) => s.id === selectedStudent);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-lg font-bold text-school-primary">Fee Waivers</h2>
        <button onClick={() => setShowHistory(!showHistory)} className="text-xs text-school-muted underline">
          {showHistory ? 'Hide' : 'Show'} inactive waivers ({history.length})
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Class</label>
          <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedStudent(''); }}
            className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm bg-white">
            <option value="">— All —</option>
            {[...classes].sort((a: any, b: any) => a.order - b.order).map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Student</label>
          <select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)}
            className="w-full border border-school-border rounded-xl px-3 py-2.5 text-sm bg-white">
            {classStudents.map((s: any) => <option key={s.id} value={s.id}>{s.name}{s.roll ? ` (Roll ${s.roll})` : ''}</option>)}
          </select>
        </div>
        <div className="flex items-end">
          {student && <p className="text-sm text-school-muted pb-2.5">{student.name} — {student.class}{student.roll ? `, Roll ${student.roll}` : ''}</p>}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-school-muted">Loading...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-school-border text-left">
                <th className="pb-2 font-bold text-[10px] uppercase text-school-muted">Fee Category</th>
                <th className="pb-2 font-bold text-[10px] uppercase text-school-muted">Base Amount</th>
                <th className="pb-2 font-bold text-[10px] uppercase text-school-muted">Waiver Type</th>
                <th className="pb-2 font-bold text-[10px] uppercase text-school-muted">Value</th>
                <th className="pb-2 font-bold text-[10px] uppercase text-school-muted">Expected</th>
                <th className="pb-2 font-bold text-[10px] uppercase text-school-muted">Reason</th>
                <th className="pb-2 font-bold text-[10px] uppercase text-school-muted">Approved By</th>
                <th className="pb-2 font-bold text-[10px] uppercase text-school-muted"></th>
              </tr>
            </thead>
            <tbody>
              {activeSchedules.length === 0 && (
                <tr><td colSpan={8} className="py-8 text-center text-school-muted">No fee schedules found. Create one in Fee Schedules tab.</td></tr>
              )}
              {activeSchedules.map((sched: any) => {
                initForm(sched.id);
                const f = form[sched.id] || { type: '', value: '', reason: '', approvedBy: '' };
                const existing = getWaiver(sched.id);
                const baseAmt = Number(sched.amount);
                let expected = baseAmt;
                if (existing && existing.active) {
                  if (existing.type === 'FULL') expected = 0;
                  else if (existing.type === 'PERCENTAGE') expected = baseAmt - (baseAmt * Number(existing.value) / 100);
                  else if (existing.type === 'FIXED_AMOUNT') expected = Math.max(0, baseAmt - Number(existing.value));
                  else if (existing.type === 'CUSTOM_AMOUNT') expected = Number(existing.value);
                }

                return (
                  <tr key={sched.id} className="border-b border-school-border/50">
                    <td className="py-2.5 pr-3">
                      <div className="font-medium">{sched.category}</div>
                      <div className="text-[10px] text-school-muted">{sched.classRel?.name || 'School-wide'} · {sched.frequency}</div>
                    </td>
                    <td className="py-2.5 pr-3 font-mono">৳{baseAmt}</td>
                    <td className="py-2.5 pr-3">
                      <select value={f.type} onChange={e => setForm(prev => ({ ...prev, [sched.id]: { ...prev[sched.id], type: e.target.value } }))}
                        className="w-full border border-school-border rounded-lg px-2 py-1.5 text-xs bg-white">
                        <option value="">— None —</option>
                        {WAIVER_TYPES.map(wt => <option key={wt.value} value={wt.value}>{wt.label}</option>)}
                      </select>
                    </td>
                    <td className="py-2.5 pr-3">
                      {f.type === 'FULL' ? <span className="text-xs text-school-muted">N/A</span> : (
                        <input type="number" min="0" value={f.value} onChange={e => setForm(prev => ({ ...prev, [sched.id]: { ...prev[sched.id], value: e.target.value } }))}
                          placeholder={f.type === 'PERCENTAGE' ? 'e.g. 50' : 'e.g. 300'}
                          className="w-24 border border-school-border rounded-lg px-2 py-1.5 text-xs" />
                      )}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-sm">
                      {existing?.active ? (
                        <span className={expected < baseAmt ? 'text-emerald-600 font-bold' : ''}>৳{expected}</span>
                      ) : (
                        <span className="text-school-muted">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <input type="text" value={f.reason} onChange={e => setForm(prev => ({ ...prev, [sched.id]: { ...prev[sched.id], reason: e.target.value } }))}
                        placeholder="Reason" className="w-full border border-school-border rounded-lg px-2 py-1.5 text-xs" />
                    </td>
                    <td className="py-2.5 pr-3">
                      <input type="text" value={f.approvedBy} onChange={e => setForm(prev => ({ ...prev, [sched.id]: { ...prev[sched.id], approvedBy: e.target.value } }))}
                        placeholder="Approver" className="w-full border border-school-border rounded-lg px-2 py-1.5 text-xs" />
                    </td>
                    <td className="py-2.5 whitespace-nowrap">
                      <button onClick={() => saveWaiver(sched.id)} disabled={saving === sched.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-school-primary text-white hover:opacity-90 disabled:opacity-50">
                        <Save size={12} /> {saving === sched.id ? 'Saving...' : 'Save'}
                      </button>
                      {existing && (
                        <button onClick={() => deactivateWaiver(existing.id)}
                          className="ml-1 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold bg-rose-100 text-rose-700 hover:bg-rose-200">
                          <X size={12} /> Remove
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showHistory && history.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-bold text-school-muted mb-2">Inactive Waiver History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-school-border text-left">
                  <th className="pb-2 font-bold text-[10px] uppercase text-school-muted">Category</th>
                  <th className="pb-2 font-bold text-[10px] uppercase text-school-muted">Type</th>
                  <th className="pb-2 font-bold text-[10px] uppercase text-school-muted">Value</th>
                  <th className="pb-2 font-bold text-[10px] uppercase text-school-muted">Reason</th>
                  <th className="pb-2 font-bold text-[10px] uppercase text-school-muted">Approved By</th>
                  <th className="pb-2 font-bold text-[10px] uppercase text-school-muted">Created</th>
                </tr>
              </thead>
              <tbody>
                {history.map((w: any) => (
                  <tr key={w.id} className="border-b border-school-border/50 text-school-muted">
                    <td className="py-2 pr-3">{w.feeSchedule?.category}</td>
                    <td className="py-2 pr-3">{w.type}</td>
                    <td className="py-2 pr-3">{String(w.value)}</td>
                    <td className="py-2 pr-3">{w.reason || '—'}</td>
                    <td className="py-2 pr-3">{w.approvedBy || '—'}</td>
                    <td className="py-2 pr-3">{new Date(w.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentWaiversTab;
