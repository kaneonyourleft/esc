import { DATA, PRODUCTS, ISSUES, PROC_ORDER, PROC_COLORS, wsSelection, wsFilters, wsViewMode, wsGroups, FB, firebaseDb } from './main.js';
import { todayStr, debounce } from './date-utils.js';
import { getProc, getRoute, extractCategory, statusBadge, calcProgress, toast } from './main.js';
import { renderWorkspace } from './workspace-view.js';

/**
 * Workspace Service Logic
 */

export const quickStatusChange = debounce(async function(sn, status, FB, firebaseDb, toast) {
  try {
    const ref = FB.doc(firebaseDb, 'production', sn);
    await FB.updateDoc(ref, { status, updatedAt: todayStr() });
    toast(`${sn} 상태 변경: ${status}`, 'success');
  } catch (err) {
    console.error(err);
    toast('상태 변경 실패', 'error');
  }
}, 300);

export const applyBatch = debounce(async function(selection, DATA, FB, firebaseDb, toast) {
  const status = document.getElementById('batchStatusSel').value;
  if (!status) { toast('상태를 선택하세요', 'warn'); return; }
  if (!wsSelection.size) { toast('선택된 항목이 없습니다', 'warn'); return; }
  try {
    const batch = FB.writeBatch(firebaseDb);
    wsSelection.forEach(sn => {
      const ref = FB.doc(firebaseDb, 'production', sn);
      batch.update(ref, { status, updatedAt: todayStr() });
    });
    await batch.commit();
    toast(`${wsSelection.size}건 상태 → ${status}`, 'success');
    wsSelection.clear();
  } catch (err) {
    console.error(err);
    toast('일괄 상태 변경 실패', 'error');
  }
}, 300);

export const applyNG = debounce(function(selection, toast, openModal) {
  if (!wsSelection.size) { toast('선택된 항목이 없습니다', 'warn'); return; }
  
  document.getElementById('ng_reason_select').value = '';
  document.getElementById('ng_reason_custom').value = '';
  document.getElementById('ng_reason_custom_wrap').classList.add('hidden');
  
  openModal('ngReasonModal');
}, 300);

export const submitNGBatch = debounce(async function(selection, DATA, getRoute, FB, firebaseDb, toast, closeModal, renderWorkspace) {
  const selectVal = document.getElementById('ng_reason_select').value;
  let reason = selectVal;
  if (selectVal === '기타') {
    reason = document.getElementById('ng_reason_custom').value.trim();
  }
  
  if (!reason) { toast('폐기 사유를 입력하세요', 'warn'); return; }
  
  try {
    const batch = FB.writeBatch(firebaseDb);
    wsSelection.forEach(sn => {
      const d = DATA[sn];
      if (!d) return;
      
      const route = getRoute(sn, d);
      const curProc = d.currentProcess || route[0] || '';
      
      const ref = FB.doc(firebaseDb, 'production', sn);
      const updates = {
        status: '폐기',
        ngReason: reason,
        updatedAt: todayStr()
      };
      
      if (curProc) {
        updates[`processes.${curProc}.status`] = '폐기';
      }
      
      batch.update(ref, updates);
    });
    
    await batch.commit();
    toast(`${wsSelection.size}건 폐기(NG) 처리 완료`, 'success');
    closeModal('ngReasonModal');
    wsSelection.clear();
    renderWorkspace();
  } catch (err) {
    console.error(err);
    toast('폐기 처리 실패', 'error');
  }
}, 300);

export function toggleFilter(f, currentFilters, callback) {
  let nf = [...currentFilters];
  if (f === '전체') {
    nf = ['전체'];
  } else {
    nf = nf.filter(x => x !== '전체');
    const idx = nf.indexOf(f);
    if (idx >= 0) nf.splice(idx, 1);
    else nf.push(f);
    if (!nf.length) nf = ['전체'];
  }
  callback(nf);
}

export function onBatchProcChange(selection, DATA, getEquipList, extractCategory, esc) {
  const proc = document.getElementById('batchProcSel').value;
  const equipSel = document.getElementById('batchEquipSel');
  if (!equipSel) return;
  equipSel.innerHTML = '<option value="">설비</option>';
  if (!proc) return;
  
  let cat = '';
  wsSelection.forEach(sn => {
    const d = DATA[sn];
    if (d) cat = extractCategory(sn) || (d.category ? d.category : '') || cat;
  });
  const list = getEquipList(proc, cat);
  list.forEach(eq => {
    equipSel.innerHTML += `<option value="${esc(eq)}">${esc(eq)}</option>`;
  });
}

export const applyBatchAll = debounce(async function(selection, DATA, FB, firebaseDb, toast, updateBatchBar) {
  if (!wsSelection.size) { toast('선택된 항목이 없습니다', 'warn'); return; }

  const status = document.getElementById('batchStatusSel').value;
  const proc = document.getElementById('batchProcSel').value;
  const equip = document.getElementById('batchEquipSel').value;
  const startDate = document.getElementById('batchStartDate').value;
  const endDate = document.getElementById('batchEndDate').value;

  if (!status && !proc && !equip && !startDate && !endDate) {
    toast('변경할 항목을 선택하세요', 'warn'); return;
  }

  const changes = [];
  if (status) changes.push(`상태→${status}`);
  if (proc) changes.push(`공정→${proc}`);
  if (equip) changes.push(`설비→${equip}`);
  if (startDate) changes.push(`시작→${startDate}`);
  if (endDate) changes.push(`납기→${endDate}`);

  if (!confirm(`${wsSelection.size}건에 [${changes.join(', ')}] 적용하시겠습니까?`)) return;

  try {
    const batch = FB.writeBatch(firebaseDb);
    wsSelection.forEach(sn => {
      const ref = FB.doc(firebaseDb, 'production', sn);
      const updates = { updatedAt: todayStr() };
      if (status) updates.status = status;
      if (proc) updates.currentProcess = proc;
      if (equip) {
        const d = DATA[sn];
        const curProc = proc || (d ? d.currentProcess : '') || '';
        if (curProc && d && d.processes && d.processes[curProc]) {
          updates[`processes.${curProc}.equip`] = equip;
        }
      }
      if (startDate) updates.startDate = startDate;
      if (endDate) updates.endDate = endDate;
      batch.update(ref, updates);
    });
    await batch.commit();
    toast(`${wsSelection.size}건 일괄 변경 완료`, 'success');
    wsSelection.clear();
    updateBatchBar();
  } catch (err) { console.error(err); toast('일괄 변경 실패', 'error'); }
}, 300);
