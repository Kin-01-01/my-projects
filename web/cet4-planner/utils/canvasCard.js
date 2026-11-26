// 卡片绘制 + 数据聚合（不依赖 wx，纯函数，便于单测）
// 页面负责拿到 canvas 2D 上下文后调用这里的 draw*；导出/保存由 utils/canvasExport 处理。
// 设计约束：只画"进度/计划骨架"，不画任何题目、单词内容——守住"不内置题库"铁律。
var d = require('./date');

var INK = '#16203A';
var MUTED = '#9AA4B8';
var BLUE = '#5B8DEF';
var TEAL = '#36CFC9';
var LINE = '#EDF1F7';
var PURPLE = '#9B6CF2';

// 周报/月报数据：窗口 = 最近 n 天（含今天），同时附整体阶段完成度（全量，反映总进度）
function buildReportData(tasks, opts) {
  opts = opts || {};
  var range = opts.range === 'month' ? 'month' : 'week';
  var n = range === 'month' ? 30 : 7;
  var endDate = opts.endDate || d.todayStr();
  var start = d.addDays(endDate, -(n - 1));

  var inWindow = tasks.filter(function (t) {
    return t.planDate >= start && t.planDate <= endDate;
  });
  var done = inWindow.filter(function (t) { return t.status === 1; });
  var totalDone = done.length;
  var totalMinutes = done.reduce(function (s, t) { return s + (t.estMinutes || 0); }, 0);

  var days = [];
  for (var i = 0; i < n; i++) {
    var date = d.addDays(start, i);
    var mins = done.filter(function (t) { return t.planDate === date; })
      .reduce(function (s, t) { return s + (t.estMinutes || 0); }, 0);
    days.push({ date: date, label: date.slice(5).replace('-', '/'), mins: mins });
  }
  var maxMin = days.reduce(function (m, x) { return Math.max(m, x.mins); }, 0) || 1;

  var names = { basic: '基础', special: '专项', mock: '模考' };
  var stageStats = ['basic', 'special', 'mock'].map(function (k) {
    var list = tasks.filter(function (t) { return t.stage === k; });
    var sd = list.filter(function (t) { return t.status === 1; }).length;
    return {
      key: k, name: names[k],
      total: list.length, done: sd,
      pct: list.length ? Math.round(sd / list.length * 100) : 0
    };
  });

  return {
    range: range,
    start: start, end: endDate, n: n,
    totalDone: totalDone, totalMinutes: totalMinutes,
    days: days, maxMin: maxMin,
    stageStats: stageStats
  };
}

// 计划模板数据（纯计划骨架，不掺杂任何个人进度/数据）
function buildPlanTemplateData(plan108) {
  return {
    start: plan108.START,
    end: plan108.END,
    span: d.diffDays(plan108.START, plan108.END) + 1,
    target: 425,
    stages: [
      { name: '基础夯实期', range: plan108.START + ' ~ 2026-11-09', note: '词汇主线 + 听力适应 + 长难句拆解', color: BLUE },
      { name: '专项强化期', range: '2026-11-10 ~ 2026-11-30', note: '分题型刷提升篇，听力错率≤20%', color: TEAL },
      { name: '模考冲刺期', range: '2026-12-01 ~ ' + plan108.END, note: '完整模考 2 次 + 错题回炉保温', color: PURPLE }
    ]
  };
}

