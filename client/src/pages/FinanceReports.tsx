import React, { useState, useEffect } from 'react';
import { useSchoolStore } from '../store';
import jsPDF from 'jspdf';
import { FileText, Download, Printer, Calendar, BarChart3, Scale, Users } from 'lucide-react';
import { toast } from '../components/Toast';
import { SCHOOL_LOGO } from '../lib/logo';

const API_URL = '/api';

type ReportTab = 'headwise-income' | 'headwise-expense' | 'monthly-income' | 'monthly-expense' | 'audit' | 'yearly-agm';

const REPORT_TABS: { key: ReportTab; label: string; icon: React.ReactNode }[] = [
  { key: 'headwise-income', label: 'Headwise Income', icon: <BarChart3 size={14} /> },
  { key: 'headwise-expense', label: 'Headwise Expense', icon: <BarChart3 size={14} /> },
  { key: 'monthly-income', label: 'Monthly Income', icon: <FileText size={14} /> },
  { key: 'monthly-expense', label: 'Monthly Expense', icon: <FileText size={14} /> },
  { key: 'audit', label: 'Audit Report', icon: <Scale size={14} /> },
  { key: 'yearly-agm', label: 'Yearly AGM', icon: <Users size={14} /> },
];

function getMonthName(m: number) { return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m]; }

function addLogo(doc: jsPDF, y: number) {
  try {
    const el = document.getElementById('school-logo') as HTMLImageElement;
    if (!el?.src) return;
    const raw = el.src.includes(',') ? el.src.split(',')[1] : el.src;
    doc.addImage(raw, 'JPEG', 12, y, 18, 18);
  } catch (_e) {}
}

