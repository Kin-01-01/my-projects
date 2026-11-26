/* =========================================================
   心迹 · 个人生活/轨迹/情绪记录本
   纯前端 · localStorage 本地保存 · 零依赖
   ========================================================= */
(function () {
  "use strict";

  var KEY = "xinji:lifelog:v1";

  // 心情字典（emoji + 文案）
  var MOODS = [
    { k: "happy", e: "😊", t: "开心" },
    { k: "calm", e: "😌", t: "平静" },
    { k: "warm", e: "🥰", t: "温暖" },
    { k: "excited", e: "🤩", t: "兴奋" },
    { k: "anxious", e: "😟", t: "焦虑" },
    { k: "sad", e: "😢", t: "难过" },
    { k: "angry", e: "😡", t: "愤怒" },
    { k: "tired", e: "🥱", t: "疲惫" },
    { k: "lost", e: "😕", t: "迷茫" },
    { k: "blank", e: "💭", t: "放空" }
  ];
  var MOOD_MAP = {};
  MOODS.forEach(function (m) { MOOD_MAP[m.k] = m; });

  // 默认数据（首次打开给一点示例，让用户知道怎么玩）
  var DEFAULT = {
    timeline: [
      { id: uid(), date: "2024-09-01", title: "踏入大学校门", desc: "来到河北北方学院，物理（师范）专业，一切都是新的开始。" },
      { id: uid(), date: "2025-03-10", title: "进入新能源材料实验室", desc: "跟着学长做电解水制氢，第一次碰电极材料。" }
    ],
    feed: [
      { id: uid(), date: "2026-09-18", mood: "excited", text: "机器学习课程终于推进到第二周了，虽然数学有点吃力，但看懂一个公式的瞬间很爽。", photo: "" }
    ],
    trash: [
      { id: uid(), date: "2026-09-15", mood: "anxious", text: "考研方向还没定下来，凝聚态和光学来回摇摆，有点慌。", resolved: false }
    ]
  };

  var store = load();
  var state = { writeTab: "timeline", moodFeed: "", moodTrash: "" };

  /* ---------- 工具 ---------- */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function todayISO() {
    var d = new Date();
    var m = ("0" + (d.getMonth() + 1)).slice(-2);
    var day = ("0" + d.getDate()).slice(-2);
    return d.getFullYear() + "-" + m + "-" + day;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function fileToDataURL(file, cb) {
    if (!file) return cb("");
    var r = new FileReader();
    r.onload = function () { cb(r.result); };
    r.onerror = function () { cb(""); };
    r.readAsDataURL(file);
  }

  /* ---------- 存储 ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return clone(DEFAULT);
      var d = JSON.parse(raw);
      d.timeline = d.timeline || [];
      d.feed = d.feed || [];
      d.trash = d.trash || [];
      return d;
    } catch (e) {
      return clone(DEFAULT);
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); }
    catch (e) { alert("保存失败：浏览器本地存储可能已满（照片太多会占空间）。"); }
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* ---------- 渲染 ---------- */
  function render() {
    renderTimeline();
    renderFeed();
    renderTrash();
    renderStats();
  }

  function renderTimeline() {
    var list = $("#timelineList");
    if (!store.timeline.length) { list.innerHTML = emptyHTML("还没有轨迹节点，点上方“+ 添加一个节点”"); return; }
    var items = store.timeline.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    list.innerHTML = items.map(function (n) {
      return '<div class="tl-item">' +
        '<button class="tl-del" data-del="timeline" data-id="' + n.id + '" title="删除">✕</button>' +
        '<div class="tl-date">' + esc(n.date) + '</div>' +
        '<div class="tl-title">' + esc(n.title) + '</div>' +
        (n.desc ? '<p class="tl-desc">' + esc(n.desc) + '</p>' : '') +
        '</div>';
    }).join("");
  }

  function renderFeed() {
    var list = $("#feedList");
    if (!store.feed.length) { list.innerHTML = emptyHTML("还没有生活记录，点上方“+ 记一笔生活”"); return; }
    var items = store.feed.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    list.innerHTML = items.map(function (n) {
      var mood = n.mood && MOOD_MAP[n.mood] ? MOOD_MAP[n.mood] : null;
      return '<div class="feed-card">' +
        '<button class="feed-card__del" data-del="feed" data-id="' + n.id + '" title="删除">✕</button>' +
        '<div class="feed-card__top">' +
        (mood ? '<span class="feed-card__mood">' + mood.e + '</span>' : '') +
        '<span class="feed-card__date">' + esc(n.date) + (mood ? ' · ' + mood.t : '') + '</span>' +
        '</div>' +
        '<p class="feed-card__text">' + esc(n.text) + '</p>' +
        (n.photo ? '<img class="feed-card__photo" src="' + n.photo + '" alt="配图" />' : '') +
        '</div>';
    }).join("");
  }

  function renderTrash() {
    var list = $("#trashList");
    if (!store.trash.length) { list.innerHTML = emptyHTML("垃圾桶是空的。心情不好的时候，点右下角 🗑 把它倒进来。"); return; }
    var items = store.trash.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    list.innerHTML = items.map(function (n) {
      var mood = n.mood && MOOD_MAP[n.mood] ? MOOD_MAP[n.mood] : null;
      return '<div class="trash-card' + (n.resolved ? ' is-resolved' : '') + '">' +
        '<div class="trash-card__top">' +
        (mood ? '<span class="trash-card__mood">' + mood.e + '</span>' : '') +
        '<span class="trash-card__date">' + esc(n.date) + (mood ? ' · ' + mood.t : '') + '</span>' +
        '</div>' +
        (n.text ? '<p class="trash-card__text">' + esc(n.text) + '</p>' : '<p class="trash-card__text" style="color:var(--muted)">（只标记了心情，没写文字）</p>') +
        '<div class="trash-card__actions">' +
        '<button data-resolve="' + n.id + '">' + (n.resolved ? "↩ 重新打开" : "✓ 已释怀") + '</button>' +
        '<button data-del="trash" data-id="' + n.id + '">🗑 清空这条</button>' +
        '</div>' +
        '</div>';
    }).join("");
  }

  function renderStats() {
    var allDates = []
      .concat(store.timeline.map(function (x) { return x.date; }))
      .concat(store.feed.map(function (x) { return x.date; }))
      .concat(store.trash.map(function (x) { return x.date; }));
    var days = 0;
    if (allDates.length) {
      var min = allDates.slice().sort()[0];
      var diff = Math.floor((Date.now() - new Date(min).getTime()) / 86400000);
      days = isNaN(diff) ? 0 : Math.max(1, diff + 1);
    }
    $("#statDays").textContent = days;
    $("#statFeed").textContent = store.feed.length;
    $("#statMood").textContent = store.trash.length;
  }

  function emptyHTML(tip) {
    return '<div class="empty">' + esc(tip) + '</div>';
  }

  /* ---------- 弹窗 ---------- */
  function openWrite(tab) {
    state.writeTab = tab || "timeline";
    state.moodFeed = "";
    $("#formWrite").reset();
    $all(".modal__tab").forEach(function (t) { t.classList.toggle("is-active", t.dataset.tab === state.writeTab); });
    $all('.form__pane').forEach(function (p) { p.hidden = p.dataset.pane !== state.writeTab; });
    buildMoodGrid($("#moodGridFeed"), "feed");
    $("#modalWrite").hidden = false;
  }
  function openTrash() {
    state.moodTrash = "";
    $("#formTrash").reset();
    buildMoodGrid($("#moodGridTrash"), "trash");
    $("#modalTrash").hidden = false;
  }
  function closeModals() {
    $("#modalWrite").hidden = true;
    $("#modalTrash").hidden = true;
  }
  function buildMoodGrid(container, which) {
    container.innerHTML = MOODS.map(function (m) {
      return '<button type="button" class="mood-chip" data-mood="' + m.k + '">' +
        '<span class="mood-chip__e">' + m.e + '</span>' +
        '<span class="mood-chip__t">' + m.t + '</span>' +
        '</button>';
    }).join("");
    container.onclick = function (e) {
      var chip = e.target.closest(".mood-chip");
      if (!chip) return;
      var k = chip.dataset.mood;
      if (which === "feed") state.moodFeed = state.moodFeed === k ? "" : k;
      else state.moodTrash = state.moodTrash === k ? "" : k;
      $all(".mood-chip", container).forEach(function (c) {
        c.classList.toggle("is-active", c.dataset.mood === (which === "feed" ? state.moodFeed : state.moodTrash));
      });
    };
  }

  /* ---------- 事件绑定 ---------- */
  function bind() {
    // 写一笔
    $("#btnWrite").onclick = function () { openWrite("timeline"); };
    $("#btnTrashHero").onclick = openTrash;
    $("#btnTrashSection").onclick = openTrash;
    $("#fabTrash").onclick = openTrash;

    // 区块内“添加”按钮
    $all("[data-add]").forEach(function (b) {
      b.onclick = function () { openWrite(b.dataset.add); };
    });

    // 弹窗 tab 切换
    $all(".modal__tab").forEach(function (t) {
      t.onclick = function () {
        state.writeTab = t.dataset.tab;
        $all(".modal__tab").forEach(function (x) { x.classList.toggle("is-active", x === t); });
        $all('.form__pane').forEach(function (p) { p.hidden = p.dataset.pane !== state.writeTab; });
      };
    });

    // 关闭（背景 / 关闭按钮 / 取消）
    $all("[data-close]").forEach(function (el) { el.onclick = closeModals; });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModals(); });

    // 写一笔提交
    $("#formWrite").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      if (state.writeTab === "timeline") {
        var date = f.date.value || todayISO();
        var title = f.title.value.trim();
        if (!title) return;
        store.timeline.push({ id: uid(), date: date, title: title, desc: f.desc.value.trim() });
      } else {
        var d2 = f.date2.value || todayISO();
        var text = f.text.value.trim();
        if (!text) return;
        fileToDataURL(f.photo.files[0], function (photo) {
          store.feed.push({ id: uid(), date: d2, mood: state.moodFeed, text: text, photo: photo });
          save(); render(); closeModals();
        });
        return; // 异步分支已处理保存
      }
      save(); render(); closeModals();
    });

    // 情绪垃圾桶提交
    $("#formTrash").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target;
      store.trash.push({ id: uid(), date: todayISO(), mood: state.moodTrash, text: f.text.value.trim(), resolved: false });
      save(); render(); closeModals();
    });

    // 删除 / 已释怀（事件委托）
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
      }
    });

    // 主题切换
    $("#themeToggle").onclick = function () {
      var cur = document.documentElement.getAttribute("data-theme");
      var next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      $("#themeToggle").textContent = next === "dark" ? "☀️" : "🌙";
      try { localStorage.setItem("xinji:theme", next); } catch (e) {}
    };

    // 备份导出 / 导入
    $("#btnExport").onclick = function () {
      var blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "心迹备份-" + todayISO() + ".json";
      a.click();
      URL.revokeObjectURL(a.href);
    };
    $("#btnImport").onclick = function () { $("#fileImport").click(); };
    $("#fileImport").onchange = function () {
      var file = this.files[0];
      if (!file) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          var d = JSON.parse(r.result);
          if (!d || !Array.isArray(d.timeline) || !Array.isArray(d.feed) || !Array.isArray(d.trash)) {
            throw new Error("格式不对");
          }
          if (confirm("导入将覆盖当前所有记录，确定继续？")) {
            store = d; save(); render();
          }
        } catch (err) { alert("导入失败：文件不是有效的心迹备份。"); }
        finally { $("#fileImport").value = ""; }
      };
      r.readAsText(file);
    };

    // 滚动进度条
    window.addEventListener("scroll", function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? (window.scrollY / h) * 100 : 0;
      $("#scrollBar").style.width = p + "%";
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

  /* ---------- 启动 ---------- */
  function init() {
    var t = "light";
    try { t = localStorage.getItem("xinji:theme") || "light"; } catch (e) {}
    document.documentElement.setAttribute("data-theme", t);
    $("#themeToggle").textContent = t === "dark" ? "☀️" : "🌙";
    bind();
    render();
    bindReveal();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
