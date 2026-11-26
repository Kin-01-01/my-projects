/**
 * utils/store.js
 * 唯一本地存储入口。页面中不得直接调用 wx.setStorageSync。
 *
 * key 约定：
 *   qb:list             -> [{ id, name, count, createdAt, lastPracticedAt }]
 *   qb:data:<bankId>    -> 题目数组
 *   qb:progress:<bankId>-> { mode, order:[题id], index, answers:{题id:答案}, startedAt }
 *   qb:wrong:<bankId>   -> [{ questionId, count, lastWrongAt }]
 *   qb:fav:<bankId>     -> [题id]
 *   qb:stat:<bankId>    -> { answered, correct }
 *   qb:lastResult       -> 最近一次练习结果（结果页读取，用完不强制清除）
 *   app:settings        -> { autoNext, autoNextDelay }
 *   app:meta            -> { version, lastBackupAt }
 *   app:seeded          -> 1 表示内置题库已写入过，删除后不再自动恢复
 */

'use strict';

var parser = require('./parser.js');
var util = require('./util.js');

var K = {
  list: 'qb:list',
  lastResult: 'qb:lastResult',
  settings: 'app:settings',
  meta: 'app:meta',
  themePref: 'app:theme',
  seeded: 'app:seeded',
  data: function (id) { return 'qb:data:' + id; },
  progress: function (id) { return 'qb:progress:' + id; },
  wrong: function (id) { return 'qb:wrong:' + id; },
  fav: function (id) { return 'qb:fav:' + id; },
  stat: function (id) { return 'qb:stat:' + id; },
};

/** 恢复备份前的写入探测用的哨兵 key（写入后立即删除，不参与任何业务） */
var PROBE_KEY = 'qb:__probe__';

/** 题库 id 单调递增序号，保证同一毫秒内连续创建也不会撞 id */
var bankSeq = 0;

var DEFAULT_SETTINGS = { autoNext: true, autoNextDelay: 800 };

/** 最近一次写入错误信息 */
var lastError = '';

/** 数据变更监听（由 cloud-sync 注册），仅对业务 key 触发 */
var changeListener = null;

/** 静默写入标记：同步层覆盖本地数据时不触发监听，避免「拉取→写入→再推送」回环 */
var mutedWrite = false;

/** 同步元信息 key：记录本地最后写入时间 / 最后同步时间（不属于 qb: 业务数据） */
var SYNC_META_KEY = 'app:syncmeta';

/** 自动快照 key：云端覆盖本地前保存，可一键回滚。qb:__ 前缀不参与同步 */
var SNAPSHOT_KEY = 'qb:__snapshot_auto__';

/** 用户档案 key：昵称等，不参与题库数据同步 */
var PROFILE_KEY = 'app:profile';

/**
 * 是否为参与云端同步的业务 key。
 * qb:__ 前缀是内部 key（快照/探测），必须排除。
 * @param {string} key
 * @return {boolean}
 */
function isBizKey(key) {
  var k = String(key === undefined || key === null ? '' : key);
  return k.indexOf('qb:') === 0 && k.indexOf('qb:__') !== 0;
}

/**
 * 记录本地写入时间，供同步层判断本地/云端谁更新。
 */
function touchLocalWrite() {
  if (mutedWrite) return;
  try {
    var m = wx.getStorageSync(SYNC_META_KEY);
    wx.setStorageSync(SYNC_META_KEY, {
      lastLocalWrite: Date.now(),
      lastSyncedAt: (m && Number(m.lastSyncedAt)) || 0,
      // 必须原样保留：丢了 inited 会被误判成「新设备首次对齐」
      inited: !!(m && m.inited),
    });
  } catch (e) {
    // 元信息写失败不影响业务数据
  }
}

/**
 * 业务数据变化时通知监听者。
 * @param {string} key
 */
function notifyChange(key) {
  if (mutedWrite) return;
  if (!isBizKey(key)) return;
  touchLocalWrite();
  if (changeListener) {
    try {
      changeListener(key);
    } catch (e) {
      // 监听者异常不能影响主流程
    }
  }
}

/**
 * 记录错误。
 * @param {string} msg
 */
function setError(msg) {
  lastError = msg || '';
}

/**
 * 读取并清空最近一次错误。
 * @return {string}
 */
function takeError() {
  var e = lastError;
  lastError = '';
  return e;
}

/**
 * 读取最近一次错误（不清空）。
 * @return {string}
 */
function getLastError() {
  return lastError;
}

/**
 * 安全读取。
 * @param {string} key
 * @param {*} fallback
 * @return {*}
 */
function read(key, fallback) {
  try {
    var v = wx.getStorageSync(key);
    if (v === '' || v === undefined || v === null) return fallback;
    return v;
  } catch (e) {
    return fallback;
  }
}

/**
 * 安全写入。
 * @param {string} key
 * @param {*} value
 * @return {boolean}
 */
