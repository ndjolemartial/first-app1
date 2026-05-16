import { clsx } from 'clsx';

interface SkeletonProps {
  className?: string;
  rows?: number;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded bg-slate-200', className)} />;
}

export function SkeletonTable({ rows = 5 }: SkeletonProps) {
  return (
    <div className="space-y-3">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
