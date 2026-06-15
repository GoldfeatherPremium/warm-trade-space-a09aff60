export default function OrderLoading() {
  return (
    <div className="max-w-5xl mx-auto animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="size-12 rounded-md bg-secondary shrink-0" />
        <div className="space-y-1.5 flex-1">
          <div className="h-5 bg-secondary rounded w-48" />
          <div className="h-3 bg-secondary rounded w-28" />
        </div>
      </div>
      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-secondary rounded-lg" />
          ))}
        </div>
        <div className="space-y-4">
          <div className="h-28 bg-secondary rounded-lg" />
          <div className="h-48 bg-secondary rounded-lg" />
        </div>
      </div>
    </div>
  );
}
