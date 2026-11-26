// 规划引擎：三段日程生成（空占位框架，不含任何题目/单词内容）
// 逻辑对齐《个性化四级备考计划 v5.2》：
//  - 三阶段锚定末段：模考=考前12天 / 专项=再往前18天 / 基础=其余
//  - 每周时长渐进表：W1-2=8h, W3-4=10h, W5-10=12h, W11-12=9h（按 6 学习日折算每日分钟）
//  - 每周日（非模考期）= 周小测与复盘；模考期按 3 天一轮（模考/复盘/回炉）+ 最后3天保温
//  - 词汇任务完成后自动生成 +2 天艾宾浩斯复习任务
//  - 《10.8启动计划》（2026.10.08–12.11，三阶段 10 周）：逐日精确任务，见 utils/plan108.js
//  - 10.8 之后通用生成只作兜底（计划已覆盖到考试前一天 12.11）
var d = require('./date');
var store = require('./store');
var plan108 = require('./plan108');
var LESSON = require('./lessonRef');
var PLAN108_DAYS = plan108.build(); // 逐日任务表（工作日模板已展开）

var TYPE_NAMES = {
  vocab: '词汇', listen: '听力', read: '阅读',
  write: '写作', translate: '翻译', mock: '模考',
  review: '复盘/复习', other: '其他'
};
var TYPE_KEYS = ['vocab', 'listen', 'read', 'write', 'translate', 'mock', 'review', 'other'];

var STAGE_NAMES = {
  basic: '基础夯实期', special: '专项突破期', mock: '模考冲刺期'
};


// 三阶段切分（考试当天不排任务）
function stages(examDate) {
  var mockStart = d.addDays(examDate, -12);
  var specStart = d.addDays(mockStart, -18);
  return {
    basic: { start: null, end: d.addDays(specStart, -1), name: STAGE_NAMES.basic },
    special: { start: specStart, end: d.addDays(mockStart, -1), name: STAGE_NAMES.special },
    mock: { start: mockStart, end: d.addDays(examDate, -1), name: STAGE_NAMES.mock }
  };
}

function stageOf(dateStr, s) {
  if (dateStr >= s.mock.start && dateStr <= s.mock.end) return 'mock';
  if (dateStr >= s.special.start && dateStr <= s.special.end) return 'special';
  return 'basic';
}

// 全程时间轴的三段分段（供日历底部进度带使用）。
// 口径优先级：以"实际生成任务的阶段边界"为准（与日历日底色、计划任务口径一致），
// 仅当没有任何生成任务（纯手动或老数据）时，才退回通用公式 engine.stages。
// 手动任务（source='manual'）不计入阶段划分。
function stageSegments(tasks, start, total, examDate) {
  var order = ['basic', 'special', 'mock'];
  var nameMap = { basic: '基础', special: '专项', mock: '模考' };
  var clsMap = { basic: 'seg-basic', special: 'seg-special', mock: 'seg-mock' };

  var bounds = {};
  tasks.forEach(function (t) {
    if (t.source === 'manual' || !t.stage) return;
    if (!bounds[t.stage]) {
      bounds[t.stage] = { first: t.planDate, last: t.planDate };
    } else {
      if (t.planDate < bounds[t.stage].first) bounds[t.stage].first = t.planDate;
      if (t.planDate > bounds[t.stage].last) bounds[t.stage].last = t.planDate;
    }
  });

  function clip(a, b) {
    return { a: Math.max(0, a), b: Math.min(total, b) };
  }
  function toSeg(k, a, b) {
    var c = clip(a, b);
    var days = c.b - c.a;
    return days > 0 ? { key: k, name: nameMap[k], cls: clsMap[k], days: days } : null;
  }

  if (Object.keys(bounds).length === 0) {
    var s = stages(examDate);
    return order.map(function (k) {
      var a = s[k].start ? d.diffDays(start, s[k].start) : 0;
      return toSeg(k, a, d.diffDays(start, s[k].end) + 1);
    }).filter(Boolean);
  }
  return order.map(function (k) {
    if (!bounds[k]) return null;
    return toSeg(k, d.diffDays(start, bounds[k].first), d.diffDays(start, bounds[k].last) + 1);
  }).filter(Boolean);
}

