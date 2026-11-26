import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildShip, setSolarDeploy } from './spacecraft.js';
import { PARTS, flatten, schematicFor, LAUNCH_PHASES, LAUNCH_TL } from './data.js';
import { createAudio } from './audio.js';
// 注意：launch.js（发射 rig，56KB + 数百网格/多张画布贴图）与 earth.js（fbm 贴图 ~600ms）
// 改为按需动态 import，移出首屏关键路径。

// ---- 首屏性能打点（供 ?debug=1 面板与 DevTools Performance 面板核对）----
const PERF = { t0: performance.now(), marks: {} };
function mark(name) { PERF.marks[name] = performance.now() - PERF.t0; }

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;            // 仅发射阶段开启（展示阶段无投影物，省一次通道）
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070d);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(9, 3.6, 14);

// 环境反射（PBR 金属质感的关键）
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// 灯光：主光（暖）+ 轮廓光（冷）+ 补光 + 舱内冷白光（还原真实舱内照明的柔和白光）
const hemi = new THREE.HemisphereLight(0x9fb4d8, 0x05070d, 0.55);
scene.add(hemi);
const key = new THREE.DirectionalLight(0xfff1dc, 2.6); key.position.set(-7, 9, 7); scene.add(key);
// 主光阴影相机：覆盖发射台与箭体低空段
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -45; key.shadow.camera.right = 45;
key.shadow.camera.top = 45; key.shadow.camera.bottom = -45;
key.shadow.camera.near = 1; key.shadow.camera.far = 100;
key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
const rim = new THREE.DirectionalLight(0x88aaff, 1.3); rim.position.set(9, -1, -7); scene.add(rim);
const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(0, 3, -9); scene.add(fill);
// 舱内冷白照明（随返回舱一起定位，模拟头顶白光灯组）
const cabinLight = new THREE.PointLight(0xe8f2ff, 1.4, 8, 2);
cabinLight.position.set(0, 2.6, 0);
scene.add(cabinLight);

// 星空背景（跟随相机：发射上升段相机远离原点时星空仍然环绕）
const starPts = (function starfield() {
  const N = 1400, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 120 + Math.random() * 200;
    const t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(p) * Math.cos(t);
    pos[i * 3 + 1] = r * Math.cos(p);
    pos[i * 3 + 2] = r * Math.sin(p) * Math.sin(t);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color: 0xbfd0ff, size: 0.6, sizeAttenuation: true, transparent: true, opacity: 0.85 });
  const pts = new THREE.Points(g, m);
  scene.add(pts);
  return pts;
})();

// 写实在轨地球（地表/海洋/云层/大气）：fbm 贴图生成约 600ms，
// 改为首帧之后再按需动态 import + 构建，移出首屏关键路径
let earth = null;

// 飞船
const { root, groups, shellMats } = buildShip();
// 拆解视图展示【入轨展开态】：两翼绕纵向转轴横展 90°，形成横向一字布局（p=1）
setSolarDeploy(groups, 1);
scene.add(root);
mark('ship-built');
const clock = new THREE.Clock();

// 后期：电影级辉光
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// UnrealBloom(strength, radius, threshold)：radius 决定光晕扩散范围，
// 用户反馈"箭体周围光晕太大"→ 收紧扩散半径 0.5→0.22、强度 0.38→0.26（阈值不变，仍只让高亮处发光）
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.26, 0.22, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---- 自适应分辨率：帧率过低时逐级降采样保流畅，空闲时回升 ----
// 首帧从 1.0 起步（高 DPI 屏上更快出画面），随后由自适应逻辑爬升到上限
const RES_MAX = Math.min(window.devicePixelRatio, 2);
let resScale = 1, fpsAvg = 60, resCooldown = 0;
function applyResolution() {
  renderer.setPixelRatio(resScale);
  composer.setPixelRatio(resScale);
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}
applyResolution();

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 1.6;   // 允许贴近观察小部件（如仪表盘）
controls.maxDistance = 60;
controls.target.set(0, 3, 0);
controls.autoRotateSpeed = 0.8;

// ---- 音频：首次用户手势解锁（浏览器自动播放策略）----
const audio = createAudio();
let audioReady = false;

// 构建版本：显示在 ?debug=1 面板并打到控制台，便于确认"当前跑的是哪一版"
const BUILD = 'v9-long-flight-54s';
console.log('[app] 构建版本', BUILD);

// ---- 真实音频资源（?v= 用于绕开 /assets 的 immutable 强缓存）----
// ② 发射完整音频（旁白+配乐+点火轰鸣+各级分离音效，212.4s）：整条时间线以它为主时钟，
//    动画事件时刻（LAUNCH_TL）与其内部旁白/音效对应；暂停/重置/静音由既有 clip 机制联动。
const CLIP_MAIN_URL = './assets/launch-narration.mp3?v=1';
// ② 分离语音播报并入完整音频（MP3 内含旁白），不再单独播小clip；数组保留为空以兼容既有逻辑
const VOICE_CUES = [];
let clipsPreloaded = false;
function preloadClips() {
  if (clipsPreloaded) return;
  clipsPreloaded = true;
  audio.loadLaunchClip(CLIP_MAIN_URL);
  for (const c of VOICE_CUES) audio.loadCue(c.name, c.url);
}
// 借用户手势同步"预热/解锁"音频：把自动播放授权一次性拿到手，
// 之后即使场景构建耗时数秒、再改 currentTime / 音量也不会被浏览器拦掉
function armClips() {
  preloadClips();
  audio.armLaunchClip();
  audio.armCues();
}
// 起播前把发射音频等到就绪：否则 t=0 时数据还没到，起播会滞后于画面（倒数人声对不上）
// 超时就照常开始，由合成提示音 / 轰鸣兜底，绝不因为音频问题卡住演示
async function prepareLaunchAudio() {
  if (!audio.hasLaunchClip()) {
    console.warn('[launch] 发射音频不可用（未加载/被拒播），改用合成倒计时提示音与轰鸣');
    return false;
  }
  const ok = await audio.ensureLaunchClipReady(1200);
  if (!ok) console.warn('[launch] 发射音频未在 1.2s 内就绪，将按实际就绪时刻对齐，或回退合成音效');
  return ok;
}

function ensureAudio() {
  if (audioReady) return;
  audioReady = true;
  audio.init();
  audio.ambientStart();   // 在轨环境低鸣
  preloadClips();         // 借首次手势就提前拉取发射音频，避免点「发射演示」时才开始加载
}
window.addEventListener('pointerdown', ensureAudio);

// ---- 选中高亮 ----
let selected = null;
function setHighlight(group, on) {
  group.traverse(o => {
    if (!o.isMesh) return;
    if (on) {
      if (!o.userData._orig) o.userData._orig = o.material;
      const m = o.material.clone();
      m.emissive = new THREE.Color(0x2c6f68);
      m.emissiveIntensity = 0.6;
      o.material = m;
    } else if (o.userData._orig) {
      o.material = o.userData._orig; o.userData._orig = null;
    }
  });
}

