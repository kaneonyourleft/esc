import * as S from './state.js';
import { PROC_ORDER, PROC_COLORS, EQ_MAP, DEFAULT_WIDGETS } from './constants.js';
import { handleFirestoreError, toast, openModal, closeModal, statusBadge, esc } from './app-utils.js';
import { fD, fmt, getProc, addBD, diffBD, getDefaultDays, buildRoute, getRoute, getEquipList, calcProgress, extractCategory, extractBatchFromSN, positionDropdown, handleEmptyChart, mdToHtml } from './utils.js';
import { renderTodayView } from './today-view.js';
import { renderSettings as _renderSettings } from './settings.js';
import { renderAnalysis as _renderAnalysis, drawDonutChart as _drawDonutChart } from './analysis.js';

// ===================================================
// ESC Manager v10.0 - main.js
// ===================================================

// === PWA 설정 ===
const PWA_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#6366f1"/><text x="256" y="340" text-anchor="middle" font-family="Arial Black" font-size="220" fill="white" font-weight="900">ESC</text></svg>';
const iconBlob = new Blob([PWA_ICON_SVG], { type: 'image/svg+xml' });
const iconURL = URL.createObjectURL(iconBlob);

const manifestJSON = JSON.stringify({
  name: 'ESC Manager',
  short_name: 'ESC',
  start_url: '/',
  display: 'standalone',
  background_color: '#0a0f1e',
  theme_color: '#6366f1',
  icons: [{ src: iconURL, sizes: '512x512', type: 'image/svg+xml' }]
});

const manifestLink = document.createElement('link');
manifestLink.rel = 'manifest';
manifestLink.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(manifestJSON);
document.head.appendChild(manifestLink);

// === 서비스 워커 ===
const SW_CODE = "const CACHE='esc-v10';self.addEventListener('install',e=>{self.skipWaiting()});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))))});self.addEventListener('fetch',e=>{e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))});";
if ('serviceWorker' in navigator) {
  const swBlob = new Blob([SW_CODE], { type: 'application/javascript' });
  navigator.serviceWorker.register(URL.createObjectURL(swBlob)).catch(() => {});
}

// === CDN 라이브러리 로드 ===
function loadScript(url) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

Promise.all([
  loadScript('https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js'),
  loadScript('https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js')
]).then(() => console.log('📦 CDN loaded')).catch(e => console.warn('CDN load warning:', e));

// === Firebase 설정 ===
const FB_CDN = 'https://www.gstatic.com/firebasejs/10.14.1/';
const firebaseConfig = {
  apiKey: 'AIzaSyAwDS2PigihTH6RKMxzrH-utlaKJbtHBTY',
  authDomain: 'esc-production-management.firebaseapp.com',
  projectId: 'esc-production-management',
  storageBucket: 'esc-production-management.firebasestorage.app',
  messagingSenderId: '744508930498',
  appId: '1:744508930498:web:0cd274d3e8ad498fe498ef'
};

let firebaseApp, firebaseAuth, firebaseDb, FB = {};

async function initFirebase() {
  /* eslint-disable */
  const { initializeApp } = await import(/* @vite-ignore */ FB_CDN + 'firebase-app.js');
  const { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } = await import(/* @vite-ignore */ FB_CDN + 'firebase-auth.js');
  const { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, where, writeBatch, Timestamp, serverTimestamp } = await import(/* @vite-ignore */ FB_CDN + 'firebase-firestore.js');
  /* eslint-enable */

  firebaseApp = initializeApp(firebaseConfig);
  firebaseAuth = getAuth(firebaseApp);
  firebaseDb = getFirestore(firebaseApp);

  FB = {
    collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
    onSnapshot, query, orderBy, where, writeBatch, Timestamp, serverTimestamp,
    GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
  };

  // Export to window for today-view.js
  window.FB = FB;
  window.firebaseDb = firebaseDb;

  setupAuth();
}

initFirebase().catch(e => console.error('Firebase init error:', e));

function scheduleRender() {
    if (S.scheduleRenderRAF) return;
    S.set('scheduleRenderRAF', requestAnimationFrame(() => {
        S.set('scheduleRenderRAF', null);
        renderWorkspace();
    }));
}

function refreshSidePanel() {
  if (!S.selectedSN) return;
  if (!S.DATA[S.selectedSN]) { closeSidePanel(); return; }
  const panel = document.getElementById('sidePanel');
  if (panel && panel.classList.contains('open')) openSidePanel(S.selectedSN);
}

function onDataChanged() {
  switch (S.currentTab) {
    case 'home': renderHome(); break;
    case 'workspace': scheduleRender(); break;
    case 'calendar': renderCalendar(); break;
    case 'gantt': renderGantt(); break;
    case 'analysis': renderAnalysis(); break;
    case 'settings': renderSettings(); break;
  }
  refreshSidePanel();
}

// === 위젯 설정 ===
function getWidgets() {
  if (S.widgetCache) return S.widgetCache;
  try {
    const saved = localStorage.getItem('esc_widgets');
    if (saved) {
        S.set('widgetCache', JSON.parse(saved));
        return S.widgetCache;
    }
  } catch {}
    S.set('widgetCache', JSON.parse(JSON.stringify(DEFAULT_WIDGETS)));
  return S.widgetCache;
}

function saveWidgets(list) {
  S.set('widgetCache', list);
  localStorage.setItem('esc_widgets', JSON.stringify(list));
}
// ===================================================
// 파트 2: 인증, 데이터 로드, 홈, 워크스페이스
// ===================================================

// === 인증 ===
window.doLogin = async function() {
  if (!firebaseAuth || !FB.GoogleAuthProvider) return toast('Firebase 초기화 중...', 'warn');
  document.getElementById('loginSpinner').style.display = 'block';
  document.getElementById('loginError').style.display = 'none';
  try {
    await FB.signInWithPopup(firebaseAuth, new FB.GoogleAuthProvider());
  } catch (e) {
    document.getElementById('loginError').textContent = e.message;
    document.getElementById('loginError').style.display = 'block';
    document.getElementById('loginSpinner').style.display = 'none';
  }
};

window.doLogout = async function() {
  if (firebaseAuth) await FB.signOut(firebaseAuth);
  location.reload();
};

function setupAuth() {
  FB.onAuthStateChanged(firebaseAuth, (user) => {
    S.set('currentUser', user);
    if (user) {
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      const avatar = user.photoURL
        ? `<img src="${user.photoURL}" style="width:100%;height:100%;border-radius:50%">`
        : (user.displayName || 'U')[0];
      ['sbAvatar', 'tbAvatar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = (typeof avatar === 'string' && avatar.startsWith('<')) ? avatar : `<span>${avatar}</span>`;
      });
      document.getElementById('sbName').textContent = user.displayName || '사용자';
      document.getElementById('sbEmail').textContent = user.email || '';
      document.getElementById('settingName').textContent = user.displayName || '사용자';
      document.getElementById('settingEmail').textContent = user.email || '';
      applyTheme();
      subscribeData();
    } else {
      document.getElementById('loginScreen').style.display = 'flex';
      document.getElementById('app').style.display = 'none';
      document.getElementById('loginSpinner').style.display = 'none';
    }
  });
}

// === 데이터 구독 ===
function subscribeData() {
  if (S.unsubProduction) S.unsubProduction();
  if (S.unsubIssues) S.unsubIssues();

  const prodCol = FB.collection(firebaseDb, 'production');
  S.set('unsubProduction', FB.onSnapshot(prodCol, (snap) => {
    const newData = {};
    snap.forEach(d => { newData[d.id] = d.data(); });
    S.set('DATA', newData);
    console.log(`📋 production: ${Object.keys(S.DATA).length} records`);
    populateGanttProdFilter();
    onDataChanged();
    updateDataStats();
  }, (err) => { handleFirestoreError(err, '데이터 로드'); }));

  const prodMaster = FB.collection(firebaseDb, 'products');
  FB.getDocs(prodMaster).then(snap => {
    const newProducts = {};
    snap.forEach(d => { newProducts[d.id] = d.data(); });
    S.set('PRODUCTS', newProducts);
    console.log(`📦 products: ${Object.keys(S.PRODUCTS).length} items`);
    populateProductSelects();
  }).catch(e => handleFirestoreError(e, '제품 로드'));

  const issueCol = FB.collection(firebaseDb, 'issues');
  S.set('unsubIssues', FB.onSnapshot(FB.query(issueCol, FB.orderBy('date', 'desc')), (snap) => {
    const newIssues = [];
    snap.forEach(d => { newIssues.push({ id: d.id, ...d.data() }); });
    S.set('ISSUES', newIssues);
    console.log(`🚨 issues: ${S.ISSUES.length} items`);
    if (S.currentTab === 'calendar') renderCalendar();
  }, (err) => { handleFirestoreError(err, '이슈 로드'); }));
}

window.refreshData = function() {
  subscribeData();
  toast('데이터 새로고침', 'success');
};

function populateProductSelects() {
  ['sn_prod', 'dl_prod', 'is_prod', 'pm_edit_prod'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const prev = sel.value;
    const opts = '<option value="">선택...</option>' +
      Object.entries(S.PRODUCTS).map(([k, v]) =>
        `<option value="${esc(k)}">${esc(v.name || k)} (${esc(v.category || '')})</option>`
      ).join('');
    sel.innerHTML = opts;
    if (prev) sel.value = prev;
  });
}

function updateDataStats() {
  const total = Object.keys(S.DATA).length;
  const counts = { '대기': 0, '진행': 0, '완료': 0, '지연': 0, '폐기': 0 };
  Object.values(S.DATA).forEach(d => {
    const s = d.status || '대기';
    if (counts[s] !== undefined) counts[s]++;
  });
  const html = `
    <div class="stat-item"><div class="stat-val">${total}</div><div class="stat-lbl">전체 LOT</div></div>
    <div class="stat-item"><div class="stat-val">${counts['진행']}</div><div class="stat-lbl">진행중</div></div>
    <div class="stat-item"><div class="stat-val">${counts['완료']}</div><div class="stat-lbl">완료</div></div>
    <div class="stat-item"><div class="stat-val">${counts['지연']}</div><div class="stat-lbl">지연</div></div>
  `;
  // Update all dataStats containers (home tab + settings tab)
  document.querySelectorAll('#dataStats').forEach(el => { el.innerHTML = html; });
}

function populateGanttProdFilter() {
  const sel = document.getElementById('ganttProdFilter');
  if (!sel) return;
  const prev = sel.value;
  const prods = new Set();
  Object.values(S.DATA).forEach(d => { if (d.productName) prods.add(d.productName); });
  const opts = '<option value="">전체 제품</option>' +
    [...prods].sort().map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  sel.innerHTML = opts;
  if (prev && prods.has(prev)) sel.value = prev;
}

// === 탭 전환 ===
const TAB_MAP = {
  home: 'homeTab', workspace: 'workspaceTab', calendar: 'calendarTab',
  gantt: 'ganttTab', analysis: 'analysisTab', ai: 'aiTab', settings: 'settingsTab'
};
const TAB_TITLES = {
  home: '홈', workspace: '워크스페이스', calendar: '캘린더',
  gantt: '간트차트', analysis: '분석', ai: 'AI 어시스턴트', settings: '설정'
};

