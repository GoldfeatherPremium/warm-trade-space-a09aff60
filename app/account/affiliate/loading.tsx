export default function AffiliateLoading() {
  return (
    <div className="max-w-2xl mx-auto animate-pulse space-y-4">
      <div className="h-8 bg-secondary rounded w-32" />
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="h-4 bg-secondary rounded w-48" />
        <div className="h-10 bg-secondary rounded" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-secondary rounded-lg p-3 space-y-2">
              <div className="h-6 bg-secondary/60 rounded w-16" />
              <div className="h-3 bg-secondary/60 rounded w-20" />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="h-4 bg-secondary rounded w-24" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between">
            <div className="h-3 bg-secondary rounded w-40" />
            <div className="h-3 bg-secondary rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
