/* =========================================================
   Mylife · 交互逻辑
   功能：
   1) 内容存 localStorage —— 浏览器里点「写一条」即可增删，无需改代码
   2) 分类筛选（全部/随拍/随笔/旅行）
   3) 焦点大卡 + 瀑布流画廊 + 日志详情
   4) 足迹·中国地图（ECharts 矢量，旅行记录填经纬度即自动标点）
   5) 导航栏滚动显隐 + 滚动渐入
   维护：默认示例在 SEED；正式使用直接在页面里添加即可。
   ========================================================= */

const STORE_KEY = "mylife:entries:v1";

/* ---------- 1. 默认示例数据（首次打开写入本地，之后以本地为准） ---------- */
const SEED = [
  { id: "e1", title: "清晨的第一班地铁", date: "2026.03.12", place: "城市 · 通勤路上", category: "随拍",
    img: "https://picsum.photos/seed/life-metro/700/900",
    text: ["六点四十分的车厢，空得能听见自己的呼吸。",
           "窗外的灯一盏盏亮起来，像城市在慢慢睁眼。我把这一刻存进相册，也存进心里——原来平静也可以这么具体。"] },
  { id: "e2", title: "京都的雨", date: "2026.04.03", place: "日本 · 京都", category: "旅行",
    img: "https://picsum.photos/seed/life-kyoto/700/520",
    text: ["下午忽然落雨，鸭川的水一下子涨了脾气。",
           "躲进一家叫不出名字的小店，点了一杯抹茶，看檐下的雨线把青石板的颜色一点点泡深。旅行的意义，大概就是允许自己什么都不做。"] },
  { id: "e3", title: "书桌上的光", date: "2026.04.21", place: "家中 · 深夜", category: "随笔",
    img: "https://picsum.photos/seed/life-desk/700/820",
    text: ["台灯把书页照成一小片暖岛，四周都是冷的。",
           "写论文写到第三页，忽然觉得这样的安静很珍贵。不是孤独，是和自己待在一起的余地。"] },
  { id: "e4", title: "海边的风很咸", date: "2026.05.09", place: "山东 · 青岛", category: "旅行",
    coord: [120.382, 36.067],
    img: "https://picsum.photos/seed/life-sea/700/560",
    text: ["栈桥尽头风很大，头发乱了也不想整理。",
           "远处有艘船慢慢开走，把海面划成两半。我想，有些离开不必赶上，看着就好。"] },
  { id: "e5", title: "一杯手冲", date: "2026.05.28", place: "街角 · 咖啡馆", category: "随拍",
    img: "https://picsum.photos/seed/life-coffee/700/760",
    text: ["店主说这款豆子有柑橘和焦糖。我喝不出那么细，但很喜欢等待萃取的那几十秒。",
           "生活偶尔需要这种「没什么用」的仪式感。"] },
  { id: "e6", title: "山里的星", date: "2026.06.15", place: "河北 · 太行深处", category: "旅行",
    coord: [114.51, 38.04],
    img: "https://picsum.photos/seed/life-stars/700/980",
    text: ["熄了灯，银河像被人随手撒了一把碎钻。",
           "那一刻突然不焦虑了——在这么大的宇宙里，我的烦恼小得刚好可以忽略。"] },
  { id: "e7", title: "下雨天的猫", date: "2026.07.02", place: "宿舍 · 窗台", category: "随拍",
    img: "https://picsum.photos/seed/life-cat/700/600",
    text: ["楼下的橘猫趴在窗台躲雨，尾巴一摆一摆。",
           "它大概不懂什么是期末周，却比我先学会了放松。"] },
  { id: "e8", title: "夏夜的操场", date: "2026.07.20", place: "校园 · 操场", category: "随笔",
    img: "https://picsum.photos/seed/life-track/700/700",
    text: ["晚跑两圈，汗把衣服贴在后背。",
           "看台上有人弹吉他，跑调但很认真。青春大概就是这样：不完美，却让人想一直待着。"] },
];

