import*as S from'./state.js';
import{PROC_ORDER,PROC_COLORS,EQ_MAP}from'./constants.js';
import{fD,esc,statusBadge,mdToHtml,toast}from'./utils.js';
import{db,doc,updateDoc,getDocs,collection,getMaxSeqFromFirestore}from'./firebase.js';

function addChatBubble(cid,msg,role){const c=document.getElementById(cid);const el=document.createElement('div');el.className=`chat-bubble ${role}`;el.style.maxWidth='80%';if(role==='user'){el.style.background='linear-gradient(135deg,var(--ac1),var(--ac2))';el.style.color='white';el.style.alignSelf='flex-end';}else{el.style.background='var(--bg4)';el.style.color='var(--t1)';el.style.alignSelf='flex-start';el.style.border='1px solid var(--border)';}el.innerHTML=msg.replace(/\n/g,'<br>');c.appendChild(el);c.scrollTop=c.scrollHeight;return el;}

function buildAIContext(){
const total=S.D.length;const done=S.D.filter(d=>d.status==='완료').length;const late=S.D.filter(d=>d.status==='지연').length;const prog=S.D.filter(d=>d.status==='진행').length;const today=fD(new Date());const todayIssues=S.ISSUES.filter(i=>i.date===today);const lateItems=S.D.filter(d=>d.status==='지연').map(d=>`${d.sn}(${d.productName},${d.currentProcess})`).join(', ');const defectCount=S.D.filter(d=>d.status==='폐기'||d.defectType==='NG').length;
const prodStatus={};S.D.forEach(d=>{const k=d.productName||'미지정';if(!prodStatus[k])prodStatus[k]={대기:0,진행:0,완료:0,지연:0,폐기:0};prodStatus[k][d.status]=(prodStatus[k][d.status]||0)+1;});const prodStatusStr=Object.entries(prodStatus).map(([k,v])=>`${k}: 대기${v.대기} 진행${v.진행} 완료${v.완료} 지연${v.지연} 폐기${v.폐기}`).join('\n');
const procStatus={};PROC_ORDER.forEach(p=>{let cnt=0;S.D.forEach(item=>{const pr=(item.processes||{})[p];if(pr&&pr.status==='진행')cnt++;});if(cnt>0)procStatus[p]=cnt;});const procStatusStr=Object.entries(procStatus).map(([k,v])=>`${k}: ${v}건 진행중`).join(', ');
let equipActive=0,equipIdle=0;PROC_ORDER.forEach(pn=>{const allEq=new Set();Object.values(EQ_MAP[pn]||{}).forEach(eqs=>eqs.forEach(e=>allEq.add(e)));allEq.forEach(eq=>{const isActive=S.D.some(item=>{const p=(item.processes||{})[pn];return p&&p.equip===eq&&p.status==='진행';});if(isActive)equipActive++;else equipIdle++;});});
let todayDueCount=0;S.D.forEach(item=>{Object.values(item.processes||{}).forEach(p=>{if(p.planEnd===today&&p.status!=='완료')todayDueCount++;});});
const recentIssues=S.ISSUES.slice(0,5).map(is=>`[${is.date}][${is.type}] ${is.sn||''}: ${is.content}`).join('\n');
const prodDefect={};S.D.forEach(d=>{const k=d.productName||'미지정';if(!prodDefect[k])prodDefect[k]={total:0,defect:0};prodDefect[k].total++;if(d.status==='폐기'||d.defectType==='NG')prodDefect[k].defect++;});const defectTop=Object.entries(prodDefect).map(([k,v])=>({name:k,rate:v.total>0?Math.round(v.defect/v.total*1000)/10:0,defect:v.defect,total:v.total})).sort((a,b)=>b.rate-a.rate).slice(0,3).map(d=>`${d.name}: ${d.rate}% (${d.defect}/${d.total})`).join(', ');
const prodList=S.PRODS.map(p=>p.id).join(', ');
return`오늘: ${today}\n총 생산: ${total}건 | 완료: ${done}건(${total?Math.round(done/total*100):0}%) | 진행중: ${prog}건 | 지연: ${late}건 | 불량/폐기: ${defectCount}건\n오늘 완료 예정: ${todayDueCount}건\n설비: 가동 ${equipActive} / 유휴 ${equipIdle}\n\n[제품별 현황]\n${prodStatusStr}\n\n[공정별 진행]\n${procStatusStr||'없음'}\n\n[지연 품목]\n${lateItems||'없음'}\n\n[불량률 상위]\n${defectTop||'없음'}\n\n[최근 이슈]\n${recentIssues||'없음'}\n\n[등록 제품 목록]\n${prodList||'없음'}\n\n오늘 이슈: ${todayIssues.length}건`;}

