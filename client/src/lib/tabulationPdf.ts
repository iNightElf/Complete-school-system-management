import jsPDF from 'jspdf';
import { gradeFromMarks, gpaToGrade, calcYearRanks, calcTermRanks } from './grading';

const TERM_NAMES: Record<string, string> = { '1': '1st Term', '2': '2nd Term', '3': 'Final Exam' };

export function tabulationPDF({ clsName, subjects, clsStudents, allResults, term }: { clsName: string; subjects: any[]; clsStudents: any[]; allResults: any[]; term: string }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = 297, H = 210, M = 10, CW = 277;
  if (!clsStudents.length) return;

  const isFinal = term === 'final';
  const tLabel = isFinal ? 'Annual Combined' : TERM_NAMES[term];
  const NAVY = [26, 26, 46], GREEN = [45, 106, 79], WHITE = [255, 255, 255], MUTED = [140, 134, 124];
  const ROW1 = [255, 253, 247], ROW2 = [244, 239, 230];
  const NAME_W = 40;
  const SUM_COLS: [string, number][] = [['Total', 16], ['GPA', 14], ['Grade', 14], ['Rank', 12]];
  const SUM_W = 56;
  const n = subjects.length;
  const SW = Math.max(14, Math.min(28, Math.floor((CW - NAME_W - SUM_W) / Math.max(n, 1))));
  const HH = 12, RH = 14;

  const allRanks = isFinal ? calcYearRanks(clsStudents, subjects, allResults) : calcTermRanks(clsStudents, term, subjects, allResults);

  function drawHeader() {
    let y = M;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...NAVY);
    doc.text(`${clsName}  —  Tabulation Sheet  (${tLabel})`, W / 2, y + 6, { align: 'center' });
    y += 13;
    doc.setFillColor(...NAVY); doc.rect(M, y, NAME_W, HH, 'F');
    let ax = M + NAME_W;
    subjects.forEach(() => { doc.setFillColor(...NAVY); doc.rect(ax, y, SW, HH, 'F'); ax += SW; });
    SUM_COLS.forEach(([, w]) => { doc.setFillColor(...(isFinal ? GREEN : NAVY)); doc.rect(ax, y, w, HH, 'F'); ax += w; });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...WHITE);
    doc.text('Student Name', M + 3, y + HH / 2 + 1);
    ax = M + NAME_W;
    subjects.forEach((subj) => {
      doc.setFontSize(6); let nm = subj.name;
      while (doc.getTextWidth(nm) > SW - 2 && nm.length > 2) nm = nm.slice(0, -1);
      doc.text(nm, ax + (SW - doc.getTextWidth(nm)) / 2, y + 4.5);
      doc.setFontSize(5.5); const fm = `(${subj.fullMarks})`;
      doc.text(fm, ax + (SW - doc.getTextWidth(fm)) / 2, y + 9.5);
      ax += SW;
    });
    SUM_COLS.forEach(([h, w]) => { doc.setFontSize(7); doc.text(h, ax + (w - doc.getTextWidth(h)) / 2, y + HH / 2 + 1); ax += w; });
    return y + HH;
  }

  let y = drawHeader();

  clsStudents.forEach((s, ri) => {
    if (y + RH > H - M) { doc.addPage(); y = drawHeader(); }
    const studentResults = allResults.filter((x: any) => x.studentId === s.id);
    const bg = ri % 2 === 0 ? ROW1 : ROW2;
    let ax = M;
    doc.setFillColor(...bg);
    doc.rect(ax, y, NAME_W, RH, 'F'); ax += NAME_W;
    subjects.forEach(() => { doc.rect(ax, y, SW, RH, 'F'); ax += SW; });
    SUM_COLS.forEach(([, w]) => { doc.rect(ax, y, w, RH, 'F'); ax += w; });
    doc.setTextColor(...NAVY); doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
    let nm = s.name;
    while (doc.getTextWidth(nm) > NAME_W - 4 && nm.length > 2) nm = nm.slice(0, -1);
    doc.text(nm, M + 3, y + RH / 2 + 0.8);
    ax = M + NAME_W;
    let totObt = 0, gpas: number[] = [], hasF = false;
    subjects.forEach((subj) => {
      let obt: number | null = null, g: any = null;
      if (isFinal) {
        const ms = ['1', '2', '3'].map(t => { const r = studentResults.find((x: any) => x.term === t); const v = r?.marks?.[subj.name]; return (v !== undefined && v !== null) ? +v : null; }).filter(v => v !== null) as number[];
        if (ms.length) { obt = ms.reduce((a, b) => a + b, 0) / ms.length; g = gradeFromMarks(obt, subj.fullMarks); }
      } else {
        const r = studentResults.find((x: any) => x.term === term);
        const v = r?.marks?.[subj.name];
        if (v !== undefined && v !== null) { obt = +v; g = gradeFromMarks(obt, subj.fullMarks); }
      }
      if (obt !== null && g) { totObt += obt; gpas.push(g.gpa); if (g.grade === 'F') hasF = true;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...NAVY);
        const ms = isFinal ? obt.toFixed(1) : String(obt);
        doc.text(ms, ax + (SW - doc.getTextWidth(ms)) / 2, y + 5.5);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(5.5); doc.setTextColor(70, 70, 110);
        const chip = `(${g.grade}, ${g.gpa.toFixed(2)})`;
        doc.text(chip, ax + (SW - doc.getTextWidth(chip)) / 2, y + 10.5);
      } else {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
        doc.text('\u2014', ax + (SW - doc.getTextWidth('\u2014')) / 2, y + RH / 2 + 0.8);
      }
      doc.setDrawColor(215, 210, 200); doc.setLineWidth(0.2); doc.rect(ax, y, SW, RH, 'S');
      ax += SW;
    });
    const tGPA = gpas.length ? gpas.reduce((a, b) => a + b, 0) / gpas.length : null;
    const tGrade = tGPA !== null ? (hasF ? 'F' : gpaToGrade(tGPA)) : '\u2014';
    const tRank = allRanks[s.id] || '\u2014';
    const sVals = [gpas.length ? totObt.toFixed(1) : '\u2014', tGPA !== null ? tGPA.toFixed(2) : '\u2014', tGrade, String(tRank)];
    SUM_COLS.forEach(([, w], si) => {
      doc.setFont('helvetica', si === 2 ? 'bold' : 'normal'); doc.setFontSize(7.5); doc.setTextColor(...NAVY);
      const sv = sVals[si]; doc.text(sv, ax + (w - doc.getTextWidth(sv)) / 2, y + RH / 2 + 0.8);
      doc.setDrawColor(215, 210, 200); doc.setLineWidth(0.2); doc.rect(ax, y, w, RH, 'S'); ax += w;
    });
    doc.setDrawColor(215, 210, 200); doc.setLineWidth(0.2); doc.rect(M, y, NAME_W, RH, 'S');
    y += RH;
  });

  doc.save(`${clsName.replace(/\s+/g, '_')}_Tabulation_${tLabel.replace(/\s+/g, '_')}.pdf`);
}
