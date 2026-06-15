export default function DisputesLoading() {
  return (
    <div className="max-w-3xl mx-auto animate-pulse space-y-3">
      <div className="h-8 bg-secondary rounded w-32 mb-4" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
          <div className="flex justify-between">
            <div className="h-4 bg-secondary rounded w-40" />
            <div className="h-4 bg-secondary rounded w-20" />
          </div>
          <div className="h-3 bg-secondary rounded w-56" />
          <div className="h-3 bg-secondary rounded w-32" />
        </div>
      ))}
    </div>
  );
}
