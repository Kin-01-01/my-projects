// 首次向导：采集考试信息 -> 生成三段式日程骨架（空占位，不含任何内容）
var store = require('../../utils/store');
var engine = require('../../utils/engine');
var d = require('../../utils/date');
var config = require('../../config');
var anim = require('../../utils/anim');

var HOUR_OPTIONS = [6, 8, 10, 12, 14];
var TARGET_OPTIONS = [425, 450, 500, 550, 600];
var LEVEL_OPTIONS = ['零基础 / 很差', '一般', '还行'];

Page({
  data: {
    examDate: config.DEFAULT_EXAM_DATE,
    hoursIndex: 1,
    targetIndex: 2,
    levelIndex: 0,
    hourOptions: HOUR_OPTIONS,
    targetOptions: TARGET_OPTIONS,
    levelOptions: LEVEL_OPTIONS,
    isRegen: false,
    submitting: false
  },

  onLoad: function () {
    anim.applyPageEnter(this);
    var p = store.getProfile();
    if (p) {
      // 已有档案：视为重新生成入口
      this.setData({
        isRegen: true,
        examDate: p.examDate || config.DEFAULT_EXAM_DATE,
        hoursIndex: Math.max(0, HOUR_OPTIONS.indexOf(p.weeklyHours || 8)),
        targetIndex: Math.max(0, TARGET_OPTIONS.indexOf(p.targetScore || 500)),
        levelIndex: Math.max(0, LEVEL_OPTIONS.indexOf(p.level || '零基础 / 很差'))
      });
    }
  },

  onDateChange: function (e) { this.setData({ examDate: e.detail.value }); },
  onHoursChange: function (e) { this.setData({ hoursIndex: Number(e.detail.value) }); },
  onTargetChange: function (e) { this.setData({ targetIndex: Number(e.detail.value) }); },
  onLevelChange: function (e) { this.setData({ levelIndex: Number(e.detail.value) }); },

  onSubmit: function () {
    if (this.data.submitting) return;
    var examDate = this.data.examDate;
    if (!examDate || d.diffDays(d.todayStr(), examDate) <= 0) {
      wx.showToast({ title: '请选择晚于今天的考试日期', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });

    var profile = {
      examDate: examDate,
      weeklyHours: HOUR_OPTIONS[this.data.hoursIndex],
      targetScore: TARGET_OPTIONS[this.data.targetIndex],
      level: LEVEL_OPTIONS[this.data.levelIndex],
      planStart: d.todayStr(),
      createdAt: Date.now()
    };
    var res = engine.regeneratePlan(profile);

    wx.showToast({ title: '已生成 ' + res.tasks.length + ' 个任务', icon: 'none' });
    var self = this;
    setTimeout(function () {
      self.setData({ submitting: false });
      wx.switchTab({ url: '/pages/today/today' });
    }, 700);
  }
});
