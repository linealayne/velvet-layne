/// <reference lib="webworker" />
/**
 * Runs the hero letter engine off the main thread. The page transfers one
 * OffscreenCanvas per letter the first time that letter is used, then only
 * sends small messages: size, on, off, clear.
 */
import { createEngine, type Engine, type EngineOptions } from "./letterEngine";

export type ToWorker =
  | { type: "init"; options: EngineOptions }
  | { type: "add"; i: number; canvas: OffscreenCanvas; d: string; gw: number; gh: number }
  | { type: "size"; i: number; w: number; h: number; dpr: number }
  | { type: "on" | "off" | "clear"; i: number }
  | { type: "warm" };

export type FromWorker = { type: "idle"; i: number };

let engine: Engine | null = null;

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  if (m.type === "init") {
    engine = createEngine(m.options, (i) => {
      const out: FromWorker = { type: "idle", i };
      (self as DedicatedWorkerGlobalScope).postMessage(out);
    });
    return;
  }
  if (!engine) return;
  if (m.type === "add") engine.add(m.i, m.canvas, m.d, m.gw, m.gh);
  else if (m.type === "size") engine.size(m.i, m.w, m.h, m.dpr);
  else if (m.type === "on") engine.on(m.i);
  else if (m.type === "off") engine.off(m.i);
  else if (m.type === "clear") engine.clear(m.i);
  else if (m.type === "warm") engine.warm();
};
