// 《四级备考执行计划 · 10.8 启动》逐日任务数据（2026.10.08 – 2026.12.11）
// 来源：D:/豆包/四级备考执行计划_10.8启动_含网课版.docx（启动 10.8 / 考试 12.12 / 目标 425）
// 铁律：只写"内容指针 contentRef（去哪做）"，不存任何单词/题目正文
//
// 三阶段 10 周：
//   基础夯实期 W1–W5  10.08–11.09  过完 U3–U7 共 20 课，听力适应语速，长难句能拆主干
//   专项强化期 W6–W8  11.10–11.30  分题型刷华研提升篇，听力错题率≤20%，仔细阅读≥70%
//   模考冲刺期 W9–W10 12.01–12.11  完整模考 2 次，错题回炉，熟练套用写作框架
//
// 作息：工作日（周一至周五）晚自习 35–40 分钟，只做复习 + 泛听/精听 1 篇，不赶新课
//       周末集中完成新课、精听、精读拆解，每周 4–5 小时，分 2 次完成
var d = require('./date');

var START = '2026-10-08';
var END = '2026-12-11';

// ————————————————————————————————————————————
// 一、精确单日任务（周末 + W1 工作日 + W10 全部）
// ————————————————————————————————————————————
var DAYS = {
  // ===== W1 启动周（10.8–10.12）：U3 Lesson2 → U3 Lesson4 =====
  '2026-10-08': [
    { title: '单词 · 复习 U3L1 + 新课 U3L2（核心释义+搭配+发音）', type: 'vocab', count: 2, unit: '课', newCount: 1, reviewCount: 1, ref: '刘晓燕48课 U3L2 / 复习 U3L1', slot: '晚自习', mins: 15 },
    { title: '听力泛听 · 长对话基础篇 第1篇（盲听抓大意）', type: 'listen', count: 1, unit: '篇', qtypes: ['长对话'], ref: '华研八合一 听力专项·长对话基础篇 第1篇', slot: '晚自习', mins: 20 }
  ],
  '2026-10-09': [
    { title: '单词 · 复习 U3L2 + 新课 U3L3', type: 'vocab', count: 2, unit: '课', newCount: 1, reviewCount: 1, ref: '刘晓燕48课 U3L3 / 复习 U3L2', slot: '晚自习', mins: 15 },
    { title: '听力泛听 · 长对话基础篇 第2篇（尝试捕捉转折词）', type: 'listen', count: 1, unit: '篇', qtypes: ['长对话'], ref: '华研八合一 听力专项·长对话基础篇 第2篇', slot: '晚自习', mins: 20 }
  ],
  // 真实日历：10.10 周六 / 10.11 周日（周末集中）；10.12 周一回到工作日轻量模式
  '2026-10-10': [ // 周六：周末大块，先把 U3L4 学完，再精听与拆句
    { title: '单词 · 新课 U3L4（完成 U3 全单元，核心释义+搭配+发音）', type: 'vocab', count: 1, unit: '课', newCount: 1, ref: '刘晓燕48课 U3L4 / 复习 U3L3', slot: '上午', mins: 40 },
    { title: '听力精听 · 长对话基础篇 第4篇（三步法：盲听→逐句抠连读弱读→跟读）', type: 'listen', count: 1, unit: '篇', qtypes: ['长对话'], ref: '华研八合一 听力专项·长对话基础篇 第4篇', slot: '上午', mins: 55 },
    { title: '阅读长难句 · 仔细阅读基础篇 第1篇挑3句拆解（圈主谓宾、划从句）', type: 'read', count: 3, unit: '句', qtypes: ['长难句'], ref: '华研八合一 阅读分项·仔细阅读基础篇 第1篇', slot: '下午', mins: 45 }
  ],
  '2026-10-11': [ // 周日：U3 已学完，做全单元复盘
    { title: '单词 · U3 全单元复盘自测（遮中文自测，标记遗忘词）', type: 'vocab', count: 4, unit: '课', reviewCount: 4, ref: '刘晓燕48课 U3（L1-L4）', slot: '上午', mins: 40 },
    { title: '听力精听 · 长对话基础篇 第5篇（错题精听）', type: 'listen', count: 1, unit: '篇', qtypes: ['长对话'], ref: '华研八合一 听力专项·长对话基础篇 第5篇', slot: '上午', mins: 45 },
    { title: '阅读长难句 · 仔细阅读基础篇 第1篇再挑3句拆解（尝试不看译文翻译）', type: 'read', count: 3, unit: '句', qtypes: ['长难句'], ref: '华研八合一 阅读分项·仔细阅读基础篇 第1篇', slot: '下午', mins: 35 }
  ],
  '2026-10-12': [ // 周一：回到工作日模式，补听力进度 + 过遗忘词
    { title: '单词 · 快速过 U3 标记的遗忘词', type: 'vocab', count: 4, unit: '课', reviewCount: 4, ref: '刘晓燕48课 U3（L1-L4）遗忘词', slot: '晚自习', mins: 15 },
    { title: '听力泛听 · 长对话基础篇 第3篇', type: 'listen', count: 1, unit: '篇', qtypes: ['长对话'], ref: '华研八合一 听力专项·长对话基础篇 第3篇', slot: '晚自习', mins: 20 }
  ],

  // ===== W2 巩固周 周末（10.17–10.18）=====
  '2026-10-17': [
    { title: '单词 · U4 全单元复盘自测', type: 'vocab', count: 4, unit: '课', reviewCount: 4, ref: '刘晓燕48课 U4（L1-L4）', slot: '上午', mins: 40 },
    { title: '听力精听 · 短篇新闻基础篇 第1-2篇（每篇25分钟，重点听首句主旨）', type: 'listen', count: 2, unit: '篇', qtypes: ['短篇新闻'], ref: '华研八合一 听力专项·短篇新闻基础篇 第1-2篇', slot: '上午', mins: 50 },
    { title: '阅读长难句 · 仔细阅读基础篇 第2篇挑3句拆解，整理句中生词', type: 'read', count: 3, unit: '句', qtypes: ['长难句'], ref: '华研八合一 阅读分项·仔细阅读基础篇 第2篇', slot: '下午', mins: 45 }
  ],
  '2026-10-18': [
    { title: '单词 · U3-U4 遗忘词集中过一遍', type: 'vocab', count: 8, unit: '课', reviewCount: 8, ref: '刘晓燕48课 U3-U4 遗忘词清单', slot: '上午', mins: 30 },
    { title: '听力精听 · 短篇新闻基础篇 第3篇', type: 'listen', count: 1, unit: '篇', qtypes: ['短篇新闻'], ref: '华研八合一 听力专项·短篇新闻基础篇 第3篇', slot: '上午', mins: 40 },
    { title: '阅读长难句 · 仔细阅读基础篇 第2篇再挑3句拆解', type: 'read', count: 3, unit: '句', qtypes: ['长难句'], ref: '华研八合一 阅读分项·仔细阅读基础篇 第2篇', slot: '下午', mins: 35 },
    { title: '语法 · 梳理定语从句常见引导词', type: 'other', count: 1, unit: '次', ref: '英语兔 英语语法全集 · 定语从句', slot: '下午', mins: 20 }
  ],

  // ===== W3 提升周 周末（10.24–10.25）=====
  '2026-10-24': [
    { title: '单词 · U5 全单元复盘自测', type: 'vocab', count: 4, unit: '课', reviewCount: 4, ref: '刘晓燕48课 U5（L1-L4）', slot: '上午', mins: 40 },
    { title: '听力精听 · 短篇新闻基础篇 第9篇 + 短文理解基础篇 第1篇（抓首尾句和转折词）', type: 'listen', count: 2, unit: '篇', qtypes: ['短篇新闻', '短文理解'], ref: '华研八合一 听力专项·短篇新闻基础篇 第9篇 / 短文理解基础篇 第1篇', slot: '上午', mins: 50 },
    { title: '阅读长难句 · 仔细阅读基础篇 第3篇挑3句拆解', type: 'read', count: 3, unit: '句', qtypes: ['长难句'], ref: '华研八合一 阅读分项·仔细阅读基础篇 第3篇', slot: '下午', mins: 45 }
  ],
  '2026-10-25': [
    { title: '单词 · U5 遗忘词过一遍', type: 'vocab', count: 4, unit: '课', reviewCount: 4, ref: '刘晓燕48课 U5 遗忘词清单', slot: '上午', mins: 20 },
    { title: '听力精听 · 短文理解基础篇 第2篇', type: 'listen', count: 1, unit: '篇', qtypes: ['短文理解'], ref: '华研八合一 听力专项·短文理解基础篇 第2篇', slot: '上午', mins: 40 },
    { title: '阅读长难句 · 仔细阅读基础篇 第3篇再挑3句拆解', type: 'read', count: 3, unit: '句', qtypes: ['长难句'], ref: '华研八合一 阅读分项·仔细阅读基础篇 第3篇', slot: '下午', mins: 35 },
    { title: '语法 · 梳理状语从句引导词（when/if/though/because）', type: 'other', count: 1, unit: '次', ref: '英语兔 英语语法全集 · 状语从句', slot: '下午', mins: 20 }
  ],

  // ===== W4 强化周 周末（10.31–11.01）=====
  '2026-10-31': [
    { title: '单词 · U6 全单元复盘自测', type: 'vocab', count: 4, unit: '课', reviewCount: 4, ref: '刘晓燕48课 U6（L1-L4）', slot: '上午', mins: 40 },
    { title: '听力精听 · 短文理解基础篇 第8-9篇（注意人物观点和态度）', type: 'listen', count: 2, unit: '篇', qtypes: ['短文理解'], ref: '华研八合一 听力专项·短文理解基础篇 第8-9篇', slot: '上午', mins: 50 },
    { title: '阅读 · 仔细阅读基础篇 第4篇（精读 + 长难句拆解）', type: 'read', count: 1, unit: '篇', qtypes: ['仔细阅读'], ref: '华研八合一 阅读分项·仔细阅读基础篇 第4篇', slot: '下午', mins: 40 },
    { title: '阅读 · 长篇匹配基础篇 第1篇（入门练关键词扫读）', type: 'read', count: 1, unit: '篇', qtypes: ['长篇匹配'], ref: '华研八合一 阅读分项·长篇匹配基础篇 第1篇', slot: '下午', mins: 25 }
  ],
  '2026-11-01': [
    { title: '单词 · U6 遗忘词过一遍', type: 'vocab', count: 4, unit: '课', reviewCount: 4, ref: '刘晓燕48课 U6 遗忘词清单', slot: '上午', mins: 20 },
    { title: '听力精听 · 短文理解基础篇 第10篇', type: 'listen', count: 1, unit: '篇', qtypes: ['短文理解'], ref: '华研八合一 听力专项·短文理解基础篇 第10篇', slot: '上午', mins: 40 },
    { title: '阅读 · 长篇匹配基础篇 第2篇（不追求读懂全文）', type: 'read', count: 1, unit: '篇', qtypes: ['长篇匹配'], ref: '华研八合一 阅读分项·长篇匹配基础篇 第2篇', slot: '下午', mins: 25 },
    { title: '语法 · 梳理非谓语动词 to do / doing / done', type: 'other', count: 1, unit: '次', ref: '英语兔 英语语法全集 · 非谓语动词', slot: '下午', mins: 20 }
  ],

  // ===== W5 收尾复盘周 周末（11.07–11.08）=====
  '2026-11-07': [
    { title: '单词 · U7 全单元复盘自测', type: 'vocab', count: 4, unit: '课', reviewCount: 4, ref: '刘晓燕48课 U7（L1-L4）', slot: '上午', mins: 40 },
    { title: '听力 · 基础篇全部错题二刷（精听，检验5周成果）', type: 'listen', count: 1, unit: '轮', qtypes: ['错题精听'], ref: '华研八合一 听力专项·基础篇 错题集', slot: '上午', mins: 70 },
    { title: '阅读 · 仔细阅读基础篇 第5-6篇（精读 + 长难句拆解）', type: 'read', count: 2, unit: '篇', qtypes: ['仔细阅读'], ref: '华研八合一 阅读分项·仔细阅读基础篇 第5-6篇', slot: '下午', mins: 60 }
  ],
  '2026-11-08': [
    { title: '单词 · U3-U7 全量总复盘（遮住中文自测，标记仍遗忘的词）', type: 'vocab', count: 20, unit: '课', reviewCount: 20, ref: '刘晓燕48课 U3-U7（L1-L4 全量）', slot: '上午', mins: 60 },
    { title: '听力 · 本周精听材料泛听 1 遍', type: 'listen', count: 1, unit: '轮', qtypes: ['泛听'], ref: '本周精听音频', slot: '上午', mins: 30 },
    { title: '阅读 · 长篇匹配基础篇 第3-4篇', type: 'read', count: 2, unit: '篇', qtypes: ['长篇匹配'], ref: '华研八合一 阅读分项·长篇匹配基础篇 第3-4篇', slot: '下午', mins: 40 },
    { title: '写作入门 · 瑞斯拜 作文模板第1讲（背现象类开头结尾框架）', type: 'write', count: 1, unit: '讲', qtypes: ['写作框架'], ref: 'B站 我是瑞斯拜 四级作文模板 第1讲（现象类）', slot: '下午', mins: 40 }
  ],

  // ===== W6 听读专项周 周末（11.14–11.15）=====
  '2026-11-14': [
    { title: '听力专项 · 提升篇·短篇新闻2篇 + 短文理解1篇（完整做题 + 精听所有错题）', type: 'listen', count: 3, unit: '篇', qtypes: ['短篇新闻', '短文理解'], ref: '华研八合一 听力专项·提升篇 短篇新闻2篇+短文理解1篇', slot: '上午', mins: 90 },
    { title: '阅读专项 · 提升篇·仔细阅读2篇 + 长篇匹配1篇（严格计时：仔细阅读20min/2篇，匹配15min）', type: 'read', count: 3, unit: '篇', qtypes: ['仔细阅读', '长篇匹配'], ref: '华研八合一 阅读分项·提升篇 仔细阅读2篇+长篇匹配1篇', slot: '下午', mins: 90 }
  ],
  '2026-11-15': [
    { title: '写作入门 · 华研写作专项·现象类模板学习 + 仿写1篇（120词，修正时态与主谓一致）', type: 'write', count: 1, unit: '篇', qtypes: ['短文写作'], ref: '华研八合一 写作专项·现象类模板 / 瑞斯拜模板', slot: '上午', mins: 60 },
    { title: '周复盘 · 本周错题分类整理，标注错因（生词/定位错/漏听）', type: 'review', count: 1, unit: '次', qtypes: ['错题'], ref: '本周错题集', slot: '下午', mins: 60 },
    { title: '单词 · U3-U7 标记遗忘词过一遍', type: 'vocab', count: 20, unit: '课', reviewCount: 20, ref: '刘晓燕48课 U3-U7 遗忘词清单', slot: '下午', mins: 30 }
  ],

  // ===== W7 写译专项周 周末（11.21–11.22）=====
  '2026-11-21': [
    { title: '阅读专项 · 提升篇·仔细阅读2篇 + 选词填空2篇（选词填空控制在5分钟内，按词性筛选）', type: 'read', count: 4, unit: '篇', qtypes: ['仔细阅读', '选词填空'], ref: '华研八合一 阅读分项·提升篇 仔细阅读2篇+选词填空2篇', slot: '上午', mins: 90 },
    { title: '写作专项 · 观点类 + 利弊类模板学习 + 仿写2篇（形成3套自用框架）', type: 'write', count: 2, unit: '篇', qtypes: ['短文写作'], ref: '华研八合一 写作专项·观点类+利弊类模板', slot: '下午', mins: 90 }
  ],
  '2026-11-22': [
    { title: '翻译专项 · 中国文化类话题1篇（整段翻译，对照范文优化表达）', type: 'translate', count: 1, unit: '篇', qtypes: ['汉译英段落'], ref: '华研八合一 翻译专项·中国文化类话题', slot: '上午', mins: 60 },
    { title: '周复盘 · 写译错误整理 + 听力错题重听', type: 'review', count: 1, unit: '次', qtypes: ['错题'], ref: '本周写译错误 + 听力错题', slot: '下午', mins: 60 },
    { title: '单词 · 写译高频词组背诵', type: 'vocab', count: 30, unit: '词', reviewCount: 30, ref: '写译高频词组清单', slot: '下午', mins: 30 }
  ],

  // ===== W8 综合查漏周 周末（11.28–11.29）=====
  '2026-11-28': [
    { title: '综合小测 · 华研专项组合卷（听力1套 + 阅读1套，严格计时）', type: 'mock', count: 2, unit: '套', qtypes: ['听力25题', '阅读30题'], ref: '华研八合一 专项组合卷', slot: '上午', mins: 120 },
    { title: '小测复盘 · 逐题分析错因，整理薄弱点，回到专项册补练', type: 'review', count: 1, unit: '次', qtypes: ['错题'], ref: '组合卷错题', slot: '下午', mins: 60 }
  ],
  '2026-11-29': [
    { title: '写译复盘 · 3套写作框架默写 + 翻译高频词背诵', type: 'write', count: 3, unit: '套', qtypes: ['写作框架'], ref: '自用3套写作框架 / 翻译高频词', slot: '上午', mins: 90 },
    { title: '单词 · U3-U7 全量快速过一遍', type: 'vocab', count: 20, unit: '课', reviewCount: 20, ref: '刘晓燕48课 U3-U7（L1-L4 全量）', slot: '下午', mins: 60 },
    { title: '考前准备 · 确认华研真题套卷可用，准备答题卡', type: 'other', count: 1, unit: '次', ref: '华研八合一 真题套卷 + 答题卡', slot: '下午', mins: 30 }
  ],

  // ===== W9 模考周 周末（12.05–12.06）=====
  '2026-12-05': [
    { title: '完整模考 · 华研八合一 2026年6月真题套卷（严格复刻流程 2h20min）', type: 'mock', count: 1, unit: '套', qtypes: ['写作', '听力25题', '阅读30题', '翻译'], ref: '华研八合一 2026-06 真题套卷', slot: '上午(全真)', mins: 140 },
    { title: '模考执行要求：9:00-9:30写作 → 9:30-9:55听力(边听边涂卡) → 9:55-10:35阅读 → 10:35-11:05翻译', type: 'other', count: 1, unit: '次', qtypes: ['流程'], ref: '用答题卡，全程不查手机；听力结束立即模拟收答题卡1', slot: '上午(全真)', mins: 10 }
  ],
  '2026-12-06': [
    { title: '全套复盘 · 逐题精讲 + 错题整理（听力精听到每句，阅读定位到原文原句，写译对照范文）', type: 'review', count: 1, unit: '套', qtypes: ['逐题解析', '错题'], ref: '华研八合一 2026-06 真题解析', slot: '上午', mins: 180 }
  ],

  // ===== W10 保温周（12.8–12.11，逐日不同）=====
  '2026-12-08': [
    { title: '单词 · 复盘所有标记的高频生词（不背新词）', type: 'vocab', count: 30, unit: '词', reviewCount: 30, ref: '高频生词清单', slot: '晚自习', mins: 15 },
    { title: '错题 · 重做模考卷听力错题', type: 'review', count: 1, unit: '次', qtypes: ['错题'], ref: '2026-06 模考卷 听力错题', slot: '晚自习', mins: 15 }
  ],
  '2026-12-09': [
    { title: '单词 · 复盘高频生词', type: 'vocab', count: 30, unit: '词', reviewCount: 30, ref: '高频生词清单', slot: '晚自习', mins: 15 },
    { title: '错题 · 重做模考卷阅读错题（确保错过的题不再错）', type: 'review', count: 1, unit: '次', qtypes: ['错题'], ref: '2026-06 模考卷 阅读错题', slot: '晚自习', mins: 15 }
  ],
  '2026-12-10': [
    { title: '写作 · 默写 3 套写作框架（确保上场能直接套用）', type: 'write', count: 3, unit: '套', qtypes: ['写作框架'], ref: '自用3套写作框架', slot: '晚自习', mins: 15 },
    { title: '翻译 · 过一遍翻译高频词', type: 'translate', count: 30, unit: '词', qtypes: ['翻译词汇'], ref: '翻译高频词清单', slot: '晚自习', mins: 15 }
  ],
  '2026-12-11': [
    { title: '听力 · 泛听 1 套听力原文保持语感', type: 'listen', count: 1, unit: '套', qtypes: ['泛听'], ref: '真题听力原文', slot: '白天', mins: 20 },
    { title: '写作 · 默写 3 套写作框架', type: 'write', count: 3, unit: '套', qtypes: ['写作框架'], ref: '自用3套写作框架', slot: '白天', mins: 15 },
    { title: '翻译 · 过一遍翻译高频词', type: 'translate', count: 30, unit: '词', qtypes: ['翻译词汇'], ref: '翻译高频词清单', slot: '白天', mins: 15 },
    { title: '考前准备 · 准考证、身份证、耳机、2B铅笔、橡皮（提前30分钟到考场试音，今晚不熬夜）', type: 'other', count: 1, unit: '次', ref: '考试物品清单', slot: '白天', mins: 20 }
  ]
};