function write(key, value) {
  try {
    wx.setStorageSync(key, value);
    setError('');
    notifyChange(key);
    return true;
  } catch (e) {
    var msg = String((e && (e.errMsg || e.message)) || e || '');
    if (/exceed|size|quota|full|满|超/i.test(msg)) {
      setError('存储空间不足，建议删除部分题库或清理错题');
    } else {
      setError('保存失败，请重试');
    }
    return false;
  }
}

/**
 * 安全删除。
 * @param {string} key
 * @return {boolean}
 */
function drop(key) {
  try {
    wx.removeStorageSync(key);
    return true;
  } catch (e) {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* 题库                                                                */
/* ------------------------------------------------------------------ */

/**
 * 读取题库元信息列表（新的在前）。
 * @return {Array<Object>}
 */
function listBanks() {
  var list = read(K.list, []);
  return Array.isArray(list) ? list : [];
}

/**
 * 读取单个题库元信息。
 * @param {string} bankId
 * @return {Object|null}
 */
function getBank(bankId) {
  var list = listBanks();
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === bankId) return list[i];
  }
  return null;
}

/**
 * 补齐题目 id，并规整字段。
 * @param {Array<Object>} questions
 * @return {Array<Object>}
 */
function ensureIds(questions) {
  var used = {};
  var out = [];
  var list = Array.isArray(questions) ? questions : [];
  for (var i = 0; i < list.length; i++) {
    var q = list[i];
    if (!q || typeof q !== 'object' || !q.stem) continue;
    var id = q.id;
    if (!id || used[id]) id = 'q_' + (i + 1) + '_' + parser.hashText(q.stem);
    var finalId = id;
    var n = 1;
    while (used[finalId]) {
      finalId = id + '_' + n;
      n += 1;
    }
    used[finalId] = true;
    out.push({
      id: finalId,
      type: q.type || 'single',
      stem: String(q.stem),
      options: Array.isArray(q.options) ? q.options : [],
      answer: q.answer,
      analysis: q.analysis ? String(q.analysis) : '',
      tags: Array.isArray(q.tags) ? q.tags : [],
    });
  }
  return out;
}

/**
 * 生成一个新的题库 id。
 *
 * 仅用 Date.now() 会在「同一毫秒内连续创建」时撞 id（实测连续 3 次会重复），
 * 撞了就会两个题库共用同一个 qb:data:<id>，互相覆盖甚至一起被删。
 * 因此追加一个单调递增序号，并由调用方再对现有 id 去重。
 * @return {string}
 */
function newBankId() {
  bankSeq += 1;
  return 'b_' + Date.now().toString(36) + bankSeq.toString(36);
}

/**
 * 新建题库。
 * @param {string} name
 * @param {Array<Object>} questions
 * @return {Object|null} 成功返回题库元信息
 */
function saveBank(name, questions) {
  var list = listBanks();
  var existing = {};
  for (var e = 0; e < list.length; e++) existing[list[e].id] = true;

  var bankId = newBankId();
  var guard = 0;
  while (existing[bankId] && guard < 1000) {
    bankId = newBankId();
    guard += 1;
  }

  var qs = ensureIds(questions);
  var bank = {
    id: bankId,
    name: String(name === undefined || name === null ? '' : name).trim() ||
      ('题库 ' + util.formatShortDate(Date.now())),
    count: qs.length,
    createdAt: Date.now(),
    lastPracticedAt: 0,
  };

  if (!write(K.data(bankId), qs)) return null;
  list.unshift(bank);
  if (!write(K.list, list)) {
    drop(K.data(bankId));
    return null;
  }
  return bank;
}

/**
 * 重命名题库。
 * @param {string} bankId
 * @param {string} name
 * @return {boolean}
 */
function renameBank(bankId, name) {
  var list = listBanks();
  var newName = String(name === undefined || name === null ? '' : name).trim();
  if (!newName) return false;
  var found = false;
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === bankId) {
      list[i].name = newName;
      found = true;
      break;
    }
  }
  if (!found) return false;
  return write(K.list, list);
}

/**
 * 删除题库（连带数据、进度、错题、收藏、统计）。
 * @param {string} bankId
 * @return {boolean}
 */
function removeBank(bankId) {
  var list = listBanks();
  var next = [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].id !== bankId) next.push(list[i]);
  }
  drop(K.data(bankId));
  drop(K.progress(bankId));
  drop(K.wrong(bankId));
  drop(K.fav(bankId));
  drop(K.stat(bankId));
  return write(K.list, next);
}

/**
 * 读取题库题目数组。
 * @param {string} bankId
 * @return {Array<Object>}
 */
function getQuestions(bankId) {
  var qs = read(K.data(bankId), []);
  return Array.isArray(qs) ? qs : [];
}

/**
 * 更新题库练习时间。
 * @param {string} bankId
 * @return {boolean}
 */
