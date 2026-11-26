/**
 * 云函数 syncData —— 刷题数据云端备份
 *
 * 设计要点：
 *   1. 按 storage key 拆文档存，避免云数据库单文档 1MB 上限（内置题库整包约 750KB，会顶到上限）。
 *   2. 文档 _id 用 md5(openid|key)，天然唯一，可 safe upsert。
 *   3. 所有读写都以云函数拿到的 OPENID 为作用域，前端传什么 openid 都无效。
 *   4. 同时更新 marxquiz_users 的活跃时间与汇总数据，供管理端统计。
 *
 * action：
 *   pull  -> { ok, keys: {k: v}, updatedAt, count }
 *   push  -> { ok, written }       入参 { docs: [{k, v, updatedAt}], summary, nickname }
 *   info  -> { ok, count }
 */
'use strict';

const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const DOCS = 'marxquiz_docs';
const USERS = 'marxquiz_users';

/** 单次 push 最多接收条数，避免超时 */
const MAX_DOCS = 40;
/** 分页拉取每页条数 */
const PAGE = 100;
/** 保险上限，防止异常数据把云函数拖死 */
const MAX_TOTAL = 2000;

/** 集合是否已确认存在（云函数实例内缓存，避免每次调用都尝试创建） */
let collectionsReady = false;

/**
 * 确保集合存在。云开发不会在首次写入时自动建集合，缺集合会直接报错。
 * createCollection 是幂等的：已存在时会抛错，忽略即可。
 * 若因权限原因创建失败，也不阻断后续流程，由调用方报错提示。
 */
async function ensureCollections() {
  if (collectionsReady) return;
  collectionsReady = true;
  try {
    await db.createCollection(DOCS);
  } catch (e) {
    // 集合已存在，正常
  }
  try {
    await db.createCollection(USERS);
  } catch (e) {
    // 集合已存在，正常
  }
}

/**
 * 生成文档 _id：md5(openid|key)，32 位十六进制，符合云开发 _id 长度限制。
 * @param {string} openid
 * @param {string} key
 * @return {string}
 */
function docId(openid, key) {
  return crypto.createHash('md5').update(openid + '|' + key).digest('hex');
}

/**
 * 拉取当前用户全部备份文档。
 * @param {string} openid
 */
async function pull(openid) {
  const all = [];
  let skip = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await db.collection(DOCS)
      .where({ _openid: openid })
      .skip(skip)
      .limit(PAGE)
      .get();
    const list = (res && res.data) || [];
    for (let i = 0; i < list.length; i += 1) all.push(list[i]);
    if (list.length < PAGE) break;
    skip += PAGE;
    if (skip >= MAX_TOTAL) break;
  }

  const keys = {};
  let updatedAt = 0;
  for (let i = 0; i < all.length; i += 1) {
    const d = all[i];
    if (!d || typeof d.k !== 'string') continue;
    keys[d.k] = d.v;
    const t = Number(d.updatedAt) || 0;
    if (t > updatedAt) updatedAt = t;
  }

  // 顺带把昵称带回去：换手机时无需重新设置
  let nickname = '';
  try {
    const u = await db.collection(USERS).where({ _openid: openid }).limit(1).get();
    if (u.data && u.data.length) nickname = String(u.data[0].nickname || '');
  } catch (e) {
    // 用户集合不存在或查询失败，忽略即可
  }

  return { ok: true, keys: keys, updatedAt: updatedAt, count: all.length, nickname: nickname };
}

/**
 * 更新（或创建）用户档案，用于管理端统计。
 * 统计失败不影响数据备份主流程。
 * @param {string} openid
 * @param {Object} summary
 *
 * 注意：昵称不在这里写。昵称属于 UGC，必须经过 setNickname 云函数的
 * security.msgSecCheck 才允许落库，从同步通道写入会绕过内容安全检查。
 */
