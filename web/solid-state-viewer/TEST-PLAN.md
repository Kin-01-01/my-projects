# 双栏同步阅读器 + 封装 Skill · 测试方案（v1）

被测对象：`viewer.html`（左双语正文 / 右 PDF 逐页图 / 橙色指针同步 / 标注 / 笔记 / 护眼）、`build_viewer.py`（skill 核心）。

现状基线（已核对当前产物，作为断言常量）：
- 61 个 `.para`，覆盖 p.1–p.18；**p.14 / p.19 / p.20 无段落**（图表页与参考文献被剥离）→ 指针永远到不了 p.19/20，属**正确行为**。
- 每页段落数：p1:4 p2:2 p3:2 p4:1 p5:4 p6:7 p7:3 p8:3 p9:5 p10:2 p11:6 p12:4 p13:4 p15:3 p16:4 p17:5 p18:2。
- 映射实现：`paras` 内 `.pg` 文本取**首个数字**为绝对页号；`data-ratio = (组内序号+0.5)/组内段落数`。
- `#content` 带 `scroll-behavior:smooth` → **headless 设 scrollTop 会动画滚动**，是"指针卡住"误判的第二个来源（除同步读旧值外）。

---

## 1. 测试分层

| 层 | 范围 | 手段 | 目标 |
|---|---|---|---|
| L1 单元 | 提取纯函数（hero/toc/main 抽取、figure 剥离、`.pg`→页号、ratio 计算、补零、CLI 参数解析） | pytest + 内联 HTML fixture | 25–30 例，分支覆盖 ≥90% |
| L2 集成 | `build_viewer.py` 产物：HTML+PDF → `viewer.html` + `assets/page-*.png` | pytest `tmp_path` + 产物解析断言 | 10–12 例 |
| L3 端到端（运行时验收） | 真浏览器 headless（CDP/Playwright）验证同步、标注、笔记、护眼、控制台 | 状态快照脚本 | 15 条验收脚本 |

**L3 铁律（防误判）**
1. 设 `scrollTop` 与读状态**必须在两次 evaluate 之间**，中间 `sleep(300ms)`；同帧同步读必得旧值。
2. 滚动前先 `content.style.scrollBehavior='auto'`，否则动画未结束即读 → 误报"卡在 p.1"。
3. 断言不用文字截图，一律读 DOM/内联样式：`#curpage` 文本、`#pointer` 的 `style.top`、`.pdf-page` 的 `offsetTop/offsetHeight`。

**状态快照脚本（可直接跑）**
```js
// evaluate #1
document.getElementById('content').style.scrollBehavior='auto';
const c=document.getElementById('content');
c.scrollTop = +(process.env.Y);   // 由外层传入
// sleep 300ms
// evaluate #2
(()=>{const c=document.getElementById('content'),ps=[...document.querySelectorAll('#content main .para')];
 const line=c.scrollTop+140;let cur=null;for(const p of ps)if(p.offsetTop<=line)cur=p;
 const pel=document.querySelector(`.pdf-page[data-pageno="${cur.dataset.page}"]`);
 const top=parseFloat(document.getElementById('pointer').style.top);
 const r=document.getElementById('right');
 return {curpage:document.getElementById('curpage').textContent,page:cur.dataset.page,
  top,withinPage:top>=pel.offsetTop&&top<=pel.offsetTop+pel.offsetHeight,
  rightMid:r.scrollTop+r.clientHeight/2,followOk:Math.abs(r.scrollTop+r.clientHeight/2-top)<40,
  winScroll:document.documentElement.scrollTop,leftScrolls:c.scrollHeight>c.clientHeight};})()
```

---

## 2. 关键测试用例

### 2.1 提取健壮性（L1）

| # | 用例 | 步骤 | 期望 |
|---|---|---|---|
| E1 | 结构完整 | 正常 nature-reader HTML | 61 段全提取；en/zh 成对；`.note` 保留；`figure` 剥离 |
| E2 | 缺 `nav.toc` | 删除 `nav.toc` | 不抛异常；toc 空；正文与指针正常 |
| E3 | 多个 `<main>` | 加第二个 `<main>` | 只取第一个（或明确合并策略）；段落不重复、id 不冲突 |
| E4 | 含 `<figure>` | 段落中夹 figure | figure 被剥离且不吞掉后续段落文字 |
| E5 | `.pg` 缺失/畸形 | 删某段 `.pg`；写成 `p.`；`pp. 12` | 该段 `data-page=''`；不崩；指针**沿用上一有效页**（记录为已知行为） |
| E6 | 跨页标注 | `.pg` 为 `p.1–2` | 取首数字 1；断言 `data-page=='1'`（语义待产品确认） |
| E7 | 中文/空格路径 | `--html "D:/资料/固态 电池(1).html"` | 读写成功，无编码错乱 |
| E8 | 注入字符 | 段落含 `<script>`、`&`、`"` | 输出转义；无脚本执行；无解析截断 |
| E9 | localStorage 污染 | 预置非法 JSON 到 `LS_ANN`/`LS_NOTES`/`PREFS` | try/catch 兜底，页面正常，标注/笔记为空 |

