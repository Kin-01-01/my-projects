// 规划页：阶段总览 + 本周概览 + 重新生成 + 计划模板分享
var store = require('../../utils/store');
var engine = require('../../utils/engine');
var d = require('../../utils/date');
var anim = require('../../utils/anim');
var plan108 = require('../../utils/plan108');
var canvasCard = require('../../utils/canvasCard');
var canvasExport = require('../../utils/canvasExport');

Page({
  data: {
    hasPlan: false,
    stageCards: [],
    weekRows: [],
    planNote: '',
    sharing: false,
    _enter: 'fx-in'
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
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
    var s = engine.stages(p.examDate);
    var today = d.todayStr();

    // 三个阶段的统计卡片
    var keys = ['basic', 'special', 'mock'];
    var stageCards = keys.map(function (k) {
      var list = tasks.filter(function (t) { return t.stage === k; });
      var done = list.filter(function (t) { return t.status === 1; }).length;
      var st = s[k];
      return {
        key: k,
        name: engine.STAGE_NAMES[k],
        range: (st.start ? st.start : '今天') + ' ~ ' + st.end,
        total: list.length,
        done: done,
        pct: list.length ? Math.round(done / list.length * 100) : 0
      };
    });

    // 本周概览：从今天起 7 天
    var weekRows = [];
    for (var i = 0; i < 7; i++) {
      var date = d.addDays(today, i);
      var list = tasks.filter(function (t) { return t.planDate === date; });
      weekRows.push({
        date: date,
        cn: d.todayCN(date),
        isToday: date === today,
        count: list.length,
        done: list.filter(function (t) { return t.status === 1; }).length
      });
    }

    this.setData({
      hasPlan: tasks.length > 0,
      stageCards: stageCards,
      weekRows: weekRows
    });
  },

  // 重新生成：只清"规划生成"的任务，手动添加的保留
  onRegenerate: function () {
    var p = store.getProfile();
    if (!p) {
      wx.showToast({ title: '请先保存考试信息', icon: 'none' });
      return;
    }
    var self = this;
    wx.showModal({
      title: '重新生成规划',
      content: '将清除当前"规划生成"的任务（手动添加的保留），按最新设置重排。继续？',
      success: function (r) {
        if (!r.confirm) return;
        var res = engine.regeneratePlan(p);
        // 用弹窗而非 toast：toast 放不下"计划自 10.8 起启动"这类关键信息
        wx.showModal({
          title: '已生成 ' + res.tasks.length + ' 个任务',
          content: res.note,
          showCancel: false
        });
        self.refresh();
      }
    });
  },

  goWizard: function () {
    wx.navigateTo({ url: '/pages/wizard/wizard' });
  },

  /* ---------- 计划模板分享 ---------- */
  onShareTemplate: function () {
    if (this.data.sharing) return;
    var data = canvasCard.buildPlanTemplateData(plan108);
    var W = 620, H = 820;
    var self = this;
    this.setData({ sharing: true });
    canvasExport.renderToTemp({
      canvasId: 'planCanvas', width: W, height: H,
      draw: function (ctx, w, h) { canvasCard.drawPlanTemplateCard(ctx, w, h, data); }
    }).then(function (path) {
      self.setData({ sharing: false });
      // 直接调起"分享到聊天"菜单，把模板卡片图发给同学（纯计划骨架，不含个人数据）
      wx.showShareImageMenu({
        path: path,
        fail: function (e) {
          var msg = (e && e.errMsg) ? String(e.errMsg) : '';
          if (!/cancel/i.test(msg)) wx.showToast({ title: '分享已取消', icon: 'none' });
        }
      });
    }).catch(function (err) {
      self.setData({ sharing: false });
      wx.showToast({ title: '生成失败：' + ((err && err.errMsg) || err), icon: 'none' });
    });
  },

  // 胶囊"转发"兜底：用户用系统分享时给一张卡片
  onShareAppMessage: function () {
    return {
      title: '四级 75 天备考计划模板（基础→专项→模考三阶段）',
      path: '/pages/wizard/wizard'
    };
  }
});
