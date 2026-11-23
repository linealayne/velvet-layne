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
node scripts/v4.mjs [url] [outDir] [run]         # velvet, pillar handoff, tracers, finale
node scripts/v5.mjs [url] [outDir] [run] [part]  # letters, molten-to-velvet
node scripts/v6.mjs [url] [outDir] [run] [part]  # hero on load/refresh, refresh mid-page, suction entrance
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
| 2 | Manifesto | `Manifesto.tsx` | A full screen of very dark oxblood velvet (shader) that you can brush. Four lines light up word by word. |
| 3 | Editorial | `Editorial.tsx`, `lib/art.ts` | The light moment: warm tan paper, Swiss grid, oversized Bodoni numerals, SVG plates with mask reveals. |
| 4 | The Corridor | `Corridor.tsx`, `CorridorScene.tsx`, `lib/posters.ts`, `public/work/` | The centrepiece. A three.js gallery tunnel: panels stream along floor, ceiling and walls into the vanishing point and never stop. |
| 5 | Dimension | `Dimension.tsx`, `Sculpture.tsx` | The iridescent chrome knot. |
| 6 | Brutal | `Brutal.tsx` | Signal orange, hard borders, glitch on hover. |
| 7 | Finale | `Finale.tsx`, `Footer.tsx` | MAKE / IT / YOURS. with two rings of tiles orbiting through the words, then the ask, the credit and the cursor tracers. |

Transitions (each pair uses a different one, none may repeat):

1. Hero → Manifesto: molten cools into velvet. The name parts like a curtain,
   the colour field slows and darkens, and the Manifesto's velvet rolls in
   over it on the diagonal (`Hero.tsx` + `Manifesto.tsx`, see below).
2. Manifesto → Editorial: `columns`, paper drops in as grid columns. The
   bridge overlaps the end of the Manifesto (negative margin), so the pillars
   start falling the moment the last word has lit.
3. Editorial → Corridor: the suction entrance. The page trembles, is pulled
   back from its centre like a sheet into a drain, and the tunnel is seen
   through the hole (`Corridor.tsx`, see below).
4. Corridor → Dimension: `iris`, a red dot opens out of the black. It also
   overlaps the end of the Corridor so there is no black gap before the dot.
5. Dimension → Brutal: `tiles`, hard-cut blocks, no easing
6. Brutal → Finale: `hinge`, the slab swings off its top-left corner

The four named variants live in `Bridge.tsx`. Bridges are pure transitions with
no text, and are not rendered at all without motion.

### Hero letters: the scene map

Every letter is a trailer for the show. Scenes are drawn in code in
`src/lib/scenes.ts`, in this order:

| Letter | Scene id | What plays inside it |
|--------|----------|----------------------|
| V | `vinyl` | Glossy black vinyl spinning, a sharp chrome streak sliding across the grooves |
| E | `marble` | Oxblood lacquer and liquid chrome marbling into each other |
| L | `pour` | Molten chrome pouring through the letter, catching orange light |
| V | `mercury` | Liquid mercury rippling, with the red field in its reflections |
| E | `velvet` | Crushed oxblood velvet with a moving sheen (ties to the Manifesto) |
| T | `corridor` | The Corridor in miniature, panels rushing in, glossy |
| L | `molten` | A white-hot pool of metal with orange sparks skating across it |
| A | `nebula` | A slow liquid nebula in oxblood, orange and chrome |
| Y | `chrome` | Liquid chrome with oxblood and orange. **The reference: do not change it.** |
| N | `neon` | A red neon tube buzzing on, reflected in wet black chrome |
| E | `blocks` | Glossy chrome and lacquer blocks snapping into a layout: what Linea does |

All eleven are glossy, liquid materials in the palette, written as fragment
shaders in `src/lib/letterShader.ts`. The older 2D drawings of each letter
(`vinyl`, `print`, `vhs`, `threads`, ... in `scenes.ts`) are kept for two
jobs only: they are what a letter shows where WebGL is not available at all,
and the finale's tiles are still frames of them.

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
- **One shared WebGL context, one small program per letter.** `scenes.ts`
  owns a single offscreen WebGL canvas (304px, never resized). Each letter
  has its own shader program; to draw, the engine binds that program, renders
  into a corner of the shared canvas and copies it into the letter's 2D
  canvas with `drawImage`. Never create a WebGL context per letter. This runs
  the same way in the worker, on the main thread, and on phones.
