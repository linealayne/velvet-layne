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
node scripts/v6.mjs [url] [outDir] [run] [part]  # hero on load/refresh (its suction and mid-page parts are historical)
node scripts/v7.mjs [url] [outDir] [run] [part]  # the "4" screen, the studio sequence, rebuilt letters, refresh to top, frame rate
node scripts/v8.mjs [url] [outDir] [run] [part]  # cold-load first hover, the handoff, the paper crumple, reverse, frame rate
node scripts/hover.mjs [url] [sweeps] [engine]   # the hover test: every letter must answer every hover
node scripts/studio-assets.mjs                   # re-fetch and compress the studio's Poly Haven textures
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
| 4 | The Corridor | `Corridor.tsx`, `CorridorScene.tsx`, `lib/studio.ts`, `lib/posters.ts`, `public/work/`, `public/studio/` | The centrepiece. First the studio sequence (the page is crumpled and thrown away in a designer's studio, and the studio is pulled into the dark), then a three.js gallery tunnel: panels stream along floor, ceiling and walls into the vanishing point and never stop. |
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
3. Editorial → Corridor: the studio sequence. The "4" page is crumpled into
   a ball and thrown in a bin, the room it was in is pulled apart brick by
   brick, and its framed pictures fly off to become the tunnel
   (`lib/studio.ts`, see below).
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
| V | `vinyl` | A record pressed in black lacquer: the grooves pull the studio out into chrome, orange and oxblood streaks, and the disc swells as it turns |
| E | `marble` | Oxblood lacquer and liquid chrome marbling into each other |
| L | `pour` | Molten chrome pouring through the letter, catching orange light |
| V | `mercury` | Liquid mercury rippling, with the red field in its reflections |
| E | `velvet` | Crushed oxblood velvet with a moving sheen (ties to the Manifesto) |
| T | `corridor` | The Corridor in miniature, built of wet lacquer panels and black glass that mirrors them, a white-hot point at the far end |
| L | `molten` | A white-hot pool of metal with orange sparks skating across it |
| A | `nebula` | A slow liquid nebula in oxblood, orange and chrome |
| Y | `chrome` | Liquid chrome with oxblood and orange. **The reference: do not change it.** |
| N | `neon` | A red neon tube buzzing on, reflected in wet black chrome |
| E | `blocks` | A layout snapping together out of poured blocks (liquid chrome, lacquer, black glass) on a wet floor that mirrors them: what Linea does |

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
- **Ready on the very first hover.** All eleven shaders start compiling the
  moment the hero wakes up (it used to wait two seconds and then compile
  them one after another, so for the first several seconds a hover found no
  scene). With `KHR_parallel_shader_compile` they are all handed to the
  driver at once; without it (WebKit) they go one per task. Each is drawn
  once, tiny, as soon as it links, so nothing is left to build on first use.
  About 1.7s for all eleven on this laptop.
  - A letter's own reaction (the kick, and opening wider on phones) now
    happens when the engine reports the scene is on screen (`shown()` in
    `Hero.tsx`), not when the pointer arrives. A hover made before a scene is
    ready is held and plays the moment it is, if the pointer is still there.
    Never a kick on its own, never a stand-in scene.
  - A pointer already resting on a letter when the page wakes counts on its
    first move. The phone auto-cycle starts only once the scenes are ready.
  - `scripts/v8.mjs cold` checks it on fresh, uncached loads.
- **Every hover is answered (the dead-letter bug).** A scene wipes in, plays,
  holds for half a second after the pointer leaves, then wipes out. The old
  engine ignored a new hover that arrived during the wipe-out: it finished
  wiping out and went idle with the pointer still on the letter, and nothing
  ever started it again until the pointer left and came back. Sweeping back
  and forth lands in that quarter-second window all the time, so letters
  seemed to stop working "after a while". Now a letter asked for during its
  wipe-out turns round and closes back up (phase 5 in `letterEngine.ts`).
  - The engine reports each answered hover (`onLit`, a `lit` message from
    the worker) and the page counts them in `data-lit` on the letter.
    `scripts/hover.mjs` sweeps all eleven letters 150 times and requires
    every count to go up, and photographs one letter per sweep. Run it after
    touching the engine. Before the fix: 20 of 220 hovers missed.
  - The shared WebGL canvas also survives a lost context now: the programs
    are forgotten and compiled again, and a letter draws its 2D version in
    the meantime.
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
- **The studio sequence** is the way in: see its own section below.
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

### The studio sequence (`lib/studio.ts`)

The way into the Corridor, and the centrepiece of the site. The "4" page is a
draft: it is crumpled up and thrown away in a designer's studio, the studio
is pulled into the dark, and the framed work on its wall becomes the tunnel.

It is drawn in the Corridor's own three.js scene and renderer. It takes the
first 54% of the chapter's scroll (`ENTRANCE` in `Corridor.tsx`), and
everything in it is a function of one number, `corridorState.vac` (`v`, 0 to
1), so it scrubs both ways. The beats are the table `T` in `studio.ts`:

| v | Beat | What happens |
|---|------|--------------|
| 0 - 0.21 | Crumple | The page (a finely divided sheet carrying the picture from `lib/pageTexture.ts`) is folded up into a ball, as paper. Nothing else is drawn: it is dark behind. Vertex shader: `crumple()`. |
| 0.19 - 0.34 | Pull back | The room's lights come up (`T.reveal`) and the camera draws back from 2.6 units closer, the ball hanging there. |
| 0.33 | The throw | Wind-up, arc, the wall, the rim of the bin (which rattles once), the bin. |
| 0.40 - 0.92 | Shake | Lamp swings and flickers, frames rattle on their nails, bricks jitter, more dust. |
| 0.54 - 0.86 | Suction | The wall leaves brick by brick from the centre outward, then the floor boards. |
| 0.60 - 0.79 | Frames | Each picture's frame, mat and glass come away and follow the bricks. |
| 0.72 - 0.96 | Glide | The pictures fly to the tunnel's own panels and land on them. |
| 0.74 - 0.90 | Dark | The lamp dies and is pulled in with the bin; the tunnel's dark clears. |

- **The "4" screen it starts from.** The stage takes over the last screen of
  Editorial, and that screen is exactly the "4" step: `.ed-step:last-child`
  is a full screen tall and Editorial has no padding under it. Before v7 the
  stage took over whatever lay in the bottom screen-height, which on a
  shorter window cut off the "4", the heading and the top of the plate, and
  left a seam where the copy met the real page. On short windows the plate
  gets narrower rather than being cut.
- **The paper is folded, never bent (do not go back to noise).** v7 pushed
  the sheet around with smooth noise and wrapped it round a sphere; it looked
  like clay. Paper does not stretch or curve: it only folds, along straight
  lines. So `crumple()` does only that:
  - The sheet sits inside a cage of 24 planes (`FOLDS`) pointing every way,
    closing in on it. Whatever is outside a plane is **mirrored back through
    it**. A mirror is a rigid move and the points on the plane stay put, so
    each plane leaves a perfectly straight crease, the pieces either side
    stay perfectly flat, and nothing changes size. Two passes over the
    planes bring every point inside.
  - The planes reach the corners and edges first, so those fold in first; the
    creases multiply as the cage shrinks; closed to the size of a fist, the
    sheet is a tight wad of flat facets with a jagged outline. Each plane has
    its own final distance and its own timing, so the ball is irregular.
  - Before that, nine shallow straight ridges buckle up across the sheet.
  - At `v = 0` every plane is clear of the sheet: it is exactly the flat page.
  - **Creases are snapped to.** A grid cannot follow a crease exactly; a
    triangle that straddles one cuts the corner and a row of them is a
    sawtooth. Each vertex carries the normal of the facet it is on (`N`,
    mirrored along with it), and vertices within half a grid cell of a crease
    are slid onto it *within their own facet* (`gather()`). Facets stay true
    planes and crease lines stay straight.
  - **Shading.** `flatShading`, so each facet is one plane and catches the
    light on its own. The paper has its own key light in its shader (high,
    left, in front), with a little of it let through from behind, a fine
    tooth normal map, and it gets darker toward the middle of the wad. Not
    glossy. A small faceted lump of shadowed paper (`core`) rides inside the
    ball so that gaps between the outer folds show paper, not the room.
  - The sheet is 400 x 250 on desktop and 210 x 420 on phones. No outside
    texture was used for the paper.
- **The handoff from the DOM page (the v7 flash, and how it is kept exact).**
  - *Cause of the flash.* v7's crumple divided the sheet's radius by an angle
    that is exactly zero for the first 4% of the sequence. The whole sheet
    collapsed to a single point, so for those frames the page was simply
    gone and the lit studio behind it showed; then it popped back and began
    to crumple. The fold model has no such case.
  - *Nothing of the room exists yet.* The wall, floor, frames, lamp, bin and
    dust are not drawn at all until `T.reveal` (0.19), and their exposure
    then comes up from black. There is no depth of field until then either,
    so the sheet is drawn straight to the screen.
  - *Same picture.* The page texture is painted at exactly the 3D canvas's
    pixel ratio, the flat sheet fills the view for the window's shape *this
    frame* (it used to be sized at layout, which could be a few pixels out),
    and while flat it outputs the texture untouched by lighting (`uFlat`).
    The DOM copy (`.vac-page`) is turned by 0.0001 degrees, which moves
    nothing but makes the browser smooth its text the plain way, as the
    canvas does, instead of with coloured sub-pixels.
  - *Measured* (`scripts/v8.mjs handoff`, desktop Chrome): position, size and
    content identical; 95.6% of pixels bit-identical, 99.2% within 8/255, the
    rest hairline edge smoothing on the plate's stripes and the "4". On a
    phone the 3D canvas is capped at 1.5x, below the screen's 3x, so the
    sheet is softer than the DOM page there.
  - `.cor-stage.is-3d` puts a 2px black line above the stage while the 3D
    scene shows, covering a sub-pixel sliver of Editorial that a sticky box
    can leave.
- **The throw runs on its own clock.** Once `v` passes 0.33 it plays in real
  time (about 1.5s) and plays backwards if `v` drops back, so it reads as a
  throw however slowly the page is scrolled. A fast scroll hurries it.
  Everything else is scrubbed directly.
- **Wall and floor are photographs cut into pieces.** One instanced box per
  brick and per board (about 3,300 bricks on desktop, 1,800 on phones). Each
  takes its texture coordinates from where it sits, so the assembled wall is
  the photograph, seamless, with its real mortar. Their flight (come loose,
  hang back, tumble away to a point in the distance, go dark) is all in the
  vertex shader, from `uPull`.
- **Light.** One warm `SpotLight` in the lamp (soft shadows, the only shadow
  caster of light in the scene), a small fill near the camera for the paper,
  and a Poly Haven HDRI at low strength for the room and for reflections in
  the bin and the glass. Keep it dim: the pool of lamp light is the look.
- **Film.** The room's materials do their own filmic tone mapping (`film()`
  in `studio.ts`, the ACES fit) instead of the renderer's, so the tunnel's
  unlit panels are untouched. On desktop the room is drawn through a gentle
  depth-of-field pass (`DOF_FRAG` in `CorridorScene.tsx`): focus follows the
  ball, then rests on the wall, and the pass switches off before the suction.
  The site's film grain lies over all of it as always.
