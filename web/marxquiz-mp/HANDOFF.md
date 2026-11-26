# 交接文档 · 马原刷题小程序

> 最后更新：2026-10-28 21:50
>   
> 交接人：WorkBuddy（上一轮 agent）
>   
> 接手对象：下一个 agent

---

## 0. 一句话现状

原生微信小程序已完成开发与验证（**52 文件 / 1.1MB / 457 条自动化断言全绿**），内置马原题库 912 题。
  
**当前唯一未完成的事：手机上扫体验版二维码仍报「页面不存在」**（详见第 10 节）。

---

## 1. 四个位置，别搞混

| 位置                               | 内容                  | 说明                              |
| -------------------------------- | ------------------- | ------------------------------- |
| `D:\03_项目归档\MarxQuiz MP\`        | **小程序工程本体**         | 微信开发者工具导入的就是这一层（含 `app.json`）   |
| `D:\03_项目归档\MarxQuiz MP-开发资料\`   | 测试脚本 + 题库生产流水线      | 不参与打包，仅供开发/回归用                  |
| `D:\03_项目归档\马原题库_JSON备份\`        | 8 个题库 JSON（分章 + 全册） | 用户导入/备份用，**故意放在项目外**，否则会被打包进小程序 |
| `D:\03_项目归档\MarxQuiz_UI设计稿.html` | 高保真视觉稿（4 屏）         | 浏览器打开即可看，含深夜模式                  |

---

## 2. 硬约束（改代码前必读）

1. **原生小程序**：WXML / WXSS / JS / JSON，**不用 npm、不用构建、不用 TS、不引第三方 UI 库**
2. **零网络**：全项目无 `wx.request`、无云开发、无 `wx.login`。数据只在本机
3. **零图片资源**：所有图标是 emoji 或纯 CSS
4. **存储单点收口**：所有读写必须走 `utils/store.js`，**页面里禁止出现 `wx.setStorageSync`**
5. **颜色单点收口**：页面 WXSS 里禁止硬编码颜色（`#xxx` / `rgba()`），一律用 CSS 变量
6. **WXSS 兼容**：不用 `gap`、`:has()`、`position: sticky`
7. 所有 `setData` 字段必须在 `data` 里初始化；所有 `bindtap` 函数必须在页面 JS 中存在

违反以上任意一条，`test-static.js` 会报错。

---

## 3. 目录结构与页面职责

```
MarxQuiz MP/
├─ app.js                    入口；onLaunch 里调 store.seedBuiltinOnce() 写入内置题库
├─ app.json                  6 个页面 + tabBar(custom) + darkmode/themeLocation
├─ app.wxss                  设计令牌（明暗两套各 27 个变量）+ 全局组件样式
├─ theme.json                深色模式导航栏配色（配合 darkmode:true）
├─ custom-tab-bar/           悬浮胶囊底部导航（题库 / 错题本 / 设置）
├─ pages/
│  ├─ index/     首页：概览统计 + 题库列表 + 悬浮导入 FAB        [tab 0]
│  ├─ wrong/     错题本 + 收藏（分段控件切换）                    [tab 1]
│  ├─ settings/  外观 / 答题 / 数据备份 / 关于                    [tab 2]
│  ├─ import/    导入：粘贴 / 从聊天选文件 / 示例（普通页）
│  ├─ practice/  刷题 + 模拟考试 + 答题卡（普通页）
│  └─ result/    结果：环形正确率 + 三项统计 + 错题回顾（普通页）
├─ utils/
│  ├─ parser.js        题库解析器（纯 JS，可被 Node 直接 require —— 单测的基础）
│  ├─ store.js         唯一存储层（题库/进度/错题/收藏/统计/设置/主题/备份）
│  ├─ theme.js         主题读写、导航栏、系统主题监听、tabBar 同步
│  ├─ util.js          判分、时间格式化、洗牌、防抖
│  ├─ sample.js        20 题演示题库（内联 JS，小程序读不了项目里的 json）
│  ├─ builtin-banks.js 内置题库聚合入口（0.8KB，只做拼接）
│  └─ banks/           内置题库数据分片 bank-01 ~ bank-07（共 912 题）
├─ sample/           用户可见的格式示例（json + txt），不打包
└─ tools/convert.py  Excel/Word/TXT/CSV → JSON 转换脚本，不打包
```

