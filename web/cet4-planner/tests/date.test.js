// seam: utils/date.js 的公共接口（日期算术是全应用的地基）
require('./helpers/wx-mock.js');
var test = require('node:test');
var assert = require('node:assert');
var d = require('../utils/date.js');

test('diffDays: 已知日期差为独立事实（2026-09-28 -> 2026-12-12 = 75 天）', function () {
  assert.strictEqual(d.diffDays('2026-09-28', '2026-12-12'), 75);
});

test('diffDays: 同一天为 0，逆序为负', function () {
  assert.strictEqual(d.diffDays('2026-12-12', '2026-12-12'), 0);
  assert.strictEqual(d.diffDays('2026-12-12', '2026-09-28'), -75);
});

test('addDays: 跨月/跨年边界', function () {
  assert.strictEqual(d.addDays('2026-09-28', 3), '2026-10-01');
  assert.strictEqual(d.addDays('2026-12-11', 1), '2026-12-12');
  assert.strictEqual(d.addDays('2026-01-01', -1), '2025-12-31');
});

test('addDays 与 diffDays 互逆', function () {
  assert.strictEqual(d.diffDays('2026-09-28', d.addDays('2026-09-28', 42)), 42);
});

test('dayOfWeek: 2026-09-28 是周一，2026-10-04 是周日', function () {
  assert.strictEqual(d.dayOfWeek('2026-09-28'), 1);
  assert.strictEqual(d.dayOfWeek('2026-10-04'), 0);
});

test('pad: 个位数补零', function () {
  assert.strictEqual(d.pad(3), '03');
  assert.strictEqual(d.pad(12), '12');
});
