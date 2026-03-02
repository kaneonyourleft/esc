// ═══════════════════════════════════════════════════════════
// ESC Manager v10.0 — main.js (완전 통합 버전 + 10가지 버그 방어)
//
// [버그 #1]  getProc() — processes 맵 null-safe 래퍼
// [버그 #2]  fD() — Firestore Timestamp / Date / string / epoch / null 완전 처리
// [버그 #3]  getRoute() — route 없을 때 카테고리 기반 자동 생성 강화
// [버그 #4]  positionDropdown() — 드롭다운 화면 밖 방지
// [버그 #5]  addCellInteraction() — 모바일 pointer event 지원
// [버그 #6]  handleFirestoreError() — Firestore 에러 통합 안내
// [버그 #7]  handleEmptyChart() — 빈 데이터 차트 에러 방지
// [버그 #8]  사이드패널 열린 상태에서 데이터 변경 시 자동 갱신
// [버그 #9]  검색/필터 중 데이터 변경 시 렌더링 순서 보장 (scheduleRender)
// [버그 #10] onDataChanged() — onSnapshot에서 현재 탭만 갱신
// ═══════════════════════════════════════════════════════════

// ──────── PWA ────────
const ICON_SVG=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#6366f1"/><text x="256" y="340" text-anchor="middle" font-family="Arial Black" font-size="220" fill="white" font-weight="900">ESC</text></svg>`;
const iconBlob=new Blob([ICON_SVG],{type:'image/svg+xml'});
const iconURL=URL.createObjectURL(iconBlob);

const manifest=JSON.stringify({name:'ESC Manager',short_name:'ESC',start_url:'/',display:'standalone',background_color:'#0a0f1e',theme_color:'#6366f1',icons:[{src:iconURL,sizes:'512x512',type:'image/svg+xml'}]});
const mLink=document.createElement('link');
mLink.rel='manifest';
mLink.href='data:application/json;charset=utf-8,'+encodeURIComponent(manifest);
document.head.appendChild(mLink);

const swCode=`const CACHE='esc-v10';self.addEventListener('install',e=>{self.skipWaiting()});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))))});self.addEventListener('fetch',e=>{e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))});`;
if('serviceWorker' in navigator){
  const swBlob=new Blob([swCode],{type:'application/javascript'});
  navigator.serviceWorker.register(URL.createObjectURL(swBlob)).catch(()=>{});
}

// ──────── CDN Libraries ────────
function loadCDN(url){return new Promise((res,rej)=>{const s=document.createElement('script');s.src=url;s.onload=res;s.onerror=rej;document.head.appendChild(s)})}
Promise.all([
  loadCDN('https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js'),
  loadCDN('https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js')
]).then(()=>console.log('📦 CDN loaded')).catch(e=>console.warn('CDN load warning:',e));

// ──────── Firebase ────────
const FB='https://www.gstatic.com/firebasejs/10.14.1/';
const FC={apiKey:'AIzaSyAwDS2PigihTH6RKMxzrH-utlaKJbtHBTY',authDomain:'esc-production-management.firebaseapp.com',projectId:'esc-production-management',storageBucket:'esc-production-management.firebasestorage.app',messagingSenderId:'744508930498',appId:'1:744508930498:web:0cd274d3e8ad498fe498ef'};

let firebase_app,auth,db,fs_fn={};
async function initFirebase(){
  const{initializeApp}=await import(FB+'firebase-app.js');
  const{getAuth,signInWithPopup,GoogleAuthProvider,signOut,onAuthStateChanged}=await import(FB+'firebase-auth.js');
  const{getFirestore,collection,doc,getDoc,getDocs,setDoc,updateDoc,deleteDoc,onSnapshot,query,orderBy,where,writeBatch,Timestamp,serverTimestamp}=await import(FB+'firebase-firestore.js');
  firebase_app=initializeApp(FC);
  auth=getAuth(firebase_app);
  db=getFirestore(firebase_app);
  fs_fn={collection,doc,getDoc,getDocs,setDoc,updateDoc,deleteDoc,onSnapshot,query,orderBy,where,writeBatch,Timestamp,serverTimestamp,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged};
  setupAuth();
}
initFirebase().catch(e=>console.error('Firebase init error:',e));

// ──────── Global State ────────
let D={},PRODS={},ISSUES=[];
let currentUser=null,currentTab='home',currentSN=null;
let sidebarCollapsed=false,isDark=true;
let calDate=new Date(),calView='month';
let ganttView='product',ganttDayW=30,ganttCollapsed={};
let wsView='product',wsFilter='전체',wsGroupCollapsed={};
let selectedSNs=new Set(),allExpanded=false,ganttAllExpanded=false;
let miniChatOpen=false;
let chatHistory=[];
let widgetConfig=null;

// [버그 #9] 렌더링 예약용
let _renderRAF=null;

// ──────── Constants ────────
const PROC_ORDER=['탈지','소성','환원소성','평탄화','도금','열처리'];
const PROC_COLORS={탈지:'#f59e0b',소성:'#ef4444',환원소성:'#f97316',평탄화:'#3b82f6',도금:'#8b5cf6',열처리:'#10b981'};
const EQ_MAP={
  탈지:['탈지 1호기','탈지 2호기','탈지 3호기'],
  소성:['소성 5호기','소성 6호기','소성 7호기','소성 8호기','소성 9호기','소성 10호기','소성 11호기','소성 12호기','소성 13호기','소성 14호기','소성 15호기','소성 16호기','소성 17호기','소성 18호기'],
  환원소성:['환원 5호기','환원 6호기','환원 7호기','환원 8호기','환원 9호기','환원 10호기','환원 11호기','환원 12호기','환원 13호기','환원 14호기','환원 15호기','환원 16호기','환원 17호기','환원 18호기'],
  평탄화:['평탄화 A','평탄화 B','평탄화 C'],
  도금:['도금 1라인','도금 2라인','도금 3라인'],
  열처리:['열처리 A','열처리 B']
};
const DEFAULT_WIDGETS=[
  {id:'kpi',name:'KPI 요약',enabled:true},
  {id:'pipeline',name:'공정 파이프라인',enabled:true},
  {id:'today',name:'오늘의 작업',enabled:true},
  {id:'alerts',name:'알림/지연',enabled:true},
  {id:'chart_donut',name:'상태 분포 차트',enabled:true},
  {id:'chart_weekly',name:'주간 트렌드',enabled:true},
  {id:'recent',name:'최근 활동',enabled:true}
];

function getWidgetConfig(){
  if(widgetConfig) return widgetConfig;
  try{const s=localStorage.getItem('esc_widgets');if(s)return widgetConfig=JSON.parse(s)}catch(e){}
  return widgetConfig=JSON.parse(JSON.stringify(DEFAULT_WIDGETS));
}
function saveWidgetConfigToLS(cfg){widgetConfig=cfg;localStorage.setItem('esc_widgets',JSON.stringify(cfg))}

// ═══════════════════════════════════════════════════════════
// 유틸리티 함수 (버그 #1, #2, #3 방어 포함)
// ═══════════════════════════════════════════════════════════

const esc=s=>s?String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'):'';
const todayStr=()=>new Date().toISOString().split('T')[0];

// [버그 #2] fD() — 모든 날짜 타입을 "YYYY-MM-DD" 문자열로 안전 변환
function fD(v,fallback=''){
  if(!v)return fallback;
  // Firestore Timestamp (.toDate 메서드 보유)
  if(typeof v==='object'&&typeof v.toDate==='function'){
    try{return v.toDate().toISOString().split('T')[0]}catch(e){return fallback}
  }
  // 일반 Date 객체
  if(v instanceof Date){
    return isNaN(v.getTime())?fallback:v.toISOString().split('T')[0];
  }
  // {seconds: number} 형태 (Firestore REST 등)
  if(typeof v==='object'&&typeof v.seconds==='number'){
    try{return new Date(v.seconds*1000).toISOString().split('T')[0]}catch(e){return fallback}
  }
  // 문자열
  if(typeof v==='string'){
    if(/^\d{4}-\d{2}-\d{2}/.test(v))return v.slice(0,10);
    const parsed=new Date(v);
    if(!isNaN(parsed.getTime()))return parsed.toISOString().split('T')[0];
    return fallback;
  }
  // 숫자 (epoch ms)
  if(typeof v==='number'){
    try{return new Date(v).toISOString().split('T')[0]}catch(e){return fallback}
  }
  return fallback;
}

// 표시용 포매터 (예: "2024.03.02")
const fmt=d=>{
  const s=fD(d);
  if(!s||s==='-')return'-';
  const p=s.split('-');
  return p.length===3?`${p[0]}.${p[1]}.${p[2]}`:'-';
};

// [버그 #1] getProc() — processes 맵 null-safe 래퍼
function getProc(d,proc){
  const EMPTY={status:'대기',planStart:'',planEnd:'',actualStart:'',actualEnd:'',planDays:0,actualDays:0,equip:'',defect:'',remark:''};
  if(!d||!d.processes||typeof d.processes!=='object')return{...EMPTY};
  return d.processes[proc]||{...EMPTY};
}

function isHoliday(d){const day=d.getDay();return day===0||day===6}
function addBD(start,days){
  if(!start||!days)return'';
  let d=new Date(start+'T00:00:00');
  if(isNaN(d.getTime()))return'';
  // 음수 days 지원 (납기역산)
  const dir=days>0?1:-1;
  let added=0;
  const abs=Math.abs(days);
  while(added<abs){d.setDate(d.getDate()+dir);if(!isHoliday(d))added++}
  return d.toISOString().split('T')[0];
}
function diffBD(s,e){
  if(!s||!e)return 0;
  let a=new Date(s+'T00:00:00'),b=new Date(e+'T00:00:00'),cnt=0;
  if(isNaN(a.getTime())||isNaN(b.getTime()))return 0;
  if(a>b)return 0;
  let c=new Date(a);
  while(c<b){c.setDate(c.getDate()+1);if(!isHoliday(c))cnt++}
  return cnt;
}

function procDays(proc,cat){
  const map={탈지:3,소성:3,환원소성:3,평탄화:5,도금:3,열처리:2};
  const blMap={탈지:3,소성:5,환원소성:5,평탄화:7,도금:3,열처리:2};
  if(cat&&cat.toUpperCase()==='BL')return blMap[proc]||3;
  return map[proc]||3;
}

function buildRoute(cat,heat){
  cat=(cat||'').toUpperCase();heat=(heat||'').toUpperCase();
  if(cat==='WN')return heat==='Y'?['탈지','소성','환원소성','평탄화','도금','열처리']:['탈지','소성','환원소성','평탄화','도금'];
  if(cat==='BL')return heat==='Y'?['탈지','소성','평탄화','도금','열처리']:['탈지','소성','평탄화','도금'];
  if(cat==='HP')return heat==='Y'?['탈지','소성','평탄화','도금','열처리']:['탈지','소성','평탄화','도금'];
  return['탈지','소성','평탄화','도금'];
}

function getCategory(sn){
  if(!sn)return'';
  const s=String(sn).toUpperCase();
  if(s.startsWith('WN'))return'WN';
  if(s.startsWith('BL'))return'BL';
  if(s.startsWith('HP'))return'HP';
  return'';
}

// [버그 #3] getRoute() — route 없거나 빈 배열이면 카테고리 기반 자동 생성
function getRoute(sn,d){
  if(d&&Array.isArray(d.route)&&d.route.length>0)return d.route;
  // route가 문자열인 경우 (v8 레거시: "탈지→소성→평탄화→도금")
  if(d&&typeof d.route==='string'&&d.route.includes('→')){
    const arr=d.route.split('→').map(s=>s.trim()).filter(Boolean);
    if(arr.length)return arr;
  }
  const cat=getCategory(sn)||(d&&d.category?d.category:'');
  const heat=(d&&d.heat)?d.heat:'N';
  return buildRoute(cat,heat);
}

function getEquipList(proc){
  return EQ_MAP[proc]||[];
}

// [버그 #1] calcProgress — getProc 사용
function calcProgress(d,sn){
  const route=getRoute(sn,d);
  if(!route.length)return 0;
  let done=0;
  route.forEach(p=>{if(getProc(d,p).status==='완료')done++});
  return Math.round(done/route.length*100);
}

function statusBadge(s){
  const m={'대기':'badge-wait','진행':'badge-prog','완료':'badge-done','지연':'badge-delay','폐기':'badge-ng'};
  return`<span class="badge ${m[s]||'badge-wait'}">${esc(s||'대기')}</span>`;
}

function toast(msg,type='info'){
  const c=document.getElementById('toastContainer');if(!c)return;
  const t=document.createElement('div');
  t.className='toast toast-'+type;
  t.innerHTML=msg;
  c.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('show'));
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300)},3000);
}

function openModal(id){document.getElementById(id)?.classList.remove('hidden')}
function closeModal(id){document.getElementById(id)?.classList.add('hidden')}

function mdToHtml(md){
  if(!md)return'';
  return md.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.*?)\*/g,'<em>$1</em>')
    .replace(/`(.*?)`/g,'<code>$1</code>')
    .replace(/\n/g,'<br>');
}

// [버그 #6] Firestore 에러 통합 핸들러
function handleFirestoreError(err,context=''){
  const code=err?.code||'';
  const prefix=context?`[${context}] `:'';
  let msg;
  switch(code){
    case'permission-denied':case'PERMISSION_DENIED':
      msg=`${prefix}권한이 없습니다. 로그인 상태를 확인하세요.`;break;
    case'not-found':
      msg=`${prefix}문서를 찾을 수 없습니다. 새로고침 해주세요.`;break;
    case'unavailable':case'deadline-exceeded':
      msg=`${prefix}서버 연결 실패. 네트워크를 확인하세요.`;break;
    case'resource-exhausted':
      msg=`${prefix}요청 한도 초과. 잠시 후 다시 시도하세요.`;break;
    case'unauthenticated':
      msg=`${prefix}인증 만료. 다시 로그인하세요.`;
      setTimeout(()=>{if(typeof doLogout==='function')doLogout()},3000);
      break;
    case'already-exists':
      msg=`${prefix}이미 존재하는 데이터입니다.`;break;
    default:
      msg=`${prefix}저장 실패: ${err?.message||'알 수 없는 오류'}`;
  }
  console.error(`[Firestore Error] ${code}:`,err);
  toast(msg,'error');
}

// [버그 #4] 드롭다운 화면 밖 방지 위치 보정
function positionDropdown(dropdown,anchor){
  if(!dropdown||!anchor)return;
  const anchorRect=anchor.getBoundingClientRect();
  const vw=window.innerWidth;
  const vh=window.innerHeight;

  dropdown.style.position='fixed';
  dropdown.style.left=anchorRect.left+'px';
  dropdown.style.top=(anchorRect.bottom+4)+'px';

  requestAnimationFrame(()=>{
    const ddRect=dropdown.getBoundingClientRect();
    // 아래로 넘치면 위로 펼침
    if(ddRect.bottom>vh-10){
      dropdown.style.top=(anchorRect.top-ddRect.height-4)+'px';
    }
    // 오른쪽 넘침
    if(ddRect.right>vw-10){
      dropdown.style.left=(vw-ddRect.width-10)+'px';
    }
    // 왼쪽 넘침
    if(parseFloat(dropdown.style.left)<10){
      dropdown.style.left='10px';
    }
  });
}

// [버그 #7] 차트 빈 데이터 처리
function handleEmptyChart(canvas,data,message='데이터가 없습니다'){
  if(!canvas)return true;
  const isEmpty=!data||(Array.isArray(data)&&data.length===0)||(typeof data==='object'&&!Array.isArray(data)&&Object.keys(data).length===0);
  if(!isEmpty&&typeof data==='number'&&data>0)return false;
  if(!isEmpty&&typeof data==='object'&&!Array.isArray(data)){
    const total=Object.values(data).reduce((a,b)=>a+(typeof b==='number'?b:0),0);
    if(total>0)return false;
  }
  if(!isEmpty&&!Array.isArray(data))return false;

  const ctx=canvas.getContext('2d');
  const w=canvas.width=canvas.parentElement?canvas.parentElement.clientWidth-32:300;
  const h=canvas.height=240;
  ctx.clearRect(0,0,w,h);
  const isDarkMode=!document.body.classList.contains('light-mode');
  ctx.fillStyle=isDarkMode?'#666':'#999';
  ctx.font='14px "Noto Sans KR", sans-serif';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillText(message,w/2,h/2);
  return true;
}

