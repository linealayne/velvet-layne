"use client";

import { useRef } from "react";
import ColorField, { type FieldState } from "./ColorField";
import { gsap, useStage, motionOn, isCoarse } from "@/lib/gsap";
import { VELVET, LAYNE, type Glyph } from "@/lib/glyphs";
import { LETTER_SCENES } from "@/lib/scenes";
import type { Engine, EngineOptions } from "@/lib/letterEngine";
import type { FromWorker, ToWorker } from "@/lib/letters.worker";

const ALL: Glyph[] = [...VELVET, ...LAYNE];

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
 *
 * The scenes are drawn by `lib/letterEngine.ts`. Normally that runs in a Web
 * Worker on offscreen canvases, so letters cost the main thread nothing, lit
 * or not. This component only sends "on" and "off".
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
      const options: EngineOptions = { moving, coarse };
      let locked = false;

      const nodes = Array.from(el.querySelectorAll<HTMLElement>(".lt"));
      const inner = nodes.map((n) => n.firstElementChild as HTMLElement);
      const canvases: (HTMLCanvasElement | undefined)[] = [];
      const lit = nodes.map(() => false);

      /* ── The engine: a worker where possible, the main thread otherwise ── */
      const canTransfer =
        typeof Worker !== "undefined" && "transferControlToOffscreen" in HTMLCanvasElement.prototype;
      let worker: Worker | null = null;
      let local: Engine | null = null;
      let localLoading: Promise<void> | null = null;

      const send = (m: ToWorker, transfer?: Transferable[]) => {
        if (worker) return worker.postMessage(m, transfer ?? []);
        if (!local) return;
        if (m.type === "add") local.add(m.i, m.canvas, m.d, m.gw, m.gh);
        else if (m.type === "size") local.size(m.i, m.w, m.h, m.dpr);
        else if (m.type === "on") local.on(m.i);
        else if (m.type === "off") local.off(m.i);
        else if (m.type === "clear") local.clear(m.i);
        else if (m.type === "warm") local.warm();
      };

      // The scene has wiped out and left a plain letter: show the SVG again.
      const idle = (i: number) => {
        if (lit[i]) return; // re-lit in the meantime
        nodes[i].classList.remove("is-on");
        send({ type: "clear", i });
      };

      const boot = () => {
        if (worker || local) return null;
        if (localLoading) return localLoading;
        if (canTransfer) {
          try {
            worker = new Worker(new URL("../lib/letters.worker.ts", import.meta.url), { type: "module" });
            worker.onmessage = (e: MessageEvent<FromWorker>) => idle(e.data.i);
            worker.postMessage({ type: "init", options } satisfies ToWorker);
            return null;
          } catch {
            worker = null;
          }
        }
        localLoading = import("@/lib/letterEngine").then(({ createEngine }) => {
          local = createEngine(options, idle);
        });
        return localLoading;
      };

      const sizeOf = (i: number) => ({
        w: inner[i].clientWidth,
        h: inner[i].clientHeight,
        dpr: Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.5),
      });

      const ensure = (i: number) => {
        if (canvases[i]) return;
        const canvas = document.createElement("canvas");
        canvas.className = "lt-scene";
        inner[i].appendChild(canvas);
        canvases[i] = canvas;
        const g = ALL[i];
        if (worker) {
          const off = canvas.transferControlToOffscreen();
          send({ type: "add", i, canvas: off, d: g.d, gw: g.w, gh: g.h }, [off]);
        } else {
          // Main-thread fallback: the engine accepts a normal canvas too.
          local?.add(i, canvas, g.d, g.w, g.h);
        }
      };

      const activate = async (i: number) => {
        if (locked) return;
        lit[i] = true;
        const pending = boot();
        if (pending) await pending;
        if (!lit[i] || locked) return;
        ensure(i);
        if (!nodes[i].classList.contains("is-on")) {
          send({ type: "size", i, ...sizeOf(i) });
          nodes[i].classList.add("is-on");
          if (moving) {
            nodes[i].classList.remove("kick");
            void nodes[i].offsetWidth;
            nodes[i].classList.add("kick");
          }
        }
        send({ type: "on", i });
      };

      const release = (i: number) => {
        if (!lit[i]) return;
        lit[i] = false;
        send({ type: "off", i });
      };
      const releaseAll = () => nodes.forEach((_, i) => release(i));

      nodes.forEach((node, i) => {
        const enter = (e: PointerEvent) => {
          if (e.pointerType !== "touch") activate(i);
        };
        const leave = (e: PointerEvent) => {
          if (e.pointerType !== "touch") release(i);
        };
        const tap = (e: PointerEvent) => {
          if (e.pointerType !== "touch") return;
          activate(i);
          window.setTimeout(() => release(i), 1900);
        };
        node.addEventListener("pointerenter", enter);
        node.addEventListener("pointerleave", leave);
        node.addEventListener("pointerdown", tap);
        cleanups.push(() => {
          node.removeEventListener("pointerenter", enter);
          node.removeEventListener("pointerleave", leave);
          node.removeEventListener("pointerdown", tap);
        });
      });

      const ro = new ResizeObserver(() => {
        canvases.forEach((c, i) => {
          if (c && nodes[i].classList.contains("is-on")) send({ type: "size", i, ...sizeOf(i) });
        });
      });
      ro.observe(el.querySelector(".name")!);
      cleanups.push(() => ro.disconnect());

      // With a mouse: start the worker and compile the chrome shader ahead of
      // the first hover, once the page has settled.
      if (!coarse) {
        const warm = window.setTimeout(async () => {
          const pending = boot();
          if (pending) await pending;
          send({ type: "warm" });
        }, 2200);
        cleanups.push(() => window.clearTimeout(warm));
      }

      // Touch screens have no hover, so the letters take turns on their own.
      if (coarse && moving) {
        let bag: number[] = [];
        let previous = -1;
        const next = () => {
          if (locked || document.hidden) return;
          if (!bag.length) {
            bag = nodes.map((_, i) => i).sort(() => Math.random() - 0.5);
            if (bag[bag.length - 1] === previous) bag.reverse();
          }
          previous = bag.pop()!;
          const i = previous;
          activate(i);
          window.setTimeout(() => release(i), 1500);
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
        cleanups.forEach((fn) => fn());
        worker?.terminate();
        canvases.forEach((c) => c?.remove());
        nodes.forEach((n) => n.classList.remove("is-on", "kick"));
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
