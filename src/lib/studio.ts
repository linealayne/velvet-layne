/**
 * The studio: the room the "4" page turns out to have been in.
 *
 * Everything between Editorial and the Corridor is drawn here, in the
 * Corridor's own three.js scene and renderer, and every part of it is a pure
 * function of one number, `v` (0 to 1, the entrance; see Corridor.tsx):
 *
 *   0.00-0.21  crumple   the page is crumpled, as paper, into a ball
 *   0.19-0.34  pull back the lights come up, the camera draws back: a room
 *   0.33       the toss  the ball is thrown: wall, bounce, rim, bin
 *   0.40-0.90  shake     lamp, frames and dust tremble (only while scrolled)
 *   0.54-0.86  suction   the wall leaves brick by brick, then the floor
 *   0.74-0.98  glide     the pictures drop their frames and fly to the tunnel
 *
 * What is real and what is drawn:
 *  - wall and floor are photographs of real brick and real boards (Poly Haven,
 *    CC0; see scripts/studio-assets.mjs), cut into instanced bricks and
 *    planks so each can leave on its own;
 *  - lamp, bin, frames, dust and the paper are modelled here;
 *  - the pictures in the frames are the Corridor's own posters and captures.
 *
 * The room lives in the tunnel's coordinates: the camera ends at the origin
 * looking down -z, the wall stands across the tunnel at z = WALL_Z, and the
 * floor is the tunnel's floor.
 */
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CustomBlending,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  IcosahedronGeometry,
  LatheGeometry,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NoColorSpace,
  OneFactor,
  PlaneGeometry,
  PointLight,
  Points,
  Quaternion,
  RepeatWrapping,
  ShaderMaterial,
  SphereGeometry,
  SpotLight,
  SRGBColorSpace,
  Texture,
  TorusGeometry,
  Vector2,
  Vector3,
  Vector4,
  ZeroFactor,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from "three";

export const WALL_Z = -7.5;
const LAMP_SCALE = 1.75;
/** Where the camera starts (closer to the wall), and how far in front of it the page hangs. */
export const CAM_START = -2.6;
export const PAGE_DIST = 1.5;
/** How far away the bricks go. */
const VANISH_Z = -64;

/* The beats, in v. */
export const T = {
  crumple: [0, 0.21],
  /** The room is dark, and not drawn at all, until this. */
  reveal: [0.19, 0.31],
  camera: [0.2, 0.34],
  toss: 0.33,
  shake: [0.4, 0.5, 0.8, 0.92],
  pull: [0.54, 0.86],
  /** The lamp dies, then it and the bin are pulled in. */
  dark: [0.74, 0.86],
  props: [0.76, 0.9],
  release: 0.6,
  glide: 0.72,
  fog: [0.72, 0.9],
  flow: [0.97, 1],
  dof: [0.48, 0.58],
} as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const ramp = (a: number, b: number, x: number) => clamp01((x - a) / (b - a));
const smooth = (a: number, b: number, x: number) => {
  const t = ramp(a, b, x);
  return t * t * (3 - 2 * t);
};
const rnd = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/* ───────── Film: one tone curve for every lit thing in the room ───────── */

/**
 * The room's materials do their own filmic tone mapping (the ACES fit) rather
 * than using the renderer's. That keeps the tunnel's panels, which are plain
 * unlit textures, exactly as they are, and it makes the picture identical
 * whether it is drawn straight to the screen or through the depth-of-field
 * pass. Opaque materials also write their distance into alpha for that pass.
 */
const TONE = /* glsl */ `
uniform float uExposure;
vec3 studioTone(vec3 c){
  c*=uExposure/.6;
  const mat3 A=mat3(.59719,.07600,.02840,.35458,.90834,.13383,.04823,.01566,.83777);
  const mat3 B=mat3(1.60475,-.10208,-.00327,-.53108,1.10813,-.07276,-.07367,-.00605,1.07602);
  c=A*c;
  vec3 a=c*(c+.0245786)-.000090537;
  vec3 b=c*(.983729*c+.4329510)+.238081;
  return clamp(B*(a/b),0.,1.);
}`;
const TONED = "gl_FragColor.rgb = studioTone(gl_FragColor.rgb);";
export const DEPTH_RANGE = 40;

type Shader = WebGLProgramParametersWithUniforms;
/** The room's exposure: 0 while the page is being crumpled (the room is dark), 1 once revealed. */
const exposure = { value: 1 };
/** The paper's own: it is lit from the start. */
const paperExposure = { value: 1 };

function film<M extends Material>(mat: M, key: string, extra?: (sh: Shader) => void, expo = exposure): M {
  mat.toneMapped = false;
  (mat as unknown as { fog: boolean }).fog = false;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uExposure = expo;
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\n" + TONE)
      .replace("#include <tonemapping_fragment>", TONED)
      .replace(
        "#include <dithering_fragment>",
        "#include <dithering_fragment>\n" +
          (mat.transparent ? "" : `gl_FragColor.a = clamp(vViewPosition.z / ${DEPTH_RANGE}., 0., 1.);`)
      );
    extra?.(sh);
  };
  mat.customProgramCacheKey = () => "studio-" + key;
  return mat;
}

/* ───────── Small procedural textures ───────── */

function canvasOf(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** A fine paper tooth, as a normal map. */
function paperNormal() {
  const N = 128;
  const height = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) height[i] = rnd(i * 1.37) * 0.6 + rnd(Math.floor(i / 3) * 2.11) * 0.4;
  const c = canvasOf(N, N);
  const g = c.getContext("2d")!;
  const img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const at = (xx: number, yy: number) => height[((yy + N) % N) * N + ((xx + N) % N)];
      const dx = at(x + 1, y) - at(x - 1, y);
      const dy = at(x, y + 1) - at(x, y - 1);
      const k = (y * N + x) * 4;
      img.data[k] = 128 + dx * 90;
      img.data[k + 1] = 128 + dy * 90;
      img.data[k + 2] = 255;
      img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(9, 9);
  t.colorSpace = NoColorSpace;
  return t;
}

/** Brushed metal: fine streaks running round the bin, as roughness. */
function brushed() {
  const c = canvasOf(256, 64);
  const g = c.getContext("2d")!;
  g.fillStyle = "#8a8a8a";
  g.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 900; i++) {
    const y = rnd(i) * 64;
    const v = Math.floor(90 + rnd(i + 7) * 120);
    g.fillStyle = `rgba(${v},${v},${v},.35)`;
    g.fillRect(rnd(i + 3) * 256, y, 30 + rnd(i + 5) * 160, 0.6 + rnd(i + 9));
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(3, 1);
  t.colorSpace = NoColorSpace;
  return t;
}

/* ───────── The paper ───────── */

