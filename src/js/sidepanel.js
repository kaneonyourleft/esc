import { D as DATA, setCurrentSN, currentSN, selectedSNs } from './state.js';
import { PROC_COLORS, PROC_ORDER } from './constants.js';
import { handleFirestoreError, toast, openModal, closeModal } from './app-utils.js';
import { fD, esc, statusBadge, calcProgress, getDplus, calcActualDays, extractCategory } from './utils.js';
import { db, doc, updateDoc, deleteDoc } from './firebase.js';

export function openSidePanel(sn) {
    const item = DATA.find(d => d.sn === sn);
    if (!item) return;
    setCurrentSN(sn);
    document.getElementById('spSN').textContent = sn;
    document.getElementById('spBadge').innerHTML = statusBadge(item.status);
    document.getElementById('spCat').textContent = extractCategory(sn);
    document.getElementById('spStatusSel').value = item.status || '대기';
    const prog = calcProgress(item);
    const procs = item.processes || {};
    const route = (item.route || '').split('→').filter(Boolean);
    let tlHtml = '';
    route.forEach((p, i) => {
        const proc = procs[p] || {};
        const c = PROC_COLORS[p] || '#666';
        const smap = { '완료': '✅', '진행': '🔄', '지연': '⚠️', '대기': '⏳' };
        let daysCompareHtml = '';
        if (proc.status === '완료' && proc.planDays && proc.actualDays) {
            const diff = proc.actualDays - proc.planDays;
            if (diff > 0) daysCompareHtml = `<div class="days-compare days-over">계획 ${proc.planDays}일 → 실제 ${proc.actualDays}일 (▲${diff}일 초과)</div>`;
            else if (diff < 0) daysCompareHtml = `<div class="days-compare days-under">계획 ${proc.planDays}일 → 실제 ${proc.actualDays}일 (▼${Math.abs(diff)}일 단축)</div>`;
            else daysCompareHtml = `<div class="days-compare days-neutral">계획 ${proc.planDays}일 → 실제 ${proc.actualDays}일 (정확)</div>`;
        } else if (proc.status === '진행') {
            daysCompareHtml = `<div class="days-compare days-neutral">계획 ${proc.planDays || '-'}일 | 진행중...</div>`;
        } else {
            daysCompareHtml = `<div class="days-compare days-neutral">계획 ${proc.planDays || '-'}일 | 대기</div>`;
        }
        let procBtnHtml = '';
        if (proc.status === '진행') {
            procBtnHtml = `<button class="proc-complete-btn" onclick="completeProcess('${esc(sn)}','${p}',${i},${route.length})">✓ 완료</button>`;
        } else if (proc.status === '대기') {
            const prevAllDone = route.slice(0, i).every(pp => (procs[pp] || {}).status === '완료');
            if (prevAllDone && i === route.findIndex(pp => (procs[pp] || {}).status === '대기')) {
                procBtnHtml = `<button class="proc-start-btn" onclick="startProcess('${esc(sn)}','${p}')">▶ 시작</button>`;
            }
        }
        tlHtml += `<div class="timeline-item"><div style="display:flex;flex-direction:column;align-items:center"><div class="timeline-dot" style="background:${c}"></div>${i < route.length - 1 ? `<div class="timeline-line" style="flex:1;margin-top:4px;height:40px"></div>` : ''}</div><div class="timeline-content"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="font-size:13px;font-weight:600;color:${c}">${p}</span><span>${statusBadge(proc.status || '대기')}</span>${smap[proc.status] || ''}${procBtnHtml}</div><div style="font-size:11px;color:var(--t2);margin-top:3px">설비: ${proc.equip || '-'} | 계획: ${proc.planDays || '-'}일 | 실제: ${proc.actualDays || '-'}일</div><div style="font-size:11px;color:var(--t2)">${proc.startDate || '-'} ~ ${proc.planEnd || '-'}${proc.actualEnd ? `<span style="color:var(--ok)">(완료:${proc.actualEnd})</span>` : ''}</div>${daysCompareHtml}${proc.remark ? `<div style="font-size:11px;color:var(--warn);margin-top:2px">📌 ${proc.remark}</div>` : ''}</div></div>`;
    });
    document.getElementById('spBody').innerHTML = `<div style="margin-bottom:14px"><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;margin-bottom:12px"><div><span style="color:var(--t2)">제품:</span> <strong>${item.productName || '-'}</strong></div><div><span style="color:var(--t2)">배치:</span> ${item.batchId || '-'}</div><div><span style="color:var(--t2)">시작:</span> ${item.startDate || '-'}</div><div><span style="color:var(--t2)">종료예정:</span> ${item.endDate || '-'}</div><div><span style="color:var(--t2)">D+:</span> <strong>${getDplus(item)}</strong></div><div><span style="color:var(--t2)">진행률:</span> <strong style="color:var(--ac2)">${prog}%</strong></div></div><div class="prog-bar" style="height:6px;margin-bottom:12px"><div class="prog-fill" style="width:${prog}%"></div></div></div><div class="card-title">공정 타임라인</div>${tlHtml}`;
    document.getElementById('sidePanel').classList.add('open');
}

