"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { gsap, useStage, motionOn } from "@/lib/gsap";

// three.js is only downloaded when this chapter is about to come on screen.
const Sculpture = dynamic(() => import("./Sculpture"), { ssr: false });

export default function Dimension() {
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
      { rootMargin: "320% 0px" }
    );
    io.observe(root.current!);
    return () => io.disconnect();
  }, []);

  useStage(
    () => {
      if (!motionOn()) return;
      gsap
        .timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: root.current,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.4,
          },
        })
        .to(".dim-a", { opacity: 0, y: -40, duration: 0.2 }, 0.38)
        .fromTo(".dim-b", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.2 }, 0.58)
        .to({}, { duration: 0.22 });
    },
    root,
    6
  );

  return (
    <section ref={root} className="dimension" data-chapter="5" data-name="Dimension">
      <div className="dim-stage">
        <div className="dim-glow" aria-hidden="true" />
        {near && <Sculpture />}
        <div className="dim-fallback" aria-hidden="true" />
        <div className="dim-text dim-a">
          <h2>Depth is light, behaving.</h2>
          <p>
            Real geometry, rendered live in your browser. Move the cursor and
            it turns to look. Keep scrolling and it opens up.
          </p>
        </div>
        <div className="dim-text dim-b">
          <p className="dim-big">Same object. New angle.</p>
          <p>
            No video and no image sequence. One knot, three rings and a
            studio of colored light, all built in code.
          </p>
        </div>
      </div>
    </section>
  );
}
