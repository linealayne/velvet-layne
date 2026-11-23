/**
 * Screen-print style posters, drawn on a canvas at run time.
 * Used on the Corridor walls and as tiles in the finale. The titles are
 * invented for this page; nothing here references a real brand, person or work.
 */

const BONE = "#efe4d0";
const INK = "#0a0707";
const OXBLOOD = "#5c0a14";
const MOLTEN = "#c4001d";
const SIGNAL = "#ff4d00";
const CHROME = "#c9ced6";

export const POSTER_W = 420;
export const POSTER_H = 600;
export const POSTER_COUNT = 8;

const TAU = Math.PI * 2;

/** The display family name that next/font generated, for use in canvas text. */
function displayFont() {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-anybody").trim();
  return v || '"Arial Black", Impact, sans-serif';
}

function halftone(
  c: CanvasRenderingContext2D,
  color: string,
  step: number,
  value: (x: number, y: number) => number
) {
  c.fillStyle = color;
  for (let y = step / 2; y < POSTER_H; y += step) {
    for (let x = step / 2; x < POSTER_W; x += step) {
      const v = value(x / POSTER_W, y / POSTER_H);
      if (v <= 0.03) continue;
      c.beginPath();
      c.arc(x, y, step * 0.62 * Math.sqrt(Math.min(v, 1)), 0, TAU);
      c.fill();
    }
  }
}

function title(c: CanvasRenderingContext2D, text: string, color: string, y = POSTER_H - 34, size = 54) {
  c.fillStyle = color;
  c.font = `900 ${size}px ${displayFont()}`;
  c.textBaseline = "alphabetic";
  let width = c.measureText(text).width;
  const max = POSTER_W - 56;
  if (width > max) {
    c.font = `900 ${Math.floor((size * max) / width)}px ${displayFont()}`;
    width = max;
  }
  c.fillText(text, 28, y);
}

function small(c: CanvasRenderingContext2D, text: string, color: string, x: number, y: number) {
  c.fillStyle = color;
  c.font = `700 13px ${displayFont()}`;
  c.fillText(text, x, y);
}

