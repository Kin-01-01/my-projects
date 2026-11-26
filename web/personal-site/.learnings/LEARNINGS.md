# Learnings

Corrections, insights, and knowledge gaps captured during development.

**Categories**: correction | insight | knowledge_gap | best_practice

---

## [LRN-20260923-001] best_practice · frontend/a11y
**Logged**: 2026-09-23
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
Canvas/rAF 动画在 `prefers-reduced-motion: reduce` 下必须停止或降级为静态帧。

### Details
`assets/js/knowledge-tree-embed.js` 的 3D 知识星系原本始终运行 requestAnimationFrame 循环（自转 + 粒子 + 缓动），
未理会用户的 reduced-motion 偏好，对动效敏感用户不友好。
修复：引入 `reduce` 标志；IntersectionObserver 在 reduce 时不启动循环，仅渲染一帧静态图（并强制可见节点 alpha=1）；
resize 时重新渲染一帧。CSS 层已有的 `*{animation:none}` 只覆盖 CSS 动画，覆盖不到 JS 驱动的 canvas 循环，需单独处理。

### Suggested Action
任何持续动画（canvas / rAF / CSS 动画）都要在 reduced-motion 下静止或一次性渲染。

### Metadata
- Source: self-audit
- Related Files: assets/js/knowledge-tree-embed.js
- Tags: a11y, reduced-motion, canvas

---

## [LRN-20260923-002] best_practice · frontend/a11y
**Logged**: 2026-09-23
**Priority**: medium
**Status**: resolved
**Area**: frontend

### Summary
模态弹窗需焦点陷阱并关闭后归还焦点。

### Details
知识树 modal 原本仅 Esc 关闭，无焦点陷阱：键盘 Tab 会逃出弹窗，关闭后焦点丢失，屏幕阅读器也无法停留在对话框内。
修复：open 时记录 `lastFocused` 并把焦点移入（聚焦关闭按钮），关闭时归还；modal 内 Tab 在可聚焦元素间循环。

### Suggested Action
所有 dialog 类弹窗都要 focus trap + 归还焦点。

### Metadata
- Source: self-audit
- Related Files: assets/js/knowledge-tree-embed.js
- Tags: a11y, modal, focus-trap

---

## [LRN-20260923-003] best_practice · frontend/deploy
**Logged**: 2026-09-23
**Priority**: medium
**Status**: resolved
**Area**: config

### Summary
静态站点发布前补齐 favicon，并用 .gitignore 排除含私人信息的目录。

### Details
站点原先无 favicon（标签页 404、无品牌标识）；且 `.workbuddy/` 记忆目录含私人笔记，若推到 GitHub Pages 会公开泄露。
修复：新增 `assets/favicon.svg` 并在全部 7 个 HTML head 引入；新增 `.gitignore` 忽略 `.workbuddy/` 与 `.learnings/`。

### Suggested Action
每次部署前检查：favicon、.gitignore（排除记忆/本地配置）、无密钥入库。

### Metadata
- Source: self-audit
- Related Files: assets/favicon.svg, .gitignore, index.html, about.html, content.html, roadmap.html, contact.html, leaderboard.html, knowledge-tree.html
- Tags: deploy, favicon, gitignore, privacy

---

## [LRN-20260927-001] best_practice · threejs/perf
**Logged**: 2026-09-27
**Priority**: high
**Status**: resolved
**Area**: 3d

### Summary
渲染热路径必须零分配、DOM 查询必须缓存，插值必须 dt 指数化。

### Details
`shenzhou-23/src/main.js` 主循环曾在每帧 `new THREE.Vector3()`（舱灯跟随）与 `querySelectorAll('.step')`（HUD 刷新），
且部件位移用固定系数 `*0.12` lerp（帧率相关的视觉速度，144Hz 与 60Hz 表现不一致）。
修复：临时向量模块级复用；HUD step 元素与树节点启动时缓存成数组；
lerp 改为 `1 - Math.exp(-dt * k)`（帧率无关）；另加自适应分辨率（fpsAvg<45 降 pixelRatio 0.25 级、>57 回升，带冷却期）。

### Suggested Action
rAF 循环内禁止分配对象/数组与 DOM 查询；插值一律 dt 指数化；低端机自适应降采样优先于降画质。
### Metadata
- Source: self-audit
- Related Files: shenzhou-23/src/main.js
- Tags: threejs, performance, garbage-free, adaptive-resolution

---

## [LRN-20260927-002] insight · threejs/physics
**Logged**: 2026-09-27
**Priority**: high
**Status**: resolved
**Area**: 3d

### Summary
爆炸拆解图的"穿模"用 包围球松弛 + 内饰自动透视 组合解决，不需要完整物理引擎。

