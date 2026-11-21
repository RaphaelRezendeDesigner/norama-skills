// The toy car plant's hall and logistics kit, built in the airport kit's style
// (airport-shared/gse.js, airside.js, style.js) which itself matches the reference video
//: toy proportions, generous bevels, matte paint with a soft clearcoat, crisp
// printed numbers and logos, blue + white on lavender, yellow only on safety parts (walkway lines, bollards, column
// guards, bumpers, the gate interlock). Colours style.js lacks are in PLANT below. Toy metres, y up, nose / flow
// toward +x, origin on the ground at the object's centre.
//
//   buildToyHall({length = 180, width = 72, zones, doors, wallH = 2.4, columns = {dx: 20, z: [-30, -10, 10, 30]}})
//       -> {group, zones: [{name, x0, x1}], doors: [{x, z, normal, w, h, name, side}], columns: [{x, z}],
//           setDoor(i, k), length, width, wallH}
//       Open top. Floor centred on the origin (x along the length, z across). Low ribbed light walls with a blue cap,
//       blue corner posts, slim blue columns with yellow guards, a 3 m yellow walkway along both long walls and a
//       cross walkway at every zone boundary, zone plates with painted names, roll-up doors in tall blue portals.
//       zones: [{name, w}] laid out from -x, or [{name, x0, x1}]; default BODY SHOP 54 / PAINT 40 / ASSEMBLY 56 / QA 30.
//       doors: [{side: '+z' | '-z' | '+x' | '-x', at (x on a z wall, z on an x wall), w = 8, h = 6.6, name}];
//       default: one in each end wall at z = 0 and two in the +z wall. door.normal points out of the hall.
//       setDoor(i, k): k = 1 open (shutter rolled up), 0 shut. All doors start open.
//       columns: false for none, or {dx, z: [...], skip(x, z) -> bool, h}.
//   buildToyAGV({number = '07', rack = 'boxes' | 'tyres' | 'doors' | 'seats' | null})
//       -> {group, roll(d), setLift(h), slot, rack, length: 3.2, width: 1.8}
//       A low white cart with a blue skirt, yellow bumpers, lidar pucks and a light strip. setLift(h), h = 0..0.35,
//       raises the lift plate; slot (Object3D) sits on the plate, the rack (a Group, or null) is already on it.
//   buildToyPartsRack({kind = 'boxes' | 'tyres' | 'doors' | 'seats' | 'empty', w = 3.6, d = 1.5, h = 2.6, levels = 2,
//       seed = 1, cart = false}) -> Group   (origin on the floor under the rack's centre; cart = the low AGV version)
//   buildToyCarCarrier({livery = 'aurora' | 'kestrel', number = '24'})
//       -> {group, roll(d), setSteer(a), setRamp(k), setDeck(k), setHitch(a), slots: [Object3D x6], ramp, length}
//       27 m: the reference's box truck's cab-over cab on a tractor, a 2-deck trailer. slots[0..2] = lower deck front to rear
//       (deck top y = 1.1), slots[3..5] = upper deck front to rear (y = 3.6 level). Each slot's origin is on the deck
//       surface where a car's tyres stand, under the car's centre, x forward: a finished car (origin on the ground
//       under its centre) goes in with slot.add(car.group). setRamp(k): 0 = stowed upright, 1 = foot on the ground.
//       setDeck(k): 0 = upper deck level, 1 = its rear end lowered to 1.5 m for loading (the upper slots ride with it).
//       setHitch(a): the trailer turns about the kingpin. ramp = {pivot, top, foot, length} in the group's frame
//       (top = the hinge on the lower deck, foot = where the ramp meets the ground at k = 1).
//   buildToyCellFence({w = 12, d = 9, h = 2.2, gate = '+z', open = ['-x', '+x'], openW = 3.6}) -> Group
//       Translucent panels in blue frames on blue posts round a w (x) by d (z) cell centred on the origin, gaps
//       openW wide in the middle of the `open` sides (the conveyor), a gate with a yellow interlock on the gate side.
//       group.userData.setGate(k) swings the gate open (k = 1, 90 deg out).
//   buildToyTireStack({n = 4, r = 0.5, w = 0.38}) -> Group   finished wheels lying flat, dark tyres, light hubs
//   buildToyPallet({load = 'boxes' | 'totes' | 'wrap' | 'none', layers = 2, seed = 1}) -> Group   2.3 x 2.0 m
//   buildToySign({text, sub = '', kind = 'stand' | 'wall', h = 1.5}) -> Group
//       The reference's wall sign: a white rounded panel with the cube mark, the name in blue, a light-blue line under it.
//       'stand' = on 2 blue posts, panel bottom at 2.2 m, facing +z (printed both sides). 'wall' = the panel alone,
//       its back on z = 0, bottom at y = 0. group.userData.width = panel width.
//
// Static parts are merged per material and cached per variant, so a second copy only costs draw calls; moving parts
// (wheels, ramps, decks, lift plates, shutters, gates) are separate meshes on shared geometry. Text uses Inter:
// build after document.fonts has loaded it (runSim does that before setup).
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {TOY, rbox, toyMat} from '../airport-shared/style.js';
import {GSE_COLORS} from '../airport-shared/gse.js';
import {AIRSIDE} from '../airport-shared/airside.js';

const PI = Math.PI;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const V2 = (x, y) => new THREE.Vector2(x, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const C = GSE_COLORS;

/** colours style.js, GSE_COLORS and AIRSIDE have no entry for, sampled from the reference frames */
export const PLANT = {
  floor: '#e8ecf8', // the hall floor, a step lighter than the lot (the reference's apron)
  zone: ['#dae1f6', '#dae1f6'], // zone plates (the aisles between them stay floor colour)
  zoneText: '#4f7cea', // painted zone names: the brand blue, a touch softer, like paint on concrete
  wall: AIRSIDE.wall, // the reference's ribbed warehouse wall
  wallIn: '#eff2fb', // the plain inner face of the cut walls
  walk: TOY.yellow, // walkway lines (safety)
  seat: '#2a3148', // seats in the parts racks
  ecoat: '#c3cae0', // grey e-coat door panels
  led: '#9fd8ff', // the AGV light strip
  deck: '#c6cde4', // carrier decks and ramps: light steel
  deckDot: '#8d98bb',
  wrap: '#f3f5fc', // stretch-wrapped pallets
  fenceFrame: '#8fb0f7', // the panel frames, TOY.blueLight
};

const LIVERY = {
  aurora: {accent: TOY.blue, deep: TOY.blueDeep, light: TOY.blueLight, cab: TOY.blue, mark: 'aurora', name: 'Aurora', stripe: null},
  kestrel: {accent: TOY.teal, deep: '#178f83', light: C.tealLight, cab: TOY.white, mark: 'kestrel', name: 'Kestrel', stripe: TOY.teal},
};
const liv = (k) => LIVERY[k] ?? LIVERY.aurora;

// ================================================================ materials
const paint = (color, rough = 0.5) => toyMat(color, {paint: true, rough});
let MM = null;
function mats() {
  if (MM) return MM;
  const glow = (color, emissive, k, rough = 0.35) => new THREE.MeshStandardMaterial({color, roughness: rough, emissive, emissiveIntensity: k});
  // floor paint: flat, never casts, pulled toward the camera so it never fights the floor
  const floorPaint = (color, rough = 0.8, k = 2) => {
    const m = new THREE.MeshStandardMaterial({color, roughness: rough, polygonOffset: k > 0, polygonOffsetFactor: -k, polygonOffsetUnits: -2 * k});
    m.userData.noCast = true;
    return m;
  };
  MM = {
    white: paint(TOY.white),
    panel: paint(TOY.panel),
    blue: paint(TOY.blue, 0.48),
    blueDeep: paint(TOY.blueDeep, 0.48),
    blueLight: paint(TOY.blueLight, 0.5),
    yellow: paint(TOY.yellow, 0.5),
    ink: toyMat(C.ink, {rough: 0.62}),
    chassis: toyMat(C.chassis, {rough: 0.66}),
    tyre: toyMat(C.tyre, {rough: 0.82}),
    hub: toyMat(C.hub, {rough: 0.42}),
    hubCap: toyMat(C.hubCap, {rough: 0.45, metal: 0.1}),
    glass: toyMat(TOY.glass, {paint: true, rough: 0.12}),
    bumper: paint(C.bumper),
    steel: toyMat(C.steel, {rough: 0.42, metal: 0.25}),
    rubber: toyMat('#2a2f40', {rough: 0.85}),
    lamp: glow(C.lamp, '#fff1c8', 0.22, 0.3),
    tail: glow('#f0656a', TOY.red, 0.35, 0.3),
    led: glow(PLANT.led, '#5fbaff', 0.9, 0.3),
    wall: toyMat(PLANT.wall, {rough: 0.72}),
    wallIn: toyMat(PLANT.wallIn, {rough: 0.8}),
    shade: toyMat(TOY.shade, {rough: 0.6}),
    slat: toyMat(AIRSIDE.slat, {rough: 0.6}),
    pane: toyMat(AIRSIDE.pane, {opacity: 0.5, rough: 0.3}),
    cardboard: toyMat(TOY.cardboard, {rough: 0.82}),
    tape: toyMat('#efc898', {rough: 0.7}),
    pallet: toyMat(AIRSIDE.pallet, {rough: 0.85}),
    wrap: toyMat(PLANT.wrap, {paint: true, rough: 0.3}),
    seat: toyMat(PLANT.seat, {rough: 0.72}),
    ecoat: toyMat(PLANT.ecoat, {paint: true, rough: 0.5}),
    deck: toyMat(PLANT.deck, {rough: 0.48, metal: 0.15}),
    floor: floorPaint(PLANT.floor, 0.92, 0),
    zoneA: floorPaint(PLANT.zone[0], 0.9, 1),
    zoneB: floorPaint(PLANT.zone[1], 0.9, 1),
    walk: floorPaint(PLANT.walk, 0.7, 2),
    walkWhite: floorPaint('#f7f9fe', 0.7, 2),
  };
  return MM;
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
/** a printed layer: the texture's alpha is the print, it never casts shadows */
function decalMat(tex, {rough = 0.5, floor = false} = {}) {
  const key = tex.uuid + rough + floor;
  if (DECALS.has(key)) return DECALS.get(key);
  const m = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: rough,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: floor ? -3 : -2,
    polygonOffsetUnits: floor ? -8 : -4,
  });
  m.userData.noCast = true;
  DECALS.set(key, m);
  return m;
}
const FONT = 'Inter, "Segoe UI", system-ui, sans-serif';