// 绘制周报/月报卡片（使用旧版 wx.createCanvasContext 上下文：setFillStyle/setFontSize/fillRect/fillText…）
function drawReportCard(ctx, W, H, data) {
  var pad = 40;
  ctx.setFillStyle('#FFFFFF'); ctx.fillRect(0, 0, W, H);
  ctx.setFillStyle(BLUE); ctx.fillRect(0, 0, W, 12);

  ctx.setTextAlign('left');
  ctx.setFillStyle(INK); ctx.setFontSize(40);
  ctx.fillText((data.range === 'month' ? '月报' : '周报') + ' · 学习复盘', pad, 78);
  ctx.setFillStyle(MUTED); ctx.setFontSize(24);
  ctx.fillText(data.start + ' ~ ' + data.end, pad, 116);

  ctx.setFillStyle(INK); ctx.setFontSize(30);
  ctx.fillText('完成 ' + data.totalDone + ' 项任务', pad, 178);
  ctx.fillText('累计 ' + data.totalMinutes + ' 分钟', pad + 320, 178);
  ctx.setFillStyle(MUTED); ctx.setFontSize(22);
  ctx.fillText('日均 ' + Math.round(data.totalMinutes / data.n) + ' 分钟', pad, 212);

  ctx.setFillStyle(LINE); ctx.fillRect(pad, 244, W - pad * 2, 2);

  var y = 296;
  ctx.setFillStyle(INK); ctx.setFontSize(28); ctx.setTextAlign('left');
  ctx.fillText('阶段完成度', pad, y);
  y += 24;
  data.stageStats.forEach(function (s) {
    y += 44;
    ctx.setFillStyle(INK); ctx.setFontSize(24); ctx.setTextAlign('left');
    ctx.fillText(s.name, pad, y);
    ctx.setFillStyle(MUTED); ctx.setTextAlign('right');
    ctx.fillText(s.done + '/' + s.total + '  ' + s.pct + '%', W - pad, y);
    ctx.setTextAlign('left');
    var bx = pad, bw = W - pad * 2, by = y + 12, bh = 12;
    ctx.setFillStyle('#E8EDF5'); ctx.fillRect(bx, by, bw, bh);
    if (s.pct > 0) {
      ctx.setFillStyle(BLUE); ctx.fillRect(bx, by, Math.round(bw * s.pct / 100), bh);
    }
  });

  y += 70;
  ctx.setFillStyle(INK); ctx.setFontSize(28); ctx.setTextAlign('left');
  ctx.fillText('每日学习分钟（近 ' + data.n + ' 天）', pad, y);
  y += 30;
  var chartH = data.range === 'month' ? 360 : 240;
  var bw2 = W - pad * 2;
  var slot = bw2 / data.days.length;
  var barW = Math.max(2, slot * 0.6);
  data.days.forEach(function (dd, i) {
    var h = Math.round(dd.mins / data.maxMin * chartH);
    var x = pad + i * slot + (slot - barW) / 2;
    ctx.setFillStyle(TEAL); ctx.fillRect(x, y + chartH - h, barW, h);
    if (i % Math.ceil(data.days.length / 7) === 0) {
      ctx.setFillStyle(MUTED); ctx.setFontSize(18); ctx.setTextAlign('center');
      ctx.fillText(dd.label, x + barW / 2, y + chartH + 22);
    }
  });
  ctx.setTextAlign('left');
  ctx.setFillStyle(LINE); ctx.fillRect(pad, y + chartH, bw2, 2);

  ctx.setFillStyle(MUTED); ctx.setFontSize(20); ctx.setTextAlign('left');
  ctx.fillText('备考规划师 · 仅记录你的进度，不含任何题目/词库', pad, H - 28);
}

// 绘制计划模板卡片
function drawPlanTemplateCard(ctx, W, H, data) {
  var pad = 40;
  ctx.setFillStyle('#FFFFFF'); ctx.fillRect(0, 0, W, H);
  ctx.setFillStyle(BLUE); ctx.fillRect(0, 0, W, 12);

  ctx.setTextAlign('left');
  ctx.setFillStyle(INK); ctx.setFontSize(40);
  ctx.fillText('四级 75 天备考计划', pad, 78);
  ctx.setFillStyle(MUTED); ctx.setFontSize(24);
  ctx.fillText(data.start + ' ~ ' + data.end + ' · 共 ' + data.span + ' 天', pad, 116);
  ctx.setFillStyle(INK); ctx.setFontSize(26);
  ctx.fillText('目标分 ' + data.target, pad, 160);

  ctx.setFillStyle(LINE); ctx.fillRect(pad, 190, W - pad * 2, 2);

  var y = 250;
  data.stages.forEach(function (s) {
    y += 96;
    ctx.setFillStyle(s.color); ctx.fillRect(pad, y - 60, 8, 70);
    ctx.setFillStyle(INK); ctx.setFontSize(30); ctx.setTextAlign('left');
    ctx.fillText(s.name, pad + 26, y - 32);
    ctx.setFillStyle(MUTED); ctx.setFontSize(22);
    ctx.fillText(s.range, pad + 26, y);
    ctx.setFillStyle('#6E7891'); ctx.setFontSize(20);
    ctx.fillText(s.note, pad + 26, y + 28);
  });

  ctx.setFillStyle(LINE); ctx.fillRect(pad, H - 92, W - pad * 2, 2);
  ctx.setFillStyle(MUTED); ctx.setFontSize(20); ctx.setTextAlign('left');
  ctx.fillText('备考规划师 · 计划模板（不含题目/词库）', pad, H - 52);
  ctx.fillText('任务指针来自你自己的材料，进度由本地记录', pad, H - 28);
}

module.exports = {
  buildReportData: buildReportData,
  buildPlanTemplateData: buildPlanTemplateData,
  drawReportCard: drawReportCard,
  drawPlanTemplateCard: drawPlanTemplateCard
};