**导航规则（重要）**：`index` / `wrong` / `settings` 是 **tab 页**，页面间跳转**必须用 `wx.switchTab`**，用 `navigateTo` 会失败。其余页面用 `navigateTo` / `redirectTo`。

---

## 4. 数据模型

### 4.1 题目

```js
{
  id: 'q_12_a3f9',      // 'q_' + 序号 + '_' + 题干 hash，重复导入保持稳定
  type: 'single',       // single | multiple | judge | fill
  stem: '题干文本',
  options: [ { key: 'A', text: '选项内容' } ],   // judge 固定 [正确, 错误]；fill 为 []
  answer: 'A',          // single/judge: 'A'|'B'；multiple: ['A','C']（升序）；fill: ['答案1','答案2']（任一命中即对）
  analysis: '解析',     // 可为空字符串
  tags: ['马原·第一章'] // 导入时按题库名打标
}
```

### 4.2 存储 key（全部在 `utils/store.js` 的 `K` 对象里）

| key                    | 结构                                                        |
| ---------------------- | --------------------------------------------------------- |
| `qb:list`              | `[{id, name, count, createdAt, lastPracticedAt}]`         |
| `qb:data:<bankId>`     | 题目数组                                                      |
| `qb:progress:<bankId>` | `{mode, order:[题id], index, answers:{题id:答案}, startedAt}` |
| `qb:wrong:<bankId>`    | `[{questionId, count, lastWrongAt}]`                      |
| `qb:fav:<bankId>`      | `[题id]`                                                   |
| `qb:stat:<bankId>`     | `{answered, correct}`                                     |
| `qb:lastResult`        | 最近一次练习结果（结果页读取）                                           |
| `app:settings`         | `{autoNext, autoNextDelay}`，delay 白名单 400/800/1500        |
| `app:theme`            | `'light' \| 'dark' \| 'auto'`                             |
| `app:meta`             | `{version, lastBackupAt}`                                 |
| `app:seeded`           | 内置题库是否已写入过（1 = 已写）                                        |

**注意**：微信的 storage 按「小程序 + 微信用户」维度存放，**不区分开发版/体验版/正式版**，三者共用一套。这是官方行为，不是 bug。

---

## 5. 设计系统

### 5.1 颜色令牌（`app.wxss` 里 `.page.theme-light` / `.page.theme-dark` 各定义一份）