function markPracticed(bankId) {
  var list = listBanks();
  var found = false;
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === bankId) {
      list[i].lastPracticedAt = Date.now();
      found = true;
      break;
    }
  }
  if (!found) return false;
  return write(K.list, list);
}

/* ------------------------------------------------------------------ */
/* 进度                                                                */
/* ------------------------------------------------------------------ */

/**
 * 保存练习进度。
 * @param {string} bankId
 * @param {Object} progress
 * @return {boolean}
 */
function saveProgress(bankId, progress) {
  if (!bankId || !progress) return false;
  return write(K.progress(bankId), progress);
}

/**
 * 读取练习进度。
 * @param {string} bankId
 * @return {Object|null}
 */
function getProgress(bankId) {
  var p = read(K.progress(bankId), null);
  if (!p || typeof p !== 'object') return null;
  if (!Array.isArray(p.order)) return null;
  return p;
}

/**
 * 清除练习进度。
 * @param {string} bankId
 * @return {boolean}
 */
function clearProgress(bankId) {
  return drop(K.progress(bankId));
}

/* ------------------------------------------------------------------ */
/* 错题                                                                */
/* ------------------------------------------------------------------ */

/**
 * 读取错题列表（最近错的在前）。
 * @param {string} bankId
 * @return {Array<Object>}
 */
function getWrong(bankId) {
  var list = read(K.wrong(bankId), []);
  if (!Array.isArray(list)) return [];
  return list.slice().sort(function (a, b) {
    return (b.lastWrongAt || 0) - (a.lastWrongAt || 0);
  });
}

/**
 * 记录一道错题（已存在则次数 +1）。
 * @param {string} bankId
 * @param {string} questionId
 * @return {boolean}
 */
function addWrong(bankId, questionId) {
  if (!bankId || !questionId) return false;
  var list = read(K.wrong(bankId), []);
  if (!Array.isArray(list)) list = [];
  var found = false;
  for (var i = 0; i < list.length; i++) {
    if (list[i].questionId === questionId) {
      list[i].count = (list[i].count || 1) + 1;
      list[i].lastWrongAt = Date.now();
      found = true;
      break;
    }
  }
  if (!found) {
    list.push({ questionId: questionId, count: 1, lastWrongAt: Date.now() });
  }
  return write(K.wrong(bankId), list);
}

/**
 * 移出错题本。
 * @param {string} bankId
 * @param {string} questionId
 * @return {boolean}
 */
function removeWrong(bankId, questionId) {
  var list = read(K.wrong(bankId), []);
  if (!Array.isArray(list)) return true;
  var next = [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].questionId !== questionId) next.push(list[i]);
  }
  return write(K.wrong(bankId), next);
}

/* ------------------------------------------------------------------ */
/* 收藏                                                                */
/* ------------------------------------------------------------------ */

/**
 * 读取收藏的题目 id 列表。
 * @param {string} bankId
 * @return {Array<string>}
 */
function getFav(bankId) {
  var list = read(K.fav(bankId), []);
  return Array.isArray(list) ? list : [];
}

/**
 * 切换收藏状态。
 * @param {string} bankId
 * @param {string} questionId
 * @return {boolean} 切换后是否为收藏
 */
function toggleFav(bankId, questionId) {
  var list = getFav(bankId);
  var pos = list.indexOf(questionId);
  var isFav;
  if (pos >= 0) {
    list.splice(pos, 1);
    isFav = false;
  } else {
    list.push(questionId);
    isFav = true;
  }
  write(K.fav(bankId), list);
  return isFav;
}

/* ------------------------------------------------------------------ */
/* 统计                                                                */
/* ------------------------------------------------------------------ */

/**
 * 读取答题统计。
 * @param {string} bankId
 * @return {{answered: number, correct: number}}
 */
function getStat(bankId) {
  var s = read(K.stat(bankId), null);
  if (!s || typeof s !== 'object') return { answered: 0, correct: 0 };
  return {
    answered: Number(s.answered) || 0,
    correct: Number(s.correct) || 0,
  };
}

/**
 * 累加答题统计。
 * @param {string} bankId
 * @param {boolean} isCorrect
 * @return {boolean}
 */
function bumpStat(bankId, isCorrect) {
  var s = getStat(bankId);
  s.answered += 1;
  if (isCorrect) s.correct += 1;
  return write(K.stat(bankId), s);
}

/* ------------------------------------------------------------------ */
/* 导入导出                                                            */
/* ------------------------------------------------------------------ */

/**
 * 导出单个题库为 JSON 字符串。
 * @param {string} bankId
 * @return {string} 失败返回空字符串
 */
function exportBankJSON(bankId) {
  var bank = getBank(bankId);
  if (!bank) return '';
  var payload = {
    name: bank.name,
    questions: getQuestions(bankId),
  };
  try {
    return JSON.stringify(payload, null, 2);
  } catch (e) {
    return '';
  }
}

/**
 * 从 JSON 文本导入题库。
 * @param {string} text
 * @return {{ok: boolean, bankId: string, name: string, count: number, errors: Array<string>}}
 */
