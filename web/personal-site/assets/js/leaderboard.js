/* ============================================================
   零度栈 · GitHub 周榜页面逻辑
   读取仓库根目录 leaderboard-data.json（由 GitHub Actions 自动生成），
   按周次 / 语言 / 关键词筛选并渲染项目卡片。纯前端，无需调用 API。
   ============================================================ */
(function () {
  "use strict";

  var els = {
    week: document.getElementById('lbWeek'),
    sort: document.getElementById('lbSort'),
    search: document.getElementById('lbSearch'),
    langs: document.getElementById('lbLangs'),
    meta: document.getElementById('lbMeta'),
    grid: document.getElementById('lbGrid'),
    empty: document.getElementById('lbEmpty'),
    error: document.getElementById('lbError')
  };

  var state = { data: null, week: null, lang: 'all', q: '', sort: 'stars' };

  // 语言配色（常见语言固定色，未知语言取哈希兜底）
  var LANG_COLORS = {
    'Python': '#3776AB', 'JavaScript': '#F7DF1E', 'TypeScript': '#3178C6',
    'C++': '#00599C', 'C': '#A8B9CC', 'C#': '#239120', 'Java': '#B07219',
    'Go': '#00ADD8', 'Rust': '#DEA584', 'Ruby': '#CC342D', 'PHP': '#777BB4',
    'Swift': '#F05138', 'Kotlin': '#A97BFF', 'Jupyter Notebook': '#DA5B0B',
    'HTML': '#E34F26', 'CSS': '#1572B6', 'Shell': '#89E051', 'Vue': '#41B883'
  };
  function langColor(l) {
    if (!l) return '#888';
    if (LANG_COLORS[l]) return LANG_COLORS[l];
    var h = 0; for (var i = 0; i < l.length; i++) h = (h * 31 + l.charCodeAt(i)) % 360;
    return 'hsl(' + h + ',55%,60%)';
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtStars(n) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }
  function fmtDate(iso) {
    try { return new Date(iso).toISOString().slice(0, 10); } catch (e) { return iso || ''; }
  }
  function starSvg() {
    return '<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 21.4 7.3 14.6 2.2 9.9l6.9-.8z"/></svg>';
  }

  function deltaBadge(d) {
    if (!d) return '<span class="lb-delta flat">-</span>';
    if (d.type === 'new') return '<span class="lb-delta new">NEW</span>';
    if (d.type === 'up') return '<span class="lb-delta up">▲ ' + fmtStars(d.value) + '</span>';
    if (d.type === 'down') return '<span class="lb-delta down">▼ ' + fmtStars(Math.abs(d.value)) + '</span>';
    return '<span class="lb-delta flat">-</span>';
  }

  function getSnapshot(week) {
    if (!state.data) return null;
    var hist = state.data.history || [];
    for (var i = 0; i < hist.length; i++) if (hist[i].week === week) return hist[i];
    return state.data.current || null;
  }

  function buildWeekOptions() {
    var hist = (state.data.history || []).slice().sort(function (a, b) {
      return a.week < b.week ? 1 : -1; // 新→旧
    });
    var cur = state.data.current ? state.data.current.week : (hist[0] && hist[0].week);
    els.week.innerHTML = hist.map(function (s) {
      var label = s.week + (s.week === cur ? ' 期（最新）' : ' 期');
      return '<option value="' + s.week + '">' + label + '</option>';
    }).join('');
    if (state.week && hist.some(function (s) { return s.week === state.week; })) {
      els.week.value = state.week;
    } else {
      state.week = cur;
      els.week.value = cur || '';
    }
  }

  function buildLangChips(snapshot) {
    var set = {};
    (snapshot.items || []).forEach(function (it) { if (it.language) set[it.language] = true; });
    var langs = Object.keys(set);
    var html = '<span class="lb-lang' + (state.lang === 'all' ? ' active' : '') + '" data-lang="all">全部</span>';
    html += langs.map(function (l) {
      return '<span class="lb-lang' + (state.lang === l ? ' active' : '') + '" data-lang="' + escapeHtml(l) + '">' + escapeHtml(l) + '</span>';
    }).join('');
    els.langs.innerHTML = html;
    Array.prototype.forEach.call(els.langs.querySelectorAll('.lb-lang'), function (chip) {
      chip.addEventListener('click', function () {
        state.lang = chip.getAttribute('data-lang');
        buildLangChips(getSnapshot(state.week));
        render();
      });
    });
  }

  function render() {
    var snap = getSnapshot(state.week);
    if (!snap) return;
    var items = (snap.items || []).slice();

    // 语言筛选
    if (state.lang !== 'all') items = items.filter(function (it) { return it.language === state.lang; });
    // 关键词搜索
    var q = state.q.trim().toLowerCase();
    if (q) items = items.filter(function (it) {
      return (it.name + ' ' + it.fullName + ' ' + (it.owner || '') + ' ' + (it.description || '')).toLowerCase().indexOf(q) !== -1;
    });
    // 排序
    items.sort(function (a, b) {
      if (state.sort === 'delta') {
        var da = a.delta ? a.delta.value * (a.delta.type === 'down' ? -1 : 1) : 0;
        var db = b.delta ? b.delta.value * (b.delta.type === 'down' ? -1 : 1) : 0;
        return db - da;
      }
      if (state.sort === 'rank') return (a.rank || 0) - (b.rank || 0);
      return (b.stars || 0) - (a.stars || 0);
    });

    // 元信息
    var meta = state.data.meta || {};
    var topic = snap.topic || meta.topic || '-';
    els.meta.innerHTML = '数据每周一 00:00 UTC 自动更新 · 当前展示 <b>' + snap.week +
      ' 期</b> · 共 <b>' + items.length + '</b> 项' +
      (topic ? ' · 主题 <span class="mono">' + escapeHtml(topic) + '</span>' : '') +
      (meta.note ? ' · <span style="opacity:.7">' + escapeHtml(meta.note) + '</span>' : '');

    if (!items.length) {
      els.grid.innerHTML = '';
      els.empty.hidden = false;
      return;
    }
    els.empty.hidden = true;

    els.grid.innerHTML = items.map(function (it) {
      var top = it.rank <= 3 ? ' top' + it.rank : '';
      var langTag = it.language
        ? '<span class="lb-langtag"><i class="lb-lang-dot" style="background:' + langColor(it.language) + '"></i>' + escapeHtml(it.language) + '</span>'
        : '';
      var owner = it.owner
        ? '<div class="lb-owner">by <a href="' + escapeHtml(it.ownerUrl || '#') + '" target="_blank" rel="noopener">' + escapeHtml(it.owner) + '</a></div>'
        : '';
      return (
        '<article class="lb-card' + top + '">' +
          '<div class="lb-rank">' + it.rank + '</div>' +
          '<div class="lb-body">' +
            '<div class="lb-name"><a href="' + escapeHtml(it.url || '#') + '" target="_blank" rel="noopener">' + escapeHtml(it.name) + '</a>' + langTag + '</div>' +
            owner +
            '<p class="lb-desc">' + (it.description ? escapeHtml(it.description) : '<span style="opacity:.5">暂无简介</span>') + '</p>' +
            '<div class="lb-foot">' +
              '<span class="lb-stars">' + starSvg() + fmtStars(it.stars) + '</span>' +
              deltaBadge(it.delta) +
              '<a class="lb-link" href="' + escapeHtml(it.url || '#') + '" target="_blank" rel="noopener">查看项目 →</a>' +
            '</div>' +
          '</div>' +
        '</article>'
      );
    }).join('');
  }

  function init() {
    fetch('./leaderboard-data.json', { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (json) {
        state.data = json;
        buildWeekOptions();
        buildLangChips(getSnapshot(state.week));
        render();
      })
      .catch(function (err) {
        console.error('[leaderboard] 加载数据失败：', err);
        els.error.hidden = false;
      });

    els.week.addEventListener('change', function () {
      state.week = els.week.value;
      buildLangChips(getSnapshot(state.week));
      render();
    });
    els.sort.addEventListener('change', function () { state.sort = els.sort.value; render(); });
    els.search.addEventListener('input', function () { state.q = els.search.value; render(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
