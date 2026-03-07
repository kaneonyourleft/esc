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
  const { initializeApp } = await import(FB_CDN + 'firebase-app.js');
  const { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } = await import(FB_CDN + 'firebase-auth.js');
  const { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, where, writeBatch, Timestamp, serverTimestamp } = await import(FB_CDN + 'firebase-firestore.js');

  firebaseApp = initializeApp(firebaseConfig);
  firebaseAuth = getAuth(firebaseApp);
  firebaseDb = getFirestore(firebaseApp);

  FB = {
    collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
    onSnapshot, query, orderBy, where, writeBatch, Timestamp, serverTimestamp,
    GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
  };

  setupAuth();
}

initFirebase().catch(e => console.error('Firebase init error:', e));

// === 전역 상태 ===
let DATA = {};           // production 데이터
let PRODUCTS = {};       // 제품 마스터
let ISSUES = [];         // 이슈 목록
let currentUser = null;
let currentTab = 'home';
let selectedSN = null;   // 사이드패널 선택 SN
let sidebarCollapsed = false;
let isDarkMode = true;
let calDate = new Date();
let calViewMode = 'month';
let ganttViewMode = 'product';
let ganttDayWidth = 30;
let ganttGroupState = {};
let wsViewMode = localStorage.getItem('wsViewMode') || 'product';
let wsFilter = '전체';
let wsGroupState = {};
let wsSelection = new Set();
let wsAllExpanded = false;
let ganttAllExpanded = false;
let miniChatOpen = false;
let widgetCache = null;
let scheduleRenderRAF = null;
let unsubProduction = null;
let unsubIssues = null;

// === 상수 ===
const PROC_ORDER = ['탈지', '소성', '환원소성', '평탄화', '도금', '열처리'];

const PROC_COLORS = {
  '탈지': '#06b6d4',
  '소성': '#f97316',
  '환원소성': '#a855f7',
  '평탄화': '#10b981',
  '도금': '#eab308',
  '열처리': '#ef4444'
};

const EQ_MAP = {
  '탈지': ['1호기', '2호기', '3호기'],
  '소성': ['1호기', '4호기', '5호기', '10호기', '11호기', '12호기', '13호기', '14호기', '15호기', '16호기', '17호기', '18호기'],
  '환원소성': ['2호기'],
  '평탄화': ['3호기', '6호기', '7호기', '8호기', '9호기'],
  '도금': ['외주'],
  '열처리': ['GB']
};

const DEFAULT_WIDGETS = [
  { id: 'kpi', name: 'KPI 요약', enabled: true },
  { id: 'pipeline', name: '공정 파이프라인', enabled: true },
  { id: 'today', name: '오늘의 작업', enabled: true },
  { id: 'alerts', name: '알림/지연', enabled: true },
  { id: 'chart_donut', name: '상태 분포 차트', enabled: true },
  { id: 'chart_weekly', name: '주간 트렌드', enabled: true },
  { id: 'recent', name: '최근 활동', enabled: true }
];

// === 유틸리티 함수 ===
const esc = (str) => str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '';

const todayStr = () => new Date().toISOString().split('T')[0];

function fD(val, fallback = '') {
  if (!val) return fallback;
  if (typeof val === 'object' && typeof val.toDate === 'function') {
    try { return val.toDate().toISOString().split('T')[0]; } catch { return fallback; }
  }
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? fallback : val.toISOString().split('T')[0];
  }
  if (typeof val === 'object' && typeof val.seconds === 'number') {
    try { return new Date(val.seconds * 1000).toISOString().split('T')[0]; } catch { return fallback; }
  }
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
    const d = new Date(val);
    return isNaN(d.getTime()) ? fallback : d.toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    try { return new Date(val).toISOString().split('T')[0]; } catch { return fallback; }
  }
  return fallback;
}

const fmt = (val) => {
  const d = fD(val);
  if (!d || d === '-') return '-';
  const p = d.split('-');
  return p.length === 3 ? `${p[0]}.${p[1]}.${p[2]}` : '-';
};

function getProc(item, procName) {
  const blank = {
    status: '대기', planStart: '', planEnd: '', actualStart: '', actualEnd: '',
    planDays: 0, actualDays: 0, equip: '', defect: '', remark: ''
  };
  if (!item || !item.processes || typeof item.processes !== 'object') return { ...blank };
  return item.processes[procName] || { ...blank };
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function addBD(startDate, days) {
  if (!startDate || !days) return '';
  let d = new Date(startDate + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  const dir = days > 0 ? 1 : -1;
  let count = 0;
  const abs = Math.abs(days);
  while (count < abs) {
    d.setDate(d.getDate() + dir);
    if (!isWeekend(d)) count++;
  }
  return d.toISOString().split('T')[0];
}

function diffBD(start, end) {
  if (!start || !end) return 0;
  let s = new Date(start + 'T00:00:00');
  let e = new Date(end + 'T00:00:00');
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return 0;
  let count = 0;
  let cur = new Date(s);
  while (cur < e) {
    cur.setDate(cur.getDate() + 1);
    if (!isWeekend(cur)) count++;
  }
  return count;
}

  function getDefaultDays(proc, category, stackQty) {
    // VBA 기준 공정별 소요일
    switch (proc) {
      case "탈지":     return 6;
      case "소성":     return (stackQty >= 9) ? 5 : 3;
      case "환원소성": return 3;  // BL 전용
      case "평탄화":   return 3;
      case "도금":     return 1;
      case "열처리":   return 1;
      default:         return 3;
    }
  }

  function buildRoute(category, heat, dcJoint) {
    // VBA BuildRoute 기준 공정 경로
    const cat = (category || "").toUpperCase();
    const h = (heat || "N").toUpperCase();
    const dc = (dcJoint || "").toUpperCase();
    const route = ["탈지", "소성"];
    if (cat === "BL") route.push("환원소성");
    route.push("평탄화");
    if (dc !== "BRAZING") route.push("도금");
    if (h === "Y") route.push("열처리");
    return route;
  }

  // VBA 기준 소성기 필터: BL→1·4호기, WN→5~18호기
  // VBA GetEquipListForProc 기준
  function getAvailableFurnaces(category) {
    const all = EQ_MAP["소성"] || [];
    if (category === "BL") return all.filter(e => e === "1호기" || e === "4호기");
    // WN: 5,10~18호기
    return all.filter(e => e !== "1호기" && e !== "4호기");
  }

function extractCategory(sn) {
  if (!sn) return '';
  const upper = String(sn).toUpperCase();
  if (upper.startsWith('WN')) return 'WN';
  if (upper.startsWith('BL')) return 'BL';
  if (upper.startsWith('HP')) return 'HP';
  return '';
}

function extractBatchFromSN(sn) {
  if (!sn) return '';
  const match = String(sn).match(/^([A-Z]{2}\d{4})/i);
  return match ? match[1] : '';
}

function getRoute(sn, item) {
  if (item && Array.isArray(item.route) && item.route.length > 0) return item.route;
  if (item && typeof item.route === 'string' && item.route.includes('→')) {
    const parts = item.route.split('→').map(s => s.trim()).filter(Boolean);
    if (parts.length) return parts;
  }
  const cat = extractCategory(sn) || (item && item.category ? item.category : '');
  const heat = item && item.heat ? item.heat : 'N';
  return buildRoute(cat, heat, item && item.dcJoint ? item.dcJoint : "");
}

  // VBA GetEquipListForProc 완전 반영
  function getEquipList(proc, category) {
    const cat = (category || "").toUpperCase();
    switch (proc) {
      case "탈지": return ["1호기", "2호기", "3호기"];
      case "소성":
        if (cat === "BL") return ["1호기", "4호기"];
        return ["5호기", "10호기", "11호기", "12호기", "13호기", "14호기", "15호기", "16호기", "17호기", "18호기"];
      case "환원소성":
        if (cat === "BL") return ["2호기"];
        return [];
      case "평탄화":
        if (cat === "BL") return ["3호기"];
        return ["6호기", "7호기", "8호기", "9호기"];
      case "도금": return ["외주"];
      case "열처리": return ["GB"];
      default: return EQ_MAP[proc] || [];
    }
  }

function calcProgress(item, sn) {
  const route = getRoute(sn, item);
  if (!route.length) return 0;
  let done = 0;
  route.forEach(proc => {
    if (getProc(item, proc).status === '완료') done++;
  });
  return Math.round(done / route.length * 100);
}

function statusBadge(status) {
  const cls = {
    '대기': 'badge-wait', '진행': 'badge-prog', '완료': 'badge-done',
    '지연': 'badge-delay', '폐기': 'badge-ng'
  };
  return `<span class="badge ${cls[status] || 'badge-wait'}">${esc(status || '대기')}</span>`;
}

function toast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.innerHTML = msg;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

window.openModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
};

window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
};

document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay') && !e.target.classList.contains('hidden')) {
    e.target.classList.add('hidden');
  }
});

