// A free camera on the toy airport world, for checks: --config {"cam": {...}, "at": t}.
import {runSim} from '../kit/runtime.js';
import {createToyStage} from '../airport-shared/style.js';
import {buildWorld} from '../airport-shared/world.js';

runSim({duration: 50, fps: 60, theme: 'light', hud: {enabled: false, title: 'l', subtitle: ''}, director: {enabled: false}, watermark: '', cam: {tx: 76, ty: 3, tz: 44, az: 20, el: 12, d: 46, fov: 28}, at: null}, async ({cfg, canvas}) => {
  const st = createToyStage(canvas, {fov: cfg.cam.fov});
  const W = buildWorld();
  st.scene.add(W.root);
  const D2R = Math.PI / 180;
  return {
    resize() { st.resize(1600, 900, 1); },
    render(t) {
      W.pose(cfg.at ?? t);
      const c = cfg.cam;
      st.frame({tx: c.tx, ty: c.ty, tz: c.tz, az: c.az * D2R, el: c.el * D2R, d: c.d, fov: c.fov});
      return {};
    },
  };
});
