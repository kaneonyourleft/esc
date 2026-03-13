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

/**
 * 1. 공정 시작 (배치)
 * @param {string[]} snList - 대상 S/N 목록
 * @param {string} procName - 시작할 공정명
 * @returns {Promise<{success: number, failed: number}>}
 */
export async function startProcess(snList, procName) {
  if (!snList || snList.length === 0) {
    return { success: 0, failed: 0 };
  }
  const FB = getFirebase();
  const today = new Date().toISOString().split('T')[0];

  try {
    const batch = FB.writeBatch(FB.db);
    snList.forEach(sn => {
      const ref = FB.doc(FB.db, 'production', sn);
      batch.update(ref, {
        [`processes.${procName}.status`]: '진행',
        [`processes.${procName}.actualStart`]: today,
        currentProcess: procName,
        status: '진행',
        updatedAt: FB.serverTimestamp()
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
 * @param {string[]} snList - 대상 S/N 목록
 * @param {string} procName - 완료된 공정명
 * @returns {Promise<{success: number, failed: number}>}
 */
export async function completeProcess(snList, procName) {
  if (!snList || snList.length === 0) {
    return { success: 0, failed: 0 };
  }
  const FB = getFirebase();
  const today = new Date().toISOString().split('T')[0];

  try {
    const batch = FB.writeBatch(FB.db);
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
        updatedAt: FB.serverTimestamp()
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
          if (p === procName) return true; // 현재 공정은 이제 막 완료됨
          const procData = getProc(docData, p);
          return procData && procData.status === '완료';
        });

        if (allProcessesComplete) {
          updates.status = '완료';
          updates.completedAt = today;
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
 * @param {string} sn - 대상 S/N
 * @param {string} procName - 대상 공정
 * @param {string} equipName - جديد 설비명
 */
export async function changeEquipment(sn, procName, equipName) {
  const FB = getFirebase();
  try {
    const ref = FB.doc(FB.db, 'production', sn);
    await FB.updateDoc(ref, {
      [`processes.${procName}.equip`]: equipName,
      updatedAt: FB.serverTimestamp()
    });
  } catch (error) {
    console.error(`Error changing equipment for ${sn}:`, error);
    throw error;
  }
}

/**
 * 4. 현재 공정 변경
 * @param {string} sn - 대상 S/N
 * @param {string} newProcName - جديد 현재 공정명
 */
export async function changeCurrentProcess(sn, newProcName) {
    const FB = getFirebase();
    try {
        const ref = FB.doc(FB.db, 'production', sn);
        await FB.updateDoc(ref, {
            currentProcess: newProcName,
            updatedAt: FB.serverTimestamp()
        });
    } catch (error) {
        console.error(`Error changing current process for ${sn}:`, error);
        throw error;
    }
}

/**
 * 5. 개별 문서 상태 설정
 * @param {string} sn - 대상 S/N
 * @param {string} newStatus - جديد 상태값
 */
export async function setStatus(sn, newStatus) {
    const FB = getFirebase();
    try {
        const updates = {
            status: newStatus,
            updatedAt: FB.serverTimestamp()
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
 * @param {string[]} snList - 대상 S/N 목록
 * @param {string} newStatus - جديد 상태값
 * @returns {Promise<{success: number, failed: number}>}
 */
export async function setStatusBatch(snList, newStatus) {
    if (!snList || snList.length === 0) {
        return { success: 0, failed: 0 };
    }
    const FB = getFirebase();

    try {
        const batch = FB.writeBatch(FB.db);
        const updates = {
            status: newStatus,
            updatedAt: FB.serverTimestamp()
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
