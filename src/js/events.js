/* ============================================================
   events.js – 전역 이벤트 바인딩 + 라우팅
   ESC Manager v10 – Module Split
   ============================================================ */
import { S, setCurrentTab, setIsDark, setSidebarCollapsed } from './state.js';
import { renderHome }       from './home.js';
import { renderWorkspace }  from './workspace.js';
import { renderCalendar }   from './calendar.js';
import { renderGantt }      from './gantt.js';
import { renderAnalysis }   from './analysis.js';
import { renderSettings }   from './settings.js';
import { openProductModal, openSNModal, openDeadlineCalc, openIssueModal, openReportModal, openWidgetSettings } from './modals.js';
import { openSidePanel }  from './sidepanel.js';
import { askAI }    from './ai.js';
import { toast }            from './utils.js';

/* ── 탭 전환 ── */
export function switchTab(tab) {
  setCurrentTab(tab);
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  const pages = document.querySelectorAll('.page');
  pages.forEach(p => p.classList.add('hidden'));
  const target = document.getElementById('page-' + tab);
  if (target) target.classList.remove('hidden');

  switch (tab) {
    case 'home':      renderHome();      break;
    case 'workspace': renderWorkspace(); break;
    case 'calendar':  renderCalendar();  break;
    case 'gantt':     renderGantt();     break;
    case 'analysis':  renderAnalysis();  break;
    case 'settings':  renderSettings();  break;
  }
}

/* ── 사이드바 토글 ── */
export function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const collapsed = !S.sidebarCollapsed;
  setSidebarCollapsed(collapsed);
  sb.classList.toggle('collapsed', collapsed);
  localStorage.setItem('esc_sidebar', collapsed ? '1' : '0');
}

/* ── 다크모드 ── */
export function toggleDark() {
  const dark = !S.isDark;
  setIsDark(dark);
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem('esc_dark', dark ? '1' : '0');
  const icon = document.getElementById('darkIcon');
  if (icon) icon.textContent = dark ? '☀️' : '🌙';
}

/* ── 글로벌 키보드 ── */
function onKeyDown(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal.active, .modal.show')
      .forEach(m => m.classList.remove('active', 'show'));
  }
}

/* ── 온/오프라인 배너 ── */
function onOnline()  { document.getElementById('offlineBanner')?.classList.add('hidden');  toast('온라인 복귀'); }
function onOffline() { document.getElementById('offlineBanner')?.classList.remove('hidden'); }

/* ── 전역 클릭 위임 ── */
function onGlobalClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  switch (action) {
    case 'toggle-sidebar':   toggleSidebar();   break;
    case 'toggle-dark':      toggleDark();       break;
    case 'open-product':     openProductModal(); break;
    case 'open-sn':          openSNModal();      break;
    case 'open-deadline':    openDeadlineCalc();break;
    case 'open-issue':       openIssueModal();   break;
    case 'open-report':      openReportModal();  break;
    case 'open-widget':      openWidgetSettings();  break;
    case 'toggle-side':      openSidePanel();  break;
    case 'send-ai':          askAI();    break;
    default: break;
  }
}

/* ── 탭 버튼 클릭 ── */
function onTabClick(e) {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  const tab = btn.dataset.tab;
  if (tab) switchTab(tab);
}

/* ── 바인딩 ── */
export function bindEvents() {
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('online',  onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('click', onGlobalClick);

  const nav = document.getElementById('tabNav') || document.getElementById('sidebar');
  if (nav) nav.addEventListener('click', onTabClick);

  // AI 입력 엔터키
  const aiInput = document.getElementById('aiInput');
  if (aiInput) {
    aiInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askAI(); }
    });
  }

  // 사이드바 상태 복원
  if (localStorage.getItem('esc_sidebar') === '1') {
    setSidebarCollapsed(true);
    document.getElementById('sidebar')?.classList.add('collapsed');
  }

  // 다크모드 상태 복원
  if (localStorage.getItem('esc_dark') === '1') {
    setIsDark(true);
    document.documentElement.classList.add('dark');
    const icon = document.getElementById('darkIcon');
    if (icon) icon.textContent = '☀️';
  }
}






