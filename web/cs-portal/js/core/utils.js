/**
 * utils.js —— 无依赖工具函数
 * -----------------------------------------------------------------------------
 * 职责：DOM 快捷方法、字符串处理、时间格式化、查询参数读写、网络请求封装。
 * 原则：只放通用能力，不放业务逻辑；所有导出函数单一职责、可单独测试。
 */

/* ------------------------------------------------------------------ DOM 快捷 */

/** 查询单个元素，等价于 document.querySelector */
export const $ = (selector, root = document) => root.querySelector(selector);

/** 查询多个元素，返回真正的数组（可直接用 map / filter / forEach） */
export const $$ = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

/**
 * 用 JS 创建元素，替代手写 innerHTML 字符串拼接。
 * @param {string} tag 标签名
 * @param {object} attrs 属性：class / text / html / dataset / 原生属性 / onXxx 事件
 * @param {Array} children 子节点（字符串会被当作文本节点）
 * @returns {HTMLElement}
 *
 * 例子：el('a', { class: 'card', href: 'x.html', text: '看看' })
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  Object.entries(attrs).forEach(([key, value]) => {
    if (value === null || value === undefined || value === false) return;

    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else node.setAttribute(key, value === true ? '' : value);
  });

  (Array.isArray(children) ? children : [children]).forEach((child) => {
    if (child === null || child === undefined) return;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });

  return node;
}

/** 清空一个容器（比 innerHTML = '' 更明确） */
export function clear(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

/* ------------------------------------------------------------- 字符串处理 */

/** 转义 HTML，防止 Markdown 标题、项目描述里的 < > 破坏结构（XSS 防护） */
export function escapeHtml(input) {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 截断长文本，超出部分用省略号 */
export function truncate(text, max = 120) {
  const str = String(text ?? '');
  return str.length > max ? str.slice(0, max).trimEnd() + '…' : str;
}

/** 生成可用于 id / 锚点的短横线串（保留中文，去掉符号与空格） */
export function slugify(text) {
  return String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s]+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/* ------------------------------------------------------------------ 时间 */

/** 解析 'YYYY-MM-DD' 或 ISO 字符串，避免时区导致的日期偏移 */
export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 格式化为 2026.09.18（极客风的点分格式，便于等宽字体对齐） */
export function formatDate(value) {
  const d = parseDate(value);
  if (!d) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

/** 相对时间：今天 / 3 天前 / 2 个月前 */
export function relativeTime(value) {
  const d = parseDate(value);
  if (!d) return '';
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 30) return `${days} 天前`;
  if (days < 365) return `${Math.floor(days / 30)} 个月前`;
  return `${Math.floor(days / 365)} 年前`;
}

/* ------------------------------------------------------------- 查询参数 */

/** 读取当前 URL 的查询参数，第二个参数是缺省值 */
export function getQuery(key, fallback = null) {
  const value = new URLSearchParams(location.search).get(key);
  return value === null || value === '' ? fallback : value;
}

/** 生成带查询参数的新 URL（不跳转），用于筛选链接与分享地址 */
export function buildUrl(base, params = {}) {
  const url = new URL(base, location.href);
  Object.entries(params).forEach(([k, v]) => {
    if (v === null || v === undefined || v === '' || v === 'all') {
      url.searchParams.delete(k);
    } else {
      url.searchParams.set(k, v);
    }
  });
  return url.pathname.split('/').pop() + url.search + url.hash;
}

/* -------------------------------------------------------------- 函数节流 */

/** 防抖：最后一次触发后等待 wait 毫秒才执行 */
export function debounce(fn, wait = 200) {
  let timer = null;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/** 节流：每 wait 毫秒最多执行一次，滚动/鼠标事件必用 */
export function throttle(fn, wait = 100) {
  let last = 0;
  let timer = null;
  return function throttled(...args) {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}

/* ------------------------------------------------------------ 无障碍与偏好 */

/** 用户是否要求减少动效。所有动画模块都必须先问这一句。 */
export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 是否移动端（宽度判断，用于粒子数量等性能参数） */
export function isMobile() {
  return window.matchMedia('(max-width: 820px)').matches;
}

/** 等待下一帧，用于让 CSS 初始态先生效再触发过渡 */
export function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/* ------------------------------------------------------------------ 网络 */

/**
 * 读取 JSON 数据文件。
 * 说明：多页站点下 data/*.json 必须通过 HTTP 访问，
 *       直接双击打开 HTML（file://）会被浏览器的 CORS 策略拦截。
 *       出错时抛出带路径的明确错误，方便定位。
 */
export async function loadJSON(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`读取失败 ${path}（HTTP ${res.status}）`);
  return res.json();
}

/** 读取文本文件（笔记 Markdown 用） */
export async function loadText(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`读取失败 ${path}（HTTP ${res.status}）`);
  return res.text();
}

/**
 * 确保某个全局变量可用（比如 CDN 提供的 marked / hljs）。
 *
 * 为什么要这个函数：CDN 会因为网络原因、公司网关、浏览器插件而加载失败。
 * 把多个 CDN 地址按顺序试一遍，比直接降级体验好得多。
 *
 * @param {string} globalName 期望出现的全局变量名，如 'marked'
 * @param {string|string[]} urls 依次尝试的脚本地址
 * @param {number} timeout 单个地址的等待上限（ms）。网络挂起时 onerror 不一定触发。
 * @returns {Promise<boolean>} 是否最终可用
 */
export function ensureGlobal(globalName, urls, timeout = 2500) {
  if (window[globalName]) return Promise.resolve(true);

  const list = Array.isArray(urls) ? urls.filter(Boolean) : [urls];
  let index = 0;

  return new Promise((resolve) => {
    const loaded = () => {
      if (window[globalName]) {
        resolve(true);
        return true;
      }
      return false;
    };

    const tryNext = () => {
      if (loaded()) return;
      if (index >= list.length) {
        resolve(false);
        return;
      }

      const script = document.createElement('script');
      script.src = list[index++];
      script.async = true;

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (!loaded()) tryNext();
      };

      script.onload = finish;
      script.onerror = finish;
      window.setTimeout(finish, timeout);

      document.head.append(script);
    };

    tryNext();
  });
}

/* ------------------------------------------------------------------ 数组 */

/** 按 id 建索引，便于 O(1) 查找 */
export function indexBy(list, key = 'id') {
  return list.reduce((acc, item) => {
    acc[item[key]] = item;
    return acc;
  }, {});
}

/** 统计每个分类下的条目数 */
export function countBy(list, key) {
  return list.reduce((acc, item) => {
    const value = item[key];
    if (value === undefined) return acc;
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}
