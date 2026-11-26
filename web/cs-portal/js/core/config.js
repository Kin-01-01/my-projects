/**
 * config.js —— 全站唯一配置源
 * -----------------------------------------------------------------------------
 * 职责：站点信息、导航、板块、功能开关、行为参数、第三方库版本、分类字典的集中声明。
 *
 * 用法：其它模块一律 `import { SITE, FEATURES, ... } from '../core/config.js'`，
 *       禁止在页面或组件里再写死导航项、颜色名、分类名、CDN 地址。
 *
 * 调整指引（保留后期灵活调整空间）：
 *   · 改站名 / 描述 / 页脚  → 改 SITE
 *   · 加页面或调导航顺序    → 改 NAV
 *   · 开关粒子、知识树、IMA → 改 FEATURES（第二阶段直接翻 true 即可）
 *   · 调动画节奏与过渡时长  → 改 BEHAVIOR
 *   · 升级第三方库          → 改 VENDOR 的版本号，其余代码不用动
 *   · 增删笔记分类          → 改 CATEGORIES
 *
 * 路径约定：所有资源路径均为相对路径（不含前导 /），
 *           这样部署到 GitHub Pages 的子路径下也能直接用，无需改配置。
 */

/* ------------------------------------------------------------------ 站点信息 */

export const SITE = {
  name: '枯木逢春',
  nameEn: 'CS Learning Archive',
  tagline: 'CS 自学门户与作品集',
  description:
    '一个记录计算机科学自学过程的地方：知识笔记、代码练习、项目作品，以及一条正在长叶子的学习路径。',
  // ↓ 待你填写，改这里就能全站生效
  owner: '待填写',
  city: '待填写',
  email: '',
  github: '',
  since: 2026,
  footerNote: '用原生 JavaScript 手写，无重型框架。',
};

/* -------------------------------------------------------------------- 导航 */

/** 顶部导航。order 即展示顺序，加一项就在这里加一行。 */
export const NAV = [
  { id: 'home', label: '首页', href: 'index.html' },
  { id: 'notes', label: '笔记', href: 'notes.html' },
  { id: 'projects', label: '项目', href: 'projects.html' },
  { id: 'tree', label: '知识树', href: 'knowledge-tree.html' },
  { id: 'about', label: '关于', href: 'about.html' },
];

/* --------------------------------------------------- 首页三板块入口（可增删） */

export const SECTIONS = [
  {
    id: 'notes',
    title: '学习笔记',
    desc: '数据库、操作系统、算法、前端——按课程与主题归档的知识点，持续更新。',
    href: 'notes.html',
    icon: 'book',
    metaKey: 'notes',
  },
  {
    id: 'projects',
    title: '项目作品',
    desc: '练习作品与协作项目的完整档案：技术栈、实现思路、源码与在线演示。',
    href: 'projects.html',
    icon: 'cube',
    metaKey: 'projects',
  },
  {
    id: 'tree',
    title: '知识树',
    desc: '把学习路径画成一棵树。未掌握是枯枝，掌握一处，就开一朵花。',
    href: 'knowledge-tree.html',
    icon: 'tree',
    metaKey: 'tree',
  },
];

/* ---------------------------------------------------------------- 功能开关 */

/**
 * 阶段开关。第一阶段全部关掉，第二阶段把值改成 true 即可启用对应能力，
 * 不需要改动调用方的代码（模块内部自行判断，且都带降级路径）。
 */
export const FEATURES = {
  /** 首页粒子背景（第二阶段） */
  particles: false,
  /** 枯木逢春知识树完整交互（第二阶段） */
  knowledgeTree: false,
  /** 鼠标柔光跟随（可选，默认关，性能敏感用户可保持关闭） */
  cursorGlow: false,
  /** 页面切换遮罩过渡 */
  pageTransition: true,
  /** 滚动入场动画 */
  revealOnScroll: true,
  /** IMA 知识库对接（第三阶段，需后端代理） */
  ima: false,
};

/* ------------------------------------------------------------ 行为与动效参数 */