// [버그 #9] 렌더링 예약 (중복 호출 방지)
function scheduleRender(){
  if(_renderRAF)return;
  _renderRAF=requestAnimationFrame(()=>{
    _renderRAF=null;
    renderWorkspace();
  });
}

// [버그 #8] 사이드패널 자동 리프레시
function refreshSidePanelIfOpen(){
  if(!currentSN)return;
  if(!D[currentSN]){closeSidePanel();return}
  // 패널이 열려있으면 내용 갱신
  const panel=document.getElementById('sidePanel');
  if(panel&&panel.classList.contains('open')){
    openSidePanel(currentSN);
  }
}

// [버그 #10] 통합 데이터 갱신 함수 — onSnapshot에서 호출
function onDataChanged(){
  switch(currentTab){
    case'home':renderHome();break;
    case'workspace':scheduleRender();break;
    case'calendar':renderCalendar();break;
    case'gantt':renderGantt();break;
    case'analysis':renderAnalysis();break;
    case'settings':renderSettings();break;
  }
  refreshSidePanelIfOpen();
}

// ──────── Auth ────────
window.doLogin=async function(){
  if(!auth||!fs_fn.GoogleAuthProvider)return toast('Firebase 초기화 중...','warn');
  document.getElementById('loginSpinner').style.display='block';
  document.getElementById('loginError').style.display='none';
  try{
    await fs_fn.signInWithPopup(auth,new fs_fn.GoogleAuthProvider());
  }catch(e){
    document.getElementById('loginError').textContent=e.message;
    document.getElementById('loginError').style.display='block';
    document.getElementById('loginSpinner').style.display='none';
  }
};

window.doLogout=async function(){
  if(auth)await fs_fn.signOut(auth);
  location.reload();
};

function setupAuth(){
  fs_fn.onAuthStateChanged(auth,user=>{
    currentUser=user;
    if(user){
      document.getElementById('loginScreen').style.display='none';
      document.getElementById('app').style.display='flex';
      const av=user.photoURL?`<img src="${user.photoURL}" style="width:100%;height:100%;border-radius:50%">`:(user.displayName||'U')[0];
      ['sbAvatar','tbAvatar'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=typeof av==='string'&&av.startsWith('<')?av:`<span>${av}</span>`});
      document.getElementById('sbName').textContent=user.displayName||'사용자';
      document.getElementById('sbEmail').textContent=user.email||'';
      document.getElementById('settingName').textContent=user.displayName||'사용자';
      document.getElementById('settingEmail').textContent=user.email||'';
      applyTheme();
      loadData();
    }else{
      document.getElementById('loginScreen').style.display='flex';
      document.getElementById('app').style.display='none';
      document.getElementById('loginSpinner').style.display='none';
    }
  });
}

// ──────── Data Loading ────────
let unsubProd=null,unsubIssue=null;

function loadData(){
  if(unsubProd)unsubProd();
  if(unsubIssue)unsubIssue();

  const prodCol=fs_fn.collection(db,'production');
  // [버그 #10] onSnapshot → onDataChanged 사용
  unsubProd=fs_fn.onSnapshot(prodCol,snap=>{
    D={};
    snap.forEach(doc=>{D[doc.id]=doc.data()});
    console.log(`📋 production: ${Object.keys(D).length} records`);
    onDataChanged();
    updateDataStats();
  },err=>{
    // [버그 #6] 에러 처리
    handleFirestoreError(err,'데이터 로드');
  });

  const prodListCol=fs_fn.collection(db,'products');
  fs_fn.getDocs(prodListCol).then(snap=>{
    PRODS={};
    snap.forEach(doc=>{PRODS[doc.id]=doc.data()});
    console.log(`📦 products: ${Object.keys(PRODS).length} items`);
    populateProductSelects();
  }).catch(err=>handleFirestoreError(err,'제품 로드'));

  const issueCol=fs_fn.collection(db,'issues');
  unsubIssue=fs_fn.onSnapshot(fs_fn.query(issueCol,fs_fn.orderBy('date','desc')),snap=>{
    ISSUES=[];
    snap.forEach(doc=>{ISSUES.push({id:doc.id,...doc.data()})});
    console.log(`🚨 issues: ${ISSUES.length} items`);
    if(currentTab==='calendar')renderCalendar();
  },err=>{
    handleFirestoreError(err,'이슈 로드');
  });
}

window.refreshData=function(){loadData();toast('데이터 새로고침','success')};

function populateProductSelects(){
  const selIds=['sn_prod','dl_prod','is_prod','pm_edit_prod'];
  selIds.forEach(id=>{
    const sel=document.getElementById(id);
    if(!sel)return;
    const val=sel.value;
    const opts='<option value="">선택...</option>'+Object.entries(PRODS).map(([k,v])=>`<option value="${esc(k)}">${esc(v.name||k)} (${esc(v.category||'')})</option>`).join('');
    sel.innerHTML=opts;
    if(val)sel.value=val;
  });
}

function updateDataStats(){
  const el=document.getElementById('dataStats');
  if(!el)return;
  const total=Object.keys(D).length;
  const statCnt={대기:0,진행:0,완료:0,지연:0,폐기:0};
  Object.values(D).forEach(d=>{const s=d.status||'대기';if(statCnt[s]!==undefined)statCnt[s]++});
  el.innerHTML=`
    <div class="stat-item"><div class="stat-val">${total}</div><div class="stat-lbl">전체 LOT</div></div>
    <div class="stat-item"><div class="stat-val">${statCnt['진행']}</div><div class="stat-lbl">진행중</div></div>
    <div class="stat-item"><div class="stat-val">${statCnt['완료']}</div><div class="stat-lbl">완료</div></div>
    <div class="stat-item"><div class="stat-val">${statCnt['지연']}</div><div class="stat-lbl">지연</div></div>
  `;
}

// ═══════════════════════════════════════════════════════════
// Tab Navigation, Theme
// ═══════════════════════════════════════════════════════════

const TAB_MAP={home:'homeTab',workspace:'workspaceTab',calendar:'calendarTab',gantt:'ganttTab',analysis:'analysisTab',ai:'aiTab',settings:'settingsTab'};
const TAB_TITLES={home:'홈',workspace:'워크스페이스',calendar:'캘린더',gantt:'간트차트',analysis:'분석',ai:'AI 어시스턴트',settings:'설정'};

window.switchTab=function(tab){
  currentTab=tab;
  Object.values(TAB_MAP).forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none'});
  const target=document.getElementById(TAB_MAP[tab]);
  if(target)target.style.display=(tab==='workspace')?'flex':'block';
  document.querySelectorAll('.sb-item').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));
  document.querySelectorAll('.bb-item').forEach(el=>el.classList.toggle('active',el.dataset.tab===tab));
  document.getElementById('tbTitle').textContent=TAB_TITLES[tab]||tab;
  renderCurrentTab();
  if(window.innerWidth<768)sidebarCollapsed=true,document.getElementById('sidebar').classList.add('collapsed');
};

function renderCurrentTab(){
  switch(currentTab){
    case'home':renderHome();break;
    case'workspace':renderWorkspace();break;
    case'calendar':renderCalendar();break;
    case'gantt':renderGantt();break;
    case'analysis':renderAnalysis();break;
    case'settings':renderSettings();break;
  }
}

window.toggleSidebar=function(){
  sidebarCollapsed=!sidebarCollapsed;
  document.getElementById('sidebar').classList.toggle('collapsed',sidebarCollapsed);
};

// ──────── Theme ────────
function applyTheme(){
  document.body.classList.toggle('light-mode',!isDark);
  const tgl=document.getElementById('themeToggle');
  if(tgl)tgl.classList.toggle('active',!isDark);
}
window.toggleTheme=function(){
  isDark=!isDark;
  localStorage.setItem('esc_theme',isDark?'dark':'light');
  applyTheme();
};
(function(){const t=localStorage.getItem('esc_theme');if(t==='light')isDark=false})();

// ═══════════════════════════════════════════════════════════
// Home, Widgets, Charts, Report, Deadline Calculator
// ═══════════════════════════════════════════════════════════

function renderHome(){
  const now=new Date();
  const hour=now.getHours();
  const greet=hour<12?'좋은 아침입니다':hour<18?'좋은 오후입니다':'좋은 저녁입니다';
  const name=currentUser?.displayName||'사용자';
  document.getElementById('greetMsg').textContent=`${greet}, ${name}님!`;
  document.getElementById('greetSub').textContent=`${now.getFullYear()}년 ${now.getMonth()+1}월 ${now.getDate()}일 — 현재 생산 현황을 확인하세요`;

  const delayed=Object.entries(D).filter(([sn,d])=>(d.status||'대기')==='지연');
  const delayCard=document.getElementById('delayAlertCard');
  if(delayed.length>0){
    delayCard.style.display='block';
    document.getElementById('delayAlertMsg').textContent=`현재 ${delayed.length}건의 지연 LOT이 있습니다. 즉시 확인이 필요합니다.`;
  }else{
    delayCard.style.display='none';
  }

  renderWidgets();
}

function renderWidgets(){
  const container=document.getElementById('widgetContainer');
  if(!container)return;
  const cfg=getWidgetConfig();
  let html='';
  cfg.filter(w=>w.enabled).forEach(w=>{
    switch(w.id){
      case'kpi':html+=renderKpiWidget();break;
      case'pipeline':html+=renderPipelineWidget();break;
      case'today':html+=renderTodayWidget();break;
      case'alerts':html+=renderAlertsWidget();break;
      case'chart_donut':html+=`<div class="card"><div class="card-title">상태 분포</div><canvas id="homeDonut" height="240"></canvas></div>`;break;
      case'chart_weekly':html+=`<div class="card"><div class="card-title">주간 트렌드</div><canvas id="homeWeekly" height="240"></canvas></div>`;break;
      case'recent':html+=renderRecentWidget();break;
    }
  });
  container.innerHTML=html;
  if(document.getElementById('homeDonut'))drawDonutChart('homeDonut');
  if(document.getElementById('homeWeekly'))drawWeekBarChart('homeWeekly');
}

function renderKpiWidget(){
  const total=Object.keys(D).length;
  let prog=0,done=0,delayed=0;
  Object.values(D).forEach(d=>{const s=d.status||'대기';if(s==='진행')prog++;if(s==='완료')done++;if(s==='지연')delayed++});
  return`<div class="grid4">
    <div class="kpi-card"><div class="kpi-val">${total}</div><div class="kpi-lbl">전체 LOT</div></div>
    <div class="kpi-card"><div class="kpi-val" style="color:var(--ac2)">${prog}</div><div class="kpi-lbl">진행중</div></div>
    <div class="kpi-card"><div class="kpi-val" style="color:var(--suc)">${done}</div><div class="kpi-lbl">완료</div></div>
    <div class="kpi-card"><div class="kpi-val" style="color:var(--err)">${delayed}</div><div class="kpi-lbl">지연</div></div>
  </div>`;
}

// [버그 #1] 파이프라인 — getProc 사용
function renderPipelineWidget(){
  let procCount={};
  PROC_ORDER.forEach(p=>procCount[p]={total:0,done:0});
  Object.entries(D).forEach(([sn,d])=>{
    const route=getRoute(sn,d);
    route.forEach(p=>{
      if(!procCount[p])procCount[p]={total:0,done:0};
      procCount[p].total++;
      if(getProc(d,p).status==='완료')procCount[p].done++;
    });
  });
  let html='<div class="card"><div class="card-title">공정 파이프라인</div><div class="pipeline-grid">';
  PROC_ORDER.forEach(p=>{
    const c=procCount[p]||{total:0,done:0};
    const pct=c.total?Math.round(c.done/c.total*100):0;
    html+=`<div class="pipeline-item"><div class="pipeline-bar" style="background:${PROC_COLORS[p]||'#666'};width:${pct}%"></div><div class="pipeline-info"><span style="color:${PROC_COLORS[p]||'#666'};font-weight:600">${esc(p)}</span><span>${c.done}/${c.total}</span></div></div>`;
  });
  html+='</div></div>';
  return html;
}

// [버그 #1] 오늘의 작업 — getProc 사용
function renderTodayWidget(){
  const today=todayStr();
  let items=[];
  Object.entries(D).forEach(([sn,d])=>{
    const route=getRoute(sn,d);
    route.forEach(p=>{
      const pr=getProc(d,p);
      if(fD(pr.planStart)===today||fD(pr.planEnd)===today||fD(pr.actualStart)===today){
        items.push({sn,proc:p,data:pr});
      }
    });
  });
  let html='<div class="card"><div class="card-title">오늘의 작업</div>';
  if(!items.length){html+='<div style="font-size:13px;color:var(--t2);padding:12px">오늘 예정된 작업이 없습니다</div>';}
  else{
    html+='<div class="today-list">';
    items.slice(0,10).forEach(it=>{
      html+=`<div class="today-item" onclick="openSidePanel('${esc(it.sn)}')" style="cursor:pointer"><span class="badge" style="background:${PROC_COLORS[it.proc]||'#666'};color:#fff;font-size:11px">${esc(it.proc)}</span> <span style="font-size:13px">${esc(it.sn)}</span> <span class="badge ${it.data.status==='완료'?'badge-done':it.data.status==='진행'?'badge-prog':'badge-wait'}" style="font-size:11px">${esc(it.data.status||'대기')}</span></div>`;
    });
    if(items.length>10)html+=`<div style="font-size:12px;color:var(--t2);text-align:center;padding:4px">외 ${items.length-10}건</div>`;
    html+='</div>';
  }
  html+='</div>';
  return html;
}

function renderAlertsWidget(){
  const delayed=Object.entries(D).filter(([sn,d])=>(d.status||'대기')==='지연');
  const today=todayStr();
  const nearDue=Object.entries(D).filter(([sn,d])=>{
    if(!d.endDate||(d.status||'대기')==='완료')return false;
    const diff=diffBD(today,fD(d.endDate));
    return diff>=0&&diff<=3;
  });
  let html='<div class="card"><div class="card-title">알림</div>';
  if(!delayed.length&&!nearDue.length){html+='<div style="font-size:13px;color:var(--t2);padding:12px">현재 알림이 없습니다 ✅</div>';}
  else{
    delayed.forEach(([sn])=>{html+=`<div class="alert-item alert-danger" onclick="openSidePanel('${esc(sn)}')" style="cursor:pointer">⚠️ <strong>${esc(sn)}</strong> — 지연</div>`});
    nearDue.forEach(([sn,d])=>{html+=`<div class="alert-item alert-warn" onclick="openSidePanel('${esc(sn)}')" style="cursor:pointer">⏰ <strong>${esc(sn)}</strong> — 납기 임박 (${fmt(fD(d.endDate))})</div>`});
  }
  html+='</div>';
  return html;
}

function renderRecentWidget(){
  const sorted=Object.entries(D).sort((a,b)=>{
    const ta=fD(a[1].updatedAt||a[1].createdAt||'');
    const tb=fD(b[1].updatedAt||b[1].createdAt||'');
    return tb.localeCompare(ta);
  }).slice(0,8);
  let html='<div class="card"><div class="card-title">최근 활동</div>';
  if(!sorted.length){html+='<div style="font-size:13px;color:var(--t2);padding:12px">활동 내역이 없습니다</div>';}
  else{
    sorted.forEach(([sn,d])=>{
      html+=`<div class="recent-item" onclick="openSidePanel('${esc(sn)}')" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:13px">${esc(sn)}</span>
        <span>${statusBadge(d.status)}</span>
      </div>`;
    });
  }
  html+='</div>';
  return html;
}


