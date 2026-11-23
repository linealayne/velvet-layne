"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, useStage, motionOn, isCoarse } from "@/lib/gsap";

// The tracer alphabet: twelve marks drawn for this page. V and L for the name,
// a single stroke for Linea ("line"), then a drop, a spark and friends.
const MARKS: { color: string; d: string; fill?: boolean }[] = [
  { color: "#c4001d", d: "M4 5l8 15 8-15" },
  { color: "#efe4d0", d: "M7 4v16h11" },
  { color: "#ff4d00", d: "M4 20L20 4" },
  { color: "#c9ced6", d: "M12 3c4 6 6 9 6 12a6 6 0 0 1-12 0c0-3 2-6 6-12z" },
  { color: "#ff4d00", d: "M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z", fill: true },
  { color: "#efe4d0", d: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z" },
  { color: "#c4001d", d: "M3 13c3-6 6-6 9 0s6 6 9 0" },
  { color: "#c9ced6", d: "M12 4v16M4 12h16" },
  { color: "#ff4d00", d: "M4 15a8 8 0 0 1 16 0z", fill: true },
  { color: "#efe4d0", d: "M12 4l9 16H3z" },
  { color: "#c9ced6", d: "M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" },
  { color: "#c4001d", d: "M12 3l9 9-9 9-9-9z" },
];

export default function Footer() {
  const root = useRef<HTMLElement>(null);

  useStage(
    () => {
      if (!motionOn()) return;
      const el = root.current!;
      const coarse = isCoarse();
      const marks = gsap.utils.toArray<HTMLElement>(".tracer", el);
      const n = marks.length;
      const pts = marks.map(() => ({ x: 0, y: 0 }));
      const target = { x: 0, y: 0 };
      let energy = 0;
      let lastInput = -1e9;
      let placed = false;
      let active = false;

      const aim = (clientX: number, clientY: number) => {
        const r = el.getBoundingClientRect();
        target.x = clientX - r.left;
        target.y = clientY - r.top;
        if (!placed) {
          placed = true;
          pts.forEach((p) => {
            p.x = target.x;
            p.y = target.y;
          });
        }
        energy = 1;
        lastInput = performance.now();
      };
      const onPointer = (e: PointerEvent) => aim(e.clientX, e.clientY);
      const onTouch = (e: TouchEvent) => {
        const t = e.touches[0];
        if (t) aim(t.clientX, t.clientY);
      };
      el.addEventListener("pointermove", onPointer, { passive: true });
      el.addEventListener("touchstart", onTouch, { passive: true });
      el.addEventListener("touchmove", onTouch, { passive: true });

      ScrollTrigger.create({
        trigger: el,
        start: "top bottom",
        end: "bottom top",
        onToggle: (self) => (active = self.isActive),
      });

      const tick = (time: number) => {
        if (!active) return;
        const idle = performance.now() - lastInput;
        const wandering = coarse && idle > 2200;
        if (wandering) {
          // No cursor on touch screens: the marks wander on their own.
          const w = el.clientWidth;
          const h = el.clientHeight;
          target.x = w * (0.5 + 0.36 * Math.sin(time * 0.55));
          target.y = h * (0.42 + 0.3 * Math.sin(time * 0.83 + 1));
          if (!placed) {
            placed = true;
            pts.forEach((p) => {
              p.x = target.x;
              p.y = target.y;
            });
          }
          energy += (0.85 - energy) * 0.04;
        } else if (idle > 700) {
          energy *= 0.955;
        }
        if (energy < 0.004 && idle > 1500 && !coarse) return;

        // Each mark chases the one ahead of it: that is the delay.
        pts.forEach((p, i) => {
          const lead = i === 0 ? target : pts[i - 1];
          const ease = wandering ? 0.075 : i === 0 ? 0.26 : 0.19;
          p.x += (lead.x - p.x) * ease;
          p.y += (lead.y - p.y) * ease;
          const k = i / n;
          const m = marks[i];
          m.style.opacity = (energy * (1 - k) ** 0.75).toFixed(3);
          m.style.transform = `translate3d(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px,0) rotate(${(
            i * 33 +
            p.x * 0.12
          ).toFixed(1)}deg) scale(${(1.1 - k * 0.4).toFixed(3)})`;
        });
      };
      gsap.ticker.add(tick);

      return () => {
        gsap.ticker.remove(tick);
        el.removeEventListener("pointermove", onPointer);
        el.removeEventListener("touchstart", onTouch);
        el.removeEventListener("touchmove", onTouch);
      };
    },
    root
  );

  return (
    <footer ref={root} className="footer">
      <div className="tracers" aria-hidden="true">
        {MARKS.map((m, i) => (
          <span key={i} className="tracer">
            <svg viewBox="0 0 24 24">
              <path
                d={m.d}
                fill={m.fill ? m.color : "none"}
                stroke={m.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        ))}
      </div>

      <div className="foot-main">
        <h2>Want something like this?</h2>
        <a className="foot-cta" href="https://lineaautomations.com/start">
          Start a project
        </a>
      </div>

      <div className="foot-base">
        <a href="https://lineaautomations.com">Built by Layne at Linea</a>
      </div>
    </footer>
  );
}
