/* ============================================================
   ai-context.js – AI 컨텍스트 빌더 전용
   ESC Manager v10 – Smart AI Assistant
   ============================================================ */
import * as S from './state.js';
import { PROC_ORDER } from './constants.js';
import { fD, getProc, getRoute } from './utils.js';

/**
 * 실시간 데이터 기반 컨텍스트 문자열 생성
 */
export function buildContext() {
  const data = Object.entries(S.DATA);
  const total = data.length;
  const today = new Date().toISOString().split('T')[0];

  // 상태별 카운트
  const statusCount = { 대기: 0, 진행: 0, 완료: 0, 지연: 0, 폐기: 0 };
  data.forEach(([, d]) => {
    const s = d.status || '대기';
    if (statusCount[s] !== undefined) statusCount[s]++;
  });

  // 공정별 현황
  const procStats = {};
  const procOrder = S.PROC_ORDER || PROC_ORDER;
  procOrder.forEach(p => { procStats[p] = { 대기: 0, 진행: 0, 완료: 0 }; });
  data.forEach(([sn, d]) => {
    getRoute(sn, d).forEach(proc => {
      const pd = getProc(d, proc);
      const st = pd.status || '대기';
      if (procStats[proc] && procStats[proc][st] !== undefined) procStats[proc][st]++;
    });
  });

  // 지연 목록 (최대 10건)
  const delayed = data
    .filter(([, d]) => d.status === '지연')
    .slice(0, 10)
    .map(([sn, d]) => `${sn} (${d.currentProcess || '?'}, ${d.productName || '?'})`);

  // 오늘 작업
  const todayTasks = [];
  data.forEach(([sn, d]) => {
    getRoute(sn, d).forEach(proc => {
      const p = getProc(d, proc);
      if (fD(p.planStart) === today || fD(p.actualStart) === today) {
        todayTasks.push(`${sn} ${proc} (${p.status || '대기'})`);
      }
    });
  });

  // 설비 가동
  const equipUsage = {};
  data.forEach(([sn, d]) => {
    if (d.status !== '진행') return;
    const proc = d.currentProcess;
    if (!proc) return;
    const eq = getProc(d, proc).equip;
    if (eq) {
      if (!equipUsage[eq]) equipUsage[eq] = [];
      equipUsage[eq].push(sn);
    }
  });

  // 최근 이슈
  const recentIssues = (S.ISSUES || [])
    .slice(0, 5)
    .map(i => `${i.date || ''} ${i.type || ''}: ${i.content || ''}`);

  return `[ESC Manager 실시간 데이터]
날짜: ${today}
전체: ${total}건 | 대기: ${statusCount.대기} | 진행: ${statusCount.진행} | 완료: ${statusCount.완료} | 지연: ${statusCount.지연} | 폐기: ${statusCount.폐기}

공정별 현황:
${procOrder.map(p => `${p}: 대기${procStats[p].대기} 진행${procStats[p].진행} 완료${procStats[p].완료}`).join('\n')}

지연 목록(${delayed.length}건): ${delayed.join(', ') || '없음'}
오늘 작업(${todayTasks.length}건): ${todayTasks.slice(0, 10).join(', ') || '없음'}

설비 가동:
${Object.entries(equipUsage).map(([eq, sns]) => `${eq}: ${sns.length}건 가동중`).join('\n') || '가동중 설비 없음'}

최근 이슈: ${recentIssues.join(' | ') || '없음'}
제품 종류: ${Object.keys(S.PRODUCTS || {}).length}개`;
}

/**
 * 자연어 명령 감지 패턴
 */
export function parseCommand(text) {
  const todayStr = new Date().toISOString().split('T')[0];
  const patterns = [
    {
      // 예: "BL2401 5장 내일 투입", "DC3000 10개 오늘 시작"
      regex: /([A-Z0-9-]{3,})\s*(\d+)(?:장|개|EA)?\s*(오늘|내일|모레|(?:\d{1,2}\/\d{1,2}))(?:부터)?\s*(?:투입|시작|생산)/i,
      action: 'create_sn',
      map: (m) => {
        let date = m[3];
        if (date === '오늘') date = todayStr;
        else if (date === '내일') {
          const d = new Date(); d.setDate(d.getDate() + 1);
          date = d.toISOString().split('T')[0];
        } else if (date === '모레') {
          const d = new Date(); d.setDate(d.getDate() + 2);
          date = d.toISOString().split('T')[0];
        }
        return { product: m[1], qty: parseInt(m[2]), date };
      }
    },
    {
      // 예: "SN240315-001 소성 완료", "SN-123 탈지 시작"
      regex: /([A-Z0-9-]{5,})\s*(탈지|소성|환원소성|평탄화|도금|열처리)\s*(시작|완료)/i,
      action: 'proc_change',
      map: (m) => ({ sn: m[1], proc: m[2], status: m[3] })
    },
    {
      regex: /([A-Z]{2}\d{4,}[-\w]*)\s*(상태|현황|정보)/i,
      action: 'sn_info'
    },
    {
      regex: /(지연|병목|현황|요약)\s*(현황|분석|정보)?/i,
      action: 'analysis'
    },
  ];
  for (const p of patterns) {
    const m = text.match(p.regex);
    if (m) return { action: p.action, data: p.map ? p.map(m) : null, match: m, original: text };
  }
  return null;
}
