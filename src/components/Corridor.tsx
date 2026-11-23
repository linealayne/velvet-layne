"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap, useStage, motionOn } from "@/lib/gsap";
import { preloadCorridor } from "@/lib/corridorAssets";
import { corridorState, entranceLight } from "@/lib/corridorState";

// three.js and the scene are downloaded as soon as the visitor starts to
// travel, long before this chapter.
const CorridorScene = dynamic(() => import("./CorridorScene"), { ssr: false });

const LINES = ["Walk the work.", "Every wall is mine.", "Nothing borrowed.", "Keep going."];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Chapter 4, the centrepiece, and the way into it.
 *
 * The entrance: the Editorial page is vacuumed into the tunnel. This chapter's
 * stage starts one screen early, over the last screen of Editorial, showing an
 * exact copy of what is on screen (`.vac-page`, cloned from the real DOM at
 * that moment). Scrolling pulls that page away down the tunnel: it is scaled
 * about the centre by exactly the amount the tunnel's cross-section shrinks
 * with depth, so its edges stay welded to the tan walls, floor and ceiling
 * that the three.js scene draws around it (`corridorState.vac` keeps the two
 * in step). The dark closes in from the far end, the centre of the screen
 * outward, over the page and the walls alike (`entranceLight`), until all is
 * black; then it opens on the real tunnel, with the frame arriving from the
 * depth. One motion, fully reversible, no crossfade.
 *
 * Loading is front-loaded so nothing is blank on arrival:
 *  1. once the hero has settled, the panel images are fetched and decoded and
 *     the posters are drawn (`preloadCorridor`, called from SmoothScroll.tsx);
 *  2. as soon as the visitor scrolls, the three.js scene is mounted and built,
 *     which uploads every texture and draws the first frame.
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
    const lines = gsap.utils.toArray<HTMLElement>(".cor-line", el);
    const page = el.querySelector<HTMLElement>(".vac-page")!;
    const main = el.querySelector<HTMLElement>(".vac-main")!;
    const shade = el.querySelector<HTMLElement>(".vac-shade")!;
    const ghosts = gsap.utils.toArray<HTMLElement>(".vac-ghost", el);
    const slots = gsap.utils.toArray<HTMLElement>(".vac-ed", el);
    let active = -1;

    // Copy what Editorial is showing right now into the page that gets pulled
    // in. It is the real markup with the real styles, bottom-aligned exactly
    // as the real page is at the moment this stage takes over.
    const copy = () => {
      const source = document.querySelector(".editorial .ed-steps");
      if (!source) return;
      slots.forEach((slot) => {
        const clone = source.cloneNode(true) as HTMLElement;
        // The copy always shows the plates fully revealed.
        clone.querySelectorAll<HTMLElement>(".plate, .plate svg").forEach((n) => n.removeAttribute("style"));
        slot.replaceChildren(clone);
      });
    };

    const apply = (P: number) => {
      const k = clamp01((P - 0.24) / 0.68) * 0.999;
      const i = Math.floor(k * lines.length);
      if (i !== active) {
        active = i;
        lines.forEach((line, n) => line.classList.toggle("is-on", n === i));
      }

      // The entrance occupies the first fifth of the chapter.
      const p = clamp01(P / 0.2);
      corridorState.vac = p;
      if (p >= 0.985) {
        page.style.visibility = "hidden";
        return;
      }
      page.style.visibility = "visible";
      // Pulled away slowly at first, then fast: s is the page's size on screen.
      const s = Math.exp(-4.3 * Math.pow(p, 1.55));
      // The same darkness the tunnel walls have at that depth.
      const depth = corridorState.d0 / s;
      const fog = entranceLight(p);
      const dark = fog.paper ? clamp01((depth - fog.near) / (fog.far - fog.near)) : 1;
      main.style.transform = `scale(${s.toFixed(4)})`;
      shade.style.opacity = dark.toFixed(3);
      // Motion streak: fainter copies of the page's ink lag behind it.
      const w = Math.sin(Math.PI * Math.min(1, p * 1.2));
      ghosts.forEach((g, n) => {
        g.style.transform = `scale(${(s * (1 + 0.075 * (n + 1) * w)).toFixed(4)})`;
        g.style.opacity = ((0.34 - n * 0.14) * w * (1 - dark)).toFixed(3);
      });
    };

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: el,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.5,
        onToggle: (self) => {
          if (self.isActive) copy();
        },
      },
      onUpdate: () => apply(tl.progress()),
    });
    tl.fromTo(
      ".cor-frame",
      { opacity: 0, scale: 0.1 },
      { opacity: 1, scale: 1, duration: 0.11, ease: "power2.out" },
      0.15
    )
      .to(".cor-world", { opacity: 0, duration: 0.07 }, 0.93)
      .to(".cor-frame", { opacity: 0, scale: 0.2, duration: 0.07, ease: "power2.in" }, 0.93);
    copy();
    apply(tl.progress());

    return () => {
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
          <div className="vac-layer vac-ghost">
            <div className="editorial vac-ed" />
          </div>
          <div className="vac-layer vac-ghost">
            <div className="editorial vac-ed" />
          </div>
          <div className="vac-layer vac-main">
            <div className="editorial vac-ed" />
            <div className="vac-shade" />
          </div>
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
