export default function SellLoading() {
  return (
    <div className="max-w-2xl mx-auto animate-pulse space-y-6">
      <div className="h-8 bg-secondary rounded w-48" />
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="h-5 bg-secondary rounded w-8" />
            <div className="h-4 bg-secondary rounded w-32" />
            <div className="h-3 bg-secondary rounded w-full" />
            <div className="h-3 bg-secondary rounded w-4/5" />
          </div>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="h-5 bg-secondary rounded w-40" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 bg-secondary rounded" />
        ))}
        <div className="h-10 bg-primary/20 rounded" />
      </div>
    </div>
  );
}
