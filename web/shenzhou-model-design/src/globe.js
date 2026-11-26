// ============================================================================
// globe.js —— 程序化真实地球贴图生成器（纯函数、无副作用、按需调用）
// ----------------------------------------------------------------------------
// 组成：高程场（域扭曲 fbm）→ 海陆划分 → 海洋深度渐变 → 纬度生物群区 → 山地/雪线
//       → 极地冰盖 → 地形晕渲（浮雕）→ 法线/粗糙度图；另有云层与瑞利大气边缘。
// 设计：
//  1) 无外部资源，全部由确定性值噪声生成（种子固定 → 每次结果一致）。
//  2) 经度方向无缝：采样域取单位圆 (cos lon, sin lon)，避免接缝。
//  3) 分辨率可选：轨道近距离用 1024×512，发射场景远景用 512×256（约 1/4 耗时）。
//  4) 只导出生成器，不在模块加载时生成任何贴图（避免拖慢首帧；由调用方按需调用）。
// ============================================================================
import * as THREE from 'three';

// ---- 小工具 ----
const clamp01 = (v) => v < 0 ? 0 : (v > 1 ? 1 : v);
function sstep(a, b, x) { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }
function lerp(a, b, t) { return a + (b - a) * t; }
function mixc(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }

/** 确定性值噪声 fbm（经度无缝） */
export function makeFbm(seed) {
  let s = (seed | 0) || 1;
  const hash = (x, y) => {
    let h = (x * 374761393 + y * 668265263 + s * 1274126177) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const n2 = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  };
  return function fbm(x, y, oct = 5) {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { sum += n2(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2.03; }
    return sum / norm;
  };
}

// ---- 调色板（贴近真实地球色：深海靛蓝 / 陆缘青绿 / 雨林深绿 / 荒漠赭黄 / 极地冰白）----
const PAL = {
  abyss: [5, 22, 52], deep: [8, 38, 76], mid: [14, 62, 104], shelf: [24, 96, 138], shore: [46, 138, 150],
  rainDark: [22, 58, 32], rainforest: [34, 78, 40], savanna: [122, 126, 68], desert: [188, 162, 112],
  dune: [206, 182, 134], steppe: [128, 130, 84], temperate: [64, 96, 52], boreal: [44, 72, 46],
  tundra: [116, 116, 106], rock: [124, 118, 110], rockDark: [96, 92, 88],
  snow: [236, 240, 244], iceLand: [232, 238, 244], iceSea: [214, 226, 236],
};

/**
 * 地球表面贴图（颜色 + 粗糙度 + 法线 + 高程）
 * @param {Object} o  { w, h, seed, seaLevel(可选 0~1，越大陆地越少), relief(浮雕强度) }
 * @returns {Object} { map, rough, normal, heightCanvas }
 */
export function buildEarthSurface(o) {
  const opt = o || {};
  const W = Math.max(64, opt.w || 1024), H = Math.max(32, opt.h || 512);
  const seed = opt.seed || 20260927;
  const seaLevel = (typeof opt.seaLevel === 'number') ? opt.seaLevel : 0.52;   // 海平面阈值（陆≈29%）
  const relief = (typeof opt.relief === 'number') ? opt.relief : 1.0;

  const fbmA = makeFbm(seed), fbmB = makeFbm(seed + 1013), fbmC = makeFbm(seed + 7717);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); const img = x.createImageData(W, H);
  const rc = document.createElement('canvas'); rc.width = W; rc.height = H;
  const rx = rc.getContext('2d'); const rimg = rx.createImageData(W, H);
  const hc = document.createElement('canvas'); hc.width = W; hc.height = H;
  const hx = hc.getContext('2d'); const himg = hx.createImageData(W, H);

  // 高程场（先算一遍，供晕渲/法线使用）
  const elev = new Float32Array(W * H);
  for (let j = 0; j < H; j++) {
    const lat = (0.5 - j / H) * Math.PI;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < W; i++) {
      const lon = (i / W) * Math.PI * 2;
      const cx = Math.cos(lon), sx = Math.sin(lon);
      // 域扭曲：让大陆轮廓自然曲折（而非圆形噪声团）
      const wx = fbmB(cx * 1.2 + sl * 0.7 + 11.3, sx * 1.2 - cl * 0.6 + 5.1, 4);
      const wy = fbmC(cx * 1.2 - sl * 0.6 + 2.7, sx * 1.2 + cl * 0.7 - 8.4, 4);
      const cont = fbmA(cx * 2.1 + wx * 0.9, sx * 2.1 + wy * 0.9 + sl * 1.25, 6);
      const detail = fbmB(cx * 7.5 + 3.1, sx * 7.5 - sl * 2.2, 3);
      elev[j * W + i] = cont * 0.9 + detail * 0.1;
    }
  }

  for (let j = 0; j < H; j++) {
    const lat = (0.5 - j / H) * Math.PI;
    const alat = Math.abs(lat);                       // 0 赤道 → π/2 极点
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < W; i++) {
      const lon = (i / W) * Math.PI * 2;
      const cx = Math.cos(lon), sx = Math.sin(lon);
      const e = elev[j * W + i];
      const dry = fbmB(cx * 3.1 + 19.1, sx * 3.1 + sl * 0.9 - 5.2, 4);      // 干旱度
      const det = fbmC(cx * 11 + 3, sx * 11 - 8, 3);
      const p = (j * W + i) * 4;
      const idx = j * W + i;
      // 地形晕渲：用高程梯度做光照浮雕（相邻像素差分），给陆地/海底加立体感
      const eL = elev[j * W + ((i - 1 + W) % W)], eR = elev[j * W + ((i + 1) % W)];
      const eU = elev[Math.max(0, j - 1) * W + i], eD = elev[Math.min(H - 1, j + 1) * W + i];
      const gx = (eR - eL) * 26 * relief, gy = (eD - eU) * 26 * relief;
      // 光从西北方向来（与场景太阳方向一致）
      const shade = clamp01(1 + (gx * -0.62 + gy * -0.62) * 0.5);

      let col, rough;
      const iceEdge = alat + (e - 0.5) * 0.22 + (det - 0.5) * 0.10;   // 噪声扰动的冰盖边界
      if (iceEdge > 1.24) {
        // 极地冰盖：南极陆冰更白更厚，北极海冰略灰蓝
        const isLandIce = e > seaLevel;
        col = isLandIce ? mixc(PAL.iceLand, PAL.snow, det) : mixc(PAL.iceSea, PAL.iceLand, 0.5 + det * 0.5);
        const shIce = 1 - (1 - shade) * (1 - Math.max(0, (alat - 1.10) * 3.2));   // 纬度越高越不受浮雕影响
        col = mixc([col[0] * 0.5, col[1] * 0.5, col[2] * 0.5], col, Math.min(1, Math.max(0, shIce)));
        rough = 200;
      } else if (e < seaLevel) {
        // 海洋：按离岸远近做深度渐变（深海靛蓝 → 陆架青绿）
        const d = clamp01((seaLevel - e) / 0.30);                 // 0 近岸 → 1 深海
        let base = d > 0.55 ? mixc(PAL.mid, PAL.abyss, (d - 0.55) / 0.45)
          : (d > 0.22 ? mixc(PAL.shelf, PAL.mid, (d - 0.22) / 0.33)
            : mixc(PAL.shore, PAL.shelf, d / 0.22));
        base = mixc(base, PAL.deep, sstep(0.75, 1.0, d));
        // 海面轻微色斑（洋流/浮游物），避免死板纯色
        base = mixc(base, [base[0] * 1.18, base[1] * 1.12, base[2] * 1.05], clamp01((det - 0.45) * 1.2));
        col = base; rough = 105;                                   // 半光滑：保留海面波光但不糊成白斑
      } else {
        // 陆地：按纬度 + 干旱度选生物群区
        const h = clamp01((e - seaLevel) / 0.34);                  // 海拔 0~1
        let base;
        if (alat < 0.26) base = mixc(PAL.rainforest, PAL.rainDark, dry);                  // 赤道雨林
        else if (alat < 0.58) base = dry > 0.56 ? mixc(PAL.desert, PAL.dune, sstep(0.56, 0.8, dry))
          : mixc(PAL.savanna, PAL.steppe, sstep(0.3, 0.6, dry));                          // 副热带荒漠/稀树草原
        else if (alat < 0.92) base = mixc(PAL.temperate, PAL.boreal, sstep(0.58, 0.92, alat));  // 温带→针叶林
        else base = mixc(PAL.boreal, PAL.tundra, sstep(0.92, 1.15, alat));                // 苔原
        base = mixc(base, [base[0] * 1.1, base[1] * 1.05, base[2] * 0.95], clamp01((det - 0.5) * 1.4));
        // 山地：岩石 → 雪线
        col = mixc(base, PAL.rock, sstep(0.42, 0.72, h));
        col = mixc(col, PAL.rockDark, sstep(0.72, 0.88, h) * (1 - sstep(0.88, 0.96, h)));
        if (h > 0.70 || alat > 1.02) col = mixc(col, PAL.snow, Math.max(sstep(0.70, 0.86, h), sstep(1.02, 1.16, alat) * 0.7));
        col = mixc([col[0] * 0.55, col[1] * 0.55, col[2] * 0.58], col, shade);            // 浮雕
        rough = 235;
      }
      // 极点纯化：等距圆柱投影在极点会收敛成放射状条纹，故 |lat|>78° 向纯冰白过渡，
      // 使极点区域颜色均匀（消除"辐条"伪影）
      const poleK = sstep(1.36, 1.53, alat);
      if (poleK > 0) col = mixc(col, [242, 246, 250], poleK);
      img.data[p] = Math.round(clamp01(col[0] / 255) * 255);
      img.data[p + 1] = Math.round(clamp01(col[1] / 255) * 255);
      img.data[p + 2] = Math.round(clamp01(col[2] / 255) * 255);
      img.data[p + 3] = 255;
      rimg.data[p] = rimg.data[p + 1] = rimg.data[p + 2] = rough; rimg.data[p + 3] = 255;
      const eFlat = e + (0.5 - e) * sstep(1.28, 1.50, alat);      // 极区高程压平 → 法线变平
      const hv = Math.round(clamp01(eFlat) * 255);
      himg.data[p] = himg.data[p + 1] = himg.data[p + 2] = hv; himg.data[p + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0); rx.putImageData(rimg, 0, 0); hx.putImageData(himg, 0, 0);

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
  const rough = new THREE.CanvasTexture(rc); rough.anisotropy = 4;
  const normal = normalFromHeight(hc, relief);
  return { map, rough, normal, heightCanvas: hc };
}

