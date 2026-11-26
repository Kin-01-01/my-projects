/**
 * note-render.js —— 笔记详情渲染
 * -----------------------------------------------------------------------------
 * 职责：
 *   1. 按 ?id= 从索引里找到笔记，读取对应 Markdown；
 *   2. 用 marked.js 转成 HTML 并注入正文区；
 *   3. 用 highlight.js 给代码块上色；
 *   4. 收集 h2/h3 生成右侧目录，并做滚动高亮（scroll spy）；
 *   5. 各种异常（无 id / 找不到 / 加载失败）都给出可读的提示，不白屏。
 *
 * 依赖（只在笔记详情页按需加载，其余页面不引，省流量）：
 *   window.marked  —— config.js 的 VENDOR.marked
 *   window.hljs    —— config.js 的 VENDOR.hljsJs
 * 两者缺失时会降级：marked 缺失则直接展示原始 Markdown 文本，不会白屏。
 */

import { DATA, VENDOR, getCategory } from '../core/config.js';
import {
  el,
  clear,
  loadJSON,
  loadText,
  formatDate,
  getQuery,
  slugify,
  ensureGlobal,
  $$,
} from '../core/utils.js';
import { ICONS } from '../core/icons.js';

/**
 * 初始化笔记详情页。
 * @param {object} refs
 * @param {HTMLElement} refs.headerEl 标题与元信息容器
 * @param {HTMLElement} refs.bodyEl   正文容器
 * @param {HTMLElement} refs.tocEl    目录容器
 */
export async function initNoteDetail({ headerEl, bodyEl, tocEl }) {
  const id = getQuery('id');

  if (!id) {
    return showMessage(bodyEl, headerEl, {
      title: '没有指定笔记',
      desc: 'URL 里缺少 ?id= 参数。回到笔记列表挑一篇吧。',
    });
  }

  let note;
  try {
    const raw = await loadJSON(DATA.notesIndex);
    const list = Array.isArray(raw) ? raw : raw.notes || [];
    note = list.find((n) => n.id === id);
  } catch (error) {
    return showMessage(bodyEl, headerEl, {
      title: '笔记索引读取失败',
      desc: `${error.message}。若是直接双击打开的 HTML，请改用本地 HTTP 服务访问（见 README）。`,
    });
  }

  if (!note) {
    return showMessage(bodyEl, headerEl, {
      title: '找不到这篇笔记',
      desc: `索引里没有 id 为 “${id}” 的记录，可能链接过期或笔记已改名。`,
    });
  }

  document.title = `${note.title} · ${document.title}`;
  renderHeader(headerEl, note);

  let markdown = '';
  try {
    markdown = await loadText(DATA.notesRoot + note.path);
  } catch (error) {
    return showMessage(bodyEl, null, {
      title: '正文加载失败',
      desc: `${error.message}。请确认 data/notes/${note.path} 存在。`,
    });
  }

  await renderBody(bodyEl, markdown, tocEl);
}

/* ------------------------------------------------------------------ 头部 */
function renderHeader(container, note) {
  if (!container) return;
  clear(container);

  const category = getCategory(note.category);

  const meta = [
    el('span', { html: `${ICONS.calendar}<span style="margin-left:4px">${formatDate(note.date)}</span>` }),
    el('span', { class: 'tag tag-accent', text: category.label }),
  ];

  if (note.updated && note.updated !== note.date) {
    meta.push(el('span', { text: `更新于 ${formatDate(note.updated)}` }));
  }
  if (note.minutes) {
    meta.push(el('span', { text: `约 ${note.minutes} 分钟` }));
  }

  container.append(
    el('h1', { text: note.title }),
    el('div', { class: 'note-meta' }, meta),
    el(
      'div',
      { class: 'tag-row', style: 'margin-top:14px' },
      (note.tags || []).map((t) => el('span', { class: 'tag', text: `#${t}` }))
    )
  );
}

/* ------------------------------------------------------------------ 正文 */

