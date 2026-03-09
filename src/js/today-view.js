/**
 * ESC Manager - Today/Home View Logic
 * @module today-view
 */
import { DATA, currentUser, PRODUCTS, ISSUES } from './state.js';
import { PROC_COLORS } from './constants.js';
import { statusBadge, esc } from './app-utils.js';
import { todayStr, fmt } from './date-utils.js';
import { getWidgets, getKpiStats, getPipelineStats, getTodayTasks, getAlerts } from './today-service.js';
import { drawDonutChart, drawWeeklyChart } from './chart-service.js';

/**
 * Main Home tab renderer
 */
export function renderHome() {
  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 12 ? '좋은 아침입니다' : hour < 18 ? '좋은 오후입니다' : '좋은 저녁입니다';
  const name = currentUser?.displayName || '사용자';
  document.getElementById('greetMsg').textContent = `${greet}, ${name}님!`;
  document.getElementById('greetSub').textContent = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 — 현재 생산 현황을 확인하세요`;

  const { delayed } = getAlerts();
  const alertCard = document.getElementById('delayAlertCard');
  if (delayed.length > 0) {
    alertCard.style.display = 'block';
    document.getElementById('delayAlertMsg').textContent = `현재 ${delayed.length}건의 지연 LOT이 있습니다. 즉시 확인이 필요합니다.`;
  } else {
    alertCard.style.display = 'none';
  }
  renderWidgets();
}

/**
 * Render Home tab widgets based on configuration
 */
export function renderWidgets() {
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
  const { total, prog, done, delay } = getKpiStats();
  return `<div class="grid4">
    <div class="kpi-card"><div class="kpi-val">${total}</div><div class="kpi-lbl">전체 LOT</div></div>
    <div class="kpi-card"><div class="kpi-val" style="color:var(--ac2)">${prog}</div><div class="kpi-lbl">진행중</div></div>
    <div class="kpi-card"><div class="kpi-val" style="color:var(--suc)">${done}</div><div class="kpi-lbl">완료</div></div>
    <div class="kpi-card"><div class="kpi-val" style="color:var(--err)">${delay}</div><div class="kpi-lbl">지연</div></div>
  </div>`;
}

function renderPipelineWidget() {
  const stats = getPipelineStats();
  let html = '<div class="card"><div class="card-title">공정 파이프라인</div><div class="pipeline-grid">';
  Object.entries(stats).forEach(([proc, s]) => {
    const pct = s.total ? Math.round(s.done / s.total * 100) : 0;
    html += `<div class="pipeline-item"><div class="pipeline-bar" style="background:${PROC_COLORS[proc] || '#666'};width:${pct}%"></div><div class="pipeline-info"><span style="color:${PROC_COLORS[proc] || '#666'};font-weight:600">${esc(proc)}</span><span>${s.done}/${s.total}</span></div></div>`;
  });
  html += '</div></div>';
  return html;
}

function renderTodayWidget() {
  const items = getTodayTasks();
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
  const { delayed, upcoming } = getAlerts();
  let html = '<div class="card"><div class="card-title">알림</div>';
  if (!delayed.length && !upcoming.length) {
    html += '<div style="font-size:13px;color:var(--t2);padding:12px">현재 알림이 없습니다</div>';
  } else {
    delayed.forEach((sn) => {
      html += `<div class="alert-item alert-danger" onclick="openSidePanel('${esc(sn)}')" style="cursor:pointer">⚠️ <strong>${esc(sn)}</strong> — 지연</div>`;
    });
    upcoming.forEach(({ sn, endDate }) => {
      html += `<div class="alert-item alert-warn" onclick="openSidePanel('${esc(sn)}')" style="cursor:pointer">⏰ <strong>${esc(sn)}</strong> — 납기 임박 (${fmt(endDate)})</div>`;
    });
  }
  html += '</div>';
  return html;
}

/**
 * Render Home tab items
 */
function renderRecentWidget() {
  const sorted = Object.entries(DATA).sort((a, b) => {
    const da = fmt(a[1].updatedAt || a[1].createdAt || ''); 
    const db = fmt(b[1].updatedAt || b[1].createdAt || '');
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

/**
 * Side Panel
 */
export function openSidePanel(sn) {
  const d = DATA[sn];
  if (!d) { toast('데이터를 찾을 수 없습니다', 'error'); return; }

  document.getElementById('spSN').textContent = sn;
  document.getElementById('spBadge').innerHTML = statusBadge(d.status || '대기');
  document.getElementById('spCat').textContent = extractCategory(sn);
  document.getElementById('spStatusSel').value = d.status || '대기';

  const body = document.getElementById('spBody');
  const route = buildRoute(d.category, d.heat, d.dcJoint);
  const progress = calcProgress(d, sn);

  let html = `
    <div class="sp-section">
      <div class="sp-label">진행률</div>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="flex:1;height:8px;background:var(--bg4);border-radius:4px;overflow:hidden">
          <div style="width:${progress}%;height:100%;background:${progress >= 100 ? 'var(--suc)' : 'var(--ac2)'};border-radius:4px;transition:width 0.3s"></div>
        </div>
        <span style="font-size:13px;font-weight:600">${progress}%</span>
      </div>
    </div>
    <div class="sp-section">
      <div class="sp-label">기본 정보</div>
      <div class="sp-info-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">
        <div>제품: <strong>${esc(d.productName || '-')}</strong></div>
        <div>카테고리: <strong>${esc(extractCategory(sn))}</strong></div>
        <div>시작일: <strong>${fmt(fD(d.startDate))}</strong></div>
        <div>납기: <strong>${fmt(fD(d.endDate))}</strong></div>
        <div>고객: <strong>${esc(d.customer || '-')}</strong></div>
        <div>배치: <strong>${esc(d.batch || '-')}</strong></div>
      </div>
    </div>
    <div class="sp-section">
      <div class="sp-label" style="display:flex;align-items:center;justify-content:space-between">
        공정 현황
        <button class="btn btn-secondary btn-sm" onclick="openProcDetailModal('${esc(sn)}')" style="font-size:11px">✏️ 전체편집</button>
      </div>
      <div class="sp-proc-list">`;

  route.forEach((proc, idx) => {
    const p = getProc(d, proc);
    const st = p.status || '대기';
    const color = PROC_COLORS[proc] || '#666';
    const isCurrent = proc === (d.currentProcess || route[0]);

    let actionBtn = '';
    if (st === '진행') {
      actionBtn = `<button onclick="event.stopPropagation();quickCompleteProc('${esc(sn)}','${esc(proc)}',${idx},${route.length})" style="padding:3px 10px;font-size:11px;border:none;border-radius:5px;cursor:pointer;background:#10b981;color:#fff;font-weight:600;white-space:nowrap;transition:opacity 0.2s" onmouseenter="this.style.opacity='0.85'" onmouseleave="this.style.opacity='1'">✓ 완료</button>`;
    } else if (st === '대기') {
      const prevAllDone = route.slice(0, idx).every(pp => (getProc(d, pp).status || '대기') === '완료');
      const isFirstWaiting = idx === route.findIndex(pp => (getProc(d, pp).status || '대기') === '대기');
      if (prevAllDone && isFirstWaiting) {
        actionBtn = `<button onclick="event.stopPropagation();quickStartProc('${esc(sn)}','${esc(proc)}')" style="padding:3px 10px;font-size:11px;border:none;border-radius:5px;cursor:pointer;background:#6366f1;color:#fff;font-weight:600;white-space:nowrap;transition:opacity 0.2s" onmouseenter="this.style.opacity='0.85'" onmouseleave="this.style.opacity='1'">▶ 시작</button>`;
      }
    }

    html += `<div class="sp-proc-item" style="padding:8px 10px;margin-bottom:6px;border-radius:8px;border-left:3px solid ${color};background:${isCurrent ? 'rgba(99,102,241,0.08)' : 'var(--bg4)'}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <span style="font-weight:600;font-size:13px;color:${color}">${idx + 1}. ${esc(proc)}</span>
        <div style="display:flex;align-items:center;gap:6px">${statusBadge(st)}${actionBtn}</div>
      </div>
      <div style="font-size:11px;color:var(--t2);display:grid;grid-template-columns:1fr 1fr;gap:2px">
        <div>설비: ${esc(p.equip || '-')}</div>
        <div>계획: ${p.planDays || '-'}일</div>
        <div>시작: ${fmt(fD(p.planStart || p.actualStart))}</div>
        <div>종료: ${fmt(fD(p.actualEnd || p.planEnd))}</div>
        <div>실적: ${p.actualDays || '-'}일</div>
        <div>불량: ${esc(p.defect || '-')}</div>
      </div>
      ${p.remark ? `<div style="font-size:11px;color:var(--t2);margin-top:3px">📝 ${esc(p.remark)}</div>` : ''}
    </div>`;
  });
  html += '</div></div>';

  const snIssues = ISSUES.filter(i => i.sn === sn);
  if (snIssues.length) {
    html += `<div class="sp-section"><div class="sp-label">이슈 (${snIssues.length})</div>`;
    snIssues.forEach(issue => {
      html += `<div style="padding:6px 8px;margin-bottom:4px;background:rgba(239,68,68,0.06);border-radius:6px;font-size:12px">
        <div style="display:flex;justify-content:space-between"><span class="badge badge-delay" style="font-size:10px">${esc(issue.type || '기타')}</span><span style="color:var(--t2);font-size:10px">${fmt(fD(issue.date))}</span></div>
        <div style="margin-top:3px">${esc(issue.content || '')}</div>
      </div>`;
    });
    html += '</div>';
  }

  body.innerHTML = html;
  document.getElementById('sidePanel').classList.add('open');
}

export function closeSidePanel() {
  document.getElementById('sidePanel').classList.remove('open');
}

/**
 * Process Detail Modal
 */
export function openProcDetailModal(sn) {
  const d = DATA[sn];
  if (!d) return;
  const route = buildRoute(d.category, d.heat, d.dcJoint);
  const cat = extractCategory(sn);

  let html = `<div class="modal-header"><div class="modal-title">✏️ 공정 상세 편집 — ${esc(sn)}</div><button class="modal-close btn-icon" onclick="closeModal('reportModal')">✕</button></div>`;
  html += '<div style="max-height:60vh;overflow-y:auto">';

  route.forEach((proc, idx) => {
    const p = getProc(d, proc);
    const color = PROC_COLORS[proc] || '#666';
    const equipList = getEquipList(proc, cat);
    const defaultDays = getDefaultDays(proc, cat);

    html += `<div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:10px;border-left:3px solid ${color}">
      <div style="font-weight:600;color:${color};margin-bottom:8px">${idx + 1}. ${esc(proc)} (기본 ${defaultDays}일)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" style="font-size:11px">상태</label>
          <select class="form-input form-select" id="pd_st_${idx}" style="padding:5px 8px;font-size:12px">
            <option value="대기" ${(p.status || '대기') === '대기' ? 'selected' : ''}>대기</option>
            <option value="진행" ${p.status === '진행' ? 'selected' : ''}>진행</option>
            <option value="완료" ${p.status === '완료' ? 'selected' : ''}>완료</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" style="font-size:11px">설비</label>
          <select class="form-input form-select" id="pd_eq_${idx}" style="padding:5px 8px;font-size:12px">
            <option value="">선택...</option>
            ${equipList.map(eq => `<option value="${esc(eq)}" ${p.equip === eq ? 'selected' : ''}>${esc(eq)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" style="font-size:11px">시작일</label>
          <input class="form-input" type="date" id="pd_start_${idx}" value="${fD(p.planStart || p.actualStart)}" style="padding:5px 8px;font-size:12px">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" style="font-size:11px">종료일</label>
          <input class="form-input" type="date" id="pd_end_${idx}" value="${fD(p.actualEnd || p.planEnd)}" style="padding:5px 8px;font-size:12px">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" style="font-size:11px">불량</label>
          <input class="form-input" id="pd_def_${idx}" value="${esc(p.defect || '')}" placeholder="불량 내용" style="padding:5px 8px;font-size:12px">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" style="font-size:11px">비고</label>
          <input class="form-input" id="pd_rem_${idx}" value="${esc(p.remark || '')}" placeholder="비고" style="padding:5px 8px;font-size:12px">
        </div>
      </div>
    </div>`;
  });

  html += '</div>';
  html += `<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
    <button class="btn btn-secondary" onclick="closeModal('reportModal')">취소</button>
    <button class="btn btn-primary" onclick="saveProcDetail('${esc(sn)}')">저장</button>
  </div>`;

  document.getElementById('reportContent').innerHTML = html;
  openModal('reportModal');
}