async function callGemini(msg,cid){
const key=localStorage.getItem('geminiKey');if(!key){addChatBubble(cid,'⚠️ Gemini API Key가 설정되지 않았습니다. 설정 탭에서 입력해주세요.','ai');return;}
const loadEl=addChatBubble(cid,'<span style="animation:spin 1s linear infinite;display:inline-block">⟳</span> 생각 중...','ai');
const ctx=buildAIContext();
const systemPrompt=`당신은 세라믹 정전척(ESC) 생산관리 전문 AI 어시스턴트입니다.\n사용자가 생산 명령을 내리면 반드시 아래 JSON 형식으로만 응답하세요:\n\`\`\`json\n{"action":"create_sn","product":"588H","quantity":5,"startDate":"2026-03-02","equipment":"1호기"}\n\`\`\`\n일반 질문이면 자연스럽게 한국어로 답변하세요.\n\n현재 생산 데이터:\n${ctx}`;
const prompt=`${systemPrompt}\n\n사용자 질문: ${msg}`;
try{const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})});const json=await res.json();const text=json.candidates?.[0]?.content?.parts?.[0]?.text||'응답을 받지 못했습니다.';
const jsonMatch=text.match(/```json\s*\n?([\s\S]*?)\n?\s*```/);
if(jsonMatch){try{const action=JSON.parse(jsonMatch[1]);if(action.action==='create_sn'){S.setPendingAIAction(action);loadEl.innerHTML=`<div class="ai-confirm-card"><div style="font-weight:600;margin-bottom:8px">📦 S/N 생성 확인</div><div class="acc-row"><span class="acc-label">제품:</span><span class="acc-value">${action.product}</span></div><div class="acc-row"><span class="acc-label">수량:</span><span class="acc-value">${action.quantity}매</span></div><div class="acc-row"><span class="acc-label">시작일:</span><span class="acc-value">${action.startDate}</span></div><div class="acc-row"><span class="acc-label">설비:</span><span class="acc-value">${action.equipment||'1호기'}</span></div><div class="acc-buttons"><button class="btn btn-primary btn-sm" onclick="executeAIAction()">✅ 확인 생성</button><button class="btn btn-secondary btn-sm" onclick="cancelAIAction()">취소</button></div></div>`;return;}}catch(e){}}
loadEl.innerHTML=mdToHtml(text);
}catch(e){loadEl.innerHTML='오류: '+e.message;}}

export async function sendChat(){const input=document.getElementById('chatInput');const msg=input.value.trim();if(!msg)return;input.value='';addChatBubble('chatMessages',msg,'user');await callGemini(msg,'chatMessages');}
export function askAI(q){document.getElementById('chatInput').value=q;sendChat();}
export async function sendMiniChat(){const input=document.getElementById('miniChatInput');const msg=input.value.trim();if(!msg)return;input.value='';addChatBubble('miniChatMessages',msg,'user');await callGemini(msg,'miniChatMessages');}
export function toggleMiniChat(){document.getElementById('miniChatWin').classList.toggle('open');}

export async function executeAIAction(){
if(!S.pendingAIAction)return;const action=S.pendingAIAction;S.setPendingAIAction(null);
const prod=S.PRODS.find(p=>p.id===action.product||p.id.toLowerCase()===action.product.toLowerCase());
if(!prod){addChatBubble('chatMessages',`❌ 제품 "${action.product}" 없음. 등록 제품: ${S.PRODS.map(p=>p.id).join(', ')}`,'ai');return;}
const today=fD(new Date()).replace(/-/g,'');const existing=S.D.filter(d=>d.batchId&&d.batchId.startsWith(today)).map(d=>parseInt(d.batchId.split('-')[1]||0));const next=existing.length?Math.max(...existing)+1:1;const batchId=`${today}-${String(next).padStart(3,'0')}`;const sheetNo=fD(new Date()).replace(/-/g,'').slice(2);const cat=prod.category||'WN';const maxSeq=await getMaxSeqFromFirestore(cat,prod.id,sheetNo);
try{const{saveSNBatch}=await import('./modals.js');await saveSNBatch({batchId,sheetNo,product:prod.id,equipment:action.equipment||'1호기',quantity:action.quantity||1,startDate:action.startDate,seq:maxSeq+1});addChatBubble('chatMessages',`✅ ${prod.id} ${action.quantity}매 생성 완료!\n배치: ${batchId}\n시작: ${action.startDate}`,'ai');}catch(e){addChatBubble('chatMessages','❌ 생성 실패: '+e.message,'ai');}}

export function cancelAIAction(){S.setPendingAIAction(null);addChatBubble('chatMessages','취소되었습니다.','ai');}
