// The v7 set: the restored "4" screen, every beat of the studio sequence, the
// three rebuilt letters, refresh-to-top, and the frame rate through the
// sequence. One browser at a time; each run closes its own browser.
// Usage: node scripts/v7.mjs [url] [outDir] [run] [part]
//   run:  1440 | 1440x700 | wk393 | 1440-reduced | wk393-reduced (default: all but 1440x700)
//   part: studio | letters | top | fps (default: all)
import { chromium, webkit, devices } from "playwright-core";
import { mkdirSync } from "node:fs";

const url = process.argv[2] || "http://localhost:3210";
const out = process.argv[3] || "screenshots";
const only = process.argv[4] && process.argv[4] !== "all" ? process.argv[4] : null;
const part = process.argv[5];
mkdirSync(out, { recursive: true });

const ENTRANCE = 0.54; // as in Corridor.tsx

const RUNS = [
  { tag: "1440", width: 1440, height: 900 },
  { tag: "1440x700", width: 1440, height: 700, extra: true },
  { tag: "wk393", width: 393, height: 852, mobile: true, engine: "webkit", device: "iPhone 15" },
  { tag: "1440-reduced", width: 1440, height: 900, reduced: true },
  { tag: "wk393-reduced", width: 393, height: 852, mobile: true, reduced: true, engine: "webkit", device: "iPhone 15" },
].filter((r) => (only ? r.tag === only : !r.extra));

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
    await page.waitForTimeout(run.reduced ? 2500 : 6500);

    const shoot = async (name, clip) => {
      maxOverflow = Math.max(
        maxOverflow,
        await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      );
      await page.screenshot({
        path: `${out}/v7-${run.tag}-${name}.jpg`,
        type: "jpeg",
        quality: 86,
        ...(clip ? { clip } : {}),
      });
    };
    const want = (p) => !part || part === p;
    // Scroll position for a given point of the entrance (vac 0..1, or beyond for inside).
    const at = (vac) =>
      page.evaluate(
        ([vac, E]) => {
          const r = document.querySelector(".corridor").getBoundingClientRect();
          return r.top + window.scrollY + (r.height - window.innerHeight) * E * vac;
        },
        [vac, ENTRANCE]
      );
    const go = async (vac, wait = 1500) => {
      for (let i = 0; i < 3; i++) {
        await page.evaluate((v) => window.scrollTo(0, v), Math.round(await at(vac)));
        await page.waitForTimeout(i === 2 ? wait : 250);
      }
    };
    // Walk down like a visitor, so every chapter on the way wakes up.
    const travel = async () => {
      const goal = (await at(0)) - run.height * 0.5;
      for (let y = 0; y < goal; y += run.height * 0.6) {
        await page.evaluate((v) => window.scrollTo(0, v), y);
        await page.waitForTimeout(160);
      }
      await page.waitForTimeout(2600);
    };

    /* Every reload starts at the top */
    if (want("top") && !run.reduced) {
      const before = await page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight * 0.45);
        return window.scrollY;
      });
      await page.waitForTimeout(900);
      await page.reload({ waitUntil: "domcontentloaded" });
      const ys = [];
      for (const t of [0, 150, 600, 1800]) {
        await page.waitForTimeout(t ? t : 1);
        ys.push(await page.evaluate(() => Math.round(window.scrollY)));
      }
      await shoot("refresh-lands-at-top");
      console.log(`  ${run.tag}: reloaded at y=${Math.round(before)}; scroll after reload: ${ys.join(", ")}`);
      await page.waitForTimeout(4500);
    }

    /* The three rebuilt letters, mid-scene */
    if (want("letters")) {
      const rect = (i) =>
        page.evaluate((i) => {
          const r = document.querySelectorAll(".lt")[i].getBoundingClientRect();
          return { x: r.left, y: r.top, width: r.width, height: r.height };
        }, i);
      for (const [i, name] of [[0, "V"], [5, "T"], [10, "E"]]) {
        const r = await rect(i);
        if (run.mobile) await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
        else await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2, { steps: 4 });
        await page.waitForTimeout(run.reduced ? 900 : run.mobile ? 1700 : 1200);
        await shoot(`letter-${String(i).padStart(2, "0")}-${name}`, await rect(i));
        if (run.mobile && !run.reduced) await page.waitForTimeout(2300);
      }
      if (!run.mobile) await page.mouse.move(run.width / 2, run.height - 3);
      await page.waitForTimeout(500);
    }

    /* The "4" screen and the studio sequence */
    if (want("studio")) {
      if (run.reduced) {
        const step = async (sel, f, name) => {
          for (let i = 0; i < 3; i++) {
            await page.evaluate(
              ([sel, f]) => {
                const r = document.querySelector(sel).getBoundingClientRect();
                window.scrollTo(0, r.top + window.scrollY + (r.height - window.innerHeight) * f);
              },
              [sel, f]
            );
            await page.waitForTimeout(i === 2 ? 1500 : 300);
          }
          await shoot(name);
        };
        await step(".editorial", 1, "studio-00-four-screen");
        await page.waitForTimeout(3500);
        await step(".studio-still", 0, "studio-still-wall");
        await step(".cor-stage", 0, "studio-still-tunnel");
      } else {
        await travel();
        await go(0, 2600);
        await shoot("studio-00-four-screen");
        await go(0.07, 1700);
        await shoot("studio-01-crumple-start");
        await go(0.14, 1500);
        await shoot("studio-02-crumpling");
        await go(0.235, 1500);
        await shoot("studio-03-crumple-end");
        await go(0.3, 1700);
        await shoot("studio-04-studio-revealed");
        // The throw plays on its own clock once it is let go.
        await page.evaluate((v) => window.scrollTo(0, v), Math.round(await at(0.37)));
        const t0 = Date.now();
        for (const [ms, name] of [
          [560, "05-ball-mid-arc"],
          [1000, "06-ball-off-the-wall"],
          [1420, "07-ball-on-the-rim"],
          [2600, "08-ball-in-the-bin"],
        ]) {
          await page.waitForTimeout(Math.max(0, ms - (Date.now() - t0)));
          await shoot(`studio-${name}`);
        }
        // The shake only exists while the page is being scrolled.
        const y0 = await at(0.5);
        await page.evaluate((v) => window.scrollTo(0, v), Math.round(y0));
        await page.waitForTimeout(700);
        for (let i = 0; i < 10; i++) {
          if (run.mobile) await page.evaluate((v) => window.scrollBy(0, v), i % 2 ? -26 : 34);
          else await page.mouse.wheel(0, i % 2 ? -50 : 70);
          await page.waitForTimeout(50);
        }
        await shoot("studio-09-shake");
        await go(0.64, 1500);
        await shoot("studio-10-bricks-leaving");
        await go(0.74, 1500);
        await shoot("studio-11-wall-going");
        await go(0.84, 1500);
        await shoot("studio-12-frames-gliding");
        await go(0.92, 1500);
        await shoot("studio-13-landing");
        await go(1.12, 2000);
        await shoot("studio-14-inside-the-tunnel");
      }
    }

    /* Frame rate through the whole sequence */
    if (want("fps") && !run.reduced) {
      const measure = (a, b) => page.evaluate(
        ([a, b]) =>
          new Promise((resolve) => {
            const T = 14000;
            const gaps = [];
            let last = 0;
            const t0 = performance.now();
            const tick = (t) => {
              if (last) gaps.push(t - last);
              last = t;
              const k = Math.min(1, (t - t0) / T);
              window.scrollTo(0, a + (b - a) * k);
              if (k < 1) requestAnimationFrame(tick);
              else {
                gaps.sort((x, y) => x - y);
                const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
                resolve({
                  fps: Math.round(1000 / mean),
                  worst5: Math.round(1000 / gaps[Math.floor(gaps.length * 0.95)]),
                  slowest: Math.round(gaps[gaps.length - 1]),
                  frames: gaps.length,
                });
              }
            };
            requestAnimationFrame(tick);
          }),
        [a, b]
      );
      const say = (what, res) =>
        console.log(
          `  ${run.tag}: ${what}: ${res.fps} fps average, 95% of frames at ${res.worst5} fps or better, slowest frame ${res.slowest}ms (${res.frames} frames over 14s)`
        );
      await travel();
      await go(0, 2500);
      say("through the studio sequence", await measure(await at(0), await at(1.02)));
      // The tunnel on its own, for comparison (it is unchanged).
      await go(1.1, 1500);
      say("inside the tunnel", await measure(await at(1.1), await at(1.7)));
    }

    console.log(`${run.tag}: max horizontal overflow ${maxOverflow}px, errors ${errors.length}`);
    errors.slice(0, 5).forEach((e) => console.log("  ", e));
  } finally {
    // Closes only the browser this run started.
    await browser.close();
  }
}
