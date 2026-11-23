"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, useStage, motionOn, isSmall } from "@/lib/gsap";

const LINES = [
  "Design is a decision made visible.",
  "Code is how it stays true.",
  "No templates. No stock. No filler.",
  "One idea, built all the way through.",
];

const TAU = Math.PI * 2;
const frac = (v: number) => v - Math.floor(v);
const rnd = (n: number) => frac(Math.sin(n * 91.7 + 13.3) * 43758.5453);

/**
 * Chapter 2. A near-black field of thin oxblood threads drifting like disturbed
 * silk, with dust hanging at three depths. The threads are always in motion:
 * they never draw themselves on. The manifesto lights up word by word as you
 * scroll.
 */
export default function Manifesto() {
  const root = useRef<HTMLElement>(null);

  useStage(() => {
    const el = root.current!;
    const canvas = el.querySelector<HTMLCanvasElement>(".mf-canvas")!;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    const moving = motionOn();
    const small = isSmall();
    // Thin soft lines do not need retina resolution; this is the cheap way to 60fps.
    const dpr = small ? Math.min(window.devicePixelRatio || 1, 1.25) : 1;
    const THREADS = small ? 22 : 32;
    const DUST = small ? 46 : 90;
    let w = 0;
    let h = 0;
    let progress = 0;
    let mx = 0;
    let my = 0;
    let cx = 0;
    let cy = 0;

    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#060304";
      ctx.fillRect(0, 0, w, h);
      cx += (mx - cx) * 0.04;
      cy += (my - cy) * 0.04;

      // Threads: neighbours share most of their motion, so they move as cloth.
      const step = small ? 20 : 22;
      for (let i = 0; i < THREADS; i++) {
        const k = i / (THREADS - 1);
        const base = h * (0.04 + 0.92 * k) - progress * h * 0.12 + cy * 14;
        const phase = k * 2.6;
        ctx.beginPath();
        for (let x = -20; x <= w + 20; x += step) {
          const u = x / w;
          const y =
            base +
            Math.sin(u * 3.1 + t * 0.21 + phase) * h * 0.075 +
            Math.sin(u * 7.3 - t * 0.33 + phase * 1.9) * h * 0.028 +
            Math.sin(u * 1.4 + t * 0.12 + i * 0.37) * h * 0.06 +
            Math.sin(u * 17 + t * 0.5 + i * 2.1) * h * 0.004 +
            u * h * 0.1;
          if (x === -20) ctx.moveTo(x + cx * 10, y);
          else ctx.lineTo(x + cx * 10, y);
        }
        const bright = i % 7 === 3;
        ctx.lineWidth = bright ? 1.7 : 1.1;
        ctx.strokeStyle = bright
          ? "rgba(226,36,52,.8)"
          : i % 2
            ? "rgba(156,16,32,.78)"
            : "rgba(112,12,24,.9)";
        ctx.stroke();
      }

      // Dust at three depths: nearer motes are bigger, brighter and move more.
      for (let i = 0; i < DUST; i++) {
        const depth = 0.25 + (i % 3) * 0.375;
        const x = frac(rnd(i) + t * 0.004 * depth + cx * 0.02 * depth) * (w + 40) - 20;
        const y = frac(rnd(i + 50) - t * 0.006 * depth - progress * 0.55 * depth + cy * 0.02 * depth) * (h + 40) - 20;
        const size = 0.7 + depth * 1.9 * (0.6 + rnd(i + 80) * 0.6);
        const twinkle = 0.75 + 0.25 * Math.sin(t * 0.8 + i);
        ctx.fillStyle = `rgba(239,228,208,${(0.1 + depth * 0.42) * twinkle})`;
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, TAU);
        ctx.fill();
      }
    };

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      if (!moving) draw(8);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    if (!moving) return () => ro.disconnect();

    // Words light up with scroll.
    const words = gsap.utils.toArray<HTMLElement>(".mf-word", el);
    gsap
      .timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: el, start: "top 35%", end: "bottom bottom", scrub: 0.5 },
      })
      .fromTo(
        words,
        { opacity: 0.1, yPercent: 18 },
        { opacity: 1, yPercent: 0, duration: 0.12, stagger: 0.035, ease: "power2.out" }
      )
      .to({}, { duration: 0.16 });

    gsap.to([canvas, el.querySelector(".mf-lines")], {
      opacity: 0,
      ease: "none",
      scrollTrigger: { trigger: el, start: "bottom 145%", end: "bottom 104%", scrub: true },
    });

    let id = 0;
    let running = false;
    const t0 = performance.now();
    const loop = (now: number) => {
      draw((now - t0) / 1000 + 20);
      id = requestAnimationFrame(loop);
    };
    const run = (on: boolean) => {
      if (on === running) return;
      running = on;
      cancelAnimationFrame(id);
      if (on) id = requestAnimationFrame(loop);
    };
    const st = ScrollTrigger.create({
      trigger: el,
      start: "top bottom",
      end: "bottom top",
      onUpdate: (self) => (progress = self.progress),
      onToggle: (self) => run(self.isActive && !document.hidden),
    });
    run(st.isActive);
    const onVis = () => run(st.isActive && !document.hidden);
    document.addEventListener("visibilitychange", onVis);
    const onMove = (e: PointerEvent) => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      run(false);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
    };
  }, root);

  return (
    <section ref={root} className="manifesto">
      <div className="mf-stage">
        <canvas className="mf-canvas" aria-hidden="true" />
        <h2 className="mf-lines">
          {LINES.map((line) => (
            <span key={line} className="mf-line">
              {line.split(" ").map((word, i) => (
                <span key={i} className="mf-word">
                  {word}{" "}
                </span>
              ))}
            </span>
          ))}
        </h2>
      </div>
    </section>
  );
}
