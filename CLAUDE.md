# VELVET LAYNE

A standalone design showcase by Layne at Linea (the name nods to Warhol and the
Velvet Underground). One long scroll that keeps changing style. It sells
nothing: its only job is to make a visitor think "this person can design and
build anything." It is an experience, not a demo with labels.

- Live: https://velvet-layne.vercel.app
- Repo: https://github.com/linealayne/velvet-layne
- Pushes to `main` auto-deploy to Vercel production.

@AGENTS.md

## Stack

- Next.js 16 (App Router, TypeScript, Turbopack), React 19, one static route
- Tailwind 4 is installed, but nearly all styling is hand-written CSS in
  `src/app/globals.css` (one block per chapter)
- GSAP + ScrollTrigger, Lenis for smooth wheel scroll (driven by the GSAP ticker)
- three.js (plain, no React Three Fiber) for the Corridor and Dimension only,
  loaded lazily
- Raw WebGL for the hero colour field, and one shared WebGL program for the
  two chrome letter scenes. Everything else is 2D canvas, SVG or CSS.
- Fonts via `next/font/google`: Anybody (display, variable width + weight),
  Bodoni Moda (serif), Schibsted Grotesk (text). All SIL OFL.
- No runtime dependencies were added for v2.

## Commands

```bash
npm run dev          # local dev
npm run build        # production build (must stay clean)
npm run lint         # eslint (must stay clean)
bash scripts/serve.sh                            # rebuild + serve on :3210
node scripts/shots.mjs [url] [outDir] [filter] [jpeg]   # Playwright screenshots
node scripts/captures.mjs                        # re-capture the demo sites
node scripts/og.mjs [url]                        # regenerate the share card
node scripts/grain.mjs                           # regenerate the film grain tile
node scripts/cold.mjs [url] [outDir]             # cold, throttled first visit to the Corridor
node scripts/manifesto.mjs [url] [outDir]        # Manifesto background: drift and cursor
```

`scripts/shots.mjs` uses `playwright-core`. It captures the hero at rest,
letters lit, the scroll cue mid-roll, every chapter and every transition
mid-motion, plus reduced motion, and prints horizontal overflow and console
errors. With no filter it runs 1440 and 390 in Chrome. Filters: `1024`, `768`,
`375` (Chrome), and the real phone engines `wk393` (WebKit, iPhone 15),
`wk375` (WebKit, iPhone SE), `px412` (Chromium, Pixel 7), `wk393-reduced`.
WebKit needs `npx playwright-core install webkit` once. **Phone work must be
checked in the `wk` runs**: most visitors are on iPhone Safari. The committed
set is in `screenshots/`.

## The show (in scroll order)

| # | Chapter | Files | What it is |
|---|---------|-------|------------|
| 1 | Hero | `Hero.tsx`, `ColorField.tsx`, `lib/glyphs.ts`, `lib/scenes.ts`, `lib/letterEngine.ts`, `lib/letters.worker.ts` | VELVET / LAYNE filling the screen over the molten colour field, plus the scroll cue. Each letter is a window onto a scene. |
| 2 | Manifesto | `Manifesto.tsx` | Mostly black. A handful of hairline oxblood threads wander at different depths, with dust. Four lines light up word by word. |
| 3 | Editorial | `Editorial.tsx`, `lib/art.ts` | The light moment: warm tan paper, Swiss grid, oversized Bodoni numerals, SVG plates with mask reveals. |
| 4 | The Corridor | `Corridor.tsx`, `CorridorScene.tsx`, `lib/posters.ts`, `public/work/` | The centrepiece. A three.js gallery tunnel: panels stream along floor, ceiling and walls into the vanishing point and never stop. |
| 5 | Dimension | `Dimension.tsx`, `Sculpture.tsx` | The iridescent chrome knot. |
| 6 | Brutal | `Brutal.tsx` | Signal orange, hard borders, glitch on hover. |
| 7 | Finale | `Finale.tsx`, `Footer.tsx` | SEE / YOU / SOON with two rings of tiles orbiting through the words, then the ask, the credit and the cursor tracers. |

Transitions (each pair uses a different one, none may repeat):

1. Hero → Manifesto: the name parts like a curtain, the field blooms through
   its hues, then cools to black (`Hero.tsx`)
2. Manifesto → Editorial: `columns`, paper drops in as grid columns
3. Editorial → Corridor: tan paper fades slowly to black (`Corridor.tsx`)
4. Corridor → Dimension: `iris`, a red dot opens out of the black
5. Dimension → Brutal: `tiles`, hard-cut blocks, no easing
6. Brutal → Finale: `hinge`, the slab swings off its top-left corner

