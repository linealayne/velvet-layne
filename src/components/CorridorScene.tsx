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
import { preloadCorridor } from "@/lib/corridorAssets";

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
 *
 * This component is mounted long before the chapter is reached. By the time
 * the visitor arrives the textures are already on the GPU and the first frame
 * has been drawn, so the tunnel is populated and moving the instant it shows.
 * A capture that has not arrived yet shows its placeholder (a solid colour and
 * the site's name) and fades up to the real image when it lands.
 *
 * In portrait the tunnel is narrower and taller, with fewer, larger panels.
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
      const assets = preloadCorridor();
      await calm(1200);
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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setClearColor(0x000000, 1);
      host.appendChild(renderer.domElement);

      const scene = new Scene();
      scene.fog = new Fog(0x000000, 5, LENGTH - 8);
      const camera = new PerspectiveCamera(62, 1, 0.1, LENGTH + 10);
      const unit = new PlaneGeometry(1, 1);
      cleanups.push(() => unit.dispose());

      await assets.postersDone;
      await pause();
      if (disposed) return;

      // Texture pool. Posters are portrait, captures are landscape. Every
      // texture is uploaded to the GPU now, not when a panel first shows it.
      const fades: MeshBasicMaterial[] = [];
      const material = (canvas: HTMLCanvasElement) => {
        const tex = new CanvasTexture(canvas);
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        const mat = new MeshBasicMaterial({ map: tex, toneMapped: false });
        renderer.initTexture(tex);
        cleanups.push(() => {
          tex.dispose();
          mat.dispose();
        });
        return mat;
      };
      const port = assets.posters.map(material);
      const land = assets.captures.map((asset) => {
        const mat = material(asset.canvas);
        if (!asset.ready) {
          // The real image replaces the placeholder with a quick fade up.
          asset.listeners.push(() => {
            if (disposed || !mat.map) return;
            mat.map.needsUpdate = true;
            renderer.initTexture(mat.map);
            mat.color.setScalar(0.25);
            fades.push(mat);
          });
        }
        return mat;
      });

      // Panels.
      const panels = new Group();
      scene.add(panels);
      let slots: Slot[] = [];
      let W = 6;
      let H = 4.4;
      let baseFov = 62;
      let counter = 0;
      const next = (shape: Slot["shape"]) => {
        const pool = shape === "land" ? land : port;
        return pool[counter++ % pool.length];
      };

      const layout = (aspect: number) => {
        panels.clear();
        slots = [];
        counter = 0;
        const portrait = aspect < 0.8;
        const add = (shape: Slot["shape"], base: number, w: number, h: number) => {
          const mesh = new Mesh(unit, next(shape));
          mesh.scale.set(w, h, 1);
          panels.add(mesh);
          slots.push({ mesh, base, lap: 0, shape });
          return mesh;
        };

        if (portrait) {
          // Phone: a narrow, tall tunnel. One lane on the floor and ceiling,
          // big panels on the walls, wide spacing so each one can be read.
          W = 3.3;
          H = Math.min(7.4, (W / aspect) * 0.98);
          baseFov = 84;
          const wallGap = 5.2;
          for (const side of [-1, 1]) {
            for (let k = 0; k * wallGap < LENGTH; k++) {
              const shape = (k + (side > 0 ? 1 : 0)) % 2 ? "land" : "port";
              const base = k * wallGap + (side > 0 ? 2.6 : 0);
              const m = shape === "port" ? add(shape, base, 2.9, 4.14) : add(shape, base, 4.0, 2.5);
              m.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
              m.position.x = side * (W / 2 - 0.02);
              m.position.y = shape === "land" ? (k % 4 < 2 ? 1.5 : -1.5) : 0;
            }
          }
          const gap = 3.4;
          const pw = W * 0.86;
          for (const side of [-1, 1]) {
            for (let k = 0; k * gap < LENGTH; k++) {
              const shape = (k + (side > 0 ? 1 : 0)) % 3 === 0 ? "port" : "land";
              const base = k * gap + (side > 0 ? 1.7 : 0);
              const m = shape === "land" ? add(shape, base, pw, pw / 1.6) : add(shape, base, pw * 0.74, (pw * 0.74) / 0.7);
              m.rotation.x = side < 0 ? -Math.PI / 2 : Math.PI / 2;
              m.position.y = side * (H / 2 - 0.02);
            }
          }
        } else {
          H = 4.4;
          W = Math.min(9.6, Math.max(2.7, H * aspect));
          baseFov = 62;
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
        }
        camera.fov = baseFov;
        camera.updateProjectionMatrix();
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
        // Captures that just arrived fade up from dim.
        for (let i = fades.length - 1; i >= 0; i--) {
          const c = Math.min(1, fades[i].color.r + Math.max(dt, 0.016) * 3.2);
          fades[i].color.setScalar(c);
          if (c >= 1) fades.splice(i, 1);
        }
        pointer.x += (pointer.tx - pointer.x) * 0.05;
        pointer.y += (pointer.ty - pointer.y) * 0.05;
        camera.rotation.y = -pointer.x * 0.07;
        camera.rotation.x = -pointer.y * 0.045;
        const fov = baseFov + Math.min(12, Math.abs(speed - BASE_SPEED) * 0.45);
        if (Math.abs(fov - camera.fov) > 0.05) {
          camera.fov = fov;
          camera.updateProjectionMatrix();
        }
        renderer.render(scene, camera);
      };

      let shapeKey = -1;
      const resize = () => {
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (!w || !h) return false;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        const key = Math.round((w / h) * 10);
        if (key !== shapeKey) {
          shapeKey = key;
          layout(w / h);
        }
        return true;
      };
      // The chapter may still be laid out off screen with no size yet: give
      // the tunnel the window's shape so everything can be compiled now.
      if (!resize()) {
        renderer.setSize(window.innerWidth, window.innerHeight, false);
        camera.aspect = window.innerWidth / window.innerHeight;
        shapeKey = Math.round(camera.aspect * 10);
        layout(camera.aspect);
      }

      await calm(1200);
      if (disposed) return;
      await renderer.compileAsync(scene, camera);
      if (disposed) return;

      const ro = new ResizeObserver(() => {
        if (resize()) frame(0);
      });
      ro.observe(host);
      cleanups.push(() => ro.disconnect());
      // Draw now, well before arrival: this is the frame the visitor first sees.
      frame(0);
      host.classList.add("is-live");
      if (!moving) return;

      const onMove = (e: PointerEvent) => {
        if (e.pointerType === "touch") return;
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
      // Start a little before the chapter enters, so it is already in motion.
      const st = ScrollTrigger.create({
        trigger: section,
        start: "top 130%",
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
