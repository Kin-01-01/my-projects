/**
 * QA 独立验证：F 交互冒烟（mock wx + 直接驱动页面 JS）
 * 覆盖：导入 sample 题库 → 答题（1 对 1 错 1 多选）→ store 写入校验
 *       自动跳题时序（正确跳 / 错误不跳 / 最后一题不跳 / exam 不跳 / onUnload 清理）
 *       主题 themeClass 首帧、设置页备份恢复
 */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve('D:/03_项目归档/MarxQuiz MP');

var pass = 0, fail = 0, failures = [];
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; failures.push(name + (detail ? ' :: ' + detail : '')); console.log('  FAIL  ' + name + (detail ? '  <-- ' + detail : '')); }
}
function eq(name, a, e) { ok(name, JSON.stringify(a) === JSON.stringify(e), 'expected=' + JSON.stringify(e) + ' actual=' + JSON.stringify(a)); }
function section(t) { console.log('\n=== ' + t + ' ==='); }
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/* ------------------------------------------------------------------ */
/* mock wx                                                             */
/* ------------------------------------------------------------------ */
var STORE = {};          // key -> value
var TOASTS = [];
var MODALS = [];
var NAV_CALLS = [];
var CLIPBOARD = '';
var themeHandlers = [];

global.wx = {
  getStorageSync: function (k) {
    if (!Object.prototype.hasOwnProperty.call(STORE, k)) return '';
    return JSON.parse(JSON.stringify(STORE[k]));
  },
  setStorageSync: function (k, v) { STORE[k] = JSON.parse(JSON.stringify(v)); },
  removeStorageSync: function (k) { delete STORE[k]; },
  clearStorageSync: function () { STORE = {}; },
  getStorageInfoSync: function () {
    var keys = Object.keys(STORE);
    var size = 0;
    keys.forEach(function (k) { size += JSON.stringify(STORE[k]).length; });
    return { keys: keys, currentSize: Math.ceil(size / 1024), limitSize: 10240 };
  },
  showToast: function (o) { TOASTS.push(o && o.title); },
  hideToast: function () {},
  showModal: function (o) { MODALS.push(o); if (o && typeof o.success === 'function') o.success({ confirm: false, cancel: true, content: '' }); },
  showActionSheet: function (o) { if (o && o.fail) o.fail({}); },
  setNavigationBarColor: function (o) { NAV_CALLS.push(o); },
  setBackgroundColor: function () {},
  getSystemInfoSync: function () { return { theme: 'light', platform: 'devtools' }; },
  onThemeChange: function (h) { themeHandlers.push(h); },
  offThemeChange: function (h) { var i = themeHandlers.indexOf(h); if (i >= 0) themeHandlers.splice(i, 1); },
  setClipboardData: function (o) { CLIPBOARD = o.data; if (o.success) o.success({}); },
  getClipboardData: function (o) { if (o.success) o.success({ data: CLIPBOARD }); },
  getFileSystemManager: function () { return { readFileSync: function () { return ''; } }; },
  navigateTo: function () {}, navigateBack: function () {}, redirectTo: function () {}, reLaunch: function () {},
  chooseMessageFile: function () {},
  vibrateShort: function () {},
};

/* mock Page / App */
var PAGE_DEFS = {};
global.Page = function (def) { global.__lastPage = def; };
global.App = function () {};
global.getApp = function () { return { globalData: { version: '1.0.0' } }; };

/** 实例化页面：合并 data + 方法，提供 setData */
function instantiate(def) {
  var inst = {};
  inst.data = JSON.parse(JSON.stringify(def.data || {}));
  Object.keys(def).forEach(function (k) {
    if (k === 'data') return;
    inst[k] = def[k];
  });
  inst.setData = function (patch) {
    if (!patch) return;
    Object.keys(patch).forEach(function (k) { inst.data[k] = patch[k]; });
  };
  return inst;
}

function loadPage(relPath) {
  delete require.cache[require.resolve(path.join(ROOT, relPath))];
  require(path.join(ROOT, relPath));
  return instantiate(global.__lastPage);
}

var store = require(path.join(ROOT, 'utils', 'store.js'));
var parser = require(path.join(ROOT, 'utils', 'parser.js'));

/* ================================================================== */
/* F1. 导入 sample 题库 → store 落库                                   */
/* ================================================================== */
section('F1 导入 sample 题库');
var sampleRaw = fs.readFileSync(path.join(ROOT, 'sample', 'bank-sample.json'), 'utf8');
var parsed = parser.parse(sampleRaw);
var bank = store.saveBank(parsed.name, parsed.questions);
ok('F1 saveBank 成功', !!bank);
eq('F1 题库题数=20', bank.count, 20);
eq('F1 listBanks 长度=1', store.listBanks().length, 1);
eq('F1 getQuestions 长度=20', store.getQuestions(bank.id).length, 20);
eq('F1 存储 key 含 qb:list', Object.keys(STORE).indexOf('qb:list') >= 0, true);
eq('F1 存储 key 含 qb:data:<id>', Object.keys(STORE).indexOf('qb:data:' + bank.id) >= 0, true);

