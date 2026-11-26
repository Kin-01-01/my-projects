#!/usr/bin/env node
'use strict';

/**
 * 零度栈 · GitHub 周榜自动采集
 * ------------------------------------------------------------
 * 每周（GitHub Actions 周一 00:00 UTC）调用 GitHub Search API，
 * 拉取指定 Topic（可叠加语言）下 star 最高的前 N 个项目，计算相对
 * 上周的 star 变化，写入仓库根目录 leaderboard-data.json。
 * 站点 leaderboard.html 直接读取该 JSON 渲染，无需客户端调用 API，
 * 从而避免限流、保证稳定展示。
 *
 * 采集与展示逻辑（明确如下）：
 *   1. 采集：Actions 定时触发本脚本 -> GitHub Search API（sort=stars）拉前 N 项
 *   2. 计算：与最近一份历史快照逐仓库对比 star，得出 new/up/down/flat 周变化
 *   3. 落库：整份快照追加进 history，并写入 leaderboard-data.json（meta+current+history）
 *   4. 展示：leaderboard.html 读取该 JSON，按周次/语言/关键词筛选并渲染卡片
 *
 * 配置（环境变量，均可选；前缀 LEADERBOARD_ 避免与系统 LANG 冲突）：
 *   LEADERBOARD_TOPIC   统计主题，默认 machine-learning
 *   LEADERBOARD_LANG    叠加语言过滤，例如 Python（留空表示不限）
 *   LEADERBOARD_COUNT   取前几名，默认 10
 *   GITHUB_TOKEN        令牌（可选，提升速率上限；不填也能跑一次）
 *
 * 运行：node index.js
 * 输出：../leaderboard-data.json（meta + current + history）
 */

const fs = require('fs');
const path = require('path');

const __dir = __dirname;
const DATA_FILE = path.resolve(__dir, '..', 'leaderboard-data.json');

const TOPIC = process.env.LEADERBOARD_TOPIC || 'machine-learning';
const LANG = process.env.LEADERBOARD_LANG || '';
const COUNT = parseInt(process.env.LEADERBOARD_COUNT || '10', 10);
const TOKEN = process.env.GITHUB_TOKEN || '';

function log(...a) { console.log('[leaderboard]', ...a); }

/** 构造 GitHub 搜索查询 */
function buildQuery() {
  let q = 'topic:' + TOPIC;
  if (LANG) q += ' language:' + LANG;
  return q;
}

/** 调用 GitHub Search API */
async function fetchTopRepos() {
  const q = buildQuery();
  const url = new URL('https://api.github.com/search/repositories');
  url.searchParams.set('q', q);
  url.searchParams.set('sort', 'stars');
  url.searchParams.set('order', 'desc');
  url.searchParams.set('per_page', String(COUNT));

  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'zero-stack-leaderboard',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (TOKEN) headers['Authorization'] = 'Bearer ' + TOKEN;

  log('查询：', q);
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error('GitHub API ' + res.status + ' ' + res.statusText + ' | ' + body.slice(0, 300));
  }
  const data = await res.json();
  if (!data.items || !data.items.length) {
    throw new Error('未返回任何仓库，检查 TOPIC 是否正确：' + q);
  }
  return data.items.slice(0, COUNT);
}

/** 把 API 返回压成轻量快照条目 */
function toItem(repo, rank) {
  return {
    rank,
    name: repo.name,
    fullName: repo.full_name,
    owner: repo.owner ? repo.owner.login : '',
    ownerUrl: repo.owner ? repo.owner.html_url : '',
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    language: repo.language || '',
    description: repo.description || '',
    url: repo.html_url
  };
}

/** 读取已有数据文件（不存在则全新开始） */
function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const obj = JSON.parse(raw);
    if (obj && Array.isArray(obj.history)) return obj;
  } catch (e) { /* 首次运行无文件 */ }
  return { meta: null, current: null, history: [] };
}

/** 计算周变化（对比上一份快照） */
function computeDeltas(items, prev) {
  const prevMap = {};
  if (prev && prev.items) prev.items.forEach(it => { prevMap[it.fullName] = it.stars; });
  return items.map(it => {
    const before = prevMap[it.fullName];
    if (before === undefined) return { type: 'new', value: it.stars };
    const d = it.stars - before;
    return { type: d > 0 ? 'up' : (d < 0 ? 'down' : 'flat'), value: d };
  });
}

function fmtNum(n) { return Number(n).toLocaleString('en-US'); }

async function main() {
  const now = new Date();
  const week = now.toISOString().slice(0, 10); // YYYY-MM-DD 作为周次标识
  const items = await fetchTopRepos();
  const ranked = items.map((r, i) => toItem(r, i + 1));

  const data = loadData();
  const history = Array.isArray(data.history) ? data.history : [];
  const prev = history.length ? history[history.length - 1] : (data.current || null);
  const deltas = computeDeltas(ranked, prev);

  // 把 delta 合并进 items，前端可直接渲染
  const itemsWithDelta = ranked.map((it, i) => ({ ...it, delta: deltas[i] }));

  const snapshot = {
    week,
    fetchedAt: now.toISOString(),
    query: buildQuery(),
    lang: LANG,
    topic: TOPIC,
    items: itemsWithDelta
  };

  const out = {
    meta: {
      topic: TOPIC,
      lang: LANG,
      count: COUNT,
      query: buildQuery(),
      generatedAt: now.toISOString(),
      week
    },
    current: snapshot,
    history: history.concat(snapshot)
  };

  fs.writeFileSync(DATA_FILE, JSON.stringify(out, null, 2), 'utf8');
  log('已写入 leaderboard-data.json（共 ' + out.history.length + ' 份历史快照）');
  log('本周 #1：' + ranked[0].fullName + ' · ' + fmtNum(ranked[0].stars) + ' stars');
}

main().catch(err => {
  console.error('[leaderboard] 失败：', err.message);
  process.exit(1);
});
