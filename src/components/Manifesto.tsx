"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, scrollState, useStage, motionOn, isSmall, isCoarse } from "@/lib/gsap";

const LINES = [
  "Design is a decision made visible.",
  "Code is how it stays true.",
  "No templates. No stock. No filler.",
  "One idea, built all the way through.",
];

const TAU = Math.PI * 2;
const frac = (v: number) => v - Math.floor(v);
const rnd = (n: number) => frac(Math.sin(n * 91.7 + 13.3) * 43758.5453);

const POINTS = 150; // samples along each thread

type Thread = {
  /** Depth, 0.35 (far) to 1 (near): drives weight, opacity and parallax. */
  z: number;
  cx: number;
  cy: number;
  // Two harmonics per axis. Frequency pairs like 1:2 make figure-eights,
  // 2:3 makes loose loops, 1:1 with a phase gap makes a long S.
  ax: number;
  bx: number;
  ay: number;
  by: number;
  fx: number;
  gx: number;
  fy: number;
  gy: number;
  p: number[];
  w: number[];
  pulse: number;
  /** Per-point push away from the cursor, eased so it settles with a delay. */
  dx: Float32Array;
  dy: Float32Array;
  x: Float32Array;
  y: Float32Array;
};

function makeThread(i: number, n: number): Thread {
  const pairs = [
    [1, 2, 2, 1],
    [1, 1.5, 1.5, 0.5],
    [0.5, 1.5, 1, 2],
    [1, 3, 2, 1],
    [0.5, 1, 1, 1.5],
    [1.5, 0.5, 1, 2.5],
    [1, 2.5, 0.5, 1.5],
  ][i % 7];
  return {
    z: 0.35 + 0.65 * (i / Math.max(1, n - 1)),
    cx: 0.14 + 0.72 * rnd(i + 1),
    cy: 0.16 + 0.68 * rnd(i + 11),
    ax: 0.2 + 0.2 * rnd(i + 21),
    bx: 0.05 + 0.1 * rnd(i + 31),
    ay: 0.16 + 0.18 * rnd(i + 41),
    by: 0.05 + 0.1 * rnd(i + 51),
    fx: pairs[0],
    gx: pairs[1],
    fy: pairs[2],
    gy: pairs[3],
    p: [rnd(i + 61) * TAU, rnd(i + 71) * TAU, rnd(i + 81) * TAU, rnd(i + 91) * TAU],
    w: [
      0.05 + rnd(i + 101) * 0.05,
      0.035 + rnd(i + 111) * 0.05,
      0.045 + rnd(i + 121) * 0.05,
      0.03 + rnd(i + 131) * 0.05,
    ],
    pulse: rnd(i + 141),
    dx: new Float32Array(POINTS),
    dy: new Float32Array(POINTS),
    x: new Float32Array(POINTS),
    y: new Float32Array(POINTS),
  };
}

