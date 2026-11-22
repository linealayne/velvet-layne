/**
 * Every illustration on the page, as plain SVG markup.
 * It is injected as HTML rather than rendered as React elements: the art never
 * changes, so there is nothing for React to hydrate inside it.
 */

const INK = "#0e0e0e";
const PAPER = "#efefea";
const RED = "#e3120b";
const BLUE = "#1c2bff";
const SUN = "#ffd60a";
const EMBER = "#ff4a1c";

const svg = (box: string, body: string, attrs = 'aria-hidden="true"') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box}" ${attrs}>${body}</svg>`;

/** Conveyor: abstract "products". Nothing here is for sale. */
export function objectArt(shape: string) {
  switch (shape) {
    case "capsule":
      return svg(
        "120 150",
        `<rect x="38" y="14" width="44" height="18" rx="4" fill="${INK}"/>` +
          `<rect x="24" y="34" width="72" height="104" rx="30" fill="${EMBER}"/>` +
          `<rect x="24" y="74" width="72" height="26" fill="${INK}"/>` +
          `<rect x="34" y="46" width="8" height="22" rx="4" fill="#fff" opacity=".55"/>`
      );
    case "arch":
      return svg(
        "120 150",
        `<path d="M14 140V72a46 46 0 0 1 92 0v68H78V72a18 18 0 0 0-36 0v68z" fill="${BLUE}"/>` +
          `<circle cx="60" cy="118" r="14" fill="${INK}"/>`
      );
    case "discs":
      return svg(
        "120 150",
        `<ellipse cx="60" cy="118" rx="46" ry="14" fill="${INK}"/>` +
          `<ellipse cx="60" cy="92" rx="38" ry="12" fill="${BLUE}"/>` +
          `<ellipse cx="60" cy="68" rx="30" ry="10" fill="${SUN}"/>` +
          `<ellipse cx="60" cy="46" rx="22" ry="8" fill="${EMBER}"/>` +
          `<circle cx="60" cy="24" r="9" fill="${INK}"/>`
      );
    default:
      return svg(
        "120 150",
        `<defs><radialGradient id="orb-g" cx="35%" cy="30%" r="75%">` +
          `<stop offset="0" stop-color="${SUN}"/><stop offset=".55" stop-color="${EMBER}"/><stop offset="1" stop-color="#7a0016"/>` +
          `</radialGradient></defs>` +
          `<circle cx="60" cy="70" r="44" fill="url(#orb-g)"/>` +
          `<rect x="22" y="126" width="76" height="8" fill="${INK}"/>`
      );
  }
}

/** Conveyor: pure shapes. */
export function shapeArt(shape: string, fg: string) {
  switch (shape) {
    case "burst":
      return svg(
        "120 120",
        Array.from(
          { length: 12 },
          (_, i) =>
            `<rect x="56" y="6" width="8" height="108" rx="4" fill="${fg}" transform="rotate(${i * 15} 60 60)"/>`
        ).join("")
      );
    case "halves":
      return svg(
        "120 120",
        `<path d="M10 44a50 34 0 0 1 100 0z" fill="${fg}"/>` +
          `<path d="M10 82a50 34 0 0 1 100 0z" fill="${fg}" opacity=".7"/>` +
          `<path d="M10 118a50 34 0 0 1 100 0z" fill="${fg}" opacity=".4"/>`
      );
    case "squiggle":
      return svg(
        "120 120",
        `<path d="M8 30c17-22 35 22 52 0s35 22 52 0M8 62c17-22 35 22 52 0s35 22 52 0M8 94c17-22 35 22 52 0s35 22 52 0" fill="none" stroke="${fg}" stroke-width="9" stroke-linecap="round"/>`
      );
    default:
      return svg("120 120", `<path d="M10 110V80h25V55h25V30h25V10h25v100z" fill="${fg}"/>`);
  }
}

const PLATE_ALT = [
  "Plate 1: a black disc set off-centre on a red field, ringed by fine white circles",
  "Plate 2: a halftone grid of pale dots growing larger toward one corner of a black field",
  "Plate 3: half discs in red, black and blue stacked like a totem",
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
      `<rect width="400" height="500" fill="#dcdcd4"/>` +
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
      `<linearGradient id="pl-fade" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${RED}"/><stop offset="1" stop-color="#ff8a1c"/></linearGradient>` +
      `</defs>` +
      `<rect width="400" height="500" fill="${PAPER}"/>` +
      `<rect width="400" height="500" fill="url(#pl-stripes)"/>` +
      `<path d="M0 500V140a360 360 0 0 1 360 360z" fill="url(#pl-fade)"/>`,
    attrs
  );
}
