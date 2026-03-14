// =============================================
// ESC Manager - gantt.js v2.0
// 공정별 / 배치별 / 제품별 간트차트
// =============================================

import * as S from './state.js';
import { PROC_COLORS } from './constants.js';

let ganttViewMode2 = 'process';
let ganttCellW = 28;
let ganttExpandState = {};

const G_ROW = 34;
const G_HEAD = 28;
const G_PROCS = S.PROC_ORDER;
const G_PROCS_EXT = S.PROC_ORDER.concat(PROC_COLORS['최종완료'] ? ['최종완료'] : []);
const G_CLR = PROC_COLORS;

const G_BATCH_PAL = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#ec4899','#14b8a6','#f97316','#6366f1','#84cc16',
  '#06b6d4','#e11d48','#7c3aed','#0ea5e9','#d946ef'
];
const G_BATCH_MAP = {};
let gBatchIdx = 0;

function gBatchColor(bid) {
  if (!bid) return '#666';
  if (!G_BATCH_MAP[bid]) {
    G_BATCH_MAP[bid] = G_BATCH_PAL[gBatchIdx % G_BATCH_PAL.length];
    gBatchIdx++;
  }
  return G_BATCH_MAP[bid];
}

function gDays(a, b) {
  if (!a || !b) return 0;
  return Math.round((new Date(b+'T00:00:00') - new Date(a+'T00:00:00')) / 86400000);
}

function gDateRange(filtered) {
  var mn = '9999-12-31', mx = '2000-01-01';
  Object.keys(filtered).forEach(function(sn) {
    var d = filtered[sn];
    var route = window.getRoute ? window.getRoute(sn, d) : [];
    route.forEach(function(proc) {
      var p = window.getProc ? window.getProc(d, proc) : {};
      var s = (window.fD ? window.fD(p.actualStart) : '') || (window.fD ? window.fD(p.planStart) : '');
      var e = (window.fD ? window.fD(p.actualEnd) : '') || (window.fD ? window.fD(p.planEnd) : '');
      if (s && s < mn) mn = s;
      if (e && e > mx) mx = e;
    });
  });
  // Fallback: if no valid dates found, use a 30-day window centred on today
  var todayStr = new Date().toISOString().slice(0,10);
  if (!mn || !mx || mn > mx || mn === '9999-12-31') {
    var tBase = new Date();
    tBase.setDate(tBase.getDate() - 7);
    mn = tBase.toISOString().slice(0,10);
    var tEnd = new Date();
    tEnd.setDate(tEnd.getDate() + 23);
    mx = tEnd.toISOString().slice(0,10);
  }
  var ds = new Date(mn+'T00:00:00');
  ds.setDate(ds.getDate() - 7);
  var de = new Date(mx+'T00:00:00');
  de.setDate(de.getDate() + 14);
  var arr = [];
  for (var c = new Date(ds); c <= de; c.setDate(c.getDate()+1)) {
    arr.push(c.toISOString().slice(0,10));
  }
  return arr;
}

window.setGanttView = function(mode, btn) {
  ganttViewMode2 = mode;
  ganttExpandState = {};
  document.querySelectorAll('.gantt-view-btn').forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
  window.renderGantt();
};

window.ganttZoom = function(delta) {
  ganttCellW = Math.max(12, Math.min(60, ganttCellW + delta));
  var lbl = document.getElementById('ganttZoomLabel');
  if (lbl) lbl.textContent = ganttCellW + 'px';
  window.renderGantt();
};

window.ganttGoToday = function() {
  var wrap = document.getElementById('ganttBodyWrap') || document.querySelector('.gantt-body-wrap');
  var line = document.querySelector('.gantt-today-line');
  if (wrap && line) {
    var x = parseFloat(line.style.left) - wrap.clientWidth / 2;
    wrap.scrollLeft = Math.max(0, x);
  }
};

window.ganttToggleAll = function() {
  var allExp = true;
  Object.keys(ganttExpandState).forEach(function(k) { if (!ganttExpandState[k]) allExp = false; });
  Object.keys(ganttExpandState).forEach(function(k) { ganttExpandState[k] = !allExp; });
  var btn = document.getElementById('ganttExpandAllBtn');
  if (btn) btn.textContent = allExp ? '모두 펼치기' : '모두 접기';
  window.renderGantt();
};

