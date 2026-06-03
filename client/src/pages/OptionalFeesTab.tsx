import { useState, useEffect } from 'react';
import { useSchoolStore, api } from '../store';
import { toast } from '../components/Toast';
import { Search, CheckSquare, Square } from 'lucide-react';

interface FeeSchedule {
  id: string;
  category: string;
  amount: number;
  frequency: string;
  applicability: string;
  classId: string | null;
  classRel: { name: string } | null;
}

interface StudentFeeAssignment {
  id: string;
  studentId: string;
  feeScheduleId: string;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  note: string | null;
}

const OptionalFeesTab = () => {
  const { classes, students, feeSchedules, fetchClasses, fetchStudents } = useSchoolStore();
  const [assignments, setAssignments] = useState<StudentFeeAssignment[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dateEdits, setDateEdits] = useState<Record<string, { startsAt: string; endsAt: string }>>({});

  const dateKey = (studentId: string) => `${studentId}_${selectedScheduleId}`;

  const load = async () => {
    setLoading(true);
    try {
      const asRes = selectedScheduleId
        ? await api.get('/finance/student-fee-assignments', { params: { feeScheduleId: selectedScheduleId, active: 'true' } })
        : { data: [] };
      setAssignments(asRes.data);
    } catch { toast('Failed to load data', 'error'); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchClasses(); fetchStudents(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setDateEdits({}); load(); }, [selectedScheduleId]);

  const assignedSchedules = feeSchedules.filter(fs => fs.applicability === 'ASSIGNED_ONLY');

  const classStudents = (selectedClass ? students.filter((s: any) => s.class === selectedClass) : students)
    .filter((s: any) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.fatherName || '').toLowerCase().includes(search.toLowerCase()));

  const getAssignment = (studentId: string) => assignments.find(a => a.studentId === studentId && a.active);

  const toggleStudent = async (studentId: string) => {
    if (!selectedScheduleId) return;
    const edits = dateEdits[dateKey(studentId)];
    try {
      await api.post('/finance/student-fee-assignments/toggle',
        {
          studentId,
          feeScheduleId: selectedScheduleId,
          ...(edits?.startsAt ? { startsAt: edits.startsAt } : {}),
          ...(edits?.endsAt ? { endsAt: edits.endsAt } : {}),
        });
      toast('Updated', 'success');
      load();
    } catch { toast('Failed to update', 'error'); }
  };

  const [bulkStartsAt, setBulkStartsAt] = useState('');
  const [bulkEndsAt, setBulkEndsAt] = useState('');

  const bulkToggle = async (active: boolean) => {
    if (!selectedScheduleId || !classStudents.length) return;
    try {
      await api.post('/finance/student-fee-assignments/bulk',
        { feeScheduleId: selectedScheduleId, studentIds: classStudents.map((s: any) => s.id), active, startsAt: bulkStartsAt || undefined, endsAt: bulkEndsAt || undefined });
      toast(`Assigned to ${classStudents.length} students`, 'success');
      load();
    } catch { toast('Bulk assign failed', 'error'); }
  };

  return (
    <div className="bg-white rounded-xl border border-school-border overflow-hidden">
      <div className="px-5 py-4 border-b border-school-border">
        <h4 className="font-serif text-sm text-school-primary">Optional Fees</h4>
        <p className="text-[10px] text-school-muted mt-1">Assign ASSIGNED_ONLY fee schedules to individual students</p>
      </div>

      <div className="px-5 py-3 border-b border-school-border flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Fee Schedule</label>
          <select value={selectedScheduleId} onChange={e => setSelectedScheduleId(e.target.value)}
            className="border border-school-border rounded-xl px-3 py-2 text-sm bg-white min-w-[200px]">
            <option value="">Select a fee schedule</option>
            {assignedSchedules.map(fs => (
              <option key={fs.id} value={fs.id}>
                {fs.category} — ৳{fs.amount} ({fs.frequency}){fs.classRel ? ` — ${fs.classRel.name}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Class</label>
          <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSearch(''); }}
            className="border border-school-border rounded-xl px-3 py-2 text-sm bg-white">
            <option value="">All Classes</option>
            {classes.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Search</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-school-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              className="w-full pl-8 pr-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />
          </div>
        </div>
      </div>

      {selectedScheduleId && classStudents.length > 0 && (
        <div className="px-5 py-2 border-b border-school-border flex flex-wrap items-end gap-3">
          <div className="flex gap-2">
            <button onClick={() => bulkToggle(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200">
              <CheckSquare size={14} /> Assign All
            </button>
            <button onClick={() => bulkToggle(false)}
              className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold rounded-lg bg-red-50 text-red-700 hover:bg-red-100 border border-red-200">
              <Square size={14} /> Remove All
            </button>
          </div>
          <div className="flex gap-2 items-end ml-auto">
            <div>
              <label className="text-[9px] font-bold uppercase text-school-muted mb-0.5 block">Bulk Start</label>
              <input type="date" value={bulkStartsAt} onChange={e => setBulkStartsAt(e.target.value)}
                className="border border-school-border rounded-lg px-2 py-1 text-[11px] w-[140px] focus:outline-none focus:border-school-accent" />
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase text-school-muted mb-0.5 block">Bulk End</label>
              <input type="date" value={bulkEndsAt} onChange={e => setBulkEndsAt(e.target.value)}
                className="border border-school-border rounded-lg px-2 py-1 text-[11px] w-[140px] focus:outline-none focus:border-school-accent" />
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="px-5 py-8 space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="w-9 h-9 bg-gray-100 rounded-full animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-100 rounded w-1/3 animate-pulse" />
                <div className="h-3 bg-gray-50 rounded w-1/5 animate-pulse" />
              </div>
              <div className="h-6 bg-gray-100 rounded w-20 animate-pulse" />
              <div className="h-6 bg-gray-100 rounded w-20 animate-pulse" />
              <div className="h-6 bg-gray-100 rounded w-16 animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
      <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm mobile-card-table">
          <thead className="bg-school-paper/50 text-[10px] uppercase tracking-widest text-school-muted font-bold">
            <tr>
              <th className="px-4 py-3 text-left">Student</th>
              <th className="px-4 py-3 text-left hidden sm:table-cell">Class</th>
              <th className="px-4 py-3 text-center">Starts</th>
              <th className="px-4 py-3 text-center">Ends</th>
              <th className="px-4 py-3 text-center">Assigned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-school-border/50">
            {classStudents.length > 0 ? classStudents.map((s: any) => {
              const assignment = getAssignment(s.id);
              const isActive = !!assignment?.active;
              const dk = dateKey(s.id);
              const editDates = dateEdits[dk] ?? { startsAt: assignment?.startsAt?.split('T')[0] ?? '', endsAt: assignment?.endsAt?.split('T')[0] ?? '' };
              return (
                <tr key={s.id} className="hover:bg-school-paper/30 transition-colors">
                  <td data-label="Student" className="px-4 py-2">
                    <p className="font-bold text-xs">{s.name}</p>
                    {s.fatherName && <p className="text-[10px] text-school-muted">{s.fatherName}</p>}
                  </td>
                  <td data-label="Class" className="px-4 py-2 text-xs hidden sm:table-cell">{s.class}{s.roll ? ` - ${s.roll}` : ''}</td>
                  <td data-label="Starts" className="px-4 py-2 text-center">
                    <input type="date" value={editDates.startsAt}
                      onChange={e => setDateEdits(prev => ({ ...prev, [dk]: { ...prev[dk] ?? editDates, startsAt: e.target.value } }))}
                      className="w-[130px] border border-school-border rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:border-school-accent"
                      aria-label="Start date" />
                  </td>
                  <td data-label="Ends" className="px-4 py-2 text-center">
                    <input type="date" value={editDates.endsAt}
                      onChange={e => setDateEdits(prev => ({ ...prev, [dk]: { ...prev[dk] ?? editDates, endsAt: e.target.value } }))}
                      className="w-[130px] border border-school-border rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:border-school-accent"
                      aria-label="End date" />
                  </td>
                  <td data-label="Assigned" className="px-4 py-2 text-center">
                    <button onClick={() => toggleStudent(s.id)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                      }`}
                      aria-label={`Toggle ${s.name}`}>
                      {isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                </tr>
              );
            }) : (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-school-muted italic">
                {selectedClass ? 'No students found.' : 'Select a class to view students.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      {!selectedScheduleId && (
        <div className="px-5 py-8 text-center text-sm text-school-muted italic">
          Select a fee schedule and class to manage optional fee assignments.
        </div>
      )}
    </>
    )}
    </div>
  );
};

export default OptionalFeesTab;
