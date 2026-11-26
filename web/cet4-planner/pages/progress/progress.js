// 进度页：连续打卡 + 累计统计 + 阶段进度 + 近14日走势 + 周报/月报导出
var store = require('../../utils/store');
var engine = require('../../utils/engine');
var d = require('../../utils/date');
var anim = require('../../utils/anim');
var canvasCard = require('../../utils/canvasCard');
var canvasExport = require('../../utils/canvasExport');

Page({
  data: {
    streak: 0,
    totalDone: 0,
    totalMinutes: 0,
    stageCards: [],
    stacked: [],
    stackOrder: ['basic', 'special', 'mock'],
    last14: [],
    exporting: false,
    _enter: 'fx-in'
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    anim.applyPageEnter(this);
    this.refresh();
  },

  refresh: function () {
    var p = store.getProfile();
    if (!p) {
      wx.redirectTo({ url: '/pages/wizard/wizard' });
      return;
    }
    var tasks = store.getTasks();
    var today = d.todayStr();

    // 连续打卡：从今天（或昨天）往回数"有完成任务"的连续天数
    var doneOn = function (date) {
      return tasks.some(function (t) { return t.planDate === date && t.status === 1; });
    };
    var streak = 0;
    var cur = today;
    if (!doneOn(cur)) cur = d.addDays(cur, -1); // 今天还没打卡不打断连续
    while (doneOn(cur)) {
      streak++;
      cur = d.addDays(cur, -1);
    }

    var doneTasks = tasks.filter(function (t) { return t.status === 1; });
    var totalMinutes = doneTasks.reduce(function (sum, t) { return sum + (t.estMinutes || 0); }, 0);

    // 阶段进度条
    var s = engine.stages(p.examDate);
    var stageCards = ['basic', 'special', 'mock'].map(function (k) {
      var list = tasks.filter(function (t) { return t.stage === k; });
      var done = list.filter(function (t) { return t.status === 1; }).length;
      return {
        key: k,
        name: engine.STAGE_NAMES[k],
        pct: list.length ? Math.round(done / list.length * 100) : 0,
        done: done, total: list.length
      };
    });

    // 近 14 日走势：每日完成任务的总分钟数
    var last14 = [];
    for (var i = 13; i >= 0; i--) {
      var date = d.addDays(today, -i);
      var mins = doneTasks
        .filter(function (t) { return t.planDate === date; })
        .reduce(function (sum, t) { return sum + (t.estMinutes || 0); }, 0);
      last14.push({
        date: date,
        label: date.slice(5).replace('-', '/'),
        mins: mins,
        h: Math.min(150, Math.round(mins * 150 / 180)) // 180min 封顶柱高
      });
    }

    // 卡片堆叠：三个阶段的进度卡叠成一副牌，点顶层切到下一张
    var order = this.data.stackOrder || ['basic', 'special', 'mock'];
    var map = {};
    stageCards.forEach(function (c) { map[c.key] = c; });
    var stacked = order.map(function (k, i) {
      return Object.assign({}, map[k], { depth: i });
    });

    this.setData({
      streak: streak,
      totalDone: doneTasks.length,
      totalMinutes: totalMinutes,
      stageCards: stageCards,
      stacked: stacked,
      last14: last14
    });
  },

  // 抽走顶层，露出下层（卡片堆叠交互）
  onPopStack: function () {
    var order = this.data.stackOrder || ['basic', 'special', 'mock'];
    order = order.slice(1).concat([order[0]]);
    var map = {};
    this.data.stageCards.forEach(function (c) { map[c.key] = c; });
    var stacked = order.map(function (k, i) {
      return Object.assign({}, map[k], { depth: i });
    });
    this.setData({ stackOrder: order, stacked: stacked });
  },

  /* ---------- 周报 / 月报导出 ---------- */
  onExportReport: function (e) {
    if (this.data.exporting) return;
    var range = (e.currentTarget.dataset.range === 'month') ? 'month' : 'week';
    var p = store.getProfile();
    if (!p) { wx.showToast({ title: '请先生成规划', icon: 'none' }); return; }
    var tasks = store.getTasks();
    var data = canvasCard.buildReportData(tasks, { range: range });
    var W = 620;
    var H = (range === 'month') ? 1240 : 860;
    var self = this;
    this.setData({ exporting: true });
    canvasExport.renderToTemp({
      canvasId: 'reportCanvas', width: W, height: H,
      draw: function (ctx, w, h) { canvasCard.drawReportCard(ctx, w, h, data); }
    }).then(function (path) {
      return canvasExport.saveToAlbum(path);
    }).then(function () {
      self.setData({ exporting: false });
      wx.showToast({ title: (range === 'month' ? '月报' : '周报') + '已存到相册', icon: 'none' });
    }).catch(function (err) {
      self.setData({ exporting: false });
      var msg = (err && err.errMsg) ? String(err.errMsg) : String(err);
      if (!/cancel|deny/i.test(msg)) {
        wx.showToast({ title: '导出失败：' + msg, icon: 'none' });
      }
    });
  }
});
