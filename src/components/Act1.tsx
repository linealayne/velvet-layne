"use client";

import { useRef } from "react";
import ColorField, { type FieldState } from "./ColorField";
import Bridge from "./Bridge";
import {
  gsap,
  ScrollTrigger,
  useGSAP,
  scrollState,
  motionOn,
  isCoarse,
  isSmall,
} from "@/lib/gsap";

const LINES = [
  "Color has a pulse",
  "Type has a temper",
  "Nothing here sits still",
];

function Letters({ text, delay }: { text: string; delay?: number }) {
  return (
    <>
      {text.split("").map((c, i) => (
        <span
          key={i}
          className="ch"
          style={
            delay === undefined
              ? undefined
              : ({
                  "--d": (delay + i * 0.07).toFixed(2),
                } as React.CSSProperties)
          }
        >
          {c}
        </span>
      ))}
    </>
  );
}

function Words({ text }: { text: string }) {
  return (
    <>
      {text.split(" ").map((word, i) => (
        <span key={i} className="word">
          <Letters text={word} />
        </span>
      ))}
    </>
  );
}

/**
 * Chapters 1 and 2 share one colour field, so they live in one component:
 * the name, then the field blooming open, then the type that reacts to you.
 */
export default function Act1() {
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<FieldState>({ bloom: 0, hue: 0, mx: 0.5, my: 0.5 });

  useGSAP(
    () => {
      if (!motionOn()) return;
      const state = field.current;
      const coarse = isCoarse();
      const small = isSmall();

      // 1. The name arrives with CSS keyframes (see globals.css) so it does not
      //    wait for JavaScript. GSAP takes over from the first scroll.

      // 2. Scroll: the name parts like a curtain and the field blooms open.
      gsap
        .timeline({
          defaults: { ease: "power2.in" },
          scrollTrigger: {
            trigger: ".intro",
            start: "top top",
            end: "bottom bottom",
            scrub: 0.4,
          },
        })
        .to(".intro-meta", { opacity: 0, duration: 0.25, ease: "none" }, 0)
        .to(".name-velvet", { xPercent: -42, duration: 1 }, 0)
        .to(".name-layne", { xPercent: 42, duration: 1 }, 0)
        .to(".name-scale", { scale: 1.7, duration: 1 }, 0)
        .to(".name-scale", { opacity: 0, duration: 0.5, ease: "none" }, 0.5)
        .to(state, { bloom: 1, duration: 1, ease: "power1.inOut" }, 0);

      // 3. Living colour: hue swings as you travel through the chapter.
      ScrollTrigger.create({
        trigger: ".living",
        start: "top bottom",
        end: "bottom top",
        onUpdate: (self) => {
          state.hue = -0.95 * Math.sin(self.progress * Math.PI * 2);
        },
      });

      const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      const onMove = (e: PointerEvent) => {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        state.mx = e.clientX / window.innerWidth;
        state.my = 1 - e.clientY / window.innerHeight;
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      // 4. Type that reacts: weight follows scroll position, width follows the
      //    cursor (or a slow travelling wave on touch screens).
      const lines = gsap.utils.toArray<HTMLElement>(".lline").map((el) => {
        const chars = Array.from(el.querySelectorAll<HTMLElement>(".ch"));
        return {
          el,
          inner: el.querySelector<HTMLElement>(".lline-in")!,
          chars,
          last: chars.map(() => ""),
        };
      });
      const wMin = small ? 62 : 80;
      const wMax = small ? 104 : 150;
      let active = false;
      ScrollTrigger.create({
        trigger: ".living",
        start: "top bottom",
        end: "bottom top",
        onToggle: (self) => (active = self.isActive),
      });

      const tick = (time: number) => {
        if (!active) return;
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        const vel = scrollState.velocity;
        const stretch = 1 + Math.min(Math.abs(vel) / 2800, 0.5);
        const skew = gsap.utils.clamp(-12, 12, vel / 170);
        const cx = coarse
          ? vw * (0.5 + 0.45 * Math.sin(time * 0.9))
          : pointer.x;
        const cy = coarse ? vh * 0.5 : pointer.y;
        const radius = Math.max(190, vw * 0.26);

        // Read everything first, then write, so layout is computed once.
        const reads = lines.map((line) => {
          const rect = line.el.getBoundingClientRect();
          if (rect.bottom < -80 || rect.top > vh + 80) return null;
          return {
            mid: (rect.top + rect.height / 2) / vh,
            rects: line.chars.map((c) => c.getBoundingClientRect()),
          };
        });
        lines.forEach((line, n) => {
          const read = reads[n];
          if (!read) return;
          const off = Math.min(Math.abs(read.mid - 0.5) * 2, 1);
          const base = 860 - 600 * off;
          line.inner.style.transform = `skewX(${(-skew).toFixed(2)}deg) scaleY(${stretch.toFixed(3)})`;
          line.chars.forEach((c, i) => {
            const r = read.rects[i];
            const d = Math.hypot(
              r.left + r.width / 2 - cx,
              r.top + r.height / 2 - cy,
            );
            const fall = Math.max(0, 1 - d / radius) ** 1.5;
            const wdth = Math.round(wMin + (wMax - wMin) * fall);
            const wght = Math.round((base + (900 - base) * fall) / 10) * 10;
            const v = `"wght" ${wght}, "wdth" ${wdth}`;
            if (v !== line.last[i]) {
              line.last[i] = v;
              c.style.fontVariationSettings = v;
            }
          });
        });
      };
      gsap.ticker.add(tick);

      return () => {
        gsap.ticker.remove(tick);
        window.removeEventListener("pointermove", onMove);
      };
    },
    { scope: root },
  );

  return (
    <div ref={root} className="act1" id="top">
      <div className="field" aria-hidden="true">
        <ColorField state={field} />
        <div className="grain" />
      </div>

      <section className="intro" data-chapter="1" data-name="The name">
        <div className="intro-stage">
          <div className="intro-black" aria-hidden="true" />
          <div className="name-scale">
            <h1 className="name" aria-label="Velvet Layne">
              <span className="name-line name-velvet" aria-hidden="true">
                <Letters text="VELVET" delay={0.2} />
              </span>
              <span className="name-line name-layne" aria-hidden="true">
                <Letters text="LAYNE" delay={0.85} />
              </span>
            </h1>
          </div>
          <div className="intro-meta">
            <p className="tagline">A design showcase by Layne · Linea</p>
            <p className="cue" aria-hidden="true">
              <span className="cue-line" />
              Scroll
            </p>
          </div>
        </div>
      </section>

      <section className="living" data-chapter="2" data-name="Living color">
        <h2 className="sr-only">Living color</h2>
        {LINES.map((text, i) => (
          <p key={text} className={`lline lline-${i + 1}`}>
            <span className="sr-only">{text}</span>
            <span className="lline-in" aria-hidden="true">
              <Words text={text} />
            </span>
          </p>
        ))}
        <p className="living-note">
          Move through the letters. Scroll faster. From here down the style
          changes completely with every chapter, and all of it was designed and
          built for this page.
        </p>
      </section>

      <Bridge variant="sweep" index={3} title="The conveyor" />
    </div>
  );
}
