"use client";

import { useRef } from "react";
import { ScrollTrigger, scrollState, useStage, motionOn, isSmall } from "@/lib/gsap";
import { makePoster, postersReady, POSTER_W, POSTER_H } from "@/lib/posters";
import { sceneStill } from "@/lib/scenes";

const WORDS = ["SEE", "YOU", "SOON"];
// Letter scenes that are plain 2D drawings and can be frozen into a tile.
const STILLS = [0, 3, 6, 7, 9, 1, 10, 5, 4];
const TAU = Math.PI * 2;

/**
 * Chapter 7. SEE / YOU / SOON stand in the space while two rings of tiles
 * (corridor posters and frames from the hero letters) orbit through it,
 * passing in front of the words and behind them. Wherever a tile crosses a
 * letter, that letter inverts and splits for as long as the tile is on it.
 * The 3D is plain CSS: the browser sorts the tiles and the words by depth.
 */
export default function Finale() {
  const root = useRef<HTMLElement>(null);

  useStage(() => {
    const el = root.current!;
    const stage = el.querySelector<HTMLElement>(".fin-stage")!;
    const space = el.querySelector<HTMLElement>(".fin-space")!;
    const chars = Array.from(el.querySelectorAll<HTMLElement>(".sys-ch"));
    const moving = motionOn();
    const small = isSmall();
    const N = small ? 9 : 15;
    let disposed = false;
    let stop = () => {};

    postersReady().then(() => {
      if (disposed) return;
      const tiles = Array.from({ length: N }, (_, i) => {
        const canvas = document.createElement("canvas");
        canvas.className = "fin-tile";
        canvas.width = POSTER_W / 2;
        canvas.height = POSTER_H / 2;
        const src = i % 2 ? sceneStill(STILLS[(i >> 1) % STILLS.length], POSTER_W / 2, POSTER_H / 2) : makePoster(i >> 1);
        canvas.getContext("2d")!.drawImage(src, 0, 0, canvas.width, canvas.height);
        space.appendChild(canvas);
        const ring = i % 2;
        return { canvas, ring, a0: (i / N) * TAU + ring * 0.4 };
      });

      let vw = 0;
      let vh = 0;
      let P = 1100;
      let tw = 140;
      let th = 200;
      let boxes: { x: number; y: number; w: number; h: number }[] = [];
      const hit = chars.map(() => false);

      const measure = () => {
        vw = stage.clientWidth;
        vh = stage.clientHeight;
        if (!vw) return;
        P = small ? 760 : 1100;
        tw = small ? 84 : Math.min(160, Math.max(112, vw * 0.09));
        th = tw * (POSTER_H / POSTER_W);
        tiles.forEach((t) => {
          t.canvas.style.width = `${tw}px`;
          t.canvas.style.height = `${th}px`;
          t.canvas.style.margin = `${-th / 2}px 0 0 ${-tw / 2}px`;
        });
        const s = stage.getBoundingClientRect();
        boxes = chars.map((c) => {
          const r = c.getBoundingClientRect();
          return {
            x: r.left + r.width / 2 - (s.left + s.width / 2),
            y: r.top + r.height / 2 - (s.top + s.height / 2),
            w: r.width,
            h: r.height,
          };
        });
      };

      let angle = 0.6;
      const place = () => {
        const Rx = Math.min(vw * (small ? 0.62 : 0.56), 840);
        const Rz = small ? 300 : 470;
        const now = chars.map(() => false);
        for (const t of tiles) {
          const a = t.a0 + (t.ring ? -angle : angle);
          const x = Math.cos(a) * Rx;
          const z = Math.sin(a) * Rz;
          const y = (t.ring ? 0.19 : -0.2) * vh + Math.sin(a + t.ring * 1.7) * vh * 0.1;
          const turn = -Math.cos(a) * 40 * (t.ring ? -1 : 1);
          t.canvas.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px) rotateY(${turn.toFixed(1)}deg)`;
          // Where does this tile land on screen?
          const s = P / (P - z);
          const px = x * s;
          const py = y * s;
          const hw = tw * s * 0.5 * Math.max(0.4, Math.cos((turn * Math.PI) / 180));
          const hh = th * s * 0.5;
          boxes.forEach((b, i) => {
            if (Math.abs(b.x - px) < hw + b.w * 0.12 && Math.abs(b.y - py) < hh + b.h * 0.05) now[i] = true;
          });
        }
        now.forEach((on, i) => {
          if (on === hit[i]) return;
          hit[i] = on;
          chars[i].classList.toggle("is-hit", on);
        });
      };

      measure();
      const ro = new ResizeObserver(() => {
        measure();
        if (!moving) place();
      });
      ro.observe(stage);
      place();
      el.classList.add("is-live");

      if (!moving) {
        stop = () => ro.disconnect();
        return;
      }

      let id = 0;
      let last = 0;
      let running = false;
      const loop = (now: number) => {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        angle += dt * (0.2 + Math.min(0.9, Math.abs(scrollState.velocity) * 0.0004));
        place();
        id = requestAnimationFrame(loop);
      };
      const run = (on: boolean) => {
        if (on === running) return;
        running = on;
        cancelAnimationFrame(id);
        if (on) {
          last = performance.now();
          id = requestAnimationFrame(loop);
        }
      };
      const st = ScrollTrigger.create({
        trigger: el,
        start: "top bottom",
        end: "bottom top",
        onToggle: (self) => run(self.isActive && !document.hidden),
      });
      run(st.isActive);
      const onVis = () => run(st.isActive && !document.hidden);
      document.addEventListener("visibilitychange", onVis);
      stop = () => {
        run(false);
        st.kill();
        ro.disconnect();
        document.removeEventListener("visibilitychange", onVis);
        tiles.forEach((t) => t.canvas.remove());
      };
    });

    return () => {
      disposed = true;
      stop();
    };
  }, root);

  return (
    <section ref={root} className="finale">
      <div className="fin-stage">
        <div className="fin-space">
          <h2 className="sys">
            <span className="sr-only">See you soon</span>
            {WORDS.map((word) => (
              <span key={word} className="sys-word" aria-hidden="true">
                {word.split("").map((c, i) => (
                  <span key={i} className="sys-ch">
                    {c}
                  </span>
                ))}
              </span>
            ))}
          </h2>
        </div>
      </div>
    </section>
  );
}
