/**
 * ESC Manager - Production & State Transition Service
 * @module production-service
 */
import { FB, firebaseDb, DATA, PRODUCTS, handleFirestoreError, toast, openModal, closeModal, PROC_ORDER, EQ_MAP } from './main.js';
import { fD, fmt, addBD, todayStr, debounce, diffBD } from './date-utils.js';

/**
 * Get process data from item
 * @param {object} item 
 * @param {string} procName 
 * @returns {object}
 */
export function getProc(item, procName) {
  const blank = {
    status: '대기', planStart: '', planEnd: '', actualStart: '', actualEnd: '',
    planDays: 0, actualDays: 0, equip: '', defect: '', remark: ''
  };
  if (!item || !item.processes || typeof item.processes !== 'object') return { ...blank };
  return item.processes[procName] || { ...blank };
}

/**
 * Get default days for a process based on category and stack qty
 * @param {string} proc 
 * @param {string} category 
 * @param {number} stackQty 
 * @returns {number}
 */
export function getDefaultDays(proc, category, stackQty) {
  switch (proc) {
    case "탈지":     return 6;
    case "소성":     return (stackQty >= 9) ? 5 : 3;
    case "환원소성": return 3;
    case "평탄화":   return 3;
    case "도금":     return 1;
    case "열처리":   return 1;
    default:         return 3;
  }
}

/**
 * Build production route based on category, heat treatment, and dc joint
 * @param {string} category 
 * @param {string} heat 
 * @param {string} dcJoint 
 * @returns {string[]}
 */
export function buildRoute(category, heat, dcJoint) {
  const cat = (category || "").toUpperCase();
  const h = (heat || "N").toUpperCase();
  const dc = (dcJoint || "").toUpperCase();
  const route = ["탈지", "소성"];
  if (cat === "BL") route.push("환원소성");
  route.push("평탄화");
  if (dc !== "BRAZING") route.push("도금");
  if (h === "Y") route.push("열처리");
  return route;
}

/**
 * Get available equipment for a process
 * @param {string} proc 
 * @param {string} category 
 * @returns {string[]}
 */
export function getEquipList(proc, category) {
  const cat = (category || "").toUpperCase();
  switch (proc) {
    case "탈지": return ["1호기", "2호기", "3호기"];
    case "소성":
      if (cat === "BL") return ["1호기", "4호기"];
      return ["5호기", "10호기", "11호기", "12호기", "13호기", "14호기", "15호기", "16호기", "17호기", "18호기"];
    case "환원소성":
      if (cat === "BL") return ["2호기"];
      return [];
    case "평탄화":
      if (cat === "BL") return ["3호기"];
      return ["6호기", "7호기", "8호기", "9호기"];
    case "도금": return ["외주"];
    case "열처리": return ["GB"];
    default: return EQ_MAP[proc] || [];
  }
}

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

export const updateEquip = debounce(async function(sn, proc, equip, DATA, FB, firebaseDb, toast) {
  try {
    const ref = FB.doc(firebaseDb, 'production', sn);
    await FB.updateDoc(ref, { [`processes.${proc}.equip`]: equip });
    toast(`${sn} ${proc} 설비 → ${equip || '해제'}`, 'success');
  } catch (err) {
    console.error(err);
    toast('설비 변경 실패', 'error');
  }
}, 300);

export const updateProcStartDate = debounce(async function(sn, proc, val, DATA, extractCategory, FB, firebaseDb, toast) {
  if (!val) return;
  const item = DATA[sn];
  if (!item) return;

  const cat = extractCategory(sn);
  const days = getDefaultDays(proc, cat);
  const endDate = addBD(val, days);

  try {
    const ref = FB.doc(firebaseDb, 'production', sn);
    const updates = {};
    updates[`processes.${proc}.planStart`] = val;
    updates[`processes.${proc}.planEnd`] = endDate;

    const currentProcData = item.processes && item.processes[proc] ? item.processes[proc] : {};
    if ((currentProcData.status || '대기') === '대기') {
      updates[`processes.${proc}.status`] = '진행';
      updates[`processes.${proc}.actualStart`] = val;
    }

    await FB.updateDoc(ref, updates);
    toast(`${sn} ${proc} 시작일: ${fmt(val)}`, 'success');
  } catch (err) {
    console.error(err);
    toast('날짜 변경 실패', 'error');
  }
}, 300);

/**
 * Confirm and submit NG (폐기) processing for selected SNs
 */
