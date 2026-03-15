// =============================================
// ESC Manager - gantt.js v3.0
// summary row bar 완전 제거 + gIsSummaryRow 이중보호
// =============================================

import * as S from './state.js';
import { getRoute as _getRoute, getProc as _getProc, fD as _fD } from './utils.js';
window.getRoute = window.getRoute || _getRoute;
window.getProc  = window.getProc  || _getProc;
window.fD       = window.fD       || _fD;
import { PROC_COLORS, PROC_ORDER, EQ_MAP } from './constants.js';

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

// ── summary row 판별 (이중보호용) ──────────────────────────
function gIsSummaryRow(r) {
  if (!r) return false;
  if (r.isSummary === true) return true;
  const t = String(r.type || '').trim().toLowerCase();
  return ['prochead','batchhead','batchprod','prodhead'].includes(t);
}

// ── 수량 필드 통일 ──────────────────────────────────────────
function resolveQty(d) {
  if (!d) return 1;
  return Number(
    d.qty !== undefined ? d.qty :
    d.quantity !== undefined ? d.quantity :
    d.sheetQty !== undefined ? d.sheetQty :
    d.amount !== undefined ? d.amount :
    d.count !== undefined ? d.count : 1
  ) || 1;
}

// ── 로컬 안전 날짜 파서 ────────────────────────────────────
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

// ── UI 컨트롤 ──────────────────────────────────────────────
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

// ── 설비명 정규화 ──────────────────────────────────────────
function normalizeFurnaceName(raw) {
  const v = String(raw || '').trim();
  if (!v) return '미배정';
  if (v.includes('외주')) return '외주';
  if (v.includes('미배정') || v.includes('배정대기')) return '미배정';
  const m = v.match(/(\d+)\s*호기/);
  if (m) return parseInt(m[1], 10) + '호기';
  return v;
}

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

// ── bar 생성 (leaf row 전용) ───────────────────────────────
function gMakeBar(sn, d, proc, dates) {
  console.log('[DEBUG][gMakeBar][IN]', { sn: sn, proc: proc });
  const p = (window.getProc ? window.getProc(d, proc) : null) || {};
  const fD = window.fD || function(v){ return ''; };
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
  console.log('[DEBUG][gMakeBar][OUT]', { sn: sn, proc: proc, result: bar ? 'BAR_OK' : 'BAR_NULL', bar: bar });
  return bar;
}

// ── gGetSummaryBars: 함수는 유지하되 summary row에는 사용 안 함 ──
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
  if (bar.delayed) {
    return 'background:'+clr+';opacity:0.9;outline:2px solid #ef4444;outline-offset:-2px;';
  }
  if (bar.status === '완료') {
    return 'background:'+clr+';opacity:0.85;background-image:repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(255,255,255,0.15) 3px,rgba(255,255,255,0.15) 6px);';
  } else if (bar.status === '진행') {
    return 'background:'+clr+';opacity:1;box-shadow:0 0 6px '+clr+'80;';
  } else {
    return 'background:'+clr+';opacity:0.3;';
  }
}