The four named variants live in `Bridge.tsx`. Bridges are pure transitions with
no text, and are not rendered at all without motion.

### Hero letters: the scene map

Every letter is a trailer for the show. Scenes are drawn in code in
`src/lib/scenes.ts`, in this order:

| Letter | Scene id | What plays inside it |
|--------|----------|----------------------|
| V | `vinyl` | Macro of a spinning black record, light sliding across the grooves |
| E | `print` | Screen-print pull: three halftone passes behind a squeegee, off register |
| L | `pour` | Molten liquid chrome pouring down (shared WebGL) |
| V | `vhs` | VHS tape: tracking roll, ghosting, running timecode |
| E | `threads` | The Manifesto thread field, sped up |
| T | `tunnel` | A tiny Corridor, cards rushing in |
| L | `sparks` | Welding sparks, hot orange on black |
| A | `galaxy` | A slowly rotating galaxy |
| Y | `chrome` | A liquid chrome surface, a 2D echo of the Dimension knot (shared WebGL) |
| N | `neon` | A red neon tube buzzing and flickering on |
| E | `blocks` | Website blocks snapping into a layout: what Linea does |

How it works:

- The name is not live text. `src/lib/glyphs.ts` holds the outlines of the
  eleven letters, extracted from Anybody (weight 900; VELVET at width 60,
  LAYNE at width 75). Each letter is its own `<svg preserveAspectRatio="none">`
  in a flex row, so the two lines stretch to fill any screen. The real heading
  is a visually hidden `<h1>Velvet Layne</h1>`.
- To regenerate the outlines: open the Anybody woff2 from `.next/static/media`
  with `fontkit`, call `getVariation({ wght: 900, wdth })`, and write each
  glyph's path commands with y flipped and the bounding box moved to 0,0.
- The scenes are drawn by `lib/letterEngine.ts` onto one small canvas per
  letter, created the first time that letter is used. Where the engine runs
  depends on the browser:
  - **WebKit (every iPhone browser, and desktop Safari): on the main thread,
    on plain canvases.** This is the technique verified in WebKit: 2D canvas,
    `Path2D` built from the letter outline, `ctx.clip()`. Detected with
    `"GestureEvent" in window`, which only WebKit has.
  - **Everything else: in a Web Worker** (`lib/letters.worker.ts`) on
    OffscreenCanvases, so scene drawing costs the main thread nothing. The
    worker must post `ready`; if it does not within 2.5s, or it throws, the
    page drops it and runs the engine on the main thread.
  - Why: the worker path failed silently on real iPhones. Offscreen canvases
    in workers are not dependable in iOS Safari, a worker that fails to start
    raises no exception on the page, and the old code hid the solid letter
    while a scene was "on", so letters simply went dead. Do not move WebKit
    back to the worker.
- **The solid SVG letter is never hidden.** The scene canvas sits on top of
  it. Whatever fails, a letter cannot go blank.
- Each frame the engine clips to the letter's `Path2D`, fills bone, clips
  again to the diagonal slice, and calls `scene.draw(ctx, w, h, t)`. Idle
  letters do no work and the loop stops when no letter is active. When a scene
  has wiped out, the worker posts `idle` and the page shows the SVG again.
- Scenes pre-render their static parts once (`cached()`) and blit them, so a
  frame is a handful of draw calls. Keep it that way.
- Wipe in 250ms, hold 500ms after leave, wipe out 250ms. Several letters can
  be active at once.
- The two chrome scenes render through ONE shared offscreen WebGL canvas
  (`warmChrome()` in `scenes.ts`) and are copied in with `drawImage`. Never
  create a WebGL context per letter. On touch devices they use a 2D version
  instead (`setLite`), so phones never open a second WebGL context.
- Touch screens: letters fire on their own, one at a time, about every 2.3s in
  a shuffled order with no immediate repeat. Tapping a letter fires it at once.
  Steady scenes repaint at half rate there.
- On phones a lit letter **opens wider** (`.lt.is-on` grows its flex share by
  2.6 and the neighbours squeeze), because a letter one sixth of a phone's
  width is too narrow to show a scene. The letters are outlines that stretch,
  so this costs nothing. `Hero.tsx` sizes the canvas for the final width
  before the letter opens.
- Reduced motion: hover shows one still frame (`scene.still`), no wipe.
- Letters lock (no hover, no auto-fire) once the page has scrolled a little.

### The Corridor

- Camera at the centre of a tunnel 4.4 units high and as wide as the screen's
  aspect allows. Panels are unit planes scaled per slot; a slot's z is
  `2 - ((base + zoff) mod LENGTH)`, so panels travel away and wrap to behind
  the camera. A panel takes the next texture from the pool each time it wraps.
