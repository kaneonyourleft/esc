/**
 * ESC Manager - Global State
 * @module state
 */

export let DATA = {};           // production 데이터
export let PRODUCTS = {};       // 제품 마스터
export let ISSUES = [];         // 이슈 목록
export let currentUser = null;
export let firebaseApp = null;
export let firebaseAuth = null;
export let firebaseDb = null;
export let FB = {};
export let currentTab = 'home';
export let selectedSN = null;   // 사이드패널 선택 SN
export let sidebarCollapsed = false;
export let isDarkMode = true;
export let calDate = new Date();
export let calViewMode = 'month';
export let ganttViewMode = 'product';
export let ganttDayWidth = 30;
export let ganttGroupState = {};
export let wsViewMode = localStorage.getItem('wsViewMode') || 'product';
export let wsFilters = ['전체'];
export let wsGroups = {};
export let wsSelection = new Set();
export let wsAllExpanded = false;
export let ganttAllExpanded = false;
export let miniChatOpen = false;
export let widgetCache = null;
export let scheduleRenderRAF = null;
export let unsubProduction = null;
export let unsubIssues = null;

export const setFirebase = (app, auth, db, fb) => {
  firebaseApp = app;
  firebaseAuth = auth;
  firebaseDb = db;
  FB = fb;
};

export const setGlobalState = (key, val) => {
  if (key === 'DATA') DATA = val;
  else if (key === 'PRODUCTS') PRODUCTS = val;
  else if (key === 'ISSUES') ISSUES = val;
  else if (key === 'currentUser') currentUser = val;
  else if (key === 'currentTab') currentTab = val;
  else if (key === 'isDarkMode') isDarkMode = val;
  // ...
};
