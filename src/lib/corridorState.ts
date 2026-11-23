/**
 * Shared between Corridor.tsx (which owns the scroll timeline and paints the
 * page) and CorridorScene.tsx (which draws the ribbons and the tunnel), so the
 * two halves of the entrance move as one.
 */
export const corridorState = {
  /** The entrance, 0 (still a flat page) to 1 (inside the tunnel). */
  vac: 1,
  /** A picture of Editorial's last screen (see lib/pageTexture.ts). */
  page: null as HTMLCanvasElement | null,
  /** Bumped every time `page` is repainted. */
  pageVersion: 0,
  /** True once the scene can draw the ribbons. */
  ribbons: false,
};

export const FOG_NEAR = 5;
export const FOG_FAR = 44;

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How lit the tunnel's own panels are during the entrance (0 to 1). */
export const tunnelLight = (p: number) => smooth(0.64, 0.97, p);

/** How much of the ribbons' own light is left as they settle into the walls. */
export const ribbonLight = (p: number) => 1 - smooth(0.66, 0.92, p);
