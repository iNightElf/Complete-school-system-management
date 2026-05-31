import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { toast } from '../components/Toast';
import { Upload, Trash2, Edit2, Check, X } from 'lucide-react';
import { useSchoolStore } from '../store';

const API_URL = '/api';

const STUDENT_CATEGORIES = [
  'Tuition Fee', 'Admission Fee', 'Hifz Tuition Fee', 'Hifz Admission Fee',
  'Books Fee', 'Copy Fee', 'Stationary Fee', 'Accessories Fee',
];

const INCOME_CATEGORIES = [
  ...STUDENT_CATEGORIES, 'Transfer from Global Forum', 'Donation', 'Other Income',
];

const EXPENSE_CATEGORIES = ['Salary', 'Rent', 'Bills', 'Supplies', 'Other Expense'];

interface ImportRow {
  _id: number;
  _selected: boolean;
  token: string;
  date: string;
  category: string;
  type: 'income' | 'expense';
  amount: string;
  description: string;
  feeMonth: string;
  className: string;
  roll: string;
  studentName: string;
  studentId: string;
  _errors: string[];
}

function parseExcelDate(val: any): string {
  if (!val) return '';
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000);
    return d.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return str;
}

function normalizeType(val: any): 'income' | 'expense' {
  const s = String(val || '').trim().toLowerCase();
  if (s === 'income' || s === 'inc' || s === 'i' || s === '1') return 'income';
  return 'expense';
}

function isStudentCategory(cat: string): boolean {
  return STUDENT_CATEGORIES.includes(cat);
}

function validateRow(row: ImportRow): string[] {
  const errors: string[] = [];
  if (!row.date) errors.push('Date is required');
  if (!row.amount || isNaN(parseFloat(row.amount)) || parseFloat(row.amount) <= 0) errors.push('Amount must be > 0');
  if (!row.category) errors.push('Category is required');
  if (isStudentCategory(row.category)) {
    if (!row.roll) errors.push('Roll required for student fees');
    if (row.roll && !row.studentId) errors.push('Student not found for this Roll');
  }
  return errors;
}

