import * as S from './state.js';
import { PROC_ORDER, EQ_MAP } from './constants.js';
import { fD, mdToHtml } from './utils.js';
import { handleFirestoreError, toast } from './app-utils.js';

async function callGemini(apiKey, question) {
    const prompt = `당신은 ESC(세라믹 정전척) 생산관리 AI 어시스턴트입니다. 아래 실시간 데이터를 기반으로 답변하세요.\n\n${buildDataContext()}\n\n사용자 질문: ${question}`;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const json = await res.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text || '응답을 생성할 수 없습니다.';
}

function buildDataContext() {
    const total = Object.keys(S.DATA).length;
    let counts = { '대기': 0, '진행': 0, '완료': 0, '지연': 0, '폐기': 0 };
    Object.values(S.DATA).forEach(d => { const s = d.status || '대기'; if (counts[s] !== undefined) counts[s]++; });

    let ctx = `[생산 현황] 전체: ${total}건, 대기: ${counts['대기']}, 진행: ${counts['진행']}, 완료: ${counts['완료']}, 지연: ${counts['지연']}, 폐기: ${counts['폐기']}\n`;
    ctx += `[공정순서] ${PROC_ORDER.join(' → ')}\n`;
    ctx += `[등록제품] ${Object.values(S.PRODUCTS).map(p => p.name).join(', ')}\n`;

    const delayed = Object.entries(S.DATA).filter(([, d]) => (d.status || '대기') === '지연');
    if (delayed.length) {
        ctx += `[지연 LOT]\n`;
        delayed.forEach(([sn, d]) => { ctx += `- ${sn}: 현재공정=${d.currentProcess || '-'}, 납기=${fD(d.endDate)}\n`; });
    }
    // ... more context
    return ctx;
}

function generateLocalAI(msg) {
  const q = msg.toLowerCase();

  if (q.includes('요약') || q.includes('현황')) {
    const total = Object.keys(S.DATA).length;
    let c = { '대기': 0, '진행': 0, '완료': 0, '지연': 0 };
    Object.values(S.DATA).forEach(d => { const s = d.status || '대기'; if (c[s] !== undefined) c[s]++; });
    return `**📊 생산 현황 요약**\n\n전체 **${total}**건\n- 대기: ${c['대기']}건\n- 진행: ${c['진행']}건\n- 완료: ${c['완료']}건\n- 지연: ${c['지연']}건\n\n완료율: ${total ? Math.round(c['완료'] / total * 100) : 0}%`;
  }
  if (q.includes('지연')) {
    const delayed = Object.entries(S.DATA).filter(([, d]) => (d.status || '대기') === '지연');
    if (!delayed.length) return '현재 지연된 LOT이 없습니다.';
    let r = `**⚠️ 지연 현황 (${delayed.length}건)**\n\n`;
    delayed.forEach(([sn, d]) => { r += `- **${sn}** — ${d.currentProcess || '-'} / 납기: ${fD(d.endDate)}\n`; });
    return r;
  }

    if (q.includes('개선') || q.includes('제안')) {
    return `**💡 생산 효율 개선 제안**\n\n1. 지연 LOT 우선 처리 — 병목 공정의 설비 추가 투입 검토\n2. 공정간 대기시간 최소화 — 이전 공정 완료 즉시 다음 공정 시작\n3. 설비 가동률 모니터링 — 유휴 설비 재배치\n4. 불량률 높은 공정 집중 관리 — 원인 분석 및 예방 조치\n5. 납기 역산 기준 투입 계획 수립`;
  }


  return `"${msg}"에 대한 분석입니다.\n\n현재 로컬 분석 모드입니다. 더 정확한 AI 분석을 원하시면 **설정 → Gemini API Key**를 등록해 주세요.\n\n사용 가능한 명령:\n- 오늘 생산 현황 요약\n- 지연 현황\n- 병목 진단\n- 이번 주 예측\n- 개선 제안\n- 설비 현황\n- 불량 패턴\n- 주간 보고서`;
}


window.askAI = function(question) {
  document.getElementById('chatInput').value = question;
  sendChat();
};

window.sendChat = async function() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  const container = document.getElementById('chatMessages');
  container.innerHTML += `<div class="chat-bubble user">${msg}</div>`;

  const apiKey = localStorage.getItem('esc_gemini_key');
  if (apiKey) {
    container.innerHTML += '<div class="chat-bubble ai typing">분석 중...</div>';
    container.scrollTop = container.scrollHeight;
    try {
      const response = await callGemini(apiKey, msg);
      container.lastElementChild.remove();
      container.innerHTML += `<div class="chat-bubble ai">${mdToHtml(response)}</div>`;
      container.scrollTop = container.scrollHeight;
      return;
    } catch(e) {
      container.lastElementChild.innerHTML = `오류: ${e.message}`;
    }
  }

  const localResponse = generateLocalAI(msg);
  container.innerHTML += `<div class="chat-bubble ai">${mdToHtml(localResponse)}</div>`;
  container.scrollTop = container.scrollHeight;
};
