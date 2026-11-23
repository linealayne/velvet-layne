/**
 * Shared between Corridor.tsx (which owns the scroll timeline and the DOM page
 * that gets pulled in) and CorridorScene.tsx (which draws the tunnel), so the
 * two halves of the entrance move as one.
 */
export const corridorState = {
  /** The entrance, 0 (still a flat page) to 1 (inside the tunnel). */
  vac: 1,
  /**
   * How far down the tunnel a wall has to be to exactly fill the screen.
   * The page starts there and is scaled by d0 / depth as it is pulled away,
   * which is precisely how the tunnel's own cross-section shrinks.
   */
  d0: 3.66,
};

export const FOG_NEAR = 5;
export const FOG_FAR = 44;

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * The light during the entrance, for progress p (0 to 1).
 *  - Until 0.3 the fog is the tunnel's normal fog: only the far end is dark.
 *  - From 0.3 to 0.8 the dark closes in from the far end toward you (the
 *    centre of the screen outward) until everything is black.
 *  - From 0.8 to 1 it opens again on the real tunnel: `light` brings the
 *    panels up, and the tan walls are gone (`paper` is 0).
 * Both the three.js walls and the DOM page use these numbers, so they darken
 * as one surface.
 */
export function entranceLight(p: number) {
  const close = smooth(0.3, 0.8, p);
  const open = smooth(0.8, 1, p);
  const k = close * (1 - open);
  return {
    near: FOG_NEAR + (0.3 - FOG_NEAR) * k,
    far: FOG_FAR + (2.6 - FOG_FAR) * k,
    light: open,
    paper: p < 0.8 ? 1 : 0,
  };
}
