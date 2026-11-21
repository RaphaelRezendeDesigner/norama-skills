// The toy construction site's ground kit, built in the airport and car-plant kits' style
// (airport-shared/style.js, gse.js, airside.js, plant-shared/plant.js), which match the reference video
//: toy proportions, generous bevels, matte paint with a soft clearcoat, crisp
// printed logos, blue + white on lavender. Earth is a warm sand, concrete a light warm grey, rebar dark. The
// contractor is fictional: AURORA BUILD. Toy metres, y up, origin on the ground at the object's centre, forward +x.
// Colours style.js lacks are in SITE below. Nothing here stands above 9 m.
//
//   buildToyPit({w = 40, d = 28, depth = 4, ramp = {side: '-x', width: 7, out: 9, at: 0}, margin = 5, corner = [1, 1]})
//       -> {group, setDug(k), setLevel(k), heightAt(x, z), floorY, floor: {w, d}, ramp: {top, foot, dir, width},
//           bounds: {x0, x1, z0, z1}, hole: [[x, z] x4], dims}
//       A heightfield of warm sand: the outline w x d at grade, 45 deg sides, a floor of (w - 2 depth) x (d - 2 depth)
//       at floorY = -depth, and a ramp cut OUTWARD from one side (ramp.side), ramp.out metres past the outline, so the
//       floor stays free for the slab; its foot meets the floor at the toe. margin = flat plot ground round it all
//       (a number, or {x0, x1, z0, z1} per side for room for heaps and cabins).
//       setDug(k): 0 = flat ground with the outline sprayed and profile boards with string lines at the corners,
//       1 = the full pit; the dig grows from corner [sx, sz] (signs of x, z) with a working face and a 2 m bench,
//       a pure function of k. The strings come down as soon as digging starts; sprayed dashes vanish as they are dug.
//       setLevel(k): the floor goes from rough (spoil lumps, a few rocks) to flat, in a sweep from the dig's side.
//       heightAt(x, z): the current surface height in the pit's frame (for wheels and tracks on the ramp and floor).
//       ramp.top / ramp.foot: Vector3 on the ramp's centre line at grade and on the floor; dir = top -> foot (unit).
//       The lot must have a hole under the pit: hole = 4 corners of the plot (pit frame); buildToyLot cuts it.
//   buildToyLot({w = 1400, d = 1400, color = TOY.ground, holes = [[[x, z], ...], ...]}) -> Mesh   (world-space holes;
//       pit.holeWorld() gives the pit's after the group is placed)
//   buildToySoilHeap({volume = 150, seed = 1, loads = 3}) -> {group, setSize(k), radius, height}
//       A spoil heap of truck loads dumped side by side (a main cone + `loads` smaller ones), crowns rounded, flanks
//       lumpy, at the angle of repose; volume in m3. setSize scales the volume (k = 1 full, 0 gone).
//   buildToyRebarMat({w = 30, d = 20, spacing = 1, strip = 2.5, lift = 0.16, from = 1}) -> {group, setLaid(k), top}
//       A dark 2-layer grid on spacers, laid strip by strip (from the +x end when from = 1): each strip unrolls
//       along z, its cross bars dropping in behind the front. Origin on the floor; top = height of the top bars.
//   buildToyFormwork({w = 30, d = 20, h = 0.8, panel = 2.5}) -> {group, setBuilt(k)}
//       White boards with a blue cap, blue soldiers and kicker braces, inner faces on the slab's w x d outline.
//       Panels stand up one by one round the perimeter (each tips up from lying flat inside), braces last.
//   buildToySlab({w = 30, d = 20, h = 0.6, pourAt = [w / 2 - 3, 0]}) -> {group, setPour(k), setWet(k), top}
//       The foundation slab, origin on its underside. setPour(k): the concrete spreads from pourAt as a pure
//       function of k (the poured area is k of the slab, a soft slumping front, a heap under the chute while it runs).
//       setWet(k): 1 = fresh (dark, glossy), 0 = dry (light, matte); it dries from the pour point outward.
//   buildToyWalls({w = 12, d = 9, h = 3.2, k = 1, t = 0.3, openings = 'auto'}) -> {group, setBuilt(k), courses, height}
//       Blockwork in running bond, 8 courses of 0.4 m, laid course by course round the walls (each block drops in),
//       door and window gaps with blue lintels. Outer faces on the w x d outline. openings: [{side: '+z' | '-z' |
//       '+x' | '-x', a (centre along the side), width, y0, y1}] or 'auto' (a door and windows), or [] for none.
//   buildToySiteCabin({label = 'SITE OFFICE'}) -> Group  (6 x 2.5 x 2.9, door and windows on +z)
//   buildToySiteFence({length = 30, h = 2.2}) -> Group  (along x, white hoarding with a blue band, AURORA BUILD prints
//       on both faces every second panel; userData.width)
//   buildToyGate({width = 8}) -> {group, setOpen(k), width}  (2 leaves on blue posts across x, swing to -z)
//   buildToyBatchingPlant() -> {group, bay: {x, z, rotY, chute: Vector3}, height}  (8.5 m: aggregate bins, an
//       inclined belt, 2 horizontal cement silos, the mixing house over a mixer lane along x through z = 0)
//   buildToyMaterialStack({kind = 'blocks' | 'rebar' | 'pipes' | 'pallets', seed = 1}) -> Group
//   buildToyPortaLoo() -> Group     buildToyConeRow({n = 5, spacing = 1.6}) -> Group (along x)
//   buildToyPlotMarks({w = 14, d = 10}) -> Group  (corner pegs and profile boards, orange string lines, sprayed L's)
//   buildToyHouseShell({floors = 1 | 2, w = 12, d = 9, seed = 1}) -> Group  (a finished neighbour house, white with
//       periwinkle windows, a blue pitched roof on 1 floor (5.7 m), a flat roof with a parapet on 2 floors (6.8 m))
//
// Static parts are merged per material and cached per variant; repeated parts are instanced. Text uses Inter: build
// after document.fonts has loaded it (runSim does that before setup).
import * as THREE from 'three';
import {mergeGeometries, mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {TOY, rbox, toyMat} from '../airport-shared/style.js';
import {GSE_COLORS} from '../airport-shared/gse.js';
import {AIRSIDE} from '../airport-shared/airside.js';

const PI = Math.PI;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sat = (v) => clamp(v, 0, 1);
const sstep = (u) => {
  u = sat(u);
  return u * u * (3 - 2 * u);
};
const ease = (u) => {
  u = sat(u);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
};
const V2 = (x, y) => new THREE.Vector2(x, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const C = GSE_COLORS;
/** polynomial smooth min / max (k = blend width in metres) */
const smin = (a, b, k) => {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const smax = (a, b, k) => -smin(-a, -b, k);
/** signed distance to a w = 2a by 2b rectangle with corners rounded by r (negative inside) */
function sdRoundRect(x, z, a, b, r) {
  const qx = Math.abs(x) - a + r;
  const qz = Math.abs(z) - b + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
}

/** colours style.js, GSE_COLORS and AIRSIDE have no entry for */
export const SITE = {
  sand: '#f2dfba', // the plot's undisturbed ground: a pale warm sand next to the lavender lot
  sandCut: '#dba06a', // fresh cut faces (the walls of the pit and the heaps' flanks)
  sandFloor: '#e2b07c', // the dug floor, rough and loose
  sandLevel: '#e8c096', // the levelled, compacted floor
  rock: '#bfae93',
  spray: '#ff7a45', // the sprayed outline
  concrete: '#c6c1b8', // dry slab: a light warm grey
  concreteWet: '#9a958d', // fresh slab
  block: '#d8d3ca', // blockwork
  lintel: TOY.blueLight,
  rebar: '#3b4055',
  spacer: '#c8c4bd',
  wood: '#dcb27c',
  string: '#ff8a3d',
  gravel: '#c9c7cf',
  gravelDeep: '#aeacb8',
  pad: '#e3e7f4', // concrete pads, a step lighter than the lot
};

// ================================================================ materials
const paint = (color, rough = 0.5) => toyMat(color, {paint: true, rough});
let MM = null;
function mats() {
  if (MM) return MM;
  const floorPaint = (color, rough = 0.85, k = 2) => {
    const m = new THREE.MeshStandardMaterial({color, roughness: rough, polygonOffset: true, polygonOffsetFactor: -k, polygonOffsetUnits: -2 * k});
    m.userData.noCast = true;
    return m;
  };
  MM = {
    white: paint(TOY.white),
    whiteMatte: toyMat(TOY.white, {rough: 0.7}),
    wall: toyMat(AIRSIDE.wall, {rough: 0.72}),
    panel: paint(TOY.panel),
    blue: paint(TOY.blue, 0.48),
    blueDeep: paint(TOY.blueDeep, 0.48),
    blueLight: paint(TOY.blueLight, 0.5),
    roof: toyMat(TOY.roof, {rough: 0.6}),
    navy: toyMat(TOY.navy, {rough: 0.7}),
    ink: toyMat(C.ink, {rough: 0.62}),
    glass: toyMat(TOY.glass, {paint: true, rough: 0.14}),
    window: toyMat(AIRSIDE.window, {paint: true, rough: 0.3}),
    shade: toyMat(TOY.shade, {rough: 0.6}),
    steel: toyMat(C.steel, {rough: 0.42, metal: 0.25}),
    orange: paint(TOY.orange, 0.5),
    yellow: paint(TOY.yellow, 0.5),
    green: toyMat(TOY.green, {rough: 0.72}),
    greenDeep: toyMat(TOY.greenDeep, {rough: 0.72}),
    red: paint(TOY.red, 0.45),
    wood: toyMat(SITE.wood, {rough: 0.85}),
    pallet: toyMat(AIRSIDE.pallet, {rough: 0.85}),
    concrete: toyMat(SITE.concrete, {rough: 0.88}),
    block: toyMat('#ffffff', {rough: 0.84}), // tinted per block (instanceColor)
    rebar: toyMat(SITE.rebar, {rough: 0.55, metal: 0.2}),
    spacer: toyMat(SITE.spacer, {rough: 0.8}),
    rock: toyMat(SITE.rock, {rough: 0.9}),
    sandFill: toyMat(SITE.sandCut, {rough: 0.95}),
    gravel: toyMat(SITE.gravel, {rough: 0.92}),
    gravelDeep: toyMat(SITE.gravelDeep, {rough: 0.92}),
    belt: toyMat('#2a3148', {rough: 0.8}),
    pane: toyMat(AIRSIDE.pane, {opacity: 0.55, rough: 0.3}),
    spray: floorPaint(SITE.spray, 0.8, 3),
    pad: floorPaint(SITE.pad, 0.92, 1),
    bay: floorPaint(TOY.bay, 0.7, 2),
    lawn: floorPaint('#bfe8c9', 0.9, 1),
    path: floorPaint('#eef1fa', 0.9, 2),
    string: toyMat(SITE.string, {rough: 0.6}),
  };
  return MM;
}

// ================================================================ noise
function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
function vnoise(x, y, seed = 0) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy) * 2 - 1;
}
function fbm(x, y, seed = 0, oct = 3) {
  let s = 0;
  let a = 0.5;
  let f = 1;
  let n = 0;
  for (let o = 0; o < oct; o++) {
    s += a * vnoise(x * f + o * 13.7, y * f - o * 7.3, seed + o * 31);
    n += a;
    a *= 0.5;
    f *= 2.03;
  }
  return s / n;
}
const rng = (seed) => {
  let r = (seed * 104729 + 7) % 233280;
  return () => (r = (r * 9301 + 49297) % 233280) / 233280;
};

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
/** a near-white soft grain for the earth (multiplies the vertex colours): broad blotches, fine speckle, tiles 10 m */
const sandTex = () =>
  canvasTex(
    'sand',
    512,
    512,
    (g, w, h) => {
      const img = g.createImageData(w, h);
      const R = rng(11);
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          // tileable: sample noise on a torus-ish wrap by blending the 4 shifted copies
          const u = x / w;
          const v = y / h;
          const n = (px, py, f, s) => {
            const a = fbm(px * f, py * f, s, 3);
            const b = fbm((px - 1) * f, py * f, s, 3);
            const c = fbm(px * f, (py - 1) * f, s, 3);
            const d = fbm((px - 1) * f, (py - 1) * f, s, 3);
            return lerp(lerp(a, b, px), lerp(c, d, px), py);
          };
          let val = 247 + 5 * n(u, v, 4, 3) + 3 * n(u, v, 16, 9);
          const r = R();
          if (r < 0.035) val -= 9 + 8 * R();
          else if (r < 0.05) val += 5;
          val = clamp(val, 0, 255);
          const i = (y * w + x) * 4;
          img.data[i] = val;
          img.data[i + 1] = val - 1;
          img.data[i + 2] = val - 3;
          img.data[i + 3] = 255;
        }
      g.putImageData(img, 0, 0);
    },
    {repeat: true},
  );
