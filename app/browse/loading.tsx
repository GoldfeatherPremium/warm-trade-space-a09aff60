export default function BrowseLoading() {
  return (
    <div className="max-w-6xl mx-auto animate-pulse">
      <div className="h-10 bg-secondary rounded mb-6 max-w-lg" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 12 }).map((_, i) => (
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
