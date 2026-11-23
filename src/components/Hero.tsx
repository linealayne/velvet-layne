"use client";

import { useRef } from "react";
import ColorField, { type FieldState } from "./ColorField";
import { gsap, useStage, motionOn, isCoarse } from "@/lib/gsap";
import { VELVET, LAYNE, type Glyph } from "@/lib/glyphs";
import { LETTER_SCENES, warmChrome, type Scene } from "@/lib/scenes";

const ALL: Glyph[] = [...VELVET, ...LAYNE];
const BONE = "#efe4d0";
const WIPE = 0.25; // seconds for the diagonal slice
const HOLD = 500; // ms a scene lingers after the cursor leaves

type Letter = {
  el: HTMLElement;
  inner: HTMLElement;
  glyph: Glyph;
  path: Path2D;
  scene: Scene | null;
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  phase: 0 | 1 | 2 | 3 | 4; // idle, wiping in, on, holding, wiping out
  pin: number;
  pout: number;
  holdUntil: number;
  t0: number;
  w: number;
  h: number;
  dpr: number;
  wanted: boolean;
};

function Line({ glyphs, start, delay }: { glyphs: Glyph[]; start: number; delay: number }) {
  return (
    <>
      {glyphs.map((g, i) => (
        <span
          key={i}
          className="lt"
          data-scene={LETTER_SCENES[start + i].name}
          style={
            { flexGrow: g.w, "--d": (delay + i * 0.07).toFixed(2) } as React.CSSProperties
          }
        >
          <span className="lt-in">
            <svg viewBox={`0 0 ${g.w} ${g.h}`} preserveAspectRatio="none" focusable="false">
              <path d={g.d} />
            </svg>
          </span>
        </span>
      ))}
    </>
  );
}

/**
 * Chapter 1. Two things on screen: the name and the scroll cue.
 * Each of the eleven letters is a window: hover it and a looping scene cuts in,
 * clipped to the letterform. Scrolling parts the name like a curtain, lets the
 * colour field bloom through its hues, then cools it to black for the Manifesto.
 */
