// The toy construction site's world: plot P1 with the pit (ramp on the north side, a gate on the ramp's
// axis), the excavator on the east rim loading a tipper, a dozer on the pit floor, spoil heaps and the wheel loader on
// the west margin, cabins; the batching plant on the north road; plots P2 and P3 east with blockwork rising; finished
// houses, trees, the road. The work is a pure function of the film clock T:
//   0-7     EX-07 finishes the pit and loads TP-14; 7.2-12 TP-14 leaves for the road
//   8-12.4  DZ-03 levels the floor; 12.6-14.2 formwork; 14.2-17.6 the rebar mat
//   14-17.4 M-21 loads under the plant; 17.6-22 it drives east on the road; 22.4-26 it reverses through the gate down
//           the ramp; 26.2-27.2 the chute swings out; 27.4-33.6 the pour, slab to 64%
//   33.8-40 the blockwork on P2 and P3 rises
import * as THREE from 'three';
import {TOY, toyMat} from '../airport-shared/style.js';
import {buildToyTrees} from '../airport-shared/airside.js';
import {buildToyForklift} from '../airport-shared/gse.js';
import {buildToyBatchingPlant, buildToyConeRow, buildToyFormwork, buildToyGate, buildToyHouseShell, buildToyLot, buildToyMaterialStack, buildToyPit, buildToyPlotMarks, buildToyPortaLoo, buildToyRebarMat, buildToySiteCabin, buildToySiteFence, buildToySlab, buildToySoilHeap, buildToyWalls} from './site.js';
import {buildToyBulldozer, buildToyDumpTruck, buildToyExcavator, buildToyFlatbed, buildToyMixer, buildToyRoller, buildToyWheelLoader} from './machines.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sm = (x) => {
  const u = clamp(x);
  return u * u * (3 - 2 * u);
};
const ss = (a, b, t) => sm((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const yawOf = (t) => Math.atan2(-t.z, t.x);

export const DUR = 43.7;
export const T = {
  dig: [-14, 7.0], // setDug runs 0..1 over this (so frame 0 is already deep in the dig)
  exEnd: 6.9,
  tLeave: [7.2, 12.0],
  level: [8.0, 12.4],
  dozerOut: [12.6, 15.2],
  form: [12.6, 14.2],
  rebar: [14.2, 17.6],
  load: [14.0, 17.4],
  drive: [17.6, 22.2],
  reverse: [22.4, 26.0],
  chute: [26.2, 27.2],
  pour: [27.4, 33.6],
  pourTo: 0.64,
  walls: [33.8, 40.0],
};
const ROAD_Z = -42;

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

export function buildWorld() {
  const root = new THREE.Group();
  const add = (o, x = 0, z = 0, ry = 0, y = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    root.add(o);
    return o;
  };
  const flat = (w, d, color, x, z, y = 0.006) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), toyMat(color, {rough: 0.95}));
    m.position.set(x, y, z);
    m.receiveShadow = true;
    root.add(m);
    return m;
  };

  // ---------------------------------------------------------------- plot P1: the pit, the slab kit
  const pit = buildToyPit({w: 40, d: 28, depth: 4, ramp: {side: '-z', width: 7, out: 9, at: 0}, margin: {x0: 18, x1: 16, z0: 6, z1: 6}});
  add(pit.group);
  pit.group.updateMatrixWorld(true);
  const Y0 = pit.floorY;
  const form = buildToyFormwork({w: 30, d: 20, h: 0.8});
  const mat = buildToyRebarMat({w: 30, d: 20});
  for (const o of [form.group, mat.group]) add(o, 0, 0, 0, Y0);
  root.add(buildToyLot({holes: [pit.holeWorld()]}));

  // the fence round P1 (x -34..36, z -29.5..20.5), gates on the ramp axis and for the tippers at x = 28
  const FX0 = -38.5;
  const FX1 = 36.5;
  const FZ0 = -29.8;
  const FZ1 = 20.8;
  const run = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0);
    if (L < 0.5) return;
    const f = buildToySiteFence({length: L});
    add(f, (x0 + x1) / 2, (z0 + z1) / 2, -Math.atan2(z1 - z0, x1 - x0));
  };
  run(FX0, FZ1, FX1, FZ1);
  run(FX0, FZ0, -4.6, FZ0);
  run(4.6, FZ0, 23.4, FZ0);
  run(32.6, FZ0, FX1, FZ0);
  run(FX0, FZ0, FX0, FZ1);
  run(FX1, FZ0, FX1, FZ1);
  const gateR = buildToyGate({width: 8});
  add(gateR.group, 0, FZ0);
  const gateT = buildToyGate({width: 8});
  add(gateT.group, 28, FZ0);
  // margin props: heaps and the loader west, cabins north-west, stacks
  const heaps = [[-31, -8, 150, 1], [-31, 8.5, 110, 2]].map(([x, z, v, s]) => {
    const h = buildToySoilHeap({volume: v, seed: s});
    add(h.group, x, z, s * 0.7);
    return h;
  });
  add(buildToySiteCabin({label: 'SITE OFFICE'}), -31, -25.6);
  add(buildToySiteCabin({label: 'CANTEEN'}), -24, -25.6);
  add(buildToyPortaLoo(), -18.4, -26.4);
  add(buildToyMaterialStack({kind: 'rebar'}), 13, -25.8, 0);
  add(buildToyMaterialStack({kind: 'pallets', seed: 3}), 30.5, 14);
  add(buildToyConeRow({n: 5, spacing: 1.7}), -6, -26.2);

  // ---------------------------------------------------------------- machines on P1
  // EX-07 on the east rim facing the pit (-x), TP-14 alongside it heading north
  const EX = {x: 26.0, z: -1.5};
  const ex = buildToyExcavator({number: '07'});
  add(ex.group, EX.x, EX.z, Math.PI);
  const tp = buildToyDumpTruck({number: '14'});
  root.add(tp.group);
  const TP = {x: 27.6, z: 9.2};
  // it swings out to x = 32 to pass behind the excavator's counterweight
  const tpPath = makePath([[TP.x, TP.z], [31.2, 2.5], [32.2, -6], [31, -18], [28, -27], [28, -34], [34, -40.5], [60, ROAD_Z + 1.5], [160, ROAD_Z + 1.5]]);
  const dozer = buildToyBulldozer({number: '03'});
  root.add(dozer.group);
  const dzOut = makePath([[11, -3], [4, -6.5], [0, -10.5], [0, -17], [0, -22.5], [-4, -25.2], [-9, -26]]);
  const loader = buildToyWheelLoader({number: '05'});
  root.add(loader.group);
  const roller = buildToyRoller({number: '02'});
  add(roller.group, -10, 15.5, 0);

  // ---------------------------------------------------------------- the batching plant and the hero mixer
  const plant = buildToyBatchingPlant();
  add(plant.group, -98, ROAD_Z);
  plant.group.updateMatrixWorld(true);
  const bay = plant.group.localToWorld(V(plant.bay.x, 0, plant.bay.z));
  const mx = buildToyMixer({number: '21'});
  root.add(mx.group);
  const mxDrive = makePath([[bay.x, ROAD_Z], [-40, ROAD_Z], [0, ROAD_Z], [14.5, ROAD_Z]]);
  const mxRev = makePath([[14.5, ROAD_Z], [7, ROAD_Z + 1.0], [1.2, -36.5], [0, -31], [0, -23.5], [0, -18.6]]);
  const mx2 = buildToyMixer({number: '22'}); // waiting at the plant for the next load
  add(mx2.group, bay.x - 26, ROAD_Z, 0);

  // pose M-21 where it pours, chute out: the slab's pour point is under the chute's lip
  const ground0 = (x, z) => {
    const p = pit.group.worldToLocal(V(x, 0, z));
    const h = pit.heightAt(p.x, p.z);
    return Number.isFinite(h) ? h : 0;
  };
  {
    const e = mxRev.at(mxRev.L);
    mx.group.position.set(e.p.x, ground0(e.p.x, e.p.z), e.p.z);
    mx.group.rotation.set(0, yawOf(e.t.clone().negate()), 0);
    mx.setChute(1, 0);
    mx.group.updateMatrixWorld(true);
  }
  const lip = mx.chuteTip.getWorldPosition(V());
  const slab = buildToySlab({w: 30, d: 20, h: 0.6, pourAt: [clamp(lip.x, -13, 13), clamp(lip.z + 0.6, -9, 9)]});
  add(slab.group, 0, 0, 0, Y0);
  console.log('[build] chute lip', lip.x.toFixed(2), lip.y.toFixed(2), lip.z.toFixed(2));

  // ---------------------------------------------------------------- plots P2, P3, the houses, the road, the trees
  const slabP = (x, z, w, d, h, y = 0) => {
    const s = buildToySlab({w, d, h, pourAt: [0, 0]});
    s.setPour(1);
    s.setWet(0);
    add(s.group, x, z, 0, y);
  };
  slabP(60, -4, 13, 10, 0.35);
  const w2 = buildToyWalls({w: 12, d: 9, h: 3.2, seed: 2});
  add(w2.group, 60, -4, 0, 0.35);
  slabP(84, -4, 13, 10, 0.35);
  const w3a = buildToyWalls({w: 12, d: 9, h: 3.2, seed: 3});
  w3a.setBuilt(1);
  add(w3a.group, 84, -4, 0, 0.35);
  slabP(84, -4, 12.2, 9.2, 0.3, 3.55);
  const w3 = buildToyWalls({w: 12, d: 9, h: 2.8, seed: 4});
  add(w3.group, 84, -4, 0, 3.85);
  add(buildToyMaterialStack({kind: 'blocks', seed: 2}), 60, 6.8);
  add(buildToyMaterialStack({kind: 'pipes'}), 71, 5.5, Math.PI / 2);
  const fork = buildToyForklift();
  root.add(fork.group);
  const flatbed = buildToyFlatbed({load: 'blocks', number: '09'});
  add(flatbed.group, 72, 13, 0);
  add(buildToyPlotMarks({w: 12, d: 9}), 60, -28);
  add(buildToyPlotMarks({w: 12, d: 9}), 84, -28);
  add(buildToyHouseShell({floors: 1, seed: 1}), 108, -4);
  add(buildToyHouseShell({floors: 2, seed: 2}), 132, -4);
  add(buildToyHouseShell({floors: 2, seed: 3}), 108, 24, Math.PI);
  add(buildToyHouseShell({floors: 1, seed: 4}), 132, 24, Math.PI);
  add(buildToyHouseShell({floors: 2, seed: 5}), -66, 18, Math.PI / 2);
  flat(420, 12, TOY.road, 20, ROAD_Z, 0.004);
  for (let x = -180; x < 230; x += 9) flat(4.5, 0.32, TOY.lane, x, ROAD_Z, 0.012);
  flat(12, 70, TOY.road, 48, -2, 0.005); // the lane between P1 and P2
  const trees = [];
  for (let x = -150; x <= 200; x += 14) trees.push({x, z: ROAD_Z - 10, size: 1.05});
  for (const [x, z] of [[96, 12], [120, 12], [144, 12], [96, -20], [144, -20], [-56, -6], [-74, 6], [-48, 26]]) trees.push({x, z, size: 1.15});
  root.add(buildToyTrees(trees));

  // ---------------------------------------------------------------- helpers
  const ground = (x, z) => {
    const p = pit.group.worldToLocal(V(x, 0, z));
    const h = pit.heightAt(p.x, p.z);
    return Number.isFinite(h) ? h : 0;
  };
  const fw = V();
  const up = V();
  const side = V();
  const m4 = new THREE.Matrix4();
  // stand a vehicle on the surface: its nose along heading, pitched to the ground under its axles
  const standOn = (g, x, z, heading, half = 3) => {
    const hx = Math.cos(heading);
    const hz = -Math.sin(heading);
    const yf = ground(x + hx * half, z + hz * half);
    const yb = ground(x - hx * half, z - hz * half);
    const y = (yf + yb) / 2;
    fw.set(hx * 2 * half, yf - yb, hz * 2 * half).normalize();
    up.set(0, 1, 0);
    side.crossVectors(fw, up).normalize();
    up.crossVectors(side, fw).normalize();
    m4.makeBasis(fw, up, side);
    g.position.set(x, y, z);
    g.quaternion.setFromRotationMatrix(m4);
  };

  // the excavator's dig-and-load cycle (keys from the machine bench: u, slew dir, radius, y, pitch, load)
  const axis = V(EX.x, 0, EX.z);
  tp.group.position.set(TP.x, 0, TP.z);
  tp.group.rotation.y = Math.PI / 2; // nose north
  tp.group.updateMatrixWorld(true);
  const bedMid = tp.group.localToWorld(V((tp.bedSpan.x0 + tp.bedSpan.x1) / 2, 0, 0));
  const P0 = Math.PI; // toward the pit (-x)
  const P1 = Math.atan2(-(bedMid.z - EX.z), bedMid.x - EX.x);
  const KEYS = [
    [0.0, P0, 7.4, -1.2, 4.9, 0],
    [0.13, P0, 6.6, -3.85, 4.75, 0],
    [0.27, P0, 4.2, -3.0, 3.05, 1],
    [0.38, P0, 4.6, 0.8, 3.0, 1],
    [0.56, P1, 5.0, 5.3, 3.0, 1],
    [0.7, P1, 7.4, 4.9, 5.9, 0],
    [0.8, P1, 7.2, 5.1, 5.9, 0],
    [1.0, P0, 7.4, -1.2, 4.9, 0],
  ];
  const PER = 4.6;
  const PH = 1.35; // the first dump into the bed lands at about t = 1.6
  const exPt = V();
  const exCycle = (u) => {
    let i = 0;
    while (i < KEYS.length - 2 && u > KEYS[i + 1][0]) i++;
    const A = KEYS[i];
    const B = KEYS[i + 1];
    const k = ss(A[0], B[0], u);
    let dphi = B[1] - A[1];
    if (dphi > Math.PI) dphi -= 2 * Math.PI;
    if (dphi < -Math.PI) dphi += 2 * Math.PI;
    const phi = A[1] + dphi * k;
    exPt.set(axis.x + lerp(A[2], B[2], k) * Math.cos(phi), lerp(A[3], B[3], k), axis.z - lerp(A[2], B[2], k) * Math.sin(phi));
    ex.reach(exPt, {pitch: lerp(A[4], B[4], k)});
    ex.setLoad(u < 0.13 ? 0 : u < 0.27 ? ss(0.13, 0.27, u) : u < 0.58 ? 1 : 1 - ss(0.58, 0.7, u));
  };
  const dumpsBy = (t) => {
    // bucket loads tipped into the bed by time t (the bed empties when the cycle passes u = 0.64)
    let n = 0;
    for (let c = -1; c < 4; c++) {
      const tt = (c + 0.64) * PER - PH;
      if (tt <= t && tt <= T.exEnd) n++;
    }
    return n;
  };

  const pose = (t) => {
    // ---- the pit, the slab
    pit.setDug(clamp((t - T.dig[0]) / (T.dig[1] - T.dig[0])));
    pit.setLevel(ss(...T.level, t));
    form.group.visible = t > T.form[0];
    form.setBuilt(ss(...T.form, t));
    mat.group.visible = t > T.rebar[0];
    mat.setLaid(ss(...T.rebar, t));
    slab.setPour(T.pourTo * ss(...T.pour, t));
    slab.setWet(1);
    // ---- EX-07
    if (t < T.exEnd) exCycle((((t + PH) / PER) % 1 + 1) % 1);
    else {
      const k = ss(T.exEnd, T.exEnd + 1.4, t);
      exCycle((((T.exEnd + PH) / PER) % 1 + 1) % 1);
      const a = {...ex.angles};
      ex.setPose({slew: lerp(a.slew, 0, k), boom: lerp(a.boom, 0.62, k), arm: lerp(a.arm, -2.62, k), bucket: lerp(a.bucket, -2.2, k)});
      ex.setLoad(0);
    }
    // ---- TP-14: loaded by the bucketfuls, then off to the road
    tp.setLoad(clamp(0.34 + 0.33 * dumpsBy(t)));
    const sT = tpPath.L * ss(...T.tLeave, t);
    {
      const {p, t: tg} = tpPath.at(sT);
      tp.group.position.set(p.x, 0, p.z);
      tp.group.rotation.set(0, yawOf(tg), 0);
      tp.roll(sT);
    }
    tp.group.visible = sT < tpPath.L - 2;
    // ---- DZ-03 levels the floor, then climbs out up the ramp
    if (t < T.dozerOut[0]) {
      const u = clamp((t - T.level[0]) / (T.level[1] - T.level[0]));
      const pass = u * 2;
      const leg = Math.floor(Math.min(pass, 1.999));
      const f = pass - leg;
      const x = leg === 0 ? lerp(-12, 11, sm(f)) : lerp(11, -12, sm(f));
      const z = leg === 0 ? -3 : 3.5;
      const xx = t < T.level[0] ? -12 : t >= T.level[1] ? 11 : x;
      const zz = t < T.level[0] ? -3 : t >= T.level[1] ? -3 : z;
      const head = leg === 0 || t < T.level[0] || t >= T.level[1] ? 0 : Math.PI;
      standOn(dozer.group, xx, zz, head, 2.4);
      dozer.roll(xx);
      dozer.setBlade(t > T.level[0] && t < T.level[1] ? 0.05 : 0.6);
      dozer.setPush(t > T.level[0] && t < T.level[1] ? 0.4 + 0.4 * Math.sin(f * Math.PI) : 0);
    } else {
      const s = dzOut.L * ss(...T.dozerOut, t);
      const {p, t: tg} = dzOut.at(s);
      standOn(dozer.group, p.x, p.z, yawOf(tg), 2.4);
      dozer.roll(11 + s);
      dozer.setBlade(0.6);
      dozer.setPush(0);
    }
    // ---- the wheel loader shuffles at the heaps
    {
      const c = (t % 7) / 7;
      const z = c < 0.5 ? lerp(-9, 5, sm(c * 2)) : lerp(5, -9, sm((c - 0.5) * 2));
      loader.group.position.set(-23.5, 0, z);
      loader.group.rotation.y = c < 0.5 ? -Math.PI / 2 : -Math.PI / 2;
      loader.roll(z);
      loader.setLift(c < 0.5 ? 0.2 : 0.6);
      loader.setBucket(c < 0.5 ? 1 : 0.4);
      loader.setLoad(c < 0.5 ? 1 : 0.3);
    }
    heaps.forEach((h, i) => h.setSize(0.85 + 0.15 * (i ? 0.6 : 1)));
    // ---- M-21: loads at the plant, drives east, reverses down the ramp, pours
    let mxS = 0;
    if (t < T.reverse[0]) {
      const s = mxDrive.L * ss(...T.drive, t);
      const {p, t: tg} = mxDrive.at(s);
      mx.group.position.set(p.x, 0, p.z);
      mx.group.rotation.set(0, yawOf(tg), 0);
      mxS = s;
    } else {
      const s = mxRev.L * ss(...T.reverse, t);
      const {p, t: tg} = mxRev.at(s);
      standOn(mx.group, p.x, p.z, yawOf(tg.clone().negate()), 3.2);
      mxS = mxDrive.L - s;
    }
    mx.roll(mxS);
    mx.setDrum(t * (t > T.load[0] && t < T.load[1] ? 5 : 1.6));
    const ck = ss(...T.chute, t);
    mx.setChute(ck, 0);
    const pk = ss(T.pour[0], T.pour[0] + 0.5, t) * (1 - ss(T.pour[1] - 0.4, T.pour[1], t));
    mx.setPour(pk, {toY: Y0 + 0.62, t});
    mx2.setDrum(t * 1.4);
    // ---- P2, P3 and the forklift with the blocks
    w2.setBuilt(lerp(0.32, 0.86, ss(...T.walls, t)));
    w3.setBuilt(lerp(0.12, 0.58, ss(...T.walls, t)));
    {
      const c = ((t + 3) % 9) / 9;
      const x = c < 0.5 ? lerp(70, 63, sm(c * 2)) : lerp(63, 70, sm((c - 0.5) * 2));
      fork.group.position.set(x, 0, 9.6);
      fork.group.rotation.y = Math.PI;
      fork.roll(x);
      fork.setForks(c < 0.5 ? 0.9 : 0.2);
    }
    roller.group.position.set(-10 + 6 * Math.sin(t * 0.5), 0, 15.5);
    roller.roll(6 * Math.sin(t * 0.5));
    gateR.setOpen(ss(T.reverse[0] - 0.8, T.reverse[0], t) * (1 - ss(T.reverse[1] + 1, T.reverse[1] + 2, t)));
    gateT.setOpen(ss(T.tLeave[0] + 0.6, T.tLeave[0] + 1.4, t) * (1 - ss(T.tLeave[1] - 1.2, T.tLeave[1], t)));
  };
  pose(0);

  const at = (o, dy) => o.getWorldPosition(V()).add(V(0, dy, 0));
  const anchors = {
    ex: () => at(ex.group, 6.0),
    tp: () => at(tp.group, 4.6),
    dozer: () => at(dozer.group, 4.0),
    mx: () => at(mx.group, 5.0),
    slab: () => V(0, Y0 + 1.5, -2),
    plant: () => V(-98, 10, ROAD_Z),
    p2: () => V(60, 5.5, -4),
  };
  const routes = {
    tp: (t) => (t < T.tLeave[1] ? tpPath.points(tpPath.L * ss(...T.tLeave, t), Math.min(tpPath.L, tpPath.L * ss(...T.tLeave, t) + 70)) : null),
    mx: (t) => {
      if (t < T.reverse[0]) {
        const s = mxDrive.L * ss(...T.drive, t);
        return [...mxDrive.points(s, mxDrive.L, 24), ...mxRev.points(0, mxRev.L, 16)];
      }
      if (t < T.reverse[1]) return mxRev.points(mxRev.L * ss(...T.reverse, t), mxRev.L, 24).map((p) => p.setY(Math.max(0.06, ground(p.x, p.z) + 0.06)));
      return null;
    },
  };
  const bodies = [
    {name: 'ex', g: ex.group}, {name: 'tp', g: tp.group}, {name: 'dozer', g: dozer.group}, {name: 'loader', g: loader.group},
    {name: 'roller', g: roller.group}, {name: 'mx', g: mx.group}, {name: 'mx2', g: mx2.group}, {name: 'fork', g: fork.group},
    {name: 'flatbed', g: flatbed.group}, {name: 'plant', g: plant.group, kind: 'frame'},
  ];
  return {root, pose, anchors, routes, bodies, objects: {ex, tp, dozer, mx, slab, pit}, ground, Y0, ROAD_Z};
}
