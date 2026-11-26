// 程序化构建神舟二十三号（在轨构型）写实几何
// 单位：米。飞船轴向为 Y（向上）。返回舱居中，轨道舱在上，推进舱在下。
import * as THREE from 'three';
import { PARTS, flatten } from './data.js';

// 仅为 mesh 打上所属部件 id（供射线拾取定位到正确叶子部件）
function markMeshes(group, id) {
  group.traverse(o => { if (o.isMesh) o.userData.partId = id; });
}
// 为部件组自身登记 id（供拆解位移与层级映射）
function markGroup(group, id) {
  group.userData.partId = id;
}

// 简单可复现伪随机（确定性，逐帧稳定）
function rnd(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

function tex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }

// 太阳能电池阵列（砷化镓：深蓝黑底 + 金褐反光片 + 网格焊线）
function makeSolarTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  const R = rnd(7);
  x.fillStyle = '#0a1524'; x.fillRect(0, 0, 256, 256);
  const cell = 32;
  for (let cy = 0; cy < 256; cy += cell) for (let cx = 0; cx < 256; cx += cell) {
    const shade = 0.82 + R() * 0.36;
    const g = x.createLinearGradient(cx, cy, cx + cell, cy + cell);
    g.addColorStop(0, `rgba(24,42,72,${shade})`); g.addColorStop(0.5, `rgba(48,66,100,${shade})`); g.addColorStop(1, `rgba(20,36,64,${shade})`);
    x.fillStyle = g; x.fillRect(cx + 1, cy + 1, cell - 2, cell - 2);
    // 砷化镓金褐反光
    x.fillStyle = `rgba(150,120,60,${0.06 + R() * 0.10})`;
    x.fillRect(cx + 4, cy + 4, cell - 8, cell - 8);
  }
  // 焊线
  x.strokeStyle = 'rgba(140,170,210,0.55)'; x.lineWidth = 1;
  for (let i = 0; i <= 256; i += cell) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
  // 细微噪点
  for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(255,255,255,${R() * 0.04})`; x.fillRect(R() * 256, R() * 256, 1, 1); }
  const t = tex(c);
  t.repeat.set(2, 2);
  return t;
}

// 金色蜂窝隔热层（返回舱大底/钟形，25mm 蜂窝烧蚀材料）
function makeHoneycombTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d'); const R = rnd(21);
  x.fillStyle = '#c9a23a'; x.fillRect(0, 0, 256, 256);
  const hx = 20, hy = 18;
  for (let row = 0; row < 256 / hy + 1; row++) {
    const off = (row % 2) * hx / 2;
    for (let col = 0; col < 256 / hx + 1; col++) {
      const px = col * hx + off, py = row * hy;
      const g = x.createRadialGradient(px, py, 1, px, py, 9);
      g.addColorStop(0, `rgba(150,116,44,${0.5 + R() * 0.3})`);
      g.addColorStop(0.55, `rgba(216,178,78,${0.35 + R() * 0.25})`);
      g.addColorStop(1, 'rgba(120,90,32,0.9)');
      x.fillStyle = g;
      x.beginPath();
      for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; const vx = px + Math.cos(a) * 8.5, vy = py + Math.sin(a) * 8.5; k === 0 ? x.moveTo(vx, vy) : x.lineTo(vx, vy); }
      x.closePath(); x.fill();
      x.strokeStyle = 'rgba(70,50,16,0.55)'; x.lineWidth = 1; x.stroke();
    }
  }
  const t = tex(c); t.repeat.set(3, 3); return t;
}

// 烧蚀粗糙面（返回舱一侧黑黝黝：炭化蜂窝 + 不规则龟裂）
function makeAblatedTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d'); const R = rnd(33);
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#2a2420'); g.addColorStop(0.5, '#3a3028'); g.addColorStop(1, '#241e1a');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  // 炭化蜂窝凸起
  for (let i = 0; i < 900; i++) {
    const px = R() * 256, py = R() * 256, r = 2 + R() * 6;
    const rg = x.createRadialGradient(px, py, 0, px, py, r);
    rg.addColorStop(0, `rgba(90,70,50,${0.2 + R() * 0.3})`);
    rg.addColorStop(1, 'rgba(20,16,12,0.6)');
    x.fillStyle = rg; x.beginPath(); x.arc(px, py, r, 0, Math.PI * 2); x.fill();
  }
  // 龟裂
  x.strokeStyle = 'rgba(10,8,6,0.5)'; x.lineWidth = 1;
  for (let i = 0; i < 60; i++) { x.beginPath(); let px = R() * 256, py = R() * 256; x.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (R() - 0.5) * 30; py += (R() - 0.5) * 30; x.lineTo(px, py); } x.stroke(); }
  const t = tex(c); t.repeat.set(2, 2); return t;
}

// 金属蒙皮微纹理（白色热控涂层 + 铆钉筋线 + 细微划痕）
function makeHullTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const x = c.getContext('2d'); const R = rnd(55);
  x.fillStyle = '#e2e6ea'; x.fillRect(0, 0, 256, 256);
  // 细微面板缝
  x.strokeStyle = 'rgba(120,128,140,0.25)'; x.lineWidth = 1;
  for (let i = 0; i < 256; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
  // 铆钉
  for (let i = 0; i < 180; i++) { x.fillStyle = `rgba(150,158,170,${0.2 + R() * 0.3})`; x.beginPath(); x.arc(R() * 256, R() * 256, 1.6, 0, Math.PI * 2); x.fill(); }
  // 轻微污渍
  for (let i = 0; i < 50; i++) { x.fillStyle = `rgba(100,110,120,${R() * 0.05})`; x.fillRect(R() * 256, R() * 256, 8 + R() * 20, 4 + R() * 10); }
  const t = tex(c); t.repeat.set(2, 2); return t;
}

// 仪表/屏幕自发光纹理：图形化遥测界面（深空蓝底 + 网格 + 波形 + 状态条 + 姿态球 + 地图轮廓）
function makeScreenTexture(seed) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 160;
  const x = c.getContext('2d');
  const R = rnd(seed * 37 + 1);
  x.fillStyle = '#04121f'; x.fillRect(0, 0, 256, 160);
  // 底色微渐变
  const bg = x.createLinearGradient(0, 0, 256, 160);
  bg.addColorStop(0, '#05131f'); bg.addColorStop(1, '#020b14');
  x.fillStyle = bg; x.fillRect(0, 0, 256, 160);
  // 网格
  x.strokeStyle = 'rgba(60,150,200,0.18)'; x.lineWidth = 1;
  for (let i = 0; i <= 256; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 160); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
  // 顶部标题栏
  x.fillStyle = 'rgba(95,208,255,0.9)'; x.font = 'bold 12px monospace';
  x.fillText('遥测 ' + String(seed | 0).padStart(2, '0') + '  ' + ['姿态','能源','生命保障','导航','热控','通信'][(seed | 0) % 6], 8, 16);
  x.fillStyle = 'rgba(124,255,178,0.85)'; x.fillRect(220, 8, 28, 8);
  // 左侧：姿态球（图形化）
  const cx = 44, cy = 72, cr = 30;
  x.strokeStyle = 'rgba(95,208,255,0.7)'; x.lineWidth = 1.5; x.beginPath(); x.arc(cx, cy, cr, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.ellipse(cx, cy, cr, cr * 0.4, 0, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.ellipse(cx, cy, cr * 0.4, cr, 0, 0, Math.PI * 2); x.stroke();
  x.strokeStyle = 'rgba(255,210,120,0.9)'; x.beginPath(); x.moveTo(cx - cr, cy); x.lineTo(cx + cr, cy); x.stroke();
  // 中间：波形
  x.strokeStyle = '#5fd0ff'; x.lineWidth = 2; x.beginPath();
  for (let i = 0; i <= 180; i += 3) {
    const px = 90 + i;
    const y = 70 + Math.sin(i * 0.07 + seed) * 22 * Math.sin(i * 0.012 + seed) + (R() - 0.5) * 3;
    i === 0 ? x.moveTo(px, y) : x.lineTo(px, y);
  }
  x.stroke();
  // 次级曲线（红）
  x.strokeStyle = 'rgba(255,120,100,0.8)'; x.lineWidth = 1.2; x.beginPath();
  for (let i = 0; i <= 180; i += 3) {
    const px = 90 + i;
    const y = 70 + Math.cos(i * 0.05 + seed * 2) * 14;
    i === 0 ? x.moveTo(px, y) : x.lineTo(px, y);
  }
  x.stroke();
  // 底部：数据条 + 世界地图轮廓示意
  for (let i = 0; i < 6; i++) { x.fillStyle = i % 2 ? 'rgba(124,255,178,0.7)' : 'rgba(95,208,255,0.7)'; x.fillRect(14 + i * 40, 138, 26 * (0.4 + 0.5 * Math.abs(Math.sin(seed + i))), 9); }
  x.strokeStyle = 'rgba(90,180,220,0.35)'; x.lineWidth = 1;
  x.beginPath(); x.moveTo(140, 128); x.lineTo(170, 132); x.lineTo(200, 126); x.lineTo(226, 130); x.stroke(); // 简化地图轮廓
  x.fillStyle = 'rgba(120,200,255,0.5)'; x.font = '9px monospace'; x.fillText('ORBIT 412km', 140, 148);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 飞船舱体蒙皮：白色热控涂层 + 拼板缝 + 铆钉行 + 轻微污渍（提升面片细节精度）
function makeShipHullTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const x = c.getContext('2d');
  const R = rnd(913);
  const g = x.createLinearGradient(0, 0, 0, 1024);
  g.addColorStop(0, '#eef1f4'); g.addColorStop(0.5, '#f5f7f9'); g.addColorStop(1, '#e7ebee');
  x.fillStyle = g; x.fillRect(0, 0, 1024, 1024);
  // 细颗粒
  for (let i = 0; i < 1800; i++) { x.fillStyle = `rgba(120,130,145,${R() * 0.05})`; x.fillRect(R() * 1024, R() * 1024, 1.6, 1.6); }
  // 环向拼板缝
  x.strokeStyle = 'rgba(132,142,154,0.34)'; x.lineWidth = 2;
  for (let j = 1; j < 7; j++) { const y = 1024 / 7 * j; x.beginPath(); x.moveTo(0, y); x.lineTo(1024, y); x.stroke(); }
  // 竖向拼板缝
  x.strokeStyle = 'rgba(150,158,168,0.24)'; x.lineWidth = 1.5;
  for (let i = 1; i < 8; i++) { const px = 1024 / 8 * i; x.beginPath(); x.moveTo(px, 0); x.lineTo(px, 1024); x.stroke(); }
  // 铆钉行（沿环向缝双排 + 高光点）
  for (let j = 1; j < 7; j++) {
    const y = 1024 / 7 * j;
    for (let i = 8; i < 1024; i += 14) {
      for (const dy of [-6, 6]) {
        x.fillStyle = `rgba(120,130,146,${0.32 + R() * 0.22})`;
        x.beginPath(); x.arc(i + (dy > 0 ? 7 : 0), y + dy, 1.8, 0, Math.PI * 2); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.30)';
        x.beginPath(); x.arc(i + (dy > 0 ? 7 : 0) - 0.5, y + dy - 0.5, 0.7, 0, Math.PI * 2); x.fill();
      }
    }
  }
  // 污渍与流挂
  for (let i = 0; i < 24; i++) {
    const px = R() * 1024, py = R() * 1024 * 0.5, len = 1024 * (0.05 + R() * 0.22);
    const lg = x.createLinearGradient(0, py, 0, py + len);
    lg.addColorStop(0, `rgba(150,150,140,${0.04 + R() * 0.05})`); lg.addColorStop(1, 'rgba(150,150,140,0)');
    x.fillStyle = lg; x.fillRect(px, py, 3 + R() * 7, len);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function makeMaterials() {
  const solarTex = makeSolarTexture();
  const honeyTex = makeHoneycombTexture();
  const ablatTex = makeAblatedTexture();
  const hullTex = makeHullTexture();
  const shipHullTex = makeShipHullTexture();
  return {
    hull: new THREE.MeshStandardMaterial({ map: shipHullTex, color: 0xffffff, metalness: 0.3, roughness: 0.5, bumpMap: shipHullTex, bumpScale: 0.015 }),
    shipHull: new THREE.MeshStandardMaterial({ map: shipHullTex, color: 0xffffff, metalness: 0.3, roughness: 0.5, bumpMap: shipHullTex, bumpScale: 0.015 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x1b2836, metalness: 0.55, roughness: 0.12 }),      // 舷窗玻璃
    radiator: new THREE.MeshStandardMaterial({ color: 0x39414b, metalness: 0.6, roughness: 0.42 }),   // 辐射器/散热面
    thruster: new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.85, roughness: 0.35 }),  // 姿控推力器
    gold: new THREE.MeshStandardMaterial({ map: honeyTex, color: 0xffffff, metalness: 0.9, roughness: 0.38 }),
    goldDark: new THREE.MeshStandardMaterial({ map: honeyTex, color: 0xdfd0a0, metalness: 0.9, roughness: 0.5 }),
    ablated: new THREE.MeshStandardMaterial({ map: ablatTex, color: 0xffffff, metalness: 0.15, roughness: 0.85 }),
    service: new THREE.MeshStandardMaterial({ map: shipHullTex, color: 0xb8bec6, metalness: 0.55, roughness: 0.5, bumpMap: shipHullTex, bumpScale: 0.015 }),
    nozzle: new THREE.MeshStandardMaterial({ color: 0x2c2f34, metalness: 0.9, roughness: 0.35 }),
    frame: new THREE.MeshStandardMaterial({ color: 0x3a3f47, metalness: 0.85, roughness: 0.4 }),
    solar: new THREE.MeshStandardMaterial({ map: solarTex, color: 0xffffff, metalness: 0.35, roughness: 0.4 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x40444c, metalness: 0.7, roughness: 0.5 }),
    brass: new THREE.MeshStandardMaterial({ color: 0x8a7350, metalness: 0.9, roughness: 0.4 }),
    seat: new THREE.MeshStandardMaterial({ color: 0x9aa1ab, metalness: 0.5, roughness: 0.55 }),
    light: new THREE.MeshStandardMaterial({ color: 0xd8d2c4, metalness: 0.2, roughness: 0.7 }),
    ring: new THREE.MeshStandardMaterial({ color: 0xb9c2cf, metalness: 0.7, roughness: 0.45 }),
    // 舱内材质区分
    fabric: new THREE.MeshStandardMaterial({ color: 0xb7ad9c, metalness: 0.04, roughness: 0.94 }), // 阻燃浅咖啡织物
    plastic: new THREE.MeshStandardMaterial({ color: 0x23272e, metalness: 0.12, roughness: 0.62 }), // 哑光塑料
    plasticLite: new THREE.MeshStandardMaterial({ color: 0x474d57, metalness: 0.2, roughness: 0.5 }), // 浅塑料面板
    bezel: new THREE.MeshStandardMaterial({ color: 0x15181d, metalness: 0.3, roughness: 0.55 }), // 仪表黑边
    displayA: new THREE.MeshStandardMaterial({ map: makeScreenTexture(1), emissive: 0xffffff, emissiveMap: makeScreenTexture(1), emissiveIntensity: 0.9, roughness: 0.35, metalness: 0 }),
    displayB: new THREE.MeshStandardMaterial({ map: makeScreenTexture(4), emissive: 0xffffff, emissiveMap: makeScreenTexture(4), emissiveIntensity: 0.9, roughness: 0.35, metalness: 0 }),
    displayC: new THREE.MeshStandardMaterial({ map: makeScreenTexture(7), emissive: 0xffffff, emissiveMap: makeScreenTexture(7), emissiveIntensity: 0.9, roughness: 0.35, metalness: 0 }),
  };
}

// 标记外壳网格（供舱内透视时半透明化）
function tagShell(mesh) { mesh.userData.shell = true; return mesh; }

// 铰接式太阳翼：多段帆板链式连接，除首段固定外每段本身即铰链（绕自身原点=关节旋转）
function buildSolarWing(M, { panels = 3, panelW = 1.1, panelH = 2.0 }) {
  const root = new THREE.Group();
  const hinges = [];
  let parent = root;
  for (let i = 0; i < panels; i++) {
    const seg = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(panelW * 0.95, panelH, 0.045), M.solar);
    // 帆板边框（金属细边，增强机械感）
    const frameTop = new THREE.Mesh(new THREE.BoxGeometry(panelW * 0.95, 0.04, 0.07), M.frame);
    frameTop.position.set(panelW / 2, panelH / 2, 0);
    const frameBot = frameTop.clone(); frameBot.position.y = -panelH / 2;
    panel.position.x = panelW / 2;
    seg.add(panel, frameTop, frameBot);
    if (i > 0) { seg.position.x = panelW; hinges.push(seg); }  // 后续段位于上一段末端，即关节
    parent.add(seg);
    parent = seg;
  }
  root.userData.hinges = hinges;   // panels-1 个关节
  return root;
}

// 太阳翼展开/收拢：p=0 完全收拢（贴壁折叠），p=1 完全展开（成一条直线）
// === 帆板动画改动区：参考视频 1:1 复刻（解锁 → 根部旋出 → 逐段手风琴展开 → 锁止）===
// 参考视频动作分解：①短暂解锁停顿 ②根部枢轴带动折叠翼从舱壁向外旋出 90°（此时板组
// 以薄边探出）③板段从根部向末端依次手风琴张开（中间呈锯齿状）④全部拉直成一直线，
// 左右对称，锁止保持。旋转轴心固定在帆板根部，绕根部向外，绝无前后摆动。
export function setSolarDeploy(groups, p) {
  for (const id of ['orbitalSolar', 'serviceSolar']) {
    const g = groups.get(id);
    if (!g) continue;
    // 三阶段节奏（p 为 0→1 归一化展开进度，映射参考视频 10s 流程）
    const UNLOCK_END = 0.10;   // ①解锁段：保持收拢（视频 0~1s 的停顿）
    const SWING_END = 0.34;    // ②根部旋出段：贴壁 ±90° → 水平 0°（视频 1~4s）
    // ③逐段展开段：根→梢错峰，相邻段反向（锯齿），但窗口收紧（stagger 0.055 / 窗宽 0.13），
    //    最末段在 p≈0.65 前即完全张平 —— 之后全程平直锁定，杜绝"展开完成后仍弯曲"的观感
    const SEG_STAGGER = 0.055, SEG_WIN = 0.13;
    // ④锁止段：p>0.65 全部角度保持 0（轻微锁止停顿，形态与真实神舟一致：平直两翼）
    // --- ②根部枢轴：旋转根节点绕【飞船纵向 Y 轴】从 0°（贴侧翼）转到 ±90°（横向伸出）---
    // 左翼与右翼镜像：右侧向右展开、左侧向左展开；推进舱本体保持稳定不参与旋转。
    const sq = Math.max(0, Math.min(1, (p - UNLOCK_END) / (SWING_END - UNLOCK_END)));
    const swing = sq < 0.5 ? 4 * sq * sq * sq : 1 - Math.pow(-2 * sq + 2, 3) / 2;   // easeInOutCubic
    const wings = g.userData.wings || [];
    for (const w of wings) {
      const hinge = w.userData.hinge;
      if (!hinge) continue;
      const side = w.userData.side || 1;
      hinge.rotation.y = -side * (Math.PI / 2) * swing;   // 右(+X): 0→-90°，左(-X): 0→+90°
    }
    // --- ③逐段手风琴展开：从根部向末端错峰，相邻段反向（锯齿中间态），最终共线拉直 ---
    // 【对称同步修正】按"每一侧翼"独立驱动：同一侧内以该翼自己的段序号 i 计算起始时刻与
    // 折叠方向，两侧使用完全相同的 i（同起始时刻、同折叠相位）→ 左右严格镜像同步展开。
    // 旧实现用两侧合并后的扁平 hinge 数组，i%2 与 i*stagger 会跨翼延续，
    // 导致两侧折叠相位相反、后一翼整体晚 1~3 个错峰步（约 0.06~0.17）才展开。
    for (const w of wings) {
      const wh = w.userData.hinges || [];
      for (let i = 0; i < wh.length; i++) {
        const start = SWING_END + i * SEG_STAGGER;       // 第 i 段起始点（越靠末端越晚）
        const q = Math.max(0, Math.min(1, (p - start) / SEG_WIN));
        const eased = q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
        const sign = (i % 2 === 0) ? 1 : -1;             // 相邻段反向折叠成手风琴
        wh[i].rotation.y = sign * Math.PI * (1 - eased);
        // 折叠垫层：收拢时每段沿板厚方向错开 5.5cm（真实"N 形折叠"靠垫层叠放，
        // 总厚度约 0.2~0.3m）。避免相邻板在 180° 折叠时完全共面 → 共面闪烁/穿插，
        // 同时保证展开后错位归零、翼面完全平直。
        wh[i].position.z = 0.055 * (i + 1) * (1 - eased);
      }
    }
  }
}

// ---- 对接机构（轨道舱前端对接环：环体 + 机械锁扣 + 导向片 + 密封面）----
function buildDocking(M) {
  const g = new THREE.Group();
  // 对接环主体：外环 + 内环 + 密封面（双环结构，实拍特征）
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.50, 0.115, 16, 40), M.ring);
  ring.rotation.x = Math.PI / 2;
  const ringIn = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.045, 12, 36), M.frame);
  ringIn.rotation.x = Math.PI / 2; ringIn.position.y = 0.06;
  const seatFace = new THREE.Mesh(new THREE.CylinderGeometry(0.50, 0.50, 0.05, 48, 1, true), M.ring);
  seatFace.position.y = -0.09;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 32), M.ring);
  collar.position.y = -0.28;
  g.add(ring, ringIn, seatFace, collar);
  // 机械锁扣 ×6（对接锁钩：锁体 + 钩舌），沿环周均布
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.12, 0.16), M.frame);
    latch.position.set(Math.cos(a) * 0.50, 0.055, Math.sin(a) * 0.50);
    latch.rotation.y = -a;
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.12), M.brass);
    hook.position.set(Math.cos(a) * 0.46, 0.10, Math.sin(a) * 0.46);
    hook.rotation.y = -a; hook.rotation.x = 0.35;
    g.add(latch, hook);
  }
  // 导向片 ×4（对接时引导对正，实拍中为外翻叶片）
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const petal = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.035), M.goldDark);
    petal.position.set(Math.cos(a) * 0.60, 0.25, Math.sin(a) * 0.60);
    petal.lookAt(0, 0.75, 0);
    g.add(petal);
  }
  markMeshes(g, 'docking'); markGroup(g, 'docking');
  return g;
}

// ---- 轨道舱 + 太阳翼 + 舱门 ----
function buildOrbital(M) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(tagShell(new THREE.CylinderGeometry(1.12, 1.12, 2.8, 72)), M.hull);
  body.position.y = 1.4;
  // 端盖半径略大于筒体（1.12 → 1.132），使其严格包住端部、避免与筒体表面共面闪烁
  const topCap = new THREE.Mesh(tagShell(new THREE.CylinderGeometry(1.132, 1.0, 0.25, 72)), M.hull);
  topCap.position.y = 2.8;
  const botCap = new THREE.Mesh(tagShell(new THREE.CylinderGeometry(1.0, 1.132, 0.25, 72)), M.hull);
  botCap.position.y = 0.0;
  g.add(body, topCap, botCap);
  // 结构细节：扶手 ×2、天线、面板补强片（提升细节精度）
  const railGeo = new THREE.TorusGeometry(0.34, 0.022, 8, 16, Math.PI * 0.7);
  for (const [az, y] of [[0.9, 1.9], [3.6, 1.0]]) {
    const rail = new THREE.Mesh(railGeo, M.frame);
    rail.position.set(Math.cos(az) * 1.12, y, Math.sin(az) * 1.12);
    rail.rotation.set(Math.PI / 2, -az, 0);
    g.add(rail);
  }
  const antOrb = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 1.1, 8), M.frame);
  antOrb.position.set(Math.cos(1.7) * (1.12 + 0.4), 2.35, Math.sin(1.7) * (1.12 + 0.4));
  antOrb.rotation.z = 0.5; g.add(antOrb);
  for (const [az, y] of [[0.4, 0.6], [2.2, 2.2], [4.4, 1.5]]) {
    const patch = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.36, 0.06), M.frame);
    patch.position.set(Math.cos(az) * (1.12 + 0.01), y, Math.sin(az) * (1.12 + 0.01));
    patch.rotation.y = -az;
    g.add(patch);
  }
  // === 舱外设备（对照真实航天器/用户规范补全）===
  // ① 小型通信天线 ×2：鞭状天线 + 圆盘天线（USB/中继通信）
  const whip1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 1.0, 8), M.frame);
  whip1.position.set(Math.cos(2.6) * (1.12 + 0.36), 2.30, Math.sin(2.6) * (1.12 + 0.36));
  whip1.rotation.z = 0.5;
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), M.ring);
  const dishG = new THREE.Group();
  dish.rotation.x = -Math.PI / 2;
  const dishStem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.22, 10), M.frame);
  dishStem.position.y = 0.11;
  dishG.add(dish, dishStem);
  dishG.position.set(Math.cos(5.2) * (1.12 + 0.12), 2.55, Math.sin(5.2) * (1.12 + 0.12));
  dishG.rotation.z = -0.35;
  g.add(whip1, dishG);
  // ② 传感器探头 ×3（外伸细柱，实拍中的太阳/姿态敏感器）
  for (const [az, y] of [[1.1, 2.45], [3.0, 0.85], [4.8, 1.95]]) {
    const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.26, 10), M.dark);
    probe.position.set(Math.cos(az) * (1.12 + 0.10), y, Math.sin(az) * (1.12 + 0.10));
    probe.rotation.set(Math.PI / 2, 0, 0); probe.rotation.y = -az;
    g.add(probe);
  }
  // ③ 舱外管线 ×2（沿舱壁纵向走线 + 卡箍）
  for (const az of [0.9, 3.9]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.2, 10), M.brass);
    pipe.position.set(Math.cos(az) * (1.12 + 0.035), 1.35, Math.sin(az) * (1.12 + 0.035));
    g.add(pipe);
    for (const y of [0.5, 1.35, 2.2]) {
      const clamp = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.014, 6, 14), M.frame);
      clamp.position.set(Math.cos(az) * (1.12 + 0.035), y, Math.sin(az) * (1.12 + 0.035));
      clamp.rotation.x = Math.PI / 2;
      g.add(clamp);
    }
  }
  markMeshes(g, 'orbital'); // 仅给本舱体网格打标（此时尚未加入子部件）

  // 太阳翼（左右，铰接式多段，支持逐段展开/收拢与整体下折贴壁）
  // 帆板收拢态修正（对齐真实神舟）：小的帆板折叠固定在轨道舱两侧舱壁上，
  // 翼根贴近舱体表面（舱半径 1.12），不再是悬空的远端枢轴
  const solar = new THREE.Group();
  const oHinges = [], oWings = [];
  for (const s of [-1, 1]) {
    const sideG = new THREE.Group();
    sideG.position.set(0, 1.4, 0);          // 转轴所在的舱段高度
    // 小帆板转轴根节点：同推进舱构型——轴心在舱壁根部（1.12+0.03），绕飞船纵向 Y 旋转
    const hinge = new THREE.Group();
    hinge.position.set(s * 1.15, 0, 0);
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.50, 0.50), M.frame);
    bracket.position.set(-s * 0.11, 0, 0);
    const driveBox = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.34, 16), M.frame);
    driveBox.rotation.x = Math.PI / 2;      // 轴向 = 飞船纵向
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.5, 14), M.brass);
    axle.rotation.x = Math.PI / 2;
    hinge.add(bracket, driveBox, axle);
    const wing = buildSolarWing(M, { panels: 3, panelW: 1.1, panelH: 2.0 });
    wing.rotation.y = Math.PI / 2;          // 展向 +X → -Z（切向贴壁）、法线朝外
    hinge.add(wing);
    sideG.add(hinge);
    sideG.userData.hinge = hinge;
    sideG.userData.side = s;
    sideG.userData.hinges = wing.userData.hinges;
    sideG.userData.wing = wing;
    oHinges.push(...wing.userData.hinges);
    oWings.push(sideG);
    solar.add(sideG);
  }
  solar.userData.hinges = oHinges;
  solar.userData.wings = oWings;
  markMeshes(solar, 'orbitalSolar'); markGroup(solar, 'orbitalSolar');
  g.add(solar);

  // 舱门与观察窗
  const hatch = new THREE.Group();
  const ht = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.08, 12, 28), M.ring);
  ht.position.set(0, 0.2, 1.126);          // 外移，避免环体中心正好落在筒面上
  const window = new THREE.Mesh(new THREE.CircleGeometry(0.12, 24), M.dark);
  window.position.set(0, 0.9, 1.134);      // 平片整体外移，避免圆心与曲面重合闪烁
  hatch.add(ht, window);
  markMeshes(hatch, 'orbitalHatch'); markGroup(hatch, 'orbitalHatch');
  g.add(hatch);

  markGroup(g, 'orbital');
  return g;
}

// ---- 返回舱（钟形）+ 座椅 + 操控台 + 仪表盘 ----
function buildSeats(M) {
  const g = new THREE.Group();
  const pos = [[-0.42, 1.15, 0.42], [0.42, 1.15, 0.42], [0, 1.15, -0.5]];
  const rot = [0.32, -0.32, 0];
  for (let i = 0; i < 3; i++) {
    const seat = new THREE.Group();
    const [px, py, pz] = pos[i];
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.55), M.frame); // 金属底座
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.16, 0.5), M.fabric); // 织物坐垫
    cushion.position.y = 0.13;
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.14), M.fabric); // 织物靠背
    back.position.set(0, 0.46, -0.2);
    back.rotation.x = -0.28;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.14), M.fabric);
    head.position.set(0, 0.82, -0.34); head.rotation.x = -0.28;
    const strapL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.04), M.plastic);
    strapL.position.set(-0.16, 0.5, -0.12); strapL.rotation.x = -0.28;
    const strapR = strapL.clone(); strapR.position.x = 0.16;
    seat.add(base, cushion, back, head, strapL, strapR);
    seat.position.set(px, py, pz);
    seat.rotation.y = rot[i];
    g.add(seat);
  }
  markMeshes(g, 'seats'); markGroup(g, 'seats');
  return g;
}

function buildConsole(M) {
  const g = new THREE.Group();
  // 操控台主体：金属骨架 + 塑料外壳
  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.3), M.frame);
  stand.position.y = 0.25;
  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.34, 0.34), M.plastic);
  housing.position.y = 0.58;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.06, 0.4), M.plasticLite);
  panel.position.set(0, 0.78, 0.06); panel.rotation.x = -0.5; // 前倾面板
  // 主显示屏 x2
  const s1 = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.22), M.displayA);
  s1.position.set(-0.2, 0.8, 0.24); s1.rotation.x = -0.5;
  const s2 = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.22), M.displayB);
  s2.position.set(0.2, 0.8, 0.24); s2.rotation.x = -0.5;
  // 操作按钮
  const btns = new THREE.Group();
  for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.04, 12), M.bezel);
    b.rotation.x = Math.PI / 2; b.position.set(-0.32 + c * 0.16, 0.62 + r * 0.0, 0.23);
    btns.add(b);
  }
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.18, 12), M.frame); // 手控操纵手柄
  handle.rotation.z = Math.PI / 2; handle.position.set(0, 0.5, 0.28);
  g.add(stand, housing, panel, s1, s2, btns, handle);
  markMeshes(g, 'console'); markGroup(g, 'console');
  return g;
}

function buildInstrument(M) {
  const g = new THREE.Group();
  // 仪表板：塑料本体
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.12), M.plastic);
  board.position.y = 0.25;
  // 三个圆形仪表（塑料表圈 + 自发光表盘）
  const disp = [M.displayA, M.displayB, M.displayC];
  for (let i = 0; i < 3; i++) {
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.04, 12, 28), M.bezel);
    bezel.position.set(-0.5 + i * 0.5, 0.32, 0.07);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.16, 28), disp[i]);
    face.position.set(-0.5 + i * 0.5, 0.32, 0.085);
    g.add(bezel, face);
  }
  // 两块小型状态屏
  const sa = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.18), M.displayB);
  sa.position.set(-0.55, 0.05, 0.08);
  const sb = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.18), M.displayC);
  sb.position.set(0.55, 0.05, 0.08);
  // 一排指示灯
  const leds = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 10), M.displayA);
    led.position.set(-0.2 + i * 0.066, -0.08, 0.09);
    leds.add(led);
  }
  g.add(board, sa, sb, leds);
  markMeshes(g, 'instrument'); markGroup(g, 'instrument');
  return g;
}

function buildReentry(M) {
  const g = new THREE.Group();
  // === 返回舱外形修正（对照真实航天器/用户规范）：倒扣钟形、上窄下宽 ===
  // 舱颈（窄端 r≈0.55）朝上接轨道舱；防热大底（宽端 r≈1.20）朝下接推进舱。
  // 原实现把母线半径随高度递增，成了"下窄上宽"的正钟形 —— 与真实构型相反。
  const profile = [
    new THREE.Vector2(1.20, 0.00),   // 大底外缘（最宽，钝头平面）
    new THREE.Vector2(1.19, 0.12),
    new THREE.Vector2(1.10, 0.36),   // 大底肩部曲线
    new THREE.Vector2(0.95, 0.78),
    new THREE.Vector2(0.78, 1.34),
    new THREE.Vector2(0.62, 1.80),
    new THREE.Vector2(0.55, 2.00),   // 舱颈（对接轨道舱）
  ];
  // 侧壁金属蒙皮（银白铝合金）
  const bell = new THREE.Mesh(tagShell(new THREE.LatheGeometry(profile, 72)), M.hull);
  // 棕褐色烧蚀防热涂层：包覆大底与肩部（再入迎风面），外扩 1.5% 形成独立防热层
  const SHIELD_OUT = 1.015;
  const sp = (r, y) => new THREE.Vector2(r * SHIELD_OUT, y);
  const shieldProfile = [sp(1.20, 0.00), sp(1.19, 0.12), sp(1.10, 0.36), sp(1.02, 0.62)];
  const shield = new THREE.Mesh(tagShell(new THREE.LatheGeometry(shieldProfile, 72)), M.ablated);
  // 防热大底平面（朝下，粗糙隔热层纹理）
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(1.20 * SHIELD_OUT, 72), M.ablated);
  bottom.rotation.x = Math.PI / 2; bottom.position.y = -0.004;
  // 舱颈环（上端，与轨道舱连接处）
  const collar = new THREE.Mesh(tagShell(new THREE.CylinderGeometry(0.575, 0.575, 0.20, 64)), M.goldDark);
  collar.position.y = 1.96;
  // 防热层与金属侧壁的接缝环
  const seam = new THREE.Mesh(new THREE.TorusGeometry(1.02 * SHIELD_OUT, 0.028, 8, 64), M.goldDark);
  seam.rotation.x = Math.PI / 2; seam.position.y = 0.62;
  g.add(bell, shield, bottom, collar, seam);

  // 舷窗 ×2：神舟二十三号"三重防护"舷窗（三层防护环 + 深色防辐射玻璃），位于肩部 y≈1.30
  for (const az of [0, Math.PI]) {
    const nx = Math.sin(az), nz = Math.cos(az);
    const WY = 1.30, WR = 0.802;                 // 该高度母线半径约 0.79，窗面贴壁
    const layers = [[0.190, 0.030, M.ring], [0.158, 0.024, M.goldDark], [0.128, 0.018, M.frame]];
    layers.forEach(([rr, tube, mat], li) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rr - 0.12, tube, 10, 26), mat);
      ring.position.set(nx * (WR + 0.012 * (li + 1)), WY, nz * (WR + 0.012 * (li + 1)));
      ring.rotation.y = az;
      g.add(ring);
    });
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.115, 26), M.glass);
    glass.position.set(nx * (WR + 0.062), WY, nz * (WR + 0.062));
    glass.rotation.y = az;
    g.add(glass);
  }
  // 侧舱门框（y≈0.52 处母线半径≈1.05）
  const doorRing = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.045, 10, 26), M.ring);
  doorRing.position.set(Math.sin(1.6) * 1.06, 0.52, Math.cos(1.6) * 1.06);
  doorRing.rotation.y = 1.6; doorRing.rotation.x = 0.45;
  g.add(doorRing);

  // 姿态喷口 ×4（肩部，外倾小锥体）
  for (let i = 0; i < 4; i++) {
    const az = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const r0 = 0.70, y0 = 1.62;
    const th = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.18, 12), M.thruster);
    th.position.set(Math.sin(az) * r0, y0, Math.cos(az) * r0);
    th.rotation.set(Math.PI, 0, 0);
    th.rotation.y = az;
    g.add(th);
  }
  // 传感器探头 ×3 + 信号天线（鞭状 + 短柱）
  for (const [az, y] of [[0.6, 1.86], [2.4, 1.74], [4.6, 1.68]]) {
    const r0 = y > 1.8 ? 0.60 : 0.66;
    const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 10), M.frame);
    probe.position.set(Math.sin(az) * r0, y, Math.cos(az) * r0);
    probe.rotation.z = Math.cos(az) * 0.6; probe.rotation.x = -Math.sin(az) * 0.6;
    g.add(probe);
  }
  const whip = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.95, 8), M.frame);
  whip.position.set(Math.sin(2.9) * 0.62, 2.25, Math.cos(2.9) * 0.62);
  whip.rotation.z = 0.55;
  const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 12), M.dark);
  stub.position.set(Math.sin(4.9) * 0.66, 1.72, Math.cos(4.9) * 0.66);
  g.add(whip, stub);
  // 舱外管线 ×2（沿肩部母线贴壁走线，细圆柱 + 走向倾角）
  for (const az of [1.0, 4.2]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.95, 8), M.brass);
    // 肩部 y≈0.35→1.30 处母线半径约 1.10→0.86：取中段 r≈0.99，并朝舱壁倾斜贴合
    pipe.position.set(Math.sin(az) * 0.99, 0.82, Math.cos(az) * 0.99);
    pipe.rotation.x = Math.sin(az) * 0.26;
    pipe.rotation.z = -Math.cos(az) * 0.26;
    g.add(pipe);
  }
  markMeshes(g, 'reentry'); // 仅钟形外壳

  // 内部构件（点击可单独查看）
  const interior = new THREE.Group();
  const seats = buildSeats(M); seats.position.set(0, 0, 0);
  const console = buildConsole(M); console.position.set(0, 1.15, 0.55);
  const instrument = buildInstrument(M); instrument.position.set(0, 1.55, 0.0);
  interior.add(seats, console, instrument);
  g.add(interior);

  // 降落伞舱
  const chute = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.light);
  chute.position.y = 2.1;
  const chuteG = new THREE.Group(); chuteG.add(chute);
  markMeshes(chuteG, 'chute'); markGroup(chuteG, 'chute');
  g.add(chuteG);

  markGroup(g, 'reentry');
  return g;
}

// ---- 推进舱 + 太阳翼 + 发动机 + 贮箱 ----
function buildService(M) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(tagShell(new THREE.CylinderGeometry(1.25, 1.25, 3.0, 72)), M.service);
  body.position.y = 0;
  const cone = new THREE.Mesh(tagShell(new THREE.CylinderGeometry(1.25, 1.4, 1.0, 72)), M.service);
  cone.position.y = -2.0;
  g.add(body, cone);
  // 结构细节：散热辐射板 ×4、姿控推力器 ×8、电缆/管路板、对接环
  for (let i = 0; i < 4; i++) {
    const az = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const rad = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.6, 0.05), M.radiator);
    rad.position.set(Math.cos(az) * (1.25 + 0.015), 0.35, Math.sin(az) * (1.25 + 0.015));
    rad.rotation.y = -az;
    g.add(rad);
  }
  for (let i = 0; i < 8; i++) {                       // 底部姿控推力器
    const az = (i / 8) * Math.PI * 2;
    const th = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.24, 12), M.thruster);
    th.position.set(Math.cos(az) * 1.30, -1.72, Math.sin(az) * 1.30);
    th.rotation.set(Math.PI, 0, 0);
    g.add(th);
  }
  for (const [az, y] of [[0.7, -0.6], [3.2, 0.9]]) {  // 电缆/管路接口板
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.07), M.frame);
    plate.position.set(Math.cos(az) * (1.25 + 0.02), y, Math.sin(az) * (1.25 + 0.02));
    plate.rotation.y = -az;
    g.add(plate);
  }
  // 推进剂管路 ×2（沿舱壁纵向，带卡箍）+ 传感器探头 ×2 + 通信天线 ×1
  for (const az of [1.5, 4.6]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 2.4, 10), M.brass);
    pipe.position.set(Math.cos(az) * (1.25 + 0.045), 0.2, Math.sin(az) * (1.25 + 0.045));
    g.add(pipe);
    for (const y of [-0.8, 0.2, 1.2]) {
      const clamp = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.016, 6, 14), M.frame);
      clamp.position.set(Math.cos(az) * (1.25 + 0.045), y, Math.sin(az) * (1.25 + 0.045));
      clamp.rotation.x = Math.PI / 2;
      g.add(clamp);
    }
  }
  for (const [az, y] of [[2.3, 1.15], [5.5, -0.35]]) {
    const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 10), M.dark);
    probe.position.set(Math.cos(az) * (1.25 + 0.14), y, Math.sin(az) * (1.25 + 0.14));
    probe.rotation.set(Math.PI / 2, 0, 0); probe.rotation.y = -az;
    g.add(probe);
  }
  {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.022, 0.9, 8), M.frame);
    ant.position.set(Math.cos(2.9) * (1.25 + 0.30), 1.55, Math.sin(2.9) * (1.25 + 0.30));
    ant.rotation.z = 0.45;
    g.add(ant);
  }
  const dockRing = new THREE.Mesh(new THREE.TorusGeometry(1.27, 0.03, 8, 64), M.ring);
  dockRing.rotation.x = Math.PI / 2; dockRing.position.y = 1.45;
  g.add(dockRing);
  markMeshes(g, 'service');

  // 大型太阳翼（左右，铰接式 4 段，展开后约 7.2m 跨度）
  // 帆板收拢态修正（对齐真实神舟）：大的帆板折叠固定在推进舱外侧舱壁上，
  // 翼根贴近舱体表面（舱半径 1.25）
  // === 大型太阳翼（按规范重建：层级 = 推进舱 → 转轴根节点 →（铰链/支架 + 太阳翼））===
  // 转轴要求：轴心位于推进舱侧壁根部、旋转轴沿飞船纵向（Y 轴）；
  // 收拢 0° 时翼面贴侧翼（翼面与舱壁近似平行、展向沿切向），展开 90° 时绕纵轴横向伸出，
  // 两侧镜像同步 → 形成近似水平的横向一字布局。
  const solar = new THREE.Group();
  const sHinges = [], sWings = [];
  for (const s of [-1, 1]) {
    const sideG = new THREE.Group();
    sideG.position.set(0, 0.2, 0);          // 转轴所在的舱段高度
    // —— 旋转根节点：轴心在舱壁根部（半径 1.25 + 支架 0.03），绕飞船纵向 Y 旋转 ——
    const hinge = new THREE.Group();
    hinge.position.set(s * 1.28, 0, 0);
    // 链条式连接件（全部贴在舱壁上，不悬空）：安装座 → 驱动盒 → 转轴 → 轮毂
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.72, 0.72), M.frame);
    bracket.position.set(-s * 0.15, 0, 0);                 // 座体贴住舱壁
    const driveBox = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.52, 20), M.frame);
    driveBox.rotation.z = Math.PI / 2;                     // 与转轴同轴（沿 Y? 见下）
    driveBox.rotation.y = Math.PI / 2;
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.72, 16), M.brass);
    axle.rotation.x = Math.PI / 2;                          // 轴向 = 飞船纵向（Y）
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.12, 18), M.frame);
    hub.rotation.x = Math.PI / 2;
    hinge.add(bracket, driveBox, axle, hub);
    // —— 太阳翼主体：基准姿态让展向沿切向、翼面法线朝外（贴壁平行）——
    const wing = buildSolarWing(M, { panels: 4, panelW: 1.8, panelH: 2.4 });
    wing.rotation.y = Math.PI / 2;            // 展向 +X → -Z（切向贴壁）；法线 Z → +X（朝外）
    hinge.add(wing);
    sideG.add(hinge);
    sideG.userData.hinge = hinge;             // 旋转根节点（展开动画驱动它）
    sideG.userData.side = s;                  // 左右符号（镜像）
    sideG.userData.hinges = wing.userData.hinges;   // 各段关节（手风琴折叠）
    sideG.userData.wing = wing;
    sHinges.push(...wing.userData.hinges);
    sWings.push(sideG);
    solar.add(sideG);
  }
  solar.userData.hinges = sHinges;
  solar.userData.wings = sWings;
  markMeshes(solar, 'serviceSolar'); markGroup(solar, 'serviceSolar');
  g.add(solar);

  // 尾部主制动发动机（对照规范：多台主发动机喷口 + 姿控小喷管）
  const engine = new THREE.Group();
  const block = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.44, 32), M.nozzle);
  block.position.y = -2.40;
  engine.add(block);
  // 4 台主发动机（变轨 / 返回制动），高温深色喷管 + 内腔
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const noz = new THREE.Mesh(new THREE.ConeGeometry(0.30, 0.80, 24, 1, true), M.nozzle);
    noz.position.set(Math.cos(a) * 0.58, -2.92, Math.sin(a) * 0.58);
    noz.rotation.x = Math.PI;
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.72, 20, 1, true), M.ablated);
    inner.position.set(Math.cos(a) * 0.58, -2.88, Math.sin(a) * 0.58);
    inner.rotation.x = Math.PI;
    engine.add(noz, inner);
  }
  // 中心 4 台小游动喷口（姿态微调）
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const vn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.30, 14, 1, true), M.thruster);
    vn.position.set(Math.cos(a) * 0.22, -2.72, Math.sin(a) * 0.22);
    vn.rotation.x = Math.PI;
    engine.add(vn);
  }
  markMeshes(engine, 'engine'); markGroup(engine, 'engine');
  g.add(engine);

  // 贮箱
  const tankG = new THREE.Group();
  // 贮箱置于舱内（原先半露在舱体外面造成与舱壁互穿，此处移到体内；拆解弹出时仍可见）
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.6, 32), M.brass);
  tank.position.set(0.62, 0, 0);
  tankG.add(tank);
  markMeshes(tankG, 'tank'); markGroup(tankG, 'tank');
  g.add(tankG);

  markGroup(g, 'service');
  return g;
}

export function buildShip() {
  const M = makeMaterials();
  const root = new THREE.Group();
  root.userData.partId = 'ship';

  // 纵向布局（对接面紧贴，真实神舟三舱无悬空）：
  //   service 顶 = 1.5（筒体 3.0 高，中心 y=0）
  //   reentry    = 1.5（钟形底贴推进舱顶，顶缘 collar 到 1.5+2.11=3.61）
  //   orbital    = 3.74（底端盖下缘 3.74-0.125=3.615，与返回舱颈环留 0.005 防共面）
  //   docking    = 6.67（对接环坐在轨道舱顶 3.74+2.925=6.665 上）
  // 旧布局 orbital=4.9 / docking=6.5 会在轨道舱与返回舱之间留 1.17m 悬空、且对接环埋进舱体。
  const docking = buildDocking(M); docking.position.set(0, 6.67, 0);
  const orbital = buildOrbital(M); orbital.position.set(0, 3.74, 0);
  const reentry = buildReentry(M); reentry.position.set(0, 1.5, 0);
  const service = buildService(M); service.position.set(0, 0, 0);
  root.add(docking, orbital, reentry, service);

  // 收集部件组（Group 对象）映射
  const groups = new Map();
  root.traverse(o => {
    if (o.userData && o.userData.partId && o.type === 'Group') {
      groups.set(o.userData.partId, o);
    }
  });

  const fm = flatten(PARTS);
  for (const [id, grp] of groups) {
    const node = fm[id] && fm[id].node;
    grp.userData.label = (node && node.label) || id;
    grp.userData.offset = new THREE.Vector3(...((node && node.offset) || [0, 0, 0]));
    grp.userData.home = grp.position.clone();
    grp.userData.pinned = false;
  }

  // 收集外壳材质（舱内透视用）
  const shellMats = new Set();
  root.traverse(o => {
    if (o.isMesh && o.userData.shell) shellMats.add(o.material);
  });

  return { root, groups, shellMats };
}
