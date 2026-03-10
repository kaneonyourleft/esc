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

/* ────────────────────────────────────────────
   상태
──────────────────────────────────────────── */
let currentDate = new Date();
currentDate.setHours(0, 0, 0, 0);

/* ────────────────────────────────────────────
   날짜 헬퍼
──────────────────────────────────────────── */
function dateToStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateHeader(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const dow = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  const todayStr = dateToStr(new Date());
  const isToday = dateToStr(date) === todayStr;
  return `${y}.${m}.${d}(${dow})${isToday ? ' 오늘' : ''}`;
}

/* ────────────────────────────────────────────
   메인 렌더링
──────────────────────────────────────────── */
export function renderTodayView() {
  const container = document.getElementById('widgetContainer');
  if (!container) return;

  // 날짜 바
  let html = `
    <div class="today-date-bar">
      <button class="btn-icon today-nav-btn" onclick="window.prevDate()" aria-label="이전 날짜">◀</button>
      <div class="today-date-text">${formatDateHeader(currentDate)}</div>
      <button class="btn-icon today-nav-btn" onclick="window.nextDate()" aria-label="다음 날짜">▶</button>
    </div>
  `;

  // 데이터
  const delayedTasks = getDelayedTasks(S.DATA, currentDate);
  const todayTasks   = getTodayTasks(S.DATA, currentDate);

  // 지연 섹션 (항상 상단 고정)
  if (delayedTasks.length > 0) {
    const groups = groupByBatch(delayedTasks);
    html += renderDelayedSection(groups);
  }

  // 오늘 작업 섹션
  const todayGroups = groupByBatch(todayTasks);
  html += renderTodaySection(todayGroups);

  container.innerHTML = html;
  attachSwipeSupport(container);
}

/* ────────────────────────────────────────────
   지연 섹션
──────────────────────────────────────────── */
function renderDelayedSection(groups) {
  let html = `
    <div class="today-section today-section-delayed">
      <div class="today-section-header">
        <span class="today-section-icon">⚠️</span>
        <span class="today-section-title" style="color:var(--err)">지연 작업</span>
        <span class="today-section-badge today-section-badge-danger">${groups.length}</span>
      </div>
      <div class="today-cards">
  `;
  groups.forEach((group, idx) => {
    html += renderTaskCard(group, `delayed-${idx}`, true);
  });
  html += `
      </div>
    </div>
  `;
  return html;
}

/* ────────────────────────────────────────────
   오늘 작업 섹션
──────────────────────────────────────────── */
function renderTodaySection(groups) {
  let html = `
    <div class="today-section">
      <div class="today-section-header">
        <span class="today-section-icon">📋</span>
        <span class="today-section-title">오늘 작업</span>
        <span class="today-section-badge">${groups.length}</span>
      </div>
      <div class="today-cards">
  `;
  if (groups.length === 0) {
    html += `
      <div class="card today-empty-state">
        <div class="today-empty-icon">✓</div>
        <div class="today-empty-msg">오늘 예정된 작업이 없습니다</div>
      </div>
    `;
  } else {
    groups.forEach((group, idx) => {
      html += renderTaskCard(group, `today-${idx}`, false);
    });
  }
  html += `
      </div>
    </div>
  `;
  return html;
}

/* ────────────────────────────────────────────
   작업 카드
──────────────────────────────────────────── */
function renderTaskCard(group, uid, isDelayed) {
  const quantity  = group.items.length;
  const serialRange = getSerialRange(group.items);
  const procColor = PROC_COLORS[group.process] || '#6366f1';
  const cardId    = `task-card-${uid}`;

  // 배치 내 대표 상태 (하나라도 진행이면 '진행')
  const procStatus = group.status || '대기';
  const snListJson = JSON.stringify(group.items.map(i => i.sn));
  const procEsc    = esc(group.process);

  let actionButton = '';
  if (procStatus === '대기') {
    actionButton = `<button class="btn btn-primary btn-sm"
      onclick="event.stopPropagation();window.quickStartTask('${cardId}',${snListJson},'${procEsc}')">▶ 시작</button>`;
  } else if (procStatus === '진행') {
    actionButton = `<button class="btn btn-success btn-sm"
      onclick="event.stopPropagation();window.quickCompleteTask('${cardId}',${snListJson},'${procEsc}')">✓ 완료</button>`;
  }

  // 공정 상태 도트 색상
  const statusDotColor = procStatus === '진행' ? 'var(--ac1)' : procStatus === '완료' ? 'var(--suc)' : '#64748b';

  return `
    <div class="card today-task-card ${isDelayed ? 'today-task-delayed' : ''}" id="${cardId}">
      <div class="today-task-main" onclick="window.toggleTaskCard('${cardId}')">
        <div class="today-task-info">
          <div class="today-task-proc-row">
            <span class="today-proc-dot" style="background:${procColor}"></span>
            <span class="today-task-process" style="color:${procColor}">${esc(group.process)}</span>
            ${isDelayed ? `<span class="badge badge-danger">+${group.delayDays}일 지연</span>` : ''}
            <span class="today-proc-status-dot" style="background:${statusDotColor}" title="${procStatus}"></span>
            <span class="today-proc-status-label">${procStatus}</span>
          </div>
          <div class="today-task-product">${esc(group.product)}</div>
          <div class="today-task-quantity">${quantity}매</div>
        </div>
        <div class="today-task-actions" onclick="event.stopPropagation()">
          ${actionButton}
          <span class="today-card-arrow" id="arrow-${cardId}">▼</span>
        </div>
      </div>

      <div class="today-task-details" id="details-${cardId}">
        <div class="today-task-detail-row">
          <span class="today-task-detail-label">배치</span>
          <span class="today-task-detail-value">${esc(group.batch)}</span>
        </div>
        ${group.equipment ? `
        <div class="today-task-detail-row">
          <span class="today-task-detail-label">장비</span>
          <span class="today-task-detail-value">${esc(group.equipment)}</span>
        </div>` : ''}
        <div class="today-task-detail-row">
          <span class="today-task-detail-label">S/N</span>
          <span class="today-task-detail-value today-sn-range">${esc(serialRange)}</span>
        </div>
        ${group.deadline ? `
        <div class="today-task-detail-row">
          <span class="today-task-detail-label">납기</span>
          <span class="today-task-detail-value">${fmt(group.deadline)}
            <span class="today-deadline-badge ${getDaysClass(group.deadline)}">${getDaysUntilDeadline(group.deadline)}</span>
          </span>
        </div>` : ''}
        <div class="today-task-detail-row">
          <span class="today-task-detail-label">수량</span>
          <span class="today-task-detail-value">${quantity}매 (S/N ${quantity}개)</span>
        </div>
      </div>
    </div>
  `;
}

