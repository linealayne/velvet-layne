"use client";

import { useEffect, useRef } from "react";
import {
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
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
import { corridorState, ribbonLight, tunnelLight, FOG_FAR, FOG_NEAR } from "@/lib/corridorState";

const LENGTH = 52; // how far the tunnel runs before a panel wraps
const BASE_SPEED = 6.5; // units per second, always

type Slot = { mesh: Mesh; base: number; lap: number; shape: "port" | "land" };

const RIBBON_VERT = /* glsl */ `
attribute float aStrip;
attribute float aSide;
attribute float aV;
uniform float uP;
uniform float uTime;
uniform float uN;
uniform vec2 uPage;
uniform float uD0;
uniform vec2 uTun;
uniform float uFar;
varying vec2 vUv;
varying float vShade;
varying float vDepth;

float hash1(float n){return fract(sin(n*127.1+3.7)*43758.5453);}

void main(){
  float n=uN,i=aStrip;
  float u0=(i+.5)/n;
  float sw=uPage.x/n;
  float seed=hash1(i);

  // 0. The flat page, exactly filling the screen. It eases back a little so
  //    the dark can open around it.
  float back=.8*smoothstep(0.,.34,uP);
  vec3 P0=vec3((u0-.5)*uPage.x,(aV-.5)*uPage.y,-uD0-back);

  // 1. Coming loose. A cut climbs from the bottom edge; below it each strip
  //    hangs free and ripples in a light draft.
  float c=.46*smoothstep(0.,.24,uP)+.62*smoothstep(.2,.5,uP);
  float l=smoothstep(c,c-.07,aV);
  float hang=min(max(c-aV,0.),.5)*l*uPage.y;
  float w1=sin(uTime*1.05+seed*6.28+aV*6.)*.6+sin(uTime*.63+seed*11.+aV*11.)*.4;
  float w2=cos(uTime*.85+seed*9.4+aV*5.);
  P0.x+=w1*hang*.085;
  P0.z+=(w2*.5+.55)*hang*.26;
  P0.y-=hang*.07;
  float narrow=1.-.13*l;

  // 2. Pulled into the depth, loose end first.
  float pp=clamp((uP-.22)/.56,0.,1.);
  float r=smoothstep(0.,1.,pp*2.15-aV*1.15);

  // 3. Where this ribbon comes to rest: laid along a wall, the floor or the
  //    ceiling of the tunnel, running away into the distance.
  float nw=floor(n*.22+.5);
  float m=n-2.*nw;
  vec3 X;vec3 T;vec3 Nrm;float wd;
  if(i<nw){
    X=vec3(-uTun.x*.4925,((i+.5)/nw-.5)*uTun.y,0.);T=vec3(0.,1.,0.);Nrm=vec3(1.,0.,0.);wd=uTun.y/nw;
  }else if(i>=n-nw){
    float j=i-(n-nw);
    X=vec3(uTun.x*.4925,((j+.5)/nw-.5)*uTun.y,0.);T=vec3(0.,1.,0.);Nrm=vec3(-1.,0.,0.);wd=uTun.y/nw;
  }else{
    float j=i-nw;
    float top=mod(j,2.);
    float half_=ceil(m*.5);
    float k=floor(j*.5);
    X=vec3(((k+.5)/half_-.5)*uTun.x,(top<.5?-1.:1.)*uTun.y*.4925,0.);
    T=vec3(1.,0.,0.);Nrm=vec3(0.,top<.5?1.:-1.,0.);wd=uTun.x/half_;
  }
  vec3 P2=vec3(X.xy,mix(uFar,1.5,aV));

  // On the way, the ribbons gather toward the centre line and wave.
  float mid=sin(3.14159*r);
  vec3 P=mix(P0,P2,r);
  P.xy*=1.-.66*mid;
  float a=uTime*1.2+seed*20.+aV*7.;
  P.x+=sin(a)*.3*mid;
  P.y+=cos(a*.83+1.3)*.24*mid;

  // Twist: the strip turns about its own length while it is free.
  float tw=mid*sin(uTime*.9+seed*15.+aV*4.5)*1.2+l*(1.-r)*w2*.5;
  vec3 side=normalize(mix(vec3(1.,0.,0.),T,r));
  vec3 tv=normalize(mix(vec3(0.,0.,1.),Nrm,r));
  side=normalize(side*cos(tw)+tv*sin(tw));
  P+=side*aSide*mix(sw*narrow,wd*.94,r);

  vShade=(1.-.32*abs(sin(tw)))*(1.-.22*l*(1.-r)*(.5-.5*w2));
  // A ribbon gives up its light as it is laid along the tunnel, so the
  // stretched paper is never seen bright: it settles into the dark walls.
  vShade*=1.-.9*smoothstep(.42,.94,r);
  vUv=vec2((i+.5+aSide)/n,aV);
  vec4 mv=modelViewMatrix*vec4(P,1.);
  vDepth=-mv.z;
  gl_Position=projectionMatrix*mv;
}`;

const RIBBON_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uFade;
uniform vec2 uFog;
varying vec2 vUv;
varying float vShade;
varying float vDepth;
void main(){
  vec3 c=texture2D(uMap,vUv).rgb;
  c*=vShade*(gl_FrontFacing?1.:.8);
  // The tunnel's own fog, then the last of the paper's light going out.
  c*=(1.-smoothstep(uFog.x,uFog.y,vDepth))*uFade;
  gl_FragColor=vec4(c,1.);
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

      // The entrance. Editorial's last screen, as a texture, on a sheet of
      // vertical ribbons that starts as the flat page filling the screen. The
      // vertex shader takes it from there: the bottom comes loose and ripples,
      // the ribbons are drawn into the depth, and they come to rest laid along
      // the tunnel's walls, floor and ceiling. See Corridor.tsx for the timing.
      const blank = document.createElement("canvas");
      blank.width = blank.height = 2;
      let pageTex = new CanvasTexture(corridorState.page ?? blank);
      pageTex.colorSpace = SRGBColorSpace;
      let pageSeen = -1;
      const ribbonMat = new ShaderMaterial({
        vertexShader: RIBBON_VERT,
        fragmentShader: RIBBON_FRAG,
        side: DoubleSide,
        uniforms: {
          uP: { value: 0 },
          uTime: { value: 0 },
          uN: { value: 1 },
          uPage: { value: [1, 1] },
          uD0: { value: 4 },
          uTun: { value: [1, 1] },
          uFar: { value: -(LENGTH - 10) },
          uMap: { value: pageTex },
          uFade: { value: 1 },
          uFog: { value: [FOG_NEAR, FOG_FAR] },
        },
      });
      cleanups.push(() => {
        ribbonMat.dispose();
        pageTex.dispose();
      });
      let ribbons: Mesh | null = null;
      const buildRibbons = (aspect: number) => {
        if (ribbons) {
          scene.remove(ribbons);
          ribbons.geometry.dispose();
        }
        const n = aspect < 0.8 ? 6 : 14;
        const rows = aspect < 0.8 ? 34 : 46;
        const strip: number[] = [];
        const side: number[] = [];
        const along: number[] = [];
        const index: number[] = [];
        for (let i = 0; i < n; i++) {
          const base = strip.length;
          for (let k = 0; k <= rows; k++) {
            strip.push(i, i);
            side.push(-0.5, 0.5);
            along.push(k / rows, k / rows);
            if (k < rows) {
              const o = base + k * 2;
              index.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
            }
          }
        }
        const geo = new BufferGeometry();
        geo.setAttribute("position", new Float32BufferAttribute(new Float32Array(strip.length * 3), 3));
        geo.setAttribute("aStrip", new Float32BufferAttribute(strip, 1));
        geo.setAttribute("aSide", new Float32BufferAttribute(side, 1));
        geo.setAttribute("aV", new Float32BufferAttribute(along, 1));
        geo.setIndex(index);
        // The page sits at the depth where it exactly fills the screen.
        const d0 = 4;
        const hs = 2 * d0 * Math.tan((baseFov * Math.PI) / 360);
        const u = ribbonMat.uniforms;
        u.uN.value = n;
        u.uD0.value = d0;
        u.uPage.value = [hs * aspect, hs];
        u.uTun.value = [W, H];
        ribbons = new Mesh(geo, ribbonMat);
        ribbons.frustumCulled = false;
        ribbons.renderOrder = 2;
        scene.add(ribbons);
      };
      cleanups.push(() => ribbons?.geometry.dispose());

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
        buildRibbons(aspect);
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
      let lit = 1;
      let cloth = 0;
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
        // During the entrance the camera holds dead still, so the page being
        // pulled in (a DOM layer) stays welded to these walls.
        const vac = moving ? corridorState.vac : 1;
        const inside = vac >= 1 ? 1 : 0;
        // The tunnel's panels come up out of the dark as the ribbons settle.
        const light = tunnelLight(vac);
        if (light !== lit || fades.length) {
          lit = light;
          for (const m of pool) m.color.setScalar(lit * m.userData.fade);
          lineMat.opacity = 0.2 * lit;
        }
        panels.visible = lit > 0.001;
        if (ribs) ribs.visible = panels.visible;
        if (ribbons) {
          // A fresh picture of the page?
          if (corridorState.page && corridorState.pageVersion !== pageSeen) {
            pageSeen = corridorState.pageVersion;
            if (pageTex.image !== corridorState.page) {
              pageTex.dispose();
              pageTex = new CanvasTexture(corridorState.page);
              pageTex.colorSpace = SRGBColorSpace;
              pageTex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
              ribbonMat.uniforms.uMap.value = pageTex;
            } else {
              pageTex.dispose();
              pageTex.needsUpdate = true;
            }
          }
          ribbons.visible = vac < 0.995 && pageSeen >= 0;
          if (ribbons.visible) {
            cloth += Math.max(dt, 0);
            ribbonMat.uniforms.uP.value = vac;
            ribbonMat.uniforms.uTime.value = cloth;
            ribbonMat.uniforms.uFade.value = ribbonLight(vac);
          }
        }
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
      corridorState.ribbons = true;
      cleanups.push(() => {
        corridorState.ribbons = false;
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
