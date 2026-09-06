/* =====================================================================
 * 寒羽智瞳 · 控制台（最终版，与 store.js v2 配套）
 * 页面：总览 / 视频监控 / 鹅场管理 / 监测预警 / 死淘记录 / 保险存证
 *       / 设备管理 / 数据报表 / 系统设置
 * ===================================================================*/
(function (global) {
  'use strict';

  var S = HY.store, U = HY.ui, C = HY.charts;
  var D = S.DICT;
  var F = S.fmt;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var esc = U.esc, icon = U.icon;

  /* ---------------- 登录守卫 ---------------- */
  var me = S.session();
  if (!me) { location.replace('index.html?need=1'); return; }

  var ROLE_ORDER = ['超级管理员', '场长', '兽医', '饲养员'];
  function may(role) { return me.role === role; }
  function guardAdmin() {
    if (me.role === '超级管理员') return true;
    U.toast('该操作仅超级管理员可用', 'warn');
    return false;
  }

  var NAV = [
    { key: 'overview', name: '总览', ico: 'home' },
    { key: 'monitor', name: '视频监控', ico: 'cam' },
    { key: 'farms', name: '鹅场管理', ico: 'building' },
    { key: 'alerts', name: '监测预警', ico: 'radar', badge: function () { return S.db().alerts.filter(function (a) { return a.status === '待处理'; }).length; } },
    { key: 'mortality', name: '死淘记录', ico: 'clipboard' },
    { key: 'evidence', name: '保险存证', ico: 'shield' },
    { key: 'devices', name: '设备管理', ico: 'cpu' },
    { key: 'reports', name: '数据报表', ico: 'chart' },
    { key: 'settings', name: '系统设置', ico: 'gear' }
  ];

  var ACCENTS = [['#7a5af8', '#a78bfa'], ['#2e90fa', '#7cc4fd'], ['#12b76a', '#6ce9a6'], ['#f79009', '#fdb022'], ['#f04438', '#fda29b']];

  var st = {
    page: 'overview',
    trendDays: 30, shareDays: 30,
    farms: { tab: 'houses', q: '', farm: '', status: '', page: 1 },
    al: { q: '', type: '', status: '', house: '', page: 1, sel: {} },
    mo: { q: '', house: '', cause: '', page: 1 },
    ev: { q: '', type: '', status: '', page: 1 },
    mon: { farm: '', status: '全部' },
    dev: { type: '', status: '全部' },
    rep: { from: F.dstr(F.day(-29)), to: F.dstr(new Date()), farm: '' },
    set: { tab: 'th' }
  };

  /* ================= 通用小件 ================= */
  function kpiCard(o) {
    return '<button class="kpi" data-go="' + o.go + '">' +
      '<span class="kpi-ico">' + icon(o.ico) + '</span>' +
      '<span class="kpi-b"><span>' + o.label + '</span>' +
      '<span class="kpi-v">' + o.val + (o.unit ? '<small>' + o.unit + '</small>' : '') + '</span>' +
      '<span class="kpi-s">' + (o.sub || '') + '</span></span></button>';
  }
  var ST_COLORS = {
    '待处理': ['#f04438', '#feecea'], '已处理': ['#12b76a', '#e7f8ef'], '已忽略': ['#918fad', '#f1f0f7'],
    '在养': ['#12b76a', '#e7f8ef'], '空舍': ['#918fad', '#f1f0f7'], '消毒中': ['#f79009', '#fdf3e3'],
    '已上链': ['#12b76a', '#e7f8ef'], '待确认': ['#f79009', '#fdf3e3'],
    '启用': ['#12b76a', '#e7f8ef'], '禁用': ['#918fad', '#f1f0f7']
  };
  function stBadge(s) {
    var c = ST_COLORS[s] || ['#2e90fa', '#e9f2ff'];
    return '<span class="badge" style="background:' + c[1] + ';color:' + c[0] + '">' + esc(s) + '</span>';
  }
  function typeTag(t) {
    var c = D.TYPE_COLORS[t] || '#7a5af8';
    return '<span class="badge" style="background:' + c + '1f;color:' + c + '">' + esc(t) + '</span>';
  }
  function unitOf(t) {
    return t === '温度异常' ? '℃' : t === '湿度异常' ? '%RH' : t === '氨气浓度高' ? 'ppm' : t === '通风异常' ? 'm/s' : '';
  }
  function houseOptions(all) {
    var os = [{ value: '', text: all || '全部鹅舍' }];
    S.houses().forEach(function (h) { os.push({ value: h.code, text: '鹅舍' + h.code }); });
    return os;
  }
  function farmOptions(all) {
    var os = [{ value: '', text: all || '全部鹅场' }];
    S.farms().forEach(function (f) { os.push({ value: f.id, text: f.name }); });
    return os;
  }
  function badgesOf(role) {
    return '<i class="badge" style="background:#f0ebff;color:#6d3ce0">' + esc(role) + '</i>';
  }
  function alertDrawer(a) {
    var h = S.houseByCode(a.houseCode) || {};
    U.drawer({
      title: '预警详情 · 鹅舍' + a.houseCode,
      rows: [
        ['预警时间', a.ts], ['所属鹅舍', '鹅舍' + a.houseCode + '（' + esc(S.farmName(h.farmId)) + '）'],
        ['异常类型', typeTag(a.type), 1], ['实测值', a.value + unitOf(a.type)],
        ['预警级别', a.level + ' 级'], ['影响数量', a.count + ' 只'],
        ['当前状态', stBadge(a.status), 1], ['处理人', a.handler || '—'],
        ['处理时间', a.handledAt || '—'], ['处理备注', a.remark || '—']
      ],
      actions: a.status === '待处理' ? [
        { text: '忽略', kind: 'danger', onClick: function (api) {
            S.setAlertStatus([a.id], '已忽略', '经核实为短时波动');
            api.close(); U.toast('已忽略该预警', 'ok');
          } },
        { text: '标记已处理', primary: true, onClick: function (api) { api.close(); handleModal([a.id]); } }
      ] : [
        { text: '生成保险存证', onClick: function (api) {
            if (a.type === '环境存证' || a.type === '死淘存证') { }
            S.saveEvidence({ type: '环境存证', houseCode: a.houseCode, count: a.count, policy: 'PICC-HLJ-2026-3000' });
            api.close(); U.toast('已生成存证，可在「保险存证」查看', 'ok');
          } },
        { text: '关闭', primary: true }
      ]
    });
  }
  function handleModal(ids) {
    var fs = [
      { name: 'remark', label: '处理措施', type: 'textarea', required: true, col2: true, placeholder: '例如：已开启热风炉，加铺垫料，2 小时后复测' },
      { name: 'handler', label: '处理人', value: me.name, required: true, col2: true }
    ];
    U.modal({
      title: '处理预警（' + ids.length + ' 条）', body: U.formHtml(fs, true),
      actions: [{ text: '取消' }, { text: '确认处理', primary: true, onClick: function (api) {
          var v = U.formCheck(api.body, fs); if (!v) return;
          S.setAlertStatus(ids, '已处理', v.remark, v.handler);
          st.al.sel = {}; api.close(); U.toast('已处理 ' + ids.length + ' 条预警', 'ok');
        } }]
    });
  }

  /* ================= 弹窗：录入表单 ================= */
  function houseModal(h) {
    var edit = !!h; h = h || { status: '在养' };
    var fs = [
      { name: 'code', label: '鹅舍编号', required: true, value: h.code, rule: { re: /^[A-Za-z]-?\d{1,3}$/, msg: '格式如 A-10' } },
      { name: 'farmId', label: '所属鹅场', type: 'select', value: h.farmId || S.farms()[0].id, options: S.farms().map(function (f) { return { value: f.id, text: f.name }; }) },
      { name: 'batch', label: '批次号', required: true, value: h.batch },
      { name: 'breed', label: '品种', type: 'select', value: h.breed || D.BREEDS[0], options: D.BREEDS },
      { name: 'stock', label: '在栏数量（只）', type: 'number', required: true, min: 0, max: 20000, value: h.stock == null ? '' : h.stock },
      { name: 'area', label: '舍内面积（㎡）', type: 'number', min: 0, max: 5000, value: h.area || 400 },
      { name: 'inDate', label: '入栏日期', type: 'date', value: h.inDate || F.dstr(new Date()) },
      { name: 'keeper', label: '饲养员', required: true, value: h.keeper },
      { name: 'status', label: '状态', type: 'select', value: h.status, options: D.HOUSE_STATUS }
    ];
    U.modal({
      title: edit ? '编辑鹅舍 ' + h.code : '新增鹅舍', size: 'lg', body: U.formHtml(fs, true),
      actions: [{ text: '取消' }, { text: '保存', primary: true, onClick: function (api) {
          var v = U.formCheck(api.body, fs); if (!v) return;
          v.code = v.code.toUpperCase();
          var dup = S.houses().filter(function (x) { return x.code === v.code && x.id !== h.id; });
          if (dup.length) { U.toast('鹅舍编号已存在', 'err'); return; }
          if (v.status !== '在养') v.stock = 0;
          S.saveHouse(Object.assign({ id: h.id }, v));
          api.close(); U.toast(edit ? '已保存' : '鹅舍已创建', 'ok');
        } }]
    });
  }
  function farmModal(f) {
    var edit = !!f; f = f || {};
    var fs = [
      { name: 'name', label: '鹅场名称', required: true, value: f.name, col2: true },
      { name: 'region', label: '所在区域', required: true, value: f.region, placeholder: '省 · 市 · 区县', col2: true },
      { name: 'manager', label: '负责人', required: true, value: f.manager },
      { name: 'phone', label: '联系电话', required: true, value: f.phone },
      { name: 'address', label: '详细地址', value: f.address, col2: true }
    ];
    U.modal({
      title: edit ? '编辑鹅场' : '新增鹅场', body: U.formHtml(fs, true),
      actions: [{ text: '取消' }, { text: '保存', primary: true, onClick: function (api) {
          var v = U.formCheck(api.body, fs); if (!v) return;
          S.saveFarm(Object.assign({ id: f.id }, v));
          api.close(); U.toast('已保存', 'ok');
        } }]
    });
  }
  function mortModal(m, presetHouse) {
    var edit = !!m; m = m || {};
    var liveCodes = S.houses().filter(function (h) { return h.status === '在养'; }).map(function (h) { return h.code; });
    var fs = [
      { name: 'date', label: '发生日期', type: 'date', required: true, value: m.date || F.dstr(new Date()) },
      { name: 'houseCode', label: '鹅舍', type: 'select', value: m.houseCode || presetHouse || liveCodes[0], options: liveCodes.map(function (c) { return { value: c, text: '鹅舍' + c }; }) },
      { name: 'count', label: '死淘数量（只）', type: 'number', required: true, min: 1, max: 2000, value: m.count || 1 },
      { name: 'cause', label: '死淘原因', type: 'select', value: m.cause || D.CAUSES[0], options: D.CAUSES },
      { name: 'disposal', label: '处置方式', type: 'select', value: m.disposal || D.DISPOSALS[0], options: D.DISPOSALS },
      { name: 'reporter', label: '上报人', required: true, value: m.reporter || me.name },
      { name: 'remark', label: '备注', type: 'textarea', value: m.remark, col2: true, placeholder: '症状、发现时间、已采取措施等' }
    ];
    U.modal({
      title: edit ? '编辑死淘记录' : '登记死淘', size: 'lg', body: U.formHtml(fs, true) + '<p class="mini-note">保存后自动扣减该鹅舍在栏数量并重算死淘率。</p>',
      actions: [{ text: '取消' }, { text: '保存', primary: true, onClick: function (api) {
          var v = U.formCheck(api.body, fs); if (!v) return;
          var r = S.saveMortality(Object.assign({ id: m.id }, v));
          if (!r.ok) { U.toast(r.msg, 'err'); return; }
          api.close(); U.toast(edit ? '记录已更新' : '已登记，在栏数量已扣减', 'ok');
        } }]
    });
  }
  function evModal() {
    var liveCodes = S.houses().filter(function (h) { return h.status === '在养'; }).map(function (h) { return h.code; });
    var fs = [
      { name: 'type', label: '存证类型', type: 'select', options: ['死淘存证', '环境存证', '理赔存证'] },
      { name: 'houseCode', label: '鹅舍', type: 'select', options: liveCodes.map(function (c) { return { value: c, text: '鹅舍' + c }; }) },
      { name: 'count', label: '涉及数量（只）', type: 'number', min: 0, max: 5000, value: 0 },
      { name: 'policy', label: '保单号', required: true, value: 'PICC-HLJ-2026-3128' }
    ];
    U.modal({
      title: '新增保险存证', body: U.formHtml(fs, true) + '<p class="mini-note">系统将为本次存证生成唯一数据指纹。</p>',
      actions: [{ text: '取消' }, { text: '生成存证', primary: true, onClick: function (api) {
          var v = U.formCheck(api.body, fs); if (!v) return;
          var e = S.saveEvidence(v);
          api.close(); U.toast('存证 ' + e.no + ' 已生成', 'ok');
        } }]
    });
  }
  function userModal(u) {
    if (!guardAdmin()) return;
    var edit = !!u; u = u || { role: '饲养员', status: '启用' };
    var fs = [
      { name: 'username', label: '登录账号', required: true, value: u.username, disabled: edit, rule: { re: /^[a-zA-Z0-9_]{3,16}$/, msg: '3-16 位字母数字下划线' } },
      { name: 'name', label: '姓名', required: true, value: u.name },
      { name: 'password', label: '密码', required: true, value: u.password || '123456' },
      { name: 'phone', label: '手机号', value: u.phone || '' },
      { name: 'role', label: '角色', type: 'select', value: u.role, options: D.ROLES },
      { name: 'status', label: '状态', type: 'select', value: u.status, options: ['启用', '禁用'] }
    ];
    U.modal({
      title: edit ? '编辑账号' : '新增账号', size: 'lg', body: U.formHtml(fs, true),
      actions: [{ text: '取消' }, { text: '保存', primary: true, onClick: function (api) {
          var v = U.formCheck(api.body, fs); if (!v) return;
          if (edit) v.username = u.username;
          var r = S.saveUser(Object.assign({ id: u.id }, v));
          if (!r.ok) { U.toast(r.msg, 'err'); return; }
          api.close(); U.toast('账号已保存', 'ok');
        } }]
    });
  }

  /* ================= 页面：总览 ================= */
  var PAGES = {};
  PAGES.overview = {
    title: '总览', sub: '在栏、预警、死淘与存证的实时全景',
    act: function () {
      return '<button class="btn btn-line btn-sm" data-a="tick">' + icon('refresh') + '立即巡检</button>' +
        '<button class="btn btn-primary btn-sm" data-a="mort">' + icon('plus') + '登记死淘</button>';
    },
    html: function () {
      var k = S.kpi(), db = S.db();
      var last = db.alerts.slice(0, 6);
      var row1 = '<div class="kpi-row">' +
        kpiCard({ go: 'farms', ico: 'goose', label: '在栏数量', val: F.num(k.stock), unit: '只', sub: '在养鹅舍 ' + k.activeHouses + ' 栋' }) +
        kpiCard({ go: 'alerts', ico: 'bell', label: '今日预警', val: k.todayAlert, unit: '条', sub: '待处理 ' + k.pending + ' 条' }) +
        kpiCard({ go: 'mortality', ico: 'trend', label: '累计死淘率', val: k.deathRate, unit: '%', sub: '近7日变化 +' + k.deathRate7 + '%' }) +
        kpiCard({ go: 'evidence', ico: 'box', label: '保险存证', val: k.evidence, unit: '条', sub: '本月新增 ' + k.evidenceMonth + ' 条' }) +
        '</div>';
      var row2 = '<div class="stat-strip">' +
        '<div class="stat"><span>监控通道</span><b>' + k.camTotal + ' 路</b></div>' +
        '<div class="stat"><span>通道在线</span><b style="color:#12b76a">' + k.camOn + ' 路</b></div>' +
        '<div class="stat"><span>AI 识别中</span><b style="color:#f79009">' + k.camAi + ' 路</b></div>' +
        '<div class="stat"><span>设备在线</span><b>' + k.devOn + ' / ' + k.devTotal + ' 台</b></div>' +
        '</div>';
      var chart = '<div class="grid g-2-1">' +
        '<section class="card"><div class="card-hd"><h3>近' + st.trendDays + '天死淘趋势</h3>' +
        '<div class="tools"><span class="mini-note">柱=日死淘数，线=累计死淘率</span>' +
        '<div class="seg">' + [7, 30, 90].map(function (n) {
          return '<button data-days="' + n + '"' + (n === st.trendDays ? ' class="on"' : '') + '>近' + n + '天</button>';
        }).join('') + '</div></div></div><div class="card-bd"><div class="chart" id="cTrend" style="height:280px"></div></div></section>' +
        '<section class="card"><div class="card-hd"><h3>环境异常类型占比</h3><div class="tools"><span class="mini-note">近' + st.shareDays + '天</span></div></div>' +
        '<div class="card-bd"><div class="chart" id="cShare" style="height:280px"></div></div></section></div>';
      var alTbl = '<section class="card"><div class="card-hd"><h3>最新预警记录</h3><div class="tools">' +
        '<button class="btn btn-line btn-sm" data-a="more">查看全部</button></div></div>' +
        '<div class="card-bd">' + U.table({
          columns: [
            { title: '时间', key: 'ts' },
            { title: '鹅舍', render: function (r) { return '<b>鹅舍' + esc(r.houseCode) + '</b>'; } },
            { title: '类型', render: function (r) { return typeTag(r.type); } },
            { title: '实测值', align: 'right', render: function (r) { return '<b>' + r.value + unitOf(r.type) + '</b>'; } },
            { title: '数量', align: 'right', render: function (r) { return r.count + ' 只'; } },
            { title: '状态', align: 'center', render: function (r) { return stBadge(r.status); } },
            { title: '操作', align: 'center', render: function (r) {
                return '<div class="row-act"><button class="btn btn-sm btn-ghost" data-view="' + r.id + '">详情</button>' +
                  (r.status === '待处理' ? '<button class="btn btn-sm btn-primary" data-do="' + r.id + '">处理</button>' : '') + '</div>';
              } }
          ],
          rows: last, empty: '暂无预警记录'
        }) + '</div></section>';
      return row1 + row2 + chart + alTbl;
    },
    mount: function (root) {
      try {
        var t = S.deathTrend(st.trendDays);
        C.combo($('#cTrend', root), {
          labels: t.labels, height: 280, lUnit: '只', rUnit: '%',
          xFmt: function (s) { return s.slice(5); },
          series: [
            { name: '日死淘数', type: 'bar', axis: 'l', color: '#34d399', data: t.daily, unit: ' 只' },
            { name: '累计死淘率', type: 'line', axis: 'r', color: '#7a5af8', data: t.cum, unit: '%' }
          ]
        });
        C.donut($('#cShare', root), { items: S.alertTypeShare(st.shareDays).items, height: 280, title: '合计', unit: ' 起' });
      } catch (e) { console.error('图表渲染失败', e); }
      $$('[data-days]', root).forEach(function (b) {
        b.onclick = function () { st.trendDays = +b.dataset.days; render(true); };
      });
      $$('[data-go]', root).forEach(function (b) { b.onclick = function () { go(b.dataset.go); }; });
      var more = $('[data-a="more"]', root);
      if (more) more.onclick = function () { go('alerts'); };
      $('[data-a="mort"]', root).onclick = function () { mortModal(); };
      $('[data-a="tick"]', root).onclick = function () {
        var b = S.tick();
        if (b.length) addBreaches(b);
        U.toast('巡检完成' + (b.length ? '，触发 ' + b.length + ' 项越限' : '，各项指标正常'), b.length ? 'warn' : 'ok');
        render(true);
      };
      bindAlertRows(root);
    }
  };
  function bindAlertRows(root) {
    $$('[data-view]', root).forEach(function (b) {
      b.onclick = function (e) {
        e.stopPropagation();
        var a = S.db().alerts.filter(function (x) { return x.id === b.dataset.view; })[0];
        if (a) alertDrawer(a);
      };
    });
    $$('[data-do]', root).forEach(function (b) {
      b.onclick = function (e) { e.stopPropagation(); handleModal([b.dataset.do]); };
    });
  }

  /* ================= 页面：视频监控 ================= */
  PAGES.monitor = {
    title: '视频监控', sub: '鹅舍监控通道与 AI 识别联动',
    act: function () { return '<button class="btn btn-line btn-sm" data-a="refresh">' + icon('refresh') + '刷新通道</button>'; },
    html: function () {
      var ms = st.mon;
      var all = S.cams();
      var list = all.filter(function (c) {
        if (ms.farm && c.farmId !== ms.farm) return false;
        if (ms.status === '在线' && !c.online) return false;
        if (ms.status === '离线' && c.online) return false;
        return true;
      });
      var cs = S.camStats();
      var now = F.tstr(new Date());
      return '<div class="stat-strip">' +
        '<div class="stat"><span>监控通道</span><b>' + cs.total + ' 路</b></div>' +
        '<div class="stat"><span>在线</span><b style="color:#12b76a">' + cs.on + ' 路</b></div>' +
        '<div class="stat"><span>离线</span><b style="color:#f04438">' + cs.off + ' 路</b></div>' +
        '<div class="stat"><span>AI 识别</span><b style="color:#f79009">' + cs.ai + ' 路</b></div></div>' +
        '<div class="mv-tool">' +
        '<select class="input" id="mvFarm" style="width:auto;min-width:170px">' +
        '<option value="">全部鹅场</option>' + S.farms().map(function (f) {
          return '<option value="' + f.id + '"' + (ms.farm === f.id ? ' selected' : '') + '>' + esc(f.name) + '</option>';
        }).join('') + '</select>' +
        '<div class="chips" id="mvStatus" style="margin:0">' +
        ['全部', '在线', '离线'].map(function (s2) {
          return '<span class="chip' + (ms.status === s2 ? ' on' : '') + '" data-s="' + s2 + '">' + s2 + '</span>';
        }).join('') + '</div>' +
        '<div class="toolbar-r mini-note">当前显示 ' + list.length + ' 路 · ' + now + '</div></div>' +
        '<div class="mv-grid">' + (list.length ? list.map(function (c) {
          return '<article class="mv-card" data-cam="' + c.id + '">' +
            '<div class="mv-video">' + mvFeed(c) +
            '<span class="mv-tag">' + c.id + ' · ' + esc(c.zone) + '</span>' +
            '<span class="mv-rec' + (c.online ? '' : ' off') + '"><i class="d"></i>' + (c.online ? 'REC' : '离线') + '</span>' +
            (c.detect ? '<div class="mv-detect" style="left:24%;top:28%;width:44%;height:42%"><span class="mv-detect-t">' + c.detect.label + ' ' + c.detect.score + '</span></div>' : '') +
            '<span class="mv-time"><i>鹅舍' + c.houseCode + '</i><i>' + F.tstr(new Date()).slice(11) + '</i></span>' +
            '</div><div class="mv-meta"><b>鹅舍' + c.houseCode + '</b>' +
            '<span class="z">' + esc(c.batch || '') + ' · ' + c.res + ' · ' + c.fps + 'fps</span>' +
            (c.detect ? '<span class="badge" style="background:#feecea;color:#f04438">AI 异常</span>' : '<span class="badge" style="background:#e7f8ef;color:#12b76a">' + (c.online ? '正常' : '离线') + '</span>') +
            '</div></article>';
        }).join('') : '<div class="card empty" style="grid-column:1/-1">没有符合条件的监控通道</div>') + '</div>';
    },
    mount: function (root) {
      var ms = st.mon;
      var sel = $('#mvFarm', root);
      if (sel) sel.onchange = function () { ms.farm = this.value; render(true); };
      $$('#mvStatus .chip', root).forEach(function (b) {
        b.onclick = function () { ms.status = b.dataset.s; render(true); };
      });
      $$('[data-cam]', root).forEach(function (card) {
        card.onclick = function () { openCamPlayer(card.dataset.cam); };
      });
      var rb = $('[data-a="refresh"]', root);
      if (rb) rb.onclick = function () { render(true); U.toast('通道状态已刷新', 'ok'); };
    }
  };
  function mvFeed(c) {
    if (c.photo) return '<img class="mv-img" src="' + c.photo + '" alt="' + c.id + '">';
    return '<div class="mv-bg"></div><div class="mv-grid2"></div><div class="mv-scan"></div><div class="mv-lens"></div>';
  }
  function openCamPlayer(id) {
    var c = S.cams().filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    U.modal({
      title: c.id + ' · 鹅舍' + c.houseCode, size: 'lg',
      body: '<div class="mv-player"><div class="mv-big">' + mvFeed(c) +
        '<span class="mv-tag">' + c.id + ' · ' + esc(c.zone) + '</span>' +
        '<span class="mv-rec' + (c.online ? '' : ' off') + '"><i class="d"></i>' + (c.online ? 'REC' : '离线') + '</span>' +
        (c.detect ? '<div class="mv-detect" style="left:24%;top:26%;width:46%;height:44%"><span class="mv-detect-t">' + c.detect.label + ' ' + c.detect.score + '</span></div>' : '') +
        '<span class="mv-time"><i>鹅舍' + c.houseCode + ' · ' + (c.batch || '—') + '</i><i>' + F.tstr(new Date()).slice(11) + '</i></span>' +
        '</div><div class="mv-info">' +
        '<div class="dl"><b>通道编号</b><span>' + c.id + '</span></div>' +
        '<div class="dl"><b>所属鹅舍</b><span>鹅舍' + c.houseCode + '（' + esc(c.zone) + '）</span></div>' +
        '<div class="dl"><b>饲养员</b><span>' + esc(c.keeper || '—') + '</span></div>' +
        '<div class="dl"><b>清晰度</b><span>' + c.res + ' / ' + c.fps + 'fps</span></div>' +
        '<div class="dl"><b>运行状态</b><span>' + (c.online ? stBadge('在养') : stBadge('空舍')) + '</span></div>' +
        '<div class="dl"><b>AI 识别</b><span>' + (c.detect ? '<span class="badge" style="background:#feecea;color:#f04438">' + c.detect.label + ' ' + c.detect.score + '</span>' : '<span class="badge" style="background:#e7f8ef;color:#12b76a">未发现异常</span>') + '</span></div>' +
        '<div class="tip-box" style="margin-top:10px">AI 识别到异常时自动生成预警工单并推送给饲养员，请及时到现场复核。</div>' +
        '</div></div>',
      actions: [
        { text: '抓拍', onClick: function (api) { U.toast('抓拍成功，已存入资料库', 'ok'); } },
        { text: '关闭', primary: true }
      ]
    });
  }

  /* ================= 页面：鹅场管理 ================= */
  PAGES.farms = {
    title: '鹅场管理', sub: '鹅场档案、鹅舍台账与批次信息',
    act: function () {
      return '<button class="btn btn-line btn-sm" data-a="csv">' + icon('download') + '导出 CSV</button>' +
        '<button class="btn btn-line btn-sm" data-a="addFarm">' + icon('plus') + '新增鹅场</button>' +
        '<button class="btn btn-primary btn-sm" data-a="addHouse">' + icon('plus') + '新增鹅舍</button>';
    },
    html: function () {
      var s = st.farms, db = S.db();
      var tabs = '<div class="tabs">' +
        '<button data-tab="houses"' + (s.tab === 'houses' ? ' class="on"' : '') + '>鹅舍台账（' + db.houses.length + '）</button>' +
        '<button data-tab="farms"' + (s.tab === 'farms' ? ' class="on"' : '') + '>鹅场档案（' + db.farms.length + '）</button></div>';
      if (s.tab === 'farms') {
        return tabs + '<div class="farm-grid">' + db.farms.map(function (f) {
          var hs = db.houses.filter(function (h) { return h.farmId === f.id; });
          var stock = hs.reduce(function (a, h) { return a + (h.status === '在养' ? h.stock : 0); }, 0);
          return '<article class="card farm-c"><h3>' + esc(f.name) + '</h3>' +
            '<p class="mini-note" style="margin:4px 0 12px">' + esc(f.region || '') + '</p>' +
            '<div class="dl"><b>鹅舍</b><span>' + hs.length + ' 栋</span></div>' +
            '<div class="dl"><b>在栏</b><span>' + F.num(stock) + ' 只</span></div>' +
            '<div class="dl"><b>负责人</b><span>' + esc(f.manager || '—') + '</span></div>' +
            '<div class="dl"><b>联系电话</b><span>' + esc(f.phone || '—') + '</span></div>' +
            '<div style="display:flex;gap:8px;margin-top:14px">' +
            '<button class="btn btn-sm btn-line" data-ef="' + f.id + '">' + icon('edit') + '编辑</button>' +
            '<button class="btn btn-sm btn-danger" data-df="' + f.id + '">' + icon('trash') + '删除</button></div></article>';
        }).join('') + '</div>';
      }
      var rows = filterHouses();
      return tabs +
        '<div class="toolbar"><div class="field grow"><label>搜索</label><input id="hq" value="' + esc(s.q) + '" placeholder="鹅舍编号 / 批次 / 饲养员 / 品种"></div>' +
        '<div class="field"><label>鹅场</label>' + selHtml('hf', farmOptions(), s.farm) + '</div>' +
        '<div class="field"><label>状态</label>' + selHtml('hs', [{ value: '', text: '全部状态' }].concat(D.HOUSE_STATUS.map(function (x) { return { value: x, text: x }; })), s.status) + '</div>' +
        '<div class="toolbar-r"><span class="mini-note">共 ' + rows.length + ' 栋，在栏 ' + F.num(rows.reduce(function (a, h) { return a + h.stock; }, 0)) + ' 只</span></div></div>' +
        '<div class="card">' + U.table({
          columns: [
            { title: '鹅舍', render: function (r) { return '<b>鹅舍' + esc(r.code) + '</b>'; } },
            { title: '所属鹅场', render: function (r) { return esc(S.farmName(r.farmId)); } },
            { title: '批次', key: 'batch' }, { title: '品种', key: 'breed' },
            { title: '在栏(只)', align: 'right', render: function (r) { return '<b>' + F.num(r.stock) + '</b>'; } },
            { title: '面积(㎡)', align: 'right', key: 'area' },
            { title: '入栏日期', render: function (r) { return r.inDate || '—'; } },
            { title: '饲养员', key: 'keeper' },
            { title: '状态', align: 'center', render: function (r) { return stBadge(r.status); } },
            { title: '操作', align: 'center', render: function (r) {
                return '<div class="row-act">' +
                  '<button class="btn btn-sm btn-ghost" data-eh="' + r.id + '">' + icon('edit') + '编辑</button>' +
                  '<button class="btn btn-sm btn-ghost" data-mh="' + r.code + '">死淘</button>' +
                  '<button class="btn btn-sm btn-danger" data-dh="' + r.id + '">' + icon('trash') + '</button></div>';
              } }
          ],
          rows: rows, pageSize: 10, page: s.page, empty: '没有符合条件的鹅舍'
        }) + '</div>';
    },
    mount: function (root) {
      var s = st.farms;
      $$('[data-tab]', root).forEach(function (b) { b.onclick = function () { s.tab = b.dataset.tab; render(); }; });
      bindInput($('#hq', root), function (v) { s.q = v; s.page = 1; render(true); });
      bindSel($('#hf', root), function (v) { s.farm = v; s.page = 1; render(true); });
      bindSel($('#hs', root), function (v) { s.status = v; s.page = 1; render(true); });
      bindPager(root, function (p) { s.page = p; render(true); });
      var a1 = $('[data-a="addHouse"]', root); if (a1) a1.onclick = function () { houseModal(); };
      var a2 = $('[data-a="addFarm"]', root); if (a2) a2.onclick = function () { farmModal(); };
      var csv = $('[data-a="csv"]', root);
      if (csv) csv.onclick = function () {
        U.csv('鹅舍台账_' + F.dstr(new Date()) + '.csv', ['鹅舍', '鹅场', '批次', '品种', '在栏数量', '面积', '入栏日期', '饲养员', '状态'],
          filterHouses().map(function (h) { return ['鹅舍' + h.code, S.farmName(h.farmId), h.batch, h.breed, h.stock, h.area, h.inDate, h.keeper, h.status]; }));
      };
      $$('[data-eh]', root).forEach(function (b) {
        b.onclick = function () { var h = S.db().houses.filter(function (x) { return x.id === b.dataset.eh; })[0]; houseModal(h); };
      });
      $$('[data-mh]', root).forEach(function (b) { b.onclick = function () { mortModal(null, b.dataset.mh); }; });
      $$('[data-dh]', root).forEach(function (b) {
        b.onclick = function () {
          if (!guardAdmin()) return;
          var h = S.db().houses.filter(function (x) { return x.id === b.dataset.dh; })[0];
          U.confirm('确定删除「鹅舍' + h.code + '」？').then(function (ok) { if (ok) { S.delHouse(h.id); U.toast('已删除', 'ok'); } });
        };
      });
      $$('[data-ef]', root).forEach(function (b) {
        b.onclick = function () { var f = S.db().farms.filter(function (x) { return x.id === b.dataset.ef; })[0]; farmModal(f); };
      });
      $$('[data-df]', root).forEach(function (b) {
        b.onclick = function () {
          if (!guardAdmin()) return;
          U.confirm('确定删除该鹅场档案？').then(function (ok) {
            if (!ok) return;
            var r = S.delFarm(b.dataset.df);
            U.toast(r.ok ? '已删除' : r.msg, r.ok ? 'ok' : 'err');
          });
        };
      });
    }
  };
  function filterHouses() {
    var s = st.farms, q = s.q.trim().toLowerCase();
    return S.houses().filter(function (h) {
      if (s.farm && h.farmId !== s.farm) return false;
      if (s.status && h.status !== s.status) return false;
      if (!q) return true;
      return (h.code + h.batch + h.keeper + h.breed).toLowerCase().indexOf(q) > -1;
    });
  }

  /* ================= 页面：监测预警 ================= */
  PAGES.alerts = {
    title: '监测预警', sub: '鹅舍环境实时指标与预警工单',
    act: function () {
      return '<button class="btn btn-line btn-sm" data-a="tick">' + icon('refresh') + '立即巡检</button>' +
        '<button class="btn btn-line btn-sm" data-a="csv">' + icon('download') + '导出 CSV</button>' +
        '<button class="btn btn-primary btn-sm" data-a="batch">' + icon('check') + '批量处理</button>';
    },
    html: function () {
      var s = st.al, db = S.db(), rows = filterAlerts();
      var th = db.settings.thresholds;
      return '<section class="card"><div class="card-hd"><h3>鹅舍环境实况</h3>' +
        '<div class="tools"><span class="mini-note">阈值可在「系统设置」调整</span></div></div>' +
        '<div class="card-bd"><div class="env-grid" id="envGrid">' + envCards() + '</div></div></section>' +
        '<div class="toolbar" style="margin-top:16px">' +
        '<div class="field grow"><label>搜索</label><input id="aq" value="' + esc(s.q) + '" placeholder="鹅舍 / 处理人 / 备注"></div>' +
        '<div class="field"><label>类型</label>' + selHtml('at', [{ value: '', text: '全部类型' }].concat(D.ALERT_TYPES.map(function (t) { return { value: t, text: t }; })), s.type) + '</div>' +
        '<div class="field"><label>状态</label>' + selHtml('as', [{ value: '', text: '全部状态' }, { value: '待处理', text: '待处理' }, { value: '已处理', text: '已处理' }, { value: '已忽略', text: '已忽略' }], s.status) + '</div>' +
        '<div class="field"><label>鹅舍</label>' + selHtml('ah', houseOptions(), s.house) + '</div>' +
        '<div class="toolbar-r"><span class="mini-note">共 ' + rows.length + ' 条，待处理 ' + rows.filter(function (a) { return a.status === '待处理'; }).length + ' 条</span></div></div>' +
        '<div class="card">' + U.table({
          selectable: true, selected: s.sel,
          columns: [
            { title: '时间', key: 'ts' },
            { title: '鹅舍', render: function (r) { return '<b>鹅舍' + esc(r.houseCode) + '</b>'; } },
            { title: '类型', render: function (r) { return typeTag(r.type); } },
            { title: '实测值', align: 'right', render: function (r) { return '<b>' + r.value + unitOf(r.type) + '</b>'; } },
            { title: '级别', align: 'center', render: function (r) {
                var c = r.level === '高' ? ['#f04438', '#feecea'] : r.level === '中' ? ['#f79009', '#fdf3e3'] : ['#918fad', '#f1f0f7'];
                return '<span class="badge" style="background:' + c[1] + ';color:' + c[0] + '">' + r.level + '级</span>';
              } },
            { title: '数量', align: 'right', render: function (r) { return r.count + ' 只'; } },
            { title: '处理人', render: function (r) { return r.handler || '—'; } },
            { title: '状态', align: 'center', render: function (r) { return stBadge(r.status); } },
            { title: '操作', align: 'center', render: function (r) {
                return '<div class="row-act"><button class="btn btn-sm btn-ghost" data-view="' + r.id + '">详情</button>' +
                  (r.status === '待处理' ? '<button class="btn btn-sm btn-primary" data-do="' + r.id + '">处理</button>' : '') + '</div>';
              } }
          ],
          rows: rows, pageSize: 10, page: s.page, empty: '没有符合条件的预警'
        }) + '</div>';
    },
    mount: function (root) {
      var s = st.al;
      bindInput($('#aq', root), function (v) { s.q = v; s.page = 1; render(true); });
      bindSel($('#at', root), function (v) { s.type = v; s.page = 1; render(true); });
      bindSel($('#as', root), function (v) { s.status = v; s.page = 1; render(true); });
      bindSel($('#ah', root), function (v) { s.house = v; s.page = 1; render(true); });
      bindPager(root, function (p) { s.page = p; render(true); });
      bindAlertRows(root);
      bindEnvGrid(root);
      $$('[data-check]', root).forEach(function (c) {
        c.onchange = function () { if (c.checked) s.sel[c.dataset.check] = 1; else delete s.sel[c.dataset.check]; };
      });
      var all = $('[data-check-all]', root);
      if (all) all.onchange = function () {
        $$('[data-check]', root).forEach(function (c) {
          c.checked = all.checked;
          if (all.checked) s.sel[c.dataset.check] = 1; else delete s.sel[c.dataset.check];
        });
      };
      $('[data-a="batch"]', root).onclick = function () {
        var ids = Object.keys(s.sel).filter(function (id) {
          var a = S.db().alerts.filter(function (x) { return x.id === id; })[0];
          return a && a.status === '待处理';
        });
        if (!ids.length) { U.toast('请先勾选待处理的预警', 'warn'); return; }
        handleModal(ids);
      };
      $('[data-a="tick"]', root).onclick = function () {
        var b = S.tick();
        if (b.length) addBreaches(b);
        U.toast('巡检完成' + (b.length ? '，新增 ' + b.length + ' 条预警' : '，指标正常'), b.length ? 'warn' : 'ok');
        render(true);
      };
      $('[data-a="csv"]', root).onclick = function () {
        U.csv('预警记录_' + F.dstr(new Date()) + '.csv', ['时间', '鹅舍', '类型', '实测值', '级别', '数量', '状态', '处理人', '处理时间', '备注'],
          filterAlerts().map(function (a) { return [a.ts, a.houseCode, a.type, a.value + unitOf(a.type), a.level, a.count, a.status, a.handler, a.handledAt, a.remark]; }));
      };
    }
  };
  function filterAlerts() {
    var s = st.al, q = s.q.trim().toLowerCase();
    return S.db().alerts.filter(function (a) {
      if (s.type && a.type !== s.type) return false;
      if (s.status && a.status !== s.status) return false;
      if (s.house && a.houseCode !== s.house) return false;
      if (!q) return true;
      return (a.houseCode + a.handler + a.remark).toLowerCase().indexOf(q) > -1;
    });
  }
  function envCards() {
    var db = S.db(), th = db.settings.thresholds;
    return db.houses.filter(function (h) { return h.status === '在养'; }).map(function (h) {
      var e = db.env[h.code];
      if (!e) return '';
      var badT = e.temp < th.tempMin || e.temp > th.tempMax;
      var badH = e.hum < th.humMin || e.hum > th.humMax;
      var badN = e.nh3 > th.nh3Max;
      var badW = e.wind < th.windMin || e.wind > th.windMax;
      var bad = badT || badH || badN || badW;
      function val(v, u, bad2) {
        return '<div class="env-m' + (bad2 ? ' bad' : '') + '"><span>' + u + '</span><b>' + v + '</b></div>';
      }
      return '<div class="env-card' + (bad ? ' bad' : '') + '" data-env="' + h.code + '">' +
        '<div class="env-hd"><b>鹅舍' + h.code + '</b>' +
        (bad ? '<span class="badge" style="background:#feecea;color:#f04438">越限</span>' : '<span class="badge" style="background:#e7f8ef;color:#12b76a">正常</span>') + '</div>' +
        '<div class="env-metrics">' +
        val(e.temp, '温度 ℃', badT) + val(e.hum, '湿度 %', badH) +
        val(e.nh3, '氨气 ppm', badN) + val(e.wind, '风速 m/s', badW) +
        '</div><div class="env-spark bar-cell">' + esc(h.keeper) + ' · ' + e.ts.slice(11) + '</div></div>';
    }).join('') || '<div class="empty">暂无在养鹅舍</div>';
  }
  function bindEnvGrid(root) {
    $$('[data-env]', root).forEach(function (card) {
      card.onclick = function () {
        st.al.house = card.dataset.env;
        go('alerts');
      };
    });
  }

  /* ================= 页面：死淘记录 ================= */
  PAGES.mortality = {
    title: '死淘记录', sub: '逐条登记、原因分析与在栏自动核减',
    act: function () {
      return '<button class="btn btn-line btn-sm" data-a="csv">' + icon('download') + '导出 CSV</button>' +
        '<button class="btn btn-primary btn-sm" data-a="add">' + icon('plus') + '登记死淘</button>';
    },
    html: function () {
      var s = st.mo, db = S.db(), rows = filterMort();
      var ym = F.dstr(new Date()).slice(0, 7);
      var mCount = db.mortality.filter(function (m) { return m.date.slice(0, 7) === ym; }).reduce(function (a, m) { return a + m.count; }, 0);
      var w7 = db.mortality.filter(function (m) { return m.date > F.dstr(F.day(-7)); }).reduce(function (a, m) { return a + m.count; }, 0);
      var k = S.kpi();
      var cause = {};
      rows.forEach(function (m) { cause[m.cause] = (cause[m.cause] || 0) + m.count; });
      var t = S.deathTrend(30);
      return '<div class="stat-strip">' +
        '<div class="stat"><span>本月死淘</span><b>' + F.num(mCount) + ' 只</b></div>' +
        '<div class="stat"><span>近 7 日死淘</span><b>' + F.num(w7) + ' 只</b></div>' +
        '<div class="stat"><span>累计死淘率</span><b>' + k.deathRate + ' %</b></div>' +
        '<div class="stat"><span>上报次数</span><b>' + db.mortality.length + ' 次</b></div></div>' +
        '<div class="grid g-2-1">' +
        '<section class="card"><div class="card-hd"><h3>近30天死淘趋势</h3></div><div class="card-bd"><div class="chart" id="mTrend" style="height:250px"></div></div></section>' +
        '<section class="card"><div class="card-hd"><h3>死因构成</h3><span class="mini-note">按当前筛选</span></div><div class="card-bd"><div id="mCause"></div></div></section></div>' +
        '<div class="toolbar"><div class="field grow"><label>搜索</label><input id="mq" value="' + esc(s.q) + '" placeholder="鹅舍 / 上报人 / 备注"></div>' +
        '<div class="field"><label>鹅舍</label>' + selHtml('mh', houseOptions(), s.house) + '</div>' +
        '<div class="field"><label>原因</label>' + selHtml('mc', [{ value: '', text: '全部原因' }].concat(D.CAUSES.map(function (x) { return { value: x, text: x }; })), s.cause) + '</div>' +
        '<div class="toolbar-r"><span class="mini-note">筛选 ' + rows.length + ' 条 / ' + F.num(rows.reduce(function (a, m) { return a + m.count; }, 0)) + ' 只</span></div></div>' +
        '<div class="card">' + U.table({
          columns: [
            { title: '日期', key: 'date' },
            { title: '鹅舍', render: function (r) { return '<b>鹅舍' + esc(r.houseCode) + '</b>'; } },
            { title: '数量(只)', align: 'right', render: function (r) { return '<b>' + r.count + '</b>'; } },
            { title: '原因', render: function (r) { return '<span class="badge" style="background:#f1f0f7;color:#585676">' + esc(r.cause) + '</span>'; } },
            { title: '处置方式', key: 'disposal' },
            { title: '上报人', key: 'reporter' },
            { title: '备注', render: function (r) { return esc(r.remark || '—'); } },
            { title: '操作', align: 'center', render: function (r) {
                return '<div class="row-act"><button class="btn btn-sm btn-ghost" data-em="' + r.id + '">' + icon('edit') + '</button>' +
                  '<button class="btn btn-sm btn-ghost" data-ce="' + r.id + '">存证</button>' +
                  '<button class="btn btn-sm btn-danger" data-dm="' + r.id + '">' + icon('trash') + '</button></div>';
              } }
          ],
          rows: rows, pageSize: 10, page: s.page, empty: '暂无死淘记录'
        }) + '</div>';
    },
    mount: function (root) {
      var s = st.mo;
      try {
        var t = S.deathTrend(30);
        C.combo($('#mTrend', root), {
          labels: t.labels, height: 250, lUnit: '只', rUnit: '%', xFmt: function (x) { return x.slice(5); },
          series: [
            { name: '日死淘数', type: 'bar', axis: 'l', color: '#fb7185', data: t.daily, unit: ' 只' },
            { name: '累计死淘率', type: 'line', axis: 'r', color: '#7a5af8', data: t.cum, unit: '%' }
          ]
        });
        var cause = {};
        filterMort().forEach(function (m) { cause[m.cause] = (cause[m.cause] || 0) + m.count; });
        C.hbar($('#mCause', root), {
          unit: ' 只',
          items: Object.keys(cause).map(function (k) { return { name: k, value: cause[k] }; }).sort(function (a, b) { return b.value - a.value; })
        });
      } catch (e) { console.error('死淘图表失败', e); }
      bindInput($('#mq', root), function (v) { s.q = v; s.page = 1; render(true); });
      bindSel($('#mh', root), function (v) { s.house = v; s.page = 1; render(true); });
      bindSel($('#mc', root), function (v) { s.cause = v; s.page = 1; render(true); });
      bindPager(root, function (p) { s.page = p; render(true); });
      $('[data-a="add"]', root).onclick = function () { mortModal(); };
      $('[data-a="csv"]', root).onclick = function () {
        U.csv('死淘记录_' + F.dstr(new Date()) + '.csv', ['日期', '鹅舍', '数量', '原因', '处置方式', '上报人', '备注'],
          filterMort().map(function (m) { return [m.date, m.houseCode, m.count, m.cause, m.disposal, m.reporter, m.remark]; }));
      };
      $$('[data-em]', root).forEach(function (b) {
        b.onclick = function () { var m = S.db().mortality.filter(function (x) { return x.id === b.dataset.em; })[0]; mortModal(m); };
      });
      $$('[data-dm]', root).forEach(function (b) {
        b.onclick = function () {
          U.confirm('删除后该鹅舍在栏数量会自动加回，确定删除？').then(function (ok) {
            if (ok) { S.delMort(b.dataset.dm); U.toast('已删除', 'ok'); }
          });
        };
      });
      $$('[data-ce]', root).forEach(function (b) {
        b.onclick = function () {
          var m = S.db().mortality.filter(function (x) { return x.id === b.dataset.ce; })[0];
          if (!m) return;
          var e = S.saveEvidence({ type: '死淘存证', houseCode: m.houseCode, count: m.count, policy: 'PICC-HLJ-2026-3128' });
          U.toast('已生成存证 ' + e.no, 'ok');
        };
      });
    }
  };
  function filterMort() {
    var s = st.mo, q = s.q.trim().toLowerCase();
    return S.db().mortality.filter(function (m) {
      if (s.house && m.houseCode !== s.house) return false;
      if (s.cause && m.cause !== s.cause) return false;
      if (!q) return true;
      return (m.houseCode + m.reporter + (m.remark || '')).toLowerCase().indexOf(q) > -1;
    });
  }

  /* ================= 页面：保险存证 ================= */
  PAGES.evidence = {
    title: '保险存证', sub: '死淘与环境异常的存证台账，理赔时可导出核对',
    act: function () {
      return '<button class="btn btn-line btn-sm" data-a="csv">' + icon('download') + '导出 CSV</button>' +
        '<button class="btn btn-primary btn-sm" data-a="add">' + icon('plus') + '新增存证</button>';
    },
    html: function () {
      var s = st.ev, db = S.db(), rows = filterEv();
      var k = S.kpi();
      var pend = db.evidence.filter(function (e) { return e.status === '待确认'; }).length;
      var totalCnt = db.evidence.reduce(function (a, e) { return a + e.count; }, 0);
      return '<div class="stat-strip">' +
        '<div class="stat"><span>存证总数</span><b>' + F.num(k.evidence) + ' 条</b></div>' +
        '<div class="stat"><span>本月新增</span><b>' + k.evidenceMonth + ' 条</b></div>' +
        '<div class="stat"><span>待确认</span><b style="color:#f79009">' + pend + ' 条</b></div>' +
        '<div class="stat"><span>涉及只数</span><b>' + F.num(totalCnt) + ' 只</b></div></div>' +
        '<div class="toolbar"><div class="field grow"><label>搜索</label><input id="eq" value="' + esc(s.q) + '" placeholder="存证号 / 保单号 / 鹅舍"></div>' +
        '<div class="field"><label>类型</label>' + selHtml('et', [{ value: '', text: '全部类型' }, { value: '死淘存证', text: '死淘存证' }, { value: '环境存证', text: '环境存证' }, { value: '理赔存证', text: '理赔存证' }], s.type) + '</div>' +
        '<div class="field"><label>状态</label>' + selHtml('es', [{ value: '', text: '全部状态' }, { value: '已上链', text: '已上链' }, { value: '待确认', text: '待确认' }], s.status) + '</div>' +
        '<div class="toolbar-r"><span class="mini-note">共 ' + rows.length + ' 条</span></div></div>' +
        '<div class="card">' + U.table({
          columns: [
            { title: '存证号', render: function (r) { return '<b>' + esc(r.no) + '</b>'; } },
            { title: '生成时间', key: 'ts' },
            { title: '类型', render: function (r) { return '<span class="badge" style="background:#e9f2ff;color:#2e90fa">' + esc(r.type) + '</span>'; } },
            { title: '鹅舍', render: function (r) { return '鹅舍' + esc(r.houseCode); } },
            { title: '只数', align: 'right', render: function (r) { return '<b>' + r.count + '</b>'; } },
            { title: '保单号', key: 'policy' },
            { title: '数据指纹', render: function (r) { return '<span class="hash">' + esc(String(r.hash).slice(0, 14)) + '…</span>'; } },
            { title: '状态', align: 'center', render: function (r) { return stBadge(r.status); } },
            { title: '操作', align: 'center', render: function (r) {
                return '<div class="row-act"><button class="btn btn-sm btn-ghost" data-ve="' + r.id + '">详情</button>' +
                  (r.status === '待确认' ? '<button class="btn btn-sm btn-primary" data-oe="' + r.id + '">确认上链</button>' : '') +
                  '<button class="btn btn-sm btn-danger" data-de="' + r.id + '">' + icon('trash') + '</button></div>';
              } }
          ],
          rows: rows, pageSize: 10, page: s.page, empty: '暂无存证记录'
        }) + '</div>';
    },
    mount: function (root) {
      var s = st.ev;
      bindInput($('#eq', root), function (v) { s.q = v; s.page = 1; render(true); });
      bindSel($('#et', root), function (v) { s.type = v; s.page = 1; render(true); });
      bindSel($('#es', root), function (v) { s.status = v; s.page = 1; render(true); });
      bindPager(root, function (p) { s.page = p; render(true); });
      $('[data-a="add"]', root).onclick = function () { evModal(); };
      $('[data-a="csv"]', root).onclick = function () {
        U.csv('保险存证_' + F.dstr(new Date()) + '.csv', ['存证号', '时间', '类型', '鹅舍', '只数', '保单号', '数据指纹', '状态'],
          filterEv().map(function (e) { return [e.no, e.ts, e.type, e.houseCode, e.count, e.policy, e.hash, e.status]; }));
      };
      $$('[data-ve]', root).forEach(function (b) {
        b.onclick = function () {
          var e = S.db().evidence.filter(function (x) { return x.id === b.dataset.ve; })[0];
          if (!e) return;
          U.drawer({
            title: '存证 ' + e.no,
            rows: [['存证号', e.no], ['生成时间', e.ts], ['存证类型', e.type], ['鹅舍', '鹅舍' + e.houseCode],
              ['涉及只数', e.count + ' 只'], ['保单号', e.policy], ['状态', stBadge(e.status), 1],
              ['数据指纹', '<span class="hash">' + e.hash + '</span>', 1]],
            actions: [{ text: '复制指纹', onClick: function () { U.copy(e.hash); } }, { text: '关闭', primary: true }]
          });
        };
      });
      $$('[data-oe]', root).forEach(function (b) {
        b.onclick = function () { S.confirmEv(b.dataset.oe); U.toast('已确认上链', 'ok'); };
      });
      $$('[data-de]', root).forEach(function (b) {
        b.onclick = function () {
          if (!guardAdmin()) return;
          U.confirm('删除存证不可恢复，确定继续？').then(function (ok) { if (ok) { S.delEv(b.dataset.de); U.toast('已删除', 'ok'); } });
        };
      });
    }
  };
  function filterEv() {
    var s = st.ev, q = s.q.trim().toLowerCase();
    return S.db().evidence.filter(function (e) {
      if (s.type && e.type !== s.type) return false;
      if (s.status && e.status !== s.status) return false;
      if (!q) return true;
      return (e.no + e.policy + e.houseCode).toLowerCase().indexOf(q) > -1;
    });
  }

  /* ================= 页面：设备管理 ================= */
  PAGES.devices = {
    title: '设备管理', sub: '摄像头、传感器与边缘网关统一运维',
    act: function () { return '<button class="btn btn-line btn-sm" data-a="csv">' + icon('download') + '导出台账</button>'; },
    html: function () {
      var ds = st.dev;
      var all = S.devices();
      var types = [];
      all.forEach(function (x) { if (types.indexOf(x.type) < 0) types.push(x.type); });
      var list = all.filter(function (x) {
        if (ds.type && x.type !== ds.type) return false;
        if (ds.status === '在线' && !x.online) return false;
        if (ds.status === '离线' && x.online) return false;
        return true;
      });
      var k = S.devStats();
      return '<div class="stat-strip">' +
        '<div class="stat"><span>设备总数</span><b>' + k.total + ' 台</b></div>' +
        '<div class="stat"><span>在线</span><b style="color:#12b76a">' + k.on + ' 台</b></div>' +
        '<div class="stat"><span>离线</span><b style="color:#f04438">' + k.off + ' 台</b></div>' +
        '<div class="stat"><span>低电量</span><b style="color:#f79009">' + k.low + ' 台</b></div></div>' +
        '<div class="mv-tool"><select class="input" id="dvType" style="width:auto;min-width:130px">' +
        '<option value="">全部类型</option>' + types.map(function (t) {
          return '<option value="' + t + '"' + (ds.type === t ? ' selected' : '') + '>' + t + '</option>';
        }).join('') + '</select>' +
        '<div class="chips" id="dvStatus" style="margin:0">' +
        ['全部', '在线', '离线'].map(function (s2) {
          return '<span class="chip' + (ds.status === s2 ? ' on' : '') + '" data-s="' + s2 + '">' + s2 + '</span>';
        }).join('') + '</div></div>' +
        '<div class="card">' + U.table({
          columns: [
            { title: '设备', render: function (r) { return '<b>' + esc(r.name) + '</b><div style="font-size:12px;color:var(--ink-3)">' + r.id + '</div>'; } },
            { title: '类型', render: function (r) { return badgesOf(r.type); } },
            { title: '安装位置', key: 'place' },
            { title: '状态', align: 'center', render: function (r) { return r.online ? '<span class="badge" style="background:#e7f8ef;color:#12b76a">在线</span>' : '<span class="badge" style="background:#f1f0f7;color:#918fad">离线</span>'; } },
            { title: '电量', align: 'right', render: function (r) { return '<b>' + r.power + '%</b>'; } },
            { title: '信号', align: 'center', key: 'signal' },
            { title: '固件', key: 'ver' },
            { title: '上次维护', key: 'last' },
            { title: '操作', align: 'center', render: function (r) {
                return '<div class="row-act"><button class="btn btn-sm btn-ghost" data-dv="' + r.id + '">详情</button>' +
                  (r.online ? '<button class="btn btn-sm btn-ghost" data-rb="' + r.id + '">重启</button>' : '') + '</div>';
              } }
          ],
          rows: list, empty: '没有符合条件的设备'
        }) + '</div>';
    },
    mount: function (root) {
      var ds = st.dev;
      var sel = $('#dvType', root);
      if (sel) sel.onchange = function () { ds.type = this.value; render(true); };
      $$('#dvStatus .chip', root).forEach(function (b) {
        b.onclick = function () { ds.status = b.dataset.s; render(true); };
      });
      var csv = $('[data-a="csv"]', root);
      if (csv) csv.onclick = function () {
        U.csv('设备台账_' + F.dstr(new Date()) + '.csv', ['设备', '编号', '类型', '位置', '状态', '电量', '信号', '固件', '上次维护'],
          S.devices().map(function (x) { return [x.name, x.id, x.type, x.place, x.online ? '在线' : '离线', x.power + '%', x.signal, x.ver, x.last]; }));
      };
      $$('[data-dv]', root).forEach(function (b) {
        b.onclick = function () {
          var d = S.devices().filter(function (x) { return x.id === b.dataset.dv; })[0];
          if (!d) return;
          U.drawer({
            title: d.name + ' · ' + d.id,
            rows: [['设备类型', d.type], ['安装位置', d.place],
              ['运行状态', d.online ? stBadge('在养') : stBadge('空舍'), 1],
              ['电量', d.power + '%'], ['信号强度', d.signal],
              ['固件版本', d.ver], ['上次维护', d.last]],
            actions: [
              { text: '重启设备', onClick: function (api) {
                  if (!d.online) { U.toast('设备离线，无法下发指令', 'warn'); return; }
                  api.close(); U.toast('重启指令已下发，预计 30 秒内恢复', 'ok', 3000);
                } },
              { text: '切换在线/离线', kind: 'danger', onClick: function (api) {
                  S.setDev(d.id, !d.online);
                  api.close(); U.toast('设备状态已更新', 'ok');
                } },
              { text: '关闭', primary: true }
            ]
          });
        };
      });
      $$('[data-rb]', root).forEach(function (b) {
        b.onclick = function () { U.toast('重启指令已下发，预计 30 秒内恢复', 'ok', 3000); };
      });
    }
  };

  /* ================= 页面：数据报表 ================= */
  PAGES.reports = {
    title: '数据报表', sub: '自定义时间段与鹅场维度的经营分析',
    act: function () {
      return '<button class="btn btn-line btn-sm" data-a="print">' + icon('print') + '打印 / 存 PDF</button>' +
        '<button class="btn btn-primary btn-sm" data-a="csv">' + icon('download') + '导出报表</button>';
    },
    html: function () {
      var s = st.rep, r = repData();
      return '<div class="toolbar">' +
        '<div class="field"><label>开始日期</label><input id="rf" type="date" value="' + s.from + '"></div>' +
        '<div class="field"><label>结束日期</label><input id="rt" type="date" value="' + s.to + '"></div>' +
        '<div class="field"><label>鹅场</label>' + selHtml('rm', farmOptions(), s.farm) + '</div>' +
        '<div class="field"><label>快捷区间</label><div class="seg">' +
        '<button data-q="7">近7天</button><button data-q="30">近30天</button><button data-q="90">近90天</button></div></div></div>' +
        '<div class="stat-strip">' +
        '<div class="stat"><span>统计区间</span><b style="font-size:14px">' + s.from + ' ~ ' + s.to + '</b></div>' +
        '<div class="stat"><span>期间死淘</span><b>' + F.num(r.deaths) + ' 只</b></div>' +
        '<div class="stat"><span>期间死淘率</span><b>' + r.rate + ' %</b></div>' +
        '<div class="stat"><span>预警 / 待处理</span><b>' + r.alerts + ' / ' + r.pending + '</b></div>' +
        '<div class="stat"><span>新增存证</span><b>' + r.ev + ' 条</b></div></div>' +
        '<div class="grid g-2-1">' +
        '<section class="card"><div class="card-hd"><h3>区间死淘趋势</h3><span class="mini-note">' + r.labels.length + ' 天</span></div><div class="card-bd"><div class="chart" id="rTrend" style="height:260px"></div></div></section>' +
        '<section class="card"><div class="card-hd"><h3>异常类型占比</h3></div><div class="card-bd"><div class="chart" id="rShare" style="height:260px"></div></div></section></div>' +
        '<div class="grid g-2">' +
        '<section class="card"><div class="card-hd"><h3>鹅舍死淘排行</h3><span class="mini-note">Top 8</span></div><div class="card-bd"><div id="rRank"></div></div></section>' +
        '<section class="card"><div class="card-hd"><h3>鹅场汇总</h3></div><div class="card-bd">' + U.table({
          columns: [
            { title: '鹅场', render: function (x) { return '<b>' + esc(x.name) + '</b>'; } },
            { title: '鹅舍', align: 'right', render: function (x) { return x.houses; } },
            { title: '在栏(只)', align: 'right', render: function (x) { return '<b>' + F.num(x.stock) + '</b>'; } },
            { title: '期间死淘', align: 'right', render: function (x) { return x.deaths; } },
            { title: '死淘率', align: 'right', render: function (x) { return '<b>' + x.rate + '%</b>'; } },
            { title: '预警', align: 'right', render: function (x) { return x.alerts; } }
          ], rows: r.byFarm, empty: '暂无数据'
        }) + '</div></section></div>';
    },
    mount: function (root) {
      var s = st.rep, r = repData();
      try {
        C.combo($('#rTrend', root), {
          labels: r.labels, height: 260, lUnit: '只', xFmt: function (x) { return x.slice(5); },
          series: [{ name: '日死淘数', type: 'bar', color: '#7a5af8', data: r.daily, unit: ' 只' },
                   { name: '7日移动平均', type: 'line', color: '#f79009', data: r.ma, unit: ' 只' }]
        });
        C.donut($('#rShare', root), { items: r.share, height: 260, title: '合计', unit: ' 起' });
        C.hbar($('#rRank', root), { unit: ' 只', items: r.rank });
      } catch (e) { console.error('报表图表失败', e); }
      $('#rf', root).onchange = function () { s.from = this.value; render(true); };
      $('#rt', root).onchange = function () { s.to = this.value; render(true); };
      bindSel($('#rm', root), function (v) { s.farm = v; render(true); });
      $$('[data-q]', root).forEach(function (b) {
        b.onclick = function () { s.from = F.dstr(F.day(-(+b.dataset.q - 1))); s.to = F.dstr(new Date()); render(true); };
      });
      $('[data-a="print"]', root).onclick = function () { window.print(); };
      $('[data-a="csv"]', root).onclick = function () {
        U.csv('经营报表_' + s.from + '_' + s.to + '.csv', ['日期', '死淘数(只)', '7日移动平均'],
          r.labels.map(function (l, i) { return [l, r.daily[i], r.ma[i]]; }));
      };
    }
  };
  function repData() {
    var s = st.rep, from = s.from, to = s.to;
    if (from > to) { var t0 = from; from = to; to = t0; }
    var db = S.db();
    function inFarm(code) { if (!s.farm) return true; var h = S.houseByCode(code); return h && h.farmId === s.farm; }
    var labels = [], map = {}, dt = new Date(from.replace(/-/g, '/')), end = new Date(to.replace(/-/g, '/')), guardN = 0;
    while (dt <= end && guardN++ < 400) { var k = F.dstr(dt); labels.push(k); map[k] = 0; dt.setDate(dt.getDate() + 1); }
    var deaths = 0, rank = {};
    db.mortality.forEach(function (m) {
      if (m.date < from || m.date > to || !inFarm(m.houseCode)) return;
      if (map[m.date] !== undefined) map[m.date] += m.count;
      deaths += m.count; rank[m.houseCode] = (rank[m.houseCode] || 0) + m.count;
    });
    var daily = labels.map(function (k) { return map[k]; });
    var ma = daily.map(function (_, i) {
      var a = daily.slice(Math.max(0, i - 6), i + 1);
      return +(a.reduce(function (x, y) { return x + y; }, 0) / a.length).toFixed(2);
    });
    var alerts = 0, pending = 0, shareMap = {};
    D.ALERT_TYPES.forEach(function (t) { shareMap[t] = 0; });
    db.alerts.forEach(function (a) {
      var day0 = a.ts.slice(0, 10);
      if (day0 < from || day0 > to || !inFarm(a.houseCode)) return;
      alerts++; if (a.status === '待处理') pending++;
      shareMap[a.type]++;
    });
    var ev = db.evidence.filter(function (e) {
      var day0 = e.ts.slice(0, 10);
      return day0 >= from && day0 <= to && inFarm(e.houseCode);
    }).length;
    var stock = db.houses.filter(function (h) { return h.status === '在养' && (!s.farm || h.farmId === s.farm); }).reduce(function (a, h) { return a + h.stock; }, 0);
    var byFarm = db.farms.filter(function (f) { return !s.farm || f.id === s.farm; }).map(function (f) {
      var hs = db.houses.filter(function (h) { return h.farmId === f.id; });
      var codes = {}; hs.forEach(function (h) { codes[h.code] = 1; });
      var fs = hs.reduce(function (a, h) { return a + (h.status === '在养' ? h.stock : 0); }, 0);
      var fd = db.mortality.filter(function (m) { return codes[m.houseCode] && m.date >= from && m.date <= to; }).reduce(function (a, m) { return a + m.count; }, 0);
      var fa = db.alerts.filter(function (a) { return codes[a.houseCode] && a.ts.slice(0, 10) >= from && a.ts.slice(0, 10) <= to; }).length;
      return { name: f.name, houses: hs.length, stock: fs, deaths: fd, alerts: fa, rate: fs + fd ? +(fd / (fs + fd) * 100).toFixed(2) : 0 };
    });
    return {
      labels: labels, daily: daily, ma: ma, deaths: deaths, alerts: alerts, pending: pending, ev: ev,
      rate: stock + deaths ? +(deaths / (stock + deaths) * 100).toFixed(2) : 0,
      share: D.ALERT_TYPES.map(function (t) { return { name: t, value: shareMap[t], color: D.TYPE_COLORS[t] }; }).filter(function (x) { return x.value > 0; }),
      rank: Object.keys(rank).map(function (c) { return { name: '鹅舍' + c, value: rank[c] }; }).sort(function (a, b) { return b.value - a.value; }).slice(0, 8),
      byFarm: byFarm
    };
  }

  /* ================= 页面：系统设置 ================= */
  var TH_FIELDS = function (th) {
    return [
      { name: 'tempMin', label: '温度下限（℃）', type: 'number', required: true, min: -30, max: 40, step: '0.5', value: th.tempMin },
      { name: 'tempMax', label: '温度上限（℃）', type: 'number', required: true, min: -30, max: 45, step: '0.5', value: th.tempMax },
      { name: 'humMin', label: '湿度下限（%）', type: 'number', required: true, min: 0, max: 100, value: th.humMin },
      { name: 'humMax', label: '湿度上限（%）', type: 'number', required: true, min: 0, max: 100, value: th.humMax },
      { name: 'nh3Max', label: '氨气上限（ppm）', type: 'number', required: true, min: 1, max: 60, step: '0.5', value: th.nh3Max },
      { name: 'windMin', label: '风速下限（m/s）', type: 'number', required: true, min: 0, max: 5, step: '0.1', value: th.windMin },
      { name: 'windMax', label: '风速上限（m/s）', type: 'number', required: true, min: 0, max: 8, step: '0.1', value: th.windMax },
      { name: 'co2Max', label: 'CO₂ 上限（ppm）', type: 'number', required: true, min: 400, max: 5000, value: th.co2Max }
    ];
  };
  PAGES.settings = {
    title: '系统设置', sub: '预警阈值、账号权限、外观与数据管理',
    act: function () { return ''; },
    html: function () {
      var s = st.set, db = S.db(), sm = db.settings;
      var tabs = '<div class="tabs">' + [['th', '预警阈值'], ['user', '账号管理'], ['ui', '通知与外观'], ['data', '数据管理']].map(function (t) {
        return '<button data-tab="' + t[0] + '"' + (s.tab === t[0] ? ' class="on"' : '') + '>' + t[1] + '</button>';
      }).join('') + '</div>';
      if (s.tab === 'th') {
        return tabs + '<section class="card" style="max-width:820px"><div class="card-hd"><h3>环境预警阈值</h3><span class="mini-note">保存后立即生效</span></div>' +
          '<div class="card-bd"><div id="thForm">' + U.formHtml(TH_FIELDS(sm.thresholds), true) + '</div>' +
          '<div class="tip-box">寒区建议：育雏期 26~32℃，育成期 15~22℃，育肥期 12~24℃；氨气长期高于 15ppm 会显著提高呼吸道发病率。</div>' +
          '<div style="display:flex;gap:10px;margin-top:16px">' +
          '<button class="btn btn-primary" data-a="thSave">' + icon('check') + '保存阈值</button>' +
          '<button class="btn btn-line" data-a="thReset">恢复默认</button>' +
          '<button class="btn btn-line" data-a="thTest">立即巡检验证</button></div></div></section>';
      }
      if (s.tab === 'user') {
        return tabs + '<section class="card"><div class="card-hd"><h3>账号管理</h3><div class="tools">' +
          '<button class="btn btn-primary btn-sm" data-a="addUser">' + icon('plus') + '新增账号</button></div></div>' +
          '<div class="card-bd">' + U.table({
            columns: [
              { title: '账号', render: function (u) { return '<b>' + esc(u.username) + '</b>'; } },
              { title: '姓名', key: 'name' },
              { title: '角色', render: function (u) { return badgesOf(u.role); } },
              { title: '手机号', key: 'phone' },
              { title: '最近登录', key: 'last' },
              { title: '状态', align: 'center', render: function (u) { return stBadge(u.status); } },
              { title: '操作', align: 'center', render: function (u) {
                  return '<div class="row-act"><button class="btn btn-sm btn-ghost" data-eu="' + u.id + '">' + icon('edit') + '编辑</button>' +
                    (u.id === me.uid ? '' : '<button class="btn btn-sm btn-danger" data-du="' + u.id + '">' + icon('trash') + '</button>') + '</div>';
                } }
            ], rows: db.users, empty: '暂无账号'
          }) + '</div></section>';
      }
      if (s.tab === 'ui') {
        return tabs + '<div class="grid g-2">' +
          '<section class="card"><div class="card-hd"><h3>通知设置</h3></div><div class="card-bd"><div id="ntForm">' +
          U.formHtml([
            { name: 'popup', type: 'switch', label: '站内弹窗提醒', value: sm.notify.popup },
            { name: 'sms', type: 'switch', label: '短信通知饲养员', value: sm.notify.sms },
            { name: 'email', type: 'switch', label: '邮件日报', value: sm.notify.email },
            { name: 'daily', type: 'switch', label: '每日晨报汇总', value: sm.notify.daily },
            { name: 'sim', type: 'switch', label: '实时数据刷新（8 秒一轮）', value: sm.sim }
          ]) + '</div><button class="btn btn-primary" data-a="ntSave">' + icon('check') + '保存通知设置</button></div></section>' +
          '<section class="card"><div class="card-hd"><h3>外观</h3></div><div class="card-bd">' +
          '<div class="field"><label>主题</label><div class="seg">' +
          '<button data-theme="light"' + (sm.theme === 'light' ? ' class="on"' : '') + '>浅色</button>' +
          '<button data-theme="dark"' + (sm.theme === 'dark' ? ' class="on"' : '') + '>深色</button></div></div>' +
          '<div class="field"><label>主色调</label><div class="color-dots">' +
          ACCENTS.map(function (a) {
            return '<button data-accent="' + a[0] + '" style="background:' + a[0] + '"' + (sm.accent === a[0] ? ' class="on"' : '') + '></button>';
          }).join('') + '</div></div>' +
          '<div class="dl"><b>当前账号</b><span>' + esc(me.name) + '（' + esc(me.role) + '）</span></div>' +
          '<div class="dl"><b>登录时间</b><span>' + esc(me.at) + '</span></div></div></section></div>';
      }
      var dbg = db.meta;
      return tabs + '<div class="grid g-2">' +
        '<section class="card"><div class="card-hd"><h3>数据备份与恢复</h3></div><div class="card-bd">' +
        '<p class="mini-note" style="margin-bottom:14px">数据保存于本机浏览器缓存，占用 ' + S.usage() + '。换设备前请先导出备份。</p>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn btn-primary" data-a="expJson">' + icon('download') + '导出全部数据(JSON)</button>' +
        '<button class="btn btn-line" data-a="impJson">' + icon('copy') + '导入数据</button>' +
        '<input type="file" id="impFile" accept=".json" hidden></div>' +
        '<div class="tip-box" style="margin-top:16px">重置将清空新增记录，恢复初始数据，请先导出备份。</div>' +
        '<button class="btn btn-danger" style="margin-top:14px" data-a="reset">' + icon('refresh') + '重置数据</button></div></section>' +
        '<section class="card"><div class="card-hd"><h3>系统信息</h3></div><div class="card-bd">' +
        '<div class="dl"><b>系统版本</b><span>寒羽智瞳 v1.0.0</span></div>' +
        '<div class="dl"><b>数据初始化</b><span>' + esc(dbg.seededAt || '—') + '</span></div>' +
        '<div class="dl"><b>期初存栏</b><span>' + F.num(dbg.openingStock || 0) + ' 只</span></div>' +
        '<div class="dl"><b>鹅场 / 鹅舍</b><span>' + db.farms.length + ' 个 / ' + db.houses.length + ' 栋</span></div>' +
        '<div class="dl"><b>监控通道</b><span>' + db.cams.length + ' 路</span></div>' +
        '<div class="dl"><b>记录条数</b><span>预警 ' + db.alerts.length + ' · 死淘 ' + db.mortality.length + ' · 存证 ' + db.evidence.length + '</span></div>' +
        '<div class="dl"><b>存储占用</b><span>' + S.usage() + '</span></div></div></section></div>';
    },
    mount: function (root) {
      var s = st.set, db = S.db(), sm = db.settings;
      $$('[data-tab]', root).forEach(function (b) { b.onclick = function () { s.tab = b.dataset.tab; render(); }; });
      var save = $('[data-a="thSave"]', root);
      if (save) save.onclick = function () {
        if (!guardAdmin()) return;
        var fs = TH_FIELDS(sm.thresholds), v = U.formCheck($('#thForm', root), fs);
        if (!v) return;
        if (v.tempMin >= v.tempMax || v.humMin >= v.humMax || v.windMin >= v.windMax) { U.toast('下限必须小于上限', 'err'); return; }
        db.settings.thresholds = v; S.save(); U.toast('阈值已保存并生效', 'ok'); render(true);
      };
      var rs = $('[data-a="thReset"]', root);
      if (rs) rs.onclick = function () {
        if (!guardAdmin()) return;
        S.resetThresholds(); U.toast('已恢复默认阈值', 'ok'); render(true);
      };
      var tt = $('[data-a="thTest"]', root);
      if (tt) tt.onclick = function () {
        var b = S.tick();
        if (b.length) addBreaches(b);
        U.toast('巡检完成' + (b.length ? '，触发 ' + b.length + ' 项越限' : '，指标正常'), b.length ? 'warn' : 'ok');
      };
      var au = $('[data-a="addUser"]', root); if (au) au.onclick = function () { userModal(); };
      $$('[data-eu]', root).forEach(function (b) {
        b.onclick = function () { var u = S.db().users.filter(function (x) { return x.id === b.dataset.eu; })[0]; userModal(u); };
      });
      $$('[data-du]', root).forEach(function (b) {
        b.onclick = function () {
          if (!guardAdmin()) return;
          U.confirm('确定删除该账号？').then(function (ok) { if (ok) { S.delUser(b.dataset.du); U.toast('已删除', 'ok'); } });
        };
      });
      var ns = $('[data-a="ntSave"]', root);
      if (ns) ns.onclick = function () {
        var v = U.formRead($('#ntForm', root));
        db.settings.notify = { popup: !!v.popup, sms: !!v.sms, email: !!v.email, daily: !!v.daily };
        db.settings.sim = !!v.sim;
        S.save(); paintLive(); U.toast('通知设置已保存', 'ok');
      };
      $$('[data-theme]', root).forEach(function (b) {
        b.onclick = function () { db.settings.theme = b.dataset.theme; S.save(); applyTheme(); render(true); };
      });
      $$('[data-accent]', root).forEach(function (b) {
        b.onclick = function () { db.settings.accent = b.dataset.accent; S.save(); applyTheme(); render(true); };
      });
      var ej = $('[data-a="expJson"]', root);
      if (ej) ej.onclick = function () { U.download('hanyu_backup_' + F.dstr(new Date()) + '.json', S.exportAll(), 'application/json'); U.toast('已导出', 'ok'); };
      var ij = $('[data-a="impJson"]', root), file = $('#impFile', root);
      if (ij) ij.onclick = function () { if (guardAdmin()) file.click(); };
      if (file) file.onchange = function () {
        var f = file.files[0]; if (!f) return;
        var fr = new FileReader();
        fr.onload = function () {
          try { S.importAll(fr.result); U.toast('导入成功', 'ok'); render(); }
          catch (err) { U.toast('导入失败：' + err.message, 'err'); }
        };
        fr.readAsText(f);
      };
      var rst = $('[data-a="reset"]', root);
      if (rst) rst.onclick = function () {
        if (!guardAdmin()) return;
        U.confirm('重置后所有新增数据都会丢失，确定继续？').then(function (ok) { if (ok) { S.reset(); U.toast('已恢复初始数据', 'ok'); render(); } });
      };
    }
  };

  /* ================= 公共小工具 ================= */
  function selHtml(id, options, value) {
    return '<select id="' + id + '">' + options.map(function (o) {
      var v = (o && typeof o === 'object') ? o.value : o, t = (o && typeof o === 'object') ? o.text : o;
      return '<option value="' + esc(v) + '"' + (String(value) === String(v) ? ' selected' : '') + '>' + esc(t) + '</option>';
    }).join('') + '</select>';
  }
  function bindInput(el, fn) {
    if (!el) return;
    var t;
    el.oninput = function () { clearTimeout(t); var v = el.value; t = setTimeout(function () { fn(v); }, 260); };
    el.onkeydown = function (e) { if (e.key === 'Enter') { clearTimeout(t); fn(el.value); } };
  }
  function bindSel(el, fn) { if (el) el.onchange = function () { fn(el.value); }; }
  function bindPager(root, fn) {
    $$('[data-page]', root).forEach(function (b) {
      if (b.disabled) return;
      b.onclick = function () { fn(+b.dataset.page); };
    });
  }
  var breachLog = {};
  function addBreaches(list) {
    var db = S.db();
    list.forEach(function (a) {
      var key = a.houseCode + '_' + a.type;
      var last = breachLog[key] || 0;
      if (Date.now() - last < 60000) return;
      breachLog[key] = Date.now();
      S.addAlert({ houseCode: a.houseCode, type: a.type, value: a.value, unit: a.unit, threshold: a.threshold, level: a.level, count: 1, detail: '实时监测越限，请及时处理' });
    });
    if (list.length) {
      var n = S.db().alerts.filter(function (x) { return x.status === '待处理'; }).length;
      U.toast('触发 ' + list.length + ' 项越限，待处理 ' + n + ' 条', 'warn', 3200);
    }
  }

  /* ================= 外壳：导航 / 顶栏 / 主题 ================= */
  function paintNav() {
    var nav = $('#sideNav');
    if (!nav) return;
    var pendingN = NAV.filter(function (n) { return n.badge; }).reduce(function (s, n) { return s + (n.badge() || 0); }, 0);
    nav.innerHTML = NAV.map(function (n) {
      var b = n.badge ? n.badge() : 0;
      return '<a class="' + (st.page === n.key ? 'on' : '') + '" data-nav="' + n.key + '" title="' + n.name + '">' +
        icon(n.ico) + '<span>' + n.name + '</span>' +
        (b ? '<b class="dot">' + (b > 99 ? '99+' : b) + '</b>' : '') + '</a>';
    }).join('');
    $$('[data-nav]').forEach(function (a) {
      a.onclick = function () { go(a.dataset.nav); closeSide(); };
    });
    var total = $('#msgCount');
    if (total) { total.textContent = pendingN; total.style.display = pendingN ? '' : 'none'; }
  }
  function paintUser() {
    var uName = $('#uName'), uRole = $('#uRole'), avatar = $('#avatar');
    if (uName) uName.textContent = me.name;
    if (uRole) uRole.textContent = me.role;
    if (avatar) avatar.textContent = (me.name || '羽').slice(0, 1);
    var n = S.db().messages.filter(function (m) { return !m.read; }).length;
    var c = $('#msgCount');
    if (c) { c.textContent = n; c.style.display = n ? '' : 'none'; }
  }
  function applyTheme() {
    var sm = S.db().settings;
    document.documentElement.setAttribute('data-theme', sm.theme || 'light');
    var pair = ACCENTS.filter(function (a) { return a[0] === sm.accent; })[0] || ACCENTS[0];
    document.documentElement.style.setProperty('--brand', pair[0]);
    document.documentElement.style.setProperty('--brand-2', pair[1]);
  }
  function go(key) { location.hash = '#/' + key; }
  function closeSide() {
    var side = $('#side');
    if (side) side.classList.remove('open');
    var m = $('#sideMask');
    if (m) m.hidden = true;
  }
  function route() {
    var k = (location.hash || '').replace(/^#\/?/, '') || 'overview';
    if (!PAGES[k]) k = 'overview';
    st.page = k;
    render();
  }
  function render(keep) {
    var view = $('#view');
    if (!view) return;
    var sc = view.scrollTop;
    var p = PAGES[st.page] || PAGES.overview;
    paintNav(); paintUser();
    var html = '';
    try {
      html = '<div class="page-hd"><div><h2>' + p.title + '</h2><p>' + p.sub + '</p></div>' +
        '<div class="page-act">' + (p.act ? p.act() : '') + '</div></div>' + p.html();
    } catch (e) {
      console.error('页面渲染失败', e);
      html = '<div class="card" style="margin-top:20px;border-left:4px solid #f04438"><h3>页面加载失败</h3>' +
        '<p class="mini-note" style="margin-top:6px;color:#f04438">' + esc(e.message) + '</p>' +
        '<p class="mini-note" style="margin-top:10px">请按 F12 打开控制台，把红色报错发给开发人员。</p></div>';
    }
    view.innerHTML = html;
    document.title = p.title + ' · 寒羽智瞳';
    if (p.mount) { try { requestAnimationFrame(function () { p.mount(view); }); } catch (e) { console.error('页面挂载失败', e); } }
    view.scrollTop = keep ? sc : 0;
  }

  /* ================= 顶栏交互 ================= */
  var btnMenu = $('#btnMenu');
  if (btnMenu) btnMenu.onclick = function () {
    var side = $('#side');
    if (side) side.classList.add('open');
    var m = $('#sideMask');
    if (m) m.hidden = false;
  };
  var sideMask = $('#sideMask');
  if (sideMask) sideMask.onclick = closeSide;

  var live = $('#btnLive');
  function paintLive() {
    var on = S.db().settings.sim;
    if (!live) return;
    live.classList.toggle('off', !on);
    var t = live.querySelector('span');
    if (t) t.textContent = on ? '实时监测中' : '监测已暂停';
  }
  if (live) live.onclick = function () {
    S.db().settings.sim = !S.db().settings.sim;
    S.save();
    paintLive();
    U.toast(S.db().settings.sim ? '已开启实时刷新' : '已暂停实时刷新', 'ok');
  };

  var btnFull = $('#btnFull');
  if (btnFull) btnFull.onclick = function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(function () { U.toast('当前浏览器不允许全屏', 'warn'); });
    }
  };

  $('#btnMsg').onclick = function () {
    var ms = S.db().messages;
    U.popover(this,
      '<div class="pop-hd"><b>消息中心（' + ms.filter(function (m) { return !m.read; }).length + ' 条未读）</b>' +
      '<button class="btn btn-sm btn-ghost" data-all>全部已读</button></div>' +
      (ms.length ? ms.slice(0, 12).map(function (m) {
        return '<div class="msg-item' + (m.read ? '' : ' unread') + '" data-m="' + m.id + '"><b>' + esc(m.title) + '</b>' +
          '<p>' + esc(m.body) + '</p><time>' + esc(m.ts) + '</time></div>';
      }).join('') : '<div class="empty">暂无消息</div>'),
      function (pop, close) {
        var all = pop.querySelector('[data-all]');
        if (all) all.onclick = function () { S.db().messages.forEach(function (m) { m.read = true; }); S.save(); close(); paintUser(); U.toast('已全部标记为已读', 'ok'); };
        $$('[data-m]', pop).forEach(function (el) {
          el.onclick = function () {
            var m = S.db().messages.filter(function (x) { return x.id === el.dataset.m; })[0];
            if (m) m.read = true;
            S.save();
            close(); paintUser();
            U.modal({ title: m.title, body: '<p style="color:var(--ink-2);padding:6px 0 12px">' + esc(m.body) + '</p><p class="mini-note">' + esc(m.ts) + '</p>', actions: [{ text: '知道了', primary: true }] });
          };
        });
      });
  };

  $('#btnUser').onclick = function () {
    U.popover(this,
      '<div class="up-hd"><span class="avatar">' + esc((me.name || '羽').slice(0, 1)) + '</span>' +
      '<div><b>' + esc(me.name) + '</b><span>' + esc(me.role) + ' · ' + esc(me.username) + '</span></div></div>' +
      '<button class="up-item" data-p="me">' + icon('user') + '个人信息</button>' +
      '<button class="up-item" data-p="theme">' + icon(S.db().settings.theme === 'dark' ? 'sun' : 'moon') + '切换深色 / 浅色</button>' +
      '<button class="up-item" data-p="set">' + icon('gear') + '系统设置</button>' +
      '<button class="up-item" data-p="portal">' + icon('home') + '返回门户首页</button>' +
      '<div class="up-sep"></div>' +
      '<button class="up-item danger" data-p="out">' + icon('logout') + '退出登录</button>',
      function (pop, close) {
        $$('[data-p]', pop).forEach(function (b) {
          b.onclick = function () {
            close();
            var k = b.dataset.p;
            if (k === 'me') {
              U.modal({
                title: '个人信息',
                body: '<div class="dl"><b>姓名</b><span>' + esc(me.name) + '</span></div>' +
                  '<div class="dl"><b>账号</b><span>' + esc(me.username) + '</span></div>' +
                  '<div class="dl"><b>角色</b><span>' + esc(me.role) + '</span></div>' +
                  '<div class="dl"><b>所属</b><span>' + esc(S.farms()[0].name) + '</span></div>' +
                  '<div class="dl"><b>登录时间</b><span>' + esc(me.at) + '</span></div>' +
                  '<div class="dl"><b>权限</b><span>' + (me.role === '超级管理员' ? '全部功能，含账号与数据管理' : '可录入与处理业务数据') + '</span></div>',
                actions: [{ text: '关闭', primary: true }]
              });
            } else if (k === 'set') go('settings');
            else if (k === 'theme') {
              var sm = S.db().settings;
              sm.theme = sm.theme === 'dark' ? 'light' : 'dark';
              S.save(); applyTheme(); render(true);
            } else if (k === 'portal') location.href = 'index.html';
            else if (k === 'out') {
              U.confirm('确定退出登录？').then(function (ok) { if (ok) { S.logout(); location.replace('index.html'); } });
            }
          };
        });
      }, { width: 272 });
  };

  /* ================= 实时刷新 ================= */
  function scheduleTick() {
    setTimeout(function () {
      if (S.db().settings.sim && !document.hidden && !U.hasOverlay()) {
        var b = S.tick();
        if (b.length) {
          addBreaches(b);
          if (st.page === 'overview' || st.page === 'alerts') render(true);
        } else {
          if (st.page === 'alerts' && $('#envGrid')) {
            $('#envGrid').innerHTML = envCards();
            bindEnvGrid($('#envGrid'));
          }
        }
      }
      scheduleTick();
    }, 8000);
  }

  /* ================= 启动 ================= */
  applyTheme(); paintLive(); paintNav(); paintUser();
  window.addEventListener('hashchange', route);
  scheduleTick();
  setTimeout(function () { route(); }, 30);
  setTimeout(function () { U.toast('欢迎回来，' + me.name + '（' + me.role + '）', 'ok', 1800); }, 500);
})(window);
