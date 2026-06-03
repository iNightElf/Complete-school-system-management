import jsPDF from 'jspdf';
import { FISCAL_START_LABEL, FISCAL_END_LABEL } from './config';
import { SCHOOL_LOGO } from './logo';

export function getMonthName(m: number) {
  return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m];
}

export function getMonthNameShort(m: number) {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m];
}

export function fmt(n: number) {
  return n.toLocaleString('en-BD');
}

export function addLogo(doc: jsPDF, y: number) {
  try {
    const raw = SCHOOL_LOGO.includes(',') ? SCHOOL_LOGO.split(',')[1] : SCHOOL_LOGO;
    doc.addImage(raw, 'UNKNOWN', 12, y, 18, 18);
  } catch { console.debug('Photo load skipped'); }
}

export function addHeader(doc: jsPDF, title: string, subtitle: string, y: number) {
  addLogo(doc, y);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(26, 26, 46);
  doc.text('AL RAWA English School', 34, y + 8);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(130, 124, 114);
  doc.text('ESTD: 2022  ·  Read in the name of your Lord', 34, y + 13);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(26, 26, 46);
  doc.text(title, 12, y + 26);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(130, 124, 114);
  doc.text(subtitle, 12, y + 31);
  return y + 38;
}

export function headwise(data: any[]) {
  const map: Record<string, number> = {};
  data.forEach(t => { const cat = t.category || 'Uncategorized'; map[cat] = (map[cat] || 0) + Number(t.amount); });
  return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function subtitleForRange(dateFrom: string, dateTo: string) {
  return `${getMonthName(Number(dateFrom.split('-')[1]) - 1)} ${dateFrom.split('-')[0]} — ${getMonthName(Number(dateTo.split('-')[1]) - 1)} ${dateTo.split('-')[0]}`;
}

export function pdfHeadwiseIncome(categories: { category: string; total: number; count: number; uniqueStudents: number }[], grandTotal: number, dateFrom: string, dateTo: string) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  let y = addHeader(doc, 'HEADWISE INCOME REPORT', subtitleForRange(dateFrom, dateTo), 10);

  doc.setFillColor(26, 26, 46); doc.rect(12, y, 186, 7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(255, 255, 255);
  doc.text('Category', 14, y + 4.5); doc.text('Amount', 120, y + 4.5, { align: 'right' }); doc.text('% Share', 160, y + 4.5, { align: 'right' }); doc.text('Count', 186, y + 4.5, { align: 'right' });
  y += 7;

  categories.forEach(({ category: cat, total: amt, count }, i) => {
    const pct = grandTotal > 0 ? ((amt / grandTotal) * 100).toFixed(1) : '0';
    if (i % 2 === 0) { doc.setFillColor(255, 253, 247); doc.rect(12, y, 186, 6, 'F'); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(26, 26, 46);
    doc.text(cat, 14, y + 4); doc.text(fmt(amt), 120, y + 4, { align: 'right' });
    doc.text(`${pct}%`, 160, y + 4, { align: 'right' }); doc.text(String(count), 186, y + 4, { align: 'right' });
    y += 6;
  });

  doc.setFillColor(240, 235, 225); doc.rect(12, y, 186, 7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(26, 26, 46);
  doc.text(`TOTAL INCOME: ${fmt(grandTotal)} /-`, 14, y + 4.5);
  doc.text(`${categories.length} categories`, 186, y + 4.5, { align: 'right' });

  doc.save(`Headwise_Income_${dateFrom}_to_${dateTo}.pdf`);
}

export function pdfHeadwiseExpense(categories: { category: string; total: number; count: number }[], grandTotal: number, dateFrom: string, dateTo: string) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  let y = addHeader(doc, 'HEADWISE EXPENSE REPORT', subtitleForRange(dateFrom, dateTo), 10);

  doc.setFillColor(26, 26, 46); doc.rect(12, y, 186, 7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(255, 255, 255);
  doc.text('Category', 14, y + 4.5); doc.text('Amount', 120, y + 4.5, { align: 'right' }); doc.text('% Share', 160, y + 4.5, { align: 'right' }); doc.text('Count', 186, y + 4.5, { align: 'right' });
  y += 7;

  categories.forEach(({ category: cat, total: amt, count }, i) => {
    const pct = grandTotal > 0 ? ((amt / grandTotal) * 100).toFixed(1) : '0';
    if (i % 2 === 0) { doc.setFillColor(255, 253, 247); doc.rect(12, y, 186, 6, 'F'); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(26, 26, 46);
    doc.text(cat, 14, y + 4); doc.text(fmt(amt), 120, y + 4, { align: 'right' });
    doc.text(`${pct}%`, 160, y + 4, { align: 'right' }); doc.text(String(count), 186, y + 4, { align: 'right' });
    y += 6;
  });

  doc.setFillColor(240, 235, 225); doc.rect(12, y, 186, 7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(26, 26, 46);
  doc.text(`TOTAL EXPENSE: ${fmt(grandTotal)} /-`, 14, y + 4.5);
  doc.text(`${categories.length} categories`, 186, y + 4.5, { align: 'right' });

  doc.save(`Headwise_Expense_${dateFrom}_to_${dateTo}.pdf`);
}

export function pdfMonthly(type: 'income' | 'expense', data: any[], _precomputedTotal: number, dateFrom: string, dateTo: string) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const title = type === 'income' ? 'MONTHLY INCOME REPORT' : 'MONTHLY EXPENSE REPORT';
  let y = addHeader(doc, title, subtitleForRange(dateFrom, dateTo), 10);

  if (!data.length) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(130, 124, 114);
    doc.text('No data for this period.', 12, y + 10);
    doc.save(`${title.replace(/ /g, '_')}_${dateFrom}_to_${dateTo}.pdf`);
    return;
  }

  const M = 12, PW = 186;
  const dateW = 26, descW = 80, catW = 32, amtW = 24, balW = 24;
  const headerH = 7, rowH = 5;
  const amountColor: [number, number, number] = type === 'income' ? [22, 101, 52] : [185, 28, 28];
  const catX = M + dateW + descW;
  const amtX = catX + catW;
  const balX = amtX + amtW;

  // Sort all transactions by date (flat list, no grouping)
  const sorted = [...data].sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());

  let grandTotal = 0;

  function drawTableHeader() {
    doc.setFillColor(26, 26, 46);
    doc.rect(M, y, PW, headerH, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(255, 255, 255);
    doc.text('Date', M + 2, y + 4.5);
    doc.text('Class / Student', M + dateW + 2, y + 4.5);
    doc.text('Category', catX + 2, y + 4.5);
    doc.text('Amount', amtX + amtW - 2, y + 4.5, { align: 'right' });
    doc.text('Running', balX + balW - 2, y + 4.5, { align: 'right' });
    y += headerH;
  }

  drawTableHeader();

  sorted.forEach((t, i) => {
    if (y > 270) { doc.addPage(); y = 14; drawTableHeader(); }
    if (i % 2 === 0) { doc.setFillColor(255, 253, 247); doc.rect(M, y, PW, rowH, 'F'); }

    const dateStr = new Date(t.transactionDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const studentName = t.student?.name || '';
    const classStudent = [t.className || '', studentName].filter(Boolean).join(' / ') || t.description || `${(t.sourceAccount || '').replace(/_/g, ' ')} -> ${(t.destinationAccount || '').replace(/_/g, ' ')}`;
    grandTotal += Number(t.amount);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
    doc.setTextColor(80, 80, 80);
    doc.text(dateStr, M + 2, y + 3.5);
    doc.setTextColor(26, 26, 46);
    doc.text(classStudent.substring(0, 38), M + dateW + 2, y + 3.5);
    doc.setTextColor(130, 124, 114);
    doc.text((t.category || 'Uncategorized').substring(0, 18), catX + 2, y + 3.5);
    doc.setTextColor(...amountColor);
    doc.text(fmt(Number(t.amount)) + ' /-', amtX + amtW - 2, y + 3.5, { align: 'right' });
    doc.setTextColor(130, 124, 114);
    doc.text(fmt(grandTotal) + ' /-', balX + balW - 2, y + 3.5, { align: 'right' });
    y += rowH;
  });

  // Grand total
  if (y > 260) { doc.addPage(); y = 14; }
  doc.setFillColor(26, 26, 46);
  doc.rect(M, y, PW, 8, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
  doc.text(`TOTAL (${sorted.length} transactions)`, M + 2, y + 5.5);
  doc.text(fmt(grandTotal) + ' /-', balX + balW - 2, y + 5.5, { align: 'right' });

  doc.save(`${title.replace(/ /g, '_')}_${dateFrom}_to_${dateTo}.pdf`);
}

export function pdfAudit(data: { totalIncome: number; totalExpense: number; netSurplus: number; incomeByCategory: [string, number][]; expenseByCategory: [string, number][] }, yearFilter: string) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  let y = addHeader(doc, 'ANNUAL AUDIT REPORT', `Financial Year ${Number(yearFilter)-1}-${yearFilter} (${FISCAL_START_LABEL} ${Number(yearFilter)-1} – ${FISCAL_END_LABEL} ${yearFilter})`, 10);

  const { totalIncome, totalExpense, netSurplus, incomeByCategory: inc, expenseByCategory: exp } = data;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(26, 26, 46);
  doc.text('FINANCIAL SUMMARY', 12, y); y += 7;

  const summaryRows: [string, string][] = [
    ['Total Income', `${fmt(totalIncome)} /-`],
    ['Total Expense', `${fmt(totalExpense)} /-`],
    ['Net Surplus / (Deficit)', `${fmt(netSurplus)} /-`],
  ];
  summaryRows.forEach(([k, v], i) => {
    doc.setFillColor(i % 2 === 0 ? 255 : 244, i % 2 === 0 ? 253 : 239, i % 2 === 0 ? 247 : 230);
    doc.rect(12, y, 186, 7, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(26, 26, 46);
    doc.text(k, 14, y + 4.5); doc.setFont('helvetica', 'bold');
    doc.text(v, 196, y + 4.5, { align: 'right' });
    y += 7;
  });
  y += 6;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('INCOME BY CATEGORY', 12, y); y += 7;
  doc.setFillColor(26, 26, 46); doc.rect(12, y, 186, 6, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(255, 255, 255);
  doc.text('Category', 14, y + 4); doc.text('Amount', 120, y + 4, { align: 'right' }); doc.text('%', 160, y + 4, { align: 'right' }); doc.text('Count', 186, y + 4, { align: 'right' });
  y += 6;
  inc.forEach(([cat, amt]: [string, number], i: number) => {
    if (y > 270) { doc.addPage(); y = 14; }
    const pct = totalIncome > 0 ? ((amt / totalIncome) * 100).toFixed(1) : '0';
    if (i % 2 === 0) { doc.setFillColor(255, 253, 247); doc.rect(12, y, 186, 6, 'F'); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(26, 26, 46);
    doc.text(cat, 14, y + 4); doc.text(fmt(amt), 120, y + 4, { align: 'right' });
    doc.text(`${pct}%`, 160, y + 4, { align: 'right' });
    y += 6;
  });
  y += 6;

  if (y > 200) { doc.addPage(); y = 14; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(26, 26, 46);
  doc.text('EXPENSE BY CATEGORY', 12, y); y += 7;
  doc.setFillColor(26, 26, 46); doc.rect(12, y, 186, 6, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(255, 255, 255);
  doc.text('Category', 14, y + 4); doc.text('Amount', 120, y + 4, { align: 'right' }); doc.text('%', 160, y + 4, { align: 'right' }); doc.text('Count', 186, y + 4, { align: 'right' });
  y += 6;
  exp.forEach(([cat, amt]: [string, number], i: number) => {
    if (y > 270) { doc.addPage(); y = 14; }
    const pct = totalExpense > 0 ? ((amt / totalExpense) * 100).toFixed(1) : '0';
    if (i % 2 === 0) { doc.setFillColor(255, 253, 247); doc.rect(12, y, 186, 6, 'F'); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(26, 26, 46);
    doc.text(cat, 14, y + 4); doc.text(fmt(amt), 120, y + 4, { align: 'right' });
    doc.text(`${pct}%`, 160, y + 4, { align: 'right' });
    y += 6;
  });
  y += 8;

  if (y > 230) { doc.addPage(); y = 14; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(26, 26, 46);
  doc.text('AUDIT CERTIFICATE', 12, y); y += 8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
  const certText = `This is to certify that the accounts of AL RAWA English School for the financial year ${Number(yearFilter)-1}-${yearFilter} (${FISCAL_START_LABEL} ${Number(yearFilter)-1} – ${FISCAL_END_LABEL} ${yearFilter}) have been examined. Total income stood at ${fmt(totalIncome)} /- and total expenditure at ${fmt(totalExpense)} /-, resulting in a net surplus of ${fmt(netSurplus)} /-. All transactions have been verified against supporting documents.`;
  const lines = doc.splitTextToSize(certText, 186);
  doc.text(lines, 12, y); y += lines.length * 5 + 10;

  const sigW = 60;
  ([['Prepared By', 12], ['Finance Officer', 82], ['Principal', 152]] as const).forEach(([lbl, sx]) => {
    doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.3);
    doc.line(sx, y, sx + sigW, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130, 124, 114);
    doc.text(lbl, sx + sigW / 2, y + 4, { align: 'center' });
  });

  doc.save(`Audit_Report_${yearFilter}.pdf`);
}

export function pdfYearlyAGM(
  income: any[], expense: any[],
  totalIncome: number, totalExpense: number, netSurplus: number,
  opening: { AL_RAWA_BANK?: number; GLOBAL_FORUM_BANK?: number; CASH_IN_HAND?: number },
  closing: { AL_RAWA_BANK: number; GLOBAL_FORUM_BANK: number; CASH_IN_HAND: number },
  totalAssets: number, totalTransfers: number, transactionCount: number,
  yearFilter: string,
) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  let y = addHeader(doc, 'ANNUAL GENERAL MEETING REPORT', `Session: ${Number(yearFilter)-1}-${yearFilter} (${FISCAL_START_LABEL} ${Number(yearFilter)-1} – ${FISCAL_END_LABEL} ${yearFilter})`, 10);

  const fyLabel = `${Number(yearFilter)-1}-${yearFilter}`;

  // ── 1. INCOME AND EXPENDITURE STATEMENT ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(26, 26, 46);
  doc.text('1. INCOME AND EXPENDITURE STATEMENT', 12, y); y += 8;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(130, 124, 114);
  doc.text(`For the financial year ${fyLabel} (${FISCAL_START_LABEL} ${Number(yearFilter)-1} – ${FISCAL_END_LABEL} ${yearFilter})`, 12, y); y += 6;

  // Income heads
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(26, 26, 46);
  doc.text('Income', 12, y); y += 5;
  (income as [string, number][]).forEach(([cat, amt]) => {
    if (y > 270) { doc.addPage(); y = 14; }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(26, 26, 46);
    doc.text(cat, 14, y + 4); doc.text(fmt(amt) + ' /-', 196, y + 4, { align: 'right' });
    y += 5;
  });
  doc.setFillColor(240, 235, 225); doc.rect(12, y, 186, 6, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('Total Income', 14, y + 4); doc.text(fmt(totalIncome) + ' /-', 196, y + 4, { align: 'right' });
  y += 9;

  // Expense heads
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(26, 26, 46);
  doc.text('Expenditure', 12, y); y += 5;
  (expense as [string, number][]).forEach(([cat, amt]) => {
    if (y > 270) { doc.addPage(); y = 14; }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(26, 26, 46);
    doc.text(cat, 14, y + 4); doc.text(fmt(amt) + ' /-', 196, y + 4, { align: 'right' });
    y += 5;
  });
  doc.setFillColor(240, 235, 225); doc.rect(12, y, 186, 6, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('Total Expenditure', 14, y + 4); doc.text(fmt(totalExpense) + ' /-', 196, y + 4, { align: 'right' });
  y += 9;

  // Annual Surplus / Deficit
  doc.setFillColor(26, 26, 46); doc.rect(12, y, 186, 7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
  doc.text(`ANNUAL ${netSurplus >= 0 ? 'SURPLUS' : 'DEFICIT'}`, 14, y + 4.5);
  doc.text(fmt(Math.abs(netSurplus)) + ' /-', 196, y + 4.5, { align: 'right' });
  y += 12;

  // ── 2. BALANCE SHEET ──
  if (y > 200) { doc.addPage(); y = 14; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(26, 26, 46);
  doc.text('2. BALANCE SHEET', 12, y); y += 8;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(130, 124, 114);
  doc.text(`As at 31 August ${yearFilter}`, 12, y); y += 6;

  // Assets table
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(26, 26, 46);
  doc.text('Assets', 12, y); y += 6;

  doc.setFillColor(26, 26, 46); doc.rect(12, y, 186, 6, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(255, 255, 255);
  doc.text('Account', 14, y + 4); doc.text('Balance', 196, y + 4, { align: 'right' });
  y += 6;

  const assetRows: [string, number][] = [
    ['AL RAWA Bank', closing.AL_RAWA_BANK],
    ['Global Forum Bank', closing.GLOBAL_FORUM_BANK],
    ['Cash in Hand', closing.CASH_IN_HAND],
  ];
  assetRows.forEach(([name, val], i) => {
    if (i % 2 === 0) { doc.setFillColor(255, 253, 247); doc.rect(12, y, 186, 6, 'F'); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(26, 26, 46);
    doc.text(name, 14, y + 4); doc.text(fmt(val) + ' /-', 196, y + 4, { align: 'right' });
    y += 6;
  });
  doc.setFillColor(240, 235, 225); doc.rect(12, y, 186, 6, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('Total Assets', 14, y + 4); doc.text(fmt(totalAssets) + ' /-', 196, y + 4, { align: 'right' });
  y += 9;

  // Net Assets
  doc.setFillColor(26, 26, 46); doc.rect(12, y, 186, 7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
  doc.text('NET ASSETS (Total Assets)', 14, y + 4.5);
  doc.text(fmt(totalAssets) + ' /-', 196, y + 4.5, { align: 'right' });
  y += 12;

  // ── 3. RECEIPTS AND PAYMENTS STATEMENT ──
  if (y > 200) { doc.addPage(); y = 14; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(26, 26, 46);
  doc.text('3. RECEIPTS AND PAYMENTS STATEMENT', 12, y); y += 8;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(130, 124, 114);
  doc.text(`For the financial year ${fyLabel}`, 12, y); y += 6;

  const openingAL = opening.AL_RAWA_BANK ?? 0;
  const openingGF = opening.GLOBAL_FORUM_BANK ?? 0;
  const openingCash = opening.CASH_IN_HAND ?? 0;

  doc.setFillColor(26, 26, 46); doc.rect(12, y, 186, 6, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(255, 255, 255);
  doc.text('', 14, y + 4); doc.text('Opening', 130, y + 4, { align: 'right' }); doc.text('Closing', 196, y + 4, { align: 'right' });
  y += 6;

  const rpRows: [string, number, number][] = [
    ['AL RAWA Bank', openingAL, closing.AL_RAWA_BANK],
    ['Global Forum Bank', openingGF, closing.GLOBAL_FORUM_BANK],
    ['Cash in Hand', openingCash, closing.CASH_IN_HAND],
  ];
  rpRows.forEach(([name, open, close], i) => {
    if (i % 2 === 0) { doc.setFillColor(255, 253, 247); doc.rect(12, y, 186, 6, 'F'); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(26, 26, 46);
    doc.text(name, 14, y + 4); doc.text(fmt(open) + ' /-', 130, y + 4, { align: 'right' }); doc.text(fmt(close) + ' /-', 196, y + 4, { align: 'right' });
    y += 6;
  });

  // Totals row
  const openTotal = openingAL + openingGF + openingCash;
  const closeTotal = totalAssets;
  doc.setFillColor(240, 235, 225); doc.rect(12, y, 186, 6, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('Total', 14, y + 4); doc.text(fmt(openTotal) + ' /-', 130, y + 4, { align: 'right' }); doc.text(fmt(closeTotal) + ' /-', 196, y + 4, { align: 'right' });
  y += 9;

  // Summary
  const totalReceived = totalIncome;
  const totalPaid = totalExpense;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(26, 26, 46);
  doc.text(`Total Cash Received: ${fmt(totalReceived)} /-`, 14, y + 4); y += 5;
  doc.text(`Total Cash Paid: ${fmt(totalPaid)} /-`, 14, y + 4); y += 5;
  doc.text(`Net Movement: ${fmt(totalReceived - totalPaid)} /-`, 14, y + 4); y += 12;

  // ── 4. INTERNAL TRANSFERS ──
  if (y > 200) { doc.addPage(); y = 14; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(26, 26, 46);
  doc.text('4. INTERNAL TRANSFERS', 12, y); y += 7;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(26, 26, 46);
  doc.text(`Total Internal Transfers: ${fmt(totalTransfers)} /-`, 14, y); y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(130, 124, 114);
  doc.text('Note: Internal transfers between bank accounts and Cash in Hand do not affect the income/expense ledger.', 14, y); y += 10;

  // ── 5. RECOMMENDATIONS ──
  if (y > 200) { doc.addPage(); y = 14; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(26, 26, 46);
  doc.text('5. RECOMMENDATIONS', 12, y); y += 8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
  const recs = [
    `Net surplus of ${fmt(netSurplus)} /- for FY ${fyLabel}.`,
    totalIncome > 0 ? `Expense-to-income ratio: ${((totalExpense / totalIncome) * 100).toFixed(1)}%.` : 'No income recorded.',
    `Total assets stand at ${fmt(totalAssets)} /- across 3 accounts.`,
    `${transactionCount} total transactions recorded during the year.`,
    'All financial records are available for detailed audit.',
  ];
  recs.forEach((r, i) => {
    doc.text(`${i + 1}. ${r}`, 14, y); y += 5;
  });
  y += 10;

  // ── SIGNATURES ──
  if (y > 240) { doc.addPage(); y = 14; }
  const sigW = 55;
  ([['Finance Director', 12], ['Managing Director', 82], ['Chairman', 144]] as const).forEach(([lbl, sx]) => {
    doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.3);
    doc.line(sx, y, sx + sigW, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130, 124, 114);
    doc.text(lbl, sx + sigW / 2, y + 4, { align: 'center' });
  });

  doc.save(`AGM_Report_${fyLabel.replace('-', '_')}.pdf`);
}

export function pdfLedger(entries: any[], account: string, dateFrom: string, dateTo: string, openingBalance: number, closingBalance: number) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  const accLabel = account === 'AL_RAWA_BANK' ? 'AL RAWA Bank' : 'Cash in Hand';
  const rangeStr = dateFrom || dateTo ? `${dateFrom || 'earliest'} — ${dateTo || 'latest'}` : 'All dates';
  let y = addHeader(doc, `${accLabel} Ledger`, rangeStr, 10);

  const M = 12, PW = 186;
  const dateW = 28, typeW = 20, debitW = 38, creditW = 38, balW = 0;
  const headerH = 7, rowH = 5;

  function drawTableHeader() {
    doc.setFillColor(26, 26, 46);
    doc.rect(M, y, PW, headerH, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(255, 255, 255);
    doc.text('Date', M + 2, y + 4.5);
    doc.text('Type', M + dateW + 2, y + 4.5);
    doc.text('Description', M + dateW + typeW + 2, y + 4.5);
    doc.text('Debit', M + PW - debitW - creditW - balW - 2, y + 4.5, { align: 'right' });
    doc.text('Credit', M + PW - creditW - balW - 2, y + 4.5, { align: 'right' });
    doc.text('Balance', M + PW - balW - 2, y + 4.5, { align: 'right' });
    y += headerH;
  }

  if (!entries.length) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(130, 124, 114);
    doc.text('No entries for this period.', M, y + 10);
    doc.save(`${accLabel.replace(/\s+/g, '_')}_Ledger_${dateFrom || 'all'}_to_${dateTo || 'all'}.pdf`);
    return;
  }

  let totalDebits = 0, totalCredits = 0;

  function drawOpeningRow() {
    doc.setFillColor(244, 244, 244);
    doc.rect(M, y, PW, rowH, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(100, 100, 100);
    doc.text('Opening Balance', M + 2, y + 3.5);
    doc.text(fmt(openingBalance) + ' /-', M + PW - 2, y + 3.5, { align: 'right' });
    y += rowH;
  }

  drawTableHeader();
  drawOpeningRow();

  entries.forEach((e: any, i: number) => {
    if (y > 270) { doc.addPage(); y = 14; drawTableHeader(); drawOpeningRow(); }
    if (i % 2 === 0) { doc.setFillColor(255, 253, 247); doc.rect(M, y, PW, rowH, 'F'); }

    const dateStr = new Date(e.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const typeLabel = e.transactionType === 'INTERNAL_TRANSFER' ? 'Transfer' : e.transactionType;
    const debit = e.debit || 0;
    const credit = e.credit || 0;
    totalDebits += debit;
    totalCredits += credit;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
    doc.setTextColor(80, 80, 80);
    doc.text(dateStr, M + 2, y + 3.5);
    doc.setTextColor(26, 26, 46);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6);
    doc.text(typeLabel, M + dateW + 2, y + 3.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
    doc.setTextColor(130, 124, 114);
    doc.text((e.description || '').substring(0, 42), M + dateW + typeW + 2, y + 3.5);
    if (debit) {
      doc.setTextColor(22, 101, 52); doc.setFont('helvetica', 'bold');
      doc.text(fmt(debit) + ' /-', M + PW - debitW - creditW - balW - 2, y + 3.5, { align: 'right' });
    }
    if (credit) {
      doc.setTextColor(185, 28, 28); doc.setFont('helvetica', 'bold');
      doc.text(fmt(credit) + ' /-', M + PW - creditW - balW - 2, y + 3.5, { align: 'right' });
    }
    doc.setTextColor(26, 26, 46); doc.setFont('helvetica', 'bold');
    doc.text(fmt(e.runningBalance) + ' /-', M + PW - 2, y + 3.5, { align: 'right' });
    y += rowH;
  });

  if (y > 260) { doc.addPage(); y = 14; }
  doc.setFillColor(26, 26, 46);
  doc.rect(M, y, PW, 8, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
  doc.text(`Total Dr: ${fmt(totalDebits)}  /  Total Cr: ${fmt(totalCredits)}`, M + 2, y + 5.5);
  doc.text(`Closing: ${fmt(closingBalance)} /-`, M + PW - 2, y + 5.5, { align: 'right' });

  doc.save(`${accLabel.replace(/\s+/g, '_')}_Ledger_${dateFrom || 'all'}_to_${dateTo || 'all'}.pdf`);
}

export function buildLedgerPrintHtml(entries: any[], account: string, dateFrom: string, dateTo: string, openingBalance: number, closingBalance: number, fmt: (n: number) => string) {
  const accLabel = account === 'AL_RAWA_BANK' ? 'AL RAWA Bank' : 'Cash in Hand';
  const rangeStr = dateFrom || dateTo ? `${dateFrom || 'earliest'} — ${dateTo || 'latest'}` : 'All dates';
  const rows = entries.map((e: any) => {
    const typeLabel = e.transactionType === 'INTERNAL_TRANSFER' ? 'Transfer' : e.transactionType;
    const debit = e.debit || 0;
    const credit = e.credit || 0;
    return `<tr>
      <td>${new Date(e.date).toLocaleDateString()}</td>
      <td><span class="type-${e.transactionType.toLowerCase()}">${typeLabel}</span></td>
      <td>${e.description || '—'}</td>
      <td class="debit">${debit ? fmt(debit) : '—'}</td>
      <td class="credit">${credit ? fmt(credit) : '—'}</td>
      <td class="balance">${fmt(e.runningBalance)}</td>
    </tr>`;
  }).join('');
  const totalDebits = entries.reduce((s: number, e: any) => s + (e.debit || 0), 0);
  const totalCredits = entries.reduce((s: number, e: any) => s + (e.credit || 0), 0);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${accLabel} Ledger</title>
<style>
  body{font-family:system-ui,sans-serif;padding:30px;color:#1a1a2e;font-size:12px;max-width:1200px;margin:auto}
  h1{font-size:18px;margin:0 0 2px}h2{font-size:12px;margin:0 0 16px;color:#827c72;font-weight:normal}
  table{width:100%;border-collapse:collapse}
  th{padding:8px 10px;border:1px solid #d7d2c8;background:#1a1a2e;color:#fff;font-size:9px;text-transform:uppercase;text-align:left}
  td{padding:6px 10px;border:1px solid #d7d2c8;font-size:11px}
  .opening{background:#f0f0f0;font-weight:bold;color:#666}
  .opening td{font-size:11px}
  .debit{color:#166634;font-weight:bold;text-align:right}.credit{color:#b91c1c;font-weight:bold;text-align:right}.balance{font-weight:bold;text-align:right}
  .type-income{color:#166634;font-weight:bold;font-size:10px}.type-expense{color:#b91c1c;font-weight:bold;font-size:10px}.type-internal_transfer{color:#1e40af;font-weight:bold;font-size:10px}
  .summary td{background:#1a1a2e;color:#fff;font-weight:bold;font-size:11px;padding:8px 10px}
  .summary .right{text-align:right}
  @media print{body{padding:15px}@page{size:landscape;margin:10mm}}
</style></head><body>
  <h1>AL RAWA English School</h1>
  <h2>${accLabel} Ledger — ${rangeStr}</h2>
  <table><thead><tr>
    <th>Date</th><th>Type</th><th>Description</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Balance</th>
  </tr></thead><tbody>
    <tr class="opening"><td colspan="3">Opening Balance</td><td colspan="3" style="text-align:right">${fmt(openingBalance)}</td></tr>
    ${rows}
  </tbody><tfoot>
    <tr class="summary"><td colspan="3">Total Dr: ${fmt(totalDebits)}  |  Total Cr: ${fmt(totalCredits)}</td><td class="right" colspan="3">Closing: ${fmt(closingBalance)}</td></tr>
  </tfoot></table>
</body></html>`;
}
