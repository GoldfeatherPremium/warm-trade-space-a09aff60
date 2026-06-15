export default function WalletLoading() {
  return (
    <div className="max-w-6xl mx-auto animate-pulse space-y-4">
      <div className="h-8 bg-secondary rounded w-40" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="h-3 bg-secondary rounded w-24" />
            <div className="h-8 bg-secondary rounded w-32" />
          </div>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="h-4 bg-secondary rounded w-32" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex justify-between">
            <div className="h-3 bg-secondary rounded w-48" />
            <div className="h-3 bg-secondary rounded w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}