function toggleG(key) {
  ganttExpandState[key] = !ganttExpandState[key];
  window.renderGantt();
}
window.toggleG = toggleG;

function gMakeBar(sn, d, proc, dates) {
  var p = (window.getProc ? window.getProc(d, proc) : null) || {};
  var fD = window.fD || function(v){return '';};
  var s = fD(p.actualStart) || fD(p.planStart);
  var eAct = fD(p.actualEnd);
  var ePlan = fD(p.planEnd);
  var e = eAct || ePlan;
  // planStart가 없으면 planEnd에서 3일 전으로 추정
  if (!s && e) s = e;
  // 여전히 시작일 없으면 포기
  if (!s || !e) return null;
  // Ensure s <= e
  if (s > e) { var tmp = s; s = e; e = tmp; }
  var status = p.status || '대기';
  var today = new Date().toISOString().slice(0,10);
  var x1 = dates.indexOf(s);
  var x2 = dates.indexOf(e);
  if (x1 < 0) x1 = 0;
  if (x2 < 0) x2 = dates.length - 1;
  if (x2 < x1) x2 = x1;
  var bar = { x1:x1, x2:x2, proc:proc, sn:sn, status:status,
    bid: d.batchId||d.batch||'', pname: d.productName||'', s:s, e:e, eAct:eAct, ePlan:ePlan };
  if (status !== '완료' && ePlan && today > ePlan) {
    bar.delayed = true;
    bar.delayDays = gDays(ePlan, today);
    var todayIdx = dates.indexOf(today);
    if (todayIdx > x2) bar.x2over = todayIdx;
  }
  return bar;
}

function gGetSummaryBars(items, procList, dates) {
  var bars = [];
  var dFirst = dates[0], dLast = dates[dates.length - 1];
  
  procList.forEach(function(proc) {
    var mn = '9999-12-31', mx = '2000-01-01';
    var hasData = false, hasProg = false, hasComp = true;
    
    items.forEach(function(it) {
      if (!it.d) return;
      var p = window.getProc(it.d, proc);
      var s = window.fD(p.actualStart) || window.fD(p.planStart);
      var e = window.fD(p.actualEnd) || window.fD(p.planEnd);
      // 최종완료 특수 처리
      if (proc === '최종완료') {
        s = e = window.fD(it.d.completedAt);
      }

      if (s || e) {
        hasData = true;
        if (s && s < mn) mn = s;
        if (e && e > mx) mx = e;
        var ps = p.status || '대기';
        if (ps === '진행') hasProg = true;
        if (ps !== '완료') hasComp = false;
        if (proc === '최종완료' && it.d.status !== '완료') hasComp = false;
      }
    });

    if (hasData && mn <= mx) {
      if (mn > dLast || mx < dFirst) return; // 범위 밖
      
      var x1 = dates.indexOf(mn);
      if (x1 < 0) x1 = 0;
      var x2 = dates.indexOf(mx);
      if (x2 < 0) x2 = dates.length - 1;
      
      var sts = hasComp ? '완료' : (hasProg ? '진행' : '대기');
      var bar = { x1:x1, x2:x2, proc:proc, status:sts, s:mn, e:mx, isSummary:true };
      
      var today = new Date().toISOString().slice(0,10);
      if (sts !== '완료' && today > mx) {
        bar.delayed = true;
        bar.delayDays = Math.round((new Date(today+'T00:00:00') - new Date(mx+'T00:00:00')) / 86400000);
      }
      bars.push(bar);
    }
  });
  return bars;
}

function gBarStyle(bar) {
  var clr = G_CLR[bar.proc] || '#666';
  var bclr = gBatchColor(bar.bid);
  if (bar.status === '완료') {
    return 'background:'+clr+';opacity:0.85;background-image:repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(255,255,255,0.15) 3px,rgba(255,255,255,0.15) 6px);';
  } else if (bar.status === '진행') {
    return 'background:'+clr+';opacity:1;box-shadow:0 0 6px '+clr+'80;';
  } else {
    return 'background:'+clr+';opacity:0.3;';
  }
}