/* ---------- 2. 读取 / 保存（localStorage，失败则内存兜底） ---------- */
function loadEntries() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* 隐私模式等场景忽略 */ }
  try { localStorage.setItem(STORE_KEY, JSON.stringify(SEED)); } catch (e) {}
  return SEED.map((x) => ({ ...x }));
}
function saveEntries() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(entries)); }
  catch (e) { console.warn("本地保存失败（可能是隐私模式）：", e); }
}
let entries = loadEntries();
let currentFilter = "all";

/* ---------- 3. 工具 ---------- */
const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (id) => document.getElementById(id);
const defaultImg = (id) => `https://picsum.photos/seed/${encodeURIComponent(id)}/700/820`;
const todayStr = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
};

/* ---------- 4. 渲染 ---------- */
const masonry = $("masonry");
const journalList = $("journalList");
const featuredBox = $("featured");
const footprintList = $("footprintList");

function renderFeatured() {
  featuredBox.innerHTML = "";
  if (currentFilter !== "all" || !entries.length) return;
  const e = entries[0];
  const card = document.createElement("article");
  card.className = "featured-card reveal";
  card.innerHTML = `
    <button class="card-del" data-del="${esc(e.id)}" title="删除">✕</button>
    <div class="f-media"><img src="${esc(e.img)}" alt="${esc(e.title)}" loading="lazy" /></div>
    <div class="f-body">
      <div class="f-top"><span class="tag cat-${esc(e.category)}">${esc(e.category)}</span><span class="g-date">${esc(e.date)}</span></div>
      <h3 class="f-title">${esc(e.title)}</h3>
      <div class="f-place">${esc(e.place)}</div>
      <div class="f-text">${e.text.slice(0, 2).map((p) => `<p>${esc(p)}</p>`).join("")}</div>
    </div>`;
  card.addEventListener("click", (ev) => {
    if (ev.target.closest(".card-del")) return;
    scrollToEntry(e.id);
  });
  card.querySelector(".card-del").addEventListener("click", (ev) => { ev.stopPropagation(); deleteEntry(e.id); });
  featuredBox.appendChild(card);
  observe(card);
}

function renderGallery() {
  masonry.innerHTML = "";
  const list = currentFilter === "all" ? entries.slice(1) : entries.filter((e) => e.category === currentFilter);
  list.forEach((e) => {
    const card = document.createElement("article");
    card.className = "gallery-card";
    card.innerHTML = `
      <button class="card-del" data-del="${esc(e.id)}" title="删除">✕</button>
      <span class="gallery-hint">点击看故事 ↘</span>
      <img src="${esc(e.img)}" alt="${esc(e.title)}" loading="lazy" />
      <div class="gallery-meta">
        <div><div class="g-title">${esc(e.title)}</div><div class="g-date">${esc(e.date)}</div></div>
        <span class="tag cat-${esc(e.category)}">${esc(e.category)}</span>
      </div>`;
    card.addEventListener("click", (ev) => { if (ev.target.closest(".card-del")) return; scrollToEntry(e.id); });
    card.querySelector(".card-del").addEventListener("click", (ev) => { ev.stopPropagation(); deleteEntry(e.id); });
    masonry.appendChild(card);
    observe(card);
  });
}

function renderJournal() {
  journalList.innerHTML = "";
  const list = currentFilter === "all" ? entries : entries.filter((e) => e.category === currentFilter);
  list.forEach((e) => {
    const card = document.createElement("article");
    card.className = `journal-card cat-${esc(e.category)}`;
    card.id = e.id;
    card.innerHTML = `
      <button class="card-del" data-del="${esc(e.id)}" title="删除">✕</button>
      <div class="j-media"><img src="${esc(e.img)}" alt="${esc(e.title)}" loading="lazy" /></div>
      <div class="j-body">
        <div class="j-top"><span class="tag cat-${esc(e.category)}">${esc(e.category)}</span><span class="g-date">${esc(e.date)}</span></div>
        <h3 class="j-title">${esc(e.title)}</h3>
        <div class="j-place">${esc(e.place)}</div>
        <div class="j-text">${e.text.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
      </div>`;
    card.querySelector(".card-del").addEventListener("click", (ev) => { ev.stopPropagation(); deleteEntry(e.id); });
    journalList.appendChild(card);
    observe(card);
  });
}

