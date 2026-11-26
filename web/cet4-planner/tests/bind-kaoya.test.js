// seam: engine.bindKaoyaTVCourses —— 烤鸭TV课程排期绑定听力任务
// 现状：10.08–12.11 由《10.8启动计划》覆盖，听力任务已自带精确指针（华研篇号 / 网课），
//       绑定器只作用于 source==='engine' 的通用听力任务（计划区间之外）
require('./helpers/wx-mock.js');
var test = require('node:test');
var assert = require('node:assert');
var engine = require('../utils/engine.js');
var store = require('../utils/store.js');
var d = require('../utils/date.js');

var EXAM = '2026-12-12';
var EXAM_FAR = '2027-02-01'; // 远期考期：12.12 之后落到通用生成，才有 engine 听力任务

function seedPlan(examDate) {
  store.clearAll();
  store.saveProfile({ examDate: examDate, planStart: d.todayStr() });
  var res = engine.generatePlan({ examDate: examDate });
  res.tasks.forEach(function (t) { store.addTask(t); });
}

function listenSorted() {
  return store.getTasks()
    .filter(function (t) { return t.source === 'engine' && t.type === 'listen'; })
    .sort(function (a, b) { return a.planDate < b.planDate ? -1 : 1; });
}

function planListen() {
  return store.getTasks().filter(function (t) {
    return t.type === 'listen' && t.source === 'plan108';
  });
}

test('烤鸭TV绑定：不破坏启动计划听力任务自带的精确指针', function () {
  seedPlan(EXAM);
  var before = planListen().map(function (t) { return t.planDate + '|' + t.contentRef; }).sort();
  assert.ok(before.length > 0, '计划里应有听力任务');
  engine.bindKaoyaTVCourses();
  var after = planListen().map(function (t) { return t.planDate + '|' + t.contentRef; }).sort();
  assert.deepStrictEqual(after, before, '计划听力指针不被覆盖');
});

test('烤鸭TV绑定：计划覆盖期内无 engine 听力任务（bound=0 且安全）', function () {
  seedPlan(EXAM);
  var res = engine.bindKaoyaTVCourses();
  assert.strictEqual(listenSorted().length, 0, '10.8–12.11 由计划覆盖，无 engine 听力任务');
  assert.strictEqual(res.bound, 0);
});

test('烤鸭TV绑定（远期考期）：通用听力任务拿到烤鸭TV 课程', function () {
  seedPlan(EXAM_FAR);
  var res = engine.bindKaoyaTVCourses();
  var targets = listenSorted();
  assert.ok(targets.length > 0, '远期考期下应有通用听力任务');
  assert.ok(res.bound > 0);
  targets.forEach(function (t) {
    assert.ok(t.contentRef.indexOf('烤鸭TV') === 0 || t.contentRef.indexOf('华研八合一') === 0,
      '通用听力应绑烤鸭TV/华研分项: ' + t.contentRef);
  });
});

test('烤鸭TV绑定：幂等可重复执行', function () {
  seedPlan(EXAM_FAR);
  var r1 = engine.bindKaoyaTVCourses();
  var r2 = engine.bindKaoyaTVCourses();
  assert.strictEqual(r1.bound, r2.bound);
});