function gBuildProcess(filtered, dates) {
  var rows = [];
  var eqMap = window.EQ_MAP || {};
  G_PROCS.forEach(function(proc) {
    var procItems = [];
    Object.keys(filtered).forEach(function(sn) {
      var d = filtered[sn];
      var route = window.getRoute(sn, d);
      if (route.indexOf(proc) >= 0) procItems.push({ sn:sn, d:d });
    });
    
    rows.push({ type:'procHead', proc:proc, color:G_CLR[proc], bars: gGetSummaryBars(procItems, G_PROCS_EXT, dates) });

    var equipMap = {};
    var equipAll = [];
    if (eqMap[proc]) {
      (Array.isArray(eqMap[proc]) ? eqMap[proc] : []).forEach(function(eq) {
        equipAll.push(eq);
        equipMap[eq] = [];
      });
    }

    procItems.forEach(function(it) {
      var p = window.getProc(it.d, proc);
      var eq = p.equip || '미배정';
      if (!equipMap[eq]) {
        equipMap[eq] = [];
        if (equipAll.indexOf(eq) < 0) equipAll.push(eq);
      }
      equipMap[eq].push(it);
    });

    equipAll.sort(function(a,b) {
      return (parseInt(a) || 999) - (parseInt(b) || 999);
    });

    equipAll.forEach(function(eq) {
      var items = equipMap[eq] || [];
      var eqKey = 'procMode_' + proc + '_' + eq;
      if (typeof ganttExpandState[eqKey] === 'undefined') ganttExpandState[eqKey] = false;

      rows.push({ type:'equip', key:eqKey, label:eq, count:items.length, proc:proc,
        expanded:ganttExpandState[eqKey], bars: gGetSummaryBars(items, G_PROCS_EXT, dates) });

      if (ganttExpandState[eqKey]) {
        items.forEach(function(it) {
          var route = window.getRoute(it.sn, it.d);
          var bars = route.map(function(p){ return gMakeBar(it.sn, it.d, p, dates); }).filter(Boolean);
          rows.push({ type:'snLine', sn:it.sn, bars: bars, depth:2 });
        });
      }
    });
  });
  return rows;
}

function gBuildBatch(filtered, dates) {
  var rows = [];
  var batchMap = {};
  Object.keys(filtered).forEach(function(sn) {
    var d = filtered[sn];
    var bid = d.batchId || '미배정';
    if (!batchMap[bid]) batchMap[bid] = {};
    var pname = d.productName || '?';
    if (!batchMap[bid][pname]) batchMap[bid][pname] = [];
    batchMap[bid][pname].push({ sn:sn, d:d });
  });

  Object.keys(batchMap).sort().forEach(function(bid) {
    var prods = batchMap[bid];
    var bKey = 'batch_' + bid;
    if (typeof ganttExpandState[bKey] === 'undefined') ganttExpandState[bKey] = true;

    var batchItems = [];
    Object.keys(prods).forEach(function(p){ batchItems = batchItems.concat(prods[p]); });

    rows.push({ type:'batchHead', key:bKey, bid:bid, count:batchItems.length,
      expanded:ganttExpandState[bKey], color:gBatchColor(bid), bars: gGetSummaryBars(batchItems, G_PROCS_EXT, dates) });

    if (ganttExpandState[bKey]) {
      Object.keys(prods).sort().forEach(function(pname) {
        var items = prods[pname];
        var pKey = bKey + '_' + pname;
        if (typeof ganttExpandState[pKey] === 'undefined') ganttExpandState[pKey] = false;

        rows.push({ type:'batchProd', key:pKey, pname:pname, count:items.length,
          bars:gGetSummaryBars(items, G_PROCS_EXT, dates), bid:bid, expanded:ganttExpandState[pKey] });
        
        if (ganttExpandState[pKey]) {
          items.forEach(function(it) {
            var route = window.getRoute(it.sn, it.d);
            var bars = route.map(function(p){ return gMakeBar(it.sn, it.d, p, dates); }).filter(Boolean);
            rows.push({ type:'snLine', sn:it.sn, bars:bars, depth:2 });
          });
        }
      });
    }
  });
  return rows;
}

