// 写实在轨地球：程序化地表（海陆/冰盖/沙漠/山脉）+ 海洋镜面粗糙度 + 云层 + 大气辉光
// 全程序化生成，无外部贴图资源。地表位于飞船下方，呈现曲率视界。
// 贴图算法统一收敛到 globe.js（高程/生物群区/冰盖/云/大气），此处只做装配与自转。
import * as THREE from 'three';
import * as GLOBE from './globe.js';

function mulberry(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 确定性值噪声 fbm（经度方向无缝：采样域用 (cos(lon), sin(lon)) 圆环）
function makeFbm(seed) {
  const R = mulberry(seed);
  const S = 256;
  const grid = new Float32Array(S * S);
  for (let i = 0; i < grid.length; i++) grid[i] = R();
  const at = (ix, iy) => grid[(((iy % S) + S) % S) * S + (((ix % S) + S) % S)];
  const sm = t => t * t * (3 - 2 * t);
  function n2(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = sm(x - ix), fy = sm(y - iy);
    const a = at(ix, iy), b = at(ix + 1, iy), c = at(ix, iy + 1), d = at(ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  return function fbm(x, y, oct) {
    let v = 0, amp = 0.5, f = 1, norm = 0;
    for (let o = 0; o < oct; o++) { v += amp * n2(x * f, y * f); norm += amp; amp *= 0.5; f *= 2; }
    return v / norm;
  };
}

const clamp01 = v => Math.max(0, Math.min(1, v));
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
// 颜色三通道插值 [r,g,b] 0-255
const mixc = (A, B, t) => [mix(A[0], B[0], t), mix(A[1], B[1], t), mix(A[2], B[2], t)];

// 地表 + 粗糙度 + 法线：委托 globe.js（高程场 → 海陆 → 生物群区 → 冰盖 → 浮雕 → 法线）
function makeSurfaceTextures() {
  return GLOBE.buildEarthSurface({ w: 1024, h: 512, seed: 20260927, seaLevel: 0.52, relief: 1.0 });
}

// 云层贴图（白色 + alpha，含纬向云带）：委托 globe.js
function makeCloudTexture() {
  return GLOBE.buildCloudTexture({ w: 1024, h: 512, seed: 424242 });
}

// 大气瑞利边缘：委托 globe.js（内缘蔚蓝、外缘淡青）
function makeAtmosphereMaterial() {
  return GLOBE.buildAtmosphereMaterial({ inner: 0x5aa9ff, outer: 0x9fd4ff, power: 2.6, strength: 1.6 });
}

export function buildEarth() {
  const group = new THREE.Group();
  const R = 600;

  const tex = makeSurfaceTextures();
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(R, 96, 64),
    new THREE.MeshStandardMaterial({ map: tex.map, roughnessMap: tex.rough, normalMap: tex.normal, roughness: 1.0, metalness: 0.0 })
  );
  earth.rotation.z = 0.41; // 黄赤交角视觉倾斜
  group.add(earth);

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.012, 64, 48),
    new THREE.MeshStandardMaterial({ map: makeCloudTexture(), transparent: true, depthWrite: false, roughness: 1.0, metalness: 0.0, opacity: 0.82 })
  );
  clouds.rotation.z = 0.41;
  group.add(clouds);

  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.045, 64, 48), makeAtmosphereMaterial());
  group.add(atmo);

  // 地表位于飞船下方：球顶在 y = -48
  group.position.set(0, -R - 48, 0);

  let earthSpin = 0, cloudSpin = 0;
  function update(dt) {
    earthSpin += dt * 0.0035;
    cloudSpin += dt * 0.0049;              // 云层相对地表缓慢东移
    earth.rotation.y = earthSpin;
    clouds.rotation.y = earthSpin + cloudSpin;
  }

  return { group, update, radius: R };
}