// ---- 信息面板 ----
const fm = flatten(PARTS);
const el = {
  crumb: document.getElementById('crumb'),
  name: document.getElementById('partName'),
  desc: document.getElementById('partDesc'),
  schematic: document.getElementById('schematic'),
  principle: document.getElementById('partPrinciple'),
  tags: document.getElementById('partTags'),
};
function showInfo(id) {
  const rec = fm[id];
  const node = rec ? rec.node : { label: '神舟二十三号载人飞船', desc: el.desc.dataset.def || '', principle: '', tags: [] };
  const defDesc = '由轨道舱、返回舱、推进舱组成的三舱式飞船，采用返回舱居中的构型。点击下方任意部件或层级树中的条目，查看其结构、工作原理与功能机制。';
  el.crumb.textContent = rec ? (rec.parents.map(p => fm[p].node.label).join(' / ') || '整体视图') : '整体视图';
  el.name.textContent = node.label;
  el.desc.textContent = node.desc || defDesc;
  el.schematic.innerHTML = schematicFor(id);
  el.principle.textContent = node.principle || '';
  el.tags.innerHTML = (node.tags || []).map(t => `<span>${t}</span>`).join('');
}

// ---- 选择部件 ----
function selectPart(id, opts = {}) {
  if (selected && selected !== id) {
    const g = groups.get(selected); if (g) setHighlight(g, false);
  }
  selected = id;
  const g = groups.get(id);
  if (g) setHighlight(g, true);
  showInfo(id);
  for (const n of treeNodes) n.classList.toggle('active', n.dataset.id === id);
  if (opts.focus && g) focusOn(g);
  if (opts.pin && g) {
    g.userData.pinned = !g.userData.pinned;
    if (g.userData.pinned) audio.pop((g.userData.radius || 0.6) / 1.5);  // 拆解弹出音效
  }
  if (hoverId === id) showTooltip(id);   // 选中状态变化时刷新提示文案
}

// ---- 相机聚焦缓动 ----
let focusing = false;
const camDesired = new THREE.Vector3(), tgtDesired = new THREE.Vector3();
function focusOn(group) {
  group.getWorldPosition(_wp);
  tgtDesired.copy(_wp);
  const dir = camera.position.clone().sub(controls.target).normalize();
  // 按部件自身尺寸取景：小件近距离放大、大件保持全景（配合收紧的 minDistance 才能真"放大查看"）
  const r = group.userData.radius || 1.2;
  const dist = Math.max(2.2, Math.min(10, r * 3.6));
  camDesired.copy(_wp).add(dir.multiplyScalar(dist));
  focusing = true;
}

// ---- 射线拾取（点击部件） ----
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let down = null;
canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', e => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  down = null;
  if (moved > 6) return; // 拖拽不算点击
  const r = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObjects(root.children, true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.partId) o = o.parent;
    if (o && o.userData.partId && o.userData.partId !== 'ship') {
      selectPart(o.userData.partId, { focus: true, pin: true });
      return;
    }
  }
  // 点空白处不取消选择，方便继续查看
});

// ---- 悬停反馈：明确标示「哪些部件可点击」----
// 指针移动后只做一次射线检测（不是每帧），命中则指针变手型、底部提示栏显示部件名
const readout = document.getElementById('readout');
const tooltipEl = document.getElementById('tooltip');
const audioNote = document.getElementById('audioNote');
let noteShown = false;
const READOUT_DEFAULT = '拖拽旋转 · 滚轮缩放 · 点击部件查看详情';
const pointer = { x: -1e9, y: -1e9 };
let hoverDirty = false, hoverId = null;

// 显示/隐藏跟随鼠标的部件名称提示（tooltip）
function showTooltip(id) {
  if (!id) { tooltipEl.classList.remove('show'); return; }
  const rec = fm[id];
  if (!rec) { tooltipEl.classList.remove('show'); return; }
  const name = document.createElement('span');
  name.className = 'tt-name';
  name.textContent = rec.node.label;
  const hint = document.createElement('span');
  hint.className = 'tt-hint' + (selected === id ? ' on' : '');
  hint.textContent = selected === id ? '已选中 · 点击收回' : '点击查看详情';
  tooltipEl.replaceChildren(name, hint);
  tooltipEl.classList.add('show');
}

// tooltip 跟随鼠标：定位用 transform，淡入淡出用 opacity（互不干扰）
function placeTooltip() {
  if (!tooltipEl.classList.contains('show') || pointer.x < -1e8) return;
  const pad = 14;
  const r = tooltipEl.getBoundingClientRect();
  let x = pointer.x + pad, y = pointer.y + pad;
  if (x + r.width > window.innerWidth - 8) x = pointer.x - r.width - pad;
  if (y + r.height > window.innerHeight - 8) y = pointer.y - r.height - pad;
  tooltipEl.style.transform = 'translate(' + Math.max(8, x) + 'px,' + Math.max(8, y) + 'px)';
}

canvas.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; hoverDirty = true; });
canvas.addEventListener('pointerleave', () => { pointer.x = pointer.y = -1e9; hoverDirty = true; });

// ---- 层级树 ----
function buildTree(parts, container) {
  const ul = document.createElement('ul');
  for (const n of parts) {
    const li = document.createElement('li');
    const node = document.createElement('div');
    node.className = 'node'; node.dataset.id = n.id;
    node.innerHTML = `<span class="swatch"></span><span>${n.label}</span>` +
      (n.children ? `<span class="cnt">${n.children.length}</span>` : '');
    node.addEventListener('click', () => selectPart(n.id, { focus: true, pin: true }));
    li.appendChild(node);
    if (n.children) li.appendChild(buildTree(n.children, li));
    container.appendChild(li);
  }
  return ul;
}
const tree = document.getElementById('tree');
tree.appendChild(buildTree(PARTS, tree));
const treeNodes = Array.from(document.querySelectorAll('.tree .node'));  // 缓存：选中态切换不再每帧查询

// ---- 部件包围球预计算（防穿模碰撞松弛用）----
// 关键：只统计"属于该部件自身"的网格，不含子孙部件，否则父件半径会被子件撑大导致松弛失效
const _sphere = new THREE.Sphere();
const _wpTmp = new THREE.Vector3();
groups.forEach(g => {
  const id = g.userData.partId;
  if (id === 'ship') return;
  const box = new THREE.Box3();
  let has = false;
  g.traverse(o => {
    if (o.isMesh && o.userData.partId === id) { box.expandByObject(o); has = true; }
  });
  const r = has ? box.getBoundingSphere(_sphere).radius : 0.4;
  g.userData.radius = Math.max(r, 0.3) + 0.05;   // 额外留 5cm 间隙，保证部件边界清晰、不贴面
  // 记录几何中心相对组原点的偏移：部件几何常偏离原点（如降落伞舱在 +2.1、发动机在 -2.8），
  // 若以组原点当球心做碰撞检测会严重错位（球心错 → 重叠判不出来）
  if (has) {
    g.getWorldPosition(_wpTmp);
    g.userData.centerOff = box.getCenter(new THREE.Vector3()).sub(_wpTmp);
  } else {
    g.userData.centerOff = new THREE.Vector3();
  }
});
const INTERIOR_IDS = ['seats', 'console', 'instrument'];
const activeParts = [];
const _wa = new THREE.Vector3(), _wb = new THREE.Vector3();
function isAncestor(p, c) { let o = c; while (o) { if (o === p) return true; o = o.parent; } return false; }

// ---- 外壳透明度（舱内视图 或 内饰部件弹出时自动透视，消除穿壳视觉）----
let interiorOn = false, hullFadeLast = -1;
function applyHullFade(v) {
  if (v === hullFadeLast) return;   // 仅在变化时更新材质，避免每帧开销
  hullFadeLast = v;
  shellMats.forEach(m => {
    m.transparent = v < 1;
    m.opacity = v;
    m.depthWrite = v >= 1;
    m.needsUpdate = true;
  });
}

