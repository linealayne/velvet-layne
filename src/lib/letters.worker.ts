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

export type FromWorker = { type: "idle" | "lit"; i: number } | { type: "ready" } | { type: "warm"; ms: number };

let engine: Engine | null = null;

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  if (m.type === "init") {
    const post = (out: FromWorker) => (self as DedicatedWorkerGlobalScope).postMessage(out);
    engine = createEngine(
      m.options,
      (i) => post({ type: "idle", i }),
      (i) => post({ type: "lit", i }),
      (ms) => post({ type: "warm", ms })
    );
    // Tell the page the engine is alive. If this never arrives, the page
    // falls back to running the engine itself.
    (self as DedicatedWorkerGlobalScope).postMessage({ type: "ready" } satisfies FromWorker);
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
