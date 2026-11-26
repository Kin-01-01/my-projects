/**
 * QA 独立验证：深夜模式「首帧」主题正确性（FOUC / 白底白字风险）
 * 目标：确认页面 data.themeClass 的初始值是否跟随已保存偏好。
 */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.resolve('D:/03_项目归档/MarxQuiz MP');
var PAGES = ['index', 'import', 'practice', 'result', 'wrong', 'settings'];

var pass = 0, fail = 0, failures = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); console.log('  FAIL  ' + name + (detail ? '  <-- ' + detail : '')); }
}
function eq(n, a, e) { ok(n, JSON.stringify(a) === JSON.stringify(e), 'expected=' + JSON.stringify(e) + ' actual=' + JSON.stringify(a)); }

/* mock wx：已保存偏好为 dark */
var STORE = { 'app:theme': 'dark' };
global.wx = {
  getStorageSync: function (k) { return Object.prototype.hasOwnProperty.call(STORE, k) ? STORE[k] : ''; },
  setStorageSync: function (k, v) { STORE[k] = v; },
  removeStorageSync: function (k) { delete STORE[k]; },
  getStorageInfoSync: function () { return { keys: Object.keys(STORE), currentSize: 1, limitSize: 10240 }; },
  showToast: function () {}, showModal: function () {}, showActionSheet: function () {},
  setNavigationBarColor: function () {}, setBackgroundColor: function () {},
  getSystemInfoSync: function () { return { theme: 'dark' }; },
  onThemeChange: function () {}, offThemeChange: function () {},
  navigateTo: function () {}, redirectTo: function () {}, reLaunch: function () {}, navigateBack: function () {},
  setClipboardData: function () {}, getClipboardData: function () {}, getFileSystemManager: function () { return { readFileSync: function () { return ''; } }; },
};
var PAGE_DEFS = {};
global.Page = function (def) { global.__lastPage = def; };
global.App = function () {};
global.getApp = function () { return { globalData: {} }; };

var store = require(path.join(ROOT, 'utils', 'store.js'));
var theme = require(path.join(ROOT, 'utils', 'theme.js'));

function loadDef(rel) {
  delete require.cache[require.resolve(path.join(ROOT, rel))];
  require(path.join(ROOT, rel));
  return global.__lastPage;
}
function instantiate(def) {
  var inst = { data: JSON.parse(JSON.stringify(def.data || {})) };
  Object.keys(def).forEach(function (k) { if (k !== 'data') inst[k] = def[k]; });
  inst.setData = function (patch) { Object.keys(patch || {}).forEach(function (k) { inst.data[k] = patch[k]; }); };
  return inst;
}

console.log('=== H1 已保存偏好 = dark 时，各页面 data.themeClass 初始值 ===');
console.log('  theme.getTheme() = ' + theme.getTheme() + ' , themeClass() = ' + theme.themeClass());

var mismatched = [];
PAGES.forEach(function (p) {
  var def = loadDef('pages/' + p + '/' + p + '.js');
  var initVal = def.data && def.data.themeClass;
  console.log('  ' + p + '.js data.themeClass 初始值 = ' + initVal);
  if (initVal !== 'theme-dark') mismatched.push(p + '=' + initVal);
});
ok('H1 6 个页面 data.themeClass 初始值跟随已保存的 dark 偏好',
  mismatched.length === 0,
  '不跟随的页面：' + mismatched.join(', ') + '（首帧会先按白昼渲染，存在闪白风险）');

console.log('\n=== H2 页面实例化后、onShow 之前的状态 ===');
var def = loadDef('pages/index/index.js');
var inst = instantiate(def);
eq('H2 index 实例初始 themeClass（onShow 前）', inst.data.themeClass, 'theme-dark');
inst.onLoad();
inst.onShow();
eq('H2 index onShow 之后 themeClass', inst.data.themeClass, 'theme-dark');

console.log('\n----------------------------------------');
console.log('首帧主题检查：PASS ' + pass + ' / FAIL ' + fail + ' / TOTAL ' + (pass + fail));
if (failures.length) { console.log('失败用例：'); failures.forEach(function (f) { console.log('  - ' + f); }); }
console.log('----------------------------------------');
process.exit(fail === 0 ? 0 : 1);
