export default function FollowingLoading() {
  return (
    <div className="max-w-2xl mx-auto animate-pulse space-y-3">
      <div className="h-8 bg-secondary rounded w-32 mb-4" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 bg-card border border-border rounded-xl p-3"
        >
          <div className="size-10 rounded-xl bg-secondary shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-secondary rounded w-28" />
            <div className="h-3 bg-secondary rounded w-40" />
          </div>
          <div className="h-8 bg-secondary rounded w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}