// ──────── Charts ────────

// [버그 #7] 도넛 차트 — 빈 데이터 처리
function drawDonutChart(canvasId){
  const canvas=document.getElementById(canvasId);
  if(!canvas)return;

  let stats={대기:0,진행:0,완료:0,지연:0,폐기:0};
  Object.values(D).forEach(d=>{const s=d.status||'대기';if(stats[s]!==undefined)stats[s]++});
  const total=Object.values(stats).reduce((a,b)=>a+b,0);

  // 빈 데이터 체크
  if(handleEmptyChart(canvas,total===0?[]:stats,'LOT 데이터가 없습니다'))return;

  const ctx=canvas.getContext('2d');
  const w=canvas.width=canvas.parentElement.clientWidth-32;
  const h=canvas.height=240;
  ctx.clearRect(0,0,w,h);

  const colors={대기:'#64748b',진행:'#6366f1',완료:'#10b981',지연:'#ef4444',폐기:'#71717a'};
  const cx=w/2,cy=h/2-10,r=Math.min(w,h)/2-40,ir=r*0.55;
  let angle=-Math.PI/2;
  Object.entries(stats).forEach(([k,v])=>{
    if(!v)return;
    const slice=v/total*Math.PI*2;
    ctx.beginPath();ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,angle,angle+slice);ctx.closePath();
    ctx.fillStyle=colors[k]||'#666';ctx.fill();
    angle+=slice;
  });
  ctx.beginPath();ctx.arc(cx,cy,ir,0,Math.PI*2);ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--bg2').trim()||'#0f1629';ctx.fill();
  ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--t1').trim()||'#fff';
  ctx.font='bold 20px Noto Sans KR';ctx.textAlign='center';ctx.fillText(total,cx,cy+2);
  ctx.font='12px Noto Sans KR';ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--t2').trim()||'#999';ctx.fillText('전체',cx,cy+18);

  let lx=10,ly=h-18;
  Object.entries(stats).forEach(([k,v])=>{
    if(!v)return;
    ctx.fillStyle=colors[k];ctx.fillRect(lx,ly,10,10);
    ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--t2').trim()||'#999';
    ctx.font='11px Noto Sans KR';ctx.textAlign='left';ctx.fillText(`${k} ${v}`,lx+14,ly+9);
    lx+=ctx.measureText(`${k} ${v}`).width+24;
  });
}

// [버그 #7] 주간 바 차트 — 빈 데이터 처리
function drawWeekBarChart(canvasId){
  const canvas=document.getElementById(canvasId);
  if(!canvas)return;

  const today=new Date();
  const days=[];
  for(let i=6;i>=0;i--){
    const d=new Date(today);d.setDate(d.getDate()-i);
    days.push(d.toISOString().split('T')[0]);
  }
  const dayLabels=days.map(d=>{const p=d.split('-');return`${p[1]}/${p[2]}`});

  let started=days.map(()=>0),finished=days.map(()=>0);
  Object.values(D).forEach(d=>{
    const route=getRoute('',d);
    route.forEach(procName=>{
      const p=getProc(d,procName);
      const ps=fD(p.planStart||p.actualStart);
      const pe=fD(p.actualEnd);
      days.forEach((day,i)=>{if(ps===day)started[i]++;if(pe===day)finished[i]++});
    });
  });

  const hasData=started.some(v=>v>0)||finished.some(v=>v>0);
  if(handleEmptyChart(canvas,hasData?{ok:1}:[],'이번 주 데이터가 없습니다'))return;

  const ctx=canvas.getContext('2d');
  const w=canvas.width=canvas.parentElement.clientWidth-32;
  const h=canvas.height=240;
  ctx.clearRect(0,0,w,h);

  const max=Math.max(...started,...finished,1);
  const barW=(w-60)/(days.length*3);
  const chartH=h-50;
  const baseY=chartH+10;

  days.forEach((_,i)=>{
    const x=40+i*(w-60)/days.length;
    const h1=started[i]/max*chartH;
    const h2=finished[i]/max*chartH;
    ctx.fillStyle='#6366f1';ctx.fillRect(x,baseY-h1,barW,h1);
    ctx.fillStyle='#10b981';ctx.fillRect(x+barW+2,baseY-h2,barW,h2);
    ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--t2').trim()||'#999';
    ctx.font='10px Noto Sans KR';ctx.textAlign='center';
    ctx.fillText(dayLabels[i],x+barW,baseY+14);
  });

  ctx.fillStyle='#6366f1';ctx.fillRect(w-120,8,10,10);
  ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--t2').trim();ctx.font='11px Noto Sans KR';ctx.textAlign='left';ctx.fillText('시작',w-106,17);
  ctx.fillStyle='#10b981';ctx.fillRect(w-60,8,10,10);
  ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--t2').trim();ctx.fillText('완료',w-46,17);
}

// ──────── Report Modal ────────
window.openReportModal=function(){
  const today=todayStr();
  const total=Object.keys(D).length;
  let stats={대기:0,진행:0,완료:0,지연:0,폐기:0};
  Object.values(D).forEach(d=>{const s=d.status||'대기';if(stats[s]!==undefined)stats[s]++});

  let todayWork=[];
  Object.entries(D).forEach(([sn,d])=>{
    const route=getRoute(sn,d);
    route.forEach(p=>{
      const pd=getProc(d,p);
      if(fD(pd.planStart)===today||fD(pd.actualStart)===today||fD(pd.actualEnd)===today){
        todayWork.push(`${sn} / ${p} / ${pd.status||'대기'}`);
      }
    });
  });

  const html=`
    <h3>📊 일일 생산 보고서</h3>
    <p><strong>날짜:</strong> ${fmt(today)}</p>
    <p><strong>전체 LOT:</strong> ${total}건</p>
    <p>대기: ${stats['대기']} | 진행: ${stats['진행']} | 완료: ${stats['완료']} | 지연: ${stats['지연']} | 폐기: ${stats['폐기']}</p>
    <h4>오늘 작업 내역 (${todayWork.length}건)</h4>
    ${todayWork.length?todayWork.map(w=>`<p style="font-size:12px">• ${esc(w)}</p>`).join(''):'<p style="font-size:12px;color:var(--t2)">오늘 작업 내역 없음</p>'}
    <h4>지연 현황 (${stats['지연']}건)</h4>
    ${Object.entries(D).filter(([,d])=>(d.status||'대기')==='지연').map(([sn])=>`<p style="font-size:12px">⚠️ ${esc(sn)}</p>`).join('')||'<p style="font-size:12px;color:var(--t2)">지연 없음</p>'}
  `;
  document.getElementById('reportContent').innerHTML=html;
  openModal('reportModal');
};

window.copyReport=function(){
  const el=document.getElementById('reportContent');
  if(!el)return;
  navigator.clipboard.writeText(el.innerText).then(()=>toast('보고서 복사됨','success')).catch(()=>toast('복사 실패','error'));
};

// ──────── Deadline Calculator ────────
window.openDeadlineCalc=function(){
  populateProductSelects();
  openModal('deadlineModal');
};

window.calcDeadline=function(){
  const prodKey=document.getElementById('dl_prod').value;
  const due=document.getElementById('dl_due').value;
  const res=document.getElementById('dl_result');
  const btn=document.getElementById('dl_snBtn');
  if(!prodKey||!due){res.innerHTML='';btn.style.display='none';return}

  const prod=PRODS[prodKey];
  if(!prod){res.innerHTML='<div style="color:var(--err)">제품 정보 없음</div>';return}

  const cat=prod.category||'WN';
  const heat=prod.heat||'N';
  const route=buildRoute(cat,heat);

  let html='<div class="card" style="margin:0"><div class="card-title">역산 결과</div>';
  html+='<table class="table"><thead><tr><th>공정</th><th>소요일</th><th>시작일</th><th>종료일</th></tr></thead><tbody>';

  let curEnd=due;
  let schedule=[];
  for(let i=route.length-1;i>=0;i--){
    const p=route[i];
    const days=procDays(p,cat);
    const end=curEnd;
    const start=addBD(end,-days)||end;
    schedule.unshift({proc:p,days,start,end});
    curEnd=start;
  }

  schedule.forEach(s=>{
    html+=`<tr><td><span style="color:${PROC_COLORS[s.proc]||'#666'};font-weight:600">${esc(s.proc)}</span></td><td>${s.days}일</td><td>${fmt(s.start)}</td><td>${fmt(s.end)}</td></tr>`;
  });

  html+='</tbody></table>';
  html+=`<div style="margin-top:8px;font-size:13px;font-weight:600">👉 투입 시작일: <span style="color:var(--ac2)">${fmt(schedule[0]?.start)}</span></div>`;
  html+='</div>';
  res.innerHTML=html;
  btn.style.display='inline-flex';
  btn.dataset.prod=prodKey;
  btn.dataset.start=schedule[0]?.start||'';
};

window.deadlineToSN=function(){
  const btn=document.getElementById('dl_snBtn');
  closeModal('deadlineModal');
  openSNModal();
  setTimeout(()=>{
    document.getElementById('sn_prod').value=btn.dataset.prod||'';
    document.getElementById('sn_start').value=btn.dataset.start||'';
    onSNProdChange();
    updateSNPreview();
  },100);
};

// ──────── Widget Settings ────────
window.openWidgetSettings=function(){
  const cfg=getWidgetConfig();
  const list=document.getElementById('widgetSettingsList');
  if(!list)return;
  list.innerHTML=cfg.map((w,i)=>`
    <div class="widget-setting-item" style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
      <input type="checkbox" ${w.enabled?'checked':''} onchange="widgetToggle(${i},this.checked)">
      <span style="flex:1;font-size:13px">${esc(w.name)}</span>
      <button class="btn btn-secondary btn-sm" onclick="widgetMove(${i},-1)" ${i===0?'disabled':''}>↑</button>
      <button class="btn btn-secondary btn-sm" onclick="widgetMove(${i},1)" ${i===cfg.length-1?'disabled':''}>↓</button>
    </div>
  `).join('');
  openModal('widgetModal');
};

window.widgetToggle=function(i,v){const cfg=getWidgetConfig();cfg[i].enabled=v;saveWidgetConfigToLS(cfg)};
window.widgetMove=function(i,dir){
  const cfg=getWidgetConfig();
  const j=i+dir;if(j<0||j>=cfg.length)return;
  [cfg[i],cfg[j]]=[cfg[j],cfg[i]];
  saveWidgetConfigToLS(cfg);
  openWidgetSettings();
};
window.saveWidgetConfig=function(){closeModal('widgetModal');renderHome();toast('위젯 설정 저장됨','success')};
window.resetWidgetConfig=function(){widgetConfig=null;localStorage.removeItem('esc_widgets');openWidgetSettings();toast('기본값 복원','info')};

// ──────── Settings ────────
function renderSettings(){
  const key=localStorage.getItem('esc_gemini_key');
  const ks=document.getElementById('geminiKeyStatus');
  if(ks)ks.textContent=key?'✅ API 키가 설정되어 있습니다':'❌ API 키가 설정되지 않았습니다';
  const ki=document.getElementById('geminiKeyInput');
  if(ki&&key)ki.value=key;
  const tgl=document.getElementById('themeToggle');
  if(tgl)tgl.classList.toggle('active',!isDark);
  updateDataStats();
}

window.saveGeminiKey=function(){
  const key=document.getElementById('geminiKeyInput').value.trim();
  if(!key){toast('API 키를 입력하세요','warn');return}
  localStorage.setItem('esc_gemini_key',key);
  toast('Gemini API 키 저장됨','success');
  renderSettings();
};

// ═══════════════════════════════════════════════════════════
// Workspace
// ═══════════════════════════════════════════════════════════

