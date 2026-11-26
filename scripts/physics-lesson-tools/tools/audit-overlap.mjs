// 审计：文本重叠 / 越界 / 溢出父容器 / SVG 内文字
// 用法: node audit-overlap.mjs <slidesDir>
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const dir = process.argv[2];
const files = fs.readdirSync(dir).filter(f => /^page\d+\.html$/.test(f)).sort();

const JS = `() => {
  const INLINE = ['em','b','i','strong','span','small','br','sup','sub','a','code','mark'];
  const vis = el => {
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.02;
  };
  const isInline = el => INLINE.includes(el.tagName.toLowerCase());
  const isHost = el => {
    if (!vis(el)) return false;
    if (!el.innerText || !el.innerText.trim()) return false;
    const kids = [...el.children];
    if (!kids.every(isInline)) return false;
    return el.getBoundingClientRect().width > 0;
  };
  const insideSvg = el => !!el.closest('svg');

  const all = [...document.querySelectorAll('.slide *')];
  // 最顶层文本宿主（父链上没有别的宿主）
  const hosts = all.filter(el => !insideSvg(el) && isHost(el) && !(function(){
    let p = el.parentElement;
    while (p && p !== document.body) { if (!insideSvg(p) && isHost(p)) return true; p = p.parentElement; }
    return false;
  })());

  const svgTexts = all.filter(el => el.tagName.toLowerCase() === 'text');

  const item = (el, kind) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      kind,
      tag: el.tagName.toLowerCase(),
      cls: (typeof el.className === 'string' ? el.className : '').slice(0, 26),
      id: el.id || (el.closest('[id]') ? el.closest('[id]').id : ''),
      txt: (el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 34),
      fs: Math.round(parseFloat(cs.fontSize) * 10) / 10,
      x: Math.round(r.left), y: Math.round(r.top),
      w: Math.round(r.width), h: Math.round(r.height),
    };
  };

  const items = [...hosts.map(e => item(e, 'text')), ...svgTexts.map(e => item(e, 'svgtext'))];

  const outOfBounds = [];
  const overflowParent = [];
  for (const it of items) {
    if (it.x < -1 || it.y < -1 || it.x + it.w > 1921 || it.y + it.h > 1081) outOfBounds.push(it);
  }
  // 溢出其定位祖先（卡片/栏）的文本
  for (const el of hosts) {
    let p = el.parentElement, box = null;
    while (p && p !== document.body) {
      const cs = getComputedStyle(p);
      if (cs.position === 'absolute' || cs.position === 'relative') { box = p.getBoundingClientRect(); break; }
      p = p.parentElement;
    }
    if (!box) continue;
    const r = el.getBoundingClientRect();
    const over = Math.max(box.left - r.left, r.right - box.right, box.top - r.top, r.bottom - box.bottom);
    if (over > 10) {
      overflowParent.push({ ...item(el, 'text'), over: Math.round(over), parent: p.id || p.className });
    }
  }

  const overlaps = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ix <= 0 || iy <= 0) continue;
      const area = ix * iy;
      const smaller = Math.min(a.w * a.h, b.w * b.h) || 1;
      if (area < 260) continue;
      const ratio = area / smaller;
      if (ratio > 0.12) overlaps.push({ ratio: Math.round(ratio * 100) / 100, a, b });
    }
  }

  // 伪元素里带文字的（会被烤进背景层）
  const pseudoText = [];
  for (const el of all) {
    for (const pe of ['::before', '::after']) {
      const c = getComputedStyle(el, pe).content;
      if (c && c !== 'none' && c !== 'normal' && /[^"']/.test(c.replace(/^["']|["']$/g, ''))) {
        pseudoText.push(el.tagName.toLowerCase() + '.' + (typeof el.className === 'string' ? el.className : '') + pe + '=' + c.slice(0, 20));
      }
    }
  }

  // 渐变使用（决定能否纯矢量化）
  let grads = 0;
  for (const el of all) {
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none' && bg.includes('gradient')) grads++;
  }

  return {
    minFont: items.length ? Math.min(...items.map(i => i.fs)) : 0,
    nText: hosts.length, nSvgText: svgTexts.length, grads,
    outOfBounds, overflowParent, overlaps, pseudoText: [...new Set(pseudoText)],
  };
}`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
for (const f of files) {
  const url = 'file:///' + path.resolve(dir, f).replace(/\\/g, '/');
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForTimeout(1600);
  const r = await p.evaluate(eval('(' + JS + ')'));
  const nm = f.replace('.html', '');
  const flags = [];
  if (r.outOfBounds.length) flags.push('OOB=' + r.outOfBounds.length);
  if (r.overflowParent.length) flags.push('OVERFLOW=' + r.overflowParent.length);
  if (r.overlaps.length) flags.push('OVERLAP=' + r.overlaps.length);
  console.log(`${nm}: 文本${r.nText} svg文本${r.nSvgText} 渐变${r.grads} minFont=${r.minFont} ${flags.join(' ') || 'OK'}`);
  for (const o of r.outOfBounds) console.log(`   OOB   ${o.kind} ${o.cls} "${o.txt}" [${o.x},${o.y},${o.w}x${o.h}]`);
  for (const o of r.overflowParent) console.log(`   OFPAR ${o.cls} "${o.txt}" 超出${o.over}px parent=${o.parent}`);
  for (const o of r.overlaps) console.log(`   OVL   ${o.ratio} :: ${o.a.kind}.${o.a.cls}"${o.a.txt}"[${o.a.x},${o.a.y},${o.a.w}x${o.a.h}] X ${o.b.kind}.${o.b.cls}"${o.b.txt}"[${o.b.x},${o.b.y},${o.b.w}x${o.b.h}]`);
  if (r.pseudoText.length) console.log(`   PSEUDO ${r.pseudoText.join(' | ')}`);
}
await b.close();
