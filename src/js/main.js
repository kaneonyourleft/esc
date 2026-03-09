console.log('🚀 main.js starting...');
// ===================================================
// ESC Manager v10.0 - main.js
// ===================================================

// === PWA 설정 ===
const PWA_ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#6366f1"/><text x="256" y="340" text-anchor="middle" font-family="Arial Black" font-size="220" fill="white" font-weight="900">ESC</text></svg>';
const ICON_DATA_URI = 'data:image/svg+xml;base64,' + btoa(PWA_ICON_SVG);

const manifestJSON = JSON.stringify({
  name: 'ESC Manager',
  short_name: 'ESC',
  start_url: window.location.origin + window.location.pathname,
  display: 'standalone',
  background_color: '#0a0f1e',
  theme_color: '#6366f1',
  icons: [{ src: ICON_DATA_URI, sizes: '512x512', type: 'image/svg+xml' }]
});

const manifestLink = document.createElement('link');
manifestLink.rel = 'manifest';
manifestLink.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(manifestJSON);
document.head.appendChild(manifestLink);

// === 서비스 워커 정리 (blob SW 제거) ===
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(reg => {
      if (reg.active && reg.active.scriptURL.startsWith('blob:')) {
        reg.unregister().then(() => console.log('🧹 stale blob SW unregistered'));
      }
    });
  }).catch(() => {});
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
  loadScript('https://cdn.jsdelivr.net/npm/chart.js'),
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

// === Shared Modules ===
import { DATA, PRODUCTS, ISSUES, currentUser, currentTab, selectedSN, sidebarCollapsed, isDarkMode, unsubProduction, unsubIssues, setState } from './state.js';
import { PROC_ORDER, PROC_COLORS, EQ_MAP, DEFAULT_WIDGETS } from './constants.js';
import { esc, statusBadge, extractCategory, mdToHtml, toast } from './app-utils.js';

// === New Module Imports ===
import * as DateUtils from './date-utils.js';
import { fD, fmt, todayStr, diffBD, addBD } from './date-utils.js';
import * as SNGen from './sn-generator.js';
import * as ProdService from './production-service.js';
import { getRoute, getProc, buildRoute, getDefaultDays } from './production-service.js';
import * as ExcelExport from './excel-export.js';
import * as TodayService from './today-service.js';
import { getWidgets, saveWidgets } from './today-service.js';
import * as TodayView from './today-view.js';
import { renderHome } from './today-view.js';
import * as AnalysisView from './analysis-view.js';
import { renderAnalysis } from './analysis-view.js';
import * as AIService from './ai-service.js';
import * as WorkspaceView from './workspace-view.js';
import { renderWorkspace } from './workspace-view.js';
import * as WorkspaceService from './workspace-service.js';
import * as CalendarView from './calendar-view.js';
import { renderCalendar } from './calendar-view.js';
import * as GanttView from './gantt-view.js';
import { renderGantt } from './gantt-view.js';
import { drawDonutChart, drawWeeklyChart } from './chart-service.js';

export { drawDonutChart, drawWeeklyChart }; // Export for other modules importing from main


async function initFirebase() {
  const { initializeApp } = await import(FB_CDN + 'firebase-app.js');
  const { getAuth, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, onAuthStateChanged } = await import(FB_CDN + 'firebase-auth.js');
  const { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, where, writeBatch, Timestamp, serverTimestamp } = await import(FB_CDN + 'firebase-firestore.js');

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const fbTools = {
    collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
    onSnapshot, query, orderBy, where, writeBatch, Timestamp, serverTimestamp,
    GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged
  };

  setFirebase(app, auth, db, fbTools);
  setupAuth();
}

window.doLogin = async function() {
  const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = FB;
  const provider = new GoogleAuthProvider();
  try {
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('loginSpinner').style.display = 'block';
    await signInWithPopup(firebaseAuth, provider);
  } catch (e) {
    if (e.code === 'auth/popup-blocked') {
      await signInWithRedirect(firebaseAuth, provider);
    } else {
      console.error('Login error:', e);
      document.getElementById('loginError').textContent = '로그인 실패: ' + e.message;
      document.getElementById('loginError').style.display = 'block';
      document.getElementById('loginBtn').style.display = 'flex';
      document.getElementById('loginSpinner').style.display = 'none';
    }
  }
};

window.doLogout = function() {
  if (confirm('로그아웃 하시겠습니까?')) {
    FB.signOut(firebaseAuth).then(() => {
      location.reload();
    });
  }
};

