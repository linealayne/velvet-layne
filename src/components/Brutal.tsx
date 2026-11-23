"use client";

import { useRef, useState } from "react";
import { ScrollTrigger, useStage, motionOn } from "@/lib/gsap";

const NOT_USED = [
  "A page builder",
  "Stock photos",
  "Fake clients",
  "Someone else's layout",
  "A safe choice",
];

const MARQUEE = ["Raw type", "Hard edges", "No apology", "Loud on purpose"];

function Glitch({ children }: { children: string }) {
  return (
    <span className="glitch" data-text={children}>
      {children}
    </span>
  );
}

export default function Brutal() {
  const root = useRef<HTMLElement>(null);
  const [pressed, setPressed] = useState(false);

  useStage(
    () => {
      if (!motionOn()) return;
      const el = root.current!;
      // Marquee and sticker only run while the chapter is on screen.
      ScrollTrigger.create({
        trigger: el,
        start: "top bottom",
        end: "bottom top",
        toggleClass: "is-live",
      });
      // Each glitch target fires once as it scrolls in, so touch screens see it too.
      const fired = new WeakSet<HTMLElement>();
      ScrollTrigger.batch(el.querySelectorAll(".glitch"), {
        start: "top 78%",
        // Not `once: true` (see Editorial.tsx): each target is remembered instead.
        onEnter: (targets) =>
          targets.forEach((t, i) => {
            const node = t as HTMLElement;
            if (fired.has(node)) return;
            fired.add(node);
            window.setTimeout(() => {
              node.classList.add("is-glitching");
              window.setTimeout(() => node.classList.remove("is-glitching"), 650);
            }, i * 110);
          }),
      });
    },
    root
  );

  return (
    <section
      ref={root}
      className={pressed ? "brutal is-inverted" : "brutal"}
    >
      <p className="br-side" aria-hidden="true">
        Loud on purpose / Loud on purpose / Loud on purpose
      </p>

      <h2 className="br-title">
        <Glitch>Pretty</Glitch> <span className="br-box">is not</span>{" "}
        <Glitch>the point.</Glitch>
      </h2>

      <div className="br-row">
        <div className="br-block br-list">
          <h3>Not used on this page</h3>
          <ul>
            {NOT_USED.map((text) => (
              <li key={text} data-cursor>
                <Glitch>{text}</Glitch>
                <span className="br-x" aria-hidden="true">
                  ✕
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="br-block br-note">
          <p>
            Brutalism is honesty with the volume up. No rounded corners to
            hide behind. If something here looks wrong, it is wrong on
            purpose.
          </p>
          <button
            type="button"
            className="br-button"
            aria-pressed={pressed}
            onClick={() => setPressed((v) => !v)}
          >
            {pressed ? "Told you. Press again" : "Do not press"}
          </button>
        </div>

        <svg className="br-sticker" viewBox="0 0 200 200" aria-hidden="true">
          <circle cx="100" cy="100" r="100" />
          <path id="br-ring" d="M100 100m-74 0a74 74 0 1 1 148 0a74 74 0 1 1-148 0" fill="none" />
          <text>
            <textPath href="#br-ring" textLength="452" lengthAdjust="spacing">Made for this page only ✕ Made for this page only ✕</textPath>
          </text>
          <text className="br-sticker-mid" x="100" y="118" textAnchor="middle">
            VL
          </text>
        </svg>
      </div>

      <div className="br-marquee" aria-hidden="true">
        <div className="br-marquee-track">
          {[0, 1].map((n) => (
            <span key={n}>
              {MARQUEE.map((m) => (
                <span key={m}>
                  {m} <i>✕</i>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      <p className="br-huge" aria-hidden="true">
        NO.
      </p>
    </section>
  );
}
