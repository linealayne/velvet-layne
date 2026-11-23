// The v6 set: the hero on a fresh load and after a refresh (nothing from the
// Manifesto may show), refreshes part way down the page, and the suction
// entrance into the Corridor. One browser at a time; each run closes its own.
// Usage: node scripts/v6.mjs [url] [outDir] [run] [part]
//   run:  1440 | wk393 | 1440-reduced | wk393-reduced (default: all, in turn)
//   part: hero | refresh | suction (default: all)
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

    const shoot = async (name) => {
      maxOverflow = Math.max(
        maxOverflow,
        await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      );
      await page.screenshot({ path: `${out}/v6-${run.tag}-${name}.jpg`, type: "jpeg", quality: 84 });
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
    // What of the Manifesto can be seen in the viewport right now (0 = nothing).
    const manifestoShowing = () =>
      page.evaluate(() => {
        const seen = (sel) => {
          const el = document.querySelector(sel);
          if (!el) return 0;
          const r = el.getBoundingClientRect();
          if (r.bottom <= 0 || r.top >= window.innerHeight) return 0;
          return Number(getComputedStyle(el).opacity);
        };
        return { lines: seen(".mf-lines"), back: seen(".mf-back") };
      });
    const want = (p) => !part || part === p;

    await page.goto(url, { waitUntil: "networkidle" });

    /* The hero: fresh load, then a refresh. No input is sent, so the chapters
       below the hero have not hydrated: this is the state that used to leak. */
    if (want("hero")) {
      await page.waitForTimeout(400);
      await shoot("hero-1-fresh-load-early");
      console.log(`  ${run.tag} fresh load, 0.4s: manifesto`, JSON.stringify(await manifestoShowing()));
      await page.waitForTimeout(3200);
      await shoot("hero-2-fresh-load");
      console.log(`  ${run.tag} fresh load, 3.6s: manifesto`, JSON.stringify(await manifestoShowing()));
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(350);
      await shoot("hero-3-refresh-early");
      console.log(`  ${run.tag} refresh, 0.35s: manifesto`, JSON.stringify(await manifestoShowing()));
      await page.waitForTimeout(3300);
      await shoot("hero-4-refresh");
      console.log(`  ${run.tag} refresh, 3.6s: manifesto`, JSON.stringify(await manifestoShowing()));
    }

    /* Refresh part way down: the browser restores the scroll position, and
       each chapter must come back in the state for that position. */
    if (want("refresh") && !run.reduced) {
      for (const [name, sel, f, mode] of [
        ["hero-parting", ".intro", 0.12, "through"],
        ["velvet-settling", ".intro", 0.7, "through"],
        ["manifesto", ".manifesto", 0.55, "through"],
        ["editorial", ".editorial", 0.45, "through"],
        ["editorial-last-screen", ".editorial", 1, "through"],
        ["corridor-inside", ".corridor", 0.6, "through"],
        ["dimension", ".dimension", 0.5, "through"],
      ]) {
        await go(sel, f, mode, 900);
        const y = await page.evaluate(() => window.scrollY);
        await page.reload({ waitUntil: "domcontentloaded" });
        // The browser restores the offset itself; only if it has not by then
        // is it put back by hand.
        await page.waitForTimeout(250);
        await page.evaluate((v) => Math.abs(window.scrollY - v) > 4 && window.scrollTo(0, v), y);
        await page.waitForTimeout(60);
        await shoot(`refresh-${name}-early`);
        await page.waitForTimeout(3200);
        await shoot(`refresh-${name}`);
        // Where did the page come back? (the chapter under the middle of the screen)
        const at = await page.evaluate(() => {
          const mid = window.innerHeight / 2;
          const hit = [...document.querySelectorAll("main > section, main > .hero")].filter((e) => {
            const r = e.getBoundingClientRect();
            return r.top <= mid && r.bottom >= mid;
          });
          return hit.map((e) => e.className.split(" ")[0]).join("+") + " y=" + Math.round(window.scrollY);
        });
        console.log(`  ${run.tag} refresh at ${name} (y=${Math.round(y)}): back at ${at}`);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(600);
    }

    /* The suction entrance */
    if (want("suction")) {
      if (run.reduced) {
        await go(".editorial", 1, "through", 1500);
        await shoot("suction-editorial-end");
        await go(".corridor", 0, "within", 4500);
        await shoot("suction-corridor-still");
      } else {
        await go(".intro", 0.5, "through", 2500);
        await go(".editorial", 1, "through", 2600);
        await shoot("suction-1-flat-page");
        const E = 0.32; // ENTRANCE in Corridor.tsx
        for (const [name, vac] of [
          ["2-tremor", 0.1],
          ["3-early-pull", 0.3],
          ["4-deep-funnel", 0.46],
          ["5-hole-shows-tunnel", 0.64],
          ["5b-edges-go", 0.78],
          ["6-inside", 1.25],
        ]) {
          await go(".corridor", vac * E, "through", name.startsWith("2") ? 3200 : 1700);
          await shoot(`suction-${name}`);
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