// ---- 控制条 ----
const explodeSlider = document.getElementById('explode');
let globalExplode = 0;
explodeSlider.addEventListener('input', () => { globalExplode = parseFloat(explodeSlider.value); });

document.getElementById('btnExpand').addEventListener('click', () => {
  ensureAudio(); audio.whoosh();
  globalExplode = 1; explodeSlider.value = 1;
  groups.forEach(g => { if (g.userData.partId !== 'ship') g.userData.pinned = true; });
});
document.getElementById('btnReset').addEventListener('click', () => {
  ensureAudio(); audio.tick();
  globalExplode = 0; explodeSlider.value = 0;
  groups.forEach(g => { if (g.userData.partId !== 'ship') g.userData.pinned = false; });
  showInfo('ship');
  if (selected && groups.get(selected)) setHighlight(groups.get(selected), false);
  selected = null;
  for (const n of treeNodes) n.classList.remove('active');
  // 复位悬停与提示栏，保证「展开 → 复位」后状态干净
  hoverId = null; canvas.style.cursor = 'default'; readout.textContent = READOUT_DEFAULT;
  tooltipEl.classList.remove('show');
  interiorOn = false; btnInterior.classList.remove('on');
  applyHullFade(1);
});
const btnRotate = document.getElementById('btnRotate');
btnRotate.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  btnRotate.classList.toggle('on', controls.autoRotate);
});
document.getElementById('btnView').addEventListener('click', () => {
  tgtDesired.set(0, 3, 0);
  camDesired.set(9, 3.6, 14);
  focusing = true;
});

// ---- 舱内视图开关（材质透明度由主循环 applyHullFade 统一驱动）----
const btnInterior = document.getElementById('btnInterior');
btnInterior.addEventListener('click', () => {
  ensureAudio(); audio.whoosh();
  interiorOn = !interiorOn;
  btnInterior.classList.toggle('on', interiorOn);
  if (interiorOn) { showInfo('seats'); selectPart('seats', {}); }
});

// ---- 发射演示（按需构建：首次需要时才动态 import + 构建 rig，移出首屏关键路径）----
let launch = null;
let launchPromise = null;            // 共享 promise：并发触发/后台预构建复用同一构建过程，互不打架
const launchHud = document.getElementById('launchHud');
const stepEls = Array.from(launchHud.querySelectorAll('.step'));   // 缓存 HUD 步骤元素

// 构建期轻量加载层（首屏 #loading 已移除，这里临时浮现以避免"点击后卡死无反馈"）
const buildSpin = document.createElement('div');
buildSpin.id = 'buildSpin';
buildSpin.innerHTML = '<div class="ring"></div><p>正在构建发射场景…</p>';
document.body.appendChild(buildSpin);
let spinShown = false;
function showBuildSpin() { if (!spinShown) { spinShown = true; buildSpin.classList.add('show'); } }
function hideBuildSpin() { if (spinShown) { spinShown = false; buildSpin.classList.remove('show'); } }

async function ensureLaunch() {
  if (launch) return launch;
  if (launchPromise) return launchPromise;
  launchPromise = (async () => {
    preloadClips();   // 音频一并延后加载（首屏不拉取），并在此处兜底确保已发起请求
    const mod = await import('./launch.js');
    launch = mod.createLaunch(scene, camera, {
      audio: {
        chime: () => audio.chime(), solarServo: d => audio.solarServo(d),
        // 音频主时钟：人声在播时以其播放头驱动场景时间（低帧率下音画不脱节）
        masterTime: () => { const c = audio.clipTime(); return c >= 0 ? c : null; },
      },
    });
    mark('launch-built');
    if (window.__launchDebug && window.__launchDebug.setAudioProbe) {
      window.__launchDebug.setAudioProbe(() => audio.clipStatus());
    }
    if (window.__wbScene) { window.__wbScene.launch = launch; window.__wbScene.audio = audio; }   // CDP 诊断：可控起停运镜/音效计数
    return launch;
  })();
  return launchPromise;
}

// 取发射 rig：已建好则瞬时返回；否则先浮现加载层，等构建完成再淡出（避免点击后无反馈的卡顿感）
async function getLaunch() {
  if (launch) return launch;
  showBuildSpin();
  // 先让出一帧，确保 spinner 真正绘出（否则后续 ~1.2s 同步构建会阻塞主线程、spinner 来不及渲染）
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  try { return await ensureLaunch(); }
  finally { hideBuildSpin(); }
}

document.getElementById('btnLaunch').addEventListener('click', async () => {
  ensureAudio(); audio.whoosh(); audio.ambientDuck(0.012);
  armClips();                       // 关键：在手势的同步阶段就预热起播（音量 0），锁定自动播放授权
  const L = await getLaunch();
  if (!L) return;
  await prepareLaunchAudio();       // 音频就绪后再开始，保证倒数人声从 t=0 对齐
  audio.launchClipStart(0);         // 起点对齐：预热播放头若已领先 ≥1s 则拉回 0（主时钟要求两者同源）
  launchHud.classList.remove('hidden');
  setChromeVisible(false);          // 视觉聚焦：仅保留发射核心视图
  enterNightLighting();             // 夜间发射照明
  root.visible = false;
  controls.enabled = false;
  // 这里只复位"已起播"标记，不用 stopAudioFlags：否则会把刚预热的元素 pause 掉，
  // 后续 play() 就落到用户手势之外，可能被浏览器拦掉（倒数人声就没了）
  lastCd = null; prevT = 0; resetAudioFlags(0);
  L.start();
});
document.getElementById('btnExit').addEventListener('click', () => {
  audio.rumbleStop(); audio.ambientDuck(0.05); audio.whoosh();
  stopAudioFlags(0);
  if (launch) launch.exit();
  updatePhyPanel();                 // 退出后刷新一次读数（状态归零/关机）
  launchHud.classList.add('hidden');
  hud.cd.classList.add('hidden'); hud.cd.textContent = ''; hud.cd.classList.remove('go', 'faded');
  setChromeVisible(true);           // 恢复正常面板
  exitNightLighting();              // 恢复日间照明
  root.visible = true;
  controls.enabled = true;
  controls.target.set(0, 3, 0);
  camera.position.set(9, 3.6, 14);
  focusing = false;
});
const btnPlay = document.getElementById('btnPlay');
btnPlay.addEventListener('click', async () => {
  ensureAudio();
  armClips();                       // 同样是手势内预热，避免"首次从播放键进入"时人声缺失
  const L = await getLaunch();
  if (!L) return;
  if (!L.isActive()) {
    await prepareLaunchAudio();     // 音频就绪后再开始
    L.start(); audio.ambientDuck(0.012);
    setChromeVisible(false); enterNightLighting(); root.visible = false;
    lastCd = null; prevT = 0; resetAudioFlags(0);
  } else {
    const wasPlaying = L.getHud().playing;
    if (wasPlaying) L.pause(); else L.play();
    // 音频跟画面一起停/起（恢复时 launch-ascent 会按 h.t 偏移续播，状态播报重新播报）
    stopAudioFlags();
  }
});
document.getElementById('btnReplay').addEventListener('click', async () => {
  ensureAudio();
  const L = await getLaunch();
  if (!L) return;
  lastCd = null; prevT = 0; stopAudioFlags(0);
  L.replay();
});
for (const s of stepEls) {
  s.addEventListener('click', async () => {
    ensureAudio();
    const ph = LAUNCH_PHASES.find(p => String(p.id) === s.dataset.phase);
    if (!ph) return;
    const L = await getLaunch();
    if (!L) return;
    lastCd = null; prevT = ph.tStart; stopAudioFlags(ph.tStart);
    L.seek(ph.tStart);   // 跳转到该阶段起点并播放
    audio.ambientDuck(0.012);
  });
}

