/**
 * pages/result/result.js —— 练习结果页
 */
'use strict';

var store = require('../../utils/store.js');
var util = require('../../utils/util.js');
var theme = require('../../utils/theme.js');

Page({
  data: {
    // 首帧就跟随已保存的主题偏好，避免深夜模式下闪白
    themeClass: theme.themeClass(),
    themeIcon: theme.themeIcon(),
    themeSetting: 'auto',

    ready: false,
    bankId: '',
    bankName: '',
    modeLabel: '',
    isExam: false,

    total: 0,
    correctCount: 0,
    wrongCount: 0,
    unanswered: 0,
    accuracy: 0,
    durationText: '00:00',
    submittedText: '',

    wrongItems: [],
    hasWrong: false,
    emptyTip: '',
  },

  onLoad: function () {
    // 页面模块可能在上次换肤前就已加载，实例化后立刻校正一次
    this.applyTheme();
    var self = this;
    this._unwatchTheme = theme.watchSystemTheme(function () {
      self.applyTheme();
    });

    var r = store.getLastResult();
    if (!r) {
      this.setData({ ready: true, emptyTip: '没有找到本次练习记录，请重新开始一次练习' });
      return;
    }

    var accuracy = r.total ? Math.round(r.correctCount / r.total * 100) : 0;
    var items = Array.isArray(r.items) ? r.items : [];
    var wrongItems = [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].isCorrect) continue;
      wrongItems.push({
        id: items[i].id,
        typeLabel: items[i].typeLabel,
        stem: items[i].stem,
        userAnswerText: items[i].userAnswerText,
        correctAnswerText: items[i].correctAnswerText,
        analysis: items[i].analysis,
        expanded: false,
      });
    }

    this.setData({
      ready: true,
      bankId: r.bankId || '',
      bankName: r.bankName || '',
      modeLabel: r.modeLabel || '',
      isExam: r.isExam === true,
      total: r.total || 0,
      correctCount: r.correctCount || 0,
      wrongCount: r.wrongCount || 0,
      unanswered: r.unanswered || 0,
      accuracy: accuracy,
      durationText: util.formatClock(r.durationSec),
      submittedText: util.formatDateTime(r.submittedAt),
      wrongItems: wrongItems,
      hasWrong: wrongItems.length > 0,
      emptyTip: '',
    });
  },

  onShow: function () {
    this.applyTheme();
  },

  onUnload: function () {
    if (this._unwatchTheme) {
      this._unwatchTheme();
      this._unwatchTheme = null;
    }
  },

  /**
   * 应用当前主题。
   */
  applyTheme: function () {
    theme.bindPageTheme(this);
  },

  /**
   * 展开 / 收起某道错题的解析。
   * @param {Object} e
   */
  onToggleItem: function (e) {
    var index = Number(e.currentTarget.dataset.index);
    if (isNaN(index) || index < 0 || index >= this.data.wrongItems.length) return;
    var items = this.data.wrongItems.slice();
    items[index] = {
      id: items[index].id,
      typeLabel: items[index].typeLabel,
      stem: items[index].stem,
      userAnswerText: items[index].userAnswerText,
      correctAnswerText: items[index].correctAnswerText,
      analysis: items[index].analysis,
      expanded: !items[index].expanded,
    };
    this.setData({ wrongItems: items });
  },

  /**
   * 再练一次（全部）。
   */
  onPracticeAll: function () {
    if (!this.data.bankId) {
      wx.switchTab({ url: '/pages/index/index' });
      return;
    }
    var mode = this.data.isExam ? 'exam' : 'order';
    wx.redirectTo({
      url: '/pages/practice/practice?bankId=' + this.data.bankId + '&mode=' + mode,
    });
  },

  /**
   * 只练错题。
   */
  onPracticeWrong: function () {
    if (!this.data.bankId) return;
    wx.redirectTo({
      url: '/pages/practice/practice?bankId=' + this.data.bankId + '&mode=wrong',
    });
  },

  /**
   * 返回首页。
   */
  onBackHome: function () {
    wx.switchTab({ url: '/pages/index/index' });
  },
});
