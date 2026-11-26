/* ============================================================
   枯木逢春 / Dead wood, spring.
   Leaves grow on the photo's real branches under the cursor,
   then slowly fade away when it moves on.

   How leaves stay ON the branches:
   1) the photo is downsampled and classified: sky is saturated
      blue (b ≫ r), wood is dark and unsaturated → binary mask
   2) a chamfer distance transform measures branch thickness
   3) leaf anchors are scattered on mask pixels, weighted so
      thin twigs get many small leaves, the trunk face few
   4) at draw time anchors are mapped through the exact same
      "cover 50% 45%" transform the CSS photo uses, plus a
      small per-leaf parallax (thicker branch = nearer = moves
      more) for a hint of depth.

   Rendering: pre-baked leaf sprites on a transparent 2D canvas.
   Growth state lives per leaf on the CPU (needs memory for the
   slow fade), drawing is skipped entirely for dormant leaves.
   ============================================================ */

(function () {
  "use strict";

  var TAU = Math.PI * 2;
  var canvas = document.getElementById("grove");
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hint = document.getElementById("hint");

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rand(a, b) { return a + Math.random() * (b - a); }

  /* ---------------- leaf sprites ----------------
     One leaf, stem at bottom / tip at top, drawn once per
     variant and reused for every leaf of that variant. */

  function leafPath(g, s, asym) {
    var cx = s * 0.5;
    var base = s * 0.9, tip = s * 0.06;
    var wL = s * 0.30 + asym, wR = s * 0.30 - asym * 0.6;
    g.beginPath();
    g.moveTo(cx, base);
    g.bezierCurveTo(cx - wL, base - s * 0.28, cx - wL * 0.86, s * 0.30, cx, tip);
    g.bezierCurveTo(cx + wR, s * 0.30, cx + wR, base - s * 0.28, cx, base);
    g.closePath();
  }

  function makeSprite(hue, light, soft) {
    var s = 96;
    var c = document.createElement("canvas");
    c.width = c.height = s;
    var g = c.getContext("2d");

    // baked soft shadow (sun from upper left → shadow lower right)
    if (!soft) {
      g.save();
      g.translate(s * 0.055, s * 0.075);
      g.rotate(0.05);
      leafPath(g, s, 0);
      g.fillStyle = "rgba(8,18,8,0.30)";
      g.fill();
      g.restore();
    }

    // body: darker at the stem, brighter at the tip
    var grad = g.createLinearGradient(0, s * 0.9, 0, s * 0.06);
    grad.addColorStop(0, "hsl(" + hue + ",46%," + (26 * light) + "%)");
    grad.addColorStop(0.55, "hsl(" + (hue + 7) + ",52%," + (38 * light) + "%)");
    grad.addColorStop(1, "hsl(" + (hue + 14) + ",58%," + (50 * light) + "%)");
    leafPath(g, s, rand(-2, 2));
    g.fillStyle = grad;
    g.fill();

    // detail pass, clipped to the leaf silhouette
    g.save();
    leafPath(g, s, 0);
    g.clip();
    // midrib
    g.strokeStyle = "rgba(22,42,20,0.5)";
    g.lineWidth = s * 0.02;
    g.beginPath();
    g.moveTo(s * 0.5, s * 0.88);
    g.quadraticCurveTo(s * 0.49, s * 0.5, s * 0.5, s * 0.1);
    g.stroke();
    // side veins
    g.strokeStyle = "rgba(22,42,20,0.22)";
    g.lineWidth = s * 0.012;
    for (var i = 0; i < 4; i++) {
      var y = s * (0.24 + i * 0.16);
      g.beginPath(); g.moveTo(s * 0.5, y); g.lineTo(s * 0.5 - s * 0.16, y - s * 0.10); g.stroke();
      g.beginPath(); g.moveTo(s * 0.5, y); g.lineTo(s * 0.5 + s * 0.16, y - s * 0.10); g.stroke();
    }
    // sky-lit highlight (upper left), shade (lower right)
    var hl = g.createRadialGradient(s * 0.36, s * 0.30, 2, s * 0.36, s * 0.30, s * 0.55);
    hl.addColorStop(0, "rgba(235,255,220,0.20)");
    hl.addColorStop(1, "rgba(235,255,220,0)");
    g.fillStyle = hl; g.fillRect(0, 0, s, s);
    var sh = g.createLinearGradient(0, s * 0.45, 0, s);
    sh.addColorStop(0, "rgba(0,0,0,0)");
    sh.addColorStop(1, "rgba(6,16,6,0.22)");
    g.fillStyle = sh; g.fillRect(0, 0, s, s);
    g.restore();

    if (soft) {
      // cheap depth-of-field: downscale + upscale = blur
      var c2 = document.createElement("canvas");
      c2.width = c2.height = s / 2;
      c2.getContext("2d").drawImage(c, 0, 0, s / 2, s / 2);
      var c3 = document.createElement("canvas");
      c3.width = c3.height = s;
      var g3 = c3.getContext("2d");
      g3.imageSmoothingEnabled = true;
      g3.drawImage(c2, 0, 0, s, s);
      return c3;
    }
    return c;
  }

  var spritesSharp = [], spritesSoft = [];
  function buildSprites() {
    var hues = [92, 100, 108, 116, 124, 132]; // green → cool green (no yellow pop)
    spritesSharp = []; spritesSoft = [];
    for (var i = 0; i < hues.length; i++) {
      spritesSharp.push(makeSprite(hues[i], 1, false));
      spritesSharp.push(makeSprite(hues[i], 0.85, false));
      spritesSoft.push(makeSprite(hues[i], 1, true));
    }
  }

  /* ---------------- photo analysis ---------------- */

  var mask = null, maskW = 0, maskH = 0;
  var img = new Image();
  var leaves = [];

  function analyze(image) {
    var AW = 224;
    var AH = Math.max(1, Math.round(AW * image.naturalHeight / image.naturalWidth));
    var ac = document.createElement("canvas");
    ac.width = AW; ac.height = AH;
    var ag = ac.getContext("2d", { willReadFrequently: true });
    ag.drawImage(image, 0, 0, AW, AH);
    var data;
    try {
      data = ag.getImageData(0, 0, AW, AH).data;
    } catch (e) {
      // tainted canvas (e.g. file:// without the data URI) → no leaves
      console.warn("vernal-tree: pixel read blocked, leaf growth disabled.", e);
      return false;
    }

    maskW = AW; maskH = AH;
    mask = new Uint8Array(AW * AH);
    var i, x, y, r, g, b, lum;
    for (y = 0; y < AH; y++) {
      for (x = 0; x < AW; x++) {
        i = y * AW + x;
        r = data[i * 4]; g = data[i * 4 + 1]; b = data[i * 4 + 2];
        lum = 0.299 * r + 0.587 * g + 0.114 * b;
        // sky: saturated blue (b far above r) — wood: dark, unsaturated
        if ((b - r) < 62 && lum < 175) mask[i] = 1;
      }
    }

    // chamfer distance transform: distance from each wood pixel to sky
    var INF = 1e7;
    var dt = new Float32Array(AW * AH);
    for (i = 0; i < AW * AH; i++) dt[i] = mask[i] ? INF : 0;
    var m;
    for (y = 0; y < AH; y++) {
      for (x = 0; x < AW; x++) {
        i = y * AW + x;
        if (!dt[i]) continue;
        m = dt[i];
        if (x > 0 && dt[i - 1] + 1 < m) m = dt[i - 1] + 1;
        if (y > 0) {
          if (dt[i - AW] + 1 < m) m = dt[i - AW] + 1;
          if (x > 0 && dt[i - AW - 1] + 1.41 < m) m = dt[i - AW - 1] + 1.41;
          if (x < AW - 1 && dt[i - AW + 1] + 1.41 < m) m = dt[i - AW + 1] + 1.41;
        }
        dt[i] = m;
      }
    }
    for (y = AH - 1; y >= 0; y--) {
      for (x = AW - 1; x >= 0; x--) {
        i = y * AW + x;
        if (!dt[i]) continue;
        m = dt[i];
        if (x < AW - 1 && dt[i + 1] + 1 < m) m = dt[i + 1] + 1;
        if (y < AH - 1) {
          if (dt[i + AW] + 1 < m) m = dt[i + AW] + 1;
          if (x < AW - 1 && dt[i + AW + 1] + 1.41 < m) m = dt[i + AW + 1] + 1.41;
          if (x > 0 && dt[i + AW - 1] + 1.41 < m) m = dt[i + AW - 1] + 1.41;
        }
        dt[i] = m;
      }
    }

    // scatter anchors: dense on thin twigs, sparse on the trunk face
    var target = Math.round(clamp((window.innerWidth * window.innerHeight) / 450, 3000, 6500));
    var cand = [];
    for (y = 0; y < AH; y++) {
      for (x = 0; x < AW; x++) {
        i = y * AW + x;
        if (!mask[i]) continue;
        var d = dt[i];
        if (d < 1) continue; // ignore isolated specks
        var p = 0.42 / (1 + Math.pow(d / 5.5, 1.7));
        if (Math.random() < p) cand.push({ x: x, y: y, d: d });
      }
    }
    // shuffle then trim to budget
    for (i = cand.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0;
      var t = cand[i]; cand[i] = cand[j]; cand[j] = t;
    }
    if (cand.length > target) cand.length = target;

    leaves = [];
    for (var k = 0; k < cand.length; k++) {
      var c = cand[k];
      leaves.push({
        nx: c.x / AW, ny: c.y / AH,          // normalized image-space anchor
        ang: rand(0, TAU),                    // rest rotation
        // this photo is a macro shot: leaves read at 9–42 css px
        sizeBase: clamp(8 + c.d * 2.6, 9, 42),
        rank: Math.pow(Math.random(), 1.15),  // activation threshold (density)
        soft: Math.random() < 0.30,           // depth-of-field variant
        variant: (Math.random() * 6) | 0,
        light: Math.random() < 0.5 ? 0 : 1,
        alphaBase: rand(0.72, 0.98),
        phase: rand(0, TAU),
        sway: rand(0.7, 1.5),
        dec: rand(0.0025, 0.007),             // per-frame fade → half-life 1.6–4.6 s
        depth: clamp(0.45 + c.d / 16, 0.45, 1.05), // parallax factor
        g: 0                                  // growth 0..1
      });
    }
    // small leaves first so large ones sit on top
    leaves.sort(function (a, b2) { return a.sizeBase - b2.sizeBase; });
    return true;
  }

  /* ---------------- cover mapping (must match CSS) ---------------- */

  var vw = 0, vh = 0, dpr = 1, sizeScale = 1;
  var map = { s: 1, ox: 0, oy: 0, iw: 1, ih: 1 };

  function computeMap() {
    vw = window.innerWidth; vh = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    var iw = img.naturalWidth, ih = img.naturalHeight;
    var s = Math.max(vw / iw, vh / ih);
    map.s = s; map.iw = iw; map.ih = ih;
    map.ox = (iw * s - vw) / 2;            // object-position x: 50%
    map.oy = (ih * s - vh) * 0.45;         // object-position y: 45%
    sizeScale = clamp(Math.pow(vh / 900, 0.4), 0.8, 1.4);
  }

  /* ---------------- interaction state ---------------- */

  var mouse = { x: -1e4, y: -1e4, active: false };
  var par = { x: 0, y: 0, tx: 0, ty: 0 }; // leaf parallax offset
  var warmth = 0;                          // dwell → influence radius grows
  var accumDist = 0, pmx = -1, pmy = -1;
  var hintGone = false;
  var activeCount = 0;

  function onPointer(e) {
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.active = true;
    if (pmx > -9000) accumDist += Math.hypot(e.clientX - pmx, e.clientY - pmy);
    pmx = e.clientX; pmy = e.clientY;
    if (!reduceMotion) {
      par.tx = clamp((e.clientX / vw - 0.5) * 2, -1, 1) * 7;
      par.ty = clamp((e.clientY / vh - 0.5) * 2, -1, 1) * 7;
    }
    if (!hintGone) { hintGone = true; if (hint) hint.classList.add("gone"); }
  }
  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("pointerdown", onPointer, { passive: true });
  document.addEventListener("mouseleave", function () { mouse.active = false; });
  window.addEventListener("blur", function () { mouse.active = false; });

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(computeMap, 150);
  });

  /* ---------------- frame loop ---------------- */

  var lastT = 0, running = false;

  function frame(t) {
    requestAnimationFrame(frame);
    var dtn = clamp((t - lastT) / 16.67, 0.2, 3); // normalized frame delta
    lastT = t;
    var timeS = t * 0.001;

    // parallax easing
    par.x += (par.tx - par.x) * Math.min(1, 0.045 * dtn);
    par.y += (par.ty - par.y) * Math.min(1, 0.045 * dtn);

    // dwell warmth: stationary cursor slowly widens the growth radius
    accumDist *= Math.pow(0.92, dtn);
    var stationary = mouse.active && accumDist < 8;
    warmth = clamp(warmth + (stationary ? 0.0035 : -0.02) * dtn, 0, 1);
    var R = Math.min(vw, vh) * 0.26 * (1 + 0.6 * warmth);
    var R2 = R * R;
    var mAct = mouse.active, mx = mouse.x, my = mouse.y;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);

    var count = 0;
    for (var i = 0; i < leaves.length; i++) {
      var l = leaves[i];

      // anchor → screen (cover transform + parallax by depth)
      var px = l.nx * map.iw * map.s - map.ox + par.x * l.depth;
      var py = l.ny * map.ih * map.s - map.oy + par.y * l.depth;

      // target growth from cursor proximity × per-leaf rank
      var target = 0;
      if (mAct) {
        var dx = px - mx, dy = py - my, d2 = dx * dx + dy * dy;
        if (d2 < R2) {
          var infl = 1 - Math.sqrt(d2) / R;
          infl = infl * infl * (3 - 2 * infl); // smoothstep falloff
          target = clamp(infl * 1.22 - l.rank * 0.55, 0, 1);
        }
      }

      // integrate: organic growth, slow staggered fade
      if (target > l.g) {
        l.g += (target - l.g) * Math.min(1, 0.075 * dtn);
      } else if (l.g > 0.001) {
        l.g *= 1 - Math.min(0.9, l.dec * dtn);
      }
      if (l.g < 0.012) continue; // dormant — skip drawing entirely

      count++;
      var size = l.sizeBase * sizeScale * (0.22 + 0.78 * l.g);
      var a = l.alphaBase * clamp(l.g * 1.5, 0, 1);
      var swayA = reduceMotion ? 0
        : Math.sin(timeS * l.sway + l.phase) * (0.03 + 0.05 * l.g) * l.g;

      var spr = l.soft ? spritesSoft[l.variant] : spritesSharp[l.variant * 2 + l.light];
      var rot = l.ang + swayA;
      var cos = Math.cos(rot), sin = Math.sin(rot);
      ctx.setTransform(dpr * cos, dpr * sin, -dpr * sin, dpr * cos, px * dpr, py * dpr);
      ctx.globalAlpha = a;
      // stem sits on the anchor; leaf grows outward from the branch
      var w = size, h = size * 1.42;
      ctx.drawImage(spr, -w * 0.5, -h * 0.90, w, h);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalAlpha = 1;
    activeCount = count;
  }

  /* ---------------- boot & degradation ---------------- */

  function start() {
    computeMap();
    buildSprites();
    if (analyze(img)) {
      if (!running) {
        running = true;
        lastT = performance.now();
        requestAnimationFrame(frame);
      }
      probe.ready = true;
    }
  }

  var src = window.TREE_DATA_URL || "assets/tree.jpg";
  img.onload = start;
  img.onerror = function () {
    console.warn("vernal-tree: photo failed to load — page stays photographic only.");
  };
  img.src = src;

  /* ---------------- read-only probe (used by visual checks) ---------------- */

  var probe = {
    ready: false,
    get active() { return activeCount; },
    get total() { return leaves.length; },
    // device pixel → was that photo pixel classified as wood?
    treeAt: function (dx, dy) {
      if (!mask) return -1;
      var cx = dx / dpr, cy = dy / dpr;
      // screen → image px → analysis-mask px (two different scales!)
      var ix = ((cx + map.ox) / map.s / map.iw) * maskW;
      var iy = ((cy + map.oy) / map.s / map.ih) * maskH;
      var ax = Math.round(ix), ay = Math.round(iy);
      if (ax < 0 || ay < 0 || ax >= maskW || ay >= maskH) return 0;
      return mask[ay * maskW + ax];
    },
    // sample the canvas: count green leaf pixels and how many sit on wood
    greenStats: function () {
      var w = canvas.width, h = canvas.height;
      var d = ctx.getImageData(0, 0, w, h).data;
      var green = 0, onTree = 0, step = 4; // every 4th pixel
      for (var pi = 0; pi < w * h; pi += step) {
        var q = pi * 4;
        if (d[q + 3] < 40) continue;
        var r = d[q], g = d[q + 1], b = d[q + 2];
        if (g > r + 14 && g > b + 20 && g > 50) {
          green++;
          if (this.treeAt(pi % w, (pi / w) | 0) === 1) onTree++;
        }
      }
      return { green: green, onTree: onTree };
    }
  };
  window.__grove = probe;
})();
