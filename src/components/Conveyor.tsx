"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, useStage, scrollState, motionOn } from "@/lib/gsap";
import { objectArt, shapeArt } from "@/lib/art";

type Item =
  | { k: "swatch"; name: string; hex: string }
  | { k: "type"; glyph: string; font: "display" | "serif" | "sans"; label: string; bg: string; fg: string; css?: React.CSSProperties }
  | { k: "object"; shape: "capsule" | "arch" | "discs" | "orb"; name: string; bg: string }
  | { k: "shape"; shape: "burst" | "halves" | "squiggle" | "steps"; bg: string; fg: string };

const INK = "#0e0e0e";
const PAPER = "#f4f2ec";
const PINK = "#ff4fa3";
const SUN = "#ffd60a";
const EMBER = "#ff4a1c";
const MINT = "#7df2c0";

// Every object on the belt is drawn here in CSS and SVG. Nothing is for sale.
const BELTS: Item[][] = [
  [
    { k: "type", glyph: "Aa", font: "display", label: "Anybody, 900", bg: SUN, fg: INK },
    { k: "swatch", name: "Molten", hex: "#C4001D" },
    { k: "object", shape: "capsule", name: "Object 01", bg: PAPER },
    { k: "shape", shape: "burst", bg: INK, fg: PINK },
    { k: "type", glyph: "&", font: "serif", label: "Bodoni Moda, italic", bg: PAPER, fg: INK, css: { fontStyle: "italic" } },
    { k: "swatch", name: "Acid", hex: "#E6FF00" },
    { k: "object", shape: "discs", name: "Object 02", bg: PINK },
    { k: "shape", shape: "halves", bg: PAPER, fg: EMBER },
  ],
  [
    { k: "shape", shape: "squiggle", bg: MINT, fg: INK },
    { k: "type", glyph: "7", font: "serif", label: "Bodoni Moda, 900", bg: EMBER, fg: INK, css: { fontWeight: 900 } },
    { k: "swatch", name: "Velvet black", hex: "#0B0406" },
    { k: "object", shape: "arch", name: "Object 03", bg: SUN },
    { k: "type", glyph: "Rg", font: "sans", label: "Schibsted Grotesk", bg: INK, fg: PAPER },
    { k: "swatch", name: "Cobalt", hex: "#1C2BFF" },
    { k: "shape", shape: "steps", bg: PINK, fg: INK },
    { k: "object", shape: "orb", name: "Object 04", bg: PAPER },
  ],
  [
    { k: "swatch", name: "Ember", hex: "#FF4A1C" },
    { k: "type", glyph: "?!", font: "display", label: "Anybody, condensed", bg: PINK, fg: INK, css: { fontVariationSettings: '"wdth" 50' } },
    { k: "shape", shape: "halves", bg: INK, fg: SUN },
    { k: "object", shape: "capsule", name: "Object 05", bg: MINT },
    { k: "swatch", name: "Paper", hex: "#EFEFEA" },
    { k: "type", glyph: "g", font: "serif", label: "Bodoni Moda, regular", bg: SUN, fg: INK },
    { k: "object", shape: "discs", name: "Object 06", bg: PAPER },
    { k: "shape", shape: "burst", bg: MINT, fg: EMBER },
  ],
];

function Card({ item }: { item: Item }) {
  let body: React.ReactNode;
  let style: React.CSSProperties = {};
  if (item.k === "swatch") {
    body = (
      <>
        <span className="sw-chip" style={{ background: item.hex }} />
        <span className="item-label">
          <b>{item.name}</b>
          <span>{item.hex}</span>
        </span>
      </>
    );
  } else if (item.k === "type") {
    style = { background: item.bg, color: item.fg };
    body = (
      <>
        <span className={`glyph glyph-${item.font}`} style={item.css}>{item.glyph}</span>
        <span className="item-label">
          <span>{item.label}</span>
        </span>
      </>
    );
  } else if (item.k === "object") {
    style = { background: item.bg };
    body = (
      <>
        <span className="art" dangerouslySetInnerHTML={{ __html: objectArt(item.shape) }} />
        <span className="item-label">
          <b>{item.name}</b>
          <span>Not for sale</span>
        </span>
      </>
    );
  } else {
    style = { background: item.bg };
    body = (
      <span
        className="art art-full"
        dangerouslySetInnerHTML={{ __html: shapeArt(item.shape, item.fg) }}
      />
    );
  }
  return (
    <li className={`item item-${item.k}`} data-cursor>
      <div className="item-in" style={style}>
        {body}
      </div>
    </li>
  );
}

