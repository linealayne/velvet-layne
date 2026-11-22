"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, useGSAP, scrollState, motionOn } from "@/lib/gsap";

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

function ObjectArt({ shape }: { shape: string }) {
  switch (shape) {
    case "capsule":
      return (
        <svg viewBox="0 0 120 150" aria-hidden="true">
          <rect x="38" y="14" width="44" height="18" rx="4" fill={INK} />
          <rect x="24" y="34" width="72" height="104" rx="30" fill={EMBER} />
          <rect x="24" y="74" width="72" height="26" fill={INK} />
          <rect x="34" y="46" width="8" height="22" rx="4" fill="#fff" opacity=".55" />
        </svg>
      );
    case "arch":
      return (
        <svg viewBox="0 0 120 150" aria-hidden="true">
          <path d="M14 140V72a46 46 0 0 1 92 0v68H78V72a18 18 0 0 0-36 0v68z" fill="#1c2bff" />
          <circle cx="60" cy="118" r="14" fill={INK} />
        </svg>
      );
    case "discs":
      return (
        <svg viewBox="0 0 120 150" aria-hidden="true">
          <ellipse cx="60" cy="118" rx="46" ry="14" fill={INK} />
          <ellipse cx="60" cy="92" rx="38" ry="12" fill="#1c2bff" />
          <ellipse cx="60" cy="68" rx="30" ry="10" fill={SUN} />
          <ellipse cx="60" cy="46" rx="22" ry="8" fill={EMBER} />
          <circle cx="60" cy="24" r="9" fill={INK} />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 120 150" aria-hidden="true">
          <defs>
            <radialGradient id="orb-g" cx="35%" cy="30%" r="75%">
              <stop offset="0" stopColor="#ffd60a" />
              <stop offset=".55" stopColor="#ff4a1c" />
              <stop offset="1" stopColor="#7a0016" />
            </radialGradient>
          </defs>
          <circle cx="60" cy="70" r="44" fill="url(#orb-g)" />
          <rect x="22" y="126" width="76" height="8" fill={INK} />
        </svg>
      );
  }
}

function ShapeArt({ shape, fg }: { shape: string; fg: string }) {
  switch (shape) {
    case "burst":
      return (
        <svg viewBox="0 0 120 120" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <rect key={i} x="56" y="6" width="8" height="108" rx="4" fill={fg} transform={`rotate(${i * 15} 60 60)`} />
          ))}
        </svg>
      );
    case "halves":
      return (
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <path d="M10 44a50 34 0 0 1 100 0z" fill={fg} />
          <path d="M10 82a50 34 0 0 1 100 0z" fill={fg} opacity=".7" />
          <path d="M10 118a50 34 0 0 1 100 0z" fill={fg} opacity=".4" />
        </svg>
      );
    case "squiggle":
      return (
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <path
            d="M8 30c17-22 35 22 52 0s35 22 52 0M8 62c17-22 35 22 52 0s35 22 52 0M8 94c17-22 35 22 52 0s35 22 52 0"
            fill="none"
            stroke={fg}
            strokeWidth="9"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <path d="M10 110V80h25V55h25V30h25V10h25v100z" fill={fg} />
        </svg>
      );
  }
}

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
        <span className="art">
          <ObjectArt shape={item.shape} />
        </span>
        <span className="item-label">
          <b>{item.name}</b>
          <span>Not for sale</span>
        </span>
      </>
    );
  } else {
    style = { background: item.bg };
    body = (
      <span className="art art-full">
        <ShapeArt shape={item.shape} fg={item.fg} />
      </span>
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

  useGSAP(
    () => {
      if (!motionOn()) return;
      const el = root.current!;
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
    { scope: root }
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
              <ul className="belt-set belt-copy" aria-hidden="true">
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
