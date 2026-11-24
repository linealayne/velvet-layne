// The v8 set: the handoff from the "4" page to the 3D sheet, the paper crumple
// in close-up, the pull-back, the reverse, the frame rate through the crumple,
// and the cold-load hover test. One browser at a time; each run closes its own.
// Usage: node scripts/v8.mjs [url] [outDir] [run] [part]
//   run:  1440 | wk393 (default: both, in turn)
//   part: cold | handoff | crumple | reverse | fps | film (default: all)
import { chromium, webkit, devices } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";

const url = process.argv[2] || "http://localhost:3210";
const out = process.argv[3] || "screenshots";
const only = process.argv[4] && process.argv[4] !== "all" ? process.argv[4] : null;
const part = process.argv[5];
mkdirSync(out, { recursive: true });
const ENTRANCE = 0.54; // as in Corridor.tsx

const RUNS = [
  { tag: "1440", width: 1440, height: 900 },
  { tag: "wk393", width: 393, height: 852, mobile: true, engine: "webkit", device: "iPhone 15" },
].filter((r) => !only || r.tag === only);
const want = (p) => !part || part === p;

for (const run of RUNS) {
  const launch = () =>
    run.engine === "webkit"
      ? webkit.launch()
      : chromium.launch({ channel: "chrome", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
  const context = (browser) =>
    browser.newContext({ ...(run.device ? devices[run.device] : {}), viewport: { width: run.width, height: run.height } });

  /* ── Cold load: every letter must play its real scene on the first hover ──
     A fresh browser profile each time (nothing cached), and the hover lands
     inside the first two seconds. Two things are checked for each letter:
     the scene answers (data-lit goes up) while the pointer is still there,
     and the letter never reacts (the kick, "is-on") before its scene is on. */
  if (want("cold")) {
    const rows = [];
    const compile = [];
    // eleven loads hovering one letter each as early as possible, then three
    // loads sweeping all eleven inside the first two seconds
    const plans = [...Array(11).keys()].map((i) => [i]).concat([0, 1, 2].map(() => [...Array(11).keys()]));
    for (const plan of plans) {
      const browser = await launch();
      try {
        const ctx = await context(browser);
        const page = await ctx.newPage();
        if (!run.engine) {
          const cdp = await ctx.newCDPSession(page);
          await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
        }
        // Watch every letter from the first moment: did it ever react without a scene?
        await page.addInitScript(() => {
          window.__early = [];
          window.__t0 = performance.now();
          const watch = () => {
            const nodes = document.querySelectorAll(".lt");
            if (!nodes.length) return void requestAnimationFrame(watch);
            nodes.forEach((n, i) =>
              new MutationObserver(() => {
                if ((n.classList.contains("kick") || n.classList.contains("is-on")) && !Number(n.dataset.lit || 0))
                  window.__early.push(i);
              }).observe(n, { attributes: true, attributeFilter: ["class"] })
            );
          };
          watch();
        });
        await page.goto(url, { waitUntil: "commit" });
        await page.waitForSelector(".lt");
        const rects = await page.evaluate(() =>
          [...document.querySelectorAll(".lt")].map((n) => {
            const r = n.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          })
        );
        for (const i of plan) {
          const at = await page.evaluate(() => Math.round(performance.now() - window.__t0));
          if (run.mobile) await page.touchscreen.tap(rects[i].x, rects[i].y);
          else {
            await page.mouse.move(rects[i].x - 6, rects[i].y - 4);
            await page.mouse.move(rects[i].x, rects[i].y, { steps: 3 });
          }
          // Keep the pointer there (wiggling, as a hand does) until the scene answers.
          let lit = 0;
          let waited = 0;
          const t = Date.now();
          while (Date.now() - t < 12000) {
            lit = await page.evaluate((i) => Number(document.querySelectorAll(".lt")[i].dataset.lit || 0), i);
            if (lit) break;
            if (!run.mobile) await page.mouse.move(rects[i].x + ((Date.now() / 40) % 5), rects[i].y);
            else if (Date.now() - t > 1500 && (Date.now() - t) % 1500 < 40) await page.touchscreen.tap(rects[i].x, rects[i].y);
            await page.waitForTimeout(15);
          }
          waited = Date.now() - t;
          rows.push({ i, at, waited, ok: lit > 0, sweep: plan.length > 1 });
          if (plan.length > 1 && run.mobile) await page.waitForTimeout(120);
        }
        const early = await page.evaluate(() => window.__early);
        if (early.length) rows.push({ early });
        // how long compiling all eleven took on this load
        for (let k = 0; k < 400; k++) {
          const ms = await page.evaluate(() => document.documentElement.dataset.letters);
          if (ms) {
            compile.push(Number(ms));
            break;
          }
          await page.waitForTimeout(50);
        }
        if (plan.length === 1 && plan[0] === 2) {
          await page.waitForTimeout(350);
          await page.screenshot({ path: `${out}/v8-${run.tag}-cold-first-hover.jpg`, type: "jpeg", quality: 86 });
        }
      } finally {
        await browser.close();
      }
    }
    const hovers = rows.filter((r) => "ok" in r);
    const early = rows.filter((r) => r.early).flatMap((r) => r.early);
    const within2 = hovers.filter((r) => r.at <= 2000).length;
    console.log(
      `${run.tag} cold load: ${hovers.length} first hovers over ${plans.length} fresh loads, ` +
        `${hovers.filter((r) => r.ok).length} played the scene, ${hovers.filter((r) => !r.ok).length} did not; ` +
        `${within2} of them were made inside the first 2s (earliest ${Math.min(...hovers.map((r) => r.at))}ms after load began); ` +
        `longest wait for a scene ${Math.max(...hovers.map((r) => r.waited))}ms, median ${hovers.map((r) => r.waited).sort((a, b) => a - b)[Math.floor(hovers.length / 2)]}ms; ` +
        `letters that reacted before their scene: ${early.length}`
    );
    compile.sort((a, b) => a - b);
    console.log(
      `${run.tag} compiling all 11 letter shaders: median ${compile[Math.floor(compile.length / 2)]}ms, ` +
        `fastest ${compile[0]}ms, slowest ${compile[compile.length - 1]}ms (${compile.length} loads)`
    );
  }

  if (!["handoff", "crumple", "reverse", "fps", "film"].some(want)) continue;
  const browser = await launch();
  try {
    const ctx = await context(browser);
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(4000);
    const shoot = (name, clip) =>
      page.screenshot({ path: `${out}/v8-${run.tag}-${name}.jpg`, type: "jpeg", quality: 90, ...(clip ? { clip } : {}) });
    const at = (vac) =>
      page.evaluate(
        ([vac, E]) => {
          const r = document.querySelector(".corridor").getBoundingClientRect();
          return r.top + window.scrollY + (r.height - window.innerHeight) * E * vac;
        },
        [vac, ENTRANCE]
      );
    const go = async (vac, wait = 1400) => {
      for (let i = 0; i < 2; i++) {
        await page.evaluate((v) => window.scrollTo(0, v), Math.round(await at(vac)));
        await page.waitForTimeout(i ? wait : 250);
      }
    };
    // Walk down like a visitor, so every chapter on the way wakes up.
    const goal = (await at(0)) - run.height * 0.5;
    for (let y = 0; y < goal; y += run.height * 0.6) {
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(160);
    }
    await page.waitForTimeout(3000);
    const close = (k = 1) => {
      const w = Math.min(run.width, (run.mobile ? 330 : 560) * k);
      const h = (run.mobile ? 330 : 440) * k;
      return { x: (run.width - w) / 2, y: (run.height - h) / 2, width: w, height: h };
    };

    /* The handoff: the last frame of the DOM page and the first frame of the
       3D sheet, at the same scroll position apart from a few pixels. The film
       grain (which moves on its own) is hidden for the comparison only. */
    if (want("handoff")) {
      await page.addStyleTag({ content: ".film-grain{visibility:hidden!important}" });
      await go(0.002, 1800);
      const dom = await page.screenshot({ type: "png" });
      const domShown = await page.evaluate(() => getComputedStyle(document.querySelector(".vac-page")).visibility);
      await go(0.0055, 1800);
      const gl = await page.screenshot({ type: "png" });
      const glShown = await page.evaluate(() => getComputedStyle(document.querySelector(".vac-page")).visibility);
      writeFileSync(`${out}/v8-${run.tag}-handoff-1-last-dom-frame.png`, dom);
      writeFileSync(`${out}/v8-${run.tag}-handoff-2-first-3d-frame.png`, gl);
      const tool = await ctx.newPage();
      const res = await tool.evaluate(
        async ([a, b]) => {
          const load = async (b64) => {
            const im = new Image();
            im.src = "data:image/png;base64," + b64;
            await im.decode();
            return im;
          };
          const A = await load(a);
          const B = await load(b);
          const w = A.width;
          const h = A.height;
          const px = (im) => {
            const c = document.createElement("canvas");
            c.width = w;
            c.height = h;
            const g = c.getContext("2d");
            g.drawImage(im, 0, 0);
            return g.getImageData(0, 0, w, h).data;
          };
          const da = px(A);
          const db = px(B);
          let same = 0;
          let near = 0;
          let far = 0;
          let sum = 0;
          let worst = 0;
          const diff = document.createElement("canvas");
          diff.width = w;
          diff.height = h;
          const g = diff.getContext("2d");
          const img = g.createImageData(w, h);
          for (let k = 0; k < da.length; k += 4) {
            const d = Math.max(Math.abs(da[k] - db[k]), Math.abs(da[k + 1] - db[k + 1]), Math.abs(da[k + 2] - db[k + 2]));
            sum += d;
            worst = Math.max(worst, d);
            if (d === 0) same++;
            else if (d <= 8) near++;
            else if (d > 40) far++;
            const v = Math.min(255, d * 6);
            img.data[k] = img.data[k + 1] = img.data[k + 2] = v;
            img.data[k + 3] = 255;
          }
          g.putImageData(img, 0, 0);
          // side by side: DOM | 3D | difference x6
          const side = document.createElement("canvas");
          const s = Math.min(1, 640 / w);
          side.width = Math.round(w * s) * 3 + 16;
          side.height = Math.round(h * s);
          const sg = side.getContext("2d");
          sg.fillStyle = "#222";
          sg.fillRect(0, 0, side.width, side.height);
          [A, B, diff].forEach((im, i) => sg.drawImage(im, i * (Math.round(w * s) + 8), 0, Math.round(w * s), Math.round(h * s)));
          const n = da.length / 4;
          return {
            identical: ((same / n) * 100).toFixed(2),
            within8: (((same + near) / n) * 100).toFixed(2),
            over40: ((far / n) * 100).toFixed(3),
            mean: (sum / n).toFixed(3),
            worst,
            side: side.toDataURL("image/jpeg", 0.9),
          };
        },
        [dom.toString("base64"), gl.toString("base64")]
      );
      writeFileSync(`${out}/v8-${run.tag}-handoff-3-side-by-side.jpg`, Buffer.from(res.side.split(",")[1], "base64"));
      await tool.close();
      console.log(
        `${run.tag} handoff: DOM page ${domShown} then ${glShown}; of all pixels ${res.identical}% identical, ${res.within8}% within 8/255, ` +
          `${res.over40}% differ by more than 40/255; mean difference ${res.mean}/255, largest ${res.worst}/255`
      );
      await page.addStyleTag({ content: ".film-grain{visibility:visible!important}" });
    }

    /* The crumple at four points, the ball, and the pull-back */
    if (want("crumple")) {
      for (const [name, v] of [
        ["crumple-1-corners-fold-in", 0.04],
        ["crumple-2-creases-multiply", 0.085],
        ["crumple-3-closing", 0.125],
        ["crumple-4-nearly-a-ball", 0.165],
      ]) {
        await go(v);
        await shoot(name);
        if (v > 0.1) await shoot(name + "-close", close(v > 0.15 ? 1 : 1.6));
      }
      await go(0.2);
      await shoot("crumple-5-the-ball");
      await shoot("crumple-5-the-ball-close", close());
      await go(0.25);
      await shoot("pullback-1-lights-coming-up");
      await go(0.3);
      await shoot("pullback-2-the-studio");
      await shoot("pullback-2-the-ball-close", close(0.75));
    }

    /* The reverse: scrolling back up, the ball opens out into the page again */
    if (want("reverse")) {
      await go(0.3, 1200);
      for (const [name, v] of [
        ["reverse-1-ball", 0.19],
        ["reverse-2-opening", 0.11],
        ["reverse-3-nearly-flat", 0.045],
        ["reverse-4-flat-3d-sheet", 0.0055],
        ["reverse-5-dom-page-again", 0.001],
      ]) {
        await go(v, 1300);
        await shoot(name);
      }
      const back = await page.evaluate(() => getComputedStyle(document.querySelector(".vac-page")).visibility);
      console.log(`${run.tag} reverse: back at the top of the sequence the DOM page is ${back}`);
    }

    /* A real scroll through the handoff, frame by frame (Chrome only): is
       there any frame where the page is not there? Looks at the screen's
       corners and centre in every frame the browser presents. */
    if (want("film") && !run.engine) {
      await page.evaluate((v) => window.scrollTo(0, v), Math.round((await at(0)) - 700));
      await page.waitForTimeout(1500);
      const cdp = await ctx.newCDPSession(page);
      const frames = [];
      cdp.on("Page.screencastFrame", (f) => {
        frames.push(f.data);
        cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
      });
      await cdp.send("Page.startScreencast", { format: "jpeg", quality: 70, maxWidth: 480, maxHeight: 300, everyNthFrame: 1 });
      await page.mouse.move(700, 450);
      const stop = (await at(0.07)) | 0;
      for (let i = 0; i < 200; i++) {
        await page.mouse.wheel(0, 60);
        await page.waitForTimeout(34);
        if ((await page.evaluate(() => window.scrollY)) > stop) break;
      }
      await page.waitForTimeout(400);
      await cdp.send("Page.stopScreencast");
      const tool = await ctx.newPage();
      const res = await tool.evaluate(async (frames) => {
        const c = document.createElement("canvas");
        const g = c.getContext("2d", { willReadFrequently: true });
        let dark = 0;
        const sheet = document.createElement("canvas");
        const per = 10;
        const pick = frames.slice(-60);
        sheet.width = per * 192;
        sheet.height = Math.ceil(pick.length / per) * 120;
        const sg = sheet.getContext("2d");
        for (let i = 0; i < frames.length; i++) {
          const im = new Image();
          im.src = "data:image/jpeg;base64," + frames[i];
          await im.decode();
          c.width = im.width;
          c.height = im.height;
          g.drawImage(im, 0, 0);
          // the page is pale paper: sample five spots that are blank paper on the "4" page
          // The paper is always in front of you, at the middle of the screen
          // (blank paper there on the "4" page): if it is not pale, the page
          // is not there.
          const spots = [[0.5, 0.5], [0.47, 0.53], [0.53, 0.47], [0.5, 0.56], [0.46, 0.48]];
          const pale = spots.filter(([x, y]) => {
            const d = g.getImageData(Math.floor(im.width * x), Math.floor(im.height * y), 1, 1).data;
            return d[0] + d[1] + d[2] > 300;
          }).length;
          if (pale < 3) dark++;
          const j = i - (frames.length - pick.length);
          if (j >= 0) sg.drawImage(im, (j % per) * 192, Math.floor(j / per) * 120, 192, 120);
        }
        return { n: frames.length, dark, sheet: sheet.toDataURL("image/jpeg", 0.85) };
      }, frames);
      writeFileSync(`${out}/v8-${run.tag}-handoff-4-real-scroll-frames.jpg`, Buffer.from(res.sheet.split(",")[1], "base64"));
      await tool.close();
      console.log(
        `${run.tag} real wheel scroll through the handoff: ${res.n} frames presented, ${res.dark} in which the page was missing`
      );
    }

    /* Frame rate through the crumple and pull-back */
    if (want("fps")) {
      await go(0, 2000);
      const a = await at(0);
      const b = await at(0.34);
      const res = await page.evaluate(
        ([a, b]) =>
          new Promise((resolve) => {
            const T = 8000;
            const gaps = [];
            let last = 0;
            const t0 = performance.now();
            const tick = (t) => {
              if (last) gaps.push(t - last);
              last = t;
              // down and back up again
              const k = Math.min(1, (t - t0) / T);
              const tri = k < 0.5 ? k * 2 : 2 - k * 2;
              window.scrollTo(0, a + (b - a) * tri);
              if (k < 1) requestAnimationFrame(tick);
              else {
                gaps.sort((x, y) => x - y);
                const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
                resolve({
                  fps: Math.round(1000 / mean),
                  p95: Math.round(1000 / gaps[Math.floor(gaps.length * 0.95)]),
                  slowest: Math.round(gaps[gaps.length - 1]),
                  frames: gaps.length,
                });
              }
            };
            requestAnimationFrame(tick);
          }),
        [a, b]
      );
      console.log(
        `${run.tag} frame rate, crumple and pull-back, forwards then backwards: ${res.fps} fps average, 95% of frames at ${res.p95} fps or better, slowest frame ${res.slowest}ms (${res.frames} frames over 8s)`
      );
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    console.log(`${run.tag}: horizontal overflow ${overflow}px, errors ${errors.length}`);
    errors.slice(0, 5).forEach((e) => console.log("  ", e));
  } finally {
    await browser.close();
  }
}
