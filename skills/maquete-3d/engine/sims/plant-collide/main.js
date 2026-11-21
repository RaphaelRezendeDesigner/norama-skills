// Collision check for the toy airport: poses the world every 0.1 s and reports every pair of bodies whose
// oriented boxes overlap (jets as their fuselage only), every vehicle in a tree crown, every road vehicle in Cargo C's walls.
import * as THREE from 'three';
import {OBB} from 'three/addons/math/OBB.js';
import {runSim} from '../kit/runtime.js';
import {createToyStage} from '../airport-shared/style.js';
import {DUR, buildWorld} from '../plant-shared/world.js';

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
    
    const sh = box.getSize(new THREE.Vector3()).multiplyScalar(0.03);
    box.min.add(sh);
    box.max.sub(sh);
    return {...x, box};
  });
  const ok = new Set(['hero|skid', 'hero|weld0', 'hero|weld1', 'hero|weld2', 'hero|weld3', 'hero|paint0', 'hero|paint1', 'hero|wheel0', 'hero|wheel1', 'hero|grip', 'hero|dyno', 'hero|carrier', 'hero|lift', 'skid|lift', 'agv|grip', 'fork|pal', 'line2car3|fitter2', 'line2car4|fitter2', 'line2car1|weld2_0', 'line2car1|weld2_1'].map((k) => k.split('|').sort().join('|')));
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
      for (const tr of W.trees ?? []) if (obb[i].containsPoint(new THREE.Vector3(tr.x, 2, tr.z))) note(`${b.name}|tree@${tr.x.toFixed(0)},${tr.z.toFixed(0)}`, +t.toFixed(1));
      if (false) {
        const c = obb[i].center;
        const cb = W.cargoBox;
        if (c.x > cb.x0 && c.x < cb.x1 && c.z > cb.z0 && c.z < cb.z1 - 0.5) note(`${b.name}|cargoC`, +t.toFixed(1));
      }
    });
  }
  console.log('COLLIDE ' + JSON.stringify([...hits.entries()].map(([k, h]) => `${k} ${h.from}-${h.to}s (${h.n})`)));
  return {resize() {}, render() { st.frame({tx: 0, ty: 0, tz: 0, az: 0.6, el: 0.6, d: 100}); return {}; }};
});
