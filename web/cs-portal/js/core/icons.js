/**
 * icons.js —— 内联 SVG 图标集
 * -----------------------------------------------------------------------------
 * 职责：集中管理界面用到的所有图标，避免图标散落在各个模块里。
 *
 * 用法：import { ICONS } from '../core/icons.js';
 *       el('span', { html: ICONS.book })
 *
 * 为什么内联而不是 iconfont / 独立 svg 文件：
 *   · 零额外请求，首屏更快；
 *   · 用 currentColor 描边，自动跟随文字颜色与主题变量；
 *   · 增删图标只改这一个文件。
 *
 * 约定：所有图标统一 24×24 viewBox、1.6 描边、无填充，风格保持一致。
 */

/**
 * 统一包裹成 SVG 字符串。
 *
 * class="ico" 不是装饰：Tailwind 的 Preflight 会把 svg 设成 display:block，
 * 图标和文字写在一起时会各占一行。layout.css 里的 .ico 规则（类选择器，
 * 特异度高于 Preflight 的标签选择器）负责把图标拉回行内。删这个类会立刻
 * 导致所有"图标 + 文字"的组合断成两行。
 */
const wrap = (paths, size = 20) =>
  `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
        stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;

export const ICONS = {
  /* ---- 品牌 ---- */
  // 一棵正在长叶子的树，呼应"枯木逢春"
  logo: wrap(
    `<path d="M12 21V9"/><path d="M12 9 7.5 13"/><path d="M12 12.5 16.5 16"/>
     <path d="M12 9a3.2 3.2 0 1 0-1.6-6A3.2 3.2 0 0 0 12 9Z"/>
     <circle cx="6.6" cy="13.6" r="2.1"/><circle cx="17.6" cy="16.8" r="2.1"/>`,
    22
  ),

  /* ---- 导航 ---- */
  menu: wrap(`<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>`, 20),
  close: wrap(`<path d="M6 6l12 12"/><path d="M18 6 6 18"/>`, 20),

  /* ---- 三大板块 ---- */
  book: wrap(
    `<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H5.5A1.5 1.5 0 0 1 4 16.5v-11Z"/>
     <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h4.5a1.5 1.5 0 0 0 1.5-1.5v-11Z"/>`
  ),
  cube: wrap(
    `<path d="M12 3 20 7.2v9.6L12 21l-8-4.2V7.2L12 3Z"/>
     <path d="M4 7.2 12 11.4l8-4.2"/><path d="M12 11.4V21"/>`
  ),
  tree: wrap(
    `<circle cx="12" cy="5" r="2.2"/>
     <circle cx="6" cy="13" r="2.2"/><circle cx="18" cy="13" r="2.2"/>
     <circle cx="9" cy="20" r="2.2"/><circle cx="15" cy="20" r="2.2"/>
     <path d="M12 7.2v2.4M10.4 11.4 7.6 12.2M13.6 11.4l2.8.8M6.9 14.6 8.3 18M17.1 14.6 15.7 18"/>`
  ),

  /* ---- 元信息 ---- */
  calendar: wrap(
    `<rect x="3.5" y="5" width="17" height="15" rx="2.4"/>
     <path d="M3.5 10h17"/><path d="M8 3.5V6M16 3.5V6"/>`,
    14
  ),
  tag: wrap(
    `<path d="M11.6 3.5H19a1.5 1.5 0 0 1 1.5 1.5v7.4a2 2 0 0 1-.6 1.4l-6.6 6.6a1.5 1.5 0 0 1-2.1 0l-7-7a1.5 1.5 0 0 1 0-2.1l6.6-6.6a2 2 0 0 1 1.4-.6Z"/>
     <circle cx="16.4" cy="7.6" r="1.3"/>`,
    14
  ),
  search: wrap(
    `<circle cx="11" cy="11" r="6.2"/><path d="m15.6 15.6 4 4"/>`,
    15
  ),
  arrowRight: wrap(`<path d="M5 12h13"/><path d="m12.5 6 6 6-6 6"/>`, 16),
  arrowLeft: wrap(`<path d="M19 12H6"/><path d="m11.5 18-6-6 6-6"/>`, 16),
  external: wrap(
    `<path d="M14 4h6v6"/><path d="M20 4 11 13"/>
     <path d="M18 14.5V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.5"/>`,
    15
  ),
  clock: wrap(`<circle cx="12" cy="12" r="8.2"/><path d="M12 7.6V12l3 1.8"/>`, 14),
  spark: wrap(
    `<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 20.5l-1.9-8.1-5.1-1.9 5.1-1.9L12 3.5Z"/>`,
    15
  ),
  github: wrap(
    `<path d="M9.2 20.5v-3c-2.6.5-3.5-1.1-3.8-1.9-.2-.5-.9-1.6-1.5-1.9-.6-.3-.2-.7.4-.6.9.1 1.6.8 2 1.4.7 1.1 1.9 1 2.6.7.1-.7.4-1.3.8-1.7-2.6-.3-4.4-1.4-4.4-4.2 0-1.1.4-2 1-2.7-.2-.5-.3-1.6.1-2.4 0 0 .9-.3 2.8.9a9 9 0 0 1 4.6 0c1.9-1.2 2.8-.9 2.8-.9.4.8.3 1.9.1 2.4.6.7 1 1.6 1 2.7 0 2.8-1.8 3.9-4.4 4.2.5.5.9 1.3.9 2.2v3.5"/>`,
    16
  ),
  mail: wrap(
    `<rect x="3.5" y="5.5" width="17" height="13" rx="2.2"/><path d="m4.5 7.5 7.5 5.5 7.5-5.5"/>`,
    16
  ),
  folder: wrap(
    `<path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h3l1.6 2h8.4A1.5 1.5 0 0 1 20 9.5v8A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-10Z"/>`,
    15
  ),
  code: wrap(`<path d="m9 8-4 4 4 4"/><path d="m15 8 4 4-4 4"/>`, 15),
};

/** 按名字取图标，取不到时返回空字符串，避免界面出现 undefined */
export function icon(name, size) {
  const svg = ICONS[name];
  if (!svg) return '';
  if (!size) return svg;
  return svg.replace(/width="\d+"/, `width="${size}"`).replace(/height="\d+"/, `height="${size}"`);
}
