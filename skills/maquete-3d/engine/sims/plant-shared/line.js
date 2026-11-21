// The toy car plant's line: the robot arm, the car body that builds up and takes its paint, the
// skid and the roller conveyor, the stamping press, the glass paint booth and the QA rolling road, in exactly the toy
// airport kit's look (airport-shared/gse.js, airside.js, style.js), which matches the reference video
//: toy proportions, generous bevels on every edge, matte paint with a soft
// clearcoat, crisp dark tyres with light hubs, dark glass, printed numbers, blue + white on lavender. Yellow only on
// the safety parts. Robots are white with blue joints and a blue base.
//
// Toy metres, y up, flow and noses toward +x, origin on the ground at the object's centre.
//
//   buildToyRobot({tool = 'weld' | 'grip' | 'paint' | 'wheel', number = '01'})
//       -> {group, setJoints([j1..j6]), joints, reach(worldPoint, {down = true, dir, up, roll}) -> bool, tip,
//           setSpark(k, t?), setSpray(k, color?), setGrip(k), held, toolLength, limits, dims}
//       At joints 0 the arm faces local +x, lower arm straight up, forearm level: about 4.1 m tall, base 1.4 m
//       across, shoulder at 1.6 m, 4.2 m from the base axis to the wrist at full stretch. `tip` is an Object3D at the
//       tool tip, its local +x is the approach direction. reach() poses the arm (analytic IK, elbow up, the wrist
//       bent down) so the tip meets the point along `dir` (default: straight down; down = false: horizontal, away
//       from the base); it is stateless (same point, same pose) and returns false when the point is out of reach or
//       a joint limit clamps (the arm is then posed as close as it gets). `up` (world) turns the tool about its axis
//       (default: the tool's back faces the robot), `roll` adds to j6.
//       weld: setSpark(k, t) a spark burst at the tip, t flickers it. paint: setSpray(k, color) a mist cone 0.7 m
//       long out of the bell (hold the tip ~0.6 m off the panel; it is coloured, mid blue by default, because a
//       white mist vanishes on this light world).
//       grip: setGrip(k) 0 open .. 1 closed. wheel: setGrip(k) holds a wheel (k > 0.5), `held` is that wheel.
//   buildToyCarBody({color, number}) -> {group, setBuild(k), setPaint(k), setGlass(k), setWheels(k), setInterior(k),
//       setDoors(k), roll(d), doors, wheels, dims}
//       A toy sedan 6.0 x 2.6 x 2.0 on its wheels (wheels R 0.5 at x +-2.05, z +-1.07, beltline 1.3), the floor
//       0.45 above the tyre bottoms (= the origin). On a skid on the conveyor the origin sits at y = 0.95.
//       setBuild 0 floor pan, 0.25 side frames, 0.5 roof (a closed cage), 0.75 doors / hood / boot, 1 lamps, plates,
//       mirrors: the parts land from above (sides slide in) so the stages read from the top camera. setPaint 0 grey
//       e-coat .. 1 the colour. setWheels 0..1 brings the 4 wheels in one after another (FL, FR, RL, RR, L = -z).
//       doors = the 4 hinge pivots in the same order, setDoors(k) swings them all open.
//   buildToySkid()                       -> {group, slotY (0.25: the car origin sits on the skid top), slot}
//   buildToyRollerConveyor({length})     -> {group, topY (0.70), setOffset(d)}  rollers turn for d metres travelled
//   buildToyPress()                      -> {group, setRam(k) 0 up .. 1 closed, feed (the lower die top)}
//   buildToyPaintBooth()                 -> {group, length (16), setDoors(k) 0 shut .. 1 open, slots [2 robot mounts]}
//   buildToyDyno()                       -> {group, setRollers(angle), setLights(k), carY (where the car origin sits)}
//
// Static parts are merged per material and cached per variant, so a second copy costs only draw calls.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {TOY, rbox, toyMat} from '../airport-shared/style.js';

const PI = Math.PI;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sat = (v) => clamp(v, 0, 1);
const smooth = (v) => {
  const t = sat(v);
  return t * t * (3 - 2 * t);
};
const land = (v) => 1 - Math.pow(1 - sat(v), 3);
const V2 = (x, y) => new THREE.Vector2(x, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

/** the colours style.js has no entry for (the dark parts match airport-shared/gse.js's GSE_COLORS) */
export const LINE_COLORS = {
  ink: '#1d2231',
  chassis: '#2b3248',
  tyre: '#1f2433',
  hub: '#c9cfdf',
  hubCap: '#8a94b0',
  steel: '#a9b3cf',
  steelLight: '#c8d0e4',
  lamp: '#fbf1d4',
  ecoat: '#a7afc4', // the grey e-coat a body wears before its colour
  seat: '#2b3452',
  grate: '#9aa5c6',
  text: '#1d2748',
};
const C = LINE_COLORS;

// ================================================================ materials
const paint = (color, rough = 0.5) => toyMat(color, {paint: true, rough});
let MM = null;
function mats() {
  if (MM) return MM;
  const glow = (color, emissive, k, rough = 0.35) => new THREE.MeshStandardMaterial({color, roughness: rough, emissive, emissiveIntensity: k});
  MM = {
    white: paint(TOY.white),
    panel: paint(TOY.panel),
    blue: paint(TOY.blue, 0.46),
    blueDeep: paint(TOY.blueDeep, 0.48),
    blueLight: paint(TOY.blueLight, 0.5),
    shade: toyMat(TOY.shade, {rough: 0.7}),
    yellow: paint(TOY.yellow, 0.5),
    ink: toyMat(C.ink, {rough: 0.62}),
    chassis: toyMat(C.chassis, {rough: 0.66}),
    tyre: toyMat(C.tyre, {rough: 0.82}),
    hub: toyMat(C.hub, {rough: 0.42}),
    hubCap: toyMat(C.hubCap, {rough: 0.45, metal: 0.1}),
    steel: toyMat(C.steel, {rough: 0.38, metal: 0.3}),
    steelLight: toyMat(C.steelLight, {rough: 0.34, metal: 0.25}),
    glass: toyMat(TOY.glass, {paint: true, rough: 0.12}),
    seat: toyMat(C.seat, {rough: 0.75}),
    grate: toyMat(C.grate, {rough: 0.8}),
    lamp: glow(C.lamp, '#fff1c8', 0.22, 0.3),
    tail: glow('#f0656a', TOY.red, 0.35, 0.3),
    pane: toyMat('#cfdcff', {rough: 0.15, opacity: 0.22}),
    paneRoof: toyMat('#dfe8ff', {rough: 0.15, opacity: 0.12}),
  };
  return MM;
}
/** glass and mist stay out of the GTAO depth pass (it draws transparent meshes as solid and would put the AO of
 *  whatever is behind on the pane); the mesh must own its geometry */
function noAO(m) {
  m.geometry = m.geometry.clone();
  m.castShadow = false;
  m.onBeforeRender = (r, scene, cam, geo) => {
    if (scene.overrideMaterial) geo.setDrawRange(0, 0);
    else geo.setDrawRange(0, Infinity);
  };
  return m;
}

// ================================================================ textures
const TEX = new Map();
function canvasTex(key, w, h, draw, {repeat = false} = {}) {
  if (TEX.has(key)) return TEX.get(key);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  TEX.set(key, t);
  return t;
}
const DECALS = new Map();
function decalMat(tex, {rough = 0.5} = {}) {
  const key = tex.uuid + rough;
  if (DECALS.has(key)) return DECALS.get(key);
  const m = new THREE.MeshStandardMaterial({map: tex, roughness: rough, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4});
  m.userData.noCast = true;
  DECALS.set(key, m);
  return m;
}
const FONT = 'Inter, "Segoe UI", system-ui, sans-serif';
function textTex(text, {fg = C.text, bg = null, weight = 800, px = 96, pad = 26, italic = false} = {}) {
  const key = `txt|${text}|${fg}|${bg}|${weight}|${px}|${italic}`;
  if (TEX.has(key)) return TEX.get(key);
  const f = `${italic ? 'italic ' : ''}${weight} ${px}px ${FONT}`;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = f;
  const W = Math.ceil(probe.measureText(text).width + pad * 2);
  const H = Math.ceil(px * 1.3 + pad);
  return canvasTex(key, W, H, (g) => {
    if (bg) {
      g.fillStyle = bg;
      g.beginPath();
      g.roundRect(0, 0, W, H, H * 0.22);
      g.fill();
    }
    g.fillStyle = fg;
    g.font = f;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, W / 2, H / 2 + px * 0.04);
  });
}
/** the line's mark: a blue rounded square with a white isometric cube (the the reference family) */
function drawMark(g, x, y, s, {bg = TOY.blue, fg = '#ffffff'} = {}) {
  g.fillStyle = bg;
  g.beginPath();
  g.roundRect(x, y, s, s, s * 0.26);
  g.fill();
  const cx = x + s / 2;
  const q = s * 0.27;
  const t = y + s * 0.2;
  g.fillStyle = fg;
  g.beginPath();
  g.moveTo(cx, t);
  g.lineTo(cx + q, t + q * 0.55);
  g.lineTo(cx, t + q * 1.1);
  g.lineTo(cx - q, t + q * 0.55);
  g.closePath();
  g.fill();
  g.globalAlpha = 0.72;
  g.beginPath();
  g.moveTo(cx - q, t + q * 0.75);
  g.lineTo(cx - q * 0.08, t + q * 1.28);
  g.lineTo(cx - q * 0.08, t + q * 2.2);
  g.lineTo(cx - q, t + q * 1.66);
  g.closePath();
  g.fill();
  g.globalAlpha = 0.45;
  g.beginPath();
  g.moveTo(cx + q, t + q * 0.75);
  g.lineTo(cx + q * 0.08, t + q * 1.28);
  g.lineTo(cx + q * 0.08, t + q * 2.2);
  g.lineTo(cx + q, t + q * 1.66);
  g.closePath();
  g.fill();
  g.globalAlpha = 1;
}
/** a sign: the mark, a bold title and a light subtitle on a transparent canvas */
function signTex(title, sub, {fg = '#ffffff', subFg = 'rgba(255,255,255,0.75)', mark = true, w = 1024, h = 256, markBg = '#ffffff', markFg = TOY.blue} = {}) {
  return canvasTex(`sign|${title}|${sub}|${fg}|${mark}|${w}|${h}`, w, h, (g) => {
    let x = h * 0.12;
    if (mark) {
      drawMark(g, x, h * 0.16, h * 0.68, {bg: markBg, fg: markFg});
      x += h * 0.86;
    }
    g.fillStyle = fg;
    g.textBaseline = 'alphabetic';
    g.font = `800 ${h * 0.42}px ${FONT}`;
    g.fillText(title, x, h * (sub ? 0.56 : 0.66));
    if (sub) {
      g.fillStyle = subFg;
      g.font = `600 ${h * 0.17}px ${FONT}`;
      g.fillText(sub, x + h * 0.02, h * 0.8);
    }
  });
}

