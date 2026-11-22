// Screenshots of every chapter and every transition mid-motion.
// Usage: node scripts/shots.mjs [url] [outDir] [only=1440|390|reduced]
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const url = process.argv[2] || "http://localhost:3210";
const out = process.argv[3] || "screenshots";
const only = process.argv[4];
mkdirSync(out, { recursive: true });

const RUNS = [
  { tag: "1440", width: 1440, height: 900, reduced: false },
  { tag: "390", width: 390, height: 844, reduced: false, mobile: true },
  { tag: "1440-reduced", width: 1440, height: 900, reduced: true },
  { tag: "390-reduced", width: 390, height: 844, reduced: true, mobile: true },
].filter((r) => !only || r.tag.includes(only));

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
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(run.reduced ? 800 : 4200);

  const snap = async (name, y, opts = {}) => {
    await page.evaluate((v) => window.scrollTo(0, v), Math.max(0, Math.round(y)));
    await page.waitForTimeout(opts.wait ?? 1100);
    if (opts.mouse && !run.mobile) {
      await page.mouse.move(opts.mouse[0], opts.mouse[1], { steps: 12 });
      await page.waitForTimeout(500);
    }
    await page.screenshot({ path: `${out}/${run.tag}-${name}.png` });
  };

  const geo = () =>
    page.evaluate(() => {
      const box = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: r.top + window.scrollY, height: r.height };
      };
      return {
        vh: window.innerHeight,
        doc: document.documentElement.scrollHeight,
        overflowX: document.documentElement.scrollWidth - window.innerWidth,
        intro: box(".intro"),
        living: box(".living"),
        sweep: box(".bridge-sweep"),
        conveyor: box(".conveyor"),
        columns: box(".bridge-columns"),
        editorial: box(".editorial"),
        iris: box(".bridge-iris"),
        dimension: box(".dimension"),
        tiles: box(".bridge-tiles"),
        brutal: box(".brutal"),
        hinge: box(".bridge-hinge"),
        footer: box(".footer"),
      };
    });

  let g = await geo();
  const mid = (b, f) => b.top + (b.height - g.vh) * f;

  await snap("01-intro", 0, { wait: 300 });
  if (!run.reduced) await snap("01b-intro-to-living", mid(g.intro, 0.55));
  await snap("02-living-a", g.living.top + g.vh * 0.05, { mouse: [run.width * 0.4, run.height * 0.45] });
  await snap("02-living-b", g.living.top + g.living.height * 0.5, { mouse: [run.width * 0.6, run.height * 0.5] });
  if (!run.reduced) await snap("03a-sweep-mid", mid(g.sweep, 0.48));
  await snap("03-conveyor-title", mid(g.sweep, 1));
  g = await geo();
  await snap("03-conveyor", g.conveyor.top + 10, { mouse: [run.width * 0.5, run.height * 0.62] });
  await snap("03-conveyor-b", g.conveyor.top + g.conveyor.height - g.vh);
  if (!run.reduced) await snap("04a-columns-mid", mid(g.columns, 0.3));
  await snap("04-editorial-title", mid(g.columns, 1));
  await snap("04-editorial-a", g.editorial.top);
  await snap("04-editorial-b", g.editorial.top + g.editorial.height * 0.33, { wait: 2200 });
  await snap("04-editorial-c", g.editorial.top + g.editorial.height * 0.66, { wait: 2200 });
  if (!run.reduced) {
    await snap("05a-iris-mid-red", mid(g.iris, 0.36));
    await snap("05a-iris-mid-dark", mid(g.iris, 0.62));
  }
  await snap("05-dimension-title", mid(g.iris, 1));
  await snap("05-dimension-a", mid(g.dimension, 0.12), { wait: 2600, mouse: [run.width * 0.7, run.height * 0.4] });
  if (!run.reduced) await snap("05-dimension-b", mid(g.dimension, 0.8), { wait: 1600 });
  if (!run.reduced) await snap("06a-tiles-mid", mid(g.tiles, 0.42));
  await snap("06-brutal-title", mid(g.tiles, 1));
  await snap("06-brutal-a", g.brutal.top, { wait: 1800 });
  await snap("06-brutal-b", g.brutal.top + g.brutal.height * 0.4, { mouse: [run.width * 0.3, run.height * 0.45] });
  await snap("06-brutal-c", g.brutal.top + g.brutal.height - g.vh);
  if (!run.reduced) await snap("07a-hinge-mid", mid(g.hinge, 0.5));
  await snap("07-footer-title", mid(g.hinge, 1));
  await page.evaluate((v) => window.scrollTo(0, v), g.footer.top);
  await page.waitForTimeout(900);
  if (!run.mobile) {
    // Draw a curve so the tracers are caught mid-trail.
    for (let i = 0; i <= 26; i++) {
      const t = i / 26;
      await page.mouse.move(
        run.width * (0.2 + 0.6 * t),
        run.height * (0.5 + 0.25 * Math.sin(t * Math.PI * 2))
      );
      await page.waitForTimeout(16);
    }
  } else {
    await page.waitForTimeout(3200);
  }
  await page.screenshot({ path: `${out}/${run.tag}-07-footer.png` });

  g = await geo();
  console.log(
    `${run.tag}: doc ${g.doc}px, horizontal overflow ${g.overflowX}px, errors ${errors.length}`
  );
  errors.slice(0, 5).forEach((e) => console.log("  ", e));
  await ctx.close();
}
await browser.close();
