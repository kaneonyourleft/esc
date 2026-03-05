export let D=[];export let PRODS=[];export let ISSUES=[];
export let currentUser=null;export let currentSN=null;
export let currentTab='home';export let sidebarCollapsed=false;
export let isDark=true;export let wsFilters=['전체'];export let wsGroups={};
export let selectedSNs=new Set();
export let ganttView='product';export let ganttDayW=30;
export let ganttExpandState={};export let ganttAllExpanded=false;
export let calView='month';export let calDate=new Date();
export let dlData=null;export let wsViewMode='product';
export let equipSectionOpen=false;export let kanbanOpen=false;
export let pendingAIAction=null;
export let db=null;export let auth=null;
export let unsubProd=null;export let unsubIssues=null;
export let widgetConfig=[];

export function setD(v){D=v}
export function setPRODS(v){PRODS=v}
export function setISSUES(v){ISSUES=v}
export function setCurrentUser(v){currentUser=v}
export function setCurrentSN(v){currentSN=v}
export function setCurrentTab(v){currentTab=v}
export function setSidebarCollapsed(v){sidebarCollapsed=v}
export function setIsDark(v){isDark=v}
export function setWsFilters(v){wsFilters=v}
export function setWsGroups(v){wsGroups=v}
export function setSelectedSNs(v){selectedSNs=v}
export function setGanttView(v){ganttView=v}
export function setGanttDayW(v){ganttDayW=v}
export function setGanttExpandState(v){ganttExpandState=v}
export function setGanttAllExpanded(v){ganttAllExpanded=v}
export function setCalView(v){calView=v}
export function setCalDate(v){calDate=v}
export function setDlData(v){dlData=v}
export function setWsViewMode(v){wsViewMode=v}
export function setEquipSectionOpen(v){equipSectionOpen=v}
export function setKanbanOpen(v){kanbanOpen=v}
export function setPendingAIAction(v){pendingAIAction=v}
export function setDb(v){db=v}
export function setAuth(v){auth=v}
export function setUnsubProd(v){unsubProd=v}
export function setUnsubIssues(v){unsubIssues=v}
export function setWidgetConfig(v){widgetConfig=v}

/* ── 통합 상태 객체 (읽기 전용 접근용) ── */
export const S = {
  get D() { return D; },
  get PRODS() { return PRODS; },
  get ISSUES() { return ISSUES; },
  get currentUser() { return currentUser; },
  get currentSN() { return currentSN; },
  get currentTab() { return currentTab; },
  get sidebarCollapsed() { return sidebarCollapsed; },
  get isDark() { return isDark; },
  get wsFilters() { return wsFilters; },
  get wsGroups() { return wsGroups; },
  get selectedSNs() { return selectedSNs; },
  get ganttView() { return ganttView; },
  get ganttDayW() { return ganttDayW; },
  get ganttExpandState() { return ganttExpandState; },
  get ganttAllExpanded() { return ganttAllExpanded; },
  get calView() { return calView; },
  get calDate() { return calDate; },
  get dlData() { return dlData; },
  get wsViewMode() { return wsViewMode; },
  get equipSectionOpen() { return equipSectionOpen; },
  get kanbanOpen() { return kanbanOpen; },
  get pendingAIAction() { return pendingAIAction; },
  get db() { return db; },
  get auth() { return auth; },
  get unsubProd() { return unsubProd; },
  get unsubIssues() { return unsubIssues; },
  get widgetConfig() { return widgetConfig; },
};

