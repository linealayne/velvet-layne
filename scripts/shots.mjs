// Screenshots of every chapter and every transition mid-motion.
// Usage: node scripts/shots.mjs [url] [outDir] [filter] [jpeg]
//   filter: substring of a run tag (1440, 390, reduced, 1024, 768, 375)
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const url = process.argv[2] || "http://localhost:3210";
const out = process.argv[3] || "screenshots";
const only = process.argv[4] && process.argv[4] !== "all" ? process.argv[4] : null;
const jpeg = process.argv[5] === "jpeg";
mkdirSync(out, { recursive: true });

const RUNS = [
  { tag: "1440", width: 1440, height: 900 },
  { tag: "390", width: 390, height: 844, mobile: true },
  { tag: "1440-reduced", width: 1440, height: 900, reduced: true },
  { tag: "390-reduced", width: 390, height: 844, reduced: true, mobile: true },
  { tag: "1024", width: 1024, height: 768, extra: true },
  { tag: "768", width: 768, height: 1024, extra: true, mobile: true },
  { tag: "375", width: 375, height: 667, extra: true, mobile: true },
].filter((r) => (only ? r.tag.includes(only) : !r.extra));

const browser = await chromium.launch({
  channel: "chrome",
  args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-gpu"],
});

for (const run of RUNS) {
  const ctx = await browser.newContext({
    viewport: { width: run.width, height: run.height },
    deviceScaleFactor: run.mobile ? 2 : 1,
    hasTouch: !!run.mobile,
    isMobile: !!run.mobile,
    reducedMotion: run.reduced ? "reduce" : "no-preference",
  });
  const page = await ctx.newPage();
  const errors = [];
  let maxOverflow = 0;
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(run.reduced ? 800 : 4200);

  // Where is `f` of the way through this element's scroll range right now?
  // Off-screen chapters are only measured once they are near, so we scroll,
  // re-measure and correct until the position holds.
  const target = (sel, f, mode) =>
    page.evaluate(
      ([sel, f, mode]) => {
        const el = document.querySelector(sel);
        const r = el.getBoundingClientRect();
        const top = r.top + window.scrollY;
        const vh = window.innerHeight;
        if (mode === "through") return top + (r.height - vh) * f;
        return top + r.height * f;
      },
      [sel, f, mode]
    );

  const snap = async (name, sel, f = 0, opts = {}) => {
    for (let i = 0; i < 3; i++) {
      const y = Math.max(0, Math.round(await target(sel, f, opts.mode ?? "through")));
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(i === 2 ? (opts.wait ?? 1100) : 250);
    }
    if (opts.mouse && !run.mobile) {
      await page.mouse.move(run.width * opts.mouse[0], run.height * opts.mouse[1], { steps: 12 });
      await page.waitForTimeout(500);
    }
    if (opts.trail) await opts.trail();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    maxOverflow = Math.max(maxOverflow, overflow);
    await page.screenshot({
      path: `${out}/${run.tag}-${name}.${jpeg ? "jpg" : "png"}`,
      ...(jpeg ? { type: "jpeg", quality: 82 } : {}),
    });
  };

  const moving = !run.reduced;
  await snap("01-intro", ".intro", 0, { wait: 300 });
  if (moving) await snap("01b-intro-to-living", ".intro", 0.55);
  await snap("02-living-a", ".living", 0.03, { mode: "within", mouse: [0.3, 0.3] });
  await snap("02-living-b", ".living", 0.5, { mode: "within", mouse: [0.6, 0.5] });
  if (moving) await snap("03a-sweep-mid", ".bridge-sweep", 0.48);
  await snap("03-conveyor-title", ".bridge-sweep", 1);
  await snap("03-conveyor", ".conveyor", 0, { mode: "within", mouse: [0.5, 0.62] });
  await snap("03-conveyor-b", ".conveyor", 1);
  if (moving) await snap("04a-columns-mid", ".bridge-columns", 0.3);
  await snap("04-editorial-title", ".bridge-columns", 1);
  await snap("04-editorial-a", ".editorial", 0, { mode: "within" });
  await snap("04-editorial-b", ".editorial", 0.33, { mode: "within", wait: 2200 });
  await snap("04-editorial-c", ".editorial", 0.66, { mode: "within", wait: 2200 });
  if (moving) {
    await snap("05a-iris-mid-red", ".bridge-iris", 0.36);
    await snap("05a-iris-mid-dark", ".bridge-iris", 0.62);
  }
  await snap("05-dimension-title", ".bridge-iris", 1);
  await snap("05-dimension-a", ".dimension", 0.12, { wait: 2800, mouse: [0.7, 0.4] });
  if (moving) await snap("05-dimension-b", ".dimension", 0.8, { wait: 1600 });
  if (moving) await snap("06a-tiles-mid", ".bridge-tiles", 0.42);
  await snap("06-brutal-title", ".bridge-tiles", 1);
  await snap("06-brutal-a", ".brutal", 0, { mode: "within", wait: 1800 });
  await snap("06-brutal-b", ".brutal", 0.4, { mode: "within", mouse: [0.3, 0.45] });
  await snap("06-brutal-c", ".brutal", 1);
  if (moving) await snap("07a-hinge-mid", ".bridge-hinge", 0.5);
  await snap("07-footer-title", ".bridge-hinge", 1);
  await snap("07-footer", ".footer", 1, {
    wait: 900,
    trail: async () => {
      if (run.mobile) return page.waitForTimeout(3600);
      // Draw a curve so the tracers are caught mid-trail.
      for (let i = 0; i <= 26; i++) {
        const t = i / 26;
        await page.mouse.move(
          run.width * (0.2 + 0.6 * t),
          run.height * (0.5 + 0.25 * Math.sin(t * Math.PI * 2))
        );
        await page.waitForTimeout(16);
      }
    },
  });

  const doc = await page.evaluate(() => document.documentElement.scrollHeight);
  console.log(
    `${run.tag}: doc ${doc}px, max horizontal overflow ${maxOverflow}px, errors ${errors.length}`
  );
  errors.slice(0, 5).forEach((e) => console.log("  ", e));
  await ctx.close();
}
await browser.close();
