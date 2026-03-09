/**
 * ESC Manager - S/N Generator Service
 * @module sn-generator
 */
import { FB, firebaseDb, DATA, PRODUCTS, handleFirestoreError, toast, openModal, closeModal, PROC_ORDER } from './main.js';
import { todayStr, fD, addBD } from './date-utils.js';
import { buildRoute, getDefaultDays, getEquipList, getProc } from './production-service.js';

const esc = (str) => str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '';

/**
 * Open S/N generation modal
 */
export function openSNModal() {
  window.populateProductSelects();
  document.getElementById('sn_start').value = todayStr();
  const batches = new Set();
  Object.values(DATA).forEach(d => { if (d.batch) batches.add(d.batch); });
  const list = document.getElementById('batchList');
  if (list) list.innerHTML = [...batches].map(b => `<option value="${esc(b)}">`).join('');
  openModal('snModal');
}

/**
 * Generate automatic batch code
 */
export function autoBatchCode() {
  const now = new Date();
  const code = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 900) + 100)}`;
  document.getElementById('sn_batch').value = code;
  updateSNPreview();
}

function getSNCodeLocal(cat, prodId) {
  if (!prodId) return '';
  let s = String(prodId).replace(/\s+/g, '').toUpperCase();
  const c = String(cat).toUpperCase();
  if (s.length > c.length && s.startsWith(c)) {
    s = s.substring(c.length);
  }
  return s;
}

function getMaxSeqLocal(cat, prodId) {
  let maxLocal = 0;
  const snCode = getSNCodeLocal(cat, prodId);
  Object.keys(DATA).forEach(sn => {
    sn = sn.toUpperCase();
    if (sn.includes(`-${snCode}-L`)) {
      const match = sn.match(/-L(\d{3})$/);
      if (match) {
        const num = Math.max(maxLocal, parseInt(match[1], 10));
        maxLocal = num;
      }
    }
  });
  return maxLocal;
}

/**
 * Handle product change in S/N modal
 */
export function onSNProdChange() {
  const prodId = document.getElementById('sn_prod').value;
  const prod = PRODUCTS[prodId];
  if (!prod) return;
  const cat = prod.category || 'WN';
  const equipSel = document.getElementById('sn_equip');
  if (equipSel) {
    const firstProc = PROC_ORDER[0];
    const eqList = getEquipList(firstProc, cat);
    equipSel.innerHTML = '<option value="">선택...</option>' + eqList.map(eq => `<option value="${esc(eq)}">${esc(eq)}</option>`).join('');
  }
  
  const maxSeq = getMaxSeqLocal(cat, prodId);
  let nextSeq = (maxSeq >= 999) ? 1 : maxSeq + 1;
  let hintText = (maxSeq >= 999) ? '⚠️ L999 도달' : (maxSeq > 0 ? `현재 최대: L${String(maxSeq).padStart(3, '0')} → 다음: L${String(nextSeq).padStart(3, '0')}` : '신규 제품');
  
  const hint = document.getElementById('sn_seqHint');
  if (hint) hint.textContent = hintText;
  
  const seqInput = document.getElementById('sn_seq');
  if (seqInput) seqInput.value = nextSeq;
  
  updateSNPreview();
}

/**
 * Handle sheet number change in S/N modal
 */
export function onSheetNoChange() {
  updateSNPreview();
}

/**
 * Update S/N preview list in modal
 */
export function updateSNPreview() {
  const prodId = document.getElementById('sn_prod').value;
  const startDate = document.getElementById('sn_start')?.value || todayStr();
  const sheet = startDate.replace(/-/g, '').slice(2);
  const qty = parseInt(document.getElementById('sn_qty').value) || 1;
  const seq = parseInt(document.getElementById('sn_seq').value) || 1;
  const prod = PRODUCTS[prodId];
  const preview = document.getElementById('sn_preview');
  if (!preview) return;

  if (!prod) { preview.textContent = '제품을 선택하세요'; return; }

  const cat = prod.category || 'WN';
  const snCode = getSNCodeLocal(cat, prodId);
  let items = [];
  for (let i = 0; i < Math.min(qty, 50); i++) {
    const num = String(((seq + i - 1) % 999) + 1).padStart(3, '0');
    items.push(`${cat}${sheet}-${snCode}-L${num}`);
  }
  preview.innerHTML = items.map(s => `<div>${esc(s)}</div>`).join('');
}

/**
 * Check for equipment schedule conflicts
 */
export function checkEquipConflict() {
  const equip = document.getElementById('sn_equip').value;
  const startDate = document.getElementById('sn_start').value;
  const warn = document.getElementById('equipConflictWarn');
  if (!warn) return;
  if (!equip || !startDate) { warn.innerHTML = ''; return; }

  const conflicts = Object.entries(DATA).filter(([sn, d]) => {
    const p = getProc(d, '탈지'); 
    if(!p) return false;
    if (p.equip !== equip || p.status === '완료') return false;
    const ps = fD(p.planStart || p.actualStart);
    const pe = fD(p.planEnd);
    return ps && pe && startDate >= ps && startDate <= pe;
  });
  warn.innerHTML = conflicts.length
    ? `<div style="font-size:11px;color:var(--warn);margin-top:3px">⚠️ 탈지 ${equip}이(가) ${conflicts.length}건과 일정 겹침</div>`
    : '';
}

/**
 * Save batch of S/Ns to Firestore
 */
export async function saveSNBatch() {
  const batch = document.getElementById('sn_batch').value.trim();
  const prodId = document.getElementById('sn_prod').value;
  const qty = parseInt(document.getElementById('sn_qty').value) || 1;
  const startDate = document.getElementById('sn_start').value;
  const equip = document.getElementById('sn_equip').value;
  const prod = PRODUCTS[prodId];

  if (!prod || !batch || !startDate) { toast('필수 항목을 입력하세요', 'warn'); return; }

  const sheet = startDate.replace(/-/g, '').slice(2);
  const cat = prod.category || 'WN';
  const heat = prod.heat || 'N';
  const route = buildRoute(cat, heat, "");
  
  const maxSeq = getMaxSeqLocal(cat, prodId);
  let currentSeq = (maxSeq >= 999) ? 1 : maxSeq + 1;
  const snCode = getSNCodeLocal(cat, prodId);

  try {
    const writeBatch = FB.writeBatch(firebaseDb);
    for (let i = 0; i < qty; i++) {
      const num = String(((currentSeq + i - 1) % 999) + 1).padStart(3, '0');
      const sn = `${cat}${sheet}-${snCode}-L${num}`;
      const processes = {};
      let cursor = startDate;

      route.forEach((proc, idx) => {
        const days = getDefaultDays(proc, cat);
        const end = addBD(cursor, days);
        processes[proc] = {
          status: idx === 0 ? '진행' : '대기',
          planStart: cursor, planEnd: end, planDays: days,
          actualStart: idx === 0 ? cursor : '', actualEnd: '', actualDays: 0,
          equip: idx === 0 ? equip : '', defect: '', remark: ''
        };
        cursor = end;
      });

      const ref = FB.doc(firebaseDb, 'production', sn);
      writeBatch.set(ref, {
        sn, productName: prod.name, category: cat, customer: prod.customer || '',
        batch, route, processes, startDate, endDate: cursor,
        status: '진행', currentProcess: route[0], createdAt: todayStr(), heat
      });
    }
    await writeBatch.commit();
    toast(`${qty}건 S/N 생성 완료`, 'success');
    closeModal('snModal');
  } catch (err) { handleFirestoreError(err, 'S/N 생성'); }
}
