/* ================= 手写 SVG 图表：组合图 / 环形图 / 条形图 / 迷你走势 ================= */
(function (global) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  function E(tag, attrs){
    var el = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    return el;
  }
  function money(n){ return (Math.round(n*100)/100).toLocaleString('zh-CN'); }
  function reg(box, fn){
    box.__redraw = fn; box.setAttribute('data-chart','1'); fn();
  }
  var t;
  window.addEventListener('resize', function(){
    clearTimeout(t);
    t = setTimeout(function(){
      [].forEach.call(document.querySelectorAll('[data-chart]'), function(b){ if (b.__redraw) b.__redraw(); });
    }, 160);
  });

  /** 平滑折线路径 */
  function smooth(pts){
    if (pts.length < 2) return '';
    var d = 'M' + pts[0][0] + ',' + pts[0][1];
    for (var i=0;i<pts.length-1;i++){
      var p0 = pts[i-1] || pts[i], p1 = pts[i], p2 = pts[i+1], p3 = pts[i+2] || p2;
      var c1x = p1[0] + (p2[0]-p0[0])/6, c1y = p1[1] + (p2[1]-p0[1])/6;
      var c2x = p2[0] - (p3[0]-p1[0])/6, c2y = p2[1] - (p3[1]-p1[1])/6;
      d += 'C' + c1x + ',' + c1y + ' ' + c2x + ',' + c2y + ' ' + p2[0] + ',' + p2[1];
    }
    return d;
  }

  /**
   * 组合图
   * opt: {labels:[], series:[{name,type:'bar'|'line',axis:'l'|'r',color,data,unit}], height, xTickEvery}
   */
  function combo(box, opt){
    reg(box, function(){
      box.innerHTML = '';
      var W = Math.max(300, box.clientWidth || 600), H = opt.height || box.clientHeight || 280;
      var series = (opt.series || []).filter(function(s){ return s.data && s.data.length; });
      if (!series.length || !opt.labels.length){
        box.innerHTML = '<div class="empty"><span>📉</span>该时间段暂无数据</div>'; return;
      }
      var hasR = series.some(function(s){ return s.axis === 'r'; });
      var pl = 46, pr = hasR ? 48 : 14, pt = 26, pb = 30;
      var iw = W - pl - pr, ih = H - pt - pb, n = opt.labels.length, band = iw / n;

      function scale(axis){
        var vals = [];
        series.forEach(function(s){ if ((s.axis||'l') === axis) vals = vals.concat(s.data); });
        if (!vals.length) return null;
        var mx = Math.max.apply(null, vals), mn = Math.min.apply(null, vals);
        mn = Math.min(mn, 0);
        if (mx === mn) mx = mn + 1;
        var step = Math.pow(10, Math.floor(Math.log(mx-mn)/Math.LN10)) ;
        var top = Math.ceil(mx/step*1.05)*step;
        return { min:mn, max:top || mx*1.1, y:function(v){ return pt + ih - (v-mn)/((top||mx*1.1)-mn)*ih; } };
      }
      var L = scale('l'), R = scale('r');

      var svg = E('svg',{ width:'100%', height:H, viewBox:'0 0 '+W+' '+H, role:'img',
        'aria-label': opt.aria || '数据图表' });
      var defs = E('defs');
      series.forEach(function(s,i){
        if (s.type !== 'line') return;
        var g = E('linearGradient',{ id:'g'+i+'_'+Math.random().toString(36).slice(2,6), x1:0,y1:0,x2:0,y2:1 });
        g.appendChild(E('stop',{ offset:'0%','stop-color':s.color,'stop-opacity':.34 }));
        g.appendChild(E('stop',{ offset:'100%','stop-color':s.color,'stop-opacity':0 }));
        s.__g = g.getAttribute('id'); defs.appendChild(g);
      });
      svg.appendChild(defs);

      /* 网格 + 左右轴 */
      for (var i=0;i<=4;i++){
        var y = pt + ih/4*i;
        svg.appendChild(E('line',{ x1:pl, y1:y, x2:pl+iw, y2:y, stroke:'currentColor',
          'stroke-opacity':i===4?.2:.08, 'stroke-dasharray': i===4?'':'3 4' }));
        if (L){
          var lv = L.min + (L.max-L.min)*(1-i/4);
          var tx = E('text',{ x:pl-8, y:y+4, 'text-anchor':'end', 'font-size':11, fill:'currentColor', 'fill-opacity':.45 });
          tx.textContent = money(lv) + (opt.lUnit||''); svg.appendChild(tx);
        }
        if (R){
          var rv = R.min + (R.max-R.min)*(1-i/4);
          var tr = E('text',{ x:pl+iw+8, y:y+4, 'font-size':11, fill:'currentColor', 'fill-opacity':.45 });
          tr.textContent = money(rv) + (opt.rUnit||''); svg.appendChild(tr);
        }
      }
      /* X 轴标签 */
      var every = opt.xTickEvery || Math.max(1, Math.round(n/(iw/68)));
      opt.labels.forEach(function(lb, idx){
        if (idx % every && idx !== n-1) return;
        var tx = E('text',{ x:pl + band*(idx+.5), y:H-9, 'text-anchor':'middle', 'font-size':11,
          fill:'currentColor','fill-opacity':.45 });
        tx.textContent = (opt.xFmt ? opt.xFmt(lb) : lb); svg.appendChild(tx);
      });

      /* 柱 */
      series.forEach(function(s){
        if (s.type !== 'bar') return;
        var sc = (s.axis||'l')==='r' ? R : L, bw = Math.min(16, band*0.55);
        s.data.forEach(function(v, idx){
          var y = sc.y(v), h = Math.max(v>0?2:0, pt+ih-y);
          svg.appendChild(E('rect',{ x:pl + band*(idx+.5) - bw/2, y:pt+ih-h, width:bw, height:h,
            rx:Math.min(4,bw/2), fill:s.color, 'fill-opacity':.28 }));
        });
      });
      /* 线 + 面积 */
      series.forEach(function(s){
        if (s.type === 'bar') return;
        var sc = (s.axis||'l')==='r' ? R : L;
        var pts = s.data.map(function(v, idx){ return [pl + band*(idx+.5), sc.y(v)]; });
        var d = smooth(pts);
        svg.appendChild(E('path',{ d: d + 'L'+pts[pts.length-1][0]+','+(pt+ih)+'L'+pts[0][0]+','+(pt+ih)+'Z',
          fill:'url(#'+s.__g+')', stroke:'none' }));
        svg.appendChild(E('path',{ d:d, fill:'none', stroke:s.color, 'stroke-width':2.4,
          'stroke-linecap':'round','stroke-linejoin':'round' }));
        if (n <= 32) pts.forEach(function(p){
          svg.appendChild(E('circle',{ cx:p[0], cy:p[1], r:3.4, fill:'var(--card)', stroke:s.color, 'stroke-width':2 }));
        });
      });

      /* 图例 */
      var lx = pl + iw, ly = 14;
      series.slice().reverse().forEach(function(s){
        var tw = s.name.length*12 + 20;
        lx -= tw;
        svg.appendChild(E('circle',{ cx:lx+5, cy:ly-4, r:4.5, fill:s.color }));
        var t2 = E('text',{ x:lx+14, y:ly, 'font-size':11.5, fill:'currentColor','fill-opacity':.6 });
        t2.textContent = s.name; svg.appendChild(t2);
      });

      /* 悬浮交互 */
      var cross = E('line',{ y1:pt, y2:pt+ih, stroke:'var(--brand)', 'stroke-opacity':.35, 'stroke-width':1, visibility:'hidden' });
      svg.appendChild(cross);
      var dots = series.map(function(s){
        var c = E('circle',{ r:5, fill:s.color, stroke:'var(--card)','stroke-width':2, visibility:'hidden' });
        svg.appendChild(c); return c;
      });
      var hit = E('rect',{ x:pl, y:pt, width:iw, height:ih, fill:'transparent' });
      svg.appendChild(hit);
      box.appendChild(svg);

      var tip = document.createElement('div');
      tip.className = 'chart-tip'; box.appendChild(tip);

      hit.addEventListener('mousemove', function(ev){
        var r0 = svg.getBoundingClientRect(), sx = W / r0.width;
        var x = (ev.clientX - r0.left) * sx;
        var idx = Math.max(0, Math.min(n-1, Math.floor((x - pl) / band)));
        cross.setAttribute('x1', pl + band*(idx+.5)); cross.setAttribute('x2', pl + band*(idx+.5));
        cross.setAttribute('visibility','visible');
        var html = '<b>' + (opt.tipTitle ? opt.tipTitle(opt.labels[idx]) : opt.labels[idx]) + '</b>';
        series.forEach(function(s, si){
          var sc = (s.axis||'l')==='r' ? R : L;
          dots[si].setAttribute('cx', pl + band*(idx+.5));
          dots[si].setAttribute('cy', sc.y(s.data[idx]));
          dots[si].setAttribute('visibility','visible');
          html += '<br><i style="background:'+s.color+'"></i>' + s.name + ' ' + money(s.data[idx]) + (s.unit||'');
        });
        tip.innerHTML = html; tip.style.opacity = 1;
        var tw = tip.offsetWidth, px = (pl + band*(idx+.5)) / sx;
        tip.style.left = Math.max(4, Math.min(r0.width - tw - 4, px - tw/2)) + 'px';
        tip.style.top = '4px';
      });
      hit.addEventListener('mouseleave', function(){
        tip.style.opacity = 0; cross.setAttribute('visibility','hidden');
        dots.forEach(function(d){ d.setAttribute('visibility','hidden'); });
      });
    });
  }

  /** 环形图 opt:{items:[{name,value,color}], title, unit} */
  function donut(box, opt){
    reg(box, function(){
      box.innerHTML = '';
      var items = (opt.items||[]).filter(function(i){ return i.value > 0; });
      if (!items.length){ box.innerHTML = '<div class="empty"><span>🍩</span>暂无数据</div>'; return; }
      var total = items.reduce(function(s,i){ return s + i.value; }, 0);
      var wrap = document.createElement('div'); wrap.className = 'donut-wrap';
      var svgBox = document.createElement('div'); svgBox.className = 'donut-svg';
      var legend = document.createElement('div'); legend.className = 'donut-legend';
      wrap.appendChild(svgBox); wrap.appendChild(legend); box.appendChild(wrap);

      var size = Math.max(150, Math.min(svgBox.clientWidth || 200, (opt.height || box.clientHeight || 240) - 8));
      var cx = size/2, cy = size/2, ro = size/2 - 6, riR = ro*0.62, ang = -Math.PI/2, gap = .022;
      var svg = E('svg',{ width:'100%', height:size, viewBox:'0 0 '+size+' '+size, role:'img',
        'aria-label': opt.aria || '占比图' });
      var paths = [];
      items.forEach(function(it, i){
        var a0 = ang + gap/2, a1 = ang + it.value/total*Math.PI*2 - gap/2; ang += it.value/total*Math.PI*2;
        if (a1 < a0) a1 = a0 + .001;
        var large = (a1-a0) > Math.PI ? 1 : 0;
        var d = 'M' + (cx+Math.cos(a0)*ro) + ',' + (cy+Math.sin(a0)*ro) +
                'A' + ro + ',' + ro + ' 0 ' + large + ' 1 ' + (cx+Math.cos(a1)*ro) + ',' + (cy+Math.sin(a1)*ro) +
                'L' + (cx+Math.cos(a1)*riR) + ',' + (cy+Math.sin(a1)*riR) +
                'A' + riR + ',' + riR + ' 0 ' + large + ' 0 ' + (cx+Math.cos(a0)*riR) + ',' + (cy+Math.sin(a0)*riR) + 'Z';
        var p = E('path',{ d:d, fill:it.color, style:'transition:.18s;transform-origin:'+cx+'px '+cy+'px' });
        svg.appendChild(p); paths.push(p);
      });
      var t1 = E('text',{ x:cx, y:cy-4, 'text-anchor':'middle', 'font-size':12, fill:'currentColor','fill-opacity':.5 });
      t1.textContent = opt.title || '合计';
      var t2 = E('text',{ x:cx, y:cy+20, 'text-anchor':'middle', 'font-size':22, 'font-weight':800, fill:'currentColor' });
      t2.textContent = total + (opt.unit||'');
      svg.appendChild(t1); svg.appendChild(t2);
      svgBox.appendChild(svg);

      items.forEach(function(it, i){
        var row = document.createElement('div');
        row.innerHTML = '<i style="background:'+it.color+'"></i><span>'+it.name+'</span><b>'+
          Math.round(it.value/total*100)+'%</b>';
        row.title = it.value + (opt.unit||'');
        row.addEventListener('mouseenter', function(){
          row.classList.add('on'); paths[i].style.transform = 'scale(1.045)';
          t1.textContent = it.name; t2.textContent = it.value + (opt.unit||'');
        });
        row.addEventListener('mouseleave', function(){
          row.classList.remove('on'); paths[i].style.transform = '';
          t1.textContent = opt.title || '合计'; t2.textContent = total + (opt.unit||'');
        });
        legend.appendChild(row);
      });
    });
  }

  /** 横向条形图（HTML 实现，天然响应式） */
  function hbar(box, opt){
    var items = opt.items || [];
    if (!items.length){ box.innerHTML = '<div class="empty"><span>📊</span>暂无数据</div>'; return; }
    var max = Math.max.apply(null, items.map(function(i){ return i.value; })) || 1;
    box.className = 'hbar';
    box.innerHTML = items.map(function(i){
      return '<div class="hbar-row"><span>' + i.name + '<b>' + money(i.value) + (opt.unit||'') + '</b></span>' +
        '<div class="hbar-bar"><i style="width:' + (i.value/max*100) + '%;background:' +
        (i.color || 'linear-gradient(90deg,var(--brand),var(--brand-2))') + '"></i></div></div>';
    }).join('');
  }

  /** 迷你走势 */
  function spark(box, data, color){
    var W = 74, H = 26, mx = Math.max.apply(null, data), mn = Math.min.apply(null, data);
    if (mx === mn) mx = mn + 1;
    var pts = data.map(function(v,i){
      return [i/(data.length-1)*W, H-2 - (v-mn)/(mx-mn)*(H-6)];
    });
    box.innerHTML = '<svg class="spark" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">' +
      '<polyline points="'+pts.map(function(p){return p[0]+','+p[1];}).join(' ')+
      '" fill="none" stroke="'+(color||'#176B56')+'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  global.HY = global.HY || {};
  global.HY.charts = { combo:combo, donut:donut, hbar:hbar, spark:spark };
})(window);