/* ================================================================== */
/* F2. 顺序刷题：1 对 1 错 1 多选                                      */
/* ================================================================== */
section('F2 顺序刷题 3 题（1 对 / 1 错 / 1 多选）');
(async function () {
  var page = loadPage('pages/practice/practice.js');
  page.onLoad({ bankId: bank.id, mode: 'order' });
  eq('F2 ready=true', page.data.ready, true);
  eq('F2 total=20', page.data.total, 20);
  eq('F2 首帧 themeClass 已设置', page.data.themeClass, 'theme-light');
  ok('F2 首帧 q 不为空', !!page.data.q);

  // ---- 第 1 题：答对（自动跳题应触发）----
  var q1 = page.data.q;
  var rightKey = Array.isArray(q1.answer) ? q1.answer[0] : q1.answer;
  if (q1.type === 'fill') page.setData({ fillInput: q1.answer[0] });
  else page.setData({ selected: [rightKey] });
  page.onSubmit();
  eq('F2 第1题判对', page.data.isCorrect, true);
  ok('F2 第1题答对后排了自动跳题定时器', !!page._autoNextTimer);
  eq('F2 答对提示文案', page.data.tipText, '答对，即将进入下一题');

  await sleep(1000);
  eq('F2 800ms 后自动跳到第 2 题', page.data.index, 1);

  // ---- 第 2 题：答错（不应跳）----
  var q2 = page.data.q;
  var keys = (q2.options || []).map(function (o) { return o.key; });
  var wrongKey = null;
  if (q2.type === 'multiple') {
    wrongKey = [keys[0]];   // 只选一个必然错（除非答案就是单选，多选至少 2 个）
  } else if (q2.type === 'fill') {
    wrongKey = '__WRONG_ANSWER__';
  } else {
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i]) !== String(q2.answer)) { wrongKey = keys[i]; break; }
    }
  }
  if (q2.type === 'fill') page.setData({ fillInput: wrongKey });
  else page.setData({ selected: Array.isArray(wrongKey) ? wrongKey : [wrongKey] });
  page.onSubmit();
  eq('F2 第2题判错', page.data.isCorrect, false);
  ok('F2 第2题答错后没有定时器', !page._autoNextTimer);
  await sleep(1000);
  eq('F2 答错停留原题（index 仍为 1）', page.data.index, 1);

  // ---- 手动下一题，第 3 题答对 ----
  page.onNext();
  eq('F2 手动 onNext 到第 3 题', page.data.index, 2);
  var q3 = page.data.q;
  if (q3.type === 'fill') page.setData({ fillInput: q3.answer[0] });
  else if (q3.type === 'multiple') page.setData({ selected: q3.answer.slice() });
  else page.setData({ selected: [q3.answer] });
  page.onSubmit();
  eq('F2 第3题判对', page.data.isCorrect, true);

  // ---- store 统计校验 ----
  var stat = store.getStat(bank.id);
  eq('F2 stat.answered=3', stat.answered, 3);
  eq('F2 stat.correct=2', stat.correct, 2);
  var wrongList = store.getWrong(bank.id);
  eq('F2 错题本记录 1 条', wrongList.length, 1);
  eq('F2 错题本记录的是第 2 题', wrongList[0].questionId, q2.id);
  eq('F2 错题次数=1', wrongList[0].count, 1);
  var prog = store.getProgress(bank.id);
  ok('F2 进度已落盘', !!prog && Array.isArray(prog.order));
  eq('F2 进度 answers 已记录 3 条', Object.keys(prog.answers).length, 3);

  /* ================================================================ */
  /* F3. onUnload 清理定时器                                          */
  /* ================================================================ */
  section('F3 onUnload 清理自动跳题定时器');
  var p3 = loadPage('pages/practice/practice.js');
  p3.onLoad({ bankId: bank.id, mode: 'order' });
  // 清掉进度恢复弹窗影响：直接用新题库避免 resume
  var qa = p3.data.q;
  var kA = Array.isArray(qa.answer) ? qa.answer[0] : qa.answer;
  if (qa.type === 'fill') p3.setData({ fillInput: qa.answer[0] });
  else p3.setData({ selected: [kA] });
  p3.onSubmit();
  ok('F3 提交后存在定时器', !!p3._autoNextTimer);
  p3.onUnload();
  ok('F3 onUnload 后定时器被清空', !p3._autoNextTimer);
  ok('F3 onUnload 后 _destroyed=true', p3._destroyed === true);
  await sleep(1000);
  eq('F3 卸载后定时器未再推进题目', p3.data.index, 0);

  /* ================================================================ */
  /* F4. 最后一题答对不排定时器                                        */
  /* ================================================================ */
  section('F4 最后一题答对只提示不排定时器');
  var bank2 = store.saveBank('两题小库', [
    { id: 'x1', type: 'single', stem: '小库第1题', options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }], answer: 'A' },
    { id: 'x2', type: 'single', stem: '小库第2题', options: [{ key: 'A', text: 'a' }, { key: 'B', text: 'b' }], answer: 'A' },
  ]);
  ok('F4 建两题小库成功', !!bank2 && bank2.count === 2);
  var p4 = loadPage('pages/practice/practice.js');
  p4.onLoad({ bankId: bank2.id, mode: 'order' });
  p4.setData({ selected: ['A'] });
  p4.onSubmit();            // 第 1 题答对 → 有定时器
  ok('F4 第1题答对有定时器', !!p4._autoNextTimer);
  await sleep(1000);
  eq('F4 已自动到第 2 题', p4.data.index, 1);
  eq('F4 isLast=true', p4.data.isLast, true);
  p4.setData({ selected: ['A'] });
  p4.onSubmit();            // 最后一题答对
  eq('F4 最后一题答对提示', p4.data.tipText, '已是最后一题，可以交卷');
  ok('F4 最后一题答对不排定时器', !p4._autoNextTimer);

  /* ================================================================ */
  /* F5. exam 模式不自动跳题                                          */
  /* ================================================================ */
  section('F5 exam 模式强制不自动跳题');
  var p5 = loadPage('pages/practice/practice.js');
  p5.onLoad({ bankId: bank2.id, mode: 'exam' });
  eq('F5 isExam=true', p5.data.isExam, true);
  p5.setData({ selected: ['A'] });
  p5.onSubmit();
  ok('F5 exam 答对无自动跳题定时器', !p5._autoNextTimer);
  eq('F5 exam 提交后不展示对错（submitted=false）', p5.data.submitted, false);
  eq('F5 exam 提交后直接进入下一题', p5.data.index, 1);
  ok('F5 exam 计时器已启动', !!p5._timer);
  p5.onUnload();

  /* ================================================================ */
  /* F6. 关闭 autoNext 后不跳                                          */
  /* ================================================================ */
  section('F6 关闭 autoNext 后不跳题');
  store.setSettings({ autoNext: false });
  eq('F6 设置已关闭', store.getSettings().autoNext, false);
  var p6 = loadPage('pages/practice/practice.js');
  p6.onLoad({ bankId: bank2.id, mode: 'order' });
  p6.setData({ selected: ['A'] });
  p6.onSubmit();
  ok('F6 关闭后无定时器', !p6._autoNextTimer);
  await sleep(1000);
  eq('F6 关闭后停留原题', p6.data.index, 0);
  store.setSettings({ autoNext: true });

  /* ================================================================ */
  /* F7. autoNextDelay 白名单回落                                      */
  /* ================================================================ */
  section('F7 autoNextDelay 白名单回落');
  store.setSettings({ autoNextDelay: 9999 });
  eq('F7 非法延时回落 800', store.getSettings().autoNextDelay, 800);
  store.setSettings({ autoNextDelay: 1500 });
  eq('F7 合法延时 1500 保留', store.getSettings().autoNextDelay, 1500);
  store.setSettings({ autoNextDelay: 800 });

  /* ================================================================ */
  /* F8. 答题卡跳题 / onPrev 清理定时器                                */
  /* ================================================================ */
  section('F8 切题清理定时器');
  var p8 = loadPage('pages/practice/practice.js');
  p8.onLoad({ bankId: bank.id, mode: 'order' });
  var q8 = p8.data.q;
  var k8 = Array.isArray(q8.answer) ? q8.answer[0] : q8.answer;
  if (q8.type === 'fill') p8.setData({ fillInput: q8.answer[0] });
  else p8.setData({ selected: [k8] });
  p8.onSubmit();
  ok('F8 提交后有定时器', !!p8._autoNextTimer);
  p8.onCellTap({ currentTarget: { dataset: { index: 5 } } });
  ok('F8 答题卡跳题清掉定时器', !p8._autoNextTimer);
  eq('F8 答题卡跳到第 6 题', p8.data.index, 5);

  var p8b = loadPage('pages/practice/practice.js');
  p8b.onLoad({ bankId: bank.id, mode: 'order' });
  var q8b = p8b.data.q;
  var k8b = Array.isArray(q8b.answer) ? q8b.answer[0] : q8b.answer;
  if (q8b.type === 'fill') p8b.setData({ fillInput: q8b.answer[0] });
  else p8b.setData({ selected: [k8b] });
  p8b.onSubmit();
  p8b.onPrev();
  ok('F8 onPrev 清掉定时器', !p8b._autoNextTimer);

  /* ================================================================ */
  /* F9. 主题切换持久化                                                */
  /* ================================================================ */
  section('F9 主题切换与持久化');
  var theme = require(path.join(ROOT, 'utils', 'theme.js'));
  eq('F9 默认主题 auto', theme.getTheme(), 'auto');
  theme.setTheme('dark');
  eq('F9 setTheme 后存储 app:theme=dark', STORE['app:theme'], 'dark');
  eq('F9 resolveTheme=dark', theme.resolveTheme(), 'dark');
  eq('F9 themeClass', theme.themeClass(), 'theme-dark');
  var p9 = loadPage('pages/index/index.js');
  p9.onLoad();
  p9.onShow();
  eq('F9 index 页 themeClass=theme-dark', p9.data.themeClass, 'theme-dark');
  theme.setTheme('light');
  p9.onShow();
  eq('F9 切回 light 后 themeClass', p9.data.themeClass, 'theme-light');
  // 导航栏颜色随主题变化
  var navCountBefore = NAV_CALLS.length;
  theme.applyNavBar('dark');
  var lastNav = NAV_CALLS[NAV_CALLS.length - 1];
  eq('F9 深夜导航栏底色', lastNav.backgroundColor, '#0D1210');
  ok('F9 调用了 setNavigationBarColor', NAV_CALLS.length > navCountBefore);
  theme.setTheme('auto');
  eq('F9 auto + 系统 light -> theme-light', theme.themeClass(), 'theme-light');

  /* ================================================================ */
  /* F10. 设置页：备份 → 恢复                                         */
  /* ================================================================ */
  section('F10 设置页备份 / 恢复');
  var ps = loadPage('pages/settings/settings.js');
  ps.onLoad();
  ps.onShow();
  ok('F10 设置页 themeClass 已初始化', /^theme-/.test(ps.data.themeClass));
  var exp = store.exportAll();
  ok('F10 exportAll ok', exp.ok);
  eq('F10 备份题库数=2', exp.bankCount, 2);
  var val = store.validateBackup(exp.json);
  ok('F10 validateBackup ok', val.ok, val.message);
  eq('F10 备份题目总数=22', val.questionCount, 22);

  ps.onBackup();
  ok('F10 备份已写入剪贴板', CLIPBOARD.length > 100);
  ok('F10 备份后 lastBackupAt 已记录', store.getMeta().lastBackupAt > 0);

  // 清空后恢复
  store.clearAllData();
  eq('F10 清空后题库数=0', store.listBanks().length, 0);
  var imp = store.importAll(CLIPBOARD);
  ok('F10 importAll ok', imp.ok, imp.message);
  eq('F10 恢复后题库数=2', store.listBanks().length, 2);

  // 非法备份
  var bad = store.validateBackup('{"foo":1}');
  eq('F10 非本程序备份被拒', bad.ok, false);
  ok('F10 拒绝原因可读', /备份/.test(bad.message), bad.message);
  var bad2 = store.validateBackup('not json');
  eq('F10 非法 JSON 被拒', bad2.ok, false);

  /* ================================================================ */
  /* F11. 存储超限提示                                                */
  /* ================================================================ */
  section('F11 存储超限可读提示');
  var origSet = global.wx.setStorageSync;
  global.wx.setStorageSync = function () {
    var e = new Error('setStorageSync:fail exceed max size');
    e.errMsg = 'setStorageSync:fail exceed max size';
    throw e;
  };
  var r = store.saveBank('超限题库', [{ id: 'z1', type: 'judge', stem: '超限', answer: 'A' }]);
  eq('F11 超限时 saveBank 返回 null', r, null);
  ok('F11 错误提示可读（含存储空间不足）', /存储空间不足/.test(store.getLastError()), store.getLastError());
  global.wx.setStorageSync = origSet;

  /* ================================================================ */
  /* 汇总                                                             */
  /* ================================================================ */
  console.log('\n----------------------------------------');
  console.log('冒烟结果：PASS ' + pass + ' / FAIL ' + fail + ' / TOTAL ' + (pass + fail));
  if (failures.length) { console.log('失败用例：'); failures.forEach(function (f) { console.log('  - ' + f); }); }
  console.log('----------------------------------------');
  process.exit(fail === 0 ? 0 : 1);
})();
