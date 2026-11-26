# WorkBuddy 项目盘点

扫描范围：`D:\workBuddy\`（35 个会话）、`D:\workbuddy存储\`（8 个会话）、`D:\03_项目归档\`。
统计口径：排除 `.workbuddy`、node_modules、缓存、临时构建目录。

## A. Web 应用 / 交互作品（适合入库，纯文本）

| # | 项目 | 来源 | 内容 | 建议 |
|---|---|---|---|---|
| 1 | **cs-portal · 枯木逢春 CS 自学门户** | 2026-09-22-13-00-17 | 首页/知识树/笔记/路线图/实验，含 `scripts/verify.mjs` 自检 | 旗舰项目 |
| 2 | 知识型个人站 | 2026-09-22-21-09-16 | knowledge-tree、roadmap、leaderboard、tree-growth、about/contact/content | 入库 |
| 3 | Mylife 系列网站原型 | 2026-09-21-12-57-00 | Blog / Lifelog / MyBlog / Mylife / MySpace / TravelNotes / tools | 入库 |
| 4 | Mylife 网站搭建（简版） | workbuddy存储/Mylife网站搭建 | index.html + css/js | 入库 |
| 5 | snake-game | 2026-09-19-17-07-32 | 单文件贪吃蛇 HTML | 入库 |
| 6 | Apple 发布会风格样片 | 2026-09-20-12-47-02 | 10 页 HTML slides | 入库 |
| 7 | data-storytelling / vernal-tree | 2026-09-22-19-40-07 | 数据叙事 + 春树可视化 | 入库 |
| 8 | **ML 代码库 ml-atlas.html** | 2026-11-10 + 11-14 | 2.5 MB 单页索引 + audit + verify.js + 历史版本 | 入库 |
| 9 | solid_state_viewer | 2026-10-21-20-00-36 | 双语双栏文献阅读器：`viewer.html` + `build_viewer.py`（20 张 PNG 不入库） | 入库 |
| 10 | ssb_dual_reader | 2026-10-29-10-54-49 | 双栏阅读器 HTML（20 张 PNG 不入库） | 入库 |
| 11 | christmas-tree | 2026-11-24-11-19-56 | 交互圣诞树 HTML | 入库 |
| 12 | cet4-planner | 2026-09-28-10-06-23 | 四级备考微信小程序（cloudfunctions / pages / styles） | 入库 |
| 13 | 熵减校园减碳平台 | D:\03_项目归档\carbon-campus、减碳大赛、碳 等 | 小程序 + Web 后台（归属需确认） | 待确认 |

## B. 脚本 / 工具（适合入库）

| # | 项目 | 来源 | 内容 |
|---|---|---|---|
| 14 | ML 速查表生成器 | 2026-10-04-20-01-29 | `build_cheatsheet*.py`、`build_docx.py` |
| 15 | 文献抽取与综合矩阵 | 2026-10-16-13-59-23 | `extract_pdfs.py`、`lit_extract/`、综合分析矩阵 |
| 16 | docx 解析/编译脚本 | 2026-10-27-21-08-59 | `compile_docx.py`、`extract_docx.py`、`parse_docx.py` |
| 17 | pdf_to_docx | 2026-11-03-09-07-06 | 全套 393 MB 运行环境 → **只取脚本**，环境不入库 |
| 18 | Fujimura SVM 复现 | 2026-11-16-21-44-51 | `replicate_fujimura_svm.py` + 清洗数据集 CSV |
| 19 | eiffel_tower | 2026-11-24-22-09-52 | Blender Python 建模脚本（.blend/.glb 不入库） |
| 20 | guangqiang_cabin | 2026-11-25-08-52-59 | Blender 舱内场景脚本（121 MB 贴图/模型不入库） |
| 21 | MarxQuiz 云备份改造方案 | 2026-10-28-21-51-08 | 方案 md + 排查报告（小程序本体在归档目录） |

## C. 文档 / 写作（适合入库，仅 Markdown/文本）

| # | 项目 | 来源 | 内容 |
|---|---|---|---|
| 22 | 物理试讲课件文稿 | 2026-10-11-19-27-22 | 牛顿第一定律（初中）、自由落体（高中）逐页稿 + outline |
| 23 | 说课 PPT 文稿 | 2026-10-18-19-42-21 | 平抛运动/牛顿第一定律说课稿（PPTX 不入库） |
| 24 | 双语文献对照 | 2026-10-21-21-40-23 | metastable_review / ms_review 的 `paper.md` 等 |
| 25 | 亚稳相固态电解质综述 | 2026-11-02-22-43-05 | 调研大纲 + 双语写作产物 |
| 26 | 四级备考计划文档 | 2026-09-28-10-06-23 | 75 天计划、细化表、资料抓取清单 |

## D. 不入库（体量大 / 临时 / 第三方）

- 科研文献全文与 PDF（2026-10-15-20-31-13，含版权风险）
- physics-lesson 的 567 张 PNG（77 MB）、ppt-style-gallery / shuoke-ppt 缓存（1012 文件）
- 2026-11-14 工作区的 Edge 验证缓存（741 个无扩展名文件）
- `pdf_to_docx` 的 393 MB Python 运行环境、`ultralytics-main` 第三方源码
- `.pptx-build-*` 临时构建目录、`deliverables/` 中的大图

## E. 敏感，必须排除

- `2026-10-29-15-11-12/ai-profile/` —— 含个人档案、GPA、家庭与经济状况、职业焦虑
- `2026-11-23-15-16-35/` 下的个人作业文档 —— 含真实姓名与学号（未入库）
- 所有含真实姓名/学号的截图、报名表、二维码

---

## 入库约束

GitHub MCP 仅支持推送**文本文件内容**，二进制（PNG/PPTX/DOCX/BLEND/PDF）无法上传。
方案：仓库内保留对应项目的 `.md` 说明 + 源码；二进制原件留在本地，README 标注路径。