function importBankJSON(text) {
  var parsed = parser.parse(text);
  if (!parsed.ok) {
    return { ok: false, bankId: '', name: '', count: 0, errors: parsed.errors };
  }
  var name = parsed.name || ('导入题库 ' + util.formatShortDate(Date.now()));
  var bank = saveBank(name, parsed.questions);
  if (!bank) {
    return { ok: false, bankId: '', name: '', count: 0, errors: [getLastError() || '保存失败'] };
  }
  return { ok: true, bankId: bank.id, name: bank.name, count: bank.count, errors: parsed.errors };
}

/* ------------------------------------------------------------------ */
/* 练习结果                                                            */
/* ------------------------------------------------------------------ */

/**
 * 暂存最近一次练习结果。
 * @param {Object} payload
 * @return {boolean}
 */
function setLastResult(payload) {
  return write(K.lastResult, payload);
}

/**
 * 读取最近一次练习结果。
 * @return {Object|null}
 */
function getLastResult() {
  var r = read(K.lastResult, null);
  if (!r || typeof r !== 'object') return null;
  return r;
}

/* ------------------------------------------------------------------ */
/* 设置                                                                */
/* ------------------------------------------------------------------ */

/**
 * 读取设置（带默认值）。
 * @return {{autoNext: boolean, autoNextDelay: number}}
 */
function getSettings() {
  var s = read(K.settings, null);
  var out = {
    autoNext: DEFAULT_SETTINGS.autoNext,
    autoNextDelay: DEFAULT_SETTINGS.autoNextDelay,
  };
  if (s && typeof s === 'object') {
    if (typeof s.autoNext === 'boolean') out.autoNext = s.autoNext;
    var d = Number(s.autoNextDelay);
    if ([400, 800, 1500].indexOf(d) >= 0) out.autoNextDelay = d;
  }
  return out;
}

/**
 * 保存设置（与现有值合并）。
 * @param {Object} patch
 * @return {Object} 合并后的完整设置
 */
function setSettings(patch) {
  var cur = getSettings();
  if (patch && typeof patch === 'object') {
    if (typeof patch.autoNext === 'boolean') cur.autoNext = patch.autoNext;
    var d = Number(patch.autoNextDelay);
    if ([400, 800, 1500].indexOf(d) >= 0) cur.autoNextDelay = d;
  }
  write(K.settings, cur);
  return cur;
}

/**
 * 读取主题偏好（由 theme.js 独占解释，store 只负责存取）。
 * @return {string} 原始值，未设置时返回空字符串
 */
function getThemePref() {
  var v = read(K.themePref, '');
  if (v === '' || v === undefined || v === null) return '';
  return String(v);
}

/**
 * 写入主题偏好。
 * @param {string} t
 * @return {boolean}
 */
function setThemePref(t) {
  return write(K.themePref, String(t === undefined || t === null ? '' : t));
}

/* ------------------------------------------------------------------ */
/* 元信息                                                              */
/* ------------------------------------------------------------------ */

/**
 * 读取应用元信息。
 * @return {{version: number, lastBackupAt: number}}
 */
function getMeta() {
  var m = read(K.meta, null);
  var out = { version: 1, lastBackupAt: 0 };
  if (m && typeof m === 'object') {
    out.version = Number(m.version) || 1;
    out.lastBackupAt = Number(m.lastBackupAt) || 0;
  }
  return out;
}

/**
 * 更新应用元信息。
 * @param {Object} patch
 * @return {Object}
 */
function setMeta(patch) {
  var cur = getMeta();
  if (patch && typeof patch === 'object') {
    if (patch.version !== undefined) cur.version = Number(patch.version) || 1;
    if (patch.lastBackupAt !== undefined) cur.lastBackupAt = Number(patch.lastBackupAt) || 0;
  }
  write(K.meta, cur);
  return cur;
}

/* ------------------------------------------------------------------ */
/* 全量备份 / 恢复 / 清空                                              */
/* ------------------------------------------------------------------ */

/**
 * 列出所有 qb: 前缀的存储 key。
 * @return {Array<string>}
 */
function listDataKeys() {
  var keys = [];
  try {
    var info = wx.getStorageInfoSync();
    var all = (info && info.keys) || [];
    for (var i = 0; i < all.length; i++) {
      // qb:__ 前缀是内部 key（快照/探测），不参与备份与同步
      if (isBizKey(all[i])) keys.push(all[i]);
    }
  } catch (e) {
    return [];
  }
  return keys;
}

/**
 * 导出全部题库数据为 JSON 字符串。
 * @return {{ok: boolean, json: string, bankCount: number, questionCount: number, message: string}}
 */
