/* ============================================================
   main.js – 앱 진입점 (Entry Point)
   ESC Manager v10 – Module Split
   ============================================================ */
import { S } from './state.js';
import { auth, onAuthStateChanged, doLogin, doLogout, loadData } from './firebase.js';
import { bindEvents, switchTab } from './events.js';
import { toast } from './utils.js';
import { setCurrentUser } from './state.js';

/* ── PWA: 서비스워커 등록 ── */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(err => {
    console.warn('SW 등록 실패:', err);
  });
}

/* ── PWA: 동적 manifest ── */
(function setupManifest() {
  const m = {
    name: 'ESC Manager',
    short_name: 'ESC',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f172a',
    theme_color: '#3b82f6',
    icons: [{
      src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="20" fill="%233b82f6"/><text x="50" y="68" font-size="48" fill="white" text-anchor="middle" font-weight="bold">ESC</text></svg>',
      sizes: '192x192', type: 'image/svg+xml'
    }]
  };
  const blob = new Blob([JSON.stringify(m)], { type: 'application/json' });
  const link = document.createElement('link');
  link.rel = 'manifest';
  link.href = URL.createObjectURL(blob);
  document.head.appendChild(link);
})();

/* ── 앱 초기화 ── */
function initApp() {
  // 로그인 버튼
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) loginBtn.addEventListener('click', () => doLogin());

  // 로그아웃 버튼
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => doLogout());

  // 인증 상태 감시
  onAuthStateChanged(auth, async (user) => {
    const loginScreen = document.getElementById('loginScreen');
    const appMain = document.getElementById('main') || document.getElementById('appMain');

    if (user) {
      setCurrentUser(user);
      if (loginScreen) loginScreen.classList.add('hidden');
      if (appMain) appMain.classList.remove('hidden');

      await loadData(() => {
        switchTab(S.currentTab || 'home');
      });
      bindEvents();
      switchTab('home');
      toast(`${user.displayName || user.email}님 환영합니다`);
    } else {
      setCurrentUser(null);
      if (loginScreen) loginScreen.classList.remove('hidden');
      if (appMain) appMain.classList.add('hidden');
    }
  });
}

/* ── DOM Ready ── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
