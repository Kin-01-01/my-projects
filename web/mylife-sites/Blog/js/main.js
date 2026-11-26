/* ============================================================
   灯下 · 一个人的随笔  —  交互与动效
   纯前端 · localStorage 持久化 · GSAP 滚动叙事
   ============================================================ */
(function () {
  "use strict";

  var STORAGE_KEY = "dengxia:entries:v1";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 种子随笔（首次打开时填入） ---------- */
  var SEED = [
    {
      id: "s1",
      title: "在实验室里学会慢",
      tag: "科研",
      date: "2026-09-12",
      body: "电解槽冒出的气泡很慢，慢到我以为它停了。师兄说，氢不出来不是没反应，是还没到时候。我忽然觉得，自己的急也是一种噪声。那天起，我学会了把'没结果'也记进本子里。"
    },
    {
      id: "s2",
      title: "普通话里的乡下",
      tag: "乡愁",
      date: "2026-08-30",
      body: "课堂上我一开口，尾音就露了馅。同学笑，我也笑。可夜里写日记，还是用老家那套说法才顺手。普通话说的是'外面'，乡音说的才是'我'。这盏灯下，我允许自己慢半拍。"
    },
    {
      id: "s3",
      title: "不想当老师，但可以当光",
      tag: "随笔",
      date: "2026-07-18",
      body: "师范的名字压在胸口很久。我不想站讲台，却愿意把白天学到的、夜里想通的，一字一句留给未来的自己。灯下没有学生，只有读者——而那个读者，首先是我。"
    }
  ];

  /* ---------- 存储 ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED));
    return SEED.slice();
  }
  function save(list) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (e) {}
  }

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function totalWords(list) {
    return list.reduce(function (n, e) { return n + (e.title.length + e.body.length); }, 0);
  }
  function fmtDate(d) {
    d = d || new Date();
    var p = function (x) { return (x < 10 ? "0" : "") + x; };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  /* ---------- 渲染归档 ---------- */
  var feed = document.getElementById("feed");
  var emptyTip = document.getElementById("emptyTip");
  var archiveTotal = document.getElementById("archiveTotal");

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
        card.innerHTML =
          '<div class="card__top"><span class="card__date">' + esc(e.date) + "</span>" +
          (e.tag ? '<span class="card__tag">' + esc(e.tag) + "</span>" : "") + "</div>" +
          '<h3 class="card__title">' + esc(e.title) + "</h3>" +
          '<p class="card__body">' + esc(e.body) + "</p>" +
          '<button class="card__del" data-del="' + e.id + '">删去</button>';
        feed.appendChild(card);
      });
    }
    updateStats(list);
    if (window.gsap && !reduce) animateCards();
  }

  /* ---------- 统计数字 ---------- */
  var statWords = document.getElementById("statWords");
  var statEntries = document.getElementById("statEntries");
  function updateStats(list) {
    var words = totalWords(list);
    var count = list.length;
    if (window.gsap && !reduce) {
      countUp(statWords, words);
      countUp(statEntries, count);
    } else {
      statWords.textContent = words;
      statEntries.textContent = count;
    }
  }
  function countUp(el, target) {
    var obj = { v: 0 };
    window.gsap.to(obj, {
      v: target, duration: 1.6, ease: "power2.out",
      onUpdate: function () { el.textContent = Math.round(obj.v); }
    });
  }

  /* ---------- 写作 ---------- */
  var form = document.getElementById("entryForm");
  var fTitle = document.getElementById("fTitle");
  var fTag = document.getElementById("fTag");
  var fBody = document.getElementById("fBody");
  var bodyCount = document.getElementById("bodyCount");

  fBody.addEventListener("input", function () {
    bodyCount.textContent = fBody.value.length + " 字";
  });

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var title = fTitle.value.trim();
    var body = fBody.value.trim();
    if (!title && !body) return;
    var list = load();
    list.unshift({
      id: "e" + Date.now(),
      title: title || "无题",
      tag: fTag.value.trim(),
      date: fmtDate(new Date()),
      body: body || "（留白也是一种写法）"
    });
    save(list);
    fTitle.value = ""; fTag.value = ""; fBody.value = ""; bodyCount.textContent = "0 字";
    render();
    document.getElementById("archive").scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  });

  document.getElementById("clearDraft").addEventListener("click", function () {
    fTitle.value = ""; fTag.value = ""; fBody.value = ""; bodyCount.textContent = "0 字";
  });

  feed.addEventListener("click", function (ev) {
    var id = ev.target.getAttribute("data-del");
    if (!id) return;
    var list = load().filter(function (e) { return e.id !== id; });
    save(list);
    render();
  });

  /* ---------- 导航 / 进度 / 时钟 ---------- */
  var nav = document.getElementById("nav");
  var progressBar = document.getElementById("progressBar");
  var links = Array.prototype.slice.call(document.querySelectorAll(".nav__links a"));

  window.addEventListener("scroll", function () {
    var h = document.documentElement;
    var sc = h.scrollTop;
    var max = h.scrollHeight - h.clientHeight;
    progressBar.style.width = (max > 0 ? (sc / max) * 100 : 0) + "%";
    nav.classList.toggle("is-stuck", sc > 40);
  }, { passive: true });

  var spyTargets = links.map(function (a) { return document.getElementById(a.dataset.spy); });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          links.forEach(function (a) {
            a.classList.toggle("is-active", a.dataset.spy === en.target.id);
          });
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    spyTargets.forEach(function (t) { if (t) io.observe(t); });
  }

  function tick() {
    var d = new Date();
    var p = function (x) { return (x < 10 ? "0" : "") + x; };
    var t = p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
    document.getElementById("clock").textContent = t;
    document.getElementById("footClock").textContent = t;
  }
  tick(); setInterval(tick, 1000);

  /* ---------- GSAP 滚动叙事 ---------- */
  function initMotion() {
    var gsap = window.gsap;
    if (window.ScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);

    // Hero 标题遮罩上滑
    gsap.from(".hero__line .word", {
      yPercent: 120, duration: 1.1, ease: "power4.out", stagger: 0.12, delay: 0.15
    });
    gsap.from(".hero__kicker, .hero__lead, .hero__meta, .hero__scroll", {
      y: 24, opacity: 0, duration: 0.9, ease: "power2.out", stagger: 0.1, delay: 0.5
    });

    // 区块标题
    gsap.utils.toArray(".section__head").forEach(function (head) {
      gsap.from(head, {
        scrollTrigger: { trigger: head, start: "top 85%" },
        y: 30, opacity: 0, duration: 0.8, ease: "power3.out"
      });
    });

    // 段落逐行浮现
    gsap.utils.toArray(".reveal").forEach(function (el) {
      gsap.from(el, {
        scrollTrigger: { trigger: el, start: "top 88%" },
        y: 22, opacity: 0, duration: 0.7, ease: "power2.out"
      });
    });

    // 灯下视差
    gsap.to(".lamp", {
      scrollTrigger: { trigger: "body", start: "top top", end: "bottom bottom", scrub: true },
      yPercent: 30, ease: "none"
    });
  }

  function animateCards() {
    window.gsap.fromTo(".card",
      { y: 26, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: "power2.out", stagger: 0.08, overwrite: true }
    );
  }

  /* ---------- 启动 ---------- */
  render();
  if (window.gsap && !reduce) {
    initMotion();
  } else {
    // 无动效兜底：标题直接可见
    document.querySelectorAll(".hero__line .word").forEach(function (w) { w.style.transform = "none"; });
  }
})();
