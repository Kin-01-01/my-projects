/**
 * QA 独立验证：主题静态审查（C） + 工程一致性（E）
 * 只读交付目录，不写入。
 */
'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.resolve('D:/03_项目归档/MarxQuiz MP');
var PAGES = ['index', 'import', 'practice', 'result', 'wrong', 'settings'];

var pass = 0, fail = 0;
var problems = [];   // {level, where, msg}
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; problems.push(name + (detail ? ' :: ' + detail : '')); console.log('  FAIL  ' + name + (detail ? '  <-- ' + detail : '')); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }
function read(p) { return fs.readFileSync(p, 'utf8'); }
function rel(p) { return path.relative(ROOT, p).replace(/\\/g, '/'); }

/* ================================================================== */
/* C1. 页面 WXSS 硬编码颜色                                            */
/* ================================================================== */
section('C1 页面 WXSS 硬编码颜色');
var COLOR_PATTERNS = [
  { re: /#[0-9a-fA-F]{3,8}\b/g, label: 'hex' },
  { re: /\brgba?\s*\(/g, label: 'rgb/rgba' },
  { re: /\bhsla?\s*\(/g, label: 'hsl' },
  { re: /:\s*(white|black|red|green|blue|gray|grey|yellow|orange|purple|pink)\b/gi, label: 'named-color' },
];
var colorHits = [];
PAGES.forEach(function (p) {
  var f = path.join(ROOT, 'pages', p, p + '.wxss');
  if (!fs.existsSync(f)) return;
  var lines = read(f).split(/\r?\n/);
  lines.forEach(function (line, i) {
    // 跳过纯注释行
    var code = line.replace(/\/\*.*?\*\//g, '');
    COLOR_PATTERNS.forEach(function (cp) {
      var m;
      cp.re.lastIndex = 0;
      while ((m = cp.re.exec(code)) !== null) {
        colorHits.push({ file: 'pages/' + p + '/' + p + '.wxss', line: i + 1, kind: cp.label, text: m[0].trim(), src: line.trim() });
      }
    });
  });
});
if (colorHits.length) {
  console.log('  命中明细：');
  colorHits.forEach(function (h) {
    console.log('    ' + h.file + ':' + h.line + '  [' + h.kind + '] ' + h.text + '   << ' + h.src);
  });
}
ok('C1 页面 WXSS 硬编码颜色命中数为 0', colorHits.length === 0, '命中 ' + colorHits.length + ' 处');

/* ================================================================== */
/* C2. 6 个页面根节点 {{themeClass}}                                   */
/* ================================================================== */
section('C2 WXML 根节点 themeClass');
PAGES.forEach(function (p) {
  var f = path.join(ROOT, 'pages', p, p + '.wxml');
  var txt = read(f);
  var firstTag = txt.match(/<([a-zA-Z-]+)([^>]*)>/);
  var rootTag = firstTag ? firstTag[0] : '';
  var has = /\{\{\s*themeClass\s*\}\}/.test(rootTag);
  ok('C2 ' + p + '.wxml 根节点绑 themeClass', has, 'root=' + rootTag.slice(0, 120));
});

/* ================================================================== */
/* C3. 6 个页面 JS data.themeClass 初始化                              */
/* ================================================================== */
section('C3 页面 JS data.themeClass 初始化');
PAGES.forEach(function (p) {
  var f = path.join(ROOT, 'pages', p, p + '.js');
  var txt = read(f);
  var dataBlock = txt.match(/data\s*:\s*\{[\s\S]*?\n\s{2}\}/);
  var has = dataBlock && /themeClass\s*:/.test(dataBlock[0]);
  ok('C3 ' + p + '.js data.themeClass 已初始化', !!has);
});

/* ================================================================== */
/* C4. theme.js 能力 + 每页 onUnload 注销                              */
/* ================================================================== */
section('C4 theme.js 与监听注销');
var themeTxt = read(path.join(ROOT, 'utils', 'theme.js'));
['getTheme', 'setTheme', 'applyNavBar', 'watchSystemTheme', 'resolveTheme', 'getSystemTheme'].forEach(function (fn) {
  ok('C4 theme.js 实现 ' + fn, new RegExp('function\\s+' + fn + '\\s*\\(').test(themeTxt));
});
ok('C4 auto 模式读系统主题(getSystemInfoSync)', /getSystemInfoSync\(\)[\s\S]{0,120}theme/.test(themeTxt));
ok('C4 auto 模式监听 wx.onThemeChange', /wx\.onThemeChange\(/.test(themeTxt));
ok('C4 提供 offThemeChange 注销', /wx\.offThemeChange\(/.test(themeTxt));
ok('C4 resolveTheme 在 auto 时走系统主题', /if\s*\(s\s*===\s*'auto'\)\s*return\s+getSystemTheme\(\)/.test(themeTxt));

PAGES.forEach(function (p) {
  var txt = read(path.join(ROOT, 'pages', p, p + '.js'));
  var watches = /watchSystemTheme\(/.test(txt);
  if (!watches) {
    console.log('  INFO  ' + p + '.js 未使用 watchSystemTheme（无需注销）');
    return;
  }
  var hasUnload = /onUnload\s*:\s*function/.test(txt);
  var hasOff = /_unwatchTheme\s*\(\s*\)/.test(txt) || /offThemeChange/.test(txt);
  ok('C4 ' + p + '.js 有 onUnload', hasUnload);
  ok('C4 ' + p + '.js onUnload 注销主题监听', hasOff);
});

/* ================================================================== */
/* C5. app.json darkmode / themeLocation / theme.json                  */
/* ================================================================== */
section('C5 app.json darkmode 配对');
var appJson = JSON.parse(read(path.join(ROOT, 'app.json')));
ok('C5 darkmode === true', appJson.darkmode === true);
ok('C5 themeLocation 存在', typeof appJson.themeLocation === 'string' && appJson.themeLocation);
var themeJsonPath = path.join(ROOT, appJson.themeLocation || 'theme.json');
ok('C5 theme.json 文件存在', fs.existsSync(themeJsonPath));
var themeJson = null;
try { themeJson = JSON.parse(read(themeJsonPath)); ok('C5 theme.json JSON 合法', true); }
catch (e) { ok('C5 theme.json JSON 合法', false, String(e.message)); }
if (themeJson) {
  ok('C5 theme.json 有 light/dark 两套', !!themeJson.light && !!themeJson.dark);
  // app.json 中所有 @xxx 引用必须在 theme.json 两套里都有定义
  var refs = (read(path.join(ROOT, 'app.json')).match(/@[A-Za-z0-9_]+/g) || []).map(function (s) { return s.slice(1); });
  var uniqRefs = refs.filter(function (v, i, a) { return a.indexOf(v) === i; });
  console.log('  app.json 主题变量引用：' + JSON.stringify(uniqRefs));
  uniqRefs.forEach(function (r) {
    ok('C5 theme.json.light 定义 @' + r, themeJson.light && themeJson.light[r] !== undefined);
    ok('C5 theme.json.dark 定义 @' + r, themeJson.dark && themeJson.dark[r] !== undefined);
  });
}

/* ================================================================== */
/* C6. CSS 变量差集                                                    */
/* ================================================================== */
section('C6 页面 var(--x) 与 app.wxss 定义集合差集');
var appWxss = read(path.join(ROOT, 'app.wxss'));

function varsInBlock(block) {
  var set = {};
  var re = /(--[a-z0-9-]+)\s*:/gi, m;
  while ((m = re.exec(block)) !== null) set[m[1]] = true;
  return set;
}
var lightBlock = (appWxss.match(/\.page\.theme-light\s*\{[\s\S]*?\n\}/) || [''])[0];
var darkBlock = (appWxss.match(/\.page\.theme-dark\s*\{[\s\S]*?\n\}/) || [''])[0];
var pageBlock = (appWxss.match(/^page\s*\{[\s\S]*?\n\}/m) || [''])[0];

var lightVars = varsInBlock(lightBlock);
var darkVars = varsInBlock(darkBlock);
var pageVars = varsInBlock(pageBlock);

console.log('  .page.theme-light 定义 ' + Object.keys(lightVars).length + ' 个变量：' + Object.keys(lightVars).join(' '));
console.log('  .page.theme-dark  定义 ' + Object.keys(darkVars).length + ' 个变量：' + Object.keys(darkVars).join(' '));
console.log('  page{}            定义 ' + Object.keys(pageVars).length + ' 个变量：' + Object.keys(pageVars).join(' '));

// 收集所有 wxss（app + 6 页面）里使用的 var(--x)
var usedVars = {};
var usedWhere = {};
function collectVars(file) {
  var txt = read(file);
  var re = /var\(\s*(--[a-z0-9-]+)/gi, m;
  while ((m = re.exec(txt)) !== null) {
    usedVars[m[1]] = true;
    usedWhere[m[1]] = usedWhere[m[1]] || [];
    usedWhere[m[1]].push(rel(file));
  }
}
collectVars(path.join(ROOT, 'app.wxss'));
PAGES.forEach(function (p) { collectVars(path.join(ROOT, 'pages', p, p + '.wxss')); });

var usedList = Object.keys(usedVars).sort();
console.log('  全站使用 var(--x) 共 ' + usedList.length + ' 个：' + usedList.join(' '));

var missLight = usedList.filter(function (v) { return !lightVars[v] && !pageVars[v]; });
var missDark = usedList.filter(function (v) { return !darkVars[v] && !pageVars[v]; });
ok('C6 theme-light 覆盖全部使用变量', missLight.length === 0, '缺失：' + missLight.join(', '));
ok('C6 theme-dark 覆盖全部使用变量', missDark.length === 0, '缺失：' + missDark.join(', '));

var onlyLight = Object.keys(lightVars).filter(function (v) { return !darkVars[v]; });
var onlyDark = Object.keys(darkVars).filter(function (v) { return !lightVars[v]; });
ok('C6 light/dark 变量集合一致（无单边定义）', onlyLight.length === 0 && onlyDark.length === 0,
  'onlyLight=' + onlyLight.join(',') + ' onlyDark=' + onlyDark.join(','));

// 页面 wxss 是否自己定义了 :root/page 变量（绕过主题）
var pageVarDefs = [];
PAGES.forEach(function (p) {
  var txt = read(path.join(ROOT, 'pages', p, p + '.wxss'));
  var re = /(--[a-z0-9-]+)\s*:/gi, m;
  while ((m = re.exec(txt)) !== null) pageVarDefs.push('pages/' + p + '/' + p + '.wxss -> ' + m[1]);
});
ok('C6 页面 WXSS 未自行定义 CSS 变量', pageVarDefs.length === 0, pageVarDefs.join('; '));

/* ================================================================== */
/* E1. app.json pages vs 文件四件套                                    */
/* ================================================================== */
section('E1 页面注册与文件四件套');
appJson.pages.forEach(function (p) {
  ['.js', '.json', '.wxml', '.wxss'].forEach(function (ext) {
    var f = path.join(ROOT, p + ext);
    ok('E1 ' + p + ext + ' 存在', fs.existsSync(f));
  });
});
// 反向：pages 目录下有没有未注册的页面
var dirs = fs.readdirSync(path.join(ROOT, 'pages'));
dirs.forEach(function (d) {
  var registered = appJson.pages.indexOf('pages/' + d + '/' + d) >= 0;
  ok('E1 目录 pages/' + d + ' 已在 app.json 注册', registered);
});

/* ================================================================== */
/* E2. 跳转 url 合法性                                                 */
/* ================================================================== */
section('E2 跳转 URL 合法性');
var navHits = [];
function scanNav(file) {
  var txt = read(file);
  var re = /wx\.(navigateTo|redirectTo|reLaunch|switchTab)\s*\(\s*\{[^}]*url\s*:\s*['"]([^'"]+)['"]/g, m;
  while ((m = re.exec(txt)) !== null) navHits.push({ file: rel(file), api: m[1], url: m[2] });
}
function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    var f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f);
    else if (/\.js$/.test(e.name)) scanNav(f);
  });
}
walk(path.join(ROOT, 'pages'));
scanNav(path.join(ROOT, 'app.js'));
console.log('  跳转调用共 ' + navHits.length + ' 处：');
navHits.forEach(function (h) { console.log('    ' + h.file + ' -> ' + h.api + ' ' + h.url); });
var badNav = navHits.filter(function (h) {
  var clean = h.url.split('?')[0].replace(/^\//, '');
  return appJson.pages.indexOf(clean) < 0;
});
ok('E2 全部跳转 url 均在 app.json pages 中', badNav.length === 0,
  badNav.map(function (h) { return h.file + ':' + h.url; }).join(' | '));

/* ================================================================== */
/* E3. WXML 事件处理函数存在性                                          */
/* ================================================================== */
section('E3 WXML 事件处理函数存在性');
var missing = [];
var totalHandlers = 0;
PAGES.forEach(function (p) {
  var wxml = read(path.join(ROOT, 'pages', p, p + '.wxml'));
  var js = read(path.join(ROOT, 'pages', p, p + '.js'));
  var re = /\b(?:bind|catch):?([a-z]+)\s*=\s*"([^"]*)"/g, m;
  var handlers = [];
  while ((m = re.exec(wxml)) !== null) {
    var val = m[2].trim();
    if (!val || val.indexOf('{{') >= 0) continue;  // 动态绑定跳过
    handlers.push(val);
  }
  handlers = handlers.filter(function (v, i, a) { return a.indexOf(v) === i; });
  totalHandlers += handlers.length;
  handlers.forEach(function (h) {
    var found = new RegExp('(^|[\\s,{])' + h + '\\s*:\\s*function').test(js) ||
      new RegExp('(^|[\\s,{])' + h + '\\s*\\(\\s*\\)').test(js) ||
      new RegExp('(^|[\\s,{])' + h + '\\s*\\([^)]*\\)\\s*\\{').test(js);
    if (!found) missing.push('pages/' + p + '/' + p + '.wxml -> ' + h + '（' + p + '.js 缺失）');
  });
});
console.log('  共校验 ' + totalHandlers + ' 个事件处理函数');
if (missing.length) missing.forEach(function (x) { console.log('    缺失：' + x); });
ok('E3 所有 bindtap/bindchange/bindinput/catchtap 均有同名函数', missing.length === 0, missing.join(' | '));

/* ================================================================== */
/* E4. wx:for 是否都有 wx:key                                          */
/* ================================================================== */
section('E4 wx:for 与 wx:key');
var noKey = [];
var forCount = 0;
PAGES.forEach(function (p) {
  var wxml = read(path.join(ROOT, 'pages', p, p + '.wxml'));
  var tagRe = /<[a-zA-Z-]+(?:"[^"]*"|[^>"])*>/g, t;
  while ((t = tagRe.exec(wxml)) !== null) {
    if (!/wx:for\s*=/.test(t[0])) continue;
    forCount++;
    if (!/wx:key\s*=/.test(t[0])) {
      var lineNo = wxml.slice(0, t.index).split(/\r?\n/).length;
      noKey.push('pages/' + p + '/' + p + '.wxml:' + lineNo);
    }
  }
});
console.log('  共发现 ' + forCount + ' 处 wx:for');
ok('E4 所有 wx:for 均有 wx:key', noKey.length === 0, noKey.join(', '));

/* ================================================================== */
/* E5. 纯离线：无网络 / 云开发 API                                      */
/* ================================================================== */
section('E5 纯离线校验');
var NET_APIS = ['wx.request', 'wx.cloud', 'wx.uploadFile', 'wx.downloadFile', 'wx.connectSocket', 'wx.requestPayment'];
var netHits = [];
var allJs = [];
function walkJs(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    var f = path.join(dir, e.name);
    if (e.isDirectory()) walkJs(f);
    else if (/\.(js|wxml)$/.test(e.name)) allJs.push(f);
  });
}
walkJs(path.join(ROOT, 'pages'));
walkJs(path.join(ROOT, 'utils'));
allJs.push(path.join(ROOT, 'app.js'));
allJs.forEach(function (f) {
  var txt = read(f);
  NET_APIS.forEach(function (api) {
    if (txt.indexOf(api) >= 0) netHits.push(rel(f) + ' -> ' + api);
  });
});
ok('E5 无 wx.request / wx.cloud / wx.uploadFile 等网络调用', netHits.length === 0, netHits.join(' | '));

