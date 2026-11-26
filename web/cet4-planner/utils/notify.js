// 订阅消息（可选）：打卡完成时请求订阅；每日推送由云函数 checkReminders 负责
// 启用条件：config.SUBSCRIBE_TMPL_IDS 填入你在"微信公众平台 -> 订阅消息"申请的模板ID
var config = require('../config');

// 必须在用户点击手势内调用（微信限制），放在"打卡完成"动作里触发最自然
function requestSubscribe() {
  var ids = config.SUBSCRIBE_TMPL_IDS || [];
  if (!ids.length || !wx.requestSubscribeMessage) return;
  wx.requestSubscribeMessage({
    tmplIds: ids,
    // 用户拒绝订阅属正常选择，静默处理，不弹错误
    fail: function () {}
  });
}

module.exports = {
  requestSubscribe: requestSubscribe
};
