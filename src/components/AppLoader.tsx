export default function AppLoader() {
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Titlebar skeleton */}
      <div className="h-10 w-full bg-surface border-b border-border flex items-center px-3">
        <div className="w-[70px]" />
        <div className="w-24 h-3 bg-border/50 rounded animate-pulse" />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar skeleton */}
        <div className="w-56 bg-surface border-r border-border p-3 space-y-4">
          <div className="w-full h-8 bg-border/30 rounded animate-pulse" />
          <div className="space-y-2 pt-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2 px-1">
                <div className="w-5 h-5 bg-border/30 rounded animate-pulse" />
                <div className="w-20 h-3 bg-border/30 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Main content skeleton */}
        <div className="flex-1 p-6">
          <div className="text-center pt-20">
            <div className="w-48 h-6 bg-border/30 rounded mx-auto animate-pulse mb-3" />
            <div className="w-32 h-3 bg-border/20 rounded mx-auto animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}
