// 神舟二十三号发射演示：长征二号F发射 rig + 四阶段时间线动画
// 坐标系：火箭轴向为 Y（向上），发射台位于 y=0。
// 环境设定：地球（酒泉发射场戈壁地表 + 大气层天空 + 地表重力）。
// 尺寸：1 场景单位 = 1 米，按中国载人航天工程网公开数据建模：
//   全长 58.34m、芯级直径 3.35m（芯一级 21m / 芯二级 15.4m）、
//   助推器直径 2.25m 长 16.1m（4 枚）、整流罩最大直径 3.8m、逃逸塔高约 8m。
import * as THREE from 'three';
import { buildShip, setSolarDeploy } from './spacecraft.js';
import { buildTower } from './tower.js';
import { buildSkyGradient } from './sky.js';
import * as GLOBE from './globe.js';
import * as ENV from './environment.js';
import { LAUNCH_PHASES, LAUNCH_TL } from './data.js';

// ---- 地球环境参数（1 单位 = 1 米）----
const G_EARTH = 9.81;      // 地表重力加速度（m/s²）
const SCENE_SCALE = 1.0;   // 场景单位 : 米
const G = G_EARTH * SCENE_SCALE;
const A_THRUST0 = 13.5;    // 初始推力加速度（m/s²，须大于 G 才能离台）
const A_THRUST_K = 1.2;    // 推力加速度随时间增长率

// === ① 时间线（秒）：唯一数据源在 data.js 的 LAUNCH_TL（对齐发射 MP3 总时长 ≈212s）===
// 严格航天顺序：倒计时→点火→【升空】助推器分离→逃逸塔分离→整流罩抛离（芯一二两级连接、帆板收拢）
//   →【级间分离】芯一级/芯二级分离（芯二级带飞船继续、帆板仍收拢）
//   →【入轨部署】芯二级关机并与飞船完全分离后，飞船独立在轨，再展开太阳帆板
const { T_IGN, T_BOOST, T_ESC, T_FAIR, T_CORE, T_UPPER, T_SOLAR, MAX_T } = LAUNCH_TL;
// === 事件对齐覆盖（面板「以当前时刻对齐」写入；持久化 localStorage）===
// 只覆盖分离/展开的"触发时刻"，不动遥测与阶段显示；没有覆盖时回落到 data.js 的 LAUNCH_TL
const alignTimes = {};
try { Object.assign(alignTimes, JSON.parse(localStorage.getItem('wbEventAlign') || '{}')); } catch (e) { /* 隐私模式忽略 */ }
function evT(key, base) { const v = alignTimes[key]; return (typeof v === 'number' && isFinite(v)) ? v : base; }
function saveAlign() { try { localStorage.setItem('wbEventAlign', JSON.stringify(alignTimes)); } catch (e) {} }
// 重力转向参数（程序转弯弹道）：起飞先垂直爬升，之后平滑向东倾斜沿曲线斜飞
const PITCH_MAX = THREE.MathUtils.degToRad(62);   // 末段最大倾角（接近水平，受取景约束封顶）
// BUG2 修复：转弯起始时机延后到"完全离塔"之后——塔架高 62m，
// sceneAltitude(T_IGN+34s)≈81m，箭体底部（喷口）已高过塔顶 19m 安全余量；
// 此前 PITCH_T0=6 会在箭体还在塔架高度范围内就开始倾斜。低空段箭体绝对竖直。
const PITCH_T0 = 17;                             // 点火物理修正后：锁台~2s+推力爬升，约 t=27 视觉高度≈93m(塔顶62m+安全余量)才起转
const PITCH_SPAN = (T_UPPER - T_IGN) + 40;       // 倾角从 0 爬升到 PITCH_MAX 的时间跨度
const SCENE_ALT_MAX = 900;  // 场景竖直位移上限（米）：有界压缩，HUD 高度另走遥测映射
// === 点火物理修正区（修复"点火瞬间窜出"）===
// 真实点火过程：主发动机推力在数秒内平滑爬升；发射台压紧机构锁死火箭，
// 推力未超过箭体重力前火箭纹丝不动；推力>重力瞬间解锁起飞；
// 飞行中燃料持续消耗、质量下降，推重比随之增大（额定推重比 1.3）。
// 以下参数由页面顶部的「点火动力学」面板实时可调（setPhyParams → 自动复位重来）
const SIM = {
  twr: 1.3,        // 额定推重比（满载、满推力时 F/(m0·g)）
  ramp: 4.4,       // 推力上升时间（秒）；真实 CZ-2F：下达点火指令后【约 3 秒多】火箭才腾空
                   // （4.4s 爬升 → 推力越过重力在 t≈3.05s 解锁，与总设计师“约 3 秒多”一致）
  m0: 460000,      // 起飞质量（kg）：仅用于推力/推重比/质量的物理换算与显示
  burnFrac: 0.8,   // 全程燃料消耗比例（质量 100% → 20%）
};
const SIM_BURN = MAX_T - T_IGN;   // 燃料耗尽时间（演示全程）
// 气动阻力参数（environment.js 提供 ρ(h)）：a_drag = ½ρv²·Cd·A / m
const AERO = { cd: 0.32, area: 11.0, enabled: true };   // Cd 阻力系数；A 参考截面积 m²（芯级 3.35m + 助推包络）
const SIM_H0 = 3500;              // 视觉压缩尺度（真实米 → 场景米），避免高空数值撑爆相机
// 竖直运动积分状态（reset() 复位）
let simAltM = 0, simVel = 0, simLocked = true, simAcc = 0;
let simLiftT = 0;   // 发射台解锁（起飞）时刻：供「真实动作校对」事件表使用
let envNow = null;  // 当前环境采样（缓存，避免重复计算）
const _fogCol = new THREE.Color();   // 雾色复用（零逐帧分配）
// 单步积分：返回压缩后的场景高度（米）。dt 为物理步长，tt 为场景时间。
function stepAscent(dt, tt) {
  const tk = tt - T_IGN;
  if (tk <= 0) { simAcc = 0; return 0; }
  // ①推力加速度：0→额定（推重比 1.3）在 SIM.ramp 秒内 smoothstep 平滑爬升
  const u = Math.min(1, tk / SIM.ramp);
  const ramp = u * u * (3 - 2 * u);
  const thrustAcc = SIM.twr * G_EARTH * ramp;
  // ②燃料消耗：质量分数 100% → (1-burnFrac)（推重比随质量下降而增大）
  const massFrac = 1 - SIM.burnFrac * Math.min(1, tk / SIM_BURN);
  const gNow = ENV.gravityAt(simAltM);       // 重力随高度衰减 g(h)=g0·(Re/(Re+h))²
  const weightAcc = gNow * massFrac;         // 单位质量重力
  // ③发射台锁死：推力未超重力 → 原地不动（锁止状态）；超过瞬间解锁起飞
  // 面板「事件对齐」可选 LIFT 手动指定解锁时刻（默认完全由物理决定：推力 > 重力那一刻）
  const liftGate = alignTimes.LIFT;
  if (simLocked) {
    const released = (typeof liftGate === 'number' && isFinite(liftGate)) ? (tt >= liftGate) : (thrustAcc > weightAcc);
    if (!released) { simAcc = 0; return 0; }
    simLocked = false;
    if (!simLiftT) simLiftT = tt;           // 记录解锁离塔时刻（事件表用）
  }
  // ④解锁后：净加速度 = 推力/质量 - g(h) - 气动阻力
  const dragAcc = AERO.enabled ? (0.5 * ENV.densityAt(simAltM) * simVel * simVel * AERO.cd * AERO.area) / Math.max(SIM.m0 * massFrac, 1) : 0;
  const a = thrustAcc / massFrac - gNow - dragAcc;
  simAcc = a;                                // 供分离体惯性力使用（真实净加速度，替代旧解析常数）
  simVel += a * dt;
  simAltM += simVel * dt;
  // ⑤视觉压缩：前段近线性（低空爬升可见），高空饱和（900m 上限）
  return SCENE_ALT_MAX * (1 - Math.exp(-simAltM / SIM_H0));
}
// 程序转弯：倾角随飞行时间平滑从 0 增至 PITCH_MAX（机头始终沿速度切线方向）
// TURN 支持面板对齐（evT），默认在离塔后 PITCH_T0 秒开始
function pitchAt(tt) {
  const tTurn = evT('TURN', T_IGN + PITCH_T0);
  const u = THREE.MathUtils.clamp((tt - tTurn) / PITCH_SPAN, 0, 1);
  const s = u * u * (3 - 2 * u);   // smoothstep：起步/收尾无急转弯
  return PITCH_MAX * s;
}
// （原解析式 sceneAltitude 已被上面的 stepAscent 积分取代：点火锁死+推力爬升+燃料消耗）

// ---- 任务遥测映射（HUD 显示层）----
// 演示时间线压缩了真实任务（54s 演示 ≈ 600s 任务），画面运动按演示时间推进；
// HUD 时钟/高度/速度按「演示时刻 → 任务时刻」分段线性映射输出，
// 锚点取 CZ-2F / 神舟载人任务的公开节点近似值（不是精确弹道，量级与事件对应关系正确）。
// alt 变量定义：mission alt = 任务真实海拔（米）；场景 alt = rocketY（场景单位=米），仅驱动画面与音频衰减。
const TELEMETRY_MAP = [
  // { demo: 演示秒, mission: 任务秒, alt: 任务高度 m, vel: 任务速度 m/s }
  // 演示顺序（贴合音频旁白，等同真实 CZ-2F）：逃逸塔→助推器→一二级分离→整流罩→船箭，
  // 锚点按演示顺序单调递增取 CZ-2F 公开节点值（HUD 只显示量级与递进关系）
  { demo: T_IGN,   mission: 0,   alt: 0,      vel: 0    },  // 点火起飞（T+0:00）
  { demo: T_ESC,   mission: 120, alt: 39000,  vel: 1340 },  // 逃逸塔分离（真实 T+2:00）
  { demo: T_BOOST, mission: 140, alt: 52000,  vel: 1720 },  // 助推器分离（真实 T+2:20）
  { demo: T_CORE,  mission: 158, alt: 68000,  vel: 2260 },  // 一二级分离（真实 T+2:38）
  { demo: T_FAIR,  mission: 212, alt: 111000, vel: 3520 },  // 整流罩分离（真实 T+3:32）
  { demo: T_UPPER, mission: 585, alt: 200000, vel: 7670 },  // 船箭分离 / 入轨（真实 T+9:45）
  { demo: MAX_T,   mission: 620, alt: 205000, vel: 7670 },  // 在轨滑行
];function telemetryAt(t) {
  const m = TELEMETRY_MAP;
  if (t <= m[0].demo) return { mission: Math.max(0, t - T_IGN), alt: 0, vel: 0 };
  for (let i = 1; i < m.length; i++) {
    if (t <= m[i].demo) {
      const k = (t - m[i - 1].demo) / (m[i].demo - m[i - 1].demo);
      const lerp = (a, b) => a + (b - a) * k;
      return { mission: lerp(m[i - 1].mission, m[i].mission), alt: lerp(m[i - 1].alt, m[i].alt), vel: lerp(m[i - 1].vel, m[i].vel) };
    }
  }
  const last = m[m.length - 1];
  return { mission: last.mission + (t - last.demo), alt: last.alt, vel: last.vel };
}
// 重力随高度衰减：g = g0 · (R/(R+h))²，地球半径 6371 km
const EARTH_R_M = 6.371e6;
function gravityAt(altM) { return G_EARTH * Math.pow(EARTH_R_M / (EARTH_R_M + Math.max(0, altM)), 2); }
// 遥测格式化：高度 <10 km 用米，其余用 km；速度 <1 km/s 用 m/s，其余用 km/s
function fmtAlt(m) { return m < 10000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1) + ' km'; }
function fmtVel(v) { return v < 1000 ? Math.round(v) + ' m/s' : (v / 1000).toFixed(2) + ' km/s'; }

// ---- 箭体真实尺寸（米）----
const R_CORE = 1.675;   // 芯级半径
const R_BOOST = 1.125;  // 助推器半径
const R_FAIR = 1.9;     // 整流罩最大半径
const H_CORE1 = 21.0;   // 芯一级
const VERN_DELAY = 4;   // 二级主机关机（→游机）在比例点之后的后移秒数（用户 2026-09-29 校准 +4s）
const H_CORE2 = 15.4;   // 芯二级
const H_BOOST = 16.1;   // 助推器
const H_ESC = 8.0;      // 逃逸塔
const H_INTER = 1.8;    // 级间段
const H_BAY = 1.8;      // 仪器舱
const H_ADAPT = 0.8;    // 载荷适配器
const FAIR_CYL = 7.6;   // 整流罩圆柱段
const FAIR_NOSE = 2.9;  // 整流罩卵形头锥（实拍：锥高约为直径 0.75 倍，顶部截断装逃逸塔）
const FAIR_TOTAL = FAIR_CYL + FAIR_NOSE;     // 10.5 整流罩总长
// 尺寸链（自下而上）：一级21 + 级间1.8 + 二级15.4 + 仪器舱1.8 + 适配器0.8 + 整流罩10.5 + 逃逸塔8 = 58.3m，与官方 58.34m 一致
const Y_CORE1_TOP = H_CORE1;                        // 21.0
const Y_INTER = H_CORE1 + H_INTER;                  // 22.8 级间段顶
const Y_CORE2_TOP = Y_INTER + H_CORE2;              // 38.2
const Y_BAY_TOP = Y_CORE2_TOP + H_BAY;              // 40.0 仪器舱顶
const Y_ADAPT_TOP = Y_BAY_TOP + H_ADAPT;            // 40.8 适配器顶
const Y_FAIR_BASE = Y_BAY_TOP;                      // 40.0 整流罩基座
const Y_FAIR_CYL_TOP = Y_FAIR_BASE + FAIR_CYL;      // 47.2
const Y_PAYLOAD = Y_ADAPT_TOP + 3.0;                // 43.8（神舟底部在 40.8）
const Y_ESC_BASE = Y_FAIR_BASE + FAIR_TOTAL;        // 50.5 逃逸塔基座

// ---- 分离物理参数 ----
const SEP_BURN = 0.5;        // 分离动力作用时间（速度平滑爬升，杜绝瞬时跳变）
const SEP_MARGIN = 0.8;      // 分离安全余量（米）：分离体与箭体表面必须保持
const DRAG_LINEAR = 0.30;    // 线速度阻尼（空气阻力）
const DRAG_ANGULAR = 0.22;   // 角速度阻尼
const GROUND_MIN = 1.0;      // 分离体最低离地高度（防陷入地面）

// 平滑阶跃（用于分离动力的软启动/软停止）
function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / Math.max(1e-6, b - a)));
  return t * t * (3 - 2 * t);
}

// 简单可复现伪随机
function rnd(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

// 刚体分离状态：相对火箭的位置/速度/角速度 + 尺寸包络（圆柱近似，用于防穿模）
function makeSepBody(obj, dir, opt = {}) {
  const box = new THREE.Box3().setFromObject(obj);        // 构建期火箭在原点、无旋转 → 即箭体坐标系
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  return {
    obj,
    dir: dir.clone().normalize(),
    home: obj.position.clone(),
    p: new THREE.Vector3(),          // 相对原位的位移
    v: new THREE.Vector3(),          // 相对速度
    rot: new THREE.Vector3(),        // 相对姿态角
    w: new THREE.Vector3(opt.wx || 0, opt.wy || 0, opt.wz || 0),  // 角速度（翻滚）
    radXZ: Math.max(size.x, size.z) * 0.5,   // 自身横截面半径
    halfH: size.y * 0.5,                     // 自身半高
    sepAcc: opt.sepAcc != null ? opt.sepAcc : 7,
    groundMin: GROUND_MIN + size.y * 0.5,
    safeRadial: 0,                   // 需保持的最小轴距（由外部按栈半径设定）
    safeAxial: 0,                    // 需让开的轴向间隙
    axisMode: opt.axisMode || null,  // 'down' | null
    active: false, te: 0,
    minRadial: 0,                    // 已达成的最大轴距（单调不减 → 杜绝回弹穿模）
    maxAxial: 0,                     // 已达成的最大轴向让开量（单调不减）
    _center: center,
  };
}

function smokeSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(220,220,225,0.8)');
  g.addColorStop(1, 'rgba(180,180,190,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

// 火星/余烬粒子贴图：白热内核 + 橙色光晕（配合加色混合）
function sparkSprite() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,240,1)');
  g.addColorStop(0.35, 'rgba(255,190,90,0.9)');
  g.addColorStop(1, 'rgba(255,120,30,0)');
  x.fillStyle = g; x.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

// 混凝土场坪纹理（分缝网格 + 污渍 + 砾石噪点）
function makeConcreteTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  const R = rnd(31);
  x.fillStyle = '#8d9198'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 3200; i++) {          // 砾石与骨料噪点
    const s = 1 + R() * 2.5;
    const v = 110 + R() * 70;
    x.fillStyle = `rgba(${v},${v + 3},${v + 8},${0.2 + R() * 0.35})`;
    x.fillRect(R() * 512, R() * 512, s, s);
  }
  for (let i = 0; i < 90; i++) {            // 水渍/油污
    x.fillStyle = `rgba(70,74,80,${0.05 + R() * 0.12})`;
    x.beginPath(); x.arc(R() * 512, R() * 512, 6 + R() * 26, 0, Math.PI * 2); x.fill();
  }
  x.strokeStyle = 'rgba(58,62,68,0.55)'; x.lineWidth = 2.2;   // 分缝网格
  for (let i = 0; i <= 8; i++) {
    x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, 512); x.stroke();
    x.beginPath(); x.moveTo(0, i * 64); x.lineTo(512, i * 64); x.stroke();
  }
  x.strokeStyle = 'rgba(45,48,54,0.35)'; x.lineWidth = 1;
  for (let i = 0; i < 26; i++) {            // 裂纹
    x.beginPath(); let px = R() * 512, py = R() * 512; x.moveTo(px, py);
    for (let k = 0; k < 5; k++) { px += (R() - 0.5) * 46; py += (R() - 0.5) * 46; x.lineTo(px, py); }
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// 烧蚀黑斑纹理（以中心为导流槽口的放射状烟熏，历次发射留下的焦痕）
function makeScorchTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 320;
  const x = c.getContext('2d');
  const R = rnd(77);
  const cx = 256, cy = 160;
  const g = x.createRadialGradient(cx, cy, 4, cx, cy, 250);
  g.addColorStop(0, 'rgba(12,12,13,0.95)');
  g.addColorStop(0.3, 'rgba(24,22,22,0.72)');
  g.addColorStop(0.65, 'rgba(38,36,34,0.32)');
  g.addColorStop(1, 'rgba(40,38,36,0)');
  x.fillStyle = g; x.fillRect(0, 0, 512, 320);
  for (let i = 0; i < 54; i++) {            // 放射状烟熏条纹
    const a = R() * Math.PI * 2, len = 50 + R() * 190;
    x.strokeStyle = `rgba(20,19,18,${0.16 + R() * 0.3})`;
    x.lineWidth = 3 + R() * 11;
    x.beginPath(); x.moveTo(cx + Math.cos(a) * 10, cy + Math.sin(a) * 7);
    x.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len * 0.62); x.stroke();
  }
  for (let i = 0; i < 300; i++) {           // 飞溅的焦渣点
    const a = R() * Math.PI * 2, dd = 30 + R() * 210;
    x.fillStyle = `rgba(16,15,14,${0.2 + R() * 0.4})`;
    x.beginPath(); x.arc(cx + Math.cos(a) * dd, cy + Math.sin(a) * dd * 0.6, 1 + R() * 3.5, 0, Math.PI * 2); x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}


