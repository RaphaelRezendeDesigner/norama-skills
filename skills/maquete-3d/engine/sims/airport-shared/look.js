// The Claude look for the port (and the systems after it): the brand blue becomes Claude's clay (#d97757), the cool
// greys of the ground, panels and sky turn warm, navy turns to warm charcoal. Works on a built scene (materials,
// lights, instance and vertex colours, canvas textures) and on hex strings (the UI's CSS and icons). A mesh with
// userData.keepColor is left alone (the water, the hero box). Colours are judged in sRGB HSL, the way they were picked.
import * as THREE from 'three';

export const CLAY = '#d97757';
// the stacks by weight (PALETTE_WEIGHTS .3/.26/.18/.14/.08/.04): cream, warm grey, clay, charcoal, light clay, sand.
// Clay ran at .38 in the first test and the wide shot read busy, so cream and grey lead now.
export const CLAUDE_PALETTE = ['#f4f1ea', '#d9d2c5', '#d97757', '#3a3632', '#e9a988', '#c9b48f'];
// one blue box among them: the item the film follows
export const CLAUDE_HERO = '#2f5f9e';

const hsl = {};
/** remap one colour in place; returns true if it changed. warm = false (the cool variant) keeps the cool
 *  greys and whites as they are and only turns the blues to clay. */
export function claudeColor(c, warm = true) {
  c.getHSL(hsl, THREE.SRGBColorSpace);
  const {h, s, l} = hsl;
  const blue = h > 0.53 && h < 0.75;
  if (!blue) return false;
  if (s > 0.42 && l > 0.2 && l < 0.85) {
    // brand blue -> clay, light blue -> light clay, deep blue -> deep clay
    c.setHSL(0.042, Math.min(0.56, 0.32 + 0.3 * s), Math.min(0.8, Math.max(0.36, l * 1.07)), THREE.SRGBColorSpace);
    return true;
  }
  if (warm && l > 0.55) {
    // cool light greys and whites -> warm paper
    c.setHSL(0.11, Math.min(0.32, 0.6 * s + 0.08 * (l > 0.9 ? 1 : 0.6)), l, THREE.SRGBColorSpace);
    return true;
  }
  if (s > 0.18 && l < 0.4) {
    // navy -> warm charcoal
    c.setHSL(0.08, 0.07, l, THREE.SRGBColorSpace);
    return true;
  }
  return false;
}

const tmp = new THREE.Color();
export function warmHex(hex, warm = true) {
  tmp.set(hex);
  return claudeColor(tmp, warm) ? '#' + tmp.getHexString(THREE.SRGBColorSpace) : hex;
}
/** every #rrggbb in a string (CSS, inline SVG) */
export const warmCss = (s, warm = true) => s.replace(/#[0-9a-fA-F]{6}\b/g, (m) => warmHex(m, warm));

/** the whole built scene, once */
export function toClaude(root, {warm = true} = {}) {
  const seenMat = new Set();
  const seenTex = new Set();
  root.traverse((o) => {
    if (o.userData.keepColor) return;
    if (o.isLight) {
      if (o.color) claudeColor(o.color, warm);
      if (o.groundColor) claudeColor(o.groundColor, warm);
      return;
    }
    const ca = o.geometry?.attributes?.color;
    if (ca && !o.geometry.userData.claude) {
      o.geometry.userData.claude = true;
      for (let i = 0; i < ca.count; i++) {
        tmp.setRGB(ca.getX(i), ca.getY(i), ca.getZ(i));
        if (claudeColor(tmp, warm)) ca.setXYZ(i, tmp.r, tmp.g, tmp.b);
      }
      ca.needsUpdate = true;
    }
    if (o.isInstancedMesh && o.instanceColor && !o.userData.claude) {
      o.userData.claude = true;
      for (let i = 0; i < o.count; i++) {
        o.getColorAt(i, tmp);
        if (claudeColor(tmp, warm)) o.setColorAt(i, tmp);
      }
      o.instanceColor.needsUpdate = true;
    }
    for (const m of [].concat(o.material || [])) {
      if (seenMat.has(m)) continue;
      seenMat.add(m);
      for (const key of ['color', 'emissive', 'attenuationColor', 'sheenColor']) if (m[key]?.isColor) claudeColor(m[key], warm);
      const tex = m.map;
      const img = tex?.image;
      if (img?.getContext && !seenTex.has(tex)) {
        seenTex.add(tex);
        const cx = img.getContext('2d');
        const px = cx.getImageData(0, 0, img.width, img.height);
        const d = px.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] === 0) continue;
          tmp.setRGB(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255, THREE.SRGBColorSpace);
          if (!claudeColor(tmp, warm)) continue;
          tmp.getRGB(tmp, THREE.SRGBColorSpace);
          d[i] = Math.round(tmp.r * 255);
          d[i + 1] = Math.round(tmp.g * 255);
          d[i + 2] = Math.round(tmp.b * 255);
        }
        cx.putImageData(px, 0, 0);
        tex.needsUpdate = true;
      }
    }
  });
}