/** the marks: aurora = a rounded square with a sun over a horizon, kestrel = 2 chevrons, cube = the reference's isometric crate */
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
    const cx = x + s / 2;
    const q = s * 0.46;
    const face = (pts, col) => {
      g.fillStyle = col;
      g.beginPath();
      pts.forEach(([u, v], i) => (i ? g.lineTo(u, v) : g.moveTo(u, v)));
      g.closePath();
      g.fill();
    };
    face([[cx, y + s * 0.04], [cx + q, y + s * 0.27], [cx, y + s * 0.5], [cx - q, y + s * 0.27]], L.light);
    face([[cx - q, y + s * 0.27], [cx, y + s * 0.5], [cx, y + s * 0.98], [cx - q, y + s * 0.74]], L.accent);
    face([[cx + q, y + s * 0.27], [cx, y + s * 0.5], [cx, y + s * 0.98], [cx + q, y + s * 0.74]], L.deep);
  }
  g.restore();
}

/** a text plate: fg text, optional rounded bg, sized to the text */
function textTex(text, {fg = C.text, bg = null, weight = 800, px = 96, pad = 26, italic = false} = {}) {
  const key = `txt|${text}|${fg}|${bg}|${weight}|${px}|${italic}`;
  if (TEX.has(key)) return TEX.get(key);
  const font = `${italic ? 'italic ' : ''}${weight} ${px}px ${FONT}`;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
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
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, W / 2, H / 2 + px * 0.04);
  });
}

/** the reference's wall sign: a white rounded panel, the cube mark, the name in blue and a light line under it */
function signTex(name, sub) {
  const key = `sign|${name}|${sub}`;
  if (TEX.has(key)) return TEX.get(key);
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `800 92px ${FONT}`;
  let tw = probe.measureText(name).width;
  probe.font = `600 42px ${FONT}`;
  tw = Math.max(tw, sub ? probe.measureText(sub).width : 0);
  const w = Math.ceil(tw + 290);
  const h = 200;
  return canvasTex(key, w, h, (g) => {
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.roundRect(2, 2, w - 4, h - 4, 30);
    g.fill();
    drawMark(g, 'cube', 46, h / 2 - 50, 100, LIVERY.aurora);
    g.fillStyle = TOY.blue;
    g.font = `800 92px ${FONT}`;
    g.textBaseline = 'middle';
    g.fillText(name, 176, sub ? h / 2 - 20 : h / 2 + 4);
    if (sub) {
      g.fillStyle = TOY.blueLight;
      g.font = `600 42px ${FONT}`;
      g.fillText(sub, 180, h / 2 + 52);
    }
  });
}

