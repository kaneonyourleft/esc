/* ============================================================
   today-view.js – 오늘 할 일 렌더링 (Phase 4 - Execution First)
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
import { startProcess, completeProcess } from './transition.js';

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
  const isToday = dateToStr(date) === dateToStr(new Date());
  return `${y}.${m}.${d}(${dow})${isToday ? ' 오늘' : ''}`;
}

/* ────────────────────────────────────────────
   메인 렌더링
──────────────────────────────────────────── */
export function renderTodayView() {
  const container = document.getElementById('widgetContainer');
  if (!container) return;

  // 날짜 네비게이션 바
  const isToday = dateToStr(currentDate) === dateToStr(new Date());
  let html = `
    <div class="exec-date-bar">
      <button class="exec-nav-btn" onclick="window.prevDate()" aria-label="이전 날짜">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <div class="exec-date-text${isToday ? ' exec-date-today' : ''}" onclick="window.goToday()" style="cursor:pointer" title="오늘로 이동">${formatDateHeader(currentDate)}</div>
      <button class="exec-nav-btn" onclick="window.nextDate()" aria-label="다음 날짜">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      ${!isToday ? `<button class="exec-today-btn" onclick="window.goToday()">오늘</button>` : ''}
    </div>
  `;

  // 데이터 가져오기
  const delayedTasks = getDelayedTasks(S.DATA, currentDate);
  const todayTasks   = getTodayTasks(S.DATA, currentDate);

  // 진행 중 섹션 (오늘 작업 중 status=진행)
  const inProgressTasks = todayTasks.filter(t => t.status === '진행');
  const waitingTasks    = todayTasks.filter(t => t.status !== '진행');

  // 섹션 순서: 진행 중 → 지연 → 대기
  if (inProgressTasks.length > 0) {
    html += renderSection('진행중', '🔵', inProgressTasks, false, 'exec-section-prog');
  }
  if (delayedTasks.length > 0) {
    html += renderSection('지연', '🔴', delayedTasks, true, 'exec-section-delayed');
  }
  html += renderSection('오늘 예정', '📋', waitingTasks, false, 'exec-section-today');

  container.innerHTML = html;
  attachSwipeSupport(container);
}

/* ────────────────────────────────────────────
   섹션 렌더링
──────────────────────────────────────────── */
function renderSection(title, icon, tasks, isDelayed, sectionClass) {
  const groups = groupByBatch(tasks);
  let html = `
    <div class="exec-section ${sectionClass}">
      <div class="exec-section-hdr">
        <span class="exec-section-icon">${icon}</span>
        <span class="exec-section-title">${title}</span>
        <span class="exec-section-count">${groups.length}</span>
      </div>
      <div class="exec-cards">
  `;
  if (groups.length === 0) {
    html += `
      <div class="exec-empty">
        <span class="exec-empty-icon">✓</span>
        <span class="exec-empty-msg">예정된 작업이 없습니다</span>
      </div>
    `;
  } else {
    groups.forEach((group, idx) => {
      html += renderTaskCard(group, `${sectionClass}-${idx}`, isDelayed);
    });
  }
  html += `</div></div>`;
  return html;
}

