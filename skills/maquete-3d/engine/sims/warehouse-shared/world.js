// The toy logistics network's world, built the way the reference is built: closed warehouses with dock
// doors, trucks backing into the docks, forklifts moving pallets between the trucks and staging rows, chargers, pins on
// the pallets, roads between the sites. Every model comes from the airport and plant kits. Three sites:
//   WH-01 Harbor Hub (2 docks) at the origin; WH-04 Millbrook Cross-Dock (8 docks) east; WH-03 Northgate Cold Store
//   (3 docks, a white roof with rooftop units) north. Roads: south z = 40, north z = -82, a connector at x = 96.
// The work is a pure function of the film clock T:
//   0-7.6    FL-01 loads TRK-2051 at Harbor Hub bay 1 (2/4 -> 4/4)
//   7.6-15.2 TRK-2051 drives to Millbrook; 15.4-18.6 it reverses into In 3; 19-25 FL-10 unloads it onto the staging rows
//   23-27.4  TRK-2148 runs the north road; 27.6-31.2 it reverses into the cold store's dock 2
import * as THREE from 'three';
import {TOY, toyMat, rbox, mesh} from '../airport-shared/style.js';
import {buildToyCargoTerminal, buildToyCityBlock, buildToyFence, buildToyTrees} from '../airport-shared/airside.js';
import {buildToyBoxTruck, buildToyForklift} from '../airport-shared/gse.js';
import {buildToyPallet} from '../plant-shared/plant.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sm = (x) => {
  const u = clamp(x);
  return u * u * (3 - 2 * u);
};
const ss = (a, b, t) => sm((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const yawOf = (t) => Math.atan2(-t.z, t.x);

export const DUR = 39.4;
export const T = {
  load: [-4.6, 7.4], // FL-01's cycles at the hub
  leave: [7.6, 15.2],
  reverse: [15.4, 18.6],
  unload: [19.0, 25.4],
  cold: [23.0, 27.4],
  coldRev: [27.6, 31.2],
};
const PER = 4.6;
const SOUTH = 40;
const NORTH = -82;
const HUB = {x: 0, z: 0};
const XD = {x: 150, z: 0};
const COLD = {x: 60, z: -118};
const DOCK_OFF = 6.3; // a truck's origin in front of the dock face when its rear is at the door

function makePath(pts) {
  const c = new THREE.CatmullRomCurve3(pts.map(([x, z]) => V(x, 0, z)), false, 'centripetal');
  const L = c.getLength();
  const at = (s) => {
    if (s <= 0) return {p: c.getPointAt(0).addScaledVector(c.getTangentAt(0), s), t: c.getTangentAt(0)};
    if (s >= L) return {p: c.getPointAt(1).addScaledVector(c.getTangentAt(1), s - L), t: c.getTangentAt(1)};
    return {p: c.getPointAt(s / L), t: c.getTangentAt(s / L)};
  };
  return {L, at, points: (s0, s1, n = 48) => Array.from({length: n + 1}, (_, i) => at(lerp(s0, s1, i / n)).p)};
}

/** a forklift charger: a blue post with a screen, a cable, a painted pad */
function buildCharger(label) {
  const g = new THREE.Group();
  const blue = toyMat(TOY.blue, {paint: true});
  g.add(mesh(rbox(0.8, 2.0, 0.6, 0.12), blue, 0, 1.0, 0));
  g.add(mesh(rbox(0.56, 0.5, 0.06, 0.05), toyMat('#1a2440', {rough: 0.3}), 0, 1.45, 0.31));
  g.add(mesh(rbox(0.36, 0.1, 0.04, 0.02), toyMat('#22b35f', {emissive: '#22b35f'}), 0, 1.0, 0.31));
  g.add(mesh(rbox(2.6, 0.04, 3.6, 0.02), toyMat(TOY.bay, {rough: 0.8}), 0, 0.02, 2.2));
  g.add(mesh(rbox(2.3, 0.05, 3.3, 0.02), toyMat(TOY.road, {rough: 0.95}), 0, 0.03, 2.2));
  const cable = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 8, 24, Math.PI * 1.3), toyMat('#1d2231', {rough: 0.6}));
  cable.position.set(0.48, 0.9, 0.1);
  cable.rotation.set(0, Math.PI / 2, Math.PI * 0.85);
  g.add(cable);
  g.userData.label = label;
  return g;
}

