import { useState, useRef, useEffect } from 'react';
import { Download, FileText, FileSpreadsheet, Printer } from 'lucide-react';

interface ExportMenuProps {
  onCSV?: () => void;
  onExcel?: () => void;
  onPDF?: () => void;
  onPrint?: () => void;
}

export default function ExportMenu({ onCSV, onExcel, onPDF, onPrint }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const items = [
    { label: 'CSV', icon: FileText, action: onCSV },
    { label: 'Excel', icon: FileSpreadsheet, action: onExcel },
    { label: 'PDF', icon: FileText, action: onPDF },
    { label: 'Print', icon: Printer, action: onPrint },
  ].filter((i) => i.action);

  if (!items.length) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-lg bg-school-accent text-white hover:bg-school-accent/90 transition-colors"
        aria-label="Export menu"
        aria-expanded={open}
      >
        <Download size={14} />
        <span className="hidden sm:inline">Export</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1.5 w-40 bg-white dark:bg-school-primary border border-school-border rounded-xl shadow-lg z-50 overflow-hidden">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => { item.action?.(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-school-paper dark:hover:bg-school-secondary transition-colors text-left"
              aria-label={`Export as ${item.label}`}
            >
              <item.icon size={15} className="text-school-muted shrink-0" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