/**
 * How the page is crumpled. It is paper, so it is never bent or stretched:
 * it is only ever FOLDED, along straight lines.
 *
 * The sheet sits inside a cage of FOLDS planes that closes in on it from all
 * round. Whatever part of the sheet is outside a plane is mirrored back
 * through it. A mirror is a rigid move and the points on the plane stay
 * where they are, so each plane leaves a perfectly straight crease, the
 * pieces on either side stay perfectly flat, and no part of the sheet changes
 * size. The planes reach the corners and edges first, so those fold in first;
 * as the cage shrinks the creases multiply, and when it has closed to the
 * size of a fist the sheet is a tight wad of flat facets. Two passes over the
 * planes are enough to bring every point inside (checked offline).
 *
 * Before that, a few shallow straight ridges buckle up across the sheet, the
 * way paper gives under the first squeeze.
 *
 * At uC = 0 every plane is beyond the sheet: it is exactly the flat page.
 * Facet normals are not computed here at all: the material is flat-shaded.
 */
export const FOLDS = 24;
const RIDGES = 9;
const PAPER_VERT = /* glsl */ `
uniform vec2 uPage;
uniform float uR;
uniform float uEps;
uniform vec4 uFold[${FOLDS}];
uniform vec4 uRidge[${RIDGES}];
uniform vec3 uRidgeA[${RIDGES}];
varying float vCore;
// The grid cannot follow a crease exactly: a triangle that straddles one
// would cut the corner, and a row of them makes a sawtooth. So the vertices
// within a hair (e, half a grid cell) of a crease are gathered onto it, and
// the next hair is stretched to make up. x is the distance to the crease.
float gather(float x,float e){
  float a=abs(x);
  return sign(x)*max(0.,min(a,2.*(a-e)));
}
vec3 crumple(vec2 uv){
  // (a hair over the screen, so no edge pixel can be left uncovered)
  vec3 p=vec3((uv-.5)*uPage*1.004,0.);
  // The first buckles: straight ridges. Vertices are gathered onto each
  // ridge's crest and its two feet, within the plane of the sheet.
  vec2 grad=vec2(0.);
  for(int j=0;j<${RIDGES};j++){
    vec4 r=uRidge[j];
    vec3 a=uRidgeA[j];
    float d=dot(p.xy-r.xy,r.zw);
    float d1=gather(d,a.z);
    float d2=sign(d1)*(a.y+gather(abs(d1)-a.y,a.z));
    p.xy+=r.zw*(d2-d);
    if(abs(d2)<a.y){
      p.z+=a.x*(a.y-abs(d2));
      grad-=a.x*sign(d2)*r.zw;
    }
  }
  // N is the normal of the facet this vertex is on. It is carried through
  // the folds so that a vertex can be slid to a crease WITHIN its own facet,
  // which keeps every facet a true plane.
  vec3 N=normalize(vec3(-grad,1.));
  for(int s=0;s<2;s++){
    for(int k=0;k<${FOLDS};k++){
      vec4 f=uFold[k];
      float o=dot(p,f.xyz)-f.w;
      float cn=dot(f.xyz,N);
      float g=gather(o,uEps);
      p+=(f.xyz-cn*N)*((g-o)/max(1.-cn*cn,.04));
      if(g>0.){
        // outside the plane: mirrored back through it
        p-=2.*g*f.xyz;
        N-=2.*cn*f.xyz;
      }
    }
  }
  return p;
}`;

/* ───────── The room ───────── */

export type Pic = {
  shape: "port" | "land";
  art: Mesh;
  material: MeshStandardMaterial;
  glow: { value: number };
  /** The frame, mat and glass. */
  body: Group;
  /** The nail it hangs from, how far below it the centre is, and its size. */
  nail: Vector3;
  hang: number;
  w: number;
  h: number;
  seed: number;
  /** Home pose of the picture itself (written every frame by update). */
  home: Vector3;
  homeQ: Quaternion;
};

export type StudioImages = {
  brick: [HTMLImageElement, HTMLImageElement, HTMLImageElement];
  floor: [HTMLImageElement, HTMLImageElement, HTMLImageElement];
};

type Room = {
  aspect: number;
  fov: number;
  floorY: number;
  /** Half-width of wall that can be seen, and how high it goes. */
  halfW: number;
  top: number;
  lamp: Vector3;
  bin: Vector3;
  hit: Vector3;
  pics: [x: number, y: number, shape: "port" | "land", scale: number][];
};

function roomFor(aspect: number, fov: number, tunnelH: number, small: boolean): Room {
  const floorY = -tunnelH / 2;
  const dist = -WALL_Z;
  const halfH = dist * Math.tan((fov * Math.PI) / 360);
  const halfW = halfH * aspect;
  if (aspect < 0.8) {
    // Portrait: a tall, narrow hang.
    const pics: Room["pics"] = [];
    const rows: [number, [number, "port" | "land"][]][] = [
      [5.75, [[-1.6, "port"], [1.58, "port"]]],
      [4.05, [[-1.6, "port"], [-0.02, "port"], [1.58, "port"]]],
      [2.4, [[-0.8, "land"], [1.3, "port"]]],
      [0.75, [[-1.25, "port"], [0.75, "land"]]],
      [-0.95, [[-1.6, "port"], [-0.02, "port"], [1.58, "port"]]],
      [-2.45, [[-0.9, "land"]]],
    ];
    rows.forEach(([y, items], r) =>
      items.forEach(([x, shape], k) => pics.push([x * (halfW / 3.1), y, shape, 0.93 + 0.1 * rnd(r * 7 + k)]))
    );
    return {
      aspect,
      fov,
      floorY,
      halfW: halfW + 0.6,
      top: Math.max(halfH + 0.8, 7.6),
      lamp: new Vector3(0.1, Math.min(halfH - 1.3, 6.75), WALL_Z),
      bin: new Vector3(halfW * 0.5, floorY, WALL_Z + 0.8),
      hit: new Vector3(halfW * 0.38, floorY + 2.1, WALL_Z),
      pics,
    };
  }
  // Landscape: three loose rows, a gap where the ball strikes, the lamp above.
  const s = Math.min(1, halfW / 7.2);
  const pics: Room["pics"] = [];
  const rows: [number, [number, "port" | "land"][]][] = [
    [2.52, [[-5.65, "land"], [-3.95, "port"], [-2.3, "land"], [1.55, "land"], [3.3, "port"], [5.0, "land"]]],
    [0.86, [[-6.05, "port"], [-4.4, "land"], [-2.72, "port"], [-1.05, "land"], [0.62, "port"], [2.25, "land"], [5.75, "port"]]],
    [-0.82, [[-5.45, "land"], [-3.75, "port"], [-2.1, "land"], [-0.45, "port"], [1.2, "land"]]],
  ];
  rows.forEach(([y, items], r) =>
    items.forEach(([x, shape], k) => {
      if (Math.abs(x * s) > halfW - 0.5 && !small) return;
      pics.push([x * s, y + (rnd(r * 11 + k) - 0.5) * 0.1, shape, 0.94 + 0.1 * rnd(r * 5 + k * 3)]);
    })
  );
  return {
    aspect,
    fov,
    floorY,
    halfW: halfW + 0.8,
    top: halfH + 0.7,
    lamp: new Vector3(-0.35 * s, Math.min(halfH - 1.4, 3.05), WALL_Z),
    bin: new Vector3(3.35 * s, floorY, WALL_Z + 0.85),
    hit: new Vector3(3.6 * s, -0.15, WALL_Z),
    pics,
  };
}

