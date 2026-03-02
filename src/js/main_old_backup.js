 /* ══════════════════════════════════════════════════════════════
   ESC Manager v9.0 — main.js (Vite 모듈)
   원본 단일 HTML에서 추출한 전체 JS 로직
   ══════════════════════════════════════════════════════════════ */

/* ── PWA: 매니페스트 + 서비스워커 ── */
(function(){
  const svgIcon='<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="80" fill="%236366f1"/><text x="256" y="340" font-family="Arial,sans-serif" font-size="240" font-weight="bold" fill="white" text-anchor="middle">ESC</text></svg>';
  const svgDataUri='data:image/svg+xml,'+encodeURIComponent(svgIcon.replace(/%/g,'%25'));
  const manifest={name:"ESC Manager",short_name:"ESC",description:"세라믹 정전척 생산관리 시스템",start_url:"./",display:"standalone",background_color:"#0a0f1e",theme_color:"#0a0f1e",icons:[{src:svgDataUri,sizes:"192x192",type:"image/svg+xml"},{src:svgDataUri,sizes:"512x512",type:"image/svg+xml"}]};
  const manifestBlob=new Blob([JSON.stringify(manifest)],{type:'application/json'});
  const manifestUrl=URL.createObjectURL(manifestBlob);
  const link=document.createElement('link');link.rel='manifest';link.href=manifestUrl;document.head.appendChild(link);
  const appleIcon=document.createElement('link');appleIcon.rel='apple-touch-icon';appleIcon.href=svgDataUri;document.head.appendChild(appleIcon);
  const swCode=`
    const CACHE_NAME='esc-v9-cache-v2';
    const SHELL_URLS=[self.registration.scope];
    self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(SHELL_URLS)).then(()=>self.skipWaiting()));});
    self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
    self.addEventListener('fetch',e=>{
      const url=new URL(e.request.url);
      if(url.hostname.includes('gstatic.com')||url.hostname.includes('googleapis.com')||url.hostname.includes('firebaseio.com')||url.hostname.includes('firebase')||url.hostname.includes('cdn.sheetjs.com')||url.hostname.includes('cdn.jsdelivr.net')){
        e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
        return;
      }
      e.respondWith(caches.match(e.request).then(cached=>{
        const fetched=fetch(e.request).then(resp=>{
          if(resp&&resp.status===200){const clone=resp.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,clone));}
          return resp;
        }).catch(()=>cached);
        return cached||fetched;
      }));
    });
  `;
  if('serviceWorker' in navigator){
    const swBlob=new Blob([swCode],{type:'application/javascript'});
    const swUrl=URL.createObjectURL(swBlob);
    navigator.serviceWorker.register(swUrl,{scope:'./'}).catch(()=>{});
  }
  window.addEventListener('online',()=>{document.getElementById('offlineBanner').classList.remove('show');});
  window.addEventListener('offline',()=>{document.getElementById('offlineBanner').classList.add('show');});
  if(!navigator.onLine){document.getElementById('offlineBanner').classList.add('show');}
})();

/* ── CDN 라이브러리 동적 로드 ── */
function loadScript(src){return new Promise((resolve,reject)=>{if(document.querySelector(`script[src="${src}"]`)){resolve();return;}const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);})}
Promise.all([
  loadScript('https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js'),
  loadScript('https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js')
]).catch(()=>console.warn('CDN 라이브러리 일부 로딩 실패'));

/* ── Firebase ── */
import{initializeApp}from'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import{getAuth,GoogleAuthProvider,signInWithPopup,signInWithRedirect,getRedirectResult,onAuthStateChanged,signOut}from'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import{getFirestore,collection,doc,setDoc,addDoc,getDoc,getDocs,query,orderBy,limit,where,onSnapshot,writeBatch,updateDoc,deleteDoc,serverTimestamp}from'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const FC={apiKey:'AIzaSyAwDS2PigihTH6RKMxzrH-utlaKJbtHBTY',authDomain:'esc-production-management.firebaseapp.com',projectId:'esc-production-management',storageBucket:'esc-production-management.firebasestorage.app',messagingSenderId:'622370430583',appId:'1:622370430583:web:363b6e2f185fddcbd33072'};
const app=initializeApp(FC);const auth=getAuth(app);const db=getFirestore(app);const provider=new GoogleAuthProvider();

let D=[];let PRODS=[];let ISSUES=[];
let currentUser=null;let currentSN=null;
let currentTab='home';let sidebarCollapsed=false;
let isDark=true;let wsFilters=['전체'];let wsGroups={};let selectedSNs=new Set();
let ganttView='product';let ganttDayW=30;
let ganttExpandState={};let ganttAllExpanded=false;
let calView='month';let calDate=new Date();
let dlData=null;
let wsViewMode='product';
let equipSectionOpen=false;
let kanbanOpen=false;
let pendingAIAction=null;

const PROC_COLORS={'탈지':'#3b82f6','소성':'#f59e0b','환원소성':'#a855f7','평탄화':'#10b981','도금':'#06b6d4','열처리':'#ec4899'};
const PROC_ORDER=['탈지','소성','환원소성','평탄화','도금','열처리'];
const EQ_MAP={
  '탈지':{'BL':['1호기','2호기','3호기'],'WN':['1호기','2호기','3호기'],'HP':['1호기','2호기','3호기']},
  '소성':{'BL':['1호기','4호기'],'WN':['5호기','10호기','11호기','12호기','13호기','14호기','15호기','16호기','17호기','18호기'],'HP':['5호기','10호기','11호기','12호기','13호기','14호기','15호기','16호기','17호기','18호기']},
  '환원소성':{'BL':['2호기'],'WN':[],'HP':[]},
  '평탄화':{'BL':['3호기'],'WN':['6호기','7호기','8호기','9호기'],'HP':['6호기','7호기','8호기','9호기']},
  '도금':{'BL':['외주'],'WN':['외주'],'HP':['외주']},
  '열처리':{'BL':['GB'],'WN':['GB'],'HP':['GB']}
};

const DEFAULT_WIDGETS=[
  {id:'todayTask',label:'📌 오늘 할 일',enabled:true,order:1},
  {id:'preventAlert',label:'🔔 예방적 알림',enabled:true,order:2},
  {id:'kpiGrid',label:'📊 KPI 카드',enabled:true,order:3},
  {id:'pipeline',label:'🔄 라이브 파이프라인',enabled:true,order:4},
  {id:'kanban',label:'🎯 드래그 보드',enabled:false,order:5},
  {id:'equipStatus',label:'🏭 설비 현황',enabled:false,order:6},
  {id:'charts',label:'📈 상태분포/주간완료 차트',enabled:true,order:7},
  {id:'recentActivity',label:'🕐 최근 활동',enabled:true,order:8}
];
function getWidgetConfig(){try{const c=JSON.parse(localStorage.getItem('esc_widget_config'));if(c&&c.length)return c;}catch(e){}return JSON.parse(JSON.stringify(DEFAULT_WIDGETS));}
let widgetConfig=getWidgetConfig();

function fD(d){if(!d)return'';const dt=d instanceof Date?d:new Date(d);return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0')}
function addBD(d,n){let dt=new Date(d);for(let i=0;i<n;){dt.setDate(dt.getDate()+1);const w=dt.getDay();if(w!==0&&w!==6)i++;}return dt}
function diffBD(a,b){let s=new Date(a<b?a:b),e=new Date(a<b?b:a),c=0;while(s<e){s.setDate(s.getDate()+1);const w=s.getDay();if(w!==0&&w!==6)c++;}return a<b?c:-c}
function diffBDRaw(a,b){return Math.round((b-a)/(1000*60*60*24))}
function buildRoute(cat,joint,heat){const r=['탈지','소성'];if(cat==='BL')r.push('환원소성');r.push('평탄화');if(joint!=='Brazing')r.push('도금');if(heat==='Y')r.push('열처리');return r.join('→')}
function procDays(name,cat,stack){if(name==='탈지')return(cat==='BL'&&stack>=9)?5:3;if(name==='소성')return(cat==='BL'&&stack>=9)?5:3;if(name==='환원소성')return 3;if(name==='평탄화')return 3;if(name==='도금')return 1;if(name==='열처리')return 1;return 3;}
function statusBadge(s){const m={'대기':'badge-wait','진행':'badge-prog','완료':'badge-done','지연':'badge-late','폐기':'badge-disc'};return`<span class="badge ${m[s]||'badge-wait'}">${s||'대기'}</span>`}
function toast(msg,type='ok'){const t=document.createElement('div');t.className=`toast toast-${type}`;const icons={ok:'✅',err:'❌',warn:'⚠️'};t.innerHTML=`<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;document.getElementById('toastContainer').appendChild(t);setTimeout(()=>t.remove(),3000)}
function closeModal(id){document.getElementById(id).classList.add('hidden')}
function openModal(id){document.getElementById(id).classList.remove('hidden')}
function calcProgress(item){const procs=item.processes||{};const route=(item.route||'').split('→').filter(Boolean);if(!route.length)return item.progress||0;const done=route.filter(p=>procs[p]&&procs[p].status==='완료').length;return Math.round(done/route.length*100)}
function getDplus(item){if(!item.startDate)return'-';const d=diffBD(new Date(item.startDate),new Date());return d>=0?`D+${d}`:`D-${Math.abs(d)}`}
function esc(s){return(s||'').replace(/'/g,"\\'").replace(/"/g,'&quot;')}
function calcActualDays(startStr,endStr){if(!startStr||!endStr)return 0;const s=new Date(startStr);const e=new Date(endStr);let c=0;let cur=new Date(s);while(cur<e){cur.setDate(cur.getDate()+1);const w=cur.getDay();if(w!==0&&w!==6)c++;}return Math.max(c,1);}

function mdToHtml(text){
  if(!text)return'';
  let html=text;
  html=html.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  html=html.replace(/`([^`]+)`/g,'<code style="background:var(--bg4);padding:1px 4px;border-radius:3px;font-size:12px">$1</code>');
  html=html.replace(/\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)*)/g,function(match,headerRow,bodyRows){
    const headers=headerRow.split('|').map(h=>h.trim()).filter(Boolean);
    let table='<table style="font-size:11px;margin:6px 0;border:1px solid var(--border);border-radius:4px"><thead><tr>'+headers.map(h=>'<th style="padding:4px 6px">'+h+'</th>').join('')+'</tr></thead><tbody>';
    bodyRows.trim().split('\n').forEach(row=>{const cells=row.split('|').map(c=>c.trim()).filter(Boolean);table+='<tr>'+cells.map(c=>'<td style="padding:3px 6px;border-top:1px solid var(--border)">'+c+'</td>').join('')+'</tr>';});
    table+='</tbody></table>';return table;
  });
  html=html.replace(/^[\-\*] (.+)$/gm,'<li style="margin-left:16px;font-size:12px">$1</li>');
  html=html.replace(/(<li[^>]*>.*<\/li>\n?)+/g,function(m){return'<ul style="list-style:disc;padding-left:10px;margin:4px 0">'+m+'</ul>';});
  html=html.replace(/^\d+\. (.+)$/gm,'<li style="margin-left:16px;font-size:12px">$1</li>');
  html=html.replace(/\n/g,'<br>');
  return html;
}

async function doLogin(){
  document.getElementById('loginSpinner').style.display='block';
  document.getElementById('loginError').style.display='none';
  try{await signInWithPopup(auth,provider)}
  catch(e){
    if(e.code==='auth/popup-blocked'||e.code==='auth/cancelled-popup-request'){
      try{await signInWithRedirect(auth,provider)}catch(e2){showLoginError(e2.message)}
    }else{showLoginError(e.message)}
    document.getElementById('loginSpinner').style.display='none';
  }
}
function showLoginError(msg){const el=document.getElementById('loginError');el.textContent=msg;el.style.display='block';document.getElementById('loginSpinner').style.display='none'}
async function doLogout(){await signOut(auth)}
window.doLogin=doLogin;window.doLogout=doLogout;

getRedirectResult(auth).catch(()=>{});

onAuthStateChanged(auth,async user=>{
  if(user){
    currentUser=user;
    document.getElementById('sidebarToggleBtn').textContent='✕';
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('app').classList.add('visible');
    setUserUI(user);
    await loadData();
    switchTab('home');
    checkHashSN();
  }else{
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('app').classList.remove('visible');
    currentUser=null;
  }
});

function checkHashSN(){
  const hash=location.hash;
  if(hash.startsWith('#sn=')){
    const sn=decodeURIComponent(hash.slice(4));
    setTimeout(()=>{if(D.find(d=>d.sn===sn)){openSidePanel(sn);}else{toast('S/N을 찾을 수 없습니다: '+sn,'warn');}},500);
  }
}
window.addEventListener('hashchange',()=>{
  const hash=location.hash;
  if(hash.startsWith('#sn=')){
    const sn=decodeURIComponent(hash.slice(4));
    if(D.find(d=>d.sn===sn)){openSidePanel(sn);}
  }
});

function setUserUI(user){
  const name=user.displayName||user.email;
  const initials=name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
  ['sbAvatar','tbAvatar'].forEach(id=>{const el=document.getElementById(id);if(user.photoURL){el.innerHTML=`<img src="${user.photoURL}" alt="">`}else{el.textContent=initials}});
  document.getElementById('sbName').textContent=name;
  document.getElementById('sbEmail').textContent=user.email;
  document.getElementById('settingName').textContent=name;
  document.getElementById('settingEmail').textContent=user.email;
  const key=localStorage.getItem('geminiKey')||'';
  document.getElementById('geminiKeyInput').value=key;
  document.getElementById('geminiKeyStatus').textContent=key?'✅ API Key 저장됨':'저장된 키 없음';
}

let unsubProd=null,unsubIssues=null;
async function loadData(){
  const pSnap=await getDocs(collection(db,'products'));
  PRODS=pSnap.docs.map(d=>({id:d.id,...d.data()}));
  if(unsubProd)unsubProd();
  unsubProd=onSnapshot(collection(db,'production'),snap=>{D=snap.docs.map(d=>({id:d.id,...d.data()}));onDataUpdate();});
  if(unsubIssues)unsubIssues();
  unsubIssues=onSnapshot(query(collection(db,'issues'),orderBy('createdAt','desc')),snap=>{ISSUES=snap.docs.map(d=>({id:d.id,...d.data()}));if(currentTab==='calendar')renderCalendar();});
}
window.refreshData=async function(){const pSnap=await getDocs(collection(db,'products'));PRODS=pSnap.docs.map(d=>({id:d.id,...d.data()}));toast('데이터 새로고침 완료','ok');onDataUpdate();}
function onDataUpdate(){
  if(currentTab==='home')renderHome();
  else if(currentTab==='workspace')renderWorkspace();
  else if(currentTab==='gantt')renderGantt();
  else if(currentTab==='analysis')renderAnalysis();
  updateDataStats();
}

