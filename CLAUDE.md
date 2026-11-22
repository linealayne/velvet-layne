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
node scripts/shots.mjs [url] [outDir] [filter]   # Playwright screenshots
```

`scripts/shots.mjs` uses `playwright-core` with the installed Chrome. It
captures every chapter and every transition mid-motion at 1440 and 390, plus
reduced motion, and prints horizontal overflow and console errors.

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
