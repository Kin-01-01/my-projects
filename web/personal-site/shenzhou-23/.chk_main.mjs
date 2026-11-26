import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildShip } from './spacecraft.js';
import { PARTS, flatten, schematicFor, LAUNCH_PHASES } from './data.js';
import { createLaunch } from './launch.js';
import { buildEarth } from './earth.js';
import { createAudio } from './audio.js';

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;             // 阴影：发射场景的箭体投影
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070d);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(9, 3.6, 14);

// 环境反射（PBR 金属质感的关键）
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// 灯光：主光（暖）+ 轮廓光（冷）+ 补光 + 舱内冷白光（还原真实舱内照明的柔和白光）
scene.add(new THREE.HemisphereLight(0x9fb4d8, 0x05070d, 0.55));
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

// 写实在轨地球（地表/海洋/云层/大气），位于飞船下方呈现曲率视界
const earth = buildEarth();
scene.add(earth.group);

// 飞船
const { root, groups, shellMats } = buildShip();
scene.add(root);
const clock = new THREE.Clock();

// 后期：电影级辉光
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.38, 0.5, 0.85);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---- 自适应分辨率：帧率过低时逐级降采样保流畅，空闲时回升 ----
const RES_MAX = Math.min(window.devicePixelRatio, 2);
let resScale = RES_MAX, fpsAvg = 60, resCooldown = 0;
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
controls.minDistance = 5;
controls.maxDistance = 60;
controls.target.set(0, 3, 0);
controls.autoRotateSpeed = 0.8;

// ---- 音频：首次用户手势解锁（浏览器自动播放策略）----
const audio = createAudio();
let audioReady = false;
function ensureAudio() {
  if (audioReady) return;
  audioReady = true;
  audio.init();
  audio.ambientStart();   // 在轨环境低鸣
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
}

