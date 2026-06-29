import Link from "next/link";

export default function StudioNotFound() {
  return (
    <div className="flex h-[calc(100vh-57px)] items-center justify-center bg-zinc-950">
      <div className="text-center max-w-md px-6">
        <div className="text-4xl mb-4">404</div>
        <h2 className="text-lg font-semibold text-zinc-300">Page not found</h2>
        <p className="mt-2 text-sm text-zinc-500">
          This page does not exist in the Studio.
        </p>
        <Link
          href="/studio"
          className="mt-4 inline-block rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-500 transition-colors"
        >
          Back to Studio
        </Link>
      </div>
    </div>
  );
}
