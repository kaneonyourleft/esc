/**
 * ESC Manager - Shared Utilities
 * @module app-utils
 */

import { PROC_COLORS } from './constants.js';

export const esc = (str) => str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '';

export function statusBadge(status) {
  const s = status || '대기';
  let cls = 'badge-wait';
  if (s === '진행') cls = 'badge-progress';
  if (s === '완료') cls = 'badge-complete';
  if (s === '지연') cls = 'badge-delay';
  if (s === '폐기') cls = 'badge-ng';
  return `<span class="badge ${cls}">${esc(s)}</span>`;
}

export function extractCategory(sn) {
  if (!sn) return '';
  const match = sn.match(/^([A-Z]+)/);
  return match ? match[1] : '';
}

/**
 * Markdown to HTML (simplified)
 */
export function mdToHtml(md) {
  if (!md) return '';
  return md
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n- /g, '<br>• ')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

/**
 * Toast notification
 */
export function toast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}
export function openModal(id) {
  document.querySelectorAll('.modal-overlay').forEach(m => { if (m.id !== id) m.classList.add('hidden'); });
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

export function handleFirestoreError(err, context = '') {
  const code = err?.code || '';
  const prefix = context ? `[${context}] ` : '';
  let msg;
  switch (code) {
    case 'permission-denied':
    case 'PERMISSION_DENIED':
      msg = `${prefix}권한이 없습니다.`; break;
    case 'unauthenticated':
      msg = `${prefix}인증 만료.`; break;
    default:
      msg = `${prefix}실패: ${err?.message || '알 수 없는 오류'}`;
  }
  toast(msg, 'error');
}

export function positionDropdown(dropdown, anchor) {
  if (!dropdown || !anchor) return;
  const rect = anchor.getBoundingClientRect();
  dropdown.style.position = 'fixed';
  dropdown.style.left = rect.left + 'px';
  dropdown.style.top = (rect.bottom + 4) + 'px';
}

export function handleEmptyChart(canvas, data, msg = '데이터가 없습니다') {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#94a3b8';
  ctx.textAlign = 'center';
  ctx.fillText(msg, w / 2, h / 2);
}