const TAB_INFO={
  home:{title:'홈',icon:'<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'},
  workspace:{title:'워크스페이스',icon:'<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>'},
  calendar:{title:'캘린더',icon:'<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'},
  gantt:{title:'간트차트',icon:'<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>'},
  analysis:{title:'분석',icon:'<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>'},
  ai:{title:'AI 어시스턴트',icon:'<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>'},
  settings:{title:'설정',icon:'<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>'}
};

window.switchTab=function(tab){
  document.querySelectorAll('.tab-content').forEach(el=>el.style.display='none');
  document.getElementById(tab+'Tab').style.display='';
  document.querySelectorAll('.sb-item').forEach(el=>{el.classList.toggle('active',el.dataset.tab===tab)});
  document.querySelectorAll('.bb-item').forEach(el=>{el.classList.toggle('active',el.dataset.tab===tab)});
  const info=TAB_INFO[tab]||{title:tab,icon:''};
  document.getElementById('tbTitle').textContent=info.title;
  document.getElementById('tbIcon').innerHTML=info.icon;
  currentTab=tab;
  if(tab==='home')renderHome();
  else if(tab==='workspace')renderWorkspace();
  else if(tab==='calendar')renderCalendar();
  else if(tab==='gantt')renderGantt();
  else if(tab==='analysis')renderAnalysis();
};

window.toggleSidebar=function(){
  const sb=document.getElementById('sidebar');const main=document.getElementById('main');const btn=document.getElementById('sidebarToggleBtn');const isMobile=window.innerWidth<=768;
  if(isMobile){if(sb.style.display==='flex'){sb.style.display='none';if(btn)btn.textContent='☰';}else{sb.style.display='flex';if(btn)btn.textContent='✕';}}
  else{if(sb.classList.contains('collapsed')){sb.classList.remove('collapsed');main.classList.remove('collapsed');main.style.marginLeft='';if(btn)btn.textContent='✕';}else{sb.classList.add('collapsed');main.classList.add('collapsed');main.style.marginLeft='var(--sbm)';if(btn)btn.textContent='☰';}}
};

window.toggleTheme=function(){isDark=!isDark;document.body.classList.toggle('light',!isDark);const t=document.getElementById('themeToggle');if(t)t.classList.toggle('on',isDark);}

/* ══════════════════════════════════════════════════════════════
   HOME
   ══════════════════════════════════════════════════════════════ */
