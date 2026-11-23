"use client";

import { useEffect, useRef } from "react";
import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Fog,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import { ScrollTrigger, scrollState, calm, motionOn, isSmall } from "@/lib/gsap";
import { makePoster, postersReady, POSTER_COUNT } from "@/lib/posters";

// Captures of Layne's own live Linea demo sites (see scripts/captures.mjs).
const CAPTURES = [
  "ashgrove-1",
  "hollis-1",
  "auren-2",
  "blendwell-1",
  "cairn-2",
  "rove-1",
  "hollis-2",
  "ashgrove-2",
  "rove-2",
];

const H = 4.4; // tunnel height in world units
const LENGTH = 52; // how far the tunnel runs before a panel wraps
const BASE_SPEED = 6.5; // units per second, always

type Slot = { mesh: Mesh; base: number; lap: number; shape: "port" | "land" };

const pause = () =>
  new Promise<void>((resolve) => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(() => resolve(), { timeout: 200 });
    else setTimeout(resolve, 16);
  });

/**
 * The Corridor: a gallery tunnel with panels on the floor, ceiling and both
 * walls streaming away toward the vanishing point. It never stops. Scrolling
 * pushes it faster; scrolling back up reverses it for a moment.
 * Textures come from a small pool (eight generated posters, nine site
 * captures) and are reused: a panel takes the next one each time it wraps.
 */
