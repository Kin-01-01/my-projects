// ============================================================================
// environment.js —— 地球发射环境物理模型（大气分层 / 重力场 / 风场 / 气象动态）
// ----------------------------------------------------------------------------
// 设计约定：
//  1) 单位：SI（米、秒、千克、开尔文、帕）。几何高度 m 输入，输出标准大气量。
//  2) 所有对外函数都必须"无害"：输入 NaN/Infinity/负数/超界时按 ENV_BOUNDS 收敛，
//     绝不把 NaN 传回调用方（火焰着色器曾因 NaN 整片不可见，教训牢记）。
//  3) 零逐帧分配：风矢量/环境采样复用同一对象；不创建临时对象。
//  4) 计算量：单次采样 ≈ 查表 + 少量幂/指数 + 3 个正弦，适合每帧调用。
// ============================================================================

// ---- 标准常数（US Standard Atmosphere 1976 / CODATA）----
const G0 = 9.80665;          // 标准重力加速度 m/s²
const R_STAR = 8.31432;      // 通用气体常数 J/(mol·K)
const M_AIR = 0.0289644;     // 干空气摩尔质量 kg/mol
const R_AIR = R_STAR / M_AIR;              // ≈287.05 J/(kg·K) 比气体常数
const R_EARTH = 6356766;     // 有效地球半径 m（位势高度换算用）
const P0 = 101325;           // 海压标准气压 Pa
const T0 = 288.15;           // 海压标准气温 K
const RHO0 = P0 / (R_AIR * T0);            // ≈1.225 kg/m³

// ---- 参数取值范围与边界（面板/调用方共用，便于校验与异常提示）----
export const ENV_BOUNDS = {
  altM: { min: 0, max: 200000, unit: 'm' },              // 支持高度：地面 ~ 200 km
  tempK: { min: 150, max: 360, unit: 'K' },
  presPa: { min: 0, max: 120000, unit: 'Pa' },
  densKgM3: { min: 0, max: 1.5, unit: 'kg/m³' },
  gravMs2: { min: 8.5, max: 9.9, unit: 'm/s²' },
  windMs: { min: 0, max: 120, unit: 'm/s' },
  windSurfaceMs: { min: 0, max: 25, unit: 'm/s' },       // 可调地面风
  jetMs: { min: 0, max: 80, unit: 'm/s' },               // 急流峰值
  jetAltKm: { min: 8, max: 14, unit: 'km' },
  turbIntensity: { min: 0, max: 1, unit: '-' },          // 湍流强度（阵风系数）
  cloudiness: { min: 0, max: 1, unit: '-' },
  visibilityM: { min: 800, max: 60000, unit: 'm' },
  precipitation: { min: 0, max: 1, unit: '-' },
  tempOffsetK: { min: -12, max: 12, unit: 'K' },         // 相对标准大气的温度偏差
  qnhHPa: { min: 950, max: 1060, unit: 'hPa' },          // 场面气压
};

// ---- 数值收敛工具 ----
function fin(v, fb) { return (typeof v === 'number' && isFinite(v)) ? v : fb; }
function clampNum(v, lo, hi, fb) {
  const x = fin(v, fb);
  return x < lo ? lo : (x > hi ? hi : x);
}
function clampB(key, v, fb) {
  const b = ENV_BOUNDS[key];
  return clampNum(v, b.min, b.max, fb !== undefined ? fb : b.min);
}

// ============================================================================
// ① 大气分层：US Standard Atmosphere 1976（7 层 + 86km 以上指数外推）
//    hb = 层底位势高度 km；L = 温度递减率 K/km（0 = 等温层）；Tb = 层底温度 K；pb = 层底气压 Pa
// ============================================================================
const LAYERS = [
  { hb: 0.0,  L: -6.5, Tb: 288.15, pb: 101325.0 },
  { hb: 11.0, L: 0.0,  Tb: 216.65, pb: 22632.06 },
  { hb: 20.0, L: 1.0,  Tb: 216.65, pb: 5474.889 },
  { hb: 32.0, L: 2.8,  Tb: 228.65, pb: 868.0187 },
  { hb: 47.0, L: 0.0,  Tb: 270.65, pb: 110.9063 },
  { hb: 51.0, L: -2.8, Tb: 270.65, pb: 66.93887 },
  { hb: 71.0, L: -2.0, Tb: 214.65, pb: 3.956420 },
];
const H_TOP = 84.852;                 // 标准大气模型顶层（km）
const T_TOP = 186.946;                // 顶层温度 K
const P_TOP = 0.373383;               // 顶层气压 Pa
const H_SCALE_TOP = 6000;             // 86km 以上外推标高（m）