// 戈壁地表纹理（酒泉发射场：沙褐色戈壁 + 砾石噪点 + 干涸纹路）
function makeGroundTexture() {
  // 戈壁实景（不再是单色土黄）：多尺度 fbm 决定"沙 / 砾石 / 盐碱"分布，
  // 叠加干河床（蜿蜒暗色带）、砾石场（深色斑块）、稀疏灌木（暗绿点）与风蚀纹理。
  const W = 1024, H = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const img = x.createImageData(W, H);
  const fA = GLOBE.makeFbm(101), fB = GLOBE.makeFbm(202), fC = GLOBE.makeFbm(303);
  const clamp01 = (v) => v < 0 ? 0 : (v > 1 ? 1 : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const u = i / W, v = j / H;
      const broad = fA(u * 3.1, v * 3.1, 5);        // 大尺度地貌分布
      const grain = fB(u * 26, v * 26, 4);          // 沙砾颗粒
      const fine = fC(u * 90, v * 90, 2);           // 细砂纹理
      // ① 基底：浅沙 → 中沙（大尺度变化）
      let R = lerp(196, 168, broad), G = lerp(170, 142, broad), B = lerp(128, 104, broad);
      // ② 砾石场（broad 低值区 → 深灰褐）
      const gravel = clamp01((0.42 - broad) * 3.4);
      R = lerp(R, 132, gravel * 0.85); G = lerp(G, 120, gravel * 0.85); B = lerp(B, 104, gravel * 0.85);
      // ③ 盐碱/钙积层（broad 高值区 → 发白）
      const salt = clamp01((broad - 0.62) * 3.0);
      R = lerp(R, 214, salt * 0.7); G = lerp(G, 208, salt * 0.7); B = lerp(B, 190, salt * 0.7);
      // ④ 干河床：一条蜿蜒暗带（用 fbm 扰动直线距离）
      const bed = Math.abs(v - 0.34 - 0.16 * fA(u * 2.2, 5.7, 3));
      const bedK = clamp01((0.045 - bed) * 26) * clamp01(fB(u * 30, v * 30, 3) * 1.6);
      R = lerp(R, 118, bedK * 0.8); G = lerp(G, 104, bedK * 0.8); B = lerp(B, 86, bedK * 0.8);
      // ⑤ 颗粒与风蚀纹理
      const g2 = (grain - 0.5) * 34 + (fine - 0.5) * 18;
      R = clamp01((R + g2) / 255) * 255; G = clamp01((G + g2 * 0.95) / 255) * 255; B = clamp01((B + g2 * 0.85) / 255) * 255;
      // ⑥ 稀疏灌木（暗绿灰小点，集中在细腻沙地）
      const bush = fC(u * 160 + 3, v * 160 - 5, 3);
      if (bush > 0.82 && broad < 0.55) {
        const k = clamp01((bush - 0.82) * 6) * 0.75;
        R = lerp(R, 74, k); G = lerp(G, 78, k); B = lerp(B, 58, k);
      }
      const p = (j * W + i) * 4;
      img.data[p] = R; img.data[p + 1] = G; img.data[p + 2] = B; img.data[p + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.repeat.set(18, 18);
  return t;
}

// 箭体蒙皮纹理：白漆 + 环向焊缝 + 拼板缝 + 铆钉 + 流挂痕 + “中国航天”竖排刻字
// size 宽高比接近 周长/高 以保证世界空间中字符为正方形
function makeRocketSkin({ size = [1024, 1024], textUs = [], charColor = '#1d4fa8' }) {
  const [W, H] = size;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const R = rnd(77);
  const RH = rnd(77);   // 与颜色画布同序随机（特征位置一致）
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#eef1f4'); g.addColorStop(0.5, '#f4f6f8'); g.addColorStop(1, '#e9ecef');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  paintPlateFeatures(x, W, H, R, PLATE_COLOR_PAL, 6);
  const hc = makeHeightCanvas(W, H);
  paintPlateFeatures(hc.getContext('2d'), W, H, RH, PLATE_HEIGHT_PAL, 6);
  const chars = ['中', '国', '航', '天'];
  for (const u of textUs) {
    const fontPx = Math.round(H * 0.115);
    x.font = `bold ${fontPx}px "Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    const cx = u * W;
    const step = fontPx * 1.16;
    const startY = H * 0.47 - step * 1.5;
    chars.forEach((ch, i) => {
      const cy = startY + i * step;
      x.lineWidth = Math.max(2, fontPx * 0.022);
      x.strokeStyle = 'rgba(255,255,255,0.9)';
      x.strokeText(ch, cx, cy);
      x.fillStyle = charColor;
      x.fillText(ch, cx, cy);
    });
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return { map: t, normalMap: normalFromHeight(hc), roughnessMap: roughnessFromHeight(hc) };
}

// 五角星（国旗用）
function star5(x, cx, cy, r, rot) {
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = (i % 2 === 0) ? r : r * 0.42;
    const a = rot + i * Math.PI / 5 - Math.PI / 2;
    const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
    i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
  }
  x.closePath();
}

// ================= 表面贴图升级：版线/铆钉特征 + 法线/粗糙度派生 =================
// 思路：同一段"特征绘制"代码分别画到「颜色画布」和「高度画布」上，
// 保证 map 与 normalMap/roughnessMap 的坐标严格对齐；高度画布再派生出法线与粗糙度。

// 版线/焊缝/铆钉/流痕特征绘制。pal 决定是画在颜色上还是画在高度上
function paintPlateFeatures(x, W, H, R, pal, rows = 6) {
  // 环向焊缝
  x.strokeStyle = pal.seam; x.lineWidth = pal.seamW;
  for (let j = 1; j < rows; j++) { const y = (H / rows) * j; x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); }
  // 纵向拼板缝
  x.strokeStyle = pal.seamSoft; x.lineWidth = pal.seamW * 0.72;
  for (let i = 1; i < 8; i++) { const px = (W / 8) * i; x.beginPath(); x.moveTo(px, 0); x.lineTo(px, H); x.stroke(); }
  // 铆钉（暗钉 + 亮缘，环缝上下各一排）
  for (let j = 1; j < rows; j++) {
    const y = (H / rows) * j;
    for (let i = 6; i < W; i += 13) {
      for (const dy of [-7, 7]) {
        const px = i + (dy > 0 ? 6 : 0), py = y + dy;
        x.fillStyle = pal.rivetDark; x.beginPath(); x.arc(px, py, 2.0, 0, Math.PI * 2); x.fill();
        x.fillStyle = pal.rivetLight; x.beginPath(); x.arc(px - 0.6, py - 0.6, 0.85, 0, Math.PI * 2); x.fill();
      }
    }
  }
  // 纵向拼缝铆钉
  for (let i = 1; i < 8; i++) {
    const px = (W / 8) * i;
    for (let y = 8; y < H; y += 15) { x.fillStyle = pal.rivetDark; x.beginPath(); x.arc(px + 7, y, 1.8, 0, Math.PI * 2); x.fill(); }
  }
  // 漆面颗粒
  for (let i = 0; i < 2600; i++) {
    x.fillStyle = `rgba(${pal.speckRGB},${(pal.speckA * (0.4 + R())).toFixed(3)})`;
    x.fillRect(R() * W, R() * H, 1.5, 1.5);
  }
  // 竖向流痕
  for (let i = 0; i < 26; i++) {
    const px = R() * W, py = R() * H * 0.5, len = H * (0.1 + R() * 0.35);
    x.fillStyle = pal.streak; x.fillRect(px, py, 3 + R() * 7, len);
  }
}

// 颜色palette（画在颜色画布上）
const PLATE_COLOR_PAL = {
  seam: 'rgba(132,142,154,0.34)', seamSoft: 'rgba(150,158,168,0.22)', seamW: 2.2,
  rivetDark: 'rgba(120,130,146,0.30)', rivetLight: 'rgba(255,255,255,0.22)',
  speckRGB: '125,135,150', speckA: 0.18, streak: 'rgba(150,150,140,0.055)',
};
// 高度palette（画在高度画布上：灰底 128，凹槽偏暗、钉缘偏亮）
const PLATE_HEIGHT_PAL = {
  seam: 'rgba(66,66,66,0.8)', seamSoft: 'rgba(100,100,100,0.5)', seamW: 2.6,
  rivetDark: 'rgba(74,74,74,0.8)', rivetLight: 'rgba(196,196,196,0.85)',
  speckRGB: '112,112,112', speckA: 0.14, streak: 'rgba(146,146,146,0.09)',
};

// 新建"高度画布"（不透明灰底，供派生法线/粗糙度；willReadFrequently 抑制读回告警并提速）
function makeHeightCanvas(W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#808080'; x.fillRect(0, 0, W, H);
  return c;
}

// 由高度画布派生法线贴图（Sobel 求梯度，绿色通道向上约定）
function normalFromHeight(heightCanvas, strength = 2.2) {
  const W = heightCanvas.width, H = heightCanvas.height;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, W, H).data;
  const lum = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) lum[i] = (src[i * 4] * 0.299 + src[i * 4 + 1] * 0.587 + src[i * 4 + 2] * 0.114) / 255;
  const at = (px, py) => lum[((py + H) % H) * W + ((px + W) % W)];
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let px = 0; px < W; px++) {
      const dx = (at(px + 1, y) - at(px - 1, y)) * strength;
      const dy = (at(px, y + 1) - at(px, y - 1)) * strength;
      let nx = -dx, ny = dy, nz = 1;                 // 画布 y 向下，翻转轴向以匹配贴图 v 向上
      const inv = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      const o = (y * W + px) * 4;
      out[o] = (nx * inv * 0.5 + 0.5) * 255;
      out[o + 1] = (ny * inv * 0.5 + 0.5) * 255;
      out[o + 2] = (nz * inv * 0.5 + 0.5) * 255;
      out[o + 3] = 255;
    }
  }
  return rgbaToTexture(out, W, H);
}

// 由高度画布派生粗糙度贴图：凹槽/焊缝更粗糙，钉缘更光滑，白漆基体 ≈ base
function roughnessFromHeight(heightCanvas, base = 0.44, span = 0.5) {
  const W = heightCanvas.width, H = heightCanvas.height;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, W, H).data;
  const out = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const l = (src[i * 4] * 0.299 + src[i * 4 + 1] * 0.587 + src[i * 4 + 2] * 0.114) / 255;
    const v = Math.max(0, Math.min(1, base + (0.502 - l) * span));
    const g = v * 255, o = i * 4;
    out[o] = out[o + 1] = out[o + 2] = g; out[o + 3] = 255;
  }
  return rgbaToTexture(out, W, H);
}

// RGBA 数据 → 贴图（走画布，与 CanvasTexture 的 flipY 约定保持一致，避免法线上下镜像）
function rgbaToTexture(data, W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  c.getContext('2d').putImageData(new ImageData(data, W, H), 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  return t;   // 法线/粗糙度保持线性色彩空间（不设 SRGB）
}

// 上级（二级+仪器舱）标识蒙皮：国旗 → 神箭 → CASC 徽标 → 中国航天 → CZ-2F/Y23
// 对应实拍：国旗位于芯级上部，其下依次为红色「神箭」、蓝色圆徽、蓝色「中国航天」大字、型号
function makeUpperSkin() {
  const W = 1024, H = 1536;   // 二级周长 10.52m / 高 15.4m ≈ 0.68
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const R = rnd(313);
  const RH = rnd(313);   // 与颜色画布同序随机，保证两张画布的特征位置完全一致
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#eef1f4'); g.addColorStop(0.5, '#f5f7f9'); g.addColorStop(1, '#e9ecef');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  paintPlateFeatures(x, W, H, R, PLATE_COLOR_PAL, 7);
  const hc = makeHeightCanvas(W, H);
  paintPlateFeatures(hc.getContext('2d'), W, H, RH, PLATE_HEIGHT_PAL, 7);

  const BLUE = '#1a3f96', RED = '#c8102e', GOLD = '#ffde00';
  const cols = [0.13, 0.63];   // 前后两面均有标识

  for (const u of cols) {
    const cxp = u * W;
    let y = H * 0.055;
    // 1) 国旗（红底五星）
    const fw = W * 0.19, fh = fw * 0.667;
    x.fillStyle = RED; x.fillRect(cxp - fw / 2, y, fw, fh);
    x.fillStyle = GOLD;
    star5(x, cxp - fw * 0.26, y + fh * 0.30, fw * 0.135, 0); x.fill();
    const smalls = [[0.10, 0.10], [0.20, 0.18], [0.29, 0.20], [0.25, 0.32]];
    for (const [dx, dy] of smalls) { star5(x, cxp - fw * 0.5 + fw * dx, y + fh * dy, fw * 0.046, 0); x.fill(); }
    y += fh + H * 0.030;

    // 2) 红色竖排「神箭」
    const fontS = Math.round(H * 0.052);
    x.font = `bold ${fontS}px "Microsoft YaHei","KaiTi",serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = RED;
    ['神', '箭'].forEach((ch, i) => x.fillText(ch, cxp, y + fontS * 0.6 + i * fontS * 1.12));
    y += fontS * 2.4 + H * 0.028;

    // 3) CASC 圆形蓝色徽标
    const lr = W * 0.062;
    x.strokeStyle = BLUE; x.lineWidth = Math.max(3, lr * 0.16);
    x.beginPath(); x.arc(cxp, y + lr, lr, 0, Math.PI * 2); x.stroke();
    x.fillStyle = BLUE;
    x.beginPath(); x.moveTo(cxp, y + lr * 0.34); x.lineTo(cxp + lr * 0.5, y + lr * 1.5); x.lineTo(cxp - lr * 0.5, y + lr * 1.5); x.closePath(); x.fill();
    x.font = `bold ${Math.round(lr * 0.46)}px "Microsoft YaHei",sans-serif`;
    x.fillText('CASC', cxp, y + lr * 1.66);
    y += lr * 2.2 + H * 0.030;

    // 4) 蓝色竖排「中国航天」大字
    const bigF = Math.round(H * 0.086);
    x.font = `bold ${bigF}px "Microsoft YaHei","PingFang SC",sans-serif`;
    x.fillStyle = BLUE;
    ['中', '国', '航', '天'].forEach((ch, i) => x.fillText(ch, cxp, y + bigF * 0.6 + i * bigF * 1.12));
    y += bigF * 4.7 + H * 0.026;

    // 5) 蓝色型号「CZ-2F」「Y23」
    const midF = Math.round(H * 0.050);
    x.font = `bold ${midF}px "Microsoft YaHei",sans-serif`;
    x.fillStyle = BLUE;
    x.fillText('CZ-2F', cxp, y + midF * 0.6);
    x.font = `bold ${Math.round(midF * 0.78)}px "Microsoft YaHei",sans-serif`;
    x.fillText('Y23', cxp, y + midF * 1.65);
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return { map: t, normalMap: normalFromHeight(hc), roughnessMap: roughnessFromHeight(hc) };
}

// 整流罩专属蒙皮：对应实拍（自上而下）国旗 → 蓝色徽标 → 红「神箭」+ 两侧红白棋盘格条 → 蓝色环带
// UV 对应：v=1 为罩顶（截断面）、v≈FAIR_CYL/FAIR_TOTAL 为锥柱交界、v=0 为罩底；u=0.5 为半罩外面正中
function makeFairSkin() {
  const W = 1024, H = 1024;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const R = rnd(907);
  const RH = rnd(907);   // 与颜色画布同序随机（特征位置一致）
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#eef1f4'); g.addColorStop(0.5, '#f5f7f9'); g.addColorStop(1, '#e9ecef');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  paintPlateFeatures(x, W, H, R, PLATE_COLOR_PAL, 6);
  const hc = makeHeightCanvas(W, H);
  paintPlateFeatures(hc.getContext('2d'), W, H, RH, PLATE_HEIGHT_PAL, 6);

  const BLUE = '#1a3f96', RED = '#c8102e', GOLD = '#ffde00';
  const pxPerMu = W / 5.96;    // u 向 1px ≈ 0.00582m（半周长 5.96m）
  const pxPerMv = H / 10.5;    // v 向 1px ≈ 0.01024m（罩高 10.5m）
  const gy = (ym) => (1 - ym / 10.5) * H;   // 几何高度 → 画布 y
  const cxp = W * 0.5;

  // 1) 国旗（锥柱交界下方，红底五星；宽 1.05m 高 0.70m，u/v 像素尺度分别换算）
  const fw = 1.05 * pxPerMu, fh = 0.70 * pxPerMv;
  const fy = gy(6.55);
  x.fillStyle = RED; x.fillRect(cxp - fw / 2, fy, fw, fh);
  x.fillStyle = GOLD;
  star5(x, cxp - fw * 0.26, fy + fh * 0.30, fw * 0.135, 0); x.fill();
  const smalls = [[0.10, 0.10], [0.20, 0.18], [0.29, 0.20], [0.25, 0.32]];
  for (const [dx, dy] of smalls) { star5(x, cxp - fw * 0.5 + fw * dx, fy + fh * dy, fw * 0.046, 0); x.fill(); }

  // 2) 蓝色方形徽标（国旗右侧，白描 CZ 字样；世界尺寸 0.42m 见方）
  const lw = 0.42 * pxPerMu, lh = 0.42 * pxPerMv;
  const lx = cxp + fw / 2 + 0.22 * pxPerMu, ly = gy(6.35);
  x.fillStyle = BLUE; x.fillRect(lx, ly, lw, lh);
  x.fillStyle = '#f2f4f7';
  x.font = `bold ${Math.round(lh * 0.52)}px "Microsoft YaHei",sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('CZ', lx + lw / 2, ly + lh * 0.54);

  // 3) 红色竖排「神箭」+ 两侧红白棋盘格条（对应实拍罩体中下部）
  // 汉字世界尺寸约 0.95m 见方：先横向缩放补偿 u/v 像素尺度差，保证字不压扁
  const fontS = Math.round(0.95 * pxPerMv);
  x.save();
  x.translate(cxp, 0);
  x.scale(pxPerMv / pxPerMu, 1);
  x.font = `bold ${fontS}px "Microsoft YaHei","KaiTi",serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = RED;
  x.fillText('神', 0, gy(4.35));
  x.fillText('箭', 0, gy(3.25));
  x.restore();
  const sq = 0.34;                                   // 棋盘格边长（米）
  const colDx = 0.78 * pxPerMu;                      // 距中心横向偏移
  const stripW = sq * pxPerMu, stripH = sq * pxPerMv;
  for (const sx of [cxp - colDx - stripW, cxp + colDx]) {
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 2; col++) {
        if ((row + col) % 2) continue;
        const py = gy(5.15 - row * sq) , pxx = sx + col * stripW;
        x.fillStyle = RED; x.fillRect(pxx, py, stripW, stripH);
      }
    }
  }

  // 4) 下部蓝色环带
  x.fillStyle = BLUE;
  x.fillRect(0, gy(1.15), W, 0.42 * pxPerMv);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return { map: t, normalMap: normalFromHeight(hc), roughnessMap: roughnessFromHeight(hc) };
}
function makeHazardTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, '#e8ebee'); g.addColorStop(0.5, '#f3f5f7'); g.addColorStop(1, '#e2e5e8');
  x.fillStyle = g; x.fillRect(0, 0, 256, 64);
  for (let i = -2; i < 8; i++) {          // 斜向红条
    const ox = i * 40;
    x.beginPath();
    x.moveTo(ox, 64); x.lineTo(ox + 18, 64); x.lineTo(ox + 46, 0); x.lineTo(ox + 28, 0);
    x.closePath(); x.fillStyle = '#c8102e'; x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  return t;
}

// 夜间天空穹顶（深蓝黑天顶 → 地平线微弱暖光）
function makeNightSkyTexture() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 512;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0.0, '#04060c');
  g.addColorStop(0.45, '#070c16');
  g.addColorStop(0.72, '#0e1524');
  g.addColorStop(0.86, '#1d2030');
  g.addColorStop(0.94, '#33291f');   // 地平线附近受尾焰/灯光影响的暖调
  g.addColorStop(1.0, '#14120f');
  x.fillStyle = g; x.fillRect(0, 0, 32, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 钟形喷管轮廓（喉部快速扩张后趋缓，真实拉瓦尔喷管外形）
function bellProfile(rThroat, rExit, len, seg = 14) {
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const r = rThroat + (rExit - rThroat) * Math.pow(t, 0.62);
    pts.push(new THREE.Vector2(r, -len * t));
  }
  return pts;
}

