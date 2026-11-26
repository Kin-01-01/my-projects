// 神舟二十三号部件层级、原理文案与拆解位移
// 比例依据公开资料：三舱总长约 8m，柱段直径 2.5m，轨道舱长 2.8m/直径 2.2m，
// 返回舱钟形长 2.0m/直径 2.4m，推进舱长 3.0m/直径 2.5m，太阳翼单块约 2.0 x 3.4m。
// offset = 拆解时相对父级的弹出位移（米，飞船轴向为 Y 向上）。

export const PARTS = [
  {
    id: 'ship', label: '神舟二十三号飞船', color: '#cfd6e0',
    desc: '采用返回舱居中的三舱式构型，由轨道舱、返回舱、推进舱及前端对接机构组成。发射阶段还有逃逸塔（已分离）。本演示展示在轨构型。',
    principle: '三舱通过舱段间结构框与火工锁连接。入轨后轨道舱提供工作与留轨实验空间，返回舱是航天员往返与操控中心，推进舱提供能源、姿轨控动力。返回时依次分离轨道舱、推进舱，仅返回舱再入着陆。',
    tags: ['三舱构型', '返回舱居中', '总长 9.2m', '直径 2.5m'],
    offset: [0, 0, 0],
    children: [
      {
        id: 'docking', label: '对接机构', color: '#9fb4d8',
        desc: '位于轨道舱前端，用于与空间站节点舱对接。采用异体同构周边式对接装置，含捕获锁、缓冲阻尼与密封通道。',
        principle: '交会接近后，主动端导向瓣捕获被动端；缓冲机构吸收碰撞能量并调姿，锁定后形成刚性密封通道，航天员可穿舱往返。',
        tags: ['异体同构', '捕获缓冲', '密封通道'],
        offset: [0, 3.4, 0],
      },
      {
        id: 'orbital', label: '轨道舱', color: '#dfe3e8',
        desc: '圆柱体，长 2.8m、直径约 2.2m，是航天员的“太空卧室兼工作间”，也是留轨实验舱。返回后仍能留轨工作约半年。',
        principle: '集工作、饮食、睡眠与清洁功能于一体，内置生命保障与科学实验设备；两侧太阳翼供电，尾部姿控发动机维持轨道。',
        tags: ['长 2.8m', '直径 2.2m', '留轨实验', '多功能厅'],
        offset: [0, 1.7, 0],
        children: [
          {
            id: 'orbitalSolar', label: '轨道舱太阳翼', color: '#2f5fa8',
            desc: '轨道舱两侧可展开太阳电池翼，单块面积约 2.0 x 3.4m，留轨阶段提供 0.5kW 以上电力。',
            principle: '将光能转为电能为舱体与蓄电池充电；对日定向保证供电，是留轨长期工作的能源基础。',
            tags: ['2.0 x 3.4m', '约 0.5kW', '对日定向'],
            offset: [4.8, 0, 0],
          },
          {
            id: 'orbitalHatch', label: '舱门与观察窗', color: '#b9c2cf',
            desc: '靠近返回舱一侧设有直径仅 65cm 的圆形舱门与上方观察窗，是航天员进出轨道舱的通道。',
            principle: '舱门采用压紧密封结构，保证气密；观察窗用于目视监视交会对接与舱外环境。',
            tags: ['直径 65cm', '气密压紧', '观察窗'],
            offset: [0, 0.2, 1.6],
          },
        ],
      },
      {
        id: 'reentry', label: '返回舱', color: '#caa23a',
        desc: '钟形气动外形，长 2.0m、直径 2.4m，是飞船指挥控制中心，也是唯一返回地面的舱段。内设 3 名航天员斜躺座椅。',
        principle: '再入时利用钟形大升阻比控制弹道，防热层烧蚀吸热；开伞减速后由着陆缓冲发动机实现软着陆，着陆速度不大于 3.5m/s。',
        tags: ['钟形气动', '长 2.0m', '直径 2.4m', '软着陆 3.5m/s'],
        offset: [0, 0, 0],
        children: [
          {
            id: 'seats', label: '航天员座椅', color: '#8a939f',
            desc: '舱内 3 张斜躺式座椅，金属框架喷涂浅灰，坐垫与靠背为阻燃浅咖啡色织物，配多向束缚带，用于起飞、上升与返回阶段乘坐。',
            principle: '斜躺姿势使再入过载沿背部均匀分布，配合缓冲机构将峰值过载限制在 3-4g；织物与束缚系统共同固定身体，防止姿态失控。',
            tags: ['3 座', '金属框架', '阻燃织物', '过载 3-4g'],
            offset: [0, 0.1, 1.9],
          },
          {
            id: 'console', label: '操控台', color: '#474d57',
            desc: '航天员面前的中央操控台：金属骨架外包哑光塑料壳体，前倾面板嵌双主显示屏与一排大间距操作按钮，下方为手控操纵手柄。',
            principle: '双主显示屏互为备份显示分系统遥测；大按钮在半躺姿态下触手可及，手控手柄供航天员手动调姿与驾驶。',
            tags: ['金属骨架', '塑料外壳', '双主屏', '手控手柄'],
            offset: [1.1, 0.6, 2.4],
          },
          {
            id: 'instrument', label: '仪表盘', color: '#15181d',
            desc: '返回舱正前方整块仪表板，含三具圆形仪表、两块状态显示屏与一排指示灯，位于最佳视距内，无需抬头低头即可监视。',
            principle: '仪表实时显示姿轨控、生命保障、导引等分系统状态；指示灯提供关键告警，航天员据此判断并发出控制指令。',
            tags: ['三仪表', '状态屏', '指示灯', '最佳视角'],
            offset: [-1.1, 1.1, 2.8],
          },
          {
            id: 'chute', label: '降落伞舱', color: '#d8d2c4',
            desc: '返回舱顶部的主伞舱，容纳面积达 1200m² 的回收伞系统。',
            principle: '高空依次拉出引导伞、减速伞与主伞，将再入后的高速降至安全着陆速度，最后缓冲发动机点火软着陆。',
            tags: ['主伞 1200m²', '多级开伞', '缓冲着陆'],
            offset: [0, 3.9, 0],
          },
        ],
      },
      {
        id: 'service', label: '推进舱', color: '#6b7079',
        desc: '圆柱形动力舱，长 3.0m、直径 2.5m，底部锥段直径 2.8m，装载推进系统、电源、热控与通信设备。',
        principle: '主发动机提供轨道机动与制动减速动力，姿控发动机调整姿态；两侧大型太阳翼供电，贮箱存放推进剂。',
        tags: ['长 3.0m', '直径 2.5m', '动力舱', '主发动机'],
        offset: [0, -2.7, 0],
        children: [
          {
            id: 'serviceSolar', label: '推进舱太阳翼', color: '#274a86',
            desc: '推进舱两侧大型太阳电池翼，总面积 20 余平方米，是飞船主供电源。',
            principle: '对日定向展开，提供整船主要电能；可单翼故障隔离，保证供电冗余。',
            tags: ['20+ m²', '主供电源', '冗余设计'],
            offset: [6.2, 0, 0],
          },
          {
            id: 'engine', label: '主发动机与姿控', color: '#3a3d44',
            desc: '底部主发动机与多组姿控推力器，负责轨道机动、姿态控制与返回制动。',
            principle: '制动点火使飞船脱离轨道进入返回弹道；姿控推力器精确调姿，保证对接口对准与再入姿态。',
            tags: ['制动反推', '姿控调姿', '精确对准'],
            offset: [0, -2.0, 0],
          },
          {
            id: 'tank', label: '推进剂贮箱', color: '#7d6a52',
            desc: '舱内推进剂贮箱，储存姿轨控所需的燃料与氧化剂。',
            principle: '为发动机与推力器供压输送推进剂，是飞船变轨、交会与返回的能源储备。',
            tags: ['燃料贮存', '供压输送', '变轨能源'],
            offset: [2.0, 0, 0],
          },
        ],
      },
    ],
  },
];

