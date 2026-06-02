import { forwardRef } from 'react';
import SchoolDocumentLayout from './SchoolDocumentLayout';

interface BookItem {
  name: string;
  sell: number;
}

interface Props {
  className: string;
  books: BookItem[];
  settings: { school_name?: string; address?: string; phone?: string };
}

function fmt(n: number) { return n.toLocaleString('en-BD'); }

const BookListDocument = forwardRef<HTMLDivElement, Props>(({ className, books, settings }, ref) => {
  const total = books.reduce((s, b) => s + b.sell, 0);

  return (
    <SchoolDocumentLayout ref={ref} title="Book List" subtitle={`Class: ${className}`} settings={settings}>
      <table className="book-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>Book Name</th>
            <th style={{ width: 100, textAlign: 'right' }}>Price (৳)</th>
          </tr>
        </thead>
        <tbody>
          {books.map((b, i) => (
            <tr key={i}>
              <td style={{ color: '#9ca3af' }}>{i + 1}</td>
              <td>{b.name}</td>
              <td style={{ textAlign: 'right', fontFamily: "'Courier New', monospace", fontWeight: 600 }}>৳ {fmt(b.sell)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="total-row">
            <td colSpan={2}>Total</td>
            <td style={{ textAlign: 'right', fontFamily: "'Courier New', monospace" }}>৳ {fmt(total)}</td>
          </tr>
        </tfoot>
      </table>
    </SchoolDocumentLayout>
  );
});

BookListDocument.displayName = 'BookListDocument';
export default BookListDocument;
