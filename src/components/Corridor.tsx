"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap, useStage, motionOn } from "@/lib/gsap";

// three.js and the scene are only downloaded as this chapter approaches.
const CorridorScene = dynamic(() => import("./CorridorScene"), { ssr: false });

const LINES = ["Walk the work.", "Every wall is mine.", "Nothing borrowed.", "Keep going."];

/**
 * Chapter 4, the centrepiece. Editorial's tan paper fades slowly to black,
 * and out of the black comes the Corridor. A framed panel at the centre holds
 * a line that changes as you travel.
 */
export default function Corridor() {
  const root = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "250% 0px" }
    );
    io.observe(root.current!);
    return () => io.disconnect();
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
      // The slow fade: paper to black, then the tunnel out of the black.
      .fromTo(".cor-paper", { opacity: 1 }, { opacity: 0, duration: 0.2, ease: "power1.inOut" }, 0)
      .fromTo(".cor-world", { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "power1.in" }, 0.1)
      .fromTo(".cor-frame", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 0.12, ease: "power2.out" }, 0.2)
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
        <div className="cor-paper" aria-hidden="true" />
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