// 每周时长渐进表 -> 周小时数
function weekHours(w) {
  if (w <= 2) return 8;
  if (w <= 4) return 10;
  if (w <= 10) return 12;
  return 9; // 模考冲刺期：重质不重量
}

// 周小时数 -> 每日预算分钟（按每周 6 个学习日折算）
function dailyMinutes(w) {
  return Math.round(weekHours(w) * 60 / 6);
}

// 生成整份规划（覆盖今日 -> 考试前一天）
function generatePlan(profile) {
  var today = d.todayStr();
  var exam = profile.examDate;
  // 正式启动日 = 《10.8启动计划》首日：启动日之前不排任务（国庆假期另有安排）
  var start = (today < plan108.START && exam > plan108.START) ? plan108.START : today;
  var total = d.diffDays(start, exam);
  if (total <= 0) return { tasks: [], note: '考试日期已过或就是今天，未生成任务' };

  var s = stages(exam);
  var tasks = [];
  // 量化任务创建：每个任务带 数量/单位/新词复习/题型/来源/时段/耗时，杜绝"背单词"式模糊表述
  // opts.ref = 内容指针（去哪看）；opts.src = 任务来源（engine=规划生成 / plan108=10.8启动计划）
  function mk(opts) {
    tasks.push({
      id: 'e' + d.toTs(opts.date) + '_' + tasks.length,
      title: opts.title,
      type: opts.type,
      count: (typeof opts.count === 'number') ? opts.count : null, // 数量：50/8/1/1...
      unit: opts.unit || '',                                        // 单位：词/题/篇/句/段/套/课/讲
      newCount: opts.newCount || 0,                                 // 词汇：新词数
      reviewCount: opts.reviewCount || 0,                           // 词汇：复习数
      qtypes: opts.qtypes || [],                                    // 题型：长对话/仔细阅读/...
      contentRef: opts.ref || '',                                   // 内容指针：材料来源（你持有的）
      slot: opts.slot || '',                                        // 建议时段：晨/午/晚
      planDate: opts.date,
      estMinutes: opts.mins,
      status: 0,                                                     // 0 待做 / 1 已完成
      stage: opts.stage,
      source: opts.src || 'engine',                                 // engine=规划生成 / plan108=10.8启动计划
      createdAt: Date.now()
    });
  }

  var READ_TYPES = ['仔细阅读', '仔细阅读', '选词填空']; // 基础期阅读以仔细阅读为主，少量选词填空
  var LISTEN_TYPES = ['短篇新闻', '长对话', '短文理解']; // 听力三题型按日轮换
  // 词汇课次续接偏移：U1-U4 共 16 课已在"学前 + 15天计划"完成（U3L2–U4L4 排在国庆强化期）
  // 10.14 起通用基础期从 U5L1 续接（不重学）
  // 注意 lessonRef 用 (vocabSeq%48)+1，调用前 vocabSeq++，故初始化取 15 -> 首条通用词汇 = U5L1
  var vocabSeq = 15;
  function lessonRef() {
    var n = (vocabSeq % 48) + 1;
    return LESSON.toLabel(n);
  }

  for (var date = start; d.diffDays(date, exam) > 0; date = d.addDays(date, 1)) {
    var stage = stageOf(date, s);
    var w = Math.floor(d.diffDays(start, date) / 7) + 1;
    var mins = dailyMinutes(w);
    var dow = d.dayOfWeek(date);
    var di = d.diffDays(start, date); // 第几天（0 基），用于题型轮换

    // —— 《10.8启动计划》（10.08–12.11，三阶段 10 周）——
    // 覆盖通用生成：逐日精确任务（工作日模板已展开，每周网课绑在周六）
    if (date >= plan108.START && date <= plan108.END) {
      (PLAN108_DAYS[date] || []).forEach(function (tt) {
        mk(Object.assign({}, tt, { src: 'plan108' }));
      });
      continue;
    }

    // 周日（非模考期）：阶段性小测 + 复盘
    if (stage !== 'mock' && dow === 0) {
      if (stage === 'special') {
        mk({ title: '综合小测 · 听读写译全套自测', type: 'review', count: 1, unit: '套',
             qtypes: ['听力', '阅读', '写作', '翻译'],
             ref: '华研八合一 分项自测（目标 听≥14/25 读≥20/30）', slot: '上午', mins: 90, stage: stage, date: date });
      } else {
        mk({ title: '周小测与复盘 · 查漏补欠（弱项自选听/读/写译）', type: 'review', count: 1, unit: '次',
             qtypes: ['弱项自测'], ref: '本周错题 + 真题分项', slot: '上午', mins: 40, stage: stage, date: date });
      }
      continue;
    }

    if (stage === 'basic') {
      // 基础夯实期：火力压词汇+听力+阅读（占过线分 70%），写译仿句起步
      var longB = mins >= 110; // 120min 档（W5-10 才会到）
      vocabSeq++;
      mk({ title: '词汇 · 新词+复习（词以群记）', type: 'vocab', count: 50, unit: '词',
           newCount: 30, reviewCount: 20, ref: lessonRef() + ' / 不背单词复习', slot: '晨', mins: 30, stage: stage, date: date });
      mk({ title: '听力精听 · 逐句听写/跟读', type: 'listen', count: 8, unit: '题',
           qtypes: [LISTEN_TYPES[di % 3]], ref: '烤鸭TV W' + w + '课程 · 真题精听', slot: '午', mins: longB ? 30 : 25, stage: stage, date: date });
      mk({ title: '阅读 1 篇 · 读懂为主', type: 'read', count: 1, unit: '篇',
           qtypes: [READ_TYPES[di % 3]], ref: '华研八合一 阅读分项 P' + (di % 12 + 1), slot: '晚', mins: longB ? 25 : 20, stage: stage, date: date });
      mk({ title: '语法仿写 3–5 句（先框架后套词）', type: 'write', count: 5, unit: '句',
           qtypes: ['写作框架'], ref: '刘晓燕/英语兔 仿写', slot: '晚', mins: 15, stage: stage, date: date });
      if (longB) {
        mk({ title: '翻译 2–3 短句（中式→地道）', type: 'translate', count: 3, unit: '句',
             qtypes: ['翻译句式'], ref: '邹老师翻译', slot: '晚', mins: 15, stage: stage, date: date });
        mk({ title: '当日复盘 · 错题入本', type: 'review', count: 1, unit: '次',
             qtypes: ['复盘'], ref: '今日错题', slot: '晚', mins: 10, stage: stage, date: date });
      }
    } else if (stage === 'special') {
      // 专项突破期：分题型各个击破，听读写译全加码
      vocabSeq++;
      mk({ title: '词汇复习 · 查漏为主', type: 'vocab', count: 40, unit: '词',
           newCount: 10, reviewCount: 30, ref: lessonRef() + ' 查漏 / 不背单词复习', slot: '晨', mins: 20, stage: stage, date: date });
      mk({ title: '听力分项 · 全题型轮练', type: 'listen', count: 20, unit: '题',
           qtypes: [LISTEN_TYPES[di % 3]], ref: '华研八合一 听力分项', slot: '午', mins: 30, stage: stage, date: date });
      mk({ title: '阅读分项 · 三题型轮练', type: 'read', count: 2, unit: '篇',
           qtypes: [READ_TYPES[di % 3]], ref: '华研八合一 阅读分项', slot: '晚', mins: 30, stage: stage, date: date });
      mk({ title: '写作 1 篇 · 套模板成文', type: 'write', count: 1, unit: '篇',
           qtypes: ['短文写作'], ref: '瑞斯拜模板 / 刘晓燕', slot: '晚', mins: 20, stage: stage, date: date });
      mk({ title: '翻译 1 段 · 汉译英', type: 'translate', count: 1, unit: '段',
           qtypes: ['汉译英段落'], ref: '邹老师翻译', slot: '晚', mins: 15, stage: stage, date: date });
      mk({ title: '当日复盘 · 错题入本', type: 'review', count: 1, unit: '次',
           qtypes: ['复盘'], ref: '今日错题', slot: '晚', mins: 15, stage: stage, date: date });
    } else {
      // 模考冲刺期：前 9 天 3 天一轮（模考/复盘/回炉），最后 3 天保温
      var off = d.diffDays(s.mock.start, date);
      var round = Math.floor(off / 3);
      var PAPER = ['华研八合一 2026-06', '真题 2025-12', '真题 2025-06'];
      if (off < 9) {
        var m = off % 3;
        if (m === 0) {
          mk({ title: '真题限时模考 · 全套（按 9:00–11:20 流程）', type: 'mock', count: 1, unit: '套',
               qtypes: ['写作', '翻译', '听力25题', '阅读30题'], ref: PAPER[round], slot: '上午(全真)', mins: 140, stage: stage, date: date });
        } else if (m === 1) {
          mk({ title: '模考复盘 · 听力逐句+阅读定位+写译对照', type: 'review', count: 1, unit: '次',
               qtypes: ['逐题解析'], ref: PAPER[round] + ' 解析', slot: '上午', mins: 60, stage: stage, date: date });
          mk({ title: '错题整理入复习本', type: 'review', count: 1, unit: '次',
               qtypes: ['错题'], ref: '本套错题', slot: '下午', mins: 30, stage: stage, date: date });
        } else {
          mk({ title: '错题回炉 · 只看不抠', type: 'review', count: 1, unit: '次',
               qtypes: ['错题'], ref: '本套错题', slot: '上午', mins: 40, stage: stage, date: date });
          mk({ title: '轻量保温 · 词汇听力各一轮', type: 'vocab', count: 30, unit: '词',
               newCount: 0, reviewCount: 30, ref: '不背单词复习', slot: '晚', mins: 30, stage: stage, date: date });
        }
      } else {
        mk({ title: '考前保温 · 错题回炉（停止新题新词）', type: 'review', count: 1, unit: '次',
             qtypes: ['错题'], ref: '错题本', slot: '上午', mins: 40, stage: stage, date: date });
        mk({ title: '考前保温 · 词汇听力轻量过', type: 'vocab', count: 30, unit: '词',
             newCount: 0, reviewCount: 30, ref: '不背单词复习', slot: '晚', mins: 30, stage: stage, date: date });
      }
    }
  }
  var firstDate = tasks.length ? tasks[0].planDate : null;
  var note = '已生成 ' + tasks.length + ' 个量化任务（含数量/题型/来源/时段/耗时）';
  if (firstDate && firstDate > today) {
    note += '；计划自 ' + firstDate + ' 起启动，' + today + ' – ' + d.addDays(firstDate, -1) + ' 不排任务';
  }
  return { tasks: tasks, note: note };
}

