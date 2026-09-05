/* ================= 门户页交互 + 登录（适配新版 index.html） ================= */
(function (global) {
  'use strict';
  var S = HY.store, U = HY.ui, C = HY.charts;
  var $ = function(s, r){ return (r||document).querySelector(s); };
  var $$ = function(s, r){ return [].slice.call((r||document).querySelectorAll(s)); };

  /* ---------- 顶栏：吸顶 + 滚动高亮 + 移动端菜单 ---------- */
  var hd = $('#siteHd'), nav = $('#siteNav');
  window.addEventListener('scroll', function(){
    hd.classList.toggle('solid', window.scrollY > 8);
    var y = window.scrollY + 130, cur = 'hero';
    $$('section[id]').forEach(function(s){ if (s.offsetTop <= y) cur = s.id; });
    $$('#siteNav a').forEach(function(a){ a.classList.toggle('on', a.getAttribute('href') === '#' + cur); });
  }, { passive:true });

  $('#menuBtn').addEventListener('click', function(){
    var open = nav.classList.toggle('open');
    this.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  $$('#siteNav a').forEach(function(a){
    a.addEventListener('click', function(e){
      e.preventDefault();
      var t = $(a.getAttribute('href'));
      if (t) window.scrollTo({ top: t.offsetTop - 64, behavior:'smooth' });
      nav.classList.remove('open');
    });
  });
  $$('.site-ft nav a').forEach(function(a){
    a.addEventListener('click', function(e){
      e.preventDefault();
      var t = $(a.getAttribute('href'));
      if (t) window.scrollTo({ top: t.offsetTop - 64, behavior:'smooth' });
    });
  });

  /* ---------- 滚动显现 ---------- */
  var rv = new IntersectionObserver(function(es){
    es.forEach(function(e){ if (e.isIntersecting){ e.target.classList.add('in'); rv.unobserve(e.target); } });
  }, { threshold:.15 });
  $$('.reveal').forEach(function(el){ rv.observe(el); });

  /* ---------- 数据条数字滚动 ---------- */
  var io = new IntersectionObserver(function(es){
    es.forEach(function(e){
      if (!e.isIntersecting || e.target.__done) return;
      e.target.__done = 1;
      var el = e.target, to = +el.dataset.to, sfx = el.dataset.suffix || '';
      var dec = String(to).indexOf('.') > -1 ? 1 : 0, t0 = Date.now(), dur = 1200;
      (function step(){
        var p = Math.min(1, (Date.now()-t0)/dur), v = to * (1 - Math.pow(1-p, 3));
        el.textContent = (dec ? v.toFixed(1) : Math.round(v).toLocaleString('zh-CN')) + sfx;
        if (p < 1) requestAnimationFrame(step);
      })();
    });
  }, { threshold:.4 });
  $$('.cnt[data-to]').forEach(function(el){ io.observe(el); });

  /* ---------- 门户小看板：KPI + 图表（与控制台同一套图表代码） ---------- */
  var k = S.kpi(), t30 = S.deathTrend(30);
  $('#pk1').textContent = (k.stock || 0).toLocaleString('zh-CN');
  $('#pk2').textContent = k.todayAlert || 0;
  $('#pk3').textContent = (k.deathRate != null ? k.deathRate.toFixed(1) : '0.0');
  C.combo($('#pChart'), {
    labels:t30.labels, height:120, lUnit:'%', xTickEvery:10,
    xFmt:function(d){ return d.slice(5); },
    series:[{ name:'累计死淘率', type:'line', color:'#7a5af8', data:t30.cum, unit:'%' }]
  });
  C.donut($('#pDonut'), { items:S.alertTypeShare(30).items, height:170, title:'合计', unit:' 起' });

  /* ---------- 能力卡片 / 运行流程 / 应用场景（JS 渲染） ---------- */
  var ABILITIES = [
    { ico:'radar', title:'环境监测预警', desc:'温度、湿度、氨气、通风 7×24 实时采集，越阈 5 分钟内推送并生成预警工单。', tags:['实时监测','阈值联动','消息推送'] },
    { ico:'building', title:'鹅场与鹅舍管理', desc:'鹅场档案、鹅舍台账、批次品种与在栏数量一目了然，支持增删改查与导出。', tags:['多场区','批次管理','台账导出'] },
    { ico:'clipboard', title:'死淘溯源记录', desc:'逐只登记死淘，记录到鹅舍、批次与原因，在栏数量自动核减。', tags:['逐条登记','原因分析','自动核减'] },
    { ico:'shield', title:'保险理赔存证', desc:'死淘与环境异常一键生成存证，哈希指纹不可篡改，理赔材料随时导出。', tags:['哈希存证','一键生成','理赔材料'] },
    { ico:'chart', title:'数据报表', desc:'自定义区间与维度生成经营分析，日死淘、死淘率、预警与存证全量汇总。', tags:['经营分析','CSV 导出','打印 PDF'] },
    { ico:'gear', title:'系统设置', desc:'预警阈值、通知方式、账号权限与外观主题自由配置，数据可备份恢复。', tags:['阈值配置','账号权限','备份恢复'] }
  ];
  $('#abilityCards').innerHTML = ABILITIES.map(function(a){
    return '<div class="f-card"><div class="f-ico"><span class="ico">' + U.icon(a.ico) + '</span></div>' +
      '<h3>' + a.title + '</h3><p>' + a.desc + '</p>' +
      '<ul>' + a.tags.map(function(t){ return '<li>' + t + '</li>'; }).join('') + '</ul></div>';
  }).join('');

  var FLOW = [
    { h:'环境采集', p:'传感器定时回传温湿度、氨气与风速，异常数据第一时间上报平台。' },
    { h:'智能预警', p:'越阈自动生成预警工单，按级别推送，5 分钟内触达饲养员与场长。' },
    { h:'处置登记', p:'线上处理并登记措施与处理人，死淘逐条记录、在栏自动核减。' },
    { h:'理赔存证', p:'处置过程与死淘数据自动存证，一键打包理赔材料，全程可追溯。' }
  ];
  $('#flowList').innerHTML = FLOW.map(function(f){
    return '<li><h3>' + f.h + '</h3><p>' + f.p + '</p></li>';
  }).join('');

  var SCENES = [
    { tag:'规模化养殖场', title:'大型肉鹅养殖企业', desc:'15+ 栋鹅舍统一接入，场长手机实时盯盘，异常不隔夜。' },
    { tag:'公司 + 农户', title:'订单养殖合作模式', desc:'公司统一平台监测合作农户鹅舍，死淘与理赔数据真实可核。' },
    { tag:'保险与监管', title:'保险公司与主管部门', desc:'存证数据哈希可信、不可篡改，理赔核赔效率大幅提升。' }
  ];
  $('#sceneCards').innerHTML = SCENES.map(function(s){
    return '<div class="s-card"><b>' + s.tag + '</b><h3>' + s.title + '</h3><p>' + s.desc + '</p></div>';
  }).join('');

  /* ---------- 主题切换 ---------- */
  function applyTheme(){
    var theme = (S.db().settings || {}).theme || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    $('#themeIco').innerHTML = U.icon(theme === 'dark' ? 'sun' : 'moon');
  }
  $('#themeBtn').addEventListener('click', function(){
    var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    S.saveSettings({ theme: cur });
    applyTheme();
  });

  /* ---------- 登录 ---------- */
  var LOGIN_FIELDS = [
    { name:'username', label:'账号', required:true, placeholder:'如 admin', col2:true },
    { name:'password', label:'密码', type:'password', required:true, placeholder:'演示密码 123456', col2:true }
  ];

  function openLogin(target){
    if (S.session()){ location.href = 'app.html#/' + (target || 'overview'); return; }
    var api = U.modal({
      title:'登录 寒羽智瞳',
      size:'sm',
      body:'<div class="login-box"><div class="chips">' +
             '<button class="chip" data-u="admin">超级管理员 admin</button>' +
             '<button class="chip" data-u="farm">场长 farm</button>' +
             '<button class="chip" data-u="keeper">饲养员 keeper</button>' +
           '</div>' +
           '<form id="loginForm" novalidate><div id="loginFields"></div>' +
           '<div class="login-row"><label class="switch"><input type="checkbox" id="remember"><i></i>' +
           '<span>记住我（7 天免登录）</span></label></div>' +
           '<button class="btn btn-primary block" type="submit">登录并进入控制台</button></form>' +
           '<p class="form-tip" style="margin-top:10px">演示账号统一密码 123456；访客可点首页「访客免密体验」直接进入。</p></div>',
      onMount:function(bd){
        bd.querySelector('#loginFields').innerHTML = U.formHtml(LOGIN_FIELDS);
        bd.querySelectorAll('.chip').forEach(function(c){
          c.onclick = function(){
            bd.querySelector('[data-f="username"]').value = c.dataset.u;
            bd.querySelector('[data-f="password"]').value = '123456';
          };
        });
        bd.querySelector('#loginForm').onsubmit = function(e){
          e.preventDefault();
          var v = U.formCheck(bd.querySelector('#loginFields'), LOGIN_FIELDS);
          if (!v) return;
          var remember = bd.querySelector('#remember').checked;
          var res = S.login(v.username, v.password, remember);
          if (!res.ok){ U.toast(res.msg, 'err'); return; }
          U.toast('欢迎回来，' + res.session.name, 'ok', 1200);
          api.close();
          setTimeout(function(){ location.href = 'app.html#/' + (target || 'overview'); }, 320);
        };
      }
    });
  }

  $('#loginBtn').addEventListener('click', function(){ openLogin(); });
  $('#heroLogin').addEventListener('click', function(){ openLogin(); });
  $('#heroGuest').addEventListener('click', function(){
    S.loginGuest();
    U.toast('已以访客身份进入（只读）', 'ok', 1200);
    setTimeout(function(){ location.href = 'app.html#/overview'; }, 300);
  });

  /* 已登录 → 按钮改为「进入控制台」 */
  var s0 = S.session();
  if (s0){
    $('#loginBtn').textContent = '进入控制台 →';
    $('#heroLogin').textContent = '进入控制台 →';
    $('#heroGuest').textContent = '退出登录';
    $('#heroGuest').onclick = function(){ S.logout(); location.reload(); };
  }
  if (/[?&]need=1/.test(location.search)){
    U.toast('请先登录后再进入控制台', 'warn');
    history.replaceState(null, '', location.pathname);
  }

  /* ---------- 预约演示表单 ---------- */
  $('#cForm').addEventListener('submit', function(e){
    e.preventDefault();
    var f = e.target, ok = true;
    function chk(name, test, msg){
      var el = f.querySelector('[name="'+name+'"]'), box = el.closest('.field');
      var bad = !test(el.value.trim());
      box.classList.toggle('bad', bad);
      var err = box.querySelector('.err');
      if (err) err.textContent = bad ? msg : '';
      if (bad) ok = false;
    }
    chk('name', function(v){ return v.length >= 2; }, '请填写至少 2 个字的称呼');
    chk('phone', function(v){ return /^1\d{10}$/.test(v); }, '请输入正确的 11 位手机号');
    if (!ok) return;
    var v = { name:f.name.value.trim(), phone:f.phone.value.trim(), size:f.size.value, msg:f.msg.value.trim() };
    S.addMsg('演示预约：' + v.name + '（' + v.size + '）',
      '手机号 ' + v.phone + '；诉求：' + (v.msg || '未填写') + '。请 24 小时内回电。');
    U.toast('提交成功！登录后在「消息」中可看到这条留言', 'ok', 3200);
    f.reset();
  });

  applyTheme();
})(window);
