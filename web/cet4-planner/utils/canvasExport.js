// 画布导出（依赖 wx，仅在调用时用到；require 本模块不会触碰 wx，可被测试安全引入）
// 统一两处功能（周报/月报导出、计划模板分享）的"渲染 -> 临时文件 -> 存相册/分享"流程。

function getDpr() {
  try {
    if (wx.getWindowInfo) return wx.getWindowInfo().pixelRatio || 2;
    if (wx.getSystemInfoSync) return wx.getSystemInfoSync().pixelRatio || 2;
  } catch (e) { /* 老基础库兜底 */ }
  return 2;
}

// 用旧版 canvas 2D 上下文把 draw(ctx,W,H) 渲染到指定 canvasId，返回临时文件路径（Promise）
// 注：旧版 createCanvasContext 在画布被移出屏幕（offscreen）时仍可被 canvasToTempFilePath 读取，稳定可靠。
function renderToTemp(opts) {
  return new Promise(function (resolve, reject) {
    var ctx;
    try {
      ctx = wx.createCanvasContext(opts.canvasId);
    } catch (e) {
      reject(e); return;
    }
    try {
      opts.draw(ctx, opts.width, opts.height);
    } catch (e) {
      reject(e); return;
    }
    ctx.draw(false, function () {
      var dpr = getDpr();
      wx.canvasToTempFilePath({
        canvasId: opts.canvasId,
        x: 0, y: 0, width: opts.width, height: opts.height,
        destWidth: Math.round(opts.width * dpr),
        destHeight: Math.round(opts.height * dpr),
        success: function (r) { resolve(r.tempFilePath); },
        fail: function (e) { reject(e); }
      });
    });
  });
}

// 保存图片到相册，处理授权：被拒绝时引导去设置
function saveToAlbum(filePath) {
  return new Promise(function (resolve, reject) {
    wx.saveImageToPhotosAlbum({
      filePath: filePath,
      success: function () { resolve(filePath); },
      fail: function (err) {
        var msg = (err && err.errMsg) || '';
        if (/auth\s*deny|authorize|permission/i.test(msg)) {
          wx.showModal({
            title: '需要相册权限',
            content: '请在设置中允许"保存到相册"后重试',
            confirmText: '去设置',
            success: function (r) { if (r.confirm) wx.openSetting(); }
          });
        }
        reject(err);
      }
    });
  });
}

module.exports = { renderToTemp: renderToTemp, saveToAlbum: saveToAlbum, getDpr: getDpr };
