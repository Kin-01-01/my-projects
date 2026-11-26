// 日历页：月历（任务打点 + 阶段底色）+ 全程时间轴 + 点日看任务
var store = require('../../utils/store');
var engine = require('../../utils/engine');
var d = require('../../utils/date');
var anim = require('../../utils/anim');

Page({
  data: {
    year: 0,
    month: 0,
    weekRows: [],
    selected: '',
    todayStr: '',
    dayTasks: [],
    stageBar: [],
    todayPct: 0,
    _enter: 'fx-in'
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    anim.applyPageEnter(this);
    var now = new Date();
    this.setData({ selected: d.todayStr(), todayStr: d.todayStr() });
    this.build(now.getFullYear(), now.getMonth() + 1);
    this.buildBar();
  },

  // 构建某年某月的日历格子
  build: function (y, m) {
    var tasks = store.getTasks();
    var p = store.getProfile();
    var s = p ? engine.stages(p.examDate) : null;

    var startWd = new Date(y, m - 1, 1).getDay(); // 1号是周几
    var days = new Date(y, m, 0).getDate();       // 当月天数
    var cells = [];
    var i;

    for (i = 0; i < startWd; i++) cells.push({ blank: true });

    for (i = 1; i <= days; i++) {
      var date = y + '-' + d.pad(m) + '-' + d.pad(i);
      var cnt = 0, done = 0, dayStage = '';
      for (var j = 0; j < tasks.length; j++) {
        if (tasks[j].planDate === date) {
          cnt++;
          if (tasks[j].status === 1) done++;
          if (!dayStage) dayStage = tasks[j].stage; // 当天任务阶段即当天阶段（与计划阶段切分一致）
        }
      }
      var stage = dayStage || (s ? engine.stageOf(date, s) : 'basic');
      cells.push({
        blank: false, date: date, dd: i, cnt: cnt, done: done,
        stage: stage,
        cls: stage === 'mock' ? 'c-mock' : (stage === 'special' ? 'c-special' : 'c-basic')
      });
    }

    // 按 7 个一行切
    var weekRows = [];
    for (i = 0; i < cells.length; i += 7) weekRows.push(cells.slice(i, i + 7));

    this.setData({ year: y, month: m, weekRows: weekRows });
    this.loadDay(this.data.selected);
  },

  // 全程时间轴：三段边界以"实际生成任务的阶段"为准，与日历日底色口径一致
  buildBar: function () {
    var p = store.getProfile();
    if (!p) { this.setData({ stageBar: [], todayPct: 0 }); return; }
    var tasks = store.getTasks();
    // 时间轴起点：默认用计划启动日；但若实际最早的任务日期更晚（如国庆后才启动），
    // 以"实际最早生成任务日期"为准，避免左侧出现空白段、todayPct 被稀释
    var start = p.planStart || d.addDays(p.examDate, -75);
    var genDates = tasks
      .filter(function (t) { return t.source !== 'manual' && t.planDate; })
      .map(function (t) { return t.planDate; })
      .sort();
    if (genDates.length && genDates[0] > start) start = genDates[0];
    var total = Math.max(1, d.diffDays(start, p.examDate));
    var today = d.todayStr();
    var segs = engine.stageSegments(tasks, start, total, p.examDate);
    var pct = d.diffDays(start, today);
    this.setData({
      stageBar: segs,
      todayPct: Math.min(100, Math.max(0, Math.round(pct / total * 100)))
    });
  },

  loadDay: function (date) {
    var tasks = store.getTasks().filter(function (t) { return t.planDate === date; })
      .map(function (t) {
        return Object.assign({}, t, { typeName: engine.TYPE_NAMES[t.type] || '任务' });
      });
    this.setData({ dayTasks: tasks });
  },

  onPrevMonth: function () {
    var y = this.data.year, m = this.data.month - 1;
    if (m < 1) { m = 12; y--; }
    this.build(y, m);
  },

  onNextMonth: function () {
    var y = this.data.year, m = this.data.month + 1;
    if (m > 12) { m = 1; y++; }
    this.build(y, m);
  },

  onTapDay: function (e) {
    var date = e.currentTarget.dataset.date;
    if (!date) return;
    this.setData({ selected: date });
    this.loadDay(date);
  }
});
