/**
 * note.page.js —— 笔记详情页装配
 * -----------------------------------------------------------------------------
 * 职责：通用外壳 + 正文渲染（Markdown → HTML + 代码高亮 + 目录）。
 * 具体逻辑在 modules/note-render.js。
 *
 * 依赖 window.marked / window.hljs，由 note.html 里的两个 <script> 提前加载。
 * 模块内部对二者缺失都做了降级，不会因为 CDN 挂了就白屏。
 */

import { initTheme } from '../core/theme.js';
import { initRouter } from '../core/router.js';
import { initNav } from '../modules/navbar.js';
import { initFooter } from '../modules/footer.js';
import { initNoteDetail } from '../modules/note-render.js';

async function main() {
  initTheme();
  initNav();
  initFooter();
  // 笔记详情归属"笔记"导航，router 内部会把父级导航高亮起来
  initRouter('note');

  await initNoteDetail({
    headerEl: document.getElementById('note-header'),
    bodyEl: document.getElementById('note-body'),
    tocEl: document.getElementById('note-toc'),
  });
}

main();
