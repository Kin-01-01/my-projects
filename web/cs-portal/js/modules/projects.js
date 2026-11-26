/**
 * projects.js —— 项目作品展示的逻辑与渲染
 * -----------------------------------------------------------------------------
 * 职责：读取 data/projects.json，按技术栈筛选，渲染卡片网格。
 *
 * 数据契约（projects.json）：
 *   { "updated": "2026-09-22", "projects": [ {
 *       id, title, desc, status, year?, stack[], tags?[],
 *       cover?, repo?, demo?, highlights?[] } ] }
 *
 * 交互说明：整张卡片不是 <a>（卡内还要放"源码/演示"两个链接，嵌套 a 是非法 HTML），
 *           改用 article + 卡内链接，悬浮反馈由 .card-hoverable 提供。
 */

import { DATA, PROJECT_STATUS } from '../core/config.js';
import {
  el,
  clear,
  loadJSON,
  getQuery,
  buildUrl,
  truncate,
  $$,
} from '../core/utils.js';
import { ICONS } from '../core/icons.js';
import { refreshReveal } from './reveal.js';

/* ------------------------------------------------------------------ 数据 */

export async function fetchProjects() {
  const raw = await loadJSON(DATA.projects);
  const list = Array.isArray(raw) ? raw : raw.projects;
  if (!Array.isArray(list)) {
    throw new Error('projects.json 结构不对，期望数组或 { projects: [...] }');
  }
  // 新的在前：年份倒序
  return [...list].sort((a, b) => (b.year || 0) - (a.year || 0));
}

/** 汇总全部技术栈标签及使用次数 */
export function collectStack(projects) {
  const counter = {};
  projects.forEach((p) => {
    (p.stack || []).forEach((s) => {
      counter[s] = (counter[s] || 0) + 1;
    });
  });
  return Object.entries(counter)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh'));
}

/* ------------------------------------------------------------------ 渲染 */

/** 生成缩略图区：有截图用图片，没有就显示项目缩写占位，不留空框 */
function createThumb(project) {
  const statusText = PROJECT_STATUS[project.status] || project.status || '';

  const children = [];

  if (project.cover) {
    children.push(
      el('img', {
        src: project.cover,
        alt: `${project.title} 截图`,
        loading: 'lazy',
        decoding: 'async',
      })
    );
  } else {
    const initials = String(project.title || '?')
      .replace(/[^\w\u4e00-\u9fa5]/g, '')
      .slice(0, 2)
      .toUpperCase();
    children.push(el('span', { class: 'project-thumb-fallback', text: initials }));
  }

  if (statusText) {
    children.push(el('span', { class: 'project-status', text: statusText }));
  }

  return el('div', { class: 'project-thumb' }, children);
}

/** 单个项目卡片 */
export function createProjectCard(project) {
  const stackTags = (project.stack || []).map((s) =>
    el('span', { class: 'tag', text: s })
  );

  /* 卡内操作区：源码 / 演示，没配链接就显示"待补充"而不是死链 */
  const actions = [];
  if (project.repo) {
    actions.push(
      el('a', {
        class: 'mono',
        href: project.repo,
        target: '_blank',
        rel: 'noopener noreferrer',
        style: 'color:var(--accent-2)',
        html: `${ICONS.code}<span style="margin-left:4px">源码</span>`,
      })
    );
  }
  if (project.demo) {
    actions.push(
      el('a', {
        class: 'mono',
        href: project.demo,
        target: '_blank',
        rel: 'noopener noreferrer',
        style: 'color:var(--accent)',
        html: `${ICONS.external}<span style="margin-left:4px">演示</span>`,
      })
    );
  }
  if (!actions.length) {
    actions.push(el('span', { class: 'dim mono', text: '链接待补充' }));
  }

  return el(
    'article',
    {
      class: 'card card-hoverable project-card',
      dataset: { reveal: '', stack: (project.stack || []).join('|') },
    },
    [
      createThumb(project),
      el('div', { class: 'project-body' }, [
        el('h3', { class: 'card-title', text: project.title }),
        el('p', { class: 'card-desc', text: truncate(project.desc, 130) }),
        stackTags.length
          ? el('div', { class: 'tag-row', style: 'margin-top:16px' }, stackTags)
          : null,
        el('div', { class: 'card-foot' }, [
          el('span', { text: String(project.year || '') }),
          el('div', { style: 'display:flex;gap:14px;align-items:center' }, actions),
        ]),
      ]),
    ]
  );
}

/** 渲染项目网格，返回条数 */
export function renderProjects(container, projects) {
  if (!container) return 0;
  clear(container);

  if (!projects.length) {
    container.append(
      el('div', { class: 'empty-state', style: 'grid-column:1/-1' }, [
        el('p', { style: 'font-size:15px;color:var(--text-2)', text: '这个技术栈下还没有项目' }),
        el('p', { text: '换个技术栈，或者看全部项目。' }),
      ])
    );
    return 0;
  }

  projects.forEach((p) => container.append(createProjectCard(p)));
  return projects.length;
}

/** 技术栈筛选条 */
export function renderStackFilter(container, projects, activeTech = null) {
  if (!container) return;
  clear(container);

  container.append(
    el('button', {
      class: `filter-chip${!activeTech ? ' is-active' : ''}`,
      type: 'button',
      text: '全部',
      dataset: { tech: '' },
    })
  );

  // 技术栈按使用次数排序，只显示前 12 个。
  // 不留上限的话，项目一多筛选条会撑成三四行，反而看不清有哪些可选。
  // 需要看全部时把 12 调大即可（或改成带搜索的下拉，第三阶段视情况再定）。
  collectStack(projects)
    .slice(0, 12)
    .forEach((item) => {
      container.append(
        el('button', {
          class: `filter-chip${activeTech === item.name ? ' is-active' : ''}`,
          type: 'button',
          dataset: { tech: item.name },
          html: `${item.name}<span class="filter-count">${item.count}</span>`,
        })
      );
    });
}

/* ------------------------------------------------------------- 页面装配器 */

/**
 * 项目页一站式初始化。
 * @param {object} refs
 * @param {HTMLElement} refs.filterEl 技术栈筛选条容器
 * @param {HTMLElement} refs.listEl   项目网格容器
 * @param {HTMLElement} [refs.countEl] 计数容器
 */
export async function initProjectsExplorer({ filterEl, listEl, countEl }) {
  const allProjects = await fetchProjects();
  const state = { tech: getQuery('tech', null) };

  renderStackFilter(filterEl, allProjects, state.tech);

  const rerender = () => {
    const result = state.tech
      ? allProjects.filter((p) => (p.stack || []).includes(state.tech))
      : allProjects;

    renderProjects(listEl, result);

    if (countEl) {
      clear(countEl);
      countEl.append(
        el('span', {
          class: 'dim mono',
          text: `共 ${result.length} / ${allProjects.length} 个项目${
            state.tech ? ` · ${state.tech}` : ''
          }`,
        })
      );
    }

    $$('[data-tech]', filterEl).forEach((node) =>
      node.classList.toggle(
        'is-active',
        (node.dataset.tech || '') === (state.tech || '')
      )
    );

    refreshReveal(listEl);
  };

  filterEl?.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-tech]');
    if (!chip) return;

    const value = chip.dataset.tech || null;
    state.tech = state.tech === value ? null : value;

    history.replaceState(
      null,
      '',
      buildUrl('projects.html', { tech: state.tech })
    );
    rerender();
  });

  rerender();
  return { state, rerender };
}
