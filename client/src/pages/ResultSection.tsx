import React, { useState, useEffect, useCallback } from 'react';
import { useSchoolStore, useAuthStore } from '../store';
import { toast } from '../components/Toast';
import { RefreshCw } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

const TERM_NAMES: Record<string, string> = { '1': '1st Term', '2': '2nd Term', '3': 'Final Exam' };

function getGrade(pct: number) {
  if (pct >= 80) return { grade: 'A+', gpa: 5.00 };
  if (pct >= 75) return { grade: 'A', gpa: 4.75 };
  if (pct >= 70) return { grade: 'A-', gpa: 4.50 };
  if (pct >= 65) return { grade: 'B+', gpa: 4.25 };
  if (pct >= 60) return { grade: 'B', gpa: 4.00 };
  if (pct >= 55) return { grade: 'B-', gpa: 3.75 };
  if (pct >= 50) return { grade: 'C+', gpa: 3.50 };
  if (pct >= 45) return { grade: 'C', gpa: 3.25 };
  if (pct >= 40) return { grade: 'D', gpa: 3.00 };
  return { grade: 'F', gpa: 0.00 };
}

function gradeFromMarks(obtained: number, full: number) {
  if (full <= 0) return { grade: '—', gpa: 0 };
  return getGrade((obtained / full) * 100);
}

function gpaToGrade(gpa: number) {
  if (gpa >= 5.00) return 'A+';
  if (gpa >= 4.75) return 'A';
  if (gpa >= 4.50) return 'A-';
  if (gpa >= 4.25) return 'B+';
  if (gpa >= 4.00) return 'B';
  if (gpa >= 3.75) return 'B-';
  if (gpa >= 3.50) return 'C+';
  if (gpa >= 3.25) return 'C';
  if (gpa >= 3.00) return 'D';
  return 'F';
}

function studentId(s: any) {
  return (s.roll ? 'r' + s.roll : 'n' + s.name.replace(/\s+/g, '_')).toLowerCase();
}

const gradeColor = (g: string) => {
  if (g.startsWith('A')) return 'bg-green-100 text-green-700';
  if (g.startsWith('B')) return 'bg-blue-100 text-blue-700';
  if (g.startsWith('C')) return 'bg-yellow-100 text-yellow-700';
  if (g === 'D') return 'bg-orange-100 text-orange-700';
  return 'bg-red-100 text-red-700';
};

// ── Class Picker ──

