"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, useStage, motionOn, isCoarse } from "@/lib/gsap";

// The tracer alphabet: high-stakes table symbols, drawn for this page as plain
// SVG shapes (no emoji, no font glyphs). Four suits, poker chips and dice, in
// bone, oxblood and the signal orange, each at its own size.
const BONE = "#efe4d0";
const OXBLOOD = "#a3121f";
const SIGNAL = "#ff4d00";
const FELT = "#08080b";

const SPADE =
  '<path d="M12 2C9 6.5 3.5 9.5 3.5 14a4.5 4.5 0 0 0 7.6 3.2c-.3 2-1.1 3.6-2.6 4.8h7c-1.5-1.2-2.3-2.8-2.6-4.8A4.5 4.5 0 0 0 20.5 14C20.5 9.5 15 6.5 12 2z"/>';
const HEART =
  '<path d="M12 21.6C5.4 16.6 2.4 13 2.4 8.8A5 5 0 0 1 12 6.7a5 5 0 0 1 9.6 2.1c0 4.2-3 7.8-9.6 12.8z"/>';
const DIAMOND = '<path d="M12 1.6l8.6 10.4L12 22.4 3.4 12z"/>';
const CLUB =
  '<circle cx="12" cy="6.9" r="4.4"/><circle cx="6.5" cy="13.7" r="4.4"/><circle cx="17.5" cy="13.7" r="4.4"/><path d="M12 11.5c-.2 4.8-1.2 8-3.4 10.5h6.8c-2.2-2.5-3.2-5.7-3.4-10.5z"/>';
const chip = `<circle cx="12" cy="12" r="10.4"/><circle cx="12" cy="12" r="8.3" fill="none" stroke="${FELT}" stroke-width="3.4" stroke-dasharray="4.35 4.35"/><circle cx="12" cy="12" r="4.4" fill="none" stroke="${FELT}" stroke-width="1.5"/>`;
const die = (pips: [number, number][]) =>
  `<rect x="2.2" y="2.2" width="19.6" height="19.6" rx="4.2"/>${pips
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="${FELT}"/>`)
    .join("")}`;
const FIVE: [number, number][] = [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]];
const THREE: [number, number][] = [[7, 7], [12, 12], [17, 17]];
const SIX: [number, number][] = [[7, 6.6], [17, 6.6], [7, 12], [17, 12], [7, 17.4], [17, 17.4]];

const MARKS: { color: string; svg: string; size: number }[] = [
  { color: BONE, svg: SPADE, size: 1.1 },
  { color: SIGNAL, svg: chip, size: 0.95 },
  { color: OXBLOOD, svg: HEART, size: 1.05 },
  { color: BONE, svg: die(FIVE), size: 0.9 },
  { color: SIGNAL, svg: DIAMOND, size: 1 },
  { color: BONE, svg: CLUB, size: 1.1 },
  { color: OXBLOOD, svg: chip, size: 0.85 },
  { color: SIGNAL, svg: die(THREE), size: 0.95 },
  { color: BONE, svg: HEART, size: 0.9 },
  { color: OXBLOOD, svg: SPADE, size: 1 },
  { color: BONE, svg: chip, size: 0.9 },
  { color: SIGNAL, svg: die(SIX), size: 1 },
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
          ).toFixed(1)}deg) scale(${((1.1 - k * 0.4) * MARKS[i].size).toFixed(3)})`;
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
            <svg viewBox="0 0 24 24" fill={m.color} dangerouslySetInnerHTML={{ __html: m.svg }} />
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
