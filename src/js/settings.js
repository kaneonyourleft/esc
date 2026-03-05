/* ============================================================
   settings.js – 설정 탭
   ESC Manager v10 – Module Split
   ============================================================ */
import { S, setIsDark } from './state.js';
import { toast } from './utils.js';

export function renderSettings() {
  const page = document.getElementById('page-settings');
  if (!page) return;

  const isDark = S.isDark;
  const geminiKey = localStorage.getItem('esc_gemini_key') || '';

  page.innerHTML = `
    <div style="max-width:600px;margin:2rem auto;padding:1rem;">
      <h2 style="margin-bottom:1.5rem;">⚙️ 설정</h2>

      <div style="background:var(--card-bg,#1e293b);border-radius:12px;padding:1.5rem;margin-bottom:1rem;">
        <h3 style="margin-bottom:1rem;">테마</h3>
        <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
          <input type="checkbox" id="settingDark" ${isDark ? 'checked' : ''} />
          다크 모드
        </label>
      </div>

      <div style="background:var(--card-bg,#1e293b);border-radius:12px;padding:1.5rem;margin-bottom:1rem;">
        <h3 style="margin-bottom:1rem;">Gemini API</h3>
        <input type="password" id="settingGemini" value="${geminiKey}"
               placeholder="Gemini API Key 입력"
               style="width:100%;padding:0.5rem;border-radius:6px;border:1px solid #444;background:var(--input-bg,#0f172a);color:inherit;" />
        <button id="saveGeminiBtn"
                style="margin-top:0.5rem;padding:0.5rem 1rem;border-radius:6px;background:#3b82f6;color:#fff;border:none;cursor:pointer;">
          저장
        </button>
      </div>

      <div style="background:var(--card-bg,#1e293b);border-radius:12px;padding:1.5rem;margin-bottom:1rem;">
        <h3 style="margin-bottom:1rem;">캐시</h3>
        <button id="clearCacheBtn"
                style="padding:0.5rem 1rem;border-radius:6px;background:#ef4444;color:#fff;border:none;cursor:pointer;">
          캐시 초기화 (서비스워커)
        </button>
      </div>

      <div style="background:var(--card-bg,#1e293b);border-radius:12px;padding:1.5rem;">
        <h3 style="margin-bottom:1rem;">정보</h3>
        <p>ESC Manager v10.1</p>
        <p style="color:#94a3b8;font-size:0.85rem;">Module Split Edition</p>
      </div>
    </div>
  `;

  // 다크모드 토글
  document.getElementById('settingDark')?.addEventListener('change', (e) => {
    const dark = e.target.checked;
    setIsDark(dark);
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('esc_dark', dark ? '1' : '0');
    toast(dark ? '다크 모드 ON' : '다크 모드 OFF');
  });

  // Gemini 키 저장
  document.getElementById('saveGeminiBtn')?.addEventListener('click', () => {
    const key = document.getElementById('settingGemini')?.value?.trim();
    if (key) {
      localStorage.setItem('esc_gemini_key', key);
      toast('Gemini API Key 저장 완료');
    } else {
      localStorage.removeItem('esc_gemini_key');
      toast('Gemini API Key 삭제됨');
    }
  });

  // 캐시 초기화
  document.getElementById('clearCacheBtn')?.addEventListener('click', async () => {
    if (confirm('서비스워커 캐시를 초기화하시겠습니까?')) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      toast('캐시 초기화 완료. 새로고침합니다.');
      setTimeout(() => location.reload(), 1000);
    }
  });
}

