# direction-approved.md · 三方向 Gate 文件

## 展示了哪几版

| 版本 | 逻辑 | 风格 | 截图路径 |
|---|---|---|---|
| A | 秒数轮盘（秒数 01 → PPT 库 2 号） | 黑底巨型数字剧场（Steve Jobs Keynote / Presentation Zen） | design-demos/shot-A-1.png, shot-A-2.png |
| B | 现实参照 | 3Blue1Brown 几何可视化语言迁移 | design-demos/shot-B-1.png, shot-B-2.png |
| C | 最佳设计师 | 杉浦康平 信息分层 / 多重视点 | design-demos/shot-C-1.png, shot-C-2.png |

三版 HTML：design-demos/A-轮盘-黑底数字剧场.html / B-参照-3B1B几何可视化.html / C-设计师-杉浦康平信息层.html

## 用户选择原话（2026-10-13）

> 「我很欣赏A的动画效果，但是最后我需要保存成PPT的文件类型，那么这动画效果还能体现吗」

> 「那就选择方案B的设计风格，将A的动画效果加入A，pptx的动画效果可以靠平滑的效果实现吗，如果不行就选择方案① 动画页录成 MP4 嵌进 PPTX（推荐）」

> 「继续工作」

## 裁定

- **设计风格 = B 版**（3Blue1Brown 几何可视化：炭黑底 + 黄/青/红语义色 + 「图形即论证」）
- **动画机制 = A 版**（rAF 真数值积分、t/x/y 实时读数、等高虚线同时性、慢放 2.6s + 停顿 + 淡出循环）
- **PPTX 动画路线 = 方案①**：PowerPoint「平滑（Morph）」不适用于本动画（连续多元素 + 实时读数，Morph 帧间衔接生硬且元素对应关系易错乱），动画页录 H.264 MP4 嵌入 PPTX
- **交付形态 = 双版本**：PPTX（主，交作业/录课放映）+ HTML 原版（现场慢放讲解、重新录制的源）

## 下一步

按 slide-decks 规则：≥5 页 deck 先出 2 页 showcase 定 grammar，用户确认后再批量其余页 → 动画页导 MP4 → 合成 PPTX。
