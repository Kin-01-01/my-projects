/* =========================================================
   MyBlog · 核心逻辑
   纯前端 / 零构建 / 双击可运行 · localStorage 内容管理
   路由：#/  #/posts  #/posts/:id  #/map  #/works  #/about
   粒子(particles.js) + 毛玻璃暗色 + ECharts 足迹地图(本地 CHINA_GEO)
   ========================================================= */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var KEY = 'myblog:v1';

  /* ---------------- 工具 ---------------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function fmtDate(d) { return d ? d.replace(/-/g, '.') : ''; }
  function arrayBufferToDataURL(buf, type) {
    var bytes = new Uint8Array(buf), bin = '', chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    return 'data:' + type + ';base64,' + btoa(bin);
  }

  /* ---------------- 种子数据 ---------------- */
  function seed() {
    var p = 'https://picsum.photos/seed/';
    return {
      profile: { name: 'MyBlog', slogan: '记录光、思考与走过的路', avatar: '' },
      about: '我是河北北方学院的一名本科生，在新能源材料实验室做电解水制氢方向的研究，' +
             '同时自学计算机与机器学习。这里收着我的技术笔记、生活随笔、走过的足迹和做过的小项目——' +
             '一个属于我自己的小宇宙。点右上角「管理」即可在浏览器里直接添加内容，全部存在本地，不用改任何代码。',
      posts: [
        { id: uid(), cat: 'tech', date: '2026-09-10', title: '在新能源材料实验室的第一个月',
          cover: p + 'lab1/800/500',
          body: '![' + p + 'lab2/800/460]\n走进实验室的第一天，师兄递给我一瓶电解槽的待测样品。\n\n这一个月里，我跟着做了电极材料的表征，从 SEM 看到 XRD，第一次亲手把一条伏安曲线跑出来。原来课本上的「过电位」是真的会让人兴奋的东西。\n\n下一步计划把实验数据用 Python 整理成可复现的脚本，也算给自己的科研入门留个脚印。' },
        { id: uid(), cat: 'travel', date: '2026-08-02', title: '张家口的风，和我',
          cover: p + 'zhangjiakou/800/500',
          body: '![' + p + 'grassland/800/460]\n暑假去了坝上草原。风很大，云很低，手机拍下的照片自带 GPS，于是它们自动落到了首页的「足迹」地图上。\n\n在北方，天空是一种很慷慨的东西。' },
        { id: uid(), cat: 'tech', date: '2026-07-15', title: '用 Python 把课表变成可视化',
          cover: p + 'timetable/800/500',
          body: '期末为了不漏课，写了个小脚本把教务系统的课表解析成一张热力图。\n\n![' + p + 'heatmap/800/460]\n代码不到一百行，却让我第一次体会到：把重复的事交给程序，是种很踏实的解放。' }
      ],
      works: [
        { id: uid(), name: '熵减 · 数智校园减碳平台', role: '全栈 / 微信小程序 + Web 后台',
          desc: '面向高校的碳足迹测算与减碳建议平台，覆盖西校区 2.5 万人、年排放 13902 吨 CO₂e。',
          stack: ['微信小程序', 'CloudBase', 'ECharts'], cover: p + 'entropy/800/500', link: '' },
        { id: uid(), name: '电解水制氢电极材料仿真', role: '科研 / 材料计算',
          desc: '基于实验数据对电极催化活性做可视化分析，辅助筛选低过电位材料。',
          stack: ['Python', 'Matplotlib', 'NumPy'], cover: p + 'hydrogen/800/500', link: '' },
        { id: uid(), name: '个人学习计划网站', role: '前端',
          desc: '本地存储 + 进度追踪的轻量学习计划工具，零构建、双击即跑。',
          stack: ['HTML', 'CSS', 'JS'], cover: p + 'planner/800/500', link: '' }
      ],
      photos: [
        { id: uid(), title: '坝上草原', place: '河北 · 张家口', lat: 41.03, lng: 114.88, date: '2026-08-02', url: p + 'grassland/600/400' },
        { id: uid(), title: '栈桥', place: '山东 · 青岛', lat: 36.06, lng: 120.32, date: '2026-07-20', url: p + 'qindao/600/400' },
        { id: uid(), title: '中关村', place: '北京', lat: 39.98, lng: 116.32, date: '2026-06-11', url: p + 'zhongguancun/600/400' },
        { id: uid(), title: '外滩', place: '上海', lat: 31.24, lng: 121.49, date: '2026-05-01', url: p + 'waitan/600/400' }
      ]
    };
  }

  /* ---------------- 读写 ---------------- */
  var store = load();
  function load() {
    try { var raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) {}
    var s = seed();
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    return s;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }

  /* ---------------- 文章正文 -> 块 ---------------- */
  function parseBlocks(body) {
    var lines = String(body || '').split('\n'), blocks = [], buf = [];
    function flush() { if (buf.length) { blocks.push({ type: 'text', html: esc(buf.join(' ')) }); buf = []; } }
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i].trim(), m = ln.match(/^!\[(.*)\]$/);
      if (m) { flush(); blocks.push({ type: 'img', src: m[1] }); }
      else if (ln === '') flush();
      else buf.push(ln);
    }
    flush();
    return blocks;
  }
  function excerptOf(post) {
    var b = parseBlocks(post.body);
    for (var i = 0; i < b.length; i++) if (b[i].type === 'text') return b[i].html.slice(0, 70);
    return '';
  }

  /* ---------------- 路由 ---------------- */
  function parseRoute() {
    var h = location.hash.replace(/^#\/?/, ''), parts = h.split('/');
    return { name: parts[0] || 'home', param: parts[1] || '' };
  }
  function go(route) { location.hash = route === 'home' ? '#/' : '#/' + route; }

  var app = $('#app');
  function render() {
    var r = parseRoute();
    var old = $('#heroParticles'); if (old && old.__stopParticles) old.__stopParticles();
    window.scrollTo(0, 0);
    setActiveNav(r.name);
    if (r.name === 'home') renderHome();
    else if (r.name === 'posts') r.param ? renderPostDetail(r.param) : renderPosts();
    else if (r.name === 'map') renderMapView();
    else if (r.name === 'works') renderWorks();
    else if (r.name === 'about') renderAbout();
    else renderHome();
    observeReveal();
  }
  function setActiveNav(name) {
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-route') === name);
    });
  }

  /* ---------------- 首页 ---------------- */
  function renderHome() {
    var feed = []
      .concat(store.posts.map(function (x) { return { kind: '文章', cat: x.cat, title: x.title, date: x.date, excerpt: excerptOf(x), thumb: x.cover, route: '#/posts/' + x.id, id: x.id, del: 'post' }; }))
      .concat(store.works.map(function (x) { return { kind: '作品', cat: 'work', title: x.name, date: '', excerpt: x.desc, thumb: x.cover, route: '#/works', id: x.id, del: 'work' }; }))
      .concat(store.photos.map(function (x) { return { kind: '足迹', cat: 'travel', title: x.title, date: x.date, excerpt: x.place, thumb: x.url, route: '#/map', id: x.id, del: 'photo' }; }))
      .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); })
      .slice(0, 6);

    var feedHtml = feed.map(function (f, i) {
      return '<a class="feed-card" href="' + f.route + '" style="transition-delay:' + (i * 60) + 'ms">' +
        '<button class="card-del" data-del="' + f.del + '" data-id="' + f.id + '" title="删除">✕</button>' +
        (f.thumb ? '<img class="fc-thumb" src="' + esc(f.thumb) + '" alt="" />' : '') +
        '<div class="fc-top"><span class="tag cat-' + f.cat + '">' + esc(f.kind) + '</span></div>' +
        '<div class="fc-title">' + esc(f.title) + '</div>' +
        (f.excerpt ? '<div class="fc-excerpt">' + esc(f.excerpt) + '</div>' : '') +
        '<div class="fc-meta">' + (f.date ? '📅 ' + fmtDate(f.date) : '点击查看') + '</div>' +
        '</a>';
    }).join('');

    app.innerHTML =
      '<section class="hero view">' +
        '<canvas class="hero-particles" id="heroParticles"></canvas>' +
        '<div class="hero-veil"></div>' +
        '<div class="hero-content">' +
          '<p class="hero-eyebrow">' + esc(store.profile.name.toUpperCase()) + ' · 个人空间</p>' +
          '<h1 class="hero-title">' + esc(store.profile.slogan) + '</h1>' +
          '<p class="hero-sub">文章 · 足迹 · 作品集</p>' +
          '<div class="hero-actions">' +
            '<a class="hero-scroll" href="#/posts">读文章 →</a>' +
            '<a class="hero-scroll" href="#/map">看足迹 →</a>' +
          '</div>' +
        '</div>' +
      '</section>' +
      '<div class="section-head"><h2>最新动态</h2><p>文章、作品与足迹，按时间汇成一条流。</p></div>' +
      '<div class="home-feed">' + (feedHtml || '<p class="empty">还没有内容，点右上角「管理」添加第一篇吧。</p>') + '</div>';

    var cv = $('#heroParticles');
    if (cv && window.initParticles) window.initParticles(cv);
  }

  /* ---------------- 文章列表 ---------------- */
  function renderPosts() {
    var cards = store.posts.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).map(function (p, i) {
      return '<a class="post-card" href="#/posts/' + p.id + '" style="transition-delay:' + (i * 50) + 'ms">' +
        '<button class="card-del" data-del="post" data-id="' + p.id + '" title="删除">✕</button>' +
        (p.cover ? '<img class="pc-cover" src="' + esc(p.cover) + '" alt="" />' : '') +
        '<div class="pc-body">' +
          '<span class="tag cat-' + p.cat + '">' + (p.cat === 'tech' ? '技术' : p.cat === 'travel' ? '旅行' : '生活') + '</span>' +
          '<div class="pc-title">' + esc(p.title) + '</div>' +
          '<div class="pc-excerpt">' + esc(excerptOf(p)) + '</div>' +
          '<div class="pc-meta">📅 ' + fmtDate(p.date) + '</div>' +
        '</div></a>';
    }).join('');
    app.innerHTML = '<div class="section-head"><h2>文章</h2><p>技术笔记与生活随笔，图文一体。</p></div>' +
      '<div class="posts-grid">' + (cards || '<p class="empty">还没有文章。</p>') + '</div>';
  }

  /* ---------------- 文章详情 ---------------- */
  function renderPostDetail(id) {
    var p = store.posts.find(function (x) { return x.id === id; });
    if (!p) { go('posts'); return; }
    var blocks = parseBlocks(p.body).map(function (b) {
      return b.type === 'img' ? '<img src="' + esc(b.src) + '" alt="" />' : '<p>' + b.html + '</p>';
    }).join('');
    app.innerHTML = '<div class="section-head"><h2>文章</h2></div>' +
      '<div class="modal-body post-body" style="max-width:820px;margin:0 auto;">' +
        (p.cover ? '<img class="pb-cover" src="' + esc(p.cover) + '" alt="" />' : '') +
        '<div class="pb-meta"><span class="tag cat-' + p.cat + '">' + (p.cat === 'tech' ? '技术' : p.cat === 'travel' ? '旅行' : '生活') + '</span><span>📅 ' + fmtDate(p.date) + '</span></div>' +
        '<h1 class="pb-title">' + esc(p.title) + '</h1>' +
        '<div class="pb-text">' + blocks + '</div>' +
        '<a class="btn-ghost pb-back" href="#/posts">← 返回文章列表</a>' +
      '</div>';
  }

  /* ---------------- 作品集 ---------------- */
  function renderWorks() {
    var cards = store.works.map(function (w, i) {
      var stack = (w.stack || []).map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('');
      return '<div class="work-card" style="transition-delay:' + (i * 50) + 'ms">' +
        '<button class="card-del" data-del="work" data-id="' + w.id + '" title="删除">✕</button>' +
        (w.cover ? '<img class="wc-cover" src="' + esc(w.cover) + '" alt="" />' : '') +
        '<div class="wc-body">' +
          '<div class="wc-name">' + esc(w.name) + '</div>' +
          '<div class="wc-role">' + esc(w.role || '') + '</div>' +
          '<div class="wc-desc">' + esc(w.desc || '') + '</div>' +
          '<div class="wc-stack">' + stack + '</div>' +
          (w.link ? '<a class="wc-link" href="' + esc(w.link) + '" target="_blank" rel="noopener">查看项目 →</a>' : '') +
        '</div></div>';
    }).join('');
    app.innerHTML = '<div class="section-head"><h2>作品集</h2><p>我做过的项目、科研与课程设计。</p></div>' +
      '<div class="works-grid">' + (cards || '<p class="empty">还没有作品。</p>') + '</div>';
  }

  /* ---------------- 足迹地图 ---------------- */
  var mapChart = null, mapResizeHandler = null;
  function renderMapView() {
    var list = store.photos.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).map(function (ph, i) {
      return '<li class="map-item" data-name="' + esc(ph.title) + '" style="transition-delay:' + (i * 40) + 'ms">' +
        '<button class="card-del" data-del="photo" data-id="' + ph.id + '" title="删除">✕</button>' +
        '<span class="map-dot"></span><span class="map-name">' + esc(ph.title) + '</span>' +
        '<span class="map-region">' + esc(ph.place) + '</span></li>';
    }).join('');
    app.innerHTML = '<div class="section-head"><h2>足迹 · 中国</h2><p>照片按拍摄地连成一条发光的线（本地图片自动读 GPS）。</p></div>' +
      '<div class="map-wrap"><div class="map-glass"><div id="chinaMap"></div></div>' +
      '<ul class="map-list">' + (list || '<p class="empty">还没有带位置的照片。</p>') + '</ul></div>';
    initMap();
    app.querySelectorAll('.map-item').forEach(function (it) {
      it.addEventListener('click', function (e) {
        if (e.target.closest('.card-del')) return;
        var name = it.getAttribute('data-name');
        if (mapChart) mapChart.dispatchAction({ type: 'showTip', seriesIndex: 0, name: name });
      });
    });
  }
  function initMap() {
    if (typeof echarts === 'undefined') return;
    if (window.CHINA_GEO && !echarts.getMap('china')) echarts.registerMap('china', window.CHINA_GEO);
    var el = $('#chinaMap'); if (!el) return;
    if (mapChart) { mapChart.dispose(); mapChart = null; }
    mapChart = echarts.init(el, null, { renderer: 'canvas' });
    var data = store.photos.map(function (ph) { return { name: ph.title, value: [ph.lng, ph.lat] }; });
    mapChart.setOption({
      backgroundColor: 'transparent',
      tooltip: { trigger: 'item', formatter: function (p) { return p.seriesType === 'scatter' ? p.data.name : p.name; } },
      geo: {
        map: 'china', roam: true,
        itemStyle: { areaColor: 'rgba(30,42,58,0.6)', borderColor: 'rgba(150,190,220,0.25)' },
        emphasis: { itemStyle: { areaColor: 'rgba(50,70,95,0.8)' }, label: { show: false } },
        label: { show: false }
      },
      series: [{
        type: 'scatter', coordinateSystem: 'geo', data: data,
        symbolSize: 12,
        itemStyle: { color: '#b89bff', shadowBlur: 12, shadowColor: 'rgba(184,155,255,0.8)' },
        emphasis: { itemStyle: { color: '#fff' } }
      }]
    });
    if (mapResizeHandler) window.removeEventListener('resize', mapResizeHandler);
    mapResizeHandler = function () { if (mapChart) mapChart.resize(); };
    window.addEventListener('resize', mapResizeHandler);
  }

  /* ---------------- 关于 ---------------- */
  function renderAbout() {
    app.innerHTML = '<div class="section-head"><h2>关于我</h2></div>' +
      '<div class="about-card center">' +
        (store.profile.avatar ? '<img class="about-avatar" src="' + esc(store.profile.avatar) + '" alt="" />' : '') +
        '<h2>' + esc(store.profile.name) + '</h2>' +
        '<p>' + esc(store.about).replace(/\n/g, '<br/>') + '</p>' +
      '</div>';
  }

  /* ---------------- 渐入观察 ---------------- */
  var io = null;
  function observeReveal() {
    var nodes = app.querySelectorAll('.feed-card,.post-card,.work-card,.map-item');
    if (!('IntersectionObserver' in window)) { nodes.forEach(function (e) { e.classList.add('is-visible'); }); return; }
    if (io) io.disconnect();
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    nodes.forEach(function (e) { io.observe(e); });
  }

  /* ---------------- 删除（事件委托） ---------------- */
  function bindDelete() {
    app.addEventListener('click', function (e) {
      var d = e.target.closest('[data-del]'); if (!d) return;
      e.preventDefault(); e.stopPropagation();
      var t = d.getAttribute('data-del'), id = d.getAttribute('data-id');
      if (!confirm('确定删除这条吗？删除后无法恢复（除非有备份）。')) return;
      if (t === 'post') store.posts = store.posts.filter(function (x) { return x.id !== id; });
      else if (t === 'work') store.works = store.works.filter(function (x) { return x.id !== id; });
      else if (t === 'photo') store.photos = store.photos.filter(function (x) { return x.id !== id; });
      save(); render();
    });
  }

  /* ---------------- 管理后台 ---------------- */
  var adminTab = 'post', pendingPhoto = null;
  function openAdmin() { $('#adminModal').hidden = false; requestAnimationFrame(function () { $('#adminModal').classList.add('show'); }); renderAdminForm(); }
  function closeAdmin(m) { var el = $('#' + m); el.classList.remove('show'); setTimeout(function () { el.hidden = true; }, 280); }

  function renderAdminForm() {
    var f = $('#adminForm'), tip = $('#adminTip'); tip.textContent = '';
    var sb = $('#adminSave'); if (sb) sb.style.display = '';
    if (adminTab === 'post') {
      f.innerHTML =
        field('标题', '<input id="f-title" placeholder="文章标题" />') +
        fieldRow([field('分类', sel('f-cat', [['tech', '技术'], ['life', '生活'], ['travel', '旅行']])), field('日期', '<input id="f-date" type="date" />')]) +
        field('封面图链接', '<input id="f-cover" placeholder="https://... 可选" />') +
        field('正文', '<textarea id="f-body" rows="7" placeholder="支持空行分段；单独一行 ![图片链接] 会显示为配图。"></textarea>') +
        '<div class="help-block">示例正文：<br/>第一段文字…（空一行分段）<br/>![https://图片地址]</div>';
    } else if (adminTab === 'work') {
      f.innerHTML =
        field('项目名称', '<input id="f-name" placeholder="例如：熵减减碳平台" />') +
        field('角色 / 定位', '<input id="f-role" placeholder="例如：全栈 / 微信小程序" />') +
        field('简介', '<textarea id="f-desc" rows="3" placeholder="一句话描述"></textarea>') +
        field('技术栈（逗号分隔）', '<input id="f-stack" placeholder="Python, ECharts, CloudBase" />') +
        field('封面链接', '<input id="f-cover" placeholder="https://... 可选" />') +
        field('项目链接', '<input id="f-link" placeholder="https://... 可选" />');
    } else if (adminTab === 'photo') {
      f.innerHTML =
        field('标题', '<input id="f-title" placeholder="例如：坝上草原" />') +
        field('地点', '<input id="f-place" placeholder="例如：河北 · 张家口" />') +
        field('日期', '<input id="f-date" type="date" />') +
        '<div class="field"><span>照片</span><div class="img-inputs"><input id="f-imgurl" placeholder="图片链接（与下方二选一）" /><input id="f-imgfile" type="file" accept="image/*" /></div>' +
          '<small class="hint">选本地图片会自动转成数据存本地；带 GPS 的照片会自动读出经纬度。</small></div>' +
        fieldRow([field('经度', '<input id="f-lng" type="number" step="0.0001" placeholder="如 114.88" />'), field('纬度', '<input id="f-lat" type="number" step="0.0001" placeholder="如 41.03" />')]) +
        '<small class="hint exif-note" id="exifNote" hidden>📍 已从照片读取到 GPS，已自动填好经纬度。</small>';
      bindPhotoFile();
    } else if (adminTab === 'about') {
      f.innerHTML = field('自我介绍', '<textarea id="f-about" rows="6" placeholder="介绍一下你自己">' + esc(store.about) + '</textarea>');
    } else if (adminTab === 'profile') {
      f.innerHTML =
        field('站点名称', '<input id="f-name" value="' + esc(store.profile.name) + '" />') +
        field('首页标语', '<input id="f-slogan" value="' + esc(store.profile.slogan) + '" />') +
        field('头像链接', '<input id="f-avatar" value="' + esc(store.profile.avatar) + '" placeholder="https://... 可选" />');
    } else if (adminTab === 'backup') {
      if (sb) sb.style.display = 'none';
      f.innerHTML =
        '<div class="help-block">内容存在浏览器本地，换设备 / 清缓存会丢。建议定期导出备份，重装或换浏览器后再导入。</div>' +
        '<button class="btn-accent" id="btnExport" type="button">⬇ 导出备份 (JSON)</button>' +
        '<button class="btn-accent" id="btnImport" type="button">⬆ 导入备份</button>' +
        '<input id="f-import" type="file" accept="application/json" hidden />';
      var ex = $('#btnExport'); if (ex) ex.onclick = exportBackup;
      var im = $('#btnImport'); if (im) im.onclick = function () { $('#f-import').click(); };
      var fi = $('#f-import'); if (fi) fi.onchange = function () { if (fi.files[0]) importBackup(fi.files[0]); };
    }
  }
  function field(label, control) { return '<label class="field"><span>' + label + '</span>' + control + '</label>'; }
  function fieldRow(arr) { return '<div class="field-row">' + arr.join('') + '</div>'; }
  function sel(id, opts) { return '<select id="' + id + '">' + opts.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select>'; }

  function bindPhotoFile() {
    var inp = $('#f-imgfile'); if (!inp) return;
    inp.addEventListener('change', function () {
      var file = inp.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        pendingPhoto = arrayBufferToDataURL(reader.result, file.type);
        var gps = parseExifGPS(reader.result);
        if (gps) {
          $('#f-lng').value = gps.lng.toFixed(4);
          $('#f-lat').value = gps.lat.toFixed(4);
          var note = $('#exifNote'); if (note) note.hidden = false;
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function adminSave() {
    var tip = $('#adminTip');
    if (adminTab === 'post') {
      var title = $('#f-title').value.trim(); if (!title) { tip.textContent = '标题不能为空'; return; }
      store.posts.unshift({ id: uid(), cat: $('#f-cat').value, date: $('#f-date').value || new Date().toISOString().slice(0, 10), title: title, cover: $('#f-cover').value.trim(), body: $('#f-body').value });
      tip.textContent = '已保存文章 ✓';
    } else if (adminTab === 'work') {
      var name = $('#f-name').value.trim(); if (!name) { tip.textContent = '名称不能为空'; return; }
      store.works.unshift({ id: uid(), name: name, role: $('#f-role').value.trim(), desc: $('#f-desc').value.trim(), stack: $('#f-stack').value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean), cover: $('#f-cover').value.trim(), link: $('#f-link').value.trim() });
      tip.textContent = '已保存作品 ✓';
    } else if (adminTab === 'photo') {
      var t = $('#f-title').value.trim(); if (!t) { tip.textContent = '标题不能为空'; return; }
      var src = pendingPhoto || $('#f-imgurl').value.trim(); if (!src) { tip.textContent = '请上传或粘贴图片'; return; }
      var lat = parseFloat($('#f-lat').value), lng = parseFloat($('#f-lng').value);
      if (isNaN(lat) || isNaN(lng)) { tip.textContent = '请填写经纬度（或上传带 GPS 的照片）'; return; }
      store.photos.unshift({ id: uid(), title: t, place: $('#f-place').value.trim(), date: $('#f-date').value || new Date().toISOString().slice(0, 10), url: src, lat: lat, lng: lng });
      pendingPhoto = null;
      tip.textContent = '已保存照片 ✓';
    } else if (adminTab === 'about') {
      store.about = $('#f-about').value; tip.textContent = '已保存 ✓';
    } else if (adminTab === 'profile') {
      store.profile.name = $('#f-name').value.trim() || 'MyBlog';
      store.profile.slogan = $('#f-slogan').value.trim() || '记录光、思考与走过的路';
      store.profile.avatar = $('#f-avatar').value.trim();
      $('#brandName').textContent = store.profile.name;
      tip.textContent = '已保存 ✓';
    }
    save();
    setTimeout(function () { render(); }, 400);
  }

  /* ---------------- 备份 ---------------- */
  function exportBackup() {
    var blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'myblog-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    var tip = $('#adminTip'); if (tip) tip.textContent = '已导出备份 ✓';
  }
  function importBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var tip = $('#adminTip');
      try {
        var data = JSON.parse(reader.result);
        if (data && data.posts) {
          store.posts = data.posts || []; store.works = data.works || [];
          store.photos = data.photos || []; store.about = data.about || '';
          store.profile = data.profile || store.profile;
          save(); render(); if (tip) tip.textContent = '已导入备份 ✓';
        } else if (tip) tip.textContent = '文件格式不对（缺少 posts 字段）';
      } catch (e) { if (tip) tip.textContent = '解析失败：' + e.message; }
    };
    reader.readAsText(file);
  }

  /* ---------------- EXIF GPS 解析（无第三方库） ---------------- */
  function findTag(dv, ifd, little, tag) {
    var n = dv.getUint16(ifd, little);
    for (var i = 0; i < n; i++) { var e = ifd + 2 + i * 12; if (dv.getUint16(e, little) === tag) return e; }
    return 0;
  }
  function getCoord(dv, ifd, little, tiff, tag) {
    var e = findTag(dv, ifd, little, tag); if (!e) return null;
    var valOff = dv.getUint32(e + 8, little), base = tiff + valOff;
    var d = dv.getUint32(base, little) / dv.getUint32(base + 4, little);
    var m = dv.getUint32(base + 8, little) / dv.getUint32(base + 12, little);
    var s = dv.getUint32(base + 16, little) / dv.getUint32(base + 20, little);
    return d + m / 60 + s / 3600;
  }
  function getRef(dv, ifd, little, tag) {
    var e = findTag(dv, ifd, little, tag); if (!e) return '';
    return String.fromCharCode(dv.getUint8(e + 8));
  }
  function parseExifGPS(buf) {
    try {
      var dv = new DataView(buf);
      if (dv.byteLength < 4 || dv.getUint16(0) !== 0xFFD8) return null;
      var off = 2;
      while (off + 4 < dv.byteLength) {
        var mark = dv.getUint16(off);
        if ((mark & 0xFF00) !== 0xFF00) break;
        var size = dv.getUint16(off + 2);
        if (mark === 0xFFE1) {
          var exif = off + 4;
          if (dv.getUint32(exif) !== 0x45786966) return null;
          var tiff = exif + 6, little = dv.getUint16(tiff) === 0x4949;
          var ifd0 = tiff + dv.getUint32(tiff + 4, little);
          var gpsPtr = findTag(dv, ifd0, little, 0x8825); if (!gpsPtr) return null;
          var gpsOff = tiff + dv.getUint32(gpsPtr + 8, little);
          var lat = getCoord(dv, gpsOff, little, tiff, 0x0002);
          var lng = getCoord(dv, gpsOff, little, tiff, 0x0004);
          if (lat == null || lng == null) return null;
          var latRef = getRef(dv, gpsOff, little, 0x0001), lngRef = getRef(dv, gpsOff, little, 0x0003);
          if (latRef === 'S') lat = -lat;
          if (lngRef === 'W') lng = -lng;
          return { lat: lat, lng: lng };
        }
        off += 2 + size;
      }
    } catch (e) { return null; }
    return null;
  }

  /* ---------------- 滚动进度 + 导航显隐 ---------------- */
  function onScroll() {
    var y = window.scrollY || window.pageYOffset, navbar = $('#navbar');
    if (navbar) navbar.classList.toggle('scrolled', y > 30);
    var docH = document.documentElement.scrollHeight - window.innerHeight;
    var pct = docH > 0 ? (y / docH) * 100 : 0;
    var fill = $('#scrollFill'); if (fill) fill.style.width = pct + '%';
  }
  var lastY = 0;
  function navHide() {
    var y = window.scrollY || 0, navbar = $('#navbar'); if (!navbar) return;
    if (y > lastY && y > 200) navbar.classList.add('hidden'); else navbar.classList.remove('hidden');
    lastY = y;
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    $('#navAdmin').addEventListener('click', openAdmin);
    document.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () { closeAdmin(b.getAttribute('data-close')); });
    });
    $('#adminTabs').addEventListener('click', function (e) {
      var t = e.target.closest('.admin-tab'); if (!t) return;
      adminTab = t.getAttribute('data-tab');
      document.querySelectorAll('.admin-tab').forEach(function (x) { x.classList.toggle('active', x === t); });
      renderAdminForm();
    });
    $('#adminSave').addEventListener('click', adminSave);
    bindDelete();
    window.addEventListener('hashchange', render);
    window.addEventListener('scroll', function () { onScroll(); navHide(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAdmin('adminModal'); });
  }

  /* ---------------- 启动 ---------------- */
  function start() {
    $('#brandName').textContent = store.profile.name;
    bind();
    onScroll();
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