// ---- 太阳翼展开 / 收拢（双向切换，阻尼平滑）----
const btnSolar = document.getElementById('btnSolar');
btnSolar.addEventListener('click', () => {
  ensureAudio();
  if (!launch) return;                      // rig 尚未构建
  const target = launch.toggleSolar();
  btnSolar.textContent = target > 0.5 ? '帆板 收拢' : '帆板 展开';
});

// ---- 发射事件音标记（正常播放时跨越时间点触发；seek/跳转经 prevT 复位天然不触发）----
// ② 事件时刻与 LAUNCH_TL 时间线对齐；MP3 在播时其内含真实分离音效，合成音只在 MP3
//    不可用（加载失败/被拦）时兜底，避免与音频里的真实音效叠成双响。
// fired 旗标防重复：音频主时钟抖动或帧卡顿时 t 可能在标记点附近来回，只允许触发一次
const SOUND_MARKS = [
  { t: LAUNCH_TL.T_IGN,   name: 'ignition', fired: false },  // 点火（10 秒倒计时结束）
  { t: LAUNCH_TL.T_BOOST, name: 'sepBang',  fired: false },  // 助推器分离
  { t: LAUNCH_TL.T_ESC,   name: 'sepBang',  fired: false },  // 逃逸塔抛离
  { t: LAUNCH_TL.T_FAIR,  name: 'sepBang',  fired: false },  // 整流罩抛离
  { t: LAUNCH_TL.T_CORE,  name: 'sepBang',  fired: false },  // 芯一级/芯二级分离
  { t: LAUNCH_TL.T_UPPER, name: 'sepBang',  fired: false },  // 芯二级与飞船分离
];
let prevT = 0, rumbleOn = false, lastCd = null, clipStarted = false;
let clipRetryAt = 0, audioWarned = false;
// 只复位"已起播"标记，不停音频：进入发射时用这个，避免把已预热起播的元素 pause 掉
// t0：从该时刻进入（跳转到阶段时，早于 t0 的播报应视为已过去，不再补播）
function resetAudioFlags(t0) {
  clipStarted = false; clipRetryAt = 0; audioWarned = false;
  noteShown = false;
  if (audioNote) audioNote.classList.add('hidden');
  for (const c of VOICE_CUES) c.done = (t0 || 0) > c.t + 1;
  for (const m of SOUND_MARKS) m.fired = (t0 || 0) > m.t + 1;
}
// 停止全部真实音频并复位播放标记（重播/跳转/退出时统一调用）
function stopAudioFlags(t0) {
  audio.launchClipStop(); audio.cueStopAll();
  resetAudioFlags(t0);
}

// ---- 发射 HUD 刷新（返回 hud 数据供音频层使用）----
const hud = {
  tag: document.getElementById('phaseTag'),
  name: document.getElementById('phaseName'),
  clock: document.getElementById('clock'),
  cd: document.getElementById('countdownBig'),
};
function updateLaunchHud() {
  if (!launch) return null;                 // rig 尚未按需构建
  const h = launch.getHud();
  hud.tag.textContent = '阶段 ' + h.phaseId;
  hud.name.textContent = h.phaseName + ' · ' + h.status;   // 时钟由右侧 #clock 独立显示（tabular-nums，避免数字跳动挤占文字）
  hud.clock.textContent = h.clock;   // 修正：独立时钟此前从未更新，一直卡在初始的 T- 00:10（图文不同步的元凶）
  for (const s of stepEls) s.classList.toggle('active', String(h.phaseId) === s.dataset.phase);
  btnPlay.textContent = h.playing ? '暂停' : '播放';
  // 大号倒计时 + 逐秒提示音（音调随临近点火递增）
  // 点火字样仅瞬显（点火后约 1.0s 起淡出，1.8s 后彻底移除）
  const cdEl = hud.cd;
  if (h.cd !== null && h.cd !== undefined) {
    cdEl.textContent = String(h.cd);
    cdEl.classList.remove('hidden', 'faded', 'go');
    if (h.cd <= 3) cdEl.classList.add('go');
    // 真实人声倒数在播时，合成提示音压到 30% 避免两层数字打架；
    // 音频不可用（未就绪 / 被拒播）时提示音恢复满音量，保证倒数始终有声
    if (h.cd !== lastCd) { audio.countdownBeep(h.cd, audio.clipPlaying() ? 0.3 : 1); lastCd = h.cd; }
  } else if (h.t < 10 + 1.8) {
    lastCd = null;
    cdEl.textContent = '点火';
    cdEl.classList.remove('hidden');
    cdEl.classList.add('go');
    if (h.t > 10 + 1.0) cdEl.classList.add('faded'); else cdEl.classList.remove('faded');
  } else {
    cdEl.classList.add('hidden');
    cdEl.classList.remove('go', 'faded');
    cdEl.textContent = '';
  }
  return h;
}

// ---- 静音开关（工具栏与发射 HUD 各一个，状态同步）----
const soundBtns = Array.from(document.querySelectorAll('.sound-toggle'));
for (const b of soundBtns) {
  b.addEventListener('click', () => {
    ensureAudio();
    const m = !audio.isMuted();
    audio.setMuted(m);
    for (const sb of soundBtns) sb.textContent = m ? '声音 关' : '声音 开';
  });
}

// ---- 真实发射音频改由 ensureLaunch() 按需加载（首屏不再拉取 470KB）----

