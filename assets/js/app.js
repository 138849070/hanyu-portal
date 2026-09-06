/* ================= 控制台：路由 + 7 个功能页 ================= */
(function (global) {
  'use strict';
  var S = HY.store, U = HY.ui, C = HY.charts;
  var icon = U.icon, esc = U.esc, F = S.fmt;
  var $ = function(s, r){ return (r||document).querySelector(s); };
  var $$ = function(s, r){ return [].slice.call((r||document).querySelectorAll(s)); };
  var d = function(){ return S.data; };

  /* ---------- 登录守卫 ---------- */
  var me = S.sessionGet();
  if (!me){ location.replace('index.html?need=1'); return; }

  function may(lv){ return lv === 'admin' ? me.role === '超级管理员' : me.role !== '访客'; }
  function guard(lv){
    if (may(lv)) return true;
    U.toast(lv === 'admin' ? '该操作仅超级管理员可用' : '当前账号无此操作权限，请联系场长或超级管理员', 'warn', 3200);
    return false;
  }

  var NAV = [
    { key:'overview',  name:'总览',     ico:'home' },
    { key:'monitor',   name:'视频监控', ico:'cam' },
    { key:'farms',     name:'鹅场管理', ico:'building' },
    { key:'alerts',    name:'监测预警', ico:'radar', badge:function(){ return S.pending(); } },
    { key:'mortality', name:'死淘记录', ico:'clipboard' },
    { key:'evidence',  name:'保险存证', ico:'shield' },
    { key:'devices',   name:'设备管理', ico:'cpu' },
    { key:'reports',   name:'数据报表', ico:'chart' },
    { key:'settings',  name:'系统设置', ico:'gear' }
  ];
  var ACCENTS = [['#7a5af8','#a78bfa'],['#2e90fa','#7cc4fd'],['#12b76a','#6ce9a6'],['#f79009','#fdb022'],['#f04438','#fda29b']];

  var st = {
    page:'overview', trendDays:30, shareDays:30,
    farms:{ tab:'houses', q:'', farm:'', status:'', page:1 },
    al:{ q:'', type:'', status:'', house:'', page:1, sel:{} },
    mo:{ q:'', house:'', cause:'', page:1 },
    ev:{ q:'', type:'', status:'', page:1 },
    rep:{ from:F.dstr(F.day(-29)), to:F.dstr(new Date()), farm:'' },
    set:{ tab:'th' }
  };

  /* ================= 公共片段 ================= */
  function kpiCard(o){
    return '<button class="kpi ' + (o.tone||'') + '" data-go="' + o.go + '">' +
      '<span class="kpi-ico">' + icon(o.ico) + '</span><span class="kpi-b">' +
      '<span>' + o.label + '</span>' +
      '<span class="kpi-v">' + o.value + (o.unit?'<small>'+o.unit+'</small>':'') + '</span>' +
      '<span class="kpi-s">' + o.sub + '</span></span></button>';
  }
  function stBadge(s){
    var m = { '待处理':'danger', '已处理':'ok', '已忽略':'gray', '在养':'ok', '空舍':'gray',
      '消毒中':'warn', '已上链':'ok', '待确认':'warn', '启用':'ok', '禁用':'gray' };
    return '<i class="badge badge-' + (m[s]||'info') + '">' + esc(s) + '</i>';
  }
  function typeTag(t){
    return '<span class="badge" style="background:' + S.TYPE_COLOR[t] + '1f;color:' + S.TYPE_COLOR[t] + '">' + esc(t) + '</span>';
  }
  function unit(t){ return t === '温度异常' ? '℃' : t === '湿度异常' ? '%' : t === '氨气浓度高' ? 'ppm' : t === '通风异常' ? 'm/s' : ''; }
  function houseOptions(all){
    return [{ value:'', text: all || '全部鹅舍' }].concat(
      d().houses.map(function(h){ return { value:h.code, text:'鹅舍' + h.code }; }));
  }
  function farmOptions(all){
    return [{ value:'', text: all || '全部鹅场' }].concat(
      d().farms.map(function(f){ return { value:f.id, text:f.name }; }));
  }

  /* ================= 弹窗：预警详情 ================= */
  function alertDrawer(a){
    var h = S.house(a.houseCode) || {};
    U.drawer({
      title:'预警详情 · 鹅舍' + a.houseCode,
      rows:[
        ['预警时间', a.ts], ['鹅舍', '鹅舍' + a.houseCode],
        ['所属鹅场', S.farm(h.farmId).name], ['异常类型', typeTag(a.type), 1],
        ['实测值', a.value + unit(a.type)], ['预警级别', a.level + '级'],
        ['影响数量', a.count + ' 只'], ['当前状态', stBadge(a.status), 1],
        ['处理人', a.handler || '—'], ['处理时间', a.handledAt || '—'],
        ['处理备注', a.remark || '—'], ['饲养员', h.keeper || '—']
      ],
      actions: a.status === '待处理' ? [
        { text:'忽略', onClick:function(api){ if (!guard()) return; S.handleAlert(a.id, '已忽略', '经核实为传感器抖动', me.name); api.close(); U.toast('已忽略该预警','ok'); } },
        { text:'标记已处理', primary:true, onClick:function(api){ api.close(); handleModal([a.id]); } }
      ] : [
        { text:'生成保险存证', onClick:function(api){
            if (!guard()) return;
            S.addEv({ type:'环境存证', houseCode:a.houseCode, count:a.count, policy:'PICC-HLJ-2026-3000' });
            api.close(); U.toast('已生成存证，可在「保险存证」查看','ok');
          } },
        { text:'关闭', primary:true }
      ]
    });
  }
  function handleModal(ids){
    if (!guard()) return;
    var fs = [
      { name:'remark', label:'处理措施', type:'textarea', required:true, col2:true,
        placeholder:'例如：已开启热风炉，加铺垫料，2 小时后复测' },
      { name:'handler', label:'处理人', value:me.name, required:true, col2:true }
    ];
    U.modal({
      title:'处理预警（' + ids.length + ' 条）',
      body:U.formHtml(fs, true),
      actions:[
        { text:'取消' },
        { text:'确认处理', primary:true, onClick:function(api){
            var v = U.formCheck(api.body, fs); if (!v) return;
            S.handleAlert(ids, '已处理', v.remark, v.handler);
            st.al.sel = {}; api.close(); U.toast('已处理 ' + ids.length + ' 条预警','ok');
          } }
      ]
    });
  }

  /* ================= 弹窗：鹅舍 / 鹅场 / 死淘 / 存证 / 用户 ================= */
  function houseModal(h){
    if (!guard()) return;
    var edit = !!h; h = h || { status:'在养', batch:'2026-B0' + (Math.floor(Math.random()*3)+1) };
    var fs = [
      { name:'code', label:'鹅舍编号', required:true, value:h.code, placeholder:'如 A-10', col2:false,
        rule:{ re:/^[A-Za-z]-?\d{1,3}$/, msg:'格式如 A-10' } },
      { name:'farmId', label:'所属鹅场', type:'select', value:h.farmId || d().farms[0].id,
        options:d().farms.map(function(f){ return { value:f.id, text:f.name }; }) },
      { name:'batch', label:'批次号', required:true, value:h.batch },
      { name:'breed', label:'品种', type:'select', value:h.breed || S.BREEDS[0], options:S.BREEDS },
      { name:'stock', label:'在栏数量（只）', type:'number', required:true, min:0, max:20000, value:h.stock==null?'':h.stock },
      { name:'area', label:'舍内面积（㎡）', type:'number', min:0, max:5000, value:h.area || 400 },
      { name:'inDate', label:'入栏日期', type:'date', value:h.inDate || F.dstr(new Date()) },
      { name:'keeper', label:'饲养员', required:true, value:h.keeper },
      { name:'status', label:'状态', type:'select', value:h.status, options:['在养','空舍','消毒中'] }
    ];
    U.modal({
      title: edit ? '编辑鹅舍 ' + h.code : '新增鹅舍', size:'lg',
      body:U.formHtml(fs, true),
      actions:[{ text:'取消' }, { text:'保存', primary:true, onClick:function(api){
        var v = U.formCheck(api.body, fs); if (!v) return;
        v.code = v.code.toUpperCase();
        var dup = d().houses.filter(function(x){ return x.code === v.code && x.id !== h.id; });
        if (dup.length){ U.toast('鹅舍编号已存在','err'); return; }
        if (v.status !== '在养') v.stock = 0;
        S.saveHouse(Object.assign({ id:h.id }, v));
        api.close(); U.toast(edit ? '已保存鹅舍信息' : '鹅舍已创建','ok');
      } }]
    });
  }
  function farmModal(f){
    if (!guard()) return;
    var edit = !!f; f = f || {};
    var fs = [
      { name:'name', label:'鹅场名称', required:true, value:f.name, col2:true },
      { name:'region', label:'所在区域', required:true, value:f.region, placeholder:'省 · 市 · 区县', col2:true },
      { name:'manager', label:'负责人', required:true, value:f.manager },
      { name:'phone', label:'联系电话', required:true, value:f.phone },
      { name:'address', label:'详细地址', value:f.address, col2:true }
    ];
    U.modal({
      title: edit ? '编辑鹅场' : '新增鹅场',
      body:U.formHtml(fs, true),
      actions:[{ text:'取消' }, { text:'保存', primary:true, onClick:function(api){
        var v = U.formCheck(api.body, fs); if (!v) return;
        S.saveFarm(Object.assign({ id:f.id }, v));
        api.close(); U.toast('已保存鹅场档案','ok');
      } }]
    });
  }
  function mortModal(m, presetHouse){
    if (!guard()) return;
    var edit = !!m; m = m || {};
    var codes = S.activeCodes();
    var fs = [
      { name:'date', label:'发生日期', type:'date', required:true, value:m.date || F.dstr(new Date()) },
      { name:'houseCode', label:'鹅舍', type:'select', value:m.houseCode || presetHouse || codes[0],
        options:codes.map(function(c){ return { value:c, text:'鹅舍' + c }; }) },
      { name:'count', label:'死淘数量（只）', type:'number', required:true, min:1, max:2000, value:m.count || 1 },
      { name:'cause', label:'死淘原因', type:'select', value:m.cause || S.CAUSES[0], options:S.CAUSES },
      { name:'disposal', label:'处置方式', type:'select', value:m.disposal || S.DISPOSAL[0], options:S.DISPOSAL },
      { name:'reporter', label:'上报人', required:true, value:m.reporter || me.name },
      { name:'remark', label:'备注', type:'textarea', value:m.remark, col2:true, placeholder:'症状、发现时间、已采取措施等' }
    ];
    U.modal({
      title: edit ? '编辑死淘记录' : '登记死淘', size:'lg',
      body:U.formHtml(fs, true) + '<p class="mini-note">保存后会自动扣减该鹅舍在栏数量，并重算累计死淘率。</p>',
      actions:[{ text:'取消' }, { text:'保存', primary:true, onClick:function(api){
        var v = U.formCheck(api.body, fs); if (!v) return;
        var r = S.saveMort(Object.assign({ id:m.id }, v));
        if (!r.ok){ U.toast(r.msg, 'err'); return; }
        api.close(); U.toast(edit ? '记录已更新' : '死淘已登记，在栏数量已扣减','ok');
      } }]
    });
  }
  function evModal(){
    if (!guard()) return;
    var codes = S.activeCodes();
    var fs = [
      { name:'type', label:'存证类型', type:'select', options:['死淘存证','环境存证','理赔存证'] },
      { name:'houseCode', label:'鹅舍', type:'select', options:codes.map(function(c){ return { value:c, text:'鹅舍' + c }; }) },
      { name:'count', label:'涉及数量（只）', type:'number', min:0, max:5000, value:0 },
      { name:'policy', label:'保单号', required:true, value:'PICC-HLJ-2026-3128' }
    ];
    U.modal({
      title:'新增保险存证',
      body:U.formHtml(fs, true) + '<p class="mini-note">系统会为本次存证生成唯一数据指纹（演示用非密码学哈希）。</p>',
      actions:[{ text:'取消' }, { text:'生成存证', primary:true, onClick:function(api){
        var v = U.formCheck(api.body, fs); if (!v) return;
        var e = S.addEv(v);
        api.close(); U.toast('存证 ' + e.no + ' 已生成，待确认上链','ok');
      } }]
    });
  }
  function userModal(u){
    if (!guard('admin')) return;
    var edit = !!u; u = u || { role:'饲养员', status:'启用' };
    var fs = [
      { name:'username', label:'登录账号', required:true, value:u.username, disabled:edit,
        rule:{ re:/^[a-zA-Z0-9_]{3,16}$/, msg:'3-16 位字母数字下划线' } },
      { name:'name', label:'姓名', required:true, value:u.name },
      { name:'pwd', label:'密码', required:true, value:u.pwd || '123456' },
      { name:'phone', label:'手机号', value:u.phone || '' },
      { name:'role', label:'角色', type:'select', value:u.role, options:['超级管理员','场长','兽医','饲养员'] },
      { name:'status', label:'状态', type:'select', value:u.status, options:['启用','禁用'] }
    ];
    U.modal({
      title: edit ? '编辑账号' : '新增账号', size:'lg',
      body:U.formHtml(fs, true),
      actions:[{ text:'取消' }, { text:'保存', primary:true, onClick:function(api){
        var v = U.formCheck(api.body, fs); if (!v) return;
        if (edit) v.username = u.username;
        var r = S.saveUser(Object.assign({ id:u.id }, v));
        if (!r.ok){ U.toast(r.msg,'err'); return; }
        api.close(); U.toast('账号已保存','ok');
      } }]
    });
  }

  /* ================= 页面：总览 ================= */
  var PAGES = {};
  PAGES.overview = {
    title:'总览', sub:'在栏、预警、死淘与存证的实时全景',
    act:function(){
      return '<button class="btn btn-line btn-sm" data-a="tick">' + icon('refresh') + '手动巡检一次</button>' +
             '<button class="btn btn-primary btn-sm" data-a="mort">' + icon('plus') + '登记死淘</button>';
    },
    html:function(){
      var k = S.kpi(), t = S.trend(st.trendDays), last = d().alerts.slice(0, 5);
      return '<div class="kpi-row">' +
        kpiCard({ go:'farms', ico:'goose', label:'在栏数量', value:F.num(k.stock), unit:'只',
          sub:'在养鹅舍 <b>' + k.activeHouses + '</b> 栋 · 共 ' + d().houses.length + ' 栋' }) +
        kpiCard({ go:'alerts', tone:'warn', ico:'bell', label:'今日预警', value:k.todayAlert, unit:'条',
          sub:'待处理 <b class="up">' + k.todayPending + '</b> 条' }) +
        kpiCard({ go:'mortality', ico:'trend', label:'累计死淘率', value:k.cum, unit:'%',
          sub:'累计死淘 <b>' + F.num(k.deaths) + '</b> 只 · 近7日 +' + k.cum7 + '%' }) +
        kpiCard({ go:'evidence', tone:'info', ico:'box', label:'保险存证', value:F.num(k.ev), unit:'条',
          sub:'本月新增 <b class="dn">+' + k.evMonth + '</b> 条' }) +
      '</div>' +
      '<div class="grid g-2-1">' +
        '<section class="card"><div class="card-hd"><h3>近' + st.trendDays + '天死淘趋势</h3>' +
          '<div class="card-act"><span class="mini-note">柱=日死淘数，线=累计死淘率</span>' +
          '<div class="seg" role="tablist">' + [7,30,90].map(function(n){
            return '<button data-days="' + n + '"' + (n===st.trendDays?' class="on"':'') + '>近' + n + '天</button>';
          }).join('') + '</div></div></div>' +
          '<div class="chart" id="cTrend" style="height:280px"></div></section>' +
        '<section class="card"><div class="card-hd"><h3>环境异常类型占比</h3>' +
          '<span class="mini-note">近' + st.shareDays + '天</span></div>' +
          '<div class="chart" id="cShare" style="height:280px"></div></section>' +
      '</div>' +
      '<section class="card"><div class="card-hd"><h3>最新预警记录</h3>' +
        '<div class="card-act"><button class="btn btn-line btn-sm" data-a="more">查看全部' + icon('search') + '</button></div></div>' +
        U.table({
          columns:[
            { title:'时间', key:'ts' },
            { title:'鹅舍', render:function(r){ return '<span class="cell-strong">鹅舍' + esc(r.houseCode) + '</span>'; } },
            { title:'类型', render:function(r){ return typeTag(r.type); } },
            { title:'实测值', align:'right', render:function(r){ return '<span class="num">' + r.value + unit(r.type) + '</span>'; } },
            { title:'数量', align:'right', render:function(r){ return '<span class="num">' + r.count + '只</span>'; } },
            { title:'处理状态', align:'center', render:function(r){ return stBadge(r.status); } },
            { title:'操作', align:'center', render:function(r){
                return '<div class="row-act"><button class="btn btn-sm btn-ghost" data-view="' + r.id + '">详情</button>' +
                  (r.status === '待处理' ? '<button class="btn btn-sm btn-primary" data-do="' + r.id + '">处理</button>' : '') + '</div>';
              } }
          ],
          rows:last, empty:'今日暂无预警，一切正常'
        }) + '</section>';
    },
    mount:function(root){
      var t = S.trend(st.trendDays);
      C.combo($('#cTrend', root), {
        labels:t.labels, height:280, lUnit:'只', rUnit:'%',
        xFmt:function(s){ return s.slice(5); },
        series:[
          { name:'日死淘数', type:'bar', axis:'l', color:'#34d399', data:t.daily, unit:' 只' },
          { name:'累计死淘率', type:'line', axis:'r', color:'#7a5af8', data:t.cum, unit:'%' }
        ]
      });
      C.donut($('#cShare', root), { items:S.share(st.shareDays), height:280, unit:' 起' });
      $$('[data-days]', root).forEach(function(b){
        b.onclick = function(){ st.trendDays = +b.dataset.days; render(true); };
      });
      $$('[data-go]', root).forEach(function(b){ b.onclick = function(){ go(b.dataset.go); }; });
      var more = $('[data-a="more"]', root); if (more) more.onclick = function(){ go('alerts'); };
      $('[data-a="mort"]', root).onclick = function(){ mortModal(); };
      $('[data-a="tick"]', root).onclick = function(){
        var c = S.tick(true);
        U.toast(c.length ? '巡检完成，新增 ' + c.length + ' 条预警' : '巡检完成，各鹅舍指标正常', c.length ? 'warn' : 'ok');
        render(true);
      };
      bindAlertRows(root);
    }
  };
  function bindAlertRows(root){
    $$('[data-view]', root).forEach(function(b){
      b.onclick = function(e){
        e.stopPropagation();
        var a = d().alerts.filter(function(x){ return x.id === b.dataset.view; })[0];
        if (a) alertDrawer(a);
      };
    });
    $$('[data-do]', root).forEach(function(b){
      b.onclick = function(e){ e.stopPropagation(); handleModal([b.dataset.do]); };
    });
  }

  /* ================= 页面：视频监控 ================= */
  PAGES.monitor = {
    title: '视频监控', sub: '鹅舍监控通道与 AI 识别联动',
    act: function () { return '<button class="btn btn-line btn-sm" data-a="refresh">' + U.icon('refresh') + '刷新通道</button>'; },
    html: function () {
      var ms = st.mon || (st.mon = { farm: '', status: '全部' });
      var farms = S.farms();
      var all = S.cams();
      var list = all.filter(function (c) {
        if (ms.farm && c.farmId !== ms.farm) return false;
        if (ms.status === '在线' && !c.online) return false;
        if (ms.status === '离线' && c.online) return false;
        return true;
      });
      var cs = S.camStats();
      var now = S.util.tstr(new Date());
      var farmSel = '<option value="">全部鹅场</option>' + farms.map(function (f) {
        return '<option value="' + f.id + '"' + (ms.farm === f.id ? ' selected' : '') + '>' + f.name + '</option>';
      }).join('');
      return '<div class="stat-strip">' +
        '<div class="stat"><span>监控通道</span><b>' + cs.total + ' 路</b></div>' +
        '<div class="stat"><span>在线</span><b style="color:var(--ok)">' + cs.on + ' 路</b></div>' +
        '<div class="stat"><span>离线</span><b style="color:var(--danger)">' + cs.off + ' 路</b></div>' +
        '<div class="stat"><span>AI 识别中</span><b style="color:var(--warn)">' + cs.ai + ' 路</b></div>' +
      '</div>' +
      '<div class="mv-tool">' +
        '<select class="input" id="mvFarm" style="width:auto;min-width:170px">' + farmSel + '</select>' +
        '<div class="chips" id="mvStatus" style="margin:0">' +
          '<span class="chip' + (ms.status === '全部' ? ' on' : '') + '" data-s="全部">全部</span>' +
          '<span class="chip' + (ms.status === '在线' ? ' on' : '') + '" data-s="在线">在线</span>' +
          '<span class="chip' + (ms.status === '离线' ? ' on' : '') + '" data-s="离线">离线</span>' +
        '</div>' +
        '<div class="toolbar-r mini-note">当前显示 ' + list.length + ' 路 · 最后更新 ' + now + '</div>' +
      '</div>' +
      '<div class="mv-grid">' + (list.length ? list.map(function (c) {
        var feed = c.photo
          ? '<img class="mv-img" src="' + c.photo + '" alt="' + c.id + '">'
          : '<div class="mv-bg"></div><div class="mv-grid2"></div><div class="mv-scan"></div><div class="mv-lens"></div>';
        var det = '';
        if (c.detect) {
          det = '<div class="mv-detect" style="left:24%;top:28%;width:44%;height:42%"><span class="mv-detect-t">' + c.detect.label + ' ' + c.detect.score + '</span></div>';
        }
        return '<article class="mv-card" data-cam="' + c.id + '">' +
          '<div class="mv-video">' + feed +
            '<span class="mv-tag">' + c.id + ' · ' + c.zone + '</span>' +
            '<span class="mv-rec' + (c.online ? '' : ' off') + '"><i class="d"></i>' + (c.online ? 'REC' : '离线') + '</span>' +
            det +
            '<span class="mv-time"><i>鹅舍' + c.houseCode + '</i><i>' + now.slice(11) + '</i></span>' +
          '</div>' +
          '<div class="mv-meta"><b>鹅舍' + c.houseCode + '</b><span class="z">' + (c.batch || '') + ' · ' + c.res + ' · ' + c.fps + 'fps</span>' +
          (c.detect ? '<span class="badge badge-danger">AI 异常</span>' : '<span class="badge badge-ok">' + (c.online ? '正常' : '离线') + '</span>') + '</div>' +
        '</article>';
      }).join('') : '<div class="card empty">没有符合条件的监控通道</div>') + '</div>';
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
  function openCamPlayer(id) {
    var c = S.cams().filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    var feed = c.photo
      ? '<img class="mv-img" src="' + c.photo + '" style="width:100%;height:100%;object-fit:cover" alt="">'
      : '<div class="mv-bg"></div><div class="mv-grid2"></div><div class="mv-scan"></div><div class="mv-lens"></div>';
    var det = '';
    if (c.detect) det = '<div class="mv-detect" style="left:24%;top:26%;width:46%;height:44%"><span class="mv-detect-t">' + c.detect.label + ' ' + c.detect.score + '</span></div>';
    U.modal({
      title: c.id + ' · 鹅舍' + c.houseCode,
      size: 'lg',
      body: '<div class="mv-player">' +
        '<div class="mv-big">' + feed +
          '<span class="mv-tag">' + c.zone + '</span>' +
          '<span class="mv-rec' + (c.online ? '' : ' off') + '"><i class="d"></i>' + (c.online ? 'REC' : '离线') + '</span>' + det +
          '<span class="mv-time"><i>鹅舍' + c.houseCode + ' · 批次 ' + (c.batch || '—') + '</i><i data-live="1"></i></span>' +
        '</div>' +
        '<div class="mv-info">' +
          '<div class="dl"><b>通道编号</b><span>' + c.id + '</span></div>' +
          '<div class="dl"><b>所属鹅舍</b><span>鹅舍' + c.houseCode + '（' + c.zone + '）</span></div>' +
          '<div class="dl"><b>饲养员</b><span>' + (c.keeper || '—') + '</span></div>' +
          '<div class="dl"><b>清晰度</b><span>' + c.res + ' / ' + c.fps + 'fps</span></div>' +
          '<div class="dl"><b>运行状态</b><span>' + (c.online ? '<span class="badge badge-ok">在线</span>' : '<span class="badge badge-gray">离线</span>') + '</span></div>' +
          '<div class="dl"><b>AI 识别</b><span>' + (c.detect ? '<span class="badge badge-danger">' + c.detect.label + ' ' + c.detect.score + '</span>' : '<span class="badge badge-ok">未发现异常</span>') + '</span></div>' +
          '<div class="tip-box" style="margin-top:10px">AI 识别到异常时会自动生成预警工单并推送给饲养员，请及时到现场复核。</div>' +
        '</div></div>',
      actions: [
        { text: '抓拍', onClick: function (api) { U.toast('抓拍成功，已存入本场资料库', 'ok'); } },
        { text: '回放', onClick: function () { U.toast('录像回放服务由场区 NVR 提供，请按日期检索', 'info', 3000); } },
        { text: '关闭', primary: true }
      ]
    });
  }

  /* ================= 页面：设备管理 ================= */
  PAGES.devices = {
    title: '设备管理', sub: '摄像头、传感器与边缘网关统一运维',
    act: function () { return '<button class="btn btn-line btn-sm" data-a="csv">' + U.icon('download') + '导出台账</button>'; },
    html: function () {
      var ds = st.dev || (st.dev = { type: '', status: '全部' });
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
        '<div class="stat"><span>在线</span><b style="color:var(--ok)">' + k.on + ' 台</b></div>' +
        '<div class="stat"><span>离线</span><b style="color:var(--danger)">' + k.off + ' 台</b></div>' +
        '<div class="stat"><span>低电量</span><b style="color:var(--warn)">' + k.low + ' 台</b></div>' +
      '</div>' +
      '<div class="mv-tool">' +
        '<select class="input" id="dvType" style="width:auto;min-width:130px">' +
          '<option value="">全部类型</option>' + types.map(function (t) {
            return '<option value="' + t + '"' + (ds.type === t ? ' selected' : '') + '>' + t + '</option>';
          }).join('') +
        '</select>' +
        '<div class="chips" id="dvStatus" style="margin:0">' +
          '<span class="chip' + (ds.status === '全部' ? ' on' : '') + '" data-s="全部">全部</span>' +
          '<span class="chip' + (ds.status === '在线' ? ' on' : '') + '" data-s="在线">在线</span>' +
          '<span class="chip' + (ds.status === '离线' ? ' on' : '') + '" data-s="离线">离线</span>' +
        '</div>' +
      '</div>' +
      '<div class="card">' + U.table({
        columns: [
          { title: '设备', render: function (r) { return '<span class="cell-strong">' + U.esc(r.name) + '</span><div style="font-size:12px;color:var(--ink-3)">' + r.id + '</div>'; } },
          { title: '类型', render: function (r) { return '<span class="badge badge-brand">' + U.esc(r.type) + '</span>'; } },
          { title: '安装位置', key: 'place' },
          { title: '状态', align: 'center', render: function (r) { return r.online ? '<span class="badge badge-ok">在线</span>' : '<span class="badge badge-gray">离线</span>'; } },
          { title: '电量', align: 'right', render: function (r) { return '<span class="num">' + r.power + '%</span>'; } },
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
      $('[data-a="csv"]', root).onclick = function () {
        U.csv('设备台账_' + S.util.dstr(new Date()) + '.csv',
          ['设备', '编号', '类型', '位置', '状态', '电量', '信号', '固件', '上次维护'],
          S.devices().map(function (x) { return [x.name, x.id, x.type, x.place, x.online ? '在线' : '离线', x.power + '%', x.signal, x.ver, x.last]; }));
      };
      $$('[data-dv]', root).forEach(function (b) {
        b.onclick = function () {
          var d = S.devices().filter(function (x) { return x.id === b.dataset.dv; })[0];
          if (!d) return;
          U.drawer({
            title: d.name + ' · ' + d.id,
            rows: [
              ['设备类型', d.type], ['安装位置', d.place],
              ['运行状态', d.online ? '<span class="badge badge-ok">在线</span>' : '<span class="badge badge-gray">离线</span>', 1],
              ['电量', d.power + '%'], ['信号强度', d.signal],
              ['固件版本', d.ver], ['上次维护', d.last]
            ],
            actions: [
              { text: d.online ? '远程重启' : '设备离线', onClick: function (api) {
                  api.close();
                  U.toast('重启指令已下发，预计 30 秒内恢复', 'ok', 3000);
                } },
              { text: '切换上线/离线', kind: 'danger', onClick: function (api) {
                  S.setDev(d.id, !d.online);
                  api.close();
                  U.toast('设备状态已更新', 'ok');
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

/* ================= 页面：鹅场管理 ================= */
  PAGES.farms = {
    title:'鹅场管理', sub:'鹅场档案、鹅舍台账与批次信息',
    act:function(){
      return '<button class="btn btn-line btn-sm" data-a="csv">' + icon('download') + '导出 CSV</button>' +
        '<button class="btn btn-line btn-sm" data-a="addFarm">' + icon('plus') + '新增鹅场</button>' +
        '<button class="btn btn-primary btn-sm" data-a="addHouse">' + icon('plus') + '新增鹅舍</button>';
    },
    html:function(){
      var s = st.farms;
      var tabs = '<div class="tabs">' +
        '<button data-tab="houses"' + (s.tab==='houses'?' class="on"':'') + '>鹅舍台账（' + d().houses.length + '）</button>' +
        '<button data-tab="farms"' + (s.tab==='farms'?' class="on"':'') + '>鹅场档案（' + d().farms.length + '）</button></div>';
      if (s.tab === 'farms'){
        return tabs + '<div class="farm-grid">' + d().farms.map(function(f){
          var hs = d().houses.filter(function(h){ return h.farmId === f.id; });
          var stock = hs.reduce(function(a,h){ return a + (h.status==='在养'?h.stock:0); }, 0);
          return '<article class="farm-c"><h3>' + esc(f.name) + '</h3><p class="loc">' + icon('search') + ' ' + esc(f.region) + '</p>' +
            '<dl><div><dt>鹅舍</dt><dd>' + hs.length + ' 栋</dd></div>' +
            '<div><dt>在栏</dt><dd>' + F.num(stock) + ' 只</dd></div>' +
            '<div><dt>负责人</dt><dd style="font-size:14px">' + esc(f.manager) + '</dd></div>' +
            '<div><dt>电话</dt><dd style="font-size:14px">' + esc(f.phone) + '</dd></div></dl>' +
            '<p class="mini-note">' + esc(f.address || '—') + '</p>' +
            '<div class="row-act" style="margin-top:14px;display:flex;gap:8px">' +
            '<button class="btn btn-sm btn-line" data-ef="' + f.id + '">' + icon('edit') + '编辑</button>' +
            '<button class="btn btn-sm btn-danger" data-df="' + f.id + '">' + icon('trash') + '删除</button></div></article>';
        }).join('') + '</div>';
      }
      var rows = filterHouses();
      return tabs +
        '<div class="toolbar">' +
          '<div class="field grow"><label for="hq">搜索</label><input id="hq" value="' + esc(s.q) + '" placeholder="鹅舍编号 / 批次 / 饲养员 / 品种"></div>' +
          '<div class="field"><label for="hf">鹅场</label>' + selectHtml('hf', farmOptions(), s.farm) + '</div>' +
          '<div class="field"><label for="hs">状态</label>' + selectHtml('hs', [{value:'',text:'全部状态'},'在养','空舍','消毒中'], s.status) + '</div>' +
          '<div class="toolbar-r"><span class="mini-note">共 ' + rows.length + ' 栋，在栏 ' +
            F.num(rows.reduce(function(a,h){ return a + h.stock; }, 0)) + ' 只</span></div>' +
        '</div>' +
        '<section class="card">' + U.table({
          columns:[
            { title:'鹅舍', render:function(r){ return '<span class="cell-strong">鹅舍' + esc(r.code) + '</span>'; } },
            { title:'所属鹅场', render:function(r){ return esc(S.farm(r.farmId).name); } },
            { title:'批次', key:'batch' },
            { title:'品种', key:'breed' },
            { title:'在栏(只)', align:'right', render:function(r){ return '<span class="num">' + F.num(r.stock) + '</span>'; } },
            { title:'面积(㎡)', align:'right', render:function(r){ return '<span class="num">' + r.area + '</span>'; } },
            { title:'入栏日期', render:function(r){ return r.inDate || '—'; } },
            { title:'饲养员', key:'keeper' },
            { title:'状态', align:'center', render:function(r){ return stBadge(r.status); } },
            { title:'操作', align:'center', render:function(r){
                return '<div class="row-act">' +
                  '<button class="btn btn-sm btn-ghost" data-eh="' + r.id + '">' + icon('edit') + '编辑</button>' +
                  '<button class="btn btn-sm btn-ghost" data-mh="' + r.code + '">死淘</button>' +
                  '<button class="btn btn-sm btn-danger" data-dh="' + r.id + '">' + icon('trash') + '</button></div>';
              } }
          ],
          rows:rows, pageSize:8, page:s.page, empty:'没有符合条件的鹅舍'
        }) + '</section>';
    },
    mount:function(root){
      var s = st.farms;
      $$('[data-tab]', root).forEach(function(b){ b.onclick = function(){ s.tab = b.dataset.tab; render(); }; });
      bindInput($('#hq', root), function(v){ s.q = v; s.page = 1; render(true); });
      bindSelect($('#hf', root), function(v){ s.farm = v; s.page = 1; render(true); });
      bindSelect($('#hs', root), function(v){ s.status = v; s.page = 1; render(true); });
      bindPager(root, function(p){ s.page = p; render(true); });
      var a1 = $('[data-a="addHouse"]', root); if (a1) a1.onclick = function(){ houseModal(); };
      var a2 = $('[data-a="addFarm"]', root); if (a2) a2.onclick = function(){ farmModal(); };
      $('[data-a="csv"]', root).onclick = function(){
        U.csv('鹅舍台账_' + F.dstr(new Date()) + '.csv',
          ['鹅舍','鹅场','批次','品种','在栏数量','面积','入栏日期','饲养员','状态'],
          filterHouses().map(function(h){ return [h.code, S.farm(h.farmId).name, h.batch, h.breed, h.stock, h.area, h.inDate, h.keeper, h.status]; }));
      };
      $$('[data-eh]', root).forEach(function(b){ b.onclick = function(){
        houseModal(d().houses.filter(function(h){ return h.id === b.dataset.eh; })[0]); }; });
      $$('[data-mh]', root).forEach(function(b){ b.onclick = function(){ mortModal(null, b.dataset.mh); }; });
      $$('[data-dh]', root).forEach(function(b){ b.onclick = function(){
        if (!guard('admin')) return;
        var h = d().houses.filter(function(x){ return x.id === b.dataset.dh; })[0];
        U.confirm('确定删除「鹅舍' + h.code + '」？该鹅舍的历史预警与死淘记录会保留。').then(function(ok){
          if (ok){ S.delHouse(h.id); U.toast('鹅舍已删除','ok'); }
        });
      }; });
      $$('[data-ef]', root).forEach(function(b){ b.onclick = function(){
        farmModal(d().farms.filter(function(f){ return f.id === b.dataset.ef; })[0]); }; });
      $$('[data-df]', root).forEach(function(b){ b.onclick = function(){
        if (!guard('admin')) return;
        U.confirm('确定删除该鹅场档案？').then(function(ok){
          if (!ok) return;
          var r = S.delFarm(b.dataset.df);
          U.toast(r.ok ? '鹅场已删除' : r.msg, r.ok ? 'ok' : 'err');
        });
      }; });
    }
  };
  function filterHouses(){
    var s = st.farms, q = s.q.trim().toLowerCase();
    return d().houses.filter(function(h){
      if (s.farm && h.farmId !== s.farm) return false;
      if (s.status && h.status !== s.status) return false;
      if (!q) return true;
      return (h.code + h.batch + h.keeper + h.breed).toLowerCase().indexOf(q) > -1;
    });
  }

  /* ================= 页面：监测预警 ================= */
  PAGES.alerts = {
    title:'监测预警', sub:'鹅舍环境实时指标与预警工单处理',
    act:function(){
      return '<button class="btn btn-line btn-sm" data-a="tick">' + icon('refresh') + '立即巡检</button>' +
        '<button class="btn btn-line btn-sm" data-a="csv">' + icon('download') + '导出 CSV</button>' +
        '<button class="btn btn-primary btn-sm" data-a="batch">' + icon('check') + '批量处理</button>';
    },
    html:function(){
      var s = st.al, rows = filterAlerts(), th = d().settings.th;
      return '<section class="card" style="margin-bottom:16px"><div class="card-hd"><h3>鹅舍环境实况</h3>' +
        '<span class="mini-note">阈值：温度 ' + th.tempMin + '~' + th.tempMax + '℃ · 湿度 ' + th.humMin + '~' + th.humMax +
        '% · 氨气 ≤' + th.nh3Max + 'ppm · 风速 ' + th.windMin + '~' + th.windMax + 'm/s（可在系统设置修改）</span></div>' +
        '<div class="env-grid" id="envGrid">' + envCards() + '</div></section>' +
        '<div class="toolbar">' +
          '<div class="field grow"><label for="aq">搜索</label><input id="aq" value="' + esc(s.q) + '" placeholder="鹅舍 / 处理人 / 备注"></div>' +
          '<div class="field"><label for="at">类型</label>' + selectHtml('at', [{value:'',text:'全部类型'}].concat(S.TYPES), s.type) + '</div>' +
          '<div class="field"><label for="as">状态</label>' + selectHtml('as', [{value:'',text:'全部状态'},'待处理','已处理','已忽略'], s.status) + '</div>' +
          '<div class="field"><label for="ah">鹅舍</label>' + selectHtml('ah', houseOptions(), s.house) + '</div>' +
          '<div class="toolbar-r"><span class="mini-note">共 ' + rows.length + ' 条，待处理 ' +
            rows.filter(function(a){ return a.status==='待处理'; }).length + ' 条</span></div>' +
        '</div>' +
        '<section class="card">' + U.table({
          selectable:true, selected:s.sel,
          columns:[
            { title:'时间', key:'ts' },
            { title:'鹅舍', render:function(r){ return '<span class="cell-strong">鹅舍' + esc(r.houseCode) + '</span>'; } },
            { title:'类型', render:function(r){ return typeTag(r.type); } },
            { title:'实测值', align:'right', render:function(r){ return '<span class="num">' + r.value + unit(r.type) + '</span>'; } },
            { title:'级别', align:'center', render:function(r){
                return '<i class="badge badge-' + (r.level==='高'?'danger':r.level==='中'?'warn':'gray') + '">' + r.level + '级</i>'; } },
            { title:'数量', align:'right', render:function(r){ return '<span class="num">' + r.count + '只</span>'; } },
            { title:'处理人', render:function(r){ return r.handler || '—'; } },
            { title:'状态', align:'center', render:function(r){ return stBadge(r.status); } },
            { title:'操作', align:'center', render:function(r){
                return '<div class="row-act"><button class="btn btn-sm btn-ghost" data-view="' + r.id + '">详情</button>' +
                  (r.status==='待处理' ? '<button class="btn btn-sm btn-primary" data-do="' + r.id + '">处理</button>' : '') + '</div>'; } }
          ],
          rows:rows, pageSize:10, page:s.page, empty:'没有符合条件的预警'
        }) + '</section>';
    },
    mount:function(root){
      var s = st.al;
      bindInput($('#aq', root), function(v){ s.q = v; s.page = 1; render(true); });
      bindSelect($('#at', root), function(v){ s.type = v; s.page = 1; render(true); });
      bindSelect($('#as', root), function(v){ s.status = v; s.page = 1; render(true); });
      bindSelect($('#ah', root), function(v){ s.house = v; s.page = 1; render(true); });
      bindPager(root, function(p){ s.page = p; render(true); });
      bindAlertRows(root);
      bindEnvCards(root);
      $$('[data-check]', root).forEach(function(c){
        c.onchange = function(){ if (c.checked) s.sel[c.dataset.check] = 1; else delete s.sel[c.dataset.check]; };
      });
      var all = $('[data-check-all]', root);
      if (all) all.onchange = function(){
        $$('[data-check]', root).forEach(function(c){
          c.checked = all.checked;
          if (all.checked) s.sel[c.dataset.check] = 1; else delete s.sel[c.dataset.check];
        });
      };
      $('[data-a="batch"]', root).onclick = function(){
        var ids = Object.keys(s.sel).filter(function(id){
          var a = d().alerts.filter(function(x){ return x.id === id; })[0];
          return a && a.status === '待处理';
        });
        if (!ids.length){ U.toast('请先勾选待处理的预警','warn'); return; }
        handleModal(ids);
      };
      $('[data-a="tick"]', root).onclick = function(){
        var c = S.tick(true);
        U.toast(c.length ? '巡检完成，新增 ' + c.length + ' 条预警' : '巡检完成，指标全部正常', c.length?'warn':'ok');
        render(true);
      };
      $('[data-a="csv"]', root).onclick = function(){
        U.csv('预警记录_' + F.dstr(new Date()) + '.csv',
          ['时间','鹅舍','类型','实测值','级别','数量','状态','处理人','处理时间','备注'],
          filterAlerts().map(function(a){ return [a.ts, a.houseCode, a.type, a.value + unit(a.type), a.level, a.count, a.status, a.handler, a.handledAt, a.remark]; }));
      };
    }
  };
  function filterAlerts(){
    var s = st.al, q = s.q.trim().toLowerCase();
    return d().alerts.filter(function(a){
      if (s.type && a.type !== s.type) return false;
      if (s.status && a.status !== s.status) return false;
      if (s.house && a.houseCode !== s.house) return false;
      if (!q) return true;
      return (a.houseCode + a.handler + a.remark).toLowerCase().indexOf(q) > -1;
    });
  }
  function envCards(){
    var th = d().settings.th;
    return d().houses.filter(function(h){ return h.status === '在养'; }).map(function(h){
      var e = d().envs[h.code] || { temp:0, hum:0, nh3:0, wind:0, hist:[0,0], ts:'-' };
      var badT = e.temp < th.tempMin || e.temp > th.tempMax;
      var badH = e.hum < th.humMin || e.hum > th.humMax;
      var badN = e.nh3 > th.nh3Max;
      var badW = e.wind < th.windMin || e.wind > th.windMax;
      var bad = badT || badH || badN || badW;
      return '<article class="env' + (bad?' bad':'') + '" data-env="' + h.code + '" tabindex="0">' +
        '<div class="env-hd"><b>鹅舍' + h.code + '</b>' +
        (bad ? '<i class="badge badge-danger">异常</i>' : '<i class="badge badge-ok">正常</i>') + '</div>' +
        '<div class="env-m">' +
          '<div><span>温度</span><b class="' + (badT ? (e.temp < th.tempMin ? 'cold':'hot') : '') + '">' + e.temp + '<small>℃</small></b></div>' +
          '<div><span>湿度</span><b class="' + (badH?'hot':'') + '">' + e.hum + '<small>%</small></b></div>' +
          '<div><span>氨气</span><b class="' + (badN?'hot':'') + '">' + e.nh3 + '<small>ppm</small></b></div>' +
          '<div><span>风速</span><b class="' + (badW?'hot':'') + '">' + e.wind + '<small>m/s</small></b></div>' +
        '</div>' +
        '<div class="env-ft"><span>' + esc(h.keeper) + ' · ' + e.ts.slice(11) + '</span>' +
        '<span class="spark-box" data-spark="' + h.code + '"></span></div></article>';
    }).join('') || '<div class="empty"><span>🏚️</span>暂无在养鹅舍</div>';
  }
  function bindEnvCards(root){
    $$('[data-spark]', root).forEach(function(b){
      var e = d().envs[b.dataset.spark];
      if (e && e.hist && e.hist.length > 1) C.spark(b, e.hist, '#7a5af8');
    });
    $$('[data-env]', root).forEach(function(c){
      function open(){
        var code = c.dataset.env, h = S.house(code), e = d().envs[code], th = d().settings.th;
        U.drawer({
          title:'鹅舍' + code + ' 环境详情',
          rows:[
            ['所属鹅场', S.farm(h.farmId).name], ['批次 / 品种', h.batch + ' · ' + h.breed],
            ['在栏数量', F.num(h.stock) + ' 只'], ['饲养员', h.keeper],
            ['温度', e.temp + ' ℃（阈值 ' + th.tempMin + '~' + th.tempMax + '）'],
            ['湿度', e.hum + ' %（阈值 ' + th.humMin + '~' + th.humMax + '）'],
            ['氨气浓度', e.nh3 + ' ppm（阈值 ≤' + th.nh3Max + '）'],
            ['风速', e.wind + ' m/s（阈值 ' + th.windMin + '~' + th.windMax + '）'],
            ['最后上报', e.ts]
          ],
          html:'<div class="card" style="margin-top:12px;box-shadow:none"><div class="card-hd"><h3>近 24 次温度采样</h3></div>' +
            '<div class="chart" id="dTemp" style="height:180px"></div></div>',
          onMount:function(body){
            C.combo($('#dTemp', body), {
              labels:e.hist.map(function(_, i){ return 'T-' + (e.hist.length - i); }),
              height:180, lUnit:'℃', xTickEvery:6,
              series:[{ name:'温度', type:'line', color:'#7a5af8', data:e.hist.slice(), unit:'℃' }]
            });
          },
          actions:[
            { text:'登记死淘', onClick:function(api){ api.close(); mortModal(null, code); } },
            { text:'关闭', primary:true }
          ]
        });
      }
      c.onclick = open;
      c.onkeydown = function(e){ if (e.key === 'Enter'){ open(); } };
    });
  }

  /* ================= 页面：死淘记录 ================= */
  PAGES.mortality = {
    title:'死淘记录', sub:'逐条登记、原因分析与在栏自动核减',
    act:function(){
      return '<button class="btn btn-line btn-sm" data-a="csv">' + icon('download') + '导出 CSV</button>' +
        '<button class="btn btn-primary btn-sm" data-a="add">' + icon('plus') + '登记死淘</button>';
    },
    html:function(){
      var s = st.mo, rows = filterMort(), k = S.kpi();
      var ym = F.dstr(new Date()).slice(0, 7);
      var mCount = d().mortality.filter(function(m){ return m.date.slice(0,7) === ym; }).reduce(function(a,m){ return a + m.count; }, 0);
      var w7 = d().mortality.filter(function(m){ return m.date > F.dstr(F.day(-7)); }).reduce(function(a,m){ return a + m.count; }, 0);
      var cause = {}; S.CAUSES.forEach(function(c){ cause[c] = 0; });
      rows.forEach(function(m){ cause[m.cause] = (cause[m.cause]||0) + m.count; });
      var t = S.trend(30, s.house);
      return '<div class="stat-strip">' +
          '<div class="stat"><span>本月死淘</span><b>' + F.num(mCount) + ' 只</b></div>' +
          '<div class="stat"><span>近 7 日死淘</span><b>' + F.num(w7) + ' 只</b></div>' +
          '<div class="stat"><span>累计死淘率</span><b>' + k.cum + ' %</b></div>' +
          '<div class="stat"><span>累计死淘 / 上报次数</span><b>' + F.num(k.deaths) + ' 只 / ' + d().mortality.length + ' 次</b></div>' +
        '</div>' +
        '<div class="grid g-2-1">' +
          '<section class="card"><div class="card-hd"><h3>近30天死淘趋势' + (s.house ? '（鹅舍' + s.house + '）' : '') + '</h3></div>' +
            '<div class="chart" id="mTrend" style="height:250px"></div></section>' +
          '<section class="card"><div class="card-hd"><h3>死淘原因构成</h3><span class="mini-note">按当前筛选</span></div>' +
            '<div id="mCause"></div></section>' +
        '</div>' +
        '<div class="toolbar">' +
          '<div class="field grow"><label for="mq">搜索</label><input id="mq" value="' + esc(s.q) + '" placeholder="鹅舍 / 上报人 / 备注"></div>' +
          '<div class="field"><label for="mh">鹅舍</label>' + selectHtml('mh', houseOptions(), s.house) + '</div>' +
          '<div class="field"><label for="mc">原因</label>' + selectHtml('mc', [{value:'',text:'全部原因'}].concat(S.CAUSES), s.cause) + '</div>' +
          '<div class="toolbar-r"><span class="mini-note">筛选结果 ' + rows.length + ' 条 / ' +
            F.num(rows.reduce(function(a,m){ return a + m.count; }, 0)) + ' 只</span></div>' +
        '</div>' +
        '<section class="card">' + U.table({
          columns:[
            { title:'日期', key:'date' },
            { title:'鹅舍', render:function(r){ return '<span class="cell-strong">鹅舍' + esc(r.houseCode) + '</span>'; } },
            { title:'数量(只)', align:'right', render:function(r){ return '<span class="num">' + r.count + '</span>'; } },
            { title:'原因', render:function(r){ return '<i class="badge badge-gray">' + esc(r.cause) + '</i>'; } },
            { title:'处置方式', key:'disposal' },
            { title:'上报人', key:'reporter' },
            { title:'备注', render:function(r){ return esc(r.remark || '—'); } },
            { title:'操作', align:'center', render:function(r){
                return '<div class="row-act"><button class="btn btn-sm btn-ghost" data-em="' + r.id + '">' + icon('edit') + '</button>' +
                  '<button class="btn btn-sm btn-ghost" data-ce="' + r.id + '">存证</button>' +
                  '<button class="btn btn-sm btn-danger" data-dm="' + r.id + '">' + icon('trash') + '</button></div>'; } }
          ],
          rows:rows, pageSize:10, page:s.page, empty:'暂无死淘记录'
        }) + '</section>';
    },
    mount:function(root){
      var s = st.mo, rows = filterMort();
      var t = S.trend(30, s.house);
      C.combo($('#mTrend', root), {
        labels:t.labels, height:250, lUnit:'只', rUnit:'%', xFmt:function(x){ return x.slice(5); },
        series:[
          { name:'日死淘数', type:'bar', axis:'l', color:'#fb7185', data:t.daily, unit:' 只' },
          { name:'累计死淘率', type:'line', axis:'r', color:'#7a5af8', data:t.cum, unit:'%' }
        ]
      });
      var cause = {};
      rows.forEach(function(m){ cause[m.cause] = (cause[m.cause]||0) + m.count; });
      C.hbar($('#mCause', root), {
        unit:' 只',
        items:Object.keys(cause).map(function(k){ return { name:k, value:cause[k] }; })
          .sort(function(a,b){ return b.value - a.value; })
      });
      bindInput($('#mq', root), function(v){ s.q = v; s.page = 1; render(true); });
      bindSelect($('#mh', root), function(v){ s.house = v; s.page = 1; render(true); });
      bindSelect($('#mc', root), function(v){ s.cause = v; s.page = 1; render(true); });
      bindPager(root, function(p){ s.page = p; render(true); });
      $('[data-a="add"]', root).onclick = function(){ mortModal(); };
      $('[data-a="csv"]', root).onclick = function(){
        U.csv('死淘记录_' + F.dstr(new Date()) + '.csv',
          ['日期','鹅舍','数量','原因','处置方式','上报人','备注'],
          filterMort().map(function(m){ return [m.date, m.houseCode, m.count, m.cause, m.disposal, m.reporter, m.remark]; }));
      };
      $$('[data-em]', root).forEach(function(b){ b.onclick = function(){
        mortModal(d().mortality.filter(function(m){ return m.id === b.dataset.em; })[0]); }; });
      $$('[data-dm]', root).forEach(function(b){ b.onclick = function(){
        if (!guard()) return;
        U.confirm('删除后该鹅舍在栏数量会自动加回，确定删除？').then(function(ok){
          if (ok){ S.delMort(b.dataset.dm); U.toast('记录已删除，在栏数量已回补','ok'); }
        });
      }; });
      $$('[data-ce]', root).forEach(function(b){ b.onclick = function(){
        if (!guard()) return;
        var m = d().mortality.filter(function(x){ return x.id === b.dataset.ce; })[0];
        var e = S.addEv({ type:'死淘存证', houseCode:m.houseCode, count:m.count, policy:'PICC-HLJ-2026-3128' });
        U.toast('已生成存证 ' + e.no, 'ok');
      }; });
    }
  };
  function filterMort(){
    var s = st.mo, q = s.q.trim().toLowerCase();
    return d().mortality.filter(function(m){
      if (s.house && m.houseCode !== s.house) return false;
      if (s.cause && m.cause !== s.cause) return false;
      if (!q) return true;
      return (m.houseCode + m.reporter + (m.remark||'')).toLowerCase().indexOf(q) > -1;
    });
  }

  /* ================= 页面：保险存证 ================= */
  PAGES.evidence = {
    title:'保险存证', sub:'死淘与环境异常的存证台账，理赔时可导出核对',
    act:function(){
      return '<button class="btn btn-line btn-sm" data-a="csv">' + icon('download') + '导出 CSV</button>' +
        '<button class="btn btn-primary btn-sm" data-a="add">' + icon('plus') + '新增存证</button>';
    },
    html:function(){
      var s = st.ev, rows = filterEv(), k = S.kpi();
      var pend = d().evidence.filter(function(e){ return e.status === '待确认'; }).length;
      return '<div class="stat-strip">' +
          '<div class="stat"><span>存证总数</span><b>' + F.num(k.ev) + ' 条</b></div>' +
          '<div class="stat"><span>本月新增</span><b>' + k.evMonth + ' 条</b></div>' +
          '<div class="stat"><span>待确认</span><b>' + pend + ' 条</b></div>' +
          '<div class="stat"><span>涉及只数</span><b>' + F.num(d().evidence.reduce(function(a,e){ return a + e.count; }, 0)) + ' 只</b></div>' +
        '</div>' +
        '<div class="toolbar">' +
          '<div class="field grow"><label for="eq">搜索</label><input id="eq" value="' + esc(s.q) + '" placeholder="存证号 / 保单号 / 鹅舍"></div>' +
          '<div class="field"><label for="et">类型</label>' + selectHtml('et', [{value:'',text:'全部类型'},'死淘存证','环境存证','理赔存证'], s.type) + '</div>' +
          '<div class="field"><label for="es">状态</label>' + selectHtml('es', [{value:'',text:'全部状态'},'已上链','待确认'], s.status) + '</div>' +
          '<div class="toolbar-r"><span class="mini-note">共 ' + rows.length + ' 条</span></div></div>' +
        '<section class="card">' + U.table({
          columns:[
            { title:'存证号', render:function(r){ return '<span class="cell-strong">' + esc(r.no) + '</span>'; } },
            { title:'生成时间', key:'ts' },
            { title:'类型', render:function(r){ return '<i class="badge badge-info">' + esc(r.type) + '</i>'; } },
            { title:'鹅舍', render:function(r){ return '鹅舍' + esc(r.houseCode); } },
            { title:'只数', align:'right', render:function(r){ return '<span class="num">' + r.count + '</span>'; } },
            { title:'保单号', key:'policy' },
            { title:'数据指纹', render:function(r){ return '<span class="hash">' + esc(r.hash.slice(0,14)) + '…</span>'; } },
            { title:'状态', align:'center', render:function(r){ return stBadge(r.status); } },
            { title:'操作', align:'center', render:function(r){
                return '<div class="row-act"><button class="btn btn-sm btn-ghost" data-ve="' + r.id + '">详情</button>' +
                  (r.status === '待确认' ? '<button class="btn btn-sm btn-primary" data-oe="' + r.id + '">确认上链</button>' : '') +
                  '<button class="btn btn-sm btn-danger" data-de="' + r.id + '">' + icon('trash') + '</button></div>'; } }
          ],
          rows:rows, pageSize:10, page:s.page, empty:'暂无存证记录'
        }) + '</section>';
    },
    mount:function(root){
      var s = st.ev;
      bindInput($('#eq', root), function(v){ s.q = v; s.page = 1; render(true); });
      bindSelect($('#et', root), function(v){ s.type = v; s.page = 1; render(true); });
      bindSelect($('#es', root), function(v){ s.status = v; s.page = 1; render(true); });
      bindPager(root, function(p){ s.page = p; render(true); });
      $('[data-a="add"]', root).onclick = function(){ evModal(); };
      $('[data-a="csv"]', root).onclick = function(){
        U.csv('保险存证_' + F.dstr(new Date()) + '.csv',
          ['存证号','时间','类型','鹅舍','只数','保单号','数据指纹','状态'],
          filterEv().map(function(e){ return [e.no, e.ts, e.type, e.houseCode, e.count, e.policy, e.hash, e.status]; }));
      };
      $$('[data-ve]', root).forEach(function(b){ b.onclick = function(){
        var e = d().evidence.filter(function(x){ return x.id === b.dataset.ve; })[0];
        U.drawer({ title:'存证 ' + e.no,
          rows:[['存证号', e.no], ['生成时间', e.ts], ['存证类型', e.type], ['鹅舍', '鹅舍' + e.houseCode],
            ['涉及只数', e.count + ' 只'], ['保单号', e.policy], ['状态', stBadge(e.status), 1],
            ['数据指纹', '<span class="hash">' + e.hash + '</span>', 1]],
          actions:[{ text:'复制指纹', onClick:function(){ U.copy(e.hash); } }, { text:'关闭', primary:true }] });
      }; });
      $$('[data-oe]', root).forEach(function(b){ b.onclick = function(){
        if (!guard()) return; S.confirmEv(b.dataset.oe); U.toast('已确认上链','ok'); }; });
      $$('[data-de]', root).forEach(function(b){ b.onclick = function(){
        if (!guard('admin')) return;
        U.confirm('删除存证不可恢复，确定继续？').then(function(ok){
          if (ok){ S.delEv(b.dataset.de); U.toast('存证已删除','ok'); } });
      }; });
    }
  };
  function filterEv(){
    var s = st.ev, q = s.q.trim().toLowerCase();
    return d().evidence.filter(function(e){
      if (s.type && e.type !== s.type) return false;
      if (s.status && e.status !== s.status) return false;
      if (!q) return true;
      return (e.no + e.policy + e.houseCode).toLowerCase().indexOf(q) > -1;
    });
  }

  /* ================= 页面：数据报表 ================= */
  PAGES.reports = {
    title:'数据报表', sub:'自定义时间段与鹅场维度的经营分析',
    act:function(){
      return '<button class="btn btn-line btn-sm" data-a="print">' + icon('print') + '打印 / 存 PDF</button>' +
        '<button class="btn btn-primary btn-sm" data-a="csv">' + icon('download') + '导出报表</button>';
    },
    html:function(){
      var s = st.rep, r = repData();
      return '<div class="toolbar">' +
          '<div class="field"><label for="rf">开始日期</label><input id="rf" type="date" value="' + s.from + '"></div>' +
          '<div class="field"><label for="rt">结束日期</label><input id="rt" type="date" value="' + s.to + '"></div>' +
          '<div class="field"><label for="rm">鹅场</label>' + selectHtml('rm', farmOptions(), s.farm) + '</div>' +
          '<div class="field"><label>&nbsp;</label><div class="seg">' +
            '<button data-q="7">近7天</button><button data-q="30">近30天</button><button data-q="90">近90天</button></div></div>' +
        '</div>' +
        '<div class="stat-strip">' +
          '<div class="stat"><span>统计区间</span><b style="font-size:15px">' + s.from + ' ~ ' + s.to + '</b></div>' +
          '<div class="stat"><span>期间死淘</span><b>' + F.num(r.deaths) + ' 只</b></div>' +
          '<div class="stat"><span>期间死淘率</span><b>' + r.rate + ' %</b></div>' +
          '<div class="stat"><span>预警 / 待处理</span><b>' + r.alerts + ' / ' + r.pending + '</b></div>' +
          '<div class="stat"><span>新增存证</span><b>' + r.ev + ' 条</b></div>' +
        '</div>' +
        '<div class="grid g-2-1">' +
          '<section class="card"><div class="card-hd"><h3>区间死淘趋势</h3><span class="mini-note">' + r.labels.length + ' 天</span></div>' +
            '<div class="chart" id="rTrend" style="height:260px"></div></section>' +
          '<section class="card"><div class="card-hd"><h3>异常类型占比</h3></div>' +
            '<div class="chart" id="rShare" style="height:260px"></div></section>' +
        '</div>' +
        '<div class="grid g-2">' +
          '<section class="card"><div class="card-hd"><h3>鹅舍死淘排行</h3><span class="mini-note">Top 8</span></div>' +
            '<div id="rRank"></div></section>' +
          '<section class="card"><div class="card-hd"><h3>鹅场汇总</h3></div>' + U.table({
            columns:[
              { title:'鹅场', render:function(x){ return '<span class="cell-strong">' + esc(x.name) + '</span>'; } },
              { title:'鹅舍', align:'right', render:function(x){ return '<span class="num">' + x.houses + '</span>'; } },
              { title:'在栏(只)', align:'right', render:function(x){ return '<span class="num">' + F.num(x.stock) + '</span>'; } },
              { title:'期间死淘', align:'right', render:function(x){ return '<span class="num">' + x.deaths + '</span>'; } },
              { title:'死淘率', align:'right', render:function(x){ return '<span class="num">' + x.rate + '%</span>'; } },
              { title:'预警', align:'right', render:function(x){ return '<span class="num">' + x.alerts + '</span>'; } }
            ], rows:r.byFarm, empty:'暂无数据'
          }) + '</section>' +
        '</div>';
    },
    mount:function(root){
      var s = st.rep, r = repData();
      C.combo($('#rTrend', root), {
        labels:r.labels, height:260, lUnit:'只', xFmt:function(x){ return x.slice(5); },
        series:[{ name:'日死淘数', type:'bar', color:'#7a5af8', data:r.daily, unit:' 只' },
                { name:'7日移动平均', type:'line', color:'#f79009', data:r.ma, unit:' 只' }]
      });
      C.donut($('#rShare', root), { items:r.share, height:260, unit:' 起' });
      C.hbar($('#rRank', root), { unit:' 只', items:r.rank });
      $('#rf', root).onchange = function(){ s.from = this.value; render(true); };
      $('#rt', root).onchange = function(){ s.to = this.value; render(true); };
      bindSelect($('#rm', root), function(v){ s.farm = v; render(true); });
      $$('[data-q]', root).forEach(function(b){ b.onclick = function(){
        s.from = F.dstr(F.day(-(+b.dataset.q - 1))); s.to = F.dstr(new Date()); render(true); }; });
      $('[data-a="print"]', root).onclick = function(){ window.print(); };
      $('[data-a="csv"]', root).onclick = function(){
        U.csv('经营报表_' + s.from + '_' + s.to + '.csv',
          ['日期','死淘数(只)','7日移动平均'],
          r.labels.map(function(l, i){ return [l, r.daily[i], r.ma[i]]; }));
      };
    }
  };
  function repData(){
    var s = st.rep, from = s.from, to = s.to;
    if (from > to){ var t0 = from; from = to; to = t0; }
    var inFarm = function(code){ if (!s.farm) return true; var h = S.house(code); return h && h.farmId === s.farm; };
    var labels = [], map = {}, dt = new Date(from.replace(/-/g,'/')), end = new Date(to.replace(/-/g,'/'));
    var guardN = 0;
    while (dt <= end && guardN++ < 400){ var k = F.dstr(dt); labels.push(k); map[k] = 0; dt.setDate(dt.getDate()+1); }
    var deaths = 0, rank = {};
    d().mortality.forEach(function(m){
      if (m.date < from || m.date > to || !inFarm(m.houseCode)) return;
      if (map[m.date] !== undefined) map[m.date] += m.count;
      deaths += m.count; rank[m.houseCode] = (rank[m.houseCode]||0) + m.count;
    });
    var daily = labels.map(function(k){ return map[k]; });
    var ma = daily.map(function(_, i){
      var a = daily.slice(Math.max(0, i-6), i+1);
      return +(a.reduce(function(x,y){ return x+y; }, 0)/a.length).toFixed(2);
    });
    var alerts = 0, pending = 0, share = {};
    S.TYPES.forEach(function(t){ share[t] = 0; });
    d().alerts.forEach(function(a){
      var day0 = a.ts.slice(0,10);
      if (day0 < from || day0 > to || !inFarm(a.houseCode)) return;
      alerts++; if (a.status === '待处理') pending++;
      share[a.type]++;
    });
    var ev = d().evidence.filter(function(e){
      var day0 = e.ts.slice(0,10);
      return day0 >= from && day0 <= to && inFarm(e.houseCode);
    }).length;
    var stock = d().houses.filter(function(h){ return h.status==='在养' && (!s.farm || h.farmId===s.farm); })
      .reduce(function(a,h){ return a + h.stock; }, 0);
    var byFarm = d().farms.filter(function(f){ return !s.farm || f.id === s.farm; }).map(function(f){
      var hs = d().houses.filter(function(h){ return h.farmId === f.id; });
      var codes = {}; hs.forEach(function(h){ codes[h.code] = 1; });
      var fs = hs.reduce(function(a,h){ return a + (h.status==='在养'?h.stock:0); }, 0);
      var fd = d().mortality.filter(function(m){ return codes[m.houseCode] && m.date >= from && m.date <= to; })
        .reduce(function(a,m){ return a + m.count; }, 0);
      var fa = d().alerts.filter(function(a){ return codes[a.houseCode] && a.ts.slice(0,10) >= from && a.ts.slice(0,10) <= to; }).length;
      return { name:f.name, houses:hs.length, stock:fs, deaths:fd, alerts:fa,
        rate: fs + fd ? +(fd/(fs+fd)*100).toFixed(2) : 0 };
    });
    return {
      labels:labels, daily:daily, ma:ma, deaths:deaths, alerts:alerts, pending:pending, ev:ev,
      rate: stock + deaths ? +(deaths/(stock+deaths)*100).toFixed(2) : 0,
      share: S.TYPES.map(function(t){ return { name:t, value:share[t], color:S.TYPE_COLOR[t] }; })
        .filter(function(x){ return x.value > 0; }),
      rank: Object.keys(rank).map(function(c){ return { name:'鹅舍' + c, value:rank[c] }; })
        .sort(function(a,b){ return b.value - a.value; }).slice(0, 8),
      byFarm: byFarm
    };
  }

  /* ================= 页面：系统设置 ================= */
  var TH_FIELDS = function(th){
    return [
      { name:'tempMin', label:'温度下限（℃）', type:'number', required:true, min:-30, max:40, step:'0.5', value:th.tempMin },
      { name:'tempMax', label:'温度上限（℃）', type:'number', required:true, min:-30, max:45, step:'0.5', value:th.tempMax },
      { name:'humMin',  label:'湿度下限（%）', type:'number', required:true, min:0, max:100, value:th.humMin },
      { name:'humMax',  label:'湿度上限（%）', type:'number', required:true, min:0, max:100, value:th.humMax },
      { name:'nh3Max',  label:'氨气上限（ppm）', type:'number', required:true, min:1, max:60, step:'0.5', value:th.nh3Max },
      { name:'windMin', label:'风速下限（m/s）', type:'number', required:true, min:0, max:5, step:'0.1', value:th.windMin },
      { name:'windMax', label:'风速上限（m/s）', type:'number', required:true, min:0, max:8, step:'0.1', value:th.windMax }
    ];
  };
  PAGES.settings = {
    title:'系统设置', sub:'预警阈值、账号权限、外观与数据管理',
    act:function(){ return ''; },
    html:function(){
      var s = st.set, sm = d().settings;
      var tabs = '<div class="tabs">' +
        [['th','预警阈值'],['user','账号管理'],['ui','通知与外观'],['data','数据管理']].map(function(t){
          return '<button data-tab="' + t[0] + '"' + (s.tab===t[0]?' class="on"':'') + '>' + t[1] + '</button>';
        }).join('') + '</div>';
      if (s.tab === 'th'){
        return tabs + '<section class="card" style="max-width:820px">' +
          '<div class="card-hd"><h3>环境预警阈值</h3><span class="mini-note">保存后立即生效，下一次巡检按新阈值判断</span></div>' +
          '<div id="thForm">' + U.formHtml(TH_FIELDS(sm.th), true) + '</div>' +
          '<div class="tip-box">寒区建议：育雏期 26~32℃，育成期 15~22℃，育肥期 12~24℃；氨气长期高于 15ppm 会显著提高呼吸道发病率。</div>' +
          '<div style="display:flex;gap:10px;margin-top:16px">' +
            '<button class="btn btn-primary" data-a="thSave">' + icon('check') + '保存阈值</button>' +
            '<button class="btn btn-line" data-a="thReset">恢复默认</button>' +
            '<button class="btn btn-line" data-a="thTest">用新阈值立即巡检</button></div></section>';
      }
      if (s.tab === 'user'){
        return tabs + '<section class="card">' +
          '<div class="card-hd"><h3>账号管理</h3><div class="card-act">' +
          '<button class="btn btn-primary btn-sm" data-a="addUser">' + icon('plus') + '新增账号</button></div></div>' +
          U.table({
            columns:[
              { title:'账号', render:function(u){ return '<span class="cell-strong">' + esc(u.username) + '</span>'; } },
              { title:'姓名', key:'name' },
              { title:'角色', render:function(u){ return '<i class="badge badge-info">' + esc(u.role) + '</i>'; } },
              { title:'手机号', key:'phone' },
              { title:'密码', render:function(u){ return '••••••'; } },
              { title:'状态', align:'center', render:function(u){ return stBadge(u.status); } },
              { title:'操作', align:'center', render:function(u){
                  return '<div class="row-act"><button class="btn btn-sm btn-ghost" data-eu="' + u.id + '">' + icon('edit') + '编辑</button>' +
                    (u.id === me.uid ? '' : '<button class="btn btn-sm btn-danger" data-du="' + u.id + '">' + icon('trash') + '</button>') + '</div>'; } }
            ], rows:d().users, empty:'暂无账号'
          }) +
          '<div class="tip-box" style="margin-top:14px">当前部署形态下账号与密码存储于本机浏览器缓存；正式服务将切换为服务端加密存储与接口鉴权。</div>' +
          '</section>';
      }
      if (s.tab === 'ui'){
        return tabs + '<div class="grid g-2">' +
          '<section class="card"><div class="card-hd"><h3>通知设置</h3></div><div id="ntForm">' +
            U.formHtml([
              { name:'site', type:'switch', label:'站内弹窗提醒', value:sm.notify.site },
              { name:'sms',  type:'switch', label:'短信通知饲养员', value:sm.notify.sms },
              { name:'mail', type:'switch', label:'邮件日报', value:sm.notify.mail },
              { name:'night',type:'switch', label:'夜间免打扰（22:00-06:00）', value:sm.notify.night },
              { name:'sim',  type:'switch', label:'开启实时数据模拟（每 8 秒巡检一次）', value:sm.sim }
            ]) + '</div>' +
            '<button class="btn btn-primary" data-a="ntSave">' + icon('check') + '保存通知设置</button></section>' +
          '<section class="card"><div class="card-hd"><h3>外观</h3></div>' +
            '<div class="field"><label>主题</label><div class="seg">' +
              '<button data-theme="light"' + (sm.theme==='light'?' class="on"':'') + '>浅色</button>' +
              '<button data-theme="dark"' + (sm.theme==='dark'?' class="on"':'') + '>深色</button></div></div>' +
            '<div class="field"><label>主色调</label><div class="color-dots">' +
              ACCENTS.map(function(a){ return '<button data-accent="' + a[0] + '" style="background:' + a[0] + '"' +
                (sm.accent===a[0]?' class="on"':'') + ' aria-label="主色 ' + a[0] + '"></button>'; }).join('') +
            '</div><p class="field-hint">切换后立即生效并记住。</p></div>' +
            '<div class="field"><label>当前登录</label><p>' + esc(me.name) + '（' + esc(me.role) + '） · 登录时间 ' + esc(me.at) + '</p></div>' +
          '</section></div>';
      }
      return tabs + '<div class="grid g-2">' +
        '<section class="card"><div class="card-hd"><h3>数据备份与恢复</h3></div>' +
          '<p class="mini-note" style="margin-bottom:14px">所有数据保存在当前浏览器 localStorage，占用 ' + S.usage() +
          '。换电脑演示时可导出 JSON 再导入。</p>' +
          '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
            '<button class="btn btn-primary" data-a="expJson">' + icon('download') + '导出全部数据(JSON)</button>' +
            '<button class="btn btn-line" data-a="impJson">' + icon('copy') + '导入数据</button>' +
            '<input type="file" id="impFile" accept=".json" hidden>' +
          '</div>' +
          '<div class="tip-box" style="margin-top:16px">重置将清空新增记录，恢复出厂初始数据，操作前请先导出备份。</div>' +
          '<button class="btn btn-danger" style="margin-top:14px" data-a="reset">' + icon('refresh') + '重置数据</button>' +
        '</section>' +
        '<section class="card"><div class="card-hd"><h3>系统信息</h3></div>' +
          '<div class="dl"><b>系统版本</b><span>寒羽智瞳 v1.0.0</span></div>' +
          '<div class="dl"><b>数据初始化</b><span>' + esc(d().meta.createdAt) + '</span></div>' +
          '<div class="dl"><b>期初存栏</b><span>' + F.num(d().meta.openingStock) + ' 只</span></div>' +
          '<div class="dl"><b>鹅场 / 鹅舍</b><span>' + d().farms.length + ' 个 / ' + d().houses.length + ' 栋</span></div>' +
          '<div class="dl"><b>记录条数</b><span>预警 ' + d().alerts.length + ' · 死淘 ' + d().mortality.length +
            ' · 存证 ' + d().evidence.length + '</span></div>' +
          '<div class="dl"><b>存储占用</b><span>' + S.usage() + '</span></div>' +
        '</section></div>';
    },
    mount:function(root){
      var s = st.set, sm = d().settings;
      $$('[data-tab]', root).forEach(function(b){ b.onclick = function(){ s.tab = b.dataset.tab; render(); }; });
      var save = $('[data-a="thSave"]', root);
      if (save) save.onclick = function(){
        if (!guard('admin')) return;
        var fs = TH_FIELDS(sm.th), v = U.formCheck($('#thForm', root), fs);
        if (!v) return;
        if (v.tempMin >= v.tempMax || v.humMin >= v.humMax || v.windMin >= v.windMax){
          U.toast('下限必须小于上限','err'); return;
        }
        S.setSettings({ th:v }); U.toast('阈值已保存并生效','ok');
      };
      var rs = $('[data-a="thReset"]', root);
      if (rs) rs.onclick = function(){
        if (!guard('admin')) return;
        S.setSettings({ th:{ tempMin:12, tempMax:24, humMin:55, humMax:75, nh3Max:15, windMin:0.2, windMax:2 } });
        U.toast('已恢复默认阈值','ok'); render(true);
      };
      var tt = $('[data-a="thTest"]', root);
      if (tt) tt.onclick = function(){
        var c = S.tick(true);
        U.toast(c.length ? '巡检完成，触发 ' + c.length + ' 条预警' : '巡检完成，全部达标', c.length?'warn':'ok');
      };
      var au = $('[data-a="addUser"]', root); if (au) au.onclick = function(){ userModal(); };
      $$('[data-eu]', root).forEach(function(b){ b.onclick = function(){
        userModal(d().users.filter(function(u){ return u.id === b.dataset.eu; })[0]); }; });
      $$('[data-du]', root).forEach(function(b){ b.onclick = function(){
        if (!guard('admin')) return;
        U.confirm('确定删除该账号？').then(function(ok){ if (ok){ S.delUser(b.dataset.du); U.toast('账号已删除','ok'); } });
      }; });
      var ns = $('[data-a="ntSave"]', root);
      if (ns) ns.onclick = function(){
        if (!guard()) return;
        var v = U.formRead($('#ntForm', root));
        S.setSettings({ notify:{ site:v.site, sms:v.sms, mail:v.mail, night:v.night }, sim:v.sim });
        U.toast('通知设置已保存','ok');
      };
      $$('[data-theme]', root).forEach(function(b){ b.onclick = function(){
        S.setSettings({ theme:b.dataset.theme }); applyTheme(); render(true); }; });
      $$('[data-accent]', root).forEach(function(b){ b.onclick = function(){
        S.setSettings({ accent:b.dataset.accent }); applyTheme(); render(true); }; });
      var ej = $('[data-a="expJson"]', root);
      if (ej) ej.onclick = function(){
        U.download('hanyu_backup_' + F.dstr(new Date()) + '.json', S.exportAll(), 'application/json');
        U.toast('已导出全部数据','ok');
      };
      var ij = $('[data-a="impJson"]', root), file = $('#impFile', root);
      if (ij) ij.onclick = function(){ if (guard('admin')) file.click(); };
      if (file) file.onchange = function(){
        var f = file.files[0]; if (!f) return;
        var fr = new FileReader();
        fr.onload = function(){
          try{ S.importAll(fr.result); U.toast('数据导入成功','ok'); render(); }
          catch(err){ U.toast('导入失败：' + err.message, 'err'); }
        };
        fr.readAsText(f);
      };
      var rst = $('[data-a="reset"]', root);
      if (rst) rst.onclick = function(){
        if (!guard('admin')) return;
        U.confirm('重置后所有新增数据都会丢失，确定继续？').then(function(ok){
          if (ok){ S.reset(); U.toast('已恢复初始数据','ok'); render(); }
        });
      };
    }
  };

  /* ================= 小工具：控件绑定 ================= */
  function selectHtml(id, options, value){
    return '<select id="' + id + '">' + options.map(function(o){
      var v = (o && typeof o === 'object') ? o.value : o, t = (o && typeof o === 'object') ? o.text : o;
      return '<option value="' + esc(v) + '"' + (String(value)===String(v)?' selected':'') + '>' + esc(t) + '</option>';
    }).join('') + '</select>';
  }
  function bindInput(el, fn){
    if (!el) return;
    var t;
    el.oninput = function(){ clearTimeout(t); var v = el.value; t = setTimeout(function(){ fn(v); }, 260); };
    el.onkeydown = function(e){ if (e.key === 'Enter'){ clearTimeout(t); fn(el.value); } };
  }
  function bindSelect(el, fn){ if (el) el.onchange = function(){ fn(el.value); }; }
  function bindPager(root, fn){
    $$('[data-page]', root).forEach(function(b){
      if (b.disabled) return;
      b.onclick = function(){ fn(+b.dataset.page); };
    });
  }

  /* ================= 外壳：导航 / 顶栏 / 主题 ================= */
  function paintNav(){
    $('#sideNav').innerHTML = NAV.map(function(n){
      var b = n.badge ? n.badge() : 0;
      return '<button class="nav-item' + (st.page===n.key?' on':'') + '" data-nav="' + n.key + '" title="' + n.name + '">' +
        icon(n.ico) + '<span>' + n.name + '</span>' +
        (b ? '<i class="nv-dot">' + (b > 99 ? '99+' : b) + '</i>' : '') + '</button>';
    }).join('');
    $$('[data-nav]').forEach(function(b){
      b.onclick = function(){ go(b.dataset.nav); $('#side').classList.remove('open'); $('#sideMask').hidden = true; };
    });
  }
  function paintUser(){
    $('#uName').textContent = me.name;
    $('#uRole').textContent = me.role;
    $('#avatar').textContent = me.name.slice(0, 1);
    var n = S.unread(), c = $('#msgCount');
    c.textContent = n; c.hidden = !n;
  }
  function applyTheme(){
    var sm = d().settings;
    document.documentElement.setAttribute('data-theme', sm.theme || 'light');
    var pair = ACCENTS.filter(function(a){ return a[0] === sm.accent; })[0] || ACCENTS[0];
    document.documentElement.style.setProperty('--brand', pair[0]);
    document.documentElement.style.setProperty('--brand-2', pair[1]);
  }

  function go(key){ location.hash = '#/' + key; }
  function route(){
    var k = (location.hash || '').replace(/^#\/?/, '') || 'overview';
    if (!PAGES[k]) k = 'overview';
    st.page = k; render();
  }
  function render(keep){
    var view = $('#view'), sc = view.scrollTop, p = PAGES[st.page] || PAGES.overview;
    paintNav(); paintUser();
    view.innerHTML =
      '<div class="page-hd"><div><h2>' + p.title + '</h2><p>' + p.sub + '</p></div>' +
      '<div class="page-act">' + (p.act ? p.act() : '') + '</div></div>' + p.html();
    document.title = p.title + ' · 寒羽智瞳';
    if (p.mount) requestAnimationFrame(function(){ p.mount(view); });
    view.scrollTop = keep ? sc : 0;
  }

  /* 顶栏交互 */
  $('#btnMenu').onclick = function(){
    $('#side').classList.add('open'); $('#sideMask').hidden = false;
  };
  $('#sideMask').onclick = function(){
    $('#side').classList.remove('open'); this.hidden = true;
  };
  $('#btnCollapse').onclick = function(){ $('#layout').classList.toggle('mini'); };
  $('#btnFull').onclick = function(){
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen()
      .catch(function(){ U.toast('当前浏览器不允许全屏','warn'); });
  };
  $('#btnMsg').onclick = function(){
    var ms = d().messages;
    U.popover(this,
      '<div class="pop-hd"><span>消息中心（' + S.unread() + ' 条未读）</span><button class="btn btn-sm btn-ghost" data-all>全部已读</button></div>' +
      (ms.length ? ms.slice(0, 12).map(function(m){
        return '<div class="msg-item' + (m.read?'':' unread') + '" data-m="' + m.id + '"><b>' + esc(m.title) + '</b>' +
          '<p>' + esc(m.body) + '</p><time>' + esc(m.ts) + '</time></div>';
      }).join('') : '<div class="empty"><span>📭</span>暂无消息</div>'),
      function(pop, close){
        pop.querySelector('[data-all]').onclick = function(){ S.readMsg(); close(); paintUser(); U.toast('已全部标记为已读','ok'); };
        $$('[data-m]', pop).forEach(function(el){
          el.onclick = function(){
            var m = d().messages.filter(function(x){ return x.id === el.dataset.m; })[0];
            S.readMsg(m.id); close(); paintUser();
            U.modal({ title:m.title, body:'<p style="color:var(--ink-2);padding:6px 0 12px">' + esc(m.body) +
              '</p><p class="mini-note">' + esc(m.ts) + '</p>', actions:[{ text:'知道了', primary:true }] });
          };
        });
      });
  };
  $('#btnUser').onclick = function(){
    U.popover(this,
      '<div class="up-hd"><span class="avatar">' + esc((me.name||'羽').slice(0,1)) + '</span>' +
        '<div><b>' + esc(me.name) + '</b><span>' + esc(me.role) + ' · ' + esc(me.username) + '</span></div></div>' +
      '<button class="up-item" data-p="me">' + icon('user') + '个人信息</button>' +
      '<button class="up-item" data-p="theme">' + icon(d().settings.theme==='dark'?'sun':'moon') + '切换深色 / 浅色</button>' +
      '<button class="up-item" data-p="portal">' + icon('home') + '返回门户首页</button>' +
      '<button class="up-item" data-p="set">' + icon('gear') + '系统设置</button>' +
      '<div class="up-sep"></div>' +
      '<button class="up-item danger" data-p="out">' + icon('logout') + '退出登录</button>',
      function(pop, close){
        $$('[data-p]', pop).forEach(function(b){
          b.onclick = function(){
            close();
            var k = b.dataset.p;
            if (k === 'me') U.modal({ title: '个人信息',
              body: '<div class="dl"><b>姓名</b><span>' + esc(me.name) + '</span></div>' +
                    '<div class="dl"><b>账号</b><span>' + esc(me.username) + '</span></div>' +
                    '<div class="dl"><b>角色</b><span>' + esc(me.role) + '</span></div>' +
                    '<div class="dl"><b>所属</b><span>' + esc((d().farms[0] || {}).name || '寒羽智瞳') + '</span></div>' +
                    '<div class="dl"><b>登录时间</b><span>' + esc(me.at) + '</span></div>' +
                    '<div class="dl"><b>权限说明</b><span>' + (me.role === '超级管理员' ? '全部功能，含账号与数据管理' : '可录入与处理业务数据') + '</span></div>',
              actions: [{ text: '关闭', primary: true }] });
            else if (k === 'set') go('settings');
            else if (k === 'theme') { S.setSettings({ theme: d().settings.theme === 'dark' ? 'light' : 'dark' }); applyTheme(); render(true); }
            else if (k === 'portal') location.href = 'index.html';
            else if (k === 'out') U.confirm('确定退出登录？').then(function (ok) {
              if (ok) { S.logout(); location.replace('index.html'); }
            });
          };
        });
      }, { width: 272 });
  };
  var live = $('#btnLive');
  live.onclick = function(){
    var on = !d().settings.sim;
    S.setSettings({ sim:on });
    paintLive();
    U.toast(on ? '已开启实时监测模拟' : '已暂停实时监测模拟', 'ok');
  };
  function paintLive(){
    var on = d().settings.sim;
    live.classList.toggle('off', !on);
    live.querySelector('span').textContent = on ? '实时监测中' : '监测已暂停';
  }

  /* ================= 实时模拟 ================= */
  S.on('alert', function(list){
    if (!d().settings.notify.site) return;
    var h = new Date().getHours();
    if (d().settings.notify.night && (h >= 22 || h < 6)) return;
    list.slice(0, 2).forEach(function(a){
      U.toast('鹅舍' + a.houseCode + ' ' + a.type + '：' + a.value + unit(a.type), 'warn', 4200);
    });
  });
  S.on('change', function(){ paintNav(); paintUser(); });
  S.on('env', function(){
    if (st.page !== 'alerts' || U.hasOverlay()) return;
    var g = $('#envGrid'); if (!g) return;
    g.innerHTML = envCards(); bindEnvCards(g);
  });
  setInterval(function(){
    if (!d().settings.sim || document.hidden || U.hasOverlay()) return;
    var created = S.tick(false);
    if (created.length && (st.page === 'overview' || st.page === 'alerts')) render(true);
  }, 8000);

  /* ================= 启动 ================= */
  applyTheme(); paintLive();
  window.addEventListener('hashchange', route);
  paintNav(); paintUser();
  setTimeout(function () { route(); }, 30);
  setTimeout(function () {
    U.toast('欢迎回来，' + me.name + '（' + me.role + '）', 'ok', 1600);
  }, 500);
})(window);
