/**
 * utils/util.js
 * 通用工具函数：时间格式化、答案判分、数组处理等。
 * 纯 JS，不引用 wx API。
 */

'use strict';

/**
 * 补零。
 * @param {number} n
 * @return {string}
 */
function padZero(n) {
  var v = Math.floor(Number(n) || 0);
  return v < 10 ? '0' + v : String(v);
}

/**
 * 秒数格式化为 mm:ss（分钟可超过 59，例如 60:00）。
 * @param {number} seconds
 * @return {string}
 */
function formatClock(seconds) {
  var s = Math.max(0, Math.floor(Number(seconds) || 0));
  var m = Math.floor(s / 60);
  var r = s % 60;
  return padZero(m) + ':' + padZero(r);
}

/**
 * 时间戳格式化为 YYYY-MM-DD HH:mm。
 * @param {number} ts
 * @return {string}
 */
function formatDateTime(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  return d.getFullYear() + '-' + padZero(d.getMonth() + 1) + '-' + padZero(d.getDate()) +
    ' ' + padZero(d.getHours()) + ':' + padZero(d.getMinutes());
}

/**
 * 时间戳格式化为 MM-DD。
 * @param {number} ts
 * @return {string}
 */
function formatShortDate(ts) {
  var d = new Date(Number(ts) || Date.now());
  return padZero(d.getMonth() + 1) + '-' + padZero(d.getDate());
}

/**
 * 相对时间描述。
 * @param {number} ts
 * @return {string}
 */
function relativeTime(ts) {
  if (!ts) return '尚未练习';
  var diff = Date.now() - Number(ts);
  if (diff < 0) return '刚刚';
  var min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return min + ' 分钟前';
  var hour = Math.floor(min / 60);
  if (hour < 24) return hour + ' 小时前';
  var day = Math.floor(hour / 24);
  if (day < 7) return day + ' 天前';
  return formatShortDate(ts);
}

/**
 * 防抖。
 * @param {Function} fn
 * @param {number} wait 毫秒
 * @return {Function} 带 cancel 方法的包装函数
 */
function debounce(fn, wait) {
  var timer = null;
  var delay = Number(wait) || 300;
  var wrapped = function () {
    var args = arguments;
    var self = this;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () {
      timer = null;
      fn.apply(self, args);
    }, delay);
  };
  wrapped.cancel = function () {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return wrapped;
}

/**
 * Fisher-Yates 洗牌，返回新数组。
 * @param {Array} arr
 * @return {Array}
 */
function shuffle(arr) {
  var out = Array.isArray(arr) ? arr.slice() : [];
  for (var i = out.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/**
 * 截断字符串。
 * @param {string} str
 * @param {number} len
 * @return {string}
 */
function truncate(str, len) {
  var s = String(str === undefined || str === null ? '' : str);
  var n = Number(len) || 40;
  return s.length > n ? s.slice(0, n) + '…' : s;
}

/**
 * 题型中文标签。
 * @param {string} type
 * @return {string}
 */
function typeLabel(type) {
  if (type === 'single') return '单选';
  if (type === 'multiple') return '多选';
  if (type === 'judge') return '判断';
  if (type === 'fill') return '填空';
  return '题目';
}

/**
 * 判分。
 * @param {Object} q 题目对象
 * @param {*} userAnswer 用户答案（single/judge 为字符串，multiple 为数组，fill 为字符串）
 * @return {boolean}
 */
function gradeAnswer(q, userAnswer) {
  if (!q || typeof q !== 'object') return false;

  if (q.type === 'fill') {
    var answers = Array.isArray(q.answer) ? q.answer : [];
    var v = String(userAnswer === undefined || userAnswer === null ? '' : userAnswer).trim().toLowerCase();
    if (!v) return false;
    for (var i = 0; i < answers.length; i++) {
      if (String(answers[i]).trim().toLowerCase() === v) return true;
    }
    return false;
  }

  if (q.type === 'multiple') {
    var a = Array.isArray(q.answer) ? q.answer.slice().sort() : [];
    var b = Array.isArray(userAnswer) ? userAnswer.slice().sort() : [];
    if (!a.length || a.length !== b.length) return false;
    for (var j = 0; j < a.length; j++) {
      if (String(a[j]) !== String(b[j])) return false;
    }
    return true;
  }

  if (!userAnswer) return false;
  return String(userAnswer) === String(q.answer);
}

/**
 * 正确答案展示文本。
 * @param {Object} q
 * @return {string}
 */
function formatAnswer(q) {
  if (!q) return '';
  if (q.type === 'fill') return (Array.isArray(q.answer) ? q.answer : []).join(' / ');
  if (q.type === 'multiple') return (Array.isArray(q.answer) ? q.answer : []).join('、');
  return String(q.answer === undefined || q.answer === null ? '' : q.answer);
}

/**
 * 用户答案展示文本。
 * @param {Object} q
 * @param {*} ans
 * @return {string}
 */
function formatUserAnswer(q, ans) {
  if (!q) return '未作答';
  if (q.type === 'fill') {
    var v = String(ans === undefined || ans === null ? '' : ans).trim();
    return v || '未作答';
  }
  if (q.type === 'multiple') {
    var arr = Array.isArray(ans) ? ans : [];
    return arr.length ? arr.join('、') : '未作答';
  }
  return ans ? String(ans) : '未作答';
}

/**
 * 是否为普通对象。
 * @param {*} v
 * @return {boolean}
 */
function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * 字节数转可读文本。
 * @param {number} kb
 * @return {string}
 */
function formatSize(kb) {
  var n = Number(kb) || 0;
  if (n < 1024) return n + ' KB';
  return (n / 1024).toFixed(1) + ' MB';
}

module.exports = {
  padZero: padZero,
  formatClock: formatClock,
  formatDateTime: formatDateTime,
  formatShortDate: formatShortDate,
  relativeTime: relativeTime,
  debounce: debounce,
  shuffle: shuffle,
  truncate: truncate,
  typeLabel: typeLabel,
  gradeAnswer: gradeAnswer,
  formatAnswer: formatAnswer,
  formatUserAnswer: formatUserAnswer,
  isPlainObject: isPlainObject,
  formatSize: formatSize,
};
