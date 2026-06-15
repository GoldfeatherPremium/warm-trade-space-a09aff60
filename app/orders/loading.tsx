export default function OrdersLoading() {
  return (
    <div className="max-w-6xl mx-auto animate-pulse space-y-3">
      <div className="h-8 bg-secondary rounded w-32 mb-4" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="bg-card border border-border rounded-xl p-4 flex items-center gap-4"
        >
          <div className="size-12 rounded-lg bg-secondary shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-secondary rounded w-48" />
            <div className="h-3 bg-secondary rounded w-32" />
          </div>
          <div className="text-right space-y-2">
            <div className="h-3.5 bg-secondary rounded w-20" />
            <div className="h-3 bg-secondary rounded w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
