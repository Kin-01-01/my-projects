/**
 * QA 独立验证：utils/parser.js 真实单元测试
 * 运行：node.exe test-parser.js
 * 不修改交付目录任何文件。
 */
'use strict';

var path = require('path');
var fs = require('fs');

var ROOT = path.resolve('D:/03_项目归档/MarxQuiz MP');
var parser = require(path.join(ROOT, 'utils', 'parser.js'));

var pass = 0;
var fail = 0;
var failures = [];

function ok(name, cond, detail) {
  if (cond) {
    pass++;
    console.log('  PASS  ' + name);
  } else {
    fail++;
    failures.push(name + (detail ? ' :: ' + detail : ''));
    console.log('  FAIL  ' + name + (detail ? '  <-- ' + detail : ''));
  }
}

function eq(name, actual, expected) {
  var a = JSON.stringify(actual);
  var e = JSON.stringify(expected);
  ok(name, a === e, 'expected=' + e + ' actual=' + a);
}

function section(t) {
  console.log('\n=== ' + t + ' ===');
}

/** 安全调用：不允许抛未捕获异常 */
function safeParse(text) {
  try {
    return { threw: null, res: parser.parse(text) };
  } catch (e) {
    return { threw: e, res: null };
  }
}

/* ================================================================== */
/* A1. JSON 数组 3 题                                                  */
/* ================================================================== */
section('A1 JSON 数组（single / multiple / judge）');
(function () {
  var txt = JSON.stringify([
    {
      type: 'single', stem: '1+1=?',
      options: [{ key: 'A', text: '1' }, { key: 'B', text: '2' }],
      answer: 'B', analysis: '基本算术', tags: ['数学'],
    },
    {
      type: 'multiple', stem: '下列哪些是偶数？',
      options: [{ key: 'A', text: '2' }, { key: 'B', text: '3' }, { key: 'C', text: '4' }],
      answer: 'A,C',
    },
    { type: 'judge', stem: '地球是圆的。', answer: '正确' },
  ]);
  var r = safeParse(txt);
  ok('A1 未抛异常', r.threw === null, String(r.threw));
  var res = r.res;
  ok('A1 ok=true', res.ok === true, JSON.stringify(res.errors));
  eq('A1 format=json', res.format, 'json');
  eq('A1 题数=3', res.questions.length, 3);
  eq('A1 题型序列', res.questions.map(function (q) { return q.type; }), ['single', 'multiple', 'judge']);
  eq('A1 single answer', res.questions[0].answer, 'B');
  eq('A1 multiple answer 归一化', res.questions[1].answer, ['A', 'C']);
  eq('A1 judge answer 归一化', res.questions[2].answer, 'A');
  eq('A1 judge options 固定为 正确/错误', res.questions[2].options, [{ key: 'A', text: '正确' }, { key: 'B', text: '错误' }]);
  eq('A1 tags', res.questions[0].tags, ['数学']);
  eq('A1 analysis', res.questions[0].analysis, '基本算术');
  ok('A1 每题都有 id', res.questions.every(function (q) { return /^q_/.test(q.id); }));
})();

/* ================================================================== */
/* A2. JSON 对象（name + questions）                                   */
/* ================================================================== */
section('A2 JSON 对象 name 提取');
(function () {
  var txt = JSON.stringify({
    name: '我的题库 · 测试',
    questions: [
      { stem: '判断题：水是液体', type: 'judge', answer: '对' },
      { stem: '填空题：中国的首都是____', type: 'fill', answer: ['北京'] },
    ],
  });
  var r = safeParse(txt);
  ok('A2 未抛异常', r.threw === null, String(r.threw));
  eq('A2 name', r.res.name, '我的题库 · 测试');
  eq('A2 题数', r.res.questions.length, 2);
  eq('A2 fill 保留数组', r.res.questions[1].answer, ['北京']);
})();