window.switchTab = function(tab) {
  S.set('currentTab', tab);
  Object.values(TAB_MAP).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById(TAB_MAP[tab]);
  if (target) target.style.display = (tab === 'workspace' || tab === 'gantt') ? 'flex' : 'block';
  document.getElementById('content').style.overflow = (tab === 'gantt') ? 'hidden' : '';
  document.querySelectorAll('.sb-item').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
  document.querySelectorAll('.bb-item').forEach(el => el.classList.toggle('active', el.dataset.tab === tab));
  document.getElementById('tbTitle').textContent = TAB_TITLES[tab] || tab;
  renderCurrentTab();
  if (window.innerWidth < 768) {
    S.set('sidebarCollapsed', true);
    document.getElementById('sidebar').classList.add('collapsed');
  }
};

function renderCurrentTab() {
  switch (S.currentTab) {
    case 'home': renderHome(); break;
    case 'workspace': renderWorkspace(); break;
    case 'calendar': renderCalendar(); break;
    case 'gantt': renderGantt(); break;
    case 'analysis': renderAnalysis(); break;
    case 'settings': renderSettings(); break;
  }
}

// === 사이드바, 테마 ===
window.toggleSidebar = function() {
  S.set('sidebarCollapsed', !S.sidebarCollapsed);
  document.getElementById('sidebar').classList.toggle('collapsed', S.sidebarCollapsed);
};

function applyTheme() {
  document.body.classList.toggle('light-mode', !S.isDarkMode);
  const toggle = document.getElementById('themeToggle');
  if (toggle) toggle.classList.toggle('active', !S.isDarkMode);
}

window.toggleTheme = function() {
  S.set('isDarkMode', !S.isDarkMode);
  localStorage.setItem('esc_theme', S.isDarkMode ? 'dark' : 'light');
  applyTheme();
};

(function() {
  if (localStorage.getItem('esc_theme') === 'light') S.set('isDarkMode', false);
})();

