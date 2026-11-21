// The toy airport film: Rampline over Pier B and Cargo C, cut the way the reference is cut. One camera at one
// angle for the whole film (azimuth 38, elevation 36): it only pans and zooms, like a user with a mouse; the story
// moves through clicks, the site switcher and its dropdown. 0-6 s B12, the hero ULD comes off AU 412; 6-13 the camera
// rides along with BT-14 to Cargo C; 13-23 FL-02 takes the ULD in, TRK-2205 backs into D6; 21-24 the dropdown jumps
// to B11; 24-35 AU 207's pushback; 35-43 catering at B10; 43-50 home: the whole pier while AU 207 taxis out.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {createToyStage} from './style.js';
import {createToyUI} from './ui.js';
import {createSelection} from './select.js';
import {thumb} from './thumbs.js';
import {DUR, T, buildWorld} from './world.js';
import {buildToyAirliner, buildToyCargoTerminal, buildToyTerminal} from './airside.js';
import {buildToyBoxTruck, buildToyCateringTruck, buildToyForklift, buildToyPushback, buildToyTug, buildToyULD} from './gse.js';
import {TOY} from './style.js';
import {OPERATOR_AVATAR} from './avatar.js';

const D2R = Math.PI / 180;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sm = (x) => {
  const u = clamp(x);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => sm((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const fmt = (n) => Math.round(n).toLocaleString('en-US');

export const UI_WORDS = {
  brand: 'Rampline',
  search: 'Search flights, stands, vehicles, ULDs...',
  user: ['Mila Novak', 'Ramp Manager'],
  avatar: OPERATOR_AVATAR,
  kpis: [
    {ic: 'cube', k: 'ULDs on hand', key: 'a', v: '1,412', d: '+15', s: 'today · Pier B'},
    {ic: 'truck', k: 'Vehicles on site', key: 'b', v: '14', d: '+2', s: '3 inbound · Pier B'},
    {ic: 'clock', k: 'On-time turns', key: 'c', v: '94.2%', d: '+1.6%', s: 'last 30 days · Pier B'},
  ],
};

// the clicks: film time, what the cursor lands on (a world anchor or a UI point), the card it opens
const CLICKS = [
  {t: 2.0, at: 'uld', card: 'uld'},
  {t: 7.2, at: 'tug', card: 'tug'},
  {t: 15.0, at: 'fl2', card: 'fork'},
  {t: 18.8, at: 'trk', card: 'truck'},
  {t: 21.9, ui: [1167, 37], drop: 'open'},
  {t: 23.2, ui: [930, 232], drop: 'pick', card: 'pier'},
  {t: 28.0, at: 'pb', card: 'push'},
  {t: 38.8, at: 'ct', card: 'cater'},
  {t: 43.4, ui: [1159, 275], tool: 6, card: 'pier'},
  {t: 45.6, at: 'jet207', card: 'jet'},
];
export const FILM_CLICKS = CLICKS.map((c) => c.t);

// the camera: one angle, pans and zooms. keys {t, x, z, d}; between keys an eased glide (a zoom-out arc on long ones)
const AZ = 38;
const EL = 36;
const KEYS = [
  {t: 0, x: 74, z: 32, d: 104},
  {t: 5.6, x: 77, z: 31, d: 98},
  {t: 13.6, x: 160, z: 31, d: 112},
  {t: 21.4, x: 162, z: 32, d: 108},
  {t: 24.0, x: 162, z: 32, d: 108},
  {t: 26.6, x: 2, z: 54, d: 118},
  {t: 34.4, x: -8, z: 72, d: 128},
  {t: 35.2, x: -8, z: 72, d: 128},
  {t: 37.4, x: -52, z: 30, d: 96},
  {t: 43.4, x: -50, z: 31, d: 92},
  {t: 46.4, x: -20, z: 62, d: 290},
  {t: DUR, x: -34, z: 66, d: 282},
];

const SITES = {
  B12: ['B12', 'Pier B · Stand B12', '78% full · 3/3 stands'],
  C: ['C', 'Cargo C · Northbay', '38% full · 4/6 docked'],
  B11: ['B11', 'Pier B · Stand B11', 'AU 207 · pushback'],
  B10: ['B10', 'Pier B · Stand B10', 'KS 118 · boarding'],
  PB: ['B', 'Pier B · Northbay Intl', '3 stands · 2 turning'],
};
const DROP = [['B12', 'Pier B · Stand B12', '3/3 stands · 78%', 78], ['C', 'Cargo C', '4/6 docks · 38%', 38], ['B11', 'Pier B · Stand B11', 'AU 207 · pushback', 64], ['B10', 'Pier B · Stand B10', 'KS 118 · boarding', 52], ['H2', 'Hangar 2', '1 aircraft in check', 30]];

export function runToyAirportFilm() {
  return runSim({duration: DUR, fps: 60, theme: 'light', hud: {enabled: false, title: 'rampline', subtitle: ''}, director: {enabled: false}, watermark: ''}, async ({canvas, capture}) => {
    const app = document.getElementById('app');
    const st = createToyStage(canvas, {fov: 28});
    const W = buildWorld();
    st.scene.add(W.root);
    const ui = createToyUI(app, UI_WORDS);
    const sel = createSelection(st.scene, st);
    const fit = () => (app.style.transform = `scale(${Math.min(innerWidth / 1600, innerHeight / 900)})`);
    const resize = () => {
      fit();
      st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    };
    resize();

    // thumbnails for the cards, each from its own copy of the model
    const TH = {
      uld: thumb(buildToyULD({color: TOY.blue, id: 'AKE 48211 AU'}).group),
      tug: thumb(buildToyTug({livery: 'aurora', number: 'BT-14'}).group),
      fork: thumb(buildToyForklift().group),
      truck: thumb(buildToyBoxTruck({livery: 'aurora'}).group),
      push: thumb(buildToyPushback({livery: 'aurora'}).group),
      cater: thumb(buildToyCateringTruck({livery: 'kestrel'}).group),
      jet: thumb(buildToyAirliner({livery: 'aurora', reg: 'AU-NBB'}).group, {pad: 1.0}),
      pier: thumb(buildToyTerminal({gates: 3}).group, {pad: 0.95}),
      cargo: thumb(buildToyCargoTerminal({docks: 6}).group, {pad: 0.95}),
    };

    // ---------------------------------------------------------- the camera
    const P = (o) => o.getWorldPosition(new THREE.Vector3());
    const keyCam = (t) => {
      let i = 0;
      while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
      const a = KEYS[i];
      const b = KEYS[i + 1];
      const k = ss(a.t, b.t, t);
      const far = Math.hypot(b.x - a.x, b.z - a.z);
      const arc = far > 60 ? 0.35 * Math.sin(Math.PI * k) : 0;
      return {x: lerp(a.x, b.x, k), z: lerp(a.z, b.z, k), d: lerp(a.d, b.d, k) * (1 + arc)};
    };
    const camAt = (t) => {
      const c = keyCam(t);
      // 6-13 s the camera rides along with BT-14
      const w = ss(5.6, 7.2, t) * (1 - ss(12.4, 13.8, t));
      if (w > 0) {
        const p = P(W.objects.tug.group);
        c.x = lerp(c.x, p.x + 2, w);
        c.z = lerp(c.z, p.z + 6, w);
        c.d = lerp(c.d, 112, w);
      }
      return c;
    };

    // ---------------------------------------------------------- what the page shows
    const siteAt = (t) => (t < 13.4 ? 'B12' : t < 23.2 ? 'C' : t < 35.0 ? 'B11' : t < 43.4 ? 'B10' : 'PB');
    const tS = (t) => t; // the film clock is the world clock
    const uldState = (t) => (t < T.drop[1] ? ['Unloading', 'HL-03 · Fwd hold', 'go'] : t < T.go[0] ? ['On dolly', 'BT-14 · Dolly 3', 'go'] : t < T.go[1] ? ['In transit', 'To Cargo C · D3', 'in'] : t < T.forkBack[1] ? ['At Cargo C', 'Dock D3 · FL-02', 'go'] : ['Stored', 'Cargo C · Rack C-14', 'go']);
    const trainLeft = (t) => Math.max(0, W.trainPath.L - W.trainS(t));
    const cardAt = (t, kind, t0) => {
      const pop = ss(t0, t0 + 0.35, t);
      const pc = (a, b) => clamp((t - a) / (b - a));
      if (kind === 'uld') {
        const [s, txt, cls] = uldState(t);
        return {pop, thumb: TH.uld, org: 'AURORA AIR CARGO', title: 'AKE 48211 AU', sub: 'LD3 container · AU 412', stat: s, statCls: cls, statText: txt, prog: pc(1.4, T.forkBack[1]), progText: `${Math.round(100 * pc(1.4, T.forkBack[1]))}%`, rows: [['Flight', 'AU 412', 1], ['From', 'Shanghai PVG'], ['Bags', '38 · 1,140 kg'], ['Transfer', 'AU 655 · 11:40', 1], ['Priority', 'Short connection'], ['Destination', 'Cargo C · D3']]};
      }
      if (kind === 'tug') {
        const moving = t >= T.go[0] && t < T.go[1];
        const left = trainLeft(t);
        return {pop, thumb: TH.tug, org: 'RAMP SERVICES', title: 'BT-14', sub: 'Baggage tug · 3 dollies', stat: moving ? 'En route' : t < T.go[0] ? 'Coupled' : 'Arrived', statCls: moving ? 'in' : 'go', statText: 'To Cargo C · Dock D3', prog: pc(T.go[0], T.go[1]), progText: `${Math.round(left)} m`, rows: [['Load', '3 ULDs · 3.4 t'], ['Speed', moving ? `${Math.round(10 + 14 * Math.sin(Math.PI * pc(T.go[0], T.go[1])))} km/h` : '0 km/h'], ['Distance left', `${Math.round(left)} m`], ['ETA', moving ? `${Math.max(1, Math.round(T.go[1] - t))} s` : 'Arrived'], ['Battery', '71%'], ['Mode', 'Autonomous']]};
      }
      if (kind === 'fork') {
        const carrying = t >= T.forkLift[0];
        return {pop, thumb: TH.fork, org: 'CARGO C', title: 'FL-02', sub: 'Forklift · 2.5 t', stat: carrying ? (t < T.forkBack[1] ? 'Carrying' : 'Stored') : 'To dolly 3', statCls: 'go', statText: 'Dock D3 · AKE 48211 AU', prog: pc(T.forkOut[0], T.forkBack[1]), progText: carrying ? '1/1' : '0/1', rows: [['Load', carrying ? 'AKE 48211 AU' : 'None', 1], ['Lift height', `${(carrying ? 1.45 : 0.9).toFixed(2)} m`], ['Destination', 'Rack C-14'], ['Battery', '64%'], ['Shift', 'B · Sam Chen']]};
      }
      if (kind === 'truck') {
        const docked = t >= T.truckBack[1];
        return {pop, thumb: TH.truck, org: 'NORTHBAY FREIGHT', title: 'TRK-2205', sub: 'Box truck · ZBY-5648', stat: docked ? 'Unloading' : 'Docking', statCls: docked ? 'go' : 'in', statText: `Cargo C · D6 · ${docked ? Math.min(6, 1 + Math.floor((t - T.truckBack[1]) / 1.2)) : 0}/6 ULDs`, prog: docked ? clamp((t - T.truckBack[1]) / 7) : 0.04, progText: docked ? `${Math.min(6, 1 + Math.floor((t - T.truckBack[1]) / 1.2))}/6` : '0/6', rows: [['Shipment', '#AWB 784-50213', 1], ['Consignee', 'Lakeview Retail'], ['Destination', 'Cargo C · Dock D6'], ['ETA', docked ? 'Docked' : `${Math.max(1, Math.round(T.truckBack[1] - t))} s`], ['Bay', 'Out · D6', 1], ['Cargo', '6 ULDs · 7.2 t']]};
      }
      if (kind === 'push') {
        const u = pc(...T.push);
        return {pop, thumb: TH.push, org: 'RAMP SERVICES', title: 'PB-07', sub: 'Pushback tug · AU 207', stat: t < T.push[0] ? 'Connected' : t < T.push[1] ? 'Pushing' : 'Released', statCls: t < T.push[1] ? 'in' : 'go', statText: 'Stand B11 · to taxilane B', prog: u, progText: `${Math.round(86 * sm(u))} m`, rows: [['Aircraft', 'AU 207 · A350', 1], ['Push distance', `${Math.round(86 * sm(u))} m`], ['Speed', t > T.push[0] && t < T.push[1] ? `${Math.round(4 + 4 * Math.sin(Math.PI * u))} km/h` : '0 km/h'], ['Engines', t < T.spool[0] ? 'Off' : 'Starting 1 & 2'], ['Clearance', 'Ground 121.9'], ['Next', 'Taxi via B']]};
      }
      if (kind === 'cater') {
        const h = lerp(1.55, 5.0, ss(...T.caterLift, t));
        return {pop, thumb: TH.cater, org: 'SKYFARE CATERING', title: 'CT-02', sub: 'Catering truck · KS 118', stat: t < T.caterLift[0] ? 'At stand' : t < T.caterLift[1] ? 'Lifting' : 'At door', statCls: t < T.caterLift[1] ? 'in' : 'go', statText: 'Stand B10 · Door R1', prog: pc(T.caterIn[0], T.caterLift[1]), progText: `${h.toFixed(1)} m`, rows: [['Box height', `${h.toFixed(2)} m`], ['Trolleys', '24 in · 24 out'], ['Meals', '312'], ['Special meals', '18'], ['Door', t < T.caterLift[1] ? 'R1 · closed' : 'R1 · open']]};
      }
      if (kind === 'jet') {
        const u = clamp((t - T.taxi[0]) / (T.taxi[1] - T.taxi[0]));
        return {pop, thumb: TH.jet, org: 'AURORA AIR', title: 'AU 207', sub: 'A350-class · AU-NBB', stat: 'Taxiing', statCls: 'in', statText: 'Taxiway B · Runway 09R', prog: u, progText: `${Math.round(8 + 22 * u)} kt`, rows: [['Destination', 'Tokyo HND', 1], ['Ground speed', `${Math.round(8 + 22 * u)} kt`], ['Slot', '09:52 · on time'], ['Passengers', '286'], ['Gate', 'B11 · closed']]};
      }
      const site = siteAt(t);
      if (site === 'C') return {pop, thumb: TH.cargo, org: 'DEPOT · CARGO C', title: 'Cargo C', sub: '12 Apron Rd, Northbay', stat: 'Operational', statCls: 'go', statText: '4 docked · 2 inbound', prog: 0.38, progText: '38%', rows: [['ULDs on hand', '610 / 1,600'], ['Docks busy', '4 / 6'], ['Inbound today', '23 trucks'], ['Forklifts', '2 / 5 working']]};
      return {pop, thumb: TH.pier, org: 'TERMINAL · PIER B', title: 'Pier B', sub: 'Northbay Intl · Stands B10-B12', stat: 'Operational', statCls: 'go', statText: '3 on stand · 1 arriving', prog: 0.78, progText: '78%', rows: [['Aircraft on stand', t < T.push[1] ? '3 / 3' : '2 / 3'], ['Bags this hour', fmt(1240 + t * 2)], ['Next departure', 'AU 207 · 09:52', 1], ['Ramp vehicles', '14 active'], ['On-time', '94.2%']]};
    };
    const selection = (t) => {
      let cur = {kind: 'pier', t0: -1};
      for (const c of CLICKS) if (c.card && t >= c.t) cur = {kind: c.card, t0: c.t};
      return cur;
    };
    const SEL_OBJ = {uld: W.objects.uld.group, tug: W.objects.tug.group, fork: W.objects.fl2.group, truck: W.objects.trk.group, push: W.objects.pb.group, cater: W.objects.ct.group, jet: W.objects.pushJet.group};
    const SEL_ANCHOR = {uld: 'uld', tug: 'tug', fork: 'fl2', truck: 'trk', push: 'pb', cater: 'ct', jet: 'jet207'};
    const SEL_TEXT = (kind, t) =>
      ({uld: ['AKE 48211 AU', uldState(t)[0]], tug: ['BT-14', t < T.go[1] ? 'En route' : 'Arrived'], fork: ['FL-02', t >= T.forkLift[0] ? 'Carrying' : 'To dolly'], truck: ['TRK-2205', t >= T.truckBack[1] ? 'Unloading' : 'Docking'], push: ['PB-07', t < T.push[1] ? 'Pushing' : 'Released'], cater: ['CT-02', t < T.caterLift[1] ? 'Lifting' : 'At door'], jet: ['AU 207', 'Taxiing']})[kind];
    const ROUTE = {tug: (t) => (t < T.go[1] ? W.routes.train(t) : null), truck: (t) => (t < T.truckBack[1] ? W.routes.truck(t) : null), push: (t) => (t < T.push[1] ? W.routes.push(t) : null), jet: (t) => W.routes.taxi(t)};

    const proj = (v) => st.project(v);
    const targetOf = (c) => (c.ui ? c.ui : proj(W.anchors[c.at]()) ?? [800, 450]);
    const GLIDE = 1.0;
    const cursorAt = (t) => {
      let prev = [1050, 620];
      let hand = true;
      for (const c of CLICKS) {
        const target = targetOf(c);
        if (t < c.t - GLIDE) return {p: prev, hand};
        if (t < c.t) {
          const k = sm((t - (c.t - GLIDE)) / GLIDE);
          return {p: [lerp(prev[0], target[0], k), lerp(prev[1], target[1], k) - 16 * Math.sin(Math.PI * k)], hand: !c.ui};
        }
        prev = target;
        hand = !c.ui;
      }
      return {p: prev, hand};
    };
    const clickAt = (t) => {
      let v = 0;
      for (const c of CLICKS) if (t >= c.t && t < c.t + 0.7) v = Math.max(v, 1 - (t - c.t) / 0.7);
      return v;
    };
    const dropOpen = (t) => ss(21.9, 22.2, t) * (1 - ss(23.25, 23.5, t));

    const kpiFor = (site, t) =>
      site === 'C'
        ? {a: [fmt(610 + Math.floor(t / 4)), '+20', 'ULDs · Cargo C'], b: ['4', '+2', '2 inbound · Cargo C'], c: ['96.8%', '+0.4%', 'last 30 days · Cargo C']}
        : {a: [fmt(1412 + Math.floor(t / 5)), '+15', 'today · Pier B'], b: ['14', '+2', '3 inbound · Pier B'], c: ['94.2%', '+1.6%', 'last 30 days · Pier B']};
    const trackFor = (t) => {
      if (t < 23.2) {
        const st2 = (a, b) => (t < a ? '' : t < b ? 'on' : 'done');
        const steps = [['Off-loaded', '09:31', 'load', st2(0, T.drop[1])], ['On dolly', '09:32', 'box', st2(T.drop[1], T.go[0])], ['In transit', '09:33', 'truck', st2(T.go[0], T.go[1])], ['At Cargo C', 'ETA 09:36', 'box', st2(T.go[1], T.forkBack[1])], ['Stored', 'ETA 09:38', 'check', t >= T.forkBack[1] ? 'on' : '']];
        const fill = t < T.drop[1] ? 0.04 : t < T.go[0] ? 0.25 : t < T.go[1] ? 0.25 + 0.25 * clamp((t - T.go[0]) / 7) : t < T.forkBack[1] ? 0.75 : 1;
        const [s, txt, cls] = uldState(t);
        return {title: 'ULD Tracking', meta: 'AKE 48211 AU · Aurora Air Cargo', fill, steps, ship: {thumb: TH.uld, id: 'AKE 48211 AU', to: 'To: Cargo C · Dock D3 · Rack C-14', stat: s, statCls: cls, meta: txt}};
      }
      const pushing = t < T.push[1];
      return {title: 'Turnaround Tracking', meta: 'AU 207 · Aurora Air', fill: pushing ? 0.75 : 1, steps: [['On block', '08:52', 'plane', 'done'], ['Boarding', '09:10', 'doc', 'done'], ['Doors closed', '09:34', 'check', 'done'], ['Pushback', pushing ? 'now' : '09:41', 'truck', pushing ? 'on' : 'done'], ['Take-off', 'ETA 09:52', 'plane', pushing ? '' : 'on']], ship: {thumb: TH.jet, id: 'AU 207', to: 'To: Tokyo HND · Runway 09R', stat: pushing ? 'Pushback' : 'Taxiing', statCls: 'in', meta: 'Stand B11 · PB-07 · 4 min'}};
    };
    const tableFor = (site, t) => {
      if (site === 'B12')
        return {tabs: [['Stands', '3/3'], ['Loaders', '2/4'], ['Tugs', '6']], active: 1, site: 'Pier B', rows: [
          {id: 'HL-03', org: 'Aurora Air', dot: TOY.blue, where: 'B12 · Fwd hold', stat: t < T.drop[1] ? 'Unloading' : 'Next ULD', cls: 'go', p: 100 * clamp(t / T.drop[1]), pt: t < T.drop[1] ? '3/6' : '4/6'},
          {id: 'BL-07', org: 'Aurora Air', dot: TOY.blue, where: 'B12 · Aft hold', stat: 'Loading', cls: 'go', p: 50, pt: '3/6'},
          {id: 'BT-14', org: 'Aurora Air', dot: TOY.blue, where: 'To Cargo C', stat: t < T.go[0] ? 'Coupled' : 'En route', cls: 'in', p: null, pt: t < T.go[0] ? '—' : `${Math.max(1, Math.round(T.go[1] - t))} s`},
          {id: 'FT-11', org: 'Northbay Fuel', dot: TOY.orange, where: 'B12 · R wing', stat: 'Fuelling', cls: 'wait', p: 40 + t * 2, pt: '41%'},
        ]};
      if (site === 'C')
        return {tabs: [['Docks', '4/6'], ['Forklifts', '2/5'], ['Trucks', '4']], active: 2, site: 'Cargo C', rows: [
          {id: 'TRK-2205', org: 'Northbay', dot: TOY.blue, where: t < T.truckBack[1] ? 'To D6' : 'Cargo C · D6', stat: t < T.truckBack[1] ? 'Docking' : 'Unloading', cls: t < T.truckBack[1] ? 'in' : 'go', p: t < T.truckBack[1] ? null : 30, pt: t < T.truckBack[1] ? 'docking' : '2/6'},
          {id: 'TRK-2229', org: 'Kestrel Cargo', dot: TOY.teal, where: 'Cargo C · D5', stat: 'Loading', cls: 'go', p: 50, pt: '3/6'},
          {id: 'BT-14', org: 'Aurora Air', dot: TOY.blue, where: 'Cargo C · D3', stat: 'Unloading', cls: 'go', p: t < T.forkBack[1] ? 10 : 34, pt: t < T.forkBack[1] ? '0/3' : '1/3'},
          {id: 'TRK-2481', org: 'Cargoviva', dot: TOY.orange, where: 'To Cargo C', stat: 'At gate', cls: 'wait', p: null, pt: '2 min'},
        ]};
      return {tabs: [['Stands', '3/3'], ['Pushbacks', '1/2'], ['Tugs', '6']], active: 0, site: 'Pier B', rows: [
        {id: 'B11', org: 'AU 207', dot: TOY.blue, where: t < T.push[1] ? 'Pushback' : 'Taxiing out', stat: t < T.push[1] ? 'In progress' : 'Cleared', cls: 'in', p: 100 * clamp((t - T.push[0]) / (T.push[1] - T.push[0])), pt: t < T.push[1] ? 'push' : 'done'},
        {id: 'B10', org: 'KS 118', dot: TOY.teal, where: 'Catering · R1', stat: t < T.caterLift[1] ? 'At gate' : 'Servicing', cls: 'wait', p: null, pt: '6 min'},
        {id: 'B12', org: 'AU 412', dot: TOY.blue, where: 'Unloading', stat: 'Turning', cls: 'go', p: 66, pt: '4/6'},
        {id: 'BT-21', org: 'Kestrel', dot: TOY.teal, where: 'Service road', stat: 'En route', cls: 'in', p: null, pt: '3 min'},
      ]};
    };
    // the panels' boxes (CSS px): a pin or a pill never sits under one
    const underUI = ([x, y]) => (x > 1130 && y < 450) || (x > 1080 && y > 620) || (x < 1000 && y > 720) || (x < 780 && y < 185);
    const pinsAt = (t) => {
      const out = [];
      const pin = (v, a = 1) => {
        const s = proj(v);
        if (s && s[0] > 20 && s[0] < 1580 && s[1] > 80 && s[1] < 880 && !underUI(s)) out.push({kind: 'pin', x: s[0], y: s[1], a});
      };
      if (t < 2.0) pin(W.anchors.uld(), 1 - ss(1.7, 2.0, t));
      if (t > 5.8 && t < 15.0) pin(W.anchors.d3(), ss(5.8, 6.2, t) * (1 - ss(14.6, 15.0, t)));
      if (t > 11.5 && t < 18.8) pin(W.anchors.d6(), ss(11.5, 11.9, t) * (1 - ss(18.4, 18.8, t)));
      if (t > 0 && t < 6) pin(W.anchors.fuel(), 1 - ss(5.6, 6, t));
      if (t > 25.6 && t < 28.0) pin(W.anchors.pb(), ss(25.6, 26, t) * (1 - ss(27.6, 28, t)));
      if (t > 36.4 && t < 38.8) pin(W.anchors.ct(), ss(36.4, 36.8, t) * (1 - ss(38.4, 38.8, t)));
      return out;
    };

    window.TOYAIR = {st, W, camAt};
    return {
      resize,
      render(t) {
        W.pose(t);
        const s = selection(t);
        const site = siteAt(t);
        // the selection marks ride the selected vehicle; the site card selects nothing
        const obj = SEL_OBJ[s.kind];
        const fadeIn = ss(s.t0, s.t0 + 0.3, t);
        sel.box(obj ?? null, fadeIn);
        const rf = ROUTE[s.kind];
        sel.route(rf ? rf(t) : null, ss(s.t0, s.t0 + 0.9, t), 1);
        sel.update();
        const c = camAt(t);
        st.frame({tx: c.x, ty: 2, tz: c.z, az: AZ * D2R, el: EL * D2R, d: c.d, fov: 28, sx: -110, sy: 26});
        const tags = pinsAt(t);
        if (obj) {
          const a = proj(W.anchors[SEL_ANCHOR[s.kind]]());
          const [txt, sub] = SEL_TEXT(s.kind, t);
          if (a) tags.push({kind: 'sel', x: a[0], y: a[1], text: txt, sub, a: fadeIn});
        }
        const cur = cursorAt(t);
        let tool = -1;
        for (const cl of CLICKS) if (cl.tool != null && t >= cl.t && t < cl.t + 0.6) tool = cl.tool;
        ui.update({
          clock: `09:${String(31 + Math.floor(t / 7)).padStart(2, '0')}`,
          site: SITES[site],
          kpi: kpiFor(site, t),
          card: cardAt(t, s.kind, s.t0),
          track: trackFor(t),
          table: tableFor(site, t),
          drop: {open: dropOpen(t), sites: DROP, on: t > 22.6 ? 2 : 0},
          tool,
          tags,
          cursor: cur.p,
          hand: cur.hand,
          click: clickAt(t),
        });
        return {};
      },
    };
  });
}