### Details
部件沿固定 offset 弹出时路径会穿过其他部件（如仪表盘上浮穿过舱颈环）。
完整刚体物理过重。实用方案：① 启动时为每个部件预计算世界包围球半径；
② 每帧对"已激活分离"的部件两两做球-球检测，重叠则沿连线对称推开（乘 0.4 软系数，与 lerp 目标拉力自然平衡，无抖动）；
③ 父子嵌套对跳过（isAncestor 检查），否则舱内件会推飞整个舱段；
④ 内饰件（座椅/操控台/仪表盘）弹出时自动把返回舱外壳透明度降到 0.16，穿壳路径不可见，符合爆炸图惯例。

### Suggested Action
可视化拆解优先"设计好分离向量 + 软碰撞松弛 + 视觉规避"，而不是引入完整物理引擎。
### Metadata
- Source: feature-work
- Related Files: shenzhou-23/src/main.js, shenzhou-23/src/data.js
- Tags: physics, collision, bounding-sphere, exploded-view

---

## [LRN-20260927-003] best_practice · webaudio
**Logged**: 2026-09-27
**Priority**: medium
**Status**: resolved
**Area**: audio

### Summary
Web Audio 必须在用户手势后创建/resume；持续音（rumble/ambience）用 setTargetAtTime 平滑调参。

### Details
为仿真场景做零资源音频：AudioContext 在首次 pointerdown 才创建（否则浏览器阻止）；
发射 rumble 用棕色噪声缓冲 loop + lowpass，level 用 `setTargetAtTime` 随高度衰减（直接赋值会爆音）；
事件音（点火/分离/整流罩）由主循环按时间标记跨越检测，且仅当 `h.t - prevT < 0.5` 才触发，防止 seek 跳转时连响。

### Suggested Action
程序化音效三件套：噪声缓冲 + BiquadFilter + 指数包络；持续音永远 setTargetAtTime。
### Metadata
- Source: feature-work
- Related Files: shenzhou-23/src/audio.js, shenzhou-23/src/main.js
- Tags: webaudio, synthesis, autoplay-policy

---

## [LRN-20260927-004] knowledge_gap · tooling/network
**Logged**: 2026-09-27
**Priority**: medium
**Status**: resolved
**Area**: tooling

### Summary
本环境图片图源不可达，需要参考图时应快速判定并改用权威文字资料。

### Details
按 图片爬虫 技能取火箭高清原图做建模对比时：Wikimedia（upload.wikimedia.org 返回 000 / API SSL error 35）、
Unsplash（Anubis 反爬挑战页）、NASA images-api 均不可达；仅 jsdelivr / registry.npmjs.org / esm.sh 可达。
判定顺序：先 curl 几个候选主机看 HTTP 码，再决定；不要逐个反复重试浪费轮次。
改用权威文字资料（中国载人航天工程网 cmse.gov.cn）核对真实尺寸后建模，效果等价且更快。

### Suggested Action
需要外部素材时先做 1 次"主机可达性探测"，不可达就切文字资料 + 程序化生成，并向用户如实说明。
### Metadata
- Source: feature-work
- Related Files: shenzhou-23/src/launch.js
- Tags: network, image-scraping, fallback, reference-data

---

## [LRN-20260928-001] bug · audio/asr
**Logged**: 2026-09-28
**Priority**: high
**Status**: resolved
**Area**: audio

### Summary
vosk 逐词结果在 `result` 字段而不是 `words`；取错字段会一直得到 0 词，极易误判为"模型坏了/音频没语音"。

### Details
用 vosk 大模型（vosk-model-cn-0.22）转录发射实况时，写了 `json.loads(r.Result()).get('words', [])`，
连续多轮都返回 0 词；期间反复怀疑音频有问题（甚至把已成功的短片段重新跑成 0 词），浪费大量轮次。
实际 `KaldiRecognizer(..., SetWords(True))` 的返回结构是：
`{"text": "...", "result": [{"word":..., "start":..., "end":..., "conf":...}]}`。
改用 `j.get('result', [])` 后立刻拿到带时间戳的逐词结果。

### Suggested Action
调用不熟悉的 ASR/解析库时，先 `print(json.loads(r.Result()))` 看**真实返回结构**再写取值代码；
出现"全是空结果"时优先怀疑字段名/结构，而不是数据本身。
### Metadata
- Source: feature-work
- Related Files: shenzhou-23/src/audio.js
- Tags: vosk, asr, json-field, debugging

---

## [LRN-20260928-002] best_practice · audio/tooling
**Logged**: 2026-09-28
**Priority**: medium
**Status**: resolved
**Area**: tooling

### Summary
无系统 ffmpeg / 无 numpy 时，可用 npm registry tarball + pip 快速补齐，做音频解码与频谱分析。