// === 홈 탭 ===
function renderHome() {
  const now = new Date();
  const hour = now.getHours();
  const greet = hour < 12 ? '좋은 아침입니다' : hour < 18 ? '좋은 오후입니다' : '좋은 저녁입니다';
  const name = S.currentUser?.displayName || '사용자';
  document.getElementById('greetMsg').textContent = `${greet}, ${name}님!`;
  document.getElementById('greetSub').textContent = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 — 현장 실행 중심 작업 현황`;

  const delayed = Object.entries(S.DATA).filter(([, d]) => (d.status || '대기') === '지연');
  const alertCard = document.getElementById('delayAlertCard');
  if (delayed.length > 0) {
    alertCard.style.display = 'block';
    document.getElementById('delayAlertMsg').textContent = `현재 ${delayed.length}건의 지연 LOT이 있습니다. 즉시 확인이 필요합니다.`;
  } else {
    alertCard.style.display = 'none';
  }

  // 모닝 브리핑 카드 삽입
  renderBriefingCard();
  
  // 기존 위젯 대신 오늘 할 일 뷰 렌더링
  renderTodayView();
}

function renderBriefingCard() {
  const container = document.getElementById('briefingContainer');
  if (!container) return;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // 어제 완료
  let yesterdayDone = 0;
  Object.values(S.DATA).forEach(d => {
    getRoute('', d).forEach(proc => {
      const p = getProc(d, proc);
      if (fD(p.actualEnd) === yesterday) yesterdayDone++;
    });
  });

  // 오늘 예정
  let todayPlanned = 0;
  Object.entries(S.DATA).forEach(([sn, d]) => {
    getRoute(sn, d).forEach(proc => {
      const p = getProc(d, proc);
      if (fD(p.planStart) === today || fD(p.actualStart) === today) todayPlanned++;
    });
  });

  // 지연 수
  const delayCount = Object.values(S.DATA).filter(d => (d.status || '대기') === '지연').length;

  // 가장 바쁜 설비
  const equipCount = {};
  Object.entries(S.DATA).forEach(([sn, d]) => {
    if (d.status !== '진행') return;
    const proc = d.currentProcess;
    if (!proc) return;
    const eq = getProc(d, proc).equip;
    if (eq) equipCount[eq] = (equipCount[eq] || 0) + 1;
  });
  const busiestEquip = Object.entries(equipCount).sort((a, b) => b[1] - a[1])[0];

  container.innerHTML = `
    <div class="briefing-card">
      <div class="briefing-icon">🌅</div>
      <div class="briefing-content">
        <div class="briefing-title">모닝 브리핑</div>
        <div class="briefing-stats">
          <span class="briefing-stat">어제 <strong>${yesterdayDone}건</strong> 완료</span>
          <span class="briefing-stat">오늘 <strong>${todayPlanned}건</strong> 예정</span>
          ${delayCount > 0 ? `<span class="briefing-stat" style="color:var(--err)">지연 <strong>${delayCount}건</strong> 주의</span>` : '<span class="briefing-stat" style="color:var(--suc)">지연 <strong>없음</strong> ✓</span>'}
          ${busiestEquip ? `<span class="briefing-stat">가장 바쁜 설비: <strong>${busiestEquip[0]}(${busiestEquip[1]}건)</strong></span>` : ''}
        </div>
      </div>
    </div>
  `;
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
  if (document.getElementById('homeDonut')) {
    const hCounts = { 대기: 0, 진행: 0, 완료: 0, 지연: 0, 폐기: 0 };
    Object.values(S.DATA).forEach(d => { const s = d.status || '대기'; if (hCounts[s] !== undefined) hCounts[s]++; });
    _drawDonutChart('homeDonut', hCounts);
  }
  if (document.getElementById('homeWeekly')) drawWeeklyChart('homeWeekly');
}

function renderKpiWidget() {
  const total = Object.keys(S.DATA).length;
  let prog = 0, done = 0, delay = 0;
  Object.values(S.DATA).forEach(d => {
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
  Object.entries(S.DATA).forEach(([sn, d]) => {
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
  const today = new Date().toISOString().split('T')[0];
  let items = [];
  Object.entries(S.DATA).forEach(([sn, d]) => {
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
    const today = new Date().toISOString().split('T')[0];
  const delayed = Object.entries(S.DATA).filter(([, d]) => (d.status || '대기') === '지연');
  const upcoming = Object.entries(S.DATA).filter(([, d]) => {
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
  const sorted = Object.entries(S.DATA).sort((a, b) => {
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
  S.set('wsViewMode', mode);
  document.querySelectorAll('#workspaceTab .tab-btn').forEach(el => el.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderWorkspace();
};

window.toggleFilter = function(f) { renderWorkspace(); };

window.toggleAllGroups = function() {
  S.set('wsAllExpanded', !S.wsAllExpanded);
  Object.keys(S.wsGroupState).forEach(k => S.wsGroupState[k] = !S.wsAllExpanded);
  const btn = document.getElementById('expandAllBtn');
  if (btn) btn.textContent = S.wsAllExpanded ? '모두 접기' : '모두 펼치기';
  renderWorkspace();
};

window.toggleGroup = function(key) {
  S.wsGroupState[key] = !S.wsGroupState[key];
  renderWorkspace();
};

function updateFilterOptions() {
  const prodSet = new Set(), batchSet = new Set(), equipSet = new Set(), procSet = new Set();
  Object.entries(S.DATA).forEach(([sn, d]) => {
    if (d.productName) prodSet.add(d.productName);
    const b = d.batch || d.batchId || "";
    if (b) batchSet.add(b);
    getRoute(sn, d).forEach(proc => { procSet.add(proc); const eq = getProc(d, proc).equip; if (eq) equipSet.add(eq); });
  });
  const fillSel = (id, items) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const prev = sel.value;
    const sorted = [...items].sort();
    const existing = [...sel.options].slice(1).map(o => o.value);
    if (JSON.stringify(sorted) === JSON.stringify(existing)) return;
    const label = sel.options[0] ? sel.options[0].text : "";
    sel.innerHTML = "<option value=\"\">" + label + "</option>" + sorted.map(v => "<option value=\"" + esc(v) + "\">" + esc(v) + "</option>").join("");
    sel.value = prev;
  };
  fillSel("wsFilterProduct", prodSet);
  fillSel("wsFilterBatch", batchSet);
  fillSel("wsFilterEquip", equipSet);
  fillSel("wsFilterProc", procSet);
}

window.renderWorkspace = function renderWorkspace() {
  const table = document.getElementById('wsTable');
  if (!table) return;
  updateFilterOptions();

  const search = (document.getElementById('wsSearch')?.value || '').toLowerCase();
  const fStatus = document.getElementById("wsFilterStatus")?.value || "";
  const fProduct = document.getElementById("wsFilterProduct")?.value || "";
  const fBatch = document.getElementById("wsFilterBatch")?.value || "";
  const fEquip = document.getElementById("wsFilterEquip")?.value || "";
  const fProc = document.getElementById("wsFilterProc")?.value || "";
  const fDate = document.getElementById("wsFilterDate")?.value || "";
  const filtered = Object.entries(S.DATA).filter(([sn, d]) => {
    const s = d.status || "대기";
    if (fStatus && s !== fStatus) return false;
    if (fProduct && (d.productName || "") !== fProduct) return false;
    const snBatch = d.batch || d.batchId || "";
    if (fBatch && snBatch !== fBatch) return false;
    if (fEquip) {
      const route = getRoute(sn, d);
      const hasEquip = route.some(proc => (getProc(d, proc).equip || "") === fEquip);
      if (!hasEquip) return false;
    }
    if (fProc) {
      const route = getRoute(sn, d);
      if (!route.includes(fProc)) return false;
    }
    if (fDate) {
      let allDates = [];
      if (fD(d.startDate)) allDates.push(fD(d.startDate));
      if (fD(d.endDate)) allDates.push(fD(d.endDate));
      if (fD(d.createdAt)) allDates.push(fD(d.createdAt));
      const route = getRoute(sn, d);
      route.forEach(proc => {
        const p = getProc(d, proc);
        if (fD(p.planStart)) allDates.push(fD(p.planStart));
        if (fD(p.planEnd)) allDates.push(fD(p.planEnd));
        if (fD(p.actualStart)) allDates.push(fD(p.actualStart));
        if (fD(p.actualEnd)) allDates.push(fD(p.actualEnd));
      });

      if (!allDates.includes(fDate)) return false;
    }
    if (search) {
      const haystack = (sn + " " + (d.productName || "") + " " + (d.customer || "") + " " + (d.batch || d.batchId || "") + " " + (d.currentProcess || "")).toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  const countEl = document.getElementById('wsSearchCount');
  if (countEl) countEl.textContent = search ? `${filtered.length}건 검색` : '';

  // 2단계 그룹핑
  let groups = {};
  filtered.forEach(([sn, d]) => {
    let mainKey, subKey;
    if (S.wsViewMode === 'batch') {
      mainKey = d.batch || d.batchId || extractBatchFromSN(sn) || '기타';
      subKey = d.productName || extractCategory(sn) || '기타';
    } else {
      mainKey = d.productName || extractCategory(sn) || '기타';
      subKey = d.batch || d.batchId || extractBatchFromSN(sn) || '기타';
    }
    if (!groups[mainKey]) groups[mainKey] = {};
    if (!groups[mainKey][subKey]) groups[mainKey][subKey] = [];
    groups[mainKey][subKey].push([sn, d]);
  });

  const groupKeys = Object.keys(groups).sort();
  groupKeys.forEach(k => { if (S.wsGroupState[k] === undefined) S.wsGroupState[k] = true; });

  let html = '';
  groupKeys.forEach(key => {
    const subGroups = groups[key];
    const allItems = Object.values(subGroups).flat();
    const collapsed = S.wsGroupState[key];
    const doneCount = allItems.filter(([, d]) => (d.status || '대기') === '완료').length;
    const mainLabel = S.wsViewMode === 'batch'
      ? `${esc(key)} <span style="font-size:12px;color:var(--t2);font-weight:400">(${allItems.length}개 LOT)</span>`
      : esc(key);

    html += `<div class="ws-group">
      <div class="ws-group-header" onclick="toggleGroup('${esc(key)}')" style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg3);border-radius:var(--r4);margin-bottom:4px;user-select:none">
        <span style="font-size:12px;transition:transform 0.2s;transform:rotate(${collapsed ? '0' : '90'}deg)">▶</span>
        <span style="font-weight:600;font-size:14px;flex:1">${mainLabel}</span>
        <span style="font-size:12px;color:var(--t2)">${doneCount}/${allItems.length} 완료</span>
      </div>`;

    if (!collapsed) {
      const subKeys = Object.keys(subGroups).sort();
      subKeys.forEach(sk => {
        const items = subGroups[sk];
        const subStateKey = key + '::' + sk;
        if (S.wsGroupState[subStateKey] === undefined) S.wsGroupState[subStateKey] = false;
        const subCollapsed = S.wsGroupState[subStateKey];
        const subDone = items.filter(([, d]) => (d.status || '대기') === '완료').length;
        const subLabel = S.wsViewMode === 'batch' ? '제품: ' + esc(sk) : '배치: ' + esc(sk);

        html += `<div style="margin-left:16px;margin-bottom:2px">
          <div onclick="toggleGroup('${esc(subStateKey)}')" style="cursor:pointer;display:flex;align-items:center;gap:6px;padding:6px 10px;background:var(--bg2);border-radius:var(--r4);margin-bottom:2px;user-select:none">
            <span style="font-size:10px;transition:transform 0.2s;transform:rotate(${subCollapsed ? '0' : '90'}deg)">▶</span>
            <span style="font-size:13px;font-weight:500;flex:1">${subLabel} <span style="font-size:11px;color:var(--t2)">(${items.length})</span></span>
            <span style="font-size:11px;color:var(--t2)">${subDone}/${items.length}</span>
          </div>`;

        if (!subCollapsed) {
          html += `<div class="table-responsive"><table class="table ws-table">
            <thead><tr>
              <th style="width:30px"><input type="checkbox" onchange="toggleGroupSelect('${esc(subStateKey)}',this.checked)"></th>
              <th>S/N</th><th>상태</th><th>현재공정</th><th>설비</th><th>시작일</th><th>완료일</th><th>진행률</th>
            </tr></thead><tbody>`;

          items.forEach(([sn, d]) => {
            const status = d.status || '대기';
            const route = getRoute(sn, d);
            const curProc = d.currentProcess || route[0] || '';
            const procData = getProc(d, curProc);
            const equip = procData.equip || '';
            const startDate = fD(procData.planStart || procData.actualStart || d.startDate);
            const endDate = fD(d.endDate);
            const progress = calcProgress(d, sn);
            const checked = S.wsSelection.has(sn) ? 'checked' : '';

            html += `<tr class="ws-row ${status === '지연' ? 'row-delay' : ''}" data-sn="${esc(sn)}">
              <td><input type="checkbox" ${checked} onchange="toggleSNSelect('${esc(sn)}',this.checked)"></td>
              <td class="sn-cell" onclick="openSidePanel('${esc(sn)}')" style="cursor:pointer;font-weight:600;color:var(--ac2)">${esc(sn)}</td>
              <td>${statusBadge(status)}</td>
              <td class="proc-cell" onclick="showProcDropdown(event,'${esc(sn)}')" style="cursor:pointer" title="클릭하여 공정 변경">
                <span style="color:${PROC_COLORS[curProc] || 'var(--t1)'};font-weight:500">${esc(curProc || '-')}</span> <span style="font-size:10px;color:var(--t2)">▼</span>
              </td>
              <td class="equip-cell" onclick="showEquipDropdown(event,'${esc(sn)}','${esc(curProc)}')" style="cursor:pointer" title="클릭하여 설비 변경">
                ${esc(equip || '-')} <span style="font-size:10px;color:var(--t2)">▼</span>
              </td>
              <td class="date-cell">
                <input type="date" value="${startDate}" onchange="updateProcStartDate('${esc(sn)}','${esc(curProc)}',this.value)" style="background:transparent;border:none;color:inherit;font-size:12px;width:120px">
              </td>
              <td style="font-size:12px">${fmt(endDate)}</td>
              <td><div style="display:flex;align-items:center;gap:4px"><div style="flex:1;height:6px;background:var(--bg3);border-radius:3px;overflow:hidden"><div style="width:${progress}%;height:100%;background:${progress >= 100 ? 'var(--suc)' : progress > 0 ? 'var(--ac2)' : 'var(--border)'};border-radius:3px;transition:width 0.3s"></div></div><span style="font-size:11px;color:var(--t2)">${progress}%</span></div></td>
            </tr>`;
          });
          html += '</tbody></table></div>';
        }
        html += '</div>';
      });
    }
    html += '</div>';
  });

  table.innerHTML = html || '<div style="text-align:center;padding:40px;color:var(--t2)">데이터가 없습니다</div>';
  updateBatchBar();
}

// === 공정/설비 드롭다운 ===
function closeAllDropdowns() {
  document.querySelectorAll('.esc-dropdown').forEach(el => el.remove());
}

window.showProcDropdown = function(e, sn) {
  e.stopPropagation();
  closeAllDropdowns();
  const item = S.DATA[sn];
  if (!item) return;
  const route = getRoute(sn, item);
  const current = item.currentProcess || route[0] || '';

  const dd = document.createElement('div');
  dd.className = 'esc-dropdown';
  dd.style.cssText = 'position:fixed;z-index:9999;background:var(--bg2);border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.3);min-width:160px;max-height:300px;overflow-y:auto;padding:4px';

  route.forEach(proc => {
    const pd = getProc(item, proc);
    const isCurrent = proc === current;
    const st = pd.status || '대기';
    const row = document.createElement('div');
    row.style.cssText = "padding:8px 12px;cursor:pointer;border-radius:6px;display:flex;align-items:center;gap:8px;font-size:13px;" + (isCurrent ? "background:rgba(99,102,241,0.15);font-weight:600" : "");
    row.innerHTML = "<span style=\"width:8px;height:8px;border-radius:50%;background:" + (PROC_COLORS[proc] || "#666") + "\"></span>" + esc(proc) + "<span style=\"margin-left:auto;font-size:11px;color:var(--t2)\">" + esc(st) + "</span>";
    row.onmouseenter = () => row.style.background = 'var(--bg4)';
    row.onmouseleave = () => row.style.background = isCurrent ? 'rgba(99,102,241,0.15)' : '';
    row.addEventListener('pointerup', async (ev) => {
      ev.stopPropagation();
      dd.remove();
      if (proc !== current) {
        try {
          const ref = FB.doc(firebaseDb, 'production', sn);
          await FB.updateDoc(ref, { currentProcess: proc });
          toast(`${sn} 현재공정 → ${proc}`, 'success');
        } catch (err) { handleFirestoreError(err, '공정 변경'); }
      }
    });
    dd.appendChild(row);
  });

  document.body.appendChild(dd);
  const anchor = e.target.closest('td');
  positionDropdown(dd, anchor);
  setTimeout(() => {
    const handler = (ev) => {
      if (!dd.contains(ev.target)) { dd.remove(); document.removeEventListener('pointerdown', handler); }
    };
    document.addEventListener('pointerdown', handler);
  }, 0);
};

window.showEquipDropdown = function(e, sn, proc) {
  e.stopPropagation();
  closeAllDropdowns();
  const item = S.DATA[sn];
  if (!item) return;
  if (!proc) proc = item.currentProcess || '';
  if (!proc) { toast('공정을 먼저 선택하세요', 'warn'); return; }

    const _cat = extractCategory(sn) || (item && item.category ? item.category : "");
    const equipList = getEquipList(proc, _cat);
  if (!equipList.length) { toast(`${proc} 공정의 설비 목록이 없습니다`, 'warn'); return; }

  const currentEquip = getProc(item, proc).equip || '';
  const dd = document.createElement('div');
  dd.className = 'esc-dropdown';
  dd.style.cssText = 'position:fixed;z-index:9999;background:var(--bg2);border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.3);min-width:160px;max-height:300px;overflow-y:auto;padding:4px';

  // 해제 옵션
  const clearRow = document.createElement('div');
  clearRow.style.cssText = 'padding:8px 12px;cursor:pointer;border-radius:6px;font-size:13px;color:var(--t2)';
  clearRow.textContent = '— 설비 해제 —';
  clearRow.addEventListener('pointerup', async () => { dd.remove(); await updateEquip(sn, proc, ''); });
  clearRow.onmouseenter = () => clearRow.style.background = 'var(--bg4)';
  clearRow.onmouseleave = () => clearRow.style.background = '';
  dd.appendChild(clearRow);

  equipList.forEach(eq => {
    const isCurrent = eq === currentEquip;
    const row = document.createElement('div');
    row.style.cssText = `padding:8px 12px;cursor:pointer;border-radius:6px;font-size:13px;${isCurrent ? 'background:rgba(99,102,241,0.15);font-weight:600' : ''}`;
    row.textContent = eq + (isCurrent ? ' ✓' : '');
    row.onmouseenter = () => row.style.background = 'var(--bg4)';
    row.onmouseleave = () => row.style.background = isCurrent ? 'rgba(99,102,241,0.15)' : '';
    row.addEventListener('pointerup', async () => { dd.remove(); await updateEquip(sn, proc, eq); });
    dd.appendChild(row);
  });

  document.body.appendChild(dd);
  const anchor = e.target.closest('td');
  positionDropdown(dd, anchor);
  setTimeout(() => {
    const handler = (ev) => {
      if (!dd.contains(ev.target)) { dd.remove(); document.removeEventListener('pointerdown', handler); }
    };
    document.addEventListener('pointerdown', handler);
  }, 0);
};

async function updateEquip(sn, proc, equip) {
  try {
    const ref = FB.doc(firebaseDb, 'production', sn);
    await FB.updateDoc(ref, { [`processes.${proc}.equip`]: equip });
    toast(`${sn} ${proc} 설비 → ${equip || '해제'}`, 'success');
  } catch (err) { handleFirestoreError(err, '설비 변경'); }
}

window.updateProcStartDate = async function(sn, proc, val) {
  if (!val) return;
  const item = S.DATA[sn];
  if (!item) return;
  const cat = extractCategory(sn);
  const days = getDefaultDays(proc, cat);
  const endDate = addBD(val, days);
  try {
    const ref = FB.doc(firebaseDb, 'production', sn);
    const updates = {};
    updates[`processes.${proc}.planStart`] = val;
    updates[`processes.${proc}.planEnd`] = endDate;
    if ((getProc(item, proc).status || '대기') === '대기') {
      updates[`processes.${proc}.status`] = '진행';
      updates[`processes.${proc}.actualStart`] = val;
    }
    await FB.updateDoc(ref, updates);
    toast(`${sn} ${proc} 시작일 → ${fmt(val)} (종료: ${fmt(endDate)})`, 'success');
  } catch (err) { handleFirestoreError(err, '날짜 변경'); }
};

// === 선택/일괄 작업 ===
window.toggleSNSelect = function(sn, checked) {
  if (checked) S.wsSelection.add(sn); else S.wsSelection.delete(sn);
  updateBatchBar();
};

window.toggleGroupSelect = function(key, checked) {
  Object.entries(S.DATA).forEach(([sn, d]) => {
    let mainKey, subKey;
    if (S.wsViewMode === "batch") {
      mainKey = d.batch || d.batchId || extractBatchFromSN(sn) || "기타";
      subKey = d.productName || extractCategory(sn) || "기타";
    } else {
      mainKey = d.productName || extractCategory(sn) || "기타";
      subKey = d.batch || d.batchId || extractBatchFromSN(sn) || "기타";
    }
    // 서브그룹 키 (제품::배치) 또는 메인그룹 키 매칭
    const subStateKey = mainKey + "::" + subKey;
    if (key === subStateKey || key === mainKey) {
      if (key === mainKey || key === subStateKey) {
        if (checked) S.wsSelection.add(sn); else S.wsSelection.delete(sn);
      }
    }
  });
  renderWorkspace();
};

window.clearSelection = function() {
  S.wsSelection.clear();
  renderWorkspace();
};

function updateBatchBar() {
  const bar = document.getElementById('batchBar');
  const countEl = document.getElementById('batchCount');
  if (!bar || !countEl) return;
  if (S.wsSelection.size > 0) {
    bar.style.display = 'flex';
    countEl.textContent = `${S.wsSelection.size}건 선택`;
  } else {
    bar.style.display = 'none';
  }
}

window.applyBatch = async function() {
  const status = document.getElementById('batchStatusSel').value;
  if (!status) { toast('상태를 선택하세요', 'warn'); return; }
  if (!S.wsSelection.size) { toast('선택된 항목이 없습니다', 'warn'); return; }
  try {
    const batch = FB.writeBatch(firebaseDb);
    S.wsSelection.forEach(sn => {
      const ref = FB.doc(firebaseDb, 'production', sn);
      batch.update(ref, { status });
    });
    await batch.commit();
    toast(`${S.wsSelection.size}건 상태 → ${status}`, 'success');
    S.wsSelection.clear();
  } catch (err) { handleFirestoreError(err, '일괄 상태 변경'); }
};

window.applyNG = async function() {
  if (!S.wsSelection.size) { toast('선택된 항목이 없습니다', 'warn'); return; }
  if (!confirm(`${S.wsSelection.size}건을 NG(폐기) 처리하시겠습니까?`)) return;
  try {
    const batch = FB.writeBatch(firebaseDb);
    S.wsSelection.forEach(sn => {
      const ref = FB.doc(firebaseDb, 'production', sn);
      batch.update(ref, { status: '폐기' });
    });
    await batch.commit();
    toast(`${S.wsSelection.size}건 NG 처리 완료`, 'success');
    S.wsSelection.clear();
  } catch (err) { handleFirestoreError(err, 'NG 처리'); }
};

window.generateBatchQR = async function() {
  if (!S.wsSelection.size) { toast('선택된 항목이 없습니다', 'warn'); return; }
  const grid = document.getElementById('qrPrintGrid');
  if (!grid) return;
  grid.innerHTML = '';
  for (const sn of S.wsSelection) {
    const item = document.createElement('div');
    item.className = 'qr-print-item';
    item.innerHTML = `<div id="qr_${sn.replace(/[^a-zA-Z0-9]/g, '_')}" style="margin-bottom:4px"></div><div style="font-size:10px;font-family:monospace;word-break:break-all">${esc(sn)}</div>`;
    grid.appendChild(item);
  }
  openModal('qrPrintModal');
  if (typeof QRCode !== 'undefined') {
    for (const sn of S.wsSelection) {
      const wrap = document.getElementById('qr_' + sn.replace(/[^a-zA-Z0-9]/g, '_'));
      if (wrap) {
        try {
          const canvas = document.createElement('canvas');
          await QRCode.toCanvas(canvas, sn, { width: 100, margin: 1 });
          wrap.appendChild(canvas);
        } catch {}
      }
    }
  }
};
// ===================================================
// 파트 3: 캘린더, 간트차트, 분석, 차트
// ===================================================

// === 캘린더 ===
window.setCalView = function(mode, btn) {
  S.set('calViewMode', mode);
  document.querySelectorAll('#calendarTab .tab-btn').forEach(el => el.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderCalendar();
};

window.calPrev = function() {
  if (S.calViewMode === 'week') S.calDate.setDate(S.calDate.getDate() - 7);
  else S.calDate.setMonth(S.calDate.getMonth() - 1);
  renderCalendar();
};

window.calNext = function() {
  if (S.calViewMode === 'week') S.calDate.setDate(S.calDate.getDate() + 7);
  else S.calDate.setMonth(S.calDate.getMonth() + 1);
  renderCalendar();
};

window.calToday = function() {
  S.set('calDate', new Date());
  renderCalendar();
};

function renderCalendar() {
  const container = document.getElementById('calContent');
  if (!container) return;
  document.getElementById('calTitle').textContent = `${S.calDate.getFullYear()}년 ${S.calDate.getMonth() + 1}월`;

  if (S.calViewMode === 'issues') { renderIssueBoard(container); return; }
  if (S.calViewMode === 'week') { renderWeekView(container); return; }

  const year = S.calDate.getFullYear();
  const month = S.calDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const today = new Date().toISOString().split('T')[0];

  // 이벤트 수집
  let events = {};
  function addEvent(date, ev) {
    if (!date) return;
    if (!events[date]) events[date] = [];
    events[date].push(ev);
  }

  Object.entries(S.DATA).forEach(([sn, d]) => {
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

  // 통계
  let startCount = 0, doneCount = 0, deadlineCount = 0, eventDays = new Set();
  Object.entries(events).forEach(([date, evs]) => {
    const parts = date.split('-');
    if (parseInt(parts[0]) === year && parseInt(parts[1]) === month + 1) {
      eventDays.add(date);
      evs.forEach(ev => {
        if (ev.type === '시작') startCount++;
        if (ev.type === '완료') doneCount++;
        if (ev.type === '마감') deadlineCount++;
      });
    }
  });

  let html = `<div class="cal-stats" style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap">
    <span class="badge badge-prog" style="font-size:12px">시작 ${startCount}</span>
    <span class="badge badge-done" style="font-size:12px">완료 ${doneCount}</span>
    <span class="badge badge-delay" style="font-size:12px">마감 ${deadlineCount}</span>
    <span style="font-size:12px;color:var(--t2)">${eventDays.size}일 이벤트</span>
  </div>`;

  html += '<div class="cal-grid">';
  ['일', '월', '화', '수', '목', '금', '토'].forEach(d => {
    html += `<div class="cal-dow">${d}</div>`;
  });

  for (let i = 0; i < startDow; i++) html += '<div class="cal-cell cal-empty"></div>';

  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = dateStr === today;
    const dayEvents = events[dateStr] || [];
    const dow = new Date(year, month, day).getDay();
    const isWknd = dow === 0 || dow === 6;

    html += `<div class="cal-cell ${isToday ? 'cal-today' : ''} ${isWknd ? 'cal-weekend' : ''}" data-cal-date="${dateStr}" style="cursor:pointer">
      <div class="cal-day-num" style="${isToday ? 'background:var(--ac2);color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:700' : ''}">${day}</div>
      <div class="cal-events" style="display:flex;flex-wrap:wrap;gap:2px;margin-top:2px">`;

    // 그룹화
    const grouped = {};
    dayEvents.forEach(ev => {
      const key = ev.proc + '_' + ev.type;
      if (!grouped[key]) grouped[key] = { proc: ev.proc, type: ev.type, equips: new Set(), count: 0 };
      grouped[key].count++;
      if (ev.equip) {
        const short = ev.equip.match(/[\d]+\s*호기|[\d]+\s*라인|[A-C]$/i);
        const label = short ? short[0] : ev.equip.replace(/^[가-힣]+\s*/, '');
        if (label) grouped[key].equips.add(label);
      }
    });

    const items = Object.values(grouped);
    items.slice(0, 3).forEach(item => {
      const color = item.proc === '납기' ? '#ef4444' : (PROC_COLORS[item.proc] || '#6366f1');
      const icon = item.type === '마감' ? '●' : item.type === '완료' ? '✓' : '';
      const eqs = [...item.equips];
      let label = item.proc;
      if (eqs.length === 1) label += ' ' + eqs[0];
      else if (eqs.length > 1) label += ' ' + eqs.join(' / ');
      const countStr = item.count > 1 ? ' ×' + item.count : '';
      html += `<div style="width:100%;font-size:9px;padding:1px 3px;border-radius:2px;background:${color}22;color:${color};overflow:hidden;white-space:nowrap;text-overflow:ellipsis" title="${esc(label)} ${item.count}건">${icon}${esc(label)}${countStr}</div>`;
    });
    if (items.length > 3) html += `<div style="font-size:9px;color:var(--t2)">+${items.length - 3}</div>`;

    html += '</div></div>';
  }

  html += '</div>';

  // 범례
  html += '<div class="cal-legend" style="display:flex;gap:16px;margin-top:12px;font-size:11px;color:var(--t2)">';
  PROC_ORDER.forEach(proc => {
    html += `<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${PROC_COLORS[proc]};margin-right:4px"></span>${proc}</span>`;
  });
  html += '<span><span style="color:#ef4444;margin-right:4px">●</span>납기</span>';
  html += '<span><span style="color:var(--suc);margin-right:4px">✓</span>완료</span>';
  html += '</div>';

  container.innerHTML = html;
  container.addEventListener('click', function(e) {
    const cell = e.target.closest('[data-cal-date]');
    if (cell) window.openCalDayModal(cell.dataset.calDate);
  });
}