function renderFootprint() {
  footprintList.innerHTML = "";
  const china = entries.filter((e) => e.coord);
  const overseas = entries.filter((e) => e.category === "旅行" && !e.coord);
  [...china, ...overseas].forEach((e) => {
    const li = document.createElement("li");
    li.className = "footprint-item";
    const isOver = !e.coord;
    li.innerHTML = `
      <span class="fp-dot ${isOver ? "overseas" : ""}"></span>
      <span class="fp-name">${esc(e.title.replace(/的.*$/, "") || e.place)}</span>
      <span class="fp-region">${esc(e.place)}</span>`;
    li.addEventListener("click", () => scrollToEntry(e.id));
    footprintList.appendChild(li);
  });
  initChinaMap(china);
}

function renderAll() {
  renderFeatured();
  renderGallery();
  renderJournal();
  renderFootprint();
  renderTimeline();
  initHero();
}

/* ---------- 5. 跳转 / 删除 ---------- */
function scrollToEntry(id) {
  const t = $(id);
  if (!t) return;
  t.scrollIntoView({ behavior: "smooth", block: "center" });
  t.classList.add("flash");
  setTimeout(() => t.classList.remove("flash"), 1400);
}
function deleteEntry(id) {
  if (!confirm("确定删除这条记录吗？")) return;
  entries = entries.filter((e) => e.id !== id);
  saveEntries();
  renderAll();
}

/* ---------- 6. 分类筛选 ---------- */
$("filterTabs").addEventListener("click", (ev) => {
  const btn = ev.target.closest(".filter-tab");
  if (!btn) return;
  currentFilter = btn.dataset.filter;
  document.querySelectorAll(".filter-tab").forEach((b) => b.classList.toggle("active", b === btn));
  renderFeatured(); renderGallery(); renderJournal();
});

/* ---------- 7. 添加记录弹窗 ---------- */
const modal = $("modal");
let pendingFile = null;

function openModal() {
  $("f-date").value = (() => { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; })();
  $("f-title").value = ""; $("f-place").value = ""; $("f-text").value = "";
  $("f-imgurl").value = ""; $("f-imgfile").value = ""; $("f-lng").value = ""; $("f-lat").value = "";
  $("f-category").value = "随拍"; pendingFile = null;
  $("coordRow").style.display = "none";
  modal.hidden = false; requestAnimationFrame(() => modal.classList.add("show"));
}
function closeModal() {
  modal.classList.remove("show");
  setTimeout(() => { modal.hidden = true; }, 300);
}
$("fab").addEventListener("click", openModal);
$("modalClose").addEventListener("click", closeModal);
$("modalCancel").addEventListener("click", closeModal);
modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
$("f-category").addEventListener("change", (e) => {
  $("coordRow").style.display = e.target.value === "旅行" ? "grid" : "none";
});
$("f-imgfile").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) { pendingFile = null; return; }
  const reader = new FileReader();
  reader.onload = () => {
    const buf = reader.result;
    pendingFile = arrayBufferToDataURL(buf, file.type);
    const gps = parseExifGPS(buf);
    if (gps) {
      $("f-lng").value = gps.lng.toFixed(4);
      $("f-lat").value = gps.lat.toFixed(4);
      if ($("f-category").value === "随拍") $("f-category").value = "旅行";
      $("coordRow").style.display = "grid";
      const note = $("exifNote"); if (note) note.hidden = false;
    }
  };
  reader.readAsArrayBuffer(file);
});

$("modalSave").addEventListener("click", () => {
  const title = $("f-title").value.trim() || "未命名记录";
  const place = $("f-place").value.trim() || "未知地点";
  const category = $("f-category").value;
  const dateRaw = $("f-date").value;
  const date = dateRaw ? dateRaw.replace(/-/g, ".") : todayStr();
  const text = $("f-text").value.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  const img = pendingFile || $("f-imgurl").value.trim() || defaultImg("u" + Date.now());
  const lng = parseFloat($("f-lng").value), lat = parseFloat($("f-lat").value);
  const coord = (!isNaN(lng) && !isNaN(lat)) ? [lng, lat] : undefined;

  const entry = { id: "u" + Date.now(), title, date, place, category, img, text: text.length ? text : ["（还没有写正文）"] };
  if (coord) entry.coord = coord;

  entries.unshift(entry);
  saveEntries();
  currentFilter = "all";
  document.querySelectorAll(".filter-tab").forEach((b) => b.classList.toggle("active", b.dataset.filter === "all"));
  renderAll();
  closeModal();
  setTimeout(() => scrollToEntry(entry.id), 400);
});