function addHeader(doc: jsPDF, title: string, subtitle: string, y: number) {
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

function printDiv(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<html><head><title>Print</title><style>
    body{font-family:system-ui,sans-serif;padding:20px;color:#1a1a2e;font-size:13px}
    table{width:100%;border-collapse:collapse;margin-top:10px}
    th,td{padding:6px 10px;border:1px solid #d7d2c8;text-align:left;font-size:12px}
    th{background:#1a1a2e;color:#fff;font-size:10px;text-transform:uppercase}
    .total{font-weight:bold;background:#f0ece3}
    h2{font-size:16px;margin:0 0 4px}h3{font-size:13px;margin:0 0 8px;color:#827c72}
    @media print{body{padding:10px}}
  </style></head><body>${el.innerHTML}</body></html>`);
  w.document.close(); w.print();
}

function toPdf(doc: jsPDF, filename: string, sharedDoc?: jsPDF) {
  if (!sharedDoc) doc.save(filename);
}

const MONTHS_INPUT = (() => {
  const now = new Date();
  const months: { value: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ value: v, label: `${getMonthName(d.getMonth())} ${d.getFullYear()}` });
  }
  return months;
})();

const FinanceReports: React.FC = () => {
  const { transactions, fetchTransactions } = useSchoolStore();
  const [tab, setTab] = useState<ReportTab>('headwise-income');
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const [dateTo, setDateTo] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));

  useEffect(() => { fetchTransactions(); }, []);

  const filtered = transactions.filter((t: any) => {
    const d = new Date(t.transactionDate);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return ym >= dateFrom && ym <= dateTo;
  });

  const yearFiltered = transactions.filter((t: any) => new Date(t.transactionDate).getFullYear() === Number(yearFilter));

  const incomeTx = filtered.filter((t: any) => t.transactionType === 'INCOME' && t.affectsIncomeLedger);
  const expenseTx = filtered.filter((t: any) => t.transactionType === 'EXPENSE' && t.affectsExpenseLedger);
  const yearIncome = yearFiltered.filter((t: any) => t.transactionType === 'INCOME' && t.affectsIncomeLedger);
  const yearExpense = yearFiltered.filter((t: any) => t.transactionType === 'EXPENSE' && t.affectsExpenseLedger);
  const allTransfers = yearFiltered.filter((t: any) => t.transactionType === 'INTERNAL_TRANSFER');

  const fmt = (n: number) => n.toLocaleString('en-BD');
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  function headwise(data: any[]) {
    const map: Record<string, number> = {};
    data.forEach(t => { const cat = t.category || 'Uncategorized'; map[cat] = (map[cat] || 0) + Number(t.amount); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }

  function monthlyBreakdown(data: any[]) {
    const map: Record<string, Record<string, number>> = {};
    data.forEach(t => {
      const d = new Date(t.transactionDate);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const cat = t.category || 'Uncategorized';
      if (!map[cat]) map[cat] = {};
      map[cat][ym] = (map[cat][ym] || 0) + Number(t.amount);
    });
    return map;
  }

  function getMonthRange(from: string, to: string) {
    const months: string[] = [];
    let [fy, fm] = from.split('-').map(Number);
    const [ty, tm] = to.split('-').map(Number);
    while (fy < ty || (fy === ty && fm <= tm)) {
      months.push(`${fy}-${String(fm).padStart(2, '0')}`);
      fm++; if (fm > 12) { fm = 1; fy++; }
    }
    return months;
  }

  const monthRange = getMonthRange(dateFrom, dateTo);

  // ── PDF: Headwise Income ──
  function pdfHeadwiseIncome() {
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    let y = addHeader(doc, 'HEADWISE INCOME REPORT', `${getMonthName(Number(dateFrom.split('-')[1]) - 1)} ${dateFrom.split('-')[0]} — ${getMonthName(Number(dateTo.split('-')[1]) - 1)} ${dateTo.split('-')[0]}`, 10);
    const hw = headwise(incomeTx);
    const totalIncome = hw.reduce((s, x) => s + x[1], 0);

    doc.setFillColor(26, 26, 46); doc.rect(12, y, 186, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(255, 255, 255);
    doc.text('Category', 14, y + 4.5); doc.text('Amount (৳)', 120, y + 4.5, { align: 'right' }); doc.text('% Share', 160, y + 4.5, { align: 'right' }); doc.text('Count', 186, y + 4.5, { align: 'right' });
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
    doc.text(`TOTAL INCOME: ৳${fmt(totalIncome)}`, 14, y + 4.5);
    doc.text(`${hw.length} categories`, 186, y + 4.5, { align: 'right' });

    toPdf(doc, `Headwise_Income_${dateFrom}_to_${dateTo}.pdf`);
  }

  // ── PDF: Headwise Expense ──
  function pdfHeadwiseExpense() {
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    let y = addHeader(doc, 'HEADWISE EXPENSE REPORT', `${getMonthName(Number(dateFrom.split('-')[1]) - 1)} ${dateFrom.split('-')[0]} — ${getMonthName(Number(dateTo.split('-')[1]) - 1)} ${dateTo.split('-')[0]}`, 10);
    const hw = headwise(expenseTx);
    const totalExpense = hw.reduce((s, x) => s + x[1], 0);

    doc.setFillColor(26, 26, 46); doc.rect(12, y, 186, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(255, 255, 255);
    doc.text('Category', 14, y + 4.5); doc.text('Amount (৳)', 120, y + 4.5, { align: 'right' }); doc.text('% Share', 160, y + 4.5, { align: 'right' }); doc.text('Count', 186, y + 4.5, { align: 'right' });
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
    doc.text(`TOTAL EXPENSE: ৳${fmt(totalExpense)}`, 14, y + 4.5);
    doc.text(`${hw.length} categories`, 186, y + 4.5, { align: 'right' });

    toPdf(doc, `Headwise_Expense_${dateFrom}_to_${dateTo}.pdf`);
  }

  // ── PDF: Monthly Income/Expense ──
  function pdfMonthly(type: 'income' | 'expense') {
    const data = type === 'income' ? incomeTx : expenseTx;
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4', unit: 'mm' });
    const title = type === 'income' ? 'MONTHLY INCOME REPORT' : 'MONTHLY EXPENSE REPORT';
    let y = addHeader(doc, title, `${getMonthName(Number(dateFrom.split('-')[1]) - 1)} ${dateFrom.split('-')[0]} — ${getMonthName(Number(dateTo.split('-')[1]) - 1)} ${dateTo.split('-')[0]}`, 10);

    const mb = monthlyBreakdown(data);
    const cats = Object.keys(mb).sort();
    if (!cats.length) { doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(130, 124, 114); doc.text('No data for this period.', 12, y + 10); toPdf(doc, `${title.replace(/ /g, '_')}_${dateFrom}_to_${dateTo}.pdf`); return; }

    const CW = 277, M = 10;
    const catW = 36;
    const monthW = Math.max(20, Math.floor((CW - catW) / Math.max(monthRange.length, 1)));
    const totalW = monthW;

    // Header row
    doc.setFillColor(26, 26, 46);
    doc.rect(M, y, catW + monthW * Math.min(monthRange.length, 10) + totalW, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(255, 255, 255);
    doc.text('Category', M + 2, y + 4.5);
    let ax = M + catW;
    monthRange.slice(0, 10).forEach(m => {
      const [yr, mn] = m.split('-');
      doc.text(`${getMonthName(Number(mn) - 1).slice(0, 3)} '${yr.slice(2)}`, ax + 2, y + 4.5);
      ax += monthW;
    });
    doc.text('Total', ax + 2, y + 4.5);
    y += 7;

    // Data rows
    let grandTotal = 0;
    cats.forEach((cat, i) => {
      if (y > 190) { doc.addPage(); y = 14; }
      if (i % 2 === 0) { doc.setFillColor(255, 253, 247); doc.rect(M, y, catW + monthW * Math.min(monthRange.length, 10) + totalW, 6, 'F'); }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(26, 26, 46);
      doc.text(cat, M + 2, y + 4);
      let rowTotal = 0;
      ax = M + catW;
      monthRange.slice(0, 10).forEach(m => {
        const v = mb[cat]?.[m] || 0;
        rowTotal += v;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(v > 0 ? (type === 'income' ? [22, 101, 52] : [185, 28, 28]) : [130, 124, 114]);
        doc.text(v > 0 ? fmt(v) : '—', ax + 2, y + 4);
        ax += monthW;
      });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(26, 26, 46);
      doc.text(fmt(rowTotal), ax + 2, y + 4);
      grandTotal += rowTotal;
      y += 6;
    });

    // Grand total row
    doc.setFillColor(240, 235, 225); doc.rect(M, y, catW + monthW * Math.min(monthRange.length, 10) + totalW, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(26, 26, 46);
    doc.text('GRAND TOTAL', M + 2, y + 4.5);
    ax = M + catW + monthW * Math.min(monthRange.length, 10);
    doc.text(fmt(grandTotal), ax + 2, y + 4.5);

    toPdf(doc, `${title.replace(/ /g, '_')}_${dateFrom}_to_${dateTo}.pdf`);
  }

  // ── PDF: Audit Report ──
  function pdfAudit() {
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    let y = addHeader(doc, 'ANNUAL AUDIT REPORT', `Financial Year ${yearFilter}`, 10);

    const totalIncome = yearIncome.reduce((s, t) => s + Number(t.amount), 0);
    const totalExpense = yearExpense.reduce((s, t) => s + Number(t.amount), 0);
    const netSurplus = totalIncome - totalExpense;

    // Financial Summary
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(26, 26, 46);
    doc.text('FINANCIAL SUMMARY', 12, y); y += 7;

    const summaryRows: [string, string][] = [
      ['Total Income', `৳${fmt(totalIncome)}`],
      ['Total Expense', `৳${fmt(totalExpense)}`],
      ['Net Surplus / (Deficit)', `৳${fmt(netSurplus)}`],
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

    // Headwise Income
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

    // Headwise Expense
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

    // Audit Certificate
    if (y > 230) { doc.addPage(); y = 14; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(26, 26, 46);
    doc.text('AUDIT CERTIFICATE', 12, y); y += 8;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
    const certText = `This is to certify that the accounts of AL RAWA English School for the financial year ${yearFilter} have been examined. Total income stood at ৳${fmt(totalIncome)} and total expenditure at ৳${fmt(totalExpense)}, resulting in a net surplus of ৳${fmt(netSurplus)}. All transactions have been verified against supporting documents.`;
    const lines = doc.splitTextToSize(certText, 186);
    doc.text(lines, 12, y); y += lines.length * 5 + 10;

    // Signature
    const sigW = 60;
    [['Prepared By', 12], ['Finance Officer', 82], ['Principal', 152]].forEach(([lbl, sx]) => {
      doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.3);
      doc.line(sx, y, sx + sigW, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130, 124, 114);
      doc.text(lbl, sx + sigW / 2, y + 4, { align: 'center' });
    });

    toPdf(doc, `Audit_Report_${yearFilter}.pdf`);
  }

  // ── PDF: Yearly AGM Report ──
  function pdfYearlyAGM() {
    const doc = new jsPDF({ format: 'a4', unit: 'mm' });
    let y = addHeader(doc, 'ANNUAL GENERAL MEETING REPORT', `Session: ${yearFilter}`, 10);

    const totalIncome = yearIncome.reduce((s, t) => s + Number(t.amount), 0);
    const totalExpense = yearExpense.reduce((s, t) => s + Number(t.amount), 0);
    const netSurplus = totalIncome - totalExpense;

    // AGM Report structure
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(26, 26, 46);
    doc.text('1. FINANCIAL OVERVIEW', 12, y); y += 8;

    const overviewData: [string, string][] = [
      ['Total Income', `৳${fmt(totalIncome)}`],
      ['Total Expense', `৳${fmt(totalExpense)}`],
      ['Net Surplus / (Deficit)', `৳${fmt(netSurplus)}`],
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

    // Top 5 income heads
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('2. MAJOR INCOME HEADS', 12, y); y += 7;
    headwise(yearIncome).slice(0, 5).forEach(([cat, amt], i) => {
      if (y > 270) { doc.addPage(); y = 14; }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(26, 26, 46);
      doc.text(`${i + 1}. ${cat}`, 14, y + 4);
      doc.text(`৳${fmt(amt)}`, 196, y + 4, { align: 'right' });
      y += 6;
    });
    y += 6;

    // Top 5 expense heads
    if (y > 200) { doc.addPage(); y = 14; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('3. MAJOR EXPENSE HEADS', 12, y); y += 7;
    headwise(yearExpense).slice(0, 5).forEach(([cat, amt], i) => {
      if (y > 270) { doc.addPage(); y = 14; }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(26, 26, 46);
      doc.text(`${i + 1}. ${cat}`, 14, y + 4);
      doc.text(`৳${fmt(amt)}`, 196, y + 4, { align: 'right' });
      y += 6;
    });
    y += 8;

    // Internal Transfers Summary
    if (y > 200) { doc.addPage(); y = 14; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('4. INTERNAL TRANSFERS', 12, y); y += 7;
    const totalTransfers = allTransfers.reduce((s, t) => s + Number(t.amount), 0);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(26, 26, 46);
    doc.text(`Total Internal Transfers: ৳${fmt(totalTransfers)} (${allTransfers.length} transactions)`, 14, y); y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(130, 124, 114);
    doc.text('Note: Internal transfers between AL RAWA Bank and Cash in Hand do not affect the income/expense ledger.', 14, y); y += 10;

    // Recommendations
    if (y > 200) { doc.addPage(); y = 14; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(26, 26, 46);
    doc.text('5. RECOMMENDATIONS', 12, y); y += 8;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(60, 60, 60);
    const recs = [
      `Net surplus of ৳${fmt(netSurplus)} for the year ${yearFilter}.`,
      totalIncome > 0 ? `Expense-to-income ratio: ${((totalExpense / totalIncome) * 100).toFixed(1)}%.` : 'No income recorded.',
      `${yearFiltered.length} total transactions recorded during the year.`,
      'All financial records are available for detailed audit.',
    ];
    recs.forEach((r, i) => {
      doc.text(`${i + 1}. ${r}`, 14, y); y += 5;
    });
    y += 10;

    // Signatures
    if (y > 240) { doc.addPage(); y = 14; }
    const sigW = 55;
    [['Secretary', 12], ['Treasurer', 78], ['President', 144]].forEach(([lbl, sx]) => {
      doc.setDrawColor(150, 150, 150); doc.setLineWidth(0.3);
      doc.line(sx, y, sx + sigW, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130, 124, 114);
      doc.text(lbl, sx + sigW / 2, y + 4, { align: 'center' });
    });

    toPdf(doc, `AGM_Report_${yearFilter}.pdf`);
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2 flex-wrap">
        {REPORT_TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${tab === t.key ? 'bg-school-primary text-white border-school-primary shadow-sm' : 'bg-white border-school-border text-school-muted hover:border-school-accent'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-school-border p-4 flex flex-wrap gap-4 items-end">
        {(tab === 'headwise-income' || tab === 'headwise-expense' || tab === 'monthly-income' || tab === 'monthly-expense') && (
          <>
            <div>
              <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">From</label>
              <select value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-school-border rounded-xl px-3 py-2 text-sm bg-white">
                {MONTHS_INPUT.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">To</label>
              <select value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-school-border rounded-xl px-3 py-2 text-sm bg-white">
                {MONTHS_INPUT.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </>
        )}
        {(tab === 'audit' || tab === 'yearly-agm') && (
          <div>
            <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Financial Year</label>
            <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="border border-school-border rounded-xl px-3 py-2 text-sm bg-white">
              {[0, 1, 2].map(i => { const y = new Date().getFullYear() - i; return <option key={y} value={y}>{y}</option>; })}
            </select>
          </div>
        )}
        <div className="flex gap-2 ml-auto">
          {(tab === 'headwise-income' || tab === 'headwise-expense' || tab === 'monthly-income' || tab === 'monthly-expense' || tab === 'audit' || tab === 'yearly-agm') && (
            <>
              <button onClick={() => {
                try {
                  if (tab === 'headwise-income') pdfHeadwiseIncome();
                  else if (tab === 'headwise-expense') pdfHeadwiseExpense();
                  else if (tab === 'monthly-income') pdfMonthly('income');
                  else if (tab === 'monthly-expense') pdfMonthly('expense');
                  else if (tab === 'audit') pdfAudit();
                  else if (tab === 'yearly-agm') pdfYearlyAGM();
                  toast('PDF downloaded ✓', 'success');
                } catch (e) { console.error(e); toast('PDF generation failed', 'error'); }
              }} className="flex items-center gap-1.5 px-3 py-2 bg-school-primary text-white rounded-xl text-xs font-bold hover:opacity-90">
                <Download size={14} /> PDF
              </button>
              <button onClick={() => printDiv('print-area')} className="flex items-center gap-1.5 px-3 py-2 border border-school-border rounded-xl text-xs font-bold hover:border-school-accent">
                <Printer size={14} /> Print
              </button>
            </>
          )}
        </div>
      </div>

      {/* Report Content */}
      {tab === 'headwise-income' && (
        <div className="bg-white rounded-2xl border border-school-border overflow-hidden p-4" id="print-area">
            {(() => { const hw = headwise(incomeTx); const total = hw.reduce((s, x) => s + x[1], 0); return (
              <div>
                <h4 className="font-serif text-sm text-school-primary mb-3">Headwise Income — {getMonthName(Number(dateFrom.split('-')[1]) - 1)} {dateFrom.split('-')[0]} to {getMonthName(Number(dateTo.split('-')[1]) - 1)} {dateTo.split('-')[0]}</h4>
                <table className="w-full text-sm"><thead><tr className="bg-school-primary text-white text-[10px] uppercase"><th className="px-3 py-2 text-left">Category</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">%</th><th className="px-3 py-2 text-right">Count</th></tr></thead>
                  <tbody>{hw.map(([cat, amt]) => <tr key={cat} className="border-t border-school-border/50"><td className="px-3 py-2 font-medium">{cat}</td><td className="px-3 py-2 text-right">৳{fmt(amt)}</td><td className="px-3 py-2 text-right">{total > 0 ? ((amt / total) * 100).toFixed(1) : 0}%</td><td className="px-3 py-2 text-right">{incomeTx.filter((t: any) => (t.category || 'Uncategorized') === cat).length}</td></tr>)}</tbody>
                  <tfoot><tr className="border-t-2 border-school-primary font-bold bg-school-paper"><td className="px-3 py-2">Total Income</td><td className="px-3 py-2 text-right">৳{fmt(total)}</td><td></td><td className="px-3 py-2 text-right">{incomeTx.length}</td></tr></tfoot>
                </table>
              </div>
            ); })()}
        </div>
      )}

      {tab === 'headwise-expense' && (
        <div className="bg-white rounded-2xl border border-school-border p-4" id="print-area">
          {(() => { const hw = headwise(expenseTx); const total = hw.reduce((s, x) => s + x[1], 0); return (
            <div>
              <h4 className="font-serif text-sm text-school-primary mb-3">Headwise Expense — {getMonthName(Number(dateFrom.split('-')[1]) - 1)} {dateFrom.split('-')[0]} to {getMonthName(Number(dateTo.split('-')[1]) - 1)} {dateTo.split('-')[0]}</h4>
              <table className="w-full text-sm"><thead><tr className="bg-school-primary text-white text-[10px] uppercase"><th className="px-3 py-2 text-left">Category</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">%</th><th className="px-3 py-2 text-right">Count</th></tr></thead>
                <tbody>{hw.map(([cat, amt]) => <tr key={cat} className="border-t border-school-border/50"><td className="px-3 py-2 font-medium">{cat}</td><td className="px-3 py-2 text-right">৳{fmt(amt)}</td><td className="px-3 py-2 text-right">{total > 0 ? ((amt / total) * 100).toFixed(1) : 0}%</td><td className="px-3 py-2 text-right">{expenseTx.filter((t: any) => (t.category || 'Uncategorized') === cat).length}</td></tr>)}</tbody>
                <tfoot><tr className="border-t-2 border-school-primary font-bold bg-school-paper"><td className="px-3 py-2">Total Expense</td><td className="px-3 py-2 text-right">৳{fmt(total)}</td><td></td><td className="px-3 py-2 text-right">{expenseTx.length}</td></tr></tfoot>
              </table>
            </div>
          ); })()}
        </div>
      )}

      {tab === 'monthly-income' && (
        <div className="bg-white rounded-2xl border border-school-border p-4 overflow-x-auto" id="print-area">
          <h4 className="font-serif text-sm text-school-primary mb-3">Monthly Income — {getMonthName(Number(dateFrom.split('-')[1]) - 1)} {dateFrom.split('-')[0]} to {getMonthName(Number(dateTo.split('-')[1]) - 1)} {dateTo.split('-')[0]}</h4>
          {(() => { const mb = monthlyBreakdown(incomeTx); const cats = Object.keys(mb).sort(); if (!cats.length) return <p className="text-sm text-school-muted">No income data for this period.</p>; return (
            <table className="w-full text-sm"><thead><tr className="bg-school-primary text-white text-[10px] uppercase"><th className="px-3 py-2 text-left">Category</th>{monthRange.map(m => { const [yr, mn] = m.split('-'); return <th key={m} className="px-2 py-2 text-right">{getMonthName(Number(mn) - 1).slice(0, 3)} '{yr.slice(2)}</th>; })}<th className="px-3 py-2 text-right">Total</th></tr></thead>
              <tbody>{cats.map((cat, i) => { let rowTotal = 0; return <tr key={cat} className={`border-t border-school-border/50 ${i % 2 ? 'bg-school-paper/30' : ''}`}><td className="px-3 py-2 font-medium">{cat}</td>{monthRange.map(m => { const v = mb[cat]?.[m] || 0; rowTotal += v; return <td key={m} className={`px-2 py-2 text-right ${v > 0 ? 'text-emerald-600 font-medium' : 'text-school-muted'}`}>{v > 0 ? `৳${fmt(v)}` : '—'}</td>; })}<td className="px-3 py-2 text-right font-bold">৳{fmt(rowTotal)}</td></tr>; })}</tbody>
            </table>
          ); })()}
        </div>
      )}

      {tab === 'monthly-expense' && (
        <div className="bg-white rounded-2xl border border-school-border p-4 overflow-x-auto" id="print-area">
          <h4 className="font-serif text-sm text-school-primary mb-3">Monthly Expense — {getMonthName(Number(dateFrom.split('-')[1]) - 1)} {dateFrom.split('-')[0]} to {getMonthName(Number(dateTo.split('-')[1]) - 1)} {dateTo.split('-')[0]}</h4>
          {(() => { const mb = monthlyBreakdown(expenseTx); const cats = Object.keys(mb).sort(); if (!cats.length) return <p className="text-sm text-school-muted">No expense data for this period.</p>; return (
            <table className="w-full text-sm"><thead><tr className="bg-school-primary text-white text-[10px] uppercase"><th className="px-3 py-2 text-left">Category</th>{monthRange.map(m => { const [yr, mn] = m.split('-'); return <th key={m} className="px-2 py-2 text-right">{getMonthName(Number(mn) - 1).slice(0, 3)} '{yr.slice(2)}</th>; })}<th className="px-3 py-2 text-right">Total</th></tr></thead>
              <tbody>{cats.map((cat, i) => { let rowTotal = 0; return <tr key={cat} className={`border-t border-school-border/50 ${i % 2 ? 'bg-school-paper/30' : ''}`}><td className="px-3 py-2 font-medium">{cat}</td>{monthRange.map(m => { const v = mb[cat]?.[m] || 0; rowTotal += v; return <td key={m} className={`px-2 py-2 text-right ${v > 0 ? 'text-rose-600 font-medium' : 'text-school-muted'}`}>{v > 0 ? `৳${fmt(v)}` : '—'}</td>; })}<td className="px-3 py-2 text-right font-bold">৳{fmt(rowTotal)}</td></tr>; })}</tbody>
            </table>
          ); })()}
        </div>
      )}

      {tab === 'audit' && (
        <div className="bg-white rounded-2xl border border-school-border p-4" id="print-area">
          {(() => { const ti = yearIncome.reduce((s, t) => s + Number(t.amount), 0); const te = yearExpense.reduce((s, t) => s + Number(t.amount), 0); const ns = ti - te; return (
            <div className="space-y-4">
              <h4 className="font-serif text-sm text-school-primary">Audit Report — Financial Year {yearFilter}</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center"><div className="text-[10px] uppercase text-emerald-600 font-bold">Total Income</div><div className="font-serif text-lg text-emerald-700">৳{fmt(ti)}</div></div>
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center"><div className="text-[10px] uppercase text-rose-600 font-bold">Total Expense</div><div className="font-serif text-lg text-rose-700">৳{fmt(te)}</div></div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center"><div className="text-[10px] uppercase text-blue-600 font-bold">Net Surplus</div><div className={`font-serif text-lg ${ns >= 0 ? 'text-blue-700' : 'text-red-700'}`}>৳{fmt(ns)}</div></div>
              </div>
              <div>
                <h5 className="font-bold text-xs uppercase text-school-muted mb-2">Income Breakdown</h5>
                <table className="w-full text-sm"><thead><tr className="bg-school-primary text-white text-[10px] uppercase"><th className="px-3 py-2 text-left">Category</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">%</th></tr></thead>
                  <tbody>{headwise(yearIncome).map(([cat, amt]) => <tr key={cat} className="border-t border-school-border/50"><td className="px-3 py-2 font-medium">{cat}</td><td className="px-3 py-2 text-right">৳{fmt(amt)}</td><td className="px-3 py-2 text-right">{ti > 0 ? ((amt / ti) * 100).toFixed(1) : 0}%</td></tr>)}</tbody>
                </table>
              </div>
              <div>
                <h5 className="font-bold text-xs uppercase text-school-muted mb-2">Expense Breakdown</h5>
                <table className="w-full text-sm"><thead><tr className="bg-school-primary text-white text-[10px] uppercase"><th className="px-3 py-2 text-left">Category</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">%</th></tr></thead>
                  <tbody>{headwise(yearExpense).map(([cat, amt]) => <tr key={cat} className="border-t border-school-border/50"><td className="px-3 py-2 font-medium">{cat}</td><td className="px-3 py-2 text-right">৳{fmt(amt)}</td><td className="px-3 py-2 text-right">{te > 0 ? ((amt / te) * 100).toFixed(1) : 0}%</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          ); })()}
        </div>
      )}

      {tab === 'yearly-agm' && (
        <div className="bg-white rounded-2xl border border-school-border p-4" id="print-area">
          {(() => { const ti = yearIncome.reduce((s, t) => s + Number(t.amount), 0); const te = yearExpense.reduce((s, t) => s + Number(t.amount), 0); const ns = ti - te; return (
            <div className="space-y-4">
              <h4 className="font-serif text-sm text-school-primary">Annual General Meeting Report — Session {yearFilter}</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-school-paper rounded-xl p-3"><div className="text-[10px] uppercase text-school-muted font-bold mb-1">Total Income</div><div className="font-serif text-lg text-emerald-600">৳{fmt(ti)}</div></div>
                <div className="bg-school-paper rounded-xl p-3"><div className="text-[10px] uppercase text-school-muted font-bold mb-1">Total Expense</div><div className="font-serif text-lg text-rose-600">৳{fmt(te)}</div></div>
              </div>
              <div className="bg-school-paper rounded-xl p-3"><div className="text-[10px] uppercase text-school-muted font-bold mb-1">Net Surplus / (Deficit)</div><div className={`font-serif text-xl ${ns >= 0 ? 'text-blue-600' : 'text-red-600'}`}>৳{fmt(ns)}</div></div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><div className="text-[10px] uppercase text-school-muted font-bold">Total Transactions</div><div className="font-bold text-lg">{yearFiltered.length}</div></div>
                <div><div className="text-[10px] uppercase text-school-muted font-bold">Income Entries</div><div className="font-bold text-lg text-emerald-600">{yearIncome.length}</div></div>
                <div><div className="text-[10px] uppercase text-school-muted font-bold">Expense Entries</div><div className="font-bold text-lg text-rose-600">{yearExpense.length}</div></div>
              </div>
              <div>
                <h5 className="font-bold text-xs uppercase text-school-muted mb-2">Top Income Heads</h5>
                {headwise(yearIncome).slice(0, 5).map(([cat, amt], i) => <div key={cat} className="flex justify-between py-1 border-b border-school-border/50 text-sm"><span>{i + 1}. {cat}</span><span className="font-bold text-emerald-600">৳{fmt(amt)}</span></div>)}
              </div>
              <div>
                <h5 className="font-bold text-xs uppercase text-school-muted mb-2">Top Expense Heads</h5>
                {headwise(yearExpense).slice(0, 5).map(([cat, amt], i) => <div key={cat} className="flex justify-between py-1 border-b border-school-border/50 text-sm"><span>{i + 1}. {cat}</span><span className="font-bold text-rose-600">৳{fmt(amt)}</span></div>)}
              </div>
            </div>
          ); })()}
        </div>
      )}
    </div>
  );
};

export default FinanceReports;
