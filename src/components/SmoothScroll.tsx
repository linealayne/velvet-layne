"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { gsap, ScrollTrigger, scrollState, motionOn } from "@/lib/gsap";

/**
 * Lenis smooths wheel input only (touch stays native), driven by the GSAP
 * ticker so ScrollTrigger and the scroll position never disagree.
 * Also publishes a smoothed scroll velocity for the chapters to react to.
 */
export default function SmoothScroll() {
  useEffect(() => {
    let lenis: Lenis | null = null;
    let raf: ((time: number) => void) | null = null;

    if (motionOn()) {
      lenis = new Lenis({ lerp: 0.12, smoothWheel: true, anchors: true });
      lenis.on("scroll", ScrollTrigger.update);
      raf = (time: number) => lenis?.raf(time * 1000);
      gsap.ticker.add(raf);
      gsap.ticker.lagSmoothing(0);
    }

    let last = window.scrollY;
    const track = (_t: number, deltaMs: number) => {
      const y = window.scrollY;
      const dt = Math.max(deltaMs, 1) / 1000;
      const v = (y - last) / dt;
      last = y;
      scrollState.velocity += (v - scrollState.velocity) * 0.14;
      if (Math.abs(v) > 8) scrollState.direction = v > 0 ? 1 : -1;
    };
    gsap.ticker.add(track);

    const refresh = () => ScrollTrigger.refresh();

    // Chapters below the fold use content-visibility, so their real height is
    // only known once they come near. Re-measure the triggers when that happens.
    let settle = 0;
    const ro = new ResizeObserver(() => {
      window.clearTimeout(settle);
      settle = window.setTimeout(refresh, 120);
    });
    const main = document.querySelector("main");
    if (main) ro.observe(main);
    document.fonts?.ready.then(refresh);
    window.addEventListener("load", refresh);

    return () => {
      ro.disconnect();
      window.clearTimeout(settle);
      gsap.ticker.remove(track);
      if (raf) gsap.ticker.remove(raf);
      window.removeEventListener("load", refresh);
      lenis?.destroy();
    };
  }, []);

  return null;
}
