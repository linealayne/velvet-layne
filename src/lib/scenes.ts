/**
 * The eleven hero letter scenes. Every letter is a trailer for the show.
 *
 * Each scene is a small 2D-canvas drawing routine: draw(ctx, w, h, t) paints
 * the whole w × h box for time t (seconds). The hero clips the result to the
 * letterform. Two scenes (the chrome ones) are rendered by one shared WebGL
 * program and copied in, so the page never holds more than one extra GL
 * context no matter how many letters are lit.
 */

/** Scenes draw to a normal canvas or, inside the letter worker, an offscreen one. */
export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type Sheet = HTMLCanvasElement | OffscreenCanvas;

export type Scene = {
  draw: (ctx: Ctx, w: number, h: number, t: number) => void;
  /** A flattering moment to freeze on for reduced motion and for stills. */
  still: number;
};

const BONE = "#efe4d0";
const INK = "#0a0707";
const OXBLOOD = "#5c0a14";
const MOLTEN = "#c4001d";
const SIGNAL = "#ff4d00";
const CHROME = "#c9ced6";

const TAU = Math.PI * 2;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const frac = (v: number) => v - Math.floor(v);
/** Cheap deterministic pseudo-random, so scenes look the same on every visit. */
const rnd = (n: number) => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);
const outBack = (x: number) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};

function sheet(w: number, h: number): Sheet {
  const cw = Math.max(1, Math.round(w));
  const ch = Math.max(1, Math.round(h));
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(cw, ch);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  return canvas;
}

/** Draw something once and keep it: static parts of a scene are blitted, not redrawn. */
function cached(w: number, h: number, paint: (c: Ctx) => void) {
  const canvas = sheet(w, h);
  paint(canvas.getContext("2d") as Ctx);
  return canvas;
}

/* ───────── V: a spinning vinyl record, seen close ───────── */
function vinyl(): Scene {
  let key = "";
  let disc: Sheet | null = null;
  return {
    still: 1.3,
    draw(ctx, w, h, t) {
      const cx = w * 0.5;
      const cy = h * 0.66;
      const R = Math.hypot(w, h) * 0.8;
      if (key !== `${w}x${h}`) {
        key = `${w}x${h}`;
        // The grooves never change, so they are drawn once.
        disc = cached(w, h, (c) => {
          c.fillStyle = "#050404";
          c.fillRect(0, 0, w, h);
          c.lineWidth = 1.4;
          for (let r = R, i = 0; r > R * 0.24; r -= 3.2, i++) {
            c.strokeStyle = i % 7 === 0 ? "#050404" : i % 2 ? "#1d1a19" : "#121010";
            c.beginPath();
            c.arc(cx, cy, r, 0, TAU);
            c.stroke();
          }
        });
      }
      ctx.drawImage(disc!, 0, 0, w, h);
      // Light sliding across the grooves.
      if (ctx.createConicGradient) {
        const g = ctx.createConicGradient(t * 0.55, cx, cy);
        g.addColorStop(0, "rgba(255,236,214,0)");
        g.addColorStop(0.165, "rgba(255,236,214,0)");
        g.addColorStop(0.2, "rgba(255,236,214,.6)");
        g.addColorStop(0.235, "rgba(255,236,214,0)");
        g.addColorStop(0.665, "rgba(255,236,214,0)");
        g.addColorStop(0.7, "rgba(255,236,214,.42)");
        g.addColorStop(0.735, "rgba(255,236,214,0)");
        g.addColorStop(1, "rgba(255,236,214,0)");
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.globalCompositeOperation = "source-over";
      }
      // Dust riding the grooves shows the spin.
      const spin = t * 3.49;
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = "rgba(239,228,208,.55)";
      for (let i = 0; i < 9; i++) {
        const r = R * (0.3 + rnd(i) * 0.66);
        const a = spin + rnd(i + 20) * TAU;
        ctx.beginPath();
        ctx.arc(cx, cy, r, a, a + 0.035);
        ctx.stroke();
      }
      // Label.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(spin);
      ctx.fillStyle = MOLTEN;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.22, 0, TAU);
      ctx.fill();
      ctx.fillStyle = BONE;
      ctx.fillRect(-R * 0.15, -R * 0.1, R * 0.3, R * 0.022);
      ctx.fillRect(-R * 0.1, R * 0.07, R * 0.2, R * 0.014);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.022, 0, TAU);
      ctx.fill();
      ctx.restore();
    },
  };
}

