// The toy car plant film: Plantline over the Northbay plant, cut like the toy airport. One camera at one
// angle (azimuth 38, elevation 36) that only pans and zooms; the story moves through clicks, the site switcher and its
// dropdown. 0-6 s cell C4 welds the hero; 6-13 the camera rides with it to paint; 13-19 booth 2 paints it; 19-21 the
// dropdown jumps to assembly; 23-33 wheels, seats, glass; 33-41 down the lift onto the rolling road; 41-46 out of the
// door and up the carrier's ramp; 46-50 home over the whole plant.
import * as THREE from 'three';
import {runSim} from '../kit/runtime.js';
import {TOY, createToyStage} from '../airport-shared/style.js';
import {toClaude, warmCss, warmHex} from '../airport-shared/look.js';
import {createToyUI} from '../airport-shared/ui.js';
import {createSelection} from '../airport-shared/select.js';
import {thumb} from '../airport-shared/thumbs.js';
import {OPERATOR_AVATAR} from '../airport-shared/avatar.js';
import {DUR, T, buildWorld} from './world.js';
import {buildToyAGV, buildToyCarCarrier} from './plant.js';
import {buildToyCarBody, buildToyDyno, buildToyRobot} from './line.js';

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
  brand: 'Plantline',
  search: 'Search VINs, robots, stations, AGVs...',
  user: ['Mila Novak', 'Plant Manager'],
  avatar: OPERATOR_AVATAR,
  kpis: [
    {ic: 'cube', k: 'Cars built today', key: 'a', v: '412', d: '+58', s: 'line 1 · Northbay'},
    {ic: 'truck', k: 'Robots running', key: 'b', v: '214', d: '+2', s: 'of 216 · 2 in service'},
    {ic: 'clock', k: 'First-pass yield', key: 'c', v: '97.8%', d: '+0.4%', s: 'last 30 days · line 1'},
  ],
};

const CLICKS = [
  {t: 1.6, at: 'car', card: 'car'},
  {t: 13.8, at: 'painter', card: 'paint'},
  {t: 19.4, ui: [1167, 37], drop: 'open'},
  {t: 20.8, ui: [930, 232], card: 'site'},
  {t: 23.8, at: 'agv', card: 'agv'},
  {t: 26.6, at: 'wheeler', card: 'wheel'},
  {t: 37.8, at: 'dyno', card: 'dyno'},
  {t: 41.8, at: 'car', card: 'car'},
  {t: 46.0, ui: [1159, 275], tool: 6, card: 'site'},
];
export const FILM_CLICKS = CLICKS.map((c) => c.t);

const AZ = 38;
const EL = 36;
const KEYS = [
  {t: 0, x: -57, z: 1, d: 66},
  {t: 5.8, x: -56, z: 1, d: 62},
  {t: 12.6, x: -16, z: 0, d: 66},
  {t: 19.0, x: -16, z: 0, d: 62},
  {t: 20.8, x: -16, z: 0, d: 62},
  {t: 23.2, x: 24, z: -6, d: 78},
  {t: 28.8, x: 24, z: -6, d: 74},
  {t: 30.6, x: 36, z: -2, d: 64},
  {t: 32.8, x: 36, z: -2, d: 62},
  {t: 35.4, x: 70, z: 0, d: 70},
  {t: 41.0, x: 72, z: 0, d: 66},
  {t: 45.0, x: 104, z: 2, d: 84},
  {t: 46.2, x: 104, z: 2, d: 84},
  {t: 48.8, x: 40, z: 16, d: 330},
  {t: DUR, x: 38, z: 16, d: 322},
];

const SITES = {
  BS: ['C4', 'Body shop · Cell C4', '4 robots · welding'],
  PT: ['P2', 'Paint · Booth 2', 'Ocean Blue · 3-coat'],
  AS: ['A2', 'Assembly · Station A2', 'Wheels · seats · glass'],
  QA: ['Q1', 'QA · Rolling road', '1 car · testing'],
  YD: ['Y', 'Yard · Carrier 24', '5/6 loaded'],
  PL: ['P1', 'Northbay Plant · Line 1', '4 zones · 58 jph'],
};
const DROP = [['C4', 'Body shop · Cell C4', '4 robots · welding', 92], ['P2', 'Paint · Booth 2', '1 body in booth', 70], ['A2', 'Assembly · Station A2', 'wheels · trim', 64], ['Q1', 'QA · Rolling road', '1 car testing', 40], ['Y', 'Yard · Carrier 24', '5/6 loaded', 83]];