/* ---------- 8. 足迹地图（ECharts 矢量） ---------- */
let mapChart = null;
let mapResizeBound = false;
function initChinaMap(chinaPoints) {
  if (typeof echarts === "undefined" || !$("chinaMap")) {
    const box = $("chinaMap");
    if (box) box.innerHTML = '<p style="opacity:.55;padding:48px 16px;text-align:center;font-size:14px">地图组件需联网加载（ECharts CDN）。当前网络不可用，足迹列表仍可正常点击查看。</p>';
    return;
  }
  if (mapChart) { mapChart.dispose(); mapChart = null; }
  const render = (geoJson) => {
    if (!geoJson) return;
    echarts.registerMap("china", geoJson);
    mapChart = echarts.init($("chinaMap"));
    mapChart.setOption({
      backgroundColor: "transparent",
      geo: {
        map: "china", roam: false, zoom: 1.18, top: "6%", bottom: "6%",
        itemStyle: { areaColor: "rgba(18,26,38,0.6)", borderColor: "rgba(95,215,208,0.35)", borderWidth: 0.8 },
        emphasis: { itemStyle: { areaColor: "rgba(28,40,56,0.8)" }, label: { show: false } },
        label: { show: false },
      },
      series: [
        { type: "lines", coordinateSystem: "geo",
          data: chinaPoints.length > 1 ? [{ coords: chinaPoints.map((f) => f.coord) }] : [],
          lineStyle: { color: "#6aa8ff", width: 1.4, opacity: 0.55, curveness: 0.2 },
          effect: { show: true, period: 5, trailLength: 0.3, color: "#5fd7d0", symbolSize: 4 }, zlevel: 1 },
        { type: "effectScatter", coordinateSystem: "geo",
          data: chinaPoints.map((f) => ({ name: f.place, value: [...f.coord, 1], id: f.id })),
          symbolSize: 13, rippleEffect: { scale: 3, brushType: "stroke" },
          itemStyle: { color: "#5fd7d0", shadowBlur: 12, shadowColor: "#5fd7d0" },
          label: { show: true, position: "right", formatter: "{b}", color: "#eaf1f8", fontSize: 12 }, zlevel: 2 },
      ],
    });
    mapChart.on("click", (p) => { if (p.data && p.data.id) scrollToEntry(p.data.id); });
    if (!mapResizeBound) {
      window.addEventListener("resize", () => mapChart && mapChart.resize());
      mapResizeBound = true;
    }
  };
  if (window.CHINA_GEO) render(window.CHINA_GEO);
  else fetch("https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json").then((r) => r.json()).then(render)
    .catch((err) => console.warn("地图数据加载失败：", err));
}

/* ---------- 9. 导航栏滚动显隐（rAF 节流） ---------- */
const navbar = $("navbar");
let lastY = window.scrollY, ticking = false;
function onScroll() {
  const y = window.scrollY;
  if (y > lastY && y > 120) navbar.classList.add("hidden"); else navbar.classList.remove("hidden");
  navbar.classList.toggle("scrolled", y > 40);
  lastY = y; ticking = false;
}
window.addEventListener("scroll", () => { if (!ticking) { requestAnimationFrame(onScroll); ticking = true; } }, { passive: true });

/* ---------- 10. 滚动渐入 ---------- */
let io;
function observe(el) {
  if (io) io.observe(el);
}
io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); } });
}, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

// 观察页面里静态写死的 .reveal 元素（首屏/标题/筛选条/地图框/关于卡），
// 否则它们会一直停在 opacity:0 而“加载不全”
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

// 兜底：浏览器不支持 IntersectionObserver 时直接全部显示
if (!("IntersectionObserver" in window)) {
  document.querySelectorAll(".reveal, .gallery-card, .journal-card, .footprint-wrap, .featured-card, .filter-tabs")
    .forEach((el) => el.classList.add("is-visible"));
}

/* ---------- 11. 启动 ---------- */
renderAll();