/* ───────── E: a screen-print pull, three passes, off register ───────── */
function print(): Scene {
  let key = "";
  let layers: Sheet[] = [];
  const build = (w: number, h: number) => {
    const step = Math.max(9, Math.round(Math.min(w, h) / 15));
    const shapes = [
      (x: number, y: number) => clamp01(1.5 - Math.hypot(x - 0.5, (y - 0.34) * (h / w)) * 2.1),
      (x: number, y: number) => (y > 0.42 ? clamp01(0.45 + 0.6 * Math.sin((x + y * (h / w)) * 6)) : 0),
      (x: number, y: number) => (y > 0.6 && frac(y * 5.5) < 0.45 ? 0.95 : 0),
    ];
    const colors = [MOLTEN, SIGNAL, INK];
    layers = shapes.map((shape, k) =>
      cached(w, h, (c) => {
        c.fillStyle = colors[k];
        for (let y = step / 2; y < h; y += step) {
          for (let x = step / 2; x < w; x += step) {
            const v = shape(x / w, y / h);
            if (v <= 0.04) continue;
            c.beginPath();
            c.arc(x, y, step * 0.62 * Math.sqrt(v), 0, TAU);
            c.fill();
          }
        }
      })
    );
  };
  return {
    still: 3.3,
    draw(ctx, w, h, t) {
      if (key !== `${w}x${h}`) {
        key = `${w}x${h}`;
        build(w, h);
      }
      ctx.fillStyle = "#e6d8bd";
      ctx.fillRect(0, 0, w, h);
      const loop = t % 4.4;
      const off = [
        [-0.03, 0.012],
        [0.024, -0.018],
        [0, 0],
      ];
      ctx.globalCompositeOperation = "multiply";
      let bar = -1;
      layers.forEach((layer, k) => {
        const p = clamp01((loop - k * 1.05) / 0.85);
        if (p <= 0) return;
        const edge = p * (2 - p) * w * 1.05;
        if (p < 1) bar = edge;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, edge, h);
        ctx.clip();
        ctx.drawImage(layer, off[k][0] * w, off[k][1] * h, w, h);
        ctx.restore();
      });
      ctx.globalCompositeOperation = "source-over";
      if (bar >= 0) {
        ctx.fillStyle = "#17110f";
        ctx.fillRect(bar - 7, 0, 9, h);
        ctx.fillStyle = "rgba(255,255,255,.35)";
        ctx.fillRect(bar - 7, 0, 2, h);
      }
    },
  };
}