function exportAll() {
  var keys = listDataKeys();
  var data = {};
  for (var i = 0; i < keys.length; i++) {
    data[keys[i]] = read(keys[i], null);
  }
  var banks = Array.isArray(data[K.list]) ? data[K.list] : [];
  var questionCount = 0;
  for (var b = 0; b < banks.length; b++) {
    var qs = data[K.data(banks[b].id)];
    if (Array.isArray(qs)) questionCount += qs.length;
  }
  var payload = {
    app: 'quiz-miniprogram',
    version: 1,
    exportedAt: Date.now(),
    data: data,
  };
  try {
    return {
      ok: true,
      json: JSON.stringify(payload),
      bankCount: banks.length,
      questionCount: questionCount,
      message: '',
    };
  } catch (e) {
    return { ok: false, json: '', bankCount: 0, questionCount: 0, message: '生成备份失败' };
  }
}

/**
 * 校验备份文本。
 * @param {string} text
 * @return {{ok: boolean, message: string, bankCount: number, questionCount: number}}
 */
function validateBackup(text) {
  var raw = String(text === undefined || text === null ? '' : text).trim();
  if (!raw) return { ok: false, message: '剪贴板是空的', bankCount: 0, questionCount: 0 };
  var payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    return { ok: false, message: '内容不是有效的备份 JSON', bankCount: 0, questionCount: 0 };
  }
  if (!payload || payload.app !== 'quiz-miniprogram') {
    return { ok: false, message: '这不是本小程序的备份内容', bankCount: 0, questionCount: 0 };
  }
  if (!payload.data || typeof payload.data !== 'object') {
    return { ok: false, message: '备份内容缺少 data 字段', bankCount: 0, questionCount: 0 };
  }
  var banks = Array.isArray(payload.data[K.list]) ? payload.data[K.list] : [];
  var questionCount = 0;
  for (var i = 0; i < banks.length; i++) {
    var qs = payload.data[K.data(banks[i].id)];
    if (Array.isArray(qs)) questionCount += qs.length;
  }
  return { ok: true, message: '', bankCount: banks.length, questionCount: questionCount };
}

/**
 * 从备份文本恢复数据（覆盖现有题库数据）。
 *
 * 数据安全策略（顺序不可调换）：
 *   ① 容量预检 —— 备份明显超限时直接拒绝，一个字节都不动原数据
 *   ② 写入探测 —— 先写一个哨兵 key 确认存储可写，避免「先清空、再发现写不进去」
 *   ③ 快照 —— 记录全部旧 key 的值，供中途失败回滚
 *   ④ 先写后删 —— 只覆盖同名 key，全程不提前删除任何旧数据
 *                  （setStorageSync 单次原子：写失败时该 key 仍是旧值）
 *   ⑤ 失败回滚 —— 只还原「已被成功覆盖」的那几个 key，净占用不增加
 *   ⑥ 全部写成功后才清理「新备份里不存在」的旧 key
 *
 * @param {string} text
 * @return {{ok: boolean, message: string}}
 */
function importAll(text) {
  var check = validateBackup(text);
  if (!check.ok) return { ok: false, message: check.message };

  var payload;
  try {
    payload = JSON.parse(String(text));
  } catch (e) {
    return { ok: false, message: '内容不是有效的备份 JSON' };
  }
  var data = payload && payload.data && typeof payload.data === 'object' ? payload.data : null;
  if (!data) return { ok: false, message: '备份内容缺少 data 字段' };

  // 收集待写入项（只认 qb: 前缀）
  var incoming = [];
  var newKeys = Object.keys(data);
  for (var n = 0; n < newKeys.length; n++) {
    var nk = newKeys[n];
    if (String(nk).indexOf('qb:') !== 0) continue;
    var nv = data[nk];
    if (nv === null || nv === undefined) continue;
    incoming.push({ key: nk, value: nv });
  }
  if (!incoming.length) {
    return { ok: false, message: '备份里没有可恢复的题库数据，原数据未改动' };
  }

  // ① 容量预检
  try {
    var info = wx.getStorageInfoSync();
    var limitKB = info && info.limitSize ? Number(info.limitSize) : 10240;
    var needKB = 0;
    for (var c = 0; c < incoming.length; c++) {
      needKB += JSON.stringify(incoming[c].value).length / 1024;
    }
    if (limitKB > 0 && needKB > limitKB) {
      return {
        ok: false,
        message: '恢复失败：备份约需 ' + Math.ceil(needKB) + 'KB，超过本地存储上限 ' +
          limitKB + 'KB，原数据未改动',
      };
    }
  } catch (e2) {
    // 读容量失败不阻断，靠后面的写入探测兜底
  }

  // ② 写入探测：确认存储可写后再做破坏性操作
  if (!write(PROBE_KEY, Date.now())) {
    var probeMsg = getLastError() || '存储不可写';
    drop(PROBE_KEY);
    return { ok: false, message: '恢复失败：' + probeMsg + '，原数据未改动' };
  }
  drop(PROBE_KEY);

  // ③ 快照旧数据（供回滚用）
  var oldKeys = listDataKeys();
  var snapshot = {};
  for (var s = 0; s < oldKeys.length; s++) {
    snapshot[oldKeys[s]] = read(oldKeys[s], null);
  }

  // ④ 先写新数据，一个旧 key 都不删。
  //    单次 setStorageSync 是原子的：写失败的 key 保持旧值，所以这一阶段不会造成破坏。
  var failed = '';
  var written = [];
  for (var w = 0; w < incoming.length; w++) {
    if (write(incoming[w].key, incoming[w].value)) {
      written.push(incoming[w].key);
    } else {
      failed = getLastError() || '写入失败';
      break;
    }
  }

  if (failed) {
    // ⑤ 回滚：只把「已成功覆盖」的 key 还原成旧值，其余数据自始至终没动过。
    //    还原的是原来就在这个 key 上的值，净占用不增加，正常情况下必然写得回去。
    if (!written.length) {
      return { ok: false, message: '恢复失败：' + failed + '，原数据未改动' };
    }
    var rolledBack = true;
    try {
      for (var b = 0; b < written.length; b++) {
        var oldVal = snapshot[written[b]];
        if (oldVal === null || oldVal === undefined) {
          drop(written[b]);
        } else if (!write(written[b], oldVal)) {
          rolledBack = false;
          break;
        }
      }
    } catch (e3) {
      rolledBack = false;
    }
    if (rolledBack) {
      return { ok: false, message: '恢复失败，已回滚原数据（' + failed + '）' };
    }
    return { ok: false, message: '恢复失败，且回滚未完成，原数据可能已损坏：' + failed };
  }

  // ⑥ 全部写成功后才清理旧数据里「新备份不存在」的 key（例如被删掉的题库）
  var keep = {};
  for (var k = 0; k < incoming.length; k++) keep[incoming[k].key] = true;
  for (var d = 0; d < oldKeys.length; d++) {
    if (!keep[oldKeys[d]]) drop(oldKeys[d]);
  }

  return { ok: true, message: '' };
}

