/**
 * utils/cloud-sync.js —— 云端备份同步层
 *
 * 定位：只是「备份/恢复」，不是实时双向同步。
 *   - 本地 storage 永远是唯一数据源，断网照常刷题；
 *   - 数据变更后 debounce 推送；切后台强制推送；
 *   - 启动/回前台时拉取，按时间戳判断谁新；
 *   - 云端覆盖本地前，store 会自动存快照，可一键回滚。
 *
 * 所有网络失败都静默降级，绝不让同步问题影响刷题。
 */
'use strict';

var store = require('./store.js');

/** 云开发环境（与团队项目同一 AppID，直接复用） */
var ENV = 'your-cloudbase-env';

/** 单次推送条数，与云函数 MAX_DOCS 对齐 */
var CHUNK = 40;

/** 写入后延迟推送，避免连续操作打出多次请求 */
var PUSH_DELAY = 2000;

var ready = false;
var initError = '';
var pulling = false;
var pushing = false;
var pendingPush = false;
var pushTimer = null;
var lastMessage = '';

/**
 * 调用云函数并返回 result。
 * @param {string} name
 * @param {Object} data
 * @return {Promise<Object>}
 */
function callFn(name, data) {
  return new Promise(function (resolve, reject) {
    wx.cloud.callFunction({
      name: name,
      data: data || {},
      success: function (res) {
        resolve(res && res.result ? res.result : res);
      },
      fail: function (err) {
        reject(err);
      },
    });
  });
}

/**
 * 同步完成后通知页面刷新（页面实现 onCloudSync 即可）。
 */
function notifyPages() {
  try {
    var pages = getCurrentPages() || [];
    for (var i = 0; i < pages.length; i++) {
      var p = pages[i];
      if (p && typeof p.onCloudSync === 'function') {
        try {
          p.onCloudSync();
        } catch (e) {
          // 单个页面刷新失败不影响其他页面
        }
      }
    }
  } catch (e) {
    // 忽略
  }
}

/**
 * 初始化云开发并注册数据变更监听。
 * 幂等，可重复调用。
 * @return {boolean}
 */
function init() {
  if (ready) return true;

  if (!wx.cloud) {
    initError = '当前微信版本不支持云开发，请升级微信';
    return false;
  }

  try {
    wx.cloud.init({ env: ENV, traceUser: false });
    ready = true;
    initError = '';
    // 业务数据一有变化就安排一次延迟推送
    store.setChangeListener(function () {
      schedulePush();
    });
    return true;
  } catch (e) {
    initError = (e && (e.message || e.errMsg)) || '云开发初始化失败';
    return false;
  }
}

/**
 * 安排一次延迟推送。
 */
function schedulePush() {
  if (!ready) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(function () {
    pushTimer = null;
    pushNow();
  }, PUSH_DELAY);
}

/**
 * 立即推送本地全量数据到云端。
 * @return {Promise<Object>}
 */
function pushNow() {
  if (!ready) {
    return Promise.resolve({ ok: false, message: initError || '云开发未就绪' });
  }
  if (pushing) {
    pendingPush = true;
    return Promise.resolve({ ok: false, message: '正在上传中' });
  }

  var snap = store.snapshotAll();
  var docs = [];
  var k;
  for (k in snap) {
    if (!Object.prototype.hasOwnProperty.call(snap, k)) continue;
    if (snap[k] === null || snap[k] === undefined) continue;
    docs.push({ k: k, v: snap[k], updatedAt: Date.now() });
  }

  if (!docs.length) {
    return Promise.resolve({ ok: true, written: 0 });
  }

  pushing = true;
  var pushStartedAt = Date.now();
  var summary = store.summaryForCloud();
  var written = 0;

  // 分片：避免单次云函数调用超时
  var chunks = [];
  for (var i = 0; i < docs.length; i += CHUNK) {
    chunks.push(docs.slice(i, i + CHUNK));
  }

  var chain = Promise.resolve();
  chunks.forEach(function (chunk) {
    chain = chain
      .then(function () {
        return callFn('syncData', {
          action: 'push',
          docs: chunk,
          summary: summary,
        });
      })
      .then(function (r) {
        if (r && r.written) written += Number(r.written) || 0;
        return r;
      });
  });

  return chain
    .then(function () {
      pushing = false;
      var now = Date.now();
      var meta = store.getSyncMeta();

      // 只有「推送期间没有新的写入」时才把本地时间对齐到推送时间。
      // 否则会把这段时间内新产生的数据误标为已同步 —— 那才是真正的丢数据。
      if (meta.lastLocalWrite <= pushStartedAt) {
        store.setSyncMeta({ lastLocalWrite: now, lastSyncedAt: now, inited: true });
      } else {
        store.setSyncMeta({ lastSyncedAt: now, inited: true });
      }

      store.setMeta({ lastBackupAt: now });
      lastMessage = '已备份到云端';
      if (pendingPush) {
        pendingPush = false;
        schedulePush();
      }
      return { ok: true, written: written };
    })
    .catch(function (e) {
      pushing = false;
      lastMessage = '网络不可用，稍后自动重试';
      if (pendingPush) {
        pendingPush = false;
        schedulePush();
      }
      return { ok: false, message: lastMessage };
    });
}

/**
 * 拉取云端数据。
 *
 * 判定规则（数据安全优先）：
 *   - 云端为空        → 把本地推上去（首次上云）
 *   - 云端比本地新    → 覆盖本地（覆盖前 store 自动快照）
 *   - 本地比云端新    → 推送本地
 *   - 一样新          → 什么也不做
 *
 * @param {{force?: boolean}} [opts]
 * @return {Promise<Object>}
 */