/* ───────── E: the Manifesto thread field, sped up ───────── */
function threads(): Scene {
  return {
    still: 2,
    draw(ctx, w, h, t) {
      ctx.fillStyle = "#070304";
      ctx.fillRect(0, 0, w, h);
      const n = 16;
      for (let i = 0; i < n; i++) {
        const base = h * ((i + 0.5) / n);
        ctx.beginPath();
        for (let x = -10; x <= w + 10; x += 9) {
          const y =
            base +
            Math.sin(x * 0.014 + t * 2.4 + i * 0.5) * h * 0.05 +
            Math.sin(x * 0.037 - t * 3.3 + i * 1.7) * h * 0.018 +
            Math.sin(x * 0.006 + t * 1.3 + i * 0.21) * h * 0.06;
          if (x === -10) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineWidth = i % 3 === 0 ? 2.6 : 1.6;
        ctx.strokeStyle = i % 4 === 1 ? "rgba(255,60,50,.9)" : i % 2 ? "rgba(196,0,29,.85)" : "rgba(140,16,30,.9)";
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(239,228,208,.75)";
      for (let i = 0; i < 26; i++) {
        const x = frac(rnd(i) + t * (0.05 + rnd(i + 9) * 0.12)) * w;
        const y = frac(rnd(i + 40) - t * 0.03 * (1 + rnd(i + 3))) * h;
        const s = 0.8 + rnd(i + 70) * 1.6;
        ctx.fillRect(x, y, s, s);
      }
    },
  };
}

/* ───────── V: VHS tape, tracking roll, running timecode ───────── */
function vhs(): Scene {
  let key = "";
  let tape: Sheet | null = null;
  let lines: Sheet | null = null;
  return {
    still: 2.2,
    draw(ctx, w, h, t) {
      if (key !== `${w}x${h}`) {
        key = `${w}x${h}`;
        tape = cached(w, h, (c) => {
          const bands = ["#0a0606", "#2b0509", OXBLOOD, MOLTEN, SIGNAL, "#ffb347", BONE];
          bands.forEach((col, i) => {
            c.fillStyle = col;
            c.fillRect(0, (h * i) / bands.length, w, h / bands.length + 1);
          });
          c.fillStyle = INK;
          c.beginPath();
          c.arc(w * 0.5, h * 0.62, Math.min(w, h) * 0.3, 0, TAU);
          c.fill();
          c.fillStyle = BONE;
          c.beginPath();
          c.arc(w * 0.5, h * 0.62, Math.min(w, h) * 0.17, 0, TAU);
          c.fill();
        });
        lines = cached(w, h, (c) => {
          c.fillStyle = "rgba(0,0,0,.28)";
          for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
        });
      }
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      const roll = frac(t * 0.33) * 1.3 - 0.15;
      const slice = 8;
      for (let y = 0; y < h; y += slice) {
        const inBand = Math.abs(y / h - roll) < 0.07;
        const jitter = Math.sin(y * 0.11 + t * 31) * 1.2 + (inBand ? Math.sin(y * 0.9 + t * 60) * w * 0.12 : 0);
        ctx.drawImage(tape!, 0, y, w, slice, jitter, y, w, slice);
      }
      // Chroma bleed: the picture ghosts sideways.
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.28;
      ctx.drawImage(tape!, w * 0.03, 0, w, h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(lines!, 0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,.75)";
      const seed = Math.floor(t * 24);
      for (let i = 0; i < 12; i++) {
        const y = (roll + (rnd(seed + i) - 0.5) * 0.16) * h;
        ctx.fillRect(rnd(seed + i * 3) * w, y, 4 + rnd(seed + i * 7) * w * 0.25, 1.5);
      }
      const f = Math.floor(t * 30);
      const two = (n: number) => String(n).padStart(2, "0");
      const size = Math.max(11, w * 0.085);
      ctx.font = `700 ${size}px ui-monospace, Menlo, Consolas, monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.fillText("PLAY ▶", w * 0.5, size * 1.5);
      ctx.fillText(`00:${two(14 + Math.floor(f / 1800))}:${two(Math.floor(f / 30) % 60)}:${two(f % 30)}`, w * 0.5, size * 2.8);
      ctx.textAlign = "left";
    },
  };
}

/* ───────── T: a tiny Corridor, cards rushing into the letter ───────── */
function tunnel(): Scene {
  const walls = [MOLTEN, BONE, SIGNAL, "#221c1a", OXBLOOD, CHROME];
  return {
    still: 0.7,
    draw(ctx, w, h, t) {
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h * 0.42;
      const K = 9;
      const flow = t * 2.1;
      const rings: { s: number; k: number }[] = [];
      for (let k = 0; k < K; k++) {
        const d = 1 - frac((k + flow) / K);
        rings.push({ s: 0.03 + Math.pow(d, 2.4) * 1.5, k: Math.floor((k + flow) / K) * K + k });
      }
      rings.sort((a, b) => a.s - b.s);
      const X = (s: number, sx: number) => cx + sx * s * w * 0.75;
      const Y = (s: number, sy: number) => cy + sy * s * h * 0.75;
      for (const { s, k } of rings) {
        const s2 = s * 0.74;
        const shade = clamp01(s * 1.6);
        ctx.globalAlpha = 0.25 + shade * 0.75;
        const quad = (pts: number[][], col: string) => {
          ctx.fillStyle = col;
          ctx.beginPath();
          pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.closePath();
          ctx.fill();
        };
        const col = (i: number) => walls[Math.abs(k * 3 + i) % walls.length];
        quad([[X(s, -1), Y(s, -0.55)], [X(s2, -1), Y(s2, -0.55)], [X(s2, -1), Y(s2, 0.55)], [X(s, -1), Y(s, 0.55)]], col(0));
        quad([[X(s, 1), Y(s, -0.55)], [X(s2, 1), Y(s2, -0.55)], [X(s2, 1), Y(s2, 0.55)], [X(s, 1), Y(s, 0.55)]], col(1));
        quad([[X(s, -0.6), Y(s, 1)], [X(s2, -0.6), Y(s2, 1)], [X(s2, 0.6), Y(s2, 1)], [X(s, 0.6), Y(s, 1)]], col(2));
        quad([[X(s, -0.6), Y(s, -1)], [X(s2, -0.6), Y(s2, -1)], [X(s2, 0.6), Y(s2, -1)], [X(s, 0.6), Y(s, -1)]], col(3));
        ctx.globalAlpha = 0.35 * shade;
        ctx.strokeStyle = BONE;
        ctx.lineWidth = 1;
        ctx.strokeRect(X(s, -1), Y(s, -1), s * w * 1.5, s * h * 1.5);
      }
      ctx.globalAlpha = 1;
    },
  };
}

/* ───────── L: welding sparks ───────── */
function sparks(): Scene {
  type P = { x: number; y: number; vx: number; vy: number; life: number; max: number };
  let parts: P[] = [];
  let last = -1;
  let n = 0;
  return {
    still: 1.2,
    draw(ctx, w, h, t) {
      const fresh = last < 0 || t < last || t - last > 0.5;
      const steps = fresh ? 24 : 1;
      const dt = fresh ? 1 / 30 : Math.min(t - last, 0.05);
      last = t;
      if (fresh) parts = [];
      const ox = w * 0.38;
      const oy = h * 0.16;
      const u = Math.max(w, h) / 420;
      for (let s = 0; s < steps; s++) {
        for (let i = 0; i < 4; i++) {
          n++;
          const a = 0.35 + rnd(n) * 2.3;
          const sp = (160 + rnd(n + 0.5) * 520) * u;
          const max = 0.45 + rnd(n + 0.9) * 0.8;
          parts.push({ x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.55 - 60 * u, life: max, max });
        }
        for (const p of parts) {
          p.vy += 980 * u * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
        }
        parts = parts.filter((p) => p.life > 0 && p.y < h + 30);
      }
      ctx.fillStyle = "#030101";
      ctx.fillRect(0, 0, w, h);
      const glow = ctx.createRadialGradient(ox, oy, 0, ox, oy, w * 0.7);
      glow.addColorStop(0, "rgba(255,225,190,.95)");
      glow.addColorStop(0.12, "rgba(255,120,20,.55)");
      glow.addColorStop(1, "rgba(255,77,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      for (const p of parts) {
        const k = p.life / p.max;
        ctx.strokeStyle = k > 0.7 ? "#fff3dc" : k > 0.4 ? "#ffb347" : k > 0.18 ? SIGNAL : "#8a1408";
        ctx.lineWidth = (0.8 + k * 1.8) * u;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.lineCap = "butt";
    },
  };
}

/* ───────── A: a slowly rotating galaxy ───────── */
function galaxy(): Scene {
  let key = "";
  let stars: Sheet | null = null;
  let sky: Sheet | null = null;
  return {
    still: 4,
    draw(ctx, w, h, t) {
      const cx = w * 0.5;
      const cy = h * 0.56;
      const R = Math.max(w, h) * 0.7;
      if (key !== `${w}x${h}`) {
        key = `${w}x${h}`;
        // Sky and core glow, drawn once.
        sky = cached(w, h, (c) => {
          c.fillStyle = "#020103";
          c.fillRect(0, 0, w, h);
          const core = c.createRadialGradient(cx, cy, 0, cx, cy, R * 0.5);
          core.addColorStop(0, "rgba(255,226,190,1)");
          core.addColorStop(0.16, "rgba(255,110,40,.6)");
          core.addColorStop(0.5, "rgba(140,16,30,.16)");
          core.addColorStop(1, "rgba(0,0,0,0)");
          c.fillStyle = core;
          c.fillRect(0, 0, w, h);
        });
        // The spiral arms, drawn once face-on. Each frame only turns the sheet.
        const S = Math.ceil(R * 2);
        stars = cached(S, S, (c) => {
          for (let i = 0; i < 900; i++) {
            const r = Math.pow(rnd(i), 0.62);
            const a = ((i % 3) * TAU) / 3 + r * 4.6 + (rnd(i + 0.3) - 0.5) * (0.9 - r * 0.5);
            const s = 1 + rnd(i + 0.6) * 2.3;
            const pick = rnd(i + 0.8);
            c.globalAlpha = 0.35 + rnd(i + 0.2) * 0.65;
            c.fillStyle = pick < 0.14 ? SIGNAL : pick < 0.3 ? CHROME : BONE;
            c.fillRect(R + Math.cos(a) * r * R, R + Math.sin(a) * r * R, s, s);
          }
        });
      }
      ctx.drawImage(sky!, 0, 0, w, h);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.5);
      ctx.scale(1, 0.5);
      ctx.rotate(t * 0.3);
      ctx.drawImage(stars!, -R, -R, R * 2, R * 2);
      ctx.restore();
    },
  };
}

/* ───────── N: a red neon tube buzzing on ───────── */
function neon(): Scene {
  const pts = [
    [0.22, 0.1],
    [0.78, 0.27],
    [0.24, 0.47],
    [0.76, 0.66],
    [0.24, 0.9],
  ];
  let key = "";
  let off: Sheet | null = null;
  let lit: Sheet | null = null;
  return {
    still: 3,
    draw(ctx, w, h, t) {
      if (key !== `${w}x${h}`) {
        key = `${w}x${h}`;
        const u = Math.min(w, h) / 200;
        const trace = (c: Ctx) => {
          c.beginPath();
          pts.forEach(([x, y], i) => (i ? c.lineTo(x * w, y * h) : c.moveTo(x * w, y * h)));
        };
        // Two states drawn once: the dead tube, and the tube fully lit.
        off = cached(w, h, (c) => {
          c.fillStyle = "#090203";
          c.fillRect(0, 0, w, h);
          c.lineJoin = "round";
          c.lineCap = "round";
          c.strokeStyle = "#3a0a0e";
          c.lineWidth = 9 * u;
          trace(c);
          c.stroke();
        });
        lit = cached(w, h, (c) => {
          const wash = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.75);
          wash.addColorStop(0, "rgba(255,20,30,.32)");
          wash.addColorStop(1, "rgba(255,20,30,0)");
          c.fillStyle = wash;
          c.fillRect(0, 0, w, h);
          c.lineJoin = "round";
          c.lineCap = "round";
          c.globalCompositeOperation = "lighter";
          [
            [54, 0.07],
            [32, 0.13],
            [18, 0.28],
          ].forEach(([lw, a]) => {
            c.strokeStyle = `rgba(255,26,36,${a})`;
            c.lineWidth = lw * u;
            trace(c);
            c.stroke();
          });
          c.globalCompositeOperation = "source-over";
          c.strokeStyle = "#ffe6dc";
          c.lineWidth = 6 * u;
          trace(c);
          c.stroke();
        });
      }
      const loop = t % 3.6;
      let I = 1;
      if (loop < 0.22) I = 0;
      else if (loop < 0.27) I = 1;
      else if (loop < 0.42) I = 0;
      else if (loop < 0.47) I = 0.8;
      else if (loop < 0.66) I = 0.08;
      else if (loop < 0.74) I = 1;
      else if (loop < 0.86) I = 0.3;
      else I = 0.9 + 0.1 * Math.sin(t * 70);
      ctx.drawImage(off!, 0, 0, w, h);
      ctx.globalAlpha = I;
      ctx.drawImage(lit!, 0, 0, w, h);
      ctx.globalAlpha = 1;
    },
  };
}

/* ───────── E: website blocks snapping into a layout ───────── */
function blocks(): Scene {
  // x, y, w, h, colour, entry direction
  const B: [number, number, number, number, string, number][] = [
    [0.08, 0.05, 0.84, 0.045, BONE, 0],
    [0.08, 0.125, 0.84, 0.27, SIGNAL, 1],
    [0.08, 0.43, 0.62, 0.035, BONE, 2],
    [0.08, 0.485, 0.42, 0.035, BONE, 2],
    [0.08, 0.57, 0.4, 0.19, "#2a2422", 3],
    [0.52, 0.57, 0.4, 0.19, "#2a2422", 1],
    [0.08, 0.79, 0.4, 0.035, CHROME, 2],
    [0.52, 0.79, 0.4, 0.035, CHROME, 2],
    [0.08, 0.87, 0.36, 0.06, MOLTEN, 0],
  ];
  return {
    still: 2.3,
    draw(ctx, w, h, t) {
      ctx.fillStyle = "#0c0a09";
      ctx.fillRect(0, 0, w, h);
      const loop = t % 3.4;
      const out = clamp01((loop - 2.9) / 0.3);
      B.forEach(([x, y, bw, bh, col, dir], i) => {
        const p = clamp01((loop - i * 0.17) / 0.34);
        if (p <= 0) return;
        const e = outBack(p);
        const away = (1 - e) * 0.9;
        const dx = dir === 1 ? away : dir === 3 ? -away : 0;
        const dy = dir === 0 ? -away : dir === 2 ? away * 0.5 : 0;
        ctx.globalAlpha = Math.min(1, p * 3) * (1 - out);
        ctx.fillStyle = col;
        ctx.fillRect((x + dx) * w, (y + dy + out * 0.08) * h, bw * w, bh * h);
      });
      ctx.globalAlpha = 1;
    },
  };
}

/* ───────── L and Y: liquid chrome, one shared WebGL program ───────── */

const CHROME_FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uKind;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=.5,v=0.;for(int i=0;i<4;i++){v+=a*noise(p);p=mat2(1.6,1.2,-1.2,1.6)*p;a*=.5;}return v;}
float height(vec2 p){
  if(uKind<.5){
    // pour: long ropes of metal running down the letter
    vec2 q=vec2(p.x*2.3,p.y*.3+uTime*.95);
    float w=fbm(q*.7+vec2(0.,uTime*.3));
    return fbm(q+vec2(w*1.7,0.));
  }
  // surface: a slow rolling swell
  vec2 q=p*1.25+vec2(uTime*.12,-uTime*.08);
  float w=fbm(q*1.1-uTime*.15);
  return fbm(q+w*1.6);
}
// A studio to reflect: bright banded sky, dark cap, orange horizon, oxblood floor.
vec3 studio(vec3 r){
  float y=r.y,x=r.x;
  vec3 c=vec3(.02,.016,.018);
  c=mix(c,vec3(.96,.94,.9),smoothstep(.04,.45,y)*(.5+.5*sin(y*10.+x*3.)));
  c=mix(c,vec3(.03,.02,.02),smoothstep(.74,.92,y));
  c+=vec3(1.,.3,.02)*exp(-pow((y+.03)*6.5,2.))*(uKind<.5?1.5:1.05);
  c+=vec3(.64,.0,.08)*smoothstep(-.12,-.8,y);
  c+=vec3(.8,.84,.9)*exp(-pow((x-.5)*5.,2.))*.45*smoothstep(-.4,.1,y);
  return c;
}
void main(){
  vec2 p=(gl_FragCoord.xy-.5*uRes)/min(uRes.x,uRes.y);
  float e=.02;
  float k=uKind<.5?1.5:2.1;
  float h0=height(p);
  vec3 n=normalize(vec3((height(p-vec2(e,0.))-height(p+vec2(e,0.)))/e*k*.5,
                        (height(p-vec2(0.,e))-height(p+vec2(0.,e)))/e*k*.5,1.));
  vec3 r=reflect(vec3(0.,0.,-1.),n);
  vec3 col=studio(r)*(.75+.5*h0);
  col+=pow(1.-n.z,2.)*vec3(.5,.45,.4);
  gl_FragColor=vec4(col,1.);
}`;

type Shared = {
  canvas: Sheet;
  gl: WebGLRenderingContext;
  prog: WebGLProgram;
  ready: boolean;
  failed: boolean;
  u: Record<string, WebGLUniformLocation | null>;
};
let shared: Shared | null = null;
let sharedTried = false;

/** Start compiling the chrome shader. Safe to call early; never blocks. */
export function warmChrome() {
  if (sharedTried) return;
  sharedTried = true;
  const canvas = sheet(2, 2);
  const gl = canvas.getContext("webgl", {
    antialias: false,
    alpha: false,
    preserveDrawingBuffer: true,
  }) as WebGLRenderingContext | null;
  if (!gl) return;
  const make = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, make(gl.VERTEX_SHADER, "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}"));
  gl.attachShader(prog, make(gl.FRAGMENT_SHADER, CHROME_FRAG));
  gl.linkProgram(prog);
  const state: Shared = { canvas, gl, prog, ready: false, failed: false, u: {} };
  shared = state;
  const parallel = gl.getExtension("KHR_parallel_shader_compile");
  const wait = () => {
    if (parallel && !gl.getProgramParameter(prog, parallel.COMPLETION_STATUS_KHR)) {
      requestAnimationFrame(wait);
      return;
    }
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      state.failed = true;
      return;
    }
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const name of ["uRes", "uTime", "uKind"]) state.u[name] = gl.getUniformLocation(prog, name);
    state.ready = true;
  };
  wait();
}

/**
 * Phones do not get a second WebGL context for two letters. With `lite` on,
 * the chrome scenes are drawn in 2D instead: a reflection strip slid through
 * a sine, a few dozen blits per frame.
 */
let lite = false;
export function setLite(on: boolean) {
  lite = on;
}

function ribbons(kind: 0 | 1): Scene["draw"] {
  let strip: Sheet | null = null;
  return (ctx, w, h, t) => {
    if (!strip) {
      // One tall strip of studio reflections, twice over so it can wrap.
      strip = cached(4, 512, (c) => {
        const g = c.createLinearGradient(0, 0, 0, 256);
        const stops: [number, string][] = [
          [0, "#0b0909"],
          [0.1, "#fff6ea"],
          [0.2, CHROME],
          [0.3, "#141011"],
          [0.44, SIGNAL],
          [0.5, "#ffd9a8"],
          [0.58, MOLTEN],
          [0.7, "#0b0909"],
          [0.84, CHROME],
          [0.93, "#2a2224"],
          [1, "#0b0909"],
        ];
        stops.forEach(([o, col]) => g.addColorStop(o, col));
        c.fillStyle = g;
        c.fillRect(0, 0, 4, 256);
        c.drawImage(c.canvas, 0, 0, 4, 256, 0, 256, 4, 256);
      });
    }
    const bands = Math.max(8, Math.round(w / 7));
    const bw = w / bands;
    const span = kind ? 150 : 110;
    for (let i = 0; i < bands; i++) {
      const u = i / bands;
      const wave = kind
        ? Math.sin(u * 5 + t * 0.9) * 46 + Math.sin(u * 11 - t * 1.4) * 18 + t * 12
        : Math.sin(u * 9 + t * 0.6) * 30 + Math.sin(u * 21 + i) * 14 - t * 90;
      const sy = ((wave % 256) + 256) % 256;
      ctx.drawImage(strip, 0, sy, 4, span, i * bw, 0, bw + 0.6, h);
    }
  };
}

function chrome(kind: 0 | 1): Scene {
  const flat = ribbons(kind);
  return {
    still: 2.5,
    draw(ctx, w, h, t) {
      if (lite) return flat(ctx, w, h, t);
      warmChrome();
      const s = shared;
      // Until the shader is ready (or if WebGL is missing): the 2D version.
      if (!s || !s.ready) return flat(ctx, w, h, t);
      const scale = Math.min(1, 300 / Math.max(w, h));
      const cw = Math.max(2, Math.round(w * scale));
      const ch = Math.max(2, Math.round(h * scale));
      if (s.canvas.width !== cw || s.canvas.height !== ch) {
        s.canvas.width = cw;
        s.canvas.height = ch;
      }
      const gl = s.gl;
      gl.viewport(0, 0, cw, ch);
      gl.uniform2f(s.u.uRes, cw, ch);
      gl.uniform1f(s.u.uTime, t);
      gl.uniform1f(s.u.uKind, kind);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      ctx.drawImage(s.canvas, 0, 0, w, h);
    },
  };
}

/** One factory per hero letter, in reading order: V E L V E T / L A Y N E. */
export const LETTER_SCENES: { name: string; make: () => Scene }[] = [
  { name: "vinyl", make: vinyl },
  { name: "print", make: print },
  { name: "pour", make: () => chrome(0) },
  { name: "vhs", make: vhs },
  { name: "threads", make: threads },
  { name: "tunnel", make: tunnel },
  { name: "sparks", make: sparks },
  { name: "galaxy", make: galaxy },
  { name: "chrome", make: () => chrome(1) },
  { name: "neon", make: neon },
  { name: "blocks", make: blocks },
];

/** A still frame of a scene, used for the finale tiles. 2D scenes only. */
export function sceneStill(index: number, w: number, h: number) {
  const scene = LETTER_SCENES[index].make();
  return cached(w, h, (c) => scene.draw(c, w, h, scene.still));
}
