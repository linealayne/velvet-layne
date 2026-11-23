// The v5 set: the molten-to-velvet entrance, the ribbon entrance into the
// Corridor, every hero letter mid-scene, and the first L at three moments of
// one activation. One browser at a time; each run closes its own browser.
// Usage: node scripts/v5.mjs [url] [outDir] [run] [part]
//   run:  1440 | wk393 | 1440-reduced | wk393-reduced (default: all, in turn)
//   part: velvet | ribbons | letters (default: all)
import { chromium, webkit, devices } from "playwright-core";
import { mkdirSync } from "node:fs";

const url = process.argv[2] || "http://localhost:3210";
const out = process.argv[3] || "screenshots";
const only = process.argv[4] && process.argv[4] !== "all" ? process.argv[4] : null;
const part = process.argv[5];
mkdirSync(out, { recursive: true });

const RUNS = [
  { tag: "1440", width: 1440, height: 900 },
  { tag: "wk393", width: 393, height: 852, mobile: true, engine: "webkit", device: "iPhone 15" },
  { tag: "1440-reduced", width: 1440, height: 900, reduced: true },
  { tag: "wk393-reduced", width: 393, height: 852, mobile: true, reduced: true, engine: "webkit", device: "iPhone 15" },
].filter((r) => !only || r.tag === only);

for (const run of RUNS) {
  const browser =
    run.engine === "webkit"
      ? await webkit.launch()
      : await chromium.launch({ channel: "chrome", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
  try {
    const ctx = await browser.newContext({
      ...(run.device ? devices[run.device] : {}),
      viewport: { width: run.width, height: run.height },
      reducedMotion: run.reduced ? "reduce" : "no-preference",
    });
    const page = await ctx.newPage();
    const errors = [];
    let maxOverflow = 0;
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(url, { waitUntil: "networkidle" });
    // Long enough for every letter shader to finish compiling in the background.
    await page.waitForTimeout(run.reduced ? 2500 : 6500);

    const shoot = async (name, clip) => {
      maxOverflow = Math.max(
        maxOverflow,
        await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      );
      await page.screenshot({
        path: `${out}/v5-${run.tag}-${name}.jpg`,
        type: "jpeg",
        quality: 84,
        ...(clip ? { clip } : {}),
      });
    };
    const target = (sel, f, mode) =>
      page.evaluate(
        ([sel, f, mode]) => {
          const r = document.querySelector(sel).getBoundingClientRect();
          const top = r.top + window.scrollY;
          return mode === "within" ? top + r.height * f : top + (r.height - window.innerHeight) * f;
        },
        [sel, f, mode]
      );
    const go = async (sel, f = 0, mode = "through", wait = 1300) => {
      for (let i = 0; i < 3; i++) {
        const y = Math.max(0, Math.round(await target(sel, f, mode)));
        await page.evaluate((v) => window.scrollTo(0, v), y);
        await page.waitForTimeout(i === 2 ? wait : 300);
      }
    };
    const want = (p) => !part || part === p;

    /* Every letter mid-scene, and the first L three times in one activation */
    if (want("letters")) {
      const rect = (i) =>
        page.evaluate((i) => {
          const r = document.querySelectorAll(".lt")[i].getBoundingClientRect();
          return { x: r.left, y: r.top, width: r.width, height: r.height };
        }, i);
      const fire = async (i) => {
        const r = await rect(i);
        if (run.mobile) await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
        else await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2, { steps: 4 });
      };
      const NAMES = ["V", "E", "L", "V", "E", "T", "L", "A", "Y", "N", "E"];
      if (!run.reduced) {
        // The first L, held: early, middle and late in the same activation.
        await fire(2);
        for (const [n, ms] of [[1, run.mobile ? 1300 : 420], [2, 520], [3, 560]]) {
          await page.waitForTimeout(ms);
          await shoot(`letter-L-held-${n}`, await rect(2));
        }
        if (run.mobile) await page.waitForTimeout(2400);
        else await page.mouse.move(run.width / 2, run.height - 3);
        await page.waitForTimeout(900);
      }
      for (let i = 0; i < 11; i++) {
        await fire(i);
        await page.waitForTimeout(run.reduced ? 900 : run.mobile ? 1700 : 1150);
        await shoot(`letter-${String(i).padStart(2, "0")}-${NAMES[i]}`, await rect(i));
        if (run.mobile && !run.reduced) await page.waitForTimeout(2300);
      }
      if (!run.mobile) await page.mouse.move(run.width / 2, run.height - 3);
      await page.waitForTimeout(600);
    }

    /* Molten cools into velvet */
    if (want("velvet")) {
      if (run.reduced) {
        await go(".manifesto", -0.12, "within", 1500);
        await shoot("velvet-crossfade");
      } else {
        for (const [n, f] of [[1, 0.36], [2, 0.55], [3, 0.74], [4, 0.97]]) {
          await go(".intro", f, "through", 1500);
          await shoot(`velvet-${n}`);
        }
        await go(".intro", 1.08, "through", 1500);
        await shoot("velvet-5-first-words");
      }
    }

    /* The ribbon entrance */
    if (want("ribbons")) {
      if (run.reduced) {
        await go(".editorial", 1, "through", 1500);
        await shoot("ribbons-editorial-end");
        await go(".corridor", 0, "within", 4500);
        await shoot("ribbons-corridor-still");
      } else {
        await go(".editorial", 1, "through", 2600);
        await shoot("ribbons-0-page");
        for (const [name, f] of [
          ["1-coming-loose", 0.035],
          ["2-flowing", 0.075],
          ["3-pulled-back", 0.14],
          ["4-becoming-walls", 0.215],
          ["5-inside", 0.42],
        ]) {
          await go(".corridor", f, "through", name.startsWith("1") ? 3400 : 1700);
          await shoot(`ribbons-${name}`);
        }
      }
    }

    console.log(`${run.tag}: max horizontal overflow ${maxOverflow}px, errors ${errors.length}`);
    errors.slice(0, 5).forEach((e) => console.log("  ", e));
  } finally {
    // Closes only the browser this run started.
    await browser.close();
  }
}