/**
 * 把内置题库写入本地存储。
 *
 * 规则：
 *   - 按题库名查重，同名题库已存在则跳过，绝不重复导入、也绝不覆盖用户数据；
 *   - 因此即使用户先加载过示例题库，内置题库依然会正常写入；
 *   - 成功后写入 app:seeded 标记，用户删掉内置题库后不会再自动冒出来；
 *   - 失败（模块加载异常等）不写标记，下次启动会自动重试；
 *   - force=true 时忽略标记，用于设置页/空态页的「手动载入」入口。
 *
 * @param {boolean} [force]
 * @return {{ seeded: boolean, count: number, error: string }}
 */
function seedBuiltin(force) {
  var result = { seeded: false, count: 0, error: '' };
  if (!force && read(K.seeded, 0)) return result;

  try {
    var builtin = require('./builtin-banks.js');
    if (!builtin || !builtin.length) {
      result.error = '内置题库模块为空';
      return result;
    }
    var existing = {};
    var list = listBanks();
    for (var j = 0; j < list.length; j++) {
      existing[String(list[j].name || '').trim()] = true;
    }
    for (var i = 0; i < builtin.length; i++) {
      var name = String(builtin[i].name || '').trim();
      if (!name || existing[name]) continue;
      if (saveBank(name, builtin[i].questions)) {
        existing[name] = true;
        result.count += 1;
      }
    }
    result.seeded = result.count > 0;
  } catch (e) {
    result.error = '内置题库写入失败：' + (e && e.message ? e.message : String(e));
    lastError = result.error;
    return result; // 不写标记，留待下次重试
  }

  write(K.seeded, 1);
  return result;
}

/** 兼容旧调用：首次启动用，非强制 */
function seedBuiltinOnce() {
  return seedBuiltin(false);
}

/**
 * 清空全部题库数据（保留主题与设置）。
 * @return {boolean}
 */
function clearAllData() {
  var keys = listDataKeys();
  for (var i = 0; i < keys.length; i++) drop(keys[i]);
  return true;
}

/**
 * 存储概况。
 * @return {{bankCount: number, questionCount: number, usedKB: number, limitKB: number}}
 */
function storageSummary() {
  var banks = listBanks();
  var questionCount = 0;
  for (var i = 0; i < banks.length; i++) questionCount += Number(banks[i].count) || 0;
  var usedKB = 0;
  var limitKB = 0;
  try {
    var info = wx.getStorageInfoSync();
    usedKB = info && info.currentSize ? Number(info.currentSize) : 0;
    limitKB = info && info.limitSize ? Number(info.limitSize) : 0;
  } catch (e) {
    usedKB = 0;
  }
  return {
    bankCount: banks.length,
    questionCount: questionCount,
    usedKB: usedKB,
    limitKB: limitKB,
  };
}

/* ------------------------------------------------------------------ */
/* 云端同步支持（不改动上面任何对外接口）                              */
/* ------------------------------------------------------------------ */

/**
 * 注册业务数据变更监听。同步层独占，重复调用以最后一次为准。
 * @param {Function|null} fn
 */
