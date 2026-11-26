/**
 * pages/import/import.js —— 导入题库
 * 支持：粘贴导入 / 从聊天选文件 / 内置示例题库
 */
'use strict';

var store = require('../../utils/store.js');
var parser = require('../../utils/parser.js');
var util = require('../../utils/util.js');
var theme = require('../../utils/theme.js');
var sample = require('../../utils/sample.js');

Page({
  data: {
    // 首帧就跟随已保存的主题偏好，避免深夜模式下闪白
    themeClass: theme.themeClass(),
    themeIcon: theme.themeIcon(),
    themeSetting: 'auto',

    tab: 'paste', // paste | file | sample
    rawText: '',
    fileName: '',
    bankName: '',

    preview: [],
    counts: { single: 0, multiple: 0, judge: 0, fill: 0 },
    total: 0,
    formatText: '',
    errors: [],
    parsed: false,
    hasContent: false,
    sampleLoaded: false,
  },

  onLoad: function () {
    // 页面模块可能在上次换肤前就已加载，实例化后立刻校正一次
    this.applyTheme();
    var self = this;
    this._questions = [];
    this._unwatchTheme = theme.watchSystemTheme(function () {
      self.applyTheme();
    });
    this._debouncedParse = util.debounce(function () {
      self.doParse();
    }, 300);
  },

  onShow: function () {
    this.applyTheme();
  },

  onUnload: function () {
    if (this._debouncedParse && this._debouncedParse.cancel) this._debouncedParse.cancel();
    if (this._unwatchTheme) {
      this._unwatchTheme();
      this._unwatchTheme = null;
    }
  },

  /**
   * 应用当前主题。
   */
  applyTheme: function () {
    theme.bindPageTheme(this);
  },

  /**
   * 切换 Tab。
   * @param {Object} e
   */
  onTabChange: function (e) {
    var tab = e.currentTarget.dataset.tab;
    if (!tab || tab === this.data.tab) return;
    this.setData({ tab: tab });
  },

  /**
   * 粘贴区输入（防抖 300ms 解析）。
   * @param {Object} e
   */
  onTextInput: function (e) {
    var value = e.detail.value || '';
    this.setData({ rawText: value });
    this._debouncedParse();
  },

  /**
   * 题库名输入。
   * @param {Object} e
   */
  onNameInput: function (e) {
    this.setData({ bankName: e.detail.value || '' });
  },

  /**
   * 读取剪贴板。
   */
  onReadClipboard: function () {
    var self = this;
    wx.getClipboardData({
      success: function (res) {
        var data = res && res.data ? String(res.data) : '';
        if (!data.trim()) {
          wx.showToast({ title: '剪贴板是空的', icon: 'none' });
          return;
        }
        self.setData({ rawText: data, fileName: '剪贴板内容', tab: 'paste' });
        self.doParse();
      },
      fail: function () {
        wx.showModal({ title: '读取失败', content: '无法读取剪贴板，请检查是否授予了权限。', showCancel: false });
      },
    });
  },

  /**
   * 从聊天记录选择文件。
   */
  onChooseFile: function () {
    var self = this;
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json', 'txt', 'csv'],
      success: function (res) {
        var file = res && res.tempFiles && res.tempFiles[0];
        if (!file) return;
        var name = String(file.name || file.path || '');
        var ext = name.toLowerCase().split('.').pop();
        if (['json', 'txt', 'csv'].indexOf(ext) < 0) {
          wx.showModal({
            title: '暂不支持该格式',
            content: '小程序内只能直接读取 .json / .txt / .csv 文件。\nExcel(.xlsx) 和 Word(.docx) 请先在电脑上用 tools/convert.py 转成 .json 再发送过来。',
            showCancel: false,
          });
          return;
        }
        var content = '';
        try {
          var fs = wx.getFileSystemManager();
          content = fs.readFileSync(file.path, 'utf8');
        } catch (err) {
          wx.showModal({
            title: '读取失败',
            content: '无法读取该文件。请确认文件是 UTF-8 编码的纯文本，或改用「粘贴导入」。',
            showCancel: false,
          });
          return;
        }
        if (!String(content).trim()) {
          wx.showToast({ title: '文件内容为空', icon: 'none' });
          return;
        }
        self.setData({ rawText: content, fileName: name, tab: 'paste' });
        self.doParse();
      },
      fail: function () {},
    });
  },

  /**
   * 加载内置示例题库。
   */
  onLoadSample: function () {
    var questions = sample.questions || [];
    var counts = { single: 0, multiple: 0, judge: 0, fill: 0 };
    for (var i = 0; i < questions.length; i++) {
      if (counts[questions[i].type] !== undefined) counts[questions[i].type] += 1;
    }
    var preview = [];
    for (var j = 0; j < questions.length && j < 3; j++) {
      preview.push({
        no: j + 1,
        typeLabel: util.typeLabel(questions[j].type),
        stem: util.truncate(questions[j].stem, 40),
        answerText: util.formatAnswer(questions[j]),
      });
    }
    this._questions = questions.slice();
    this.setData({
      tab: 'sample',
      sampleLoaded: true,
      bankName: sample.name,
      preview: preview,
      counts: counts,
      total: questions.length,
      formatText: '内置示例',
      errors: [],
      parsed: true,
      hasContent: true,
    });
  },

  /**
   * 解析当前文本内容。
   */
  doParse: function () {
    var text = this.data.rawText;
    if (!String(text).trim()) {
      this._questions = [];
      this.setData({
        parsed: false,
        preview: [],
        total: 0,
        counts: { single: 0, multiple: 0, judge: 0, fill: 0 },
        errors: [],
        formatText: '',
        hasContent: false,
        sampleLoaded: false,
      });
      return;
    }

    var res = parser.parse(text);
    var counts = { single: 0, multiple: 0, judge: 0, fill: 0 };
    for (var i = 0; i < res.questions.length; i++) {
      var t = res.questions[i].type;
      if (counts[t] !== undefined) counts[t] += 1;
    }

    var preview = [];
    for (var j = 0; j < res.questions.length && j < 3; j++) {
      preview.push({
        no: j + 1,
        typeLabel: util.typeLabel(res.questions[j].type),
        stem: util.truncate(res.questions[j].stem, 40),
        answerText: util.formatAnswer(res.questions[j]),
      });
    }

    this._questions = res.questions;

    var patch = {
      parsed: res.ok,
      preview: preview,
      total: res.questions.length,
      counts: counts,
      errors: res.errors || [],
      formatText: res.format === 'json' ? 'JSON' : (res.format === 'csv' ? 'CSV 表格' : 'TXT 文本'),
      hasContent: true,
      sampleLoaded: false,
    };
    if (!String(this.data.bankName || '').trim() && res.name) {
      patch.bankName = res.name;
    }
    this.setData(patch);
  },

  /**
   * 清空当前内容。
   */
  onClear: function () {
    this._questions = [];
    this.setData({
      rawText: '',
      fileName: '',
      bankName: '',
      preview: [],
      total: 0,
      counts: { single: 0, multiple: 0, judge: 0, fill: 0 },
      errors: [],
      formatText: '',
      parsed: false,
      hasContent: false,
      sampleLoaded: false,
    });
  },

  /**
   * 确认导入。
   */
  onConfirmImport: function () {
    var questions = this._questions || [];
    if (!questions.length) {
      wx.showToast({ title: '还没有可导入的题目', icon: 'none' });
      return;
    }

    var fallback = '导入题库 ' + util.formatShortDate(Date.now());
    var name = String(this.data.bankName || '').trim() || fallback;

    var list = store.listBanks();
    var exists = null;
    for (var i = 0; i < list.length; i++) {
      if (list[i].name === name) {
        exists = list[i];
        break;
      }
    }

    var self = this;
    if (exists) {
      wx.showModal({
        title: '题库名重复',
        content: '已存在同名题库「' + name + '」。\n「覆盖」会替换原题库（原进度与错题会丢失）；「新建副本」会另存一份。',
        confirmText: '覆盖',
        cancelText: '新建副本',
        success: function (res) {
          if (res.confirm) {
            store.removeBank(exists.id);
            self.doSave(name);
          } else {
            self.doSave(name + ' 副本');
          }
        },
      });
      return;
    }

    this.doSave(name);
  },

  /**
   * 真正执行保存。
   * @param {string} name
   */
  doSave: function (name) {
    var bank = store.saveBank(name, this._questions || []);
    if (!bank) {
      wx.showModal({
        title: '导入失败',
        content: store.getLastError() || '保存失败，请重试',
        showCancel: false,
      });
      return;
    }
    wx.showToast({ title: '已导入 ' + bank.count + ' 题', icon: 'success' });
    setTimeout(function () {
      wx.navigateBack({ delta: 1 });
    }, 700);
  },
});