- Base speed is constant. Scroll velocity is added to it, so scrolling down
  pushes it faster and scrolling up reverses it briefly.
- Texture pool: eight posters generated on canvas (`lib/posters.ts`, invented
  titles) and nine WebP captures of Layne's own live Linea demo sites
  (`public/work/`, made by `scripts/captures.mjs`). Captures come from the
  concept and product sites in the Lab on lineaautomations.com. Client sites
  are left out. Never label a capture with a client name, stat or claim.
- The framed panel at the centre is real DOM text over the canvas.
- In portrait (aspect under 0.8) the tunnel is narrower and taller with a
  wider field of view, one lane on the floor and ceiling, and fewer, larger
  panels spaced further apart so each can be read on a phone.
- **It must be populated the instant it comes on screen, on a first visit.**
  How that is guaranteed:
  1. `lib/corridorAssets.ts` `preloadCorridor()` runs once the hero has
     settled (from `SmoothScroll.tsx`, about 2.6s in, at idle). It fetches the
     captures two at a time and `decode()`s them, and draws the posters one
     per idle slice. No three.js is involved.
  2. `Corridor.tsx` mounts `CorridorScene` at the first real scroll (or when
     the chapter is five screens away), far ahead of arrival. The scene builds,
     uploads every texture with `renderer.initTexture`, compiles, and draws
     its first frame while the visitor is still in the Manifesto.
  3. Every capture panel has an immediate fallback: a solid colour with the
     demo site's name. When the real image lands it is drawn into the same
     canvas and the panel fades up from dim.
  4. The tunnel and the centre frame are at full opacity under Editorial's
     paper, which simply thins out over them. Nothing fades in afterwards.
  Check it with `node scripts/cold.mjs` (cache off, Fast 4G).
- Reduced motion: one still frame of the tunnel.

### Manifesto background

A 2D canvas in `Manifesto.tsx`. Seven threads (five on phones), each a
parametric curve built from two sine harmonics per axis with frequency pairs
such as 1:2 and 2:3, which is what gives figure-eights, loose loops and long
S-curves instead of parallel waves. Each thread has a depth that sets its
weight (hairline), opacity (low) and parallax. The phases advance slowly, so
the threads are always drifting. They are drawn whole every frame: nothing
ever draws itself on. A short brighter segment travels along a thread now and
then. Every point keeps an eased offset away from the cursor, so threads part
softly around it and take a moment to settle; on touch screens they lean with
scroll velocity instead. Dust at three depths. Keep it sparse.

### Phones (under 1024 wide; the block in `globals.css` starts at 820)

Phones are a separate cut of the show, not a squeezed desktop. Desktop rules
must not be changed to fix a phone problem; use the phone block.

- **Heights.** Sticky stages are `100lvh` so nothing shows beneath them and no
  canvas resizes when Safari's address bar slides away. Anything that must
  stay in view (the name, the cue, bottom-anchored text) is placed with
  `svh`, so it does not jump when the bar comes and goes.
- **Scrolling.** Lenis is not created on touch devices at all
  (`SmoothScroll.tsx`). Native scrolling is left alone.
- **Hero.** Main-thread engine in WebKit, letters open wider when lit, cue at
  15px.
- **Manifesto.** Type up to 20vw, balanced into short lines, five threads.
- **Editorial.** One column per step: numeral, heading and text, then the
  plate cropped to 5:4.
- **Corridor.** The portrait tunnel described above; the frame is 80vw.
- **Dimension.** Knot in the upper three quarters, words below, lifted clear
  of Safari's toolbar with `calc(100lvh - 100svh + 30px)`.
- **Brutal.** One column, full-width button.
- **Finale.** Words up to 56vw so they fill the width, seven tiles on a
  tighter orbit.
- **Footer.** Full-width button, links padded to at least 44px tall.
- Pixel ratio is capped (2 for the 2D canvases, 1.5 for three.js).

### Finale

Plain CSS 3D, no WebGL. The words sit at depth zero inside a
`transform-style: preserve-3d` space and the tiles are moved with
`translate3d`, so the browser sorts what is in front and what is behind.
`Finale.tsx` projects each tile to the screen itself and toggles `.is-hit` on
any letter it covers (inverted block plus a colour split).

## How motion is switched on

An inline script in `layout.tsx` adds `anim` to `<html>` before first paint,
only when the visitor has not asked for reduced motion. All moving behaviour is
gated on that class: CSS under `html.anim ...`, JS behind `motionOn()` from
`src/lib/gsap.ts`. Without the class (reduced motion or no JS) the page is the
static show: no bridges, sticky stages become ordinary sections, canvases and
3D scenes render one frame.

