// 云同步（可选）：本地优先，写入后防抖镜像到云端 cet4_sync 集合的 'me' 文档
// 启用条件：config.CLOUD_ENV_ID 已填写，且在云开发控制台建好集合 cet4_sync（权限：仅创建者可读写）
// 策略：整快照 + updatedAt 时间戳，最后写入胜出；任何云异常都不影响本地使用
var config = require('../config');
var store = require('./store');

var _db = null;
var _debounce = null;
var _lastSyncedAt = 0; // 上次与云端对齐的时间戳（防推拉循环）
var _hooked = false;   // 防止重复挂 onChange（重复 init 时只挂一次）

function enabled() {
  return !!(config.CLOUD_ENV_ID && wx.cloud);
}

function init() {
  if (!enabled()) return false;
  try {
    wx.cloud.init({ env: config.CLOUD_ENV_ID, traceUser: true });
    _db = wx.cloud.database();
  } catch (e) {
    console.error('云开发初始化失败，降级为纯本地', e);
    return false;
  }
  // 任何本地写入 -> 防抖推送（重复调用 init 只挂一次）
  if (!_hooked) {
    store.onChange(function () { schedulePush(); });
    _hooked = true;
  }
  return true;
}

function schedulePush() {
  if (_debounce) clearTimeout(_debounce);
  _debounce = setTimeout(pushNow, 2000);
}

function snapshot() {
  return {
    profile: store.getProfile(),
    tasks: store.getTasks(),
    imports: store.getImports(),
    updatedAt: store.getMeta().updatedAt
  };
}

function pushNow() {
  if (!_db) return;
  var snap = snapshot();
  if (!snap.updatedAt || snap.updatedAt <= _lastSyncedAt) return;
  _db.collection('cet4_sync').doc('me').set({ data: snap })
    .then(function () {
      _lastSyncedAt = snap.updatedAt;
      console.log('云同步完成', snap.updatedAt);
    })
    .catch(function (e) {
      console.error('云同步失败（本地数据不受影响）', e);
    });
}

// 启动时拉取：云端比本地新则覆盖本地（多端/重装场景恢复数据）
function pullLatest() {
  if (!_db) return Promise.resolve(false);
  return _db.collection('cet4_sync').doc('me').get()
    .then(function (res) {
      var snap = res.data;
      if (snap && snap.updatedAt) {
        if (snap.updatedAt > store.getMeta().updatedAt) {
          store.restoreAll(snap);
          console.log('已从云端恢复数据', snap.updatedAt);
        }
        _lastSyncedAt = Math.max(_lastSyncedAt, snap.updatedAt);
        return true;
      }
      return false;
    })
    .catch(function (e) {
      console.log('云端暂无数据（首次使用属正常）', e);
      return false;
    });
}

module.exports = {
  enabled: enabled,
  init: init,
  pushNow: pushNow,
  pullLatest: pullLatest,
  snapshot: snapshot
};
