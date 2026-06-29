export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full bg-zinc-950 text-zinc-100 font-sans">
      {children}
    </div>
  );
}
