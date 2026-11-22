# VELVET LAYNE

A standalone design showcase by Layne at Linea (the name nods to Warhol and the
Velvet Underground). One long scroll that changes into a completely different
design style every chapter. It sells nothing: its only job is to make a visitor
think "this person can design and build anything."

- Live: https://velvet-layne.vercel.app
- Repo: https://github.com/linealayne/velvet-layne
- Pushes to `main` auto-deploy to Vercel production.

@AGENTS.md

## Stack

- Next.js 16 (App Router, TypeScript, Turbopack), React 19, one static route
- Tailwind 4 is installed, but nearly all styling is hand-written CSS in
  `src/app/globals.css` (one block per chapter)
- GSAP + ScrollTrigger (`@gsap/react` `useGSAP` for cleanup)
- Lenis for smooth wheel scroll, driven by the GSAP ticker
- three.js (plain, no React Three Fiber) for the Dimension chapter only,
  loaded lazily
- Raw WebGL fragment shader for the living colour field (no library)
- Fonts via `next/font/google`: Anybody (display, variable width + weight),
  Bodoni Moda (serif), Schibsted Grotesk (text). All SIL OFL.

## Commands

```bash
npm run dev          # local dev
npm run build        # production build (must stay clean)
npm run lint         # eslint (must stay clean)
bash scripts/serve.sh                       # rebuild + serve on :3210
node scripts/shots.mjs [url] [outDir] [filter] [jpeg]   # Playwright screenshots
node scripts/og.mjs [url]                   # regenerate src/app/opengraph-image.png
```

`scripts/shots.mjs` uses `playwright-core` with the installed Chrome. It
captures every chapter and every transition mid-motion at 1440 and 390, plus
reduced motion, and prints horizontal overflow and console errors. Pass a
filter of `1024`, `768` or `375` for the other widths. The committed set from
the live site is in `screenshots/`.

## The show (in scroll order)

| # | Chapter | File | Style |
|---|---------|------|-------|
| 1 | The name | `Act1.tsx` | "VELVET" / "LAYNE" slice in over a dim molten-red colour field |
| 2 | Living color | `Act1.tsx` + `ColorField.tsx` | Field blooms and shifts hue; variable type reacts to scroll and cursor |
| 3 | The conveyor | `Conveyor.tsx` | Cobalt pop: three belts of cards drawn in CSS/SVG, speed and direction follow scroll |
| 4 | Editorial | `Editorial.tsx` | Swiss 12-column grid, oversized Bodoni numerals, SVG plates with mask reveals |
| 5 | Dimension | `Dimension.tsx` + `Sculpture.tsx` | Iridescent chrome knot in three.js, reacts to cursor and scroll |
| 6 | Brutal | `Brutal.tsx` | Acid yellow, hard borders, glitch on hover, a button you should not press |
| 7 | Tracers | `Footer.tsx` | Calm dark ending, CTA to Linea, symbols trail the cursor |

Transitions live in `Bridge.tsx`. Each pair of chapters uses a different one,
and none may repeat:

1. name → living: the name parts like a curtain while the field blooms (in `Act1.tsx`)
2. living → conveyor: `sweep`, diagonal colour slabs from the right
3. conveyor → editorial: `columns`, paper drops in as grid columns
4. editorial → dimension: `iris`, a red dot opens into the dark
5. dimension → brutal: `tiles`, hard-cut blocks, no easing
6. brutal → footer: `hinge`, the slab swings off its top-left corner

Shared across every chapter: `SmoothScroll.tsx` (Lenis + scroll velocity),
`Cursor.tsx` (dot + trailing ring, difference blend), `Hud.tsx` (wordmark,
chapter counter, progress line).

## How motion is switched on

An inline script in `layout.tsx` adds `anim` to `<html>` before first paint,
only when the visitor has not asked for reduced motion. All moving behaviour is
gated on that class: CSS under `html.anim ...`, JS behind `motionOn()` from
`src/lib/gsap.ts`. Without the class (reduced motion or no JS) the page is the
static show: bridges collapse to title panels, belts become scrollable rows,
the shader and the 3D object render a single frame.

## Performance notes (keep these intact)

- The intro (name, tagline, scroll cue) is animated with CSS keyframes, not
  JS, so the largest paint does not wait for hydration.
- Chapter setup uses `useStage()` from `src/lib/gsap.ts`: like `useGSAP`, but
  each chapter initialises in its own task a few ms apart instead of one long
  task at load. Only `Act1` uses `useGSAP` directly.
- Both WebGL scenes compile shaders asynchronously
  (`KHR_parallel_shader_compile` / `renderer.compileAsync`). Never read
  `LINK_STATUS` straight after linking; it blocks the main thread.
- The 3D scene builds in small steps and waits for the scroll to be at rest
  before the GPU-heavy ones (`calm()` in `Sculpture.tsx`). It has no
  transmission material on purpose: the refraction pass cost a visible stall.
- Chapters below the fold use `content-visibility: auto`. Their real height is
  only known once they are near, so `SmoothScroll.tsx` re-runs
  `ScrollTrigger.refresh()` when `<main>` changes size.
- Every loop (shader, belts, type, tracers, 3D) stops when its chapter is off
  screen or the tab is hidden.
- Measured on the live site: Lighthouse mobile performance 90 to 91,
  accessibility 100; 60fps while scrolling on Intel Iris Xe integrated graphics.

Bridges use CSS `position: sticky`, not ScrollTrigger pinning, so there is no
pin spacing to get wrong and scroll is never hijacked.

## Rules (do not break these)

- **Original work only.** No copied code, assets, fonts, images, layouts or
  copy from the inspiration sites (warhol-arts.webflow.io, amo.co,
  oddymade.webflow.io) or anywhere else. They are a reference for level of
  craft only.
- **Free, properly licensed fonts only** (Google Fonts or Fontshare).
- **No stock photos, no real brands, no fake client logos, no fake
  testimonials, no fake stats.** Visuals are generated, CSS/SVG, or 3D. Copy
  must be true of this page.
- **Performance:** 60fps target on a mid-range laptop. Heavy sections load
  lazily, every loop pauses off screen, phones get lighter versions. Lighthouse
  mobile performance must stay at 85 or higher.
- **Responsive** at 1440, 1024, 768, 390 and 375 with no horizontal scroll.
  Phones get a deliberately designed layout, not a squeezed desktop.
- **Reduced motion:** every chapter needs a static version that still looks
  finished.
- **Accessibility:** headings are real text, artwork has text alternatives,
  links are keyboard reachable, body copy has readable contrast.
- **Never fight the scroll.** No scroll-jacking; smooth scroll must stay
  responsive.
- The footer CTA goes to `https://lineaautomations.com/start`, and "Built by
  Layne at Linea" goes to `https://lineaautomations.com`.
- Build and lint must be clean before pushing to `main`.