/** 几何高度(m) → 位势高度(km)：z = (Re·h)/(Re+h) */
function geopotentialKm(altM) {
  return (R_EARTH * altM) / (R_EARTH + altM) / 1000;
}

function layerAt(z) {
  let L = LAYERS[0];
  for (let i = LAYERS.length - 1; i >= 0; i--) { if (z >= LAYERS[i].hb) { L = LAYERS[i]; break; } }
  return L;
}

// 气象状态（模块内单例，供温度/气压/风场读取）
const env = {
  weather: {
    cloudiness: 0.28, visibilityM: 26000, precipitation: 0, turbulence: 0.35,
    tempOffsetK: 0, qnhHPa: 1013, windSurfaceMs: 3.2, jetMs: 28, jetAltKm: 10.5,
    windDirRad: 0.9, preset: 'standard',
  },
};

/** 温度 K：分层线性（含等温层）+ 低空气象偏差 */
export function temperatureAt(altM) {
  const h = clampB('altM', altM, 0);
  const z = geopotentialKm(h);
  let T;
  if (z >= H_TOP) {
    T = T_TOP;
  } else {
    const L = layerAt(z);
    T = L.Tb + L.L * (z - L.hb);
  }
  const w = Math.exp(-h / 8000);          // 天气影响主要在对流层
  T += env.weather.tempOffsetK * w;
  return clampB('tempK', T, T0);
}

/** 气压 Pa：L≠0 幂律、L=0 等温指数律；86km 以上指数外推 */
export function pressureAt(altM) {
  const h = clampB('altM', altM, 0);
  const z = geopotentialKm(h);
  let p;
  if (z >= H_TOP) {
    p = P_TOP * Math.exp(-(h - H_TOP * 1000) / H_SCALE_TOP);
  } else {
    const L = layerAt(z);
    const dz = (z - L.hb) * 1000;
    if (L.L === 0) {
      p = L.pb * Math.exp(-G0 * M_AIR * dz / (R_STAR * L.Tb));
    } else {
      const lKpm = L.L / 1000;
      p = L.pb * Math.pow(L.Tb / (L.Tb + lKpm * dz), (G0 * M_AIR) / (R_STAR * lKpm));
    }
  }
  const w = Math.exp(-h / 9000);          // 场面气压（QNH）修正
  p *= (1 + (env.weather.qnhHPa * 100 - P0) / P0 * w);
  return clampB('presPa', p, P0);
}

/** 密度 kg/m³：ρ = p/(R·T)，与 T、p 自洽 */
export function densityAt(altM) {
  const p = pressureAt(altM), T = temperatureAt(altM);
  return clampB('densKgM3', p / (R_AIR * Math.max(T, 1)), RHO0);
}

/** 声速 m/s：a = √(γRT)，γ=1.4 */
export function soundSpeedAt(altM) {
  return Math.sqrt(1.4 * R_AIR * temperatureAt(altM));
}

// ============================================================================
// ② 重力场：g(h) = g0·(Re/(Re+h))²
// ============================================================================
export function gravityAt(altM) {
  const h = clampB('altM', altM, 0);
  const k = R_EARTH / (R_EARTH + h);
  return clampB('gravMs2', G0 * k * k, G0);
}

// ============================================================================
// ③ 风场：地表对数律 + 高空急流高斯峰 + 平流层衰减 + 阵风/切变（复用输出对象）
// ============================================================================
const WIND_OUT = { speed: 0, dirX: 1, dirZ: 0, gust: 0, shear: 0, turbulence: 0 };
const Z0 = 0.03;                     // 粗糙度 m（发射场草地/硬地混合）

