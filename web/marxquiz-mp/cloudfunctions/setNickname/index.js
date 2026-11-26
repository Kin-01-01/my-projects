/**
 * 云函数 setNickname —— 保存用户昵称
 *
 * 为什么需要云函数：
 *   1. openid 只能在服务端拿到，用户档案必须按 openid 落库；
 *   2. 昵称属于用户生成内容（UGC），必须过 security.msgSecCheck，否则有被下架的风险。
 *
 * 入参：{ nickname: string }
 * 出参：{ ok, nickname } 或 { ok:false, msg }
 */
'use strict';

const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const USERS = 'marxquiz_users';

const MIN_LEN = 1;
const MAX_LEN = 12;

/** 集合是否已确认存在（云函数实例内缓存） */
let usersReady = false;

/**
 * 确保用户集合存在（云开发不会自动建集合）。
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
 * 清洗昵称：去换行/制表符，压缩连续空格，去首尾空白。
 * @param {*} s
 * @return {string}
 */
function clean(s) {
  let str = String(s === undefined || s === null ? '' : s);
  str = str.replace(/[\r\n\t]/g, ' ').replace(/\s{2,}/g, ' ');
  return str.trim();
}

/**
 * 内容安全检测。
 * 返回 true 表示通过；false 表示命中违规。
 * 接口异常（未开通/超时）不阻断，避免整个功能不可用。
 * @param {string} content
 * @return {Promise<boolean>}
 */
async function secCheck(content) {
  try {
    const res = await cloud.openapi.security.msgSecCheck({ content: content });
    if (res && typeof res.errCode === 'number' && res.errCode !== 0) {
      return false;
    }
    return true;
  } catch (e) {
    const code = e && (e.errCode || e.errcode);
    if (String(code) === '87014') return false;
    console.warn('msgSecCheck unavailable:', e && (e.message || e));
    return true;
  }
}

exports.main = async (event) => {
  const ctx = cloud.getWXContext();
  const openid = ctx && ctx.OPENID;
  if (!openid) return { ok: false, msg: '无法识别用户身份' };

  const nickname = clean(event && event.nickname).slice(0, MAX_LEN);
  if (nickname.length < MIN_LEN) return { ok: false, msg: '昵称不能为空' };
  // 至少要有一个中文、字母、数字或下划线，避免纯符号/纯 emoji
  if (!/[\u4e00-\u9fa5A-Za-z0-9_]/.test(nickname)) {
    return { ok: false, msg: '昵称需要包含中文、字母或数字' };
  }

  const safe = await secCheck(nickname);
  if (!safe) return { ok: false, msg: '昵称包含违规内容，换一个吧' };

  try {
    await ensureUsers();
    const now = Date.now();
    const q = await db.collection(USERS).where({ _openid: openid }).limit(1).get();

    if (q.data && q.data.length) {
      await db.collection(USERS).doc(q.data[0]._id).update({
        data: { nickname: nickname, updatedAt: now, lastActiveAt: now },
      });
    } else {
      await db.collection(USERS).add({
        data: {
          _openid: openid,
          nickname: nickname,
          createdAt: now,
          lastActiveAt: now,
          updatedAt: now,
          banks: 0,
          questions: 0,
          answered: 0,
          correct: 0,
        },
      });
    }

    return { ok: true, nickname: nickname };
  } catch (e) {
    console.error('setNickname error:', e);
    return { ok: false, msg: (e && (e.message || e.errMsg)) || '保存失败，请重试' };
  }
};