window.openCalDayModal = function(date) {
  let items = [];
  Object.entries(S.DATA).forEach(([sn, d]) => {
    const route = getRoute(sn, d);
    const prodName = d.productName || extractCategory(sn) || '기타';
    route.forEach(proc => {
      const p = getProc(d, proc);
      const eq = p.equip || '';
      const base = { sn, proc, equip: eq, productName: prodName };
      if (fD(p.planStart) === date || fD(p.actualStart) === date) items.push({ ...base, action: '시작', status: p.status || '대기' });
      if (fD(p.planEnd) === date) items.push({ ...base, action: '예정종료', status: p.status || '대기' });
      if (fD(p.actualEnd) === date) items.push({ ...base, action: '완료', status: '완료' });
    });
    if (fD(d.endDate) === date) items.push({ sn, proc: '납기', action: '마감', status: d.status || '대기', equip: '', productName: d.productName || '기타' });
  });

  const dayIssues = S.ISSUES.filter(i => fD(i.date) === date);
  const actionOrder = ['완료', '시작', '예정종료', '마감'];
  const actionIcons = { '시작': '🟢', '완료': '✅', '예정종료': '📋', '마감': '🔴' };

  const byAction = {};
  items.forEach(item => {
    if (!byAction[item.action]) byAction[item.action] = [];
    byAction[item.action].push(item);
  });

  let groupId = 0;
  let content = '<div style="max-height:65vh;overflow-y:auto">';

  if (items.length) {
    actionOrder.forEach(action => {
      const list = byAction[action];
      if (!list || !list.length) return;
      content += `<div style="margin-bottom:16px">
        <div style="font-weight:700;font-size:14px;margin-bottom:8px;display:flex;align-items:center;gap:6px">
          ${actionIcons[action] || ''} ${esc(action)}
          <span style="color:var(--t2);font-weight:400;font-size:13px">(${list.length}건)</span>
        </div>`;

      const byProduct = {};
      list.forEach(item => {
        if (!byProduct[item.productName]) byProduct[item.productName] = [];
        byProduct[item.productName].push(item);
      });

      Object.entries(byProduct).sort((a, b) => b[1].length - a[1].length).forEach(([prodName, prodItems]) => {
        const gid = '_cdg_' + groupId++;
        content += `<div style="margin-left:8px;margin-bottom:4px">
          <div data-toggle-group="${gid}" style="cursor:pointer;display:flex;align-items:center;gap:6px;padding:7px 10px;background:var(--bg4);border-radius:6px;user-select:none">
            <span data-arrow="${gid}" style="font-size:10px;transition:transform 0.2s;transform:rotate(0deg);flex-shrink:0">▶</span>
            <span style="font-weight:600;font-size:13px;flex:1">${esc(prodName)}</span>
            <span style="color:var(--t2);font-size:12px;flex-shrink:0">${prodItems.length}매</span>
          </div>
          <div data-group-body="${gid}" style="display:none;margin-top:3px;margin-left:16px">`;

        prodItems.forEach(item => {
          const color = PROC_COLORS[item.proc] || '#ef4444';
          const label = item.equip ? `${item.proc} ${item.equip}` : item.proc;
          content += `<div data-sn-click="${esc(item.sn)}" style="padding:5px 10px;margin-bottom:3px;border-radius:6px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:8px;border-left:3px solid ${color};background:var(--bg3)">
            <span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(item.sn)}</span>
            <span style="color:${color};font-size:11px;flex-shrink:0">${esc(label)}</span>
          </div>`;
        });
        content += '</div></div>';
      });
      content += '</div>';
    });
  }

  if (dayIssues.length) {
    content += `<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px">
      <div style="font-weight:600;font-size:13px;margin-bottom:6px">🚨 이슈 (${dayIssues.length})</div>`;
    dayIssues.forEach(issue => {
      content += `<div style="padding:6px 10px;margin-bottom:4px;background:rgba(239,68,68,0.08);border-radius:6px;font-size:12px"><strong>${esc(issue.type || '')}</strong> ${esc(issue.content || '')}</div>`;
    });
    content += '</div>';
  }

  if (!items.length && !dayIssues.length) {
    content = '<div style="text-align:center;padding:20px;color:var(--t2)">이 날의 이벤트가 없습니다</div>';
  }
  content += '</div>';

  const modal = document.getElementById('reportModal');
  if (!modal) return;
  const inner = modal.querySelector('.modal');
  if (!inner) return;

  inner.innerHTML = `
    <div class="modal-header">
      <div class="modal-title">📅 ${fmt(date)}</div>
      <button class="modal-close btn-icon" onclick="window.closeModal('reportModal')">✕</button>
    </div>
    <div id="reportContent">${content}</div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
      <button class="btn btn-secondary" onclick="window.closeModal('reportModal')">닫기</button>
    </div>`;

  modal.classList.remove('hidden');

  requestAnimationFrame(() => {
    const rc = document.getElementById('reportContent');
    if (!rc) return;
    rc.addEventListener('click', function(ev) {
      const toggler = ev.target.closest('[data-toggle-group]');
      if (toggler) {
        const gid = toggler.dataset.toggleGroup;
        const body = document.querySelector('[data-group-body="' + gid + '"]');
        const arrow = document.querySelector('[data-arrow="' + gid + '"]');
        if (body && arrow) {
          const open = body.style.display !== 'none';
          body.style.display = open ? 'none' : 'block';
          arrow.style.transform = open ? 'rotate(0deg)' : 'rotate(90deg)';
        }
        return;
      }
      const snEl = ev.target.closest('[data-sn-click]');
      if (snEl) {
        const sn = snEl.dataset.snClick;
        if (sn) { window.closeModal('reportModal'); openSidePanel(sn); }
      }
    });
  });
};