- **Why eleven programs and not one.** `letterFrag(kind)` builds a letter's
  shader by replacing every `K(n.)` in the shared source with a literal true
  or false, so the compiler discards the other ten scenes. As one program
  with the letter picked by a uniform, it took over 100 seconds to link on
  Intel graphics (the driver flattens every branch) and the letters stayed
  blank. Constant-folded, each links in well under half a second.
- The programs compile in the background, one after another
  (`warmShader()`, about two seconds after load), asynchronously.
- **A letter never shows a stand-in.** `scene.ready()` is false while that
  letter's program is compiling, and the engine does not start the letter
  until it is true. Whether a letter draws with WebGL or with its 2D fallback
  is decided once, the first time it draws, and never changes.
  - This is the fix for "the L starts as one scene and then switches". The
    cause: the two chrome letters (the first L and the Y) used to draw a 2D
    stand-in (a sliding reflection strip) while the shared shader was still
    compiling, then swapped to the real shader scene as soon as it was ready,
    in the middle of an activation. No letter can do that now.
- Touch screens: letters fire on their own, one at a time, about every 2.3s in
  a shuffled order with no immediate repeat. Tapping a letter fires it at once.
  Steady scenes repaint at half rate there.
- On phones a lit letter **opens wider** (`.lt.is-on` grows its flex share by
  2.6 and the neighbours squeeze), because a letter one sixth of a phone's
  width is too narrow to show a scene. The letters are outlines that stretch,
  so this costs nothing. `Hero.tsx` sizes the canvas for the final width
  before the letter opens.
