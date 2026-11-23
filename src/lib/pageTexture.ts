/**
 * Draws the last screen of the Editorial chapter into a canvas, so the Corridor
 * entrance can pull that exact page into the tunnel.
 *
 * There is no way to ask a browser for a picture of its own DOM, so the page
 * is redrawn from the DOM's own measurements: every word is placed where the
 * browser placed it (a Range around each word gives its box), in the font the
 * browser computed for it; rules are drawn where the steps' borders are; and
 * the plates, which are inline SVG, are rasterised from their own markup.
 */

const plateImages = new WeakMap<Element, { img: HTMLImageElement; key: string }>();

/** Rasterise the Editorial plates ahead of time. Safe to call repeatedly. */
export function preparePlates() {
  document.querySelectorAll<SVGSVGElement>("section.editorial .plate svg").forEach((svg) => {
    const box = svg.parentElement!.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const key = `${Math.round(box.width)}x${Math.round(box.height)}`;
    if (plateImages.get(svg)?.key === key) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.removeAttribute("style");
    // An explicit size makes the image honour the SVG's own cropping.
    clone.setAttribute("width", String(Math.round(box.width)));
    clone.setAttribute("height", String(Math.round(box.height)));
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    plateImages.set(svg, { img, key });
  });
}

function drawText(
  ctx: CanvasRenderingContext2D,
  el: HTMLElement,
  toX: (x: number) => number,
  toY: (y: number) => number
) {
  const cs = getComputedStyle(el);
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  ctx.fillStyle = cs.color;
  ctx.textBaseline = "alphabetic";
  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
  }
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.nodeValue ?? "";
    const words = /\S+/g;
    for (let m = words.exec(text); m; m = words.exec(text)) {
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      const box = range.getClientRects()[0];
      if (!box) continue;
      // An inline box runs from the font's ascent to its descent.
      const descent = ctx.measureText(m[0]).fontBoundingBoxDescent ?? box.height * 0.2;
      ctx.fillText(m[0], toX(box.left), toY(box.bottom) - descent);
    }
  }
}

/**
 * Paint Editorial's final `h` pixels (what is on screen as the Corridor's
 * stage takes over) into `canvas`, at `scale` device pixels per CSS pixel.
 * Returns false if the chapter is not in the document.
 */
export function drawEditorialPage(canvas: HTMLCanvasElement, w: number, h: number, scale: number) {
  const ed = document.querySelector<HTMLElement>("section.editorial");
  if (!ed) return false;
  preparePlates();
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw;
    canvas.height = ch;
  }
  const ctx = canvas.getContext("2d")!;
  const page = ed.getBoundingClientRect();
  // The page shown is the chapter's last h pixels, wherever it is scrolled to.
  const toX = (x: number) => x;
  const toY = (y: number) => y - (page.bottom - h);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = getComputedStyle(ed).backgroundColor;
  ctx.fillRect(0, 0, w, h);

  const onPage = (r: DOMRect) => toY(r.bottom) > -4 && toY(r.top) < h + 4;
  ed.querySelectorAll<HTMLElement>(".ed-step").forEach((step) => {
    const box = step.getBoundingClientRect();
    if (!onPage(box)) return;
    const cs = getComputedStyle(step);
    const rule = parseFloat(cs.borderTopWidth) || 0;
    if (rule) {
      ctx.fillStyle = cs.borderTopColor;
      ctx.fillRect(toX(box.left), toY(box.top), box.width, rule);
    }
    step.querySelectorAll<HTMLElement>(".plate").forEach((plate) => {
      const r = plate.getBoundingClientRect();
      if (!onPage(r)) return;
      ctx.fillStyle = getComputedStyle(plate).backgroundColor;
      ctx.fillRect(toX(r.left), toY(r.top), r.width, r.height);
      const svg = plate.querySelector("svg");
      const hit = svg && plateImages.get(svg);
      if (hit && hit.img.complete && hit.img.naturalWidth) {
        ctx.drawImage(hit.img, toX(r.left), toY(r.top), r.width, r.height);
      }
    });
    step.querySelectorAll<HTMLElement>(".ed-num, .ed-copy h3, .ed-copy p").forEach((el) => {
      if (onPage(el.getBoundingClientRect())) drawText(ctx, el, toX, toY);
    });
  });
  return true;
}
