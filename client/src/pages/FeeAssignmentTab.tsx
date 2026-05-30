import React, { useState, useEffect } from 'react';
import { useSchoolStore } from '../store';
import axios from 'axios';
import { toast } from '../components/Toast';
import { ToggleLeft, ToggleRight, Search } from 'lucide-react';

const API_URL = '/api';

const SPECIAL_FEES = [
  { key: 'hifz_tuition', label: 'Hifz Fee' },
  { key: 'hifz_admission', label: 'Hifz Admission Fee' },
  { key: 'transport', label: 'Transport Fee' },
] as const;

interface FeeAssignment {
  id: string;
  studentId: string;
  feeType: string;
  amount: number;
  active: boolean;
}

const FeeAssignmentTab: React.FC = () => {
  const { classes, students, fetchClasses, fetchStudents } = useSchoolStore();
  const [assignments, setAssignments] = useState<FeeAssignment[]>([]);
  const [assignClass, setAssignClass] = useState('');
  const [assignSearch, setAssignSearch] = useState('');
  const [editAmount, setEditAmount] = useState<Record<string, string>>({});

  const fetchAssignments = async (cls?: string) => {
    try {
      const params: Record<string, string> = {};
      if (cls) params.className = cls;
      const res = await axios.get(`${API_URL}/finance/fee-assignments`, { params, withCredentials: true });
      setAssignments(res.data);
    } catch { toast('Failed to load assignments', 'error'); }
  };

  useEffect(() => { fetchClasses(); fetchStudents(); }, []);
  useEffect(() => { fetchAssignments(assignClass); }, [assignClass]);

  const toggleAssignment = async (studentId: string, feeType: string) => {
    const existing = assignments.find(a => a.studentId === studentId && a.feeType === feeType);
    const amount = editAmount[`${studentId}_${feeType}`] ? Number(editAmount[`${studentId}_${feeType}`]) : (existing ? existing.amount : 0);
    try {
      await axios.post(`${API_URL}/finance/fee-assignments/toggle`, { studentId, feeType, amount }, { withCredentials: true });
      fetchAssignments(assignClass);
    } catch { toast('Failed to toggle', 'error'); }
  };

  const updateAmount = async (id: string, amount: number) => {
    try {
      await axios.put(`${API_URL}/finance/fee-assignments/${id}`, { amount }, { withCredentials: true });
      fetchAssignments(assignClass);
    } catch { toast('Failed to update', 'error'); }
  };

  const filteredStudents = (assignClass ? students.filter((s: any) => s.class === assignClass) : students)
    .filter((s: any) => !assignSearch || s.name.toLowerCase().includes(assignSearch.toLowerCase()) || (s.fatherName || '').toLowerCase().includes(assignSearch.toLowerCase()));

  const getAssignment = (studentId: string, feeType: string) => assignments.find(a => a.studentId === studentId && a.feeType === feeType);

  return (
    <div className="bg-white rounded-2xl border border-school-border overflow-hidden">
      <div className="px-5 py-4 border-b border-school-border">
        <h4 className="font-serif text-sm text-school-primary">Fee Assignment — Special Fees</h4>
        <p className="text-[10px] text-school-muted mt-1">Toggle fees for students who need to pay Hifz, Hifz Admission, or Transport fees</p>
      </div>

      <div className="px-5 py-3 border-b border-school-border flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Class</label>
          <select value={assignClass} onChange={e => { setAssignClass(e.target.value); setAssignSearch(''); }}
            className="border border-school-border rounded-xl px-3 py-2 text-sm bg-white">
            <option value="">All Classes</option>
            {classes.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Search Student</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-school-muted" />
            <input value={assignSearch} onChange={e => setAssignSearch(e.target.value)} placeholder="Search by name..."
              className="w-full pl-8 pr-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-school-paper/50 text-[10px] uppercase tracking-widest text-school-muted font-bold">
            <tr>
              <th className="px-4 py-3 text-left">Student</th>
              <th className="px-4 py-3 text-left">Class</th>
              {SPECIAL_FEES.map(f => (
                <th key={f.key} className="px-3 py-3 text-center">{f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-school-border/50">
            {filteredStudents.length > 0 ? filteredStudents.map((s: any) => (
              <tr key={s.id} className="hover:bg-school-paper/30 transition-colors">
                <td className="px-4 py-2">
                  <p className="font-bold text-xs">{s.name}</p>
                  {s.fatherName && <p className="text-[10px] text-school-muted">{s.fatherName}</p>}
                </td>
                <td className="px-4 py-2 text-xs">{s.class}{s.roll ? ` - ${s.roll}` : ''}</td>
                {SPECIAL_FEES.map(f => {
                  const assignment = getAssignment(s.id, f.key);
                  const isActive = !!assignment?.active;
                  const key = `${s.id}_${f.key}`;
                  return (
                    <td key={f.key} className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <input
                          type="number"
                          placeholder="Amount"
                          value={editAmount[key] ?? (assignment?.amount || '')}
                          onChange={e => setEditAmount(prev => ({ ...prev, [key]: e.target.value }))}
                          onBlur={() => { if (isActive && editAmount[key]) updateAmount(assignment!.id, Number(editAmount[key])); }}
                          className="w-20 border border-school-border rounded-lg px-2 py-1 text-[11px] text-center focus:outline-none focus:border-school-accent disabled:bg-gray-50"
                          disabled={!isActive}
                        />
                        <button onClick={() => toggleAssignment(s.id, f.key)} className="flex-shrink-0">
                          {isActive
                            ? <ToggleRight size={22} className="text-emerald-500" />
                            : <ToggleLeft size={22} className="text-gray-300" />}
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            )) : (
              <tr><td colSpan={2 + SPECIAL_FEES.length} className="px-4 py-8 text-center text-sm text-school-muted italic">
                {assignClass ? 'No students found for this class.' : 'Select a class to assign fees.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FeeAssignmentTab;
