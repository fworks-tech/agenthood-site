"use client";

export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-[calc(100vh-57px)] items-center justify-center bg-zinc-950">
      <div className="text-center max-w-md px-6">
        <div className="text-4xl mb-4">⚠</div>
        <h2 className="text-lg font-semibold text-zinc-300">Something went wrong</h2>
        <p className="mt-2 text-sm text-zinc-500">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