export function closeSidePanel() {
    document.getElementById('sidePanel').classList.remove('open');
    setCurrentSN(null);
}
export async function applySpStatus() {
    if (!currentSN) return;
    const s = document.getElementById('spStatusSel').value;
    await updateDoc(doc(db, 'production', currentSN), { status: s });
    toast(`상태 변경: ${s}`, 'ok');
    openSidePanel(currentSN);
}
export async function deleteSN() {
    if (!currentSN) return;
    if (!confirm(`${currentSN}을 삭제하시겠습니까?`)) return;
    await deleteDoc(doc(db, 'production', currentSN));
    closeSidePanel();
    toast('삭제 완료', 'ok');
}

export async function completeProcess(sn, procName, idx, totalProcs) {
    const item = DATA.find(d => d.sn === sn);
    if (!item) return;
    const route = (item.route || '').split('→').filter(Boolean);
    const proc = (item.processes || {})[procName] || {};
    const today = fD(new Date());
    const actualDays = calcActualDays(proc.startDate, today);
    const isLast = (idx >= route.length - 1);
    const ud = {};
    ud[`processes.${procName}.status`] = '완료';
    ud[`processes.${procName}.actualEnd`] = today;
    ud[`processes.${procName}.actualDays`] = actualDays;
    if (!isLast) {
        const nextProc = route[idx + 1];
        ud[`processes.${nextProc}.status`] = '진행';
        ud[`processes.${nextProc}.startDate`] = today;
        ud['currentProcess'] = nextProc;
    } else {
        ud['status'] = '완료';
        ud['currentProcess'] = procName;
    }
    try {
        await updateDoc(doc(db, 'production', sn), ud);
        toast(`${procName} 완료${isLast ? ' → 전체 완료!' : ' → ' + route[idx + 1] + ' 시작'}`, 'ok');
        setTimeout(() => openSidePanel(sn), 300);
    } catch (e) {
        toast('오류: ' + e.message, 'err');
        handleFirestoreError(e);
    }
}

export async function startProcess(sn, procName) {
    const today = fD(new Date());
    const ud = {};
    ud[`processes.${procName}.status`] = '진행';
    ud[`processes.${procName}.startDate`] = today;
    ud['currentProcess'] = procName;
    ud['status'] = '진행';
    try {
        await updateDoc(doc(db, 'production', sn), ud);
        toast(`${procName} 시작`, 'ok');
        setTimeout(() => openSidePanel(sn), 300);
    } catch (e) {
        toast('오류: ' + e.message, 'err');
        handleFirestoreError(e);
    }
}

export function showSNQR() {
    if (!currentSN) {
        toast('S/N을 먼저 선택하세요', 'warn');
        return;
    }
    const url = location.origin + location.pathname + '#sn=' + encodeURIComponent(currentSN);
    document.getElementById('qrSNLabel').textContent = currentSN;
    const wrap = document.getElementById('qrCanvasWrap');
    wrap.innerHTML = '<canvas id="qrCanvas"></canvas>';
    if (typeof QRCode !== 'undefined') {
        QRCode.toCanvas(document.getElementById('qrCanvas'), url, { width: 200, margin: 2, color: { dark: '#000', light: '#fff' } }, err => {
            if (err) console.error(err);
        });
    } else {
        wrap.innerHTML = '<div style="color:var(--err)">QR 라이브러리 로딩 실패</div>';
    }
    openModal('qrModal');
}

export function downloadQR() {
    const canvas = document.getElementById('qrCanvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `QR_${currentSN || 'unknown'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('QR 다운로드 완료', 'ok');
}

export function generateBatchQR() {
    if (!selectedSNs.size) {
        toast('S/N을 선택하세요', 'warn');
        return;
    }
    const grid = document.getElementById('qrPrintGrid');
    grid.innerHTML = '';
    const sns = [...selectedSNs];
    openModal('qrPrintModal');
    setTimeout(() => {
        sns.forEach(sn => {
            const item = document.createElement('div');
            item.className = 'qr-print-item';
            const canvas = document.createElement('canvas');
            item.appendChild(canvas);
            const label = document.createElement('div');
            label.className = 'qr-label';
            label.textContent = sn;
            item.appendChild(label);
            grid.appendChild(item);
            const url = location.origin + location.pathname + '#sn=' + encodeURIComponent(sn);
            if (typeof QRCode !== 'undefined') {
                QRCode.toCanvas(canvas, url, { width: 150, margin: 1, color: { dark: '#000', light: '#fff' } }, err => {
                    if (err) console.error(err);
                });
            }
        });
    }, 100);
}
