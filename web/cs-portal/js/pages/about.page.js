/**
 * about.page.js —— 个人简介页装配
 * -----------------------------------------------------------------------------
 * 职责：通用外壳 + 个人简介（bio / 速览 / 最近在做的事 / 学习路线）+ 技能栈。
 *
 * 数据来源：
 *   data/profile.json —— 简介、速览表、学习路线时间线
 *   data/skills.json  —— 技能栈（交给 modules/skills.js 渲染）
 *
 * 设计说明：profile.json 里所有文案都是可替换的，页面不写死任何个人内容。
 */

import { DATA } from '../core/config.js';
import { initTheme } from '../core/theme.js';
import { initRouter } from '../core/router.js';
import { initNav } from '../modules/navbar.js';
import { initFooter } from '../modules/footer.js';
import { initReveal } from '../modules/reveal.js';
import { initSkillsInto } from '../modules/skills.js';
import { el, clear, loadJSON } from '../core/utils.js';

async function main() {
  initTheme();
  initNav();
  initFooter();
  initRouter('about');

  await renderProfile();
  await initSkillsInto(document.getElementById('skills-container'));

  initReveal();
}

/* ------------------------------------------------------------ 简介整体 */

async function renderProfile() {
  const bioEl = document.getElementById('profile-bio');
  const factsEl = document.getElementById('profile-facts');
  const timelineEl = document.getElementById('timeline');
  const focusEl = document.getElementById('focus-list');

  let profile;
  try {
    profile = await loadJSON(DATA.profile);
  } catch (error) {
    [bioEl, factsEl, timelineEl, focusEl].forEach((node) => {
      if (!node) return;
      clear(node);
      node.append(
        el('div', { class: 'empty-state' }, [
          el('p', { text: '个人简介数据读取失败' }),
          el('p', { text: error.message }),
        ])
      );
    });
    return;
  }

  renderBio(bioEl, profile);
  renderFacts(factsEl, profile);
  renderFocus(focusEl, profile);
  renderTimeline(timelineEl, profile);
}

/* ---------------------------------------------------------------- 各块 */

function renderBio(container, profile) {
  if (!container) return;
  clear(container);

  container.append(
    el('h2', { class: 'panel-title' }, [
      el('span', { class: 'accent-bar', style: 'width:3px;height:15px' }),
      el('span', { text: profile.name && profile.name !== '待填写' ? profile.name : '自我介绍' }),
    ]),
    el('p', {
      class: 'mono',
      style: 'color:var(--accent);margin:0 0 18px',
      text: profile.role || '',
    }),
    el(
      'div',
      { style: 'display:grid;gap:14px' },
      (profile.bio || []).map((paragraph) =>
        el('p', {
          style: 'margin:0;color:var(--text-2);font-size:14.5px',
          text: paragraph,
        })
      )
    )
  );
}

function renderFacts(container, profile) {
  if (!container) return;
  clear(container);

  container.append(
    el('h2', { class: 'panel-title' }, [
      el('span', { class: 'accent-bar', style: 'width:3px;height:15px' }),
      el('span', { text: '速览' }),
    ]),
    el(
      'div',
      { class: 'kv-list' },
      (profile.facts || []).map((fact) =>
        el('div', { class: 'kv-row' }, [
          el('span', { class: 'kv-key', text: fact.key }),
          el('span', { class: 'kv-val', text: fact.value }),
        ])
      )
    )
  );
}

function renderFocus(container, profile) {
  if (!container) return;
  clear(container);

  const stateText = { current: '进行中', plan: '规划中', done: '已完成' };

  (profile.focus || []).forEach((item) => {
    container.append(
      el('div', { class: 'card', style: 'margin-bottom:14px', dataset: { reveal: '' } }, [
        el(
          'div',
          {
            style:
              'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px',
          },
          [
            el('span', { style: 'font-weight:600;font-size:15px', text: item.title }),
            el('span', {
              class: item.state === 'plan' ? 'badge' : 'tag tag-accent',
              text: stateText[item.state] || '进行中',
            }),
          ]
        ),
        el('p', {
          style: 'margin:0;color:var(--text-2);font-size:13.5px',
          text: item.desc,
        }),
      ])
    );
  });
}

function renderTimeline(container, profile) {
  if (!container) return;
  clear(container);

  (profile.timeline || []).forEach((item) => {
    const stateClass =
      item.state === 'done'
        ? ' is-done'
        : item.state === 'current'
          ? ' is-current'
          : '';

    container.append(
      el('div', { class: `timeline-item${stateClass}`, dataset: { reveal: '' } }, [
        el('p', { class: 'timeline-date', text: item.date }),
        el('h3', { class: 'timeline-title', text: item.title }),
        el('p', { class: 'timeline-desc', text: item.desc }),
      ])
    );
  });
}

/* 说明：时间线与速览暂未使用图标。后续要给它们加图标时，
 * 从 core/icons.js 导入 ICONS 即可，不需要改动本文件的其它部分。 */

main();
