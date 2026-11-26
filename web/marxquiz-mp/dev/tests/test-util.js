/**
 * QA 独立验证：utils/util.js 判分逻辑 + utils/theme.js 纯逻辑
 */
'use strict';

var path = require('path');
var util = require(path.resolve('D:/03_项目归档/MarxQuiz MP', 'utils', 'util.js'));

var pass = 0, fail = 0, failures = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); console.log('  FAIL  ' + name + (detail ? '  <-- ' + detail : '')); }
}
function eq(name, a, e) { ok(name, JSON.stringify(a) === JSON.stringify(e), 'expected=' + JSON.stringify(e) + ' actual=' + JSON.stringify(a)); }
function section(t) { console.log('\n=== ' + t + ' ==='); }

/* ---------------- B1. multiple 顺序无关 ---------------- */
section('B1 multiple 判分顺序无关');
var multiQ = { type: 'multiple', answer: ['A', 'C'], options: [{ key: 'A' }, { key: 'B' }, { key: 'C' }] };
eq('B1 ["A","C"] 正确', util.gradeAnswer(multiQ, ['A', 'C']), true);
eq('B1 ["C","A"] 也正确', util.gradeAnswer(multiQ, ['C', 'A']), true);
eq('B1 ["A","B","C"] 多选判错', util.gradeAnswer(multiQ, ['A', 'B', 'C']), false);
eq('B1 ["A"] 少选判错', util.gradeAnswer(multiQ, ['A']), false);
eq('B1 [] 未作答判错', util.gradeAnswer(multiQ, []), false);
eq('B1 null 未作答判错', util.gradeAnswer(multiQ, null), false);
eq('B1 传字符串 "A,C" 判错（接口要求数组）', util.gradeAnswer(multiQ, 'A,C'), false);

/* ---------------- B2. fill 忽略空格与大小写 ---------------- */
section('B2 fill 忽略首尾空格与大小写');
var fillQ = { type: 'fill', answer: ['Not Found', '未找到'] };
eq('B2 完全一致', util.gradeAnswer(fillQ, 'Not Found'), true);
eq('B2 全小写', util.gradeAnswer(fillQ, 'not found'), true);
eq('B2 首尾空格', util.gradeAnswer(fillQ, '  not found  '), true);
eq('B2 中文答案', util.gradeAnswer(fillQ, ' 未找到 '), true);
eq('B2 错误答案', util.gradeAnswer(fillQ, 'nope'), false);
eq('B2 空字符串判错', util.gradeAnswer(fillQ, ''), false);
eq('B2 纯空格判错', util.gradeAnswer(fillQ, '   '), false);
eq('B2 null 判错', util.gradeAnswer(fillQ, null), false);

/* ---------------- B3. judge ---------------- */
section('B3 judge 用 A/B 比对');
var judgeQ = { type: 'judge', answer: 'A', options: [{ key: 'A', text: '正确' }, { key: 'B', text: '错误' }] };
eq('B3 "A" 正确', util.gradeAnswer(judgeQ, 'A'), true);
eq('B3 "B" 判错', util.gradeAnswer(judgeQ, 'B'), false);
eq('B3 "" 判错', util.gradeAnswer(judgeQ, ''), false);
eq('B3 "对" 判错（judge 只认 A/B）', util.gradeAnswer(judgeQ, '对'), false);
var judgeQ2 = { type: 'judge', answer: 'B' };
eq('B3 答案 B 选 B 正确', util.gradeAnswer(judgeQ2, 'B'), true);

/* ---------------- B4. single ---------------- */
section('B4 single 判分');
var singleQ = { type: 'single', answer: 'B' };
eq('B4 "B" 正确', util.gradeAnswer(singleQ, 'B'), true);
eq('B4 "A" 判错', util.gradeAnswer(singleQ, 'A'), false);
eq('B4 "" 判错', util.gradeAnswer(singleQ, ''), false);
eq('B4 null 判错', util.gradeAnswer(singleQ, null), false);
eq('B4 小写 "b" 判错（大小写敏感）', util.gradeAnswer(singleQ, 'b'), false);

/* ---------------- B5. 健壮性 ---------------- */
section('B5 非法入参不抛异常');
var bad = [null, undefined, 0, '', [], 'str', {}];
bad.forEach(function (v, i) {
  var threw = null, res;
  try { res = util.gradeAnswer(v, 'A'); } catch (e) { threw = e; }
  ok('B5 gradeAnswer(q=' + JSON.stringify(v) + ') 不抛异常且返回 false', threw === null && res === false, String(threw) + ' res=' + res);
});
var threw2 = null;
try { util.gradeAnswer({ type: 'multiple', answer: null }, null); } catch (e) { threw2 = e; }
ok('B5 answer 为 null 的 multiple 不抛异常', threw2 === null, String(threw2));

/* ---------------- B6. formatAnswer / formatUserAnswer ---------------- */
section('B6 展示文本');
eq('B6 formatAnswer multiple', util.formatAnswer({ type: 'multiple', answer: ['A', 'C'] }), 'A、C');
eq('B6 formatAnswer fill', util.formatAnswer({ type: 'fill', answer: ['x', 'y'] }), 'x / y');
eq('B6 formatAnswer single', util.formatAnswer({ type: 'single', answer: 'B' }), 'B');
eq('B6 formatUserAnswer 未作答(多选空)', util.formatUserAnswer({ type: 'multiple' }, []), '未作答');
eq('B6 formatUserAnswer 未作答(填空空)', util.formatUserAnswer({ type: 'fill' }, '  '), '未作答');

/* ---------------- B7. 其他工具函数 ---------------- */
section('B7 其他工具函数');
eq('B7 formatClock(60)', util.formatClock(60), '01:00');
eq('B7 formatClock(3600)', util.formatClock(3600), '60:00');
eq('B7 formatClock(-5)', util.formatClock(-5), '00:00');
eq('B7 typeLabel', util.typeLabel('multiple'), '多选');
eq('B7 truncate', util.truncate('abcdefghij', 4), 'abcd…');
eq('B7 shuffle 长度不变', util.shuffle([1, 2, 3, 4, 5]).length, 5);
eq('B7 shuffle 不修改原数组', (function () { var a = [1, 2, 3]; util.shuffle(a); return a; })(), [1, 2, 3]);
eq('B7 formatSize(2048)', util.formatSize(2048), '2.0 MB');

console.log('\n----------------------------------------');
console.log('util 单测结果：PASS ' + pass + ' / FAIL ' + fail + ' / TOTAL ' + (pass + fail));
if (failures.length) { console.log('失败用例：'); failures.forEach(function (f) { console.log('  - ' + f); }); }
console.log('----------------------------------------');
process.exit(fail === 0 ? 0 : 1);
