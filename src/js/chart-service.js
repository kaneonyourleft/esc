/**
 * ESC Manager - Chart Services
 * @module chart-service
 */
import { DATA } from './state.js';
import { fD, todayStr } from './date-utils.js';

/**
 * Draw Donut Chart for status distribution
 */
export function drawDonutChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  
  const counts = { '대기': 0, '진행': 0, '완료': 0, '지연': 0, '폐기': 0 };
  Object.values(DATA).forEach(d => {
    const s = d.status || '대기';
    if (counts[s] !== undefined) counts[s]++;
  });

  const ctx = canvas.getContext('2d');
  if (canvas.chart) canvas.chart.destroy();
  
  canvas.chart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(counts),
      datasets: [{
        data: Object.values(counts),
        backgroundColor: ['#94a3b8', '#3b82f6', '#10b981', '#ef4444', '#71717a'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', boxWidth: 12, font: { size: 11 } } }
      },
      cutout: '70%'
    }
  });
}

/**
 * Draw Weekly Trend Chart (Start vs Complete)
 */
export function drawWeeklyChart(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const labels = [];
  const starts = [];
  const completes = [];
  
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = fD(d);
    labels.push(d.getMonth() + 1 + '/' + d.getDate());
    
    let sCount = 0, cCount = 0;
    Object.values(DATA).forEach(item => {
      // Simplistic check: if any process started/ended today
      if (item.processes) {
        Object.values(item.processes).forEach(p => {
          if (fD(p.actualStart) === dateStr) sCount++;
          if (fD(p.actualEnd) === dateStr) cCount++;
        });
      }
    });
    starts.push(sCount);
    completes.push(cCount);
  }

  const ctx = canvas.getContext('2d');
  if (canvas.chart) canvas.chart.destroy();
  
  canvas.chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: '시작', data: starts, borderColor: '#3b82f6', tension: 0.3, fill: false },
        { label: '완료', data: completes, borderColor: '#10b981', tension: 0.3, fill: false }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: { size: 10 } } }
      },
      plugins: {
        legend: { position: 'top', labels: { color: '#94a3b8', boxWidth: 12, font: { size: 11 } } }
      }
    }
  });
}