function renderWeekView(container) {
    const today = new Date().toISOString().split('T')[0];
  const base = new Date(S.calDate);
  const dow = base.getDay();
  base.setDate(base.getDate() - dow);

  let html = '<div class="week-view">';
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const isToday = dateStr === today;
    const dayLabel = ['일', '월', '화', '수', '목', '금', '토'][i];

    let dayItems = [];
    Object.entries(S.DATA).forEach(([sn, data]) => {
      getRoute(sn, data).forEach(proc => {
        const p = getProc(data, proc);
        if (fD(p.planStart) === dateStr || fD(p.actualStart) === dateStr || fD(p.planEnd) === dateStr || fD(p.actualEnd) === dateStr) {
          dayItems.push({ sn, proc, data: p });
        }
      });
    });

    html += `<div class="week-day ${isToday ? 'week-today' : ''}" style="border:1px solid var(--border);border-radius:8px;padding:10px;${isToday ? 'border-color:var(--ac2)' : ''}">
      <div style="font-weight:600;font-size:13px;margin-bottom:6px">${dayLabel} ${d.getDate()}일</div>`;

    dayItems.forEach(item => {
      html += `<div style="font-size:11px;padding:3px 6px;margin-bottom:3px;border-radius:4px;background:${PROC_COLORS[item.proc] || '#666'}22;color:${PROC_COLORS[item.proc] || 'var(--t1)'};cursor:pointer" onclick="openSidePanel('${esc(item.sn)}')">${esc(item.sn)} / ${esc(item.proc)}</div>`;
    });
    if (!dayItems.length) html += '<div style="font-size:11px;color:var(--t2)">일정 없음</div>';
    html += '</div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

function renderIssueBoard(container) {
  const types = ['메모', '지시', '불량', '폐기', '기타'];
  let html = '<div class="issue-board" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">';
  types.forEach(type => {
    const filtered = S.ISSUES.filter(i => (i.type || '기타') === type);
    html += `<div class="card"><div class="card-title">${esc(type)} (${filtered.length})</div>`;
    filtered.slice(0, 10).forEach(issue => {
      html += `<div style="padding:6px;margin-bottom:4px;background:var(--bg4);border-radius:6px;font-size:12px">
        <div style="color:var(--t2);font-size:10px">${fmt(fD(issue.date))}</div>
        <div>${esc(issue.content || '-')}</div>
        ${issue.sn ? `<div style="font-size:10px;color:var(--ac2)">${esc(issue.sn)}</div>` : ''}
      </div>`;
    });
    html += '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

// === 간트차트 === (gantt.js로 분리됨)
// renderGantt, setGanttView 등은 src/js/gantt.js에서 window에 등록
function renderGantt() {
  if (typeof window.renderGantt === 'function') window.renderGantt();
}

// === 설정 탭 ===
function renderSettings() {
  _renderSettings();
  // Sync Gemini key status in static HTML section (if it exists)
  const keyInput = document.getElementById('geminiKeyInput');
  const storedKey = localStorage.getItem('esc_gemini_key') || '';
  if (keyInput && !keyInput.value) keyInput.value = storedKey;
  const statusEl = document.getElementById('geminiKeyStatus');
  if (statusEl) {
    const hasKey = !!storedKey;
    statusEl.textContent = hasKey ? '✅ API 키 등록됨' : '❌ API 키 미등록 — 로컬 AI 모드';
    statusEl.style.color = hasKey ? 'var(--suc)' : 'var(--err)';
  }
}

// saveGeminiKey is also registered in settings.js; provide fallback for inline HTML calls
if (!window.saveGeminiKey) {
  window.saveGeminiKey = function() {
    const input = document.getElementById('geminiKeyInput');
    const key = input ? input.value.trim() : '';
    if (!key) { toast('API 키를 입력하세요', 'warn'); return; }
    localStorage.setItem('esc_gemini_key', key);
    toast('✅ Gemini API 키 저장됨', 'success');
    const statusEl = document.getElementById('geminiKeyStatus');
    if (statusEl) { statusEl.textContent = '✅ API 키 등록됨'; statusEl.style.color = 'var(--suc)'; }
  };
}

// === 분석 탭 — analysis.js에 위임 ===
function renderAnalysis() {
  _renderAnalysis();
}

function renderAllCharts() {
  // 제품별 생산량
  drawBarChart('prodBarChart', () => {
    const counts = {};
    Object.values(S.DATA).forEach(d => { const n = d.productName || '기타'; counts[n] = (counts[n] || 0) + 1; });
    return { labels: Object.keys(counts), values: Object.values(counts), color: '#6366f1' };
  });

  // 상태 도넛 (analysis.js의 drawDonutChart 사용)
  const counts2 = { 대기: 0, 진행: 0, 완료: 0, 지연: 0, 폐기: 0 };
  Object.values(S.DATA).forEach(d => { const s = d.status || '대기'; if (counts2[s] !== undefined) counts2[s]++; });
  _drawDonutChart('analysisDonut', counts2);

  // 월별 투입/완료
  drawBarChart('monthLineChart', () => {
    const months = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[key] = { in: 0, out: 0 };
    }
    Object.values(S.DATA).forEach(d => {
      const sd = fD(d.startDate || d.createdAt);
      if (sd) { const k = sd.substring(0, 7); if (months[k]) months[k].in++; }
      if ((d.status || '대기') === '완료') {
        const cd = fD(d.completedAt || d.updatedAt);
        if (cd) { const k = cd.substring(0, 7); if (months[k]) months[k].out++; }
      }
    });
    return {
      labels: Object.keys(months).map(k => k.split('-')[1] + '월'),
      values: Object.values(months).map(v => v.in),
      values2: Object.values(months).map(v => v.out),
      color: '#6366f1', color2: '#10b981', legend: ['투입', '완료']
    };
  });

  // 리드타임
  drawBarChart('leadtimeChart', () => {
    const plan = {}, actual = {};
    PROC_ORDER.forEach(p => { plan[p] = []; actual[p] = []; });
    Object.entries(S.DATA).forEach(([sn, d]) => {
      const cat = extractCategory(sn);
      getRoute(sn, d).forEach(proc => {
        if (!plan[proc]) { plan[proc] = []; actual[proc] = []; }
        plan[proc].push(getDefaultDays(proc, cat));
        const pd = getProc(d, proc);
        if (pd.actualDays) actual[proc].push(pd.actualDays);
      });
    });
    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : 0;
    return {
      labels: PROC_ORDER,
      values: PROC_ORDER.map(p => avg(plan[p])),
      values2: PROC_ORDER.map(p => avg(actual[p])),
      color: '#6366f1', color2: '#f59e0b', legend: ['계획', '실제']
    };
  });

  // 제품별 불량률
  drawBarChart('defectRateChart', () => {
    const stats = {};
    Object.entries(S.DATA).forEach(([sn, d]) => {
      const n = d.productName || '기타';
      if (!stats[n]) stats[n] = { total: 0, defect: 0 };
      stats[n].total++;
      getRoute(sn, d).forEach(proc => {
        const p = getProc(d, proc);
        if (p.defect && p.defect !== '') stats[n].defect++;
      });
    });
    const labels = Object.keys(stats);
    const values = labels.map(n => stats[n].total ? Math.round(stats[n].defect / stats[n].total * 100) : 0);
    return { labels, values, color: '#ef4444' };
  });

  // 공정별 불량
  drawBarChart('defectProcChart', () => {
    const counts = {};
    PROC_ORDER.forEach(p => counts[p] = 0);
    Object.values(S.DATA).forEach(d => {
      getRoute('', d).forEach(proc => {
        const p = getProc(d, proc);
        if (p.defect && p.defect !== '') counts[proc] = (counts[proc] || 0) + 1;
      });
    });
    return {
      labels: PROC_ORDER,
      values: PROC_ORDER.map(p => counts[p] || 0),
      colors: PROC_ORDER.map(p => PROC_COLORS[p])
    };
  });
}

// === 차트 그리기 ===
function drawBarChart(canvasId, dataFn) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const data = dataFn();
  const { labels, values } = data;

  if ((!labels || !labels.length || !values || values.every(v => v === 0)) && handleEmptyChart(canvas, [], '데이터가 없습니다')) return;

  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.parentElement.clientWidth - 32;
  const h = canvas.height = 240;
  ctx.clearRect(0, 0, w, h);

  const values2 = data.values2;
  const colors = data.colors;
  const maxVal = Math.max(...values, ...(values2 || []), 1);
  const chartH = h - 50;
  const baseline = chartH + 10;
  const slotW = (w - 60) / labels.length;
  const barW = values2 ? (slotW - 8) / 2 : slotW - 8;

  labels.forEach((label, i) => {
    const x = 40 + i * slotW;
    const barH = values[i] / maxVal * chartH;

    ctx.fillStyle = colors ? colors[i] : (data.color || '#6366f1');
    ctx.fillRect(x, baseline - barH, barW, barH);

    if (values2) {
      const barH2 = values2[i] / maxVal * chartH;
      ctx.fillStyle = data.color2 || '#10b981';
      ctx.fillRect(x + barW + 2, baseline - barH2, barW, barH2);
    }

    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--t2').trim() || '#999';
    ctx.font = '10px Noto Sans KR';
    ctx.textAlign = 'center';
    ctx.fillText(values[i], x + barW / 2, baseline - values[i] / maxVal * chartH - 4);
    ctx.fillText(label, x + slotW / 2 - 4, baseline + 14);
  });

  if (data.legend) {
    let lx = w - 140;
    ctx.fillStyle = data.color || '#6366f1';
    ctx.fillRect(lx, 6, 10, 10);
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--t2').trim();
    ctx.font = '11px Noto Sans KR';
    ctx.textAlign = 'left';
    ctx.fillText(data.legend[0], lx + 14, 15);
    lx += 60;
    ctx.fillStyle = data.color2 || '#10b981';
    ctx.fillRect(lx, 6, 10, 10);
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--t2').trim();
    ctx.fillText(data.legend[1], lx + 14, 15);
  }
}

// drawDonutChart moved to analysis.js — use _drawDonutChart() imported above

function drawWeeklyChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const now = new Date();
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  const labels = dates.map(d => { const p = d.split('-'); return `${p[1]}/${p[2]}`; });

  let starts = dates.map(() => 0);
  let ends = dates.map(() => 0);

  Object.values(S.DATA).forEach(d => {
    getRoute('', d).forEach(proc => {
      const p = getProc(d, proc);
      const ps = fD(p.planStart || p.actualStart);
      const ae = fD(p.actualEnd);
      dates.forEach((date, idx) => {
        if (ps === date) starts[idx]++;
        if (ae === date) ends[idx]++;
      });
    });
  });

  const hasData = starts.some(v => v > 0) || ends.some(v => v > 0);
  if (handleEmptyChart(canvas, hasData ? { ok: 1 } : [], '이번 주 데이터가 없습니다')) return;

  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.parentElement.clientWidth - 32;
  const h = canvas.height = 240;
  ctx.clearRect(0, 0, w, h);

  const maxVal = Math.max(...starts, ...ends, 1);
  const barW = (w - 60) / (dates.length * 3);
  const chartH = h - 50;
  const baseline = chartH + 10;

  dates.forEach((date, i) => {
    const x = 40 + i * (w - 60) / dates.length;
    const h1 = starts[i] / maxVal * chartH;
    const h2 = ends[i] / maxVal * chartH;

    ctx.fillStyle = '#6366f1';
    ctx.fillRect(x, baseline - h1, barW, h1);
    ctx.fillStyle = '#10b981';
    ctx.fillRect(x + barW + 2, baseline - h2, barW, h2);

    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--t2').trim() || '#999';
    ctx.font = '10px Noto Sans KR';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], x + barW, baseline + 14);
  });

  ctx.fillStyle = '#6366f1';
  ctx.fillRect(w - 120, 8, 10, 10);
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--t2').trim();
  ctx.font = '11px Noto Sans KR';
  ctx.textAlign = 'left';
  ctx.fillText('시작', w - 106, 17);
  ctx.fillStyle = '#10b981';
  ctx.fillRect(w - 60, 8, 10, 10);
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--t2').trim();
  ctx.fillText('완료', w - 46, 17);
}

