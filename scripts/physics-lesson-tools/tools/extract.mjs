/**
 * extract.mjs — 把渲染好的 HTML 视觉稿量成「可重建 PPTX」的元素清单
 *
 * 与 skill 自带 pptx_from_rendered.py 同思路（读 getBoundingClientRect，不改 HTML），
 * 本机改用 Node 侧执行（避免 Python playwright 版本与已装 chromium 不匹配），
 * 并补齐 4 项它没有的能力：
 *   1. 伪元素实体化 —— ::before/::after 会渲染，但脚本只认真元素，不处理就会丢
 *      （本稿 .eyebrow::before 的黄条、ul.plain li::before 的方点、ol.steps li::before 的序号圈）
 *   2. 逐边边框 —— 只认 border-top*，本稿大量用 border-left:6px（.callout），会整条丢失
 *   3. SVG 内文字 —— 官方做法是整块 SVG 截图，文字随之烤进图里；这里把 <text> 提取成
 *      真文本框，截图前把文字隐藏，于是「图归图、字归字」，全部文字都可编辑
 *   4. 逐 run 字体族 —— 保留 Cambria Math / 等宽，不让整页退化成一种字体
 *
 * 用法：
 *   node extract.mjs <slidesDir> <outDir> --deck <name> [--seek 1300] [--scale 3] [--audit]
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2);
const dir = argv[0];
const outDir = argv[1];
const get = (f, d) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : d; };
const DECK = get('--deck', 'deck');
const SEEK = get('--seek', '');
const SCALE = parseInt(get('--scale', '3'), 10);
const AUDIT = argv.includes('--audit');
const assetDir = path.join(outDir, 'assets');
fs.mkdirSync(assetDir, { recursive: true });

const files = fs.readdirSync(dir).filter((f) => /^page\d+\.html$/.test(f)).sort();

const JS = String.raw`
(sel) => {
  const INLINE = ['em','b','i','strong','span','small','br','sup','sub','a','code','mark','tspan'];
  const px = (v) => parseFloat(v) || 0;
  const rgb = (v) => v || '';

  /* ── 1. 伪元素实体化：让 getBoundingClientRect 能看见它们 ───────────────── */
  const PSEUDO_PROPS = ['display','position','left','top','right','bottom','width','height',
    'min-width','max-width','margin','padding','flex','background-color','border',
    'border-top','border-left','border-right','border-bottom','border-radius','color',
    'font-family','font-size','font-weight','font-style','line-height','letter-spacing',
    'text-align','box-sizing','font-variant-numeric','vertical-align','opacity'];

  const materializePseudos = () => {
    for (const el of [...document.querySelectorAll('.slide *')]) {
      ['::before','::after'].forEach((pe, idx) => {
        const cs = getComputedStyle(el, pe);
        const content = cs.content;
        if (!content || content === 'none' || content === 'normal') return;
        const bg = cs.backgroundColor;
        const painted = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
        const bordered = px(cs.borderTopWidth) > 0 || px(cs.borderLeftWidth) > 0 ||
                         px(cs.borderRightWidth) > 0 || px(cs.borderBottomWidth) > 0;
        const raw = content.replace(/^["']|["']$/g, '');
        const isText = raw.trim() !== '';
        if (!painted && !bordered && !isText) return;

        // 先把裸文本节点包进 <span>，否则父元素「有了非行内子元素」后
        // 原文本会在遍历时被跳过（.eyebrow 就是这种混合内容）
        for (const n of [...el.childNodes]) {
          if (n.nodeType === 3 && n.textContent.trim()) {
            const s = document.createElement('span');
            n.parentNode.insertBefore(s, n);
            s.appendChild(n);
          }
        }

        const i = document.createElement('i');
        i.dataset.pseudo = pe.replace('::', '');
        for (const p of PSEUDO_PROPS) {
          const v = cs.getPropertyValue(p);
          if (v && v !== 'none' && v !== 'normal' && v !== 'auto') i.style.setProperty(p, v);
        }
        let t = '';
        if (isText) {
          if (/counter\(/.test(raw)) {
            t = String([...el.parentElement.children].indexOf(el) + 1);
          } else {
            t = raw;
          }
        }
        i.textContent = t;
        if (idx === 0) el.insertBefore(i, el.firstChild); else el.appendChild(i);
      });
    }
  };

  /* ── 2. 文本量测（含 <br> 分段、行数聚类、逐 run 字体） ──────────────────── */
  const runsOf = (root) => {
    const out = [];
    let atLineStart = true, pendingSpace = false;
    const push = (node, styleEl) => {
      let t = node.textContent;
      if (!t) return;
      t = t.replace(/\s+/g, ' ');
      if (t === ' ') { if (!atLineStart) pendingSpace = true; return; }
      if (atLineStart) t = t.replace(/^ /, '');
      if (pendingSpace && !t.startsWith(' ')) t = ' ' + t;
      pendingSpace = false;
      if (!t) return;
      atLineStart = false;
      const cs = getComputedStyle(styleEl);
      out.push({ t, fs: px(cs.fontSize), fw: cs.fontWeight,
        color: styleEl.getAttribute && styleEl.getAttribute('fill') ? cs.fill : cs.color,
        fam: cs.fontFamily, ls: cs.letterSpacing === 'normal' ? 0 : px(cs.letterSpacing),
        italic: cs.fontStyle === 'italic',
        under: cs.textDecorationLine.includes('underline') });
    };
    const walk = (node, styleEl) => {
      for (const n of node.childNodes) {
        if (n.nodeType === 3) push(n, styleEl);
        else if (n.tagName && n.tagName.toLowerCase() === 'br') { out.push({ br: true }); atLineStart = true; pendingSpace = false; }
        else if (n.nodeType === 1) walk(n, n);
      }
    };
    walk(root, root);
    for (let i = out.length - 1; i >= 0 && !out[i].br; i--) {
      if (out[i].t) { out[i].t = out[i].t.replace(/ $/, ''); break; }
    }
    return out.filter((r) => r.br || r.t);
  };

  const measure = (nodes) => {
    const rng = document.createRange();
    rng.setStartBefore(nodes[0]);
    rng.setEndAfter(nodes[nodes.length - 1]);
    const bb = rng.getBoundingClientRect();
    const rects = [...rng.getClientRects()].filter((q) => q.width > 0.5 && q.height > 0.5)
      .sort((a, b) => a.top - b.top);
    const rows = [];
    for (const q of rects) {
      const last = rows[rows.length - 1];
      if (last && q.top < last.bottom - 2) last.bottom = Math.max(last.bottom, q.bottom);
      else rows.push({ top: q.top, bottom: q.bottom });
    }
    return { bb, lines: Math.max(1, rows.length) };
  };

  /* ── 3. 逐边边框：只有「四边等宽同色」才交给主形状，否则单独出色条 ────────── */
  const SIDES = [['top','borderTopWidth','borderTopColor','h'], ['bottom','borderBottomWidth','borderBottomColor','h'],
                 ['left','borderLeftWidth','borderLeftColor','w'], ['right','borderRightWidth','borderRightColor','w']];
  const borderInfo = (cs, r) => {
    const list = SIDES.map(([s, w, c]) => ({ side: s, w: px(cs[w]), color: cs[c] }))
      .filter((x) => x.w > 0);
    if (!list.length) return { uniform: false, sides: [] };
    const first = list[0];
    const uniform = list.length === 4 && list.every((x) => Math.abs(x.w - first.w) < 0.6 && x.color === first.color);
    const sides = uniform ? [] : list.map((x) => {
      let rect;
      if (x.side === 'top') rect = { x: r.left, y: r.top, w: r.width, h: x.w };
      else if (x.side === 'bottom') rect = { x: r.left, y: r.bottom - x.w, w: r.width, h: x.w };
      else if (x.side === 'left') rect = { x: r.left, y: r.top, w: x.w, h: r.height };
      else rect = { x: r.right - x.w, y: r.top, w: x.w, h: r.height };
      return { side: x.side, color: x.color, rect };
    });
    return { uniform, sides, uniW: first.w, uniColor: first.color };
  };

  const pages = [...document.querySelectorAll(sel)];
  return pages.map((pg) => {
    materializePseudos();
    const pb = pg.getBoundingClientRect();
    const pcs = getComputedStyle(pg);
    const out = [];
    let svgSeq = 0;

    const walk = (el) => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const tag = el.tagName.toLowerCase();
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return;

      const cls = (typeof el.className === 'string' ? el.className : '');
      // 动画分组：元素自身或最近祖先带 data-anim 时把组名带出去，
      // build_editable 据此给形状命名，PowerPoint 侧再按名字挂动画。
      const animOwner = el.closest ? el.closest('[data-anim]') : null;
      const anim = animOwner ? (animOwner.getAttribute('data-anim') || '') : '';
      const base = { tag, cls, anim, x: r.left - pb.left, y: r.top - pb.top, w: r.width, h: r.height };

      if (tag === 'img') {
        out.push({ ...base, kind: 'img', src: el.getAttribute('src'), radius: px(cs.borderRadius), shadow: cs.boxShadow });
        return;
      }
      if (tag === 'svg' || tag === 'canvas') {
        // SVG 内文字先单独提取，然后把它们隐藏，再整块截图（图归图、字归字）
        const texts = [];
        for (const t of [...el.querySelectorAll('text')]) {
          const tcs = getComputedStyle(t);
          if (tcs.display === 'none' || tcs.visibility === 'hidden') continue;
          const fill = tcs.fill;
          if (!fill || fill === 'none' || fill === 'rgba(0, 0, 0, 0)') continue;
          const m = t.getScreenCTM();
          if (!m) continue;
          const bb = t.getBBox();
          if (!bb.width && !bb.height) continue;
          const P = (x, y) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
          const c = [[bb.x, bb.y], [bb.x + bb.width, bb.y], [bb.x, bb.y + bb.height], [bb.x + bb.width, bb.y + bb.height]].map(([x, y]) => P(x, y));
          const xs = c.map((p) => p.x), ys = c.map((p) => p.y);
          const x0 = Math.min(...xs) - pb.left, y0 = Math.min(...ys) - pb.top;
          const x1 = Math.max(...xs) - pb.left, y1 = Math.max(...ys) - pb.top;
          const scale = Math.hypot(m.a, m.b) || 1;
          const rot = Math.round(Math.atan2(m.b, m.a) * 180 / Math.PI * 10) / 10;
          const rs = runsOf(t).filter((q) => q.t);
          if (!rs.length) continue;
          t.setAttribute('data-hidden-text', '1');
          t.style.visibility = 'hidden';
          texts.push({
            kind: 'svgtext', cls: 'svgtext', anim, x: x0, y: y0, w: x1 - x0, h: y1 - y0,
            fs: px(tcs.fontSize) * scale, fw: tcs.fontWeight, color: fill, ta: 'center',
            rot, wrap: false, lines: 1, align: 'center',
            runs: rs.map((q) => ({ ...q, fs: q.fs * scale, color: fill })),
          });
        }
        out.push({ ...base, kind: 'svg', seq: svgSeq++, tagName: tag });
        out.push(...texts);
        return;
      }

      const hasText = el.innerText && el.innerText.trim().length > 0;
      const onlyInline = [...el.children].every((c) => INLINE.includes(c.tagName.toLowerCase()));
      const bg = cs.backgroundColor;
      const painted = bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
      const bi = borderInfo(cs, r);
      if (painted || bi.uniform) {
        out.push({ ...base, kind: 'shape', bg, bdw: bi.uniform ? bi.uniW : 0,
          bdc: bi.uniform ? bi.uniColor : '', radius: px(cs.borderRadius), shadow: cs.boxShadow, rot: 0 });
      }
      for (const s of bi.sides) {
        out.push({ kind: 'shape', cls: 'border-' + s.side, bg: s.color, bdw: 0, bdc: '',
          radius: 0, shadow: '', rot: 0,
          x: s.rect.x - pb.left, y: s.rect.y - pb.top, w: s.rect.w, h: s.rect.h });
      }
      if (hasText && onlyInline) {
        const groups = [[]];
        for (const n of el.childNodes) {
          if (n.nodeType === 1 && n.tagName.toLowerCase() === 'br') groups.push([]);
          else groups[groups.length - 1].push(n);
        }
        for (const g of groups) {
          const nodes = g.filter((n) => n.nodeType !== 3 || n.textContent.trim());
          if (!nodes.length) continue;
          const { bb, lines } = measure(nodes);
          if (!bb.height) continue;
          const tmp = document.createElement('div');
          for (const n of g) tmp.appendChild(n.cloneNode(true));
          tmp.style.cssText = 'position:absolute;visibility:hidden';
          el.appendChild(tmp);
          const rs = runsOf(tmp);
          tmp.remove();
          if (!rs.length) continue;
          const fsMax = Math.max(px(cs.fontSize), ...rs.filter((q) => !q.br).map((q) => q.fs));
          out.push({
            kind: 'text', tag, cls, anim, x: base.x, w: base.w, y: bb.top - pb.top, h: bb.height,
            fs: px(cs.fontSize), fsMax, fw: cs.fontWeight, color: cs.color,
            ls: cs.letterSpacing === 'normal' ? 0 : px(cs.letterSpacing), ta: cs.textAlign,
            lhEff: bb.height / lines, lines, wrap: lines > 1, runs: rs,
            ink: { x: bb.left - pb.left, y: bb.top - pb.top, w: bb.width, h: bb.height },
          });
        }
        for (const c of el.children) {
          const ccs = getComputedStyle(c);
          const cbg = ccs.backgroundColor;
          if (c.textContent.trim() === '' && cbg !== 'rgba(0, 0, 0, 0)' && cbg !== 'transparent') {
            const cr = c.getBoundingClientRect();
            let rot = 0;
            const mm = ccs.transform.match(/matrix\(([^)]+)\)/);
            if (mm) { const [a, b] = mm[1].split(',').map(parseFloat); rot = Math.round(Math.atan2(b, a) * 180 / Math.PI * 10) / 10; }
            out.push({ tag: c.tagName.toLowerCase(), cls: 'inline-deco', anim, kind: 'shape',
              x: cr.left - pb.left, y: cr.top - pb.top, w: cr.width, h: cr.height,
              bg: cbg, bdw: 0, bdc: '', radius: px(ccs.borderRadius), shadow: '', rot });
          }
        }
        return;
      }
      // 兜底：元素自己带裸文本节点、又有非行内子元素时，把裸文本单独提出来（防丢字）
      if (el.innerText && el.innerText.trim() && !onlyInline) {
        const bare = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
        for (const n of bare) {
          const rng = document.createRange();
          rng.selectNodeContents(n);
          const bb = rng.getBoundingClientRect();
          const s = document.createElement('div');
          s.appendChild(n.cloneNode(true));
          s.style.cssText = 'position:absolute;visibility:hidden';
          el.appendChild(s);
          const rs = runsOf(s);
          s.remove();
          if (rs.length) out.push({ kind: 'text', tag: 'baretext', cls: 'baretext', anim,
            x: bb.left - pb.left, w: bb.width, y: bb.top - pb.top, h: bb.height,
            fs: px(cs.fontSize), fsMax: px(cs.fontSize), fw: cs.fontWeight, color: cs.color,
            ls: 0, ta: cs.textAlign, lhEff: bb.height, lines: 1, wrap: false, runs: rs,
            ink: { x: bb.left - pb.left, y: bb.top - pb.top, w: bb.width, h: bb.height } });
        }
      }
      for (const c of el.children) walk(c);
    };

    for (const c of pg.children) walk(c);
    return { w: pb.width, h: pb.height, bg: pcs.backgroundColor, els: out };
  });
}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: SCALE });

