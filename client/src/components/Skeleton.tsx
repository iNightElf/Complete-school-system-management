import React from 'react';

interface SkeletonProps {
  className?: string;
  rows?: number;
  type?: 'table' | 'card' | 'text';
}

const Skeleton: React.FC<SkeletonProps> = ({ className = '', rows = 3, type = 'text' }) => {
  if (type === 'table') {
    return (
      <div className={`bg-white rounded-xl border border-school-border overflow-hidden ${className}`}>
        <div className="bg-gray-50 border-b border-school-border px-4 py-3">
          <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0">
            <div className="w-9 h-9 bg-gray-100 rounded-full animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-100 rounded w-1/2 animate-pulse" />
              <div className="h-3 bg-gray-50 rounded w-1/4 animate-pulse" />
            </div>
            <div className="h-6 bg-gray-100 rounded w-20 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'card') {
    return (
      <div className={`grid grid-cols-2 gap-3 ${className}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-school-border p-5">
            <div className="w-12 h-12 bg-gray-100 rounded-2xl animate-pulse mb-3" />
            <div className="h-4 bg-gray-100 rounded w-2/3 animate-pulse mb-2" />
            <div className="h-3 bg-gray-50 rounded w-1/2 animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`h-3 bg-gray-100 rounded animate-pulse ${i === rows - 1 ? 'w-1/2' : 'w-full'}`} />
      ))}
    </div>
  );
};

export default Skeleton;

export const CardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`bg-white rounded-xl border border-school-border p-5 ${className}`}>
    <div className="w-12 h-12 bg-gray-100 rounded-2xl animate-pulse mb-3" />
    <div className="h-4 bg-gray-100 rounded w-2/3 animate-pulse mb-2" />
    <div className="h-3 bg-gray-50 rounded w-1/2 animate-pulse" />
  </div>
);