| 变量                                                | 白昼                    | 深夜                    | 用途           |
| ------------------------------------------------- | --------------------- | --------------------- | ------------ |
| `--bg`                                            | `#F3FAF6`             | `#0D1210`             | 页面底          |
| `--bg-soft`                                       | `#E9F6EF`             | `#121A16`             | 次级面、进度条槽、选项底 |
| `--card`                                          | `#FFFFFF`             | `#151C19`             | 卡片           |
| `--text`                                          | `#0F1115`             | `#EAF2EE`             | 主文字（纯黑）      |
| `--text-2`                                        | `#64756D`             | `#8FA199`             | 次要文字         |
| `--text-3`                                        | `#9BAAA2`             | `#6E7F78`             | 辅助文字         |
| `--border`                                        | `#E4F0EA`             | `#232D28`             | 描边           |
| `--border-strong`                                 | `#D2E6DB`             | `#2E3A34`             | 强调描边         |
| `--lime`                                          | `#C9F26E`             | `#C9F26E`             | 亮柠绿（主操作）     |
| `--lime-deep`                                     | `#B6E84E`             | `#D8FA8A`             | 渐变终点         |
| `--lime-soft`                                     | `#F1FBD9`             | `#23301A`             | 柠绿浅底         |
| `--mint`                                          | `#A9E5CB`             | `#6FCBA6`             | 薄荷点缀         |
| `--mint-soft`                                     | `#E6F7EF`             | `#16241E`             | 薄荷浅底         |
| `--ink` / `--on-ink`                              | `#0F1115` / `#FFF`    | `#C9F26E` / `#0D1210` | 实底按钮         |
| `--on-lime`                                       | `#10160F`             | `#10160F`             | 柠绿上的字（黑）     |
| `--on-strong`                                     | `#FFFFFF`             | `#FFFFFF`             | 绿/红实底上的白字    |
| `--ok` / `--ok-soft`                              | `#2FB877` / `#E4F7EC` | `#4BD08B` / `#142A20` | 正确           |
| `--bad` / `--bad-soft`                            | `#F2705B` / `#FDECE8` | `#FF8B76` / `#2E1C18` | 错误           |
| `--warn` / `--warn-soft`                          | `#E8A33D` / `#FCF2E2` | `#E9B45C` / `#2C2418` | 计时告急         |
| `--shadow` / `--shadow-lg` / `--glow` / `--inner` | 见文件                   | 见文件                   | 轻新拟态四件套      |

### 5.2 形态规范

- **圆角**：卡片 30–40rpx，按钮全部胶囊 `999rpx`，小标签 999rpx
- **阴影**：`box-shadow: var(--shadow), var(--inner)` —— 极淡外阴影 + 1rpx 内高光，是"新拟态"的关键，缺内高光就会显得平
- **留白**：页面左右 32–40rpx，卡片内边距 30rpx+
- **装饰**：只有首页顶部两枚低透明度圆形色块，别再加线条/图标

### 5.3 tabBar 机制（改这块必看）

自定义 tabBar 在**页面之外**渲染，取不到 `.page` 上的 CSS 变量。所以：

1. `custom-tab-bar/index.wxss` 里**自带一份**主题变量（`.tabbar` 和 `.tabbar.theme-dark`）
2. 每个 tab 页在 `applyTheme()` 和 `onShow()` 里调 `theme.syncTabBar(this, N)`，把 `themeClass` 和 `selected` 推给组件
3. 新增 tab 页必须：`app.json` 的 `tabBar.list` 加一项 + `pages` 加一项 + `onShow` 里 `syncTabBar(this, 新下标)`

---

## 6. 内置题库机制

- 数据：`utils/banks/bank-01..07.js`，每个导出 `{ name, questions }`
- 聚合：`utils/builtin-banks.js` → `module.exports = [ require(...), ... ]`
- 写入：`app.js` 的 `onLaunch` → `store.seedBuiltinOnce()`
- 规则：
  - **按题库名查重**写入，同名已存在则跳过（所以用户先加载示例题库也不影响）
  - 成功后写 `app:seeded = 1`；**失败不写标记**，下次启动自动重试
  - 用户删掉内置题库后不会再自动回来
  - `store.seedBuiltin(true)` 是强制入口，供首页空态按钮用
- 题目统计：**912 题 = 单选 424 / 多选 173 / 判断 315**，7 个题库

**为什么拆成 7 个分片**：曾经把 912 题塞进一个 730KB 的 JS 文件、最长一行 35 万字符，微信开发者工具编译会卡死或静默失败（工具保留上次成功的构建，表现为"代码没生效"）。拆分后单文件 ≤236KB、最长行 ≤745 字符。**不要再合并回去。**

---

## 7. 踩过的坑（重复踩会很痛）