/** D-n 배지 색상 클래스 */
function getDaysClass(deadline) {
  const d = getDaysUntilDeadline(deadline);
  if (!d) return '';
  if (d.startsWith('D+')) return 'deadline-overdue';
  if (d === 'D-Day') return 'deadline-today';
  const n = parseInt(d.replace('D-', ''), 10);
  if (n <= 3) return 'deadline-urgent';
  return 'deadline-normal';
}

/* ────────────────────────────────────────────
   카드 토글
──────────────────────────────────────────── */
window.toggleTaskCard = function(cardId) {
  const details = document.getElementById(`details-${cardId}`);
  const arrow   = document.getElementById(`arrow-${cardId}`);
  if (!details) return;

  const isOpen = details.classList.contains('open');
  details.classList.toggle('open', !isOpen);
  if (arrow) arrow.textContent = isOpen ? '▼' : '▲';
};

/* ────────────────────────────────────────────
   날짜 이동
──────────────────────────────────────────── */
window.prevDate = function() {
  currentDate = new Date(currentDate);
  currentDate.setDate(currentDate.getDate() - 1);
  renderTodayView();
};

window.nextDate = function() {
  currentDate = new Date(currentDate);
  currentDate.setDate(currentDate.getDate() + 1);
  renderTodayView();
};

/* ────────────────────────────────────────────
   스와이프 지원
──────────────────────────────────────────── */
function attachSwipeSupport(container) {
  let startX = 0;
  let startY = 0;

  container.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;

    // 수평 스와이프 우세, 50px 이상
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx > 0) window.prevDate();
      else        window.nextDate();
    }
  }, { passive: true });
}

/* ────────────────────────────────────────────
   빠른 시작 (배치 전체)
──────────────────────────────────────────── */
window.quickStartTask = async function(cardId, snList, procName) {
  if (!window.FB || !window.firebaseDb) {
    if (window.toast) window.toast('Firebase 초기화 중...', 'warn');
    return;
  }

  const btn = document.querySelector(`#${cardId} .btn-primary`);
  if (btn) { btn.disabled = true; btn.textContent = '처리중...'; }

  try {
    const today = new Date().toISOString().split('T')[0];
    const batch = window.FB.writeBatch(window.firebaseDb);

    snList.forEach(sn => {
      const ref = window.FB.doc(window.firebaseDb, 'production', sn);
      batch.update(ref, {
        [`processes.${procName}.status`]: '진행',
        [`processes.${procName}.actualStart`]: today,
        currentProcess: procName,
        status: '진행'
      });
    });

    await batch.commit();
    if (window.toast) window.toast(`${snList.length}건 [${procName}] 시작`, 'success');
    // Firestore onSnapshot이 자동 re-render 트리거함
  } catch (err) {
    console.error('quickStartTask error:', err);
    if (window.toast) window.toast('시작 처리 실패: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '▶ 시작'; }
  }
};

/* ────────────────────────────────────────────
   빠른 완료 (배치 전체)
──────────────────────────────────────────── */
window.quickCompleteTask = async function(cardId, snList, procName) {
  if (!window.FB || !window.firebaseDb) {
    if (window.toast) window.toast('Firebase 초기화 중...', 'warn');
    return;
  }

  const btn = document.querySelector(`#${cardId} .btn-success`);
  if (btn) { btn.disabled = true; btn.textContent = '처리중...'; }

  try {
    const today = new Date().toISOString().split('T')[0];
    const batch = window.FB.writeBatch(window.firebaseDb);

    snList.forEach(sn => {
      const ref = window.FB.doc(window.firebaseDb, 'production', sn);
      batch.update(ref, {
        [`processes.${procName}.status`]: '완료',
        [`processes.${procName}.actualEnd`]: today
      });
    });

    await batch.commit();
    if (window.toast) window.toast(`${snList.length}건 [${procName}] 완료`, 'success');
    // Firestore onSnapshot이 자동 re-render 트리거함
  } catch (err) {
    console.error('quickCompleteTask error:', err);
    if (window.toast) window.toast('완료 처리 실패: ' + err.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '✓ 완료'; }
  }
};
