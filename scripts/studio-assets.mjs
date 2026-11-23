// Fetches the studio's CC0 assets from Poly Haven and saves them as small WebP
// files in public/studio/. Everything here is public domain (CC0):
//   https://polyhaven.com/a/brick_wall_001      (wall: colour, normal, AO/rough/metal)
//   https://polyhaven.com/a/dark_wooden_planks  (floor: colour, normal, AO/rough/metal)
//   https://polyhaven.com/a/art_studio          (HDRI, used as soft room light)
// Usage: node scripts/studio-assets.mjs
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync, statSync } from "node:fs";

const TEX = "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k";
const SOURCES = [
  // [name, url, quality]
  ["brick-color", `${TEX}/brick_wall_001/brick_wall_001_diffuse_1k.jpg`, 0.8],
  ["brick-normal", `${TEX}/brick_wall_001/brick_wall_001_nor_gl_1k.jpg`, 0.86],
  ["brick-arm", `${TEX}/brick_wall_001/brick_wall_001_arm_1k.jpg`, 0.74],
  ["floor-color", `${TEX}/dark_wooden_planks/dark_wooden_planks_diff_1k.jpg`, 0.78],
  ["floor-normal", `${TEX}/dark_wooden_planks/dark_wooden_planks_nor_gl_1k.jpg`, 0.84],
  ["floor-arm", `${TEX}/dark_wooden_planks/dark_wooden_planks_arm_1k.jpg`, 0.72],
];
const HDRI = "https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/art_studio.jpg";
const OUT = "public/studio";
mkdirSync(OUT, { recursive: true });

const get = async (url) => {
  const res = await fetch(url, { headers: { "User-Agent": "site-build-script" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
};

const browser = await chromium.launch({ channel: "chrome" });
try {
  const tool = await browser.newPage();
  const webp = async (buf, w, h, q) => {
    const dataUrl = await tool.evaluate(
      async ([b64, w, h, q]) => {
        const img = new Image();
        img.src = "data:image/jpeg;base64," + b64;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const g = c.getContext("2d");
        g.imageSmoothingQuality = "high";
        g.drawImage(img, 0, 0, w, h);
        return c.toDataURL("image/webp", q);
      },
      [buf.toString("base64"), w, h, q]
    );
    return Buffer.from(dataUrl.split(",")[1], "base64");
  };
  let total = { 1024: 0, 512: 0 };
  for (const [name, url, q] of SOURCES) {
    const src = await get(url);
    for (const size of [1024, 512]) {
      const file = `${OUT}/${name}-${size}.webp`;
      writeFileSync(file, await webp(src, size, size, size === 512 ? q - 0.04 : q));
      total[size] += statSync(file).size;
      console.log(file, Math.round(statSync(file).size / 1024) + " KB");
    }
  }
  const env = await get(HDRI);
  writeFileSync(`${OUT}/room.webp`, await webp(env, 1024, 512, 0.7));
  const envSize = statSync(`${OUT}/room.webp`).size;
  console.log(`${OUT}/room.webp`, Math.round(envSize / 1024) + " KB");
  console.log(
    `desktop set ${Math.round((total[1024] + envSize) / 1024)} KB, phone set ${Math.round((total[512] + envSize) / 1024)} KB`
  );
} finally {
  await browser.close();
}