// ================================================================ geometry kit (the same kit as gse.js)
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
  // bevels under 2.5 cm never show at the reference's distance: thin panes, frames, seams and plates stay plain boxes
  if (r < 0.025) return cg(`b|${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
  return rbox(w, h, d, r, 3);
}
const cylG = (r0, r1, h, seg = 20) => cg(`cy|${r0}|${r1}|${h}|${seg}`, () => new THREE.CylinderGeometry(r0, r1, h, seg));
const sphere = (r) => cg(`sp|${r}`, () => new THREE.SphereGeometry(r, 18, 12));
const dome = (r) => cg(`dome|${r}`, () => new THREE.SphereGeometry(r, 18, 8, 0, PI * 2, 0, PI / 2));
const planeG = (w, h) => cg(`pl|${w.toFixed(3)}|${h.toFixed(3)}`, () => new THREE.PlaneGeometry(w, h));
/** a soft-edged cylinder (lathe with rounded rims), axis y, centred */
function rcyl(r0, r1, h, b = 0.06, seg = 28) {
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
  /** a soft-edged cylinder along 'x', 'y' or 'z' */
  rcyl(mat, r0, r1, h, x, y, z, axis = 'y', b = 0.06, seg = 28) {
    const g = rcyl(r0, r1, h, b, seg);
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
  /** a square bar with rounded edges between two points (posts, braces, rails) */
  bar(mat, a, b, t = 0.12) {
    const A = V3(...a);
    const d = V3(...b).sub(A);
    const len = d.length();
    _q.setFromUnitVectors(V3(0, 1, 0), d.clone().normalize());
    return this.put(mat, rb(t, len + t, t, t * 0.4), _m.compose(A.addScaledVector(d, 0.5), _q, _s.set(1, 1, 1)));
  }
  /** a flat print of width w, height h facing +z, turned by ry (rx tips it) */
  print(mat, w, h, x, y, z, ry = 0, rx = 0) {
    return this.add(mat, planeG(w, h), x, y, z, rx, ry, 0);
  }
  /** a text plate of height h, facing +z turned by ry */
  text(text, opts, h, x, y, z, ry = 0) {
    const tex = textTex(text, opts);
    const a = tex.image.width / tex.image.height;
    return this.print(decalMat(tex), h * a, h, x, y, z, ry);
  }
  /** a flat strip on the floor from (x0, z0) to (x1, z1), w wide, at height y */
  strip(mat, x0, z0, x1, z1, w, y = 0) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    return this.add(mat, planeG(len, w), (x0 + x1) / 2, y, (z0 + z1) / 2, -PI / 2, 0, Math.atan2(-(z1 - z0), x1 - x0));
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

// ================================================================ wheels (gse.js's wheel, to the millimetre)
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
/** a static wheel (tyre, hub, cap) merged into P at x, y, z with its axis turned by rx, ry */
function wheelInto(P, r, w, x, y, z, rx = 0, ry = 0, rz = 0) {
  const M = mats();
  P.add(M.tyre, tyreGeo(r, w), x, y, z, rx, ry, rz);
  P.add(M.hub, hubGeo(r, w), x, y, z, rx, ry, rz);
  P.add(M.hubCap, capGeo(r, w), x, y, z, rx, ry, rz);
}
/** a pair of wheels at x, +-z; steer = [] puts each on a pivot */
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

// ================================================================ the reference's cab-over cab (gse.js, the box truck's)
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
  const wt = Math.min(top - 0.12 * H, top - 0.46);
  const wb = top - 0.5 * H;
  P.ext(M.glass, x1 - 0.08, x1 + 0.035, wb, wt, -hw + 0.27, hw - 0.27, 0.05);
  for (const s of [-1, 1]) {
    P.ext(M.glass, x1 - Math.min(1.62, (x1 - x0) * 0.56), x1 - 0.34, wb, wt, s > 0 ? hw - 0.06 : -hw - 0.035, s > 0 ? hw + 0.035 : -hw + 0.06, 0.05);
    P.ext(paint(seam), x1 - Math.min(1.8, (x1 - x0) * 0.62), x1 - Math.min(1.76, (x1 - x0) * 0.62) + 0.04, y0 + 0.85, top - 0.3, s > 0 ? hw - 0.02 : -hw - 0.012, s > 0 ? hw + 0.012 : -hw + 0.02, 0.008);
    P.ext(M.ink, x1 - 1.45, x1 - 1.15, wb - 0.3, wb - 0.22, s > 0 ? hw - 0.02 : -hw - 0.04, s > 0 ? hw + 0.04 : -hw + 0.02, 0.02);
    P.bar(M.ink, [x1 - 0.2, wt - 0.25, s * (hw - 0.05)], [x1 - 0.05, wt - 0.25, s * (hw + 0.36)], 0.07);
    P.ext(M.ink, x1 - 0.12, x1 + 0.02, wt - 0.95, wt - 0.12, s * (hw + 0.32) - 0.1, s * (hw + 0.32) + 0.1, 0.05);
    if (stripe) P.ext(paint(stripe, 0.46), x0 + 0.22, x1 - 0.3, wb - 0.55, wb - 0.33, s > 0 ? hw - 0.02 : -hw - 0.02, s > 0 ? hw + 0.02 : -hw + 0.02, 0.01);
  }
  const gb = y0 + 0.18 * H;
  const gt = wb - 0.07 * H;
  P.ext(M.ink, x1 - 0.06, x1 + 0.04, gb, gt, -0.92, 0.92, 0.06);
  const n = 5;
  for (let k = 0; k < n; k++) P.ext(M.bumper, x1 + 0.01, x1 + 0.065, gb + ((gt - gb) * (k + 0.55)) / (n + 0.1) - 0.03, gb + ((gt - gb) * (k + 0.55)) / (n + 0.1) + 0.03, -0.8, 0.8, 0.02);
  for (const s of [-1, 1]) P.ext(M.lamp, x1 - 0.05, x1 + 0.045, gb, gb + 0.1 * H, s > 0 ? hw - 0.62 : -hw + 0.2, s > 0 ? hw - 0.2 : -hw + 0.62, 0.06);
  P.ext(M.bumper, x1 - 0.3, x1 + 0.28, y0 - 0.06, y0 + 0.56, -hw - 0.08, hw + 0.08, 0.2);
}

// ================================================================ the hall
const DEFAULT_ZONES = [
  {name: 'BODY SHOP', w: 54},
  {name: 'PAINT', w: 40},
  {name: 'ASSEMBLY', w: 56},
  {name: 'QA', w: 30},
];
const shutterGeo = (w, h) =>
  cg(`shutter|${w}|${h}`, () => {
    // built hanging down from y = 0, so scaling y rolls it up into the drum
    const parts = [prep(rb(w, h, 0.1, 0.04)).translate(0, -h / 2, 0)];
    for (let y = 0.36; y < h - 0.1; y += 0.42) parts.push(prep(new THREE.BoxGeometry(w - 0.06, 0.07, 0.14)).translate(0, -y, 0));
    return mergeGeometries(parts, false);
  });
/** a hatched keep-clear box: a yellow outline and diagonal yellow stripes, w x d metres */
const hatchTex = (w, d) =>
  canvasTex(`hatch|${w}|${d}`, Math.round(w * 64), Math.round(d * 64), (g, W, H) => {
    const s = 64;
    g.strokeStyle = PLANT.walk;
    g.lineWidth = 0.24 * s;
    g.strokeRect(0.12 * s, 0.12 * s, W - 0.24 * s, H - 0.24 * s);
    g.save();
    g.beginPath();
    g.rect(0.3 * s, 0.3 * s, W - 0.6 * s, H - 0.6 * s);
    g.clip();
    g.lineWidth = 0.32 * s;
    for (let x = -H; x < W + H; x += 1.25 * s) {
      g.beginPath();
      g.moveTo(x, H);
      g.lineTo(x + H, 0);
      g.stroke();
    }
    g.restore();
  });

export function buildToyHall({length = 180, width = 72, zones = DEFAULT_ZONES, doors = null, wallH = 2.4, columns = {}} = {}) {
  const M = mats();
  const L = length;
  const W = width;
  const t = 0.5; // wall thickness
  const aisle = [1.4, 4.4]; // the walkway's 2 lines, measured from the wall's inner face
  // ---- zones: [{name, w}] laid end to end from -x, scaled to the length, or [{name, x0, x1}] as given
  let zs;
  if (zones.every((z) => z.x0 !== undefined)) zs = zones.map((z) => ({name: z.name, x0: z.x0, x1: z.x1}));
  else {
    const sum = zones.reduce((a, z) => a + (z.w ?? 1), 0);
    let x = -L / 2;
    zs = zones.map((z) => {
      const x0 = x;
      x += ((z.w ?? 1) / sum) * L;
      return {name: z.name, x0, x1: x};
    });
  }
  // ---- doors
  const dspec = (doors ?? [
    {side: '-x', at: 0},
    {side: '+x', at: 0},
    {side: '+z', at: -L * 0.3},
    {side: '+z', at: L * 0.36},
  ]).map((d, i) => ({w: 8, h: 6.6, name: `G${i + 1}`, ...d}));
  // a wall's frame: u along the wall, y up, n out of the hall; returns the matrix and the length
  const wallFrame = (side) => {
    if (side === '+z') return {m: new THREE.Matrix4().makeTranslation(0, 0, W / 2), len: L, u: (x, z) => x};
    if (side === '-z') return {m: new THREE.Matrix4().makeTranslation(0, 0, -W / 2).multiply(new THREE.Matrix4().makeRotationY(PI)), len: L, u: (x, z) => -x};
    if (side === '+x') return {m: new THREE.Matrix4().makeTranslation(L / 2, 0, 0).multiply(new THREE.Matrix4().makeRotationY(PI / 2)), len: W, u: (x, z) => -z};
    return {m: new THREE.Matrix4().makeTranslation(-L / 2, 0, 0).multiply(new THREE.Matrix4().makeRotationY(-PI / 2)), len: W, u: (x, z) => z};
  };
  const doorList = dspec.map((d) => {
    const n = {'+z': V3(0, 0, 1), '-z': V3(0, 0, -1), '+x': V3(1, 0, 0), '-x': V3(-1, 0, 0)}[d.side];
    const x = d.side === '+x' ? L / 2 : d.side === '-x' ? -L / 2 : d.at;
    const z = d.side === '+z' ? W / 2 : d.side === '-z' ? -W / 2 : d.at;
    return {x, z, normal: n, w: d.w, h: d.h, name: d.name, side: d.side};
  });
  // ---- columns on the grid
  const col = columns === false ? null : {dx: 20, z: [-30, -10, 10, 30], h: 5.2, skip: null, ...columns};
  const colList = [];
  if (col) {
    for (let x = -L / 2 + col.dx; x < L / 2 - 1; x += col.dx)
      for (const z of col.z) if (!(col.skip && col.skip(x, z))) colList.push({x, z});
  }
  const key = `hall|${L}|${W}|${wallH}|${JSON.stringify(zs)}|${JSON.stringify(dspec)}|${JSON.stringify(colList)}|${col?.h}`;
  const group = new THREE.Group();
  group.name = 'hall';
  tpl(key, (P) => {
    // the floor and the zone plates
    P.add(M.floor, planeG(L, W), 0, 0.012, 0, -PI / 2);
    const zIn = W / 2 - t - aisle[1] - 0.7;
    zs.forEach((z, i) => {
      const x0 = z.x0 + (i > 0 ? 2.2 : 0.7);
      const x1 = z.x1 - (i < zs.length - 1 ? 2.2 : 0.7);
      P.add(i % 2 ? M.zoneB : M.zoneA, planeG(x1 - x0, zIn * 2), (x0 + x1) / 2, 0.016, 0, -PI / 2);
    });
    // walkways: 2 yellow lines along both long walls, a cross walkway at every zone boundary
    const lw = 0.26;
    for (const s of [-1, 1]) {
      for (const a of aisle) {
        const z = s * (W / 2 - t - a);
        P.strip(M.walk, -L / 2 + t + aisle[0], z, L / 2 - t - aisle[0], z, lw, 0.022);
      }
    }
    for (const sx of [-1, 1]) for (const a of aisle) {
      const x = sx * (L / 2 - t - a);
      P.strip(M.walk, x, -(W / 2 - t - aisle[0]), x, W / 2 - t - aisle[0], lw, 0.022);
    }
    zs.slice(1).forEach((z) => {
      for (const s of [-1, 1]) {
        const x = z.x0 + s * 1.5;
        const zz = W / 2 - t - aisle[1];
        P.strip(M.walk, x, -zz, x, zz, lw, 0.022);
      }
      // zebra where the cross walkway meets the aisles
      for (const s of [-1, 1]) {
        const zc = s * (W / 2 - t - (aisle[0] + aisle[1]) / 2);
        for (let k = -2; k <= 2; k++) P.strip(M.walkWhite, z.x0 - 1.1, zc + k * 0.6, z.x0 + 1.1, zc + k * 0.6, 0.3, 0.021);
      }
    });
    // painted zone names, reading from the +z side, in the front strip of each zone
    zs.forEach((z) => {
      const tex = textTex(z.name, {fg: PLANT.zoneText, px: 150, weight: 800, pad: 10});
      const h = 4.4;
      const a = tex.image.width / tex.image.height;
      const w = Math.min(h * a, z.x1 - z.x0 - 8);
      const hh = w / a;
      P.add(decalMat(tex, {floor: true, rough: 0.85}), planeG(w, hh), z.x0 + 3.2 + w / 2, 0.03, zIn - 1.6 - hh / 2, -PI / 2);
    });
    // keep-clear boxes inside every door
    for (const d of doorList) {
      const tex = hatchTex(d.w + 2, 4);
      const n = d.normal;
      const cx = d.x - n.x * (t + 2.6);
      const cz = d.z - n.z * (t + 2.6);
      P.add(decalMat(tex, {floor: true, rough: 0.8}), planeG(d.w + 2, 4), cx, 0.026, cz, -PI / 2, 0, n.x !== 0 ? PI / 2 : 0);
    }
    // ---- the walls: ribbed light outer face, plain inner face, a blue cap along the cut, blue corners
    for (const side of ['+z', '-z', '+x', '-x']) {
      const F = wallFrame(side);
      const gaps = doorList.filter((d) => d.side === side).map((d) => {
        const u = F.u(d.x, d.z);
        return [u - d.w / 2, u + d.w / 2];
      });
      gaps.sort((a, b) => a[0] - b[0]);
      // solid runs between the openings (the corners overlap: the x walls run between the z walls)
      const half = side === '+x' || side === '-x' ? F.len / 2 - t : F.len / 2;
      const runs = [];
      let u0 = -half;
      for (const [a, b] of gaps) {
        runs.push([u0, a]);
        u0 = b;
      }
      runs.push([u0, half]);
      const at = (mat, geo, u, y, n, sx = 1, sy = 1, sz = 1) => P.put(mat, geo, F.m.clone().multiply(new THREE.Matrix4().compose(_p.set(u, y, n), _q.identity(), _s.set(sx, sy, sz))));
      for (const [a, b] of runs) {
        const w = b - a;
        if (w < 0.05) continue;
        const uc = (a + b) / 2;
        at(M.wall, rb(w, wallH, t * 0.55, 0.08), uc, wallH / 2, -t * 0.275);
        at(M.wallIn, rb(w, wallH - 0.02, t * 0.5, 0.06), uc, wallH / 2 - 0.01, -t * 0.72);
        at(M.blue, rb(w + 0.06, 0.26, t + 0.2, 0.11), uc, wallH + 0.11, -t / 2);
        // a light-blue kick strip along the bottom of the outer face
        at(M.blueLight, rb(w, 0.32, 0.1, 0.04), uc, 0.18, 0.02);
        // ribs on the outer face
        const pitch = 0.78;
        const n = Math.floor((w - 0.5) / pitch);
        const off = (w - n * pitch) / 2;
        for (let k = 0; k <= n; k++) {
          const u = a + off + k * pitch;
          at(M.wall, cg('hall-rib', () => new THREE.BoxGeometry(0.17, 1, 0.08)), u, (0.36 + wallH - 0.02) / 2, 0.035, 1, wallH - 0.38, 1);
        }
      }
      // corner posts, a step taller than the cap
      if (side === '+z' || side === '-z')
        for (const s of [-1, 1]) at(M.blue, rb(0.95, wallH + 0.55, 0.95, 0.24), s * (L / 2 - t / 2 + 0.02), (wallH + 0.55) / 2, -t / 2 + 0.02);
      // the door portals: blue posts and lintel, the shutter drum, bollards inside
      for (const d of doorList.filter((dd) => dd.side === side)) {
        const u = F.u(d.x, d.z);
        const H = d.h;
        for (const s of [-1, 1]) {
          at(M.blue, rb(0.75, H + 1.1, 0.95, 0.2), u + s * (d.w / 2 + 0.36), (H + 1.1) / 2, -t / 2);
          // yellow bollards on the inside, a dark band near the top
          at(M.yellow, rcyl(0.24, 0.24, 1.15, 0.08, 24), u + s * (d.w / 2 + 0.6), 0.6, -t - 1.1);
          at(M.ink, rcyl(0.25, 0.25, 0.12, 0.03, 24), u + s * (d.w / 2 + 0.6), 0.95, -t - 1.1);
        }
        at(M.blue, rb(d.w + 1.5, 1.1, 0.95, 0.24), u, H + 0.55, -t / 2);
        // the drum housing on the inside, white with blue end caps
        at(M.white, rb(d.w + 0.2, 0.8, 0.8, 0.3), u, H + 0.55, -t - 0.38);
        for (const s of [-1, 1]) at(M.blueDeep, rb(0.16, 0.86, 0.86, 0.06), u + s * (d.w / 2 + 0.15), H + 0.55, -t - 0.38);
      }
    }
    // ---- columns: slim blue posts, a base plate, a yellow guard, a cap
    const ch = col?.h ?? 5.2;
    for (const c of colList) {
      P.add(M.blue, rb(0.5, ch, 0.5, 0.14), c.x, ch / 2, c.z);
      P.add(M.panel, rb(0.95, 0.12, 0.95, 0.05), c.x, 0.06, c.z);
      P.add(M.yellow, rb(0.86, 1.05, 0.86, 0.22), c.x, 0.62, c.z);
      P.add(M.blueDeep, rb(0.64, 0.2, 0.64, 0.08), c.x, ch + 0.06, c.z);
    }
  }, group);

  // door plates (decals) and the shutters (moving)
  const shutters = [];
  for (const d of doorList) {
    const F = wallFrame(d.side);
    const u = F.u(d.x, d.z);
    // the gate plate on the lintel outside and on the drum inside
    for (const [n, y, ry] of [
      [-t / 2 + 0.48, d.h + 0.55, 0],
      [-t - 0.79, d.h + 0.55, PI],
    ]) {
      const tex = textTex(d.name, {fg: TOY.blue, bg: TOY.white, px: 100, pad: 24});
      const a = tex.image.width / tex.image.height;
      const m = new THREE.Mesh(planeG(0.64 * a, 0.64), decalMat(tex));
      m.applyMatrix4(F.m.clone().multiply(new THREE.Matrix4().compose(_p.set(u, y, n), _q.setFromEuler(_e.set(0, ry, 0)), _s.set(1, 1, 1))));
      group.add(m);
    }
    const s = new THREE.Mesh(shutterGeo(d.w, d.h), M.slat);
    s.castShadow = s.receiveShadow = true;
    s.applyMatrix4(F.m.clone().multiply(new THREE.Matrix4().makeTranslation(u, d.h, -t / 2)));
    const bottom = new THREE.Mesh(rb(d.w, 0.16, 0.2, 0.05), M.ink);
    bottom.castShadow = bottom.receiveShadow = true;
    bottom.applyMatrix4(F.m.clone().multiply(new THREE.Matrix4().makeTranslation(u, d.h, -t / 2)));
    group.add(s, bottom);
    shutters.push({s, bottom, h: d.h, y0: bottom.position.y});
  }
  const setDoor = (i, k) => {
    const sh = shutters[i];
    if (!sh) return;
    const shut = 1 - clamp(k, 0, 1);
    sh.s.scale.y = Math.max(0.001, shut);
    sh.s.visible = shut > 0.01;
    sh.bottom.position.y = sh.h - shut * sh.h + 0.08;
  };
  shutters.forEach((_, i) => setDoor(i, 1));
  return {
    group,
    zones: zs,
    doors: doorList,
    columns: colList,
    setDoor,
    length: L,
    width: W,
    wallH,
  };
}

// ================================================================ parts in the racks
/** a blue tote (KLT): a rounded bin with a lip and a white label */
function tote(P, x, y, z, w = 0.62, h = 0.38, d = 0.44, color = null) {
  const M = mats();
  const mat = color ? paint(color, 0.55) : paint(TOY.blue, 0.55);
  P.add(mat, rb(w, h, d, 0.07), x, y + h / 2, z);
  P.add(mat, rb(w + 0.04, 0.06, d + 0.04, 0.025), x, y + h - 0.02, z);
  P.add(M.white, rb(w * 0.38, h * 0.32, 0.02, 0.008), x, y + h * 0.46, z + d / 2 + 0.006);
}
/** a cardboard box with a tape stripe over the top */
function carton(P, x, y, z, w, h, d) {
  const M = mats();
  P.add(M.cardboard, rb(w, h, d, 0.06), x, y + h / 2, z);
  P.add(M.tape, rb(w * 0.22, 0.012, d + 0.004, 0.004), x, y + h + 0.002, z);
}
/** a car door panel, its face in the xy plane (outer skin toward +z): body, window frame, handle */
function doorPanel(P, x, y, z, s = 1, mat = null) {
  const M = mats();
  const w = 1.7 * s;
  const h = 1.25 * s;
  const shape = () => {
    const sh = roundedPoly([V2(-w / 2, 0), V2(w / 2, 0), V2(w / 2, h * 0.52), V2(w * 0.28, h), V2(-w / 2, h)], [0.12, 0.12, 0.2, 0.22, 0.1].map((r) => r * s));
    sh.holes.push(new THREE.Path(roundedPoly([V2(-w / 2 + 0.12 * s, h * 0.56), V2(w / 2 - 0.16 * s, h * 0.56), V2(w * 0.25, h - 0.12 * s), V2(-w / 2 + 0.12 * s, h - 0.12 * s)], 0.08 * s).getPoints(8)));
    return sh;
  };
  P.add(mat ?? M.ecoat, extrude(`door-panel|${s}`, shape, 0.14 * s, 0.04 * s), x, y, z);
  P.add(M.ink, rb(0.26 * s, 0.06 * s, 0.05 * s, 0.02 * s), x + w * 0.22, y + h * 0.42, z + 0.08 * s);
}
/** a car seat facing +z: cushion, backrest, headrest */
function seat(P, x, y, z, s = 1) {
  const M = mats();
  P.add(M.seat, rb(0.62 * s, 0.2 * s, 0.6 * s, 0.08 * s), x, y + 0.1 * s, z + 0.04 * s);
  P.add(M.seat, rb(0.62 * s, 0.72 * s, 0.18 * s, 0.08 * s), x, y + 0.5 * s, z - 0.24 * s, -0.16);
  P.add(M.seat, rb(0.36 * s, 0.22 * s, 0.14 * s, 0.06 * s), x, y + 0.98 * s, z - 0.32 * s, -0.16);
  P.add(M.ink, rb(0.66 * s, 0.1 * s, 0.5 * s, 0.03 * s), x, y - 0.03 * s, z - 0.02 * s);
}

// ================================================================ parts rack
export function buildToyPartsRack({kind = 'boxes', w = 3.6, d = 1.5, h = 2.6, levels = 2, seed = 1, cart = false} = {}) {
  const M = mats();
  const group = new THREE.Group();
  group.name = `rack-${kind}`;
  let rnd = seed * 7919 + 13;
  const rand = () => ((rnd = (rnd * 9301 + 49297) % 233280) / 233280);
  tpl(`rack|${kind}|${w}|${d}|${h}|${levels}|${seed}|${cart}`, (P) => {
    const post = 0.14;
    const y0 = cart ? 0 : 0.0;
    // uprights: corners, plus middles when the rack is long
    const xs = [-w / 2 + post / 2, w / 2 - post / 2];
    if (w > 3.2) xs.splice(1, 0, 0);
    for (const x of xs) for (const s of [-1, 1]) P.ext(M.blue, x - post / 2, x + post / 2, y0, h, s * d / 2 - post / 2 - (s > 0 ? post / 2 : -post / 2), s * d / 2 + post / 2 - (s > 0 ? post / 2 : -post / 2), 0.05);
    // the side frames: cross ties between front and back uprights at each end
    for (const x of [xs[0], xs[xs.length - 1]]) {
      for (const y of [h * 0.3, h * 0.72]) P.ext(M.blue, x - 0.05, x + 0.05, y - 0.04, y + 0.04, -d / 2 + 0.1, d / 2 - 0.1, 0.02);
    }
    // a top frame
    for (const s of [-1, 1]) P.ext(M.blue, -w / 2, w / 2, h - 0.12, h, s * (d / 2 - post / 2) - 0.07, s * (d / 2 - post / 2) + 0.07, 0.04);
    // the base: a cart deck (low version) or floor feet
    if (cart) P.ext(M.blue, -w / 2, w / 2, 0, 0.16, -d / 2, d / 2, 0.06);
    else for (const x of xs) for (const s of [-1, 1]) P.ext(M.panel, x - 0.14, x + 0.14, 0, 0.04, s * (d / 2 - post / 2) - 0.14, s * (d / 2 - post / 2) + 0.14, 0.015);
    // shelves: beams front and back (blue), a light deck
    const base = cart ? 0.16 : 0.18;
    const gap = (h - 0.14 - base) / levels;
    for (let lv = 0; lv < levels; lv++) {
      const y = base + lv * gap;
      if (!cart || lv > 0) {
        for (const s of [-1, 1]) P.ext(M.blue, -w / 2 + 0.02, w / 2 - 0.02, y - 0.14, y, s * (d / 2 - post / 2) - 0.06, s * (d / 2 - post / 2) + 0.06, 0.04);
      }
      P.ext(M.panel, -w / 2 + post, w / 2 - post, y - 0.05, y, -d / 2 + 0.1, d / 2 - 0.1, 0.02);
      // the load on this level
      const room = gap - 0.18;
      const span = w - 2 * post - 0.1;
      if (kind === 'boxes') {
        const tw = 0.62;
        const nx = Math.max(1, Math.floor(span / (tw + 0.06)));
        const nz = Math.max(1, Math.floor((d - 0.2) / 0.5));
        const stack = room > 0.85 ? 2 : 1;
        for (let i = 0; i < nx; i++)
          for (let j = 0; j < nz; j++)
            for (let k = 0; k < stack; k++) {
              if (k === 1 && rand() < 0.35) continue;
              const xx = -span / 2 + (span / nx) * (i + 0.5);
              const zz = -(d - 0.2) / 2 + ((d - 0.2) / nz) * (j + 0.5);
              if (rand() < 0.18) carton(P, xx, y + k * 0.42, zz, 0.6, 0.38, 0.44);
              else tote(P, xx, y + k * 0.42, zz, 0.6, 0.38, 0.44, k === 1 && rand() < 0.5 ? TOY.blueLight : null);
            }
      } else if (kind === 'tyres') {
        // finished wheels standing in a row, hubs to the front
        const r = Math.min(0.46, (room - 0.04) / 2);
        const ww = r * 0.76;
        const nx = Math.max(1, Math.floor(span / (2 * r + 0.06)));
        for (let i = 0; i < nx; i++) {
          const xx = -span / 2 + (span / nx) * (i + 0.5);
          for (const zz of d > 1.2 ? [-d / 4, d / 4] : [0]) wheelInto(P, r, ww, xx, y + r, zz);
        }
      } else if (kind === 'doors') {
        // door panels on edge, one behind the other, outer skins to the front
        const s = Math.min(1, (room - 0.05) / 1.25, (span - 0.1) / 1.75);
        const n = Math.max(2, Math.floor((d - 0.3) / 0.24));
        for (let j = 0; j < n; j++) {
          const zz = -(d - 0.3) / 2 + ((d - 0.3) / Math.max(1, n - 1)) * j;
          doorPanel(P, 0, y, zz, s, j % 3 === 2 ? M.white : null);
        }
        // the rack's comb: blue fingers between the panels
        for (const xx of [-span / 2 + 0.1, span / 2 - 0.1]) P.ext(M.blue, xx - 0.05, xx + 0.05, y, y + 0.32, -d / 2 + 0.12, d / 2 - 0.12, 0.02);
      } else if (kind === 'seats') {
        const sc = Math.min(1.1, (room - 0.05) / 1.12);
        const nx = Math.max(1, Math.floor(span / (0.78 * sc)));
        for (let i = 0; i < nx; i++) {
          const xx = -span / 2 + (span / nx) * (i + 0.5);
          seat(P, xx, y + 0.04, 0.08, sc);
        }
      }
    }
  }, group);
  return group;
}

// ================================================================ AGV
export function buildToyAGV({number = '07', rack = 'boxes'} = {}) {
  const M = mats();
  const group = new THREE.Group();
  group.name = `agv-${number}`;
  const L = 3.2;
  const W = 1.8;
  const top = 0.66;
  tpl(`agv|${number}`, (P) => {
    // the blue skirt, the white body, the deck plate
    P.ext(M.blue, -L / 2, L / 2, 0.1, 0.4, -W / 2, W / 2, 0.14);
    P.ext(M.white, -L / 2 + 0.06, L / 2 - 0.06, 0.34, top, -W / 2 + 0.05, W / 2 - 0.05, 0.2);
    P.ext(M.panel, -L / 2 + 0.3, L / 2 - 0.3, top - 0.04, top + 0.015, -W / 2 + 0.25, W / 2 - 0.25, 0.08);
    // the light strip all round, just over the skirt
    for (const s of [-1, 1]) P.ext(M.led, -L / 2 + 0.4, L / 2 - 0.4, 0.405, 0.455, s * (W / 2 - 0.03) - 0.02, s * (W / 2 - 0.03) + 0.02, 0.015);
    for (const s of [-1, 1]) P.ext(M.led, s * (L / 2 - 0.05) - 0.02, s * (L / 2 - 0.05) + 0.02, 0.405, 0.455, -W / 2 + 0.35, W / 2 - 0.35, 0.015);
    // yellow safety bumpers front and back
    for (const s of [-1, 1]) P.ext(M.yellow, s * (L / 2 + 0.06) - 0.1, s * (L / 2 + 0.06) + 0.1, 0.14, 0.34, -W / 2 + 0.12, W / 2 - 0.12, 0.08);
    // lidar pucks sunk into 2 opposite corners of the skirt, dark windows front and back
    for (const [x, z] of [
      [L / 2 - 0.1, -W / 2 + 0.1],
      [-L / 2 + 0.1, W / 2 - 0.1],
    ]) {
      P.rcyl(M.ink, 0.17, 0.17, 0.22, x, 0.26, z, 'y', 0.05, 24);
      P.rcyl(M.glass, 0.175, 0.175, 0.07, x, 0.27, z, 'y', 0.02, 24);
    }
    // the fleet number on both sides and the front
    for (const s of [-1, 1]) P.text(`AGV ${number}`, {fg: TOY.blue, px: 100}, 0.2, s * 0.35, 0.51, s * (W / 2 - 0.045), s > 0 ? 0 : PI);
    P.text(number, {fg: TOY.blue, px: 100}, 0.2, L / 2 - 0.055, 0.51, 0, PI / 2);
    P.text(number, {fg: TOY.blue, px: 100}, 0.2, -L / 2 + 0.055, 0.51, 0, -PI / 2);
  }, group);
  // the lift: a dark plate on a steel column
  const lift = new THREE.Group();
  group.add(lift);
  tpl('agv-lift', (P) => {
    P.ext(M.ink, -0.95, 0.95, 0, 0.09, -0.62, 0.62, 0.04);
    P.ext(M.rubber, -0.85, 0.85, 0.09, 0.11, -0.52, 0.52, 0.02);
  }, lift);
  const column = part(cg('agv-col', () => new THREE.CylinderGeometry(0.24, 0.24, 1, 20).translate(0, 0.5, 0)), M.steel, group);
  column.position.y = top - 0.05;
  const slot = new THREE.Group();
  slot.position.y = 0.11;
  lift.add(slot);
  const setLift = (h) => {
    h = clamp(h, 0, 0.35);
    lift.position.y = top + 0.005 + h;
    column.scale.y = Math.max(0.01, h + 0.06);
  };
  setLift(0);
  const wheels = [];
  axle(group, wheels, 0.17, 0.14, L / 2 - 0.55, W / 2 - 0.32);
  axle(group, wheels, 0.17, 0.14, -L / 2 + 0.55, W / 2 - 0.32);
  let rackG = null;
  if (rack) {
    rackG = buildToyPartsRack({kind: rack, w: 2.9, d: 1.6, h: 1.95, levels: rack === 'boxes' ? 2 : 1, seed: (Number(number) || 0) + 1, cart: true});
    slot.add(rackG);
  }
  return {group, roll: roller(wheels), setLift, slot, rack: rackG, length: L, width: W};
}

// ================================================================ tyres, pallets
export function buildToyTireStack({n = 4, r = 0.5, w = 0.38} = {}) {
  const group = new THREE.Group();
  group.name = 'tyre-stack';
  tpl(`tyres|${n}|${r}|${w}`, (P) => {
    for (let k = 0; k < n; k++) wheelInto(P, r, w, 0, w / 2 + k * (w + 0.005), 0, -PI / 2, 0, k * 0.7);
  }, group);
  return group;
}

export function buildToyPallet({load = 'boxes', layers = 2, seed = 1} = {}) {
  const M = mats();
  const group = new THREE.Group();
  group.name = `pallet-${load}`;
  let rnd = seed * 104729 + 7;
  const rand = () => ((rnd = (rnd * 9301 + 49297) % 233280) / 233280);
  tpl(`pallet|${load}|${layers}|${seed}`, (P) => {
    const PW = 2.3;
    const PD = 2.0;
    // 3 stringers, 5 top boards, 3 bottom boards
    for (const z of [-0.85, 0, 0.85]) P.ext(M.pallet, -PW / 2, PW / 2, 0.06, 0.24, z - 0.15, z + 0.15, 0.04);
    for (let k = 0; k < 5; k++) {
      const x = -PW / 2 + 0.2 + k * ((PW - 0.4) / 4);
      P.ext(M.pallet, x - 0.19, x + 0.19, 0.24, 0.32, -PD / 2, PD / 2, 0.03);
    }
    for (const x of [-PW / 2 + 0.2, 0, PW / 2 - 0.2]) P.ext(M.pallet, x - 0.18, x + 0.18, 0, 0.06, -PD / 2, PD / 2, 0.025);
    const y0 = 0.32;
    if (load === 'boxes') {
      for (let c = 0; c < layers; c++)
        for (let a = 0; a < 2; a++)
          for (let b = 0; b < 2; b++) {
            if (c === layers - 1 && rand() < 0.2) continue;
            carton(P, -0.56 + a * 1.12, y0 + c * 0.88, -0.49 + b * 0.98, 1.08, 0.86, 0.96);
          }
    } else if (load === 'totes') {
      for (let c = 0; c < layers + 1; c++)
        for (let a = 0; a < 3; a++)
          for (let b = 0; b < 3; b++) tote(P, -0.74 + a * 0.74, y0 + c * 0.56, -0.62 + b * 0.62, 0.7, 0.54, 0.58);
    } else if (load === 'wrap') {
      const hh = layers * 0.88;
      P.ext(M.wrap, -1.1, 1.1, y0, y0 + hh, -0.96, 0.96, 0.2);
      // the wrap's bands, a shade darker
      for (let k = 1; k < layers * 2; k++) P.ext(M.panel, -1.115, 1.115, y0 + k * 0.44 - 0.03, y0 + k * 0.44 + 0.03, -0.975, 0.975, 0.03);
      P.text('FRAGILE', {fg: TOY.blue, px: 90}, 0.22, 0, y0 + hh * 0.62, 0.97);
    }
  }, group);
  return group;
}

// ================================================================ the robot cell fence
export function buildToyCellFence({w = 12, d = 9, h = 2.2, gate = '+z', open = ['-x', '+x'], openW = 3.6, step = 2.0} = {}) {
  const M = mats();
  const group = new THREE.Group();
  group.name = 'cell-fence';
  const frame = paint(PLANT.fenceFrame, 0.5);
  const gateW = 1.6;
  // each side as runs of panels; side frame: u along the side, centred, outward n
  const sides = [
    {id: '+z', len: w, at: (u) => [u, d / 2], ry: 0},
    {id: '-z', len: w, at: (u) => [-u, -d / 2], ry: PI},
    {id: '+x', len: d, at: (u) => [w / 2, -u], ry: PI / 2},
    {id: '-x', len: d, at: (u) => [-w / 2, u], ry: -PI / 2},
  ];
  const gateInfo = {};
  tpl(`fence|${w}|${d}|${h}|${gate}|${open.join(',')}|${openW}|${step}`, (P) => {
    for (const S of sides) {
      // the gaps along this side: the conveyor opening in the middle, the gate offset to one end
      const gaps = [];
      if (open.includes(S.id)) gaps.push([-openW / 2, openW / 2]);
      if (S.id === gate) {
        const g0 = open.includes(S.id) ? openW / 2 + 0.6 : S.len * 0.18;
        gaps.push([g0, g0 + gateW]);
        gateInfo.u0 = g0;
        gateInfo.side = S;
      }
      gaps.sort((a, b) => a[0] - b[0]);
      const runs = [];
      let u0 = -S.len / 2;
      for (const [a, b] of gaps) {
        runs.push([u0, a]);
        u0 = b;
      }
      runs.push([u0, S.len / 2]);
      const put = (mat, geo, u, y, n = 0, rz = 0) => {
        const [x, z] = S.at(u);
        const nx = Math.sin(S.ry) * n;
        const nz = Math.cos(S.ry) * n;
        P.add(mat, geo, x + nx, y, z + nz, 0, S.ry, rz);
      };
      for (const [a, b] of runs) {
        const len = b - a;
        if (len < 0.3) continue;
        const n = Math.max(1, Math.round(len / step));
        const pw = len / n;
        for (let k = 0; k <= n; k++) put(M.blue, rb(0.16, h + 0.1, 0.16, 0.05), a + k * pw, (h + 0.1) / 2);
        for (let k = 0; k < n; k++) {
          const uc = a + (k + 0.5) * pw;
          // the panel: a light-blue frame, a translucent pane, a solid kick plate
          put(frame, rb(pw - 0.2, 0.08, 0.06, 0.02), uc, h - 0.1);
          put(frame, rb(pw - 0.2, 0.08, 0.06, 0.02), uc, 0.42);
          put(M.panel, rb(pw - 0.22, 0.3, 0.06, 0.03), uc, 0.24);
          put(M.pane, rb(pw - 0.24, h - 0.6, 0.03, 0.01), uc, (h - 0.14 + 0.46) / 2);
        }
        // a blue top rail along the run
        put(M.blue, rb(len + 0.12, 0.1, 0.12, 0.04), (a + b) / 2, h + 0.05);
        // feet under the posts
        for (let k = 0; k <= n; k++) put(M.blue, rb(0.36, 0.05, 0.36, 0.02), a + k * pw, 0.025);
      }
    }
    // the interlock: a yellow box on the post beside the gate's latch side, a yellow warning plate on the gate post
    if (gateInfo.side) {
      const S = gateInfo.side;
      const [x, z] = S.at(gateInfo.u0 + gateW + 0.02);
      const nx = Math.sin(S.ry);
      const nz = Math.cos(S.ry);
      P.add(M.yellow, rb(0.2, 0.36, 0.14, 0.05), x + nx * 0.14, 1.1, z + nz * 0.14, 0, S.ry);
      P.add(M.ink, rb(0.08, 0.08, 0.04, 0.02), x + nx * 0.22, 1.16, z + nz * 0.22, 0, S.ry);
    }
  }, group);
  // the gate: a hinged panel
  const setGate = (() => {
    if (!gateInfo.side) return () => {};
    const S = gateInfo.side;
    const [hx, hz] = S.at(gateInfo.u0);
    const hinge = new THREE.Group();
    hinge.position.set(hx, 0, hz);
    hinge.rotation.y = S.ry;
    group.add(hinge);
    tpl(`fence-gate|${h}`, (P) => {
      P.ext(M.blue, 0.06, 0.18, 0.06, h - 0.02, -0.06, 0.06, 0.04);
      P.ext(M.blue, gateW - 0.14, gateW - 0.04, 0.06, h - 0.02, -0.06, 0.06, 0.04);
      P.ext(frame, 0.12, gateW - 0.1, h - 0.16, h - 0.06, -0.03, 0.03, 0.02);
      P.ext(frame, 0.12, gateW - 0.1, 0.36, 0.46, -0.03, 0.03, 0.02);
      P.ext(M.pane, 0.16, gateW - 0.14, 0.46, h - 0.16, -0.015, 0.015, 0.01);
      P.ext(M.panel, 0.14, gateW - 0.12, 0.1, 0.36, -0.03, 0.03, 0.02);
      P.ext(M.yellow, gateW - 0.24, gateW - 0.14, 0.95, 1.3, 0.04, 0.12, 0.03);
      // a yellow warning triangle facing out
      const tri = canvasTex('warn-tri', 256, 256, (g, W, H) => {
        g.fillStyle = PLANT.walk;
        g.strokeStyle = C.ink;
        g.lineWidth = 14;
        g.lineJoin = 'round';
        g.beginPath();
        g.moveTo(W / 2, 22);
        g.lineTo(W - 18, H - 30);
        g.lineTo(18, H - 30);
        g.closePath();
        g.fill();
        g.stroke();
        g.fillStyle = C.ink;
        g.font = `900 130px ${FONT}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('!', W / 2, H * 0.6);
      });
      P.print(decalMat(tri), 0.5, 0.5, gateW / 2, 1.5, 0.035);
      P.print(decalMat(tri), 0.5, 0.5, gateW / 2, 1.5, -0.035, PI);
    }, hinge);
    return (k) => {
      hinge.rotation.y = S.ry - clamp(k, 0, 1) * (PI / 2);
    };
  })();
  group.userData = {setGate, w, d, h};
  return group;
}

