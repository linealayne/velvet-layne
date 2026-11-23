// Generates public/grain.png: sparse light and dark specks on transparency.
// A ready-made tile costs nothing at load, where an SVG noise filter has to be
// computed by the browser on every visit.
// Usage: node scripts/grain.mjs
import { chromium } from "playwright-core";
import { writeFileSync } from "node:fs";

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
const dataUrl = await page.evaluate(() => {
  const S = 128;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d");
  const img = g.createImageData(S, S);
  // Deterministic pseudo-random so the file is stable between runs.
  let seed = 20261122;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < S * S; i++) {
    const r = rnd();
    if (r > 0.22) continue; // most pixels stay clear, so flat colours stay true
    const light = rnd() > 0.5;
    const a = [70, 110, 150][Math.floor(rnd() * 3)]; // three levels compress well
    img.data[i * 4] = light ? 255 : 0;
    img.data[i * 4 + 1] = light ? 244 : 0;
    img.data[i * 4 + 2] = light ? 224 : 0;
    img.data[i * 4 + 3] = a;
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL("image/png");
});
const buf = Buffer.from(dataUrl.split(",")[1], "base64");
writeFileSync("public/grain.png", buf);
console.log("public/grain.png", Math.round(buf.length / 1024) + "kB");
await browser.close();
