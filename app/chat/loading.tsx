export default function ChatLoading() {
  return (
    <div className="max-w-5xl mx-auto animate-pulse">
      <div className="h-7 bg-secondary rounded w-24 mb-4" />
      <div className="grid lg:grid-cols-[320px_1fr] gap-4">
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
              <div className="size-10 rounded-xl bg-secondary shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-secondary rounded w-3/4" />
                <div className="h-2.5 bg-secondary rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden lg:block rounded-xl border border-border bg-card h-[60vh]" />
      </div>
    </div>
  );
}
