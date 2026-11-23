// The v4 set: velvet at rest and mid-brush, the Manifesto-to-pillars handoff,
// the vacuum entrance into the Corridor, the tracer symbols, the finale words.
// One browser at a time, closed as soon as its run is done.
// Usage: node scripts/v4.mjs [url] [outDir] [run]
//   run: 1440 | wk393 | 1440-reduced | wk393-reduced (default: all, one after another)
import { chromium, webkit, devices } from "playwright-core";
import { mkdirSync } from "node:fs";

const url = process.argv[2] || "http://localhost:3210";
const out = process.argv[3] || "screenshots";
const only = process.argv[4];
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
  await page.waitForTimeout(run.reduced ? 900 : 3000);

  const shoot = async (name) => {
    maxOverflow = Math.max(
      maxOverflow,
      await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    );
    await page.screenshot({ path: `${out}/v4-${run.tag}-${name}.jpg`, type: "jpeg", quality: 84 });
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
  const go = async (sel, f = 0, mode = "through", wait = 1200) => {
    for (let i = 0; i < 3; i++) {
      const y = Math.max(0, Math.round(await target(sel, f, mode)));
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(i === 2 ? wait : 300);
    }
  };

  if (run.reduced) {
    // A clean cut from Editorial to a still Corridor.
    await go(".editorial", 1, "through", 1500);
    await shoot("entrance-1-editorial-end");
    await go(".corridor", 0, "within", 4500);
    await shoot("entrance-2-corridor-still");
    await go(".manifesto", 0, "within", 1500);
    await shoot("velvet-still");
    await go(".finale", 0, "within", 2500);
    await shoot("finale");
  } else {
    /* Velvet */
    await go(".manifesto", 0.12, "through", 2500);
    await shoot("velvet-1-rest");
    if (run.mobile) {
      // A finger drag across the cloth.
      await page.evaluate(async () => {
        const stage = document.querySelector(".mf-stage");
        const fire = (type, x, y) => {
          try {
            const t = new Touch({ identifier: 1, target: stage, clientX: x, clientY: y });
            stage.dispatchEvent(new TouchEvent(type, { touches: type === "touchend" ? [] : [t], changedTouches: [t], bubbles: true }));
          } catch {
            /* synthetic touches unavailable in this engine */
          }
        };
        fire("touchstart", 60, 520);
        for (let i = 0; i <= 30; i++) {
          fire("touchmove", 60 + i * 9, 520 - Math.sin(i / 5) * 120);
          await new Promise((r) => setTimeout(r, 16));
        }
        for (let i = 0; i <= 30; i++) {
          fire("touchmove", 330 - i * 9, 300 + Math.sin(i / 5) * 90);
          await new Promise((r) => setTimeout(r, 16));
        }
      });
    } else {
      // Against the nap first (darker), then with it (lighter), so both show.
      for (let i = 0; i <= 30; i++) {
        await page.mouse.move(1180 - i * 26, 250 + Math.sin(i / 5) * 90);
        await page.waitForTimeout(8);
      }
      for (let i = 0; i <= 34; i++) {
        await page.mouse.move(240 + i * 28, 640 - Math.sin(i / 6) * 200);
        await page.waitForTimeout(8);
      }
    }
    await page.waitForTimeout(120);
    await shoot("velvet-2-brushed");

    /* Manifesto into the pillars: no empty frame */
    await go(".bridge-columns", 0, "through", 1600);
    await shoot("handoff-1-last-line-lit");
    await go(".bridge-columns", 0.14, "through", 1400);
    await shoot("handoff-2-pillars-falling");
    await go(".bridge-columns", 0.5, "through", 1400);
    await shoot("handoff-3-pillars-mid");

    /* The vacuum entrance */
    await go(".editorial", 1, "through", 2400);
    await shoot("entrance-0-editorial-end");
    await go(".corridor", 0.035, "through", 3500);
    await shoot("entrance-1-start");
    await go(".corridor", 0.085, "through", 1500);
    await shoot("entrance-2-pulling");
    await go(".corridor", 0.125, "through", 1500);
    await shoot("entrance-3-darkening");
    await go(".corridor", 0.32, "through", 3200);
    await shoot("entrance-4-inside");

    /* The Corridor into the iris, no black gap */
    await go(".bridge-iris", 0.12, "through", 1400);
    await shoot("iris-start");

    /* Finale */
    await go(".finale", 0.45, "through", 1600);
    try {
      await page.waitForFunction(() => document.querySelectorAll(".sys-ch.is-hit").length >= 2, null, { timeout: 9000 });
    } catch {
      /* take it as it is */
    }
    await shoot("finale-1");
    await page.waitForTimeout(1700);
    await shoot("finale-2");

    /* Tracers */
    await go(".footer", 1, "through", 900);
    if (run.mobile) {
      await page.waitForTimeout(4200);
    } else {
      for (let i = 0; i <= 30; i++) {
        const t = i / 30;
        await page.mouse.move(run.width * (0.18 + 0.64 * t), run.height * (0.5 + 0.27 * Math.sin(t * Math.PI * 2)));
        await page.waitForTimeout(16);
      }
    }
    await shoot("tracers");
  }

  console.log(`${run.tag}: max horizontal overflow ${maxOverflow}px, errors ${errors.length}`);
  errors.slice(0, 5).forEach((e) => console.log("  ", e));
  await ctx.close();
  await browser.close();
}
