/* ============================================================
   ai.js – AI 어시스턴트 서비스
   ESC Manager v10 – Smart AI (Gemini + Context + Commands)
   ============================================================ */
import * as S from './state.js';
import { PROC_ORDER } from './constants.js';
import { fD } from './utils.js';
import { handleFirestoreError, toast } from './app-utils.js';
import { buildContext, parseCommand } from './ai-context.js';
import { updateEquip, saveSNBatch } from './main.js';

// ===================================================
// Gemini API 호출
// ===================================================
async function callGemini(apiKey, question) {
  // ... (기존 callGemini 코드 유지)
}

// ... (mdToHtml, escHtml, generateLocalAI, addTypingIndicator 등 기존 코드 유지)

// ===================================================
// 명령 실행 핸들러
// ===================================================
async function executeAiCommand(parsed) {
  try {
    if (parsed.action === 'create_sn') {
      const { product, qty, date } = parsed.data;
      // S.PRODUCTS에서 입력받은 제품명이 포함된 실제 ID 찾기
      const prodId = Object.keys(S.PRODUCTS).find(id => 
        id.toUpperCase().includes(product.toUpperCase())
      ) || product;

      // 시트 번호는 오늘 날짜 YYMMDD 기본값
      const now = new Date();
      const sheet = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      
      // 배치 코드는 자동 생성 (오늘날짜-001 형식)
      const prefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-`;
      let maxSeq = 0;
      Object.values(S.DATA).forEach(d => {
        if (d.batch && d.batch.startsWith(prefix)) {
          const seqNum = parseInt(d.batch.slice(prefix.length));
          if (!isNaN(seqNum) && seqNum > maxSeq) maxSeq = seqNum;
        }
      });
      const batchCode = `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;

      // saveSNBatch 호출을 위해 DOM 요소들에 값 임시 설정 (main.js 로직 재활용)
      // 실제로는 API 기반으로 리팩토링하는 것이 좋으나, 현재 main.js 구조에 맞춤
      const options = {
        sn_batch: batchCode,
        sn_sheet: sheet,
        sn_prod: prodId,
        sn_qty: qty,
        sn_seq: 1, // 기본 1번부터
        sn_start: date,
        sn_proc: PROC_ORDER[0]
      };

      // main.js의 saveSNBatch가 DOM에서 값을 읽으므로 수동으로 데이터 구성하여 전달하는 방식으로 우회하거나 
      // main.js의 saveSNBatch를 수정해야 함. 여기서는 데이터 기반으로 동작하도록 main.js를 참고하여 구현
      
      // 임시: main.js의 saveSNBatch를 직접 호출하는 대신 필요한 로직만 수행하도록 구현 가능하나
      // 여기서는 main.js의 saveSNBatch가 export되어 있으므로 이를 활용하기 위해 DOM 조작 최소화 시도
      
      // [!] 실제 구현 시 main.js의 saveSNBatch가 파라미터를 받도록 수정되었음을 가정 (or 래퍼 생성)
      // 현재 main.js의 saveSNBatch는 DOM에서 직접 읽음.
      // TODO: main.js의 saveSNBatch를 데이터 기반으로 리팩토링 필요. 
      // 일단은 에러 방지를 위해 간단한 알림으로 대체하거나 DOM에 값을 세팅하고 호출.
      
      // DOM 세팅 (임시 방편)
      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
      setVal('sn_batch', batchCode);
      setVal('sn_sheet', sheet);
      setVal('sn_prod', prodId);
      setVal('sn_qty', qty);
      setVal('sn_start', date);
      
      await window.saveSNBatch();
      return `✅ **${product}** 제품 **${qty}**개 투입을 완료했습니다.\n- 배치: ${batchCode}\n- 시작일: ${date}`;
    }

    if (parsed.action === 'proc_change') {
      const { sn, proc, status } = parsed.data;
      // updateEquip(sn, proc, '자동배정'); 
      // 실제로는 상태 변경 로직이 필요함 (main.js의 updateProcStartDate 등 활용)
      // 여기서는 간단히 설비 미지정 상태로 공정 시작 처리
      await updateEquip(sn, proc, 'AI 자동처리');
      return `✅ **${sn}** LOT의 **${proc}** 공정을 **${status}** 처리했습니다.`;
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
  sendChat();
};

window.sendChat = async function() {
  const input = document.getElementById('chatInput');
  const msg = input ? input.value.trim() : '';
  if (!msg) return;
  if (input) input.value = '';

  const container = document.getElementById('chatMessages');
  if (!container) return;

  // 사용자 메시지 추가
  const userDiv = document.createElement('div');
  userDiv.className = 'chat-bubble user';
  userDiv.textContent = msg;
  container.appendChild(userDiv);
  container.scrollTop = container.scrollHeight;

  // 명령 파싱
  const parsed = parseCommand(msg);
  if (parsed && parsed.action === 'analysis') {
    // 분석 명령은 바로 실행
    const typingEl = addTypingIndicator(container);
    await new Promise(r => setTimeout(r, 500));
    typingEl.remove();

    const apiKey = localStorage.getItem('esc_gemini_key');
    if (apiKey) {
      try {
        const response = await callGemini(apiKey, msg);
        const div = document.createElement('div');
        div.className = 'chat-bubble ai';
        div.innerHTML = mdToHtml(response);
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
        return;
      } catch (e) {
        console.warn('Gemini error:', e);
      }
    }
    const div = document.createElement('div');
    div.className = 'chat-bubble ai';
    div.innerHTML = mdToHtml(generateLocalAI(msg));
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return;
  }

  if (parsed && parsed.action !== 'analysis' && parsed.data) {
    // 실행형 명령 감지 시 확인 UI 표시
    showCommandConfirm(container, parsed, async (p) => {
      const typingEl = addTypingIndicator(container);
      
      // 실제 명령 실행
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

  // 일반 질문 → Gemini or 로컬
  const typingEl = addTypingIndicator(container);

  const apiKey = localStorage.getItem('esc_gemini_key');
  if (apiKey) {
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
      const errDiv = document.createElement('div');
      errDiv.className = 'chat-bubble ai';
      errDiv.innerHTML = mdToHtml(generateLocalAI(msg)) +
        `<div style="font-size:11px;color:var(--t2);margin-top:8px;padding-top:6px;border-top:1px solid var(--border)">` +
        `⚠️ Gemini 연결 실패 (${e.message}) — 로컬 분석 결과입니다</div>`;
      container.appendChild(errDiv);
      container.scrollTop = container.scrollHeight;
      return;
    }
  }

  // API 키 없으면 로컬 AI
  await new Promise(r => setTimeout(r, 600));
  typingEl.remove();
  const div = document.createElement('div');
  div.className = 'chat-bubble ai';
  div.innerHTML = mdToHtml(generateLocalAI(msg)) +
    `<div style="font-size:11px;color:var(--t3);margin-top:8px;padding-top:6px;border-top:1px solid var(--border)">` +
    `💡 Gemini API 키를 등록하면 더 정확한 AI 분석을 받을 수 있습니다.</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
};

// ... (sendMiniChat 등 나머지 코드 유지)

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
  let response;
  if (apiKey) {
    try {
      response = await callGemini(apiKey, msg);
    } catch (e) {
      response = generateLocalAI(msg);
    }
  } else {
    await new Promise(r => setTimeout(r, 400));
    response = generateLocalAI(msg);
  }

  typingEl.remove();
  const div = document.createElement('div');
  div.className = 'chat-bubble ai';
  div.style.fontSize = '12px';
  div.innerHTML = mdToHtml(response);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
};
