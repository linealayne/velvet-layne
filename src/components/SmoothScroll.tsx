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
    if (!motionOn()) return;

    // Layout changes are handled by the ResizeObserver below, so ScrollTrigger
    // does not need to re-measure the whole page again on window load.
    ScrollTrigger.config({ autoRefreshEvents: "visibilitychange" });

    const lenis = new Lenis({ lerp: 0.12, smoothWheel: true, anchors: true });
    lenis.on("scroll", ScrollTrigger.update);
    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    // Velocity comes from scroll events, so an idle page never reads layout.
    let y = window.scrollY;
    let last = y;
    const onScroll = () => {
      y = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const track = (_t: number, deltaMs: number) => {
      const dt = Math.max(deltaMs, 1) / 1000;
      const v = (y - last) / dt;
      last = y;
      scrollState.velocity += (v - scrollState.velocity) * 0.14;
      if (Math.abs(v) > 8) scrollState.direction = v > 0 ? 1 : -1;
    };
    gsap.ticker.add(track);

    // Chapters below the fold use content-visibility, so their real height is
    // only known once they come near. Re-measure the triggers when that happens.
    let settle = 0;
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      window.clearTimeout(settle);
      settle = window.setTimeout(() => ScrollTrigger.refresh(), 120);
    });
    const main = document.querySelector("main");
    if (main) ro.observe(main);

    return () => {
      ro.disconnect();
      window.clearTimeout(settle);
      window.removeEventListener("scroll", onScroll);
      gsap.ticker.remove(track);
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
