// Cold first visit on a throttled connection: is the Corridor populated the
// moment it comes on screen?
// Usage: node scripts/cold.mjs [url] [outDir]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const url = process.argv[2] || "http://localhost:3210";
const out = process.argv[3] || "screenshots";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-gpu"],
});

for (const run of [
  { tag: "1440", width: 1440, height: 900 },
  { tag: "393", width: 393, height: 852, mobile: true },
]) {
  // A fresh context every time: nothing cached, nothing warm.
  const ctx = await browser.newContext({
    viewport: { width: run.width, height: run.height },
    deviceScaleFactor: run.mobile ? 2 : 1,
    hasTouch: !!run.mobile,
    isMobile: !!run.mobile,
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  // Chrome DevTools "Fast 4G".
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 165,
    downloadThroughput: (9 * 1024 * 1024) / 8,
    uploadThroughput: (1.5 * 1024 * 1024) / 8,
  });
  const t0 = Date.now();
  await page.goto(url, { waitUntil: "load" });
  // Look at the hero for a moment, then scroll straight down without stopping.
  await page.waitForTimeout(1800);
  const top = () =>
    page.evaluate(() => document.querySelector(".corridor").getBoundingClientRect().top);
  const scrollBy = (dy) =>
    run.mobile ? page.evaluate((v) => window.scrollBy(0, v), dy) : page.mouse.wheel(0, dy);
  if (!run.mobile) await page.mouse.move(run.width / 2, run.height / 2);
  // About 2600px a second: a visitor in a hurry.
  while ((await top()) > run.height * 0.55) {
    await scrollBy(80);
    await page.waitForTimeout(30);
  }
  const arrived = ((Date.now() - t0) / 1000).toFixed(1);
  const shot = (name) => page.screenshot({ path: `${out}/cold-${run.tag}-${name}.png` });
  await shot("1-entering");
  while ((await top()) > -run.height * 0.45) {
    await scrollBy(80);
    await page.waitForTimeout(30);
  }
  await shot("2-paper-thinning");
  while ((await top()) > -run.height * 1.1) {
    await scrollBy(80);
    await page.waitForTimeout(30);
  }
  await shot("3-open");
  const state = await page.evaluate(() => ({
    live: !!document.querySelector(".cor-canvas.is-live"),
    canvas: !!document.querySelector(".cor-canvas canvas"),
  }));
  console.log(`cold ${run.tag}: reached the Corridor ${arrived}s after navigation,`, JSON.stringify(state));
  await ctx.close();
}
await browser.close();
