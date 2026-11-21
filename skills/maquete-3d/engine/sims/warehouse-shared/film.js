// The toy logistics network film: Stockline over three warehouses, cut the way the reference is cut. One
// camera at one angle (azimuth 38, elevation 36) that pans and zooms; the story moves through clicks and the site
// switcher's dropdown. 0-7.6 s Harbor Hub: FL-01 loads TRK-2051; 7.6-15 the camera rides TRK-2051 to Millbrook;
// 15.4-25 it docks at In 3 and FL-10 unloads it, the charger C1; 24.6-32 the dropdown jumps to the cold store and
// TRK-2148 docks; 32.6-39.4 home over the whole network.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {TOY, createToyStage} from '../airport-shared/style.js';
import {createToyUI} from '../airport-shared/ui.js';
import {createSelection} from '../airport-shared/select.js';
import {thumb} from '../airport-shared/thumbs.js';
import {buildToyCargoTerminal} from '../airport-shared/airside.js';
import {buildToyBoxTruck, buildToyForklift} from '../airport-shared/gse.js';
import {OPERATOR_AVATAR} from '../airport-shared/avatar.js';
import {DUR, T, buildWorld} from './world.js';

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
  brand: 'Stockline',
  search: 'Search sites, trucks, forklifts, pallets, shipments...',
  user: ['Mila Novak', 'Operations Manager'],
  avatar: OPERATOR_AVATAR,
  kpis: [
    {ic: 'cube', k: 'Stock on hand', key: 'a', v: '1,412', d: '+15', s: 'pallets · WH-01'},
    {ic: 'truck', k: 'Trucks on site', key: 'b', v: '1', d: '+1', s: '1 inbound · WH-01'},
    {ic: 'clock', k: 'On-time delivery', key: 'c', v: '96.6%', d: '+0.4%', s: 'last 30 days · WH-01'},
  ],
};

const CLICKS = [
  {t: 1.6, at: 'fl1', card: 'fl1'},
  {t: 5.4, at: 'hero', card: 'hero'},
  {t: 19.4, at: 'fl10', card: 'fl10'},
  {t: 22.2, at: 'c1', card: 'c1'},
  {t: 24.6, ui: [1167, 37], drop: 'open'},
  {t: 25.7, ui: [930, 274], card: 'site'},
  {t: 29.9, at: 'hero2', card: 'hero2'},
  {t: 32.8, ui: [1159, 275], tool: 6, card: 'site'},
];
export const FILM_CLICKS = CLICKS.map((c) => c.t);

const AZ = 38;
const EL = 36;
const KEYS = [
  {t: 0, x: -8, z: 8, d: 96},
  {t: 7.4, x: -7, z: 8, d: 92},
  {t: 15.2, x: 136, z: 12, d: 96},
  {t: 18.8, x: 136, z: 10, d: 96},
  {t: 21.6, x: 152, z: 8, d: 104},
  {t: 25.7, x: 152, z: 8, d: 104},
  {t: 27.4, x: 62, z: -104, d: 100},
  {t: 32.6, x: 62, z: -104, d: 98},
  {t: 35.4, x: 96, z: -34, d: 330},
  {t: DUR, x: 94, z: -34, d: 322},
];
const SITES = {
  HUB: ['WH-01', 'Harbor Hub', '78% full · 1/2 docked'],
  XD: ['WH-04', 'Millbrook Cross-Dock', '38% full · 5/8 docked'],
  COLD: ['WH-03', 'Northgate Cold Store', '71% full · 2/3 docked'],
  NET: ['NB', 'Northbay Network', '3 sites · 9 trucks'],
};
const DROP = [['WH-01', 'Harbor Hub', '78% full · 1/2 docked', 78], ['WH-04', 'Millbrook Cross-Dock', '38% full · 5/8 docked', 38], ['WH-03', 'Northgate Cold Store', '71% full · 2/3 docked', 71], ['WH-05', 'Westfield Depot', '54% full · 0/2 docked', 54]];