// === 点火动力学面板（深色科技风；纯原生实现，不引入任何第三方库）===
// 实时显示：推力 kN / 加速度 m/s² / 高度 / 推重比 / 锁止状态；
// 顶部参数（推重比、推力爬升时间、起飞质量、燃料消耗比例）可实时调整，
// 调整后自动从头重演一遍点火过程（先锁死 → 推力爬过重力 → 解锁起飞）。
const phyPanel = (() => {
  const d = document.createElement('div');
  d.id = 'phyPanel';
  d.innerHTML =
    '<div class="phy-readouts">' +
      '<span class="phy-title">点火动力学</span>' +
      '<span>推力 <b id="phyThrust">0</b> kN</span>' +
      '<span>加速度 <b id="phyAcc">0.00</b> m/s²</span>' +
      '<span>高度 <b id="phyAlt">0 m</b></span>' +
      '<span>推重比 <b id="phyTwr">0.00</b></span>' +
      '<span>状态 <b id="phyLock" class="phy-lock">锁死</b></span>' +
      '<button id="phyToggle" type="button" title="收起 / 展开面板">▾</button>' +
    '</div>' +
    '<div class="phy-event" id="phyEvent">待点火</div>' +
    '<div class="phy-params">' +
      '<label>推重比<input id="phyPTwr" type="number" step="0.05" min="1" max="3" value="1.30" /></label>' +
      '<label>推力爬升<input id="phyPRamp" type="number" step="0.5" min="0.5" max="10" value="4.4" />s</label>' +
      '<label>起飞质量<input id="phyPM0" type="number" step="10000" min="50000" value="460000" />kg</label>' +
      '<label>燃料消耗<input id="phyPBurn" type="number" step="0.05" min="0.2" max="0.95" value="0.80" /></label>' +
      '<button id="phyIgnite" type="button">点火</button>' +
      '<button id="phyReset" type="button">重置</button>' +
    '</div>' +
    '<div class="phy-align">' +
      '<span>事件对齐</span>' +
      '<select id="phyAlignSel" title="选择要校准的动作（全部 11 个真实动作）"></select>' +
      '<button id="phyAlignSet" type="button">以当前时刻对齐</button>' +
      '<button id="phyAlignBack" type="button">−2s</button>' +
      '<button id="phyAlignFwd" type="button">+2s</button>' +
      '<button id="phyAlignClear" type="button">清除</button>' +
      '<span class="phy-hint" id="phyAlignTip">选好动作后，听到该句旁白时点「对齐」，或用 −2s/+2s 微调</span>' +
    '</div>' +
    '<div class="phy-ver" id="phyVer">时序版本：加载中…</div>';
  document.body.appendChild(d);
  return d;
})();
const phyOut = {
  thrust: document.getElementById('phyThrust'),
  acc: document.getElementById('phyAcc'),
  alt: document.getElementById('phyAlt'),
  twr: document.getElementById('phyTwr'),
  lock: document.getElementById('phyLock'),
};
function fmtPhyAlt(m) { return m < 10000 ? Math.round(m) + ' m' : (m / 1000).toFixed(1) + ' km'; }
// 事件字幕：显示"下一事件 + 倒计时"与"✔ 已执行"高亮，便于逐句对照音频旁白核对同步
const EV_NAMES = { ESC: '逃逸塔分离', BOOST: '助推器分离', CORE: '一二级分离', FAIR: '整流罩分离', UPPER: '船箭分离', SOLAR: '帆板展开' };
function updateEventCaption() {
  const el = document.getElementById('phyEvent');
  if (!el || !launch || !launch.getEventTimes) return;
  const times = launch.getEventTimes();
  // 时序版本核对行：显示当前代码实际使用的各事件时刻（便于确认页面是否已加载最新代码）
  const ver = document.getElementById('phyVer');
  if (ver) {
    ver.textContent = '时序版本 build9：逃逸塔 ' + times.ESC.toFixed(1) + 's ｜ 助推器 ' + times.BOOST.toFixed(1) +
      's ｜ 一二级分离 ' + times.CORE.toFixed(1) + 's ｜ 整流罩 ' + times.FAIR.toFixed(1) +
      's ｜ 船箭 ' + times.UPPER.toFixed(1) + 's ｜ 帆板 ' + times.SOLAR.toFixed(1) + 's';
  }
  const t = launch.getHud().t;
  // 全事件表（真实动作对照）：11 个动作 = 点火/解锁离塔/程序转弯/逃逸塔/助推器/一二级/整流罩/
  // 主机转游机/游机关机/船箭分离/帆板展开，字幕逐条给出「演示时刻 ｜ 真实 T+」，便于校对
  const list = (launch.getEventList ? launch.getEventList() : null);
  if (list && list.length) {
    let f2 = null, n2 = null;
    for (const e of list) {
      if (e.demo <= t && t - e.demo < 2.6 && (!f2 || e.demo > f2.demo)) f2 = e;
      if (e.demo > t && (!n2 || e.demo < n2.demo)) n2 = e;
    }
    if (f2) {
      el.textContent = '✔ ' + f2.name + '（已执行）　真实 T+' + f2.realT;
      el.className = 'phy-event fired';
    } else if (n2) {
      const cd = n2.demo - t;
      el.textContent = cd <= 3.5
        ? '⏱ ' + n2.name + '  ' + cd.toFixed(1) + 's　真实 T+' + n2.realT
        : '下一事件：' + n2.name + '（演示 ' + n2.demo.toFixed(1) + 's ｜ 真实 T+' + n2.realT + '）';
      el.className = 'phy-event' + (cd <= 3.5 ? ' soon' : '');
    } else {
      el.textContent = '全流程已执行完毕（共 ' + list.length + ' 个动作）';
      el.className = 'phy-event';
    }
    return;
  }
  let fired = null, next = null;
  for (const k in EV_NAMES) {
    const v = times[k];
    if (v <= t && t - v < 2.6 && (!fired || v > times[fired])) fired = k;
    if (v > t && (!next || v < times[next])) next = k;
  }
  if (fired) { el.textContent = '✔ ' + EV_NAMES[fired] + '（已执行）'; el.className = 'phy-event fired'; }
  else if (next) {
    const cd = times[next] - t;
    el.textContent = cd <= 3.5 ? '⏱ ' + EV_NAMES[next] + '  ' + cd.toFixed(1) + 's' : '下一事件：' + EV_NAMES[next] + '（' + times[next].toFixed(1) + 's）';
    el.className = 'phy-event' + (cd <= 3.5 ? ' soon' : '');
  } else { el.textContent = '全流程已执行完毕'; el.className = 'phy-event'; }
}
function updatePhyPanel() {
  if (!launch || !launch.getPhy) return;
  updateEventCaption();               // 事件字幕（下一事件倒计时 / 已执行提示）
  const p = launch.getPhy();
  phyOut.thrust.textContent = Math.round(p.thrustKN);
  phyOut.acc.textContent = p.acc.toFixed(2);
  phyOut.alt.textContent = fmtPhyAlt(p.altReal);
  phyOut.twr.textContent = p.twr.toFixed(2);
  if (!p.active) { phyOut.lock.textContent = '关机'; phyOut.lock.classList.remove('unlocked'); }
  else if (p.locked) { phyOut.lock.textContent = '锁死'; phyOut.lock.classList.remove('unlocked'); }
  else { phyOut.lock.textContent = '已解锁'; phyOut.lock.classList.add('unlocked'); }
}
// 点火：未进入发射 → 走「发射演示」；已在发射 → 从头重演
document.getElementById('phyIgnite').addEventListener('click', () => {
  const id = (launch && launch.isActive()) ? 'btnReplay' : 'btnLaunch';
  document.getElementById(id).click();
});
// 重置：复用既有重置流（部件复位 + 音频从头）
document.getElementById('phyReset').addEventListener('click', () => {
  document.getElementById('btnReplay').click();
});
// 事件对齐：听到某句旁白的瞬间点「对齐」→ 把该事件锚定在当前时刻（持久化），并从头重演校验
function phyToast(msg) {
  const tip = document.getElementById('phyAlignTip');
  if (!tip) return;
  tip.textContent = msg;
  tip.style.color = '#6ef0a8';
  clearTimeout(phyToast._t);
  phyToast._t = setTimeout(() => {
    tip.textContent = '听到该句旁白时点「对齐」，或用 −2s/+2s 边看边微调';
    tip.style.color = '';
  }, 4000);
}
async function alignApply(key, time) {
  const L = await getLaunch();
  if (!L || !L.setEventTime) return null;
  const wasActive = L.isActive();
  L.setEventTime(key, time);
  const times = L.getEventTimes();
  if (wasActive) { lastCd = null; prevT = 0; stopAudioFlags(0); L.replay(); audio.ambientDuck(0.012); }
  refreshAlignOptions();
  return times[key];
}
document.getElementById('phyAlignSet').addEventListener('click', async () => {
  const sel = document.getElementById('phyAlignSel');
  const L = await getLaunch();
  if (!L) return;
  const v = await alignApply(sel.value, L.getHud().t);
  if (v != null) phyToast('已把「' + sel.options[sel.selectedIndex].text + '」对齐到 t=' + v.toFixed(2) + 's');
});
// ±2s 微调：边看边调，无需重来
for (const [id, d] of [['phyAlignBack', -2], ['phyAlignFwd', 2]]) {
  document.getElementById(id).addEventListener('click', async () => {
    const sel = document.getElementById('phyAlignSel');
    const L = await getLaunch();
    if (!L || !L.getEventTimes) return;
    const cur = L.getEventTimes()[sel.value];
    const v = await alignApply(sel.value, Math.max(0, cur + d));
    if (v != null) phyToast('「' + sel.options[sel.selectedIndex].text + '」→ t=' + v.toFixed(2) + 's');
  });
}
document.getElementById('phyAlignClear').addEventListener('click', async () => {
  const L = await getLaunch();
  if (L && L.clearEventAlign) { L.clearEventAlign(); phyToast('已清除全部事件对齐，恢复默认时刻'); updateEventCaption(); }
});
// 收起 / 展开：面板默认贴在左下角（不遮挡火箭），点 ▾ 可缩成只留读数与事件字幕
document.getElementById('phyToggle').addEventListener('click', (e) => {
  const p = document.getElementById('phyPanel');
  const mini = p.classList.toggle('mini');
  e.currentTarget.textContent = mini ? '▸' : '▾';
});
// 小窗口自动收起：避免左下角面板与左侧居中的发射 HUD 叠压（视口高度 < 780px 时）
function autoMiniByHeight() {
  const p = document.getElementById('phyPanel');
  const btn = document.getElementById('phyToggle');
  if (!p || !btn) return;
  if (window.innerHeight < 780) { p.classList.add('mini'); btn.textContent = '▸'; }
}
autoMiniByHeight();
window.addEventListener('resize', autoMiniByHeight);
// 定时刷新「时序版本」行 + 「事件对齐」下拉（两者都随实际时刻变化）
setInterval(() => {
  if (!launch) { getLaunch().then(() => { updateEventCaption(); refreshAlignOptions(); }).catch(() => {}); return; }
  const ver = document.getElementById('phyVer');
  if (ver && ver.textContent.indexOf('加载中') >= 0) updateEventCaption();
  refreshAlignOptions();
}, 1200);
// 「事件对齐」下拉：从发射模块动态取全部事件（11 个真实动作 + 各自当前演示时刻）
async function refreshAlignOptions() {
  const sel = document.getElementById('phyAlignSel');
  if (!sel) return;
  const L = await getLaunch();
  if (!L || !L.getAlignOptions) return;
  const opts = L.getAlignOptions();
  const sig = opts.map(o => o.key + ':' + o.t.toFixed(1)).join('|');
  if (sel.dataset.sig === sig) return;         // 无变化则不动，避免打断用户的选择
  const keep = sel.value;
  sel.innerHTML = opts.map(o =>
    '<option value="' + o.key + '"' + (o.fixed ? ' disabled' : '') + '>' +
    o.label + '　·　' + o.t.toFixed(1) + 's</option>'
  ).join('');
  if (keep && opts.some(o => o.key === keep)) sel.value = keep;
  sel.dataset.sig = sig;
}
// 参数调整：写回物理模型；若正在发射则从头重演，保证推力/锁台/时序一致
for (const [id, key] of [['phyPTwr', 'twr'], ['phyPRamp', 'ramp'], ['phyPM0', 'm0'], ['phyPBurn', 'burnFrac']]) {
  document.getElementById(id).addEventListener('change', async () => {
    const L = await getLaunch();
    if (!L || !L.setPhyParams) return;
    const p = {}; p[key] = parseFloat(document.getElementById(id).value);
    if (L.isActive()) {
      lastCd = null; prevT = 0; stopAudioFlags(0);
      L.setPhyParams(p); L.replay(); audio.ambientDuck(0.012);
    } else {
      L.setPhyParams(p);
    }
  });
}