export default function ExcelImportTab() {
  const { fetchTransactions, fetchFinance, students, fetchStudents } = useSchoolStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<ImportRow>>({});
  const [importing, setImporting] = useState(false);
  const [duplicateIds, setDuplicateIds] = useState<Set<number>>(new Set());

  useEffect(() => { fetchStudents(); }, []);

  const rollMapRef = React.useRef<Record<string, any>>({});

  const rollMap = React.useMemo(() => {
    const map: Record<string, any> = {};
    students.forEach((s: any) => {
      const key = `${(s.class || '').trim().toLowerCase()}|${(s.roll || '').trim().toLowerCase()}`;
      map[key] = s;
      // Also index by roll alone (roll is globally unique)
      const rollKey = (s.roll || '').trim().toLowerCase();
      if (rollKey) map[`__roll__${rollKey}`] = s;
    });
    return map;
  }, [students]);

  rollMapRef.current = rollMap;

  const resolveStudent = (className: string, roll: string): { studentId: string; studentName: string; resolvedClass: string } => {
    // Try class+roll first
    const key = `${className.trim().toLowerCase()}|${roll.trim().toLowerCase()}`;
    let s = rollMap[key];
    // Fall back to roll alone (roll is globally unique)
    if (!s && roll.trim()) {
      s = rollMap[`__roll__${roll.trim().toLowerCase()}`];
    }
    if (s) return { studentId: s.id, studentName: s.name, resolvedClass: s.class };
    return { studentId: '', studentName: '', resolvedClass: '' };
  };

  // Re-resolve students when the students array updates (e.g. after fetch completes)
  useEffect(() => {
    if (!rows.length || !students.length) return;
    setRows(prev => prev.map(row => {
      if (!row.roll) return row;
      if (row.studentId) return row; // already resolved
      const { studentId, studentName, resolvedClass } = resolveStudent(row.className, row.roll);
      if (!studentId) return row;
      const updated = { ...row, studentId, studentName, className: resolvedClass || row.className };
      updated._errors = validateRow(updated);
      return updated;
    }));
  }, [students]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Ensure students are loaded
    await fetchStudents();
    // Read latest students from store (students from hook is stale in async callback)
    const latestStudents = useSchoolStore.getState().students;
    const localMap: Record<string, any> = {};
    latestStudents.forEach((s: any) => {
      const key = `${(s.class || '').trim().toLowerCase()}|${(s.roll || '').trim().toLowerCase()}`;
      localMap[key] = s;
      const rollKey = (s.roll || '').trim().toLowerCase();
      if (rollKey) localMap[`__roll__${rollKey}`] = s;
    });
    const resolve = (className: string, roll: string) => {
      const key = `${className.trim().toLowerCase()}|${roll.trim().toLowerCase()}`;
      let s = localMap[key];
      if (!s && roll.trim()) s = localMap[`__roll__${roll.trim().toLowerCase()}`];
      if (s) return { studentId: s.id, studentName: s.name, resolvedClass: s.class };
      return { studentId: '', studentName: '', resolvedClass: '' };
    };

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!data.length) { toast('Excel file is empty', 'error'); return; }

        const parsed: ImportRow[] = data.map((r: any, i) => {
          const className = String(r['Class'] || r['class'] || r['ClassName'] || '').trim();
          const roll = String(r['Roll'] || r['roll'] || r['Roll No'] || r['rollNo'] || r['RollNo'] || r['roll_no'] || '').trim();
          const category = String(r['Category'] || r['category'] || r['Cat'] || '').trim();
          const { studentId, studentName, resolvedClass } = roll ? resolve(className, roll) : { studentId: '', studentName: '', resolvedClass: '' };
          const finalClass = resolvedClass || className;

          const row: ImportRow = {
            _id: i,
            _selected: true,
            token: String(r['Token'] || r['token'] || r['Ref'] || r['ref'] || '').trim(),
            date: parseExcelDate(r['Date'] || r['date']),
            category,
            type: normalizeType(r['Income/Expense'] || r['Type'] || r['type'] || 'expense'),
            amount: String(r['Amount'] || r['amount'] || '0').trim(),
            description: String(r['Description'] || r['description'] || r['desc'] || '').trim(),
            feeMonth: String(r['Fee Month'] || r['feeMonth'] || r['fee_month'] || r['Month'] || '').trim(),
            className: finalClass,
            roll,
            studentName,
            studentId,
            _errors: [],
          };
          row._errors = validateRow(row);
          return row;
        });

        setRows(parsed);
        const studentRows = parsed.filter(r => isStudentCategory(r.category));
        const resolved = studentRows.filter(r => r.studentId).length;
        const cols = data.length ? Object.keys(data[0] as object).join(', ') : '';
        toast(`Loaded ${parsed.length} rows. ${resolved}/${studentRows.length} students found. Columns: ${cols}`, 'success');
      } catch {
        toast('Failed to parse Excel file', 'error');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const toggleRow = (id: number) => {
    setRows(prev => prev.map(r => r._id === id ? { ...r, _selected: !r._selected } : r));
  };

  const toggleAll = () => {
    const allSelected = rows.every(r => r._selected);
    setRows(prev => prev.map(r => ({ ...r, _selected: !allSelected })));
  };

  const deleteRow = (id: number) => {
    setRows(prev => prev.filter(r => r._id !== id));
  };

  const startEdit = (row: ImportRow) => {
    setEditingId(row._id);
    setEditData({ token: row.token, date: row.date, category: row.category, type: row.type, amount: row.amount, description: row.description, feeMonth: row.feeMonth, className: row.className, roll: row.roll });
  };

  const saveEdit = (id: number) => {
    setRows(prev => prev.map(r => {
      if (r._id !== id) return r;
      const updated = { ...r, ...editData, _errors: [] as string[] };
      // Re-resolve student if class/roll changed
      if (editData.className !== undefined || editData.roll !== undefined) {
        const cn = editData.className ?? r.className;
        const rl = editData.roll ?? r.roll;
        const resolved = resolveStudent(cn, rl);
        updated.studentId = resolved.studentId;
        updated.studentName = resolved.studentName;
        updated.className = resolved.resolvedClass || cn;
        updated.roll = rl;
      }
      updated._errors = validateRow(updated);
      return updated;
    }));
    setEditingId(null);
    setEditData({});
  };

  const cancelEdit = () => { setEditingId(null); setEditData({}); };

  const handleImport = async () => {
    const selected = rows.filter(r => r._selected && r._errors.length === 0);
    if (!selected.length) { toast('No valid rows selected', 'error'); return; }

    setImporting(true);
    let success = 0, failed = 0, duplicates = 0;

    for (const row of selected) {
      try {
        const sourceAccount = row.type === 'income' ? undefined : 'AL_RAWA_BANK';
        const destinationAccount = row.type === 'income' ? 'CASH_IN_HAND' : undefined;

        const res = await fetch(`${API_URL}/finance/transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            date: row.date,
            amount: parseFloat(row.amount),
            sourceAccount,
            destinationAccount,
            category: row.category,
            description: row.description || undefined,
            referenceId: row.token || undefined,
            feeMonth: row.feeMonth || undefined,
            studentId: row.studentId || undefined,
            className: row.className || undefined,
          }),
        });
        if (res.ok) {
          success++;
        } else if (res.status === 409) {
          duplicates++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    setImporting(false);
    fetchTransactions();
    fetchFinance();
    const parts = [`${success} succeeded`];
    if (duplicates) parts.push(`${duplicates} duplicates skipped`);
    if (failed) parts.push(`${failed} failed`);
    toast(parts.join(', '), success > 0 ? 'success' : 'error');
    if (failed === 0 && duplicates === 0) setRows([]);
  };

  const selectedCount = rows.filter(r => r._selected).length;
  const validCount = rows.filter(r => r._selected && r._errors.length === 0).length;

  return (
    <div className="space-y-4">
      {/* Upload */}
      <div className="bg-white rounded-2xl border border-school-border p-6">
        <h4 className="font-serif text-lg text-school-primary mb-3">📥 Import Transactions from Excel</h4>
        <p className="text-sm text-school-muted mb-2">
          Required columns: <strong>Date, Category, Income/Expense, Amount, Class, Roll</strong>
        </p>
        <p className="text-sm text-school-muted mb-4">
          Optional: <strong>Token, Fee Month, Description</strong>. Class & Roll are required for student fee categories (Tuition, Admission, etc.).
        </p>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
        <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-school-primary text-white rounded-xl text-sm font-bold hover:opacity-90">
          <Upload size={16} /> Choose Excel File
        </button>
      </div>

      {/* Preview */}
      {rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-school-border overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between p-4 border-b border-school-border">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={rows.length > 0 && rows.every(r => r._selected)} onChange={toggleAll} className="rounded" />
                Select All ({rows.length})
              </label>
              <span className="text-sm text-school-muted">
                {selectedCount} selected · {validCount} valid
              </span>
            </div>
            <button
              onClick={handleImport}
              disabled={importing || validCount === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50"
            >
              {importing ? '⏳ Importing...' : `📥 Import ${validCount} Rows`}
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-school-primary text-white sticky top-0">
                <tr className="text-xs uppercase">
                  <th className="px-3 py-2 w-10"></th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-center">Type</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Roll</th>
                  <th className="px-3 py-2 text-left">Class</th>
                  <th className="px-3 py-2 text-left">Student</th>
                  <th className="px-3 py-2 text-left">Fee Month</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isEditing = editingId === row._id;
                  const hasError = row._errors.length > 0;
                  const needsStudent = isStudentCategory(row.category);
                  return (
                    <tr key={row._id} className={`border-t border-school-border/50 ${!row._selected ? 'bg-gray-50 opacity-50' : hasError ? 'bg-red-50' : row._id % 2 ? 'bg-school-paper/30' : ''}`}>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={row._selected} onChange={() => toggleRow(row._id)} className="rounded" />
                      </td>

                      {isEditing ? (
                        <>
                          <td className="px-2 py-1"><input type="date" value={editData.date || ''} onChange={e => setEditData({ ...editData, date: e.target.value })} className="w-full px-2 py-1 border border-school-border rounded text-xs" /></td>
                          <td className="px-2 py-1">
                            <select value={editData.category || ''} onChange={e => setEditData({ ...editData, category: e.target.value })} className="w-full px-2 py-1 border border-school-border rounded text-xs">
                              <option value="">—</option>
                              <optgroup label="Income">{INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                              <optgroup label="Expense">{EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
                            </select>
                          </td>
                          <td className="px-2 py-1 text-center">
                            <select value={editData.type || 'expense'} onChange={e => setEditData({ ...editData, type: e.target.value as any })} className="px-2 py-1 border border-school-border rounded text-xs">
                              <option value="income">Income</option>
                              <option value="expense">Expense</option>
                            </select>
                          </td>
                          <td className="px-2 py-1"><input type="number" value={editData.amount || ''} onChange={e => setEditData({ ...editData, amount: e.target.value })} className="w-20 px-2 py-1 border border-school-border rounded text-xs text-right" /></td>
                          <td className="px-2 py-1"><input value={editData.className || ''} onChange={e => setEditData({ ...editData, className: e.target.value })} className="w-20 px-2 py-1 border border-school-border rounded text-xs" /></td>
                          <td className="px-2 py-1"><input value={editData.roll || ''} onChange={e => setEditData({ ...editData, roll: e.target.value })} className="w-16 px-2 py-1 border border-school-border rounded text-xs" /></td>
                          <td className="px-2 py-1"><input type="month" value={editData.feeMonth || ''} onChange={e => setEditData({ ...editData, feeMonth: e.target.value })} className="w-full px-2 py-1 border border-school-border rounded text-xs" /></td>
                          <td className="px-2 py-1 text-center">
                            <button onClick={() => saveEdit(row._id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
                            <button onClick={cancelEdit} className="p-1 text-red-500 hover:bg-red-50 rounded"><X size={14} /></button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-3 py-2 text-xs">{row.date || <span className="text-red-500">missing</span>}</td>
                          <td className="px-3 py-2 text-xs">{row.category || <span className="text-red-500">missing</span>}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${row.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {row.type === 'income' ? 'INCOME' : 'EXPENSE'}
                            </span>
                          </td>
                          <td className={`px-3 py-2 text-right font-medium text-xs ${row.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                            {row.amount ? `৳${parseFloat(row.amount).toLocaleString()}` : <span className="text-red-500">0</span>}
                          </td>
                          <td className="px-3 py-2 text-xs">{row.roll || '—'}</td>
                          <td className="px-3 py-2 text-xs">{row.type === 'income' ? (row.className || '—') : '—'}</td>
                          <td className="px-3 py-2 text-xs font-medium">{row.type === 'income' ? (row.studentName || (needsStudent && row.roll ? <span className="text-red-500">not found</span> : '—')) : '—'}</td>
                          <td className="px-3 py-2 text-xs text-school-muted">{row.feeMonth || '—'}</td>
                          <td className="px-3 py-2 text-center">
                            <button onClick={() => startEdit(row)} className="p-1 text-blue-500 hover:bg-blue-50 rounded"><Edit2 size={14} /></button>
                            <button onClick={() => deleteRow(row._id)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14} /></button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Errors */}
          {rows.some(r => r._errors.length > 0) && (
            <div className="p-4 bg-red-50 border-t border-red-200">
              <p className="text-sm font-bold text-red-700 mb-1">Rows with errors (will be skipped during import):</p>
              <ul className="text-xs text-red-600 space-y-0.5">
                {rows.filter(r => r._errors.length > 0).slice(0, 10).map(r => (
                  <li key={r._id}>Row {r._id + 1}: {r._errors.join(', ')}</li>
                ))}
                {rows.filter(r => r._errors.length > 0).length > 10 && <li>...and {rows.filter(r => r._errors.length > 0).length - 10} more</li>}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
