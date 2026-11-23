"use client";

import { useEffect, useRef } from "react";
import {
  ACESFilmicToneMapping,
  BackSide,
  BoxGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  SphereGeometry,
  TorusGeometry,
  TorusKnotGeometry,
  WebGLRenderer,
} from "three";
import { ScrollTrigger, calm, motionOn, isSmall } from "@/lib/gsap";

/** Yield to the browser so scene start-up never lands in one long task. */
const breathe = () =>
  new Promise<void>((resolve) => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => resolve(), { timeout: 250 });
    } else {
      setTimeout(resolve, 16);
    }
  });

/**
 * One liquid-chrome knot, three orbit rings and (on larger screens) a glass
 * bead. The reflections come from a tiny studio of coloured light panels built
 * in code, so there is no HDR file to download.
 * Phones get lighter geometry, a lower pixel ratio and no bead.
 */
export default function Sculpture() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current!;
    const section = host.closest<HTMLElement>(".dimension")!;
    const small = isSmall();
    const animate = motionOn();

    let disposed = false;
    const cleanups: (() => void)[] = [];
    const keep = <T extends { dispose: () => void }>(x: T) => {
      cleanups.push(() => x.dispose());
      return x;
    };

    const build = async () => {
      // Step 1: renderer.
      let renderer: WebGLRenderer;
      try {
        renderer = new WebGLRenderer({
          antialias: !small,
          alpha: true,
          powerPreference: "high-performance",
        });
      } catch {
        section.classList.add("no-gl");
        return;
      }
      cleanups.push(() => {
        renderer.dispose();
        renderer.domElement.remove();
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.25 : 1.75));
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      host.appendChild(renderer.domElement);
      const scene = new Scene();
      const camera = new PerspectiveCamera(35, 1, 0.1, 60);

      await breathe();
      await calm();
      if (disposed) return;

      // Step 2: a studio made of light. Coloured panels on a dark box, baked
      // into an environment map for the reflections.
      const studio = new Scene();
      studio.add(
        new Mesh(
          keep(new BoxGeometry(30, 30, 30)),
          keep(new MeshBasicMaterial({ color: 0x03030a, side: BackSide }))
        )
      );
      const panel = (
        hex: string,
        power: number,
        pos: [number, number, number],
        w: number,
        h: number
      ) => {
        const m = new Mesh(
          keep(new PlaneGeometry(w, h)),
          keep(
            new MeshBasicMaterial({
              color: new Color(hex).multiplyScalar(power),
              side: DoubleSide,
            })
          )
        );
        m.position.set(...pos);
        m.lookAt(0, 0, 0);
        studio.add(m);
      };
      panel("#ff2447", 7, [-7, 3, 3], 7, 7);
      panel("#8fa3bd", 7, [7, -1, 4], 5, 9);
      panel("#ffffff", 12, [0, 8, 1], 9, 3);
      panel("#ff4d00", 6, [3, -7, -3], 8, 4);
      panel("#c4001d", 6, [-4, -2, -8], 7, 7);
      panel("#ffffff", 9, [5, 4, -7], 2, 8);
      const pmrem = new PMREMGenerator(renderer);
      const env = keep(pmrem.fromScene(studio, 0.03));
      scene.environment = env.texture;
      pmrem.dispose();

      await breathe();
      if (disposed) return;

      // Step 3: the objects.
      const group = new Group();
      scene.add(group);

      const knot = new Mesh(
        keep(new TorusKnotGeometry(1.05, 0.36, small ? 150 : 280, small ? 20 : 40, 2, 3)),
        keep(
          new MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 1,
            roughness: 0.06,
            iridescence: 1,
            iridescenceIOR: 1.9,
            iridescenceThicknessRange: [180, 720],
            envMapIntensity: 1.3,
          })
        )
      );
      group.add(knot);

      const rings = [0xff4d00, 0xc9ced6, 0xefe4d0].map((color, i) => {
        const ring = new Mesh(
          keep(new TorusGeometry(1.8 + i * 0.26, 0.012 + i * 0.004, 8, small ? 90 : 180)),
          keep(new MeshStandardMaterial({ color, metalness: 1, roughness: 0.18 }))
        );
        group.add(ring);
        return ring;
      });

      const bead = small
        ? null
        : new Mesh(
            keep(new SphereGeometry(0.4, 48, 48)),
            // Glass without a refraction pass: a thin, clear, iridescent shell
            // that only reflects. Far cheaper than true transmission.
            keep(
              new MeshPhysicalMaterial({
                color: 0xffffff,
                metalness: 0,
                roughness: 0,
                transparent: true,
                opacity: 0.3,
                iridescence: 1,
                iridescenceIOR: 1.4,
                clearcoat: 1,
                envMapIntensity: 2.2,
                depthWrite: false,
              })
            )
          );
      if (bead) group.add(bead);

      const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
      let impulse = 0;
      let progress = animate ? 0 : 0.35;
      let time = 2;

      const frame = (dt: number) => {
        time += dt;
        pointer.x += (pointer.tx - pointer.x) * 0.05;
        pointer.y += (pointer.ty - pointer.y) * 0.05;
        impulse *= 0.94;

        const wide = camera.aspect > 1.1;
        const p = progress;
        group.position.x = wide ? 1.7 - p * 0.6 : 0;
        group.rotation.y = pointer.x * 0.7 + p * Math.PI * 1.6;
        group.rotation.x = pointer.y * 0.45 + Math.sin(p * Math.PI) * 0.4;

        knot.rotation.z += dt * (0.14 + impulse);
        knot.rotation.x += dt * 0.08;
        knot.scale.setScalar(1 + 0.04 * Math.sin(time * 0.8));

        rings.forEach((ring, i) => {
          ring.rotation.x = time * (0.16 + i * 0.07) + i * 1.3 + p * 2.2;
          ring.rotation.y = time * (0.11 - i * 0.05) + i * 0.7;
          ring.scale.setScalar(1 + p * 0.28 * (i + 1));
        });
        if (bead) {
          const a = time * 0.5;
          bead.position.set(Math.cos(a) * 1.9, Math.sin(a * 1.3) * 0.7, Math.sin(a) * 1.9);
        }
        camera.position.z = (wide ? 8.2 : 9.6) - Math.sin(p * Math.PI) * 1.4;
        renderer.render(scene, camera);
      };

      const resize = () => {
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (!w || !h) return false;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        return true;
      };
      resize();

      // Step 4: compile the materials off the main thread, then show it.
      await calm();
      if (disposed) return;
      await renderer.compileAsync(scene, camera);
      if (disposed) return;
      await breathe();
      if (disposed) return;

      const ro = new ResizeObserver(() => {
        if (resize() && !animate) frame(0);
      });
      ro.observe(host);
      cleanups.push(() => ro.disconnect());
      frame(0);
      host.classList.add("is-live");
      if (!animate) return;

      const onMove = (e: PointerEvent) => {
        pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
        impulse = Math.min(impulse + Math.hypot(e.movementX, e.movementY) * 0.004, 2.2);
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
      // The loop only runs while the chapter is on screen and the tab is visible.
      const st = ScrollTrigger.create({
        trigger: section,
        start: "top bottom",
        end: "bottom top",
        onUpdate: (self) => (progress = self.progress),
        onToggle: (self) => run(self.isActive && !document.hidden),
      });
      progress = st.progress;
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

  return <div ref={ref} className="sculpture" aria-hidden="true" />;
}
