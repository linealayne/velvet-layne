/**
 * Shared between Corridor.tsx (which owns the scroll timeline and paints the
 * page) and CorridorScene.tsx (which draws the studio and the tunnel), so the two halves of the entrance move as one.
 */
export const corridorState = {
  /** The entrance, 0 (still a flat page) to 1 (inside the tunnel). */
  vac: 1,
  /** A picture of Editorial's last screen (see lib/pageTexture.ts). */
  page: null as HTMLCanvasElement | null,
  /** Bumped every time `page` is repainted. */
  pageVersion: 0,
  /** True once the scene can draw the page as a sheet of paper in the studio. */
  sheet: false,
};

export const FOG_NEAR = 5;
export const FOG_FAR = 44;