async function renderBody(bodyEl, markdown, tocEl) {
  if (!bodyEl) return;
  clear(bodyEl);

  // 标题已经在 data/notes.index.json 里存了一份，正文开头的 H1 会造成重复渲染，
  // 这里直接去掉它。Markdown 里不写 H1 也不影响（正则匹配不到就原样保留）。
  const source = String(markdown).replace(/^\s*#[^#][^\n]*(\r?\n|$)/, '');

  // marked 首次加载要等一两秒，先给一句话，别让正文区空着像坏掉了一样。
  bodyEl.append(
    el('p', { class: 'note-loading mono', text: '正在排版正文…' })
  );

  // marked / hljs 由 note.html 的 <script> 引入。CDN 有可能被网络或插件挡住，
  // 所以这里再保底确认一次（会自动换备用源重试）。确认不通过就走降级路径。
  const [hasMarked, hasHljs] = await Promise.all([
    ensureGlobal('marked', [VENDOR.marked, VENDOR.markedAlt]),
    ensureGlobal('hljs', [VENDOR.hljsJs, VENDOR.hljsJsAlt]),
  ]);

  let degraded = !hasMarked;
  let html = null;

  if (hasMarked) {
    try {
      html = toHtml(source);
    } catch (error) {
      // 解析失败也要有内容可看，绝不能让正文区留白
      console.warn('[note] Markdown 解析失败，降级为未排版原文：', error);
      degraded = true;
    }
  }

  if (!html) {
    html = `<pre class="mono">${escapeForPre(source)}</pre>`;
  }

  bodyEl.classList.add('prose');
  // 撤掉"正在排版正文…"占位，换成真正的正文
  clear(bodyEl);

  // 降级时先给一句说明，省得读者以为笔记本身就是一堆符号
  if (degraded) {
    bodyEl.append(
      el('div', { class: 'notice', style: 'margin-bottom: 22px' }, [
        el('span', { 'aria-hidden': 'true', text: '⚠️' }),
        el('span', {
          text: 'Markdown 渲染器没能加载，下面是未经排版的原文。刷新页面或换个网络再试。',
        }),
      ])
    );
  }

  bodyEl.insertAdjacentHTML('beforeend', html);

  if (hasHljs) highlightCode(bodyEl);
  addExternalLinkGuard(bodyEl);
  const headings = assignHeadingIds(bodyEl);
  renderToc(tocEl, headings);
  bindScrollSpy(tocEl, headings);
}

/**
 * 用 marked 把 Markdown 转成 HTML。
 *
 * 注意配置与转换要分两步写：marked 的签名是 parse(源码, 选项)，
 * 如果把选项对象当成第一个参数传进去（parse(options, source)），
 * 会直接抛错并让整个正文区变成空白。这里把两步拆开，避免再踩。
 */
function toHtml(source) {
  const marked = window.marked;

  if (typeof marked.setOptions === 'function') {
    // gfm 打开表格与任务列表；breaks 关掉 —— Markdown 里的一次换行不该产生 <br>，
    // 否则从编辑器粘贴过来的长段落会碎成一行一句。
    marked.setOptions({ gfm: true, breaks: false });
  }

  return marked.parse(source);
}

/** 代码高亮：marked 渲染完成后再交给 highlight.js，避免版本 API 差异 */
function highlightCode(container) {
  if (!window.hljs) return; // 没加载就保持朴素配色，不影响阅读
  $$('pre code', container).forEach((block) => {
    try {
      window.hljs.highlightElement(block);
    } catch {
      /* 单个代码块高亮失败不该影响整页 */
    }
  });
}

/** 正文里的站外链接统一新窗口打开，并补上安全属性 */
function addExternalLinkGuard(container) {
  $$('a[href^="http"]', container).forEach((link) => {
    if (new URL(link.href, location.href).origin === location.origin) return;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  });
}

/**
 * 给标题加 id 锚点，返回目录数据。
 * 中文标题会保留汉字，只去掉空格和标点，生成的锚点依然可读。
 */
function assignHeadingIds(container) {
  return $$('h2, h3', container).map((heading, index) => {
    const text = heading.textContent.trim();
    // 加序号前缀，避免不同小节标题相同时 id 撞车
    const id = `${index + 1}-${slugify(text) || 'section'}`;
    heading.id = id;
    return { id, text, depth: heading.tagName === 'H3' ? 3 : 2 };
  });
}

/* ---------------------------------------------------------------- 目录区 */

function renderToc(tocEl, headings) {
  if (!tocEl) return;
  clear(tocEl);

  if (headings.length < 2) {
    tocEl.style.display = 'none';
    return;
  }

  tocEl.append(el('p', { class: 'note-toc-title', text: '本页目录 / ON THIS PAGE' }));

  headings.forEach((h) => {
    tocEl.append(
      el('a', {
        href: `#${h.id}`,
        text: h.text,
        class: `depth-${h.depth}`,
        dataset: { toc: h.id },
      })
    );
  });
}

/** 滚动时高亮当前所在小节 */
function bindScrollSpy(tocEl, headings) {
  if (!tocEl || !headings.length) return;

  const nodes = headings
    .map((h) => document.getElementById(h.id))
    .filter(Boolean);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        $$('[data-toc]', tocEl).forEach((link) =>
          link.classList.toggle(
            'is-active',
            link.dataset.toc === entry.target.id
          )
        );
      });
    },
    // 顶部留出导航高度，底部收窄到 30%，让"当前小节"判定更贴近视觉
    { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
  );

  nodes.forEach((node) => observer.observe(node));
}

/* -------------------------------------------------------------- 异常提示 */

function showMessage(bodyEl, headerEl, { title, desc }) {
  if (headerEl) {
    clear(headerEl);
    headerEl.append(el('h1', { text: title }));
  }
  if (bodyEl) {
    clear(bodyEl);
    bodyEl.classList.remove('prose');
    bodyEl.append(
      el('div', { class: 'empty-state' }, [
        el('p', { style: 'font-size:15px;color:var(--text-2)', text: title }),
        el('p', { text: desc }),
        el(
          'div',
          { style: 'margin-top:20px' },
          [
            el('a', {
              class: 'btn btn-primary btn-sm',
              href: 'notes.html',
              text: '返回笔记列表',
            }),
          ]
        ),
      ])
    );
  }
}

/** 降级展示用：把文本安全地放进 <pre> */
function escapeForPre(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