const DESIGNS: ((c: CanvasRenderingContext2D) => void)[] = [
  // Slow Burn: a halftone sun
  (c) => {
    c.fillStyle = BONE;
    c.fillRect(0, 0, POSTER_W, POSTER_H);
    halftone(c, MOLTEN, 14, (x, y) => 1.3 - Math.hypot(x - 0.5, (y - 0.4) * 1.43) * 3.1);
    c.fillStyle = INK;
    c.fillRect(28, POSTER_H - 106, POSTER_W - 56, 6);
    title(c, "SLOW BURN", INK);
    small(c, "NO. 01", INK, 28, 40);
  },
  // Night Shift: stripes and a numeral
  (c) => {
    c.fillStyle = INK;
    c.fillRect(0, 0, POSTER_W, POSTER_H);
    c.save();
    c.translate(POSTER_W / 2, POSTER_H / 2);
    c.rotate(-0.6);
    c.fillStyle = SIGNAL;
    for (let i = -12; i < 12; i++) c.fillRect(-500, i * 44, 1000, 20);
    c.restore();
    c.fillStyle = INK;
    c.fillRect(0, POSTER_H - 190, POSTER_W, 190);
    c.fillStyle = BONE;
    c.font = `900 150px ${displayFont()}`;
    c.fillText("07", 22, POSTER_H - 74);
    title(c, "NIGHT SHIFT", BONE, POSTER_H - 28, 40);
  },
  // Full Bleed: a type specimen
  (c) => {
    c.fillStyle = OXBLOOD;
    c.fillRect(0, 0, POSTER_W, POSTER_H);
    c.fillStyle = BONE;
    c.font = `900 300px ${displayFont()}`;
    c.fillText("Aa", 14, 310);
    c.fillRect(28, 350, POSTER_W - 56, 4);
    c.font = `800 44px ${displayFont()}`;
    c.fillText("ABCDEFG", 28, 410);
    c.fillText("0123456", 28, 462);
    title(c, "FULL BLEED", SIGNAL);
  },
  // Dead Center: stacked colour blocks
  (c) => {
    c.fillStyle = BONE;
    c.fillRect(0, 0, POSTER_W, POSTER_H);
    c.fillStyle = INK;
    c.fillRect(28, 60, POSTER_W - 56, 150);
    c.fillStyle = MOLTEN;
    c.fillRect(28, 210, POSTER_W - 56, 150);
    c.fillStyle = SIGNAL;
    c.fillRect(28, 360, POSTER_W - 56, 110);
    c.fillStyle = BONE;
    c.beginPath();
    c.arc(POSTER_W / 2, 285, 46, 0, TAU);
    c.fill();
    title(c, "DEAD CENTER", INK);
  },
  // Loud Hours: rings
  (c) => {
    c.fillStyle = INK;
    c.fillRect(0, 0, POSTER_W, POSTER_H);
    c.strokeStyle = BONE;
    c.lineWidth = 5;
    for (let r = 30; r < 420; r += 26) {
      c.beginPath();
      c.arc(POSTER_W * 0.62, POSTER_H * 0.36, r, 0, TAU);
      c.stroke();
    }
    c.fillStyle = SIGNAL;
    c.beginPath();
    c.arc(POSTER_W * 0.62, POSTER_H * 0.36, 22, 0, TAU);
    c.fill();
    c.fillStyle = INK;
    c.fillRect(0, POSTER_H - 110, POSTER_W, 110);
    title(c, "LOUD HOURS", BONE);
  },
  // Hot Press: a halftone wave on orange
  (c) => {
    c.fillStyle = SIGNAL;
    c.fillRect(0, 0, POSTER_W, POSTER_H);
    halftone(c, INK, 12, (x, y) => (y > 0.78 ? 0 : 0.5 + 0.5 * Math.sin(x * 9 + Math.sin(y * 7) * 2.4)));
    c.fillStyle = SIGNAL;
    c.fillRect(0, POSTER_H - 122, POSTER_W, 122);
    title(c, "HOT PRESS", INK);
    small(c, "SECOND PULL", INK, 28, POSTER_H - 92);
  },
  // After Dark: one huge word
  (c) => {
    c.fillStyle = BONE;
    c.fillRect(0, 0, POSTER_W, POSTER_H);
    c.fillStyle = MOLTEN;
    c.fillRect(0, 0, POSTER_W, 96);
    c.save();
    c.translate(28, 520);
    c.scale(1, 2.5);
    c.fillStyle = INK;
    c.font = `900 122px ${displayFont()}`;
    c.fillText("DARK", 0, 0);
    c.restore();
    small(c, "AFTER", BONE, 28, 58);
    title(c, "AFTER DARK", INK, POSTER_H - 24, 30);
  },
  // Oxblood No. 9: a grid of marks
  (c) => {
    c.fillStyle = INK;
    c.fillRect(0, 0, POSTER_W, POSTER_H);
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 6; x++) {
        const hot = x === 4 && y === 2;
        c.fillStyle = hot ? SIGNAL : (x + y) % 5 === 0 ? MOLTEN : CHROME;
        const px = 46 + x * 66;
        const py = 60 + y * 66;
        c.fillRect(px - 16, py - 3, 32, 6);
        c.fillRect(px - 3, py - 16, 6, 32);
      }
    }
    title(c, "OXBLOOD NO. 9", BONE, POSTER_H - 34, 44);
  },
];

const cache = new Map<number, HTMLCanvasElement>();

/** Draw (or reuse) poster `i`. Call after the display font has loaded. */
export function makePoster(i: number) {
  const n = ((i % POSTER_COUNT) + POSTER_COUNT) % POSTER_COUNT;
  const hit = cache.get(n);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = POSTER_W;
  canvas.height = POSTER_H;
  const c = canvas.getContext("2d")!;
  DESIGNS[n](c);
  // A thin printed edge, like a deckle.
  c.strokeStyle = "rgba(10,7,7,.55)";
  c.lineWidth = 3;
  c.strokeRect(1.5, 1.5, POSTER_W - 3, POSTER_H - 3);
  cache.set(n, canvas);
  return canvas;
}

/** Resolves once the display font can be used on a canvas. */
export async function postersReady() {
  try {
    await document.fonts.load(`900 40px ${displayFont()}`);
  } catch {
    /* fall back to the system face */
  }
}
