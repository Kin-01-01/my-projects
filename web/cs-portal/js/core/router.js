/**
 * router.js —— 页面导航与切换过渡
 * -----------------------------------------------------------------------------
 * 职责：
 *   1. 根据 body[data-page] 给顶部导航打上当前页高亮；
 *   2. 拦截站内链接点击，播放"遮罩淡入 → 跳转 → 新页淡出"的连续过渡；
 *   3. 处理浏览器前进/后退（含 bfcache 恢复）时遮罩残留的问题。
 *
 * 设计说明：
 *   本站是多页应用（MPA），"路由"就是真实文件。这里不做虚拟路由，
 *   只统一接管跳转时机，让多页切换在观感上接近单页。
 *   若将来改成 SPA，只需替换本文件，页面层与模块层无需改动。
 */

import { FEATURES, BEHAVIOR, NAV } from './config.js';
import { prefersReducedMotion } from './utils.js';

/** 遮罩元素缓存 */
let veil = null;
/** 防止重复触发跳转 */
let navigating = false;

/* ------------------------------------------------------------------ 对外接口 */

/**
 * 初始化路由。每个页面在装配脚本里调用一次。
 * @param {string} currentPage 与 config.js 里 NAV 的 id 对应，如 'notes'
 */
export function initRouter(currentPage) {
  markActiveNav(currentPage);

  if (FEATURES.pageTransition && !prefersReducedMotion()) {
    setupTransition();
  }

  // 新页面入场：轻微上浮，避免内容生硬跳出
  const main = document.querySelector('main');
  if (main && !prefersReducedMotion()) {
    main.classList.add('page-enter');
  }
}

/** 主动跳转（供脚本内使用，会带上过渡效果） */
export function navigate(href) {
  if (FEATURES.pageTransition && !prefersReducedMotion() && veil) {
    leaveWithVeil(href);
  } else {
    location.assign(href);
  }
}

/* -------------------------------------------------------------- 导航高亮 */

/**
 * 给当前页对应的导航项加 is-active。
 * 按 id 匹配而不是按 URL 匹配 —— 这样 notes.html?cat=database 也能正确高亮"笔记"。
 */
export function markActiveNav(currentPage) {
  if (!currentPage) return;

  const activeIds = resolveActiveIds(currentPage);

  NAV.forEach((item) => {
    const isActive = activeIds.includes(item.id);
    document.querySelectorAll(`[data-nav="${item.id}"]`).forEach((node) => {
      node.classList.toggle('is-active', isActive);
      if (isActive) node.setAttribute('aria-current', 'page');
      else node.removeAttribute('aria-current');
    });
  });
}

/**
 * 把页面标识映射到需要高亮的导航 id 列表。
 * 有些页面没有独立导航项（如笔记详情），需要归属到父级导航。
 */
function resolveActiveIds(currentPage) {
  const map = {
    home: ['home'],
    notes: ['notes'],
    note: ['notes'], // 笔记详情高亮"笔记"
    projects: ['projects'],
    tree: ['tree'],
    about: ['about'],
  };
  return map[currentPage] || [currentPage];
}

/* ------------------------------------------------------------ 切换过渡 */

function setupTransition() {
  veil = document.getElementById('page-veil');
  if (!veil) return;

  // 用捕获阶段监听，确保比页面自身的点击处理更早拿到事件
  document.addEventListener('click', onDocumentClick, true);

  // 从浏览器缓存（bfcache）返回时，遮罩可能停在"已激活"状态，需要复位
  window.addEventListener('pageshow', resetVeil);
  window.addEventListener('popstate', resetVeil);
}

function onDocumentClick(event) {
  if (navigating) return;

  // 只处理鼠标左键的普通点击，修饰键点击保持浏览器默认行为
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const link = event.target.closest('a[href]');
  if (!link) return;
  if (link.target === '_blank' || link.hasAttribute('download')) return;
  if (link.dataset.noTransition !== undefined) return;

  const href = link.getAttribute('href');
  if (!href || href.startsWith('#') || /^(mailto:|tel:|javascript:)/.test(href))
    return;

  let url;
  try {
    url = new URL(href, location.href);
  } catch {
    return;
  }

  // 站外链接不接管
  if (url.origin !== location.origin) return;

  // 同一页面的纯锚点跳转交给浏览器平滑滚动
  const samePage =
    url.pathname === location.pathname && url.search === location.search;
  if (samePage && url.hash) return;

  event.preventDefault();
  leaveWithVeil(url.href);
}

function leaveWithVeil(href) {
  navigating = true;
  veil.classList.add('is-active');
  window.setTimeout(() => {
    location.assign(href);
  }, BEHAVIOR.transitionMs);
}

function resetVeil() {
  navigating = false;
  if (veil) veil.classList.remove('is-active');
}