export function windAt(altM, tSec) {
  const h = clampB('altM', altM, 0);
  const w = env.weather;
  const u10 = clampB('windSurfaceMs', w.windSurfaceMs, 3);
  const jet = clampB('jetMs', w.jetMs, 28);
  const jetH = clampB('jetAltKm', w.jetAltKm, 10.5) * 1000;
  const gustK = clampB('turbIntensity', w.turbulence, 0.35);

  const logProf = (hh) => u10 * Math.log((Math.max(hh, 0.1) + Z0) / Z0) / Math.log((10 + Z0) / Z0);
  let base;
  if (h <= 200) {
    base = logProf(h);
  } else {
    const g = Math.exp(-Math.pow((h - jetH) / 3500, 2));      // 急流高斯峰
    const u200 = logProf(200);
    base = u200 + (jet - u200) * g * clampNum((h - 200) / Math.max(jetH - 200, 1), 0, 1);
    const decay = h > 20000 ? Math.exp(-(h - 20000) / 28000) : 1;
    base *= decay;
    if (h > 12000) base = Math.max(base, 4 * decay);          // 高空残余 ≤4 m/s
  }
  // 阵风：三个周期的正弦叠加（确定性、可重放、零分配）
  const tt = fin(tSec, 0);
  const g1 = Math.sin(tt * 0.9 + h * 0.0004);
  const g2 = Math.sin(tt * 2.3 + h * 0.0011);
  const g3 = Math.sin(tt * 5.1 + h * 0.0027);
  const gust = (0.55 * g1 + 0.30 * g2 + 0.15 * g3) * gustK * (2 + 0.12 * base);
  // 切变/湍流：急流层与近地面最强
  const turb = gustK * (0.35 + 0.65 * Math.exp(-Math.pow((h - jetH) / 4000, 2)) + 0.40 * Math.exp(-h / 400));
  // 风向随高度偏转（地面 → 急流层约 35°）
  const veer = 0.61 * clampNum(h / jetH, 0, 1.2);
  const dirA = w.windDirRad + veer;
  WIND_OUT.speed = clampB('windMs', Math.max(0, base + gust), 0);
  WIND_OUT.dirX = Math.cos(dirA);
  WIND_OUT.dirZ = Math.sin(dirA);
  WIND_OUT.gust = gust;
  WIND_OUT.shear = clampNum(Math.abs(gust) / Math.max(base, 1), 0, 1.5);
  WIND_OUT.turbulence = clampB('turbIntensity', turb, 0.3);
  return WIND_OUT;
}

// ============================================================================
// ④ 气象动态：均值回归随机游走（0.5s 节流；单步上限 2s 防快进跳变）
// ============================================================================
const WEATHER_DEF = {
  cloudiness: { mean: 0.28, span: 0.10, rate: 0.05, b: 'cloudiness' },
  visibilityM: { mean: 26000, span: 2200, rate: 0.05, b: 'visibilityM' },
  precipitation: { mean: 0.0, span: 0.06, rate: 0.15, b: 'precipitation' },
  turbulence: { mean: 0.35, span: 0.18, rate: 0.06, b: 'turbIntensity' },
  tempOffsetK: { mean: 0.0, span: 0.9, rate: 0.04, b: 'tempOffsetK' },
  qnhHPa: { mean: 1013.0, span: 1.2, rate: 0.05, b: 'qnhHPa' },
  windSurfaceMs: { mean: 3.2, span: 1.4, rate: 0.07, b: 'windSurfaceMs' },
  jetMs: { mean: 28.0, span: 3.0, rate: 0.04, b: 'jetMs' },
  jetAltKm: { mean: 10.5, span: 0.5, rate: 0.04, b: 'jetAltKm' },
};

let wxAcc = 0;
export function stepWeather(dt) {
  const d = fin(dt, 0);
  if (!(d > 0)) return env.weather;
  wxAcc += d;
  if (wxAcc < 0.5) return env.weather;
  const step = Math.min(wxAcc, 2.0);
  wxAcc = 0;
  const w = env.weather;
  for (const k in WEATHER_DEF) {
    const c = WEATHER_DEF[k];
    const drift = (c.mean - w[k]) * c.rate * step + (Math.random() - 0.5) * c.span * step;
    w[k] = clampB(c.b, w[k] + drift, w[k]);
  }
  w.windDirRad = (w.windDirRad + (Math.random() - 0.5) * 0.10 * step) % (Math.PI * 2);
  return w;
}