// 任务完成后的钩子：词汇任务 -> 生成 +2 天艾宾浩斯复习任务（防重复，且不超过考试日）
function afterComplete(task) {
  if (!task || task.type !== 'vocab') return;
  var p = store.getProfile();
  if (!p) return;
  var due = d.addDays(task.planDate, 2);
  if (d.diffDays(due, p.examDate) < 0) return; // 已贴近考试，不再排新复习
  var exists = store.getTasks().some(function (x) { return x.reviewOf === task.id; });
  if (exists) return;
  store.addTask({
    id: 'r' + task.id,
    title: '词汇复习 · 艾宾浩斯 +2 天',
    type: 'review',
    contentRef: task.contentRef || task.title,
    planDate: due,
    estMinutes: 15,
    status: 0,
    stage: task.stage,
    source: 'engine',
    reviewOf: task.id,
    createdAt: Date.now()
  });
}

// 顺延：任务挪到次日；但不允许越过"考试前一天"（考试当天不排任务）
function postpone(task) {
  if (!task) return;
  var next = d.addDays(task.planDate, 1);
  var p = store.getProfile();
  if (p && p.examDate) {
    var last = d.addDays(p.examDate, -1); // 考试前一天是最后一个可排任务日
    if (d.diffDays(last, next) > 0) next = last; // next 晚于 last -> 截断到 last
  }
  store.updateTask(task.id, { planDate: next });
}

