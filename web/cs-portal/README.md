# 枯木逢春 · CS 自学门户与作品集

个人计算机科学自学门户。把知识笔记、代码练习、项目作品和个人技术路线放在一处，同时作为一份技术栈名片。

**核心特色**：枯木逢春知识树 —— 学习路径长成一棵树，未掌握的知识点是枯枝，悬停时枯枝转绿、发芽、开花。

---

## 快速开始

**必须通过 HTTP 服务访问。** 直接双击 HTML 文件（`file://`）会被浏览器的 CORS 策略拦住，`data/*.json` 和 Markdown 都读不到。

在项目根目录下任选一种：

```bash
# 方式一：Python（最省事，已装 Python 就能用）
python -m http.server 8080

# 方式二：Node
npx serve -l 8080

# 方式三：VS Code 装 Live Server 插件，右键 index.html → Open with Live Server
```

然后浏览器打开 <http://localhost:8080>。

> 端口被占用就换一个，比如 8081。

---

## 改完东西之后：跑一遍自检

```bash
node scripts/verify.mjs            # 静态检查，不需要起服务
PORT=8080 node scripts/verify.mjs --serve   # 顺带检查每个页面是否 200
```

**为什么值得跑**：加一篇笔记要同时动 Markdown 文件和索引 JSON，漏一处不会报错，只会在页面上悄悄少一块。这个脚本会替你盯住这些：

- 页面里引用的 css / js / 图片是否都存在
- ES Module 的相对导入：**路径存在，且导入的名字确实被导出过**（漏一个具名导入在浏览器里静默变成 `ReferenceError`，页面其余部分照常渲染，最容易漏看）
- `data/*.json` 是否合法
- 笔记的 `path` 指向真实文件、`id` 不重复、`category` 在 `config.js` 里登记过
- 技能 `level` 是否在 1–5、时间线 `state` 是否合法
- 六个页面是否都具备 `header` / `footer` / `veil` / `data-page` 四个挂载契约

---

## 目录结构

```
cs-portal/
├── index.html                 首页（Hero + 三板块入口 + 最新笔记）
├── notes.html                 笔记列表（分类 / 标签 / 搜索）
├── note.html                  笔记详情（?id=xxx，Markdown 渲染 + 目录）
├── projects.html              项目作品（技术栈筛选 + 卡片网格）
├── about.html                 关于我（简介 / 技能栈 / 学习路线）
├── knowledge-tree.html        知识树（第一阶段为静态占位）
│
├── assets/
│   ├── css/
│   │   ├── theme.css          ★ 设计令牌唯一来源（颜色 / 字体 / 圆角 / 动效时长）
│   │   ├── layout.css         容器、导航栏、页脚、页面切换遮罩
│   │   ├── components.css     卡片、标签、按钮、筛选条、正文排版、时间线
│   │   └── animations.css     入场关键帧与 prefers-reduced-motion 降级
│   └── icons/                 favicon.svg / logo.svg
│
├── js/
│   ├── core/
│   │   ├── config.js          ★ 全站唯一配置源（站名 / 导航 / 开关 / 版本 / 分类）
│   │   ├── utils.js           DOM、字符串、时间、查询参数、节流、fetch 封装
│   │   ├── router.js          导航高亮 + 页面切换过渡
│   │   ├── theme.js           主题读写（预留明暗切换）
│   │   ├── icons.js           内联 SVG 图标集
│   │   └── tailwind.config.js Tailwind 主题扩展（颜色指向 CSS 变量）
│   ├── modules/               通用组件：导航、页脚、入场、笔记、正文、项目、技能
│   ├── pages/                 页面装配：把外壳 + 模块 + 数据接起来
│   └── vendor/                第三方库本地化位置（第三阶段可选）
│
├── data/                      ★ 所有内容都在这里，加内容不用碰 HTML
│   ├── notes.index.json       笔记索引
│   ├── projects.json          项目作品
│   ├── skills.json            技能栈
│   ├── profile.json           个人简介与学习路线
│   └── notes/<分类>/*.md      Markdown 正文
│
├── scripts/verify.mjs         结构与数据自检脚本
├── lab/                       交互实验台（独立单文件，不依赖站点资源）
│   └── proximity-growth.html  接近场生长验证页（详见 docs/INTERACTION-SYSTEM-PLAN.md）
├── docs/
│   ├── PHASE-1-PLAN.md        第一阶段方案文档
│   └── INTERACTION-SYSTEM-PLAN.md  接近场交互系统方案（含数学推导与 Three.js 应用）
└── README.md
```

---

## 交互实验台：接近场生长

`lab/proximity-growth.html` 是一个**独立单文件**（Three.js 走 CDN，不依赖本站任何资源）。它把「光标靠近 → 苔藓沿枯枝长出来 → 移开再退回去」这套效果完整跑通，并且把参数摊开：五种衰减核、影响半径、生长前沿杂化、生长/回退时间常数，全部可现场调，右侧曲线图实时画出当前核的形状。

```bash
# 和其它页面用同一个服务即可
python -m http.server 8080
# 打开 http://localhost:8080/lab/proximity-growth.html
```

它是第二阶段「枯木逢春知识树」的技术预研——**知识树的"枯枝转绿"和苔藓的"沿枝生长"在数学上是同一件事**（详见方案文档第 9 节）。

设计取舍与数学推导都写在 `docs/INTERACTION-SYSTEM-PLAN.md` 里，包含：接近函数五族、像素等距校正的为什么、帧率无关阻尼、噪声杂化的配比，以及性能红线清单。

---

## 改哪里 = 改什么

这张表是维护这个站点最需要的东西。