function renderHome(){
  const now=new Date();const h=now.getHours();
  const greet=h<6?'🌙 새벽에도 열심히네요':h<12?'🌅 좋은 아침입니다':h<18?'☀️ 좋은 오후입니다':'🌆 수고하셨습니다';
  const active=D.filter(d=>d.status==='진행').length;const issues=ISSUES.filter(i=>i.date===fD(now)).length;
  document.getElementById('greetMsg').textContent=`${greet}, ${(currentUser?.displayName||'').split(' ')[0]||'관리자'}님!`;
  document.getElementById('greetSub').textContent=`현재 진행중 ${active}건 · 오늘 이슈 ${issues}건`;
  const late=D.filter(d=>d.status==='지연');const da=document.getElementById('delayAlertCard');
  if(late.length>0){da.style.display='';document.getElementById('delayAlertMsg').textContent=`${late.length}건의 생산이 지연 중입니다: ${late.slice(0,3).map(d=>d.sn).join(', ')}${late.length>3?'...':''}`}else{da.style.display='none'}
  const container=document.getElementById('widgetContainer');container.innerHTML='';
  const sorted=[...widgetConfig].sort((a,b)=>a.order-b.order);
  sorted.forEach(w=>{if(!w.enabled)return;const div=document.createElement('div');div.id='widget_'+w.id;div.style.marginBottom='16px';container.appendChild(div);});
  sorted.forEach(w=>{
    if(!w.enabled)return;const el=document.getElementById('widget_'+w.id);if(!el)return;
    if(w.id==='todayTask'){el.innerHTML=`<div class="card" id="todayTaskCardInner"><div class="card-title">📌 오늘 할 일</div><div id="todayTaskContent"></div></div>`;renderTodayTasks();}
    else if(w.id==='preventAlert'){el.innerHTML=`<div class="card" id="preventAlertCardInner"><div class="card-title">🔔 예방적 알림</div><div id="preventAlertContent"></div></div>`;renderPreventAlerts();}
    else if(w.id==='kpiGrid'){renderKPI(el);}
    else if(w.id==='pipeline'){el.innerHTML=`<div class="card"><div class="card-title">🔄 라이브 파이프라인</div><div class="pipeline" id="pipelineWrap"></div></div>`;renderPipeline();}
    else if(w.id==='kanban'){el.innerHTML=`<div class="card"><div class="equip-section-toggle" onclick="toggleKanban()"><span id="kanbanToggleArrow">${kanbanOpen?'▼':'▶'}</span><span>🎯 드래그 보드 (칸반)</span></div><div id="kanbanContent" style="display:${kanbanOpen?'block':'none'};margin-top:12px"></div></div>`;if(kanbanOpen)renderKanban();}
    else if(w.id==='equipStatus'){el.innerHTML=`<div class="card" id="equipStatusCardInner"><div class="equip-section-toggle" id="equipToggleBtnInner" onclick="toggleEquipSection()"><span id="equipToggleArrowInner">${equipSectionOpen?'▼':'▶'}</span><span>🏭 설비 현황</span><span style="font-size:12px;font-weight:400;color:var(--t2)" id="equipSummaryTextInner"></span></div><div id="equipStatusContentInner" style="display:${equipSectionOpen?'block':'none'};margin-top:12px"></div></div>`;renderEquipStatus();}
    else if(w.id==='charts'){el.innerHTML=`<div class="grid2"><div class="card"><div class="card-title">📊 상태 분포</div><div class="chart-wrap"><canvas id="donutChart" height="200"></canvas></div></div><div class="card"><div class="card-title">📈 이번 주 완료</div><div class="chart-wrap"><canvas id="weekBarChart" height="200"></canvas></div></div></div>`;drawDonutChart('donutChart',{대기:D.filter(d=>d.status==='대기').length,진행:D.filter(d=>d.status==='진행').length,완료:D.filter(d=>d.status==='완료').length,지연:late.length,폐기:D.filter(d=>d.status==='폐기').length});drawWeekBarChart();}
    else if(w.id==='recentActivity'){const sortedD=[...D].sort((a,b)=>(b.registeredAt||'').localeCompare(a.registeredAt||'')).slice(0,8);el.innerHTML=`<div class="card"><div class="card-title">🕐 최근 활동</div><div id="recentActivityInner">${sortedD.map(d=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);flex-wrap:wrap">${statusBadge(d.status)}<span style="font-size:13px;font-weight:500;cursor:pointer;color:var(--ac2)" onclick="openSidePanel('${d.sn}')">${d.sn}</span><span style="font-size:12px;color:var(--t2)">${d.productName||''}</span><span style="font-size:12px;color:var(--t2);margin-left:auto">${d.currentProcess||''}</span></div>`).join('')}</div></div>`;}
  });
}

function renderKPI(el){
  const total=D.length;const done=D.filter(d=>d.status==='완료').length;const prog=D.filter(d=>d.status==='진행').length;const lateC=D.filter(d=>d.status==='지연').length;
  el.innerHTML=`<div class="grid4"><div class="kpi-card"><div class="kpi-label">총 생산</div><div class="kpi-value">${total}</div><div class="kpi-sub">등록된 S/N</div></div><div class="kpi-card"><div class="kpi-label">완료율</div><div class="kpi-value">${total?Math.round(done/total*100):0}%</div><div class="kpi-sub">${done}/${total}</div></div><div class="kpi-card"><div class="kpi-label">진행중</div><div class="kpi-value" style="color:var(--warn)">${prog}</div><div class="kpi-sub">현재 생산 중</div></div><div class="kpi-card"><div class="kpi-label">지연</div><div class="kpi-value" style="color:var(--err)">${lateC}</div><div class="kpi-sub">관리 필요</div></div></div>`;
}

function renderPipeline(){
  let pipeHtml='';
  PROC_ORDER.forEach((p,i)=>{let pg=0,wt=0,dn=0;D.forEach(item=>{const proc=(item.processes||{})[p];if(proc){if(proc.status==='진행')pg++;else if(proc.status==='대기')wt++;else if(proc.status==='완료')dn++;}});const c=PROC_COLORS[p]||'#666';pipeHtml+=`<div class="pipe-stage" style="border-top:3px solid ${c}"><div class="pipe-name" style="color:${c}">${p}</div><div class="pipe-counts"><span class="pipe-count" style="background:rgba(245,158,11,0.2);color:#f59e0b">진행${pg}</span><span class="pipe-count" style="background:rgba(59,130,246,0.2);color:#3b82f6">대기${wt}</span><span class="pipe-count" style="background:rgba(16,185,129,0.2);color:#10b981">완료${dn}</span></div></div>`;if(i<PROC_ORDER.length-1)pipeHtml+='<div class="pipe-arrow">→</div>';});
  const el=document.getElementById('pipelineWrap');if(el)el.innerHTML=pipeHtml;
}

function renderTodayTasks(){
  const today=fD(new Date());const dueToday=[];const startToday=[];const overdue=[];
  D.forEach(item=>{const procs=item.processes||{};const route=(item.route||'').split('→').filter(Boolean);route.forEach(pn=>{const p=procs[pn]||{};if(p.planEnd===today&&p.status!=='완료'){dueToday.push({sn:item.sn,proc:pn,equip:p.equip||'',status:p.status||'대기'});}if(p.startDate===today&&p.status!=='완료'){startToday.push({sn:item.sn,proc:pn,equip:p.equip||'',status:p.status||'대기'});}if(p.planEnd&&p.planEnd<today&&p.status!=='완료'){overdue.push({sn:item.sn,proc:pn,equip:p.equip||'',status:p.status||'대기',planEnd:p.planEnd});}});});
  const content=document.getElementById('todayTaskContent');if(!content)return;
  if(!dueToday.length&&!startToday.length&&!overdue.length){content.innerHTML=`<div style="text-align:center;padding:16px;color:var(--t2);font-size:13px">오늘 예정된 작업이 없습니다 ✨</div>`;return;}
  let html='';
  if(dueToday.length){html+=`<div class="today-section red"><div class="today-section-title"><span style="color:var(--err)">🔴 오늘 완료 예정 (${dueToday.length})</span></div>${dueToday.map(t=>`<div class="today-item"><span style="cursor:pointer;color:var(--ac2);font-family:monospace" onclick="openSidePanel('${esc(t.sn)}')">${t.sn}</span><span class="proc-dot" style="background:${PROC_COLORS[t.proc]||'#666'}"></span><span>${t.proc}</span><span style="color:var(--t2)">${t.equip}</span>${statusBadge(t.status)}</div>`).join('')}</div>`;}
  if(startToday.length){html+=`<div class="today-section yellow"><div class="today-section-title"><span style="color:var(--warn)">🟡 오늘 투입 예정 (${startToday.length})</span></div>${startToday.map(t=>`<div class="today-item"><span style="cursor:pointer;color:var(--ac2);font-family:monospace" onclick="openSidePanel('${esc(t.sn)}')">${t.sn}</span><span class="proc-dot" style="background:${PROC_COLORS[t.proc]||'#666'}"></span><span>${t.proc}</span><span style="color:var(--t2)">${t.equip}</span>${statusBadge(t.status)}</div>`).join('')}</div>`;}
  if(overdue.length){html+=`<div class="today-section orange"><div class="today-section-title"><span style="color:#f97316">⚠️ 지연 중 (${overdue.length})</span></div>${overdue.map(t=>`<div class="today-item"><span style="cursor:pointer;color:var(--ac2);font-family:monospace" onclick="openSidePanel('${esc(t.sn)}')">${t.sn}</span><span class="proc-dot" style="background:${PROC_COLORS[t.proc]||'#666'}"></span><span>${t.proc}</span><span style="color:var(--t2)">${t.equip}</span>${statusBadge(t.status)}<span style="color:var(--err);font-size:11px">예정:${t.planEnd}</span></div>`).join('')}</div>`;}
  content.innerHTML=html;
}

function renderPreventAlerts(){
  const today=new Date();today.setHours(0,0,0,0);const todayStr=fD(today);const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);const tomorrowStr=fD(tomorrow);const in3=new Date(today);in3.setDate(in3.getDate()+3);const in3Str=fD(in3);
  const dueTomorrow=[];D.forEach(item=>{const procs=item.processes||{};const route=(item.route||'').split('→').filter(Boolean);route.forEach(pn=>{const p=procs[pn]||{};if(p.planEnd===tomorrowStr&&p.status!=='완료'){dueTomorrow.push({sn:item.sn,proc:pn,equip:p.equip||''});}});});
  const nearDeadline=[];D.forEach(item=>{if(item.status==='완료'||item.status==='폐기')return;if(item.endDate&&item.endDate>=todayStr&&item.endDate<=in3Str){nearDeadline.push({sn:item.sn,productName:item.productName||'',endDate:item.endDate,status:item.status});}});
  const procDelay=[];D.forEach(item=>{const procs=item.processes||{};const route=(item.route||'').split('→').filter(Boolean);route.forEach(pn=>{const p=procs[pn]||{};if(p.status==='진행'&&p.startDate&&p.planDays){const expected=addBD(new Date(p.startDate),p.planDays);if(expected<today){const overDays=diffBD(expected,today);procDelay.push({sn:item.sn,proc:pn,equip:p.equip||'',planDays:p.planDays,overDays});}}});});
  const dayOfWeek=today.getDay();const monday=new Date(today);monday.setDate(today.getDate()-(dayOfWeek===0?6:dayOfWeek-1));const friday=new Date(monday);friday.setDate(monday.getDate()+4);const monStr=fD(monday);const friStr=fD(friday);
  let weekTarget=0,weekDone=0;D.forEach(item=>{const procs=item.processes||{};const route=(item.route||'').split('→').filter(Boolean);route.forEach(pn=>{const p=procs[pn]||{};if(p.planEnd&&p.planEnd>=monStr&&p.planEnd<=friStr)weekTarget++;if(p.actualEnd&&p.actualEnd>=monStr&&p.actualEnd<=friStr&&p.status==='완료')weekDone++;});});
  const content=document.getElementById('preventAlertContent');if(!content)return;
  const hasAlerts=dueTomorrow.length||nearDeadline.length||procDelay.length||weekTarget>0;
  if(!hasAlerts){content.innerHTML=`<div style="text-align:center;padding:16px;color:var(--ok);font-size:13px">현재 특별한 알림이 없습니다 ✅</div>`;return;}
  let html='';
  if(dueTomorrow.length){html+=`<div class="alert-card-section blue"><div class="today-section-title"><span style="color:var(--info)">📅 내일 완료 예정 (${dueTomorrow.length})</span></div>${dueTomorrow.map(t=>`<div class="alert-item"><span class="equip-sn-link" onclick="openSidePanel('${esc(t.sn)}')">${t.sn}</span><span class="proc-dot" style="background:${PROC_COLORS[t.proc]||'#666'}"></span><span>${t.proc}</span><span style="color:var(--t2)">${t.equip}</span></div>`).join('')}</div>`;}
  if(nearDeadline.length){html+=`<div class="alert-card-section orange"><div class="today-section-title"><span style="color:#f97316">⏰ 3일 이내 납기 (${nearDeadline.length})</span></div>${nearDeadline.map(t=>{const diff=Math.ceil((new Date(t.endDate)-today)/(1000*60*60*24));const urgColor=diff<=1?'var(--err)':'#f97316';return`<div class="alert-item"><span class="equip-sn-link" onclick="openSidePanel('${esc(t.sn)}')">${t.sn}</span><span style="font-size:11px;color:var(--t2)">${t.productName}</span>${statusBadge(t.status)}<span style="color:${urgColor};font-weight:600;font-size:11px">${diff===0?'오늘!':diff+'일 남음'}</span></div>`;}).join('')}</div>`;}
  if(procDelay.length){html+=`<div class="alert-card-section red"><div class="today-section-title"><span style="color:var(--err)">🔥 공정 지체 감지 (${procDelay.length})</span></div>${procDelay.map(t=>`<div class="alert-item"><span class="equip-sn-link" onclick="openSidePanel('${esc(t.sn)}')">${t.sn}</span><span class="proc-dot" style="background:${PROC_COLORS[t.proc]||'#666'}"></span><span>${t.proc}</span><span style="color:var(--err);font-size:11px;font-weight:600">계획 ${t.planDays}일 → ${t.overDays}일 초과</span></div>`).join('')}</div>`;}
  if(weekTarget>0){const pct=weekTarget>0?Math.round(weekDone/weekTarget*100):0;const barColor=pct>=80?'var(--ok)':pct>=50?'var(--warn)':'var(--err)';html+=`<div class="alert-card-section green"><div class="today-section-title"><span style="color:var(--ok)">📊 주간 완료 목표</span></div><div style="display:flex;align-items:center;gap:10px;font-size:13px"><span>완료 <strong>${weekDone}</strong> / 예정 <strong>${weekTarget}</strong></span><span style="color:${barColor};font-weight:700">${pct}%</span></div><div class="prog-bar" style="height:6px;margin-top:6px"><div class="prog-fill" style="width:${pct}%;background:${barColor}"></div></div></div>`;}
  content.innerHTML=html;
}

window.toggleEquipSection=function(){equipSectionOpen=!equipSectionOpen;const c=document.getElementById('equipStatusContentInner');const a=document.getElementById('equipToggleArrowInner');if(c)c.style.display=equipSectionOpen?'':'none';if(a)a.textContent=equipSectionOpen?'▼':'▶';};

function renderEquipStatus(){
  const equipData={};const today=fD(new Date());let totalActive=0,totalIdle=0;
  PROC_ORDER.forEach(procName=>{const allEquips=new Set();Object.values(EQ_MAP[procName]||{}).forEach(eqs=>eqs.forEach(e=>allEquips.add(e)));allEquips.forEach(equipName=>{const key=procName+'__'+equipName;if(!equipData[key])equipData[key]={proc:procName,equip:equipName,active:[],dueToday:0};D.forEach(item=>{const p=(item.processes||{})[procName];if(!p||p.equip!==equipName)return;if(p.status==='진행'){equipData[key].active.push(item.sn);}if(p.planEnd===today&&p.status!=='완료'){equipData[key].dueToday++;}});if(equipData[key].active.length>0)totalActive++;else totalIdle++;});});
  const summaryEl=document.getElementById('equipSummaryTextInner');if(summaryEl)summaryEl.textContent=`가동 ${totalActive} · 유휴 ${totalIdle}`;
  let html='';
  PROC_ORDER.forEach(procName=>{const color=PROC_COLORS[procName]||'#666';const procEquips=Object.values(equipData).filter(e=>e.proc===procName);if(!procEquips.length)return;const activeCount=procEquips.filter(e=>e.active.length>0).length;html+=`<div style="margin-bottom:14px"><div style="font-size:13px;font-weight:600;margin-bottom:8px;color:${color}">${procName} <span style="font-size:11px;color:var(--t2);font-weight:400">(가동 ${activeCount}/${procEquips.length})</span></div><div class="grid3">`;procEquips.forEach(eq=>{const isActive=eq.active.length>0;const statusDot=isActive?'🟢':'⚪';const statusText=isActive?'가동중':'유휴';const snListHtml=eq.active.slice(0,5).map(sn=>`<span class="equip-sn-link" onclick="openSidePanel('${esc(sn)}')">${sn.length>16?'…'+sn.slice(-14):sn}</span>`).join(', ');const extra=eq.active.length>5?` 외 ${eq.active.length-5}건`:'';html+=`<div class="equip-card" style="border-top:2px solid ${color}"><div class="equip-card-title"><span>${statusDot}</span><span>${eq.equip}</span><span style="font-size:10px;color:var(--t2);font-weight:400">${statusText}</span></div><div style="font-size:12px;color:var(--t1)">진행: <strong>${eq.active.length}</strong>건</div>${eq.dueToday?`<div style="font-size:11px;color:var(--warn)">오늘 완료예정: ${eq.dueToday}건</div>`:''}<div class="equip-sn-list">${snListHtml}${extra}</div></div>`;});html+=`</div></div>`;});
  const contentEl=document.getElementById('equipStatusContentInner');if(contentEl)contentEl.innerHTML=html||'<div style="color:var(--t2);font-size:13px;text-align:center;padding:12px">설비 데이터가 없습니다</div>';
}

window.toggleKanban=function(){kanbanOpen=!kanbanOpen;const c=document.getElementById('kanbanContent');const a=document.getElementById('kanbanToggleArrow');if(c){c.style.display=kanbanOpen?'block':'none';if(kanbanOpen)renderKanban();}if(a)a.textContent=kanbanOpen?'▼':'▶';};

function renderKanban(){
  const el=document.getElementById('kanbanContent');if(!el)return;
  const columns={};PROC_ORDER.forEach(p=>columns[p]=[]);
  D.forEach(item=>{if(item.status==='완료'||item.status==='폐기')return;const cp=item.currentProcess;if(cp&&columns[cp]!==undefined){const proc=(item.processes||{})[cp]||{};if(proc.status==='진행'||proc.status==='대기'){columns[cp].push(item);}}});
  let html='<div class="kanban-board" id="kanbanBoard">';
  PROC_ORDER.forEach(proc=>{const color=PROC_COLORS[proc]||'#666';const items=columns[proc]||[];html+=`<div class="kanban-column" data-proc="${proc}" id="kanbanCol_${proc}"><div class="kanban-header" style="border-bottom-color:${color};color:${color}">${proc} (${items.length})</div>`;items.forEach(item=>{const procs=item.processes||{};const p=procs[proc]||{};const snShort=item.sn.length>18?'…'+item.sn.slice(-16):item.sn;html+=`<div class="kanban-card" draggable="true" data-sn="${esc(item.sn)}" data-proc="${proc}" data-route="${esc(item.route||'')}"><div class="kc-sn" onclick="openSidePanel('${esc(item.sn)}')">${snShort}</div><div class="kc-info">${p.equip||'-'} · ${getDplus(item)}</div><div>${statusBadge(p.status||'대기')}</div></div>`;});html+=`</div>`;});
  html+='</div>';el.innerHTML=html;initKanbanDnD();
}

function initKanbanDnD(){
  const board=document.getElementById('kanbanBoard');if(!board)return;
  let dragEl=null;let dragSN='';let dragProc='';let dragRoute='';let touchClone=null;let touchCol=null;
  board.querySelectorAll('.kanban-card').forEach(card=>{
    card.addEventListener('dragstart',e=>{dragEl=card;dragSN=card.dataset.sn;dragProc=card.dataset.proc;dragRoute=card.dataset.route;card.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragSN);});
    card.addEventListener('dragend',()=>{if(dragEl)dragEl.classList.remove('dragging');board.querySelectorAll('.kanban-column').forEach(c=>c.classList.remove('drag-over'));dragEl=null;});
    card.addEventListener('touchstart',e=>{dragSN=card.dataset.sn;dragProc=card.dataset.proc;dragRoute=card.dataset.route;touchClone=card.cloneNode(true);touchClone.style.position='fixed';touchClone.style.zIndex='9999';touchClone.style.opacity='0.7';touchClone.style.pointerEvents='none';touchClone.style.width=card.offsetWidth+'px';document.body.appendChild(touchClone);const t=e.touches[0];touchClone.style.left=(t.clientX-30)+'px';touchClone.style.top=(t.clientY-20)+'px';card.classList.add('dragging');},{passive:true});
    card.addEventListener('touchmove',e=>{if(!touchClone)return;e.preventDefault();const t=e.touches[0];touchClone.style.left=(t.clientX-30)+'px';touchClone.style.top=(t.clientY-20)+'px';board.querySelectorAll('.kanban-column').forEach(col=>col.classList.remove('drag-over'));const el=document.elementFromPoint(t.clientX,t.clientY);const col=el?el.closest('.kanban-column'):null;if(col)col.classList.add('drag-over');touchCol=col;},{passive:false});
    card.addEventListener('touchend',()=>{card.classList.remove('dragging');board.querySelectorAll('.kanban-column').forEach(c=>c.classList.remove('drag-over'));if(touchClone){touchClone.remove();touchClone=null;}if(touchCol){const targetProc=touchCol.dataset.proc;if(targetProc&&targetProc!==dragProc){handleKanbanDrop(dragSN,dragProc,targetProc,dragRoute);}}touchCol=null;},{passive:true});
  });
  board.querySelectorAll('.kanban-column').forEach(col=>{
    col.addEventListener('dragover',e=>{e.preventDefault();col.classList.add('drag-over');e.dataTransfer.dropEffect='move';});
    col.addEventListener('dragleave',()=>col.classList.remove('drag-over'));
    col.addEventListener('drop',e=>{e.preventDefault();col.classList.remove('drag-over');const targetProc=col.dataset.proc;if(targetProc&&targetProc!==dragProc){handleKanbanDrop(dragSN,dragProc,targetProc,dragRoute);}});
  });
}

async function handleKanbanDrop(sn,fromProc,toProc,routeStr){
  const route=routeStr.split('→').filter(Boolean);const fromIdx=route.indexOf(fromProc);const toIdx=route.indexOf(toProc);
  if(toIdx<0){toast('해당 공정은 이 제품의 라우트에 없습니다','warn');return;}
  if(toIdx<=fromIdx){toast('이전 공정으로는 이동할 수 없습니다','warn');return;}
  if(toIdx!==fromIdx+1){toast('한 단계씩만 이동할 수 있습니다','warn');return;}
  const item=D.find(d=>d.sn===sn);if(!item)return;const today=fD(new Date());const proc=(item.processes||{})[fromProc]||{};const actualDays=calcActualDays(proc.startDate,today);
  const updateData={};updateData[`processes.${fromProc}.status`]='완료';updateData[`processes.${fromProc}.actualEnd`]=today;updateData[`processes.${fromProc}.actualDays`]=actualDays;updateData[`processes.${toProc}.status`]='진행';updateData[`processes.${toProc}.startDate`]=today;updateData['currentProcess']=toProc;
  try{await updateDoc(doc(db,'production',sn),updateData);toast(`${sn}: ${fromProc} 완료 → ${toProc} 시작`,'ok');}catch(e){toast('오류: '+e.message,'err');}
}

window.openWidgetSettings=function(){renderWidgetSettingsList();openModal('widgetModal');};
function renderWidgetSettingsList(){const list=document.getElementById('widgetSettingsList');const sorted=[...widgetConfig].sort((a,b)=>a.order-b.order);list.innerHTML=sorted.map((w,i)=>`<div class="widget-item" data-wid="${w.id}"><div class="toggle ${w.enabled?'on':''}" onclick="toggleWidgetEnabled('${w.id}')"></div><div class="wi-name">${w.label}</div><div class="wi-arrows"><button onclick="moveWidget('${w.id}',-1)" ${i===0?'disabled':''}>▲</button><button onclick="moveWidget('${w.id}',1)" ${i===sorted.length-1?'disabled':''}>▼</button></div></div>`).join('');}
window.toggleWidgetEnabled=function(id){const w=widgetConfig.find(x=>x.id===id);if(w){w.enabled=!w.enabled;renderWidgetSettingsList();}};
window.moveWidget=function(id,dir){const sorted=[...widgetConfig].sort((a,b)=>a.order-b.order);const idx=sorted.findIndex(x=>x.id===id);const swapIdx=idx+dir;if(swapIdx<0||swapIdx>=sorted.length)return;const tmpOrder=sorted[idx].order;sorted[idx].order=sorted[swapIdx].order;sorted[swapIdx].order=tmpOrder;widgetConfig=sorted;renderWidgetSettingsList();};
window.saveWidgetConfig=function(){localStorage.setItem('esc_widget_config',JSON.stringify(widgetConfig));toast('위젯 설정이 저장되었습니다','ok');closeModal('widgetModal');renderHome();};
window.resetWidgetConfig=function(){widgetConfig=JSON.parse(JSON.stringify(DEFAULT_WIDGETS));renderWidgetSettingsList();toast('기본값으로 초기화되었습니다','ok');};

/* ══════════════════════════════════════════════════════════════
   CHARTS
   ══════════════════════════════════════════════════════════════ */
function drawDonutChart(id,data){const canvas=document.getElementById(id);if(!canvas)return;const ctx=canvas.getContext('2d');canvas.width=0;const W=canvas.parentElement.clientWidth||300;canvas.width=W;canvas.height=200;const vals=[data.대기||0,data.진행||0,data.완료||0,data.지연||0,data.폐기||0];const labels=['대기','진행','완료','지연','폐기'];const colors=['#3b82f6','#f59e0b','#10b981','#ef4444','#94a3b8'];const total=vals.reduce((a,b)=>a+b,0);if(!total){ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--t2')||'#8892b0';ctx.font='14px Noto Sans KR';ctx.textAlign='center';ctx.fillText('데이터 없음',W/2,100);return;}const r=Math.min(70,W/4);const ri=r*0.64;const cx=W<350?W/2:W/2-60;const cy=100;let angle=-Math.PI/2;vals.forEach((v,i)=>{if(!v)return;const sweep=v/total*2*Math.PI;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,angle,angle+sweep);ctx.closePath();ctx.fillStyle=colors[i];ctx.fill();angle+=sweep;});ctx.beginPath();ctx.arc(cx,cy,ri,0,Math.PI*2);ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--bg3')||'#131b32';ctx.fill();ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--t1')||'#f1f5f9';ctx.font='bold 18px Noto Sans KR';ctx.textAlign='center';ctx.fillText(total,cx,cy+6);ctx.font='11px Noto Sans KR';ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--t2')||'#8892b0';ctx.fillText('전체',cx,cy+22);if(W>=350){const lx=cx+r+20,ly=40;vals.forEach((v,i)=>{const y=ly+i*28;ctx.fillStyle=colors[i];ctx.fillRect(lx,y,12,12);ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--t1')||'#f1f5f9';ctx.font='12px Noto Sans KR';ctx.textAlign='left';ctx.fillText(`${labels[i]}: ${v}`,lx+16,y+10);});}else{let lx=8;const ly=185;vals.forEach((v,i)=>{if(!v)return;ctx.fillStyle=colors[i];ctx.fillRect(lx,ly,8,8);ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--t1')||'#f1f5f9';ctx.font='10px Noto Sans KR';ctx.textAlign='left';const txt=`${labels[i]}:${v}`;ctx.fillText(txt,lx+10,ly+8);lx+=ctx.measureText(txt).width+20;});}}

function drawWeekBarChart(){const canvas=document.getElementById('weekBarChart');if(!canvas)return;const ctx=canvas.getContext('2d');canvas.width=0;const W=canvas.parentElement.clientWidth||300;canvas.width=W;canvas.height=200;ctx.clearRect(0,0,W,200);const now=new Date();const dayOfWeek=now.getDay();const monday=new Date(now);monday.setDate(now.getDate()-(dayOfWeek===0?6:dayOfWeek-1));const days=['월','화','수','목','금'];const vals=days.map((_,i)=>{const d=new Date(monday);d.setDate(monday.getDate()+i);const ds=fD(d);return D.filter(item=>{const procs=item.processes||{};return Object.values(procs).some(p=>p.actualEnd===ds&&p.status==='완료');}).length;});const max=Math.max(...vals,1);const pad=30,bw=Math.min(40,(W-pad*2)/5-10);const h=200,barH=h-60;ctx.strokeStyle=getComputedStyle(document.body).getPropertyValue('--border')||'rgba(255,255,255,0.08)';[0,max/2,max].forEach(v=>{const y=pad+barH*(1-v/max);ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(W-pad,y);ctx.stroke();ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--t2')||'#8892b0';ctx.font='10px Noto Sans KR';ctx.textAlign='right';ctx.fillText(Math.round(v),pad-4,y+4);});vals.forEach((v,i)=>{const x=pad+(W-pad*2)/5*i+(W-pad*2)/10-bw/2;const bh=v/max*barH;const y=pad+barH-bh;const grad=ctx.createLinearGradient(0,y,0,y+bh);grad.addColorStop(0,'#818cf8');grad.addColorStop(1,'#6366f1');ctx.fillStyle=grad;ctx.beginPath();ctx.roundRect(x,y,bw,bh,4);ctx.fill();ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--t1')||'#f1f5f9';ctx.font='11px Noto Sans KR';ctx.textAlign='center';ctx.fillText(days[i],x+bw/2,h-8);if(v>0){ctx.fillText(v,x+bw/2,y-4);}});}

// ═══════════════════════════════════════════════════════════
// PART 2 — 작업등록(Workspace) 탭 · 캘린더 탭 · 간트차트 탭
// ═══════════════════════════════════════════════════════════

// ──────────────────────────────────────────────
// 2-1. 작업등록(Workspace) 탭
// ──────────────────────────────────────────────
function renderWorkspace() {
  const main = document.getElementById('main-content');
  if (!main) return;

  // 필터 상태
  const filterStatus = window._wsFilterStatus || 'all';
  const filterProduct = window._wsFilterProduct || 'all';
  const searchText = (window._wsSearch || '').toLowerCase();

  // 필터링
  let filtered = [...D];
  if (filterStatus !== 'all') {
    if (filterStatus === 'active') filtered = filtered.filter(d => d.status !== '완료' && d.status !== '출하완료');
    else if (filterStatus === 'done') filtered = filtered.filter(d => d.status === '완료' || d.status === '출하완료');
    else if (filterStatus === 'issue') filtered = filtered.filter(d => (d.issues && d.issues.length > 0) || d.status === '이슈');
  }
  if (filterProduct !== 'all') filtered = filtered.filter(d => d.product === filterProduct);
  if (searchText) filtered = filtered.filter(d =>
    (d.sn || '').toLowerCase().includes(searchText) ||
    (d.product || '').toLowerCase().includes(searchText) ||
    (d.customer || '').toLowerCase().includes(searchText)
  );

  // 정렬: 최신 등록 순
  filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const productOptions = [...new Set(D.map(d => d.product).filter(Boolean))].sort();

  main.innerHTML = `
    <div class="workspace-header" style="display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:20px;">
      <h2 style="margin:0; flex:1;">작업 관리</h2>
      <div class="search-wrap" style="flex:0 0 220px;">
        <input type="text" id="ws-search" placeholder="S/N, 제품, 고객 검색..." value="${window._wsSearch || ''}" style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--glass-bg);color:var(--text);">
      </div>
      <select id="ws-filter-status" style="padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--glass-bg);color:var(--text);">
        <option value="all" ${filterStatus === 'all' ? 'selected' : ''}>전체 상태</option>
        <option value="active" ${filterStatus === 'active' ? 'selected' : ''}>진행중</option>
        <option value="done" ${filterStatus === 'done' ? 'selected' : ''}>완료</option>
        <option value="issue" ${filterStatus === 'issue' ? 'selected' : ''}>이슈</option>
      </select>
      <select id="ws-filter-product" style="padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--glass-bg);color:var(--text);">
        <option value="all">전체 제품</option>
        ${productOptions.map(p => `<option value="${p}" ${filterProduct === p ? 'selected' : ''}>${p}</option>`).join('')}
      </select>
      <button class="btn btn-primary" onclick="openNewLotModal()">+ 새 LOT 등록</button>
    </div>

    <div class="workspace-stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px;">
      <div class="card" style="padding:16px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:var(--accent);">${D.length}</div>
        <div style="font-size:12px;color:var(--text-secondary);">전체 LOT</div>
      </div>
      <div class="card" style="padding:16px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#4ade80;">${D.filter(d => d.status !== '완료' && d.status !== '출하완료').length}</div>
        <div style="font-size:12px;color:var(--text-secondary);">진행중</div>
      </div>
      <div class="card" style="padding:16px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:#f59e0b;">${D.filter(d => d.issues && d.issues.length > 0).length}</div>
        <div style="font-size:12px;color:var(--text-secondary);">이슈 보유</div>
      </div>
      <div class="card" style="padding:16px;text-align:center;">
        <div style="font-size:24px;font-weight:700;color:var(--text-secondary);">${D.filter(d => d.status === '완료' || d.status === '출하완료').length}</div>
        <div style="font-size:12px;color:var(--text-secondary);">완료</div>
      </div>
    </div>

    <div class="card" style="overflow-x:auto;">
      <table>
        <thead>
          <tr>
            <th>S/N</th><th>제품</th><th>고객</th><th>현재 공정</th><th>진행률</th><th>상태</th><th>등록일</th><th>작업</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length === 0 ? '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-secondary);">데이터가 없습니다</td></tr>' :
            filtered.map(d => {
              const prog = calcProgress(d);
              const currentProc = getCurrentProcess(d);
              const statusClass = d.status === '완료' || d.status === '출하완료' ? 'badge-success' :
                                  (d.issues && d.issues.length > 0) ? 'badge-danger' : 'badge-info';
              const dateStr = d.createdAt ? new Date(d.createdAt).toLocaleDateString('ko-KR') : '-';
              return `<tr style="cursor:pointer;" onclick="openLotDetail('${d.id}')">
                <td><strong>${d.sn || '-'}</strong></td>
                <td>${d.product || '-'}</td>
                <td>${d.customer || '-'}</td>
                <td>${currentProc || '-'}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:8px;">
                    <div class="progress-bar" style="flex:1;height:6px;">
                      <div class="progress-fill" style="width:${prog}%;"></div>
                    </div>
                    <span style="font-size:12px;min-width:35px;">${prog}%</span>
                  </div>
                </td>
                <td><span class="badge ${statusClass}">${d.status || '진행중'}</span></td>
                <td style="font-size:12px;color:var(--text-secondary);">${dateStr}</td>
                <td>
                  <button class="btn btn-small" onclick="event.stopPropagation();openStatusEdit('${d.id}')">공정입력</button>
                </td>
              </tr>`;
            }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // 이벤트 바인딩
  document.getElementById('ws-search')?.addEventListener('input', e => {
    window._wsSearch = e.target.value;
    renderWorkspace();
  });
  document.getElementById('ws-filter-status')?.addEventListener('change', e => {
    window._wsFilterStatus = e.target.value;
    renderWorkspace();
  });
  document.getElementById('ws-filter-product')?.addEventListener('change', e => {
    window._wsFilterProduct = e.target.value;
    renderWorkspace();
  });
}

function getCurrentProcess(d) {
  if (!d.processes) return PROC_ORDER[0];
  for (let i = PROC_ORDER.length - 1; i >= 0; i--) {
    if (d.processes[PROC_ORDER[i]]) return PROC_ORDER[i];
  }
  return PROC_ORDER[0];
}


// ──────────────────────────────────────────────
// 2-2. 캘린더 탭
// ──────────────────────────────────────────────
function renderCalendar() {
  const main = document.getElementById('main-content');
  if (!main) return;

  const now = window._calDate || new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayStr = fmt(today);

  // 해당 월에 이벤트가 있는 날짜 수집
  const eventMap = {};
  D.forEach(d => {
    if (d.processes) {
      Object.entries(d.processes).forEach(([proc, info]) => {
        const dateKey = info.date || info.startDate;
        if (dateKey) {
          const dt = new Date(dateKey);
          if (dt.getFullYear() === year && dt.getMonth() === month) {
            const dayNum = dt.getDate();
            if (!eventMap[dayNum]) eventMap[dayNum] = [];
            eventMap[dayNum].push({ sn: d.sn, proc, product: d.product });
          }
        }
      });
    }
    // 납기일
    if (d.dueDate) {
      const dt = new Date(d.dueDate);
      if (dt.getFullYear() === year && dt.getMonth() === month) {
        const dayNum = dt.getDate();
        if (!eventMap[dayNum]) eventMap[dayNum] = [];
        eventMap[dayNum].push({ sn: d.sn, proc: '납기', product: d.product, isDue: true });
      }
    }
  });

  let calendarCells = '';
  // 빈 셀
  for (let i = 0; i < firstDay; i++) calendarCells += '<div class="cal-cell cal-empty"></div>';
  // 날짜 셀
  for (let day = 1; day <= lastDate; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isToday = dateStr === todayStr;
    const events = eventMap[day] || [];
    const dots = events.slice(0, 3).map(e =>
      `<div style="font-size:9px;padding:1px 4px;border-radius:3px;background:${e.isDue ? '#ef4444' : PROC_COLORS[e.proc] || 'var(--accent)'};color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${e.sn?.slice(-4) || ''} ${e.proc}</div>`
    ).join('');
    const moreTag = events.length > 3 ? `<div style="font-size:9px;color:var(--text-secondary);">+${events.length - 3}건</div>` : '';

    calendarCells += `
      <div class="cal-cell ${isToday ? 'cal-today' : ''}" onclick="showDayDetail('${dateStr}')" style="cursor:pointer;min-height:80px;padding:4px;border:1px solid var(--border);border-radius:6px;${isToday ? 'background:rgba(99,102,241,0.1);border-color:var(--accent);' : ''}">
        <div style="font-weight:${isToday ? '700' : '400'};font-size:13px;margin-bottom:2px;${isToday ? 'color:var(--accent);' : ''}">${day}</div>
        ${dots}${moreTag}
      </div>`;
  }

  main.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
      <button class="btn btn-small" onclick="changeMonth(-1)">◀ 이전</button>
      <h2 style="margin:0;">${year}년 ${month + 1}월</h2>
      <button class="btn btn-small" onclick="changeMonth(1)">다음 ▶</button>
    </div>
    <div class="card" style="padding:16px;">
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;margin-bottom:8px;">
        ${['일','월','화','수','목','금','토'].map((d, i) =>
          `<div style="font-weight:600;font-size:13px;padding:8px;color:${i === 0 ? '#ef4444' : i === 6 ? '#6366f1' : 'var(--text-secondary)'}">${d}</div>`
        ).join('')}
      </div>
      <div class="calendar-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;">
        ${calendarCells}
      </div>
    </div>
  `;
}

window.changeMonth = function(delta) {
  const cur = window._calDate || new Date();
  window._calDate = new Date(cur.getFullYear(), cur.getMonth() + delta, 1);
  renderCalendar();
};

window.showDayDetail = function(dateStr) {
  const events = [];
  D.forEach(d => {
    if (d.processes) {
      Object.entries(d.processes).forEach(([proc, info]) => {
        const dk = info.date || info.startDate;
        if (dk && dk.startsWith(dateStr)) events.push({ sn: d.sn, proc, product: d.product, id: d.id });
      });
    }
    if (d.dueDate && d.dueDate.startsWith(dateStr)) events.push({ sn: d.sn, proc: '납기일', product: d.product, id: d.id, isDue: true });
  });

  if (events.length === 0) { toast(`${dateStr} — 등록된 일정이 없습니다`); return; }

  const list = events.map(e =>
    `<div style="padding:8px 12px;border-left:3px solid ${e.isDue ? '#ef4444' : PROC_COLORS[e.proc] || 'var(--accent)'};background:var(--glass-bg);border-radius:0 8px 8px 0;margin-bottom:6px;cursor:pointer;" onclick="openLotDetail('${e.id}')">
      <strong>${e.sn}</strong> — ${e.proc} <span style="color:var(--text-secondary);font-size:12px;">(${e.product})</span>
    </div>`
  ).join('');

  openModal('dayDetailModal', `
    <div class="modal-header"><span>${dateStr} 일정 (${events.length}건)</span><button class="modal-close" onclick="closeModal('dayDetailModal')">✕</button></div>
    <div class="modal-body">${list}</div>
  `);
};


// ──────────────────────────────────────────────
// 2-3. 간트차트 탭
// ──────────────────────────────────────────────
function renderGantt() {
  const main = document.getElementById('main-content');
  if (!main) return;

  const activeLots = D.filter(d => d.status !== '완료' && d.status !== '출하완료');
  if (activeLots.length === 0) {
    main.innerHTML = '<div class="card" style="padding:40px;text-align:center;color:var(--text-secondary);">진행중인 LOT이 없습니다</div>';
    return;
  }

  // 날짜 범위 계산
  let minDate = new Date(), maxDate = new Date();
  activeLots.forEach(d => {
    if (d.createdAt) { const dt = new Date(d.createdAt); if (dt < minDate) minDate = dt; }
    if (d.dueDate) { const dt = new Date(d.dueDate); if (dt > maxDate) maxDate = dt; }
    if (d.processes) {
      Object.values(d.processes).forEach(info => {
        const dk = info.date || info.startDate;
        if (dk) {
          const dt = new Date(dk);
          if (dt < minDate) minDate = dt;
          if (dt > maxDate) maxDate = dt;
        }
      });
    }
  });

  // 여유 추가
  minDate = new Date(minDate.getTime() - 3 * 86400000);
  maxDate = new Date(maxDate.getTime() + 7 * 86400000);
  const totalDays = Math.ceil((maxDate - minDate) / 86400000) || 30;

  const dayWidth = 28;
  const chartWidth = totalDays * dayWidth;

  // 헤더 (날짜)
  let headerHtml = '';
  for (let i = 0; i < totalDays; i++) {
    const dt = new Date(minDate.getTime() + i * 86400000);
    const isToday = fmt(dt) === fmt(new Date());
    const isSun = dt.getDay() === 0;
    const isSat = dt.getDay() === 6;
    headerHtml += `<div style="min-width:${dayWidth}px;text-align:center;font-size:9px;padding:2px 0;${isToday ? 'background:var(--accent);color:#fff;border-radius:4px;' : isSun ? 'color:#ef4444;' : isSat ? 'color:#6366f1;' : 'color:var(--text-secondary);'}">${dt.getDate()}</div>`;
  }

  // 행
  let rowsHtml = '';
  activeLots.forEach(d => {
    let bars = '';
    PROC_ORDER.forEach(proc => {
      if (d.processes && d.processes[proc]) {
        const info = d.processes[proc];
        const startStr = info.date || info.startDate;
        if (startStr) {
          const startDt = new Date(startStr);
          const offset = Math.floor((startDt - minDate) / 86400000);
          const duration = info.duration || 1;
          bars += `<div style="position:absolute;left:${offset * dayWidth}px;width:${duration * dayWidth - 2}px;height:18px;top:50%;transform:translateY(-50%);background:${PROC_COLORS[proc] || 'var(--accent)'};border-radius:4px;font-size:8px;color:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;white-space:nowrap;" title="${d.sn} - ${proc}">${proc.slice(0, 2)}</div>`;
        }
      }
    });

    // 납기 마커
    if (d.dueDate) {
      const dueDt = new Date(d.dueDate);
      const offset = Math.floor((dueDt - minDate) / 86400000);
      bars += `<div style="position:absolute;left:${offset * dayWidth}px;width:2px;height:100%;background:#ef4444;top:0;" title="납기: ${d.dueDate}"></div>`;
    }

    rowsHtml += `
      <div style="display:flex;border-bottom:1px solid var(--border);">
        <div style="min-width:150px;max-width:150px;padding:8px;font-size:11px;border-right:1px solid var(--border);display:flex;flex-direction:column;justify-content:center;">
          <strong>${d.sn || '-'}</strong>
          <span style="color:var(--text-secondary);font-size:10px;">${d.product || ''}</span>
        </div>
        <div style="position:relative;width:${chartWidth}px;height:36px;">
          ${bars}
        </div>
      </div>`;
  });

  // 오늘선
  const todayOffset = Math.floor((new Date() - minDate) / 86400000);

  main.innerHTML = `
    <h2 style="margin-bottom:16px;">간트차트</h2>
    <div class="card" style="overflow-x:auto;padding:0;">
      <div style="display:flex;border-bottom:2px solid var(--border);position:sticky;top:0;background:var(--bg);z-index:2;">
        <div style="min-width:150px;max-width:150px;padding:8px;font-size:11px;font-weight:600;border-right:1px solid var(--border);">LOT</div>
        <div style="display:flex;width:${chartWidth}px;position:relative;">
          ${headerHtml}
          <div style="position:absolute;left:${todayOffset * dayWidth}px;top:0;width:2px;height:9999px;background:var(--accent);opacity:0.5;z-index:1;pointer-events:none;"></div>
        </div>
      </div>
      ${rowsHtml}
    </div>
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
      ${PROC_ORDER.map(p => `<span style="display:flex;align-items:center;gap:4px;font-size:11px;"><span style="width:12px;height:12px;border-radius:3px;background:${PROC_COLORS[p]};"></span>${p}</span>`).join('')}
      <span style="display:flex;align-items:center;gap:4px;font-size:11px;"><span style="width:12px;height:2px;background:#ef4444;"></span>납기</span>
    </div>
  `;
}


// ──────────────────────────────────────────────
// 2-4. 탭 라우터 업데이트
// ──────────────────────────────────────────────
function switchTab(tabName) {
  window._currentTab = tabName;

  // 사이드바 활성화
  document.querySelectorAll('#sidebar .nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tabName);
  });

  switch (tabName) {
    case 'home': renderHome(); break;
    case 'workspace': renderWorkspace(); break;
    case 'calendar': renderCalendar(); break;
    case 'gantt': renderGantt(); break;
    case 'analysis': renderAnalysis(); break;
    case 'ai': renderAI(); break;
    case 'settings': renderSettings(); break;
    default: renderHome();
  }
}

// 전역 노출
window.switchTab = switchTab;
window.renderWorkspace = renderWorkspace;
window.renderCalendar = renderCalendar;
window.renderGantt = renderGantt;


// ═══════════════════════════════════════════════════════════
// PART 3 — 분석(Analysis) · AI 어시스턴트 · 설정(Settings)
// ═══════════════════════════════════════════════════════════

// ──────────────────────────────────────────────
// 3-1. 분석(Analysis) 탭
// ──────────────────────────────────────────────
function renderAnalysis() {
  const main = document.getElementById('main-content');
  if (!main) return;

  // ── 기본 통계 계산 ──
  const total = D.length;
  const active = D.filter(d => d.status !== '완료' && d.status !== '출하완료').length;
  const done = total - active;
  const issueCount = D.filter(d => d.issues && d.issues.length > 0).length;
  const doneRate = total > 0 ? Math.round((done / total) * 100) : 0;

  // ── 제품별 집계 ──
  const productMap = {};
  D.forEach(d => {
    const p = d.product || '미분류';
    if (!productMap[p]) productMap[p] = { total: 0, done: 0, issue: 0 };
    productMap[p].total++;
    if (d.status === '완료' || d.status === '출하완료') productMap[p].done++;
    if (d.issues && d.issues.length > 0) productMap[p].issue++;
  });

  // ── 공정별 현재 분포 ──
  const procDist = {};
  PROC_ORDER.forEach(p => procDist[p] = 0);
  D.filter(d => d.status !== '완료' && d.status !== '출하완료').forEach(d => {
    const cur = getCurrentProcess(d);
    if (cur && procDist[cur] !== undefined) procDist[cur]++;
  });

  // ── 월별 등록 추이 (최근 6개월) ──
  const monthlyData = {};
  for (let i = 5; i >= 0; i--) {
    const dt = new Date();
    dt.setMonth(dt.getMonth() - i);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[key] = { registered: 0, completed: 0 };
  }
  D.forEach(d => {
    if (d.createdAt) {
      const dt = new Date(d.createdAt);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[key]) monthlyData[key].registered++;
    }
    if (d.completedAt) {
      const dt = new Date(d.completedAt);
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyData[key]) monthlyData[key].completed++;
    }
  });

  // ── 고객별 집계 ──
  const custMap = {};
  D.forEach(d => {
    const c = d.customer || '미지정';
    if (!custMap[c]) custMap[c] = 0;
    custMap[c]++;
  });
  const topCustomers = Object.entries(custMap).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // ── 평균 리드타임 ──
  let leadTimes = [];
  D.forEach(d => {
    if (d.createdAt && d.completedAt) {
      const diff = (new Date(d.completedAt) - new Date(d.createdAt)) / 86400000;
      if (diff > 0 && diff < 365) leadTimes.push(diff);
    }
  });
  const avgLead = leadTimes.length > 0 ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length) : 0;
  const minLead = leadTimes.length > 0 ? Math.round(Math.min(...leadTimes)) : 0;
  const maxLead = leadTimes.length > 0 ? Math.round(Math.max(...leadTimes)) : 0;

  // ── 이슈 유형 집계 ──
  const issueTypeMap = {};
  D.forEach(d => {
    if (d.issues) {
      d.issues.forEach(issue => {
        const type = issue.type || issue.category || '기타';
        if (!issueTypeMap[type]) issueTypeMap[type] = 0;
        issueTypeMap[type]++;
      });
    }
  });
  const issueTypes = Object.entries(issueTypeMap).sort((a, b) => b[1] - a[1]);

  // ── 납기 준수율 ──
  let onTime = 0, late = 0;
  D.forEach(d => {
    if ((d.status === '완료' || d.status === '출하완료') && d.dueDate && d.completedAt) {
      if (new Date(d.completedAt) <= new Date(d.dueDate)) onTime++;
      else late++;
    }
  });
  const deliveryRate = (onTime + late) > 0 ? Math.round((onTime / (onTime + late)) * 100) : 0;

  main.innerHTML = `
    <h2 style="margin-bottom:20px;">생산 분석 대시보드</h2>

    <!-- KPI 요약 -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px;">
      <div class="card" style="padding:20px;text-align:center;">
        <div style="font-size:28px;font-weight:700;color:var(--accent);">${total}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">전체 LOT</div>
      </div>
      <div class="card" style="padding:20px;text-align:center;">
        <div style="font-size:28px;font-weight:700;color:#4ade80;">${doneRate}%</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">완료율</div>
      </div>
      <div class="card" style="padding:20px;text-align:center;">
        <div style="font-size:28px;font-weight:700;color:#f59e0b;">${avgLead}일</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">평균 리드타임</div>
      </div>
      <div class="card" style="padding:20px;text-align:center;">
        <div style="font-size:28px;font-weight:700;color:${deliveryRate >= 80 ? '#4ade80' : '#ef4444'};">${deliveryRate}%</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">납기 준수율</div>
      </div>
      <div class="card" style="padding:20px;text-align:center;">
        <div style="font-size:28px;font-weight:700;color:#ef4444;">${issueCount}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">이슈 LOT</div>
      </div>
    </div>

    <!-- 차트 영역 -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">

      <!-- 공정별 분포 -->
      <div class="card" style="padding:20px;">
        <h3 style="margin:0 0 16px 0;font-size:15px;">공정별 현황 (진행중)</h3>
        ${PROC_ORDER.map(proc => {
          const cnt = procDist[proc] || 0;
          const pct = active > 0 ? Math.round((cnt / active) * 100) : 0;
          return `<div style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
              <span style="display:flex;align-items:center;gap:6px;">
                <span style="width:10px;height:10px;border-radius:2px;background:${PROC_COLORS[proc]};"></span>${proc}
              </span>
              <span>${cnt}건 (${pct}%)</span>
            </div>
            <div class="progress-bar" style="height:8px;">
              <div class="progress-fill" style="width:${pct}%;background:${PROC_COLORS[proc]};"></div>
            </div>
          </div>`;
        }).join('')}
      </div>

      <!-- 월별 추이 -->
      <div class="card" style="padding:20px;">
        <h3 style="margin:0 0 16px 0;font-size:15px;">월별 등록/완료 추이</h3>
        <canvas id="monthlyChart" height="200"></canvas>
      </div>

      <!-- 제품별 현황 -->
      <div class="card" style="padding:20px;">
        <h3 style="margin:0 0 16px 0;font-size:15px;">제품별 현황</h3>
        <table style="width:100%;">
          <thead><tr><th style="text-align:left;font-size:12px;">제품</th><th>전체</th><th>완료</th><th>이슈</th><th>완료율</th></tr></thead>
          <tbody>
            ${Object.entries(productMap).sort((a, b) => b[1].total - a[1].total).map(([name, v]) => {
              const r = v.total > 0 ? Math.round((v.done / v.total) * 100) : 0;
              return `<tr>
                <td style="font-size:13px;">${name}</td>
                <td style="text-align:center;">${v.total}</td>
                <td style="text-align:center;color:#4ade80;">${v.done}</td>
                <td style="text-align:center;color:#ef4444;">${v.issue}</td>
                <td style="text-align:center;">
                  <div class="progress-bar" style="height:6px;display:inline-block;width:60px;vertical-align:middle;">
                    <div class="progress-fill" style="width:${r}%;"></div>
                  </div> ${r}%
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- 고객별 현황 -->
      <div class="card" style="padding:20px;">
        <h3 style="margin:0 0 16px 0;font-size:15px;">고객별 LOT 수</h3>
        ${topCustomers.map(([name, cnt]) => {
          const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
          return `<div style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
              <span>${name}</span><span>${cnt}건 (${pct}%)</span>
            </div>
            <div class="progress-bar" style="height:6px;">
              <div class="progress-fill" style="width:${pct}%;background:var(--accent);"></div>
            </div>
          </div>`;
        }).join('')}
      </div>

      <!-- 리드타임 분포 -->
      <div class="card" style="padding:20px;">
        <h3 style="margin:0 0 16px 0;font-size:15px;">리드타임 분석</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;text-align:center;">
          <div>
            <div style="font-size:24px;font-weight:700;color:#4ade80;">${minLead}일</div>
            <div style="font-size:11px;color:var(--text-secondary);">최소</div>
          </div>
          <div>
            <div style="font-size:24px;font-weight:700;color:var(--accent);">${avgLead}일</div>
            <div style="font-size:11px;color:var(--text-secondary);">평균</div>
          </div>
          <div>
            <div style="font-size:24px;font-weight:700;color:#ef4444;">${maxLead}일</div>
            <div style="font-size:11px;color:var(--text-secondary);">최대</div>
          </div>
        </div>
        ${leadTimes.length > 0 ? `
        <div style="margin-top:16px;">
          <canvas id="leadTimeChart" height="120"></canvas>
        </div>` : '<p style="text-align:center;color:var(--text-secondary);margin-top:16px;">완료된 LOT 데이터 부족</p>'}
      </div>

      <!-- 이슈 유형 -->
      <div class="card" style="padding:20px;">
        <h3 style="margin:0 0 16px 0;font-size:15px;">이슈 유형 분포</h3>
        ${issueTypes.length === 0 ? '<p style="text-align:center;color:var(--text-secondary);">등록된 이슈 없음</p>' :
          issueTypes.map(([type, cnt]) => {
            const totalIssues = issueTypes.reduce((a, b) => a + b[1], 0);
            const pct = Math.round((cnt / totalIssues) * 100);
            return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <span style="min-width:80px;font-size:12px;">${type}</span>
              <div class="progress-bar" style="flex:1;height:8px;">
                <div class="progress-fill" style="width:${pct}%;background:#ef4444;"></div>
              </div>
              <span style="font-size:12px;min-width:50px;text-align:right;">${cnt}건</span>
            </div>`;
          }).join('')}
      </div>
    </div>
  `;

  // 월별 차트 그리기
  drawMonthlyChart(monthlyData);
  if (leadTimes.length > 0) drawLeadTimeChart(leadTimes);
}

function drawMonthlyChart(data) {
  const canvas = document.getElementById('monthlyChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * 2;
  canvas.height = rect.height * 2;
  ctx.scale(2, 2);
  const W = rect.width, H = rect.height;
  const entries = Object.entries(data);
  const maxVal = Math.max(...entries.map(([, v]) => Math.max(v.registered, v.completed)), 1);
  const barW = W / entries.length;
  const padding = { top: 10, bottom: 30, left: 10, right: 10 };
  const chartH = H - padding.top - padding.bottom;

  entries.forEach(([month, v], i) => {
    const x = padding.left + i * barW;
    const halfBar = (barW - 12) / 2;

    // 등록 바
    const regH = (v.registered / maxVal) * chartH;
    ctx.fillStyle = 'rgba(99,102,241,0.7)';
    ctx.beginPath();
    ctx.roundRect(x + 2, padding.top + chartH - regH, halfBar, regH, [3, 3, 0, 0]);
    ctx.fill();

    // 완료 바
    const compH = (v.completed / maxVal) * chartH;
    ctx.fillStyle = 'rgba(74,222,128,0.7)';
    ctx.beginPath();
    ctx.roundRect(x + 2 + halfBar + 2, padding.top + chartH - compH, halfBar, compH, [3, 3, 0, 0]);
    ctx.fill();

    // 라벨
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#888';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(month.slice(5) + '월', x + barW / 2, H - 8);
  });

  // 범례
  ctx.fillStyle = 'rgba(99,102,241,0.7)';
  ctx.fillRect(W - 100, 4, 10, 10);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#fff';
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('등록', W - 86, 13);
  ctx.fillStyle = 'rgba(74,222,128,0.7)';
  ctx.fillRect(W - 52, 4, 10, 10);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#fff';
  ctx.fillText('완료', W - 38, 13);
}

function drawLeadTimeChart(leadTimes) {
  const canvas = document.getElementById('leadTimeChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * 2;
  canvas.height = rect.height * 2;
  ctx.scale(2, 2);
  const W = rect.width, H = rect.height;

  // 히스토그램 구간 (5일 단위)
  const maxLT = Math.max(...leadTimes);
  const bucketSize = 5;
  const bucketCount = Math.ceil(maxLT / bucketSize) + 1;
  const buckets = new Array(bucketCount).fill(0);
  leadTimes.forEach(lt => {
    const idx = Math.floor(lt / bucketSize);
    if (idx < bucketCount) buckets[idx]++;
  });
  const maxBucket = Math.max(...buckets, 1);
  const barW = (W - 20) / bucketCount;
  const chartH = H - 25;

  buckets.forEach((cnt, i) => {
    const x = 10 + i * barW;
    const h = (cnt / maxBucket) * chartH;
    ctx.fillStyle = 'rgba(99,102,241,0.6)';
    ctx.beginPath();
    ctx.roundRect(x + 1, chartH - h, barW - 2, h, [3, 3, 0, 0]);
    ctx.fill();

    if (cnt > 0) {
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#fff';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(cnt, x + barW / 2, chartH - h - 3);
    }

    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#888';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${i * bucketSize}`, x + barW / 2, H - 4);
  });
}


