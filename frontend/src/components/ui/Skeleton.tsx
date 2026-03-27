interface SkeletonProps { className?: string; lines?: number; }

export function Skeleton({ className = '', lines = 3 }: SkeletonProps) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`h-3 bg-slate-100 rounded-full ${i === 0 ? 'w-3/4' : i % 2 === 0 ? 'w-1/2' : 'w-full'} ${className}`} />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-[16px] p-6 entity-card-shadow border-l-4 border-slate-100 animate-pulse">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-6 h-6 rounded-md bg-slate-100" />
        <div className="h-4 w-28 bg-slate-100 rounded-full" />
      </div>
      <Skeleton lines={4} />
    </div>
  );
}