### Details
- ffmpeg：`registry.npmjs.org/@ffmpeg-installer/win32-x64` 下载 tarball 解压即有 ffmpeg.exe
  （jsdelivr 对该包返回 403；`ffmpeg-static` 的 postinstall 需连 GitHub 会失败）。
- numpy/vosk：`pip install` 直接可用；vosk 中文模型从 alphacephei.com 直链可下载（small 42MB / big 1.36GB）。
- 倒数/口令定位：STFT 取 180-1400Hz 带包络 + 阈值分割找脉冲，比全带 RMS 灵敏得多
  （该素材窄带：160-630Hz 占 70%，1250Hz 以上仅 3%，全带 RMS 几乎无区分度）。
- 素材是"mp3"扩展名但实为 MP4（H.264+AAC），需先 `-vn` 抽音轨。

### Suggested Action
本机做音频分析的标准流程：npm tarball 取 ffmpeg → 解码 wav → pip numpy 做 STFT/包络 → pip vosk 做 ASR 校核。
### Metadata
- Source: feature-work
- Related Files: shenzhou-23/assets/audio/launch-ascent.mp3
- Tags: ffmpeg, numpy, vosk, onset-detection

---

## [LRN-20260928-003] bug · audio/playback
**Logged**: 2026-09-28
**Priority**: high
**Status**: resolved
**Area**: audio

### Summary
HTMLAudioElement 起播必须做"就绪门控 + 可重试"，否则一次失败就是整段静音；起播点也不能不 compensating。

### Details
发射演示听不到人声音频，排查出三个叠加缺陷：
1. 播放函数**无条件 return true**（没检查 `readyState`），`play()` 的 promise 拒绝只打日志。调用方据此认为"已开始"置位标记 → **永不重试** → 那段音频彻底静音（兜底的合成音效只在后半段生效，所以前半段完全没声）。
2. 把音频素材起点对齐到"场景 t=0"后，**第一帧就 play()，此时文件还没解码**。CDP 实测起播滞后约 0.9s，且偏移不补偿 → 全程错位。
3. 页面自带的调试面板**在某个分支提前 return 之前没有调用刷新**，于是面板一直显示点击前的旧值（"未载入"），把人误导成"资源没加载"——被假象白耗了整整一轮。

修复：`readyState >= 2` 才允许起播，否则返回 false 让上层**下一帧重试**；`play()` 拒绝时置 failed 标记，走合成音效兜底；在**首次用户手势**就预加载（而不是点击主按钮时才加载）；起播前 `await` 一个有界就绪等待（1.2s，超时照常开始），偏移取"当前时间线 - 素材起点"，**任何时刻起播都能自动重新对齐**；调试面板在该分支也刷新。

### Suggested Action
媒体起播三件套：① 先 `preload` 后 `src`；② 就绪门控 + 失败可重试 + 明确的 failed 兜底；③ 首次手势即预加载，起播偏移按当前时间线计算（可自愈）。
另：**任何"用来看状态的调试面板/日志，必须确认它在你怀疑的时间段里真的在刷新**，否则它给的"证据"是点击前的旧快照。
### Metadata
- Source: bug-fix
- Related Files: shenzhou-23/src/audio.js, shenzhou-23/src/main.js
- Tags: htmlaudio, readiness, retry, fallback, misleading-instrumentation

---

## [LRN-20260928-004] best_practice · verification
**Logged**: 2026-09-28
**Priority**: high
**Status**: resolved
**Area**: tooling

### Summary
无头浏览器 + CDP 直连（Node 22 自带 WebSocket）能在本机零依赖跑"真实点击 + 读运行时状态"，比静态截图强得多。

### Details
本机没有 Playwright/Puppeteer，但系统自带 Edge 可直接开 `--remote-debugging-port`：
- Node 22 有全局 `WebSocket`，手写 40 行 CDP 客户端即可 `Page.navigate` / `Runtime.evaluate` /
  `Input.dispatchMouseEvent`（**真实鼠标事件才能触发自动播放策略与 user gesture 路径**）；
- 同一次 `Runtime.evaluate` 里同时取"媒体进度"和"页面时钟"，一次采样就能算**音画漂移**；
- `Network.setBlockedURLs` 可以**精确模拟资源缺失**，用来验证容错分支（本次据此证明"音频文件挂掉时演示仍完整推进、无未捕获异常"）。
- 页面自定义的 `?debug=1` 状态面板是很好的探针，但**必须先确认它在目标时段确实在刷新**（见 LRN-20260928-003 第 3 条）。
- 用 `--headless=new` 且**不要**加 `--virtual-time-budget`（CDP 模式按真实时钟跑，rAF/IO 才正常）。

### Suggested Action
要下"到底行不行"的结论时，写个临时 `_cdp.mjs`（用完即删、输出写文件再 Read），不要只靠截图。
### Metadata
- Source: verification
- Related Files: shenzhou-23/src/main.js
- Tags: cdp, headless-edge, no-dependency, autoplay-policy, fault-injection