/** rooftop cooling units for the cold store */
function buildRoofUnit() {
  const g = new THREE.Group();
  g.add(mesh(rbox(3.2, 1.2, 2.2, 0.16), toyMat(TOY.white, {paint: true}), 0, 0.6, 0));
  for (const dx of [-0.8, 0.8]) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.06, 24), toyMat('#26324f', {rough: 0.5}));
    f.position.set(dx, 1.22, 0);
    g.add(f);
  }
  return g;
}

export function buildWorld() {
  const root = new THREE.Group();
  const add = (o, x = 0, z = 0, ry = 0, y = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    root.add(o);
    return o;
  };
  const flat = (w, d, color, x, z, y = 0.01) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), toyMat(color, {rough: 0.95}));
    m.position.set(x, y, z);
    m.receiveShadow = true;
    root.add(m);
    return m;
  };

  // ---------------------------------------------------------------- ground, roads, yards
  flat(3200, 3200, TOY.ground, 0, 0, 0);
  const road = '#ccd6f4';
  flat(560, 12, road, 90, SOUTH, 0.02);
  flat(560, 12, road, 90, NORTH, 0.02);
  flat(12, NORTH - SOUTH + 12, road, 96, (SOUTH + NORTH) / 2, 0.021);
  for (let x = -185; x < 370; x += 9) {
    flat(4, 0.45, TOY.lane, x, SOUTH, 0.03);
    flat(4, 0.45, TOY.lane, x, NORTH, 0.03);
  }
  flat(76, 36, TOY.road, HUB.x - 6, HUB.z + 17, 0.015);
  flat(124, 36, TOY.road, XD.x + 10, XD.z + 17, 0.015);
  flat(66, 28, TOY.road, COLD.x, COLD.z + 14, 0.015);
  // painted bays in front of the docks
  const bays = (site, xs) => {
    for (const x of xs) {
      flat(0.3, 14, TOY.bay, site.x + x - 4.4, site.z + 7.5, 0.04);
      flat(0.3, 14, TOY.bay, site.x + x + 4.4, site.z + 7.5, 0.04);
    }
  };

  // ---------------------------------------------------------------- the three warehouses
  const hub = buildToyCargoTerminal({docks: 2, stock: true, name: 'WH-01', sign: ['STOCKLINE', 'Harbor Hub  ·  WH-01']});
  add(hub.group, HUB.x, HUB.z);
  const xd = buildToyCargoTerminal({docks: 8, stock: true, name: 'WH-04', sign: ['STOCKLINE', 'Millbrook Cross-Dock  ·  WH-04']});
  add(xd.group, XD.x, XD.z);
  const cold = buildToyCargoTerminal({docks: 3, stock: true, name: 'WH-03', sign: ['STOCKLINE', 'Northgate Cold Store  ·  WH-03']});
  add(cold.group, COLD.x, COLD.z);
  // the cold store's roof goes white
  const roofHex = new THREE.Color(TOY.roof).getHexString();
  const white = toyMat('#eef1f8', {rough: 0.6});
  cold.group.traverse((o) => {
    if (o.isMesh && !Array.isArray(o.material) && o.material.color && o.material.color.getHexString() === roofHex) o.material = white;
  });
  {
    const L = 3 * 10 + 12;
    const nMod = Math.max(2, Math.round(L / 24));
    const Wm = L / nMod;
    const top = (x) => {
      const k = clamp(Math.floor((x + L / 2) / Wm), 0, nMod - 1);
      return 14.6 - (3.6 * (x + L / 2 - k * Wm)) / Wm;
    };
    for (const [x, z] of [[-14, -9], [-14, -21], [-3, -9], [-3, -21], [8, -9], [8, -21], [15, -15]]) add(buildRoofUnit(), COLD.x + x, COLD.z + z, 0, top(x) + 0.15);
  }
  const dockW = (site, term, i) => site.x + term.docks[i].x;
  bays(HUB, hub.docks.map((d) => d.x));
  bays(XD, xd.docks.map((d) => d.x));
  bays(COLD, cold.docks.map((d) => d.x));

  // ---------------------------------------------------------------- trucks
  const truckAt = (livery, x, z) => {
    const tr = buildToyBoxTruck({livery});
    add(tr.group, x, z + DOCK_OFF, -Math.PI / 2);
    return tr;
  };
  const hero = buildToyBoxTruck({livery: 'aurora'});
  root.add(hero.group);
  const d1 = dockW(HUB, hub, 0);
  const d3 = dockW(XD, xd, 2);
  // eastbound on the road's south lane (z = SOUTH + 3); the through traffic runs west on the north lane
  const fwd = makePath([[d1, HUB.z + DOCK_OFF], [d1, 24], [d1 + 12, SOUTH + 1.5], [d1 + 34, SOUTH + 3], [d3 + 18, SOUTH + 3]]);
  const rev = makePath([[d3 + 18, SOUTH + 3], [d3 + 9, SOUTH + 1], [d3 + 1.5, 30], [d3, 18], [d3, XD.z + DOCK_OFF]]);
  // the cross-dock's other trucks at D5-D8; D1-D2 stay free for the staging rows
  const xdTrucks = [[4, 'kestrel'], [5, 'plain'], [6, 'kestrel'], [7, 'aurora']].map(([i, l]) => truckAt(l, dockW(XD, xd, i), XD.z));
  const coldTr = truckAt('kestrel', dockW(COLD, cold, 0), COLD.z);
  const hero2 = buildToyBoxTruck({livery: 'plain'});
  root.add(hero2.group);
  const c2 = dockW(COLD, cold, 1);
  const coldFwd = makePath([[-60, NORTH - 2], [0, NORTH - 2], [c2 + 18, NORTH - 2]]);
  const coldRev = makePath([[c2 + 18, NORTH - 2], [c2 + 9, NORTH - 3.5], [c2 + 1.5, -92], [c2, -100], [c2, COLD.z + DOCK_OFF]]);
  for (let i = 0; i < 8; i++) xd.setDoor(i, [4, 5, 6, 7].includes(i) ? 1 : 0);
  for (let i = 0; i < 2; i++) hub.setDoor(i, i === 0 ? 1 : 0);
  for (let i = 0; i < 3; i++) cold.setDoor(i, i < 2 ? 1 : 0);
  // through traffic on the south road, westbound on the far lane
  const traffic = [0, 1].map((i) => {
    const tr = buildToyBoxTruck({livery: i ? 'kestrel' : 'plain'});
    root.add(tr.group);
    return tr;
  });

  // ---------------------------------------------------------------- staging pallets, forklifts, chargers
  const staging = (cx, cz, cols, rows, loads, seed) => {
    const list = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const p = buildToyPallet({load: loads[(r + c + seed) % loads.length], seed: seed + r * cols + c});
        add(p, cx + c * 3.0, cz + r * 2.7);
        list.push(p);
      }
    return list;
  };
  // the hub's staging rows west of bay 1, picked from the east end
  const hubStage = staging(-27, 8, 3, 4, ['boxes', 'boxes', 'totes', 'wrap'], 2);
  const fl1 = buildToyForklift();
  root.add(fl1.group);
  const fl1Pal = buildToyPallet({load: 'boxes', seed: 41});
  root.add(fl1Pal);
  // the cross-dock's staging rows between In 1 and In 3, fed by FL-10
  const xdStage = staging(d3 - 16, 13, 2, 3, ['totes', 'boxes', 'wrap'], 7);
  const fl10 = buildToyForklift();
  root.add(fl10.group);
  const fl10Pal = buildToyPallet({load: 'totes', seed: 52});
  root.add(fl10Pal);
  // chargers at the cross-dock's east end, two forklifts on charge, C1 free
  const chX = XD.x + 52;
  const chargers = ['C1', 'C2', 'C3'].map((lab, i) => add(buildCharger(lab), chX, XD.z + 6 + i * 4.2, -Math.PI / 2));
  for (const i of [1, 2]) {
    const f = buildToyForklift();
    add(f.group, chX - 4.6, XD.z + 6 + i * 4.2, 0);
    f.setForks(0.1);
  }
  // pallets around the cold store's docks
  staging(COLD.x - 30, COLD.z + 8, 2, 2, ['wrap', 'totes'], 11);
  staging(COLD.x + 24, COLD.z + 8, 2, 2, ['totes', 'wrap'], 13);

  // ---------------------------------------------------------------- landscape
  for (let x = -140; x < 340; x += 30) add(buildToyFence({length: 30}), x + 15, SOUTH + 9);
  const trees = [];
  for (let x = -140; x < 340; x += 15) trees.push({x: x + 3 * Math.sin(x), z: SOUTH + 13, size: 0.95 + 0.15 * Math.sin(x)});
  for (let x = -140; x < 340; x += 18) trees.push({x: x + 4, z: NORTH - 9, size: 1.0});
  for (const [x, z] of [[-46, 10], [-50, -14], [30, -20], [86, -30], [216, -26], [222, 14], [106, -100], [14, -110]]) trees.push({x, z, size: 1.2});
  root.add(buildToyTrees(trees));
  let seed = 7;
  for (let x = -130; x < 340; x += 40) {
    add(buildToyCityBlock({w: 26, d: 20, floors: 3 + (seed % 3), seed}), x, SOUTH + 32);
    seed += 5;
  }
  for (const [x, z] of [[-30, -150], [150, -130], [190, -150], [230, -120]]) add(buildToyCityBlock({w: 30, d: 22, floors: 4 + (seed++ % 3), seed}), x, z);

  // ---------------------------------------------------------------- the clock
  // a forklift shuttle: pick facing `pickDir` at P0, turn, drop facing the other way at P1; returns the pallet state
  const shuttle = (fl, pal, t0, P0f, P1f, pickYaw, dropYaw, t) => {
    const c = (t - t0) / PER;
    const k = Math.floor(c);
    const u = c - k;
    const P0 = P0f(k);
    const P1 = P1f(k);
    const back = (p, yaw, d) => [p[0] - Math.cos(yaw) * d, p[1] + Math.sin(yaw) * d];
    const B0 = back(P0, pickYaw, 3);
    const B1 = back(P1, dropYaw, 3);
    let pos;
    let yaw;
    let forks = 0.15;
    let carrying = false;
    if (u < 0.12) [pos, yaw] = [[lerp(B0[0], P0[0], sm(u / 0.12)), lerp(B0[1], P0[1], sm(u / 0.12))], pickYaw];
    else if (u < 0.2) [pos, yaw, forks, carrying] = [P0, pickYaw, lerp(0.15, 0.7, sm((u - 0.12) / 0.08)), true];
    else if (u < 0.3) [pos, yaw, forks, carrying] = [[lerp(P0[0], B0[0], sm((u - 0.2) / 0.1)), lerp(P0[1], B0[1], sm((u - 0.2) / 0.1))], pickYaw, 0.7, true];
    else if (u < 0.42) [pos, yaw, forks, carrying] = [B0, lerp(pickYaw, dropYaw, sm((u - 0.3) / 0.12)), 0.7, true];
    else if (u < 0.6) [pos, yaw, forks, carrying] = [[lerp(B0[0], P1[0], sm((u - 0.42) / 0.18)), lerp(B0[1], P1[1], sm((u - 0.42) / 0.18))], dropYaw, 0.7, true];
    else if (u < 0.68) [pos, yaw, forks, carrying] = [P1, dropYaw, lerp(0.7, 0.15, sm((u - 0.6) / 0.08)), true];
    else if (u < 0.78) [pos, yaw] = [[lerp(P1[0], B1[0], sm((u - 0.68) / 0.1)), lerp(P1[1], B1[1], sm((u - 0.68) / 0.1))], dropYaw];
    else if (u < 0.9) [pos, yaw] = [B1, lerp(dropYaw, pickYaw, sm((u - 0.78) / 0.12))];
    else [pos, yaw] = [[lerp(B1[0], B0[0], sm((u - 0.9) / 0.1)), lerp(B1[1], B0[1], sm((u - 0.9) / 0.1))], pickYaw];
    fl.group.position.set(pos[0], 0, pos[1]);
    fl.group.rotation.y = yaw;
    fl.roll(c * 18);
    fl.setForks(forks);
    pal.visible = carrying;
    if (carrying) {
      pal.position.set(pos[0] + Math.cos(yaw) * 2.6, forks + 0.08, pos[1] - Math.sin(yaw) * 2.6);
      pal.rotation.y = yaw;
    }
    return {k, u, carrying, delivered: k + (u >= 0.68 ? 1 : 0)};
  };

  const pose = (t) => {
    // ---- the hub: FL-01 loads TRK-2051 from the staging rows (pick at the east end facing west, drop at the truck)
    let hubLoaded = 2;
    if (t < T.load[1] + 0.2) {
      // it picks the east column row by row (pallet r * 3 + 2) and slides it into the truck's side
      const s = shuttle(fl1, fl1Pal, T.load[0], (k) => [-18.4, 8 + 2.7 * clamp(k, 0, 3)], () => [-11.2, 9.4], Math.PI, 0, t);
      hubLoaded = Math.min(4, 1 + s.delivered);
      const picked = s.k + (s.u >= 0.12 ? 1 : 0);
      hubStage.forEach((p, i) => (p.visible = !(i % 3 === 2 && Math.floor(i / 3) < picked)));
    } else {
      fl1.group.position.set(-14.6, 0, 9.4);
      fl1.group.rotation.y = Math.PI;
      fl1.setForks(0.15);
      fl1Pal.visible = false;
    }
    // ---- TRK-2051: at bay 1, then the road, then reversing into Millbrook In 3
    if (t < T.reverse[0]) {
      const s = fwd.L * ss(...T.leave, t);
      const {p, t: tg} = fwd.at(s);
      hero.group.position.set(p.x, 0, p.z);
      hero.group.rotation.y = yawOf(tg);
      hero.roll(s);
    } else {
      const s = rev.L * ss(...T.reverse, t);
      const {p, t: tg} = rev.at(s);
      hero.group.position.set(p.x, 0, p.z);
      hero.group.rotation.y = yawOf(tg.clone().negate());
      hero.roll(fwd.L - s);
    }
    hub.setDoor(0, 1 - ss(T.leave[0] + 1, T.leave[0] + 2, t));
    xd.setDoor(2, ss(T.reverse[1] - 1.2, T.reverse[1], t));
    // ---- FL-10 unloads it onto the staging rows (pick at the truck's west side facing east, drop facing west)
    let xdUnloaded = 0;
    if (t > T.unload[0] - 0.01 && t < T.unload[1]) {
      // it takes pallets off the truck's west side and fills the staging slots 2, 3, 4, 5
      // keyed so it never cuts across the rows: out along the truck's side, north up the aisle at x = B0, then west
      // into the slot, and back the same way
      const slot = (j) => [d3 - 16 + 3 * (j % 2), 13 + 2.7 * Math.floor(j / 2)];
      const c = (t - T.unload[0]) / PER;
      const k = Math.floor(c);
      const u = c - k;
      const sl = slot(2 + clamp(k, 0, 3));
      const P0 = [d3 - 6.2, 9.0];
      const B0 = [d3 - 9.2, 9.0];
      const Vp = [B0[0], sl[1]];
      const P1 = [sl[0] + 2.6, sl[1]];
      const PI2 = Math.PI / 2;
      const K = [
        [0.0, B0, 0, 0.15, 0], [0.12, P0, 0, 0.15, 0], [0.2, P0, 0, 0.7, 1], [0.3, B0, 0, 0.7, 1], [0.36, B0, -PI2, 0.7, 1],
        [0.48, Vp, -PI2, 0.7, 1], [0.54, Vp, -Math.PI, 0.7, 1], [0.6, P1, -Math.PI, 0.7, 1], [0.68, P1, -Math.PI, 0.15, 1],
        [0.74, Vp, -Math.PI, 0.15, 0], [0.8, Vp, -3 * PI2, 0.15, 0], [0.92, B0, -3 * PI2, 0.15, 0], [1.0, B0, -2 * Math.PI, 0.15, 0],
      ];
      let i = 0;
      while (i < K.length - 2 && u > K[i + 1][0]) i++;
      const A = K[i];
      const Bk = K[i + 1];
      const e = ss(A[0], Bk[0], u);
      const px = lerp(A[1][0], Bk[1][0], e);
      const pz = lerp(A[1][1], Bk[1][1], e);
      const yaw = lerp(A[2], Bk[2], e);
      const forks = lerp(A[3], Bk[3], e);
      const carrying = u >= 0.2 && u < 0.68;
      fl10.group.position.set(px, 0, pz);
      fl10.group.rotation.y = yaw;
      fl10.roll(c * 18);
      fl10.setForks(forks);
      fl10Pal.visible = carrying;
      if (carrying) {
        fl10Pal.position.set(px + Math.cos(yaw) * 2.6, forks + 0.08, pz - Math.sin(yaw) * 2.6);
        fl10Pal.rotation.y = yaw;
      }
      const s = {k, u, delivered: k + (u >= 0.68 ? 1 : 0)};
      xdUnloaded = Math.min(4, s.delivered);
      xdStage.forEach((p, i) => (p.visible = i < 2 + s.delivered));
    } else {
      xdUnloaded = t >= T.unload[1] ? 2 : 0;
      fl10.group.position.set(d3 - 9.2, 0, 9.0);
      fl10.group.rotation.y = 0;
      fl10.setForks(0.15);
      fl10Pal.visible = false;
      xdStage.forEach((p, i) => (p.visible = i < 2 + xdUnloaded));
    }
    // ---- TRK-2148 to the cold store
    if (t < T.coldRev[0]) {
      const s = coldFwd.L * ss(...T.cold, t);
      const {p, t: tg} = coldFwd.at(s);
      hero2.group.position.set(p.x, 0, p.z);
      hero2.group.rotation.y = yawOf(tg);
      hero2.roll(s);
    } else {
      const s = coldRev.L * ss(...T.coldRev, t);
      const {p, t: tg} = coldRev.at(s);
      hero2.group.position.set(p.x, 0, p.z);
      hero2.group.rotation.y = yawOf(tg.clone().negate());
      hero2.roll(coldFwd.L - s);
    }
    cold.setDoor(1, ss(T.coldRev[1] - 1.2, T.coldRev[1], t));
    // ---- through traffic
    traffic.forEach((tr, i) => {
      const x = 330 - ((t * 15 + i * 230) % 470);
      tr.group.position.set(x, 0, SOUTH - 3.2);
      tr.group.rotation.y = Math.PI;
      tr.roll(t * 15);
      tr.group.visible = x > -130 && x < 320;
    });
    return {hubLoaded, xdUnloaded};
  };
  pose(0);

  const at = (o, dy) => o.getWorldPosition(V()).add(V(0, dy, 0));
  const anchors = {
    hero: () => at(hero.group, 6.2),
    fl1: () => at(fl1.group, 4.0),
    fl10: () => at(fl10.group, 4.0),
    c1: () => at(chargers[0], 3.2),
    hero2: () => at(hero2.group, 6.2),
    hubPal: () => V(-24, 3.2, 10.7),
    hubPal2: () => V(-21, 3.2, 16.1),
    xdPal: () => V(d3 - 13, 3.2, 15.7),
    coldPal: () => V(COLD.x - 27, 3.2, COLD.z + 10.7),
  };
  const routes = {
    hero: (t) => {
      if (t < T.reverse[0]) return [...fwd.points(fwd.L * ss(...T.leave, t), fwd.L, 40), ...rev.points(0, rev.L, 16)];
      if (t < T.reverse[1]) return rev.points(rev.L * ss(...T.reverse, t), rev.L, 20);
      return null;
    },
    hero2: (t) => {
      if (t < T.coldRev[0]) return [...coldFwd.points(coldFwd.L * ss(...T.cold, t), coldFwd.L, 30), ...coldRev.points(0, coldRev.L, 16)];
      if (t < T.coldRev[1]) return coldRev.points(coldRev.L * ss(...T.coldRev, t), coldRev.L, 20);
      return null;
    },
  };
  const bodies = [
    {name: 'hero', g: hero.group}, {name: 'hero2', g: hero2.group}, {name: 'fl1', g: fl1.group}, {name: 'fl10', g: fl10.group},
    {name: 'fl1Pal', g: fl1Pal}, {name: 'fl10Pal', g: fl10Pal}, {name: 'coldTr', g: coldTr.group},
    ...xdTrucks.map((tr, i) => ({name: `xd${i}`, g: tr.group})), ...traffic.map((tr, i) => ({name: `traffic${i}`, g: tr.group})),
    ...hubStage.map((p, i) => ({name: `hs${i}`, g: p})), ...xdStage.map((p, i) => ({name: `xs${i}`, g: p})),
  ];
  return {root, pose, anchors, routes, bodies, objects: {hero, hero2, fl1, fl10, c1: chargers[0], hub, xd, cold}, HUB, XD, COLD, d3};
}
