// 数据层（本地优先 + 可选云同步）
// 设计说明：接口与"上云版"保持一致；开启云同步后，每次写入会防抖镜像到云端集合 cet4_sync。
// 铁律：这里只存"任务/档案/材料索引（指针）"，不存任何题目、单词内容正文。
var KEY = {
  PROFILE: 'cet4_profile',
  TASKS: 'cet4_tasks',
  IMPORTS: 'cet4_imports',
  META: 'cet4_meta'
};

var _meta = null;   // { updatedAt } 用于云同步的"最后写入胜出"判断
var _hooks = [];    // 写入后的回调（云同步在这里挂载）

function _get(k, def) {
  try {
    var v = wx.getStorageSync(k);
    return (v === '' || v === null || v === undefined) ? def : v;
  } catch (e) {
    console.error('读取存储失败', e);
    return def;
  }
}

function _set(k, v) {
  try {
    wx.setStorageSync(k, v);
  } catch (e) {
    console.error('写入存储失败', e);
  }
}

function _bump() {
  _meta = { updatedAt: Date.now() };
  _set(KEY.META, _meta);
}

function _emit() {
  for (var i = 0; i < _hooks.length; i++) {
    try { _hooks[i](); } catch (e) { console.error('数据变更回调异常', e); }
  }
}

function onChange(fn) { _hooks.push(fn); }

// 启动时恢复上次时间戳
_meta = _get(KEY.META, { updatedAt: 0 });

/* ---------- 考试档案 ---------- */
function getProfile() { return _get(KEY.PROFILE, null); }
function saveProfile(p) { _set(KEY.PROFILE, p); _bump(); _emit(); }

/* ---------- 任务 ---------- */
function getTasks() { return _get(KEY.TASKS, []); }
function saveTasks(list) { _set(KEY.TASKS, list || []); _bump(); _emit(); }

function getTask(id) {
  var list = getTasks();
  for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
  return null;
}

function addTask(t) {
  var list = getTasks();
  list.push(t);
  saveTasks(list);
  return t;
}

// 批量写入：一次性落盘，避免 N 次全量重写 + N 次云同步触发
// （生成整份规划时有 169+ 个任务，逐条 addTask 会造成明显的存储抖动与推送风暴）
function addTasks(ts) {
  if (!ts || !ts.length) return [];
  var list = getTasks().concat(ts);
  saveTasks(list);
  return ts;
}

function updateTask(id, patch) {
  var list = getTasks();
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) {
      list[i] = Object.assign({}, list[i], patch);
      saveTasks(list);
      return list[i];
    }
  }
  return null;
}

function removeTask(id) {
  saveTasks(getTasks().filter(function (t) { return t.id !== id; }));
}

// 规划引擎生成的任务来源（手动添加的 'manual' 一律保留）
// 注意：主计划《10.8启动计划》的来源是 'plan108'，历史上还有 'phase15' / 'transition'，
//       若这里只认 'engine'，重新生成会清不掉旧任务、导致任务翻倍叠加
var GENERATED_SOURCES = { engine: 1, plan108: 1, phase15: 1, transition: 1 };

// 只清除"规划引擎生成"的任务（手动添加的保留），用于重新生成规划
function removeEngineTasks() {
  saveTasks(getTasks().filter(function (t) { return !GENERATED_SOURCES[t.source]; }));
}

/* ---------- 材料索引（只记名称/类型/来源，不存内容正文） ---------- */
function getImports() { return _get(KEY.IMPORTS, []); }
function saveImports(v) { _set(KEY.IMPORTS, v || []); _bump(); _emit(); }

var _importSeq = 0; // 防同一毫秒内 id 撞车（测试抓出的真实 bug）
function addImport(item) {
  var list = getImports();
  item.id = 'i' + Date.now() + '_' + (++_importSeq);
  item.createdAt = Date.now();
  list.push(item);
  saveImports(list);
  return item;
}

function removeImport(id) {
  saveImports(getImports().filter(function (x) { return x.id !== id; }));
}

/* ---------- 元信息 / 云同步支撑 ---------- */
function getMeta() { return _meta || { updatedAt: 0 }; }

// 用云端快照整体覆盖本地（仅云同步拉取时调用）
function restoreAll(snap) {
  _set(KEY.PROFILE, snap.profile || null);
  _set(KEY.TASKS, snap.tasks || []);
  _set(KEY.IMPORTS, snap.imports || []);
  _meta = { updatedAt: snap.updatedAt || Date.now() };
  _set(KEY.META, _meta);
  // 注意：这里不 _emit，避免拉取后又触发一轮推送
}

/* ---------- 危险操作 ---------- */
function clearAll() {
  [KEY.PROFILE, KEY.TASKS, KEY.IMPORTS, KEY.META].forEach(function (k) {
    try { wx.removeStorageSync(k); } catch (e) { console.error('清除失败', k, e); }
  });
  _meta = { updatedAt: 0 };
}

module.exports = {
  getProfile: getProfile,
  saveProfile: saveProfile,
  getTasks: getTasks,
  saveTasks: saveTasks,
  getTask: getTask,
  addTask: addTask,
  addTasks: addTasks,
  updateTask: updateTask,
  removeTask: removeTask,
  removeEngineTasks: removeEngineTasks,
  getImports: getImports,
  saveImports: saveImports,
  addImport: addImport,
  removeImport: removeImport,
  getMeta: getMeta,
  restoreAll: restoreAll,
  onChange: onChange,
  clearAll: clearAll
};