function pull(opts) {
  if (!ready) {
    return Promise.resolve({ ok: false, message: initError || '云开发未就绪' });
  }
  if (pulling) {
    return Promise.resolve({ ok: false, message: '正在同步中' });
  }

  var force = !!(opts && opts.force);
  pulling = true;

  return callFn('syncData', { action: 'pull' })
    .then(function (res) {
      pulling = false;

      if (!res || res.ok === false) {
        return { ok: false, message: (res && res.msg) || '拉取失败' };
      }

      // 云端有昵称而本地没有（换手机等场景）→ 自动补回，避免重复询问
      try {
        if (res.nickname && !store.getProfile().nickname) {
          store.setProfile({ nickname: String(res.nickname).slice(0, 12), skipped: false });
        }
      } catch (e) {
        // 昵称回填失败不影响数据同步
      }

      var remoteAt = Number(res.updatedAt) || 0;
      var meta = store.getSyncMeta();
      var localAt = Number(meta.lastLocalWrite) || 0;
      var inited = !!meta.inited;

      // 云端空：把本地推上去（pushNow 成功后会把 inited 置 true）
      if (!remoteAt) {
        return pushNow().then(function (r) {
          return r.ok
            ? { ok: true, message: '本地数据已备份到云端' }
            : { ok: false, message: r.message || '备份失败' };
        });
      }

      // 以下三种情况一律以云端为准：
      //   ① 本机从未与云端对齐过（新手机 / 清过小程序数据）
      //      —— 此时本地只有刚 seed 的内置题库，时间戳是最新的，
      //         若按时间戳比较会把它当成「本地更新」推上去，覆盖云端真实进度，属于致命丢数据；
      //   ② 云端确实更新；
      //   ③ 用户手动强制恢复。
      if (!inited || remoteAt > localAt || force) {
        var out = store.applyRemote(res.keys, remoteAt);
        if (out.ok) {
          store.setSyncMeta({ inited: true });
          lastMessage = '已从云端恢复';
          notifyPages();
          return { ok: true, restored: true, count: out.count, message: lastMessage };
        }
        return { ok: false, message: out.message || '恢复失败，本地数据未丢失' };
      }

      // 本地更新：推上去
      if (localAt > remoteAt) {
        return pushNow();
      }

      if (!inited) store.setSyncMeta({ inited: true });
      return { ok: true, message: '已是最新' };
    })
    .catch(function () {
      pulling = false;
      // 网络问题一律静默：本地数据不受影响
      return { ok: false, message: '网络不可用，已跳过云端同步' };
    });
}

/**
 * 把云调用的原始错误翻译成人能看懂的话。
 * 云函数没部署时微信只给 -501000 这类码，直接抛「网络不可用」会让人误判成手机网络问题。
 * @param {*} err
 * @return {string}
 */
function explainCloudError(err) {
  var raw = String((err && (err.errMsg || err.message || err.errCode)) || '');
  if (!raw) return '调用失败，请稍后重试';

  if (/-501000|FunctionName|function not found|FUNCTION_NOT_FOUND/i.test(raw)) {
    return '云函数还没部署：右键 cloudfunctions 目录上传并部署';
  }
  if (/env|environment|invalid.*env|ENV_NOT_EXIST/i.test(raw)) {
    return '云开发环境不可用：检查环境 ID 是否正确';
  }
  if (/not.*init|未开通|cloud.*未初始化|uninitialized/i.test(raw)) {
    return '云开发未开通或初始化失败';
  }
  if (/timeout|network|request:fail|ERR_CONNECTION/i.test(raw)) {
    return '网络不可用，请稍后重试';
  }
  return '调用失败：' + raw;
}

/**
 * 设置昵称（云端内容安全检测 + 落库）。
 * @param {string} nickname
 * @return {Promise<Object>}
 */
function setNickname(nickname) {
  if (!ready) {
    return Promise.resolve({
      ok: false,
      msg: initError || '云开发不可用，请确认已开通云开发',
    });
  }
  return callFn('setNickname', { nickname: nickname }).catch(function (err) {
    return { ok: false, msg: explainCloudError(err) };
  });
}

/**
 * 拉管理端统计。
 * @return {Promise<Object>}
 */
function fetchAdminStats() {
  if (!ready) {
    return Promise.resolve({ ok: false, msg: initError || '云开发未就绪' });
  }
  return callFn('adminStats', {}).catch(function () {
    return { ok: false, msg: '网络不可用，请稍后重试' };
  });
}

/**
 * 状态快照，供设置页展示。
 * @return {{ready: boolean, initError: string, lastSyncedAt: number, lastLocalWrite: number, message: string}}
 */
function getStatus() {
  var meta = store.getSyncMeta();
  return {
    ready: ready,
    initError: initError,
    lastSyncedAt: meta.lastSyncedAt,
    lastLocalWrite: meta.lastLocalWrite,
    // 是否已与云端对齐过：false 表示可能正在从云端恢复，界面判断要避开这段时间
    inited: meta.inited,
    message: lastMessage,
  };
}

/** 前台：静默拉取（60 秒节流，避免 onLaunch/onShow 连发两次） */
var lastShowPullAt = 0;
function onShow() {
  if (!ready) return;
  var now = Date.now();
  if (now - lastShowPullAt < 60000) return;
  lastShowPullAt = now;
  pull();
}

/** 后台：强制推送，确保数据落地 */
function onHide() {
  if (!ready) return;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  pushNow();
}

module.exports = {
  ENV: ENV,
  init: init,
  pull: pull,
  pushNow: pushNow,
  schedulePush: schedulePush,
  setNickname: setNickname,
  fetchAdminStats: fetchAdminStats,
  getStatus: getStatus,
  onShow: onShow,
  onHide: onHide,
};
