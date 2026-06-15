export default function StoreLoading() {
  return (
    <div className="animate-pulse">
      <div className="bg-card border border-border rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-2xl bg-secondary shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-6 bg-secondary rounded w-36" />
            <div className="h-3 bg-secondary rounded w-56" />
          </div>
        </div>
      </div>
      <div className="h-6 bg-secondary rounded w-32 mb-3" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="aspect-[4/3] bg-secondary" />
            <div className="p-3 space-y-2">
              <div className="h-3 bg-secondary rounded w-5/6" />
              <div className="h-3 bg-secondary rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