/* ================================================================== */
/* A3. TXT 分段多题连排                                                */
/* ================================================================== */
section('A3 TXT 分段多题连排');
(function () {
  var txt = [
    '1. 下列哪一项是中国的首都？',
    'A. 上海',
    'B. 北京',
    'C. 广州',
    'D. 深圳',
    '答案：B',
    '解析：北京是中华人民共和国的首都。',
    '',
    '2. 计算机中 1 字节等于多少位？',
    'A、4 位',
    'B、8 位',
    'C、16 位',
    'D、32 位',
    '正确答案: B',
    '解析：1 Byte = 8 bit。',
    '',
    '3. 下列属于操作系统的有？',
    'A) Windows',
    'B) Linux',
    'C) Photoshop',
    'D) macOS',
    '答案：ABD',
    '解析：Photoshop 是图像处理软件。',
  ].join('\r\n');

  var r = safeParse(txt);
  ok('A3 未抛异常', r.threw === null, String(r.threw));
  var res = r.res;
  eq('A3 format=txt', res.format, 'txt');
  ok('A3 ok=true', res.ok === true, JSON.stringify(res.errors));
  eq('A3 题数=3', res.questions.length, 3);
  eq('A3 题干1', res.questions[0].stem, '下列哪一项是中国的首都？');
  eq('A3 选项1 数量', res.questions[0].options.length, 4);
  eq('A3 选项1 B 文本', res.questions[0].options[1].text, '北京');
  eq('A3 答案1', res.questions[0].answer, 'B');
  eq('A3 解析1', res.questions[0].analysis, '北京是中华人民共和国的首都。');
  eq('A3 题型2', res.questions[1].type, 'single');
  eq('A3 答案2', res.questions[1].answer, 'B');
  eq('A3 解析2', res.questions[1].analysis, '1 Byte = 8 bit。');
  eq('A3 题型3=multiple', res.questions[2].type, 'multiple');
  eq('A3 答案3', res.questions[2].answer, ['A', 'B', 'D']);
})();

/* ================================================================== */
/* A4. TXT 中文题号 + 章节标题混排                                     */
/* ================================================================== */
section('A4 TXT 中文题号 / 章节标题');
(function () {
  var txt = [
    '一、单选题',
    '第1题 下列哪个是编程语言？',
    'A. Python',
    'B. HTML',
    '答案：A',
    '解析：Python 是编程语言。',
    '',
    '二、多选题',
    '（1）以下属于前端技术的有？',
    'A. CSS',
    'B. SQL',
    'C. JS',
    '答案：AC',
    '解析：SQL 是数据库查询语言。',
    '',
    '三、判断题',
    '第2题 太阳从西边升起。',
    '答案：错误',
    '解析：太阳从东边升起。',
  ].join('\n');

  var r = safeParse(txt);
  ok('A4 未抛异常', r.threw === null, String(r.threw));
  var res = r.res;
  eq('A4 题数=3（章节标题未被当成题目）', res.questions.length, 3);
  var stems = res.questions.map(function (q) { return q.stem; });
  ok('A4 题干中不含章节标题', !stems.some(function (s) {
    return /单选题|多选题|判断题/.test(s);
  }), JSON.stringify(stems));
  eq('A4 题干1', res.questions[0].stem, '下列哪个是编程语言？');
  eq('A4 题型2=multiple（继承章节）', res.questions[1].type, 'multiple');
  eq('A4 答案2', res.questions[1].answer, ['A', 'C']);
  eq('A4 题型3=judge（继承章节）', res.questions[2].type, 'judge');
  eq('A4 答案3', res.questions[2].answer, 'B');
})();

/* ================================================================== */
/* A5. CSV 带引号内逗号                                                */
/* ================================================================== */
section('A5 CSV 引号内逗号');
(function () {
  var txt = [
    '题型,题干,选项A,选项B,选项C,选项D,答案,解析,标签',
    '单选,"下列哪个是首都, 中国的",上海,北京,广州,深圳,B,"首都是北京, 也是政治中心",地理',
    '多选,以下属于偶数,2,3,4,5,AC,2和4是偶数,数学',
  ].join('\r\n');

  var r = safeParse(txt);
  ok('A5 未抛异常', r.threw === null, String(r.threw));
  var res = r.res;
  eq('A5 format=csv', res.format, 'csv');
  ok('A5 ok=true', res.ok === true, JSON.stringify(res.errors));
  eq('A5 题数=2', res.questions.length, 2);
  eq('A5 题干含逗号', res.questions[0].stem, '下列哪个是首都, 中国的');
  eq('A5 解析含逗号', res.questions[0].analysis, '首都是北京, 也是政治中心');
  eq('A5 选项C', res.questions[0].options[2].text, '广州');
  eq('A5 题型2', res.questions[1].type, 'multiple');
  eq('A5 答案2', res.questions[1].answer, ['A', 'C']);
  eq('A5 标签1', res.questions[0].tags, ['地理']);
})();

