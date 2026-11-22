"use client";

import { useEffect, useRef } from "react";
import { gsap, motionOn, isCoarse } from "@/lib/gsap";

/**
 * One cursor for the whole show: a dot that sits exactly on the pointer and a
 * ring that trails it. Difference blending keeps it legible on every chapter.
 */
export default function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!motionOn() || isCoarse()) return;
    const d = dot.current!;
    const r = ring.current!;
    const root = document.documentElement;
    root.classList.add("has-cursor");

    const dx = gsap.quickSetter(d, "x", "px");
    const dy = gsap.quickSetter(d, "y", "px");
    const rx = gsap.quickTo(r, "x", { duration: 0.45, ease: "power3" });
    const ry = gsap.quickTo(r, "y", { duration: 0.45, ease: "power3" });
    let shown = false;

    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      dx(e.clientX);
      dy(e.clientY);
      rx(e.clientX);
      ry(e.clientY);
      if (!shown) {
        shown = true;
        gsap.to([d, r], { opacity: 1, duration: 0.3 });
      }
      const hot = (e.target as Element | null)?.closest?.(
        "a, button, [data-cursor]"
      );
      r.classList.toggle("is-hot", !!hot);
    };
    const leave = () => {
      shown = false;
      gsap.to([d, r], { opacity: 0, duration: 0.2 });
    };
    const down = () => r.classList.add("is-down");
    const up = () => r.classList.remove("is-down");

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down, { passive: true });
    window.addEventListener("pointerup", up, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      root.classList.remove("has-cursor");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <div aria-hidden="true">
      <div ref={ring} className="cursor-ring" />
      <div ref={dot} className="cursor-dot" />
    </div>
  );
}
