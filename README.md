# my-projects

用 WorkBuddy 做的项目精选集（2026-09 ~ 2026-11）。

按用途分三类：`web/`（Web 应用与小程序）、`scripts/`（脚本与工具）、`docs/`（文档与写作）。
完整盘点（含历史项目与未入库原因）见 [PROJECT_INVENTORY.md](PROJECT_INVENTORY.md)。

> 2026-11-26 调整：早期静态站原型（cs-portal、personal-site、mylife 系列、贪吃蛇、Apple 风格样片、数据叙事）已从仓库移除，本地源文件仍保留。

## Web 应用与小程序

| 项目 | 目录 | 说明 |
|---|---|---|
| ML 代码库 | `web/ml-atlas` | 机器学习代码索引与验证脚本 |
| 双语双栏阅读器 | `web/solid-state-viewer` | 正文 / PDF 逐页 + 实时同步指针 |
| 综述阅读器 | `web/ssb-dual-reader` | 固态电池综述双栏阅读器 |
| 交互圣诞树 | `web/christmas-tree` | 3D 交互页面 |
| 四级备考小程序 | `web/cet4-planner` | 计划 / 打卡 / 提醒 / 云函数 |
| 熵减减碳平台 | `web/entropy-carbon-campus` | 数智校园减碳平台申报书与材料 |
| MarxQuiz | `web/marxquiz-mp` | 刷题小程序，912 题内置题库 + 云同步 |

## 脚本与工具

| 项目 | 目录 | 说明 |
|---|---|---|
| ML 速查表生成器 | `scripts/ml-cheatsheet-builder` | 吴恩达 ML 课程速查表构建脚本 |
| 文献处理工具 | `scripts/literature-tools` | PDF 抽取 / 综合矩阵 / docx 解析编译 |
| PDF 转 DOCX | `scripts/pdf-to-docx` | 转换与优化脚本（不含运行环境） |
| SVM 复现 | `scripts/svm-replication` | 论文结果复现 + 数据清洗 |
| Blender 建模 | `scripts/blender-models` | 埃菲尔铁塔 / 舱内场景程序化建模 |
| 物理课件工具 | `scripts/physics-lesson-tools` | 试讲课件生成脚本与设计说明 |
| 说课 PPT 工具 | `scripts/shuoke-ppt-tools` | PPT 生成脚本 |

## 文档与写作

| 项目 | 目录 | 说明 |
|---|---|---|
| 物理试讲稿 | `docs/teaching-scripts` | 牛顿第一定律 / 自由落体逐页稿 |
| 综述与文献笔记 | `docs/literature-notes` | 亚稳相固态电解质大纲、文献获取清单 |
| 四级备考计划 | `docs/cet4-plans` | 75 天计划与细化表 |
| OPC 文档 | `docs/opc-doc` | 文档资料 |

## 运行方式

- 静态页面：在项目目录执行 `python -m http.server 8080`，浏览器打开 `localhost:8080`。
- 小程序：微信开发者工具 → 导入项目 → 选择对应目录。AppID 为占位符，需填自己的。
- Python 脚本：`python <脚本名>`；依赖与运行环境未入库。

## 入库说明

- 仅收录文本文件与小于 250 KB 的图片。PPTX / DOCX / PDF / BLEND / 大图等原件留在本地，路径见 `PROJECT_INVENTORY.md`。
- AppID、云开发环境 ID、手机号、邮箱、姓名等已脱敏或替换为占位符。
- 个人档案、学号作业、文献全文翻译稿、用户数据库未入库。
