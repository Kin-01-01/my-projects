/* ============================================================
   零度栈 · 内嵌知识树（3D 知识星系）
   直接渲染在 index.html 的 #knowledge-tree 区块内。
   数据来自 window.ZeroStack.knowledgeTree（knowledge-tree-data.js）。
   交互全在页内：拖拽旋转 / 滚轮缩放 / Shift·右键平移 /
   点击展开收起 / 叶子弹窗。绝不跳页、不丢上下文。
   ============================================================ */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var stage = document.getElementById('ktStage');
  var canvas = document.getElementById('ktCanvas');
  if (!stage || !canvas) return;
  var ctx = canvas.getContext('2d');

  /* ---------- 数据端口接入 ---------- */
  var TREE = (window.ZeroStack && window.ZeroStack.knowledgeTree) || null;
  if (!TREE) {
    stage.insertAdjacentHTML('beforeend',
      '<div style="position:absolute;inset:0;display:grid;place-items:center;color:#7e93c4;' +
      'font-size:14px;text-align:center;padding:30px">知识树数据端口未接入。<br>请引入 knowledge-tree-data.js。</div>');
    return;
  }

  /* ---------- 预处理 ---------- */
  var all = [], idc = 0, maxDepth = 0;
  (function prep(n, parent, depth) {
    n._id = idc++; n._parent = parent; n._depth = depth;
    n._children = n.children || [];
    n._expanded = depth < 3;
    n._lit = n.status === 'learning' || (parent && parent._lit);
    n._x = 0; n._y = 0; n._z = 0;
    n._tx = 0; n._ty = 0; n._tz = 0;
    n._alpha = 0; n._born = 0; n._visible = false; n._wasVisible = false;
    n._dir = null; n._seed = Math.random();
    if (depth > maxDepth) maxDepth = depth;
    all.push(n);
    n._children.forEach(function (c) { prep(c, n, depth + 1); });
  })(TREE, null, 0);

  /* ---------- 视口与相机 ---------- */
  var W = 0, H = 0, DPR = 1;
  var LEVEL = 155, FOV = 1500;
  var rotX = -0.32, rotY = 0.6, zoom = 1, panX = 0, panY = 0;
  var zoomInit = false;

  /* ---------- 3D 工具 ---------- */
  function cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
  function norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; }
  function ortho(axis) {
    var a = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    var u = norm(cross(axis, a));
    var v = cross(axis, u);
    return [u, v];
  }
  // 在以 axis 为轴的圆锥内均匀生成 count 个方向（half=半顶角；half=PI 即整球）
  function fibCone(count, axis, half) {
    var dirs = [], i;
    if (!count) return dirs;
    var basis = ortho(axis), u = basis[0], v = basis[1];
    var GA = 2.399963229728653;
    for (i = 0; i < count; i++) {
      var cosT = 1 - (i + 0.5) / count * (1 - Math.cos(half));
      var theta = Math.acos(Math.max(-1, Math.min(1, cosT)));
      var phi = i * GA, st = Math.sin(theta);
      dirs.push(norm([
        axis[0]*Math.cos(theta) + (u[0]*Math.cos(phi) + v[0]*Math.sin(phi)) * st,
        axis[1]*Math.cos(theta) + (u[1]*Math.cos(phi) + v[1]*Math.sin(phi)) * st,
        axis[2]*Math.cos(theta) + (u[2]*Math.cos(phi) + v[2]*Math.sin(phi)) * st
      ]));
    }
    return dirs;
  }
  function place(n, dir, depth) {
    n._dir = dir;
    var r = depth * LEVEL;
    n._tx = dir[0]*r; n._ty = dir[1]*r; n._tz = dir[2]*r;
    var kids = n._children;
    if (kids.length) {
      var half = Math.max(0.42, 1.15 - depth * 0.11);
      var cds = fibCone(kids.length, dir, half);
      kids.forEach(function (c, i) { place(c, cds[i], depth + 1); });
    }
  }
  function layout3D() {
    TREE._tx = 0; TREE._ty = 0; TREE._tz = 0;
    var rd = fibCone(TREE._children.length, [0, 1, 0], Math.PI); // 根节点向全空间发散
    TREE._children.forEach(function (c, i) { place(c, rd[i], 1); });
  }

  function computeVisible() {
    TREE._visible = true;
    (function rec(n) {
      n._children.forEach(function (c) {
        c._visible = n._visible && n._expanded;
        if (c._visible && !c._wasVisible) c._born = performance.now() + 40;
        c._wasVisible = c._visible;
        rec(c);
      });
    })(TREE);
  }

  function project(x, y, z) {
    var cy = Math.cos(rotY), sy = Math.sin(rotY);
    var x1 = x*cy + z*sy, z1 = -x*sy + z*cy, y1 = y;
    var cx = Math.cos(rotX), sx = Math.sin(rotX);
    var y2 = y1*cx - z1*sx, z2 = y1*sx + z1*cx, x2 = x1;
    var persp = FOV / (FOV - z2);
    return { x: W/2 + x2*persp*zoom + panX, y: H/2 - y2*persp*zoom + panY, persp: persp, z2: z2 };
  }

  /* ---------- 尺寸（基于容器，而非整窗） ---------- */
  function resize() {
    var rect = stage.getBoundingClientRect();
    W = rect.width || stage.clientWidth || 600;
    H = rect.height || stage.clientHeight || 500;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * DPR; canvas.height = H * DPR;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    layout3D();
    if (!zoomInit) {
      var maxR = maxDepth * LEVEL;
      zoom = Math.min(W, H) / (maxR * 2.2);
      zoomInit = true;
    }
    if (reduce) frame(performance.now());
  }

  /* ---------- 环境微粒子 ---------- */
  var ambient = [];
  for (var i = 0; i < 46; i++) {
    ambient.push({ x: Math.random(), y: Math.random(), r: Math.random()*1.4 + 0.3,
      sp: Math.random()*0.012 + 0.004, a: Math.random()*0.08 + 0.04, ph: Math.random()*6.28 });
  }

  /* ---------- 交互 ---------- */
  var mouse = { x: -999, y: -999 };
  var hover = null;
  var drag = null; // {mode, lx, ly, t0, moved}

  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('pointerdown', function (e) {
    drag = { mode: (e.button === 2 || e.shiftKey) ? 'pan' : 'rotate', lx: e.clientX, ly: e.clientY, t0: performance.now(), moved: false };
    canvas.classList.add('dragging');
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', function (e) {
    if (drag) {
      var dx = e.clientX - drag.lx, dy = e.clientY - drag.ly;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      if (drag.mode === 'rotate') {
        rotY += dx * 0.006; rotX += dy * 0.006;
        rotX = Math.max(-1.45, Math.min(1.45, rotX));
      } else { panX += dx; panY += dy; }
      drag.lx = e.clientX; drag.ly = e.clientY;
    } else {
      var r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    }
  });
  function endDrag() {
    if (drag && !drag.moved && performance.now() - drag.t0 < 350) {
      if (hover) {
        if (hover._children.length) { hover._expanded = !hover._expanded; computeVisible(); }
        else { openModal(hover); } // 叶子：页内弹窗，不跳走
      }
    }
    drag = null; canvas.classList.remove('dragging');
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', function () { drag = null; canvas.classList.remove('dragging'); });
  canvas.addEventListener('pointerleave', function () { mouse.x = -999; mouse.y = -999; });
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    zoom *= Math.exp(-e.deltaY * 0.0012);
    zoom = Math.max(0.25, Math.min(4.5, zoom));
  }, { passive: false });

  /* ---------- 弹窗（页内，不跳走） ---------- */
  var modal = document.getElementById('ktModal');
  var elCrumb = document.getElementById('ktCrumb');
  var elTitle = document.getElementById('ktTitle');
  var elBadge = document.getElementById('ktBadge');
  var elDesc = document.getElementById('ktDesc');
  var elChips = document.getElementById('ktChips');
  function pathOf(n) { var a = []; while (n) { a.unshift(n.name); n = n._parent; } return a; }
  var lastFocused = null;
  var closeBtn = document.getElementById('ktModalClose');
  function openModal(n) {
    lastFocused = document.activeElement;
    var p = pathOf(n);
    elCrumb.innerHTML = p.map(function (s, i) { return i === 0 ? '<b>' + s + '</b>' : s; }).join(' › ');
    elTitle.textContent = n.name;
    if (n._lit) { elBadge.textContent = '学习中'; elBadge.className = 'kt-modal-badge on'; }
    else { elBadge.textContent = '未学习'; elBadge.className = 'kt-modal-badge off'; }
    if (n._children.length) {
      elDesc.textContent = '下设 ' + n._children.length + ' 个细分方向。在左侧知识星系里点击该节点即可展开或收起。';
      elChips.innerHTML = n._children.map(function (c) { return '<span>' + c.name + '</span>'; }).join('');
    } else {
      elDesc.textContent = '路线中的叶子节点。把它学扎实，就是从“知道”到“能用”的一步。';
      elChips.innerHTML = '';
    }
    modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false');
    if (closeBtn) closeBtn.focus();
  }
  function closeModal() {
    modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true');
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });
  // 焦点陷阱：Tab 在弹窗内循环，不跑出
  modal.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var f = modal.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- 渲染 ---------- */
  function lerp(a, b, t) { return a + (b - a) * t; }

  function frame(t) {
    ctx.clearRect(0, 0, W, H);

    for (var i = 0; i < ambient.length; i++) {
      var p = ambient[i];
      p.y -= p.sp * 0.004;
      if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); }
      var tw = 0.6 + 0.4 * Math.sin(t * 0.001 + p.ph);
      ctx.beginPath(); ctx.arc(p.x * W, p.y * H, p.r, 0, 6.2832);
      ctx.fillStyle = 'rgba(120,170,255,' + (p.a * tw).toFixed(3) + ')'; ctx.fill();
    }

    // 缓动位置 + alpha
    for (var j = 0; j < all.length; j++) {
      var n = all[j];
      var tx = n._visible ? n._tx : (n._parent ? n._parent._x : n._tx);
      var ty = n._visible ? n._ty : (n._parent ? n._parent._y : n._ty);
      var tz = n._visible ? n._tz : (n._parent ? n._parent._z : n._tz);
      n._x += (tx - n._x) * 0.10; n._y += (ty - n._y) * 0.10; n._z += (tz - n._z) * 0.10;
      if (n._visible) { if (n._born && t > n._born) n._alpha = Math.min(1, n._alpha + 0.035); }
      else { n._alpha = Math.max(0, n._alpha - 0.05); }
    }

    // 投影 + 拾取
    hover = null; var best = 18 * 18;
    for (var h = 0; h < all.length; h++) {
      var m = all[h];
      var pr = project(m._x, m._y, m._z);
      m._sx = pr.x; m._sy = pr.y; m._sp = pr.persp; m._z2 = pr.z2;
      if (m._visible && m._alpha > 0.3) {
        var ddx = pr.x - mouse.x, ddy = pr.y - mouse.y, d2 = ddx*ddx + ddy*ddy;
        var rr = 13 + (m._lit ? 4 : 0);
        if (d2 < rr*rr && d2 < best) { best = d2; hover = m; }
      }
    }
    canvas.style.cursor = hover ? 'pointer' : (drag ? (drag.mode === 'pan' ? 'move' : 'grabbing') : 'grab');

    // 空闲缓慢自转（克制）；减少动效时完全静止
    if (!drag && !hover && !reduce) rotY += 0.0011;

    // 绘制列表（远→近）
    var drawable = [];
    for (var q = 0; q < all.length; q++) { if (all[q]._alpha > 0.02) drawable.push(all[q]); }
    drawable.sort(function (a, b) { return a._z2 - b._z2; });

    ctx.lineCap = 'round';
    for (var e = 0; e < drawable.length; e++) {
      var c = drawable[e];
      var pa = c._parent;
      if (!pa || pa._alpha < 0.02 || c._alpha < 0.02) continue;
      var lit = c._lit;
      ctx.beginPath(); ctx.moveTo(pa._sx, pa._sy); ctx.lineTo(c._sx, c._sy);
      ctx.strokeStyle = lit
        ? 'rgba(120,190,255,' + (0.28 + 0.30 * c._alpha).toFixed(3) + ')'
        : 'rgba(90,130,200,' + (0.09 + 0.10 * c._alpha).toFixed(3) + ')';
      ctx.lineWidth = (lit ? 1.4 : 1.0) * Math.max(0.6, c._sp * 0.8);
      ctx.stroke();
      // 流动粒子
      var cnt = lit ? 2 : 1, flow = (t * 0.00016 + c._seed) % 1;
      for (var k = 0; k < cnt; k++) {
        var f = (flow + k * 0.5) % 1;
        var fx = lerp(pa._sx, c._sx, f), fy = lerp(pa._sy, c._sy, f);
        ctx.beginPath(); ctx.arc(fx, fy, (lit ? 2.3 : 1.5) * Math.max(0.6, c._sp * 0.8), 0, 6.2832);
        ctx.fillStyle = lit ? 'rgba(200,228,255,' + (0.85 * c._alpha).toFixed(3) + ')'
                            : 'rgba(140,175,225,' + (0.4 * c._alpha).toFixed(3) + ')';
        ctx.fill();
      }
    }

    for (var d = 0; d < drawable.length; d++) {
      var nd = drawable[d];
      var isH = nd === hover, litN = nd._lit;
      var R = (litN ? (isH ? 9 : 7) : (isH ? 6 : 4.5)) * Math.max(0.7, nd._sp * 0.9);
      var glow = litN ? (isH ? 26 : 16) : (isH ? 12 : 6);

      ctx.save();
      ctx.globalAlpha = nd._alpha;
      ctx.shadowColor = litN ? 'rgba(90,165,255,0.95)' : 'rgba(70,110,180,0.5)';
      ctx.shadowBlur = glow;
      ctx.beginPath(); ctx.arc(nd._sx, nd._sy, R, 0, 6.2832);
      ctx.fillStyle = litN ? '#7cc4ff' : 'rgba(96,128,190,0.6)';
      ctx.fill();
      ctx.restore();

      ctx.beginPath(); ctx.arc(nd._sx, nd._sy, R + (litN ? 4 : 2.5) * Math.max(0.7, nd._sp * 0.9), 0, 6.2832);
      ctx.strokeStyle = litN ? 'rgba(150,205,255,' + (0.5 * nd._alpha).toFixed(3) + ')'
                             : 'rgba(120,150,210,' + (0.18 * nd._alpha).toFixed(3) + ')';
      ctx.lineWidth = 1; ctx.stroke();

      if (nd._alpha > 0.4) {
        ctx.font = (nd._depth === 0 ? '600 14px ' : '500 12.5px ') +
                   '"Inter","PingFang SC","Microsoft YaHei",sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = litN ? 'rgba(220,239,255,' + nd._alpha.toFixed(3) + ')'
                             : 'rgba(150,175,215,' + (0.6 * nd._alpha).toFixed(3) + ')';
        ctx.fillText(nd.name, nd._sx, nd._sy + R + 5);
      }
    }
  }

  /* ---------- 启动 + 离屏暂停 ---------- */
  resize();
  if (window.ResizeObserver) { new ResizeObserver(resize).observe(stage); }
  else { window.addEventListener('resize', resize); }

  TREE._x = TREE._tx; TREE._y = TREE._ty; TREE._z = TREE._tz; TREE._alpha = 1; TREE._born = performance.now();
  all.forEach(function (n) { if (n !== TREE) { n._x = 0; n._y = 0; n._z = 0; n._alpha = 0; } });
  computeVisible();
  var start = performance.now();
  all.forEach(function (n) { if (n._visible && n !== TREE) n._born = start + n._depth * 150; });

  var running = false, rafId = null;
  function loop() {
    if (!running) { rafId = null; return; }
    frame(performance.now());
    rafId = requestAnimationFrame(loop);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        running = e.isIntersecting && !reduce;
        if (running && !rafId) loop();
        else if (reduce && e.isIntersecting) frame(performance.now()); // 减少动效：仅静态渲染一帧
      });
    }, { threshold: 0.05 });
    io.observe(stage);
  } else {
    running = !reduce; loop();
  }
  if (reduce) { all.forEach(function (n) { if (n._visible) n._alpha = 1; }); frame(performance.now()); }
})();
