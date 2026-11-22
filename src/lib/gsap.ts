"use client";

import { useEffect, useRef, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export { gsap, ScrollTrigger, useGSAP };

/** Shared scroll telemetry, written by SmoothScroll and read by the chapters. */
export const scrollState = { velocity: 0, direction: 1 };

/** Motion is on only when the inline script in layout.tsx added `anim` to <html>. */
export const motionOn = () =>
  typeof document !== "undefined" &&
  document.documentElement.classList.contains("anim");

export const isCoarse = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(hover: none), (pointer: coarse)").matches;

export const isSmall = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(max-width: 820px)").matches;

/**
 * Like useGSAP, but the setup is deferred so start-up work never lands in one
 * long task:
 *   "near" (default) runs when the element comes within about a screen of the
 *          viewport. Chapters below the fold use content-visibility, and
 *          measuring inside them early would force the browser to lay them out
 *          at load, which is exactly the work we are trying to postpone.
 *   "soon" runs in its own task right after hydration (for the first screen).
 * Selectors are scoped to the element; everything is reverted on unmount.
 */
export function useStage(
  setup: () => void | (() => void),
  scope: RefObject<HTMLElement | null>,
  when: "near" | "soon" = "near"
) {
  const saved = useRef(setup);
  useEffect(() => {
    const el = scope.current;
    if (!el) return;
    let ctx: gsap.Context | undefined;
    let cleanup: void | (() => void);
    let timer = 0;
    let io: IntersectionObserver | undefined;
    const run = () => {
      ctx = gsap.context(() => {
        cleanup = saved.current();
      }, el);
    };
    if (when === "soon") {
      timer = window.setTimeout(run, 30);
    } else {
      io = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          io?.disconnect();
          timer = window.setTimeout(run, 0);
        },
        { rootMargin: "130% 0px" }
      );
      io.observe(el);
    }
    return () => {
      io?.disconnect();
      window.clearTimeout(timer);
      if (cleanup) cleanup();
      ctx?.revert();
    };
  }, [scope, when]);
}