function setupAuth() {
  FB.onAuthStateChanged(firebaseAuth, (user) => {
    setGlobalState('currentUser', user);
    if (user) {
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('app').style.display = 'flex';
      applyTheme();
      subscribeData();
    } else {
      document.getElementById('loginScreen').style.display = 'flex';
      document.getElementById('app').style.display = 'none';
      document.getElementById('loginBtn').style.display = 'flex';
    }
  });
}

function subscribeData() {
  if (unsubProduction) unsubProduction();
  if (unsubIssues) unsubIssues();

  const unsubP = FB.onSnapshot(FB.collection(firebaseDb, 'production'), (snap) => {
    const data = {};
    snap.forEach(d => { data[d.id] = d.data(); });
    setGlobalState('DATA', data);
    onDataChanged();
  });
  setGlobalState('unsubProduction', unsubP);

  const unsubI = FB.onSnapshot(FB.query(FB.collection(firebaseDb, 'issues'), FB.orderBy('date', 'desc')), (snap) => {
    const issues = [];
    snap.forEach(d => { issues.push({ id: d.id, ...d.data() }); });
    setGlobalState('ISSUES', issues);
    if (currentTab === 'calendar') renderCalendar();
    else if (currentTab === 'home') renderHome();
  });
  setGlobalState('unsubIssues', unsubI);

  FB.getDocs(FB.collection(firebaseDb, 'products')).then(snap => {
    const products = {};
    snap.forEach(d => { products[d.id] = d.data(); });
    setGlobalState('PRODUCTS', products);
  });
}

window.refreshData = subscribeData;

function onDataChanged() {
  switch (currentTab) {
    case 'home': renderHome(); break;
    case 'workspace': renderWorkspace(); break;
    case 'calendar': renderCalendar(); break;
    case 'gantt': renderGantt(); break;
    case 'analysis': renderAnalysis(); break;
  }
}
// === 초기화 실행 ===
initFirebase().catch(e => console.warn('Firebase init error:', e));

document.addEventListener('DOMContentLoaded', () => {
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) loginBtn.addEventListener('click', () => window.doLogin());
  
  // 초기 탭 로드
  window.switchTab(currentTab);
});

// === 전역 핸들러 바인딩 (HTML에서 사용) ===
window.todayStr = todayStr;
window.fD = fD;
window.fmt = fmt;
window.addBD = addBD;
window.diffBD = diffBD;

window.saveSNBatch = SNGen.saveSNBatch;
window.autoBatchCode = SNGen.autoBatchCode;
window.onSNProdChange = SNGen.onSNProdChange;
window.onSheetNoChange = SNGen.onSheetNoChange;
window.updateSNPreview = SNGen.updateSNPreview;
window.checkEquipConflict = SNGen.checkEquipConflict;
window.openSNModal = SNGen.openSNModal;

window.exportExcel = ExcelExport.exportExcel;
window.exportJSON = () => ExcelExport.exportJSON(PRODUCTS);

window.applyBatchStart = () => ProdService.applyBatchStart(wsSelection);
window.applyBatchComplete = () => ProdService.applyBatchComplete(wsSelection);
window.updateEquip = ProdService.updateEquip;
window.submitNGBatch = (reason) => ProdService.submitNGBatch(wsSelection, reason);

window.renderHome = renderHome;
window.openSidePanel = TodayView.openSidePanel;
window.closeSidePanel = TodayView.closeSidePanel;
window.applySpStatus = (status) => ProdService.applySpStatus(selectedSN, status);
window.quickStartProc = ProdService.quickStartProc;
window.quickCompleteProc = ProdService.quickCompleteProc;
window.deleteSN = (sn) => ProdService.deleteSN(sn || selectedSN);
window.openProcDetailModal = TodayView.openProcDetailModal;
window.saveProcDetail = (sn) => {
  const target = sn || selectedSN;
  const d = DATA[target];
  const route = getRoute(target, d);
  ProdService.saveProcDetail(target, route, extractCategory(target));
};
window.showSNQR = TodayView.showSNQR;
window.downloadQR = SNGen.downloadQR;