// ---- 发射流程视觉聚焦：隐藏侧边面板与信息组件，退出后恢复 ----
const chromeEls = ['sidebar', 'info', 'toolbar', 'readout']
  .map(id => document.getElementById(id))
  .filter(Boolean);
function setChromeVisible(v) {
  for (const e of chromeEls) e.classList.toggle('launch-hidden', !v);
}

// ---- 夜间发射照明（实拍为夜间发射：下调环境光，让尾焰成为主光源；退出恢复）----
let nightSaved = null;
function enterNightLighting() {
  if (nightSaved) return;
  nightSaved = { key: key.intensity, rim: rim.intensity, fill: fill.intensity, hemi: hemi.intensity, keyColor: key.color.getHex() };
  // 夜间发射：环境压得很低（冷月色），照明主要靠塔架/场坪泛光灯与尾焰本身--
  // 既贴近真实夜射观感，也让加色混合的火焰在高对比背景上清晰可见
  key.intensity = 0.28; key.color.setHex(0xa8c0e8);   // 冷月光
  rim.intensity = 0.15;
  fill.intensity = 0.06;
  hemi.intensity = 0.05;
  renderer.shadowMap.enabled = true;   // 阴影通道仅发射阶段需要（拆解场景无投影物）
}
function exitNightLighting() {
  if (!nightSaved) return;
  key.intensity = nightSaved.key; key.color.setHex(nightSaved.keyColor);
  rim.intensity = nightSaved.rim;
  fill.intensity = nightSaved.fill;
  hemi.intensity = nightSaved.hemi;
  renderer.shadowMap.enabled = false;  // 关闭阴影通道，降低展示阶段的开销
  nightSaved = null;
}

