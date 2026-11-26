/**
 * 云函数 adminStats —— 管理端总览
 *
 * 只有白名单内的 openid 能调用。云函数默认拥有全库读写权限，
 * 所以客户端安全规则保持「仅创建者可读写」不变，管理员靠这里读全量。
 *
 * 首次部署时白名单可能不准：无权限时返回调用者自己的 openid，
 * 用它替换下面的 ADMIN_OPENIDS 重新部署即可（openid 只对本人有意义，不构成泄露）。
 *
 * 出参：
 *   { ok, totalUsers, totalAnswered, totalCorrect, todayActive, updatedAt,
 *     users: [{ nickname, banks, questions, answered, correct, lastActiveAt }] }
 */
'use strict';

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const USERS = 'marxquiz_users';

/**
 * 管理员 openid 白名单。
 * 首次不确定时先留空部署，调用一次拿到自己的 openid 再填进来。
 */
const ADMIN_OPENIDS = [
  // 小程序运行时实际 openid（开发者工具模拟器）
  'oasnkxfVzdbCUjVOGRMHnzNl818s',
  // 开发者工具登录账号的 openid（兜底）
  'o6zAJs76UwJ4s3NUe6UcIFlYpgk4',
];

const PAGE = 100;
const MAX_TOTAL = 5000;

/** 集合是否已确认存在（云函数实例内缓存） */
let usersReady = false;

/**
 * 确保用户集合存在，避免首次查询直接报错。
 */
async function ensureUsers() {
  if (usersReady) return;
  usersReady = true;
  try {
    await db.createCollection(USERS);
  } catch (e) {
    // 已存在，正常
  }
}

/**
 * 今天 0 点（北京时间 UTC+8）的时间戳。
 * @return {number}
 */
function todayStart() {
  const offset = 8 * 3600 * 1000;
  const beijingNow = Date.now() + offset;
  const dayStart = beijingNow - (beijingNow % 86400000);
  return dayStart - offset;
}

exports.main = async () => {
  const ctx = cloud.getWXContext();
  const openid = ctx && ctx.OPENID;

  if (ADMIN_OPENIDS.indexOf(openid) === -1) {
    return {
      ok: false,
      msg: '没有管理权限',
      // 便于管理员第一次确认自己的 openid
      yourOpenid: openid || '',
    };
  }

  try {
    await ensureUsers();
    const all = [];
    let skip = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = await db.collection(USERS)
        .orderBy('lastActiveAt', 'desc')
        .skip(skip)
        .limit(PAGE)
        .get();
      const list = (res && res.data) || [];
      for (let i = 0; i < list.length; i += 1) all.push(list[i]);
      if (list.length < PAGE) break;
      skip += PAGE;
      if (skip >= MAX_TOTAL) break;
    }

    const start = todayStart();
    let totalAnswered = 0;
    let totalCorrect = 0;
    let todayActive = 0;
    const users = [];

    for (let i = 0; i < all.length; i += 1) {
      const u = all[i];
      const answered = Number(u.answered) || 0;
      const correct = Number(u.correct) || 0;
      const lastActiveAt = Number(u.lastActiveAt) || 0;

      totalAnswered += answered;
      totalCorrect += correct;
      if (lastActiveAt >= start) todayActive += 1;

      users.push({
        nickname: String(u.nickname || ''),
        banks: Number(u.banks) || 0,
        questions: Number(u.questions) || 0,
        answered: answered,
        correct: correct,
        lastActiveAt: lastActiveAt,
      });
    }

    return {
      ok: true,
      totalUsers: all.length,
      totalAnswered: totalAnswered,
      totalCorrect: totalCorrect,
      todayActive: todayActive,
      updatedAt: Date.now(),
      users: users,
    };
  } catch (e) {
    console.error('adminStats error:', e);
    return { ok: false, msg: (e && (e.message || e.errMsg)) || '读取统计失败' };
  }
};
