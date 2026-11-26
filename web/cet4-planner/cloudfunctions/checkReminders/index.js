// 云函数：checkReminders · 每日定时扫描，推送"今日任务"订阅消息
// 部署：微信开发者工具 -> cloudfunctions/checkReminders 右键 -> 上传并部署（云端安装依赖）
// 前置：1) 云环境已建集合 cet4_sync（快照由小程序端云同步写入）
//       2) 在环境变量 TMPL_IDS 填入订阅消息模板ID（逗号分隔），
//          或直接改下方 TMPL_IDS 常量
//       3) 客户端 config.SUBSCRIBE_TMPL_IDS 填同一模板ID，用户打卡时完成订阅授权
var cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 若未配置环境变量，可在此硬编码模板ID
var FALLBACK_TMPL_IDS = [];

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function todayStr(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

exports.main = async function () {
  var db = cloud.database();
  var openid = cloud.getWXContext().OPENID;
  if (!openid) return { err: 'no openid' };

  // 1. 读取用户数据快照
  var snap;
  try {
    snap = (await db.collection('cet4_sync').doc('me').get()).data;
  } catch (e) {
    return { ok: true, skip: 'no snapshot' };
  }
  if (!snap) return { ok: true, skip: 'empty snapshot' };

  // 2. 算今天的待办任务与复习项
  var today = todayStr(new Date());
  var tasks = snap.tasks || [];
  var todayTasks = tasks.filter(function (t) {
    return t.planDate === today && t.status === 0;
  });
  if (!todayTasks.length) return { ok: true, skip: 'no pending tasks' };
  var reviewCount = todayTasks.filter(function (t) { return t.type === 'review'; }).length;

  // 3. 模板ID（环境变量优先）
  var ids = String(process.env.TMPL_IDS || '').split(',').filter(Boolean);
  if (!ids.length) ids = FALLBACK_TMPL_IDS;
  if (!ids.length) return { ok: true, skip: 'no template id' };

  // 4. 发送订阅消息
  // 注意：data 里的字段键（thing1/thing2...）必须与你选用的模板字段一一对应，
  // 在"订阅消息 -> 我的模板"里核对后按需调整。
  try {
    await cloud.openapi.subscribeMessage.send({
      touser: openid,
      templateId: ids[0],
      page: 'pages/today/today',
      data: {
        thing1: { value: '今日 ' + todayTasks.length + ' 个任务待完成' },
        thing2: {
          value: reviewCount > 0
            ? ('含复习 ' + reviewCount + ' 项，打开打卡')
            : ('距四级更近一步，打开打卡')
        }
      }
    });
  } catch (e) {
    // 用户未订阅/订阅次数用尽会走到这里，属正常，静默返回
    return { ok: false, err: String((e && e.errMsg) || e) };
  }
  return { ok: true, sent: todayTasks.length };
};
