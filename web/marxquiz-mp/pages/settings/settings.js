/**
 * pages/settings/settings.js —— 设置
 * 外观 / 答题 / 数据 / 关于
 */
'use strict';

var store = require('../../utils/store.js');
var util = require('../../utils/util.js');
var theme = require('../../utils/theme.js');
var sync = require('../../utils/cloud-sync.js');

var VERSION = '1.0.0';

Page({
  data: {
    // 首帧就跟随已保存的主题偏好，避免深夜模式下闪白
    themeClass: theme.themeClass(),
    themeIcon: theme.themeIcon(),
    themeSetting: 'auto',

    autoNext: true,
    autoNextDelay: 800,
    delayDisabled: false,
    delayOptions: [
      { value: 400, label: '400ms' },
      { value: 800, label: '800ms' },
      { value: 1500, label: '1500ms' },
    ],

    bankCount: 0,
    questionCount: 0,
    usedText: '0 KB',
    limitText: '10 MB',
    lastBackupText: '尚未备份',

    // 账号与云备份
    nickname: '',
    cloudReady: false,
    lastSyncText: '尚未同步',
    hasSnapshot: false,
    snapshotText: '',

    version: VERSION,
  },

  onLoad: function () {
    // 页面模块可能在上次换肤前就已加载，实例化后立刻校正一次
    this.applyTheme();
    var self = this;
    this._unwatchTheme = theme.watchSystemTheme(function () {
      self.applyTheme();
    });
    try {
      var app = getApp();
      if (app && app.globalData && app.globalData.version) {
        this.setData({ version: app.globalData.version });
      }
    } catch (e) {
      // 忽略，使用默认版本号
    }
  },

  onShow: function () {
    this.applyTheme();
    this.loadSettings();
    this.refreshStats();
    this.refreshCloud();
    theme.syncTabBar(this, 2);
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
    theme.syncTabBar(this, 2);
  },

  /**
   * 读取设置。
   */
  loadSettings: function () {
    var s = store.getSettings();
    this.setData({
      autoNext: s.autoNext,
      autoNextDelay: s.autoNextDelay,
      delayDisabled: !s.autoNext,
    });
  },

  /**
   * 刷新统计信息。
   */
  refreshStats: function () {
    var summary = store.storageSummary();
    var meta = store.getMeta();
    this.setData({
      bankCount: summary.bankCount,
      questionCount: summary.questionCount,
      usedText: util.formatSize(summary.usedKB),
      limitText: summary.limitKB ? util.formatSize(summary.limitKB) : '10 MB',
      lastBackupText: meta.lastBackupAt ? util.formatDateTime(meta.lastBackupAt) : '尚未备份',
    });
  },

  /**
   * 刷新云备份状态。
   */
  refreshCloud: function () {
    var profile = store.getProfile();
    var st = sync.getStatus();
    var snap = store.snapshotInfo();
    this.setData({
      nickname: profile.nickname || '',
      cloudReady: !!st.ready,
      lastSyncText: st.lastSyncedAt ? util.formatDateTime(st.lastSyncedAt) : '尚未同步',
      hasSnapshot: !!snap,
      snapshotText: snap
        ? ('快照 ' + util.formatDateTime(snap.at) + '，' + snap.count + ' 项')
        : '',
    });
  },

  /**
   * 修改昵称。
   */
  onEditNickname: function () {
    wx.navigateTo({ url: '/pages/nickname/nickname' });
  },

  /**
   * 手动备份到云端。
   */
  onCloudBackup: function () {
    if (!this.data.cloudReady) {
      wx.showToast({ title: '云服务不可用，请检查网络', icon: 'none' });
      return;
    }
    var self = this;
    wx.showLoading({ title: '备份中', mask: true });
    sync.pushNow().then(function (res) {
      wx.hideLoading();
      if (res && res.ok) {
        self.refreshCloud();
        wx.showToast({
          title: '已备份 ' + (Number(res.written) || 0) + ' 项',
          icon: 'none',
        });
        return;
      }
      wx.showModal({
        title: '备份失败',
        content: (res && res.message) || '请检查网络后重试',
        showCancel: false,
      });
    });
  },

  /**
   * 从云端恢复（覆盖本地，覆盖前自动快照）。
   */
  onCloudRestore: function () {
    if (!this.data.cloudReady) {
      wx.showToast({ title: '云服务不可用，请检查网络', icon: 'none' });
      return;
    }
    var self = this;
    wx.showModal({
      title: '从云端恢复',
      content: '会用云端数据覆盖这台手机的本地数据。\n覆盖前会自动存一份本地快照，可回滚。确定继续吗？',
      confirmText: '恢复',
      success: function (r) {
        if (!r.confirm) return;
        wx.showLoading({ title: '恢复中', mask: true });
        sync.pull({ force: true }).then(function (res) {
          wx.hideLoading();
          if (res && res.ok) {
            self.refreshCloud();
            self.refreshStats();
            wx.showToast({
              title: res.restored ? '已恢复' : (res.message || '完成'),
              icon: 'none',
            });
            return;
          }
          wx.showModal({
            title: '恢复失败',
            content: (res && res.message) || '请检查网络后重试',
            showCancel: false,
          });
        });
      },
    });
  },

  /**
   * 回滚到上次被覆盖之前的本地快照。
   */
  onRollbackSnapshot: function () {
    var self = this;
    wx.showModal({
      title: '回滚本地数据',
      content: '把本地数据恢复到上次被云端覆盖之前的状态。确定继续吗？',
      confirmText: '回滚',
      confirmColor: theme.dangerColor(),
      success: function (r) {
        if (!r.confirm) return;
        var out = store.restoreLocalSnapshot();
        if (!out.ok) {
          wx.showToast({ title: out.message || '回滚失败', icon: 'none' });
          return;
        }
        self.refreshCloud();
        self.refreshStats();
        wx.showToast({ title: '已回滚', icon: 'success' });
      },
    });
  },

  /**
   * 连点版本号 5 次进入管理端（隐藏入口）。
   */
  onTapVersion: function () {
    this._versionTaps = (this._versionTaps || 0) + 1;
    if (this._versionTaps < 5) return;
    this._versionTaps = 0;
    wx.navigateTo({ url: '/pages/admin/admin' });
  },

  /**
   * 选择主题。
   * @param {Object} e
   */
  onChooseTheme: function (e) {
    var value = e.currentTarget.dataset.theme;
    if (!value) return;
    theme.setTheme(value);
    this.applyTheme();
    wx.showToast({
      title: value === 'light' ? '已切换白昼' : (value === 'dark' ? '已切换深夜' : '已跟随系统'),
      icon: 'none',
    });
  },

  /**
   * 开关：答对自动进入下一题。
   * @param {Object} e
   */
  onToggleAutoNext: function (e) {
    var checked = !!(e.detail && e.detail.value);
    var s = store.setSettings({ autoNext: checked });
    this.setData({
      autoNext: s.autoNext,
      autoNextDelay: s.autoNextDelay,
      delayDisabled: !s.autoNext,
    });
    wx.showToast({ title: checked ? '已开启自动跳题' : '已关闭自动跳题', icon: 'none' });
  },

  /**
   * 选择自动跳题延时。
   * @param {Object} e
   */
  onChooseDelay: function (e) {
    if (this.data.delayDisabled) {
      wx.showToast({ title: '请先开启自动跳题', icon: 'none' });
      return;
    }
    var value = Number(e.currentTarget.dataset.value);
    if (!value) return;
    var s = store.setSettings({ autoNextDelay: value });
    this.setData({ autoNextDelay: s.autoNextDelay });
    wx.showToast({ title: '延时已设为 ' + value + 'ms', icon: 'none' });
  },

  /**
   * 备份全部数据到剪贴板。
   */
  onBackup: function () {
    var res = store.exportAll();
    if (!res.ok) {
      wx.showModal({
        title: '备份失败',
        content: res.message || '生成备份失败，请重试',
        showCancel: false,
      });
      return;
    }
    var self = this;
    wx.setClipboardData({
      data: res.json,
      success: function () {
        store.setMeta({ lastBackupAt: Date.now() });
        self.refreshStats();
        wx.showModal({
          title: '备份已复制',
          content: '已复制 ' + res.bankCount + ' 个题库 / ' + res.questionCount + ' 道题。\n请粘贴到备忘录、聊天窗口或发给自己长期保存。',
          showCancel: false,
        });
      },
      fail: function () {
        wx.showModal({ title: '复制失败', content: '剪贴板不可用，请重试', showCancel: false });
      },
    });
  },

  /**
   * 从剪贴板恢复数据。
   */
  onRestore: function () {
    var self = this;
    wx.getClipboardData({
      success: function (res) {
        var text = res && res.data ? String(res.data) : '';
        if (!text.trim()) {
          wx.showToast({ title: '剪贴板是空的', icon: 'none' });
          return;
        }
        var check = store.validateBackup(text);
        if (!check.ok) {
          wx.showModal({
            title: '备份无效',
            content: check.message,
            showCancel: false,
          });
          return;
        }
        wx.showModal({
          title: '确认恢复',
          content: '备份中有 ' + check.bankCount + ' 个题库 / ' + check.questionCount + ' 道题。\n恢复会覆盖当前全部题库数据，当前数据将被清除，确定继续吗？',
          confirmText: '覆盖恢复',
          success: function (r) {
            if (!r.confirm) return;
            var out = store.importAll(text);
            if (!out.ok) {
              wx.showModal({ title: '恢复失败', content: out.message, showCancel: false });
              return;
            }
            self.refreshStats();
            wx.showModal({
              title: '恢复完成',
              content: '已恢复 ' + check.bankCount + ' 个题库。',
              showCancel: false,
            });
          },
        });
      },
      fail: function () {
        wx.showModal({ title: '读取失败', content: '无法读取剪贴板，请检查权限', showCancel: false });
      },
    });
  },

  /**
   * 清空所有数据（双重确认，需输入「删除」）。
   */
  onClearAll: function () {
    var self = this;
    wx.showModal({
      title: '清空所有数据',
      content: '将删除全部题库、练习进度、错题、收藏与统计。\n此操作不可恢复，建议先做一次备份。',
      confirmText: '继续',
      confirmColor: theme.dangerColor(),
      success: function (r1) {
        if (!r1.confirm) return;
        wx.showModal({
          title: '最后确认',
          editable: true,
          placeholderText: '请输入「删除」两个字',
          content: '',
          confirmText: '确认删除',
          confirmColor: theme.dangerColor(),
          success: function (r2) {
            if (!r2.confirm) return;
            if (String(r2.content || '').trim() !== '删除') {
              wx.showToast({ title: '输入不正确，已取消', icon: 'none' });
              return;
            }
            store.clearAllData();
            self.refreshStats();
            wx.showToast({ title: '已清空全部数据', icon: 'success' });
          },
        });
      },
    });
  },
});