export async function submitNGBatch(wsSelection, reason) {
  try {
    const batch = FB.writeBatch(firebaseDb);
    wsSelection.forEach(sn => {
      const d = DATA[sn];
      if (!d) return;
      const route = buildRoute(d.category, d.heat, d.dcJoint);
      const curProc = d.currentProcess || route[0] || '';
      const ref = FB.doc(firebaseDb, 'production', sn);
      const updates = { status: '폐기', ngReason: reason };
      if (curProc) updates[`processes.${curProc}.status`] = '폐기';
      batch.update(ref, updates);
    });
    await batch.commit();
    toast(`${wsSelection.size}건 폐기(NG) 처리 완료`, 'success');
  } catch (err) { handleFirestoreError(err, '폐기 처리'); }
}

/**
 * Batch start selected SNs
 */
export async function applyBatchStart(wsSelection) {
  const today = todayStr();
  let count = 0;
  try {
    const batch = FB.writeBatch(firebaseDb);
    wsSelection.forEach(sn => {
      const d = DATA[sn];
      if (!d) return;
      const route = buildRoute(d.category, d.heat, d.dcJoint);
      const procName = d.currentProcess || route[0];
      const proc = getProc(d, procName);
      if ((proc.status || '대기') === '대기') {
        const ref = FB.doc(firebaseDb, 'production', sn);
        const updates = {};
        updates[`processes.${procName}.status`] = '진행';
        updates[`processes.${procName}.actualStart`] = today;
        updates[`processes.${procName}.planStart`] = today;
        updates.currentProcess = procName;
        updates.status = '진행';
        batch.update(ref, updates);
        count++;
      }
    });
    if (count === 0) { toast('시작할 수 있는 대기 상태의 S/N이 없습니다', 'info'); return; }
    await batch.commit();
    toast(`${count}건 일괄 시작 처리 완료`, 'success');
  } catch (err) { handleFirestoreError(err, '일괄 시작 처리'); }
}

/**
 * Batch complete selected SNs
 */
export async function applyBatchComplete(wsSelection) {
  const today = todayStr();
  let count = 0;
  try {
    const batch = FB.writeBatch(firebaseDb);
    wsSelection.forEach(sn => {
      const d = DATA[sn];
      if (!d) return;
      const route = buildRoute(d.category, d.heat, d.dcJoint);
      const procName = d.currentProcess || route[0];
      const proc = getProc(d, procName);
      if (proc.status === '진행') {
        const idx = route.indexOf(procName);
        const startDate = fD(proc.actualStart || proc.planStart);
        const actualDays = startDate ? diffBD(startDate, today) : 0;
        const isLast = (idx >= route.length - 1);
        const ref = FB.doc(firebaseDb, 'production', sn);
        const updates = {};
        updates[`processes.${procName}.status`] = '완료';
        updates[`processes.${procName}.actualEnd`] = today;
        updates[`processes.${procName}.actualDays`] = actualDays;
        if (!isLast) {
          const nextProc = route[idx + 1];
          updates[`processes.${nextProc}.status`] = '진행';
          updates[`processes.${nextProc}.actualStart`] = today;
          if (!getProc(d, nextProc).planStart) updates[`processes.${nextProc}.planStart`] = today;
          updates.currentProcess = nextProc;
        } else {
          updates.status = '완료';
          updates.completedAt = today;
          updates.currentProcess = procName;
        }
        batch.update(ref, updates);
        count++;
      }
    });
    if (count === 0) { toast('완료할 수 있는 진행 상태의 S/N이 없습니다', 'info'); return; }
    await batch.commit();
    toast(`${count}건 일괄 완료 처리 완료`, 'success');
  } catch (err) { handleFirestoreError(err, '일괄 완료 처리'); }
}

export const quickStartProc = debounce(async function(sn, procName) {
  try {
    const ref = FB.doc(firebaseDb, 'production', sn);
    const today = todayStr();
    const updates = {
      status: '진행',
      currentProcess: procName,
      updatedAt: today
    };
    updates[`processes.${procName}.status`] = '진행';
    updates[`processes.${procName}.actualStart`] = today;
    updates[`processes.${procName}.planStart`] = today;
    
    await FB.updateDoc(ref, updates);
    toast(`${sn} ${procName} 시작`, 'success');
  } catch (err) {
    console.error(err);
    toast('시작 처리 실패', 'error');
  }
}, 300);