// ──────────────────────────────────────────────
// 3-2. AI 어시스턴트 탭
// ──────────────────────────────────────────────
function renderAI() {
  const main = document.getElementById('main-content');
  if (!main) return;

  if (!window._aiMessages) {
    window._aiMessages = [
      { role: 'ai', text: '안녕하세요! ESC 생산관리 AI 어시스턴트입니다. 무엇이든 물어보세요.\n\n예시 질문:\n• "현재 지연되고 있는 LOT은?"\n• "이번 달 납기 현황 알려줘"\n• "제품별 생산 현황 요약해줘"\n• "최근 이슈 분석해줘"' }
    ];
  }

  main.innerHTML = `
    <div style="display:flex;flex-direction:column;height:calc(100vh - 120px);">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <h2 style="margin:0;flex:1;">AI 어시스턴트</h2>
        <button class="btn btn-small" onclick="clearAIChat()" style="font-size:12px;">대화 초기화</button>
      </div>

      <div id="ai-chat-area" style="flex:1;overflow-y:auto;padding:16px;background:var(--glass-bg);border-radius:12px;border:1px solid var(--border);margin-bottom:12px;">
        ${window._aiMessages.map(m => renderAIChatBubble(m)).join('')}
      </div>

      <div style="display:flex;gap:8px;">
        <input type="text" id="ai-input" placeholder="질문을 입력하세요..." 
          style="flex:1;padding:12px 16px;border-radius:12px;border:1px solid var(--border);background:var(--glass-bg);color:var(--text);font-size:14px;"
          onkeydown="if(event.key==='Enter')sendAIMessage()">
        <button class="btn btn-primary" onclick="sendAIMessage()" style="padding:12px 24px;">전송</button>
      </div>

      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">
        ${['지연 LOT 현황', '이번달 납기', '제품별 요약', '이슈 분석', '공정 병목'].map(q =>
          `<button class="btn btn-small" onclick="quickAIQuestion('${q}')" style="font-size:11px;padding:4px 10px;border-radius:16px;">${q}</button>`
        ).join('')}
      </div>
    </div>
  `;

  // 스크롤 하단
  const chatArea = document.getElementById('ai-chat-area');
  if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
}

