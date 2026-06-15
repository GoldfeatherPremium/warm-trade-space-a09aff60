export default function CreditsLoading() {
  return (
    <div className="max-w-2xl mx-auto animate-pulse space-y-4">
      <div className="h-8 bg-secondary rounded w-36" />
      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
        <div className="h-4 bg-secondary rounded w-32" />
        <div className="h-10 bg-secondary rounded w-40" />
      </div>
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="h-4 bg-secondary rounded w-28" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex justify-between items-center">
            <div className="space-y-1">
              <div className="h-3 bg-secondary rounded w-32" />
              <div className="h-2.5 bg-secondary rounded w-20" />
            </div>
            <div className="h-3 bg-secondary rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