/* ================================================================== */
/* A6. 答案容错：多选分隔符                                            */
/* ================================================================== */
section('A6 多选答案容错');
(function () {
  var variants = ['A、C', 'A,C', 'AC', 'A C', 'Ａ，Ｃ', 'A，C'];
  var qs = variants.map(function (v, i) {
    return {
      type: 'multiple',
      stem: '多选容错用例 ' + (i + 1),
      options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }, { key: 'C', text: 'c' }, { key: 'D', text: 'd' }],
      answer: v,
    };
  });
  var r = safeParse(JSON.stringify(qs));
  ok('A6 未抛异常', r.threw === null, String(r.threw));
  eq('A6 题数=6', r.res.questions.length, 6);
  for (var i = 0; i < variants.length; i++) {
    eq('A6 "' + variants[i] + '" -> ["A","C"]', r.res.questions[i] && r.res.questions[i].answer, ['A', 'C']);
  }
  // 顺序无关：'C,A' 也应升序为 ['A','C']
  var r2 = safeParse(JSON.stringify([{
    type: 'multiple', stem: '逆序答案',
    options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }, { key: 'C', text: 'c' }],
    answer: 'C,A',
  }]));
  eq('A6 "C,A" 升序归一化', r2.res.questions[0].answer, ['A', 'C']);
})();

/* ================================================================== */
/* A7. 判断题容错                                                      */
/* ================================================================== */
section('A7 判断题答案容错');
(function () {
  var trueWords = ['√', '对', '正确', 'true', 'T', '是', 'Y'];
  var falseWords = ['×', '错', '错误', 'false', 'F', '否', 'N'];
  var qs = [];
  trueWords.forEach(function (w, i) { qs.push({ type: 'judge', stem: '判断题真值 ' + i, answer: w }); });
  falseWords.forEach(function (w, i) { qs.push({ type: 'judge', stem: '判断题假值 ' + i, answer: w }); });

  var r = safeParse(JSON.stringify(qs));
  ok('A7 未抛异常', r.threw === null, String(r.threw));
  eq('A7 全部解析成功', r.res.questions.length, trueWords.length + falseWords.length);
  trueWords.forEach(function (w, i) {
    eq('A7 "' + w + '" -> A', r.res.questions[i] && r.res.questions[i].answer, 'A');
  });
  falseWords.forEach(function (w, i) {
    var idx = trueWords.length + i;
    eq('A7 "' + w + '" -> B', r.res.questions[idx] && r.res.questions[idx].answer, 'B');
  });
})();

/* ================================================================== */
/* A8. 填空题数组答案                                                  */
/* ================================================================== */
section('A8 填空题多答案');
(function () {
  var txt = JSON.stringify([{
    type: 'fill',
    stem: '「未找到」的英文提示是？',
    answer: ['未找到', 'Not Found'],
  }]);
  var r = safeParse(txt);
  ok('A8 未抛异常', r.threw === null, String(r.threw));
  eq('A8 保留数组', r.res.questions[0].answer, ['未找到', 'Not Found']);
  eq('A8 fill 无选项', r.res.questions[0].options, []);
})();

/* ================================================================== */
/* A9. 边界 / 非法输入                                                 */
/* ================================================================== */
section('A9 边界与非法输入');
(function () {
  var cases = [
    ['空字符串', ''],
    ['纯空白', '   \n\t  \n '],
    ['null', null],
    ['undefined', undefined],
    ['非法 JSON', '{ "questions": [ {"stem": "x", } ] }'],
    ['JSON 顶层是字符串', '"just a string"'],
    ['JSON 无题目数组', '{"name":"x"}'],
    ['纯乱码文本', '!!!@@@###$$$'],
  ];
  cases.forEach(function (c) {
    var r = safeParse(c[1]);
    ok('A9 [' + c[0] + '] 未抛异常', r.threw === null, String(r.threw));
    ok('A9 [' + c[0] + '] ok=false', r.res && r.res.ok === false);
    ok('A9 [' + c[0] + '] 有可读 errors', r.res && r.res.errors.length > 0, r.res && JSON.stringify(r.res.errors));
  });

  // 缺 answer 的 single
  var r1 = safeParse(JSON.stringify([{
    type: 'single', stem: '缺答案的题',
    options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }],
  }]));
  ok('A9 缺 answer 未抛异常', r1.threw === null, String(r1.threw));
  ok('A9 缺 answer -> ok=false', r1.res.ok === false);
  ok('A9 缺 answer 有 errors', r1.res.errors.length > 0, JSON.stringify(r1.res.errors));

  // single 但答案 E，选项只有 A-D
  var r2 = safeParse(JSON.stringify([{
    type: 'single', stem: '越界答案',
    options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }, { key: 'C', text: 'c' }, { key: 'D', text: 'd' }],
    answer: 'E',
  }]));
  ok('A9 越界答案未抛异常', r2.threw === null, String(r2.threw));
  ok('A9 越界答案 ok=false', r2.res.ok === false);
  ok('A9 越界答案 errors 提到 E', r2.res.errors.join('|').indexOf('E') >= 0, JSON.stringify(r2.res.errors));

  // 数组里混入非对象
  var r3 = safeParse(JSON.stringify([null, 42, 'str', [], { type: 'judge', stem: '唯一有效题', answer: '对' }]));
  ok('A9 混合脏数据未抛异常', r3.threw === null, String(r3.threw));
  eq('A9 只保留 1 道有效题', r3.res.questions.length, 1);
  ok('A9 脏数据进入 errors', r3.res.errors.length >= 4, JSON.stringify(r3.res.errors));

  // 选择题选项 < 2
  var r4 = safeParse(JSON.stringify([{
    type: 'single', stem: '只有一个选项',
    options: [{ key: 'A', text: 'a' }], answer: 'A',
  }]));
  ok('A9 选项<2 未抛异常', r4.threw === null, String(r4.threw));
  ok('A9 选项<2 ok=false', r4.res.ok === false);
})();

