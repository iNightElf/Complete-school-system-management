import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Download, AlertTriangle } from 'lucide-react';
import { toast } from './Toast';
import { API_URL } from '../lib/config';

interface ImportResult {
  created: number;
  errors: { row: number; error: string }[];
}

interface EntityConfig {
  label: string;
  endpoint: string;
  template: string;
  headers: string;
}

const ENTITIES: Record<string, EntityConfig> = {
  student: {
    label: 'Students',
    endpoint: '/api/students/import',
    template: `name,class,roll,fatherName,motherName,contact\nJohn Doe,Play,01,John Sr.,Jane Doe,01700000000\nJane Smith,Nursery,02,,,`,
    headers: 'name, class, roll, fatherName, motherName, contact',
  },
  teacher: {
    label: 'Teachers',
    endpoint: '/api/teachers/import',
    template: `name,designation,email,contact\nJohn Doe,Head Teacher,john@school.com,01700000000\nJane Smith,Assistant Teacher,jane@school.com,`,
    headers: 'name, designation, email, contact',
  },
  staff: {
    label: 'Staff',
    endpoint: '/api/staff/import',
    template: `name,role,email,contact\nJohn Doe,Guard,john@school.com,01700000000\nJane Smith,Peon,jane@school.com,`,
    headers: 'name, role, email, contact',
  },
};

const BODY_KEY: Record<string, string> = {
  student: 'students',
  teacher: 'teachers',
  staff: 'staff',
};

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  entity?: keyof typeof ENTITIES;
}

export default function ImportModal({ open, onClose, onImported, entity = 'student' }: Props) {
  const [mode, setMode] = useState<'paste' | 'file'>('paste');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cfg = ENTITIES[entity];

  if (!open) return null;

  const parseCSV = (csv: string) => {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const vals = line.split(',').map((v) => v.trim());
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => { if (vals[i]) obj[h] = vals[i]; });
      return obj;
    });
  };

  const handleImport = async () => {
    if (!text.trim()) return toast(`Paste ${cfg.label} data or upload a CSV file`, 'error');
    const items = parseCSV(text);
    if (items.length === 0) return toast('No valid rows found', 'error');
    if (items.length > 500) return toast('Maximum 500 per import', 'error');

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`${API_URL}${cfg.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [BODY_KEY[entity]]: items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setResult(data);
      if (data.created > 0) {
        toast(`${data.created} ${cfg.label.toLowerCase()} imported ✓`, 'success');
        onImported();
      }
    } catch (e: any) {
      toast(e.message || 'Import failed', 'error');
    }
    setLoading(false);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setText(content);
      toast('File loaded — click Import to proceed', 'info');
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-school-primary rounded-2xl border border-school-border p-5 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-sm text-school-primary dark:text-white flex items-center gap-2">
            <Upload size={16} /> Import {cfg.label}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-school-paper dark:hover:bg-school-secondary rounded-full">
            <X size={18} />
          </button>
        </div>

        {result ? (
          <div className="space-y-3">
            <div className={`p-3 rounded-xl text-sm ${result.created > 0 ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-300' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
              <strong>{result.created}</strong> {cfg.label.toLowerCase()} imported successfully.
              {result.errors.length > 0 && (
                <span className="block mt-1"><strong>{result.errors.length}</strong> row(s) had errors.</span>
              )}
            </div>
            {result.errors.length > 0 && (
              <div className="text-xs text-school-muted max-h-32 overflow-y-auto space-y-1">
                {result.errors.map((e, i) => (
                  <div key={i} className="flex gap-2"><span className="font-bold shrink-0">Row {e.row}:</span><span>{e.error}</span></div>
                ))}
              </div>
            )}
            <button onClick={() => { setResult(null); setText(''); onClose(); }} className="w-full py-2 border border-school-border rounded-xl text-sm hover:bg-school-paper dark:hover:bg-school-secondary">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <button onClick={() => setMode('paste')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === 'paste' ? 'bg-school-accent text-white' : 'border border-school-border hover:bg-school-paper dark:hover:bg-school-secondary'}`}>
                <FileText size={14} className="inline mr-1" /> Paste
              </button>
              <button onClick={() => setMode('file')} className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === 'file' ? 'bg-school-accent text-white' : 'border border-school-border hover:bg-school-paper dark:hover:bg-school-secondary'}`}>
                <Upload size={14} className="inline mr-1" /> Upload CSV
              </button>
            </div>

            {mode === 'paste' ? (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste CSV data here..."
                className="w-full h-32 px-3 py-2 border border-school-border rounded-xl text-xs font-mono focus:outline-none focus:border-school-accent resize-none"
              />
            ) : (
              <div className="border-2 border-dashed border-school-border rounded-xl p-6 text-center">
                <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
                <button onClick={() => fileRef.current?.click()} className="text-school-accent text-sm font-medium hover:underline">
                  Choose CSV file
                </button>
                <p className="text-xs text-school-muted mt-1">.csv files only</p>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-school-muted">
              <AlertTriangle size={12} />
              <span>First row must be column headers: <code className="bg-school-paper dark:bg-school-secondary px-1 rounded">{cfg.headers}</code></span>
            </div>

            <button onClick={() => { const blob = new Blob([cfg.template], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${entity}_import_template.csv`; a.click(); URL.revokeObjectURL(url); }} className="text-xs text-school-accent hover:underline flex items-center gap-1">
              <Download size={12} /> Download template
            </button>

            <div className="flex gap-2">
              <button onClick={handleImport} disabled={loading || !text.trim()} className="flex-1 py-2 bg-school-accent text-white rounded-xl text-sm font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5">
                {loading ? 'Importing...' : <> <Upload size={14} /> Import {text.trim() ? parseCSV(text).length : 0} {cfg.label.toLowerCase()}</>}
              </button>
              <button onClick={onClose} className="px-4 py-2 border border-school-border rounded-xl text-sm hover:bg-school-paper dark:hover:bg-school-secondary">Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}