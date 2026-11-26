// seam: utils/engine.js 的公共接口（规划引擎 = 产品的核心承诺）
// 现实前提：10.08–12.11 由《10.8启动计划》逐日覆盖（utils/plan108.js），
//           通用生成只在计划区间之外生效 —— 故通用逻辑用"远期考期"单独验证
require('./helpers/wx-mock.js');
var test = require('node:test');
var assert = require('node:assert');
var engine = require('../utils/engine.js');
var store = require('../utils/store.js');
var d = require('../utils/date.js');

var EXAM = '2026-12-12';      // 真实考期：10.8 起被启动计划覆盖
var EXAM_FAR = '2027-02-01';  // 远期考期：12.12 之后落到通用生成，用于验证兜底逻辑

function tasksOf(res, date) {
  return res.tasks.filter(function (t) { return t.planDate === date; });
}

// ————————————————————————————————————————
// 一、阶段切分与时长（纯逻辑，不依赖具体计划）
// ————————————————————————————————————————
test('stageOf: 三阶段边界与计划一致（模考12天/专项18天）', function () {
  var s = engine.stages(EXAM);
  assert.strictEqual(engine.stageOf('2026-11-30', s), 'mock');
  assert.strictEqual(engine.stageOf('2026-12-11', s), 'mock');
  assert.strictEqual(engine.stageOf('2026-11-29', s), 'special');
  assert.strictEqual(engine.stageOf('2026-11-12', s), 'special');
  assert.strictEqual(engine.stageOf('2026-11-11', s), 'basic');
  assert.strictEqual(engine.stageOf('2026-01-01', s), 'basic');
});

test('weekHours/dailyMinutes: 每周时长渐进 8h→10h→12h→9h', function () {
  assert.strictEqual(engine.weekHours(1), 8);
  assert.strictEqual(engine.weekHours(3), 10);
  assert.strictEqual(engine.weekHours(5), 12);
  assert.strictEqual(engine.weekHours(11), 9);
  assert.strictEqual(engine.dailyMinutes(1), 80);   // 8h/6天
  assert.strictEqual(engine.dailyMinutes(3), 100);  // 10h/6天
  assert.strictEqual(engine.dailyMinutes(5), 120);  // 12h/6天
  assert.strictEqual(engine.dailyMinutes(11), 90);  // 模考期 9h/6天
});

// ————————————————————————————————————————
// 二、《10.8启动计划》覆盖 10.08–12.11（真实考期下的产品行为）
// ————————————————————————————————————————
test('generatePlan: 10.08–12.11 每一天都有计划任务，无空缺日', function () {
  store.saveTasks([]);
  var res = engine.generatePlan({ examDate: EXAM });
  var missing = [];
  for (var dt = '2026-10-08'; dt <= '2026-12-11'; dt = d.addDays(dt, 1)) {
    if (tasksOf(res, dt).length === 0) missing.push(dt);
  }
  assert.deepStrictEqual(missing, [], '计划区间不应有空缺日: ' + missing.join(','));
});

test('generatePlan: 三阶段归属（基础到 11.09 / 专项 11.10–11.30 / 模考 12.01 起）', function () {
  store.saveTasks([]);
  var res = engine.generatePlan({ examDate: EXAM });
  assert.strictEqual(tasksOf(res, '2026-11-09')[0].stage, 'basic');
  assert.strictEqual(tasksOf(res, '2026-11-10')[0].stage, 'special');
  assert.strictEqual(tasksOf(res, '2026-11-30')[0].stage, 'special');
  assert.strictEqual(tasksOf(res, '2026-12-01')[0].stage, 'mock');
  assert.strictEqual(tasksOf(res, '2026-12-11')[0].stage, 'mock');
});

test('generatePlan: 单词进度 U3L2 起步 → W3(10.20) 到 U5L1 → W5(11.03) 到 U7L1', function () {
  store.saveTasks([]);
  var res = engine.generatePlan({ examDate: EXAM });
  function vocabRef(date) {
    var v = tasksOf(res, date).filter(function (t) { return t.type === 'vocab'; })[0];
    return v ? v.contentRef : '';
  }
  assert.ok(vocabRef('2026-10-08').indexOf('U3L2') !== -1, '10.08 从 U3L2 起步: ' + vocabRef('2026-10-08'));
  assert.ok(vocabRef('2026-10-20').indexOf('U5L1') !== -1, 'W3 到 U5L1: ' + vocabRef('2026-10-20'));
  assert.ok(vocabRef('2026-11-03').indexOf('U7L1') !== -1, 'W5 到 U7L1: ' + vocabRef('2026-11-03'));
});

