import SmoothScroll from "@/components/SmoothScroll";
import Cursor from "@/components/Cursor";
import Hud from "@/components/Hud";
import Act1 from "@/components/Act1";
import Bridge from "@/components/Bridge";
import Conveyor from "@/components/Conveyor";
import Editorial from "@/components/Editorial";
import Dimension from "@/components/Dimension";
import Brutal from "@/components/Brutal";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <SmoothScroll />
      <Cursor />
      <Hud />
      <main>
        <Act1 />
        <Conveyor />
        <Bridge variant="columns" index={4} title="Editorial" />
        <Editorial />
        <Bridge variant="iris" index={5} title="Dimension" />
        <Dimension />
        <Bridge variant="tiles" index={6} title="Brutal" />
        <Brutal />
        <Bridge variant="hinge" index={7} title="Tracers" />
      </main>
      <Footer />
    </>
  );
}