export default function Hero() {
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<FieldState>({ bloom: 0, hue: 0, mx: 0.5, my: 0.5 });

  useStage(
    () => {
      const el = root.current!;
      const moving = motionOn();
      const coarse = isCoarse();
      const state = field.current;
      const cleanups: (() => void)[] = [];
      let locked = false;

      /* ── The letters ── */
      const letters: Letter[] = Array.from(el.querySelectorAll<HTMLElement>(".lt")).map((node, i) => ({
        el: node,
        inner: node.firstElementChild as HTMLElement,
        glyph: ALL[i],
        path: new Path2D(ALL[i].d),
        scene: null,
        canvas: null,
        ctx: null,
        phase: 0,
        pin: 0,
        pout: 0,
        holdUntil: 0,
        t0: 0,
        w: 0,
        h: 0,
        dpr: 1,
        wanted: false,
      }));

      const fit = (L: Letter) => {
        if (!L.canvas) return;
        L.w = L.inner.clientWidth;
        L.h = L.inner.clientHeight;
        L.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        L.canvas.width = Math.max(1, Math.round(L.w * L.dpr));
        L.canvas.height = Math.max(1, Math.round(L.h * L.dpr));
      };

      const paint = (L: Letter, now: number) => {
        const { ctx, canvas, w, h, dpr, glyph } = L;
        if (!ctx || !canvas || !L.scene || !w) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        // Clip to the letterform, stretched to this letter's box.
        ctx.setTransform((dpr * w) / glyph.w, 0, 0, (dpr * h) / glyph.h, 0, 0);
        ctx.clip(L.path);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = BONE;
        ctx.fillRect(0, 0, w, h);
        // The diagonal slice: the scene lives between two slanted edges.
        const slant = h * 0.3;
        const ease = (p: number) => 1 - Math.pow(1 - p, 3);
        const a = -slant + (w + 2 * slant) * ease(L.pin);
        const b = -slant + (w + 2 * slant) * ease(L.pout);
        ctx.beginPath();
        ctx.moveTo(b + slant, -2);
        ctx.lineTo(a + slant, -2);
        ctx.lineTo(a - slant, h + 2);
        ctx.lineTo(b - slant, h + 2);
        ctx.closePath();
        ctx.clip();
        const t = moving ? (now - L.t0) / 1000 : L.scene.still;
        L.scene.draw(ctx, w, h, t);
        ctx.restore();
        // A hairline in the letter colour keeps the silhouette when a scene is dark.
        ctx.save();
        ctx.setTransform((dpr * w) / glyph.w, 0, 0, (dpr * h) / glyph.h, 0, 0);
        ctx.lineWidth = (2.4 * glyph.w) / w;
        ctx.strokeStyle = BONE;
        ctx.stroke(L.path);
        ctx.restore();
      };

      const clear = (L: Letter) => {
        L.phase = 0;
        L.el.classList.remove("is-on");
        if (L.ctx && L.canvas) {
          L.ctx.setTransform(1, 0, 0, 1, 0, 0);
          L.ctx.clearRect(0, 0, L.canvas.width, L.canvas.height);
        }
      };

      let raf = 0;
      let last = 0;
      const tick = (now: number) => {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        let live = 0;
        for (const L of letters) {
          if (L.phase === 0) continue;
          if (L.phase === 1) {
            L.pin += dt / WIPE;
            if (L.pin >= 1) {
              L.pin = 1;
              L.phase = 2;
            }
          } else if (L.phase === 2) {
            if (!L.wanted) {
              L.phase = 3;
              L.holdUntil = now + HOLD;
            }
          } else if (L.phase === 3) {
            if (L.wanted) L.phase = 2;
            else if (now >= L.holdUntil) L.phase = 4;
          } else if (L.phase === 4) {
            L.pout += dt / WIPE;
            if (L.pout >= 1) {
              clear(L);
              continue;
            }
          }
          live++;
          paint(L, now);
        }
        raf = live ? requestAnimationFrame(tick) : 0;
      };

      const activate = (L: Letter) => {
        if (locked) return;
        L.wanted = true;
        if (!L.canvas) {
          L.canvas = document.createElement("canvas");
          L.canvas.className = "lt-scene";
          L.ctx = L.canvas.getContext("2d");
          L.inner.appendChild(L.canvas);
          L.scene = LETTER_SCENES[letters.indexOf(L)].make();
        }
        if (L.phase === 3) {
          L.phase = 2;
          return;
        }
        if (L.phase === 1 || L.phase === 2) return;
        fit(L);
        if (!L.t0) L.t0 = performance.now();
        L.el.classList.add("is-on");
        if (!moving) {
          // Reduced motion: one still frame, no wipe, no loop.
          L.pin = 1;
          L.pout = 0;
          L.phase = 2;
          paint(L, 0);
          return;
        }
        L.pin = 0;
        L.pout = 0;
        L.phase = 1;
        L.el.classList.remove("kick");
        void L.el.offsetWidth;
        L.el.classList.add("kick");
        if (!raf) {
          last = performance.now();
          raf = requestAnimationFrame(tick);
        }
      };

      const release = (L: Letter) => {
        L.wanted = false;
        if (!moving) clear(L);
      };

      const releaseAll = () => letters.forEach(release);

      letters.forEach((L) => {
        const enter = (e: PointerEvent) => {
          if (e.pointerType !== "touch") activate(L);
        };
        const leave = (e: PointerEvent) => {
          if (e.pointerType !== "touch") release(L);
        };
        const tap = (e: PointerEvent) => {
          if (e.pointerType !== "touch") return;
          activate(L);
          window.setTimeout(() => release(L), 1900);
        };
        L.el.addEventListener("pointerenter", enter);
        L.el.addEventListener("pointerleave", leave);
        L.el.addEventListener("pointerdown", tap);
        cleanups.push(() => {
          L.el.removeEventListener("pointerenter", enter);
          L.el.removeEventListener("pointerleave", leave);
          L.el.removeEventListener("pointerdown", tap);
        });
      });

      const ro = new ResizeObserver(() => {
        letters.forEach((L) => {
          if (L.phase === 0) return;
          fit(L);
          if (!moving) paint(L, 0);
        });
      });
      ro.observe(el.querySelector(".name")!);
      cleanups.push(() => ro.disconnect());

      // Compile the chrome shader while nothing else is happening.
      const warm = window.setTimeout(warmChrome, 1800);
      cleanups.push(() => window.clearTimeout(warm));

      // Touch screens have no hover, so the letters take turns on their own.
      if (coarse && moving) {
        let bag: number[] = [];
        let previous = -1;
        const next = () => {
          if (locked || document.hidden) return;
          if (!bag.length) {
            bag = letters.map((_, i) => i).sort(() => Math.random() - 0.5);
            if (bag[bag.length - 1] === previous) bag.reverse();
          }
          previous = bag.pop()!;
          const L = letters[previous];
          activate(L);
          window.setTimeout(() => release(L), 1500);
        };
        const first = window.setTimeout(next, 3200);
        const id = window.setInterval(next, 2300);
        cleanups.push(() => {
          window.clearTimeout(first);
          window.clearInterval(id);
        });
      }

      /* ── Scroll: curtain, bloom, hue swing, cool-down ── */
      if (moving) {
        gsap
          .timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: ".intro",
              start: "top top",
              end: "bottom bottom",
              scrub: 0.4,
              onUpdate: (self) => {
                const p = self.progress;
                state.hue = -0.95 * Math.sin(gsap.utils.clamp(0, 1, (p - 0.1) / 0.8) * Math.PI * 2);
                const lock = p > 0.025;
                if (lock !== locked) {
                  locked = lock;
                  if (lock) releaseAll();
                }
              },
            },
          })
          .to(".cue-wrap", { opacity: 0, duration: 0.05 }, 0.005)
          .to(".name-velvet", { xPercent: -46, duration: 0.42, ease: "power2.in" }, 0.02)
          .to(".name-layne", { xPercent: 46, duration: 0.42, ease: "power2.in" }, 0.02)
          .to(".name-scale", { scale: 1.6, duration: 0.42, ease: "power2.in" }, 0.02)
          .to(".name-scale", { opacity: 0, duration: 0.2 }, 0.25)
          .to(state, { bloom: 1, duration: 0.4, ease: "power1.inOut" }, 0)
          .to(".field-shade", { opacity: 1, duration: 0.24, ease: "power1.in" }, 0.76);

        const onMove = (e: PointerEvent) => {
          state.mx = e.clientX / window.innerWidth;
          state.my = 1 - e.clientY / window.innerHeight;
        };
        window.addEventListener("pointermove", onMove, { passive: true });
        cleanups.push(() => window.removeEventListener("pointermove", onMove));
      }

      return () => {
        cancelAnimationFrame(raf);
        cleanups.forEach((fn) => fn());
        letters.forEach((L) => L.canvas?.remove());
      };
    },
    root,
    "soon"
  );

  return (
    <div ref={root} className="hero" id="top">
      <div className="field" aria-hidden="true">
        <ColorField state={field} />
        <div className="grain" />
        <div className="field-shade" />
      </div>

      <section className="intro">
        <div className="intro-stage">
          <div className="intro-black" aria-hidden="true" />
          <div className="name-scale">
            <h1 className="name">
              <span className="sr-only">Velvet Layne</span>
              <span className="name-line name-velvet" aria-hidden="true">
                <Line glyphs={VELVET} start={0} delay={0.2} />
              </span>
              <span className="name-line name-layne" aria-hidden="true">
                <Line glyphs={LAYNE} start={VELVET.length} delay={0.75} />
              </span>
            </h1>
          </div>
          <div className="cue-wrap" aria-hidden="true">
            <p className="cue">
              {"SCROLL".split("").map((c, i) => (
                <span key={i} style={{ "--i": i } as React.CSSProperties}>
                  {c}
                </span>
              ))}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
