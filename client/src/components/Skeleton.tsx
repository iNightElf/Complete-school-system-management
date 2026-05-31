

interface SkeletonProps {
  className?: string;
  count?: number;
}

export function Skeleton({ className = '', count = 1 }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`animate-pulse bg-gray-200 rounded ${className}`} />
      ))}
    </>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white p-4 rounded-2xl border border-school-border animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-3 bg-gray-200 rounded w-1/3" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
      </div>
      <div className="flex gap-2 mt-3 pt-3 border-t border-school-border">
        <div className="flex-1 h-8 bg-gray-200 rounded-lg" />
        <div className="flex-1 h-8 bg-gray-200 rounded-lg" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-4 bg-gray-200 rounded animate-pulse flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function BalanceCardSkeleton() {
  return (
    <div className="rounded-2xl bg-gray-200 p-5 shadow-md animate-pulse">
      <div className="h-3 bg-gray-300 rounded w-1/3 mb-2" />
      <div className="h-8 bg-gray-300 rounded w-1/2" />
    </div>
  );
}
