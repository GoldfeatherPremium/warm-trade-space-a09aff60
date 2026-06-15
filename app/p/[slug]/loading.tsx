export default function ProductLoading() {
  return (
    <div className="max-w-5xl mx-auto animate-pulse">
      <div className="h-3 bg-secondary rounded w-48 mb-4" />
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
        <div className="space-y-5">
          <div className="aspect-[16/10] rounded-2xl bg-secondary" />
          <div className="space-y-2">
            <div className="h-4 bg-secondary rounded w-full" />
            <div className="h-4 bg-secondary rounded w-5/6" />
            <div className="h-4 bg-secondary rounded w-4/6" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-8 bg-secondary rounded w-3/4" />
          <div className="h-12 bg-secondary rounded w-1/2" />
          <div className="h-10 bg-secondary rounded" />
          <div className="h-10 bg-secondary rounded" />
        </div>
      </div>
    </div>
  );
}
