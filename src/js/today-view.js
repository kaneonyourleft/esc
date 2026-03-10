/* ============================================================
   today-view.js – 오늘 할 일 렌더링
   ESC Manager v10 – Field Execution First
   ============================================================ */
import * as S from './state.js';
import { PROC_COLORS } from './constants.js';
import { esc } from './app-utils.js';
import { fmt } from './utils.js';
import { 
  getDelayedTasks, 
  getTodayTasks, 
  groupByBatch, 
  getDaysUntilDeadline, 
  getSerialRange 
} from './today-service.js';

/**
 * 현재 선택된 날짜 (기본값: 오늘)
 */
let currentDate = new Date();

/**
 * 날짜 포맷 (예: 2026.03.10(월))
 */
function formatDateHeader(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayOfWeek = days[date.getDay()];
  
  return `${year}.${month}.${day}(${dayOfWeek})`;
}

/**
 * 오늘 할 일 메인 렌더링
 */
export function renderTodayView() {
  const container = document.getElementById('widgetContainer');
  if (!container) return;

  // 날짜 바 렌더링
  let html = `
    <div class="today-date-bar">
      <button class="btn-icon" onclick="window.prevDate()">◀</button>
      <div class="today-date-text">${formatDateHeader(currentDate)}</div>
      <button class="btn-icon" onclick="window.nextDate()">▶</button>
    </div>
  `;

  // 데이터 가져오기
  const delayedTasks = getDelayedTasks(S.DATA);
  const todayTasks = getTodayTasks(S.DATA);

  // 지연 섹션
  if (delayedTasks.length > 0) {
    const delayedGroups = groupByBatch(delayedTasks);
    html += renderDelayedSection(delayedGroups);
  }

  // 오늘 작업 섹션
  const todayGroups = groupByBatch(todayTasks);
  html += renderTodaySection(todayGroups);

  container.innerHTML = html;
  
  // 확장/축소 이벤트 리스너 등록
  attachCardToggleListeners();
}

/**
 * 지연 섹션 렌더링
 */
function renderDelayedSection(groups) {
  let html = `
    <div class="today-section today-section-delayed">
      <div class="today-section-header" style="background:var(--err);color:#fff">
        <span style="font-size:18px">⚠️</span>
        <span style="font-weight:700;font-size:15px">지연 작업 (${groups.length})</span>
      </div>
      <div class="today-cards">
  `;

  groups.forEach((group, idx) => {
    html += renderTaskCard(group, idx, true);
  });

  html += `
      </div>
    </div>
  `;

  return html;
}

/**
 * 오늘 작업 섹션 렌더링
 */
function renderTodaySection(groups) {
  let html = `
    <div class="today-section">
      <div class="today-section-header">
        <span style="font-size:18px">📋</span>
        <span style="font-weight:700;font-size:15px">오늘 작업 (${groups.length})</span>
      </div>
      <div class="today-cards">
  `;

  if (groups.length === 0) {
    html += `
      <div class="card" style="text-align:center;padding:32px;color:var(--t2)">
        <div style="font-size:48px;margin-bottom:12px">✓</div>
        <div style="font-size:15px">오늘 예정된 작업이 없습니다</div>
      </div>
    `;
  } else {
    groups.forEach((group, idx) => {
      html += renderTaskCard(group, idx, false);
    });
  }

  html += `
      </div>
    </div>
  `;

  return html;
}

/**
 * 작업 카드 렌더링
 */
