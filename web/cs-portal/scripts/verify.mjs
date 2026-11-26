/**
 * scripts/verify.mjs —— 结构与数据自检
 * -----------------------------------------------------------------------------
 * 用法：
 *   node scripts/verify.mjs            # 只做静态检查（不需要起服务）
 *   node scripts/verify.mjs --serve    # 额外检查页面 HTTP 可达性
 *   环境变量 PORT=8080 node scripts/verify.mjs --serve
 *
 * 检查什么：
 *   1. 每个页面里的本地资源引用（css / js / 图片）是否都存在
 *   2. ES Module 的相对导入：路径存在、且被导入的名字确实被导出过
 *   3. data/*.json 是否合法
 *   4. 数据之间的交叉引用：笔记 path 是否指向真实文件、id 是否重复、
 *      分类是否在 config.js 里登记过、技能 level 是否在 1-5 之间
 *   5. 每个页面是否具备 header / footer / veil / data-page 四个挂载契约
 *   6. body[data-page] 的值能否被 router 正确高亮
 *
 * 为什么值得留着：加一篇笔记要同时动 Markdown 文件和索引 JSON，
 * 漏一处不会报错，只会在页面上悄悄少一块。这个脚本就是防这个的。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const withServe = process.argv.includes('--serve');
const PORT = process.env.PORT || 8080;
const ORIGIN = `http://127.0.0.1:${PORT}/`;

const PAGES = [
  'index.html',
  'notes.html',
  'note.html',
  'projects.html',
  'about.html',
  'knowledge-tree.html',
];

const errors = [];
const warnings = [];
const passed = [];

const ok = (m) => passed.push(`  ok   ${m}`);
const bad = (m) => errors.push(`  FAIL ${m}`);
const warn = (m) => warnings.push(`  warn ${m}`);

/* ------------------------------------------------- 工具：去掉注释后扫描 */

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function exportsOf(file) {
  const src = fs.readFileSync(file, 'utf8');
  const names = new Set();

  for (const m of src.matchAll(
    /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g
  )) {
    names.add(m[1]);
  }
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) {
    m[1].split(',').forEach((part) => {
      const n = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (n) names.add(n);
    });
  }
  if (/export\s+default/.test(src)) names.add('default');
  return names;
}

/* ------------------------------------------------------ 1. HTTP 可达性 */

if (withServe) {
  let reachable = true;
  try {
    const res = await fetch(ORIGIN + PAGES[0], { signal: AbortSignal.timeout(2000) });
    reachable = res.ok;
  } catch {
    reachable = false;
  }

  if (!reachable) {
    warn(`本地服务未启动（${ORIGIN}），跳过 HTTP 检查。先运行 python -m http.server ${PORT}`);
  } else {
    for (const page of PAGES) {
      try {
        const res = await fetch(ORIGIN + page);
        if (res.status !== 200) bad(`${page} → HTTP ${res.status}`);
        else ok(`${page} → 200`);
      } catch (e) {
        bad(`${page} → 请求失败 ${e.message}`);
      }
    }
  }
}

/* ------------------------------------------- 2. HTML 本地资源引用检查 */

for (const page of PAGES) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
  const refs = new Set();

  for (const m of html.matchAll(/(?:href|src)\s*=\s*"([^"]+)"/g)) {
    const v = m[1];
    if (/^(https?:|data:|mailto:|tel:|#)/.test(v)) continue;
    refs.add(v);
  }

  for (const ref of refs) {
    const clean = ref.split('#')[0].split('?')[0];
    if (!clean) continue;
    if (!fs.existsSync(path.join(ROOT, clean))) {
      bad(`${page} 引用不存在的本地文件：${ref}`);
    }
  }
  ok(`${page} 本地引用 ${refs.size} 个，全部存在`);
}

/* ---------------------------------- 3. ES Module 相对导入（路径 + 名字） */

const jsFiles = walk(path.join(ROOT, 'js'));

for (const file of jsFiles) {
  const code = stripComments(fs.readFileSync(file, 'utf8'));
  const rel = path.relative(ROOT, file).replace(/\\/g, '/');

  for (const m of code.matchAll(/from\s+'(\.[^']+)'/g)) {
    const target = path.resolve(path.dirname(file), m[1]);
    if (!fs.existsSync(target)) bad(`${rel} 导入不存在：${m[1]}`);
  }

  // 不只看"路径在不在"，还要看"名字有没有被导出"。
  // 漏一个具名导入在浏览器里是运行时 ReferenceError，
  // 而页面其余部分照常渲染，很容易漏看。
  for (const m of code.matchAll(/import\s*\{([^}]+)\}\s*from\s*'(\.[^']+)'/g)) {
    const target = path.resolve(path.dirname(file), m[2]);
    if (!fs.existsSync(target)) continue;
    const available = exportsOf(target);

    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0]?.trim();
      if (!name) continue;
      if (!/^[A-Za-z_$][\w$]*$/.test(name)) continue;
      if (!available.has(name)) {
        bad(`${rel} 导入了 ${name}，但 ${m[2]} 并没有导出它`);
      }
    }
  }

  // 动态 import：第二阶段才会建的模块允许缺失
  for (const m of code.matchAll(/import\(\s*'(\.[^']+)'\s*\)/g)) {
    const target = path.resolve(path.dirname(file), m[1]);
    if (!fs.existsSync(target)) {
      if (/knowledge-tree|particles|cursor-glow/.test(m[1])) {
        warn(`${rel} 动态导入 ${m[1]} 尚未创建（后续阶段模块，预期如此）`);
      } else {
        bad(`${rel} 动态导入不存在：${m[1]}`);
      }
    }
  }
}
ok(`${jsFiles.length} 个 JS 文件的相对导入路径与具名导出已全部校验`);

