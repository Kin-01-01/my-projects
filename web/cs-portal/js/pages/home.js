/**
 * home.js —— 首页装配
 * -----------------------------------------------------------------------------
 * 职责：把通用外壳（主题、导航、页脚、路由）+ 首页专属内容（三板块入口、
 *       最新笔记）拼起来。
 *
 * 装配顺序有讲究：先骨架后数据，最后才 initReveal()。
 * 因为滚动入场需要观察 DOM 里已存在的元素——如果先 initReveal() 再塞数据，
 * 后插入的卡片不会进入观察队列，会一直停在隐藏态。
 */

import { SECTIONS } from '../core/config.js';
import { initTheme } from '../core/theme.js';
import { initRouter } from '../core/router.js';
import { initNav } from '../modules/navbar.js';
import { initFooter } from '../modules/footer.js';
import { initReveal } from '../modules/reveal.js';
import { fetchNotes, sortNotes, createNoteCard } from '../modules/notes.js';
import { fetchProjects } from '../modules/projects.js';
import { el, clear } from '../core/utils.js';
import { ICONS } from '../core/icons.js';

/** 首页显示几篇最新笔记 */
const LATEST_COUNT = 3;

async function main() {
  /* 1. 通用外壳 */
  initTheme();
  initNav();
  initFooter();
  initRouter('home');

  /* 2. 内容（并行加载，任一失败都不影响另一块） */
  const counts = await loadCounts();
  renderEntryCards(counts);
  await renderLatestNotes();

  /* 3. 内容就位后再注册入场动画 */
  initReveal();
}

/**
 * 统计各板块的数量。
 * 用 allSettled 而不是 all：作品数据缺失时，笔记入口照样要正常显示。
 */
async function loadCounts() {
  const [notes, projects] = await Promise.allSettled([
    fetchNotes(),
    fetchProjects(),
  ]);

  return {
    notes: notes.status === 'fulfilled' ? notes.value.length : null,
    projects: projects.status === 'fulfilled' ? projects.value.length : null,
  };
}

/* ------------------------------------------------------- 三板块入口卡 */

function renderEntryCards(counts) {
  const grid = document.getElementById('entry-grid');
  if (!grid) return;
  clear(grid);

  SECTIONS.forEach((section) => {
    grid.append(createEntryCard(section, counts));
  });
}

function createEntryCard(section, counts) {
  let meta = '';

  if (section.metaKey === 'notes') {
    meta = counts.notes === null ? '笔记索引暂不可用' : `共 ${counts.notes} 篇笔记`;
  } else if (section.metaKey === 'projects') {
    meta =
      counts.projects === null ? '作品数据暂不可用' : `共 ${counts.projects} 个项目`;
  } else {
    meta = '第二阶段上线';
  }

  return el(
    'a',
    {
      class: 'card card-link entry-card',
      href: section.href,
      dataset: { reveal: '' },
    },
    [
      el('span', { class: 'entry-icon', html: ICONS[section.icon] || ICONS.spark }),
      el('h3', { class: 'card-title', text: section.title }),
      el('p', { class: 'card-desc', text: section.desc }),
      el('span', { class: 'entry-meta', text: meta }),
    ]
  );
}

/* --------------------------------------------------------- 最新笔记 */

async function renderLatestNotes() {
  const container = document.getElementById('latest-notes');
  if (!container) return;

  try {
    const notes = sortNotes(await fetchNotes()).slice(0, LATEST_COUNT);
    clear(container);

    if (!notes.length) {
      container.append(
        el('div', { class: 'empty-state' }, [
          el('p', { text: '还没有笔记。写下第一篇之后，这里就会有内容了。' }),
        ])
      );
      return;
    }

    notes.forEach((note) => container.append(createNoteCard(note)));
  } catch (error) {
    clear(container);
    container.append(
      el('div', { class: 'empty-state' }, [
        el('p', { text: '笔记加载失败' }),
        el('p', { text: error.message }),
      ])
    );
  }
}

main();
