import * as S from './state.js';
import { PROC_COLORS } from './constants.js';
import { fD } from './utils.js';

export function renderAnalysis() {
  const dataArr = Object.values(S.DATA);
  const total = dataArr.length;
  const done = dataArr.filter(d => d.status === '완료').length;
  const late = dataArr.filter(d => d.status === '지연').length;
  const prog = dataArr.filter(d => d.status === '진행').length;
  const prodCount = [...new Set(dataArr.map(d => d.productName))].length;
  const defectCount = dataArr.filter(d => d.status === '폐기' || d.defectType === 'NG').length;
  const defectRate = total ? Math.round(defectCount / total * 1000) / 10 : 0;

  const kpiEl = document.getElementById('analysisKpi');
  if (kpiEl) {
    kpiEl.innerHTML = `
      <div class="kpi-card"><div class="kpi-lbl">완료율</div><div class="kpi-val" style="color:var(--suc)">${total ? Math.round(done / total * 100) : 0}%</div><div style="font-size:11px;color:var(--t2)">${done}/${total}</div></div>
      <div class="kpi-card"><div class="kpi-lbl">지연율</div><div class="kpi-val" style="color:var(--err)">${total ? Math.round(late / total * 100) : 0}%</div><div style="font-size:11px;color:var(--t2)">${late}건</div></div>
      <div class="kpi-card"><div class="kpi-lbl">불량률</div><div class="kpi-val" style="color:#f97316">${defectRate}%</div><div style="font-size:11px;color:var(--t2)">${defectCount}건</div></div>
      <div class="kpi-card"><div class="kpi-lbl">제품 수</div><div class="kpi-val">${prodCount}</div><div style="font-size:11px;color:var(--t2)">등록된 제품</div></div>
    `;
  }

  drawProdBarChart();
  drawDonutChart('analysisDonut', {
    대기: dataArr.filter(d => d.status === '대기').length,
    진행: prog,
    완료: done,
    지연: late,
    폐기: dataArr.filter(d => d.status === '폐기').length
  });
  drawMonthLineChart();
  drawLeadtimeChart();
  drawDefectRateChart();
  drawDefectProcChart();
}

// Export drawDonutChart so home.js can use it if needed
export function drawDonutChart(canvasId, counts) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  if (!counts) {
    counts = { '대기': 0, '진행': 0, '완료': 0, '지연': 0, '폐기': 0 };
    Object.values(S.DATA).forEach(d => {
      const s = d.status || '대기';
      if (counts[s] !== undefined) counts[s]++;
    });
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.parentElement ? canvas.parentElement.clientWidth - 32 : 300;
  const H = canvas.height = 240;
  ctx.clearRect(0, 0, W, H);

  if (!total) {
    ctx.fillStyle = cs('--t2');
    ctx.font = '14px Inter, Noto Sans KR, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LOT 데이터가 없습니다', W / 2, H / 2);
    return;
  }

  const colorMap = { '대기': '#64748b', '진행': '#6366f1', '완료': '#10b981', '지연': '#ef4444', '폐기': '#71717a' };
  const cx = W / 2, cy = H / 2 - 10;
  const outerR = Math.min(W, H) / 2 - 40;
  const innerR = outerR * 0.55;
  let angle = -Math.PI / 2;

  Object.entries(counts).forEach(([status, count]) => {
    if (!count) return;
    const slice = count / total * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = colorMap[status] || '#666';
    ctx.fill();
    angle += slice;
  });

  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = cs('--bg2') || '#111827';
  ctx.fill();

  ctx.fillStyle = cs('--t1') || '#f9fafb';
  ctx.font = 'bold 20px Inter, Noto Sans KR, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(total, cx, cy + 2);
  ctx.font = '12px Inter, Noto Sans KR, sans-serif';
  ctx.fillStyle = cs('--t2') || '#9ca3af';
  ctx.fillText('전체', cx, cy + 18);

  let lx = 10;
  const ly = H - 18;
  Object.entries(counts).forEach(([status, count]) => {
    if (!count) return;
    ctx.fillStyle = colorMap[status];
    ctx.fillRect(lx, ly, 10, 10);
    ctx.fillStyle = cs('--t2') || '#9ca3af';
    ctx.font = '11px Inter, Noto Sans KR, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${status} ${count}`, lx + 14, ly + 9);
    lx += ctx.measureText(`${status} ${count}`).width + 24;
  });
}

