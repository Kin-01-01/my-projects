// 刘晓燕48课「课次编号 ↔ 序号」双向转换（单一真理来源）
// 背景：engine.js 里这段 "刘晓燕48课 U(\d+)L(\d+)" 正则解析 + (u-1)*4+l 数学被内联了 4 处
//       （1 处正向生成 lessonRef，3 处反向解析：续接锚点 / 已绑指针 / used 集合）。
//       散落多处易漂移，曾埋下"复习任务继承错课次"的隐患。集中到此处后：
//       - 生成与解析共用同一套数学，必为互逆；
//       - 后续改课次规则只动这一处。
var PREFIX = '刘晓燕48课 U';

// 序号 n(1..48) -> 标签 "UxLy"（n 越界自动循环回 1..48）
function toLabel(n) {
  var nn = ((n - 1) % 48 + 48) % 48 + 1;
  var u = Math.ceil(nn / 4);
  var l = ((nn - 1) % 4) + 1;
  return PREFIX + u + 'L' + l;
}

// 标签 -> 序号 n(1..48)，解析失败返回 null
function fromRef(str) {
  if (!str) return null;
  var m = /^刘晓燕48课 U(\d+)L(\d+)/.exec(str);
  if (!m) return null;
  return (parseInt(m[1], 10) - 1) * 4 + parseInt(m[2], 10);
}

// 序号 n(1..48) -> 短标签 "UxLy"（不含材料前缀，用于"未绑定课次"列表展示）
function toShortLabel(n) {
  var nn = ((n - 1) % 48 + 48) % 48 + 1;
  var u = Math.ceil(nn / 4);
  var l = ((nn - 1) % 4) + 1;
  return 'U' + u + 'L' + l;
}

module.exports = { PREFIX: PREFIX, toLabel: toLabel, toShortLabel: toShortLabel, fromRef: fromRef };
