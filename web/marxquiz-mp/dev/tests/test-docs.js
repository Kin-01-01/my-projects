/**
 * QA 独立验证：G 文档一致性（README 声称的能力 vs parser.js 实际行为）
 */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve('D:/03_项目归档/MarxQuiz MP');
var parser = require(path.join(ROOT, 'utils', 'parser.js'));

var pass = 0, fail = 0, failures = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); console.log('  FAIL  ' + name + (detail ? '  <-- ' + detail : '')); }
}
function eq(name, a, e) { ok(name, JSON.stringify(a) === JSON.stringify(e), 'expected=' + JSON.stringify(e) + ' actual=' + JSON.stringify(a)); }
function section(t) { console.log('\n=== ' + t + ' ==='); }
function P(t) { return parser.parse(t); }

/* README L123：options 三种写法 */
section('G1 README L123 options 三种写法');
(function () {
  var r1 = P(JSON.stringify([{ type: 'single', stem: 'A 形式', options: [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }], answer: 'A' }]));
  eq('G1 [{key,text}] 形式', r1.questions[0] && r1.questions[0].options, [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }]);

  var r2 = P(JSON.stringify([{ type: 'single', stem: 'B 形式', options: ['甲', '乙', '丙'], answer: 'B' }]));
  eq('G1 ["甲","乙","丙"] 形式', r2.questions[0] && r2.questions[0].options,
    [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }, { key: 'C', text: '丙' }]);

  var r3 = P(JSON.stringify([{ type: 'single', stem: 'C 形式', options: { A: '甲', B: '乙' }, answer: 'A' }]));
  eq('G1 {"A":"甲","B":"乙"} 形式', r3.questions[0] && r3.questions[0].options,
    [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }]);

  var r4 = P(JSON.stringify([{ type: 'single', stem: 'D 形式', A: '甲', B: '乙', answer: 'A' }]));
  eq('G1 独立字段 A/B 形式', r4.questions[0] && r4.questions[0].options,
    [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }]);

  var r5 = P(JSON.stringify([{ type: 'single', stem: 'E 形式', optionA: '甲', optionB: '乙', answer: 'A' }]));
  eq('G1 optionA/optionB 形式', r5.questions[0] && r5.questions[0].options,
    [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }]);

  var r6 = P(JSON.stringify([{ type: 'single', stem: 'F 形式', '选项A': '甲', '选项B': '乙', answer: 'A' }]));
  eq('G1 选项A/选项B 形式', r6.questions[0] && r6.questions[0].options,
    [{ key: 'A', text: '甲' }, { key: 'B', text: '乙' }]);
})();

/* README L121：type 可写中文 */
section('G2 README L121 中文题型');
(function () {
  ['单选', '多选', '判断', '填空'].forEach(function (t, i) {
    var expect = ['single', 'multiple', 'judge', 'fill'][i];
    var q = { type: t, stem: '中文题型 ' + t, answer: expect === 'multiple' ? 'AB' : (expect === 'judge' ? '正确' : (expect === 'fill' ? '答案' : 'A')) };
    if (expect === 'single' || expect === 'multiple') q.options = [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }];
    var r = P(JSON.stringify([q]));
    eq('G2 题型「' + t + '」-> ' + expect, r.questions[0] && r.questions[0].type, expect);
  });
})();

/* README L126：tags 可写字符串 */
section('G3 README L126 tags 字符串');
(function () {
  var r = P(JSON.stringify([{ type: 'judge', stem: 'tags 字符串', answer: 'A', tags: '计算机,基础' }]));
  eq('G3 "计算机,基础" -> 2 个标签', r.questions[0] && r.questions[0].tags, ['计算机', '基础']);
})();

/* README L128：id 自动生成且稳定 */
section('G4 README L128 id 自动生成且重复导入稳定');
(function () {
  var raw = fs.readFileSync(path.join(ROOT, 'sample', 'bank-sample.json'), 'utf8');
  var a = P(raw).questions.map(function (q) { return q.id; });
  var b = P(raw).questions.map(function (q) { return q.id; });
  eq('G4 两次解析 id 完全一致', a, b);
  ok('G4 id 形如 q_序号_hash', /^q_\d+_[0-9a-z]+$/.test(a[0]), a[0]);
  eq('G4 id 无重复', a.length, a.filter(function (v, i, arr) { return arr.indexOf(v) === i; }).length);
})();

/* README L177：题号行四种写法 */
section('G5 README L177 题号行四种写法');
(function () {
  ['1. ', '1、', '(1) ', '第1题 '].forEach(function (prefix) {
    var txt = prefix + '题干内容\nA. 甲\nB. 乙\n答案：A';
    var r = P(txt);
    eq('G5 题号「' + prefix.trim() + '」可解析', r.questions.length, 1);
    eq('G5 题号「' + prefix.trim() + '」题干正确', r.questions[0] && r.questions[0].stem, '题干内容');
  });
})();

