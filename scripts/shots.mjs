// Screenshots of the whole show: hero at rest, letters mid-hover, the scroll
// cue mid-roll, every chapter, every transition mid-motion, reduced motion.
// Usage: node scripts/shots.mjs [url] [outDir] [filter] [jpeg]
//   filter: substring of a run tag (1440, 390, reduced, 1024, 768, 375) or "all"
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
  await page.waitForTimeout(run.reduced ? 900 : 4200);

  const shoot = async (name, clip) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    maxOverflow = Math.max(maxOverflow, overflow);
    await page.screenshot({
      path: `${out}/${run.tag}-${name}.${jpeg ? "jpg" : "png"}`,
      ...(jpeg ? { type: "jpeg", quality: 82 } : {}),
      ...(clip ? { clip } : {}),
    });
  };

  // Off-screen chapters are only measured once they are near, so scroll,
  // re-measure and correct until the position holds.
  const target = (sel, f, mode) =>
    page.evaluate(
      ([sel, f, mode]) => {
        const r = document.querySelector(sel).getBoundingClientRect();
        const top = r.top + window.scrollY;
        if (mode === "through") return top + (r.height - window.innerHeight) * f;
        return top + r.height * f;
      },
      [sel, f, mode]
    );
  const go = async (sel, f = 0, mode = "through", wait = 1100) => {
    for (let i = 0; i < 3; i++) {
      const y = Math.max(0, Math.round(await target(sel, f, mode)));
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(i === 2 ? wait : 250);
    }
  };
  const snap = async (name, sel, f = 0, opts = {}) => {
    await go(sel, f, opts.mode ?? "through", opts.wait);
    if (opts.mouse && !run.mobile) {
      await page.mouse.move(run.width * opts.mouse[0], run.height * opts.mouse[1], { steps: 12 });
      await page.waitForTimeout(500);
    }
    await shoot(name);
  };
  const moving = !run.reduced;

  /* Hero */
  await shoot("01-hero-rest");
  const letter = (i) =>
    page.evaluate((i) => {
      const r = document.querySelectorAll(".lt")[i].getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, i);
  // Three different letters mid-hover (tapped on touch screens).
  for (const [n, i] of [[1, 0], [2, 3], [3, 7]]) {
    const p = await letter(i);
    if (run.mobile) await page.touchscreen.tap(p.x, p.y);
    else await page.mouse.move(p.x, p.y, { steps: 6 });
    await page.waitForTimeout(700);
    await shoot(`01-hero-hover-${n}`);
    if (run.mobile) await page.waitForTimeout(2600);
  }
  // A sweep: several letters lit at once.
  if (!run.mobile) {
    for (const i of [6, 8, 9, 10]) {
      const p = await letter(i);
      await page.mouse.move(p.x, p.y, { steps: 5 });
      await page.waitForTimeout(160);
    }
    await page.waitForTimeout(250);
    await shoot("01-hero-hover-sweep");
    await page.mouse.move(run.width / 2, run.height - 4);
    await page.waitForTimeout(1200);
  }
  // The scroll cue, caught mid-roll.
  if (moving) {
    const cue = await page.evaluate(() => {
      const r = document.querySelector(".cue").getBoundingClientRect();
      return { x: Math.max(0, r.left - 60), y: Math.max(0, r.top - 40), width: r.width + 120, height: r.height + 70 };
    });
    for (let n = 0; n < 3; n++) {
      await page.waitForTimeout(430);
      await shoot(`01-cue-${n}`, cue);
    }
    await snap("01b-hero-parting", ".intro", 0.22);
    await snap("01c-hero-cooling", ".intro", 0.86);
  }

  /* Manifesto */
  await snap("02-manifesto-a", ".manifesto", 0.3, { mouse: [0.6, 0.4] });
  if (moving) await snap("02-manifesto-b", ".manifesto", 0.8);

  /* Editorial */
  if (moving) await snap("03a-columns-mid", ".bridge-columns", 0.4);
  await snap("03-editorial-a", ".editorial", 0, { mode: "within", wait: 1800 });
  await snap("03-editorial-b", ".editorial", 0.36, { mode: "within", wait: 2200 });
  await snap("03-editorial-c", ".editorial", 0.7, { mode: "within", wait: 2200 });

  /* Corridor */
  if (moving) {
    await snap("04a-fade-early", ".corridor", 0.07, { wait: 2600 });
    await snap("04a-fade-mid", ".corridor", 0.14);
    await snap("04-corridor-a", ".corridor", 0.4, { wait: 1800, mouse: [0.55, 0.45] });
    await page.waitForTimeout(350);
    await shoot("04-corridor-b");
    await snap("04-corridor-c", ".corridor", 0.75, { wait: 1200 });
    await snap("05a-iris-mid-red", ".bridge-iris", 0.4);
    await snap("05a-iris-mid-dark", ".bridge-iris", 0.72);
  } else {
    await snap("04-corridor", ".corridor", 0, { wait: 4200 });
  }

  /* Dimension */
  await snap("05-dimension-a", ".dimension", 0.12, { wait: 2800, mouse: [0.7, 0.4] });
  if (moving) await snap("05-dimension-b", ".dimension", 0.8, { wait: 1600 });

  /* Brutal */
  if (moving) await snap("06a-tiles-mid", ".bridge-tiles", 0.45);
  await snap("06-brutal-a", ".brutal", 0, { mode: "within", wait: 1800 });
  await snap("06-brutal-b", ".brutal", 0.4, { mode: "within", mouse: [0.3, 0.45] });
  await snap("06-brutal-c", ".brutal", 1);

  /* Finale */
  if (moving) await snap("07a-hinge-mid", ".bridge-hinge", 0.5);
  await go(".finale", 0.45, "through", 1600);
  // Wait for a tile to be crossing a letter.
  try {
    await page.waitForFunction(() => document.querySelectorAll(".sys-ch.is-hit").length >= 2, null, { timeout: 9000 });
  } catch {
    /* take it as it is */
  }
  await shoot("07-finale-a");
  if (moving) {
    await page.waitForTimeout(1500);
    await shoot("07-finale-b");
  }

  /* Footer */
  await go(".footer", 1, "through", 900);
  if (!run.mobile && moving) {
    // Draw a curve so the tracers are caught mid-trail.
    for (let i = 0; i <= 26; i++) {
      const t = i / 26;
      await page.mouse.move(
        run.width * (0.2 + 0.6 * t),
        run.height * (0.5 + 0.25 * Math.sin(t * Math.PI * 2))
      );
      await page.waitForTimeout(16);
    }
  } else if (moving) {
    await page.waitForTimeout(3600);
  }
  await shoot("08-footer");

  const doc = await page.evaluate(() => document.documentElement.scrollHeight);
  console.log(
    `${run.tag}: doc ${doc}px, max horizontal overflow ${maxOverflow}px, errors ${errors.length}`
  );
  errors.slice(0, 5).forEach((e) => console.log("  ", e));
  await ctx.close();
}
await browser.close();
