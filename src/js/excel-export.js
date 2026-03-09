/**
 * ESC Manager - Excel & Data Export Service
 * @module excel-export
 */
import { DATA, ISSUES, toast, todayStr, fmt } from './main.js';
import { fD } from './date-utils.js';
import { getProc, buildRoute } from './production-service.js';

const esc = (str) => str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '';

function extractCategory(sn) {
  if (!sn) return '';
  const upper = String(sn).toUpperCase();
  if (upper.startsWith('WN')) return 'WN';
  if (upper.startsWith('BL')) return 'BL';
  if (upper.startsWith('HP')) return 'HP';
  return '';
}

function calcProgress(item, sn) {
  const route = buildRoute(item.category, item.heat, item.dcJoint);
  if (!route.length) return 0;
  let done = 0;
  route.forEach(proc => {
    if (getProc(item, proc).status === '완료') done++;
  });
  return Math.round(done / route.length * 100);
}

/**
 * Export production data and issues to Excel
 */
export function exportExcel() {
  if (typeof XLSX === 'undefined') { toast('SheetJS 로딩 중...', 'warn'); return; }
  const rows = [];
  Object.entries(DATA).forEach(([sn, d]) => {
    const route = buildRoute(d.category, d.heat, d.dcJoint);
    const row = {
      'S/N': sn, '제품': d.productName || '', '카테고리': extractCategory(sn),
      '상태': d.status || '대기', '현재공정': d.currentProcess || '',
      '시작일': fD(d.startDate), '납기': fD(d.endDate),
      '진행률': calcProgress(d, sn) + '%', '배치': d.batch || ''
    };
    route.forEach(proc => {
      const p = getProc(d, proc);
      row[`${proc}_상태`] = p.status || '';
      row[`${proc}_설비`] = p.equip || '';
      row[`${proc}_시작`] = fD(p.planStart || p.actualStart);
      row[`${proc}_종료`] = fD(p.actualEnd || p.planEnd);
      row[`${proc}_불량`] = p.defect || '';
    });
    rows.push(row);
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '생산데이터');

  if (ISSUES.length) {
    const issueRows = ISSUES.map(i => ({ '날짜': fD(i.date), '유형': i.type || '', 'SN': i.sn || '', '내용': i.content || '' }));
    const is = XLSX.utils.json_to_sheet(issueRows);
    XLSX.utils.book_append_sheet(wb, is, '이슈');
  }

  XLSX.writeFile(wb, `ESC_생산데이터_${todayStr()}.xlsx`);
  toast('엑셀 내보내기 완료', 'success');
}

/**
 * Export full backup as JSON
 */
export function exportJSON(PRODUCTS) {
  const data = { production: DATA, products: PRODUCTS, issues: ISSUES, exportDate: todayStr(), version: 'v10.0' };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.download = `ESC_backup_${todayStr()}.json`;
  a.href = URL.createObjectURL(blob);
  a.click();
  toast('JSON 백업 완료', 'success');
}