export const quickCompleteProc = debounce(async function(sn, procName, idx, total) {
  try {
    const item = DATA[sn];
    if (!item) return;
    const route = buildRoute(item.category, item.heat, item.dcJoint);
    const today = todayStr();
    const ref = FB.doc(firebaseDb, 'production', sn);
    const procData = item.processes?.[procName] || {};
    
    const startDate = fD(procData.actualStart || procData.planStart);
    const actualDays = startDate ? diffBD(startDate, today) : 0;
    
    const updates = { updatedAt: today };
    updates[`processes.${procName}.status`] = '완료';
    updates[`processes.${procName}.actualEnd`] = today;
    updates[`processes.${procName}.actualDays`] = actualDays;
    
    if (idx < route.length - 1) {
      const nextProc = route[idx + 1];
      updates.currentProcess = nextProc;
      updates[`processes.${nextProc}.status`] = '진행';
      updates[`processes.${nextProc}.actualStart`] = today;
      updates[`processes.${nextProc}.planStart`] = today;
    } else {
      updates.status = '완료';
      updates.completedAt = today;
    }
    
    await FB.updateDoc(ref, updates);
    toast(`${sn} ${procName} 완료`, 'success');
  } catch (err) {
    console.error(err);
    toast('완료 처리 실패', 'error');
  }
}, 300);

/**
 * Save or update a product
 */
export async function saveProduct(name, data, editMode, PRODUCTS, DATA, firebaseDb, FB, handleFirestoreError, toast, populateProductSelects, showProductList) {
  try {
    await FB.setDoc(FB.doc(firebaseDb, "products", name), data);
    PRODUCTS[name] = data;
    toast("제품 \"" + name + "\" " + (editMode ? "수정" : "등록") + " 완료", "success");

    if (editMode) {
      const snEntries = Object.entries(DATA).filter(([k,v]) => v.productName === name);
      if (snEntries.length > 0 && confirm("이 제품의 S/N " + snEntries.length + "건의 공정도 새 설정에 맞게 업데이트하시겠습니까?\n\nDC접합: " + data.dcJoint + "\n공정: " + data.route.join(" → "))) {
        toast("S/N " + snEntries.length + "건 업데이트 중...", "info");
        const batch = FB.writeBatch(firebaseDb);
        let updated = 0;
        const newRoute = data.route;
        snEntries.forEach(([sn, d]) => {
          const ref = FB.doc(firebaseDb, "production", sn);
          const oldProcs = d.processes || {};
          const newProcs = {};
          newRoute.forEach((proc, idx) => {
            if (oldProcs[proc]) {
              newProcs[proc] = oldProcs[proc];
              newProcs[proc].order = idx + 1;
            } else {
              newProcs[proc] = { order: idx + 1, equip: "", status: "대기", startDate: "", planEnd: "", actualEnd: "", planDays: data["d" + (idx+1)] || 0, actualDays: 0, defect: "", remark: "" };
            }
          });
          batch.update(ref, { dcJoint: data.dcJoint, heatTreat: data.heatTreat ? "Y" : "N", route: newRoute, processes: newProcs, procCount: newRoute.length });
          updated++;
        });
        await batch.commit();
        toast("S/N " + updated + "건 공정 업데이트 완료", "success");
      }
    }
    if (populateProductSelects) populateProductSelects();
    if (showProductList) showProductList();
  } catch (err) { handleFirestoreError(err, "제품 저장"); }
}

/**
 * Delete a product
 */
export async function deleteProduct(name, snCount, PRODUCTS, firebaseDb, FB, handleFirestoreError, toast, populateProductSelects, renderProductList) {
  if (snCount > 0) {
    if (!confirm(name + "에 연결된 S/N이 " + snCount + "건 있습니다.\n제품만 삭제되고 S/N 데이터는 유지됩니다.\n정말 삭제하시겠습니까?")) return;
  } else {
    if (!confirm(name + " 제품을 삭제하시겠습니까?")) return;
  }
  try {
    await FB.deleteDoc(FB.doc(firebaseDb, "products", name));
    delete PRODUCTS[name];
    toast("제품 \"" + name + "\" 삭제 완료", "success");
    if (populateProductSelects) populateProductSelects();
    if (renderProductList) renderProductList();
  } catch (err) { handleFirestoreError(err, "제품 삭제"); }
}

/**
 * Save a new issue
 */
export async function saveIssue(issue, currentUser, firebaseDb, FB, handleFirestoreError, toast, closeModal) {
  if (!issue.content) { toast('이슈 내용을 입력하세요', 'warn'); return; }
  try {
    const id = `ISS-${Date.now()}`;
    const ref = FB.doc(firebaseDb, 'issues', id);
    await FB.setDoc(ref, { ...issue, createdAt: todayStr(), createdBy: currentUser?.email || '' });
    toast('이슈 등록 완료', 'success');
    if (closeModal) closeModal('issueModal');
  } catch (err) { handleFirestoreError(err, '이슈 등록'); }
}
