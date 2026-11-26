// 我的页：考试设置 + 偏好(弹性开关/液态滑块) + 材料索引 + 快捷绑定 + 汉堡菜单
// 交互：按压回弹 / 水波 / 弹性开关 / 液态滑块 / 汉堡转叉
var store = require('../../utils/store');
var engine = require('../../utils/engine');
var anim = require('../../utils/anim');
var notify = require('../../utils/notify');
var d = require('../../utils/date');

var HOUR_OPTIONS = [6, 8, 10, 12, 14];
var TARGET_OPTIONS = [425, 450, 500, 550, 600];
var IMPORT_TYPES = ['词汇', '听力', '阅读', '写作', '翻译', '真题', '网课', '其他'];
var SLIDER_MIN = 30, SLIDER_MAX = 180, SLIDER_STEP = 5;

Page({
  data: {
    examDate: '',
    hoursIndex: 1,
    targetIndex: 2,
    hourOptions: HOUR_OPTIONS,
    targetOptions: TARGET_OPTIONS,
    importTypes: IMPORT_TYPES,
    importTypeIndex: 0,
    newName: '',
    newSource: '',
    imports: [],
    // 交互状态
    burgerOpen: false,
    switchOn: false,
    dailyMin: 90,
    sliderPct: 46,
    ripplesProfile: [],
    ripplesRegen: [],
    ripplesAdd: [],
    ripplesBind1: [],
    ripplesBind2: [],
    _enter: 'fx-in'
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 4 });
    }
    anim.applyPageEnter(this);
    var p = store.getProfile();
    var dailyMin = (p && typeof p.dailyMin === 'number') ? p.dailyMin : 90;
    this.setData({
      examDate: p ? p.examDate : '',
      hoursIndex: Math.max(0, HOUR_OPTIONS.indexOf(p ? p.weeklyHours : 8)),
      targetIndex: Math.max(0, TARGET_OPTIONS.indexOf(p ? p.targetScore : 500)),
      imports: store.getImports(),
      switchOn: !!(p && p.reminder),
      dailyMin: dailyMin,
      sliderPct: Math.round((dailyMin - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN) * 100)
    });
  },

  /* ---------- 汉堡转叉 ---------- */
  onBurger: function () { this.setData({ burgerOpen: !this.data.burgerOpen }); },
  goAbout: function () { this.setData({ burgerOpen: false }); },

  /* ---------- 弹性开关 ---------- */
  onToggleSwitch: function () {
    var on = !this.data.switchOn;
    this.setData({ switchOn: on });
    var p = store.getProfile() || {};
    store.saveProfile(Object.assign({}, p, { reminder: on }));
    // 开启"每日提醒"时，借这次点击手势顺手申请订阅授权（微信要求必须在用户手势内触发）；
    // 之后每次打卡若仍开启，today 页会再请求以补充可发送次数。关闭则不再申请、云函数也不会推送。
    if (on) notify.requestSubscribe();
  },

  /* ---------- 液态滑块 ---------- */
  _sliderValFromX: function (clientX) {
    var rect = this._sliderRect;
    if (!rect) return this.data.dailyMin;
    var ratio = (clientX - rect.left) / rect.width;
    ratio = Math.max(0, Math.min(1, ratio));
    var val = Math.round(ratio * (SLIDER_MAX - SLIDER_MIN) / SLIDER_STEP) * SLIDER_STEP + SLIDER_MIN;
    return Math.max(SLIDER_MIN, Math.min(SLIDER_MAX, val));
  },
  onSliderStart: function (e) {
    var self = this;
    var q = wx.createSelectorQuery().in(this);
    q.select('#slider').boundingClientRect(function (rect) {
      self._sliderRect = rect;
      self._applySlider(e);
    }).exec();
  },
  onSliderMove: function (e) { this._applySlider(e); },
  onSliderEnd: function () {
    var p = store.getProfile() || {};
    store.saveProfile(Object.assign({}, p, { dailyMin: this.data.dailyMin }));
  },
  _applySlider: function (e) {
    var t = (e.touches && e.touches[0]) ? e.touches[0]
      : ((e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null);
    if (!t) return;
    var val = this._sliderValFromX(t.clientX);
    var pct = Math.round((val - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN) * 100);
    this.setData({ dailyMin: val, sliderPct: pct });
  },

  /* ---------- 水波 ---------- */
  onRippleProfile: function (e) { anim.spawnEffect(this, e, 'btn-save-profile', 'ripplesProfile', 'ripple'); },
  onRippleRegen: function (e) { anim.spawnEffect(this, e, 'btn-regen', 'ripplesRegen', 'ripple'); },
  onRippleAdd: function (e) { anim.spawnEffect(this, e, 'btn-add', 'ripplesAdd', 'ripple'); },

  // 重新生成规划：清除"规划生成"的任务（手动添加的保留），按当前考试日期重排
  // 入口放在设置区：改完考试日期，随手就能重排，不用去「规划」页底部找
  onRegenerate: function () {
    var p = store.getProfile();
    if (!p) {
      wx.showToast({ title: '请先保存考试信息', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '重新生成规划',
      content: '将清除当前"规划生成"的任务（手动添加的保留），按最新设置重排。继续？',
      success: function (r) {
        if (!r.confirm) return;
        var res = engine.regeneratePlan(p);
        // 用弹窗而非 toast：toast 放不下"计划自 10.8 起启动"这类关键信息
        wx.showModal({
          title: '已生成 ' + res.tasks.length + ' 个任务',
          content: res.note,
          showCancel: false
        });
      }
    });
  },
  onRippleBind1: function (e) { anim.spawnEffect(this, e, 'btn-bind1', 'ripplesBind1', 'ripple'); },
  onRippleBind2: function (e) { anim.spawnEffect(this, e, 'btn-bind2', 'ripplesBind2', 'ripple'); },

  /* ---------- 考试设置 ---------- */
  onDateChange: function (e) { this.setData({ examDate: e.detail.value }); },
  onHoursChange: function (e) { this.setData({ hoursIndex: Number(e.detail.value) }); },
  onTargetChange: function (e) { this.setData({ targetIndex: Number(e.detail.value) }); },

  onSaveProfile: function () {
    var examDate = this.data.examDate;
    if (!examDate) {
      wx.showToast({ title: '请先选择考试日期', icon: 'none' });
      return;
    }
    if (d.diffDays(d.todayStr(), examDate) <= 0) {
      wx.showToast({ title: '考试日期必须晚于今天', icon: 'none' });
      return;
    }
    var p = store.getProfile() || {};
    store.saveProfile(Object.assign({}, p, {
      examDate: examDate,
      weeklyHours: HOUR_OPTIONS[this.data.hoursIndex],
      targetScore: TARGET_OPTIONS[this.data.targetIndex],
      reminder: this.data.switchOn,
      dailyMin: this.data.dailyMin
    }));
    wx.showToast({ title: '已保存（重排点上方"重新生成规划"）', icon: 'none' });
  },

  /* ---------- 材料索引 ---------- */
  onImportTypeChange: function (e) { this.setData({ importTypeIndex: Number(e.detail.value) }); },
  onNewName: function (e) { this.setData({ newName: e.detail.value }); },
  onNewSource: function (e) { this.setData({ newSource: e.detail.value }); },

  onAddImport: function () {
    var name = (this.data.newName || '').trim();
    if (!name) {
      wx.showToast({ title: '请填材料名称', icon: 'none' });
      return;
    }
    store.addImport({
      name: name,
      type: IMPORT_TYPES[this.data.importTypeIndex],
      source: (this.data.newSource || '').trim()
    });
    this.setData({ newName: '', newSource: '', imports: store.getImports() });
    wx.showToast({ title: '已登记', icon: 'none' });
  },

  onDeleteImport: function (e) {
    var self = this;
    wx.showModal({
      title: '删除材料索引',
      content: '仅删除索引记录，不影响你的原始材料。',
      success: function (r) {
        if (r.confirm) {
          store.removeImport(e.currentTarget.dataset.id);
          self.setData({ imports: store.getImports() });
        }
      }
    });
  },

  /* ---------- 快捷绑定 ---------- */
  onBindLessons: function () {
    var self = this;
    wx.showModal({
      title: '绑定刘晓燕48课',
      content: '把课程编号（U1L1–U12L4，仅编号指针）按日期顺序绑到规划中的词汇任务，先清旧绑定。继续？',
      success: function (r) {
        if (!r.confirm) return;
        var res = engine.bindLiuXiaoYanLessons();
        var msg;
        if (res.bound === 0) {
          msg = '当前计划的词汇任务已自带课程编号指针（如 刘晓燕48课 U3L2），无需重绑；如需调整请在"今日"页手动改内容引用。';
        } else {
          msg = '已绑定 ' + res.bound + ' 课。';
          if (res.unbound.length) {
            msg += '\n词汇任务不够，剩 ' + res.unbound.length + ' 课（' +
              res.unbound[0] + ' 至 ' + res.unbound[res.unbound.length - 1] +
              '）请在"今日"页手动加词汇任务再绑一次。';
          }
        }
        wx.showModal({ title: '绑定完成', content: msg, showCancel: false });
        self.setData({ imports: store.getImports() });
      }
    });
  },

  onBindKaoya: function () {
    var self = this;
    wx.showModal({
      title: '绑定烤鸭TV听力课',
      content: '按细化计划表排期绑定：W1 主课 → W2–W3 八天训练营 → W4 起真题解析 → 专项期华研分项。可重复执行。继续？',
      success: function (r) {
        if (!r.confirm) return;
        var res = engine.bindKaoyaTVCourses();
        var msg = res.bound === 0
          ? '当前计划的听力任务已自带课程/网课指针，无需重绑；如需调整请在"今日"页手动改内容引用。'
          : '已按周排期绑定 ' + res.bound + ' 个听力任务。到"今日/日历"页即可看到每天该听哪节课。';
        wx.showModal({
          title: '绑定完成',
          content: msg,
          showCancel: false
        });
        self.setData({ imports: store.getImports() });
      }
    });
  },

  /* ---------- 危险操作 ---------- */
  onClearAll: function () {
    var self = this;
    wx.showModal({
      title: '清空全部数据',
      content: '将删除考试设置、全部任务和材料索引，不可恢复。确定？',
      confirmColor: '#E5746B',
      success: function (r) {
        if (r.confirm) {
          store.clearAll();
          wx.redirectTo({ url: '/pages/wizard/wizard' });
        }
      }
    });
  }
});
