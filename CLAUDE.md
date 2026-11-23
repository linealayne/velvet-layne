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
```

`scripts/shots.mjs` uses `playwright-core` with the installed Chrome. It
captures the hero at rest, letters mid-hover, the scroll cue mid-roll, every
chapter and every transition mid-motion at 1440 and 390, plus reduced motion,
and prints horizontal overflow and console errors. Pass a filter of `1024`,
`768` or `375` for the other widths. The committed set is in `screenshots/`.

## The show (in scroll order)

| # | Chapter | Files | What it is |
|---|---------|-------|------------|
| 1 | Hero | `Hero.tsx`, `ColorField.tsx`, `lib/glyphs.ts`, `lib/scenes.ts` | VELVET / LAYNE filling the screen over the molten colour field, plus the scroll cue. Each letter is a window onto a scene. |
| 2 | Manifesto | `Manifesto.tsx` | Near-black field, oxblood threads drifting like silk, dust at three depths. Four lines light up word by word. |
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
- On hover a letter lazily gets one 2D canvas. Each frame the engine in
  `Hero.tsx` clips to the letter's `Path2D`, fills bone, clips again to the
  diagonal slice, and calls `scene.draw(ctx, w, h, t)`. Idle letters have no
  canvas work at all, and the loop stops when no letter is active.
- Wipe in 250ms, hold 500ms after leave, wipe out 250ms. Several letters can
  be active at once.
- The two chrome scenes render through ONE shared offscreen WebGL canvas
  (`warmChrome()` in `scenes.ts`) and are copied in with `drawImage`. Never
  create a WebGL context per letter.
- Touch screens: letters fire on their own, one at a time, about every 2.3s in
  a shuffled order with no immediate repeat. Tapping a letter fires it.
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
- Reduced motion: one still frame of the tunnel.

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
- Chapter setup uses `useStage()` from `src/lib/gsap.ts` instead of `useGSAP`.
  By default a chapter sets itself up only when it comes within about a screen
  of the viewport (`"near"`); the hero uses `"soon"`. Do not measure or animate
  inside a below-the-fold chapter at load.
- `page.tsx` wraps each chapter in `<Suspense>`. Nothing suspends; the
  boundaries make React hydrate chapter by chapter in interruptible passes.
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
- The film grain is one fixed layer of sparse specks with no blend mode, moved
  with transform in hard steps. Do not give it a blend mode: that costs a
  full-screen pass every frame.
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
