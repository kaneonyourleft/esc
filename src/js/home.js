/* ============================================================
   home.js – 홈 탭 렌더링
   ESC Manager v10 – Module Split (복구)
   ============================================================ */
import * as S from './state.js';
import { PROC_ORDER, PROC_COLORS, DEFAULT_WIDGETS } from './constants.js';
import { fD, todayStr, statusBadge, toast, getWidgetConfig, esc, calcProgress, getDplus } from './utils.js';

function renderHome() {
  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 12 ? '좋은 아침입니다' : hour < 18 ? '좋은 오후입니다' : '좋은 저녁입니다';
  const name = currentUser?.displayName || '사용자';
  document.getElementById('greetMsg').textContent = `${greet}, ${name}님!`;
  document.getElementById('greetSub').textContent = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 — 현재 생산 현황을 확인하세요`;

  const delayed = Object.entries(DATA).filter(([, d]) => (d.status || '대기') === '지연');
  const alertCard = document.getElementById('delayAlertCard');
  if (delayed.length > 0) {
    alertCard.style.display = 'block';
    document.getElementById('delayAlertMsg').textContent = `현재 ${delayed.length}건의 지연 LOT이 있습니다. 즉시 확인이 필요합니다.`;
  } else {
    alertCard.style.display = 'none';
  }
  renderWidgets();
}

function renderWidgets() {
  const container = document.getElementById('widgetContainer');
  if (!container) return;
  const widgets = getWidgets();
  let html = '';
  widgets.filter(w => w.enabled).forEach(w => {
    switch (w.id) {
      case 'kpi': html += renderKpiWidget(); break;
      case 'pipeline': html += renderPipelineWidget(); break;
      case 'today': html += renderTodayWidget(); break;
      case 'alerts': html += renderAlertsWidget(); break;
      case 'chart_donut': html += '<div class="card"><div class="card-title">상태 분포</div><canvas id="homeDonut" height="240"></canvas></div>'; break;
      case 'chart_weekly': html += '<div class="card"><div class="card-title">주간 트렌드</div><canvas id="homeWeekly" height="240"></canvas></div>'; break;
      case 'recent': html += renderRecentWidget(); break;
    }
  });
  container.innerHTML = html;
  if (document.getElementById('homeDonut')) drawDonutChart('homeDonut');
  if (document.getElementById('homeWeekly')) drawWeeklyChart('homeWeekly');
}

function renderKpiWidget() {
  const total = Object.keys(DATA).length;
  let prog = 0, done = 0, delay = 0;
  Object.values(DATA).forEach(d => {
    const s = d.status || '대기';
    if (s === '진행') prog++;
    if (s === '완료') done++;
    if (s === '지연') delay++;
  });
  return `<div class="grid4">
    <div class="kpi-card"><div class="kpi-val">${total}</div><div class="kpi-lbl">전체 LOT</div></div>
    <div class="kpi-card"><div class="kpi-val" style="color:var(--ac2)">${prog}</div><div class="kpi-lbl">진행중</div></div>
    <div class="kpi-card"><div class="kpi-val" style="color:var(--suc)">${done}</div><div class="kpi-lbl">완료</div></div>
    <div class="kpi-card"><div class="kpi-val" style="color:var(--err)">${delay}</div><div class="kpi-lbl">지연</div></div>
  </div>`;
}

function renderPipelineWidget() {
  let stats = {};
  PROC_ORDER.forEach(p => stats[p] = { total: 0, done: 0 });
  Object.entries(DATA).forEach(([sn, d]) => {
    getRoute(sn, d).forEach(proc => {
      if (!stats[proc]) stats[proc] = { total: 0, done: 0 };
      stats[proc].total++;
      if (getProc(d, proc).status === '완료') stats[proc].done++;
    });
  });
  let html = '<div class="card"><div class="card-title">공정 파이프라인</div><div class="pipeline-grid">';
  PROC_ORDER.forEach(proc => {
    const s = stats[proc] || { total: 0, done: 0 };
    const pct = s.total ? Math.round(s.done / s.total * 100) : 0;
    html += `<div class="pipeline-item"><div class="pipeline-bar" style="background:${PROC_COLORS[proc] || '#666'};width:${pct}%"></div><div class="pipeline-info"><span style="color:${PROC_COLORS[proc] || '#666'};font-weight:600">${esc(proc)}</span><span>${s.done}/${s.total}</span></div></div>`;
  });
  html += '</div></div>';
  return html;
}

function renderTodayWidget() {
  const today = todayStr();
  let items = [];
  Object.entries(DATA).forEach(([sn, d]) => {
    getRoute(sn, d).forEach(proc => {
      const p = getProc(d, proc);
      if (fD(p.planStart) === today || fD(p.planEnd) === today || fD(p.actualStart) === today) {
        items.push({ sn, proc, data: p });
      }
    });
  });
  let html = '<div class="card"><div class="card-title">오늘의 작업</div>';
  if (items.length) {
    html += '<div class="today-list">';
    items.slice(0, 10).forEach(item => {
      html += `<div class="today-item" onclick="openSidePanel('${esc(item.sn)}')" style="cursor:pointer"><span class="badge" style="background:${PROC_COLORS[item.proc] || '#666'};color:#fff;font-size:11px">${esc(item.proc)}</span> <span style="font-size:13px">${esc(item.sn)}</span> <span class="badge ${item.data.status === '완료' ? 'badge-done' : item.data.status === '진행' ? 'badge-prog' : 'badge-wait'}" style="font-size:11px">${esc(item.data.status || '대기')}</span></div>`;
    });
    if (items.length > 10) html += `<div style="font-size:12px;color:var(--t2);text-align:center;padding:4px">외 ${items.length - 10}건</div>`;
    html += '</div>';
  } else {
    html += '<div style="font-size:13px;color:var(--t2);padding:12px">오늘 예정된 작업이 없습니다</div>';
  }
  html += '</div>';
  return html;
}

function renderAlertsWidget() {
  const delayed = Object.entries(DATA).filter(([, d]) => (d.status || '대기') === '지연');
  const today = todayStr();
  const upcoming = Object.entries(DATA).filter(([, d]) => {
    if (!d.endDate || (d.status || '대기') === '완료') return false;
    const diff = diffBD(today, fD(d.endDate));
    return diff >= 0 && diff <= 3;
  });
  let html = '<div class="card"><div class="card-title">알림</div>';
  if (!delayed.length && !upcoming.length) {
    html += '<div style="font-size:13px;color:var(--t2);padding:12px">현재 알림이 없습니다</div>';
  } else {
    delayed.forEach(([sn]) => {
      html += `<div class="alert-item alert-danger" onclick="openSidePanel('${esc(sn)}')" style="cursor:pointer">⚠️ <strong>${esc(sn)}</strong> — 지연</div>`;
    });
    upcoming.forEach(([sn, d]) => {
      html += `<div class="alert-item alert-warn" onclick="openSidePanel('${esc(sn)}')" style="cursor:pointer">⏰ <strong>${esc(sn)}</strong> — 납기 임박 (${fmt(fD(d.endDate))})</div>`;
    });
  }
  html += '</div>';
  return html;
}

function renderRecentWidget() {
  const sorted = Object.entries(DATA).sort((a, b) => {
    const da = fD(a[1].updatedAt || a[1].createdAt || '');
    const db = fD(b[1].updatedAt || b[1].createdAt || '');
    return db.localeCompare(da);
  }).slice(0, 8);
  let html = '<div class="card"><div class="card-title">최근 활동</div>';
  if (sorted.length) {
    sorted.forEach(([sn, d]) => {
      html += `<div class="recent-item" onclick="openSidePanel('${esc(sn)}')" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:13px">${esc(sn)}</span>${statusBadge(d.status)}</div>`;
    });
  } else {
    html += '<div style="font-size:13px;color:var(--t2);padding:12px">활동 내역이 없습니다</div>';
  }
  html += '</div>';
  return html;
}

// === 워크스페이스 ===
window.setWsView = function(mode, btn) {
  wsViewMode = mode;
  document.querySelectorAll('#workspaceTab .tab-btn').forEach(el => el.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderWorkspace();
};

window.toggleFilter = function(f) {
  wsFilter = f;
  document.querySelectorAll('.filter-chips .chip').forEach(el => el.classList.toggle('active', el.dataset.f === f));
  renderWorkspace();
};

window.toggleAllGroups = function() {
  wsAllExpanded = !wsAllExpanded;
  Object.keys(wsGroupState).forEach(k => wsGroupState[k] = !wsAllExpanded);
  const btn = document.getElementById('expandAllBtn');
  if (btn) btn.textContent = wsAllExpanded ? '모두 접기' : '모두 펼치기';
  renderWorkspace();
};

window.toggleGroup = function(key) {
  wsGroupState[key] = !wsGroupState[key];
  renderWorkspace();
};