// 原理示意 SVG（简洁线框图，非卡通，偏工程示意）
const SCHEMATICS = {
  ship: `<svg viewBox="0 0 220 200"><g fill="none" stroke="#5fd0c8" stroke-width="1.4">
    <rect x="92" y="14" width="36" height="14" rx="3"/>
    <rect x="84" y="30" width="52" height="46" rx="6"/>
    <path d="M84 76 L92 120 L128 120 L136 76 Z"/>
    <rect x="80" y="120" width="60" height="40" rx="5"/>
    <path d="M80 160 L74 184 L146 184 L140 160 Z"/>
    <line x1="20" y1="52" x2="84" y2="52" stroke="#7aa2ff"/>
    <line x1="200" y1="52" x2="136" y2="52" stroke="#7aa2ff"/>
    </g>
    <g fill="#93a0b6" font-size="9" font-family="sans-serif">
    <text x="100" y="10">对接机构</text><text x="92" y="120">返回舱</text>
    <text x="86" y="178">推进舱</text><text x="20" y="46">太阳翼</text></g></svg>`,
  docking: `<svg viewBox="0 0 220 160"><g fill="none" stroke="#9fb4d8" stroke-width="1.4">
    <circle cx="110" cy="90" r="40"/><circle cx="110" cy="90" r="28"/>
    <g stroke="#5fd0c8"><path d="M110 50 l-8 -14 M110 50 l8 -14 M70 90 l-14 -8 M70 90 l-14 8 M150 90 l14 -8 M150 90 l14 8 M110 130 l-8 14 M110 130 l8 14"/></g>
    </g><text x="92" y="20" fill="#93a0b6" font-size="9">导向瓣 / 捕获锁</text></svg>`,
  orbital: `<svg viewBox="0 0 220 150"><g fill="none" stroke="#dfe3e8" stroke-width="1.4">
    <rect x="70" y="50" width="80" height="60" rx="8"/>
    <line x1="14" y1="80" x2="70" y2="80" stroke="#2f5fa8"/><rect x="6" y="68" width="14" height="24" fill="#2f5fa8" opacity=".5"/>
    <line x1="206" y1="80" x2="150" y2="80" stroke="#2f5fa8"/><rect x="200" y="68" width="14" height="24" fill="#2f5fa8" opacity=".5"/>
    <circle cx="110" cy="80" r="6" stroke="#caa23a"/></g>
    <text x="86" y="36" fill="#93a0b6" font-size="9">太阳翼 · 舱门 · 实验设备</text></svg>`,
  orbitalSolar: `<svg viewBox="0 0 220 140"><g fill="none" stroke="#2f5fa8" stroke-width="1.4">
    <rect x="40" y="46" width="64" height="48"/><rect x="116" y="46" width="64" height="48"/>
    <line x1="40" y1="70" x2="104" y2="70"/><line x1="116" y1="70" x2="180" y2="70"/></g>
    <text x="70" y="30" fill="#93a0b6" font-size="9">光伏电池阵列</text></svg>`,
  orbitalHatch: `<svg viewBox="0 0 200 150"><g fill="none" stroke="#b9c2cf" stroke-width="1.4">
    <circle cx="100" cy="80" r="34"/><circle cx="100" cy="80" r="22"/></g>
    <text x="78" y="24" fill="#93a0b6" font-size="9">压紧密封舱门</text></svg>`,
  reentry: `<svg viewBox="0 0 200 170"><g fill="none" stroke="#caa23a" stroke-width="1.4">
    <path d="M70 40 L130 40 L150 140 L50 140 Z"/><line x1="70" y1="40" x2="130" y2="40"/></g>
    <g stroke="#8a939f" stroke-width="1.2"><path d="M86 70 l28 0 M86 90 l28 0 M86 110 l28 0"/></g>
    <text x="74" y="24" fill="#93a0b6" font-size="9">钟形防热外形</text></svg>`,
  seats: `<svg viewBox="0 0 200 150"><g fill="none" stroke="#8a939f" stroke-width="1.4">
    <path d="M60 50 q20 -16 40 0 l0 30 -40 0 Z"/><path d="M110 50 q20 -16 40 0 l0 30 -40 0 Z"/></g>
    <text x="78" y="24" fill="#93a0b6" font-size="9">斜躺束缚座椅</text></svg>`,
  chute: `<svg viewBox="0 0 200 160"><g fill="none" stroke="#d8d2c4" stroke-width="1.4">
    <path d="M60 50 q40 -40 80 0"/><line x1="60" y1="50" x2="100" y2="120"/><line x1="140" y1="50" x2="100" y2="120"/>
    <line x1="80" y1="50" x2="100" y2="120"/><line x1="120" y1="50" x2="100" y2="120"/></g>
    <text x="82" y="24" fill="#93a0b6" font-size="9">1200m² 回收伞</text></svg>`,
  service: `<svg viewBox="0 0 220 180"><g fill="none" stroke="#6b7079" stroke-width="1.4">
    <rect x="78" y="30" width="64" height="90" rx="6"/><path d="M78 120 L70 160 L150 160 L142 120 Z"/>
    <line x1="14" y1="70" x2="78" y2="70" stroke="#274a86"/><rect x="6" y="58" width="14" height="24" fill="#274a86" opacity=".5"/>
    <line x1="206" y1="70" x2="142" y2="70" stroke="#274a86"/><rect x="200" y="58" width="14" height="24" fill="#274a86" opacity=".5"/>
    <circle cx="106" cy="160" r="6" stroke="#3a3d44"/></g>
    <text x="84" y="20" fill="#93a0b6" font-size="9">主发动机 · 太阳翼 · 贮箱</text></svg>`,
  serviceSolar: `<svg viewBox="0 0 220 150"><g fill="none" stroke="#274a86" stroke-width="1.4">
    <rect x="30" y="50" width="76" height="50"/><rect x="114" y="50" width="76" height="50"/>
    <line x1="30" y1="75" x2="106" y2="75"/><line x1="114" y1="75" x2="190" y2="75"/></g>
    <text x="74" y="30" fill="#93a0b6" font-size="9">大型主供电源翼</text></svg>`,
  engine: `<svg viewBox="0 0 200 160"><g fill="none" stroke="#3a3d44" stroke-width="1.4">
    <path d="M80 40 L120 40 L132 110 L68 110 Z"/><path d="M68 110 q32 26 64 0"/></g>
    <text x="80" y="24" fill="#93a0b6" font-size="9">制动 / 姿控推力</text></svg>`,
  tank: `<svg viewBox="0 0 200 150"><g fill="none" stroke="#7d6a52" stroke-width="1.4">
    <rect x="70" y="40" width="60" height="80" rx="20"/></g>
    <text x="80" y="24" fill="#93a0b6" font-size="9">推进剂贮箱</text></svg>`,
  console: `<svg viewBox="0 0 200 150"><g fill="none" stroke="#474d57" stroke-width="1.4">
    <rect x="60" y="60" width="80" height="22" rx="3"/>
    <rect x="68" y="44" width="26" height="18" fill="#5fd0ff" opacity=".5"/>
    <rect x="106" y="44" width="26" height="18" fill="#5fd0ff" opacity=".5"/>
    <path d="M100 82 l0 18"/></g>
    <text x="78" y="24" fill="#93a0b6" font-size="9">中央操控台 · 双主屏</text></svg>`,
  instrument: `<svg viewBox="0 0 200 150"><g fill="none" stroke="#15181d" stroke-width="1.4">
    <rect x="46" y="58" width="108" height="34" rx="4"/>
    <circle cx="70" cy="75" r="11" stroke="#5fd0ff"/><circle cx="100" cy="75" r="11" stroke="#5fd0ff"/><circle cx="130" cy="75" r="11" stroke="#5fd0ff"/>
    <path d="M52 100 h96"/></g>
    <text x="76" y="24" fill="#93a0b6" font-size="9">仪表板 · 三仪表 + 指示灯</text></svg>`,
};

