"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap, useStage, motionOn } from "@/lib/gsap";
import { preloadCorridor } from "@/lib/corridorAssets";

// three.js and the scene are downloaded as soon as the visitor starts to
// travel, long before this chapter.
const CorridorScene = dynamic(() => import("./CorridorScene"), { ssr: false });

const LINES = ["Walk the work.", "Every wall is mine.", "Nothing borrowed.", "Keep going."];

/**
 * Chapter 4, the centrepiece. Editorial's tan paper fades slowly away and the
 * Corridor is already there behind it, populated and moving. A framed panel at
 * the centre holds a line that changes as you travel.
 *
 * Loading is front-loaded so nothing is blank on arrival:
 *  1. once the hero has settled, the panel images are fetched and decoded and
 *     the posters are drawn (`preloadCorridor`, no three.js involved);
 *  2. as soon as the visitor scrolls, the three.js scene is mounted and built,
 *     which uploads every texture and draws the first frame;
 *  3. the frame and the tunnel sit fully ready under the paper.
 */
export default function Corridor() {
  const root = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    // 1. Assets: when the browser is idle after the hero, or on first input.
    const warm = () => {
      preloadCorridor();
    };
    const timer = window.setTimeout(() => {
      if ("requestIdleCallback" in window) window.requestIdleCallback(warm, { timeout: 1500 });
      else warm();
    }, 2600);

    // 2. Scene: at the first real scroll, or when the chapter is a few
    //    screens away, whichever comes first.
    let done = false;
    let io: IntersectionObserver | null = null;
    const onScroll = () => {
      if (window.scrollY > window.innerHeight * 0.35) mount();
    };
    const mount = () => {
      if (done) return;
      done = true;
      warm();
      setNear(true);
      window.removeEventListener("scroll", onScroll);
      io?.disconnect();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) mount();
      },
      { rootMargin: "500% 0px" }
    );
    io.observe(root.current!);
    onScroll();
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      io?.disconnect();
    };
  }, []);

  useStage(() => {
    if (!motionOn()) return;
    const el = root.current!;
    const lines = gsap.utils.toArray<HTMLElement>(".cor-line", el);
    let active = -1;
    gsap
      .timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.5,
          onUpdate: (self) => {
            const k = gsap.utils.clamp(0, 0.999, (self.progress - 0.24) / 0.68);
            const i = Math.floor(k * lines.length);
            if (i === active) return;
            active = i;
            lines.forEach((line, n) => line.classList.toggle("is-on", n === i));
          },
        },
      })
      // The slow fade: the paper thins out and the tunnel is already running
      // behind it. Nothing has to appear afterwards.
      .fromTo(".cor-paper", { opacity: 1 }, { opacity: 0, duration: 0.2, ease: "power1.inOut" }, 0)
      .to(".cor-world", { opacity: 0, duration: 0.07 }, 0.93)
      .to(".cor-frame", { opacity: 0, scale: 0.2, duration: 0.07, ease: "power2.in" }, 0.93);
  }, root);

  return (
    <section ref={root} className="corridor">
      <div className="cor-stage">
        <div className="cor-world">
          {near && <CorridorScene />}
          <div className="cor-fallback" aria-hidden="true" />
        </div>
        <div className="cor-frame">
          <h2 className="sr-only">The corridor</h2>
          {LINES.map((line, i) => (
            <p key={line} className={i === 0 ? "cor-line is-on" : "cor-line"}>
              {line}
            </p>
          ))}
        </div>
        <div className="cor-paper" aria-hidden="true" />
      </div>
    </section>
  );
}
