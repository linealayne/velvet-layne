"use client";

import { useEffect, useRef } from "react";
import {
  BufferGeometry,
  CanvasTexture,
  Color,
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
  ShaderMaterial,
  SRGBColorSpace,
  WebGLRenderer,
} from "three";
import { ScrollTrigger, scrollState, calm, motionOn, isSmall } from "@/lib/gsap";
import { preloadCorridor } from "@/lib/corridorAssets";
import { corridorState, FOG_FAR, FOG_NEAR, HOLE_OPENS } from "@/lib/corridorState";

const LENGTH = 52; // how far the tunnel runs before a panel wraps
const BASE_SPEED = 6.5; // units per second, always

type Slot = { mesh: Mesh; base: number; lap: number; shape: "port" | "land" };

/** The sheet's radius, in half-diagonals of the screen. */
const SHEET = 1.32;

/**
 * The suction entrance. The page is printed on a sheet stretched across the
 * mouth of the tunnel: a disc of fine rings around the exact centre of the
 * screen, larger than the screen, blank paper beyond the page's own edges.
 * Each vertex knows where it lies on the flat sheet (`q0`); the shader moves
 * it the way a sheet moves into a drain:
 *   - a dent: the centre is pushed back in depth with a smooth radial falloff;
 *   - a sink: the sheet flows inward. Area flows in at one rate everywhere
 *     (r squared falls by the same amount), so the centre goes first and
 *     fastest and the edges of the page are dragged in last;
 *   - a throat: what has passed the rim of the hole runs down into the depth,
 *     darkening, and is gone. The hole is a true hole: the tunnel behind is
 *     seen through it.
 * At uP = 0 it is exactly the flat page filling the screen.
 */
const SHEET_VERT = /* glsl */ `
uniform float uP;
uniform vec2 uPage;
uniform float uD0;
uniform float uRc;
uniform vec3 uShake;
varying vec2 vUv;
varying float vShade;
varying float vAlpha;

float ramp(float a,float b,float x){return clamp((x-a)/(b-a),0.,1.);}

void main(){
  float t=length(position.xy);
  vec2 dir=t>1e-5?position.xy/t:vec2(1.,0.);
  float r0=uRc*SHEET*pow(t,1.12);
  vec2 q0=dir*r0;
  vUv=q0/uPage+.5;
  float rc2=uRc*uRc;
  float r2=r0*r0;

  // The dent: gentle at first, then it accelerates. Once the hole is wide
  // the funnel shallows, so its mouth opens out toward the screen.
  float g=ramp(.1,.66,uP);
  float D=3.4*g*g*(1.-.72*smoothstep(.5,.85,uP));
  float w=uRc*(.13+.2*g);

  // The sink. Q is how much of the sheet (as r squared) has been swallowed.
  float s=ramp(.26,.93,uP);
  float Q=QMAX*rc2*pow(s,2.2);
  // The hole: nothing at first, then the dark opens at the centre.
  float open=smoothstep(HOLE,HOLE+.16,uP);
  float a2=Q*.85*open;
  float a=sqrt(a2);

  float sig2=r2-Q;
  float rho;float depth;float thr=0.;
  if(sig2>=0.){
    // Still on the sheet, drawn in toward the drain.
    rho=sqrt(sig2+a2);
    depth=D*exp(-sig2/(w*w));
  }else{
    // Past the rim: down the throat.
    thr=min(-sig2/(.22*rc2),1.);
    rho=a*(1.-.3*thr);
    depth=D+3.6*thr;
  }

  vec2 p=dir*rho;
  // The tremor: a tiny offset and turn of the whole sheet.
  float cr=cos(uShake.z),sr=sin(uShake.z);
  p=vec2(p.x*cr-p.y*sr,p.x*sr+p.y*cr)+uShake.xy;

  // Paper darkens as it stretches down into the funnel.
  // By the rim it is in shadow, and it is black before it thins away, so
  // no pale paper ever lies over the tunnel.
  float sink=clamp(depth/3.4,0.,1.);
  float lip=sig2>=0.?exp(-sig2/(w*w)):1.;
  vShade=mix(1.,.2,max(pow(sink,.85),.85*lip*open));
  // The walls of the dent catch the light on one side.
  float slope=sig2>=0.?2.*sqrt(sig2)/(w*w)*depth:0.;
  vShade*=1.-.24*clamp(slope*.5,0.,1.)*dot(dir,vec2(-.58,.81));
  vShade*=1.-smoothstep(0.,.3,thr);
  vAlpha=1.-smoothstep(.28,.8,thr);

  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,-uD0-depth,1.);
}`;