function renderAIChatBubble(msg) {
  const isAI = msg.role === 'ai';
  return `<div style="display:flex;justify-content:${isAI ? 'flex-start' : 'flex-end'};margin-bottom:12px;">
    <div style="max-width:80%;padding:12px 16px;border-radius:${isAI ? '4px 16px 16px 16px' : '16px 4px 16px 16px'};background:${isAI ? 'var(--glass-bg)' : 'var(--accent)'};border:${isAI ? '1px solid var(--border)' : 'none'};color:${isAI ? 'var(--text)' : '#fff'};font-size:13px;line-height:1.6;white-space:pre-wrap;">
      ${isAI ? '<div style="font-size:10px;color:var(--text-secondary);margin-bottom:4px;">🤖 AI</div>' : ''}
      ${msg.text}
    </div>
  </div>`;
}

window.sendAIMessage = function() {
  const input = document.getElementById('ai-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  window._aiMessages.push({ role: 'user', text });
  input.value = '';

  // AI 응답 생성 (로컬 분석)
  const response = generateAIResponse(text);
  window._aiMessages.push({ role: 'ai', text: response });
  renderAI();
};

window.quickAIQuestion = function(q) {
  window._aiMessages.push({ role: 'user', text: q });
  const response = generateAIResponse(q);
  window._aiMessages.push({ role: 'ai', text: response });
  renderAI();
};

window.clearAIChat = function() {
  window._aiMessages = null;
  renderAI();
};

function generateAIResponse(question) {
  const q = question.toLowerCase();
  const today = new Date();
  const active = D.filter(d => d.status !== '완료' && d.status !== '출하완료');

  // 지연 LOT
  if (q.includes('지연') || q.includes('delay') || q.includes('늦')) {
    const delayed = active.filter(d => {
      if (!d.dueDate) return false;
      return new Date(d.dueDate) < today;
    });
    if (delayed.length === 0) return '현재 납기가 지연된 LOT은 없습니다. 👍';
    let msg = `⚠️ 납기 지연 LOT: ${delayed.length}건\n\n`;
    delayed.forEach(d => {
      const diff = Math.ceil((today - new Date(d.dueDate)) / 86400000);
      msg += `• ${d.sn} (${d.product}) — ${diff}일 지연 / 납기: ${d.dueDate}\n`;
    });
    return msg;
  }

  // 납기 현황
  if (q.includes('납기') || q.includes('이번달') || q.includes('이번 달') || q.includes('due')) {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const thisMonth = active.filter(d => {
      if (!d.dueDate) return false;
      const dt = new Date(d.dueDate);
      return dt >= monthStart && dt <= monthEnd;
    });
    if (thisMonth.length === 0) return '이번 달 납기 예정인 LOT이 없습니다.';
    let msg = `📅 이번 달 납기 예정: ${thisMonth.length}건\n\n`;
    thisMonth.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).forEach(d => {
      const days = Math.ceil((new Date(d.dueDate) - today) / 86400000);
      const status = days < 0 ? `🔴 ${Math.abs(days)}일 지연` : days <= 3 ? `🟡 ${days}일 남음` : `🟢 ${days}일 남음`;
      msg += `• ${d.sn} (${d.product}) — ${d.dueDate} ${status}\n`;
    });
    return msg;
  }

  // 제품별 요약
  if (q.includes('제품') || q.includes('product') || q.includes('요약')) {
    const pMap = {};
    D.forEach(d => {
      const p = d.product || '미분류';
      if (!pMap[p]) pMap[p] = { total: 0, active: 0, done: 0 };
      pMap[p].total++;
      if (d.status === '완료' || d.status === '출하완료') pMap[p].done++;
      else pMap[p].active++;
    });
    let msg = `📊 제품별 생산 현황\n\n`;
    Object.entries(pMap).sort((a, b) => b[1].total - a[1].total).forEach(([name, v]) => {
      msg += `📦 ${name}: 전체 ${v.total} / 진행 ${v.active} / 완료 ${v.done}\n`;
    });
    return msg;
  }

  // 이슈 분석
  if (q.includes('이슈') || q.includes('issue') || q.includes('문제')) {
    const issueLots = D.filter(d => d.issues && d.issues.length > 0);
    if (issueLots.length === 0) return '등록된 이슈가 없습니다. ✅';
    const typeMap = {};
    let totalIssues = 0;
    issueLots.forEach(d => {
      d.issues.forEach(iss => {
        const type = iss.type || iss.category || '기타';
        if (!typeMap[type]) typeMap[type] = 0;
        typeMap[type]++;
        totalIssues++;
      });
    });
    let msg = `🔍 이슈 분석 — ${issueLots.length}개 LOT, 총 ${totalIssues}건\n\n유형별:\n`;
    Object.entries(typeMap).sort((a, b) => b[1] - a[1]).forEach(([type, cnt]) => {
      msg += `• ${type}: ${cnt}건\n`;
    });
    msg += `\n최근 이슈 LOT:\n`;
    issueLots.slice(0, 5).forEach(d => {
      msg += `• ${d.sn} (${d.product}) — ${d.issues.length}건\n`;
    });
    return msg;
  }

  // 공정 병목
  if (q.includes('병목') || q.includes('bottleneck') || q.includes('공정')) {
    const procCount = {};
    PROC_ORDER.forEach(p => procCount[p] = 0);
    active.forEach(d => {
      const cur = getCurrentProcess(d);
      if (cur) procCount[cur]++;
    });
    const sorted = Object.entries(procCount).sort((a, b) => b[1] - a[1]);
    let msg = `🏭 공정별 현재 LOT 분포 (진행중: ${active.length}건)\n\n`;
    sorted.forEach(([proc, cnt]) => {
      const bar = '█'.repeat(Math.min(cnt, 20));
      msg += `${proc}: ${bar} ${cnt}건\n`;
    });
    if (sorted[0] && sorted[0][1] > 0) {
      msg += `\n⚠️ "${sorted[0][0]}" 공정에 LOT이 가장 많이 집중되어 있습니다. 병목 가능성을 확인해보세요.`;
    }
    return msg;
  }

  // 기본 응답
  return `"${question}"에 대한 분석 기능은 아직 개발 중입니다.\n\n현재 가능한 질문:\n• 지연 LOT 현황\n• 이번달 납기\n• 제품별 요약\n• 이슈 분석\n• 공정 병목\n\n위 키워드를 포함해서 다시 질문해 주세요!`;
}


