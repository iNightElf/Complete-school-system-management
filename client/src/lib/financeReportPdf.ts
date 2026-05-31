import jsPDF from 'jspdf';

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
    const el = document.getElementById('school-logo') as HTMLImageElement;
    if (!el?.src) return;
    const raw = el.src.includes(',') ? el.src.split(',')[1] : el.src;
    doc.addImage(raw, 'JPEG', 12, y, 18, 18);
  } catch (_e) {}
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

export function pdfHeadwiseIncome(incomeTx: any[], dateFrom: string, dateTo: string) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  let y = addHeader(doc, 'HEADWISE INCOME REPORT', subtitleForRange(dateFrom, dateTo), 10);
  const hw = headwise(incomeTx);
  const totalIncome = hw.reduce((s, x) => s + x[1], 0);

  doc.setFillColor(26, 26, 46); doc.rect(12, y, 186, 7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(255, 255, 255);
  doc.text('Category', 14, y + 4.5); doc.text('Amount', 120, y + 4.5, { align: 'right' }); doc.text('% Share', 160, y + 4.5, { align: 'right' }); doc.text('Count', 186, y + 4.5, { align: 'right' });
  y += 7;

  hw.forEach(([cat, amt], i) => {
    const pct = totalIncome > 0 ? ((amt / totalIncome) * 100).toFixed(1) : '0';
    const count = incomeTx.filter((t: any) => (t.category || 'Uncategorized') === cat).length;
    if (i % 2 === 0) { doc.setFillColor(255, 253, 247); doc.rect(12, y, 186, 6, 'F'); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(26, 26, 46);
    doc.text(cat, 14, y + 4); doc.text(fmt(amt), 120, y + 4, { align: 'right' });
    doc.text(`${pct}%`, 160, y + 4, { align: 'right' }); doc.text(String(count), 186, y + 4, { align: 'right' });
    y += 6;
  });

  doc.setFillColor(240, 235, 225); doc.rect(12, y, 186, 7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(26, 26, 46);
  doc.text(`TOTAL INCOME: ${fmt(totalIncome)} /-`, 14, y + 4.5);
  doc.text(`${hw.length} categories`, 186, y + 4.5, { align: 'right' });

  doc.save(`Headwise_Income_${dateFrom}_to_${dateTo}.pdf`);
}

export function pdfHeadwiseExpense(expenseTx: any[], dateFrom: string, dateTo: string) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  let y = addHeader(doc, 'HEADWISE EXPENSE REPORT', subtitleForRange(dateFrom, dateTo), 10);
  const hw = headwise(expenseTx);
  const totalExpense = hw.reduce((s, x) => s + x[1], 0);

  doc.setFillColor(26, 26, 46); doc.rect(12, y, 186, 7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(255, 255, 255);
  doc.text('Category', 14, y + 4.5); doc.text('Amount', 120, y + 4.5, { align: 'right' }); doc.text('% Share', 160, y + 4.5, { align: 'right' }); doc.text('Count', 186, y + 4.5, { align: 'right' });
  y += 7;

  hw.forEach(([cat, amt], i) => {
    const pct = totalExpense > 0 ? ((amt / totalExpense) * 100).toFixed(1) : '0';
    const count = expenseTx.filter((t: any) => (t.category || 'Uncategorized') === cat).length;
    if (i % 2 === 0) { doc.setFillColor(255, 253, 247); doc.rect(12, y, 186, 6, 'F'); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(26, 26, 46);
    doc.text(cat, 14, y + 4); doc.text(fmt(amt), 120, y + 4, { align: 'right' });
    doc.text(`${pct}%`, 160, y + 4, { align: 'right' }); doc.text(String(count), 186, y + 4, { align: 'right' });
    y += 6;
  });

  doc.setFillColor(240, 235, 225); doc.rect(12, y, 186, 7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(26, 26, 46);
  doc.text(`TOTAL EXPENSE: ${fmt(totalExpense)} /-`, 14, y + 4.5);
  doc.text(`${hw.length} categories`, 186, y + 4.5, { align: 'right' });

  doc.save(`Headwise_Expense_${dateFrom}_to_${dateTo}.pdf`);
}

export function pdfMonthly(type: 'income' | 'expense', data: any[], students: any[], dateFrom: string, dateTo: string) {
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

  const grouped: Record<string, any[]> = {};
  data.forEach(t => { const c = t.category || 'Uncategorized'; if (!grouped[c]) grouped[c] = []; grouped[c].push(t); });
  const cats = Object.keys(grouped).sort();
  cats.forEach(c => grouped[c].sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()));

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

  cats.forEach(cat => {
    if (y > 260) { doc.addPage(); y = 14; drawTableHeader(); }
    doc.setFillColor(240, 235, 225);
    doc.rect(M, y, PW, 6, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(26, 26, 46);
    doc.text(cat, M + 2, y + 4);
    let catTotal = 0;
    grouped[cat].forEach(t => { catTotal += Number(t.amount); });
    doc.text(fmt(catTotal) + ' /-', amtX + amtW - 2, y + 4, { align: 'right' });
    y += 6;

    grouped[cat].forEach((t, i) => {
      if (y > 270) { doc.addPage(); y = 14; drawTableHeader(); }
      if (i % 2 === 0) { doc.setFillColor(255, 253, 247); doc.rect(M, y, PW, rowH, 'F'); }

      const dateStr = new Date(t.transactionDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const studentName = t.studentId ? (students.find((s: any) => s.id === t.studentId)?.name || '') : '';
      const classStudent = [t.className || '', studentName].filter(Boolean).join(' / ') || t.description || `${(t.sourceAccount || '').replace(/_/g, ' ')} -> ${(t.destinationAccount || '').replace(/_/g, ' ')}`;
      grandTotal += Number(t.amount);

      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
      doc.setTextColor(80, 80, 80);
      doc.text(dateStr, M + 2, y + 3.5);
      doc.setTextColor(26, 26, 46);
      doc.text(classStudent.substring(0, 38), M + dateW + 2, y + 3.5);
      doc.setTextColor(130, 124, 114);
      doc.text(cat.substring(0, 18), catX + 2, y + 3.5);
      doc.setTextColor(...amountColor);
      doc.text(fmt(Number(t.amount)) + ' /-', amtX + amtW - 2, y + 3.5, { align: 'right' });
      doc.setTextColor(130, 124, 114);
      doc.text(fmt(grandTotal) + ' /-', balX + balW - 2, y + 3.5, { align: 'right' });
      y += rowH;
    });

    doc.setFillColor(245, 242, 235);
    doc.rect(M, y, PW, rowH + 1, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(26, 26, 46);
    doc.text(`Subtotal: ${cat}`, M + 2, y + 4);
    doc.setTextColor(...amountColor);
    doc.text(fmt(catTotal) + ' /-', amtX - 2, y + 4, { align: 'right' });
    y += rowH + 1 + 3;
  });

  if (y > 260) { doc.addPage(); y = 14; }
  doc.setFillColor(26, 26, 46);
  doc.rect(M, y, PW, 8, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
  doc.text('GRAND TOTAL', M + 2, y + 5.5);
  doc.text(fmt(grandTotal) + ' /-', balX + balW - 2, y + 5.5, { align: 'right' });

  doc.save(`${title.replace(/ /g, '_')}_${dateFrom}_to_${dateTo}.pdf`);
}

export function pdfAudit(yearIncome: any[], yearExpense: any[], yearFilter: string) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  let y = addHeader(doc, 'ANNUAL AUDIT REPORT', `Financial Year ${Number(yearFilter)-1}-${yearFilter} (Sep ${Number(yearFilter)-1} – Aug ${yearFilter})`, 10);

  const totalIncome = yearIncome.reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = yearExpense.reduce((s, t) => s + Number(t.amount), 0);
  const netSurplus = totalIncome - totalExpense;

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
  const hwInc = headwise(yearIncome);
  doc.setFillColor(26, 26, 46); doc.rect(12, y, 186, 6, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(255, 255, 255);
  doc.text('Category', 14, y + 4); doc.text('Amount', 120, y + 4, { align: 'right' }); doc.text('%', 160, y + 4, { align: 'right' }); doc.text('Count', 186, y + 4, { align: 'right' });
  y += 6;
  hwInc.forEach(([cat, amt], i) => {
    if (y > 270) { doc.addPage(); y = 14; }
    const pct = totalIncome > 0 ? ((amt / totalIncome) * 100).toFixed(1) : '0';
    const count = yearIncome.filter((t: any) => (t.category || 'Uncategorized') === cat).length;
    if (i % 2 === 0) { doc.setFillColor(255, 253, 247); doc.rect(12, y, 186, 6, 'F'); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(26, 26, 46);
    doc.text(cat, 14, y + 4); doc.text(fmt(amt), 120, y + 4, { align: 'right' });
    doc.text(`${pct}%`, 160, y + 4, { align: 'right' }); doc.text(String(count), 186, y + 4, { align: 'right' });
    y += 6;
  });
  y += 6;

  if (y > 200) { doc.addPage(); y = 14; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(26, 26, 46);
  doc.text('EXPENSE BY CATEGORY', 12, y); y += 7;
  const hwExp = headwise(yearExpense);
  doc.setFillColor(26, 26, 46); doc.rect(12, y, 186, 6, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(255, 255, 255);
  doc.text('Category', 14, y + 4); doc.text('Amount', 120, y + 4, { align: 'right' }); doc.text('%', 160, y + 4, { align: 'right' }); doc.text('Count', 186, y + 4, { align: 'right' });
  y += 6;
  hwExp.forEach(([cat, amt], i) => {
    if (y > 270) { doc.addPage(); y = 14; }
    const pct = totalExpense > 0 ? ((amt / totalExpense) * 100).toFixed(1) : '0';
    const count = yearExpense.filter((t: any) => (t.category || 'Uncategorized') === cat).length;
    if (i % 2 === 0) { doc.setFillColor(255, 253, 247); doc.rect(12, y, 186, 6, 'F'); }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(26, 26, 46);
    doc.text(cat, 14, y + 4); doc.text(fmt(amt), 120, y + 4, { align: 'right' });
    doc.text(`${pct}%`, 160, y + 4, { align: 'right' }); doc.text(String(count), 186, y + 4, { align: 'right' });
    y += 6;
  });
  y += 8;

  if (y > 230) { doc.addPage(); y = 14; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(26, 26, 46);
  doc.text('AUDIT CERTIFICATE', 12, y); y += 8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
  const certText = `This is to certify that the accounts of AL RAWA English School for the financial year ${Number(yearFilter)-1}-${yearFilter} (Sep ${Number(yearFilter)-1} – Aug ${yearFilter}) have been examined. Total income stood at ${fmt(totalIncome)} /- and total expenditure at ${fmt(totalExpense)} /-, resulting in a net surplus of ${fmt(netSurplus)} /-. All transactions have been verified against supporting documents.`;
  const lines = doc.splitTextToSize(certText, 186);
  doc.text(lines, 12, y); y += lines.length * 5 + 10;

  const sigW = 60;
  [['Prepared By', 12], ['Finance Officer', 82], ['Principal', 152]].forEach(([lbl, sx]) => {
    doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.3);
    doc.line(sx, y, sx + sigW, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130, 124, 114);
    doc.text(lbl, sx + sigW / 2, y + 4, { align: 'center' });
  });

  doc.save(`Audit_Report_${yearFilter}.pdf`);
}

export function pdfYearlyAGM(yearIncome: any[], yearExpense: any[], yearFiltered: any[], allTransfers: any[], yearFilter: string) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' });
  let y = addHeader(doc, 'ANNUAL GENERAL MEETING REPORT', `Session: ${Number(yearFilter)-1}-${yearFilter} (Sep ${Number(yearFilter)-1} – Aug ${yearFilter})`, 10);

  const totalIncome = yearIncome.reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = yearExpense.reduce((s, t) => s + Number(t.amount), 0);
  const netSurplus = totalIncome - totalExpense;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(26, 26, 46);
  doc.text('1. FINANCIAL OVERVIEW', 12, y); y += 8;

  const overviewData: [string, string][] = [
    ['Total Income', `${fmt(totalIncome)} /-`],
    ['Total Expense', `${fmt(totalExpense)} /-`],
    ['Net Surplus / (Deficit)', `${fmt(netSurplus)} /-`],
    ['Total Transactions', String(yearFiltered.length)],
    ['Income Transactions', String(yearIncome.length)],
    ['Expense Transactions', String(yearExpense.length)],
  ];
  overviewData.forEach(([k, v], i) => {
    doc.setFillColor(i % 2 === 0 ? 255 : 244, i % 2 === 0 ? 253 : 239, i % 2 === 0 ? 247 : 230);
    doc.rect(12, y, 186, 7, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(26, 26, 46);
    doc.text(k, 14, y + 4.5); doc.setFont('helvetica', 'bold'); doc.text(v, 196, y + 4.5, { align: 'right' });
    y += 7;
  });
  y += 8;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('2. MAJOR INCOME HEADS', 12, y); y += 7;
  headwise(yearIncome).slice(0, 5).forEach(([cat, amt], i) => {
    if (y > 270) { doc.addPage(); y = 14; }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(26, 26, 46);
    doc.text(`${i + 1}. ${cat}`, 14, y + 4);
    doc.text(`${fmt(amt)} /-`, 196, y + 4, { align: 'right' });
    y += 6;
  });
  y += 6;

  if (y > 200) { doc.addPage(); y = 14; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('3. MAJOR EXPENSE HEADS', 12, y); y += 7;
  headwise(yearExpense).slice(0, 5).forEach(([cat, amt], i) => {
    if (y > 270) { doc.addPage(); y = 14; }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(26, 26, 46);
    doc.text(`${i + 1}. ${cat}`, 14, y + 4);
    doc.text(`${fmt(amt)} /-`, 196, y + 4, { align: 'right' });
    y += 6;
  });
  y += 8;

  if (y > 200) { doc.addPage(); y = 14; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('4. INTERNAL TRANSFERS', 12, y); y += 7;
  const totalTransfers = allTransfers.reduce((s, t) => s + Number(t.amount), 0);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(26, 26, 46);
  doc.text(`Total Internal Transfers: ${fmt(totalTransfers)} /- (${allTransfers.length} transactions)`, 14, y); y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(130, 124, 114);
  doc.text('Note: Internal transfers between AL RAWA Bank and Cash in Hand do not affect the income/expense ledger.', 14, y); y += 10;

  if (y > 200) { doc.addPage(); y = 14; }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(26, 26, 46);
  doc.text('5. RECOMMENDATIONS', 12, y); y += 8;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
  const recs = [
    `Net surplus of ${fmt(netSurplus)} /- for FY ${Number(yearFilter)-1}-${yearFilter}.`,
    totalIncome > 0 ? `Expense-to-income ratio: ${((totalExpense / totalIncome) * 100).toFixed(1)}%.` : 'No income recorded.',
    `${yearFiltered.length} total transactions recorded during the year.`,
    'All financial records are available for detailed audit.',
  ];
  recs.forEach((r, i) => {
    doc.text(`${i + 1}. ${r}`, 14, y); y += 5;
  });
  y += 10;

  if (y > 240) { doc.addPage(); y = 14; }
  const sigW = 55;
  [['Secretary', 12], ['Treasurer', 78], ['President', 144]].forEach(([lbl, sx]) => {
    doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.3);
    doc.line(sx, y, sx + sigW, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130, 124, 114);
    doc.text(lbl, sx + sigW / 2, y + 4, { align: 'center' });
  });

  doc.save(`AGM_Report_${yearFilter}.pdf`);
}
