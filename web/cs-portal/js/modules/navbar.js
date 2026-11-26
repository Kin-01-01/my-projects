/**
 * navbar.js —— 顶部导航栏
 * -----------------------------------------------------------------------------
 * 职责：根据 config.js 的 NAV 渲染导航栏，处理滚动渐变、移动端抽屉菜单、
 *       点击遮罩关闭、Esc 关闭、窗口尺寸变化时自动收起。
 *
 * 为什么用 JS 渲染而不是每个 HTML 各写一遍：
 *   导航项只存在于 config.js 一处，加页面/改顺序不用同步改 6 个 HTML，
 *   从根本上避免"改了 5 个页面忘了第 6 个"这类问题。
 */

import { SITE, NAV, BEHAVIOR } from '../core/config.js';
import { el, clear, throttle, $ } from '../core/utils.js';
import { ICONS } from '../core/icons.js';

/** 抽屉打开时的锁定状态缓存 */
let mobileOpen = false;

/**
 * 初始化导航栏。每个页面的装配脚本调用一次。
 * @returns {HTMLElement|null} header 元素
 */
export function initNav() {
  const header = document.getElementById('site-header');
  if (!header) return null;

  renderHeader(header);
  bindScrollState(header);
  bindMobileMenu(header);

  return header;
}

/* ------------------------------------------------------------------ 渲染 */

function renderHeader(header) {
  clear(header);
  header.classList.add('site-header');

  /* 站名：logo + 中文名 + 英文小字 */
  const brand = el(
    'a',
    {
      class: 'brand',
      href: 'index.html',
      'aria-label': `${SITE.name} · 回到首页`,
    },
    [
      el('span', { class: 'brand-mark', html: ICONS.logo }),
      el('span', {}, [
        el('span', { class: 'brand-text', text: SITE.name }),
        el('span', { class: 'brand-sub', text: SITE.nameEn }),
      ]),
    ]
  );

  /* 主导航：data-nav 供 router.js 做当前页高亮 */
  const nav = el(
    'nav',
    { class: 'nav', id: 'primary-nav', 'aria-label': '主导航' },
    NAV.map((item) =>
      el('a', {
        class: 'nav-link',
        href: item.href,
        text: item.label,
        dataset: { nav: item.id },
      })
    )
  );

  /* 移动端汉堡按钮 */
  const toggle = el(
    'button',
    {
      class: 'nav-toggle',
      id: 'nav-toggle',
      type: 'button',
      'aria-expanded': 'false',
      'aria-controls': 'primary-nav',
      'aria-label': '打开导航菜单',
    },
    [el('span'), el('span'), el('span')]
  );

  header.append(el('div', { class: 'wrap header-inner' }, [brand, nav, toggle]));
}

/* ------------------------------------------------------- 滚动后导航栏渐变 */

/**
 * 滚动到一定距离后给 header 加 is-scrolled：
 * 由 CSS 负责变成"半透明背景 + 模糊 + 下描边"。
 * 用节流是为了不在 scroll 事件里做重活（性能红线）。
 */
function bindScrollState(header) {
  const update = throttle(() => {
    header.classList.toggle(
      'is-scrolled',
      window.scrollY > BEHAVIOR.navScrollOffset
    );
  }, 100);

  update();
  window.addEventListener('scroll', update, { passive: true });
}

/* ---------------------------------------------------------- 移动端抽屉菜单 */

function bindMobileMenu(header) {
  const toggle = $('#nav-toggle', header);
  const nav = $('#primary-nav', header);
  if (!toggle || !nav) return;

  const setOpen = (open) => {
    mobileOpen = open;
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
  };

  toggle.addEventListener('click', () => setOpen(!mobileOpen));

  // 点任意导航项后立即收起，否则跳转前的 200ms 里菜单还挂在那儿
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });

  // 键盘用户按 Esc 关闭
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mobileOpen) setOpen(false);
  });

  // 点击导航之外的区域关闭
  document.addEventListener('click', (event) => {
    if (!mobileOpen) return;
    if (header.contains(event.target)) return;
    setOpen(false);
  });

  // 窗口拉宽到桌面断点以上时自动收起，避免状态残留
  const mq = window.matchMedia('(min-width: 821px)');
  const onChange = (event) => {
    if (event.matches) setOpen(false);
  };
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else mq.addListener(onChange);
}