function mdToHtml(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function handleFirestoreError(err, context = '') {
  const code = err?.code || '';
  const prefix = context ? `[${context}] ` : '';
  let msg;
  switch (code) {
    case 'permission-denied':
    case 'PERMISSION_DENIED':
      msg = `${prefix}권한이 없습니다. 로그인 상태를 확인하세요.`; break;
    case 'not-found':
      msg = `${prefix}문서를 찾을 수 없습니다. 새로고침 해주세요.`; break;
    case 'unavailable':
    case 'deadline-exceeded':
      msg = `${prefix}서버 연결 실패. 네트워크를 확인하세요.`; break;
    case 'resource-exhausted':
      msg = `${prefix}요청 한도 초과. 잠시 후 다시 시도하세요.`; break;
    case 'unauthenticated':
      msg = `${prefix}인증 만료. 다시 로그인하세요.`;
      setTimeout(() => { if (typeof doLogout === 'function') doLogout(); }, 3000);
      break;
    case 'already-exists':
      msg = `${prefix}이미 존재하는 데이터입니다.`; break;
    default:
      msg = `${prefix}저장 실패: ${err?.message || '알 수 없는 오류'}`;
  }
  console.error(`[Firestore Error] ${code}:`, err);
  toast(msg, 'error');
}

function positionDropdown(dropdown, anchor) {
  if (!dropdown || !anchor) return;
  const rect = anchor.getBoundingClientRect();
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  dropdown.style.position = 'fixed';
  dropdown.style.left = rect.left + 'px';
  dropdown.style.top = (rect.bottom + 4) + 'px';
  requestAnimationFrame(() => {
    const ddRect = dropdown.getBoundingClientRect();
    if (ddRect.bottom > winH - 10) dropdown.style.top = (rect.top - ddRect.height - 4) + 'px';
    if (ddRect.right > winW - 10) dropdown.style.left = (winW - ddRect.width - 10) + 'px';
    if (parseFloat(dropdown.style.left) < 10) dropdown.style.left = '10px';
  });
}

function handleEmptyChart(canvas, data, msg = '데이터가 없습니다') {
  if (!canvas) return true;
  const isEmpty = !data || (Array.isArray(data) && data.length === 0) ||
    (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0);
  if (!isEmpty && typeof data === 'number' && data > 0) return false;
  if (!isEmpty && typeof data === 'object' && !Array.isArray(data) &&
    Object.values(data).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0) > 0) return false;
  if (!isEmpty && !Array.isArray(data)) return false;

  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.parentElement ? canvas.parentElement.clientWidth - 32 : 300;
  const h = canvas.height = 240;
  ctx.clearRect(0, 0, w, h);
  const dark = !document.body.classList.contains('light-mode');
  ctx.fillStyle = dark ? '#666' : '#999';
  ctx.font = '14px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(msg, w / 2, h / 2);
  return true;
}

function scheduleRender() {
  if (scheduleRenderRAF) return;
  scheduleRenderRAF = requestAnimationFrame(() => {
    scheduleRenderRAF = null;
    renderWorkspace();
  });
}

function refreshSidePanel() {
  if (!selectedSN) return;
  if (!DATA[selectedSN]) { closeSidePanel(); return; }
  const panel = document.getElementById('sidePanel');
  if (panel && panel.classList.contains('open')) openSidePanel(selectedSN);
}

function onDataChanged() {
  switch (currentTab) {
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
  if (widgetCache) return widgetCache;
  try {
    const saved = localStorage.getItem('esc_widgets');
    if (saved) return widgetCache = JSON.parse(saved);
  } catch {}
  return widgetCache = JSON.parse(JSON.stringify(DEFAULT_WIDGETS));
}

function saveWidgets(list) {
  widgetCache = list;
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
    currentUser = user;
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
  if (unsubProduction) unsubProduction();
  if (unsubIssues) unsubIssues();

  const prodCol = FB.collection(firebaseDb, 'production');
  unsubProduction = FB.onSnapshot(prodCol, (snap) => {
    DATA = {};
    snap.forEach(d => { DATA[d.id] = d.data(); });
    console.log(`📋 production: ${Object.keys(DATA).length} records`);
    onDataChanged();
    updateDataStats();
  }, (err) => { handleFirestoreError(err, '데이터 로드'); });

  const prodMaster = FB.collection(firebaseDb, 'products');
  FB.getDocs(prodMaster).then(snap => {
    PRODUCTS = {};
    snap.forEach(d => { PRODUCTS[d.id] = d.data(); });
    console.log(`📦 products: ${Object.keys(PRODUCTS).length} items`);
    populateProductSelects();
  }).catch(e => handleFirestoreError(e, '제품 로드'));

  const issueCol = FB.collection(firebaseDb, 'issues');
  unsubIssues = FB.onSnapshot(FB.query(issueCol, FB.orderBy('date', 'desc')), (snap) => {
    ISSUES = [];
    snap.forEach(d => { ISSUES.push({ id: d.id, ...d.data() }); });
    console.log(`🚨 issues: ${ISSUES.length} items`);
    if (currentTab === 'calendar') renderCalendar();
  }, (err) => { handleFirestoreError(err, '이슈 로드'); });
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
      Object.entries(PRODUCTS).map(([k, v]) =>
        `<option value="${esc(k)}">${esc(v.name || k)} (${esc(v.category || '')})</option>`
      ).join('');
    sel.innerHTML = opts;
    if (prev) sel.value = prev;
  });
}

function updateDataStats() {
  const el = document.getElementById('dataStats');
  if (!el) return;
  const total = Object.keys(DATA).length;
  const counts = { '대기': 0, '진행': 0, '완료': 0, '지연': 0, '폐기': 0 };
  Object.values(DATA).forEach(d => {
    const s = d.status || '대기';
    if (counts[s] !== undefined) counts[s]++;
  });
  el.innerHTML = `
    <div class="stat-item"><div class="stat-val">${total}</div><div class="stat-lbl">전체 LOT</div></div>
    <div class="stat-item"><div class="stat-val">${counts['진행']}</div><div class="stat-lbl">진행중</div></div>
    <div class="stat-item"><div class="stat-val">${counts['완료']}</div><div class="stat-lbl">완료</div></div>
    <div class="stat-item"><div class="stat-val">${counts['지연']}</div><div class="stat-lbl">지연</div></div>
  `;
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
  currentTab = tab;
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
    sidebarCollapsed = true;
    document.getElementById('sidebar').classList.add('collapsed');
  }
};

