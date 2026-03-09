import { set, currentUser } from './state.js';

export const esc = (str) => str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '';

export function toast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.innerHTML = msg;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

export function openModal(id) {
    document.querySelectorAll('.modal-overlay').forEach(function(m){ if(m.id !== id) m.classList.add('hidden'); });
    var el = document.getElementById(id); if (el) el.classList.remove('hidden');
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

export function statusBadge(status) {
  const cls = {
    '대기': 'badge-wait', '진행': 'badge-prog', '완료': 'badge-done',
    '지연': 'badge-delay', '폐기': 'badge-ng'
  };
  return `<span class="badge ${cls[status] || 'badge-wait'}">${esc(status || '대기')}</span>`;
}

export function handleFirestoreError(err, context = '') {
  const code = err?.code || '';
  const prefix = context ? `[${context}] ` : '';
  let msg;
  switch (code) {
    case 'permission-denied':
    case 'PERMISSION_DENIED':
      msg = `${prefix}권한이 없습니다. 로그인 상태를 확인하세요.`; break;
    case 'not-found':
      msg = `${prefix}문서를 찾을 수 없습니다. 새로고침 해주세요.`; break;
    case 'unavailable':
    case 'deadline-exceeded':
      msg = `${prefix}서버 연결 실패. 네트워크를 확인하세요.`; break;
    case 'resource-exhausted':
      msg = `${prefix}요청 한도 초과. 잠시 후 다시 시도하세요.`; break;
    case 'unauthenticated':
      msg = `${prefix}인증 만료. 다시 로그인하세요.`;
      setTimeout(() => { if (typeof doLogout === 'function') doLogout(); }, 3000);
      break;
    case 'already-exists':
      msg = `${prefix}이미 존재하는 데이터입니다.`; break;
    default:
      msg = `${prefix}저장 실패: ${err?.message || '알 수 없는 오류'}`;
  }
  console.error(`[Firestore Error] ${code}:`, err);
  toast(msg, 'error');
}