// ---- 主循环（热路径零分配：所有临时向量均为模块级复用）----
const _wp = new THREE.Vector3();
let frameCount = 0, ctxLost = false;
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  // 页面不可见时跳过全部工作（省 CPU/GPU，切回标签页不产生抖动）
  if (document.hidden) return;
  // WebGL 上下文丢失期间跳过渲染（自动恢复由 listener 处理）
  if (ctxLost) return;

  // 自适应分辨率
  fpsAvg += (1 / Math.max(dt, 1e-4) - fpsAvg) * 0.04;
  resCooldown -= dt;
  if (resCooldown <= 0) {
    if (fpsAvg < 45 && resScale > 1) { resScale = Math.max(1, resScale - 0.25); applyResolution(); resCooldown = 2; }
    else if (fpsAvg > 57 && resScale < RES_MAX) { resScale = Math.min(RES_MAX, resScale + 0.25); applyResolution(); resCooldown = 3; }
  }

  if (earth) earth.update(dt);   // 地球自转 + 云层流转（按需构建后才存在）

  if (launch && launch.isActive()) {
    starPts.position.y = camera.position.y; // 星空环绕相机（高空仍在各方向可见）
    launch.update(dt);
    updatePhyPanel();                       // 顶部动力学面板读数（推力/加速度/高度/推重比/锁止）
    const h = updateLaunchHud();
    if (h) {
    // 音频事件：跨越时间点触发 + 音量随高度自然衰减（音画同步）
    if (!clipsPreloaded) preloadClips();   // 保险：预载若被跳过（某些策略下 requestIdleCallback 不跑），进入发射时立即补
    const useClip = audio.hasLaunchClip();
    if (h.playing && !useClip) {
      // ② MP3 不可用时的合成音效兜底：跨越时间点触发（防连响由 prevT 复位 + fired 旗标保证）
      for (const m of SOUND_MARKS) {
        if (!m.fired && prevT < m.t && h.t >= m.t) {
          m.fired = true;
          if (m.name === 'ignition') audio.ignitionPower();   // 次低频震动 + 爆裂
          else audio.sepBang();                               // 分离爆响（助推器/逃逸塔/整流罩/级间/船箭）
        }
      }
    }
    prevT = h.t;
    // ② 完整发射音频 launch-narration.mp3（212.4s）：旁白+配乐+点火轰鸣+各级分离音效。
    // 文件起点即场景 t=0；主时钟 = 播放头（launch.js masterClock 以 clipTime 驱动场景时间），
    // 事件时刻（LAUNCH_TL）与音频内旁白对应；动画播完(MAX_T)音频自然收尾。
    const CLIP_LEAD = 0;               // 文件起点即场景 t=0
    const CLIP_STOP = LAUNCH_TL.MAX_T + 2;   // 覆盖整个动画时长（音频自然播完即止）
    const inClipWindow = h.t >= CLIP_LEAD && h.t < CLIP_STOP;
    if (inClipWindow && useClip) {
      // 起播 + 看门狗：未就绪时 launchClipStart 返回 false；若"已起播"却并未真正出声
      // （被自动播放策略拦掉 / 被打断 / 缓冲卡住），每 0.5s 重试一次，直到真正出声。
      // 这是"只听到提示音、没有人声"这类问题的兜底。
      if (!audio.clipPlaying() && !audio.launchClipEnded() && h.t >= clipRetryAt) {
        clipRetryAt = h.t + 0.5;
        if (audio.launchClipStart(Math.max(0, h.t - CLIP_LEAD))) {
          if (!clipStarted) console.log('[launch] 播放 launch-narration.mp3，起点偏移 ' + Math.max(0, h.t - CLIP_LEAD).toFixed(2) + 's');
          clipStarted = true;
        } else if (!audioWarned && h.t > 3) {
          audioWarned = true;
          console.warn('[launch] 发射音频尚未起播（可能仍在缓冲/被拦），将持续重试，期间用合成提示音兜底');
        }
      }
      // ② 完整音频自带混音（旁白+配乐+轰鸣），音量恒定即可，不再随场景高度衰减
      audio.launchClipLevel(0.95);
    } else if (clipStarted) {
      audio.launchClipStop(); clipStarted = false;
    }
    // 人声确实起不来时给出可见说明，避免"只有音效"却不知原因（暂停时不算）
    const voiceDead = h.playing && h.t > 3.5 && h.t < 10 && !audio.clipPlaying();
    if (voiceDead !== noteShown) {
      noteShown = voiceDead;
      audioNote.classList.toggle('hidden', !voiceDead);
    }
    // 发射后语音播报：每段分离口令都在各自的事件时刻触发，跟随新的时间线
    if (h.playing) {
      for (const c of VOICE_CUES) {
        if (c.done || h.t < c.t || h.t > c.t + 6) continue;
        if (audio.cueStart(c.name, 0.92)) {
          c.done = true;
          console.log('[launch] 语音播报：' + c.label + '（t=' + c.t + 's）');
        }
      }
    }
    // 兜底：真实音频未在播放（未加载完 / 被自动播放策略拒播 / 解码失败）时，
    // 自动启用合成轰鸣，保证任何环境下都有发射音效（时间窗与动力飞行段一致）
    const wantRumble = !audio.clipPlaying() && h.t >= LAUNCH_TL.T_IGN && h.t < LAUNCH_TL.T_UPPER;
    if (wantRumble && !rumbleOn) { audio.rumbleStart(); rumbleOn = true; }
    if (!wantRumble && rumbleOn) { audio.rumbleStop(); rumbleOn = false; }
    if (wantRumble) audio.rumbleLevel(0.6 * Math.max(0.18, Math.min(1, 1 - (h.alt || 0) / 6000)));
    }   // end if (h)

    frameCount++;
    if (perfEl && (frameCount & 15) === 0) updatePerfOverlay();   // 发射阶段同样刷新面板
    composer.render();
    return;
  }
  starPts.position.y = 0;

  // 拆解位移（全局滑块 与 单独钉住 取最大；dt 指数化插值保证帧率无关的平滑）
  const kMove = 1 - Math.exp(-dt * 8);
  groups.forEach(g => {
    if (g.userData.partId === 'ship') return;
    const amt = Math.max(globalExplode, g.userData.pinned ? 1 : 0);
    const tx = g.userData.home.x + g.userData.offset.x * amt;
    const ty = g.userData.home.y + g.userData.offset.y * amt;
    const tz = g.userData.home.z + g.userData.offset.z * amt;
    g.position.x += (tx - g.position.x) * kMove;
    g.position.y += (ty - g.position.y) * kMove;
    g.position.z += (tz - g.position.z) * kMove;
  });

  // ---- 分离防穿模：活跃件 vs 全体部件（含静止件）做包围球检测 ----
  // 规则：① 父子/祖孙可重叠（外壳已淡出，是内饰件的必经出口）；
  //       ② 两个都活跃 → 沿连线对称推开；③ 对方静止 → 静止件不动，活跃件全额让开。
  // 这样"只点开一个部件"时也不会穿过任何静止部件（例如仪表盘穿过降落伞舱）。
  activeParts.length = 0;
  groups.forEach(g => {
    if (g.userData.partId === 'ship') return;
    if (Math.max(globalExplode, g.userData.pinned ? 1 : 0) > 0.05) activeParts.push(g);
  });
  if (activeParts.length) {
    for (let iter = 0; iter < 6; iter++) {     // 6 次迭代：把重叠彻底推开（Gauss-Seidel 投影）
      let movedAny = false;
      for (const a of activeParts) {
        a.getWorldPosition(_wa); _wa.add(a.userData.centerOff);   // 用几何中心而非组原点
        // 渐入系数：部件刚动身时不猛推（避免弹跳），离开原位后才全力防穿模
        const alpha = Math.min(1, a.position.distanceTo(a.userData.home) / 0.5);
        for (const b of groups.values()) {
          if (b === a) continue;
          if (b.userData.partId === 'ship') continue;
          if (isAncestor(a, b) || isAncestor(b, a)) continue;
          b.getWorldPosition(_wb); _wb.add(b.userData.centerOff);
          const minD = a.userData.radius + b.userData.radius;
          const dx = _wb.x - _wa.x, dy = _wb.y - _wa.y, dz = _wb.z - _wa.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= minD * minD || d2 < 1e-6) continue;
          const d = Math.sqrt(d2);
          const nx = dx / d, ny = dy / d, nz = dz / d;
          const bActive = Math.max(globalExplode, b.userData.pinned ? 1 : 0) > 0.05;
          const push = (minD - d) * (bActive ? 0.5 : 1.0) * alpha;   // 静止件不动 → 活跃件全额让开
          a.position.x -= nx * push; a.position.y -= ny * push; a.position.z -= nz * push;
          _wa.x -= nx * push; _wa.y -= ny * push; _wa.z -= nz * push;
          if (bActive) {
            b.position.x += nx * push; b.position.y += ny * push; b.position.z += nz * push;
          }
          movedAny = true;
        }
      }
      if (!movedAny) break;      // 本轮回无重叠 → 提前结束
    }
  }

  // 舱内透视：手动开关 或 内饰部件弹出时自动触发（外壳淡出后穿壳路径不可见）
  let interiorOut = false;
  for (const id of INTERIOR_IDS) {
    const g = groups.get(id);
    if (g && (g.userData.pinned || globalExplode > 0.02)) { interiorOut = true; break; }
  }
  applyHullFade((interiorOn || interiorOut) ? 0.16 : 1);

  // 舱内灯光跟随返回舱（保证舱内透视时照明正确）
  const reentryG = groups.get('reentry');
  if (reentryG) {
    reentryG.getWorldPosition(_wp);
    cabinLight.position.set(_wp.x, _wp.y + 1.1, _wp.z);
  }
  if (focusing) {
    const kCam = 1 - Math.exp(-dt * 5.5);
    camera.position.lerp(camDesired, kCam);
    controls.target.lerp(tgtDesired, kCam);
    if (camera.position.distanceTo(camDesired) < 0.15) focusing = false;
  }
  // 悬停拾取：仅当指针移动过才检测，命中部件则变手型并提示名称
  if (hoverDirty) {
    hoverDirty = false;
    let id = null;
    if (pointer.x > -1e8) {
      const r = canvas.getBoundingClientRect();
      ndc.x = ((pointer.x - r.left) / r.width) * 2 - 1;
      ndc.y = -((pointer.y - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(root.children, true);
      for (const h of hits) {
        let o = h.object;
        while (o && !o.userData.partId) o = o.parent;
        if (o && o.userData.partId && o.userData.partId !== 'ship') { id = o.userData.partId; break; }
      }
    }
    if (id !== hoverId) {
      hoverId = id;
      canvas.style.cursor = id ? 'pointer' : 'default';
      const rec = id ? fm[id] : null;
      readout.textContent = rec ? ('点击查看：' + rec.node.label) : READOUT_DEFAULT;
      showTooltip(id);
    }
    placeTooltip();   // 每帧跟随鼠标（仅 tooltip 可见时）
  }
  controls.update();
  composer.render();
  frameCount++;
  if (perfEl && (frameCount & 15) === 0) updatePerfOverlay();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  applyResolution();
});

