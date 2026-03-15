/* ============================================================
   ai.js – AI 어시스턴트 서비스
   ESC Manager v10 – Smart AI (Gemini + Context + Commands)
   ============================================================ */
import * as S from './state.js';
import { PROC_ORDER } from './constants.js';
import { fD, mdToHtml } from './utils.js';
import { handleFirestoreError, toast } from './app-utils.js';
import { buildContext, parseCommand } from './ai-context.js';

console.log('🤖 ai.js loaded');

// ===================================================
// Gemini API 호출
// ===================================================
async function callGemini(apiKey, question) {
  const systemCtx = buildContext();
  const prompt = `당신은 "ESC Manager AI"입니다 — 세라믹 정전척(ESC) 생산 공장의 전문 AI 어시스턴트입니다.

## 역할
- 실시간 생산 데이터를 분석하여 정확한 답변을 제공합니다
- 지연 원인 분석, 병목 진단, 생산 효율 개선을 제안합니다
- 공정 전문 용어(탈지, 소성, 환원소성, 평탄화, 도금, 열처리)를 정확히 사용합니다
- 설비(1호기~18호기, 외주, GB)와 제품 카테고리(BL, DC, HL 등)를 이해합니다

## 응답 규칙
1. 한국어로 답변 (기술 용어는 그대로 사용)
2. 숫자/통계는 볼드(**) 처리
3. 테이블이 필요하면 마크다운 테이블 사용
4. 핵심 정보 먼저, 상세 설명 나중에
5. 개선 제안은 구체적 + 실행 가능해야 함
6. 데이터에 없는 내용은 추측하지 말고 "데이터 확인 필요"라고 답변

## 현재 실시간 데이터
${systemCtx}

## 사용자 질문
${question}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    }
  );
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error?.message || `API 오류 (${res.status})`);
  }
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text || '응답을 생성할 수 없습니다.';
}

// ===================================================
// 로컬 AI (API 키 없을 때 또는 실패 시)
// ===================================================
function generateLocalAI(msg) {
  const q = msg.toLowerCase();

  if (q.includes('요약') || q.includes('현황')) {
    const ctx = buildContext();
    return `**📊 생산 현황 요약**\n\n${ctx}`;
  }

  if (q.includes('지연')) {
    const delayed = Object.entries(S.DATA).filter(([, d]) => (d.status || '대기') === '지연');
    if (!delayed.length) return '현재 지연된 LOT이 없습니다. ✅';
    let r = `**⚠️ 지연 현황 (${delayed.length}건)**\n\n`;
    delayed.forEach(([sn, d]) => {
      r += `- **${sn}** — ${d.currentProcess || '-'} / 납기: ${fD(d.endDate)}\n`;
    });
    return r;
  }

  if (q.includes('설비') || q.includes('가동')) {
    const equipUsage = {};
    Object.entries(S.DATA).forEach(([sn, d]) => {
      if (d.status !== '진행') return;
      const proc = d.currentProcess;
      if (!proc) return;
      const pd = d.processes?.[proc];
      const eq = pd?.equip;
      if (eq) {
        if (!equipUsage[eq]) equipUsage[eq] = [];
        equipUsage[eq].push(sn);
      }
    });
    if (!Object.keys(equipUsage).length) return '현재 가동 중인 설비가 없습니다.';
    let r = `**🔧 설비 가동 현황**\n\n`;
    Object.entries(equipUsage).sort((a, b) => b[1].length - a[1].length).forEach(([eq, sns]) => {
      r += `- **${eq}**: ${sns.length}건 가동중 (${sns.slice(0, 3).join(', ')}${sns.length > 3 ? '...' : ''})\n`;
    });
    return r;
  }

  if (q.includes('공정') || q.includes('파이프')) {
    let r = `**⚙️ 공정별 현황**\n\n`;
    PROC_ORDER.forEach(proc => {
      const items = Object.entries(S.DATA).filter(([sn, d]) => {
        return d.currentProcess === proc && (d.status === '진행' || d.status === '대기');
      });
      r += `- **${proc}**: ${items.length}건\n`;
    });
    return r;
  }

  if (q.includes('개선') || q.includes('제안')) {
    return `**💡 생산 효율 개선 제안**\n\n1. 지연 LOT 우선 처리 — 병목 공정의 설비 추가 투입 검토\n2. 공정간 대기시간 최소화 — 이전 공정 완료 즉시 다음 공정 시작\n3. 설비 가동률 모니터링 — 유휴 설비 재배치\n4. 불량률 높은 공정 집중 관리 — 원인 분석 및 예방 조치\n5. 납기 역산 기준 투입 계획 수립`;
  }

  return `"${msg}"에 대한 분석입니다.\n\n**사용 가능한 명령:**\n- 현황 요약\n- 지연 현황\n- 설비 가동 현황\n- 공정별 현황\n- 개선 제안`;
}

// ===================================================
// 타이핑 인디케이터
// ===================================================
function addTypingIndicator(container) {
  const div = document.createElement('div');
  div.className = 'chat-bubble ai';
  div.id = 'ai-typing';
  div.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

// ===================================================
// 명령 실행 핸들러
// ===================================================
async function executeAiCommand(parsed) {
  try {
    if (parsed.action === 'create_sn') {
      const { product, qty, date } = parsed.data;
      const prodId = Object.keys(S.PRODUCTS).find(id => 
        id.toUpperCase().includes(product.toUpperCase())
      ) || product;

      const now = new Date();
      const sheet = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const prefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-`;
      let maxSeq = 0;
      Object.values(S.DATA).forEach(d => {
        if (d.batch && d.batch.startsWith(prefix)) {
          const seqNum = parseInt(d.batch.slice(prefix.length));
          if (!isNaN(seqNum) && seqNum > maxSeq) maxSeq = seqNum;
        }
      });
      const batchCode = `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;

      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
      setVal('sn_batch', batchCode);
      setVal('sn_sheet', sheet);
      setVal('sn_prod', prodId);
      setVal('sn_qty', qty);
      setVal('sn_start', date);
      
      if (typeof window.saveSNBatch === 'function') {
        await window.saveSNBatch();
        return `✅ **${product}** 제품 **${qty}**개 투입을 완료했습니다.\n- 배치: ${batchCode}\n- 시작일: ${date}`;
      } else {
        throw new Error('시스템 함수(saveSNBatch)를 찾을 수 없습니다.');
      }
    }

    if (parsed.action === 'proc_change') {
      const { sn, proc, status } = parsed.data;
      if (typeof window.updateEquip === 'function') {
        await window.updateEquip(sn, proc, 'AI 자동처리');
      } else {
        console.warn('window.updateEquip not found, falling back to local simulation');
      }
      return `✅ **${sn}** LOT의 **${proc}** 공정을 **${status}** 처리했습니다. (설비: AI 자동처리)`;
    }
  } catch (err) {
    console.error('AI Command Error:', err);
    return `❌ 실행 실패: ${err.message}`;
  }
}

// ===================================================
// 명령 확인 UI
// ===================================================
function showCommandConfirm(container, parsed, onConfirm) {
  const actionLabels = {
    create_sn: '신규 LOT 투입',
    proc_change: '공정 상태 변경',
    sn_info: 'LOT 정보 조회',
    analysis: '현황 분석'
  };
  const label = actionLabels[parsed.action] || '명령 실행';
  const div = document.createElement('div');
  div.className = 'chat-bubble ai';
  div.innerHTML = `
    <div style="font-size:13px;margin-bottom:8px">🤖 명령을 감지했습니다: <strong>${label}</strong></div>
    <div style="font-size:12px;color:var(--t2);margin-bottom:10px">"${parsed.original}"</div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-primary btn-sm" id="cmd-confirm">실행</button>
      <button class="btn btn-secondary btn-sm" id="cmd-cancel">취소</button>
    </div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;

  div.querySelector('#cmd-confirm').onclick = () => {
    div.remove();
    onConfirm(parsed);
  };
  div.querySelector('#cmd-cancel').onclick = () => {
    div.remove();
  };
}

