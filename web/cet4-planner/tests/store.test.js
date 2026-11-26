// seam: utils/store.js 的公共接口（任务 CRUD 是打卡闭环的承重墙）
require('./helpers/wx-mock.js');
var test = require('node:test');
var assert = require('node:assert');
var store = require('../utils/store.js');

function mkTask(id, overrides) {
  return Object.assign({
    id: id, title: '任务 ' + id, type: 'vocab', contentRef: '',
    planDate: '2026-09-28', estMinutes: 20, status: 0,
    stage: 'basic', source: 'manual', createdAt: 1
  }, overrides || {});
}

test('profile: 保存后能原样读回', function () {
  store.saveProfile({ examDate: '2026-12-12', weeklyHours: 8, targetScore: 500 });
  assert.deepStrictEqual(store.getProfile(), { examDate: '2026-12-12', weeklyHours: 8, targetScore: 500 });
});

test('addTask/getTask/updateTask: 完整闭环', function () {
  store.saveTasks([]);
  store.addTask(mkTask('a'));
  store.addTask(mkTask('b', { source: 'engine' }));

  var got = store.getTask('a');
  assert.strictEqual(got.title, '任务 a');

  var updated = store.updateTask('a', { status: 1 });
  assert.strictEqual(updated.status, 1);
  assert.strictEqual(store.getTask('a').status, 1);
  // 不存在的 id 更新返回 null
  assert.strictEqual(store.updateTask('nope', { status: 1 }), null);
});

test('removeTask: 只删目标，其余保留', function () {
  store.saveTasks([]);
  store.addTask(mkTask('a'));
  store.addTask(mkTask('b'));
  store.removeTask('a');
  assert.strictEqual(store.getTask('a'), null);
  assert.ok(store.getTask('b'));
});

test('removeEngineTasks: 引擎任务被清，手动任务保留', function () {
  store.saveTasks([]);
  store.addTask(mkTask('engine-1', { source: 'engine' }));
  store.addTask(mkTask('manual-1', { source: 'manual' }));
  store.removeEngineTasks();
  assert.strictEqual(store.getTask('engine-1'), null);
  assert.ok(store.getTask('manual-1'));
});

test('imports: 增删索引不影响其他记录', function () {
  store.saveImports([]);
  var a = store.addImport({ name: '刘晓燕48课', type: '词汇', source: 'B站' });
  var b = store.addImport({ name: '华研八合一', type: '真题', source: '纸质' });
  assert.strictEqual(store.getImports().length, 2);
  store.removeImport(a.id);
  var rest = store.getImports();
  assert.strictEqual(rest.length, 1);
  assert.strictEqual(rest[0].name, '华研八合一');
  assert.ok(b.id);
});

// 真实 bug：重新生成时若只清 'engine'，主计划（source='plan108'）清不掉，任务会翻倍叠加
test('removeEngineTasks: 清除所有规划生成的任务（含 plan108 主计划）', function () {
  store.saveTasks([]);
  store.addTask({ id: 'p1', title: '计划任务', type: 'vocab', planDate: '2026-10-08', source: 'plan108' });
  store.addTask({ id: 'e1', title: '通用任务', type: 'read', planDate: '2026-10-08', source: 'engine' });
  store.addTask({ id: 'm1', title: '手动任务', type: 'write', planDate: '2026-10-08', source: 'manual' });
  assert.strictEqual(store.getTasks().length, 3);

  store.removeEngineTasks();
  var left = store.getTasks().map(function (t) { return t.id; });
  assert.deepStrictEqual(left, ['m1'], '只保留手动添加: ' + left.join(','));
});

test('removeEngineTasks: 重复调用不会误删手动任务', function () {
  store.saveTasks([]);
  store.addTask({ id: 'm9', title: '手动', type: 'other', planDate: '2026-10-08', source: 'manual' });
  store.removeEngineTasks();
  store.removeEngineTasks();
  assert.strictEqual(store.getTasks().length, 1);
});