/* ================================================================== */
/* A10. CRLF / BOM                                                     */
/* ================================================================== */
section('A10 CRLF / UTF-8 BOM');
(function () {
  var crlf = '1. 第一题\r\nA. 甲\r\nB. 乙\r\n答案：A\r\n\r\n2. 第二题\r\nA. 丙\r\nB. 丁\r\n答案：B\r\n';
  var r = safeParse(crlf);
  ok('A10 CRLF 未抛异常', r.threw === null, String(r.threw));
  eq('A10 CRLF 题数=2', r.res.questions.length, 2);
  eq('A10 CRLF 题干无残留 \\r', r.res.questions[0].stem, '第一题');

  var bom = '\uFEFF' + crlf;
  var r2 = safeParse(bom);
  ok('A10 BOM 未抛异常', r2.threw === null, String(r2.threw));
  eq('A10 BOM 题数=2', r2.res.questions.length, 2);
  eq('A10 BOM 首题题干干净', r2.res.questions[0].stem, '第一题');

  var bomJson = '\uFEFF' + JSON.stringify([{ type: 'judge', stem: 'BOM JSON', answer: '对' }]);
  var r3 = safeParse(bomJson);
  eq('A10 BOM JSON 识别为 json', r3.res.format, 'json');
  eq('A10 BOM JSON 题数=1', r3.res.questions.length, 1);

  // 全角空格缩进
  var fw = '\u3000\u30001. 全角缩进题\n\u3000A. 甲\n\u3000B. 乙\n\u3000答案：A\n';
  var r4 = safeParse(fw);
  eq('A10 全角空格缩进可解析', r4.res.questions.length, 1);
})();

/* ================================================================== */
/* A11. validateBank 校验示例题库 20 题                                */
/* ================================================================== */
section('A11 validateBank(sample/bank-sample.json)');
(function () {
  var file = path.join(ROOT, 'sample', 'bank-sample.json');
  var raw = fs.readFileSync(file, 'utf8');
  var data = JSON.parse(raw);
  var qs = data.questions;
  eq('A11 样例题库题数=20', qs.length, 20);
  var v = parser.validateBank(qs);
  eq('A11 valid=20', v.valid.length, 20);
  eq('A11 invalid=0', v.invalid.length, 0);
  if (v.invalid.length) console.log('      invalid: ' + JSON.stringify(v.invalid));

  // 走一遍 parse 也应全通
  var r = safeParse(raw);
  eq('A11 parse 题数=20', r.res.questions.length, 20);
  eq('A11 parse 无 errors', r.res.errors.length, 0);
  eq('A11 parse name', r.res.name, '示例题库 · 通用常识 20 题');

  // 反向校验：故意破坏一条
  var broken = JSON.parse(JSON.stringify(qs));
  broken[0].answer = 'Z';
  var v2 = parser.validateBank(broken);
  eq('A11 破坏 1 条 -> invalid=1', v2.invalid.length, 1);

  // 样例 TXT 也应解析成功
  var txtRaw = fs.readFileSync(path.join(ROOT, 'sample', 'bank-sample.txt'), 'utf8');
  var rt = safeParse(txtRaw);
  ok('A11 样例 TXT 未抛异常', rt.threw === null, String(rt.threw));
  ok('A11 样例 TXT 有题', rt.res.questions.length > 0, 'count=' + rt.res.questions.length);
  console.log('      样例 TXT 解析题数 = ' + rt.res.questions.length + '，errors=' + JSON.stringify(rt.res.errors));
})();

/* ================================================================== */
/* 汇总                                                                */
/* ================================================================== */
console.log('\n----------------------------------------');
console.log('parser 单测结果：PASS ' + pass + ' / FAIL ' + fail + ' / TOTAL ' + (pass + fail));
if (failures.length) {
  console.log('失败用例：');
  failures.forEach(function (f) { console.log('  - ' + f); });
}
console.log('----------------------------------------');
process.exit(fail === 0 ? 0 : 1);
