export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col bg-zinc-950 text-zinc-100 font-sans">
      {children}
    </div>
  );
}