/**
 * Chapter 2. Mostly black. A handful of hairline oxblood threads hang in the
 * space at different depths, each wandering through loose loops and S-curves.
 * They are simply there, always drifting: nothing ever draws itself on. Now
 * and then a faint brighter pulse travels along one. The cursor parts the
 * threads near it and they settle back slowly; on touch screens they sway
 * lightly with the scroll instead. Dust hangs at three depths.
 * The manifesto lights up word by word as you scroll.
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
    const coarse = isCoarse();
    // Hairlines want real pixels. A few thin paths are cheap even at 2x.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const COUNT = small ? 5 : 7;
    const DUST = small ? 34 : 64;
    const threads = Array.from({ length: COUNT }, (_, i) => makeThread(i, COUNT));
    let w = 0;
    let h = 0;
    let progress = 0;
    // Cursor in canvas pixels, far away until it first moves.
    let mx = -9999;
    let my = -9999;
    let sway = 0;

    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#060304";
      ctx.fillRect(0, 0, w, h);
      const unit = Math.max(w, h);
      // Touch: the scroll leans the threads a little, and lets go slowly.
      sway += ((coarse ? gsap.utils.clamp(-1, 1, scrollState.velocity / 2400) : 0) - sway) * 0.05;
      const reach = Math.min(190, unit * 0.16);

      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const th of threads) {
        const ox = th.cx * w;
        const oy = th.cy * h - (progress - 0.5) * h * 0.22 * th.z;
        for (let k = 0; k < POINTS; k++) {
          const s = k / (POINTS - 1);
          const a = s * TAU;
          let x =
            ox +
            Math.sin(a * th.fx + th.p[0] + t * th.w[0]) * th.ax * unit +
            Math.sin(a * th.gx + th.p[1] - t * th.w[1]) * th.bx * unit;
          let y =
            oy +
            Math.cos(a * th.fy + th.p[2] + t * th.w[2]) * th.ay * unit +
            Math.sin(a * th.gy + th.p[3] - t * th.w[3]) * th.by * unit;
          y += sway * 26 * th.z * Math.sin(s * Math.PI);
          // Part around the cursor. The push is eased, so threads give way
          // softly and take a moment to settle once the cursor has gone.
          const vx = x - mx;
          const vy = y - my;
          const d = Math.hypot(vx, vy);
          let tx = 0;
          let ty = 0;
          if (d < reach && d > 0.001) {
            const f = (1 - d / reach) ** 2 * 30 * th.z;
            tx = (vx / d) * f;
            ty = (vy / d) * f;
          }
          th.dx[k] += (tx - th.dx[k]) * 0.07;
          th.dy[k] += (ty - th.dy[k]) * 0.07;
          x += th.dx[k];
          y += th.dy[k];
          th.x[k] = x;
          th.y[k] = y;
        }
        const path = (from: number, to: number) => {
          ctx.beginPath();
          ctx.moveTo(th.x[from], th.y[from]);
          for (let k = from + 1; k <= to; k++) ctx.lineTo(th.x[k], th.y[k]);
          ctx.stroke();
        };
        // The thread itself: hairline, low.
        ctx.lineWidth = 0.55 + th.z * 0.55;
        ctx.strokeStyle = `rgba(158,18,34,${(0.24 + th.z * 0.3).toFixed(3)})`;
        path(0, POINTS - 1);
        // An occasional brighter segment travelling along it.
        const cycle = frac(t * (0.018 + th.z * 0.012) + th.pulse);
        if (cycle < 0.55) {
          const head = (cycle / 0.55) * (POINTS + 30) - 15;
          const fade = Math.sin((cycle / 0.55) * Math.PI);
          for (const [len, alpha] of [
            [22, 0.16],
            [12, 0.26],
            [5, 0.42],
          ]) {
            const from = Math.max(0, Math.round(head - len));
            const to = Math.min(POINTS - 1, Math.round(head + len));
            if (to - from < 2) continue;
            ctx.strokeStyle = `rgba(236,58,58,${(alpha * fade * (0.5 + th.z * 0.5)).toFixed(3)})`;
            path(from, to);
          }
        }
      }

      // Dust at three depths: nearer motes are bigger, brighter and move more.
      for (let i = 0; i < DUST; i++) {
        const depth = 0.25 + (i % 3) * 0.375;
        const x = frac(rnd(i) + t * 0.004 * depth) * (w + 40) - 20;
        const y = frac(rnd(i + 50) - t * 0.006 * depth - progress * 0.55 * depth) * (h + 40) - 20;
        const size = 0.7 + depth * 1.9 * (0.6 + rnd(i + 80) * 0.6);
        const twinkle = 0.75 + 0.25 * Math.sin(t * 0.8 + i);
        ctx.fillStyle = `rgba(239,228,208,${(0.1 + depth * 0.4) * twinkle})`;
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
      if (!moving) draw(40);
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

    // Fade the stage out at the very end so the seam into the bridge is black on black.
    gsap.to([canvas, el.querySelector(".mf-lines")], {
      opacity: 0,
      ease: "none",
      scrollTrigger: { trigger: el, start: "bottom 145%", end: "bottom 104%", scrub: true },
    });

    let id = 0;
    let running = false;
    const t0 = performance.now();
    const loop = (now: number) => {
      draw((now - t0) / 1000 + 40);
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
      if (e.pointerType === "touch") return;
      const r = canvas.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
    };
    const onLeave = () => {
      mx = -9999;
      my = -9999;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      run(false);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
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
