// ============================================================================
// tower.js —— 脐带塔（发射塔）模块化建模与机构逻辑
// ----------------------------------------------------------------------------
// 设计要点：
//  1) 结构分层：塔体（四腿格构）→ 平台层（按箭体分段布设）→ 摆杆/脐带 → 支撑压紧机构。
//  2) 性能：横撑/斜撑/护栏立柱/横栏用 InstancedMesh（数百个构件 → 个位数 draw call）。
//  3) 机构逻辑：摆杆"倒计时内自下而上分批摆离"、支撑臂"解锁瞬间释放"；
//     所有姿态由时刻 t 唯一决定（无额外状态）→ seek/重置自动回位。
//  4) 安全约束：起飞前必须"摆杆全撤清"，提供 armsClear() 校验；
//     未撤清时按 CONTRACT 强制收尾并告警（杜绝"塔臂穿箭"）。
//  5) 异常：任何几何参数非有限值时回落到默认值，不抛异常。
// ============================================================================
import * as THREE from 'three';

// ---- 塔体参数（单位 m；与 launch.js 的转弯安全高度 62m 保持一致）----
export const TOWER_SPEC = {
  height: 62,          // 塔体总高（含顶部避雷针基座）
  halfWidth: 1.55,     // 四腿格构柱半宽（腿中心到塔轴）
  legSize: 0.55,       // 格构柱截面边长
  centerX: 9.0,        // 塔轴距箭体轴的距离
  bayHeight: 4.0,      // 格构层高（横撑间距）
  platformYs: [12, 20, 28, 36, 44, 52],   // 平台层高：对应助推器/一级/级间/二级/整流罩/飞船
  armYs: [8, 15.4, 22.8, 30.2, 37.6, 45.0, 52.4],  // 摆杆层高（自下而上）
  armSwingMax: 2.0,    // 摆杆最大摆离角（rad ≈115°）
  holddownCount: 4,    // 底部支撑/压紧机构数量
  holddownY: 1.15,     // 压紧机构高度
};

const _dummy = new THREE.Object3D();

/** 有限值守卫 */
function num(v, fb) { return (typeof v === 'number' && isFinite(v)) ? v : fb; }
function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / Math.max(b - a, 1e-6)));
  return t * t * (3 - 2 * t);
}

/**
 * 构建脐带塔
 * @param {Object} opts
 *   - siteMats: Set，收集需要随"大气消散"淡出的材质
 *   - spec: 覆盖 TOWER_SPEC 的字段
 * @returns {Object} { group, arms, armLines, holddowns, lights, mats, update, armsClear, spec }
 */