/* ────────────────────────────────────────────
   작업 카드 (Phase 4 – 실행 우선)
──────────────────────────────────────────── */
function renderTaskCard(group, uid, isDelayed) {
  const quantity   = group.items.length;
  const serialRange = getSerialRange(group.items);
  const procColor  = PROC_COLORS[group.process] || '#6366f1';
  const cardId     = `task-card-${uid}`;

  const procStatus = group.status || '대기';
  const snListJson = JSON.stringify(group.items.map(i => i.sn));
  const procEsc    = esc(group.process);

  // 큰 액션 버튼
  let actionBtn = '';
  if (procStatus === '대기') {
    actionBtn = `
      <button class="exec-action-btn exec-action-start"
        onclick="event.stopPropagation();window.quickStartTask('${cardId}',${snListJson.replace(/"/g, '&quot;')},'${procEsc}')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        시작
      </button>`;
  } else if (procStatus === '진행') {
    actionBtn = `
      <button class="exec-action-btn exec-action-complete"
        onclick="event.stopPropagation();window.quickCompleteTask('${cardId}',${snListJson.replace(/"/g, '&quot;')},'${procEsc}')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        완료
      </button>`;
  } else {
    actionBtn = `<div class="exec-action-done">완료됨</div>`;
  }

  const procBar = S.PROC_ORDER.map(p => {
    const active = p === group.process;
    const clr = PROC_COLORS[p] || '#888';
    return `<span class="exec-proc-pip${active ? ' exec-proc-pip-active' : ''}"
      style="${active ? `background:${clr};box-shadow:0 0 0 2px ${clr}40` : ''}"
      title="${p}"></span>`;
  }).join('');

  // 지연 배지
  const delayBadge = isDelayed && group.delayDays
    ? `<span class="exec-badge exec-badge-delay">+${group.delayDays}일 지연</span>`
    : '';

  // 납기 배지
  let deadlineBadge = '';
  if (group.deadline) {
    const dStr = getDaysUntilDeadline(group.deadline);
    const dcls = getDaysClass(group.deadline);
    deadlineBadge = `<span class="exec-badge ${dcls}">${dStr}</span>`;
  }

  // S/N 목록 (접혔다 펼침)
  const snListHtml = group.items.map(it =>
    `<span class="exec-sn-item" onclick="event.stopPropagation();if(window.openSidePanel)window.openSidePanel('${esc(it.sn)}')">${esc(it.sn)}</span>`
  ).join('');

  return `
    <div class="exec-card${isDelayed ? ' exec-card-delayed' : ''}" id="${cardId}">
      <!-- 헤더 행: 공정 + 배지 + 액션 버튼 -->
      <div class="exec-card-top" onclick="window.toggleTaskCard('${cardId}')">
        <div class="exec-card-proc-wrap">
          <span class="exec-card-proc-dot" style="background:${procColor}"></span>
          <span class="exec-card-proc-name" style="color:${procColor}">${esc(group.process)}</span>
          ${delayBadge}
          ${deadlineBadge}
        </div>
        <div class="exec-card-action" onclick="event.stopPropagation()">
          ${actionBtn}
        </div>
      </div>

      <!-- 공정 파이프라인 바 -->
      <div class="exec-proc-bar">${procBar}</div>

      <!-- 제품명 + 수량/배치/S/N 범위 -->
      <div class="exec-card-body" onclick="window.toggleTaskCard('${cardId}')">
        <div class="exec-card-product">${esc(group.product)}</div>
        <div class="exec-card-meta">
          <span class="exec-meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-4 0v2"/></svg>
            ${quantity}매
          </span>
          <span class="exec-meta-sep">·</span>
          <span class="exec-meta-item">${esc(group.batch)}</span>
          ${group.equipment ? `<span class="exec-meta-sep">·</span><span class="exec-meta-item">${esc(group.equipment)}</span>` : ''}
          <span class="exec-meta-sep">·</span>
          <span class="exec-meta-item exec-sn-range">${esc(serialRange)}</span>
        </div>
      </div>

      <!-- 펼쳐지는 S/N 목록 -->
      <div class="exec-sn-list" id="details-${cardId}">
        <div class="exec-sn-grid">
          ${snListHtml}
        </div>
      </div>
    </div>
  `;
}

/** D-n 배지 색상 클래스 */
function getDaysClass(deadline) {
  const d = getDaysUntilDeadline(deadline);
  if (!d) return '';
  if (d.startsWith('D+')) return 'exec-badge-overdue';
  if (d === 'D-Day') return 'exec-badge-today';
  const n = parseInt(d.replace('D-', ''), 10);
  if (n <= 3) return 'exec-badge-urgent';
  return 'exec-badge-normal';
}

/* ────────────────────────────────────────────
   카드 토글 (S/N 목록 펼치기/접기)
──────────────────────────────────────────── */
window.toggleTaskCard = function(cardId) {
  const details = document.getElementById(`details-${cardId}`);
  if (!details) return;
  const isOpen = details.classList.contains('open');
  details.classList.toggle('open', !isOpen);
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

window.goToday = function() {
  currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
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
  const btn = document.querySelector(`#${cardId} .exec-action-start`);
  if (btn) { btn.disabled = true; btn.textContent = '처리중...'; }

  try {
    const result = await startProcess(snList, procName, { source: 'home', user: window.currentUserEmail || 'unknown' });
    if (window.toast) window.toast(`${result.success}건 [${procName}] 시작`, 'success');
  } catch (err) {
    console.error('quickStartTask error:', err);
    if (window.toast) window.toast('시작 처리 실패: ' + err.message, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> 시작';
    }
  }
};

/* ────────────────────────────────────────────
   빠른 완료 (배치 전체)
──────────────────────────────────────────── */
window.quickCompleteTask = async function(cardId, snList, procName) {
  const btn = document.querySelector(`#${cardId} .exec-action-complete`);
  if (btn) { btn.disabled = true; btn.textContent = '처리중...'; }

  try {
    const result = await completeProcess(snList, procName, { source: 'home', user: window.currentUserEmail || 'unknown' });
    if (window.toast) window.toast(`${result.success}건 [${procName}] 완료`, 'success');
  } catch (err) {
    console.error('quickCompleteTask error:', err);
    if (window.toast) window.toast('완료 처리 실패: ' + err.message, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> 완료';
    }
  }
};
