"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap, useStage, motionOn, isSmall } from "@/lib/gsap";
import { preloadCorridor } from "@/lib/corridorAssets";
import { corridorState } from "@/lib/corridorState";
import { drawEditorialPage, preparePlates } from "@/lib/pageTexture";

// three.js and the scene are downloaded as soon as the visitor starts to
// travel, long before this chapter.
const CorridorScene = dynamic(() => import("./CorridorScene"), { ssr: false });

const LINES = ["Walk the work.", "Every wall is mine.", "Nothing borrowed.", "Keep going."];

/** The share of this chapter's scroll that the entrance takes. */
const ENTRANCE = 0.3;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Chapter 4, the centrepiece, and the way into it.
 *
 * The entrance: Editorial's last page comes apart into ribbons and is drawn
 * into the tunnel. This chapter's stage starts one screen early, over the
 * last screen of Editorial. A picture of exactly that screen is painted to a
 * canvas (`lib/pageTexture.ts`) and handed to the three.js scene, which shows
 * it on a sheet of vertical ribbons that at first is simply the flat page.
 * Scrolling then (all in `CorridorScene`'s vertex shader):
 *   - the bottom of the page comes loose in strips that hang and ripple;
 *   - the loose ends are drawn back toward the centre of the screen, waving
 *     and turning, and the pull peels the rest of the page into ribbons;
 *   - the dark opens behind them, the ribbons stretch away and come to rest
 *     along the tunnel's walls, floor and ceiling, and as their light goes
 *     out the tunnel's own panels come up. The frame arrives from the depth.
 * Scroll-scrubbed and fully reversible; the cloth also moves on its own.
 *
 * For the very first instant the stage shows a DOM copy of the page instead,
 * so the handover from the real Editorial is exact.
 *
 * Loading is front-loaded so nothing is blank on arrival: the panel images
 * are fetched and decoded once the hero has settled (`preloadCorridor`, from
 * SmoothScroll.tsx), and the three.js scene is mounted at the first scroll.
 */
export default function Corridor() {
  const root = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    let done = false;
    let io: IntersectionObserver | null = null;
    const onScroll = () => {
      if (window.scrollY > window.innerHeight * 0.35) mount();
    };
    const mount = () => {
      if (done) return;
      done = true;
      preloadCorridor();
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
      window.removeEventListener("scroll", onScroll);
      io?.disconnect();
    };
  }, []);

  useStage(() => {
    if (!motionOn()) return;
    const el = root.current!;
    const stage = el.querySelector<HTMLElement>(".cor-stage")!;
    const lines = gsap.utils.toArray<HTMLElement>(".cor-line", el);
    const page = el.querySelector<HTMLElement>(".vac-page")!;
    const slot = el.querySelector<HTMLElement>(".vac-ed")!;
    let active = -1;

    // Take the page as Editorial shows it right now: once as real DOM for the
    // handover, once as a picture for the ribbons.
    const capture = () => {
      const source = document.querySelector("section.editorial .ed-steps");
      if (!source) return;
      const clone = source.cloneNode(true) as HTMLElement;
      // The copy always shows the plates fully revealed.
      clone.querySelectorAll<HTMLElement>(".plate, .plate svg").forEach((n) => n.removeAttribute("style"));
      slot.replaceChildren(clone);
      const canvas = (corridorState.page ??= document.createElement("canvas"));
      const scale = Math.min(window.devicePixelRatio || 1, isSmall() ? 1.5 : 1.25);
      if (drawEditorialPage(canvas, stage.clientWidth, stage.clientHeight, scale)) corridorState.pageVersion++;
    };

    const apply = (P: number) => {
      const k = clamp01((P - 0.42) / 0.5) * 0.999;
      const i = Math.floor(k * lines.length);
      if (i !== active) {
        active = i;
        lines.forEach((line, n) => line.classList.toggle("is-on", n === i));
      }
      const p = clamp01(P / ENTRANCE);
      corridorState.vac = p;
      if (corridorState.ribbons) {
        // The ribbons are the page from the first movement on.
        page.style.visibility = p < 0.004 ? "visible" : "hidden";
        page.style.opacity = "1";
      } else {
        // No WebGL: the page simply sinks into the dark.
        page.style.visibility = p < 0.6 ? "visible" : "hidden";
        page.style.opacity = (1 - clamp01(p / 0.55)).toFixed(3);
      }
    };

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: el,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.5,
        onToggle: (self) => {
          if (self.isActive) capture();
        },
      },
      onUpdate: () => apply(tl.progress()),
    });
    tl.fromTo(
      ".cor-frame",
      { opacity: 0, scale: 0.08 },
      { opacity: 1, scale: 1, duration: 0.12, ease: "power2.out" },
      ENTRANCE - 0.045
    )
      .to(".cor-world", { opacity: 0, duration: 0.07 }, 0.93)
      .to(".cor-frame", { opacity: 0, scale: 0.2, duration: 0.07, ease: "power2.in" }, 0.93);

    // The plates are rasterised ahead of time; the picture is taken again at
    // the moment of takeover, and once more when the fonts are certain.
    preparePlates();
    const early = window.setTimeout(capture, 400);
    document.fonts?.ready.then(() => capture());
    capture();
    apply(tl.progress());

    return () => {
      window.clearTimeout(early);
      corridorState.vac = 1;
    };
  }, root);

  return (
    <section ref={root} className="corridor">
      <div className="cor-stage">
        <div className="cor-world">
          {near && <CorridorScene />}
          <div className="cor-fallback" aria-hidden="true" />
        </div>
        <div className="vac-page" aria-hidden="true">
          <div className="editorial vac-ed" />
        </div>
        <div className="cor-frame">
          <h2 className="sr-only">The corridor</h2>
          {LINES.map((line, i) => (
            <p key={line} className={i === 0 ? "cor-line is-on" : "cor-line"}>
              {line}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
