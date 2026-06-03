import { useState, useEffect } from 'react';
import { useSchoolStore } from '../store';
import axios from 'axios';
import { toast } from '../components/Toast';
import { AlertTriangle, Download, Printer, Check, X } from 'lucide-react';
import { defaulterPDF } from '../lib/defaulterPdf';
import { API_URL } from '../lib/config';

function getMonthName(m: number) { return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m]; }

function shortName(s: string) { const p = s.trim().split(/\s+/); return p.length > 2 ? p.slice(0, 2).join(' ') : s; }

function getMonthOptions(): { value: string; label: string }[] {
  const now = new Date();
  const months: { value: string; label: string }[] = [];
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ value: v, label: `${getMonthName(d.getMonth())} ${d.getFullYear()}` });
  }
  return months;
}

const MONTH_OPTIONS = getMonthOptions();

const DefaulterTab: React.FC = () => {
  const { classes, students, feeSchedules, fetchClasses, fetchStudents } = useSchoolStore();
  const [defaulterData, setDefaulterData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [filterClass, setFilterClass] = useState('');
  const [filterStudent, setFilterStudent] = useState('');
  const [filterFee, setFilterFee] = useState('');
  const [monthFrom, setMonthFrom] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 3);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthTo, setMonthTo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));

  const fmt = (n: number) => n.toLocaleString('en-BD');

  const fetchDefaulter = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterClass) params.className = filterClass;
      if (filterStudent) params.studentId = filterStudent;
      if (filterFee) params.feeCategory = filterFee;
      params.monthFrom = monthFrom;
      params.monthTo = monthTo;
      params.year = yearFilter;
      const res = await axios.get(`${API_URL}/finance/defaulter`, { params, withCredentials: true, signal });
      setDefaulterData(res.data);
    } catch { if (!signal?.aborted) toast('Failed to load defaulter data', 'error'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchClasses(); fetchStudents(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetchDefaulter(controller.signal);
    return () => controller.abort();
  }, [filterClass, filterStudent, filterFee, monthFrom, monthTo, yearFilter]);

  const displayData = filterFee
    ? defaulterData.filter(r => r.fees.some((f: any) => f.name === filterFee))
    : defaulterData;

  const totalDueAll = displayData.reduce((s: number, r: any) => s + r.totalDue, 0);
  const totalPaidAll = displayData.reduce((s: number, r: any) => s + r.totalPaid, 0);

  const monthRange: string[] = [];
  if (monthFrom && monthTo) {
    let [y, m] = monthFrom.split('-').map(Number);
    const [ey, em] = monthTo.split('-').map(Number);
    while (y < ey || (y === ey && m <= em)) {
      monthRange.push(`${y}-${String(m).padStart(2, '0')}`);
      m++; if (m > 12) { m = 1; y++; }
    }
  }

  const yearlyFeeNames = [...new Set(displayData.flatMap((r: any) =>
    r.fees.filter((f: any) => f.type === 'onetime' || f.type === 'global').map((f: any) => f.name)
  ))];
  const monthlyFeeNames = [...new Set(displayData.flatMap((r: any) =>
    r.fees.filter((f: any) => f.type === 'recurring' || f.type === 'special').map((f: any) => f.name)
  ))];

  function getStudentFee(row: any, name: string): any {
    return row.fees.find((f: any) => f.name === name) || null;
  }

  function getMonthlyFeeValue(row: any, feeName: string, month: string): any {
    const fee = row.fees.find((f: any) => f.name === feeName && (f.type === 'recurring' || f.type === 'special'));
    if (!fee?.months) return null;
    return fee.months.find((m: any) => m.month === month) || null;
  }

  const classLabel = filterClass || 'All Classes';
  const subtitle = `${getMonthName(Number(monthFrom.split('-')[1]) - 1)} ${monthFrom.split('-')[0]} — ${getMonthName(Number(monthTo.split('-')[1]) - 1)} ${monthTo.split('-')[0]}  |  Year ${yearFilter}`;

  function printDefaulter() {
    const el = document.getElementById('defaulter-print-area');
    if (!el) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Defaulter Report</title><style>
      @page{size:landscape;margin:10mm}
      body{font-family:system-ui,sans-serif;padding:20px;color:#1a1a2e;font-size:12px}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{padding:4px 6px;border:1px solid #d7d2c8;text-align:center;vertical-align:middle;font-size:10px}
      th{background:#1a1a2e;color:#fff;font-size:9px;text-transform:uppercase}
      td:first-child{text-align:left}
      .paid{color:#059669;font-weight:bold}.unpaid{color:#dc2626;font-weight:bold}
      h2{font-size:14px;margin:0}h3{font-size:11px;margin:2px 0 8px;color:#827c72}
      tfoot td{background:#1a1a2e;color:#fff;font-weight:bold;font-size:11px}
      @media print{body{padding:10px}}
    </style></head><body><h2>AL RAWA English School</h2><h3>Fee Defaulter Report — ${subtitle}</h3>${el.innerHTML}</body></html>`);
    w.document.close(); w.print();
  }

  function handlePdfDefaulter() {
    try {
      defaulterPDF({ displayData, monthRange, classLabel, subtitle, totalDueAll, totalPaidAll, filterClass, monthFrom, monthTo, yearlyFeeNames, monthlyFeeNames });
      toast('PDF downloaded', 'success');
    } catch { toast('PDF failed', 'error'); }
  }

  const hasMonthly = monthlyFeeNames.length > 0 && monthRange.length > 0;
  const colCount = 1 + yearlyFeeNames.length + (hasMonthly ? monthRange.length * monthlyFeeNames.length : 0) + 3;

  const renderFeeCell = (amount: number, paid: boolean) => (
    <span className={`font-bold text-[10px] ${paid ? 'text-emerald-600' : 'text-rose-600'}`}>
      {fmt(amount)}/- {paid ? <Check size={10} className="inline" /> : <X size={10} className="inline" />}
    </span>
  );

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-school-border p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Class</label>
          <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setFilterStudent(''); }}
            className="border border-school-border rounded-xl px-3 py-2 text-sm bg-white">
            <option value="">Whole School</option>
            {classes.map((c: any) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>
        {filterClass && (
          <div>
            <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Student</label>
            <select value={filterStudent} onChange={e => setFilterStudent(e.target.value)}
              className="border border-school-border rounded-xl px-3 py-2 text-sm bg-white">
              <option value="">All Students</option>
              {students.filter((s: any) => s.class === filterClass).map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}{s.fatherName ? ` (${s.fatherName})` : ''}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Fee Type</label>
          <select value={filterFee} onChange={e => setFilterFee(e.target.value)}
            className="border border-school-border rounded-xl px-3 py-2 text-sm bg-white">
            <option value="">All Fees</option>
            {(() => {
              const monthly = feeSchedules.filter((fs: any) => fs.frequency === 'MONTHLY');
              const yearly = feeSchedules.filter((fs: any) => fs.frequency === 'YEARLY' || fs.frequency === 'ONETIME');
              return <>
                {monthly.length > 0 && <optgroup label="Monthly">
                  {[...new Set(monthly.map((fs: any) => fs.category))].map(c => <option key={c} value={c}>{c}</option>)}
                </optgroup>}
                {yearly.length > 0 && <optgroup label="Yearly">
                  {[...new Set(yearly.map((fs: any) => fs.category))].map(c => <option key={c} value={c}>{c}</option>)}
                </optgroup>}
              </>;
            })()}
          </select>
        </div>

        <div className="border-l border-school-border pl-4 flex gap-3 items-end">
          <div>
            <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Month From</label>
            <select value={monthFrom} onChange={e => setMonthFrom(e.target.value)}
              className="border border-school-border rounded-xl px-3 py-2 text-sm bg-white">
              {MONTH_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Month To</label>
            <select value={monthTo} onChange={e => setMonthTo(e.target.value)}
              className="border border-school-border rounded-xl px-3 py-2 text-sm bg-white">
              {MONTH_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase text-school-muted mb-1 block">Year</label>
            <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
              className="border border-school-border rounded-xl px-3 py-2 text-sm bg-white">
              {[0, 1, 2].map(i => { const y = new Date().getFullYear() - i; return <option key={y} value={y}>{y}</option>; })}
            </select>
          </div>
        </div>

        <div className="ml-auto flex gap-6 text-right">
          <div>
            <div className="text-[10px] uppercase text-school-muted font-bold">Total Due</div>
            <div className="font-serif text-lg font-bold text-rose-600">{fmt(totalDueAll)} /-</div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-school-muted font-bold">Total Paid</div>
            <div className="font-serif text-lg font-bold text-emerald-600">{fmt(totalPaidAll)} /-</div>
          </div>
        </div>
      </div>

      {/* Defaulter Table */}
      <div className="bg-white rounded-xl border border-school-border overflow-hidden">
        <div className="px-5 py-4 border-b border-school-border flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-500" />
          <h4 className="font-serif text-sm text-school-primary">Fee Defaulters</h4>
          <span className="text-[10px] text-school-muted">({displayData.length} students)</span>
          <div className="ml-auto flex gap-2">
            <button onClick={handlePdfDefaulter}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-school-primary text-white rounded-xl text-xs font-bold hover:opacity-90">
              <Download size={14} /> PDF
            </button>
            <button onClick={printDefaulter}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-school-border rounded-xl text-xs font-bold hover:border-school-accent">
              <Printer size={14} /> Print
            </button>
          </div>
        </div>
        <div id="defaulter-print-area" className="overflow-x-auto">
          <table className="w-full text-sm mobile-card-table">
            <thead className="bg-school-paper/50 text-[10px] uppercase tracking-widest text-school-muted font-bold">
              <tr>
                <th className="px-4 py-3 text-left sticky left-0 bg-school-paper/50 z-10" rowSpan={2}>Student<br/><span className="text-[9px] font-normal">Class</span></th>
                {yearlyFeeNames.map(name => (
                  <th key={name} className="px-2 py-3 text-center" rowSpan={2}>{shortName(name)}</th>
                ))}
                {hasMonthly && monthRange.map(m => {
                  const [yr, mn] = m.split('-');
                  return <th key={m} className="px-2 py-3 text-center" colSpan={monthlyFeeNames.length}>
                    {getMonthName(Number(mn) - 1)}<br/>'{yr.slice(2)}
                  </th>;
                })}
                <th className="px-3 py-3 text-right" rowSpan={2}>Due</th>
                <th className="px-3 py-3 text-right" rowSpan={2}>Paid</th>
                <th className="px-3 py-3 text-right" rowSpan={2}>Balance</th>
              </tr>
              {hasMonthly && (
                <tr>
                  {monthRange.flatMap(m => monthlyFeeNames.map(name => (
                    <th key={`${m}_${name}`} className="px-1 py-2 text-center text-[9px] font-semibold tracking-normal">{shortName(name)}</th>
                  )))}
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-school-border/50">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><div className="h-4 bg-school-paper rounded animate-pulse w-24" /></td>
                    {yearlyFeeNames.map(name => (
                      <td key={name} className="px-2 py-3"><div className="h-4 bg-school-paper rounded animate-pulse w-12 mx-auto" /></td>
                    ))}
                    {hasMonthly && monthRange.flatMap(m => monthlyFeeNames.map(name => (
                      <td key={`sk_${m}_${name}`} className="px-1 py-3"><div className="h-4 w-8 bg-school-paper rounded animate-pulse mx-auto" /></td>
                    )))}
                    <td className="px-3 py-3"><div className="h-4 bg-school-paper rounded animate-pulse w-16 ml-auto" /></td>
                    <td className="px-3 py-3"><div className="h-4 bg-school-paper rounded animate-pulse w-16 ml-auto" /></td>
                    <td className="px-3 py-3"><div className="h-4 bg-school-paper rounded animate-pulse w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : displayData.length > 0 ? displayData.map((row: any) => (
                <tr key={row.studentId} className="hover:bg-school-paper/30 transition-colors border-t-2 border-school-primary/20">
                  <td className="px-4 py-2 sticky left-0 bg-white z-10 font-bold text-xs border-r border-school-border/30" data-label="Student">
                    {row.name}<br/><span className="text-[10px] text-school-muted font-normal">{row.class}</span>
                  </td>
                  {yearlyFeeNames.map(name => {
                    const fee = getStudentFee(row, name);
                    if (!fee) return <td key={name} className="px-2 py-2 text-center text-[8px] text-school-muted">—</td>;
                    return <td key={name} className="px-2 py-2 text-center">{renderFeeCell(fee.amount, fee.paid)}</td>;
                  })}
                  {hasMonthly && monthRange.flatMap(m => monthlyFeeNames.map(name => {
                    const md = getMonthlyFeeValue(row, name, m);
                    if (!md) return <td key={`${m}_${name}`} className="px-1 py-2 text-center"><span className="text-rose-500"><X size={12} className="inline" /></span></td>;
                    return <td key={`${m}_${name}`} className="px-1 py-2 text-center">{renderFeeCell(md.amount, md.paid)}</td>;
                  }))}
                  <td className="px-3 py-2 text-right font-bold text-xs" data-label="Due">{fmt(row.totalDue)} /-</td>
                  <td className="px-3 py-2 text-right text-xs font-bold text-emerald-600" data-label="Paid">{fmt(row.totalPaid)} /-</td>
                  <td className="px-3 py-2 text-right font-bold text-xs" data-label="Balance">
                    <span className={row.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}>{fmt(Math.abs(row.balance))} /-</span>
                    {row.balance <= 0 && <span className="text-[9px] text-emerald-500 ml-1">(clear)</span>}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={colCount} className="px-4 py-12 text-center text-sm text-school-muted italic">
                  No defaulter data found.
                </td></tr>
              )}
            </tbody>
            {!loading && displayData.length > 0 && (
            <tfoot>
              <tr className="bg-school-primary/5 border-t-2 border-school-primary/20">
                <td className="px-4 py-3 sticky left-0 bg-school-primary/5 text-xs font-bold" colSpan={1 + yearlyFeeNames.length}>Grand Total</td>
                {hasMonthly && monthRange.flatMap(m => monthlyFeeNames.map(name => (
                  <td key={`gt_${m}_${name}`} className="px-2 py-3"></td>
                )))}
                <td className="px-3 py-3 text-right font-bold text-xs">{fmt(totalDueAll)} /-</td>
                <td className="px-3 py-3 text-right font-bold text-xs text-emerald-600">{fmt(totalPaidAll)} /-</td>
                <td className={`px-3 py-3 text-right font-bold text-xs ${totalDueAll - totalPaidAll > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {fmt(Math.abs(totalDueAll - totalPaidAll))} /-
                </td>
              </tr>
            </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default DefaulterTab;