function renderCurrentTab() {
  switch (currentTab) {
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
  sidebarCollapsed = !sidebarCollapsed;
  document.getElementById('sidebar').classList.toggle('collapsed', sidebarCollapsed);
};

function applyTheme() {
  document.body.classList.toggle('light-mode', !isDarkMode);
  const toggle = document.getElementById('themeToggle');
  if (toggle) toggle.classList.toggle('active', !isDarkMode);
}

window.toggleTheme = function() {
  isDarkMode = !isDarkMode;
  localStorage.setItem('esc_theme', isDarkMode ? 'dark' : 'light');
  applyTheme();
};

(function() {
  if (localStorage.getItem('esc_theme') === 'light') isDarkMode = false;
})();

// === 홈 탭 ===
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

window.toggleFilter = function(f) { renderWorkspace(); };





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

function updateFilterOptions() {
  const prodSet = new Set(), batchSet = new Set(), equipSet = new Set(), procSet = new Set();
  Object.entries(DATA).forEach(([sn, d]) => {
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
  const filtered = Object.entries(DATA).filter(([sn, d]) => {
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
    if (wsViewMode === 'batch') {
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
  groupKeys.forEach(k => { if (wsGroupState[k] === undefined) wsGroupState[k] = true; });

  let html = '';
  groupKeys.forEach(key => {
    const subGroups = groups[key];
    const allItems = Object.values(subGroups).flat();
    const collapsed = wsGroupState[key];
    const doneCount = allItems.filter(([, d]) => (d.status || '대기') === '완료').length;
    const mainLabel = wsViewMode === 'batch'
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
        if (wsGroupState[subStateKey] === undefined) wsGroupState[subStateKey] = false;
        const subCollapsed = wsGroupState[subStateKey];
        const subDone = items.filter(([, d]) => (d.status || '대기') === '완료').length;
        const subLabel = wsViewMode === 'batch' ? '제품: ' + esc(sk) : '배치: ' + esc(sk);

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
            const checked = wsSelection.has(sn) ? 'checked' : '';

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
  const item = DATA[sn];
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
  const item = DATA[sn];
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
  const item = DATA[sn];
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
  if (checked) wsSelection.add(sn); else wsSelection.delete(sn);
  updateBatchBar();
};

window.toggleGroupSelect = function(key, checked) {
  Object.entries(DATA).forEach(([sn, d]) => {
    let mainKey, subKey;
    if (wsViewMode === "batch") {
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
        if (checked) wsSelection.add(sn); else wsSelection.delete(sn);
      }
    }
  });
  renderWorkspace();
};

window.clearSelection = function() {
  wsSelection.clear();
  renderWorkspace();
};

function updateBatchBar() {
  const bar = document.getElementById('batchBar');
  const countEl = document.getElementById('batchCount');
  if (!bar || !countEl) return;
  if (wsSelection.size > 0) {
    bar.style.display = 'flex';
    countEl.textContent = `${wsSelection.size}건 선택`;
  } else {
    bar.style.display = 'none';
  }
}

window.applyBatch = async function() {
  const status = document.getElementById('batchStatusSel').value;
  if (!status) { toast('상태를 선택하세요', 'warn'); return; }
  if (!wsSelection.size) { toast('선택된 항목이 없습니다', 'warn'); return; }
  try {
    const batch = FB.writeBatch(firebaseDb);
    wsSelection.forEach(sn => {
      const ref = FB.doc(firebaseDb, 'production', sn);
      batch.update(ref, { status });
    });
    await batch.commit();
    toast(`${wsSelection.size}건 상태 → ${status}`, 'success');
    wsSelection.clear();
  } catch (err) { handleFirestoreError(err, '일괄 상태 변경'); }
};

window.applyNG = async function() {
  if (!wsSelection.size) { toast('선택된 항목이 없습니다', 'warn'); return; }
  if (!confirm(`${wsSelection.size}건을 NG(폐기) 처리하시겠습니까?`)) return;
  try {
    const batch = FB.writeBatch(firebaseDb);
    wsSelection.forEach(sn => {
      const ref = FB.doc(firebaseDb, 'production', sn);
      batch.update(ref, { status: '폐기' });
    });
    await batch.commit();
    toast(`${wsSelection.size}건 NG 처리 완료`, 'success');
    wsSelection.clear();
  } catch (err) { handleFirestoreError(err, 'NG 처리'); }
};

window.generateBatchQR = async function() {
  if (!wsSelection.size) { toast('선택된 항목이 없습니다', 'warn'); return; }
  const grid = document.getElementById('qrPrintGrid');
  if (!grid) return;
  grid.innerHTML = '';
  for (const sn of wsSelection) {
    const item = document.createElement('div');
    item.className = 'qr-print-item';
    item.innerHTML = `<div id="qr_${sn.replace(/[^a-zA-Z0-9]/g, '_')}" style="margin-bottom:4px"></div><div style="font-size:10px;font-family:monospace;word-break:break-all">${esc(sn)}</div>`;
    grid.appendChild(item);
  }
  openModal('qrPrintModal');
  if (typeof QRCode !== 'undefined') {
    for (const sn of wsSelection) {
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
  calViewMode = mode;
  document.querySelectorAll('#calendarTab .tab-btn').forEach(el => el.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderCalendar();
};

window.calPrev = function() {
  if (calViewMode === 'week') calDate.setDate(calDate.getDate() - 7);
  else calDate.setMonth(calDate.getMonth() - 1);
  renderCalendar();
};

window.calNext = function() {
  if (calViewMode === 'week') calDate.setDate(calDate.getDate() + 7);
  else calDate.setMonth(calDate.getMonth() + 1);
  renderCalendar();
};

window.calToday = function() {
  calDate = new Date();
  renderCalendar();
};

function renderCalendar() {
  const container = document.getElementById('calContent');
  if (!container) return;
  document.getElementById('calTitle').textContent = `${calDate.getFullYear()}년 ${calDate.getMonth() + 1}월`;

  if (calViewMode === 'issues') { renderIssueBoard(container); return; }
  if (calViewMode === 'week') { renderWeekView(container); return; }

  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const today = todayStr();

  // 이벤트 수집
  let events = {};
  function addEvent(date, ev) {
    if (!date) return;
    if (!events[date]) events[date] = [];
    events[date].push(ev);
  }

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
  Object.entries(DATA).forEach(([sn, d]) => {
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

  const dayIssues = ISSUES.filter(i => fD(i.date) === date);
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
  const base = new Date(calDate);
  const dow = base.getDay();
  base.setDate(base.getDate() - dow);
  const today = todayStr();

  let html = '<div class="week-view">';
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const isToday = dateStr === today;
    const dayLabel = ['일', '월', '화', '수', '목', '금', '토'][i];

    let dayItems = [];
    Object.entries(DATA).forEach(([sn, data]) => {
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
    const filtered = ISSUES.filter(i => (i.type || '기타') === type);
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

// === 간트차트 ===
window.setGanttView = function(mode, btn) {
  ganttViewMode = mode;
  document.querySelectorAll('.gantt-view-btn').forEach(el => el.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderGantt();
};

window.ganttZoom = function(delta) {
  ganttDayWidth = Math.max(8, Math.min(60, ganttDayWidth + delta));
  document.getElementById('ganttZoomLabel').textContent = ganttDayWidth + 'px';
  renderGantt();
};

window.ganttGoToday = function() {
  renderGantt();
  setTimeout(() => {
    const bodyWrap = document.getElementById('ganttBodyWrap');
    const headerWrap = document.getElementById('ganttHeaderWrap');
    if (!bodyWrap) return;
    const todayLine = bodyWrap.querySelector('.gantt-today-line');
    if (todayLine) {
      const left = parseInt(todayLine.style.left);
      bodyWrap.scrollLeft = left - 200;
      if (headerWrap) headerWrap.scrollLeft = left - 200;
    }
  }, 100);
};

window.ganttToggleAll = function() {
  ganttAllExpanded = !ganttAllExpanded;
  Object.keys(ganttGroupState).forEach(k => ganttGroupState[k] = !ganttAllExpanded);
  document.getElementById('ganttExpandAllBtn').textContent = ganttAllExpanded ? '모두 접기' : '모두 펼치기';
  renderGantt();
};

window.ganttToggleGroup = function(key) {
  ganttGroupState[key] = !ganttGroupState[key];
  renderGantt();
};

function renderGantt() {
  // 필터
  const prodFilter = document.getElementById('ganttProdFilter');
  const statusFilter = document.getElementById('ganttStatusFilter');

  if (prodFilter) {
    const prev = prodFilter.value;
    const names = new Set();
    Object.values(DATA).forEach(d => { if (d.productName) names.add(d.productName); });
    prodFilter.innerHTML = '<option value="">전체 제품</option>' + [...names].sort().map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
    prodFilter.value = prev;
  }

  const entries = Object.entries(DATA).filter(([, d]) => {
    if (prodFilter && prodFilter.value && d.productName !== prodFilter.value) return false;
    if (statusFilter && statusFilter.value && (d.status || '대기') !== statusFilter.value) return false;
    return true;
  });

  // 날짜 범위 계산
  let minDate = null, maxDate = null;
  function checkDate(val) {
    const d = fD(val);
    if (!d) return;
    if (!minDate || d < minDate) minDate = d;
    if (!maxDate || d > maxDate) maxDate = d;
  }

  entries.forEach(([sn, d]) => {
    checkDate(d.startDate); checkDate(d.endDate); checkDate(d.createdAt);
    getRoute(sn, d).forEach(proc => {
      const p = getProc(d, proc);
      checkDate(p.planStart); checkDate(p.actualStart);
      checkDate(p.planEnd); checkDate(p.actualEnd);
    });
  });

  if (!minDate) minDate = todayStr();
  if (!maxDate) maxDate = todayStr();

  const PAD = 14;
  let rangeStart = new Date(minDate + 'T00:00:00');
  rangeStart.setDate(rangeStart.getDate() - PAD);
  let rangeEnd = new Date(maxDate + 'T00:00:00');
  rangeEnd.setDate(rangeEnd.getDate() + PAD);

  const totalDays = Math.round((rangeEnd - rangeStart) / 86400000) + 1;
  const totalWidth = totalDays * ganttDayWidth;
  const today = todayStr();

  const header = document.getElementById('ganttHeader');
  const sidebar = document.getElementById('ganttSidebar');
  const body = document.getElementById('ganttBody');
  if (!header || !sidebar || !body) return;

  header.style.width = totalWidth + 'px';
  body.style.width = totalWidth + 'px';

  // 헤더 렌더링
  let headerHtml = '';
  let lastMonth = '';
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const monthLabel = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    const isWknd = d.getDay() === 0 || d.getDay() === 6;
    const isToday = dateStr === today;

    if (monthLabel !== lastMonth) {
      lastMonth = monthLabel;
      headerHtml += `<div class="gantt-month" style="position:absolute;left:${i * ganttDayWidth}px;top:0;font-size:10px;font-weight:600;color:var(--t2);padding:2px 4px">${monthLabel}</div>`;
    }
    headerHtml += `<div class="gantt-day" style="position:absolute;left:${i * ganttDayWidth}px;top:16px;width:${ganttDayWidth}px;text-align:center;font-size:9px;color:${isToday ? 'var(--ac2)' : isWknd ? 'var(--err)' : 'var(--t2)'};${isToday ? 'font-weight:700' : ''}">${d.getDate()}</div>`;
  }
  header.innerHTML = headerHtml;
  header.style.height = '32px';

  // 행 빌드
  let rows = [];
  if (ganttViewMode === 'process') {
    PROC_ORDER.forEach(proc => {
      const matching = entries.filter(([, d]) => {
        const p = getProc(d, proc);
        return fD(p.planStart) || fD(p.actualStart) || fD(p.planEnd) || fD(p.actualEnd) || (p.status && p.status !== '대기');
      });
      if (matching.length) {
        const key = 'proc_' + proc;
        if (ganttGroupState[key] === undefined) ganttGroupState[key] = true;
        rows.push({ type: 'group', label: proc, count: matching.length, key });
        if (!ganttGroupState[key]) {
          matching.forEach(([sn, d]) => rows.push({ type: 'item', sn, d, proc }));
        }
      }
    });
  } else {
    let groups = {};
    entries.forEach(([sn, d]) => {
      const key = ganttViewMode === 'batch'
        ? (d.batch || d.batchId || extractBatchFromSN(sn) || '기타')
        : (d.productName || extractCategory(sn) || '기타');
      if (!groups[key]) groups[key] = [];
      groups[key].push([sn, d]);
    });
    Object.keys(groups).sort().forEach(groupName => {
      const gKey = 'g_' + groupName;
      if (ganttGroupState[gKey] === undefined) ganttGroupState[gKey] = true;
      rows.push({ type: 'group', label: groupName, count: groups[groupName].length, key: gKey });
      if (!ganttGroupState[gKey]) {
        groups[groupName].forEach(([sn, d]) => rows.push({ type: 'item', sn, d }));
      }
    });
  }

  // 사이드바
  let sidebarHtml = '';
  rows.forEach(row => {
    if (row.type === 'group') {
      const collapsed = ganttGroupState[row.key];
      sidebarHtml += `<div class="gantt-sb-group" onclick="window.ganttToggleGroup('${esc(row.key)}')" style="cursor:pointer;padding:6px 8px;font-weight:600;font-size:12px;background:var(--bg3);display:flex;align-items:center;gap:4px;height:36px;box-sizing:border-box"><span style="font-size:10px;transform:rotate(${collapsed ? '0' : '90'}deg);transition:transform 0.2s">▶</span>${esc(row.label)} <span style="color:var(--t2);font-weight:400">(${row.count})</span>
      </div>`;
    } else {
      sidebarHtml += `<div class="gantt-sb-item" onclick="openSidePanel('${esc(row.sn)}')" style="cursor:pointer;padding:4px 8px;font-size:11px;height:36px;box-sizing:border-box;display:flex;align-items:center;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;border-bottom:1px solid var(--border)">${esc(row.sn)}</div>`;
    }
  });
  sidebar.innerHTML = sidebarHtml;

  // 바디
  let bodyHtml = '';
  const todayOffset = Math.round((new Date(today + 'T00:00:00') - rangeStart) / 86400000);
  bodyHtml += `<div class="gantt-today-line" style="position:absolute;left:${todayOffset * ganttDayWidth}px;top:0;width:2px;height:100%;background:var(--ac2);opacity:0.5;z-index:1"></div>`;

  // 주말 배경
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + i);
    if (d.getDay() === 0 || d.getDay() === 6) {
      bodyHtml += `<div style="position:absolute;left:${i * ganttDayWidth}px;top:0;width:${ganttDayWidth}px;height:100%;background:rgba(255,255,255,0.02)"></div>`;
    }
  }

  let rowY = 0;
  let barCount = 0;

  rows.forEach(row => {
    if (row.type === 'group') {
      bodyHtml += `<div style="position:absolute;left:0;top:${rowY}px;width:100%;height:36px;background:var(--bg3)"></div>`;
      rowY += 36;
    } else {
      const d = row.d;
      const route = getRoute(row.sn, d);
      const singleProc = row.proc;
      const procs = singleProc ? [singleProc] : route;
      const fallbackStart = fD(d.startDate) || fD(d.createdAt) || '';
      const fallbackEnd = fD(d.endDate) || '';

      let hasBar = false;
      procs.forEach(proc => {
        const p = getProc(d, proc);
        let start = fD(p.planStart) || fD(p.actualStart) || fD(p.startDate);
        let end = fD(p.planEnd) || fD(p.actualEnd) || fD(p.endDate);
        if (!start) start = fallbackStart;
        if (!end) end = fallbackEnd;
        if (start && !end) end = start;
        if (!start && end) start = end;
        if (!start) return;

        const startOff = Math.round((new Date(start + 'T00:00:00') - rangeStart) / 86400000);
        const endOff = Math.round((new Date(end + 'T00:00:00') - rangeStart) / 86400000);
        const left = startOff * ganttDayWidth;
        const width = Math.max((endOff - startOff + 1) * ganttDayWidth, ganttDayWidth);
        const color = PROC_COLORS[proc] || '#6366f1';
        const status = p.status || '대기';
        const opacity = status === '완료' ? 0.6 : 1;

        bodyHtml += `<div class="gantt-bar" style="position:absolute;left:${left}px;top:${rowY + 9}px;width:${width}px;height:20px;background:${color};border-radius:4px;opacity:${opacity};cursor:pointer;display:flex;align-items:center;padding:0 4px;overflow:hidden;z-index:2" title="${esc(row.sn)} / ${esc(proc)} / ${esc(status)} / ${start}~${end}" onclick="openSidePanel('${esc(row.sn)}')">
          <span style="font-size:9px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(proc)}${p.equip ? ' · ' + esc(p.equip) : ''}</span>
        </div>`;
        hasBar = true;
        barCount++;
      });

      // 폴백 바
      if (!hasBar && fallbackStart) {
        const end = fallbackEnd || fallbackStart;
        const startOff = Math.round((new Date(fallbackStart + 'T00:00:00') - rangeStart) / 86400000);
        const endOff = Math.round((new Date(end + 'T00:00:00') - rangeStart) / 86400000);
        const left = startOff * ganttDayWidth;
        const width = Math.max((endOff - startOff + 1) * ganttDayWidth, ganttDayWidth);
        bodyHtml += `<div class="gantt-bar" style="position:absolute;left:${left}px;top:${rowY + 9}px;width:${width}px;height:20px;background:#6366f1;border-radius:4px;opacity:0.4;cursor:pointer;display:flex;align-items:center;padding:0 4px;overflow:hidden;z-index:2;border:1px dashed rgba(255,255,255,0.3)" title="${esc(row.sn)} (폴백: ${fallbackStart}~${end})" onclick="openSidePanel('${esc(row.sn)}')">
          <span style="font-size:9px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(row.sn)}</span>
        </div>`;
        barCount++;
      }

      bodyHtml += `<div style="position:absolute;left:0;top:${rowY + 36}px;width:100%;height:1px;background:var(--border);opacity:0.3"></div>`;
      rowY += 36;
    }
  });

  // [수정됨] 높이 동기화 + 상하좌우 스크롤 바인딩
  const totalHeight = rowY;
  body.innerHTML = bodyHtml;
  body.style.height = totalHeight + 'px';
  body.style.minHeight = totalHeight + 'px';

  // 사이드바 스페이서 (사이드바가 바디와 같은 높이로 스크롤되도록)
  let spacer = sidebar.querySelector('.gantt-sb-spacer');
  if (!spacer) {
    spacer = document.createElement('div');
    spacer.className = 'gantt-sb-spacer';
    spacer.style.cssText = 'pointer-events:none;width:1px;visibility:hidden;';
    sidebar.appendChild(spacer);
  }
  spacer.style.height = totalHeight + 'px';

  const bodyWrap = document.getElementById('ganttBodyWrap');
  const headerWrap = document.getElementById('ganttHeaderWrap');

  // [수정됨] 좌우 + 상하 양방향 스크롤 동기화
  if (bodyWrap) {
    bodyWrap.onscroll = () => {
      if (headerWrap) headerWrap.scrollLeft = bodyWrap.scrollLeft;
      if (sidebar) sidebar.scrollTop = bodyWrap.scrollTop;
    };
  }
  if (sidebar) {
    sidebar.onscroll = () => {
      if (bodyWrap) bodyWrap.scrollTop = sidebar.scrollTop;
    };
  }

  console.log(`📊 [Gantt] 렌더 완료: ${rows.length}행, ${barCount}개 바, 높이 ${totalHeight}px`);
}

// === 분석 탭 ===
function renderAnalysis() {
  const kpiEl = document.getElementById('analysisKpi');
  if (kpiEl) {
    const total = Object.keys(DATA).length;
    let done = 0, prog = 0, delay = 0;
    Object.values(DATA).forEach(d => {
      const s = d.status || '대기';
      if (s === '완료') done++;
      if (s === '진행') prog++;
      if (s === '지연') delay++;
    });
    const rate = total ? Math.round(done / total * 100) : 0;
    kpiEl.innerHTML = `
      <div class="kpi-card"><div class="kpi-val">${total}</div><div class="kpi-lbl">전체</div></div>
      <div class="kpi-card"><div class="kpi-val" style="color:var(--ac2)">${prog}</div><div class="kpi-lbl">진행</div></div>
      <div class="kpi-card"><div class="kpi-val" style="color:var(--suc)">${rate}%</div><div class="kpi-lbl">완료율</div></div>
      <div class="kpi-card"><div class="kpi-val" style="color:var(--err)">${delay}</div><div class="kpi-lbl">지연</div></div>
    `;
  }
  renderAllCharts();
}

function renderAllCharts() {
  // 제품별 생산량
  drawBarChart('prodBarChart', () => {
    const counts = {};
    Object.values(DATA).forEach(d => { const n = d.productName || '기타'; counts[n] = (counts[n] || 0) + 1; });
    return { labels: Object.keys(counts), values: Object.values(counts), color: '#6366f1' };
  });

  // 상태 도넛
  drawDonutChart('analysisDonut');

  // 월별 투입/완료
  drawBarChart('monthLineChart', () => {
    const months = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[key] = { in: 0, out: 0 };
    }
    Object.values(DATA).forEach(d => {
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
    Object.entries(DATA).forEach(([sn, d]) => {
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
    Object.entries(DATA).forEach(([sn, d]) => {
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
    Object.values(DATA).forEach(d => {
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

function drawDonutChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  let counts = { '대기': 0, '진행': 0, '완료': 0, '지연': 0, '폐기': 0 };
  Object.values(DATA).forEach(d => {
    const s = d.status || '대기';
    if (counts[s] !== undefined) counts[s]++;
  });

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (handleEmptyChart(canvas, total === 0 ? [] : counts, 'LOT 데이터가 없습니다')) return;

  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.parentElement.clientWidth - 32;
  const h = canvas.height = 240;
  ctx.clearRect(0, 0, w, h);

  const colorMap = { '대기': '#64748b', '진행': '#6366f1', '완료': '#10b981', '지연': '#ef4444', '폐기': '#71717a' };
  const cx = w / 2, cy = h / 2 - 10;
  const outerR = Math.min(w, h) / 2 - 40;
  const innerR = outerR * 0.55;

  let angle = -Math.PI / 2;
  Object.entries(counts).forEach(([status, count]) => {
    if (!count) return;
    const slice = count / total * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = colorMap[status] || '#666';
    ctx.fill();
    angle += slice;
  });

  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--bg2').trim() || '#0f1629';
  ctx.fill();

  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--t1').trim() || '#fff';
  ctx.font = 'bold 20px Noto Sans KR';
  ctx.textAlign = 'center';
  ctx.fillText(total, cx, cy + 2);
  ctx.font = '12px Noto Sans KR';
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--t2').trim() || '#999';
  ctx.fillText('전체', cx, cy + 18);

  let lx = 10, ly = h - 18;
  Object.entries(counts).forEach(([status, count]) => {
    if (!count) return;
    ctx.fillStyle = colorMap[status];
    ctx.fillRect(lx, ly, 10, 10);
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--t2').trim() || '#999';
    ctx.font = '11px Noto Sans KR';
    ctx.textAlign = 'left';
    ctx.fillText(`${status} ${count}`, lx + 14, ly + 9);
    lx += ctx.measureText(`${status} ${count}`).width + 24;
  });
}

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

  Object.values(DATA).forEach(d => {
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
// 파트 4: AI, 사이드패널, 모달, 설정, 이벤트
// ===================================================

// === 보고서 ===
window.openReportModal = function() {
  const today = todayStr();
  const total = Object.keys(DATA).length;
  let counts = { '대기': 0, '진행': 0, '완료': 0, '지연': 0, '폐기': 0 };
  Object.values(DATA).forEach(d => {
    const s = d.status || '대기';
    if (counts[s] !== undefined) counts[s]++;
  });

  let todayItems = [];
  Object.entries(DATA).forEach(([sn, d]) => {
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
    ${Object.entries(DATA).filter(([, d]) => (d.status || '대기') === '지연').map(([sn]) => `<p style="font-size:12px">⚠️ ${esc(sn)}</p>`).join('') || '<p style="font-size:12px;color:var(--t2)">지연 없음</p>'}
  `;
  document.getElementById('reportContent').innerHTML = content;
  openModal('reportModal');
};

window.copyReport = function() {
  const el = document.getElementById('reportContent');
  if (el) navigator.clipboard.writeText(el.innerText).then(() => toast('보고서 복사됨', 'success')).catch(() => toast('복사 실패', 'error'));
};

// === 납기 역산 ===
window.openDeadlineCalc = function() {
  populateProductSelects();
  openModal('deadlineModal');
};

window.calcDeadline = function() {
  const prodId = document.getElementById('dl_prod').value;
  const dueDate = document.getElementById('dl_due').value;
  const result = document.getElementById('dl_result');
  const snBtn = document.getElementById('dl_snBtn');
  if (!prodId || !dueDate) { result.innerHTML = ''; snBtn.style.display = 'none'; return; }

  const prod = PRODUCTS[prodId];
  if (!prod) { result.innerHTML = '<div style="color:var(--err)">제품 정보 없음</div>'; return; }

  const cat = prod.category || 'WN';
  const heat = prod.heat || 'N';
  const route = buildRoute(cat, heat, prod.dcJoint || "");

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

  html += '</tbody></table>';
  html += `<div style="margin-top:8px;font-size:13px;font-weight:600">👉 투입 시작일: <span style="color:var(--ac2)">${fmt(schedule[0]?.start)}</span></div>`;
  html += '</div>';

  result.innerHTML = html;
  snBtn.style.display = 'inline-flex';
  snBtn.dataset.prod = prodId;
  snBtn.dataset.start = schedule[0]?.start || '';
};

window.deadlineToSN = function() {
  const btn = document.getElementById('dl_snBtn');
  closeModal('deadlineModal');
  openSNModal();
  setTimeout(() => {
    document.getElementById('sn_prod').value = btn.dataset.prod || '';
    document.getElementById('sn_start').value = btn.dataset.start || '';
    onSNProdChange();
    updateSNPreview();
  }, 100);
};

// === 위젯 설정 ===
window.openWidgetSettings = function() {
  const widgets = getWidgets();
  const list = document.getElementById('widgetSettingsList');
  if (!list) return;
  list.innerHTML = widgets.map((w, i) => `
    <div class="widget-setting-item" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
      <input type="checkbox" ${w.enabled ? 'checked' : ''} onchange="widgetToggle(${i},this.checked)">
      <span style="flex:1;font-size:13px">${esc(w.name)}</span>
      <button class="btn btn-secondary btn-sm" onclick="widgetMove(${i},-1)" ${i === 0 ? 'disabled' : ''}>↑</button>
      <button class="btn btn-secondary btn-sm" onclick="widgetMove(${i},1)" ${i === widgets.length - 1 ? 'disabled' : ''}>↓</button>
    </div>
  `).join('');
  openModal('widgetModal');
};

window.widgetToggle = function(idx, checked) {
  const w = getWidgets();
  w[idx].enabled = checked;
  saveWidgets(w);
};

window.widgetMove = function(idx, dir) {
  const w = getWidgets();
  const target = idx + dir;
  if (target < 0 || target >= w.length) return;
  [w[idx], w[target]] = [w[target], w[idx]];
  saveWidgets(w);
  openWidgetSettings();
};

window.saveWidgetConfig = function() {
  closeModal('widgetModal');
  renderHome();
  toast('위젯 설정 저장됨', 'success');
};

window.resetWidgetConfig = function() {
  widgetCache = null;
  localStorage.removeItem('esc_widgets');
  openWidgetSettings();
  toast('기본값 복원', 'info');
};

// === 설정 ===
function renderSettings() {
  const key = localStorage.getItem('esc_gemini_key');
  const status = document.getElementById('geminiKeyStatus');
  if (status) status.textContent = key ? '✅ API 키가 설정되어 있습니다' : '❌ API 키가 설정되지 않았습니다';
  const input = document.getElementById('geminiKeyInput');
  if (input && key) input.value = key;
  const toggle = document.getElementById('themeToggle');
  if (toggle) toggle.classList.toggle('active', !isDarkMode);
  updateDataStats();
}

window.saveGeminiKey = function() {
  const key = document.getElementById('geminiKeyInput').value.trim();
  if (!key) { toast('API 키를 입력하세요', 'warn'); return; }
  localStorage.setItem('esc_gemini_key', key);
  toast('Gemini API 키 저장됨', 'success');
  renderSettings();
};

// === AI 챗 ===
window.askAI = function(question) {
  document.getElementById('chatInput').value = question;
  sendChat();
};

window.sendChat = async function() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  const container = document.getElementById('chatMessages');
  container.innerHTML += `<div class="chat-bubble user">${esc(msg)}</div>`;

  const apiKey = localStorage.getItem('esc_gemini_key');
  if (apiKey) {
    container.innerHTML += '<div class="chat-bubble ai typing">분석 중...</div>';
    container.scrollTop = container.scrollHeight;
    try {
      const response = await callGemini(apiKey, msg);
      container.lastElementChild.remove();
      container.innerHTML += `<div class="chat-bubble ai">${mdToHtml(response)}</div>`;
      container.scrollTop = container.scrollHeight;
      return;
    } catch {
      container.lastElementChild.remove();
    }
  }

  const localResponse = generateLocalAI(msg);
  container.innerHTML += `<div class="chat-bubble ai">${mdToHtml(localResponse)}</div>`;
  container.scrollTop = container.scrollHeight;
};

async function callGemini(apiKey, question) {
  const prompt = `당신은 ESC(세라믹 정전척) 생산관리 AI 어시스턴트입니다. 아래 실시간 데이터를 기반으로 답변하세요.\n\n${buildDataContext()}\n\n사용자 질문: ${question}`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
  });
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text || '응답을 생성할 수 없습니다.';
}

function buildDataContext() {
  const total = Object.keys(DATA).length;
  let counts = { '대기': 0, '진행': 0, '완료': 0, '지연': 0, '폐기': 0 };
  Object.values(DATA).forEach(d => { const s = d.status || '대기'; if (counts[s] !== undefined) counts[s]++; });

  let ctx = `[생산 현황] 전체: ${total}건, 대기: ${counts['대기']}, 진행: ${counts['진행']}, 완료: ${counts['완료']}, 지연: ${counts['지연']}, 폐기: ${counts['폐기']}\n`;
  ctx += `[공정순서] ${PROC_ORDER.join(' → ')}\n`;
  ctx += `[등록제품] ${Object.values(PRODUCTS).map(p => p.name).join(', ')}\n`;

  const delayed = Object.entries(DATA).filter(([, d]) => (d.status || '대기') === '지연');
  if (delayed.length) {
    ctx += `[지연 LOT]\n`;
    delayed.forEach(([sn, d]) => { ctx += `- ${sn}: 현재공정=${d.currentProcess || '-'}, 납기=${fmt(fD(d.endDate))}\n`; });
  }

  let procStats = {};
  PROC_ORDER.forEach(p => procStats[p] = { total: 0, done: 0, inProgress: 0 });
  Object.entries(DATA).forEach(([sn, d]) => {
    getRoute(sn, d).forEach(proc => {
      if (!procStats[proc]) return;
      procStats[proc].total++;
      const p = getProc(d, proc);
      if (p.status === '완료') procStats[proc].done++;
      if (p.status === '진행') procStats[proc].inProgress++;
    });
  });
  ctx += `[공정별 현황]\n`;
  PROC_ORDER.forEach(p => { ctx += `- ${p}: 전체=${procStats[p].total}, 진행=${procStats[p].inProgress}, 완료=${procStats[p].done}\n`; });

  if (ISSUES.length) {
    ctx += `[최근 이슈 ${Math.min(ISSUES.length, 10)}건]\n`;
    ISSUES.slice(0, 10).forEach(i => { ctx += `- ${fmt(fD(i.date))} [${i.type}] ${i.content}\n`; });
  }
  return ctx;
}

function generateLocalAI(msg) {
  const q = msg.toLowerCase();

  if (q.includes('요약') || q.includes('현황')) {
    const total = Object.keys(DATA).length;
    let c = { '대기': 0, '진행': 0, '완료': 0, '지연': 0 };
    Object.values(DATA).forEach(d => { const s = d.status || '대기'; if (c[s] !== undefined) c[s]++; });
    return `**📊 생산 현황 요약**\n\n전체 **${total}**건\n- 대기: ${c['대기']}건\n- 진행: ${c['진행']}건\n- 완료: ${c['완료']}건\n- 지연: ${c['지연']}건\n\n완료율: ${total ? Math.round(c['완료'] / total * 100) : 0}%`;
  }

  if (q.includes('지연')) {
    const delayed = Object.entries(DATA).filter(([, d]) => (d.status || '대기') === '지연');
    if (!delayed.length) return '현재 지연된 LOT이 없습니다.';
    let r = `**⚠️ 지연 현황 (${delayed.length}건)**\n\n`;
    delayed.forEach(([sn, d]) => { r += `- **${sn}** — ${d.currentProcess || '-'} / 납기: ${fmt(fD(d.endDate))}\n`; });
    return r;
  }

  if (q.includes('병목')) {
    let proc = {};
    PROC_ORDER.forEach(p => proc[p] = 0);
    Object.entries(DATA).forEach(([sn, d]) => {
      getRoute(sn, d).forEach(p => { if (getProc(d, p).status === '진행') proc[p] = (proc[p] || 0) + 1; });
    });
    const top = Object.entries(proc).sort((a, b) => b[1] - a[1])[0];
    let r = `**🔍 병목 진단**\n\n`;
    PROC_ORDER.forEach(p => { r += `- ${p}: 진행 ${proc[p]}건\n`; });
    if (top && top[1] > 0) r += `\n**병목 구간: ${top[0]}** (${top[1]}건 체류)`;
    return r;
  }

  if (q.includes('예측') || q.includes('이번 주')) {
    const now = new Date();
    const fri = new Date(now);
    fri.setDate(now.getDate() + (5 - now.getDay()));
    const friStr = fri.toISOString().split('T')[0];
    const upcoming = Object.entries(DATA).filter(([sn, d]) => {
      const route = getRoute(sn, d);
      const last = route[route.length - 1];
      if (!last) return false;
      const p = getProc(d, last);
      const pe = fD(p.planEnd);
      return pe && pe <= friStr && pe >= todayStr() && p.status !== '완료';
    });
    return upcoming.length
      ? `**📅 이번 주 완료 예정 (${upcoming.length}건)**\n\n${upcoming.map(([sn]) => `- ${sn}`).join('\n')}`
      : '이번 주 완료 예정인 LOT이 없습니다.';
  }

  if (q.includes('개선') || q.includes('제안')) {
    return `**💡 생산 효율 개선 제안**\n\n1. 지연 LOT 우선 처리 — 병목 공정의 설비 추가 투입 검토\n2. 공정간 대기시간 최소화 — 이전 공정 완료 즉시 다음 공정 시작\n3. 설비 가동률 모니터링 — 유휴 설비 재배치\n4. 불량률 높은 공정 집중 관리 — 원인 분석 및 예방 조치\n5. 납기 역산 기준 투입 계획 수립`;
  }

  if (q.includes('설비') || q.includes('가동')) {
    let equips = {};
    Object.values(DATA).forEach(d => {
      getRoute('', d).forEach(proc => {
        const p = getProc(d, proc);
        if (p.equip && p.status === '진행') equips[p.equip] = (equips[p.equip] || 0) + 1;
      });
    });
    let r = `**🏭 설비 현황**\n\n`;
    if (Object.keys(equips).length) {
      Object.entries(equips).sort((a, b) => b[1] - a[1]).forEach(([eq, cnt]) => { r += `- ${eq}: ${cnt}건 가동\n`; });
    } else { r += '현재 가동 중인 설비 정보가 없습니다.\n'; }
    return r;
  }

  if (q.includes('불량') || q.includes('패턴')) {
    let defects = {};
    Object.values(DATA).forEach(d => {
      getRoute('', d).forEach(proc => {
        const p = getProc(d, proc);
        if (p.defect && p.defect !== '') defects[proc] = (defects[proc] || 0) + 1;
      });
    });
    let r = `**📈 불량 패턴 분석**\n\n`;
    if (Object.keys(defects).length) {
      Object.entries(defects).sort((a, b) => b[1] - a[1]).forEach(([proc, cnt]) => { r += `- ${proc}: ${cnt}건\n`; });
    } else { r += '기록된 불량 데이터가 없습니다.\n'; }
    return r;
  }

  if (q.includes('보고서') || q.includes('주간')) {
    const total = Object.keys(DATA).length;
    let c = { '대기': 0, '진행': 0, '완료': 0, '지연': 0 };
    Object.values(DATA).forEach(d => { const s = d.status || '대기'; if (c[s] !== undefined) c[s]++; });
    return `**📋 주간 보고서**\n\n**기간:** ${fmt(todayStr())}\n**전체:** ${total}건\n**진행:** ${c['진행']}건\n**완료:** ${c['완료']}건 (${total ? Math.round(c['완료'] / total * 100) : 0}%)\n**지연:** ${c['지연']}건\n\n---\n자세한 분석을 원하시면 Gemini API 키를 설정해 주세요.`;
  }

  if (q.includes('s/n') || q.includes('생성')) {
    return 'S/N 생성은 워크스페이스 탭의 **+ S/N생성** 버튼을 이용하세요. 또는 납기역산 계산기에서 바로 생성할 수도 있습니다.';
  }

  return `"${msg}"에 대한 분석입니다.\n\n현재 로컬 분석 모드입니다. 더 정확한 AI 분석을 원하시면 **설정 → Gemini API Key**를 등록해 주세요.\n\n사용 가능한 명령:\n- 오늘 생산 현황 요약\n- 지연 현황\n- 병목 진단\n- 이번 주 예측\n- 개선 제안\n- 설비 현황\n- 불량 패턴\n- 주간 보고서`;
}

// === 미니 챗 ===
window.toggleMiniChat = function() {
  miniChatOpen = !miniChatOpen;
  document.getElementById('miniChatWin').style.display = miniChatOpen ? 'flex' : 'none';
};

window.sendMiniChat = async function() {
  const input = document.getElementById('miniChatInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  const container = document.getElementById('miniChatMessages');
  container.innerHTML += `<div class="chat-bubble user" style="font-size:12px">${esc(msg)}</div>`;
  const response = generateLocalAI(msg);
  container.innerHTML += `<div class="chat-bubble ai" style="font-size:12px">${mdToHtml(response)}</div>`;
  container.scrollTop = container.scrollHeight;
};

// === 사이드 패널 ===
window.openSidePanel = function(sn) {
  selectedSN = sn;
  const d = DATA[sn];
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
    html += `<div class="sp-proc-item" style="padding:8px 10px;margin-bottom:6px;border-radius:8px;border-left:3px solid ${color};background:${isCurrent ? 'rgba(99,102,241,0.08)' : 'var(--bg4)'}">
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
};

window.closeSidePanel = function() {
  document.getElementById('sidePanel').classList.remove('open');
  selectedSN = null;
};

window.applySpStatus = async function() {
  if (!selectedSN) return;
  const status = document.getElementById('spStatusSel').value;
  try {
    const ref = FB.doc(firebaseDb, 'production', selectedSN);
    const updates = { status };
    if (status === '완료') updates.completedAt = todayStr();
    await FB.updateDoc(ref, updates);
    toast(`${selectedSN} 상태 → ${status}`, 'success');
  } catch (err) { handleFirestoreError(err, '상태 변경'); }
};

window.deleteSN = async function() {
  if (!selectedSN) return;
  if (!confirm(`${selectedSN}을(를) 삭제하시겠습니까?`)) return;
  try {
    await FB.deleteDoc(FB.doc(firebaseDb, 'production', selectedSN));
    toast(`${selectedSN} 삭제됨`, 'success');
    closeSidePanel();
  } catch (err) { handleFirestoreError(err, 'LOT 삭제'); }
};

// === 공정 상세 편집 모달 ===
window.openProcDetailModal = function(sn) {
  const d = DATA[sn];
  if (!d) return;
  const route = getRoute(sn, d);
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
};

window.saveProcDetail = async function(sn) {
  const d = DATA[sn];
  if (!d) return;
  const route = getRoute(sn, d);
  const cat = extractCategory(sn);
  const updates = {};
  let allDone = true;
  let firstNotDone = '';

  route.forEach((proc, idx) => {
    const st = document.getElementById(`pd_st_${idx}`)?.value || '대기';
    const eq = document.getElementById(`pd_eq_${idx}`)?.value || '';
    const start = document.getElementById(`pd_start_${idx}`)?.value || '';
    const end = document.getElementById(`pd_end_${idx}`)?.value || '';
    const def = document.getElementById(`pd_def_${idx}`)?.value || '';
    const rem = document.getElementById(`pd_rem_${idx}`)?.value || '';
    const days = getDefaultDays(proc, cat);
    const calcEnd = start ? addBD(start, days) : '';
    const actualDays = start && end ? diffBD(start, end) : 0;

    updates[`processes.${proc}.status`] = st;
    updates[`processes.${proc}.equip`] = eq;
    updates[`processes.${proc}.planStart`] = start;
    updates[`processes.${proc}.planEnd`] = calcEnd || end;
    updates[`processes.${proc}.planDays`] = days;
    updates[`processes.${proc}.defect`] = def;
    updates[`processes.${proc}.remark`] = rem;

    if (st === '진행' && start) updates[`processes.${proc}.actualStart`] = start;
    if (st === '완료') {
      updates[`processes.${proc}.actualEnd`] = end || todayStr();
      updates[`processes.${proc}.actualDays`] = actualDays || diffBD(start, end || todayStr());
    }
    if (st !== '완료') allDone = false;
    if (!firstNotDone && st !== '완료') firstNotDone = proc;
  });

  updates.currentProcess = firstNotDone || route[route.length - 1];
  if (allDone) { updates.status = '완료'; updates.completedAt = todayStr(); }

  try {
    const ref = FB.doc(firebaseDb, 'production', sn);
    await FB.updateDoc(ref, updates);
    toast(`${sn} 공정 정보 저장 완료`, 'success');
    closeModal('reportModal');
  } catch (err) { handleFirestoreError(err, '공정 상세 저장'); }
};

// === QR ===
window.showSNQR = async function() {
  if (!selectedSN) return;
  document.getElementById('qrSNLabel').textContent = selectedSN;
  const wrap = document.getElementById('qrCanvasWrap');
  wrap.innerHTML = '';
  openModal('qrModal');
  if (typeof QRCode !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      await QRCode.toCanvas(canvas, selectedSN, { width: 200, margin: 2 });
      wrap.appendChild(canvas);
    } catch { wrap.innerHTML = '<div style="color:var(--err)">QR 생성 실패</div>'; }
  } else {
    wrap.innerHTML = '<div style="color:var(--t2)">QR 라이브러리 로딩 중...</div>';
  }
};

window.downloadQR = function() {
  const canvas = document.querySelector('#qrCanvasWrap canvas');
  if (!canvas) return;
  const a = document.createElement('a');
  a.download = `QR_${selectedSN || 'code'}.png`;
  a.href = canvas.toDataURL();
  a.click();
};

// === 제품 등록 ===
﻿  window.openProductModal = function() {
    openModal('productModal');
    setTimeout(function(){ showProductList(); }, 100);
  };

  window.showProductList = function() {
    try {
    var lv = document.getElementById('pm_listView');
    var fv = document.getElementById('pm_formView');
    var tt = document.getElementById('pm_title');
    if (lv) lv.style.display = '';
    if (fv) fv.style.display = 'none';
    if (tt) tt.textContent = String.fromCodePoint(0x1F4E6) + ' 제품 관리';
    renderProductList();
  }

  window.showProductForm = function(editName) {
    var lv = document.getElementById('pm_listView');
    var fv = document.getElementById('pm_formView');
    if (lv) lv.style.display = 'none';
    if (fv) fv.style.display = '';
    document.getElementById('pm_editMode').value = editName ? 'edit' : '';
    document.getElementById('pm_origName').value = editName || '';
    if (editName && PRODUCTS[editName]) {
      var p = PRODUCTS[editName];
      document.getElementById('pm_title').textContent = String.fromCodePoint(0x1F4E6) + ' 제품 수정';
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
      document.getElementById('pm_title').textContent = String.fromCodePoint(0x1F4E6) + ' 제품 등록';
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
    previewRoute();
  };

  window.previewRoute = function() {
    var cat = document.getElementById('pm_cat').value;
    var heat = document.getElementById('pm_heat').value;
    var dc = document.getElementById('pm_joint').value;
    var route = buildRoute(cat, heat, dc);
    var el = document.getElementById('pm_routePreview');
    if (el) el.innerHTML = route.map(function(p){ return '<span style="display:inline-block;padding:2px 8px;margin:2px;border-radius:12px;font-size:11px;color:#fff;background:' + (PROC_COLORS[p]||'#666') + '">' + esc(p) + '</span>'; }).join(' \u2192 ');
  };

  window.renderProductList = function() {
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


['pm_cat', 'pm_heat'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('change', () => {
    const cat = document.getElementById('pm_cat').value;
    const heat = document.getElementById('pm_heat').value;
    const route = buildRoute(cat, heat, "");
    document.getElementById('pm_routePreview').textContent = route.join(' → ');
  });
});

window.saveProduct = async function() {
  const name = document.getElementById('pm_name').value.trim();
  const cat = document.getElementById('pm_cat').value;
  if (!name) { toast('제품명을 입력하세요', 'warn'); return; }

  const drawing = document.getElementById('pm_drawing').value.trim();
  const shrink = parseFloat(document.getElementById('pm_shrink').value) || 0;
  const stack = parseInt(document.getElementById('pm_stack').value) || 0;
  const joint = document.getElementById('pm_joint').value;
  const heat = document.getElementById('pm_heat').value;
  const route = buildRoute(cat, heat, "");

  try {
    const ref = FB.doc(firebaseDb, 'products', name);
    await FB.setDoc(ref, { name, category: cat, drawing, shrink, stack, joint, heat, route, createdAt: todayStr() });
    toast(`제품 "${name}" 등록 완료`, 'success');
    closeModal('productModal');
    document.getElementById('pm_name').value = '';
    const snap = await FB.getDocs(FB.collection(firebaseDb, 'products'));
    PRODUCTS = {};
    snap.forEach(d => { PRODUCTS[d.id] = d.data(); });
    populateProductSelects();
  } catch (err) { handleFirestoreError(err, '제품 등록'); }
};

// === S/N 생성 ===
window.openSNModal = function() {
  populateProductSelects();
  document.getElementById('sn_start').value = todayStr();
  const batches = new Set();
  Object.values(DATA).forEach(d => { if (d.batch) batches.add(d.batch); });
  const list = document.getElementById('batchList');
  if (list) list.innerHTML = [...batches].map(b => `<option value="${esc(b)}">`).join('');
  openModal('snModal');
};

window.autoBatchCode = function() {
  const now = new Date();
  const code = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 900) + 100)}`;
  document.getElementById('sn_batch').value = code;
  updateSNPreview();
};

window.onSNProdChange = function() {
  const prodId = document.getElementById('sn_prod').value;
  const prod = PRODUCTS[prodId];
  if (!prod) return;
  const cat = prod.category || 'WN';
  const equipSel = document.getElementById('sn_equip');
  if (equipSel) {
    const firstProc = PROC_ORDER[0];
    const eqList = getEquipList(firstProc, cat);
    equipSel.innerHTML = '<option value="">선택...</option>' + eqList.map(eq => `<option value="${esc(eq)}">${esc(eq)}</option>`).join('');
  }
  const hint = document.getElementById('sn_seqHint');
  if (hint) {
    const existing = Object.keys(DATA).filter(sn => sn.toUpperCase().startsWith(cat.toUpperCase()));
    hint.textContent = `현재 ${cat} 시리즈: ${existing.length}건`;
  }
  updateSNPreview();
};

window.onSheetNoChange = function() { updateSNPreview(); };

window.updateSNPreview = function() {
  const sheet = document.getElementById('sn_sheet').value.trim();
  const prodId = document.getElementById('sn_prod').value;
  const qty = parseInt(document.getElementById('sn_qty').value) || 1;
  const seq = parseInt(document.getElementById('sn_seq').value) || 1;
  const prod = PRODUCTS[prodId];
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

window.checkEquipConflict = function() {
  const equip = document.getElementById('sn_equip').value;
  const startDate = document.getElementById('sn_start').value;
  const warn = document.getElementById('equipConflictWarn');
  if (!warn) return;
  if (!equip || !startDate) { warn.innerHTML = ''; return; }

  const conflicts = Object.entries(DATA).filter(([sn, d]) =>
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

window.saveSNBatch = async function() {
  const batch = document.getElementById('sn_batch').value.trim();
  const sheet = document.getElementById('sn_sheet').value.trim();
  const prodId = document.getElementById('sn_prod').value;
  const qty = parseInt(document.getElementById('sn_qty').value) || 1;
  const seq = parseInt(document.getElementById('sn_seq').value) || 1;
  const startDate = document.getElementById('sn_start').value;
  const equip = document.getElementById('sn_equip').value;
  const prod = PRODUCTS[prodId];

  if (!prod || !sheet || !batch) { toast('필수 항목을 입력하세요', 'warn'); return; }
  if (!startDate) { toast('시작일을 입력하세요', 'warn'); return; }

  const cat = prod.category || 'WN';
  const heat = prod.heat || 'N';
  const route = buildRoute(cat, heat, "");
  const name = (prod.name || '').replace(/\s/g, '');

  try {
    const writeBatch = FB.writeBatch(firebaseDb);
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
      writeBatch.set(ref, {
        sn, productName: prod.name, category: cat, customer: prod.customer || '',
        batch, route, processes, startDate, endDate: cursor,
        status: '진행', currentProcess: route[0], createdAt: todayStr(), heat
      });
    }
    await writeBatch.commit();
    toast(`${qty}건 S/N 생성 완료`, 'success');
    closeModal('snModal');
  } catch (err) { handleFirestoreError(err, 'S/N 생성'); }
};

// === 이슈 등록 ===
window.openIssueModal = function(sn) {
  document.getElementById('is_date').value = todayStr();
  document.getElementById('is_sn').value = sn || '';
  document.getElementById('is_content').value = '';
  populateProductSelects();
  openModal('issueModal');
};

window.loadIssueSNList = function() {
  const prodId = document.getElementById('is_prod').value;
  const list = document.getElementById('issueSNList');
  if (!list) return;
  const prod = PRODUCTS[prodId];
  if (!prod) { list.innerHTML = ''; return; }
  const matching = Object.keys(DATA).filter(sn => DATA[sn].productName === prod.name || extractCategory(sn) === (prod.category || ''));
  list.innerHTML = matching.map(sn => `<option value="${esc(sn)}">`).join('');
};

window.saveIssue = async function() {
  const date = document.getElementById('is_date').value;
  const type = document.getElementById('is_type').value;
  const sn = document.getElementById('is_sn').value.trim();
  const content = document.getElementById('is_content').value.trim();
  if (!content) { toast('이슈 내용을 입력하세요', 'warn'); return; }

  try {
    const id = `ISS-${Date.now()}`;
    const ref = FB.doc(firebaseDb, 'issues', id);
    await FB.setDoc(ref, { date, type, sn, content, createdAt: todayStr(), createdBy: currentUser?.email || '' });
    toast('이슈 등록 완료', 'success');
    closeModal('issueModal');
  } catch (err) { handleFirestoreError(err, '이슈 등록'); }
};

// === 엑셀/JSON 내보내기 ===
window.exportExcel = function() {
  if (typeof XLSX === 'undefined') { toast('SheetJS 로딩 중...', 'warn'); return; }
  const rows = [];
  Object.entries(DATA).forEach(([sn, d]) => {
    const route = getRoute(sn, d);
    const row = {
      'S/N': sn, '제품': d.productName || '', '카테고리': extractCategory(sn),
      '상태': d.status || '대기', '현재공정': d.currentProcess || '',
      '시작일': fD(d.startDate), '납기': fD(d.endDate),
      '진행률': calcProgress(d, sn) + '%', '배치': d.batch || ''
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

  if (ISSUES.length) {
    const issueRows = ISSUES.map(i => ({ '날짜': fD(i.date), '유형': i.type || '', 'SN': i.sn || '', '내용': i.content || '' }));
    const is = XLSX.utils.json_to_sheet(issueRows);
    XLSX.utils.book_append_sheet(wb, is, '이슈');
  }

  XLSX.writeFile(wb, `ESC_생산데이터_${todayStr()}.xlsx`);
  toast('엑셀 내보내기 완료', 'success');
};

window.exportJSON = function() {
  const data = { production: DATA, products: PRODUCTS, issues: ISSUES, exportDate: todayStr(), version: 'v10.0' };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.download = `ESC_backup_${todayStr()}.json`;
  a.href = URL.createObjectURL(blob);
  a.click();
  toast('JSON 백업 완료', 'success');
};

// === 키보드/이벤트 핸들러 ===
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSidePanel();
    closeAllDropdowns();
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(el => el.classList.add('hidden'));
  }
  if (e.ctrlKey && e.key === 'k') {
    e.preventDefault();
    if (currentTab === 'workspace') document.getElementById('wsSearch')?.focus();
  }
});

document.addEventListener('pointerdown', (e) => {
  const panel = document.getElementById('sidePanel');
  if (panel && panel.classList.contains('open') && !panel.contains(e.target)) {
    if (!e.target.closest('.sn-cell')) closeSidePanel();
  }
});

document.querySelectorAll('.bb-item').forEach(el => {
  el.addEventListener('click', function() {
    document.querySelectorAll('.bb-item').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
  });
});

// === 모바일 초기화 ===
if (window.innerWidth < 768) {
  sidebarCollapsed = true;
  document.getElementById('sidebar')?.classList.add('collapsed');
}

// === 온라인/오프라인 ===
window.addEventListener('online', () => {
  const banner = document.getElementById('offlineBanner');
  if (banner) banner.style.display = 'none';
  toast('온라인 복구됨', 'success');
});

window.addEventListener('offline', () => {
  const banner = document.getElementById('offlineBanner');
  if (banner) banner.style.display = 'block';
});

// === 테마 초기화 ===
(function() {
  if (localStorage.getItem('esc_theme') === 'light') isDarkMode = false;
  applyTheme();
})();

console.log('🎉 ESC Manager v10.0 — 통합 빌드 로드 완료');


// ── 일괄 편집 바: 공정 선택 시 설비 목록 연동 ──
window.onBatchProcChange = function() {
  const proc = document.getElementById('batchProcSel').value;
  const equipSel = document.getElementById('batchEquipSel');
  if (!equipSel) return;
  equipSel.innerHTML = '<option value="">설비</option>';
  if (!proc) return;
  // 선택된 SN들의 카테고리 확인
  let cat = '';
  wsSelection.forEach(sn => {
    const d = DATA[sn];
    if (d) cat = extractCategory(sn) || (d.category ? d.category : '') || cat;
  });
  const list = getEquipList(proc, cat);
  list.forEach(eq => {
    equipSel.innerHTML += `<option value="${esc(eq)}">${esc(eq)}</option>`;
  });
};

// ── 일괄 적용 (상태 + 공정 + 설비 + 날짜) ──
window.applyBatchAll = async function() {
  if (!wsSelection.size) { toast('선택된 항목이 없습니다', 'warn'); return; }

  const status = document.getElementById('batchStatusSel').value;
  const proc = document.getElementById('batchProcSel').value;
  const equip = document.getElementById('batchEquipSel').value;
  const startDate = document.getElementById('batchStartDate').value;
  const endDate = document.getElementById('batchEndDate').value;

  // 최소 하나는 선택해야 함
  if (!status && !proc && !equip && !startDate && !endDate) {
    toast('변경할 항목을 선택하세요', 'warn'); return;
  }

  const changes = [];
  if (status) changes.push(`상태→${status}`);
  if (proc) changes.push(`공정→${proc}`);
  if (equip) changes.push(`설비→${equip}`);
  if (startDate) changes.push(`시작→${startDate}`);
  if (endDate) changes.push(`납기→${endDate}`);

  if (!confirm(`${wsSelection.size}건에 [${changes.join(', ')}] 적용하시겠습니까?`)) return;

  try {
    const batch = FB.writeBatch(firebaseDb);
    wsSelection.forEach(sn => {
      const ref = FB.doc(firebaseDb, 'production', sn);
      const updates = {};
      if (status) updates.status = status;
      if (proc) updates.currentProcess = proc;
      if (equip) {
        // 현재 공정의 설비 업데이트
        const d = DATA[sn];
        const curProc = proc || (d ? d.currentProcess : '') || '';
        if (curProc && d && d.processes && d.processes[curProc]) {
          updates[`processes.${curProc}.equip`] = equip;
        }
      }
      if (startDate) updates.startDate = startDate;
      if (endDate) updates.endDate = endDate;
      batch.update(ref, updates);
    });
    await batch.commit();
    toast(`${wsSelection.size}건 일괄 변경 완료: ${changes.join(', ')}`, 'success');
    wsSelection.clear();
    updateBatchBar();
  } catch (err) { handleFirestoreError(err, '일괄 변경'); }
};

// ── batchBar 공정 셀렉트 이벤트 등록 ──
document.addEventListener('DOMContentLoaded', () => {
  const procSel = document.getElementById('batchProcSel');
  if (procSel) procSel.addEventListener('change', window.onBatchProcChange);
});


// ── 워크스페이스 검색 실시간 바인딩 ──
(function() {
  let _wsSearchTimer = null;
  document.addEventListener('input', function(e) {
    if (e.target && e.target.id === 'wsSearch') {
      clearTimeout(_wsSearchTimer);
      _wsSearchTimer = setTimeout(() => renderWorkspace(), 150);
    }
  });
})();