/** faint power-float swirls for the slab, tiles 6 m */
const concreteTex = () =>
  canvasTex(
    'concrete',
    512,
    512,
    (g, w, h) => {
      g.fillStyle = '#fbfbfa';
      g.fillRect(0, 0, w, h);
      const R = rng(5);
      for (let k = 0; k < 2600; k++) {
        g.fillStyle = R() < 0.5 ? 'rgba(80,70,60,0.035)' : 'rgba(255,255,255,0.06)';
        g.fillRect(R() * w, R() * h, 1.5, 1.5);
      }
    },
    {repeat: true},
  );
const DECALS = new Map();
/** a printed layer: the texture's alpha is the print, it never casts shadows */
function decalMat(tex, {rough = 0.5} = {}) {
  const key = tex.uuid + rough;
  if (DECALS.has(key)) return DECALS.get(key);
  const m = new THREE.MeshStandardMaterial({map: tex, roughness: rough, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4});
  m.userData.noCast = true;
  DECALS.set(key, m);
  return m;
}
const FONT = 'Inter, "Segoe UI", system-ui, sans-serif';
/** the AURORA mark: a rounded blue square with a white sun over a horizon (the same mark as plant.js) */
function drawAurora(g, x, y, s, accent = TOY.blue) {
  g.save();
  g.fillStyle = accent;
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
  g.restore();
}
/** the contractor's print: the mark, AURORA BUILD in blue, an optional light line under it; transparent */
function brandTex(sub = '', {fg = TOY.blue, subFg = TOY.blueLight} = {}) {
  const key = `brand|${sub}|${fg}`;
  if (TEX.has(key)) return TEX.get(key);
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `800 120px ${FONT}`;
  let tw = probe.measureText('AURORA BUILD').width;
  probe.font = `600 54px ${FONT}`;
  if (sub) tw = Math.max(tw, probe.measureText(sub).width);
  const w = Math.ceil(tw + 260);
  const h = 230;
  return canvasTex(key, w, h, (g) => {
    drawAurora(g, 14, h / 2 - 78, 156, fg);
    g.fillStyle = fg;
    g.font = `800 120px ${FONT}`;
    g.textBaseline = 'middle';
    g.fillText('AURORA BUILD', 200, sub ? h / 2 - 26 : h / 2 + 6);
    if (sub) {
      g.fillStyle = subFg;
      g.font = `600 54px ${FONT}`;
      g.fillText(sub, 204, h / 2 + 62);
    }
  });
}
function textTex(text, {fg = TOY.blue, bg = null, weight = 800, px = 96, pad = 26} = {}) {
  const key = `txt|${text}|${fg}|${bg}|${weight}|${px}`;
  if (TEX.has(key)) return TEX.get(key);
  const font = `${weight} ${px}px ${FONT}`;
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

// ================================================================ geometry kit (plant.js's, so the kits match)
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
  if (r < 0.02) return cg(`b|${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));
  // the bevel's tessellation follows its size: small bevels on thin parts never show more than 2 segments
  return rbox(w, h, d, r, r < 0.06 ? 1 : r < 0.13 ? 2 : 3);
}
const cylG = (r0, r1, h, seg = 20) => cg(`cy|${r0}|${r1}|${h}|${seg}`, () => new THREE.CylinderGeometry(r0, r1, h, seg));
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
/** a hollow pipe with soft rims, axis y, centred */
function rpipe(ro, ri, h, b = 0.04, seg = 32) {
  return cg(`rpipe|${ro}|${ri}|${h}|${b}`, () => {
    const inner = [V2(ri, h / 2 - b), V2(ri, -h / 2 + b)];
    const out = [];
    const arc2 = (cx, cy, a0, a1) => {
      for (let k = 0; k <= 3; k++) {
        const a = lerp(a0, a1, k / 3);
        out.push(V2(cx + b * Math.cos(a), cy + b * Math.sin(a)));
      }
    };
    arc2(ri + b, -h / 2 + b, PI, PI * 1.5);
    arc2(ro - b, -h / 2 + b, PI * 1.5, PI * 2);
    arc2(ro - b, h / 2 - b, 0, PI * 0.5);
    arc2(ri + b, h / 2 - b, PI * 0.5, PI);
    return new THREE.LatheGeometry([...inner, ...out], seg);
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
  /** a rounded box w x h x d centred at (x, y, z) turned by ry */
  box(mat, w, h, d, x, y, z, r, ry = 0) {
    return this.add(mat, rb(w, h, d, r), x, y, z, 0, ry, 0);
  }
  cyl(mat, r0, r1, h, x, y, z, axis = 'y', seg = 20) {
    const g = cylG(r0, r1, h, seg);
    if (axis === 'x') return this.add(mat, g, x, y, z, 0, 0, -PI / 2);
    if (axis === 'z') return this.add(mat, g, x, y, z, PI / 2, 0, 0);
    return this.add(mat, g, x, y, z);
  }
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
  /** a square bar with rounded edges between two points */
  bar(mat, a, b, t = 0.12) {
    const A = V3(...a);
    const d = V3(...b).sub(A);
    const len = d.length();
    _q.setFromUnitVectors(V3(0, 1, 0), d.clone().normalize());
    return this.put(mat, rb(t, len + t, t, t * 0.4), _m.compose(A.addScaledVector(d, 0.5), _q, _s.set(1, 1, 1)));
  }
  /** a flat print w x h facing +z turned by ry */
  print(mat, w, h, x, y, z, ry = 0, rx = 0) {
    return this.add(mat, planeG(w, h), x, y, z, rx, ry, 0);
  }
  /** a texture print of height h (width from the texture's aspect) */
  printTex(tex, h, x, y, z, ry = 0) {
    const a = tex.image.width / tex.image.height;
    return this.print(decalMat(tex), h * a, h, x, y, z, ry);
  }
  /** a flat strip on the ground from (x0, z0) to (x1, z1), w wide, at height y */
  strip(mat, x0, z0, x1, z1, w, y = 0.012) {
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
function instanced(geo, mat, n, cast = true) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
  im.castShadow = cast && !mat.userData.noCast && !mat.transparent;
  im.receiveShadow = true;
  im.frustumCulled = false;
  return im;
}
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const mat4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz));

// ================================================================ earth
let EARTH = null;
const earthMat = () => (EARTH ??= new THREE.MeshStandardMaterial({vertexColors: true, map: sandTex(), roughness: 0.96}));
const pebbleGeo = () =>
  cg('pebble', () => {
    let g = new THREE.IcosahedronGeometry(1, 3);
    g.deleteAttribute('uv');
    g.deleteAttribute('normal');
    g = mergeVertices(g);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = V3(p.getX(i), p.getY(i), p.getZ(i));
      const k = 1 + 0.16 * fbm(v.x * 1.3 + 3, v.z * 1.3 + v.y * 0.8, 4, 2);
      v.multiplyScalar(k);
      p.setXYZ(i, v.x, v.y * 0.62, v.z);
    }
    g.computeVertexNormals();
    return g;
  });

/** dashes along a polyline pts [[x, z]...] (closed or open) -> [{x, z, a, len}], evenly spread */
function dashes(pts, closed, dash = 1.1, gap = 0.55) {
  const P = closed ? [...pts, pts[0]] : pts;
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const total = cum[cum.length - 1];
  const at = (s) => {
    let i = 1;
    while (i < cum.length - 1 && cum[i] < s) i++;
    const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return [lerp(P[i - 1][0], P[i][0], t), lerp(P[i - 1][1], P[i][1], t)];
  };
  const n = Math.max(1, Math.round(total / (dash + gap)));
  const per = total / n;
  const dl = (per * dash) / (dash + gap);
  const out = [];
  for (let k = 0; k < n; k++) {
    const s0 = k * per + (closed ? 0 : (per - dl) / 2);
    const p0 = at(s0);
    const p1 = at(s0 + dl);
    const m = at(s0 + dl / 2);
    out.push({x: m[0], z: m[1], a: Math.atan2(-(p1[1] - p0[1]), p1[0] - p0[0]), len: Math.hypot(p1[0] - p0[0], p1[1] - p0[1])});
  }
  return out;
}

export function buildToyPit({w = 40, d = 28, depth = 4, ramp = {}, margin = 5, corner = [1, 1], res = 0.28, seed = 3} = {}) {
  const M = mats();
  const A = w / 2;
  const B = d / 2;
  const D = depth;
  const RP = {side: '-x', width: 7, out: 9, at: 0, ...ramp};
  const axis = RP.side[1];
  const sg = RP.side[0] === '-' ? -1 : 1;
  const Hn = axis === 'x' ? A : B;
  const slope = D / (RP.out + D);
  const toE = (x, z) => sg * (axis === 'x' ? x : z);
  const toQ = (x, z) => (axis === 'x' ? z : x) - RP.at;
  const fromEQ = (e, q, y = 0) => (axis === 'x' ? V3(sg * e, y, q + RP.at) : V3(q + RP.at, y, sg * e));
  const rc = Math.min(3, A, B);
  const KT = 0.7; // toe rounding
  const KC = 0.5; // crest rounding
  const KU = 0.9; // the crease between the pit walls and the ramp cut
  const KL = 0.5;

  /** the finished pit's surface height */
  function finalH(x, z) {
    const s = sdRoundRect(x, z, A, B, rc);
    const pit = smax(s, -D, KT);
    const e = toE(x, z);
    const q = toQ(x, z);
    let r = smax(-(Hn + RP.out - e) * slope, -D, KT);
    r += smax(Math.abs(q) - RP.width / 2, 0, KL);
    r += smax(Hn - D - 2.5 - e, 0, KL);
    return smin(0, smin(pit, r, KU), KC);
  }
  // the dig grows from a corner: a superellipse metric, z scaled so the front reaches both far sides together
  const cx = corner[0] * A;
  const cz = corner[1] * B;
  const AN = A / B;
  const PN = 2.4;
  const metric = (x, z) => Math.pow(Math.pow(Math.abs(x - cx), PN) + Math.pow(Math.abs(z - cz) * AN, PN), 1 / PN);
  const roughAt = (x, z) => 0.36 * Math.max(0, fbm(x * 0.27, z * 0.27, seed, 3) + 0.12) + 0.05 * fbm(x * 1.3, z * 1.3, seed + 5, 2) + 0.03;
  const LAG = 7;

  // footprint: the outline + the ramp + the plot margin
  const MG = typeof margin === 'number' ? {x0: margin, x1: margin, z0: margin, z1: margin} : {x0: 5, x1: 5, z0: 5, z1: 5, ...margin};
  const x0 = -A - MG.x0 - (RP.side === '-x' ? RP.out : 0);
  const x1 = A + MG.x1 + (RP.side === '+x' ? RP.out : 0);
  const z0 = -B - MG.z0 - (RP.side === '-z' ? RP.out : 0);
  const z1 = B + MG.z1 + (RP.side === '+z' ? RP.out : 0);
  const nx = Math.round((x1 - x0) / res) + 1;
  const nz = Math.round((z1 - z0) / res) + 1;
  const dx = (x1 - x0) / (nx - 1);
  const dz = (z1 - z0) / (nz - 1);
  const N = nx * nz;
  const HF = new Float32Array(N);
  const MT = new Float32Array(N);
  const RO = new Float32Array(N);
  const TN = new Float32Array(N); // colour grain
  const LIP = new Float32Array(N);
  const TR = new Float32Array(N); // tyre tracks
  let mMax = 0;
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const x = x0 + i * dx;
      const z = z0 + j * dz;
      HF[k] = finalH(x, z);
      MT[k] = metric(x, z);
      RO[k] = roughAt(x, z);
      TN[k] = fbm(x * 0.12, z * 0.12, seed + 9, 2);
      const e = toE(x, z);
      const q = Math.abs(toQ(x, z));
      TR[k] = e < Hn + RP.out && e > Hn - D - 7 ? sstep((0.34 - Math.abs(q - 1.15)) / 0.12) * sat((e - (Hn - D - 7)) / 4) : 0;
      const edge = Math.min(x - x0, x1 - x, z - z0, z1 - z);
      LIP[k] = -0.05 * sstep((0.35 - edge) / 0.35);
      if (HF[k] < -0.05) mMax = Math.max(mMax, MT[k]);
    }
  const Rmax = mMax + LAG + D * 0.5 + 1.6;
  const floorFront = (lv) => lerp(A + 5, -A - 5, lv) * corner[0];

  const st = {dug: 1, level: 1};
  /** the surface at progress st from the static fields */
  function dyn(hf, m, rough, x, lip) {
    let h = hf;
    if (st.dug <= 0) h = 0;
    else if (st.dug < 1) {
      const Rk = Rmax * Math.pow(st.dug, 0.6);
      const f1 = Math.max(m - Rk, -D * 0.5);
      const f2 = m - Rk + LAG - D * 0.5;
      const F = smin(0, smin(f1, f2, 0.6), 0.45);
      h = smax(hf, F, 0.45);
    }
    const wf = sat((-h - (D - 0.7)) / 0.5);
    let lev = 0;
    if (wf > 0) {
      lev = st.level >= 1 ? 1 : sat(((x - floorFront(st.level)) * corner[0]) / 5);
      h += wf * rough * (1 - lev);
    }
    return [h + lip, wf, lev];
  }
  function heightAt(x, z) {
    return dyn(finalH(x, z), metric(x, z), roughAt(x, z), x, 0)[0];
  }

  // ---- the earth mesh
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3);
  const nor = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const uv = new Float32Array(N * 2);
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      pos[k * 3] = x0 + i * dx;
      pos[k * 3 + 2] = z0 + j * dz;
      uv[k * 2] = pos[k * 3] / 10;
      uv[k * 2 + 1] = -pos[k * 3 + 2] / 10;
    }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let t = 0;
  for (let j = 0; j < nz - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      const b = a + 1;
      const c = a + nx;
      const e = c + 1;
      idx[t++] = a;
      idx[t++] = c;
      idx[t++] = b;
      idx[t++] = b;
      idx[t++] = c;
      idx[t++] = e;
    }
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.boundingSphere = new THREE.Sphere(V3((x0 + x1) / 2, -D / 2, (z0 + z1) / 2), Math.hypot(x1 - x0, z1 - z0, D) / 2 + 1);
  geo.boundingBox = new THREE.Box3(V3(x0, -D - 1, z0), V3(x1, 1, z1));
  const earth = new THREE.Mesh(geo, earthMat());
  earth.castShadow = earth.receiveShadow = true;
  earth.name = 'pit-earth';

  const cSand = new THREE.Color(SITE.sand);
  const cCut = new THREE.Color(SITE.sandCut);
  const cFloor = new THREE.Color(SITE.sandFloor);
  const cLevel = new THREE.Color(SITE.sandLevel);
  const tmp = new THREE.Color();
  const H = new Float32Array(N);
  const WF = new Float32Array(N);
  const LV = new Float32Array(N);
  function rebuild() {
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const [h, wf, lev] = dyn(HF[k], MT[k], RO[k], pos[k * 3], LIP[k]);
        H[k] = h;
        WF[k] = wf;
        LV[k] = lev;
        pos[k * 3 + 1] = h;
      }
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const hx = (H[j * nx + Math.min(nx - 1, i + 1)] - H[j * nx + Math.max(0, i - 1)]) / ((Math.min(nx - 1, i + 1) - Math.max(0, i - 1)) * dx);
        const hz = (H[Math.min(nz - 1, j + 1) * nx + i] - H[Math.max(0, j - 1) * nx + i]) / ((Math.min(nz - 1, j + 1) - Math.max(0, j - 1)) * dz);
        const l = Math.hypot(hx, 1, hz);
        nor[k * 3] = -hx / l;
        nor[k * 3 + 1] = 1 / l;
        nor[k * 3 + 2] = -hz / l;
        // the colour reads the planes apart: pale top ground, the floor a step down, the cut faces deepest
        const h = H[k];
        tmp.copy(cSand).lerp(cFloor, sat(-h / 0.7));
        if (WF[k] > 0) tmp.lerp(cLevel, WF[k] * LV[k]);
        tmp.lerp(cCut, sat((1 - 1 / l) / 0.22));
        let g = 1 + 0.035 * TN[k];
        // the roller's passes on the levelled floor, and 2 tyre tracks worn down the ramp onto the floor
        if (WF[k] > 0 && LV[k] > 0) g *= 1 + 0.025 * WF[k] * LV[k] * Math.sign(Math.sin((pos[k * 3 + 2] * PI) / 2.4));
        if (TR[k] > 0 && h < -0.08) g *= 1 - 0.075 * TR[k];
        col[k * 3] = tmp.r * g;
        col[k * 3 + 1] = tmp.g * g;
        col[k * 3 + 2] = tmp.b * g;
      }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    placeExtras();
  }

  const group = new THREE.Group();
  group.name = 'pit';
  group.add(earth);

  // ---- rocks: a few on the floor (they go with the levelling) and on the faces (they stay)
  const R = rng(seed + 2);
  const rocks = [];
  for (let n = 0; n < 7; n++) rocks.push({x: lerp(-A + D + 2, A - D - 2, R()), z: lerp(-B + D + 2, B - D - 2, R()), s: 0.35 + R() * 0.35, ry: R() * 6, floor: true});
  for (let n = 0; n < 6; n++) {
    const side = Math.floor(R() * 4);
    const along = R() * 2 - 1;
    const inn = 1.2 + R() * 1.8;
    const x = side < 2 ? (side ? 1 : -1) * (A - inn) : along * (A - D - 2);
    const z = side < 2 ? along * (B - D - 2) : (side === 3 ? 1 : -1) * (B - inn);
    rocks.push({x, z, s: 0.3 + R() * 0.3, ry: R() * 6, floor: false});
  }
  const rockMesh = instanced(pebbleGeo(), M.rock, rocks.length);
  group.add(rockMesh);

  // ---- the sprayed outline (pit + the ramp's two edges at grade), dashes that vanish when dug
  const outline = [];
  const NS = 18;
  const corners = [
    [A - rc, B - rc, 0],
    [-A + rc, B - rc, PI / 2],
    [-A + rc, -B + rc, PI],
    [A - rc, -B + rc, PI * 1.5],
  ];
  for (const [ccx, ccz, a0] of corners) for (let k = 0; k <= NS; k++) {
    const a = a0 + (k / NS) * (PI / 2);
    outline.push([ccx + rc * Math.cos(a), ccz + rc * Math.sin(a)]);
  }
  const sprayList = dashes(outline, true);
  const spreadTop = RP.width / 2 + RP.out * slope;
  for (const s of [-1, 1]) {
    const a = fromEQ(Hn + 0.3, s * (spreadTop - 0.3 * slope));
    const b = fromEQ(Hn + RP.out - 0.2, s * (RP.width / 2 + 0.2 * slope));
    sprayList.push(...dashes([[a.x, a.z], [b.x, b.z]], false));
  }
  const sprayMesh = instanced(planeG(1, 0.22), M.spray, sprayList.length, false);
  group.add(sprayMesh);

  // ---- profile boards at the corners (wood pegs, white boards with an orange edge) and the string lines
  const OFF = 2.2;
  tpl(`pitmarks|${w}|${d}`, (P) => {
    const peg = (x, z, hh = 0.85) => {
      P.box(M.wood, 0.12, hh, 0.12, x, hh / 2, z, 0.03);
      P.box(M.orange, 0.13, 0.12, 0.13, x, hh - 0.03, z, 0.03);
    };
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        // a board across the z = sz B line (holds that line's string) and one across the x = sx A line
        const bx = sx * (A + OFF);
        peg(bx, sz * (B - 0.8));
        peg(bx, sz * (B + 0.8));
        P.ext(M.white, bx - 0.04, bx + 0.04, 0.5, 0.72, sz * B - 1.0, sz * B + 1.0, 0.03);
        const bz = sz * (B + OFF);
        peg(sx * (A - 0.8), bz);
        peg(sx * (A + 0.8), bz);
        P.ext(M.white, sx * A - 1.0, sx * A + 1.0, 0.5, 0.72, bz - 0.04, bz + 0.04, 0.03);
        // the corner peg itself, sprayed
        peg(sx * (A + 0.6), sz * (B + 0.6), 0.6);
      }
  }, group);
  const strings = new THREE.Group();
  tpl(`pitstrings|${w}|${d}`, (P) => {
    for (const sz of [-1, 1]) P.ext(M.string, -A - OFF, A + OFF, 0.7, 0.73, sz * B - 0.015, sz * B + 0.015, 0);
    for (const sx of [-1, 1]) P.ext(M.string, sx * A - 0.015, sx * A + 0.015, 0.7, 0.73, -B - OFF, B + OFF, 0);
  }, strings);
  group.add(strings);

  function placeExtras() {
    rocks.forEach((r, i) => {
      const [h, wf, lev] = dyn(finalH(r.x, r.z), metric(r.x, r.z), roughAt(r.x, r.z), r.x, 0);
      const dug = h < -0.7;
      let s = r.s;
      let y = h - 0.12 * s;
      if (r.floor) {
        if (lev > 0.85 || !dug) s = 0;
        y -= lev * s * 1.1;
      } else if (!dug || h > -0.5) s = 0;
      rockMesh.setMatrixAt(i, s ? mat4(r.x, y, r.z, 0, r.ry, 0, s, s, s) : ZERO);
    });
    rockMesh.instanceMatrix.needsUpdate = true;
    sprayList.forEach((sp, i) => {
      const h = st.dug <= 0 ? 0 : dyn(finalH(sp.x, sp.z), metric(sp.x, sp.z), 0, sp.x, 0)[0];
      sprayMesh.setMatrixAt(i, h > -0.06 ? mat4(sp.x, 0.025, sp.z, -PI / 2, 0, sp.a, sp.len, 1, 1) : ZERO);
    });
    sprayMesh.instanceMatrix.needsUpdate = true;
    strings.visible = st.dug < 0.015;
  }

  const last = {dug: NaN, level: NaN};
  const refresh = () => {
    if (last.dug === st.dug && last.level === st.level) return;
    last.dug = st.dug;
    last.level = st.level;
    rebuild();
  };
  const top = fromEQ(Hn + RP.out, 0, 0);
  const foot = fromEQ(Hn - D, 0, -D);
  const dir = foot.clone().sub(top).setY(0).normalize();
  const hole = [
    [x0 + 0.17, z0 + 0.17],
    [x1 - 0.17, z0 + 0.17],
    [x1 - 0.17, z1 - 0.17],
    [x0 + 0.17, z1 - 0.17],
  ];
  refresh();
  return {
    group,
    setDug(k) {
      st.dug = sat(k);
      refresh();
    },
    setLevel(k) {
      st.level = sat(k);
      refresh();
    },
    heightAt,
    floorY: -D,
    floor: {w: w - 2 * D, d: d - 2 * D},
    ramp: {top, foot, dir, width: RP.width, side: RP.side},
    bounds: {x0, x1, z0, z1},
    hole,
    holeWorld() {
      group.updateMatrixWorld(true);
      return hole.map(([x, z]) => {
        const v = group.localToWorld(V3(x, 0, z));
        return [v.x, v.z];
      });
    },
    dims: {w, d, depth},
  };
}

/** the lavender lot as one plane with holes (world [x, z] polygons) under the pits */
export function buildToyLot({w = 1400, d = 1400, color = TOY.ground, holes = [], x = 0, z = 0} = {}) {
  const s = new THREE.Shape();
  s.moveTo(x - w / 2, -(z - d / 2));
  s.lineTo(x + w / 2, -(z - d / 2));
  s.lineTo(x + w / 2, -(z + d / 2));
  s.lineTo(x - w / 2, -(z + d / 2));
  s.closePath();
  for (const poly of holes) {
    const h = new THREE.Path();
    poly.forEach(([px, pz], i) => (i ? h.lineTo(px, -pz) : h.moveTo(px, -pz)));
    h.closePath();
    s.holes.push(h);
  }
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(-PI / 2);
  const m = new THREE.Mesh(g, toyMat(color, {rough: 0.95}));
  m.receiveShadow = true;
  m.name = 'lot';
  return m;
}

// ================================================================ spoil heaps
/** a heap as truck loads dumped side by side: a main cone and 2-3 smaller ones, crowns rounded, flanks lumpy */
export function buildToySoilHeap({volume = 150, seed = 1, loads = 3, angle = 34} = {}) {
  const tan = Math.tan((angle * PI) / 180);
  const R = rng(seed + 21);
  // the loads in unit space (main radius 1), then scaled to the volume
  const cones = [{x: 0, z: 0, r: 1}];
  const a0 = R() * PI * 2;
  for (let i = 0; i < loads; i++) {
    const a = a0 + (i / loads) * PI * 2 + (R() - 0.5) * 0.9;
    const d = 0.72 + R() * 0.22;
    cones.push({x: Math.cos(a) * d, z: Math.sin(a) * d, r: 0.6 + R() * 0.15});
  }
  const unitH = (x, z) => {
    let h = -1;
    for (const c of cones) {
      let y = c.r - Math.hypot(x - c.x, z - c.z);
      y = smin(y, c.r * 0.8, c.r * 0.45); // a rounded crown
      h = smax(h, y, 0.32);
    }
    return h;
  };
  // the unit heap's volume (heights x tan), so the real one can be scaled to `volume`
  let vol = 0;
  const S = 2.2;
  const NV = 90;
  for (let j = 0; j < NV; j++)
    for (let i = 0; i < NV; i++) {
      const h = unitH(-S + ((i + 0.5) / NV) * 2 * S, -S + ((j + 0.5) / NV) * 2 * S);
      if (h > 0) vol += h * tan * ((2 * S) / NV) ** 2;
    }
  const L = Math.cbrt(volume / vol);
  let maxR = 0;
  for (const c of cones) maxR = Math.max(maxR, Math.hypot(c.x, c.z) + c.r);
  const ext = (maxR + 0.12) * L;
  const Hm = cones[0].r * 0.8 * L * tan;
  const geo = cg(`heap|${volume}|${seed}|${loads}|${angle}`, () => {
    const n = 84;
    const g = new THREE.PlaneGeometry(2 * ext, 2 * ext, n, n).rotateX(-PI / 2);
    g.deleteAttribute('normal');
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      let y = unitH(x / L, z / L) * L * tan;
      // soft toe, lumps and clods on the flanks
      const lump = 0.22 * Math.max(0, fbm(x * 0.45 + seed, z * 0.45, seed + 4, 3) + 0.05) + 0.07 * fbm(x * 1.4, z * 1.4, seed + 7, 2);
      y = smax(y + lump * sat(y / 0.6), -0.08, 0.4);
      p.setY(i, y);
    }
    // drop the flat skirt round the toe, so a heap by the pit's crest never shows a square of ground over it
    const ix = g.index.array;
    const keep = [];
    for (let t = 0; t < ix.length; t += 3) if (Math.max(p.getY(ix[t]), p.getY(ix[t + 1]), p.getY(ix[t + 2])) > -0.05) keep.push(ix[t], ix[t + 1], ix[t + 2]);
    g.setIndex(keep);
    g.computeVertexNormals();
    const uvs = g.attributes.uv;
    const cols = new Float32Array(p.count * 3);
    const cTop = new THREE.Color(SITE.sandFloor);
    const cFlank = new THREE.Color(SITE.sandCut);
    const cDry = new THREE.Color(SITE.sand);
    const c = new THREE.Color();
    const nn = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      uvs.setXY(i, p.getX(i) / 10, -p.getZ(i) / 10);
      const y = p.getY(i);
      // flanks the cut colour, crowns a step lighter (dried), the toe a touch darker
      c.copy(cTop).lerp(cFlank, sat((1 - nn.getY(i)) / 0.3));
      c.lerp(cDry, 0.35 * sat((y - Hm * 0.55) / (Hm * 0.45)));
      c.multiplyScalar(0.93 + 0.07 * sat(y / 0.7));
      const gr = 1 + 0.04 * fbm(p.getX(i) * 0.2, p.getZ(i) * 0.2, seed + 2, 2);
      cols[i * 3] = c.r * gr;
      cols[i * 3 + 1] = c.g * gr;
      cols[i * 3 + 2] = c.b * gr;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    return g;
  });
  const group = new THREE.Group();
  group.name = 'soil-heap';
  const m = new THREE.Mesh(geo, earthMat());
  m.castShadow = m.receiveShadow = true;
  group.add(m);
  return {
    group,
    setSize(k) {
      k = sat(k);
      const s = Math.cbrt(k);
      m.scale.set(s, s, s);
      m.visible = k > 0.002;
    },
    radius: ext,
    height: Hm + 0.2,
  };
}

// ================================================================ rebar mat
export function buildToyRebarMat({w = 30, d = 20, spacing = 1.25, strip = 2.5, lift = 0.16, bar = 0.1, from = 1} = {}) {
  const M = mats();
  const n = Math.max(1, Math.round(w / strip));
  const sw = w / n;
  const zLen = d - 0.4;
  const zs0 = -d / 2 + 0.2;
  const xs = [];
  for (let x = -w / 2 + 0.3; x <= w / 2 - 0.3 + 1e-6; x += spacing) xs.push(x);
  const zl = [];
  for (let z = -d / 2 + 0.35; z <= d / 2 - 0.35 + 1e-6; z += spacing) zl.push(z);
  const stripOf = (x) => clamp(Math.floor((x + w / 2) / sw), 0, n - 1);
  const order = (i) => (from > 0 ? n - 1 - i : i);
  const zGeo = cg(`rbz|${bar}`, () => new THREE.CylinderGeometry(bar / 2, bar / 2, 1, 8).rotateX(PI / 2));
  const xGeo = cg(`rbx|${bar}`, () => new THREE.CylinderGeometry(bar / 2, bar / 2, 1, 8).rotateZ(PI / 2));
  const zMesh = instanced(zGeo, M.rebar, xs.length);
  const xMesh = instanced(xGeo, M.rebar, n * zl.length);
  const spacers = [];
  for (let i = 0; i < xs.length; i += 3) for (let l = 1; l < zl.length; l += 3) spacers.push([xs[i], zl[l]]);
  const spMesh = instanced(rb(0.16, lift, 0.16, 0.04), M.spacer, spacers.length);
  const group = new THREE.Group();
  group.name = 'rebar-mat';
  group.add(zMesh, xMesh, spMesh);
  const yB = lift + bar / 2;
  const yT = lift + bar * 1.5;
  let last = NaN;
  function setLaid(k) {
    k = sat(k);
    if (k === last) return;
    last = k;
    const u = (s) => ease(sat(k * n - order(s)));
    xs.forEach((x, i) => {
      const e = u(stripOf(x));
      const len = zLen * e;
      zMesh.setMatrixAt(i, e > 0 ? mat4(x, yB, zs0 + len / 2, 0, 0, 0, 1, 1, len) : ZERO);
    });
    let c = 0;
    for (let s = 0; s < n; s++) {
      const front = zs0 + zLen * u(s);
      const xa = -w / 2 + s * sw - (s ? 0.1 : -0.15);
      const xb = -w / 2 + (s + 1) * sw + (s < n - 1 ? 0.1 : -0.15);
      for (const z of zl) {
        const a = sat((front - z) / 0.9);
        xMesh.setMatrixAt(c++, a > 0 ? mat4((xa + xb) / 2, yT + 0.4 * (1 - a) * (1 - a), z, 0, 0, 0, (xb - xa) * (0.4 + 0.6 * a), 1, 1) : ZERO);
      }
    }
    spacers.forEach(([x, z], i) => {
      const a = sat((zs0 + zLen * u(stripOf(x)) - z + 0.5) / 0.5);
      spMesh.setMatrixAt(i, a > 0 ? mat4(x, lift / 2, z, 0, 0, 0, 1, a, 1) : ZERO);
    });
    zMesh.instanceMatrix.needsUpdate = xMesh.instanceMatrix.needsUpdate = spMesh.instanceMatrix.needsUpdate = true;
  }
  setLaid(1);
  return {group, setLaid, top: yT + bar / 2};
}

// ================================================================ formwork
export function buildToyFormwork({w = 30, d = 20, h = 0.8, panel = 2.5} = {}) {
  const M = mats();
  const T = 0.12;
  // panels along x (on the +/-z sides) and along z (on the +/-x sides); local frame: along x, inner face at z = 0,
  // the body toward +z (outward), standing on y = 0
  const nX = Math.max(1, Math.round(w / panel));
  const nZ = Math.max(1, Math.round(d / panel));
  const lX = w / nX;
  const lZ = (d + 2 * T) / nZ; // the end sides run past the corners to close them
  const kit = (L) => {
    const parts = {};
    const P = new Parts();
    P.ext(M.white, -L / 2 + 0.02, L / 2 - 0.02, 0, h - 0.06, 0, T, 0.035);
    P.ext(M.blue, -L / 2 + 0.02, L / 2 - 0.02, h - 0.12, h + 0.04, -0.02, T + 0.08, 0.05);
    for (const s of [-1, 1]) P.ext(M.blue, s * L * 0.28 - 0.07, s * L * 0.28 + 0.07, 0, h - 0.1, T, T + 0.13, 0.04);
    const Q = new Parts();
    for (const s of [-1, 1]) {
      const x = s * L * 0.28;
      Q.bar(M.blue, [x, h * 0.72, T + 0.1], [x, 0.05, T + 0.75], 0.07);
      Q.ext(M.blue, x - 0.12, x + 0.12, 0, 0.05, T + 0.62, T + 0.88, 0.02);
    }
    const a = P.merged();
    parts.white = a.find(([m]) => m === M.white)[1];
    parts.blue = a.find(([m]) => m === M.blue)[1];
    parts.brace = Q.merged()[0][1];
    return parts;
  };
  const kX = cg(`fwk|${lX}|${h}`, () => kit(lX));
  const kZ = cg(`fwk|${lZ}|${h}`, () => kit(lZ));
  // the perimeter, walked from the +x+z corner: +z side toward -x, -x side toward -z, -z side toward +x, +x side toward +z
  const list = [];
  for (let i = 0; i < nX; i++) list.push({k: 'X', x: w / 2 - (i + 0.5) * lX, z: d / 2, ry: PI});
  for (let i = 0; i < nZ; i++) list.push({k: 'Z', x: -w / 2, z: d / 2 + T - (i + 0.5) * lZ, ry: -PI / 2});
  for (let i = 0; i < nX; i++) list.push({k: 'X', x: -w / 2 + (i + 0.5) * lX, z: -d / 2, ry: 0});
  for (let i = 0; i < nZ; i++) list.push({k: 'Z', x: w / 2, z: -d / 2 - T + (i + 0.5) * lZ, ry: PI / 2});
  // ry turns the panel's local +z (its outer face) to the side's outward normal
  for (const p of list) {
    const out = p.k === 'X' ? (p.z > 0 ? [0, 1] : [0, -1]) : p.x > 0 ? [1, 0] : [-1, 0];
    p.ry = Math.atan2(out[0], out[1]);
  }
  const group = new THREE.Group();
  group.name = 'formwork';
  const meshes = {};
  for (const K of ['X', 'Z']) {
    const kk = K === 'X' ? kX : kZ;
    const cnt = list.filter((p) => p.k === K).length;
    meshes[K] = {white: instanced(kk.white, M.white, cnt), blue: instanced(kk.blue, M.blue, cnt), brace: instanced(kk.brace, M.blue, cnt)};
    group.add(meshes[K].white, meshes[K].blue, meshes[K].brace);
  }
  const NT = list.length;
  let last = NaN;
  const mA = new THREE.Matrix4();
  const mB = new THREE.Matrix4();
  function setBuilt(k) {
    k = sat(k);
    if (k === last) return;
    last = k;
    const ix = {X: 0, Z: 0};
    list.forEach((p, i) => {
      const u = sat(k * NT * 1.15 - i * 1.15);
      const e = ease(u);
      const ms = meshes[p.k];
      const j = ix[p.k]++;
      if (u <= 0) {
        ms.white.setMatrixAt(j, ZERO);
        ms.blue.setMatrixAt(j, ZERO);
        ms.brace.setMatrixAt(j, ZERO);
        return;
      }
      // tip up about the inner bottom edge: lying flat inside (rx = -PI/2) to standing (0)
      mA.makeRotationY(p.ry).setPosition(p.x, 0, p.z);
      mB.makeRotationX(-(1 - e) * (PI / 2));
      const m = mA.clone().multiply(mB);
      ms.white.setMatrixAt(j, m);
      ms.blue.setMatrixAt(j, m);
      const b = sat((u - 0.8) / 0.2);
      ms.brace.setMatrixAt(j, b > 0 ? mA.clone().multiply(new THREE.Matrix4().makeScale(1, b, 1)) : ZERO);
    });
    for (const K of ['X', 'Z']) for (const m of Object.values(meshes[K])) m.instanceMatrix.needsUpdate = true;
  }
  setBuilt(1);
  return {group, setBuilt, height: h};
}

// ================================================================ the foundation slab
let CONC = null;
function concreteMat() {
  if (CONC) return CONC;
  const m = new THREE.MeshStandardMaterial({color: '#ffffff', map: concreteTex(), roughness: 0.9});
  const dry = new THREE.Color(SITE.concrete);
  const wet = new THREE.Color(SITE.concreteWet);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDry = {value: dry};
    sh.uniforms.uWet = {value: wet};
    sh.vertexShader = 'attribute float wet;\nvarying float vWet;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWet = wet;');
    sh.fragmentShader =
      'uniform vec3 uDry;\nuniform vec3 uWet;\nvarying float vWet;\n' +
      sh.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= mix(uDry, uWet, vWet);')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.28, vWet);');
  };
  m.customProgramCacheKey = () => 'site-concrete-wet';
  CONC = m;
  return m;
}
export function buildToySlab({w = 30, d = 20, h = 0.6, pourAt = null, res = 0.25} = {}) {
  const PP = pourAt ?? [w / 2 - 3, 0];
  const nx = Math.round(w / res) + 1;
  const nz = Math.round(d / res) + 1;
  const dx = w / (nx - 1);
  const dz = d / (nz - 1);
  const N = nx * nz;
  const pos = new Float32Array(N * 3);
  const nor = new Float32Array(N * 3);
  const uv = new Float32Array(N * 2);
  const wetA = new Float32Array(N);
  const dist = new Float32Array(N);
  const edge = new Float32Array(N);
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const x = -w / 2 + i * dx;
      const z = -d / 2 + j * dz;
      pos[k * 3] = x;
      pos[k * 3 + 2] = z;
      uv[k * 2] = x / 6;
      uv[k * 2 + 1] = -z / 6;
      dist[k] = Math.hypot(x - PP[0], z - PP[1]);
      edge[k] = Math.min(w / 2 - Math.abs(x), d / 2 - Math.abs(z));
    }
  const sorted = Float32Array.from(dist).sort();
  const dMax = sorted[N - 1];
  const idx = [];
  for (let j = 0; j < nz - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      idx.push(a, a + nx, a + 1, a + 1, a + nx, a + nx + 1);
    }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(idx);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('wet', new THREE.BufferAttribute(wetA, 1));
  geo.boundingSphere = new THREE.Sphere(V3(0, h / 2, 0), Math.hypot(w, d) / 2 + 1);
  // the side skirt: the boundary loop, top following the edge heights, bottom just under the floor
  const loop = [];
  for (let i = 0; i < nx; i++) loop.push(i);
  for (let j = 1; j < nz; j++) loop.push(j * nx + nx - 1);
  for (let i = nx - 2; i >= 0; i--) loop.push((nz - 1) * nx + i);
  for (let j = nz - 2; j > 0; j--) loop.push(j * nx);
  const L = loop.length;
  const sp = new Float32Array(L * 2 * 3);
  const sn = new Float32Array(L * 2 * 3);
  const sw = new Float32Array(L * 2);
  const suv = new Float32Array(L * 2 * 2);
  const sidx = [];
  loop.forEach((k, n) => {
    const x = pos[k * 3];
    const z = pos[k * 3 + 2];
    let ox = Math.abs(Math.abs(x) - w / 2) < 1e-4 ? Math.sign(x) : 0;
    let oz = Math.abs(Math.abs(z) - d / 2) < 1e-4 ? Math.sign(z) : 0;
    const l = Math.hypot(ox, oz) || 1;
    ox /= l;
    oz /= l;
    for (const b of [0, 1]) {
      const v = n * 2 + b;
      sp[v * 3] = x;
      sp[v * 3 + 2] = z;
      sn[v * 3] = ox;
      sn[v * 3 + 2] = oz;
      suv[v * 2] = (x + z) / 6;
      suv[v * 2 + 1] = b * 0.1;
    }
    const a = n * 2;
    const c = ((n + 1) % L) * 2;
    sidx.push(a, c, a + 1, c, c + 1, a + 1);
  });
  const sgeo = new THREE.BufferGeometry();
  sgeo.setIndex(sidx);
  sgeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  sgeo.setAttribute('normal', new THREE.BufferAttribute(sn, 3));
  sgeo.setAttribute('uv', new THREE.BufferAttribute(suv, 2));
  sgeo.setAttribute('wet', new THREE.BufferAttribute(sw, 1));
  sgeo.boundingSphere = geo.boundingSphere.clone();
  const mat = concreteMat();
  const top = new THREE.Mesh(geo, mat);
  const side = new THREE.Mesh(sgeo, mat);
  for (const m of [top, side]) m.castShadow = m.receiveShadow = true;
  const group = new THREE.Group();
  group.name = 'slab';
  group.add(top, side);
  const st = {pour: 1, wet: 1};
  const last = {pour: NaN, wet: NaN};
  const FW = 1.8;
  const BEV = 0.12;
  const Y = new Float32Array(N);
  function rebuild() {
    const k = st.pour;
    group.visible = k > 0;
    if (k <= 0) return;
    const Rk = k >= 1 ? 1e9 : sorted[Math.min(N - 1, Math.floor(k * (N - 1)))];
    const mound = 0.3 * sat(k * 14) * sat((1 - k) * 7);
    for (let i = 0; i < N; i++) {
      const f = k >= 1 ? 1 : sstep((Rk + FW * 0.5 - dist[i]) / FW);
      let y = h * f + mound * Math.exp(-((dist[i] / 2.4) ** 2));
      if (edge[i] < BEV) y -= f * (BEV - Math.sqrt(Math.max(0, BEV * BEV - (BEV - edge[i]) ** 2)));
      if (y < 0.012) y = -0.04;
      Y[i] = y;
      pos[i * 3 + 1] = y;
      // it dries from the pour point outward; the moving front stays fresh
      const age = 1 - dist[i] / dMax;
      wetA[i] = Math.max(sat(st.wet * 1.6 - age * 0.6), k < 1 ? 1 - f : 0, k < 1 ? sat(st.wet) : 0);
    }
    for (let j = 0; j < nz; j++)
      for (let i = 0; i < nx; i++) {
        const kk = j * nx + i;
        const i0 = Math.max(0, i - 1);
        const i1 = Math.min(nx - 1, i + 1);
        const j0 = Math.max(0, j - 1);
        const j1 = Math.min(nz - 1, j + 1);
        const hx = (Y[j * nx + i1] - Y[j * nx + i0]) / ((i1 - i0) * dx);
        const hz = (Y[j1 * nx + i] - Y[j0 * nx + i]) / ((j1 - j0) * dz);
        const l = Math.hypot(hx, 1, hz);
        nor[kk * 3] = -hx / l;
        nor[kk * 3 + 1] = 1 / l;
        nor[kk * 3 + 2] = -hz / l;
      }
    loop.forEach((kk, n) => {
      sp[n * 6 + 1] = Y[kk];
      sp[n * 6 + 4] = -0.04;
      sw[n * 2] = sw[n * 2 + 1] = wetA[kk];
    });
    geo.attributes.position.needsUpdate = geo.attributes.normal.needsUpdate = geo.attributes.wet.needsUpdate = true;
    sgeo.attributes.position.needsUpdate = sgeo.attributes.wet.needsUpdate = true;
  }
  const refresh = () => {
    if (last.pour === st.pour && last.wet === st.wet) return;
    last.pour = st.pour;
    last.wet = st.wet;
    rebuild();
  };
  refresh();
  return {
    group,
    setPour(k) {
      st.pour = sat(k);
      refresh();
    },
    setWet(k) {
      st.wet = sat(k);
      refresh();
    },
    top: h,
    pourAt: V3(PP[0], h, PP[1]),
  };
}

// ================================================================ blockwork walls
export function buildToyWalls({w = 12, d = 9, h = 3.2, k = 1, t = 0.3, course = 0.4, block = 0.8, openings = 'auto', seed = 1} = {}) {
  const M = mats();
  const n = Math.max(1, Math.round(h / course));
  const ch = h / n;
  const GAP = 0.035;
  // the 4 sides, walked counter-clockwise from above; a = position along the side from its centre, in walk order
  const sides = {
    '+z': {len: w, at: (a) => [a, d / 2 - t / 2], ry: 0},
    '+x': {len: d, at: (a) => [w / 2 - t / 2, -a], ry: PI / 2},
    '-z': {len: w, at: (a) => [-a, -d / 2 + t / 2], ry: 0},
    '-x': {len: d, at: (a) => [-w / 2 + t / 2, a], ry: PI / 2},
  };
  const WALK = ['+z', '+x', '-z', '-x'];
  if (openings === 'auto') {
    const top = Math.min(2.0, ch * Math.max(1, n - 3));
    openings = [
      {side: '+z', a: -w * 0.22, width: 1.2, y0: 0, y1: top},
      {side: '+z', a: w * 0.2, width: 2.0, y0: ch * 2, y1: top},
      {side: '-z', a: -w * 0.2, width: 1.6, y0: ch * 2, y1: top},
      {side: '-z', a: w * 0.22, width: 1.6, y0: ch * 2, y1: top},
      {side: '+x', a: 0, width: 1.6, y0: ch * 2, y1: top},
      {side: '-x', a: 0.8, width: 1.2, y0: ch * 2, y1: top},
    ];
  }
  const R = rng(seed + 3);
  const items = []; // {kind: 'full' | 'cut' | 'lintel', m: Matrix4, c: Color}
  for (let c = 0; c < n; c++) {
    const y0 = c * ch;
    for (const s of WALK) {
      const S = sides[s];
      const full = (s === '+z' || s === '-z') === (c % 2 === 0);
      const half = full ? S.len / 2 : S.len / 2 - t;
      // running bond: odd courses start half a block in
      const pieces = [];
      let a = -half;
      const first = (c % 2 ? block / 2 : 0) + (full ? 0 : block * 0.25);
      if (first > 0.01) {
        pieces.push([a, Math.min(half, a + first)]);
        a += first;
      }
      while (a < half - 1e-6) {
        pieces.push([a, Math.min(half, a + block)]);
        a += block;
      }
      // cut the openings and the lintel bearings out of this course
      let cuts = [];
      for (const o of openings.filter((o) => o.side === s)) {
        if (y0 >= o.y0 - 1e-6 && y0 + ch <= o.y1 + 1e-6) cuts.push([o.a - o.width / 2, o.a + o.width / 2]);
        if (Math.abs(y0 - o.y1) < 1e-6) {
          const la = o.a - o.width / 2 - 0.3;
          const lb = o.a + o.width / 2 + 0.3;
          cuts.push([la, lb]);
          const [px, pz] = S.at(o.a);
          items.push({kind: 'lintel', m: mat4(px, y0 + ch / 2, pz, 0, S.ry, 0, lb - la - GAP, 1, 1), c: null});
        }
      }
      for (let [p0, p1] of pieces) {
        let segs = [[p0, p1]];
        for (const [c0, c1] of cuts) {
          const next = [];
          for (const [q0, q1] of segs) {
            if (c1 <= q0 || c0 >= q1) next.push([q0, q1]);
            else {
              if (c0 > q0) next.push([q0, c0]);
              if (c1 < q1) next.push([c1, q1]);
            }
          }
          segs = next;
        }
        for (const [q0, q1] of segs) {
          const len = q1 - q0 - GAP;
          if (len < 0.1) continue;
          const [px, pz] = S.at((q0 + q1) / 2);
          const isFull = Math.abs(q1 - q0 - block) < 1e-4;
          const tone = 0.94 + R() * 0.08;
          const col = new THREE.Color(SITE.block).multiplyScalar(tone);
          items.push({kind: isFull ? 'full' : 'cut', m: mat4(px, y0 + ch / 2, pz, 0, S.ry, 0, isFull ? 1 : len, 1, 1), c: col});
        }
      }
    }
  }
  // each lintel goes in when its course starts; keep walk order otherwise
  // small parts in their hundreds: 2 bevel segments are plenty at this size
  const fullGeo = rbox(block - GAP, ch - GAP, t, 0.06, 1);
  const cutGeo = rbox(1, ch - GAP, t, 0.05, 1);
  const linGeo = rbox(1, ch - GAP * 0.5, t + 0.02, 0.06, 1);
  const cnt = (kd) => items.filter((it) => it.kind === kd).length;
  const ims = {full: instanced(fullGeo, M.block, cnt('full')), cut: instanced(cutGeo, M.block, cnt('cut')), lintel: instanced(linGeo, toyMat(SITE.lintel, {paint: true, rough: 0.5}), cnt('lintel'))};
  const slot = {full: 0, cut: 0, lintel: 0};
  for (const it of items) {
    it.j = slot[it.kind]++;
    if (it.c) ims[it.kind].setColorAt(it.j, it.c);
  }
  for (const im of Object.values(ims)) if (im.instanceColor) im.instanceColor.needsUpdate = true;
  const group = new THREE.Group();
  group.name = 'walls';
  group.add(ims.full, ims.cut, ims.lintel);
  const NT = items.length;
  let last = NaN;
  const tm = new THREE.Matrix4();
  function setBuilt(kk) {
    kk = sat(kk);
    if (kk === last) return;
    last = kk;
    const v = kk * NT;
    items.forEach((it, i) => {
      const u = sat(v - i);
      if (u <= 0) return ims[it.kind].setMatrixAt(it.j, ZERO);
      if (u >= 1) return ims[it.kind].setMatrixAt(it.j, it.m);
      const e = ease(u);
      tm.makeTranslation(0, 0.5 * (1 - e) * (1 - e), 0).multiply(it.m);
      ims[it.kind].setMatrixAt(it.j, tm);
    });
    for (const im of Object.values(ims)) im.instanceMatrix.needsUpdate = true;
  }
  setBuilt(k);
  return {group, setBuilt, courses: n, height: h};
}

// ================================================================ site cabin
export function buildToySiteCabin({label = 'SITE OFFICE', w = 6.0, d = 2.5, h = 2.9} = {}) {
  const M = mats();
  const group = new THREE.Group();
  group.name = `cabin-${label}`;
  tpl(`cabin|${label}|${w}|${d}|${h}`, (P) => {
    const y0 = 0.28;
    const H = h - y0;
    // pads, then the white box in a blue frame (corner posts, top and bottom rails)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(M.shade, 0.5, y0, 0.5, sx * (w / 2 - 0.3), y0 / 2, sz * (d / 2 - 0.3), 0.06);
    P.box(M.white, w - 0.16, H - 0.16, d - 0.16, 0, y0 + H / 2, 0, 0.16);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(M.blue, 0.26, H, 0.26, sx * (w / 2 - 0.13), y0 + H / 2, sz * (d / 2 - 0.13), 0.09);
    for (const yy of [y0 + 0.11, y0 + H - 0.11]) {
      for (const sz of [-1, 1]) P.box(M.blue, w - 0.3, 0.22, 0.2, 0, yy, sz * (d / 2 - 0.1), 0.07);
      for (const sx of [-1, 1]) P.box(M.blue, 0.2, 0.22, d - 0.3, sx * (w / 2 - 0.1), yy, 0, 0.07);
    }
    P.box(M.panel, w - 0.5, 0.08, d - 0.5, 0, y0 + H + 0.0, 0, 0.03);
    // front (+z): 2 windows, a door at the -x end, the label over the windows
    const fz = d / 2 - 0.06;
    for (const x of [w * 0.06, w * 0.3]) {
      P.box(M.white, 1.34, 1.0, 0.1, x, y0 + 1.28, fz, 0.06);
      P.box(M.glass, 1.16, 0.82, 0.1, x, y0 + 1.28, fz + 0.03, 0.05);
      P.box(M.white, 0.06, 0.82, 0.04, x, y0 + 1.28, fz + 0.08, 0.01);
    }
    const dxr = -w / 2 + 1.0;
    P.box(M.blue, 0.96, 2.0, 0.1, dxr, y0 + 1.06, fz + 0.01, 0.06);
    P.box(M.glass, 0.5, 0.42, 0.04, dxr, y0 + 1.6, fz + 0.07, 0.03);
    P.box(M.white, 0.08, 0.2, 0.06, dxr + 0.32, y0 + 1.02, fz + 0.08, 0.02);
    // steps to the door
    P.box(M.shade, 1.2, 0.14, 0.42, dxr, 0.07, d / 2 + 0.24, 0.04);
    P.box(M.shade, 1.2, 0.14, 0.3, dxr, 0.21, d / 2 + 0.16, 0.04);
    // an AC unit on the +x end, a dark fan
    P.box(M.white, 0.14, 0.62, 0.86, w / 2 + 0.07, y0 + 1.9, 0.2, 0.05);
    P.rcyl(M.navy, 0.25, 0.25, 0.04, w / 2 + 0.15, y0 + 1.9, 0.2, 'x', 0.01, 24);
    // the print: AURORA BUILD and the label
    P.printTex(brandTex(label), 0.5, w * 0.18, y0 + 2.08, fz + 0.065);
    P.printTex(brandTex(label), 0.62, 0, y0 + 1.65, -d / 2 + 0.035, PI);
  }, group);
  return group;
}

// ================================================================ site fence and gate
export function buildToySiteFence({length = 30, h = 2.2, panel = 3.0, print = true} = {}) {
  const M = mats();
  const n = Math.max(1, Math.round(length / panel));
  const pl = length / n;
  const group = new THREE.Group();
  group.name = 'site-fence';
  tpl(`hoard|${n}|${pl.toFixed(3)}|${h}|${print}`, (P) => {
    const tex = brandTex('New homes, phase 2');
    for (let i = 0; i < n; i++) {
      const x = -length / 2 + (i + 0.5) * pl;
      // a white panel, a blue band along its foot, a slim blue cap
      P.box(M.white, pl - 0.06, h - 0.58, 0.09, x, 0.5 + (h - 0.58) / 2, 0, 0.04);
      P.box(M.blue, pl - 0.06, 0.4, 0.11, x, 0.31, 0, 0.05);
      P.box(M.blueLight, pl - 0.06, 0.07, 0.11, x, h - 0.05, 0, 0.03);
      if (print && i % 2 === 0) {
        const a = tex.image.width / tex.image.height;
        const ph = Math.min(0.78, (pl - 0.4) / a);
        P.printTex(tex, ph, x, 0.5 + (h - 0.58) / 2 + 0.04, 0.05);
        P.printTex(tex, ph, x, 0.5 + (h - 0.58) / 2 + 0.04, -0.05, PI);
      }
    }
    for (let i = 0; i <= n; i++) {
      const x = -length / 2 + i * pl;
      P.box(M.blue, 0.11, h + 0.04, 0.16, x, (h + 0.04) / 2, 0, 0.04);
      // a low rounded foot block either side
      P.box(M.shade, 0.32, 0.16, 0.7, x, 0.08, 0, 0.06);
    }
  }, group);
  group.userData.width = length;
  return group;
}
export function buildToyGate({width = 8, h = 2.2} = {}) {
  const M = mats();
  const group = new THREE.Group();
  group.name = 'site-gate';
  tpl(`gateposts|${width}|${h}`, (P) => {
    for (const s of [-1, 1]) {
      P.box(M.blue, 0.34, h + 0.5, 0.34, s * (width / 2 + 0.17), (h + 0.5) / 2, 0, 0.1);
      P.box(M.blueLight, 0.42, 0.1, 0.42, s * (width / 2 + 0.17), h + 0.52, 0, 0.04);
      P.box(M.shade, 0.7, 0.16, 0.7, s * (width / 2 + 0.17), 0.08, 0, 0.06);
    }
  }, group);
  const lw = width / 2 - 0.08;
  const leafKit = (sign) =>
    tpl(`gateleaf|${width}|${h}|${sign}`, (P) => {
      // frame from the hinge (x = 0) toward x = sign * lw
      const x0 = 0;
      const x1 = sign * lw;
      const xa = Math.min(x0, x1);
      const xb = Math.max(x0, x1);
      P.ext(M.blue, xa, xb, 0.12, 0.24, -0.06, 0.06, 0.04);
      P.ext(M.blue, xa, xb, h - 0.12, h, -0.06, 0.06, 0.04);
      P.ext(M.blue, xa, xa + 0.12, 0.12, h, -0.06, 0.06, 0.04);
      P.ext(M.blue, xb - 0.12, xb, 0.12, h, -0.06, 0.06, 0.04);
      P.ext(M.blue, xa + 0.1, xb - 0.1, h * 0.55 - 0.04, h * 0.55 + 0.04, -0.05, 0.05, 0.02);
      for (let k = 1; k < 8; k++) {
        const x = lerp(xa, xb, k / 8);
        P.ext(M.blueLight, x - 0.025, x + 0.025, 0.24, h - 0.12, -0.025, 0.025, 0);
      }
      P.ext(M.pane, xa + 0.12, xb - 0.12, 0.24, h - 0.12, -0.012, 0.012, 0);
      // the sign plate on the leaf, facing out (+z) and in
      const tex = textTex(sign < 0 ? 'SITE ENTRANCE' : 'AURORA BUILD', {fg: '#ffffff', bg: TOY.blue, px: 80, pad: 30});
      const a = tex.image.width / tex.image.height;
      const sh = 0.42;
      const cx = (xa + xb) / 2;
      P.box(M.white, sh * a + 0.08, sh + 0.08, 0.06, cx, h * 0.55 + 0.35, 0.07, 0.03);
      P.print(decalMat(tex), sh * a, sh, cx, h * 0.55 + 0.35, 0.105);
      P.print(decalMat(tex), sh * a, sh, cx, h * 0.55 + 0.35, -0.035, PI);
    });
  const leaves = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * (width / 2 - 0.02), 0, 0);
    pivot.add(leafKit(-s));
    group.add(pivot);
    return {pivot, s};
  });
  const setOpen = (k) => {
    const a = ease(sat(k)) * (PI * 0.52);
    for (const {pivot, s} of leaves) pivot.rotation.y = -s * a;
  };
  setOpen(0);
  return {group, setOpen, width};
}

// ================================================================ batching plant (low: 8.5 m)
export function buildToyBatchingPlant() {
  const M = mats();
  const group = new THREE.Group();
  group.name = 'batching-plant';
  const HOUSE = {y0: 5.4, y1: 8.2, w: 4.8, d: 4.4};
  tpl('batching', (P) => {
    // the pad and the mixer lane under the house
    P.strip(M.pad, -16, -1.5, 14, -1.5, 30, 0.008);
    for (const z of [-2.1, 2.1]) P.strip(M.bay, -7, z, 9, z, 0.22, 0.02);
    for (const x of [-7, 9]) P.strip(M.bay, x, -2.1, x, 2.1, 0.22, 0.02);
    // the mixing house on 4 legs
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      P.box(M.blue, 0.4, HOUSE.y0, 0.4, sx * 2.1, HOUSE.y0 / 2, sz * 1.9, 0.12);
      P.box(M.shade, 0.8, 0.14, 0.8, sx * 2.1, 0.07, sz * 1.9, 0.05);
    }
    for (const sz of [-1, 1]) P.box(M.blue, 4.6, 0.32, 0.3, 0, HOUSE.y0 - 0.16, sz * 1.9, 0.1);
    for (const sx of [-1, 1]) P.box(M.blue, 0.3, 0.32, 4.1, sx * 2.1, HOUSE.y0 - 0.16, 0, 0.1);
    P.box(M.white, HOUSE.w, HOUSE.y1 - HOUSE.y0, HOUSE.d, 0, (HOUSE.y0 + HOUSE.y1) / 2, 0, 0.32);
    P.box(M.blue, HOUSE.w + 0.2, 0.3, HOUSE.d + 0.2, 0, HOUSE.y1 + 0.13, 0, 0.12);
    P.box(M.blue, HOUSE.w + 0.04, 0.26, HOUSE.d + 0.04, 0, HOUSE.y0 + 0.4, 0, 0.1);
    P.box(M.glass, 2.6, 0.7, 0.1, -0.6, HOUSE.y0 + 1.75, HOUSE.d / 2 + 0.01, 0.06);
    P.printTex(brandTex('Ready-mix'), 0.7, 0.2, HOUSE.y0 + 1.0, HOUSE.d / 2 + 0.02);
    P.printTex(brandTex('Ready-mix'), 0.62, -0.05, HOUSE.y0 + 1.35, -HOUSE.d / 2 - 0.02, PI);
    // the discharge cone and its nozzle over the lane
    P.rcyl(M.steel, 0.38, 1.0, 0.9, 0, HOUSE.y0 - 0.45, 0, 'y', 0.06);
    P.rcyl(M.ink, 0.3, 0.3, 0.32, 0, HOUSE.y0 - 1.05, 0, 'y', 0.05);
    // aggregate bins: 3 open hoppers on a blue frame, sand + 2 gravels heaped in the tops
    const BZ = -13.5;
    const fills = [M.sandFill, M.gravel, M.gravelDeep];
    for (let i = 0; i < 3; i++) {
      const x = -9.6 + i * 3.4;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.box(M.blue, 0.3, 2.6, 0.3, x + sx * 1.45, 1.3, BZ + sz * 1.6, 0.1);
      P.rcyl(M.steel, 0.4, 1.35, 0.9, x, 2.25, BZ, 'y', 0.06, 4);
      // walls of the bin (4 thick sides), a blue rim
      P.ext(M.white, x - 1.65, x + 1.65, 2.6, 4.7, BZ - 1.82, BZ - 1.58, 0.08);
      P.ext(M.white, x - 1.65, x + 1.65, 2.6, 4.7, BZ + 1.58, BZ + 1.82, 0.08);
      P.ext(M.white, x - 1.65, x - 1.41, 2.6, 4.7, BZ - 1.82, BZ + 1.82, 0.08);
      P.ext(M.white, x + 1.41, x + 1.65, 2.6, 4.7, BZ - 1.82, BZ + 1.82, 0.08);
      P.ext(M.blue, x - 1.7, x + 1.7, 4.62, 4.82, BZ - 1.87, BZ - 1.55, 0.06);
      P.ext(M.blue, x - 1.7, x + 1.7, 4.62, 4.82, BZ + 1.55, BZ + 1.87, 0.06);
      P.ext(M.blue, x - 1.7, x - 1.38, 4.62, 4.82, BZ - 1.87, BZ + 1.87, 0.06);
      P.ext(M.blue, x + 1.38, x + 1.7, 4.62, 4.82, BZ - 1.87, BZ + 1.87, 0.06);
      P.box(fills[i], 2.9, 0.5, 3.2, x, 4.3, BZ, 0.12);
      P.add(fills[i], cg('binheap', () => new THREE.SphereGeometry(1, 28, 12, 0, PI * 2, 0, PI / 2)), x, 4.5, BZ, 0, 0, 0, 1.3, 0.75, 1.45);
    }
    // the collecting belt under the bins, the inclined gallery up to the house
    P.ext(M.blue, -11.8, -1.6, 0.6, 1.0, BZ - 0.55, BZ + 0.55, 0.1);
    P.ext(M.belt, -11.7, -1.7, 1.0, 1.08, BZ - 0.4, BZ + 0.4, 0.03);
    for (const x of [-11, -7.6, -4.2]) P.box(M.blue, 0.24, 0.6, 0.9, x, 0.3, BZ, 0.06);
    const g0 = V3(-1.0, 1.4, BZ + 0.2);
    const g1 = V3(-1.0, HOUSE.y0 + 1.8, -HOUSE.d / 2 + 0.2);
    const gl = g1.clone().sub(g0);
    const gang = -Math.atan2(gl.y, gl.z);
    const gm = g0.clone().lerp(g1, 0.5);
    P.add(M.white, rb(1.3, 1.1, gl.length(), 0.32), gm.x, gm.y, gm.z, gang, 0, 0);
    P.add(M.blue, rb(1.4, 0.22, gl.length() + 0.1, 0.08), gm.x, gm.y - 0.62, gm.z + 0.0, gang, 0, 0);
    for (const f of [0.3, 0.66]) {
      const p = g0.clone().lerp(g1, f);
      for (const s of [-1, 1]) P.bar(M.blue, [p.x + s * 0.55, 0.05, p.z], [p.x + s * 0.55, p.y - 0.6, p.z], 0.2);
      P.box(M.blue, 1.4, 0.2, 0.2, p.x, p.y - 0.65, p.z, 0.06);
    }
    // 2 horizontal cement silos on saddles, screw conveyors up to the house
    for (const [i, z] of [7.0, 10.6].entries()) {
      const r = 1.45;
      P.add(M.white, rcyl(r, r, 10.5, 0.7, 40), -5.2, 2.75, z, 0, 0, -PI / 2);
      for (const x of [-9.0, -5.2, -1.4]) P.box(M.blueLight, 0.14, 0.12, 2 * r + 0.12, x, 2.75, z, 0.04);
      P.add(M.blue, rcyl(r + 0.03, r + 0.03, 0.4, 0.08, 40), -5.2 + 3.0, 2.75, z, 0, 0, -PI / 2);
      for (const x of [-8.6, -1.8]) {
        P.box(M.blue, 0.5, 1.5, 2.4, x, 0.75, z, 0.12);
        P.box(M.shade, 0.9, 0.12, 2.8, x, 0.06, z, 0.04);
      }
      P.printTex(textTex(`CEMENT ${i + 1}`, {fg: TOY.blue, px: 90}), 0.55, -6.6, 2.75 + 0.18, z + r + 0.02);
      P.rod(M.steel, [-0.6 - i * 0.9, 3.0, z - 1.2], [-HOUSE.w / 2 + 0.3, HOUSE.y0 + 1.4 + i * 0.5, 1.2 - i * 0.9], 0.17, 14);
      P.rcyl(M.blue, 0.26, 0.26, 0.34, -0.6 - i * 0.9, 3.0, z - 1.2, 'y', 0.06, 16);
    }
    // a water tank and the control cabin by the lane
    P.rcyl(M.blue, 1.15, 1.15, 2.6, 7.5, 1.3, -8.5, 'y', 0.25, 36);
    P.rcyl(M.blueLight, 1.2, 1.2, 0.16, 7.5, 2.62, -8.5, 'y', 0.06, 36);
    P.box(M.white, 3.2, 2.5, 2.6, 8.2, 1.25, 6.2, 0.22);
    P.box(M.blue, 3.36, 0.22, 2.76, 8.2, 2.52, 6.2, 0.08);
    P.box(M.glass, 2.2, 0.8, 0.08, 8.0, 1.6, 7.52, 0.05);
    P.box(M.blue, 0.8, 1.9, 0.08, 9.3, 0.98, 4.88, 0.05);
  }, group);
  return {group, bay: {x: 3.5, z: 0, rotY: 0, chute: V3(0, HOUSE.y0 - 1.2, 0)}, height: HOUSE.y1 + 0.3};
}

// ================================================================ material stacks
export function buildToyMaterialStack({kind = 'blocks', seed = 1} = {}) {
  const M = mats();
  const group = new THREE.Group();
  group.name = `stack-${kind}`;
  const R = rng(seed);
  const pallet = (P, x, y, z, w = 2.3, d = 2.0) => {
    for (const zz of [-d / 2 + 0.15, 0, d / 2 - 0.15]) P.ext(M.pallet, x - w / 2, x + w / 2, y + 0.06, y + 0.24, z + zz - 0.15, z + zz + 0.15, 0.04);
    for (let k = 0; k < 5; k++) {
      const xx = x - w / 2 + 0.2 + k * ((w - 0.4) / 4);
      P.ext(M.pallet, xx - 0.19, xx + 0.19, y + 0.24, y + 0.32, z - d / 2, z + d / 2, 0.03);
    }
    for (const xx of [-w / 2 + 0.2, 0, w / 2 - 0.2]) P.ext(M.pallet, x + xx - 0.18, x + xx + 0.18, y, y + 0.06, z - d / 2, z + d / 2, 0.025);
  };
  tpl(`stack|${kind}|${seed}`, (P) => {
    if (kind === 'blocks') {
      for (const x of [-1.25, 1.25]) {
        pallet(P, x, 0, 0);
        const layers = 3 + (R() < 0.5 ? 1 : 0);
        for (let c = 0; c < layers; c++)
          for (let a = 0; a < 3; a++)
            for (let b = 0; b < 2; b++) P.box(M.concrete, 0.7, 0.38, 0.92, x - 0.74 + a * 0.74, 0.32 + 0.19 + c * 0.4, -0.48 + b * 0.96, 0.05);
        const hh = 0.32 + layers * 0.4;
        for (const xx of [-0.5, 0.5]) P.ext(M.blue, x + xx - 0.05, x + xx + 0.05, 0.3, hh + 0.02, -1.0, 1.0, 0.02);
      }
    } else if (kind === 'rebar') {
      const L = 9;
      for (const x of [-3.2, 0, 3.2]) P.box(M.wood, 0.3, 0.24, 3.0, x, 0.12, 0, 0.05);
      const bundle = (z, y) => {
        for (let k = 0; k < 7; k++) {
          const a = (k / 6) * PI * 2;
          const rr = k === 6 ? 0 : 0.14;
          P.add(M.rebar, cylG(0.065, 0.065, L, 8), 0, y + 0.2 + rr * Math.sin(a), z + rr * Math.cos(a), 0, 0, PI / 2);
        }
        for (const x of [-3.0, 3.0]) P.add(M.blue, rcyl(0.24, 0.24, 0.08, 0.02, 20), x, y + 0.2, z, 0, 0, PI / 2);
      };
      for (const z of [-0.8, 0, 0.8]) bundle(z, 0.24);
      for (const x of [-2.4, 2.4]) P.box(M.wood, 0.26, 0.2, 2.2, x, 0.74, 0, 0.05);
      for (const z of [-0.4, 0.4]) bundle(z, 0.84);
    } else if (kind === 'pipes') {
      const L = 6;
      const r = 0.42;
      for (const x of [-2.2, 2.2]) P.box(M.wood, 0.3, 0.2, 3.0, x, 0.1, 0, 0.05);
      const rows = [3, 2, 1];
      rows.forEach((cnt, row) => {
        for (let i = 0; i < cnt; i++) {
          const z = (i - (cnt - 1) / 2) * (2 * r + 0.02);
          const y = 0.2 + r + row * r * 1.74;
          P.add(row === 1 ? M.blueLight : M.blue, rpipe(r, r - 0.08, L, 0.035), 0, y, z, 0, 0, PI / 2);
        }
      });
    } else {
      const n = 5 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) pallet(P, (R() - 0.5) * 0.12, k * 0.33, (R() - 0.5) * 0.1);
    }
  }, group);
  return group;
}

// ================================================================ small kit: porta-loo, cones, plot marks
export function buildToyPortaLoo() {
  const M = mats();
  const group = new THREE.Group();
  group.name = 'porta-loo';
  tpl('loo', (P) => {
    P.box(M.navy, 1.3, 0.12, 1.3, 0, 0.06, 0, 0.04);
    P.box(M.blue, 1.2, 2.1, 1.2, 0, 0.12 + 1.05, 0, 0.16);
    P.box(M.white, 1.32, 0.22, 1.32, 0, 2.3, 0, 0.1);
    P.add(M.white, cg('loodome', () => new THREE.SphereGeometry(0.62, 28, 10, 0, PI * 2, 0, PI / 2)), 0, 2.38, 0, 0, 0, 0, 1, 0.32, 1);
    // the door: an inset panel, a white plate, the occupancy slot
    P.box(M.blueDeep, 0.86, 1.86, 0.08, 0, 1.12, 0.6, 0.05);
    P.box(M.white, 0.36, 0.24, 0.04, 0, 1.7, 0.65, 0.03);
    P.box(M.green, 0.14, 0.06, 0.04, 0.26, 1.2, 0.65, 0.015);
    P.box(M.white, 0.06, 0.24, 0.06, -0.3, 1.1, 0.66, 0.02);
    P.cyl(M.blueLight, 0.07, 0.07, 0.5, 0.36, 2.55, -0.32, 'y', 12);
    P.printTex(textTex('WC', {fg: TOY.blue, px: 90}), 0.17, 0, 1.7, 0.672);
  }, group);
  return group;
}
export function buildToyConeRow({n = 5, spacing = 1.6} = {}) {
  const M = mats();
  const group = new THREE.Group();
  group.name = 'cones';
  const body = cg('cone', () =>
    new THREE.LatheGeometry([V2(0.21, 0.08), V2(0.2, 0.12), V2(0.07, 0.78), V2(0.055, 0.82), V2(0.001, 0.83)], 24));
  const band = (y0, y1) =>
    cg(`coneband|${y0}`, () => {
      const r = (y) => lerp(0.2, 0.07, (y - 0.12) / 0.66) + 0.008;
      return new THREE.LatheGeometry([V2(r(y0), y0), V2(r(y1), y1)], 24);
    });
  const base = rb(0.5, 0.08, 0.5, 0.04);
  const mk = (geo, mat) => {
    const im = instanced(geo, mat, n);
    for (let i = 0; i < n; i++) im.setMatrixAt(i, mat4((i - (n - 1) / 2) * spacing, 0, 0, 0, i * 0.3, 0));
    group.add(im);
  };
  mk(cg('conebase', () => base.clone().translate(0, 0.04, 0)), M.navy);
  mk(body, M.orange);
  mk(band(0.34, 0.44), M.white);
  mk(band(0.56, 0.63), M.white);
  return group;
}
export function buildToyPlotMarks({w = 14, d = 10} = {}) {
  const M = mats();
  const group = new THREE.Group();
  group.name = 'plot-marks';
  tpl(`plotmarks|${w}|${d}`, (P) => {
    const peg = (x, z, hh = 0.7) => {
      P.box(M.wood, 0.11, hh, 0.11, x, hh / 2, z, 0.03);
      P.box(M.orange, 0.12, 0.12, 0.12, x, hh - 0.04, z, 0.03);
    };
    const A = w / 2;
    const B = d / 2;
    const off = 1.6;
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        peg(sx * A, sz * B, 0.55);
        // profile boards outside each corner
        const bx = sx * (A + off);
        peg(bx, sz * B - 0.6);
        peg(bx, sz * B + 0.6);
        P.ext(M.white, bx - 0.035, bx + 0.035, 0.42, 0.6, sz * B - 0.8, sz * B + 0.8, 0.025);
        const bz = sz * (B + off);
        peg(sx * A - 0.6, bz);
        peg(sx * A + 0.6, bz);
        P.ext(M.white, sx * A - 0.8, sx * A + 0.8, 0.42, 0.6, bz - 0.035, bz + 0.035, 0.025);
        // a sprayed L at the corner
        P.strip(M.spray, sx * A, sz * B, sx * (A - 1.2), sz * B, 0.18, 0.02);
        P.strip(M.spray, sx * A, sz * B, sx * A, sz * (B - 1.2), 0.18, 0.02);
      }
    for (const sz of [-1, 1]) P.ext(M.string, -A - off, A + off, 0.56, 0.585, sz * B - 0.013, sz * B + 0.013, 0);
    for (const sx of [-1, 1]) P.ext(M.string, sx * A - 0.013, sx * A + 0.013, 0.56, 0.585, -B - off, B + off, 0);
    // a few pegs along the long sides
    for (const sz of [-1, 1]) for (let x = -A + 3.5; x < A - 1; x += 3.5) peg(x, sz * B, 0.5);
  }, group);
  return group;
}

// ================================================================ finished neighbour houses
export function buildToyHouseShell({floors = 1, w = 12, d = 9, seed = 1} = {}) {
  const M = mats();
  floors = floors >= 2 ? 2 : 1;
  const group = new THREE.Group();
  group.name = `house-${floors}`;
  const FH = 3.0;
  const plinth = 0.35;
  const H = plinth + floors * FH;
  tpl(`house|${floors}|${w}|${d}|${seed}`, (P) => {
    const R = rng(seed + 11);
    // a lawn plate and a path to the door
    P.strip(M.lawn, -w / 2 - 1.6, 0, w / 2 + 1.6, 0, d + 3.2, 0.006);
    P.strip(M.path, -w * 0.22, d / 2, -w * 0.22, d / 2 + 1.6, 1.3, 0.012);
    P.box(M.shade, w + 0.3, plinth, d + 0.3, 0, plinth / 2, 0, 0.1);
    P.box(M.white, w, H - plinth, d, 0, plinth + (H - plinth) / 2, 0, 0.3);
    if (floors === 2) {
      // a flat roof with a light-blue parapet cap and a band between the floors
      P.box(M.panel, w - 0.7, 0.2, d - 0.7, 0, H + 0.0, 0, 0.06);
      for (const sz of [-1, 1]) P.box(M.blueLight, w + 0.08, 0.36, 0.34, 0, H + 0.16, sz * (d / 2 - 0.13), 0.1);
      for (const sx of [-1, 1]) P.box(M.blueLight, 0.34, 0.36, d - 0.4, sx * (w / 2 - 0.13), H + 0.16, 0, 0.1);
      // 2 solar panels and a small plant box on the roof
      for (const x of [-w * 0.2, w * 0.08]) P.add(M.glass, rb(2.4, 0.08, 1.5, 0.03), x, H + 0.55, -d * 0.12, -0.35, 0, 0);
      P.box(M.white, 1.2, 0.7, 1.0, w * 0.32, H + 0.42, d * 0.15, 0.12);
    } else {
      // a blue pitched roof with an overhang, ridge along x
      const rw = d / 2 + 0.5;
      const rh = 2.0;
      const ang = Math.atan2(rh, rw);
      const sl = Math.hypot(rw, rh);
      // the gable walls: a white prism a step inside the roof
      const gable = cg(`gable|${w}|${d}`, () => {
        const s2 = new THREE.Shape();
        s2.moveTo(-d / 2, 0);
        s2.lineTo(d / 2, 0);
        s2.lineTo(0, (d / 2) * Math.tan(ang));
        s2.closePath();
        const g = new THREE.ExtrudeGeometry(s2, {depth: w - 0.3, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2});
        g.translate(0, 0, -(w - 0.3) / 2);
        g.rotateY(PI / 2);
        return g;
      });
      P.add(M.white, gable, 0, H - 0.1, 0);
      for (const s3 of [-1, 1]) P.add(M.roof, rb(w + 0.6, 0.3, sl + 0.1, 0.12), 0, H - 0.05 + rh / 2 + 0.06, (s3 * rw) / 2, s3 * ang, 0, 0);
      P.box(M.blueDeep, w + 0.64, 0.22, 0.36, 0, H - 0.05 + rh + 0.02, 0, 0.1);
      P.box(M.white, 0.8, 1.4, 0.8, w * 0.3, H + 1.4, -d * 0.12, 0.12);
    }
    // windows: periwinkle panes with white sills, every 2.6 m on every face, the door on +z
    const doorX = -w * 0.22;
    const faces = [
      [w, (u) => [u, d / 2 + 0.02], 0],
      [w, (u) => [-u, -d / 2 - 0.02], PI],
      [d, (u) => [w / 2 + 0.02, -u], PI / 2],
      [d, (u) => [-w / 2 - 0.02, u], -PI / 2],
    ];
    faces.forEach(([len, at, ry], fi) => {
      const nb = Math.max(1, Math.floor((len - 1.2) / 2.6));
      for (let f = 0; f < floors; f++)
        for (let b = 0; b < nb; b++) {
          const u = -len / 2 + 0.6 + (len - 1.2) * ((b + 0.5) / nb);
          if (fi === 0 && f === 0 && Math.abs(u - doorX) < 1.3) continue;
          const tall = f === 0 && fi === 0 && R() < 0.5;
          const wh = tall ? 2.0 : 1.35;
          const y = plinth + f * FH + (tall ? 1.15 : 1.55);
          const [x, z] = at(u);
          P.add(M.window, rb(1.4, wh, 0.12, 0.07), x, y, z, 0, ry, 0);
          const [sx, sz] = at(u);
          const o = V3(0, 0, 0.08).applyAxisAngle(V3(0, 1, 0), ry);
          P.add(M.white, rb(1.6, 0.1, 0.22, 0.04), sx + o.x, y - wh / 2 - 0.05, sz + o.z, 0, ry, 0);
        }
    });
    // the front door with a small canopy and a step
    P.box(M.blue, 1.15, 2.2, 0.12, doorX, plinth + 1.1, d / 2 + 0.03, 0.06);
    P.box(M.white, 0.06, 0.22, 0.06, doorX + 0.38, plinth + 1.05, d / 2 + 0.11, 0.02);
    P.box(M.white, 1.9, 0.14, 1.0, doorX, plinth + 2.5, d / 2 + 0.45, 0.06);
    P.box(M.shade, 1.6, 0.2, 0.8, doorX, 0.1, d / 2 + 0.5, 0.05);
    // a low hedge along the front
    P.add(M.greenDeep, rb(w * 0.35, 0.7, 0.8, 0.3), w * 0.22, 0.35, d / 2 + 1.3);
  }, group);
  return group;
}