// ===================================================
// 사이드 패널 (openSidePanel / closeSidePanel)
// ===================================================
window.openSidePanel = function(sn) {
  S.set('selectedSN', sn);
  const d = S.DATA[sn];
  if (!d) { toast('데이터를 찾을 수 없습니다', 'error'); return; }

  document.getElementById('spSN').textContent = sn;
  document.getElementById('spBadge').innerHTML = statusBadge(d.status || '대기');
  document.getElementById('spCat').textContent = extractCategory(sn);
  document.getElementById('spStatusSel').value = d.status || '대기';

  const body = document.getElementById('spBody');
  const route = getRoute(sn, d);
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
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">
        <div>제품: <strong>${esc(d.productName || '-')}</strong></div>
        <div>카테고리: <strong>${esc(extractCategory(sn))}</strong></div>
        <div>시작일: <strong>${fmt(fD(d.startDate || d.createdAt))}</strong></div>
        <div>납기: <strong>${fmt(fD(d.endDate))}</strong></div>
        <div>고객: <strong>${esc(d.customer || '-')}</strong></div>
        <div>배치: <strong>${esc(d.batch || d.batchId || '-')}</strong></div>
      </div>
    </div>
    <div class="sp-section">
      <div class="sp-label">공정 현황</div>
      <div>`;

  route.forEach((proc, idx) => {
    const p = getProc(d, proc);
    const st = p.status || '대기';
    const color = PROC_COLORS[proc] || '#666';
    const isCurrent = proc === (d.currentProcess || route[0]);
    html += `<div style="padding:8px 10px;margin-bottom:6px;border-radius:8px;border-left:3px solid ${color};background:${isCurrent ? 'rgba(99,102,241,0.08)' : 'var(--bg4)'}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <span style="font-weight:600;font-size:13px;color:${color}">${idx + 1}. ${esc(proc)}</span>
        ${statusBadge(st)}
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

  const snIssues = S.ISSUES.filter(i => i.sn === sn);
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
};

window.closeSidePanel = function() {
  document.getElementById('sidePanel').classList.remove('open');
  S.set('selectedSN', null);
};

window.applySpStatus = async function() {
  if (!S.selectedSN) return;
  const status = document.getElementById('spStatusSel').value;
  try {
    const ref = FB.doc(firebaseDb, 'production', S.selectedSN);
    const updates = { status };
    if (status === '완료') updates.completedAt = new Date().toISOString().slice(0, 10);
    await FB.updateDoc(ref, updates);
    toast(`${S.selectedSN} 상태 → ${status}`, 'success');
    window.openSidePanel(S.selectedSN);
  } catch (err) { handleFirestoreError(err, '상태 변경'); }
};

window.deleteSN = async function() {
  if (!S.selectedSN) return;
  if (!confirm(`${S.selectedSN}을(를) 삭제하시겠습니까?`)) return;
  try {
    await FB.deleteDoc(FB.doc(firebaseDb, 'production', S.selectedSN));
    toast(`${S.selectedSN} 삭제됨`, 'success');
    window.closeSidePanel();
  } catch (err) { handleFirestoreError(err, 'LOT 삭제'); }
};

window.showSNQR = function() {
  if (!S.selectedSN) { toast('S/N을 먼저 선택하세요', 'warn'); return; }
  const sn = S.selectedSN;
  const url = location.origin + location.pathname + '#sn=' + encodeURIComponent(sn);
  const snLabel = document.getElementById('qrSNLabel');
  if (snLabel) snLabel.textContent = sn;
  const wrap = document.getElementById('qrCanvasWrap');
  if (wrap) {
    wrap.innerHTML = '<canvas id="qrCanvas"></canvas>';
    if (typeof QRCode !== 'undefined') {
      QRCode.toCanvas(document.getElementById('qrCanvas'), url, { width: 200, margin: 2 }, err => {
        if (err) console.error(err);
      });
    } else {
      wrap.innerHTML = '<div style="color:var(--err)">QR 라이브러리 로딩 실패</div>';
    }
  }
  openModal('qrModal');
};

