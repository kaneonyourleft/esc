/* ============================================================
   today-service.js – 오늘 할 일 데이터 서비스
   ESC Manager v10 – Field Execution First
   ============================================================ */
import { fD, getProc, getRoute, extractCategory, extractBatchFromSN } from './utils.js';

/**
 * 날짜를 YYYY-MM-DD 형식으로 반환 (기본: 오늘)
 */
export function todayStr(date) {
  const d = date || new Date();
  return d.toISOString().split('T')[0];
}

/**
 * 지연된 작업 필터링
 * 조건: processes[currentProcess].planEnd < 선택일 && item.status === '진행'
 * (item-level status '진행'이거나 process-level status '진행')
 */
export function getDelayedTasks(data, selectedDate) {
  const refDate = todayStr(selectedDate);
  const delayed = [];

  Object.entries(data).forEach(([sn, d]) => {
    // item 전체 status가 '진행' 이거나, currentProcess 상태가 '진행'인 것
    const itemStatus = d.status || '대기';
    const currentProcess = d.currentProcess;
    if (!currentProcess) return;

    const procData = getProc(d, currentProcess);
    const procStatus = procData.status || '대기';

    // '완료' 또는 '폐기'는 제외
    if (itemStatus === '완료' || itemStatus === '폐기') return;

    const planEnd = fD(procData.planEnd);
    if (!planEnd) return;

    // planEnd가 선택일보다 이전이고, 공정이 완료되지 않은 것
    if (planEnd < refDate && procStatus !== '완료') {
      delayed.push({
        sn,
        data: d,
        process: currentProcess,
        procData,
        planEnd,
        status: procStatus,
        delayDays: calculateDelayDays(planEnd, refDate)
      });
    }
  });

  // 지연일수 많은 순으로 정렬
  return delayed.sort((a, b) => b.delayDays - a.delayDays);
}

/**
 * 선택된 날짜의 작업 필터링
 * 조건: processes[공정].planStart === 선택일 || processes[공정].actualStart === 선택일
 */
export function getTodayTasks(data, selectedDate) {
  const refDate = todayStr(selectedDate);
  const tasks = [];
  const seen = new Set(); // 중복 방지

  Object.entries(data).forEach(([sn, d]) => {
    // 완료/폐기된 item은 제외
    const itemStatus = d.status || '대기';
    if (itemStatus === '완료' || itemStatus === '폐기') return;

    const route = getRoute(sn, d);

    route.forEach(proc => {
      const procData = getProc(d, proc);
      const planStart = fD(procData.planStart);
      const actualStart = fD(procData.actualStart);
      const procStatus = procData.status || '대기';

      // 이미 완료된 공정은 제외
      if (procStatus === '완료') return;

      // 오늘 시작 예정이거나 오늘 시작한 공정
      if (planStart === refDate || actualStart === refDate) {
        const key = `${sn}::${proc}`;
        if (!seen.has(key)) {
          seen.add(key);
          tasks.push({
            sn,
            data: d,
            process: proc,
            procData,
            status: procStatus
          });
        }
      }
    });
  });

  return tasks;
}

/**
 * 배치별로 작업 그룹핑
 * 같은 batch + 같은 process인 S/N들을 하나의 그룹으로 묶음
 * quantity = 그룹의 S/N 수
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
        equipment: task.procData?.equip || task.data.processes?.[proc]?.equip || '',
        items: [],
        status: task.status,
        deadline: fD(task.data.endDate || task.data.deliveryDate),
        delayDays: task.delayDays || 0
      };
    }

    // 그룹 내 status: 하나라도 '진행'이면 '진행'
    if (task.status === '진행') {
      groups[key].status = '진행';
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
  if (start >= end) return 0;

  let count = 0;
  const current = new Date(start);
  current.setDate(current.getDate() + 1); // planEnd 다음 날부터 카운트

  while (current <= end) {
    const day = current.getDay();
    // 주말 제외 (0: 일요일, 6: 토요일)
    if (day !== 0 && day !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * 납기일까지 남은 일수 계산 (D-n 형식)
 */
export function getDaysUntilDeadline(deadline) {
  if (!deadline) return '';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(deadline);
  end.setHours(0, 0, 0, 0);

  const diffTime = end - today;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `D+${Math.abs(diffDays)}`;
  if (diffDays === 0) return 'D-Day';
  return `D-${diffDays}`;
}

/**
 * S/N 범위 표시 (예: WN240001~WN240010)
 */
export function getSerialRange(items) {
  if (!items || items.length === 0) return '';
  if (items.length === 1) return items[0].sn;

  const sns = items.map(item => item.sn).sort();
  const first = sns[0];
  const last = sns[sns.length - 1];

  // 같은 패턴의 시리얼 번호인 경우 범위로 표시 (영문+숫자)
  const firstMatch = first.match(/^([A-Za-z]+)(\d+)(.*)$/);
  const lastMatch = last.match(/^([A-Za-z]+)(\d+)(.*)$/);

  if (firstMatch && lastMatch && firstMatch[1] === lastMatch[1]) {
    return `${firstMatch[1]}${firstMatch[2]}~${lastMatch[2]}`;
  }

  return `${first} ~ ${last}`;
}