---

## [LRN-20260928-005] bug · web/esm
**Logged**: 2026-09-28
**Priority**: high
**Status**: resolved
**Area**: frontend

### Summary
`<script type="importmap">` 必须排在所有 `<link rel="modulepreload">` **之前**；否则 import map 被判"迟到"而忽略，页面偶发白屏。

### Details
现象：同一浏览器会话里连续重新加载页面，4 次里 3 次报
`TypeError: Failed to resolve module specifier "three"`，DOM 里 importmap 明明存在（`hasImportMap: true`），
网络日志也显示 `main.js`、`three.module.min.js` 全部 200/304 拿到。
**关键特征：首次冷加载（缓存空、预取慢）几乎总是成功，缓存命中后必然失败** —— 极易被误判为"服务器/缓存问题"。

根因：`modulepreload` 会**立即触发模块加载**（需要解析其模块图）。若它出现在 importmap 之前，
浏览器解析 importmap 时已"有模块加载在路上"，按规范该 import map 被标记为**迟到并忽略**，
于是 `import * as THREE from 'three'` 这类裸说明符无法解析。
冷加载之所以侥幸成功，是因为预取请求慢、parser 先读到了 importmap，顺序被"运气"扳回来了。

修复：把 `<script type="importmap">` 移到所有 `modulepreload` 之前（自身仍是内联、无需网络）。
复验：连续 4 次导航全部正常加载、零异常。

排查手法：CDP 里 `Network.enable` + `Runtime.exceptionThrown`，对**同会话连续多次导航**做对比
（只测一次冷加载永远发现不了这类"顺序竞态"）。

### Suggested Action
可复现的顺序规则：**importmap 一定要紧跟在 `<meta charset>` 之后、任何模块相关的 link/script 之前**。
遇到"裸说明符解析失败但文件都在"的现象，先查 import map 与模块加载的先后顺序，而不是查服务器。
### Metadata
- Source: bug-fix
- Related Files: shenzhou-23/index.html
- Tags: importmap, modulepreload, esm, ordering-race, intermittent-failure

---

## [LRN-20260928-006] best_practice · audio/autoplay
**Logged**: 2026-09-28
**Priority**: high
**Status**: resolved
**Area**: audio

### Summary
需要"点击后过几秒才响"的音频，要在**点击的同步阶段就静音起播（预热）**，而不是等到用时才 `play()`。

### Details
场景：点「发射演示」→ `await` 动态 import 发射模块 + 构建上百个网格 + 等音频就绪（可能数秒）→ 帧循环里才 `play()` 播倒数人声。
这种写法把 `play()` 放到了用户手势的**有效期之外**，浏览器可能直接拒播；而 WebAudio 合成的提示音不受影响，
于是症状正好是 **"只有音效、没有人声"**，极难从现象推断到原因。
更糟的是当时的收尾逻辑里有一句 `stopAudioFlags()` 恰好在 `start()` 之前，把刚准备播的元素 `pause()` 掉，
使后续 `play()` 更加处于"无手势"状态。

修复（三步，缺一不可）：
1. **手势内预热**：在按钮处理函数的第一行（任何 `await` 之前）就 `volume=0` + `play()`，把自动播放授权一次性拿到手；
   之后无论隔多久再改 `currentTime` / 音量都不会被拦。
2. **起播函数改成"仅在 `paused` 时补 `play()`"**：已预热在播时只改 `currentTime`/`volume`，零拒绝风险；
   并且**不要**因为一次拒绝就永久标记失败，要允许重试。
3. **看门狗**：主循环里"窗口内且未真正出声"就每 0.5s 重试一次，直到出声为止（原来只试一次，一次失败=整段静音）。

配套（面向排查）：
- 状态面板暴露 `预热 / 音量 / 静音 / readyState / 错误`，并**加一个构建版本号**（打到 console + 面板首行）——
  "用户看到的是修复前的旧标签页"这类问题，没有版本号根本无法判断。
- 给用户一条**可见的兜底提示**（"人声未起播，已用合成音效兜底"），避免用户只能描述"没声音"。

结论：**复现不出来 ≠ 代码没问题**。当"另一条技术路径（WebAudio）在同一页面里正常"时，
优先怀疑新路径的授权/时机，而不是继续查资源与路径。

### Suggested Action
任何"必须等前置异步完成才播放"的媒体，一律在用户手势的同步阶段先静音起播预热。
### Metadata
- Source: bug-fix
- Related Files: shenzhou-23/src/audio.js, shenzhou-23/src/main.js
- Tags: htmlaudio, autoplay-policy, warmup, watchdog, observability, build-version

---
