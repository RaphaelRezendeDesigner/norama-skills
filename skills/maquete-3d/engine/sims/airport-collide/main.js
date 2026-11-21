// Collision check for the toy airport: poses the world every 0.1 s and reports every pair of bodies whose
// oriented boxes overlap (jets as their fuselage only), every vehicle in a tree crown, every road vehicle in Cargo C's walls.
import * as THREE from 'three';
import {OBB} from 'three/addons/math/OBB.js';
import {runSim} from '../kit/runtime.js';
import {createToyStage} from '../airport-shared/style.js';
import {DUR, buildWorld} from '../airport-shared/world.js';

runSim({duration: 1, fps: 60, theme: 'light', hud: {enabled: false, title: 'c', subtitle: ''}, director: {enabled: false}, watermark: ''}, async ({canvas}) => {
  const st = createToyStage(canvas);
  const W = buildWorld();
  st.scene.add(W.root);
  W.root.updateMatrixWorld(true);
  const local = (g) => {
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
    const b = new THREE.Box3();
    g.traverse((o) => {
      if (!o.isMesh || !o.geometry || !o.visible) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      b.union(o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)));
    });
    return b;
  };
  const B = W.bodies.map((x) => {
    let box = local(x.g);
    if (x.kind === 'jet') box = new THREE.Box3(new THREE.Vector3(-23, 1.2, -3.6), new THREE.Vector3(23, 8.6, 3.6));
    const sh = box.getSize(new THREE.Vector3()).multiplyScalar(0.03);
    box.min.add(sh);
    box.max.sub(sh);
    return {...x, box};
  });
  const ok = new Set(['uld|hl', 'uld|dolly2', 'uld|fl2', 'tug|dolly0', 'dolly0|dolly1', 'dolly1|dolly2', 'bt21|bt21d0', 'bt21d0|bt21d1', 'pal|fl5', 'bridge0|jet0', 'bridge1|jet1', 'bridge2|jet2', 'hl|jet2', 'beltB12|jet2', 'uld|jet2', 'ct|jet0', 'beltB10|jet0'].map((k) => k.split('|').sort().join('|')));
  const key = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const hits = new Map();
  const note = (k, t) => {
    const h = hits.get(k) ?? {from: t, to: t, n: 0};
    h.to = t;
    h.n++;
    hits.set(k, h);
  };
  const obb = B.map(() => new OBB());
  for (let t = 0; t <= DUR; t += 0.1) {
    W.pose(t);
    W.root.updateMatrixWorld(true);
    B.forEach((b, i) => obb[i].fromBox3(b.box).applyMatrix4(b.g.matrixWorld));
    for (let i = 0; i < B.length; i++)
      for (let j = i + 1; j < B.length; j++) {
        const k = key(B[i].name, B[j].name);
        if (ok.has(k) || !B[i].g.visible || !B[j].g.visible) continue;
        if (obb[i].intersectsOBB(obb[j])) note(k, +t.toFixed(1));
      }
    B.forEach((b, i) => {
      if (b.kind) return;
      for (const tr of W.trees) if (obb[i].containsPoint(new THREE.Vector3(tr.x, 2, tr.z))) note(`${b.name}|tree@${tr.x.toFixed(0)},${tr.z.toFixed(0)}`, +t.toFixed(1));
      if (['trk', 'trk2', 'tug', 'dolly0', 'dolly1', 'dolly2', 'bt21', 'bt21d0', 'bt21d1', 'ct', 'pb'].includes(b.name)) {
        const c = obb[i].center;
        const cb = W.cargoBox;
        if (c.x > cb.x0 && c.x < cb.x1 && c.z > cb.z0 && c.z < cb.z1 - 0.5) note(`${b.name}|cargoC`, +t.toFixed(1));
      }
    });
  }
  console.log('COLLIDE ' + JSON.stringify([...hits.entries()].map(([k, h]) => `${k} ${h.from}-${h.to}s (${h.n})`)));
  return {resize() {}, render() { st.frame({tx: 0, ty: 0, tz: 0, az: 0.6, el: 0.6, d: 100}); return {}; }};
});