// look 'claude': every blue goes to Claude's clay, the lavender to warm
// paper, the UI with it; the hero keeps its Ocean Blue paint (setPaint re-applies it every frame), the one blue on the map.
export function runToyPlantFilm({look = 'blue'} = {}) {
  const claude = look === 'claude';
  return runSim({duration: DUR, fps: 60, theme: 'light', hud: {enabled: false, title: 'plantline', subtitle: ''}, director: {enabled: false}, watermark: ''}, async ({canvas, capture}) => {
    const app = document.getElementById('app');
    const st = createToyStage(canvas, {fov: 28});
    const W = buildWorld();
    st.scene.add(W.root);
    const ui = createToyUI(app, UI_WORDS, claude ? {paint: warmCss} : {});
    const sel = createSelection(st.scene, st);
    if (claude) {
      toClaude(st.scene);
      st.scene.background.set(warmHex(TOY.bg));
      st.scene.fog.color.set(warmHex(TOY.bg));
    }
    const paintGroup = (g) => {
      if (claude) toClaude(g);
      return g;
    };
    const fit = () => (app.style.transform = `scale(${Math.min(innerWidth / 1600, innerHeight / 900)})`);
    const resize = () => {
      fit();
      st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    };
    resize();

    const car = (() => {
      const c = buildToyCarBody({color: TOY.blue, number: 'NB7E 004812'});
      c.setBuild(1);
      c.setPaint(1);
      c.setGlass(1);
      c.setWheels(1);
      c.setInterior(1);
      return c.group;
    })();
    const TH = {
      car: thumb(car),
      paint: thumb(paintGroup(buildToyRobot({tool: 'paint', number: '07'}).group)),
      wheel: thumb(paintGroup(buildToyRobot({tool: 'wheel', number: '05'}).group)),
      agv: thumb(paintGroup(buildToyAGV({number: '12', rack: 'seats'}).group)),
      dyno: thumb(paintGroup(buildToyDyno().group), {pad: 0.95}),
      carrier: thumb(paintGroup(buildToyCarCarrier({livery: 'aurora', number: '24'}).group), {pad: 0.9}),
      weld: thumb(paintGroup(buildToyRobot({tool: 'weld', number: '01'}).group)),
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
      const arc = far > 40 ? 0.3 * Math.sin(Math.PI * k) : 0;
      return {x: lerp(a.x, b.x, k), z: lerp(a.z, b.z, k), d: lerp(a.d, b.d, k) * (1 + arc)};
    };
    const camAt = (t) => {
      const c = keyCam(t);
      // the camera rides along with the body to paint, and out to the carrier
      const w1 = ss(5.8, 7.2, t) * (1 - ss(11.6, 12.8, t));
      const w2 = ss(41.0, 42.2, t) * (1 - ss(44.6, 45.6, t));
      const w = Math.max(w1, w2);
      if (w > 0) {
        const p = P(W.objects.hero.group);
        c.x = lerp(c.x, p.x + 2, w);
        c.z = lerp(c.z, p.z + 2, w);
        c.d = lerp(c.d, w2 > w1 ? 80 : 70, w);
      }
      return c;
    };

    // ---------------------------------------------------------- what the page shows
    const siteAt = (t) => (t < 12.6 ? 'BS' : t < 20.8 ? 'PT' : t < 35.4 ? 'AS' : t < 43.6 ? 'QA' : t < 46.0 ? 'YD' : 'PL');
    const wheelsOn = (t) => (t >= T.fitFL) + (t >= T.fitFR) + (t >= T.fitRL) + (t >= T.fitRR);
    const stageOf = (t) =>
      t < T.toPaint[0] ? ['Welding', 'Cell C4 · 4 robots', 'in'] :
      t < T.spray[0] ? ['To paint', 'Line 1 · to booth 2', 'in'] :
      t < T.boothOut[1] ? ['Painting', 'Booth 2 · Ocean Blue', 'in'] :
      t < T.toWheels[1] ? ['To assembly', 'Line 1 · to station A2', 'in'] :
      t < T.toTrim[0] ? ['Wheels', `Station A2 · ${wheelsOn(t)}/4 on`, 'in'] :
      t < T.toEnd[0] ? ['Trim', 'Station A2 · seats, glass', 'in'] :
      t < T.test[0] ? ['To QA', 'Lift · rolling road', 'in'] :
      t < T.test[1] ? ['Testing', 'QA 01 · rolling road', 'in'] :
      t < T.out[1] ? ['Shipping', 'To carrier 24 · slot 3', 'go'] : ['Loaded', 'Carrier 24 · slot 3', 'go'];
    const progress = (t) => clamp(t / T.out[1]);
    const cardAt = (t, kind, t0) => {
      const pop = ss(t0, t0 + 0.35, t);
      const pc = (a, b) => clamp((t - a) / (b - a));
      if (kind === 'car') {
        const [s, txt, cls] = stageOf(t);
        return {pop, thumb: TH.car, org: 'LINE 1 · NORTHBAY', title: 'NB7E 004812', sub: 'Model E · Ocean Blue', stat: s, statCls: cls, statText: txt, prog: progress(t), progText: `${Math.round(100 * progress(t))}%`, rows: [['Welds', `${fmt(4312 * pc(...T.weld))} / 4,312`], ['Paint', t < T.paint[0] ? 'E-coat' : t < T.paint[1] ? `${Math.round(100 * pc(...T.paint))}%` : 'Ocean Blue'], ['Wheels', `${wheelsOn(t)} / 4`], ['Battery', '62%'], ['Order', 'Dealer · Oslo', 1], ['Ship', t < T.out[1] ? 'Carrier 24 · 11:40' : 'Aboard · 11:40']]};
      }
      if (kind === 'paint') {
        const film = Math.round(118 * pc(...T.paint));
        return {pop, thumb: TH.paint, org: 'PAINT · BOOTH 2', title: 'R-07', sub: 'Paint robot · bell atomiser', stat: t < T.spray[1] ? 'Spraying' : 'Done', statCls: t < T.spray[1] ? 'in' : 'go', statText: 'NB7E 004812 · Ocean Blue', prog: pc(...T.paint), progText: `${film} µm`, rows: [['Colour', 'Ocean Blue · 3-coat'], ['Bell speed', '45,000 rpm'], ['Film', `${film} µm`], ['Flow', '380 ml/min'], ['Booth', '23.1 °C · 65% RH']]};
      }
      if (kind === 'agv') {
        const moving = t < T.agv[1];
        return {pop, thumb: TH.agv, org: 'INTRALOGISTICS', title: 'AGV-12', sub: 'Automated cart · seats', stat: moving ? 'Delivering' : 'Arrived', statCls: moving ? 'in' : 'go', statText: 'To station A2 · trim', prog: pc(...T.agv), progText: moving ? `${Math.max(1, Math.round(T.agv[1] - t))} s` : 'docked', rows: [['Load', 'Seats · set 4812', 1], ['Speed', moving ? '5 km/h' : '0 km/h'], ['Battery', '81%'], ['Mode', 'Autonomous'], ['Next', 'Racks · tyres']]};
      }
      if (kind === 'wheel') {
        const n = wheelsOn(t);
        return {pop, thumb: TH.wheel, org: 'ASSEMBLY · STATION A2', title: 'R-05', sub: 'Wheel robot · nutrunner', stat: n < 4 ? 'Fitting' : 'Done', statCls: n < 4 ? 'in' : 'go', statText: `NB7E 004812 · ${n}/4 wheels`, prog: n / 4, progText: `${n}/4`, rows: [['Wheel', '19-inch · 245/45'], ['Nuts', `${n * 5} / 20`], ['Torque', '140 Nm'], ['Angle check', n ? 'OK' : '—'], ['Cycle', '42 s']]};
      }
      if (kind === 'dyno') {
        const u = pc(...T.test);
        return {pop, thumb: TH.dyno, org: 'QUALITY · QA 01', title: 'Rolling road', sub: 'NB7E 004812 · end-of-line test', stat: t < T.test[1] ? 'Testing' : 'Passed', statCls: t < T.test[1] ? 'in' : 'go', statText: 'Brakes · ABS · lights · alignment', prog: u, progText: `${Math.round(100 * u)}%`, rows: [['Roller speed', t > T.test[0] && t < T.test[1] ? `${Math.round(120 * Math.sin(Math.PI * u))} km/h` : '0 km/h'], ['Brakes', u > 0.6 ? 'Pass' : 'Testing'], ['ABS', u > 0.8 ? 'Pass' : 'Queued'], ['Lights', u > 0.3 ? 'Pass' : 'Queued'], ['Alignment', 'Pass']]};
      }
      const site = siteAt(t);
      if (site === 'YD') return {pop, thumb: TH.carrier, org: 'YARD · CARRIER 24', title: 'Carrier 24', sub: 'To port · Northbay Aurora', stat: t < T.out[1] ? 'Loading' : 'Loaded', statCls: t < T.out[1] ? 'in' : 'go', statText: `${t < T.out[1] ? 5 : 6}/6 cars`, prog: t < T.out[1] ? 5 / 6 : 1, progText: `${t < T.out[1] ? 5 : 6}/6`, rows: [['Cars', `${t < T.out[1] ? 5 : 6} / 6`], ['Ramp', t < T.rampUp[0] ? 'Down' : 'Up'], ['ETA port', '11:40'], ['Driver', 'Ready']]};
      if (site === 'AS') return {pop, thumb: TH.wheel, org: 'ASSEMBLY · LINE 1', title: 'Station A2', sub: 'Wheels · seats · glass', stat: 'Running', statCls: 'go', statText: 'Takt 62 s · 2 robots · 1 AGV', prog: 0.64, progText: '64%', rows: [['Cars on line', '5'], ['Takt', '62 s'], ['Andon', 'Clear'], ['Parts', 'Seats · lot 2219'], ['AGVs', '3 active']]};
      if (site === 'PT') return {pop, thumb: TH.paint, org: 'PAINT · BOOTH 2', title: 'Booth 2', sub: '2 robots · down-draft', stat: 'Running', statCls: 'go', statText: '1 body · Ocean Blue', prog: 0.7, progText: '70%', rows: [['Air', '0.35 m/s down-draft'], ['Temperature', '23.1 °C'], ['Humidity', '65% RH'], ['Next', 'Cure oven · 140 °C']]};
      return {pop, thumb: TH.weld, org: 'NORTHBAY PLANT', title: site === 'BS' ? 'Cell C4' : 'Line 1', sub: site === 'BS' ? 'Body framing · 4 robots' : 'Body → Paint → Assembly → QA', stat: 'Running', statCls: 'go', statText: site === 'BS' ? '4 robots welding · 0 faults' : '58 jph · 214 robots', prog: 0.71, progText: '71%', rows: [['Line rate', '58 jph'], ['Cars on line', '214'], ['Robots running', '214 / 216'], ['Andon', '0 open'], ['Shift', 'B · 06:00-14:00']]};
    };
    const selection = (t) => {
      let cur = {kind: 'site', t0: -1};
      for (const c of CLICKS) if (c.card && t >= c.t) cur = {kind: c.card, t0: c.t};
      return cur;
    };
    const SEL_OBJ = {car: W.objects.hero.group, paint: W.objects.painter.group, agv: W.objects.agv.group, wheel: W.objects.wheeler.group, dyno: W.objects.dyno.group};
    const SEL_ANCHOR = {car: 'car', paint: 'painter', agv: 'agv', wheel: 'wheeler', dyno: 'dyno'};
    const SEL_TEXT = (kind, t) => ({car: ['NB7E 004812', stageOf(t)[0]], paint: ['R-07', t < T.spray[1] ? 'Spraying' : 'Done'], agv: ['AGV-12', t < T.agv[1] ? 'Delivering' : 'Arrived'], wheel: ['R-05', wheelsOn(t) < 4 ? 'Fitting' : 'Done'], dyno: ['QA 01', t < T.test[1] ? 'Testing' : 'Passed']})[kind];
    const ROUTE = {car: (t) => W.routes.car(t), agv: (t) => (t < T.agv[1] ? W.routes.agv(t) : null)};

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
    const dropOpen = (t) => ss(19.4, 19.7, t) * (1 - ss(20.85, 21.1, t));
    const kpiFor = (site, t) => ({
      a: [fmt(412 + (t >= T.out[1] ? 1 : 0)), '+58', site === 'BS' ? 'body shop · line 1' : site === 'PT' ? 'paint · line 1' : site === 'AS' ? 'assembly · line 1' : site === 'QA' ? 'QA · line 1' : 'shipped · line 1'],
      b: ['214', '+2', 'of 216 · 2 in service'],
      c: ['97.8%', '+0.4%', 'last 30 days · line 1'],
    });
    const trackFor = (t) => {
      const st2 = (a, b) => (t < a ? '' : t < b ? 'on' : 'done');
      const steps = [['Body', 'Cell C4', 'box', st2(0, T.toPaint[0])], ['Paint', 'Booth 2', 'load', st2(T.toPaint[0], T.boothOut[1])], ['Assembly', 'Station A2', 'doc', st2(T.boothOut[1], T.toEnd[0])], ['Quality', 'QA 01', 'check', st2(T.toEnd[0], T.test[1])], ['Shipped', 'Carrier 24', 'truck', t < T.test[1] ? '' : 'on']];
      const fill = t < T.toPaint[0] ? 0.04 : t < T.boothOut[1] ? 0.25 : t < T.toEnd[0] ? 0.5 : t < T.test[1] ? 0.75 : 1;
      const [s, txt, cls] = stageOf(t);
      return {title: 'Build Tracking', meta: 'VIN NB7E 004812 · Model E', fill, steps, ship: {thumb: TH.car, id: 'NB7E 004812', to: 'To: Dealer Oslo · Carrier 24', stat: s, statCls: cls, meta: txt}};
    };
    const tableFor = (site, t) => {
      if (site === 'BS' || site === 'PL')
        return {tabs: [['Cells', '6/6'], ['Robots', '24'], ['AGVs', '18']], active: 1, site: 'Body shop', rows: [
          {id: 'R-01', org: 'Cell C4', dot: TOY.blue, where: 'Side frame L', stat: t < T.weld[1] ? 'Welding' : 'Idle', cls: t < T.weld[1] ? 'go' : 'wait', p: 100 * clamp(t / T.weld[1]), pt: `${Math.round(100 * clamp(t / T.weld[1]))}%`},
          {id: 'R-02', org: 'Cell C4', dot: TOY.blue, where: 'Side frame R', stat: t < T.weld[1] ? 'Welding' : 'Idle', cls: t < T.weld[1] ? 'go' : 'wait', p: 100 * clamp(t / T.weld[1]), pt: `${Math.round(100 * clamp(t / T.weld[1]))}%`},
          {id: 'R-21', org: 'Cell C5', dot: TOY.teal, where: 'Line 2 · roof', stat: 'Welding', cls: 'go', p: 40, pt: '40%'},
          {id: 'P-01', org: 'Press line', dot: TOY.orange, where: 'Door outer RH', stat: 'Stamping', cls: 'in', p: null, pt: '18/min'},
        ]};
      if (site === 'PT')
        return {tabs: [['Booths', '2/2'], ['Robots', '4'], ['Ovens', '1']], active: 1, site: 'Paint', rows: [
          {id: 'R-07', org: 'Booth 2', dot: TOY.blue, where: 'Roof · bonnet', stat: t < T.spray[1] ? 'Spraying' : 'Done', cls: 'go', p: 100 * clamp((t - T.paint[0]) / 3.6), pt: `${Math.round(118 * clamp((t - T.paint[0]) / 3.6))} µm`},
          {id: 'R-08', org: 'Booth 2', dot: TOY.blue, where: 'Sides · boot', stat: t < T.spray[1] ? 'Spraying' : 'Done', cls: 'go', p: 100 * clamp((t - T.paint[0]) / 3.6), pt: `${Math.round(118 * clamp((t - T.paint[0]) / 3.6))} µm`},
          {id: 'OV-1', org: 'Cure oven', dot: TOY.orange, where: '140 °C', stat: 'Ready', cls: 'wait', p: null, pt: '20 min'},
          {id: 'B-1', org: 'Booth 1', dot: TOY.teal, where: 'Arctic White', stat: 'Cleaning', cls: 'in', p: null, pt: '4 min'},
        ]};
      if (site === 'AS')
        return {tabs: [['Stations', '8/8'], ['Robots', '12'], ['AGVs', '3']], active: 2, site: 'Assembly', rows: [
          {id: 'AGV-12', org: 'Seats', dot: TOY.blue, where: t < T.agv[1] ? 'To A2' : 'At A2', stat: t < T.agv[1] ? 'Delivering' : 'Docked', cls: t < T.agv[1] ? 'in' : 'go', p: null, pt: t < T.agv[1] ? `${Math.max(1, Math.round(T.agv[1] - t))} s` : 'docked'},
          {id: 'AGV-14', org: 'Boxes', dot: TOY.teal, where: 'Aisle 3', stat: 'En route', cls: 'in', p: null, pt: 'loop'},
          {id: 'R-05', org: 'Station A2', dot: TOY.blue, where: 'Wheels', stat: wheelsOn(t) < 4 ? 'Fitting' : 'Done', cls: 'go', p: 25 * wheelsOn(t), pt: `${wheelsOn(t)}/4`},
          {id: 'R-09', org: 'Station A2', dot: TOY.blue, where: 'Seats · glass', stat: t < T.glass[1] ? 'Waiting' : 'Done', cls: t < T.glass[1] ? 'wait' : 'go', p: null, pt: t < T.glass[1] ? 'next' : 'done'},
        ]};
      return {tabs: [['Tests', '3/3'], ['Carriers', '2'], ['Yard', '48']], active: 0, site: site === 'YD' ? 'Yard' : 'QA', rows: [
        {id: 'QA 01', org: 'Rolling road', dot: TOY.blue, where: 'NB7E 004812', stat: t < T.test[1] ? 'Testing' : 'Passed', cls: t < T.test[1] ? 'in' : 'go', p: 100 * clamp((t - T.test[0]) / (T.test[1] - T.test[0])), pt: t < T.test[1] ? 'run' : 'pass'},
        {id: 'QA 02', org: 'Water test', dot: TOY.teal, where: 'NB7E 004809', stat: 'Passed', cls: 'go', p: 100, pt: 'pass'},
        {id: 'CR-24', org: 'Carrier 24', dot: TOY.blue, where: 'Yard · ramp', stat: t < T.out[1] ? 'Loading' : 'Loaded', cls: t < T.out[1] ? 'in' : 'go', p: t < T.out[1] ? 83 : 100, pt: t < T.out[1] ? '5/6' : '6/6'},
        {id: 'CR-31', org: 'Carrier 31', dot: TOY.orange, where: 'To plant', stat: 'At gate', cls: 'wait', p: null, pt: '6 min'},
      ]};
    };
    const underUI = ([x, y]) => (x > 1130 && y < 450) || (x > 1080 && y > 620) || (x < 1000 && y > 720) || (x < 780 && y < 185);
    const pinsAt = (t) => {
      const out = [];
      const pin = (v, a = 1) => {
        const s = proj(v);
        if (s && s[0] > 20 && s[0] < 1580 && s[1] > 80 && s[1] < 880 && !underUI(s)) out.push({kind: 'pin', x: s[0], y: s[1], a});
      };
      if (t < 1.6) pin(W.anchors.car(), 1 - ss(1.3, 1.6, t));
      if (t > 5.8 && t < 13.8) pin(W.anchors.booth(), ss(5.8, 6.2, t) * (1 - ss(13.4, 13.8, t)));
      if (t > 22.0 && t < 23.8) pin(W.anchors.rack(), ss(22, 22.4, t) * (1 - ss(23.4, 23.8, t)));
      if (t > 34.6 && t < 37.8) pin(W.anchors.dyno(), ss(34.6, 35, t) * (1 - ss(37.4, 37.8, t)));
      if (t > 41.8 && t < 45.4) pin(W.anchors.carrier(), ss(41.8, 42.2, t) * (1 - ss(45, 45.4, t)));
      return out;
    };

    window.TOYPLANT = {st, W, camAt};
    return {
      resize,
      render(t) {
        W.pose(t);
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
          const a = proj(W.anchors[SEL_ANCHOR[s.kind]]());
          const [txt, sub] = SEL_TEXT(s.kind, t);
          if (a && !underUI(a)) tags.push({kind: 'sel', x: a[0], y: a[1], text: txt, sub, a: fadeIn});
        }
        const cur = cursorAt(t);
        let tool = -1;
        for (const cl of CLICKS) if (cl.tool != null && t >= cl.t && t < cl.t + 0.6) tool = cl.tool;
        ui.update({
          clock: `10:${String(14 + Math.floor(t / 7)).padStart(2, '0')}`,
          site: SITES[site],
          kpi: kpiFor(site, t),
          card: cardAt(t, s.kind, s.t0),
          track: trackFor(t),
          table: tableFor(site, t),
          drop: {open: dropOpen(t), sites: DROP, on: t > 20.2 ? 2 : 1},
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
