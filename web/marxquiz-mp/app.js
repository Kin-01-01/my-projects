/**
 * app.js —— 刷题小程序入口
 *
 * 数据策略：本地 storage 是唯一数据源，云开发只做备份/恢复。
 * 同步层的任何失败都静默降级，不影响刷题。
 */
var store = require('./utils/store.js');
var sync = require('./utils/cloud-sync.js');

App({
  globalData: {
    version: '1.2.0',
    /** 存储结构版本号，后续如需迁移可依据它做判断 */
    storageVersion: 1,
    /** 云同步是否可用 */
    cloudReady: false,
  },

  onLaunch() {
    // 首次启动写入内置题库（仅一次，已有题库时不覆盖）
    try {
      var seed = store.seedBuiltinOnce();
      this.globalData.seededBanks = seed.count;
    } catch (e) {
      this.globalData.seededBanks = 0;
    }

    // 轻量本地环境自检
    try {
      const info = wx.getStorageInfoSync();
      this.globalData.storageUsedKB = info && info.currentSize ? info.currentSize : 0;
    } catch (e) {
      this.globalData.storageUsedKB = 0;
    }

    // 云备份：初始化 + 首次拉取（失败静默，本地照常可用）
    this.globalData.cloudReady = sync.init();
    if (this.globalData.cloudReady) {
      sync.pull();
    }
  },

  onShow() {
    sync.onShow();
  },

  onHide() {
    // 切后台前强制把数据推到云端，避免「刚刷完题就杀进程」丢数据
    sync.onHide();
  },

  onError(err) {
    // 不抛出到控制台，仅静默记录，避免用户侧出现红色报错
    this.globalData.lastError = err && err.message ? err.message : String(err);
  },
});