export function runToyWarehouseFilm() {
  return runSim({duration: DUR, fps: 60, theme: 'light', hud: {enabled: false, title: 'stockline', subtitle: ''}, director: {enabled: false}, watermark: ''}, async ({canvas, capture}) => {
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

    const TH = {
      truck: thumb(buildToyBoxTruck({livery: 'aurora'}).group),
      truck2: thumb(buildToyBoxTruck({livery: 'plain'}).group),
      fork: thumb(buildToyForklift().group),
      hub: thumb(buildToyCargoTerminal({docks: 2, name: 'WH-01'}).group, {pad: 0.95}),
      xd: thumb(buildToyCargoTerminal({docks: 8, name: 'WH-04'}).group, {pad: 0.95}),
      charger: thumb(W.objects.c1.clone(), {pad: 1.3}),
    };

    const P = (o) => o.getWorldPosition(new THREE.Vector3());
    const keyCam = (t) => {
      let i = 0;
      while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
      const a = KEYS[i];
      const b = KEYS[i + 1];
      const k = ss(a.t, b.t, t);
      const far = Math.hypot(b.x - a.x, b.z - a.z);
      const arc = far > 50 ? 0.3 * Math.sin(Math.PI * k) : 0;
      return {x: lerp(a.x, b.x, k), z: lerp(a.z, b.z, k), d: lerp(a.d, b.d, k) * (1 + arc)};
    };
    const camAt = (t) => {
      const c = keyCam(t);
      const w = ss(7.4, 8.6, t) * (1 - ss(13.6, 15.0, t));
      if (w > 0) {
        const p = P(W.objects.hero.group);
        c.x = lerp(c.x, p.x + 2, w);
        c.z = lerp(c.z, p.z + 2, w);
        c.d = lerp(c.d, 100, w);
      }
      return c;
    };

    let ST = {hubLoaded: 2, xdUnloaded: 0};
    const siteAt = (t) => (t < 12.0 ? 'HUB' : t < 25.7 ? 'XD' : t < 32.8 ? 'COLD' : 'NET');
    const heroState = (t) =>
      t < T.leave[0] ? [`Loading ${ST.hubLoaded}/4`, 'WH-01 · Bay 1', 'go'] :
      t < T.reverse[0] ? ['In transit', 'To WH-04 Millbrook · In 3', 'in'] :
      t < T.reverse[1] ? ['Docking', 'WH-04 · In 3', 'wait'] :
      [`Unloading ${ST.xdUnloaded}/4`, 'WH-04 · In 3', 'go'];
    const cardAt = (t, kind, t0) => {
      const pop = ss(t0, t0 + 0.35, t);
      const pc = (a, b) => clamp((t - a) / (b - a));
      if (kind === 'fl1') return {pop, thumb: TH.fork, org: 'FLEET · WH-01', title: 'FL-01', sub: 'Electric forklift · 2.5 t', stat: t < T.load[1] ? 'Loading' : 'Idle', statCls: t < T.load[1] ? 'go' : 'wait', statText: `TRK-2051 · Bay 1 · ${ST.hubLoaded}/4`, prog: ST.hubLoaded / 4, progText: `${ST.hubLoaded}/4`, rows: [['Load', 'Pallet · 1.2 t'], ['Lift', '0.70 m'], ['Battery', '76%'], ['Shift', 'A · Sam Lee'], ['Next', 'Put-away · rack 4']]};
      if (kind === 'hero') {
        const [s, txt, cls] = heroState(t);
        const left = Math.max(0, Math.round(T.reverse[1] - t));
        return {pop, thumb: TH.truck, org: 'AURORA FREIGHT', title: 'TRK-2051', sub: 'Box truck · NBY-2051', stat: s, statCls: cls, statText: txt, prog: t < T.leave[0] ? ST.hubLoaded / 4 : pc(T.leave[0], T.reverse[1]), progText: t < T.leave[0] ? `${ST.hubLoaded}/4` : `${left} s`, rows: [['Shipment', '#SHP-78442', 1], ['Customer', 'Lakeview Retail'], ['Destination', 'WH-04 · In 3'], ['ETA', t < T.reverse[1] ? `in ${left} s` : 'Docked'], ['Speed', t > T.leave[0] && t < T.reverse[0] ? `${Math.round(30 + 25 * Math.sin(Math.PI * pc(...T.leave)))} km/h` : '0 km/h'], ['Cargo', '4 pallets · 4.8 t']]};
      }
      if (kind === 'fl10') return {pop, thumb: TH.fork, org: 'FLEET · WH-04', title: 'FL-10', sub: 'Electric forklift · 2.5 t', stat: t < T.unload[1] ? 'Unloading' : 'Idle', statCls: 'go', statText: `TRK-2051 · In 3 · ${ST.xdUnloaded}/4`, prog: ST.xdUnloaded / 4, progText: `${ST.xdUnloaded}/4`, rows: [['Load', 'Pallet · 1.1 t'], ['Battery', `${Math.round(85 - (t - 19) * 0.4)}%`], ['Put-away', 'Staging · lane B'], ['Shift', 'A · Ada Kim']]};
      if (kind === 'c1') return {pop, thumb: TH.charger, org: 'CHARGER · WH-04', title: 'C1', sub: '48 V lithium-ion forklift charger', stat: 'Free', statCls: 'go', statText: `FL-10 is out · unloading TRK-2051 at In 3`, prog: 0.85, progText: '85%', rows: [['Forklift', 'FL-10 · battery 85%', 1], ['Sessions today', '7'], ['Energy today', '40.1 kWh'], ['Charge rate', '8% a minute'], ['Site', 'Millbrook Cross-Dock']]};
      if (kind === 'hero2') {
        const docked = t >= T.coldRev[1];
        return {pop, thumb: TH.truck2, org: 'NORTHLINE LOGISTICS', title: 'TRK-2148', sub: 'Reefer box · NBY-2148', stat: docked ? 'Unloading' : 'Docking', statCls: docked ? 'go' : 'wait', statText: 'WH-03 · Dock 2 · −18 °C', prog: docked ? clamp((t - T.coldRev[1]) / 6) : pc(...T.coldRev), progText: docked ? '1/4' : 'docking', rows: [['Shipment', '#SHP-78448', 1], ['Customer', 'Sunvale Grocers'], ['Destination', 'WH-03 · Dock 2'], ['Reefer', '−18 °C · OK'], ['Cargo', '4 pallets · 3.6 t']]};
      }
      const site = siteAt(t);
      const depot = {
        HUB: {org: 'DEPOT · WH-01', title: 'Harbor Hub', sub: '12 Harbor Rd, Northbay', stat: 'Operational', text: '1 docked · 1 arriving · 3 staged', stats: [['Stock on hand', '1,412', '/ 1,800', 0.78], ['Truck bays', '2', '/ 2 busy', 1, 1], ['Outbound today', '23', 'trucks'], ['Put-aways today', '15', 'pallets']], inv: [['box', 'Cardboard box (L)', '1,906', 'In Stock', 'go'], ['bin', 'Plastic tote', '297', 'In Stock', 'go'], ['helmet', 'Hi-vis helmet', '212', 'Low Stock', 'wait'], ['tape', 'Stretch wrap', '4,448', 'In Stock', 'go']], fleet: {title: 'Forklift fleet', meta: '1/2 working', rows: [['FL-01', `Loading TRK-2051 at Bay 1`, ST.hubLoaded / 4]]}},
        XD: {org: 'CROSS-DOCK · WH-04', title: 'Millbrook Cross-Dock', sub: '40 Mill Rd, Northbay', stat: 'Operational', text: '5 docked · 1 arriving · 6 staged', stats: [['Stock on hand', '610', '/ 1,600', 0.38], ['Truck bays', '5', '/ 8 busy', 0.62, 1], ['Inbound today', '31', 'trucks'], ['Cross-docked', '212', 'pallets']], inv: [['pallet', 'Mixed pallets', '184', 'In Stock', 'go'], ['box', 'Cardboard box (M)', '2,310', 'In Stock', 'go'], ['bin', 'Plastic tote', '96', 'Low Stock', 'wait'], ['tape', 'Stretch wrap', '1,204', 'In Stock', 'go']], fleet: {title: 'Forklift fleet', meta: '2/5 working', rows: [['FL-10', 'Unloading TRK-2051 at In 3', ST.xdUnloaded / 4]]}},
        COLD: {org: 'COLD STORE · WH-03', title: 'Northgate Cold Store', sub: '7 Harbor Way, Northbay', stat: 'Operational', text: '2 docked · 1 arriving · 0 staged', stats: [['Stock on hand', '990', '/ 1,400', 0.71], ['Truck bays', '3', '/ 3 busy', 1, 1], ['Outbound today', '31', 'trucks'], ['Put-aways today', '20', 'pallets']], inv: [['frozen', 'Frozen berries 10 kg', '334', 'In Stock', 'go'], ['water', 'Spring water 24-pack', '364', 'In Stock', 'go'], ['gloves', 'Nitrile gloves', '495', 'Low Stock', 'wait'], ['bin', 'Insulated tote', '208', 'In Stock', 'go']], fleet: {title: 'Forklift fleet', meta: '2/3 working', rows: [['FL-07', 'Unloading TRK-2603 at Dock 1', 0.78]]}},
        NET: {org: 'NETWORK', title: 'Northbay Network', sub: '3 sites · 1 opening', stat: 'Operational', text: '8 docked · 2 on the road', stats: [['Stock on hand', '3,012', '/ 4,800', 0.63], ['Truck bays', '8', '/ 13 busy', 0.62, 1], ['Trucks today', '85', ''], ['On-time', '96.4%', '']], inv: [['box', 'Cardboard box (L)', '4,216', 'In Stock', 'go'], ['pallet', 'Mixed pallets', '512', 'In Stock', 'go'], ['frozen', 'Frozen goods', '334', 'In Stock', 'go'], ['helmet', 'Hi-vis helmet', '212', 'Low Stock', 'wait']], fleet: {title: 'Forklift fleet', meta: '5/10 working', rows: [['FL-10', 'Unloading TRK-2051 at WH-04', 0.5]]}},
      }[site];
      return {pop, thumb: site === 'XD' ? TH.xd : TH.hub, org: depot.org, title: depot.title, sub: depot.sub, stat: depot.stat, statCls: 'go', statText: depot.text, prog: 0, progText: '', stats: depot.stats, inv: depot.inv, fleet: depot.fleet, rows: []};
    };
    const selection = (t) => {
      let cur = {kind: 'site', t0: -1};
      for (const c of CLICKS) if (c.card && t >= c.t) cur = {kind: c.card, t0: c.t};
      return cur;
    };
    const SEL_OBJ = {fl1: W.objects.fl1.group, hero: W.objects.hero.group, fl10: W.objects.fl10.group, c1: W.objects.c1, hero2: W.objects.hero2.group};
    const SEL_TEXT = (kind, t) => ({fl1: ['FL-01', 'Loading'], hero: ['TRK-2051', heroState(t)[0]], fl10: ['FL-10', 'Unloading'], c1: ['C1', 'Free'], hero2: ['TRK-2148', t < T.coldRev[1] ? 'Docking' : 'Unloading']})[kind];
    const ROUTE = {hero: (t) => W.routes.hero(t), hero2: (t) => W.routes.hero2(t)};

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
    const dropOpen = (t) => ss(24.6, 24.9, t) * (1 - ss(25.75, 26.0, t));
    const kpiFor = (site, t) =>
      ({
        HUB: {a: ['1,412', '+15', 'pallets · WH-01'], b: ['1', '+1', '1 inbound · WH-01'], c: ['96.6%', '+0.4%', 'last 30 days · WH-01']},
        XD: {a: ['610', '+20', 'pallets · WH-04'], b: [String(t < T.reverse[1] ? 4 : 5), '+2', '2 inbound · WH-04'], c: ['96.2%', '+0.4%', 'last 30 days · WH-04']},
        COLD: {a: ['990', '+20', 'pallets · WH-03'], b: [String(t < T.coldRev[1] ? 2 : 3), '+1', '1 inbound · WH-03'], c: ['96.0%', '+0.4%', 'last 30 days · WH-03']},
        NET: {a: ['3,012', '+55', 'pallets · 3 sites'], b: ['9', '+3', '2 on the road'], c: ['96.4%', '+0.4%', 'last 30 days · network']},
      })[site];
    const trackFor = (t) => {
      if (t < 25.7 || t >= 32.8) {
        const st2 = (a, b) => (t < a ? '' : t < b ? 'on' : 'done');
        const steps = [['Order Confirmed', '06:48', 'doc', 'done'], ['Picked', '08:18', 'box', 'done'], [`Loaded ${ST.hubLoaded}/4`, 'ETA 09:53', 'load', st2(-1, T.leave[0])], ['In Transit', 'ETA 10:01', 'truck', st2(T.leave[0], T.reverse[1])], [t < T.reverse[1] ? 'Delivered' : `Unloading ${ST.xdUnloaded}/4`, 'ETA 10:33', 'check', t >= T.reverse[1] ? 'on' : '']];
        const fill = t < T.leave[0] ? 0.5 : t < T.reverse[1] ? 0.5 + 0.25 * clamp((t - T.leave[0]) / (T.reverse[1] - T.leave[0])) : 1;
        const [s, txt, cls] = heroState(t);
        return {title: 'Shipment Tracking', meta: 'TRK-2051 · Aurora Freight', fill, steps, ship: {thumb: TH.truck, id: '#SHP-78442', to: 'To: WH-04 Millbrook Cross-Dock', stat: s, statCls: cls, meta: txt}};
      }
      const docked = t >= T.coldRev[1];
      return {title: 'Shipment Tracking', meta: 'TRK-2148 · Northline', fill: docked ? 1 : 0.75, steps: [['Order Confirmed', '06:41', 'doc', 'done'], ['Picked', '08:20', 'box', 'done'], ['Loaded', '09:17', 'load', 'done'], ['In Transit', '09:43', 'truck', docked ? 'done' : 'on'], [docked ? 'Unloading 0/4' : 'Unloading', 'ETA 09:52', 'check', docked ? 'on' : '']], ship: {thumb: TH.truck2, id: '#SHP-78448', to: 'To: WH-03 Northgate Cold Store', stat: docked ? 'Unloading' : 'Docking', statCls: docked ? 'go' : 'wait', meta: 'WH-03 · Dock 2 · 3 min left'}};
    };
    const tableFor = (site, t) => {
      if (site === 'HUB')
        return {tabs: [['Docks', '2/2'], ['Forklifts', '1/2'], ['Trucks', '2']], active: 0, site: 'Harbor Hub', rows: [
          {id: 'Bay 1', org: 'WH-01', dot: TOY.blue, where: t < T.leave[0] ? 'TRK-2051 · Aurora' : 'No truck assigned', stat: t < T.leave[0] ? 'Loading' : 'Available', cls: t < T.leave[0] ? 'go' : 'wait', p: t < T.leave[0] ? (100 * ST.hubLoaded) / 4 : null, pt: t < T.leave[0] ? `${ST.hubLoaded}/4` : ''},
          {id: 'Bay 2', org: 'WH-01', dot: '#c9d1ea', where: 'No truck assigned', stat: 'Available', cls: 'wait', p: null, pt: ''},
          {id: 'Inbound', org: 'WH-01', dot: TOY.teal, where: 'TRK-2287 · Kestrel', stat: 'En route', cls: 'in', p: null, pt: '3 min'},
        ]};
      if (site === 'XD')
        return {tabs: [['Docks', `${t < T.reverse[1] ? 4 : 5}/8`], ['Forklifts', '2/5'], ['Trucks', '5']], active: 2, site: 'Millbrook Cross-Dock', rows: [
          {id: 'TRK-2205', org: 'Kestrel', dot: TOY.teal, where: 'WH-04 · In 5', stat: 'Unloading', cls: 'go', p: 50, pt: '2/4'},
          {id: 'TRK-2229', org: 'Northline', dot: TOY.blue, where: 'WH-04 · Out 6', stat: 'Loading', cls: 'go', p: 75, pt: '3/4'},
          {id: 'TRK-2051', org: 'Aurora', dot: TOY.blue, where: 'WH-04 · In 3', stat: t < T.reverse[1] ? 'Docking' : 'Unloading', cls: t < T.reverse[1] ? 'in' : 'go', p: t < T.reverse[1] ? null : (100 * ST.xdUnloaded) / 4, pt: t < T.reverse[1] ? 'docking' : `${ST.xdUnloaded}/4`},
          {id: 'TRK-2481', org: 'Cargoviva', dot: TOY.orange, where: 'WH-04 · Out 8', stat: 'Waiting', cls: 'wait', p: null, pt: '5 min'},
        ]};
      return {tabs: [['Docks', `${t < T.coldRev[1] ? 2 : 3}/3`], ['Forklifts', '2/3'], ['Trucks', '3']], active: 2, site: site === 'NET' ? 'Network' : 'Northgate Cold Store', rows: [
        {id: 'TRK-2148', org: 'Northline', dot: TOY.blue, where: 'WH-03 · Dock 2', stat: t < T.coldRev[1] ? 'Docking' : 'Unloading', cls: t < T.coldRev[1] ? 'in' : 'go', p: t < T.coldRev[1] ? null : 25, pt: t < T.coldRev[1] ? 'docking' : '1/4'},
        {id: 'TRK-2603', org: 'Kestrel', dot: TOY.teal, where: 'WH-03 · Dock 1', stat: 'Unloading', cls: 'go', p: 75, pt: '3/4'},
        {id: 'TRK-2471', org: 'Northline', dot: TOY.blue, where: 'To WH-03', stat: 'En route', cls: 'in', p: null, pt: '6 min'},
      ]};
    };
    const underUI = ([x, y]) => (x > 1130 && y < 560) || (x > 1080 && y > 620) || (x < 1000 && y > 720) || (x < 780 && y < 185);
    const pinsAt = (t) => {
      const out = [];
      const pin = (v, a = 1) => {
        const s = proj(v);
        if (s && s[0] > 20 && s[0] < 1580 && s[1] > 80 && s[1] < 880 && !underUI(s)) out.push({kind: 'pin', x: s[0], y: s[1], a});
      };
      if (t < 12) {
        pin(W.anchors.hubPal());
        pin(W.anchors.hubPal2());
      }
      if (t > 14 && t < 26) pin(W.anchors.xdPal());
      if (t > 26 && t < 33) pin(W.anchors.coldPal());
      return out;
    };

    window.TOYWH = {st, W, camAt};
    return {
      resize,
      render(t) {
        ST = W.pose(t);
        const s = selection(t);
        const site = siteAt(t);
        const obj = SEL_OBJ[s.kind];
        const fadeIn = ss(s.t0, s.t0 + 0.3, t);
        sel.box(obj ?? null, fadeIn);
        const rf = ROUTE[s.kind];
        sel.route(rf ? rf(t) : null, ss(s.t0, s.t0 + 0.9, t), 1);
        sel.update();
        const c = camAt(t);
        st.frame({tx: c.x, ty: 1.5, tz: c.z, az: AZ * D2R, el: EL * D2R, d: c.d, fov: 28, sx: -110, sy: 26});
        const tags = pinsAt(t);
        if (obj) {
          const a = proj(W.anchors[s.kind]());
          const [txt, sub] = SEL_TEXT(s.kind, t);
          if (a && !underUI(a)) tags.push({kind: 'sel', x: a[0], y: a[1], text: txt, sub, a: fadeIn});
        }
        const cur = cursorAt(t);
        let tool = -1;
        for (const cl of CLICKS) if (cl.tool != null && t >= cl.t && t < cl.t + 0.6) tool = cl.tool;
        ui.update({
          clock: `09:${String(40 + Math.floor(t / 4)).padStart(2, '0')}`,
          site: SITES[site],
          kpi: kpiFor(site, t),
          card: cardAt(t, s.kind, s.t0),
          track: trackFor(t),
          table: tableFor(site, t),
          drop: {open: dropOpen(t), sites: DROP, on: t > 25.2 ? 2 : 1},
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