export const BEHAVIOR = {
  /** 页面切换遮罩：淡入耗时（ms） */
  transitionMs: 220,
  /** 滚动入场触发阈值 */
  revealThreshold: 0.12,
  /** 同容器内多个元素的入场错峰间隔（ms） */
  revealStaggerMs: 70,
  /** 技能条填充动画延迟（ms） */
  skillFillDelay: 240,
  /** 导航栏滚动多少像素后进入"已滚动"状态 */
  navScrollOffset: 12,
  /** 列表默认排序：'date' | 'title' | 'category' */
  defaultSort: 'date',
};

/* -------------------------------------------------------- 第三方库（锁版本） */

/**
 * CDN 版本集中管理。升级只需改这里的版本号。
 * 第一阶段实际加载 Tailwind（样式）与 marked/highlight（笔记渲染），
 * 其余为第二阶段预登记，先不加载——避免首屏无谓开销。
 */
export const VENDOR = {
  tailwind: 'https://cdn.tailwindcss.com/3.4.16',
  marked: 'https://cdn.jsdelivr.net/npm/[邮箱已脱敏]/marked.min.js',
  // 备用源：主源被网络/插件挡住时，utils.ensureGlobal 会按顺序再试这些地址
  markedAlt: 'https://unpkg.com/[邮箱已脱敏]/marked.min.js',
  // highlight.js 用官方 cdn-release 构建产物（npm 包里没有打包好的浏览器版）
  hljsJs:
    'https://cdn.jsdelivr.net/gh/highlightjs/[邮箱已脱敏]/build/highlight.min.js',
  hljsJsAlt:
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js',
  hljsCss:
    'https://cdn.jsdelivr.net/gh/highlightjs/[邮箱已脱敏]/build/styles/github-dark.min.css',
  hljsCssAlt:
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css',
  // ↓ 以下第二阶段启用
  tsParticles:
    'https://cdn.jsdelivr.net/npm/@tsparticles/[邮箱已脱敏]/tsparticles.slim.bundle.min.js',
  d3: 'https://cdn.jsdelivr.net/npm/[邮箱已脱敏]/dist/d3.min.js',
  anime: 'https://cdn.jsdelivr.net/npm/[邮箱已脱敏]/lib/anime.min.js',
  tippyJs: 'https://cdn.jsdelivr.net/npm/[邮箱已脱敏]/dist/tippy.umd.min.js',
  tippyCss:
    'https://cdn.jsdelivr.net/npm/[邮箱已脱敏]/dist/tippy.css',
  hammer: 'https://cdn.jsdelivr.net/npm/[邮箱已脱敏]/hammer.min.js',
};

/* ------------------------------------------------------------ 数据源与路径 */

/** 数据文件位置。换成接口地址时只改这里（配合各模块的 fetch 封装）。 */
export const DATA = {
  notesIndex: 'data/notes.index.json',
  projects: 'data/projects.json',
  skills: 'data/skills.json',
  profile: 'data/profile.json',
  tree: 'data/tree.json',
  /** 笔记正文 Markdown 的根目录（索引里的 path 相对此处） */
  notesRoot: 'data/notes/',
};

/* -------------------------------------------------------------- 分类字典 */

/**
 * 笔记分类。id 用于 URL 参数与数据文件，label 用于界面展示。
 * 想加分类：这里加一项，并在 data/notes/ 下建同名文件夹即可。
 */
export const CATEGORIES = [
  { id: 'all', label: '全部', short: 'ALL' },
  { id: 'database', label: '数据库', short: 'DB' },
  { id: 'os', label: '操作系统', short: 'OS' },
  { id: 'algorithm', label: '算法与数据结构', short: 'ALGO' },
  { id: 'frontend', label: '前端', short: 'FE' },
  { id: 'python', label: 'Python', short: 'PY' },
];

/** 项目状态字典 */
export const PROJECT_STATUS = {
  active: '进行中',
  done: '已完成',
  planning: '规划中',
  archived: '已归档',
};

/* ------------------------------------------------------------------ 小工具 */

/** 按 id 取分类，找不到时回退成"未分类"，避免界面出现 undefined。 */
export function getCategory(id) {
  return (
    CATEGORIES.find((c) => c.id === id) || {
      id: id || 'misc',
      label: '未分类',
      short: '—',
    }
  );
}
