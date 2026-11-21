// The toy airport's world: Pier B (stands B10-B12), Cargo C (the reference's warehouse) east of it, Hangar 2 to the
// west, a service road and a taxilane behind the stands, the landside road, fence, trees and white city blocks behind
// the terminal. The work runs as a pure function of the film clock T:
//   B12: HL-03 lowers the hero ULD (AKE 48211 AU) from AU 412's forward hold onto BT-14's last dolly; the train drives
//        east to Cargo C and stops at dock D3, FL-02 lifts the ULD off and carries it in; TRK-2205 backs into D6.
//   B11: the bridge pulls back, PB-07 pushes AU 207 out onto the taxilane, it spools up and later taxis west.
//   B10: CT-02 drives to the Kestrel jet's R1 door and lifts its box to the sill.
// Around them: belt loaders running, a second tug train on the service road, forklifts at Cargo C, beacons.
// Toy metres, y up; the terminal's apron face is +z, the taxilane at z = 100.
import * as THREE from 'three';
import {TOY, toyMat} from './style.js';
import {buildToyAirliner, buildToyApronLight, buildToyCargoTerminal, buildToyCityBlock, buildToyFence, buildToyHangar, buildToyJetBridge, buildToyTerminal, buildToyTower, buildToyTrees} from './airside.js';
import {buildToyBeltLoader, buildToyBoxTruck, buildToyCateringTruck, buildToyChocks, buildToyCone, buildToyDolly, buildToyForklift, buildToyFuelTruck, buildToyHighLoader, buildToyPushback, buildToyTug, buildToyULD} from './gse.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sm = (x) => {
  const u = clamp(x);
  return u * u * (3 - 2 * u);
};
const ss = (a, b, t) => sm((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
/** rotation.y that points a model's local +x along the ground direction t */
export const yawOf = (t) => Math.atan2(-t.z, t.x);

// the film clock (s)
export const T = {
  lower: [1.4, 3.0], // HL-03's front deck comes down with the ULD
  slide: [3.2, 4.4], // the ULD rolls back onto the rear deck
  drop: [4.4, 5.4], // and off onto BT-14's third dolly
  go: [6.0, 13.0], // BT-14 tows it to Cargo C
  forkOut: [14.2, 15.8], // FL-02 drives out of D3 to the dolly
  forkLift: [15.9, 16.7],
  forkBack: [16.8, 18.6], // and carries the ULD in
  truckIn: [11.5, 18.0], // TRK-2205 along the apron road
  truckBack: [18.2, 21.0], // backs into D6
  d6: [19.4, 20.6], // D6's shutter rolls up
  undock: [26.0, 27.4], // B11's bridge pulls back
  push: [27.6, 34.4], // PB-07 pushes AU 207 back
  spool: [31.0, 34.4], // its engines start
  unhook: [34.6, 35.8],
  caterIn: [35.4, 37.8], // CT-02 to B10's R1 door
  caterLift: [38.4, 41.8],
  taxi: [43.2, 50.5], // AU 207 taxis east
};
export const HERO_GATE = 2; // B12
export const DUR = 50;

function makePath(pts) {
  const c = new THREE.CatmullRomCurve3(pts.map(([x, z]) => V(x, 0, z)), false, 'centripetal');
  const L = c.getLength();
  const at = (s) => {
    if (s <= 0) {
      const p = c.getPointAt(0);
      const t = c.getTangentAt(0);
      return {p: p.addScaledVector(t, s), t};
    }
    if (s >= L) {
      const p = c.getPointAt(1);
      const t = c.getTangentAt(1);
      return {p: p.addScaledVector(t, s - L), t};
    }
    return {p: c.getPointAt(s / L), t: c.getTangentAt(s / L)};
  };
  const points = (s0, s1, n = 64) => Array.from({length: n + 1}, (_, i) => at(lerp(s0, s1, i / n)).p);
  return {L, at, points};
}

export function buildWorld() {
  const root = new THREE.Group();
  const add = (o, x = 0, z = 0, ry = 0, y = 0) => {
    o.position.set(x, y, z);
    o.rotation.y = ry;
    root.add(o);
    return o;
  };
  const flat = (w, d, color, x, z, y = 0.01, ry = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), toyMat(color, {rough: 0.95}));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    root.add(m);
    return m;
  };

  // ---------------------------------------------------------------- ground: the lot, the apron, roads, markings
  flat(3200, 3200, TOY.ground, 0, 0, 0);
  flat(560, 124, TOY.road, 20, 60, 0.02); // the apron
  flat(140, 46, TOY.road, 150, 38, 0.021); // Cargo C's yard
  flat(110, 60, TOY.road, -170, 50, 0.021); // Hangar 2's apron
  const roadC = '#ccd6f4';
  flat(600, 11, roadC, 20, 75, 0.03); // the service road
  flat(1400, 14, roadC, 0, -55, 0.03); // the landside road
  flat(1400, 40, TOY.groundDeep, 0, 150, 0.015); // the verge past the taxilane
  const dashes = (x0, x1, z, step = 9, len = 4, w = 0.5) => {
    for (let x = x0; x < x1; x += step) flat(len, w, TOY.lane, x, z, 0.04);
  };
  dashes(-270, 310, 75);
  dashes(-700, 700, -55);
  const yellow = TOY.bay;
  flat(560, 0.45, yellow, 20, 100, 0.04); // the taxilane centre line
  for (const gx of [-60, 0, 60]) {
    flat(0.4, 84, yellow, gx, 57, 0.04); // lead-in lines
    flat(9, 0.5, yellow, gx, 13.6, 0.04); // stop bars
  }
  // Cargo C's truck bays, the reference's yellow outlines
  for (let i = 0; i < 6; i++) {
    const x = 125 + 10 * i;
    flat(0.3, 14, yellow, x - 4.6, 24, 0.04);
    flat(0.3, 14, yellow, x + 4.6, 24, 0.04);
  }

  // ---------------------------------------------------------------- buildings
  const term = buildToyTerminal({gates: 3, spacing: 60, letter: 'B', first: 10});
  add(term.group);
  const cargo = buildToyCargoTerminal({docks: 6, stock: true});
  add(cargo.group, 150, 15);
  const hangar = add(buildToyHangar({label: 'HANGAR 2'}), -170, 30);
  add(buildToyTower(), 108, -48);
  for (const x of [-180, -90, 0, 90, 180, 250]) add(buildToyApronLight(), x, 124, Math.PI);
  // landside: fence, trees, city blocks
  for (let x = -480; x < 480; x += 30) add(buildToyFence({length: 30}), x + 15, -40);
  const trees = [];
  for (let x = -470; x < 470; x += 16) trees.push({x: x + 3 * Math.sin(x), z: -46, size: 0.9 + 0.15 * Math.sin(x * 0.7)});
  for (let x = -470; x < 470; x += 22) trees.push({x: x + 5, z: -66, size: 1 + 0.2 * Math.cos(x)});
  for (const [x, z] of [[-230, 20], [-236, 34], [-228, 50], [210, 50], [216, 64], [196, 63], [230, 30]]) trees.push({x, z, size: 1.2});
  add(buildToyTrees(trees));
  let seed = 3;
  for (let x = -460; x < 470; x += 38) {
    add(buildToyCityBlock({w: 26, d: 20, floors: 4 + (seed % 4), seed}), x, -92);
    seed += 5;
    add(buildToyCityBlock({w: 30, d: 22, floors: 6 + (seed % 5), seed}), x + 14, -132);
    seed += 7;
  }

  // ---------------------------------------------------------------- the three jets, bridges docked at L1
  const gates = term.gates;
  const jets = [
    buildToyAirliner({livery: 'kestrel', reg: 'KS-TRL'}),
    buildToyAirliner({livery: 'aurora', reg: 'AU-NBB'}),
    buildToyAirliner({livery: 'aurora', reg: 'AU-NBA'}),
  ];
  const doorW = (jet, k) => {
    const d = jet.doors[k];
    jet.group.updateMatrixWorld(true);
    return {p: jet.group.localToWorld(V(d.x, d.y, d.z)), n: d.normal.clone().transformDirection(jet.group.matrixWorld)};
  };
  const bridges = [];
  jets.forEach((jet, i) => {
    const pk = gates[i].park;
    add(jet.group, pk.x, pk.z, pk.rotY);
    jet.setGear(1);
    const br = buildToyJetBridge({label: gates[i].sign});
    add(br.group, gates[i].bridgeAnchor.x, gates[i].bridgeAnchor.z);
    const l1 = doorW(jet, 'L1');
    br.dock(l1.p, l1.n);
    bridges.push(br);
  });
  const hero = jets[HERO_GATE];
  hero.setCargoDoor(0, 1);
  hero.setCargoDoor(1, 1);
  jets[0].setCargoDoor(1, 1);
  const dockB11 = {...bridges[1].state};
  const gx = (i) => gates[i].x;

  // ---------------------------------------------------------------- B12: the hero chain
  const hl = buildToyHighLoader({livery: 'aurora'});
  const fwd = doorW(hero, 'cargoFwd');
  add(hl.group, fwd.p.x + 1.6 + 2.75, fwd.p.z, Math.PI);
  const beltB12 = buildToyBeltLoader({livery: 'aurora'});
  const aft = doorW(hero, 'cargoAft');
  add(beltB12.group, aft.p.x + 4.85 + 0.25, aft.p.z + 0.42, Math.PI);
  const fuel = buildToyFuelTruck({livery: 'aurora'});
  // behind the wing's trailing edge (under it the cab went through the wing), the hose runs up to the coupling
  add(fuel.group, gx(2) + 14, 52.5, Math.PI);
  const uld = buildToyULD({color: TOY.blue, id: 'AKE 48211 AU'});
  root.add(uld.group);
  // BT-14 and three dollies, two of them loaded
  const tug = buildToyTug({livery: 'aurora', number: 'BT-14'});
  const dollies = [buildToyDolly(), buildToyDolly(), buildToyDolly()];
  const train = [tug, ...dollies];
  train.forEach((c) => root.add(c.group));
  const cargoUlds = [buildToyULD({color: TOY.teal, id: 'AKE 40528 KS'}), buildToyULD({color: TOY.blue, id: 'AKE 40217 AU'})];
  cargoUlds.forEach((u, i) => dollies[i].slot.add(u.group));
  const OFF = [0, 4.55, 9.0, 13.45];
  const trainPath = makePath([[gx(2) + 27.3, 27.3], [110, 27.3], [132, 26.6], [150, 24.2], [158.9, 24]]);
  const poseTrain = (cars, path, s) =>
    cars.forEach((c, i) => {
      const {p, t} = path.at(s - OFF[i]);
      c.group.position.set(p.x, 0, p.z);
      c.group.rotation.y = yawOf(t);
      c.roll(s - OFF[i]);
    });
  const trainS = (t) => trainPath.L * ss(T.go[0], T.go[1], t);

  // Cargo C: FL-02 at D3, TRK-2205 into D6, TRK-2229 at D2, FL-05 working D1
  const d3 = 145;
  const fl2 = buildToyForklift();
  add(fl2.group, d3, 13.5, -Math.PI / 2);
  const fl5 = buildToyForklift();
  add(fl5.group, 125, 13.5, -Math.PI / 2);
  const pal = buildToyULD({color: TOY.white, id: 'PMC 11842 AU'});
  root.add(pal.group);
  const trk = buildToyBoxTruck({livery: 'aurora'});
  root.add(trk.group);
  const trk2 = buildToyBoxTruck({livery: 'kestrel'});
  add(trk2.group, 165, 21.4, -Math.PI / 2); // D5: the west docks stay clear for BT-14's run
  const truckIn = makePath([[330, 42], [250, 42], [158, 42]]);
  const truckBack = makePath([[158, 42], [166, 41], [172.5, 35], [175, 27.5], [175, 21.4]]);
  for (let i = 0; i < 6; i++) cargo.setDoor(i, [1, 1, 1, 0, 0, 0][i]);

  // ---------------------------------------------------------------- B11: pushback of AU 207
  const pushJet = jets[1];
  const pb = buildToyPushback({livery: 'aurora'});
  root.add(pb.group);
  // the tail swings east so the nose ends pointing west: the taxi then runs up-left in the frame, clear of the panels
  const pushPath = makePath([[0, 37.9], [0, 58], [0, 76], [4, 92], [14, 100], [26, 100]]);
  const taxiPath = makePath([[26, 100], [-60, 100], [-160, 100], [-260, 100]]);
  // after the push PB-07 backs off the taxilane round toward the empty stand, clear of AU 207's taxi
  const pbAway = makePath([[-1.7, 100], [-9, 99.4], [-15, 95], [-17.5, 86], [-17.5, 66]]);
  const chocks = buildToyChocks({gap: 1.6});
  add(chocks.group, gx(1), 37.9 - 18.2);

  // ---------------------------------------------------------------- B10: catering at R1, belt loader aft
  const ct = buildToyCateringTruck({livery: 'kestrel'});
  root.add(ct.group);
  const r1 = doorW(jets[0], 'R1');
  const caterStop = r1.p.x + 0.5 + 5.28;
  const caterPath = makePath([[-22, r1.p.z], [caterStop, r1.p.z]]);
  const beltB10 = buildToyBeltLoader({livery: 'kestrel'});
  const aft0 = doorW(jets[0], 'cargoAft');
  add(beltB10.group, aft0.p.x + 4.85 + 0.25, aft0.p.z + 0.42, Math.PI);

  // ---------------------------------------------------------------- the service road: BT-21 with two dollies, west to east
  const bt21 = buildToyTug({livery: 'kestrel', number: 'BT-21'});
  const bt21d = [buildToyDolly(), buildToyDolly()];
  const train2 = [bt21, ...bt21d];
  train2.forEach((c) => root.add(c.group));
  bt21d[0].slot.add(buildToyULD({color: TOY.teal, id: 'AKE 51190 KS'}).group);
  bt21d[1].slot.add(buildToyULD({color: TOY.white, id: 'AKE 51207 KS'}).group);
  const roadPath = makePath([[-260, 73], [0, 73], [320, 73]]);

  // cones at the wingtips and noses
  for (const g of [0, 1, 2]) {
    for (const [dx, dz] of [[-23.5, 41], [23.5, 41], [0, 10]]) add(buildToyCone().group, gx(g) + dx, dz);
  }

  // ---------------------------------------------------------------- the clock
  const tmp = V();
  const pose = (t) => {
    // --- B12: HL-03 and the hero ULD
    hl.setFront(lerp(3.2, 1.32, ss(...T.lower, t)));
    hl.setRear(1.32);
    beltB12.setBoom(1);
    beltB12.setBelt(t * 1.4);
    poseTrain(train, trainPath, trainS(t));
    hl.group.updateMatrixWorld(true);
    const front = hl.slotFront.getWorldPosition(V());
    const rear = hl.slotRear.getWorldPosition(V());
    dollies[2].group.updateMatrixWorld(true);
    const dslot = dollies[2].slot.getWorldPosition(V());
    // FL-02 and its forks
    const fz = t < T.forkOut[0] ? 13.5 : t < T.forkBack[0] ? lerp(13.5, 20.6, ss(...T.forkOut, t)) : lerp(20.6, 13.5, ss(...T.forkBack, t));
    fl2.group.position.z = fz;
    fl2.roll(fz);
    const forks = t < T.forkLift[0] ? 0.9 : lerp(0.9, 1.45, ss(...T.forkLift, t));
    fl2.setForks(forks);
    let up = 0;
    if (t < T.slide[0]) uld.group.position.copy(front);
    else if (t < T.drop[0]) uld.group.position.lerpVectors(front, rear, ss(...T.slide, t));
    else if (t < T.drop[1]) {
      const k = ss(...T.drop, t);
      uld.group.position.lerpVectors(rear, dslot, k);
    } else if (t < T.forkLift[0]) uld.group.position.copy(dslot);
    else {
      up = 1;
      uld.group.position.set(d3, Math.max(dslot.y, forks + 0.12), fz + 3.4);
    }
    uld.group.rotation.y = t < T.drop[1] ? Math.PI : up ? Math.PI : dollies[2].group.rotation.y + Math.PI;
    // FL-05 shuttles pallets in and out of D1
    const c5 = ((t + 1.3) % 8) / 8;
    const z5 = c5 < 0.5 ? lerp(13.5, 20.5, sm(c5 * 2)) : lerp(20.5, 13.5, sm((c5 - 0.5) * 2));
    fl5.group.position.z = z5;
    fl5.roll(z5);
    fl5.setForks(0.4);
    pal.group.position.set(125, 0.5, z5 + 2.4);
    pal.group.rotation.y = Math.PI / 2;
    // TRK-2205 along the road, then back into D6
    if (t < T.truckBack[0]) {
      const s = truckIn.L * ss(...T.truckIn, t);
      const {p, t: tg} = truckIn.at(s);
      trk.group.position.set(p.x, 0, p.z);
      trk.group.rotation.y = yawOf(tg);
      trk.roll(s);
    } else {
      const s = truckBack.L * ss(...T.truckBack, t);
      const {p, t: tg} = truckBack.at(s);
      trk.group.position.set(p.x, 0, p.z);
      trk.group.rotation.y = yawOf(tg.clone().negate());
      trk.roll(truckIn.L - s);
    }
    cargo.setDoor(5, ss(...T.d6, t));
    // --- B11: the bridge pulls back, then the pushback and the taxi
    const ku = ss(...T.undock, t);
    const b = bridges[1];
    b.setYaw(dockB11.yaw);
    b.setExtend(lerp(dockB11.extend, b.limits.extend[0], ku));
    b.setHeight(lerp(dockB11.height, 5.2, ku));
    b.setCabinYaw(lerp(dockB11.cabinYaw, 0, ku));
    let jp;
    let nose;
    if (t < T.taxi[0]) {
      const s = pushPath.L * ss(...T.push, t);
      const {p, t: tg} = pushPath.at(s);
      jp = p;
      nose = tg.clone().negate();
    } else {
      const u = clamp((t - T.taxi[0]) / (T.taxi[1] - T.taxi[0]));
      const s = taxiPath.L * 0.62 * Math.pow(u, 1.7);
      const {p, t: tg} = taxiPath.at(s);
      jp = p;
      nose = tg.clone();
    }
    pushJet.group.position.set(jp.x, 0, jp.z);
    pushJet.group.rotation.y = yawOf(nose);
    const spin = t < T.spool[0] ? 0 : Math.pow(t - T.spool[0], 2) * 4 + Math.max(0, t - T.spool[1]) * 30;
    pushJet.setFans(spin);
    pushJet.setBeacons(t > T.undock[0] && (t * 1.2) % 1 < 0.14);
    chocks.group.visible = t < T.undock[0];
    // PB-07 on the nose gear, facing the jet; after the push it backs away round to the stand
    const tugD = 23 + 3.7 + 1.0; // nose tip + half the tug + a gap: the tug never sits under the nose
    if (t < T.unhook[0]) {
      pb.group.position.set(jp.x + nose.x * tugD, 0, jp.z + nose.z * tugD);
      pb.group.rotation.y = yawOf(nose.clone().negate());
      pb.roll(pushPath.L * ss(...T.push, t));
    } else {
      const s2 = pbAway.L * ss(T.unhook[0], T.unhook[0] + 3.2, t);
      const {p, t: tg} = pbAway.at(s2);
      pb.group.position.set(p.x, 0, p.z);
      pb.group.rotation.y = yawOf(tg.clone().negate());
      pb.roll(pushPath.L - s2);
    }
    // --- B10: catering
    const cs = caterPath.L * ss(...T.caterIn, t);
    const cp = caterPath.at(cs);
    ct.group.position.set(cp.p.x, 0, cp.p.z);
    ct.group.rotation.y = Math.PI;
    ct.roll(cs);
    ct.setBox(lerp(1.55, 5.0, ss(...T.caterLift, t)));
    beltB10.setBoom(1);
    beltB10.setBelt(t * 1.4);
    // --- the service road and the fuel truck
    poseTrain(train2, roadPath, 30 + 9.5 * t);
    fuel.setHose(1, fuel.group.worldToLocal(doorW(hero, 'fuel').p));
    jets[0].setBeacons(false);
    jets[2].setBeacons((t * 1.2 + 0.5) % 1 < 0.14);
  };
  pose(0);

  // every solid thing on the map, for the collision check (airport-collide): name, group, kind
  const bodies = [
    ...jets.map((j, i) => ({name: `jet${i}`, g: j.group, kind: 'jet'})),
    {name: 'hl', g: hl.group}, {name: 'beltB12', g: beltB12.group}, {name: 'fuel', g: fuel.group}, {name: 'uld', g: uld.group},
    {name: 'tug', g: tug.group}, ...dollies.map((d, i) => ({name: `dolly${i}`, g: d.group})),
    {name: 'fl2', g: fl2.group}, {name: 'fl5', g: fl5.group}, {name: 'pal', g: pal.group}, {name: 'trk', g: trk.group}, {name: 'trk2', g: trk2.group},
    {name: 'pb', g: pb.group}, {name: 'ct', g: ct.group}, {name: 'beltB10', g: beltB10.group},
    {name: 'bt21', g: bt21.group}, ...bt21d.map((d, i) => ({name: `bt21d${i}`, g: d.group})),
    ...bridges.map((b, i) => ({name: `bridge${i}`, g: b.group, kind: 'bridge'})),
  ];
  const trees2 = trees.map((p) => ({x: p.x, z: p.z, r: 3 * (p.size ?? 1)}));

  const at = (o, dy) => o.getWorldPosition(V()).add(V(0, dy, 0));
  const anchors = {
    uld: () => at(uld.group, 3.4),
    hl: () => at(hl.group, 5.6),
    tug: () => at(tug.group, 3.4),
    fl2: () => at(fl2.group, 3.9),
    trk: () => at(trk.group, 6.0),
    pb: () => at(pb.group, 3.6),
    jet207: () => at(pushJet.group, 9),
    ct: () => at(ct.group, 9),
    d3: () => V(d3, 7.6, 15.2),
    d6: () => V(175, 7.6, 15.2),
    pier: () => V(0, 12, 0),
    cargo: () => V(150, 12, 0),
    fuel: () => at(fuel.group, 5.4),
  };
  const routes = {
    train: (t) => trainPath.points(trainS(t), trainPath.L),
    truck: (t) => (t < T.truckBack[0] ? [...truckIn.points(truckIn.L * ss(...T.truckIn, t), truckIn.L, 24), ...truckBack.points(0, truckBack.L, 24)] : truckBack.points(truckBack.L * ss(...T.truckBack, t), truckBack.L, 24)),
    push: (t) => pushPath.points(pushPath.L * ss(...T.push, t), pushPath.L),
    taxi: (t) => taxiPath.points(taxiPath.L * 0.62 * Math.pow(clamp((t - T.taxi[0]) / (T.taxi[1] - T.taxi[0])), 1.7), taxiPath.L * 0.85),
  };
  return {root, pose, anchors, routes, bodies, trees: trees2, cargoBox: {x0: 114, x1: 186, z0: -21, z1: 15}, objects: {uld, hl, tug, fl2, trk, pb, ct, pushJet, hero, jets, fuel}, trainS, trainPath, gates};
}
