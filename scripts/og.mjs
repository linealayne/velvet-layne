// Renders the share card from the real intro screen.
// Usage: node scripts/og.mjs [url]
import { chromium } from "playwright-core";

const url = process.argv[2] || "http://localhost:3210";
const browser = await chromium.launch({
  channel: "chrome",
  args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(url, { waitUntil: "networkidle" });
await page.addStyleTag({ content: ".hud-chapter,.hud-bar,.cue{display:none!important}" });
await page.waitForTimeout(5000);
await page.screenshot({ path: "src/app/opengraph-image.png" });
await browser.close();
console.log("wrote src/app/opengraph-image.png");