window.downloadQR = function() {
  const canvas = document.getElementById('qrCanvas');
  if (!canvas) return;
  const link = document.createElement('a');
  link.download = `QR_${S.selectedSN || 'unknown'}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  toast('QR 다운로드 완료', 'success');
};

window.toggleMiniChat = function() {
  S.set('miniChatOpen', !S.miniChatOpen);
  const win = document.getElementById('miniChatWin');
  if (win) win.style.display = S.miniChatOpen ? 'flex' : 'none';
};

// internal alias used in closeSidePanel call sites before window registration
function closeSidePanel() { window.closeSidePanel(); }
function openSidePanel(sn) { window.openSidePanel(sn); }

// ===================================================
// 모달 / 보고서 / 납기 역산 / 위젯 설정
// ===================================================
function todayStr() { return new Date().toISOString().slice(0, 10); }

window.openReportModal = function() {
  const today = todayStr();
  const total = Object.keys(S.DATA).length;
  const counts = { '대기': 0, '진행': 0, '완료': 0, '지연': 0, '폐기': 0 };
  Object.values(S.DATA).forEach(d => { const s = d.status || '대기'; if (counts[s] !== undefined) counts[s]++; });
  let todayItems = [];
  Object.entries(S.DATA).forEach(([sn, d]) => {
    getRoute(sn, d).forEach(proc => {
      const p = getProc(d, proc);
      if (fD(p.planStart) === today || fD(p.actualStart) === today || fD(p.actualEnd) === today) {
        todayItems.push(`${sn} / ${proc} / ${p.status || '대기'}`);
      }
    });
  });
  const content = `
    <h3>📊 일일 생산 보고서</h3>
    <p><strong>날짜:</strong> ${fmt(today)}</p>
    <p><strong>전체 LOT:</strong> ${total}건</p>
    <p>대기: ${counts['대기']} | 진행: ${counts['진행']} | 완료: ${counts['완료']} | 지연: ${counts['지연']} | 폐기: ${counts['폐기']}</p>
    <h4>오늘 작업 내역 (${todayItems.length}건)</h4>
    ${todayItems.length ? todayItems.map(i => `<p style="font-size:12px">• ${esc(i)}</p>`).join('') : '<p style="font-size:12px;color:var(--t2)">오늘 작업 내역 없음</p>'}
    <h4>지연 현황 (${counts['지연']}건)</h4>
    ${Object.entries(S.DATA).filter(([, d]) => (d.status || '대기') === '지연').map(([sn]) => `<p style="font-size:12px">⚠️ ${esc(sn)}</p>`).join('') || '<p style="font-size:12px;color:var(--t2)">지연 없음</p>'}
  `;
  const rc = document.getElementById('reportContent');
  if (rc) rc.innerHTML = content;
  openModal('reportModal');
};

window.copyReport = function() {
  const el = document.getElementById('reportContent');
  if (el) navigator.clipboard.writeText(el.innerText)
    .then(() => toast('보고서 복사됨', 'success')).catch(() => toast('복사 실패', 'error'));
};

window.openDeadlineCalc = function() {
  populateProductSelects();
  openModal('deadlineModal');
};

window.calcDeadline = function() {
  const prodId = document.getElementById('dl_prod')?.value;
  const dueDate = document.getElementById('dl_due')?.value;
  const result = document.getElementById('dl_result');
  const snBtn = document.getElementById('dl_snBtn');
  if (!prodId || !dueDate) { if (result) result.innerHTML = ''; if (snBtn) snBtn.style.display = 'none'; return; }
  const prod = S.PRODUCTS[prodId];
  if (!prod) { if (result) result.innerHTML = '<div style="color:var(--err)">제품 정보 없음</div>'; return; }
  const cat = prod.category || 'WN';
  const heat = prod.heat || 'N';
  const route = buildRoute(cat, heat);
  let html = '<div class="card" style="margin:0"><div class="card-title">역산 결과</div>';
  html += '<table class="table"><thead><tr><th>공정</th><th>소요일</th><th>시작일</th><th>종료일</th></tr></thead><tbody>';
  let cursor = dueDate;
  let schedule = [];
  for (let i = route.length - 1; i >= 0; i--) {
    const proc = route[i];
    const days = getDefaultDays(proc, cat);
    const end = cursor;
    const start = addBD(end, -days) || end;
    schedule.unshift({ proc, days, start, end });
    cursor = start;
  }
  schedule.forEach(s => {
    html += `<tr><td><span style="color:${PROC_COLORS[s.proc] || '#666'};font-weight:600">${esc(s.proc)}</span></td><td>${s.days}일</td><td>${fmt(s.start)}</td><td>${fmt(s.end)}</td></tr>`;
  });
  html += `</tbody></table><div style="margin-top:8px;font-size:13px;font-weight:600">👉 투입 시작일: <span style="color:var(--ac2)">${fmt(schedule[0]?.start)}</span></div></div>`;
  if (result) result.innerHTML = html;
  if (snBtn) { snBtn.style.display = 'inline-flex'; snBtn.dataset.prod = prodId; snBtn.dataset.start = schedule[0]?.start || ''; }
};

window.deadlineToSN = function() {
  const btn = document.getElementById('dl_snBtn');
  closeModal('deadlineModal');
  window.openSNModal();
  setTimeout(() => {
    const sp = document.getElementById('sn_prod');
    const ss = document.getElementById('sn_start');
    if (sp) sp.value = btn?.dataset.prod || '';
    if (ss) ss.value = btn?.dataset.start || '';
    if (window.onSNProdChange) window.onSNProdChange();
    if (window.updateSNPreview) window.updateSNPreview();
  }, 100);
};

window.openWidgetSettings = function() {
  const widgets = getWidgets();
  const list = document.getElementById('widgetSettingsList');
  if (!list) return;
  list.innerHTML = widgets.map((w, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
      <input type="checkbox" ${w.enabled ? 'checked' : ''} onchange="window.widgetToggle(${i},this.checked)">
      <span style="flex:1;font-size:13px">${esc(w.name)}</span>
      <button class="btn btn-secondary btn-sm" onclick="window.widgetMove(${i},-1)" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button class="btn btn-secondary btn-sm" onclick="window.widgetMove(${i},1)" ${i === widgets.length - 1 ? 'disabled' : ''}>↓</button>
    </div>
  `).join('');
  openModal('widgetModal');
};

window.widgetToggle = function(idx, checked) {
  const w = getWidgets(); w[idx].enabled = checked; saveWidgets(w);
};

window.widgetMove = function(idx, dir) {
  const w = getWidgets(); const target = idx + dir;
  if (target < 0 || target >= w.length) return;
  [w[idx], w[target]] = [w[target], w[idx]];
  saveWidgets(w);
  window.openWidgetSettings();
};

window.saveWidgetConfig = function() {
  closeModal('widgetModal'); renderHome(); toast('위젯 설정 저장됨', 'success');
};

window.resetWidgetConfig = function() {
  S.set('widgetCache', null); localStorage.removeItem('esc_widgets');
  window.openWidgetSettings(); toast('기본값 복원', 'info');
};

// ===================================================
// S/N 생성 모달
// ===================================================
window.openSNModal = function() {
  populateProductSelects();
  const startEl = document.getElementById('sn_start');
  if (startEl) startEl.value = todayStr();
  const batches = new Set();
  Object.values(S.DATA).forEach(d => { if (d.batch) batches.add(d.batch); });
  const list = document.getElementById('batchList');
  if (list) list.innerHTML = [...batches].map(b => `<option value="${esc(b)}">`).join('');
  openModal('snModal');
};

window.autoBatchCode = function() {
  const now = new Date();
  const code = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 900) + 100)}`;
  const el = document.getElementById('sn_batch');
  if (el) el.value = code;
  if (window.updateSNPreview) window.updateSNPreview();
};

window.onSNProdChange = function() {
  const prodId = document.getElementById('sn_prod')?.value;
  const prod = S.PRODUCTS[prodId];
  if (!prod) return;
  const cat = prod.category || 'WN';
  const equipSel = document.getElementById('sn_equip');
  if (equipSel) {
    const eqList = getEquipList(PROC_ORDER[0], cat);
    equipSel.innerHTML = '<option value="">선택...</option>' + eqList.map(eq => `<option value="${esc(eq)}">${esc(eq)}</option>`).join('');
  }
  const hint = document.getElementById('sn_seqHint');
  if (hint) {
    const existing = Object.keys(S.DATA).filter(sn => sn.toUpperCase().startsWith(cat.toUpperCase()));
    hint.textContent = `현재 ${cat} 시리즈: ${existing.length}건`;
  }
  if (window.updateSNPreview) window.updateSNPreview();
};

window.onSheetNoChange = function() { if (window.updateSNPreview) window.updateSNPreview(); };

window.updateSNPreview = function() {
  const sheet = document.getElementById('sn_sheet')?.value.trim() || '';
  const prodId = document.getElementById('sn_prod')?.value || '';
  const qty = parseInt(document.getElementById('sn_qty')?.value) || 1;
  const seq = parseInt(document.getElementById('sn_seq')?.value) || 1;
  const prod = S.PRODUCTS[prodId];
  const preview = document.getElementById('sn_preview');
  if (!preview) return;
  if (!prod || !sheet) { preview.textContent = '제품과 시트번호를 입력하세요'; return; }
  const cat = prod.category || 'WN';
  const name = (prod.name || '').replace(/\s/g, '');
  let items = [];
  for (let i = 0; i < Math.min(qty, 50); i++) {
    const num = String(seq + i).padStart(3, '0');
    items.push(`${cat}${sheet}-${num}-${name}`);
  }
  preview.innerHTML = items.map(s => `<div>${esc(s)}</div>`).join('');
};

window.saveSNBatch = async function() {
  const batch = document.getElementById('sn_batch')?.value.trim() || '';
  const sheet = document.getElementById('sn_sheet')?.value.trim() || '';
  const prodId = document.getElementById('sn_prod')?.value || '';
  const qty = parseInt(document.getElementById('sn_qty')?.value) || 1;
  const seq = parseInt(document.getElementById('sn_seq')?.value) || 1;
  const startDate = document.getElementById('sn_start')?.value || '';
  const equip = document.getElementById('sn_equip')?.value || '';
  const prod = S.PRODUCTS[prodId];
  if (!prod || !sheet || !batch) { toast('필수 항목을 입력하세요', 'warn'); return; }
  if (!startDate) { toast('시작일을 입력하세요', 'warn'); return; }
  const cat = prod.category || 'WN';
  const heat = prod.heat || 'N';
  const route = buildRoute(cat, heat);
  const name = (prod.name || '').replace(/\s/g, '');
  try {
    const wb = FB.writeBatch(firebaseDb);
    for (let i = 0; i < qty; i++) {
      const num = String(seq + i).padStart(3, '0');
      const sn = `${cat}${sheet}-${num}-${name}`;
      const processes = {};
      let cursor = startDate;
      route.forEach((proc, idx) => {
        const days = getDefaultDays(proc, cat);
        const end = addBD(cursor, days);
        processes[proc] = {
          status: idx === 0 ? '진행' : '대기',
          planStart: cursor, planEnd: end, planDays: days,
          actualStart: idx === 0 ? cursor : '', actualEnd: '', actualDays: 0,
          equip: idx === 0 ? equip : '', defect: '', remark: ''
        };
        cursor = end;
      });
      const ref = FB.doc(firebaseDb, 'production', sn);
      wb.set(ref, {
        sn, productName: prod.name, category: cat, customer: prod.customer || '',
        batch, route, processes, startDate, endDate: cursor,
        status: '진행', currentProcess: route[0], createdAt: todayStr(), heat
      });
    }
    await wb.commit();
    toast(`${qty}건 S/N 생성 완료`, 'success');
    closeModal('snModal');
  } catch (err) { handleFirestoreError(err, 'S/N 생성'); }
};

// ===================================================
// 이슈 등록 모달
// ===================================================
window.openIssueModal = function(sn) {
  const dateEl = document.getElementById('is_date');
  const snEl = document.getElementById('is_sn');
  const contentEl = document.getElementById('is_content');
  if (dateEl) dateEl.value = todayStr();
  if (snEl) snEl.value = sn || '';
  if (contentEl) contentEl.value = '';
  populateProductSelects();
  openModal('issueModal');
};

window.saveIssue = async function() {
  const date = document.getElementById('is_date')?.value || todayStr();
  const type = document.getElementById('is_type')?.value || '기타';
  const sn = document.getElementById('is_sn')?.value.trim() || '';
  const content = document.getElementById('is_content')?.value.trim() || '';
  if (!content) { toast('이슈 내용을 입력하세요', 'warn'); return; }
  try {
    const id = `ISS-${Date.now()}`;
    const ref = FB.doc(firebaseDb, 'issues', id);
    await FB.setDoc(ref, { date, type, sn, content, createdAt: todayStr(), createdBy: S.currentUser?.email || '' });
    toast('이슈 등록 완료', 'success');
    closeModal('issueModal');
  } catch (err) { handleFirestoreError(err, '이슈 등록'); }
};

// ===================================================
// 제품 등록 모달
// ===================================================
window.openProductModal = function() {
  window.showProductList();
  openModal('productModal');
};

window.showProductList = function() {
  const listView = document.getElementById('pm_listView');
  const formView = document.getElementById('pm_formView');
  if (listView) listView.style.display = 'block';
  if (formView) formView.style.display = 'none';
  const countEl = document.getElementById('pm_count');
  if (countEl) countEl.textContent = Object.keys(S.PRODUCTS).length;
  const listEl = document.getElementById('pm_productList');
  if (!listEl) return;
  const prods = Object.values(S.PRODUCTS);
  if (!prods.length) { listEl.innerHTML = '<div style="color:var(--t2);font-size:12px;padding:12px">등록된 제품이 없습니다</div>'; return; }
  listEl.innerHTML = prods.map(p => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--border);font-size:13px">
      <span style="flex:1"><strong>${esc(p.name)}</strong> <span style="color:var(--t2);font-size:11px">${esc(p.category || '')} | ${esc(p.customer || '-')}</span></span>
      <button class="btn btn-secondary btn-sm" onclick="window.editProduct('${esc(p.name)}')">편집</button>
    </div>`).join('');
};