function renderTaskCard(group, idx, isDelayed) {
  const quantity = group.items.length;
  const serialRange = getSerialRange(group.items);
  const procColor = PROC_COLORS[group.process] || '#6366f1';
  const cardId = `task-card-${isDelayed ? 'delayed' : 'today'}-${idx}`;
  
  // 상태에 따른 버튼
  let actionButton = '';
  const firstItem = group.items[0];
  const procStatus = firstItem.procData?.status || '대기';
  
  if (procStatus === '대기') {
    actionButton = `
      <button class="btn btn-primary btn-sm" onclick="window.quickStartTask('${cardId}', ${JSON.stringify(group.items.map(i => i.sn))}, '${esc(group.process)}')">
        ▶ 시작
      </button>
    `;
  } else if (procStatus === '진행') {
    actionButton = `
      <button class="btn btn-success btn-sm" onclick="window.quickCompleteTask('${cardId}', ${JSON.stringify(group.items.map(i => i.sn))}, '${esc(group.process)}')">
        ✓ 완료
      </button>
    `;
  }

  let html = `
    <div class="card today-task-card ${isDelayed ? 'today-task-delayed' : ''}" id="${cardId}">
      <div class="today-task-main" onclick="window.toggleTaskCard('${cardId}')">
        <div class="today-task-info">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span class="today-task-process" style="color:${procColor}">${esc(group.process)}</span>
            ${isDelayed ? `<span class="badge badge-danger">+${group.delayDays}일 지연</span>` : ''}
          </div>
          <div class="today-task-product">${esc(group.product)}</div>
          <div class="today-task-quantity">${quantity}매</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${actionButton}
          <span class="today-card-arrow">▼</span>
        </div>
      </div>
      
      <div class="today-task-details" style="display:none">
        <div class="today-task-detail-row">
          <span class="today-task-detail-label">배치</span>
          <span class="today-task-detail-value">${esc(group.batch)}</span>
        </div>
        ${group.equipment ? `
        <div class="today-task-detail-row">
          <span class="today-task-detail-label">장비</span>
          <span class="today-task-detail-value">${esc(group.equipment)}</span>
        </div>
        ` : ''}
        <div class="today-task-detail-row">
          <span class="today-task-detail-label">S/N</span>
          <span class="today-task-detail-value">${esc(serialRange)}</span>
        </div>
        ${group.deadline ? `
        <div class="today-task-detail-row">
          <span class="today-task-detail-label">납기</span>
          <span class="today-task-detail-value">${fmt(group.deadline)} (${getDaysUntilDeadline(group.deadline)})</span>
        </div>
        ` : ''}
      </div>
    </div>
  `;

  return html;
}

/**
 * 카드 펼침/축소 이벤트 리스너
 */
function attachCardToggleListeners() {
  // 이미 window에 등록되어 있으므로 추가 작업 없음
}

/**
 * 카드 토글
 */
window.toggleTaskCard = function(cardId) {
  const card = document.getElementById(cardId);
  if (!card) return;

  const details = card.querySelector('.today-task-details');
  const arrow = card.querySelector('.today-card-arrow');
  
  if (!details || !arrow) return;

  if (details.style.display === 'none') {
    details.style.display = 'block';
    arrow.textContent = '▲';
  } else {
    details.style.display = 'none';
    arrow.textContent = '▼';
  }
};

/**
 * 날짜 이동
 */
window.prevDate = function() {
  currentDate.setDate(currentDate.getDate() - 1);
  renderTodayView();
};

window.nextDate = function() {
  currentDate.setDate(currentDate.getDate() + 1);
  renderTodayView();
};

/**
 * 빠른 시작 (일괄 적용)
 */
window.quickStartTask = async function(cardId, snList, procName) {
  if (!window.FB || !window.firebaseDb) {
    console.error('Firebase not initialized');
    return;
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const batch = window.FB.writeBatch(window.firebaseDb);

    snList.forEach(sn => {
      const ref = window.FB.doc(window.firebaseDb, 'production', sn);
      const updates = {};
      updates[`processes.${procName}.status`] = '진행';
      updates[`processes.${procName}.actualStart`] = today;
      updates['currentProcess'] = procName;
      batch.update(ref, updates);
    });

    await batch.commit();
    
    if (window.toast) {
      window.toast(`${snList.length}건 ${procName} 시작`, 'success');
    }

    // 카드 버튼 업데이트
    renderTodayView();
  } catch (error) {
    console.error('Quick start error:', error);
    if (window.toast) {
      window.toast('작업 시작 실패', 'error');
    }
  }
};

/**
 * 빠른 완료 (일괄 적용)
 */
window.quickCompleteTask = async function(cardId, snList, procName) {
  if (!window.FB || !window.firebaseDb) {
    console.error('Firebase not initialized');
    return;
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const batch = window.FB.writeBatch(window.firebaseDb);

    snList.forEach(sn => {
      const ref = window.FB.doc(window.firebaseDb, 'production', sn);
      const updates = {};
      updates[`processes.${procName}.status`] = '완료';
      updates[`processes.${procName}.actualEnd`] = today;
      batch.update(ref, updates);
    });

    await batch.commit();
    
    if (window.toast) {
      window.toast(`${snList.length}건 ${procName} 완료`, 'success');
    }

    // 카드 제거 또는 업데이트
    renderTodayView();
  } catch (error) {
    console.error('Quick complete error:', error);
    if (window.toast) {
      window.toast('작업 완료 처리 실패', 'error');
    }
  }
};
