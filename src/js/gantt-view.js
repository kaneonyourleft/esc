/**
 * Gantt Chart View Logic
 * @module gantt-view
 */
import * as GanttService from './gantt-service.js';

let ganttViewMode = 'process';
let ganttCellW = 28;
let ganttExpandState = {};

const G_ROW = 34;
const G_HEAD = 28;
const G_PROCS = ['탈지','소성','환원소성','평탄화','도금','열처리'];
const G_CLR = {
  '탈지':'#06b6d4','소성':'#f97316','환원소성':'#a855f7',
  '평탄화':'#10b981','도금':'#eab308','열처리':'#ef4444'
};

export function setGanttView(mode, btn) {
  ganttViewMode = mode;
  ganttExpandState = {};
  document.querySelectorAll('.gantt-view-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderGantt();
}

export function ganttZoom(delta) {
  ganttCellW = Math.max(12, Math.min(60, ganttCellW + delta));
  const lbl = document.getElementById('ganttZoomLabel');
  if (lbl) lbl.textContent = ganttCellW + 'px';
  renderGantt();
}

export function ganttGoToday() {
  const wrap = document.getElementById('ganttBodyWrap');
  const line = document.querySelector('.gantt-today-line');
  if (wrap && line) {
    const x = parseFloat(line.style.left) - wrap.clientWidth / 2;
    wrap.scrollLeft = Math.max(0, x);
  }
}

export function ganttToggleAll() {
  const allExp = Object.values(ganttExpandState).every(v => v);
  Object.keys(ganttExpandState).forEach(k => ganttExpandState[k] = !allExp);
  const btn = document.getElementById('ganttExpandAllBtn');
  if (btn) btn.textContent = !allExp ? '모두 접기' : '모두 펼치기';
  renderGantt();
}

export function toggleG(key) {
  ganttExpandState[key] = !ganttExpandState[key];
  renderGantt();
}

function gBarStyle(bar) {
  const clr = G_CLR[bar.proc] || '#666';
  if (bar.status === '완료') {
    return `background:${clr};opacity:0.85;background-image:repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(255,255,255,0.15) 3px,rgba(255,255,255,0.15) 6px);`;
  } else if (bar.status === '진행') {
    return `background:${clr};opacity:1;box-shadow:0 0 6px ${clr}80;`;
  } else {
    return `background:${clr};opacity:0.3;`;
  }
}

export function renderGantt() {
  const filtered = window.getFiltered ? window.getFiltered() : {};
  if (Object.keys(filtered).length === 0) {
    const el = document.getElementById('ganttContent');
    if (el) el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--t2)">데이터가 없습니다</div>';
    return;
  }

  GanttService.resetBatchColors();
  const dates = GanttService.gDateRange(filtered, window.getRoute, window.getProc, window.fD);
  const today = new Date().toISOString().slice(0,10);
  const todayIdx = dates.indexOf(today);

  let rows;
  if (ganttViewMode === 'process') {
    rows = GanttService.gBuildProcess(filtered, dates, G_PROCS, G_CLR, window.EQ_MAP, window.getRoute, window.getProc, ganttExpandState);
  } else if (ganttViewMode === 'batch') {
    rows = GanttService.gBuildBatch(filtered, dates, window.getRoute, window.getProc, window.fD, GanttService.gBatchColor, GanttService.gDays, ganttExpandState);
  } else {
    rows = GanttService.gBuildProduct(filtered, dates, window.getRoute, window.getProc, window.fD, GanttService.gBatchColor, GanttService.gDays, ganttExpandState);
  }

  const totalW = dates.length * ganttCellW;
  let hH = `<div style="display:flex;height:${G_HEAD}px;border-bottom:1px solid var(--border)">`;
  let curM = '', mStart = 0;
  for (let i = 0; i <= dates.length; i++) {
    const m = i < dates.length ? dates[i].slice(0,7) : '';
    if (m !== curM) {
      if (curM) {
        const mw = (i - mStart) * ganttCellW;
        hH += `<div style="width:${mw}px;min-width:${mw}px;text-align:center;font-size:11px;font-weight:600;color:var(--t2);line-height:${G_HEAD}px;border-right:1px solid var(--border)">${curM}</div>`;
      }
      curM = m; mStart = i;
    }
  }
  hH += '</div>';

  hH += `<div style="display:flex;height:${G_HEAD}px;border-bottom:2px solid var(--border)">`;
  dates.forEach(dt => {
    const day = new Date(dt+'T00:00:00').getDay();
    const isWe = day === 0 || day === 6;
    const isToday = dt === today;
    const bg = isToday ? 'background:var(--primary);color:#fff;border-radius:4px;' : isWe ? 'color:var(--t3);' : '';
    hH += `<div style="width:${ganttCellW}px;min-width:${ganttCellW}px;text-align:center;font-size:10px;line-height:${G_HEAD}px;${bg}">${parseInt(dt.slice(8))}</div>`;
  });
  hH += '</div>';

  let sbH = '', bH = '';
  const esc = window.esc || (s => s);

  rows.forEach(r => {
    if (r.type === 'procHead') {
      sbH += `<div style="height:${G_ROW}px;display:flex;align-items:center;padding:0 8px;border-top:2px solid var(--border);background:var(--bg1);font-weight:700;font-size:13px;gap:6px">
        <span style="color:${r.color};font-size:16px">●</span> ${esc(r.proc)}</div>`;
    } else if (r.type === 'equip') {
      const arrow = r.expanded ? '▼' : '▶';
      sbH += `<div onclick="window.toggleG('${r.key}')" style="height:${G_ROW}px;display:flex;align-items:center;padding:0 8px 0 20px;cursor:pointer;font-size:12px;gap:4px;border-bottom:1px solid var(--border);background:var(--bg2)">
        <span style="font-size:9px;color:var(--t3);width:12px">${arrow}</span>
        <span style="color:${G_CLR[r.proc]};font-size:10px">■</span> ${esc(r.label)}
        <span style="margin-left:auto;background:var(--bg3);padding:1px 6px;border-radius:8px;font-size:10px;color:var(--t2)">${r.count}</span></div>`;
    } else if (r.type === 'prodLine') {
      sbH += `<div style="height:${G_ROW}px;display:flex;align-items:center;padding:0 8px 0 40px;font-size:11px;gap:4px;border-bottom:1px solid var(--border);color:var(--t1)">
        <span style="width:8px;height:8px;border-radius:50%;background:${GanttService.gBatchColor(r.bid)};flex-shrink:0"></span>
        ${esc(r.pname)} <span style="color:var(--t3);font-size:10px">(${r.count}매)</span></div>`;
    } else if (r.type === 'batchHead') {
      const arrow = r.expanded ? '▼' : '▶';
      sbH += `<div onclick="window.toggleG('${r.key}')" style="height:${G_ROW}px;display:flex;align-items:center;padding:0 8px;cursor:pointer;font-weight:600;font-size:12px;gap:6px;border-top:2px solid var(--border);background:var(--bg1)">
        <span style="font-size:9px;color:var(--t3)">${arrow}</span>
        <span style="width:10px;height:10px;border-radius:3px;background:${r.color};flex-shrink:0"></span>
        ${esc(r.bid)} <span style="color:var(--t3);font-size:10px">(${r.count})</span></div>`;
    } else if (r.type === 'batchProd') {
      sbH += `<div style="height:${G_ROW}px;display:flex;align-items:center;padding:0 8px 0 28px;font-size:11px;gap:4px;border-bottom:1px solid var(--border)">
        ${esc(r.pname)} <span style="color:var(--t3);font-size:10px">(${r.count}매)</span></div>`;
    } else if (r.type === 'prodHead') {
      const arrow = r.expanded ? '▼' : '▶';
      sbH += `<div onclick="window.toggleG('${r.key}')" style="height:${G_ROW}px;display:flex;align-items:center;padding:0 8px;cursor:pointer;font-weight:600;font-size:12px;gap:6px;border-top:2px solid var(--border);background:var(--bg1)">
        <span style="font-size:9px;color:var(--t3)">${arrow}</span>
        ${esc(r.pname)} <span style="color:var(--t3);font-size:10px">(${r.count}매)</span></div>`;
    } else if (r.type === 'prodBatch') {
      sbH += `<div style="height:${G_ROW}px;display:flex;align-items:center;padding:0 8px 0 28px;font-size:11px;gap:6px;border-bottom:1px solid var(--border)">
        <span style="width:8px;height:8px;border-radius:2px;background:${r.color};flex-shrink:0"></span>
        ${esc(r.bid)} <span style="color:var(--t3);font-size:10px">(${r.count}매)</span></div>`;
    }

    let rowBg = '';
    if (r.type === 'procHead') rowBg = 'background:var(--bg1);border-top:2px solid var(--border);';
    else if (r.type === 'equip') rowBg = 'background:var(--bg2);';
    else if (r.type === 'batchHead' || r.type === 'prodHead') rowBg = 'background:var(--bg1);border-top:2px solid var(--border);';

    bH += `<div style="position:relative;height:${G_ROW}px;width:${totalW}px;${rowBg}border-bottom:1px solid var(--border)">`;
    dates.forEach((dt, idx) => {
      const day = new Date(dt+'T00:00:00').getDay();
      if (day === 0 || day === 6) {
        bH += `<div style="position:absolute;left:${idx*ganttCellW}px;top:0;width:${ganttCellW}px;height:100%;background:rgba(128,128,128,0.06)"></div>`;
      }
    });

    (r.bars || []).forEach(b => {
      const left = b.x1 * ganttCellW;
      const w = Math.max((b.x2 - b.x1 + 1) * ganttCellW - 2, 4);
      const style = gBarStyle(b);
      let label = b.bid || '';
      if (ganttCellW >= 18 && label.length > 0) {
        const maxCh = Math.floor(w / 7);
        if (label.length > maxCh) label = label.slice(0, maxCh-1) + '…';
      } else label = '';

      let tip = `${b.pname||''} | ${b.bid||''} | ${b.proc} | ${b.s}~${b.e} | ${b.status}`;
      if (b.delayed) tip += ` | 지연 ${b.delayDays}일`;

      bH += `<div title="${tip}" style="position:absolute;left:${left}px;top:6px;height:${G_ROW-12}px;border-radius:4px;${style}display:flex;align-items:center;justify-content:center;width:${w}px;font-size:9px;color:#fff;font-weight:500;overflow:hidden;white-space:nowrap;cursor:pointer;transition:transform 0.1s" onmouseover="this.style.transform='scale(1.04)'" onmouseout="this.style.transform='scale(1)'">${label}</div>`;

      if (b.delayed && b.x2over) {
        const dLeft = (b.x2 + 1) * ganttCellW;
        const dW = (b.x2over - b.x2) * ganttCellW;
        bH += `<div title="지연 ${b.delayDays}일" style="position:absolute;left:${dLeft}px;top:6px;height:${G_ROW-12}px;border-radius:0 4px 4px 0;background:#ef4444;opacity:0.7;width:${dW}px;background-image:repeating-linear-gradient(90deg,transparent,transparent 3px,rgba(255,255,255,0.2) 3px,rgba(255,255,255,0.2) 6px)"></div>`;
      }
    });
    bH += '</div>';
  });

  const todayLine = todayIdx >= 0 ? `<div class="gantt-today-line" style="position:absolute;left:${todayIdx*ganttCellW + Math.floor(ganttCellW/2)}px;top:0;width:2px;height:100%;background:#ef4444;z-index:5;pointer-events:none"><div style="position:absolute;top:-18px;left:-16px;font-size:9px;color:#ef4444;font-weight:700">TODAY</div></div>` : '';

  const elHeader = document.getElementById('ganttHeader');
  const elSidebar = document.getElementById('ganttSidebar');
  const elBody = document.getElementById('ganttBody');
  if (elHeader && elSidebar && elBody) {
    elHeader.innerHTML = hH;
    elHeader.style.minWidth = totalW + 'px';
    elSidebar.innerHTML = sbH;
    elBody.innerHTML = bH + todayLine;
    elBody.style.minWidth = totalW + 'px';
  }
  setTimeout(() => ganttGoToday(), 100);
}