### 2.2 页数自动探测（L2）

| # | 用例 | 步骤 | 期望 |
|---|---|---|---|
| P1 | 20 页基准 | `--pdf` 20 页 PDF | `assets/page-01..20.png`；viewer 含 20 个 `.pdf-page`，`data-pageno` 连续 |
| P2 | 页数不符 | 传 `--pages 18`，实际 20 页 | 明确警告或报错；不生成断链 `<img>` |
| P3 | 图片缺失 | 删 `page-07.png` | 报错（或占位说明），不静默通过 |
| P4 | >99 页 | 100 页 PDF | 文件名补零位数 = 总页数位数，`page-001.png`；`data-pageno` 与文件名序号一致 |
| P5 | 扫描版 PDF | 无文字层的图片 PDF | 明确提示"仅图片、无正文"，不产空壳 viewer |
| P6 | 渲染 DPI | 默认参数 | PNG 宽度 ≥1200px，文字可辨（人工抽查 1 页） |

### 2.3 CLI 参数校验（L1）

| # | 用例 | 步骤 | 期望 |
|---|---|---|---|
| C1 | 缺 `--html` | 只给 `--pdf` | exit≠0，打印用法，不产生半成品文件 |
| C2 | 缺 `--pdf` | 只给 `--html` | 同上 |
| C3 | 非法 `--pages` | `0` / `-1` / `abc` / `99999` | exit≠0，参数错误信息明确 |
| C4 | 文件不存在 | 路径打错 | exit≠0，指明哪个路径 |
| C5 | 输出目录不可写 | 只读目录 | exit≠0，不留残缺 viewer |

### 2.4 运行时同步（L3，每条都按"铁律"取状态）

| # | 用例 | 步骤 | 期望 |
|---|---|---|---|
| R1 | 布局约束链 | 打开页面 | `#content` 可滚（`scrollHeight>clientHeight`）；`documentElement.scrollTop==0`（整页不滚） |
| R2 | p.1 | `scrollTop = p.1 首段.offsetTop-138` | `curpage=='当前 p.1'`；`withinPage=true`；`followOk=true` |
| R3 | p.3 | 同上，目标 p.3 首段 | `curpage` 含 p.3；`withinPage=true` |
| R4 | p.6 | 目标 p.6 首段（该页 7 段） | `curpage` 含 p.6；`withinPage=true` |
| R5 | p.10 | 目标 p.10 首段 | `curpage` 含 p.10；`withinPage=true` |
| R6 | p.15 | 目标 p.15 首段 | `curpage` 含 p.15；`withinPage=true` |
| R7 | 底部边界 | `scrollTop=scrollHeight` | `curpage` 含 **p.18**（14/19/20 无段落属正常）；`withinPage=true`；`top` 非 `NaN` |
| R8 | 页内偏移递增 | p.6 内依次滚 7 段 | `pointer.top` 同页内单调递增，不回落 |
| R9 | 关跟随 | 关闭 🔗 后滚左栏 | `curpage`/`pointer.top` 变化；`right.scrollTop` 不变 |
| R10 | 目录跳转 | 点 TOC 第 3 项（动画结束后取态） | 左栏到对应 `h2`；`nav.toc a.active` 恰 1 个且 href 匹配 |
| R11 | 进度条 | 滚到 50% 位置 | `#progress` 宽度≈50%±5% |
| R12 | 图片加载竞态 | 弱网/延迟 img load | `updatePointer` 在 `img load` 后重算，`pointer.top` 与页高一致（非 0 高度定位） |
| R13 | 窗口 resize | 改视口宽高 | 指针与跟随重新对齐，无偏移累积 |

### 2.5 标注 / 笔记 / 护眼（L3）