| 想改什么 | 改哪个文件 | 说明 |
|---|---|---|
| 站名、英文名、页脚文案 | `js/core/config.js` → `SITE` | 全站生效，六个页面都跟着变 |
| 导航项 / 加新页面 | `js/core/config.js` → `NAV` | 导航由 JS 渲染，不用同步改 6 个 HTML |
| 首页三板块卡片 | `js/core/config.js` → `SECTIONS` | 增删改条目即可 |
| 配色、圆角、动画时长 | `assets/css/theme.css` | 只改 CSS 变量，组件不用动 |
| 笔记分类 | `js/core/config.js` → `CATEGORIES` | 加分类后记得建对应文件夹 |
| 新增一篇笔记 | 放 md 到 `data/notes/<分类>/`，再在 `data/notes.index.json` 加一条 | 两处，不用碰代码 |
| 新增一个项目 | `data/projects.json` | 截图放 `assets/img/projects/`，填 `cover` 字段 |
| 技能栈 | `data/skills.json` | `level` 为 1–5 |
| 个人简介 / 学习路线 | `data/profile.json` | 页面上没有任何写死的个人内容 |
| 升级第三方库 | `js/core/config.js` → `VENDOR` | 版本集中管理 |
| 开关粒子 / 知识树 | `js/core/config.js` → `FEATURES` | 第二阶段翻成 `true` 即可 |

---

## 开发阶段

| 阶段 | 内容 | 状态 |
|---|---|---|
| **第一阶段** | 项目骨架、路由、导航、三大板块静态框架、设计令牌 | ✅ 已完成 |
| **交互预研** | 接近场生长实验台（`lab/proximity-growth.html`）+ 交互系统方案 | ✅ 已完成 |
| **第二阶段** | 枯木逢春知识树（接近场驱动，D3 + Three.js）、首页粒子背景 | ⏳ 待开始 |
| **第三阶段** | 交互动效打磨、卡片与正文精修、IMA 知识库对接入口 | ⏳ 待开始 |

### 第一阶段的"开关式预留"

第二阶段的功能已经预留好挂载点，**不需要重构**：

- **粒子背景**：`index.html` 里已有 `#particles-hero` 容器；把 `FEATURES.particles` 改成 `true`，再新建 `js/modules/particles.js` 即可。
- **知识树**：容器 `#tree-stage` 已就位；把 `FEATURES.knowledgeTree` 改成 `true`，新建 `js/modules/knowledge-tree.js`。`pages/tree.page.js` 会自动用**动态 import** 加载它 —— 功能没开时，D3 / anime / tippy / Hammer 四个库一个字节都不会下载。
- **IMA 知识库**：`FEATURES.ima` 预留位已留。

---

## 技术选型

| 能力 | 选型 | 说明 |
|---|---|---|
| 架构 | 多页应用（MPA），文件即路由 | 粒子只在首页加载，其他页零开销 |
| 语言 | 原生 JavaScript（ES Module） | 不引 React / Vue 等重型框架 |
| 样式 | Tailwind CSS 3.4.16（Play CDN） | 只用于布局工具类；主题色全部指向 CSS 变量 |
| Markdown | marked.js 12.0.2 | 只在笔记详情页加载 |
| 代码高亮 | highlight.js 11.9.0 | 同上 |
| 粒子背景 | tsParticles（第二阶段） | 鼠标联动 |
| 知识树 | 接近场（自研）+ D3.js / Three.js（第二阶段） | 枯枝转绿由光标距离场驱动，交互自由度优先 |
| 接近场数学 | 原生 JS，无依赖 | 距离场、衰减核、帧率无关阻尼全部手写，见 `docs/INTERACTION-SYSTEM-PLAN.md` |

---

## 几条约定

1. **数据与视图分离**：页面不写死任何内容，一律从 `data/` 读。
2. **颜色只从变量取**：CSS 里不出现硬编码色值，全部用 `var(--*)`。
3. **模块顶部写职责注释**：每个 JS 模块开头说明「做什么 / 怎么用 / 依赖什么」。
4. **动效必须可降级**：尊重 `prefers-reduced-motion`；滚动动画一律用 `IntersectionObserver`，不在 `scroll` 事件里做重活。
5. **异常必有提示**：数据读不到时给出可读原因，不留白屏。

---

## 已知事项

- **Tailwind 走 CDN**：`cdn.tailwindcss.com` 不适合生产环境（控制台会有提示）。第三阶段可转本地构建，配置已经写在 `js/core/tailwind.config.js`，搬进 `tailwind.config.cjs` 即可。页面布局对 Tailwind 没有强依赖，即使 CDN 挂掉也不会崩。
- **Hammer.js 最后更新停在 2016 年**：功能稳定但已不再维护。如果想让依赖更干净，可用原生 Pointer Events + `d3-zoom` 替代，第二阶段的 `knowledge-tree.js` 会把手势层单独抽出，方便替换。
- **IMA 知识库不能从浏览器直连**：MCP 是服务端协议，前端只能调 HTTP。真实对接需要一个转发层（可用腾讯云 CloudBase 云函数），第三阶段处理。
- **字体不引 Google Fonts**：国内首屏会被拖慢，改用系统字体栈 + `JetBrains Mono / Consolas`。

---

## 待填写

`data/` 里有几处占位内容，换成你自己的：

- `js/core/config.js` → `SITE.owner` / `SITE.city` / `SITE.github` / `SITE.email`
- `data/profile.json` → `name` 以及全部文案
- `data/skills.json` → 各项 `level`（按你的真实感受调）
- `data/projects.json` → 项目的 `repo` / `demo` 链接和截图
- `assets/img/avatar.jpg` → 头像（目前未引用，第三阶段会用到）