// 一键绑定刘晓燕48课：把课程编号（U1L1–U12L4，纯编号指针，非词库内容）
// 按日期顺序绑到规划中的词汇任务上；返回 { bound, unbound } 供 UI 提示
// 续接语义：以"已绑最大课次"为锚点（含过渡期 U3-U4），按日期顺序续接，不回退到 U1，保留已有指针（幂等），循环覆盖全部词汇日
function bindLiuXiaoYanLessons() {
  var today = d.todayStr();
  var tasks = store.getTasks();

  // 续接锚点：取《10.8启动计划》（source='plan108'）已绑最大课次（W5 收尾于 U7L4=28）作为续接起点
  // 不取全部词汇最大课次——引擎课次会循环到 48，若用它作锚点，清空早期任务会回退到 U1
  var anchor = 0;
  tasks.forEach(function (t) {
    if (t.type !== 'vocab' || t.source !== 'plan108') return;
    var n = LESSON.fromRef(t.contentRef || '');
    if (n && n > anchor) anchor = n;
  });

  // 目标：今天起、引擎生成的词汇任务，按日期升序续接绑定
  var targets = tasks
    .filter(function (t) { return t.type === 'vocab' && t.source === 'engine' && t.planDate >= today; })
    .sort(function (a, b) {
      if (a.planDate < b.planDate) return -1;
      if (a.planDate > b.planDate) return 1;
      return 0;
    });

  var next = tasks.slice();
  var seq = anchor; // 从已绑最大课次续接
  targets.forEach(function (t) {
    var n = LESSON.fromRef(t.contentRef || '');
    if (n) {
      // 已有指针：同步续接点并保留（幂等，不重绑）
      seq = n;
      return;
    }
    // 缺口（如模考期"不背单词复习"任务）：从续接点继续，循环 1..48
    seq++;
    for (var i = 0; i < next.length; i++) {
      if (next[i].id === t.id) {
        next[i] = Object.assign({}, next[i], { contentRef: LESSON.toLabel(seq) });
        break;
      }
    }
  });
  store.saveTasks(next); // 一次性写入，减少存储抖动与云推送调度

  // bound = 已绑（engine）词汇任务数；unbound = 未被任何词汇任务占用的课次编号（续接后通常为空）
  var bound = next.filter(function (t) {
    return t.type === 'vocab' && t.source === 'engine' && /^刘晓燕48课/.test(t.contentRef || '');
  }).length;
  var used = {};
  next.forEach(function (t) {
    var n = LESSON.fromRef(t.contentRef || '');
    if (n) used[n] = 1;
  });
  var unbound = [];
  for (var n = 1; n <= 48; n++) {
    if (!used[n]) unbound.push(LESSON.toShortLabel(n));
  }
  return { bound: bound, unbound: unbound };
}