const SHEET_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uPaper;
uniform float uGrain;
uniform float uEdge;
uniform float uSeed;
varying vec2 vUv;
varying float vShade;
varying float vAlpha;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
void main(){
  if(vAlpha<.004)discard;
  // Beyond the page's own edge the sheet is blank paper.
  vec2 in2=step(vec2(0.),vUv)*step(vUv,vec2(1.));
  vec3 c=mix(uPaper,texture2D(uMap,clamp(vUv,0.,1.)).rgb,in2.x*in2.y);
  // While it trembles the edges darken a little and the grain comes up.
  c*=1.-uEdge*smoothstep(.3,.74,length(vUv-.5));
  c+=(hash(gl_FragCoord.xy+uSeed)-.5)*uGrain;
  gl_FragColor=vec4(c*vShade,vAlpha);
  #include <colorspace_fragment>
}`;

// The whole sheet (and the last of its throat) must be gone by the end.
const QMAX = SHEET * SHEET + 0.3;
const sheetVert = SHEET_VERT.replaceAll("QMAX", QMAX.toFixed(3))
  .replaceAll("SHEET", SHEET.toFixed(3))
  .replaceAll("HOLE", HOLE_OPENS.toFixed(3));
const sheetFrag = SHEET_FRAG;

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

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
      scene.fog = new Fog(0x000000, FOG_NEAR, FOG_FAR);
      const camera = new PerspectiveCamera(62, 1, 0.1, LENGTH + 10);
      const unit = new PlaneGeometry(1, 1);
      cleanups.push(() => unit.dispose());

      await assets.postersDone;
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

      // The entrance: Editorial's last screen, as a texture, on a sheet that
      // rides with the camera and at rest exactly fills the screen. It is the
      // front-most thing (no depth test), drawn after the tunnel.
      const blank = document.createElement("canvas");
      blank.width = blank.height = 2;
      let pageTex = new CanvasTexture(corridorState.page ?? blank);
      pageTex.colorSpace = SRGBColorSpace;
      let pageSeen = -1;
      const D0 = 4;
      const paper = new Color(
        getComputedStyle(document.documentElement).getPropertyValue("--paper").trim() || "#d9c8a9"
      );
      const sheetMat = new ShaderMaterial({
        vertexShader: sheetVert,
        fragmentShader: sheetFrag,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uP: { value: 0 },
          uPage: { value: [1, 1] },
          uD0: { value: D0 },
          uRc: { value: 1 },
          uShake: { value: [0, 0, 0] },
          uMap: { value: pageTex },
          uPaper: { value: paper },
          uGrain: { value: 0 },
          uEdge: { value: 0 },
          uSeed: { value: 0 },
        },
      });
      // A disc of rings around the centre: the pull is radial, so the mesh is.
      // Phones get a coarser one.
      const sheetGeo = (() => {
        const rings = small ? 56 : 104;
        const sectors = small ? 72 : 144;
        const pos: number[] = [];
        const index: number[] = [];
        for (let r = 0; r <= rings; r++) {
          for (let k = 0; k <= sectors; k++) {
            const th = (k / sectors) * Math.PI * 2;
            pos.push((Math.cos(th) * r) / rings, (Math.sin(th) * r) / rings, 0);
          }
        }
        const row = sectors + 1;
        for (let r = 0; r < rings; r++) {
          for (let k = 0; k < sectors; k++) {
            const o = r * row + k;
            index.push(o, o + row, o + 1, o + 1, o + row, o + row + 1);
          }
        }
        const geo = new BufferGeometry();
        geo.setAttribute("position", new Float32BufferAttribute(pos, 3));
        geo.setIndex(index);
        return geo;
      })();
      const sheet = new Mesh(sheetGeo, sheetMat);
      sheet.frustumCulled = false;
      sheet.renderOrder = 5;
      sheet.visible = false;
      scene.add(camera);
      camera.add(sheet);
      cleanups.push(() => {
        sheetMat.dispose();
        sheetGeo.dispose();
        pageTex.dispose();
      });



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
      let sway = 1;
      let dimmed = false;
      let stir = 0;
      let seed = 0;
      const shake = [0, 0, 0];
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
          const c = Math.min(1, fades[i].userData.fade + Math.max(dt, 0.016) * 3.2);
          fades[i].userData.fade = c;
          if (c >= 1) fades.splice(i, 1);
        }
        const vac = moving ? corridorState.vac : 1;
        const inside = vac >= 1 ? 1 : 0;
        if (fades.length || dimmed) {
          dimmed = fades.length > 0;
          for (const m of pool) m.color.setScalar(m.userData.fade);
        }
        // A fresh picture of the page?
        if (corridorState.page && corridorState.pageVersion !== pageSeen) {
          pageSeen = corridorState.pageVersion;
          pageTex.dispose();
          if (pageTex.image !== corridorState.page) {
            pageTex = new CanvasTexture(corridorState.page);
            pageTex.colorSpace = SRGBColorSpace;
            pageTex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
            sheetMat.uniforms.uMap.value = pageTex;
          } else {
            pageTex.needsUpdate = true;
          }
          corridorState.sheet = true;
        }
        sheet.visible = moving && pageSeen >= 0 && vac < 0.94;
        // Until the hole opens the sheet covers everything: the tunnel behind
        // it runs on, but need not be drawn. It is drawn, complete and lit,
        // from just before the dark opens.
        panels.visible = !sheet.visible || vac > HOLE_OPENS - 0.05;
        if (ribs) ribs.visible = panels.visible;

        // During the entrance the camera holds dead still.
        pointer.x += (pointer.tx - pointer.x) * 0.05;
        pointer.y += (pointer.ty - pointer.y) * 0.05;
        sway += (inside - sway) * 0.06;
        camera.rotation.y = -pointer.x * 0.07 * sway;
        camera.rotation.x = -pointer.y * 0.045 * sway;
        const fov = baseFov + Math.min(12, Math.abs(speed - BASE_SPEED) * 0.45) * sway;
        if (Math.abs(fov - camera.fov) > 0.05) {
          camera.fov = fov;
          camera.updateProjectionMatrix();
        }

        if (sheet.visible) {
          const u = sheetMat.uniforms;
          // The sheet fills the screen whatever the lens is doing.
          const hs = 2 * D0 * Math.tan((camera.fov * Math.PI) / 360);
          const ws = hs * camera.aspect;
          u.uPage.value = [ws, hs];
          u.uRc.value = Math.hypot(ws, hs) / 2;
          u.uP.value = vac;
          // The tremor lives on scrolling alone: it follows how hard the page
          // is being pulled and is exactly zero at rest.
          const want = Math.min(1, Math.abs(scrollState.velocity) / 900);
          stir += (want - stir) * (want > stir ? 0.3 : 0.12);
          if (want < 0.012 && stir < 0.02) stir = 0;
          const build = smooth(0, 0.34, vac) * (1 - 0.75 * smooth(0.6, 0.9, vac));
          const amp = stir * build * (small ? 1.15 : 2.2) * (hs / Math.max(1, host.clientHeight));
          if (amp > 0) {
            // Irregular, tight, never a swing: a new random pull every frame,
            // lightly held over from the last.
            shake[0] += ((Math.random() * 2 - 1) * amp - shake[0]) * 0.7;
            shake[1] += ((Math.random() * 2 - 1) * amp - shake[1]) * 0.7;
            shake[2] += ((Math.random() * 2 - 1) * amp * 0.07 - shake[2]) * 0.7;
            seed = (seed + 17.37) % 289;
          } else {
            shake[0] = shake[1] = shake[2] = 0;
          }
          u.uShake.value = shake;
          u.uSeed.value = seed;
          u.uGrain.value = 0.045 * smooth(0, 0.36, vac);
          u.uEdge.value = 0.3 * smooth(0.02, 0.42, vac) * (1 - smooth(0.5, 0.8, vac));
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
      cleanups.push(() => {
        corridorState.sheet = false;
      });
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
