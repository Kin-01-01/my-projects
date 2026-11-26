/* 粒子背景特效：纯 canvas 自写，无第三方依赖。冷白/青/紫三色漂浮点 + 近距连线。 */
(function () {
  function initParticles(canvas) {
    if (!canvas || !canvas.getContext) return;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var ctx = canvas.getContext('2d');
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, particles = [], raf = 0;
    var COLORS = ['rgba(150,220,225,', 'rgba(120,170,255,', 'rgba(190,170,255,'];

    function resize() {
      W = canvas.clientWidth || canvas.parentNode.clientWidth;
      H = canvas.clientHeight || canvas.parentNode.clientHeight;
      canvas.width = Math.max(1, W * dpr);
      canvas.height = Math.max(1, H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function make() {
      var n = Math.round(Math.min(90, (W * H) / 15000));
      particles = [];
      for (var i = 0; i < n; i++) {
        particles.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
          r: Math.random() * 1.8 + 0.6,
          c: COLORS[(Math.random() * COLORS.length) | 0],
          a: Math.random() * 0.5 + 0.22
        });
      }
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.c + p.a + ')';
        ctx.fill();
      }
      for (var i2 = 0; i2 < particles.length; i2++) {
        for (var j = i2 + 1; j < particles.length; j++) {
          var a = particles[i2], b = particles[j];
          var dx = a.x - b.x, dy = a.y - b.y;
          var d = dx * dx + dy * dy;
          if (d < 130 * 130) {
            var o = (1 - d / (130 * 130)) * 0.16;
            ctx.strokeStyle = 'rgba(150,200,220,' + o + ')';
            ctx.lineWidth = 0.6;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    }
    function start() { resize(); make(); draw(); }

    start();
    window.addEventListener('resize', function () {
      resize(); make();
      if (reduce) draw();
    });
    // 暴漏停止接口，路由切换时清理
    canvas.__stopParticles = function () { if (raf) cancelAnimationFrame(raf); };
  }
  window.initParticles = initParticles;
})();