const pages = [];
for (let i = 0; i < files.length; i++) {
  const f = files[i];
  const url = 'file:///' + path.resolve(dir, f).replace(/\\/g, '/');
  const errs = [];
  page.removeAllListeners('pageerror');
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(url, { waitUntil: 'load' });
  // 冻结动效：.reveal 基础样式即终态，动画关掉后测量结果确定
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none !important;transition:none !important}' });
  await page.waitForTimeout(700);
  if (SEEK) await page.evaluate((ms) => { if (typeof window.__seek === 'function') window.__seek(ms); }, Number(SEEK));
  await page.waitForTimeout(SEEK ? 350 : 0);

  const res = await page.evaluate(eval('(' + JS + ')'), '.slide');
  const p = res[0];
  for (const e of p.els) {
    if (e.kind !== 'svg') continue;
    const name = `${DECK}-p${String(i + 1).padStart(2, '0')}-svg${e.seq}.png`;
    await page.locator('.slide').locator(e.tagName).nth(e.seq)
      .screenshot({ path: path.join(assetDir, name), omitBackground: true });
    e.file = path.join(assetDir, name);
  }
  p.file = f;
  p.index = i + 1;
  pages.push(p);

  const nT = p.els.filter((e) => e.kind === 'text' || e.kind === 'svgtext').length;
  const nS = p.els.filter((e) => e.kind === 'shape').length;
  const nI = p.els.filter((e) => e.kind === 'svg' || e.kind === 'img').length;
  console.log(`p${String(i + 1).padStart(2, '0')}: 文本${nT} 形状${nS} 图${nI} 底色${p.bg}${errs.length ? ' ERR=' + errs.length : ''}`);
  if (AUDIT) {
    const items = p.els.filter((e) => e.kind === 'text' || e.kind === 'svgtext')
      .map((e) => ({ ...e, ix: e.ink ? e.ink : { x: e.x, y: e.y, w: e.w, h: e.h } }));
    const bad = [];
    for (const it of items) {
      if (it.ix.x < -1 || it.ix.y < -1 || it.ix.x + it.ix.w > 1921 || it.ix.y + it.ix.h > 1081) {
        bad.push(`   OOB  "${(it.runs || []).map(r => r.t).join('').slice(0, 24)}" [${Math.round(it.ix.x)},${Math.round(it.ix.y)},${Math.round(it.ix.w)}x${Math.round(it.ix.h)}]`);
      }
    }
    for (let a = 0; a < items.length; a++) {
      for (let b = a + 1; b < items.length; b++) {
        const A = items[a], B = items[b];
        const ix = Math.min(A.ix.x + A.ix.w, B.ix.x + B.ix.w) - Math.max(A.ix.x, B.ix.x);
        const iy = Math.min(A.ix.y + A.ix.h, B.ix.y + B.ix.h) - Math.max(A.ix.y, B.ix.y);
        if (ix <= 0 || iy <= 0) continue;
        const area = ix * iy, smaller = Math.min(A.ix.w * A.ix.h, B.ix.w * B.ix.h) || 1;
        // 双轴都要有实质重叠才算碰撞：多行标题相邻两行的「行盒」会重叠几像素，
        // 那是 tight leading 的正常现象，不是文字压字
        const rX = ix / Math.min(A.ix.w, B.ix.w), rY = iy / Math.min(A.ix.h, B.ix.h);
        if (area > 240 && area / smaller > 0.1 && rX > 0.12 && rY > 0.28) {
          bad.push(`   OVL  ${(area / smaller).toFixed(2)} "${(A.runs || []).map(r => r.t).join('').slice(0, 22)}" X "${(B.runs || []).map(r => r.t).join('').slice(0, 22)}"`);
        }
      }
    }
    if (bad.length) console.log(bad.join('\n'));
  }
}
await browser.close();

fs.writeFileSync(path.join(outDir, `dom-${DECK}.json`), JSON.stringify({ deck: DECK, seek: SEEK, pages }, null, 1));
console.log(`\n✅ dom-${DECK}.json（${pages.length} 页）→ ${outDir}`);
