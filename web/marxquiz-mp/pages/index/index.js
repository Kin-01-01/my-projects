/**
 * pages/index/index.js —— 首页：题库列表 + 模式入口
 */
'use strict';

var store = require('../../utils/store.js');
var util = require('../../utils/util.js');
var theme = require('../../utils/theme.js');
var sample = require('../../utils/sample.js');
var sync = require('../../utils/cloud-sync.js');

Page({
  data: {
    // 首帧就跟随已保存的主题偏好，避免深夜模式下闪白
    themeClass: theme.themeClass(),
    themeIcon: theme.themeIcon(),
    themeSetting: 'auto',
    banks: [],
    totalBanks: 0,
    totalQuestions: 0,
    totalAnswered: 0,
    overallAccuracy: 0,
    hasBanks: false,
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
    theme.syncTabBar(this, 0);
    this.ensureNickname();
  },

  /**
   * 云端恢复完成后刷新列表（同步层回调）。
   */
  onCloudSync: function () {
    this.refresh();
  },

  /**
   * 首次使用引导设置昵称。只提醒一次，用户可跳过。
   *
   * 注意：冷启动时 pull 是异步的，若本机还没和云端对齐过（可能是重装/换机），
   * 云端很可能存着昵称。此时立刻判断会先弹一次昵称页再被恢复，体验很差。
   * 因此未对齐时延后判断，等同步完成。
   */
  ensureNickname: function () {
    if (this._nicknameChecked) return;
    this._nicknameChecked = true;

    var self = this;
    var check = function () {
      var profile = store.getProfile();
      if (profile.nickname || profile.skipped) return;
      wx.navigateTo({ url: '/pages/nickname/nickname' });
    };

    var st = sync.getStatus();
    if (st.ready && !st.inited) {
      // 等待云端恢复完成再判断（3 秒足够一次 pull 往返）
      setTimeout(check, 3000);
      return;
    }
    check();
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
    theme.syncTabBar(this, 0);
  },

  /**
   * 快速在 白昼 / 深夜 之间切换。
   */
  onToggleTheme: function () {
    var resolved = theme.resolveTheme(theme.getTheme());
    theme.setTheme(resolved === 'dark' ? 'light' : 'dark');
    this.applyTheme();
    wx.showToast({
      title: resolved === 'dark' ? '已切换到白昼' : '已切换到深夜',
      icon: 'none',
    });
  },

  /**
   * 刷新题库列表。
   */
  refresh: function () {
    var list = store.listBanks();
    var banks = [];
    var totalQuestions = 0;
    var totalAnswered = 0;
    var totalCorrect = 0;

    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      var stat = store.getStat(b.id);
      var wrong = store.getWrong(b.id);
      var accuracy = stat.answered ? Math.round(stat.correct / stat.answered * 100) : 0;
      totalQuestions += Number(b.count) || 0;
      totalAnswered += stat.answered;
      totalCorrect += stat.correct;
      banks.push({
        id: b.id,
        name: b.name,
        count: Number(b.count) || 0,
        answered: stat.answered,
        correct: stat.correct,
        accuracy: accuracy,
        progress: (Number(b.count) || 0) ? Math.min(100, Math.round(stat.answered / b.count * 100)) : 0,
        wrongCount: wrong.length,
        lastPracticedText: b.lastPracticedAt ? util.relativeTime(b.lastPracticedAt) : '尚未练习',
      });
    }

    this.setData({
      banks: banks,
      totalBanks: banks.length,
      totalQuestions: totalQuestions,
      totalAnswered: totalAnswered,
      overallAccuracy: totalAnswered ? Math.round(totalCorrect / totalAnswered * 100) : 0,
      hasBanks: banks.length > 0,
      ready: true,
    });
  },

  /**
   * 点击题库卡片 → 选择练习模式。
   * @param {Object} e
   */
  onTapBank: function (e) {
    var bankId = e.currentTarget.dataset.id;
    var bank = null;
    for (var i = 0; i < this.data.banks.length; i++) {
      if (this.data.banks[i].id === bankId) {
        bank = this.data.banks[i];
        break;
      }
    }
    if (!bank) return;

    var items = [
      '顺序刷题',
      '随机刷题',
      bank.wrongCount > 0 ? ('只刷错题（' + bank.wrongCount + ' 题）') : '只刷错题（暂无错题）',
      '模拟考试（60 分钟）',
    ];
    var self = this;
    wx.showActionSheet({
      itemList: items,
      success: function (res) {
        var idx = res.tapIndex;
        if (idx === 2 && bank.wrongCount === 0) {
          wx.showToast({ title: '这个题库还没有错题', icon: 'none' });
          return;
        }
        var modeMap = ['order', 'random', 'wrong', 'exam'];
        self.goPractice(bankId, modeMap[idx]);
      },
      fail: function () {},
    });
  },

  /**
   * 跳转练习页。
   * @param {string} bankId
   * @param {string} mode
   */
  goPractice: function (bankId, mode) {
    wx.navigateTo({
      url: '/pages/practice/practice?bankId=' + bankId + '&mode=' + mode,
    });
  },

  /**
   * 卡片右上角「⋯」菜单。
   * @param {Object} e
   */
  onTapMore: function (e) {
    var bankId = e.currentTarget.dataset.id;
    var bank = null;
    for (var i = 0; i < this.data.banks.length; i++) {
      if (this.data.banks[i].id === bankId) {
        bank = this.data.banks[i];
        break;
      }
    }
    if (!bank) return;

    var self = this;
    wx.showActionSheet({
      itemList: ['重命名', '导出到剪贴板', '删除题库'],
      success: function (res) {
        if (res.tapIndex === 0) self.renameBank(bank);
        else if (res.tapIndex === 1) self.exportBank(bank);
        else if (res.tapIndex === 2) self.deleteBank(bank);
      },
      fail: function () {},
    });
  },

  /**
   * 重命名题库。
   * @param {Object} bank
   */
  renameBank: function (bank) {
    var self = this;
    wx.showModal({
      title: '重命名题库',
      editable: true,
      placeholderText: '请输入新的题库名称',
      content: bank.name,
      success: function (res) {
        if (!res.confirm) return;
        var name = String(res.content || '').trim();
        if (!name) {
          wx.showToast({ title: '名称不能为空', icon: 'none' });
          return;
        }
        store.renameBank(bank.id, name);
        self.refresh();
        wx.showToast({ title: '已重命名', icon: 'success' });
      },
    });
  },

  /**
   * 导出单题库到剪贴板。
   * @param {Object} bank
   */
  exportBank: function (bank) {
    var json = store.exportBankJSON(bank.id);
    if (!json) {
      wx.showModal({ title: '导出失败', content: '没有读取到这个题库的内容', showCancel: false });
      return;
    }
    wx.setClipboardData({
      data: json,
      success: function () {
        wx.showModal({
          title: '已复制到剪贴板',
          content: '题库「' + bank.name + '」的 JSON 已复制，可粘贴到备忘录或发给自己保存。',
          showCancel: false,
        });
      },
      fail: function () {
        wx.showModal({ title: '复制失败', content: '剪贴板不可用，请重试', showCancel: false });
      },
    });
  },

  /**
   * 删除题库（二次确认）。
   * @param {Object} bank
   */
  deleteBank: function (bank) {
    var self = this;
    wx.showModal({
      title: '删除题库',
      content: '确定删除「' + bank.name + '」吗？该题库的进度、错题、收藏都会一起删除，且无法恢复。',
      confirmText: '删除',
      confirmColor: theme.dangerColor(),
      success: function (res) {
        if (!res.confirm) return;
        store.removeBank(bank.id);
        self.refresh();
        wx.showToast({ title: '已删除', icon: 'success' });
      },
    });
  },

  /**
   * 加载内置示例题库。
   */
  onTapLoadBuiltin: function () {
    var self = this;
    wx.showLoading({ title: '正在载入…', mask: true });
    // 延迟一拍，让 loading 先渲染出来，避免大数据写入时界面无反馈
    setTimeout(function () {
      var r = store.seedBuiltin(true);
      wx.hideLoading();
      if (r.count > 0) {
        self.refresh();
        wx.showToast({ title: '已载入 ' + r.count + ' 个题库', icon: 'success' });
        return;
      }
      if (r.error) {
        wx.showModal({ title: '载入失败', content: r.error, showCancel: false });
        return;
      }
      self.refresh();
      wx.showToast({ title: '题库已存在，无需重复载入', icon: 'none' });
    }, 60);
  },

  onTapLoadSample: function () {
    var name = sample.name;
    var exists = false;
    var list = store.listBanks();
    for (var i = 0; i < list.length; i++) {
      if (list[i].name === name) {
        exists = true;
        break;
      }
    }
    if (exists) name = name + ' ' + util.formatShortDate(Date.now());

    var bank = store.saveBank(name, sample.questions);
    if (!bank) {
      wx.showModal({
        title: '加载失败',
        content: store.getLastError() || '保存失败，请重试',
        showCancel: false,
      });
      return;
    }
    this.refresh();
    wx.showToast({ title: '已加载 ' + bank.count + ' 题', icon: 'success' });
  },

  /**
   * 进入导入页。
   */
  onTapImport: function () {
    wx.navigateTo({ url: '/pages/import/import' });
  },

  /**
   * 进入错题本（tab 页，必须用 switchTab）。
   */
  onTapWrong: function () {
    wx.switchTab({ url: '/pages/wrong/wrong' });
  },

  /**
   * 进入设置页（tab 页，必须用 switchTab）。
   */
  onTapSettings: function () {
    wx.switchTab({ url: '/pages/settings/settings' });
  },
});
