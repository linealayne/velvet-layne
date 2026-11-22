"use client";

import { useEffect, useRef } from "react";
import { motionOn, isSmall } from "@/lib/gsap";

export type FieldState = { bloom: number; hue: number; mx: number; my: number };

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

// Domain-warped noise: the field folds into itself like slow molten cloth.
const frag = (octaves: number) => `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uBloom;
uniform float uHue;

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
vec3 hueShift(vec3 c,float a){
  const vec3 k=vec3(.57735);float ca=cos(a);
  return c*ca+cross(k,c)*sin(a)+k*dot(k,c)*(1.-ca);
}
void main(){
  float mn=min(uRes.x,uRes.y);
  vec2 p=(gl_FragCoord.xy-.5*uRes)/mn;
  vec2 m=(uMouse*uRes-.5*uRes)/mn;
  vec2 d=p-m;
  float near=exp(-dot(d,d)*4.5);
  p-=d*near*.28;

  float t=uTime*.055;
  vec2 q=vec2(fbm(p*1.25+t),fbm(p*1.25+vec2(5.2,1.3)-t));
  vec2 r=vec2(fbm(p*1.05+2.8*q+vec2(1.7,9.2)+t*1.4),fbm(p*1.05+2.8*q+vec2(8.3,2.8)-t*1.1));
  float f=fbm(p*1.15+3.*r);

  vec3 deep=vec3(.055,.0,.015);
  vec3 wine=vec3(.33,.0,.06);
  vec3 red=vec3(.74,.02,.07);
  vec3 hot=vec3(1.,.27,.07);
  vec3 col=mix(deep,wine,smoothstep(.12,.5,f));
  col=mix(col,red,smoothstep(.3,.72,f+.4*length(q)-.22));
  col=mix(col,hot,smoothstep(.68,1.,f+.55*r.x)*(.3+.7*uBloom));
  col+=hot*near*.1*uBloom;

  // Living colour: hue drifts across the surface once the field has bloomed.
  col=hueShift(col,uHue+(q.x-.5)*1.5*uBloom+(r.y-.5)*.8*uBloom);
  col=max(col,0.);

  // Velvet nap: long soft streaks that catch light along the folds.
  float nap=noise(vec2(p.x*90.+r.x*30.,p.y*7.+r.y*10.));
  col*=.86+.24*nap*smoothstep(.2,.8,f);

  float vig=smoothstep(1.15,.15,length(p));
  col*=mix(.22+.6*vig,.82+.18*vig,uBloom);
  gl_FragColor=vec4(col,1.);
}`;

/** The living colour field. Raw WebGL, half resolution, paused off screen. */
export default function ColorField({
  state,
}: {
  state: React.RefObject<FieldState>;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const small = isSmall();
    const animate = motionOn();
    let disposed = false;
    let cleanup: (() => void) | undefined;
    let waitId = 0;

    // Everything GL happens off the hydration task, and the shader is compiled
    // in parallel where the browser supports it, so the page never blocks on it.
    const bootId = window.setTimeout(() => {
      const gl = canvas.getContext("webgl", {
        antialias: false,
        alpha: false,
        powerPreference: "high-performance",
      });
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
      gl.attachShader(prog, make(gl.FRAGMENT_SHADER, frag(small ? 4 : 5)));
      gl.linkProgram(prog);

      const parallel = gl.getExtension("KHR_parallel_shader_compile");
      const wait = () => {
        if (disposed) return;
        if (parallel && !gl.getProgramParameter(prog, parallel.COMPLETION_STATUS_KHR)) {
          waitId = requestAnimationFrame(wait);
          return;
        }
        cleanup = start(gl, prog);
      };
      wait();
    }, 0);

    function start(gl: WebGLRenderingContext, prog: WebGLProgram) {
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        canvas.style.display = "none";
        return undefined;
      }
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const u = {
        res: gl.getUniformLocation(prog, "uRes"),
        time: gl.getUniformLocation(prog, "uTime"),
        mouse: gl.getUniformLocation(prog, "uMouse"),
        bloom: gl.getUniformLocation(prog, "uBloom"),
        hue: gl.getUniformLocation(prog, "uHue"),
      };

      let mx = 0.5;
      let my = 0.5;
      const draw = (seconds: number) => {
        const s = state.current;
        mx += (s.mx - mx) * 0.06;
        my += (s.my - my) * 0.06;
        gl.uniform2f(u.res, canvas.width, canvas.height);
        gl.uniform1f(u.time, seconds);
        gl.uniform2f(u.mouse, mx, my);
        gl.uniform1f(u.bloom, animate ? s.bloom : 0.55);
        gl.uniform1f(u.hue, s.hue);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };

      const resize = () => {
        if (!canvas.clientWidth) return;
        const scale = small ? 0.42 : 0.5;
        const w = Math.min(Math.round(canvas.clientWidth * scale), 1100);
        const h = Math.round((w / canvas.clientWidth) * canvas.clientHeight);
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
          gl.viewport(0, 0, w, h);
        }
        if (!animate) draw(14);
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);
      canvas.classList.add("is-live");

      if (!animate) return () => ro.disconnect();

      let visible = true;
      let id = 0;
      const t0 = performance.now();
      const loop = (now: number) => {
        draw((now - t0) / 1000 + 14);
        id = requestAnimationFrame(loop);
      };
      const sync = () => {
        cancelAnimationFrame(id);
        if (visible && !document.hidden) id = requestAnimationFrame(loop);
      };
      const io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        sync();
      });
      io.observe(canvas);
      document.addEventListener("visibilitychange", sync);
      sync();

      return () => {
        cancelAnimationFrame(id);
        io.disconnect();
        ro.disconnect();
        document.removeEventListener("visibilitychange", sync);
      };
    }

    return () => {
      disposed = true;
      window.clearTimeout(bootId);
      cancelAnimationFrame(waitId);
      cleanup?.();
    };
  }, [state]);

  return <canvas ref={ref} className="field-canvas" />;
}