// ================================================================ geometry kit
const GEO = new Map();
const cg = (key, make) => {
  let g = GEO.get(key);
  if (!g) GEO.set(key, (g = make()));
  return g;
};
/** a rounded box; r defaults to a generous 20% of the smallest side */
function rb(w, h, d, r) {
  r = r ?? Math.min(w, h, d) * 0.2;
  r = Math.min(r, Math.min(w, h, d) / 2 - 1e-3);
  if (r < 0.006) return cg(`b|${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
  return rbox(w, h, d, r, 3);
}
const cylG = (r0, r1, h, seg = 24) => cg(`cy|${r0}|${r1}|${h}|${seg}`, () => new THREE.CylinderGeometry(r0, r1, h, seg));
const sphere = (r) => cg(`sp|${r}`, () => new THREE.SphereGeometry(r, 20, 14));
const planeG = (w, h) => cg(`pl|${w.toFixed(3)}|${h.toFixed(3)}`, () => new THREE.PlaneGeometry(w, h));
/** a cylinder along y with both rims rounded by b (the toy bevel on every drum, cap and disc) */
const rcylG = (r, h, b, seg = 36) =>
  cg(`rc|${r}|${h}|${b}|${seg}`, () => {
    b = Math.min(b ?? Math.min(r, h) * 0.3, r * 0.5, h * 0.5 - 1e-3);
    const pts = [V2(0, -h / 2)];
    const n = 5;
    for (let i = 0; i <= n; i++) {
      const a = -PI / 2 + (PI / 2) * (i / n);
      pts.push(V2(r - b + b * Math.cos(a), -h / 2 + b + b * Math.sin(a)));
    }
    for (let i = 0; i <= n; i++) {
      const a = (PI / 2) * (i / n);
      pts.push(V2(r - b + b * Math.cos(a), h / 2 - b + b * Math.sin(a)));
    }
    pts.push(V2(0, h / 2));
    return new THREE.LatheGeometry(pts, seg);
  });

/**
 * A side profile x0..x1 by y0..y1 with corner radii rc = [rear-bottom, front-bottom, front-top, rear-top] and wheel
 * arches [[x, cy, R]] cut into the bottom edge. Inset by the bevel b so the extruded walls land on the outline.
 */
function profile(x0, x1, y0, y1, {arches = [], rc = [0.15, 0.15, 0.15, 0.15]} = {}, b = 0) {
  x0 += b;
  x1 -= b;
  y0 += b;
  y1 -= b;
  const [r0, r1, r2, r3] = rc.map((r) => Math.max(0.02, r - b));
  const s = new THREE.Shape();
  s.moveTo(x0 + r0, y0);
  for (const [ax, cy, R0] of [...arches].sort((p, q) => p[0] - q[0])) {
    const R = R0 + b;
    const a = Math.asin(clamp((y0 - cy) / R, -1, 1));
    s.lineTo(ax - R * Math.cos(a), y0);
    s.absarc(ax, cy, R, PI - a, a, true);
  }
  s.lineTo(x1 - r1, y0);
  s.absarc(x1 - r1, y0 + r1, r1, -PI / 2, 0, false);
  s.lineTo(x1, y1 - r2);
  s.absarc(x1 - r2, y1 - r2, r2, 0, PI / 2, false);
  s.lineTo(x0 + r3, y1);
  s.absarc(x0 + r3, y1 - r3, r3, PI / 2, PI, false);
  s.lineTo(x0, y0 + r0);
  s.absarc(x0 + r0, y0 + r0, r0, PI, PI * 1.5, false);
  return s;
}
/** a polygon with every corner rounded by r (or r[i]) */
function roundedPoly(pts, r) {
  const s = new THREE.Shape();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[(i - 1 + n) % n];
    const c = pts[(i + 1) % n];
    const ri = Array.isArray(r) ? r[i] : r;
    const da = a.clone().sub(p);
    const dc = c.clone().sub(p);
    const k = Math.min(ri, da.length() / 2, dc.length() / 2);
    const p1 = p.clone().addScaledVector(da.normalize(), k);
    const p2 = p.clone().addScaledVector(dc.normalize(), k);
    if (i === 0) s.moveTo(p1.x, p1.y);
    else s.lineTo(p1.x, p1.y);
    s.quadraticCurveTo(p.x, p.y, p2.x, p2.y);
  }
  s.closePath();
  return s;
}
/** a shape extruded `depth` along z (centred), every edge rounded by the bevel b */
function extrude(key, makeShape, depth, b = 0.12, curve = 20) {
  return cg(`ex|${key}|${depth}|${b}`, () => {
    const g = new THREE.ExtrudeGeometry(makeShape(), {
      depth: Math.max(0.002, depth - 2 * b),
      bevelEnabled: b > 0,
      bevelThickness: b,
      bevelSize: b,
      bevelSegments: 4,
      curveSegments: curve,
    });
    g.translate(0, 0, -(depth - 2 * b) / 2);
    return g;
  });
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const KEEP = ['position', 'normal', 'uv'];
function prep(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (!KEEP.includes(k)) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  g.morphAttributes = {};
  g.clearGroups();
  return g;
}

/** collects transformed parts per material; merged() gives one geometry per material */
class Parts {
  constructor() {
    this.map = new Map();
  }
  put(mat, geo, m4) {
    const g = prep(geo);
    g.applyMatrix4(m4);
    if (!this.map.has(mat)) this.map.set(mat, []);
    this.map.get(mat).push(g);
    return this;
  }
  add(mat, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    return this.put(mat, geo, _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)));
  }
  /** a rounded box between two corners */
  ext(mat, x0, x1, y0, y1, z0, z1, r) {
    return this.add(mat, rb(x1 - x0, y1 - y0, z1 - z0, r), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  }
  /** the same box on both sides, z0..z1 and -z1..-z0 */
  pair(mat, x0, x1, y0, y1, z0, z1, r) {
    this.ext(mat, x0, x1, y0, y1, z0, z1, r);
    return this.ext(mat, x0, x1, y0, y1, -z1, -z0, r);
  }
  /** a cylinder along 'x', 'y' or 'z' */
  cyl(mat, r0, r1, h, x, y, z, axis = 'y', seg = 24) {
    return this.orient(mat, cylG(r0, r1, h, seg), x, y, z, axis);
  }
  /** a rounded drum along 'x', 'y' or 'z' */
  drum(mat, r, h, x, y, z, axis = 'y', b, seg = 36) {
    return this.orient(mat, rcylG(r, h, b, seg), x, y, z, axis);
  }
  orient(mat, g, x, y, z, axis) {
    if (axis === 'x') return this.add(mat, g, x, y, z, 0, 0, -PI / 2);
    if (axis === 'z') return this.add(mat, g, x, y, z, PI / 2, 0, 0);
    return this.add(mat, g, x, y, z);
  }
  /** a round bar between two points */
  rod(mat, a, b, r = 0.05, seg = 12) {
    const A = V3(...a);
    const d = V3(...b).sub(A);
    const len = d.length();
    _q.setFromUnitVectors(V3(0, 1, 0), d.clone().normalize());
    return this.put(mat, cylG(r, r, len, seg), _m.compose(A.addScaledVector(d, 0.5), _q, _s.set(1, 1, 1)));
  }
  /** a square bar with rounded edges between two points */
  bar(mat, a, b, t = 0.12, d = t) {
    const A = V3(...a);
    const dv = V3(...b).sub(A);
    const len = dv.length();
    _q.setFromUnitVectors(V3(0, 1, 0), dv.clone().normalize());
    return this.put(mat, rb(t, len + Math.min(t, d), d, Math.min(t, d) * 0.4), _m.compose(A.addScaledVector(dv, 0.5), _q, _s.set(1, 1, 1)));
  }
  /** a flat print of width w, height h facing +z, turned by ry (and rx) */
  print(mat, w, h, x, y, z, ry = 0, rx = 0) {
    return this.add(mat, planeG(w, h), x, y, z, rx, ry, 0);
  }
  /** a text plate of height h, facing +z turned by ry */
  text(text, opts, h, x, y, z, ry = 0, rx = 0) {
    const tex = textTex(text, opts);
    const a = tex.image.width / tex.image.height;
    return this.print(decalMat(tex), h * a, h, x, y, z, ry, rx);
  }
  /** a yellow-and-ink hazard strip along x (safety edges only) */
  hazard(x0, x1, y0, y1, z0, z1) {
    const M = mats();
    this.ext(M.ink, x0, x1, y0, y1, z0, z1, Math.min(y1 - y0, z1 - z0) * 0.3);
    const n = Math.max(2, Math.round((x1 - x0) / 0.5));
    const step = (x1 - x0) / n;
    for (let k = 0; k < n; k++) this.ext(M.yellow, x0 + k * step + step * 0.08, x0 + k * step + step * 0.55, y0 + 0.004, y1 + 0.004, z0 - 0.004, z1 + 0.004, 0.02);
    return this;
  }
  merged(off = null) {
    return [...this.map].map(([mat, list]) => {
      const g = mergeGeometries(list, false);
      if (off) g.translate(-off.x, -off.y, -off.z);
      return [mat, g];
    });
  }
}

const TPL = new Map();
/** the static meshes of a model, built once per key and shared between copies; swap maps sentinel materials */
function tpl(key, make, parent = new THREE.Group(), {off = null, swap = null} = {}) {
  let list = TPL.get(key);
  if (!list) {
    const P = new Parts();
    make(P);
    list = P.merged(off);
    TPL.set(key, list);
  }
  for (const [mat0, geo] of list) {
    const mat = swap?.get(mat0) ?? mat0;
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = !mat.userData.noCast && !mat.transparent;
    m.receiveShadow = true;
    if (mat.transparent && !mat.userData.noCast) noAO(m);
    parent.add(m);
  }
  return parent;
}
const part = (geo, mat, parent) => {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
};

// ================================================================ wheels (gse.js's wheel, rebuilt here)
function tyreGeo(r, w) {
  return cg(`tyre|${r}|${w}`, () => {
    const ri = r * 0.56;
    const hw = w / 2;
    const c = Math.min(hw * 0.78, (r - ri) * 0.62);
    const pts = [V2(ri, -hw * 0.84), V2((ri + r - c) / 2, -hw * 1.0)];
    for (let i = 0; i <= 7; i++) {
      const a = -PI / 2 + (PI / 2) * (i / 7);
      pts.push(V2(r - c + c * Math.cos(a), -hw + c + c * Math.sin(a)));
    }
    for (let i = 0; i <= 7; i++) {
      const a = (PI / 2) * (i / 7);
      pts.push(V2(r - c + c * Math.cos(a), hw - c + c * Math.sin(a)));
    }
    pts.push(V2((ri + r - c) / 2, hw * 1.0), V2(ri, hw * 0.84));
    const g = new THREE.LatheGeometry(pts, 44);
    g.rotateX(PI / 2);
    return g;
  });
}
function hubGeo(r, w) {
  return cg(`hub|${r}|${w}`, () => {
    const P = new Parts();
    const ri = r * 0.56;
    P.drum(null, ri + 0.004, w * 0.78, 0, 0, 0, 'z', 0.03);
    P.drum(null, ri * 0.82, w * 0.86, 0, 0, 0, 'z', 0.03);
    return mergeGeometries(P.map.get(null), false);
  });
}
function capGeo(r, w) {
  return cg(`cap|${r}|${w}`, () => {
    const P = new Parts();
    const ri = r * 0.56;
    P.drum(null, ri * 0.32, w * 0.92, 0, 0, 0, 'z', 0.02);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * PI * 2;
      P.cyl(null, ri * 0.075, ri * 0.075, w * 0.9, Math.cos(a) * ri * 0.58, Math.sin(a) * ri * 0.58, 0, 'z', 8);
    }
    return mergeGeometries(P.map.get(null), false);
  });
}
/** one wheel: a group (tyre, hub, cap) spinning about its local z, centred at its axle */
function makeWheel(r, w) {
  const M = mats();
  const g = new THREE.Group();
  part(tyreGeo(r, w), M.tyre, g);
  part(hubGeo(r, w), M.hub, g);
  part(capGeo(r, w), M.hubCap, g);
  g.userData.r = r;
  return g;
}

// ================================================================ the robot arm
/** link lengths (toy metres): j1 turret at h1, shoulder a1 forward at h2, lower arm a2, forearm offset a3, wrist
 *  centre d4 along the forearm (j4 at j4x), flange d6 past the wrist centre */
export const ROBOT = {h1: 0.84, a1: 0.32, h2: 1.6, a2: 2.0, a3: 0.24, d4: 1.9, j4x: 1.02, d6: 0.24};
const RB = ROBOT;
const TOOL_LEN = {weld: 0.95, grip: 0.74, paint: 0.82, wheel: 0.66};
export const ROBOT_LIMITS = [
  [-PI, PI],
  [-1.25, 1.65],
  [-1.7, 1.55],
  [-PI, PI],
  [-2.35, 2.35],
  [-2 * PI, 2 * PI],
];

function robotBase(P) {
  const M = mats();
  // a dark foot plate with 4 light bolts, the blue plinth, the blue j1 drum
  P.ext(M.chassis, -0.76, 0.76, 0, 0.08, -0.76, 0.76, 0.04);
  for (const [x, z] of [[-0.62, -0.62], [-0.62, 0.62], [0.62, -0.62], [0.62, 0.62]]) P.drum(M.steel, 0.055, 0.05, x, 0.095, z, 'y', 0.015, 16);
  P.ext(M.blue, -0.66, 0.66, 0.06, 0.52, -0.66, 0.66, 0.18);
  P.drum(M.blueDeep, 0.6, 0.08, 0, 0.54, 0, 'y', 0.03, 48);
  P.drum(M.blue, 0.56, 0.3, 0, 0.7, 0, 'y', 0.1, 48);
  // the connector box at the back, its cable to the floor
  P.ext(M.white, -0.8, -0.56, 0.12, 0.44, -0.24, 0.24, 0.08);
  P.drum(M.ink, 0.07, 0.12, -0.84, 0.3, -0.1, 'x', 0.02, 16);
  P.drum(M.ink, 0.07, 0.12, -0.84, 0.3, 0.1, 'x', 0.02, 16);
}
function robotTurret(P) {
  const M = mats();
  const y0 = 0; // j1 frame: y = 0 is the top of the base drum
  const sy = RB.h2 - RB.h1; // the shoulder axis
  // the white turret: a rounded drum, then two cheeks rising to the shoulder
  P.drum(M.white, 0.58, 0.26, 0, y0 + 0.13, 0, 'y', 0.09, 48);
  P.ext(M.white, -0.42, 0.52, 0.18, 0.56, -0.46, 0.46, 0.18);
  const cheek = () => roundedPoly([V2(-0.36, 0.3), V2(0.6, 0.3), V2(RB.a1 + 0.36, sy + 0.08), V2(RB.a1 - 0.08, sy + 0.42), V2(-0.36, sy - 0.06)], [0.08, 0.12, 0.3, 0.3, 0.2]);
  for (const s of [-1, 1]) P.add(M.white, extrude('cheek', cheek, 0.2, 0.06), 0, 0, s * 0.37);
  // the shoulder caps (blue) and the j2 motor on the left
  for (const s of [-1, 1]) P.drum(M.blue, 0.38, 0.12, RB.a1, sy, s * 0.5, 'z', 0.05, 48);
  P.drum(M.blue, 0.22, 0.34, RB.a1, sy, -0.7, 'z', 0.08, 36);
  P.drum(M.blueDeep, 0.14, 0.06, RB.a1, sy, -0.88, 'z', 0.02, 28);
  // a counterweight block at the back (toy KUKA)
  P.ext(M.blue, -0.62, -0.28, 0.32, 0.86, -0.3, 0.3, 0.14);
}
function robotLower(P, number) {
  const M = mats();
  const L = RB.a2;
  const link = () => roundedPoly([V2(-0.32, -0.3), V2(0.32, -0.3), V2(0.27, L + 0.27), V2(-0.27, L + 0.27)], [0.28, 0.28, 0.26, 0.26]);
  P.add(M.white, extrude('lower', link, 0.46, 0.11), 0, 0, 0);
  // the shoulder hub (it turns inside the turret cheeks) and a blue band
  P.drum(M.blue, 0.26, 0.5, 0, 0, 0, 'z', 0.06, 40);
  P.ext(M.blue, -0.3, 0.3, L * 0.62, L * 0.62 + 0.09, -0.235, 0.235, 0.03);
  // the printed number on both faces, reading up the arm
  for (const s of [-1, 1]) P.text(number, {fg: TOY.blue, px: 120, pad: 10}, 0.42, 0.02, L * 0.36, s * 0.234, s > 0 ? 0 : PI, 0);
}
function robotFore(P) {
  const M = mats();
  const A = RB.a3;
  // the elbow drum (blue) spanning both sides
  P.drum(M.blue, 0.33, 0.62, 0, 0, 0, 'z', 0.1, 48);
  P.drum(M.blueDeep, 0.17, 0.66, 0, 0, 0, 'z', 0.04, 32);
  // the forearm: a tapered rounded body with the motor housing behind the elbow
  const body = () => roundedPoly([V2(-0.74, A - 0.3), V2(RB.j4x - 0.02, A - 0.2), V2(RB.j4x - 0.02, A + 0.2), V2(-0.74, A + 0.32)], [0.22, 0.12, 0.12, 0.22]);
  P.add(M.white, extrude('fore', body, 0.5, 0.12), 0, 0, 0);
  // the wrist motors at the back, blue caps
  P.drum(M.blue, 0.2, 0.18, -0.8, A + 0.02, 0, 'x', 0.06, 36);
  P.drum(M.blueDeep, 0.12, 0.06, -0.9, A + 0.02, 0, 'x', 0.02, 24);
  // a dark cable loop over the elbow, toward the wrist
  P.rod(M.ink, [-0.55, A + 0.3, 0.12], [-0.1, A + 0.36, 0.12], 0.045);
  P.rod(M.ink, [-0.1, A + 0.36, 0.12], [0.75, A + 0.22, 0.12], 0.045);
}
function robotWrist(P) {
  const M = mats();
  const L = RB.d4 - RB.j4x;
  P.drum(M.blue, 0.25, 0.14, 0.07, 0, 0, 'x', 0.05, 40);
  P.drum(M.white, 0.21, L - 0.24, 0.1 + (L - 0.24) / 2, 0, 0, 'x', 0.08, 36);
  // the fork that holds j5
  for (const s of [-1, 1]) P.ext(M.white, L - 0.32, L + 0.15, -0.17, 0.17, s * 0.16 - 0.08, s * 0.16 + 0.08, 0.07);
}
function robotKnuckle(P) {
  const M = mats();
  P.drum(M.blue, 0.2, 0.5, 0, 0, 0, 'z', 0.07, 36);
  P.ext(M.white, -0.02, RB.d6 - 0.02, -0.15, 0.15, -0.14, 0.14, 0.07);
}
function robotFlange(P) {
  const M = mats();
  P.drum(M.blue, 0.18, 0.08, 0.02, 0, 0, 'x', 0.025, 36);
}

// ---------------------------------------------------------------- tools (j6 frame, the tool axis is +x, its back +y)
function toolWeld(P) {
  const M = mats();
  P.drum(M.steel, 0.14, 0.08, 0.08, 0, 0, 'x', 0.02, 28);
  // the gun body: the transformer box (white, a blue stripe) above the axis
  P.ext(M.white, 0.1, 0.62, -0.1, 0.52, -0.22, 0.22, 0.12);
  P.ext(M.blue, 0.12, 0.6, 0.3, 0.39, -0.225, 0.225, 0.03);
  P.ext(M.ink, 0.52, 0.66, -0.18, 0.1, -0.31, 0.31, 0.06);
  // the fork: two dark tines either side of the tip, the electrodes pointing in
  for (const s of [-1, 1]) {
    P.ext(M.ink, 0.58, 1.0, -0.085, 0.085, s * 0.25 - 0.06, s * 0.25 + 0.06, 0.04);
    P.drum(M.steelLight, 0.055, 0.16, 0.95, 0, s * 0.12, 'z', 0.018, 16);
  }
  // the cable from the flange into the gun
  P.rod(M.ink, [0.05, 0.14, 0.12], [0.22, 0.5, 0.12], 0.045);
}
function toolGrip(P) {
  const M = mats();
  P.drum(M.blue, 0.22, 0.1, 0.07, 0, 0, 'x', 0.03, 32);
  P.ext(M.white, 0.1, 0.44, -0.24, 0.24, -0.38, 0.38, 0.12);
  P.ext(M.ink, 0.42, 0.48, -0.09, 0.09, -0.33, 0.33, 0.03);
}
function toolFinger(P) {
  const M = mats();
  P.ext(M.white, 0.42, 0.8, -0.16, 0.16, -0.065, 0.065, 0.05);
  P.ext(M.ink, 0.6, 0.8, -0.13, 0.13, -0.085, -0.045, 0.015);
}
function toolPaint(P) {
  const M = mats();
  P.drum(M.blue, 0.17, 0.08, 0.06, 0, 0, 'x', 0.025, 32);
  P.drum(M.white, 0.2, 0.42, 0.31, 0, 0, 'x', 0.09, 36);
  P.drum(M.blue, 0.205, 0.07, 0.4, 0, 0, 'x', 0.02, 36);
  P.add(M.white, cg('paintneck', () => new THREE.CylinderGeometry(0.1, 0.16, 0.14, 32).rotateZ(-PI / 2)), 0.58, 0, 0);
  // the bell cup: a steel bowl opening forward, dark inside
  const cup = cg('bell', () => {
    const pts = [V2(0.04, -0.08), V2(0.07, -0.06), V2(0.12, 0.02), V2(0.135, 0.07), V2(0.12, 0.08), V2(0.06, 0.04), V2(0.0, 0.03)];
    return new THREE.LatheGeometry(pts, 36).rotateZ(-PI / 2);
  });
  P.add(M.steelLight, cup, 0.73, 0, 0);
  P.drum(M.ink, 0.05, 0.03, 0.77, 0, 0, 'x', 0.01, 20);
  // the paint lines, two hoses along the body
  for (const z of [-0.07, 0.07]) P.rod(M.ink, [0.06, 0.17, z], [0.5, 0.15, z], 0.025);
}
function toolWheel(P) {
  const M = mats();
  P.drum(M.blue, 0.27, 0.32, 0.2, 0, 0, 'x', 0.09, 40);
  P.drum(M.white, 0.3, 0.06, 0.08, 0, 0, 'x', 0.02, 40);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * PI * 2;
    P.drum(M.ink, 0.04, 0.12, 0.4, Math.cos(a) * 0.13, Math.sin(a) * 0.13, 'x', 0.01, 12);
  }
}

/** a spark burst: a hot core, a halo, 22 streaks, two sets that alternate for the flicker */
function sparkRig() {
  const g = new THREE.Group();
  const hot = new THREE.MeshBasicMaterial({color: '#fff6d8', toneMapped: false});
  const ray = new THREE.MeshBasicMaterial({color: '#ffc461', toneMapped: false});
  const core = noAO(new THREE.Mesh(sphere(0.07), hot));
  g.add(core);
  const haloTex = canvasTex('halo', 128, 128, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,240,200,1)');
    gr.addColorStop(0.25, 'rgba(255,190,90,0.55)');
    gr.addColorStop(1, 'rgba(255,160,60,0)');
    c.fillStyle = gr;
    c.fillRect(0, 0, w, h);
  });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false}));
  halo.scale.setScalar(0.9);
  halo.onBeforeRender = (r, scene, cam, geo) => {
    if (scene.overrideMaterial) geo.setDrawRange(0, 0);
    else geo.setDrawRange(0, Infinity);
  };
  g.add(halo);
  const sets = [];
  for (let s = 0; s < 2; s++) {
    const list = [];
    let seed = 17 + s * 101;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 22; k++) {
      // out of the contact, mostly backward and sideways, a few falling
      const th = rnd() * PI * 2;
      const ph = 0.35 + rnd() * 1.2;
      const d = V3(-Math.cos(ph), Math.sin(ph) * Math.cos(th), Math.sin(ph) * Math.sin(th)).normalize();
      const len = 0.3 + rnd() * 0.6;
      const b = new THREE.BoxGeometry(1, 0.03, 0.03).translate(0.5, 0, 0);
      _q.setFromUnitVectors(V3(1, 0, 0), d);
      b.applyMatrix4(_m.compose(d.clone().multiplyScalar(0.06 + rnd() * 0.08), _q, _s.set(len, 1, 1)));
      list.push(b);
    }
    const m = noAO(new THREE.Mesh(mergeGeometries(list, false), ray));
    g.add(m);
    sets.push(m);
  }
  g.visible = false;
  return {
    group: g,
    set(k, t = 0) {
      g.visible = k > 0.01;
      if (!g.visible) return;
      const f = Math.floor(t * 24);
      const flick = 0.75 + 0.25 * Math.sin(f * 2.3) * Math.sin(f * 0.7 + 1);
      sets[0].visible = f % 2 === 0;
      sets[1].visible = f % 2 === 1;
      for (const s of sets) {
        s.scale.setScalar(k * flick);
        s.rotation.x = f * 0.9;
      }
      core.scale.setScalar(0.6 + 0.6 * k * flick);
      halo.scale.setScalar(1.7 * k * flick);
    },
  };
}
const MIST = '#6f9bff';
/** the paint mist: two soft cones and three puffs out of the bell along +x */
function sprayRig() {
  const g = new THREE.Group();
  const tex = canvasTex('mist', 16, 256, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h);
    // canvas top = the cone's tip at the bell: thin there, densest two thirds out, soft at the rim
    gr.addColorStop(0, 'rgba(255,255,255,0.35)');
    gr.addColorStop(0.6, 'rgba(255,255,255,0.85)');
    gr.addColorStop(1, 'rgba(255,255,255,0.4)');
    c.fillStyle = gr;
    c.fillRect(0, 0, w, h);
  });
  // a white mist vanishes on the light world, so the mist carries colour (the paint's, or a mid blue)
  const mat = new THREE.MeshBasicMaterial({color: MIST, map: tex, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide});
  const outer = noAO(new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.72, 40, 1, true).rotateZ(PI / 2).translate(0.36, 0, 0), mat));
  const inner = noAO(new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.6, 32, 1, true).rotateZ(PI / 2).translate(0.3, 0, 0), mat));
  g.add(outer, inner);
  // three soft puffs along the axis give the mist some body from above
  const puff = new THREE.MeshBasicMaterial({color: MIST, transparent: true, opacity: 0.28, depthWrite: false});
  for (const [x, r] of [[0.2, 0.11], [0.4, 0.19], [0.6, 0.27]]) {
    const m = noAO(new THREE.Mesh(sphere(r), puff));
    m.position.x = x;
    g.add(m);
  }
  g.visible = false;
  return {
    group: g,
    mat,
    set(k, color) {
      g.visible = k > 0.01;
      if (color) {
        mat.color.set(color);
        puff.color.set(color);
      }
      puff.opacity = 0.28 * sat(k);
      mat.opacity = 0.6 * sat(k);
      g.scale.set(0.4 + 0.6 * sat(k), 0.6 + 0.4 * sat(k), 0.6 + 0.4 * sat(k));
    },
  };
}

const _iq = new THREE.Quaternion();
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _tp = new THREE.Vector3();
const AX = V3(1, 0, 0);
const AY = V3(0, 1, 0);
const AZ = V3(0, 0, 1);
const DOWN = V3(0, -1, 0);

export function buildToyRobot({tool = 'weld', number = '01'} = {}) {
  const M = mats();
  const group = new THREE.Group();
  tpl('robot|base', robotBase, group);
  const j1 = new THREE.Group();
  j1.position.y = RB.h1;
  group.add(j1);
  tpl('robot|turret', robotTurret, j1);
  const j2 = new THREE.Group();
  j2.position.set(RB.a1, RB.h2 - RB.h1, 0);
  j1.add(j2);
  tpl(`robot|lower|${number}`, (P) => robotLower(P, number), j2);
  const j3 = new THREE.Group();
  j3.position.set(0, RB.a2, 0);
  j2.add(j3);
  tpl('robot|fore', robotFore, j3);
  const j4 = new THREE.Group();
  j4.position.set(RB.j4x, RB.a3, 0);
  j3.add(j4);
  tpl('robot|wrist', robotWrist, j4);
  const j5 = new THREE.Group();
  j5.position.set(RB.d4 - RB.j4x, 0, 0);
  j4.add(j5);
  tpl('robot|knuckle', robotKnuckle, j5);
  const j6 = new THREE.Group();
  j6.position.set(RB.d6, 0, 0);
  j5.add(j6);
  tpl('robot|flange', robotFlange, j6);

  const toolLength = TOOL_LEN[tool] ?? TOOL_LEN.weld;
  const tip = new THREE.Object3D();
  tip.position.x = toolLength;
  j6.add(tip);
  let setSpark = () => {};
  let setSpray = () => {};
  let setGrip = () => {};
  let held = null;
  if (tool === 'weld') {
    tpl('tool|weld', toolWeld, j6);
    const sp = sparkRig();
    tip.add(sp.group);
    setSpark = (k, t = 0) => sp.set(k, t);
  } else if (tool === 'grip') {
    tpl('tool|grip', toolGrip, j6);
    const fingers = [-1, 1].map((s) => {
      const f = tpl('tool|finger', toolFinger, new THREE.Group());
      f.scale.z = s;
      j6.add(f);
      return f;
    });
    setGrip = (k) => {
      const z = lerp(0.27, 0.075, sat(k));
      fingers[0].position.z = -z;
      fingers[1].position.z = z;
    };
    setGrip(0);
  } else if (tool === 'paint') {
    tpl('tool|paint', toolPaint, j6);
    const sp = sprayRig();
    tip.add(sp.group);
    setSpray = (k, color) => sp.set(k, color);
  } else if (tool === 'wheel') {
    tpl('tool|wheel', toolWheel, j6);
    held = makeWheel(CAR.wheelR, CAR.wheelW);
    held.rotation.y = PI / 2; // its axis (local z) along the tool axis, the outer face toward the robot
    held.position.x = toolLength;
    j6.add(held);
    setGrip = (k) => {
      held.visible = k > 0.5;
    };
  }

  const joints = [0, 0, 0, 0, 0, 0];
  const setJoints = (a) => {
    for (let i = 0; i < 6; i++) joints[i] = a[i] ?? 0;
    j1.rotation.y = joints[0];
    j2.rotation.z = -joints[1];
    j3.rotation.z = -joints[2];
    j4.rotation.x = joints[3];
    j5.rotation.z = joints[4];
    j6.rotation.x = joints[5];
  };

  /**
   * Analytic IK. The wrist centre sits (d6 + tool) back from the point along the approach; j1 turns the arm to it,
   * j2/j3 solve the planar two-link (elbow up), j4/j5 aim the tool along the approach with the wrist bent down
   * (j5 <= 0, so j4 stays near 0 for anything approached from above), j6 turns the tool's back toward `up`.
   */
  const solve = (worldPoint, {down = true, dir = null, up = null, roll = 0} = {}) => {
    group.updateWorldMatrix(true, false);
    const P = V3().copy(worldPoint).applyMatrix4(new THREE.Matrix4().copy(group.matrixWorld).invert());
    group.getWorldQuaternion(_iq).invert();
    let a;
    if (dir) a = V3().copy(dir).normalize().applyQuaternion(_iq);
    else if (down) a = DOWN.clone();
    else a = V3(P.x, 0, P.z).normalize();
    if (!Number.isFinite(a.x)) a = AX.clone();
    const reachLen = RB.d6 + toolLength;
    const W = P.clone().addScaledVector(a, -reachLen);
    let ok = true;
    let rho = Math.hypot(W.x, W.z);
    const j1v = rho > 1e-4 ? Math.atan2(-W.z, W.x) : joints[0];
    let dx = rho - RB.a1;
    let dy = W.y - RB.h2;
    const L2 = Math.hypot(RB.d4, RB.a3);
    const delta = Math.atan2(RB.a3, RB.d4);
    let D = Math.hypot(dx, dy);
    const Dmax = RB.a2 + L2 - 1e-4;
    const Dmin = Math.abs(RB.a2 - L2) + 0.25;
    if (D > Dmax || D < Dmin) {
      ok = false;
      const s = clamp(D, Dmin, Dmax) / Math.max(D, 1e-6);
      dx *= s;
      dy *= s;
      D = clamp(D, Dmin, Dmax);
    }
    const beta = Math.atan2(dy, dx);
    const eps = Math.acos(clamp((RB.a2 * RB.a2 + D * D - L2 * L2) / (2 * RB.a2 * D), -1, 1));
    const thl = beta + eps;
    const j2v = PI / 2 - thl;
    const thu = Math.atan2(dy - RB.a2 * Math.sin(thl), dx - RB.a2 * Math.cos(thl));
    const j3v = delta - thu - j2v;
    // the wrist: the approach in the forearm frame
    _qa.setFromAxisAngle(AY, j1v).multiply(_qb.setFromAxisAngle(AZ, -(j2v + j3v)));
    const ap = a.clone().applyQuaternion(_qa.clone().invert());
    const sn = Math.hypot(ap.y, ap.z);
    const j5v = -Math.acos(clamp(ap.x, -1, 1));
    const j4v = sn > 1e-5 ? Math.atan2(-ap.z, -ap.y) : 0;
    const q05 = _qa.clone().multiply(_qb.setFromAxisAngle(AX, j4v)).multiply(new THREE.Quaternion().setFromAxisAngle(AZ, j5v));
    // the tool's back (+y) toward `up`, by default toward the robot (horizontal, from the tip back to the base)
    const ref = up ? V3().copy(up).applyQuaternion(_iq) : V3(-W.x, 0, -W.z);
    if (ref.lengthSq() < 1e-8 || Math.abs(ref.clone().normalize().dot(a)) > 0.97) ref.set(0, 1, 0);
    if (Math.abs(ref.clone().normalize().dot(a)) > 0.97) ref.set(-a.y, a.x, 0);
    const rl = ref.normalize().applyQuaternion(q05.invert());
    const j6v = Math.atan2(rl.z, rl.y) + roll;
    const out = [j1v, j2v, j3v, j4v, j5v, j6v];
    for (let i = 0; i < 6; i++) {
      const v = clamp(out[i], ROBOT_LIMITS[i][0], ROBOT_LIMITS[i][1]);
      if (Math.abs(v - out[i]) > 1e-4) ok = false;
      out[i] = v;
    }
    return {joints: out, ok};
  };
  const reach = (worldPoint, opts = {}) => {
    const {joints: j, ok} = solve(worldPoint, opts);
    setJoints(j);
    if (!ok) return false;
    // check the pose against the point (catches anything the clamps let through)
    tip.updateWorldMatrix(true, false);
    return tip.getWorldPosition(_tp).distanceTo(worldPoint) < 0.01;
  };

  return {
    group,
    setJoints,
    joints,
    solve: (p, o) => solve(p, o).joints,
    reach,
    tip,
    setSpark,
    setSpray,
    setGrip,
    held,
    tool,
    toolLength,
    limits: ROBOT_LIMITS,
    dims: {...RB, reach: RB.a1 + RB.a2 + Math.hypot(RB.d4, RB.a3)},
    parts: {j1, j2, j3, j4, j5, j6},
  };
}

// ================================================================ the car body
/** the toy sedan: 6.0 x 2.6 x 2.0, wheels R 0.5 at x +-2.05, the floor 0.45 above the tyre bottoms, beltline 1.3 */
export const CAR = {L: 6.0, W: 2.6, H: 2.0, floorY: 0.45, wheelR: 0.5, wheelW: 0.42, wheelX: 2.05, wheelZ: 1.07, belt: 1.3, roof: 2.0};
const PAINT = toyMat('#ff00ff', {rough: 0.99}); // sentinels, swapped for each car's own paint and glass
const GLASS = toyMat('#00ffff', {rough: 0.98});
const BELT = CAR.belt;
// the greenhouse outline (side view): rear window base, windshield base, roof front, roof rear
const GA = V2(1.16, 1.26);
const GB = V2(0.2, 1.98);
const GC = V2(-1.2, 1.98);
const GD = V2(-2.1, 1.26);
const aIn = (y) => GA.x + ((GB.x - GA.x) / (GB.y - GA.y)) * (y - GA.y) - 0.22;
const cIn = (y) => GD.x + ((GC.x - GD.x) / (GC.y - GD.y)) * (y - GD.y) + 0.24;
const yAtCIn = (x) => GD.y + ((x - 0.24 - GD.x) * (GC.y - GD.y)) / (GC.x - GD.x);
const WIN_F = [V2(-0.36, 1.35), V2(aIn(1.35), 1.35), V2(aIn(1.86), 1.86), V2(-0.36, 1.86)];
const WIN_R = [V2(-1.28, 1.35), V2(-0.54, 1.35), V2(-0.54, 1.86), V2(cIn(1.86), 1.86), V2(-1.28, yAtCIn(-1.28))];
const DOOR = {F: [-0.48, 0.96], R: [-1.28, -0.52]};
const HINGE = {F: V3(0.94, 0, 1.2), R: V3(-0.54, 0, 1.2)};
const ARCH = 0.58;

/** the body side above the beltline: pillars and the roof rail, the two window holes cut out */
function upperSideShape() {
  const s = roundedPoly([GD, GA, GB, GC].map((v) => v.clone()), [0.04, 0.04, 0.26, 0.26]);
  s.holes.push(roundedPoly(WIN_F, 0.07), roundedPoly(WIN_R, 0.07));
  return s;
}
/** a window pane: the hole's outline, a hair smaller */
function paneShape(pts) {
  const c = pts.reduce((a, v) => a.add(v), V2(0, 0)).multiplyScalar(1 / pts.length);
  return roundedPoly(
    pts.map((v) => v.clone().sub(c).multiplyScalar(0.985).add(c)),
    0.06,
  );
}
/** a slab between two points of the side view, `t` thick, `w` wide (z), inset along the inward normal */
function slope(P, mat, a, b, t, w, inset) {
  const d = b.clone().sub(a);
  const len = d.length();
  d.normalize();
  const n = V2(d.y, -d.x); // the right-hand normal; flipped below so it points into the cabin (down)
  if (n.y > 0) n.multiplyScalar(-1);
  const c = a.clone().add(b).multiplyScalar(0.5).addScaledVector(n, inset);
  P.add(mat, rb(len, t, w, Math.min(t, 0.05) * 0.45), c.x, c.y, 0, 0, 0, Math.atan2(d.y, d.x));
}

const WX = CAR.wheelX;
function carFloor(P) {
  P.ext(PAINT, -2.92, 2.9, 0.45, 0.57, -1.1, 1.1, 0.05);
  P.ext(PAINT, -1.6, 0.9, 0.54, 0.7, -0.19, 0.19, 0.08); // the tunnel
  for (const x of [WX, -WX]) P.pair(PAINT, x - 0.58, x + 0.58, 0.55, 1.1, 0.62, 1.08, 0.16); // wheel tubs
  for (const [x0, x1] of [[0.9, 2.88], [-2.88, -1.55]]) P.pair(PAINT, x0, x1, 0.56, 0.8, 0.4, 0.58, 0.07); // rails
  P.ext(PAINT, 2.72, 2.88, 0.56, 0.84, -0.72, 0.72, 0.05);
  for (const x of [-0.02, -0.96]) P.ext(PAINT, x - 0.1, x + 0.1, 0.55, 0.67, -1.06, 1.06, 0.04); // seat crossmembers
  P.pair(PAINT, -1.36, 1.0, 0.45, 0.64, 0.96, 1.08, 0.04); // inner rockers
}
function carSide(P, s) {
  const zc = s * 1.19;
  // the rear quarter with its arch (a thin bevel: a fat one would push the arch through the top), the sill, the
  // hinge and B pillars (hidden behind the doors once they are on)
  P.add(PAINT, extrude('car|quarter', () => profile(-3.0, -1.3, 0.45, BELT, {arches: [[-WX, CAR.wheelR, ARCH]], rc: [0.24, 0.03, 0.03, 0.34]}, 0.045), 0.22, 0.045), 0, 0, zc);
  P.ext(PAINT, -1.32, 1.0, 0.45, 0.66, s > 0 ? 1.08 : -1.3, s > 0 ? 1.3 : -1.08, 0.07);
  for (const [x0, x1] of [[0.84, 1.0], [-0.54, -0.4]]) P.ext(PAINT, x0, x1, 0.6, BELT + 0.02, s > 0 ? 0.96 : -1.08, s > 0 ? 1.08 : -0.96, 0.04);
  // above the beltline: the pillars and the roof rail, tucked in (tumblehome)
  P.add(PAINT, extrude('car|upper', upperSideShape, 0.14, 0.03), 0, 0, s * 1.06);
}
function carRoof(P) {
  P.ext(PAINT, -1.25, 0.28, 1.88, 2.0, -1.13, 1.13, 0.05);
  P.ext(PAINT, 0.82, 0.98, 0.57, BELT - 0.04, -1.0, 1.0, 0.04); // firewall
  P.ext(PAINT, 0.9, 1.16, BELT - 0.14, BELT, -1.0, 1.0, 0.05); // cowl
  P.ext(PAINT, 2.62, 2.78, 0.57, 1.1, -0.92, 0.92, 0.05); // radiator support
  P.ext(PAINT, -2.96, -2.82, 0.57, BELT - 0.12, -1.08, 1.08, 0.05); // rear panel
  P.ext(PAINT, -2.14, -1.9, BELT - 0.16, BELT - 0.02, -1.0, 1.0, 0.04); // parcel shelf
}
function carFront(P) {
  // hood and fenders in one block, the arch cut with a modest bevel so it stays under the hood line
  P.add(PAINT, extrude('car|front', () => profile(1.0, 3.0, 0.45, BELT, {arches: [[WX, CAR.wheelR, ARCH]], rc: [0.03, 0.22, 0.32, 0.03]}, 0.1), 2.6, 0.1), 0, 0, 0);
}
function carBoot(P) {
  P.ext(PAINT, -2.97, -2.06, BELT - 0.18, BELT, -1.1, 1.1, 0.07);
}
function carDoor(P, which, s) {
  const M = mats();
  const [x0, x1] = DOOR[which];
  P.ext(PAINT, x0, x1, 0.67, BELT, s > 0 ? 1.08 : -1.3, s > 0 ? 1.3 : -1.08, 0.07);
  // the handle: a dark recess near the rear edge
  P.ext(M.ink, x0 + 0.14, x0 + 0.42, 1.12, 1.17, s > 0 ? 1.28 : -1.32, s > 0 ? 1.32 : -1.28, 0.02);
}
function carDoorGlass(P, which, s) {
  P.add(GLASS, extrude(`car|pane|${which}`, () => paneShape(which === 'F' ? WIN_F : WIN_R), 0.05, 0), 0, 0, s * 1.06);
}
function carGlass(P) {
  slope(P, GLASS, V2(1.12, 1.29), V2(0.26, 1.93), 0.06, 1.98, 0.05); // windshield
  slope(P, GLASS, V2(-2.06, 1.29), V2(-1.27, 1.93), 0.06, 1.98, 0.05); // rear window
}
function carMirror(P, s) {
  const M = mats();
  P.ext(M.ink, 0.74, 0.88, BELT - 0.02, BELT + 0.08, s > 0 ? 1.18 : -1.36, s > 0 ? 1.36 : -1.18, 0.03);
  P.ext(PAINT, 0.66, 0.92, BELT + 0.02, BELT + 0.22, s > 0 ? 1.3 : -1.56, s > 0 ? 1.56 : -1.3, 0.08);
}
function carTrim(P) {
  const M = mats();
  // dark bumpers, cream headlamps, a dark grille with a light badge, red tail lamps
  P.ext(M.ink, 2.6, 3.07, 0.42, 0.64, -1.26, 1.26, 0.1);
  P.ext(M.ink, -3.07, -2.6, 0.42, 0.64, -1.26, 1.26, 0.1);
  for (const s of [-1, 1]) {
    P.ext(M.lamp, 2.93, 3.03, 0.84, 0.98, s > 0 ? 0.6 : -1.12, s > 0 ? 1.12 : -0.6, 0.05);
    P.ext(M.tail, -3.03, -2.93, 0.8, 0.94, s > 0 ? 0.56 : -1.14, s > 0 ? 1.14 : -0.56, 0.05);
  }
  P.ext(M.ink, 2.95, 3.03, 0.68, 0.86, -0.52, 0.52, 0.04);
  for (let k = 0; k < 3; k++) P.ext(M.steelLight, 3.0, 3.045, 0.705 + k * 0.05, 0.725 + k * 0.05, -0.44, 0.44, 0.008);
  P.drum(M.steelLight, 0.07, 0.04, 3.04, 0.77, 0, 'x', 0.012, 24);
}
function carInterior(P) {
  const M = mats();
  for (const [x, z, w] of [[-0.02, -0.5, 0.62], [-0.02, 0.5, 0.62], [-1.16, 0, 1.7]]) {
    P.ext(M.seat, x - 0.32, x + 0.3, 0.6, 0.88, z - w / 2, z + w / 2, 0.1);
    P.add(M.seat, rb(0.2, 0.72, w, 0.08), x - 0.34, 1.2, z, 0, 0, 0.18);
    if (w < 1) P.ext(M.seat, x - 0.42, x - 0.28, 1.54, 1.68, z - 0.16, z + 0.16, 0.05);
  }
  P.ext(M.ink, 0.58, 0.92, 1.0, 1.28, -0.98, 0.98, 0.1); // dashboard
  P.add(M.steelLight, cg('steer', () => new THREE.TorusGeometry(0.17, 0.035, 10, 28)), 0.44, 1.2, -0.5, 0, PI / 2 - 0.5, 0);
  P.add(M.ink, cg('steercol', () => new THREE.CylinderGeometry(0.04, 0.04, 0.3, 10)), 0.58, 1.14, -0.5, 0, 0, -1.07);
}
/** a white plate with the number, facing +x (front) or -x (rear) */
function carPlates(P, number) {
  P.text(number, {fg: C.text, bg: '#ffffff', px: 110, pad: 18}, 0.2, 3.076, 0.53, 0, PI / 2);
  P.text(number, {fg: C.text, bg: '#ffffff', px: 110, pad: 18}, 0.2, -3.076, 0.53, 0, -PI / 2);
}

export function buildToyCarBody({color = TOY.blue, number = 'B 0412'} = {}) {
  const group = new THREE.Group();
  const ecoat = new THREE.Color(C.ecoat);
  const target = new THREE.Color(color);
  const paintMat = new THREE.MeshPhysicalMaterial({color: ecoat.clone(), roughness: 0.55, clearcoat: 0.15, clearcoatRoughness: 0.4});
  const glassMat = new THREE.MeshPhysicalMaterial({color: TOY.glass, roughness: 0.12, clearcoat: 0.35, clearcoatRoughness: 0.35, transparent: true, opacity: 0.9});
  const swap = new Map([
    [PAINT, paintMat],
    [GLASS, glassMat],
  ]);
  // every stage hangs on a holder that animates it in; doors also get a hinge pivot under the holder
  const stages = [];
  const holder = (name, make, from, k0, k1, {off = null, parent = group, key = name} = {}) => {
    const h = new THREE.Group();
    const inner = new THREE.Group();
    h.add(inner);
    tpl(`car|${key}`, make, inner, {off, swap});
    parent.add(h);
    const st = {name, h, inner, from, k0, k1};
    stages.push(st);
    return st;
  };
  holder('floor', carFloor, V3(0, 0, 0), -1, 0);
  for (const s of [-1, 1]) holder(`side${s}`, (P) => carSide(P, s), V3(0, 0.9, s * 1.8), 0.02, 0.25);
  holder('roof', carRoof, V3(0, 2.6, 0), 0.27, 0.5);
  holder('front', carFront, V3(0, 2.0, 0), 0.52, 0.68);
  holder('boot', carBoot, V3(0, 1.8, 0), 0.6, 0.75);
  const doors = [];
  const doorGlass = [];
  for (const which of ['F', 'R'])
    for (const s of [-1, 1]) {
      const pv = V3(HINGE[which].x, 0, s * HINGE[which].z);
      const st = holder(`door${which}${s}`, (P) => carDoor(P, which, s), V3(0, 0.6, s * 1.4), which === 'F' ? 0.56 : 0.6, which === 'F' ? 0.71 : 0.75, {off: pv});
      st.inner.position.copy(pv);
      st.inner.userData.side = s;
      // the window rides on the door, the mirror on the front doors (they come with the trim)
      const gl = tpl(`car|pane${which}${s}`, (P) => carDoorGlass(P, which, s), new THREE.Group(), {off: pv, swap});
      st.inner.add(gl);
      doorGlass.push(gl);
      if (which === 'F') {
        holder(`mirror${s}`, (P) => carMirror(P, s), V3(0, 0.5, 0), 0.8, 0.95, {off: pv, parent: st.inner});
      }
      doors.push(st.inner);
    }
  const trim = holder('trim', carTrim, V3(0, 0.7, 0), 0.8, 1.0);
  tpl(`car|plates|${number}`, (P) => carPlates(P, number), trim.inner);
  const glass = tpl('car|glass', carGlass, new THREE.Group(), {swap});
  group.add(glass);
  const interior = holder('interior', carInterior, V3(0, 1.6, 0), 2, 3);

  // wheels FL, FR, RL, RR, each on a holder that slides it onto the hub
  const wheels = [];
  const wheelHolders = [];
  for (const x of [CAR.wheelX, -CAR.wheelX])
    for (const s of [-1, 1]) {
      const h = new THREE.Group();
      h.position.set(x, CAR.wheelR, s * CAR.wheelZ);
      h.userData.side = s;
      const w = makeWheel(CAR.wheelR, CAR.wheelW);
      h.add(w);
      group.add(h);
      wheels.push(w);
      wheelHolders.push(h);
    }

  const place = (st, s) => {
    st.h.visible = s > 0.001;
    const e = land(s);
    st.h.position.copy(st.from).multiplyScalar(1 - e);
  };
  let build = 1;
  const setBuild = (k) => {
    build = k;
    for (const st of stages) {
      if (st.name === 'interior') continue;
      place(st, st.k0 < 0 ? 1 : sat((k - st.k0) / (st.k1 - st.k0)));
    }
  };
  const setPaint = (k) => {
    paintMat.color.copy(ecoat).lerp(target, sat(k));
    paintMat.roughness = lerp(0.55, 0.42, sat(k));
    paintMat.clearcoat = lerp(0.15, 0.45, sat(k));
  };
  const setGlass = (k) => {
    const on = k > 0.001;
    glass.visible = on;
    for (const g of doorGlass) g.visible = on;
    glassMat.opacity = 0.9 * sat(k);
  };
  const setWheels = (k) => {
    wheelHolders.forEach((h, i) => {
      const s = sat(k * 4 - i);
      h.visible = s > 0.001;
      h.position.z = h.userData.side * (CAR.wheelZ + 1.2 * (1 - land(s)));
    });
  };
  const setInterior = (k) => place(interior, sat(k));
  const setDoors = (k) => {
    for (const d of doors) d.rotation.y = d.userData.side * 1.1 * smooth(k);
  };
  const roll = (d) => {
    for (const w of wheels) w.rotation.z = -d / CAR.wheelR;
  };
  setBuild(1);
  setPaint(1);
  setGlass(1);
  setWheels(1);
  setInterior(1);
  return {group, setBuild, setPaint, setGlass, setWheels, setInterior, setDoors, roll, doors, wheels, dims: CAR, paintMat, glassMat, get build() {
    return build;
  }};
}

// ================================================================ the skid and the roller conveyor
/** the skid: two blue runners on the rollers, white cross beams, 4 posts up to the car's floor */
export function buildToySkid() {
  const M = mats();
  const group = new THREE.Group();
  tpl('skid', (P) => {
    for (const s of [-1, 1]) {
      P.ext(M.blueDeep, -3.2, 3.2, 0, 0.14, s * 0.85 - 0.12, s * 0.85 + 0.12, 0.05);
      // the runners turn up at the ends like a sledge
      P.ext(M.blueDeep, 3.0, 3.26, 0.02, 0.2, s * 0.85 - 0.12, s * 0.85 + 0.12, 0.07);
      P.ext(M.blueDeep, -3.26, -3.0, 0.02, 0.2, s * 0.85 - 0.12, s * 0.85 + 0.12, 0.07);
    }
    for (const x of [-2.7, -0.9, 0.9, 2.7]) P.ext(M.white, x - 0.1, x + 0.1, 0.1, 0.25, -1.2, 1.2, 0.05);
    for (const x of [-0.9, 0.9])
      for (const s of [-1, 1]) {
        P.drum(M.steel, 0.07, 0.43, x, 0.46, s * 0.92, 'y', 0.02, 16);
        P.drum(M.ink, 0.12, 0.05, x, 0.68, s * 0.92, 'y', 0.02, 20);
      }
    for (const s of [-1, 1]) P.text('SK 07', {fg: '#ffffff', px: 90, pad: 8}, 0.1, 0, 0.07, s * 0.972, s > 0 ? 0 : PI);
  }, group);
  const slot = new THREE.Object3D();
  slot.position.y = 0.25;
  group.add(slot);
  return {group, slotY: 0.25, slot};
}

const ROLLER_R = 0.1;
export function buildToyRollerConveyor({length = 12} = {}) {
  const M = mats();
  const group = new THREE.Group();
  const topY = 0.7;
  const n = Math.max(2, Math.round(length / 0.6));
  const step = length / n;
  tpl(`conv|${length.toFixed(2)}`, (P) => {
    const hl = length / 2;
    for (const s of [-1, 1]) {
      // the blue side beams with a white lip, legs every <= 3 m
      P.ext(M.blue, -hl, hl, 0.36, 0.64, s * 1.3 - 0.08, s * 1.3 + 0.08, 0.06);
      P.ext(M.white, -hl - 0.02, hl + 0.02, 0.6, 0.67, s * 1.3 - 0.1, s * 1.3 + 0.1, 0.03);
      const legs = Math.max(2, Math.ceil(length / 3) + 1);
      for (let k = 0; k < legs; k++) {
        const x = -hl + 0.3 + ((length - 0.6) * k) / (legs - 1);
        P.ext(M.shade, x - 0.09, x + 0.09, 0, 0.4, s * 1.3 - 0.09, s * 1.3 + 0.09, 0.04);
        P.ext(M.chassis, x - 0.16, x + 0.16, 0, 0.05, s * 1.3 - 0.16, s * 1.3 + 0.16, 0.02);
        if (s > 0) P.ext(M.shade, x - 0.05, x + 0.05, 0.14, 0.22, -1.24, 1.24, 0.03);
      }
    }
  }, group);
  // the rollers: instanced, steel with three dark bands so the turning shows
  const tex = canvasTex('rollertex', 128, 8, (g, w, h) => {
    g.fillStyle = '#d2d8ea';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#7e89aa';
    for (let k = 0; k < 3; k++) g.fillRect((k * w) / 3, 0, w * 0.09, h);
  });
  const rmat = new THREE.MeshStandardMaterial({map: tex, roughness: 0.35, metalness: 0.25});
  const rgeo = cg('roller', () => {
    const g = new THREE.CylinderGeometry(ROLLER_R, ROLLER_R, 2.44, 20, 1, false);
    g.rotateX(PI / 2);
    return g;
  });
  const im = new THREE.InstancedMesh(rgeo, rmat, n);
  im.castShadow = im.receiveShadow = true;
  group.add(im);
  const capGeo2 = cg('rollercap', () => rcylG(0.075, 2.56, 0.02, 16).clone().rotateX(PI / 2));
  const caps = new THREE.InstancedMesh(capGeo2, M.chassis, n);
  caps.castShadow = caps.receiveShadow = true;
  group.add(caps);
  const xs = [];
  for (let k = 0; k < n; k++) xs.push(-length / 2 + step * (k + 0.5));
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = V3(1, 1, 1);
  const setOffset = (d) => {
    q.setFromAxisAngle(AZ, -d / ROLLER_R);
    xs.forEach((x, i) => {
      m4.compose(_p.set(x, topY - ROLLER_R, 0), q, one);
      im.setMatrixAt(i, m4);
      caps.setMatrixAt(i, m4);
    });
    im.instanceMatrix.needsUpdate = true;
    caps.instanceMatrix.needsUpdate = true;
  };
  setOffset(0);
  im.computeBoundingSphere();
  caps.computeBoundingSphere();
  return {group, topY, setOffset, length};
}

// ================================================================ the stamping press
export function buildToyPress({number = '01'} = {}) {
  const M = mats();
  const group = new THREE.Group();
  const H = 10;
  tpl(`press|${number}`, (P) => {
    // the bed on a dark foot, the bolster with hazard edges front and back
    P.ext(M.chassis, -3.3, 3.3, 0, 0.12, -4.3, 4.3, 0.05);
    P.ext(M.blue, -3.1, 3.1, 0.1, 1.6, -4.0, 4.0, 0.3);
    P.ext(M.steelLight, -2.5, 2.5, 1.55, 1.85, -3.0, 3.0, 0.08);
    for (const s of [-1, 1]) P.hazard(-2.4, 2.4, 1.86, 1.9, s * 3.0 - 0.06, s * 3.0 + 0.06);
    P.hazard(-3.0, 3.0, 1.45, 1.6, -4.06, -4.0);
    // the lower die
    P.ext(M.steel, -1.9, 1.9, 1.85, 2.2, -2.5, 2.5, 0.08);
    P.ext(M.steelLight, -1.4, 1.4, 2.15, 2.42, -1.9, 1.9, 0.2);
    // 4 uprights (white), the tie rods (blue caps), the crown (blue) with its name
    for (const x of [-2.45, 2.45])
      for (const z of [-3.4, 3.4]) {
        P.ext(M.white, x - 0.62, x + 0.62, 1.5, 8.3, z - 0.6, z + 0.6, 0.22);
        P.drum(M.blueDeep, 0.2, 0.2, x, 8.25, z, 'y', 0.05, 20);
      }
    P.ext(M.blue, -3.25, 3.25, 7.9, H - 0.2, -4.2, 4.2, 0.45);
    P.ext(M.blueDeep, -2.6, 2.6, H - 0.3, H, -3.4, 3.4, 0.2);
    // the drive on top: a white housing with a dark vent, two blue motors lying along it
    P.ext(M.white, -2.3, 1.9, H - 0.1, H + 0.7, -1.3, 1.3, 0.3);
    P.ext(M.ink, -1.6, 1.2, H + 0.12, H + 0.5, -1.33, -1.26, 0.04);
    for (let k = 0; k < 5; k++) P.ext(M.steel, -1.5 + k * 0.6, -1.3 + k * 0.6, H + 0.16, H + 0.46, -1.35, -1.3, 0.02);
    for (const z of [-0.55, 0.55]) {
      P.drum(M.blue, 0.38, 1.7, -0.2, H + 1.0, z, 'x', 0.12, 36);
      P.drum(M.blueDeep, 0.2, 1.86, -0.2, H + 1.0, z, 'x', 0.05, 24);
    }
    // the feed table in (a stack of blanks) and the table out (stamped panels)
    for (const e of [-1, 1]) {
      for (const x of [3.8, 6.4]) for (const z of [-1.9, 1.9]) P.ext(M.shade, e * x - 0.1, e * x + 0.1, 0, 1.45, z - 0.1, z + 0.1, 0.04);
      P.ext(M.blue, e > 0 ? 3.6 : -6.6, e > 0 ? 6.6 : -3.6, 1.4, 1.6, -2.2, 2.2, 0.08);
    }
    for (let k = 0; k < 7; k++) P.ext(M.steelLight, -6.3, -3.9, 1.6 + k * 0.07, 1.65 + k * 0.07, -1.7, 1.7, 0.02);
    for (const [x, z] of [[4.4, -1.0], [5.8, -1.0], [5.1, 1.0]]) {
      P.ext(M.steelLight, x - 0.6, x + 0.6, 1.6, 1.66, z - 0.85, z + 0.85, 0.02);
      P.ext(M.steelLight, x - 0.4, x + 0.4, 1.62, 1.8, z - 0.6, z + 0.6, 0.12);
    }
    for (const s of [-1, 1]) {
      const tex = signTex(`P${number}`, 'Transfer press · 2,400 t', {});
      P.print(decalMat(tex), 4.6, 1.15, 0, 8.95, s * 4.205, s > 0 ? 0 : PI);
    }
    // the control desk on the -z side, light curtains (yellow posts) at the openings
    P.ext(M.white, -1.2, 0.2, 0, 1.4, -5.6, -4.9, 0.18);
    P.ext(M.ink, -1.05, 0.05, 1.4, 1.48, -5.5, -5.0, 0.04);
    P.add(decalMat(screenTex()), planeG(0.9, 0.42), -0.5, 1.5, -5.25, -PI / 2, 0, 0);
    for (const x of [-2.95, 2.95])
      for (const z of [-2.55, 2.55]) {
        P.ext(M.yellow, x - 0.09, x + 0.09, 1.6, 3.7, z - 0.09, z + 0.09, 0.05);
        P.ext(M.ink, x - 0.1, x + 0.1, 3.7, 3.78, z - 0.1, z + 0.1, 0.03);
      }
  }, group);
  // the ram: a white slide between the uprights carrying the upper die; connecting rods from the crown
  const ram = new THREE.Group();
  group.add(ram);
  tpl('press|ram', (P) => {
    P.ext(M.white, -1.75, 1.75, 0, 1.5, -2.7, 2.7, 0.25);
    P.ext(M.blue, -1.77, 1.77, 1.05, 1.25, -2.72, 2.72, 0.06);
    P.ext(M.steel, -1.7, 1.7, -0.3, 0.02, -2.5, 2.5, 0.08);
    P.ext(M.steelLight, -1.45, 1.45, -0.42, -0.25, -1.95, 1.95, 0.06);
  }, ram);
  const rods = [-1.5, 1.5].map((z) => {
    const r = part(cg('pressrod', () => new THREE.CylinderGeometry(0.22, 0.22, 1, 20).translate(0, 0.5, 0)), M.steel, group);
    r.position.set(0, 0, z);
    return r;
  });
  const yUp = 5.4;
  const yDown = 2.85; // the upper die face meets the lower die top (2.42) with the sheet between
  const setRam = (k) => {
    const y = lerp(yUp, yDown, sat(k));
    ram.position.y = y;
    for (const r of rods) {
      r.position.y = y + 1.4;
      r.scale.y = 7.95 - (y + 1.4);
    }
  };
  setRam(0);
  const feed = new THREE.Object3D();
  feed.position.set(0, 2.43, 0);
  group.add(feed);
  return {group, setRam, feed};
}
/** a small control screen: dark glass with a blue gauge and two bars */
function screenTex() {
  return canvasTex('screen', 256, 128, (g, w, h) => {
    g.fillStyle = '#1d2748';
    g.beginPath();
    g.roundRect(0, 0, w, h, 14);
    g.fill();
    g.strokeStyle = '#5b8cff';
    g.lineWidth = 10;
    g.beginPath();
    g.arc(62, 70, 34, PI * 0.8, PI * 2.05);
    g.stroke();
    g.fillStyle = '#7fdaa0';
    g.fillRect(122, 40, 108, 14);
    g.fillStyle = '#5b8cff';
    g.fillRect(122, 66, 78, 14);
    g.fillStyle = '#3a4670';
    g.fillRect(122, 92, 108, 10);
  });
}

// ================================================================ the paint booth
export function buildToyPaintBooth({number = '02'} = {}) {
  const M = mats();
  const group = new THREE.Group();
  const L = 16;
  const W = 7;
  const H = 5.5;
  const hl = L / 2;
  const hw = W / 2;
  tpl(`booth|${number}`, (P) => {
    // the floor: a blue plinth rim around a grated floor
    P.ext(M.blueDeep, -hl - 0.2, hl + 0.2, 0, 0.1, -hw - 0.2, hw + 0.2, 0.05);
    P.ext(M.grate, -hl + 0.1, hl - 0.1, 0.08, 0.12, -hw + 0.1, hw - 0.1, 0.03);
    // the robot platforms along both walls
    for (const s of [-1, 1]) P.ext(M.white, -hl + 1.2, hl - 1.2, 0.08, 0.5, s * (hw - 0.95) - 0.75, s * (hw - 0.95) + 0.75, 0.12);
    // the frame: posts every 4 m, top beams, the header band
    for (let k = 0; k <= 4; k++) {
      const x = -hl + (L * k) / 4;
      for (const s of [-1, 1]) P.ext(M.white, x - 0.18, x + 0.18, 0.08, H, s * hw - 0.18, s * hw + 0.18, 0.08);
    }
    for (const s of [-1, 1]) {
      P.ext(M.white, -hl - 0.2, hl + 0.2, H - 0.4, H + 0.1, s * hw - 0.22, s * hw + 0.22, 0.12);
      P.ext(M.blue, -hl - 0.21, hl + 0.21, H - 0.3, H - 0.12, s * hw - 0.23, s * hw + 0.23, 0.05);
      // low white kick panels under the glass
      P.ext(M.white, -hl, hl, 0.08, 0.7, s * hw - 0.12, s * hw + 0.12, 0.06);
    }
    // the end walls: a header over the door opening, the side jambs
    for (const e of [-1, 1]) {
      P.ext(M.white, e * hl - 0.24, e * hl + 0.24, 4.0, H + 0.1, -hw - 0.2, hw + 0.2, 0.12);
      for (const s of [-1, 1]) P.ext(M.white, e * hl - 0.22, e * hl + 0.22, 0.08, 4.1, Math.min(s * 2.4, s * (hw + 0.2)), Math.max(s * 2.4, s * (hw + 0.2)), 0.1);
      P.ext(M.blue, e * hl - 0.25, e * hl + 0.25, 3.82, 4.02, -2.4, 2.4, 0.05);
      // the name on a blue plate over each door
      P.ext(M.blue, e * (hl + 0.22) - 0.05, e * (hl + 0.22) + 0.05, 4.32, 5.3, -2.3, 2.3, 0.04);
      const tex = signTex(`PAINT ${number}`, 'Topcoat · clearcoat', {});
      P.print(decalMat(tex), 3.9, 0.975, e * (hl + 0.275), 4.81, 0, e > 0 ? PI / 2 : -PI / 2);
    }
    // the ceiling: glass between white ribs (the camera looks in from above), the air duct along the far edge only
    P.ext(M.panel, -hl + 0.3, hl - 0.3, H + 0.02, H + 0.42, hw - 0.8, hw - 0.12, 0.15);
    for (let k = 1; k < 4; k++) P.ext(M.white, -hl + (L * k) / 4 - 0.12, -hl + (L * k) / 4 + 0.12, H - 0.05, H + 0.2, -hw + 0.2, hw - 0.2, 0.06);
    // glass: the side walls and the skylight
    for (let k = 0; k < 4; k++) {
      const x0 = -hl + (L * k) / 4 + 0.2;
      const x1 = -hl + (L * (k + 1)) / 4 - 0.2;
      for (const s of [-1, 1]) P.ext(M.pane, x0, x1, 0.7, H - 0.55, s * hw - 0.04, s * hw + 0.04, 0.02);
      P.ext(M.paneRoof, x0, x1, H + 0.02, H + 0.07, -hw + 0.2, hw - 0.82, 0.02);
    }
    // the exhaust units on the duct
    for (const x of [-4.5, 0, 4.5]) P.drum(M.white, 0.36, 0.34, x, H + 0.55, hw - 0.46, 'y', 0.1, 32);
  }, group);
  // the conveyor through the booth
  const conv = buildToyRollerConveyor({length: L + 2});
  group.add(conv.group);
  // roll-up doors at both ends: blue-tinted slats that lift into the header
  const doors = [-1, 1].map((e) => {
    const d = new THREE.Group();
    d.position.x = e * (hl + 0.05);
    tpl('booth|door', (P) => {
      for (let k = 0; k < 8; k++) P.ext(M.blueLight, -0.05, 0.05, 0.12 + k * 0.47, 0.12 + k * 0.47 + 0.42, -2.35, 2.35, 0.03);
    }, d);
    group.add(d);
    return d;
  });
  const setDoors = (k) => {
    for (const d of doors) {
      d.position.y = 3.5 * smooth(k);
      d.scale.y = 1 - 0.8 * smooth(k);
      d.visible = k < 0.999;
    }
  };
  setDoors(0);
  // 2 robot mounts on the platforms, staggered, facing the car
  const slots = [
    [3.2, -1],
    [-3.2, 1],
  ].map(([x, s]) => {
    const o = new THREE.Object3D();
    o.position.set(x, 0.5, s * (hw - 0.95));
    o.rotation.y = s > 0 ? PI / 2 : -PI / 2;
    group.add(o);
    return o;
  });
  return {group, length: L, width: W, setDoors, slots, conveyor: conv};
}

// ================================================================ the QA rolling road
const TUNNEL_X = [-3.2, -1.6, 0, 1.6, 3.2];
/** a portal in the z-y plane: two posts and a beam, generous radii inside and out */
const portalShape = () =>
  roundedPoly([V2(-2.35, 0), V2(-2.05, 0), V2(-2.05, 3.4), V2(2.05, 3.4), V2(2.05, 0), V2(2.35, 0), V2(2.35, 3.72), V2(-2.35, 3.72)], [0.03, 0.03, 0.55, 0.55, 0.03, 0.03, 0.8, 0.8]);
/** a light band down the middle of a portal's face */
const portalBandShape = () =>
  roundedPoly([V2(-2.25, 0.55), V2(-2.15, 0.55), V2(-2.15, 3.51), V2(2.15, 3.51), V2(2.15, 0.55), V2(2.25, 0.55), V2(2.25, 3.61), V2(-2.25, 3.61)], [0.02, 0.02, 0.62, 0.62, 0.02, 0.02, 0.72, 0.72]);
/** the light strip along a portal's inner edge */
const portalLightShape = () =>
  roundedPoly([V2(-2.07, 0.5), V2(-1.97, 0.5), V2(-1.97, 3.3), V2(1.97, 3.3), V2(1.97, 0.5), V2(2.07, 0.5), V2(2.07, 3.42), V2(-2.07, 3.42)], [0.02, 0.02, 0.47, 0.47, 0.02, 0.02, 0.57, 0.57]);
export function buildToyDyno() {
  const M = mats();
  const group = new THREE.Group();
  const deck = 0.3;
  tpl('dyno', (P) => {
    // the deck with ramps at both ends, hazard edges along the sides
    P.ext(M.white, -3.4, 3.4, 0, deck, -2.0, 2.0, 0.1);
    for (const e of [-1, 1]) P.add(M.white, extrude('ramp', () => roundedPoly([V2(0, 0), V2(1.6, 0), V2(0, deck)], [0.02, 0.05, 0.05]), 3.4, 0.04), e * 3.38, 0, 0, 0, e > 0 ? 0 : PI, 0);
    for (const s of [-1, 1]) P.hazard(-3.3, 3.3, deck - 0.02, deck + 0.01, s * 1.95 - 0.04, s * 1.95 + 0.04);
    // the roller pits (dark) under the wheels
    for (const x of [CAR.wheelX, -CAR.wheelX]) P.ext(M.ink, x - 0.55, x + 0.55, deck - 0.12, deck + 0.004, -1.5, 1.5, 0.05);
    // the light tunnel: 5 white portals (the light strips go on their inner edge), two blue beams over the top
    for (const x of TUNNEL_X) P.add(M.white, extrude('portal', portalShape, 0.3, 0.07), x, 0, 0, 0, PI / 2, 0);
    for (const z of [-1.25, 1.25]) P.ext(M.blue, -3.45, 3.45, 3.62, 3.86, z - 0.16, z + 0.16, 0.08);
    // the header plates over the exit and the entry, the name printed on both
    for (const e of [-1, 1]) {
      P.ext(M.blue, e * 3.2 - 0.08, e * 3.2 + 0.08, 3.8, 4.5, -1.5, 1.5, 0.07);
      const tex = signTex('QA 01', 'Rolling road · light tunnel', {});
      P.print(decalMat(tex), 2.8, 0.7, e * 3.285, 4.15, 0, e > 0 ? PI / 2 : -PI / 2);
    }
    // the inspection screen on a post
    P.ext(M.white, 3.8, 4.1, 0, 2.1, -2.9, -2.6, 0.08);
    P.ext(M.white, 3.55, 4.35, 1.9, 2.6, -2.95, -2.55, 0.12);
    P.add(decalMat(screenTex()), planeG(0.66, 0.5), 3.95, 2.25, -2.95 - 0.004, 0, PI, 0);
  }, group);
  // the light bars: their own material so setLights can dim them
  const lightMat = new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 0.3, emissive: '#bcd3ff', emissiveIntensity: 1.2, toneMapped: false});
  const lights = new THREE.Group();
  group.add(lights);
  {
    const P = new Parts();
    for (const x of TUNNEL_X) {
      P.add(lightMat, extrude('portallight', portalLightShape, 0.18, 0.02), x, 0, 0, 0, PI / 2, 0);
      for (const e of [-1, 1]) P.add(lightMat, extrude('portalband', portalBandShape, 0.03, 0.008), x + e * 0.15, 0, 0, 0, PI / 2, 0);
    }
    for (const [mat, geo] of P.merged()) {
      const m = new THREE.Mesh(geo, mat);
      m.receiveShadow = true;
      lights.add(m);
    }
  }
  // rollers: two per wheel line, along z, dark with light bands
  const tex = canvasTex('dynoroll', 128, 8, (g, w, h) => {
    g.fillStyle = '#3a4466';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#c8d0e4';
    for (let k = 0; k < 4; k++) g.fillRect((k * w) / 4, 0, w * 0.06, h);
  });
  const rmat = new THREE.MeshStandardMaterial({map: tex, roughness: 0.4, metalness: 0.2});
  const rgeo = cg('dynoroller', () => new THREE.CylinderGeometry(0.16, 0.16, 2.9, 24).rotateX(PI / 2));
  const rollers = [];
  for (const x of [CAR.wheelX, -CAR.wheelX])
    for (const dx of [-0.25, 0.25]) {
      const r = part(rgeo, rmat, group);
      r.position.set(x + dx, deck - 0.1, 0);
      rollers.push(r);
    }
  const setRollers = (a) => {
    for (const r of rollers) r.rotation.z = -a;
  };
  const setLights = (k) => {
    lightMat.emissiveIntensity = 0.05 + 1.15 * sat(k);
    lightMat.color.set(k > 0.3 ? '#ffffff' : '#dfe6f7');
  };
  setLights(1);
  return {group, setRollers, setLights, carY: deck - 0.04};
}