/* -------------------------------------------------------- 4. JSON 合法性 */

const jsonFiles = [
  'data/notes.index.json',
  'data/projects.json',
  'data/skills.json',
  'data/profile.json',
];

const parsed = {};
for (const f of jsonFiles) {
  try {
    parsed[f] = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    ok(`${f} JSON 合法`);
  } catch (e) {
    bad(`${f} JSON 解析失败：${e.message}`);
  }
}

/* -------------------------------------------- 5. 数据交叉引用一致性 */

const configSrc = stripComments(
  fs.readFileSync(path.join(ROOT, 'js/core/config.js'), 'utf8')
);
const catIds = [...configSrc.matchAll(/id:\s*'([a-z]+)',\s*label:/g)].map((m) => m[1]);

const noteList = parsed['data/notes.index.json']?.notes ?? [];
const noteIds = new Set();
for (const n of noteList) {
  if (noteIds.has(n.id)) bad(`笔记 id 重复：${n.id}`);
  noteIds.add(n.id);

  if (!fs.existsSync(path.join(ROOT, 'data/notes', n.path || ''))) {
    bad(`笔记 ${n.id} 的 path 指向的文件不存在：${n.path}`);
  }
  for (const field of ['id', 'title', 'category', 'date', 'summary', 'path']) {
    if (!n[field]) bad(`笔记 ${n.id} 缺少字段 ${field}`);
  }
  if (n.category && !catIds.includes(n.category)) {
    bad(`笔记 ${n.id} 的分类 "${n.category}" 未在 config.js 的 CATEGORIES 中登记`);
  }
}
ok(`笔记 ${noteList.length} 篇：id 唯一、正文文件存在、分类均已登记`);

const projects = parsed['data/projects.json']?.projects ?? [];
const projectIds = new Set();
for (const p of projects) {
  if (projectIds.has(p.id)) bad(`项目 id 重复：${p.id}`);
  projectIds.add(p.id);
  if (p.cover && !fs.existsSync(path.join(ROOT, p.cover))) {
    bad(`项目 ${p.id} 的 cover 不存在：${p.cover}`);
  }
  if (!p.title || !p.desc) bad(`项目 ${p.id} 缺少 title 或 desc`);
}
ok(`项目 ${projects.length} 个：id 唯一、cover 引用有效`);

const groups = parsed['data/skills.json']?.groups ?? [];
let skillCount = 0;
for (const g of groups) {
  for (const s of g.items ?? []) {
    skillCount += 1;
    if (!Number.isInteger(s.level) || s.level < 1 || s.level > 5) {
      bad(`技能 "${s.name}" 的 level 必须是 1-5 的整数，当前为 ${s.level}`);
    }
  }
}
ok(`技能 ${groups.length} 组 / ${skillCount} 项：level 全部合法`);

for (const t of parsed['data/profile.json']?.timeline ?? []) {
  if (!['done', 'current', 'plan'].includes(t.state)) {
    warn(`学习路线 "${t.title}" 的 state 为 "${t.state}"，不在 done / current / plan 中`);
  }
}
ok(`学习路线 ${parsed['data/profile.json']?.timeline?.length ?? 0} 条：state 取值正常`);

/* ---------------------------------------------------- 6. 页面挂载契约 */

const navIds = [
  ...configSrc.matchAll(/id:\s*'([a-z]+)',\s*label:\s*'[^']+',\s*href:/g),
].map((m) => m[1]);
const routerSrc = fs.readFileSync(path.join(ROOT, 'js/core/router.js'), 'utf8');

for (const page of PAGES) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8');

  for (const anchor of ['id="site-header"', 'id="site-footer"', 'id="page-veil"']) {
    if (!html.includes(anchor)) bad(`${page} 缺少 ${anchor}`);
  }

  const pageId = html.match(/data-page="([a-z]+)"/)?.[1];
  if (!pageId) {
    bad(`${page} 缺少 body[data-page]`);
    continue;
  }
  if (!navIds.includes(pageId) && !routerSrc.includes(`${pageId}:`)) {
    bad(`${page} 的 data-page="${pageId}" 无法被 router 高亮（既不在 NAV 也不在映射表）`);
  }
}
ok(`六个页面都含 header / footer / veil / data-page 四个挂载契约`);

/* ---------------------------------------------------------- 输出 */

console.log('================ cs-portal 自检 ================');
console.log(passed.join('\n'));

if (warnings.length) {
  console.log('\n---------------- 提醒 ----------------');
  console.log(warnings.join('\n'));
}

if (errors.length) {
  console.log('\n---------------- 错误 ----------------');
  console.log(errors.join('\n'));
  console.log(`\n共 ${errors.length} 处错误。`);
  process.exit(1);
}

console.log('\n全部通过。');
