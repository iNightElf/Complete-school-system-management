import React from 'react';

export interface Column<T> {
  key: string;
  label: string;
  render: (item: T) => React.ReactNode;
  hideOnMobile?: boolean;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  className?: string;
}

export default function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading,
  error,
  emptyMessage = 'No data',
  className = '',
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className={`space-y-2 ${className}`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 bg-school-paper/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className={`text-center py-8 text-school-muted text-sm ${className}`}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-left mobile-card-table">
        <thead>
          <tr className="border-b border-school-border text-xs uppercase tracking-wider text-school-muted">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 font-semibold whitespace-nowrap ${col.hideOnMobile ? 'hidden sm:table-cell' : ''} ${col.headerClassName || ''}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              className="border-b border-school-border/50 hover:bg-school-paper/50 transition-colors"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  data-label={col.label}
                  className={`px-4 py-3 whitespace-nowrap text-sm ${col.hideOnMobile ? 'hidden sm:table-cell' : ''} ${col.className || ''}`}
                >
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