/**
 * QR Modal
 */
export async function showSNQR(sn) {
  if (!sn) return;
  document.getElementById('qrSNLabel').textContent = sn;
  const wrap = document.getElementById('qrCanvasWrap');
  wrap.innerHTML = '';
  openModal('qrModal');
  if (typeof QRCode !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      await QRCode.toCanvas(canvas, sn, { width: 200, margin: 2 });
      wrap.appendChild(canvas);
    } catch { wrap.innerHTML = '<div style="color:var(--err)">QR 생성 실패</div>'; }
  } else {
    wrap.innerHTML = '<div style="color:var(--t2)">QR 라이브러리 로딩 중...</div>';
  }
}

/**
 * Product Modal
 */
export function openProductModal(PRODUCTS) {
  openModal("productModal");
  setTimeout(function(){ try { showProductList(PRODUCTS); } catch(e) { console.warn("showProductList error:", e); } }, 200);
}

export function showProductList(PRODUCTS) {
  var lv = document.getElementById("pm_listView");
  var fv = document.getElementById("pm_formView");
  var tt = document.getElementById("pm_title");
  if (lv) lv.style.display = "";
  if (fv) fv.style.display = "none";
  if (tt) tt.textContent = "📦 제품 관리";
  renderProductList(PRODUCTS);
}