// 单台液体发动机：钟形喷管（外壁 + 内腔碳化面 + 再生冷却管束）+ 涡轮排气管 + 万向环/作动筒 + 腔内点火辉光
// 注意：bellProfile 的母线下行（y 由 0 到 -len），故喷口天然朝下，不要再翻转（旧代码 rotation.x = PI 把喷管转进了箭体内）
function makeEngine({ rThroat, rExit, len, tubes = 14, frame = true }, mats) {
  const g = new THREE.Group();
  const glows = [];
  // 外壁 + 内腔（内腔略收，看到的是碳化暗面）
  g.add(new THREE.Mesh(new THREE.LatheGeometry(bellProfile(rThroat, rExit, len, 18), 40), mats.nozzle));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(bellProfile(rThroat * 0.86, rExit * 0.955, len * 0.97, 12), 36), mats.inner));
  // 再生冷却管束：沿锥面母线的细管，按方位实例化（一次 draw call）
  {
    const p0 = new THREE.Vector3(rThroat * 0.99, 0.03, 0);
    const p1 = new THREE.Vector3(rExit * 0.985, -len * 0.95, 0);
    const mid = p0.clone().add(p1).multiplyScalar(0.5);
    const dir = p1.clone().sub(p0);
    const tubeGeo = new THREE.CylinderGeometry(0.016, 0.016, dir.length(), 5, 1, true);
    const q0 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const inst = new THREE.InstancedMesh(tubeGeo, mats.rib, tubes);
    const m = new THREE.Matrix4();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < tubes; i++) {
      const rot = new THREE.Quaternion().setFromAxisAngle(up, (i / tubes) * Math.PI * 2);
      const off = mid.clone().applyQuaternion(rot);
      m.compose(off, rot.clone().multiply(q0), new THREE.Vector3(1, 1, 1));
      inst.setMatrixAt(i, m);
    }
    inst.frustumCulled = false;
    g.add(inst);
  }
  // 燃烧室
  const chamber = new THREE.Mesh(new THREE.CylinderGeometry(rThroat * 1.45, rThroat * 1.12, 0.5, 20), mats.tube);
  chamber.position.y = 0.26; g.add(chamber);
  if (frame) {
    const gimbal = new THREE.Mesh(new THREE.TorusGeometry(rThroat * 1.3, 0.03, 8, 20), mats.bolt);
    gimbal.rotation.x = Math.PI / 2; gimbal.position.y = 0.46; g.add(gimbal);
    for (const s of [-1, 1]) {                       // 摇摆作动筒 x2
      const act = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.042, 0.55, 10), mats.bolt);
      act.position.set(s * rThroat * 1.45, 0.06, 0); act.rotation.z = s * 0.3; g.add(act);
    }
    for (const s of [-1, 1]) {                       // 燃气发生器排气管：自燃烧室外侧贴着喷管外缘向下弯出
      const pr = rThroat * 0.24;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(s * rThroat * 1.35, 0.42, 0),
        new THREE.Vector3(s * rThroat * 1.9, 0.05, 0.12),
        new THREE.Vector3(s * rExit * 0.72, -len * 0.45, 0.16),
        new THREE.Vector3(s * rExit * 0.58, -len * 0.86, 0.14),
      ]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 18, pr, 8, false), mats.tube));
      const mouth = new THREE.Mesh(new THREE.ConeGeometry(pr * 1.5, 0.16, 10), mats.nozzle);
      mouth.position.set(s * rExit * 0.58, -len * 0.94, 0.14); mouth.rotation.x = Math.PI; g.add(mouth);
    }
  }
  // 腔内点火辉光（随推力亮起）
  const disc = new THREE.Mesh(new THREE.CircleGeometry(rExit * 0.66, 28), mats.glow);
  disc.rotation.x = Math.PI / 2; disc.position.y = -len * 0.86; disc.visible = false;
  glows.push(disc); g.add(disc);
  return { group: g, glows };
}

// 部段对接环：白带 + 暗线 + 白带 + 一圈螺栓（实拍中每个部段交界都有明显分界）
function makeJointRing(r, boltCount, mats) {
  const g = new THREE.Group();
  const band = (rr, h, m, y) => { const mm = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr, h, 48), m); mm.position.y = y; g.add(mm); };
  band(r + 0.012, 0.10, mats.band, 0.075);
  band(r + 0.018, 0.05, mats.seam, 0);
  band(r + 0.012, 0.10, mats.band, -0.075);
  // 螺栓用实例化（一圈 20 余颗，逐颗建模会白耗上百个 mesh）
  const boltGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.055, 8);
  const bolts = new THREE.InstancedMesh(boltGeo, mats.bolt, boltCount);
  const m = new THREE.Matrix4();
  for (let i = 0; i < boltCount; i++) {
    const a = (i / boltCount) * Math.PI * 2;
    m.makeTranslation(Math.cos(a) * (r + 0.024), 0.1, Math.sin(a) * (r + 0.024));
    bolts.setMatrixAt(i, m);
  }
  bolts.frustumCulled = false;
  g.add(bolts);
  return g;
}

// 纵向电缆罩：Π 形截面沿母线挤出 + 每隔 1.6m 一个卡箍（替代原来的细长方盒，几何上更接近实拍）
// 返回的 group 局部 y 从 0 到 len，由调用方设置 position.y 与朝向
function makeRaceway(r, len, mats) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(0, 0.08); s.lineTo(0.10, 0.08); s.lineTo(0.10, -0.08); s.lineTo(0, -0.08);
  s.lineTo(0, -0.055); s.lineTo(0.055, -0.055); s.lineTo(0.055, 0.055); s.lineTo(0, 0.055);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false }), mats.race);
  body.rotation.x = -Math.PI / 2;      // 挤出方向（+Z）转为世界 +Y
  body.position.set(r, 0, 0);
  g.add(body);
  for (let y = 0.9; y < len - 0.4; y += 1.6) {
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.05, 0.185), mats.race);
    clip.position.set(r + 0.045, y, 0);
    g.add(clip);
  }
  return g;
}

// 稳定尾翼（梯形，贴合芯级底部）
function makeFinGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(1.75, -0.25);
  s.lineTo(1.55, -2.0);
  s.lineTo(0, -2.35);
  s.lineTo(0, 0);
  return new THREE.ExtrudeGeometry(s, { depth: 0.09, bevelEnabled: false });
}

