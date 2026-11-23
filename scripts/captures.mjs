// Captures Layne's own live Linea demo sites for the Corridor panels.
// 1440 wide in a real browser, then down-sized and saved as small WebP files.
// Usage: node scripts/captures.mjs
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

// Demo and concept sites listed in the Lab on lineaautomations.com.
// Client sites are left out on purpose.
const SITES = [
  ["blendwell", "https://smoothie.lineaautomations.com/"],
  ["hollis", "https://hollis.lineaautomations.com/"],
  ["ashgrove", "https://ashgrove.lineaautomations.com/"],
  ["cairn", "https://cairn.lineaautomations.com/"],
  ["auren", "https://auren.lineaautomations.com/"],
  ["rove", "https://rove-two-mocha.vercel.app/"],
];
const OUT = "public/work";
const W = 800;
const H = 500;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", args: ["--enable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const tool = await browser.newPage();

const save = async (name) => {
  const png = await page.screenshot({ type: "png" });
  const dataUrl = await tool.evaluate(
    async ([b64, w, h]) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      return c.toDataURL("image/webp", 0.72);
    },
    [png.toString("base64"), W, H]
  );
  const buf = Buffer.from(dataUrl.split(",")[1], "base64");
  writeFileSync(`${OUT}/${name}.webp`, buf);
  console.log(name, Math.round(buf.length / 1024) + "kB");
};

for (const [name, url] of SITES) {
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  } catch {
    console.log(name, "did not reach network idle, capturing anyway");
  }
  await page.waitForTimeout(3500);
  await save(`${name}-1`);
  // A second frame further down the page.
  await page.mouse.move(720, 450);
  for (let i = 0; i < 14; i++) {
    await page.mouse.wheel(0, 130);
    await page.waitForTimeout(90);
  }
  await page.waitForTimeout(1800);
  await save(`${name}-2`);
}
await browser.close();