- **Pictures to panels.** Each framed picture is assigned one of the tunnel's
  own panels (`assign()` in `CorridorScene.tsx`). In flight the panel is
  hidden; on landing the panel takes over, same picture, same place. The
  picture's material goes from "print under a lamp" to exactly what the
  panel draws (`uGlow`). The tunnel stands still until they have landed
  (`T.flow`), then streams as it always has.
- **The shake obeys the scroll.** Its size is `stir` (from
  `scrollState.velocity`), which is exactly zero at rest.
- **Nothing compiles on arrival.** Before the chapter is reached the scene
  draws every state of the room once, each in its own task (with and without
  depth of field: they are different programs). If something new is added to
  the room, make sure one of those warm-up states shows it.
- Phones: half-size textures, fewer bricks, a coarser sheet, a 1024 shadow
  map, no depth of field.
- Reduced motion: a clean cut from the "4" screen to a still of the studio
  wall (a picture taken from the same scene, `.studio-still`), then a still
  of the tunnel.
- Without WebGL, or if the textures fail to load, there is no studio: the
  page fades into the dark and the tunnel is there.

**Outside assets (the only ones on the site).** All from Poly Haven, all CC0
(public domain), fetched and compressed by `scripts/studio-assets.mjs` into
`public/studio/` (about 0.7 MB for desktop, 0.2 MB for phones):

