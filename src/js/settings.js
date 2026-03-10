/* ============================================================
   settings.js – 설정 탭
   ESC Manager v10 – Phase 2
   ============================================================ */
import * as S from './state.js';
import { toast } from './app-utils.js';

export function renderSettings() {
  const page = document.getElementById('settingsTab');
  if (!page) return;

  const geminiKey = localStorage.getItem('esc_gemini_key') || '';
  const keyStatus = geminiKey ? '✅ 등록됨' : '❌ 미등록';
  const keyStatusColor = geminiKey ? 'var(--suc)' : 'var(--err)';

  const user = S.currentUser;
  const settingNameEl = document.getElementById('settingName');
  const settingEmailEl = document.getElementById('settingEmail');
  if (settingNameEl) settingNameEl.textContent = user?.displayName || '사용자';
  if (settingEmailEl) settingEmailEl.textContent = user?.email || '';

  const container = document.getElementById('settingsContent');
  if (!container) return;

  container.innerHTML = `
    <!-- 사용자 정보 -->
    <div class="setting-section">
      <div class="setting-title">👤 계정 정보</div>
      <div class="setting-row">
        <span class="setting-label">이름</span>
        <span class="setting-value">${escHtml(user?.displayName || '사용자')}</span>
      </div>
      <div class="setting-row">
        <span class="setting-label">이메일</span>
        <span class="setting-value">${escHtml(user?.email || '-')}</span>
      </div>
      <div class="setting-row" style="margin-top:12px">
        <button class="btn btn-danger btn-sm" onclick="window.doLogout()">로그아웃</button>
      </div>
    </div>

    <!-- 테마 -->
    <div class="setting-section">
      <div class="setting-title">🎨 화면 설정</div>
      <div class="setting-row">
        <span class="setting-label">다크 모드</span>
        <label class="toggle" id="themeToggle" onclick="window.toggleTheme()">
          <span class="toggle-slider" style="${S.isDarkMode ? '' : ''}"></span>
        </label>
      </div>
    </div>

    <!-- Gemini AI 설정 -->
    <div class="setting-section">
      <div class="setting-title">🤖 Gemini AI 설정</div>
      <div class="setting-row" style="flex-direction:column;align-items:flex-start;gap:8px">
        <div style="display:flex;align-items:center;gap:8px;width:100%">
          <span class="setting-label">API 키 상태</span>
          <span style="font-size:13px;color:${keyStatusColor};font-weight:600">${keyStatus}</span>
        </div>
        <div class="form-group" style="width:100%;margin:0">
          <input type="password" id="geminiKeyInput" class="form-input"
            value="${geminiKey}"
            placeholder="AIzaSy... (Gemini API Key)"
            style="width:100%;font-size:12px;font-family:monospace"
          >
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary btn-sm" onclick="window.saveGeminiKey()">저장</button>
          <button class="btn btn-secondary btn-sm" onclick="window.clearGeminiKey()">키 삭제</button>
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener"
             class="btn btn-secondary btn-sm" style="text-decoration:none">키 발급 →</a>
        </div>
        <div style="font-size:11px;color:var(--t3);line-height:1.6">
          Gemini API 키를 등록하면 AI 어시스턴트에서 실시간 생산 분석을 받을 수 있습니다.<br>
          Google AI Studio에서 무료로 발급받을 수 있습니다.
        </div>
      </div>
    </div>

    <!-- 위젯 설정 -->
    <div class="setting-section">
      <div class="setting-title">📊 홈 위젯 설정</div>
      <div class="setting-row">
        <span class="setting-label" style="font-size:12px;color:var(--t2)">위젯 관리</span>
        <button class="btn btn-secondary btn-sm" onclick="window.openWidgetSettings()">위젯 편집 ⚙️</button>
      </div>
    </div>

    <!-- 데이터 관리 -->
    <div class="setting-section">
      <div class="setting-title">💾 데이터 관리</div>
      <div class="setting-row" style="gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="window.exportData()">📤 Excel 내보내기</button>
        <button class="btn btn-secondary btn-sm" onclick="window.openBackupModal()">💾 백업/복원</button>
        <button class="btn btn-secondary btn-sm" onclick="window.refreshData()">🔄 데이터 새로고침</button>
      </div>
    </div>

    <!-- 캐시/PWA -->
    <div class="setting-section">
      <div class="setting-title">⚙️ 시스템</div>
      <div class="setting-row" style="gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="window.clearAppCache()">🗑️ 캐시 초기화</button>
      </div>
      <div class="setting-row" style="margin-top:8px">
        <span class="setting-label">버전</span>
        <span style="font-size:12px;color:var(--t2)">ESC Manager v10.0 Phase 2</span>
      </div>
    </div>
  `;

  // theme toggle active state
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) themeToggle.classList.toggle('active', !S.isDarkMode);
}

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===================================================
// Gemini Key 관리
// ===================================================
window.saveGeminiKey = function() {
  const input = document.getElementById('geminiKeyInput');
  const key = input ? input.value.trim() : '';
  if (!key) {
    toast('API 키를 입력하세요', 'warn');
    return;
  }
  if (!key.startsWith('AIza')) {
    toast('유효하지 않은 API 키 형식입니다', 'warn');
    return;
  }
  localStorage.setItem('esc_gemini_key', key);
  toast('✅ Gemini API 키가 저장되었습니다', 'success');
  renderSettings();
};

window.clearGeminiKey = function() {
  if (!confirm('Gemini API 키를 삭제하시겠습니까?')) return;
  localStorage.removeItem('esc_gemini_key');
  toast('Gemini API 키가 삭제되었습니다', 'info');
  renderSettings();
};

window.clearAppCache = async function() {
  if (!confirm('서비스워커 캐시를 초기화하시겠습니까?\n새로고침이 됩니다.')) return;
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
  }
  toast('캐시 초기화 완료. 새로고침합니다.', 'success');
  setTimeout(() => location.reload(), 1000);
};
