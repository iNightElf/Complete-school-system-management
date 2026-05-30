import React, { useState, useEffect } from 'react';
import { useSchoolStore } from '../store';
import axios from 'axios';
import jsPDF from 'jspdf';
import { toast } from '../components/Toast';
import { AlertTriangle, Download, Printer } from 'lucide-react';

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

  function pdfDefaulter() {
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4', unit: 'mm' });
    const M = 10, PW = 277;
    let y = 10;

    // Header — same as other PDFs
    doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(26, 26, 46);
    doc.text('AL RAWA English School', M, y + 6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130, 124, 114);
    doc.text('ESTD: 2022  ·  Read in the name of your Lord', M, y + 11);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(26, 26, 46);
    doc.text('FEE DEFAULTER REPORT', M, y + 22);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(130, 124, 114);
    doc.text(`${classLabel}  |  ${subtitle}  |  ${displayData.length} students`, M, y + 27);
    doc.text(`Total Due: ${fmt(totalDueAll)} /-   |   Total Paid: ${fmt(totalPaidAll)} /-`, M, y + 32);
    y += 38;

    const nameW = 40, classW = 22, feeW = 44;
    const colW = monthRange.length > 0 ? Math.max(16, Math.floor((PW - nameW - classW - feeW - 42) / monthRange.length)) : 0;
    const dueW = 22, paidW = 22, balW = 22;

    function drawHeader() {
      doc.setFillColor(26, 26, 46);
      doc.rect(M, y, PW, 7, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(255, 255, 255);
      doc.text('Student', M + 2, y + 4.5);
      doc.text('Class', M + nameW + 2, y + 4.5);
      doc.text('Fee (Amount)', M + nameW + classW + 2, y + 4.5);
      let cx = M + nameW + classW + feeW;
      monthRange.forEach(m => {
        const [yr, mn] = m.split('-');
        doc.text(`${getMonthName(Number(mn) - 1)} '${yr.slice(2)}`, cx + 2, y + 4.5);
        cx += colW;
      });
      doc.text('Due', cx + 2, y + 4.5);
      doc.text('Paid', cx + dueW + 2, y + 4.5);
      doc.text('Balance', cx + dueW + paidW + 2, y + 4.5);
      y += 7;
    }

    drawHeader();

    displayData.forEach((row: any) => {
      const recurring = row.fees.filter((f: any) => f.type === 'recurring' || f.type === 'special');
      const onetime = row.fees.filter((f: any) => f.type === 'onetime' || f.type === 'global');
      const allFees = [...recurring, ...onetime];

      allFees.forEach((fee: any, idx: number) => {
        if (y > 185) { doc.addPage(); y = 14; drawHeader(); }
        if (idx % 2 === 0) { doc.setFillColor(255, 253, 247); doc.rect(M, y, PW, 6, 'F'); }

        // Student name (only on first row)
        if (idx === 0) {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(26, 26, 46);
          doc.text(row.name.substring(0, 22), M + 2, y + 4);
        }
        // Class (only on first row)
        if (idx === 0) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
          doc.text(`${row.class}${row.roll ? `-${row.roll}` : ''}`, M + nameW + 2, y + 4);
        }

        // Fee badge + amount
        const badgeColor = fee.type === 'special' ? [245, 158, 11] :
                           fee.type === 'global' ? [168, 85, 247] :
                           fee.type === 'recurring' ? [59, 130, 246] : [107, 114, 128];
        doc.setFillColor(...badgeColor);
        doc.roundedRect(M + nameW + classW + 1, y + 0.5, doc.getTextWidth(fee.name.substring(0, 16)) + 4, 4.5, 1, 1, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(255, 255, 255);
        doc.text(fee.name.substring(0, 16), M + nameW + classW + 3, y + 3.5);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(100, 100, 100);
        const feeX = M + nameW + classW + feeW - 2;
        doc.text(fmt(fee.amount) + ' /-', feeX, y + 4, { align: 'right' });

        // Monthly check/cross boxes
        let cx = M + nameW + classW + feeW;
        monthRange.forEach(m => {
          if (fee.months) {
            const md = fee.months.find((x: any) => x.month === m);
            if (md) {
              const boxX = cx + (colW - 5) / 2;
              const boxY = y + 0.5;
              if (md.paid) {
                doc.setFillColor(209, 250, 229);
                doc.roundedRect(boxX, boxY, 5, 5, 0.5, 0.5, 'F');
                doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
                doc.setTextColor(22, 101, 52);
                doc.text('\u2713', boxX + 2.5, boxY + 4, { align: 'center' });
              } else {
                doc.setFillColor(254, 226, 226);
                doc.roundedRect(boxX, boxY, 5, 5, 0.5, 0.5, 'F');
                doc.setFont('helvetica', 'bold'); doc.setFontSize(7);
                doc.setTextColor(185, 28, 28);
                doc.text('\u2717', boxX + 2.5, boxY + 4, { align: 'center' });
              }
            }
          }
          cx += colW;
        });

        // Due/Paid/Balance (only on first row)
        if (idx === 0) {
          const sumX = M + nameW + classW + feeW + colW * monthRange.length;
          doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
          doc.setTextColor(26, 26, 46);
          doc.text(fmt(row.totalDue) + ' /-', sumX + dueW - 2, y + 4, { align: 'right' });
          doc.setTextColor(22, 101, 52);
          doc.text(fmt(row.totalPaid) + ' /-', sumX + dueW + paidW - 2, y + 4, { align: 'right' });
          doc.setTextColor(row.balance > 0 ? 185 : 22, row.balance > 0 ? 28 : 101, row.balance > 0 ? 28 : 52);
          doc.text(fmt(Math.abs(row.balance)) + ' /-', sumX + dueW + paidW + balW - 2, y + 4, { align: 'right' });
        }

        doc.setTextColor(26, 26, 46);
        y += 6;
      });
    });

    // Grand total
    y += 2;
    doc.setFillColor(26, 26, 46);
    doc.rect(M, y, PW, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(255, 255, 255);
    doc.text('GRAND TOTAL', M + 2, y + 4.5);
    const gx = M + nameW + classW + feeW + colW * monthRange.length;
    doc.text(fmt(totalDueAll) + ' /-', gx + dueW - 2, y + 4.5, { align: 'right' });
    doc.text(fmt(totalPaidAll) + ' /-', gx + dueW + paidW - 2, y + 4.5, { align: 'right' });
    const gBal = totalDueAll - totalPaidAll;
    doc.setTextColor(gBal > 0 ? 255 : 255, gBal > 0 ? 255 : 255, gBal > 0 ? 255 : 255);
    doc.text(fmt(Math.abs(gBal)) + ' /-', gx + dueW + paidW + balW - 2, y + 4.5, { align: 'right' });

    doc.save(`Defaulter_Report_${filterClass || 'All'}_${monthFrom}_to_${monthTo}.pdf`);
    toast('PDF downloaded', 'success');
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="bg-white rounded-2xl border border-school-border p-4 flex flex-wrap gap-4 items-end">
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
            <optgroup label="Monthly">
              <option value="Tuition Fee">Tuition Fee</option>
              <option value="Hifz Tuition Fee">Hifz Tuition Fee</option>
              <option value="Transport Fee">Transport Fee</option>
              <option value="hifz_tuition">Hifz Fee (Assigned)</option>
              <option value="hifz_admission">Hifz Admission Fee (Assigned)</option>
              <option value="transport">Transport Fee (Assigned)</option>
            </optgroup>
            <optgroup label="Yearly">
              <option value="Admission Fee">Admission Fee</option>
              <option value="Hifz Admission Fee">Hifz Admission Fee</option>
              <option value="Books Fee">Books Fee</option>
              <option value="Copy Fee">Copy Fee</option>
              <option value="Stationary Fee">Stationary Fee</option>
              <option value="Accessories Fee">Accessories Fee</option>
            </optgroup>
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
      <div className="bg-white rounded-2xl border border-school-border overflow-hidden">
        <div className="px-5 py-4 border-b border-school-border flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-500" />
          <h4 className="font-serif text-sm text-school-primary">Fee Defaulters</h4>
          <span className="text-[10px] text-school-muted">({displayData.length} students)</span>
          <div className="ml-auto flex gap-2">
            <button onClick={() => { try { pdfDefaulter(); } catch (e) { console.error(e); toast('PDF failed', 'error'); } }}
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
          <table className="w-full text-sm">
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
                <tr><td colSpan={8 + monthRange.length} className="px-4 py-8 text-center text-sm text-school-muted">Loading...</td></tr>
              ) : displayData.length > 0 ? displayData.map((row: any) => {
                const recurring = row.fees.filter((f: any) => f.type === 'recurring' || f.type === 'special');
                const onetime = row.fees.filter((f: any) => f.type === 'onetime' || f.type === 'global');
                const allFees = [...recurring, ...onetime];
                return allFees.map((fee: any, idx: number) => (
                  <tr key={`${row.studentId}_${fee.name}_${idx}`} className="hover:bg-school-paper/30 transition-colors">
                    {idx === 0 ? (
                      <>
                        <td className="px-4 py-2 sticky left-0 bg-white z-10" rowSpan={allFees.length}>
                          <p className="font-bold text-xs">{row.name}</p>
                          {row.fatherName && <p className="text-[10px] text-school-muted">{row.fatherName}</p>}
                        </td>
                        <td className="px-3 py-2 sticky left-[140px] bg-white z-10 text-xs" rowSpan={allFees.length}>
                          {row.class}{row.roll ? ` - ${row.roll}` : ''}
                        </td>
                      </>
                    ) : null}
                    <td className="px-3 py-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        fee.type === 'special' ? 'bg-amber-50 text-amber-700' :
                        fee.type === 'global' ? 'bg-purple-50 text-purple-700' :
                        fee.type === 'recurring' ? 'bg-blue-50 text-blue-700' :
                        'bg-school-paper text-school-primary'
                      }`}>{fee.name}</span>
                      <span className="text-[9px] text-school-muted ml-1">{fmt(fee.amount)} /-</span>
                    </td>
                    {/* Monthly cells */}
                    {monthRange.map(m => {
                      if (fee.months) {
                        const md = fee.months.find((x: any) => x.month === m);
                        if (md) {
                          return <td key={m} className="px-1 py-2 text-center">
                            <span className={`inline-block w-4 h-4 rounded text-[8px] leading-4 font-bold ${md.paid ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {md.paid ? '✓' : '✗'}
                            </span>
                          </td>;
                        }
                        return <td key={m} className="px-1 py-2 text-center text-[8px] text-school-muted">—</td>;
                      }
                      // One-time fee: show in first month column only
                      if (idx === 0 && fee.paid !== undefined) {
                        return <td key={m} className="px-1 py-2 text-center"></td>;
                      }
                      return <td key={m} className="px-1 py-2 text-center text-[8px] text-school-muted">—</td>;
                    })}
                    {idx === 0 ? (
                      <>
                        <td className="px-3 py-2 text-right font-bold text-xs" rowSpan={allFees.length}>{fmt(row.totalDue)} /-</td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-emerald-600" rowSpan={allFees.length}>{fmt(row.totalPaid)} /-</td>
                        <td className="px-3 py-2 text-right font-bold text-xs" rowSpan={allFees.length}>
                          <span className={row.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}>{fmt(Math.abs(row.balance))} /-</span>
                          {row.balance <= 0 && <span className="text-[9px] text-emerald-500 ml-1">(clear)</span>}
                        </td>
                      </>
                    ) : null}
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