// ══════════════════════════════════════════════════════════
// gBuildProcess: 공정 > 호기 > 제품 > S/N
// summary row(procHead/equip/procProd) → isSummary:true, bars:[]
// leaf row(snLine) → gMakeBar 결과만
// ══════════════════════════════════════════════════════════
function gBuildProcess(filtered, dates) {
  const rows = [];
  const EXCLUDED = ['완료','complete','completed','폐기','discard','폐기완료'];

  G_PROCS.forEach(function(proc) {
    const procItems = [];
    Object.keys(filtered).forEach(function(sn) {
      const d = filtered[sn];
      const st = String(d.status || '').trim().toLowerCase();
      if (EXCLUDED.includes(st)) return;
      const cur = String(d.currentProcess || '').trim();
      if (cur) {
        if (cur !== proc) return;
      } else {
        const route = window.getRoute(sn, d);
        const firstActive = route.find(function (rp) {
          const ps = String((window.getProc(d, rp) || {}).status || '대기');
          return ps !== '완료';
        });
        if (!firstActive || firstActive !== proc) return;
      }
      procItems.push({ sn, d });
    });

    const totalQty = procItems.reduce(function(s, it) { return s + resolveQty(it.d); }, 0);
    console.log('[공정뷰]', proc, ':', procItems.length, '건 /', totalQty, '매');

    // ▶ procHead — summary, bars 없음
    rows.push({
      type: 'procHead', proc, color: G_CLR[proc],
      count: procItems.length, qty: totalQty,
      isSummary: true, bars: []
    });

    const equipMap = {};
    let equipAll = [];
    if (EQ_MAP[proc] && Array.isArray(EQ_MAP[proc])) {
      EQ_MAP[proc].forEach(function(eq) {
        const n = normalizeFurnaceName(eq);
        if (equipAll.indexOf(n) < 0) { equipAll.push(n); equipMap[n] = []; }
      });
    }
    procItems.forEach(function(it) {
      const p = window.getProc(it.d, proc);
      const eq = normalizeFurnaceName(p.equip || '미배정');
      if (!equipMap[eq]) { equipMap[eq] = []; if (equipAll.indexOf(eq) < 0) equipAll.push(eq); }
      equipMap[eq].push(it);
    });
    equipAll = equipAll.filter(function(eq) { return equipMap[eq] && equipMap[eq].length > 0; });
    equipAll = sortEquipAll(equipAll);

    if (proc === '소성') {
      const dist = {};
      equipAll.forEach(function(eq){ dist[eq] = (equipMap[eq]||[]).length; });
      console.log('[공정뷰] 소성 설비분포:', JSON.stringify(dist));
    }

    equipAll.forEach(function(eq) {
      const eqItems = equipMap[eq] || [];
      const eqQty = eqItems.reduce(function(s, it) { return s + resolveQty(it.d); }, 0);
      const eqKey = 'procMode_' + proc + '_' + eq;
      if (typeof ganttExpandState[eqKey] === 'undefined') ganttExpandState[eqKey] = false;

      // ▶ equip(호기) — child S/N bar collection preview
      const eqChildBars = eqItems.map(function(it) {
        return gMakeBar(it.sn, it.d, proc, dates);
      }).filter(Boolean);
      console.log('[DEBUG][equip]', eq, '→ childBars:', eqChildBars.length, '/ items:', eqItems.length);
      rows.push({
        type: 'equip', key: eqKey, label: eq,
        count: eqItems.length, qty: eqQty, proc,
        expanded: ganttExpandState[eqKey],
        isSummary: false, bars: eqChildBars, isPreview: true
      });

      if (!ganttExpandState[eqKey]) return;

      const prodMap = {};
      eqItems.forEach(function(it) {
        const pname = it.d.productName || '?';
        if (!prodMap[pname]) prodMap[pname] = [];
        prodMap[pname].push(it);
      });

      Object.keys(prodMap).sort().forEach(function(pname) {
        const pitems = prodMap[pname];
        const pQty = pitems.reduce(function(s, it) { return s + resolveQty(it.d); }, 0);
        const pKey = eqKey + '_prod_' + pname;
        if (typeof ganttExpandState[pKey] === 'undefined') ganttExpandState[pKey] = false;

        // ▶ procProd(제품) — child S/N bar collection preview
        const prodChildBars = pitems.map(function(it) {
          return gMakeBar(it.sn, it.d, proc, dates);
        }).filter(Boolean);
        console.log('[DEBUG][procProd]', pname, '→ childBars:', prodChildBars.length, '/ items:', pitems.length);
        rows.push({
          type: 'procProd', key: pKey, pname: pname,
          count: pitems.length, qty: pQty, proc,
          expanded: ganttExpandState[pKey],
          isSummary: false, bars: prodChildBars, isPreview: true
        });

        if (!ganttExpandState[pKey]) return;

        // ▶ snLine — leaf row, bar 있음
        pitems.forEach(function(it) {
          const bar = gMakeBar(it.sn, it.d, proc, dates);
          rows.push({
            type: 'snLine', sn: it.sn,
            isSummary: false,
            bars: bar ? [bar] : [],
            depth: 3
          });
        });
      });
    });
  });
  console.log('[DEBUG][ROWS][process] count=', rows.length);
  console.table(rows.slice(0, 150).map(function (r) { return { type: r.type, label: r.label || r.pname || r.proc || r.bid || r.sn || '', isSummary: r.isSummary, bars: Array.isArray(r.bars) ? r.bars.length : 'none', qty: r.qty }; }));
  return rows;
}

