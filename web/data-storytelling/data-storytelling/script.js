// Data Storytelling — minimal interactions
(function () {
  "use strict";

  // Sticky nav background on scroll
  var nav = document.querySelector("[data-nav]");
  function onScroll() {
    if (window.scrollY > 24) {
      nav.classList.add("scrolled");
    } else {
      nav.classList.remove("scrolled");
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Seamless animated hero background (canvas).
  // A field of drifting "data" particles plus two soft light blobs.
  // Respects prefers-reduced-motion by skipping the loop entirely.
  var canvas = document.querySelector(".hero-canvas");
  if (canvas && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w, h, particles = [], blobs = [];
    var reducedQuality = window.matchMedia("(max-width: 600px)").matches;

    function resize() {
      var rect = canvas.parentElement.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function makeParticle() {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.6 + Math.random() * 1.8,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        a: 0.15 + Math.random() * 0.5,
        hue: Math.random() < 0.75 ? 247 : 160
      };
    }
    function makeBlob() {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: 120 + Math.random() * 220,
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        hue: Math.random() < 0.6 ? 247 : 160
      };
    }

    function init() {
      resize();
      var count = Math.round((w * h) / (reducedQuality ? 22000 : 16000));
      particles = [];
      for (var i = 0; i < count; i++) particles.push(makeParticle());
      blobs = [];
      for (var j = 0; j < 3; j++) blobs.push(makeBlob());
    }

    function drawBlob(b) {
      var g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      var c = b.hue === 247 ? "127,119,221" : "52,211,153";
      g.addColorStop(0, "rgba(" + c + ",0.16)");
      g.addColorStop(1, "rgba(" + c + ",0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    function step() {
      ctx.clearRect(0, 0, w, h);
      for (var j = 0; j < blobs.length; j++) {
        var b = blobs[j];
        b.x += b.vx; b.y += b.vy;
        if (b.x < -b.r) b.x = w + b.r;
        if (b.x > w + b.r) b.x = -b.r;
        if (b.y < -b.r) b.y = h + b.r;
        if (b.y > h + b.r) b.y = -b.r;
        drawBlob(b);
      }
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
        var pc = p.hue === 247 ? "175,169,236" : "94,234,180";
        ctx.fillStyle = "rgba(" + pc + "," + p.a + ")";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(step);
    }

    init();
    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(init, 150);
    });
    step();
  }
})();
