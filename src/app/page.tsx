import { Suspense } from "react";
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

// Nothing below suspends. Each boundary exists so React hydrates that chapter
// in its own interruptible pass instead of hydrating the whole page in one
// long task. The HTML is already complete from the server either way.
export default function Home() {
  return (
    <>
      <SmoothScroll />
      <Cursor />
      <Hud />
      <main>
        <Suspense>
          <Act1 />
        </Suspense>
        <Suspense>
          <Conveyor />
        </Suspense>
        <Suspense>
          <Bridge variant="columns" index={4} title="Editorial" />
          <Editorial />
        </Suspense>
        <Suspense>
          <Bridge variant="iris" index={5} title="Dimension" />
          <Dimension />
        </Suspense>
        <Suspense>
          <Bridge variant="tiles" index={6} title="Brutal" />
          <Brutal />
        </Suspense>
        <Suspense>
          <Bridge variant="hinge" index={7} title="Tracers" />
        </Suspense>
      </main>
      <Suspense>
        <Footer />
      </Suspense>
    </>
  );
}
