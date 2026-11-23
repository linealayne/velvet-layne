import { Suspense } from "react";
import SmoothScroll from "@/components/SmoothScroll";
import Hero from "@/components/Hero";
import Manifesto from "@/components/Manifesto";
import Bridge from "@/components/Bridge";
import Editorial from "@/components/Editorial";
import Corridor from "@/components/Corridor";
import Dimension from "@/components/Dimension";
import Brutal from "@/components/Brutal";
import Finale from "@/components/Finale";
import Footer from "@/components/Footer";

// Nothing below suspends. Each boundary exists so React hydrates that chapter
// in its own interruptible pass instead of hydrating the whole page in one
// long task. The HTML is already complete from the server either way.
export default function Home() {
  return (
    <>
      <SmoothScroll />
      <main>
        <Suspense>
          <Hero />
        </Suspense>
        <Suspense>
          <Manifesto />
          <Bridge variant="columns" />
        </Suspense>
        <Suspense>
          <Editorial />
        </Suspense>
        <Suspense>
          <Corridor />
          <Bridge variant="iris" />
        </Suspense>
        <Suspense>
          <Dimension />
          <Bridge variant="tiles" />
        </Suspense>
        <Suspense>
          <Brutal />
          <Bridge variant="hinge" />
        </Suspense>
        <Suspense>
          <Finale />
        </Suspense>
      </main>
      <Suspense>
        <Footer />
      </Suspense>
      {/* One sheet of film grain over the whole show. */}
      <div className="film-grain" aria-hidden="true" />
    </>
  );
}