// ================================================================ signs
export function buildToySign({text = 'BODY SHOP', sub = '', kind = 'stand', h = 1.5} = {}) {
  const M = mats();
  const group = new THREE.Group();
  group.name = `sign-${text}`;
  const tex = signTex(text, sub);
  const a = tex.image.width / tex.image.height;
  const w = h * a;
  const y0 = kind === 'stand' ? 2.2 : 0;
  const zc = kind === 'stand' ? 0 : 0.09;
  tpl(`sign|${text}|${sub}|${kind}|${h}`, (P) => {
    P.ext(M.white, -w / 2 - 0.06, w / 2 + 0.06, y0 - 0.06, y0 + h + 0.06, zc - 0.09, zc + 0.09, 0.08);
    P.print(decalMat(tex), w, h, 0, y0 + h / 2, zc + 0.095);
    if (kind === 'stand') {
      P.print(decalMat(tex), w, h, 0, y0 + h / 2, zc - 0.095, PI);
      // a blue edge round the panel, 2 posts, feet
      P.ext(M.blue, -w / 2 - 0.1, w / 2 + 0.1, y0 - 0.16, y0 - 0.04, -0.12, 0.12, 0.05);
      for (const s of [-1, 1]) {
        const x = s * (w / 2 - 0.35);
        P.ext(M.blue, x - 0.09, x + 0.09, 0, y0 - 0.1, -0.09, 0.09, 0.05);
        P.ext(M.blue, x - 0.3, x + 0.3, 0, 0.08, -0.3, 0.3, 0.03);
      }
    }
  }, group);
  group.userData.width = w;
  return group;
}