| Asset | Used for | Page |
|-------|----------|------|
| Brick Wall 001 | wall: colour, normal, AO and roughness | https://polyhaven.com/a/brick_wall_001 |
| Dark Wooden Planks | floor: colour, normal, AO and roughness | https://polyhaven.com/a/dark_wooden_planks |
| Art Studio (HDRI) | soft room light and reflections | https://polyhaven.com/a/art_studio |

The lamp, the bin, the frames, the dust and the paper are modelled in
`studio.ts`. Nothing else from outside may be added; Poly Haven CC0 only.

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

## Every load starts at the top

An inline script in `layout.tsx` (`topGate`) sets
`history.scrollRestoration = "manual"` and scrolls to 0 before first paint
(and again when the page is shown from the back/forward cache). A reload
anywhere lands on the hero. This replaced trying to restore a position part
way down, which could not be made reliable on iPhones.

Still worth keeping from that work:

- **Overlapping chapters are empty until their script runs.** The Manifesto
  (over the hero) and the Corridor's stage (over Editorial's last screen) are
  hidden by default in CSS; see their sections.
- **No `once: true` scroll triggers.** They remove themselves from
  ScrollTrigger's list when they have played, and several doing so in the
  middle of another trigger's refresh makes ScrollTrigger throw. Use the
  default `toggleActions` (plays once, never reverses).

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
- **Original work only** (the one exception: the studio's three CC0 Poly
  Haven assets, listed in its section). No copied code, assets, fonts, images, layouts or
  copy from the reference sites (warhol-arts.webflow.io, amo.co,
  oddymade.webflow.io) or anywhere else. They are a reference for motion,
  pacing and depth only. No real people, celebrity images, brand logos or
  packaging anywhere.
- **Every visual is generated here** (shader, canvas, SVG, CSS, three.js),
  except the captures of Layne's own demo sites in the Corridor and the
  studio's brick, boards and room light from Poly Haven.
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