// ══════════════════════════════════════════════════════════
// gBuildBatch: 배치 > 제품 > S/N
// batchHead/batchProd → isSummary:true, bars:[]
// snLine → leaf, bar 있음
// ══════════════════════════════════════════════════════════
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
    const bQty = batchItems.reduce(function(s,it){ return s + resolveQty(it.d); }, 0);

    // ▶ batchHead — summary, bars 없음
    rows.push({
      type: 'batchHead', key: bKey, bid,
      count: bQty, expanded: ganttExpandState[bKey],
      color: gBatchColor(bid),
      isSummary: true, bars: []
    });

    if (!ganttExpandState[bKey]) return;

    Object.keys(prods).sort().forEach(function(pname) {
      const items = prods[pname];
      const pKey = bKey + '_' + pname;
      if (typeof ganttExpandState[pKey] === 'undefined') ganttExpandState[pKey] = false;
      const pQty = items.reduce(function(s,it){ return s + resolveQty(it.d); }, 0);

      // ▶ batchProd — summary, bars 없음
      rows.push({
        type: 'batchProd', key: pKey, pname,
        count: pQty, bid,
        expanded: ganttExpandState[pKey],
        isSummary: true, bars: []
      });

      if (!ganttExpandState[pKey]) return;

      // ▶ snLine — leaf, bar 있음
      items.forEach(function(it) {
        const cur = it.d.currentProcess;
        const route = window.getRoute(it.sn, it.d);
        let bars = [];
        if (cur) {
          const b = gMakeBar(it.sn, it.d, cur, dates);
          if (b) bars = [b];
        }
        if (!bars.length) {
          bars = route.map(function(p){ return gMakeBar(it.sn, it.d, p, dates); }).filter(Boolean);
        }
        rows.push({ type: 'snLine', sn: it.sn, isSummary: false, bars, depth: 2 });
      });
    });
  });
  console.log('[DEBUG][ROWS][batch] count=', rows.length);
  console.table(rows.slice(0, 150).map(function (r) { return { type: r.type, label: r.label || r.pname || r.proc || r.bid || r.sn || '', isSummary: r.isSummary, bars: Array.isArray(r.bars) ? r.bars.length : 'none', qty: r.qty }; }));
  return rows;
}

// ══════════════════════════════════════════════════════════
// gBuildProduct: 제품 > S/N
// prodHead → isSummary:true, bars:[]
// snLine → leaf, bar 있음
// ══════════════════════════════════════════════════════════
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
    const pQty = items.reduce(function(s,it){ return s + resolveQty(it.d); }, 0);

    // ▶ prodHead — summary, bars 없음
    rows.push({
      type: 'prodHead', key: pKey, pname,
      count: pQty, expanded: ganttExpandState[pKey],
      isSummary: true, bars: []
    });

    if (!ganttExpandState[pKey]) return;

    // ▶ snLine — leaf, bar 있음
    items.forEach(function(it) {
      const cur = it.d.currentProcess;
      const route = window.getRoute(it.sn, it.d);
      let bars = [];
      if (cur) {
        const b = gMakeBar(it.sn, it.d, cur, dates);
        if (b) bars = [b];
      }
      if (!bars.length) {
        bars = route.map(function(p){ return gMakeBar(it.sn, it.d, p, dates); }).filter(Boolean);
      }
      rows.push({ type: 'snLine', sn: it.sn, isSummary: false, bars, depth: 1 });
    });
  });
  return rows;
}

