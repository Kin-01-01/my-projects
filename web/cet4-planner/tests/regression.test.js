// seam: 稳定性回归 —— 本次自检修复的两个真实问题
//  1) postpone 不能把任务推到考试日之后（应截断到考试前一天）
//  2) 重绑刘晓燕48课时，不能清空"艾宾浩斯复习任务"继承的课次指针
require('./helpers/wx-mock.js');
var test = require('node:test');
var assert = require('node:assert');
var engine = require('../utils/engine.js');
var store = require('../utils/store.js');
var d = require('../utils/date.js');

var EXAM = '2026-12-12';

test('postpone: 普通任务顺延恰好 +1 天', function () {
  store.saveTasks([]);
  store.saveProfile({ examDate: EXAM });
  var t = store.addTask({
    id: 'p1', title: 'x', type: 'read', planDate: '2026-10-05',
    estMinutes: 20, status: 0, stage: 'basic', source: 'engine', createdAt: 1
  });
  engine.postpone(t);
  assert.strictEqual(store.getTask('p1').planDate, '2026-10-06');
});

test('postpone: 考试前一天的任务不会被推到考试日之后（截断到考试前一天）', function () {
  store.saveTasks([]);
  store.saveProfile({ examDate: EXAM });
  var last = d.addDays(EXAM, -1); // 2026-12-11
  var t = store.addTask({
    id: 'p2', title: 'x', type: 'read', planDate: last,
    estMinutes: 20, status: 0, stage: 'mock', source: 'engine', createdAt: 1
  });
  engine.postpone(t);
  assert.strictEqual(store.getTask('p2').planDate, last, '应被截断到考试前一天');
});

test('绑定：重绑刘晓燕48课不会清空艾宾浩斯复习任务继承的课次指针', function () {
  store.clearAll();
  store.saveProfile({ examDate: EXAM });
  var res = engine.generatePlan({ examDate: EXAM });
  res.tasks.forEach(function (t) { store.addTask(t); });
  engine.bindLiuXiaoYanLessons();

  // 完成一个"带刘晓燕课次指针"的词汇任务 -> 触发 +2 天复习任务（继承该课次指针）
  // 注意：15 天计划里 9.30 的"词量自测"也是 vocab，但走 App 词库不带课次指针，故按指针筛选
  var vocab = store.getTasks().filter(function (t) {
    return t.type === 'vocab' && /^刘晓燕48课/.test(t.contentRef || '');
  })[0];
  assert.ok(vocab, '存在带课次指针的词汇任务');
  engine.afterComplete(vocab);
  var reviews = store.getTasks().filter(function (t) { return t.reviewOf === vocab.id; });
  assert.strictEqual(reviews.length, 1);
  assert.ok(reviews[0].contentRef.indexOf('刘晓燕48课') === 0, '复习任务应继承课次指针');

  // 再次绑定，复习任务指针不应被清空
  engine.bindLiuXiaoYanLessons();
  var reviews2 = store.getTasks().filter(function (t) { return t.reviewOf === vocab.id; });
  assert.strictEqual(reviews2.length, 1);
  assert.ok(reviews2[0].contentRef.indexOf('刘晓燕48课') === 0, '重绑后复习任务指针仍保留');
});
