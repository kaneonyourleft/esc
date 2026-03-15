// =============================================
// ESC Manager - gantt.js v2.1 (fix: getFiltered, EQ_MAP, normalizeFurnace)
// =============================================

import * as S from './state.js';
import { PROC_COLORS, PROC_ORDER, EQ_MAP } from './constants.js';

// EQ_MAP 글로벌 노출 (window.EQ_MAP 참조 안전화)
window.EQ_MAP = EQ_MAP;

let ganttViewMode2 = 'process';
let ganttCellW = 28;
let ganttExpandState = {};

const G_ROW = 34;
const G_HEAD = 28;
const G_PROCS = PROC_ORDER;
const G_PROCS_EXT = PROC_ORDER.concat(['최종완료']);
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

// --- 로컬 안전 날짜 파서 ---
function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim().slice(0, 10);
  const parts = s.split('-').map(Number);
  if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
}

function normalizeDate(date) {
  if (!(date instanceof Date) || isNaN(date)) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function toDateStr(date) {
  if (!(date instanceof Date) || isNaN(date)) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function gDays(a, b) {
  if (!a || !b) return 0;
  const da = parseLocalDate(a);
  const db = parseLocalDate(b);
  if (!da || !db) return 0;
  return Math.round((db - da) / DAY_MS);
}

function gDateRange(filtered) {
  let mnD = null, mxD = null;
  Object.keys(filtered).forEach(function(sn) {
    const d = filtered[sn];
    const route = window.getRoute ? window.getRoute(sn, d) : [];
    route.forEach(function(proc) {
      const p = window.getProc ? window.getProc(d, proc) : {};
      const fD = window.fD || function(v){ return ''; };
      const sStr = fD(p.actualStart) || fD(p.planStart) || fD(p.startDate);
      const eStr = fD(p.actualEnd) || fD(p.planEnd);
      const sd = parseLocalDate(sStr);
      const ed = parseLocalDate(eStr);
      if (sd) { if (!mnD || sd < mnD) mnD = sd; }
      if (ed) { if (!mxD || ed > mxD) mxD = ed; }
    });
  });
  if (!mnD || !mxD || mnD > mxD) {
    mnD = normalizeDate(new Date());
    mnD.setDate(mnD.getDate() - 7);
    mxD = normalizeDate(new Date());
    mxD.setDate(mxD.getDate() + 23);
  }
  const dsStart = normalizeDate(mnD);
  dsStart.setDate(dsStart.getDate() - 60);
  const dsEnd = normalizeDate(mxD);
  dsEnd.setDate(dsEnd.getDate() + 60);
  const arr = [];
  for (let c = new Date(dsStart); c <= dsEnd; c.setDate(c.getDate() + 1)) {
    arr.push(toDateStr(normalizeDate(c)));
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
  const lbl = document.getElementById('ganttZoomLabel');
  if (lbl) lbl.textContent = ganttCellW + 'px';
  window.renderGantt();
};

window.ganttGoToday = function() {
  const wrap = document.getElementById('ganttBodyWrap') || document.querySelector('.gantt-body-wrap');
  const line = document.querySelector('.gantt-today-line');
  if (wrap && line) {
    const x = parseFloat(line.style.left) - wrap.clientWidth / 2;
    wrap.scrollLeft = Math.max(0, x);
  }
};

window.ganttToggleAll = function() {
  let allExp = true;
  Object.keys(ganttExpandState).forEach(function(k) { if (!ganttExpandState[k]) allExp = false; });
  Object.keys(ganttExpandState).forEach(function(k) { ganttExpandState[k] = !allExp; });
  const btn = document.getElementById('ganttExpandAllBtn');
  if (btn) btn.textContent = allExp ? '모두 펼치기' : '모두 접기';
  window.renderGantt();
};

function toggleG(key) {
  ganttExpandState[key] = !ganttExpandState[key];
  window.renderGantt();
}
window.toggleG = toggleG;

// --- 설비명 정규화 ---
function normalizeFurnaceName(raw) {
  const v = String(raw || '').trim();
  if (!v) return '미배정';
  if (v.includes('외주')) return '외주';
  if (v.includes('미배정') || v.includes('배정대기')) return '미배정';
  const m = v.match(/(\d+)\s*호기/);
  if (m) return parseInt(m[1], 10) + '호기';
  return v;
}

// --- 설비 정렬 ---
function sortEquipAll(list) {
  return list.slice().sort(function(a, b) {
    const SPECIAL = { '외주': 990, '미배정': 999 };
    const aNum = a.match(/^(\d+)호기$/);
    const bNum = b.match(/^(\d+)호기$/);
    if (aNum && bNum) return Number(aNum[1]) - Number(bNum[1]);
    if (aNum) return -1;
    if (bNum) return 1;
    const aS = SPECIAL[a] !== undefined ? SPECIAL[a] : 500;
    const bS = SPECIAL[b] !== undefined ? SPECIAL[b] : 500;
    return aS - bS || a.localeCompare(b);
  });
}

function gMakeBar(sn, d, proc, dates) {
  const p = (window.getProc ? window.getProc(d, proc) : null) || {};
  const fD = window.fD || function(v){ return ''; };
  // 실제 데이터 필드: startDate(시작), actualEnd(실제종료), planEnd(예정종료)
  let s = fD(p.actualStart) || fD(p.planStart) || fD(p.startDate);
  const eAct = fD(p.actualEnd);
  const ePlan = fD(p.planEnd);
  let e = eAct || ePlan;
  if (!s && e) s = e;
  if (!s || !e) return null;
  if (s > e) { const tmp = s; s = e; e = tmp; }
  const status = p.status || '대기';
  const todayStr = toDateStr(normalizeDate(new Date()));
  let x1 = dates.indexOf(s);
  let x2 = dates.indexOf(e);
  if (x1 < 0 && x2 < 0) return null;
  if (x1 < 0) x1 = 0;
  if (x2 < 0) x2 = dates.length - 1;
  if (x2 < x1) x2 = x1;
  const bar = { x1, x2, proc, sn, status,
    bid: d.batchId||d.batch||'', pname: d.productName||'', s, e, eAct, ePlan };
  if (status !== '완료' && ePlan && todayStr > ePlan) {
    bar.delayed = true;
    bar.delayDays = gDays(ePlan, todayStr);
    const todayIdx = dates.indexOf(todayStr);
    if (todayIdx > x2) bar.x2over = todayIdx;
  }
  return bar;
}

function gGetSummaryBars(items, procList, dates) {
  const bars = [];
  const dFirst = dates[0], dLast = dates[dates.length - 1];
  const todayStr = toDateStr(normalizeDate(new Date()));
  procList.forEach(function(proc) {
    let mn = '', mx = '';
    let hasData = false, hasProg = false, hasComp = true;
    items.forEach(function(it) {
      if (!it.d) return;
      const p = window.getProc(it.d, proc);
      let s = window.fD(p.actualStart) || window.fD(p.planStart) || window.fD(p.startDate);
      let e = window.fD(p.actualEnd) || window.fD(p.planEnd);
      if (proc === '최종완료') { s = e = window.fD(it.d.completedAt); }
      if (s || e) {
        hasData = true;
        if (s && (!mn || s < mn)) mn = s;
        if (e && (!mx || e > mx)) mx = e;
        const ps = p.status || '대기';
        if (ps === '진행') hasProg = true;
        if (ps !== '완료') hasComp = false;
        if (proc === '최종완료' && it.d.status !== '완료') hasComp = false;
      }
    });
    if (hasData && mn && mx && mn <= mx) {
      if (mn > dLast || mx < dFirst) return;
      let x1 = dates.indexOf(mn); if (x1 < 0) x1 = 0;
      let x2 = dates.indexOf(mx); if (x2 < 0) x2 = dates.length - 1;
      const sts = hasComp ? '완료' : (hasProg ? '진행' : '대기');
      const bar = { x1, x2, proc, status: sts, s: mn, e: mx, isSummary: true };
      if (sts !== '완료' && todayStr > mx) {
        bar.delayed = true;
        bar.delayDays = gDays(mx, todayStr);
      }
      bars.push(bar);
    }
  });
  return bars;
}

function gBarStyle(bar) {
  const clr = G_CLR[bar.proc] || '#666';
  if (bar.status === '완료') {
    return 'background:'+clr+';opacity:0.85;background-image:repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(255,255,255,0.15) 3px,rgba(255,255,255,0.15) 6px);';
  } else if (bar.status === '진행') {
    return 'background:'+clr+';opacity:1;box-shadow:0 0 6px '+clr+'80;';
  } else {
    return 'background:'+clr+';opacity:0.3;';
  }
}

function gBuildProcess(filtered, dates) {
  const rows = [];
  const eqMapRef = EQ_MAP;

  // 디버그: 소성 누락 추적
  const sinteringDebug = [];
  Object.keys(filtered).forEach(function(sn) {
    const d = filtered[sn];
    const route = window.getRoute ? window.getRoute(sn, d) : [];
    if (route.indexOf('소성') >= 0) {
      const p = window.getProc ? window.getProc(d, '소성') : {};
      sinteringDebug.push({
        sn, status: d.status, currentProcess: d.currentProcess,
        equip_raw: p.equip || '(없음)',
        equip_norm: normalizeFurnaceName(p.equip),
        planStart: p.planStart, actualStart: p.actualStart
      });
    }
  });
  if (sinteringDebug.length > 0) {
    console.log('[간트 디버그] 소성 items:', sinteringDebug.length, '건');
    console.table(sinteringDebug);
  }

  G_PROCS.forEach(function(proc) {
    const procItems = [];
    Object.keys(filtered).forEach(function(sn) {
      const d = filtered[sn];
      const route = window.getRoute(sn, d);
      if (route.indexOf(proc) >= 0) procItems.push({ sn, d });
    });

    rows.push({ type:'procHead', proc, color:G_CLR[proc], bars: gGetSummaryBars(procItems, G_PROCS_EXT, dates) });

    const equipMap = {};
    let equipAll = [];

    // 1단계: EQ_MAP 기준 그룹 생성
    if (eqMapRef[proc] && Array.isArray(eqMapRef[proc])) {
      eqMapRef[proc].forEach(function(eq) {
        const normalized = normalizeFurnaceName(eq);
        if (equipAll.indexOf(normalized) < 0) {
          equipAll.push(normalized);
          equipMap[normalized] = [];
        }
      });
    }

    // 2단계: 실제 데이터 매핑 (정규화 후)
    procItems.forEach(function(it) {
      const p = window.getProc(it.d, proc);
      const eq = normalizeFurnaceName(p.equip || '미배정');
      if (!equipMap[eq]) {
        equipMap[eq] = [];
        if (equipAll.indexOf(eq) < 0) equipAll.push(eq);
      }
      equipMap[eq].push(it);
    });

    // 3단계: 아이템 있는 그룹만 표시
    equipAll = equipAll.filter(function(eq) {
      return equipMap[eq] && equipMap[eq].length > 0;
    });

    // 4단계: 정렬
    equipAll = sortEquipAll(equipAll);

    if (proc === '소성' && equipAll.length > 0) {
      console.log('[간트 디버그] 소성 설비 그룹:', equipAll);
    }

    equipAll.forEach(function(eq) {
      const items = equipMap[eq] || [];
      const eqKey = 'procMode_' + proc + '_' + eq;
      if (typeof ganttExpandState[eqKey] === 'undefined') ganttExpandState[eqKey] = false;

      rows.push({ type:'equip', key:eqKey, label:eq, count:items.length, proc,
        expanded:ganttExpandState[eqKey], bars: gGetSummaryBars(items, G_PROCS_EXT, dates) });

      if (ganttExpandState[eqKey]) {
        items.forEach(function(it) {
          const route = window.getRoute(it.sn, it.d);
          const bars = route.map(function(p){ return gMakeBar(it.sn, it.d, p, dates); }).filter(Boolean);
          rows.push({ type:'snLine', sn:it.sn, bars, depth:2 });
        });
      }
    });
  });
  return rows;
}

function gBuildBatch(filtered, dates) {
  const rows = [];
  const batchMap = {};
  Object.keys(filtered).forEach(function(sn) {
    const d = filtered[sn];
    const bid = d.batchId || '미배정';
    if (!batchMap[bid]) batchMap[bid] = {};
    const pname = d.productName || '?';
    if (!batchMap[bid][pname]) batchMap[bid][pname] = [];
    batchMap[bid][pname].push({ sn, d });
  });

  Object.keys(batchMap).sort().forEach(function(bid) {
    const prods = batchMap[bid];
    const bKey = 'batch_' + bid;
    if (typeof ganttExpandState[bKey] === 'undefined') ganttExpandState[bKey] = true;

    let batchItems = [];
    Object.keys(prods).forEach(function(p){ batchItems = batchItems.concat(prods[p]); });

    rows.push({ type:'batchHead', key:bKey, bid, count:batchItems.length,
      expanded:ganttExpandState[bKey], color:gBatchColor(bid), bars: gGetSummaryBars(batchItems, G_PROCS_EXT, dates) });

    if (ganttExpandState[bKey]) {
      Object.keys(prods).sort().forEach(function(pname) {
        const items = prods[pname];
        const pKey = bKey + '_' + pname;
        if (typeof ganttExpandState[pKey] === 'undefined') ganttExpandState[pKey] = false;

        rows.push({ type:'batchProd', key:pKey, pname, count:items.length,
          bars:gGetSummaryBars(items, G_PROCS_EXT, dates), bid, expanded:ganttExpandState[pKey] });

        if (ganttExpandState[pKey]) {
          items.forEach(function(it) {
            const route = window.getRoute(it.sn, it.d);
            const bars = route.map(function(p){ return gMakeBar(it.sn, it.d, p, dates); }).filter(Boolean);
            rows.push({ type:'snLine', sn:it.sn, bars, depth:2 });
          });
        }
      });
    }
  });
  return rows;
}

function gBuildProduct(filtered, dates) {
  const rows = [];
  const prodMap = {};
  Object.keys(filtered).forEach(function(sn) {
    const d = filtered[sn];
    const pname = d.productName || '?';
    if (!prodMap[pname]) prodMap[pname] = [];
    prodMap[pname].push({ sn, d });
  });

  Object.keys(prodMap).sort().forEach(function(pname) {
    const items = prodMap[pname];
    const pKey = 'prod_' + pname;
    if (typeof ganttExpandState[pKey] === 'undefined') ganttExpandState[pKey] = true;

    rows.push({ type:'prodHead', key:pKey, pname, count:items.length,
      expanded:ganttExpandState[pKey], bars: gGetSummaryBars(items, G_PROCS_EXT, dates) });

    if (ganttExpandState[pKey]) {
      items.forEach(function(it) {
        const route = window.getRoute(it.sn, it.d);
        const bars = route.map(function(p){ return gMakeBar(it.sn, it.d, p, dates); }).filter(Boolean);
        rows.push({ type:'snLine', sn:it.sn, bars, depth:1 });
      });
    }
  });
  return rows;
}

window.renderGantt = function renderGantt() {
  const filtered = window.getFiltered ? window.getFiltered() : {};
  const cnt = Object.keys(filtered).length;
  console.log('[간트 디버그] getFiltered 결과:', cnt, '건 / 전체:', Object.keys(S.DATA || {}).length, '건');

  if (cnt === 0) {
    const el = document.getElementById('ganttContent');
    if (el) el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--t2)">데이터가 없습니다</div>';
    return;
  }

  Object.keys(G_BATCH_MAP).forEach(function(k){ delete G_BATCH_MAP[k]; });
  gBatchIdx = 0;

  const dates = gDateRange(filtered);
  const todayStr = toDateStr(normalizeDate(new Date()));
  const todayIdx = dates.indexOf(todayStr);

  let rows;
  if (ganttViewMode2 === 'process') rows = gBuildProcess(filtered, dates);
  else if (ganttViewMode2 === 'batch') rows = gBuildBatch(filtered, dates);
  else rows = gBuildProduct(filtered, dates);

  const totalW = dates.length * ganttCellW;
  const escFn = window.esc || function(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); };

  // 헤더 HTML
  let hH = '';
  hH += '<div style="display:flex;height:'+G_HEAD+'px;border-bottom:1px solid var(--border)">';
  let curM = '', mStart = 0;
  for (let i = 0; i <= dates.length; i++) {
    const m = i < dates.length ? dates[i].slice(0,7) : '';
    if (m !== curM) {
      if (curM) {
        const mw = (i - mStart) * ganttCellW;
        hH += '<div style="width:'+mw+'px;min-width:'+mw+'px;text-align:center;font-size:11px;font-weight:600;color:var(--t2);line-height:'+G_HEAD+'px;border-right:1px solid var(--border)">'+curM+'</div>';
      }
      curM = m; mStart = i;
    }
  }
  hH += '</div>';
  hH += '<div style="display:flex;height:'+G_HEAD+'px;border-bottom:2px solid var(--border)">';
  dates.forEach(function(dt) {
    const dtDate = parseLocalDate(dt);
    const day = dtDate ? dtDate.getDay() : 0;
    const isWe = day === 0 || day === 6;
    const isToday = dt === todayStr;
    const bg = isToday ? 'background:var(--ac1);color:#fff;border-radius:4px;' : isWe ? 'color:var(--t3);' : '';
    hH += '<div style="width:'+ganttCellW+'px;min-width:'+ganttCellW+'px;text-align:center;font-size:10px;line-height:'+G_HEAD+'px;'+bg+'">'+parseInt(dt.slice(8))+'</div>';
  });
  hH += '</div>';

  // 사이드바 + 바디 HTML
  let sbH = '', bH = '';
  rows.forEach(function(r) {
    if (r.type === 'procHead') {
      sbH += '<div style="height:'+G_ROW+'px;display:flex;align-items:center;padding:0 8px;border-top:2px solid var(--border);background:var(--bg1);font-weight:700;font-size:13px;gap:6px">';
      sbH += '<span style="color:'+r.color+';font-size:16px">&#9679;</span>';
      sbH += escFn(r.proc) + '</div>';
    } else if (r.type === 'equip') {
      const arrow = r.expanded ? '&#9660;' : '&#9654;';
      const countBadge = r.count > 0
        ? '<span style="margin-left:auto;background:var(--bg3);padding:1px 6px;border-radius:8px;font-size:10px;color:var(--t2)">'+r.count+'</span>'
        : '<span style="margin-left:auto;font-size:10px;color:var(--t3)">&mdash;</span>';
      sbH += '<div onclick="window.toggleG(\''+r.key+'\')" style="height:'+G_ROW+'px;display:flex;align-items:center;padding:0 8px 0 20px;cursor:pointer;font-size:12px;gap:4px;border-bottom:1px solid var(--border);background:var(--bg2)">';
      sbH += '<span style="font-size:9px;color:var(--t3);width:12px">'+arrow+'</span>';
      sbH += '<span style="color:'+G_CLR[r.proc]+';font-size:10px">&#9632;</span> ';
      sbH += escFn(r.label) + countBadge + '</div>';
    } else if (r.type === 'snLine') {
      const pad = (r.depth || 1) * 20;
      sbH += '<div style="height:'+G_ROW+'px;display:flex;align-items:center;padding:0 8px 0 '+pad+'px;font-size:10px;gap:4px;border-bottom:1px solid var(--border);color:var(--t2)">';
      sbH += escFn(r.sn) + '</div>';
    } else if (r.type === 'batchHead') {
      const arrow = r.expanded ? '&#9660;' : '&#9654;';
      sbH += '<div onclick="window.toggleG(\''+r.key+'\')" style="height:'+G_ROW+'px;display:flex;align-items:center;padding:0 8px;cursor:pointer;font-weight:600;font-size:12px;gap:6px;border-top:2px solid var(--border);background:var(--bg1)">';
      sbH += '<span style="font-size:9px;color:var(--t3)">'+arrow+'</span>';
      sbH += '<span style="width:10px;height:10px;border-radius:3px;background:'+r.color+';flex-shrink:0"></span>';
      sbH += escFn(r.bid) + ' <span style="color:var(--t2);font-weight:400;font-size:10px;margin-left:auto">'+r.count+'매</span></div>';
    } else if (r.type === 'batchProd') {
      const arrow = r.expanded ? '&#9660;' : '&#9654;';
      sbH += '<div onclick="window.toggleG(\''+r.key+'\')" style="height:'+G_ROW+'px;display:flex;align-items:center;padding:0 8px 0 28px;font-size:11px;gap:4px;border-bottom:1px solid var(--border);cursor:pointer">';
      sbH += '<span style="font-size:8px;color:var(--t3);width:10px">'+arrow+'</span>';
      sbH += escFn(r.pname) + ' <span style="color:var(--t3);font-size:10px">('+r.count+'매)</span></div>';
    } else if (r.type === 'prodHead') {
      const arrow = r.expanded ? '&#9660;' : '&#9654;';
      sbH += '<div onclick="window.toggleG(\''+r.key+'\')" style="height:'+G_ROW+'px;display:flex;align-items:center;padding:0 8px;cursor:pointer;font-weight:600;font-size:12px;gap:6px;border-top:2px solid var(--border);background:var(--bg1)">';
      sbH += '<span style="font-size:9px;color:var(--t3)">'+arrow+'</span>';
      sbH += escFn(r.pname) + ' <span style="color:var(--t2);font-weight:400;font-size:10px;margin-left:auto">'+r.count+'매</span></div>';
    }

    let rowBg = '';
    if (r.type === 'procHead') rowBg = 'background:var(--bg1);border-top:2px solid var(--border);';
    else if (r.type === 'equip' || r.type === 'batchProd') rowBg = 'background:var(--bg2);';
    else if (r.type === 'batchHead' || r.type === 'prodHead') rowBg = 'background:var(--bg1);border-top:2px solid var(--border);';

    bH += '<div style="position:relative;height:'+G_ROW+'px;width:'+totalW+'px;'+rowBg+'border-bottom:1px solid var(--border)">';
    dates.forEach(function(dt, idx) {
      const dtDate = parseLocalDate(dt);
      const day = dtDate ? dtDate.getDay() : 0;
      if (day === 0 || day === 6) {
        bH += '<div style="position:absolute;left:'+(idx*ganttCellW)+'px;top:0;width:'+ganttCellW+'px;height:100%;background:rgba(128,128,128,0.06)"></div>';
      }
    });

    const bars = r.bars || [];
    bars.forEach(function(b) {
      const left = b.x1 * ganttCellW;
      const w = Math.max((b.x2 - b.x1 + 1) * ganttCellW - 2, 4);
      const style = gBarStyle(b);
      let label = b.proc || b.bid || '';
      const pIdx = G_PROCS_EXT.indexOf(b.proc);
      const h = b.isSummary ? 6 : G_ROW - 12;
      const top = b.isSummary ? 4 + ((pIdx < 0 ? 0 : pIdx) * 4) : 6;
      if (ganttCellW >= 18 && label.length > 0) {
        const maxCh = Math.floor(w / 7);
        if (label.length > maxCh) {
          label = b.isSummary ? '' : label.slice(0, maxCh-1) + '…';
        }
      } else { label = ''; }
      const tip = (b.pname||'')+'|'+(b.bid||'')+'|'+b.proc+'|'+b.s+'~'+b.e+'|'+b.status+(b.delayed?' | 지연 '+b.delayDays+'일':'');
      bH += '<div title="'+tip+'" style="position:absolute;left:'+left+'px;top:'+top+'px;height:'+h+'px;border-radius:4px;'+style+'display:flex;align-items:center;justify-content:center;width:'+w+'px;font-size:8px;color:#fff;font-weight:500;overflow:hidden;white-space:nowrap;cursor:pointer;transition:transform 0.1s" onmouseover="this.style.transform=\'scale(1.04)\'" onmouseout="this.style.transform=\'scale(1)\'">';
      bH += label + '</div>';
      if (b.delayed && b.x2over) {
        const dLeft = (b.x2 + 1) * ganttCellW;
        const dW = (b.x2over - b.x2) * ganttCellW;
        bH += '<div style="position:absolute;left:'+dLeft+'px;top:'+top+'px;height:'+h+'px;border-radius:0 4px 4px 0;background:#ef4444;opacity:0.7;width:'+dW+'px"></div>';
      }
    });
    bH += '</div>';
  });

  let todayLine = '';
  if (todayIdx >= 0) {
    const tx = todayIdx * ganttCellW + Math.floor(ganttCellW / 2);
    todayLine = '<div class="gantt-today-line" style="position:absolute;left:'+tx+'px;top:0;width:2px;height:100%;background:#ef4444;z-index:5;pointer-events:none"><div style="position:absolute;top:-18px;left:-16px;font-size:9px;color:#ef4444;font-weight:700">TODAY</div></div>';
  }

  const elHeader = document.getElementById('ganttHeader');
  const elSidebar = document.getElementById('ganttSidebar');
  const elBody = document.getElementById('ganttBody');
  if (!elHeader || !elSidebar || !elBody) {
    const gc = document.getElementById('ganttContent');
    if (!gc) return;
    gc.innerHTML = '<div style="text-align:center;padding:40px;color:var(--t2)">gantt grid not found</div>';
    return;
  }
  elHeader.innerHTML = hH;
  elHeader.style.minWidth = totalW + 'px';
  elSidebar.innerHTML = sbH;
  elBody.innerHTML = bH + todayLine;
  elBody.style.minWidth = totalW + 'px';

  const sbEl = document.getElementById('ganttSidebar');
  const bwEl = document.getElementById('ganttBodyWrap');
  if (sbEl && bwEl) {
    let syncing = false;
    sbEl.onscroll = function() {
      if (syncing) return; syncing = true;
      bwEl.scrollTop = sbEl.scrollTop; syncing = false;
    };
    bwEl.onscroll = function() {
      if (syncing) return; syncing = true;
      sbEl.scrollTop = bwEl.scrollTop;
      const hEl = document.getElementById('ganttHeaderWrap');
      if (hEl) hEl.scrollLeft = bwEl.scrollLeft;
      syncing = false;
    };
  }

  setTimeout(function(){ window.ganttGoToday(); }, 100);
};
