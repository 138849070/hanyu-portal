/* ================= 门户页交互 + 登录 ================= */
(function (global) {
  'use strict';
  var S = HY.store, U = HY.ui, C = HY.charts;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

  /* ---------- 顶栏 ---------- */
  var nav = $('#siteHd');
  window.addEventListener('scroll', function () {
    nav.classList.toggle('solid', window.scrollY > 8);
  }, { passive: true });
  $('#menuBtn').addEventListener('click', function () {
    var open = $('#siteNav').classList.toggle('open');
    this.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  $$('#siteNav a').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var t = $(a.getAttribute('href'));
      if (t) window.scrollTo({ top: t.offsetTop - 70, behavior: 'smooth' });
      $('#siteNav').classList.remove('open');
    });
  });
  $$('.site-ft nav a').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var t = $(a.getAttribute('href'));
      if (t) window.scrollTo({ top: t.offsetTop - 70, behavior: 'smooth' });
    });
  });
  var themeBtn = $('#themeBtn'), themeIco = $('#themeIco');
  function paintThemeBtn() {
    themeIco.innerHTML = U.icon(document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon');
  }
  themeBtn.addEventListener('click', function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('hy_portal_theme', next); } catch (e) {}
    paintThemeBtn();
  });
  (function () {
    var saved = 'light';
    try { saved = localStorage.getItem('hy_portal_theme') || 'light'; } catch (e) {}
    document.documentElement.setAttribute('data-theme', saved);
    paintThemeBtn();
  })();

  /* ---------- 数字滚动 ---------- */
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting || e.target.__done) return;
      e.target.__done = 1;
      var el = e.target, to = +el.dataset.count, sfx = el.dataset.suffix || '';
      var dec = String(to).indexOf('.') > -1 ? 1 : 0, t0 = Date.now(), dur = 1100;
      (function step() {
        var p = Math.min(1, (Date.now() - t0) / dur), v = to * (1 - Math.pow(1 - p, 3));
        el.textContent = (dec ? v.toFixed(1) : Math.round(v).toLocaleString('zh-CN')) + sfx;
        if (p < 1) requestAnimationFrame(step);
      })();
    });
  }, { threshold: .4 });
  $$('[data-count]').forEach(function (el) { io.observe(el); });
  var revealIO = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) e.target.classList.add('in'); });
  }, { threshold: .12 });
  $$('.reveal').forEach(function (el) { revealIO.observe(el); });

  /* ---------- 门户图表 ---------- */
  var t30 = S.trend(30);
  C.combo($('#pChart'), {
    labels: t30.labels, height: 130, lUnit: '%', xTickEvery: 10,
    xFmt: function (d) { return d.slice(5); },
    series: [{ name: '累计死淘率', type: 'line', color: '#7a5af8', data: t30.cum, unit: '%' }]
  });
  C.donut($('#pDonut'), { items: S.alertTypeShare(30).items, height: 168, unit: ' 起' });
  var k0 = S.kpi();
  $('#pk1').textContent = k0.stock.toLocaleString('zh-CN');
  $('#pk2').textContent = k0.todayAlert;
  $('#pk3').textContent = k0.deathRate;

  /* ---------- 登录 ---------- */
  function openLogin(target) {
    if (S.session()) { location.href = 'app.html#/' + (target || 'overview'); return; }
    var api = U.modal({
      title: ' ',
      size: 'sm',
      body:
      '<div class="lg">' +
        '<div class="lg-logo">羽</div>' +
        '<h3 class="lg-title">欢迎登录</h3>' +
        '<p class="lg-sub">寒区肉鹅健康管理平台</p>' +
        '<div class="lg-body">' +
          '<label class="lg-lb" for="lgUser">账号</label>' +
          '<input class="input lg-ipt" id="lgUser" autocomplete="username" placeholder="请输入登录账号" maxlength="20">' +
          '<label class="lg-lb" for="lgPwd">密码</label>' +
          '<div class="lg-pwd">' +
            '<input class="input" id="lgPwd" type="password" autocomplete="current-password" placeholder="请输入密码" maxlength="20">' +
            '<button class="lg-eye" id="lgEye" type="button" aria-label="显示密码">👁</button>' +
          '</div>' +
          '<div class="lg-row">' +
            '<label class="switch"><input type="checkbox" id="lgRemember" checked><i></i><span>记住我</span></label>' +
            '<span class="lg-link" id="lgForgot">忘记密码？</span>' +
          '</div>' +
          '<div class="lg-err" id="lgErr"></div>' +
          '<button class="btn btn-primary btn-block lg-btn" type="button" id="lgGo">登 录</button>' +
          '<p class="lg-foot">还没有账号？请联系场区管理员开通</p>' +
        '</div>' +
      '</div>',
      onMount: function (bd) {
        var err = $('#lgErr', bd), eye = $('#lgEye', bd), pwd = $('#lgPwd', bd);
        eye.addEventListener('click', function () {
          var show = pwd.type === 'password';
          pwd.type = show ? 'text' : 'password';
          eye.textContent = show ? '🙈' : '👁';
        });
        $('#lgForgot', bd).addEventListener('click', function () {
          U.toast('请联系场区管理员或拨打客服热线 0451-8888-6666 重置密码', 'info', 3600);
        });
        $('#lgGo', bd).addEventListener('click', doLogin);
        ['lgUser', 'lgPwd'].forEach(function (id) {
          $('#' + id, bd).addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
        });
        function doLogin() {
          var u = $('#lgUser', bd).value.trim();
          var p = pwd.value;
          if (!u || !p) { showErr('请输入账号和密码'); return; }
          var res = S.login(u, p, $('#lgRemember', bd).checked);
          if (!res.ok) { showErr(res.msg); return; }
          U.toast('登录成功', 'ok', 1200);
          api.close();
          setTimeout(function () { location.href = 'app.html#/' + (target || 'overview'); }, 300);
        }
        function showErr(msg) { err.textContent = msg; err.style.display = 'block'; }
        setTimeout(function () { $('#lgUser', bd).focus(); }, 60);
      }
    });
  }
  ['#loginBtn', '#heroLogin'].forEach(function (sel) {
    var b = $(sel);
    if (b) b.addEventListener('click', function () { openLogin(); });
  });

  /* 已登录 → 顶栏按钮变“进入控制台” */
  var s0 = S.session();
  if (s0) {
    $('#loginBtn').textContent = '进入控制台';
    $('#heroLogin').textContent = '进入控制台';
    var go = function () { location.href = 'app.html#/overview'; };
    $('#loginBtn').onclick = go;
    $('#heroLogin').onclick = go;
  }
  if (/[?&]need=1/.test(location.search)) {
    U.toast('请登录后再进入控制台', 'warn');
    history.replaceState(null, '', location.pathname);
  }

  /* ---------- 能力卡片 / 流程 / 场景 ---------- */
  var ABILITIES = [
    { ico: 'building', t: '鹅场与鹅舍管理', p: '多鹅场、多鹅舍、多批次台账。品种、入栏日期、饲养员、在栏数量一目了然，支持新增、编辑、停舍与导出。', tags: ['台账', '批次', '导出'] },
    { ico: 'cam', t: '视频监控与 AI 识别', p: '各鹅舍监控通道实时预览，AI 自动识别疑似病鹅、拥挤与异常行为，识别结果一键生成工单。', tags: ['实时画面', 'AI 识别', '告警联动'] },
    { ico: 'radar', t: '环境监测与预警', p: '温度、湿度、氨气、风速、二氧化碳秒级刷新，越限自动生成预警工单，支持处理、忽略与批量操作。', tags: ['多指标', '越限预警', '工单闭环'] },
    { ico: 'clipboard', t: '死淘记录与溯源', p: '按鹅舍逐条登记死淘原因与处置方式，自动扣减在栏数、重算死淘率，全程留痕可追溯。', tags: ['死因分析', '自动核减', '溯源'] },
    { ico: 'shield', t: '保险存证', p: '死淘、环境异常一键生成带数据指纹的存证记录，理赔时把口头描述变成可核验的档案。', tags: ['数据指纹', '理赔材料'] },
    { ico: 'chart', t: '数据报表', p: '任意时间段、任意鹅场维度出报表：死淘趋势、异常构成、鹅舍排行，一键导出或打印。', tags: ['趋势', '排行', '导出'] },
    { ico: 'cpu', t: '设备管理', p: '摄像头、传感器与边缘网关统一管理，实时查看在线状态、电量与信号，支持远程重启。', tags: ['在线率', '电量', '远程运维'] }
  ];
  $('#abilityCards').innerHTML = ABILITIES.map(function (a) {
    return '<article class="f-card reveal"><span class="f-ico">' + U.icon(a.ico) + '</span><h3>' + a.t + '</h3><p>' + a.p + '</p><ul>' +
      a.tags.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul></article>';
  }).join('');
  $$('#abilityCards .reveal').forEach(function (el) { revealIO.observe(el); });

  var FLOWS = [
    { t: '现场采集', p: '温湿度、氨气、风速传感器与摄像头按秒级频率上报，断线自动标记离线。' },
    { t: '越界预警', p: '比对当季阈值，异常即刻推送到饲养员手机与控制台工单池。' },
    { t: '处置留痕', p: '谁处理、怎么处理、几点处理，连同死淘登记一起入库。' },
    { t: '存证理赔', p: '生成带数据指纹的存证记录，保险公司凭记录快速定损。' }
  ];
  $('#flowList').innerHTML = FLOWS.map(function (f, i) {
    return '<li class="reveal"><span class="flow-no">0' + (i + 1) + '</span><h3>' + f.t + '</h3><p>' + f.p + '</p></li>';
  }).join('');
  $$('#flowList .reveal').forEach(function (el) { revealIO.observe(el); });

  var SCENES = [
    { t: '大型养殖企业', d: '多场区统一管理，总部实时查看各场环境与死淘数据，权限分级到人。' },
    { t: '合作社联合体', d: '小规模养殖户并入统一平台，环境异常由技术员统一响应，降低单户设备成本。' },
    { t: '保险与金融机构', d: '死淘与环境存证自动归档，理赔定损有据可查，风控模型可复用历史数据。' }
  ];
  $('#sceneCards').innerHTML = SCENES.map(function (s, i) {
    return '<article class="s-card reveal"><b>场景 0' + (i + 1) + '</b><h3>' + s.t + '</h3><p>' + s.d + '</p></article>';
  }).join('');
  $$('#sceneCards .reveal').forEach(function (el) { revealIO.observe(el); });

  /* ---------- 商务合作表单 ---------- */
  $('#cForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, ok = true;
    function chk(name, test, msg) {
      var el = f.querySelector('[name="' + name + '"]'), box = el.closest('.field');
      var bad = !test(el.value.trim());
      box.classList.toggle('bad', bad);
      box.querySelector('.err').textContent = bad ? msg : '';
      if (bad) ok = false;
    }
    chk('name', function (v) { return v.length >= 2; }, '请填写至少 2 个字的称呼');
    chk('phone', function (v) { return /^1\d{10}$/.test(v); }, '请输入正确的 11 位手机号');
    if (!ok) return;
    var v = { name: f.name.value.trim(), phone: f.phone.value.trim(), size: f.farm.value, msg: f.msg.value.trim() };
    S.log('商务申请提交', v.name);
    try {
      var db = S.db();
      db.messages.unshift({ id: 'msg_' + Date.now(), title: '开通申请：' + v.name + '（' + v.size + '）', body: '手机号 ' + v.phone + '；需求：' + (v.msg || '未填写') + '。', ts: S.util.tstr(new Date()), read: false, kind: 'info' });
      S.save();
    } catch (err) {}
    U.toast('提交成功！1 个工作日内会有顾问与您联系', 'ok', 3200);
    f.reset();
  });
})(window);