// ---- 稳定性：WebGL 上下文丢失/恢复 + 页面可见性 ----
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  ctxLost = true;
  const p = buildSpin.querySelector('p'); if (p) p.textContent = '图形上下文已丢失，正在等待恢复…';
  showBuildSpin();
}, false);
canvas.addEventListener('webglcontextrestored', () => {
  ctxLost = false;
  const p = buildSpin.querySelector('p'); if (p) p.textContent = '正在构建发射场景…';
  hideBuildSpin();
}, false);

// ---- 性能面板（?debug=1 开启，或按 P 键切换）：用于验证加载耗时与渲染稳定性 ----
const perfEl = (() => {
  if (!/[?&]debug=1/.test(location.search)) return null;
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;right:10px;top:10px;z-index:99;font:11px/1.5 monospace;' +
    'background:rgba(0,0,0,.62);color:#9fe;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:8px 10px;white-space:pre';
  document.body.appendChild(d);
  return d;
})();
function updatePerfOverlay() {
  if (!perfEl) return;
  const info = renderer.info;
  const m = PERF.marks;
  const cs = audio.clipStatus();
  const clipLine = cs.ready
    ? ('已载入 ' + (cs.t || 0).toFixed(1) + 's / ' + (cs.dur || 0).toFixed(1) + 's'
       + ' 音量' + (cs.vol || 0).toFixed(2) + ' 静音' + (cs.muted ? '是' : '否')
       + ' 预热' + (cs.armed ? '已' : '未')
       + (cs.playing ? '  正在播放' : (cs.err ? '  ' + cs.err : '  待机'))
       + (cs.armErr ? '  预热被拒:' + cs.armErr : ''))
    : (clipsPreloaded ? '加载中…（尚未就绪）' : '未开始加载');
  const cueList = audio.cueStatus();
  const cueLine = cueList.length
    ? cueList.map(function (c) {
        return c.name + (c.failed ? '(失败)'
          : (c.playing ? '(播报中)'
          : (c.t > 0.05 ? '(已播)' : (c.ready ? '(就绪)' : '(载入中)'))));
      }).join(' ')
    : '无';
  perfEl.textContent =
    BUILD + '   FPS ' + fpsAvg.toFixed(0) + '   分辨率倍率 ' + resScale.toFixed(2) + '\n' +
    'draw calls ' + info.render.calls + '   三角面 ' + (info.render.triangles / 1000).toFixed(0) + 'k\n' +
    '几何 ' + info.memory.geometries + '   贴图 ' + info.memory.textures + '\n' +
    '音频 launch-ascent.mp3: ' + clipLine + '\n' +
    '语音播报 sep1/2/3: ' + cueLine + '\n' +
    '粒子 烟雾/火星: ' + (launch && launch.particleStats
      ? (function () { const p = launch.particleStats(); return p.sAlive + '/' + p.sTotal + '  ' + p.eAlive + '/' + p.eTotal; })()
      : '-') + '\n' +
    '--- 启动耗时(ms) ---\n' +
    '飞船构建 ' + (m['ship-built'] || 0).toFixed(0) + '\n' +
    '首帧 ' + (m['first-frame'] || 0).toFixed(0) + '\n' +
    '地球(延后) ' + (m['earth-built'] ? m['earth-built'].toFixed(0) : '未构建') + '\n' +
    '发射rig(按需) ' + (m['launch-built'] ? m['launch-built'].toFixed(0) : '未构建') + '\n' +
    '上下文 ' + (ctxLost ? '丢失' : '正常');
}

// ---- 预编译着色器：把编译开销放在加载层内，避免遮罩消失后卡一下 ----
renderer.compile(scene, camera);
mark('shaders-compiled');

// 诊断句柄（?debug=1 时暴露场景/相机，供 CDP 截图核查建模细节）
if (/[?&]debug=1/.test(location.search)) {
  window.__wbScene = { scene, camera, controls, renderer };
  window.__PERF = PERF;   // 首屏各阶段耗时（ms），供加载性能诊断
}

showInfo('ship');
animate();

// 首帧渲染后：隐藏加载层，并在空闲时构建「在轨地球」（fbm 贴图约 600ms，不阻塞首屏）
requestAnimationFrame(() => {
  mark('first-frame');
  window.__APP_READY = true;      // 告诉 index.html 的看门狗：初始化成功，别再报"加载超时"
  const ld = document.getElementById('loading');
  if (ld) { ld.classList.add('hide'); setTimeout(() => ld.remove(), 700); }
  const buildEarthAsync = async () => {
    if (earth) return;
    try {
      const mod = await import('./earth.js');
      earth = mod.buildEarth();
      scene.add(earth.group);
      mark('earth-built');
    } catch (e) { /* 地球为装饰，失败不影响主体功能 */ }
  };
  if ('requestIdleCallback' in window) requestIdleCallback(buildEarthAsync, { timeout: 2500 });
  else setTimeout(buildEarthAsync, 500);

  // 同一时机把发射 rig 也在后台预构建：rig 构建约 1.2s（含 778 网格 + 多张画布贴图），
  // 放在空闲时段悄悄跑完，用户点「发射演示」时大多已就绪 → 点击即播，不再卡 1 秒。
  // 若用户抢在预构建完成前点击，getLaunch() 会先浮出加载层等构建结束，仍有反馈。
  const prebuildLaunch = () => { ensureLaunch(); };
  if ('requestIdleCallback' in window) requestIdleCallback(prebuildLaunch, { timeout: 4000 });
  else setTimeout(prebuildLaunch, 1500);

  // 同一时机把两段发射音频也预载好：音频只有"播放"需要用户手势，"加载"不需要。
  // 提前载好可以彻底避免"点发射时才现拉、导致起播晚/失败"这类问题。
  const preloadAsync = () => preloadClips();
  if ('requestIdleCallback' in window) requestIdleCallback(preloadAsync, { timeout: 3000 });
  else setTimeout(preloadAsync, 900);
});

// 按 P 切换性能面板（无 ?debug=1 时也可临时查看）
window.addEventListener('keydown', (e) => {
  if (e.key === 'p' || e.key === 'P') {
    if (!perfEl) location.search = location.search ? location.search + '&debug=1' : '?debug=1';
  }
});