test('generatePlan: 12.05 全真模考使用华研 2026-06 真题套卷', function () {
  store.saveTasks([]);
  var res = engine.generatePlan({ examDate: EXAM });
  var m = tasksOf(res, '2026-12-05').filter(function (t) { return t.type === 'mock'; })[0];
  assert.ok(m, '12.05 存在模考任务');
  assert.strictEqual(m.count, 1);
  assert.strictEqual(m.unit, '套');
  assert.ok(m.contentRef.indexOf('2026-06') !== -1, '用 2026-06 真题: ' + m.contentRef);
  assert.ok(m.qtypes.indexOf('写作') !== -1 && m.qtypes.indexOf('翻译') !== -1);
});

test('generatePlan: 周末大块任务落在真实周六/周日（文档星期标注偏 1 天，以日历为准）', function () {
  store.saveTasks([]);
  var res = engine.generatePlan({ examDate: EXAM });
  ['2026-10-10', '2026-10-17', '2026-12-05'].forEach(function (sat) {
    assert.strictEqual(d.dayOfWeek(sat), 6, sat + ' 应是周六');
    assert.ok(tasksOf(res, sat).length > 0, sat + ' 应有任务');
  });
  ['2026-10-11', '2026-10-18', '2026-12-06'].forEach(function (sun) {
    assert.strictEqual(d.dayOfWeek(sun), 0, sun + ' 应是周日');
    assert.ok(tasksOf(res, sun).length > 0, sun + ' 应有任务');
  });
  // 周一回到工作日轻量档，不会误排周末大块
  ['2026-10-12', '2026-10-19'].forEach(function (mon) {
    assert.strictEqual(d.dayOfWeek(mon), 1, mon + ' 应是周一');
    var total = tasksOf(res, mon).reduce(function (s, t) { return s + (t.estMinutes || 0); }, 0);
    assert.ok(total <= 40, mon + ' 周一应 <=40min: ' + total);
  });
});

test('generatePlan: 考前一天 12.11 只做保温与考前准备，不刷新题新词', function () {
  store.saveTasks([]);
  var res = engine.generatePlan({ examDate: EXAM });
  var day = tasksOf(res, '2026-12-11');
  assert.ok(day.length >= 3);
  day.forEach(function (t) {
    assert.ok(t.title.indexOf('默写') !== -1 || t.title.indexOf('泛听') !== -1 ||
              t.title.indexOf('高频词') !== -1 || t.title.indexOf('考前准备') !== -1,
      '12.11 应为保温类任务: ' + t.title);
  });
});

test('generatePlan: 工作日轻量（<=40min）、周末集中（更长）', function () {
  store.saveTasks([]);
  var res = engine.generatePlan({ examDate: EXAM });
  function total(date) {
    return tasksOf(res, date).reduce(function (s, t) { return s + (t.estMinutes || 0); }, 0);
  }
  // W2 工作日 10.13（周二）
  assert.ok(total('2026-10-13') <= 40, '工作日应 <=40min: ' + total('2026-10-13'));
  // W2 周末 10.17（真实周六）
  assert.ok(total('2026-10-17') > 100, '周末应明显更长: ' + total('2026-10-17'));
});

test('generatePlan: 每周 B 站网课绑在该周周六', function () {
  store.saveTasks([]);
  var res = engine.generatePlan({ examDate: EXAM });
  ['2026-10-10', '2026-10-17', '2026-10-24', '2026-10-31', '2026-11-07',
   '2026-11-14', '2026-11-21', '2026-11-28'].forEach(function (sat) {
    var hasCourse = tasksOf(res, sat).some(function (t) { return t.title.indexOf('网课') === 0; });
    assert.ok(hasCourse, sat + '（周六）应含网课任务');
  });
  // W10（12.8–12.11）文档明确不安排网课
  var w10 = tasksOf(res, '2026-12-10').some(function (t) { return t.title.indexOf('网课') === 0; });
  assert.ok(!w10, 'W10 不应有网课');
});

// ————————————————————————————————————————
// 三、启动日约定：10.08 之前不排任务（国庆假期另有安排）
// ————————————————————————————————————————
test('generatePlan: 国庆 10.01–10.07 不排任务（正式启动日 10.08）', function () {
  store.saveTasks([]);
  var res = engine.generatePlan({ examDate: EXAM });
  for (var dt = '2026-10-01'; dt <= '2026-10-07'; dt = d.addDays(dt, 1)) {
    assert.strictEqual(tasksOf(res, dt).length, 0, dt + ' 不应有任务');
  }
});