export function showProductForm(editName, PRODUCTS) {
  var lv = document.getElementById('pm_listView');
  var fv = document.getElementById('pm_formView');
  if (lv) lv.style.display = 'none';
  if (fv) fv.style.display = '';
  document.getElementById('pm_editMode').value = editName ? 'edit' : '';
  document.getElementById('pm_origName').value = editName || '';
  if (editName && PRODUCTS[editName]) {
    var p = PRODUCTS[editName];
    var ttl = document.getElementById('pm_title'); if (ttl) ttl.textContent = '📦 제품 수정';
    document.getElementById('pm_saveBtn').textContent = '수정';
    document.getElementById('pm_name').value = p.name || editName;
    document.getElementById('pm_name').disabled = true;
    document.getElementById('pm_cat').value = p.category || 'WN';
    document.getElementById('pm_heat').value = p.heatTreat === true ? 'Y' : (p.heat || 'N');
    document.getElementById('pm_drawing').value = p.drawing || '';
    document.getElementById('pm_shrink').value = p.shrinkage || p.shrink || 0;
    document.getElementById('pm_stack').value = p.stackQty || p.stack || 0;
    document.getElementById('pm_joint').value = p.dcJoint || p.joint || '';
    document.getElementById('pm_d1').value = p.d1 != null ? p.d1 : 6;
    document.getElementById('pm_d2').value = p.d2 != null ? p.d2 : 5;
    document.getElementById('pm_d3').value = p.d3 != null ? p.d3 : 0;
    document.getElementById('pm_d4').value = p.d4 != null ? p.d4 : 3;
    document.getElementById('pm_d5').value = p.d5 != null ? p.d5 : 1;
    document.getElementById('pm_d6').value = p.d6 != null ? p.d6 : 0;
  } else {
    var ttl2 = document.getElementById('pm_title'); if (ttl2) ttl2.textContent = '📦 제품 등록';
    document.getElementById('pm_saveBtn').textContent = '등록';
    document.getElementById('pm_name').value = '';
    document.getElementById('pm_name').disabled = false;
    document.getElementById('pm_cat').value = 'WN';
    document.getElementById('pm_heat').value = 'N';
    document.getElementById('pm_drawing').value = '';
    document.getElementById('pm_shrink').value = '0';
    document.getElementById('pm_stack').value = '0';
    document.getElementById('pm_joint').value = '';
    document.getElementById('pm_d1').value = '6';
    document.getElementById('pm_d2').value = '5';
    document.getElementById('pm_d3').value = '0';
    document.getElementById('pm_d4').value = '3';
    document.getElementById('pm_d5').value = '1';
    document.getElementById('pm_d6').value = '0';
  }
}