function cs(prop) {
  return getComputedStyle(document.body).getPropertyValue(prop).trim() || '';
}

function drawProdBarChart() {
  const canvas = document.getElementById('prodBarChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = 0;
  const W = canvas.parentElement ? canvas.parentElement.clientWidth : 400;
  const prodMap = {};
  Object.values(S.DATA).forEach(d => {
    const k = d.productName || '미지정';
    prodMap[k] = (prodMap[k] || 0) + 1;
  });
  const labels = Object.keys(prodMap);
  const vals = Object.values(prodMap);
  if (!labels.length) {
    canvas.height = 60; canvas.width = W;
    ctx.fillStyle = cs('--t2');
    ctx.font = '14px Inter, Noto Sans KR, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('데이터 없음', W / 2, 30);
    return;
  }
  const barH = 28;
  const pad = Math.min(100, W * 0.22);
  const h = labels.length * barH + pad * 2;
  canvas.width = W; canvas.height = h;
  ctx.clearRect(0, 0, W, h);
  const max = Math.max(...vals, 1);
  const availW = W - pad - 10;
  labels.forEach((l, i) => {
    const y = pad + i * barH;
    const bw = vals[i] / max * availW;
    const grad = ctx.createLinearGradient(pad, 0, pad + bw, 0);
    grad.addColorStop(0, '#6366f1');
    grad.addColorStop(1, '#818cf8');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(pad, y + 4, bw, barH - 8, 4) : ctx.fillRect(pad, y + 4, bw, barH - 8);
    ctx.fill();
    ctx.fillStyle = cs('--t1');
    ctx.font = '11px Inter, Noto Sans KR, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(l, pad - 6, y + barH / 2 + 4);
    ctx.textAlign = 'left';
    ctx.fillText(vals[i], pad + bw + 6, y + barH / 2 + 4);
  });
}

function drawMonthLineChart() {
  const canvas = document.getElementById('monthLineChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = 0;
  const W = canvas.parentElement ? canvas.parentElement.clientWidth : 400;
  canvas.width = W; canvas.height = 240;
  ctx.clearRect(0, 0, W, 240);
  const months = {};
  const completed = {};
  Object.values(S.DATA).forEach(d => {
    if (d.startDate) { const m = d.startDate.slice(0, 7); months[m] = (months[m] || 0) + 1; }
    if (d.endDate && d.status === '완료') { const m = d.endDate.slice(0, 7); completed[m] = (completed[m] || 0) + 1; }
  });
  const allMonths = [...new Set([...Object.keys(months), ...Object.keys(completed)])].sort().slice(-6);
  if (!allMonths.length) {
    ctx.fillStyle = cs('--t2');
    ctx.font = '14px Inter, Noto Sans KR, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('데이터 없음', W / 2, 120);
    return;
  }
  const pad = 40;
  const w = W - pad * 2;
  const h = 200 - pad;
  const sVals = allMonths.map(m => months[m] || 0);
  const dVals = allMonths.map(m => completed[m] || 0);
  const max = Math.max(...sVals, ...dVals, 1);
  const xStep = w / (allMonths.length - 1 || 1);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  [0, max / 2, max].forEach(v => {
    const y = pad + h * (1 - v / max);
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W - pad, y); ctx.stroke();
    ctx.fillStyle = cs('--t2');
    ctx.font = '10px Inter, Noto Sans KR, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(v), pad - 4, y + 4);
  });
  [[sVals, '#6366f1'], [dVals, '#10b981']].forEach(([vals, color]) => {
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2;
    vals.forEach((v, i) => {
      const x = pad + i * xStep;
      const y = pad + h * (1 - v / max);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    vals.forEach((v, i) => {
      const x = pad + i * xStep;
      const y = pad + h * (1 - v / max);
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
    });
  });
  allMonths.forEach((m, i) => {
    const x = pad + i * xStep;
    ctx.fillStyle = cs('--t2');
    ctx.font = '10px Inter, Noto Sans KR, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.slice(5), x, 240 - 8);
  });
  ctx.fillStyle = '#6366f1'; ctx.fillRect(pad, 10, 12, 8);
  ctx.fillStyle = cs('--t1');
  ctx.font = '10px Inter, Noto Sans KR, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('투입', pad + 16, 18);
  ctx.fillStyle = '#10b981'; ctx.fillRect(pad + 60, 10, 12, 8);
  ctx.fillStyle = cs('--t1'); ctx.fillText('완료', pad + 76, 18);
}

function drawLeadtimeChart() {
  const canvas = document.getElementById('leadtimeChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = 0;
  const W = canvas.parentElement ? canvas.parentElement.clientWidth : 400;
  canvas.width = W; canvas.height = 240;
  ctx.clearRect(0, 0, W, 240);
  const planAvg = {}, actualAvg = {};
  S.PROC_ORDER.forEach(p => {
    const days = [], actDays = [];
    Object.values(S.DATA).forEach(item => {
      const proc = (item.processes || {})[p];
      if (proc) {
        if (proc.planDays) days.push(proc.planDays);
        if (proc.actualDays && proc.actualDays > 0) actDays.push(proc.actualDays);
      }
    });
    planAvg[p] = days.length ? days.reduce((a, b) => a + b, 0) / days.length : 0;
    actualAvg[p] = actDays.length ? actDays.reduce((a, b) => a + b, 0) / actDays.length : 0;
  });
  const max = Math.max(...Object.values(planAvg), ...Object.values(actualAvg), 1);
  const pad = 30;
  const bw = Math.floor((W - pad * 2) / S.PROC_ORDER.length / 2 - 4);
  const availH = 180;
  S.PROC_ORDER.forEach((p, i) => {
    const x = pad + (W - pad * 2) / S.PROC_ORDER.length * i + (W - pad * 2) / S.PROC_ORDER.length / 2;
    const ph = planAvg[p] / max * availH;
    const ah = actualAvg[p] / max * availH;
    ctx.fillStyle = 'rgba(99,102,241,0.7)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x - bw - 2, 220 - ph, bw, ph, 3) : ctx.fillRect(x - bw - 2, 220 - ph, bw, ph);
    ctx.fill();
    ctx.fillStyle = 'rgba(16,185,129,0.7)';
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x + 2, 220 - ah, bw, ah, 3) : ctx.fillRect(x + 2, 220 - ah, bw, ah);
    ctx.fill();
    ctx.fillStyle = PROC_COLORS[p] || '#666';
    ctx.font = '10px Inter, Noto Sans KR, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(p, x, 236);
    if (planAvg[p] > 0) { ctx.fillStyle = cs('--t1'); ctx.fillText(planAvg[p].toFixed(1), x - bw / 2 - 2, 220 - ph - 3); }
    if (actualAvg[p] > 0) { ctx.fillStyle = cs('--t1'); ctx.fillText(actualAvg[p].toFixed(1), x + bw / 2 + 2, 220 - ah - 3); }
  });
  ctx.fillStyle = 'rgba(99,102,241,0.7)'; ctx.fillRect(pad, 5, 10, 8);
  ctx.fillStyle = cs('--t1'); ctx.font = '10px Inter, Noto Sans KR, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('계획', pad + 14, 13);
  ctx.fillStyle = 'rgba(16,185,129,0.7)'; ctx.fillRect(pad + 50, 5, 10, 8);
  ctx.fillStyle = cs('--t1'); ctx.fillText('실제', pad + 64, 13);
}

function drawDefectRateChart() {
  const canvas = document.getElementById('defectRateChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = 0;
  const W = canvas.parentElement ? canvas.parentElement.clientWidth : 400;
  const prodMap = {};
  const defectMap = {};
  Object.values(S.DATA).forEach(d => {
    const k = d.productName || '미지정';
    prodMap[k] = (prodMap[k] || 0) + 1;
    if (d.status === '폐기' || d.defectType === 'NG') defectMap[k] = (defectMap[k] || 0) + 1;
  });
  const labels = Object.keys(prodMap).sort();
  const rates = labels.map(l => prodMap[l] > 0 ? Math.round((defectMap[l] || 0) / prodMap[l] * 1000) / 10 : 0);
  if (!labels.length) {
    canvas.height = 60; canvas.width = W;
    ctx.fillStyle = cs('--t2');
    ctx.font = '14px Inter, Noto Sans KR, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('데이터 없음', W / 2, 30);
    return;
  }
  const barH = 28;
  const pad = Math.min(100, W * 0.22);
  const h = labels.length * barH + pad * 2;
  canvas.width = W; canvas.height = h;
  ctx.clearRect(0, 0, W, h);
  const max = Math.max(...rates, 1);
  const availW = W - pad - 40;
  labels.forEach((l, i) => {
    const y = pad + i * barH;
    const bw = Math.max(rates[i] / max * availW, 2);
    const barColor = rates[i] >= 10 ? 'rgba(239,68,68,0.8)' : rates[i] >= 5 ? 'rgba(249,115,22,0.8)' : 'rgba(16,185,129,0.6)';
    ctx.fillStyle = barColor;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(pad, y + 4, bw, barH - 8, 4) : ctx.fillRect(pad, y + 4, bw, barH - 8);
    ctx.fill();
    ctx.fillStyle = cs('--t1');
    ctx.font = '11px Inter, Noto Sans KR, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(l, pad - 6, y + barH / 2 + 4);
    ctx.textAlign = 'left';
    ctx.fillText(`${rates[i]}% (${defectMap[l] || 0}/${prodMap[l]})`, pad + bw + 6, y + barH / 2 + 4);
  });
}

function drawDefectProcChart() {
  const canvas = document.getElementById('defectProcChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = 0;
  const W = canvas.parentElement ? canvas.parentElement.clientWidth : 400;
  canvas.width = W; canvas.height = 240;
  const procDefect = {};
  Object.values(S.DATA).forEach(d => {
    if (d.status === '폐기' || d.defectType === 'NG') {
      const cp = d.currentProcess || '미분류';
      procDefect[cp] = (procDefect[cp] || 0) + 1;
    }
  });
  // ISSUES는 배열이므로 그대로 사용
  S.ISSUES.forEach(is => {
    if (is.type === '불량' || is.type === '폐기') {
      const item = Object.values(S.DATA).find(d => d.sn === is.sn);
      const cp = item ? item.currentProcess || '미분류' : '미분류';
      procDefect[cp] = (procDefect[cp] || 0) + 1;
    }
  });
  const labels = Object.keys(procDefect);
  const vals = Object.values(procDefect);
  const total = vals.reduce((a, b) => a + b, 0);
  if (!total) {
    ctx.fillStyle = cs('--t2');
    ctx.font = '14px Inter, Noto Sans KR, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('불량 데이터 없음', W / 2, 120);
    return;
  }
  const r = Math.min(70, W / 4);
  const ri = r * 0.64;
  const cx = W < 350 ? W / 2 : W / 2 - 60;
  const cy = 120;
  const colors = labels.map(l => PROC_COLORS[l] || `hsl(${Math.random() * 360},60%,50%)`);
  let angle = -Math.PI / 2;
  vals.forEach((v, i) => {
    if (!v) return;
    const sweep = v / total * 2 * Math.PI;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + sweep);
    ctx.closePath(); ctx.fillStyle = colors[i]; ctx.fill();
    angle += sweep;
  });
  ctx.beginPath(); ctx.arc(cx, cy, ri, 0, Math.PI * 2);
  ctx.fillStyle = cs('--bg3') || '#1f2937'; ctx.fill();
  ctx.fillStyle = cs('--t1') || '#f9fafb';
  ctx.font = 'bold 18px Inter, Noto Sans KR, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(total, cx, cy + 6);
  ctx.font = '11px Inter, Noto Sans KR, sans-serif'; ctx.fillStyle = cs('--t2') || '#9ca3af';
  ctx.fillText('불량', cx, cy + 22);
  if (W >= 350) {
    const lx = cx + r + 20;
    labels.forEach((l, i) => {
      const y = 40 + i * 24;
      ctx.fillStyle = colors[i]; ctx.fillRect(lx, y, 12, 12);
      ctx.fillStyle = cs('--t1');
      ctx.font = '12px Inter, Noto Sans KR, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(`${l}: ${vals[i]}건`, lx + 16, y + 10);
    });
  }
}
