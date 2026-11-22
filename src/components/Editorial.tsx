"use client";

import { useRef } from "react";
import { gsap, useStage, motionOn } from "@/lib/gsap";
import { plateArt } from "@/lib/art";

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
    root
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
              <div className="plate" dangerouslySetInnerHTML={{ __html: plateArt(i + 1) }} />
              <figcaption>{step.caption}</figcaption>
            </figure>
          </li>
        ))}
      </ol>
    </section>
  );
}
