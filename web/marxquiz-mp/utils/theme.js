/**
 * utils/theme.js
 * 主题（白昼 / 深夜 / 跟随系统）的读写与导航栏应用。
 *
 * 存储：key = 'app:theme'，值 'light' | 'dark' | 'auto'
 *      读写统一经 utils/store.js 的 getThemePref / setThemePref，
 *      本文件不直接调用 wx.*StorageSync（存储层唯一入口是 store.js）。
 * 说明：CSS 变量定义在 app.wxss 的 .page.theme-light / .page.theme-dark 中，
 *      页面根节点写 <view class="page {{themeClass}}"> 即可整体换肤。
 */

'use strict';

var store = require('./store.js');

var THEME_KEY = 'app:theme';
var THEMES = ['light', 'dark', 'auto'];

/** 导航栏配色（JS 侧常量，与 WXSS 变量解耦）
 *  设计：导航栏与页面同色，视觉上"消失"，只留文字 —— 更干净、留白更足 */
var NAV_COLOR = {
  light: { backgroundColor: '#F3FAF6', frontColor: '#000000', bg: '#F3FAF6' },
  dark: { backgroundColor: '#0D1210', frontColor: '#ffffff', bg: '#0D1210' },
};

/**
 * 危险操作色板：wx.showModal 的 confirmColor 是原生控件，吃不到 WXSS 变量，
 * 只能在这里按主题给值，保证弹窗按钮色与页面配色一致。
 */
var DANGER_COLOR = { light: '#E85F49', dark: '#FF8B76' };

/**
 * 归一化主题值。
 * @param {*} t
 * @return {string} light | dark | auto
 */
function normalizeTheme(t) {
  var v = String(t === undefined || t === null ? '' : t).trim().toLowerCase();
  return THEMES.indexOf(v) >= 0 ? v : 'auto';
}

/**
 * 读取用户主题偏好。
 * 存储读写统一走 utils/store.js（本文件不直接调用 wx.*StorageSync）。
 * @return {string} light | dark | auto
 */
function getTheme() {
  try {
    var v = store.getThemePref();
    if (!v) return 'auto';
    return normalizeTheme(v);
  } catch (e) {
    return 'auto';
  }
}

/**
 * 读取系统当前主题。
 * @return {string} light | dark
 */
function getSystemTheme() {
  try {
    var info = wx.getSystemInfoSync();
    return info && info.theme === 'dark' ? 'dark' : 'light';
  } catch (e) {
    return 'light';
  }
}

/**
 * 把偏好解析为实际生效的主题。
 * @param {*} [setting] 不传则读取存储
 * @return {string} light | dark
 */
function resolveTheme(setting) {
  var s = setting === undefined || setting === null ? getTheme() : normalizeTheme(setting);
  if (s === 'auto') return getSystemTheme();
  return s;
}

/**
 * 保存主题偏好并立即应用到导航栏。
 * @param {string} t
 * @return {string} 归一化后的主题值
 */
function setTheme(t) {
  var v = normalizeTheme(t);
  try {
    store.setThemePref(v);
  } catch (e) {
    // 存储失败不阻断换肤，仅本次生效
  }
  applyNavBar(v);
  return v;
}

/**
 * 危险操作按钮色（随主题变化，用于 wx.showModal 的 confirmColor）。
 * @param {*} [setting] 不传则读取当前偏好
 * @return {string} 形如 '#EF4444' / '#F87171'
 */
function dangerColor(setting) {
  return resolveTheme(setting) === 'dark' ? DANGER_COLOR.dark : DANGER_COLOR.light;
}

/**
 * 把主题应用到导航栏与窗口背景。
 * @param {*} [setting]
 */
function applyNavBar(setting) {
  var resolved = resolveTheme(setting);
  var conf = NAV_COLOR[resolved] || NAV_COLOR.light;
  try {
    wx.setNavigationBarColor({
      frontColor: conf.frontColor,
      backgroundColor: conf.backgroundColor,
      animation: { duration: 0, timingFunc: 'linear' },
    });
  } catch (e) {
    // 部分基础库/开发者工具可能不支持，忽略
  }
  try {
    wx.setBackgroundColor({
      backgroundColor: conf.bg,
      backgroundColorTop: conf.bg,
      backgroundColorBottom: conf.bg,
    });
  } catch (e) {
    // 忽略
  }
}

/**
 * 监听系统主题变化（仅在 auto 模式下有意义）。
 * @param {Function} cb 回调，参数为 'light' | 'dark'
 * @return {Function} 取消监听函数
 */
function watchSystemTheme(cb) {
  if (typeof cb !== 'function') return function () {};
  if (typeof wx.onThemeChange !== 'function') return function () {};

  var handler = function (res) {
    try {
      cb(res && res.theme === 'dark' ? 'dark' : 'light');
    } catch (e) {
      // 忽略回调异常，避免影响页面
    }
  };

  wx.onThemeChange(handler);

  return function () {
    if (typeof wx.offThemeChange === 'function') {
      try {
        wx.offThemeChange(handler);
      } catch (e) {
        // 忽略
      }
    }
  };
}

/**
 * 主题 class 名。
 * @param {*} [setting]
 * @return {string} theme-light | theme-dark
 */
function themeClass(setting) {
  return 'theme-' + resolveTheme(setting);
}

/**
 * 主题按钮上的图标。
 * @param {*} [setting]
 * @return {string}
 */
function themeIcon(setting) {
  return resolveTheme(setting) === 'dark' ? '☀️' : '🌙';
}

/**
 * 页面通用：读取主题并写入 data.themeClass / data.themeIcon。
 * @param {Object} page 页面实例（this）
 */
function bindPageTheme(page) {
  if (!page || typeof page.setData !== 'function') return;
  var setting = getTheme();
  page.setData({
    themeClass: themeClass(setting),
    themeIcon: themeIcon(setting),
    themeSetting: setting,
  });
  applyNavBar(setting);
}

/**
 * 同步自定义底部导航的选中项与主题（仅 tab 页有效）。
 * 自定义 tabBar 在页面之外渲染，取不到 .page 上的 CSS 变量，
 * 所以每次页面显示都要把主题 class 推给它。
 *
 * @param {Object} page 页面实例（this）
 * @param {number} [selected] 当前 tab 下标
 */
function syncTabBar(page, selected) {
  if (!page || typeof page.getTabBar !== 'function') return;
  var bar = null;
  try {
    bar = page.getTabBar();
  } catch (e) {
    bar = null;
  }
  if (!bar || typeof bar.setData !== 'function') return;
  var patch = { themeClass: themeClass() };
  if (typeof selected === 'number') patch.selected = selected;
  bar.setData(patch);
}

module.exports = {
  THEME_KEY: THEME_KEY,
  getTheme: getTheme,
  setTheme: setTheme,
  resolveTheme: resolveTheme,
  getSystemTheme: getSystemTheme,
  applyNavBar: applyNavBar,
  watchSystemTheme: watchSystemTheme,
  themeClass: themeClass,
  themeIcon: themeIcon,
  dangerColor: dangerColor,
  bindPageTheme: bindPageTheme,
  syncTabBar: syncTabBar,
};
