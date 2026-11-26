/**
 * custom-tab-bar —— 悬浮胶囊式底部导航
 *
 * 只做视觉与跳转；当前选中项由各 tab 页在 onShow 里通过
 * theme.syncTabBar(page, index) 同步（同时也同步主题）。
 */
var theme = require('../utils/theme.js');

Component({
  data: {
    selected: 0,
    themeClass: 'theme-light',
    list: [
      { path: '/pages/index/index', text: '题库' },
      { path: '/pages/wrong/wrong', text: '错题本' },
      { path: '/pages/settings/settings', text: '设置' },
    ],
  },

  attached: function () {
    this.setData({ themeClass: theme.themeClass() });
  },

  methods: {
    onTap: function (e) {
      var i = Number(e.currentTarget.dataset.index);
      var item = this.data.list[i];
      if (!item || i === this.data.selected) return;
      this.setData({ selected: i });
      wx.switchTab({ url: item.path });
    },
  },
});
