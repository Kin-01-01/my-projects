/* =============================================================================
 * tailwind.config.js —— Tailwind 主题扩展（普通脚本，非 ES Module）
 * -----------------------------------------------------------------------------
 * 加载顺序（必须）：先 CDN，后本文件。因为 CDN 会创建 window.tailwind，
 * 本文件只是往它上面挂 config；顺序反了配置会被 CDN 覆盖。
 *
 *   <script src="https://cdn.tailwindcss.com/3.4.16"></script>
 *   <script src="js/core/tailwind.config.js"></script>
 *
 * 设计原则：Tailwind 只负责"布局与排版工具类"，所有颜色都指向 theme.css 的
 * CSS 变量。这样：
 *   · 换配色只改 theme.css，Tailwind 侧自动跟随；
 *   · 将来换成 Tailwind 本地构建（P3），把这份配置搬进 tailwind.config.cjs 即可；
 *   · 就算 CDN 加载失败，页面结构由自定义 CSS 兜底，不会崩。
 * ========================================================================== */

window.tailwind = window.tailwind || {};

window.tailwind.config = {
  theme: {
    extend: {
      colors: {
        // 语义化色名 → CSS 变量
        root: 'var(--bg-root)',
        surface: 'var(--bg-surface)',
        elevated: 'var(--bg-elevated)',
        line: 'var(--border-1)',
        'line-strong': 'var(--border-2)',
        ink: 'var(--text-1)',
        'ink-2': 'var(--text-2)',
        'ink-3': 'var(--text-3)',
        accent: 'var(--accent)',
        'accent-2': 'var(--accent-2)',
        'accent-warm': 'var(--accent-warm)',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
      maxWidth: {
        read: 'var(--read-max)',
      },
      screens: {
        // 与 CSS 里的媒体查询断点保持一致，改这里要同步改 layout.css
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
      },
    },
  },
  corePlugins: {
    // 关掉 preflight 的部分副作用由自定义 CSS 接管，保留其余重置
    container: false,
  },
};