/* README L178：选项行五种写法 */
section('G6 README L178 选项行五种写法');
(function () {
  ['A. ', 'A、', 'A) ', 'A．', 'A: '].forEach(function (prefix) {
    var txt = '1. 题干\n' + prefix + '甲\nB. 乙\n答案：A';
    var r = P(txt);
    eq('G6 选项「' + prefix.trim() + '」可解析', r.questions.length, 1);
    eq('G6 选项「' + prefix.trim() + '」文本正确', r.questions[0] && r.questions[0].options[0].text, '甲');
  });
})();

/* README L179：答案行写法 */
section('G7 README L179 答案行写法');
(function () {
  ['答案：A', '答案:A', '正确答案：A'].forEach(function (line) {
    var r = P('1. 题干\nA. 甲\nB. 乙\n' + line);
    eq('G7 「' + line + '」-> A', r.questions[0] && r.questions[0].answer, 'A');
  });
  var r2 = P('1. 多选\nA. 甲\nB. 乙\nC. 丙\n答案：AB');
  eq('G7 「答案：AB」多选连写', r2.questions[0] && r2.questions[0].answer, ['A', 'B']);
})();

/* README L180：解析多行 */
section('G8 README L180 解析可多行');
(function () {
  var txt = '1. 题干\nA. 甲\nB. 乙\n答案：A\n解析：第一行解析\n第二行解析';
  var r = P(txt);
  ok('G8 多行解析合并', /第一行解析/.test(r.questions[0].analysis) && /第二行解析/.test(r.questions[0].analysis), r.questions[0].analysis);
})();

/* README L181：无选项 -> 填空；两项正确/错误 -> 判断 */
section('G9 README L181 题型自动推断');
(function () {
  var r1 = P('1. 无选项的题\n答案：某答案');
  eq('G9 无选项 -> fill', r1.questions[0] && r1.questions[0].type, 'fill');

  var r2 = P('1. 两个选项是正确/错误\nA. 正确\nB. 错误\n答案：A');
  eq('G9 两项「正确/错误」-> judge', r2.questions[0] && r2.questions[0].type, 'judge');

  var r3 = P('1. 两个选项是对/错\nA. 对\nB. 错\n答案：A');
  eq('G9 两项「对/错」-> judge', r3.questions[0] && r3.questions[0].type, 'judge');

  var r4 = P('1. 两个普通选项\nA. 甲\nB. 乙\n答案：A');
  eq('G9 两个普通选项 -> single', r4.questions[0] && r4.questions[0].type, 'single');
})();

/* README L182：章节标题继承题型 */
section('G10 README L182 章节标题继承题型');
(function () {
  var txt = '一、单选题\n1. 题一\nA. 甲\nB. 乙\n答案：A\n二、判断题\n2. 题二\n答案：对';
  var r = P(txt);
  eq('G10 第1题 single', r.questions[0] && r.questions[0].type, 'single');
  eq('G10 第2题 judge', r.questions[1] && r.questions[1].type, 'judge');
})();

/* README L198：CSV 引号转义 */
section('G11 README L198 CSV 引号转义 ""');
(function () {
  var csv = '题型,题干,选项A,选项B,选项C,选项D,答案,解析,标签\n' +
    '单选题,"下列属于""前端""技术的有？",HTML,CSS,SQL,Python,B,"含""引号""的解析",前端';
  var r = P(csv);
  eq('G11 解析题数=1', r.questions.length, 1);
  eq('G11 题干还原双引号', r.questions[0] && r.questions[0].stem, '下列属于"前端"技术的有？');
  eq('G11 解析还原双引号', r.questions[0] && r.questions[0].analysis, '含"引号"的解析');
})();

/* README L197：CSV 表头容错 */
section('G12 README L197 CSV 表头容错');
(function () {
  var csv1 = 'type,stem,optionA,optionB,optionC,optionD,answer,analysis,tags\n' +
    'single,英文表头题,甲,乙,丙,丁,B,英文解析,标签1';
  var r1 = P(csv1);
  eq('G12 英文表头 optionA~D', r1.questions.length, 1);
  eq('G12 英文表头答案', r1.questions[0] && r1.questions[0].answer, 'B');

  var csv2 = '题型,题目,A,B,C,D,答案,解析\n单选题,短表头题,甲,乙,丙,丁,C,解析X';
  var r2 = P(csv2);
  eq('G12 短表头 A~D', r2.questions.length, 1);
  eq('G12 短表头答案', r2.questions[0] && r2.questions[0].answer, 'C');

  var csv3 = '题型,question,选项A,选项B,答案\n单选题,混合表头题,甲,乙,A';
  var r3 = P(csv3);
  eq('G12 中英混合表头', r3.questions.length, 1);
})();