window.setWsView=function(v,btn){
  wsView=v;
  document.querySelectorAll('#workspaceTab .tab-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderWorkspace();
};

window.toggleFilter=function(f){
  wsFilter=f;
  document.querySelectorAll('.filter-chips .chip').forEach(c=>c.classList.toggle('active',c.dataset.f===f));
  renderWorkspace();
};

window.toggleAllGroups=function(){
  allExpanded=!allExpanded;
  Object.keys(wsGroupCollapsed).forEach(k=>wsGroupCollapsed[k]=!allExpanded);
  const btn=document.getElementById('expandAllBtn');
  if(btn)btn.textContent=allExpanded?'모두 접기':'모두 펼치기';
  renderWorkspace();
};

window.toggleGroup=function(key){
  wsGroupCollapsed[key]=!wsGroupCollapsed[key];
  renderWorkspace();
};

// [버그 #9] 워크스페이스 렌더 — 검색/필터 상태 보장 + getProc 사용
function renderWorkspace(){
  const container=document.getElementById('wsTable');
  if(!container)return;

  const search=(document.getElementById('wsSearch')?.value||'').toLowerCase();
  const entries=Object.entries(D).filter(([sn,d])=>{
    if(wsFilter!=='전체'){
      const s=d.status||'대기';
      if(wsFilter==='지연'&&s!=='지연')return false;
      if(wsFilter!=='지연'&&s!==wsFilter)return false;
    }
    if(search){
      const hay=(sn+' '+(d.productName||'')+' '+(d.customer||'')+' '+(d.batch||d.batchId||'')+' '+(d.currentProcess||'')).toLowerCase();
      if(!hay.includes(search))return false;
    }
    return true;
  });

  const sc=document.getElementById('wsSearchCount');
  if(sc)sc.textContent=search?`${entries.length}건 검색`:'';

  let groups={};
  entries.forEach(([sn,d])=>{
    let key;
    if(wsView==='batch'){
      // [버그 #1 핵심] batch → batchId → SN에서 배치부분 추출 → 기타
      key=d.batch||d.batchId||extractBatchFromSN(sn)||'기타';
    }else{
      key=d.productName||getCategory(sn)||'기타';
    }
    if(!groups[key])groups[key]=[];
    groups[key].push([sn,d]);
  });

  const sortedKeys=Object.keys(groups).sort();

  let html='';
  sortedKeys.forEach(key=>{
    const items=groups[key];
    const collapsed=wsGroupCollapsed[key];
    const doneCnt=items.filter(([,d])=>(d.status||'대기')==='완료').length;

    // [버그 #1] 그룹 헤더에 배치명 + LOT 수 표시
    const groupLabel=wsView==='batch'
      ?`${esc(key)} <span style="font-size:12px;color:var(--t2);font-weight:400">(${items.length}개 LOT)</span>`
      :esc(key);

    html+=`<div class="ws-group">
      <div class="ws-group-header" onclick="toggleGroup('${esc(key)}')" style="cursor:pointer;display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg3);border-radius:var(--r4);margin-bottom:4px;user-select:none">
        <span style="font-size:12px;transition:transform 0.2s;transform:rotate(${collapsed?'0':'90'}deg)">▶</span>
        <span style="font-weight:600;font-size:14px;flex:1">${groupLabel}</span>
        <span style="font-size:12px;color:var(--t2)">${doneCnt}/${items.length} 완료</span>
      </div>`;

    if(!collapsed){
      html+=`<div class="table-responsive"><table class="table ws-table">
        <thead><tr>
          <th style="width:30px"><input type="checkbox" onchange="toggleGroupSelect('${esc(key)}',this.checked)"></th>
          <th>S/N</th>
          <th>상태</th>
          <th>현재공정</th>
          <th>설비</th>
          <th>시작일</th>
          <th>납기</th>
          <th>진행률</th>
        </tr></thead><tbody>`;

      items.forEach(([sn,d])=>{
        const st=d.status||'대기';
        const route=getRoute(sn,d);
        const curProc=d.currentProcess||route[0]||'';
        const procData=getProc(d,curProc);
        const equip=procData.equip||'';
        const startDate=fD(procData.planStart||procData.actualStart||d.startDate);
        const endDate=fD(d.endDate);
        const progress=calcProgress(d,sn);
        const checked=selectedSNs.has(sn)?'checked':'';

        html+=`<tr class="ws-row ${st==='지연'?'row-delay':''}" data-sn="${esc(sn)}">
          <td><input type="checkbox" ${checked} onchange="toggleSNSelect('${esc(sn)}',this.checked)"></td>
          <td class="sn-cell" onclick="openSidePanel('${esc(sn)}')" style="cursor:pointer;font-weight:600;color:var(--ac2)">${esc(sn)}</td>
          <td>${statusBadge(st)}</td>
          <td class="proc-cell" onclick="showProcDropdown(event,'${esc(sn)}')" style="cursor:pointer" title="클릭하여 공정 변경">
            <span style="color:${PROC_COLORS[curProc]||'var(--t1)'};font-weight:500">${esc(curProc||'-')}</span> <span style="font-size:10px;color:var(--t2)">▼</span>
          </td>
          <td class="equip-cell" onclick="showEquipDropdown(event,'${esc(sn)}','${esc(curProc)}')" style="cursor:pointer" title="클릭하여 설비 변경">
            ${esc(equip||'-')} <span style="font-size:10px;color:var(--t2)">▼</span>
          </td>
          <td class="date-cell">
            <input type="date" value="${startDate}" onchange="updateProcStartDate('${esc(sn)}','${esc(curProc)}',this.value)" style="background:transparent;border:1px solid var(--border);color:var(--t1);border-radius:4px;padding:2px 4px;font-size:12px;width:120px">
          </td>
          <td style="font-size:12px">${fmt(endDate)}</td>
          <td>
            <div class="progress-bar-wrap" style="display:flex;align-items:center;gap:6px">
              <div class="progress-bar" style="flex:1;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden">
                <div style="width:${progress}%;height:100%;background:${progress>=100?'var(--suc)':progress>=50?'var(--ac2)':'var(--warn)'};border-radius:3px;transition:width 0.3s"></div>
              </div>
              <span style="font-size:11px;color:var(--t2);min-width:32px">${progress}%</span>
            </div>
          </td>
        </tr>`;
      });

      html+=`</tbody></table></div>`;
    }
    html+=`</div>`;
  });

  if(!sortedKeys.length){
    html='<div style="text-align:center;padding:40px;color:var(--t2)">데이터가 없습니다</div>';
  }

  container.innerHTML=html;
  updateBatchBar();
}
// ──────── Process Dropdown ────────
// [버그 #4] positionDropdown 적용 + [버그 #1] getProc 사용
window.showProcDropdown=function(event,sn){
  event.stopPropagation();
  closeAllDropdowns();
  const d=D[sn];if(!d)return;
  const route=getRoute(sn,d);
  const curProc=d.currentProcess||route[0]||'';

  const dd=document.createElement('div');
  dd.className='esc-dropdown';
  dd.style.cssText='position:fixed;z-index:9999;background:var(--bg2);border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.3);min-width:160px;max-height:300px;overflow-y:auto;padding:4px';

  route.forEach(p=>{
    const procData=getProc(d,p);
    const isCur=p===curProc;
    const st=procData.status||'대기';
    const item=document.createElement('div');
    item.style.cssText=`padding:8px 12px;cursor:pointer;border-radius:6px;display:flex;align-items:center;gap:8px;font-size:13px;${isCur?'background:rgba(99,102,241,0.15);font-weight:600':''}`;
    item.innerHTML=`<span style="width:8px;height:8px;border-radius:50%;background:${PROC_COLORS[p]||'#666'}"></span>${esc(p)}<span style="margin-left:auto;font-size:11px;color:var(--t2)">${esc(st)}</span>`;
    item.onmouseenter=()=>item.style.background='var(--bg4)';
    item.onmouseleave=()=>item.style.background=isCur?'rgba(99,102,241,0.15)':'';
    // [버그 #5] pointerup 이벤트 사용
    item.addEventListener('pointerup',async(e)=>{
      e.stopPropagation();
      dd.remove();
      if(p===curProc)return;
      try{
        const ref=fs_fn.doc(db,'production',sn);
        await fs_fn.updateDoc(ref,{currentProcess:p});
        toast(`${sn} 현재공정 → ${p}`,'success');
      }catch(err){
        // [버그 #6] 통합 에러 처리
        handleFirestoreError(err,'공정 변경');
      }
    });
    dd.appendChild(item);
  });

  document.body.appendChild(dd);
  // [버그 #4] 위치 보정
  const anchor=event.target.closest('td');
  positionDropdown(dd,anchor);

  setTimeout(()=>{
    const handler=e=>{if(!dd.contains(e.target)){dd.remove();document.removeEventListener('pointerdown',handler)}};
    document.addEventListener('pointerdown',handler);
  },0);
};

// ──────── Equipment Dropdown ────────
// [버그 #4] positionDropdown 적용 + [버그 #5] pointer event
window.showEquipDropdown=function(event,sn,proc){
  event.stopPropagation();
  closeAllDropdowns();
  const d=D[sn];if(!d)return;
  if(!proc)proc=d.currentProcess||'';
  if(!proc){toast('공정을 먼저 선택하세요','warn');return}

  const eqList=getEquipList(proc);
  if(!eqList.length){toast(`${proc} 공정의 설비 목록이 없습니다`,'warn');return}

  const curEquip=getProc(d,proc).equip||'';

  const dd=document.createElement('div');
  dd.className='esc-dropdown';
  dd.style.cssText='position:fixed;z-index:9999;background:var(--bg2);border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.3);min-width:160px;max-height:300px;overflow-y:auto;padding:4px';

  const noneItem=document.createElement('div');
  noneItem.style.cssText='padding:8px 12px;cursor:pointer;border-radius:6px;font-size:13px;color:var(--t2)';
  noneItem.textContent='— 설비 해제 —';
  noneItem.addEventListener('pointerup',async()=>{dd.remove();await saveEquip(sn,proc,'')});
  noneItem.onmouseenter=()=>noneItem.style.background='var(--bg4)';
  noneItem.onmouseleave=()=>noneItem.style.background='';
  dd.appendChild(noneItem);

  eqList.forEach(eq=>{
    const isCur=eq===curEquip;
    const item=document.createElement('div');
    item.style.cssText=`padding:8px 12px;cursor:pointer;border-radius:6px;font-size:13px;${isCur?'background:rgba(99,102,241,0.15);font-weight:600':''}`;
    item.textContent=eq+(isCur?' ✓':'');
    item.onmouseenter=()=>item.style.background='var(--bg4)';
    item.onmouseleave=()=>item.style.background=isCur?'rgba(99,102,241,0.15)':'';
    item.addEventListener('pointerup',async()=>{dd.remove();await saveEquip(sn,proc,eq)});
    dd.appendChild(item);
  });

  document.body.appendChild(dd);
  const anchor=event.target.closest('td');
  positionDropdown(dd,anchor);

  setTimeout(()=>{
    const handler=e=>{if(!dd.contains(e.target)){dd.remove();document.removeEventListener('pointerdown',handler)}};
    document.addEventListener('pointerdown',handler);
  },0);
};

// [버그 #6] saveEquip — 통합 에러 처리
async function saveEquip(sn,proc,eq){
  try{
    const ref=fs_fn.doc(db,'production',sn);
    await fs_fn.updateDoc(ref,{[`processes.${proc}.equip`]:eq});
    toast(`${sn} ${proc} 설비 → ${eq||'해제'}`,'success');
  }catch(err){handleFirestoreError(err,'설비 변경')}
}

// ──────── Inline Date Edit ────────
// [버그 #1] getProc 사용 + [버그 #6] 에러 처리
window.updateProcStartDate=async function(sn,proc,dateVal){
  if(!dateVal)return;
  const d=D[sn];if(!d)return;
  const cat=getCategory(sn);
  const days=procDays(proc,cat);
  const planEnd=addBD(dateVal,days);

  try{
    const ref=fs_fn.doc(db,'production',sn);
    const updates={};
    updates[`processes.${proc}.planStart`]=dateVal;
    updates[`processes.${proc}.planEnd`]=planEnd;
    const curSt=getProc(d,proc).status||'대기';
    if(curSt==='대기'){
      updates[`processes.${proc}.status`]='진행';
      updates[`processes.${proc}.actualStart`]=dateVal;
    }
    await fs_fn.updateDoc(ref,updates);
    toast(`${sn} ${proc} 시작일 → ${fmt(dateVal)} (종료: ${fmt(planEnd)})`,'success');
  }catch(err){handleFirestoreError(err,'날짜 변경')}
};

function closeAllDropdowns(){
  document.querySelectorAll('.esc-dropdown').forEach(d=>d.remove());
}

// ──────── Selection & Batch Operations ────────
window.toggleSNSelect=function(sn,checked){
  if(checked)selectedSNs.add(sn);else selectedSNs.delete(sn);
  updateBatchBar();
};

window.toggleGroupSelect=function(key,checked){
  const entries=Object.entries(D);
  entries.forEach(([sn,d])=>{
    let gk;
    if(wsView==='batch')gk=d.batch||sn.replace(/-\d+$/,'')||'기타';
    else gk=d.productName||getCategory(sn)||'기타';
    if(gk===key){
      if(checked)selectedSNs.add(sn);else selectedSNs.delete(sn);
    }
  });
  renderWorkspace();
};

window.clearSelection=function(){selectedSNs.clear();renderWorkspace()};

function updateBatchBar(){
  const bar=document.getElementById('batchBar');
  const cnt=document.getElementById('batchCount');
  if(!bar||!cnt)return;
  if(selectedSNs.size>0){
    bar.style.display='flex';
    cnt.textContent=`${selectedSNs.size}건 선택`;
  }else{
    bar.style.display='none';
  }
}

// [버그 #6] 일괄 처리 — 통합 에러 처리
window.applyBatch=async function(){
  const status=document.getElementById('batchStatusSel').value;
  if(!status){toast('상태를 선택하세요','warn');return}
  if(!selectedSNs.size){toast('선택된 항목이 없습니다','warn');return}

  try{
    const batch=fs_fn.writeBatch(db);
    selectedSNs.forEach(sn=>{
      const ref=fs_fn.doc(db,'production',sn);
      batch.update(ref,{status});
    });
    await batch.commit();
    toast(`${selectedSNs.size}건 상태 → ${status}`,'success');
    selectedSNs.clear();
  }catch(err){handleFirestoreError(err,'일괄 상태 변경')}
};

window.applyNG=async function(){
  if(!selectedSNs.size){toast('선택된 항목이 없습니다','warn');return}
  if(!confirm(`${selectedSNs.size}건을 NG(폐기) 처리하시겠습니까?`))return;

  try{
    const batch=fs_fn.writeBatch(db);
    selectedSNs.forEach(sn=>{
      const ref=fs_fn.doc(db,'production',sn);
      batch.update(ref,{status:'폐기'});
    });
    await batch.commit();
    toast(`${selectedSNs.size}건 NG 처리 완료`,'success');
    selectedSNs.clear();
  }catch(err){handleFirestoreError(err,'NG 처리')}
};

window.generateBatchQR=async function(){
  if(!selectedSNs.size){toast('선택된 항목이 없습니다','warn');return}
  const grid=document.getElementById('qrPrintGrid');
  if(!grid)return;
  grid.innerHTML='';

  for(const sn of selectedSNs){
    const wrap=document.createElement('div');
    wrap.className='qr-print-item';
    wrap.innerHTML=`<div id="qr_${sn.replace(/[^a-zA-Z0-9]/g,'_')}" style="margin-bottom:4px"></div><div style="font-size:10px;font-family:monospace;word-break:break-all">${esc(sn)}</div>`;
    grid.appendChild(wrap);
  }

  openModal('qrPrintModal');

  if(typeof QRCode!=='undefined'){
    for(const sn of selectedSNs){
      const el=document.getElementById('qr_'+sn.replace(/[^a-zA-Z0-9]/g,'_'));
      if(el){
        try{
          const canvas=document.createElement('canvas');
          await QRCode.toCanvas(canvas,sn,{width:100,margin:1});
          el.appendChild(canvas);
        }catch(e){}
      }
    }
  }
};

// ═══════════════════════════════════════════════════════════
// Calendar, Gantt, Analysis
// ═══════════════════════════════════════════════════════════

// ──────── Calendar ────────
window.setCalView=function(v,btn){
  calView=v;
  document.querySelectorAll('#calendarTab .tab-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderCalendar();
};
window.calPrev=function(){
  if(calView==='week'){calDate.setDate(calDate.getDate()-7)}
  else{calDate.setMonth(calDate.getMonth()-1)}
  renderCalendar();
};
window.calNext=function(){
  if(calView==='week'){calDate.setDate(calDate.getDate()+7)}
  else{calDate.setMonth(calDate.getMonth()+1)}
  renderCalendar();
};
window.calToday=function(){calDate=new Date();renderCalendar()};

// [버그 #1] 캘린더 — getProc 사용
function renderCalendar(){
  const el=document.getElementById('calContent');
  if(!el)return;
  document.getElementById('calTitle').textContent=`${calDate.getFullYear()}년 ${calDate.getMonth()+1}월`;

  if(calView==='issues'){renderIssueBoard(el);return}
  if(calView==='week'){renderWeekView(el);return}

  const y=calDate.getFullYear(),m=calDate.getMonth();
  const first=new Date(y,m,1),last=new Date(y,m+1,0);
  const startDay=first.getDay();
  const totalDays=last.getDate();
  const today=todayStr();

  // [버그 #3] 이벤트 수집 — equip 필드 추가
  let events={};
  Object.entries(D).forEach(([sn,d])=>{
    const route=getRoute(sn,d);
    route.forEach(p=>{
      const pr=getProc(d,p);
      const equipStr=pr.equip||'';
      const ps=fD(pr.planStart||pr.actualStart);
      const pe=fD(pr.planEnd||pr.actualEnd);
      const ae=fD(pr.actualEnd);
      if(ps){if(!events[ps])events[ps]=[];events[ps].push({sn,proc:p,type:'시작',status:pr.status||'대기',equip:equipStr,productName:d.productName||''})}
      if(pe){if(!events[pe])events[pe]=[];events[pe].push({sn,proc:p,type:'예정종료',status:pr.status||'대기',equip:equipStr,productName:d.productName||''})}
      if(ae&&ae!==pe){if(!events[ae])events[ae]=[];events[ae].push({sn,proc:p,type:'완료',status:'완료',equip:equipStr,productName:d.productName||''})}
    });
    const due=fD(d.endDate);
    if(due){if(!events[due])events[due]=[];events[due].push({sn,proc:'납기',type:'마감',status:d.status||'대기',equip:'',productName:d.productName||''})}
  });

  let statStart=0,statEnd=0,statDue=0,eventDays=new Set();
  Object.entries(events).forEach(([date,evts])=>{
    const ds=date.split('-');
    if(parseInt(ds[0])===y&&parseInt(ds[1])===m+1){
      eventDays.add(date);
      evts.forEach(e=>{if(e.type==='시작')statStart++;if(e.type==='완료')statEnd++;if(e.type==='마감')statDue++});
    }
  });

  let html=`<div class="cal-stats" style="display:flex;gap:12px;margin-bottom:12px;flex-wrap:wrap">
    <span class="badge badge-prog" style="font-size:12px">시작 ${statStart}</span>
    <span class="badge badge-done" style="font-size:12px">완료 ${statEnd}</span>
    <span class="badge badge-delay" style="font-size:12px">마감 ${statDue}</span>
    <span style="font-size:12px;color:var(--t2)">${eventDays.size}일 이벤트</span>
  </div>`;

  html+='<div class="cal-grid">';
  ['일','월','화','수','목','금','토'].forEach(d=>{
    html+=`<div class="cal-dow">${d}</div>`;
  });

  for(let i=0;i<startDay;i++)html+=`<div class="cal-cell cal-empty"></div>`;

  for(let day=1;day<=totalDays;day++){
    const dateStr=`${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const isToday=dateStr===today;
    const dayEvents=events[dateStr]||[];
    const isWeekend=(new Date(y,m,day).getDay()===0||new Date(y,m,day).getDay()===6);

    html+=`<div class="cal-cell ${isToday?'cal-today':''} ${isWeekend?'cal-weekend':''}" onclick="openCalDayModal('${dateStr}')" style="cursor:pointer">
      <div class="cal-day-num" style="${isToday?'background:var(--ac2);color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:700':''}">${day}</div>
      <div class="cal-events" style="display:flex;flex-wrap:wrap;gap:2px;margin-top:2px">`;

    dayEvents.slice(0,3).forEach(ev=>{
      const color=ev.proc==='납기'?'#ef4444':(PROC_COLORS[ev.proc]||'#6366f1');
      const icon=ev.type==='마감'?'●':ev.type==='완료'?'✓':'';
      // [버그 #3 핵심] 공정 + 설비 결합 표시
      const label=ev.equip?`${ev.proc} ${ev.equip}`:ev.proc;
      html+=`<div style="width:100%;font-size:9px;padding:1px 3px;border-radius:2px;background:${color}22;color:${color};overflow:hidden;white-space:nowrap;text-overflow:ellipsis" title="${esc(label)}">${icon}${esc(label)}</div>`;
    });
    if(dayEvents.length>3)html+=`<div style="font-size:9px;color:var(--t2)">+${dayEvents.length-3}</div>`;

    html+=`</div></div>`;
  }

  html+=`</div><div class="cal-legend" style="display:flex;gap:16px;margin-top:12px;font-size:11px;color:var(--t2)">`;
  PROC_ORDER.forEach(p=>{html+=`<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${PROC_COLORS[p]};margin-right:4px"></span>${p}</span>`});
  html+=`<span><span style="color:#ef4444;margin-right:4px">●</span>납기</span>`;
  html+=`<span><span style="color:var(--suc);margin-right:4px">✓</span>완료</span>`;
  html+=`</div>`;

  el.innerHTML=html;
}
// [버그 #1] 캘린더 일간 모달 — getProc 사용
window.openCalDayModal=function(dateStr){

  // 1) 이벤트 수집 (equip 포함)
  let events=[];
  Object.entries(D).forEach(([sn,d])=>{
    const route=getRoute(sn,d);
    const prodName=d.productName||getCategory(sn)||'기타';
    route.forEach(p=>{
      const pr=getProc(d,p);
      const equipStr=pr.equip||'';
      if(fD(pr.planStart)===dateStr||fD(pr.actualStart)===dateStr)
        events.push({sn,proc:p,action:'시작',status:pr.status||'대기',equip:equipStr,productName:prodName});
      if(fD(pr.planEnd)===dateStr)
        events.push({sn,proc:p,action:'예정종료',status:pr.status||'대기',equip:equipStr,productName:prodName});
      if(fD(pr.actualEnd)===dateStr)
        events.push({sn,proc:p,action:'완료',status:'완료',equip:equipStr,productName:prodName});
    });
    if(fD(d.endDate)===dateStr)
      events.push({sn,proc:'납기',action:'마감',status:d.status||'대기',equip:'',productName:prodName});
  });

  const dayIssues=ISSUES.filter(is=>fD(is.date)===dateStr);

  let html=`<div class="modal-header"><div class="modal-title">📅 ${fmt(dateStr)}</div><button class="modal-close btn-icon" onclick="closeModal('reportModal')">✕</button></div>`;

  if(events.length){
    const grouped={};
    events.forEach(e=>{if(!grouped[e.action])grouped[e.action]=[];grouped[e.action].push(e)});
    const icons={시작:'🟢',완료:'✅',예정종료:'📋',마감:'🔴'};
    Object.entries(grouped).forEach(([action,evts])=>{
      html+=`<div style="margin-bottom:12px"><div style="font-weight:600;font-size:13px;margin-bottom:6px">${icons[action]||''} ${esc(action)} (${evts.length})</div>`;
      evts.forEach(e=>{
        html+=`<div style="padding:6px 10px;margin-bottom:4px;background:var(--bg4);border-radius:6px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:8px;border-left:3px solid ${PROC_COLORS[e.proc]||'#ef4444'}" onclick="closeModal('reportModal');openSidePanel('${esc(e.sn)}')">
          <span style="font-weight:600">${esc(e.sn)}</span>
          <span style="color:${PROC_COLORS[e.proc]||'#666'}">${esc(e.proc)}</span>
          ${statusBadge(e.status)}
        </div>`;
      });
      html+=`</div>`;
    });
  }

  if(dayIssues.length){
    html+=`<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px"><div style="font-weight:600;font-size:13px;margin-bottom:6px">🚨 이슈 (${dayIssues.length})</div>`;
    dayIssues.forEach(is=>{
      html+=`<div style="padding:6px 10px;margin-bottom:4px;background:rgba(239,68,68,0.08);border-radius:6px;font-size:12px"><strong>${esc(is.type||'')}</strong> ${esc(is.content||'')}</div>`;
    });
    html+=`</div>`;
  }

  if(!events.length&&!dayIssues.length){
    html+=`<div style="text-align:center;padding:20px;color:var(--t2)">이 날의 이벤트가 없습니다</div>`;
  }

  document.getElementById('reportContent').innerHTML=html;
  openModal('reportModal');
};

// [버그 #1] 주간 뷰 — getProc 사용
function renderWeekView(el){
  const d=new Date(calDate);
  const dayOfWeek=d.getDay();
  d.setDate(d.getDate()-dayOfWeek);
  const today=todayStr();

  let html='<div class="week-view">';
  for(let i=0;i<7;i++){
    const cur=new Date(d);cur.setDate(cur.getDate()+i);
    const dateStr=cur.toISOString().split('T')[0];
    const isToday=dateStr===today;
    const dayName=['일','월','화','수','목','금','토'][i];

    let dayEvents=[];
    Object.entries(D).forEach(([sn,dd])=>{
      const route=getRoute(sn,dd);
      route.forEach(p=>{
        const pr=getProc(dd,p);
        if(fD(pr.planStart)===dateStr||fD(pr.actualStart)===dateStr||fD(pr.planEnd)===dateStr||fD(pr.actualEnd)===dateStr){
          dayEvents.push({sn,proc:p,data:pr});
        }
      });
    });

    html+=`<div class="week-day ${isToday?'week-today':''}" style="border:1px solid var(--border);border-radius:8px;padding:10px;${isToday?'border-color:var(--ac2)':''}">
      <div style="font-weight:600;font-size:13px;margin-bottom:6px">${dayName} ${cur.getDate()}일</div>`;
    dayEvents.forEach(ev=>{
      html+=`<div style="font-size:11px;padding:3px 6px;margin-bottom:3px;border-radius:4px;background:${PROC_COLORS[ev.proc]||'#666'}22;color:${PROC_COLORS[ev.proc]||'var(--t1)'};cursor:pointer" onclick="openSidePanel('${esc(ev.sn)}')">${esc(ev.sn)} / ${esc(ev.proc)}</div>`;
    });
    if(!dayEvents.length)html+=`<div style="font-size:11px;color:var(--t2)">일정 없음</div>`;
    html+=`</div>`;
  }
  html+='</div>';
  el.innerHTML=html;
}

function renderIssueBoard(el){
  const types=['메모','지시','불량','폐기','기타'];
  let html='<div class="issue-board" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px">';
  types.forEach(type=>{
    const items=ISSUES.filter(is=>(is.type||'기타')===type);
    html+=`<div class="card"><div class="card-title">${esc(type)} (${items.length})</div>`;
    items.slice(0,10).forEach(is=>{
      html+=`<div style="padding:6px;margin-bottom:4px;background:var(--bg4);border-radius:6px;font-size:12px">
        <div style="color:var(--t2);font-size:10px">${fmt(fD(is.date))}</div>
        <div>${esc(is.content||'-')}</div>
        ${is.sn?`<div style="font-size:10px;color:var(--ac2)">${esc(is.sn)}</div>`:''}
      </div>`;
    });
    html+='</div>';
  });
  html+='</div>';
  el.innerHTML=html;
}

// ──────── Gantt ────────
// [버그 #1] 간트 차트 — getProc 사용 전반 적용
window.setGanttView=function(v,btn){
  ganttView=v;
  document.querySelectorAll('.gantt-view-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderGantt();
};
window.ganttZoom=function(delta){ganttDayW=Math.max(8,Math.min(60,ganttDayW+delta));document.getElementById('ganttZoomLabel').textContent=ganttDayW+'px';renderGantt()};
window.ganttGoToday=function(){renderGantt();setTimeout(()=>{const tw=document.getElementById('ganttBodyWrap');const hw=document.getElementById('ganttHeaderWrap');if(!tw)return;const el=tw.querySelector('.gantt-today-line');if(el){const left=parseInt(el.style.left);tw.scrollLeft=left-200;if(hw)hw.scrollLeft=left-200}},100)};
window.ganttToggleAll=function(){ganttAllExpanded=!ganttAllExpanded;Object.keys(ganttCollapsed).forEach(k=>ganttCollapsed[k]=!ganttAllExpanded);document.getElementById('ganttExpandAllBtn').textContent=ganttAllExpanded?'모두 접기':'모두 펼치기';renderGantt()};

// [버그 #5] 간트차트 바 미표시 — 날짜 폴백 강화 + 디버그 로그 + 최소 바 너비 보장
// renderGantt() 함수 전체 교체
function renderGantt(){
  // 필터 UI
  const prodFilter=document.getElementById('ganttProdFilter');
  const statusFilter=document.getElementById('ganttStatusFilter');
  if(prodFilter){
    const curVal=prodFilter.value;
    const prods=new Set();
    Object.values(D).forEach(d=>{if(d.productName)prods.add(d.productName)});
    prodFilter.innerHTML='<option value="">전체 제품</option>'+[...prods].sort().map(p=>`<option value="${esc(p)}">${esc(p)}</option>`).join('');
    prodFilter.value=curVal;
  }

  const entries=Object.entries(D).filter(([sn,d])=>{
    if(prodFilter&&prodFilter.value&&d.productName!==prodFilter.value)return false;
    if(statusFilter&&statusFilter.value&&(d.status||'대기')!==statusFilter.value)return false;
    return true;
  });

  // ──── [버그 #5] 디버그 로그: 첫 3개 문서의 날짜 필드 확인 ────
  entries.slice(0,3).forEach(([sn,d])=>{
    const route=getRoute(sn,d);
    console.group(`🔍 [Gantt Debug] ${sn}`);
    console.log('  startDate(raw):', d.startDate, '→ fD:', fD(d.startDate));
    console.log('  endDate(raw):', d.endDate, '→ fD:', fD(d.endDate));
    route.forEach(p=>{
      const pr=getProc(d,p);
      console.log(`  ${p}:`, {
        planStart_raw: pr.planStart, planStart_fD: fD(pr.planStart),
        planEnd_raw: pr.planEnd, planEnd_fD: fD(pr.planEnd),
        actualStart_raw: pr.actualStart, actualStart_fD: fD(pr.actualStart),
        actualEnd_raw: pr.actualEnd, actualEnd_fD: fD(pr.actualEnd)
      });
    });
    console.groupEnd();
  });

  // ──── 날짜 범위 계산 ────
  // [버그 #5] processes 날짜뿐 아니라 문서 레벨 startDate/endDate도 적극 활용
  let minDate=null,maxDate=null;

  function updateRange(ds){
    if(!ds)return;
    if(!minDate||ds<minDate)minDate=ds;
    if(!maxDate||ds>maxDate)maxDate=ds;
  }

  entries.forEach(([sn,d])=>{
    // 문서 레벨 날짜 먼저 체크
    updateRange(fD(d.startDate));
    updateRange(fD(d.endDate));
    updateRange(fD(d.createdAt));

    // processes 날짜
    const route=getRoute(sn,d);
    route.forEach(procName=>{
      const p=getProc(d,procName);
      updateRange(fD(p.planStart));
      updateRange(fD(p.actualStart));
      updateRange(fD(p.planEnd));
      updateRange(fD(p.actualEnd));
    });
  });

  if(!minDate)minDate=todayStr();
  if(!maxDate)maxDate=todayStr();

  console.log(`📊 [Gantt] 날짜 범위: ${minDate} ~ ${maxDate}, 문서 ${entries.length}개`);

  const pad=14;
  let startD=new Date(minDate+'T00:00:00');startD.setDate(startD.getDate()-pad);
  let endD=new Date(maxDate+'T00:00:00');endD.setDate(endD.getDate()+pad);
  const totalDays=Math.round((endD-startD)/(86400000))+1;
  const totalW=totalDays*ganttDayW;
  const today=todayStr();

  const header=document.getElementById('ganttHeader');
  const sidebar=document.getElementById('ganttSidebar');
  const body=document.getElementById('ganttBody');
  if(!header||!sidebar||!body)return;

  header.style.width=totalW+'px';
  body.style.width=totalW+'px';

  // ──── 헤더 ────
  let headerHtml='';
  let curMonth='';
  for(let i=0;i<totalDays;i++){
    const d=new Date(startD);d.setDate(d.getDate()+i);
    const ds=d.toISOString().split('T')[0];
    const monthLabel=`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}`;
    const isWe=d.getDay()===0||d.getDay()===6;
    const isToday=ds===today;

    if(monthLabel!==curMonth){
      curMonth=monthLabel;
      headerHtml+=`<div class="gantt-month" style="position:absolute;left:${i*ganttDayW}px;top:0;font-size:10px;font-weight:600;color:var(--t2);padding:2px 4px">${monthLabel}</div>`;
    }
    headerHtml+=`<div class="gantt-day" style="position:absolute;left:${i*ganttDayW}px;top:16px;width:${ganttDayW}px;text-align:center;font-size:9px;color:${isToday?'var(--ac2)':isWe?'var(--err)':'var(--t2)'};${isToday?'font-weight:700':''}">${d.getDate()}</div>`;
  }
  header.innerHTML=headerHtml;
  header.style.height='32px';

  // ──── 행 구성 ────
  let rows=[];
  if(ganttView==='process'){
    PROC_ORDER.forEach(proc=>{
      const procEntries=entries.filter(([sn,d])=>{
        const pr=getProc(d,proc);
        // 해당 공정에 날짜가 있거나 상태가 대기가 아닌 경우
        return fD(pr.planStart)||fD(pr.actualStart)||fD(pr.planEnd)||fD(pr.actualEnd)||(pr.status&&pr.status!=='대기');
      });
      if(procEntries.length){
        rows.push({type:'group',label:proc,count:procEntries.length,key:'proc_'+proc});
        if(!ganttCollapsed['proc_'+proc]){
          procEntries.forEach(([sn,d])=>rows.push({type:'item',sn,d,proc}));
        }
      }
    });
  }else{
    let groups={};
    entries.forEach(([sn,d])=>{
      const key=ganttView==='batch'?(d.batch||d.batchId||extractBatchFromSN(sn)||'기타'):(d.productName||getCategory(sn)||'기타');
      if(!groups[key])groups[key]=[];
      groups[key].push([sn,d]);
    });
    Object.keys(groups).sort().forEach(key=>{
      rows.push({type:'group',label:key,count:groups[key].length,key:'g_'+key});
      if(!ganttCollapsed['g_'+key]){
        groups[key].forEach(([sn,d])=>rows.push({type:'item',sn,d}));
      }
    });
  }

  // ──── 사이드바 ────
  let sbHtml='';
  rows.forEach(row=>{
    if(row.type==='group'){
      const col=ganttCollapsed[row.key];
      sbHtml+=`<div class="gantt-sb-group" onclick="ganttCollapsed['${row.key}']=!ganttCollapsed['${row.key}'];renderGantt()" style="cursor:pointer;padding:6px 8px;font-weight:600;font-size:12px;background:var(--bg3);display:flex;align-items:center;gap:4px;height:28px;box-sizing:border-box">
        <span style="font-size:10px;transform:rotate(${col?'0':'90'}deg);transition:transform 0.2s">▶</span>${esc(row.label)} <span style="color:var(--t2);font-weight:400">(${row.count})</span>
      </div>`;
    }else{
      sbHtml+=`<div class="gantt-sb-item" onclick="openSidePanel('${esc(row.sn)}')" style="cursor:pointer;padding:4px 8px;font-size:11px;height:28px;box-sizing:border-box;display:flex;align-items:center;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;border-bottom:1px solid var(--border)">${esc(row.sn)}</div>`;
    }
  });
  sidebar.innerHTML=sbHtml;

  // ──── 바디 (바 렌더링) ────
  let bodyHtml='';

  // 오늘 라인
  const todayIdx=Math.round((new Date(today+'T00:00:00')-startD)/86400000);
  bodyHtml+=`<div class="gantt-today-line" style="position:absolute;left:${todayIdx*ganttDayW}px;top:0;width:2px;height:100%;background:var(--ac2);opacity:0.5;z-index:1"></div>`;

  // 주말 배경
  for(let i=0;i<totalDays;i++){
    const d=new Date(startD);d.setDate(d.getDate()+i);
    if(d.getDay()===0||d.getDay()===6){
      bodyHtml+=`<div style="position:absolute;left:${i*ganttDayW}px;top:0;width:${ganttDayW}px;height:100%;background:rgba(255,255,255,0.02)"></div>`;
    }
  }

  let rowY=0;
  let barCount=0; // 디버그용 카운터

  rows.forEach(row=>{
    if(row.type==='group'){
      bodyHtml+=`<div style="position:absolute;left:0;top:${rowY}px;width:100%;height:28px;background:var(--bg3)"></div>`;
      rowY+=28;
    }else{
      const d=row.d;
      const route=getRoute(row.sn,d);
      const singleProc=row.proc; // process 뷰일 때만 설정됨

      const procsToShow=singleProc?[singleProc]:route;

      // [버그 #5 핵심] 문서 레벨 날짜를 최종 폴백으로 사용
      const docStart=fD(d.startDate)||fD(d.createdAt)||'';
      const docEnd=fD(d.endDate)||'';

      let hasBar=false;

      procsToShow.forEach(proc=>{
        const pr=getProc(d,proc);

        // [버그 #5] 날짜 결정 로직 강화
        let ps=fD(pr.planStart)||fD(pr.actualStart)||fD(pr.startDate);
        let pe=fD(pr.planEnd)||fD(pr.actualEnd)||fD(pr.endDate);

        // 공정 레벨 날짜가 전혀 없으면 문서 레벨로 폴백
        if(!ps)ps=docStart;
        if(!pe)pe=docEnd;

        // 시작일만 있고 종료일 없으면 시작일 사용 (최소 1일 바)
        if(ps&&!pe)pe=ps;
        // 종료일만 있고 시작일 없으면 종료일 사용
        if(!ps&&pe)ps=pe;
        // 둘 다 없으면 이 공정은 스킵
        if(!ps)return;

        const si=Math.round((new Date(ps+'T00:00:00')-startD)/86400000);
        const ei=Math.round((new Date(pe+'T00:00:00')-startD)/86400000);
        const left=si*ganttDayW;
        // [버그 #5] 최소 1일 너비 보장
        const width=Math.max((ei-si+1)*ganttDayW,ganttDayW);
        const color=PROC_COLORS[proc]||'#6366f1';
        const st=pr.status||'대기';
        const opacity=st==='완료'?0.6:1;

        bodyHtml+=`<div class="gantt-bar" style="position:absolute;left:${left}px;top:${rowY+4}px;width:${width}px;height:20px;background:${color};border-radius:4px;opacity:${opacity};cursor:pointer;display:flex;align-items:center;padding:0 4px;overflow:hidden;z-index:2" title="${esc(row.sn)} / ${esc(proc)} / ${esc(st)} / ${ps}~${pe}" onclick="openSidePanel('${esc(row.sn)}')">
          <span style="font-size:9px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(proc)}${pr.equip?' · '+esc(pr.equip):''}</span>
        </div>`;
        hasBar=true;
        barCount++;
      });

      // [버그 #5] 공정 날짜가 전혀 없지만 문서 레벨 날짜가 있는 경우 — 전체 기간 바 하나로 표시
      if(!hasBar&&docStart){
        const fallbackEnd=docEnd||docStart;
        const si=Math.round((new Date(docStart+'T00:00:00')-startD)/86400000);
        const ei=Math.round((new Date(fallbackEnd+'T00:00:00')-startD)/86400000);
        const left=si*ganttDayW;
        const width=Math.max((ei-si+1)*ganttDayW,ganttDayW);

        bodyHtml+=`<div class="gantt-bar" style="position:absolute;left:${left}px;top:${rowY+4}px;width:${width}px;height:20px;background:#6366f1;border-radius:4px;opacity:0.4;cursor:pointer;display:flex;align-items:center;padding:0 4px;overflow:hidden;z-index:2;border:1px dashed rgba(255,255,255,0.3)" title="${esc(row.sn)} (날짜 폴백: ${docStart}~${fallbackEnd})" onclick="openSidePanel('${esc(row.sn)}')">
          <span style="font-size:9px;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(row.sn)}</span>
        </div>`;
        barCount++;
      }

      bodyHtml+=`<div style="position:absolute;left:0;top:${rowY+28}px;width:100%;height:1px;background:var(--border);opacity:0.3"></div>`;
      rowY+=28;
    }
  });

  body.style.height=rowY+'px';
  body.innerHTML=bodyHtml;

  console.log(`📊 [Gantt] 렌더링 완료: ${rows.length}행, ${barCount}개 바`);

  // 스크롤 동기화
  const bw=document.getElementById('ganttBodyWrap');
  const hw=document.getElementById('ganttHeaderWrap');
  if(bw&&hw){
    bw.onscroll=()=>{hw.scrollLeft=bw.scrollLeft};
  }
}

// ──────── Analysis ────────
function renderAnalysis(){
  const kpi=document.getElementById('analysisKpi');
  if(kpi){
    const total=Object.keys(D).length;
    let done=0,prog=0,delayed=0;
    Object.values(D).forEach(d=>{const s=d.status||'대기';if(s==='완료')done++;if(s==='진행')prog++;if(s==='지연')delayed++});
    const rate=total?Math.round(done/total*100):0;
    kpi.innerHTML=`
      <div class="kpi-card"><div class="kpi-val">${total}</div><div class="kpi-lbl">전체</div></div>
      <div class="kpi-card"><div class="kpi-val" style="color:var(--ac2)">${prog}</div><div class="kpi-lbl">진행</div></div>
      <div class="kpi-card"><div class="kpi-val" style="color:var(--suc)">${rate}%</div><div class="kpi-lbl">완료율</div></div>
      <div class="kpi-card"><div class="kpi-val" style="color:var(--err)">${delayed}</div><div class="kpi-lbl">지연</div></div>
    `;
  }
  drawAnalysisCharts();
}

function drawAnalysisCharts(){
  drawBarChart('prodBarChart',()=>{
    const map={};
    Object.values(D).forEach(d=>{const p=d.productName||'기타';map[p]=(map[p]||0)+1});
    return{labels:Object.keys(map),values:Object.values(map),color:'#6366f1'};
  });

  drawDonutChart('analysisDonut');

  drawBarChart('monthLineChart',()=>{
    const months={};
    for(let i=5;i>=0;i--){
      const d=new Date();d.setMonth(d.getMonth()-i);
      const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      months[key]={in:0,out:0};
    }
    Object.values(D).forEach(d=>{
      const sd=fD(d.startDate||d.createdAt);
      if(sd){const m=sd.substring(0,7);if(months[m])months[m].in++}
      if((d.status||'대기')==='완료'){
        const cd=fD(d.completedAt||d.updatedAt);
        if(cd){const m=cd.substring(0,7);if(months[m])months[m].out++}
      }
    });
    const labels=Object.keys(months).map(k=>k.split('-')[1]+'월');
    return{labels,values:Object.values(months).map(v=>v.in),values2:Object.values(months).map(v=>v.out),color:'#6366f1',color2:'#10b981',legend:['투입','완료']};
  });

  // [버그 #1] 리드타임 차트 — getProc 사용
  drawBarChart('leadtimeChart',()=>{
    const plan={},actual={};
    PROC_ORDER.forEach(p=>{plan[p]=[];actual[p]=[]});
    Object.entries(D).forEach(([sn,d])=>{
      const cat=getCategory(sn);
      const route=getRoute(sn,d);
      route.forEach(p=>{
        if(!plan[p])plan[p]=[];
        if(!actual[p])actual[p]=[];
        plan[p].push(procDays(p,cat));
        const pr=getProc(d,p);
        if(pr.actualDays)actual[p].push(pr.actualDays);
      });
    });
    const labels=PROC_ORDER;
    const v1=labels.map(p=>(plan[p]&&plan[p].length)?Math.round(plan[p].reduce((a,b)=>a+b,0)/plan[p].length*10)/10:0);
    const v2=labels.map(p=>(actual[p]&&actual[p].length)?Math.round(actual[p].reduce((a,b)=>a+b,0)/actual[p].length*10)/10:0);
    return{labels,values:v1,values2:v2,color:'#6366f1',color2:'#f59e0b',legend:['계획','실제']};
  });

  // [버그 #1] 불량률 차트 — getProc 사용
  drawBarChart('defectRateChart',()=>{
    const prodDefect={};
    Object.entries(D).forEach(([sn,d])=>{
      const pn=d.productName||'기타';
      if(!prodDefect[pn])prodDefect[pn]={total:0,defect:0};
      prodDefect[pn].total++;
      const route=getRoute(sn,d);
      route.forEach(p=>{
        const pr=getProc(d,p);
        if(pr.defect&&pr.defect!=='')prodDefect[pn].defect++;
      });
    });
    const labels=Object.keys(prodDefect);
    const values=labels.map(l=>prodDefect[l].total?Math.round(prodDefect[l].defect/prodDefect[l].total*100):0);
    return{labels,values,color:'#ef4444'};
  });

  // [버그 #1] 공정별 불량 — getProc 사용
  drawBarChart('defectProcChart',()=>{
    const procDef={};
    PROC_ORDER.forEach(p=>procDef[p]=0);
    Object.values(D).forEach(d=>{
      const route=getRoute('',d);
      route.forEach(p=>{
        const pr=getProc(d,p);
        if(pr.defect&&pr.defect!==''){procDef[p]=(procDef[p]||0)+1}
      });
    });
    return{labels:PROC_ORDER,values:PROC_ORDER.map(p=>procDef[p]||0),colors:PROC_ORDER.map(p=>PROC_COLORS[p])};
  });
}

// [버그 #7] drawBarChart — 빈 데이터 처리
function drawBarChart(canvasId,dataFn){
  const canvas=document.getElementById(canvasId);
  if(!canvas)return;

  const data=dataFn();
  const{labels,values}=data;

  // 빈 데이터 체크
  if(!labels||!labels.length||!values||values.every(v=>v===0)){
    if(handleEmptyChart(canvas,[],'데이터가 없습니다'))return;
  }

  const ctx=canvas.getContext('2d');
  const w=canvas.width=canvas.parentElement.clientWidth-32;
  const h=canvas.height=240;
  ctx.clearRect(0,0,w,h);

  const values2=data.values2;
  const colors=data.colors;
  const max=Math.max(...values,...(values2||[]),1);
  const chartH=h-50;
  const baseY=chartH+10;
  const groupW=(w-60)/labels.length;
  const barW=values2?(groupW-8)/2:(groupW-8);

  labels.forEach((label,i)=>{
    const x=40+i*groupW;
    const h1=values[i]/max*chartH;
    ctx.fillStyle=colors?colors[i]:(data.color||'#6366f1');
    ctx.fillRect(x,baseY-h1,barW,h1);

    if(values2){
      const h2=values2[i]/max*chartH;
      ctx.fillStyle=data.color2||'#10b981';
      ctx.fillRect(x+barW+2,baseY-h2,barW,h2);
    }

    ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--t2').trim()||'#999';
    ctx.font='10px Noto Sans KR';ctx.textAlign='center';
    ctx.fillText(values[i],x+barW/2,baseY-values[i]/max*chartH-4);
    ctx.fillText(label,x+groupW/2-4,baseY+14);
  });

  if(data.legend){
    let lx=w-140;
    ctx.fillStyle=data.color||'#6366f1';ctx.fillRect(lx,6,10,10);
    ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--t2').trim();ctx.font='11px Noto Sans KR';ctx.textAlign='left';ctx.fillText(data.legend[0],lx+14,15);
    lx+=60;
    ctx.fillStyle=data.color2||'#10b981';ctx.fillRect(lx,6,10,10);
    ctx.fillStyle=getComputedStyle(document.body).getPropertyValue('--t2').trim();ctx.fillText(data.legend[1],lx+14,15);
  }
}

// ═══════════════════════════════════════════════════════════
// AI Chat, Side Panel, Modals, Product, S/N, Issues, Excel, QR
// ═══════════════════════════════════════════════════════════

// ──────── AI Chat ────────
window.askAI=function(q){
  document.getElementById('chatInput').value=q;
  sendChat();
};

window.sendChat=async function(){
  const input=document.getElementById('chatInput');
  const msg=input.value.trim();if(!msg)return;
  input.value='';

  const container=document.getElementById('chatMessages');
  container.innerHTML+=`<div class="chat-bubble user">${esc(msg)}</div>`;

  const key=localStorage.getItem('esc_gemini_key');
  if(key){
    container.innerHTML+=`<div class="chat-bubble ai typing">분석 중...</div>`;
    container.scrollTop=container.scrollHeight;
    try{
      const response=await callGemini(key,msg);
      container.lastElementChild.remove();
      container.innerHTML+=`<div class="chat-bubble ai">${mdToHtml(response)}</div>`;
      container.scrollTop=container.scrollHeight;
      return;
    }catch(e){
      container.lastElementChild.remove();
    }
  }

  const response=generateLocalAI(msg);
  container.innerHTML+=`<div class="chat-bubble ai">${mdToHtml(response)}</div>`;
  container.scrollTop=container.scrollHeight;
};

async function callGemini(key,prompt){
  const dataContext=buildDataContext();
  const fullPrompt=`당신은 ESC(세라믹 정전척) 생산관리 AI 어시스턴트입니다. 아래 실시간 데이터를 기반으로 답변하세요.\n\n${dataContext}\n\n사용자 질문: ${prompt}`;

  const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${key}`,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({contents:[{parts:[{text:fullPrompt}]}]})
  });
  const json=await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text||'응답을 생성할 수 없습니다.';
}

// [버그 #1] buildDataContext — getProc 사용
function buildDataContext(){
  const total=Object.keys(D).length;
  let stats={대기:0,진행:0,완료:0,지연:0,폐기:0};
  Object.values(D).forEach(d=>{const s=d.status||'대기';if(stats[s]!==undefined)stats[s]++});

  let ctx=`[생산 현황] 전체: ${total}건, 대기: ${stats['대기']}, 진행: ${stats['진행']}, 완료: ${stats['완료']}, 지연: ${stats['지연']}, 폐기: ${stats['폐기']}\n`;
  ctx+=`[공정순서] ${PROC_ORDER.join(' → ')}\n`;
  ctx+=`[등록제품] ${Object.values(PRODS).map(p=>p.name).join(', ')}\n`;

  const delayed=Object.entries(D).filter(([,d])=>(d.status||'대기')==='지연');
  if(delayed.length){
    ctx+=`[지연 LOT]\n`;
    delayed.forEach(([sn,d])=>{ctx+=`- ${sn}: 현재공정=${d.currentProcess||'-'}, 납기=${fmt(fD(d.endDate))}\n`});
  }

  let procStats={};
  PROC_ORDER.forEach(p=>procStats[p]={total:0,done:0,inProgress:0});
  Object.entries(D).forEach(([sn,d])=>{
    const route=getRoute(sn,d);
    route.forEach(p=>{
      if(!procStats[p])return;
      procStats[p].total++;
      const pr=getProc(d,p);
      if(pr.status==='완료')procStats[p].done++;
      if(pr.status==='진행')procStats[p].inProgress++;
    });
  });
  ctx+=`[공정별 현황]\n`;
  PROC_ORDER.forEach(p=>{ctx+=`- ${p}: 전체=${procStats[p].total}, 진행=${procStats[p].inProgress}, 완료=${procStats[p].done}\n`});

  if(ISSUES.length){
    ctx+=`[최근 이슈 ${Math.min(ISSUES.length,10)}건]\n`;
    ISSUES.slice(0,10).forEach(is=>{ctx+=`- ${fmt(fD(is.date))} [${is.type}] ${is.content}\n`});
  }

  return ctx;
}

// [버그 #1] generateLocalAI — getProc 사용
function generateLocalAI(msg){
  const lower=msg.toLowerCase();

  if(lower.includes('요약')||lower.includes('현황')){
    const total=Object.keys(D).length;
    let stats={대기:0,진행:0,완료:0,지연:0};
    Object.values(D).forEach(d=>{const s=d.status||'대기';if(stats[s]!==undefined)stats[s]++});
    return`**📊 생산 현황 요약**\n\n전체 **${total}**건\n- 대기: ${stats['대기']}건\n- 진행: ${stats['진행']}건\n- 완료: ${stats['완료']}건\n- 지연: ${stats['지연']}건\n\n완료율: ${total?Math.round(stats['완료']/total*100):0}%`;
  }

  if(lower.includes('지연')){
    const delayed=Object.entries(D).filter(([,d])=>(d.status||'대기')==='지연');
    if(!delayed.length)return'현재 지연된 LOT이 없습니다. ✅';
    let text=`**⚠️ 지연 현황 (${delayed.length}건)**\n\n`;
    delayed.forEach(([sn,d])=>{text+=`- **${sn}** — ${d.currentProcess||'-'} / 납기: ${fmt(fD(d.endDate))}\n`});
    return text;
  }

  if(lower.includes('병목')){
    let procWIP={};
    PROC_ORDER.forEach(p=>procWIP[p]=0);
    Object.entries(D).forEach(([sn,d])=>{
      const route=getRoute(sn,d);
      route.forEach(p=>{
        const pr=getProc(d,p);
        if(pr.status==='진행')procWIP[p]=(procWIP[p]||0)+1;
      });
    });
    const bottleneck=Object.entries(procWIP).sort((a,b)=>b[1]-a[1])[0];
    let text=`**🔍 병목 진단**\n\n`;
    PROC_ORDER.forEach(p=>{text+=`- ${p}: 진행 ${procWIP[p]}건\n`});
    if(bottleneck&&bottleneck[1]>0)text+=`\n**병목 구간: ${bottleneck[0]}** (${bottleneck[1]}건 체류)`;
    return text;
  }

  if(lower.includes('예측')||lower.includes('이번 주')){
    const today=new Date();
    const weekEnd=new Date(today);weekEnd.setDate(today.getDate()+(5-today.getDay()));
    const weStr=weekEnd.toISOString().split('T')[0];
    const upcoming=Object.entries(D).filter(([sn,d])=>{
      const route=getRoute(sn,d);
      const lastProc=route[route.length-1];
      if(!lastProc)return false;
      const pr=getProc(d,lastProc);
      const pe=fD(pr.planEnd);
      return pe&&pe<=weStr&&pe>=todayStr()&&pr.status!=='완료';
    });
    return upcoming.length?`**📅 이번 주 완료 예정 (${upcoming.length}건)**\n\n${upcoming.map(([sn])=>`- ${sn}`).join('\n')}`:'이번 주 완료 예정인 LOT이 없습니다.';
  }

  if(lower.includes('개선')||lower.includes('제안')){
    return`**💡 생산 효율 개선 제안**\n\n1. 지연 LOT 우선 처리 — 병목 공정의 설비 추가 투입 검토\n2. 공정간 대기시간 최소화 — 이전 공정 완료 즉시 다음 공정 시작\n3. 설비 가동률 모니터링 — 유휴 설비 재배치\n4. 불량률 높은 공정 집중 관리 — 원인 분석 및 예방 조치\n5. 납기 역산 기준 투입 계획 수립`;
  }

  if(lower.includes('설비')||lower.includes('가동')){
    let equipUsage={};
    Object.values(D).forEach(d=>{
      const route=getRoute('',d);
      route.forEach(p=>{
        const pr=getProc(d,p);
        if(pr.equip&&pr.status==='진행'){equipUsage[pr.equip]=(equipUsage[pr.equip]||0)+1}
      });
    });
    let text='**🏭 설비 현황**\n\n';
    if(Object.keys(equipUsage).length){
      Object.entries(equipUsage).sort((a,b)=>b[1]-a[1]).forEach(([eq,cnt])=>{text+=`- ${eq}: ${cnt}건 가동\n`});
    }else{text+='현재 가동 중인 설비 정보가 없습니다.\n'}
    return text;
  }

  if(lower.includes('불량')||lower.includes('패턴')){
    let defects={};
    Object.values(D).forEach(d=>{
      const route=getRoute('',d);
      route.forEach(p=>{
        const pr=getProc(d,p);
        if(pr.defect&&pr.defect!==''){defects[p]=(defects[p]||0)+1}
      });
    });
    let text='**📈 불량 패턴 분석**\n\n';
    if(Object.keys(defects).length){
      Object.entries(defects).sort((a,b)=>b[1]-a[1]).forEach(([p,cnt])=>{text+=`- ${p}: ${cnt}건\n`});
    }else{text+='기록된 불량 데이터가 없습니다.\n'}
    return text;
  }

  if(lower.includes('보고서')||lower.includes('주간')){
    const total=Object.keys(D).length;
    let stats={대기:0,진행:0,완료:0,지연:0};
    Object.values(D).forEach(d=>{const s=d.status||'대기';if(stats[s]!==undefined)stats[s]++});
    return`**📋 주간 보고서**\n\n**기간:** ${fmt(todayStr())}\n**전체:** ${total}건\n**진행:** ${stats['진행']}건\n**완료:** ${stats['완료']}건 (${total?Math.round(stats['완료']/total*100):0}%)\n**지연:** ${stats['지연']}건\n\n---\n자세한 분석을 원하시면 Gemini API 키를 설정해 주세요.`;
  }

  if(lower.includes('s/n')||lower.includes('생성')){
    return'S/N 생성은 워크스페이스 탭의 **+ S/N생성** 버튼을 이용하세요. 또는 납기역산 계산기에서 바로 생성할 수도 있습니다.';
  }

  return`"${msg}"에 대한 분석입니다.\n\n현재 로컬 분석 모드입니다. 더 정확한 AI 분석을 원하시면 **설정 → Gemini API Key**를 등록해 주세요.\n\n사용 가능한 명령:\n- 오늘 생산 현황 요약\n- 지연 현황\n- 병목 진단\n- 이번 주 예측\n- 개선 제안\n- 설비 현황\n- 불량 패턴\n- 주간 보고서`;
}

// ──────── Mini Chat ────────
window.toggleMiniChat=function(){
  miniChatOpen=!miniChatOpen;
  document.getElementById('miniChatWin').style.display=miniChatOpen?'flex':'none';
};

window.sendMiniChat=async function(){
  const input=document.getElementById('miniChatInput');
  const msg=input.value.trim();if(!msg)return;
  input.value='';

  const container=document.getElementById('miniChatMessages');
  container.innerHTML+=`<div class="chat-bubble user" style="font-size:12px">${esc(msg)}</div>`;

  const response=generateLocalAI(msg);
  container.innerHTML+=`<div class="chat-bubble ai" style="font-size:12px">${mdToHtml(response)}</div>`;
  container.scrollTop=container.scrollHeight;
};

// ──────── Side Panel ────────
// [버그 #8] openSidePanel — currentSN 추적, getProc 사용
window.openSidePanel=function(sn){
  currentSN=sn;
  const d=D[sn];
  if(!d){toast('데이터를 찾을 수 없습니다','error');return}

  document.getElementById('spSN').textContent=sn;
  document.getElementById('spBadge').innerHTML=statusBadge(d.status||'대기');
  document.getElementById('spCat').textContent=getCategory(sn);
  document.getElementById('spStatusSel').value=d.status||'대기';

  const body=document.getElementById('spBody');
  const route=getRoute(sn,d);
  const progress=calcProgress(d,sn);

  let html=`
    <div class="sp-section">
      <div class="sp-label">진행률</div>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="flex:1;height:8px;background:var(--bg4);border-radius:4px;overflow:hidden">
          <div style="width:${progress}%;height:100%;background:${progress>=100?'var(--suc)':'var(--ac2)'};border-radius:4px;transition:width 0.3s"></div>
        </div>
        <span style="font-size:13px;font-weight:600">${progress}%</span>
      </div>
    </div>
    <div class="sp-section">
      <div class="sp-label">기본 정보</div>
      <div class="sp-info-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">
        <div>제품: <strong>${esc(d.productName||'-')}</strong></div>
        <div>카테고리: <strong>${esc(getCategory(sn))}</strong></div>
        <div>시작일: <strong>${fmt(fD(d.startDate))}</strong></div>
        <div>납기: <strong>${fmt(fD(d.endDate))}</strong></div>
        <div>고객: <strong>${esc(d.customer||'-')}</strong></div>
        <div>배치: <strong>${esc(d.batch||'-')}</strong></div>
      </div>
    </div>
    <div class="sp-section">
      <div class="sp-label" style="display:flex;align-items:center;justify-content:space-between">
        공정 현황
        <button class="btn btn-secondary btn-sm" onclick="openProcDetailModal('${esc(sn)}')" style="font-size:11px">✏️ 전체편집</button>
      </div>
      <div class="sp-proc-list">`;

  route.forEach((proc,idx)=>{
    const pr=getProc(d,proc);
    const st=pr.status||'대기';
    const color=PROC_COLORS[proc]||'#666';
    const isActive=proc===(d.currentProcess||route[0]);

    html+=`<div class="sp-proc-item" style="padding:8px 10px;margin-bottom:6px;border-radius:8px;border-left:3px solid ${color};background:${isActive?'rgba(99,102,241,0.08)':'var(--bg4)'}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <span style="font-weight:600;font-size:13px;color:${color}">${idx+1}. ${esc(proc)}</span>
        ${statusBadge(st)}
      </div>
      <div style="font-size:11px;color:var(--t2);display:grid;grid-template-columns:1fr 1fr;gap:2px">
        <div>설비: ${esc(pr.equip||'-')}</div>
        <div>계획: ${pr.planDays||'-'}일</div>
        <div>시작: ${fmt(fD(pr.planStart||pr.actualStart))}</div>
        <div>종료: ${fmt(fD(pr.actualEnd||pr.planEnd))}</div>
        <div>실적: ${pr.actualDays||'-'}일</div>
        <div>불량: ${esc(pr.defect||'-')}</div>
      </div>
      ${pr.remark?`<div style="font-size:11px;color:var(--t2);margin-top:3px">📝 ${esc(pr.remark)}</div>`:''}
    </div>`;
  });

  html+=`</div></div>`;

  const snIssues=ISSUES.filter(is=>is.sn===sn);
  if(snIssues.length){
    html+=`<div class="sp-section"><div class="sp-label">이슈 (${snIssues.length})</div>`;
    snIssues.forEach(is=>{
      html+=`<div style="padding:6px 8px;margin-bottom:4px;background:rgba(239,68,68,0.06);border-radius:6px;font-size:12px">
        <div style="display:flex;justify-content:space-between"><span class="badge badge-delay" style="font-size:10px">${esc(is.type||'기타')}</span><span style="color:var(--t2);font-size:10px">${fmt(fD(is.date))}</span></div>
        <div style="margin-top:3px">${esc(is.content||'')}</div>
      </div>`;
    });
    html+=`</div>`;
  }

  body.innerHTML=html;
  document.getElementById('sidePanel').classList.add('open');
};

// [버그 #8] closeSidePanel — currentSN 초기화
window.closeSidePanel=function(){
  document.getElementById('sidePanel').classList.remove('open');
  currentSN=null;
};

// [버그 #6] applySpStatus — 통합 에러 처리
window.applySpStatus=async function(){
  if(!currentSN)return;
  const status=document.getElementById('spStatusSel').value;
  try{
    const ref=fs_fn.doc(db,'production',currentSN);
    const updates={status};
    if(status==='완료')updates.completedAt=todayStr();
    await fs_fn.updateDoc(ref,updates);
    toast(`${currentSN} 상태 → ${status}`,'success');
  }catch(err){handleFirestoreError(err,'상태 변경')}
};

// [버그 #6] deleteSN — 통합 에러 처리
window.deleteSN=async function(){
  if(!currentSN)return;
  if(!confirm(`${currentSN}을(를) 삭제하시겠습니까?`))return;
  try{
    await fs_fn.deleteDoc(fs_fn.doc(db,'production',currentSN));
    toast(`${currentSN} 삭제됨`,'success');
    closeSidePanel();
  }catch(err){handleFirestoreError(err,'LOT 삭제')}
};

// ──────── Process Detail Modal ────────
// [버그 #1] getProc 사용
window.openProcDetailModal=function(sn){
  const d=D[sn];if(!d)return;
  const route=getRoute(sn,d);
  const cat=getCategory(sn);

  let html=`<div class="modal-header"><div class="modal-title">✏️ 공정 상세 편집 — ${esc(sn)}</div><button class="modal-close btn-icon" onclick="closeModal('reportModal')">✕</button></div>`;
  html+=`<div style="max-height:60vh;overflow-y:auto">`;

  route.forEach((proc,idx)=>{
    const pr=getProc(d,proc);
    const color=PROC_COLORS[proc]||'#666';
    const eqList=getEquipList(proc);
    const days=procDays(proc,cat);

    html+=`<div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:10px;border-left:3px solid ${color}">
      <div style="font-weight:600;color:${color};margin-bottom:8px">${idx+1}. ${esc(proc)} (기본 ${days}일)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" style="font-size:11px">상태</label>
          <select class="form-input form-select" id="pd_st_${idx}" style="padding:5px 8px;font-size:12px">
            <option value="대기" ${(pr.status||'대기')==='대기'?'selected':''}>대기</option>
            <option value="진행" ${pr.status==='진행'?'selected':''}>진행</option>
            <option value="완료" ${pr.status==='완료'?'selected':''}>완료</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" style="font-size:11px">설비</label>
          <select class="form-input form-select" id="pd_eq_${idx}" style="padding:5px 8px;font-size:12px">
            <option value="">선택...</option>
            ${eqList.map(eq=>`<option value="${esc(eq)}" ${pr.equip===eq?'selected':''}>${esc(eq)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" style="font-size:11px">시작일</label>
          <input class="form-input" type="date" id="pd_start_${idx}" value="${fD(pr.planStart||pr.actualStart)}" style="padding:5px 8px;font-size:12px">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" style="font-size:11px">종료일</label>
          <input class="form-input" type="date" id="pd_end_${idx}" value="${fD(pr.actualEnd||pr.planEnd)}" style="padding:5px 8px;font-size:12px">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" style="font-size:11px">불량</label>
          <input class="form-input" id="pd_def_${idx}" value="${esc(pr.defect||'')}" placeholder="불량 내용" style="padding:5px 8px;font-size:12px">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label" style="font-size:11px">비고</label>
          <input class="form-input" id="pd_rem_${idx}" value="${esc(pr.remark||'')}" placeholder="비고" style="padding:5px 8px;font-size:12px">
        </div>
      </div>
    </div>`;
  });

  html+=`</div>`;
  html+=`<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
    <button class="btn btn-secondary" onclick="closeModal('reportModal')">취소</button>
    <button class="btn btn-primary" onclick="saveProcDetail('${esc(sn)}')">저장</button>
  </div>`;

  document.getElementById('reportContent').innerHTML=html;
  openModal('reportModal');
};

// [버그 #6] saveProcDetail — 통합 에러 처리 + [버그 #8] 패널 자동 갱신
window.saveProcDetail=async function(sn){
  const d=D[sn];if(!d)return;
  const route=getRoute(sn,d);
  const cat=getCategory(sn);
  const updates={};
  let allDone=true;
  let newCurrentProc='';

  route.forEach((proc,idx)=>{
    const st=document.getElementById(`pd_st_${idx}`)?.value||'대기';
    const eq=document.getElementById(`pd_eq_${idx}`)?.value||'';
    const startVal=document.getElementById(`pd_start_${idx}`)?.value||'';
    const endVal=document.getElementById(`pd_end_${idx}`)?.value||'';
    const defect=document.getElementById(`pd_def_${idx}`)?.value||'';
    const remark=document.getElementById(`pd_rem_${idx}`)?.value||'';
    const days=procDays(proc,cat);

    const planEnd=startVal?addBD(startVal,days):'';
    const actualDays=(startVal&&endVal)?diffBD(startVal,endVal):0;

    updates[`processes.${proc}.status`]=st;
    updates[`processes.${proc}.equip`]=eq;
    updates[`processes.${proc}.planStart`]=startVal;
    updates[`processes.${proc}.planEnd`]=planEnd||endVal;
    updates[`processes.${proc}.planDays`]=days;
    updates[`processes.${proc}.defect`]=defect;
    updates[`processes.${proc}.remark`]=remark;

    if(st==='진행'&&startVal){
      updates[`processes.${proc}.actualStart`]=startVal;
    }
    if(st==='완료'){
      updates[`processes.${proc}.actualEnd`]=endVal||todayStr();
      updates[`processes.${proc}.actualDays`]=actualDays||diffBD(startVal,endVal||todayStr());
    }

    if(st!=='완료')allDone=false;
    if(!newCurrentProc&&st!=='완료')newCurrentProc=proc;
  });

  updates.currentProcess=newCurrentProc||route[route.length-1];
  if(allDone){
    updates.status='완료';
    updates.completedAt=todayStr();
  }

  try{
    const ref=fs_fn.doc(db,'production',sn);
    await fs_fn.updateDoc(ref,updates);
    toast(`${sn} 공정 정보 저장 완료`,'success');
    closeModal('reportModal');
    // [버그 #8] 패널이 열려있으면 자동 갱신 (onSnapshot이 트리거되면 onDataChanged → refreshSidePanelIfOpen)
  }catch(err){handleFirestoreError(err,'공정 상세 저장')}
};

// ──────── QR ────────
window.showSNQR=async function(){
  if(!currentSN)return;
  document.getElementById('qrSNLabel').textContent=currentSN;
  const wrap=document.getElementById('qrCanvasWrap');
  wrap.innerHTML='';
  openModal('qrModal');

  if(typeof QRCode!=='undefined'){
    try{
      const canvas=document.createElement('canvas');
      await QRCode.toCanvas(canvas,currentSN,{width:200,margin:2});
      wrap.appendChild(canvas);
    }catch(e){wrap.innerHTML='<div style="color:var(--err)">QR 생성 실패</div>'}
  }else{
    wrap.innerHTML='<div style="color:var(--t2)">QR 라이브러리 로딩 중...</div>';
  }
};

window.downloadQR=function(){
  const canvas=document.querySelector('#qrCanvasWrap canvas');
  if(!canvas)return;
  const link=document.createElement('a');
  link.download=`QR_${currentSN||'code'}.png`;
  link.href=canvas.toDataURL();
  link.click();
};

// ──────── Product Registration ────────
window.openProductModal=function(){openModal('productModal')};

['pm_cat','pm_heat'].forEach(id=>{
  const el=document.getElementById(id);
  if(el)el.addEventListener('change',()=>{
    const cat=document.getElementById('pm_cat').value;
    const heat=document.getElementById('pm_heat').value;
    const route=buildRoute(cat,heat);
    document.getElementById('pm_routePreview').textContent=route.join(' → ');
  });
});

// [버그 #6] saveProduct — 통합 에러 처리
window.saveProduct=async function(){
  const name=document.getElementById('pm_name').value.trim();
  const cat=document.getElementById('pm_cat').value;
  if(!name){toast('제품명을 입력하세요','warn');return}

  const drawing=document.getElementById('pm_drawing').value.trim();
  const shrink=parseFloat(document.getElementById('pm_shrink').value)||0;
  const stack=parseInt(document.getElementById('pm_stack').value)||0;
  const joint=document.getElementById('pm_joint').value;
  const heat=document.getElementById('pm_heat').value;
  const route=buildRoute(cat,heat);

  try{
    const ref=fs_fn.doc(db,'products',name);
    await fs_fn.setDoc(ref,{name,category:cat,drawing,shrink,stack,joint,heat,route,createdAt:todayStr()});
    toast(`제품 "${name}" 등록 완료`,'success');
    closeModal('productModal');
    document.getElementById('pm_name').value='';
    const prodListCol=fs_fn.collection(db,'products');
    const snap=await fs_fn.getDocs(prodListCol);
    PRODS={};snap.forEach(doc=>{PRODS[doc.id]=doc.data()});
    populateProductSelects();
  }catch(err){handleFirestoreError(err,'제품 등록')}
};

// ──────── S/N Generation ────────
window.openSNModal=function(){
  populateProductSelects();
  document.getElementById('sn_start').value=todayStr();
  const batches=new Set();
  Object.values(D).forEach(d=>{if(d.batch)batches.add(d.batch)});
  const bl=document.getElementById('batchList');
  if(bl)bl.innerHTML=[...batches].map(b=>`<option value="${esc(b)}">`).join('');
  openModal('snModal');
};

window.autoBatchCode=function(){
  const d=new Date();
  const code=`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(Math.floor(Math.random()*900)+100)}`;
  document.getElementById('sn_batch').value=code;
  updateSNPreview();
};

window.onSNProdChange=function(){
  const prodKey=document.getElementById('sn_prod').value;
  const prod=PRODS[prodKey];
  if(!prod)return;
  const cat=prod.category||'WN';

  const eqSel=document.getElementById('sn_equip');
  if(eqSel){
    const firstProc=PROC_ORDER[0];
    const eqList=getEquipList(firstProc);
    eqSel.innerHTML='<option value="">선택...</option>'+eqList.map(eq=>`<option value="${esc(eq)}">${esc(eq)}</option>`).join('');
  }

  const seqHint=document.getElementById('sn_seqHint');
  if(seqHint){
    const existing=Object.keys(D).filter(sn=>sn.toUpperCase().startsWith(cat.toUpperCase()));
    seqHint.textContent=`현재 ${cat} 시리즈: ${existing.length}건`;
  }

  updateSNPreview();
};

window.onSheetNoChange=function(){updateSNPreview()};

window.updateSNPreview=function(){
  const batch=document.getElementById('sn_batch').value.trim();
  const sheet=document.getElementById('sn_sheet').value.trim();
  const prodKey=document.getElementById('sn_prod').value;
  const qty=parseInt(document.getElementById('sn_qty').value)||1;
  const seq=parseInt(document.getElementById('sn_seq').value)||1;
  const prod=PRODS[prodKey];

  const preview=document.getElementById('sn_preview');
  if(!preview)return;

  if(!prod||!sheet){preview.textContent='제품과 시트번호를 입력하세요';return}

  const cat=prod.category||'WN';
  const name=(prod.name||'').replace(/\s/g,'');

  let lines=[];
  for(let i=0;i<Math.min(qty,50);i++){
    const seqStr=String(seq+i).padStart(3,'0');
    const sn=`${cat}${sheet}-${seqStr}-${name}`;
    lines.push(sn);
  }
  preview.innerHTML=lines.map(l=>`<div>${esc(l)}</div>`).join('');
};

window.checkEquipConflict=function(){
  const equip=document.getElementById('sn_equip').value;
  const start=document.getElementById('sn_start').value;
  const warn=document.getElementById('equipConflictWarn');
  if(!warn)return;

  if(!equip||!start){warn.innerHTML='';return}

  const conflicts=Object.entries(D).filter(([sn,d])=>{
    const route=getRoute(sn,d);
    return route.some(p=>{
      const pr=getProc(d,p);
      if(pr.equip!==equip||pr.status==='완료')return false;
      const ps=fD(pr.planStart||pr.actualStart);
      const pe=fD(pr.planEnd);
      return ps&&pe&&start>=ps&&start<=pe;
    });
  });

  if(conflicts.length){
    warn.innerHTML=`<div style="font-size:11px;color:var(--warn);margin-top:3px">⚠️ ${equip}이(가) ${conflicts.length}건과 일정 겹침</div>`;
  }else{
    warn.innerHTML='';
  }
};

// [버그 #6] saveSNBatch — 통합 에러 처리
window.saveSNBatch=async function(){
  const batch=document.getElementById('sn_batch').value.trim();
  const sheet=document.getElementById('sn_sheet').value.trim();
  const prodKey=document.getElementById('sn_prod').value;
  const qty=parseInt(document.getElementById('sn_qty').value)||1;
  const seq=parseInt(document.getElementById('sn_seq').value)||1;
  const startDate=document.getElementById('sn_start').value;
  const equip=document.getElementById('sn_equip').value;
  const prod=PRODS[prodKey];

  if(!prod||!sheet||!batch){toast('필수 항목을 입력하세요','warn');return}
  if(!startDate){toast('시작일을 입력하세요','warn');return}

  const cat=prod.category||'WN';
  const heat=prod.heat||'N';
  const route=buildRoute(cat,heat);
  const name=(prod.name||'').replace(/\s/g,'');

  try{
    const wb=fs_fn.writeBatch(db);

    for(let i=0;i<qty;i++){
      const seqStr=String(seq+i).padStart(3,'0');
      const sn=`${cat}${sheet}-${seqStr}-${name}`;

      const processes={};
      let procStart=startDate;
      route.forEach((proc,idx)=>{
        const days=procDays(proc,cat);
        const planEnd=addBD(procStart,days);
        processes[proc]={
          status:idx===0?'진행':'대기',
          planStart:procStart,
          planEnd:planEnd,
          planDays:days,
          actualStart:idx===0?procStart:'',
          actualEnd:'',
          actualDays:0,
          equip:idx===0?equip:'',
          defect:'',
          remark:''
        };
        procStart=planEnd;
      });

      const ref=fs_fn.doc(db,'production',sn);
      wb.set(ref,{
        sn,
        productName:prod.name,
        category:cat,
        customer:prod.customer||'',
        batch,
        route,
        processes,
        startDate,
        endDate:procStart,
        status:'진행',
        currentProcess:route[0],
        createdAt:todayStr(),
        heat
      });
    }

    await wb.commit();
    toast(`${qty}건 S/N 생성 완료`,'success');
    closeModal('snModal');
  }catch(err){handleFirestoreError(err,'S/N 생성')}
};

// ──────── Issue Registration ────────
window.openIssueModal=function(sn){
  document.getElementById('is_date').value=todayStr();
  document.getElementById('is_sn').value=sn||'';
  document.getElementById('is_content').value='';
  populateProductSelects();
  openModal('issueModal');
};

window.loadIssueSNList=function(){
  const prodKey=document.getElementById('is_prod').value;
  const dl=document.getElementById('issueSNList');
  if(!dl)return;
  const prod=PRODS[prodKey];
  if(!prod){dl.innerHTML='';return}
  const items=Object.keys(D).filter(sn=>{
    const d=D[sn];
    return d.productName===prod.name||getCategory(sn)===(prod.category||'');
  });
  dl.innerHTML=items.map(sn=>`<option value="${esc(sn)}">`).join('');
};

// [버그 #6] saveIssue — 통합 에러 처리
window.saveIssue=async function(){
  const date=document.getElementById('is_date').value;
  const type=document.getElementById('is_type').value;
  const sn=document.getElementById('is_sn').value.trim();
  const content=document.getElementById('is_content').value.trim();

  if(!content){toast('이슈 내용을 입력하세요','warn');return}

  try{
    const id=`ISS-${Date.now()}`;
    const ref=fs_fn.doc(db,'issues',id);
    await fs_fn.setDoc(ref,{date,type,sn,content,createdAt:todayStr(),createdBy:currentUser?.email||''});
    toast('이슈 등록 완료','success');
    closeModal('issueModal');
  }catch(err){handleFirestoreError(err,'이슈 등록')}
};

// ──────── Excel Export ────────
// [버그 #1] getProc 사용
window.exportExcel=function(){
  if(typeof XLSX==='undefined'){toast('SheetJS 로딩 중...','warn');return}

  const rows=[];
  Object.entries(D).forEach(([sn,d])=>{
    const route=getRoute(sn,d);
    const row={
      'S/N':sn,
      '제품':d.productName||'',
      '카테고리':getCategory(sn),
      '상태':d.status||'대기',
      '현재공정':d.currentProcess||'',
      '시작일':fD(d.startDate),
      '납기':fD(d.endDate),
      '진행률':calcProgress(d,sn)+'%',
      '배치':d.batch||''
    };

    route.forEach(proc=>{
      const pr=getProc(d,proc);
      row[`${proc}_상태`]=pr.status||'';
      row[`${proc}_설비`]=pr.equip||'';
      row[`${proc}_시작`]=fD(pr.planStart||pr.actualStart);
      row[`${proc}_종료`]=fD(pr.actualEnd||pr.planEnd);
      row[`${proc}_불량`]=pr.defect||'';
    });

    rows.push(row);
  });

  const ws=XLSX.utils.json_to_sheet(rows);
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'생산데이터');

  if(ISSUES.length){
    const issueRows=ISSUES.map(is=>({날짜:fD(is.date),유형:is.type||'',SN:is.sn||'',내용:is.content||''}));
    const ws2=XLSX.utils.json_to_sheet(issueRows);
    XLSX.utils.book_append_sheet(wb,ws2,'이슈');
  }

  XLSX.writeFile(wb,`ESC_생산데이터_${todayStr()}.xlsx`);
  toast('엑셀 내보내기 완료','success');
};

// ──────── JSON Export ────────
window.exportJSON=function(){
  const data={
    production:D,
    products:PRODS,
    issues:ISSUES,
    exportDate:todayStr(),
    version:'v10.0'
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const link=document.createElement('a');
  link.download=`ESC_backup_${todayStr()}.json`;
  link.href=URL.createObjectURL(blob);
  link.click();
  toast('JSON 백업 완료','success');
};

// ═══════════════════════════════════════════════════════════
// 키보드 단축키, 이벤트, 초기화
// ═══════════════════════════════════════════════════════════

document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
    closeSidePanel();
    closeAllDropdowns();
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m=>m.classList.add('hidden'));
  }
  if(e.ctrlKey&&e.key==='k'){
    e.preventDefault();
    if(currentTab==='workspace'){
      document.getElementById('wsSearch')?.focus();
    }
  }
});

