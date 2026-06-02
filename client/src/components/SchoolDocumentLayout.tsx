import { forwardRef, type ReactNode } from 'react';
import { SCHOOL_LOGO } from '../lib/logo';

interface Props {
  title: string;
  subtitle: string;
  children: ReactNode;
  settings: { school_name?: string; address?: string; phone?: string };
}

const SchoolDocumentLayout = forwardRef<HTMLDivElement, Props>(({ title, subtitle, children, settings }, ref) => {
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div ref={ref} className="school-document" style={{ background: '#fff', color: '#111827', fontFamily: 'system-ui, sans-serif', padding: 0, maxWidth: '210mm', margin: '0 auto' }}>
      <style>{`
        @media print {
          body { margin: 0; padding: 0; background: #fff; }
          .no-print { display: none !important; }
          .school-document { page-break-after: avoid; }
        }
        .doc-header { display: flex; align-items: center; gap: 14px; padding: 24px 28px 16px; border-bottom: 2px solid #1a1a2e; }
        .doc-header img { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; }
        .doc-header h1 { font-size: 20px; font-weight: 700; margin: 0; color: #1a1a2e; }
        .doc-header p { font-size: 11px; margin: 2px 0 0; color: #6b7280; }
        .doc-body { padding: 20px 28px; }
        .doc-title { font-size: 16px; font-weight: 700; margin: 0 0 4px; color: #111827; }
        .doc-subtitle { font-size: 13px; color: #6b7280; margin: 0 0 16px; }
        .doc-footer { border-top: 1px solid #d1d5db; padding: 10px 28px; font-size: 10px; color: #9ca3af; display: flex; justify-content: space-between; }
        .fee-section { margin-bottom: 20px; }
        .fee-section h3 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #1a1a2e; border-bottom: 1px solid #d1d5db; padding-bottom: 6px; margin: 0 0 10px; }
        .fee-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; border-bottom: 1px dotted #e5e7eb; }
        .fee-row.total { font-weight: 700; border-bottom: 2px solid #111827; padding-top: 6px; margin-top: 4px; font-size: 13px; }
        .fee-amount { font-family: 'Courier New', monospace; }
        .book-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .book-table th { background: #1a1a2e; color: #fff; padding: 6px 10px; text-align: left; font-size: 10px; text-transform: uppercase; }
        .book-table td { padding: 5px 10px; border-bottom: 1px solid #e5e7eb; }
        .book-table .total-row { font-weight: 700; background: #f3f4f6; border-top: 2px solid #111827; }
      `}</style>

      <div className="doc-header">
        <img src={SCHOOL_LOGO} alt="Logo" />
        <div>
          <h1>{settings.school_name || 'AL RAWA English School'}</h1>
          {settings.address && <p>{settings.address}</p>}
          {settings.phone && <p>Phone: {settings.phone}</p>}
        </div>
      </div>

      <div className="doc-body">
        <h2 className="doc-title">{title}</h2>
        <p className="doc-subtitle">{subtitle}</p>
        {children}
      </div>

      <div className="doc-footer">
        <span>Generated: {today}</span>
        <span>Official School Document</span>
      </div>
    </div>
  );
});

SchoolDocumentLayout.displayName = 'SchoolDocumentLayout';
export default SchoolDocumentLayout;
