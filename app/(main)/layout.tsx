import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { FloatingCompanion } from "../components/FloatingCompanion";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
      <FloatingCompanion />
    </>
  );
}