// ---- 相机聚焦缓动 ----
let focusing = false;
const camDesired = new THREE.Vector3(), tgtDesired = new THREE.Vector3();
function focusOn(group) {
  group.getWorldPosition(_wp);
  tgtDesired.copy(_wp);
  const dir = camera.position.clone().sub(controls.target).normalize();
  const dist = 7.5;
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
const _box = new THREE.Box3(), _sphere = new THREE.Sphere();
groups.forEach(g => {
  if (g.userData.partId === 'ship') return;
  _box.setFromObject(g);
  _box.getBoundingSphere(_sphere);
  g.userData.radius = Math.max(_sphere.radius, 0.3);
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

// ---- 发射演示 ----
const launch = createLaunch(scene, camera, {
  audio: { chime: () => audio.chime(), solarServo: d => audio.solarServo(d) },
});
const launchHud = document.getElementById('launchHud');
const stepEls = Array.from(launchHud.querySelectorAll('.step'));   // 缓存 HUD 步骤元素
document.getElementById('btnLaunch').addEventListener('click', () => {
  ensureAudio(); audio.whoosh(); audio.ambientDuck(0.012);
  launchHud.classList.remove('hidden');
  setChromeVisible(false);          // 视觉聚焦：仅保留发射核心视图
  root.visible = false;
  controls.enabled = false;
  lastCd = null; prevT = 0; clipStarted = false;
  launch.start();
});
document.getElementById('btnExit').addEventListener('click', () => {
  audio.rumbleStop(); audio.launchClipStop(); audio.ambientDuck(0.05); audio.whoosh();
  clipStarted = false;
  launch.exit();
  launchHud.classList.add('hidden');
  hud.cd.classList.add('hidden'); hud.cd.textContent = ''; hud.cd.classList.remove('go', 'faded');
  setChromeVisible(true);           // 恢复正常面板
  root.visible = true;
  controls.enabled = true;
  controls.target.set(0, 3, 0);
  camera.position.set(9, 3.6, 14);
  focusing = false;
});
const btnPlay = document.getElementById('btnPlay');
btnPlay.addEventListener('click', () => {
  ensureAudio();
  if (!launch.isActive()) { launch.start(); audio.ambientDuck(0.012); }
  if (launch.getHud().playing) launch.pause(); else launch.play();
});
document.getElementById('btnReplay').addEventListener('click', () => {
  ensureAudio(); lastCd = null; prevT = 0; launch.replay();
});
for (const s of stepEls) {
  s.addEventListener('click', () => {
    ensureAudio();
    const ph = LAUNCH_PHASES.find(p => String(p.id) === s.dataset.phase);
    if (!ph) return;
    lastCd = null; prevT = ph.tStart;
    launch.seek(ph.tStart);   // 跳转到该阶段起点并播放
    audio.ambientDuck(0.012);
  });
}

// ---- 太阳翼展开 / 收拢（双向切换，阻尼平滑）----
const btnSolar = document.getElementById('btnSolar');
btnSolar.addEventListener('click', () => {
  ensureAudio();
  const target = launch.toggleSolar();
  btnSolar.textContent = target > 0.5 ? '帆板 收拢' : '帆板 展开';
});

// ---- 发射事件音标记（正常播放时跨越时间点触发；seek 不触发以防连响）----
const SOUND_MARKS = [
  [10, 'ignition'],   // 点火（10 秒倒计时结束）
  [21, 'clack'],      // 助推器分离
  [24, 'clack'],      // 芯一级分离
  [26, 'chime'],      // 整流罩张开
  [32, 'clack'],      // 上级分离
];
let prevT = 0, rumbleOn = false, lastCd = null, clipStarted = false;

// ---- 发射 HUD 刷新（返回 hud 数据供音频层使用）----
const hud = {
  tag: document.getElementById('phaseTag'),
  name: document.getElementById('phaseName'),
  clock: document.getElementById('clock'),
  cd: document.getElementById('countdownBig'),
};
function updateLaunchHud() {
  const h = launch.getHud();
  hud.tag.textContent = '阶段 ' + h.phaseId;
  hud.name.textContent = h.phaseName + ' · ' + h.status + ' · ' + h.clock;
  for (const s of stepEls) s.classList.toggle('active', String(h.phaseId) === s.dataset.phase);
  btnPlay.textContent = h.playing ? '暂停' : '播放';
  // 大号倒计时 + 逐秒提示音（音调随临近点火递增）
  // 点火字样仅瞬显（点火后约 1.0s 起淡出，1.8s 后彻底移除）
  const cdEl = hud.cd;
  if (h.cd !== null && h.cd !== undefined) {
    cdEl.textContent = String(h.cd);
    cdEl.classList.remove('hidden', 'faded', 'go');
    if (h.cd <= 3) cdEl.classList.add('go');
    if (h.cd !== lastCd) { audio.countdownBeep(h.cd); lastCd = h.cd; }
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

// ---- 真实发射音频（自参考视频提取的点火→升空段）----
audio.loadLaunchClip('./assets/audio/launch-ascent.mp3');

// ---- 发射流程视觉聚焦：隐藏侧边面板与信息组件，退出后恢复 ----
const chromeEls = ['sidebar', 'info', 'toolbar', 'readout']
  .map(id => document.getElementById(id))
  .filter(Boolean);
function setChromeVisible(v) {
  for (const e of chromeEls) e.classList.toggle('launch-hidden', !v);
}

// ---- 主循环（热路径零分配：所有临时向量均为模块级复用）----
const _wp = new THREE.Vector3();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  // 自适应分辨率
  fpsAvg += (1 / Math.max(dt, 1e-4) - fpsAvg) * 0.04;
  resCooldown -= dt;
  if (resCooldown <= 0) {
    if (fpsAvg < 45 && resScale > 1) { resScale = Math.max(1, resScale - 0.25); applyResolution(); resCooldown = 2; }
    else if (fpsAvg > 57 && resScale < RES_MAX) { resScale = Math.min(RES_MAX, resScale + 0.25); applyResolution(); resCooldown = 3; }
  }

  earth.update(dt);   // 地球自转 + 云层流转

  if (launch.isActive()) {
    starPts.position.y = camera.position.y; // 星空环绕相机（高空仍在各方向可见）
    launch.update(dt);
    const h = updateLaunchHud();

    // 音频事件：跨越时间点触发 + 音量随高度自然衰减（音画同步）
    const useClip = audio.hasLaunchClip();
    if (h.playing) {
      for (const [mt, name] of SOUND_MARKS) {
        if (prevT < mt && h.t >= mt && h.t - prevT < 0.5) {
          if (name === 'ignition') {
            audio.ignitionPower();                 // 次低频震动 + 爆裂
            if (useClip) audio.rumbleLevel(0.0001); // 真实音频主导，静音合成持续轰鸣
          }
          else if (name === 'clack') audio.clack();
          else if (name === 'chime') audio.chime();
        }
      }
    }
    prevT = h.t;
    // 发射阶段声音：优先用提取的真实音频（点火→升空），否则回退合成 rumble
    if (h.t >= 10 && h.t < 32) {
      if (useClip) {
        if (!clipStarted) { audio.launchClipStart(Math.max(0, h.t - 10)); clipStarted = true; }
        audio.launchClipLevel(0.9 * Math.max(0.28, Math.min(1, 1 - (h.alt || 0) / 6000)));
      } else {
        if (!rumbleOn) { audio.rumbleStart(); rumbleOn = true; }
        audio.rumbleLevel(0.6 * Math.max(0.18, Math.min(1, 1 - (h.alt || 0) / 6000)));
      }
    } else {
      if (clipStarted) { audio.launchClipStop(); clipStarted = false; }
      if (rumbleOn) { audio.rumbleStop(); rumbleOn = false; }
    }

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

  // ---- 分离防穿模：已分离部件两两包围球检测，重叠则沿连线对称推开 ----
  activeParts.length = 0;
  groups.forEach(g => {
    if (g.userData.partId === 'ship') return;
    if (Math.max(globalExplode, g.userData.pinned ? 1 : 0) > 0.05) activeParts.push(g);
  });
  if (activeParts.length > 1) {
    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < activeParts.length; i++) {
        const a = activeParts[i];
        a.getWorldPosition(_wa);
        for (let j = i + 1; j < activeParts.length; j++) {
          const b = activeParts[j];
          if (isAncestor(a, b) || isAncestor(b, a)) continue;   // 父子嵌套不互推
          b.getWorldPosition(_wb);
          const minD = a.userData.radius + b.userData.radius;
          const dx = _wb.x - _wa.x, dy = _wb.y - _wa.y, dz = _wb.z - _wa.z;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= minD * minD || d2 < 1e-6) continue;
          const d = Math.sqrt(d2);
          const push = (minD - d) * 0.4 * 0.5;
          const nx = dx / d, ny = dy / d, nz = dz / d;
          a.position.x -= nx * push; a.position.y -= ny * push; a.position.z -= nz * push;
          b.position.x += nx * push; b.position.y += ny * push; b.position.z += nz * push;
          _wa.x -= nx * push; _wa.y -= ny * push; _wa.z -= nz * push;
          _wb.x += nx * push; _wb.y += ny * push; _wb.z += nz * push;
        }
      }
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
  controls.update();
  composer.render();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  applyResolution();
});

showInfo('ship');
animate();
// 首帧后隐藏加载层
requestAnimationFrame(() => {
  const ld = document.getElementById('loading');
  if (ld) { ld.classList.add('hide'); setTimeout(() => ld.remove(), 700); }
});
