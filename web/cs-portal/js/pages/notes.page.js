/**
 * notes.page.js —— 笔记列表页装配
 * -----------------------------------------------------------------------------
 * 职责：通用外壳 + 笔记浏览器（分类/标签/搜索/列表）。
 * 具体逻辑都在 modules/notes.js 里，这里只负责把 DOM 容器和模块接起来。
 */

import { initTheme } from '../core/theme.js';
import { initRouter } from '../core/router.js';
import { initNav } from '../modules/navbar.js';
import { initFooter } from '../modules/footer.js';
import { initReveal } from '../modules/reveal.js';
import { initNotesExplorer } from '../modules/notes.js';
import { el, clear } from '../core/utils.js';

async function main() {
  initTheme();
  initNav();
  initFooter();
  initRouter('notes');

  const refs = {
    sideEl: document.getElementById('notes-side'),
    filterEl: document.getElementById('notes-filter'),
    listEl: document.getElementById('notes-list'),
    countEl: document.getElementById('notes-count'),
  };

  try {
    await initNotesExplorer(refs);
  } catch (error) {
    // 数据读不到时给出可操作的原因，而不是留一片空白
    showLoadError(refs.listEl, error);
    return;
  }

  initReveal();
}

/** 索引读取失败时的兜底提示 */
function showLoadError(container, error) {
  if (!container) return;
  clear(container);
  container.append(
    el('div', { class: 'empty-state' }, [
      el('p', { style: 'font-size:15px;color:var(--text-2)', text: '笔记索引读取失败' }),
      el('p', { text: error.message }),
      el('p', {
        style: 'margin-top:10px',
        text: '如果是直接双击打开 HTML，浏览器的 CORS 策略会拦下 fetch。请改用本地 HTTP 服务访问，见 README。',
      }),
    ])
  );
}

main();