/// ================================================================ the car carrier
/** a plane whose uv repeats every tw x th metres (for tiled prints on RepeatWrapping textures) */
const tiledPlane = (w, h, tw, th) =>
  cg(`tp|${w}|${h}|${tw}|${th}`, () => {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tw, (uv.getY(i) * h) / th);
    return g;
  });

export function buildToyCarCarrier({livery = 'aurora', number = '24'} = {}) {
  const Lv = liv(livery);
  const M = mats();
  const group = new THREE.Group();
  group.name = 'car-carrier';
  // rig coordinates: the trailer's rear end at x = 0, the tractor's bumper at about 26.8; shifted to centre below
  const SHIFT = -13.4;
  const KP = 21.75; // kingpin
  const DL = 1.1; // lower deck top
  const DU = 3.6; // upper deck top, level
  const lowEnd = 19.7; // the lower deck's front end: the gooseneck's step
  const neck = [19.95, 23.15]; // the gooseneck over the tractor
  const nBot = 1.66; // its underside, over the fifth wheel
  const gTop = 2.35; // its top
  const fwTop = 1.55; // fifth wheel top
  const upper = [3.2, 23.15]; // upper deck span; it hinges at its front end
  const trackZ = 0.98;
  const trackW = 0.74;
  const postZ = 1.78;
  const R = 0.75; // tractor wheels, as the reference's box truck
  const TR = 0.5; // trailer wheels, low profile
  const cab0 = 23.6;
  const cab1 = 26.55;
  const deckTex = canvasTex('carrier-deck', 512, 128, (g, w, h) => {
    g.fillStyle = 'rgba(64,76,118,0.4)';
    for (let x = 32; x < w; x += 64)
      for (let y = 21; y < h; y += 43) {
        g.beginPath();
        g.roundRect(x - 13, y - 7, 26, 14, 7);
        g.fill();
      }
  }, {repeat: true});
  const deckPrint = decalMat(deckTex, {rough: 0.6});

  // ---- the tractor, in the group's frame
  const tractor = new THREE.Group();
  tractor.position.x = SHIFT;
  group.add(tractor);
  tpl(`carrier-tractor|${livery}|${number}`, (P) => {
    cab(P, {x0: cab0, x1: cab1, top: 4.1, W: 3.5, color: Lv.cab, wheelX: cab1 - 1.65, wheelR: R, stripe: Lv.stripe, seam: Lv.cab === TOY.white ? TOY.shade : TOY.blueDeep});
    // the frame and the fifth wheel
    P.ext(M.chassis, 20.25, cab0 + 0.6, 0.85, 1.35, -0.95, 0.95, 0.08);
    P.rcyl(M.ink, 0.95, 0.95, 0.2, KP, fwTop - 0.1, 0, 'y', 0.05, 32);
    P.ext(M.chassis, KP - 0.7, KP + 0.7, 1.28, 1.42, -0.75, 0.75, 0.05);
    for (const s of [-1, 1]) {
      // flat mudguards over the tandem, the tank and its step, rear lamps
      P.ext(M.chassis, 20.3, 23.1, 1.55, 1.63, s * 1.5 - 0.36, s * 1.5 + 0.36, 0.035);
      P.rcyl(M.steel, 0.34, 0.34, 0.8, 23.62, 0.92, s * 1.32, 'x', 0.08, 28);
      P.ext(M.chassis, 23.22, 24.02, 0.5, 0.6, s * 1.32 - 0.34, s * 1.32 + 0.34, 0.03);
      P.ext(M.tail, 20.18, 20.27, 0.95, 1.13, s * 0.75 - 0.15, s * 0.75 + 0.15, 0.03);
    }
    // the exhaust stack behind the cab
    P.rcyl(M.steel, 0.12, 0.12, 2.5, cab0 - 0.2, 2.85, 1.36, 'y', 0.04, 16);
    P.rcyl(M.ink, 0.15, 0.15, 0.6, cab0 - 0.2, 1.75, 1.36, 'y', 0.04, 16);
    // the fleet number on the cab doors
    for (const s of [-1, 1]) P.text(`C-${number}`, {fg: Lv.cab === TOY.white ? Lv.accent : TOY.white, px: 110}, 0.34, cab1 - 2.35, 1.5, s * 1.758, s > 0 ? 0 : PI);
  }, tractor);
  const wheels = [];
  const steer = [];
  axle(tractor, wheels, R, 0.64, cab1 - 1.65, 1.4, steer);
  for (const x of [KP - 0.62, KP + 0.62]) axle(tractor, wheels, R, 0.64, x, 1.5);

  // ---- the trailer, pivoting about the kingpin (its local x = rig x - KP)
  const trailer = new THREE.Group();
  trailer.position.x = SHIFT + KP;
  group.add(trailer);
  const T = (x) => x - KP;
  tpl(`carrier-trailer|${livery}`, (P) => {
    // 2 main beams under the lower deck
    for (const s of [-1, 1]) P.ext(M.chassis, T(0.15), T(lowEnd + 0.1), 0.5, 0.82, s * 0.6 - 0.14, s * 0.6 + 0.14, 0.05);
    // the gooseneck: a step wall at the lower deck's front, a box over the tractor, in the livery's colour
    P.add(paint(Lv.accent, 0.46), extrude('carrier-neck', () => roundedPoly([V2(T(lowEnd), 0.5), V2(T(neck[0]), 0.5), V2(T(neck[0]), nBot), V2(T(neck[1]), nBot), V2(T(neck[1]), gTop), V2(T(lowEnd), gTop)], [0.08, 0.08, 0.14, 0.18, 0.24, 0.16]), 2.2, 0.12));
    P.ext(M.chassis, T(KP - 0.75), T(KP + 0.75), nBot - 0.1, nBot + 0.02, -0.75, 0.75, 0.04);
    // the lower deck: 2 perforated tracks on cross beams
    for (const s of [-1, 1]) {
      P.ext(M.deck, T(0.05), T(lowEnd - 0.02), DL - 0.14, DL, s * trackZ - trackW / 2, s * trackZ + trackW / 2, 0.05);
      P.add(deckPrint, tiledPlane(lowEnd - 0.5, trackW - 0.16, 2.4, 0.6), T(lowEnd / 2), DL + 0.004, s * trackZ, -PI / 2);
    }
    for (let x = 0.5; x < lowEnd - 0.3; x += 2.35) P.ext(M.chassis, T(x - 0.09), T(x + 0.09), DL - 0.32, DL - 0.13, -1.3, 1.3, 0.04);
    // the rear: a light bar with the lamps, an under-ride bar
    P.ext(M.chassis, T(-0.1), T(0.12), 0.8, 1.0, -1.72, 1.72, 0.06);
    for (const s of [-1, 1]) P.ext(M.tail, T(-0.14), T(-0.08), 0.84, 0.96, s * 1.42 - 0.18, s * 1.42 + 0.18, 0.03);
    P.ext(M.chassis, T(-0.05), T(0.15), 0.42, 0.6, -1.4, 1.4, 0.05);
    for (const s of [-1, 1]) P.ext(M.chassis, T(0.0), T(0.14), 0.5, 0.82, s * 0.6 - 0.07, s * 0.6 + 0.07, 0.03);
    // the side frames: a curb rail over the wheels, posts between the car positions, the upper rail, braces
    const posts = [0.12, 6.72, 13.17, lowEnd - 0.12, neck[1] - 0.12];
    for (const s of [-1, 1]) {
      const z = s * postZ;
      P.ext(M.blue, T(0), T(lowEnd), DL - 0.07, DL + 0.13, z - 0.11, z + 0.11, 0.08);
      P.ext(M.blueLight, T(0.3), T(lowEnd - 0.3), DL + 0.0, DL + 0.06, z + s * 0.11 - 0.006, z + s * 0.11 + 0.006, 0.003);
      for (const x of posts) P.ext(M.blue, T(x) - 0.1, T(x) + 0.1, x > lowEnd ? gTop - 0.1 : DL, DU + 0.3, z - 0.1, z + 0.1, 0.06);
      P.ext(M.blue, T(posts[0] - 0.1), T(neck[1]), DU + 0.12, DU + 0.36, z - 0.11, z + 0.11, 0.08);
      for (let i = 0; i < 3; i++) P.bar(M.blue, [T(posts[i]) + 0.12, DL + 0.12, z], [T(posts[i + 1]) - 0.12, DU + 0.14, z], 0.12);
      P.bar(M.blue, [T(posts[3]) + 0.12, DU + 0.14, z], [T(posts[4]) - 0.12, gTop + 0.12, z], 0.12);
      // the front posts' outriggers down onto the gooseneck
      P.ext(M.blue, T(posts[4]) - 0.16, T(posts[4]) + 0.16, gTop - 0.1, gTop + 0.04, Math.min(z, s * 1.05) - 0.12, Math.max(z, s * 1.05) + 0.12, 0.04);
    }
    // the headboard: 2 cross beams between the front posts
    for (const y of [DU - 0.62, DU + 0.24]) P.ext(M.blue, T(neck[1] - 0.24), T(neck[1]), y - 0.12, y + 0.12, -postZ, postZ, 0.08);
    // the livery on the gooseneck's sides: mark + name in white
    for (const s of [-1, 1]) {
      const tex = canvasTex(`carrier-neck|${livery}`, 1024, 220, (g, w, h) => {
        const m = h * 0.7;
        const y0 = (h - m) / 2;
        if (Lv.mark === 'aurora') {
          g.fillStyle = '#ffffff';
          g.beginPath();
          g.roundRect(24, y0, m, m, m * 0.26);
          g.fill();
          drawMark(g, 'aurora', 24 + m * 0.1, y0 + m * 0.1, m * 0.8, Lv);
        } else drawMark(g, Lv.mark, 24, y0, m, {...Lv, accent: '#ffffff', deep: 'rgba(255,255,255,0.65)'});
        g.fillStyle = '#ffffff';
        g.font = `800 ${h * 0.56}px ${FONT}`;
        g.textBaseline = 'middle';
        g.fillText(Lv.name, 56 + m, h * 0.54);
      });
      P.print(decalMat(tex), 2.55, 0.55, T(neck[0] + 1.65), (nBot + gTop) / 2 + 0.01, s * 1.106, s > 0 ? 0 : PI);
    }
  }, trailer);
  for (const x of [2.0, 3.15, 4.3]) axle(trailer, wheels, TR, 0.44, T(x), 1.58);

  // ---- the upper deck, hinged at its front end
  const deckU = new THREE.Group();
  deckU.position.set(T(upper[1]), DU, 0);
  trailer.add(deckU);
  const UL = upper[1] - upper[0];
  tpl('carrier-upper', (P) => {
    for (const s of [-1, 1]) {
      P.ext(M.deck, -UL + 0.05, -0.05, -0.16, 0, s * trackZ - trackW / 2, s * trackZ + trackW / 2, 0.05);
      P.add(deckPrint, tiledPlane(UL - 0.5, trackW - 0.16, 2.4, 0.6), -UL / 2, 0.004, s * trackZ, -PI / 2);
      P.ext(M.blue, -UL, 0, -0.42, -0.16, s * (trackZ + 0.16) - 0.1, s * (trackZ + 0.16) + 0.1, 0.06);
      // the stop lip at the rear end of each track
      P.ext(M.blue, -UL + 0.02, -UL + 0.24, -0.02, 0.12, s * trackZ - trackW / 2, s * trackZ + trackW / 2, 0.05);
    }
    for (let x = -UL + 0.4; x < -0.2; x += 2.5) P.ext(M.blue, x - 0.08, x + 0.08, -0.36, -0.18, -1.45, 1.45, 0.04);
  }, deckU);

  // ---- the rear ramp: 2 plates hinged at the lower deck's rear end, running toward -x
  const RL = 2.9;
  const rampPivot = new THREE.Group();
  rampPivot.position.set(T(0), DL, 0);
  trailer.add(rampPivot);
  tpl('carrier-ramp', (P) => {
    for (const s of [-1, 1]) {
      P.ext(M.deck, -RL, 0, -0.12, 0, s * trackZ - trackW / 2 + 0.02, s * trackZ + trackW / 2 - 0.02, 0.04);
      for (let x = -RL + 0.25; x < -0.15; x += 0.3) P.ext(M.steel, x - 0.04, x + 0.04, -0.01, 0.035, s * trackZ - trackW / 2 + 0.08, s * trackZ + trackW / 2 - 0.08, 0.015);
      P.ext(M.ink, -0.2, 0.02, -0.12, 0.02, s * trackZ - trackW / 2, s * trackZ + trackW / 2, 0.03);
    }
  }, rampPivot);
  const downA = Math.asin((DL - 0.04) / RL);
  const setRamp = (k) => {
    rampPivot.rotation.z = lerp(-PI / 2, downA, clamp(k, 0, 1));
  };
  setRamp(0);
  const setDeck = (k) => {
    deckU.rotation.z = Math.asin((clamp(k, 0, 1) * (DU - 1.5)) / UL);
  };
  setDeck(0);
  const setHitch = (a) => {
    trailer.rotation.y = a;
  };

  // ---- the 6 slots: lower deck front to rear, then upper deck front to rear
  const slots = [];
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Group();
    s.position.set(T(lowEnd - 0.3 - 3.0 - i * 6.45), DL, 0);
    s.name = `slot-lower-${i}`;
    trailer.add(s);
    slots.push(s);
  }
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Group();
    s.position.set(-0.35 - 3.0 - i * 6.45, 0, 0);
    s.name = `slot-upper-${i}`;
    deckU.add(s);
    slots.push(s);
  }
  const ramp = {
    pivot: rampPivot,
    top: V3(SHIFT, DL, 0),
    foot: V3(SHIFT - RL * Math.cos(downA), 0.04, 0),
    length: RL,
  };
  return {group, roll: roller(wheels), setSteer: steerer(steer), setRamp, setDeck, setHitch, slots, ramp, tractor, trailer, upperDeck: deckU, length: 27.2};
}
