/**
 * footer.js —— 全站页脚
 * -----------------------------------------------------------------------------
 * 职责：根据 config.js 渲染页脚（站名、导航复链接、社交链接、版权）。
 *       与 navbar.js 同理：内容集中配置，6 个页面共用一份。
 *
 * 可调项：SITE.footerNote / SITE.github / SITE.email / SITE.since
 *         留空的外链会自动隐藏，不会出现空按钮。
 */

import { SITE, NAV } from '../core/config.js';
import { el, clear } from '../core/utils.js';
import { ICONS } from '../core/icons.js';

/** 初始化页脚。每个页面的装配脚本调用一次。 */
export function initFooter() {
  const footer = document.getElementById('site-footer');
  if (!footer) return null;

  renderFooter(footer);
  return footer;
}

function renderFooter(footer) {
  clear(footer);
  footer.classList.add('site-footer');

  /* 左：站名 + 一句话说明 */
  const brandBlock = el('div', {}, [
    el('p', {
      class: 'mono',
      style: 'color: var(--text-2); margin: 0 0 6px;',
      text: `${SITE.name} · ${SITE.nameEn}`,
    }),
    el('p', { style: 'margin: 0; font-size: 12.5px;', text: SITE.footerNote }),
  ]);

  /* 中：导航复链接 + 外链（有才显示） */
  const links = NAV.map((item) =>
    el('a', { href: item.href, text: item.label })
  );

  if (SITE.github) {
    links.push(
      el('a', {
        href: SITE.github,
        target: '_blank',
        rel: 'noopener noreferrer',
        html: `${ICONS.github}<span style="margin-left:6px">GitHub</span>`,
        style: 'display:inline-flex;align-items:center',
      })
    );
  }

  if (SITE.email) {
    links.push(
      el('a', {
        href: `mailto:${SITE.email}`,
        html: `${ICONS.mail}<span style="margin-left:6px">邮箱</span>`,
        style: 'display:inline-flex;align-items:center',
      })
    );
  }

  /* 右：版权 + 技术说明 */
  const year = new Date().getFullYear();
  const range = year > SITE.since ? `${SITE.since}–${year}` : `${SITE.since}`;
  const meta = el('div', { style: 'text-align: right;' }, [
    el('p', { class: 'footer-meta', text: `© ${range} ${SITE.owner}` }),
    el('p', {
      class: 'footer-meta',
      style: 'margin-top: 4px; opacity: .7;',
      text: 'Built with vanilla JS',
    }),
  ]);

  footer.append(
    el('div', { class: 'wrap footer-inner' }, [
      brandBlock,
      el('nav', { class: 'footer-links', 'aria-label': '页脚导航' }, links),
      meta,
    ])
  );
}
