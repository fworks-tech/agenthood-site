import Navbar from "../components/Navbar";

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      <Navbar />
      {children}
      <footer className="border-t border-zinc-800 px-6 py-8 max-w-6xl mx-auto flex items-center justify-between text-sm text-zinc-600 mt-8">
        <span className="flex items-center gap-3">
          <span>
            agenthood · by{" "}
            <a href="https://flabs.tech" className="hover:text-zinc-400 transition-colors">
              Fabio Ritzel Borges
            </a>
          </span>
          <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono">
            v3.5.1
          </span>
        </span>
        <a
          href="https://github.com/fworks-tech/agenthood"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-zinc-400 transition-colors"
        >
          GitHub
        </a>
      </footer>
    </div>
  );
}
