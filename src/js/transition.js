/* ============================================================
   transition.js – 상태 전이 중앙 모듈 (Phase 5)
   ESC Manager – Single Source of Truth for Firestore writes
   
   모든 production/{sn} 상태 변경은 이 모듈을 통해서만 수행.
   ============================================================ */

import * as S from './state.js';
import { getRoute, getProc } from './utils.js';

// Firebase 인스턴스를 안전하게 가져오는 헬퍼 함수
const getFirebase = () => {
  if (!window.FB || !window.firebaseDb) {
    console.error('Firebase is not initialized on the window object.');
    throw new Error('Firebase is not initialized');
  }
  return { ...window.FB, db: window.firebaseDb };
};

const getAuditFields = (fnName, options) => {
    const FB = getFirebase();
    return {
        updatedAt: FB.serverTimestamp(),
        updatedBy: options.user || 'unknown',
        lastAction: fnName,
        actionSource: options.source || 'unknown',
    };
};

/**
 * 1. 공정 시작 (배치)
 */
export async function startProcess(snList, procName, options = {}) {
  if (!snList || snList.length === 0) {
    return { success: 0, failed: 0 };
  }
  const FB = getFirebase();
  const today = new Date().toISOString().split('T')[0];

  try {
    const batch = FB.writeBatch(FB.db);
    const audit = getAuditFields('startProcess', options);

    snList.forEach(sn => {
      const ref = FB.doc(FB.db, 'production', sn);
      batch.update(ref, {
        [`processes.${procName}.status`]: '진행',
        [`processes.${procName}.actualStart`]: today,
        currentProcess: procName,
        status: '진행',
        ...audit
      });
    });

    await batch.commit();
    return { success: snList.length, failed: 0 };
  } catch (error) {
    console.error('Error in startProcess:', error);
    throw error;
  }
}

/**
 * 2. 공정 완료 (배치)
 */
export async function completeProcess(snList, procName, options = {}) {
  if (!snList || snList.length === 0) {
    return { success: 0, failed: 0 };
  }
  const FB = getFirebase();
  const today = new Date().toISOString().split('T')[0];

  try {
    const batch = FB.writeBatch(FB.db);
    const audit = getAuditFields('completeProcess', options);
    let successCount = 0;

    for (const sn of snList) {
      const docData = S.DATA[sn];
      if (!docData) {
        console.warn(`completeProcess: Data for SN ${sn} not found in local state.`);
        continue;
      }

      const updates = {
        [`processes.${procName}.status`]: '완료',
        [`processes.${procName}.actualEnd`]: today,
        ...audit
      };

      const route = getRoute(sn, docData);
      const currentIndex = route.indexOf(procName);

      if (currentIndex === -1) {
        console.warn(`completeProcess: Process ${procName} not in route for SN ${sn}.`);
        continue; 
      }

      const isLastProcess = currentIndex >= route.length - 1;

      if (isLastProcess) {
        const allProcessesComplete = route.every(p => {
          if (p === procName) return true;
          const procData = getProc(docData, p);
          return procData && procData.status === '완료';
        });

        if (allProcessesComplete) {
          updates.status = '완료';
          updates.completedAt = today;
          updates.currentProcess = '최종완료';
        }
      } else {
        updates.currentProcess = route[currentIndex + 1];
      }
      
      const ref = FB.doc(FB.db, 'production', sn);
      batch.update(ref, updates);
      successCount++;
    }

    await batch.commit();
    return { success: successCount, failed: snList.length - successCount };

  } catch (error) {
    console.error('Error in completeProcess:', error);
    throw error;
  }
}

/**
 * 3. 설비 변경
 */
export async function changeEquipment(sn, procName, equipName, options = {}) {
  const FB = getFirebase();
  try {
    const ref = FB.doc(FB.db, 'production', sn);
    const audit = getAuditFields('changeEquipment', options);
    await FB.updateDoc(ref, {
      [`processes.${procName}.equip`]: equipName,
      ...audit
    });
  } catch (error) {
    console.error(`Error changing equipment for ${sn}:`, error);
    throw error;
  }
}

/**
 * 4. 현재 공정 변경
 */
export async function changeCurrentProcess(sn, newProcName, options = {}) {
    const FB = getFirebase();
    try {
        const ref = FB.doc(FB.db, 'production', sn);
        const audit = getAuditFields('changeCurrentProcess', options);
        await FB.updateDoc(ref, {
            currentProcess: newProcName,
            ...audit
        });
    } catch (error) {
        console.error(`Error changing current process for ${sn}:`, error);
        throw error;
    }
}

/**
 * 5. 개별 문서 상태 설정
 */
export async function setStatus(sn, newStatus, options = {}) {
    const FB = getFirebase();
    try {
        const audit = getAuditFields('setStatus', options);
        const updates = {
            status: newStatus,
            ...audit
        };

        if (newStatus === '완료') {
            const today = new Date().toISOString().split('T')[0];
            updates.completedAt = today;
        }

        const ref = FB.doc(FB.db, 'production', sn);
        await FB.updateDoc(ref, updates);
    } catch (error) {
        console.error(`Error setting status for ${sn}:`, error);
        throw error;
    }
}

/**
 * 6. 문서 상태 일괄 설정 (배치)
 */
export async function setStatusBatch(snList, newStatus, options = {}) {
    if (!snList || snList.length === 0) {
        return { success: 0, failed: 0 };
    }
    const FB = getFirebase();

    try {
        const batch = FB.writeBatch(FB.db);
        const audit = getAuditFields('setStatusBatch', options);
        const updates = {
            status: newStatus,
            ...audit
        };

        if (newStatus === '완료') {
            const today = new Date().toISOString().split('T')[0];
            updates.completedAt = today;
        }

        snList.forEach(sn => {
            const ref = FB.doc(FB.db, 'production', sn);
            batch.update(ref, updates);
        });

        await batch.commit();
        return { success: snList.length, failed: 0 };
    } catch (error) {
        console.error('Error in setStatusBatch:', error);
        throw error;
    }
}

/**
 * 7. 공정 폐기 (배치)
 */
export async function discardProcess(snList, procName, options = {}) {
    if (!options.reason) {
        throw new Error('폐기 사유 필수');
    }
    if (!snList || snList.length === 0) {
        return { success: 0, failed: 0, skipped: 0 };
    }
    const FB = getFirebase();

    try {
        const batch = FB.writeBatch(FB.db);
        const audit = getAuditFields('discardProcess', options);
        let successCount = 0;
        let skippedCount = 0;

        snList.forEach(sn => {
            const docData = S.DATA[sn];
            if (!docData || docData.status === '폐기' || docData.status === '완료') {
                skippedCount++;
                return;
            }

            const ref = FB.doc(FB.db, 'production', sn);
            batch.update(ref, {
                status: '폐기',
                [`processes.${procName}.status`]: '폐기',
                ngReason: options.reason,
                ngQty: options.qty || null,
                discardedAt: FB.serverTimestamp(),
                discardedBy: options.user || 'unknown',
                discardedProcess: procName,
                ...audit,
            });
            successCount++;
        });

        await batch.commit();
        return { success: successCount, failed: 0, skipped: skippedCount };

    } catch (error) {
        console.error('Error in discardProcess:', error);
        throw error;
    }
}
