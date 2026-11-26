// 交互辅助：数字滚动 + 水波/爆散效果（本地优先，无云依赖）
// 高级交互准则：给每一次操作恰到好处的反馈，不过度。

// 数字滚动：easeOutCubic 缓慢减速平稳停稳，禁止中途急停
function animateNumber(page, field, from, to, duration) {
  if (typeof from !== 'number' || typeof to !== 'number') {
    page.setData({ [field]: to });
    return;
  }
  if (from === to) { page.setData({ [field]: to }); return; }
  duration = duration || 600;
  var start = Date.now();
  var diff = to - from;
  if (page.__rollTimers && page.__rollTimers[field]) {
    clearInterval(page.__rollTimers[field]);
  }
  if (!page.__rollTimers) page.__rollTimers = {};
  page.__rollTimers[field] = setInterval(function () {
    var t = Math.min(1, (Date.now() - start) / duration);
    var eased = 1 - Math.pow(1 - t, 3);
    var val = Math.round(from + diff * eased);
    page.setData({ [field]: val });
    if (t >= 1) {
      clearInterval(page.__rollTimers[field]);
      page.setData({ [field]: to });
    }
  }, 30);
}

// 水波/爆散：以点击点为原点扩散，由 host 的 overflow:hidden 裁切成形
// hostId: 触发元素 id（需 position:relative;overflow:hidden）
// dataField: 该 host 持有的波纹数组字段名（避免多个 host 共用）
// type: 'ripple' 实心水波 | 'burst' 环形爆散（仅关键操作）
function spawnEffect(page, e, hostId, dataField, type) {
  var touches = (e.touches && e.touches[0]) ? e.touches[0]
    : ((e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null);
  if (!touches || !page || !page.data || typeof page.setData !== 'function') return;
  var q = wx.createSelectorQuery().in(page);
  q.select('#' + hostId).boundingClientRect(function (rect) {
    if (!rect || !page.data) return;
    var x = touches.clientX - rect.left;
    var y = touches.clientY - rect.top;
    var size = Math.max(rect.width, rect.height) * 2.2;
    var ripple = {
      id: 'r' + Date.now() + Math.floor(Math.random() * 1000),
      left: x - size / 2,
      top: y - size / 2,
      size: size,
      kind: type === 'burst' ? 'ix-burst' : ''
    };
    try {
      var list = (page.data[dataField] || []).concat([ripple]);
      var patch = {};
      patch[dataField] = list;
      page.setData(patch);
    } catch (err) { return; }
    // 640ms 后移除该波纹；若页面已卸载 setData 会失败，静默忽略
    setTimeout(function () {
      try {
        if (!page.data) return;
        var next = (page.data[dataField] || []).filter(function (r) { return r.id !== ripple.id; });
        var p2 = {};
        p2[dataField] = next;
        page.setData(p2);
      } catch (err) { /* 页面已卸载，忽略 */ }
    }, 640);
  }).exec();
}

// 页面切换过渡：tab 页每次 onShow 重放淡入上移（先清类再 30ms 后加，强制重启动画）
function applyPageEnter(page) {
  if (!page || typeof page.setData !== 'function' || !page.data) return;
  try { page.setData({ _enter: '' }); } catch (err) { return; }
  setTimeout(function () {
    try { page.setData({ _enter: 'fx-in' }); } catch (err) { /* 页面已卸载，忽略 */ }
  }, 30);
}

module.exports = { animateNumber: animateNumber, spawnEffect: spawnEffect, applyPageEnter: applyPageEnter };