export function renderProductList(PRODUCTS) {
  var container = document.getElementById('pm_productList');
  var countEl = document.getElementById('pm_count');
  if (!container) return;
  var keys = Object.keys(PRODUCTS).sort();
  if (countEl) countEl.textContent = keys.length;
  if (keys.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:#999">등록된 제품이 없습니다</div>';
    return;
  }
  container.innerHTML = keys.map(function(k) {
    var p = PRODUCTS[k];
    var route = p.route || [];
    var routeBadges = route.map(function(r){ return '<span style="display:inline-block;padding:1px 6px;margin:1px;border-radius:8px;font-size:10px;color:#fff;background:' + (PROC_COLORS[r]||'#666') + '">' + esc(r) + '</span>'; }).join(' ');
    var snCount = Object.values(DATA).filter(function(d){ return d.productName === k; }).length;
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px;margin-bottom:6px;background:var(--bg3);border-radius:8px;border:1px solid var(--bd1)">'
      + '<div style="flex:1;min-width:0">'
      + '<div style="font-weight:600;font-size:13px">' + esc(k) + '</div>'
      + '<div style="font-size:11px;color:#999;margin-top:2px">' + (p.drawing||'') + ' | DC: ' + (p.dcJoint||p.joint||'-') + ' | S/N: ' + snCount + '건</div>'
      + '<div style="margin-top:4px">' + routeBadges + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:4px;margin-left:8px;flex-shrink:0">'
      + '<button class="btn btn-secondary btn-sm" onclick="showProductForm(\x27' + esc(k) + '\x27)">수정</button>'
      + '<button class="btn btn-sm" style="background:#ef4444;color:#fff" onclick="deleteProduct(\x27' + esc(k) + '\x27,' + snCount + ')">삭제</button>'
      + '</div></div>';
  }).join('');
}