// === 真实发射动作 · 全事件表（供逐条校对）===
// realT：真实 CZ-2F 任务 T+ 秒（央视/新华公开口径，总设计师荆木春详解）
// kind：'audio' = 与音频旁白同步、可在面板「事件对齐」一键校准；
//       'logic' = 由物理积分或时序逻辑推导（无旁白对应，随参数自动变化）
export const LAUNCH_EVENTS = [
  { id: 'IGN',   name: '点火',                realT: '0s',       kind: 'audio', visual: '发动机点火、尾焰建立；发射台锁死，箭体纹丝不动' },
  { id: 'LIFT',  name: '解锁离塔（起飞）',     realT: '约 3 秒多', kind: 'logic', visual: '推力超过箭体重力 → 压紧机构解锁，箭体缓缓上升' },
  { id: 'TURN',  name: '程序转弯',            realT: '12s',      kind: 'logic', visual: '离塔后开始向东倾斜，转为沿轨道方向飞行' },
  { id: 'ESC',   name: '逃逸塔分离',          realT: '120s',     kind: 'audio', visual: '逃逸塔向上抛离' },
  { id: 'BOOST', name: '助推器分离',          realT: '150~155s', kind: 'audio', visual: '四个助推器燃料耗尽，同时与芯级分离' },
  { id: 'CORE',  name: '一二级分离 + 二级点火', realT: '160s',     kind: 'audio', visual: '芯一级燃料耗尽分离坠落，二级发动机同时点火接管' },
  { id: 'FAIR',  name: '整流罩分离',          realT: '210s',     kind: 'audio', visual: '飞出大气层，两半整流罩向两侧抛开并坠落' },
  { id: 'VERN',  name: '二级主机关机 → 游机',  realT: '462s',     kind: 'logic', visual: '主机尾焰熄灭，改由 4 台游机小推力继续推进' },
  { id: 'SECO',  name: '游机关机',            realT: '582s',     kind: 'logic', visual: '游机尾焰熄灭，进入惯性飞行' },
  { id: 'UPPER', name: '船箭分离',            realT: '585s',     kind: 'audio', visual: '芯二级与飞船分离，飞船独立在轨' },
  { id: 'SOLAR', name: '太阳帆板展开',        realT: '入轨后',    kind: 'audio', visual: '两翼解锁、左右对称同步向外展开，最终平直锁定' },
];

