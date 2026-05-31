import { useState, useEffect } from 'react';
import { useSchoolStore } from '../store';
import axios from 'axios';
import { toast } from '../components/Toast';
import { AlertTriangle, Download, Printer, Check, X } from 'lucide-react';
import { defaulterPDF } from '../lib/defaulterPdf';

const API_URL = '/api';

function getMonthName(m: number) { return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m]; }

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
  const { classes, students, fetchClasses, fetchStudents } = useSchoolStore();
  const [defaulterData, setDefaulterData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [feeSchedules, setFeeSchedules] = useState<any[]>([]);

  useEffect(() => {
    axios.get('/api/finance/fee-schedules', { withCredentials: true }).then(res => setFeeSchedules(res.data)).catch(() => {});
  }, []);

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

  useEffect(() => { fetchClasses(); fetchStudents(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const controller = new AbortController();
    fetchDefaulter(controller.signal);
    return () => controller.abort();
  }, [filterClass, filterStudent, filterFee, monthFrom, monthTo, yearFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayData = filterFee
    ? defaulterData.filter(r => r.fees.some((f: any) => f.name === filterFee))
    : defaulterData;

  const totalDueAll = displayData.reduce((s: number, r: any) => s + Math.max(0, r.balance), 0);
  const totalPaidAll = displayData.reduce((s: number, r: any) => s + r.totalPaid, 0);

  // Get month range for column headers
  const monthRange: string[] = [];
  if (monthFrom && monthTo) {
    let [y, m] = monthFrom.split('-').map(Number);
    const [ey, em] = monthTo.split('-').map(Number);
    while (y < ey || (y === ey && m <= em)) {
      monthRange.push(`${y}-${String(m).padStart(2, '0')}`);
      m++; if (m > 12) { m = 1; y++; }
    }
  }

  const classLabel = filterClass || 'All Classes';
  const subtitle = `${getMonthName(Number(monthFrom.split('-')[1]) - 1)} ${monthFrom.split('-')[0]} — ${getMonthName(Number(monthTo.split('-')[1]) - 1)} ${monthTo.split('-')[0]}  |  Year ${yearFilter}`;

  function printDefaulter() {
    const el = document.getElementById('defaulter-print-area');
    if (!el) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>Defaulter Report</title><style>
      body{font-family:system-ui,sans-serif;padding:20px;color:#1a1a2e;font-size:12px}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{padding:4px 6px;border:1px solid #d7d2c8;text-align:left;font-size:10px}
      th{background:#1a1a2e;color:#fff;font-size:9px;text-transform:uppercase}
      .paid{color:#059669;font-weight:bold}.unpaid{color:#dc2626;font-weight:bold}
      h2{font-size:14px;margin:0}h3{font-size:11px;margin:2px 0 8px;color:#827c72}
      @media print{body{padding:10px}}
    </style></head><body><h2>AL RAWA English School</h2><h3>Fee Defaulter Report — ${subtitle}</h3>${el.innerHTML}</body></html>`);
    w.document.close(); w.print();
  }

  function handlePdfDefaulter() {
    try {
      defaulterPDF({ displayData, monthRange, classLabel, subtitle, totalDueAll, totalPaidAll, filterClass, monthFrom, monthTo });
      toast('PDF downloaded', 'success');
    } catch { toast('PDF failed', 'error'); }
  }

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
                <th className="px-4 py-3 text-left sticky left-0 bg-school-paper/50 z-10">Student</th>
                <th className="px-3 py-3 text-left sticky left-[140px] bg-school-paper/50 z-10">Class</th>
                <th className="px-3 py-3 text-left">Fee</th>
                {monthRange.map(m => {
                  const [yr, mn] = m.split('-');
                  return <th key={m} className="px-2 py-3 text-center">{getMonthName(Number(mn) - 1)}<br/>'{yr.slice(2)}</th>;
                })}
                <th className="px-3 py-3 text-right">Due</th>
                <th className="px-3 py-3 text-right">Paid</th>
                <th className="px-3 py-3 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-school-border/50">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    {[1,2,3,4,5,6].map(j => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-school-paper rounded animate-pulse w-3/4" /></td>
                    ))}
                    {monthRange.map(m => <td key={m} className="px-2 py-3"><div className="h-4 w-4 bg-school-paper rounded animate-pulse mx-auto" /></td>)}
                    {[1,2,3].map(j => <td key={j} className="px-3 py-3"><div className="h-4 bg-school-paper rounded animate-pulse w-12 ml-auto" /></td>)}
                  </tr>
                ))
              ) : displayData.length > 0 ? displayData.map((row: any) => {
                const recurring = row.fees.filter((f: any) => f.type === 'recurring' || f.type === 'special');
                const onetime = row.fees.filter((f: any) => f.type === 'onetime' || f.type === 'global');
                const allFees = [...recurring, ...onetime];
                return allFees.map((fee: any, idx: number) => (
                  <tr key={`${row.studentId}_${fee.name}_${idx}`} className="hover:bg-school-paper/30 transition-colors">
                    {idx === 0 ? (
                      <>
                        <td className="px-4 py-2 sticky left-0 bg-white z-10" rowSpan={allFees.length} data-label="Student">
                          <p className="font-bold text-xs">{row.name}</p>
                          {row.fatherName && <p className="text-[10px] text-school-muted">{row.fatherName}</p>}
                        </td>
                        <td className="px-3 py-2 sticky left-[140px] bg-white z-10 text-xs" rowSpan={allFees.length} data-label="Class">
                          {row.class}{row.roll ? ` - ${row.roll}` : ''}
                        </td>
                      </>
                    ) : <td data-label="Student" className="hidden"></td>}
                    <td className="px-3 py-2" data-label="Fee">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-700">{fee.name}</span>
                      <span className="text-[9px] text-school-muted ml-1">{fmt(fee.amount)} /-</span>
                    </td>
                    {/* Monthly cells */}
                    {monthRange.map(m => {
                      const [yr, mn] = m.split('-');
                      if (fee.months) {
                        const md = fee.months.find((x: any) => x.month === m);
                        if (md) {
                          return <td key={m} className="px-1 py-2 text-center" data-label={`${getMonthName(Number(mn) - 1)} '${yr.slice(2)}`}>
                            <span className={`inline-block w-4 h-4 rounded text-[8px] leading-4 font-bold ${md.paid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {md.paid ? <Check size={10} /> : <X size={10} />}
                            </span>
                          </td>;
                        }
                        return <td key={m} className="px-1 py-2 text-center text-[8px] text-school-muted" data-label={`${getMonthName(Number(mn) - 1)} '${yr.slice(2)}`}>—</td>;
                      }
                      if (idx === 0 && fee.paid !== undefined) {
                        return <td key={m} className="px-1 py-2 text-center" data-label={`${getMonthName(Number(mn) - 1)} '${yr.slice(2)}`}></td>;
                      }
                      return <td key={m} className="px-1 py-2 text-center text-[8px] text-school-muted" data-label={`${getMonthName(Number(mn) - 1)} '${yr.slice(2)}`}>—</td>;
                    })}
                    {idx === 0 ? (
                      <>
                        <td className="px-3 py-2 text-right font-bold text-xs" rowSpan={allFees.length} data-label="Due">{fmt(row.totalDue)} /-</td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-emerald-600" rowSpan={allFees.length} data-label="Paid">{fmt(row.totalPaid)} /-</td>
                        <td className="px-3 py-2 text-right font-bold text-xs" rowSpan={allFees.length} data-label="Balance">
                          <span className={row.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}>{fmt(Math.abs(row.balance))} /-</span>
                          {row.balance <= 0 && <span className="text-[9px] text-emerald-500 ml-1">(clear)</span>}
                        </td>
                      </>
                    ) : <td data-label="Due" className="hidden"></td>}
                  </tr>
                ));
              }) : (
                <tr><td colSpan={8 + monthRange.length} className="px-4 py-12 text-center text-sm text-school-muted italic">
                  No defaulter data found.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DefaulterTab;
