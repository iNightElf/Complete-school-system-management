

export function getGrade(pct: number) {
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
export function gradeFromMarks(o: number, f: number) { return f <= 0 ? { grade: '—', gpa: 0 } : getGrade((o / f) * 100); }
export function gpaToGrade(g: number) {
  if (g >= 5.00) return 'A+'; if (g >= 4.75) return 'A'; if (g >= 4.50) return 'A-';
  if (g >= 4.25) return 'B+'; if (g >= 4.00) return 'B'; if (g >= 3.75) return 'B-';
  if (g >= 3.50) return 'C+'; if (g >= 3.25) return 'C'; if (g >= 3.00) return 'D';
  return 'F';
}
export function gradeColor(g: string) {
  if (g.startsWith('A')) return 'bg-green-100 text-green-700';
  if (g.startsWith('B')) return 'bg-blue-100 text-blue-700';
  if (g.startsWith('C')) return 'bg-yellow-100 text-yellow-700';
  if (g === 'D') return 'bg-orange-100 text-orange-700';
  return 'bg-red-100 text-red-700';
}
export function gradeChip(g: string) { return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${gradeColor(g)}`}>{g}</span>; }

export function calcTermSummary(studentId: string, term: string, subjects: any[], allResults: any[]) {
  const r = allResults.find((x: any) => x.studentId === studentId && x.term === term);
  if (!r?.marks || !subjects.length) return null;
  let tot = 0, full = 0, hasF = false, n = 0; const gpas: number[] = [];
  subjects.forEach((sub: any) => { const m = r.marks[sub.name]; if (m !== undefined && m !== null) { const g = gradeFromMarks(+m, sub.fullMarks); gpas.push(g.gpa); if (g.grade === 'F') hasF = true; tot += +m; full += sub.fullMarks; n++; } });
  if (!n) return null;
  const gpa = gpas.reduce((a, b) => a + b, 0) / gpas.length;
  return { gpa, grade: hasF ? 'F' : gpaToGrade(gpa), total: tot, fullTotal: full };
}
export function calcTermRanks(clsStudents: any[], term: string, subjects: any[], allResults: any[]) {
  const scores = clsStudents.map(s => { const tc = calcTermSummary(s.id, term, subjects, allResults); return { sid: s.id, gpa: tc ? tc.gpa : -1, total: tc ? tc.total : -1 }; }).filter(x => x.gpa >= 0);
  scores.sort((a, b) => b.gpa - a.gpa || b.total - a.total);
  const ranks: Record<string, number> = {};
  scores.forEach((sc, i) => { const p = scores[i - 1]; ranks[sc.sid] = (i > 0 && sc.gpa === p!.gpa && sc.total === p!.total) ? ranks[p!.sid] : i + 1; });
  return ranks;
}
export function calcYearSummary(studentId: string, subjects: any[], allResults: any[]) {
  const res = allResults.filter((r: any) => r.studentId === studentId);
  const t3 = res.find((x: any) => x.term === '3');
  const hasT3 = t3 && subjects.some(s => t3.marks?.[s.name] !== undefined && t3.marks?.[s.name] !== null);
  if (!hasT3) return { finalGPA: null, avgTotalMarks: 0 };
  const ss = subjects.map(sub => { const ms = ['1', '2', '3'].map(t => { const r = res.find((x: any) => x.term === t); const m = r?.marks?.[sub.name]; return (m !== undefined && m !== null) ? +m : null; }).filter(m => m !== null) as number[]; const avg = ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : null; const g = avg !== null ? gradeFromMarks(avg, sub.fullMarks) : null; return { avg, gpa: g?.gpa ?? null }; }).filter(x => x.gpa !== null);
  if (!ss.length) return { finalGPA: null, avgTotalMarks: 0 };
  return { finalGPA: ss.reduce((a, x) => a + x.gpa!, 0) / ss.length, avgTotalMarks: ss.reduce((a, x) => a + x.avg!, 0) };
}
export function calcYearRanks(clsStudents: any[], subjects: any[], allResults: any[]) {
  const scores = clsStudents.map(s => { const { finalGPA, avgTotalMarks } = calcYearSummary(s.id, subjects, allResults); return { sid: s.id, finalGPA, avgTotalMarks }; }).filter(x => x.finalGPA !== null);
  scores.sort((a, b) => b.finalGPA! - a.finalGPA! || b.avgTotalMarks - a.avgTotalMarks);
  const ranks: Record<string, number> = {};
  scores.forEach((sc, i) => { const p = scores[i - 1]; ranks[sc.sid] = (i > 0 && sc.finalGPA === p!.finalGPA && sc.avgTotalMarks === p!.avgTotalMarks) ? ranks[p!.sid] : i + 1; });
  return ranks;
}
export function calcAttendPct(att: any) { return (!att?.days || att.days <= 0) ? '—' : ((att.present / att.days) * 100).toFixed(1) + '%'; }