// ————————————————————————————————————————————
// 二、工作日模板（W2–W9）：i = 周内第几个工作日（0 基，0=周一）
// 返回该日的任务数组
// ————————————————————————————————————————————
var WORKDAYS = {
  // W2（10.13–10.19，工作日 10.13-10.16 + 10.19）：复习 U3 旧词 + 推进 U4 新课；长对话基础篇 第6-10篇
  '2026-10-13': function (i) {
    var vocab = i < 4
      ? { title: '单词 · 复习 U3 旧词 1 课 + 新课 U4L' + (i + 1), type: 'vocab', count: 2, unit: '课', newCount: 1, reviewCount: 1, ref: '刘晓燕48课 U4L' + (i + 1) + ' / 复习 U3', slot: '晚自习', mins: 15 }
      : { title: '单词 · U4 L1-L4 快速回顾 + U3-U4 混合复习', type: 'vocab', count: 8, unit: '课', reviewCount: 8, ref: '刘晓燕48课 U3-U4', slot: '晚自习', mins: 15 };
    return [vocab, {
      title: '听力泛听 · 长对话基础篇 第' + (6 + i) + '篇（边听边记关键词）',
      type: 'listen', count: 1, unit: '篇', qtypes: ['长对话'],
      ref: '华研八合一 听力专项·长对话基础篇 第' + (6 + i) + '篇', slot: '晚自习', mins: 20
    }];
  },
  // W3（10.20–10.26，工作日 10.20-10.23 + 10.26）：复习 U4 旧词 + 推进 U5 新课；短篇新闻基础篇 第4-8篇
  '2026-10-20': function (i) {
    var vocab = i < 4
      ? { title: '单词 · 复习 U4 旧词 1 课 + 新课 U5L' + (i + 1), type: 'vocab', count: 2, unit: '课', newCount: 1, reviewCount: 1, ref: '刘晓燕48课 U5L' + (i + 1) + ' / 复习 U4', slot: '晚自习', mins: 15 }
      : { title: '单词 · U5 L1-L4 快速回顾 + U4-U5 混合复习', type: 'vocab', count: 8, unit: '课', reviewCount: 8, ref: '刘晓燕48课 U4-U5', slot: '晚自习', mins: 15 };
    return [vocab, {
      title: '听力泛听 · 短篇新闻基础篇 第' + (4 + i) + '篇（适应新闻语速）',
      type: 'listen', count: 1, unit: '篇', qtypes: ['短篇新闻'],
      ref: '华研八合一 听力专项·短篇新闻基础篇 第' + (4 + i) + '篇', slot: '晚自习', mins: 20
    }];
  },
  // W4（10.27–11.02，工作日 10.27-10.30 + 11.02）：复习 U5 旧词 + 推进 U6 新课；短文理解基础篇 第3-7篇
  '2026-10-27': function (i) {
    var vocab = i < 4
      ? { title: '单词 · 复习 U5 旧词 1 课 + 新课 U6L' + (i + 1), type: 'vocab', count: 2, unit: '课', newCount: 1, reviewCount: 1, ref: '刘晓燕48课 U6L' + (i + 1) + ' / 复习 U5', slot: '晚自习', mins: 15 }
      : { title: '单词 · U6 L1-L4 快速回顾 + U5-U6 混合复习', type: 'vocab', count: 8, unit: '课', reviewCount: 8, ref: '刘晓燕48课 U5-U6', slot: '晚自习', mins: 15 };
    return [vocab, {
      title: '听力泛听 · 短文理解基础篇 第' + (3 + i) + '篇（注意人物观点和态度）',
      type: 'listen', count: 1, unit: '篇', qtypes: ['短文理解'],
      ref: '华研八合一 听力专项·短文理解基础篇 第' + (3 + i) + '篇', slot: '晚自习', mins: 20
    }];
  },
  // W5（11.03–11.09，工作日 11.03-11.06 + 11.09）：复习 U6 旧词 + 推进 U7 新课；短文理解基础篇 第11-12篇 + 错题重听
  '2026-11-03': function (i) {
    var vocab = i < 4
      ? { title: '单词 · 复习 U6 旧词 1 课 + 新课 U7L' + (i + 1), type: 'vocab', count: 2, unit: '课', newCount: 1, reviewCount: 1, ref: '刘晓燕48课 U7L' + (i + 1) + ' / 复习 U6', slot: '晚自习', mins: 15 }
      : { title: '单词 · U7 L1-L4 快速回顾 + U6-U7 混合复习', type: 'vocab', count: 8, unit: '课', reviewCount: 8, ref: '刘晓燕48课 U6-U7', slot: '晚自习', mins: 15 };
    var listen = i < 2
      ? { title: '听力泛听 · 短文理解基础篇 第' + (11 + i) + '篇', type: 'listen', count: 1, unit: '篇', qtypes: ['短文理解'], ref: '华研八合一 听力专项·短文理解基础篇 第' + (11 + i) + '篇', slot: '晚自习', mins: 20 }
      : { title: '听力 · 前期错题重听（检验是否真正掌握）', type: 'listen', count: 1, unit: '轮', qtypes: ['错题精听'], ref: '基础篇错题集', slot: '晚自习', mins: 20 };
    return [vocab, listen];
  },
  // W6（11.10–11.16，工作日 11.10-11.13 + 11.16）：单词10min复盘做题生词；单日听力、双日阅读（提升篇）
  '2026-11-10': function (i) {
    var main = (i % 2 === 0)
      ? { title: '听力专项 · 提升篇·长对话 1 篇 + 错题精听（重点抓 but/however 后答案）', type: 'listen', count: 1, unit: '篇', qtypes: ['长对话'], ref: '华研八合一 听力专项·提升篇 长对话 第' + (Math.floor(i / 2) + 1) + '篇', slot: '晚自习', mins: 30 }
      : { title: '阅读专项 · 提升篇·仔细阅读 1 篇 + 定位训练（题干关键词→原文同义替换）', type: 'read', count: 1, unit: '篇', qtypes: ['仔细阅读'], ref: '华研八合一 阅读分项·提升篇 仔细阅读 第' + (Math.floor(i / 2) + 1) + '篇', slot: '晚自习', mins: 30 };
    return [
      { title: '单词 · 复盘当天做题生词', type: 'vocab', count: 20, unit: '词', reviewCount: 20, ref: '当天做题生词', slot: '晚自习', mins: 10 },
      main
    ];
  },
  // W7（11.17–11.23，工作日 11.17-11.20 + 11.23）：单词10min复盘写译高频词；单日听力、双日翻译
  '2026-11-17': function (i) {
    var main = (i % 2 === 0)
      ? { title: '听力专项 · 提升篇·短文理解 1 篇', type: 'listen', count: 1, unit: '篇', qtypes: ['短文理解'], ref: '华研八合一 听力专项·提升篇 短文理解 第' + (Math.floor(i / 2) + 1) + '篇', slot: '晚自习', mins: 30 }
      : { title: '翻译专项 · 基础短句练习 5 句（先写简单句，对照译文修正）', type: 'translate', count: 5, unit: '句', qtypes: ['翻译句式'], ref: '华研八合一 翻译专项·基础短句', slot: '晚自习', mins: 30 };
    return [
      { title: '单词 · 复盘写译高频词', type: 'vocab', count: 20, unit: '词', reviewCount: 20, ref: '写译高频词清单', slot: '晚自习', mins: 10 },
      main
    ];
  },
  // W8（11.24–11.30，工作日 11.24-11.27 + 11.30）：U8-U10 高频词过一遍；听读交替重做错题
  '2026-11-24': function (i) {
    var main = (i % 2 === 0)
      ? { title: '听读交替 · 重做 1 篇听力错题（检验是否真正掌握）', type: 'listen', count: 1, unit: '篇', qtypes: ['错题'], ref: '听力错题集', slot: '晚自习', mins: 30 }
      : { title: '听读交替 · 重做 1 篇阅读错题（检验是否真正掌握）', type: 'read', count: 1, unit: '篇', qtypes: ['错题'], ref: '阅读错题集', slot: '晚自习', mins: 30 };
    return [
      { title: '单词 · U8-U10 高频词过一遍（认识即可，不推进新课）', type: 'vocab', count: 30, unit: '词', reviewCount: 30, ref: '刘晓燕48课 U8-U10 高频词', slot: '晚自习', mins: 10 },
      main
    ];
  },
  // W9（12.01–12.07，工作日 12.01-12.04 + 12.07）：不刷新题，泛听保持语感 + 回顾错题
  '2026-12-01': function () {
    return [
      { title: '听力 · 泛听真题原文保持语感（不刷新题）', type: 'listen', count: 1, unit: '轮', qtypes: ['泛听'], ref: '真题听力原文', slot: '晚自习', mins: 15 },
      { title: '复盘 · 回顾 1 套错题，记牢生词和错因', type: 'review', count: 1, unit: '套', qtypes: ['错题'], ref: '错题本', slot: '晚自习', mins: 15 }
    ];
  }
};