export default function Conveyor() {
  const root = useRef<HTMLElement>(null);

  useStage(
    () => {
      if (!motionOn()) return;
      const el = root.current!;
      // The belt loops by following each set of cards with a copy of itself.
      // The copy is cloned here rather than rendered, so it costs nothing at load.
      el.querySelectorAll(".belt-set[data-copy]").forEach((old) => old.remove());
      el.querySelectorAll<HTMLElement>(".belt-set").forEach((set) => {
        const copy = set.cloneNode(true) as HTMLElement;
        copy.setAttribute("aria-hidden", "true");
        copy.dataset.copy = "";
        set.after(copy);
      });
      const belts = gsap.utils.toArray<HTMLElement>(".belt", el).map((belt, i) => ({
        track: belt.querySelector<HTMLElement>(".belt-track")!,
        floor: belt.querySelector<HTMLElement>(".belt-floor")!,
        dir: i % 2 ? -1 : 1,
        pace: [1, 1.35, 0.8][i] ?? 1,
        half: 1,
        x: 0,
        speed: 0,
        slow: 1,
      }));

      const measure = () => {
        belts.forEach((b) => {
          const gap = parseFloat(getComputedStyle(b.track).columnGap) || 0;
          b.half = (b.track.scrollWidth + gap) / 2;
        });
      };
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(el);

      // Hovering a belt eases it down so the card under the cursor can be read.
      const cleanups: (() => void)[] = [];
      gsap.utils.toArray<HTMLElement>(".belt", el).forEach((belt, i) => {
        const enter = () => (belts[i].slow = 0.18);
        const leave = () => (belts[i].slow = 1);
        belt.addEventListener("pointerenter", enter);
        belt.addEventListener("pointerleave", leave);
        cleanups.push(() => {
          belt.removeEventListener("pointerenter", enter);
          belt.removeEventListener("pointerleave", leave);
        });
      });

      // Cards tilt toward the cursor.
      gsap.utils.toArray<HTMLElement>(".item", el).forEach((item) => {
        const inner = item.firstElementChild as HTMLElement;
        const move = (e: PointerEvent) => {
          if (e.pointerType === "touch") return;
          const r = item.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          inner.style.setProperty("--ry", `${(px * 26).toFixed(1)}deg`);
          inner.style.setProperty("--rx", `${(-py * 22).toFixed(1)}deg`);
        };
        const leave = () => {
          inner.style.setProperty("--ry", "0deg");
          inner.style.setProperty("--rx", "0deg");
        };
        item.addEventListener("pointermove", move);
        item.addEventListener("pointerleave", leave);
        cleanups.push(() => {
          item.removeEventListener("pointermove", move);
          item.removeEventListener("pointerleave", leave);
        });
      });

      let active = false;
      ScrollTrigger.create({
        trigger: el,
        start: "top bottom",
        end: "bottom top",
        onToggle: (self) => (active = self.isActive),
      });

      const tick = (_t: number, deltaMs: number) => {
        if (!active) return;
        const dt = Math.min(deltaMs, 50) / 1000;
        const vel = scrollState.velocity;
        belts.forEach((b) => {
          const target =
            b.dir * (scrollState.direction * 70 * b.pace + vel * 0.55) * b.slow;
          b.speed += (target - b.speed) * 0.08;
          b.x = gsap.utils.wrap(-b.half, 0, b.x - b.speed * dt);
          b.track.style.transform = `translate3d(${b.x.toFixed(2)}px,0,0)`;
          b.floor.style.transform = `translate3d(${(b.x % 56).toFixed(2)}px,0,0)`;
        });
      };
      gsap.ticker.add(tick);

      return () => {
        gsap.ticker.remove(tick);
        ro.disconnect();
        cleanups.forEach((fn) => fn());
      };
    },
    root
  );

  return (
    <section ref={root} className="conveyor" data-chapter="3" data-name="The conveyor">
      <div className="conveyor-head">
        <h2>Everything on this belt was drawn in code.</h2>
        <p>
          Scroll to speed it up. Scroll back to run it in reverse. Hover a card
          and it leans toward you.
        </p>
      </div>
      <div className="belts">
        {BELTS.map((items, b) => (
          <div key={b} className={`belt belt-${b + 1}`}>
            <span className="belt-floor" aria-hidden="true" />
            <div className="belt-track">
              <ul className="belt-set">
                {items.map((item, i) => (
                  <Card key={i} item={item} />
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