// 一键绑定烤鸭TV课程：按《细化计划表》把课程排期绑到听力任务的 contentRef
// W1=主课5课时 | W2=主课⑤+训练营DAY1-4 | W3=训练营DAY5-8+自主精听 | W4起=真题逐题解析 | 专项期=华研分项轮换
// 仅绑 source==='engine' 的听力任务；过渡期听力任务已自带精确 contentRef，自动保留
function bindKaoyaTVCourses() {
  var p = store.getProfile();
  if (!p) return { bound: 0 };
  var start = p.planStart || d.addDays(p.examDate, -75);

  var W1 = [
    '烤鸭TV 考试介绍+核心概念(上)',
    '烤鸭TV 核心概念(下)+边听边勾练习',
    '烤鸭TV 短篇新闻详解+新闻精听',
    '新闻精听·用视听一致+同转法',
    '新闻精听·错句回听',
    '烤鸭TV 长对话详解+长对话精听'
  ];
  var W2 = [
    '烤鸭TV 短文理解详解+短文精听',
    '烤鸭TV 八天训练营 DAY1',
    '烤鸭TV 八天训练营 DAY2',
    '烤鸭TV 八天训练营 DAY3',
    '烤鸭TV 八天训练营 DAY4',
    'DAY1–4 错题篇重听'
  ];
  var W3 = [
    '烤鸭TV 八天训练营 DAY5',
    '烤鸭TV 八天训练营 DAY6',
    '烤鸭TV 八天训练营 DAY7',
    '烤鸭TV 八天训练营 DAY8',
    '自主精听·短篇新闻（同转法）',
    '自主精听·长对话（听前预测）'
  ];
  var SPEC_CYCLE = [
    '华研八合一听力分项·短篇新闻',
    '华研八合一听力分项·长对话',
    '华研八合一听力分项·短文理解'
  ];

  var targets = store.getTasks()
    .filter(function (t) { return t.source === 'engine' && t.type === 'listen'; })
    .sort(function (a, b) {
      if (a.planDate < b.planDate) return -1;
      if (a.planDate > b.planDate) return 1;
      return 0;
    });

  // 先算好每个听力任务的课次指针，再一次性回写，避免逐任务全量存储写入
  var refMap = {};
  targets.forEach(function (t) {
    var w = Math.floor(d.diffDays(start, t.planDate) / 7) + 1;
    var wd = d.dayOfWeek(t.planDate); // 0=周日（非模考期无听力任务，防御性取索引）
    var ref;
    if (w === 1) ref = W1[Math.min(Math.max(wd - 1, 0), W1.length - 1)];
    else if (w === 2) ref = W2[Math.min(Math.max(wd - 1, 0), W2.length - 1)];
    else if (w === 3) ref = W3[Math.min(Math.max(wd - 1, 0), W3.length - 1)];
    else if (t.stage === 'special') ref = SPEC_CYCLE[(Math.max(wd - 1, 0)) % SPEC_CYCLE.length];
    else ref = '烤鸭TV 真题逐题解析 · 精听+错因复盘';
    refMap[t.id] = ref;
  });

  var next = store.getTasks().map(function (t) {
    return refMap[t.id] ? Object.assign({}, t, { contentRef: refMap[t.id] }) : t;
  });
  store.saveTasks(next); // 一次性写入
  return { bound: targets.length };
}

// 重新生成规划：清"规划生成"的任务 -> 生成 -> 批量写入 -> 更新 planStart
// 三个入口（我的 / 规划 / 向导）共用这一处，避免流程散落在页面各写一遍、改一次要动三处
function regeneratePlan(p) {
  if (!p) return null;
  store.removeEngineTasks();          // 手动添加的（source='manual'）保留
  var res = generatePlan(p);
  store.addTasks(res.tasks);          // 批量写入：169+ 任务只落盘一次
  store.saveProfile(Object.assign({}, p, { planStart: d.todayStr() }));
  return res;
}

module.exports = {
  TYPE_NAMES: TYPE_NAMES,
  TYPE_KEYS: TYPE_KEYS,
  STAGE_NAMES: STAGE_NAMES,
  stages: stages,
  stageOf: stageOf,
  weekHours: weekHours,
  dailyMinutes: dailyMinutes,
  generatePlan: generatePlan,
  afterComplete: afterComplete,
  postpone: postpone,
  bindLiuXiaoYanLessons: bindLiuXiaoYanLessons,
  bindKaoyaTVCourses: bindKaoyaTVCourses,
  regeneratePlan: regeneratePlan,
  stageSegments: stageSegments
};
