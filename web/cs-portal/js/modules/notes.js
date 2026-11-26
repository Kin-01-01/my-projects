/**
 * notes.js —— 笔记列表的逻辑与渲染
 * -----------------------------------------------------------------------------
 * 职责：
 *   · 读取 data/notes.index.json；
 *   · 分类侧栏、标签筛选、关键词搜索、排序；
 *   · 渲染笔记卡片列表；
 *   · 把筛选状态同步到 URL（?cat=&tag=&q=），保证链接可分享、可前进后退。
 *
 * 数据契约（notes.index.json）：
 *   { "updated": "2026-09-22", "notes": [ { id, title, category, tags[],
 *     date, updated?, summary, path, status?, minutes? } ] }
 *   path 相对于 config.js 的 DATA.notesRoot。
 *
 * 说明：筛选在浏览器端完成。笔记量级在几百篇以内这样最省事；
 *       真要上千篇，把 filterNotes 换成请求后端即可，调用方不用改。
 */

import { DATA, CATEGORIES, BEHAVIOR, getCategory } from '../core/config.js';
import {
  el,
  clear,
  loadJSON,
  formatDate,
  getQuery,
  buildUrl,
  debounce,
  truncate,
  countBy,
  $$,
} from '../core/utils.js';
import { ICONS } from '../core/icons.js';
import { refreshReveal } from './reveal.js';

/* ------------------------------------------------------------------ 数据 */

/**
 * 读取笔记索引。
 * 兼容两种返回结构：直接是数组，或包一层 { notes: [...] }。
 */
export async function fetchNotes() {
  const raw = await loadJSON(DATA.notesIndex);
  const list = Array.isArray(raw) ? raw : raw.notes;
  if (!Array.isArray(list)) {
    throw new Error('notes.index.json 结构不对，期望数组或 { notes: [...] }');
  }
  return list;
}

/* ------------------------------------------------------------------ 筛选 */