// ──────────────────────────────────────────────
// 3-3. 설정(Settings) 탭
// ──────────────────────────────────────────────
function renderSettings() {
  const main = document.getElementById('main-content');
  if (!main) return;

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const userInfo = currentUser || {};

  main.innerHTML = `
    <h2 style="margin-bottom:20px;">설정</h2>

    <!-- 프로필 -->
    <div class="card settings-section" style="padding:24px;margin-bottom:16px;">
      <h3 style="margin:0 0 16px 0;font-size:16px;">👤 프로필</h3>
      <div style="display:flex;align-items:center;gap:16px;">
        <div style="width:60px;height:60px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;">
          ${(userInfo.displayName || 'U')[0].toUpperCase()}
        </div>
        <div>
          <div style="font-size:16px;font-weight:600;">${userInfo.displayName || '사용자'}</div>
          <div style="font-size:13px;color:var(--text-secondary);">${userInfo.email || '-'}</div>
        </div>
      </div>
    </div>

    <!-- 테마 -->
    <div class="card settings-section" style="padding:24px;margin-bottom:16px;">
      <h3 style="margin:0 0 16px 0;font-size:16px;">🎨 테마</h3>
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span>다크 모드</span>
        <label class="toggle">
          <input type="checkbox" id="theme-toggle" ${isDark ? 'checked' : ''} onchange="toggleTheme()">
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <!-- 알림 설정 -->
    <div class="card settings-section" style="padding:24px;margin-bottom:16px;">
      <h3 style="margin:0 0 16px 0;font-size:16px;">🔔 알림</h3>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span>납기 D-3 알림</span>
          <label class="toggle">
            <input type="checkbox" checked id="notify-due">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span>이슈 발생 알림</span>
          <label class="toggle">
            <input type="checkbox" checked id="notify-issue">
            <span class="toggle-slider"></span>
          </label>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span>공정 완료 알림</span>
          <label class="toggle">
            <input type="checkbox" id="notify-proc">
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>

    <!-- 데이터 관리 -->
    <div class="card settings-section" style="padding:24px;margin-bottom:16px;">
      <h3 style="margin:0 0 16px 0;font-size:16px;">💾 데이터 관리</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="exportAllExcel()">📥 Excel 전체 내보내기</button>
        <button class="btn btn-secondary" onclick="exportBackupJSON()">📋 JSON 백업</button>
        <button class="btn btn-secondary" onclick="document.getElementById('importFile').click()">📤 데이터 가져오기</button>
        <input type="file" id="importFile" accept=".json,.xlsx,.xls" style="display:none;" onchange="importData(event)">
      </div>
    </div>

    <!-- 제품/공정 관리 -->
    <div class="card settings-section" style="padding:24px;margin-bottom:16px;">
      <h3 style="margin:0 0 16px 0;font-size:16px;">⚙️ 제품 및 공정 관리</h3>
      <div style="margin-bottom:12px;">
        <h4 style="margin:0 0 8px 0;font-size:14px;">등록된 제품</h4>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${[...new Set(D.map(d => d.product).filter(Boolean))].sort().map(p =>
            `<span class="chip">${p}</span>`
          ).join('') || '<span style="color:var(--text-secondary);">등록된 제품이 없습니다</span>'}
        </div>
      </div>
      <div>
        <h4 style="margin:0 0 8px 0;font-size:14px;">공정 순서</h4>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${PROC_ORDER.map(p =>
            `<span style="padding:4px 10px;border-radius:6px;font-size:12px;background:${PROC_COLORS[p]};color:#fff;">${p}</span>`
          ).join(' → ')}
        </div>
      </div>
    </div>

    <!-- 앱 정보 -->
    <div class="card settings-section" style="padding:24px;margin-bottom:16px;">
      <h3 style="margin:0 0 16px 0;font-size:16px;">ℹ️ 앱 정보</h3>
      <div style="font-size:13px;color:var(--text-secondary);line-height:1.8;">
        ESC Production Manager v9.0 (Vite)<br>
        제작: Kane<br>
        Firebase Project: esc-production-management<br>
        빌드: Vite + Vanilla JS<br>
        Last Deploy: ${new Date().toLocaleDateString('ko-KR')}
      </div>
    </div>

    <!-- 로그아웃 -->
    <div style="text-align:center;margin-top:24px;">
      <button class="btn btn-danger" onclick="signOutUser()" style="padding:12px 40px;">로그아웃</button>
    </div>
  `;
}

