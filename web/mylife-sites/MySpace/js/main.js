/* =========================================================
   拾光 · 合并版个人记录空间
   单页纵向滑动 · 深色毛玻璃 · 文章/轨迹/记录/地图/作品/情绪
   纯前端 · localStorage 本地保存 · 零依赖（地图用本地 ECharts）
   ========================================================= */
(function () {
  "use strict";

  var KEY = "xinji:space:v1";

  var MOODS = [
    { k: "happy", e: "😊", t: "开心" }, { k: "calm", e: "😌", t: "平静" },
    { k: "warm", e: "🥰", t: "温暖" }, { k: "excited", e: "🤩", t: "兴奋" },
    { k: "anxious", e: "😟", t: "焦虑" }, { k: "sad", e: "😢", t: "难过" },
    { k: "angry", e: "😡", t: "愤怒" }, { k: "tired", e: "🥱", t: "疲惫" },
    { k: "lost", e: "😕", t: "迷茫" }, { k: "blank", e: "💭", t: "放空" }
  ];
  var MOOD_MAP = {};
  MOODS.forEach(function (m) { MOOD_MAP[m.k] = m; });

  var CAT_LABEL = { tech: "技术", life: "生活", travel: "旅行" };

  var store = load();
  var state = { moodFeed: "", moodTrash: "" };
  var mapChart = null, mapResizeHandler = null, mapRegistered = false, mapPts = [], mapSelectedId = "";

  /* ---------- 工具 ---------- */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function $(s) { return document.querySelector(s); }
  function $all(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function todayISO() {
    var d = new Date(), m = ("0" + (d.getMonth() + 1)).slice(-2), day = ("0" + d.getDate()).slice(-2);
    return d.getFullYear() + "-" + m + "-" + day;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function fileToDataURL(file, cb) {
    if (!file) return cb("");
    var r = new FileReader();
    r.onload = function () { cb(r.result); };
    r.onerror = function () { cb(""); };
    r.readAsDataURL(file);
  }
  function defaultData() {
    return {
      profile: { name: "拾光", slogan: "把日子、轨迹与情绪，收进同一处。", avatar: "", hero: "" },
      about: "这里放一句关于你的介绍。点「编辑关于」随时改。",
      timeline: [
        { id: uid(), date: "2024-09-01", title: "踏入大学校门", desc: "来到河北北方学院，物理（师范）专业，一切都是新的开始。" },
        { id: uid(), date: "2025-03-10", title: "进入新能源材料实验室", desc: "跟着学长做电解水制氢，第一次碰电极材料。" }
      ],
      feed: [
        { id: uid(), date: "2026-09-18", mood: "excited", text: "机器学习课程终于推进到第二周了，虽然数学有点吃力，但看懂一个公式的瞬间很爽。", photo: "" }
      ],
      posts: [
        { id: uid(), date: "2026-08-20", cat: "tech", title: "我的前端自学路线", cover: "", body: "从 HTML/CSS 到能写一个完整的本地应用，中间踩了不少坑。\n\n![https://picsum.photos/seed/code/800/400]\n\n关键是别贪多，每天写一个能跑的小东西。" }
      ],
      works: [
        { id: uid(), date: "", name: "数智校园减碳平台", role: "产品设计 + 前端", desc: "微信小程序 + Web 管理后台，覆盖校园碳排放可视化管理。", stack: "微信小程序 / CloudBase / HTML CSS JS", cover: "", link: "" }
      ],
      photos: [
        { id: uid(), place: "北京", date: "2026-05-01", title: "天安门看升旗", lat: 39.9087, lng: 116.3975, url: "" }
      ],
      trash: [
        { id: uid(), date: "2026-09-15", mood: "anxious", text: "考研方向还没定下来，凝聚态和光学来回摇摆，有点慌。", resolved: false }
      ]
    };
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return defaultData();
      var d = JSON.parse(raw);
      ["timeline", "feed", "posts", "works", "photos", "trash"].forEach(function (k) { if (!d[k]) d[k] = []; });
      if (!d.profile) d.profile = { name: "拾光", slogan: "", avatar: "", hero: "" };
      if (d.about == null) d.about = "";
      return d;
    } catch (e) { return defaultData(); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); }
    catch (e) { alert("保存失败：浏览器本地存储可能已满（照片太多会占空间）。"); }
  }

  /* ---------- 渲染 ---------- */
  function render() {
    renderHero(); renderTimeline(); renderFeed(); renderPosts();
    renderMap(); renderWorks(); renderTrash(); renderAbout(); renderStats();
  }
  function renderHero() {
    $("#heroName").textContent = store.profile.name || "拾光";
    $("#heroSlogan").textContent = store.profile.slogan || "把日子、轨迹与情绪，收进同一处。";
    var bg = $("#heroBg");
    if (bg) {
      if (store.profile.hero) {
        bg.hidden = false;
        bg.style.backgroundImage = 'url("' + store.profile.hero + '")';
      } else {
        bg.hidden = true;
        bg.style.backgroundImage = "";
      }
    }
  }
  function renderTimeline() {
    var list = $("#timelineList");
    if (!store.timeline.length) { list.innerHTML = emptyHTML("还没有轨迹节点，点上方“+ 添加节点”"); return; }
    var items = store.timeline.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    list.innerHTML = items.map(function (n) {
      return '<div class="tl-item"><button class="tl-del" data-del="timeline" data-id="' + n.id + '">✕</button>' +
        '<div class="tl-date">' + esc(n.date) + '</div>' +
        '<div class="tl-title">' + esc(n.title) + '</div>' +
        (n.desc ? '<p class="tl-desc">' + esc(n.desc) + '</p>' : '') + '</div>';
    }).join("");
  }
  function renderFeed() {
    var list = $("#feedList");
    if (!store.feed.length) { list.innerHTML = emptyHTML("还没有生活记录，点上方“+ 记一笔生活”"); return; }
    var items = store.feed.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    list.innerHTML = items.map(function (n) {
      var mood = n.mood && MOOD_MAP[n.mood] ? MOOD_MAP[n.mood] : null;
      return '<div class="feed-card glass"><button class="feed-card__del" data-del="feed" data-id="' + n.id + '">✕</button>' +
        '<div class="feed-card__top">' + (mood ? '<span class="feed-card__mood">' + mood.e + '</span>' : '') +
        '<span class="feed-card__date">' + esc(n.date) + (mood ? ' · ' + mood.t : '') + '</span></div>' +
        '<p class="feed-card__text">' + esc(n.text) + '</p>' +
        (n.photo ? '<img class="feed-card__photo" src="' + n.photo + '" alt="配图" />' : '') + '</div>';
    }).join("");
  }
  function renderPosts() {
    var list = $("#postsList");
    if (!store.posts.length) { list.innerHTML = emptyHTML("还没有文章，点上方“+ 写一篇文章”"); return; }
    var items = store.posts.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    list.innerHTML = items.map(function (n) {
      return '<div class="post-card glass" data-id="' + n.id + '">' +
        '<button class="post-card__del" data-del="posts" data-id="' + n.id + '">✕</button>' +
        (n.cover ? '<img class="post-card__cover" src="' + n.cover + '" alt="封面" />' : '<div class="post-card__cover"></div>') +
        '<div class="post-card__body"><span class="post-card__cat">' + (CAT_LABEL[n.cat] || "文章") + '</span>' +
        '<h3 class="post-card__title">' + esc(n.title) + '</h3>' +
        '<div class="post-card__date">' + esc(n.date) + '</div></div></div>';
    }).join("");
  }
  function renderMap() {
    var list = $("#mapList");
    var cnt = $("#mapCount");
    var pts = store.photos.filter(function (p) { return p.lat != null && p.lng != null; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    mapPts = pts;
    if (!pts.length) {
      list.innerHTML = '<div class="empty">还没有带经纬度的足迹。添加足迹时填经纬度，或上传带定位的照片会自动标点。</div>';
      if (cnt) cnt.textContent = "还没有足迹";
      if ($("#mapPhotoCard")) $("#mapPhotoCard").innerHTML = "";
      updateMapChart();
      return;
    }
    if (cnt) cnt.textContent = "已点亮 " + pts.length + " 座城市";
    if (!mapSelectedId || !pts.some(function (x) { return x.id === mapSelectedId; })) {
      mapSelectedId = pts[pts.length - 1].id;
    }
    list.innerHTML = pts.map(function (p) {
      return '<div class="map-item glass' + (p.id === mapSelectedId ? " is-active" : "") + '" data-id="' + p.id + '">' +
        '<div class="map-item__place">' + esc(p.place) + '</div>' +
        (p.title ? '<div class="map-item__title">' + esc(p.title) + '</div>' : '') + '</div>';
    }).join("");
    renderMapCard(mapSelectedId);
    updateMapChart();
  }
  function renderMapCard(id) {
    var card = $("#mapPhotoCard"); if (!card) return;
    var p = null;
    mapPts.forEach(function (x) { if (x.id === id) p = x; });
    if (!p) { card.innerHTML = ""; return; }
    var initial = (p.place || "?").charAt(0);
    var img = p.url
      ? '<img class="map-card__img" src="' + p.url + '" alt="' + esc(p.place) + '" />'
      : '<div class="map-card__img map-card__img--ph">' + esc(initial) + '</div>';
    card.innerHTML = img +
      '<div class="map-card__meta">' +
      '<div class="map-card__place">' + esc(p.place) + '</div>' +
      (p.title ? '<div class="map-card__title">' + esc(p.title) + '</div>' : '') +
      '<div class="map-card__date">' + esc(p.date) + '</div></div>';
  }
  function selectPlace(id) {
    mapSelectedId = id;
    $all(".map-item").forEach(function (el) { el.classList.toggle("is-active", el.dataset.id === id); });
    renderMapCard(id);
    if (mapChart) {
      var p = null;
      mapPts.forEach(function (x) { if (x.id === id) p = x; });
      if (p) mapChart.dispatchAction({ type: "showTip", seriesIndex: 1, name: p.place });
    }
  }
  function renderWorks() {
    var list = $("#worksList");
    if (!store.works.length) { list.innerHTML = emptyHTML("还没有作品，点上方“+ 添加作品”"); return; }
    list.innerHTML = store.works.map(function (n) {
      return '<div class="work-card glass" data-id="' + n.id + '">' +
        '<button class="work-card__del" data-del="works" data-id="' + n.id + '">✕</button>' +
        (n.cover ? '<img class="work-card__cover" src="' + n.cover + '" alt="封面" />' : '<div class="work-card__cover"></div>') +
        '<div class="work-card__body"><h3 class="work-card__name">' + esc(n.name) + '</h3>' +
        (n.role ? '<div class="work-card__role">' + esc(n.role) + '</div>' : '') +
        (n.desc ? '<p class="work-card__desc">' + esc(n.desc) + '</p>' : '') +
        (n.stack ? '<div class="work-card__stack">🛠 ' + esc(n.stack) + '</div>' : '') +
        (n.link ? '<a class="work-card__link" href="' + esc(n.link) + '" target="_blank" rel="noopener">查看链接 →</a>' : '') +
        '</div></div>';
    }).join("");
  }
  function renderTrash() {
    var list = $("#trashList");
    if (!store.trash.length) { list.innerHTML = emptyHTML("垃圾桶是空的。心情不好的时候，点右下角 🗑 把它倒进来。"); return; }
    var items = store.trash.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    list.innerHTML = items.map(function (n) {
      var mood = n.mood && MOOD_MAP[n.mood] ? MOOD_MAP[n.mood] : null;
      return '<div class="trash-card glass' + (n.resolved ? ' is-resolved' : '') + '">' +
        '<div class="trash-card__top">' + (mood ? '<span class="trash-card__mood">' + mood.e + '</span>' : '') +
        '<span class="trash-card__date">' + esc(n.date) + (mood ? ' · ' + mood.t : '') + '</span></div>' +
        (n.text ? '<p class="trash-card__text">' + esc(n.text) + '</p>' : '<p class="trash-card__text" style="color:var(--muted)">（只标记了心情，没写文字）</p>') +
        '<div class="trash-card__actions"><button data-resolve="' + n.id + '">' + (n.resolved ? "↩ 重新打开" : "✓ 已释怀") + '</button>' +
        '<button data-del="trash" data-id="' + n.id + '">🗑 清空这条</button></div></div>';
    }).join("");
  }
  function renderAbout() {
    var p = store.profile, a = store.about;
    $("#aboutCard").innerHTML =
      (p.avatar ? '<img class="about-card__avatar" src="' + p.avatar + '" alt="头像" />' : '<div class="about-card__avatar"></div>') +
      '<div><div class="about-card__name">' + esc(p.name || "我") + '</div>' +
      (p.slogan ? '<div class="about-card__slogan">' + esc(p.slogan) + '</div>' : '') +
      (a ? '<p class="about-card__text">' + esc(a) + '</p>' : '<p class="about-card__text">还没有填写关于。</p>') + '</div>';
  }
  function renderStats() {
    var START_DATE = "2007-04-16";
    var diff = Math.floor((Date.now() - new Date(START_DATE).getTime()) / 86400000);
    var days = isNaN(diff) ? 0 : Math.max(1, diff);
    $("#statDays").textContent = days;
    $("#statFeed").textContent = store.feed.length;
    $("#statPosts").textContent = store.posts.length;
    $("#statMood").textContent = store.trash.length;
  }
  function emptyHTML(tip) { return '<div class="empty">' + esc(tip) + '</div>'; }

  /* ---------- 地图（ECharts） ---------- */
  function updateMapChart() {
    var box = $("#mapChart");
    if (!window.echarts || !window.CHINA_GEO) { box.innerHTML = '<div class="empty">地图组件未加载（需要联网首次加载 ECharts）</div>'; return; }
    if (!mapChart) initMapChart();
    var pts = mapPts;
    var scatterData = pts.map(function (p) { return { name: p.place, value: [p.lng, p.lat] }; });
    var linesData = [];
    for (var i = 1; i < pts.length; i++) {
      linesData.push({ coords: [[pts[i - 1].lng, pts[i - 1].lat], [pts[i].lng, pts[i].lat]] });
    }
    mapChart.setOption({
      series: [
        {
          type: "lines", coordinateSystem: "geo", zlevel: 1, polyline: false,
          effect: { show: true, period: 5, trailLength: 0.3, symbol: "arrow", symbolSize: 6, color: "#ffd479" },
          lineStyle: { color: "#ffce7a", width: 1.6, opacity: 0.55, curveness: 0.2 },
          data: linesData
        },
        {
          type: "scatter", coordinateSystem: "geo", symbolSize: 12, zlevel: 2,
          itemStyle: { color: "#7aa2ff", shadowBlur: 12, shadowColor: "rgba(122,162,255,0.7)" },
          data: scatterData
        }
      ]
    });
  }
  function initMapChart() {
    if (!mapRegistered && window.CHINA_GEO) { try { window.echarts.registerMap("china", window.CHINA_GEO); mapRegistered = true; } catch (e) {} }
    mapChart = window.echarts.init(document.getElementById("mapChart"), null, { renderer: "canvas" });
    mapChart.setOption({
      backgroundColor: "transparent",
      tooltip: { trigger: "item", formatter: function (p) { return p.name || ""; } },
      geo: {
        map: "china", roam: true, zoom: 1.15,
        itemStyle: { areaColor: "#161b24", borderColor: "rgba(255,255,255,0.12)" },
        emphasis: { itemStyle: { areaColor: "#1f2733" }, label: { show: false } },
        label: { show: false }
      },
      series: [
        {
          type: "lines", coordinateSystem: "geo", zlevel: 1, polyline: false,
          effect: { show: true, period: 5, trailLength: 0.3, symbol: "arrow", symbolSize: 6, color: "#ffd479" },
          lineStyle: { color: "#ffce7a", width: 1.6, opacity: 0.55, curveness: 0.2 }, data: []
        },
        {
          type: "scatter", coordinateSystem: "geo", symbolSize: 12, zlevel: 2,
          itemStyle: { color: "#7aa2ff", shadowBlur: 12, shadowColor: "rgba(122,162,255,0.7)" }, data: []
        }
      ]
    });
    mapChart.on("click", function (params) {
      if (params.seriesType === "scatter") {
        var p = null;
        mapPts.forEach(function (x) { if (x.place === params.name) p = x; });
        if (p) {
          selectPlace(p.id);
          var item = $('.map-item[data-id="' + p.id + '"]');
          if (item) item.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    });
    if (mapResizeHandler) window.removeEventListener("resize", mapResizeHandler);
    mapResizeHandler = function () { if (mapChart) mapChart.resize(); };
    window.addEventListener("resize", mapResizeHandler);
  }

  /* ---------- 弹窗 ---------- */
  function openModal(name) {
    state.moodFeed = ""; state.moodTrash = "";
    var id = "#modal" + name.charAt(0).toUpperCase() + name.slice(1);
    var form = $(id + " form");
    if (form) form.reset();
    if (name === "feed") buildMoodGrid('[data-mood="feed"]', "feed");
    if (name === "trash") buildMoodGrid('[data-mood="trash"]', "trash");
    if (name === "about" && form) {
      var p = store.profile;
      form.elements.namedItem("name").value = p.name || "";
      form.elements.namedItem("slogan").value = p.slogan || "";
      form.elements.namedItem("avatar").value = p.avatar || "";
      form.elements.namedItem("hero").value = p.hero || "";
      form.elements.namedItem("about").value = store.about || "";
    }
    $(id).hidden = false;
  }
  function closeModals() { $all(".modal").forEach(function (m) { m.hidden = true; }); }
  function buildMoodGrid(sel, which) {
    var c = $(sel);
    c.innerHTML = MOODS.map(function (m) {
      return '<button type="button" class="mood-chip" data-mood="' + m.k + '">' +
        '<span class="mood-chip__e">' + m.e + '</span><span class="mood-chip__t">' + m.t + '</span></button>';
    }).join("");
    c.onclick = function (e) {
      var chip = e.target.closest(".mood-chip"); if (!chip) return;
      var k = chip.dataset.mood;
      if (which === "feed") state.moodFeed = state.moodFeed === k ? "" : k;
      else state.moodTrash = state.moodTrash === k ? "" : k;
      $all(".mood-chip", c).forEach(function (x) {
        x.classList.toggle("is-active", x.dataset.mood === (which === "feed" ? state.moodFeed : state.moodTrash));
      });
    };
  }
  function openPostView(id) {
    var post = null;
    store.posts.forEach(function (p) { if (p.id === id) post = p; });
    if (!post) return;
    $("#postViewTitle").textContent = post.title;
    $("#postViewBody").innerHTML = renderPostBody(post.body || "");
    $("#modalPostView").hidden = false;
  }
  function renderPostBody(body) {
    return body.split("\n").map(function (line) {
      line = line.trim();
      if (!line) return "";
      var m = line.match(/^!\[(.*)\]$/);
      if (m) return '<img src="' + esc(m[1]) + '" alt="" />';
      return "<p>" + esc(line) + "</p>";
    }).join("");
  }

  /* ---------- EXIF GPS ---------- */
  function parseExifGPS(buf) {
    try {
      var view = new DataView(buf);
      if (view.byteLength < 4 || view.getUint16(0) !== 0xFFD8) return null;
      var offset = 2, length = view.byteLength;
      while (offset < length) {
        var marker = view.getUint16(offset);
        if ((marker & 0xFF00) !== 0xFF00) break;
        if (marker === 0xFFE1) {
          var segLen = view.getUint16(offset + 2) + 2;
          if (view.getUint32(offset + 4) === 0x45786966) { // "Exif"
            var tiff = offset + 10;
            var little = view.getUint16(tiff) === 0x4949;
            var g16 = function (o) { return view.getUint16(o, little); };
            var g32 = function (o) { return view.getUint32(o, little); };
            var ifd0 = tiff + g32(tiff + 4);
            var gpsOff = readIFD(view, g16, g32, tiff, ifd0, 0x8825);
            if (gpsOff == null) return null;
            var gps = tiff + gpsOff;
            var lat = readCoord(view, g16, g32, tiff, gps, 2);
            var lng = readCoord(view, g16, g32, tiff, gps, 4);
            var latRef = readRef(view, g16, g32, tiff, gps, 1);
            var lngRef = readRef(view, g16, g32, tiff, gps, 3);
            if (lat == null || lng == null) return null;
            if (latRef === "S") lat = -lat;
            if (lngRef === "W") lng = -lng;
            return { lat: lat, lng: lng };
          }
          offset += segLen; continue;
        }
        if (marker === 0xFFDA) break;
        offset += 2 + view.getUint16(offset + 2);
      }
    } catch (e) {}
    return null;
  }
  function readIFD(view, g16, g32, tiff, ifd, tag) {
    var n = g16(ifd);
    for (var i = 0; i < n; i++) {
      var e = ifd + 2 + i * 12;
      if (g16(e) === tag) return g32(e + 8);
    }
    return null;
  }
  function readCoord(view, g16, g32, tiff, gps, tag) {
    var n = g16(gps);
    for (var i = 0; i < n; i++) {
      var e = gps + 2 + i * 12;
      if (g16(e) === tag) {
        var o = tiff + g32(e + 8);
        var d = g32(o) / g32(o + 4), m = g32(o + 8) / g32(o + 12), s = g32(o + 16) / g32(o + 20);
        return d + m / 60 + s / 3600;
      }
    }
    return null;
  }
  function readRef(view, g16, g32, tiff, gps, tag) {
    var n = g16(gps);
    for (var i = 0; i < n; i++) {
      var e = gps + 2 + i * 12;
      if (g16(e) === tag) return String.fromCharCode(view.getUint8(tiff + g32(e + 8)));
    }
    return null;
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    $all("[data-add]").forEach(function (b) { b.onclick = function () { openModal(b.dataset.add); }; });
    $("#fabTrash").onclick = function () { openModal("trash"); };
    $("#btnTrashHero").onclick = function () { openModal("trash"); };
    $("#btnTrashSection").onclick = function () { openModal("trash"); };
    $("#btnEditAbout").onclick = function () { openModal("about"); };

    $all("[data-close]").forEach(function (el) { el.onclick = closeModals; });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModals(); });

    // 足迹照片：选图自动读 GPS 填经纬度
    var photoInput = $('#modalPhoto input[name="url"]');
    if (photoInput) photoInput.addEventListener("change", function () {
      var file = this.files[0]; if (!file) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          var gps = parseExifGPS(r.result);
          if (gps) {
            var la = $('#modalPhoto input[name="lat"]'), lo = $('#modalPhoto input[name="lng"]');
            if (!la.value) la.value = gps.lat.toFixed(5);
            if (!lo.value) lo.value = gps.lng.toFixed(5);
          }
        } catch (e) {}
      };
      r.readAsArrayBuffer(file);
    });

    // 表单提交（统一委托）
    document.body.addEventListener("submit", function (e) {
      var form = e.target.closest("form[data-form]");
      if (!form) return;
      e.preventDefault();
      var type = form.dataset.form, f = form, el = function (n) { return f.elements.namedItem(n); };
      if (type === "timeline") {
        var t = el("title").value.trim(); if (!t) return;
        store.timeline.push({ id: uid(), date: el("date").value || todayISO(), title: t, desc: el("desc").value.trim() });
        save(); render(); closeModals();
      } else if (type === "feed") {
        var txt = el("text").value.trim(); if (!txt) return;
        fileToDataURL(el("photo").files[0], function (photo) {
          store.feed.push({ id: uid(), date: el("date").value || todayISO(), mood: state.moodFeed, text: txt, photo: photo });
          save(); render(); closeModals();
        });
      } else if (type === "post") {
        var pt = el("title").value.trim(); if (!pt) return;
        store.posts.push({ id: uid(), date: el("date").value || todayISO(), cat: el("cat").value, title: pt, cover: el("cover").value.trim(), body: el("body").value.trim() });
        save(); render(); closeModals();
      } else if (type === "work") {
        var wn = el("name").value.trim(); if (!wn) return;
        store.works.push({ id: uid(), name: wn, role: el("role").value.trim(), desc: el("desc").value.trim(), stack: el("stack").value.trim(), cover: el("cover").value.trim(), link: el("link").value.trim() });
        save(); render(); closeModals();
      } else if (type === "photo") {
        var pl = el("place").value.trim(); if (!pl) return;
        fileToDataURL(el("url").files[0], function (url) {
          var lat = parseFloat(el("lat").value), lng = parseFloat(el("lng").value);
          store.photos.push({ id: uid(), place: pl, date: el("date").value || todayISO(), title: el("title").value.trim(), lat: isNaN(lat) ? null : lat, lng: isNaN(lng) ? null : lng, url: url });
          save(); render(); closeModals();
        });
      } else if (type === "trash") {
        store.trash.push({ id: uid(), date: todayISO(), mood: state.moodTrash, text: el("text").value.trim(), resolved: false });
        save(); render(); closeModals();
      } else if (type === "about") {
        store.profile.name = el("name").value.trim() || "拾光";
        store.profile.slogan = el("slogan").value.trim();
        store.profile.avatar = el("avatar").value.trim();
        store.profile.hero = el("hero").value.trim();
        store.about = el("about").value.trim();
        save(); render(); closeModals();
      }
    });

    // 删除 / 已释怀 / 地图列表 / 文章详情（点击委托）
    document.body.addEventListener("click", function (e) {
      var del = e.target.closest("[data-del]");
      if (del) {
        var type = del.dataset.del, id = del.dataset.id;
        if (confirm("确定删除这条记录吗？")) {
          store[type] = store[type].filter(function (x) { return x.id !== id; });
          save(); render();
        }
        return;
      }
      var resolve = e.target.closest("[data-resolve]");
      if (resolve) {
        var rid = resolve.dataset.resolve;
        store.trash.forEach(function (x) { if (x.id === rid) x.resolved = !x.resolved; });
        save(); render();
        return;
      }
      var mapItem = e.target.closest(".map-item");
      if (mapItem) {
        selectPlace(mapItem.dataset.id);
        return;
      }
      var postCard = e.target.closest(".post-card");
      if (postCard && !e.target.closest(".post-card__del")) { openPostView(postCard.dataset.id); return; }
    });

    // 备份
    $("#btnExport").onclick = function () {
      var blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "拾光备份-" + todayISO() + ".json"; a.click();
      URL.revokeObjectURL(a.href);
    };
    $("#btnImport").onclick = function () { $("#fileImport").click(); };
    $("#fileImport").onchange = function () {
      var file = this.files[0]; if (!file) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          var d = JSON.parse(r.result);
          if (!d || !Array.isArray(d.timeline) || !Array.isArray(d.posts) || !Array.isArray(d.trash)) throw new Error("格式不对");
          if (confirm("导入将覆盖当前所有记录，确定继续？")) { store = d; save(); render(); }
        } catch (err) { alert("导入失败：文件不是有效的拾光备份。"); }
        finally { $("#fileImport").value = ""; }
      };
      r.readAsText(file);
    };

    // 滚动进度条
    window.addEventListener("scroll", function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      $("#scrollBar").style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + "%";
    }, { passive: true });
  }

  /* ---------- 进场动画 ---------- */
  function bindReveal() {
    var els = $all(".reveal");
    if (!("IntersectionObserver" in window)) { els.forEach(function (el) { el.classList.add("is-visible"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-visible"); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 导航当前态 ---------- */
  function initNavSpy() {
    var links = $all(".nav__links a");
    if (!links.length) return;
    var map = {};
    links.forEach(function (a) {
      var href = a.getAttribute("href");
      if (href && href.charAt(0) === "#") map[href.slice(1)] = a;
    });
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          links.forEach(function (l) { l.classList.remove("is-active"); });
          var a = map[en.target.id];
          if (a) a.classList.add("is-active");
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) io.observe(el);
    });
  }

  /* ---------- GSAP 滚动动效（Hallmark 节奏 + GSAP 引擎） ---------- */
  function initMotion() {
    var gsap = window.gsap, ST = window.ScrollTrigger;
    gsap.registerPlugin(ST);
    var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Hero 巨型「天数」count-up
    var daysEl = document.getElementById("statDays");
    if (daysEl && !reduced) {
      var target = parseInt(daysEl.textContent, 10) || 0;
      if (target > 0) {
        var counter = { v: 0 };
        gsap.to(counter, {
          v: target, duration: 1.8, ease: "power2.out",
          onUpdate: function () { daysEl.textContent = Math.round(counter.v).toLocaleString("en-US"); }
        });
      }
    }

    if (reduced) return;

    // 通用 reveal：遮罩 + 位移进场
    gsap.utils.toArray(".reveal").forEach(function (el) {
      gsap.from(el, {
        opacity: 0, y: 36, filter: "blur(6px)", duration: 0.9, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true }
      });
    });

    // 宣言大字逐行 stagger
    var lines = gsap.utils.toArray(".manifesto__line");
    if (lines.length) {
      gsap.from(lines, {
        opacity: 0, y: 44, duration: 1, ease: "power3.out", stagger: 0.14,
        scrollTrigger: { trigger: ".manifesto", start: "top 78%", once: true }
      });
    }

    // 地图区入场
    var mapWrap = document.getElementById("mapWrap");
    if (mapWrap) {
      gsap.from(mapWrap, {
        opacity: 0, y: 50, duration: 1, ease: "power3.out",
        scrollTrigger: { trigger: mapWrap, start: "top 82%", once: true }
      });
    }

    // 时间线逐项浮现
    if (document.getElementById("timelineList")) {
      gsap.from(".tl-item", {
        opacity: 0, x: -24, duration: 0.7, ease: "power2.out", stagger: 0.08,
        scrollTrigger: { trigger: "#timelineList", start: "top 82%", once: true }
      });
    }

    // 卡片瀑布流入场
    gsap.utils.toArray(".post-card, .work-card, .feed-card, .trash-card").forEach(function (card) {
      gsap.from(card, {
        opacity: 0, y: 28, duration: 0.6, ease: "power2.out",
        scrollTrigger: { trigger: card, start: "top 94%", once: true }
      });
    });
  }

  /* ---------- 启动 ---------- */
  function init() {
    bind();
    render();
    initNavSpy();
    if (window.gsap && window.ScrollTrigger) {
      try { initMotion(); } catch (e) {}
    } else {
      bindReveal();
    }
    if (window.initParticles) {
      try { window.initParticles(document.getElementById("heroParticles")); } catch (e) {}
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
