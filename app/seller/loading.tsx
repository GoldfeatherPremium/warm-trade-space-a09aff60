export default function SellerLoading() {
  return (
    <div className="max-w-5xl mx-auto animate-pulse space-y-6">
      <div className="h-8 bg-secondary rounded w-48" />
      <div className="grid sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-secondary rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-secondary rounded-xl" />
    </div>
  );
}
