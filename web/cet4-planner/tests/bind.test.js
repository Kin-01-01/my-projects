// seam: engine.bindLiuXiaoYanLessons —— 48课编号续接绑定
// 现状：10.08–12.11 由《10.8启动计划》覆盖，词汇任务已自带"刘晓燕48课 UxLy"指针，
//       绑定器的职责退化为"不破坏已有指针 + 无通用任务时安全返回"
require('./helpers/wx-mock.js');
var test = require('node:test');
var assert = require('node:assert');
var engine = require('../utils/engine.js');
var store = require('../utils/store.js');

var EXAM = '2026-12-12';

function seedPlan() {
  store.clearAll();
  store.saveProfile({ examDate: EXAM });
  var res = engine.generatePlan({ examDate: EXAM });
  res.tasks.forEach(function (t) { store.addTask(t); });
}

function planVocab() {
  return store.getTasks().filter(function (t) {
    return t.type === 'vocab' && t.source === 'plan108';
  });
}

test('绑定：幂等，重复执行结果一致', function () {
  seedPlan();
  var r1 = engine.bindLiuXiaoYanLessons();
  var r2 = engine.bindLiuXiaoYanLessons();
  assert.strictEqual(r1.bound, r2.bound);
});

test('绑定：不破坏启动计划词汇任务自带的课次指针', function () {
  seedPlan();
  var before = planVocab().map(function (t) { return t.planDate + '|' + t.contentRef; }).sort();
  assert.ok(before.length > 0, '计划里应有词汇任务');
  engine.bindLiuXiaoYanLessons();
  var after = planVocab().map(function (t) { return t.planDate + '|' + t.contentRef; }).sort();
  assert.deepStrictEqual(after, before, '计划词汇指针不被清空');
});

test('绑定：计划覆盖全部学习日时无 engine 词汇任务可绑（bound=0 且不报错）', function () {
  seedPlan();
  var res = engine.bindLiuXiaoYanLessons();
  var engineVocab = store.getTasks().filter(function (t) {
    return t.type === 'vocab' && t.source === 'engine';
  });
  assert.strictEqual(engineVocab.length, 0, '10.8–12.11 由计划覆盖，无 engine 词汇任务');
  assert.strictEqual(res.bound, 0);
});

test('绑定：返回的 unbound 是未被占用的课次编号，且不超过 48', function () {
  seedPlan();
  var res = engine.bindLiuXiaoYanLessons();
  assert.ok(Array.isArray(res.unbound));
  assert.ok(res.unbound.length <= 48);
  res.unbound.forEach(function (u) {
    assert.ok(/^U\d+L\d+$/.test(u), '课次编号格式: ' + u);
  });
});
