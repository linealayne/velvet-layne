"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, useStage, motionOn } from "@/lib/gsap";

export type BridgeVariant = "columns" | "iris" | "tiles" | "hinge";

const COLS = 6;
const TILES = 40;

/**
 * A bridge sits between two chapters. Its stage sticks for a little under a
 * screen of scroll while one style is replaced by the next. It carries no
 * labels: the transition is the whole message. Every variant uses a different
 * mechanism so no transition repeats:
 *   columns  paper drops in as grid columns         (Manifesto → Editorial)
 *   iris     a red dot opens out of the black       (Corridor → Dimension)
 *   tiles    hard-cut blocks switch on, no easing   (Dimension → Brutal)
 *   hinge    the slab swings off its top-left corner (Brutal → Finale)
 * The other two transitions live in their chapters: the hero cools to black
 * (Hero.tsx) and paper fades slowly to black (Corridor.tsx).
 * Without motion a bridge is not rendered at all.
 */
export default function Bridge({ variant }: { variant: BridgeVariant }) {
  const root = useRef<HTMLDivElement>(null);

  useStage(() => {
    if (!motionOn()) return;
    const el = root.current!;
    const q = gsap.utils.selector(el);
    const st = { trigger: el, start: "top top", end: "bottom bottom" };

    if (variant === "tiles") {
      // The tiles are built here, not rendered: they only exist for the motion.
      const grid = q(".tiles")[0] as HTMLElement;
      grid.replaceChildren();
      const tiles = Array.from({ length: TILES }, () => {
        const tile = document.createElement("span");
        tile.className = "tile";
        grid.appendChild(tile);
        return tile;
      });
      const thr = tiles.map((_, i) => 0.06 + (((i * 17) % TILES) / TILES) * 0.74);
      let lastStep = -1;
      ScrollTrigger.create({
        ...st,
        onUpdate: (self) => {
          const p = self.progress;
          const step = Math.floor(p * 110);
          if (step === lastStep) return;
          lastStep = step;
          tiles.forEach((t, i) => {
            const on = p > thr[i];
            const flicker = !on && p > thr[i] - 0.07 && (step + i) % 2 === 0;
            t.style.opacity = on || flicker ? "1" : "0";
            t.style.backgroundColor = flicker ? "#efe4d0" : "";
          });
        },
      });
      return;
    }

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { ...st, scrub: 0.35 },
    });

    if (variant === "columns") {
      tl.fromTo(
        q(".col"),
        { scaleY: 0 },
        { scaleY: 1, duration: 0.7, ease: "power3.inOut", stagger: { each: 0.06, from: "edges" } },
        0
      );
    } else if (variant === "iris") {
      // This bridge overlaps the end of the Corridor so there is no black gap
      // before the dot appears. Its backdrop only exists once it has taken over.
      tl.fromTo(q(".b-from"), { opacity: 0 }, { opacity: 1, duration: 0.01 }, 0);
      tl.fromTo(q(".iris-red"), { "--r": 0 }, { "--r": 78, duration: 0.5, ease: "power2.in" }, 0.04).fromTo(
        q(".b-to"),
        { "--r": 0 },
        { "--r": 78, duration: 0.44, ease: "power2.inOut" },
        0.46
      );
    } else if (variant === "hinge") {
      tl.to(
        q(".b-from"),
        { rotation: 93, duration: 0.8, ease: "power2.in", transformOrigin: "0% 0%" },
        0.04
      );
    }
    tl.to({}, { duration: 0.08 });
  }, root);

  return (
    <div ref={root} className={`bridge bridge-${variant}`} aria-hidden="true">
      <div className="bridge-stage">
        <div className="b-from">
          {variant === "hinge" && <p className="hinge-word">Enough noise.</p>}
        </div>
        {variant === "iris" && <div className="iris-red" />}
        <div className="b-to">
          {variant === "columns" && (
            <div className="cols">
              {Array.from({ length: COLS }, (_, i) => (
                <span key={i} className="col" />
              ))}
            </div>
          )}
          {variant === "tiles" && <div className="tiles" />}
        </div>
      </div>
    </div>
  );
}
