import { forwardRef } from 'react';
import SchoolDocumentLayout from './SchoolDocumentLayout';

interface FeeItem {
  category: string;
  amount: number;
}

interface Props {
  className: string;
  academicFees: FeeItem[];
  hifzFees: FeeItem[];
  settings: { school_name?: string; address?: string; phone?: string };
}

function fmt(n: number) { return n.toLocaleString('en-BD'); }

const FeeStructureDocument = forwardRef<HTMLDivElement, Props>(({ className, academicFees, hifzFees, settings }, ref) => {
  const acadTotal = academicFees.reduce((s, f) => s + f.amount, 0);
  const hifzTotal = hifzFees.reduce((s, f) => s + f.amount, 0);

  return (
    <SchoolDocumentLayout ref={ref} title="Official Fee Structure" subtitle={`Class: ${className}`} settings={settings}>
      <div className="fee-section">
        <h3>Academic Section</h3>
        {academicFees.map(f => (
          <div key={f.category} className="fee-row">
            <span>{f.category}</span>
            <span className="fee-amount">৳ {fmt(f.amount)}</span>
          </div>
        ))}
        <div className="fee-row total">
          <span>Total Academic</span>
          <span className="fee-amount">৳ {fmt(acadTotal)}</span>
        </div>
      </div>

      {hifzFees.length > 0 && (
        <div className="fee-section">
          <h3>Hifz Section</h3>
          {hifzFees.map(f => (
            <div key={f.category} className="fee-row">
              <span>{f.category}</span>
              <span className="fee-amount">৳ {fmt(f.amount)}</span>
            </div>
          ))}
          <div className="fee-row total">
            <span>Total Hifz</span>
            <span className="fee-amount">৳ {fmt(hifzTotal)}</span>
          </div>
        </div>
      )}
    </SchoolDocumentLayout>
  );
});

FeeStructureDocument.displayName = 'FeeStructureDocument';
export default FeeStructureDocument;
