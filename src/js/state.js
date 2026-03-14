
export let DATA = {};
export let PRODUCTS = {};
export let ISSUES = [];
export let currentUser = null;
export let currentTab = 'home';
export let selectedSN = null;
export let sidebarCollapsed = false;
export let isDarkMode = true;
export let calDate = new Date();
export let calViewMode = 'month';
export let ganttViewMode = 'product';
export let ganttDayWidth = 30;
export let ganttGroupState = {};
export let wsViewMode = localStorage.getItem('wsViewMode') || 'product';
export let wsFilter = '전체';
export let wsGroupState = {};
export let wsSelection = new Set();
export let wsAllExpanded = false;
export let ganttAllExpanded = false;
export let miniChatOpen = false;
export let widgetCache = null;
export let PROC_ORDER = ['탈지', '소성', '환원소성', '평탄화', '도금', '열처리'];
export let STATUS_LIST = ['대기', '진행', '완료', '지연', '폐기'];
export let scheduleRenderRAF = null;
export let unsubProduction = null;
export let unsubIssues = null;

export function set(key, value) {
  switch (key) {
    case 'DATA': DATA = value; break;
    case 'PRODUCTS': PRODUCTS = value; break;
    case 'ISSUES': ISSUES = value; break;
    case 'currentUser': currentUser = value; break;
    case 'currentTab': currentTab = value; break;
    case 'selectedSN': selectedSN = value; break;
    case 'sidebarCollapsed': sidebarCollapsed = value; break;
    case 'isDarkMode': isDarkMode = value; break;
    case 'calDate': calDate = value; break;
    case 'calViewMode': calViewMode = value; break;
    case 'ganttViewMode': ganttViewMode = value; break;
    case 'ganttDayWidth': ganttDayWidth = value; break;
    case 'ganttGroupState': ganttGroupState = value; break;
    case 'wsViewMode': wsViewMode = value; break;
    case 'wsFilter': wsFilter = value; break;
    case 'wsGroupState': wsGroupState = value; break;
    case 'wsSelection': wsSelection = value; break;
    case 'wsAllExpanded': wsAllExpanded = value; break;
    case 'ganttAllExpanded': ganttAllExpanded = value; break;
    case 'miniChatOpen': miniChatOpen = value; break;
    case 'widgetCache': widgetCache = value; break;
    case 'PROC_ORDER': PROC_ORDER = value; break;
    case 'STATUS_LIST': STATUS_LIST = value; break;
    case 'scheduleRenderRAF': scheduleRenderRAF = value; break;
    case 'unsubProduction': unsubProduction = value; break;
    case 'unsubIssues': unsubIssues = value; break;
  }
}