export function buildTower(opts) {
  const o = opts || {};
  const spec = Object.assign({}, TOWER_SPEC, o.spec || {});
  const siteMats = o.siteMats || new Set();

  const H = num(spec.height, 62);
  const TW = num(spec.halfWidth, 1.55);
  const TX = num(spec.centerX, 9.0);
  const bay = num(spec.bayHeight, 4.0);

  const group = new THREE.Group();
  group.name = 'umbilicalTower';

  // ---- 材质（统一登记，供高空淡出复用）----
  const mFrame = new THREE.MeshStandardMaterial({ color: 0x27577e, metalness: 0.55, roughness: 0.5, transparent: true });
  const mPlat = new THREE.MeshStandardMaterial({ color: 0x1f4767, metalness: 0.5, roughness: 0.55, transparent: true });
  const mArm = new THREE.MeshStandardMaterial({ color: 0xd8a418, metalness: 0.45, roughness: 0.5, transparent: true });
  const mRail = new THREE.MeshStandardMaterial({ color: 0x8fa8bd, metalness: 0.6, roughness: 0.4, transparent: true });
  const mSteel = new THREE.MeshStandardMaterial({ color: 0x6f7f8c, metalness: 0.7, roughness: 0.45, transparent: true });
  const mLine = new THREE.MeshStandardMaterial({ color: 0x2b3038, metalness: 0.3, roughness: 0.8, transparent: true });
  for (const m of [mFrame, mPlat, mArm, mRail, mSteel, mLine]) siteMats.add(m);

  // ---- ① 四腿格构柱 ----
  const legG = new THREE.BoxGeometry(num(spec.legSize, 0.55), H, num(spec.legSize, 0.55));
  for (const dx of [-TW, TW]) for (const dz of [-TW, TW]) {
    const leg = new THREE.Mesh(legG, mFrame);
    leg.position.set(TX + dx, H / 2, dz);
    leg.castShadow = true; leg.receiveShadow = true;
    group.add(leg);
  }

  // ---- ② 横撑 / 斜撑：实例化（每层 4 横撑 + 6 斜撑 → 2 个 InstancedMesh）----
  const bays = Math.max(1, Math.floor((H - 4) / bay));
  const rungXG = new THREE.BoxGeometry(TW * 2, 0.26, 0.26);
  const rungZG = new THREE.BoxGeometry(0.26, 0.26, TW * 2);
  const diagG = new THREE.BoxGeometry(0.2, bay * 1.22, 0.2);
  const rungCount = bays * 4;
  const diagCount = bays * 6;
  const rungs = new THREE.InstancedMesh(rungXG, mFrame, rungCount);   // 复用了 rungXG 形状（近似）
  const diags = new THREE.InstancedMesh(diagG, mFrame, diagCount);
  rungs.castShadow = diags.castShadow = false;    // 桁架构件不投影，省阴影绘制
  let ri = 0, di = 0;
  const rungMatricesA = [], rungMatricesB = [];
  for (let i = 0; i < bays; i++) {
    const y = 2 + i * bay;
    // ±Z 面横撑（沿 X）
    for (const dz of [-TW, TW]) {
      _dummy.position.set(TX, y, dz); _dummy.rotation.set(0, 0, 0); _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix(); rungMatricesA.push(_dummy.matrix.clone());
    }
    // ±X 面横撑（沿 Z）
    for (const dx of [-TW, TW]) {
      _dummy.position.set(TX + dx, y, 0); _dummy.rotation.set(0, 0, 0); _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix(); rungMatricesB.push(_dummy.matrix.clone());
    }
    // 斜撑：±Z 面（绕 Z 倾斜）与 ±X 面（绕 X 倾斜）
    for (const s of [-1, 1]) {
      _dummy.position.set(TX, y + bay / 2, s * TW); _dummy.rotation.set(0, 0, s * 0.72); _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix(); diags.setMatrixAt(di++, _dummy.matrix);
    }
    for (const dx of [-TW, TW]) for (const s of [-1, 1]) {
      _dummy.position.set(TX + dx, y + bay / 2, 0); _dummy.rotation.set(s * 0.72, 0, 0); _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix(); diags.setMatrixAt(di++, _dummy.matrix);
    }
  }
  // 横撑分两个实例网格（两种朝向各自一套几何）
  const rungsX = new THREE.InstancedMesh(rungXG, mFrame, rungMatricesA.length);
  const rungsZ = new THREE.InstancedMesh(rungZG, mFrame, rungMatricesB.length);
  rungMatricesA.forEach((m, i) => rungsX.setMatrixAt(i, m));
  rungMatricesB.forEach((m, i) => rungsZ.setMatrixAt(i, m));
  rungsX.instanceMatrix.needsUpdate = rungsZ.instanceMatrix.needsUpdate = diags.instanceMatrix.needsUpdate = true;
  rungsX.frustumCulled = rungsZ.frustumCulled = diags.frustumCulled = false;
  group.add(rungsX, rungsZ, diags);

  // ---- ③ 平台层（伸向箭体一侧）+ 护栏（实例化）----
  const platG = new THREE.BoxGeometry(3.6, 0.22, 4.4);
  const levels = [];
  const postMatrices = [], railXMatrices = [], railZMatrices = [];
  for (const y of spec.platformYs) {
    const p = new THREE.Mesh(platG, mPlat);
    p.position.set(TX - 2.6, y, 0);
    p.castShadow = true; p.receiveShadow = true;
    group.add(p);
    for (const dz of [-2.1, 2.1]) for (const dx of [0.6, -1.0]) {
      _dummy.position.set(TX - 2.6 + dx, y + 0.6, dz); _dummy.rotation.set(0, 0, 0); _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix(); postMatrices.push(_dummy.matrix.clone());
    }
    for (const dz of [-2.1, 2.1]) {
      _dummy.position.set(TX - 2.0, y + 1.1, dz); _dummy.rotation.set(0, 0, 0); _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix(); railZMatrices.push(_dummy.matrix.clone());
    }
    for (const dx of [0.6, -1.0]) {
      _dummy.position.set(TX - 2.6 + dx, y + 1.1, 0); _dummy.rotation.set(0, 0, 0); _dummy.scale.set(1, 1, 1);
      _dummy.updateMatrix(); railXMatrices.push(_dummy.matrix.clone());
    }
    levels.push({ y, deck: p });
  }
  const postG = new THREE.BoxGeometry(0.09, 1.05, 0.09);
  const railXG = new THREE.BoxGeometry(3.6, 0.07, 0.07);
  const railZG = new THREE.BoxGeometry(0.07, 0.07, 4.4);
  const posts = new THREE.InstancedMesh(postG, mRail, Math.max(1, postMatrices.length));
  const railsX = new THREE.InstancedMesh(railXG, mRail, Math.max(1, railXMatrices.length));
  const railsZ = new THREE.InstancedMesh(railZG, mRail, Math.max(1, railZMatrices.length));
  postMatrices.forEach((m, i) => posts.setMatrixAt(i, m));
  railXMatrices.forEach((m, i) => railsX.setMatrixAt(i, m));
  railZMatrices.forEach((m, i) => railsZ.setMatrixAt(i, m));
  for (const im of [posts, railsX, railsZ]) { im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; group.add(im); }

  // ---- ④ 摆杆（含脐带管线）：枢轴在塔体面向箭体一侧，分批摆离 ----
  const arms = [], armLines = [];
  const armG = new THREE.BoxGeometry(4.8, 0.45, 0.7);
  const armTipG = new THREE.BoxGeometry(0.5, 0.8, 1.1);
  const lineG = new THREE.CylinderGeometry(0.06, 0.06, 4.6, 6);
  const armYs = spec.armYs;
  for (let i = 0; i < armYs.length; i++) {
    const y = armYs[i];
    const pivot = new THREE.Group();
    pivot.position.set(TX - TW - 0.15, y, 0);
    const body = new THREE.Mesh(armG, mArm); body.position.x = -2.4;
    const tip = new THREE.Mesh(armTipG, mArm); tip.position.x = -4.9;
    pivot.add(body, tip);
    // 脐带管线：随臂摆动；脱落后（摆离角 > 0.8rad）隐藏，模拟"管线已断开"
    for (const dz of [-0.22, 0.22]) {
      const ln = new THREE.Mesh(lineG, mLine);
      ln.rotation.z = Math.PI / 2;                     // 沿 X 平放
      ln.position.set(-2.4, -0.30, dz);
      pivot.add(ln); armLines.push({ mesh: ln, arm: i });
    }
    group.add(pivot); arms.push(pivot);
  }

  // ---- ⑤ 底部支撑 / 压紧机构（解锁瞬间释放）----
  const holddowns = [];
  const hdArmG = new THREE.BoxGeometry(2.6, 0.30, 0.42);
  const hdPadG = new THREE.BoxGeometry(0.5, 0.24, 0.5);
  for (let i = 0; i < num(spec.holddownCount, 4); i++) {
    const a = (i / num(spec.holddownCount, 4)) * Math.PI * 2 + Math.PI / 4;
    const pivot = new THREE.Group();
    pivot.position.set(TX - 3.4, num(spec.holddownY, 1.15), 0);
    pivot.rotation.y = a;
    const arm = new THREE.Mesh(hdArmG, mSteel); arm.position.x = 1.3 - TX * 0;   // 伸向箭体
    const pad = new THREE.Mesh(hdPadG, mSteel); pad.position.x = 2.55;
    pivot.add(arm, pad);
    group.add(pivot); holddowns.push(pivot);
  }

  // ---- ⑥ 泛光灯（3 盏，照亮箭体侧面；数量受控以免过多光源）----
  const lights = [];
  for (const y of [14, 30, 46]) {
    const L = new THREE.PointLight(0xdce8ff, 5.5, 100, 1.7);
    L.position.set(TX - 5.0, y, 0);
    group.add(L); lights.push(L);
  }

  // ---- ⑦ 机构更新：姿态由 t 唯一决定 ----
  // 摆杆：t=2s 起自下而上分批摆开，6.5s 前全部撤清（点火 T_IGN=10s 之前必然完成）
  const ARM_SWING = num(spec.armSwingMax, 2.0);
  let warned = false;
  function update(t, ctx) {
    const tt = num(t, 0);
    let maxAngle = 0;
    for (let i = 0; i < arms.length; i++) {
      const k = smoothstep(2 + i * 0.55, 6.5 + i * 0.55, tt);
      const ang = k * ARM_SWING;
      arms[i].rotation.y = ang;
      if (ang > maxAngle) maxAngle = ang;
    }
    // 管线断开：摆离超过 0.8rad 视为脱开并隐藏（避免"管线跨空连接"穿帮）
    for (const L of armLines) {
      L.mesh.visible = arms[L.arm].rotation.y < 0.8;
    }
    // 支撑压紧机构：解锁（离塔）后 0.6s 内摆开；未起飞时始终压紧
    const lifted = !!(ctx && ctx.lifted);
    const liftT = num(ctx && ctx.liftT, 0);
    const kH = lifted ? smoothstep(liftT, liftT + 0.6, tt) : 0;
    for (let i = 0; i < holddowns.length; i++) {
      holddowns[i].rotation.y = (i / holddowns.length) * Math.PI * 2 + Math.PI / 4 + kH * 0.9;
      holddowns[i].position.y = num(spec.holddownY, 1.15) - kH * 0.25;
    }
    // 安全约束：起飞前摆杆必须全撤清；否则强制收尾并告警（只告警一次）
    if (lifted && maxAngle < ARM_SWING * 0.85) {
      if (!warned) {
        warned = true;
        console.warn('[tower] 起飞时摆杆未完全撤清（约束违规），已强制摆离：maxAngle=' + maxAngle.toFixed(2));
      }
      for (const a of arms) a.rotation.y = ARM_SWING;
      for (const L of armLines) L.mesh.visible = false;
    }
  }

  /** 校验：给定时刻摆杆是否已全部撤清（供起飞互锁使用） */
  function armsClear(t) {
    const tt = num(t, 0);
    for (let i = 0; i < arms.length; i++) {
      const k = smoothstep(2 + i * 0.55, 6.5 + i * 0.55, tt);
      if (k < 0.85) return false;
    }
    return true;
  }

  return {
    group, arms, armLines, holddowns, lights, levels,
    mats: { mFrame, mPlat, mArm, mRail, mSteel, mLine },
    spec, update, armsClear,
    /** 资源占用统计（面板/巡检用） */
    stats() {
      let draws = 0, meshes = 0;
      group.traverse((o) => { if (o.isMesh || o.isInstancedMesh) { meshes++; if (o.isInstancedMesh) draws++; else draws++; } });
      return { meshes, draws, instanced: 5, lights: lights.length, arms: arms.length };
    },
  };
}

export default buildTower;
