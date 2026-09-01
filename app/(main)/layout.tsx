import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { AGENTHOOD_VERSION } from "../_lib/agenthood-version";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <Navbar />
      <div className="flex flex-1 min-h-0 flex-col">{children}</div>
      <Footer version={AGENTHOOD_VERSION} />
    </div>
  );
}
