"use client";

import { useEffect, useRef } from "react";
import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  Fog,
  Group,
  HalfFloatType,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Quaternion,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { ScrollTrigger, scrollState, calm, motionOn, isSmall } from "@/lib/gsap";
import { preloadCorridor } from "@/lib/corridorAssets";
import { corridorState, FOG_FAR, FOG_NEAR } from "@/lib/corridorState";
import { createStudio, DEPTH_RANGE, T, type Pic, type Studio } from "@/lib/studio";

const LENGTH = 52; // how far the tunnel runs before a panel wraps
const BASE_SPEED = 6.5; // units per second, always

type Slot = { mesh: Mesh; base: number; lap: number; shape: "port" | "land" };

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Depth of field, for the studio only. The room is drawn into a float target
 * whose alpha holds each pixel's distance (see `film` in lib/studio.ts); this
 * pass blurs by how far that distance is from the one in focus. Gentle: a few
 * pixels at most. Not used on phones, and not used at all once it has faded
 * out, so the tunnel is always drawn straight to the screen as before.
 */
const DOF_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform vec2 uPx;
uniform float uFocus;
uniform float uAmount;
uniform float uMax;
varying vec2 vUv;
float coc(float a){
  float d=max(a*${DEPTH_RANGE}.,.05);
  return clamp(abs(1./uFocus-1./d)*1.5*uAmount,0.,1.);
}
void main(){
  vec4 c0=texture2D(tColor,vUv);
  float r0=coc(c0.a);
  vec3 sum=c0.rgb;
  float wsum=1.;
  for(int i=0;i<18;i++){
    float fi=float(i)+.5;
    float rad=sqrt(fi/18.);
    float ang=fi*2.39996;
    vec4 s=texture2D(tColor,vUv+vec2(cos(ang),sin(ang))*rad*uMax*uPx);
    // a neighbour counts if its own blur reaches here, or if this pixel is
    // blurred and the neighbour is not something sharp in front of it
    float reach=max(coc(s.a),r0*step(c0.a-.01,s.a));
    float w=clamp((reach-rad)*5.+1.,0.,1.);
    sum+=s.rgb*w;
    wsum+=w;
  }
  gl_FragColor=vec4(sum/wsum,1.);
  #include <colorspace_fragment>
}`;

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
 * The same scene also holds the studio (lib/studio.ts), the room the way in
 * passes through. While `corridorState.vac` is below 1 the studio is what is
 * drawn; its framed pictures then fly to the tunnel's own panels, and from
 * vac = 1 on this is the tunnel exactly as it has always been.
 *
 * This component is mounted long before the chapter is reached. By the time
 * the visitor arrives the textures are already on the GPU and the first frame
 * has been drawn, so nothing is blank and nothing pops in.
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
      // Only the studio's lamp casts shadows; the tunnel has no lights at all.
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = PCFSoftShadowMap;
      host.appendChild(renderer.domElement);

      const scene = new Scene();
      const fog = new Fog(0x000000, FOG_NEAR, FOG_FAR);
      scene.fog = fog;
      const fogU = { value: new Vector2(FOG_NEAR, FOG_FAR) };
      const camera = new PerspectiveCamera(62, 1, 0.1, LENGTH + 30);
      const unit = new PlaneGeometry(1, 1);
      cleanups.push(() => unit.dispose());

      const [studioSet] = await Promise.all([assets.studio, assets.postersDone]);
      await pause();
      if (disposed) return;

      // Texture pool. Posters are portrait, captures are landscape. Every
      // texture is uploaded to the GPU now, not when a panel first shows it.
      const fades: MeshBasicMaterial[] = [];
      const pool: MeshBasicMaterial[] = [];
      const material = (canvas: HTMLCanvasElement) => {
        const tex = new CanvasTexture(canvas);
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        const mat = new MeshBasicMaterial({ map: tex, toneMapped: false });
        mat.userData.fade = 1;
        pool.push(mat);
        renderer.initTexture(tex);
        cleanups.push(() => {
          tex.dispose();
          mat.dispose();
        });
        return mat;
      };
      const port = assets.posters.map(material);
      const land = assets.captures.map((asset) => {
        const mat = material(asset.canvas());
        if (!asset.ready) {
          // The real image replaces the placeholder with a quick fade up.
          asset.listeners.push(() => {
            if (disposed || !mat.map) return;
            mat.map.needsUpdate = true;
            renderer.initTexture(mat.map);
            mat.userData.fade = 0.25;
            fades.push(mat);
          });
        }
        return mat;
      });

      // The studio.
      let studio: Studio | null = null;
      if (studioSet) {
        const envTex = new Texture(studioSet.room);
        envTex.colorSpace = SRGBColorSpace;
        envTex.needsUpdate = true;
        const pmrem = new PMREMGenerator(renderer);
        const env = pmrem.fromEquirectangular(envTex);
        scene.environment = env.texture;
        scene.environmentIntensity = 0.16;
        envTex.dispose();
        pmrem.dispose();
        studio = createStudio({
          renderer,
          small,
          images: studioSet,
          art: { port: port.map((m) => m.map!), land: land.map((m) => m.map!) },
          fog: fogU,
        });
        scene.add(studio.group);
        const made = studio;
        cleanups.push(() => {
          made.dispose();
          env.dispose();
        });
      }
      await pause();
      if (disposed) return;

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

      // The page, as a texture for the sheet of paper in the studio.
      let pageTex: CanvasTexture | null = null;
      let pageSeen = -1;
      cleanups.push(() => pageTex?.dispose());

      /* ── The pictures' way from the studio wall to the tunnel ──
         Each framed picture is given one of the tunnel's own panels to fly
         to. While it is on its way that panel is hidden; when it lands the
         panel takes over, showing the same picture in the same place. */
      const targets = new Map<Pic, Slot>();
      const hidden = new Set<Slot>();
      let lastVac = 1;
      const release = () => {
        hidden.forEach((s) => (s.mesh.visible = true));
        hidden.clear();
        targets.clear();
      };

      const layout = (aspect: number) => {
        release();
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
        studio?.layout(aspect, baseFov, H);
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

      const assign = (fromInside: boolean) => {
        if (!studio) return;
        release();
        const free = { port: [] as Slot[], land: [] as Slot[] };
        // nearest panels first, and only ones in front of the camera
        [...slots]
          .filter((s) => s.mesh.position.z < -1.2 && s.mesh.position.z > -30)
          .sort((a, b) => b.mesh.position.z - a.mesh.position.z)
          .forEach((s) => free[s.shape].push(s));
        for (const p of studio.pics) {
          const slot = free[p.shape].shift();
          if (!slot) continue;
          targets.set(p, slot);
          const mat = slot.mesh.material as MeshBasicMaterial;
          if (fromInside) {
            // coming back out of the tunnel: the picture is whatever the panel shows
            p.material.map = mat.map;
          } else {
            const same = pool.find((m) => m.map === p.material.map);
            if (same) slot.mesh.material = same;
          }
        }
      };
      const far = new Vector3(0, 0, -60);
      const qa = new Quaternion();
      const glide = (vac: number) => {
        if (!studio) return;
        for (const p of studio.pics) {
          const slot = targets.get(p);
          const k = studio.glide(vac, p);
          if (!slot) {
            // no panel free for it (small tunnels): it follows its frame away
            p.art.position.copy(p.home).lerp(far, k * k * k);
            p.art.quaternion.copy(p.homeQ);
            p.art.scale.set(p.w, p.h, 1);
            p.glow.value = 0;
            p.art.visible = k < 0.99;
            continue;
          }
          if (k >= 1) {
            p.art.visible = false;
            if (hidden.delete(slot)) slot.mesh.visible = true;
            continue;
          }
          if (!hidden.has(slot)) {
            hidden.add(slot);
            slot.mesh.visible = false;
          }
          p.art.visible = true;
          p.art.position.lerpVectors(p.home, slot.mesh.position, k);
          // it comes off the wall toward you before it turns into place
          p.art.position.z += Math.sin(Math.PI * k) * 1.1 * (1 - k);
          qa.copy(p.homeQ).slerp(slot.mesh.quaternion, k);
          p.art.quaternion.copy(qa);
          p.art.scale.set(p.w + (slot.mesh.scale.x - p.w) * k, p.h + (slot.mesh.scale.y - p.h) * k, 1);
          // the room is going dark: the picture begins to show by its own light
          p.glow.value = smooth(0, 0.5, k);
        }
      };

      /* ── Depth of field (desktop) ── */
      const dof = !small && !!studio && renderer.capabilities.isWebGL2;
      let target: WebGLRenderTarget | null = null;
      const post = new ShaderMaterial({
        uniforms: {
          tColor: { value: null },
          uPx: { value: new Vector2(1, 1) },
          uFocus: { value: 4 },
          uAmount: { value: 0 },
          uMax: { value: 9 },
        },
        vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}",
        fragmentShader: DOF_FRAG,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      });
      const quad = new Mesh(new PlaneGeometry(2, 2), post);
      quad.frustumCulled = false;
      const postScene = new Scene();
      postScene.add(quad);
      const postCam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
      cleanups.push(() => {
        post.dispose();
        quad.geometry.dispose();
        target?.dispose();
      });

      let zoff = 1.3;
      let sway = 1;
      let dimmed = false;
      let stir = 0;
      let clock = 0;
      let speed = BASE_SPEED;
      const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
      const mod = (a: number, n: number) => ((a % n) + n) % n;

      const frame = (dt: number, forceVac?: number, plain = false) => {
        const vac = forceVac ?? (moving ? corridorState.vac : 1);
        // A fresh picture of the page?
        if (studio && corridorState.page && corridorState.pageVersion !== pageSeen) {
          pageSeen = corridorState.pageVersion;
          pageTex?.dispose();
          pageTex = new CanvasTexture(corridorState.page);
          pageTex.colorSpace = SRGBColorSpace;
          pageTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          renderer.initTexture(pageTex);
          studio.setPage(pageTex);
          corridorState.sheet = true;
        }
        const inStudio = !!studio && vac < 1 && (pageSeen >= 0 || forceVac !== undefined);
        const inside = inStudio ? 0 : 1;
        clock += Math.max(dt, 0);

        // The tunnel stands still until the pictures have landed, then streams.
        const flow = inStudio ? smooth(T.flow[0], T.flow[1], vac) : 1;
        const want = BASE_SPEED + Math.max(-24, Math.min(30, scrollState.velocity * 0.012));
        speed += (want - speed) * 0.07;
        zoff += speed * dt * flow;
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
          const c = Math.min(1, fades[i].userData.fade + Math.max(dt, 0.016) * 3.2);
          fades[i].userData.fade = c;
          if (c >= 1) fades.splice(i, 1);
        }
        if (fades.length || dimmed) {
          dimmed = fades.length > 0;
          for (const m of pool) m.color.setScalar(m.userData.fade);
        }

        // The shake lives on scrolling alone: it follows how hard the page is
        // being pulled and is exactly zero at rest.
        const pulling = Math.min(1, Math.abs(scrollState.velocity) / 900);
        stir += (pulling - stir) * (pulling > stir ? 0.3 : 0.12);
        if (pulling < 0.012 && stir < 0.02) stir = 0;

        pointer.x += (pointer.tx - pointer.x) * 0.05;
        pointer.y += (pointer.ty - pointer.y) * 0.05;
        sway += (inside - sway) * 0.06;
        let focus: { distance: number; amount: number } | null = null;

        if (inStudio && studio) {
          studio.group.visible = true;
          studio.update(vac, clock, dt, moving ? stir : 0, camera.aspect);
          // Which panel each picture flies to is settled once per pass.
          const inGlide = vac >= T.glide - 0.03;
          if (inGlide && !targets.size) assign(lastVac >= 1);
          else if (!inGlide && targets.size) release();
          glide(vac);
          const cam = studio.camera(vac);
          camera.position.set(0, 0, cam.z);
          camera.rotation.set(0, cam.yaw, 0);
          if (Math.abs(camera.fov - baseFov) > 0.001) {
            camera.fov = baseFov;
            camera.updateProjectionMatrix();
          }
          sway = 0;
          // The dark clears down the tunnel as the pictures arrive.
          const lift = smooth(T.fog[0], T.fog[1], vac);
          fog.near = 0.05 + (FOG_NEAR - 0.05) * lift;
          fog.far = 0.1 + (FOG_FAR - 0.1) * lift;
          panels.visible = vac > T.glide - 0.02;
          if (dof && !plain) focus = studio.focus(vac, cam.z);
        } else {
          if (studio) studio.group.visible = false;
          if (targets.size) release();
          camera.position.set(0, 0, 0);
          camera.rotation.y = -pointer.x * 0.07 * sway;
          camera.rotation.x = -pointer.y * 0.045 * sway;
          const fov = baseFov + Math.min(12, Math.abs(speed - BASE_SPEED) * 0.45) * sway;
          if (Math.abs(fov - camera.fov) > 0.05) {
            camera.fov = fov;
            camera.updateProjectionMatrix();
          }
          fog.near = FOG_NEAR;
          fog.far = FOG_FAR;
          panels.visible = true;
        }
        fogU.value.set(fog.near, fog.far);
        if (ribs) ribs.visible = panels.visible;
        lastVac = vac;

        if (focus && focus.amount > 0.004 && target) {
          renderer.setRenderTarget(target);
          renderer.render(scene, camera);
          renderer.setRenderTarget(null);
          post.uniforms.tColor.value = target.texture;
          post.uniforms.uFocus.value = focus.distance;
          post.uniforms.uAmount.value = focus.amount;
          renderer.render(postScene, postCam);
        } else {
          renderer.render(scene, camera);
        }
      };

      let shapeKey = -1;
      const resize = () => {
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (!w || !h) return false;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        if (dof) {
          const size = renderer.getDrawingBufferSize(new Vector2());
          if (!target) target = new WebGLRenderTarget(size.x, size.y, { type: HalfFloatType, samples: 4 });
          else target.setSize(size.x, size.y);
          post.uniforms.uPx.value.set(1 / size.x, 1 / size.y);
          post.uniforms.uMax.value = 7 * renderer.getPixelRatio();
        }
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

      if (!moving) {
        // Reduced motion: one still of the studio wall (the ball already in
        // the bin), handed to the page as a picture, then one still of the
        // tunnel, which stays in this canvas.
        const still = section.querySelector<HTMLImageElement>(".studio-still img");
        if (studio && still) {
          frame(60, 0.46);
          still.src = renderer.domElement.toDataURL("image/jpeg", 0.86);
          section.classList.add("has-studio");
        }
        frame(0);
        host.classList.add("is-live");
        return;
      }

      // Draw now, well before arrival: this is the frame the visitor first sees.
      // (Twice as the studio too, with and without depth of field, so every
      // shader, the shadow map and the float target are warm before arrival.)
      // Every state of the room is drawn once here, each in its own task:
      // with depth of field and without (they are different programs), with
      // the ball in the air and in the bin, and with the pictures in flight.
      if (studio) {
        const states: [dt: number, v: number, plain: boolean][] = [
          [0, 0.1, true],
          [0, 0.3, false],
          [0, 0.3, true],
          [60, 0.45, false],
          [60, 0.45, true],
          [0, 0.66, true],
          [0, 0.82, true],
          [60, 0.02, false],
        ];
        for (const [dt, v, plain] of states) {
          frame(dt, v, plain);
          await pause();
          if (disposed) return;
        }
      }
      frame(0);
      host.classList.add("is-live");
      cleanups.push(() => {
        corridorState.sheet = false;
      });

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
