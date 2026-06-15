export default function NotificationsLoading() {
  return (
    <div className="max-w-2xl mx-auto animate-pulse space-y-2">
      <div className="h-8 bg-secondary rounded w-40 mb-4" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-3 flex gap-3">
          <div className="size-8 rounded-full bg-secondary shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-secondary rounded w-3/4" />
            <div className="h-2.5 bg-secondary rounded w-1/2" />
          </div>
          <div className="h-2.5 bg-secondary rounded w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}