window.openProductModal = () => TodayView.openProductModal(PRODUCTS);
window.showProductList = () => TodayView.showProductList(PRODUCTS);
window.showProductForm = (name) => TodayView.showProductForm(name, PRODUCTS);
window.renderProductList = () => TodayView.renderProductList(PRODUCTS);
window.saveProduct = () => {
  const name = document.getElementById('pm_name').value;
  const editMode = document.getElementById('pm_editMode').value === 'edit';
  const data = {
    name,
    category: document.getElementById('pm_cat').value,
    heat: document.getElementById('pm_heat').value,
    drawing: document.getElementById('pm_drawing').value,
    shrinkage: parseFloat(document.getElementById('pm_shrink').value) || 0,
    stackQty: parseInt(document.getElementById('pm_stack').value) || 0,
    dcJoint: document.getElementById('pm_joint').value,
    d1: parseInt(document.getElementById('pm_d1').value) || 0,
    d2: parseInt(document.getElementById('pm_d2').value) || 0,
    d3: parseInt(document.getElementById('pm_d3').value) || 0,
    d4: parseInt(document.getElementById('pm_d4').value) || 0,
    d5: parseInt(document.getElementById('pm_d5').value) || 0,
    d6: parseInt(document.getElementById('pm_d6').value) || 0,
    route: buildRoute(document.getElementById('pm_cat').value, document.getElementById('pm_heat').value, document.getElementById('pm_joint').value)
  };
  ProdService.saveProduct(name, data, editMode, PRODUCTS, DATA, firebaseDb, FB, handleFirestoreError, toast, populateProductSelects, showProductList);
};
window.deleteProduct = (name, count) => ProdService.deleteProduct(name, count, PRODUCTS, firebaseDb, FB, handleFirestoreError, toast, populateProductSelects, renderProductList);

window.saveIssue = () => {
  const issue = {
    date: document.getElementById('is_date').value,
    type: document.getElementById('is_type').value,
    sn: document.getElementById('is_sn').value,
    content: document.getElementById('is_content').value
  };
  ProdService.saveIssue(issue, currentUser, firebaseDb, FB, handleFirestoreError, toast, closeModal);
};

window.renderAnalysis = renderAnalysis;
window.askAI = AIService.askAI;
window.sendChat = AIService.sendChat;
window.toggleMiniChat = AIService.toggleMiniChat;
window.sendMiniChat = AIService.sendMiniChat;

window.renderWorkspace = renderWorkspace;
window.updateBatchBar = WorkspaceView.updateBatchBar;
window.quickStatusChange = WorkspaceService.quickStatusChange;
window.applyBatch = WorkspaceService.applyBatch;
window.applyNG = WorkspaceService.applyNG;

window.renderCalendar = renderCalendar;
window.calNext = CalendarView.calNext;
window.calPrev = CalendarView.calPrev;
window.calToday = CalendarView.calToday;
window.setCalView = CalendarView.setCalView;

window.renderGantt = renderGantt;
window.setGanttView = GanttView.setGanttView;
window.ganttZoom = GanttView.ganttZoom;
window.ganttGoToday = GanttView.ganttGoToday;
window.ganttToggleAll = GanttView.ganttToggleAll;
window.toggleG = GanttView.toggleG;

window.toggleSidebar = function() {
  setGlobalState('sidebarCollapsed', !sidebarCollapsed);
  document.getElementById('sidebar').classList.toggle('collapsed', sidebarCollapsed);
};

window.toggleTheme = function() {
  setGlobalState('isDarkMode', !isDarkMode);
  localStorage.setItem('esc_theme', isDarkMode ? 'dark' : 'light');
  applyTheme();
};

window.switchTab = function(tab) {
  setGlobalState('currentTab', tab);
  const TAB_MAP = {
    home: 'homeTab', workspace: 'workspaceTab', calendar: 'calendarTab',
    gantt: 'ganttTab', analysis: 'analysisTab', ai: 'aiTab', settings: 'settingsTab'
  };
  const TAB_TITLES = {
    home: '홈', workspace: '워크스페이스', calendar: '캘린더',
    gantt: '간트차트', analysis: '분석', ai: 'AI 어시스턴트', settings: '설정'
  };

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
  
  onDataChanged();
  
  if (window.innerWidth < 768) {
    setGlobalState('sidebarCollapsed', true);
    document.getElementById('sidebar').classList.add('collapsed');
  }
};
window.ganttZoom = GanttView.ganttZoom;
window.ganttGoToday = GanttView.ganttGoToday;
window.ganttToggleAll = GanttView.ganttToggleAll;
window.toggleG = GanttView.toggleG;


// === 전역 이벤트 리스너 ===
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSidePanel();
    closeModal('reportModal');
    closeModal('deadlineModal');
    closeModal('snModal');
    closeModal('productModal');
    closeModal('widgetModal');
    closeModal('issueModal');
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

window.addEventListener('online', () => {
  const banner = document.getElementById('offlineBanner');
  if (banner) banner.style.display = 'none';
  toast('온라인 복구됨', 'success');
});

window.addEventListener('offline', () => {
  const banner = document.getElementById('offlineBanner');
  if (banner) banner.style.display = 'block';
});

// 테마 초기화
(function() {
  if (localStorage.getItem('esc_theme') === 'light') {
    setGlobalState('isDarkMode', false);
    applyTheme();
  }
})();


console.log('🎉 ESC Manager v10.0 — Loaded');
