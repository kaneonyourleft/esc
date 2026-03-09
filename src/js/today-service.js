/**
 * ESC Manager - Today View Data Transformation Service
 * @module today-service
 */
import { fD, todayStr, diffBD } from './date-utils.js';
import { DATA } from './state.js';
import { PROC_ORDER, PROC_COLORS, DEFAULT_WIDGETS } from './constants.js';
import { buildRoute, getProc } from './production-service.js';

let widgetCache = null;

export function getWidgets() {
  if (widgetCache) return widgetCache;
  try {
    const saved = localStorage.getItem('esc_widgets');
    if (saved) return widgetCache = JSON.parse(saved);
  } catch {}
  return widgetCache = JSON.parse(JSON.stringify(DEFAULT_WIDGETS));
}

export function saveWidgets(list) {
  widgetCache = list;
  localStorage.setItem('esc_widgets', JSON.stringify(list));
}

/**
 * Aggregate KPI statistics for widgets
 */
export function getKpiStats() {
  const total = Object.keys(DATA).length;
  let prog = 0, done = 0, delay = 0;
  Object.values(DATA).forEach(d => {
    const s = d.status || '대기';
    if (s === '진행') prog++;
    if (s === '완료') done++;
    if (s === '지연') delay++;
  });
  return { total, prog, done, delay };
}

/**
 * Calculate pipeline statistics per process
 */
export function getPipelineStats() {
  let stats = {};
  PROC_ORDER.forEach(p => stats[p] = { total: 0, done: 0 });
  Object.entries(DATA).forEach(([sn, d]) => {
    const route = buildRoute(d.category, d.heat, d.dcJoint);
    route.forEach(proc => {
      if (!stats[proc]) stats[proc] = { total: 0, done: 0 };
      stats[proc].total++;
      if (getProc(d, proc).status === '완료') stats[proc].done++;
    });
  });
  return stats;
}

/**
 * Get work items scheduled for today
 */
export function getTodayTasks() {
  const today = todayStr();
  let items = [];
  Object.entries(DATA).forEach(([sn, d]) => {
    const route = buildRoute(d.category, d.heat, d.dcJoint);
    route.forEach(proc => {
      const p = getProc(d, proc);
      if (fD(p.planStart) === today || fD(p.planEnd) === today || fD(p.actualStart) === today) {
        items.push({ sn, proc, data: p });
      }
    });
  });
  return items;
}

/**
 * Get delay and upcoming deadline alerts
 */
export function getAlerts() {
  const today = todayStr();
  const delayed = Object.entries(DATA)
    .filter(([, d]) => (d.status || '대기') === '지연')
    .map(([sn]) => sn);
  
  const upcoming = Object.entries(DATA).filter(([, d]) => {
    if (!d.endDate || (d.status || '대기') === '완료') return false;
    const diff = diffBD(today, fD(d.endDate));
    return diff >= 0 && diff <= 3;
  }).map(([sn, d]) => ({ sn, endDate: d.endDate }));

  return { delayed, upcoming };
}
