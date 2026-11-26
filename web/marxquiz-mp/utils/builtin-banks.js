/**
 * builtin-banks.js —— 内置题库聚合入口
 *
 * 共 7 个题库、912 道题，覆盖单选/多选/判断，每题带完整解析。
 * 首次启动时由 store.seedBuiltinOnce() 写入本地存储。
 *
 * 数据按章节拆在 utils/banks/bank-NN.js 里：单个大文件（700KB+、超长单行）
 * 会让微信开发者工具编译变慢甚至静默失败，所以这里只做拼接。
 * 本文件与 banks/ 下的分片都是生成产物，不要手改。
 *
 * 每个元素形如 { name: '题库名', questions: [...] }
 */
module.exports = [
  require('./banks/bank-01.js'),
  require('./banks/bank-02.js'),
  require('./banks/bank-03.js'),
  require('./banks/bank-04.js'),
  require('./banks/bank-05.js'),
  require('./banks/bank-06.js'),
  require('./banks/bank-07.js')
];
