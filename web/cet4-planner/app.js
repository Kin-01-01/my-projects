// 四级备考规划师 · 入口
// 定位：私人备考规划师（打卡式），不是题库/词库 App。
// 铁律：本小程序不内置任何题目、试题、单词词库；所有学习内容由用户自行录入或导入。
var cloud = require('./utils/cloud');

App({
  onLaunch: function () {
    // 云同步（可选）：配置了 CLOUD_ENV_ID 才启用；先拉云端恢复数据，再挂自动推送
    if (cloud.enabled() && cloud.init()) {
      cloud.pullLatest().then(function () {
        // 拉取完成（可能覆盖本地存储）后，刷新当前可见页面，避免首屏沿用旧数据
        // 直到用户手动切 tab 才更新。pull 是异步网络请求，此时页面栈已就绪。
        var pages = getCurrentPages();
        for (var i = 0; i < pages.length; i++) {
          if (typeof pages[i].refresh === 'function') {
            try { pages[i].refresh(); } catch (e) { /* 忽略单页刷新异常 */ }
          }
        }
      }).catch(function () { /* 云端无数据或失败，本地不受影响 */ });
    }
  },
  globalData: {}
});
