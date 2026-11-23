import { Suspense } from "react";
import SmoothScroll from "@/components/SmoothScroll";
import AfterInput from "@/components/AfterInput";
import Hero from "@/components/Hero";
import Manifesto from "@/components/Manifesto";
import Bridge from "@/components/Bridge";
import Editorial from "@/components/Editorial";
import Corridor from "@/components/Corridor";
import Dimension from "@/components/Dimension";
import Brutal from "@/components/Brutal";
import Finale from "@/components/Finale";
import Footer from "@/components/Footer";

// The HTML is complete from the server. Each boundary lets React hydrate that
// chapter in its own interruptible pass, and <AfterInput> holds every chapter
// below the hero back until the visitor's first scroll, touch or key press.
export default function Home() {
  return (
    <>
      <SmoothScroll />
      <main>
        <Suspense>
          <Hero />
        </Suspense>
        <Suspense>
          <AfterInput>
            <Manifesto />
            <Bridge variant="columns" />
          </AfterInput>
        </Suspense>
        <Suspense>
          <AfterInput>
            <Editorial />
          </AfterInput>
        </Suspense>
        <Suspense>
          <AfterInput>
            <Corridor />
            <Bridge variant="iris" />
          </AfterInput>
        </Suspense>
        <Suspense>
          <AfterInput>
            <Dimension />
            <Bridge variant="tiles" />
          </AfterInput>
        </Suspense>
        <Suspense>
          <AfterInput>
            <Brutal />
            <Bridge variant="hinge" />
          </AfterInput>
        </Suspense>
        <Suspense>
          <AfterInput>
            <Finale />
          </AfterInput>
        </Suspense>
      </main>
      <Suspense>
        <AfterInput>
          <Footer />
        </AfterInput>
      </Suspense>
      {/* One sheet of film grain over the whole show. */}
      <div className="film-grain" aria-hidden="true" />
    </>
  );
}