function gBuildProduct(filtered, dates) {
  var rows = [];
  var prodMap = {};
  Object.keys(filtered).forEach(function(sn) {
    var d = filtered[sn];
    var pname = d.productName || '?';
    if (!prodMap[pname]) prodMap[pname] = [];
    prodMap[pname].push({ sn:sn, d:d });
  });

  Object.keys(prodMap).sort().forEach(function(pname) {
    var items = prodMap[pname];
    var pKey = 'prod_' + pname;
    if (typeof ganttExpandState[pKey] === 'undefined') ganttExpandState[pKey] = true;

    rows.push({ type:'prodHead', key:pKey, pname:pname, count:items.length,
      expanded:ganttExpandState[pKey], bars: gGetSummaryBars(items, G_PROCS_EXT, dates) });

    if (ganttExpandState[pKey]) {
      items.forEach(function(it) {
        var route = window.getRoute(it.sn, it.d);
        var bars = route.map(function(p){ return gMakeBar(it.sn, it.d, p, dates); }).filter(Boolean);
        rows.push({ type:'snLine', sn:it.sn, bars:bars, depth:1 });
      });
    }
  });
  return rows;
}

window.renderGantt = function renderGantt() {
  var filtered = window.getFiltered ? window.getFiltered() : {};
  var cnt = Object.keys(filtered).length;
  if (cnt === 0) {
    var el = document.getElementById('ganttContent');
    if (el) el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--t2)">\uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4</div>';
    return;
  }

  // 배치 컬러맵 리셋
  Object.keys(G_BATCH_MAP).forEach(function(k){ delete G_BATCH_MAP[k]; });
  gBatchIdx = 0;

  var dates = gDateRange(filtered);
  var today = new Date().toISOString().slice(0,10);
  var todayIdx = dates.indexOf(today);

  // 뷰별 rows 빌드
  var rows;
  if (ganttViewMode2 === 'process') rows = gBuildProcess(filtered, dates);
  else if (ganttViewMode2 === 'batch') rows = gBuildBatch(filtered, dates);
  else rows = gBuildProduct(filtered, dates);

  var totalW = dates.length * ganttCellW;
  var hH = '';
  // 월 행
  hH += '<div style="display:flex;height:'+G_HEAD+'px;border-bottom:1px solid var(--border)">';
  var curM = '', mStart = 0;
  for (var i = 0; i <= dates.length; i++) {
    var m = i < dates.length ? dates[i].slice(0,7) : '';
    if (m !== curM) {
      if (curM) {
        var mw = (i - mStart) * ganttCellW;
        hH += '<div style="width:'+mw+'px;min-width:'+mw+'px;text-align:center;font-size:11px;font-weight:600;color:var(--t2);line-height:'+G_HEAD+'px;border-right:1px solid var(--border)">'+curM+'</div>';
      }
      curM = m; mStart = i;
    }
  }
  hH += '</div>';

  // 일 행
  hH += '<div style="display:flex;height:'+G_HEAD+'px;border-bottom:2px solid var(--border)">';
  dates.forEach(function(dt, idx) {
    var day = new Date(dt+'T00:00:00').getDay();
    var isWe = day === 0 || day === 6;
    var isToday = dt === today;
    var bg = isToday ? 'background:var(--ac1);color:#fff;border-radius:4px;' : isWe ? 'color:var(--t3);' : '';
    hH += '<div style="width:'+ganttCellW+'px;min-width:'+ganttCellW+'px;text-align:center;font-size:10px;line-height:'+G_HEAD+'px;'+bg+'">'+parseInt(dt.slice(8))+'</div>';
  });
  hH += '</div>';

  var sbH = '';
  var bH = '';
  var esc = window.esc || function(s){ return s; };

  rows.forEach(function(r) {
    // --- 사이드바 ---
    if (r.type === 'procHead') {
      sbH += '<div style="height:'+G_ROW+'px;display:flex;align-items:center;padding:0 8px;border-top:2px solid var(--border);background:var(--bg1);font-weight:700;font-size:13px;gap:6px">';
      sbH += '<span style="color:'+r.color+';font-size:16px">\u25CF</span>';
      sbH += esc(r.proc);
      sbH += '</div>';
    } else if (r.type === 'equip') {
      var arrow = r.expanded ? '\u25BC' : '\u25B6';
      var countBadge = r.count > 0 ? '<span style="margin-left:auto;background:var(--bg3);padding:1px 6px;border-radius:8px;font-size:10px;color:var(--t2)">'+r.count+'</span>' : '<span style="margin-left:auto;font-size:10px;color:var(--t3)">\u2014</span>';
      sbH += '<div onclick="window.toggleG(\''+r.key+'\')" style="height:'+G_ROW+'px;display:flex;align-items:center;padding:0 8px 0 20px;cursor:pointer;font-size:12px;gap:4px;border-bottom:1px solid var(--border);background:var(--bg2)">';
      sbH += '<span style="font-size:9px;color:var(--t3);width:12px">'+arrow+'</span>';
      sbH += '<span style="color:'+G_CLR[r.proc]+';font-size:10px">\u25A0</span> ';
      sbH += esc(r.label);
      sbH += countBadge;
      sbH += '</div>';
    } else if (r.type === 'snLine') {
      var pad = (r.depth || 1) * 20;
      sbH += '<div style="height:'+G_ROW+'px;display:flex;align-items:center;padding:0 8px 0 '+pad+'px;font-size:10px;gap:4px;border-bottom:1px solid var(--border);color:var(--t2)">';
      sbH += esc(r.sn);
      sbH += '</div>';
    } else if (r.type === 'batchHead') {
      var arrow = r.expanded ? '\u25BC' : '\u25B6';
      sbH += '<div onclick="window.toggleG(\''+r.key+'\')" style="height:'+G_ROW+'px;display:flex;align-items:center;padding:0 8px;cursor:pointer;font-weight:600;font-size:12px;gap:6px;border-top:2px solid var(--border);background:var(--bg1)">';
      sbH += '<span style="font-size:9px;color:var(--t3)">'+arrow+'</span>';
      sbH += '<span style="width:10px;height:10px;border-radius:3px;background:'+r.color+';flex-shrink:0"></span>';
      sbH += esc(r.bid) + ' <span style="color:var(--t2);font-weight:400;font-size:10px;margin-left:auto">'+r.count+'매</span>';
      sbH += '</div>';
    } else if (r.type === 'batchProd') {
      var arrow = r.expanded ? '\u25BC' : '\u25B6';
      sbH += '<div onclick="window.toggleG(\''+r.key+'\')" style="height:'+G_ROW+'px;display:flex;align-items:center;padding:0 8px 0 28px;font-size:11px;gap:4px;border-bottom:1px solid var(--border);cursor:pointer">';
      sbH += '<span style="font-size:8px;color:var(--t3);width:10px">'+arrow+'</span>';
      sbH += esc(r.pname) + ' <span style="color:var(--t3);font-size:10px">('+r.count+'\uB9E4)</span>';
      sbH += '</div>';
    } else if (r.type === 'prodHead') {
      var arrow = r.expanded ? '\u25BC' : '\u25B6';
      sbH += '<div onclick="window.toggleG(\''+r.key+'\')" style="height:'+G_ROW+'px;display:flex;align-items:center;padding:0 8px;cursor:pointer;font-weight:600;font-size:12px;gap:6px;border-top:2px solid var(--border);background:var(--bg1)">';
      sbH += '<span style="font-size:9px;color:var(--t3)">'+arrow+'</span>';
      sbH += esc(r.pname) + ' <span style="color:var(--t2);font-weight:400;font-size:10px;margin-left:auto">'+r.count+'매</span>';
      sbH += '</div>';
    }

    var rowBg = '';
    if (r.type === 'procHead') rowBg = 'background:var(--bg1);border-top:2px solid var(--border);';
    else if (r.type === 'equip' || r.type === 'batchProd') rowBg = 'background:var(--bg2);';
    else if (r.type === 'batchHead' || r.type === 'prodHead') rowBg = 'background:var(--bg1);border-top:2px solid var(--border);';

    bH += '<div style="position:relative;height:'+G_ROW+'px;width:'+totalW+'px;'+rowBg+'border-bottom:1px solid var(--border)">';

    // 주말 배경
    dates.forEach(function(dt, idx) {
      var day = new Date(dt+'T00:00:00').getDay();
      if (day === 0 || day === 6) {
        bH += '<div style="position:absolute;left:'+(idx*ganttCellW)+'px;top:0;width:'+ganttCellW+'px;height:100%;background:rgba(128,128,128,0.06)"></div>';
      }
    });

    var bars = r.bars || [];
    bars.forEach(function(b) {
      var left = b.x1 * ganttCellW;
      var w = Math.max((b.x2 - b.x1 + 1) * ganttCellW - 2, 4);
      var style = gBarStyle(b);
      var label = b.proc || b.bid || '';
      
      // 요약바 겹침 방지: 프로세스별로 약간씩 y 오프셋
      var pIdx = G_PROCS_EXT.indexOf(b.proc);
      if (pIdx < 0) pIdx = 0;
      
      var h, top;
      if (b.isSummary) {
        h = 6;
        top = 4 + (pIdx * 4); // 4, 8, 12, 16, 20, 24...
        // G_ROW가 34이므로 6개 공정 정도는 겹치지 않게 표시 가능
      } else {
        h = G_ROW - 12;
        top = 6;
      }
      
      if (ganttCellW >= 18 && label.length > 0) {
        var maxCh = Math.floor(w / 7);
        if (label.length > maxCh) {
          if (b.isSummary) label = ''; 
          else label = label.slice(0, maxCh-1) + '\u2026';
        }
      } else { label = ''; }

      var tip = (b.pname||'') + ' | ' + (b.bid||'') + ' | ' + b.proc + ' | ' + b.s + '~' + b.e + ' | ' + b.status;
      if (b.delayed) tip += ' | \uC9C0\uC5F0 ' + b.delayDays + '\uC77C';

      bH += '<div title="'+tip+'" style="position:absolute;left:'+left+'px;top:'+top+'px;height:'+h+'px;border-radius:4px;'+style+'display:flex;align-items:center;justify-content:center;width:'+w+'px;font-size:8px;color:#fff;font-weight:500;overflow:hidden;white-space:nowrap;cursor:pointer;transition:transform 0.1s" onmouseover="this.style.transform=\'scale(1.04)\'" onmouseout="this.style.transform=\'scale(1)\'">';
      bH += label;
      bH += '</div>';

      if (b.delayed && b.x2over) {
        var dLeft = (b.x2 + 1) * ganttCellW;
        var dW = (b.x2over - b.x2) * ganttCellW;
        bH += '<div title="\uC9C0\uC5F0 '+b.delayDays+'\uC77C" style="position:absolute;left:'+dLeft+'px;top:'+top+'px;height:'+h+'px;border-radius:0 4px 4px 0;background:#ef4444;opacity:0.7;width:'+dW+'px;background-image:repeating-linear-gradient(90deg,transparent,transparent 3px,rgba(255,255,255,0.2) 3px,rgba(255,255,255,0.2) 6px)"></div>';
      }
    });

    bH += '</div>';
  });

  var todayLine = '';
  if (todayIdx >= 0) {
    var tx = todayIdx * ganttCellW + Math.floor(ganttCellW / 2);
    todayLine = '<div class="gantt-today-line" style="position:absolute;left:'+tx+'px;top:0;width:2px;height:100%;background:#ef4444;z-index:5;pointer-events:none"><div style="position:absolute;top:-18px;left:-16px;font-size:9px;color:#ef4444;font-weight:700">TODAY</div></div>';
  }

  var elHeader = document.getElementById('ganttHeader');
  var elSidebar = document.getElementById('ganttSidebar');
  var elBody = document.getElementById('ganttBody');
  if (!elHeader || !elSidebar || !elBody) {
    // fallback: ganttContent 방식
    var gc = document.getElementById('ganttContent');
    if (!gc) return;
    gc.innerHTML = '<div style="text-align:center;padding:40px;color:var(--t2)">gantt grid not found</div>';
    return;
  }
  elHeader.innerHTML = hH;
  elHeader.style.minWidth = totalW + 'px';
  elSidebar.innerHTML = sbH;
  elBody.innerHTML = bH + todayLine;
  elBody.style.minWidth = totalW + 'px';

  // 좌우 세로 스크롤 동기화
  var sbEl = document.getElementById('ganttSidebar');
  var bwEl = document.getElementById('ganttBodyWrap');
  if (sbEl && bwEl) {
    var syncing = false;
    sbEl.onscroll = function() {
      if (syncing) return;
      syncing = true;
      bwEl.scrollTop = sbEl.scrollTop;
      syncing = false;
    };
    bwEl.onscroll = function() {
      if (syncing) return;
      syncing = true;
      sbEl.scrollTop = bwEl.scrollTop;
      // 헤더 가로 스크롤 동기화
      var hEl = document.getElementById('ganttHeaderWrap');
      if (hEl) hEl.scrollLeft = bwEl.scrollLeft;
      syncing = false;
    };
  }

  // 오늘로 스크롤
  setTimeout(function(){ window.ganttGoToday(); }, 100);
};