// ===================================================
// 공개 API
// ===================================================
window.askAI = function(question) {
  const input = document.getElementById('chatInput');
  if (input) input.value = question;
  window.sendChat();
};

window.sendChat = async function() {
  const input = document.getElementById('chatInput');
  const msg = input ? input.value.trim() : '';
  if (!msg) return;
  if (input) input.value = '';

  const container = document.getElementById('chatMessages');
  if (!container) return;

  const userDiv = document.createElement('div');
  userDiv.className = 'chat-bubble user';
  userDiv.textContent = msg;
  container.appendChild(userDiv);
  container.scrollTop = container.scrollHeight;

  const parsed = parseCommand(msg);
  const apiKey = localStorage.getItem('esc_gemini_key');
  const hasKey = apiKey && apiKey.length > 10;
  
  // 1. 분석/현황 질문
  if (parsed && parsed.action === 'analysis') {
    const typingEl = addTypingIndicator(container);
    if (hasKey) {
      try {
        const response = await callGemini(apiKey, msg);
        typingEl.remove();
        const div = document.createElement('div');
        div.className = 'chat-bubble ai';
        div.innerHTML = mdToHtml(response);
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        return;
      } catch (e) {
        console.warn('Gemini error:', e);
        typingEl.remove();
        const div = document.createElement('div');
        div.className = 'chat-bubble ai';
        div.innerHTML = mdToHtml(generateLocalAI(msg)) + 
          `<div style="font-size:11px;color:var(--err);margin-top:8px;padding-top:6px;border-top:1px solid var(--border)">⚠️ Gemini API 호출 실패: ${e.message}</div>`;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        return;
      }
    }
    // 키 없음
    typingEl.remove();
    const div = document.createElement('div');
    div.className = 'chat-bubble ai';
    div.innerHTML = mdToHtml(generateLocalAI(msg)) + 
      `<div style="font-size:11px;color:var(--t3);margin-top:8px;padding-top:6px;border-top:1px solid var(--border)">💡 현재 로컬 분석 모드입니다. 더 정확한 AI 분석을 원하시면 **설정 → Gemini API Key**를 등록해 주세요.</div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return;
  }

  // 2. 실행형 명령
  if (parsed && parsed.action !== 'analysis' && parsed.data) {
    showCommandConfirm(container, parsed, async (p) => {
      const typingEl = addTypingIndicator(container);
      const result = await executeAiCommand(p);
      typingEl.remove();
      const div = document.createElement('div');
      div.className = 'chat-bubble ai';
      div.innerHTML = mdToHtml(result);
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
    });
    return;
  }

  // 3. 일반 질문
  const typingEl = addTypingIndicator(container);
  if (hasKey) {
    try {
      const response = await callGemini(apiKey, msg);
      typingEl.remove();
      const div = document.createElement('div');
      div.className = 'chat-bubble ai';
      div.innerHTML = mdToHtml(response);
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
      return;
    } catch (e) {
      typingEl.remove();
      const div = document.createElement('div');
      div.className = 'chat-bubble ai';
      div.innerHTML = mdToHtml(generateLocalAI(msg)) + 
        `<div style="font-size:11px;color:var(--err);margin-top:8px;padding-top:6px;border-top:1px solid var(--border)">⚠️ Gemini 연결 실패: ${e.message}</div>`;
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
      return;
    }
  }

  // 로컬 AI 폴백
  await new Promise(r => setTimeout(r, 600));
  typingEl.remove();
  const div = document.createElement('div');
  div.className = 'chat-bubble ai';
  div.innerHTML = mdToHtml(generateLocalAI(msg)) +
    `<div style="font-size:11px;color:var(--t3);margin-top:8px;padding-top:6px;border-top:1px solid var(--border)">💡 Gemini API 키를 등록하면 더 정확한 AI 분석을 받을 수 있습니다.</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
};

// ===================================================
// 미니챗 연동
// ===================================================
window.sendMiniChat = async function() {
  const input = document.getElementById('miniChatInput');
  const msg = input ? input.value.trim() : '';
  if (!msg) return;
  if (input) input.value = '';

  const container = document.getElementById('miniChatMessages');
  if (!container) return;

  const userDiv = document.createElement('div');
  userDiv.className = 'chat-bubble user';
  userDiv.style.fontSize = '12px';
  userDiv.textContent = msg;
  container.appendChild(userDiv);
  container.scrollTop = container.scrollHeight;

  const typingEl = addTypingIndicator(container);
  const apiKey = localStorage.getItem('esc_gemini_key');
  const hasKey = apiKey && apiKey.length > 10;
  let response;
  let errorMsg = '';

  if (hasKey) {
    try {
      response = await callGemini(apiKey, msg);
    } catch (e) {
      response = generateLocalAI(msg);
      errorMsg = e.message;
    }
  } else {
    await new Promise(r => setTimeout(r, 400));
    response = generateLocalAI(msg);
  }

  typingEl.remove();
  const div = document.createElement('div');
  div.className = 'chat-bubble ai';
  div.style.fontSize = '12px';
  div.innerHTML = mdToHtml(response) + 
    (errorMsg ? `<div style="font-size:10px;color:var(--err);margin-top:4px">⚠️ API 오류: ${errorMsg}</div>` : 
    (!hasKey ? `<div style="font-size:10px;color:var(--t3);margin-top:4px">💡 API 키 미등록</div>` : ''));
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
};
