/**
 * QA 独立验证：边角时序（答题卡开启时自动跳题 / exam 重复提交 / 恢复失败的数据安全）
 */
'use strict';

var path = require('path');
var ROOT = path.resolve('D:/03_项目归档/MarxQuiz MP');

var pass = 0, fail = 0, failures = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); console.log('  FAIL  ' + name + (detail ? '  <-- ' + detail : '')); }
}
function eq(n, a, e) { ok(n, JSON.stringify(a) === JSON.stringify(e), 'expected=' + JSON.stringify(e) + ' actual=' + JSON.stringify(a)); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

var STORE = {};
global.wx = {
  getStorageSync: function (k) { return Object.prototype.hasOwnProperty.call(STORE, k) ? JSON.parse(JSON.stringify(STORE[k])) : ''; },
  setStorageSync: function (k, v) { STORE[k] = JSON.parse(JSON.stringify(v)); },
  removeStorageSync: function (k) { delete STORE[k]; },
  getStorageInfoSync: function () {
    var keys = Object.keys(STORE), size = 0;
    keys.forEach(function (k) { size += JSON.stringify(STORE[k]).length; });
    return { keys: keys, currentSize: Math.ceil(size / 1024), limitSize: 10240 };
  },
  showToast: function () {}, showModal: function () {}, showActionSheet: function () {},
  setNavigationBarColor: function () {}, setBackgroundColor: function () {},
  getSystemInfoSync: function () { return { theme: 'light' }; },
  onThemeChange: function () {}, offThemeChange: function () {},
  navigateTo: function () {}, redirectTo: function () {}, reLaunch: function () {}, navigateBack: function () {},
  setClipboardData: function () {}, getClipboardData: function () {}, getFileSystemManager: function () { return { readFileSync: function () { return ''; } }; },
};
global.Page = function (def) { global.__lastPage = def; };
global.App = function () {};
global.getApp = function () { return { globalData: {} }; };

var store = require(path.join(ROOT, 'utils', 'store.js'));

function loadPage(rel) {
  delete require.cache[require.resolve(path.join(ROOT, rel))];
  require(path.join(ROOT, rel));
  var def = global.__lastPage;
  var inst = { data: JSON.parse(JSON.stringify(def.data || {})) };
  Object.keys(def).forEach(function (k) { if (k !== 'data') inst[k] = def[k]; });
  inst.setData = function (patch) { Object.keys(patch || {}).forEach(function (k) { inst.data[k] = patch[k]; }); };
  return inst;
}

var bank = store.saveBank('边角测试库', [
  { id: 'e1', type: 'single', stem: '边角第1题', options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }], answer: 'A' },
  { id: 'e2', type: 'single', stem: '边角第2题', options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }], answer: 'A' },
  { id: 'e3', type: 'single', stem: '边角第3题', options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }], answer: 'A' },
]);

(async function () {
  console.log('=== H3 答题卡打开应取消待执行的自动跳题 ===');
  var p = loadPage('pages/practice/practice.js');
  p.onLoad({ bankId: bank.id, mode: 'order' });
  p.setData({ selected: ['A'] });
  p.onSubmit();
  ok('H3 答对后排了定时器', !!p._autoNextTimer);
  p.onOpenCard();
  ok('H3 打开答题卡后 cardVisible=true', p.data.cardVisible === true);
  ok('H3 onOpenCard 已清除自动跳题定时器', !p._autoNextTimer);
  var idxBefore = p.data.index;
  await sleep(1000);
  console.log('      答题卡打开前的题目下标 = ' + idxBefore + '，800ms 后 = ' + p.data.index);
  eq('H3 答题卡打开期间题目不应被自动切走', p.data.index, idxBefore);

  console.log('\n=== H4 exam 模式重复提交不会重复计分 ===');
  // 用全新题库，避免受 H3 已写入的统计干扰
  var bankExam = store.saveBank('exam 计分库', [
    { id: 'm1', type: 'single', stem: '计分第1题', options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }], answer: 'A' },
    { id: 'm2', type: 'single', stem: '计分第2题', options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }], answer: 'A' },
    { id: 'm3', type: 'single', stem: '计分第3题', options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }], answer: 'A' },
  ]);
  var p2 = loadPage('pages/practice/practice.js');
  p2.onLoad({ bankId: bankExam.id, mode: 'exam' });
  eq('H4 起始 stat.answered=0', store.getStat(bankExam.id).answered, 0);
  p2.setData({ selected: ['A'] });
  p2.onSubmit();
  p2.setData({ selected: ['A'] });
  p2.onSubmit();
  p2.setData({ selected: ['A'] });
  p2.onSubmit();
  var stat = store.getStat(bankExam.id);
  console.log('      exam 连点 3 次提交后 stat = ' + JSON.stringify(stat));
  eq('H4 exam 三次提交各计一题（answered=3）', stat.answered, 3);
  eq('H4 exam 三题全对（correct=3）', stat.correct, 3);
  p2.onUnload();

  console.log('\n=== H5 从备份恢复失败时旧数据是否被提前清空 ===');
  var b2 = store.saveBank('会被误删的库', [
    { id: 'k1', type: 'judge', stem: '占位题', answer: 'A' },
  ]);
  var beforeCount = store.listBanks().length;
  // 造一个结构合法、但写入时必然超限的备份
  var payload = {
    app: 'quiz-miniprogram', version: 1, exportedAt: Date.now(),
    data: { 'qb:list': [{ id: 'x', name: '来自备份', count: 1, createdAt: 1, lastPracticedAt: 0 }] },
  };
  var origSet = global.wx.setStorageSync;
  global.wx.setStorageSync = function () {
    var e = new Error('setStorageSync:fail exceed max size');
    e.errMsg = 'setStorageSync:fail exceed max size';
    throw e;
  };
  var r = store.importAll(JSON.stringify(payload));
  global.wx.setStorageSync = origSet;
  var afterCount = store.listBanks().length;
  console.log('      恢复前题库数 = ' + beforeCount + '，恢复失败后题库数 = ' + afterCount + '，返回 = ' + JSON.stringify(r));
  ok('H5 恢复失败时旧题库不应丢失', afterCount === beforeCount,
    '旧数据已被清空（' + beforeCount + ' -> ' + afterCount + '），用户无回滚手段');

  console.log('\n----------------------------------------');
  console.log('边角时序结果：PASS ' + pass + ' / FAIL ' + fail + ' / TOTAL ' + (pass + fail));
  if (failures.length) { console.log('失败用例：'); failures.forEach(function (f) { console.log('  - ' + f); }); }
  console.log('----------------------------------------');
  process.exit(fail === 0 ? 0 : 1);
})();
