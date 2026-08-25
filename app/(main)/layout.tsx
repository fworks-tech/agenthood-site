import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { AGENTHOOD_VERSION } from "../_lib/agenthood-version";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
      <Footer version={AGENTHOOD_VERSION} />
    </>
  );
}
