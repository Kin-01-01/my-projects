/**
 * pages/admin/admin.js —— 管理端数据总览（隐藏页）
 *
 * 入口：设置页「关于」里连点版本号 5 次。
 * 权限：云函数 adminStats 里的 openid 白名单，普通用户调用会返回无权限。
 */
'use strict';

var theme = require('../../utils/theme.js');
var sync = require('../../utils/cloud-sync.js');
var util = require('../../utils/util.js');

Page({
  data: {
    themeClass: theme.themeClass(),
    loading: true,
    error: '',
    totalUsers: 0,
    totalAnswered: 0,
    totalCorrect: 0,
    todayActive: 0,
    rateText: '0%',
    updatedText: '',
    users: [],
  },

  onLoad: function () {
    theme.bindPageTheme(this);
    this.load();
  },

  onShow: function () {
    theme.bindPageTheme(this);
  },

  /**
   * 拉取云端统计。
   */
  load: function () {
    var self = this;

    sync.fetchAdminStats().then(function (res) {
      if (!res || res.ok === false) {
        var msg = (res && res.msg) || '读取失败';
        if (res && res.yourOpenid) {
          msg += '\n\n你的 openid：\n' + res.yourOpenid +
            '\n\n把它加进 cloudfunctions/adminStats/index.js 的 ADMIN_OPENIDS 后重新部署即可。';
        }
        self.setData({ loading: false, error: msg });
        return;
      }

      var list = (res.users || []).map(function (u) {
        var answered = Number(u.answered) || 0;
        var correct = Number(u.correct) || 0;
        return {
          nickname: u.nickname || '未设置昵称',
          banks: Number(u.banks) || 0,
          answered: answered,
          correct: correct,
          rate: answered ? Math.round((correct / answered) * 100) : 0,
          activeText: u.lastActiveAt ? util.formatDateTime(u.lastActiveAt) : '—',
        };
      });

      var totalAnswered = Number(res.totalAnswered) || 0;
      var totalCorrect = Number(res.totalCorrect) || 0;

      self.setData({
        loading: false,
        error: '',
        totalUsers: Number(res.totalUsers) || 0,
        totalAnswered: totalAnswered,
        totalCorrect: totalCorrect,
        todayActive: Number(res.todayActive) || 0,
        rateText: totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) + '%' : '0%',
        updatedText: util.formatDateTime(res.updatedAt || Date.now()),
        users: list,
      });
    });
  },

  /**
   * 下拉刷新。
   */
  onPullDownRefresh: function () {
    var self = this;
    this.setData({ loading: true });
    this.load();
    setTimeout(function () {
      wx.stopPullDownRefresh();
      self.setData({ loading: false });
    }, 600);
  },
});