const ClassPicker: React.FC<{ onSelect: (cls: any) => void }> = ({ onSelect }) => {
  const { classes, students, fetchClasses, fetchStudents } = useSchoolStore();

  useEffect(() => { fetchClasses(); fetchStudents(); }, []);

  const sorted = [...classes].sort((a, b) => a.order - b.order);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <h3 className="font-serif text-lg text-school-primary">📊 Results</h3>
      </div>
      <p className="text-sm text-school-muted mb-3">Select a class to manage results:</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {sorted.map((cls) => {
          const count = students.filter((s: any) => s.class === cls.name).length;
          return (
            <button
              key={cls.id}
              onClick={() => onSelect(cls)}
              className="bg-white p-4 rounded-2xl border border-school-border text-center hover:border-school-accent hover:shadow-md transition-all"
            >
              <div className="text-2xl mb-1">📖</div>
              <div className="font-bold text-sm text-school-primary">{cls.name}</div>
              <div className="text-[11px] text-school-muted mt-1">{count} student{count !== 1 ? 's' : ''}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ── Class View (Subjects + Student Cards) ──

interface ClassViewProps {
  cls: any;
  onBack: () => void;
  onSelectStudent: (sid: string, student: any) => void;
}

const ClassView: React.FC<ClassViewProps> = ({ cls, onBack, onSelectStudent }) => {
  const { students, subjects, fetchStudents, fetchSubjects, createSubject, deleteSubject } = useSchoolStore();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'admin';

  const [newSubjName, setNewSubjName] = useState('');
  const [newSubjMarks, setNewSubjMarks] = useState('');
  const [allResults, setAllResults] = useState<any[]>([]);

  useEffect(() => {
    fetchStudents();
    fetchSubjects(cls.id);
    loadResults();
  }, [cls.id]);

  const loadResults = async () => {
    try {
      const res = await fetch(`${API_URL}/classes/${cls.id}/results`, {
        credentials: 'include',
      });
      const data = await res.json();
      setAllResults(data);
    } catch {}
  };

  const clsStudents = students.filter((s: any) => s.class === cls.name);

  const handleAddSubject = async () => {
    if (!newSubjName.trim()) return toast('Enter subject name', 'error');
    const marks = parseInt(newSubjMarks);
    if (!marks || marks < 1) return toast('Enter valid full marks', 'error');
    await createSubject(cls.id, newSubjName.trim(), marks);
    setNewSubjName('');
    setNewSubjMarks('');
    toast(`"${newSubjName}" added ✓`, 'success');
  };

  const handleDeleteSubject = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? All marks will be lost.`)) return;
    await deleteSubject(id);
    fetchSubjects(cls.id);
    toast('Subject removed');
  };

  const getStudentResultSummary = (sid: string) => {
    const student = clsStudents.find((s: any) => studentId(s) === sid);
    if (!student) return null;

    for (let t = 3; t >= 1; t--) {
      const result = allResults.find((r: any) => r.studentId === student.id && r.term === String(t));
      if (result && subjects.length > 0) {
        const marks = result.marks || {};
        let total = 0, fullTotal = 0, gpas: number[] = [], hasF = false;
        subjects.forEach((sub: any) => {
          const obt = marks[sub.name];
          if (obt !== undefined && obt !== null) {
            const g = gradeFromMarks(+obt, sub.fullMarks);
            gpas.push(g.gpa);
            if (g.grade === 'F') hasF = true;
            total += +obt;
            fullTotal += sub.fullMarks;
          }
        });
        if (gpas.length > 0) {
          const gpa = gpas.reduce((a, b) => a + b, 0) / gpas.length;
          return { grade: hasF ? 'F' : gpaToGrade(gpa), gpa };
        }
      }
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-sm text-school-accent hover:underline">← All Classes</button>
        <h3 className="font-serif text-lg text-school-primary">{cls.name} — Results</h3>
      </div>

      {/* Subject Setup */}
      <div className="bg-white rounded-2xl border border-school-border overflow-hidden">
        <div className="p-4 border-b border-school-border">
          <h4 className="font-bold text-sm">📚 Subject Setup</h4>
        </div>
        <div className="p-4">
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-school-muted text-xs uppercase">
                  <th className="text-left pb-2">#</th>
                  <th className="text-left pb-2">Subject</th>
                  <th className="text-right pb-2">Full Marks</th>
                  {isAdmin && <th className="pb-2 w-10"></th>}
                </tr>
              </thead>
              <tbody>
                {subjects.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-4 text-school-muted">No subjects yet. Add above.</td></tr>
                ) : (
                  subjects.map((sub: any, i: number) => (
                    <tr key={sub.id} className="border-t border-school-border">
                      <td className="py-2 text-school-muted">{i + 1}</td>
                      <td className="py-2 font-medium">{sub.name}</td>
                      <td className="py-2 text-right">{sub.fullMarks}</td>
                      {isAdmin && (
                        <td className="py-2 text-center">
                          <button onClick={() => handleDeleteSubject(sub.id, sub.name)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {isAdmin && (
            <div className="flex gap-2 mt-3">
              <input type="text" value={newSubjName} onChange={(e) => setNewSubjName(e.target.value)} placeholder="Subject name" className="flex-1 px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" maxLength={40} />
              <input type="number" value={newSubjMarks} onChange={(e) => setNewSubjMarks(e.target.value)} placeholder="Marks" min="1" className="w-20 px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />
              <button onClick={handleAddSubject} className="px-4 py-2 bg-school-primary text-white rounded-xl text-sm font-bold hover:opacity-90">+ Add</button>
            </div>
          )}
        </div>
      </div>

      {/* Student Cards */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h4 className="font-serif text-lg text-school-primary">Students</h4>
          <span className="bg-school-primary text-white text-xs font-bold px-2 py-0.5 rounded-full">{clsStudents.length}</span>
        </div>

        {clsStudents.length === 0 ? (
          <div className="text-center py-12 text-school-muted">
            <div className="text-4xl mb-2">🎓</div>
            <p className="text-sm">No students in {cls.name} yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {clsStudents.map((s: any) => {
              const sid = studentId(s);
              const summary = getStudentResultSummary(sid);
              return (
                <div key={s.id} className="bg-white p-4 rounded-2xl border border-school-border hover:shadow-md transition-shadow">
                  {s.photo ? (
                    <img src={s.photo} alt="" className="w-14 h-14 rounded-full object-cover border border-school-border mx-auto mb-2" />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-school-primary text-white flex items-center justify-center text-xl mx-auto mb-2">👤</div>
                  )}
                  <div className="text-center font-bold text-sm text-school-primary">{s.name}</div>
                  <div className="text-center text-xs text-school-muted">{s.roll ? `Roll: ${s.roll}` : cls.name}</div>
                  <div className="text-center mt-2">
                    {summary ? (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${gradeColor(summary.grade)}`}>
                        {summary.grade} · GPA {summary.gpa.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-xs text-school-muted">No marks yet</span>
                    )}
                  </div>
                  <button
                    onClick={() => onSelectStudent(sid, s)}
                    className="w-full mt-3 py-2 bg-school-primary text-white rounded-xl text-xs font-bold hover:opacity-90"
                  >
                    📝 Marks & Report
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Student Result Entry ──

interface StudentResultProps {
  sid: string;
  student: any;
  cls: any;
  onBack: () => void;
}

const StudentResultEntry: React.FC<StudentResultProps> = ({ sid, student, cls, onBack }) => {
  const { subjects, fetchSubjects, saveStudentResult, getStudentResults } = useSchoolStore();
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'admin';

  const [activeTerm, setActiveTerm] = useState('1');
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [attendance, setAttendance] = useState({ days: '', present: '' });
  const [allResults, setAllResults] = useState<any[]>([]);
  const [showReportCard, setShowReportCard] = useState(false);

  useEffect(() => {
    fetchSubjects(cls.id);
    loadResults();
  }, [cls.id, sid]);

  const loadResults = async () => {
    const results = await getStudentResults(student.id);
    setAllResults(results);

    const termResult = results.find((r: any) => r.term === '1');
    if (termResult?.marks) {
      const m: Record<string, string> = {};
      Object.entries(termResult.marks).forEach(([k, v]) => { m[k] = String(v); });
      setMarks(m);
    }
    if (termResult?.attendance) {
      setAttendance({ days: String(termResult.attendance.days || ''), present: String(termResult.attendance.present || '') });
    }
  };

  useEffect(() => {
    const termResult = allResults.find((r: any) => r.term === activeTerm);
    if (termResult?.marks) {
      const m: Record<string, string> = {};
      Object.entries(termResult.marks).forEach(([k, v]) => { m[k] = String(v); });
      setMarks(m);
    } else {
      setMarks({});
    }
    if (termResult?.attendance) {
      setAttendance({ days: String(termResult.attendance.days || ''), present: String(termResult.attendance.present || '') });
    } else {
      setAttendance({ days: '', present: '' });
    }
  }, [activeTerm, allResults]);

  const handleMarksChange = (subjName: string, value: string) => {
    setMarks((prev) => ({ ...prev, [subjName]: value }));
    debouncedSave();
  };

  let saveTimer: any = null;
  const debouncedSave = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveCurrentMarks(), 500);
  };

  const saveCurrentMarks = async () => {
    const marksData: Record<string, number> = {};
    subjects.forEach((sub: any) => {
      const val = marks[sub.name];
      if (val !== '' && val !== undefined && !isNaN(+val)) {
        marksData[sub.name] = Math.min(+val, sub.fullMarks);
      }
    });

    const attData = {
      days: parseInt(attendance.days) || 0,
      present: parseInt(attendance.present) || 0,
    };

    await saveStudentResult(student.id, activeTerm, marksData, attData);
    loadResults();
  };

  // Calculate current term summary
  let totalObt = 0, totalFull = 0, gpas: number[] = [], hasF = false;
  subjects.forEach((sub: any) => {
    const val = marks[sub.name];
    if (val !== '' && val !== undefined && !isNaN(+val)) {
      const g = gradeFromMarks(+val, sub.fullMarks);
      gpas.push(g.gpa);
      if (g.grade === 'F') hasF = true;
      totalObt += +val;
      totalFull += sub.fullMarks;
    }
  });
  const termGPA = gpas.length ? gpas.reduce((a, b) => a + b, 0) / gpas.length : null;
  const termGrade = hasF ? 'F' : termGPA !== null ? gpaToGrade(termGPA) : '—';
  const attendPct = attendance.days && parseInt(attendance.days) > 0
    ? ((parseInt(attendance.present) / parseInt(attendance.days)) * 100).toFixed(1) + '%'
    : '—';

  if (showReportCard) {
    return <ReportCard sid={sid} student={student} cls={cls} allResults={allResults} subjects={subjects} onBack={() => setShowReportCard(false)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-sm text-school-accent hover:underline">← {cls.name}</button>
      </div>

      {/* Student Header */}
      <div className="bg-white p-4 rounded-2xl border border-school-border flex items-center gap-4">
        {student.photo ? (
          <img src={student.photo} alt="" className="w-14 h-14 rounded-full object-cover border border-school-border flex-shrink-0" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-school-primary text-white flex items-center justify-center text-xl flex-shrink-0">👤</div>
        )}
        <div className="flex-1">
          <div className="font-serif text-lg text-school-primary">{student.name}</div>
          <div className="text-xs text-school-muted">{cls.name}{student.roll ? ` · Roll: ${student.roll}` : ''}</div>
        </div>
        <button onClick={() => setShowReportCard(true)} className="px-4 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:opacity-90">📄 Report Card</button>
      </div>

      {/* Term Tabs */}
      <div className="flex gap-2">
        {['1', '2', '3'].map((t) => (
          <button
            key={t}
            onClick={() => setActiveTerm(t)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTerm === t ? 'bg-school-primary text-white shadow-lg' : 'bg-white border border-school-border hover:border-school-accent'
            }`}
          >
            {TERM_NAMES[t]}
          </button>
        ))}
      </div>

      {/* Marks Table */}
      <div className="bg-white rounded-2xl border border-school-border overflow-hidden">
        <div className="p-4">
          <h4 className="font-serif text-sm text-school-primary mb-3">{TERM_NAMES[activeTerm]}</h4>

          {subjects.length === 0 ? (
            <div className="text-center py-8 text-school-muted">
              <p className="text-sm">No subjects set up for {cls.name}.<br />Add subjects first.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-school-muted text-xs uppercase border-b border-school-border">
                    <th className="text-left pb-2">Subject</th>
                    <th className="text-right pb-2">Full</th>
                    <th className="text-right pb-2">Obtained</th>
                    <th className="text-center pb-2">Grade</th>
                    <th className="text-right pb-2">GPA</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((sub: any) => {
                    const val = marks[sub.name];
                    const g = val !== '' && val !== undefined && !isNaN(+val) ? gradeFromMarks(+val, sub.fullMarks) : null;
                    return (
                      <tr key={sub.id} className="border-b border-school-border/50">
                        <td className="py-2 font-medium">{sub.name}</td>
                        <td className="py-2 text-right">{sub.fullMarks}</td>
                        <td className="py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            max={sub.fullMarks}
                            value={val || ''}
                            onChange={(e) => handleMarksChange(sub.name, e.target.value)}
                            placeholder="—"
                            className="w-16 px-2 py-1 border border-school-border rounded text-right text-sm focus:outline-none focus:border-school-accent"
                          />
                        </td>
                        <td className="py-2 text-center">
                          {g ? <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${gradeColor(g.grade)}`}>{g.grade}</span> : '—'}
                        </td>
                        <td className="py-2 text-right">{g ? g.gpa.toFixed(2) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-school-primary font-bold">
                    <td className="py-2 text-xs uppercase tracking-wider">Total / Summary</td>
                    <td className="py-2 text-right">{totalFull || '—'}</td>
                    <td className="py-2 text-right">{gpas.length ? totalObt : '—'}</td>
                    <td className="py-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${gradeColor(termGrade)}`}>{termGrade}</span>
                    </td>
                    <td className="py-2 text-right">{termGPA !== null ? termGPA.toFixed(2) : '—'}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {subjects.length > 0 && (
            <div className="flex gap-3 mt-4 flex-wrap">
              <div className="bg-school-paper px-3 py-2 rounded-xl text-center">
                <div className="text-[10px] text-school-muted uppercase">Total Marks</div>
                <div className="font-bold text-sm">{gpas.length ? `${totalObt}/${totalFull}` : '—'}</div>
              </div>
              <div className="bg-school-paper px-3 py-2 rounded-xl text-center">
                <div className="text-[10px] text-school-muted uppercase">Term GPA</div>
                <div className="font-bold text-sm">{termGPA !== null ? termGPA.toFixed(2) : '—'}</div>
              </div>
              <div className="bg-school-paper px-3 py-2 rounded-xl text-center">
                <div className="text-[10px] text-school-muted uppercase">Grade</div>
                <div className="font-bold text-sm">{termGrade}</div>
              </div>
            </div>
          )}

          {isAdmin && (
            <button onClick={saveCurrentMarks} className="w-full mt-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:opacity-90">
              💾 Save Marks
            </button>
          )}
        </div>
      </div>

      {/* Attendance */}
      <div className="bg-white rounded-2xl border border-school-border overflow-hidden">
        <div className="p-4">
          <h4 className="font-bold text-sm mb-3">📅 Attendance</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-school-muted mb-1 block">Total Days</label>
              <input type="number" min="0" value={attendance.days} onChange={(e) => setAttendance({ ...attendance, days: e.target.value })} placeholder="200" className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />
            </div>
            <div>
              <label className="text-xs text-school-muted mb-1 block">Days Present</label>
              <input type="number" min="0" value={attendance.present} onChange={(e) => setAttendance({ ...attendance, present: e.target.value })} placeholder="185" className="w-full px-3 py-2 border border-school-border rounded-xl text-sm focus:outline-none focus:border-school-accent" />
            </div>
            <div>
              <label className="text-xs text-school-muted mb-1 block">Attendance</label>
              <div className="px-3 py-2 bg-school-paper rounded-xl text-sm font-bold text-center">{attendPct}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Report Card ──

interface ReportCardProps {
  sid: string;
  student: any;
  cls: any;
  allResults: any[];
  subjects: any[];
  onBack: () => void;
}

const ReportCard: React.FC<ReportCardProps> = ({ sid, student, cls, allResults, subjects, onBack }) => {
  const getTermSummary = (term: string) => {
    const result = allResults.find((r: any) => r.studentId === student.id && r.term === term);
    if (!result?.marks || subjects.length === 0) return null;

    let total = 0, fullTotal = 0, gpas: number[] = [], hasF = false;
    subjects.forEach((sub: any) => {
      const obt = result.marks[sub.name];
      if (obt !== undefined && obt !== null) {
        const g = gradeFromMarks(+obt, sub.fullMarks);
        gpas.push(g.gpa);
        if (g.grade === 'F') hasF = true;
        total += +obt;
        fullTotal += sub.fullMarks;
      }
    });
    if (gpas.length === 0) return null;
    const gpa = gpas.reduce((a, b) => a + b, 0) / gpas.length;
    return { gpa, grade: hasF ? 'F' : gpaToGrade(gpa), total, fullTotal };
  };

  const term1 = getTermSummary('1');
  const term2 = getTermSummary('2');
  const term3 = getTermSummary('3');

  const gpas = [term1, term2, term3].filter(Boolean).map((t: any) => t.gpa);
  const finalGPA = gpas.length ? gpas.reduce((a, b) => a + b, 0) / gpas.length : null;
  const finalGrade = finalGPA !== null ? gpaToGrade(finalGPA) : '—';

  const att = allResults.find((r: any) => r.studentId === student.id && r.term === '3')?.attendance || {};
  const attPct = att.days > 0 ? ((att.present / att.days) * 100).toFixed(1) + '%' : '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-school-accent hover:underline">← Marks Entry</button>
      </div>

      <div className="bg-white rounded-2xl border border-school-border p-6 max-w-lg mx-auto space-y-4">
        {/* Header */}
        <div className="text-center border-b border-school-border pb-4">
          <h2 className="font-serif text-xl text-school-primary">AL RAWA English School</h2>
          <p className="text-[10px] text-school-muted mt-1">ESTD: 2022 · Read in the name of your Lord</p>
          <p className="text-sm font-bold text-school-accent mt-2">STUDENT REPORT CARD</p>
        </div>

        {/* Student Info */}
        <div className="flex items-center gap-4">
          {student.photo ? (
            <img src={student.photo} alt="" className="w-16 h-16 rounded-full object-cover border border-school-border" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-school-primary text-white flex items-center justify-center text-2xl">👤</div>
          )}
          <div className="space-y-1">
            <div className="font-serif text-lg">{student.name}</div>
            <div className="text-xs text-school-muted">Class: {cls.name}{student.roll ? ` · Roll: ${student.roll}` : ''}</div>
            {student.fatherName && <div className="text-xs text-school-muted">Father: {student.fatherName}</div>}
          </div>
        </div>

        {/* Subject Marks */}
        <div>
          <h4 className="font-bold text-xs uppercase tracking-wider text-school-muted mb-2">📚 Academic Result</h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-school-paper text-school-muted uppercase">
                <th className="text-left px-2 py-1.5">Subject</th>
                <th className="text-right px-2 py-1.5">1st</th>
                <th className="text-right px-2 py-1.5">2nd</th>
                <th className="text-right px-2 py-1.5">Final</th>
                <th className="text-center px-2 py-1.5">Grade</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((sub: any) => {
                const marks1 = allResults.find((r: any) => r.studentId === student.id && r.term === '1')?.marks?.[sub.name];
                const marks2 = allResults.find((r: any) => r.studentId === student.id && r.term === '2')?.marks?.[sub.name];
                const marks3 = allResults.find((r: any) => r.studentId === student.id && r.term === '3')?.marks?.[sub.name];
                const valid = [marks1, marks2, marks3].filter((m) => m !== undefined && m !== null);
                const avg = valid.length ? valid.reduce((a: number, b: any) => a + +b, 0) / valid.length : null;
                const g = avg !== null ? gradeFromMarks(avg, sub.fullMarks) : null;
                return (
                  <tr key={sub.id} className="border-t border-school-border/50">
                    <td className="px-2 py-1.5 font-medium">{sub.name}</td>
                    <td className="px-2 py-1.5 text-right">{marks1 ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right">{marks2 ?? '—'}</td>
                    <td className="px-2 py-1.5 text-right">{marks3 ?? '—'}</td>
                    <td className="px-2 py-1.5 text-center">{g ? <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${gradeColor(g.grade)}`}>{g.grade}</span> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Term Summary */}
        <div>
          <h4 className="font-bold text-xs uppercase tracking-wider text-school-muted mb-2">📋 Term Summary</h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-school-paper text-school-muted uppercase">
                <th className="text-left px-2 py-1.5">Term</th>
                <th className="text-right px-2 py-1.5">Total</th>
                <th className="text-right px-2 py-1.5">GPA</th>
                <th className="text-center px-2 py-1.5">Grade</th>
              </tr>
            </thead>
            <tbody>
              {(['1', '2', '3'] as const).map((t, i) => {
                const s = [term1, term2, term3][i];
                return (
                  <tr key={t} className="border-t border-school-border/50">
                    <td className="px-2 py-1.5">{TERM_NAMES[t]}</td>
                    <td className="px-2 py-1.5 text-right">{s ? `${s.total}/${s.fullTotal}` : '—'}</td>
                    <td className="px-2 py-1.5 text-right">{s ? s.gpa.toFixed(2) : '—'}</td>
                    <td className="px-2 py-1.5 text-center">{s ? <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${gradeColor(s.grade)}`}>{s.grade}</span> : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Final Result */}
        <div className="bg-school-accent text-white p-3 rounded-xl text-center">
          <div className="text-xs uppercase tracking-wider opacity-80">Final Result</div>
          <div className="font-bold mt-1">
            GPA: {finalGPA !== null ? finalGPA.toFixed(2) : '—'} | Grade: {finalGrade}
          </div>
        </div>

        {/* Attendance */}
        <div>
          <h4 className="font-bold text-xs uppercase tracking-wider text-school-muted mb-2">📅 Attendance</h4>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-school-paper p-2 rounded-xl">
              <div className="text-school-muted">Total Days</div>
              <div className="font-bold">{att.days || '—'}</div>
            </div>
            <div className="bg-school-paper p-2 rounded-xl">
              <div className="text-school-muted">Present</div>
              <div className="font-bold">{att.present || '—'}</div>
            </div>
            <div className="bg-school-paper p-2 rounded-xl">
              <div className="text-school-muted">Attendance</div>
              <div className="font-bold">{attPct}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main Result Section ──

const ResultSection: React.FC = () => {
  const [view, setView] = useState<'picker' | 'class' | 'student'>('picker');
  const [activeClass, setActiveClass] = useState<any>(null);
  const [activeStudent, setActiveStudent] = useState<{ sid: string; student: any } | null>(null);

  const handleSelectClass = (cls: any) => {
    setActiveClass(cls);
    setView('class');
  };

  const handleSelectStudent = (sid: string, student: any) => {
    setActiveStudent({ sid, student });
    setView('student');
  };

  return (
    <div>
      {view === 'picker' && <ClassPicker onSelect={handleSelectClass} />}
      {view === 'class' && activeClass && (
        <ClassView
          cls={activeClass}
          onBack={() => setView('picker')}
          onSelectStudent={handleSelectStudent}
        />
      )}
      {view === 'student' && activeStudent && activeClass && (
        <StudentResultEntry
          sid={activeStudent.sid}
          student={activeStudent.student}
          cls={activeClass}
          onBack={() => setView('class')}
        />
      )}
    </div>
  );
};

export default ResultSection;
