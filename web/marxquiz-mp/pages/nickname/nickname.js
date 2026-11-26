/**
 * pages/nickname/nickname.js —— 设置昵称
 *
 * 微信自 2022 年起不再允许静默获取昵称/头像，只能用 input type="nickname"
 * 让用户主动填写（键盘会提供「使用微信昵称」快捷填充）。
 * 昵称要过云端内容安全检测，因此必须联网保存。
 */
'use strict';

var store = require('../../utils/store.js');
var theme = require('../../utils/theme.js');
var sync = require('../../utils/cloud-sync.js');

var MAX_LEN = 12;

Page({
  data: {
    themeClass: theme.themeClass(),
    nickname: '',
    saving: false,
    error: '',
    // 首次进入（从未设置也没跳过）时展示更完整的引导文案
    firstTime: false,
  },

  onLoad: function () {
    theme.bindPageTheme(this);
    var profile = store.getProfile();
    this.setData({
      nickname: profile.nickname || '',
      firstTime: !profile.nickname && !profile.skipped,
    });
  },

  onShow: function () {
    theme.bindPageTheme(this);
  },

  /**
   * 输入昵称。
   * @param {Object} e
   */
  onInput: function (e) {
    this.setData({
      nickname: String((e.detail && e.detail.value) || ''),
      error: '',
    });
  },

  /**
   * 保存昵称：先过云端内容安全，再落库 + 写本地档案。
   */
  onSave: function () {
    if (this.data.saving) return;

    var self = this;
    var name = String(this.data.nickname || '').trim();

    if (!name) {
      this.setData({ error: '先起个名字吧' });
      return;
    }
    if (name.length > MAX_LEN) {
      this.setData({ error: '最多 ' + MAX_LEN + ' 个字' });
      return;
    }
    if (!/[\u4e00-\u9fa5A-Za-z0-9_]/.test(name)) {
      this.setData({ error: '需要包含中文、字母或数字' });
      return;
    }

    this.setData({ saving: true, error: '' });

    sync.setNickname(name).then(function (res) {
      if (!res || res.ok === false) {
        self.setData({
          saving: false,
          error: (res && res.msg) || '保存失败，请重试',
        });
        return;
      }

      var saved = (res && res.nickname) || name;
      store.setProfile({ nickname: saved, skipped: false });
      self.setData({ saving: false, nickname: saved });

      wx.showToast({ title: '已保存', icon: 'success' });
      setTimeout(function () {
        self.goBack();
      }, 600);
    });
  },

  /**
   * 以后再说：记下已跳过，下次不再主动跳转到本页。
   */
  onSkip: function () {
    store.setProfile({ skipped: true });
    this.goBack();
  },

  /**
   * 返回上一页；没有上一页时回首页。
   */
  goBack: function () {
    var pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.switchTab({ url: '/pages/index/index' });
  },
});
