/**
 * Every illustration on the page, as plain SVG markup.
 * It is injected as HTML rather than rendered as React elements: the art never
 * changes, so there is nothing for React to hydrate inside it.
 */

const INK = "#0a0707";
const PAPER = "#efe4d0";
const RED = "#b3001b";
const BLUE = "#ff4d00";

const svg = (box: string, body: string, attrs = 'aria-hidden="true"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box}" ${attrs}>${body}</svg>`;

const PLATE_ALT = [
  "Plate 1: a black disc set off-centre on a red field, ringed by fine white circles",
  "Plate 2: a halftone grid of pale dots growing larger toward one corner of a black field",
  "Plate 3: half discs in oxblood, black and orange stacked like a totem",
  "Plate 4: diagonal black stripes cut by a large quarter circle that fades from red to orange",
];

/** Editorial: four abstract plates. No photographs anywhere. */
export function plateArt(n: number) {
  const attrs = `role="img" aria-label="${PLATE_ALT[n - 1]}" preserveAspectRatio="xMidYMid slice"`;
  if (n === 1) {
    return svg(
      "400 500",
      `<rect width="400" height="500" fill="${RED}"/>` +
        `<circle cx="250" cy="300" r="170" fill="${INK}"/>` +
        [60, 100, 140, 180, 220, 260]
          .map((r) => `<circle cx="130" cy="170" r="${r}" fill="none" stroke="${PAPER}" stroke-width="1.2"/>`)
          .join("") +
        `<circle cx="130" cy="170" r="20" fill="${PAPER}"/>`,
      attrs
    );
  }
  if (n === 2) {
    let dots = "";
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 10; x++) {
        const r = (1.5 + ((x + (11 - y)) / 20) ** 1.8 * 19).toFixed(2);
        const fill = x === 7 && y === 3 ? RED : PAPER;
        dots += `<circle cx="${20 + x * 40}" cy="${30 + y * 40}" r="${r}" fill="${fill}"/>`;
      }
    }
    return svg("400 500", `<rect width="400" height="500" fill="${INK}"/>${dots}`, attrs);
  }
  if (n === 3) {
    return svg(
      "400 500",
      `<rect width="400" height="500" fill="#cdbb9b"/>` +
        `<path d="M60 170a140 140 0 0 1 280 0z" fill="${RED}"/>` +
        `<path d="M60 170a140 140 0 0 0 280 0z" fill="${INK}"/>` +
        `<path d="M60 450a140 140 0 0 1 280 0z" fill="${BLUE}"/>` +
        `<rect x="60" y="450" width="280" height="6" fill="${INK}"/>`,
      attrs
    );
  }
  return svg(
    "400 500",
    `<defs>` +
      `<pattern id="pl-stripes" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="14" height="28" fill="${INK}"/></pattern>` +
      `<linearGradient id="pl-fade" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${RED}"/><stop offset="1" stop-color="#ff4d00"/></linearGradient>` +
      `</defs>` +
      `<rect width="400" height="500" fill="${PAPER}"/>` +
      `<rect width="400" height="500" fill="url(#pl-stripes)"/>` +
      `<path d="M0 500V140a360 360 0 0 1 360 360z" fill="url(#pl-fade)"/>`,
    attrs
  );
}
