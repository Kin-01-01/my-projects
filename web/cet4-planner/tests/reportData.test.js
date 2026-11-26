// 周报/月报数据聚合（纯函数，不依赖 wx）
var test = require('node:test');
var assert = require('node:assert');
var d = require('../utils/date');
var canvasCard = require('../utils/canvasCard');
var plan108 = require('../utils/plan108');

function mkTask(planDate, status, mins) {
  return { planDate: planDate, status: status, estMinutes: mins, stage: 'basic' };
}

test('buildReportData 周报：仅统计窗口内、完成数与分钟正确', function () {
  var end = '2026-12-01';
  var tasks = [
    mkTask(d.addDays(end, 0), 1, 30),   // 今天 完成
    mkTask(d.addDays(end, -1), 1, 40),  // 昨天 完成
    mkTask(d.addDays(end, -6), 0, 50),  // 窗口边界内 未完成
    mkTask(d.addDays(end, -8), 1, 100)  // 窗口外 应被忽略
  ];
  var data = canvasCard.buildReportData(tasks, { range: 'week', endDate: end });
  assert.strictEqual(data.n, 7);
  assert.strictEqual(data.totalDone, 2);
  assert.strictEqual(data.totalMinutes, 70);
  assert.strictEqual(data.days.length, 7);
  // 最大分钟来自 40（昨天），50 那条未完成不计入 done 分钟
  assert.strictEqual(data.maxMin, 40);
});

test('buildReportData 月报：窗口为 30 天', function () {
  var end = '2026-12-01';
  var data = canvasCard.buildReportData([], { range: 'month', endDate: end });
  assert.strictEqual(data.n, 30);
  assert.strictEqual(data.days.length, 30);
  assert.strictEqual(data.start, d.addDays(end, -29));
});

test('buildPlanTemplateData：三阶段 + 跨度，不含个人数据', function () {
  var data = canvasCard.buildPlanTemplateData(plan108);
  assert.strictEqual(data.stages.length, 3);
  assert.strictEqual(data.span, d.diffDays(plan108.START, plan108.END) + 1);
  assert.strictEqual(data.start, plan108.START);
  assert.strictEqual(data.end, plan108.END);
  // 阶段名称应覆盖 基础/专项/模考
  var names = data.stages.map(function (s) { return s.name; }).join('');
  assert.ok(/基础/.test(names) && /专项/.test(names) && /模考/.test(names));
});