1. **`单项选择题` 里没有 `单选` 子串** —— `'单选' in '单项选择题' === false`，题型判断必须同时匹配 `单项`
2. **文档每节题号都从 1 重排** —— 解析修复表若只按题号匹配，会把多选题第 3 题套到判断题第 3 题上。key 必须带题型
3. **题干可能内嵌答案** —— 形如 `...( )答案：正确`，且紧跟一个空的 `【给定答案】` 段落会把答案覆盖成空串 → 空值不可覆盖已有答案
4. **选项 A 可能被并进题干** —— 需人工定点修复（`parse_banks.py` 里的 `REPAIRS` 表）
5. **小程序不能读项目里的 json 文件** —— 数据必须内联成 JS 模块
6. **`[].concat(分片数组)` 会把题目摊平、丢掉题库名** —— 分片必须导出对象，聚合用 `[ require(), ... ]`
7. **主题初始值硬编码会闪白** —— 6 个页面的 `data.themeClass` 必须是 `theme.themeClass()` 运行时求值，不能写死 `'theme-light'`
8. **结果页环形图别依赖内联 CSS 变量透传** —— 直接把 `conic-gradient(...)` 写进 `style` 更稳
9. **题库 id 同毫秒撞车** —— `Date.now().toString(36)` 单用会重复，必须加自增序号 + 现存 id 去重
10. **备份恢复不能"先删后写"** —— 写失败会丢光数据。正确顺序：容量预检 → 写哨兵探测 → 快照 → **只覆盖不删除** → 只回滚已覆盖项 → 全成功后才清理多余 key
11. **测试断言不能把缺陷当预期** —— 曾出现 `ok('...未清除定时器（缺陷点）', !!timer)`，导致"修得越对越红"。断言必须描述正确行为
12. **体验版二维码约 7 天过期**（弹窗写明截止日期），体验版版本本身不过期

---

## 8. 测试（457 条断言）

位置：`D:\03_项目归档\MarxQuiz MP-开发资料\tests\`，脚本里的工程路径是**绝对路径**，从哪跑都行。

```bash
cd "D:/03_项目归档/MarxQuiz MP-开发资料/tests"
NODE="C:/Users/Wpengz/.workbuddy-ai/binaries/node/versions/22.22.2-6/node.exe"
"$NODE" test-parser.js    # 129 条：JSON/TXT/CSV 解析、答案容错、边界、BOM/CRLF
"$NODE" test-util.js      #  46 条：判分逻辑、格式化
"$NODE" test-static.js    # 103 条：硬编码颜色、主题变量差集、事件绑定、路由、纯离线
"$NODE" test-smoke.js     #  74 条：mock wx 驱动页面跑通主流程
"$NODE" test-docs.js      #  94 条：README 与实现一致性、文件清单
"$NODE" test-theme-firstframe.js  # 3 条：首帧主题不闪白
"$NODE" test-edge.js      #   8 条：自动跳题时序、exam 模式、恢复回滚
```

当前状态：**PASS 457 / FAIL 0**。

**改动代码后必须全跑一遍。** 如果某条断言与需求冲突，先质疑断言，不要改源码去迁就。

---

## 9. 题库生产流水线

原始文档：`D:\workBuddy\2026-10-27-21-08-59\output\*_题库解析.docx`（7 个）

```
docx
 └─ pipeline/dump.py            提取段落文本（zipfile + xml.etree，不依赖 python-docx）
 └─ pipeline/parse_banks.py     解析成 7 个分章 JSON（含 3 处人工修复）
 └─ pipeline/gen_builtin.py     生成 utils/banks/bank-01..07.js + builtin-banks.js
 └─ pipeline/verify_with_app_parser.js   用小程序自己的 parser.js 校验 JSON
 └─ pipeline/verify_seed2.js    校验写入/查重/删除不复活/强制载入