export default function CorridorScene() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current!;
    const section = host.closest<HTMLElement>(".corridor")!;
    const small = isSmall();
    const moving = motionOn();
    let disposed = false;
    const cleanups: (() => void)[] = [];

    const build = async () => {
      await calm();
      if (disposed) return;
      let renderer: WebGLRenderer;
      try {
        renderer = new WebGLRenderer({ antialias: !small, alpha: false, powerPreference: "high-performance" });
      } catch {
        section.classList.add("no-gl");
        return;
      }
      cleanups.push(() => {
        renderer.dispose();
        renderer.domElement.remove();
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.25 : 1.5));
      renderer.setClearColor(0x000000, 1);
      host.appendChild(renderer.domElement);

      const scene = new Scene();
      scene.fog = new Fog(0x000000, 5, LENGTH - 8);
      const camera = new PerspectiveCamera(62, 1, 0.1, LENGTH + 10);
      const unit = new PlaneGeometry(1, 1);
      cleanups.push(() => unit.dispose());

      await pause();
      await postersReady();
      if (disposed) return;

      // Texture pool. Posters are portrait, captures are landscape.
      const port: MeshBasicMaterial[] = [];
      const land: MeshBasicMaterial[] = [];
      const material = (canvas: HTMLCanvasElement) => {
        const tex = new CanvasTexture(canvas);
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        const mat = new MeshBasicMaterial({ map: tex, toneMapped: false });
        cleanups.push(() => {
          tex.dispose();
          mat.dispose();
        });
        return mat;
      };
      for (let i = 0; i < POSTER_COUNT; i++) {
        port.push(material(makePoster(i)));
        if (i % 3 === 2) await pause();
        if (disposed) return;
      }
      // Captures load lazily, a few at a time; panels pick them up as they wrap.
      const loadCapture = (name: string) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.decoding = "async";
          img.onload = () => {
            if (disposed) return resolve();
            const c = document.createElement("canvas");
            c.width = 800;
            c.height = 500;
            const g = c.getContext("2d")!;
            g.drawImage(img, 0, 0, 800, 500);
            g.strokeStyle = "#efe4d0";
            g.lineWidth = 10;
            g.strokeRect(5, 5, 790, 490);
            land.push(material(c));
            resolve();
          };
          img.onerror = () => resolve();
          img.src = `/work/${name}.webp`;
        });
      await Promise.all(CAPTURES.slice(0, 3).map(loadCapture));
      if (disposed) return;
      (async () => {
        for (const name of CAPTURES.slice(3)) {
          await loadCapture(name);
          await pause();
          if (disposed) return;
        }
      })();

      // Panels.
      const panels = new Group();
      scene.add(panels);
      let slots: Slot[] = [];
      let W = 6;
      let counter = 0;
      const next = (shape: Slot["shape"]) => {
        const pool = shape === "land" && land.length ? land : port;
        return pool[counter++ % pool.length];
      };

      const layout = (aspect: number) => {
        panels.clear();
        slots = [];
        W = Math.min(9.6, Math.max(2.7, H * aspect));
        const add = (shape: Slot["shape"], base: number, w: number, h: number) => {
          const mesh = new Mesh(unit, next(shape));
          mesh.scale.set(w, h, 1);
          panels.add(mesh);
          slots.push({ mesh, base, lap: 0, shape });
          return mesh;
        };
        // Walls: tall posters alternate with site captures.
        const wallGap = 3.7;
        for (const side of [-1, 1]) {
          for (let k = 0; k * wallGap < LENGTH; k++) {
            const shape = (k + (side > 0 ? 1 : 0)) % 2 ? "land" : "port";
            const m =
              shape === "port"
                ? add(shape, k * wallGap + (side > 0 ? 1.85 : 0), 2.0, 2.86)
                : add(shape, k * wallGap + (side > 0 ? 1.85 : 0), 2.9, 1.81);
            m.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
            m.position.x = side * (W / 2 - 0.02);
            m.position.y = shape === "land" ? (k % 4 < 2 ? 0.85 : -0.85) : 0;
          }
        }
        // Floor and ceiling: lanes of panels lying flat.
        const cols = W >= 7.4 ? 3 : W >= 4.6 ? 2 : 1;
        const lane = W / cols;
        const pw = Math.min(lane * 0.84, 2.6);
        const gap = 2.4;
        for (const side of [-1, 1]) {
          for (let c = 0; c < cols; c++) {
            for (let k = 0; k * gap < LENGTH; k++) {
              const shape = (k + c + (side > 0 ? 1 : 0)) % 3 === 0 ? "port" : "land";
              const base = k * gap + c * 0.8 + (side > 0 ? 1.2 : 0);
              const m = shape === "land" ? add(shape, base, pw, pw / 1.6) : add(shape, base, pw * 0.6, (pw * 0.6) / 0.7);
              m.rotation.x = side < 0 ? -Math.PI / 2 : Math.PI / 2;
              m.position.x = -W / 2 + lane * (c + 0.5);
              m.position.y = side * (H / 2 - 0.02);
            }
          }
        }
        rails();
      };

      // Structure: corner rails and ribs, so the depth reads even between panels.
      const lineMat = new LineBasicMaterial({ color: 0xefe4d0, transparent: true, opacity: 0.2 });
      cleanups.push(() => lineMat.dispose());
      let ribs: LineSegments | null = null;
      const RIB = 4;
      const rails = () => {
        if (ribs) {
          scene.remove(ribs);
          ribs.geometry.dispose();
        }
        const v: number[] = [];
        const x = W / 2;
        const y = H / 2;
        for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) v.push(sx * x, sy * y, RIB, sx * x, sy * y, -LENGTH);
        for (let z = 0; z >= -LENGTH; z -= RIB) {
          v.push(-x, -y, z, x, -y, z, x, -y, z, x, y, z, x, y, z, -x, y, z, -x, y, z, -x, -y, z);
        }
        const geo = new BufferGeometry();
        geo.setAttribute("position", new Float32BufferAttribute(v, 3));
        ribs = new LineSegments(geo, lineMat);
        scene.add(ribs);
      };
      cleanups.push(() => ribs?.geometry.dispose());

      let zoff = 1.3;
      let speed = BASE_SPEED;
      const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
      const mod = (a: number, n: number) => ((a % n) + n) % n;

      const frame = (dt: number) => {
        const target = BASE_SPEED + Math.max(-24, Math.min(30, scrollState.velocity * 0.012));
        speed += (target - speed) * 0.07;
        zoff += speed * dt;
        for (const s of slots) {
          const d = s.base + zoff;
          const lap = Math.floor(d / LENGTH);
          if (lap !== s.lap) {
            s.lap = lap;
            s.mesh.material = next(s.shape);
          }
          s.mesh.position.z = 2 - mod(d, LENGTH);
        }
        if (ribs) ribs.position.z = -mod(zoff, RIB);
        pointer.x += (pointer.tx - pointer.x) * 0.05;
        pointer.y += (pointer.ty - pointer.y) * 0.05;
        camera.rotation.y = -pointer.x * 0.07;
        camera.rotation.x = -pointer.y * 0.045;
        const fov = 62 + Math.min(12, Math.abs(speed - BASE_SPEED) * 0.45);
        if (Math.abs(fov - camera.fov) > 0.05) {
          camera.fov = fov;
          camera.updateProjectionMatrix();
        }
        renderer.render(scene, camera);
      };

      let cols = -1;
      const resize = () => {
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (!w || !h) return false;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        const key = Math.round((w / h) * 10);
        if (key !== cols) {
          cols = key;
          layout(w / h);
        }
        return true;
      };
      resize();

      await calm();
      if (disposed) return;
      await renderer.compileAsync(scene, camera);
      if (disposed) return;

      const ro = new ResizeObserver(() => {
        if (resize() && !moving) frame(0);
      });
      ro.observe(host);
      cleanups.push(() => ro.disconnect());
      frame(0);
      host.classList.add("is-live");
      if (!moving) {
        // Still composition: redraw once more when the captures have arrived.
        const again = window.setTimeout(() => {
          layout(camera.aspect);
          frame(0);
        }, 2500);
        cleanups.push(() => window.clearTimeout(again));
        return;
      }

      const onMove = (e: PointerEvent) => {
        pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      let id = 0;
      let last = 0;
      let running = false;
      const loop = (now: number) => {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        frame(dt);
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
        trigger: section,
        start: "top bottom",
        end: "bottom top",
        onToggle: (self) => run(self.isActive && !document.hidden),
      });
      run(st.isActive);
      const onVis = () => run(st.isActive && !document.hidden);
      document.addEventListener("visibilitychange", onVis);
      cleanups.push(() => {
        run(false);
        st.kill();
        window.removeEventListener("pointermove", onMove);
        document.removeEventListener("visibilitychange", onVis);
      });
    };

    build();
    return () => {
      disposed = true;
      cleanups.reverse().forEach((fn) => fn());
    };
  }, []);

  return <div ref={ref} className="cor-canvas" aria-hidden="true" />;
}
