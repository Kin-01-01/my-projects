# 神州模型设计 — 接手文档（AGENTS.md）

> 神舟二十三号发射流程 3D 可视化。Three.js + ES Modules，核心要求：**所有发射动作与旁白音频严格时间同步**，视觉以真实发射为蓝本。

---

## 1. 怎么跑起来

```bash
cd "本目录"
python serve.py 8123
# 浏览器打开 http://127.0.0.1:8123/
```

- ES Modules 不能用 `file://` 打开，**必须走本地 HTTP**。
- 也可以双击 `启动演示.bat`（含僵死进程自动清理）。
- 缓存策略（`serve.py`）：`src/` 与 `index.html` 一律 `no-store`，**刷新必定拿到最新代码**；`vendor/`、`assets/` 一年强缓存。排查"改了没生效"先硬刷新。
- 依赖无 npm 安装步骤，Three.js 在 `vendor/` 本地化。

## 2. 模块清单（src/，10 个文件）

| 文件 | 职责 | 注意点 |
|---|---|---|
| `main.js` | 装配场景、渲染循环、UI/HUD、事件下拉、CDP 调试接口 | `window.__wbScene` 在这暴露 |
| `launch.js` | **核心**：发射全程动力学、火焰、分离时序、运镜、高空地球 | 最大文件，改动前先看 `cameraOrbit` |
| `data.js` | `LAUNCH_TL`（8 个时间锚点）+ `LAUNCH_EVENTS`（11 个事件）+ `LAUNCH_PHASES` | 所有时序校准只改这里，别散落硬编码 |
| `spacecraft.js` | 三舱（轨道/返回/推进）建模、帆板展开 | `setSolarDeploy(groups, p)` 统一入口 |
| `audio.js` | 旁白音频播放与进度查询 | 旁白时间轴见 `导出/旁白时间轴.srt` |
| `earth.js` | 近地地球（发射场视角） | 贴图生成已下沉到 globe.js |
| `globe.js` | **共享地球贴图生成器**：地表/云层/大气散射材质 | 程序化 CanvasTexture + fbm，无外部贴图依赖 |
| `environment.js` | US1976 大气、重力、风场、天气 | 有边界钳制 `ENV_BOUNDS` |
| `sky.js` | 随高度变色的天空穹顶（6 段关键色） | `SKY_KEY` 调色板 |
| `tower.js` | 模块化发射塔（InstancedMesh） | `update(t,{lifted,liftT})` 控制摆臂撤离 |

## 3. 时序校准方法（最重要，反复踩坑）

旁白是唯一真值。校准流程：
1. 从 MP3 提取语音，做 **3–8Hz 音节包络**分析，定位每个口令的实际发声时刻；
2. 关键动作取包络后沿 +0.25~1.7s（人的反应延迟），写入 `LAUNCH_TL`；
3. **顺序坑**：芯一级/二级分离（T_CORE=96.5）**先于**整流罩抛离（T_FAIR=126.5），别弄反；
4. 帆板展开（T_SOLAR=197）**必须在船箭分离（T_UPPER=176.5）之后**；
5. 二级主机关机向后延迟 4 秒（`launch.js` 的 `VERN_DELAY`）；
6. 每次改完必须无头跑全程截图核对，不许只凭代码推断。

现有锚点（秒）：点火 10 / 逃逸塔 73.5 / 助推 87.5 / 级间 96.5 / 整流罩 126.5 / 船箭分离 176.5 / 帆板 197 / 结束 212。

## 4. 调试与验证接口

```js
// 浏览器控制台
window.__wbScene          // { scene, camera, controls, renderer, launch, audio }
window.__launchDebug      // .setAudioProbe(fn) / .clipStatus()
```

无头验证套路（已验证可行）：
- 写 Node 脚本用 Edge DevTools Protocol 打开页面、等 N 秒、读 `__launchDebug.state()`、截图；
- 脚本样例曾放在 `%TEMP%/_rk_*.mjs`（探针/回归/运镜验证三类）；
- 回归标准：全程零异常，网格/实例数与上次一致（约 1016 网格 / 31 instanced），控制台只有无头环境固有的 AudioContext 告警。

## 5. 已知坑（前车之鉴，别再踩）

| 坑 | 症状 | 正解 |
|---|---|---|
| GLSL 保留字 `patch` | 火焰 shader 全部静默失效 | 已改名 `clump`，**新增 uniform/varying 避开 patch 等保留字** |
| `w.userData.hinges` 未赋值 | 帆板永远不折叠/展开 | spacecraft.js 已按机翼逐个赋值，改帆板结构时同步维护 |
| UnrealBloom radius | 以为"光晕太大"是灯光问题 | 真正元凶是 bloom 半径（已收窄到 0.22），调光晕先看 EffectComposer 参数 |
| 高空运镜看不到地球 | 全程只有黑天和火箭 | 地平线在 -42°，运镜加了 `el + space*16` 下压角；改 `cameraOrbit` 时注意低空 space≈0 不受影响 |
| 服务器僵死 | 端口在听但页面打不开 | 用独立进程重启；`启动演示.bat` 已内置检测 |
| 极地放射状条纹 | 地球两极彩色放射纹 | globe.js 的 `poleK` 白化 + `eFlat` 高程压平，已修复；动 fbm 参数后**必须回看两极特写** |

## 6. 当前完成度与可继续优化的方向

**已完成**：全程时序校准、火焰（一级实拍风格/二级 Mach 环真空羽流）、三舱建模、帆板 0°→90° 展开、塔架模块化、US1976 环境、高度渐变天空、真实感地球（地表生物群区/冰盖/云层/大气散射）、运镜高空下压。

**可继续做**（按优先级）：
1. 运镜丰富度：目前单机位轨道，可加关键事件的特写机位（分离瞬间、帆板展开过程）；
2. 性能：高空段 drawcall 与贴图分辨率按高度 LOD 切换；
3. 音频：背景音乐分层、事件音效（分离爆炸声、帆板展开声）待补；
4. HUD：实时速度/高度/大气数据已由 environment.js 供数，可做成曲线图；
5. 移动端适配目前未验证。

## 7. 目录其他内容

- `导出/`：校准版时间表、旁白时间轴 SRT、音画同步核对表、各阶段对比截图 —— **改动时序前先读这里的核对表**。
- `docs/优化方案-建模-动力学-播报.md`：总体方案。
- `reference/`：参考资料。
- `rocket-sim.html`：早期单体版本（参考用，已非主程序）。
- `__pycache__` 是 serve.py 的缓存，可随时删。