- Reduced motion: hover shows one still frame (`scene.still`), no wipe (it
  also waits for the letter's program).
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
- **The suction entrance (do not turn it back into ribbons, a fade, a
  shrinking page or speed lines).** The Corridor's stage takes over one screen
  early, on top of Editorial's last screen (`margin-top: -100svh`), and the
  entrance is the first 32% of the chapter's scroll (`ENTRANCE` in
  `Corridor.tsx`). `corridorState.vac` runs 0 to 1 across it.
  - **The page as a texture.** `lib/pageTexture.ts` redraws Editorial's last
    screen into a canvas from the DOM's own measurements: each word where the
    browser put it (a `Range` per word), in its computed font; the step
    rules; and the plates rasterised from their own SVG markup. It is
    repainted at the moment of takeover (`capture()`), and handed to the scene
    through `corridorState.page`.
  - **The sheet.** `CorridorScene` draws that texture on a disc of fine rings
    around the exact centre of the screen (104 x 144, or 56 x 72 on phones),
    parented to the camera so it fills the screen whatever the lens does. The
    disc is larger than the screen (`SHEET`): beyond the page's own edges it
    is blank paper, so nothing behind it shows at the screen's edges while it
    is drawn in. No depth test; it is drawn last, in the tunnel's own
    renderer. One vertex shader (`SHEET_VERT`) does everything from `uP`:
    - a *dent*: the centre is pushed back in depth, gaussian falloff;
    - a *sink*: every point moves inward so that r squared falls by the same
      amount `Q` everywhere, which is how a sheet flows into a drain (the
      centre goes first and fastest, the page's edges are dragged in last);
    - a *hole*: from `HOLE_OPENS` (0.4) a true hole of radius `a` opens at
      the centre and grows until it has passed the corners of the screen;
    - a *throat*: what has passed the rim runs down into the depth, goes
      black, then thins away. It is black before it is thin, so no pale
      paper ever lies over the tunnel.
  - **The tunnel behind is never faded or dimmed.** It is complete, lit and
    moving the whole time; it is simply not drawn until just before the hole
    opens, because the sheet covers it. There is no crossfade anywhere.
  - **The tremor.** A random offset of the whole sheet each frame (about 2px,
    1px on phones) plus a hair of rotation, in the shader, not CSS. Its size
    is `stir` (how hard the page is being scrolled, from
    `scrollState.velocity`) times a curve that builds over the first third.
    At rest `stir` is exactly zero and so is the offset: nothing moves while
    nobody scrolls. The grain comes up and the edges darken with it.
  - The stage is empty and see-through until this chapter's script has taken
    over (`.cor-stage.is-set`), and the chapter's first screen has no
    background, so before hydration (first load, or a refresh at the end of
    Editorial) the real Editorial simply shows. After that the stage shows a
    DOM copy of the page (`.vac-page`) until the sheet takes over at the
    first movement (`p < 0.004`), so the handover is exact. Without WebGL
    that copy fades into the dark.
  - Scrubbed and fully reversible. Reduced motion: no entrance at all, a
    clean cut to a still frame.
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
  4. All of this is finished long before the entrance has pulled the page
     away.
  Check it with `node scripts/cold.mjs` (cache off, Fast 4G).
- Reduced motion: one still frame of the tunnel.

### Manifesto: velvet, and how it arrives

A raw WebGL fragment shader in `Manifesto.tsx`, written for this page.

- **Molten cools into velvet (the entrance).** The chapter has
  `margin-top: -230svh`, so its sticky stage takes over while the hero is
  still pinned, fully transparent at first. Over the next 1.15 screens
  (`SETTLE`) the velvet rolls in: `uSettle` moves a soft diagonal front
  across the frame, shaped by the folds themselves and faintly warm at its
  leading edge, while the cloth is still shifting and then comes to rest.
  Underneath, the hero slows its colour field (`FieldState.cool`, which only
  scales the field's clock) and dims it. One material becomes the other:
  there is no black frame and no hard edge. The type fades in as the cloth
  lands and the first word lights straight away. The chapter takes no
  pointer events (it overlaps the hero's letters), so the brush listens on
  the window.
- **Hidden is the default, in CSS (the hero overlap bug).** Because the
  chapter overlaps the hero, its top sits at 70svh of the first screen. In
  v5 the backdrop and the type were only hidden by this component's script,
  and that script does not run until the chapter hydrates, which waits for
  the visitor's first input (up to nine seconds). So on every load and
  refresh "DESIGN IS A DECISION MADE VISIBLE." sat over the foot of the hero.
  Now `.mf-back` and `.mf-lines` take their opacity from a custom property,
  `--settle` (0 to 1), whose default is 0, and unlit words are dim by
  default. Nothing of this chapter can paint before the velvet starts to
  settle, script or no script. Keep any new element in this chapter hidden
  the same way.
  - An inline script in `layout.tsx` (`settleGate`) keeps `--settle` right
    for the scroll position before hydration, so a refresh in the middle of
    the Manifesto shows it at once; `Manifesto.tsx` removes that listener
    and takes the property over.
  - Reduced motion: the chapter starts directly below the hero (no overlap)
    and the velvet fades in out of black with a CSS mask.
- **The cloth.** A heightfield of long, leaning folds (domain-warped noise,
  stretched along one axis) drifts very slowly. It is lit the way pile fabric
  is lit: nearly black where it faces you, glowing oxblood on its slopes
  (`pow(1 - n.z, 1.4)`), with fine streaks along the nap. It stays dark so
  the type is always crisp. Scroll shifts the folds (`uShift`).
- **Brushing the nap.** A small grid on the CPU (`light` and `dark`, 96 cells
  wide, 56 on phones) records where the pile has been stroked. Moving with
  the nap adds to `light` (the pile lies flat and shines), against it adds to
  `dark` (it stands up and drinks the light). Both decay with a time constant
  of 0.75s, so a stroke is mostly gone in about two seconds. The grid is
  uploaded as a tiny texture only while a stroke is alive.
- Cursor on desktop; finger drag on touch (`touchmove` on the stage, passive,
  so scrolling is untouched).
- Half resolution (0.45 on phones), 4 noise octaves (3 on phones), async
  shader compile. The loop only runs once the stage has taken over. Reduced motion: one still frame.
- Before the shader is ready, and without WebGL, the stage shows a dark
  oxblood gradient.
- The word reveal ends exactly where the pillars begin to fall. If the bridge
  height or its negative margin changes, change the reveal's `end` with it.

### Phones (under 1024 wide; the block in `globals.css` starts at 820)

Phones are a separate cut of the show, not a squeezed desktop. Desktop rules
must not be changed to fix a phone problem; use the phone block.

- **Heights.** Sticky stages are `100lvh` so nothing shows beneath them and no
  canvas resizes when Safari's address bar slides away. Anything that must
  stay in view (the name, the cue, bottom-anchored text) is placed with
  `svh`, so it does not jump when the bar comes and goes.
- **Scrolling.** Lenis is not created on touch devices at all
  (`SmoothScroll.tsx`). Native scrolling is left alone.
- **Hero.** Main-thread engine in WebKit (with the same shared WebGL canvas
  for the scenes), letters open wider when lit, cue at 15px.
- **Manifesto.** Type up to 20vw, balanced into short lines. Lighter velvet
  shader; a finger drag brushes it.
- **Editorial.** One column per step: numeral, heading and text, then the
  plate cropped to 5:4.
- **Corridor.** The portrait tunnel described above; the frame is 80vw.
- **Dimension.** Knot in the upper three quarters, words below, lifted clear
  of Safari's toolbar with `calc(100lvh - 100svh + 30px)`.
- **Brutal.** One column, full-width button.
- **Finale.** Words sized per line so each fills the width, seven tiles on a
  tighter orbit.
- **Footer.** Full-width button, links padded to at least 44px tall.
- Pixel ratio is capped (2 for the 2D canvases, 1.5 for three.js).

### Finale

Plain CSS 3D, no WebGL. The words are MAKE / IT / YOURS. (not the reference site's phrase; do not
change them back). They sit at depth zero inside a
`transform-style: preserve-3d` space and the tiles are moved with
`translate3d`, so the browser sorts what is in front and what is behind.
`Finale.tsx` projects each tile to the screen itself and toggles `.is-hit` on
any letter it covers (inverted block plus a colour split).

### Footer tracers

Twelve marks trail the cursor in `Footer.tsx`: high-stakes table symbols,
drawn here as plain SVG shapes (never emoji or font glyphs). Four suits, poker
chips and dice faces, in bone, oxblood and the signal orange, each with its own
size. On touch screens they wander on their own and follow a finger drag.

## How motion is switched on

An inline script in `layout.tsx` adds `anim` to `<html>` before first paint,
only when the visitor has not asked for reduced motion. All moving behaviour is
gated on that class: CSS under `html.anim ...`, JS behind `motionOn()` from
`src/lib/gsap.ts`. Without the class (reduced motion or no JS) the page is the
static show: no bridges, sticky stages become ordinary sections, canvases and
3D scenes render one frame.

Sticky stages use CSS `position: sticky`, not ScrollTrigger pinning, so there
is no pin spacing to get wrong and scroll is never hijacked.

## Refreshing part way down

A refresh restores the scroll offset before most chapters have hydrated. What
keeps that right:

- **Overlapping chapters are empty until their script runs.** The Manifesto
  (over the hero) and the Corridor's stage (over Editorial's last screen) are
  hidden by default in CSS; see their sections.
- **No `once: true` scroll triggers.** They remove themselves from
  ScrollTrigger's list when they have played. After a refresh below
  Editorial several did so in the middle of a later chapter's refresh;
  ScrollTrigger threw, and that chapter (the Corridor) stayed black. Use the
  default `toggleActions` (plays once, never reverses) and leave the trigger
  alive.
- **Height guesses.** Chapters use `content-visibility: auto`, so an
  unrendered chapter has a guessed height (`contain-intrinsic-size`).
  Editorial, Brutal and the footer get guesses close to their real heights;
  with the old 200svh guess a refresh in the Corridor came back two screens
  further on. If those chapters change length, update the guesses.

Check all of it with `node scripts/v6.mjs` (the `refresh` part prints where
each refresh came back).

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
