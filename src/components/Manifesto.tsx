"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, useStage, motionOn, isSmall } from "@/lib/gsap";

const LINES = [
  "Design is a decision made visible.",
  "Code is how it stays true.",
  "No templates. No stock. No filler.",
  "One idea, built all the way through.",
];

/** How many screens of scroll the velvet takes to settle over the hero. */
const SETTLE = 1.15;

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

/**
 * Velvet. A heightfield of slow, deep folds is lit the way pile fabric is lit:
 * nearly black where it faces you, glowing oxblood where it turns away. The
 * brush texture says where the nap has been stroked and which way.
 */
const frag = (octaves: number) => `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uShift;
uniform float uSettle;
uniform sampler2D uBrush;

float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
}
float fbm(vec2 p){
  float a=.5,v=0.;
  for(int i=0;i<${octaves};i++){v+=a*noise(p);p=mat2(1.6,1.2,-1.2,1.6)*p;a*=.5;}
  return v;
}
// Heavy cloth: long folds leaning across the frame, drifting very slowly.
float cloth(vec2 p){
  vec2 q=mat2(.82,-.57,.57,.82)*p;
  q=vec2(q.x*1.35,q.y*.42);
  float w=fbm(q*.8+vec2(uTime*.011,-uTime*.007)+uShift*.35);
  return fbm(q+vec2(w*1.5,w*.4)+vec2(-uTime*.006,uTime*.009+uShift*.5));
}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;
  float mn=min(uRes.x,uRes.y);
  vec2 p=(gl_FragCoord.xy-.5*uRes)/mn;
  float e=.03;
  float h=cloth(p);
  vec3 n=normalize(vec3((h-cloth(p+vec2(e,0.)))/e*1.5,(h-cloth(p+vec2(0.,e)))/e*1.5,1.));
  float diff=max(dot(n,normalize(vec3(-.45,.55,.7))),0.);
  // Pile catches light at grazing angles, so the folds glow on their slopes.
  float sheen=pow(1.-n.z,1.4);

  vec3 deep=vec3(.03,.003,.008);
  vec3 body=vec3(.2,.012,.035);
  vec3 lit=vec3(.5,.05,.09);
  vec3 col=mix(deep,body,smoothstep(0.,.9,diff*.5+sheen*1.6));
  col+=lit*sheen*sheen*.85;

  // The pile itself: fine streaks lying along the nap.
  float pile=noise(vec2(gl_FragCoord.x*.55+h*40.,gl_FragCoord.y*.09));
  col*=.82+.3*pile;

  // Brushed nap: stroked one way it turns lighter, the other way darker.
  vec4 b=texture2D(uBrush,uv);
  float brush=b.r-b.g;
  float up=max(brush,0.),down=max(-brush,0.);
  // Stroked with the nap the pile lies flat and shines; against it, it stands
  // up and drinks the light.
  up*=.65+.7*pile;
  col=mix(col,col*2.4+lit*.3,up);
  col=mix(col,col*.2,down);

  col*=.55+.45*smoothstep(1.25,.25,length(p));

  // Settling in over the hero: the cloth rolls across the frame on the
  // diagonal, its leading edge shaped by the folds and still warm.
  float d=(uv.x*.6+(1.-uv.y)*.8)/1.4-(h-.5)*.5;
  float edge=uSettle*1.7-.35;
  float a=1.-smoothstep(edge-.3,edge,d);
  float front=smoothstep(edge-.34,edge-.12,d)*a*(1.-uSettle);
  col+=vec3(.6,.1,.03)*front;
  gl_FragColor=vec4(col*a,a);
}`;

/**
 * Chapter 2. A full screen of very dark oxblood velvet. It arrives by settling
 * over the hero's cooling colour field: molten becomes velvet, one material
 * turning into another, with no cut between the chapters. Its folds breathe and
 * drift on their own. Moving the cursor across it brushes the nap: the pile
 * turns lighter or darker along the stroke, then recovers over a couple of
 * seconds. A finger drag does the same on touch screens, and scrolling shifts
 * the folds. The manifesto lights up word by word as you scroll.
 */
