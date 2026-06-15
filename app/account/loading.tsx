export default function AccountLoading() {
  return (
    <div className="max-w-2xl mx-auto animate-pulse space-y-4">
      <div className="h-8 bg-secondary rounded w-32" />
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-xl bg-secondary" />
          <div className="space-y-2">
            <div className="h-4 bg-secondary rounded w-32" />
            <div className="h-3 bg-secondary rounded w-48" />
          </div>
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 bg-secondary rounded" />
        ))}
      </div>
    </div>
  );
}
