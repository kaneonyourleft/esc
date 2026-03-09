/* ============================================================
   today-service.js – 오늘 할 일 데이터 서비스
   ESC Manager v10 – Field Execution First
   ============================================================ */
import { fD, getProc, getRoute, extractCategory, extractBatchFromSN } from './utils.js';

/**
 * 오늘 날짜를 YYYY-MM-DD 형식으로 반환
 */
export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

/**
 * 지연된 작업 필터링
 * 조건: processes[currentProcess].planEnd < 오늘 && status === '진행'
 */
export function getDelayedTasks(data) {
  const today = todayStr();
  const delayed = [];

  Object.entries(data).forEach(([sn, d]) => {
    if ((d.status || '대기') !== '진행') return;
    
    const currentProcess = d.currentProcess;
    if (!currentProcess) return;

    const procData = getProc(d, currentProcess);
    const planEnd = fD(procData.planEnd);
    
    if (planEnd && planEnd < today) {
      delayed.push({
        sn,
        data: d,
        process: currentProcess,
        planEnd,
        delayDays: calculateDelayDays(planEnd, today)
      });
    }
  });

  return delayed;
}

/**
 * 오늘의 작업 필터링
 * 조건: processes[공정].planStart === 오늘 || processes[공정].actualStart === 오늘
 */
export function getTodayTasks(data) {
  const today = todayStr();
  const tasks = [];

  Object.entries(data).forEach(([sn, d]) => {
    const route = getRoute(sn, d);
    
    route.forEach(proc => {
      const procData = getProc(d, proc);
      const planStart = fD(procData.planStart);
      const actualStart = fD(procData.actualStart);
      
      // 오늘 시작 예정이거나 오늘 시작한 공정
      if (planStart === today || actualStart === today) {
        tasks.push({
          sn,
          data: d,
          process: proc,
          procData,
          status: procData.status || '대기'
        });
      }
    });
  });

  return tasks;
}

/**
 * 배치별로 작업 그룹핑
 * 같은 batch + 같은 currentProcess인 S/N들을 하나의 그룹으로 묶음
 */
export function groupByBatch(tasks) {
  const groups = {};

  tasks.forEach(task => {
    const batch = task.data.batch || task.data.batchId || extractBatchFromSN(task.sn) || '기타';
    const proc = task.process;
    const key = `${batch}::${proc}`;

    if (!groups[key]) {
      groups[key] = {
        batch,
        process: proc,
        product: task.data.productName || extractCategory(task.sn) || '기타',
        equipment: task.procData?.equip || '',
        items: [],
        status: task.status,
        deadline: fD(task.data.endDate),
        delayDays: task.delayDays || 0
      };
    }

    groups[key].items.push(task);
  });

  return Object.values(groups);
}

/**
 * 지연 일수 계산 (영업일 기준)
 */
function calculateDelayDays(planEnd, today) {
  const start = new Date(planEnd);
  const end = new Date(today);
  let count = 0;

  const current = new Date(start);
  while (current < end) {
    current.setDate(current.getDate() + 1);
    const day = current.getDay();
    // 주말 제외 (0: 일요일, 6: 토요일)
    if (day !== 0 && day !== 6) {
      count++;
    }
  }

  return count;
}

/**
 * 납기일까지 남은 일수 계산 (D-n 형식)
 */
export function getDaysUntilDeadline(deadline) {
  if (!deadline) return '';
  
  const today = new Date(todayStr());
  const end = new Date(deadline);
  
  const diffTime = end - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return `D+${Math.abs(diffDays)}`;
  if (diffDays === 0) return 'D-Day';
  return `D-${diffDays}`;
}

/**
 * S/N 범위 표시 (예: L028~L045)
 */
export function getSerialRange(items) {
  if (!items || items.length === 0) return '';
  if (items.length === 1) return items[0].sn;

  const sns = items.map(item => item.sn).sort();
  const first = sns[0];
  const last = sns[sns.length - 1];

  // 같은 패턴의 시리얼 번호인 경우 범위로 표시
  const firstMatch = first.match(/([A-Z]+)(\d+)/);
  const lastMatch = last.match(/([A-Z]+)(\d+)/);

  if (firstMatch && lastMatch && firstMatch[1] === lastMatch[1]) {
    return `${firstMatch[1]}${firstMatch[2]}~${lastMatch[2]}`;
  }

  return `${first}~${last}`;
}