window.toggleTheme = function() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  if (current === 'light') {
    html.removeAttribute('data-theme');
    localStorage.setItem('esc-theme', 'dark');
  } else {
    html.setAttribute('data-theme', 'light');
    localStorage.setItem('esc-theme', 'light');
  }
};

window.exportBackupJSON = function() {
  const blob = new Blob([JSON.stringify(D, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `esc-backup-${fmt(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('JSON 백업 파일 다운로드 완료');
};

window.importData = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.name.endsWith('.json')) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const imported = JSON.parse(e.target.result);
        if (Array.isArray(imported)) {
          toast(`${imported.length}건 데이터 확인 — Firestore 업로드 기능은 추후 구현`);
        }
      } catch (err) {
        toast('JSON 파싱 오류: ' + err.message);
      }
    };
    reader.readAsText(file);
  } else {
    toast('현재 JSON 파일만 지원합니다');
  }
  event.target.value = '';
};

// 전역 노출
window.renderAnalysis = renderAnalysis;
window.renderAI = renderAI;
window.renderSettings = renderSettings;


// ═══════════════════════════════════════════════════════════
// PART 4 (최종) — 모달 · Excel · QR · 사이드패널 · 모바일 · 초기화
// ═══════════════════════════════════════════════════════════


// ──────────────────────────────────────────────
// 4-2. 새 LOT 등록 모달
// ──────────────────────────────────────────────
window.openNewLotModal = function() {
  const products = [...new Set(D.map(d => d.product).filter(Boolean))].sort();
  const customers = [...new Set(D.map(d => d.customer).filter(Boolean))].sort();

  // S/N 자동 생성 (ESC-YYMM-NNN)
  const now = new Date();
  const prefix = `ESC-${String(now.getFullYear()).slice(2)}${String(now.getMonth()+1).padStart(2,'0')}`;
  const existing = D.filter(d => (d.sn || '').startsWith(prefix)).length;
  const suggestedSN = `${prefix}-${String(existing + 1).padStart(3, '0')}`;

  openModal('newLotModal', `
    <div class="modal-header">
      <span>새 LOT 등록</span>
      <button class="modal-close" onclick="closeModal('newLotModal')">✕</button>
    </div>
    <div class="modal-body" style="max-height:70vh;overflow-y:auto;">
      <div style="display:grid;gap:16px;">

        <div>
          <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">S/N (시리얼번호)</label>
          <input type="text" id="nl-sn" value="${suggestedSN}" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--glass-bg);color:var(--text);font-size:14px;">
        </div>

        <div>
          <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">제품</label>
          <input type="text" id="nl-product" list="nl-product-list" placeholder="제품명 입력 또는 선택" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--glass-bg);color:var(--text);font-size:14px;">
          <datalist id="nl-product-list">${products.map(p => `<option value="${p}">`).join('')}</datalist>
        </div>

        <div>
          <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">고객</label>
          <input type="text" id="nl-customer" list="nl-customer-list" placeholder="고객명" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--glass-bg);color:var(--text);font-size:14px;">
          <datalist id="nl-customer-list">${customers.map(c => `<option value="${c}">`).join('')}</datalist>
        </div>

        <div>
          <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">수량</label>
          <input type="number" id="nl-qty" value="1" min="1" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--glass-bg);color:var(--text);font-size:14px;">
        </div>

        <div>
          <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">납기일</label>
          <input type="date" id="nl-due" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--glass-bg);color:var(--text);font-size:14px;">
        </div>

        <div>
          <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">비고</label>
          <textarea id="nl-note" rows="3" placeholder="메모, 특이사항..." style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--glass-bg);color:var(--text);font-size:14px;resize:vertical;"></textarea>
        </div>

        <!-- 소급 입력: 이미 진행된 공정 -->
        <div>
          <label style="font-size:13px;font-weight:600;display:block;margin-bottom:8px;">📌 이미 진행된 공정 (소급 입력)</label>
          <div id="nl-retro-procs" style="display:grid;gap:8px;">
            ${PROC_ORDER.map(proc => `
              <div style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--glass-bg);">
                <input type="checkbox" id="nl-retro-${proc}" style="width:18px;height:18px;">
                <span style="min-width:80px;font-size:13px;color:${PROC_COLORS[proc]};">${proc}</span>
                <input type="date" id="nl-retro-date-${proc}" style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:12px;" disabled>
                <input type="text" id="nl-retro-note-${proc}" placeholder="메모" style="flex:1;padding:6px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:12px;" disabled>
              </div>
            `).join('')}
          </div>
        </div>

      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;padding:16px 24px;border-top:1px solid var(--border);">
      <button class="btn btn-secondary" onclick="closeModal('newLotModal')">취소</button>
      <button class="btn btn-primary" onclick="submitNewLot()">등록</button>
    </div>
  `);

  // 소급 체크박스 토글 시 날짜/메모 활성화
  PROC_ORDER.forEach(proc => {
    const cb = document.getElementById(`nl-retro-${proc}`);
    if (cb) {
      cb.addEventListener('change', () => {
        const dateInput = document.getElementById(`nl-retro-date-${proc}`);
        const noteInput = document.getElementById(`nl-retro-note-${proc}`);
        if (dateInput) dateInput.disabled = !cb.checked;
        if (noteInput) noteInput.disabled = !cb.checked;
        if (cb.checked && dateInput && !dateInput.value) dateInput.value = fmt(new Date());
      });
    }
  });
};

window.submitNewLot = async function() {
  const sn = document.getElementById('nl-sn')?.value.trim();
  const product = document.getElementById('nl-product')?.value.trim();
  const customer = document.getElementById('nl-customer')?.value.trim();
  const qty = parseInt(document.getElementById('nl-qty')?.value) || 1;
  const dueDate = document.getElementById('nl-due')?.value || '';
  const note = document.getElementById('nl-note')?.value.trim() || '';

  if (!sn) { toast('S/N을 입력하세요'); return; }
  if (!product) { toast('제품을 입력하세요'); return; }

  // 중복 체크
  if (D.find(d => d.sn === sn)) { toast('이미 존재하는 S/N입니다'); return; }

  // 소급 공정 수집
  const processes = {};
  PROC_ORDER.forEach(proc => {
    const cb = document.getElementById(`nl-retro-${proc}`);
    if (cb && cb.checked) {
      const date = document.getElementById(`nl-retro-date-${proc}`)?.value || fmt(new Date());
      const pNote = document.getElementById(`nl-retro-note-${proc}`)?.value || '';
      processes[proc] = {
        date,
        status: '완료',
        note: pNote,
        operator: currentUser?.displayName || '',
        timestamp: Date.now()
      };
    }
  });

  const newLot = {
    sn,
    product,
    customer,
    qty,
    dueDate,
    note,
    processes,
    issues: [],
    status: '진행중',
    createdAt: Date.now(),
    createdBy: currentUser?.email || '',
    updatedAt: Date.now()
  };

  try {
    const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    const docRef = await addDoc(collection(db, 'lots'), newLot);
    newLot.id = docRef.id;
    D.push(newLot);
    closeModal('newLotModal');
    toast(`${sn} 등록 완료!`);
    if (window._currentTab === 'workspace') renderWorkspace();
    else if (window._currentTab === 'home') renderHome();
  } catch (err) {
    console.error('LOT 등록 실패:', err);
    toast('등록 실패: ' + err.message);
  }
};


// ──────────────────────────────────────────────
// 4-3. 공정 입력 모달 (상태 변경)
// ──────────────────────────────────────────────
window.openStatusEdit = function(lotId) {
  const lot = D.find(d => d.id === lotId);
  if (!lot) { toast('LOT을 찾을 수 없습니다'); return; }

  const currentProc = getCurrentProcess(lot);
  const currentIdx = PROC_ORDER.indexOf(currentProc);

  openModal('statusEditModal', `
    <div class="modal-header">
      <span>공정 입력 — ${lot.sn}</span>
      <button class="modal-close" onclick="closeModal('statusEditModal')">✕</button>
    </div>
    <div class="modal-body" style="max-height:70vh;overflow-y:auto;">
      <div style="margin-bottom:16px;padding:12px;background:var(--glass-bg);border-radius:8px;">
        <div style="font-size:14px;"><strong>${lot.product}</strong> / ${lot.customer || '-'}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">현재: ${currentProc} (${calcProgress(lot)}%)</div>
      </div>

      <div style="display:grid;gap:8px;">
        ${PROC_ORDER.map((proc, idx) => {
          const isDone = lot.processes && lot.processes[proc];
          const isCurrent = proc === currentProc;
          const isNext = idx === currentIdx + 1;
          const info = isDone ? lot.processes[proc] : null;

          return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;border:1px solid ${isDone ? PROC_COLORS[proc] : 'var(--border)'};background:${isDone ? PROC_COLORS[proc] + '15' : 'var(--glass-bg)'};">
            <div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;background:${isDone ? PROC_COLORS[proc] : 'var(--border)'};color:${isDone ? '#fff' : 'var(--text-secondary)'};">
              ${isDone ? '✓' : idx + 1}
            </div>
            <div style="flex:1;">
              <div style="font-size:13px;font-weight:${isCurrent ? '700' : '400'};color:${isDone ? PROC_COLORS[proc] : 'var(--text)'};">${proc}</div>
              ${isDone ? `<div style="font-size:11px;color:var(--text-secondary);">${info.date || ''} ${info.operator ? '(' + info.operator + ')' : ''}</div>` : ''}
            </div>
            ${!isDone ? `
              <button class="btn btn-small" style="font-size:11px;${isNext || (!isDone && idx <= currentIdx + 1) ? '' : 'opacity:0.4;'}" 
                onclick="completeProcess('${lotId}','${proc}')">완료</button>
            ` : ''}
          </div>`;
        }).join('')}
      </div>

      <!-- 이슈 등록 버튼 -->
      <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
        <button class="btn btn-danger" onclick="closeModal('statusEditModal');openIssueModal('${lotId}')" style="width:100%;">⚠️ 이슈 등록</button>
      </div>
    </div>
  `);
};

window.completeProcess = async function(lotId, proc) {
  const lot = D.find(d => d.id === lotId);
  if (!lot) return;

  if (!lot.processes) lot.processes = {};
  lot.processes[proc] = {
    date: fmt(new Date()),
    status: '완료',
    operator: currentUser?.displayName || '',
    timestamp: Date.now()
  };
  lot.updatedAt = Date.now();

  // 마지막 공정이면 LOT 완료
  const lastProc = PROC_ORDER[PROC_ORDER.length - 1];
  if (proc === lastProc) {
    lot.status = '완료';
    lot.completedAt = Date.now();
  }

  try {
    const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    await updateDoc(doc(db, 'lots', lotId), {
      processes: lot.processes,
      status: lot.status,
      updatedAt: lot.updatedAt,
      ...(lot.completedAt ? { completedAt: lot.completedAt } : {})
    });
    toast(`${lot.sn} — ${proc} 완료!`);
    openStatusEdit(lotId); // 새로고침
  } catch (err) {
    console.error('공정 업데이트 실패:', err);
    toast('업데이트 실패: ' + err.message);
  }
};


// ──────────────────────────────────────────────
// 4-4. 이슈 등록 모달
// ──────────────────────────────────────────────
window.openIssueModal = function(lotId) {
  const lot = D.find(d => d.id === lotId);
  if (!lot) return;

  const issueTypes = ['치수불량', '외관불량', '크랙', '오염', '장비고장', '자재불량', '공정오류', '기타'];

  openModal('issueModal', `
    <div class="modal-header">
      <span>⚠️ 이슈 등록 — ${lot.sn}</span>
      <button class="modal-close" onclick="closeModal('issueModal')">✕</button>
    </div>
    <div class="modal-body">
      <div style="display:grid;gap:16px;">
        <div>
          <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">이슈 유형</label>
          <select id="iss-type" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--glass-bg);color:var(--text);">
            ${issueTypes.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">발생 공정</label>
          <select id="iss-proc" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--glass-bg);color:var(--text);">
            ${PROC_ORDER.map(p => `<option value="${p}">${p}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">심각도</label>
          <select id="iss-severity" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--glass-bg);color:var(--text);">
            <option value="low">낮음 (경미)</option>
            <option value="medium" selected>보통</option>
            <option value="high">높음 (심각)</option>
            <option value="critical">긴급 (라인 중단)</option>
          </select>
        </div>
        <div>
          <label style="font-size:13px;font-weight:600;display:block;margin-bottom:4px;">상세 내용</label>
          <textarea id="iss-desc" rows="4" placeholder="이슈 내용을 상세히 기록하세요..." style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--glass-bg);color:var(--text);font-size:14px;resize:vertical;"></textarea>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;padding:16px 24px;border-top:1px solid var(--border);">
      <button class="btn btn-secondary" onclick="closeModal('issueModal')">취소</button>
      <button class="btn btn-danger" onclick="submitIssue('${lotId}')">이슈 등록</button>
    </div>
  `);
};

window.submitIssue = async function(lotId) {
  const lot = D.find(d => d.id === lotId);
  if (!lot) return;

  const type = document.getElementById('iss-type')?.value || '기타';
  const proc = document.getElementById('iss-proc')?.value || '';
  const severity = document.getElementById('iss-severity')?.value || 'medium';
  const desc = document.getElementById('iss-desc')?.value.trim() || '';

  if (!desc) { toast('이슈 내용을 입력하세요'); return; }

  const issue = {
    type,
    process: proc,
    severity,
    description: desc,
    date: fmt(new Date()),
    reporter: currentUser?.displayName || '',
    status: '미해결',
    timestamp: Date.now()
  };

  if (!lot.issues) lot.issues = [];
  lot.issues.push(issue);
  lot.status = '이슈';
  lot.updatedAt = Date.now();

  try {
    const { doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    await updateDoc(doc(db, 'lots', lotId), {
      issues: lot.issues,
      status: lot.status,
      updatedAt: lot.updatedAt
    });
    closeModal('issueModal');
    toast(`이슈 등록 완료 — ${lot.sn}`);
  } catch (err) {
    toast('이슈 등록 실패: ' + err.message);
  }
};


// ──────────────────────────────────────────────
// 4-5. LOT 상세 슬라이드 패널
// ──────────────────────────────────────────────
window.openLotDetail = function(lotId) {
  const lot = D.find(d => d.id === lotId);
  if (!lot) { toast('LOT을 찾을 수 없습니다'); return; }

  const prog = calcProgress(lot);
  const issueList = (lot.issues || []).map(iss =>
    `<div style="padding:10px;border-left:3px solid ${iss.severity === 'critical' ? '#ef4444' : iss.severity === 'high' ? '#f59e0b' : '#6366f1'};background:var(--glass-bg);border-radius:0 8px 8px 0;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;font-size:12px;">
        <span class="badge badge-danger">${iss.type}</span>
        <span style="color:var(--text-secondary);">${iss.date}</span>
      </div>
      <div style="font-size:13px;margin-top:4px;">${iss.description || ''}</div>
      <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">${iss.process || ''} · ${iss.reporter || ''} · ${iss.status || ''}</div>
    </div>`
  ).join('') || '<p style="color:var(--text-secondary);text-align:center;">등록된 이슈 없음</p>';

  // 타임라인
  const timeline = PROC_ORDER.map(proc => {
    const info = lot.processes?.[proc];
    return `<div class="timeline-item" style="display:flex;gap:12px;margin-bottom:12px;">
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;background:${info ? PROC_COLORS[proc] : 'var(--border)'};color:${info ? '#fff' : 'var(--text-secondary)'};">${info ? '✓' : '·'}</div>
        <div style="width:2px;flex:1;background:${info ? PROC_COLORS[proc] : 'var(--border)'};"></div>
      </div>
      <div style="flex:1;padding-bottom:8px;">
        <div style="font-size:13px;font-weight:${info ? '600' : '400'};color:${info ? PROC_COLORS[proc] : 'var(--text-secondary)'};">${proc}</div>
        ${info ? `<div style="font-size:11px;color:var(--text-secondary);">${info.date || ''} ${info.operator ? '· ' + info.operator : ''}</div>
        ${info.note ? `<div style="font-size:11px;margin-top:2px;">${info.note}</div>` : ''}` : '<div style="font-size:11px;color:var(--text-secondary);">대기중</div>'}
      </div>
    </div>`;
  }).join('');

  openModal('lotDetailModal', `
    <div class="modal-header">
      <span>${lot.sn} 상세</span>
      <button class="modal-close" onclick="closeModal('lotDetailModal')">✕</button>
    </div>
    <div class="modal-body" style="max-height:75vh;overflow-y:auto;">

      <!-- 기본 정보 -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
        <div class="card" style="padding:12px;">
          <div style="font-size:11px;color:var(--text-secondary);">제품</div>
          <div style="font-size:15px;font-weight:600;">${lot.product || '-'}</div>
        </div>
        <div class="card" style="padding:12px;">
          <div style="font-size:11px;color:var(--text-secondary);">고객</div>
          <div style="font-size:15px;font-weight:600;">${lot.customer || '-'}</div>
        </div>
        <div class="card" style="padding:12px;">
          <div style="font-size:11px;color:var(--text-secondary);">수량</div>
          <div style="font-size:15px;font-weight:600;">${lot.qty || '-'}</div>
        </div>
        <div class="card" style="padding:12px;">
          <div style="font-size:11px;color:var(--text-secondary);">납기일</div>
          <div style="font-size:15px;font-weight:600;${lot.dueDate && new Date(lot.dueDate) < new Date() ? 'color:#ef4444;' : ''}">${lot.dueDate || '-'}</div>
        </div>
      </div>

      <!-- 진행률 -->
      <div style="margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:13px;font-weight:600;">진행률</span>
          <span style="font-size:13px;font-weight:700;color:var(--accent);">${prog}%</span>
        </div>
        <div class="progress-bar" style="height:10px;">
          <div class="progress-fill" style="width:${prog}%;"></div>
        </div>
      </div>

      <!-- 공정 타임라인 -->
      <div style="margin-bottom:20px;">
        <h4 style="margin:0 0 12px 0;font-size:14px;">공정 타임라인</h4>
        ${timeline}
      </div>

      <!-- 이슈 -->
      <div style="margin-bottom:20px;">
        <h4 style="margin:0 0 12px 0;font-size:14px;">이슈 이력 (${(lot.issues || []).length}건)</h4>
        ${issueList}
      </div>

      ${lot.note ? `<div style="margin-bottom:20px;"><h4 style="margin:0 0 8px 0;font-size:14px;">비고</h4><p style="font-size:13px;color:var(--text-secondary);line-height:1.6;">${lot.note}</p></div>` : ''}

      <!-- 액션 버튼 -->
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-primary" onclick="closeModal('lotDetailModal');openStatusEdit('${lot.id}')">공정 입력</button>
        <button class="btn btn-secondary" onclick="generateQR('${lot.id}')">QR 생성</button>
        <button class="btn btn-secondary" onclick="exportLotExcel('${lot.id}')">Excel 내보내기</button>
        <button class="btn btn-danger" onclick="deleteLot('${lot.id}')" style="margin-left:auto;">삭제</button>
      </div>
    </div>
  `);
};


// ──────────────────────────────────────────────
// 4-6. LOT 삭제
// ──────────────────────────────────────────────
window.deleteLot = async function(lotId) {
  if (!confirm('정말 이 LOT을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

  try {
    const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    await deleteDoc(doc(db, 'lots', lotId));
    D = D.filter(d => d.id !== lotId);
    closeModal('lotDetailModal');
    toast('LOT 삭제 완료');
    switchTab(window._currentTab || 'home');
  } catch (err) {
    toast('삭제 실패: ' + err.message);
  }
};


// ──────────────────────────────────────────────
// 4-7. Excel 내보내기
// ──────────────────────────────────────────────
window.exportAllExcel = function() {
  if (typeof XLSX === 'undefined') { toast('SheetJS 로딩 중... 잠시 후 다시 시도하세요'); return; }

  const rows = D.map(d => {
    const row = {
      'S/N': d.sn || '',
      '제품': d.product || '',
      '고객': d.customer || '',
      '수량': d.qty || '',
      '납기일': d.dueDate || '',
      '상태': d.status || '',
      '진행률': calcProgress(d) + '%',
      '등록일': d.createdAt ? new Date(d.createdAt).toLocaleDateString('ko-KR') : '',
      '비고': d.note || ''
    };
    PROC_ORDER.forEach(proc => {
      row[proc + ' 일자'] = d.processes?.[proc]?.date || '';
      row[proc + ' 담당'] = d.processes?.[proc]?.operator || '';
    });
    row['이슈수'] = (d.issues || []).length;
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '생산현황');
  XLSX.writeFile(wb, `ESC_생산현황_${fmt(new Date())}.xlsx`);
  toast('Excel 다운로드 완료');
};

window.exportLotExcel = function(lotId) {
  const lot = D.find(d => d.id === lotId);
  if (!lot || typeof XLSX === 'undefined') return;

  const rows = PROC_ORDER.map(proc => ({
    '공정': proc,
    '일자': lot.processes?.[proc]?.date || '',
    '상태': lot.processes?.[proc]?.status || '대기',
    '담당자': lot.processes?.[proc]?.operator || '',
    '비고': lot.processes?.[proc]?.note || ''
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, lot.sn);
  XLSX.writeFile(wb, `${lot.sn}_공정현황.xlsx`);
  toast(`${lot.sn} Excel 다운로드`);
};


// ──────────────────────────────────────────────
// 4-8. QR 코드 생성
// ──────────────────────────────────────────────
window.generateQR = function(lotId) {
  const lot = D.find(d => d.id === lotId);
  if (!lot) return;

  const qrData = JSON.stringify({
    sn: lot.sn,
    product: lot.product,
    customer: lot.customer,
    id: lot.id
  });

  openModal('qrModal', `
    <div class="modal-header">
      <span>QR 코드 — ${lot.sn}</span>
      <button class="modal-close" onclick="closeModal('qrModal')">✕</button>
    </div>
    <div class="modal-body" style="text-align:center;">
      <div id="qr-canvas" style="display:inline-block;padding:20px;background:#fff;border-radius:12px;"></div>
      <div style="margin-top:16px;">
        <p style="font-size:14px;font-weight:600;">${lot.sn}</p>
        <p style="font-size:12px;color:var(--text-secondary);">${lot.product} / ${lot.customer || '-'}</p>
      </div>
      <button class="btn btn-primary" onclick="printQR()" style="margin-top:16px;">🖨 인쇄</button>
    </div>
  `);

  setTimeout(() => {
    const container = document.getElementById('qr-canvas');
    if (container && typeof QRCode !== 'undefined') {
      new QRCode(container, {
        text: qrData,
        width: 200,
        height: 200,
        colorDark: '#000000',
        colorLight: '#ffffff'
      });
    }
  }, 100);
};

window.printQR = function() {
  const qrContainer = document.getElementById('qr-canvas');
  if (!qrContainer) return;
  const printWin = window.open('', '_blank');
  printWin.document.write(`<html><body style="text-align:center;padding:40px;">${qrContainer.innerHTML}</body></html>`);
  printWin.document.close();
  printWin.print();
};


// ──────────────────────────────────────────────
// 4-9. 모바일 하단 네비게이션
// ──────────────────────────────────────────────
function setupMobileNav() {
  const bottomBar = document.getElementById('bottom-bar');
  if (!bottomBar) return;

  const tabs = [
    { id: 'home', icon: '🏠', label: '홈' },
    { id: 'workspace', icon: '📋', label: '작업' },
    { id: 'calendar', icon: '📅', label: '일정' },
    { id: 'analysis', icon: '📊', label: '분석' },
    { id: 'settings', icon: '⚙️', label: '설정' }
  ];

  bottomBar.innerHTML = tabs.map(t =>
    `<button class="bottom-tab ${t.id === 'home' ? 'active' : ''}" data-tab="${t.id}" onclick="switchTab('${t.id}');updateMobileNav('${t.id}')">
      <span style="font-size:20px;">${t.icon}</span>
      <span style="font-size:10px;">${t.label}</span>
    </button>`
  ).join('');
}

window.updateMobileNav = function(tabId) {
  document.querySelectorAll('#bottom-bar .bottom-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tabId);
  });
};


// ──────────────────────────────────────────────
// 4-10. 사이드바 네비게이션 설정
// ──────────────────────────────────────────────
function setupSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  const navItems = [
    { id: 'home', icon: '🏠', label: '홈' },
    { id: 'workspace', icon: '📋', label: '작업관리' },
    { id: 'calendar', icon: '📅', label: '캘린더' },
    { id: 'gantt', icon: '📊', label: '간트차트' },
    { id: 'analysis', icon: '📈', label: '분석' },
    { id: 'ai', icon: '🤖', label: 'AI' },
    { id: 'settings', icon: '⚙️', label: '설정' }
  ];

  const nav = sidebar.querySelector('.nav') || sidebar;
  nav.innerHTML = navItems.map(item =>
    `<div class="nav-item ${item.id === 'home' ? 'active' : ''}" data-tab="${item.id}" onclick="switchTab('${item.id}')">
      <span class="nav-icon">${item.icon}</span>
      <span class="nav-label">${item.label}</span>
    </div>`
  ).join('');

  // 사이드바 접기 토글
  const toggleBtn = sidebar.querySelector('.sidebar-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }
}





// ──────────────────────────────────────────────
// 4-12. 인증 상태 감지 & 앱 시작
// ──────────────────────────────────────────────
async function initApp() {
  console.log('🚀 ESC Manager v9.0 초기화...');

  // 테마 복원
  const savedTheme = localStorage.getItem('esc-theme');
  if (savedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }

  try {
    const { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut }
      = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');

    const auth = getAuth(app);

    // 로그인 버튼
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
      loginBtn.addEventListener('click', async () => {
        try {
          const provider = new GoogleAuthProvider();
          await signInWithPopup(auth, provider);
        } catch (err) {
          console.error('로그인 실패:', err);
          toast('로그인 실패: ' + err.message);
        }
      });
    }

    // 로그아웃
    window.signOutUser = async function() {
      try {
        await signOut(auth);
        toast('로그아웃 완료');
      } catch (err) {
        toast('로그아웃 실패');
      }
    };

    // 인증 상태 감지
    onAuthStateChanged(auth, user => {
      const loginScreen = document.getElementById('login-screen');
      const appDiv = document.getElementById('app');

      if (user) {
        currentUser = user;
        console.log('✅ 로그인:', user.email);

        if (loginScreen) loginScreen.style.display = 'none';
        if (appDiv) appDiv.style.display = 'flex';

        // 사이드바, 모바일 내비, 데이터 로드
        setupSidebar();
        setupMobileNav();
        loadData();
      } else {
        currentUser = null;
        if (loginScreen) loginScreen.style.display = 'flex';
        if (appDiv) appDiv.style.display = 'none';
      }
    });

  } catch (err) {
    console.error('인증 초기화 실패:', err);
    toast('앱 초기화 실패');
  }
}

window.doLogin = function() {
  document.getElementById('login-btn')?.click();
};
s
// ──────────────────────────────────────────────
// 4-13. DOM 준비 후 시작
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initApp);


// ═══════════════════════════════════════════════════════════
// main.js 끝 — 전체 코드 완성
// ═══════════════════════════════════════════════════════════