Sticky stages use CSS `position: sticky`, not ScrollTrigger pinning, so there
is no pin spacing to get wrong and scroll is never hijacked.

## Performance notes (keep these intact)

- The hero paints from server HTML: SVG letters and CSS keyframes, no JS
  needed for the arrival animation or the scroll cue.
- Hero CSS animations use `transform` and `opacity` only, so they run on the
  compositor. Do not animate `clip-path`, `color` or anything else that
  repaints: on phones that work never stops and the page never goes idle.
- The scroll cue is visible from the first paint (it is the first text on the
  page). Do not fade it in from `opacity: 0`.
- Chapter setup uses `useStage()` from `src/lib/gsap.ts` instead of `useGSAP`.
  By default a chapter sets itself up only when it comes within about a screen
  of the viewport (`"near"`); the hero uses `"soon"`. Do not measure or animate
  inside a below-the-fold chapter at load.
- `page.tsx` wraps each chapter in `<Suspense>`, and every chapter below the
  hero in `<AfterInput>`. That holds back React's hydration of those chapters
  until the visitor's first input (`lib/gate.ts` `firstInput`: scroll, touch,
  pointer, key, or nine seconds). Until then the server's HTML is left alone.
  Lenis, ScrollTrigger and the hero's scroll timeline wait on the same
  promise. Anything that must run at load regardless (the hero letters, the
  Corridor asset warm-up) lives in components above that gate.
- Chapters below the fold use `content-visibility: auto`. Their real height is
  only known once they are near, so `SmoothScroll.tsx` re-runs
  `ScrollTrigger.refresh()` when `<main>` changes size.
- All WebGL shaders compile asynchronously (`KHR_parallel_shader_compile` /
  `renderer.compileAsync`). Never read `LINK_STATUS` straight after linking.
- Compiling shaders stalls the GPU for a fraction of a second on some
  machines. Both three.js scenes `await calm()` (in `lib/gsap.ts`) before
  their heavy steps, and are mounted early enough (see the `rootMargin` in
  `Corridor.tsx` and `Dimension.tsx`) that this lands while the visitor is in
  Editorial, where nothing is moving.
- Every loop (field, letters, threads, corridor, knot, orbit, tracers) stops
  when its chapter is off screen or the tab is hidden.
- The film grain is one fixed layer tiling `public/grain.png` (made by
  `scripts/grain.mjs`): sparse light and dark specks on transparency, moved
  with transform in hard steps. No blend mode and no SVG filter: a blend mode
  costs a full-screen pass every frame, and a noise filter has to be computed
  by the browser at every load.
- Lighthouse on a busy laptop swings a lot. Check `benchmarkIndex` in the
  report, stop local servers, and take the median of several runs.

## Rules (do not break these)

- **No custom cursor.** The system cursor is used everywhere. The footer
  tracers follow it; they do not replace it.
- **No explanatory UI.** No fixed wordmark, chapter counter, progress line,
  subtitle, captions, chapter labels, or notes that say what an effect is
  doing. Real headline copy inside chapters is fine. The site explains nothing.
- **Palette:** oxblood and molten red, black, warm bone and tan, chrome, and
  one hot signal orange (`--signal`). No pinks, pastels or cute shapes. The
  hero colour field's own hue swing is the one exception and must not change.
- **Do not change the look of the colour field shader** (`ColorField.tsx`).
- **Original work only.** No copied code, assets, fonts, images, layouts or
  copy from the reference sites (warhol-arts.webflow.io, amo.co,
  oddymade.webflow.io) or anywhere else. They are a reference for motion,
  pacing and depth only. No real people, celebrity images, brand logos or
  packaging anywhere.
- **Every visual is generated here** (shader, canvas, SVG, CSS, three.js),
  except the captures of Layne's own demo sites in the Corridor.
- **Free, properly licensed fonts only.** No stock photos, fake client logos,
  fake testimonials or fake stats. Copy must be true of this page.
- **Performance:** 60fps target on a mid-range laptop, everything paused off
  screen, phones get lighter versions. Lighthouse mobile performance 85+.
- **Responsive** at 1440, 1024, 768, 390 and 375 with no horizontal scroll.
  Phones get a deliberately designed layout.
- **Reduced motion:** every chapter needs a static version that still looks
  finished, including the Corridor and the Finale.
- **Accessibility:** the hero name is a real `<h1>`, links are keyboard
  reachable, body copy has readable contrast.
- **Never fight the scroll.** No scroll-jacking; Lenis must stay responsive.
- The footer button goes to `https://lineaautomations.com/start`, and "Built
  by Layne at Linea" goes to `https://lineaautomations.com`.
- Build and lint must be clean before pushing to `main`.
