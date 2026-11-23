/**
 * The hero letter engine: for each active letter, wipe a scene in on a
 * diagonal slice, loop it, hold it after release, wipe it out.
 *
 * It only talks to canvases and timers, so it runs unchanged in two places:
 * inside a Web Worker on an OffscreenCanvas (the normal path, which keeps all
 * scene drawing off the main thread) and on the main thread as a fallback for
 * browsers that cannot transfer a canvas.
 */
import { LETTER_SCENES, warmShader, type Ctx, type Scene } from "./scenes";

const BONE = "#efe4d0";
const WIPE = 0.25; // seconds for the diagonal slice
const HOLD = 500; // ms a scene lingers after release

export type EngineOptions = {
  /** false = reduced motion: one still frame, no wipe, no loop. */
  moving: boolean;
  /** Touch device: steady scenes repaint on every other frame. */
  coarse: boolean;
};

export type EngineCanvas = HTMLCanvasElement | OffscreenCanvas;

type Letter = {
  canvas: EngineCanvas;
  ctx: Ctx;
  path: Path2D;
  gw: number;
  gh: number;
  scene: Scene;
  phase: 0 | 1 | 2 | 3 | 4; // idle, wiping in, on, holding, wiping out
  pin: number;
  pout: number;
  holdUntil: number;
  t0: number;
  w: number;
  h: number;
  dpr: number;
  wanted: boolean;
  waiting: boolean;
};

const frame: (fn: (t: number) => void) => number =
  typeof requestAnimationFrame === "function"
    ? (fn) => requestAnimationFrame(fn)
    : (fn) => setTimeout(() => fn(performance.now()), 16) as unknown as number;

export function createEngine(options: EngineOptions, onIdle: (i: number) => void) {
  const { moving, coarse } = options;
  const letters: (Letter | undefined)[] = [];
  let running = false;
  let last = 0;
  let odd = false;

  const paint = (L: Letter, now: number) => {
    const { ctx, canvas, w, h, dpr } = L;
    if (!w || !h) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    // Clip to the letterform, stretched to this letter's box.
    ctx.setTransform((dpr * w) / L.gw, 0, 0, (dpr * h) / L.gh, 0, 0);
    ctx.clip(L.path);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BONE;
    ctx.fillRect(0, 0, w, h);
    if (L.phase !== 0) {
      // The diagonal slice: the scene lives between two slanted edges.
      const slant = h * 0.3;
      const ease = (p: number) => 1 - Math.pow(1 - p, 3);
      const a = -slant + (w + 2 * slant) * ease(L.pin);
      const b = -slant + (w + 2 * slant) * ease(L.pout);
      ctx.beginPath();
      ctx.moveTo(b + slant, -2);
      ctx.lineTo(a + slant, -2);
      ctx.lineTo(a - slant, h + 2);
      ctx.lineTo(b - slant, h + 2);
      ctx.closePath();
      ctx.clip();
      L.scene.draw(ctx, w, h, moving ? (now - L.t0) / 1000 : L.scene.still);
    }
    ctx.restore();
    // A hairline in the letter colour keeps the silhouette when a scene is dark.
    ctx.save();
    ctx.setTransform((dpr * w) / L.gw, 0, 0, (dpr * h) / L.gh, 0, 0);
    ctx.lineWidth = (2.4 * L.gw) / w;
    ctx.strokeStyle = BONE;
    ctx.stroke(L.path);
    ctx.restore();
  };

  const finish = (L: Letter, i: number, now: number) => {
    // Leave a plain solid letter in the canvas, then hand back to the page.
    L.phase = 0;
    paint(L, now);
    onIdle(i);
  };

  const tick = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    odd = !odd;
    let live = 0;
    letters.forEach((L, i) => {
      if (!L || L.phase === 0) return;
      if (L.phase === 1) {
        L.pin += dt / WIPE;
        if (L.pin >= 1) {
          L.pin = 1;
          L.phase = 2;
        }
      } else if (L.phase === 2) {
        if (!L.wanted) {
          L.phase = 3;
          L.holdUntil = now + HOLD;
        }
      } else if (L.phase === 3) {
        if (L.wanted) L.phase = 2;
        else if (now >= L.holdUntil) L.phase = 4;
      } else if (L.phase === 4) {
        L.pout += dt / WIPE;
        if (L.pout >= 1) {
          finish(L, i, now);
          return;
        }
      }
      live++;
      // On touch devices a steady scene repaints at half rate; wipes stay smooth.
      if (!coarse || odd || L.phase === 1 || L.phase === 4) paint(L, now);
    });
    if (live) frame(tick);
    else running = false;
  };

  return {
    add(i: number, canvas: EngineCanvas, d: string, gw: number, gh: number) {
      const ctx = canvas.getContext("2d") as Ctx | null;
      if (!ctx) return;
      letters[i] = {
        canvas,
        ctx,
        path: new Path2D(d),
        gw,
        gh,
        scene: LETTER_SCENES[i].make(),
        phase: 0,
        pin: 0,
        pout: 0,
        holdUntil: 0,
        t0: 0,
        w: 0,
        h: 0,
        dpr: 1,
        wanted: false,
        waiting: false,
      };
    },
    size(i: number, w: number, h: number, dpr: number) {
      const L = letters[i];
      if (!L) return;
      L.w = w;
      L.h = h;
      L.dpr = dpr;
      L.canvas.width = Math.max(1, Math.round(w * dpr));
      L.canvas.height = Math.max(1, Math.round(h * dpr));
      if (L.phase !== 0 && !moving) paint(L, 0);
    },
    on(i: number) {
      const L = letters[i];
      if (!L) return;
      L.wanted = true;
      if (L.phase === 3) L.phase = 2;
      if (L.phase !== 0) return;
      // The scene's shader may still be compiling. Wait for it: a letter must
      // show one scene for its whole activation, never a stand-in first.
      if (L.scene.ready && !L.scene.ready()) {
        if (!L.waiting) {
          L.waiting = true;
          const poll = () => {
            if (!L.wanted) return void (L.waiting = false);
            if (L.scene.ready && !L.scene.ready()) return void setTimeout(poll, 40);
            L.waiting = false;
            this.on(i);
          };
          setTimeout(poll, 40);
        }
        return;
      }
      const now = performance.now();
      if (!L.t0) L.t0 = now;
      if (!moving) {
        L.pin = 1;
        L.pout = 0;
        L.phase = 2;
        paint(L, now);
        return;
      }
      L.pin = 0;
      L.pout = 0;
      L.phase = 1;
      if (!running) {
        running = true;
        last = now;
        frame(tick);
      }
    },
    off(i: number) {
      const L = letters[i];
      if (!L) return;
      L.wanted = false;
      if (!moving && L.phase !== 0) finish(L, i, 0);
    },
    /** The page has shown its own letter again: empty the canvas. */
    clear(i: number) {
      const L = letters[i];
      if (!L || L.phase !== 0) return;
      L.ctx.setTransform(1, 0, 0, 1, 0, 0);
      L.ctx.clearRect(0, 0, L.canvas.width, L.canvas.height);
    },
    /** Compile the chrome shader ahead of the first hover. */
    warm() {
      warmShader();
    },
  };
}

export type Engine = ReturnType<typeof createEngine>;
