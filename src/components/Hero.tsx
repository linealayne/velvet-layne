"use client";

import { useRef } from "react";
import ColorField, { type FieldState } from "./ColorField";
import { gsap, useStage, motionOn, isCoarse, isSmall } from "@/lib/gsap";
import { VELVET, LAYNE, type Glyph } from "@/lib/glyphs";
import { LETTER_SCENES } from "@/lib/scenes";
import type { Engine, EngineOptions } from "@/lib/letterEngine";
import type { FromWorker, ToWorker } from "@/lib/letters.worker";
import { firstInput } from "@/lib/gate";

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
            { "--g": g.w, "--d": (delay + i * 0.07).toFixed(2) } as React.CSSProperties
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
 * colour field bloom through its hues, then cools it as the Manifesto's velvet
 * settles over it.
 *
 * The scenes are drawn by `lib/letterEngine.ts` onto one small canvas per
 * letter, clipped to the letter's outline with Path2D. Where the engine runs:
 *  - WebKit (every iPhone browser, and Safari): on the main thread, on plain
 *    canvases. This is the path verified in WebKit. Offscreen canvases in
 *    workers are too unreliable there, and when that path fails it fails
 *    silently, which is what left the letters dead on phones.
 *  - Everything else: in a Web Worker on offscreen canvases, so the scenes
 *    cost the main thread nothing. If the worker does not report in, or
 *    throws, the page switches to the main-thread engine.
 * The solid SVG letter is never hidden. The scene canvas sits on top of it, so
 * whatever happens a letter can never go blank.
 */
