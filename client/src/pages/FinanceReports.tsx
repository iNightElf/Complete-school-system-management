import React, { useState, useEffect } from 'react';
import { useSchoolStore } from '../store';
import { FileText, Download, Printer, Calendar, BarChart3, Scale, Users } from 'lucide-react';
import { toast } from '../components/Toast';
import { getMonthName, fmt, headwise, pdfHeadwiseIncome, pdfHeadwiseExpense, pdfMonthly, pdfAudit, pdfYearlyAGM } from '../lib/financeReportPdf';

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

const FinanceReports: React.FC = () => {
  const { transactions, fetchTransactions, students, fetchStudents, balances, fetchFinance } = useSchoolStore();
  const [tab, setTab] = useState<ReportTab>('headwise-income');
  const [dateFrom, setDateFrom] = useState(() => { const d = new Date(); d.setMonth(d.getMonth() - 3); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const [dateTo, setDateTo] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));

  useEffect(() => { fetchTransactions(); fetchStudents(); fetchFinance(); }, []);

  const filtered = transactions.filter((t: any) => {
    if (t.isCancelled || t.reversalOfId) return false;
    const d = new Date(t.transactionDate);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return ym >= dateFrom && ym <= dateTo;
  });

  const yearFiltered = transactions.filter((t: any) => {
    if (t.isCancelled || t.reversalOfId) return false;
    const d = new Date(t.transactionDate);
    const month = d.getMonth();
    const year = d.getFullYear();
    const filterYear = Number(yearFilter);
    if (month >= 8) { return year === filterYear - 1; } else { return year === filterYear; }
  });

  const incomeTx = filtered.filter((t: any) => t.transactionType === 'INCOME' && t.affectsIncomeLedger);
  const expenseTx = filtered.filter((t: any) => t.transactionType === 'EXPENSE' && t.affectsExpenseLedger);
  const yearIncome = yearFiltered.filter((t: any) => t.transactionType === 'INCOME' && t.affectsIncomeLedger);
  const yearExpense = yearFiltered.filter((t: any) => t.transactionType === 'EXPENSE' && t.affectsExpenseLedger);
  const allTransfers = yearFiltered.filter((t: any) => t.transactionType === 'INTERNAL_TRANSFER');

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

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

  const handlePdf = () => {
    try {
      if (tab === 'headwise-income') pdfHeadwiseIncome(incomeTx, dateFrom, dateTo);
      else if (tab === 'headwise-expense') pdfHeadwiseExpense(expenseTx, dateFrom, dateTo);
      else if (tab === 'monthly-income') pdfMonthly('income', incomeTx, students, dateFrom, dateTo);
      else if (tab === 'monthly-expense') pdfMonthly('expense', expenseTx, students, dateFrom, dateTo);
      else if (tab === 'audit') pdfAudit(yearIncome, yearExpense, yearFilter);
      else if (tab === 'yearly-agm') pdfYearlyAGM(yearIncome, yearExpense, yearFiltered, allTransfers, yearFilter, balances);
      toast('PDF downloaded ✓', 'success');
    } catch (e) { console.error(e); toast('PDF generation failed', 'error'); }
  };

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
              {[0, 1, 2].map(i => { const y = new Date().getFullYear() - i; return <option key={y} value={y}>{`${y-1}-${y}`}</option>; })}
            </select>
          </div>
        )}
        <div className="flex gap-2 ml-auto">
          {(tab === 'headwise-income' || tab === 'headwise-expense' || tab === 'monthly-income' || tab === 'monthly-expense' || tab === 'audit' || tab === 'yearly-agm') && (
            <>
              <button onClick={handlePdf} className="flex items-center gap-1.5 px-3 py-2 bg-school-primary text-white rounded-xl text-xs font-bold hover:opacity-90">
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
                <table className="w-full text-sm"><thead><tr className="bg-school-primary text-white text-[10px] uppercase"><th className="px-3 py-2 text-left">Category</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">%</th><th className="px-3 py-2 text-right">Txns</th><th className="px-3 py-2 text-right">Students</th></tr></thead>
                  <tbody>{hw.map(([cat, amt]) => {
                    const catTx = incomeTx.filter((t: any) => (t.category || 'Uncategorized') === cat);
                    const uniqueStudents = new Set(catTx.filter((t: any) => t.student?.name).map((t: any) => t.student?.name)).size;
                    return <tr key={cat} className="border-t border-school-border/50"><td className="px-3 py-2 font-medium">{cat}</td><td className="px-3 py-2 text-right">{fmt(amt)} /-</td><td className="px-3 py-2 text-right">{total > 0 ? ((amt / total) * 100).toFixed(1) : 0}%</td><td className="px-3 py-2 text-right">{catTx.length}</td><td className="px-3 py-2 text-right">{uniqueStudents || '—'}</td></tr>;
                  })}</tbody>
                  <tfoot><tr className="border-t-2 border-school-primary font-bold bg-school-paper"><td className="px-3 py-2">Total Income</td><td className="px-3 py-2 text-right">{fmt(total)} /-</td><td></td><td className="px-3 py-2 text-right">{incomeTx.length}</td><td className="px-3 py-2 text-right">{new Set(incomeTx.filter((t: any) => t.student?.name).map((t: any) => t.student?.name)).size || '—'}</td></tr></tfoot>
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
                <tbody>{hw.map(([cat, amt]) => <tr key={cat} className="border-t border-school-border/50"><td className="px-3 py-2 font-medium">{cat}</td><td className="px-3 py-2 text-right">{fmt(amt)} /-</td><td className="px-3 py-2 text-right">{total > 0 ? ((amt / total) * 100).toFixed(1) : 0}%</td><td className="px-3 py-2 text-right">{expenseTx.filter((t: any) => (t.category || 'Uncategorized') === cat).length}</td></tr>)}</tbody>
                <tfoot><tr className="border-t-2 border-school-primary font-bold bg-school-paper"><td className="px-3 py-2">Total Expense</td><td className="px-3 py-2 text-right">{fmt(total)} /-</td><td></td><td className="px-3 py-2 text-right">{expenseTx.length}</td></tr></tfoot>
              </table>
            </div>
          ); })()}
        </div>
      )}

      {tab === 'monthly-income' && (
        <div className="bg-white rounded-2xl border border-school-border p-4" id="print-area">
          <h4 className="font-serif text-sm text-school-primary mb-3">Monthly Income — {getMonthName(Number(dateFrom.split('-')[1]) - 1)} {dateFrom.split('-')[0]} to {getMonthName(Number(dateTo.split('-')[1]) - 1)} {dateTo.split('-')[0]}</h4>
          {(() => { if (!incomeTx.length) return <p className="text-sm text-school-muted">No income data for this period.</p>;
            const sorted = [...incomeTx].sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());
            const total = sorted.reduce((s, t) => s + Number(t.amount), 0);
            return (
            <table className="w-full text-sm"><thead><tr className="bg-school-primary text-white text-[10px] uppercase"><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Class</th><th className="px-3 py-2 text-left">Student</th><th className="px-3 py-2 text-left">Category</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
              <tbody>{sorted.map((t, i) => <tr key={t.id} className={`border-t border-school-border/50 ${i % 2 ? 'bg-school-paper/30' : ''}`}>
                <td className="px-3 py-2 whitespace-nowrap text-xs font-mono">{fmtDate(t.transactionDate)}</td>
                <td className="px-3 py-2 text-xs">{t.student?.class || t.className || '—'}</td>
                <td className="px-3 py-2 text-xs font-medium">{t.student?.name || '—'}</td>
                <td className="px-3 py-2 font-medium">{t.category || 'Uncategorized'}</td>
                <td className="px-3 py-2 text-right font-bold text-emerald-600">{fmt(Number(t.amount))} /-</td>
              </tr>)}</tbody>
              <tfoot><tr className="border-t-2 border-school-primary font-bold bg-school-paper"><td className="px-3 py-2" colSpan={4}>Total Income ({sorted.length} transactions)</td><td className="px-3 py-2 text-right text-emerald-600">{fmt(total)} /-</td></tr></tfoot>
            </table>
          ); })()}
        </div>
      )}

      {tab === 'monthly-expense' && (
        <div className="bg-white rounded-2xl border border-school-border p-4" id="print-area">
          <h4 className="font-serif text-sm text-school-primary mb-3">Monthly Expense — {getMonthName(Number(dateFrom.split('-')[1]) - 1)} {dateFrom.split('-')[0]} to {getMonthName(Number(dateTo.split('-')[1]) - 1)} {dateTo.split('-')[0]}</h4>
          {(() => { if (!expenseTx.length) return <p className="text-sm text-school-muted">No expense data for this period.</p>;
            const sorted = [...expenseTx].sort((a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime());
            const total = sorted.reduce((s, t) => s + Number(t.amount), 0);
            return (
            <table className="w-full text-sm"><thead><tr className="bg-school-primary text-white text-[10px] uppercase"><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Category</th><th className="px-3 py-2 text-left">Description</th><th className="px-3 py-2 text-right">Amount</th></tr></thead>
              <tbody>{sorted.map((t, i) => <tr key={t.id} className={`border-t border-school-border/50 ${i % 2 ? 'bg-school-paper/30' : ''}`}>
                <td className="px-3 py-2 whitespace-nowrap text-xs font-mono">{fmtDate(t.transactionDate)}</td>
                <td className="px-3 py-2 font-medium">{t.category || 'Uncategorized'}</td>
                <td className="px-3 py-2 text-xs text-school-muted">{t.description || '—'}</td>
                <td className="px-3 py-2 text-right font-bold text-rose-600">{fmt(Number(t.amount))} /-</td>
              </tr>)}</tbody>
              <tfoot><tr className="border-t-2 border-school-primary font-bold bg-school-paper"><td className="px-3 py-2" colSpan={3}>Total Expense ({sorted.length} transactions)</td><td className="px-3 py-2 text-right text-rose-600">{fmt(total)} /-</td></tr></tfoot>
            </table>
          ); })()}
        </div>
      )}

      {tab === 'audit' && (
        <div className="bg-white rounded-2xl border border-school-border p-4" id="print-area">
          {(() => { const ti = yearIncome.reduce((s, t) => s + Number(t.amount), 0); const te = yearExpense.reduce((s, t) => s + Number(t.amount), 0); const ns = ti - te; return (
            <div className="space-y-4">
              <h4 className="font-serif text-sm text-school-primary">Audit Report — FY {Number(yearFilter)-1}-{yearFilter}</h4>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center"><div className="text-[10px] uppercase text-emerald-600 font-bold">Total Income</div><div className="font-serif text-lg text-emerald-700">{fmt(ti)} /-</div></div>
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center"><div className="text-[10px] uppercase text-rose-600 font-bold">Total Expense</div><div className="font-serif text-lg text-rose-700">{fmt(te)} /-</div></div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center"><div className="text-[10px] uppercase text-blue-600 font-bold">Net Surplus</div><div className={`font-serif text-lg ${ns >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmt(ns)} /-</div></div>
              </div>
              <div>
                <h5 className="font-bold text-xs uppercase text-school-muted mb-2">Income Breakdown</h5>
                <table className="w-full text-sm"><thead><tr className="bg-school-primary text-white text-[10px] uppercase"><th className="px-3 py-2 text-left">Category</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">%</th></tr></thead>
                  <tbody>{headwise(yearIncome).map(([cat, amt]) => <tr key={cat} className="border-t border-school-border/50"><td className="px-3 py-2 font-medium">{cat}</td><td className="px-3 py-2 text-right">{fmt(amt)} /-</td><td className="px-3 py-2 text-right">{ti > 0 ? ((amt / ti) * 100).toFixed(1) : 0}%</td></tr>)}</tbody>
                </table>
              </div>
              <div>
                <h5 className="font-bold text-xs uppercase text-school-muted mb-2">Expense Breakdown</h5>
                <table className="w-full text-sm"><thead><tr className="bg-school-primary text-white text-[10px] uppercase"><th className="px-3 py-2 text-left">Category</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2 text-right">%</th></tr></thead>
                  <tbody>{headwise(yearExpense).map(([cat, amt]) => <tr key={cat} className="border-t border-school-border/50"><td className="px-3 py-2 font-medium">{cat}</td><td className="px-3 py-2 text-right">{fmt(amt)} /-</td><td className="px-3 py-2 text-right">{te > 0 ? ((amt / te) * 100).toFixed(1) : 0}%</td></tr>)}</tbody>
                </table>
              </div>
            </div>
          ); })()}
        </div>
      )}

      {tab === 'yearly-agm' && (
        <div className="bg-white rounded-2xl border border-school-border p-4" id="print-area">
          {(() => { const ti = yearIncome.reduce((s, t) => s + Number(t.amount), 0); const te = yearExpense.reduce((s, t) => s + Number(t.amount), 0); const ns = ti - te;
            const totalAssets = (balances.AL_RAWA_BANK || 0) + (balances.GLOBAL_FORUM_BANK || 0) + (balances.CASH_IN_HAND || 0);
            const fyLabel = `${Number(yearFilter)-1}-${yearFilter}`;
            const openingAL = (balances.AL_RAWA_BANK || 0) - ti + te;
            const openingGF = balances.GLOBAL_FORUM_BANK || 0;
            const openingCash = balances.CASH_IN_HAND || 0;
            const openTotal = openingAL + openingGF + openingCash;
            const totalTransfers = allTransfers.reduce((s: number, t: any) => s + Number(t.amount), 0);
            return (
            <div className="space-y-6">
              <h4 className="font-serif text-lg text-school-primary">Annual General Meeting Report — FY {fyLabel}</h4>
              <p className="text-xs text-school-muted">Financial Year {fyLabel} (Sep {Number(yearFilter)-1} – Aug {yearFilter})</p>

              {/* 1. Income & Expenditure */}
              <div>
                <h5 className="font-bold text-sm uppercase text-school-primary mb-3 border-b border-school-border pb-1">1. Income & Expenditure Statement</h5>
                <div className="space-y-1">
                  <div className="text-xs font-bold text-emerald-700 uppercase mb-1">Income</div>
                  {headwise(yearIncome).map(([cat, amt]) => <div key={cat} className="flex justify-between py-1 border-b border-school-border/50 text-sm"><span>{cat}</span><span className="font-bold">{fmt(amt)} /-</span></div>)}
                  <div className="flex justify-between py-2 border-b-2 border-school-primary font-bold text-sm bg-school-paper rounded px-2"><span>Total Income</span><span className="text-emerald-600">{fmt(ti)} /-</span></div>
                </div>
                <div className="space-y-1 mt-3">
                  <div className="text-xs font-bold text-rose-700 uppercase mb-1">Expenditure</div>
                  {headwise(yearExpense).map(([cat, amt]) => <div key={cat} className="flex justify-between py-1 border-b border-school-border/50 text-sm"><span>{cat}</span><span className="font-bold">{fmt(amt)} /-</span></div>)}
                  <div className="flex justify-between py-2 border-b-2 border-school-primary font-bold text-sm bg-school-paper rounded px-2"><span>Total Expenditure</span><span className="text-rose-600">{fmt(te)} /-</span></div>
                </div>
                <div className="flex justify-between py-3 mt-2 bg-school-primary text-white rounded-xl px-4 font-bold"><span>Annual {ns >= 0 ? 'Surplus' : 'Deficit'}</span><span>{fmt(Math.abs(ns))} /-</span></div>
              </div>

              {/* 2. Balance Sheet */}
              <div>
                <h5 className="font-bold text-sm uppercase text-school-primary mb-3 border-b border-school-border pb-1">2. Balance Sheet — As at 31 Aug {yearFilter}</h5>
                <table className="w-full text-sm">
                  <thead><tr className="bg-school-primary text-white text-[10px] uppercase"><th className="px-3 py-2 text-left">Account</th><th className="px-3 py-2 text-right">Balance</th></tr></thead>
                  <tbody>
                    <tr className="border-t border-school-border/50"><td className="px-3 py-2">AL RAWA Bank</td><td className="px-3 py-2 text-right font-bold">{fmt(balances.AL_RAWA_BANK || 0)} /-</td></tr>
                    <tr className="border-t border-school-border/50 bg-school-paper/30"><td className="px-3 py-2">Global Forum Bank</td><td className="px-3 py-2 text-right font-bold">{fmt(balances.GLOBAL_FORUM_BANK || 0)} /-</td></tr>
                    <tr className="border-t border-school-border/50"><td className="px-3 py-2">Cash in Hand</td><td className="px-3 py-2 text-right font-bold">{fmt(balances.CASH_IN_HAND || 0)} /-</td></tr>
                  </tbody>
                  <tfoot><tr className="border-t-2 border-school-primary font-bold bg-school-paper"><td className="px-3 py-2">Total Assets</td><td className="px-3 py-2 text-right">{fmt(totalAssets)} /-</td></tr></tfoot>
                </table>
                <div className="flex justify-between py-3 mt-2 bg-school-primary text-white rounded-xl px-4 font-bold"><span>Net Assets</span><span>{fmt(totalAssets)} /-</span></div>
              </div>

              {/* 3. Receipts & Payments */}
              <div>
                <h5 className="font-bold text-sm uppercase text-school-primary mb-3 border-b border-school-border pb-1">3. Receipts & Payments Statement</h5>
                <table className="w-full text-sm">
                  <thead><tr className="bg-school-primary text-white text-[10px] uppercase"><th className="px-3 py-2 text-left">Account</th><th className="px-3 py-2 text-right">Opening</th><th className="px-3 py-2 text-right">Closing</th></tr></thead>
                  <tbody>
                    <tr className="border-t border-school-border/50"><td className="px-3 py-2">AL RAWA Bank</td><td className="px-3 py-2 text-right">{fmt(openingAL)} /-</td><td className="px-3 py-2 text-right font-bold">{fmt(balances.AL_RAWA_BANK || 0)} /-</td></tr>
                    <tr className="border-t border-school-border/50 bg-school-paper/30"><td className="px-3 py-2">Global Forum Bank</td><td className="px-3 py-2 text-right">{fmt(openingGF)} /-</td><td className="px-3 py-2 text-right font-bold">{fmt(balances.GLOBAL_FORUM_BANK || 0)} /-</td></tr>
                    <tr className="border-t border-school-border/50"><td className="px-3 py-2">Cash in Hand</td><td className="px-3 py-2 text-right">{fmt(openingCash)} /-</td><td className="px-3 py-2 text-right font-bold">{fmt(balances.CASH_IN_HAND || 0)} /-</td></tr>
                  </tbody>
                  <tfoot><tr className="border-t-2 border-school-primary font-bold bg-school-paper"><td className="px-3 py-2">Total</td><td className="px-3 py-2 text-right">{fmt(openTotal)} /-</td><td className="px-3 py-2 text-right">{fmt(totalAssets)} /-</td></tr></tfoot>
                </table>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center"><div className="text-[10px] uppercase text-emerald-600 font-bold">Total Received</div><div className="font-bold text-emerald-700">{fmt(ti)} /-</div></div>
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center"><div className="text-[10px] uppercase text-rose-600 font-bold">Total Paid</div><div className="font-bold text-rose-700">{fmt(te)} /-</div></div>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center"><div className="text-[10px] uppercase text-blue-600 font-bold">Net Movement</div><div className={`font-bold ${ns >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmt(ns)} /-</div></div>
                </div>
              </div>

              {/* 4. Internal Transfers */}
              <div>
                <h5 className="font-bold text-sm uppercase text-school-primary mb-2 border-b border-school-border pb-1">4. Internal Transfers</h5>
                <p className="text-sm">Total: {fmt(totalTransfers)} /- ({allTransfers.length} transactions)</p>
                <p className="text-xs text-school-muted mt-1">Internal transfers between bank accounts and Cash in Hand do not affect income/expense.</p>
              </div>

              {/* 5. Recommendations */}
              <div>
                <h5 className="font-bold text-sm uppercase text-school-primary mb-2 border-b border-school-border pb-1">5. Recommendations</h5>
                <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
                  <li>Net surplus of {fmt(ns)} /- for FY {fyLabel}.</li>
                  {ti > 0 && <li>Expense-to-income ratio: {((te / ti) * 100).toFixed(1)}%.</li>}
                  <li>Total assets stand at {fmt(totalAssets)} /- across 3 accounts.</li>
                  <li>{yearFiltered.length} total transactions recorded during the year.</li>
                  <li>All financial records are available for detailed audit.</li>
                </ol>
              </div>

              {/* Signatures */}
              <div className="border-t border-school-border pt-4 mt-6">
                <div className="flex justify-between">
                  {[['Finance Director', 12], ['Managing Director', 82], ['Chairman', 144]].map(([lbl, ml]) => (
                    <div key={lbl} className="text-center" style={{ marginLeft: `${ml / 16}rem` }}>
                      <div className="w-40 border-b border-gray-400 mb-1"></div>
                      <span className="text-[10px] text-school-muted font-bold uppercase">{lbl}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ); })()}
        </div>
      )}
    </div>
  );
};

export default FinanceReports;