// === 发射时间线（秒）：唯一数据源，launch.js 与 main.js 都从这里取值 ===
// 对齐发射 MP3（assets/launch-narration.mp3，212.4s）。校准方法：
//   0.2s 步长音量包络 + 1.6s 窗「人声 3–8Hz 音节调制比」双特征定位旁白；
//   触发时刻 = 旁白起振点 + 1.2~1.7s（话音响起、动作紧跟）。
// 本轮按实测旁白段校准（含此前漏检的"轻声旁白"——音量仅 15% 但语音度 0.49）：
//   逃逸塔 73.0 / 助推器 87.25 / 一二级分离 95.0 起（轻声旁白）/ 整流罩 125.6 起 / 船箭 174.8 起 / 帆板 195.8 起
export const LAUNCH_TL = {
  T_IGN: 10,     // 点火（10 秒倒计时结束，与音频"点火"口令+轰鸣同步）
  T_ESC: 73.5,   // 逃逸塔抛离（旁白 ~73.0s +0.5s）
  T_BOOST: 87.5, // 助推器分离（旁白 ~87.25s +0.25s，4 枚同时分离）
  T_CORE: 96.5,  // 芯一级 / 芯二级分离（旁白 95.0–100.2s，取 +1.5s；先于整流罩）
  T_FAIR: 126.5, // 整流罩抛离（旁白 125.6–138.4s，取 +0.9s；两半抛开+飘落淡出）
  T_UPPER: 176.5,// 芯二级关机并与飞船分离（旁白 174.8–177.2s，取 +1.7s）
  T_SOLAR: 197.0,// 太阳帆板展开（旁白 195.8–198.4s，取 +1.2s；必在船箭分离之后）
  MAX_T: 212,    // 总飞行时长（对齐 MP3）
};