export default function Hero() {
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<FieldState>({ bloom: 0, hue: 0, mx: 0.5, my: 0.5, cool: 0 });

  useStage(
    () => {
      const el = root.current!;
      const moving = motionOn();
      const coarse = isCoarse();
      const small = isSmall();
      const state = field.current;
      const cleanups: (() => void)[] = [];
      const options: EngineOptions = { moving, coarse };
      let locked = false;

      const nodes = Array.from(el.querySelectorAll<HTMLElement>(".lt"));
      const inner = nodes.map((n) => n.firstElementChild as HTMLElement);
      const canvases: (HTMLCanvasElement | undefined)[] = [];
      const lit = nodes.map(() => false);

      /* ── The engine: a worker where possible, the main thread otherwise ── */
      // GestureEvent exists only in WebKit.
      const webkit = "GestureEvent" in window;
      const canTransfer =
        !webkit &&
        typeof Worker !== "undefined" &&
        "transferControlToOffscreen" in HTMLCanvasElement.prototype;
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

      // The engine has put a scene on screen in answer to an `on`. Counted on
      // the letter itself, so a test (scripts/hover.mjs) can check that every
      // single hover is answered.
      const shown = (i: number) => {
        nodes[i].dataset.lit = String(Number(nodes[i].dataset.lit || 0) + 1);
        // Only now does the letter react: it opens (on phones) and gets its
        // kick as the scene cuts in. Before this the kick played on a hover
        // whether or not there was a scene to go with it, and for the first
        // seconds after a load there was not.
        if (nodes[i].classList.contains("is-on")) return;
        nodes[i].classList.add("is-on");
        if (moving) {
          nodes[i].classList.remove("kick");
          void nodes[i].offsetWidth;
          nodes[i].classList.add("kick");
        }
      };

      // Every letter's scene is compiled. `ms` is how long that took from
      // the moment it was asked for (read by scripts/cold.mjs-style tests).
      let warmed = false;
      const onWarmed: (() => void)[] = [];
      const warmDone = (ms: number) => {
        document.documentElement.dataset.letters = String(ms);
        warmed = true;
        onWarmed.forEach((fn) => fn());
      };

      const loadLocal = () =>
        (localLoading ??= import("@/lib/letterEngine").then(({ createEngine }) => {
          local = createEngine(options, idle, shown, warmDone);
        }));

      // The worker failed or never answered: drop it and run the engine here.
      let watchdog = 0;
      const abandonWorker = async () => {
        if (!worker) return;
        window.clearTimeout(watchdog);
        worker.terminate();
        worker = null;
        canvases.forEach((c, i) => {
          c?.remove();
          canvases[i] = undefined;
          nodes[i].classList.remove("is-on");
        });
        await loadLocal();
        lit.forEach((on, i) => {
          if (on) {
            lit[i] = false;
            activate(i);
          }
        });
      };

      const boot = () => {
        if (worker || local) return null;
        if (localLoading) return localLoading;
        if (canTransfer) {
          try {
            worker = new Worker(new URL("../lib/letters.worker.ts", import.meta.url), { type: "module" });
            worker.onmessage = (e: MessageEvent<FromWorker>) => {
              if (e.data.type === "ready") window.clearTimeout(watchdog);
              else if (e.data.type === "lit") shown(e.data.i);
              else if (e.data.type === "warm") warmDone(e.data.ms);
              else idle(e.data.i);
            };
            worker.onerror = () => void abandonWorker();
            watchdog = window.setTimeout(() => void abandonWorker(), 2500);
            worker.postMessage({ type: "init", options } satisfies ToWorker);
            return null;
          } catch {
            worker = null;
          }
        }
        return loadLocal();
      };

      // On phones a lit letter opens wider (see `.lt.is-on` in globals.css) so
      // its scene can actually be seen. The canvas is sized for that final
      // width up front, so the scene is right from its first frame.
      const WIDE = 2.6;
      const sizeOf = (i: number) => {
        let w = inner[i].clientWidth;
        if (small) {
          const row = nodes[i].parentElement!;
          const mates = nodes.filter((n) => n.parentElement === row);
          const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
          const sum = mates.reduce((a, n) => a + ALL[nodes.indexOf(n)].w, 0);
          const g = ALL[i].w;
          w = ((row.clientWidth - gap * (mates.length - 1)) * g * WIDE) / (sum - g + g * WIDE);
        }
        return {
          w: Math.round(w),
          h: inner[i].clientHeight,
          dpr: Math.min(window.devicePixelRatio || 1, coarse ? 2 : 1.5),
        };
      };

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
        // The engine answers with `lit` when the scene is really on screen
        // (at once if its shader is ready, otherwise the moment it is, as long
        // as the letter is still wanted). The letter's own reaction waits for
        // that: see `shown`.
        if (!nodes[i].classList.contains("is-on")) send({ type: "size", i, ...sizeOf(i) });
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
        // A pointer that was already resting on the letter when the page
        // woke up never "enters" it: the first move counts too.
        const move = (e: PointerEvent) => {
          if (e.pointerType !== "touch" && !lit[i]) activate(i);
        };
        node.addEventListener("pointermove", move);
        node.addEventListener("pointerenter", enter);
        node.addEventListener("pointerleave", leave);
        node.addEventListener("pointerdown", tap);
        cleanups.push(() => {
          node.removeEventListener("pointermove", move);
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

      // Start the engine and compile every letter's shader straight away, so
      // the scenes are ready before most people have moved the mouse. (This
      // used to wait two seconds and then compile them one after another.)
      let stopped = false;
      cleanups.push(() => {
        stopped = true;
      });
      (async () => {
        const pending = boot();
        if (pending) await pending;
        if (!stopped) send({ type: "warm" });
      })();

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
        // The letters only start taking turns once their scenes are ready
        // (and not before the name has arrived).
        let first = 0;
        let id = 0;
        const born = performance.now();
        const begin = () => {
          first = window.setTimeout(() => {
            next();
            id = window.setInterval(next, 2300);
          }, Math.max(0, 3200 - (performance.now() - born)));
        };
        if (warmed) begin();
        else onWarmed.push(begin);
        cleanups.push(() => {
          window.clearTimeout(first);
          window.clearInterval(id);
        });
      }

      /* ── Scroll: curtain, bloom, hue swing, cool-down ──
         Built at the visitor's first input, not at load. */
      let gone = false;
      cleanups.push(() => {
        gone = true;
      });
      const scrollSetup = () => {
        if (gone || !moving) return;
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
                state.hue = -0.95 * Math.sin(gsap.utils.clamp(0, 1, (p - 0.08) / 0.5) * Math.PI * 2);
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
          // The molten field slows and darkens as it cools. The velvet settles
          // over it from Manifesto.tsx, which overlaps this stage: one
          // continuous change of material, no black frame and no hard edge.
          .to(state, { cool: 1, duration: 0.4, ease: "power1.inOut" }, 0.34)
          .to(".field-shade", { opacity: 0.6, duration: 0.45, ease: "power1.inOut" }, 0.36);

        const onMove = (e: PointerEvent) => {
          state.mx = e.clientX / window.innerWidth;
          state.my = 1 - e.clientY / window.innerHeight;
        };
        window.addEventListener("pointermove", onMove, { passive: true });
        cleanups.push(() => window.removeEventListener("pointermove", onMove));
      };
      firstInput.then(scrollSetup);

      return () => {
        cleanups.forEach((fn) => fn());
        window.clearTimeout(watchdog);
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