/* ================================================================== */
/* E6. 页面 JS 不得直接读写存储                                         */
/* ================================================================== */
section('E6 存储写操作收敛到 utils/store.js');
var storeHits = [];
// 精确匹配「读写某个 key」的 API；wx.getStorageInfoSync 只是读容量信息，不算
var STORAGE_APIS = [
  { re: /wx\.setStorageSync\s*\(/g, name: 'wx.setStorageSync' },
  { re: /wx\.getStorageSync\s*\(/g, name: 'wx.getStorageSync' },
  { re: /wx\.removeStorageSync\s*\(/g, name: 'wx.removeStorageSync' },
  { re: /wx\.clearStorageSync\s*\(/g, name: 'wx.clearStorageSync' },
  { re: /wx\.setStorage\s*\(/g, name: 'wx.setStorage' },
  { re: /wx\.getStorage\s*\(/g, name: 'wx.getStorage' },
];
PAGES.forEach(function (p) {
  var f = path.join(ROOT, 'pages', p, p + '.js');
  var txt = read(f);
  STORAGE_APIS.forEach(function (api) {
    if (api.re.test(txt)) storeHits.push('pages/' + p + '/' + p + '.js -> ' + api.name);
    api.re.lastIndex = 0;
  });
});
var appJsTxt = read(path.join(ROOT, 'app.js'));
STORAGE_APIS.forEach(function (api) {
  if (api.re.test(appJsTxt)) storeHits.push('app.js -> ' + api.name);
  api.re.lastIndex = 0;
});
ok('E6 页面 JS / app.js 无直接存储 API 调用', storeHits.length === 0, storeHits.join(' | '));

// theme.js 允许读写 app:theme（主题偏好单独存放），需明确记录
var themeStorage = [];
STORAGE_APIS.forEach(function (api) {
  api.re.lastIndex = 0;
  if (api.re.test(themeTxt)) themeStorage.push(api.name);
  api.re.lastIndex = 0;
});
console.log('  INFO utils/theme.js 直接使用存储 API：' + (themeStorage.join(', ') || '无') +
  '（主题偏好 key=app:theme，属设计内的独立模块）');

/* ================================================================== */
/* E7. project.config.json                                             */
/* ================================================================== */
section('E7 project.config.json');
var pc = JSON.parse(read(path.join(ROOT, 'project.config.json')));
console.log('  appid = ' + pc.appid + ' , libVersion = ' + pc.libVersion);
ok('E7 appid 已配置（占位值或真实 wx 开头 AppID）', ['touristappid', '', 'wxYOUR_APPID_HERE', 'TODO_APPID'].indexOf(pc.appid) >= 0 || /^wx[0-9a-f]{16}$/.test(pc.appid || ''), 'appid=' + pc.appid);
function verNum(v) {
  var a = String(v).split('.').map(Number);
  return a[0] * 10000 + (a[1] || 0) * 100 + (a[2] || 0);
}
ok('E7 libVersion >= 2.11.0（darkmode 依赖）', verNum(pc.libVersion) >= verNum('2.11.0'), 'libVersion=' + pc.libVersion);

/* ================================================================== */
/* E8. 全部 JSON 合法性                                                */
/* ================================================================== */
section('E8 全部 JSON 文件合法性');
var jsonFiles = [];
function walkJson(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    var f = path.join(dir, e.name);
    if (e.isDirectory()) walkJson(f);
    else if (/\.json$/.test(e.name)) jsonFiles.push(f);
  });
}
walkJson(ROOT);
jsonFiles.forEach(function (f) {
  try { JSON.parse(read(f)); ok('E8 ' + rel(f) + ' 合法', true); }
  catch (e) { ok('E8 ' + rel(f) + ' 合法', false, e.message); }
});
console.log('  共 ' + jsonFiles.length + ' 个 JSON 文件');

/* ================================================================== */
/* E9. TODO / FIXME / 占位                                             */
/* ================================================================== */
section('E9 TODO / FIXME / 待实现 / 占位');
var todoHits = [];
var allText = [];
function walkAll(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    var f = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walkAll(f); }
    else if (/\.(js|json|wxml|wxss|md|py|txt)$/.test(e.name)) allText.push(f);
  });
}
walkAll(ROOT);
allText.forEach(function (f) {
  var lines = read(f).split(/\r?\n/);
  lines.forEach(function (line, i) {
    if (/TODO|FIXME|待实现|占位|XXX:|HACK/.test(line)) {
      // 排除「占位值」这类正常说明
      if (/appid|占位值/.test(line)) return;
      todoHits.push(rel(f) + ':' + (i + 1) + ' -> ' + line.trim().slice(0, 100));
    }
  });
});
if (todoHits.length) todoHits.forEach(function (h) { console.log('    ' + h); });
ok('E9 无 TODO/FIXME/待实现 残留', todoHits.length === 0, todoHits.join(' | '));

/* ================================================================== */
/* 汇总                                                                */
/* ================================================================== */
console.log('\n----------------------------------------');
console.log('静态审查结果：PASS ' + pass + ' / FAIL ' + fail + ' / TOTAL ' + (pass + fail));
if (problems.length) { console.log('失败项：'); problems.forEach(function (p) { console.log('  - ' + p); }); }
console.log('----------------------------------------');
process.exit(fail === 0 ? 0 : 1);
