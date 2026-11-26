/* 零度栈 · 全站共享脚本（守卫式初始化，同一份在所有页面安全运行） */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 主题切换 ---------- */
  var root = document.documentElement;
  var saved = localStorage.getItem('theme');
  if (saved) root.setAttribute('data-theme', saved);
  var moon = document.getElementById('iconMoon');
  var sun = document.getElementById('iconSun');
  function syncIcon() {
    var dark = root.getAttribute('data-theme') !== 'light';
    if (moon) moon.style.display = dark ? 'block' : 'none';
    if (sun) sun.style.display = dark ? 'none' : 'block';
  }
  syncIcon();
  var themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    syncIcon();
  });

  /* ---------- 移动菜单 ---------- */
  var menuBtn = document.getElementById('menuBtn');
  var navLinks = document.getElementById('navLinks');
  if (menuBtn && navLinks) {
    menuBtn.addEventListener('click', function () { navLinks.classList.toggle('open'); });
    navLinks.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { navLinks.classList.remove('open'); });
    });
  }

  /* ---------- 导航高亮当前页 ---------- */
  if (navLinks) {
    var cur = (location.pathname.split('/').pop() || 'index.html');
    navLinks.querySelectorAll('a').forEach(function (a) {
      var href = a.getAttribute('href');
      if (href && href.split('/').pop() === cur) a.classList.add('active');
    });
  }

  /* ---------- 入场观察 ----------
     注意：必须等下方 featGrid / track / faq 等动态节点创建完再调用 initReveals()，
     否则动态生成的 .reveal 元素不会被注册，会一直停留在 opacity:0（空区块 BUG）。 */
  function initReveals() {
    if ('IntersectionObserver' in window && !reduce) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
        });
      }, { threshold: 0.12 });
      document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
    } else {
      /* 无 IO 或用户偏好减少动效：直接显示，不隐藏任何内容 */
      document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
    }
  }

  /* ---------- Toast 助手（订阅 / 联系共用） ---------- */
  var toast = document.getElementById('toast');
  var toastMsg = document.getElementById('toastMsg');
  var toastT = null;
  function showToast(msg) {
    if (!toast) return;
    if (msg && toastMsg) toastMsg.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toast.classList.remove('show'); }, 3200);
  }

  /* ---------- 共享图标库（Lucide 风格，硬编码 SVG） ---------- */
  var ICONS = {
    route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
    code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
    grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-5a4 4 0 0 1-4 4 4 4 0 0 1-4-4z"/>',
    trend: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    fn: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 17c2 0 2-4 4-4 1 0 1.5.5 2 .5 1 0 1.5-.5 2-.5"/><path d="M9 12c2 0 2-4 4-4 1 0 1.5.5 2 .5 1 0 1.5-.5 2-.5"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    award: '<path d="m15.5 12.9 1.5 8.5a.5.5 0 0 1-.8.5l-3.6-2.7a1 1 0 0 0-1.2 0l-3.6 2.7a.5.5 0 0 1-.8-.5l1.5-8.5"/><circle cx="12" cy="8" r="6"/>',
    rotate: '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
    flask: '<path d="M9 3h6"/><path d="M10 3v6.5L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9.5V3"/><path d="M7.5 15h9"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 3 2 7.5 2 11a7 7 0 0 1-10 7Z"/><path d="M2 22c1.5-3 4-5 8-6"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/>',
    star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bolt: '<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>'
  };

  /* ---------- 首页：特性网格 ---------- */
  var FEATURES = [
    { i: 'route', c: 'ico-violet', t: '学习路线图', d: '把大目标拆成每周可执行的节点，路线一目了然，不再迷茫从哪开始。' },
    { i: 'code', c: 'ico-pink', t: '代码练习', d: '每天一段手写代码，从 Python 到算法，错误当场暴露、当场修。' },
    { i: 'grid', c: 'ico-cyan', t: '项目作品集', d: '每个项目单独成卡，附链接与技术栈标签，成长有迹可循。' },
    { i: 'book', c: 'ico-violet', t: '笔记知识库', d: '读过的书与文档沉淀为结构化笔记，搜索即取，不复读即忘。' },
    { i: 'trend', c: 'ico-pink', t: '进度追踪', d: '语言与方向用进度条可视化，哪块薄弱一眼看清，分配时间更准。' },
    { i: 'fn', c: 'ico-cyan', t: '算法训练', d: '按专题刷经典题，复杂度与思路一起练，面试不再慌。' },
    { i: 'users', c: 'ico-violet', t: '社区交流', d: '和同伴组队打卡、互评代码，孤独的自学也能有队友。' },
    { i: 'award', c: 'ico-pink', t: '证书成就', d: '二级、三级与在线课程证书集中陈列，给努力一个实体勋章。' },
    { i: 'rotate', c: 'ico-cyan', t: '每周复盘', d: '周日花 20 分钟回看，什么有效、什么该砍，下周更轻。' }
  ];
  var fg = document.getElementById('featGrid');
  if (fg) {
    FEATURES.forEach(function (f, idx) {
      var el = document.createElement('div');
      el.className = 'card reveal ' + f.c;
      el.style.setProperty('--i', idx % 3);
      el.innerHTML = '<div class="badge"><svg viewBox="0 0 24 24">' + ICONS[f.i] + '</svg></div><h3>' + f.t + '</h3><p>' + f.d + '</p>';
      fg.appendChild(el);
    });
  }

  /* ---------- 首页：评价轮播 ---------- */
  var VOICES = [
    { img: 'assets/avatars/Professional_portrait_headshot_2026-09-22T13-11-04.png', n: '林知微', r: '产品设计 · 同校队友', q: '他把自己从物理跨到代码的每一步都记下来了，我照着路线走，省掉了至少半年的乱撞。' },
    { img: 'assets/avatars/male/Portrait_of_a_young_man_softwa_2026-09-22T13-16-48.png', n: '陈默', r: '后端工程师 · 实验室学长', q: '复盘页是我最服的一点，能把每周踩的坑写清楚的人，进步速度天然就快一倍。' },
    { img: 'assets/avatars/Professional_portrait_headshot_2026-09-22T13-11-05.png', n: '苏雅', r: 'CTO · 创业导师', q: '一个师范生能把技术栈搭得这么清楚，说明他不是在学工具，是在建自己的体系。这种人值得带。' }
  ];
  var track = document.getElementById('track');
  if (track) {
    var dotsWrap = document.getElementById('dots');
    var starSvg = '<svg viewBox="0 0 24 24"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z"/></svg>';
    VOICES.forEach(function (v) {
      var s = document.createElement('div');
      s.className = 'slide';
      s.innerHTML = '<div class="quote-card"><div class="stars">' + starSvg.repeat(5) + '</div><blockquote>“' + v.q + '”</blockquote><div class="who"><img src="' + v.img + '" alt="' + v.n + '" loading="lazy"/><div><div class="nm">' + v.n + '</div><div class="rl">' + v.r + '</div></div></div></div>';
      track.appendChild(s);
      var d = document.createElement('button');
      d.setAttribute('aria-label', '切换到第' + (VOICES.indexOf(v) + 1) + '条');
      dotsWrap.appendChild(d);
    });
    var dots = Array.prototype.slice.call(dotsWrap.children);
    var cur2 = 0;
    function go(i) {
      cur2 = (i + VOICES.length) % VOICES.length;
      track.style.transform = 'translateX(-' + cur2 * 100 + '%)';
      dots.forEach(function (d, k) { d.classList.toggle('on', k === cur2); });
    }
    dots.forEach(function (d, k) { d.addEventListener('click', function () { go(k); restart(); }); });
    go(0);
    var timer = null;
    function start() { if (!reduce) timer = setInterval(function () { go(cur2 + 1); }, 5000); }
    function restart() { clearInterval(timer); start(); }
    start();
    var car = document.getElementById('carousel');
    car.addEventListener('mouseenter', function () { clearInterval(timer); });
    car.addEventListener('mouseleave', start);
    var sx = 0, dragging = false, moved = 0;
    car.addEventListener('pointerdown', function (e) { dragging = true; sx = e.clientX; moved = 0; car.setPointerCapture(e.pointerId); clearInterval(timer); });
    car.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      moved = e.clientX - sx;
      track.style.transform = 'translateX(calc(-' + cur2 * 100 + '% + ' + moved + 'px))';
    });
    car.addEventListener('pointerup', function () {
      if (!dragging) return; dragging = false;
      var w = car.clientWidth;
      if (Math.abs(moved) > w * 0.18) go(cur2 + (moved < 0 ? 1 : -1)); else go(cur2);
      restart();
    });
    car.addEventListener('pointercancel', function () { dragging = false; go(cur2); restart(); });
  }

  /* ---------- 首页：FAQ ---------- */
  var FAQS = [
    { q: '这个站点用什么做的？', a: '纯原生 HTML、CSS 和 JavaScript，零框架依赖，多个页面共用同一套样式与脚本。动效只用到 transform 与 opacity，流畅且不卡。' },
    { q: '我也能照着搭一个自己的吗？', a: '当然。路线、项目和复盘的结构都能直接复用，把内容换成你自己的就行。重点是先有记录，再有成长。' },
    { q: '亮色和暗色怎么切换？', a: '右上角的圆形按钮一键切换，选择会记在浏览器里，下次打开还是你喜欢的样子。默认是暗色宇宙背景。' },
    { q: '内容多久更新一次？', a: '学习路线随课程走，项目和复盘每周更新，月度订阅信则每月一封，只写真东西。' },
    { q: '适合完全零基础的人看吗？', a: '适合。路线从第一行代码讲起，每一步都标了难度与前置条件，不会一上来就劝退。' }
  ];
  var faq = document.getElementById('faqList');
  if (faq) {
    FAQS.forEach(function (f, idx) {
      var el = document.createElement('div');
      el.className = 'faq-item reveal';
      el.style.setProperty('--i', idx % 3);
      el.innerHTML = '<button class="faq-q">' + f.q + '<svg class="chev" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button><div class="faq-a"><div><p>' + f.a + '</p></div></div>';
      el.querySelector('.faq-q').addEventListener('click', function () {
        var open = el.classList.contains('open');
        faq.querySelectorAll('.faq-item').forEach(function (x) { x.classList.remove('open'); });
        if (!open) el.classList.add('open');
      });
      faq.appendChild(el);
    });
  }

  /* ---------- 首页：订阅 ---------- */
  var subForm = document.getElementById('subForm');
  if (subForm) {
    var subBtn = document.getElementById('subBtn');
    subForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = document.getElementById('email').value.trim();
      var ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!ok) { showToast('邮箱格式好像不太对，检查一下？'); return; }
      subBtn.classList.add('btn-loading'); subBtn.disabled = true;
      setTimeout(function () {
        subBtn.classList.remove('btn-loading'); subBtn.disabled = false;
        subForm.reset();
        showToast('订阅成功，欢迎上车。');
      }, 1300);
    });
  }

  /* ---------- 联系页：表单 ---------- */
  var contactForm = document.getElementById('contactForm');
  if (contactForm) {
    var contactBtn = document.getElementById('contactBtn');
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('cName').value.trim();
      var email = document.getElementById('cEmail').value.trim();
      var msg = document.getElementById('cMsg').value.trim();
      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !msg) {
        showToast('信息还没填全，确认一下称呼、邮箱和留言。');
        return;
      }
      contactBtn.classList.add('btn-loading'); contactBtn.disabled = true;
      setTimeout(function () {
        contactBtn.classList.remove('btn-loading'); contactBtn.disabled = false;
        contactForm.reset();
        showToast('已收到，我会尽快回复你。');
      }, 1300);
    });
  }

  /* ---------- 内容页：筛选 ---------- */
  var filterWrap = document.getElementById('filters');
  if (filterWrap) {
    var items = Array.prototype.slice.call(document.querySelectorAll('.item'));
    filterWrap.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        filterWrap.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('on'); });
        chip.classList.add('on');
        var type = chip.getAttribute('data-filter');
        items.forEach(function (it) {
          var show = type === 'all' || it.getAttribute('data-type') === type;
          it.classList.toggle('filtered-out', !show);
        });
      });
    });
  }

  /* ---------- 顶部滚动进度条 ---------- */
  function initScrollProgress() {
    var bar = document.createElement('div');
    bar.className = 'scroll-prog';
    bar.setAttribute('role', 'progressbar');
    bar.setAttribute('aria-label', '页面阅读进度');
    bar.style.width = '0%';
    document.body.appendChild(bar);
    var ticking = false;
    function update() {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var pct = max > 0 ? (h.scrollTop || document.body.scrollTop) / max * 100 : 0;
      if (pct < 0) pct = 0; if (pct > 100) pct = 100;
      bar.style.width = pct.toFixed(2) + '%';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---------- 回到顶部按钮 ---------- */
  function initBackToTop() {
    var btn = document.createElement('button');
    btn.className = 'back-top';
    btn.setAttribute('aria-label', '回到顶部');
    btn.innerHTML = '<svg viewBox="0 0 24 24"><path d="m18 15-6-6-6 6"/></svg>';
    document.body.appendChild(btn);
    var shown = false;
    function toggle() {
      var y = document.documentElement.scrollTop || document.body.scrollTop;
      var on = y > 360;
      if (on !== shown) { btn.classList.toggle('show', on); shown = on; }
    }
    window.addEventListener('scroll', toggle, { passive: true });
    btn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); });
    toggle();
  }

  /* ---------- 路线树：勾选进度（localStorage 记忆） ---------- */
  function initRoadmapTree() {
    var boxes = Array.prototype.slice.call(document.querySelectorAll('.rchk'));
    if (!boxes.length) return;
    var KEY = 'roadmapTreeProgress';
    var fill = document.getElementById('rtreeFill');
    var doneEl = document.getElementById('rtreeDone');
    var totalEl = document.getElementById('rtreeTotal');
    var pctEl = document.getElementById('rtreePct');
    var resetBtn = document.getElementById('rtreeReset');
    function render() {
      var total = boxes.length, done = 0;
      boxes.forEach(function (b) { if (b.checked) done++; });
      var pct = total ? Math.round(done / total * 100) : 0;
      if (fill) fill.style.width = pct + '%';
      if (doneEl) doneEl.textContent = done;
      if (totalEl) totalEl.textContent = total;
      if (pctEl) pctEl.textContent = pct + '%';
    }
    function persist() {
      var ids = boxes.filter(function (b) { return b.checked; })
        .map(function (b) { return b.getAttribute('data-id'); });
      try { localStorage.setItem(KEY, ids.join(',')); } catch (e) {}
    }
    function restore() {
      var raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) {}
      if (!raw) return;
      var set = raw.split(',').filter(Boolean);
      boxes.forEach(function (b) {
        if (set.indexOf(b.getAttribute('data-id')) > -1) b.checked = true;
      });
    }
    boxes.forEach(function (b) {
      b.addEventListener('change', function () { render(); persist(); });
    });
    if (resetBtn) resetBtn.addEventListener('click', function () {
      boxes.forEach(function (b) { b.checked = false; });
      render(); persist();
    });
    restore();
    render();
  }

  /* ---------- 所有动态内容就位后，统一注册入场观察与交互增强 ---------- */
  initReveals();
  initSpotlight();
  initScrollProgress();
  initBackToTop();
  initRoadmapTree();

  /* ---------- 路线图页：背景光圈（粉色虚化光晕跟随鼠标） ----------
     光球与宇宙光球同级、位于内容之下：rAF + 低速缓动(0.07)跟随鼠标，
     有大光晕特有的“拖尾感”；difference 混合使经过区域与背景颜色互换。
     粉/紫/青三层光晕叠放，累计移动一段距离自动轮换（颜色可交换）。
     减少动效或触屏直接关闭。 */
  function initSpotlight() {
    var orb = document.getElementById('mouseOrb');
    if (!orb) return;
    if (reduce || !window.matchMedia('(hover:hover)').matches) { orb.style.display = 'none'; return; }
    var layers = orb.querySelectorAll('.c');
    var tx = window.innerWidth / 2, ty = window.innerHeight * 0.38;
    var cx = tx, cy = ty, ticking = false, acc = 0, idx = 0;
    function frame() {
      var dx = tx - cx, dy = ty - cy;
      cx += dx * 0.07; cy += dy * 0.07;
      orb.style.transform = 'translate(' + cx + 'px,' + cy + 'px) translate(-50%,-50%)';
      acc += Math.abs(dx) + Math.abs(dy);
      if (acc > 900) {
        acc = 0; idx = (idx + 1) % layers.length;
        for (var k = 0; k < layers.length; k++) layers[k].classList.toggle('on', k === idx);
      }
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) requestAnimationFrame(frame);
      else ticking = false;
    }
    function kick() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
    window.addEventListener('mousemove', function (e) { tx = e.clientX; ty = e.clientY; kick(); }, { passive: true });
    orb.style.transform = 'translate(' + cx + 'px,' + cy + 'px) translate(-50%,-50%)';
  }
})();