window.showProductForm = function() {
  const listView = document.getElementById('pm_listView');
  const formView = document.getElementById('pm_formView');
  if (listView) listView.style.display = 'none';
  if (formView) formView.style.display = 'block';
  const editMode = document.getElementById('pm_editMode');
  if (editMode) editMode.value = '';
  const nameEl = document.getElementById('pm_name');
  if (nameEl) { nameEl.value = ''; nameEl.disabled = false; }
  window.previewRoute && window.previewRoute();
};

window.editProduct = function(name) {
  const prod = S.PRODUCTS[name];
  if (!prod) return;
  const listView = document.getElementById('pm_listView');
  const formView = document.getElementById('pm_formView');
  if (listView) listView.style.display = 'none';
  if (formView) formView.style.display = 'block';
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  setVal('pm_editMode', 'edit');
  setVal('pm_origName', name);
  setVal('pm_name', prod.name || '');
  setVal('pm_cat', prod.category || 'WN');
  setVal('pm_heat', prod.heat || 'N');
  setVal('pm_drawing', prod.drawing || '');
  setVal('pm_shrink', prod.shrink || '0');
  setVal('pm_stack', prod.stack || '0');
  setVal('pm_joint', prod.joint || '');
  const nameEl = document.getElementById('pm_name');
  if (nameEl) nameEl.disabled = true;
  const saveBtn = document.getElementById('pm_saveBtn');
  if (saveBtn) saveBtn.textContent = '수정';
  window.previewRoute && window.previewRoute();
};

window.previewRoute = function() {
  const cat = document.getElementById('pm_cat')?.value || 'WN';
  const heat = document.getElementById('pm_heat')?.value || 'N';
  const route = buildRoute(cat, heat);
  const el = document.getElementById('pm_routePreview');
  if (el) el.textContent = route.join(' → ');
};

window.saveProduct = async function() {
  const name = document.getElementById('pm_name')?.value.trim() || '';
  const cat = document.getElementById('pm_cat')?.value || 'WN';
  if (!name) { toast('제품명을 입력하세요', 'warn'); return; }
  const drawing = document.getElementById('pm_drawing')?.value.trim() || '';
  const shrink = parseFloat(document.getElementById('pm_shrink')?.value) || 0;
  const stack = parseInt(document.getElementById('pm_stack')?.value) || 0;
  const joint = document.getElementById('pm_joint')?.value || '';
  const heat = document.getElementById('pm_heat')?.value || 'N';
  const route = buildRoute(cat, heat);
  try {
    const ref = FB.doc(firebaseDb, 'products', name);
    await FB.setDoc(ref, { name, category: cat, drawing, shrink, stack, joint, heat, route, createdAt: todayStr() });
    toast(`제품 "${name}" 등록 완료`, 'success');
    const snap = await FB.getDocs(FB.collection(firebaseDb, 'products'));
    const newProds = {};
    snap.forEach(d => { newProds[d.id] = d.data(); });
    S.set('PRODUCTS', newProds);
    populateProductSelects();
    window.showProductList();
  } catch (err) { handleFirestoreError(err, '제품 등록'); }
};

// ===================================================
// 일괄 적용 (배치바)
// ===================================================
window.applyBatchAll = async function() {
  const proc = document.getElementById('batchProcSel')?.value;
  const equip = document.getElementById('batchEquipSel')?.value;
  const startDate = document.getElementById('batchStartDate')?.value;
  const endDate = document.getElementById('batchEndDate')?.value;
  if (!S.wsSelection.size) { toast('선택된 항목이 없습니다', 'warn'); return; }
  try {
    const wb = FB.writeBatch(firebaseDb);
    S.wsSelection.forEach(sn => {
      const ref = FB.doc(firebaseDb, 'production', sn);
      const updates = {};
      if (proc) updates.currentProcess = proc;
      if (equip && proc) updates[`processes.${proc}.equip`] = equip;
      if (startDate && proc) updates[`processes.${proc}.planStart`] = startDate;
      if (endDate && proc) updates[`processes.${proc}.planEnd`] = endDate;
      if (Object.keys(updates).length) wb.update(ref, updates);
    });
    await wb.commit();
    toast(`${S.wsSelection.size}건 일괄 적용 완료`, 'success');
    S.wsSelection.clear();
  } catch (err) { handleFirestoreError(err, '일괄 적용'); }
};

window.checkEquipConflict = function() {
  const equip = document.getElementById('sn_equip')?.value || '';
  const startDate = document.getElementById('sn_start')?.value || '';
  const warn = document.getElementById('equipConflictWarn');
  if (!warn) return;
  if (!equip || !startDate) { warn.innerHTML = ''; return; }
  const conflicts = Object.entries(S.DATA).filter(([sn, d]) =>
    getRoute(sn, d).some(proc => {
      const p = getProc(d, proc);
      if (p.equip !== equip || p.status === '완료') return false;
      const ps = fD(p.planStart || p.actualStart);
      const pe = fD(p.planEnd);
      return ps && pe && startDate >= ps && startDate <= pe;
    })
  );
  warn.innerHTML = conflicts.length
    ? `<div style="font-size:11px;color:var(--warn);margin-top:3px">⚠️ ${equip}이(가) ${conflicts.length}건과 일정 겹침</div>`
    : '';
};

window.loadIssueSNList = function() {
  const prodId = document.getElementById('is_prod')?.value || '';
  const list = document.getElementById('issueSNList');
  if (!list) return;
  const prod = S.PRODUCTS[prodId];
  if (!prod) { list.innerHTML = ''; return; }
  const matching = Object.keys(S.DATA).filter(sn => {
    const d = S.DATA[sn];
    return d.productName === prod.name || extractCategory(sn) === (prod.category || '');
  });
  list.innerHTML = matching.map(sn => `<option value="${esc(sn)}">`).join('');
};

// ===================================================
// 내보내기
// ===================================================
window.exportExcel = function() {
  if (typeof XLSX === 'undefined') { toast('SheetJS 로딩 중...', 'warn'); return; }
  const rows = [];
  Object.entries(S.DATA).forEach(([sn, d]) => {
    const route = getRoute(sn, d);
    const row = {
      'S/N': sn, '제품': d.productName || '', '카테고리': extractCategory(sn),
      '상태': d.status || '대기', '현재공정': d.currentProcess || '',
      '시작일': fD(d.startDate), '납기': fD(d.endDate),
      '진행률': calcProgress(d, sn) + '%', '배치': d.batch || d.batchId || ''
    };
    route.forEach(proc => {
      const p = getProc(d, proc);
      row[`${proc}_상태`] = p.status || '';
      row[`${proc}_설비`] = p.equip || '';
      row[`${proc}_시작`] = fD(p.planStart || p.actualStart);
      row[`${proc}_종료`] = fD(p.actualEnd || p.planEnd);
      row[`${proc}_불량`] = p.defect || '';
    });
    rows.push(row);
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '생산데이터');
  if (S.ISSUES.length) {
    const issueRows = S.ISSUES.map(i => ({ '날짜': fD(i.date), '유형': i.type || '', 'SN': i.sn || '', '내용': i.content || '' }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(issueRows), '이슈');
  }
  XLSX.writeFile(wb, `ESC_생산데이터_${todayStr()}.xlsx`);
  toast('엑셀 내보내기 완료', 'success');
};

window.exportJSON = function() {
  const data = { production: S.DATA, products: S.PRODUCTS, issues: S.ISSUES, exportDate: todayStr(), version: 'v10.1' };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.download = `ESC_backup_${todayStr()}.json`;
  a.href = URL.createObjectURL(blob);
  a.click();
  toast('JSON 백업 완료', 'success');
};

// === etc...
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSidePanel();
    closeAllDropdowns();
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(el => el.classList.add('hidden'));
  }
  if (e.ctrlKey && e.key === 'k') {
    e.preventDefault();
    if (S.currentTab === 'workspace') document.getElementById('wsSearch')?.focus();
  }
});

document.addEventListener('pointerdown', (e) => {
  const panel = document.getElementById('sidePanel');
  if (panel && panel.classList.contains('open') && !panel.contains(e.target)) {
    if (!e.target.closest('.sn-cell')) closeSidePanel();
  }
});

// ===================================================
// 전역 등록 (gantt.js 등 CDN 방식 스크립트용)
// ===================================================
window.getRoute = getRoute;
window.getProc = getProc;
window.fD = fD;
window.esc = esc;
window.EQ_MAP = EQ_MAP;
window.extractCategory = extractCategory;
window.extractBatchFromSN = extractBatchFromSN;
window.calcProgress = calcProgress;
window.getEquipList = getEquipList;
window.openModal = openModal;
window.closeModal = closeModal;
window.fmt = fmt;
window.getFiltered = function() {
  const fProd = document.getElementById('ganttProdFilter')?.value || '';
  const fStatus = document.getElementById('ganttStatusFilter')?.value || '';
  if (!fProd && !fStatus) return S.DATA;
  const result = {};
  Object.entries(S.DATA).forEach(([sn, d]) => {
    if (fProd && (d.productName || '') !== fProd) return;
    if (fStatus && (d.status || '대기') !== fStatus) return;
    result[sn] = d;
  });
  return result;
};
window.S = S;
