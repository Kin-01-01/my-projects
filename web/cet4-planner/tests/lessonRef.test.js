var test = require('node:test');
var assert = require('node:assert');
var L = require('../utils/lessonRef');

test('toLabel: 1..48 内正常映射', function () {
  assert.strictEqual(L.toLabel(1), '刘晓燕48课 U1L1');
  assert.strictEqual(L.toLabel(4), '刘晓燕48课 U1L4');
  assert.strictEqual(L.toLabel(5), '刘晓燕48课 U2L1');
  assert.strictEqual(L.toLabel(8), '刘晓燕48课 U2L4');
  assert.strictEqual(L.toLabel(48), '刘晓燕48课 U12L4');
});

test('toLabel: 越界自动循环回 1..48', function () {
  assert.strictEqual(L.toLabel(0), '刘晓燕48课 U12L4');  // (0-1)%48+48 -> 47 -> +1 -> 48
  assert.strictEqual(L.toLabel(49), '刘晓燕48课 U1L1');
  assert.strictEqual(L.toLabel(50), '刘晓燕48课 U1L2');
});

test('toShortLabel: 不含材料前缀（UuLl）', function () {
  assert.strictEqual(L.toShortLabel(1), 'U1L1');
  assert.strictEqual(L.toShortLabel(10), 'U3L2');
  assert.strictEqual(L.toShortLabel(48), 'U12L4');
});

test('fromRef: 解析课次编号', function () {
  assert.strictEqual(L.fromRef('刘晓燕48课 U1L1'), 1);
  assert.strictEqual(L.fromRef('刘晓燕48课 U3L2'), 10);  // (3-1)*4+2
  assert.strictEqual(L.fromRef('刘晓燕48课 U12L4'), 48);
  assert.strictEqual(L.fromRef('不背单词复习'), null);
  assert.strictEqual(L.fromRef(''), null);
  assert.strictEqual(L.fromRef(null), null);
});

test('toLabel 与 fromRef 互逆（1..48）', function () {
  for (var n = 1; n <= 48; n++) {
    assert.strictEqual(L.fromRef(L.toLabel(n)), n, '互逆失败于 n=' + n);
  }
});