async function touchUser(openid, summary) {
  try {
    const now = Date.now();
    const q = await db.collection(USERS).where({ _openid: openid }).limit(1).get();
    const hasSummary = summary && typeof summary === 'object';

    if (q.data && q.data.length) {
      const patch = { lastActiveAt: now, updatedAt: now };
      if (hasSummary) {
        patch.banks = Number(summary.banks) || 0;
        patch.questions = Number(summary.questions) || 0;
        patch.answered = Number(summary.answered) || 0;
        patch.correct = Number(summary.correct) || 0;
      }
      // 昵称只由 setNickname 云函数写入（需过内容安全），这里不覆盖
      await db.collection(USERS).doc(q.data[0]._id).update({ data: patch });
      return;
    }

    await db.collection(USERS).add({
      data: {
        _openid: openid,
        nickname: '',
        createdAt: now,
        lastActiveAt: now,
        updatedAt: now,
        banks: hasSummary ? Number(summary.banks) || 0 : 0,
        questions: hasSummary ? Number(summary.questions) || 0 : 0,
        answered: hasSummary ? Number(summary.answered) || 0 : 0,
        correct: hasSummary ? Number(summary.correct) || 0 : 0,
      },
    });
  } catch (e) {
    // 用户档案写失败不该让备份失败
    console.warn('touchUser failed:', e && (e.message || e));
  }
}

/** 并发写入的批次大小。云函数默认超时 3 秒，串行写 36 条会吃满超时 */
const CONCURRENCY = 12;

/**
 * 写入单条备份文档（upsert）。
 * @param {string} id
 * @param {Object} payload
 * @param {string} key
 * @return {Promise<boolean>}
 */
async function writeOne(id, payload, key) {
  try {
    // 服务端 doc().set() 具备 upsert 语义：不存在则创建
    await db.collection(DOCS).doc(id).set({ data: payload });
    return true;
  } catch (e1) {
    try {
      await db.collection(DOCS).add({ data: Object.assign({ _id: id }, payload) });
      return true;
    } catch (e2) {
      console.warn('push doc failed:', key, e2 && (e2.message || e2));
      return false;
    }
  }
}

/**
 * 推送（upsert）备份文档。
 * 分批并发，避免串行写入撑爆云函数超时。
 * @param {string} openid
 * @param {Object} event
 */
async function push(openid, event) {
  const raw = Array.isArray(event.docs) ? event.docs : [];
  const docs = raw.slice(0, MAX_DOCS);
  let written = 0;

  const items = [];
  for (let i = 0; i < docs.length; i += 1) {
    const d = docs[i];
    if (!d) continue;
    const k = String(d.k || '');
    // 只接受业务前缀，内部快照 key（qb:__xxx）不参与同步
    if (k.indexOf('qb:') !== 0 || k.indexOf('qb:__') === 0) continue;
    if (d.v === null || d.v === undefined) continue;

    items.push({
      id: docId(openid, k),
      key: k,
      payload: {
        _openid: openid,
        k: k,
        v: d.v,
        updatedAt: Number(d.updatedAt) || Date.now(),
      },
    });
  }

  for (let i = 0; i < items.length; i += CONCURRENCY) {
    const batch = items.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((it) => writeOne(it.id, it.payload, it.key))
    );
    for (let j = 0; j < results.length; j += 1) {
      if (results[j]) written += 1;
    }
  }

  await touchUser(openid, event.summary);
  return { ok: true, written: written };
}

exports.main = async (event) => {
  const ctx = cloud.getWXContext();
  const openid = ctx && ctx.OPENID;
  if (!openid) return { ok: false, msg: '无法识别用户身份' };

  const action = String((event && event.action) || 'pull');

  try {
    await ensureCollections();
    if (action === 'pull') return await pull(openid);
    if (action === 'push') return await push(openid, event || {});
    if (action === 'info') {
      const res = await db.collection(DOCS).where({ _openid: openid }).count();
      return { ok: true, count: (res && res.total) || 0 };
    }
    return { ok: false, msg: '未知操作：' + action };
  } catch (e) {
    console.error('syncData error:', e);
    return { ok: false, msg: (e && (e.message || e.errMsg)) || '云端处理失败' };
  }
};
