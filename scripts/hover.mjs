// The hover test. Sweeps the pointer across all eleven hero letters, over and
// over, and checks that every single hover is answered with a scene.
//
// How it knows: each time the engine puts a scene on screen in answer to an
// `on`, the page counts it on the letter (`data-lit`, see Hero.tsx). A hover
// passes if that count goes up while the pointer is on the letter. On
// top of that, once per sweep one letter is photographed mid-scene and its
// pixels are checked: a lit letter is not one flat colour.
//
// Usage: node scripts/hover.mjs [url] [sweeps] [engine]
//   engine: chrome | webkit (default: both, in turn). One browser at a time.
import { chromium, webkit } from "playwright-core";

const url = process.argv[2] || "http://localhost:3210";
const SWEEPS = Number(process.argv[3] || 150);
const only = process.argv[4];

for (const engine of ["chrome", "webkit"].filter((e) => !only || e === only)) {
  const browser =
    engine === "webkit"
      ? await webkit.launch()
      : await chromium.launch({ channel: "chrome", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(url, { waitUntil: "networkidle" });
    // Let the name arrive and every letter's shader compile.
    await page.waitForTimeout(7000);

    const rects = await page.evaluate(() =>
      [...document.querySelectorAll(".lt")].map((n) => {
        const r = n.getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height };
      })
    );
    const lit = (i) => page.evaluate((i) => Number(document.querySelectorAll(".lt")[i].dataset.lit || 0), i);
    const flat = async (i) => {
      // Is the middle of this letter one flat colour? (A lit letter is not.)
      const r = rects[i];
      const png = await page.screenshot({
        type: "png",
        clip: { x: r.x + r.w * 0.2, y: r.y + r.h * 0.2, width: r.w * 0.6, height: r.h * 0.6 },
      });
      return page.evaluate(async (b64) => {
        const img = new Image();
        img.src = "data:image/png;base64," + b64;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = 48;
        c.height = 48;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0, 48, 48);
        const d = g.getImageData(0, 0, 48, 48).data;
        let dark = 0;
        for (let k = 0; k < d.length; k += 4) if (d[k] + d[k + 1] + d[k + 2] < 500) dark++;
        // Bone letter over a dark field: with no scene, the bone share is
        // steady; a scene changes most of the letter's pixels. Report the
        // share of pixels that are neither bone nor the field's near-black.
        let mid = 0;
        for (let k = 0; k < d.length; k += 4) {
          const s = d[k] + d[k + 1] + d[k + 2];
          const bone = d[k] > 215 && d[k + 1] > 205 && d[k + 2] > 180;
          if (!bone && s > 60) mid++;
        }
        return { mid: mid / (48 * 48), dark: dark / (48 * 48) };
      }, png.toString("base64"));
    };

    // The field behind the letters is not flat either, so measure each
    // letter at rest first and require a clear change from that.
    await page.mouse.move(720, 895);
    await page.waitForTimeout(1200);
    const rest = [];
    for (let i = 0; i < 11; i++) rest.push(await flat(i));

    const fails = [];
    const pixelFails = [];
    const slow = [];
    const hovers = Array(11).fill(0);
    let slowest = 0;
    const t0 = Date.now();
    for (let s = 0; s < SWEEPS; s++) {
      const order = [...Array(11).keys()];
      if (s % 2) order.reverse();
      const probe = s % 11; // the letter photographed on this sweep
      // Vary the pace: some sweeps linger, most race.
      const dwell = [0, 0, 30, 0, 90, 0, 0, 260, 0, 15, 620][s % 11];
      // A sweep starts on the letter the last one ended on. Step off it first,
      // or there is no new hover to answer.
      await page.mouse.move(720, 897);
      for (const i of order) {
        const before = await lit(i);
        const r = rects[i];
        const at = Date.now();
        await page.mouse.move(r.x + r.w / 2, r.y + r.h * (0.3 + 0.4 * ((s * 7 + i * 3) % 10) / 10), { steps: 2 });
        hovers[i]++;
        // The pointer stays on the letter until it answers. Over a second is
        // counted as slow (the browser was busy); eight seconds is a miss.
        let ok = false;
        while (Date.now() - at < 8000) {
          if ((await lit(i)) > before) {
            ok = true;
            break;
          }
          await page.waitForTimeout(12);
        }
        const took = Date.now() - at;
        slowest = Math.max(slowest, took);
        if (!ok) fails.push(`sweep ${s + 1} letter ${i}`);
        else if (took > 1000) slow.push(took);
        if (i === probe) {
          await page.waitForTimeout(330);
          const now = await flat(i);
          if (Math.abs(now.mid - rest[i].mid) < 0.08 && Math.abs(now.dark - rest[i].dark) < 0.08)
            pixelFails.push(`sweep ${s + 1} letter ${i}`);
        }
        if (dwell) await page.waitForTimeout(dwell);
      }
      // Every so often leave the name entirely, so letters wipe out and idle.
      if (s % 5 === 4) {
        await page.mouse.move(720, 895);
        await page.waitForTimeout(s % 10 === 9 ? 900 : 350);
      }
    }
    const total = hovers.reduce((a, b) => a + b, 0);
    console.log(
      `${engine}: ${SWEEPS} sweeps, ${total} hovers (${hovers[0]} per letter), ` +
        `${total - fails.length} answered, ${fails.length} missed; ` +
        `${SWEEPS - pixelFails.length}/${SWEEPS} photographed letters showed a scene; ` +
        `${slow.length} took over a second (slowest ${slowest}ms); page errors ${errors.length}; ${Math.round((Date.now() - t0) / 1000)}s`
    );
    fails.slice(0, 8).forEach((f) => console.log("   missed:", f));
    pixelFails.slice(0, 8).forEach((f) => console.log("   no scene in photo:", f));
    errors.slice(0, 3).forEach((e) => console.log("   error:", e));
  } finally {
    // Closes only the browser this run started.
    await browser.close();
  }
}
