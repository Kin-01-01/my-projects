/**
 * pages/wrong/wrong.js —— 错题本 + 收藏
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

    tab: 'wrong', // wrong | fav
    groups: [],
    totalWrong: 0,
    totalFav: 0,
    itemCount: 0,
    ready: false,
  },

  onLoad: function () {
    // 页面模块可能在上次换肤前就已加载，实例化后立刻校正一次
    this.applyTheme();
    var self = this;
    this._unwatchTheme = theme.watchSystemTheme(function () {
      self.applyTheme();
    });
  },

  onShow: function () {
    this.applyTheme();
    this.refresh();
    theme.syncTabBar(this, 1);
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
    // 自定义 tabBar 在页面之外渲染，换肤时也要同步一次
    theme.syncTabBar(this, 1);
  },

  /**
   * 切换 Tab。
   * @param {Object} e
   */
  onTabChange: function (e) {
    var tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.tab) return;
    this.setData({ tab: tab });
    this.refresh();
  },

  /**
   * 重新构建分组数据。
   */
  refresh: function () {
    var banks = store.listBanks();
    var groups = [];
    var totalWrong = 0;
    var totalFav = 0;
    var isWrongTab = this.data.tab === 'wrong';

    for (var i = 0; i < banks.length; i++) {
      var bank = banks[i];
      var questions = store.getQuestions(bank.id) || [];
      var map = {};
      for (var j = 0; j < questions.length; j++) map[questions[j].id] = questions[j];

      var items = [];

      if (isWrongTab) {
        var wrongList = store.getWrong(bank.id);
        totalWrong += wrongList.length;
        for (var w = 0; w < wrongList.length; w++) {
          var qw = map[wrongList[w].questionId];
          if (!qw) continue;
          items.push({
            id: qw.id,
            bankId: bank.id,
            typeLabel: util.typeLabel(qw.type),
            stem: qw.stem,
            answerText: util.formatAnswer(qw),
            analysis: qw.analysis || '',
            wrongCount: Number(wrongList[w].count) || 1,
            expanded: false,
          });
        }
      } else {
        var favIds = store.getFav(bank.id);
        totalFav += favIds.length;
        for (var f = 0; f < favIds.length; f++) {
          var qf = map[favIds[f]];
          if (!qf) continue;
          items.push({
            id: qf.id,
            bankId: bank.id,
            typeLabel: util.typeLabel(qf.type),
            stem: qf.stem,
            answerText: util.formatAnswer(qf),
            analysis: qf.analysis || '',
            wrongCount: 0,
            expanded: false,
          });
        }
      }

      if (items.length) {
        groups.push({
          bankId: bank.id,
          bankName: bank.name,
          count: items.length,
          items: items,
        });
      }
    }

    this.setData({
      groups: groups,
      totalWrong: totalWrong,
      totalFav: totalFav,
      itemCount: isWrongTab ? totalWrong : totalFav,
      ready: true,
    });
  },

  /**
   * 展开 / 收起某道题。
   * @param {Object} e
   */
  onToggleItem: function (e) {
    var gi = Number(e.currentTarget.dataset.gi);
    var ii = Number(e.currentTarget.dataset.ii);
    var groups = this.data.groups;
    if (isNaN(gi) || isNaN(ii) || !groups[gi] || !groups[gi].items[ii]) return;

    var next = [];
    for (var i = 0; i < groups.length; i++) {
      var items = [];
      for (var j = 0; j < groups[i].items.length; j++) {
        var it = groups[i].items[j];
        items.push({
          id: it.id,
          bankId: it.bankId,
          typeLabel: it.typeLabel,
          stem: it.stem,
          answerText: it.answerText,
          analysis: it.analysis,
          wrongCount: it.wrongCount,
          expanded: (i === gi && j === ii) ? !it.expanded : it.expanded,
        });
      }
      next.push({
        bankId: groups[i].bankId,
        bankName: groups[i].bankName,
        count: groups[i].count,
        items: items,
      });
    }
    this.setData({ groups: next });
  },

  /**
   * 练习某个题库的错题。
   * @param {Object} e
   */
  onPractice: function (e) {
    var bankId = e.currentTarget.dataset.id;
    if (!bankId) return;
    wx.navigateTo({
      url: '/pages/practice/practice?bankId=' + bankId + '&mode=wrong',
    });
  },

  /**
   * 把题目移出错题本 / 收藏。
   * @param {Object} e
   */
  onRemove: function (e) {
    var bankId = e.currentTarget.dataset.bid;
    var qid = e.currentTarget.dataset.qid;
    if (!bankId || !qid) return;

    var self = this;
    var isWrongTab = this.data.tab === 'wrong';
    wx.showModal({
      title: isWrongTab ? '移出错题本' : '取消收藏',
      content: isWrongTab ? '确定把这道题移出错题本吗？' : '确定取消收藏这道题吗？',
      confirmText: '确定',
      success: function (res) {
        if (!res.confirm) return;
        if (isWrongTab) store.removeWrong(bankId, qid);
        else store.toggleFav(bankId, qid);
        self.refresh();
        wx.showToast({ title: isWrongTab ? '已移出' : '已取消收藏', icon: 'none' });
      },
    });
  },

  /**
   * 去导入题库。
   */
  onTapImport: function () {
    wx.navigateTo({ url: '/pages/import/import' });
  },

  /**
   * 返回首页。
   */
  onBackHome: function () {
    wx.switchTab({ url: '/pages/index/index' });
  },
});
