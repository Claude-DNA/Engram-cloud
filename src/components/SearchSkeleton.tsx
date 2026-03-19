export default function SearchSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 px-4 pb-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-surface border border-border rounded-lg p-4 space-y-3 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="w-16 h-4 bg-border/40 rounded-full" />
            <div className="w-12 h-3 bg-border/30 rounded" />
          </div>
          <div className="w-3/4 h-4 bg-border/40 rounded" />
          <div className="space-y-1.5">
            <div className="w-full h-3 bg-border/30 rounded" />
            <div className="w-2/3 h-3 bg-border/30 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
