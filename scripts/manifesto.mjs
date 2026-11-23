// The Manifesto background: two frames a few seconds apart (drift), and one
// with the cursor passing through the threads.
// Usage: node scripts/manifesto.mjs [url] [outDir]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const url = process.argv[2] || "http://localhost:3210";
const out = process.argv[3] || "screenshots";
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", args: ["--enable-gpu", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
for (let i = 0; i < 3; i++) {
  await page.evaluate(() => {
    const r = document.querySelector(".manifesto").getBoundingClientRect();
    window.scrollTo(0, r.top + window.scrollY + (r.height - window.innerHeight) * 0.12);
  });
  await page.waitForTimeout(400);
}
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/manifesto-1440-drift-1.jpg`, type: "jpeg", quality: 88 });
await page.waitForTimeout(4000);
await page.screenshot({ path: `${out}/manifesto-1440-drift-2.jpg`, type: "jpeg", quality: 88 });
// Sweep the cursor through and catch the threads parting around it.
for (let i = 0; i <= 40; i++) {
  await page.mouse.move(300 + i * 16, 620 - i * 6);
  await page.waitForTimeout(24);
}
await page.waitForTimeout(250);
await page.screenshot({ path: `${out}/manifesto-1440-cursor.jpg`, type: "jpeg", quality: 88 });
await browser.close();