// ══════════════════════════════════════════════════════════
// renderGantt
// ══════════════════════════════════════════════════════════
window.renderGantt = function renderGantt() {
  const filtered = (function () {
    if (typeof window.getFiltered === 'function') return window.getFiltered();
    const raw = (S && S.DATA) ? S.DATA : {};
    const prodF = (document.getElementById('ganttProdFilter') || {}).value || '';
    const statF = (document.getElementById('ganttStatusFilter') || {}).value || '';
    const out = {};
    Object.keys(raw).forEach(function (sn) {
      const d = raw[sn];
      if (prodF && (d.productName || '') !== prodF) return;
      if (statF && (d.status || '') !== statF) return;
      out[sn] = d;
    });
    return out;
  })();
  const cnt = Object.keys(filtered).length;
  console.log('[간트] getFiltered:', cnt, '건 / 전체:', Object.keys(S.DATA || {}).length, '건');

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

  // ── 헤더 ──
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

  // ── 사이드바 + 바디 ──
  let sbH = '', bH = '';
  rows.forEach(function(r) {

    // 사이드바 렌더
    if (r.type === 'procHead') {
      const badge = r.qty > 0 ? ' <span style="font-size:11px;font-weight:400;color:var(--t2);margin-left:6px">'+r.qty+'매</span>' : '';
      sbH += '<div style="height:'+G_ROW+'px;display:flex;align-items:center;padding:0 8px;border-top:2px solid var(--border);background:var(--bg1);font-weight:700;font-size:13px;gap:6px">';
      sbH += '<span style="color:'+r.color+';font-size:16px">&#9679;</span>';
      sbH += escFn(r.proc) + badge + '</div>';

    } else if (r.type === 'equip') {
      const arrow = r.expanded ? '&#9660;' : '&#9654;';
      const qBadge = r.qty > 0
        ? '<span style="margin-left:auto;background:var(--bg3);padding:1px 6px;border-radius:8px;font-size:10px;color:var(--t2)">'+r.qty+'매</span>'
        : '<span style="margin-left:auto;font-size:10px;color:var(--t3)">&mdash;</span>';
      sbH += '<div onclick="window.toggleG(\''+r.key+'\')" style="height:'+G_ROW+'px;display:flex;align-items:center;padding:0 8px 0 20px;cursor:pointer;font-size:12px;gap:4px;border-bottom:1px solid var(--border);background:var(--bg2)">';
      sbH += '<span style="font-size:9px;color:var(--t3);width:12px">'+arrow+'</span>';
      sbH += '<span style="color:'+G_CLR[r.proc]+';font-size:10px">&#9632;</span> ';
      sbH += escFn(r.label) + qBadge + '</div>';

    } else if (r.type === 'procProd') {
      const arrow = r.expanded ? '&#9660;' : '&#9654;';
      sbH += '<div onclick="window.toggleG(\''+r.key+'\')" style="height:'+G_ROW+'px;display:flex;align-items:center;padding:0 8px 0 40px;cursor:pointer;font-size:11px;gap:4px;border-bottom:1px solid var(--border);background:var(--bg3)">';
      sbH += '<span style="font-size:8px;color:var(--t3);width:10px">'+arrow+'</span>';
      sbH += '<span style="color:'+G_CLR[r.proc]+';font-size:9px">&#9632;</span> ';
      sbH += escFn(r.pname);
      sbH += ' <span style="margin-left:auto;font-size:10px;color:var(--t2)">'+r.qty+'매</span></div>';

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

    // 바디 배경
    let rowBg = '';
    if (r.type === 'procHead') rowBg = 'background:var(--bg1);border-top:2px solid var(--border);';
    else if (r.type === 'equip' || r.type === 'batchProd') rowBg = 'background:var(--bg2);';
    else if (r.type === 'procProd') rowBg = 'background:var(--bg3);';
    else if (r.type === 'batchHead' || r.type === 'prodHead') rowBg = 'background:var(--bg1);border-top:2px solid var(--border);';

    bH += '<div style="position:relative;height:'+G_ROW+'px;width:'+totalW+'px;'+rowBg+'border-bottom:1px solid var(--border)">';

    // 주말 음영
    dates.forEach(function(dt, idx) {
      const day = parseLocalDate(dt);
      const d = day ? day.getDay() : 0;
      if (d === 0 || d === 6) {
        bH += '<div style="position:absolute;left:'+(idx*ganttCellW)+'px;top:0;width:'+ganttCellW+'px;height:100%;background:rgba(128,128,128,0.06)"></div>';
      }
    });

    // ── bar 렌더링 ──
    // isPreview(호기/제품 집계 preview) → opacity 낮게, height 낮게, delayed x2over 미적용
    // leaf snLine → 기존 스타일 그대로
    if (!gIsSummaryRow(r) && Array.isArray(r.bars) && r.bars.length > 0) {
      const isPreview = r.isPreview === true;
      const barTop    = isPreview ? Math.floor(G_ROW * 0.28) : 6;
      const barH      = isPreview ? Math.floor(G_ROW * 0.44) : (G_ROW - 12);
      r.bars.forEach(function(b) {
        // preview row에서는 x2over(지연 연장선) 사용 안 함
        const x2use = (isPreview && b.x2over) ? b.x2 : (b.x2over || b.x2);
        const left = b.x1 * ganttCellW;
        const w = Math.max((x2use - b.x1 + 1) * ganttCellW - 2, 4);
        const clr = G_CLR[b.proc] || '#666';
        let style;
        if (isPreview) {
          // preview: delayed 여부와 무관하게 색상+opacity만, outline 없음
          if (b.status === '완료') {
            style = 'background:'+clr+';opacity:0.45;border-radius:3px;background-image:repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(255,255,255,0.15) 3px,rgba(255,255,255,0.15) 6px);';
          } else if (b.status === '진행') {
            style = 'background:'+clr+';opacity:0.55;border-radius:3px;';
          } else {
            style = 'background:'+clr+';opacity:0.22;border-radius:3px;';
          }
        } else {
          style = gBarStyle(b);
        }
        let label = '';
        if (!isPreview && ganttCellW >= 18) {
          label = b.proc || b.bid || '';
          const maxCh = Math.floor(w / 7);
          if (label.length > maxCh) label = label.slice(0, maxCh - 1) + '…';
        }
        const tip = (b.sn ? b.sn+'|' : '')+(b.pname||'')+'|'+b.proc+'|'+b.s+'~'+b.e+'|'+b.status+(b.delayed&&!isPreview?' | 지연 '+b.delayDays+'일':'');
        const hover = isPreview ? '' : " onmouseover=\"this.style.transform='scale(1.04)'\" onmouseout=\"this.style.transform='scale(1)'\"";
        bH += '<div title="'+tip+'" style="position:absolute;left:'+left+'px;top:'+barTop+'px;height:'+barH+'px;'+style+'display:flex;align-items:center;justify-content:center;width:'+w+'px;font-size:8px;color:#fff;font-weight:500;overflow:hidden;white-space:nowrap;cursor:default;pointer-events:auto"'+hover+'>';
        bH += label + '</div>';
      });
    }

    bH += '</div>';
  });

  // 오늘 선
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


