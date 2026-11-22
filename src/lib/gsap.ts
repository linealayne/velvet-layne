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
 * Like useGSAP, but the setup runs in its own task a moment after hydration.
 * Each chapter gets a different slot so start-up work is spread out instead of
 * landing in one long task. Selectors are scoped to the given element; everything is
 * reverted on unmount.
 */
export function useStage(
  setup: () => void | (() => void),
  scope: RefObject<HTMLElement | null>,
  order = 1
) {
  const saved = useRef(setup);
  useEffect(() => {
    let ctx: gsap.Context | undefined;
    let cleanup: void | (() => void);
    const id = window.setTimeout(() => {
      ctx = gsap.context(() => {
        cleanup = saved.current();
      }, scope.current ?? undefined);
    }, 45 * order);
    return () => {
      window.clearTimeout(id);
      if (cleanup) cleanup();
      ctx?.revert();
    };
  }, [scope, order]);
}
