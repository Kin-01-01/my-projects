/**
 * theme.js —— 主题（深色 / 浅色）读写
 * -----------------------------------------------------------------------------
 * 职责：把用户选择的主题写进 <html data-theme="...">，并持久化到 localStorage。
 *
 * 现状：第一阶段只有深色主题，但整套机制已经就位 ——
 *       想启用明暗切换，只要：
 *         1) 补齐 theme.css 里 [data-theme="light"] 的变量；
 *         2) 在页面上放一个 <button data-theme-toggle>；
 *         3) 调用 initTheme()（本文件已导出）。
 *       组件样式无需改动，因为它们只引用变量。
 */

const STORAGE_KEY = 'cs-portal:theme';
const THEMES = ['dark', 'light'];
const DEFAULT_THEME = 'dark';

/** 读取用户偏好；隐私模式下 localStorage 可能不可用，全部包在 try 里 */
export function getTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return THEMES.includes(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** 写入并立即生效 */
export function setTheme(theme) {
  const next = THEMES.includes(theme) ? theme : DEFAULT_THEME;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* 存不了就算了，不影响本次生效 */
  }
  applyTheme(next);
  return next;
}

/**
 * 把主题应用到 DOM。
 * 同时设置 color-scheme，让浏览器原生控件（滚动条、表单、输入法）
 * 跟随主题，避免深色页面里冒出白色控件。
 */
export function applyTheme(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  root.dispatchEvent(
    new CustomEvent('themechange', { detail: { theme } })
  );
}

/** 在页面装配阶段调用一次，把用户的偏好恢复上去 */
export function applyStoredTheme() {
  applyTheme(getTheme());
}

/** 深色 ↔ 浅色切换 */
export function toggleTheme() {
  return setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

/**
 * 完整初始化：恢复偏好 + 绑定所有 [data-theme-toggle] 按钮。
 * 第一阶段页面上没有切换按钮，调用它是无害的空操作，
 * 但保留入口，第三阶段加按钮时不用改这里。
 */
export function initTheme() {
  applyStoredTheme();

  document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = toggleTheme();
      btn.setAttribute('aria-label', next === 'dark' ? '切换到浅色' : '切换到深色');
    });
  });
}
