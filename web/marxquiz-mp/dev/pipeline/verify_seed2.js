const path = require('path');
const APP = 'D:/03_项目归档/MarxQuiz MP';
const mem = {}; let size = 0;
global.wx = {
  setStorageSync(k, v) { const s = JSON.stringify(v); size += s.length - (mem[k] ? JSON.stringify(mem[k]).length : 0); mem[k] = JSON.parse(s); },
  getStorageSync(k) { return mem[k] === undefined ? '' : mem[k]; },
  removeStorageSync(k) { delete mem[k]; },
  getStorageInfoSync() { return { keys: Object.keys(mem), currentSize: Math.round(size / 1024), limitSize: 10240 }; },
};
const store = require(path.join(APP, 'utils/store.js'));

console.log('=== 场景 A：先加载了示例题库，再启动 ===');
store.saveBank('示例题库', [{ type: 'single', stem: '示例题', options: [{key:'A',text:'甲'},{key:'B',text:'乙'}], answer: 'A', analysis: '', tags: [] }]);
console.log('启动前题库数=' + store.listBanks().length);
const r = store.seedBuiltinOnce();
console.log('seeded=' + r.seeded + ' count=' + r.count + ' 题库数=' + store.listBanks().length);
const names = store.listBanks().map(b => b.name).sort();
console.log('题库列表: ' + names.join(' / '));

console.log('\n=== 场景 B：重复启动不重复写入 ===');
const r2 = store.seedBuiltinOnce();
console.log('seeded=' + r2.seeded + ' count=' + r2.count + ' 题库数=' + store.listBanks().length);

console.log('\n=== 场景 C：用户删掉两个内置题库后不再补回 ===');
const del = store.listBanks().filter(b => b.name.indexOf('马原·第') === 0).slice(0, 2);
del.forEach(b => store.removeBank(b.id));
const before = store.listBanks().length;
store.seedBuiltinOnce();
console.log('删除 ' + del.map(b=>b.name).join('、') + ' → 删除后=' + before + ' 再启动后=' + store.listBanks().length);

const total = store.listBanks().reduce((s, b) => s + b.count, 0);
console.log('\n最终题库数=' + store.listBanks().length + ' 总题数=' + total + ' 存储=' + wx.getStorageInfoSync().currentSize + 'KB');
const ok = r.count === 7 && names.length === 8 && r2.count === 0 && store.listBanks().length === before;
console.log(ok ? 'ALL PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
