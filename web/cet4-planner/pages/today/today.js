// 今日页：倒计时 + 今日任务（勾选/顺延/自定义CRUD） + 进度环
// 交互：按压回弹 / 水波·爆散 / 成功勾选描边 / 数字滚动 / 卡片翻面 / 骨架 / 底部抽屉
var store = require('../../utils/store');
var engine = require('../../utils/engine');
var notify = require('../../utils/notify');
var anim = require('../../utils/anim');
var d = require('../../utils/date');

var TYPE_OPTIONS = ['词汇', '听力', '阅读', '写作', '翻译', '模考', '复盘/复习', '其他'];

Page({
  data: {
    countdown: '—',
    countNum: 0,
    countUnit: ' 天',
    examDate: '',
    targetScore: 500,
    stageName: '',
    weekNo: 0,
    milestone: '',
    todayCN: '',
    tasks: [],
    doneCount: 0,
    totalCount: 0,
    hasPlan: false,
    ringC: 326.726,                 // 进度环周长 = 2π·52
    ringOffset: 326.726,            // stroke-dashoffset，随完成度平滑过渡
    ringBump: false,               // 完成瞬间环轻微放大脉冲
    bannerShow: false,             // 完成进度提示横幅
    bannerText: '',
    _enter: 'fx-in',                // 页面切换过渡类
    // 交互状态
    loading: true,
    flipFlipped: false,
    drawerShow: false,
    ripplesGo: [],
    ripplesSave: [],
    ripplesAdd: [],
    tipFront: '把今天的听力精听放在你精力最好的时段，词汇用碎片时间反复过。',
    tipBack: '执行要点：① 听力先盲听再对照原文，生词进生词本；② 词汇用「不背单词」反遗忘复习；③ 卡住就顺延，别轻易断签。',
    // 自定义任务抽屉
    editId: '',
    form: { title: '', contentRef: '' },
    minutes: '20',
    typeIndex: 7,
    typeOptions: TYPE_OPTIONS
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    anim.applyPageEnter(this);     // 页面切换淡入上移
    this.setData({ loading: true });
    var self = this;
    // 骨架加载：尺寸与内容一致，短暂停留后呈现真实内容
    setTimeout(function () { self.refresh(); self.setData({ loading: false }); }, 420);
  },

  refresh: function () {
    var p = store.getProfile();
    if (!p) {
      wx.redirectTo({ url: '/pages/wizard/wizard' });
      return;
    }
    var today = d.todayStr();
    var cd = d.diffDays(today, p.examDate);
    var all = store.getTasks();
    var tasks = all.filter(function (t) { return t.planDate === today; })
      .map(function (t) {
        var badge = (typeof t.count === 'number' && t.count !== null) ? (t.count + (t.unit || '')) : '';
        var split = (t.newCount || t.reviewCount) ? ('新' + t.newCount + '/复习' + t.reviewCount) : '';
        var q = (t.qtypes && t.qtypes.length) ? t.qtypes.join('/') : '';
        return Object.assign({}, t, {
          typeName: engine.TYPE_NAMES[t.type] || '任务',
          badge: badge,                 // 数量徽标：50词 / 8题 / 1篇
          splitText: split,            // 新词/复习拆分
          qtypeText: q,                // 题型：长对话/仔细阅读
          srcText: t.contentRef || ''  // 来源材料指针
        });
      });
    var doneCount = tasks.filter(function (t) { return t.status === 1; }).length;
    var pct = tasks.length ? Math.round(doneCount / tasks.length * 100) : 0;
    // 阶段名：今天有任务时直接取任务的阶段（与日历/进度页一致，避免与《10.8启动计划》的
    // 阶段切分错位——计划专项期从 11.10 起、模考期 12.01 起，而通用的 stageOf 公式按考试日倒推，
    // 会在 11.10–11.11、11.30 这几天的"页头阶段"与当天任务对不上）；无任务时才用通用公式兜底。
    var stageKey = tasks.length ? tasks[0].stage : engine.stageOf(today, engine.stages(p.examDate));
    var weekNo = cd > 0 ? Math.min(12, Math.floor(d.diffDays(today, p.examDate) / 7) + 1) : 0;

    // 数字滚动：倒计时天数、今日完成数，缓慢减速平稳停稳
    var fromCount = (typeof this._prevCount === 'number') ? this._prevCount : 0;
    var fromDone = (typeof this._prevDone === 'number') ? this._prevDone : 0;
    this._prevCount = cd > 0 ? cd : 0;
    this._prevDone = doneCount;
    anim.animateNumber(this, 'countNum', fromCount, cd > 0 ? cd : 0, 650);
    anim.animateNumber(this, 'doneCount', fromDone, doneCount, 550);

    // 计划已生成但今天没任务：多半是"还没到启动日"（如 10.8 才开始），
    // 明确说出来，避免被误读成"今天休息/保温"
    var startHint = '';
    if (tasks.length === 0 && all.length > 0) {
      var future = all
        .filter(function (t) { return t.planDate > today; })
        .map(function (t) { return t.planDate; })
        .sort();
      if (future.length) {
        var nd = future[0];
        startHint = '计划自 ' + nd.slice(5).replace('-', '月') + '日启动，还有 ' +
          d.diffDays(today, nd) + ' 天 · 今天不排任务';
      }
    }

    this.setData({
      examDate: p.examDate,
      targetScore: p.targetScore || 500,
      stageName: engine.STAGE_NAMES[stageKey],
      weekNo: weekNo,
      milestone: this.milestone(cd),
      todayCN: d.todayCN(today),
      tasks: tasks,
      totalCount: tasks.length,
      hasPlan: all.length > 0,
      startHint: startHint,
      ringOffset: this.data.ringC * (1 - pct / 100)
    });
  },

  milestone: function (cd) {
    if (cd < 0) return '';
    if (cd === 0) return '就是今天，带好准考证、身份证、听力设备，稳住';
    if (cd <= 3) return '考前保温：停新题新词，只回炉错题';
    if (cd <= 12) return '模考冲刺期 · 准考证 12-01 起可打印';
    if (cd <= 18) return '专项突破期 · 分题型各个击破';
    return '';
  },

  goWizard: function () {
    wx.navigateTo({ url: '/pages/wizard/wizard' });
  },

  /* ---------- 卡片翻面 ---------- */
  onFlip: function () {
    this.setData({ flipFlipped: !this.data.flipFlipped });
  },

  /* ---------- 水波 / 爆散 ---------- */
  onRippleGo: function (e) { anim.spawnEffect(this, e, 'btn-go', 'ripplesGo', 'ripple'); },
  onRippleAdd: function (e) { anim.spawnEffect(this, e, 'btn-add', 'ripplesAdd', 'ripple'); },
  onRippleSave: function (e) { anim.spawnEffect(this, e, 'btn-save', 'ripplesSave', 'burst'); },

  /* ---------- 打卡 / 顺延 ---------- */
  onToggle: function (e) {
    var id = e.currentTarget.dataset.id;
    var t = store.getTask(id);
    if (!t) return;
    var done = t.status !== 1;
    store.updateTask(id, { status: done ? 1 : 0, completedAt: done ? Date.now() : null });
    if (done) {
      engine.afterComplete(t);
      // 仅在用户开启"每日提醒"时才请求订阅（让开关名副其实）；默认关闭则不打扰
      var profile = store.getProfile();
      if (profile && profile.reminder) notify.requestSubscribe();
    }
    this.refresh();
    // 完成瞬间：进度环脉冲 + 进度提示横幅
    if (done) {
      // 直接用存储里的当天任务计算，避免动画(setData 异步)把 doneCount 延迟一帧导致横幅数字差一
      var todayStr2 = d.todayStr();
      var dayTasks = store.getTasks().filter(function (t) { return t.planDate === todayStr2; });
      var dayDone = dayTasks.filter(function (t) { return t.status === 1; }).length;
      var dayTotal = dayTasks.length;
      var left = dayTotal - dayDone;
      var pct = dayTotal ? Math.round(dayDone / dayTotal * 100) : 0;
      var txt = left > 0 ? ('今日进度 ' + pct + '% · 还差 ' + left + ' 项') : '今日任务全部完成，稳！';
      var self = this;
      this.setData({ bannerText: txt, bannerShow: true, ringBump: true });
      if (this._bannerT) clearTimeout(this._bannerT);
      this._bannerT = setTimeout(function () {
        self.setData({ bannerShow: false, ringBump: false });
      }, 1600);
    }
  },

  onPostpone: function (e) {
    var t = store.getTask(e.currentTarget.dataset.id);
    if (!t) return;
    engine.postpone(t);
    wx.showToast({ title: '已顺延到明天', icon: 'none' });
    this.refresh();
  },

  /* ---------- 底部抽屉：自定义任务 ---------- */
  openCreate: function () {
    this.setData({
      drawerShow: true, editId: '',
      form: { title: '', contentRef: '' },
      minutes: '20', typeIndex: 7
    });
  },
  openEdit: function (e) {
    var id = e.currentTarget.dataset.id;
    var t = store.getTask(id);
    if (!t) return;
    this.setData({
      drawerShow: true, editId: id,
      form: { title: t.title, contentRef: t.contentRef || '' },
      minutes: String(t.estMinutes),
      typeIndex: Math.max(0, engine.TYPE_KEYS.indexOf(t.type))
    });
  },
  closeDrawer: function () {
    this.setData({ drawerShow: false, editId: '' });
  },

  onTitleInput: function (e) { this.setData({ 'form.title': e.detail.value }); },
  onRefInput: function (e) { this.setData({ 'form.contentRef': e.detail.value }); },
  onMinutesInput: function (e) { this.setData({ minutes: e.detail.value }); },
  onTypeChange: function (e) { this.setData({ typeIndex: Number(e.detail.value) }); },

  onSaveTask: function () {
    var title = (this.data.form.title || '').trim();
    if (!title) {
      wx.showToast({ title: '标题不能为空', icon: 'none' });
      return;
    }
    var mins = parseInt(this.data.minutes, 10);
    if (!(mins > 0)) mins = 20;
    var type = engine.TYPE_KEYS[this.data.typeIndex] || 'other';

    if (this.data.editId) {
      store.updateTask(this.data.editId, {
        title: title, type: type, estMinutes: mins, contentRef: this.data.form.contentRef
      });
    } else {
      var p = store.getProfile();
      var today = d.todayStr();
      // 防御：正常情况下走到这里必有档案（refresh 会先重定向到向导）；缺失时降级为基础期
      var stage = (p && p.examDate) ? engine.stageOf(today, engine.stages(p.examDate)) : 'basic';
      store.addTask({
        id: 'm' + Date.now(),
        title: title, type: type,
        contentRef: this.data.form.contentRef,
        planDate: today, estMinutes: mins,
        status: 0, stage: stage, source: 'manual', createdAt: Date.now()
      });
    }
    this.setData({ drawerShow: false, editId: '' });
    this.refresh();
  },

  onDeleteTask: function () {
    if (!this.data.editId) return;
    var self = this;
    wx.showModal({
      title: '删除任务',
      content: '确定删除该任务？删除后不可恢复。',
      success: function (r) {
        if (r.confirm) {
          store.removeTask(self.data.editId);
          self.setData({ drawerShow: false, editId: '' });
          self.refresh();
        }
      }
    });
  }
});