/** 由高度图求法线贴图（Sobel，近似；避免额外噪声采样） */
export function normalFromHeight(hc, strength) {
  const W = hc.width, H = hc.height;
  const src = hc.getContext('2d').getImageData(0, 0, W, H).data;
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const ox = out.getContext('2d'); const oi = ox.createImageData(W, H);
  const k = (typeof strength === 'number') ? strength : 1;
  const at = (x, y) => src[((y + H) % H) * W * 4 + ((x + W) % W) * 4] / 255;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const dx = (at(i + 1, j) - at(i - 1, j)) * k * 3.2;
      const dy = (at(i, j + 1) - at(i, j - 1)) * k * 3.2;
      let nx = -dx, ny = -dy, nz = 1;
      const l = Math.hypot(nx, ny, nz) || 1;
      nx /= l; ny /= l; nz /= l;
      const p = (j * W + i) * 4;
      oi.data[p] = Math.round((nx * 0.5 + 0.5) * 255);
      oi.data[p + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      oi.data[p + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      oi.data[p + 3] = 255;
    }
  }
  ox.putImageData(oi, 0, 0);
  const t = new THREE.CanvasTexture(out);
  return t;
}

/** 云层贴图（白色 + alpha）：纬向云带 + 涡旋细节，极区云量减弱 */
export function buildCloudTexture(o) {
  const opt = o || {};
  const W = Math.max(64, opt.w || 1024), H = Math.max(32, opt.h || 512);
  const fbm = makeFbm(opt.seed || 424242);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); const img = x.createImageData(W, H);
  for (let j = 0; j < H; j++) {
    const lat = (0.5 - j / H) * Math.PI;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < W; i++) {
      const lon = (i / W) * Math.PI * 2;
      const cx = Math.cos(lon), sx = Math.sin(lon);
      let n = fbm(cx * 3.6 + 41.2, sx * 3.6 + sl * 1.7 - 12.6, 6);
      n += 0.11 * Math.sin(lat * 7.4) + 0.06 * Math.sin(lon * 3 + 1.3);      // ITCZ 与纬向急流云带
      const band = 1 - 0.32 * sstep(1.02, 1.45, Math.abs(lat));
      const a = sstep(0.615, 0.86, n) * 0.76 * band;   // 云量适中：既不糊住大陆，又能看到清晰云系
      const p = (j * W + i) * 4;
      img.data[p] = img.data[p + 1] = img.data[p + 2] = 255;
      img.data[p + 3] = Math.round(a * 255);
    }
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * 大气边缘（瑞利散射）：视线掠过大气层处最亮，正对处近乎透明；
 * 外缘偏青蓝、内缘偏蔚蓝，模拟真实地球大气的 limb glow。
 */
export function buildAtmosphereMaterial(opts) {
  const o = opts || {};
  const uni = {
    uInner: { value: new THREE.Color(o.inner || 0x5aa9ff) },   // 近地面：蔚蓝
    uOuter: { value: new THREE.Color(o.outer || 0x9fd4ff) },   // 高空外缘：淡青
    uPower: { value: (typeof o.power === 'number') ? o.power : 3.0 },
    uStrength: { value: (typeof o.strength === 'number') ? o.strength : 1.0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: uni,
    vertexShader: `
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uInner; uniform vec3 uOuter; uniform float uPower; uniform float uStrength;
      varying vec3 vN; varying vec3 vV;
      void main() {
        // 掠射角：法线与视线接近垂直 → 穿过大气的路径最长 → 最亮
        float rim = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float a = pow(clamp(rim, 0.0, 1.0), uPower) * uStrength;
        vec3 col = mix(uInner, uOuter, clamp(rim * 1.4, 0.0, 1.0));
        gl_FragColor = vec4(col * a, a);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, side: THREE.BackSide, depthWrite: false, fog: false,
  });
  mat.uniforms = uni;
  return mat;
}

export default { buildEarthSurface, buildCloudTexture, buildAtmosphereMaterial, makeFbm, normalFromHeight };
