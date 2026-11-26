/* ============================================================
   拾光 · 环境动效：夜花瓣 + 鼠标交互
   ------------------------------------------------------------
   交互触发方式
     1. 光标移动（mouse / 触控拖动 / 手写笔，pointermove 事件，
        悬停即触发，无需点击）
     2. 指针离开窗口后自动释放，花瓣回到自然飘落

   动效响应范围（两级）
     · 全局层   —— 整屏：背景视频随光标做最大 ±14px 的反向视差平移；
                   光标的速度会给全场花瓣一股「拖曳风」（松手后 ~0.4s 衰减）
     · 局部层   —— 光标半径 R（约 170px，随屏宽自适应）内：
                   花瓣被推开并绕光标旋转，越靠近作用越强，出圈即衰减

   说明：花瓣的受力是「目标速度 + 惯性逼近」而非直接位移，
        因此离开作用范围后会顺势飘回自然轨道，不会突兀停住。
   尊重 prefers-reduced-motion：开启时整层不渲染、视频保持静态。
   ============================================================ */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var canvas = document.getElementById("ambient");
  if (!canvas || reduce) return;

  var ctx = canvas.getContext("2d");
  var media = document.getElementById("heroMedia");   // 背景视频层（视差作用对象）
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0;

  var petals = [];
  var running = true;
  var last = 0;

  /* ---------- 花瓣配色：取自背景视频的冷调，仅保留极少量暖点 ---------- */
  var PALETTE = [
    { c: [232, 238, 240], w: 46 },   // 冷白 · 呼应画面里的花瓣高光
    { c: [176, 202, 214], w: 30 },   // 淡钢蓝
    { c: [127, 168, 189], w: 14 },   // 冰川灰蓝
    { c: [222, 162, 108], w: 10 }    // 暮色琥珀（稀有，作为暗场里的呼吸点）
  ];
  var PALETTE_TOTAL = PALETTE.reduce(function (s, p) { return s + p.w; }, 0);

  function pickColor() {
    var r = Math.random() * PALETTE_TOTAL;
    for (var i = 0; i < PALETTE.length; i++) {
      r -= PALETTE[i].w;
      if (r <= 0) return PALETTE[i].c;
    }
    return PALETTE[0].c;
  }

  /* ---------- 光标状态 ---------- */
  var pointer = { tx: 0, ty: 0, x: 0, y: 0, vx: 0, vy: 0, active: false };
  var drag = { x: 0, y: 0 };          // 光标带起的「拖曳风」
  var R = 170;                        // 局部作用半径
  var MAXT = 14;                      // 视频视差最大位移(px)

  function rand(a, b) { return a + Math.random() * (b - a); }

  function makePetal(initial) {
    return {
      x: rand(-40, W + 40),
      y: initial ? rand(-H, H) : rand(-140, -20),
      size: rand(7, 16),
      rot: rand(0, Math.PI * 2),
      rotSpeed: rand(-1.1, 1.1),
      fall: rand(10, 30),            // 比落叶更慢，是「飘」不是「落」
      swayAmp: rand(18, 46),
      swayFreq: rand(0.5, 1.3),
      phase: rand(0, Math.PI * 2),
      windFactor: rand(0.5, 1.5),
      vx: 0, vy: 0, spin: 0,
      color: pickColor(),
      alpha: rand(0.26, 0.62)
    };
  }

  function drawPetal(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(p.size, p.size);
    var c = p.color;
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.bezierCurveTo(0.85, -0.5, 0.72, 0.65, 0, 1);
    ctx.bezierCurveTo(-0.72, 0.65, -0.85, -0.5, 0, -1);
    ctx.closePath();
    ctx.fillStyle = "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + p.alpha.toFixed(3) + ")";
    ctx.fill();
    // 边缘微光：暗场里让花瓣有被月光照到的轮廓
    ctx.lineWidth = 0.09;
    ctx.strokeStyle = "rgba(238,244,246," + (p.alpha * 0.42).toFixed(3) + ")";
    ctx.stroke();
    ctx.restore();
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // 局部作用半径随屏宽自适应，窄屏不至于一屏全被搅动
    R = Math.max(110, Math.min(210, W * 0.13));
    var count = Math.round(Math.min(30, Math.max(14, (W * H) / 78000)));
    petals.length = 0;
    for (var i = 0; i < count; i++) petals.push(makePetal(true));
    // 视差归中
    pointer.x = pointer.tx = W / 2;
    pointer.y = pointer.ty = H / 2;
  }

  var lastTX = null, lastTY = null;

  function frame(now) {
    if (!running) return;
    if (!last) last = now;
    var dt = Math.min((now - last) / 1000, 0.05);   // 秒，限幅防跳帧
    last = now;
    var t = now / 1000;

    /* --- 光标平滑跟随：跟随产生的位移即速度，停手时 velocity 自然归零 --- */
    var pk = Math.min(1, dt * 14);
    var nx = pointer.x + (pointer.tx - pointer.x) * pk;
    var ny = pointer.y + (pointer.ty - pointer.y) * pk;
    if (dt > 0) {
      pointer.vx = (nx - pointer.x) / dt;
      pointer.vy = (ny - pointer.y) / dt;
    }
    pointer.x = nx; pointer.y = ny;

    /* --- 拖曳风：由光标速度驱动并缓慢衰减，形成「挥手带风」的余韵 --- */
    var dk = Math.min(1, dt * 7);
    drag.x += (pointer.vx * 0.55 - drag.x) * dk;
    drag.y += (pointer.vy * 0.30 - drag.y) * dk;

    /* --- 环境阵风：两条正弦叠加，缓慢起伏 --- */
    var wind = (Math.sin(t * 0.18) * 1.0 + Math.sin(t * 0.47 + 1.3) * 0.55) * 26;

    ctx.clearRect(0, 0, W, H);
    var R2 = R * R;

    for (var i = 0; i < petals.length; i++) {
      var p = petals[i];
      var sway = Math.sin(t * p.swayFreq + p.phase) * p.swayAmp;

      // 目标速度 = 环境风 + 下落 + 摇摆 + 光标拖曳风
      var tvx = wind * p.windFactor + sway * 0.35 + drag.x * p.windFactor;
      var tvy = p.fall + drag.y * p.windFactor;
      p.spin = 0;

      // 局部作用：推开 + 切向旋绕
      if (pointer.active) {
        var dx = p.x - pointer.x, dy = p.y - pointer.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > 1) {
          var d = Math.sqrt(d2);
          var f = 1 - d / R;
          var infl = f * f;                 // 边缘平滑，避免硬边界
          tvx += (dx / d) * 300 * infl - (dy / d) * 150 * infl;
          tvy += (dy / d) * 300 * infl + (dx / d) * 150 * infl;
          p.spin = 9 * infl;
        }
      }

      // 惯性逼近：受力不是瞬时生效，所以离开作用圈后会顺势飘回
      var sk = Math.min(1, dt * 3.2);
      p.vx += (tvx - p.vx) * sk;
      p.vy += (tvy - p.vy) * sk;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += (p.rotSpeed + p.spin) * dt;

      if (p.y > H + 60 || p.y < -220 || p.x < -120 || p.x > W + 120) {
        petals[i] = p = makePetal(false);
      }
      drawPetal(p);
    }

    /* --- 背景视频视差：整屏范围，方向与光标相反，最多 ±MAXT --- */
    if (media) {
      var tgx = -(pointer.x / W - 0.5) * 2 * MAXT;
      var tgy = -(pointer.y / H - 0.5) * 2 * MAXT;
      var mk = Math.min(1, dt * 3.5);
      lastTX = lastTX === null ? tgx : lastTX + (tgx - lastTX) * mk;
      lastTY = lastTY === null ? tgy : lastTY + (tgy - lastTY) * mk;
      media.style.transform =
        "scale(1.04) translate3d(" + lastTX.toFixed(2) + "px," + lastTY.toFixed(2) + "px,0)";
    }

    requestAnimationFrame(frame);
  }

  /* ---------- 事件 ---------- */
  window.addEventListener("pointermove", function (e) {
    pointer.tx = e.clientX;
    pointer.ty = e.clientY;
    pointer.active = true;
  }, { passive: true });

  window.addEventListener("pointerdown", function (e) {
    pointer.tx = e.clientX;
    pointer.ty = e.clientY;
    pointer.active = true;
  }, { passive: true });

  // 指针离开窗口：解除局部作用，并把视差缓慢归中
  document.addEventListener("pointerleave", function () {
    pointer.active = false;
    pointer.tx = W / 2;
    pointer.ty = H / 2;
  }, { passive: true });

  window.addEventListener("resize", resize, { passive: true });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true; last = 0;
      requestAnimationFrame(frame);
    }
  });

  resize();
  requestAnimationFrame(frame);
})();