```

```bash
PY="C:/Users/Wpengz/.workbuddy-ai/binaries/python/versions/3.13.12/python.exe"
cd "D:/03_项目归档/MarxQuiz MP-开发资料/pipeline"
"$PY" parse_banks.py      # → 7 个 JSON（输出到 .docx-extract/banks，路径需按需改）
"$PY" gen_builtin.py      # → 直接写入项目 utils/banks/
```

> 注意：`parse_banks.py` / `gen_builtin.py` 里的输出路径是**上一轮的临时目录**，接手后如果路径不存在，改成 `D:\03_项目归档\马原题库_JSON备份\` 即可。

---

## 10. 部署状态与当前卡点 ⚠️

### 已完成

- 工程可编译、可在开发者工具模拟器里正常运行（用户已确认「预览」扫码能打开）
- 正式 AppID 已写入：**`wxYOUR_APPID_HERE`**（`project.config.json` 第 52 行）
- 项目名：马原刷题
- 上传忽略：`tools/`、`sample/`；上传体积约 1.1MB（主包上限 2MB）

### 未完成：扫体验版二维码报「页面不存在 / 进入 null 首页」

已知信息：

- 用户已确认「预览」正常、体验版标签显示 1.1.0、二维码路径正确
- 该 AppID 下还有另一个项目（开发版本 2.0.1，首页 `pages/dashboard/index`），用户选择"覆盖体验版"方案
- 手机端报错页面标题是「刷题助手」，内容「该页面不存在，你可以进入 null 首页获取更多服务」

**下一步排查建议（按顺序）**：

1. 让用户在微信里**长按删除该小程序**（清掉本地代码包缓存），再从后台现点现扫体验版码
2. 让用户发「**管理 → 版本管理**」整页截图，确认蓝色「体验版」标签挂在 **1.1.0** 那条上（不是 2.0.1）
3. 让用户发「**扫码访问体验版**」弹窗截图，读「路径」那一行是不是 `pages/index/index`
4. 若以上都对，考虑：`app.json` 里 `tabBar.custom` + `custom-tab-bar` 在体验版环境是否正常（可临时把 `custom` 改 false 验证）
5. 兜底：临时把 `app.json` 的 `pages` 顺序或 `tabBar` 去掉再传一版，二分定位

---

## 11. 待办 / 可扩展

- [ ] 解决体验版扫码问题（见第 10 节）
- [ ] 备份提醒：连续答满 N 题 / 距上次备份超 7 天，首页温和提示（已和用户提过，未实现）
- [ ] 章节标签筛选、艾宾浩斯复习、错题导出
- [ ] 用户后续可能导入自己的题库（Excel/Word → `tools/convert.py` → JSON）

---

## 12. 与用户协作的注意点

- 用户不写代码，所有操作要靠**界面路径**描述（精确到"左侧哪个菜单 → 哪个按钮"）
- 用户已注册的小程序账号：`gh_71e6c646d01f`（空壳，未填基本信息）+ 两个测试号；真正在用的是 **AppID `wxYOUR_APPID_HERE`** 那个
- 用户对"数据会不会丢"很敏感，涉及存储的改动要主动说明影响
- 不要把 `HANDOFF.md` 打进小程序包（已加入 `packOptions.ignore`）

---

## 13. 常用命令速查

```bash
NODE="C:/Users/Wpengz/.workbuddy-ai/binaries/node/versions/22.22.2-6/node.exe"
PY="C:/Users/Wpengz/.workbuddy-ai/binaries/python/versions/3.13.12/python.exe"

# 全量回归
cd "D:/03_项目归档/MarxQuiz MP-开发资料/tests"
for f in test-parser.js test-util.js test-static.js test-smoke.js test-docs.js test-theme-firstframe.js test-edge.js; do
  "$NODE" "$f" 2>&1 | grep -E "PASS [0-9]+ / FAIL"
done

# 语法检查
cd "D:/03_项目归档/MarxQuiz MP"
for f in $(find . -name "*.js"); do "$NODE" --check "$f" || echo "ERR $f"; done

# 页面 WXSS 硬编码颜色
grep -rnE "#[0-9a-fA-F]{3,8}|rgba?\(" pages/ --include=*.wxss | grep -v "var(--"
```


```