export function createStudio(opts: {
  renderer: WebGLRenderer;
  small: boolean;
  images: StudioImages;
  /** The Corridor's picture textures, by shape. */
  art: { port: Texture[]; land: Texture[] };
  fog: { value: Vector2 };
}) {
  const { renderer, small, images, art, fog } = opts;
  const group = new Group();
  const disposables: { dispose: () => void }[] = [];
  const keep = <D extends { dispose: () => void }>(d: D) => {
    disposables.push(d);
    return d;
  };

  const aniso = Math.min(small ? 4 : 8, renderer.capabilities.getMaxAnisotropy());
  const tex = (img: HTMLImageElement, color: boolean) => {
    const t = keep(new Texture(img));
    t.wrapS = t.wrapT = RepeatWrapping;
    t.colorSpace = color ? SRGBColorSpace : NoColorSpace;
    t.anisotropy = aniso;
    t.needsUpdate = true;
    renderer.initTexture(t);
    return t;
  };

  /* ── Uniforms shared by the shaders ── */
  const U = {
    pull: { value: 0 },
    hole: { value: new Vector3(0, 0, VANISH_Z) },
    jit: { value: new Vector3() },
    fold: { value: Array.from({ length: FOLDS }, () => new Vector4(0, 0, 1, 99)) },
    ridge: { value: Array.from({ length: RIDGES }, () => new Vector4(0, 0, 1, 0)) },
    ridgeA: { value: Array.from({ length: RIDGES }, () => new Vector3(0, 0, 0)) },
    lit: { value: 0 },
    core: { value: 0 },
    page: { value: new Vector2(1, 1) },
    ballR: { value: 0.2 },
    eps: { value: 0.005 },
    flat: { value: 1 },
    paper: { value: new Color("#dccdb0") },
  };

  /* ── Wall and floor: photographs, cut into bricks and planks ── */
  const CHUNK = /* glsl */ `
attribute vec3 aCell;
attribute vec4 aSeed;
uniform float uPull;
uniform float uTile;
uniform vec2 uOff;
uniform vec3 uHole;
uniform float uMaxD;
uniform vec3 uJit;
varying float vFade;
varying float vTint;
vec3 spin(vec3 p,vec3 ax,float a){float s=sin(a),c=cos(a);return p*c+cross(ax,p)*s+ax*dot(ax,p)*(1.-c);}
`;
  const chunkMaterial = (maps: [Texture, Texture, Texture], floor: boolean, tile: number, maxD: number, grade: Color) => {
    const mat = keep(
      new MeshStandardMaterial({
        map: maps[0],
        normalMap: maps[1],
        aoMap: maps[2],
        roughnessMap: maps[2],
        roughness: 1,
        metalness: 0,
        normalScale: new Vector2(floor ? 0.9 : 1.35, floor ? 0.9 : 1.35),
        aoMapIntensity: 1,
      })
    );
    return film(mat, floor ? "floor" : "wall", (sh) => {
      Object.assign(sh.uniforms, {
        uPull: U.pull,
        uHole: U.hole,
        uJit: U.jit,
        uTile: { value: tile },
        uOff: { value: floor ? new Vector2(0, 0.0566) : new Vector2(0, 0.0598) },
        uMaxD: { value: maxD },
        uGrade: { value: grade },
      });
      // Texture coordinates come from where the chunk sits in the wall (or the
      // floor), so the assembled surface is the photograph, seamless.
      const planar = floor
        ? "vec2 wuv=(aCell.zx+position.zx)/uTile+uOff; wuv+=position.y*(abs(normal.x)>.5?vec2(0.,1.):vec2(1.,0.))*step(abs(normal.y),.5)/uTile;"
        : "vec2 wuv=(aCell.xy+position.xy)/uTile+uOff; wuv+=position.z*(abs(normal.x)>.5?vec2(1.,0.):vec2(0.,1.))*step(abs(normal.z),.5)/uTile;";
      // When it goes: the centre of the wall first, then outward; the floor
      // after the wall, from the wall's foot toward the camera.
      const when = floor
        ? `float dC=length(aCell.xz-vec2(uHole.x,${WALL_Z.toFixed(2)}))/uMaxD; float t0=.34+dC*.34+aSeed.x*.05;`
        : "float dC=length(aCell.xy-uHole.xy)/uMaxD; float t0=dC*.6+aSeed.x*.07;";
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\n" + CHUNK)
        .replace(
          "#include <uv_vertex>",
          `#include <uv_vertex>
  ${planar}
  #ifdef USE_MAP
    vMapUv=wuv;
  #endif
  #ifdef USE_NORMALMAP
    vNormalMapUv=wuv;
  #endif
  #ifdef USE_AOMAP
    vAoMapUv=wuv;
  #endif
  #ifdef USE_ROUGHNESSMAP
    vRoughnessMapUv=wuv;
  #endif`
        )
        .replace(
          "#include <beginnormal_vertex>",
          `${when}
  float q=clamp((uPull-t0)/.3,0.,1.);
  vec3 ax=normalize(aSeed.yzw*2.-1.);
  float ang=q*q*(5.+aSeed.x*9.);
  vec3 objectNormal=spin(normal,ax,ang);`
        )
        .replace(
          "#include <begin_vertex>",
          `float q3=q*q*q;
  vec3 home=aCell+uJit*(aSeed.yzw-.5)*(1.-q);
  vec3 goal=vec3(uHole.xy+(aSeed.yz-.5)*1.4,uHole.z);
  vec3 c=mix(home,goal,q3);
  // it comes loose and hangs back a moment before it goes
  ${floor ? "c.y+=q*(1.-q)*.9;" : "c.z-=q*(1.-q)*1.1;"}
  vec3 transformed=c+spin(position,ax,ang)*(1.-.3*q3);
  vFade=1.-smoothstep(.4,1.,q3);
  vTint=aSeed.w;`
        );
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uGrade;\nvarying float vFade;\nvarying float vTint;")
        .replace("#include <map_fragment>", "#include <map_fragment>\ndiffuseColor.rgb*=uGrade*(.82+.36*vTint);")
        .replace(TONED, TONED + "\ngl_FragColor.rgb*=vFade;");
    });
  };

  const chunks = (cells: number[], seeds: number[], geo: BoxGeometry, mat: Material) => {
    const g = keep(new InstancedBufferGeometry());
    g.index = geo.index;
    g.setAttribute("position", geo.getAttribute("position"));
    g.setAttribute("normal", geo.getAttribute("normal"));
    g.setAttribute("uv", geo.getAttribute("uv"));
    g.setAttribute("aCell", new InstancedBufferAttribute(new Float32Array(cells), 3));
    g.setAttribute("aSeed", new InstancedBufferAttribute(new Float32Array(seeds), 4));
    g.instanceCount = cells.length / 3;
    const mesh = new Mesh(g, mat);
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    return mesh;
  };

  const brickMaps = images.brick.map((im, i) => tex(im, i === 0)) as [Texture, Texture, Texture];
  const floorMaps = images.floor.map((im, i) => tex(im, i === 0)) as [Texture, Texture, Texture];
  // Old oxblood: the photograph's red brick, pushed deeper and darker.
  const OXBLOOD = new Color(0.8, 0.42, 0.45);
  const BOARDS = new Color(0.8, 0.7, 0.66);

  let wall: Mesh | null = null;
  let floorMesh: Mesh | null = null;
  let room: Room | null = null;
  const pics: Pic[] = [];
  const picGroup = new Group();
  group.add(picGroup);

  /* ── Frames ── */
  const barGeo = keep(new BoxGeometry(1, 1, 1));
  const planeGeo = keep(new PlaneGeometry(1, 1));
  const frameBlack = film(keep(new MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.42, metalness: 0.1 })), "bar");
  const frameWood = film(keep(new MeshStandardMaterial({ color: 0x2b170f, roughness: 0.62, metalness: 0 })), "bar");
  const matBoard = film(keep(new MeshStandardMaterial({ color: 0xe9e1d2, roughness: 0.96, metalness: 0 })), "bar");
  // Glass: nothing but what it reflects, added on top.
  const glass = film(
    keep(
      new MeshStandardMaterial({
        color: 0x000000,
        roughness: 0.04,
        metalness: 0,
        transparent: true,
        opacity: 0.55,
        blending: CustomBlending,
        blendSrc: OneFactor,
        blendDst: OneFactor,
        blendSrcAlpha: ZeroFactor,
        blendDstAlpha: OneFactor,
        depthWrite: false,
        envMapIntensity: 1.6,
      })
    ),
    "glass"
  );

  const makePic = (x: number, y: number, shape: "port" | "land", scale: number, i: number): Pic => {
    const w = (shape === "port" ? 1.0 : 1.52) * scale;
    const h = shape === "port" ? w / 0.7 : w / 1.6;
    const bar = 0.045 + 0.02 * rnd(i * 3.3);
    const margin = 0.07 + 0.05 * rnd(i * 5.1);
    const depth = 0.07;
    const glow = { value: 0 };
    const pool = art[shape];
    const material = film(
      keep(new MeshStandardMaterial({ map: pool[i % pool.length], roughness: 0.8, metalness: 0 })),
      "art",
      (sh) => {
        sh.uniforms.uGlow = glow;
        sh.uniforms.uFogR = fog;
        // On the wall it is a print under a lamp. In the tunnel it is a panel
        // that shows its picture as it is. uGlow takes it from one to the
        // other, landing on exactly what the tunnel's own panel draws.
        sh.fragmentShader = sh.fragmentShader
          .replace("#include <common>", "#include <common>\nuniform float uGlow;\nuniform vec2 uFogR;")
          .replace(
            "#include <colorspace_fragment>",
            `#include <colorspace_fragment>
  #ifdef USE_MAP
  {
    vec3 raw=texture2D(map,vMapUv).rgb;
    float ff=smoothstep(uFogR.x,uFogR.y,vViewPosition.z);
    gl_FragColor.rgb=mix(gl_FragColor.rgb,linearToOutputTexel(vec4(raw,1.)).rgb*(1.-ff),uGlow);
  }
  #endif`
          );
      }
    );
    const artMesh = new Mesh(planeGeo, material);
    artMesh.scale.set(w, h, 1);
    artMesh.receiveShadow = true;
    picGroup.add(artMesh);

    const body = new Group();
    const W = w + 2 * margin;
    const H = h + 2 * margin;
    const barMat = i % 3 === 1 ? frameWood : frameBlack;
    const bars: [number, number, number, number][] = [
      [0, H / 2 + bar / 2, W + 2 * bar, bar],
      [0, -H / 2 - bar / 2, W + 2 * bar, bar],
      [-W / 2 - bar / 2, 0, bar, H],
      [W / 2 + bar / 2, 0, bar, H],
    ];
    for (const [bx, by, bw, bh] of bars) {
      const m = new Mesh(barGeo, barMat);
      m.position.set(bx, by, depth / 2);
      m.scale.set(bw, bh, depth);
      m.castShadow = true;
      m.receiveShadow = true;
      body.add(m);
    }
    const board = new Mesh(planeGeo, matBoard);
    board.scale.set(W, H, 1);
    board.position.z = 0.022;
    board.receiveShadow = true;
    body.add(board);
    const pane = new Mesh(planeGeo, glass);
    pane.scale.set(W, H, 1);
    pane.position.z = depth * 0.8;
    pane.renderOrder = 3;
    body.add(pane);
    picGroup.add(body);

    return {
      shape,
      art: artMesh,
      material,
      glow,
      body,
      nail: new Vector3(x, y + H / 2 + bar, WALL_Z),
      hang: H / 2 + bar,
      w,
      h,
      seed: rnd(i * 9.7 + 2),
      home: new Vector3(),
      homeQ: new Quaternion(),
    };
  };

  /* ── The lamp: a swing-arm task lamp bolted to the wall ── */
  const enamel = film(keep(new MeshStandardMaterial({ color: 0x1a0507, roughness: 0.34, metalness: 0.55 })), "bar");
  const steel = film(keep(new MeshStandardMaterial({ color: 0x8d8f94, roughness: 0.3, metalness: 1 })), "bar");
  const hot = film(
    keep(new MeshStandardMaterial({ color: 0x000000, emissive: 0xffb36b, emissiveIntensity: 9, side: DoubleSide })),
    "bar"
  );
  const lamp = new Group();
  const lampHead = new Group();
  const spot = new SpotLight(0xffb070, 0, 26, 1.0, 0.75, 1.7);
  const bulbGlow = new PointLight(0xffa860, 0, 5, 2);
  const fill = new PointLight(0xffe2c8, 0, 6, 2);
  {
    const rod = (a: Vector3, b: Vector3, r: number, mat: Material) => {
      const len = a.distanceTo(b);
      const m = new Mesh(keep(new CylinderGeometry(r, r, len, 10)), mat);
      m.position.copy(a).add(b).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize());
      m.castShadow = true;
      return m;
    };
    const ball = (p: Vector3, r: number, mat: Material) => {
      const m = new Mesh(keep(new SphereGeometry(r, 14, 10)), mat);
      m.position.copy(p);
      return m;
    };
    const plate = new Mesh(keep(new CylinderGeometry(0.13, 0.13, 0.05, 20)), enamel);
    plate.rotation.x = Math.PI / 2;
    plate.position.z = 0.025;
    const j0 = new Vector3(0, 0, 0.06);
    const j1 = new Vector3(0.06, 0.42, 0.95);
    const j2 = new Vector3(0.12, 0.22, 1.72);
    lamp.add(plate, rod(j0, j1, 0.018, steel), rod(j1, j2, 0.018, steel), ball(j1, 0.04, enamel), ball(j0, 0.04, enamel));
    // The shade: a spun cone, enamel outside, glowing inside.
    const profile = [
      new Vector2(0.045, 0),
      new Vector2(0.06, -0.06),
      new Vector2(0.2, -0.3),
      new Vector2(0.215, -0.31),
    ];
    const shade = new Mesh(keep(new LatheGeometry(profile, 28)), enamel);
    shade.castShadow = true;
    const inner = new Mesh(keep(new LatheGeometry(profile.map((p) => new Vector2(p.x * 0.96, p.y * 0.985 - 0.004)), 28)), hot);
    const cap = new Mesh(keep(new CylinderGeometry(0.045, 0.045, 0.05, 14)), steel);
    cap.position.y = 0.02;
    const bulb = new Mesh(keep(new SphereGeometry(0.055, 14, 10)), hot);
    bulb.position.y = -0.17;
    lampHead.add(shade, inner, cap, bulb);
    lampHead.position.copy(j2);
    lamp.add(lampHead);
    spot.castShadow = true;
    spot.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
    spot.shadow.bias = -0.0006;
    spot.shadow.normalBias = 0.02;
    spot.shadow.radius = small ? 3 : 5;
    spot.shadow.camera.near = 0.3;
    spot.shadow.camera.far = 20;
    lampHead.add(spot, spot.target, bulbGlow);
    spot.position.set(0, -0.18, 0);
    bulbGlow.position.set(0, -0.24, 0);
    group.add(lamp, fill);
  }

  /* ── The bin: brushed steel ── */
  const bin = new Group();
  const binR = 0.42;
  const binH = 0.95;
  {
    const brush = keep(brushed());
    const metal = film(
      keep(
        new MeshStandardMaterial({
          color: 0xb4b7bd,
          roughness: 0.4,
          metalness: 1,
          roughnessMap: brush,
          bumpMap: brush,
          bumpScale: 0.6,
          envMapIntensity: 4.5,
          side: DoubleSide,
        })
      ),
      "bin"
    );
    const profile = [
      new Vector2(0, 0.02),
      new Vector2(0.33, 0.02),
      new Vector2(0.34, 0),
      new Vector2(0.345, 0.04),
      new Vector2(binR, binH),
    ];
    const shell = new Mesh(keep(new LatheGeometry(profile, 48)), metal);
    shell.castShadow = true;
    shell.receiveShadow = true;
    const rim = new Mesh(keep(new TorusGeometry(binR, 0.014, 8, 48)), steel);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = binH;
    rim.castShadow = true;
    bin.add(shell, rim);
    group.add(bin);
  }

  /* ── The paper ── */
  // A fine grid, so a crease is never more than a hair wide.
  const GRID = small ? [210, 420] : [400, 250];
  const sheetGeo = keep(new PlaneGeometry(1, 1, GRID[0], GRID[1]));
  const paperTooth = keep(paperNormal());
  // The cage: planes pointing every way, each with its own final distance
  // (so the ball is irregular), none lying in the plane of the sheet (that
  // would fold the paper flat onto itself).
  const cage = (() => {
    const out: { n: Vector3; d: number; a: number; b: number }[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let k = 0; k < FOLDS; k++) {
      const y = 1 - (2 * (k + 0.5)) / FOLDS;
      const r = Math.sqrt(1 - y * y);
      const th = k * golden + rnd(k * 3.3) * 0.9;
      const n = new Vector3(
        Math.cos(th) * r + (rnd(k * 5.1 + 1) - 0.5) * 0.35,
        Math.sin(th) * r + (rnd(k * 7.7 + 2) - 0.5) * 0.35,
        y + (rnd(k * 9.3 + 3) - 0.5) * 0.35
      );
      if (Math.abs(n.z) < 0.3) n.z = (n.z < 0 ? -1 : 1) * (0.3 + 0.25 * rnd(k * 2.9 + 5));
      n.normalize();
      out.push({ n, d: 0.7 + 0.3 * rnd(k * 4.1 + 7), a: 0.26 * rnd(k * 6.3 + 9), b: 0.74 + 0.26 * rnd(k * 8.7 + 11) });
    }
    // not in any spatial order
    return out.map((p, i) => ({ p, key: rnd(i * 12.7 + 4) })).sort((x, y) => x.key - y.key).map((x) => x.p);
  })();
  // The first buckles: straight ridges across the sheet, up and down by turns.
  const ridges = Array.from({ length: RIDGES }, (_, j) => ({
    x: rnd(j * 3.7 + 20) - 0.5,
    y: rnd(j * 5.3 + 21) - 0.5,
    ang: rnd(j * 7.9 + 22) * Math.PI,
    amp: (j % 2 ? -1 : 1) * (0.5 + 0.5 * rnd(j * 2.3 + 23)),
    width: 0.1 + 0.16 * rnd(j * 9.1 + 24),
    at: 0.02 + 0.2 * rnd(j * 4.9 + 25),
  }));
  const sheetMat = film(
    keep(
      new MeshStandardMaterial({
        // a stand-in until the page is painted, so the program is built with
        // a map from the start and swapping the picture in costs nothing
        map: keep(new CanvasTexture(canvasOf(2, 2))),
        roughness: 0.96,
        metalness: 0,
        side: DoubleSide,
        // every facet is one flat plane and catches the light on its own
        flatShading: true,
        normalMap: paperTooth,
        normalScale: new Vector2(0.14, 0.14),
        envMapIntensity: 0.6,
      })
    ),
    "paper",
    (sh) => {
      Object.assign(sh.uniforms, {
        uPage: U.page,
        uR: U.ballR,
        uEps: U.eps,
        uFold: U.fold,
        uRidge: U.ridge,
        uRidgeA: U.ridgeA,
        uFlat: U.flat,
        uPaperC: U.paper,
        uLit: U.lit,
        uCore: U.core,
      });
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\n" + PAPER_VERT)
        .replace("#include <begin_vertex>", "vec3 transformed=crumple(uv);\nvCore=length(transformed)/uR;")
        // (the sheet is a hair over the screen; the picture still maps one texel to one pixel)
        .replace("#include <uv_vertex>", "#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv=(uv-.5)*1.004+.5;\n#endif");
      sh.fragmentShader = sh.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform float uFlat;\nuniform vec3 uPaperC;\nuniform float uLit;\nuniform float uCore;\nvarying float vCore;"
        )
        // the back of the sheet is blank paper
        .replace("#include <map_fragment>", "#include <map_fragment>\nif(!gl_FrontFacing) diffuseColor.rgb=uPaperC*.96;")
        // The paper's own key light: high, to the left, in front. Facets that
        // face it are bright, facets that turn away fall off quickly, and a
        // facet lit from behind lets a little of it through, as thin paper does.
        .replace(
          "#include <lights_fragment_end>",
          `#include <lights_fragment_end>
  {
    float nk=dot(normal,normalize(vec3(-.52,.62,.59)));
    vec3 key=vec3(1.,.93,.84)*uLit;
    reflectedLight.directDiffuse+=diffuseColor.rgb*RECIPROCAL_PI*key*(max(nk,0.)+.2*max(-nk,0.));
  }`
        )
        // Deep inside the wad little light gets in.
        .replace(
          "#include <opaque_fragment>",
          "outgoingLight*=mix(1.,.3+.7*smoothstep(.2,.95,vCore),uCore);\n#include <opaque_fragment>"
        )
        // At rest it is the page exactly as the browser drew it; the light
        // takes over as it starts to fold.
        .replace(
          "#include <colorspace_fragment>",
          `#include <colorspace_fragment>
  #ifdef USE_MAP
    gl_FragColor.rgb=mix(gl_FragColor.rgb,linearToOutputTexel(vec4(texture2D(map,vMapUv).rgb,1.)).rgb,uFlat);
  #endif`
        );
    },
    paperExposure
  );
  const sheet = new Mesh(sheetGeo, sheetMat);
  // The inside of the wad. A crumpled ball is paper all the way through, so
  // wherever a gap between the outer folds lets you see in, there is more
  // paper there, in shadow: a small faceted lump of it, riding inside.
  const core = new Mesh(
    keep(new IcosahedronGeometry(1, 1)),
    film(keep(new MeshStandardMaterial({ color: 0x6f6654, roughness: 1, metalness: 0, flatShading: true })), "core", undefined, paperExposure)
  );
  core.visible = false;
  sheet.add(core);
  sheet.frustumCulled = false;
  sheet.visible = false;
  group.add(sheet);
  // The ball's shadow is cast by a plain sphere that follows it.
  const shadowBall = new Mesh(
    keep(new SphereGeometry(1, 14, 10)),
    keep(new MeshBasicMaterial({ colorWrite: false, depthWrite: false }))
  );
  shadowBall.castShadow = true;
  shadowBall.visible = false;
  group.add(shadowBall);

  /* ── Dust in the lamp light ── */
  const DUST = small ? 110 : 260;
  const dustU = { uTime: { value: 0 }, uAmount: { value: 0 }, uLamp: { value: new Vector3() }, uSize: { value: 1 } };
  const dust = new Points(
    (() => {
      const g = keep(new BufferGeometry());
      const p: number[] = [];
      for (let i = 0; i < DUST; i++) p.push(rnd(i * 3.1), rnd(i * 5.7 + 1), rnd(i * 7.3 + 2));
      g.setAttribute("position", new Float32BufferAttribute(p, 3));
      return g;
    })(),
    keep(
      new ShaderMaterial({
        uniforms: dustU,
        transparent: true,
        depthWrite: false,
        blending: CustomBlending,
        blendSrc: OneFactor,
        blendDst: OneFactor,
        blendSrcAlpha: ZeroFactor,
        blendDstAlpha: OneFactor,
        vertexShader: /* glsl */ `
uniform float uTime;uniform float uAmount;uniform vec3 uLamp;uniform float uSize;
varying float vA;
void main(){
  // a cone of air under the lamp, each mote falling and wandering
  vec3 s=position;
  float fall=fract(s.y-uTime*(.012+.02*s.z));
  float spread=.25+fall*1.5;
  vec3 p=uLamp+vec3((s.x-.5)*2.*spread+sin(uTime*.3+s.z*40.)*.06,-fall*3.6,(s.z-.5)*1.4*spread+cos(uTime*.23+s.x*40.)*.06);
  vec4 mv=modelViewMatrix*vec4(p,1.);
  gl_Position=projectionMatrix*mv;
  gl_PointSize=uSize*(1.2+2.2*s.z)/-mv.z;
  vA=uAmount*(1.-fall)*smoothstep(0.,.06,fall)*(.35+.65*s.x);
}`,
        fragmentShader: /* glsl */ `
varying float vA;
void main(){
  float d=length(gl_PointCoord-.5);
  float a=smoothstep(.5,.05,d)*vA;
  gl_FragColor=vec4(vec3(1.,.74,.48)*a*.5,1.);
  #include <colorspace_fragment>
}`,
      })
    )
  );
  dust.frustumCulled = false;
  group.add(dust);

  /* ── Layout: build the wall, the floor and the hang for this screen ── */
  const cam = { fov: 62, aspect: 1.6 };
  const layout = (aspect: number, fov: number, tunnelH: number) => {
    cam.fov = fov;
    cam.aspect = aspect;
    room = roomFor(aspect, fov, tunnelH, small);
    const R = room;
    if (wall) {
      group.remove(wall);
      (wall.material as Material).dispose();
    }
    if (floorMesh) {
      group.remove(floorMesh);
      (floorMesh.material as Material).dispose();
    }
    // Bricks. The photograph holds 14 courses and about 5 bricks a tile.
    const tile = small ? 2.15 : 1.78;
    const bw = tile / 5;
    const bh = tile / 14;
    const bd = 0.13;
    const cells: number[] = [];
    const seeds: number[] = [];
    const y0 = Math.floor(R.floorY / bh) * bh;
    let n = 0;
    for (let row = 0, y = y0; y < R.top; row++, y += bh) {
      const shift = row % 2 ? bw / 2 : 0;
      for (let x = -R.halfW - bw; x < R.halfW + bw; x += bw) {
        cells.push(x + shift + bw / 2, y + bh / 2, WALL_Z - bd / 2);
        seeds.push(rnd(n * 1.31), rnd(n * 2.17 + 4), rnd(n * 3.71 + 9), rnd(n * 0.77 + 1));
        n++;
      }
    }
    const maxD = Math.hypot(R.halfW, Math.max(R.top, -R.floorY));
    wall = chunks(cells, seeds, keep(new BoxGeometry(bw, bh, bd)), chunkMaterial(brickMaps, false, tile, maxD, OXBLOOD));
    group.add(wall);
    // Boards, running from the wall toward the camera.
    const ftile = small ? 2.6 : 2.2;
    const pw = ftile / 9;
    const fc: number[] = [];
    const fs: number[] = [];
    const zNear = 3.2;
    for (let col = 0, x = -R.halfW - pw; x < R.halfW + pw; col++, x += pw) {
      const stagger = rnd(col * 4.3) * ftile;
      for (let z = WALL_Z - stagger; z < zNear; z += ftile) {
        fc.push(x + pw / 2, R.floorY - 0.03, z + ftile / 2);
        fs.push(rnd(n * 1.31), rnd(n * 2.17 + 4), rnd(n * 3.71 + 9), rnd(n * 0.77 + 1));
        n++;
      }
    }
    floorMesh = chunks(
      fc,
      fs,
      keep(new BoxGeometry(pw, 0.06, ftile)),
      chunkMaterial(floorMaps, true, ftile, Math.hypot(R.halfW, zNear - WALL_Z), BOARDS)
    );
    group.add(floorMesh);

    // The hang.
    pics.forEach((p) => {
      picGroup.remove(p.art, p.body);
      p.material.dispose();
    });
    pics.length = 0;
    R.pics.forEach(([x, y, shape, scale], i) => pics.push(makePic(x, y, shape, scale, i)));

    lamp.position.copy(R.lamp);
    // The head looks down and back at the middle of the wall.
    const aim = new Vector3(R.lamp.x + 0.25, R.lamp.y - (aspect < 0.8 ? 5.4 : 3.3), WALL_Z + 0.25);
    const headWorld = lampHead.position.clone().multiplyScalar(LAMP_SCALE).add(R.lamp);
    lampHead.quaternion.setFromUnitVectors(new Vector3(0, -1, 0), aim.clone().sub(headWorld).normalize());
    spot.target.position.set(0, -6, 0);
    spot.angle = aspect < 0.8 ? 1.02 : 1.08;
    bin.position.copy(R.bin);
    fill.position.set(aspect < 0.8 ? -0.9 : -1.7, 1.3, CAM_START + 0.9);
    dustU.uLamp.value.copy(headWorld).add(new Vector3(0, -0.2, 0));

    U.ballR.value = aspect < 0.8 ? 0.25 : 0.24;
  };

  /* ── The throw ── */
  const start = new Vector3(0, 0, CAM_START - PAGE_DIST);
  const tmp = new Vector3();
  const arc = (a: Vector3, b: Vector3, lift: number, u: number, out: Vector3) =>
    out.lerpVectors(a, b, u).setY(a.y + (b.y - a.y) * u + lift * 4 * u * (1 - u));
  const P = { wall: new Vector3(), rim: new Vector3(), inside: new Vector3(), rest: new Vector3(), wind: new Vector3() };
  /** Where the ball is, `t` (0 to 1) of the way through the throw. */
  const tossAt = (t: number, out: Vector3) => {
    const R = room!;
    const r = U.ballR.value;
    P.wind.set(start.x - 0.12, start.y - 0.1, start.z + 0.32);
    P.wall.set(R.hit.x, R.hit.y, WALL_Z + r * 0.9);
    P.rim.set(R.bin.x - binR * 0.86, R.floorY + binH + r * 0.7, R.bin.z + binR * 0.3);
    P.inside.set(R.bin.x + 0.05, R.floorY + binH * 0.62, R.bin.z);
    P.rest.set(R.bin.x + 0.04, R.floorY + r * 0.9 + 0.05, R.bin.z - 0.03);
    if (t < 0.1) {
      // the wind-up: drawn back before it is let go
      const u = t / 0.1;
      return out.lerpVectors(start, P.wind, u * u * (3 - 2 * u));
    }
    if (t < 0.5) return arc(P.wind, P.wall, 1.15, (t - 0.1) / 0.4, out);
    if (t < 0.76) return arc(P.wall, P.rim, 0.22, (t - 0.5) / 0.26, out);
    if (t < 0.9) return arc(P.rim, P.inside, 0.13, (t - 0.76) / 0.14, out);
    const u = (t - 0.9) / 0.1;
    return out.lerpVectors(P.inside, P.rest, u * (2 - u));
  };

  let toss = 0; // the throw's own clock, 0 to 1
  let thrown = false;
  const spinAxis = new Vector3(0.6, 0.3, -0.74).normalize();
  const turnAxis = new Vector3(0.35, 0.9, 0.2).normalize();
  const q0 = new Quaternion();
  const q1 = new Quaternion();
  const vanish = new Vector3(0, 0, VANISH_Z);
  const shake = { lamp: 0, flick: 1 };
  let seedTick = 0;

  /**
   * Put the whole room at `v`. `dt` advances the throw; `stir` (0 to 1) is
   * how hard the page is being scrolled, which is all the shake listens to.
   */
  const update = (v: number, time: number, dt: number, stir: number, aspect: number) => {
    const R = room!;
    /* The page hangs PAGE_DIST in front of the camera's first position and
       exactly fills the view, whatever shape the window is right now. (A hair
       over, so no edge pixel can be left uncovered.) */
    const ph = 2 * PAGE_DIST * Math.tan((cam.fov * Math.PI) / 360);
    const pw = ph * aspect;
    U.page.value.set(pw, ph);

    /* crumple: close the cage */
    const c = ramp(T.crumple[0], T.crumple[1], v);
    const ballR = U.ballR.value;
    const reach = 0.5 * Math.hypot(pw, ph);
    U.eps.value = 0.55 * Math.hypot(pw / GRID[0], ph / GRID[1]);
    cage.forEach((pl, k) => {
      // where this plane starts: just clear of the flat sheet
      const far = 2.2 * U.eps.value + 1.01 * Math.max((Math.abs(pl.n.x) * pw + Math.abs(pl.n.y) * ph) / 2, reach * 0.5);
      const e = smooth(pl.a, pl.b, c);
      U.fold.value[k].set(pl.n.x, pl.n.y, pl.n.z, far + (pl.d * ballR - far) * e);
    });
    ridges.forEach((rg, j) => {
      U.ridge.value[j].set(rg.x * pw, rg.y * ph, Math.cos(rg.ang), Math.sin(rg.ang));
      const w = rg.width * ph;
      // they come up one after another, then are lost in the folding
      const amp = rg.amp * 0.32 * smooth(rg.at, rg.at + 0.22, c);
      // (no gathering while the ridge is not there: the flat page stays exact)
      U.ridgeA.value[j].set(amp, w, U.eps.value * Math.min(1, Math.abs(amp) * 60));
    });
    U.flat.value = 1 - smooth(0.03, 0.13, c);
    U.core.value = smooth(0.35, 0.95, c);

    /* the room: dark, and not drawn, until the page is a ball */
    const reveal = smooth(T.reveal[0], T.reveal[1], v);
    exposure.value = reveal;
    const shown = reveal > 0;
    if (wall) wall.visible = shown;
    if (floorMesh) floorMesh.visible = shown;
    picGroup.visible = lamp.visible = bin.visible = shown;
    // the paper's key light gives way to the lamp once it is thrown
    U.lit.value = 3.4 * (1 - 0.72 * smooth(0, 0.3, toss));

    /* the throw: it plays in real time once it is let go, either way */
    if (!thrown && v > T.toss) thrown = true;
    else if (thrown && v < T.toss - 0.025) thrown = false;
    const goal = thrown ? 1 : 0;
    // far ahead of it (a fast scroll)? hurry up
    const hurry = v > T.pull[0] || v < T.crumple[1] - 0.03 ? 5 : 1;
    const step = (dt / 1.55) * hurry;
    toss = goal > toss ? Math.min(goal, toss + step) : Math.max(goal, toss - step);

    tossAt(toss, sheet.position);
    const turns = toss < 0.5 ? toss * 7 : 3.5 + (toss - 0.5) * 3.2;
    sheet.quaternion.setFromAxisAngle(spinAxis, toss <= 0 ? 0 : turns * (1 - 0.6 * smooth(0.9, 1, toss)));
    // as it closes, the wad turns a little in the hand
    sheet.quaternion.multiply(q1.setFromAxisAngle(turnAxis, 0.85 * smooth(0.45, 1, c)));
    const propsQ = smooth(T.props[0], T.props[1], v);
    sheet.visible = propsQ < 0.03 && v < 0.999;
    shadowBall.visible = sheet.visible && shown;
    shadowBall.position.copy(sheet.position);
    shadowBall.scale.setScalar(U.ballR.value * 0.95);
    core.visible = c > 0.8;
    core.scale.setScalar(U.ballR.value * 0.62 * smooth(0.8, 1, c));

    /* shake */
    const env = smooth(T.shake[0], T.shake[1], v) * (1 - smooth(T.shake[2], T.shake[3], v));
    const amp = env * stir;
    if (amp > 0) {
      seedTick++;
      U.jit.value.set(rnd(seedTick) - 0.5, rnd(seedTick + 0.5) - 0.5, rnd(seedTick + 0.25) - 0.5).multiplyScalar(0.012 * amp);
      shake.flick = 1 - amp * (0.12 + 0.5 * Math.pow(rnd(seedTick * 0.31), 6));
    } else {
      U.jit.value.set(0, 0, 0);
      shake.flick = 1;
    }
    shake.lamp = amp * (Math.sin(time * 6.3) * 0.045 + Math.sin(time * 14.7) * 0.012);

    /* lamp: light, swing, and being pulled in */
    const pool = 1 - smooth(T.dark[0], T.dark[1], v);
    spot.intensity = 150 * shake.flick * pool;
    bulbGlow.intensity = 1.6 * shake.flick * pool;
    fill.intensity = 15 * (1 - smooth(T.pull[0], T.pull[1], v));
    hot.emissiveIntensity = 9 * shake.flick * pool + 0.02;
    const lq = propsQ * propsQ * propsQ;
    lamp.position.lerpVectors(R.lamp, vanish, lq);
    lamp.rotation.set(lq * 1.4, lq * 0.8, shake.lamp + lq * 1.1);
    lamp.scale.setScalar(LAMP_SCALE * (1 - 0.6 * lq));

    /* bin: rattled once by the ball, then pulled in */
    const rattle = toss > 0.76 && toss < 1 ? Math.exp(-(toss - 0.76) * 26) * Math.sin((toss - 0.76) * 120) * 0.07 : 0;
    const bq = smooth(T.props[0] + 0.05, T.props[1] + 0.03, v);
    const bq3 = bq * bq * bq;
    bin.position.lerpVectors(R.bin, vanish, bq3);
    bin.position.y += bq * (1 - bq) * 1.4;
    bin.rotation.set(bq * bq * 5, bq * 2, rattle + amp * Math.sin(time * 31) * 0.006 + bq * bq * 3);

    /* pictures: rattle on their nails; frames leave; the art waits to glide */
    U.pull.value = ramp(T.pull[0], T.pull[1], v);
    for (const p of pics) {
      const swing = amp * Math.sin(time * (17 + p.seed * 9) + p.seed * 40) * 0.016;
      q0.setFromAxisAngle(tmp.set(0, 0, 1), swing);
      // the picture's centre sits `hang` below the nail
      tmp.set(0, -p.hang, 0).applyQuaternion(q0);
      p.home.set(p.nail.x + tmp.x, p.nail.y + tmp.y, WALL_Z + 0.045);
      p.homeQ.copy(q0);
      const fq = smooth(T.release + p.seed * 0.06, T.release + p.seed * 0.06 + 0.13, v);
      const f3 = fq * fq;
      p.body.position.set(p.nail.x + tmp.x, p.nail.y + tmp.y, WALL_Z).lerp(vanish, f3);
      p.body.position.z += fq * (1 - fq) * 1.6;
      q1.setFromAxisAngle(tmp.set(p.seed - 0.5, 0.7, 0.4).normalize(), fq * fq * (4 + p.seed * 6));
      p.body.quaternion.copy(q0).multiply(q1);
      p.body.visible = fq < 0.995;
    }

    dustU.uTime.value = time;
    dustU.uAmount.value = (0.25 + 0.75 * env) * reveal * pool;
    dustU.uSize.value = renderer.getDrawingBufferSize(new Vector2()).y * 0.012;

    wall!.visible = floorMesh!.visible = shown && U.pull.value < 1;
    dust.visible = shown && dustU.uAmount.value > 0.002;
    glass.opacity = 0.55 * pool;
  };

  return {
    group,
    pics,
    layout,
    update,
    exposure,
    /** The page's picture, when it has been (re)painted. */
    setPage(texture: Texture) {
      sheetMat.map = texture;
    },
    /** Camera position along z, and a slight look toward the bin during the throw. */
    camera(v: number) {
      const k = smooth(T.camera[0], T.camera[1], v);
      const look = smooth(0.3, 0.42, v) * (1 - smooth(0.46, 0.58, v));
      return { z: CAM_START * (1 - k), yaw: room ? -Math.atan2(room.bin.x, -WALL_Z) * 0.16 * look : 0 };
    },
    /** Distance to keep sharp, and how much depth of field there is (0 = none). */
    focus(v: number, camZ: number) {
      const ball = Math.max(0.6, camZ - sheet.position.z);
      const wallD = camZ - WALL_Z;
      const d = toss >= 1 ? wallD : ball + (wallD - ball) * smooth(0.5, 1, toss) * 0.999;
      return { distance: d, amount: smooth(T.reveal[0], T.reveal[1], v) * (1 - smooth(T.dof[0], T.dof[1], v)) };
    },
    /** How far picture `i` is along its glide to the tunnel. */
    glide(v: number, p: Pic) {
      const a = T.glide + p.seed * 0.07;
      const t = ramp(a, a + 0.17, v);
      return t * t * t * (t * (t * 6 - 15) + 10);
    },
    throwDone: () => toss >= 1,
    dispose() {
      pics.forEach((p) => p.material.dispose());
      if (wall) (wall.material as Material).dispose();
      if (floorMesh) (floorMesh.material as Material).dispose();
      disposables.forEach((d) => d.dispose());
    },
  };
}

export type Studio = ReturnType<typeof createStudio>;
