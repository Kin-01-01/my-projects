// 合成音频引擎（Web Audio API，全部程序化生成，无外部音频资源）
// 场景覆盖：在轨环境低鸣 / 拆解 pop 与 clack / 发射点火 rumble+crackle（随高度衰减）
// / 分离与整流罩与太阳翼事件音 / 场景过渡 whoosh / 入轨 chime / UI tick
// 浏览器要求：AudioContext 必须在用户手势后创建或 resume（首次点击时 init）。

export function createAudio() {
  let ctx = null, master = null;
  let muted = false;
  let ambient = null;   // { osc1, osc2, gain, lfo, noiseSrc }
  let rumble = null;    // { src, filter, gain }

  function ensure() {
    if (muted) return false;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function noiseBuffer(brown) {
    const len = Math.floor(ctx.sampleRate * 2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else d[i] = w;
    }
    return buf;
  }

  function env(g, t0, attack, peak, decay) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.001), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  // ---- 环境音：在轨低鸣（双振荡器 + 缓慢 LFO + 微弱舱内气噪）----
  function ambientStart() {
    if (!ensure() || ambient) return;
    const g = ctx.createGain(); g.gain.value = 0.0;
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 55;
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 82.5; o2.detune.value = 6;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.018;
    lfo.connect(lfoG); lfoG.connect(g.gain);
    o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(master);
    const ns = ctx.createBufferSource(); ns.buffer = noiseBuffer(false); ns.loop = true;
    const nlp = ctx.createBiquadFilter(); nlp.type = 'lowpass'; nlp.frequency.value = 420;
    const ng = ctx.createGain(); ng.gain.value = 0.012;
    ns.connect(nlp); nlp.connect(ng); ng.connect(master);
    o1.start(); o2.start(); lfo.start(); ns.start();
    g.gain.setTargetAtTime(0.05, ctx.currentTime, 1.2);
    ambient = { o1, o2, lfo, ns, gain: g, nGain: ng };
  }
  function ambientStop() {
    if (!ambient || !ctx) return;
    const t = ctx.currentTime;
    ambient.gain.gain.setTargetAtTime(0.0001, t, 0.4);
    ambient.nGain.gain.setTargetAtTime(0.0001, t, 0.4);
    const a = ambient; ambient = null;
    setTimeout(() => { try { a.o1.stop(); a.o2.stop(); a.lfo.stop(); a.ns.stop(); } catch (e) {} }, 1500);
  }
  function ambientDuck(level) { // 发射期间压低环境音
    if (!ambient || !ctx) return;
    ambient.gain.gain.setTargetAtTime(level, ctx.currentTime, 0.5);
  }

  // ---- 发射 rumble：棕色噪声低通持续音，level 随推力/高度调节 ----
  function rumbleStart() {
    if (!ensure() || rumble) return;
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(true); src.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 90; filter.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.value = 0.0001;
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start();
    rumble = { src, filter, gain: g };
  }
  function rumbleLevel(v) {
    if (!rumble || !ctx) return;
    rumble.gain.gain.setTargetAtTime(Math.max(0.0001, v), ctx.currentTime, 0.18);
    rumble.filter.frequency.setTargetAtTime(80 + v * 160, ctx.currentTime, 0.3);
  }
  function rumbleStop() {
    if (!rumble || !ctx) return;
    const r = rumble; rumble = null;
    r.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.5);
    setTimeout(() => { try { r.src.stop(); } catch (e) {} }, 2000);
  }

  // ---- 点火：rumble 爬升 + 高频爆裂 ----
  function ignition() {
    if (!ensure()) return;
    rumbleStart();
    rumbleLevel(0.55);
    const t = ctx.currentTime;
    const ns = ctx.createBufferSource(); ns.buffer = noiseBuffer(false);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    const g = ctx.createGain();
    ns.connect(hp); hp.connect(g); g.connect(master);
    env(g, t, 0.08, 0.22, 1.4);
    ns.start(t); ns.stop(t + 1.6);
  }

  // ---- 拆解弹出（金属伺服 pop，size 影响音高）----
  function pop(size = 0.5) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'triangle';
    const f0 = 520 / (0.7 + size);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(150, t + 0.16);
    const g = ctx.createGain();
    o.connect(g); g.connect(master);
    env(g, t, 0.012, 0.18, 0.2);
    o.start(t); o.stop(t + 0.25);
    const ns = ctx.createBufferSource(); ns.buffer = noiseBuffer(false);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 2;
    const ng = ctx.createGain();
    ns.connect(bp); bp.connect(ng); ng.connect(master);
    env(ng, t, 0.006, 0.09, 0.07);
    ns.start(t); ns.stop(t + 0.12);
  }

  // ---- 级间分离重击（低频 thump + 金属尾音）----
  function clack() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.28);
    const g = ctx.createGain();
    o.connect(g); g.connect(master);
    env(g, t, 0.01, 0.4, 0.3);
    o.start(t); o.stop(t + 0.35);
    const ns = ctx.createBufferSource(); ns.buffer = noiseBuffer(false);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    const ng = ctx.createGain();
    ns.connect(lp); lp.connect(ng); ng.connect(master);
    env(ng, t, 0.008, 0.16, 0.16);
    ns.start(t); ns.stop(t + 0.22);
  }

  // ---- 级间分离爆响（火工品）：低频推冲 + 中高频金属脆响 + 气动嘶啸 ----
  // 中频成分为主，能穿透发动机轰鸣（旧 clack 以低频为主，容易被轰鸣盖住）；
  // 总时长 ~0.8s、峰值 ~0.5，与 0.2s 后起播的分离语音不抢频段
  function sepBang() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    // 1) 低频钝响：火工品推冲
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
    const g = ctx.createGain(); o.connect(g); g.connect(master);
    env(g, t, 0.008, 0.5, 0.26);
    o.start(t); o.stop(t + 0.3);
    // 2) 金属脆响：带通噪声 2.4kHz→600Hz，穿透低频轰鸣
    const ns = ctx.createBufferSource(); ns.buffer = noiseBuffer(false);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(2400, t);
    bp.frequency.exponentialRampToValueAtTime(600, t + 0.3);
    const ng = ctx.createGain();
    ns.connect(bp); bp.connect(ng); ng.connect(master);
    env(ng, t + 0.004, 0.006, 0.34, 0.24);
    ns.start(t); ns.stop(t + 0.32);
    // 3) 气动嘶啸：分离气流扫频，中频收尾
    const ws = ctx.createBufferSource(); ws.buffer = noiseBuffer(false);
    const bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass'; bp2.Q.value = 1.4;
    bp2.frequency.setValueAtTime(500, t + 0.05);
    bp2.frequency.exponentialRampToValueAtTime(1600, t + 0.25);
    bp2.frequency.exponentialRampToValueAtTime(300, t + 0.7);
    const wg = ctx.createGain();
    ws.connect(bp2); bp2.connect(wg); wg.connect(master);
    wg.gain.setValueAtTime(0.0001, t);
    wg.gain.exponentialRampToValueAtTime(0.16, t + 0.18);
    wg.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    ws.start(t); ws.stop(t + 0.8);
  }

  // ---- 场景过渡 whoosh（带通扫频噪声）----
  function whoosh() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const ns = ctx.createBufferSource(); ns.buffer = noiseBuffer(false);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(260, t);
    bp.frequency.exponentialRampToValueAtTime(2200, t + 0.34);
    bp.frequency.exponentialRampToValueAtTime(320, t + 0.8);
    const g = ctx.createGain();
    ns.connect(bp); bp.connect(g); g.connect(master);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.26, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    ns.start(t); ns.stop(t + 0.9);
  }

  // ---- 入轨/部署 chime（双音上行，柔和）----
  function chime() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    [[660, 0], [880, 0.14]].forEach(([freq, dt]) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.01;
      const g = ctx.createGain();
      const g2 = ctx.createGain(); g2.gain.value = 0.3;
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(master);
      env(g, t + dt, 0.03, 0.085, 1.6);
      o.start(t + dt); o2.start(t + dt);
      o.stop(t + dt + 1.8); o2.stop(t + dt + 1.8);
    });
  }

  // ---- UI tick ----
  function tick() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 1500;
    const g = ctx.createGain();
    o.connect(g); g.connect(master);
    env(g, t, 0.004, 0.05, 0.05);
    o.start(t); o.stop(t + 0.07);
  }

  // ---- 倒计时提示音：越临近点火音调越高、包络越紧，营造紧张感 ----
  // n = 剩余秒数（10..1）
  // scale：与真实人声倒数叠加时下调提示音音量（避免与人声打架）
  function countdownBeep(n, scale = 1) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const k = 1 - (Math.max(1, Math.min(10, n)) - 1) / 9;   // 0(远) → 1(临近点火)
    const freq = 620 * Math.pow(2, k);                       // 620Hz → 1240Hz
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2;
    const g = ctx.createGain();
    const g2 = ctx.createGain(); g2.gain.value = (0.18 + k * 0.22) * scale;   // 临近点火泛音更强
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(master);
    const decay = 0.20 - k * 0.10;                                  // 临近时更短促
    env(g, t, 0.006, (0.20 + k * 0.14) * scale, decay);
    o.start(t); o2.start(t);
    o.stop(t + decay + 0.1); o2.stop(t + decay + 0.1);
    // 最后 3 秒叠加轻微颤动（紧张感）
    if (n <= 3) {
      const trem = ctx.createOscillator(); trem.frequency.value = 14;
      const tg = ctx.createGain(); tg.gain.value = 0.05;
      trem.connect(tg); tg.connect(g.gain);
      trem.start(t); trem.stop(t + decay + 0.1);
    }
  }

  // ---- 点火震撼音：引擎咆哮 + 次低频震动 + 爆裂 ----
  function ignitionPower() {
    if (!ensure()) return;
    const t = ctx.currentTime;
    // 次低频震动（40 → 26 Hz 下扫，模拟地面感受到的低频轰鸣）
    const sub = ctx.createOscillator(); sub.type = 'sine';
    sub.frequency.setValueAtTime(42, t);
    sub.frequency.exponentialRampToValueAtTime(26, t + 2.2);
    const subG = ctx.createGain();
    sub.connect(subG); subG.connect(master);
    subG.gain.setValueAtTime(0.0001, t);
    subG.gain.exponentialRampToValueAtTime(0.55, t + 0.12);
    subG.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    sub.start(t); sub.stop(t + 2.8);
    // 引擎咆哮（宽带噪声，带通由亮转闷）
    const ns = ctx.createBufferSource(); ns.buffer = noiseBuffer(false);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(180, t + 2.0);
    const g = ctx.createGain();
    ns.connect(bp); bp.connect(g); g.connect(master);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.42, t + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
    ns.start(t); ns.stop(t + 3.0);
    // 点火爆裂
    const cr = ctx.createBufferSource(); cr.buffer = noiseBuffer(false);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200;
    const cg = ctx.createGain();
    cr.connect(hp); hp.connect(cg); cg.connect(master);
    env(cg, t, 0.02, 0.28, 1.6);
    cr.start(t); cr.stop(t + 1.8);
    // 持续 rumble 接上
    rumbleStart();
    rumbleLevel(0.6);
  }

  // ---- 太阳翼伺服（展开/收拢的机械转动声）----
  function solarServo(dir) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const f0 = dir > 0 ? 180 : 150;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(dir > 0 ? 320 : 110, t + 1.1);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = ctx.createGain();
    o.connect(lp); lp.connect(g); g.connect(master);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.13, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    o.start(t); o.stop(t + 1.4);
    // 两声定位卡嗒
    for (let i = 0; i < 2; i++) {
      const c = ctx.createOscillator(); c.type = 'square'; c.frequency.value = 780;
      const cg = ctx.createGain();
      c.connect(cg); cg.connect(master);
      env(cg, t + 0.25 + i * 0.55, 0.004, 0.07, 0.06);
      c.start(t + 0.25 + i * 0.55); c.stop(t + 0.35 + i * 0.55);
    }
  }

  // ---- 真实发射音频（launch-ascent.mp3：人声倒数 10..1 + 点火口令 + 发动机轰鸣）----
  // 用 HTMLAudioElement 承载，避免解码整段 PCM 到 WebAudio 的内存开销
  let launchClip = null, clipReady = false, clipErr = '', clipFailed = false;
  let clipArmed = false, clipArmErr = '';
  const CLIP_URL = './assets/audio/launch-ascent.mp3';

  // 等待媒体可播放（readyState >= 2 表示已有当前播放位置的数据）；超时返回 false
  function waitPlayable(el, timeoutMs) {
    return new Promise(function (resolve) {
      if (!el) return resolve(false);
      if (el.readyState >= 2) return resolve(true);
      if (el.error) return resolve(false);
      let done = false;
      function finish(ok) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        el.removeEventListener('loadeddata', onOk);
        el.removeEventListener('canplay', onOk);
        el.removeEventListener('error', onErr);
        resolve(ok);
      }
      function onOk() { finish(el.readyState >= 2); }
      function onErr() { finish(false); }
      const timer = setTimeout(function () { finish(el.readyState >= 2); }, Math.max(0, timeoutMs || 0));
      el.addEventListener('loadeddata', onOk);
      el.addEventListener('canplay', onOk);
      el.addEventListener('error', onErr);
    });
  }

  function loadLaunchClip(url) {
    if (launchClip) return;
    try {
      launchClip = new Audio();
      launchClip.preload = 'auto';          // 先设 preload 再设 src，确保从一开始就缓冲
      launchClip.volume = 0;
      launchClip.addEventListener('error', function () {
        clipErr = '加载/解码失败'; clipFailed = true;
        console.warn('[audio] launch-ascent.mp3 加载失败：', launchClip.error);
      });
      launchClip.src = url || CLIP_URL;
      clipReady = true;
      console.log('[audio] 已载入发射音频:', launchClip.src);
    } catch (e) {
      clipReady = false;
      clipErr = String(e);
    }
  }
  // 等发射音频可播放（供发射前调用，保证 t=0 就能起播、不与画面脱节）
  function ensureLaunchClipReady(timeoutMs) {
    if (!clipReady || !launchClip || clipFailed) return Promise.resolve(false);
    return waitPlayable(launchClip, timeoutMs);
  }
  // 在用户手势的"同步阶段"就起播（音量 0），把自动播放授权一次性拿到手；
  // 之后无论隔多久再改 currentTime / 音量，都不会被自动播放策略拒绝。
  // 这是"点击后要等场景构建完才 play 被浏览器拦掉"的根治办法。
  function armLaunchClip() {
    if (!clipReady || !launchClip || clipFailed) return false;
    if (clipArmed && !launchClip.paused) return true;
    try {
      launchClip.volume = 0;
      const p = launchClip.play();
      if (p && p.catch) {
        p.catch(function (err) {
          clipArmErr = String((err && err.name) || err);
          console.warn('[audio] launch-ascent.mp3 预热起播被拒：', clipArmErr);
        });
      }
      clipArmed = true;
      return true;
    } catch (e) { clipArmErr = String(e); return false; }
  }
  // 返回是否真正开始播放：未就绪 / 被拒播 都返回 false，让上层下一帧重试或回退合成音效
  function launchClipStart(offset = 0) {
    if (!clipReady || !launchClip || muted || clipFailed) return false;
    // 预热已在自然播放且播放头与场景偏差 < 1s：只抬音量、绝不 seek；
    // 预热播放头本身与场景同源（同时刻起步），就是最准的对齐；
    // 反复 seek 会不断打断缓冲（readyState 回落），反而让人声迟迟出不来。
    if (!launchClip.paused && !launchClip.ended && launchClip.currentTime > 0 &&
        Math.abs(launchClip.currentTime - offset) < 1.0) {
      launchClip.volume = 0.9;
      return true;
    }
    if (launchClip.readyState < 2) return false;   // 数据未就绪，交回上层重试
    try {
      const dur = (launchClip.duration && isFinite(launchClip.duration)) ? launchClip.duration : 34;
      launchClip.currentTime = Math.max(0, Math.min(offset, Math.max(0, dur - 0.05)));
    } catch (e) { clipErr = '定位失败: ' + e; return false; }
    launchClip.volume = 0.9;
    // 已预热且在播时不再调用 play()，零拒绝风险；仅在暂停时补一次
    try {
      if (launchClip.paused) {
        const p = launchClip.play();
        if (p && p.catch) {
          p.catch(function (err) {
            clipErr = '播放被拒绝: ' + ((err && err.name) || err);
            console.warn('[audio] launch-ascent.mp3', clipErr);
          });
        }
      }
    } catch (e) { clipErr = '播放异常: ' + e; return false; }
    return true;
  }
  function launchClipLevel(v) {
    if (!clipReady || !launchClip) return;
    launchClip.volume = Math.max(0, Math.min(1, v));
  }
  function launchClipStop() {
    if (!clipReady || !launchClip) return;
    try { launchClip.pause(); launchClip.currentTime = 0; } catch (e) {}
  }
  function hasLaunchClip() { return clipReady && !clipFailed; }
  // 主动长文件是否已经自然播完（ended 或已到末尾）：
  // 低帧率下场景时间被 dt 上限钳制、会落后于真实时间，音频先播完属正常，
  // 此时看门狗绝不能再把它重新拉起来（否则会把尾巴重播一遍）
  function launchClipEnded() {
    if (!clipReady || !launchClip) return false;
    if (launchClip.ended) return true;
    const dur = isFinite(launchClip.duration) ? launchClip.duration : 0;
    return dur > 0 && launchClip.currentTime >= dur - 0.05;
  }
  // 真正在播放中？（未加载完 / 被拒播 / 已结束 都为 false → 上层回退合成轰鸣）
  function clipPlaying() {
    return !!(clipReady && !clipFailed && launchClip && !launchClip.paused && !launchClip.ended &&
      launchClip.readyState >= 2 && launchClip.currentTime > 0);
  }
  // 音频主时钟用：真正在播时返回当前播放头（秒），否则 -1（供 launch.js 把音频时间作为场景主时钟）
  function clipTime() {
    if (!clipReady || !launchClip || clipFailed || muted) return -1;
    if (launchClip.paused || launchClip.ended || launchClip.readyState < 2) return -1;
    return launchClip.currentTime > 0 ? launchClip.currentTime : -1;
  }
  function clipStatus() {
    if (!clipReady || !launchClip) return { ready: false, err: clipErr };
    return {
      ready: true, err: clipErr, failed: clipFailed,
      armed: clipArmed, armErr: clipArmErr,
      playing: clipPlaying(),
      t: launchClip.currentTime || 0,
      dur: isFinite(launchClip.duration) ? launchClip.duration : 0,
      vol: launchClip.volume,
      muted: launchClip.muted,
      paused: launchClip.paused,
      readyState: launchClip.readyState,
    };
  }

  // ---- 发射过程语音播报（多条：各按自己的时间点触发，如"逃逸塔分离/助推器分离/一二级分离"）----
  // 与主动长文件同一套策略：先加载、手势内解锁、触发时只改 currentTime/音量
  const cues = {};
  function loadCue(name, url) {
    if (cues[name]) return;
    try {
      const el = new Audio();
      el.preload = 'auto';
      el.volume = 0;
      const rec = { el: el, ready: true, failed: false, err: '', armed: false };
      el.addEventListener('error', function () {
        rec.failed = true; rec.err = '加载/解码失败';
        console.warn('[audio] 语音播报 ' + name + ' 加载失败：', el.error);
      });
      el.src = url;
      cues[name] = rec;
      console.log('[audio] 已载入语音播报:', name, el.src);
    } catch (e) { /* 单条失败不影响其它 */
    }
  }
  // 手势内解锁：静音 play 一下再暂停，把该元素的播放授权拿到手（之后隔多久再播都不会被拦）
  function armCues() {
    Object.keys(cues).forEach(function (k) {
      const r = cues[k];
      if (!r.ready || r.failed) return;
      try {
        r.el.volume = 0;
        const p = r.el.play();
        if (p && p.then) p.then(function () { try { r.el.pause(); r.el.currentTime = 0; } catch (e) {} }).catch(function () {});
        r.armed = true;
      } catch (e) {}
    });
  }
  function cueReady(name) { const r = cues[name]; return !!(r && r.ready && !r.failed); }
  function cueAllReady() { return Object.keys(cues).every(function (k) { return cueReady(k); }); }
  // 触发某条播报：未就绪返回 false，交上层下一帧重试
  function cueStart(name, volume) {
    const r = cues[name];
    if (!r || !r.ready || r.failed || muted) return false;
    if (r.el.readyState < 2) return false;
    try { r.el.currentTime = 0; } catch (e) { return false; }
    r.el.volume = Math.max(0, Math.min(1, volume == null ? 0.92 : volume));
    try {
      if (r.el.paused) {
        const p = r.el.play();
        if (p && p.catch) {
          p.catch(function (err) {
            r.err = '播放被拒绝: ' + ((err && err.name) || err);
            console.warn('[audio] 语音播报 ' + name, r.err);
          });
        }
      }
    } catch (e) { r.err = '播放异常: ' + e; return false; }
    return true;
  }
  function cueStopAll() {
    Object.keys(cues).forEach(function (k) {
      const r = cues[k];
      try { r.el.pause(); r.el.currentTime = 0; } catch (e) {}
    });
  }
  function cueStatus() {
    return Object.keys(cues).map(function (k) {
      const r = cues[k], el = r.el;
      return {
        name: k, ready: r.ready, failed: r.failed, err: r.err,
        playing: !!(el && !el.paused && !el.ended && el.readyState >= 2 && el.currentTime > 0),
        vol: el ? el.volume : 0,
        t: (el && el.currentTime) || 0,
        dur: (el && isFinite(el.duration)) ? el.duration : 0,
      };
    });
  }

  function setMuted(m) {
    muted = m;
    if (!ctx) return;
    master.gain.setTargetAtTime(m ? 0.0001 : 0.85, ctx.currentTime, 0.1);
    if (m) { if (rumble) rumbleStop(); if (clipReady) launchClipStop(); cueStopAll(); }
  }

  return {
    init: ensure, ambientStart, ambientStop, ambientDuck,
    rumbleStart, rumbleLevel, rumbleStop,
    ignition, ignitionPower, countdownBeep, solarServo,
    pop, clack, sepBang, whoosh, chime, tick,
    loadLaunchClip, launchClipStart, launchClipLevel, launchClipStop, hasLaunchClip, clipPlaying, clipStatus,
    launchClipEnded, ensureLaunchClipReady, armLaunchClip, clipTime,
    loadCue, armCues, cueStart, cueStopAll, cueStatus, cueReady, cueAllReady,
    setMuted, isMuted: () => muted,
  };
}