// ————————————————————————————————————————————
// 三、每周 B 站网课（绑到该周周六，周末集中学方法）
// 网课只学方法论，看完立刻刷题；一个题型固定一位主讲
// ————————————————————————————————————————————
var COURSES = {
  '2026-10-10': [
    { title: '网课 · 英语兔 英语语法全集：句子成分、定语从句入门（2-3节）', type: 'other', count: 3, unit: '节', ref: 'B站 英语兔 英语语法全集', slot: '下午', mins: 30 },
    { title: '网课 · Roy大表哥 四级大纲核心词速记：U3 对应词汇带背', type: 'vocab', count: 1, unit: '讲', reviewCount: 1, ref: 'B站 Roy大表哥 四级大纲核心词速记 U3', slot: '下午', mins: 20 }
  ],
  '2026-10-17': [
    { title: '网课 · 英语兔 英语语法全集：定语从句精讲、状语从句入门（2-3节）', type: 'other', count: 3, unit: '节', ref: 'B站 英语兔 英语语法全集', slot: '下午', mins: 30 },
    { title: '网课 · Roy大表哥 四级大纲核心词速记：U4 词汇带背（重点记动词短语与固定搭配）', type: 'vocab', count: 1, unit: '讲', reviewCount: 1, ref: 'B站 Roy大表哥 四级大纲核心词速记 U4', slot: '下午', mins: 20 }
  ],
  '2026-10-24': [
    { title: '网课 · 英语兔 英语语法全集：非谓语动词入门（2节）', type: 'other', count: 2, unit: '节', ref: 'B站 英语兔 英语语法全集', slot: '下午', mins: 30 },
    { title: '网课 · 烤鸭TV 四级听力提分全套教程：听力入门第1-2讲（视听一致）', type: 'listen', count: 2, unit: '讲', qtypes: ['方法论'], ref: 'B站 烤鸭TV 四级听力提分全套教程', slot: '下午', mins: 30 },
    { title: '网课 · Roy大表哥 四级大纲核心词速记：U5 词汇带背（积累熟词僻义与同义替换）', type: 'vocab', count: 1, unit: '讲', reviewCount: 1, ref: 'B站 Roy大表哥 四级大纲核心词速记 U5', slot: '下午', mins: 20 }
  ],
  '2026-10-31': [
    { title: '网课 · 烤鸭TV 四级听力提分全套教程：长对话做题技巧（2讲）', type: 'listen', count: 2, unit: '讲', qtypes: ['方法论'], ref: 'B站 烤鸭TV 四级听力提分全套教程', slot: '下午', mins: 30 },
    { title: '网课 · 英语兔 英语语法全集：时态 + 主谓一致梳理（1-2节）', type: 'other', count: 2, unit: '节', ref: 'B站 英语兔 英语语法全集', slot: '下午', mins: 25 },
    { title: '网课 · Roy大表哥 四级大纲核心词速记：U6 词汇带背', type: 'vocab', count: 1, unit: '讲', reviewCount: 1, ref: 'B站 Roy大表哥 四级大纲核心词速记 U6', slot: '下午', mins: 20 }
  ],
  '2026-11-07': [
    { title: '网课 · 烤鸭TV 四级听力提分全套教程：短篇新闻 + 短文理解技巧（2讲）', type: 'listen', count: 2, unit: '讲', qtypes: ['方法论'], ref: 'B站 烤鸭TV 四级听力提分全套教程', slot: '下午', mins: 30 },
    { title: '网课 · Roy大表哥 四级大纲核心词速记：U7 词汇带背（完成核心词一轮）', type: 'vocab', count: 1, unit: '讲', reviewCount: 1, ref: 'B站 Roy大表哥 四级大纲核心词速记 U7', slot: '下午', mins: 20 }
  ],
  '2026-11-14': [
    { title: '网课 · 我是瑞斯拜 四级阅读全套：段落匹配"勾念选三步法"（2讲）', type: 'read', count: 2, unit: '讲', qtypes: ['方法论'], ref: 'B站 我是瑞斯拜 四级阅读全套', slot: '下午', mins: 30 },
    { title: '网课 · 于妙然四六级 四级仔细阅读点睛课（2讲）', type: 'read', count: 2, unit: '讲', qtypes: ['方法论'], ref: 'B站 于妙然四六级 四级仔细阅读点睛课', slot: '下午', mins: 30 },
    { title: '网课 · 烤鸭TV 听力真题精讲：本周错题对应篇目（错题回看）', type: 'listen', count: 1, unit: '讲', qtypes: ['错题'], ref: 'B站 烤鸭TV 听力真题精讲', slot: '下午', mins: 25 }
  ],
  '2026-11-21': [
    { title: '网课 · 石雷鹏 四级写作功能句（2讲）', type: 'write', count: 2, unit: '讲', qtypes: ['方法论'], ref: 'B站 石雷鹏 四级写作功能句', slot: '下午', mins: 30 },
    { title: '网课 · 邹老师四六级翻译 四级翻译真题精讲（2讲）', type: 'translate', count: 2, unit: '讲', qtypes: ['方法论'], ref: 'B站 邹老师四六级翻译 四级翻译真题精讲', slot: '下午', mins: 30 }
  ],
  '2026-11-28': [
    { title: '网课 · 石雷鹏 写作功能句第3讲 + 邹老师 翻译真题精讲第3讲', type: 'write', count: 2, unit: '讲', qtypes: ['方法论'], ref: 'B站 石雷鹏 写作功能句 / 邹老师 翻译真题精讲', slot: '下午', mins: 30 },
    { title: '网课 · 瑞斯拜 / 于妙然 阅读薄弱题型回看（按需 1-2 讲）', type: 'read', count: 2, unit: '讲', qtypes: ['方法论'], ref: 'B站 我是瑞斯拜 / 于妙然四六级', slot: '下午', mins: 25 }
  ],
  '2026-12-05': [
    { title: '网课 · 不刷新课，只回看薄弱题型短视频（每段不超过20分钟）', type: 'other', count: 1, unit: '段', ref: 'B站 对应 UP 主技巧片段', slot: '下午', mins: 20 }
  ]
  // W10（12.8–12.11）：文档明确"不安排任何网课"，全部时间用于复盘与考前准备
};

