"use client";

import { useEffect, useRef } from "react";
import { ScrollTrigger } from "@/lib/gsap";

const TOTAL = 7;

/** The one fixed element: a wordmark and a chapter counter that tracks scroll. */
export default function Hud() {
  const num = useRef<HTMLSpanElement>(null);
  const name = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const triggers = Array.from(
      document.querySelectorAll<HTMLElement>("[data-chapter]")
    ).map((el) =>
      ScrollTrigger.create({
        trigger: el,
        start: "top 55%",
        end: "bottom 55%",
        onToggle: (self) => {
          if (!self.isActive) return;
          if (num.current) num.current.textContent = el.dataset.chapter ?? "1";
          if (name.current) name.current.textContent = el.dataset.name ?? "";
        },
      })
    );
    const progress = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        if (bar.current)
          bar.current.style.transform = `scaleX(${self.progress.toFixed(4)})`;
      },
    });
    return () => {
      triggers.forEach((t) => t.kill());
      progress.kill();
    };
  }, []);

  return (
    <header className="hud">
      <a className="hud-mark" href="#top" aria-label="Velvet Layne, back to top">
        Velvet Layne
      </a>
      <p className="hud-chapter" aria-hidden="true">
        <span ref={num}>1</span>
        <span className="hud-of">/ {TOTAL}</span>
        <span ref={name} className="hud-name">
          The name
        </span>
      </p>
      <span ref={bar} className="hud-bar" aria-hidden="true" />
    </header>
  );
}
