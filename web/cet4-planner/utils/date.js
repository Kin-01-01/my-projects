// 日期工具（全部使用本地时区，'YYYY-MM-DD' 字符串贯穿全App）
function pad(n) { return n < 10 ? '0' + n : '' + n; }

// 今天的 'YYYY-MM-DD'
function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

// 'YYYY-MM-DD' -> 当日 00:00 的时间戳（本地时区）
function toTs(str) {
  var p = String(str).split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]).getTime();
}

// fromStr 到 toStr 相差的天数（toStr 晚于 fromStr 为正）
function diffDays(fromStr, toStr) {
  return Math.round((toTs(toStr) - toTs(fromStr)) / 86400000);
}

// 日期 +n 天后的 'YYYY-MM-DD'（n 可为负）
function addDays(str, n) {
  var d = new Date(toTs(str) + n * 86400000);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

// 星期几（0=周日）
function dayOfWeek(str) {
  return new Date(toTs(str)).getDay();
}

// '9月28日 周一'
function todayCN(str) {
  var d = new Date(toTs(str));
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + '日一二三四五六'.charAt(d.getDay());
}

module.exports = {
  pad: pad,
  todayStr: todayStr,
  toTs: toTs,
  diffDays: diffDays,
  addDays: addDays,
  dayOfWeek: dayOfWeek,
  todayCN: todayCN
};