function setChangeListener(fn) {
  changeListener = typeof fn === 'function' ? fn : null;
}

/**
 * 读取同步元信息。
 * @return {{lastLocalWrite: number, lastSyncedAt: number, inited: boolean}}
 */
function getSyncMeta() {
  var m = read(SYNC_META_KEY, null);
  var out = { lastLocalWrite: 0, lastSyncedAt: 0, inited: false };
  if (m && typeof m === 'object') {
    out.lastLocalWrite = Number(m.lastLocalWrite) || 0;
    out.lastSyncedAt = Number(m.lastSyncedAt) || 0;
    out.inited = !!m.inited;
  }
  return out;
}

/**
 * 更新同步元信息。
 * @param {{lastLocalWrite?: number, lastSyncedAt?: number, inited?: boolean}} patch
 * @return {{lastLocalWrite: number, lastSyncedAt: number, inited: boolean}}
 */
function setSyncMeta(patch) {
  var cur = getSyncMeta();
  if (patch && typeof patch === 'object') {
    if (patch.lastLocalWrite !== undefined) cur.lastLocalWrite = Number(patch.lastLocalWrite) || 0;
    if (patch.lastSyncedAt !== undefined) cur.lastSyncedAt = Number(patch.lastSyncedAt) || 0;
    if (patch.inited !== undefined) cur.inited = !!patch.inited;
  }
  try {
    wx.setStorageSync(SYNC_META_KEY, cur);
  } catch (e) {
    // 忽略
  }
  return cur;
}

/**
 * 取本地全部业务数据的快照（不含 qb:__ 内部 key）。
 * @return {Object} { storageKey: value }
 */
function snapshotAll() {
  var keys = listDataKeys();
  var out = {};
  for (var i = 0; i < keys.length; i++) {
    out[keys[i]] = read(keys[i], null);
  }
  return out;
}

/**
 * 用云端数据覆盖本地。
 *
 * 安全策略：
 *   ① 覆盖前先把当前本地全量写入快照 key，任何误覆盖都能一键回滚；
 *   ② 全程 mutedWrite，避免写入触发监听形成「拉取→推送」回环；
 *   ③ 只清理云端不存在的业务 key，先写后删，写入失败立即返回且不清数据。
 *
 * @param {Object} keys 云端 { k: v }
 * @param {number} updatedAt 云端更新时间
 * @return {{ok: boolean, count?: number, message?: string}}
 */
function applyRemote(keys, updatedAt) {
  if (!keys || typeof keys !== 'object') {
    return { ok: false, message: '云端数据为空' };
  }

  var incoming = [];
  var k;
  for (k in keys) {
    if (!Object.prototype.hasOwnProperty.call(keys, k)) continue;
    if (!isBizKey(k)) continue;
    if (keys[k] === null || keys[k] === undefined) continue;
    incoming.push({ k: k, v: keys[k] });
  }
  if (!incoming.length) {
    return { ok: false, message: '云端没有可恢复的数据' };
  }

  // ① 覆盖前快照
  try {
    wx.setStorageSync(SNAPSHOT_KEY, {
      at: Date.now(),
      source: 'remote',
      data: snapshotAll(),
    });
  } catch (e) {
    // 快照失败不阻断，但不能因此丢数据，继续走写入
  }

  // ② 静默写入
  mutedWrite = true;
  try {
    for (var i = 0; i < incoming.length; i++) {
      if (!write(incoming[i].k, incoming[i].v)) {
        return { ok: false, message: lastError || '写入失败，原数据已尽量保留' };
      }
    }

    // ③ 清理云端已不存在的业务 key（如远端删掉的题库）
    var keep = {};
    for (var j = 0; j < incoming.length; j++) keep[incoming[j].k] = true;
    var locals = listDataKeys();
    for (var m = 0; m < locals.length; m++) {
      if (!keep[locals[m]]) drop(locals[m]);
    }
  } finally {
    mutedWrite = false;
  }

  var t = Number(updatedAt) || Date.now();
  try {
    // 保留既有的 inited 标记，并置为 true（已经和云端对齐过）
    var cur = getSyncMeta();
    cur.lastLocalWrite = t;
    cur.lastSyncedAt = Date.now();
    cur.inited = true;
    wx.setStorageSync(SYNC_META_KEY, cur);
  } catch (e2) {
    // 忽略
  }

  return { ok: true, count: incoming.length };
}

/**
 * 是否存在可回滚的本地快照。
 * @return {boolean}
 */
function hasLocalSnapshot() {
  var s = read(SNAPSHOT_KEY, null);
  return !!(s && s.data && typeof s.data === 'object');
}

/**
 * 快照概要。
 * @return {{at: number, source: string, count: number}|null}
 */
