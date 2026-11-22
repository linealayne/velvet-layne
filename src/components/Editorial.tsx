"use client";

import { useRef } from "react";
import { gsap, useStage, motionOn } from "@/lib/gsap";

const INK = "#0e0e0e";
const RED = "#e3120b";
const PAPER = "#efefea";
const BLUE = "#1c2bff";

/** Four abstract plates, composed as SVG. No photographs anywhere. */
function Plate({ n }: { n: number }) {
  if (n === 1)
    return (
      <svg viewBox="0 0 400 500" role="img" aria-label="Plate 1: a black disc set off-centre on a red field, ringed by fine white circles" preserveAspectRatio="xMidYMid slice">
        <rect width="400" height="500" fill={RED} />
        <circle cx="250" cy="300" r="170" fill={INK} />
        {[60, 100, 140, 180, 220, 260].map((r) => (
          <circle key={r} cx="130" cy="170" r={r} fill="none" stroke={PAPER} strokeWidth="1.2" />
        ))}
        <circle cx="130" cy="170" r="20" fill={PAPER} />
      </svg>
    );
  if (n === 2)
    return (
      <svg viewBox="0 0 400 500" role="img" aria-label="Plate 2: a halftone grid of pale dots growing larger toward one corner of a black field" preserveAspectRatio="xMidYMid slice">
        <rect width="400" height="500" fill={INK} />
        {Array.from({ length: 12 }, (_, y) =>
          Array.from({ length: 10 }, (_, x) => (
            <circle
              key={`${x}-${y}`}
              cx={20 + x * 40}
              cy={30 + y * 40}
              r={1.5 + ((x + (11 - y)) / 20) ** 1.8 * 19}
              fill={x === 7 && y === 3 ? RED : PAPER}
            />
          ))
        )}
      </svg>
    );
  if (n === 3)
    return (
      <svg viewBox="0 0 400 500" role="img" aria-label="Plate 3: half discs in red, black and blue stacked like a totem" preserveAspectRatio="xMidYMid slice">
        <rect width="400" height="500" fill="#dcdcd4" />
        <path d="M60 170a140 140 0 0 1 280 0z" fill={RED} />
        <path d="M60 170a140 140 0 0 0 280 0z" fill={INK} />
        <path d="M60 450a140 140 0 0 1 280 0z" fill={BLUE} />
        <rect x="60" y="450" width="280" height="6" fill={INK} />
      </svg>
    );
  return (
    <svg viewBox="0 0 400 500" role="img" aria-label="Plate 4: diagonal black stripes cut by a large quarter circle that fades from red to orange" preserveAspectRatio="xMidYMid slice">
      <defs>
        <pattern id="pl-stripes" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
          <rect width="14" height="28" fill={INK} />
        </pattern>
        <linearGradient id="pl-fade" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={RED} />
          <stop offset="1" stopColor="#ff8a1c" />
        </linearGradient>
      </defs>
      <rect width="400" height="500" fill={PAPER} />
      <rect width="400" height="500" fill="url(#pl-stripes)" />
      <path d="M0 500V140a360 360 0 0 1 360 360z" fill="url(#pl-fade)" />
    </svg>
  );
}

const STEPS = [
  {
    title: "Start with the grid.",
    text: "Twelve columns and one baseline go in before a single word does. Everything that follows has somewhere to stand.",
    caption: "Plate 1. Circles, offset.",
  },
  {
    title: "Choose two voices.",
    text: "A serif to speak and a grotesk to explain. Two typefaces make a conversation. Five make a crowd.",
    caption: "Plate 2. Halftone, hand-plotted.",
  },
  {
    title: "Let the numbers be big.",
    text: "Scale is the cheapest drama there is. A numeral the size of a door tells you where you are without being asked.",
    caption: "Plate 3. Half discs, stacked.",
  },
  {
    title: "Leave room.",
    text: "White space is not empty. It is the pause that lets the next thing land.",
    caption: "Plate 4. Stripes and a quarter turn.",
  },
];

const REVEAL_FROM = [
  "inset(100% 0% 0% 0%)",
  "inset(0% 100% 0% 0%)",
  "inset(0% 0% 100% 0%)",
  "inset(0% 0% 0% 100%)",
];

export default function Editorial() {
  const root = useRef<HTMLElement>(null);

  useStage(
    () => {
      if (!motionOn()) return;

      gsap.from(".ed-title .line > span", {
        yPercent: 110,
        duration: 1.2,
        ease: "expo.out",
        stagger: 0.09,
        scrollTrigger: { trigger: ".ed-title", start: "top 82%", once: true },
      });

      gsap.utils.toArray<HTMLElement>(".plate").forEach((plate, i) => {
        const tl = gsap.timeline({
          scrollTrigger: { trigger: plate, start: "top 82%", once: true },
        });
        tl.fromTo(
          plate,
          { clipPath: REVEAL_FROM[i % 4] },
          { clipPath: "inset(0% 0% 0% 0%)", duration: 1.5, ease: "expo.inOut" }
        ).fromTo(
          plate.querySelector("svg"),
          { scale: 1.35 },
          { scale: 1, duration: 1.9, ease: "expo.out" },
          0.1
        );
      });

      gsap.utils.toArray<HTMLElement>(".ed-num").forEach((num) => {
        gsap.fromTo(
          num,
          { yPercent: 14 },
          {
            yPercent: -14,
            ease: "none",
            scrollTrigger: { trigger: num, start: "top bottom", end: "bottom top", scrub: true },
          }
        );
      });
    },
    root,
    4
  );

  return (
    <section ref={root} className="editorial" data-chapter="4" data-name="Editorial">
      <div className="ed-grid ed-mast">
        <span>Velvet Layne</span>
        <span>Notes on order</span>
        <span>Chapter four</span>
      </div>

      <div className="ed-grid ed-open">
        <h2 className="ed-title">
          <span className="line"><span>Order is a</span></span>
          <span className="line"><span>form of</span></span>
          <span className="line"><span>generosity.</span></span>
        </h2>
        <p className="ed-lede">
          The loud chapters get the attention. This one does the work. Four
          steps, in the order they happen, for laying out a page that reads
          itself to you.
        </p>
      </div>

      <ol className="ed-steps">
        {STEPS.map((step, i) => (
          <li key={step.title} className={`ed-grid ed-step ed-step-${i + 1}`}>
            <span className="ed-num" aria-hidden="true">{i + 1}</span>
            <div className="ed-copy">
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
            <figure className="ed-figure">
              <div className="plate">
                <Plate n={i + 1} />
              </div>
              <figcaption>{step.caption}</figcaption>
            </figure>
          </li>
        ))}
      </ol>
    </section>
  );
}
