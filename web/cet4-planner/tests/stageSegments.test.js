// 测试 engine.stageSegments：日历进度带的三段边界口径
// 关键：有生成任务时，应以"实际任务阶段边界"为准（与日历日底色一致），
//       而非通用公式 engine.stages（对 2026-12-12 会在 11.12/11.30 切，比计划晚 2 天）。
const assert = require('assert');
const engine = require('../utils/engine');
const d = require('../utils/date');

// 考试 2026-12-12，启动 10.08，跨度 65 天
const EXAM = '2026-12-12';
const START = '2026-10-08';
const TOTAL = d.diffDays(START, EXAM); // 65

// 计划（plan108）实际阶段边界：专项 11.10 起、模考 12.01 起
const planTasks = [
  { source: 'plan108', stage: 'basic', planDate: '2026-10-08' },
  { source: 'plan108', stage: 'basic', planDate: '2026-11-09' },
  { source: 'plan108', stage: 'special', planDate: '2026-11-10' },
  { source: 'plan108', stage: 'special', planDate: '2026-11-30' },
  { source: 'plan108', stage: 'mock', planDate: '2026-12-01' },
  { source: 'plan108', stage: 'mock', planDate: '2026-12-11' },
  { source: 'manual', stage: 'basic', planDate: '2026-09-01' } // 手动任务不计入阶段
];

(function testPlanBoundaries() {
  const segs = engine.stageSegments(planTasks, START, TOTAL, EXAM);
  assert.strictEqual(segs.length, 3, '计划应有三段');
  const byKey = {};
  segs.forEach((s) => { byKey[s.key] = s; });
  assert.strictEqual(byKey.basic.days, 33, '基础期应 33 天（10.08–11.09）');
  assert.strictEqual(byKey.special.days, 21, '专项期应 21 天（11.10–11.30）');
  assert.strictEqual(byKey.mock.days, 11, '模考期应 11 天（12.01–12.11）');
  const sum = byKey.basic.days + byKey.special.days + byKey.mock.days;
  assert.strictEqual(sum, TOTAL, '三段天数应等于全程跨度');
  // 标签应与日历图例一致
  assert.strictEqual(byKey.basic.name, '基础');
  assert.strictEqual(byKey.special.name, '专项');
  assert.strictEqual(byKey.mock.name, '模考');
  assert.strictEqual(byKey.mock.cls, 'seg-mock');
  console.log('✓ plan boundaries: 33/21/11 与计划阶段切分一致');
})();

(function testManualExcluded() {
  const onlyManual = [
    { source: 'manual', stage: 'basic', planDate: '2026-10-08' },
    { source: 'manual', stage: 'mock', planDate: '2026-11-15' }
  ];
  const segs = engine.stageSegments(onlyManual, START, TOTAL, EXAM);
  // 纯手动无生成任务 -> 必须退回通用公式，而非拿手动任务当边界
  assert.ok(segs.length >= 1 && segs[0].key === 'basic', '纯手动应退回通用公式');
  const total = segs.reduce((a, s) => a + s.days, 0);
  assert.strictEqual(total, TOTAL, '退回通用公式时三段仍覆盖全程');
  console.log('✓ manual-only falls back to engine.stages');
})();

(function testFallbackDiffersFromPlan() {
  const segs = engine.stageSegments([], START, TOTAL, EXAM); // 无任务
  const byKey = {};
  segs.forEach((s) => { byKey[s.key] = s; });
  // 通用公式专项从 11.12 起（比计划 11.10 晚 2 天），证明两种口径不同
  // 专项天数 = 18（11.12–11.29），而非计划口径的 21
  assert.strictEqual(byKey.special.days, 18, '通用公式专项应为 18 天（11.12–11.29）');
  console.log('✓ fallback (engine.stages) special = 18 天，与计划 21 天不同口径');
})();