test('generatePlan: 第一个任务日就是启动日 10.08', function () {
  store.saveTasks([]);
  var res = engine.generatePlan({ examDate: EXAM });
  assert.ok(res.tasks.length > 0);
  var first = res.tasks.map(function (t) { return t.planDate; }).sort()[0];
  assert.strictEqual(first, '2026-10-08');
});

test('generatePlan: note 提示启动日与空档区间（启动日之前才提示）', function () {
  store.saveTasks([]);
  var res = engine.generatePlan({ examDate: EXAM });
  if (d.todayStr() < '2026-10-08') {
    assert.ok(res.note.indexOf('2026-10-08') !== -1, 'note 应提示启动日: ' + res.note);
  }
});

// ————————————————————————————————————————
// 四、通用生成（计划区间之外，用远期考期验证兜底逻辑）
// ————————————————————————————————————————
test('generatePlan(远期): 基础期普通日 = 词汇/听力/阅读/仿写 四件套', function () {
  store.saveTasks([]);
  var res = engine.generatePlan({ examDate: EXAM_FAR });
  var dt = '2026-12-12';
  while (d.dayOfWeek(dt) === 0) dt = d.addDays(dt, 1); // 跳过周日
  var types = tasksOf(res, dt).map(function (t) { return t.type; });
  // 长模板（W5-10，120min 档）会额外带翻译与复盘，故只断言"包含"四件套
  ['vocab', 'listen', 'read', 'write'].forEach(function (x) {
    assert.ok(types.indexOf(x) !== -1, dt + ' 应包含 ' + x + ': ' + types.join(','));
  });
});

test('generatePlan(远期): 非模考期的周日只排一条"周小测与复盘"', function () {
  store.saveTasks([]);
  var res = engine.generatePlan({ examDate: EXAM_FAR });
  var dt = '2026-12-12';
  while (d.dayOfWeek(dt) !== 0) dt = d.addDays(dt, 1); // 找基础期内的周日
  var day = tasksOf(res, dt);
  assert.strictEqual(day.length, 1, dt + ' 周日应只有一条: ' + day.length);
  assert.strictEqual(day[0].type, 'review');
});

test('generatePlan(远期): 模考首日只有一条限时模考任务', function () {
  store.saveTasks([]);
  var res = engine.generatePlan({ examDate: EXAM_FAR });
  var first = engine.stages(EXAM_FAR).mock.start;
  var day = tasksOf(res, first);
  assert.strictEqual(day.length, 1);
  assert.strictEqual(day[0].type, 'mock');
});

// ————————————————————————————————————————
// 五、通用约束（任何考期都成立）
// ————————————————————————————————————————
test('generatePlan: 所有任务落在 [今天, 考试前一天]，考试当天不排任务', function () {
  store.saveTasks([]);
  var res = engine.generatePlan({ examDate: EXAM });
  var today = d.todayStr();
  assert.ok(res.tasks.length > 0);
  res.tasks.forEach(function (t) {
    assert.ok(d.diffDays(today, t.planDate) >= 0, '任务不早于今天: ' + t.planDate);
    assert.ok(d.diffDays(t.planDate, EXAM) > 0, '任务早于考试日: ' + t.planDate);
  });
});

test('generatePlan: 每个任务都带耗时、时段与内容指针（无"背单词"式模糊）', function () {
  store.saveTasks([]);
  var res = engine.generatePlan({ examDate: EXAM });
  res.tasks.forEach(function (t) {
    assert.ok(typeof t.estMinutes === 'number' && t.estMinutes > 0, '缺耗时: ' + t.title);
    assert.ok(t.contentRef && t.contentRef.length > 0, '缺内容指针: ' + t.title);
    assert.ok(t.slot && t.slot.length > 0, '缺时段: ' + t.title);
  });
});

// ————————————————————————————————————————
// 六、完成钩子与顺延
// ————————————————————————————————————————
test('afterComplete: 词汇任务完成 -> 生成 +2 天复习任务，且不重复生成', function () {
  store.saveTasks([]);
  store.saveProfile({ examDate: EXAM });
  var vocab = {
    id: 'v1', title: '词汇', type: 'vocab', planDate: '2026-10-20',
    stage: 'basic', contentRef: '刘晓燕48课 U5L1'
  };
  engine.afterComplete(vocab);
  var reviews = store.getTasks().filter(function (t) { return t.reviewOf === 'v1'; });
  assert.strictEqual(reviews.length, 1);
  assert.strictEqual(reviews[0].planDate, '2026-10-22');
  assert.strictEqual(reviews[0].contentRef, '刘晓燕48课 U5L1');

  engine.afterComplete(vocab); // 第二次不重复
  reviews = store.getTasks().filter(function (t) { return t.reviewOf === 'v1'; });
  assert.strictEqual(reviews.length, 1);
});