// 发射流程四阶段时间线（秒），用于 HUD 显示与发射控制器调度
export const LAUNCH_PHASES = [
  { id: 1, name: '地面点火准备', tStart: 0, tEnd: LAUNCH_TL.T_IGN, summary: '燃料加注、全系统自检、10 秒倒计时，塔架摆臂撤离，火箭静止点火' },
  { id: 2, name: '火箭升空', tStart: LAUNCH_TL.T_IGN, tEnd: LAUNCH_TL.T_CORE + 2, summary: '点火快速离塔、垂直爬升后转入重力转向斜飞；逃逸塔、助推器依次分离' },
  { id: 3, name: '级间分离', tStart: LAUNCH_TL.T_CORE + 2, tEnd: LAUNCH_TL.T_UPPER, summary: '芯一级与芯二级分离、二级点火接管；随后整流罩抛离（帆板仍收拢）' },
  { id: 4, name: '入轨部署', tStart: LAUNCH_TL.T_UPPER, tEnd: LAUNCH_TL.MAX_T, summary: '芯二级关机并与飞船分离，飞船独立在轨后太阳帆板展开' },
];


export function schematicFor(id) {
  return SCHEMATICS[id] || SCHEMATICS.ship;
}

// 扁平化为 id -> {node, parents:[]}
export function flatten(parts, parents = [], map = {}) {
  for (const n of parts) {
    map[n.id] = { node: n, parents };
    if (n.children) flatten(n.children, [...parents, n.id], map);
  }
  return map;
}
