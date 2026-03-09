import { DATA, PRODUCTS, ISSUES, currentUser, toast, FB, firebaseDb } from './main.js';
import { fD, fmt, todayStr, debounce } from './date-utils.js';
import { getProc, getRoute } from './production-service.js';

/**
 * AI Service for report and chat
 */
export async function askAI(query) {
  const input = document.getElementById('reportQuery');
  const btn = document.getElementById('reportAskBtn');
  if (!query) return;

  const resEl = document.getElementById('reportResult');
  if (input && btn && resEl) {
    resEl.innerHTML = '<div class="ai-loading">AI 분석 중...</div>';
    input.disabled = true;
    btn.disabled = true;
  }

  try {
    const apiKey = localStorage.getItem('gemini_api_key');
    let answer = "";
    if (apiKey && apiKey.startsWith('AIza')) {
      answer = await callGemini(query, apiKey);
    } else {
      answer = generateLocalAI(query);
    }
    if (resEl) {
      resEl.innerHTML = `<div class="ai-answer">${answer.replace(/\n/g, '<br>')}</div>`;
    }
    return answer;
  } catch (err) {
    if (resEl) {
      resEl.innerHTML = `<div class="ai-error">오류: ${err.message}</div>`;
    }
    throw err;
  } finally {
    if (input && btn) {
      input.disabled = false;
      btn.disabled = false;
      input.value = "";
    }
  }
}

export const sendChat = debounce(async function() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  appendChat('user', msg);

  const loading = appendChat('ai', '생각 중...');

  try {
    const response = await askAI(msg);
    loading.innerHTML = response.replace(/\n/g, '<br>');
  } catch (err) {
    loading.innerHTML = "오류가 발생했습니다: " + err.message;
  }
  const container = document.getElementById('chatContainer');
  container.scrollTop = container.scrollHeight;
}, 300);

function appendChat(role, msg) {
  const container = document.getElementById('chatContainer');
  if (!container) return;
  const div = document.createElement('div');
  div.className = `chat-bubble chat-${role}`;
  div.innerHTML = msg.replace(/\n/g, '<br>');
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

async function callGemini(prompt, key) {
  const context = buildDataContext();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `시스템: 당신은 공장 생산 관리 전문가입니다. 다음 데이터를 바탕으로 사용자의 질문에 한국어로 답변하세요.\n\n데이터 요약:\n${context}\n\n사용자: ${prompt}` }]
        }]
      })
    });
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "답변을 생성하지 못했습니다.";
  } catch (err) {
    console.error("Gemini API Error:", err);
    return "API 호출 중 오류가 발생했습니다. 키를 확인하거나 잠시 후 다시 시도하세요.";
  }
}

function buildDataContext() {
  const total = Object.keys(DATA).length;
  const statusCounts = { '진행': 0, '완료': 0, '지연': 0, '대기': 0, '폐기': 0 };
  Object.values(DATA).forEach(d => { if (statusCounts[d.status] !== undefined) statusCounts[d.status]++; });

  const delayedList = Object.entries(DATA)
    .filter(([, d]) => d.status === '지연')
    .slice(0, 5)
    .map(([sn, d]) => `${sn}(${d.currentProcess || '?'})`)
    .join(', ');

  return `
- 전체 LOT 수: ${total}
- 상태: 진행(${statusCounts['진행']}), 완료(${statusCounts['완료']}), 지연(${statusCounts['지연']}), 대기(${statusCounts['대기']}), 폐기(${statusCounts['폐기']})
- 주요 지연 항목: ${delayedList || '없음'}
- 현재 시각: ${new Date().toLocaleString('ko-KR')}
`;
}

function generateLocalAI(msg) {
  const m = msg.toLowerCase();
  if (m.includes('안녕')) return "안녕하세요! 무엇을 도와드릴까요?";
  if (m.includes('현황') || m.includes('요약')) {
    const total = Object.keys(DATA).length;
    const prog = Object.values(DATA).filter(d => d.status === '진행').length;
    const delay = Object.values(DATA).filter(d => d.status === '지연').length;
    const done = Object.values(DATA).filter(d => d.status === '완료').length;
    return `### 생산 현황 요약\n- 전체 LOT: ${total}건\n- 진행 중: ${prog}건\n- 완료: ${done}건\n- 지연: ${delay}건\n\n현재 ${delay}건의 지연이 발생하고 있습니다. 현장의 병목 구간을 점검해 보세요.`;
  }
  if (m.includes('지연')) {
    const delays = Object.entries(DATA).filter(([, d]) => d.status === '지연');
    if (!delays.length) return "현재 지연 중인 항목이 없습니다. 생산이 원활하게 진행되고 있습니다.";
    let res = "### 지연 항목 리스트\n";
    delays.slice(0, 10).forEach(([sn, d]) => {
      res += `- **${sn}**: ${d.currentProcess || '공정 미정'} (납기: ${fmt(fD(d.endDate))})\n`;
    });
    return res;
  }
  return `"${msg}"에 대한 분석입니다.\n\n현재 로컬 분석 모드입니다. 더 정확한 AI 분석을 원하시면 **설정 → Gemini API Key**를 등록해 주세요.`;
}

export function toggleMiniChat() {
  const chat = document.getElementById('miniChat');
  if (chat) chat.classList.toggle('open');
}

export const sendMiniChat = debounce(async function() {
  const input = document.getElementById('miniChatInput');
  const container = document.getElementById('miniChatBody');
  const msg = input.value.trim();
  if (!msg || !container) return;

  const uDiv = document.createElement('div');
  uDiv.style.margin = '8px 0';
  uDiv.style.textAlign = 'right';
  uDiv.innerHTML = `<span style="background:var(--ac2);color:#fff;padding:6px 12px;border-radius:15px;font-size:12px;display:inline-block">${esc(msg)}</span>`;
  container.appendChild(uDiv);
  input.value = "";

  const aDiv = document.createElement('div');
  aDiv.style.margin = '8px 0';
  aDiv.innerHTML = `<span style="background:var(--bg4);padding:6px 12px;border-radius:15px;font-size:12px;display:inline-block">분석 중...</span>`;
  container.appendChild(aDiv);
  container.scrollTop = container.scrollHeight;

  try {
    const response = await askAI(msg);
    aDiv.querySelector('span').innerHTML = response.replace(/\n/g, '<br>');
  } catch (err) {
    aDiv.querySelector('span').innerHTML = "오류: " + err.message;
  }
  container.scrollTop = container.scrollHeight;
}, 300);

const esc = (str) => str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '';
