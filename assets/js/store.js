/* =====================================================================
 * 寒羽智瞳 · 数据层（最终版 v2，新旧接口全兼容）
 * 数据保存在浏览器 localStorage；接入后端后把 load/save 换成 API。
 * ===================================================================*/
(function (global) {
  'use strict';

  var DB_KEY = 'hy_db_v2';
  var SS_KEY = 'hy_session_v2';
  var bus = {};
  var _db = null;

  /* ---------------- 工具 ---------------- */
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function dstr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function tstr(d) { return dstr(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function day(n) { var d = new Date(); d.setHours(0, 0, 0, 0); if (n) d.setDate(d.getDate() + n); return d; }
  function pdate(s) { return new Date(String(s).replace(/-/g, '/')); }
  function uid(p) { return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function lcg(seed) { var s = seed >>> 0; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function ri(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }
  function rf(r, a, b, dec) { var v = a + r() * (b - a); var p = Math.pow(10, dec || 0); return Math.round(v * p) / p; }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function midnight(off) { var d = new Date(); d.setHours(0, 0, 0, 0); if (off) d.setDate(d.getDate() + off); return d; }
  function hex(r, n) { var s = ''; for (var i = 0; i < n; i++) s += '0123456789abcdef'[Math.floor(r() * 16)]; return s; }
  function num(n) { return (n == null ? 0 : n).toLocaleString('zh-CN'); }
  function hashOf(str) {
    var h = 0x811c9dc5, h2 = 0x01000193;
    for (var i = 0; i < str.length; i++) { h = ((h ^ str.charCodeAt(i)) * 16777619) >>> 0; h2 = (h2 + str.charCodeAt(i) * (i + 7)) >>> 0; }
    var s = (h.toString(16) + h2.toString(16) + (h ^ h2).toString(16)).padEnd(24, '0');
    return '0x' + s.slice(0, 40);
  }

  /* ---------------- 字典 ---------------- */
  var ALERT_TYPES = ['温度异常', '湿度异常', '氨气浓度高', '通风异常', '其他'];
  var TYPE_COLORS = { '温度异常': '#7a5af8', '湿度异常': '#34d399', '氨气浓度高': '#38bdf8', '通风异常': '#fbbf24', '其他': '#fb7185' };
  var CAUSES = ['冻伤应激', '呼吸道疾病', '肠道疾病', '营养代谢病', '踩踏挤压', '弱雏淘汰', '其他'];
  var DISPOSALS = ['无害化处理', '深埋', '焚烧', '送检化验'];
  var BREEDS = ['霍尔多巴吉鹅', '朗德鹅', '莱茵鹅', '皖西白鹅'];
  var HOUSE_STATUS = ['在养', '空舍', '消毒中'];
  var ROLES = ['超级管理员', '场长', '兽医', '饲养员'];
  var STAFF = ['李莹', '王振宇', '郭良瑞', '郝天祥', '赵琦'];
  var ZONES = ['舍内东侧', '舍内西侧', '料道区', '饮水区'];

  var SEED_FARMS = [
    { id: 'F1', name: '寒羽一号鹅场', region: '黑龙江 · 黑河市爱辉区', manager: '王振宇', phone: '139****7742', built: '2023-05' },
    { id: 'F2', name: '寒羽二号鹅场', region: '黑龙江 · 齐齐哈尔富裕县', manager: '郭良瑞', phone: '138****5567', built: '2024-03' },
    { id: 'F3', name: '呼伦贝尔联合社', region: '内蒙古 · 呼伦贝尔阿荣旗', manager: '郝天祥', phone: '150****6698', built: '2024-11' }
  ];
  /* [编号, 鹅场, 批次, 品种, 在栏, 日龄, 负责人, 状态, 面积㎡] 合计 12480 */
  var SEED_HOUSES = [
    ['A-01', 'F1', '2026-B01', '霍尔多巴吉鹅', 880, 82, '赵琦', '在养', 600],
    ['A-02', 'F1', '2026-B01', '霍尔多巴吉鹅', 920, 82, '赵琦', '在养', 600],
    ['A-03', 'F1', '2026-B02', '朗德鹅', 1180, 61, '郭良瑞', '在养', 760],
    ['A-05', 'F1', '2026-B02', '朗德鹅', 760, 61, '郝天祥', '在养', 520],
    ['A-06', 'F1', '2026-B03', '霍尔多巴吉鹅', 1060, 34, '郝天祥', '在养', 700],
    ['A-09', 'F1', '2026-B03', '霍尔多巴吉鹅', 1040, 34, '王振宇', '在养', 700],
    ['B-02', 'F2', '2026-B01', '莱茵鹅', 720, 82, '郭良瑞', '在养', 520],
    ['B-07', 'F2', '2026-B02', '莱茵鹅', 950, 61, '赵琦', '在养', 640],
    ['B-11', 'F2', '2026-B03', '皖西白鹅', 1120, 34, '王振宇', '在养', 720],
    ['B-12', 'F2', '—', '—', 0, 0, '赵琦', '空舍', 720],
    ['C-01', 'F3', '2026-B01', '霍尔多巴吉鹅', 830, 82, '郝天祥', '在养', 560],
    ['C-05', 'F3', '2026-B02', '朗德鹅', 990, 61, '郝天祥', '在养', 660],
    ['C-07', 'F3', '2026-B02', '朗德鹅', 1160, 61, '郭良瑞', '在养', 760],
    ['C-08', 'F3', '2026-B03', '莱茵鹅', 870, 34, '赵琦', '在养', 600],
    ['C-09', 'F3', '—', '—', 0, 0, '王振宇', '消毒中', 600]
  ];

  var DEFAULT_TH = { tempMin: 12, tempMax: 24, humMin: 55, humMax: 75, nh3Max: 15, windMin: 0.2, windMax: 2.0, co2Max: 1500 };

  /* ---------------- 初始数据 ---------------- */
  function seed() {
    var r = lcg(20260612);
    var now = new Date();

    var db = {
      version: 2,
      meta: { seededAt: tstr(now), stockYesterday: 12294 },
      settings: {
        platformName: '寒羽智瞳', platformSub: '寒区肉鹅健康管理平台',
        thresholds: JSON.parse(JSON.stringify(DEFAULT_TH)),
        notify: { popup: true, sms: false, email: true, daily: true },
        theme: 'light', accent: 'purple', sim: true, pageSize: 10
      },
      users: [
        { id: 'U1', username: 'liying', password: '123456', name: '李莹', role: '超级管理员', phone: '13800002013', status: '启用', last: tstr(now) },
        { id: 'U2', username: 'wangzhenyu', password: '123456', name: '王振宇', role: '场长', phone: '13900007742', status: '启用', last: tstr(new Date(now - 864e5)) },
        { id: 'U3', username: 'guoliangrui', password: '123456', name: '郭良瑞', role: '兽医', phone: '15000006698', status: '启用', last: tstr(new Date(now - 3 * 864e5)) },
        { id: 'U4', username: 'haotianxiang', password: '123456', name: '郝天祥', role: '饲养员', phone: '15800005566', status: '启用', last: tstr(new Date(now - 2 * 864e5)) },
        { id: 'U5', username: 'zhaoqi', password: '123456', name: '赵琦', role: '饲养员', phone: '13700008899', status: '启用', last: tstr(new Date(now - 864e5)) }
      ],
      farms: SEED_FARMS.slice(),
      houses: [], alerts: [], mortality: [], evidence: [], messages: [], env: {}, logs: [],
      cams: [], devices: []
    };

    SEED_HOUSES.forEach(function (h) {
      db.houses.push({
        id: uid('h'), code: h[0], farmId: h[1], batch: h[2], breed: h[3], stock: h[4],
        inDate: h[5] ? dstr(midnight(-h[5])) : '', keeper: h[6], status: h[7], area: h[8],
        note: h[7] === '在养' ? '正常育肥' : (h[7] === '空舍' ? '待进雏' : '空栏消毒中')
      });
    });
    var live = db.houses.filter(function (h) { return h.status === '在养'; });

    live.forEach(function (h, i) {
      var idx = db.cams.length;
      db.cams.push({
        id: 'CAM-' + pad(idx + 1),
        houseCode: h.code, zone: ZONES[i % ZONES.length],
        online: !(h.code === 'A-06' || h.code === 'C-08'),
        res: '1080P', fps: 25,
        detect: (h.code === 'A-03') ? { label: '疑似病鹅', score: '0.87' } : null,
        photo: ''
      });
    });

    db.devices = [
      { id: 'CAM-01', name: '1区球机', type: '摄像头', place: 'A-01 舍内东侧', online: true, power: 100, signal: '强', ver: 'v2.3.1', last: '2026-08-21' },
      { id: 'CAM-02', name: '3区枪机', type: '摄像头', place: 'A-03 舍内西侧', online: true, power: 100, signal: '强', ver: 'v2.3.1', last: '2026-08-21' },
      { id: 'CAM-03', name: '5区球机', type: '摄像头', place: 'A-05 料道区', online: true, power: 100, signal: '中', ver: 'v2.2.8', last: '2026-07-04' },
      { id: 'CAM-04', name: '料塔监控', type: '摄像头', place: '料塔与水线', online: false, power: 0, signal: '无', ver: 'v2.2.8', last: '2026-07-04' },
      { id: 'ENV-01', name: '温湿度传感器', type: '环境', place: 'A-01 舍内中部', online: true, power: 82, signal: '强', ver: 'v1.4.0', last: '2026-08-30' },
      { id: 'ENV-02', name: '氨气传感器', type: '环境', place: 'A-01 粪沟上方', online: true, power: 64, signal: '强', ver: 'v1.4.0', last: '2026-08-30' },
      { id: 'ENV-03', name: '硫化氢传感器', type: '环境', place: 'A-03 粪沟上方', online: true, power: 18, signal: '中', ver: 'v1.3.7', last: '2026-06-15' },
      { id: 'ENV-04', name: '二氧化碳传感器', type: '环境', place: 'A-03 舍内中部', online: true, power: 91, signal: '强', ver: 'v1.4.0', last: '2026-08-30' },
      { id: 'GW-01', name: '边缘网关', type: '网关', place: 'A-01 控制箱', online: true, power: 100, signal: '强', ver: 'v3.0.2', last: '2026-09-01' }
    ];

    /* 预警：近 30 天共 156 条，今日 7 条（3 条待处理） */
    var counts = { '温度异常': 53, '湿度异常': 41, '氨气浓度高': 28, '通风异常': 22, '其他': 12 };
    var pool = [];
    ALERT_TYPES.forEach(function (t) { for (var i = 0; i < counts[t]; i++) pool.push(t); });
    for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t0 = pool[i]; pool[i] = pool[j]; pool[j] = t0; }
    var minsToday = Math.max(30, now.getHours() * 60 + now.getMinutes());
    for (i = 0; i < 7; i++) {
      var ts = new Date(midnight(0).getTime() + ri(r, 0, minsToday) * 60000);
      db.alerts.push(mkAlert(r, pool.pop(), pick(r, live), ts, i < 3 ? '待处理' : '已处理', db.settings.thresholds));
    }
    while (pool.length) {
      var d = ri(r, 1, 29);
      ts = new Date(midnight(-d).getTime() + ri(r, 0, 1439) * 60000);
      db.alerts.push(mkAlert(r, pool.pop(), pick(r, live), ts, r() < 0.9 ? '已处理' : '已忽略', db.settings.thresholds));
    }
    db.alerts.sort(function (a, b) { return a.ts < b.ts ? 1 : -1; });

    /* 死淘：近 90 天校准到 294 只 → 累计死淘率 ≈ 2.3% */
    for (var dd = 89; dd >= 0; dd--) {
      var events = r() < 0.2 ? 0 : (r() < 0.7 ? 1 : 2);
      for (var e = 0; e < events; e++) {
        var h = pick(r, live);
        db.mortality.push({
          id: uid('m'), date: dstr(midnight(-dd)), houseCode: h.code, batch: h.batch,
          count: ri(r, 1, 4), cause: pick(r, CAUSES), disposal: pick(r, DISPOSALS),
          reporter: pick(r, STAFF), remark: ''
        });
      }
    }
    var total = db.mortality.reduce(function (s, m) { return s + m.count; }, 0), guard = 0;
    while (total < 294 && guard++ < 3000) { var m = db.mortality[Math.floor(r() * db.mortality.length)]; m.count++; total++; }
    while (total > 294 && guard++ < 6000) { m = db.mortality[Math.floor(r() * db.mortality.length)]; if (m.count > 1) { m.count--; total--; } }
    db.mortality.sort(function (a, b) { return a.date < b.date ? 1 : -1; });

    /* 存证：128 条，本月 18 条 */
    var evTs = [];
    for (i = 0; i < 18; i++) { var d2 = new Date(); d2.setDate(ri(r, 1, Math.max(1, now.getDate()))); d2.setHours(ri(r, 7, 21), ri(r, 0, 59), 0, 0); if (d2 > now) d2 = new Date(now.getTime() - i * 36e5); evTs.push(d2); }
    for (i = 0; i < 110; i++) evTs.push(new Date(now.getTime() - ri(r, 32, 250) * 864e5));
    evTs.sort(function (a, b) { return a - b; });
    evTs.forEach(function (ts, idx) {
      var h = pick(r, live), type = pick(r, ['死淘存证', '环境存证', '理赔存证']);
      db.evidence.push({
        id: uid('e'), no: 'HY-CZ-' + ts.getFullYear() + '-' + pad((idx % 100) + 1),
        ts: tstr(ts), type: type, houseCode: h.code, count: type === '环境存证' ? 0 : ri(r, 1, 12),
        policy: 'PICC-HLJ-2026-' + (1000 + ri(r, 1, 400)), hash: '0x' + hex(r, 40),
        status: r() < 0.88 ? '已上链' : '待确认', operator: pick(r, STAFF)
      });
    });
    db.evidence.sort(function (a, b) { return a.ts < b.ts ? 1 : -1; });

    db.messages = [
      { id: uid('msg'), title: '鹅舍B-11 湿度连续 30 分钟超阈值', body: '当前湿度 82%RH，阈值上限 75%。建议检查通风窗与地面积水。', ts: tstr(new Date(now - 26 * 60000)), read: false, kind: 'warn' },
      { id: uid('msg'), title: '6 月理赔资料已提交', body: '本月死淘存证 18 条已打包提交至保险公司，等待核赔结果。', ts: tstr(new Date(now - 5 * 36e5)), read: false, kind: 'info' },
      { id: uid('msg'), title: '传感器 C-07-VT 电量偏低', body: '通风传感器电量 18%，请在 3 日内更换电池。', ts: tstr(new Date(now - 22 * 36e5)), read: false, kind: 'warn' },
      { id: uid('msg'), title: '5 月运营月报已生成', body: '可在「数据报表」中选择上月区间导出完整月报。', ts: tstr(new Date(now - 6 * 864e5)), read: true, kind: 'info' },
      { id: uid('msg'), title: '平台升级至 v1.0.0', body: '新增视频监控与设备管理模块。', ts: tstr(new Date(now - 12 * 864e5)), read: true, kind: 'info' }
    ];

    live.forEach(function (h) {
      var base = { temp: rf(r, 14, 22, 1), hum: rf(r, 58, 72, 0), nh3: rf(r, 4, 13, 1), wind: rf(r, 0.3, 1.6, 2), co2: ri(r, 700, 1300) };
      base.power = ri(r, 35, 100); base.ts = tstr(now);
      base.hist = []; for (var k = 0; k < 24; k++) base.hist.push(rf(r, base.temp - 2.5, base.temp + 2.5, 1));
      db.env[h.code] = base;
    });

    var stockNow = db.houses.reduce(function (s, h) { return s + (h.status === '在养' ? h.stock : 0); }, 0);
    db.meta.openingStock = stockNow + total;

    db.logs = [{ id: uid('log'), ts: tstr(now), user: 'system', action: '初始化系统数据', detail: '生成 ' + db.houses.length + ' 栋鹅舍 / ' + db.cams.length + ' 路监控 / ' + db.devices.length + ' 台设备' }];
    return db;
  }

  function mkAlert(r, type, house, ts, status, th) {
    var v, unit, thr, lvl = '中', detail = '';
    if (type === '温度异常') {
      if (r() < 0.65) { v = rf(r, th.tempMin - 8, th.tempMin - 0.5, 1); detail = '舍温低于下限，注意保温与热风机运行'; }
      else { v = rf(r, th.tempMax + 0.5, th.tempMax + 6, 1); detail = '舍温高于上限，注意加大通风'; }
      unit = '℃'; thr = th.tempMin + '~' + th.tempMax + '℃';
      lvl = (v < th.tempMin - 4 || v > th.tempMax + 4) ? '高' : '中';
    } else if (type === '湿度异常') {
      v = rf(r, th.humMax + 1, th.humMax + 18, 0); unit = '%RH'; thr = '≤' + th.humMax + '%RH';
      detail = '湿度偏高易诱发呼吸道疾病，建议除湿并更换垫料'; lvl = v > th.humMax + 10 ? '高' : '中';
    } else if (type === '氨气浓度高') {
      v = rf(r, th.nh3Max + 1, th.nh3Max + 14, 1); unit = 'ppm'; thr = '≤' + th.nh3Max + 'ppm';
      detail = '氨气刺激呼吸道，建议清粪并提高换气量'; lvl = v > th.nh3Max + 8 ? '高' : '中';
    } else if (type === '通风异常') {
      v = rf(r, 0.02, th.windMin - 0.02, 2); unit = 'm/s'; thr = '≥' + th.windMin + 'm/s';
      detail = '风速低于下限，疑似风机故障或风道堵塞'; lvl = '高';
    } else {
      v = 0; unit = ''; thr = '—'; lvl = '低';
      detail = pick(r, ['水线压力异常，请检查供水', '光照时长不足，请核对光控程序', '传感器离线 12 分钟后已恢复', '饲喂线电流异常']);
    }
    var a = {
      id: uid('a'), ts: tstr(ts), houseCode: house.code, farmId: house.farmId, type: type, level: lvl,
      value: v, unit: unit, threshold: thr, count: ri(r, 1, 14), status: status,
      detail: detail, handler: '', handledAt: '', remark: ''
    };
    if (status === '已处理') {
      a.handler = pick(r, STAFF); a.remark = pick(r, ['已调整通风参数', '已开启热风机并补充垫料', '已清粪并加大换气', '已更换故障风机皮带', '现场巡查后恢复正常']);
      a.handledAt = tstr(new Date(ts.getTime() + ri(r, 8, 90) * 60000));
    } else if (status === '已忽略') { a.handler = pick(r, STAFF); a.remark = '短时波动，无需处理'; a.handledAt = tstr(new Date(ts.getTime() + 20 * 60000)); }
    return a;
  }

  /* ---------------- 读写 ---------------- */
  function load() {
    if (_db) return _db;
    try {
      var raw = localStorage.getItem(DB_KEY);
      if (raw) { var o = JSON.parse(raw); if (o && (o.version === 2 || (o.houses && o.users))) { _db = o; if (!_db.meta.openingStock) _db.meta.openingStock = _db.meta.openingStock || 0; return _db; } }
    } catch (e) { /* 损坏则重建 */ }
    _db = seed(); save();
    return _db;
  }
  function save() {
    try { localStorage.setItem(DB_KEY, JSON.stringify(_db)); }
    catch (e) { console.warn('本地存储写入失败', e); }
    return _db;
  }
  function commit(scope) { save(); emit('change', scope || ''); }
  function on(evt, fn) { (bus[evt] = bus[evt] || []).push(fn); return function () { off(evt, fn); }; }
  function off(evt, fn) { bus[evt] = (bus[evt] || []).filter(function (f) { return f !== fn; }); }
  function emit(evt, data) { (bus[evt] || []).forEach(function (f) { try { f(data); } catch (e) { console.error(e); } }); }

  /* ---------------- 会话 ---------------- */
  function session() {
    try {
      var raw = sessionStorage.getItem(SS_KEY) || localStorage.getItem(SS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function writeSession(s, remember) {
    var raw = JSON.stringify(s);
    (remember ? localStorage : sessionStorage).setItem(SS_KEY, raw);
    if (!remember) localStorage.removeItem(SS_KEY);
  }
  function login(username, password, remember) {
    var db = load();
    var u = db.users.filter(function (x) { return x.username === String(username || '').trim().toLowerCase(); })[0];
    if (!u || u.password !== password) return { ok: false, msg: '账号或密码不正确' };
    if (u.status !== '启用') return { ok: false, msg: '账号状态异常，请联系场区管理员' };
    u.last = tstr(new Date());
    var s = { uid: u.id, username: u.username, name: u.name, role: u.role, guest: false, at: tstr(new Date()) };
    writeSession(s, !!remember); log('登录系统', u.username); commit('login');
    return { ok: true, session: s };
  }
  function logout() { sessionStorage.removeItem(SS_KEY); localStorage.removeItem(SS_KEY); }
  function log(action, detail) {
    var db = load(), s = session();
    db.logs.unshift({ id: uid('log'), ts: tstr(new Date()), user: s ? s.username : 'system', action: action, detail: detail || '' });
    if (db.logs.length > 200) db.logs.length = 200;
    save();
  }

  /* ---------------- 统计与查询 ---------------- */
  function currentStock(db) { return (db || load()).houses.reduce(function (s, h) { return s + (+h.stock || 0); }, 0); }
  function houseByCode(code) { return load().houses.filter(function (h) { return h.code === code; })[0]; }
  function farmName(id) { var f = load().farms.filter(function (x) { return x.id === id; })[0]; return f ? f.name : '—'; }
  function ageOf(h) { return h.inDate ? Math.max(0, Math.round((Date.now() - pdate(h.inDate)) / 864e5)) : 0; }

  function deathTrend(days) {
    var db = load(), start = midnight(-(days - 1)).getTime(), end = midnight(0).getTime();
    var byDay = {}, before = 0, total = 0;
    db.mortality.forEach(function (m) {
      var t = pdate(m.date).getTime(); total += +m.count || 0;
      if (t < start) before += +m.count || 0;
      else if (t <= end) byDay[m.date] = (byDay[m.date] || 0) + (+m.count || 0);
    });
    var initial = currentStock(db) + total || 1, acc = before;
    var labels = [], daily = [], cum = [];
    for (var i = 0; i < days; i++) {
      var key = dstr(midnight(-(days - 1 - i))), c = byDay[key] || 0;
      acc += c; labels.push(key.slice(5)); daily.push(c);
      cum.push(Math.round(acc / initial * 1e5) / 1e3);
    }
    return { labels: labels, daily: daily, cum: cum, initial: initial, total: total };
  }
  function alertTypeShare(days, filterFn) {
    var db = load(), start = midnight(-(days - 1)).getTime(), map = {};
    ALERT_TYPES.forEach(function (t) { map[t] = 0; });
    db.alerts.forEach(function (a) {
      if (pdate(a.ts).getTime() < start) return;
      if (filterFn && !filterFn(a)) return;
      map[a.type]++;
    });
    var items = Object.keys(map).filter(function (k) { return map[k] > 0; })
      .map(function (k) { return { name: k, value: map[k], color: TYPE_COLORS[k] || '#94a3b8' }; });
    return { items: items, total: items.reduce(function (s, i) { return s + i.value; }, 0) };
  }
  function camStats() {
    var db = load(), cams = db.cams || [];
    return { total: cams.length, on: cams.filter(function (c) { return c.online; }).length, off: cams.filter(function (c) { return !c.online; }).length, ai: cams.filter(function (c) { return c.detect; }).length };
  }
  function devStats() {
    var db = load(), ds = db.devices || [];
    return { total: ds.length, on: ds.filter(function (x) { return x.online; }).length, off: ds.filter(function (x) { return !x.online; }).length, low: ds.filter(function (x) { return x.online && x.power < 25; }).length };
  }
  function listCams() {
    var db = load();
    return (db.cams || []).map(function (c) {
      var h = houseByCode(c.houseCode) || {};
      return { id: c.id, houseCode: c.houseCode, zone: c.zone, online: c.online, res: c.res, fps: c.fps, detect: c.detect, photo: c.photo, farmId: h.farmId, batch: h.batch || '', keeper: h.keeper || '', breed: h.breed || '' };
    });
  }
  function setCam(id, on) {
    var db = load();
    (db.cams || []).forEach(function (c) { if (c.id === id) c.online = on; });
    log('切换监控通道', id); commit('cams');
  }
  function listDevices() { return (load().devices || []).slice(); }
  function setDev(id, on) {
    var db = load();
    (db.devices || []).forEach(function (x) { if (x.id === id) x.online = on; });
    log('切换设备状态', id); commit('devices');
  }
  function kpiCore() {
    var db = load(), today = dstr(new Date()), month = today.slice(0, 7);
    var tr = deathTrend(30);
    return {
      stock: currentStock(db),
      stockDiff: currentStock(db) - (db.meta.stockYesterday || 0),
      todayAlert: db.alerts.filter(function (a) { return a.ts.slice(0, 10) === today; }).length,
      pending: db.alerts.filter(function (a) { return a.status === '待处理'; }).length,
      deathRate: tr.cum[tr.cum.length - 1] || 0,
      deathRate7: Math.round(((tr.cum[29] || 0) - (tr.cum[22] || 0)) * 100) / 100,
      deathTotal: tr.total,
      evidence: db.evidence.length,
      evidenceMonth: db.evidence.filter(function (e) { return e.ts.slice(0, 7) === month; }).length,
      unread: db.messages.filter(function (m) { return !m.read; }).length,
      liveHouses: db.houses.filter(function (h) { return h.status === '在养'; }).length,
      monthDeath: db.mortality.filter(function (m) { return m.date.slice(0, 7) === month; }).reduce(function (s, m) { return s + m.count; }, 0)
    };
  }
  function kpi() {
    var k = kpiCore(), c = camStats(), dv = devStats();
    k.cum = k.deathRate; k.deaths = k.deathTotal; k.ev = k.evidence;
    k.activeHouses = k.liveHouses; k.evMonth = k.evidenceMonth; k.cum7 = k.deathRate7;
    k.camOn = c.on; k.camTotal = c.total; k.camAi = c.ai;
    k.devOn = dv.on; k.devTotal = dv.total; k.devOff = dv.off; k.devLow = dv.low;
    return k;
  }

  /* ---------------- 写操作 ---------------- */
  function saveHouse(data) {
    var db = load();
    if (data.id) {
      db.houses = db.houses.map(function (h) { return h.id === data.id ? Object.assign(h, data) : h; });
      log('编辑鹅舍', data.code);
    } else {
      data.id = uid('h'); db.houses.push(data);
      if (data.status === '在养' && !db.env[data.code]) {
        db.env[data.code] = { temp: 18, hum: 65, nh3: 8, wind: 0.8, co2: 900, power: 100, ts: tstr(new Date()), hist: new Array(24).fill(18) };
      }
      log('新增鹅舍', data.code);
    }
    commit('houses'); return data;
  }
  function removeHouse(id) {
    var db = load(), h = db.houses.filter(function (x) { return x.id === id; })[0];
    db.houses = db.houses.filter(function (x) { return x.id !== id; });
    if (h) { delete db.env[h.code]; log('删除鹅舍', h.code); }
    commit('houses');
  }
  function saveFarm(data) {
    var db = load();
    if (data.id) { db.farms = db.farms.map(function (f) { return f.id === data.id ? Object.assign(f, data) : f; }); log('编辑鹅场', data.name); }
    else { data.id = 'F' + (Date.now() % 100000); db.farms.push(data); log('新增鹅场', data.name); }
    commit('farms'); return data;
  }
  function removeFarm(id) {
    var db = load();
    if (db.houses.some(function (h) { return h.farmId === id; })) return { ok: false, msg: '该鹅场下仍有鹅舍，请先移除鹅舍' };
    db.farms = db.farms.filter(function (f) { return f.id !== id; });
    log('删除鹅场', id); commit('farms'); return { ok: true };
  }
  function addAlert(a) {
    var db = load();
    var full = Object.assign({ id: uid('a'), ts: tstr(new Date()), status: '待处理', level: '中', count: 1, detail: '', handler: '', handledAt: '', remark: '', unit: '', threshold: '—' }, a);
    db.alerts.unshift(full);
    db.messages.unshift({ id: uid('msg'), title: '鹅舍' + full.houseCode + ' ' + full.type, body: '实测 ' + full.value + full.unit + '，阈值 ' + full.threshold + '。' + (full.detail || ''), ts: full.ts, read: false, kind: 'warn' });
    if (db.messages.length > 60) db.messages.length = 60;
    commit('alerts'); return full;
  }
  function setAlertStatus(ids, status, remark) {
    var db = load(), s = session(), n = 0;
    db.alerts.forEach(function (a) {
      if (ids.indexOf(a.id) < 0) return;
      a.status = status; a.handler = s ? s.name : '系统';
      a.handledAt = tstr(new Date()); if (remark) a.remark = remark; n++;
    });
    log('更新预警状态', n + ' 条'); commit('alerts'); return n;
  }
  function saveMortality(m) {
    var db = load(), h = houseByCode(m.houseCode);
    if (m.id) {
      var old = db.mortality.filter(function (x) { return x.id === m.id; })[0];
      if (old) {
        var oh = houseByCode(old.houseCode);
        if (oh) oh.stock += old.count;
        if (h && m.count > h.stock) { if (oh) oh.stock -= old.count; return { ok: false, msg: '数量超过该鹅舍在栏数' }; }
        if (h) h.stock -= m.count;
        Object.assign(old, m);
      }
    } else {
      if (!h) return { ok: false, msg: '鹅舍不存在' };
      if (m.count > h.stock) return { ok: false, msg: '数量超过该鹅舍在栏数（' + h.stock + ' 只）' };
      h.stock -= m.count; m.id = uid('m'); db.mortality.unshift(m);
    }
    db.mortality.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    log('保存死淘记录', m.houseCode + ' ' + m.count + ' 只');
    commit('mortality'); return { ok: true };
  }
  function removeMortality(id) {
    var db = load();
    var m = db.mortality.filter(function (x) { return x.id === id; })[0];
    if (m) { var h = houseByCode(m.houseCode); if (h) h.stock += m.count; }
    db.mortality = db.mortality.filter(function (x) { return x.id !== id; });
    log('删除死淘记录', id); commit('mortality');
  }
  function saveEvidence(e) {
    var db = load();
    if (e.id) { db.evidence = db.evidence.map(function (x) { return x.id === e.id ? Object.assign(x, e) : x; }); log('编辑存证', e.no); }
    else {
      e.id = uid('e');
      e.no = e.no || ('HY-CZ-' + new Date().getFullYear() + '-' + pad((db.evidence.length % 100) + 1));
      e.hash = e.hash || hashOf(e.ts + e.type + e.houseCode + Math.random());
      e.status = e.status || '待确认';
      db.evidence.unshift(e); log('新增存证', e.no);
    }
    commit('evidence'); return e;
  }
  function removeEvidence(id) { var db = load(); db.evidence = db.evidence.filter(function (x) { return x.id !== id; }); log('删除存证', id); commit('evidence'); }
  function confirmEvidence(id) {
    var db = load();
    db.evidence.forEach(function (e) { if (e.id === id) e.status = '已上链'; });
    log('确认存证上链', id); commit('evidence');
  }
  function saveUser(u) {
    var db = load();
    if (u.id) { db.users = db.users.map(function (x) { return x.id === u.id ? Object.assign(x, u) : x; }); log('编辑用户', u.username); }
    else {
      if (db.users.some(function (x) { return x.username === u.username; })) return { ok: false, msg: '账号已存在' };
      u.id = uid('u'); u.last = '—'; db.users.push(u); log('新增用户', u.username);
    }
    commit('users'); return { ok: true, user: u };
  }
  function removeUser(id) { var db = load(); db.users = db.users.filter(function (x) { return x.id !== id; }); log('删除用户', id); commit('users'); }
  function markMessage(id, read) {
    var db = load();
    db.messages.forEach(function (m) { if (!id || m.id === id) m.read = read !== false; });
    commit('messages');
  }
  function addMsg(title, body) {
    var db = load();
    db.messages.unshift({ id: uid('msg'), title: title, body: body || '', ts: tstr(new Date()), read: false, kind: 'info' });
    save(); commit('messages');
  }
  function saveSettings(patch) {
    var db = load(); Object.assign(db.settings, patch); log('修改系统设置', Object.keys(patch).join(',')); commit('settings');
  }
  function resetThresholds() { var db = load(); db.settings.thresholds = JSON.parse(JSON.stringify(DEFAULT_TH)); log('恢复默认阈值', ''); commit('settings'); }

  /* 环境巡检（接入后端后由真实上报替代） */
  function stepEnv() {
    var db = load(), th = db.settings.thresholds, breaches = [];
    Object.keys(db.env).forEach(function (code) {
      var e = db.env[code];
      e.temp = Math.round(Math.max(-4, Math.min(34, e.temp + (Math.random() - 0.5) * 1.1)) * 10) / 10;
      e.hum = Math.round(Math.max(35, Math.min(96, e.hum + (Math.random() - 0.5) * 3)));
      e.nh3 = Math.round(Math.max(1, Math.min(32, e.nh3 + (Math.random() - 0.5) * 1.6)) * 10) / 10;
      e.wind = Math.round(Math.max(0.02, Math.min(3.2, e.wind + (Math.random() - 0.5) * 0.24)) * 100) / 100;
      e.co2 = Math.round(Math.max(500, Math.min(2600, e.co2 + (Math.random() - 0.5) * 130)));
      e.ts = tstr(new Date());
      e.hist.push(e.temp); if (e.hist.length > 24) e.hist.shift();
      if (e.temp < th.tempMin || e.temp > th.tempMax) breaches.push({ id: uid('a'), houseCode: code, type: '温度异常', value: e.temp, unit: '℃', threshold: th.tempMin + '~' + th.tempMax + '℃', level: '高' });
      if (e.hum > th.humMax) breaches.push({ id: uid('a'), houseCode: code, type: '湿度异常', value: e.hum, unit: '%RH', threshold: '≤' + th.humMax + '%RH', level: '中' });
      if (e.nh3 > th.nh3Max) breaches.push({ id: uid('a'), houseCode: code, type: '氨气浓度高', value: e.nh3, unit: 'ppm', threshold: '≤' + th.nh3Max + 'ppm', level: '中' });
      if (e.wind < th.windMin) breaches.push({ id: uid('a'), houseCode: code, type: '通风异常', value: e.wind, unit: 'm/s', threshold: '≥' + th.windMin + 'm/s', level: '高' });
    });
    save(); emit('env', db.env);
    return breaches;
  }
  function envState(code, key, val) {
    var th = load().settings.thresholds;
    if (key === 'temp') return val < th.tempMin || val > th.tempMax ? 'bad' : (val < th.tempMin + 1.5 || val > th.tempMax - 1.5 ? 'warn' : '');
    if (key === 'hum') return val > th.humMax || val < th.humMin ? 'bad' : (val > th.humMax - 3 ? 'warn' : '');
    if (key === 'nh3') return val > th.nh3Max ? 'bad' : (val > th.nh3Max - 3 ? 'warn' : '');
    if (key === 'wind') return val < th.windMin || val > th.windMax ? 'bad' : '';
    if (key === 'co2') return val > th.co2Max ? 'bad' : '';
    return '';
  }

  /* ---------------- 导入导出 ---------------- */
  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 200);
  }
  function exportCsv(filename, headers, rows) {
    var esc = function (v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var csv = '\uFEFF' + headers.join(',') + '\n' + rows.map(function (r) { return r.map(esc).join(','); }).join('\n');
    download(filename, csv, 'text/csv;charset=utf-8');
    log('导出数据', filename);
  }
  function exportJson() { download('hanyu-backup-' + dstr(new Date()) + '.json', JSON.stringify(load(), null, 2), 'application/json'); }
  function exportAll() { return JSON.stringify(load(), null, 2); }
  function importJson(text) {
    try {
      var o = JSON.parse(text);
      if (!o || !o.houses || !o.settings) return { ok: false, msg: '文件格式不正确' };
      o.version = 2; _db = o; save(); emit('change', 'import');
      return { ok: true };
    } catch (e) { return { ok: false, msg: 'JSON 解析失败：' + e.message }; }
  }
  function importAll(text) { return importJson(text); }
  function usage() { try { return (JSON.stringify(load()).length / 1024).toFixed(1) + ' KB'; } catch (e) { return '-'; } }
  function reset() { localStorage.removeItem(DB_KEY); _db = null; load(); emit('change', 'reset'); }

  /* ---------------- 老版兼容接口 ---------------- */
  function farm(id) { var f = load().farms.filter(function (x) { return x.id === id; })[0]; return f || { name: '—', region: '', manager: '', phone: '', address: '' }; }
  function house(code) { return houseByCode(code); }
  function activeCodes() { return load().houses.filter(function (h) { return h.status === '在养'; }).map(function (h) { return h.code; }); }
  function unread() { return load().messages.filter(function (m) { return !m.read; }).length; }
  function pending() { return load().alerts.filter(function (a) { return a.status === '待处理'; }).length; }
  function trend(days, filterHouse) {
    var db = load();
    var start = midnight(-(days - 1)).getTime();
    var labels = [], byDay = {}, before = 0, i;
    for (i = 0; i < days; i++) { var k = dstr(midnight(-(days - 1 - i))); labels.push(k); byDay[k] = 0; }
    var totalAll = db.mortality.reduce(function (s, m) { return s + m.count; }, 0);
    db.mortality.forEach(function (m) {
      if (filterHouse && m.houseCode !== filterHouse) return;
      if (byDay[m.date] !== undefined) byDay[m.date] += m.count;
      else if (pdate(m.date).getTime() < start) before += m.count;
    });
    var daily = labels.map(function (k) { return byDay[k]; });
    var initial = currentStock(db) + totalAll || 1, acc = before;
    var cum = daily.map(function (v) { acc += v; return Math.round(acc / initial * 10000) / 100; });
    return { labels: labels, daily: daily, cum: cum };
  }
  function share(days, farmId) {
    return alertTypeShare(days, function (a) {
      if (!farmId) return true;
      var h = houseByCode(a.houseCode);
      return h && h.farmId === farmId;
    }).items;
  }
  function tick() { return stepEnv(); }
  function guest() { return { ok: false, msg: '请使用场区账号登录' }; }
  function loginGuest() { return guest(); }
  function sessionGet() { return session(); }

  /* ---------------- 最终导出（新旧 API 合并） ---------------- */
  global.HY = global.HY || {};
  global.HY.store = {
    DICT: { ALERT_TYPES: ALERT_TYPES, TYPE_COLORS: TYPE_COLORS, CAUSES: CAUSES, DISPOSALS: DISPOSALS, BREEDS: BREEDS, HOUSE_STATUS: HOUSE_STATUS, ROLES: ROLES },
    util: { dstr: dstr, tstr: tstr, pdate: pdate, pad: pad, day: day, midnight: midnight, uid: uid, num: num, p2: pad },
    fmt: { dstr: dstr, tstr: tstr, day: day, num: num, uid: uid, p2: pad, hash: hashOf },
    db: load, save: save, commit: commit, reset: reset, on: on, off: off, emit: emit,
    log: log, session: session, sessionGet: sessionGet,
    login: login, logout: logout, guest: guest, loginGuest: loginGuest,

    houses: function () { return load().houses.slice(); },
    farms: function () { return load().farms.slice(); },
    farm: farm, house: house, houseByCode: houseByCode, farmName: farmName, ageOf: ageOf,
    activeCodes: activeCodes, unread: unread, pending: pending,
    currentStock: currentStock,

    kpi: kpi, deathTrend: deathTrend, alertTypeShare: alertTypeShare,
    trend: trend, share: share, tick: tick,

    saveHouse: saveHouse, delHouse: removeHouse, removeHouse: removeHouse,
    saveFarm: saveFarm, delFarm: removeFarm, removeFarm: removeFarm,
    addAlert: addAlert, setAlertStatus: setAlertStatus, handleAlert: setAlertStatus,
    saveMortality: saveMortality, saveMort: saveMortality, removeMortality: removeMortality, delMort: removeMortality,
    saveEvidence: saveEvidence, addEv: saveEvidence, removeEvidence: removeEvidence, delEv: removeEvidence,
    confirmEv: confirmEvidence, confirmEvidence: confirmEvidence,
    saveUser: saveUser, delUser: removeUser, removeUser: removeUser,
    markMessage: markMessage, readMsg: function (id) { markMessage(id, true); }, addMsg: addMsg,
    saveSettings: saveSettings, resetThresholds: resetThresholds, DEFAULT_TH: DEFAULT_TH,
    stepEnv: stepEnv, envState: envState,
    cams: listCams, camStats: camStats, setCam: setCam,
    devices: listDevices, devStats: devStats, setDev: setDev,
    exportCsv: exportCsv, exportJson: exportJson, importJson: importJson,
    exportAll: exportAll, importAll: importAll, usage: usage, download: download
  };
})(window);
