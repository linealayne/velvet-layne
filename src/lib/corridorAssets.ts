/**
 * Everything the Corridor shows, prepared ahead of time.
 *
 * `preloadCorridor()` can be called long before the chapter is reached (it is
 * called once the hero has settled, and again by anything that gets there
 * first). It is idempotent and never blocks:
 *  - every capture gets a canvas straight away, painted with a solid colour
 *    and the site's name, so a panel is never empty;
 *  - the real image is fetched and decoded off the main thread, then drawn
 *    over that placeholder, and listeners are told so the scene can swap it in;
 *  - the posters are drawn a few at a time while the browser is idle.
 * It has no three.js in it, so preloading costs no extra JavaScript.
 */
import { makePoster, postersReady, POSTER_COUNT } from "./posters";

// Captures of Layne's own live Linea demo sites (see scripts/captures.mjs).
// The names are the demo sites' own names. The colours only show for the
// moment before the image arrives.
const CAPTURES: [file: string, name: string, color: string, ink: string][] = [
  ["ashgrove-1", "ASHGROVE", "#5c0a14", "#efe4d0"],
  ["hollis-1", "HOLLIS", "#0a0707", "#efe4d0"],
  ["auren-2", "AUREN", "#c9ced6", "#0a0707"],
  ["blendwell-1", "BLENDWELL", "#efe4d0", "#0a0707"],
  ["cairn-2", "CAIRN", "#0a0707", "#ff4d00"],
  ["rove-1", "ROVE", "#c9ced6", "#0a0707"],
  ["hollis-2", "HOLLIS", "#5c0a14", "#efe4d0"],
  ["ashgrove-2", "ASHGROVE", "#ff4d00", "#0a0707"],
  ["rove-2", "ROVE", "#efe4d0", "#0a0707"],
];

export const CAPTURE_W = 800;
export const CAPTURE_H = 500;

export type CaptureAsset = {
  /** Created on first use, so warming the assets at idle does no canvas work. */
  canvas: () => HTMLCanvasElement;
  ready: boolean;
  /** Called when the real image has been drawn into `canvas`. */
  listeners: (() => void)[];
};

/** The studio's photographs (Poly Haven, CC0; see scripts/studio-assets.mjs). */
export type StudioSet = {
  brick: [HTMLImageElement, HTMLImageElement, HTMLImageElement];
  floor: [HTMLImageElement, HTMLImageElement, HTMLImageElement];
  room: HTMLImageElement;
};

type Assets = {
  captures: CaptureAsset[];
  /** Resolves with the studio's textures, decoded, or null if they could not be had. */
  studio: Promise<StudioSet | null>;
  posters: HTMLCanvasElement[];
  /** Resolves when all posters exist. */
  postersDone: Promise<void>;
};

let assets: Assets | null = null;

const idle = () =>
  new Promise<void>((resolve) => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(() => resolve(), { timeout: 300 });
    else setTimeout(resolve, 30);
  });

function frame(g: CanvasRenderingContext2D) {
  g.strokeStyle = "#efe4d0";
  g.lineWidth = 10;
  g.strokeRect(5, 5, CAPTURE_W - 10, CAPTURE_H - 10);
}

function placeholder(c: HTMLCanvasElement, name: string, color: string, ink: string) {
  const g = c.getContext("2d")!;
  const family =
    getComputedStyle(document.documentElement).getPropertyValue("--font-anybody").trim() ||
    '"Arial Black", Impact, sans-serif';
  g.fillStyle = color;
  g.fillRect(0, 0, CAPTURE_W, CAPTURE_H);
  g.fillStyle = ink;
  g.font = `900 132px ${family}`;
  g.textBaseline = "alphabetic";
  const width = g.measureText(name).width;
  const max = CAPTURE_W - 90;
  if (width > max) g.font = `900 ${Math.floor((132 * max) / width)}px ${family}`;
  g.fillText(name, 45, CAPTURE_H - 60);
  g.fillRect(45, 58, 190, 12);
  frame(g);
}

type Slot = CaptureAsset & { made?: HTMLCanvasElement; img?: HTMLImageElement };

function paintImage(c: HTMLCanvasElement, img: HTMLImageElement) {
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0, CAPTURE_W, CAPTURE_H);
  frame(g);
}

async function loadCapture(asset: Slot, file: string) {
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = `/work/${file}.webp`;
    // decode() resolves once the pixels are ready, so drawing it cannot stall.
    await img.decode();
    asset.img = img;
    if (asset.made) paintImage(asset.made, img);
    asset.ready = true;
    asset.listeners.forEach((fn) => fn());
  } catch {
    /* the placeholder stays */
  }
}

export function preloadCorridor(): Assets {
  if (assets) return assets;
  const captures: Slot[] = CAPTURES.map(([, name, color, ink]) => {
    const slot: Slot = {
      ready: false,
      listeners: [],
      canvas: () => {
        if (slot.made) return slot.made;
        const canvas = document.createElement("canvas");
        canvas.width = CAPTURE_W;
        canvas.height = CAPTURE_H;
        if (slot.img) paintImage(canvas, slot.img);
        else placeholder(canvas, name, color, ink);
        slot.made = canvas;
        return canvas;
      },
    };
    return slot;
  });

  // Two at a time, in the order the tunnel will use them.
  let next = 0;
  const worker = async () => {
    while (next < captures.length) {
      const i = next++;
      await loadCapture(captures[i], CAPTURES[i][0]);
    }
  };
  worker();
  worker();

  const posters: HTMLCanvasElement[] = [];
  const postersDone = (async () => {
    await postersReady();
    // The display font is certainly loaded now: repaint any placeholder still showing.
    captures.forEach((c, i) => {
      if (!c.ready && c.made) placeholder(c.made, CAPTURES[i][1], CAPTURES[i][2], CAPTURES[i][3]);
    });
    // One poster per idle slice.
    for (let i = 0; i < POSTER_COUNT; i++) {
      await idle();
      posters.push(makePoster(i));
    }
  })();

  // The studio's textures come down with the rest, decoded off the main
  // thread, so the room is whole the first time it is seen. Phones take the
  // half-size set.
  const studio = (async (): Promise<StudioSet | null> => {
    try {
      const size = window.matchMedia("(max-width: 820px)").matches ? 512 : 1024;
      const load = async (src: string) => {
        const img = new Image();
        img.decoding = "async";
        img.src = src;
        await img.decode();
        return img;
      };
      const names = ["brick-color", "brick-normal", "brick-arm", "floor-color", "floor-normal", "floor-arm"];
      const [a, b, c, d, e, f, room] = await Promise.all([
        ...names.map((n) => load(`/studio/${n}-${size}.webp`)),
        load("/studio/room.webp"),
      ]);
      return { brick: [a, b, c], floor: [d, e, f], room };
    } catch {
      return null;
    }
  })();

  assets = { captures, studio, posters, postersDone };
  return assets;
}
