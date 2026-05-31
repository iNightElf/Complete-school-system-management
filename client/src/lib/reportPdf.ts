import jsPDF from 'jspdf';
import { gradeFromMarks, gpaToGrade, calcYearSummary, calcTermRanks, calcYearRanks, calcAttendPct } from './grading';

const API_URL = '/api';
const TERM_NAMES: Record<string, string> = { '1': '1st Term', '2': '2nd Term', '3': 'Final Exam' };

export function _pdfGradeChip(doc: jsPDF, cx: number, cy: number, grade: string) {
  const map: Record<string, [number[], number[]]> = {
    'A+': [[209, 250, 229], [6, 95, 70]], 'A': [[220, 252, 231], [22, 101, 52]],
    'A-': [[209, 250, 229], [21, 128, 61]], 'B+': [[219, 234, 254], [30, 64, 175]],
    'B': [[239, 246, 255], [29, 78, 216]], 'B-': [[240, 249, 255], [3, 105, 161]],
    'C+': [[254, 249, 195], [133, 77, 14]], 'C': [[254, 252, 232], [161, 98, 7]],
    'D': [[255, 237, 213], [194, 65, 12]], 'F': [[254, 226, 226], [185, 28, 28]],
  };
  const [bg, fg] = (map[grade] || [[243, 244, 246], [107, 114, 128]]) as unknown as [number[], number[]];
  doc.setFillColor(...(bg as [number, number, number]));
  doc.roundedRect(cx - 9, cy - 3, 18, 6, 3, 3, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
  doc.setTextColor(...(fg as [number, number, number]));
  doc.text(grade, cx, cy + 0.8, { align: 'center' });
  doc.setTextColor(26, 26, 46); doc.setFont('helvetica', 'normal');
}

export async function downloadReportCardPDF(student: any, clsName: string, subjects: any[], allResults: any[], term: string, sharedDoc?: jsPDF) {
  const doc = sharedDoc || new jsPDF({ format: 'a4', unit: 'mm' });
  if (sharedDoc) doc.addPage();

  // Fetch photo on-demand
  let photoDataUri: string | null = null;
  if (student.hasPhoto) {
    try { const r = await fetch(`${API_URL}/students/${student.id}/photo`, { credentials: 'include' }); const blob = await r.blob(); photoDataUri = await new Promise<string>(res => { const reader = new FileReader(); reader.onload = () => res(reader.result as string); reader.readAsDataURL(blob); }); } catch {}
  }

  const W = 210, M = 12, CW = W - M * 2;
  const NAVY = [26, 26, 46] as const, GREEN = [45, 106, 79] as const, RED = [200, 75, 49] as const, WHITE = [255, 255, 255] as const, MUTED = [130, 124, 114] as const, ROW1 = [255, 253, 247] as const, ROW2 = [244, 239, 230] as const;
  const isFinal = term === 'final';
  const label = isFinal ? 'Annual Result' : TERM_NAMES[term];
  const clsStudents = (await import('../store')).useSchoolStore.getState().students.filter((s: any) => s.class === clsName);
  const ranks = isFinal ? calcYearRanks(clsStudents, subjects, allResults) : calcTermRanks(clsStudents, term, subjects, allResults);
  const rank = ranks[student.id] || '—';
  const res = allResults.find((r: any) => r.studentId === student.id && r.term === (isFinal ? '3' : term));

  let y = 10;

  // HEADER with logo
  try {
    const logoEl = document.getElementById('school-logo') as HTMLImageElement;
    if (logoEl?.src) {
      const raw = logoEl.src.includes(',') ? logoEl.src.split(',')[1] : logoEl.src;
      doc.addImage(raw, 'JPEG', M, y, 22, 22);
    }
  } catch (_e) {}
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...NAVY);
  doc.text('AL RAWA English School', M + 26, y + 10);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTED);
  doc.text('ESTD: 2022  ·  Read in the name of your Lord', M + 26, y + 16);
  const badge = isFinal ? 'ANNUAL REPORT CARD — ANNUAL RESULT' : `TERM REPORT CARD — ${label.toUpperCase()}`;
  const bw = doc.getTextWidth(badge) + 14;
  doc.setFillColor(...RED); doc.roundedRect(M + 26, y + 19, bw, 6.5, 3.25, 3.25, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...WHITE);
  doc.text(badge, M + 26 + bw / 2, y + 23.5, { align: 'center' });
  y += 30;

  // STUDENT INFO
  if (photoDataUri) { try { doc.addImage(photoDataUri, 'JPEG', W - M - 26, y, 26, 30, '', 'FAST'); } catch (_e) {} }
  doc.setFontSize(9.5);
  const infoRows: [string, string][] = [['Student Name', student.name], ['Class', clsName]];
  if (student.roll) infoRows.push(['Roll No.', student.roll]);
  if (student.fatherName) infoRows.push(["Father's Name", student.fatherName]);
  if (student.motherName) infoRows.push(["Mother's Name", student.motherName]);
  infoRows.forEach(([k, v]) => {
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED); doc.text(k, M, y + 5.5);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY); doc.text(v, M + 36, y + 5.5);
    y += 7;
  });
  y = Math.max(y, 72);

  // Divider
  doc.setDrawColor(215, 210, 200); doc.setLineWidth(0.3); doc.line(M, y, W - M, y); y += 6;

  // SECTION TITLE
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...NAVY);
  doc.text(isFinal ? 'ANNUAL ACADEMIC RESULT' : `${label.toUpperCase()} — ACADEMIC RESULT`, M, y); y += 5;

  if (!isFinal) {
    // Single term table: Subject (Full Marks) | Marks Obtained | Grade | GPA
    const C = { s: { x: M, w: 78 }, mo: { x: M + 78, w: 52 }, gr: { x: M + 130, w: 30 }, gp: { x: M + 160, w: 26 } };
    const TW = CW, HH = 8, RH = 9;

    doc.setFillColor(...NAVY); doc.rect(M, y, TW, HH, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...WHITE);
    doc.text('Subject (Full Marks)', C.s.x + 4, y + HH / 2 + 1);
    doc.text('Marks Obtained', C.mo.x + C.mo.w / 2, y + HH / 2 + 1, { align: 'center' });
    doc.text('Grade', C.gr.x + C.gr.w / 2, y + HH / 2 + 1, { align: 'center' });
    doc.text('GPA', C.gp.x + C.gp.w / 2, y + HH / 2 + 1, { align: 'center' });
    y += HH;

    const tm = res?.marks || {};
    let totObt = 0, totFull = 0, gpas: number[] = [], hasF = false;

    subjects.forEach((subj, ri) => {
      if (y > 248) { doc.addPage(); y = 14; }
      const m = tm[subj.name];
      const obt = (m !== undefined && m !== null) ? +m : null;
      const g = obt !== null ? gradeFromMarks(obt, subj.fullMarks) : null;
      if (g) { gpas.push(g.gpa); if (g.grade === 'F') hasF = true; totObt += obt!; totFull += subj.fullMarks; }

      doc.setFillColor(...((ri % 2 === 0 ? ROW1 : ROW2) as [number, number, number])); doc.rect(M, y, TW, RH, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...NAVY);
      let nm = subj.name;
      while (doc.getTextWidth(nm) > C.s.w - 6 && nm.length > 2) nm = nm.slice(0, -1);
      doc.text(nm, C.s.x + 4, y + 4);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUTED);
      doc.text(`(${subj.fullMarks} marks)`, C.s.x + 4, y + 7.8);

      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...NAVY);
      if (obt !== null) doc.text(String(obt), C.mo.x + C.mo.w / 2, y + 6, { align: 'center' });
      else { doc.setTextColor(...MUTED); doc.text('—', C.mo.x + C.mo.w / 2, y + 6, { align: 'center' }); doc.setTextColor(...NAVY); }

      if (g) _pdfGradeChip(doc, C.gr.x + C.gr.w / 2, y + RH / 2, g.grade);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...NAVY);
      if (g) doc.text(g.gpa.toFixed(2), C.gp.x + C.gp.w / 2, y + 6, { align: 'center' });

      doc.setDrawColor(215, 210, 200); doc.setLineWidth(0.15); doc.line(M, y + RH, M + TW, y + RH); y += RH;
    });

    if (gpas.length) {
      doc.setFillColor(...NAVY); doc.rect(M, y, TW, 7, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...WHITE);
      doc.text('TOTAL', C.s.x + 4, y + 4.5);
      doc.text(`${totObt} / ${totFull}`, C.mo.x + C.mo.w / 2, y + 4.5, { align: 'center' });
      y += 7;
    }
    y += 6;

    // Result summary bar (navy)
    if (gpas.length) {
      if (y > 248) { doc.addPage(); y = 14; }
      const tGPA = gpas.reduce((a, b) => a + b, 0) / gpas.length;
      const tGr = hasF ? 'F' : gpaToGrade(tGPA);
      const BH = 22;
      doc.setFillColor(...NAVY); doc.rect(M, y, CW, BH, 'F');
      const sw = CW / 3;
      [[`${label.toUpperCase()} GPA`, tGPA.toFixed(2)], ['GRADE', tGr], ['CLASS RANK', String(rank)]].forEach(([lbl, val], i) => {
        const cx = M + i * sw + sw / 2;
        if (i > 0) { doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.3); doc.line(M + i * sw, y + 4, M + i * sw, y + BH - 4); }
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(160, 155, 145);
        doc.text(lbl, cx, y + 7, { align: 'center' });
        doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...WHITE);
        doc.text(val, cx, y + 18, { align: 'center' });
      });
      y += BH + 8;
    }
  } else {
    // Annual table: Subject | 1st | 2nd | Final | Average | Grade | GPA
    const C = { s: { x: M, w: 50 }, t1: { x: M + 50, w: 22 }, t2: { x: M + 72, w: 22 }, t3: { x: M + 94, w: 22 }, avg: { x: M + 116, w: 22 }, gr: { x: M + 138, w: 26 }, gp: { x: M + 164, w: 22 } };
    const TW = CW, H1 = 8, H2 = 7, RH = 8;

    // Header row 1
    doc.setFillColor(...NAVY);
    doc.rect(C.s.x, y, C.s.w, H1 + H2, 'F');
    doc.rect(C.t1.x, y, C.t1.w + C.t2.w + C.t3.w, H1, 'F');
    doc.setFillColor(...GREEN);
    doc.rect(C.avg.x, y, C.avg.w + C.gr.w + C.gp.w, H1, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...WHITE);
    doc.text('Subject', C.s.x + C.s.w / 2, y + H1 / 2 + 0.5, { align: 'center' });
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text('(Full Marks)', C.s.x + C.s.w / 2, y + H1 / 2 + 4, { align: 'center' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.text('Term Marks', C.t1.x + (C.t1.w + C.t2.w + C.t3.w) / 2, y + H1 / 2 + 1, { align: 'center' });
    doc.text('Annual Result', C.avg.x + (C.avg.w + C.gr.w + C.gp.w) / 2, y + H1 / 2 + 1, { align: 'center' });
    y += H1;

    // Header row 2
    doc.setFillColor(38, 38, 60);
    [C.t1, C.t2, C.t3, C.avg].forEach(col => doc.rect(col.x, y, col.w, H2, 'F'));
    doc.setFillColor(36, 84, 62);
    [C.gr, C.gp].forEach(col => doc.rect(col.x, y, col.w, H2, 'F'));
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...WHITE);
    ([['1st Term', C.t1], ['2nd Term', C.t2], ['Final Exam', C.t3], ['Average', C.avg], ['Grade', C.gr], ['GPA', C.gp]] as const).forEach(([lbl, col]) => {
      doc.text(lbl, (col as any).x + (col as any).w / 2, y + H2 / 2 + 0.8, { align: 'center' });
    });
    y += H2;

    // Data rows
    subjects.forEach((subj, ri) => {
      if (y > 248) { doc.addPage(); y = 14; }
      const getM = (t: string) => { const r = allResults.find((x: any) => x.studentId === student.id && x.term === t); const v = r?.marks?.[subj.name]; return (v !== undefined && v !== null) ? +v : null; };
      const m1 = getM('1'), m2 = getM('2'), m3 = getM('3');
      const vals = [m1, m2, m3].filter(m => m !== null) as number[];
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      const gAvg = avg !== null ? gradeFromMarks(avg, subj.fullMarks) : null;

      doc.setFillColor(...((ri % 2 === 0 ? ROW1 : ROW2) as [number, number, number])); doc.rect(M, y, TW, RH, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...NAVY);
      let nm = subj.name;
      while (doc.getTextWidth(nm) > C.s.w - 5 && nm.length > 2) nm = nm.slice(0, -1);
      doc.text(nm, C.s.x + 3, y + 3.8);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...MUTED);
      doc.text(`(${subj.fullMarks})`, C.s.x + 3, y + 7.2);

      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...NAVY);
      ([[m1, C.t1], [m2, C.t2], [m3, C.t3]] as const).forEach(([m, col]) => {
        if (m !== null) doc.text(String(m), col.x + col.w / 2, y + 5.5, { align: 'center' });
        else { doc.setTextColor(...MUTED); doc.text('—', col.x + col.w / 2, y + 5.5, { align: 'center' }); doc.setTextColor(...NAVY); }
      });
      if (avg !== null) { doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...NAVY); doc.text(avg.toFixed(1), C.avg.x + C.avg.w / 2, y + 5.5, { align: 'center' }); }
      if (gAvg) _pdfGradeChip(doc, C.gr.x + C.gr.w / 2, y + RH / 2, gAvg.grade);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...NAVY);
      if (gAvg) doc.text(gAvg.gpa.toFixed(2), C.gp.x + C.gp.w / 2, y + 5.5, { align: 'center' });
      doc.setDrawColor(215, 210, 200); doc.setLineWidth(0.15); doc.line(M, y + RH, M + TW, y + RH); y += RH;
    });
    y += 6;

    // Annual result bar
    const { finalGPA } = calcYearSummary(student.id, subjects, allResults);
    const finalGrade = finalGPA !== null ? gpaToGrade(finalGPA) : '—';
    if (y > 248) { doc.addPage(); y = 14; }
    const BH = 22;
    doc.setFillColor(...NAVY); doc.rect(M, y, CW, BH, 'F');
    const sw = CW / 3;
    [['ANNUAL GPA', finalGPA !== null ? finalGPA.toFixed(2) : '—'], ['FINAL GRADE', finalGrade], ['YEAR RANK', String(rank)]].forEach(([lbl, val], i) => {
      const cx = M + i * sw + sw / 2;
      if (i > 0) { doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.3); doc.line(M + i * sw, y + 4, M + i * sw, y + BH - 4); }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(160, 155, 145);
      doc.text(lbl, cx, y + 7, { align: 'center' });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...WHITE);
      doc.text(val, cx, y + 18, { align: 'center' });
    });
    y += BH + 8;
  }

  // ATTENDANCE + COMMENT (side by side)
  const GAP = 8;
  const COLW = (CW - GAP) / 2;
  const attX = M, cmtX = M + COLW + GAP;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...NAVY);
  doc.text(isFinal ? 'ATTENDANCE SUMMARY' : `ATTENDANCE — ${label.toUpperCase()}`, attX, y + 4.5);
  doc.text("TEACHER'S COMMENT", cmtX, y + 4.5);
  y += 8;

  const attStartY = y;
  if (!isFinal) {
    const att = res?.attendance;
    [['Total School Days', att?.days || '—'], ['Days Present', att?.present || '—'], ['Attendance', calcAttendPct(att)]].forEach(([k, v]) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTED); doc.text(k, attX + 2, y + 4);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...NAVY); doc.text(String(v), attX + COLW - 2, y + 4, { align: 'right' });
      y += 6.5;
    });
  } else {
    const aC = [31, 22, 18, 18]; const AH = 6;
    let ax = attX;
    doc.setFillColor(26, 26, 46); aC.forEach(w => { doc.rect(ax, y, w, AH, 'F'); ax += w; });
    ax = attX;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
    ['Term', 'Total Days', 'Present', 'Att%'].forEach((h, i) => {
      doc.setTextColor(255, 255, 255);
      const tw = doc.getTextWidth(h); const tx = i === 0 ? ax + 2 : ax + (aC[i] - tw) / 2;
      doc.text(h, tx, y + AH / 2 + 0.8); ax += aC[i];
    });
    y += AH;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    ['1', '2', '3'].forEach((t, ri) => {
      const att = allResults.find((x: any) => x.studentId === student.id && x.term === t)?.attendance;
      const vals = [TERM_NAMES[t], att?.days || '—', att?.present || '—', calcAttendPct(att)];
      ax = attX;
      doc.setFillColor(...((ri % 2 === 0 ? ROW1 : ROW2) as [number, number, number])); aC.forEach(w => { doc.rect(ax, y, w, AH, 'F'); ax += w; });
      ax = attX;
      vals.forEach((v, i) => {
        doc.setTextColor(26, 26, 46);
        const tw = doc.getTextWidth(String(v)); const tx = i === 0 ? ax + 2 : ax + (aC[i] - tw) / 2;
        doc.text(String(v), tx, y + AH / 2 + 0.8); ax += aC[i];
      });
      doc.setDrawColor(215, 210, 200); doc.setLineWidth(0.15); doc.line(attX, y + AH, attX + aC.reduce((a, b) => a + b, 0), y + AH); y += AH;
    });
  }
  const attEndY = y;

  // Comment box
  const boxH = Math.max(attEndY - attStartY, 20);
  const comment = res?.comment || '';
  doc.setFillColor(250, 248, 243); doc.setDrawColor(210, 205, 195); doc.setLineWidth(0.3);
  doc.roundedRect(cmtX, attStartY, COLW, boxH, 2, 2, 'FD');
  const cmtLines = doc.splitTextToSize(comment || 'No comment added.', COLW - 8);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.setTextColor(!comment ? MUTED[0] : NAVY[0], !comment ? MUTED[1] : NAVY[1], !comment ? MUTED[2] : NAVY[2]);
  doc.text(cmtLines, cmtX + 4, attStartY + 5);

  y = attEndY + 8;

  // SIGNATURES — near page bottom
  const sigY = Math.max(y, 270);
  const sigW = (CW - 20) / 3;
  doc.setDrawColor(100, 100, 100); doc.setLineWidth(0.5);
  ['CLASS TEACHER', 'CO-ORDINATOR', 'PRINCIPAL'].forEach((lbl, i) => {
    const sx = M + i * (sigW + 10);
    doc.line(sx, sigY, sx + sigW, sigY);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...MUTED);
    doc.text(lbl, sx + sigW / 2, sigY + 5.5, { align: 'center' });
  });

  if (!sharedDoc) doc.save(`${student.name.replace(/\s+/g, '_')}_${isFinal ? 'Annual' : label.replace(/ /g, '_')}_Report.pdf`);
}
