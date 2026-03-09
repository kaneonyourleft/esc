import { DATA, PROC_ORDER, PROC_COLORS } from './main.js';
import { fD, fmt, todayStr } from './date-utils.js';
import { getProc, getRoute, extractCategory, esc, toast } from './main.js';

let calDate = new Date();
let calViewMode = 'month';

export function renderCalendar() {
  const container = document.getElementById('calContent');
  if (!container) return;
  
  const titleEl = document.getElementById('calTitle');
  if (titleEl) titleEl.textContent = `${calDate.getFullYear()}년 ${calDate.getMonth() + 1}월`;

  if (calViewMode === 'issues') { renderIssueBoard(container); return; }
  if (calViewMode === 'week') { renderWeekView(container); return; }

  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const today = todayStr();

  let events = {};
  const addEvent = (date, ev) => {
    if (!date) return;
    if (!events[date]) events[date] = [];
    events[date].push(ev);
  };

  Object.entries(DATA).forEach(([sn, d]) => {
    const route = getRoute(sn, d);
    const prodName = d.productName || extractCategory(sn) || '기타';
    route.forEach(proc => {
      const p = getProc(d, proc);
      const eq = p.equip || '';
      const ps = fD(p.planStart || p.actualStart);
      const pe = fD(p.planEnd || p.actualEnd);
      const ae = fD(p.actualEnd);
      if (ps) addEvent(ps, { sn, proc, type: '시작', status: p.status || '대기', equip: eq, productName: prodName });
      if (pe) addEvent(pe, { sn, proc, type: '예정종료', status: p.status || '대기', equip: eq, productName: prodName });
      if (ae && ae !== pe) addEvent(ae, { sn, proc, type: '완료', status: '완료', equip: eq, productName: prodName });
    });
    const ed = fD(d.endDate);
    if (ed) addEvent(ed, { sn, proc: '납기', type: '마감', status: d.status || '대기', equip: '', productName: d.productName || '기타' });
  });

  let html = `<div class="cal-grid">`;
  ['일', '월', '화', '수', '목', '금', '토'].forEach(d => {
    html += `<div class="cal-dow">${d}</div>`;
  });

  for (let i = 0; i < startDow; i++) html += '<div class="cal-cell cal-empty"></div>';

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = dateStr === today;
    const dayEvents = events[dateStr] || [];
    
    html += `<div class="cal-cell ${isToday ? 'cal-today' : ''}" data-date="${dateStr}" onclick="window.openCalDayModal('${dateStr}')">
      <div class="cal-day-num">${day}</div>
      <div class="cal-events">`;
      
    dayEvents.slice(0, 4).forEach(ev => {
      const color = ev.proc === '납기' ? 'var(--err)' : (PROC_COLORS[ev.proc] || 'var(--ac2)');
      html += `<div class="cal-ev-dot" style="background:${color}" title="${ev.sn} ${ev.proc}"></div>`;
    });
    if (dayEvents.length > 4) html += `<div style="font-size:9px">+${dayEvents.length-4}</div>`;
    
    html += `</div></div>`;
  }
  html += '</div>';

  container.innerHTML = html;
}

export function calNext() {
  calDate.setMonth(calDate.getMonth() + 1);
  renderCalendar();
}

export function calPrev() {
  calDate.setMonth(calDate.getMonth() - 1);
  renderCalendar();
}

export function calToday() {
  calDate = new Date();
  renderCalendar();
}

export function setCalView(mode, btn) {
  calViewMode = mode;
  document.querySelectorAll('#calendarTab .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderCalendar();
}

function renderIssueBoard(container) {
  container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--t2)">이슈 보드 준비 중...</div>';
}

function renderWeekView(container) {
  container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--t2)">주간 뷰 준비 중...</div>';
}