| # | 用例 | 步骤 | 期望 |
|---|---|---|---|
| A1 | 选区高亮 | 选 zh 段 12 字 → 点高亮 | 生成 `span.ann`（高亮 class）、颜色正确 |
| A2 | 刷新持久 | reload | 同位同长还原，字形位置不漂移 |
| A3 | 清除 | 点"清除该段" | 该段 `span.ann` 全消失；`LS_ANN` 无对应条目；刷新不复活 |
| A4 | 三格式 | 同段加下划线、加粗 | class 正确、可共存、可分别清除 |
| A5 | 跨节点选区 | 选区跨已标注 span | 不抛错；要么正确合并，要么安全忽略（无残缺标签） |
| A6 | 切换中/英/对照 | 切到"仅中" | 标注仍按 char-offset 落位，不错位到英文段 |
| N1 | 新增笔记 | 输入文本 + Ctrl/⌘+Enter | 列表即时新增，带章节名与时间 |
| N2 | 刷新持久 | reload | 笔记仍在，按章节分组顺序稳定 |
| N3 | 导出 md | 点导出 | 下载 `.md`；内容含 `## 章节名`、笔记正文、时间戳 |
| N4 | 空输入/超长 | 空串、5000 字 | 空串不入库；超长不截断崩溃 |
| M1 | 护眼 | 点护眼 | `body.eye` 存在；PDF `img` 滤镜生效（`filter!=none`）；背景色变化 |
| M2 | 偏好持久 | reload | `PREFS` 还原（护眼/字号/视图模式/行宽） |
| M3 | 控制台 | 全流程录制 console | 0 个 `error`，0 个 unhandled rejection |

---

## 3. 回归风险清单（换文献最先坏）

| 风险 | 触发条件 | 预检手段 |
|---|---|---|
| 页码偏移 ≠ 0 | 封面/版权页计入 PDF，正文标注从 1 起 | 抽首段：`.pg` 页号 与 实际图片页 对齐；不符需 `--page-offset` |
| 扫描版/纯图 PDF | 无文字层 | 先 `pymupdf` 抽文本长度，0 → 直接拒绝并提示 |
| 页数 >99 / <10 | 文件名补零位数不一致 | 断言文件名序号位数 = 总页数位数，且 `data-pageno` 顺序与文件一致 |
| 中文 / 空格 / 括号路径 | Windows + shell 引号 | 用 `Path` 对象传参，全程不拼 shell 字符串 |
| 缺 `nav.toc` / 多 `<main>` / 非 nature-reader 模板 | 正则抽取失效 | 抽取后校验"段落数>0 且 en/zh 配对率 >95%"，否则报错退出 |
| `.pg` 文本变体（`Page 12`、`pp.12`、`12–13`） | 取首数字语义偏移 | 用统一正则 `p?p?\.?\s*(\d+)`，并对 `–`/`-` 记录首页语义 |
| 图页/参考文献页无段落（本样本 p.14/19/20） | 指针"跳页/停住" | 验收时**按无段落页白名单**放行，禁止当缺陷 |
| flex 约束链被改（丢 `min-height:0`） | 整页滚动、`#content` 不滚、指针假死 | R1 断言常驻回归 |
| 大 PDF（>200 页）加载竞态 | img 未 load 时 `offsetHeight=0` | 等 `img.decode()`/`load` + 重算；断言 `pointer.top>0` |
| 浏览器缩放 / 高 DPI | 像素比导致 ratio 定位偏移 | 在 100%/125% 两档各跑 R2–R6 |

---

## 4. 放行标准（Definition of Done）

**L1/L2 自动化（CI 可跑）**
- [ ] 单元 + 集成用例全绿，分支覆盖 ≥90%
- [ ] E1–E9、P1–P6、C1–C5 全部通过
- [ ] 产物自检：`viewer.html` 中 `.pdf-page` 数量 == `assets/page-*.png` 数量 == PDF 页数
- [ ] 段落配对率 >95%，无 `data-page` 为空且无 `.pg` 的段落（或已列入白名单）

**L3 运行时验收（人工/脚本）**
- [ ] R1 通过：`#content` 是唯一滚动容器，窗口不滚
- [ ] p.1 / p.3 / p.6 / p.10 / p.15 五点全部 `withinPage=true` 且 `curpage` 匹配
- [ ] 滚到底：`curpage` = 最后一个**有段落**的页（本样本 p.18），指针不越界、不 `NaN`
- [ ] 关跟随：指针动、右栏不动
- [ ] TOC 高亮唯一且随滚动切换
- [ ] 标注：高亮→刷新仍在→可清除；三格式可共存
- [ ] 笔记：新增→刷新仍在→导出 md 含章节标题
- [ ] 护眼：`body.eye` + PDF 滤镜生效，刷新后保持
- [ ] 控制台 0 error（全流程）
- [ ] 换 1 篇"不同页数 + 非 0 偏移"的文献，重跑 R2–R7 通过（防过拟合）

**Skill 交付**
- [ ] 缺参/非法参/坏路径三类错误均有可读提示且 exit≠0
- [ ] 中文路径 + 100 页 PDF 冒烟通过
- [ ] SKILL.md 写明 `--html --pdf [--pages] [--page-offset] [--out]` 与已知限制（扫描版不支持、无段落页指针停住属正常）

**判定**：L1/L2 全绿 + L3 全勾 = 可放行；任一项 `withinPage=false` 或控制台有 error = 阻断。