/* README L404：Node 单行测试命令 */
section('G13 README L404 Node 直接测试命令');
(function () {
  var r = P('1. 题干\nA. 甲\nB. 乙\n答案：A');
  ok('G13 命令里的输入能解析出 1 题', r.questions.length === 1, JSON.stringify(r.errors));
  eq('G13 题型 single', r.questions[0] && r.questions[0].type, 'single');
})();

/* README L389 零网络 / L390 零图片 */
section('G14 README L389-L390 零网络 / 零图片 / 零依赖');
(function () {
  var banned = ['wx.request', 'wx.cloud', 'wx.login', 'wx.uploadFile', 'wx.downloadFile'];
  var hits = [];
  var imgs = [];
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
      var f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f);
      else {
        if (/\.(js|wxml|json)$/.test(e.name)) {
          var txt = fs.readFileSync(f, 'utf8');
          banned.forEach(function (b) { if (txt.indexOf(b) >= 0) hits.push(path.basename(f) + ':' + b); });
        }
        if (/\.(png|jpg|jpeg|gif|svg|webp)$/i.test(e.name)) imgs.push(e.name);
      }
    });
  })(ROOT);
  ok('G14 无 wx.request / wx.cloud / wx.login / wx.uploadFile / wx.downloadFile', hits.length === 0, hits.join(' | '));
  ok('G14 无图片资源文件', imgs.length === 0, imgs.join(', '));
  ok('G14 无 package.json / node_modules（零依赖）',
    !fs.existsSync(path.join(ROOT, 'package.json')) && !fs.existsSync(path.join(ROOT, 'node_modules')));
})();

/* README L358-L381 目录结构 */
section('G15 README L356-L382 目录结构与实际文件一致');
(function () {
  var listed = ['app.js', 'app.json', 'app.wxss', 'theme.json', 'project.config.json',
    'project.private.config.json', 'sitemap.json', 'README.md',
    'utils/parser.js', 'utils/store.js', 'utils/theme.js', 'utils/util.js', 'utils/sample.js', 'utils/builtin-banks.js',
    'HANDOFF.md', 'custom-tab-bar/index.js', 'custom-tab-bar/index.json', 'custom-tab-bar/index.wxml', 'custom-tab-bar/index.wxss',
    'sample/bank-sample.json', 'sample/bank-sample.txt', 'tools/convert.py'];
  listed.forEach(function (f) {
    ok('G15 README 列出的 ' + f + ' 实际存在', fs.existsSync(path.join(ROOT, f)));
  });
  ['index', 'import', 'practice', 'result', 'wrong', 'settings'].forEach(function (p) {
    ok('G15 README 列出的 pages/' + p + ' 实际存在', fs.existsSync(path.join(ROOT, 'pages', p)));
  });
  // README 未列出但实际存在的文件（应只有 pages 四件套）
  var actual = [];
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
      var f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f);
      else actual.push(path.relative(ROOT, f).replace(/\\/g, '/'));
    });
  })(ROOT);
  var unlisted = actual.filter(function (f) {
    if (listed.indexOf(f) >= 0) return false;
    if (/^pages\/[a-z]+\/[a-z]+\.(js|json|wxml|wxss)$/.test(f)) return false;
    if (/^utils\/banks\/bank-\d{2}\.js$/.test(f)) return false;
    return true;
  });
  ok('G15 无 README 未提及的多余文件', unlisted.length === 0, unlisted.join(', '));
  eq('G15 交付文件总数=53', actual.length, 53);
})();

/* README L391-L400 存储 key 约定 */
section('G16 README L391-L400 存储 key 与 store.js 一致');
(function () {
  var storeTxt = fs.readFileSync(path.join(ROOT, 'utils', 'store.js'), 'utf8');
  var keys = ['qb:list', 'qb:data:', 'qb:progress:', 'qb:wrong:', 'qb:fav:', 'qb:stat:', 'app:settings', 'app:meta'];
  keys.forEach(function (k) {
    ok('G16 store.js 使用 ' + k, storeTxt.indexOf(k) >= 0);
  });
  var themeTxt = fs.readFileSync(path.join(ROOT, 'utils', 'theme.js'), 'utf8');
  ok('G16 app:theme 在 theme.js 中定义', themeTxt.indexOf("'app:theme'") >= 0);
})();

console.log('\n----------------------------------------');
console.log('文档一致性结果：PASS ' + pass + ' / FAIL ' + fail + ' / TOTAL ' + (pass + fail));
if (failures.length) { console.log('失败用例：'); failures.forEach(function (f) { console.log('  - ' + f); }); }
console.log('----------------------------------------');
process.exit(fail === 0 ? 0 : 1);
