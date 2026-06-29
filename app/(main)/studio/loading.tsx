export default function StudioLoading() {
  return (
    <div className="flex flex-1 min-h-0 mx-auto max-w-7xl bg-zinc-950">
      <div className="w-72 border-r border-zinc-800 bg-zinc-900 p-4">
        <div className="mb-4 h-4 w-24 animate-pulse rounded bg-zinc-800" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-zinc-800" />
          ))}
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <div className="h-4 w-48 animate-pulse rounded bg-zinc-800" />
      </div>
    </div>
  );
}
