/**
 * pages/practice/practice.js —— 刷题 / 模拟考试
 * 参数：bankId、mode（order | random | wrong | exam）
 */
'use strict';

var store = require('../../utils/store.js');
var util = require('../../utils/util.js');
var theme = require('../../utils/theme.js');

var EXAM_SECONDS = 60 * 60;

var MODE_LABEL = {
  order: '顺序刷题',
  random: '随机刷题',
  wrong: '只刷错题',
  exam: '模拟考试',
};

Page({
  data: {
    // 首帧就跟随已保存的主题偏好，避免深夜模式下闪白
    themeClass: theme.themeClass(),
    themeIcon: theme.themeIcon(),
    themeSetting: 'auto',

    ready: false,
    bankId: '',
    bankName: '',
    mode: 'order',
    modeLabel: '',
    isExam: false,

    total: 0,
    index: 0,
    q: null,
    typeLabel: '',
    optionStates: [],
    selected: [],
    fillInput: '',
    submitted: false,
    isCorrect: false,
    isFav: false,
    correctAnswerText: '',

    progressPercent: 0,
    answeredCount: 0,
    isLast: false,

    cardVisible: false,
    cardCells: [],

    timeText: '60:00',
    timeLow: false,

    emptyTip: '',
    tipText: '',
  },

  onLoad: function (options) {
    // 页面模块可能在上次换肤前就已加载，实例化后立刻校正一次
    this.applyTheme();
    var opts = options || {};
    var bankId = opts.bankId || '';
    var mode = opts.mode || 'order';

    this._bankId = bankId;
    this._mode = mode;
    this._order = [];
    this._ids = [];
    this._answers = {};
    this._correct = {};
    this._favIds = [];
    this._startedAt = Date.now();
    this._timeLeft = EXAM_SECONDS;
    this._timer = null;
    this._autoNextTimer = null;
    this._finished = false;
    this._destroyed = false;

    var self = this;
    this._unwatchTheme = theme.watchSystemTheme(function () {
      self.applyTheme();
    });

    var bank = store.getBank(bankId);
    if (!bank) {
      this.setData({ ready: true, emptyTip: '题库不存在，可能已经被删除了' });
      return;
    }

    var all = store.getQuestions(bankId) || [];
    if (!all.length) {
      this.setData({ ready: true, bankName: bank.name, emptyTip: '这个题库里还没有题目' });
      return;
    }

    this._all = all;
    this._favIds = store.getFav(bankId);

    this.setData({
      bankId: bankId,
      bankName: bank.name,
      mode: mode,
      modeLabel: MODE_LABEL[mode] || '顺序刷题',
      isExam: mode === 'exam',
      timeText: util.formatClock(EXAM_SECONDS),
    });

    var progress = store.getProgress(bankId);
    var canResume = progress && progress.mode === mode && progress.index > 0 &&
      Array.isArray(progress.order) && progress.order.length > 0;

    if (canResume) {
      wx.showModal({
        title: '继续上次进度？',
        content: '上次练到第 ' + (progress.index + 1) + ' 题。可以继续上次进度，也可以重新开始。',
        confirmText: '继续',
        cancelText: '重新开始',
        success: function (res) {
          if (res.confirm) {
            self.startWithProgress(progress);
          } else {
            store.clearProgress(bankId);
            self.startFresh();
          }
        },
        fail: function () {
          self.startFresh();
        },
      });
      return;
    }

    this.startFresh();
  },

  onShow: function () {
    this.applyTheme();
  },

  onUnload: function () {
    this._destroyed = true;
    this.clearAutoNext();
    this.stopTimer();
    if (this._unwatchTheme) {
      this._unwatchTheme();
      this._unwatchTheme = null;
    }
    if (!this._finished) this.persist();
  },

  /**
   * 应用当前主题。
   */
  applyTheme: function () {
    theme.bindPageTheme(this);
  },

  /* ---------------------------------------------------------------- */
  /* 启动                                                              */
  /* ---------------------------------------------------------------- */

  /**
   * 重新开始（按模式生成题目顺序）。
   */
  startFresh: function () {
    if (this._destroyed) return;
    var list = (this._all || []).slice();

    if (this._mode === 'random') {
      list = util.shuffle(list);
    } else if (this._mode === 'wrong') {
      var wrongList = store.getWrong(this._bankId);
      var set = {};
      for (var i = 0; i < wrongList.length; i++) set[wrongList[i].questionId] = true;
      var filtered = [];
      for (var j = 0; j < list.length; j++) {
        if (set[list[j].id]) filtered.push(list[j]);
      }
      list = filtered;
      if (!list.length) {
        this.setData({ ready: true, emptyTip: '这个题库还没有错题，先去完整刷一遍吧' });
        return;
      }
    }

    this._order = list;
    this._ids = [];
    for (var k = 0; k < list.length; k++) this._ids.push(list[k].id);
    this._answers = {};
    this._correct = {};
    this._startedAt = Date.now();
    this._timeLeft = EXAM_SECONDS;

    this.setData({
      ready: true,
      total: list.length,
      index: 0,
      timeText: util.formatClock(EXAM_SECONDS),
      timeLow: false,
      emptyTip: '',
    });

    this.renderQuestion(0);

    if (this.data.isExam) this.startTimer();
    this.persist();
  },

  /**
   * 恢复上次进度。
   * @param {Object} progress
   */
  startWithProgress: function (progress) {
    if (this._destroyed) return;
    var map = {};
    var all = this._all || [];
    for (var i = 0; i < all.length; i++) map[all[i].id] = all[i];

    var list = [];
    var ids = [];
    var order = Array.isArray(progress.order) ? progress.order : [];
    for (var j = 0; j < order.length; j++) {
      if (map[order[j]]) {
        list.push(map[order[j]]);
        ids.push(order[j]);
      }
    }

    if (!list.length) {
      store.clearProgress(this._bankId);
      this.startFresh();
      return;
    }

    this._order = list;
    this._ids = ids;
    this._answers = {};
    this._correct = {};

    var answers = progress.answers && typeof progress.answers === 'object' ? progress.answers : {};
    var answerKeys = Object.keys(answers);
    for (var k = 0; k < answerKeys.length; k++) {
      this._answers[answerKeys[k]] = answers[answerKeys[k]];
    }
    for (var m = 0; m < list.length; m++) {
      var qid = list[m].id;
      if (Object.prototype.hasOwnProperty.call(this._answers, qid)) {
        this._correct[qid] = util.gradeAnswer(list[m], this._answers[qid]);
      }
    }

    this._startedAt = Number(progress.startedAt) || Date.now();
    var idx = Math.min(Math.max(Number(progress.index) || 0, 0), list.length - 1);

    this.setData({
      ready: true,
      total: list.length,
      index: idx,
      emptyTip: '',
    });

    if (this.data.isExam) {
      var elapsed = Math.floor((Date.now() - this._startedAt) / 1000);
      this._timeLeft = Math.max(0, EXAM_SECONDS - elapsed);
      this.updateTimerText();
      this.startTimer();
    }

    this.renderQuestion(idx);
    this.persist();
  },

  /* ---------------------------------------------------------------- */
  /* 渲染                                                              */
  /* ---------------------------------------------------------------- */

  /**
   * 渲染指定下标的题目。
   * @param {number} i
   */
  renderQuestion: function (i) {
    if (!this._order || !this._order[i]) return;
    var q = this._order[i];
    var hasAnswer = Object.prototype.hasOwnProperty.call(this._answers, q.id);
    var isExam = this.data.isExam === true;
    var reveal = hasAnswer && !isExam;
    var answer = hasAnswer ? this._answers[q.id] : null;

    var selected = [];
    if (q.type === 'multiple') {
      selected = Array.isArray(answer) ? answer.slice() : [];
    } else if (q.type !== 'fill' && typeof answer === 'string' && answer) {
      selected = [answer];
    }

    var total = this._order.length;
    this.setData({
      index: i,
      q: q,
      typeLabel: util.typeLabel(q.type),
      optionStates: this.buildOptionStates(q, answer, reveal),
      selected: selected,
      fillInput: q.type === 'fill' && typeof answer === 'string' ? answer : '',
      submitted: reveal,
      isCorrect: hasAnswer ? this._correct[q.id] === true : false,
      correctAnswerText: reveal ? util.formatAnswer(q) : '',
      isFav: (this._favIds || []).indexOf(q.id) >= 0,
      progressPercent: total ? Math.round((i + 1) / total * 100) : 0,
      answeredCount: this.countAnswered(),
      isLast: i === total - 1,
      tipText: '',
    });

    this.refreshCard();
  },

  /**
   * 生成选项渲染状态。
   * @param {Object} q
   * @param {*} userAnswer
   * @param {boolean} reveal 是否展示对错
   * @return {Array<Object>}
   */
  buildOptionStates: function (q, userAnswer, reveal) {
    var opts = Array.isArray(q.options) ? q.options : [];
    var isMulti = q.type === 'multiple';
    var picked = [];
    if (isMulti) {
      picked = Array.isArray(userAnswer) ? userAnswer : [];
    } else if (typeof userAnswer === 'string' && userAnswer) {
      picked = [userAnswer];
    }
    var correctKeys = [];
    if (isMulti) correctKeys = Array.isArray(q.answer) ? q.answer : [];
    else correctKeys = q.answer ? [String(q.answer)] : [];

    var out = [];
    for (var i = 0; i < opts.length; i++) {
      var key = String(opts[i].key);
      var isPicked = picked.indexOf(key) >= 0;
      var isRight = correctKeys.indexOf(key) >= 0;
      var state = '';
      if (reveal) {
        if (isRight) state = 'correct';
        else if (isPicked) state = 'wrong';
      } else if (isPicked) {
        state = 'selected';
      }
      out.push({ key: key, text: opts[i].text, state: state, cls: state ? 'opt-' + state : '' });
    }
    return out;
  },

  /**
   * 刷新答题卡。
   */
  refreshCard: function () {
    if (!this._order) return;
    var cells = [];
    var isExam = this.data.isExam === true;
    for (var i = 0; i < this._order.length; i++) {
      var qid = this._order[i].id;
      var hasAnswer = Object.prototype.hasOwnProperty.call(this._answers, qid);
      var status = 'un';
      if (hasAnswer) {
        if (isExam) status = 'an';
        else status = this._correct[qid] ? 'ok' : 'bad';
      }
      cells.push({ no: i + 1, status: status });
    }
    this.setData({ cardCells: cells, answeredCount: this.countAnswered() });
  },

  /**
   * 已答题数。
   * @return {number}
   */
  countAnswered: function () {
    return Object.keys(this._answers || {}).length;
  },

  /* ---------------------------------------------------------------- */
  /* 交互                                                              */
  /* ---------------------------------------------------------------- */

  /**
   * 点选项。
   * @param {Object} e
   */
  onOptionTap: function (e) {
    var key = e.currentTarget.dataset.key;
    var q = this.data.q;
    if (!q || this.data.submitted) return;
    if (!key) return;

    if (q.type === 'multiple') {
      var selected = (this.data.selected || []).slice();
      var pos = selected.indexOf(key);
      if (pos >= 0) selected.splice(pos, 1);
      else selected.push(key);
      selected.sort();
      this.setData({
        selected: selected,
        optionStates: this.buildOptionStates(q, selected, false),
      });
    } else {
      this.setData({
        selected: [key],
        optionStates: this.buildOptionStates(q, key, false),
      });
    }
  },

  /**
   * 填空题输入。
   * @param {Object} e
   */
  onFillInput: function (e) {
    this.setData({ fillInput: e.detail.value || '' });
  },

  /**
   * 提交当前题。
   */
  onSubmit: function () {
    var q = this.data.q;
    if (!q || this.data.submitted) return;

    var userAnswer;
    if (q.type === 'fill') {
      var v = String(this.data.fillInput || '').trim();
      if (!v) {
        wx.showToast({ title: '请先填写答案', icon: 'none' });
        return;
      }
      userAnswer = v;
    } else {
      var selected = this.data.selected || [];
      if (!selected.length) {
        wx.showToast({ title: '请先选择答案', icon: 'none' });
        return;
      }
      userAnswer = q.type === 'multiple' ? selected.slice().sort() : selected[0];
    }

    var ok = util.gradeAnswer(q, userAnswer);
    this._answers[q.id] = userAnswer;
    this._correct[q.id] = ok;

    store.bumpStat(this._bankId, ok);
    store.markPracticed(this._bankId);
    if (ok) {
      if (this._mode === 'wrong') store.removeWrong(this._bankId, q.id);
    } else {
      store.addWrong(this._bankId, q.id);
    }

    // 模拟考试：不展示对错与解析，直接进入下一题
    if (this.data.isExam) {
      this.persist();
      if (this.data.index >= this._order.length - 1) {
        this.finish();
      } else {
        this.renderQuestion(this.data.index + 1);
      }
      return;
    }

    this.setData({
      submitted: true,
      isCorrect: ok,
      optionStates: this.buildOptionStates(q, userAnswer, true),
      correctAnswerText: util.formatAnswer(q),
      answeredCount: this.countAnswered(),
      tipText: '',
    });
    this.refreshCard();
    this.persist();
    this.maybeAutoNext(ok);
  },

  /**
   * 答对后的自动跳题。
   * @param {boolean} ok
   */
  maybeAutoNext: function (ok) {
    if (!ok) return;
    if (this.data.isExam) return;

    var settings = store.getSettings();
    if (!settings.autoNext) return;

    if (this.data.isLast) {
      this.setData({ tipText: '已是最后一题，可以交卷' });
      return;
    }

    var self = this;
    this.setData({ tipText: '答对，即将进入下一题' });
    this.clearAutoNext();
    this._autoNextTimer = setTimeout(function () {
      self._autoNextTimer = null;
      if (self._destroyed) return;
      // 额外防御：答题卡正开着时不要切题（clearTimeout 后正常不会走到这里）
      if (self.data.cardVisible) return;
      if (self.data.submitted !== true) return;
      self.onNext();
    }, settings.autoNextDelay);
  },

  /**
   * 清除自动跳题定时器。
   */
  clearAutoNext: function () {
    if (this._autoNextTimer) {
      clearTimeout(this._autoNextTimer);
      this._autoNextTimer = null;
    }
  },

  /**
   * 下一题。
   */
  onNext: function () {
    this.clearAutoNext();
    if (!this._order) return;
    if (this.data.index >= this._order.length - 1) {
      this.finish();
      return;
    }
    this.renderQuestion(this.data.index + 1);
    this.persist();
  },

  /**
   * 上一题。
   */
  onPrev: function () {
    this.clearAutoNext();
    if (!this._order) return;
    if (this.data.index <= 0) return;
    this.renderQuestion(this.data.index - 1);
    this.persist();
  },

  /**
   * 收藏 / 取消收藏。
   */
  onToggleFav: function () {
    var q = this.data.q;
    if (!q) return;
    var isFav = store.toggleFav(this._bankId, q.id);
    this._favIds = store.getFav(this._bankId);
    this.setData({ isFav: isFav });
    wx.showToast({ title: isFav ? '已收藏' : '已取消收藏', icon: 'none' });
  },

  /**
   * 打开答题卡。
   *
   * 若此时正好排着「答对自动跳题」的定时器，先取消掉，
   * 否则题目会在答题卡背后被切走，用户看到网格突变。
   */
  onOpenCard: function () {
    this.clearAutoNext();
    this.refreshCard();
    this.setData({ cardVisible: true });
  },

  /**
   * 关闭答题卡。
   */
  onCloseCard: function () {
    this.setData({ cardVisible: false });
  },

  /**
   * 阻止答题卡内容区点击穿透。
   */
  onSheetTap: function () {},

  /**
   * 答题卡跳题。
   * @param {Object} e
   */
  onCellTap: function (e) {
    var idx = Number(e.currentTarget.dataset.index);
    if (isNaN(idx) || idx < 0 || !this._order || idx >= this._order.length) return;
    this.clearAutoNext();
    this.setData({ cardVisible: false });
    this.renderQuestion(idx);
    this.persist();
  },

  /**
   * 模拟考试提前交卷。
   */
  onTapExamSubmit: function () {
    var self = this;
    var unanswered = this._order ? this._order.length - this.countAnswered() : 0;
    wx.showModal({
      title: '确认交卷',
      content: unanswered > 0
        ? ('还有 ' + unanswered + ' 题未作答，未作答的题会算作答错。确定交卷吗？')
        : '确定交卷吗？交卷后可以看到全部解析。',
      confirmText: '交卷',
      success: function (res) {
        if (res.confirm) self.finish();
      },
    });
  },

  /**
   * 结束并生成结果。
   */
  finish: function () {
    if (this._finished) return;
    this._finished = true;
    this.clearAutoNext();
    this.stopTimer();

    var order = this._order || [];
    var items = [];
    var correctCount = 0;
    var unanswered = 0;

    for (var i = 0; i < order.length; i++) {
      var q = order[i];
      var hasAnswer = Object.prototype.hasOwnProperty.call(this._answers, q.id);
      var userAnswer = hasAnswer ? this._answers[q.id] : '';
      var ok = hasAnswer ? this._correct[q.id] === true : false;
      if (!hasAnswer) unanswered += 1;
      if (ok) correctCount += 1;
      items.push({
        id: q.id,
        type: q.type,
        typeLabel: util.typeLabel(q.type),
        stem: q.stem,
        analysis: q.analysis || '',
        userAnswerText: hasAnswer ? util.formatUserAnswer(q, userAnswer) : '未作答',
        correctAnswerText: util.formatAnswer(q),
        isCorrect: ok,
      });
    }

    var total = order.length;
    var payload = {
      bankId: this._bankId,
      bankName: this.data.bankName,
      mode: this._mode,
      modeLabel: this.data.modeLabel,
      isExam: this.data.isExam === true,
      total: total,
      correctCount: correctCount,
      wrongCount: total - correctCount,
      unanswered: unanswered,
      durationSec: Math.max(0, Math.floor((Date.now() - this._startedAt) / 1000)),
      submittedAt: Date.now(),
      items: items,
    };

    store.setLastResult(payload);
    store.clearProgress(this._bankId);

    wx.redirectTo({ url: '/pages/result/result' });
  },

  /* ---------------------------------------------------------------- */
  /* 计时器                                                            */
  /* ---------------------------------------------------------------- */

  /**
   * 启动考试倒计时。
   */
  startTimer: function () {
    this.stopTimer();
    if (typeof this._timeLeft !== 'number' || isNaN(this._timeLeft)) this._timeLeft = EXAM_SECONDS;
    this.updateTimerText();
    var self = this;
    this._timer = setInterval(function () {
      if (self._destroyed) {
        self.stopTimer();
        return;
      }
      self._timeLeft -= 1;
      if (self._timeLeft <= 0) {
        self._timeLeft = 0;
        self.updateTimerText();
        self.stopTimer();
        wx.showToast({ title: '考试时间到，自动交卷', icon: 'none', duration: 1500 });
        setTimeout(function () {
          if (self._destroyed) return;
          self.finish();
        }, 600);
        return;
      }
      self.updateTimerText();
    }, 1000);
  },

  /**
   * 停止倒计时。
   */
  stopTimer: function () {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  },

  /**
   * 刷新倒计时文案。
   */
  updateTimerText: function () {
    var t = Math.max(0, Number(this._timeLeft) || 0);
    this.setData({
      timeText: util.formatClock(t),
      timeLow: t <= 300,
    });
  },

  /* ---------------------------------------------------------------- */
  /* 进度                                                              */
  /* ---------------------------------------------------------------- */

  /**
   * 保存练习进度。
   */
  persist: function () {
    if (this._finished) return;
    if (!this._bankId || !this._ids || !this._ids.length) return;
    store.saveProgress(this._bankId, {
      mode: this._mode,
      order: this._ids,
      index: this.data.index,
      answers: this._answers,
      startedAt: this._startedAt,
    });
  },
});