export const WEATHER_PRESETS = {
  standard: { cloudiness: 0.28, visibilityM: 26000, precipitation: 0, turbulence: 0.35, tempOffsetK: 0, qnhHPa: 1013, windSurfaceMs: 3.2, jetMs: 28, jetAltKm: 10.5 },
  clear: { cloudiness: 0.05, visibilityM: 42000, precipitation: 0, turbulence: 0.18, tempOffsetK: 2, qnhHPa: 1018, windSurfaceMs: 1.5, jetMs: 18, jetAltKm: 10.5 },
  overcast: { cloudiness: 0.85, visibilityM: 7000, precipitation: 0.25, turbulence: 0.55, tempOffsetK: -3, qnhHPa: 1005, windSurfaceMs: 7.5, jetMs: 40, jetAltKm: 9.5 },
  gale: { cloudiness: 0.60, visibilityM: 9000, precipitation: 0.40, turbulence: 0.85, tempOffsetK: -5, qnhHPa: 995, windSurfaceMs: 18, jetMs: 62, jetAltKm: 9.0 },
};
const PRESET_KEYS = ['cloudiness', 'visibilityM', 'precipitation', 'turbulence', 'tempOffsetK', 'qnhHPa', 'windSurfaceMs', 'jetMs', 'jetAltKm'];
export function setWeatherPreset(name) {
  const p = WEATHER_PRESETS[name] || WEATHER_PRESETS.standard;
  const w = env.weather;
  for (const k of PRESET_KEYS) {
    if (typeof p[k] === 'number') w[k] = clampB(WEATHER_DEF[k].b, p[k], w[k]);
  }
  w.preset = WEATHER_PRESETS[name] ? name : 'standard';
  return w;
}
export function weatherState() { return env.weather; }

// ============================================================================
// ⑤ 综合采样（零分配，复用 ENV_OUT）
// ============================================================================
const ENV_OUT = {
  altM: 0, tempK: T0, tempC: 15, presPa: P0, presHPa: 1013.25, dens: RHO0,
  densRatio: 1, gravity: G0, soundMs: 340, windSpeed: 0, windX: 0, windZ: 0,
  gust: 0, shear: 0, turbulence: 0, dynamicQ: 0, mach: 0,
};
export function envSample(altM, velMs, tSec) {
  const h = clampB('altM', altM, 0);
  const v = clampNum(velMs, 0, 12000, 0);
  const T = temperatureAt(h), p = pressureAt(h), rho = densityAt(h);
  const a = Math.sqrt(1.4 * R_AIR * T);
  const wind = windAt(h, tSec);
  ENV_OUT.altM = h;
  ENV_OUT.tempK = T; ENV_OUT.tempC = T - 273.15;
  ENV_OUT.presPa = p; ENV_OUT.presHPa = p / 100;
  ENV_OUT.dens = rho; ENV_OUT.densRatio = rho / RHO0;
  ENV_OUT.gravity = gravityAt(h);
  ENV_OUT.soundMs = a;
  ENV_OUT.windSpeed = wind.speed;
  ENV_OUT.windX = wind.dirX * wind.speed;
  ENV_OUT.windZ = wind.dirZ * wind.speed;
  ENV_OUT.gust = wind.gust; ENV_OUT.shear = wind.shear; ENV_OUT.turbulence = wind.turbulence;
  ENV_OUT.dynamicQ = 0.5 * rho * v * v;        // 动压（max-Q 关键工况）
  ENV_OUT.mach = v / Math.max(a, 1);
  return ENV_OUT;
}

/** 分层概要（面板/文档用，非逐帧） */
export function atmosphereProfile() {
  const rows = [];
  for (const h of [0, 1000, 5000, 11000, 20000, 32000, 47000, 71000, 100000]) {
    rows.push({
      altKm: h / 1000,
      tempC: +(temperatureAt(h) - 273.15).toFixed(1),
      presHPa: +(pressureAt(h) / 100).toFixed(1),
      dens: +densityAt(h).toFixed(4),
      densRatio: +(densityAt(h) / RHO0).toExponential(1),
      g: +gravityAt(h).toFixed(3),
    });
  }
  return rows;
}

export const ENV_CONST = { G0, R_AIR, RHO0, P0, T0, R_EARTH, H_TOP_KM: H_TOP };
