"use client";

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
