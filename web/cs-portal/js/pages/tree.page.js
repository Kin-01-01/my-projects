/**
 * tree.page.js —— 知识树页装配
 * -----------------------------------------------------------------------------
 * 第一阶段：只装载通用外壳。画布内是一张静态占位 SVG（见 knowledge-tree.html），
 *           用来先把版式、图例、操作提示的位置定下来。
 * 第二阶段：把 config.js 的 FEATURES.knowledgeTree 改成 true，
 *           本文件会自动去加载 modules/knowledge-tree.js 并接管画布。
 *
 * 这里用动态 import 而不是顶部静态 import，是为了让第一阶段完全不产生
 * 对 D3 / anime / tippy / Hammer 的请求——功能没开，就不要付流量和解析成本。
 */

import { FEATURES } from '../core/config.js';
import { initTheme } from '../core/theme.js';
import { initRouter } from '../core/router.js';
import { initNav } from '../modules/navbar.js';
import { initFooter } from '../modules/footer.js';
import { initReveal } from '../modules/reveal.js';

async function main() {
  initTheme();
  initNav();
  initFooter();
  initRouter('tree');

  if (FEATURES.knowledgeTree) {
    try {
      const { initKnowledgeTree } = await import('../modules/knowledge-tree.js');
      await initKnowledgeTree(document.getElementById('tree-stage'));
    } catch (error) {
      // 第二阶段模块加载失败时，保留占位图，不让页面变成空白
      console.warn('[tree] 知识树模块加载失败，继续使用占位画布：', error);
    }
  }

  initReveal();
}

main();
