export default function SellersLoading() {
  return (
    <div className="max-w-6xl mx-auto animate-pulse">
      <div className="h-10 bg-secondary rounded mb-2 max-w-xs" />
      <div className="h-4 bg-secondary rounded mb-6 max-w-lg" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 bg-card border border-border rounded-xl p-3"
          >
            <div className="w-8 h-6 bg-secondary rounded" />
            <div className="size-11 rounded-xl bg-secondary" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-secondary rounded w-32" />
              <div className="h-2.5 bg-secondary rounded w-48" />
            </div>
            <div className="w-16 space-y-2">
              <div className="h-3 bg-secondary rounded" />
              <div className="h-2.5 bg-secondary rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
