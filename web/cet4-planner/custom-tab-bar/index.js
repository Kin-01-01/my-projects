// 自绘 tabBar：毛玻璃面板 + 渐变选中态短横线
Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/today/today', text: '今日' },
      { pagePath: '/pages/calendar/calendar', text: '日历' },
      { pagePath: '/pages/plan/plan', text: '规划' },
      { pagePath: '/pages/progress/progress', text: '进度' },
      { pagePath: '/pages/mine/mine', text: '我的' }
    ]
  },
  methods: {
    switchTab: function (e) {
      var path = e.currentTarget.dataset.path;
      wx.switchTab({ url: path });
    }
  }
});
