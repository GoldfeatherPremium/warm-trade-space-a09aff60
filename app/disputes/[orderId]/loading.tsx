export default function DisputeDetailLoading() {
  return (
    <div className="max-w-3xl mx-auto animate-pulse space-y-4">
      <div className="h-8 bg-secondary rounded w-48" />
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="h-4 bg-secondary rounded w-1/3" />
        <div className="h-3 bg-secondary rounded w-2/3" />
        <div className="h-3 bg-secondary rounded w-1/2" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-3 flex gap-3">
            <div className="size-8 rounded-full bg-secondary shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-secondary rounded w-24" />
              <div className="h-3 bg-secondary rounded w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