function snapshotInfo() {
  var s = read(SNAPSHOT_KEY, null);
  if (!s || !s.data || typeof s.data !== 'object') return null;
  var count = 0;
  var k;
  for (k in s.data) {
    if (Object.prototype.hasOwnProperty.call(s.data, k)) count += 1;
  }
  return { at: Number(s.at) || 0, source: String(s.source || ''), count: count };
}

/**
 * 回滚到最近一次快照。
 * @return {{ok: boolean, count?: number, message?: string}}
 */
function restoreLocalSnapshot() {
  var s = read(SNAPSHOT_KEY, null);
  if (!s || !s.data || typeof s.data !== 'object') {
    return { ok: false, message: '没有可用的本地快照' };
  }

  var keys = [];
  var k;
  for (k in s.data) {
    if (Object.prototype.hasOwnProperty.call(s.data, k)) keys.push(k);
  }

  mutedWrite = true;
  try {
    for (var i = 0; i < keys.length; i++) {
      if (!write(keys[i], s.data[keys[i]])) {
        return { ok: false, message: lastError || '回滚失败' };
      }
    }
    var keep = {};
    for (var j = 0; j < keys.length; j++) keep[keys[j]] = true;
    var locals = listDataKeys();
    for (var m = 0; m < locals.length; m++) {
      if (!keep[locals[m]]) drop(locals[m]);
    }
  } finally {
    mutedWrite = false;
  }

  touchLocalWrite();
  return { ok: true, count: keys.length };
}

/**
 * 清除快照。
 * @return {boolean}
 */
function clearSnapshot() {
  return drop(SNAPSHOT_KEY);
}

/**
 * 云端统计用的汇总数据。
 * @return {{banks: number, questions: number, answered: number, correct: number}}
 */
function summaryForCloud() {
  var banks = listBanks();
  var answered = 0;
  var correct = 0;
  var questions = 0;
  for (var i = 0; i < banks.length; i++) {
    var s = getStat(banks[i].id);
    answered += s.answered;
    correct += s.correct;
    questions += Number(banks[i].count) || 0;
  }
  return {
    banks: banks.length,
    questions: questions,
    answered: answered,
    correct: correct,
  };
}

/**
 * 读取本地用户档案。
 * @return {{nickname: string, skipped: boolean, updatedAt: number}}
 */
function getProfile() {
  var p = read(PROFILE_KEY, null);
  if (!p || typeof p !== 'object') {
    return { nickname: '', skipped: false, updatedAt: 0 };
  }
  return {
    nickname: String(p.nickname || ''),
    skipped: !!p.skipped,
    updatedAt: Number(p.updatedAt) || 0,
  };
}

/**
 * 写入本地用户档案。
 * @param {{nickname?: string, skipped?: boolean}} patch
 * @return {{nickname: string, skipped: boolean, updatedAt: number}}
 */
function setProfile(patch) {
  var cur = getProfile();
  if (patch && typeof patch === 'object') {
    if (patch.nickname !== undefined) cur.nickname = String(patch.nickname || '').slice(0, 12);
    if (patch.skipped !== undefined) cur.skipped = !!patch.skipped;
  }
  cur.updatedAt = Date.now();
  try {
    wx.setStorageSync(PROFILE_KEY, cur);
  } catch (e) {
    // 忽略
  }
  return cur;
}

module.exports = {
  KEYS: K,
  getLastError: getLastError,
  takeError: takeError,

  listBanks: listBanks,
  getBank: getBank,
  saveBank: saveBank,
  renameBank: renameBank,
  removeBank: removeBank,
  getQuestions: getQuestions,
  markPracticed: markPracticed,

  saveProgress: saveProgress,
  getProgress: getProgress,
  clearProgress: clearProgress,

  addWrong: addWrong,
  removeWrong: removeWrong,
  getWrong: getWrong,

  toggleFav: toggleFav,
  getFav: getFav,

  getStat: getStat,
  bumpStat: bumpStat,

  exportBankJSON: exportBankJSON,
  importBankJSON: importBankJSON,

  setLastResult: setLastResult,
  getLastResult: getLastResult,

  getSettings: getSettings,
  setSettings: setSettings,

  getThemePref: getThemePref,
  setThemePref: setThemePref,

  getMeta: getMeta,
  setMeta: setMeta,

  seedBuiltinOnce: seedBuiltinOnce,
  seedBuiltin: seedBuiltin,

  exportAll: exportAll,
  validateBackup: validateBackup,
  importAll: importAll,
  clearAllData: clearAllData,
  storageSummary: storageSummary,

  // 云端同步支持
  setChangeListener: setChangeListener,
  getSyncMeta: getSyncMeta,
  setSyncMeta: setSyncMeta,
  snapshotAll: snapshotAll,
  applyRemote: applyRemote,
  hasLocalSnapshot: hasLocalSnapshot,
  snapshotInfo: snapshotInfo,
  restoreLocalSnapshot: restoreLocalSnapshot,
  clearSnapshot: clearSnapshot,
  summaryForCloud: summaryForCloud,
  getProfile: getProfile,
  setProfile: setProfile,
};