// 阶段归属：基础夯实 10.8–11.9 / 专项强化 11.10–11.30 / 模考冲刺 12.1–12.11
function stageOf(date) {
  if (date >= '2026-12-01') return 'mock';
  if (date >= '2026-11-10') return 'special';
  return 'basic';
}

// 展开成完整逐日任务表：{ 'YYYY-MM-DD': [task, ...] }
function build() {
  var map = {};

  function push(date, list) {
    if (!list || !list.length) return;
    if (!map[date]) map[date] = [];
    list.forEach(function (t) {
      map[date].push(Object.assign({}, t, { date: date, stage: stageOf(date) }));
    });
  }

  // 1) 周末 + W1 工作日 + W10：精确表
  Object.keys(DAYS).forEach(function (date) { push(date, DAYS[date]); });

  // 2) 工作日模板展开（W2–W9）
  // 按**真实星期**判断：只给周一至周五（dow 1–5）生成，周末交给 DAYS 精确表
  // i 取"该周内第几个工作日"，因此周内跨过周末时序号连续（如 10.16 周五 -> 10.19 周一）
  Object.keys(WORKDAYS).forEach(function (weekStart) {
    var wi = 0;
    for (var k = 0; k < 7; k++) {
      var date = d.addDays(weekStart, k);
      var dow = d.dayOfWeek(date);
      if (dow === 0 || dow === 6) continue; // 周六/周日：由 DAYS 提供周末大块任务
      push(date, WORKDAYS[weekStart](wi));
      wi++;
    }
  });

  // 3) 每周网课，绑到该周周六
  Object.keys(COURSES).forEach(function (saturday) { push(saturday, COURSES[saturday]); });

  return map;
}

module.exports = {
  START: START,
  END: END,
  stageOf: stageOf,
  build: build
};