export default function Manifesto() {
  const root = useRef<HTMLElement>(null);

  useStage(() => {
    const el = root.current!;
    const canvas = el.querySelector<HTMLCanvasElement>(".mf-canvas")!;
    const moving = motionOn();
    const small = isSmall();
    const cleanups: (() => void)[] = [];
    let disposed = false;

    /* ── Words light up with scroll. The reveal ends exactly where the
          pillars of the next transition begin to fall: no dead scroll. ── */
    if (moving) {
      const words = gsap.utils.toArray<HTMLElement>(".mf-word", el);
      gsap
        .timeline({
          defaults: { ease: "none" },
          scrollTrigger: {
            trigger: el,
            // The first word lights as the velvet finishes settling.
            start: () => `top+=${Math.round(window.innerHeight * SETTLE)} top`,
            end: () => `bottom ${small ? 170 : 190}%`,
            scrub: 0.5,
          },
        })
        .fromTo(
          words,
          { opacity: 0.1, yPercent: 18 },
          { opacity: 1, yPercent: 0, duration: 0.12, stagger: 0.035, ease: "power2.out" }
        );
    }

    /* ── Settling in. This chapter's stage sits on top of the hero for the
          hero's last stretch; over that stretch the velvet rolls in (`uSettle`)
          and the type appears. ── */
    let settle = moving ? 0 : 1;
    if (moving) {
      // The backdrop and the type take their opacity from --settle in CSS,
      // where the default is hidden: this chapter overlaps the hero, and must
      // show nothing there before this script has run. Until now an inline
      // script (layout.tsx) has been keeping --settle; take it over.
      const early = (window as Window & { __mfSettle?: () => void }).__mfSettle;
      if (early) window.removeEventListener("scroll", early);
      const applySettle = (v: number) => {
        settle = v;
        el.style.setProperty("--settle", v.toFixed(3));
      };
      const settling = ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: () => `+=${Math.round(window.innerHeight * SETTLE)}`,
        onUpdate: (self) => applySettle(self.progress),
        onRefresh: (self) => applySettle(self.progress),
      });
      applySettle(settling.progress);
    }

    /* ── The velvet ── */
    const gl = canvas.getContext("webgl", { antialias: false, alpha: true, powerPreference: "high-performance" });
    if (!gl) {
      canvas.style.display = "none";
      return;
    }
    const make = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, make(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, make(gl.FRAGMENT_SHADER, frag(small ? 3 : 4)));
    gl.linkProgram(prog);

    // The brush map: a small grid of how much the nap has been stroked, with
    // the nap (light) and against it (dark). It lives on the CPU and is
    // uploaded as a tiny texture, so it costs next to nothing.
    const GW = small ? 56 : 96;
    let GH = 54;
    let light = new Float32Array(GW * GH);
    let dark = new Float32Array(GW * GH);
    let bytes = new Uint8Array(GW * GH * 4);
    let dirty = false;
    const stamp = (x: number, y: number, withNap: boolean, amount: number) => {
      const cx = x * GW;
      const cy = (1 - y) * GH;
      const R = small ? 2.8 : 3.3;
      const field = withNap ? light : dark;
      const other = withNap ? dark : light;
      for (let j = Math.max(0, Math.floor(cy - R)); j <= Math.min(GH - 1, Math.ceil(cy + R)); j++) {
        for (let i = Math.max(0, Math.floor(cx - R)); i <= Math.min(GW - 1, Math.ceil(cx + R)); i++) {
          const d = Math.hypot(i - cx, j - cy) / R;
          if (d >= 1) continue;
          const f = (1 - d * d) ** 2 * amount;
          const k = j * GW + i;
          field[k] = Math.min(1, field[k] + f);
          other[k] *= 1 - f;
        }
      }
      dirty = true;
    };
    let lastX = -1;
    let lastY = -1;
    const stroke = (clientX: number, clientY: number) => {
      const r = canvas.getBoundingClientRect();
      const x = (clientX - r.left) / r.width;
      const y = (clientY - r.top) / r.height;
      if (settle < 0.95 || x < 0 || x > 1 || y < 0 || y > 1) {
        lastX = -1;
        return;
      }
      if (lastX >= 0) {
        const dx = x - lastX;
        const dy = y - lastY;
        const dist = Math.hypot(dx * GW, dy * GH);
        if (dist > 0.2 && dist < GW * 0.5) {
          // Which way is the pile being pushed, relative to how it lies?
          const withNap = dx * 0.86 - dy * 0.5 > 0;
          const steps = Math.min(24, Math.ceil(dist / 1.3));
          for (let s = 1; s <= steps; s++) {
            stamp(lastX + (dx * s) / steps, lastY + (dy * s) / steps, withNap, 0.24);
          }
        }
      }
      lastX = x;
      lastY = y;
    };

    let cleanupLoop = () => {};
    const parallel = gl.getExtension("KHR_parallel_shader_compile");
    let waitId = 0;
    const wait = () => {
      if (disposed) return;
      if (parallel && !gl.getProgramParameter(prog, parallel.COMPLETION_STATUS_KHR)) {
        waitId = requestAnimationFrame(wait);
        return;
      }
      cleanupLoop = start();
    };

    const start = () => {
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        canvas.style.display = "none";
        return () => {};
      }
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const u = {
        res: gl.getUniformLocation(prog, "uRes"),
        time: gl.getUniformLocation(prog, "uTime"),
        shift: gl.getUniformLocation(prog, "uShift"),
        settle: gl.getUniformLocation(prog, "uSettle"),
        brush: gl.getUniformLocation(prog, "uBrush"),
      };
      const tex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      const upload = () => {
        for (let k = 0; k < light.length; k++) {
          bytes[k * 4] = light[k] * 255;
          bytes[k * 4 + 1] = dark[k] * 255;
        }
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, GW, GH, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
      };
      gl.uniform1i(u.brush, 0);

      let progress = 0;
      let shift = 0.9;
      const draw = (seconds: number, dt: number) => {
        if (dirty) {
          // The pile springs back: a stroke is mostly gone after two seconds.
          const keep = Math.exp(-dt / 0.75);
          let any = false;
          for (let k = 0; k < light.length; k++) {
            light[k] *= keep;
            dark[k] *= keep;
            if (light[k] > 0.004 || dark[k] > 0.004) any = true;
          }
          dirty = any;
          upload();
        }
        // While it settles the cloth is still moving; then it comes to rest.
        shift += (progress + (1 - settle) * 0.9 - shift) * 0.06;
        gl.uniform1f(u.settle, moving ? settle : 1);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(u.res, canvas.width, canvas.height);
        gl.uniform1f(u.time, seconds);
        gl.uniform1f(u.shift, shift);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };

      const resize = () => {
        if (!canvas.clientWidth) return;
        // Soft cloth does not need full resolution: half is plenty.
        const scale = small ? 0.45 : 0.5;
        const w = Math.min(Math.round(canvas.clientWidth * scale), 1100);
        const h = Math.round((w / canvas.clientWidth) * canvas.clientHeight);
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          gl.viewport(0, 0, w, h);
          const gh = Math.max(24, Math.min(160, Math.round((GW * h) / w)));
          if (gh !== GH) {
            GH = gh;
            light = new Float32Array(GW * GH);
            dark = new Float32Array(GW * GH);
            bytes = new Uint8Array(GW * GH * 4);
          }
          upload();
        }
        if (!moving) draw(30, 0);
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);
      canvas.classList.add("is-live");
      if (!moving) return () => ro.disconnect();

      let id = 0;
      let running = false;
      let last = 0;
      const t0 = performance.now();
      const loop = (now: number) => {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        draw((now - t0) / 1000 + 30, dt);
        id = requestAnimationFrame(loop);
      };
      const run = (on: boolean) => {
        if (on === running) return;
        running = on;
        cancelAnimationFrame(id);
        if (on) {
          last = performance.now();
          id = requestAnimationFrame(loop);
        } else {
          // Leave the canvas in the state it stops in (above the chapter that
          // is fully transparent), never a frame behind.
          draw((performance.now() - t0) / 1000 + 30, 0);
        }
      };
      // The chapter overlaps the hero, so "on screen" starts when its stage
      // takes over (its top reaches the top), not when its box first shows.
      const st = ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: "bottom top",
        onUpdate: (self) => (progress = self.progress),
        onToggle: (self) => run(self.isActive && !document.hidden),
      });
      run(st.isActive);
      const onVis = () => run(st.isActive && !document.hidden);
      document.addEventListener("visibilitychange", onVis);

      const onMove = (e: PointerEvent) => {
        if (e.pointerType !== "touch") stroke(e.clientX, e.clientY);
      };
      const onTouch = (e: TouchEvent) => {
        const t = e.touches[0];
        if (t) stroke(t.clientX, t.clientY);
      };
      const lift = () => {
        lastX = -1;
      };
      window.addEventListener("pointermove", onMove, { passive: true });
      // On the window: the chapter itself takes no pointer events, because it
      // overlaps the hero and must not block the letters.
      window.addEventListener("touchstart", lift, { passive: true });
      window.addEventListener("touchmove", onTouch, { passive: true });
      window.addEventListener("touchend", lift, { passive: true });

      return () => {
        run(false);
        st.kill();
        ro.disconnect();
        document.removeEventListener("visibilitychange", onVis);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("touchstart", lift);
        window.removeEventListener("touchmove", onTouch);
        window.removeEventListener("touchend", lift);
      };
    };
    wait();
    cleanups.push(() => {
      disposed = true;
      cancelAnimationFrame(waitId);
      cleanupLoop();
    });

    return () => cleanups.forEach((fn) => fn());
  }, root);

  return (
    <section ref={root} className="manifesto">
      <div className="mf-stage">
        <div className="mf-back" aria-hidden="true" />
        <canvas className="mf-canvas" aria-hidden="true" />
        <h2 className="mf-lines">
          {LINES.map((line) => (
            <span key={line} className="mf-line">
              {line.split(" ").map((word, i) => (
                <span key={i} className="mf-word">
                  {word}{" "}
                </span>
              ))}
            </span>
          ))}
        </h2>
      </div>
    </section>
  );
}
