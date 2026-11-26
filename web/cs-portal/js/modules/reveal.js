/**
 * reveal.js —— 滚动入场动画
 * -----------------------------------------------------------------------------
 * 职责：用 IntersectionObserver 驱动 [data-reveal] 元素的入场动画。
 *
 * 约定：
 *   · 元素上加 data-reveal 即参与动画；
 *   · 容器上加 data-reveal-group，其内部子元素会自动错峰（依次浮现）；
 *   · 初始隐藏态挂在 body.reveal-init 下 —— 若 JS 失效或用户要求减少动效，
 *     元素默认就是可见的，不会出现"页面一片空白"。
 *
 * 性能红线：
 *   · 只用 IntersectionObserver，绝不在 scroll 事件里做重活；
 *   · 动画只碰 opacity / transform，不触发重排；
 *   · 入场完成后移除 will-change 与 transition-delay，避免长期占用合成层
 *     以及"悬浮反馈被延迟"的副作用。
 */

import { FEATURES, BEHAVIOR } from '../core/config.js';
import { $$, prefersReducedMotion } from '../core/utils.js';

/** 单例观察器，供动态渲染的内容复用 */
let observer = null;

/** 初始化。每个页面的装配脚本在内容渲染完成后调用一次。 */
export function initReveal() {
  const targets = $$('[data-reveal]');
  const shouldAnimate = FEATURES.revealOnScroll && !prefersReducedMotion();

  if (!targets.length) return;

  // 不动画时直接标记为可见即可（CSS 也本来就没隐藏它们）
  if (!shouldAnimate) {
    targets.forEach((node) => node.classList.add('is-visible'));
    return;
  }

  document.body.classList.add('reveal-init');
  applyStagger(document);

  observer = new IntersectionObserver(handleIntersect, {
    threshold: BEHAVIOR.revealThreshold,
    // 底部提前 40px 收窄，避免元素刚贴到底边就开始动，观感更自然
    rootMargin: '0px 0px -40px 0px',
  });

  targets.forEach((node) => observer.observe(node));
  rescueOversized(targets);
}

/**
 * 兜底：threshold 是按"元素自身面积的比例"判断的。
 * 一旦某个元素比视口还高，它的可见比例就永远到不了阈值 —— 结果不是
 * "动画晚了点"，而是这块内容永远停在隐藏态，页面上直接一片空白。
 * 所以对这类元素不再等观察器，直接放行。
 * @param {HTMLElement[]} targets
 */
function rescueOversized(targets) {
  const vh = window.innerHeight || document.documentElement.clientHeight;
  if (!vh || !observer) return;

  targets.forEach((node) => {
    if (node.classList.contains('is-visible')) return;
    if (node.getBoundingClientRect().height <= vh) return;

    node.classList.add('is-visible', 'is-settled');
    observer.unobserve(node);
  });
}

/**
 * 为"渲染后才出现"的内容注册入场动画。
 * 笔记列表、项目卡片这类 fetch 之后才插入 DOM 的元素必须调用它，
 * 否则它们不会进入观察队列，会一直停在隐藏态。
 * @param {HTMLElement|Document} root 新插入内容所在的容器
 */
export function refreshReveal(root = document) {
  if (!observer) return;

  applyStagger(root);

  const fresh = $$('[data-reveal]', root).filter(
    (node) => !node.classList.contains('is-visible')
  );

  fresh.forEach((node) => observer.observe(node));
  rescueOversized(fresh);
}

/* ------------------------------------------------------------------ 内部 */

function handleIntersect(entries, obs) {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;

    const node = entry.target;
    node.classList.add('is-visible');
    obs.unobserve(node);

    // 动画结束后清理内联样式，避免影响后续的悬浮过渡
    const delay = parseFloat(node.style.transitionDelay) || 0;
    const wait = delay * 1000 + 600;
    window.setTimeout(() => {
      node.classList.add('is-settled');
      node.style.transitionDelay = '';
    }, wait);
  });
}

/**
 * 给同一容器内的多个元素设置错峰延迟。
 * 延迟上限封顶在第 9 个 —— 否则长列表最后一张卡片要等一秒多才出现，
 * 那不是节奏感，是卡顿感。
 */
function applyStagger(root) {
  $$('[data-reveal-group]', root).forEach((group) => {
    $$('[data-reveal]', group).forEach((node, index) => {
      const step = Math.min(index, 8) * BEHAVIOR.revealStaggerMs;
      node.style.transitionDelay = step ? `${step}ms` : '';
    });
  });
}
