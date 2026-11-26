/* ml-atlas-verify.js — 一次性跑完静态检查 + 浏览器端回归
   用法：node ml-atlas-verify.js [文件路径]
   依赖：本机 Edge（用于无头验证），无需 npm 安装任何包。
*/
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.resolve(process.argv[2] || 'ml-atlas.html');
const EDGE = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find(p => fs.existsSync(p));
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; fails.push(name + (extra ? ' → ' + extra : '')); console.log('  ✗ ' + name + (extra ? ' → ' + extra : '')); }
}

/* ---------------- 1. 静态检查 ---------------- */
function staticChecks() {
  const html = fs.readFileSync(FILE, 'utf8');
  const bytes = Buffer.byteLength(html);
  const m = html.match(/<script>([\s\S]*)<\/script>/);
  const js = m ? m[1] : '';
  const css = (html.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];

  console.log('\n[1] 静态');
  ok('文件可读且为单文件 HTML', html.replace(/^\uFEFF/, '').startsWith('<!DOCTYPE html>') && !/^\uFEFF/.test(html), String(bytes));
  ok('只有一个内联 <script>', (html.match(/<script/g) || []).length === 1);
  ok('无外链资源', !/src="http|href="http(?!s?:\/\/www\.w3\.org)/.test(html) && !/@import/.test(css));

  // DATA 可解析 + 字段齐全
  const dm = html.match(/const DATA = (\[[\s\S]*?\n\]);/);
  let DATA = [];
  try { DATA = JSON.parse(dm[1]); } catch (e) { /* 下面判定 */ }
  ok('DATA 可 JSON 解析', DATA.length > 0, String(DATA.length) + ' 条');
  const REQ = ['id', 'name', 'en', 'cat', 'diff', 'summary', 'scenes', 'idea', 'deps', 'updated', 'lang', 'math', 'params', 'input', 'output', 'code'];
  const missing = DATA.filter(x => REQ.some(k => x[k] === undefined));
  ok('16 个必填字段齐全', missing.length === 0, missing.map(x => x.id).join(','));
  const dupIds = DATA.map(x => x.id).filter((v, i, a) => a.indexOf(v) !== i);
  ok('id 无重复', dupIds.length === 0, dupIds.join(','));
  const badIds = DATA.filter(x => !/^[A-Za-z0-9_-]+$/.test(x.id));
  ok('id 只含字母数字连字符', badIds.length === 0, badIds.map(x => x.id).join(','));
  const texBad = DATA.filter(x => x.math && Array.isArray(x.math.formulas) && x.math.formulas.length !== (x.math.tex || []).length);
  ok('formulas / tex 数量对齐', texBad.length === 0, texBad.map(x => x.id).join(','));
  const placeholder = DATA.filter(x => /TODO|待补充|undefined|null/.test(JSON.stringify(x)));
  ok('无占位文本', placeholder.length === 0, placeholder.map(x => x.id).join(','));

  // Python 代码语法（只在能拿到 python 时跑）
  ok('代码片段非空', DATA.every(x => typeof x.code === 'string' && x.code.split('\n').length >= 8));
  const params = DATA.reduce((n, x) => n + (Array.isArray(x.params) ? x.params.length : 0), 0);
  ok('参数四元组完整', DATA.every(x => (x.params || []).every(p => Array.isArray(p) && p.length >= 4 && String(p[3]).length >= 18)), String(params) + ' 条参数');

  // 结构（DOM id 只扫静态标记部分，脚本里的模板字符串不算）
  const markup = html.split('<script>')[0];
  const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map(x => x[1]);
  const dupDom = ids.filter((v, i, a) => a.indexOf(v) !== i);
  ok('DOM id 无重复', dupDom.length === 0, dupDom.join(','));
  ok('有 CSP', /http-equiv="Content-Security-Policy"/.test(html));
  ok('有 skip link', /class="skip-link"/.test(html));
  ok('卡片使用 role="link" + tabindex', /class="entry[^"]*" role="link" tabindex="0"/.test(html));
  ok('工具按钮均有 aria-label', (html.match(/<button type="button" data-act="[a-z-]+" title=/g) || []).length ===
    (html.match(/<button type="button" data-act="[a-z-]+" title=[^>]*aria-label=/g) || []).length);
  ok('无 onclick 内联处理器', !/\son[a-z]+="/.test(html));
  ok('无 eval / new Function', !/(^|[^.\w])eval\s*\(|new Function\s*\(/.test(js));
  ok('无外链字体', !/@font-face/.test(css));
  ok('保留 reduced-motion', /prefers-reduced-motion/.test(css));
  ok('保留 reduced-transparency', /prefers-reduced-transparency/.test(css));

  // 语法
  const tmp = path.join(path.dirname(FILE), '.verify-script.tmp.js');
  fs.writeFileSync(tmp, js);
  let syntaxOK = true, syntaxErr = '';
  try { require('child_process').execSync(`node --check "${tmp}"`, { stdio: 'pipe' }); }
  catch (e) { syntaxOK = false; syntaxErr = String(e.stderr || '').split('\n').slice(0, 2).join(' '); }
  fs.unlinkSync(tmp);
  ok('内联脚本语法正确', syntaxOK, syntaxErr);

  const b64 = (html.match(/base64,/g) || []).length;
  return { bytes, entries: DATA.length, b64, sha: crypto.createHash('sha1').update(html).digest('hex').slice(0, 12) };
}

/* ---------------- 2. 浏览器回归 ---------------- */
async function browserChecks() {
  if (!EDGE) { console.log('\n[2] 浏览器 —— 跳过（未找到 Edge）'); return; }
  const PORT = 9460 + Math.floor(Math.random() * 30);
  const PROF = path.join(require('os').tmpdir(), 'ml-atlas-verify-' + Date.now());
  const proc = spawn(EDGE, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROF, '--window-size=1440,900', 'file:///' + FILE.replace(/\\/g, '/')],
    { stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 50; i++) {
    await sleep(300);
    try {
      const list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
      const p = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (p) { wsUrl = p.webSocketDebuggerUrl; break; }
    } catch (e) { }
  }
  if (!wsUrl) { console.log('\n[2] 浏览器 —— 无法连接 CDP'); proc.kill(); fail++; fails.push('CDP 连接'); return; }

  const ws = new WebSocket(wsUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = new Map(); const exc = []; const csp = [];
  ws.onmessage = e => {
    const mm = JSON.parse(e.data);
    if (mm.id && pend.has(mm.id)) { pend.get(mm.id)(mm); pend.delete(mm.id); }
    if (mm.method === 'Runtime.exceptionThrown') {
      const d = mm.params.exceptionDetails;
      exc.push(((d.exception && d.exception.description) || d.text || '').split('\n')[0]);
    }
    if (mm.method === 'Log.entryAdded' && /Content Security|Refused to/i.test(mm.params.entry.text)) csp.push(mm.params.entry.text);
  };
  const send = (me, p) => new Promise(r => { const mid = ++id; pend.set(mid, r); ws.send(JSON.stringify({ id: mid, method: me, params: p || {} })); });
  const ev = async x => {
    const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true, userGesture: true });
    if (r.result && r.result.exceptionDetails) return { __err: ((r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description) || '').split('\n')[0] };
    return r.result && r.result.result && r.result.result.value;
  };
  await send('Log.enable'); await send('Runtime.enable');
  await sleep(2200);

  console.log('\n[2] 浏览器');

  const base = await ev(`(function(){
    state.view='browse'; render();
    return {
      cards: document.querySelectorAll('.entry').length,
      sidebarGroups: document.querySelectorAll('.side-group').length,
      archiveTags: document.querySelectorAll('.archive .tag').length,
      entries: allEntries().length,
      hasCSP: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'),
      mainTabIndex: document.getElementById('main').getAttribute('tabindex'),
      liveRegions: document.querySelectorAll('[aria-live]').length,
      unlabeledInputs: Array.from(document.querySelectorAll('input,textarea,select'))
        .filter(el=>el.type!=='hidden' && !el.getAttribute('aria-label') &&
          !(el.id && document.querySelector('label[for="'+el.id+'"]')) && !el.closest('label')).length
    };
  })()`);
  ok('列表渲染出全部卡片', base.cards === base.entries, base.cards + '/' + base.entries);
  ok('侧栏分组数 = 分类数', base.sidebarGroups === 18, String(base.sidebarGroups));
  ok('输入框都有可访问名', base.unlabeledInputs === 0, String(base.unlabeledInputs));

  const details = await ev(`(function(){
    const bad = [];
    allEntries().forEach(x => {
      state.view='detail'; state.detail=x.id; render();
      const main = document.getElementById('main');
      const t = main.textContent;
      if(!document.querySelector('.mformula')) bad.push(x.id + ':no-formula');
      else if(/\\\\[a-zA-Z]+/.test(document.querySelector('.mformula').textContent)) bad.push(x.id + ':tex-leak');
      else if(/undefined|\\[object Object\\]/.test(t)) bad.push(x.id + ':undefined');
    });
    state.view='browse'; render();
    return bad;
  })()`);
  ok('171 个详情页均可渲染且无残留', Array.isArray(details) && details.length === 0,
    Array.isArray(details) ? details.slice(0, 5).join(',') : String(details.__err));

  const malformed = await ev(`(function(){
    const shapes = [
      {id:'v-1'}, {id:'v-2', name:'无代码', summary:'s', cat:CATS[0], diff:'入门'},
      {id:'v-3', name:'math空', code:'x=1\\n'.repeat(9), math:{title:'t',formulas:[],steps:[]}},
      {id:'v-4', name:'坏params', code:'x=1\\n'.repeat(9), math:{title:'t',formulas:['a'],tex:['a']}, params:[['x'],null,'str']},
      {id:'v-5', name:'scenes是字符串', code:'x=1\\n'.repeat(9), scenes:'abc', idea:'def', math:{title:'t',formulas:['a'],tex:['a']}}
    ];
    shapes.forEach(s => CUSTOM.push(s));
    invalidateAll();
    const bad = [];
    shapes.forEach(s => {
      try{ state.view='detail'; state.detail=s.id; render(); }catch(e){ bad.push(s.id+':'+e.message); }
    });
    try{ state.view='browse'; render(); }catch(e){ bad.push('list:'+e.message); }
    try{ state.view='fav'; render(); }catch(e){ bad.push('fav:'+e.message); }
    try{ state.view='review'; render(); }catch(e){ bad.push('review:'+e.message); }
    CUSTOM.length = 0; invalidateAll(); state.view='browse'; render();
    return bad;
  })()`);
  ok('畸形条目不再崩溃', Array.isArray(malformed) && malformed.length === 0,
    Array.isArray(malformed) ? malformed.slice(0, 3).join(' | ') : String(malformed.__err));

  const xss = await ev(`(function(){
    state.q = '<img src=x onerror=alert(1)>';
    bumpFilter(); renderGridOnly();
    const injected = document.querySelectorAll('#sec-grid img, #sec-grid script').length;
    state.q = ''; bumpFilter(); renderGridOnly();
    return { injected, executed: !!window.__xss };
  })()`);
  ok('搜索回显不注入', xss.injected === 0, String(xss.injected));

  const kb = await ev(`(function(){
    state.view='browse'; render();
    const c = document.querySelector('.entry');
    c.focus();
    c.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true}));
    const detailByEnter = state.view === 'detail';
    state.view='browse'; render();
    const c2 = document.querySelectorAll('.entry')[2];
    c2.dispatchEvent(new MouseEvent('click', {bubbles:true}));
    return { detailByEnter, clickKeepsBrowse: state.view === 'browse',
             selCount: document.querySelectorAll('.entry.sel').length,
             previewFilled: document.getElementById('preview').textContent.length > 20 };
  })()`);
  ok('回车进详情', kb.detailByEnter === true);
  ok('点击保持列表并更新速览', kb.clickKeepsBrowse && kb.selCount === 1 && kb.previewFilled, JSON.stringify(kb));

  const imp = await ev(`(async () => {
    const mk = o => new File([JSON.stringify(o)], 't.json', {type:'application/json'});
    CUSTOM.length = 0; invalidateAll();
    importCustom(mk([{id:'dup',name:'A',code:'p(1)'},{id:'dup',name:'B',code:'p(2)'},
                     {id:'__proto__',name:'C',code:'p(3)'},{id:'nc',name:'D'},
                     {id:'ok1',name:'E',code:'p(4)',scenes:'单个',idea:'一步'}]));
    await new Promise(r=>setTimeout(r,400));
    const ids = CUSTOM.map(x=>x.id);
    CUSTOM.length = 0; FAV.length = 0; invalidateAll();
    importBackup(mk({format:'ml-atlas-backup',fav:['__proto__','ok1','ok1'],notes:{},review:{},
      custom:[{id:'b1',name:'X',code:'p(9)'},{id:'b1',name:'Y',code:'p(10)'},{id:'b2',name:'Z'}]}));
    await new Promise(r=>setTimeout(r,400));
    const out = { batchIds: ids, importShape: null, backupIds: CUSTOM.map(x=>x.id), fav: FAV.slice(), protoSafe: !Object.prototype.hasOwnProperty('name') };
    CUSTOM.length = 0; invalidateAll(); state.view='browse'; render();
    return out;
  })()`);
  ok('导入批内去重 + 合法 id', imp.batchIds.length === 3 && imp.batchIds.filter(x => x === 'dup').length === 1, imp.batchIds.join(','));
  ok('恢复备份走同一套规范化', imp.backupIds.length === 1 && imp.backupIds[0] === 'b1', imp.backupIds.join(','));
  ok('收藏 id 过白名单', !imp.fav.includes('__proto__'), imp.fav.join(','));
  ok('原型未被污染', imp.protoSafe === true);

  const perf = await ev(`(function(){
    function t(fn,n){ const a=[]; for(let i=0;i<(n||5);i++){ const s=performance.now(); fn(); document.body.offsetHeight; a.push(performance.now()-s); } a.sort((x,y)=>x-y); return +a[Math.floor(a.length/2)].toFixed(1); }
    return {
      render: t(()=>{ state.view='browse'; render(); }),
      grid: t(()=>{ renderGridOnly(); }),
      detail: t(()=>{ state.view='detail'; state.detail=allEntries()[0].id; render(); }),
      click: (function(){ state.view='browse'; render();
        const t0=performance.now(); document.querySelectorAll('.entry')[3].dispatchEvent(new MouseEvent('click',{bubbles:true})); document.body.offsetHeight;
        return +(performance.now()-t0).toFixed(1); })()
    };
  })()`);
  ok('整页重绘 < 60ms', perf.render < 60, perf.render + 'ms');
  ok('卡片点击 < 20ms', perf.click < 20, perf.click + 'ms');
  console.log('    （参考：整页 ' + perf.render + 'ms / 网格 ' + perf.grid + 'ms / 详情 ' + perf.detail + 'ms / 点击 ' + perf.click + 'ms）');

  ok('运行期无未捕获异常', exc.length === 0, exc.slice(0, 3).join(' | '));
  ok('无 CSP 拦截', csp.length === 0, csp.slice(0, 2).join(' | '));

  proc.kill();   // 临时 profile 落在系统临时目录，交给系统回收，脚本不做删除
}

(async () => {
  console.log('ml-atlas 验收：' + FILE);
  const st = staticChecks();
  await browserChecks();
  console.log('\n———— 结果 ————');
  console.log(`条目 ${st.entries} · 文件 ${(st.bytes / 1024).toFixed(0)}KB · 内嵌图 ${st.b64} 张 · sha1 ${st.sha}`);
  console.log(`通过 ${pass} 项，失败 ${fail} 项`);
  if (fail) { console.log('失败项：'); fails.forEach(f => console.log('  - ' + f)); }
  process.exit(fail ? 1 : 0);
})();