test('afterComplete: 非词汇任务不生成复习', function () {
  store.saveTasks([]);
  store.saveProfile({ examDate: EXAM });
  engine.afterComplete({ id: 'r1', type: 'read', planDate: '2026-10-20', stage: 'basic' });
  assert.strictEqual(store.getTasks().length, 0);
});

test('postpone: 普通任务顺延恰好 +1 天', function () {
  store.saveTasks([]);
  var t = store.addTask({
    id: 'p1', title: 'x', type: 'read', planDate: '2026-10-20',
    estMinutes: 20, status: 0, stage: 'basic', source: 'plan108', createdAt: 1
  });
  engine.postpone(t);
  assert.strictEqual(store.getTask('p1').planDate, '2026-10-21');
});

test('postpone: 考试前一天的任务不会被推到考试日之后（截断）', function () {
  store.saveTasks([]);
  store.saveProfile({ examDate: EXAM });
  var last = d.addDays(EXAM, -1); // 2026-12-11
  var t = store.addTask({
    id: 'p2', title: 'x', type: 'read', planDate: last,
    estMinutes: 20, status: 0, stage: 'mock', source: 'plan108', createdAt: 1
  });
  engine.postpone(t);
  assert.strictEqual(store.getTask('p2').planDate, last, '应被截断到考试前一天');
});

// ————————————————————————————————————————
// 七、regeneratePlan：我的 / 规划 / 向导 三入口共用的重排入口
// 不变量：清掉所有"规划生成"任务（engine/plan108/phase15/transition）、保留 manual、
//        批量写入一次、更新 planStart —— 替代此前三处散写各写一遍（易导致 N+1 写入与翻倍）
// ————————————————————————————————————————
test('regeneratePlan: 清生成任务、留手动、批量写入、更新 planStart', function () {
  store.saveTasks([]);
  store.saveProfile({ examDate: EXAM });
  // 模拟"已生成过一次 + 手动加了一条"：含旧 plan108、旧 engine、手动
  store.addTask({ id: 'old-p', title: '旧计划任务', type: 'vocab', planDate: '2026-10-08', source: 'plan108' });
  store.addTask({ id: 'old-e', title: '旧通用任务', type: 'read', planDate: '2026-10-09', source: 'engine' });
  store.addTask({ id: 'm1', title: '我的手动任务', type: 'write', planDate: '2026-10-10', source: 'manual' });
  assert.strictEqual(store.getTasks().length, 3);

  var res = engine.regeneratePlan(store.getProfile());

  // 旧生成任务被清、手动保留
  assert.strictEqual(store.getTask('old-p'), null, '旧 plan108 应被清');
  assert.strictEqual(store.getTask('old-e'), null, '旧 engine 应被清');
  assert.ok(store.getTask('m1'), '手动任务应保留');

  // 落盘 = 手动1 + 新生成（批量写入一次，无旧残留、无翻倍）
  var all = store.getTasks();
  assert.strictEqual(all.length, 1 + res.tasks.length, '手动1 + 新生成: ' + all.length);
  assert.ok(res.tasks.length > 50, '应重新生成大量任务: ' + res.tasks.length);
  assert.ok(typeof res.note === 'string' && res.note.length > 0, '应返回 note 供 UI 展示');

  // planStart 更新为今天
  assert.strictEqual(store.getProfile().planStart, d.todayStr(), 'planStart 应更新为今天');

  // 新任务均不早于启动日 10.08
  all.forEach(function (t) {
    if (t.id === 'm1') return;
    assert.ok(d.diffDays('2026-10-08', t.planDate) >= 0, '新任务不应早于启动日: ' + t.planDate);
  });
});

test('regeneratePlan: 重复执行不翻倍（幂等）', function () {
  store.saveTasks([]);
  store.saveProfile({ examDate: EXAM });
  engine.regeneratePlan(store.getProfile());
  var first = store.getTasks().length;
  engine.regeneratePlan(store.getProfile());
  var second = store.getTasks().length;
  assert.strictEqual(first, second, '重复重生成任务数应一致，不应翻倍: ' + first + ' vs ' + second);
});
