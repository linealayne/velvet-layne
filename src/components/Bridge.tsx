"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, useStage, motionOn } from "@/lib/gsap";

export type BridgeVariant = "sweep" | "columns" | "iris" | "tiles" | "hinge";

const COLS = 6;
const TILES = 40;

/**
 * A bridge sits between two chapters. Its stage sticks for a little over one
 * screen of scroll while the outgoing style is replaced by the incoming one.
 * Every variant uses a different mechanism, so no transition repeats:
 *   sweep   diagonal colour slabs race in from the right
 *   columns paper drops in as grid columns
 *   iris    a red dot opens into the dark
 *   tiles   hard-cut blocks switch on, no easing
 *   hinge   the whole slab swings off its top-left corner
 * Without motion the bridge is a plain title panel for the next chapter.
 */
export default function Bridge({
  variant,
  index,
  title,
}: {
  variant: BridgeVariant;
  index: number;
  title: string;
}) {
  const root = useRef<HTMLDivElement>(null);

  useStage(
    () => {
      if (!motionOn()) return;
      const el = root.current!;
      const q = gsap.utils.selector(el);
      const st = {
        trigger: el,
        start: "top top",
        end: "bottom bottom",
      };

      if (variant === "tiles") {
        const tiles = q(".tile") as HTMLElement[];
        const card = q(".card")[0] as HTMLElement;
        const thr = tiles.map(
          (_, i) => 0.06 + (((i * 17) % TILES) / TILES) * 0.66,
        );
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
              t.style.backgroundColor = flicker ? "#0019ff" : "";
            });
            card.style.visibility = p > 0.8 ? "visible" : "hidden";
          },
        });
        return;
      }

      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { ...st, scrub: 0.35 },
      });

      if (variant === "sweep") {
        tl.fromTo(
          q(".sw"),
          { "--x": 128 },
          { "--x": 0, duration: 0.6, stagger: 0.085, ease: "power2.inOut" },
          0,
        ).fromTo(
          q(".card"),
          { xPercent: 45, opacity: 0 },
          { xPercent: 0, opacity: 1, duration: 0.38, ease: "power3.out" },
          0.42,
        );
      } else if (variant === "columns") {
        tl.fromTo(
          q(".col"),
          { scaleY: 0 },
          {
            scaleY: 1,
            duration: 0.5,
            ease: "power3.inOut",
            stagger: { each: 0.06, from: "edges" },
          },
          0,
        )
          .set(q(".card"), { visibility: "visible" }, 0.5)
          .fromTo(
            q(".mask > *"),
            { yPercent: 115 },
            { yPercent: 0, duration: 0.3, ease: "power3.out", stagger: 0.07 },
            0.55,
          );
      } else if (variant === "iris") {
        tl.fromTo(
          q(".iris-red"),
          { "--r": 1.1 },
          { "--r": 78, duration: 0.48, ease: "power2.in" },
          0.04,
        )
          .fromTo(
            q(".b-to"),
            { "--r": 0 },
            { "--r": 78, duration: 0.42, ease: "power2.inOut" },
            0.4,
          )
          .fromTo(
            q(".card"),
            { opacity: 0, scale: 0.86 },
            { opacity: 1, scale: 1, duration: 0.25, ease: "power2.out" },
            0.66,
          );
      } else if (variant === "hinge") {
        tl.to(
          q(".b-from"),
          {
            rotation: 93,
            duration: 0.72,
            ease: "power2.in",
            transformOrigin: "0% 0%",
          },
          0.04,
        ).fromTo(
          q(".card"),
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" },
          0.55,
        );
      }
      tl.to({}, { duration: 0.1 });
    },
    root,
    index * 2 - 5,
  );

  return (
    <div ref={root} className={`bridge bridge-${variant}`} aria-hidden="true">
      <div className="bridge-stage">
        <div className="b-from">
          {variant === "hinge" && <p className="hinge-word">Enough noise.</p>}
        </div>
        {variant === "sweep" && (
          <>
            <div className="sw sw-a" />
            <div className="sw sw-b" />
          </>
        )}
        {variant === "iris" && <div className="iris-red" />}
        <div className={variant === "sweep" ? "b-to sw" : "b-to"}>
          {variant === "columns" && (
            <div className="cols">
              {Array.from({ length: COLS }, (_, i) => (
                <span key={i} className="col" />
              ))}
            </div>
          )}
          {variant === "tiles" && (
            <div className="tiles">
              {Array.from({ length: TILES }, (_, i) => (
                <span key={i} className="tile" />
              ))}
            </div>
          )}
          <div className="card">
            <div className="mask">
              <p className="card-n">{index} / 7</p>
            </div>
            <div className="mask">
              <p className="card-t">{title}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
