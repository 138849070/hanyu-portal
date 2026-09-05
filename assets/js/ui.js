/* ================= UI 组件：Toast / 弹窗 / 抽屉 / 气泡 / 表格 / 表单 ================= */
(function (global) {
  'use strict';
  function esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g, function(c){
      return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c];
    });
  }
  var ICONS = {
    home:'<path d="M3 10.6 12 4l9 6.6V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    building:'<path d="M3 21V6.2L9 3v18M9 21h12V10.4L15 8.2M13 12h2M13 16h2M6 9.5h.8M6 13.5h.8M6 17.5h.8"/>',
    radar:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.6"/><path d="M12 12 19 5"/>',
    clipboard:'<path d="M9 4.5h6v2.8H9zM7.2 6.6H5.2V21h13.6V6.6h-2M9 12.4h6M9 16.4h4"/>',
    shield:'<path d="M12 3.2 20 6v6.2c0 5-3.6 8-8 8.9-4.4-.9-8-3.9-8-8.9V6z"/><path d="m9 12 2.2 2.2L15.2 10"/>',
    chart:'<path d="M4 20V4M4 20h16M8.2 16v-4.6M12.4 16V8.4M16.6 16V6.6"/>',
    gear:'<circle cx="12" cy="12" r="3.4"/><path d="M12 2.6l1.3 2 2.4-.4.6 2.4 2.2 1-1 2.2 1 2.2-2.2 1-.6 2.4-2.4-.4-1.3 2-1.3-2-2.4.4-.6-2.4-2.2-1 1-2.2-1-2.2 2.2-1 .6-2.4 2.4.4z"/>',
    goose:'<path d="M15.2 4.6a2.6 2.6 0 1 0-2.6 2.6v3.6c0 3.7-3 6.7-6.7 6.7"/><path d="M5.9 17.5h7.4a5.2 5.2 0 0 0 5.2-5.2"/><path d="m17.6 4.1 2.6.7-2.3 1.3"/>',
    bell:'<path d="M18 15v-4a6 6 0 1 0-12 0v4l-1.6 2.4h15.2z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
    trend:'<path d="M3 17l5.5-5.5 3.5 3.5L21 6"/><path d="M15 6h6v6"/>',
    box:'<path d="M12 3 4 7v10l8 4 8-4V7z"/><path d="m4 7 8 4 8-4M12 21V11"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    edit:'<path d="M16.6 3.7a2 2 0 0 1 2.8 2.8L8.4 17.6l-4 1.1 1.1-4z"/>',
    trash:'<path d="M4 7h16M9.5 7V4.6h5V7M6.5 7l1 13.4h9L17 7M10.4 11v6M13.6 11v6"/>',
    download:'<path d="M12 4v11M7.5 10.8 12 15.3l4.5-4.5M5 20h14"/>',
    close:'<path d="M6 6l12 12M18 6 6 18"/>',
    search:'<circle cx="11" cy="11" r="6.4"/><path d="m16 16 4 4"/>',
    check:'<path d="m5 13 4.5 4.5L19 7"/>',
    eye:'<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    refresh:'<path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.6"/><path d="M4 4.6v4h4"/><path d="M4 13a8 8 0 0 0 13.7 4.7L20 15.4"/><path d="M20 19.4v-4h-4"/>',
    logout:'<path d="M15 4.5H19a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-4"/><path d="M11 8.5 7.5 12l3.5 3.5M7.5 12H16"/>',
    user:'<circle cx="12" cy="8.2" r="3.8"/><path d="M4.8 20.2c.6-3.6 3.6-5.6 7.2-5.6s6.6 2 7.2 5.6"/>',
    print:'<path d="M7 9V4h10v5M7 18H5v-6h14v6h-2M8 14h8v6H8z"/>',
    copy:'<path d="M9.5 9.5h9v9h-9z"/><path d="M14.5 6.5h-9v9"/>',
    ban:'<circle cx="12" cy="12" r="8.4"/><path d="m6.2 6.2 11.6 11.6"/>',
    filter:'<path d="M4 5h16l-6.4 7.6V19l-3.2-1.8v-4.6z"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
    moon:'<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>'
  };
  function icon(n, size){
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round"' + (size?' width="'+size+'" height="'+size+'"':'') +
      ' aria-hidden="true">' + (ICONS[n]||'') + '</svg>';
  }

  /* ---------- Toast ---------- */
  var tw;
  function toast(msg, kind, ms){
    if (!tw){ tw = document.createElement('div'); tw.className = 'toasts'; document.body.appendChild(tw); }
    var em = { ok:'✅', warn:'⚠️', err:'⛔', info:'💡' }[kind||'info'];
    var d = document.createElement('div');
    d.className = 'toast ' + (kind||'');
    d.setAttribute('role','status');
    d.innerHTML = '<em>'+em+'</em><span>'+esc(msg)+'</span>';
    tw.appendChild(d);
    setTimeout(function(){
      d.style.transition = '.25s'; d.style.opacity = 0; d.style.transform = 'translateY(-8px)';
      setTimeout(function(){ d.remove(); }, 260);
    }, ms || 2600);
  }

  /* ---------- 遮罩层通用 ---------- */
  var stack = [];
  function openLayer(maskCls, inner){
    var mask = document.createElement('div');
    mask.className = 'mask ' + (maskCls||'');
    mask.appendChild(inner);
    document.body.appendChild(mask);
    document.body.style.overflow = 'hidden';
    var prev = document.activeElement;
    function close(){
      mask.remove();
      stack = stack.filter(function(x){ return x.mask !== mask; });
      if (!stack.length) document.body.style.overflow = '';
      if (prev && prev.focus) try{ prev.focus(); }catch(e){}
    }
    mask.addEventListener('mousedown', function(e){ if (e.target === mask) close(); });
    var item = { mask:mask, close:close };
    stack.push(item);
    setTimeout(function(){
      var f = inner.querySelector('input,select,textarea,button');
      if (f) try{ f.focus(); }catch(e){}
    }, 40);
    return item;
  }
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && stack.length){ stack[stack.length-1].close(); }
    if (e.key === 'Tab' && stack.length){
      var box = stack[stack.length-1].mask;
      var f = box.querySelectorAll('button,input,select,textarea,a[href]');
      if (!f.length) return;
      var first = f[0], last = f[f.length-1];
      if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
    }
  });
  function hasOverlay(){ return stack.length > 0; }

  /**
   * 弹窗 modal({title, body, size, actions:[{text,kind,primary,onClick(api)}], onMount(bodyEl,api)})
   */
  function modal(opt){
    var m = document.createElement('div');
    m.className = 'modal ' + (opt.size||'');
    m.setAttribute('role','dialog'); m.setAttribute('aria-modal','true');
    m.innerHTML =
      '<div class="modal-hd"><h3>'+esc(opt.title||'')+'</h3>' +
      '<button class="icon-btn" data-x aria-label="关闭">'+icon('close')+'</button></div>' +
      '<div class="modal-bd"></div>' +
      (opt.actions ? '<div class="modal-ft"></div>' : '');
    var bd = m.querySelector('.modal-bd');
    if (typeof opt.body === 'string') bd.innerHTML = opt.body; else if (opt.body) bd.appendChild(opt.body);
    var layer = openLayer('', m);
    var api = { el:m, body:bd, close:layer.close };
    m.querySelector('[data-x]').onclick = layer.close;
    if (opt.actions){
      var ft = m.querySelector('.modal-ft');
      opt.actions.forEach(function(a){
        var b = document.createElement('button');
        b.className = 'btn ' + (a.primary ? 'btn-primary' : (a.kind ? 'btn-'+a.kind : 'btn-line'));
        b.textContent = a.text;
        b.onclick = function(){ a.onClick ? a.onClick(api) : layer.close(); };
        ft.appendChild(b);
      });
    }
    if (opt.onMount) opt.onMount(bd, api);
    return api;
  }

  function confirm2(msg, title){
    return new Promise(function(res){
      modal({ title: title || '请确认', size:'sm', body:'<p style="padding:6px 0 10px;color:var(--ink-2)">'+esc(msg)+'</p>',
        actions:[
          { text:'取消', onClick:function(a){ a.close(); res(false); } },
          { text:'确定', primary:true, onClick:function(a){ a.close(); res(true); } }
        ]});
    });
  }

  /** 抽屉 drawer({title, rows:[[label,value]], html}) */
  function drawer(opt){
    var d = document.createElement('div');
    d.className = 'drawer';
    d.setAttribute('role','dialog'); d.setAttribute('aria-modal','true');
    d.innerHTML = '<div class="modal-hd"><h3>'+esc(opt.title||'详情')+'</h3>' +
      '<button class="icon-btn" data-x aria-label="关闭">'+icon('close')+'</button></div>' +
      '<div class="modal-bd" style="flex:1">' +
        (opt.rows ? opt.rows.map(function(r){ return '<div class="dl"><b>'+esc(r[0])+'</b><span>'+(r[2]?r[1]:esc(r[1]))+'</span></div>'; }).join('') : '') +
        (opt.html||'') +
      '</div>' + (opt.actions?'<div class="modal-ft"></div>':'');
    var layer = openLayer('drawer-mask', d);
    var api = { el:d, body:d.querySelector('.modal-bd'), close:layer.close };
    d.querySelector('[data-x]').onclick = layer.close;
    if (opt.actions){
      var ft = d.querySelector('.modal-ft');
      opt.actions.forEach(function(a){
        var b = document.createElement('button');
        b.className = 'btn ' + (a.primary?'btn-primary':(a.kind?'btn-'+a.kind:'btn-line'));
        b.textContent = a.text; b.onclick = function(){ a.onClick ? a.onClick(api) : layer.close(); };
        ft.appendChild(b);
      });
    }
    if (opt.onMount) opt.onMount(api.body, api);
    return api;
  }

  /* ---------- 气泡菜单 ---------- */
  var curPop = null;
  function popover(anchor, html, onMount){
    closePop();
    var p = document.createElement('div');
    p.className = 'pop'; p.innerHTML = html;
    document.body.appendChild(p);
    var r = anchor.getBoundingClientRect();
    var left = Math.min(r.right - p.offsetWidth, window.innerWidth - p.offsetWidth - 10);
    p.style.left = Math.max(10, left) + 'px';
    p.style.top = (r.bottom + 8) + 'px';
    curPop = p;
    setTimeout(function(){ document.addEventListener('mousedown', outside); }, 0);
    function outside(e){ if (!p.contains(e.target) && !anchor.contains(e.target)) closePop(); }
    p.__off = function(){ document.removeEventListener('mousedown', outside); };
    if (onMount) onMount(p, closePop);
    return p;
  }
  function closePop(){ if (curPop){ curPop.__off && curPop.__off(); curPop.remove(); curPop = null; } }
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closePop(); });

  /* ---------- 表格 ---------- */
  function table(opt){
    var cols = opt.columns, rows = opt.rows || [], ps = opt.pageSize || 0;
    var page = Math.max(1, opt.page || 1);
    var totalPage = ps ? Math.max(1, Math.ceil(rows.length / ps)) : 1;
    if (page > totalPage) page = totalPage;
    var view = ps ? rows.slice((page-1)*ps, page*ps) : rows;
    if (!rows.length){
      return '<div class="empty"><span>🗂️</span>' + esc(opt.empty || '暂无数据') + '</div>';
    }
    var h = '<div class="tbl-wrap"><table class="tbl"><thead><tr>';
    if (opt.selectable) h += '<th style="width:36px"><input type="checkbox" data-check-all aria-label="全选"></th>';
    cols.forEach(function(c){
      h += '<th' + (c.width?' style="width:'+c.width+'"':'') + (c.align?' align="'+c.align+'"':'') + '>' + esc(c.title) + '</th>';
    });
    h += '</tr></thead><tbody>';
    view.forEach(function(row, i){
      h += '<tr' + (opt.rowAttr ? ' ' + opt.rowAttr(row) : '') + '>';
      if (opt.selectable) h += '<td><input type="checkbox" data-check="'+esc(row.id)+'"' +
        (opt.selected && opt.selected[row.id] ? ' checked' : '') + ' aria-label="选择该行"></td>';
      cols.forEach(function(c){
        var v = c.render ? c.render(row, (page-1)*ps + i) : esc(row[c.key]);
        h += '<td' + (c.align?' align="'+c.align+'"':'') + (c.cls?' class="'+c.cls+'"':'') + '>' + (v==null?'-':v) + '</td>';
      });
      h += '</tr>';
    });
    h += '</tbody></table></div>';
    if (ps && totalPage > 1){
      h += '<div class="pager"><span>共 ' + rows.length + ' 条 / ' + totalPage + ' 页</span>' +
        '<button data-page="'+(page-1)+'"' + (page===1?' disabled':'') + '>上一页</button>';
      var s = Math.max(1, page-2), e2 = Math.min(totalPage, s+4); s = Math.max(1, e2-4);
      for (var p2=s;p2<=e2;p2++) h += '<button data-page="'+p2+'"' + (p2===page?' class="on"':'') + '>'+p2+'</button>';
      h += '<button data-page="'+(page+1)+'"' + (page===totalPage?' disabled':'') + '>下一页</button></div>';
    } else if (ps){
      h += '<div class="pager"><span>共 ' + rows.length + ' 条</span></div>';
    }
    return h;
  }

  /* ---------- 表单 ---------- */
  function formHtml(fields, grid){
    var h = grid ? '<div class="grid-f">' : '';
    fields.forEach(function(f){
      var id = 'f_' + f.name + '_' + Math.random().toString(36).slice(2,6);
      var cls = 'field' + (f.col2 ? ' col2' : '');
      if (f.type === 'switch'){
        h += '<div class="'+cls+'"><label class="switch"><input type="checkbox" data-f="'+f.name+'"' +
          (f.value?' checked':'') + '><i></i><span>'+esc(f.label)+'</span></label>' +
          (f.hint?'<p class="field-hint">'+esc(f.hint)+'</p>':'') + '</div>';
        return;
      }
      h += '<div class="'+cls+'"><label for="'+id+'">'+esc(f.label)+(f.required?' <b>*</b>':'')+'</label>';
      if (f.type === 'select'){
        h += '<select id="'+id+'" data-f="'+f.name+'"'+(f.disabled?' disabled':'')+'>' +
          (f.options||[]).map(function(o){
            var val = (o && typeof o === 'object') ? o.value : o;
            var txt = (o && typeof o === 'object') ? o.text : o;
            return '<option value="'+esc(val)+'"'+(String(f.value)===String(val)?' selected':'')+'>'+esc(txt)+'</option>';
          }).join('') + '</select>';
      } else if (f.type === 'textarea'){
        h += '<textarea id="'+id+'" rows="'+(f.rows||3)+'" data-f="'+f.name+'" placeholder="'+
          esc(f.placeholder||'')+'">'+esc(f.value||'')+'</textarea>';
      } else {
        h += '<input id="'+id+'" type="'+(f.type||'text')+'" data-f="'+f.name+'" value="'+
          esc(f.value==null?'':f.value)+'" placeholder="'+esc(f.placeholder||'')+'"' +
          (f.min!=null?' min="'+f.min+'"':'') + (f.max!=null?' max="'+f.max+'"':'') +
          (f.step!=null?' step="'+f.step+'"':'') + (f.disabled?' disabled':'') + '>';
      }
      h += '<span class="field-err"></span>';
      if (f.hint) h += '<p class="field-hint">'+esc(f.hint)+'</p>';
      h += '</div>';
    });
    return h + (grid ? '</div>' : '');
  }
  function formRead(root){
    var o = {};
    [].forEach.call(root.querySelectorAll('[data-f]'), function(el){
      var n = el.getAttribute('data-f');
      o[n] = el.type === 'checkbox' ? el.checked
           : (el.type === 'number' ? (el.value === '' ? '' : +el.value) : String(el.value).trim());
    });
    return o;
  }
  /** 校验通过返回值对象，否则返回 null 并在界面标红 */
  function formCheck(root, fields){
    var ok = true, v = formRead(root);
    fields.forEach(function(f){
      var el = root.querySelector('[data-f="'+f.name+'"]');
      if (!el || f.type === 'switch') return;
      var box = el.parentNode, err = box.querySelector('.field-err'), msg = '';
      var val = v[f.name];
      if (f.required && (val === '' || val == null)) msg = '请填写' + f.label;
      else if (f.type === 'number' && val !== ''){
        if (f.min != null && val < f.min) msg = '不能小于 ' + f.min;
        else if (f.max != null && val > f.max) msg = '不能大于 ' + f.max;
      } else if (f.rule && val !== '' && !f.rule.re.test(val)) msg = f.rule.msg;
      box.classList.toggle('bad', !!msg);
      if (err) err.textContent = msg;
      if (msg) ok = false;
    });
    return ok ? v : null;
  }

  /* ---------- 文件导出 / 复制 ---------- */
  function download(name, text, mime){
    var blob = new Blob(['\ufeff' + text], { type: (mime||'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function(){ a.remove(); URL.revokeObjectURL(url); }, 300);
  }
  function csv(name, header, rows){
    var cell = function(v){ v = String(v==null?'':v); return /[",\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; };
    var txt = header.map(cell).join(',') + '\n' + rows.map(function(r){ return r.map(cell).join(','); }).join('\n');
    download(name, txt, 'text/csv');
    toast('已导出 ' + rows.length + ' 条数据', 'ok');
  }
  function copy(text){
    if (navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(function(){ toast('已复制','ok'); },
        function(){ fallback(); });
    } else fallback();
    function fallback(){
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = 0;
      document.body.appendChild(ta); ta.select();
      try{ document.execCommand('copy'); toast('已复制','ok'); }catch(e){ toast('复制失败，请手动选择','warn'); }
      ta.remove();
    }
  }

  global.HY = global.HY || {};
  global.HY.ui = { esc:esc, icon:icon, toast:toast, modal:modal, confirm:confirm2, drawer:drawer,
    popover:popover, closePop:closePop, table:table, formHtml:formHtml, formRead:formRead,
    formCheck:formCheck, download:download, csv:csv, copy:copy, hasOverlay:hasOverlay };
})(window);
