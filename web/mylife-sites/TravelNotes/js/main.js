/* ============================================================
   拾光 · 一个人的旅行笔记  —  交互与动效
   纯前端 · localStorage · ECharts 足迹地图 · GSAP · 封面照
   模块：首屏实拍视频 / 年度时间轴 / 人物地图网络 / 可编辑归档 / 照片墙
   ============================================================ */
(function () {
  "use strict";

  var STORAGE_KEY = "shiguang:entries:v1";
  var PHOTO_KEY = "shiguang:photos:v1";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 旧键迁移 ----------
     品牌由「途记」更名为「拾光」时换了存储命名空间。
     这里做一次性接管：新键为空而旧键有数据时，把旧数据平移过来，
     确保已经写过的旅途记录与照片墙不会因为换名而丢失。 */
  (function migrateLegacyKeys() {
    try {
      var pairs = [["tuji:entries:v3", STORAGE_KEY], ["tuji:photos:v1", PHOTO_KEY]];
      for (var i = 0; i < pairs.length; i++) {
        var oldKey = pairs[i][0], newKey = pairs[i][1];
        if (!localStorage.getItem(newKey) && localStorage.getItem(oldKey)) {
          localStorage.setItem(newKey, localStorage.getItem(oldKey));
        }
      }
    } catch (e) {}
  })();

  /* ---------- 家乡（地图枢纽） ---------- */
  var HOME = { place: "吴桥", full: "河北沧州 · 吴桥县", coord: [116.3852, 37.6284] };

  /* ---------- 图表字体栈 ----------
     ECharts 走 canvas 绘制，读不到 CSS 变量，这条栈只能在这里重复一份。
     顺序与 css/styles.css 的 --display 保持一致：去掉 Google Fonts 之后，
     若这里仍只写 "Noto Serif SC"，本机没装该字体时 canvas 会直接掉到
     无衬线默认值——地图上的城市名会由衬线悄悄变成无衬线。 */
  var SERIF_STACK = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", '
                  + '"STSong", "SimSun", "宋体", serif';

  /* ---------- 城市坐标表（新记录填了地点即可自动上图） ---------- */
  var CITY_COORDS = {
    "大同": [113.3001, 40.0768], "北京": [116.4074, 39.9042], "天津": [117.2010, 39.0842],
    "沧州": [116.8387, 38.3045], "吴桥": [116.3852, 37.6284], "德州": [116.3595, 37.4367],
    "济南": [117.1205, 36.6519], "日照": [119.5268, 35.4164], "南京": [118.7969, 32.0603]
  };
  function coordFor(place) {
    if (!place) return null;
    var p = String(place).trim();
    if (CITY_COORDS[p]) return CITY_COORDS[p];
    for (var k in CITY_COORDS) { if (CITY_COORDS.hasOwnProperty(k) && p.indexOf(k) >= 0) return CITY_COORDS[k]; }
    return null;
  }

  /* ---------- 八城旅途（首次打开时填入，已挂真实封面照） ---------- */
  var SEED = [
    {
      id: "c1", title: "石窟里的千年", place: "大同", tag: "古都", date: "2026-03-28",
      coord: [113.3001, 40.0768], img: "assets/photo-datong.jpg",
      body: "云冈的佛像是风化的，也是被看见的。站在最大的那尊脚下抬头，我忽然觉得自己那点焦虑，小得像一粒沙。出窟时天上飘着细雪，落在肩上，很轻。"
    },
    {
      id: "c2", title: "在巨大的城市里找自己", place: "北京", tag: "首都", date: "2026-04-12",
      coord: [116.4074, 39.9042], img: "assets/photo-beijing.jpg",
      body: "地铁口的人流像一条不会停的河。我一个人从胡同走到天安门，走了两万步。城市太大，反而看清了自己有多小——但小，也可以认真地走。"
    },
    {
      id: "c3", title: "海河边的晚风与相声", place: "天津", tag: "津门", date: "2026-04-20",
      coord: [117.2010, 39.0842], img: "assets/photo-tianjin.jpg",
      body: "五大道的老洋房排排站着，像没说完的故事。晚上坐海河边听相声，笑到脸酸。天津的松弛是骨子里的——它不急着让你喜欢它。"
    },
    {
      id: "c4", title: "运河边的安静", place: "沧州", tag: "运河", date: "2026-05-09",
      coord: [116.8387, 38.3045],
      body: "运河的水面很平，平得能照见天。这里号称武术之乡，可我遇见的都是慢下来的人。一个人在堤上坐到天黑，什么也没做，却觉得饱了。"
    },
    {
      id: "c5", title: "平原上的黄昏", place: "德州", tag: "平原", date: "2026-05-17",
      coord: [116.3595, 37.4367],
      body: "一望无际的平原，落日大得离谱。买了只扒鸡坐在路边啃，油纸被风吹得哗哗响。原来辽阔不一定要高山，平坦到没有尽头，也是一种震。"
    },
    {
      id: "c6", title: "泉水叮咚的城市", place: "济南", tag: "泉城", date: "2026-06-02",
      coord: [117.1205, 36.6519],
      body: "趵突泉真的在冒，咕嘟咕嘟，像这座城的心跳。大明湖边柳枝垂进水里，我蹲着看了很久。济南不张扬，可它的水一直在说话。"
    },
    {
      id: "c7", title: "第一次看见海", place: "日照", tag: "海", date: "2026-07-26",
      coord: [119.5268, 35.4164],
      body: "活到现在第一次站在海边。浪比想象中吵，也比想象中温柔。脱了鞋踩进水里，凉意从脚底窜上来——那一刻，书上的'广阔'终于有了形状。"
    },
    {
      id: "c8", title: "梧桐与旧城墙", place: "南京", tag: "金陵", date: "2026-08-15",
      coord: [118.7969, 32.0603], img: "assets/photo-nanjing.jpg",
      body: "满城的梧桐把夏天筛成斑驳的光。城墙根下有人唱戏，有人遛鸟。走过秦淮河时天刚擦黑，桨声灯影全在，我忽然懂了什么叫'慢下来才看见'。"
    }
  ];
  var PENDING_PHOTOS = { "沧州": true, "德州": true, "济南": true, "日照": true };

  /* ---------- 照片墙种子（人生瞬间 · 随拍随笔） ---------- */
  var PHOTO_SEED = [
    { id: "g1", src: "assets/hero-cover.jpg", caption: "夜里开的花。感谢我所遇到过所有出色的人。", date: "2026-06-10", theme: "生活" },
    { id: "g2", src: "assets/moment-2.jpg", caption: "夜色沉下来的时候，花反而更亮。", date: "2026-06-12", theme: "随拍" },
    { id: "g3", src: "assets/moment-3.jpg", caption: "有些美好只存在几秒，正因为短，才记得牢。", date: "2026-06-15", theme: "生活" }
  ];

  /* ---------- 存储 ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED)); } catch (e) {}
    return SEED.slice();
  }
  function save(list) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (e) {} }
  function loadPhotos() {
    try {
      var raw = localStorage.getItem(PHOTO_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    try { localStorage.setItem(PHOTO_KEY, JSON.stringify(PHOTO_SEED)); } catch (e) {}
    return PHOTO_SEED.slice();
  }
  function savePhotos(list) { try { localStorage.setItem(PHOTO_KEY, JSON.stringify(list)); } catch (e) {} }

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function distinctPlaces(list) {
    var seen = {};
    list.forEach(function (e) { if (e.place) seen[e.place] = 1; });
    return Object.keys(seen).length;
  }
  function fmtDate(d) {
    d = d || new Date();
    var p = function (x) { return (x < 10 ? "0" : "") + x; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function byDateAsc(a, b) { var x = a.date || "9999-99-99", y = b.date || "9999-99-99"; return x === y ? 0 : (x < y ? -1 : 1); }
  function byDateDesc(a, b) { var x = a.date || "", y = b.date || ""; return x === y ? 0 : (x > y ? -1 : 1); }
  function cityPoints(list) { return list.filter(function (e) { return e.coord && e.coord.length === 2; }); }
  function sortedPoints(list) { return cityPoints(list).slice().sort(byDateAsc); }
  function monthLabel(m) { var mm = m.slice(5, 7); return (mm.charAt(0) === "0" ? mm.slice(1) : mm) + " 月"; }

  /* ---------- 渲染：归档 ---------- */
  var feed = document.getElementById("feed");
  var emptyTip = document.getElementById("emptyTip");
  var archiveTotal = document.getElementById("archiveTotal");

  /* ---------- 图像渐显 ----------
     只给「确实还在加载」的图挂 is-loading；已缓存完成的图不挂类、不淡入。
     万一 JS 失效，则没有任何类被挂上，图片照常显示（不会白屏）。 */
  function markLoadingImgs(root) {
    var scope = root || document;
    Array.prototype.forEach.call(scope.querySelectorAll("img:not(.fade)"), function (img) {
      img.classList.add("fade");
      if (!img.complete || img.naturalWidth === 0) img.classList.add("is-loading");
    });
  }
  /* load 不冒泡，但捕获阶段在 document 上能收到后代图片的 load */
  document.addEventListener("load", function (ev) {
    var t = ev.target;
    if (t && t.tagName === "IMG") t.classList.remove("is-loading");
  }, true);

  function render() {
    var list = load();
    feed.innerHTML = "";
    if (!list.length) {
      emptyTip.hidden = false;
      archiveTotal.textContent = "0 篇";
    } else {
      emptyTip.hidden = true;
      archiveTotal.textContent = list.length + " 篇";
      list.forEach(function (e) {
        var card = document.createElement("article");
        card.className = "card";
        card.dataset.id = e.id;
        if (e.place) card.dataset.place = e.place;
        var cover = "";
        if (e.img) {
          cover = '<div class="card__cover"><img src="' + esc(e.img) + '" alt="' + esc(e.title) + '" loading="lazy"></div>';
        } else if (e.place && PENDING_PHOTOS[e.place]) {
          cover = '<div class="card__cover card__cover--todo"><span class="card__cover-todo">封面照待补充</span></div>';
        }
        card.innerHTML =
          cover +
          '<div class="card__top"><span class="card__date">' + esc(e.date) + "</span>" +
          (e.tag ? '<span class="card__tag">' + esc(e.tag) + "</span>" : "") + "</div>" +
          (e.place ? '<p class="card__place">' + esc(e.place) + "</p>" : "") +
          '<h3 class="card__title">' + esc(e.title) + "</h3>" +
          '<p class="card__body">' + esc(e.body) + "</p>" +
          '<div class="card__acts">' +
            '<button type="button" class="card__act" data-edit="' + e.id + '">编辑</button>' +
            '<button type="button" class="card__del" data-del="' + e.id + '">删去</button>' +
          "</div>";
        feed.appendChild(card);
      });
    }
    updateStats(list);
    renderTimeline(list);
    renderLegend(list);
    renderMap(list);
    refreshDetail(list);
    if (window.gsap && !reduce) animateCards();
    markLoadingImgs();
  }

  /* ---------- 统计数字 ---------- */
  var statPlaces = document.getElementById("statPlaces");
  var statEntries = document.getElementById("statEntries");
  function updateStats(list) {
    var places = distinctPlaces(list), count = list.length;
    if (window.gsap && !reduce) { countUp(statPlaces, places); countUp(statEntries, count); }
    else { statPlaces.textContent = places; statEntries.textContent = count; }
  }
  function countUp(el, target) {
    var obj = { v: 0 };
    window.gsap.to(obj, { v: target, duration: 1.6, ease: "power2.out", onUpdate: function () { el.textContent = Math.round(obj.v); } });
  }

  /* ---------- 年度回看 · 纵向时间轴（按月份） ---------- */
  var tlList = document.getElementById("tlList");
  var tlCount = document.getElementById("tlCount");
  function renderTimeline(list) {
    if (!tlList) return;
    var dated = list.filter(function (e) { return e.date; }).slice().sort(byDateAsc);
    var groups = {}, order = [];
    dated.forEach(function (e) {
      var m = String(e.date).slice(0, 7);
      if (!groups[m]) { groups[m] = []; order.push(m); }
      groups[m].push(e);
    });
    if (tlCount) tlCount.textContent = order.length + " 个月";
    if (!order.length) { tlList.innerHTML = '<p class="tl__empty">还没有可以回看的日子。写第一则，这条线就开始了。</p>'; return; }
    tlList.innerHTML = order.map(function (m) {
      var items = groups[m];
      var rows = items.map(function (e) {
        return '<button type="button" class="tl__item" data-id="' + esc(e.id) + '" data-place="' + esc(e.place || "") + '">' +
          '<span class="tl__date">' + esc(e.date) + "</span>" +
          '<span class="tl__ttl">' + esc(e.title) + "</span>" +
          (e.place ? '<span class="tl__pl">' + esc(e.place) + "</span>" : "") +
        "</button>";
      }).join("");
      return '<div class="tl__month">' +
        '<div class="tl__label"><span class="tl__m">' + monthLabel(m) + '</span>' +
        '<span class="tl__sub">' + m.slice(0, 4) + " · " + items.length + " 站</span></div>" +
        '<div class="tl__items">' + rows + "</div></div>";
    }).join("");
  }
  if (tlList) {
    tlList.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".tl__item");
      if (!btn) return;
      var place = btn.getAttribute("data-place");
      if (place) selectCity(place);
      focusCardById(btn.getAttribute("data-id"));
    });
  }

  /* ---------- 足迹地图（ECharts + 合规中国矢量 + 家乡枢纽） ---------- */
  var chart = null;
  var mapCount = document.getElementById("mapCount");
  var mapLegend = document.getElementById("mapLegend");
  var mapDetail = document.getElementById("mapDetail");
  var currentPlace = null;

  function renderLegend(list) {
    var pts = sortedPoints(list);
    if (mapCount) mapCount.textContent = pts.length + " 座城";
    var rows = ['<li class="is-home" data-home="1"><span class="lg-idx lg-idx--home">★</span>' +
      '<span class="lg-name">吴桥</span><span class="lg-tag">家乡</span><span class="lg-date">起点</span></li>'];
    pts.forEach(function (e, i) {
      rows.push('<li data-place="' + esc(e.place) + '"><span class="lg-idx">' + (i + 1) + "</span>" +
        '<span class="lg-name">' + esc(e.place) + "</span>" +
        (e.tag ? '<span class="lg-tag">' + esc(e.tag) + "</span>" : "") +
        '<span class="lg-date">' + esc(e.date) + "</span></li>");
    });
    mapLegend.innerHTML = rows.join("");
  }

  function renderMapDetail(entry) {
    if (!mapDetail) return;
    if (!entry) {
      mapDetail.innerHTML = '<p class="map__detail-empty">点一个光点，或从下面挑一座城——那一站的相片与字会在这里展开。</p>';
      return;
    }
    var cover = "";
    if (entry.img) cover = '<div class="map__detail-cover"><img src="' + esc(entry.img) + '" alt="' + esc(entry.title) + '" loading="lazy"></div>';
    else if (entry.place && PENDING_PHOTOS[entry.place]) cover = '<div class="map__detail-cover map__detail-cover--todo"><span class="map__detail-empty">封面照待补充</span></div>';
    mapDetail.innerHTML =
      cover +
      '<div class="map__detail-meta"><span class="map__detail-place">→ ' + esc(entry.place) + "</span>" +
      (entry.tag ? '<span class="lg-tag">' + esc(entry.tag) + "</span>" : "") +
      '<span class="map__detail-date">' + esc(entry.date) + "</span></div>" +
      '<h3 class="map__detail-title">' + esc(entry.title) + "</h3>" +
      '<p class="map__detail-body">' + esc(entry.body) + "</p>" +
      '<button type="button" class="map__detail-cta" data-goto="' + esc(entry.place) + '">读这一篇 →</button>';
    markLoadingImgs(mapDetail);
  }

  function renderHomeDetail() {
    if (!mapDetail) return;
    mapDetail.innerHTML =
      '<div class="map__detail-meta"><span class="map__detail-place">★ 家乡 · 吴桥</span>' +
      '<span class="lg-tag">河北沧州</span></div>' +
      '<h3 class="map__detail-title">一切从这里出发</h3>' +
      '<p class="map__detail-body">我的老家在河北沧州吴桥。地图上每一条向外散开的线，起点都是这里——走得再远，最后还是绕着它转。</p>';
  }

  function refreshDetail(list) {
    if (!mapDetail) return;
    if (currentPlace === HOME.place) { renderHomeDetail(); return; }
    var pts = cityPoints(list);
    var cur = currentPlace ? pts.filter(function (e) { return e.place === currentPlace; })[0] : null;
    if (cur) { renderMapDetail(cur); return; }
    var sorted = sortedPoints(list);
    if (sorted.length) { currentPlace = sorted[0].place; renderMapDetail(sorted[0]); }
    else { currentPlace = null; renderMapDetail(null); }
  }

  function initMap() {
    var el = document.getElementById("mapChart");
    if (!el) return;
    if (!window.echarts) { el.innerHTML = '<p style="padding:24px;color:rgba(232,238,240,.5)">地图引擎未加载</p>'; return; }
    if (window.CHINA_GEO) window.echarts.registerMap("china", window.CHINA_GEO);
    chart = window.echarts.init(el, null, { renderer: "canvas" });
    renderMap(load());
    var ro = window.ResizeObserver ? new ResizeObserver(function () { chart && chart.resize(); }) : null;
    if (ro) ro.observe(el); else window.addEventListener("resize", function () { chart && chart.resize(); });
    chart.on("click", function (p) {
      if (!p || p.seriesType !== "effectScatter" || !p.name) return;
      if (p.name === HOME.place) selectHome(); else selectCity(p.name);
    });
    setupZoomControls();
  }

  function renderMap(list) {
    if (!chart) return;
    var pts = sortedPoints(list);

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "rgba(14,23,28,0.92)",
        borderColor: "rgba(222,162,108,0.5)",
        textStyle: { color: "#e8eef0", fontSize: 12 }
      },
      geo: {
        map: "china",
        roam: true,
        scaleLimit: { min: 0.9, max: 10 },
        zoom: 1.02,
        left: 0, right: 0, top: 8, bottom: 8,
        label: { show: false },
        itemStyle: {
          areaColor: "#1a2c36",
          borderColor: "rgba(168,196,210,0.45)",
          borderWidth: 0.8,
          shadowColor: "rgba(0,0,0,0.5)",
          shadowBlur: 14
        },
        emphasis: { label: { show: false }, itemStyle: { areaColor: "#25414f" } },
        select: { disabled: true }
      },
      series: [
        {
          // 以家乡为中心的辐射网络
          type: "lines", coordinateSystem: "geo", silent: true, z: 3,
          data: pts.map(function (e) { return { coords: [HOME.coord, e.coord] }; }),
          lineStyle: { color: "#dea26c", width: 1.3, opacity: 0.6, curveness: 0.16 },
          effect: { show: true, period: 5, trailLength: 0.28, symbol: "circle", symbolSize: 3.2, color: "#e8b684" }
        },
        {
          type: "effectScatter", coordinateSystem: "geo", z: 4,
          data: pts.map(function (e) { return { name: e.place, value: e.coord }; }),
          symbolSize: 9,
          rippleEffect: { brushType: "stroke", scale: 3.4, period: 4 },
          itemStyle: { color: "#dea26c", shadowBlur: 12, shadowColor: "rgba(222,162,108,0.9)" },
          label: {
            show: true, position: "right", formatter: "{b}",
            color: "#e8eef0", fontSize: 11, fontFamily: SERIF_STACK, distance: 6
          },
          emphasis: { scale: 1.4, label: { show: true, color: "#e8b684" } },
          select: { disabled: true }
        },
        {
          // 家乡枢纽
          type: "effectScatter", coordinateSystem: "geo", z: 5,
          data: [{ name: HOME.place, value: HOME.coord }],
          symbol: "diamond", symbolSize: 16,
          rippleEffect: { brushType: "stroke", scale: 3.6, period: 3.6 },
          itemStyle: { color: "#a8c4d2", shadowBlur: 16, shadowColor: "rgba(168,196,210,0.95)" },
          label: {
            show: true, position: "bottom", formatter: "家乡 · 吴桥",
            color: "#c8dce6", fontSize: 12, fontFamily: SERIF_STACK, distance: 8
          },
          emphasis: { scale: 1.3 }, select: { disabled: true }
        }
      ]
    }, true);
  }

  function selectCity(place) {
    if (place === HOME.place) { selectHome(); return; }
    var entry = cityPoints(load()).filter(function (e) { return e.place === place; })[0];
    if (!entry) return;
    currentPlace = place;
    renderMapDetail(entry);
    Array.prototype.forEach.call(mapLegend.querySelectorAll("li"), function (li) {
      li.classList.toggle("is-active", li.dataset.place === place);
    });
  }
  function selectHome() {
    currentPlace = HOME.place;
    renderHomeDetail();
    Array.prototype.forEach.call(mapLegend.querySelectorAll("li"), function (li) {
      li.classList.toggle("is-active", li.dataset.home === "1");
    });
  }

  function pulse(card) {
    if (!card) return;
    Array.prototype.forEach.call(feed.querySelectorAll(".card"), function (c) { c.classList.remove("is-active"); });
    card.classList.add("is-active");
    card.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    setTimeout(function () { card.classList.remove("is-active"); }, 2600);
  }
  function focusCard(place) { pulse(feed.querySelector('.card[data-place="' + place + '"]')); }
  function focusCardById(id) { pulse(feed.querySelector('.card[data-id="' + id + '"]')); }

  if (mapLegend) {
    mapLegend.addEventListener("click", function (ev) {
      var li = ev.target.closest("li");
      if (!li) return;
      if (li.dataset.home === "1") selectHome(); else selectCity(li.dataset.place);
    });
  }
  if (mapDetail) {
    mapDetail.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-goto]");
      if (btn) focusCard(btn.getAttribute("data-goto"));
    });
  }

  /* ---------- 地图缩放（按钮 / 双击 / 滚轮 / 双指） ---------- */
  var ZOOM_BASE = 1.02, ZOOM_MIN = 0.9, ZOOM_MAX = 10;
  var defaultCenter = null;
  function clampZoom(z) { return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z)); }
  function computeGeoCenter() {
    var geo = window.CHINA_GEO;
    if (!geo || !geo.features) return null;
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    function walk(c) {
      if (!c) return;
      if (typeof c[0] === "number") {
        if (c[0] < minX) minX = c[0]; if (c[0] > maxX) maxX = c[0];
        if (c[1] < minY) minY = c[1]; if (c[1] > maxY) maxY = c[1];
      } else { for (var i = 0; i < c.length; i++) walk(c[i]); }
    }
    geo.features.forEach(function (f) { if (f && f.geometry && f.geometry.coordinates) walk(f.geometry.coordinates); });
    if (!isFinite(minX)) return null;
    return [(minX + maxX) / 2, (minY + maxY) / 2];
  }
  function currentView() {
    var z = ZOOM_BASE, c = null;
    try {
      var g = chart.getOption().geo && chart.getOption().geo[0];
      if (g && typeof g.zoom === "number") z = g.zoom;
    } catch (e) {}
    try {
      var el = document.getElementById("mapChart");
      c = chart.convertFromPixel({ geoIndex: 0 }, [el.clientWidth / 2, el.clientHeight / 2]);
    } catch (e) {}
    if (!c || isNaN(c[0])) c = defaultCenter;
    return { zoom: z, center: c };
  }
  function applyZoom(z, center) {
    if (!chart) return;
    z = clampZoom(z);
    var patch = { geo: { zoom: z } };
    if (center && center.length === 2 && !isNaN(center[0])) patch.geo.center = center;
    chart.setOption(patch);
  }
  function zoomAt(factor, anchorGeo) {
    var v = currentView();
    var z1 = clampZoom(v.zoom * factor);
    if (z1 === v.zoom) return;
    var center = v.center;
    if (anchorGeo && center) {
      var r = v.zoom / z1;
      center = [anchorGeo[0] - (anchorGeo[0] - center[0]) * r, anchorGeo[1] - (anchorGeo[1] - center[1]) * r];
    }
    applyZoom(z1, center);
  }
  function setupZoomControls() {
    if (!chart) return;
    try {
      var og = chart.getOption().geo && chart.getOption().geo[0];
      if (og && og.center) defaultCenter = og.center.slice();
    } catch (e) {}
    if (!defaultCenter) defaultCenter = computeGeoCenter();
    var box = document.querySelector(".map__zoom");
    if (box) {
      box.addEventListener("click", function (ev) {
        var btn = ev.target.closest("[data-zoom]");
        if (!btn) return;
        var act = btn.getAttribute("data-zoom");
        if (act === "in") zoomAt(1.4);
        else if (act === "out") zoomAt(1 / 1.4);
        else { var v = currentView(); applyZoom(ZOOM_BASE, defaultCenter || v.center); }
      });
    }
    chart.getZr().on("dblclick", function (e) {
      var src = e && e.event;
      var factor = src && src.shiftKey ? 1 / 1.7 : 1.7;
      var anchor = null;
      try { anchor = chart.convertFromPixel({ geoIndex: 0 }, [e.offsetX, e.offsetY]); } catch (err) {}
      zoomAt(factor, anchor);
    });
  }

  /* ---------- 点击放大（lightbox，支持图注） ---------- */
  var lightbox = document.getElementById("lightbox");
  var lightboxImg = document.getElementById("lightboxImg");
  var lightboxCap = document.getElementById("lightboxCap");
  /* 退场清理延时：与 CSS 的 --dur-3（360ms）对齐，留一点余量 */
  var LIGHTBOX_EXIT = 380;
  var lbExitTimer = null;

  function openLightbox(src, cap) {
    if (!lightbox || !src) return;
    if (lbExitTimer) { clearTimeout(lbExitTimer); lbExitTimer = null; }
    lightboxImg.src = src;
    if (lightboxCap) {
      if (cap) { lightboxCap.textContent = cap; lightboxCap.hidden = false; }
      else { lightboxCap.textContent = ""; lightboxCap.hidden = true; }
    }
    lightbox.classList.add("is-open");
    document.body.style.overflow = "hidden";
  }
  function resetLightboxContent() {
    lightboxImg.removeAttribute("src");
    if (lightboxCap) { lightboxCap.textContent = ""; lightboxCap.hidden = true; }
  }
  function closeLightbox() {
    if (!lightbox || !lightbox.classList.contains("is-open")) return;
    lightbox.classList.remove("is-open");
    document.body.style.overflow = "";
    if (lbExitTimer) clearTimeout(lbExitTimer);
    /* 图片/图注要等退场过渡跑完再清，否则淡出过程中看到的是一个空框 */
    if (reduce) { resetLightboxContent(); return; }
    lbExitTimer = setTimeout(resetLightboxContent, LIGHTBOX_EXIT);
  }
  if (lightbox) {
    lightbox.addEventListener("click", function (ev) {
      if (ev.target === lightbox || ev.target.closest(".lightbox__close")) closeLightbox();
    });
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") closeLightbox(); });
  }

  /* ---------- 归档卡片：封面放大 / 编辑 / 删去 ---------- */
  feed.addEventListener("click", function (ev) {
    var coverImg = ev.target.closest(".card__cover img");
    if (coverImg) {
      var c = ev.target.closest(".card");
      openLightbox(coverImg.getAttribute("src"), c ? (c.querySelector(".card__title") || {}).textContent : "");
      return;
    }
    var editId = ev.target.getAttribute("data-edit");
    if (editId) { startEdit(editId); return; }
    var delId = ev.target.getAttribute("data-del");
    if (delId) { save(load().filter(function (e) { return e.id !== delId; })); render(); }
  });

  /* ---------- 编辑器（新建 / 编辑同一处） ---------- */
  var form = document.getElementById("entryForm");
  var fTitle = document.getElementById("fTitle");
  var fPlace = document.getElementById("fPlace");
  var fTag = document.getElementById("fTag");
  var fDate = document.getElementById("fDate");
  var fBody = document.getElementById("fBody");
  var bodyCount = document.getElementById("bodyCount");
  var fCover = document.getElementById("fCover");
  var coverWrap = document.getElementById("coverWrap");
  var coverPreview = document.getElementById("coverPreview");
  var coverRemove = document.getElementById("coverRemove");
  var submitBtn = document.getElementById("submitBtn");
  var cancelEdit = document.getElementById("cancelEdit");
  var editingHint = document.getElementById("editingHint");
  var pendingCover = null;
  var editingId = null;

  fBody.addEventListener("input", function () { bodyCount.textContent = fBody.value.length + " 字"; });

  function compressImage(file, maxW, cb) {
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var w = img.width, h = img.height;
        var scale = Math.min(1, maxW / w);
        var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
        var c = document.createElement("canvas");
        c.width = cw; c.height = ch;
        c.getContext("2d").drawImage(img, 0, 0, cw, ch);
        try { cb(c.toDataURL("image/jpeg", 0.82)); } catch (err) { cb(reader.result); }
      };
      img.onerror = function () { cb(reader.result); };
      img.src = reader.result;
    };
    reader.onerror = function () { pendingCover = null; };
    reader.readAsDataURL(file);
  }
  function showCover(src) {
    if (src) { coverPreview.src = src; coverWrap.hidden = false; }
    else { coverWrap.hidden = true; coverPreview.removeAttribute("src"); }
  }
  if (fCover) {
    fCover.addEventListener("change", function () {
      var file = fCover.files && fCover.files[0];
      if (!file) return;
      compressImage(file, 1280, function (dataUrl) { pendingCover = dataUrl; showCover(dataUrl); });
    });
  }
  if (coverRemove) {
    coverRemove.addEventListener("click", function () { pendingCover = null; if (fCover) fCover.value = ""; showCover(null); });
  }
  function clearFields() {
    fTitle.value = ""; fPlace.value = ""; fTag.value = ""; fBody.value = "";
    if (fDate) fDate.value = fmtDate(new Date());
    bodyCount.textContent = "0 字";
    pendingCover = null; if (fCover) fCover.value = ""; showCover(null);
  }
  function endEdit() {
    editingId = null;
    if (submitBtn) submitBtn.textContent = "落笔";
    if (cancelEdit) cancelEdit.hidden = true;
    if (editingHint) { editingHint.hidden = true; editingHint.textContent = ""; }
    clearFields();
  }
  function startEdit(id) {
    var e = load().filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    editingId = id;
    fTitle.value = e.title || "";
    fPlace.value = e.place || "";
    fTag.value = e.tag || "";
    fBody.value = e.body || "";
    if (fDate) fDate.value = e.date || fmtDate(new Date());
    bodyCount.textContent = fBody.value.length + " 字";
    pendingCover = e.img || null;
    showCover(pendingCover);
    if (submitBtn) submitBtn.textContent = "保存修改";
    if (cancelEdit) cancelEdit.hidden = false;
    if (editingHint) {
      editingHint.hidden = false;
      editingHint.textContent = "正在修改『" + (e.title || "无题") + "』 · " + (e.place || "未标地点") + " " + (e.date || "");
    }
    document.getElementById("write").scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    try { fTitle.focus({ preventScroll: true }); } catch (err) { fTitle.focus(); }
  }
  if (cancelEdit) cancelEdit.addEventListener("click", function () { endEdit(); });

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var title = fTitle.value.trim(), body = fBody.value.trim();
    if (!title && !body) return;
    var list = load();
    var place = fPlace.value.trim(), tag = fTag.value.trim();
    var date = (fDate && fDate.value) ? fDate.value : fmtDate(new Date());
    var coord = coordFor(place);
    if (editingId) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id !== editingId) continue;
        list[i].title = title || "无题";
        list[i].place = place;
        list[i].tag = tag;
        list[i].date = date;
        list[i].body = body || "（留白也是一种走法）";
        if (pendingCover) list[i].img = pendingCover; else delete list[i].img;
        if (coord) list[i].coord = coord; else delete list[i].coord;
        break;
      }
    } else {
      var item = { id: "e" + Date.now(), title: title || "无题", place: place, tag: tag, date: date, body: body || "（留白也是一种走法）" };
      if (pendingCover) item.img = pendingCover;
      if (coord) item.coord = coord;
      list.unshift(item);
    }
    save(list);
    endEdit();
    render();
    document.getElementById("archive").scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  });

  document.getElementById("clearDraft").addEventListener("click", function () { endEdit(); });

  /* ---------- 照片墙 ---------- */
  var galleryWall = document.getElementById("galleryWall");
  var galleryEmpty = document.getElementById("galleryEmpty");
  var galleryCount = document.getElementById("galleryCount");
  var galleryThemes = document.getElementById("galleryThemes");
  var photoForm = document.getElementById("photoForm");
  var photoFile = document.getElementById("photoFile");
  var photoFileLabel = document.getElementById("photoFileLabel");
  var photoPreview = document.getElementById("photoPreview");
  var photoCaption = document.getElementById("photoCaption");
  var photoTheme = document.getElementById("photoTheme");
  var photoDate = document.getElementById("photoDate");
  var galleryMode = "time", themeFilter = "", pendingShot = null;

  function shotHTML(p) {
    return '<figure class="shot" data-id="' + esc(p.id) + '">' +
      '<img src="' + esc(p.src) + '" alt="' + esc(p.caption || "照片") + '" loading="lazy">' +
      '<figcaption class="shot__cap">' +
        (p.caption ? '<p class="shot__txt">' + esc(p.caption) + "</p>" : "") +
        '<div class="shot__meta"><span class="shot__date">' + esc(p.date || "") + "</span>" +
        (p.theme ? '<span class="shot__theme">' + esc(p.theme) + "</span>" : "") +
        '<button type="button" class="shot__del" data-del-shot="' + esc(p.id) + '">删去</button>' +
        "</div></figcaption></figure>";
  }
  function renderThemeChips(themes) {
    if (!galleryThemes) return;
    var html = '<button type="button" class="gallery__theme' + (themeFilter === "" ? " is-active" : "") + '" data-theme="">全部</button>';
    themes.forEach(function (t) {
      html += '<button type="button" class="gallery__theme' + (themeFilter === t ? " is-active" : "") + '" data-theme="' + esc(t) + '">' + esc(t) + "</button>";
    });
    galleryThemes.innerHTML = html;
  }
  function renderGallery() {
    if (!galleryWall) return;
    var list = loadPhotos();
    if (galleryCount) galleryCount.textContent = list.length + " 张";
    var themes = [];
    list.forEach(function (p) { if (p.theme && themes.indexOf(p.theme) < 0) themes.push(p.theme); });
    renderThemeChips(themes);
    var items = list.filter(function (p) { return !themeFilter || p.theme === themeFilter; });
    if (!items.length) { galleryWall.innerHTML = ""; galleryWall.className = "gallery__wall"; if (galleryEmpty) galleryEmpty.hidden = false; return; }
    if (galleryEmpty) galleryEmpty.hidden = true;
    if (galleryMode === "theme") {
      galleryWall.className = "gallery__wall is-grouped";
      var groups = {}, order = [];
      items.forEach(function (p) { var t = p.theme || "未分类"; if (!groups[t]) { groups[t] = []; order.push(t); } groups[t].push(p); });
      order.sort();
      galleryWall.innerHTML = order.map(function (t) {
        var shots = groups[t].slice().sort(byDateDesc).map(shotHTML).join("");
        return '<div class="gtheme"><h3 class="gcount">' + esc(t) + "<span>" + groups[t].length + ' 张</span></h3><div class="gallery__wall">' + shots + "</div></div>";
      }).join("");
    } else {
      galleryWall.className = "gallery__wall";
      galleryWall.innerHTML = items.slice().sort(byDateDesc).map(shotHTML).join("");
    }
    markLoadingImgs(galleryWall);
  }
  var modes = document.querySelectorAll(".gallery__mode");
  Array.prototype.forEach.call(modes, function (btn) {
    btn.addEventListener("click", function () {
      galleryMode = btn.getAttribute("data-mode") || "time";
      Array.prototype.forEach.call(modes, function (b) { b.classList.toggle("is-active", b === btn); });
      renderGallery();
    });
  });
  if (galleryThemes) {
    galleryThemes.addEventListener("click", function (ev) {
      var btn = ev.target.closest("[data-theme]");
      if (!btn) return;
      themeFilter = btn.getAttribute("data-theme") || "";
      renderGallery();
    });
  }
  var openPhotoForm = document.getElementById("openPhotoForm");
  if (openPhotoForm && photoForm) {
    openPhotoForm.addEventListener("click", function () {
      photoForm.hidden = !photoForm.hidden;
      if (!photoForm.hidden && photoDate && !photoDate.value) photoDate.value = fmtDate(new Date());
    });
  }
  if (photoFile) {
    photoFile.addEventListener("change", function () {
      var file = photoFile.files && photoFile.files[0];
      if (!file) return;
      compressImage(file, 1600, function (dataUrl) {
        pendingShot = dataUrl;
        photoPreview.src = dataUrl; photoPreview.hidden = false;
        if (photoFileLabel) photoFileLabel.textContent = "换一张";
      });
    });
  }
  var cancelPhoto = document.getElementById("cancelPhoto");
  if (cancelPhoto && photoForm) {
    cancelPhoto.addEventListener("click", function () {
      photoForm.hidden = true; pendingShot = null;
      photoForm.reset();
      photoPreview.removeAttribute("src"); photoPreview.hidden = true;
      if (photoFileLabel) photoFileLabel.textContent = "＋ 选择照片";
    });
  }
  if (photoForm) {
    photoForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (!pendingShot) { try { window.alert("先选一张照片吧。"); } catch (e) {} return; }
      var list = loadPhotos();
      list.unshift({
        id: "p" + Date.now(),
        src: pendingShot,
        caption: (photoCaption.value || "").trim(),
        theme: (photoTheme.value || "").trim() || "随拍",
        date: (photoDate && photoDate.value) ? photoDate.value : fmtDate(new Date())
      });
      savePhotos(list);
      pendingShot = null;
      photoForm.reset();
      photoPreview.removeAttribute("src"); photoPreview.hidden = true;
      if (photoFileLabel) photoFileLabel.textContent = "＋ 选择照片";
      photoForm.hidden = true;
      themeFilter = "";
      renderGallery();
    });
  }
  if (galleryWall) {
    galleryWall.addEventListener("click", function (ev) {
      var del = ev.target.getAttribute("data-del-shot");
      if (del) { savePhotos(loadPhotos().filter(function (p) { return p.id !== del; })); renderGallery(); return; }
      var shot = ev.target.closest(".shot");
      if (!shot) return;
      var p = loadPhotos().filter(function (x) { return x.id === shot.dataset.id; })[0];
      if (p) openLightbox(p.src, p.caption || "");
    });
  }

  /* ---------- 首屏：封面 → 视频 ---------- */
  function initHero() {
    var video = document.getElementById("heroVideo");
    var cover = document.getElementById("heroCover");
    if (!video) return;

    if (reduce) {
      /* 减少动效：不播视频，只留封面这一帧（同时把 video 隐藏，省掉解码开销） */
      try { video.pause(); } catch (e) {}
      try { video.removeAttribute("autoplay"); } catch (e) {}
      video.style.display = "none";
      return;
    }

    var reveal = function () { if (cover) cover.classList.add("is-hidden"); };
    video.addEventListener("playing", reveal);
    video.addEventListener("timeupdate", function () { if (video.currentTime > 0.15) reveal(); });
    var tryPlay = video.play();
    if (tryPlay && tryPlay.catch) {
      tryPlay.catch(function () {
        var once = function () {
          video.play().catch(function () {});
          window.removeEventListener("pointerdown", once);
          window.removeEventListener("keydown", once);
        };
        window.addEventListener("pointerdown", once, { once: true });
        window.addEventListener("keydown", once, { once: true });
      });
    }

    /* 视频作为全局背景常驻播放：不再随滚动淡出或暂停，仅在标签页隐藏时省电暂停 */
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { try { video.pause(); } catch (e) {} }
      else { video.play().catch(function () {}); }
    });
  }

  /* ---------- 导航 / 进度 / 时钟 ---------- */
  var nav = document.getElementById("nav");
  var progressBar = document.getElementById("progressBar");
  var links = Array.prototype.slice.call(document.querySelectorAll(".nav__links a"));
  /* 滚动只登记一帧一次：进度条走 transform:scaleX（合成层），不触发重排 */
  var scrollQueued = false;
  function applyScroll() {
    scrollQueued = false;
    var h = document.documentElement;
    var sc = h.scrollTop, max = h.scrollHeight - h.clientHeight;
    var ratio = max > 0 ? Math.min(1, Math.max(0, sc / max)) : 0;
    if (progressBar) progressBar.style.transform = "scaleX(" + ratio + ")";
    if (nav) nav.classList.toggle("is-stuck", sc > 40);
  }
  window.addEventListener("scroll", function () {
    if (scrollQueued) return;
    scrollQueued = true;
    window.requestAnimationFrame(applyScroll);
  }, { passive: true });

  var spyTargets = links.map(function (a) { return document.getElementById(a.dataset.spy); });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.classList.toggle("is-active", a.dataset.spy === en.target.id); });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    spyTargets.forEach(function (t) { if (t) io.observe(t); });
  }

  function tick() {
    var d = new Date();
    var p = function (x) { return (x < 10 ? "0" : "") + x; };
    var t = p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
    var a = document.getElementById("clock"), b = document.getElementById("footClock");
    if (a) a.textContent = t; if (b) b.textContent = t;
  }
  tick(); setInterval(tick, 1000);

  /* ---------- GSAP 进场 ----------
     时长与 CSS token 同一套语言（秒）：1.1 ≈ 巨字入场／大面交接；0.62 = --dur-4 区块入场；0.5 = 列表项 */
  var T = { hero: 1.1, block: 0.62, item: 0.5 };
  function initMotion() {
    var gsap = window.gsap;
    if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);
    gsap.from(".hero__line .word", { yPercent: 120, duration: T.hero, ease: "power4.out", stagger: 0.12, delay: 0.1 });
    gsap.from(".hero__coord, .hero__kicker, .hero__lead, .hero__meta, .hero__scroll", { y: 26, opacity: 0, duration: T.block, ease: "power2.out", stagger: 0.09, delay: 0.4 });
    gsap.utils.toArray(".section__head").forEach(function (head) {
      gsap.from(head, { scrollTrigger: { trigger: head, start: "top 85%" }, y: 30, opacity: 0, duration: T.block, ease: "power3.out" });
    });
    gsap.utils.toArray(".reveal").forEach(function (el) {
      gsap.from(el, { scrollTrigger: { trigger: el, start: "top 88%" }, y: 22, opacity: 0, duration: T.item, ease: "power2.out" });
    });
  }
  function animateCards() {
    window.gsap.fromTo(".card", { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: T.item, ease: "power2.out", stagger: 0.07, overwrite: true });
  }

  /* ---------- 启动 ---------- */
  if (fDate && !fDate.value) fDate.value = fmtDate(new Date());
  if (photoDate && !photoDate.value) photoDate.value = fmtDate(new Date());
  render();
  initMap();
  renderGallery();
  initHero();
  if (window.gsap && !reduce) initMotion();
  else document.querySelectorAll(".hero__line .word").forEach(function (w) { w.style.transform = "none"; });
})();
