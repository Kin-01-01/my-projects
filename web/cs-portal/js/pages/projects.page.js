/**
 * projects.page.js —— 项目作品页装配
 * -----------------------------------------------------------------------------
 * 职责：通用外壳 + 项目浏览器（技术栈筛选 + 卡片网格）。
 * 具体逻辑在 modules/projects.js。
 */

import { initTheme } from '../core/theme.js';
import { initRouter } from '../core/router.js';
import { initNav } from '../modules/navbar.js';
import { initFooter } from '../modules/footer.js';
import { initReveal } from '../modules/reveal.js';
import { initProjectsExplorer } from '../modules/projects.js';
import { el, clear } from '../core/utils.js';

async function main() {
  initTheme();
  initNav();
  initFooter();
  initRouter('projects');

  const refs = {
    filterEl: document.getElementById('projects-filter'),
    listEl: document.getElementById('projects-list'),
    countEl: document.getElementById('projects-count'),
  };

  try {
    await initProjectsExplorer(refs);
  } catch (error) {
    if (refs.listEl) {
      clear(refs.listEl);
      refs.listEl.append(
        el('div', { class: 'empty-state', style: 'grid-column:1/-1' }, [
          el('p', { style: 'font-size:15px;color:var(--text-2)', text: '作品数据读取失败' }),
          el('p', { text: error.message }),
          el('p', {
            style: 'margin-top:10px',
            text: '若为直接双击打开文件，请改用本地 HTTP 服务（见 README）。',
          }),
        ])
      );
    }
    return;
  }

  initReveal();
}

main();