// [버그 #5] pointerdown 사용 (터치 호환)
document.addEventListener('pointerdown',e=>{
  const sp=document.getElementById('sidePanel');
  if(sp&&sp.classList.contains('open')&&!sp.contains(e.target)){
    const clickedSNCell=e.target.closest('.sn-cell');
    if(!clickedSNCell)closeSidePanel();
  }
});

document.querySelectorAll('.bb-item').forEach(item=>{
  item.addEventListener('click',function(){
    document.querySelectorAll('.bb-item').forEach(i=>i.classList.remove('active'));
    this.classList.add('active');
  });
});

// 사이드바 초기 상태
if(window.innerWidth<768){
  sidebarCollapsed=true;
  document.getElementById('sidebar')?.classList.add('collapsed');
}

// 온/오프라인 감지
window.addEventListener('online',()=>{
  const banner=document.getElementById('offlineBanner');
  if(banner)banner.style.display='none';
  toast('온라인 복구됨','success');
});
window.addEventListener('offline',()=>{
  const banner=document.getElementById('offlineBanner');
  if(banner)banner.style.display='block';
});

// 테마 초기화
(function(){
  const t=localStorage.getItem('esc_theme');
  if(t==='light')isDark=false;
  applyTheme();
})();

console.log('🎉 ESC Manager v10.0 — 버그 방어 통합 빌드 로드 완료');
