// The toy construction site's machines: a tracked excavator, a tipper, a concrete mixer truck,
// a bulldozer, a wheel loader, a roller and a flatbed, in exactly the toy airport and car plant kits' look
// (airport-shared/gse.js, style.js, plant-shared/line.js), which matches the reference video
//: toy proportions, generous bevels on every edge, matte paint with a soft
// clearcoat, dark tyres with light hubs and a dark cap, dark glass, crisp printed numbers and logos. Blue cabs and
// chassis, yellow working parts (booms, buckets, blades, beds, the drum with a blue band), like the reference's forklift. Every
// truck cab is the reference's box truck's cab-over cab, to the millimetre. The contractor is the fictional AURORA BUILD.
//
// Toy metres, y up, nose toward +x, the right side is +z, origin on the ground at the machine's centre. Every builder
// returns {group, roll(distance), dims, ...}: roll turns the wheels (and runs the tracks) for that distance.
//
//   buildToyExcavator({number = '07'})
//       -> {group, roll, setSlew(a), setBoom(k), setArm(k), setBucket(k), setPose({slew, boom, arm, bucket}) (radians),
//           reach(worldPoint, {pitch = -PI / 2, slew = true}) -> bool, bucketTip, bucketMouth, setLoad(k), house,
//           angles, dims}
//       9 m long folded (tracks 5.2 m), cab roof 3.4 m, the boom foot 2.0 m up. setBoom(k): 0 down .. 1 up;
//       setArm(k): 0 folded in .. 1 stretched out; setBucket(k): 0 open (dumping) .. 1 curled (carrying).
//       reach() turns the house and poses boom, arm and bucket (analytic IK, elbow up) so the bucket teeth meet the
//       point; pitch is the teeth's direction in the boom plane, from the horizontal away from the machine:
//       -PI/2 digging (teeth down), 0 dumping (mouth down), PI carrying (mouth up). Stateless: same point, same pose.
//       Returns false when the point is out of reach (the arm then stretches toward it). Reaches 7 m out at grade
//       and 5.2 m below the tracks 5 m out. bucketTip: an Object3D at the teeth; bucketMouth: the middle of the
//       bucket's opening (where dumped soil leaves it). setLoad(k): the heap of soil in the bucket, 0 .. 1.
//   buildToyDumpTruck({number = '14'})
//       -> {group, roll, setSteer(a), setTip(k), setLoad(k), bedTop: 3.2, bedSpan: {x0, x1, z}, dims}   9 m
//       setTip(k): the bed tips about its rear hinge, k = 1 is 50 deg; the tailgate swings free. setLoad(k): the soil
//       heap in the bed (it slides toward the tailgate as the bed tips).
//   buildToyMixer({number = '21'})
//       -> {group, roll, setSteer(a), setDrum(angle), setChute(k, swing = 0), setPour(k, {toY = 0, t = 0}),
//           chuteTip, dims}   10 m
//       setDrum(angle): the drum turns about its axis. setChute(k): 0 stowed (swung across the rear, the extension
//       folded on top) .. 1 out (straight back, sloping down, unfolded); swing (rad) aims it sideways when out.
//       setPour(k, {toY, t}): a soft concrete stream from the chute's end that lands at world y = toY (the slab top
//       in a pit is about -3.4), k its thickness, t (seconds) runs the ripples. chuteTip: an Object3D at the lip.
//   buildToyBulldozer({number = '03'})
//       -> {group, roll, setBlade(k), setPush(k), dims}   6 m; setBlade(k): 0 cutting edge on the ground .. 1 raised
//       0.8 m; setPush(k): the soil wave rolling in front of the blade, 0 .. 1.
//   buildToyWheelLoader({number = '05'})
//       -> {group, roll, setSteer(a) (articulation), setLift(k), setBucket(k), setLoad(k), bucketLip, dims}   7 m
//       setLift(k): 0 bucket on the ground .. 1 pin at 4 m; setBucket(k): 0 level .. 1 rolled back, -1 dumping.
//   buildToyRoller({number = '02'}) -> {group, roll, setSteer(a), dims}   5 m, a single-drum roller
//   buildToyFlatbed({load = 'rebar' | 'blocks' | 'pipes' | 'none', number = '09'})
//       -> {group, roll, setSteer(a), deckY, dims}   12 m, the reference's box truck's cab on a flatbed with the load strapped on
//
// Static parts are merged per material and cached per variant, so a second copy only costs draw calls; moving parts
// (wheels, track shoes, the house, boom, arm, bucket, bed, drum, chute, blade) are separate meshes on shared geometry.
// Text uses Inter: build after document.fonts has loaded it (runSim does that before setup).
import * as THREE from 'three';
import {mergeGeometries, mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {TOY, rbox, toyMat} from '../airport-shared/style.js';
import {GSE_COLORS} from '../airport-shared/gse.js';

const PI = Math.PI;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sat = (v) => clamp(v, 0, 1);
const smooth = (v) => {
  const t = sat(v);
  return t * t * (3 - 2 * t);
};
const V2 = (x, y) => new THREE.Vector2(x, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const C = GSE_COLORS;

/** the colours style.js and GSE_COLORS have no entry for: earth, concrete, steel on the site */
export const BUILD_COLORS = {
  yellowDeep: '#e0a02e', // the inner faces of buckets, beds and blades: one step down from TOY.yellow
  soil: '#e2b07c', // loose dug earth: site.js's SITE.sandFloor, so a bucketful matches the pit it came from
  soilDeep: '#d39a62', // the clods, a step under SITE.sandCut
  concrete: '#c6c1b8', // light warm grey, dry (SITE.concrete)
  concreteWet: '#9a958d', // fresh out of the chute (SITE.concreteWet), so the stream matches the slab it lands on
  rebar: '#3b4055', // dark (SITE.rebar)
  track: '#2a2f40', // the track belts
  timber: '#dcb27c', // bearers under the loads (SITE.wood)
  block: '#d8d3ca', // blockwork (SITE.block)
  pipe: '#cdc7bd', // precast concrete pipes, a step lighter than the slab
  bore: '#8f897f', // inside a pipe
  strap: TOY.yellow,
};
const B = BUILD_COLORS;
const L_AURORA = {accent: TOY.blue, deep: TOY.blueDeep, light: TOY.blueLight};

// ================================================================ materials
const paint = (color, rough = 0.5) => toyMat(color, {paint: true, rough});
let MM = null;
function mats() {
  if (MM) return MM;
  const glow = (color, emissive, k, rough = 0.35) => new THREE.MeshStandardMaterial({color, roughness: rough, emissive, emissiveIntensity: k});
  MM = {
    white: paint(TOY.white),
    panel: paint(TOY.panel),
    blue: paint(TOY.blue, 0.48),
    blueDeep: paint(TOY.blueDeep, 0.48),
    blueLight: paint(TOY.blueLight, 0.5),
    yellow: paint(TOY.yellow, 0.5),
    yellowDeep: paint(B.yellowDeep, 0.56),
    ink: toyMat(C.ink, {rough: 0.62}),
    chassis: toyMat(C.chassis, {rough: 0.66}),
    tyre: toyMat(C.tyre, {rough: 0.82}),
    track: toyMat(B.track, {rough: 0.8}),
    hub: toyMat(C.hub, {rough: 0.42}),
    hubCap: toyMat(C.hubCap, {rough: 0.45, metal: 0.1}),
    glass: toyMat(TOY.glass, {paint: true, rough: 0.12}),
    bumper: paint(C.bumper),
    steel: toyMat(C.steel, {rough: 0.42, metal: 0.25}),
    drum: toyMat('#d3d9e8', {rough: 0.36, metal: 0.2}),
    rubber: toyMat('#2a2f40', {rough: 0.85}),
    lamp: glow(C.lamp, '#fff1c8', 0.22, 0.3),
    tail: glow('#f0656a', TOY.red, 0.35, 0.3),
    beacon: glow('#ffb072', '#ff7a1f', 0.9, 0.3),
    soil: toyMat(B.soil, {rough: 0.95}),
    soilDeep: toyMat(B.soilDeep, {rough: 0.95}),
    concrete: toyMat(B.concrete, {rough: 0.85}),
    concreteWet: toyMat(B.concreteWet, {paint: true, rough: 0.3}),
    rebar: toyMat(B.rebar, {rough: 0.6, metal: 0.2}),
    timber: toyMat(B.timber, {rough: 0.85}),
    block: toyMat(B.block, {rough: 0.88}),
    pipe: toyMat(B.pipe, {rough: 0.86}),
    bore: new THREE.MeshStandardMaterial({color: B.bore, roughness: 0.92, side: THREE.BackSide}),
    strap: paint(B.strap, 0.55),
  };
  return MM;
}

// ================================================================ textures, the shared kit (gse.js's, unchanged)
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
/** a printed layer: the texture's alpha is the print, it never casts shadows */
function decalMat(tex, {rough = 0.5, opaque = false} = {}) {
  const key = tex.uuid + rough + opaque;
  if (DECALS.has(key)) return DECALS.get(key);
  const m = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: rough,
    transparent: !opaque,
    depthWrite: opaque,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
  m.userData.noCast = true;
  DECALS.set(key, m);
  return m;
}
const FONT = 'Inter, "Segoe UI", system-ui, sans-serif';

/** the operator marks: aurora = a rounded square with a white sun over a horizon, kestrel = two wing chevrons */
function drawMark(g, kind, x, y, s, L) {
  g.save();
  if (kind === 'aurora') {
    g.fillStyle = L.accent;
    g.beginPath();
    g.roundRect(x, y, s, s, s * 0.26);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.28)';
    g.beginPath();
    g.roundRect(x + s * 0.5, y, s * 0.5, s, [0, s * 0.26, s * 0.26, 0]);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineCap = 'round';
    g.lineWidth = s * 0.1;
    g.beginPath();
    g.arc(x + s * 0.5, y + s * 0.7, s * 0.27, PI * 1.08, PI * 1.92);
    g.stroke();
    g.beginPath();
    g.moveTo(x + s * 0.2, y + s * 0.72);
    g.lineTo(x + s * 0.8, y + s * 0.72);
    g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(x + s * 0.5, y + s * 0.7, s * 0.1, PI, 0);
    g.fill();
  } else if (kind === 'kestrel') {
    const wing = (dx, col) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(x + dx, y + s * 0.78);
      g.lineTo(x + dx + s * 0.32, y + s * 0.22);
      g.lineTo(x + dx + s * 0.5, y + s * 0.5);
      g.lineTo(x + dx + s * 0.68, y + s * 0.22);
      g.lineTo(x + dx + s * 1.0, y + s * 0.78);
      g.lineTo(x + dx + s * 0.82, y + s * 0.78);
      g.lineTo(x + dx + s * 0.68, y + s * 0.52);
      g.lineTo(x + dx + s * 0.5, y + s * 0.82);
      g.lineTo(x + dx + s * 0.32, y + s * 0.52);
      g.lineTo(x + dx + s * 0.18, y + s * 0.78);
      g.closePath();
      g.fill();
    };
    wing(0, L.accent);
    wing(s * 0.24, L.deep);
  } else if (kind === 'cube') {
    // an isometric crate: top light, left accent, right deep
    const cx = x + s / 2;
    const q = s * 0.46;
    g.fillStyle = L.light;
    g.beginPath();
    g.moveTo(cx, y + s * 0.04);
    g.lineTo(cx + q, y + s * 0.27);
    g.lineTo(cx, y + s * 0.5);
    g.lineTo(cx - q, y + s * 0.27);
    g.closePath();
    g.fill();
    g.fillStyle = L.accent;
    g.beginPath();
    g.moveTo(cx - q, y + s * 0.27);
    g.lineTo(cx, y + s * 0.5);
    g.lineTo(cx, y + s * 0.98);
    g.lineTo(cx - q, y + s * 0.74);
    g.closePath();
    g.fill();
    g.fillStyle = L.deep;
    g.beginPath();
    g.moveTo(cx + q, y + s * 0.27);
    g.lineTo(cx, y + s * 0.5);
    g.lineTo(cx, y + s * 0.98);
    g.lineTo(cx + q, y + s * 0.74);
    g.closePath();
    g.fill();
  }
  g.restore();
}

