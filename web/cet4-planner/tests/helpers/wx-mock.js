// wx 全局 mock：让 store.js 在 Node 测试环境可运行（内存存储）
function createWxMock() {
  var mem = {};
  return {
    getStorageSync: function (k) {
      return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : '';
    },
    setStorageSync: function (k, v) {
      // 模拟小程序存储的序列化语义
      mem[k] = JSON.parse(JSON.stringify(v));
    },
    removeStorageSync: function (k) {
      delete mem[k];
    }
  };
}

global.wx = createWxMock();