// 构建完整发射组合体
function buildRig() {
  const rig = new THREE.Group();
  rig.visible = false;

  // ---- 地球地表 + 发射设施（site 组，升空后整体淡出，让位于在轨地球）----
  const site = new THREE.Group();
  rig.add(site);
  const siteMats = new Set();
  const groundMat = new THREE.MeshStandardMaterial({ map: makeGroundTexture(), color: 0xffffff, metalness: 0.02, roughness: 0.96, transparent: true });
  siteMats.add(groundMat);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(8000, 72), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0;
  ground.receiveShadow = true;
  site.add(ground);
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x6e6152, metalness: 0.02, roughness: 1.0, transparent: true });
  siteMats.add(hillMat);
  const HR = rnd(99);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + HR() * 0.3;
    const dist = 1300 + HR() * 1600;
    const h = 70 + HR() * 150, r = 300 + HR() * 420;
    const hill = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7 + ((HR() * 4) | 0)), hillMat);
    hill.position.set(Math.cos(a) * dist, h * 0.28, Math.sin(a) * dist);
    hill.scale.y = 0.9 + HR() * 0.5;
    site.add(hill);
  }
  // 混凝土场坪：发射台周围大片水泥地坪（分缝网格 + 污渍 + 裂纹）
  const apronMat = new THREE.MeshStandardMaterial({ map: makeConcreteTexture(), color: 0xffffff, metalness: 0.05, roughness: 0.93, transparent: true });
  apronMat.map.repeat.set(7, 7);
  siteMats.add(apronMat);
  const apron = new THREE.Mesh(new THREE.CircleGeometry(64, 48), apronMat);
  apron.rotation.x = -Math.PI / 2; apron.position.y = 0.04;
  apron.receiveShadow = true;
  site.add(apron);

  const padMat = new THREE.MeshStandardMaterial({ color: 0x59606a, metalness: 0.42, roughness: 0.68, transparent: true });
  siteMats.add(padMat);
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(12, 13.4, 1.4, 40), padMat);
  pad.position.y = 0.7;
  pad.receiveShadow = true; pad.castShadow = true;
  site.add(pad);
  // 发射台钢裙立柱 + 脐带支撑
  const padSteel = new THREE.MeshStandardMaterial({ color: 0x4b525c, metalness: 0.68, roughness: 0.45, transparent: true });
  siteMats.add(padSteel);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.5, 0.42), padSteel);
    post.position.set(Math.cos(a) * 10.6, 1.15, Math.sin(a) * 10.6);
    post.rotation.y = -a; post.castShadow = true; site.add(post);
  }

  // 导流槽：发射台侧向的深色开口 + 混凝土导流墙（点火后燃气由此导出）
  const trenchMat = new THREE.MeshStandardMaterial({ color: 0x1c1f24, metalness: 0.25, roughness: 0.9, transparent: true });
  const trenchWallMat = new THREE.MeshStandardMaterial({ color: 0x6f757d, metalness: 0.1, roughness: 0.95, transparent: true });
  siteMats.add(trenchMat); siteMats.add(trenchWallMat);
  const flameTrench = new THREE.Mesh(new THREE.BoxGeometry(14, 2.4, 9), trenchMat);
  flameTrench.position.set(0, 0.5, 12); flameTrench.receiveShadow = true;
  site.add(flameTrench);
  for (const dz of [8.2, 15.8]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(14, 1.5, 0.7), trenchWallMat);
    wall.position.set(0, 0.55, dz); wall.receiveShadow = true; wall.castShadow = true; site.add(wall);
  }
  // 烧蚀黑斑：导流槽口向外的放射状烟熏（历次发射留下的焦痕）
  const scorchMat = new THREE.MeshBasicMaterial({ map: makeScorchTexture(), transparent: true, depthWrite: false, opacity: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const scorch = new THREE.Mesh(new THREE.PlaneGeometry(48, 32), scorchMat);
  scorch.rotation.x = -Math.PI / 2; scorch.position.set(0, 0.2, 8);
  site.add(scorch);

  // 避雷塔 x4（细格构塔 + 顶部航空障碍灯：用自发光小球，不占真实光源名额）
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x99a1ab, metalness: 0.55, roughness: 0.5, transparent: true });
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff5a3c, transparent: true });   // transparent：随 site 整体淡出，红灯不残留空中
  siteMats.add(mastMat); siteMats.add(beaconMat);
  for (const [mx, mz] of [[-23, -21], [23, -21], [-23, 25], [25, 21]]) {
    const mast = new THREE.Group();
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.52, 74, 6), mastMat);
    col.position.y = 37; col.castShadow = true; mast.add(col);
    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.8 - i * 0.7, 0.18, 0.18), mastMat);
      arm.position.y = 50 + i * 8; mast.add(arm);
    }
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), beaconMat);
    tip.position.y = 74.4; mast.add(tip);
    mast.position.set(mx, 0, mz);
    site.add(mast);
  }

  // 场区道路：从发射台向外辐射的水泥路
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x767b83, metalness: 0.04, roughness: 0.95, transparent: true });
  siteMats.add(roadMat);
  for (const [ra, len] of [[Math.PI / 2, 200], [Math.PI * 1.1, 250], [-Math.PI / 3, 170]]) {
    const rg = new THREE.Group(); rg.rotation.y = ra;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(9, len), roadMat);
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0.12, len / 2);
    road.receiveShadow = true; rg.add(road); site.add(rg);
  }

  // 远方保障设施：测试厂房 + 推进剂贮罐
  const bldMat = new THREE.MeshStandardMaterial({ color: 0x8b9099, metalness: 0.12, roughness: 0.85, transparent: true });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0xd9dde2, metalness: 0.2, roughness: 0.55, transparent: true });
  siteMats.add(bldMat); siteMats.add(tankMat);
  const b1 = new THREE.Mesh(new THREE.BoxGeometry(46, 18, 22), bldMat); b1.position.set(-190, 9, -270); site.add(b1);
  const b2 = new THREE.Mesh(new THREE.BoxGeometry(26, 11, 34), bldMat); b2.position.set(-125, 5.5, -315); site.add(b2);
  for (let i = 0; i < 4; i++) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 12, 18), tankMat);
    tank.position.set(150 + i * 20, 6, -340); site.add(tank);
  }

  // 场坪泛光灯 x2（冷白，照亮发射台与箭体下部；与塔架泛光灯共同构成夜间照明）
  const apronLights = [];
  for (const [lx, lz] of [[-32, 20], [32, 20]]) {
    const L = new THREE.PointLight(0xe6eeff, 3.6, 120, 1.6);
    L.position.set(lx, 7, lz);
    site.add(L); apronLights.push(L);
  }

  // ---- 地球大气：夜间天空穹顶（实拍为夜间发射）----
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(5200, 40, 24),
    // 加色叠加：烘焙渐变只作为"星空/暖地平线"叠加层，不遮挡 sky.js 的动态渐变天空
    new THREE.MeshBasicMaterial({ map: makeNightSkyTexture(), side: THREE.BackSide, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
  );
  // === 天空渐变穹顶（sky.js）：随高度分层变色 + 地平线气辉；位于星空穹顶之内 ===
  const skyGrad = buildSkyGradient(5000);
  rig.add(skyGrad.mesh);
  skyDome.renderOrder = 900;
  rig.add(skyDome);
  // === BUG3 修复：高空弧形地球 + 大气边缘辉光 ===
  // 半径 2600 的球心放在 (rocketX, -2600, 0)：地表在发射点触地，随高度上升地平线自然弯曲；
  // 低空完全透明，随大气消散逐渐浮现，营造"入轨俯瞰地球"的高度感（全程平滑无跳变）
  const earthBall = new THREE.Mesh(
    new THREE.SphereGeometry(2600, 48, 32),
    new THREE.MeshBasicMaterial({ color: 0x16324f, transparent: true, opacity: 0, fog: false })
  );
  // 高空地球本体：首次进入高空时按需生成真实地表（512×256，约 1/4 于轨道版的生成量），
  // 避免拖慢首帧；生成后材质替换为 海洋/陆地/沙漠/冰盖 + 法线浮雕，并挂一层自转云层。
  let earthGlobeReady = false;
  function ensureEarthGlobe() {
    if (earthGlobeReady) return;
    earthGlobeReady = true;
    try {
      const tex = GLOBE.buildEarthSurface({ w: 512, h: 256, seed: 20260927, seaLevel: 0.52, relief: 1.0 });
      const old = earthBall.material;
      earthBall.material = new THREE.MeshStandardMaterial({
        map: tex.map, roughnessMap: tex.rough, normalMap: tex.normal,
        roughness: 1.0, metalness: 0.0, transparent: true, opacity: old.opacity, fog: false,
      });
      old.dispose();
      const cloudTex = GLOBE.buildCloudTexture({ w: 512, h: 256, seed: 424242 });
      const clouds = new THREE.Mesh(
        new THREE.SphereGeometry(2600 * 1.012, 48, 32),
        new THREE.MeshStandardMaterial({ map: cloudTex, transparent: true, depthWrite: false, roughness: 1.0, metalness: 0.0, fog: false, opacity: 0.82 })
      );
      clouds.name = 'earthClouds';
      earthBall.add(clouds);
    } catch (e) { earthGlobeReady = false; console.warn('[earth] 地表生成失败，保留单色球', e); }
  }
  earthBall.visible = false;
  earthBall.rotation.z = 0.41;   // 黄赤交角倾斜：高空俯视时看到中纬度大陆而非正对极点
  rig.add(earthBall);
  // 大气边缘：瑞利散射 limb glow（内缘蔚蓝 → 外缘淡青），由 globe.js 生成
  const atmoRim = new THREE.Mesh(
    new THREE.SphereGeometry(2650, 48, 32), GLOBE.buildAtmosphereMaterial({ inner: 0x5aa9ff, outer: 0x9fd4ff, power: 2.4, strength: 0 })
  );
  atmoRim.renderOrder = 800;
  atmoRim.visible = false;
  rig.add(atmoRim);
  const sunCanvas = document.createElement('canvas');
  sunCanvas.width = sunCanvas.height = 128;
  const sx = sunCanvas.getContext('2d');
  const sg = sx.createRadialGradient(64, 64, 0, 64, 64, 64);
  sg.addColorStop(0, 'rgba(255,252,235,1)');
  sg.addColorStop(0.25, 'rgba(255,240,200,0.85)');
  sg.addColorStop(1, 'rgba(255,230,180,0)');
  sx.fillStyle = sg; sx.fillRect(0, 0, 128, 128);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(sunCanvas), transparent: true, depthWrite: false, fog: false,
  }));
  sun.position.set(1800, 3400, -2400);
  sun.scale.setScalar(950);
  sun.visible = false;          // 夜间发射：无太阳 glare
  rig.add(sun);

  // === ③ 发射塔（模块化：src/tower.js）===
  // 结构：四腿格构塔体 + 按箭体分段布设的平台层 + 黄色脐带摆杆（含管线）+ 底部支撑压紧机构；
  // 桁架构件/护栏全部实例化（数百构件 → 个位数 draw call）；机构姿态由时刻 t 唯一决定，
  // 且带"起飞前摆杆必须撤清"的互锁约束。
  const towerMod = buildTower({ siteMats });
  const tower = towerMod.group;
  const towerArms = towerMod.arms;
  const towerLights = towerMod.lights;
  site.add(tower);

  // 火箭（整体上升）
  const rocket = new THREE.Group();
  rig.add(rocket);

  // ---- 箭体材质（漆面：低金属度、中低粗糙度，反射靠环境贴图；bumpMap 增强拼板缝立体感）----
  if (window.__PERF) window.__PERF.marks['tex-start'] = performance.now() - window.__PERF.t0;
  const skinCore = makeRocketSkin({ size: [1024, 1024], textUs: [0.12, 0.62] });
  const skinPlain = makeRocketSkin({ size: [1024, 1024], textUs: [] });
  const skinFair = makeFairSkin();
  const skinUpper = makeUpperSkin();                 // 国旗/神箭/CASC/中国航天/CZ-2F/Y23
  if (window.__PERF) window.__PERF.marks['tex-end'] = performance.now() - window.__PERF.t0;
  const hazardTex = makeHazardTexture();             // 红白斜纹危险带
  // 表面材质：白漆为半光漆（低金属度 + 清漆层），配合法线/粗糙度贴图呈现铆钉与焊缝起伏
  const PAINT = { metalness: 0.06, clearcoat: 0.34, clearcoatRoughness: 0.28, envMapIntensity: 0.9 };
  const paintMat = (set, extra = {}) => new THREE.MeshPhysicalMaterial({
    map: set.map, normalMap: set.normalMap, normalScale: new THREE.Vector2(0.7, 0.7),
    roughnessMap: set.roughnessMap, roughness: 1.0,   // 粗糙度绝对值由贴图给出
    ...PAINT, ...extra,
  });
  const white = paintMat(skinPlain);
  const coreSkinMat = paintMat(skinCore);
  const upperSkinMat = paintMat(skinUpper);          // 二级：国旗/神箭/CASC/中国航天/CZ-2F/Y23
  const hazardMat = new THREE.MeshStandardMaterial({ map: hazardTex, color: 0xffffff, metalness: 0.12, roughness: 0.5 });
  const whiteDark = new THREE.MeshStandardMaterial({ color: 0xc7ccd3, metalness: 0.35, roughness: 0.48 });
  const red = new THREE.MeshStandardMaterial({ color: 0xb23b3b, metalness: 0.15, roughness: 0.45 });
  const nozzle = new THREE.MeshStandardMaterial({ color: 0x2a2d33, metalness: 0.92, roughness: 0.3 });
  const raceMat = new THREE.MeshStandardMaterial({ color: 0xb9bfc7, metalness: 0.45, roughness: 0.5 });
  const interMat = new THREE.MeshStandardMaterial({ color: 0x3d424a, metalness: 0.6, roughness: 0.5 });
  const gridMat = new THREE.MeshStandardMaterial({ color: 0x8d949c, metalness: 0.7, roughness: 0.4 });
  // 发动机尾段材质组
  const engMats = {
    nozzle,
    inner: new THREE.MeshStandardMaterial({ color: 0x241f1c, metalness: 0.45, roughness: 0.72, side: THREE.DoubleSide }),   // 喷管内腔（碳化暗面）
    tube: new THREE.MeshStandardMaterial({ color: 0xa7adb5, metalness: 0.82, roughness: 0.3 }),                              // 涡轮排气管/燃烧室
    rib: new THREE.MeshStandardMaterial({ color: 0x5f6266, metalness: 0.72, roughness: 0.42 }),                               // 再生冷却管束（贴近喷管本色）
    bolt: new THREE.MeshStandardMaterial({ color: 0x8f959d, metalness: 0.78, roughness: 0.36 }),                             // 万向环/作动筒
    glow: new THREE.MeshBasicMaterial({ color: 0xffcf95, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  };
  // 部段对接环 / 电缆罩材质组
  const jointMats = {
    band: whiteDark,
    seam: new THREE.MeshStandardMaterial({ color: 0x596069, metalness: 0.5, roughness: 0.55 }),
    bolt: new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.75, roughness: 0.38 }),
    race: new THREE.MeshStandardMaterial({ color: 0xb9bfc7, metalness: 0.5, roughness: 0.45 }),
  };
  const engineGlows = [];   // 腔内点火辉光（随推力切换）

  // 芯一级（含电缆罩、稳定尾翼、四机并联钟形喷管）
  const core = new THREE.Group();
  const coreBody = new THREE.Mesh(new THREE.CylinderGeometry(R_CORE, R_CORE, H_CORE1, 64), coreSkinMat);
  coreBody.position.y = H_CORE1 / 2; core.add(coreBody);
  // 底部红白斜纹危险标识带（对应实拍）
  const coreHazard = new THREE.Mesh(new THREE.CylinderGeometry(R_CORE + 0.02, R_CORE + 0.02, 1.8, 64), hazardMat);
  coreHazard.position.y = 1.5; core.add(coreHazard);
  const coreBand = new THREE.Mesh(new THREE.CylinderGeometry(R_CORE + 0.02, R_CORE + 0.02, 0.7, 64), red);
  coreBand.position.y = 3.1; core.add(coreBand);
  const race = makeRaceway(R_CORE, H_CORE1 - 1.5, jointMats);
  race.position.y = 0.8; core.add(race);
  // 稳定尾翼 x4
  const finGeo = makeFinGeometry();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const fin = new THREE.Mesh(finGeo, whiteDark);
    fin.position.set(Math.cos(a) * R_CORE, 2.4, Math.sin(a) * R_CORE);
    fin.rotation.y = -a;
    core.add(fin);
  }
  // 一级四机并联（可摇摆 ±10°）：完整喷管（外壁/内腔/冷却管束/涡轮排气管/万向机构/腔内辉光）
  const coreEngines = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const { group: eng, glows } = makeEngine({ rThroat: 0.17, rExit: 0.46, len: 1.55, tubes: 14 }, engMats);
    eng.position.set(Math.cos(a) * 0.9, -0.06, Math.sin(a) * 0.9);
    coreEngines.add(eng);
    engineGlows.push(...glows);
  }
  core.add(coreEngines);
  rocket.add(core);

  // 四枚助推器（含头锥、单台钟形喷管）
  const boosters = new THREE.Group();
  const boosterRefs = [];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dz] of dirs) {
    const b = new THREE.Group();
    const bx = dx * 2.95, bz = dz * 2.95;
    const bBody = new THREE.Mesh(new THREE.CylinderGeometry(R_BOOST, R_BOOST, H_BOOST, 48), white);
    bBody.position.y = H_BOOST / 2; b.add(bBody);
    // 助推器头锥：卵形长锥（实拍更修长，收成小钝顶），底部带对接环
    const bNoseProfile = [];
    const B_NOSE = 2.6;
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const rr = R_BOOST * Math.pow(Math.max(0, 1 - Math.pow(t, 2.1)), 0.62);
      bNoseProfile.push(new THREE.Vector2(Math.max(rr, 0.055), B_NOSE * t));
    }
    const bTip = new THREE.Mesh(new THREE.LatheGeometry(bNoseProfile, 40), whiteDark);
    bTip.position.y = H_BOOST; b.add(bTip);
    const bNoseJoint = makeJointRing(R_BOOST, 20, jointMats);
    bNoseJoint.position.y = H_BOOST - 0.22; b.add(bNoseJoint);
    const { group: bEng, glows: bGlows } = makeEngine({ rThroat: 0.26, rExit: 0.7, len: 2.0, tubes: 16 }, engMats);
    bEng.position.y = -0.08; b.add(bEng); engineGlows.push(...bGlows);
    // 助推器与芯级之间的对接环
    const bJoint = makeJointRing(R_BOOST, 18, jointMats);
    bJoint.position.y = H_BOOST - 0.35; b.add(bJoint);
    const bHazard = new THREE.Mesh(new THREE.CylinderGeometry(R_BOOST + 0.02, R_BOOST + 0.02, 1.6, 48), hazardMat);
    bHazard.position.y = 1.4; b.add(bHazard);
    b.position.set(bx, 0, bz);
    b.userData.dir = new THREE.Vector3(bx, 0, bz).normalize();
    boosters.add(b);
    boosterRefs.push(b);
  }
  rocket.add(boosters);

  // 芯二级 + 级间段 + 仪器舱 + 适配器
  const upper = new THREE.Group();
  const interstage = new THREE.Mesh(new THREE.CylinderGeometry(R_CORE + 0.03, R_CORE + 0.03, H_INTER, 64), interMat);
  interstage.position.y = H_CORE1 + H_INTER / 2; upper.add(interstage);
  const upperBody = new THREE.Mesh(new THREE.CylinderGeometry(R_CORE, R_CORE, H_CORE2, 64), upperSkinMat);
  upperBody.position.y = Y_INTER + H_CORE2 / 2; upper.add(upperBody);
  const bay = new THREE.Mesh(new THREE.CylinderGeometry(R_CORE, R_CORE * 0.95, H_BAY, 64), whiteDark);
  bay.position.y = Y_CORE2_TOP + H_BAY / 2; upper.add(bay);
  const adapter = new THREE.Mesh(new THREE.CylinderGeometry(R_CORE * 0.95, R_FAIR * 0.55, H_ADAPT, 64), whiteDark);
  adapter.position.y = Y_BAY_TOP + H_ADAPT / 2; upper.add(adapter);
  const upperRace = makeRaceway(R_CORE, H_CORE2 - 1.0, jointMats);
  upperRace.position.y = Y_INTER + 0.5; upper.add(upperRace);
  // 部段对接环：级间段上下沿 + 仪器舱上下沿（实拍中这些交界都有明显分界带）
  for (const [ry, rr] of [
    [H_CORE1 + 0.2, R_CORE + 0.03], [Y_INTER - 0.2, R_CORE + 0.03],
    [Y_CORE2_TOP + 0.2, R_CORE], [Y_BAY_TOP - 0.18, R_CORE],
  ]) {
    const jr = makeJointRing(rr, 22, jointMats);
    jr.position.y = ry; upper.add(jr);
  }

  // 整流罩（两半，闭合时完整包裹载荷；入轨时绕基座铰链张开后抛离）
  const fairing = new THREE.Group();
  const fairMat = paintMat(skinFair);
  const fairTopMat = new THREE.MeshStandardMaterial({ color: 0xeef1f4, metalness: 0.2, roughness: 0.44, side: THREE.DoubleSide });
  // 整流罩母线：底部收缩裙 → 圆柱段 → 卵形头锥（截断钝顶，按高度均匀取点，保证 UV 比例正确）
  const FAIR_APEX_R = 0.40;   // 头锥顶面截断半径（逃逸塔基座安装面，对应实拍钝顶）
  const FAIR_TOP = FAIR_TOTAL;   // 复用顶部尺寸链常量（底部收缩裙 → 圆柱段 → 卵形头锥）
  const fairProfile = [];
  for (let y = 0; y <= FAIR_TOP + 1e-6; y += 0.42) {
    let r;
    if (y < 0.7) r = R_FAIR * (0.86 + 0.14 * (y / 0.7));                   // 底部收缩裙
    else if (y <= FAIR_CYL) r = R_FAIR;                                    // 圆柱段
    else {                                                                 // 卵形收敛（近直锥面、肩部与顶部圆角过渡，对应实拍）
      const t = (y - FAIR_CYL) / FAIR_NOSE;
      r = FAIR_APEX_R + (R_FAIR - FAIR_APEX_R) * Math.pow(Math.max(0, 1 - Math.pow(t, 2.2)), 0.72);
    }
    fairProfile.push(new THREE.Vector2(Math.max(r, 0.001), y));
  }
  fairProfile.push(new THREE.Vector2(0.02, FAIR_TOP));   // 顶面闭合（每半罩自带半圆截断面）
  const fairGeo = new THREE.LatheGeometry(fairProfile, 64, Math.PI / 2, Math.PI);  // 半个整流罩
  const fairInnerMat = new THREE.MeshStandardMaterial({ color: 0xdfe3e6, metalness: 0.08, roughness: 0.72, side: THREE.BackSide });
  const halves = [];
  for (const side of [-1, 1]) {
    const h = new THREE.Group();          // 铰链组：位于整流罩基座中线
    const holder = new THREE.Group();     // 半罩本体
    holder.rotation.y = side === 1 ? Math.PI : 0;
    holder.add(new THREE.Mesh(fairGeo, fairMat));
    holder.add(new THREE.Mesh(fairGeo, fairInnerMat));   // 内壁：素面无标识（真实罩内不刷涂装）
    h.add(holder);
    h.userData.side = side;
    h.position.set(0, Y_FAIR_BASE, 0);
    fairing.add(h);
    halves.push(h);
  }
  upper.add(fairing);
  rocket.add(upper);

  // 神舟载荷（太阳翼初始收拢；挂在 rocket 上，上级分离时留在轨道）
  const ship = buildShip();
  const payload = ship.root;
  payload.position.set(0, Y_PAYLOAD, 0);
  rocket.add(payload);

  // 逃逸塔（对应实拍：底部喇叭裙罩住锥顶 → 细长下段 → 中部鼓段 → 上段 → 颈环 → 细长尖针，实心白色塔身）
  const esc = new THREE.Group();
  // 底部喇叭裙：向下张开罩在整流罩截断顶（r0.40）上，衔接自然
  const escSkirt = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.68, 1.0, 24), whiteDark);
  escSkirt.position.y = 0.5; esc.add(escSkirt);
  // 下段塔身（微收锥）
  const escLower = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 2.6, 20), whiteDark);
  escLower.position.y = 2.3; esc.add(escLower);
  // 中部鼓段（实拍中塔身中部的加粗段）
  const escDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 1.8, 20), whiteDark);
  escDrum.position.y = 4.5; esc.add(escDrum);
  // 环箍 x3（下段中部 / 鼓段下沿 / 上段下沿）
  for (const [ry, rr] of [[1.6, 0.27], [3.6, 0.30], [5.42, 0.24]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.03, 8, 24), whiteDark);
    ring.rotation.x = Math.PI / 2; ring.position.y = ry; esc.add(ring);
  }
  // 上段塔身 + 颈环
  const escUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 1.0, 20), whiteDark);
  escUpper.position.y = 5.9; esc.add(escUpper);
  const escCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.5, 20), whiteDark);
  escCollar.position.y = 6.65; esc.add(escCollar);
  // 逃逸主发动机喷管 x4（颈环处斜置外张）
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const nz = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.38, 12), nozzle);
    nz.position.set(Math.cos(a) * 0.28, 6.7, Math.sin(a) * 0.28);
    nz.rotation.z = -Math.cos(a) * 0.55;
    nz.rotation.x = Math.sin(a) * 0.55;
    esc.add(nz);
  }
  // 顶部细长尖针（实拍中最醒目的针状桅杆，约占塔高 1/4）
  const escMast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, 0.9, 12), whiteDark);
  escMast.position.y = 7.35; esc.add(escMast);
  const escTip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 12), white);
  escTip.position.y = 7.95; esc.add(escTip);   // 塔尖总高恰为 8.0m
  // 栅格稳定翼 x4（贴装在中部鼓段表面，对应实拍"折叠贴塔"的形态：薄板 + 细密格栅）
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const gf = new THREE.Group();
    const P = 0.58, T = 0.028;                       // 板幅 / 板厚
    const add = (w, h, dx, dy) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, T), gridMat);
      m.position.set(dx, dy, 0); gf.add(m);
    };
    add(P, 0.045, 0, P / 2 - 0.022);                 // 外框
    add(P, 0.045, 0, -P / 2 + 0.022);
    add(0.045, P, P / 2 - 0.022, 0);
    add(0.045, P, -P / 2 + 0.022, 0);
    for (let k = 1; k <= 3; k++) {                   // 细密格栅
      const o = -P / 2 + (P / 4) * k;
      add(0.022, P - 0.09, o, 0);
      add(P - 0.09, 0.022, 0, o);
    }
    gf.position.set(Math.cos(a) * 0.315, 4.5, Math.sin(a) * 0.315);
    gf.rotation.y = Math.PI / 2 - a;                 // 贴面朝外（法线沿半径方向）
    esc.add(gf);
  }
  esc.position.set(0, Y_ESC_BASE, 0);
  rocket.add(esc);

  // ================= 细节层（第三阶段：局部精修） =================
  // 关键：细节直接挂到所属部件上，分离时随部件一起运动
  const panelMat = new THREE.MeshStandardMaterial({ color: 0xc4cad2, metalness: 0.35, roughness: 0.5 });
  const panelDark = new THREE.MeshStandardMaterial({ color: 0x596069, metalness: 0.5, roughness: 0.45 });
  const pipeMat = new THREE.MeshStandardMaterial({ color: 0xaeb4bc, metalness: 0.82, roughness: 0.28 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x343940, metalness: 0.75, roughness: 0.45 });
  const coatMat = new THREE.MeshStandardMaterial({ color: 0x4a4f57, metalness: 0.05, roughness: 0.88 }); // 隔热涂层（哑光）

  // 在圆柱面上放置贴面件（局部 +Z 朝外）
  const placeOnCyl = (mesh, r, ang, y) => {
    mesh.position.set(Math.cos(ang) * r, y, Math.sin(ang) * r);
    mesh.rotation.y = -ang;
    return mesh;
  };

  // --- 芯一级：检修舱口 ×2、管路 ×2、分离螺栓带、尾裙（含排气窗）---
  for (const [ang, y] of [[0.55, 6.5], [2.45, 13.8]]) {
    const frame = placeOnCyl(new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.06, 0.08), panelMat), R_CORE - 0.01, ang, y);
    const hatch = placeOnCyl(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.88, 0.12), panelDark), R_CORE + 0.04, ang, y);
    const handle = placeOnCyl(new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.30, 0.10), panelMat), R_CORE + 0.10, ang + 0.07, y);
    core.add(frame, hatch, handle);
  }
  for (const ang of [1.05, 2.10]) {   // 纵向管路
    const pipe = placeOnCyl(new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, H_CORE1 - 3.2, 12), pipeMat), R_CORE + 0.07, ang, H_CORE1 / 2);
    const clampA = placeOnCyl(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.10, 0.22), panelMat), R_CORE + 0.05, ang, 4.5);
    const clampB = placeOnCyl(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.10, 0.22), panelMat), R_CORE + 0.05, ang, 16.5);
    core.add(pipe, clampA, clampB);
  }
  // 分离螺栓带（一级顶 / 二级底 的对接环，带螺栓凸点）
  const boltBand = new THREE.Mesh(new THREE.CylinderGeometry(R_CORE + 0.06, R_CORE + 0.06, 0.22, 64), panelMat);
  boltBand.position.y = H_CORE1 - 0.35; core.add(boltBand);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const bolt = placeOnCyl(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8), darkMetal), R_CORE + 0.10, a, H_CORE1 - 0.35);
    bolt.rotation.z = Math.PI / 2;
    core.add(bolt);
  }
  // 尾裙（底部外扩，隔热涂层）+ 排气窗
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(R_CORE + 0.14, R_CORE + 0.26, 1.5, 64), coatMat);
  skirt.position.y = 0.75; core.add(skirt);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.13;
    const vent = placeOnCyl(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.1), darkMetal), R_CORE + 0.30, a, 0.85);
    core.add(vent);
  }

  // --- 发动机机架 / 涡轮泵 / 推进剂管路（芯一级）---
  const gimbal = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.5, 0.14), pipeMat);
    arm.position.set(Math.cos(a) * 1.05, -0.35, Math.sin(a) * 1.05);
    arm.rotation.z = -Math.cos(a) * 0.28;
    arm.rotation.x = Math.sin(a) * 0.28;
    const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.5, 16), darkMetal);
    pump.position.set(Math.cos(a) * 1.25, -0.15, Math.sin(a) * 1.25);
    pump.rotation.z = Math.PI / 2 - Math.cos(a) * 0.5;
    gimbal.add(arm, pump);
  }
  // 推进剂输送管（圆弧管）
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI;
    const tube = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.075, 10, 20, Math.PI * 0.85), pipeMat);
    tube.position.set(Math.cos(a) * 0.95, -0.75, Math.sin(a) * 0.95);
    tube.rotation.set(Math.PI / 2, a, 0);
    gimbal.add(tube);
  }
  const heatRing = new THREE.Mesh(new THREE.CylinderGeometry(R_CORE + 0.02, R_CORE - 0.18, 0.5, 48, 1, true), coatMat);
  heatRing.position.y = -0.3; gimbal.add(heatRing);
  core.add(gimbal);

  // --- 助推器：前后连接件、纵向电缆罩、小检修口、喷管隔热环 ---
  for (const b of boosterRefs) {
    const d = b.userData.dir;
    const ang = Math.atan2(d.z, d.x);
    for (const y of [14.2, 3.2]) {           // 前/后连接件（朝向芯级）
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.3), panelMat);
      strut.position.set(-Math.cos(ang) * (R_BOOST + 0.12), y, -Math.sin(ang) * (R_BOOST + 0.12));
      strut.rotation.y = -ang;
      b.add(strut);
    }
    const cond = placeOnCyl(new THREE.Mesh(new THREE.BoxGeometry(0.10, H_BOOST - 3.0, 0.14), panelMat), R_BOOST + 0.06, ang + Math.PI / 2, H_BOOST / 2);
    const hatchB = placeOnCyl(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.1), panelDark), R_BOOST + 0.03, ang + Math.PI, 10.5);
    const heatB = new THREE.Mesh(new THREE.CylinderGeometry(R_BOOST + 0.02, R_BOOST - 0.12, 0.42, 40, 1, true), coatMat);
    heatB.position.y = 0.25;
    b.add(cond, hatchB, heatB);
  }

  // --- 级间段：竖向支撑 + 排气环 ---
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const rib = placeOnCyl(new THREE.Mesh(new THREE.BoxGeometry(0.16, H_INTER - 0.1, 0.16), panelMat), R_CORE + 0.05, a, H_CORE1 + H_INTER / 2);
    upper.add(rib);
  }
  const interRing = new THREE.Mesh(new THREE.CylinderGeometry(R_CORE + 0.08, R_CORE + 0.08, 0.18, 64), pipeMat);
  interRing.position.y = H_CORE1 + H_INTER - 0.09; upper.add(interRing);

  // --- 芯二级：舱口、管路、级间对接环 ---
  for (const [ang, y] of [[0.9, 27.5], [2.7, 33.5]]) {
    const frame = placeOnCyl(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.98, 0.08), panelMat), R_CORE - 0.01, ang, y);
    const hatch = placeOnCyl(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 0.12), panelDark), R_CORE + 0.04, ang, y);
    upper.add(frame, hatch);
  }
  for (const ang of [1.6, 4.0]) {
    const pipe = placeOnCyl(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, H_CORE2 - 4.0, 12), pipeMat), R_CORE + 0.07, ang, Y_INTER + H_CORE2 / 2);
    upper.add(pipe);
  }
  const jointBand = new THREE.Mesh(new THREE.CylinderGeometry(R_CORE + 0.07, R_CORE + 0.07, 0.2, 64), panelMat);
  jointBand.position.y = Y_CORE2_TOP - 0.2; upper.add(jointBand);
  // 天线（鞭状 + 刀状）与滚动控制推力器
  const antWhip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 2.2, 8), pipeMat);
  antWhip.position.set(R_CORE + 0.1, Y_CORE2_TOP + 1.1, 0); antWhip.rotation.z = -0.16; upper.add(antWhip);
  for (const a of [1.2, 3.6]) {
    const blade = placeOnCyl(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.30), pipeMat), R_CORE + 0.12, a, Y_CORE2_TOP + 0.6);
    upper.add(blade);
  }
  for (let i = 0; i < 4; i++) {           // 仪器舱滚动推力器
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const nozzleSm = placeOnCyl(new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.26, 12), darkMetal), R_CORE + 0.12, a, Y_CORE2_TOP + 1.6);
    nozzleSm.rotation.set(Math.PI / 2, -a, 0);
    upper.add(nozzleSm);
  }

  // --- 整流罩：检修口、空速管（挂在半罩 holder 上，随罩张开；方位取半罩朝外的 -Z 侧）---
  const bandNavyMat = new THREE.MeshStandardMaterial({ color: 0x16264f, metalness: 0.25, roughness: 0.5, side: THREE.DoubleSide });
  for (const h of halves) {
    const holder = h.children[0];
    for (const [da, y] of [[-0.5, 3.2], [0.5, 5.6]]) {
      const ang = -Math.PI / 2 + da;     // 半罩几何覆盖 -Z 半边，故贴在 -Z 面
      const frame = placeOnCyl(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 0.08), panelMat), R_FAIR - 0.01, ang, y);
      const hatch = placeOnCyl(new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.66, 0.1), panelDark), R_FAIR + 0.035, ang, y);
      holder.add(frame, hatch);
    }
    // 空速管：沿 -Z 向外伸出（一端埋入罩体，避免悬空）
    const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8), pipeMat);
    pitot.position.set(0, 6.0, -(R_FAIR + 0.12));
    pitot.rotation.x = Math.PI / 2;
    holder.add(pitot);
    // 锥柱交界深藏青环带（半环，随半罩张开；对应实拍交界处的深色环带）
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(R_FAIR + 0.025, R_FAIR + 0.025, 0.45, 48, 1, true, Math.PI / 2, Math.PI),
      bandNavyMat
    );
    band.position.y = FAIR_CYL + 0.05;
    holder.add(band);
    // 交界处白色方形小凸盒 x2（对应实拍锥柱交界处的 4 个凸出件；大部分埋入罩体，只露薄薄一层）
    for (const da of [-1.05, 1.05]) {
      const ang = -Math.PI / 2 + da;
      const jbox = placeOnCyl(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.13), whiteDark), R_FAIR - 0.03, ang, FAIR_CYL + 0.26);
      holder.add(jbox);
    }
  }

  // ---- 分离刚体（箭体坐标系下建立：构建期火箭位于原点且无旋转）----
  const sepBodies = {
    boosters: boosterRefs.map(b => {
      const s = makeSepBody(b, b.userData.dir.clone(), {
        wz: (b.userData.dir.x >= 0 ? 1 : -1) * 0.9,   // 向外翻滚
        sepAcc: 8,
      });
      s.safeRadial = R_CORE + s.radXZ + SEP_MARGIN;   // 与芯级表面的安全轴距
      return s;
    }),
    core: (() => {
      const s = makeSepBody(core, new THREE.Vector3(0, -1, 0), { wz: 0.55, sepAcc: 3.6 });
      s.axisMode = 'down'; s.safeAxial = SEP_MARGIN;  // 向下让开芯二级
      return s;
    })(),
    upper: (() => {
      const s = makeSepBody(upper, new THREE.Vector3(0, -1, 0), { wz: 0.2, sepAcc: 2.4 });
      s.axisMode = 'down'; s.safeAxial = SEP_MARGIN;  // 向下让开神舟载荷
      return s;
    })(),
    esc: (() => {
      const s = makeSepBody(esc, new THREE.Vector3(0.78, 0.62, 0), { wz: 0.8, sepAcc: 16 });
      s.safeRadial = R_FAIR + s.radXZ + SEP_MARGIN;   // 侧向+向上抛离，杜绝回落穿入整流罩
      return s;
    })(),
  };

  // 尾焰（三层：近喷口蓝白高温 → 中段白黄 → 外扩橙黄，对应实拍）
  // === 火焰特效改造区：程序化湍流尾焰（顶点噪声抖动 + 分层高温配色 + 亮度脉动）===
  // 所有火焰层共用一套着色器：顶点阶段做高频湍流位移（边缘翻滚），片段阶段按
  // 「相对半径」软化轮廓、按「环向噪声」撕裂边缘，避免匀速静态的贴图感。
  const flameUniforms = [];   // 收集全部火焰层 uniforms，stepPhysics 里统一驱动 uTime/uFlicker
  function makeFlameLayer(color, opacity, tipKeep, opts) {
    const o = opts || {};
    const uni = {
      uTime: { value: 0 }, uFlicker: { value: 1 },
      uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity },
      uTip: { value: tipKeep },                                     // 远端（远离喷口）保留亮度
      uRoot: { value: o.root != null ? o.root : 1.0 },              // 喷口端保留亮度
      uHollow: { value: o.hollow != null ? o.hollow : 0.2 },        // 轮廓虚化程度（越小轮廓越淡）
      uFlipEnd: { value: o.flipEnd ? 1 : 0 },                       // 1 = 该几何体的【远端】在 vUv.y=0
      uPatch: { value: o.patch != null ? o.patch : 1.0 },           // 湍流团块强度
      uTurb: { value: o.turb != null ? o.turb : 1.0 },              // 顶点湍流位移强度（小尺寸羽流需减弱，否则被撕碎）
      uDiamond: { value: o.diamond != null ? o.diamond : 0.0 },     // 马赫环（激波菱形）强度：真空羽流的典型特征
    };
    flameUniforms.push(uni);
    return new THREE.ShaderMaterial({
      uniforms: uni,
      vertexShader: `
        uniform float uTime;
        uniform float uTurb;
        varying vec2 vUv;
        varying vec3 vNrmV;
        varying float vPulse;
        void main() {
          vUv = uv;
          vec3 p = position;
          // 湍流：两频段横向噪声位移，越靠焰尾(vUv.y->1)抖动越大（边缘翻滚）；
          // uTurb 按几何尺度缩放（小羽流减弱，避免被绝对位移撕碎）
          float w = vUv.y * vUv.y * uTurb;
          p.x += (sin(p.y * 1.7 + uTime * 13.0) * 0.16 + sin(p.y * 3.9 - uTime * 21.0) * 0.07) * w;
          p.z += (cos(p.y * 1.3 + uTime * 11.0) * 0.16 + sin(p.y * 3.1 + uTime * 17.0) * 0.07) * w;
          // 沿焰身的低频脉动：让"气柱"有呼吸感，而不是一根匀速的柱子
          vPulse = 0.86 + 0.14 * sin(vUv.y * 7.0 - uTime * 6.0);
          vNrmV = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uFlicker;
        uniform float uTip;
        uniform float uRoot;
        uniform float uHollow;
        uniform float uFlipEnd;
        uniform float uPatch;
        uniform float uDiamond;
        varying vec2 vUv;
        varying vec3 vNrmV;
        varying float vPulse;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        float vnoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                     mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }

        void main() {
          // ① 体积感：真实羽流【中心厚、轮廓薄】。此前按视空间法线做"掠射增强"（轮廓更亮），
          //    结果焰锥看着像一圈发光的空心几何壳、边缘是硬直线 —— 用户截图里的"硬锥"正是此因。
          //    现改为轮廓渐隐（uHollow 控制），焰面呈充实的发光气柱。
          float nz = abs(normalize(vNrmV).z);
          float fres = pow(1.0 - nz, 1.25);
          float body = mix(1.0, uHollow, fres);

          // ② 双端渐隐：uRoot=喷口端、uTip=远端。uFlipEnd 用于"宽端在远端"的羽流裙——
          //    此前它的渐隐端反了（喷口端虚、宽端实），宽端留下一条硬邦邦的圆形切口。
          float v = mix(vUv.y, 1.0 - vUv.y, uFlipEnd);
          float ends = mix(uRoot, uTip, smoothstep(0.45, 1.0, v));

          // ③ 湍流团块：二维值噪声让焰面呈不规则气团（越靠远端越斑驳），消除均匀几何面的贴图感
          float t = uTime;
          float n1 = vnoise(vec2(vUv.x * 5.0 + t * 0.30, vUv.y * 2.6 - t * 1.55));
          float n2 = vnoise(vec2(vUv.x * 11.0 - t * 0.55, vUv.y * 5.2 - t * 2.40));
          float clump = 0.60 + 0.78 * (0.66 * n1 + 0.34 * n2);   // 注意：不能叫 patch（GLSL 保留字）
          clump = mix(1.0, clump, uPatch * clamp(0.30 + 0.95 * v, 0.0, 1.0));

          // 环向撕裂 + 高频闪烁（推力脉动由 uFlicker 注入）
          float tear = 0.88 + 0.12 * sin(vUv.x * 18.85 + vUv.y * 9.0 + t * 23.0);
          // 马赫环：超声速羽流在喷口附近形成的周期性亮环（激波菱形），沿焰身等间距增亮
          float dia = 1.0 + uDiamond * sin(v * 42.0 - t * 3.0);
          float a = uOpacity * uFlicker * body * ends * clump * tear * vPulse * max(dia, 0.15);
          a = min(a, 1.0);
          if (a < 0.004) discard;
          gl_FragColor = vec4(uColor * (0.82 + 0.38 * uFlicker), a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
  }
  // 高温分层：亮白核心 → 亮黄高温区 → 橙红扩散 → 半透明暗红过渡 → 羽流裙
  // （各层现已全部可见，透明度按层次酌情下调，避免叠加过曝）
  const layCore = makeFlameLayer(0xdfe9ff, 1.0, 0.1);    // 亮白核心
  const layMid  = makeFlameLayer(0xfff1c2, 0.82, 0.16);  // 亮黄高温区
  const layOut  = makeFlameLayer(0xff8a3c, 0.5, 0.2);    // 橙红扩散火焰
  const layDark = makeFlameLayer(0x8a1e00, 0.3, 0.24);   // 最外圈半透明暗红过渡
  // 羽流裙：宽端在【远端】，故 flipEnd=1 让远端渐隐（原来反了 → 末端硬圆切）
  const laySkirt = makeFlameLayer(0xffa04a, 0.17, 0.03, { flipEnd: true, root: 0.75, hollow: 0.12 });
  // === 真空羽流专用层（二级主机）：高空喷管出口压远高于环境压，燃气急剧外扩后近似等宽，
  //     呈"钟形"而非锥形；这几层比一级焰更柔、更透，末端完全消散 ===
  const layBell = makeFlameLayer(0xff8a3c, 0.70, 0.12, { root: 0.55, hollow: 0.09, patch: 1.4, turb: 0.5 });
  const layBellMid = makeFlameLayer(0xffd9a0, 0.60, 0.16, { root: 0.88, hollow: 0.18, patch: 0.85, turb: 0.5 });
  const layJet = makeFlameLayer(0xffb066, 0.46, 0.10, { root: 0.58, hollow: 0.14, patch: 1.0, turb: 0.38 });
  // 喷口柔光贴图：面向镜头的加色光斑，把"硬边锥体"的轮廓化开（真实的喷口处是一团光晕）
  const layPlumeCore = makeFlameLayer(0xf4f5ff, 1.0, 0.06, { root: 1.0, hollow: 0.45, patch: 0.42, turb: 0.35, diamond: 0.55 });
  const haloTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0.00, 'rgba(255,240,210,0.95)');
    g.addColorStop(0.30, 'rgba(255,178,92,0.42)');
    g.addColorStop(0.65, 'rgba(255,124,44,0.14)');
    g.addColorStop(1.00, 'rgba(255,90,20,0.0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const haloMat = new THREE.SpriteMaterial({
    map: haloTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.78,
  });
  function makeFlame(scale) {
    const f = new THREE.Group();
    // 分段数上调：湍流位移在顶点阶段做，段数过低时轮廓会出现多边形硬折角
    const outer = new THREE.Mesh(new THREE.ConeGeometry(1.05 * scale, 7.5 * scale, 28, 2, true), layOut);
    outer.rotation.x = Math.PI; outer.position.y = -3.75 * scale;
    const dark = new THREE.Mesh(new THREE.ConeGeometry(1.32 * scale, 8.6 * scale, 28, 2, true), layDark);
    dark.rotation.x = Math.PI; dark.position.y = -4.2 * scale;   // 最外圈暗红过渡层
    const mid = new THREE.Mesh(new THREE.ConeGeometry(0.82 * scale, 5.2 * scale, 24, 2, true), layMid);
    mid.rotation.x = Math.PI; mid.position.y = -2.6 * scale;
    const hot = new THREE.Mesh(new THREE.ConeGeometry(0.55 * scale, 3.1 * scale, 20, 2, true), layCore);
    hot.rotation.x = Math.PI; hot.position.y = -1.55 * scale;
    // 羽流裙：下宽上窄的倒锥（真实高空羽流向下扩散），远处看呈大范围柔和火光
    const skirt = new THREE.Mesh(new THREE.ConeGeometry(2.1 * scale, 9.0 * scale, 24, 2, true), laySkirt);
    skirt.position.y = -4.4 * scale;   // 锥尖朝上贴近喷口，底面向下张开
    // 渲染顺序：火焰在烟（renderOrder=10）之后绘制 → 加色火光穿透烟云，
    // 不会被新生烟团糊掉（真实点火中火光把烟照亮而不是被烟遮死）
    for (const m of [dark, outer, mid, hot, skirt]) m.renderOrder = 20;
    f.add(dark, outer, mid, hot, skirt);
    f.visible = false;
    return f;
  }
  // === 真空钟形羽流（二级主机 / 游机）===
  // 剖面自喉部向下：先快速外扩、中段近等宽、末端收束消散 —— 这是真空羽流的真实形状。
  // 三层叠加：宽而透的橙色包络 + 亮黄内层 + 喉部亮白核心，外加一团喷口柔光。
  const BELL_PROFILE = [
    [0.12, 0.00], [0.55, -0.55], [0.98, -1.30], [1.32, -2.40],
    [1.62, -3.60], [1.85, -5.00], [1.95, -6.40], [1.98, -7.60],
  ];
  function makeBellPlume(scale, opts) {
    const o = opts || {};
    const wide = o.wide != null ? o.wide : 1.0;
    const len = o.len != null ? o.len : 1.0;
    const seg = o.seg != null ? o.seg : 40;
    const mOut = o.outer || layBell, mIn = o.inner || layBellMid;
    const f = new THREE.Group();
    const shell = (k, mat, ro) => {
      const prof = BELL_PROFILE.map(([r, y]) => new THREE.Vector2(r * scale * wide * k, y * scale * len));
      const m = new THREE.Mesh(new THREE.LatheGeometry(prof, seg), mat);
      m.renderOrder = ro;
      return m;
    };
    f.add(shell(1.00, mOut, 20), shell(0.55, mIn, 21));
    // 喉部亮白核心（短焰芯，让喷口处有实心高温起点；远端按 uTip 自然消散）
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.50 * scale * wide, 4.6 * scale * len, 22, 2, true), layPlumeCore);
    core.rotation.x = Math.PI; core.position.y = -2.3 * scale * len; core.renderOrder = 22;
    f.add(core);
    // 喷口柔光：面向镜头的加色光斑，弱化"硬边锥体"观感（真实喷口是一团光晕）
    const halo = new THREE.Sprite(haloMat);
    halo.scale.set(0.48 * scale * wide, 0.48 * scale * wide, 1);   // 光晕再减半（用户 2026-09-29：缩小一倍）
    halo.position.y = -0.10 * scale; halo.renderOrder = 23;
    f.add(halo);
    f.visible = false;
    return f;
  }
  const coreFlames = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const f = makeFlame(1.0);
    // 火焰基准点下移到喷口出口附近（芯一级四机并联喷管出口约 -1.6m）：
    // 原 -0.2 的基准点埋在发动机舱内部，焰锥被舱体遮挡，火焰从舱内亮起而非从喷口喷出
    f.position.set(Math.cos(a) * 0.95, -1.4, Math.sin(a) * 0.95);
    core.add(f); coreFlames.push(f);
  }
  const boosterFlames = boosterRefs.map(b => {
    // 助推器尾焰：加大一号（1.25）并把基准点移到喷口出口（助推器喷管出口约 -2.08m）。
    // 原 -0.3 的基准点在发动机舱内部，焰锥被喷管与舱体挡住 → 表现为"助推器没有火焰"
    const f = makeFlame(1.25); f.position.y = -2.0; b.add(f); return f;
  });
  const flames = [...coreFlames, ...boosterFlames];
  // === 二级发动机建模优化（真实 CZ-2F 构型）：1 台主机 + 4 台游动发动机 ===
  // 真实时序：二级主机工作到 462s 关机，随后由 4 台游机以小推力把飞船送入轨道直至 582s 关机。
  // 因此二级段分两相：主机相（主机大焰 + 4 台游机小焰）与游机相（仅 4 台游机小焰，主机无焰）。
  const upperEng = new THREE.Group();
  upperEng.position.y = H_CORE1 + 0.15;
  const upperEngGlows = [];               // [0]=主机辉光，[1..4]=4 台游机辉光
  {
    const { group: mainE, glows: gMain } = makeEngine({ rThroat: 0.15, rExit: 0.40, len: 1.25, tubes: 12 }, engMats);
    upperEng.add(mainE); upperEngGlows.push(...gMain);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const { group: vE, glows: gV } = makeEngine({ rThroat: 0.075, rExit: 0.17, len: 0.55, tubes: 6 }, engMats);
      vE.position.set(Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62);
      upperEng.add(vE); upperEngGlows.push(...gV);
    }
  }
  upper.add(upperEng);
  // 主机尾焰（真空钟形羽流）：自主机喷口（约 H_CORE1-1.1m）喷出，随二级同步移动/倾斜
  const flame2 = makeBellPlume(0.5);
  flame2.position.y = -0.95;
  upperEng.add(flame2);
  // 游机尾焰 ×4：细长小羽流（同样用钟形剖面，尺度收窄），主机相与游机相全程工作
  const vernierFlames = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const f = makeBellPlume(0.30, { wide: 0.5, len: 0.55, seg: 26, outer: layJet });
    f.position.set(Math.cos(a) * 0.62, -0.62, Math.sin(a) * 0.62);
    upperEng.add(f); vernierFlames.push(f);
  }
  // 尾焰照明（夜间主光源：橙光自下而上照亮箭体下部、发射台与塔架）
  const flameLight = new THREE.PointLight(0xffa24a, 0, 215, 1.45);
  flameLight.position.y = -3; rocket.add(flameLight);
  const spillLight = new THREE.PointLight(0xff8a30, 0, 105, 1.6);   // 地面火光溢出（收紧）
  spillLight.position.y = -6; rocket.add(spillLight);
  // 地面冲击火光：尾焰撞击发射台后沿场坪铺开的高温光斑（白黄核心 → 橙红边缘），
  // 低空时强烈、随高度衰减消失；脉动与尾焰同步，先于烟雾(renderOrder 10)绘制
  const impactUni = { uTime: { value: 0 }, uGlow: { value: 0 } };
  const impactGlow = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40),
    new THREE.ShaderMaterial({
      uniforms: impactUni,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform float uGlow; uniform float uTime;
        varying vec2 vUv;
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          // 环向噪声让光斑边缘不规则翻滚，不是完美圆盘
          float wob = 0.85 + 0.15 * sin(atan(vUv.y - 0.5, vUv.x - 0.5) * 5.0 + uTime * 9.0);
          vec3 col = mix(vec3(1.0, 0.93, 0.72), vec3(1.0, 0.42, 0.1), smoothstep(0.0, 0.75, d));
          float a = uGlow * wob * pow(max(0.0, 1.0 - d), 1.6);
          gl_FragColor = vec4(col, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    })
  );
  impactGlow.rotation.x = -Math.PI / 2;
  impactGlow.position.y = 0.15;
  impactGlow.renderOrder = 9;
  impactGlow.visible = false;
  rig.add(impactGlow);

  // ---- 粒子系统：自定义着色器（逐粒子尺寸/透明度/颜色），单次绘制、零逐帧对象分配 ----
  const particleVert = `
    attribute vec3 aColor;
    attribute float aSize;
    attribute float aAlpha;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vColor = aColor; vAlpha = aAlpha;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = aSize * (420.0 / max(-mv.z, 1.0));
      gl_Position = projectionMatrix * mv;
    }`;
  const particleFrag = `
    uniform sampler2D uMap;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vec4 tex = texture2D(uMap, gl_PointCoord);
      float a = tex.a * vAlpha;
      if (a < 0.012) discard;
      gl_FragColor = vec4(vColor, a);
    }`;

  // 烟雾/蒸汽：实例化公告板（而非 gl_PointSize--后者有硬件尺寸上限，大烟团会被压小）
  // 逐粒子世界尺寸/颜色/透明度，单次绘制；出生在导流槽附近，贴地翻卷并缓慢抬升
  const N = 900;
  const sPos = new Float32Array(N * 3);
  const sCol = new Float32Array(N * 3);
  const sVel = new Float32Array(N * 3);
  const sLife = new Float32Array(N);
  const sMax = new Float32Array(N);
  const sSize = new Float32Array(N);
  const sAlpha = new Float32Array(N);
  for (let i = 0; i < N; i++) { sPos[i * 3 + 1] = -9999; sAlpha[i] = 0; }
  const smokeQuad = new THREE.PlaneGeometry(1, 1);
  const sGeo = new THREE.InstancedBufferGeometry();
  sGeo.index = smokeQuad.index;
  sGeo.attributes.position = smokeQuad.attributes.position;
  sGeo.attributes.uv = smokeQuad.attributes.uv;
  sGeo.setAttribute('iPos', new THREE.InstancedBufferAttribute(sPos, 3));
  sGeo.setAttribute('iCol', new THREE.InstancedBufferAttribute(sCol, 3));
  sGeo.setAttribute('iSize', new THREE.InstancedBufferAttribute(sSize, 1));
  sGeo.setAttribute('iAlpha', new THREE.InstancedBufferAttribute(sAlpha, 1));
  sGeo.instanceCount = N;
  const sMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: smokeSprite() } },
    vertexShader: `
      attribute vec3 iPos;
      attribute vec3 iCol;
      attribute float iSize;
      attribute float iAlpha;
      varying vec2 vUv;
      varying vec3 vCol;
      varying float vA;
      void main() {
        vUv = uv; vCol = iCol; vA = iAlpha;
        vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
        mv.xy += position.xy * iSize;          // 视空间展开成面向相机的方片
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform sampler2D uMap;
      varying vec2 vUv;
      varying vec3 vCol;
      varying float vA;
      void main() {
        vec4 tex = texture2D(uMap, vUv);
        float a = tex.a * vA;
        if (a < 0.012) discard;
        gl_FragColor = vec4(vCol, a);
      }`,
    transparent: true, depthWrite: false,
  });
  const smoke = new THREE.Mesh(sGeo, sMat);
  smoke.frustumCulled = false;      // 粒子位置逐帧变化，避免包围球剔除导致整组消失
  smoke.renderOrder = 10;           // 先于火焰(20)/火星(30)绘制，火光加色穿透烟云
  rig.add(smoke);

  // 火星/余烬（点火与上升早期从尾焰喷出，受重力，短寿命，加色混合）
  const EN = 260;
  const ePos = new Float32Array(EN * 3);
  const eCol = new Float32Array(EN * 3);
  const eVel = new Float32Array(EN * 3);
  const eLife = new Float32Array(EN);
  const eMax = new Float32Array(EN);
  const eSize = new Float32Array(EN);
  const eAlpha = new Float32Array(EN);
  for (let i = 0; i < EN; i++) { ePos[i * 3 + 1] = -9999; eAlpha[i] = 0; }
  const eGeo = new THREE.BufferGeometry();
  eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3));
  eGeo.setAttribute('aColor', new THREE.BufferAttribute(eCol, 3));
  eGeo.setAttribute('aSize', new THREE.BufferAttribute(eSize, 1));
  eGeo.setAttribute('aAlpha', new THREE.BufferAttribute(eAlpha, 1));
  const eMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: sparkSprite() } },
    vertexShader: particleVert, fragmentShader: particleFrag,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const embers = new THREE.Points(eGeo, eMat);
  embers.frustumCulled = false;
  embers.renderOrder = 30;          // 火星最上层（加色小亮点，最后画）
  rig.add(embers);

  // 阴影
  tower.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  rocket.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  for (const f of flames) f.traverse(o => { o.castShadow = false; });

  return {
    rig, rocket, core, boosters, boosterRefs, upper, fairing, halves, payload, ship,
    esc, flames, flameLight, coreFlames, boosterFlames, flame2, vernierFlames, upperEngGlows, upperEng,
    smoke, sPos, sCol, sVel, sLife, sMax, sSize, sAlpha, N,
    embers, ePos, eCol, eVel, eLife, eMax, eSize, eAlpha, EN, beaconMat,
    skyDome, skyGrad, sun, site, siteMats: Array.from(siteMats), towerLights, spillLight, sepBodies,
    earthBall, atmoRim, ensureEarthGlobe, isEarthGlobeReady: () => earthGlobeReady,   // BUG3：高空弧形地球与大气辉光
    towerArms, towerMod,
    engineGlows,
    flameUniforms, impactGlow, impactUni,   // 火焰特效改造区：着色器 uniforms 与地面冲击火光
    mats: { white, coreSkinMat, upperSkinMat, hazardMat, whiteDark, red, nozzle, raceMat, interMat, fairMat, fairInnerMat, fairTopMat },
  };
}

export function createLaunch(scene, camera, opts = {}) {
  const R = buildRig();
  scene.add(R.rig);

  let active = false, playing = false, t = 0, rocketY = 0;
  let rocketX = 0, pitchNow = 0;   // ① 重力转向：横向位移与当前倾角
  let solarCur = 0, solarTarget = 0, solarOverride = false, solarDone = false;
  let fastFwd = false;   // 快进标记（seek 时为 true，跳过烟雾与音效）
  const camPos = new THREE.Vector3();
  const camTgt = new THREE.Vector3();
  const _camFwd = new THREE.Vector3();
  const _camRight = new THREE.Vector3();
  const audioHooks = opts.audio || null;   // 可选音频回调（由 main.js 注入）

  // ---- 构图偏移：让火箭避开文字面板，实现"面板 | 火箭"左右分栏 ----
  // 宽屏（>=1024px）面板固定在左侧 → 把火箭推到画面右侧；
  // 窄屏面板改为底部横条 → 把火箭上移避让。
  // 做法：把相机注视点沿"屏幕反方向"平移，等效于把被摄体在画面里移到指定位置。
  const WIDE_MIN = 1024;
  let frameSX = 0, frameSY = 0;    // 目标位置（相对屏幕中心的半宽 / 半高比例）
  function measureFrameOffset() {
    const el = document.getElementById('launchHud');
    const W = window.innerWidth, H = window.innerHeight;
    if (!el || el.classList.contains('hidden') || !el.offsetHeight) { frameSX = 0; frameSY = 0; return; }
    const r = el.getBoundingClientRect();
    if (W >= WIDE_MIN) {
      // 面板在左：把火箭放在「面板右沿 → 屏幕右边」这段剩余区域的正中
      const free = Math.max(120, W - r.right);
      frameSX = ((r.right + free / 2) - W / 2) / (W / 2);
      frameSY = 0;
    } else {
      // 面板在底部：把火箭放在「屏幕上沿 → 面板上沿」这段剩余区域的正中
      const free = Math.max(120, r.top);
      frameSX = 0;
      frameSY = (free / 2 - H / 2) / (H / 2);
    }
  }
  function applyFrameOffset() {
    if (!frameSX && !frameSY) return;
    _camFwd.set(camTgt.x - camPos.x, 0, camTgt.z - camPos.z);
    if (_camFwd.lengthSq() < 1e-6) return;
    _camFwd.normalize();
    _camRight.set(-_camFwd.z, 0, _camFwd.x);            // 相机右向量（XZ 平面内垂直于视线）
    const dist = camPos.distanceTo(camTgt);
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * dist;
    const halfW = halfH * camera.aspect;
    if (frameSX) camTgt.addScaledVector(_camRight, -frameSX * halfW);   // 注视点左移 → 火箭偏右
    if (frameSY) camTgt.y -= frameSY * halfH;                           // 注视点下移 → 火箭偏上
  }
  window.addEventListener('resize', measureFrameOffset);

  function reset() {
    t = 0; rocketY = 0; rocketX = 0; pitchNow = 0;
    simAltM = 0; simVel = 0; simLocked = true; simAcc = 0; simLiftT = 0;   // 点火物理修正：复位竖直积分与台架锁死状态
    camInit = false;                 // 重新进入/跳转时直接对准新的取景，不做缓慢过渡
    solarCur = 0; solarTarget = 0; solarOverride = false; solarDone = false;
    R.rocket.position.set(0, 0, 0);
    R.rocket.rotation.set(0, 0, 0);
    R.core.position.set(0, 0, 0); R.core.rotation.set(0, 0, 0);
    for (const b of R.boosterRefs) {
      b.position.set(b.userData.dir.x * 2.95, 0, b.userData.dir.z * 2.95);
      b.rotation.set(0, 0, 0);
    }
    for (const h of R.halves) {
      h.rotation.x = 0; h.position.set(0, Y_FAIR_BASE, 0);
      h.visible = true; h.scale.setScalar(1);          // BUG1修复：复位坠落淡出状态
      R.mats.fairMat.transparent = false; R.mats.fairMat.opacity = 1;
      R.mats.fairInnerMat.transparent = false; R.mats.fairInnerMat.opacity = 1;
    }
    R.upper.position.set(0, 0, 0); R.upper.rotation.set(0, 0, 0);
    R.esc.position.set(0, Y_ESC_BASE, 0); R.esc.rotation.set(0, 0, 0);
    // 分离刚体复位（含 BUG1 的收缩隐藏状态）
    const all = [R.sepBodies.esc, ...R.sepBodies.boosters, R.sepBodies.core, R.sepBodies.upper];
    for (const b of all) {
      b.active = false; b.te = 0;
      b.p.set(0, 0, 0); b.v.set(0, 0, 0); b.rot.set(0, 0, 0);
      b.minRadial = 0; b.maxAxial = 0; b.radial0 = 0;
      b.obj.visible = true; b.obj.scale.setScalar(1);
    }
    setSolarDeploy(R.ship.groups, 0);   // 太阳翼收拢贴壁
    R.flameLight.intensity = 0;
    if (R.spillLight) R.spillLight.intensity = 0;
    R.impactGlow.visible = false;       // 地面冲击火光复位
    for (const u of R.flameUniforms) { u.uFlicker.value = 1; u.uTime.value = 0; }
    for (const f of R.flames) f.visible = false;
    if (R.flame2) R.flame2.visible = false;
    for (const f of R.vernierFlames) f.visible = false;          // 游机火焰随主机一起熄灭
    for (const g2 of R.upperEngGlows) g2.visible = false;
    for (let i = 0; i < R.N; i++) { R.sLife[i] = 0; R.sPos[i * 3 + 1] = -9999; R.sAlpha[i] = 0; }
    for (let i = 0; i < R.EN; i++) { R.eLife[i] = 0; R.ePos[i * 3 + 1] = -9999; R.eAlpha[i] = 0; }
  }

  // 推力/火焰状态快照（供 ?debug=1 诊断与面板核对）
  const thrustState = { core1: false, boost: false, upper: false, vernier: false };
  function setThrust(on, level = 1) {
    // === BUG1 修复：分级控焰 ===
    // 旧逻辑整机统一切换 → 助推器/芯一级分离后，分离体仍拖着火焰飞走（"尾焰脱机"）。
    // 现在：每级火焰只在该级发动机工作段出现，级一分离立即熄灭；
    // 火焰/辉光/光源全是各级发动机的子节点，100% 跟随箭体移动与倾斜。
    // === 火焰持续燃烧修正（对照真实 CZ-2F 时序，2026-09-29）===
    // 真实情况（长征二号F 总设计师荆木春详解）：逃逸塔 120s、助推器【燃料耗尽】150~155s 分离、
    // 一级【燃料耗尽】160s 一二级分离且二级发动机同时启动、210s 整流罩、462s 二级主机关机转游机、
    // 582s 游机关机、585s 船箭分离。即：发动机一直燃烧到燃料耗尽、紧接着分离，分离前绝不提前熄火。
    // 因此火焰熄灭不再绑定"事件时刻"，而绑定【分离体真正开始离体】——分离发生瞬间火焰仍在喷，
    // 待分离体离体 0.35s（或位移 >1.2m）后才熄灭，彻底消除"没分离就熄火"的观感。
    const coreB = R.sepBodies.core;
    const coreSepStarted = coreB.active && (coreB.te > 0.35 || Math.abs(coreB.p.y) > 1.2);
    const boostB = R.sepBodies.boosters[0];
    const boostSepStarted = !!(boostB && boostB.active && boostB.te > 0.35);
    const core1On = on && !coreSepStarted;                            // 芯一级：燃烧至真正分离
    const boostOn = on && !boostSepStarted;                           // 助推器：燃烧至真正分离
    // 二级：与一级分离几乎同时点火（真实 160s"分离 + 二级启动"同步发生），工作至船箭分离
    const upperOn = on && t >= evT('CORE', T_CORE) - 0.2 && t < evT('UPPER', T_UPPER);
    // 二级两段式：主机段（大推力）→ 游机段（小推力）。真实 462s 二级主机关机，之后游机继续
    // 把飞船送入轨道直至 582s 游机关机、585s 船箭分离；两处时刻都可在面板「事件对齐」校准
    const tC0 = evT('CORE', T_CORE), tU0 = evT('UPPER', T_UPPER);
    const tVern = evT('VERN', tC0 + (tU0 - tC0) * 0.72 + VERN_DELAY);   // 主机→游机（默认后移 4s，可在面板校准）
    const tSeco = evT('SECO', tU0 - 0.3);                     // 游机关机（略早于船箭分离）
    const upperVernier = upperOn && t >= tVern;
    const upperBurn = upperOn && t < tSeco;                   // 游机关机后不再喷焰
    thrustState.core1 = core1On; thrustState.boost = boostOn; thrustState.upper = upperOn; thrustState.vernier = upperVernier;
    // 羽流膨胀：高空低气压下尾焰膨胀扩散（真实物理），同时保证远距离时尾焰依然清晰可见
    const plume = 1 + Math.min(rocketY / 250, 3.0);
    // 点火瞬间快速建立火焰：0.5s 内从 25% 长度拉满（点火"轰"一下的效果）
    const build = on ? Math.min(1, (t - T_IGN) / 0.5) : 0;
    const buildK = on ? (0.25 + 0.75 * build) : 1;
    // 高频脉动：亮度/伸缩随推力抖动（火焰不再匀速静态）
    const flick = 0.85 + Math.random() * 0.3;
    for (const u of R.flameUniforms) { u.uFlicker.value = flick; }
    const sx = (0.9 + Math.random() * 0.25 * level) * plume;
    const sy = (0.85 + Math.random() * 0.3 * level) * (1 + (plume - 1) * 0.75) * buildK;
    for (const f of R.coreFlames) {
      f.visible = core1On;
      if (core1On) f.scale.set(sx, sy, sx);
    }
    for (const f of R.boosterFlames) {
      f.visible = boostOn;
      if (boostOn) f.scale.set(sx, sy, sx);
    }
    // 二级：主机相（主机大焰 + 游机小焰）→ 游机相（仅 4 台游机小焰），
    // 到 SECO（游机关机）全部熄灭 —— 全程不熄火，直到真实时序中的关机点
    // 二级羽流（真空）：真实真空中羽流"长而散"——主要沿轴向拉长、径向增幅克制，
    // 否则会在一根 2.25m 直径的二级上膨胀成一个又粗又硬的实心锥（这正是用户截图里的问题）。
    const sxU = (0.9 + Math.random() * 0.25 * level) * (1 + (plume - 1) * 0.40);
    const syU = (0.85 + Math.random() * 0.3 * level) * (1 + (plume - 1) * 0.95) * buildK;
    const upperMainOn = upperBurn && !upperVernier;
    R.flame2.visible = upperMainOn;
    if (upperMainOn) R.flame2.scale.set(sxU * 0.72, syU * 0.62, sxU * 0.72);
    for (const f of R.vernierFlames) {
      f.visible = upperBurn;
      if (upperBurn) f.scale.set(sxU * 0.34, syU * (upperVernier ? 0.42 : 0.30), sxU * 0.34);
    }
    // 二级发动机腔内辉光：主机只在主机相点亮，4 台游机全程点亮（至游机关机）
    for (let i = 0; i < R.upperEngGlows.length; i++) {
      const isMain = (i === 0);
      const lit = upperBurn && (!isMain || !upperVernier);
      R.upperEngGlows[i].visible = lit;
      if (lit) R.upperEngGlows[i].material.opacity = (isMain ? 0.55 : 0.42) + 0.3 * Math.min(1, level);
    }
    // 腔内点火辉光：engineGlows 前 4 个=芯级、后 4 个=助推器，随各自工作段亮灭
    for (let i = 0; i < R.engineGlows.length; i++) {
      const stageOn = i < 4 ? core1On : boostOn;
      R.engineGlows[i].visible = stageOn;
      if (stageOn) R.engineGlows[i].material.opacity = 0.55 + 0.3 * Math.min(1, level);
    }
    // 夜间发射：尾焰为主要光源。色温随脉动在「白黄 ↔ 橙红」间渐变；
    // 光源位置跟随"当前活跃发动机"：芯一级工作时在箭体底部，二级工作时上移到二级喷口
    const boost = 1 + Math.min(rocketY / 400, 1) * 0.8;
    R.flameLight.intensity = on ? (24 + Math.random() * 6) * level * boost * (0.3 + 0.7 * build) * (upperVernier ? 0.62 : 1) : 0;
    R.flameLight.position.y = core1On ? -3 : H_CORE1 - 1;
    R.flameLight.color.setHex(0xfff3d0).lerp(new THREE.Color(0xff9a40), 0.35 + 0.4 * (1 - flick));
    // 地面火光溢出只在低空有意义（随高度衰减，避免高空无意义耗光）
    if (R.spillLight) R.spillLight.intensity = on ? (9 + Math.random() * 3) * level * (0.3 + 0.7 * build) * Math.max(0, 1 - rocketY / 110) : 0;
  }

  // 烟雾生成（两路并行）：
  //  · 尾烟柱（始终）：留在火箭飞过的高度上缓慢上飘，升空全程可见
  //  · 贴地烟涌（低空 rocketY<80）：燃气打到地面后从导流槽沿场坪横向翻卷（实拍最显著的特征）
  function spawnSmoke(dt, intensity) {
    if (rocketY > 260) return;   // 高空后停止生成尾迹
    const pad = rocketY < 80;
    // 生成预算按「池容量 900 ÷ 平均生存期」反推：贴地烟少而大（约600粒常驻），
    // 旧值 16/帧 曾把池灌满 → 恒定最大密度雾墙（过曝+糊死火焰）
    const count = Math.round((pad ? 2.2 : 1.6) * intensity * dt * 60 * (Math.random() < 0.25 ? 2 : 1));
    for (let k = 0; k < count; k++) {
      let idx = -1;
      for (let i = 0; i < R.N; i++) if (R.sLife[i] <= 0) { idx = i; break; }
      if (idx < 0) return;
      const a = Math.random() * Math.PI * 2;
      const ground = pad && (k & 1) === 0;          // 低空时一半贴地涌出、一半留在尾烟柱
      if (ground) {
        // 贴地烟涌：燃气打地面后沿导流槽向外翻卷（横向速度大、上扬小，不顺着箭体往上糊）
        const r = 4 + Math.random() * 16;
        R.sPos[idx * 3] = Math.cos(a) * r;
        R.sPos[idx * 3 + 1] = 0.5 + Math.random() * 2.0;
        R.sPos[idx * 3 + 2] = Math.sin(a) * r;
        const sp = 3.5 + Math.random() * 7;
        R.sVel[idx * 3] = Math.cos(a) * sp;
        R.sVel[idx * 3 + 1] = 0.4 + Math.random() * 1.6;
        R.sVel[idx * 3 + 2] = Math.sin(a) * sp;
        R.sMax[idx] = 3.5 + Math.random() * 2.5;
        R.sSize[idx] = 7 + Math.random() * 7;
      } else {
        // 尾烟柱：BUG1修复——生成点跟随"当前活跃发动机"（芯一级在箭体底部，
        // 级间分离后上移到二级喷口），沿箭体轴向偏移，随倾斜姿态同步偏转
        const offH = (t < T_CORE) ? -4 : H_CORE1 - 1;   // 沿箭体轴的喷口偏移（世界系）
        const ax = Math.sin(pitchNow) * offH, ay = Math.cos(pitchNow) * offH;
        const r = Math.random() * 2.2;
        R.sPos[idx * 3] = rocketX + ax + Math.cos(a) * r;
        R.sPos[idx * 3 + 1] = rocketY + ay + Math.random() * 0.8;
        R.sPos[idx * 3 + 2] = Math.sin(a) * r;
        const sp = 4 + Math.random() * 6;
        R.sVel[idx * 3] = Math.cos(a) * sp * 0.4 + (Math.random() - 0.5);
        R.sVel[idx * 3 + 1] = pad ? (-2 - Math.random() * 4) : (2.5 + Math.random() * 5);
        R.sVel[idx * 3 + 2] = Math.sin(a) * sp * 0.4 + (Math.random() - 0.5);
        R.sMax[idx] = 1.8 + Math.random() * 2.0;
        R.sSize[idx] = 6 + Math.random() * 7;
      }
      R.sLife[idx] = R.sMax[idx];
      R.sAlpha[idx] = 0;
    }
  }

  function updateSmoke(dt) {
    for (let i = 0; i < R.N; i++) {
      if (R.sLife[i] <= 0) { if (R.sAlpha[i] !== 0) R.sAlpha[i] = 0; continue; }
      R.sLife[i] -= dt;
      const f = Math.max(R.sLife[i] / R.sMax[i], 0);
      R.sPos[i * 3] += R.sVel[i * 3] * dt;
      R.sPos[i * 3 + 1] += R.sVel[i * 3 + 1] * dt;
      R.sPos[i * 3 + 2] += R.sVel[i * 3 + 2] * dt;
      // 风场漂移（environment.js）：烟团随所在高度的风平移（低空地面风、高空急流）
      if (envNow) { R.sPos[i * 3] += envNow.windX * dt * 0.55; R.sPos[i * 3 + 2] += envNow.windZ * dt * 0.55; }
      R.sVel[i * 3] *= 0.985; R.sVel[i * 3 + 2] *= 0.985;
      R.sVel[i * 3 + 1] = R.sVel[i * 3 + 1] * 0.99 + 0.4 * dt;
      // 烟团随年龄翻卷变大、变淡；颜色按酒泉戈壁实景定为暖褐沙尘--
      // 刚喷出的一段被火光染成亮橙（与浅灰场坪拉开对比），随后落回沙褐色
      const age = 1 - f;
      R.sSize[i] += dt * (1.5 + age * 2.5);
      const warm = Math.max(0, 1 - age * 3);
      const dR = 0.40, dG = 0.38, dB = 0.37;      // 灰白体积烟（比实拍略暖，夜间不发死黑）
      const fR = 1.05, fG = 0.72, fB = 0.38;      // 近焰区黄色/橙色高温反光（克制，防过曝）
      R.sCol[i * 3] = dR + (fR - dR) * warm;
      R.sCol[i * 3 + 1] = dG + (fG - dG) * warm;
      R.sCol[i * 3 + 2] = dB + (fB - dB) * warm;
      // 峰值透明度压到 0.42~0.62：多层叠加不再糊成死白雾墙，火焰与箭体能透出来
      R.sAlpha[i] = Math.min(1, f * 2.2) * (0.42 + 0.2 * warm);
      if (R.sLife[i] <= 0) { R.sAlpha[i] = 0; R.sPos[i * 3 + 1] = -9999; }
    }
    R.smoke.geometry.attributes.iPos.needsUpdate = true;
    R.smoke.geometry.attributes.iCol.needsUpdate = true;
    R.smoke.geometry.attributes.iSize.needsUpdate = true;
    R.smoke.geometry.attributes.iAlpha.needsUpdate = true;
  }

  // 火星/余烬：点火与上升早期从尾焰里喷出的亮橙色颗粒，受重力下坠、逐渐冷却熄灭
  function spawnEmbers(dt) {
    if (rocketY > 620) return;   // 与羽流膨胀范围匹配，升空中段仍保有火星尾迹
    // 火星沿尾焰喷流锥喷射：随箭体倾斜（重力转向）喷流方向同步偏转；
    // BUG1修复——喷射原点跟随"当前活跃发动机"（级间分离后从二级喷口出）
    const dx = -Math.sin(pitchNow), dy = -Math.cos(pitchNow);   // 尾焰轴线（世界系，机头反向）
    const offH = (t < T_CORE) ? 0 : H_CORE1 - 0.5;              // 活跃喷口沿箭体轴的偏移
    const ox = rocketX - dx * offH, oy = rocketY - dy * offH;   // 喷口世界坐标（轴反向回推）
    // 成簇喷射：随机爆发系数让火星忽多忽少，比恒定速率更接近真实点火
    // （基础速率压低，确保 260 粒子池不被常态填满，爆发簇才能真正显现）
    const burst = Math.random() < 0.2 ? 2.8 : (Math.random() < 0.35 ? 0.4 : 1);
    const count = Math.floor((8 * dt * 60 + 1) * burst);
    for (let k = 0; k < count; k++) {
      let idx = -1;
      for (let i = 0; i < R.EN; i++) if (R.eLife[i] <= 0) { idx = i; break; }
      if (idx < 0) return;
      const a = Math.random() * Math.PI * 2;
      // 出生点分布在焰锥内：沿喷流轴 1.5~6m，越远越散（锥形张开），不再从一点球状炸开
      const along = 1.5 + Math.random() * 4.5;
      const rr = Math.random() * (0.35 + along * 0.24);
      R.ePos[idx * 3]     = ox + dx * along + Math.cos(a) * rr;
      R.ePos[idx * 3 + 1] = oy + dy * along + (Math.random() - 0.5) * 0.6;
      R.ePos[idx * 3 + 2] = Math.sin(a) * rr;
      // 初速 = 沿喷流方向的高速射流 + 锥向散布（真实火星顺焰流冲出再翻卷下坠）
      const jet = 14 + Math.random() * 26;
      const spread = 3 + Math.random() * 7;
      R.eVel[idx * 3]     = dx * jet + Math.cos(a) * spread + (Math.random() - 0.5) * 3;
      R.eVel[idx * 3 + 1] = dy * jet + (Math.random() - 0.5) * 4;
      R.eVel[idx * 3 + 2] = Math.sin(a) * spread + (Math.random() - 0.5) * 3;
      // 大小/寿命两极分化：多数小粒短促熄灭，少数大块火星翻卷更久（视觉层次）
      const big = Math.random() < 0.12;
      R.eMax[idx] = big ? 1.2 + Math.random() * 1.1 : 0.3 + Math.random() * 0.6;
      R.eLife[idx] = R.eMax[idx];
      // 高空羽流膨胀，火星随之放大，保证远距离仍可见
      const grow = 1 + Math.min(rocketY / 300, 1.8);
      R.eSize[idx] = (big ? 2.2 + Math.random() * 2.4 : 0.9 + Math.random() * 1.8) * grow;
      R.eAlpha[idx] = 0;
    }
  }

  function updateEmbers(dt) {
    for (let i = 0; i < R.EN; i++) {
      if (R.eLife[i] <= 0) { if (R.eAlpha[i] !== 0) R.eAlpha[i] = 0; continue; }
      R.eLife[i] -= dt;
      const f = Math.max(R.eLife[i] / R.eMax[i], 0);
      R.eVel[i * 3 + 1] -= 6.5 * dt;                 // 受重力下坠（比真实弱，视觉更飘）
      R.eVel[i * 3] *= 1 - 0.55 * dt;                // 空气阻力：横向射流逐渐衰减、轨迹变卷曲
      R.eVel[i * 3 + 2] *= 1 - 0.55 * dt;
      // 风场：余烬质量小、被吹得更明显
      if (envNow) { R.eVel[i * 3] += envNow.windX * dt * 1.6; R.eVel[i * 3 + 2] += envNow.windZ * dt * 1.6; }
      R.ePos[i * 3] += R.eVel[i * 3] * dt;
      R.ePos[i * 3 + 1] += R.eVel[i * 3 + 1] * dt;
      R.ePos[i * 3 + 2] += R.eVel[i * 3 + 2] * dt;
      R.eSize[i] = Math.max(0.25, R.eSize[i] * (1 - dt * 0.5));
      // 颜色：白热 -> 亮橙 -> 暗红熄灭（加色混合，亮部直接饱和）
      R.eCol[i * 3] = 0.5 + 1.6 * f;
      R.eCol[i * 3 + 1] = 0.26 + 0.8 * f;
      R.eCol[i * 3 + 2] = 0.08 + 0.22 * f * f;
      // 闪烁：每帧随机明暗抖动（燃烧中的火星固有特征），临熄灭前渐暗
      const flick = 0.65 + 0.35 * Math.random();
      R.eAlpha[i] = Math.min(1, f * 1.7) * flick;
      if (R.eLife[i] <= 0) { R.eAlpha[i] = 0; R.ePos[i * 3 + 1] = -9999; }
    }
    R.embers.geometry.attributes.position.needsUpdate = true;
    R.embers.geometry.attributes.aColor.needsUpdate = true;
    R.embers.geometry.attributes.aSize.needsUpdate = true;
    R.embers.geometry.attributes.aAlpha.needsUpdate = true;
  }

  // ---- 运镜：按"当前应取景的箭体范围"自动推算距离与注视点，并缓慢改变环绕角/俯仰角 ----
  // 目标：火箭从头到尾始终完整在画面内（不裁切、不被面板遮挡），同时用拉远/俯仰/环绕保留氛围。
  const CAM_FOV = 45;
  // 各阶段应取景的箭体纵向范围（火箭本地坐标，米）。部件分离后取景范围随之收缩，镜头自然"跟上"剩下的箭体。
  function stackSpan(tt) {
    let y0 = 0, y1 = 58.3;
    if (tt >= T_ESC) y1 = 50.3;                    // 逃逸塔已抛
    // 一二级分离后：芯一级已脱离，但整流罩仍在箭上（时序：先级间分离、后抛整流罩），
    // 取景上限保留到罩顶；并在分离后 6s 内把坠落的一级纳入取景（镜头跟随下移 70%、下限 -14m），
    // 让"一级脱离坠落"这一动作清晰可见，不至于刚分开就离开画面
    if (tt >= T_CORE) {
      y0 = 21.0; y1 = 58.3;
      const cb = R && R.sepBodies && R.sepBodies.core;
      if (cb && cb.active && cb.te < 4) y0 = Math.min(y0, Math.max(-45, cb.p.y));
    }
    if (tt >= T_FAIR) y1 = 51.3;                   // 整流罩已抛
    if (tt >= T_UPPER) { y0 = 38.5; y1 = 51.5; }   // 二级+航天器（含分离后漂离的上面级）
    return { y0: y0, y1: y1 };
  }
  // 环绕角（方位）与俯仰角随时间缓慢变化：起飞时低机位仰视，入轨后抬升为俯瞰
  function cameraOrbit(tt) {
    const u = Math.min(tt / MAX_T, 1);
    return {
      az: 34 - 22 * u,                             // 34° -> 12°（避开塔架一侧，标识始终朝向镜头）
      el: -13 + 41 * Math.pow(u, 1.25),            // -13°(仰视) -> +28°(俯瞰)
    };
  }
  const camState = { offY: 29.2, dist: 95, az: 34, el: -13 };
  let camInit = false;

  // 诊断句柄（?debug=1 时暴露到 window，供控制台/CDP 核查运镜与尾焰状态）
  if (typeof window !== 'undefined' && /[?&]debug=1/.test(window.location.search)) {
    window.__launchDebug = {
      state: () => {
        const tk = Math.max(t - T_IGN, 0);
        const uu = Math.min(1, tk / SIM.ramp), ramp = uu * uu * (3 - 2 * uu);
        const mf = 1 - SIM.burnFrac * Math.min(1, tk / SIM_BURN);
        return {
        t: +t.toFixed(2), rocketY: +rocketY.toFixed(1), rocketX: +rocketX.toFixed(1), pitchDeg: +(pitchNow * 180 / Math.PI).toFixed(1),
        // 点火物理修正诊断：锁止状态 / 竖直速度 / 当前推重比 / 真实高度
        locked: simLocked, vVert: +simVel.toFixed(2), twr: +(SIM.twr * ramp / mf).toFixed(2), altReal: +simAltM.toFixed(0),
        // 环境系统（environment.js）：大气/重力/风/气象
        env: envNow ? {
          altKm: +(envNow.altM / 1000).toFixed(2), tempC: +envNow.tempC.toFixed(1), presHPa: +envNow.presHPa.toFixed(1),
          dens: +envNow.dens.toFixed(5), densRatio: +envNow.densRatio.toExponential(1), g: +envNow.gravity.toFixed(3),
          windMs: +envNow.windSpeed.toFixed(1), gust: +envNow.gust.toFixed(1), turb: +envNow.turbulence.toFixed(2),
          mach: +envNow.mach.toFixed(2), qPa: +envNow.dynamicQ.toFixed(0),
        } : null,
        weather: ENV.weatherState(),
        tower: { arms: R.towerMod.arms.length, clear: R.towerMod.armsClear(t), stats: R.towerMod.stats() },
        // 分离体诊断：核查各部件是否按时刻分离/坠落
        sep: (() => {
          const out = {};
          const put = (k, b) => { out[k] = { act: b.active, te: +b.te.toFixed(2), py: +b.p.y.toFixed(2), sc: +b.obj.scale.x.toFixed(3), vis: b.obj.visible }; };
          put('esc', R.sepBodies.esc); put('core', R.sepBodies.core); put('upper', R.sepBodies.upper);
          out.boost = R.sepBodies.boosters.map(b => ({ act: b.active, te: +b.te.toFixed(2), py: +b.p.y.toFixed(2), vis: b.obj.visible }));
          return out;
        })(),
        timers: { ESC: evT('ESC', T_ESC), BOOST: evT('BOOST', T_BOOST), FAIR: evT('FAIR', T_FAIR), CORE: evT('CORE', T_CORE), UPPER: evT('UPPER', T_UPPER), SOLAR: evT('SOLAR', T_SOLAR) },
        flameScale: R.flames[0] ? +R.flames[0].scale.x.toFixed(2) : 0,
        flameLen: R.flames[0] ? +R.flames[0].scale.y.toFixed(2) : 0,
        flameVisible: R.flames.every(f => f.visible),
        thrust: { core1: thrustState.core1, boost: thrustState.boost, upper: thrustState.upper, vernier: thrustState.vernier },
        cam: { dist: +camState.dist.toFixed(1), offY: +camState.offY.toFixed(1), az: +camState.az.toFixed(1), el: +camState.el.toFixed(1) },
        };
      },
      // 音频层由 main.js 注入（audioProbe），供倒数段排查人声起播
      setAudioProbe: (fn) => { window.__launchDebug.audio = fn; },
    };
  }

  function phaseOf(tt) {
    for (const p of LAUNCH_PHASES) if (tt >= p.tStart && tt < p.tEnd) return p;
    return LAUNCH_PHASES[LAUNCH_PHASES.length - 1];
  }

  function start() { reset(); active = true; playing = true; R.rig.visible = true; camera.far = 12000; camera.near = 0.5; camera.updateProjectionMatrix(); scene.fog = new THREE.Fog(0x1b1d26, 260, 4200); measureFrameOffset(); }   // 夜间雾色
  function play() { playing = true; }
  function pause() { playing = false; }
  function replay() { reset(); playing = true; measureFrameOffset(); }
  function exit() {
    active = false; playing = false;
    R.rig.visible = false;
    setThrust(false);
    scene.fog = null;
    camera.far = 1000; camera.near = 0.1;
    camera.updateProjectionMatrix();
  }

  // 太阳翼双向切换（展开 / 收拢）
  function toggleSolar() {
    solarOverride = true;
    solarTarget = solarTarget > 0.5 ? 0 : 1;
    if (audioHooks && audioHooks.solarServo) audioHooks.solarServo(solarTarget);
    return solarTarget;
  }

  // ---- 分离物理：激活 / 积分 / 约束求解 ----
  function activateSep(b) {
    if (!b || b.active) return;
    b.active = true; b.te = 0;
    b.p.set(0, 0, 0); b.v.set(0, 0, 0); b.rot.set(0, 0, 0);
    b.minRadial = 0; b.maxAxial = 0;
    b.radial0 = Math.hypot(b.home.x, b.home.z);   // 分离起始轴距（安全距离由此平滑爬升）
  }

  // 约束：分离安全距离（半径向/轴向）+ 单调性 + 地面，从根源杜绝穿模
  function solveSepConstraints(b) {
    // 1) 径向安全轴距：目标平滑爬升到位，且达成后单调不减（永不回弹靠近）
    if (b.safeRadial > 0) {
      const cx = b.home.x + b.p.x, cz = b.home.z + b.p.z;
      const radial = Math.hypot(cx, cz);
      const ramp = smoothstep(0, SEP_BURN * 1.8, b.te);
      const target = (b.radial0 || 0) + (b.safeRadial - (b.radial0 || 0)) * ramp;
      const want = Math.max(radial, target, b.minRadial);
      if (want > radial + 1e-6) {
        let nx = radial > 1e-6 ? cx / radial : b.dir.x;
        let nz = radial > 1e-6 ? cz / radial : b.dir.z;
        const nl = Math.hypot(nx, nz) || 1;
        nx /= nl; nz /= nl;
        b.p.x += nx * (want - radial);
        b.p.z += nz * (want - radial);
        // 排斥：清除指向轴心的速度分量
        const vn = b.v.x * nx + b.v.z * nz;
        if (vn < 0) { b.v.x -= vn * nx; b.v.z -= vn * nz; }
      }
      b.minRadial = Math.max(b.minRadial, want);
    }
    // 2) 轴向让开（芯级/上级向下分离）：间隙单调增大，不允许回弹
    if (b.axisMode === 'down' && b.safeAxial > 0) {
      const ramp = smoothstep(0, SEP_BURN * 1.8, b.te);
      const want = Math.max(-b.p.y, b.safeAxial * ramp, b.maxAxial);
      if (want > -b.p.y + 1e-6) {
        b.p.y = -want;
        if (b.v.y > 0) b.v.y = 0;
      }
      b.maxAxial = Math.max(b.maxAxial, want);
    }
    // 3) 地面：底部不低于地面，杜绝陷入地表/发射台
    const bottom = rocketY + b.home.y + b.p.y + (b._center.y - b.halfH);
    if (bottom < GROUND_MIN) {
      b.p.y += (GROUND_MIN - bottom);
      if (b.v.y < 0) b.v.y = 0;
    }
  }

  // 逐帧积分：分离动力（软启动/软停止）+ 重力 + 火箭加速惯性力 + 阻尼，再解约束
  function stepSepBody(b, dt, aRocket) {
    if (!b || !b.active) return;
    b.te += dt;
    const burn = smoothstep(0, 0.14, b.te) * (1 - smoothstep(SEP_BURN - 0.14, SEP_BURN, b.te));
    const ax = b.dir.x * b.sepAcc * burn;
    const ay = b.dir.y * b.sepAcc * burn - (G + aRocket);   // 重力 + 火箭向上加速带来的惯性力
    const az = b.dir.z * b.sepAcc * burn;
    b.v.x += ax * dt - b.v.x * DRAG_LINEAR * dt;
    b.v.y += ay * dt - b.v.y * DRAG_LINEAR * 0.5 * dt;
    b.v.z += az * dt - b.v.z * DRAG_LINEAR * dt;
    b.p.addScaledVector(b.v, dt);
    // 翻滚 + 角阻尼
    b.rot.addScaledVector(b.w, dt);
    b.w.multiplyScalar(1 - DRAG_ANGULAR * dt);
    solveSepConstraints(b);
    b.obj.position.set(b.home.x + b.p.x, b.home.y + b.p.y, b.home.z + b.p.z);
    b.obj.rotation.set(b.rot.x, b.rot.y, b.rot.z);
  }

  // 物理步进（可被快进复用）：只推进运动与分离状态，不做视觉与音效
  // 音频主时钟：人声文件时间轴与场景时间轴 1:1（CLIP_LEAD=0），音频在播时直接以其
  // currentTime 驱动场景时间。否则场景 dt 被上限钳制（低帧率下场景变慢），音频按真实
  // 时间播；负载越重倒数人声越是冲到画面前面（实测低帧率下领先 11 秒）。
  // 音频卡顿（播放头停滞）时不跟随，避免画面被冻结；恢复后一次性追平。
  let masterMt = -1;
  function masterClock() {
    const mt = audioHooks && audioHooks.masterTime ? audioHooks.masterTime() : null;
    if (mt === null || mt < 0.05) { masterMt = -1; return null; }   // 尚未真正出声
    const stalled = masterMt >= 0 && mt <= masterMt + 1e-4;         // 播放头没动 = 卡顿
    masterMt = mt;
    if (stalled) return null;
    if (mt >= t - 0.02) return mt;       // 音频未落后 → 以音频为准
    if (t - mt < 2) return mt;           // ② 音频小幅落后（静音恢复/瞬时卡顿）→ 回吸对齐，杜绝永久失步
    return null;                         // 音频大幅落后（刚重对齐）→ 本帧走 dt
    return null;                                                    // 音频落后（刚重对齐）→ 本帧走 dt
  }

  function stepPhysics(dt) {
    if (playing) {
      if (!fastFwd) {
        const mt = masterClock();
        if (mt !== null) t = mt; else t += dt;                // 音频在播=主时钟；否则按 dt 推进
      } else {
        t += dt;                                              // 快进（阶段跳转）不用音频钟
      }
      if (t >= MAX_T) { t = MAX_T; playing = false; }
    }

    // ---- 阶段运动 ----
    // BUG1修复：setThrust 内部按各级工作段分别控焰（芯一级/助推器/二级），
    // on 只表示"动力飞行中"；级间分离后由二级接管，flame2 的显隐也已在 setThrust 内处理
    setThrust(t >= T_IGN && t < T_UPPER, 1.18);

    // ① 竖直运动（点火物理修正）：台架锁死 → 推力>重力解锁 → 燃料消耗、推重比增大；
    //    横向随倾角积分（dX = tan(pitch)·dY）；箭体绕基座旋转，机头沿轨迹切线，
    //    尾焰为子物体随箭体角度同步偏转。
    const tk = Math.max(t - T_IGN, 0);
    const newAlt = stepAscent(dt, t);   // 推力爬升 + 发射台锁死 + 燃料消耗积分
    pitchNow = pitchAt(t);
    if (t > T_IGN) rocketX += Math.tan(pitchNow) * Math.max(newAlt - rocketY, 0);
    rocketY = newAlt;
    R.rocket.position.set(rocketX, rocketY, 0);
    R.rocket.rotation.z = -pitchNow;   // 负角 = 机头向东（+X）侧倾

    // ---- 分离刚体：按时间激活，逐帧积分（含惯性力、重力、分离动力、阻尼）----
    // 火箭自身的向上加速度（自由体在箭体系内受到反向惯性力）
    // 火箭自身的向上加速度（自由体在箭体系内受到反向惯性力）：
    // 用真实物理模型解出的净加速度（simAcc），替代旧的解析常数 a0+A_THRUST_K·tk
    // （旧式在 tk=116s 时会给出 ~143 m/s²，把分离体瞬间甩出几公里、视觉上像"没分离"）
    const aRocket = (t < evT('UPPER', T_UPPER)) ? Math.max(0, simAcc) : 0;
    if (t >= evT('ESC', T_ESC)) activateSep(R.sepBodies.esc);
    if (t >= evT('BOOST', T_BOOST)) for (const b of R.sepBodies.boosters) activateSep(b);
    if (t >= evT('CORE', T_CORE)) activateSep(R.sepBodies.core);
    if (t >= evT('UPPER', T_UPPER)) activateSep(R.sepBodies.upper);
    stepSepBody(R.sepBodies.esc, dt, aRocket);
    for (const b of R.sepBodies.boosters) stepSepBody(b, dt, aRocket);
    stepSepBody(R.sepBodies.core, dt, aRocket);
    stepSepBody(R.sepBodies.upper, dt, aRocket);
    // === BUG1 修复：分离部件坠落消失 ===
    // 分离 6s 后开始收缩淡出（scale→0），10s 后隐藏。避免被抛部件静止悬浮在场景里挡视线；
    // reset() 会恢复 visible/scale，重播/跳转不受影响。
    const allSep = [R.sepBodies.esc, ...R.sepBodies.boosters, R.sepBodies.core, R.sepBodies.upper];
    for (const b of allSep) {
      if (!b.active) continue;
      if (b.te > 8) {
        const k = Math.min((b.te - 8) / 6, 1);
        b.obj.scale.setScalar(Math.max(0.001, 1 - k));
        if (k >= 1 && b.obj.visible) b.obj.visible = false;
      }
    }

    // 整流罩：绕基座铰链张开（角度与外移量均随时间单调递增，绝不会向内回扫）；
    // 张开让位后（T_FAIR+7s 起）带重力坠落感向斜后下方飘落，逐渐变小淡出，最后隐藏
    const tFair = evT('FAIR', T_FAIR);   // 支持面板一键对齐
    if (t >= tFair) {
      const k = Math.min((t - tFair) / 2.5, 1);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const kd = Math.max(0, Math.min((t - tFair - 2.5) / 4.5, 1));
      // 坠落淡出段：张开后 7s 开始，历时 6s
      const kf = Math.max(0, Math.min((t - tFair - 7) / 6, 1));
      const fall = kf * kf * 26;                       // 重力坠落（位移随时间平方增长）
      const back = kf * 14;                            // 向斜后方（-X 顺飞行方向的反向）飘远
      for (const h of R.halves) {
        h.rotation.x = h.userData.side * e * 1.25;
        h.position.z = h.userData.side * kd * kd * 10;
        h.position.y = Y_FAIR_BASE - kd * kd * 6 - fall;
        h.position.x = -back * (0.6 + 0.4 * Math.abs(h.userData.side));
        const s = 1 - kf * 0.35;                       // 逐渐变小
        h.scale.setScalar(s);
        h.visible = kf < 1;
        // 淡出：仅坠落段临时开启透明（避免常驻 transparency 引起排序闪烁）
        const fade = 1 - kf;
        if (kf > 0) {
          R.mats.fairMat.transparent = true; R.mats.fairMat.opacity = fade;
          R.mats.fairInnerMat.transparent = true; R.mats.fairInnerMat.opacity = fade;
        }
      }
    }
    // 太阳翼展开（时间线驱动；用户手动切换后由 override 接管）
    if (!solarOverride && t >= evT('SOLAR', T_SOLAR)) solarTarget = 1;
    // === 帆板动画改动区：展开节奏对齐参考视频（全程 ~9s）===
    // 时间常数 τ≈2.4s → 到达 98% 约需 8.5s；三阶段（解锁/根部旋出/逐段展开/锁止）
    // 的节奏分配见 spacecraft.js setSolarDeploy
    solarCur += (solarTarget - solarCur) * (1 - Math.exp(-dt * 0.42));
    setSolarDeploy(R.ship.groups, solarCur);
    if (!solarDone && solarCur > 0.985) { solarDone = true; if (!fastFwd && audioHooks && audioHooks.chime) audioHooks.chime(); }
    if (solarCur < 0.02) solarDone = false;

    // ③ 塔架机构（模块化 tower.js）：摆杆分批摆离 + 脐带管线脱开 + 底部支撑压紧机构随解锁释放，
    //    并带"起飞前摆杆必须撤清"的互锁校验（违规时强制收尾并告警）
    R.towerMod.update(t, { lifted: !simLocked, liftT: simLiftT });

    // === 环境系统：气象演进 + 高空环境采样（风场用于烟尘漂移）===
    ENV.stepWeather(dt);
    envNow = ENV.envSample(simAltM, simVel, t);
    if (!R.towerMod.armsClear(t) && !simLocked) { /* 互锁：正常时序下不会发生 */ }

    // === 火焰特效改造区：着色器时间驱动 + 地面冲击火光 ===
    // uTime 用场景时间 t（暂停即冻结、seek 连续），湍流/撕裂随之启停
    for (const u of R.flameUniforms) u.uTime.value = t;
    R.impactUni.uTime.value = t;
    // 冲击火光：点火后低空强烈（喷流打到发射台），随高度升高 ~35m 内衰减消失
    const impactK = (t >= T_IGN && t < T_UPPER) ? Math.max(0, 1 - rocketY / 24) : 0;   // 更低高度就消失
    R.impactGlow.visible = impactK > 0.03;
    if (R.impactGlow.visible) {
      const pulse = 0.8 + 0.2 * Math.sin(t * 23.0);        // 与尾焰脉动同源
      R.impactUni.uGlow.value = impactK * pulse * 0.28;    // 压低峰值（用户：非火焰光晕太大）
      const s = 4.6 + rocketY * 0.10 + Math.sin(t * 19.0) * 0.55;   // 收紧光斑（原来随高度大幅扩张）
      R.impactGlow.scale.set(s, s, s);
      R.impactGlow.position.x = rocketX;                    // 冲击点跟随箭体基座
    }

    // 烟雾与火星（快进时跳过，避免跳转后残留大量粒子）
    if (!fastFwd) {
      if (t >= T_IGN && t < T_UPPER) {
        spawnSmoke(dt, t < T_BOOST ? 1 : 0.5);
        if (rocketY < 620) spawnEmbers(dt);   // 点火与上升早期的火星/余烬
      }
      updateSmoke(dt);
      updateEmbers(dt);
    }
  }

  function update(dt) {
    if (!active) return;
    stepPhysics(dt);

    // === BUG3 修复：高度环境三段平滑过渡 ===
    // 低空段（<100m）：大气通透，地面/塔架/山体清晰；中高空：大气渐薄、天空变深、
    // 地面渐远；高空（>700m）：大气散尽、黑色太空+明显星点+弧形地球轮廓。无跳变。
    const atm = THREE.MathUtils.clamp(1 - (rocketY - 100) / 600, 0, 1);   // 大气 100m 起薄、700m 散尽
    const space = 1 - atm;
    R.skyDome.material.opacity = 0.35 + 0.65 * atm;   // 星空穹顶不隐藏：低空满亮，高空保留星点
    R.skyDome.visible = true;
    if (scene.fog) {
      scene.fog.near = 260 + space * 5000; scene.fog.far = 4200 + space * 9000;
      // 雾色跟随天空地平线色，避免近景与天空色调割裂（阴天/高空各有不同）
      R.skyGrad.horizonColor(_fogCol);
      scene.fog.color.copy(_fogCol);
    }
    // 天空随高度分层：skyT 与星空/地球弧形同源（场景高度 0→900m），气辉按 ρ/ρ0 衰减
    const skyT = THREE.MathUtils.clamp(rocketY / 900, 0, 1);
    R.skyGrad.update(skyT, envNow ? envNow.densRatio : 1, ENV.weatherState().cloudiness);
    // 云量高时压暗星空（阴天看不到星）
    // 烘焙层改为加色叠加后，透明度即"叠加量"：压低上限，避免两层相加出现黄昏感
    R.skyDome.material.opacity = (0.30 + 0.55 * atm) * (1 - 0.55 * ENV.weatherState().cloudiness);
    const siteOp = Math.min(1, atm * 1.6);
    for (const m of R.siteMats) m.opacity = siteOp;
    R.site.visible = siteOp > 0.01;
    // 弧形地球 + 大气边缘辉光：随大气消散浮现，跟随箭体沿飞行方向移动
    R.earthBall.position.set(rocketX, -2600, 0);
    if (space > 0.02) { R.ensureEarthGlobe(); R.earthBall.rotation.y += dt * 0.004; }   // 首次进入高空时生成真实地表
    R.earthBall.material.opacity = space * 0.95;
    R.earthBall.visible = space > 0.02;
    R.atmoRim.position.copy(R.earthBall.position);
    if (R.atmoRim.material.uniforms) R.atmoRim.material.uniforms.uStrength.value = space * 1.5;
    R.atmoRim.visible = R.earthBall.visible;
    // 避雷塔航空障碍灯：约 2.4s 周期闪烁（真实障碍灯常闪，不随演示暂停）
    if (R.site.visible) {
      const blink = Math.pow(Math.max(Math.sin(performance.now() * 0.0026), 0), 2.2);
      R.beaconMat.color.setRGB(0.3 + 0.7 * blink, 0.12 + 0.23 * blink, 0.07 + 0.16 * blink);
    }

    // ---- 运镜：按取景范围自动推算距离，缓慢环绕/俯仰，火箭始终完整在画面内 ----
    // （?debug=1 下置 window.__wbScene.freeCam = true 可接管相机，供 CDP 截图核查建模）
    const freeCam = typeof window !== 'undefined' && window.__wbScene && window.__wbScene.freeCam === true;
    if (!freeCam) {
    const span = stackSpan(t);
    const orb = cameraOrbit(t);
    const wantOffY = (span.y0 + span.y1) / 2;                     // 注视点 = 应取景范围的中点
    const wantH = (span.y1 - span.y0) * 1.22 + 4;                 // 22% 余量 + 上下留白
    const wantDist = (wantH / 2) / Math.tan(THREE.MathUtils.degToRad(CAM_FOV) / 2);
    const kFit = 1 - Math.exp(-dt * 2.2);                         // 取景平滑（约 0.45s 时间常数）
    const kOrb = 1 - Math.exp(-dt * 0.55);                        // 环绕/俯仰更慢，运镜从容
    if (!camInit) {
      camState.offY = wantOffY; camState.dist = wantDist;
      camState.az = orb.az; camState.el = orb.el; camInit = true;
    }
    camState.offY += (wantOffY - camState.offY) * kFit;
    camState.dist += (wantDist - camState.dist) * kFit;
    camState.az += (orb.az - camState.az) * kOrb;
    camState.el += (orb.el - camState.el) * kOrb;

    camTgt.set(rocketX + camState.offY * Math.sin(pitchNow), rocketY + camState.offY * Math.cos(pitchNow), 0);
    // 高空下压镜头：从 900m 场景高度看 R=2600 地球，地平线在水平线下约 42°，
    // 而 el 曲线最高仅 +28°（下缘 28+22.5=50.5°勉强擦边）→ 高空运镜里地球几乎不入画。
    // 按真空度 space 附加下压角（低空 space≈0 完全不变），让"火箭 + 弧形地球"同框。
    const azr = THREE.MathUtils.degToRad(camState.az);
    const elr = THREE.MathUtils.degToRad(camState.el + space * 16);
    camPos.set(
      camTgt.x + camState.dist * Math.cos(elr) * Math.sin(azr),
      camTgt.y + camState.dist * Math.sin(elr),
      camTgt.z + camState.dist * Math.cos(elr) * Math.cos(azr)
    );
    if (camPos.y < 3) camPos.y = 3;      // 起飞前镜头不穿到地面以下
    applyFrameOffset();                  // 按面板占位把火箭推到画面右侧 / 上侧
    camera.position.copy(camPos);
    camera.lookAt(camTgt);
    }
  }

  function getHud() {
    const ph = phaseOf(t);
    const fuel = t < T_IGN ? Math.max(0, Math.min(100, Math.round((t / T_IGN) * 100))) : 100;
    let clock, cd = null;
    if (t < T_IGN) {
      const s = Math.max(0, Math.ceil(T_IGN - t));
      clock = 'T- 00:' + String(s).padStart(2, '0');
      // 倒数全程显示 10..1（素材音频从 10 开始倒数），与音频逐秒对齐
      cd = Math.ceil(T_IGN - t);
    } else {
      // 点火后时钟映射到任务时间（与遥测锚点一致，分离事件对上真实口令时刻）
      const s = telemetryAt(t).mission;
      clock = 'T+ ' + String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    }
    const alt = Math.round(rocketY / SCENE_SCALE);   // 场景高度（米）：驱动音频衰减等，保持原语义
    const tele = telemetryAt(t);
    const gNow = gravityAt(tele.alt);
    const status = t < T_IGN
      ? '倒计时 ' + Math.max(1, Math.ceil(T_IGN - t)) + ' · 燃料加注 ' + fuel + '% / 系统自检'
      : (t >= T_UPPER
          ? '在轨飞行 · 高度 ' + fmtAlt(tele.alt) + ' · 速度 ' + fmtVel(tele.vel) + ' · 重力 ' + gNow.toFixed(2) + ' m/s²'
          : '高度 ' + fmtAlt(tele.alt) + ' · 速度 ' + fmtVel(tele.vel) + ' · 重力 ' + gNow.toFixed(2) + ' m/s²');
    return { phaseId: ph.id, phaseName: ph.name, phaseSummary: ph.summary, clock, cd, fuel, status, active, playing, t, alt, mAlt: tele.alt, mVel: tele.vel, g: gNow };
  }

  // 跳转到指定时刻：分离物理为逐帧积分，需固定步长快进以保证状态正确
  function seek(tt) {
    reset();
    playing = true; R.rig.visible = true;
    measureFrameOffset();          // 阶段跳转时同样按当前面板占位重新构图
    const goal = Math.max(0, Math.min(tt, MAX_T));
    const step = 1 / 60;
    let guard = 0;
    fastFwd = true;
    while (t < goal && guard++ < 20000) stepPhysics(Math.min(step, goal - t));
    fastFwd = false;
  }

  // 粒子存活数（供 ?debug=1 面板确认粒子系统是否在工作）
  function particleStats() {
    let sAlive = 0, eAlive = 0;
    for (let i = 0; i < R.N; i++) if (R.sLife[i] > 0) sAlive++;
    for (let i = 0; i < R.EN; i++) if (R.eLife[i] > 0) eAlive++;
    return { sAlive: sAlive, eAlive: eAlive, sTotal: R.N, eTotal: R.EN };
  }

  if (window.__PERF) window.__PERF.marks['launch-built'] = performance.now() - window.__PERF.t0;

  // ---- 点火动力学读数与参数接口（供页面顶部「点火动力学」面板）----
  // 返回值全部为物理量纲：推力 kN / 质量 t / 加速度 m/s² / 高度 m（积分真实高度）
  function getPhy() {
    const tk = Math.max(t - T_IGN, 0);
    const uu = Math.min(1, tk / SIM.ramp), ramp = uu * uu * (3 - 2 * uu);
    const mf = 1 - SIM.burnFrac * Math.min(1, tk / SIM_BURN);
    const burning = t >= T_IGN && t < T_UPPER;          // 船箭分离后关机
    const thrustAcc = burning ? SIM.twr * G_EARTH * ramp : 0;
    const mass = SIM.m0 * mf;
    const thrustN = thrustAcc * mass;
    const twr = mass > 0 ? thrustN / (mass * G_EARTH) : 0;
    const acc = (burning && !simLocked) ? Math.max(0, thrustAcc / mf - G_EARTH) : 0;
    return {
      thrustKN: thrustN / 1000, massT: mass / 1000, twr,
      acc, locked: simLocked, vVert: simVel, altReal: simAltM,
      ramp, active: burning, t,
    };
  }
  // 顶部面板改参数后调用：写入 SIM 并复位到点火前状态（重新演示）
  function setPhyParams(p) {
    if (!p) return;
    if (p.twr != null && isFinite(p.twr)) SIM.twr = Math.max(1.0, Math.min(3.0, +p.twr));
    if (p.ramp != null && isFinite(p.ramp)) SIM.ramp = Math.max(0.5, Math.min(10, +p.ramp));
    if (p.m0 != null && isFinite(p.m0)) SIM.m0 = Math.max(50000, Math.min(2000000, +p.m0));
    if (p.burnFrac != null && isFinite(p.burnFrac)) SIM.burnFrac = Math.max(0.2, Math.min(0.95, +p.burnFrac));
    reset();
  }
  function getPhyParams() { return { twr: SIM.twr, ramp: SIM.ramp, m0: SIM.m0, burnFrac: SIM.burnFrac }; }

  // ---- 真实动作全事件表（运行时）：audio 类取实际触发时刻，logic 类按物理/时序实时计算 ----
  function getEventList() {
    const ev = getEventTimes();
    const tC0 = ev.CORE, tU0 = ev.UPPER;
    const list = [
      { id: 'IGN',   name: '点火',                  demo: T_IGN,   realT: '0s',        kind: 'audio' },
      { id: 'LIFT',  name: '解锁离塔（起飞）',       demo: simLiftT || (T_IGN + 3.05), realT: '约 3 秒多', kind: 'logic' },
      { id: 'TURN',  name: '程序转弯',              demo: evT('TURN', T_IGN + PITCH_T0), realT: '12s', kind: 'logic' },
      { id: 'ESC',   name: '逃逸塔分离',            demo: ev.ESC,   realT: '120s',      kind: 'audio' },
      { id: 'BOOST', name: '助推器分离',            demo: ev.BOOST, realT: '150~155s',  kind: 'audio' },
      { id: 'CORE',  name: '一二级分离 + 二级点火',  demo: ev.CORE,  realT: '160s',      kind: 'audio' },
      { id: 'FAIR',  name: '整流罩分离',            demo: ev.FAIR,  realT: '210s',      kind: 'audio' },
      { id: 'VERN',  name: '二级主机关机 → 游机',    demo: evT('VERN', tC0 + (tU0 - tC0) * 0.72 + VERN_DELAY), realT: '462s', kind: 'logic' },
      { id: 'SECO',  name: '游机关机',              demo: evT('SECO', tU0 - 0.3), realT: '582s', kind: 'logic' },
      { id: 'UPPER', name: '船箭分离',              demo: ev.UPPER, realT: '585s',      kind: 'audio' },
      { id: 'SOLAR', name: '太阳帆板展开',          demo: ev.SOLAR, realT: '入轨后',    kind: 'audio' },
    ];
    return list.sort((a, b) => a.demo - b.demo);
  }

  // 全部 11 个动作都可在面板「事件对齐」中校准（含 4 个逻辑动作：起飞/转弯/主机转游机/游机关机）
  function getAlignOptions() {
    const ev = getEventTimes();
    return [
      { key: 'IGN',   label: '① 点火（固定·随音频倒计时）',                      t: T_IGN,   fixed: true },
      { key: 'LIFT',  label: '② 解锁离塔（起飞，默认由推力决定）',                 t: evT('LIFT', T_IGN + 3.05) },
      { key: 'TURN',  label: '③ 程序转弯',                                      t: evT('TURN', T_IGN + PITCH_T0) },
      { key: 'ESC',   label: '④ 逃逸塔分离',                                    t: ev.ESC },
      { key: 'BOOST', label: '⑤ 助推器分离',                                    t: ev.BOOST },
      { key: 'CORE',  label: '⑥ 一二级分离 + 二级点火',                          t: ev.CORE },
      { key: 'FAIR',  label: '⑦ 整流罩分离',                                    t: ev.FAIR },
      { key: 'VERN',  label: '⑧ 二级主机关机 → 游机',                             t: evT('VERN', ev.CORE + (ev.UPPER - ev.CORE) * 0.72 + VERN_DELAY) },
      { key: 'SECO',  label: '⑨ 游机关机',                                      t: evT('SECO', ev.UPPER - 0.3) },
      { key: 'UPPER', label: '⑩ 船箭分离',                                      t: ev.UPPER },
      { key: 'SOLAR', label: '⑪ 太阳帆板展开',                                   t: ev.SOLAR },
    ];
  }

  // ---- 事件对齐接口（面板「以当前时刻对齐」）----
  // 用户在听到某句旁白的瞬间点击即可把该事件的触发时刻钉在当下；持久化，刷新不丢
  const ALIGN_KEYS = {
    IGN: '点火', LIFT: '解锁离塔', TURN: '程序转弯', ESC: '逃逸塔分离', BOOST: '助推器分离',
    CORE: '一二级分离', FAIR: '整流罩分离', VERN: '主机转游机', SECO: '游机关机',
    UPPER: '船箭分离', SOLAR: '帆板展开',
  };
  function getEventTimes() {
    return { ESC: evT('ESC', T_ESC), BOOST: evT('BOOST', T_BOOST), FAIR: evT('FAIR', T_FAIR), CORE: evT('CORE', T_CORE), UPPER: evT('UPPER', T_UPPER), SOLAR: evT('SOLAR', T_SOLAR) };
  }
  function setEventTime(key, time) {
    if (!ALIGN_KEYS[key] || !(time >= 0)) return false;
    if (key === 'IGN') return false;            // 点火固定随音频倒计时，不可偏移
    alignTimes[key] = Math.round(time * 100) / 100;
    saveAlign();
    reset();
    return true;
  }
  function clearEventAlign() { for (const k in alignTimes) delete alignTimes[k]; saveAlign(); reset(); }

  return {
    start, play, pause, replay, exit, update, getHud, seek,
    toggleSolar, solarState: () => solarCur,
    isActive: () => active,
    getPhy, setPhyParams, getPhyParams,
    getEventTimes, setEventTime, clearEventAlign, ALIGN_KEYS, getEventList, getAlignOptions,
    particleStats,
  };
}