/** a text plate: fg text, optional rounded bg, sized to the text */
function textTex(text, {fg = C.text, bg = null, weight = 800, px = 96, pad = 26} = {}) {
  const key = `txt|${text}|${fg}|${bg}|${weight}|${px}`;
  if (TEX.has(key)) return TEX.get(key);
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `${weight} ${px}px ${FONT}`;
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
    g.font = `${weight} ${px}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, W / 2, H / 2 + px * 0.04);
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
const cylG = (r0, r1, h, seg = 20) => cg(`cy|${r0}|${r1}|${h}|${seg}`, () => new THREE.CylinderGeometry(r0, r1, h, seg));
const sphere = (r) => cg(`sp|${r}`, () => new THREE.SphereGeometry(r, 18, 12));
const dome = (r) => cg(`dome|${r}`, () => new THREE.SphereGeometry(r, 18, 8, 0, PI * 2, 0, PI / 2));
const planeG = (w, h) => cg(`pl|${w.toFixed(3)}|${h.toFixed(3)}`, () => new THREE.PlaneGeometry(w, h));
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
function extrude(key, makeShape, depth, b = 0.12) {
  return cg(`ex|${key}|${depth}|${b}`, () => {
    const g = new THREE.ExtrudeGeometry(makeShape(), {
      depth: Math.max(0.002, depth - 2 * b),
      bevelEnabled: b > 0,
      bevelThickness: b,
      bevelSize: b,
      bevelSegments: 4,
      curveSegments: 20,
    });
    g.translate(0, 0, -(depth - 2 * b) / 2);
    return g;
  });
}
/** a fender: a half ring in the xy plane around the origin, extruded d along z */
const fender = (rIn, rOut, d) =>
  cg(`fd|${rIn}|${rOut}|${d}`, () => {
    const s = new THREE.Shape();
    s.absarc(0, 0, rOut, 0.05, PI - 0.05, false);
    s.absarc(0, 0, rIn, PI - 0.05, 0.05, true);
    const b = Math.min(0.05, (rOut - rIn) * 0.3);
    const g = new THREE.ExtrudeGeometry(s, {depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 24});
    g.translate(0, 0, -(d - 2 * b) / 2);
    return g;
  });

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
    // either order: the -z twin of a +z part often comes in as (s * a, s * b) with a < b
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (y1 < y0) [y0, y1] = [y1, y0];
    if (z1 < z0) [z0, z1] = [z1, z0];
    return this.add(mat, rb(x1 - x0, y1 - y0, z1 - z0, r), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  }
  /** the same box on both sides, z0..z1 and -z1..-z0 */
  pair(mat, x0, x1, y0, y1, z0, z1, r) {
    this.ext(mat, x0, x1, y0, y1, z0, z1, r);
    return this.ext(mat, x0, x1, y0, y1, -z1, -z0, r);
  }
  /** a cylinder along 'x', 'y' or 'z' */
  cyl(mat, r0, r1, h, x, y, z, axis = 'y', seg = 20) {
    const g = cylG(r0, r1, h, seg);
    if (axis === 'x') return this.add(mat, g, x, y, z, 0, 0, -PI / 2);
    if (axis === 'z') return this.add(mat, g, x, y, z, PI / 2, 0, 0);
    return this.add(mat, g, x, y, z);
  }
  /** a round bar between two points */
  rod(mat, a, b, r = 0.05, seg = 10) {
    const A = V3(...a);
    const d = V3(...b).sub(A);
    const len = d.length();
    _q.setFromUnitVectors(V3(0, 1, 0), d.clone().normalize());
    return this.put(mat, cylG(r, r, len, seg), _m.compose(A.addScaledVector(d, 0.5), _q, _s.set(1, 1, 1)));
  }
  /** a square bar with rounded edges between two points (cage posts, rails) */
  bar(mat, a, b, t = 0.12) {
    const A = V3(...a);
    const d = V3(...b).sub(A);
    const len = d.length();
    _q.setFromUnitVectors(V3(0, 1, 0), d.clone().normalize());
    return this.put(mat, rb(t, len + t, t, t * 0.4), _m.compose(A.addScaledVector(d, 0.5), _q, _s.set(1, 1, 1)));
  }
  /** a flat print of width w, height h facing +z, turned by ry */
  print(mat, w, h, x, y, z, ry = 0, rx = 0) {
    return this.add(mat, planeG(w, h), x, y, z, rx, ry, 0);
  }
  /** a text plate of height h, facing +z turned by ry */
  text(text, opts, h, x, y, z, ry = 0) {
    const tex = textTex(text, opts);
    const a = tex.image.width / tex.image.height;
    return this.print(decalMat(tex), h * a, h, x, y, z, ry);
  }
  /** an orange beacon on a dark ring */
  beacon(x, y, z, r = 0.14) {
    const M = mats();
    this.cyl(M.ink, r * 1.05, r * 1.15, r * 0.5, x, y + r * 0.25, z, 'y', 18);
    return this.add(M.beacon, dome(r), x, y + r * 0.5, z);
  }
  merged() {
    return [...this.map].map(([mat, list]) => [mat, mergeGeometries(list, false)]);
  }
}

const TPL = new Map();
/** the static meshes of a model, built once per key and shared between copies */
function tpl(key, make, parent = new THREE.Group()) {
  let list = TPL.get(key);
  if (!list) {
    const P = new Parts();
    make(P);
    list = P.merged();
    TPL.set(key, list);
  }
  for (const [mat, geo] of list) {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = !mat.userData.noCast && !mat.transparent;
    m.receiveShadow = true;
    parent.add(m);
  }
  return parent;
}
const part = (geo, mat, parent) => {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = !mat.transparent;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
};

// ================================================================ wheels
/** a chunky tyre with round shoulders, axis along z */
function tyreGeo(r, w) {
  return cg(`tyre|${r}|${w}`, () => {
    const ri = r * 0.54;
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
/** the light hub disc with a stepped centre, both faces */
function hubGeo(r, w) {
  return cg(`hub|${r}|${w}`, () => {
    const P = new Parts();
    const ri = r * 0.54;
    P.cyl(null, ri + 0.004, ri + 0.004, w * 0.76, 0, 0, 0, 'z', 36);
    P.cyl(null, ri * 0.8, ri * 0.86, w * 0.84, 0, 0, 0, 'z', 32);
    return mergeGeometries(P.map.get(null), false);
  });
}
/** the dark cap and 5 nuts, so a turning wheel reads as turning */
function capGeo(r, w) {
  return cg(`cap|${r}|${w}`, () => {
    const P = new Parts();
    const ri = r * 0.54;
    P.cyl(null, ri * 0.3, ri * 0.3, w * 0.9, 0, 0, 0, 'z', 24);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * PI * 2;
      P.cyl(null, ri * 0.075, ri * 0.075, w * 0.88, Math.cos(a) * ri * 0.55, Math.sin(a) * ri * 0.55, 0, 'z', 8);
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
/** a pair of wheels at x, +-z; steer = true puts each on a pivot */
function axle(parent, list, r, w, x, z, steer = null) {
  for (const sz of [-1, 1]) {
    const wh = makeWheel(r, w);
    if (steer) {
      const pivot = new THREE.Group();
      pivot.position.set(x, r, sz * z);
      pivot.add(wh);
      parent.add(pivot);
      steer.push(pivot);
    } else {
      wh.position.set(x, r, sz * z);
      parent.add(wh);
    }
    list.push(wh);
  }
}
const roller = (wheels) => (d) => {
  for (const w of wheels) w.rotation.z = -d / w.userData.r;
};
const steerer = (pivots) => (a) => {
  for (const p of pivots) p.rotation.y = a;
};

/** a bar mesh (unit length along x) placed from a to b in its parent's frame */
const _d = new THREE.Vector3();
function placeBar(m, ax, ay, az, bx, by, bz, stretch = true) {
  _d.set(bx - ax, by - ay, bz - az);
  const len = _d.length();
  m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  m.quaternion.setFromUnitVectors(V3(1, 0, 0), _d.normalize());
  if (stretch) m.scale.set(len, 1, 1);
}
/** a bar of unit length along x with a rounded-rectangle section t (y) by d (z), safe to stretch along x */
const barGeo = (t, d, r = Math.min(t, d) * 0.35) =>
  cg(`bar|${t}|${d}|${r}`, () => {
    const s = roundedPoly([V2(-d / 2, -t / 2), V2(d / 2, -t / 2), V2(d / 2, t / 2), V2(-d / 2, t / 2)], r);
    const g = new THREE.ExtrudeGeometry(s, {depth: 1, bevelEnabled: false, curveSegments: 6});
    g.rotateY(PI / 2);
    g.translate(-0.5, 0, 0);
    return g;
  });


/** a hydraulic ram between two points in parent's frame: dark barrel + steel rod; returns set(a, b) */
function ram(parent, rBarrel = 0.1, lBarrel = 1.2) {
  const M = mats();
  const barrel = part(cg(`ramb|${rBarrel}|${lBarrel}`, () => new THREE.CylinderGeometry(rBarrel, rBarrel, lBarrel, 14).rotateZ(-PI / 2).translate(lBarrel / 2, 0, 0)), M.ink, parent);
  const rod = part(cg(`ramr|${rBarrel}`, () => new THREE.CylinderGeometry(rBarrel * 0.55, rBarrel * 0.55, 1, 12).rotateZ(-PI / 2).translate(0.5, 0, 0)), M.steel, parent);
  return (a, b) => {
    _d.subVectors(b, a);
    const len = _d.length();
    _d.normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(V3(1, 0, 0), _d);
    barrel.position.copy(a);
    barrel.quaternion.copy(q);
    rod.position.copy(b);
    rod.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), PI));
    rod.scale.set(Math.max(0.05, len - lBarrel * 0.6), 1, 1);
  };
}

// ================================================================ the cab-over cab (box, catering, fuel, stairs)
/**
 * The reference's truck cab: a chunky rounded box over the front axle, a big dark windshield, a dark side window close to the
 * front corner, a dark grille with light slats, cream lamps at the lower corners, a light bumper, black mirrors.
 */
function cab(P, {x0, x1, y0 = 0.62, top, W, color, wheelX, wheelR, stripe = null, seam}) {
  const M = mats();
  const b = 0.17;
  const key = [x0, x1, y0, top, W, wheelX, wheelR].join('|');
  P.add(paint(color, 0.46), extrude(`cab|${key}`, () => profile(x0, x1, y0, top, {arches: [[wheelX, wheelR, wheelR + 0.15]], rc: [0.14, 0.34, 0.44, 0.34]}, b), W, b));
  const hw = W / 2;
  const H = top - y0;
  // the reference's proportions, top down: a blue band, a big windshield (a third of the cab), a band, the grille, the bumper
  const wt = Math.min(top - 0.12 * H, top - 0.46);
  const wb = top - 0.5 * H;
  // windshield and side windows
  P.ext(M.glass, x1 - 0.08, x1 + 0.035, wb, wt, -hw + 0.27, hw - 0.27, 0.05);
  for (const s of [-1, 1]) {
    P.ext(M.glass, x1 - Math.min(1.62, (x1 - x0) * 0.56), x1 - 0.34, wb, wt, s > 0 ? hw - 0.06 : -hw - 0.035, s > 0 ? hw + 0.035 : -hw + 0.06, 0.05);
    // door seam and handle
    P.ext(paint(seam), x1 - Math.min(1.8, (x1 - x0) * 0.62), x1 - Math.min(1.76, (x1 - x0) * 0.62) + 0.04, y0 + 0.85, top - 0.3, s > 0 ? hw - 0.02 : -hw - 0.012, s > 0 ? hw + 0.012 : -hw + 0.02, 0.008);
    P.ext(M.ink, x1 - 1.45, x1 - 1.15, wb - 0.3, wb - 0.22, s > 0 ? hw - 0.02 : -hw - 0.04, s > 0 ? hw + 0.04 : -hw + 0.02, 0.02);
    // the mirror on its arm, level with the windshield
    P.bar(M.ink, [x1 - 0.2, wt - 0.25, s * (hw - 0.05)], [x1 - 0.05, wt - 0.25, s * (hw + 0.36)], 0.07);
    P.ext(M.ink, x1 - 0.12, x1 + 0.02, wt - 0.95, wt - 0.12, s * (hw + 0.32) - 0.1, s * (hw + 0.32) + 0.1, 0.05);
    if (stripe) P.ext(paint(stripe, 0.46), x0 + 0.22, x1 - 0.3, wb - 0.55, wb - 0.33, s > 0 ? hw - 0.02 : -hw - 0.02, s > 0 ? hw + 0.02 : -hw + 0.02, 0.01);
  }
  // grille with slats, lamps, bumper
  const gb = y0 + 0.18 * H;
  const gt = wb - 0.07 * H;
  P.ext(M.ink, x1 - 0.06, x1 + 0.04, gb, gt, -0.92, 0.92, 0.06);
  const n = 5;
  for (let k = 0; k < n; k++) P.ext(M.bumper, x1 + 0.01, x1 + 0.065, gb + ((gt - gb) * (k + 0.55)) / (n + 0.1) - 0.03, gb + ((gt - gb) * (k + 0.55)) / (n + 0.1) + 0.03, -0.8, 0.8, 0.02);
  for (const s of [-1, 1]) P.ext(M.lamp, x1 - 0.05, x1 + 0.045, gb, gb + 0.1 * H, s > 0 ? hw - 0.62 : -hw + 0.2, s > 0 ? hw - 0.2 : -hw + 0.62, 0.06);
  P.ext(M.bumper, x1 - 0.3, x1 + 0.28, y0 - 0.06, y0 + 0.56, -hw - 0.08, hw + 0.08, 0.2);
}

// ================================================================ the kit, extended for the site
/** a soft-edged cylinder (lathe with rounded rims), axis y, centred */
function rcylG(r0, r1, h, b = 0.06, seg = 28) {
  return cg(`rcyl|${r0}|${r1}|${h}|${b}|${seg}`, () => {
    const bb = Math.min(b, h / 2 - 1e-3, Math.min(r0, r1) - 1e-3);
    const pts = [V2(1e-4, -h / 2)];
    const arc = (cx, cy, a0, a1) => {
      for (let k = 0; k <= 4; k++) {
        const a = lerp(a0, a1, k / 4);
        pts.push(V2(cx + bb * Math.cos(a), cy + bb * Math.sin(a)));
      }
    };
    arc(r0 - bb, -h / 2 + bb, -PI / 2, 0);
    arc(r1 - bb, h / 2 - bb, 0, PI / 2);
    pts.push(V2(1e-4, h / 2));
    return new THREE.LatheGeometry(pts, seg);
  });
}
/** a soft-edged cylinder along 'x', 'y' or 'z' */
Parts.prototype.rcyl = function (mat, r0, r1, h, x, y, z, axis = 'y', b = 0.06, seg = 28) {
  const g = rcylG(r0, r1, h, b, seg);
  if (axis === 'x') return this.add(mat, g, x, y, z, 0, 0, -PI / 2);
  if (axis === 'z') return this.add(mat, g, x, y, z, PI / 2, 0, 0);
  return this.add(mat, g, x, y, z);
};
/** a pin through a joint: a soft steel cylinder along z with dark caps */
Parts.prototype.pin = function (x, y, z, r, len) {
  const M = mats();
  this.rcyl(M.steel, r, r, len, x, y, z, 'z', r * 0.3, 20);
  return this;
};
/** a static wheel (tyre, hub, cap) merged into P at x, y, z with its axis turned by rx, ry */
function wheelInto(P, r, w, x, y, z, rx = 0, ry = 0, rz = 0) {
  const M = mats();
  P.add(M.tyre, tyreGeo(r, w), x, y, z, rx, ry, rz);
  P.add(M.hub, hubGeo(r, w), x, y, z, rx, ry, rz);
  P.add(M.hubCap, capGeo(r, w), x, y, z, rx, ry, rz);
}
/** a shape drawn in the ground plane (shape x = x, shape y = -z) extruded h up, centred on y = 0 */
function extrudeY(key, makeShape, h, b = 0.12) {
  return cg(`exy|${key}|${h}|${b}`, () => extrude(`xy|${key}`, makeShape, h, b).clone().rotateX(-PI / 2));
}
/** a shape drawn in the yz plane (shape x = -z, shape y = y) extruded along x from 0 to -len */
function extrudeX(key, makeShape, len, b = 0.04) {
  return cg(`exx|${key}|${len}|${b}`, () => extrude(`yz|${key}`, makeShape, len, b).clone().rotateY(PI / 2).translate(-len / 2, 0, 0));
}

/** a lump of soil: a squashed lumpy sphere of radius 1, flat underneath, deterministic per seed */
function lumpGeo(seed = 1, {flat = 0.15, rough = 0.16, detail = 3} = {}) {
  return cg(`lump|${seed}|${flat}|${rough}|${detail}`, () => {
    let g = new THREE.IcosahedronGeometry(1, detail);
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    g = mergeVertices(g);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    const s = seed * 1.731;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n =
        Math.sin(v.x * 3.1 + s) * Math.sin(v.y * 2.7 + s * 0.7) * Math.sin(v.z * 3.3 + s * 1.3) * 0.6 +
        Math.sin(v.x * 6.3 - s * 0.4 + v.z * 4.1) * 0.25 +
        Math.sin(v.z * 7.7 + v.y * 5.3 + s) * 0.15;
      v.multiplyScalar(1 + rough * n);
      if (v.y < 0) v.y *= flat;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(p.count * 2), 2));
    return g;
  });
}
/** a soil heap: one big lump and a few clods, as a Group of meshes, origin at its base centre, footprint 2 x 2, 1 tall */
function heap(key, {clods = 5, seed = 1} = {}) {
  const M = mats();
  return tpl(`heap|${key}`, (P) => {
    P.add(M.soil, lumpGeo(seed), 0, 0, 0, 0, 0, 0, 1, 1, 1);
    for (let i = 0; i < clods; i++) {
      const a = seed * 2.4 + i * 2.39996;
      const r = 0.35 + 0.45 * ((i * 0.618 + seed * 0.37) % 1);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const top = Math.sqrt(Math.max(0, 1 - r * r)) * 0.92;
      const s = 0.13 + 0.08 * ((i * 0.43 + seed) % 1);
      P.add(i % 2 ? M.soilDeep : M.soil, lumpGeo(seed + i + 3, {flat: 0.6, rough: 0.26, detail: 2}), x, top, z, 0, a, 0, s, s * 0.8, s);
    }
  });
}

// ================================================================ prints: the AURORA BUILD mark and wordmark
/** the wordmark: mark + AURORA (heavy) + BUILD (light), on a transparent canvas; fg = text colour */
function brandTex({fg = C.text, sub = null, markBg = null} = {}) {
  const key = `brand|${fg}|${sub}|${markBg}`;
  if (TEX.has(key)) return TEX.get(key);
  const H = 256;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `800 ${H * 0.46}px ${FONT}`;
  const w1 = probe.measureText('AURORA').width;
  probe.font = `500 ${H * 0.46}px ${FONT}`;
  const w2 = probe.measureText('BUILD').width;
  const ms = H * 0.74;
  const W = Math.ceil(ms + H * 0.16 + w1 + H * 0.12 + w2 + 24);
  return canvasTex(key, W, H, (g) => {
    const y0 = (H - ms) / 2 - (sub ? H * 0.08 : 0);
    if (markBg) {
      g.fillStyle = markBg;
      g.beginPath();
      g.roundRect(8, y0 - ms * 0.06, ms * 1.12, ms * 1.12, ms * 0.3);
      g.fill();
      drawMark(g, 'aurora', 8 + ms * 0.06, y0, ms, L_AURORA);
    } else drawMark(g, 'aurora', 8, y0, ms, L_AURORA);
    g.fillStyle = fg;
    g.textBaseline = 'middle';
    const tx = 8 + ms + H * 0.16;
    const ty = H / 2 + H * 0.02 - (sub ? H * 0.1 : 0);
    g.font = `800 ${H * 0.46}px ${FONT}`;
    g.fillText('AURORA', tx, ty);
    g.font = `500 ${H * 0.46}px ${FONT}`;
    g.fillText('BUILD', tx + w1 + H * 0.12, ty);
    if (sub) {
      g.globalAlpha = 0.75;
      g.font = `600 ${H * 0.15}px ${FONT}`;
      g.fillText(sub, tx + 4, H * 0.82);
    }
  });
}
/** the wordmark as a print of height h, facing +z turned by ry */
Parts.prototype.brand = function (opts, h, x, y, z, ry = 0) {
  const tex = brandTex(opts);
  return this.print(decalMat(tex), (h * tex.image.width) / tex.image.height, h, x, y, z, ry);
};
/** a print of text on both sides of a body at +-z (s > 0 faces +z) */
Parts.prototype.sides = function (fn, z) {
  for (const s of [-1, 1]) fn(s, s * z, s > 0 ? 0 : PI);
  return this;
};

// ================================================================ tracks
/** a stadium (two half circles of radius R joined by straights), centred at cx, cy, half straight length a */
function stadium(path, a, R, cx = 0, cy = 0, hole = false) {
  const n = 24;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = -PI / 2 + (PI * i) / n;
    pts.push(V2(cx + a + R * Math.cos(t), cy + R * Math.sin(t)));
  }
  for (let i = 0; i <= n; i++) {
    const t = PI / 2 + (PI * i) / n;
    pts.push(V2(cx - a + R * Math.cos(t), cy + R * Math.sin(t)));
  }
  if (hole) pts.reverse();
  path.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) path.lineTo(pts[i].x, pts[i].y);
  path.closePath();
  return path;
}
/** the point and tangent angle at arc length s along a stadium loop (bottom run first, moving +x) */
function stadiumAt(s, a, R, cy) {
  const P = 4 * a + 2 * PI * R;
  s = ((s % P) + P) % P;
  if (s < 2 * a) return [-a + s, cy - R, 0];
  s -= 2 * a;
  if (s < PI * R) {
    const t = -PI / 2 + s / R;
    return [a + R * Math.cos(t), cy + R * Math.sin(t), t + PI / 2];
  }
  s -= PI * R;
  if (s < 2 * a) return [a - s, cy + R, PI];
  s -= 2 * a;
  const t = PI / 2 + s / R;
  return [-a + R * Math.cos(t), cy + R * Math.sin(t), t + PI / 2];
}
/** the static half of a crawler track along x at z = zc, L long, H tall, w wide: the belt, the frame, the rollers */
function trackStatic(P, {L, H, w, zc, frame = null}) {
  const M = mats();
  const R = H / 2;
  const a = L / 2 - R;
  const t = 0.15;
  // the belt: a thick stadium ring
  const belt = cg(`belt|${L}|${H}|${w}`, () => {
    const s = stadium(new THREE.Shape(), a, R - 0.035, 0, R);
    s.holes.push(stadium(new THREE.Path(), a, R - t, 0, R, true));
    const g = new THREE.ExtrudeGeometry(s, {depth: w - 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.035, bevelSegments: 3, curveSegments: 8});
    g.translate(0, 0, -(w - 0.08) / 2);
    return g;
  });
  P.add(M.track, belt, 0, 0, zc);
  // the frame plate inside the loop, and the roller discs on it (both faces)
  const fr = cg(`trackframe|${L}|${H}|${w}`, () => {
    const s = stadium(new THREE.Shape(), a - 0.05, R - t - 0.05, 0, R);
    const g = new THREE.ExtrudeGeometry(s, {depth: w * 0.62, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3, curveSegments: 8});
    g.translate(0, 0, -(w * 0.62) / 2);
    return g;
  });
  P.add(frame ?? M.blueDeep, fr, 0, 0, zc);
  const rr = Math.min(0.17, (H - 2 * t) * 0.2);
  const n = Math.max(2, Math.round((2 * a - 2 * R) / 0.62));
  for (let i = 0; i < n; i++) {
    const x = lerp(-a + R * 0.75, a - R * 0.75, n === 1 ? 0.5 : i / (n - 1));
    P.add(M.hub, hubGeo(rr / 0.54, w * 0.85), x, t + rr + 0.01, zc);
    P.add(M.hubCap, cylG(rr * 0.4, rr * 0.4, w * 0.9, 12), x, t + rr + 0.01, zc, PI / 2, 0, 0);
  }
}
/** the moving half: the shoes (instanced, they run round the loop), the idler and the sprocket; returns roll(d) */
function trackMoving(parent, {L, H, w, zc}) {
  const M = mats();
  const R = H / 2;
  const a = L / 2 - R;
  const t = 0.15;
  const per = 4 * a + 2 * PI * (R - 0.035);
  const count = Math.round(per / 0.34);
  const step = per / count;
  const shoe = new THREE.InstancedMesh(rbox(0.19, 0.075, w + 0.03, 0.03, 1), M.track, count);
  shoe.castShadow = shoe.receiveShadow = true;
  parent.add(shoe);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const ax = V3(0, 0, 1);
  const pos = V3(0, 0, 0);
  const one = V3(1, 1, 1);
  // the idler (front) and the sprocket (rear): big light discs that turn
  const wr = R - t - 0.02;
  const wheels = [];
  for (const x of [a, -a]) {
    const g = new THREE.Group();
    part(hubGeo(wr / 0.54, w * 0.86), M.hub, g);
    part(capGeo(wr / 0.54, w * 0.86), M.hubCap, g);
    g.position.set(x, R, zc);
    g.userData.r = R;
    parent.add(g);
    wheels.push(g);
  }
  const roll = (d) => {
    for (let i = 0; i < count; i++) {
      const [x, y, ang] = stadiumAt(i * step - d, a, R - 0.035, R);
      // a shoe's thickness lies along the loop's outward normal (sin, -cos), a little proud of the belt
      pos.set(x + Math.sin(ang) * 0.012, y - Math.cos(ang) * 0.012, zc);
      q.setFromAxisAngle(ax, ang);
      m4.compose(pos, q, one);
      shoe.setMatrixAt(i, m4);
    }
    shoe.instanceMatrix.needsUpdate = true;
    for (const w of wheels) w.rotation.z = -d / w.userData.r;
  };
  roll(0);
  return roll;
}

// ================================================================ the excavator
/** the excavator's arm geometry, toy metres: boom foot in the house frame, link lengths, joint limits (radians) */
export const EXCAVATOR = {
  slewY: 1.24, // the house sits on the slew ring here
  foot: [1.08, 0.78], // the boom foot pin in the house frame (x, y); y + slewY = 2.02 above the ground
  zb: 0.42, // the boom's plane, right of the centre (the cab is on the left)
  Lb: 4.9, // boom foot -> arm pin
  La: 2.75, // arm pin -> bucket pin
  Lk: 1.32, // bucket pin -> teeth
  boom: [-0.84, 1.25],
  arm: [-2.7, -0.42],
  bucket: [-2.4, 1.3],
};
const EX = EXCAVATOR;

/** the boom: a banana bent at the knee; chord from the foot (0, 0) to the arm pin (Lb, 0) */
function boomShape() {
  const Lb = EX.Lb;
  const P0 = V2(0, 0);
  const K = V2(2.05, 0.92);
  const P1 = V2(Lb, 0);
  const n0 = K.clone().sub(P0).normalize();
  const n1 = P1.clone().sub(K).normalize();
  const perp = (v) => V2(-v.y, v.x);
  const nk = perp(n0).add(perp(n1)).normalize();
  const h0 = 0.76;
  const hk = 0.96;
  const h1 = 0.64;
  const pts = [
    P0.clone().addScaledVector(n0, -0.38).addScaledVector(perp(n0), -h0 / 2),
    K.clone().addScaledVector(nk, -hk / 2),
    P1.clone().addScaledVector(n1, 0.34).addScaledVector(perp(n1), -h1 / 2),
    P1.clone().addScaledVector(n1, 0.34).addScaledVector(perp(n1), h1 / 2),
    K.clone().addScaledVector(nk, hk / 2 + 0.06),
    P0.clone().addScaledVector(n0, -0.38).addScaledVector(perp(n0), h0 / 2),
  ];
  return roundedPoly(pts, [0.3, 1.1, 0.26, 0.26, 1.3, 0.3]);
}
/** the arm (stick): chord from its pin (0, 0) to the bucket pin (La, 0), the ram lever behind the pin on top */
function armShape() {
  const La = EX.La;
  return roundedPoly([V2(-0.88, 0.54), V2(-0.5, 0.7), V2(0.5, 0.42), V2(La + 0.24, 0.23), V2(La + 0.24, -0.23), V2(0.4, -0.4), V2(-0.4, -0.37), V2(-0.92, 0.12)], [0.16, 0.22, 0.4, 0.18, 0.18, 0.3, 0.26, 0.16]);
}
/** the bucket's shell: a thick C round the back (+y) and the top; pin at (0, 0) behind it, teeth at (1.34, 0), mouth toward -y */
const BK_OUT = [V2(0.51, -0.54), V2(0.07, -0.18), V2(0.08, 0.32), V2(0.65, 0.59), V2(1.14, 0.4), V2(1.34, 0.0)];
const BK_IN = [V2(1.17, 0.03), V2(1.0, 0.27), V2(0.63, 0.45), V2(0.22, 0.22), V2(0.2, -0.1), V2(0.55, -0.41)];
function bucketShell() {
  return roundedPoly([...BK_OUT, ...BK_IN], [0.06, 0.16, 0.26, 0.42, 0.28, 0.04, 0.04, 0.28, 0.38, 0.18, 0.12, 0.06]);
}
/** the bucket's side plate: the whole D (shell + cavity) */
function bucketSide() {
  return roundedPoly(BK_OUT, [0.06, 0.16, 0.26, 0.42, 0.28, 0.04]);
}

export function buildToyExcavator({number = '07'} = {}) {
  const M = mats();
  const group = new THREE.Group();
  group.name = 'excavator';
  const TL = 5.2;
  const TH = 1.12;
  const TW = 0.82;
  const TZ = 1.32;
  const TRK = (s) => ({L: TL, H: TH, w: TW, zc: s * TZ});
  // ---- the undercarriage: 2 tracks, the car body between them, the slew ring
  tpl('ex-under', (P) => {
    for (const s of [-1, 1]) trackStatic(P, TRK(s));
    P.ext(M.chassis, -1.45, 1.45, 0.42, 0.98, -1.0, 1.0, 0.18);
    P.ext(M.blueDeep, -0.7, 0.7, 0.78, 1.04, -0.98, 0.98, 0.12);
    P.rcyl(M.ink, 1.12, 1.12, 0.22, 0, EX.slewY - 0.11, 0, 'y', 0.06, 40);
  }, group);
  const rolls = [-1, 1].map((s) => trackMoving(group, TRK(s)));

  // ---- the house: turns on the slew ring
  const house = new THREE.Group();
  house.position.y = EX.slewY;
  group.add(house);
  const [fx, fy] = EX.foot;
  const zb = EX.zb;
  tpl(`ex-house|${number}`, (P) => {
    // the deck
    P.add(M.blue, extrudeY('ex-deck', () => roundedPoly([V2(-2.62, -1.62), V2(1.5, -1.62), V2(1.5, 1.62), V2(-2.62, 1.62)], [0.9, 0.2, 0.2, 0.9]), 0.34, 0.1), 0, 0.17, 0);
    // the engine hood behind the cab and the boom
    P.add(M.blue, extrudeY('ex-hood', () => roundedPoly([V2(-2.0, -1.52), V2(-0.46, -1.52), V2(-0.46, 1.52), V2(-2.0, 1.52)], [0.3, 0.14, 0.14, 0.3]), 0.95, 0.16), 0, 0.3 + 0.475, 0);
    // the counterweight: a heavy rounded block at the rear, the reference's forklift's yellow
    P.add(M.yellow, extrudeY('ex-cw', () => roundedPoly([V2(-2.72, -1.6), V2(-1.6, -1.6), V2(-1.6, 1.6), V2(-2.72, 1.6)], [0.9, 0.14, 0.14, 0.9]), 1.2, 0.2), 0, 0.3 + 0.6, 0);
    // engine louvres on the hood top, the exhaust
    for (let i = 0; i < 4; i++) P.ext(M.ink, -1.4 + i * 0.24, -1.28 + i * 0.24, 1.24, 1.27, 0.2, 1.2, 0.012);
    P.rcyl(M.steel, 0.1, 0.1, 0.55, -0.85, 1.5, -1.0, 'y', 0.03, 16);
    P.rcyl(M.ink, 0.13, 0.13, 0.14, -0.85, 1.27, -1.0, 'y', 0.03, 16);
    // the tool box / tank cover right of the boom
    P.ext(M.blue, -0.6, 1.42, 0.3, 1.16, 0.92, 1.56, 0.16);
    P.ext(M.blueLight, -0.45, 1.2, 1.15, 1.19, 1.0, 1.48, 0.02);
    // the boom foot brackets either side of the boom
    for (const dz of [-0.48, 0.48]) P.ext(M.blueDeep, 0.55, 1.5, 0.3, 1.12, zb + dz - 0.1, zb + dz + 0.1, 0.06);
    P.pin(fx, fy, zb, 0.13, 1.18);
    // the boom rams' feet
    for (const dz of [-0.5, 0.5]) P.ext(M.blueDeep, 1.15, 1.62, 0.12, 0.5, zb + dz - 0.09, zb + dz + 0.09, 0.05);
    // the cab, on the left: a rounded box, mostly glass
    const cz0 = -1.56;
    const cz1 = -0.3;
    const cx0 = -0.55;
    const cx1 = 1.42;
    const cy0 = 0.3;
    const cy1 = 2.16;
    const cw = cz1 - cz0;
    const cab = extrude('ex-cab', () => profile(cx0, cx1, cy0, cy1, {rc: [0.08, 0.1, 0.42, 0.26]}, 0.14), cw, 0.14);
    P.add(M.blue, cab, 0, 0, (cz0 + cz1) / 2);
    // the roof, a lighter cap
    P.ext(M.blue, cx0 + 0.04, cx1 - 0.22, cy1 - 0.08, cy1 + 0.06, cz0 + 0.06, cz1 - 0.06, 0.07);
    // glass: the front, both sides (two panes on the left), the rear
    P.ext(M.glass, cx1 - 0.06, cx1 + 0.03, cy0 + 0.62, cy1 - 0.28, cz0 + 0.16, cz1 - 0.16, 0.06);
    P.ext(M.glass, cx0 + 0.18, cx1 - 0.66, cy0 + 0.66, cy1 - 0.2, cz0 - 0.035, cz0 + 0.06, 0.06);
    P.ext(M.glass, cx1 - 0.56, cx1 - 0.16, cy0 + 0.66, cy1 - 0.34, cz0 - 0.035, cz0 + 0.06, 0.06);
    P.ext(M.glass, cx0 + 0.18, cx1 - 0.2, cy0 + 0.78, cy1 - 0.24, cz1 - 0.06, cz1 + 0.035, 0.06);
    P.ext(M.glass, cx0 - 0.035, cx0 + 0.06, cy0 + 0.9, cy1 - 0.3, cz0 + 0.2, cz1 - 0.2, 0.06);
    // the door handle, a step, the beacon
    P.ext(M.ink, cx1 - 0.7, cx1 - 0.6, cy0 + 0.48, cy0 + 0.56, cz0 - 0.04, cz0 + 0.02, 0.015);
    P.beacon(cx0 + 0.35, cy1 + 0.06, (cz0 + cz1) / 2, 0.12);
    // the prints: the wordmark on the tool box's side and across the counterweight's back, the fleet number on the hood
    P.brand({fg: C.text}, 0.3, 0.42, 0.74, 1.568, 0);
    P.brand({fg: C.text}, 0.4, -2.73, 0.92, 0, -PI / 2);
    P.text(`EX ${number}`, {fg: TOY.white, px: 110}, 0.3, -1.02, 0.8, 1.522, 0);
    P.text(`EX ${number}`, {fg: TOY.white, px: 110}, 0.3, -1.02, 0.8, -1.522, PI);
  }, house);

  // ---- the boom, the arm, the bucket: a chain of pivots in the boom plane (z = zb)
  const boom = new THREE.Group();
  boom.position.set(fx, fy, zb);
  house.add(boom);
  tpl('ex-boom', (P) => {
    P.add(M.yellow, extrude('ex-boom', boomShape, 0.7, 0.14), 0, 0, 0);
    // a darker seam line along the sides, the arm ram's foot on top of the knee
    P.ext(M.yellowDeep, 1.55, 2.25, 1.15, 1.46, -0.17, 0.17, 0.08);
    P.pin(EX.Lb, 0, 0, 0.12, 0.94);
  }, boom);
  const arm = new THREE.Group();
  arm.position.set(EX.Lb, 0, 0);
  boom.add(arm);
  tpl('ex-arm', (P) => {
    P.add(M.yellow, extrude('ex-arm', armShape, 0.52, 0.12), 0, 0, 0);
    P.pin(EX.La, 0, 0, 0.11, 0.72);
    P.pin(-0.7, 0.42, 0, 0.09, 0.56);
  }, arm);
  const bucket = new THREE.Group();
  bucket.position.set(EX.La, 0, 0);
  arm.add(bucket);
  const BW = 1.24;
  tpl('ex-bucket', (P) => {
    P.add(M.yellow, extrude('ex-bshell', bucketShell, BW - 0.16, 0.06), 0, 0, 0);
    for (const s of [-1, 1]) P.add(M.yellow, extrude('ex-bside', bucketSide, 0.12, 0.045), 0, 0, s * (BW / 2 - 0.06));
    // the cutting edge and 5 teeth along it, pointing out of the mouth
    const ex = EX.Lk - 0.06;
    P.add(M.ink, rb(0.16, 0.12, BW - 0.04, 0.04), ex - 0.04, -0.02, 0, 0, 0, -0.5);
    for (let i = 0; i < 5; i++) {
      const z = lerp(-BW / 2 + 0.18, BW / 2 - 0.18, i / 4);
      P.add(M.ink, rb(0.3, 0.12, 0.14, 0.05), ex + 0.12, -0.08, z, 0, 0, -0.55);
    }
    // the ears: 2 lugs carrying the arm pin and the ram's pin
    for (const s of [-1, 1]) P.ext(M.yellow, -0.17, 0.36, -0.2, 0.56, s * 0.28 - 0.07, s * 0.28 + 0.07, 0.06);
    P.pin(0, 0, 0, 0.1, 0.74);
    P.pin(-0.06, 0.42, 0, 0.08, 0.74);
  }, bucket);
  const load = heap('ex-bucket', {clods: 4, seed: 7});
  bucket.add(load);
  const bucketTip = new THREE.Object3D();
  bucketTip.position.set(EX.Lk + 0.2, -0.12, 0);
  bucket.add(bucketTip);
  const bucketMouth = new THREE.Object3D();
  bucketMouth.position.set(0.92, -0.27, 0);
  bucket.add(bucketMouth);

  // ---- the rams: 2 on the boom, 1 on the arm, 1 on the bucket
  const boomRams = [-0.5, 0.5].map((dz) => ({set: ram(house, 0.13, 1.5), dz}));
  const armRam = ram(boom, 0.12, 1.45);
  const bucketRam = ram(arm, 0.1, 1.25);
  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  const updateRams = () => {
    // boom rams: house (1.38, 0.32) to the boom's underside at 1.85 along the chord
    const ab = boom.rotation.z;
    const bx = fx + Math.cos(ab) * 1.85 - Math.sin(ab) * -0.26;
    const by = fy + Math.sin(ab) * 1.85 + Math.cos(ab) * -0.26;
    for (const r of boomRams) r.set(_a.set(1.4, 0.32, zb + r.dz), _b.set(bx, by, zb + r.dz));
    // arm ram: boom knee top to the arm's lever
    const aa = arm.rotation.z;
    const lx = EX.Lb + Math.cos(aa) * -0.7 - Math.sin(aa) * 0.42;
    const ly = Math.sin(aa) * -0.7 + Math.cos(aa) * 0.42;
    armRam(_a.set(1.95, 1.3, 0), _b.set(lx, ly, 0));
    // bucket ram: the arm's top near its root to the bucket's ear
    const ka = bucket.rotation.z;
    const ex = EX.La + Math.cos(ka) * -0.06 - Math.sin(ka) * 0.42;
    const ey = Math.sin(ka) * -0.06 + Math.cos(ka) * 0.42;
    bucketRam(_a.set(0.15, 0.44, 0), _b.set(ex, ey, 0));
  };

  // ---- the pose
  const angles = {slew: 0, boom: 0.5, arm: -1.9, bucket: -1.2};
  const apply = () => {
    house.rotation.y = angles.slew;
    boom.rotation.z = clamp(angles.boom, ...EX.boom);
    arm.rotation.z = clamp(angles.arm, ...EX.arm);
    bucket.rotation.z = clamp(angles.bucket, ...EX.bucket);
    updateRams();
  };
  const setPose = (p = {}) => {
    Object.assign(angles, p);
    apply();
  };
  const setSlew = (a) => setPose({slew: a});
  const setBoom = (k) => setPose({boom: lerp(EX.boom[0], EX.boom[1], sat(k))});
  const setArm = (k) => setPose({arm: lerp(EX.arm[0], EX.arm[1], sat(k))});
  const setBucket = (k) => setPose({bucket: lerp(EX.bucket[1], EX.bucket[0], sat(k))});
  const setLoad = (k) => {
    load.visible = k > 0.01;
    const s = sat(k);
    // the heap sits in the mouth, its flat base along the mouth line, bulging out of it
    load.position.set(0.88, -0.2 - 0.04 * s, 0);
    load.rotation.set(0, 0, -PI + Math.atan2(0.54, 0.83));
    load.scale.set(0.52 * (0.6 + 0.4 * s), 0.42 * s, 0.56 * (0.6 + 0.4 * s));
  };
  setLoad(0);

  /** IK: pose the house, boom, arm and bucket so the teeth meet a world point */
  const _w = new THREE.Vector3();
  const reach = (point, {pitch = -PI / 2, slew = true} = {}) => {
    group.updateWorldMatrix(true, false);
    _w.copy(point);
    group.worldToLocal(_w);
    let ok = true;
    // slew: put the point in the boom plane (offset zb from the slew axis)
    const r2 = _w.x * _w.x + _w.z * _w.z;
    let sl = angles.slew;
    let x;
    if (slew) {
      x = Math.sqrt(Math.max(1e-6, r2 - zb * zb));
      sl = Math.atan2(-_w.z, _w.x) - Math.atan2(-zb, x);
    } else {
      // the point in the house frame
      const c = Math.cos(sl);
      const s = Math.sin(sl);
      x = _w.x * c - _w.z * s;
    }
    // the bucket teeth sit at (Lk + 0.2, -0.12) in the bucket frame: aim the bucket pin
    const tipR = Math.hypot(EX.Lk + 0.2, 0.12);
    const tipA = Math.atan2(-0.12, EX.Lk + 0.2);
    const wx = x - fx - tipR * Math.cos(pitch);
    const wy = _w.y - EX.slewY - fy - tipR * Math.sin(pitch);
    const d = Math.hypot(wx, wy);
    const L1 = EX.Lb;
    const L2 = EX.La;
    let dd = d;
    if (dd > L1 + L2 - 1e-3) {
      dd = L1 + L2 - 1e-3;
      ok = false;
    }
    if (dd < Math.abs(L1 - L2) + 1e-3) {
      dd = Math.abs(L1 - L2) + 1e-3;
      ok = false;
    }
    const g = Math.acos(clamp((L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd), -1, 1));
    const base = Math.atan2(wy, wx);
    const tb = base + g;
    const ex = L1 * Math.cos(tb);
    const ey = L1 * Math.sin(tb);
    const ta = Math.atan2(wy * (dd / d) - ey, wx * (dd / d) - ex);
    const tk = pitch - tipA - ta;
    const rb0 = tb;
    const ra = ta - tb;
    if (rb0 < EX.boom[0] || rb0 > EX.boom[1] || ra < EX.arm[0] || ra > EX.arm[1]) ok = false;
    let rk = Math.atan2(Math.sin(tk), Math.cos(tk));
    if (rk < EX.bucket[0] || rk > EX.bucket[1]) ok = false;
    setPose({slew: sl, boom: rb0, arm: ra, bucket: rk});
    return ok;
  };
  apply();
  const roll = (d) => {
    for (const r of rolls) r(d);
  };
  return {group, house, roll, setSlew, setBoom, setArm, setBucket, setPose, reach, bucketTip, bucketMouth, setLoad, angles, dims: {length: 9, width: 2 * TZ + TW, cabTop: EX.slewY + 2.22}};
}

// ================================================================ the dump truck
export function buildToyDumpTruck({number = '14'} = {}) {
  const M = mats();
  const group = new THREE.Group();
  group.name = 'dump-truck';
  const W = 3.5;
  const R = 0.75;
  const cx0 = 1.55;
  const cx1 = 4.5;
  const top = 3.72;
  const wheelX = cx1 - 1.65;
  const rearX = [-1.7, -3.17];
  const bx0 = -4.48; // the bed's rear (the hinge)
  const bx1 = 1.32; // its front wall
  const by0 = 1.66; // the bed's underside, clear of the tyres
  const bedTop = 3.2;
  const BW = 3.44;
  tpl(`dump|${number}`, (P) => {
    cab(P, {x0: cx0, x1: cx1, top, W, color: TOY.blue, wheelX, wheelR: R, seam: TOY.blueDeep});
    // the frame, the hinge brackets at the rear, the hoist's cross member
    for (const s of [-1, 1]) P.ext(M.chassis, -4.4, cx0 + 0.6, 0.92, 1.42, s * 0.75 - 0.15, s * 0.75 + 0.15, 0.07);
    for (const x of [-4.1, -2.45, -0.4]) P.ext(M.chassis, x - 0.12, x + 0.12, 1.0, 1.34, -0.7, 0.7, 0.04);
    P.ext(M.chassis, 0.6, 1.2, 0.72, 1.0, -0.9, 0.9, 0.06);
    for (const s of [-1, 1]) P.ext(M.chassis, bx0 - 0.05, bx0 + 0.45, 1.1, by0 + 0.02, s * 0.75 - 0.14, s * 0.75 + 0.14, 0.05);
    // side boxes (tank and battery box) between the axles, blue, the mudguards over the tandem
    for (const s of [-1, 1]) {
      P.ext(M.blue, -0.75, 1.3, 0.55, 1.36, s * 1.08, s * 1.64, 0.18);
      P.ext(M.blueLight, -0.6, 1.15, 1.32, 1.37, s * 1.15, s * 1.57, 0.02);
      P.ext(M.blue, rearX[1] - 0.9, rearX[0] + 0.9, 1.53, 1.62, s * 1.12, s * 1.78, 0.04);
      P.ext(M.chassis, -0.6, 1.2, 0.42, 0.5, s * 1.1, s * 1.62, 0.03);
    }
    // the rear: a light bar with the lamps, the under-ride bar
    P.ext(M.chassis, -4.6, -4.36, 0.62, 0.9, -1.6, 1.6, 0.08);
    for (const s of [-1, 1]) P.ext(M.tail, -4.64, -4.58, 0.68, 0.84, s * 1.3 - 0.16, s * 1.3 + 0.16, 0.03);
    // the fleet number on the cab doors
    for (const s of [-1, 1]) P.text(`D-${number}`, {fg: TOY.white, px: 110}, 0.3, cx0 + 0.56, 1.98, s * (W / 2 + 0.008), s > 0 ? 0 : PI);
  }, group);

  // ---- the bed: hinged at its rear bottom
  const bed = new THREE.Group();
  bed.position.set(bx0, by0, 0);
  group.add(bed);
  const BL = bx1 - bx0;
  const h = bedTop - by0;
  tpl('dump-bed', (P) => {
    const t = 0.18;
    // floor, the 2 side walls with their top rails, the front wall rising into a canopy over the cab's back
    P.ext(M.yellow, 0, BL, 0, 0.3, -BW / 2, BW / 2, 0.12);
    for (const s of [-1, 1]) {
      P.ext(M.yellow, 0.02, BL, 0.1, h, s > 0 ? BW / 2 - t : -BW / 2, s > 0 ? BW / 2 : -BW / 2 + t, 0.07);
      P.ext(M.yellow, -0.02, BL + 0.02, h - 0.24, h + 0.02, s > 0 ? BW / 2 - t - 0.02 : -BW / 2 - 0.06, s > 0 ? BW / 2 + 0.06 : -BW / 2 + t + 0.02, 0.1);
      // 3 ribs down each side and a bottom rail
      for (const x of [1.25, 2.9, 4.55]) P.ext(M.yellow, x - 0.11, x + 0.11, 0.04, h - 0.2, s > 0 ? BW / 2 - 0.02 : -BW / 2 - 0.05, s > 0 ? BW / 2 + 0.05 : -BW / 2 + 0.02, 0.04);
      P.ext(M.yellowDeep, 0, BL - 0.05, -0.04, 0.22, s > 0 ? BW / 2 - 0.05 : -BW / 2 - 0.06, s > 0 ? BW / 2 + 0.06 : -BW / 2 + 0.05, 0.07);
    }
    P.ext(M.yellow, BL - 0.22, BL, 0.1, h + 0.74, -BW / 2, BW / 2, 0.09);
    P.ext(M.yellow, BL - 0.26, BL + 0.66, h + 0.54, h + 0.78, -BW / 2 + 0.06, BW / 2 - 0.06, 0.1);
    P.ext(M.yellowDeep, BL - 0.25, BL - 0.2, 0.4, h + 0.35, -BW / 2 + 0.3, BW / 2 - 0.3, 0.02);
    // the inner faces a step darker, so the bed reads hollow from above
    P.ext(M.yellowDeep, 0.05, BL - 0.22, 0.3, 0.33, -BW / 2 + t, BW / 2 - t, 0.01);
    // the longitudinal runners under the floor
    for (const s of [-1, 1]) P.ext(M.chassis, 0.05, BL - 0.1, -0.12, 0.02, s * 0.75 - 0.12, s * 0.75 + 0.12, 0.04);
    // the prints: the wordmark on both sides, between the ribs
    P.sides((s, z, ry) => P.brand({fg: C.text}, 0.5, 2.08 + 0.0, h * 0.56, z + s * 0.055, ry), BW / 2);
    P.pin(0.02, 0.02, 0, 0.08, BW - 0.3);
  }, bed);
  // the tailgate: hinged at the top of the rear, it hangs plumb as the bed tips
  const gate = new THREE.Group();
  gate.position.set(-0.06, h - 0.06, 0);
  bed.add(gate);
  tpl('dump-gate', (P) => {
    P.ext(M.yellow, -0.16, 0.06, -h + 0.18, 0.08, -BW / 2 + 0.02, BW / 2 - 0.02, 0.07);
    for (const z of [-1.0, 0, 1.0]) P.ext(M.yellowDeep, -0.2, -0.12, -h + 0.3, -0.06, z - 0.08, z + 0.08, 0.03);
    P.pin(0, 0, 0, 0.07, BW + 0.08);
  }, gate);
  const load = heap('dump', {clods: 6, seed: 3});
  bed.add(load);
  // the hoist: a telescopic ram from the frame's cross member to the bed's front underside
  const stages = [0.17, 0.14, 0.115, 0.09].map((r, i) => part(cg(`hoist|${r}`, () => new THREE.CylinderGeometry(r, r, 1, 18).rotateZ(-PI / 2).translate(0.5, 0, 0)), i === 0 ? M.ink : M.steel, group));
  const base = V3(0.9, 0.86, 0);
  const _t = new THREE.Vector3();
  const _dir = new THREE.Vector3();
  const _qq = new THREE.Quaternion();
  const setTip = (k) => {
    const a = sat(k) * (50 * PI) / 180;
    bed.rotation.z = a;
    // the gate hangs plumb, swinging open once the bed leaves the frame
    gate.rotation.z = -a;
    // the ram top on the bed: (BL - 0.75, -0.02) in the bed frame
    const lx = BL - 0.75;
    _t.set(bx0 + Math.cos(a) * lx - Math.sin(a) * -0.02, by0 + Math.sin(a) * lx + Math.cos(a) * -0.02, 0);
    _dir.subVectors(_t, base);
    const len = _dir.length();
    _dir.normalize();
    _qq.setFromUnitVectors(V3(1, 0, 0), _dir);
    stages.forEach((m, i) => {
      const seg = Math.max(0.3, len / stages.length + 0.25);
      const start = Math.max(0, (len - seg) * (i / (stages.length - 1)));
      m.position.copy(base).addScaledVector(_dir, start);
      m.quaternion.copy(_qq);
      m.scale.set(Math.min(seg, len - start), 1, 1);
    });
    updLoad();
  };
  let loadK = 0;
  const updLoad = () => {
    const s = sat(loadK);
    load.visible = s > 0.01;
    const a = bed.rotation.z;
    // the heap sits on the floor, its crown just over the rails at k = 1; it slides back as the bed tips
    load.position.set(BL * 0.48 - a * 1.4, 0.3, 0);
    load.scale.set(2.55 * (0.7 + 0.3 * s), 0.6 + 1.7 * s, 1.55 * (0.75 + 0.25 * s));
  };
  const setLoad = (k) => {
    loadK = k;
    updLoad();
  };
  setTip(0);
  setLoad(0);
  const wheels = [];
  const steer = [];
  axle(group, wheels, R, 0.64, wheelX, 1.4, steer);
  for (const x of rearX) axle(group, wheels, R, 0.64, x, 1.5);
  return {group, roll: roller(wheels), setSteer: steerer(steer), setTip, setLoad, bedTop, bedSpan: {x0: bx0 + 0.2, x1: bx1 - 0.25, z: BW / 2 - 0.2}, dims: {length: 9.1, width: W + 0.7}};
}

// ================================================================ the concrete mixer truck
/** a smooth lathe profile through control points [r, h], resampled with a Catmull-Rom curve */
function smoothProfile(pts, n = 48) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([r, h]) => V3(r, h, 0)), false, 'centripetal');
  return curve.getPoints(n).map((p) => V2(Math.max(1e-4, p.x), p.y));
}
const DRUM = [
  [0.0001, 0],
  [0.36, 0.02],
  [0.86, 0.36],
  [1.22, 1.12],
  [1.34, 1.95],
  [1.34, 2.95],
  [1.18, 3.9],
  [0.86, 4.75],
  [0.66, 5.22],
  [0.6, 5.43],
];
/** the drum's radius at h along its axis (linear between the control points, close enough for the band and rollers) */
function drumR(h) {
  for (let i = 1; i < DRUM.length; i++)
    if (h <= DRUM[i][1]) {
      const [r0, h0] = DRUM[i - 1];
      const [r1, h1] = DRUM[i];
      return lerp(r0, r1, (h - h0) / (h1 - h0));
    }
  return DRUM[DRUM.length - 1][0];
}
/** the chute's U section in the yz plane (shape x = -z, shape y = y), floor at y = 0 */
function chuteU(w = 0.62, h = 0.34, t = 0.07) {
  return () =>
    roundedPoly(
      [V2(-w / 2, h), V2(-w / 2, 0), V2(w / 2, 0), V2(w / 2, h), V2(w / 2 - t, h), V2(w / 2 - t, t), V2(-w / 2 + t, t), V2(-w / 2 + t, h)],
      [0.03, 0.16, 0.16, 0.03, 0.03, 0.1, 0.1, 0.03],
    );
}

export function buildToyMixer({number = '21'} = {}) {
  const M = mats();
  const group = new THREE.Group();
  group.name = 'mixer';
  const W = 3.5;
  const R = 0.75;
  const cx0 = 2.05;
  const cx1 = 5.0;
  const wheelX = cx1 - 1.65;
  const rearX = [-2.3, -3.77];
  // the drum axis: low at the front, high at the rear mouth
  const F = V2(1.3, 2.4);
  const Rr = V2(-4.0, 3.62);
  const axisLen = Rr.clone().sub(F).length();
  const tilt = Math.atan2(Rr.y - F.y, Rr.x - F.x); // the axis direction, front to rear
  const scaleH = axisLen / 5.43;
  const onAxis = (h) => F.clone().lerp(Rr, h / 5.43);
  tpl(`mixer|${number}`, (P) => {
    cab(P, {x0: cx0, x1: cx1, top: 4.1, W, color: TOY.blue, wheelX, wheelR: R, seam: TOY.blueDeep});
    // the frame, a blue subframe on it
    for (const s of [-1, 1]) P.ext(M.chassis, -4.9, cx0 + 0.6, 0.92, 1.42, s * 0.75 - 0.15, s * 0.75 + 0.15, 0.07);
    P.ext(M.blue, -4.75, 1.95, 1.4, 1.62, -1.02, 1.02, 0.08);
    // the water tank behind the cab: white with a blue band
    P.rcyl(M.white, 0.38, 0.38, 1.7, 1.62, 2.06, 0, 'z', 0.1, 32);
    P.rcyl(M.blue, 0.395, 0.395, 0.3, 1.62, 2.06, 0, 'z', 0.04, 32);
    // the front pedestal and the gearbox under the drum's nose
    P.ext(M.blue, 0.75, 1.72, 1.55, 2.12, -0.62, 0.62, 0.14);
    P.add(M.ink, rcylG(0.42, 0.42, 0.5, 0.1, 28), F.x + 0.12, F.y - 0.04, 0, 0, 0, -PI / 2 + tilt + PI);
    // the rear frame: 2 posts carrying the rollers under the drum, a portal carrying the hopper
    const hR = 4.4;
    const pR = onAxis(hR);
    const rr = drumR(hR) * scaleH;
    for (const s of [-1, 1]) {
      P.ext(M.blue, pR.x - 0.2, pR.x + 0.2, 1.55, pR.y - Math.sqrt(Math.max(0, rr * rr - 0.72 * 0.72)) - 0.12, s * 0.72 - 0.16, s * 0.72 + 0.16, 0.08);
      P.rcyl(M.ink, 0.17, 0.17, 0.3, pR.x, pR.y - Math.sqrt(Math.max(0, rr * rr - 0.72 * 0.72)) - 0.02, s * 0.72, 'z', 0.04, 20);
      // the portal behind the mouth
      P.ext(M.blue, -4.78, -4.48, 1.55, 4.3, s * 0.95 - 0.13, s * 0.95 + 0.13, 0.08);
    }
    P.ext(M.blue, -4.82, -4.44, 3.98, 4.3, -1.08, 1.08, 0.1);
    // the hopper over the mouth: a yellow funnel
    P.add(M.yellow, cg('mix-hopper', () => new THREE.CylinderGeometry(0.82, 0.38, 0.86, 32, 1, true).translate(0, 0.43, 0)), -4.36, 4.0, 0, 0, 0, 0.22);
    P.add(M.yellowDeep, cg('mix-hopper-in', () => new THREE.LatheGeometry([V2(0.8, 0.85), V2(0.36, 0.01)], 32)), -4.36, 4.0, 0, 0, 0, 0.22);
    P.add(M.yellow, cg('mix-hopper-rim', () => new THREE.TorusGeometry(0.82, 0.06, 10, 40).rotateX(PI / 2)), -4.36 - Math.sin(0.22) * 0.86, 4.0 + Math.cos(0.22) * 0.86, 0, 0, 0, 0.22);
    // the collector chute below the mouth, down to the swing chute's pivot
    P.add(M.yellow, extrudeX('mix-collect', chuteU(0.7, 0.36, 0.07), 1.0, 0.03), -4.02, 2.92, 0, 0, 0, 0.56);
    // the ladder up the right post
    for (const dz of [-0.2, 0.2]) P.ext(M.ink, -4.98, -4.9, 1.2, 4.2, 0.95 + 0.32 + dz - 0.03, 0.95 + 0.32 + dz + 0.03, 0.02);
    for (let y = 1.45; y < 4.1; y += 0.36) P.ext(M.ink, -4.97, -4.91, y - 0.025, y + 0.025, 1.08, 1.46, 0.012);
    // the rear: a light bar, lamps, the under-ride bar; side guards and mudguards
    P.ext(M.chassis, -5.06, -4.86, 0.62, 0.9, -1.6, 1.6, 0.08);
    for (const s of [-1, 1]) {
      P.ext(M.tail, -5.1, -5.04, 0.68, 0.84, s * 1.3 - 0.16, s * 1.3 + 0.16, 0.03);
      P.ext(M.blue, rearX[1] - 0.9, rearX[0] + 0.9, 1.53, 1.62, s * 1.12, s * 1.78, 0.04);
      P.ext(M.blue, -1.2, 1.25, 0.55, 1.34, s * 1.1, s * 1.64, 0.16);
      P.ext(M.blueLight, -1.05, 1.1, 1.3, 1.35, s * 1.17, s * 1.57, 0.02);
    }
    for (const s of [-1, 1]) P.text(`M-${number}`, {fg: TOY.white, px: 110}, 0.3, cx0 + 0.56, 1.98, s * (W / 2 + 0.008), s > 0 ? 0 : PI);
  }, group);

  // ---- the drum: a yellow lathe with a blue band carrying the wordmark, turning about its axis
  const drumPivot = new THREE.Group();
  drumPivot.position.set(F.x, F.y, 0);
  drumPivot.rotation.z = tilt - PI / 2; // the lathe's +y along the axis, toward the rear
  group.add(drumPivot);
  const drum = new THREE.Group();
  drumPivot.add(drum);
  tpl('mix-drum', (P) => {
    const prof = smoothProfile(DRUM.map(([r, h]) => [r, h * scaleH]), 60);
    P.add(M.yellow, cg('mix-drum-geo', () => new THREE.LatheGeometry(prof, 56)), 0, 0, 0);
    // the blue band over the waist, a touch proud
    const b0 = 1.62 * scaleH;
    const b1 = 3.3 * scaleH;
    const rb0 = drumR(1.62) * scaleH;
    const rb1 = drumR(3.3) * scaleH;
    P.add(M.blue, cg('mix-band', () => new THREE.LatheGeometry([V2(rb0 - 0.03, b0 - 0.03), V2(rb0 + 0.025, b0 + 0.03), V2(1.365, 1.95 * scaleH), V2(1.365, 2.95 * scaleH), V2(rb1 + 0.025, b1 - 0.03), V2(rb1 - 0.03, b1 + 0.03)], 56)), 0, 0, 0);
    // the wordmark along the drum on both flanks, in white: it turns with the drum, so the drum reads as turning
    const tex = canvasTex('mix-band-print', 4096, 1024, (g, w, h) => {
      const img = brandTex({fg: '#ffffff', markBg: '#ffffff'}).image;
      const ll = h * 0.84;
      const tt = (img.height / img.width) * ll;
      for (const [u, rot] of [
        [0.25, PI / 2],
        [0.75, -PI / 2],
      ]) {
        g.save();
        g.translate(u * w, h / 2);
        g.rotate(rot);
        g.drawImage(img, -ll / 2, -tt / 2, ll, tt);
        g.restore();
      }
    });
    // theta starts at -90 deg so u = 0.25 sits on the +z flank and u = 0.75 on the -z flank
    P.add(decalMat(tex), cg('mix-band-decal', () => new THREE.CylinderGeometry(1.372, 1.372, 1.5 * scaleH, 64, 1, true, -PI / 2).translate(0, 2.46 * scaleH, 0)), 0, 0, 0);
    // 2 fins showing at the mouth, the mouth's dark rim
    const mh = 5.43 * scaleH;
    P.add(M.ink, cg('mix-mouth', () => new THREE.TorusGeometry(0.56, 0.06, 10, 36).rotateX(PI / 2)), 0, mh - 0.02, 0);
    P.add(M.ink, cg('mix-mouth-in', () => new THREE.CircleGeometry(0.55, 36).rotateX(-PI / 2)), 0, mh - 0.05, 0);
    // the roller track round the drum's rear
    P.add(M.ink, cg('mix-track', () => new THREE.LatheGeometry([V2(drumR(4.25) * scaleH - 0.01, 4.25 * scaleH), V2(drumR(4.3) * scaleH + 0.05, 4.3 * scaleH), V2(drumR(4.5) * scaleH + 0.05, 4.5 * scaleH), V2(drumR(4.55) * scaleH - 0.01, 4.55 * scaleH)], 56)), 0, 0, 0);
  }, drum);
  const setDrum = (a) => {
    drum.rotation.y = a;
  };

  // ---- the swing chute: yaw at the pivot, pitch, then the main section and the folding extension
  const pivot = V3(-4.92, 2.5, 0);
  const yaw = new THREE.Group();
  yaw.position.copy(pivot);
  group.add(yaw);
  const pitch = new THREE.Group();
  yaw.add(pitch);
  const LM = 1.8;
  const LE = 1.6;
  const UH = 0.34;
  tpl('mix-chute-main', (P) => {
    P.add(M.yellow, extrudeX('mix-chute', chuteU(0.62, UH, 0.07), LM, 0.03), 0, 0, 0);
    P.rcyl(M.ink, 0.16, 0.16, 0.22, 0.05, 0.08, 0, 'y', 0.04, 20);
    for (const s of [-1, 1]) P.ext(M.yellowDeep, -LM + 0.05, -0.05, UH - 0.05, UH + 0.02, s * 0.31 - 0.04, s * 0.31 + 0.04, 0.02);
  }, pitch);
  const fold = new THREE.Group();
  fold.position.set(-LM, UH, 0);
  pitch.add(fold);
  tpl('mix-chute-ext', (P) => {
    P.add(M.yellow, extrudeX('mix-chute-e', chuteU(0.58, UH, 0.07), LE, 0.03), 0, -UH, 0);
    P.pin(0, 0, 0, 0.06, 0.72);
  }, fold);
  const chuteTip = new THREE.Object3D();
  chuteTip.position.set(-LE, -UH + 0.08, 0);
  fold.add(chuteTip);
  // wet concrete lying in the chute while it pours
  const lining = [part(rb(LM - 0.1, 0.06, 0.46, 0.03), M.concreteWet, pitch), part(rb(LE - 0.1, 0.06, 0.42, 0.03), M.concreteWet, fold)];
  lining[0].position.set(-LM / 2, 0.1, 0);
  lining[1].position.set(-LE / 2, -UH + 0.1, 0);
  const setChute = (k, swing = 0) => {
    const a = smooth(k / 0.6);
    const b = smooth((k - 0.45) / 0.55);
    yaw.rotation.y = lerp(PI / 2, swing, a);
    pitch.rotation.z = lerp(-0.22, 0.42, a);
    fold.rotation.z = lerp(-PI, 0, b);
  };
  setChute(0);

  // ---- the pour: a soft stream from the chute's lip, falling to toY, rebuilt in place each call
  const NS = 30;
  const NR = 14;
  const sGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array((NS + 1) * (NR + 1) * 3);
  const sNor = new Float32Array((NS + 1) * (NR + 1) * 3);
  const idx = [];
  for (let i = 0; i < NS; i++)
    for (let j = 0; j < NR; j++) {
      const a = i * (NR + 1) + j;
      const b = a + NR + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  sGeo.setIndex(idx);
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('normal', new THREE.BufferAttribute(sNor, 3));
  const stream = new THREE.Mesh(sGeo, M.concreteWet);
  stream.castShadow = true;
  stream.frustumCulled = false;
  group.add(stream);
  const splash = new THREE.Group();
  tpl('mix-splash', (P) => {
    P.add(M.concreteWet, lumpGeo(11, {flat: 0.2, rough: 0.12, detail: 3}), 0, 0, 0);
  }, splash);
  group.add(splash);
  const _o = new THREE.Vector3();
  const _d = new THREE.Vector3();
  const _c = new THREE.Vector3();
  const _t = new THREE.Vector3();
  const _n = new THREE.Vector3();
  const _b = new THREE.Vector3();
  const setPour = (k, {toY = 0, t = 0} = {}) => {
    const on = k > 0.01;
    stream.visible = splash.visible = on;
    for (const l of lining) l.visible = on;
    if (!on) return;
    group.updateWorldMatrix(true, true);
    // the lip and the chute's direction, in the group's frame
    chuteTip.getWorldPosition(_o);
    group.worldToLocal(_o);
    _d.set(-1, 0, 0).transformDirection(chuteTip.matrixWorld);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    _d.transformDirection(inv);
    const ly = toY - group.getWorldPosition(new THREE.Vector3()).y;
    const v = 2.6;
    const g = 9.8;
    const vx = _d.x * v;
    const vy = _d.y * v;
    const vz = _d.z * v;
    const T = (vy + Math.sqrt(vy * vy + 2 * g * Math.max(0.05, _o.y - ly))) / g;
    const rad = 0.2 * Math.sqrt(sat(k));
    for (let i = 0; i <= NS; i++) {
      const u = i / NS;
      const tt = u * T;
      _c.set(_o.x + vx * tt, _o.y + vy * tt - 0.5 * g * tt * tt, _o.z + vz * tt);
      _t.set(vx, vy - g * tt, vz).normalize();
      _n.set(0, 0, 1).cross(_t);
      if (_n.lengthSq() < 1e-6) _n.set(1, 0, 0);
      _n.normalize();
      _b.crossVectors(_t, _n).normalize();
      // thick at the lip, thinning as it falls, a soft ripple running down it
      const r = rad * (1.15 - 0.4 * u) * (1 + 0.12 * Math.sin(u * 26 - t * 11) + 0.06 * Math.sin(u * 61 - t * 23));
      for (let j = 0; j <= NR; j++) {
        const a = (j / NR) * PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const q = (i * (NR + 1) + j) * 3;
        const nx = _n.x * ca + _b.x * sa;
        const ny = _n.y * ca + _b.y * sa;
        const nz = _n.z * ca + _b.z * sa;
        // the stream is a ribbon flattened across the chute's width near the lip
        const flatK = 1 + 0.6 * (1 - u) * (1 - u);
        sPos[q] = _c.x + nx * r * (Math.abs(_n.z) > 0.5 ? 1 : flatK);
        sPos[q + 1] = _c.y + ny * r;
        sPos[q + 2] = _c.z + nz * r * flatK;
        sNor[q] = nx;
        sNor[q + 1] = ny;
        sNor[q + 2] = nz;
      }
    }
    sGeo.attributes.position.needsUpdate = true;
    sGeo.attributes.normal.needsUpdate = true;
    sGeo.computeBoundingSphere();
    const s = 0.4 + 0.5 * sat(k);
    splash.position.set(_o.x + vx * T, ly, _o.z + vz * T);
    splash.scale.set(s * (1 + 0.04 * Math.sin(t * 7)), 0.22 * s, s * (1 + 0.04 * Math.cos(t * 6)));
  };
  setPour(0);
  const wheels = [];
  const steer = [];
  axle(group, wheels, R, 0.64, wheelX, 1.4, steer);
  for (const x of rearX) axle(group, wheels, R, 0.64, x, 1.5);
  return {group, roll: roller(wheels), setSteer: steerer(steer), setDrum, setChute, setPour, chuteTip, dims: {length: 10.1, width: W + 0.7}};
}

// ================================================================ the bulldozer
export function buildToyBulldozer({number = '03'} = {}) {
  const M = mats();
  const group = new THREE.Group();
  group.name = 'bulldozer';
  const TRK = (s) => ({L: 3.9, H: 0.96, w: 0.74, zc: s * 1.2});
  tpl(`dozer|${number}`, (P) => {
    for (const s of [-1, 1]) trackStatic(P, TRK(s));
    // the frame, the fenders over the tracks
    P.ext(M.chassis, -1.7, 1.7, 0.34, 1.0, -0.86, 0.86, 0.16);
    for (const s of [-1, 1]) P.ext(M.blue, -1.98, 1.9, 0.98, 1.1, s * 0.78, s * 1.62, 0.05);
    // the engine hood: a rounded block sloping to the front, a dark grille, the exhaust and the air intake
    P.add(M.blue, extrude('dz-hood', () => profile(0.15, 1.98, 1.04, 2.02, {rc: [0.06, 0.12, 0.42, 0.1]}, 0.14), 1.66, 0.14), 0, 0, 0);
    P.ext(M.ink, 1.94, 2.02, 1.18, 1.78, -0.58, 0.58, 0.05);
    for (let k = 0; k < 4; k++) P.ext(M.bumper, 2.0, 2.05, 1.27 + k * 0.13, 1.31 + k * 0.13, -0.5, 0.5, 0.015);
    for (let i = 0; i < 4; i++) P.ext(M.ink, 0.62 + i * 0.22, 0.73 + i * 0.22, 2.0, 2.03, -0.55, 0.55, 0.01);
    P.rcyl(M.steel, 0.09, 0.09, 0.7, 1.3, 2.32, -0.42, 'y', 0.03, 16);
    P.rcyl(M.ink, 0.12, 0.12, 0.12, 1.3, 2.05, -0.42, 'y', 0.03, 16);
    P.rcyl(M.ink, 0.14, 0.12, 0.34, 1.55, 2.18, 0.42, 'y', 0.05, 16);
    // the cab: glass all round under a blue roof
    const x0 = -1.58;
    const x1 = 0.34;
    const y0 = 1.04;
    const y1 = 3.02;
    P.add(M.blue, extrude('dz-cab', () => profile(x0, x1, y0, y1, {rc: [0.06, 0.06, 0.26, 0.22]}, 0.13), 1.96, 0.13), 0, 0, 0);
    P.ext(M.blue, x0 - 0.06, x1 + 0.06, y1 - 0.06, y1 + 0.08, -1.04, 1.04, 0.07);
    P.ext(M.glass, x1 - 0.06, x1 + 0.035, y0 + 0.62, y1 - 0.22, -0.82, 0.82, 0.06);
    P.ext(M.glass, x0 - 0.035, x0 + 0.06, y0 + 0.66, y1 - 0.24, -0.78, 0.78, 0.06);
    for (const s of [-1, 1]) {
      P.ext(M.glass, x0 + 0.16, x1 - 0.16, y0 + 0.62, y1 - 0.2, s > 0 ? 0.94 : -1.015, s > 0 ? 1.015 : -0.94, 0.06);
      P.ext(M.ink, x0 + 0.5, x0 + 0.6, y0 + 0.4, y0 + 0.47, s > 0 ? 0.96 : -0.99, s > 0 ? 0.99 : -0.96, 0.015);
    }
    P.beacon(x0 + 0.35, y1 + 0.08, 0.55, 0.12);
    // the rear: the tank, the ripper frame and its shank
    P.ext(M.blue, -2.02, -1.55, 1.0, 1.92, -0.86, 0.86, 0.14);
    for (const s of [-1, 1]) {
      P.bar(M.yellow, [-1.85, 0.62, s * 0.5], [-2.62, 0.92, s * 0.5], 0.2);
      P.bar(M.yellow, [-1.85, 1.0, s * 0.5], [-2.62, 1.06, s * 0.5], 0.16);
    }
    P.ext(M.yellow, -2.84, -2.48, 0.78, 1.18, -0.66, 0.66, 0.1);
    P.add(M.yellow, extrude('dz-shank', () => roundedPoly([V2(-2.74, 1.0), V2(-2.52, 1.0), V2(-2.6, 0.26), V2(-2.82, 0.12), V2(-2.86, 0.36)], [0.06, 0.06, 0.08, 0.04, 0.08]), 0.2, 0.05), 0, 0, 0);
    P.add(M.ink, rb(0.26, 0.1, 0.22, 0.04), -2.86, 0.15, 0, 0, 0, 0.6);
    // the prints: the fleet number on the hood, the wordmark on the cab's lower side
    P.sides((s, z, ry) => P.text(`DZ ${number}`, {fg: TOY.white, px: 110}, 0.3, 1.05, 1.55, z + s * 0.004, ry), 0.83);
  }, group);
  const rolls = [-1, 1].map((s) => trackMoving(group, TRK(s)));
  // ---- the blade on its push arms, pivoting on the track frames
  const blade = new THREE.Group();
  blade.position.set(-0.1, 0.48, 0);
  group.add(blade);
  const BX = 2.55; // the moldboard's back, in the group frame
  tpl('dozer-blade', (P) => {
    const ox = 0.1;
    const oy = -0.48;
    // the push arms outside the tracks, a brace from each to the blade's top
    for (const s of [-1, 1]) {
      P.add(M.yellow, rb(2.65, 0.26, 0.2, 0.08), (BX - 0.1) / 2 + ox - 0.05, 0.02, s * 1.68, 0, 0, -0.02);
      P.bar(M.yellow, [ox + 1.4, 0.1, s * 1.68], [BX + ox - 0.05, 0.95 + oy + 0.48 - 0.1, s * 1.45], 0.14);
      P.pin(0, 0, s * 1.68, 0.11, 0.3);
    }
    // the moldboard: a curved plate, concave to the front, end plates, the cutting edge
    const mold = () => roundedPoly([V2(3.02, 0.0), V2(2.82, 0.32), V2(2.74, 0.72), V2(2.8, 1.12), V2(3.0, 1.38), V2(2.76, 1.44), V2(2.5, 1.26), V2(2.42, 0.62), V2(2.5, 0.04)], [0.03, 0.4, 0.5, 0.4, 0.05, 0.1, 0.3, 0.3, 0.06]);
    P.add(M.yellow, extrude('dz-mold', mold, 3.7, 0.08), ox, oy, 0);
    for (const s of [-1, 1]) P.add(M.yellowDeep, extrude('dz-end', mold, 0.1, 0.03), ox + 0.03, oy, s * 1.84);
    P.ext(M.ink, ox + 2.82, ox + 3.06, oy - 0.02, oy + 0.12, -1.84, 1.84, 0.04);
  }, blade);
  const wave = heap('dozer-wave', {clods: 7, seed: 5});
  group.add(wave);
  // the blade's lift rams: hood front to the moldboard's back
  const rams = [-0.95, 0.95].map((z) => ({set: ram(group, 0.1, 0.9), z}));
  const _a = new THREE.Vector3();
  const _b2 = new THREE.Vector3();
  const setBlade = (k) => {
    blade.rotation.z = Math.asin((0.8 * sat(k)) / 2.9);
    const a = blade.rotation.z;
    const lx = BX + 0.1 - 0.02;
    const ly = 1.15 - 0.48;
    for (const r of rams) r.set(_a.set(1.85, 1.86, r.z), _b2.set(blade.position.x + Math.cos(a) * lx - Math.sin(a) * ly, blade.position.y + Math.sin(a) * lx + Math.cos(a) * ly, r.z));
  };
  const setPush = (k) => {
    const s = sat(k);
    wave.visible = s > 0.01;
    wave.position.set(3.05 + 0.45 + 0.35 * s, 0, 0);
    wave.scale.set(0.35 + 0.5 * s, 0.25 + 0.75 * s, 1.75 * (0.75 + 0.25 * s));
  };
  setBlade(0);
  setPush(0);
  return {group, roll: (d) => rolls.forEach((r) => r(d)), setBlade, setPush, dims: {length: 6.0, width: 3.7}};
}

// ================================================================ the wheel loader
/** the loader bucket's shell: pin at (0, 0) behind its back plate, the floor at y = -0.55, the mouth toward +x */
const LB_OUT = [V2(1.34, -0.56), V2(0.26, -0.6), V2(0.09, -0.42), V2(0.09, 0.44), V2(0.3, 0.68), V2(0.58, 0.64)];
const LB_IN = [V2(0.52, 0.5), V2(0.33, 0.53), V2(0.21, 0.41), V2(0.21, -0.36), V2(0.33, -0.47), V2(1.22, -0.45)];

export function buildToyWheelLoader({number = '05'} = {}) {
  const M = mats();
  const group = new THREE.Group();
  group.name = 'wheel-loader';
  const WR = 0.86;
  const WW = 0.74;
  const WZ = 1.14;
  const PX = 0.2; // the articulation
  tpl(`loader|${number}`, (P) => {
    // the rear frame: the chassis between the wheels, the yellow counterweight, the engine hood, the fenders
    P.ext(M.chassis, -3.1, PX + 0.1, 0.62, 1.36, -0.7, 0.7, 0.14);
    P.add(M.yellow, extrude('wl-cw', () => profile(-3.45, -2.82, 0.5, 1.46, {rc: [0.24, 0.06, 0.06, 0.24]}, 0.12), 2.2, 0.12), 0, 0, 0);
    P.add(M.blue, extrude('wl-hood', () => profile(-3.3, -0.9, 1.3, 2.52, {rc: [0.08, 0.06, 0.18, 0.46]}, 0.15), 1.86, 0.15), 0, 0, 0);
    P.ext(M.ink, -3.36, -3.28, 1.5, 2.18, -0.62, 0.62, 0.05);
    for (let k = 0; k < 4; k++) P.ext(M.bumper, -3.38, -3.33, 1.6 + k * 0.15, 1.64 + k * 0.15, -0.54, 0.54, 0.015);
    for (let i = 0; i < 4; i++) P.ext(M.ink, -2.5 + i * 0.24, -2.39 + i * 0.24, 2.5, 2.53, -0.6, 0.6, 0.01);
    P.rcyl(M.steel, 0.09, 0.09, 0.62, -1.4, 2.8, -0.55, 'y', 0.03, 16);
    for (const s of [-1, 1]) P.add(M.blue, fender(WR + 0.08, WR + 0.24, WW + 0.1), -1.75, WR, s * WZ);
    // the cab, narrow enough to sit between the rear tyres
    const x0 = -1.06;
    const x1 = 0.22;
    const y0 = 1.32;
    const y1 = 3.48;
    const hz = 0.75;
    P.add(M.blue, extrude('wl-cab', () => profile(x0, x1, y0, y1, {rc: [0.06, 0.06, 0.24, 0.22]}, 0.13), 2 * hz, 0.13), 0, 0, 0);
    P.ext(M.blue, x0 - 0.06, x1 + 0.08, y1 - 0.06, y1 + 0.08, -hz - 0.06, hz + 0.06, 0.07);
    P.ext(M.glass, x1 - 0.06, x1 + 0.035, y0 + 0.5, y1 - 0.22, -hz + 0.16, hz - 0.16, 0.06);
    P.ext(M.glass, x0 - 0.035, x0 + 0.06, y0 + 0.7, y1 - 0.24, -hz + 0.2, hz - 0.2, 0.06);
    for (const s of [-1, 1]) {
      P.ext(M.glass, x0 + 0.14, x1 - 0.14, y0 + 0.5, y1 - 0.2, s > 0 ? hz - 0.04 : -hz - 0.035, s > 0 ? hz + 0.035 : -hz + 0.04, 0.06);
      P.ext(M.ink, x0 + 0.3, x0 + 0.4, y0 + 0.3, y0 + 0.37, s > 0 ? hz - 0.02 : -hz - 0.03, s > 0 ? hz + 0.03 : -hz + 0.02, 0.015);
    }
    P.beacon(x0 + 0.3, y1 + 0.08, 0.5, 0.12);
    P.sides((s, z, ry) => P.text(`WL ${number}`, {fg: TOY.white, px: 110}, 0.28, -2.05, 1.95, z + s * 0.004, ry), 0.93);
    P.pin(PX, 0.98, 0, 0.16, 0.5);
  }, group);
  const wheels = [];
  axle(group, wheels, WR, WW, -1.75, WZ);
  // ---- the front frame, turning about the articulation
  const front = new THREE.Group();
  front.position.x = PX;
  group.add(front);
  const BP = V2(0.48, 2.12); // the boom pivot, front-frame local
  tpl('loader-front', (P) => {
    P.ext(M.chassis, 0.0, 1.95, 0.6, 1.4, -0.64, 0.64, 0.14);
    // the tower carrying the boom pins, the fenders over the front wheels
    P.add(M.blue, extrude('wl-tower', () => roundedPoly([V2(0.05, 1.0), V2(1.05, 1.0), V2(0.82, 2.0), V2(0.3, 2.34), V2(0.05, 2.1)], [0.08, 0.1, 0.24, 0.16, 0.08]), 0.84, 0.1), 0, 0, 0);
    for (const s of [-1, 1]) {
      P.add(M.blue, fender(WR + 0.08, WR + 0.22, WW + 0.04), 1.35, WR, s * WZ);
      P.pin(BP.x, BP.y, s * 0.55, 0.12, 0.3);
    }
    P.ext(M.ink, 1.95, 2.08, 0.7, 1.12, -0.55, 0.55, 0.05);
    for (const s of [-1, 1]) P.ext(M.lamp, 0.9, 1.0, 2.0, 2.14, s * 0.42 - 0.1, s * 0.42 + 0.1, 0.03);
  }, front);
  axle(front, wheels, WR, WW, 1.35, WZ);
  // the boom: 2 arms and a cross tube, rotating about BP
  const boom = new THREE.Group();
  boom.position.set(BP.x, BP.y, 0);
  front.add(boom);
  const lowA = Math.atan2(0.58 - BP.y, 2.95 - BP.x);
  const LBm = Math.hypot(0.58 - BP.y, 2.95 - BP.x);
  tpl('loader-boom', (P) => {
    const arm = () => roundedPoly([V2(-0.3, 0.2), V2(1.2, 0.34), V2(LBm + 0.22, 0.17), V2(LBm + 0.22, -0.17), V2(1.2, -0.14), V2(-0.3, -0.2)], [0.16, 0.6, 0.16, 0.16, 0.6, 0.16]);
    // the arms run inside the front tyres
    for (const s of [-1, 1]) {
      P.add(M.yellow, extrude('wl-arm', arm, 0.24, 0.07), 0, 0, s * 0.62);
      P.pin(LBm, 0, s * 0.62, 0.1, 0.36);
    }
    P.rcyl(M.yellow, 0.16, 0.16, 1.24, 1.05, 0.12, 0, 'z', 0.05, 24);
    P.ext(M.yellow, 0.85, 1.25, 0.1, 0.62, -0.14, 0.14, 0.06);
  }, boom);
  const bucket = new THREE.Group();
  bucket.position.set(LBm, 0, 0);
  boom.add(bucket);
  const BW = 3.1;
  tpl('loader-bucket', (P) => {
    P.add(M.yellow, extrude('wl-bshell', () => roundedPoly([...LB_OUT, ...LB_IN], [0.04, 0.14, 0.16, 0.22, 0.14, 0.04, 0.04, 0.12, 0.14, 0.12, 0.1, 0.04]), BW - 0.2, 0.06), 0, 0, 0);
    for (const s of [-1, 1]) P.add(M.yellow, extrude('wl-bside', () => roundedPoly(LB_OUT, [0.04, 0.14, 0.16, 0.22, 0.14, 0.04]), 0.12, 0.04), 0, 0, s * (BW / 2 - 0.06));
    P.ext(M.ink, 1.12, 1.4, -0.62, -0.5, -BW / 2 + 0.02, BW / 2 - 0.02, 0.04);
    for (const s of [-1, 1]) P.ext(M.yellow, -0.16, 0.16, -0.22, 0.6, s * 0.62 - 0.12, s * 0.62 + 0.12, 0.06);
    P.ext(M.yellow, -0.18, 0.16, 0.3, 0.74, -0.14, 0.14, 0.06);
  }, bucket);
  const load = heap('loader-bucket', {clods: 6, seed: 9});
  bucket.add(load);
  const bucketLip = new THREE.Object3D();
  bucketLip.position.set(1.38, -0.56, 0);
  bucket.add(bucketLip);
  // the rams: 2 lift rams under the arms, the tilt ram from the cross tube to the bucket's top ear
  const lifts = [-0.62, 0.62].map((z) => ({set: ram(front, 0.11, 1.0), z}));
  const tiltRam = ram(boom, 0.1, 0.8);
  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  let liftA = lowA;
  let tiltA = 0;
  const apply = () => {
    boom.rotation.z = liftA;
    bucket.rotation.z = -liftA + tiltA;
    const c = Math.cos(liftA);
    const s = Math.sin(liftA);
    for (const r of lifts) r.set(_a.set(1.15, 1.02, r.z), _b.set(BP.x + c * 1.35 - s * -0.2, BP.y + s * 1.35 + c * -0.2, r.z));
    const ba = bucket.rotation.z;
    tiltRam(_a.set(1.05, 0.58, 0), _b.set(LBm + Math.cos(ba) * -0.02 - Math.sin(ba) * 0.62, Math.sin(ba) * -0.02 + Math.cos(ba) * 0.62, 0));
  };
  const setLift = (k) => {
    liftA = lerp(lowA, 0.78, sat(k));
    apply();
  };
  const setBucket = (k) => {
    tiltA = k >= 0 ? 0.8 * Math.min(1, k) : 1.05 * Math.max(-1, k);
    apply();
  };
  const setLoad = (k) => {
    const s = sat(k);
    load.visible = s > 0.01;
    load.position.set(0.74, -0.45, 0);
    load.scale.set(0.58, 0.25 + 0.55 * s, 1.38);
  };
  setLift(0);
  setBucket(0);
  setLoad(0);
  const setSteer = (a) => {
    front.rotation.y = a;
  };
  return {group, roll: roller(wheels), setSteer, setLift, setBucket, setLoad, bucketLip, dims: {length: 7.0, width: BW}};
}

// ================================================================ the roller
export function buildToyRoller({number = '02'} = {}) {
  const M = mats();
  const group = new THREE.Group();
  group.name = 'roller';
  const PX = 0.28;
  const DR = 0.8;
  const DX = 1.42; // drum axle, front-frame local + PX
  tpl(`roller|${number}`, (P) => {
    P.ext(M.chassis, -2.4, PX + 0.05, 0.56, 1.3, -0.72, 0.72, 0.14);
    P.add(M.blue, extrude('rl-hood', () => profile(-2.5, -0.62, 1.22, 2.26, {rc: [0.1, 0.06, 0.16, 0.42]}, 0.15), 1.74, 0.15), 0, 0, 0);
    P.ext(M.ink, -2.56, -2.48, 1.42, 2.02, -0.56, 0.56, 0.05);
    for (let k = 0; k < 3; k++) P.ext(M.bumper, -2.58, -2.53, 1.52 + k * 0.15, 1.56 + k * 0.15, -0.48, 0.48, 0.015);
    P.ext(M.yellow, -2.66, -2.3, 0.48, 1.1, -1.0, 1.0, 0.12);
    for (const s of [-1, 1]) P.add(M.blue, fender(0.82, 0.98, 0.86), -1.55, 0.75, s * 1.0);
    const x0 = -0.82;
    const x1 = 0.36;
    const y0 = 1.24;
    const y1 = 3.12;
    P.add(M.blue, extrude('rl-cab', () => profile(x0, x1, y0, y1, {rc: [0.06, 0.06, 0.24, 0.2]}, 0.13), 1.62, 0.13), 0, 0, 0);
    P.ext(M.blue, x0 - 0.06, x1 + 0.08, y1 - 0.06, y1 + 0.08, -0.87, 0.87, 0.07);
    P.ext(M.glass, x1 - 0.06, x1 + 0.035, y0 + 0.5, y1 - 0.22, -0.64, 0.64, 0.06);
    P.ext(M.glass, x0 - 0.035, x0 + 0.06, y0 + 0.6, y1 - 0.24, -0.6, 0.6, 0.06);
    for (const s of [-1, 1]) P.ext(M.glass, x0 + 0.14, x1 - 0.14, y0 + 0.5, y1 - 0.2, s > 0 ? 0.77 : -0.845, s > 0 ? 0.845 : -0.77, 0.06);
    P.beacon(x0 + 0.3, y1 + 0.08, 0.42, 0.11);
    P.sides((s, z, ry) => P.text(`R ${number}`, {fg: TOY.white, px: 110}, 0.26, -1.95, 2.0, z + s * 0.004, ry), 0.87);
  }, group);
  const wheels = [];
  axle(group, wheels, 0.75, 0.74, -1.55, 1.0);
  // the front frame: the yellow drum yoke and the drum
  const front = new THREE.Group();
  front.position.x = PX;
  group.add(front);
  const dx = DX - PX;
  tpl('roller-front', (P) => {
    P.ext(M.ink, -0.05, 0.42, 0.6, 1.2, -0.42, 0.42, 0.08);
    // the yoke: 2 big side plates over the drum's ends, a cross beam at the hitch, a bumper bar in front; the drum shows
    const yoke = () => roundedPoly([V2(0.22, 0.48), V2(dx + 0.3, 0.3), V2(dx + 1.0, 0.72), V2(dx + 1.0, 1.32), V2(dx + 0.42, 1.76), V2(0.22, 1.76)], [0.1, 0.34, 0.26, 0.3, 0.4, 0.1]);
    for (const s of [-1, 1]) {
      P.add(M.yellow, extrude('rl-yoke', yoke, 0.16, 0.05), 0, 0, s * 1.2);
      P.add(M.hub, hubGeo(0.62, 0.06), dx, DR, s * 1.29);
      P.add(M.hubCap, capGeo(0.62, 0.08), dx, DR, s * 1.29);
    }
    P.ext(M.yellow, 0.16, 0.62, 1.02, 1.78, -1.28, 1.28, 0.12);
    P.ext(M.yellow, dx + 0.84, dx + 1.08, 0.92, 1.3, -1.28, 1.28, 0.1);
    P.sides((s, z, ry) => P.text('AURORA', {fg: C.text, px: 110}, 0.2, 0.68, 1.5, z + s * 0.004, ry), 1.28);
    for (const s of [-1, 1]) P.ext(M.lamp, dx + 1.06, dx + 1.11, 1.04, 1.2, s * 0.95 - 0.13, s * 0.95 + 0.13, 0.03);
  }, front);
  const drum = new THREE.Group();
  drum.position.set(dx, DR, 0);
  front.add(drum);
  drum.userData.r = DR;
  tpl('roller-drum', (P) => {
    P.rcyl(M.drum, DR, DR, 2.2, 0, 0, 0, 'z', 0.08, 56);
    // 4 seams across the drum so the turn reads from above
    for (let i = 0; i < 4; i++) {
      const a = (i * PI) / 2;
      P.add(M.steel, rb(0.05, 0.12, 2.06, 0.02), Math.cos(a) * (DR + 0.005), Math.sin(a) * (DR + 0.005), 0, 0, 0, a);
    }
  }, drum);
  wheels.push(drum);
  const setSteer = (a) => {
    front.rotation.y = a;
  };
  return {group, roll: roller(wheels), setSteer, dims: {length: 5.0, width: 2.6}};
}

// ================================================================ the flatbed and its loads
function loadRebar(P) {
  const M = mats();
  for (const z of [-1.08, 0, 1.08]) {
    for (const x of [-4.5, -1.6, 1.3]) P.ext(M.timber, x - 0.12, x + 0.12, 0, 0.16, z - 0.5, z + 0.5, 0.03);
    // a trapezoid stack of long bars
    const rows = [8, 7, 6, 5];
    rows.forEach((n, j) => {
      for (let i = 0; i < n; i++) {
        const zz = z + (i - (n - 1) / 2) * 0.11;
        P.cyl(M.rebar, 0.048, 0.048, 7.7, -1.6 + ((i * 7 + j * 3) % 5) * 0.04, 0.21 + j * 0.092, zz, 'x', 8);
      }
    });
    for (const x of [-4.0, -1.6, 0.8]) {
      P.ext(M.strap, x - 0.06, x + 0.06, 0.12, 0.6, z - 0.5, z - 0.44, 0.015);
      P.ext(M.strap, x - 0.06, x + 0.06, 0.12, 0.6, z + 0.44, z + 0.5, 0.015);
      P.ext(M.strap, x - 0.06, x + 0.06, 0.56, 0.62, z - 0.5, z + 0.5, 0.015);
    }
  }
}
function loadBlocks(P) {
  const M = mats();
  const geo = rbox(0.56, 0.27, 0.27, 0.035, 1);
  for (const x of [-4.4, -2.35, -0.3, 1.75])
    for (const z of [-0.86, 0.86]) {
      // a pallet, 3 layers of blocks crossing each other, a yellow strap
      P.ext(M.timber, x - 0.66, x + 0.66, 0, 0.16, z - 0.66, z + 0.66, 0.03);
      for (let l = 0; l < 3; l++) {
        const cross = l % 2;
        for (let i = 0; i < 2; i++)
          for (let j = 0; j < 4; j++) {
            const a = (i - 0.5) * 0.6;
            const b = (j - 1.5) * 0.3;
            P.add(M.block, geo, x + (cross ? b : a), 0.16 + 0.14 + l * 0.28, z + (cross ? a : b), 0, cross ? PI / 2 : 0, 0);
          }
      }
      P.ext(M.strap, x - 0.05, x + 0.05, 0.14, 1.02, z - 0.64, z - 0.6, 0.012);
      P.ext(M.strap, x - 0.05, x + 0.05, 0.14, 1.02, z + 0.6, z + 0.64, 0.012);
      P.ext(M.strap, x - 0.05, x + 0.05, 0.99, 1.03, z - 0.64, z + 0.64, 0.012);
    }
}
function loadPipes(P) {
  const M = mats();
  const ro = 0.62;
  const ri = 0.47;
  const L = 2.3;
  // a hollow ring section with soft rims, axis y, from y = 0 to y = len
  const ring = (key, r0, r1, len) =>
    cg(key, () => {
      const b = Math.min(0.05, (r1 - r0) * 0.4);
      const pts = [V2(r0 + b, 0), V2(r1 - b, 0), V2(r1, b), V2(r1, len - b), V2(r1 - b, len), V2(r0 + b, len), V2(r0, len - b), V2(r0, b), V2(r0 + b, 0)];
      return new THREE.LatheGeometry(pts, 40);
    });
  const pipe = ring('pipe', ri, ro, L);
  const bell = ring('pipe-bell', ri + 0.06, ro + 0.1, 0.34);
  const bore = cg('pipe-bore', () => new THREE.CylinderGeometry(ri + 0.004, ri + 0.004, L - 0.02, 40, 1, true).translate(0, L / 2, 0));
  const band = cg('pipe-strap', () => new THREE.TorusGeometry(ro + 0.014, 0.03, 6, 44));
  const cy = ro + 0.16;
  // 5 pipes across the deck, their bores facing the sides, on 2 bearers with chocks between them
  const xs = [-5.0, -3.5, -2.0, -0.5, 1.0];
  for (const z of [-0.72, 0.72]) P.ext(M.timber, xs[0] - 0.75, xs[4] + 0.75, 0, 0.16, z - 0.13, z + 0.13, 0.03);
  for (const x of xs) {
    P.add(M.pipe, pipe, x, cy, -L / 2, PI / 2, 0, 0);
    P.add(M.pipe, bell, x, cy, -L / 2 - 0.04, PI / 2, 0, 0);
    P.add(M.bore, bore, x, cy, -L / 2, PI / 2, 0, 0);
    P.add(M.strap, band, x, cy, 0.2);
    for (const z of [-0.72, 0.72]) for (const s of [-1, 1]) P.ext(M.timber, x + s * 0.6 - 0.1, x + s * 0.6 + 0.1, 0.16, 0.34, z - 0.1, z + 0.1, 0.03);
  }
}

export function buildToyFlatbed({load = 'rebar', number = '09'} = {}) {
  const M = mats();
  const group = new THREE.Group();
  group.name = 'flatbed';
  const W = 3.5;
  const R = 0.75;
  const deckY = 1.74;
  const rearX = [-2.95, -4.42];
  tpl(`flatbed|${number}`, (P) => {
    cab(P, {x0: 3.05, x1: 6.0, top: 4.1, W, color: TOY.blue, wheelX: 4.35, wheelR: R, seam: TOY.blueDeep});
    for (const s of [-1, 1]) P.ext(M.chassis, -5.95, 3.6, 0.92, 1.42, s * 0.75 - 0.15, s * 0.75 + 0.15, 0.07);
    // the deck: a light floor on blue side beams, stake pockets, the headboard behind the cab
    P.ext(M.panel, -6.05, 2.82, deckY - 0.2, deckY, -1.74, 1.74, 0.06);
    for (const s of [-1, 1]) {
      P.ext(M.blue, -6.1, 2.86, 1.38, deckY - 0.04, s > 0 ? 1.62 : -1.8, s > 0 ? 1.8 : -1.62, 0.07);
      for (let x = -5.5; x < 2.6; x += 1.36) P.ext(M.ink, x - 0.08, x + 0.08, 1.44, deckY - 0.08, s > 0 ? 1.79 : -1.83, s > 0 ? 1.83 : -1.79, 0.015);
    }
    for (const s of [-1, 1]) P.ext(M.blue, 2.6, 2.86, deckY, 3.72, s * 1.62 - 0.11, s * 1.62 + 0.11, 0.07);
    for (const y of [2.3, 2.9, 3.52]) P.ext(M.blue, 2.62, 2.84, y - 0.1, y + 0.1, -1.62, 1.62, 0.06);
    P.ext(M.blueLight, 2.68, 2.78, deckY, 3.42, -1.5, 1.5, 0.02);
    // the side beams carry the wordmark in white
    P.sides((s, z, ry) => P.brand({fg: '#ffffff', markBg: '#ffffff'}, 0.26, -3.5, 1.55, z + s * 0.004, ry), 1.8);
    // side boxes, mudguards, the rear light bar and under-ride bar
    for (const s of [-1, 1]) {
      P.ext(M.blue, -1.85, 2.4, 0.55, 1.34, s * 1.08, s * 1.64, 0.18);
      P.ext(M.blueLight, -1.7, 2.25, 1.3, 1.35, s * 1.15, s * 1.57, 0.02);
      P.ext(M.ink, rearX[1] - 0.9, rearX[0] + 0.9, 1.48, 1.56, s * 1.12, s * 1.78, 0.03);
      P.ext(M.tail, -6.15, -6.09, 1.42, 1.58, s * 1.35 - 0.16, s * 1.35 + 0.16, 0.03);
    }
    P.ext(M.chassis, -6.12, -5.9, 0.62, 0.9, -1.6, 1.6, 0.08);
    for (const s of [-1, 1]) P.text(`F-${number}`, {fg: TOY.white, px: 110}, 0.3, 3.61, 1.98, s * (W / 2 + 0.008), s > 0 ? 0 : PI);
  }, group);
  if (load !== 'none') {
    const L = new THREE.Group();
    L.position.y = deckY;
    group.add(L);
    tpl(`flatbed-load|${load}`, (P) => (load === 'blocks' ? loadBlocks(P) : load === 'pipes' ? loadPipes(P) : loadRebar(P)), L);
  }
  const wheels = [];
  const steer = [];
  axle(group, wheels, R, 0.64, 4.35, 1.4, steer);
  for (const x of rearX) axle(group, wheels, R, 0.64, x, 1.5);
  return {group, roll: roller(wheels), setSteer: steerer(steer), deckY, dims: {length: 12.2, width: W + 0.7}};
}
