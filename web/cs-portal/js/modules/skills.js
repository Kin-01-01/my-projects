/**
 * skills.js —— 技能栈可视化
 * -----------------------------------------------------------------------------
 * 职责：读取 data/skills.json，渲染"分组 + 熟练度条"，并在滚动到可视区时
 *       播放填充动画（从 0 长到目标宽度）。按分组逐个触发，滚到哪长到哪。
 *
 * 数据契约（skills.json）：
 *   { "updated": "2026-09-22",
 *     "levels": ["了解","入门","熟练","扎实","精通"],   // 可选，覆盖默认文案
 *     "groups": [ { id, label, items: [ { name, level: 1-5, note? } ] } ] }
 *
 * 设计说明：level 用 1–5 的整数表达阶段感，而不是百分比。
 *           "72%" 是假精确，五档反而更诚实，也更好维护。
 */

import { DATA, BEHAVIOR } from '../core/config.js';
import { el, clear, loadJSON, prefersReducedMotion } from '../core/utils.js';

/** 默认档位文案，可被 skills.json 里的 levels 覆盖 */
const DEFAULT_LEVELS = ['了解', '入门', '熟练', '扎实', '精通'];

/** 同组内每根条的错峰间隔（ms） */
const STAGGER_MS = 60;
/** 错峰封顶在第几根 —— 再往后是"等待"，不是"节奏" */
const MAX_STAGGER_INDEX = 7;

/* ------------------------------------------------------------------ 数据 */

export async function fetchSkills() {
  const raw = await loadJSON(DATA.skills);
  const groups = Array.isArray(raw) ? raw : raw.groups;
  if (!Array.isArray(groups)) {
    throw new Error('skills.json 结构不对，期望数组或 { groups: [...] }');
  }
  return { groups, levels: raw.levels || DEFAULT_LEVELS };
}

/* ------------------------------------------------------------------ 渲染 */

/** 单行技能：名称 + 进度条 + 档位文字 */
function createSkillRow(skill, levels) {
  const level = Math.max(1, Math.min(5, Number(skill.level) || 1));

  return el(
    'div',
    { class: 'skill-row' },
    [
      el('span', { class: 'skill-name', text: skill.name }),
      el('span', { class: 'skill-track' }, [
        el('span', {
          class: 'skill-fill',
          // 目标宽度先写进 data 属性，等滚动到位再由 JS 填上 width，
          // 这样动画一定从 0 开始，不会在页面加载瞬间就"长满"
          dataset: { level: String(level * 20) },
          style: 'width:0',
        }),
      ]),
      el('span', {
        class: 'skill-level',
        text: levels[level - 1] || String(level),
      }),
    ]
  );
}

/** 一组技能（如"编程语言""工具与框架"） */
function createSkillGroup(group, levels) {
  return el('section', { class: 'skill-group', dataset: { reveal: '' } }, [
    el('h3', { class: 'skill-group-title' }, [
      el('span', { class: 'accent-bar', style: 'width:3px;height:14px' }),
      el('span', { text: group.label }),
    ]),
    el(
      'div',
      {},
      (group.items || []).map((skill) => createSkillRow(skill, levels))
    ),
  ]);
}

/** 渲染全部分组 */
export function renderSkillGroups(container, groups, levels = DEFAULT_LEVELS) {
  if (!container) return;
  clear(container);
  groups.forEach((group) => container.append(createSkillGroup(group, levels)));
}

/**
 * 把一组技能条从 0 长到各自的目标宽度。
 * @param {HTMLElement} group 技能分组元素
 * @param {number} delayBase 基准延迟（ms），用来配合页面整体的入场节奏
 */
function fillGroupBars(group, delayBase = 0) {
  group.querySelectorAll('.skill-fill').forEach((fill, index) => {
    const step = Math.min(index, MAX_STAGGER_INDEX) * STAGGER_MS;
    window.setTimeout(() => {
      // 目标宽度存在 data-level 上，这里只是"到点了就把宽度放出来"
      fill.style.width = `${fill.dataset.level}%`;
    }, delayBase + step);
  });
}

/** 无条件填满：给不支持观察器、或用户要求减少动效的场景用 */
function fillAllBars(container) {
  container.querySelectorAll('.skill-fill').forEach((fill) => {
    fill.style.width = `${fill.dataset.level}%`;
  });
}

/**
 * 滚动到可视区时播放填充动画。
 * 用 IntersectionObserver 而不是 scroll 事件——技能条有二十来根，
 * 在 scroll 回调里逐根改宽度会明显掉帧。
 *
 * 注意这里是观察"每一个分组"，而不是观察整个技能容器：
 * threshold 是按元素自身面积比例算的，容器会随分组增多不断变高，
 * 一旦高到超过视口，比例就永远达不到阈值，所有条会一直空着不填充。
 * 分组的高度是稳定的，不会踩这个坑。
 */
function animateBarsWhenVisible(container) {
  const groups = [...container.querySelectorAll('.skill-group')];
  if (!groups.length) return;

  // 浏览器不支持 / 用户开了"减少动效"：直接给终值，绝不留空条
  if (typeof IntersectionObserver !== 'function' || prefersReducedMotion()) {
    fillAllBars(container);
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        fillGroupBars(entry.target, BEHAVIOR.skillFillDelay);
        obs.unobserve(entry.target);
      });
    },
    { threshold: 0, rootMargin: '0px 0px -40px 0px' }
  );

  groups.forEach((group) => observer.observe(group));
}

/**
 * 关于页一站式初始化：读取并渲染技能栈。
 * @param {HTMLElement} container 技能栈容器
 */
export async function initSkillsInto(container) {
  if (!container) return null;

  try {
    const { groups, levels } = await fetchSkills();
    renderSkillGroups(container, groups, levels);
    animateBarsWhenVisible(container);
    return groups;
  } catch (error) {
    clear(container);
    container.append(
      el('div', { class: 'empty-state' }, [
        el('p', { text: '技能数据读取失败' }),
        el('p', { text: error.message }),
      ])
    );
    return null;
  }
}
