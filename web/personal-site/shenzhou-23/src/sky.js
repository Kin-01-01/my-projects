// ============================================================================
// sky.js —— 天空穹顶（随高度分层的渐变 + 地平线气辉）
// ----------------------------------------------------------------------------
// 设计要点：
//  1) 一个 BackSide 球 + 无贴图 ShaderMaterial（1 次 draw call、零纹理开销），
//     颜色由"天顶色 / 地平线色 / 气辉强度"三个 uniform 驱动，逐帧只改 uniform。
//  2) 高度分层用 SKY_KEY 关键帧表集中描述（改颜色只动这一张表）。
//  3) 物理依据：天空亮度来自瑞利散射，散射光 ∝ 大气密度 → 气辉强度按
//     ρ/ρ0 的 0.25 次方衰减（高空大气稀薄、天空变暗），由 environment.js 提供 ρ。
//  4) 与既有过渡保持一致：驱动量 skyT = clamp(sceneY/900,0,1)，与星空/地球弧形
//     出现的 atm↔space 过渡同源，不会出现"天还蓝着却已满天星"的割裂。
//  5) 异常：任何非有限输入都夹紧/回落，uniform 只接收有限颜色分量。
// ============================================================================
import * as THREE from 'three';

// ---- 高度分层关键帧（t: 0=地面 → 1=入轨；zenith 天顶色 / horizon 地平线色 / glow 气辉强度）----
// 夜间发射（酒泉）：地面为深蓝夜空 + 地平线暖调灯光散射；随升高转深蓝→紫蓝→近黑。
export const SKY_KEY = [
  // 地面：深夜蓝（天顶近黑、地平线受场坪灯光/气溶胶散射呈暖蓝），气辉最强
  { t: 0.00, zenith: 0x04070e, horizon: 0x16233a, glow: 0.38, glowColor: 0x2a2a33 },
  // 低空（≈1~3km）：天顶更黑、地平线蓝略微收紧
  { t: 0.12, zenith: 0x03050c, horizon: 0x121e34, glow: 0.31, glowColor: 0x2b2a35 },
  // 中空（≈5~10km）：大气稀薄，地平线收成细亮环、色偏紫蓝
  { t: 0.30, zenith: 0x02040a, horizon: 0x0d162c, glow: 0.22, glowColor: 0x2c2f42 },
  // 高空（≈20~40km）：天空基本全黑，只余一圈淡蓝大气边
  { t: 0.55, zenith: 0x010308, horizon: 0x070c20, glow: 0.12, glowColor: 0x30406a },
  { t: 0.78, zenith: 0x000205, horizon: 0x04081a, glow: 0.06, glowColor: 0x35507f },
  // 入轨：纯黑 + 地球大气弧（由 atmoRim 提供）
  { t: 1.00, zenith: 0x000001, horizon: 0x020410, glow: 0.025, glowColor: 0x3d64a0 },
];

const _cA = new THREE.Color(), _cB = new THREE.Color();

function clamp01(v) { return (typeof v === 'number' && isFinite(v)) ? Math.max(0, Math.min(1, v)) : 0; }

/** 按关键帧插值出该高度的天空参数（写入给定对象，零分配） */
export function skyPaletteAt(t, out) {
  const k = clamp01(t);
  let i = 0;
  while (i < SKY_KEY.length - 2 && k > SKY_KEY[i + 1].t) i++;
  const a = SKY_KEY[i], b = SKY_KEY[i + 1];
  const u = (k - a.t) / Math.max(b.t - a.t, 1e-6);
  const s = u * u * (3 - 2 * u);
  out.zenith.copy(_cA.setHex(a.zenith)).lerp(_cB.setHex(b.zenith), s);
  out.horizon.copy(_cA.setHex(a.horizon)).lerp(_cB.setHex(b.horizon), s);
  out.glowColor.copy(_cA.setHex(a.glowColor)).lerp(_cB.setHex(b.glowColor), s);
  out.glow = a.glow + (b.glow - a.glow) * s;
  return out;
}

/**
 * 构建渐变天空穹顶
 * @param {number} radius 球半径（应略小于星空穹顶，使其位于星星之后）
 */
export function buildSkyGradient(radius) {
  const R = (typeof radius === 'number' && isFinite(radius)) ? radius : 5000;
  const uni = {
    uZenith: { value: new THREE.Color(SKY_KEY[0].zenith) },
    uHorizon: { value: new THREE.Color(SKY_KEY[0].horizon) },
    uGlowColor: { value: new THREE.Color(SKY_KEY[0].glowColor) },
    uGlow: { value: SKY_KEY[0].glow },
    uPow: { value: 0.55 },        // 天顶↔地平线的过渡曲线指数
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: uni,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uGlowColor;
      uniform float uGlow;
      uniform float uPow;
      varying vec3 vDir;
      void main() {
        // 上方（vDir.y>0）趋天顶色，下方趋地平线色；地底一侧略压暗，避免"发光地面"
        float up = clamp(vDir.y, 0.0, 1.0);
        float down = clamp(-vDir.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uZenith, pow(up, uPow));
        col = mix(col, uHorizon * 0.75, pow(down, 0.9));
        // 地平线气辉：紧贴地平线的一圈散射亮带（大气越厚越明显）
        float band = exp(-abs(vDir.y) * 7.0);
        col += uGlowColor * (uGlow * band);
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide, transparent: false, depthWrite: false, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 20), mat);
  mesh.renderOrder = 895;              // 先于星空穹顶(900)绘制
  mesh.frustumCulled = false;
  mesh.name = 'skyGradient';

  const pal = { zenith: new THREE.Color(), horizon: new THREE.Color(), glowColor: new THREE.Color(), glow: 0 };
  let lastT = -1;

  /**
   * 逐帧更新
   * @param {number} skyT    高度因子 0~1（地面 → 入轨）
   * @param {number} densRatio  ρ/ρ0（来自 environment.js；用于气辉随大气稀薄而减弱）
   * @param {number} cloudiness 云量 0~1（阴天使气辉扩散、天空略发灰）
   */
  function update(skyT, densRatio, cloudiness) {
    const k = clamp01(skyT);
    const rho = clamp01(densRatio);
    const cl = clamp01(cloudiness);
    // 关键帧变化超过阈值才重算调色板（节流，避免每帧插值）
    if (Math.abs(k - lastT) > 0.002) {
      skyPaletteAt(k, pal);
      lastT = k;
    }
    // 物理：散射光 ∝ 大气密度（0.25 次方：视觉上更平滑），云量再叠加一点灰
    const air = Math.pow(Math.max(rho, 1e-6), 0.25);
    const glowK = (0.35 + 0.65 * air) * (1 - 0.25 * cl);
    uni.uZenith.value.copy(pal.zenith).multiplyScalar(1 + 0.10 * cl);
    uni.uHorizon.value.copy(pal.horizon).multiplyScalar(1 + 0.18 * cl);
    uni.uGlowColor.value.copy(pal.glowColor).lerp(_cA.setHex(0x6a7078), 0.35 * cl);
    uni.uGlow.value = pal.glow * glowK;
  }

  /** 当前天空的地平线色（供雾色/环境光取色，保证近景与天空同调） */
  function horizonColor(target) {
    const c = target || new THREE.Color();
    return c.copy(uni.uHorizon.value);
  }

  return { mesh, material: mat, uniforms: uni, update, horizonColor, palette: pal };
}

export default buildSkyGradient;
