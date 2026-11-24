"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap, useStage, motionOn } from "@/lib/gsap";
import { preloadCorridor } from "@/lib/corridorAssets";
import { corridorState } from "@/lib/corridorState";
import { drawEditorialPage, preparePlates } from "@/lib/pageTexture";

// three.js and the scene are downloaded as soon as the visitor starts to
// travel, long before this chapter.
const CorridorScene = dynamic(() => import("./CorridorScene"), { ssr: false });

const LINES = ["Walk the work.", "Every wall is mine.", "Nothing borrowed.", "Keep going."];

/** The share of this chapter's scroll that the entrance takes. */
const ENTRANCE = 0.54;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Chapter 4, the centrepiece, and the way into it.
 *
 * The way in is the studio sequence (lib/studio.ts): the "4" page is a draft.
 * It is crumpled up and thrown away in a designer's studio, the studio is
 * pulled into the dark brick by brick, and the framed work on its wall flies
 * off to become the tunnel. It takes the first 54% of this chapter's scroll
 * (`ENTRANCE`); `corridorState.vac` runs 0 to 1 across it, and everything in
 * the studio is a function of that number, so it scrubs both ways.
 *
 * This chapter's stage starts one screen early, over the last screen of
 * Editorial, which is exactly the "4" step (see `.ed-step:last-child` in
 * globals.css). A picture of that screen is painted to a canvas
 * (`lib/pageTexture.ts`) and becomes the sheet of paper in the studio.
 *
 * Before this chapter's script has taken over the stage is empty and
 * see-through, so nothing of the Corridor can sit on top of Editorial. Once
 * it has (`.is-set`), the stage shows a DOM copy of the page until the paper
 * takes over at the first movement, so the handover from the real Editorial
 * is exact.
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
    // handover, once as a picture for the sheet of paper.
    const capture = () => {
      const source = document.querySelector("section.editorial .ed-steps");
      if (!source) return;
      const clone = source.cloneNode(true) as HTMLElement;
      // The copy always shows the plates fully revealed.
      clone.querySelectorAll<HTMLElement>(".plate, .plate svg").forEach((n) => n.removeAttribute("style"));
      slot.replaceChildren(clone);
      stage.classList.add("is-set");
      const canvas = (corridorState.page ??= document.createElement("canvas"));
      // One texel per pixel of the 3D canvas (whose pixel ratio is capped at
      // 1.5 in CorridorScene), so the flat sheet reproduces this picture exactly.
      const scale = Math.min(window.devicePixelRatio || 1, 1.5);
      if (drawEditorialPage(canvas, stage.clientWidth, stage.clientHeight, scale)) corridorState.pageVersion++;
    };

    const apply = (P: number) => {
      const k = clamp01((P - (ENTRANCE + 0.03)) / (0.93 - ENTRANCE - 0.03)) * 0.999;
      const i = Math.floor(k * lines.length);
      if (i !== active) {
        active = i;
        lines.forEach((line, n) => line.classList.toggle("is-on", n === i));
      }
      const p = clamp01(P / ENTRANCE);
      corridorState.vac = p;
      if (corridorState.sheet) {
        // The paper is the page from the first movement on.
        page.style.visibility = p < 0.004 ? "visible" : "hidden";
        page.style.opacity = "1";
        // (marks the stage as showing the 3D scene: see .is-3d in globals.css)
        stage.classList.toggle("is-3d", p >= 0.004);
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
      { opacity: 1, scale: 1, duration: 0.07, ease: "power2.out" },
      ENTRANCE - 0.035
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
      {/* Reduced motion only: a still of the studio wall, between the "4" screen and the tunnel. */}
      <div className="studio-still" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" />
      </div>
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