/** 排序：默认按日期倒序（新的在前），可切标题或分类 */
export function sortNotes(notes, mode = BEHAVIOR.defaultSort) {
  const list = [...notes];
  if (mode === 'title') {
    return list.sort((a, b) => String(a.title).localeCompare(String(b.title), 'zh'));
  }
  if (mode === 'category') {
    return list.sort((a, b) => {
      const c = String(a.category).localeCompare(String(b.category));
      return c !== 0 ? c : String(b.date).localeCompare(String(a.date));
    });
  }
  return list.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/**
 * 按分类 / 标签 / 关键词过滤。
 * 关键词同时匹配标题、摘要与标签，大小写不敏感。
 */
export function filterNotes(notes, { cat = 'all', tag = null, q = '' } = {}) {
  const keyword = String(q).trim().toLowerCase();

  return notes.filter((note) => {
    if (cat && cat !== 'all' && note.category !== cat) return false;
    if (tag && !(note.tags || []).includes(tag)) return false;
    if (!keyword) return true;

    const haystack = [note.title, note.summary, ...(note.tags || [])]
      .join(' ')
      .toLowerCase();
    return haystack.includes(keyword);
  });
}

/** 汇总全部标签及其出现次数，按次数倒序 */
export function collectTags(notes) {
  const counter = {};
  notes.forEach((note) => {
    (note.tags || []).forEach((t) => {
      counter[t] = (counter[t] || 0) + 1;
    });
  });
  return Object.entries(counter)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh'));
}

/* ------------------------------------------------------------------ 渲染 */

/** 单张笔记卡片 */
export function createNoteCard(note) {
  const category = getCategory(note.category);

  const meta = [
    el('span', { class: 'tag tag-accent', text: category.label }),
    ...(note.tags || []).slice(0, 3).map((t) => el('span', { class: 'tag', text: t })),
  ];

  if (note.minutes) {
    meta.push(
      el('span', {
        class: 'dim mono',
        style: 'margin-left:auto',
        html: `${ICONS.clock}<span style="margin-left:4px">${note.minutes} 分钟</span>`,
      })
    );
  }

  return el(
    'a',
    {
      class: 'card card-link note-item',
      href: `note.html?id=${encodeURIComponent(note.id)}`,
      dataset: { reveal: '' },
      'aria-label': `阅读笔记：${note.title}`,
    },
    [
      el('div', { class: 'note-item-head' }, [
        el('h3', { class: 'card-title', text: note.title }),
        el('span', { class: 'note-item-date', text: formatDate(note.date) }),
      ]),
      el('p', { class: 'card-desc', text: truncate(note.summary, 110) }),
      el(
        'div',
        { class: 'note-item-meta' },
        meta.length ? meta : [el('span', { class: 'dim mono', text: '未分类' })]
      ),
    ]
  );
}

/** 渲染笔记列表，返回渲染条数 */
export function renderNoteList(container, notes) {
  if (!container) return 0;
  clear(container);

  if (!notes.length) {
    container.append(
      el('div', { class: 'empty-state' }, [
        el('p', { style: 'font-size:15px;color:var(--text-2)', text: '没有匹配的笔记' }),
        el('p', { text: '换个分类或关键词试试，也可能是筛选条件太窄了。' }),
      ])
    );
    return 0;
  }

  notes.forEach((note) => container.append(createNoteCard(note)));
  return notes.length;
}

/** 分类侧栏（移动端自动变成横向滚动条） */
export function renderSideNav(container, notes, activeCat = 'all') {
  if (!container) return;
  clear(container);

  const counts = countBy(notes, 'category');

  container.append(el('p', { class: 'side-nav-title', text: '分类 / CATEGORY' }));

  CATEGORIES.forEach((cat) => {
    const count = cat.id === 'all' ? notes.length : counts[cat.id] || 0;
    // 空分类不显示，避免点进去看到一片空白
    if (cat.id !== 'all' && count === 0) return;

    container.append(
      el(
        'a',
        {
          class: `side-nav-item${cat.id === activeCat ? ' is-active' : ''}`,
          href: buildUrl('notes.html', { cat: cat.id === 'all' ? null : cat.id }),
          dataset: { cat: cat.id },
        },
        [
          el('span', { text: cat.label }),
          el('span', { class: 'side-nav-count', text: String(count) }),
        ]
      )
    );
  });
}

/** 标签筛选条 + 搜索框 */
export function renderFilterBar(container, notes, { activeTag = null, q = '' } = {}) {
  if (!container) return { searchInput: null };
  clear(container);

  // 全部标签
  container.append(
    el('button', {
      class: `filter-chip${!activeTag ? ' is-active' : ''}`,
      type: 'button',
      text: '全部标签',
      dataset: { tag: '' },
    })
  );

  // 出现 2 次以上的标签才展示，否则一排只出现一次的长尾标签会淹没重点
  collectTags(notes)
    .filter((t) => t.count >= 2)
    .slice(0, 10)
    .forEach((t) => {
      container.append(
        el('button', {
          class: `filter-chip${activeTag === t.name ? ' is-active' : ''}`,
          type: 'button',
          dataset: { tag: t.name },
          html: `${t.name}<span class="filter-count">${t.count}</span>`,
        })
      );
    });

  // 搜索框
  const searchInput = el('input', {
    class: 'search-box',
    type: 'search',
    value: q || '',
    placeholder: '搜索标题、摘要、标签…',
    'aria-label': '搜索笔记',
  });
  container.append(searchInput);

  return { searchInput };
}

/** 结果计数条 */
export function renderResultCount(container, shown, total, { cat, tag, q } = {}) {
  if (!container) return;
  clear(container);

  const parts = [];
  if (cat && cat !== 'all') parts.push(getCategory(cat).label);
  if (tag) parts.push(`#${tag}`);
  if (q) parts.push(`“${q}”`);

  const condition = parts.length ? ` · ${parts.join(' · ')}` : '';
  container.append(
    el('span', {
      class: 'dim mono',
      text: `共 ${shown} / ${total} 篇${condition}`,
    })
  );
}

/* ------------------------------------------------------------- 页面装配器 */

/**
 * 笔记页一站式初始化。
 * 页面脚本只需调用它并传入三个容器，其余（状态、事件、URL 同步）都在内部完成。
 *
 * @param {object} refs
 * @param {HTMLElement} refs.sideEl   分类侧栏容器
 * @param {HTMLElement} refs.filterEl 标签筛选条容器
 * @param {HTMLElement} refs.listEl   列表容器
 * @param {HTMLElement} [refs.countEl] 结果计数容器
 */
export async function initNotesExplorer({ sideEl, filterEl, listEl, countEl }) {
  const allNotes = sortNotes(await fetchNotes());

  // 状态：初始值从 URL 读，保证分享链接能还原筛选条件
  const state = {
    cat: getQuery('cat', 'all'),
    tag: getQuery('tag', null),
    q: getQuery('q', ''),
  };

  renderSideNav(sideEl, allNotes, state.cat);
  const { searchInput } = renderFilterBar(filterEl, allNotes, state);

  const rerender = () => {
    const result = filterNotes(allNotes, state);
    renderNoteList(listEl, result);
    renderResultCount(countEl, result.length, allNotes.length, state);

    // 同步侧栏与筛选条的高亮状态
    $$('[data-cat]', sideEl).forEach((node) =>
      node.classList.toggle('is-active', node.dataset.cat === state.cat)
    );
    $$('[data-tag]', filterEl).forEach((node) =>
      node.classList.toggle(
        'is-active',
        (node.dataset.tag || '') === (state.tag || '')
      )
    );

    // 新插入的卡片注册入场动画
    refreshReveal(listEl);
  };

  const syncUrl = () => {
    const url = buildUrl('notes.html', {
      cat: state.cat === 'all' ? null : state.cat,
      tag: state.tag,
      q: state.q,
    });
    // replaceState 而非 pushState：换筛选条件不该产生一堆历史记录
    history.replaceState(null, '', url);
  };

  // 分类点击：侧栏是普通链接，这里拦截以保持无刷新切换
  sideEl?.addEventListener('click', (event) => {
    const link = event.target.closest('[data-cat]');
    if (!link) return;
    event.preventDefault();
    state.cat = link.dataset.cat;
    syncUrl();
    rerender();
  });

  // 标签点击
  filterEl?.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-tag]');
    if (!chip) return;
    const value = chip.dataset.tag || null;
    state.tag = state.tag === value ? null : value; // 再点一次取消
    syncUrl();
    rerender();
  });

  // 搜索（防抖 200ms，避免每敲一个字就重排整个列表）
  if (searchInput) {
    const onSearch = debounce(() => {
      state.q = searchInput.value.trim();
      syncUrl();
      rerender();
    }, 200);
    searchInput.addEventListener('input', onSearch);
  }

  rerender();
  return { state, rerender };
}
