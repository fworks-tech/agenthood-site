"use client";

import HelpTip from "./_components/HelpTip";

export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 min-h-0 items-center justify-center bg-zinc-950">
      <div className="text-center max-w-md px-6">
        <svg className="mx-auto h-10 w-10 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <h2 className="flex items-center justify-center gap-1 text-lg font-semibold text-zinc-300">
          Something went wrong
          <HelpTip text="An unexpected error occurred. This could be a network or server issue." />
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          An unexpected error occurred. Try again or select a different provider.
        </p>
        {error.digest && (
          <p className="mt-1 text-xs text-zinc-600">Error ID: {error.digest}</p>
        )}
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
