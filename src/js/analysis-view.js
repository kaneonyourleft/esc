import { DATA, PRODUCTS, ISSUES, PROC_ORDER, PROC_COLORS } from './main.js';
import { fD, fmt, todayStr, diffBD } from './date-utils.js';
import { getProc, getRoute, extractCategory } from './production-service.js';
import { drawDonutChart, drawWeeklyChart } from './main.js';

/**
 * Render Analysis Tab
 */
export function renderAnalysis() {
  const container = document.getElementById('analysisContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="grid2">
      <div class="card">
        <div class="card-title">현황 요약</div>
        <div id="statsSummary"></div>
      </div>
      <div class="card">
        <div class="card-title">지연 리스트</div>
        <div id="delayList" style="max-height:300px;overflow-y:auto"></div>
      </div>
    </div>
    <div class="grid2" style="margin-top:20px">
      <div class="card">
        <div class="card-title">상태별 분포</div>
        <canvas id="analysisDonut" height="300"></canvas>
      </div>
      <div class="card">
        <div class="card-title">주간 생산 추이 (시작/완료)</div>
        <canvas id="analysisWeekly" height="300"></canvas>
      </div>
    </div>
    <div class="card" style="margin-top:20px">
      <div class="card-title">제품별 통계</div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>제품</th><th>진행</th><th>완료</th><th>지연</th><th>평균소요일</th></tr>
          </thead>
          <tbody id="productStatsTable"></tbody>
        </table>
      </div>
    </div>
  `;

  renderAllCharts();
}

function renderAllCharts() {
  // Statistics Summary
  const stats = { total: 0, wait: 0, prog: 0, done: 0, delay: 0, ng: 0 };
  Object.values(DATA).forEach(d => {
    stats.total++;
    const s = d.status || '대기';
    if (s === '대기') stats.wait++;
    else if (s === '진행') stats.prog++;
    else if (s === '완료') stats.done++;
    else if (s === '지연') stats.delay++;
    else if (s === '폐기') stats.ng++;
  });

  document.getElementById('statsSummary').innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center">
      <div><div style="font-size:20px;font-weight:600">${stats.total}</div><div style="font-size:12px;color:var(--t2)">전체</div></div>
      <div><div style="font-size:20px;font-weight:600;color:var(--ac2)">${stats.prog}</div><div style="font-size:12px;color:var(--t2)">진행</div></div>
      <div><div style="font-size:20px;font-weight:600;color:var(--suc)">${stats.done}</div><div style="font-size:12px;color:var(--t2)">완료</div></div>
      <div><div style="font-size:20px;font-weight:600;color:var(--err)">${stats.delay}</div><div style="font-size:12px;color:var(--t2)">지연</div></div>
      <div><div style="font-size:20px;font-weight:600;color:var(--t2)">${stats.wait}</div><div style="font-size:12px;color:var(--t2)">대기</div></div>
      <div><div style="font-size:20px;font-weight:600;color:#71717a">${stats.ng}</div><div style="font-size:12px;color:var(--t2)">폐기</div></div>
    </div>
  `;

  // Delay List
  const delayed = Object.entries(DATA).filter(([, d]) => d.status === '지연');
  const delayList = document.getElementById('delayList');
  if (delayed.length) {
    delayList.innerHTML = delayed.map(([sn, d]) => `
      <div class="recent-item" onclick="openSidePanel('${sn}')" style="cursor:pointer">
        <div style="display:flex;justify-content:space-between;margin-bottom:2px">
          <span style="font-weight:600">${sn}</span>
          <span style="color:var(--err)">${d.currentProcess || '-'}</span>
        </div>
        <div style="font-size:11px;color:var(--t2)">납기: ${fmt(fD(d.endDate))}</div>
      </div>
    `).join('');
  } else {
    delayList.innerHTML = '<div style="text-align:center;padding:20px;color:var(--t2)">지연 항목 없음</div>';
  }

  // Double call to ensure drawDonutChart and drawWeeklyChart work with new IDs
  if (document.getElementById('analysisDonut')) drawDonutChart('analysisDonut');
  if (document.getElementById('analysisWeekly')) drawWeeklyChart('analysisWeekly');

  // Product Stats Table
  const pStats = {};
  Object.values(DATA).forEach(d => {
    const p = d.productName || '미지정';
    if (!pStats[p]) pStats[p] = { prog: 0, done: 0, delay: 0, days: [] };
    const s = d.status || '대기';
    if (s === '진행') pStats[p].prog++;
    else if (s === '완료') {
      pStats[p].done++;
      if (d.startDate && d.completedAt) {
        const diff = diffBD(fD(d.startDate), fD(d.completedAt));
        pStats[p].days.push(diff);
      }
    } else if (s === '지연') pStats[p].delay++;
  });

  const tbody = document.getElementById('productStatsTable');
  tbody.innerHTML = Object.entries(pStats).map(([p, s]) => {
    const avg = s.days.length ? Math.round(s.days.reduce((a, b) => a + b, 0) / s.days.length * 10) / 10 : '-';
    return `<tr><td>${p}</td><td>${s.prog}</td><td>${s.done}</td><td><span style="color:${s.delay ? 'var(--err)' : 'inherit'}">${s.delay}</span></td><td>${avg}</td></tr>`;
  }).join('');
}
