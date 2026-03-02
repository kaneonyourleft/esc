// ═══════════════════════════════════════════════════════════
// ESC Manager v9.0 — Part 1 (원본 구조 호환)
// Firebase · 전역변수 · 유틸리티 · 인증 · 탭전환 · 데이터 로드
// ═══════════════════════════════════════════════════════════

/* ── CDN ── */
function loadScript(src){return new Promise((res,rej)=>{if(document.querySelector(`script[src="${src}"]`)){res();return;}const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=rej;document.head.appendChild(s);})}
Promise.all([
  loadScript('https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js'),
  loadScript('https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js')
]).then(()=>console.log('📦 CDN 로드 완료')).catch(()=>console.warn('CDN 일부 로딩 실패'));

/* ── Firebase ── */
import{initializeApp}from'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import{getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut}from'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import{getFirestore,collection,doc,addDoc,getDocs,query,orderBy,onSnapshot,updateDoc,deleteDoc,writeBatch,serverTimestamp}from'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const FC={apiKey:'AIzaSyAwDS2PigihTH6RKMxzrH-utlaKJbtHBTY',authDomain:'esc-production-management.firebaseapp.com',projectId:'esc-production-management',storageBucket:'esc-production-management.firebasestorage.app',messagingSenderId:'622370430583',appId:'1:622370430583:web:363b6e2f185fddcbd33072'};
const app=initializeApp(FC);
const auth=getAuth(app);
const db=getFirestore(app);
const provider=new GoogleAuthProvider();
console.log('🔥 Firebase 초기화 완료');

/* ── 전역 변수 ── */
let D=[];
let PRODS=[];
let ISSUES=[];
let currentUser=null;
let currentSN=null;
let currentTab='home';
let sidebarCollapsed=false;
let isDark=true;
let wsFilters=['전체'];
let wsGroups={};
let selectedSNs=new Set();
let ganttView='product';
let ganttDayW=30;
let ganttExpandState={};
let ganttAllExpanded=false;
let calView='month';
let calDate=new Date();
let dlData=null;
let wsViewMode='product';
let equipSectionOpen=false;
let kanbanOpen=false;
let pendingAIAction=null;

/* ── 공정 상수 ── */
const PROC_ORDER=['탈지','소성','환원소성','평탄화','도금','열처리'];
const PROC_COLORS={'탈지':'#3b82f6','소성':'#f59e0b','환원소성':'#a855f7','평탄화':'#10b981','도금':'#06b6d4','열처리':'#ec4899'};
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

/* ── 유틸리티 ── */
function fD(d){if(!d)return'';const dt=d instanceof Date?d:new Date(d);return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0')}
function addBD(d,n){let dt=new Date(d);for(let i=0;i<n;){dt.setDate(dt.getDate()+1);const w=dt.getDay();if(w!==0&&w!==6)i++;}return dt}
function diffBD(a,b){let s=new Date(a<b?a:b),e=new Date(a<b?b:a),c=0;while(s<e){s.setDate(s.getDate()+1);const w=s.getDay();if(w!==0&&w!==6)c++;}return a<b?c:-c}
function calcProgress(item){const procs=item.processes||{};const route=(item.route||'').split('>').map(s=>s.trim()).filter(Boolean);if(!route.length)return item.progress||0;const done=route.filter(p=>procs[p]&&procs[p].status==='완료').length;return Math.round(done/route.length*100)}
function getCurrentProcess(item){const route=(item.route||'').split('>').map(s=>s.trim()).filter(Boolean);const procs=item.processes||{};for(const p of route){if(!procs[p]||procs[p].status!=='완료')return p;}return route[route.length-1]||''}
function getDplus(item){if(!item.startDate)return'-';const d=diffBD(new Date(item.startDate),new Date());return d>=0?`D+${d}`:`D-${Math.abs(d)}`}
function buildRoute(cat,joint,heat){const r=['탈지','소성'];if(cat==='BL')r.push('환원소성');r.push('평탄화');if(joint!=='Brazing')r.push('도금');if(heat==='Y')r.push('열처리');return r.join('>')}
function procDays(name,cat,stack){if(name==='탈지')return(cat==='BL'&&stack>=9)?5:3;if(name==='소성')return(cat==='BL'&&stack>=9)?5:3;if(name==='환원소성')return 3;if(name==='평탄화')return 3;if(name==='도금')return 1;if(name==='열처리')return 1;return 3}
function statusBadge(s){const m={'대기':'badge-wait','진행':'badge-prog','완료':'badge-done','지연':'badge-late','폐기':'badge-disc'};return`<span class="badge ${m[s]||'badge-wait'}">${s||'대기'}</span>`}
function esc(s){return(s||'').replace(/'/g,"\\'").replace(/"/g,'&quot;')}
function calcActualDays(startStr,endStr){if(!startStr||!endStr)return 0;const s=new Date(startStr);const e=new Date(endStr);let c=0;let cur=new Date(s);while(cur<e){cur.setDate(cur.getDate()+1);const w=cur.getDay();if(w!==0&&w!==6)c++;}return Math.max(c,1)}

function toast(msg,type='ok'){
  let c=document.getElementById('toastContainer');
  if(!c){c=document.createElement('div');c.id='toastContainer';c.style.cssText='position:fixed;top:20px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:8px;';document.body.appendChild(c);}
  const icons={ok:'✅',err:'❌',warn:'⚠️'};
  const t=document.createElement('div');t.className=`toast toast-${type}`;
  t.innerHTML=`<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  c.appendChild(t);setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity 0.3s';setTimeout(()=>t.remove(),300)},3000);
}

function openModal(id){const el=document.getElementById(id);if(el)el.classList.remove('hidden')}
function closeModal(id){const el=document.getElementById(id);if(el)el.classList.add('hidden')}
window.openModal=openModal;


function mdToHtml(text){
  if(!text)return'';
  let h=text;
  h=h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  h=h.replace(/`([^`]+)`/g,'<code style="background:rgba(255,255,255,0.1);padding:1px 4px;border-radius:3px;font-size:12px">$1</code>');
  h=h.replace(/\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)*)/g,function(match,headerRow,bodyRows){
    const headers=headerRow.split('|').map(h=>h.trim()).filter(Boolean);
    let table='<table style="font-size:11px;margin:6px 0;border:1px solid var(--border);border-radius:4px"><thead><tr>'+headers.map(h=>'<th style="padding:4px 6px">'+h+'</th>').join('')+'</tr></thead><tbody>';
    bodyRows.trim().split('\n').forEach(row=>{const cells=row.split('|').map(c=>c.trim()).filter(Boolean);table+='<tr>'+cells.map(c=>'<td style="padding:3px 6px;border-top:1px solid var(--border)">'+c+'</td>').join('')+'</tr>';});
    return table+'</tbody></table>';
  });
  h=h.replace(/^[\-\*] (.+)$/gm,'<li style="margin-left:16px;font-size:12px">$1</li>');
  h=h.replace(/(<li[^>]*>.*<\/li>\n?)+/g,m=>'<ul style="list-style:disc;padding-left:10px;margin:4px 0">'+m+'</ul>');
  h=h.replace(/\n/g,'<br>');
  return h;
}

/* ── 인증 ── */
function doLogin(){signInWithPopup(auth,provider).catch(err=>{console.error('로그인 실패:',err);toast('로그인 실패','err')})}
window.doLogin=doLogin;

function doLogout(){signOut(auth).then(()=>toast('로그아웃 완료')).catch(()=>toast('로그아웃 실패','err'))}
window.doLogout=doLogout;

/* ── 탭 전환 (원본 구조) ── */
const TAB_MAP={
  home:{tab:'homeTab',title:'홈',icon:'🏠'},
  workspace:{tab:'workspaceTab',title:'워크스페이스',icon:'📋'},
  calendar:{tab:'calendarTab',title:'캘린더',icon:'📅'},
  gantt:{tab:'ganttTab',title:'간트차트',icon:'📊'},
  analysis:{tab:'analysisTab',title:'분석',icon:'📈'},
  ai:{tab:'aiTab',title:'AI 어시스턴트',icon:'🤖'},
  settings:{tab:'settingsTab',title:'설정',icon:'⚙️'}
};

function switchTab(name){
  currentTab=name;
  // 탭 컨텐츠 전환
  document.querySelectorAll('.tab-content').forEach(el=>el.style.display='none');
  const info=TAB_MAP[name];
  if(info){
    const tabEl=document.getElementById(info.tab);
    if(tabEl)tabEl.style.display='';
    const tbTitle=document.getElementById('tbTitle');
    if(tbTitle)tbTitle.textContent=info.title;
  }
  // 사이드바 활성화
  document.querySelectorAll('.sb-item').forEach(el=>el.classList.toggle('active',el.dataset.tab===name));
  // 하단바 활성화
  document.querySelectorAll('.bb-item').forEach(el=>el.classList.toggle('active',el.dataset.tab===name));
  // 탭별 렌더링
  renderTab(name);
}
window.switchTab=switchTab;

function renderTab(name){
  switch(name){
    case 'home':renderHome();break;
    case 'workspace':renderWorkspace();break;
    case 'calendar':renderCalendar();break;
    case 'gantt':renderGantt();break;
    case 'analysis':renderAnalysis();break;
    case 'ai':break; // AI탭은 이미 HTML에 준비됨
    case 'settings':renderSettings();break;
  }
}

/* ── 사이드바 토글 ── */
function toggleSidebar(){
  sidebarCollapsed=!sidebarCollapsed;
  document.getElementById('sidebar')?.classList.toggle('collapsed',sidebarCollapsed);
}
window.toggleSidebar=toggleSidebar;

/* ── 테마 토글 ── */
function toggleTheme(){
  isDark=!isDark;
  document.documentElement.setAttribute('data-theme',isDark?'dark':'light');
  localStorage.setItem('esc-theme',isDark?'dark':'light');
  const toggle=document.getElementById('themeToggle');
  if(toggle)toggle.classList.toggle('active',!isDark);
}
window.toggleTheme=toggleTheme;


/* ── Firestore 실시간 리스너 ── */
function loadData(){
  // production 컬렉션
  const q=query(collection(db,'production'),orderBy('registeredAt','desc'));
  onSnapshot(q,snap=>{
    D=[];
    snap.forEach(ds=>{const d=ds.data();d._id=ds.id;D.push(d)});
    console.log(`📦 production 동기화: ${D.length}건`);
    renderTab(currentTab);
  },err=>{console.error('Firestore 오류:',err);toast('데이터 동기화 오류','err')});

  // products 컬렉션
  onSnapshot(collection(db,'products'),snap=>{
    PRODS=[];
    snap.forEach(ds=>{const d=ds.data();d._id=ds.id;PRODS.push(d)});
    console.log(`📦 products 동기화: ${PRODS.length}건`);
  });
}

/* ── 인증 상태 감지 ── */
onAuthStateChanged(auth,user=>{
  const login=document.getElementById('loginScreen');
  const appDiv=document.getElementById('app');
  if(user){
    currentUser=user;
    console.log('✅ 로그인:',user.email);
    if(login)login.style.display='none';
    if(appDiv)appDiv.style.display='flex';
    // 사이드바 유저 정보
    const sbName=document.getElementById('sbName');
    const sbEmail=document.getElementById('sbEmail');
    const sbAvatar=document.getElementById('sbAvatar');
    const tbAvatar=document.getElementById('tbAvatar');
    const settingName=document.getElementById('settingName');
    const settingEmail=document.getElementById('settingEmail');
    if(sbName)sbName.textContent=user.displayName||'사용자';
    if(sbEmail)sbEmail.textContent=user.email||'';
    const initial=(user.displayName||'U')[0].toUpperCase();
    if(sbAvatar)sbAvatar.textContent=initial;
    if(tbAvatar)tbAvatar.textContent=initial;
    if(settingName)settingName.textContent=user.displayName||'사용자';
    if(settingEmail)settingEmail.textContent=user.email||'';
    // 테마 복원
    const saved=localStorage.getItem('esc-theme');
    if(saved==='light'){isDark=false;document.documentElement.setAttribute('data-theme','light');const t=document.getElementById('themeToggle');if(t)t.classList.add('active');}
    // 데이터 로드
    loadData();
  }else{
    currentUser=null;
    console.log('⛔ 로그아웃 상태');
    if(login)login.style.display='flex';
    if(appDiv)appDiv.style.display='none';
  }
});

/* ══════════════════════════════════════════════
   플레이스홀더 — Part 2에서 채울 함수들
   ══════════════════════════════════════════════ */

function renderHome(){
  const greet=document.getElementById('greetMsg');
  const sub=document.getElementById('greetSub');
  if(greet){
    const h=new Date().getHours();
    const timeGreet=h<12?'좋은 아침이에요':h<18?'좋은 오후에요':'수고하셨습니다';
    greet.textContent=`${timeGreet}, ${currentUser?.displayName||'사용자'}님!`;
  }
  if(sub){
    const active=D.filter(d=>d.status!=='완료'&&d.status!=='폐기').length;
    const delayed=D.filter(d=>d.status==='지연').length;
    sub.textContent=`진행중 ${active}건 · 지연 ${delayed}건 · 전체 ${D.length}건`;
  }
  // 지연 경보
  const delayCard=document.getElementById('delayAlertCard');
  const delayMsg=document.getElementById('delayAlertMsg');
  const delayed=D.filter(d=>{
    if(d.status==='완료'||d.status==='폐기')return false;
    if(!d.endDate)return false;
    return new Date(d.endDate)<new Date();
  });
  if(delayed.length>0&&delayCard&&delayMsg){
    delayCard.style.display='';
    delayMsg.textContent=`${delayed.length}건의 LOT이 납기를 초과했습니다.`;
  }else if(delayCard){
    delayCard.style.display='none';
  }
  // 위젯 컨테이너
  renderWidgets();
}

function renderWidgets(){
  const container=document.getElementById('widgetContainer');
  if(!container)return;
  const config=widgetConfig.filter(w=>w.enabled).sort((a,b)=>a.order-b.order);
  let html='';
  config.forEach(w=>{
    switch(w.id){
      case 'kpiGrid':html+=renderKPI();break;
      case 'pipeline':html+=renderPipeline();break;
      case 'todayTask':html+=renderTodayTask();break;
      case 'preventAlert':html+=renderPreventAlert();break;
      case 'charts':html+=renderCharts();break;
      case 'recentActivity':html+=renderRecentActivity();break;
      case 'equipStatus':html+=renderEquipStatus();break;
      case 'kanban':html+=renderKanban();break;
    }
  });
  container.innerHTML=html;
  // 차트 그리기
  if(config.find(w=>w.id==='charts')){
    drawDonutChart();
    drawWeeklyChart();
  }
}

function renderKPI(){
  const active=D.filter(d=>d.status!=='완료'&&d.status!=='폐기');
  const done=D.filter(d=>d.status==='완료');
  const delayed=D.filter(d=>d.status==='지연');
  const today=fD(new Date());
  const todayDone=D.filter(d=>{
    const procs=d.processes||{};
    return Object.values(procs).some(p=>p.actualEnd===today&&p.status==='완료');
  }).length;
  return`<div class="grid4" style="margin-bottom:16px">
    <div class="kpi-card"><div class="kpi-value" style="color:var(--ac1)">${active.length}</div><div class="kpi-label">진행중</div></div>
    <div class="kpi-card"><div class="kpi-value" style="color:var(--green)">${done.length}</div><div class="kpi-label">완료</div></div>
    <div class="kpi-card"><div class="kpi-value" style="color:var(--err)">${delayed.length}</div><div class="kpi-label">지연</div></div>
    <div class="kpi-card"><div class="kpi-value" style="color:var(--cyan)">${todayDone}</div><div class="kpi-label">오늘 완료</div></div>
  </div>`;
}

function renderPipeline(){
  const route=PROC_ORDER;
  const counts={};
  route.forEach(p=>counts[p]=0);
  D.filter(d=>d.status!=='완료'&&d.status!=='폐기').forEach(d=>{
    const cur=getCurrentProcess(d);
    if(cur&&counts[cur]!==undefined)counts[cur]++;
  });
  let html='<div class="card" style="margin-bottom:16px"><div class="card-title">🔄 라이브 파이프라인</div><div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center">';
  route.forEach((p,i)=>{
    html+=`<div style="flex:1;min-width:60px;text-align:center;padding:10px 4px;background:${PROC_COLORS[p]}22;border-radius:8px;border:1px solid ${PROC_COLORS[p]}44">
      <div style="font-size:20px;font-weight:700;color:${PROC_COLORS[p]}">${counts[p]}</div>
      <div style="font-size:10px;color:var(--t2);margin-top:2px">${p}</div>
    </div>`;
    if(i<route.length-1)html+='<div style="color:var(--t2)">></div>';
  });
  return html+'</div></div>';
}

function renderTodayTask(){
  const today=fD(new Date());
  const tasks=D.filter(d=>{
    if(d.status==='완료'||d.status==='폐기')return false;
    const procs=d.processes||{};
    const cur=getCurrentProcess(d);
    if(!cur)return false;
    const p=procs[cur];
    if(!p)return false;
    return p.startDate<=today&&(!p.planEnd||p.planEnd>=today);
  }).slice(0,8);
  if(!tasks.length)return'<div class="card" style="margin-bottom:16px"><div class="card-title">📌 오늘 할 일</div><div style="padding:16px;text-align:center;color:var(--t2);font-size:13px">오늘 예정된 작업이 없습니다</div></div>';
  let html='<div class="card" style="margin-bottom:16px"><div class="card-title">📌 오늘 할 일</div><div style="display:flex;flex-direction:column;gap:6px">';
  tasks.forEach(d=>{
    const cur=getCurrentProcess(d);
    html+=`<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:8px;background:var(--bg3);cursor:pointer" onclick="openSidePanel('${esc(d.sn)}')">
      <div style="width:8px;height:8px;border-radius:50%;background:${PROC_COLORS[cur]||'#888'}"></div>
      <span style="font-size:12px;font-weight:500;flex:1">${d.sn}</span>
      <span style="font-size:11px;color:${PROC_COLORS[cur]||'#888'}">${cur}</span>
      ${statusBadge(d.status)}
    </div>`;
  });
  return html+'</div></div>';
}

function renderPreventAlert(){
  const today=new Date();
  const alerts=[];
  D.filter(d=>d.status!=='완료'&&d.status!=='폐기').forEach(d=>{
    if(d.endDate){
      const end=new Date(d.endDate);
      const diff=diffBD(today,end);
      if(diff<=3&&diff>=0)alerts.push({sn:d.sn,msg:`납기 D-${diff}`,type:'warn'});
      if(diff<0)alerts.push({sn:d.sn,msg:`납기 ${Math.abs(diff)}일 초과`,type:'err'});
    }
  });
  if(!alerts.length)return'';
  let html='<div class="card" style="margin-bottom:16px"><div class="card-title">🔔 예방적 알림</div><div style="display:flex;flex-direction:column;gap:4px">';
  alerts.slice(0,6).forEach(a=>{
    const color=a.type==='err'?'var(--err)':'var(--warn)';
    html+=`<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;border-left:3px solid ${color};background:var(--bg3);cursor:pointer" onclick="openSidePanel('${esc(a.sn)}')">
      <span style="font-size:12px;flex:1">${a.sn}</span>
      <span style="font-size:11px;color:${color}">${a.msg}</span>
    </div>`;
  });
  if(alerts.length>6)html+=`<div style="font-size:11px;color:var(--t2);text-align:center;padding:4px">+${alerts.length-6}건 더</div>`;
  return html+'</div></div>';
}

function renderCharts(){
  return`<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
    <div class="card"><div class="card-title">상태 분포</div><canvas id="homeDonut" height="200"></canvas></div>
    <div class="card"><div class="card-title">주간 완료</div><canvas id="homeWeekly" height="200"></canvas></div>
  </div>`;
}

function renderRecentActivity(){
  const recent=D.filter(d=>d.processes).sort((a,b)=>{
    let maxA=0,maxB=0;
    Object.values(a.processes||{}).forEach(p=>{if(p.actualEnd){const t=new Date(p.actualEnd).getTime();if(t>maxA)maxA=t}});
    Object.values(b.processes||{}).forEach(p=>{if(p.actualEnd){const t=new Date(p.actualEnd).getTime();if(t>maxB)maxB=t}});
    return maxB-maxA;
  }).slice(0,5);
  if(!recent.length)return'';
  let html='<div class="card" style="margin-bottom:16px"><div class="card-title">🕐 최근 활동</div><div style="display:flex;flex-direction:column;gap:4px">';
  recent.forEach(d=>{
    let lastProc='',lastDate='';
    Object.entries(d.processes||{}).forEach(([name,info])=>{
      if(info.actualEnd&&(!lastDate||info.actualEnd>lastDate)){lastDate=info.actualEnd;lastProc=name}
    });
    if(lastProc)html+=`<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;background:var(--bg3);font-size:12px;cursor:pointer" onclick="openSidePanel('${esc(d.sn)}')">
      <span style="flex:1;font-weight:500">${d.sn}</span>
      <span style="color:${PROC_COLORS[lastProc]||'#888'}">${lastProc} 완료</span>
      <span style="color:var(--t2)">${lastDate}</span>
    </div>`;
  });
  return html+'</div></div>';
}

function renderEquipStatus(){return'<div class="card" style="margin-bottom:16px"><div class="card-title">🏭 설비 현황</div><div style="padding:16px;text-align:center;color:var(--t2);font-size:13px">Part 2에서 구현 예정</div></div>';}
function renderKanban(){return'<div class="card" style="margin-bottom:16px"><div class="card-title">🎯 드래그 보드</div><div style="padding:16px;text-align:center;color:var(--t2);font-size:13px">Part 2에서 구현 예정</div></div>';}

function drawDonutChart(){
  const canvas=document.getElementById('homeDonut');
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const rect=canvas.getBoundingClientRect();
  canvas.width=rect.width*2;canvas.height=rect.height*2;ctx.scale(2,2);
  const W=rect.width,H=rect.height,cx=W/2,cy=H/2,r=Math.min(W,H)/2-20;
  const statMap={};D.forEach(d=>{const s=d.status||'대기';statMap[s]=(statMap[s]||0)+1});
  const colors={'대기':'#64748b','진행':'#6366f1','완료':'#22c55e','지연':'#ef4444','폐기':'#78716c'};
  const entries=Object.entries(statMap);
  const total=entries.reduce((a,b)=>a+b[1],0)||1;
  let startAngle=-Math.PI/2;
  entries.forEach(([status,count])=>{
    const angle=(count/total)*Math.PI*2;
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,startAngle,startAngle+angle);ctx.closePath();
    ctx.fillStyle=colors[status]||'#888';ctx.fill();
    // 라벨
    if(count>0){
      const mid=startAngle+angle/2;
      const lx=cx+Math.cos(mid)*(r*0.65);
      const ly=cy+Math.sin(mid)*(r*0.65);
      ctx.fillStyle='#fff';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(`${status}`,lx,ly-6);
      ctx.font='10px sans-serif';ctx.fillText(`${count}건`,lx,ly+7);
    }
    startAngle+=angle;
  });
  // 가운데 구멍
  ctx.beginPath();ctx.arc(cx,cy,r*0.45,0,Math.PI*2);ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--bg2').trim()||'#1a1f2e';ctx.fill();
  ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--t1').trim()||'#fff';
  ctx.font='bold 16px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(D.length+'건',cx,cy);
}

function drawWeeklyChart(){
  const canvas=document.getElementById('homeWeekly');
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const rect=canvas.getBoundingClientRect();
  canvas.width=rect.width*2;canvas.height=rect.height*2;ctx.scale(2,2);
  const W=rect.width,H=rect.height;
  const pad={top:10,bottom:30,left:30,right:10};
  const chartW=W-pad.left-pad.right,chartH=H-pad.top-pad.bottom;
  // 최근 7일 완료 수
  const days=[];
  for(let i=6;i>=0;i--){const dt=new Date();dt.setDate(dt.getDate()-i);days.push(fD(dt))}
  const counts=days.map(day=>D.filter(d=>{
    const procs=d.processes||{};
    return Object.values(procs).some(p=>p.actualEnd===day&&p.status==='완료');
  }).length);
  const maxVal=Math.max(...counts,1);
  const barW=chartW/7;
  counts.forEach((cnt,i)=>{
    const x=pad.left+i*barW;
    const h=(cnt/maxVal)*chartH;
    ctx.fillStyle='rgba(99,102,241,0.7)';
    ctx.beginPath();ctx.roundRect(x+4,pad.top+chartH-h,barW-8,h,[4,4,0,0]);ctx.fill();
    if(cnt>0){ctx.fillStyle='#fff';ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillText(cnt,x+barW/2,pad.top+chartH-h-5)}
    ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--t2').trim()||'#888';
    ctx.font='10px sans-serif';ctx.textAlign='center';
    const label=days[i].slice(5);
    ctx.fillText(label,x+barW/2,H-8);
  });
}

/* ── 플레이스홀더 (Part 2에서 교체) ── */
function renderSettings(){
  const ds=document.getElementById('dataStats');
  if(ds){
    const active=D.filter(d=>d.status!=='완료'&&d.status!=='폐기').length;
    ds.innerHTML=`<div style="text-align:center"><div style="font-size:20px;font-weight:700">${D.length}</div><div style="font-size:12px;color:var(--t2)">전체 LOT</div></div>
    <div style="text-align:center"><div style="font-size:20px;font-weight:700">${active}</div><div style="font-size:12px;color:var(--t2)">진행중</div></div>
    <div style="text-align:center"><div style="font-size:20px;font-weight:700">${PRODS.length}</div><div style="font-size:12px;color:var(--t2)">제품 수</div></div>
    <div style="text-align:center"><div style="font-size:20px;font-weight:700">${D.filter(d=>d.status==='지연').length}</div><div style="font-size:12px;color:var(--t2)">지연</div></div>`;
  }
  // Gemini 키 상태
  const keyStatus=document.getElementById('geminiKeyStatus');
  const key=localStorage.getItem('gemini_api_key');
  if(keyStatus)keyStatus.textContent=key?'✅ API 키가 저장되어 있습니다':'키가 설정되지 않았습니다';
  const keyInput=document.getElementById('geminiKeyInput');
  if(keyInput&&key)keyInput.value=key;
}

/* ── 위젯 설정 ── */
function openWidgetSettings(){
  const list=document.getElementById('widgetSettingsList');
  if(list){
    list.innerHTML=widgetConfig.sort((a,b)=>a.order-b.order).map(w=>
      `<div style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:6px;background:var(--bg3);margin-bottom:4px">
        <input type="checkbox" ${w.enabled?'checked':''} onchange="toggleWidget('${w.id}',this.checked)">
        <span style="flex:1;font-size:13px">${w.label}</span>
        <span style="font-size:11px;color:var(--t2)">#${w.order}</span>
      </div>`
    ).join('');
  }
  openModal('widgetModal');
}
window.openWidgetSettings=openWidgetSettings;
window.toggleWidget=function(id,checked){const w=widgetConfig.find(x=>x.id===id);if(w)w.enabled=checked};
window.saveWidgetConfig=function(){localStorage.setItem('esc_widget_config',JSON.stringify(widgetConfig));closeModal('widgetModal');renderHome();toast('위젯 설정 저장됨')};
window.resetWidgetConfig=function(){widgetConfig=JSON.parse(JSON.stringify(DEFAULT_WIDGETS));localStorage.removeItem('esc_widget_config');closeModal('widgetModal');renderHome();toast('기본값으로 복원')};

/* ── Gemini API 키 저장 ── */
window.saveGeminiKey=function(){const key=document.getElementById('geminiKeyInput')?.value.trim();if(key){localStorage.setItem('gemini_api_key',key);toast('API 키 저장됨');renderSettings();}else{toast('키를 입력하세요','warn')}};

console.log('✅ Part 1 로드 완료');
// ═══════════════════════════════════════════════════════════
// Part 1 끝 — Part 2는 여기 아래에 이어 붙입니다
// ═══════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════
// Part 2 — 워크스페이스 · 캘린더 · 간트차트
// ═══════════════════════════════════════════════════════════

/* ══════════════════════════════════════════════
   2-1. 워크스페이스 (작업관리)
   ══════════════════════════════════════════════ */

function setWsView(mode,btn){
  wsViewMode=mode;
  document.querySelectorAll('#workspaceTab .tab-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderWorkspace();
}
window.setWsView=setWsView;

function toggleFilter(f){
  if(f==='전체'){wsFilters=['전체'];}
  else{wsFilters=wsFilters.filter(x=>x!=='전체');const idx=wsFilters.indexOf(f);if(idx>=0)wsFilters.splice(idx,1);else wsFilters.push(f);if(!wsFilters.length)wsFilters=['전체'];}
  document.querySelectorAll('#filterChips .chip').forEach(c=>{c.classList.toggle('active',wsFilters.includes(c.dataset.f))});
  renderWorkspace();
}
window.toggleFilter=toggleFilter;

function toggleAllGroups(){
  const allOpen=Object.values(wsGroups).every(v=>v);
  Object.keys(wsGroups).forEach(k=>wsGroups[k]=!allOpen);
  const btn=document.getElementById('expandAllBtn');
  if(btn)btn.textContent=allOpen?'모두 펼치기':'모두 접기';
  renderWorkspace();
}
window.toggleAllGroups=toggleAllGroups;

function toggleGroup(key){
  wsGroups[key]=!wsGroups[key];
  renderWorkspace();
}
window.toggleGroup=toggleGroup;

function renderWorkspace(){
  const table=document.getElementById('wsTable');
  if(!table)return;
  const search=(document.getElementById('wsSearch')?.value||'').toLowerCase();

  // 필터링
  let filtered=D.filter(d=>{
    if(!wsFilters.includes('전체')&&!wsFilters.includes(d.status||'대기'))return false;
    if(search){
      const s=search;
      if(!(d.sn||'').toLowerCase().includes(s)&&!(d.productName||'').toLowerCase().includes(s)&&!(d.batchId||'').toLowerCase().includes(s)&&!(d.customer||'').toLowerCase().includes(s))return false;
    }
    return true;
  });

  // 카운트 표시
  const countEl=document.getElementById('wsSearchCount');
  if(countEl)countEl.textContent=search?`${filtered.length}건 검색됨`:'';

  // 그룹핑
  const groups={};
  const groupKey=wsViewMode==='batch'?'batchId':'productName';
  filtered.forEach(d=>{
    const key=d[groupKey]||'미분류';
    if(!groups[key])groups[key]=[];
    groups[key].push(d);
  });

  // 그룹 초기화
  Object.keys(groups).forEach(k=>{if(wsGroups[k]===undefined)wsGroups[k]=true});

  if(!filtered.length){
    table.innerHTML='<div style="padding:40px;text-align:center;color:var(--t2)">조건에 맞는 데이터가 없습니다</div>';
    return;
  }

  let html='';
  const sortedKeys=Object.keys(groups).sort();

  sortedKeys.forEach(key=>{
    const items=groups[key];
    const isOpen=wsGroups[key]!==false;
    const doneCount=items.filter(d=>d.status==='완료').length;
    const prog=items.length>0?Math.round(doneCount/items.length*100):0;

    html+=`<div class="ws-group">
      <div class="ws-group-header" onclick="toggleGroup('${esc(key)}')" style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg3);border-radius:8px;margin-bottom:4px;cursor:pointer;user-select:none">
        <span style="transition:transform 0.2s;transform:rotate(${isOpen?90:0}deg)">▶</span>
        <span style="font-weight:600;font-size:14px;flex:1">${key}</span>
        <span style="font-size:12px;color:var(--t2)">${items.length}건</span>
        <div style="width:60px;height:6px;background:var(--bg4);border-radius:3px;overflow:hidden">
          <div style="width:${prog}%;height:100%;background:var(--green);border-radius:3px;transition:width 0.3s"></div>
        </div>
        <span style="font-size:11px;color:var(--t2);min-width:32px">${prog}%</span>
      </div>`;

    if(isOpen){
      html+=`<table class="ws-table"><thead><tr>
        <th style="width:30px"><input type="checkbox" onchange="toggleGroupSelect('${esc(key)}',this.checked)"></th>
        <th>S/N</th><th>공정</th><th>상태</th><th>설비</th><th>진행률</th><th>D+</th><th>납기</th>
      </tr></thead><tbody>`;

      items.forEach(d=>{
        const cur=getCurrentProcess(d);
        const prog=calcProgress(d);
        const dplus=getDplus(d);
        const isSelected=selectedSNs.has(d.sn);
        const isLate=d.endDate&&new Date(d.endDate)<new Date()&&d.status!=='완료'&&d.status!=='폐기';

        html+=`<tr class="${isSelected?'selected':''}" style="${isLate?'background:rgba(239,68,68,0.06);':''}" onclick="openSidePanel('${esc(d.sn)}')">
          <td onclick="event.stopPropagation()"><input type="checkbox" ${isSelected?'checked':''} onchange="toggleSNSelect('${esc(d.sn)}',this.checked)"></td>
          <td><div style="font-weight:500;font-size:12px">${d.sn||'-'}</div><div style="font-size:10px;color:var(--t2)">${d.category||''} · ${d.sheetNo||''}</div></td>
          <td><span style="color:${PROC_COLORS[cur]||'var(--t2)'};font-size:12px;font-weight:500">${cur||'-'}</span></td>
          <td>${statusBadge(d.status)}</td>
          <td style="font-size:11px;color:var(--t2)">${d.equipment||d.processes?.[cur]?.equip||'-'}</td>
          <td><div style="display:flex;align-items:center;gap:4px"><div style="width:50px;height:5px;background:var(--bg4);border-radius:3px;overflow:hidden"><div style="width:${prog}%;height:100%;background:${prog===100?'var(--green)':'var(--ac1)'};border-radius:3px"></div></div><span style="font-size:10px;min-width:28px">${prog}%</span></div></td>
          <td style="font-size:11px;${isLate?'color:var(--err);font-weight:600':''}">${dplus}</td>
          <td style="font-size:11px;${isLate?'color:var(--err)':'color:var(--t2)'}">${d.endDate||'-'}</td>
        </tr>`;
      });

      html+='</tbody></table>';
    }
    html+='</div>';
  });

  table.innerHTML=html;
  updateBatchBar();
}

function toggleSNSelect(sn,checked){
  if(checked)selectedSNs.add(sn);else selectedSNs.delete(sn);
  updateBatchBar();
  renderWorkspace();
}
window.toggleSNSelect=toggleSNSelect;

function toggleGroupSelect(key,checked){
  const groupKey=wsViewMode==='batch'?'batchId':'productName';
  D.filter(d=>(d[groupKey]||'미분류')===key).forEach(d=>{
    if(checked)selectedSNs.add(d.sn);else selectedSNs.delete(d.sn);
  });
  updateBatchBar();
  renderWorkspace();
}
window.toggleGroupSelect=toggleGroupSelect;

function clearSelection(){selectedSNs.clear();updateBatchBar();renderWorkspace()}
window.clearSelection=clearSelection;

function updateBatchBar(){
  const bar=document.getElementById('batchBar');
  const count=document.getElementById('batchCount');
  if(!bar)return;
  if(selectedSNs.size>0){
    bar.style.display='flex';
    if(count)count.textContent=`${selectedSNs.size}건 선택`;
  }else{
    bar.style.display='none';
  }
}

/* ── 일괄 상태 변경 ── */
async function applyBatch(){
  const status=document.getElementById('batchStatusSel')?.value;
  if(!status){toast('상태를 선택하세요','warn');return}
  if(!selectedSNs.size){toast('선택된 항목이 없습니다','warn');return}
  const batch=writeBatch(db);
  const items=D.filter(d=>selectedSNs.has(d.sn));
  items.forEach(d=>{
    const ref=doc(db,'production',d._id);
    batch.update(ref,{status,updatedAt:fD(new Date())});
  });
  try{
    await batch.commit();
    toast(`${items.length}건 상태 → ${status} 변경`);
    clearSelection();
  }catch(e){toast('일괄 변경 실패','err');console.error(e)}
}
window.applyBatch=applyBatch;

async function applyNG(){
  if(!selectedSNs.size){toast('선택된 항목이 없습니다','warn');return}
  if(!confirm(`${selectedSNs.size}건을 폐기 처리하시겠습니까?`))return;
  const batch=writeBatch(db);
  D.filter(d=>selectedSNs.has(d.sn)).forEach(d=>{
    batch.update(doc(db,'production',d._id),{status:'폐기',updatedAt:fD(new Date())});
  });
  try{await batch.commit();toast(`${selectedSNs.size}건 폐기 처리`);clearSelection()}catch(e){toast('처리 실패','err')}
}
window.applyNG=applyNG;

/* ══════════════════════════════════════════════
   2-2. 캘린더
   ══════════════════════════════════════════════ */

function setCalView(view,btn){
  calView=view;
  document.querySelectorAll('#calendarTab .tab-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderCalendar();
}
window.setCalView=setCalView;

function calPrev(){
  if(calView==='month')calDate.setMonth(calDate.getMonth()-1);
  else calDate.setDate(calDate.getDate()-7);
  renderCalendar();
}
window.calPrev=calPrev;

function calNext(){
  if(calView==='month')calDate.setMonth(calDate.getMonth()+1);
  else calDate.setDate(calDate.getDate()+7);
  renderCalendar();
}
window.calNext=calNext;

function calToday(){calDate=new Date();renderCalendar()}
window.calToday=calToday;

function renderCalendar(){
  const title=document.getElementById('calTitle');
  const content=document.getElementById('calContent');
  if(!content)return;

  if(calView==='month'){
    renderMonthCal(title,content);
  }else if(calView==='week'){
    renderWeekCal(title,content);
  }else{
    renderIssueBoard(title,content);
  }
}

function renderMonthCal(titleEl,contentEl){
  const year=calDate.getFullYear();
  const month=calDate.getMonth();
  if(titleEl)titleEl.textContent=`${year}년 ${month+1}월`;

  const firstDay=new Date(year,month,1).getDay();
  const lastDate=new Date(year,month+1,0).getDate();
  const todayStr=fD(new Date());

  // 날짜별 이벤트
  const eventMap={};
  D.forEach(d=>{
    const procs=d.processes||{};
    Object.entries(procs).forEach(([proc,info])=>{
      ['startDate','planEnd','actualEnd'].forEach(field=>{
        if(info[field]){
          const dt=new Date(info[field]);
          if(dt.getFullYear()===year&&dt.getMonth()===month){
            const day=dt.getDate();
            if(!eventMap[day])eventMap[day]=[];
            eventMap[day].push({sn:d.sn,proc,field,status:info.status});
          }
        }
      });
    });
    if(d.endDate){
      const dt=new Date(d.endDate);
      if(dt.getFullYear()===year&&dt.getMonth()===month){
        const day=dt.getDate();
        if(!eventMap[day])eventMap[day]=[];
        eventMap[day].push({sn:d.sn,proc:'납기',field:'endDate',isDue:true});
      }
    }
  });

  let html='<div class="cal-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">';
  ['일','월','화','수','목','금','토'].forEach((d,i)=>{
    html+=`<div style="text-align:center;padding:8px;font-weight:600;font-size:12px;color:${i===0?'var(--err)':i===6?'var(--ac1)':'var(--t2)'}">${d}</div>`;
  });

  for(let i=0;i<firstDay;i++)html+='<div class="cal-cell" style="min-height:70px;padding:4px;border:1px solid transparent"></div>';

  for(let day=1;day<=lastDate;day++){
    const dateStr=`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const isToday=dateStr===todayStr;
    const dow=new Date(year,month,day).getDay();
    const events=eventMap[day]||[];
    const dots=events.slice(0,3).map(e=>{
      const color=e.isDue?'var(--err)':PROC_COLORS[e.proc]||'var(--ac1)';
      return`<div style="font-size:8px;padding:1px 3px;border-radius:2px;background:${color}33;color:${color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.sn?.slice(-6)||''}</div>`;
    }).join('');
    const more=events.length>3?`<div style="font-size:8px;color:var(--t2)">+${events.length-3}</div>`:'';

    html+=`<div class="cal-cell" style="min-height:70px;padding:4px;border:1px solid var(--border);border-radius:4px;cursor:pointer;${isToday?'background:rgba(99,102,241,0.08);border-color:var(--ac1);':''}" onclick="showCalDay('${dateStr}')">
      <div style="font-size:11px;font-weight:${isToday?'700':'400'};color:${dow===0?'var(--err)':dow===6?'var(--ac1)':isToday?'var(--ac1)':'var(--t1)'};margin-bottom:2px">${day}</div>
      ${dots}${more}
    </div>`;
  }
  html+='</div>';
  contentEl.innerHTML=html;
}

function renderWeekCal(titleEl,contentEl){
  const start=new Date(calDate);
  start.setDate(start.getDate()-start.getDay());
  const end=new Date(start);end.setDate(end.getDate()+6);
  if(titleEl)titleEl.textContent=`${fD(start)} ~ ${fD(end)}`;

  let html='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">';
  for(let i=0;i<7;i++){
    const dt=new Date(start);dt.setDate(dt.getDate()+i);
    const dateStr=fD(dt);
    const isToday=dateStr===fD(new Date());
    const dow=['일','월','화','수','목','금','토'][dt.getDay()];

    const dayItems=D.filter(d=>{
      const procs=d.processes||{};
      return Object.values(procs).some(p=>p.startDate===dateStr||p.planEnd===dateStr||p.actualEnd===dateStr);
    });

    html+=`<div class="card" style="padding:8px;${isToday?'border-color:var(--ac1);background:rgba(99,102,241,0.05)':''}">
      <div style="font-size:11px;font-weight:600;margin-bottom:6px;color:${isToday?'var(--ac1)':'var(--t2)'}">${dow} ${dt.getDate()}</div>`;
    dayItems.slice(0,5).forEach(d=>{
      const cur=getCurrentProcess(d);
      html+=`<div style="font-size:10px;padding:3px 5px;border-radius:3px;margin-bottom:2px;border-left:2px solid ${PROC_COLORS[cur]||'#888'};background:var(--bg3);cursor:pointer" onclick="openSidePanel('${esc(d.sn)}')">${d.sn?.slice(-8)||'-'}</div>`;
    });
    if(dayItems.length>5)html+=`<div style="font-size:9px;color:var(--t2)">+${dayItems.length-5}</div>`;
    html+='</div>';
  }
  html+='</div>';
  contentEl.innerHTML=html;
}

function renderIssueBoard(titleEl,contentEl){
  if(titleEl)titleEl.textContent='이슈 보드';
  const issues=D.filter(d=>d.defectProcess||d.defectType||d.status==='지연');
  if(!issues.length){contentEl.innerHTML='<div style="padding:40px;text-align:center;color:var(--t2)">등록된 이슈가 없습니다</div>';return}

  let html='<div style="display:flex;flex-direction:column;gap:6px">';
  issues.forEach(d=>{
    html+=`<div class="card" style="padding:12px;cursor:pointer;border-left:3px solid var(--err)" onclick="openSidePanel('${esc(d.sn)}')">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-weight:500;font-size:13px">${d.sn}</span>
        ${statusBadge(d.status)}
      </div>
      <div style="font-size:12px;color:var(--t2);margin-top:4px">
        ${d.defectProcess?`공정: ${d.defectProcess}`:''} ${d.defectType?`· 유형: ${d.defectType}`:''}
        ${!d.defectProcess&&!d.defectType?'지연 상태':''}
      </div>
    </div>`;
  });
  html+='</div>';
  contentEl.innerHTML=html;
}

function showCalDay(dateStr){
  const items=[];
  D.forEach(d=>{
    const procs=d.processes||{};
    Object.entries(procs).forEach(([proc,info])=>{
      if(info.startDate===dateStr||info.planEnd===dateStr||info.actualEnd===dateStr){
        items.push({sn:d.sn,proc,info});
      }
    });
  });
  if(!items.length){toast(`${dateStr} — 일정 없음`);return}
  // 간단히 첫 번째 아이템의 사이드패널 열기
  openSidePanel(items[0].sn);
}
window.showCalDay=showCalDay;


/* ══════════════════════════════════════════════
   2-3. 간트차트
   ══════════════════════════════════════════════ */

function setGanttView(view,btn){
  ganttView=view;
  document.querySelectorAll('.gantt-view-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  renderGantt();
}
window.setGanttView=setGanttView;

function ganttZoom(delta){
  ganttDayW=Math.max(8,Math.min(60,ganttDayW+delta));
  document.getElementById('ganttZoomLabel').textContent=ganttDayW+'px';
  renderGantt();
}
window.ganttZoom=ganttZoom;

function ganttGoToday(){
  const body=document.getElementById('ganttBodyWrap');
  const header=document.getElementById('ganttHeaderWrap');
  if(!body)return;
  const allDates=[];
  D.forEach(d=>{
    if(d.startDate)allDates.push(new Date(d.startDate));
    const procs=d.processes||{};
    Object.values(procs).forEach(p=>{if(p.startDate)allDates.push(new Date(p.startDate))});
  });
  if(!allDates.length)return;
  const minDate=new Date(Math.min(...allDates.map(d=>d.getTime())));
  const today=new Date();
  const dayOffset=Math.floor((today-minDate)/86400000);
  const scrollX=dayOffset*ganttDayW-body.clientWidth/2;
  body.scrollLeft=scrollX;
  if(header)header.scrollLeft=scrollX;
}
window.ganttGoToday=ganttGoToday;

function ganttToggleAll(){
  ganttAllExpanded=!ganttAllExpanded;
  Object.keys(ganttExpandState).forEach(k=>ganttExpandState[k]=ganttAllExpanded);
  const btn=document.getElementById('ganttExpandAllBtn');
  if(btn)btn.textContent=ganttAllExpanded?'모두 접기':'모두 펼치기';
  renderGantt();
}
window.ganttToggleAll=ganttToggleAll;

function renderGantt(){
  const header=document.getElementById('ganttHeader');
  const sidebar=document.getElementById('ganttSidebar');
  const body=document.getElementById('ganttBody');
  const headerWrap=document.getElementById('ganttHeaderWrap');
  const bodyWrap=document.getElementById('ganttBodyWrap');
  if(!header||!sidebar||!body)return;

  // 필터
  const prodFilter=document.getElementById('ganttProdFilter')?.value||'';
  const statusFilter=document.getElementById('ganttStatusFilter')?.value||'';
  let filtered=D.filter(d=>{
    if(prodFilter&&d.productName!==prodFilter)return false;
    if(statusFilter&&d.status!==statusFilter)return false;
    return true;
  });

  // 제품 필터 옵션 업데이트
  const prodSelect=document.getElementById('ganttProdFilter');
  if(prodSelect&&prodSelect.options.length<=1){
    const prods=[...new Set(D.map(d=>d.productName).filter(Boolean))].sort();
    prods.forEach(p=>{const o=document.createElement('option');o.value=p;o.textContent=p;prodSelect.appendChild(o)});
  }

  // 날짜 범위
  let allDates=[];
  filtered.forEach(d=>{
    if(d.startDate)allDates.push(new Date(d.startDate));
    if(d.endDate)allDates.push(new Date(d.endDate));
    const procs=d.processes||{};
    Object.values(procs).forEach(p=>{
      if(p.startDate)allDates.push(new Date(p.startDate));
      if(p.planEnd)allDates.push(new Date(p.planEnd));
      if(p.actualEnd)allDates.push(new Date(p.actualEnd));
    });
  });
  if(!allDates.length){
    sidebar.innerHTML='<div style="padding:20px;color:var(--t2);font-size:12px">데이터 없음</div>';
    header.innerHTML='';body.innerHTML='';return;
  }

  const minDate=new Date(Math.min(...allDates.map(d=>d.getTime())));
  const maxDate=new Date(Math.max(...allDates.map(d=>d.getTime())));
  minDate.setDate(minDate.getDate()-3);
  maxDate.setDate(maxDate.getDate()+7);
  const totalDays=Math.ceil((maxDate-minDate)/86400000);
  const chartW=totalDays*ganttDayW;

  // 헤더
  let headerHtml='';
  const todayStr=fD(new Date());
  for(let i=0;i<totalDays;i++){
    const dt=new Date(minDate.getTime()+i*86400000);
    const ds=fD(dt);
    const isToday=ds===todayStr;
    const isSun=dt.getDay()===0;
    const isSat=dt.getDay()===6;
    const isFirstOfMonth=dt.getDate()===1;
    headerHtml+=`<div class="gantt-day${isToday?' today':''}" style="min-width:${ganttDayW}px;text-align:center;font-size:${ganttDayW>20?'9':'7'}px;padding:2px 0;${isToday?'background:var(--ac1);color:#fff;border-radius:3px;':isSun?'color:var(--err);':isSat?'color:var(--ac1);':'color:var(--t2);'}${isFirstOfMonth?'border-left:1px solid var(--ac1);':''}">${ganttDayW>15?dt.getDate():''}</div>`;
  }
  header.style.width=chartW+'px';
  header.innerHTML=headerHtml;

  // 그룹핑
  const groups={};
  if(ganttView==='product'){
    filtered.forEach(d=>{const k=d.productName||'미분류';if(!groups[k])groups[k]=[];groups[k].push(d)});
  }else if(ganttView==='batch'){
    filtered.forEach(d=>{const k=d.batchId||'미분류';if(!groups[k])groups[k]=[];groups[k].push(d)});
  }else{
    PROC_ORDER.forEach(p=>{groups[p]=filtered.filter(d=>{const route=(d.route||'').split(/[→>]/).map(s=>s.trim());return route.includes(p)})});
  }

  let sideHtml='';
  let bodyHtml='';
  const rowH=28;

  Object.entries(groups).forEach(([key,items])=>{
    if(ganttExpandState[key]===undefined)ganttExpandState[key]=true;
    const isOpen=ganttExpandState[key];

    sideHtml+=`<div class="gantt-group-header" style="height:${rowH}px;display:flex;align-items:center;gap:4px;padding:0 8px;background:var(--bg3);cursor:pointer;font-size:11px;font-weight:600;border-bottom:1px solid var(--border)" onclick="ganttExpandState['${esc(key)}']=!ganttExpandState['${esc(key)}'];renderGantt()">
      <span style="transform:rotate(${isOpen?90:0}deg);transition:0.2s;font-size:9px">▶</span>${key} (${items.length})
    </div>`;
    bodyHtml+=`<div style="height:${rowH}px;width:${chartW}px;background:var(--bg3);border-bottom:1px solid var(--border)"></div>`;

    if(isOpen){
      items.forEach(d=>{
        sideHtml+=`<div style="height:${rowH}px;display:flex;align-items:center;padding:0 8px;font-size:10px;border-bottom:1px solid var(--border);cursor:pointer;overflow:hidden;white-space:nowrap;text-overflow:ellipsis" onclick="openSidePanel('${esc(d.sn)}')" title="${d.sn}">${d.sn?.slice(-10)||'-'}</div>`;

        let bars='';
        const route=(d.route||'').split(/[→>]/).map(s=>s.trim()).filter(Boolean);
        const procs=d.processes||{};

        route.forEach(proc=>{
          const info=procs[proc];
          if(!info||!info.startDate)return;
          const start=new Date(info.startDate);
          const end=info.actualEnd?new Date(info.actualEnd):info.planEnd?new Date(info.planEnd):addBD(start,info.planDays||3);
          const offsetDays=Math.floor((start-minDate)/86400000);
          const durationDays=Math.max(Math.ceil((end-start)/86400000),1);
          const left=offsetDays*ganttDayW;
          const width=durationDays*ganttDayW;
          const color=PROC_COLORS[proc]||'#888';
          const isDone=info.status==='완료';

          bars+=`<div style="position:absolute;left:${left}px;width:${width}px;height:${rowH-8}px;top:4px;background:${isDone?color:color+'88'};border-radius:3px;font-size:8px;color:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;white-space:nowrap;cursor:pointer;${isDone?'':'border:1px dashed '+color}" title="${d.sn} — ${proc} (${info.startDate}~${info.planEnd||''})">${ganttDayW>14?proc.slice(0,2):''}</div>`;
        });

        // 오늘 선
        const todayOffset=Math.floor((new Date()-minDate)/86400000);

        bodyHtml+=`<div style="position:relative;height:${rowH}px;width:${chartW}px;border-bottom:1px solid var(--border)">${bars}</div>`;
      });
    }
  });

  sidebar.innerHTML=sideHtml;
  body.style.width=chartW+'px';
  body.innerHTML=bodyHtml;

  // 오늘 선
  const todayOffset=Math.floor((new Date()-minDate)/86400000);
  const todayLine=document.createElement('div');
  todayLine.style.cssText=`position:absolute;left:${todayOffset*ganttDayW}px;top:0;width:2px;height:100%;background:var(--ac1);opacity:0.6;pointer-events:none;z-index:2`;
  body.style.position='relative';
  body.appendChild(todayLine);

  // 스크롤 동기화
  if(bodyWrap&&headerWrap){
    bodyWrap.onscroll=()=>{headerWrap.scrollLeft=bodyWrap.scrollLeft};
  }
}

console.log('✅ Part 2 로드 완료');
// ═══════════════════════════════════════════════════════════
// Part 2 끝 — Part 3는 여기 아래에 이어 붙입니다
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// Part 3 — 분석 · AI 어시스턴트
// ═══════════════════════════════════════════════════════════

/* ══════════════════════════════════════════════
   3-1. 분석 탭
   ══════════════════════════════════════════════ */

function renderAnalysis(){
  // KPI
  const kpi=document.getElementById('analysisKpi');
  if(kpi){
    const active=D.filter(d=>d.status!=='완료'&&d.status!=='폐기').length;
    const done=D.filter(d=>d.status==='완료').length;
    const delayed=D.filter(d=>d.status==='지연').length;
    const avgProg=D.length?Math.round(D.reduce((a,d)=>a+calcProgress(d),0)/D.length):0;
    kpi.innerHTML=`
      <div class="kpi-card"><div class="kpi-value">${D.length}</div><div class="kpi-label">전체</div></div>
      <div class="kpi-card"><div class="kpi-value" style="color:var(--green)">${done}</div><div class="kpi-label">완료</div></div>
      <div class="kpi-card"><div class="kpi-value" style="color:var(--err)">${delayed}</div><div class="kpi-label">지연</div></div>
      <div class="kpi-card"><div class="kpi-value" style="color:var(--ac1)">${avgProg}%</div><div class="kpi-label">평균 진행률</div></div>`;
  }

  drawProdBarChart();
  drawAnalysisDonut();
  drawMonthLineChart();
  drawLeadtimeChart();
  drawDefectRateChart();
  drawDefectProcChart();
}

function drawProdBarChart(){
  const canvas=document.getElementById('prodBarChart');
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const rect=canvas.getBoundingClientRect();
  canvas.width=rect.width*2;canvas.height=rect.height*2;ctx.scale(2,2);
  const W=rect.width,H=rect.height;
  const pad={top:20,bottom:40,left:40,right:10};
  const cW=W-pad.left-pad.right,cH=H-pad.top-pad.bottom;

  const prodMap={};
  D.forEach(d=>{const p=d.productName||'미분류';prodMap[p]=(prodMap[p]||0)+1});
  const entries=Object.entries(prodMap).sort((a,b)=>b[1]-a[1]).slice(0,10);
  if(!entries.length)return;
  const maxVal=Math.max(...entries.map(e=>e[1]),1);
  const barW=cW/entries.length;

  entries.forEach(([name,cnt],i)=>{
    const x=pad.left+i*barW;
    const h=(cnt/maxVal)*cH;
    ctx.fillStyle='rgba(99,102,241,0.7)';
    ctx.beginPath();ctx.roundRect(x+4,pad.top+cH-h,barW-8,h,[4,4,0,0]);ctx.fill();
    ctx.fillStyle='#fff';ctx.font='bold 10px sans-serif';ctx.textAlign='center';
    ctx.fillText(cnt,x+barW/2,pad.top+cH-h-5);
    ctx.fillStyle=getCSSVar('--t2');ctx.font='9px sans-serif';
    const label=name.length>6?name.slice(0,6)+'…':name;
    ctx.save();ctx.translate(x+barW/2,H-5);ctx.rotate(-0.3);ctx.fillText(label,0,0);ctx.restore();
  });
}

function drawAnalysisDonut(){
  const canvas=document.getElementById('analysisDonut');
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const rect=canvas.getBoundingClientRect();
  canvas.width=rect.width*2;canvas.height=rect.height*2;ctx.scale(2,2);
  const W=rect.width,H=rect.height,cx=W/2,cy=H/2,r=Math.min(W,H)/2-30;
  const statMap={};D.forEach(d=>{const s=d.status||'대기';statMap[s]=(statMap[s]||0)+1});
  const colors={'대기':'#64748b','진행':'#6366f1','완료':'#22c55e','지연':'#ef4444','폐기':'#78716c'};
  const entries=Object.entries(statMap);
  const total=entries.reduce((a,b)=>a+b[1],0)||1;
  let angle=-Math.PI/2;
  entries.forEach(([s,c])=>{
    const a=(c/total)*Math.PI*2;
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,angle,angle+a);ctx.closePath();
    ctx.fillStyle=colors[s]||'#888';ctx.fill();
    if(c>0){const mid=angle+a/2;const lx=cx+Math.cos(mid)*r*0.7;const ly=cy+Math.sin(mid)*r*0.7;
    ctx.fillStyle='#fff';ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(s,lx,ly-6);ctx.font='10px sans-serif';ctx.fillText(c+'건',lx,ly+7)}
    angle+=a;
  });
  ctx.beginPath();ctx.arc(cx,cy,r*0.45,0,Math.PI*2);ctx.fillStyle=getCSSVar('--bg2')||'#1a1f2e';ctx.fill();
  ctx.fillStyle=getCSSVar('--t1')||'#fff';ctx.font='bold 14px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(D.length+'건',cx,cy);
}

function drawMonthLineChart(){
  const canvas=document.getElementById('monthLineChart');
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const rect=canvas.getBoundingClientRect();
  canvas.width=rect.width*2;canvas.height=rect.height*2;ctx.scale(2,2);
  const W=rect.width,H=rect.height;
  const pad={top:20,bottom:30,left:35,right:10};
  const cW=W-pad.left-pad.right,cH=H-pad.top-pad.bottom;

  // 최근 6개월
  const months=[];
  for(let i=5;i>=0;i--){const d=new Date();d.setMonth(d.getMonth()-i);months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);}
  const regData=months.map(m=>D.filter(d=>(d.registeredAt||'').startsWith(m)).length);
  const doneData=months.map(m=>D.filter(d=>{
    const procs=d.processes||{};
    return Object.values(procs).some(p=>(p.actualEnd||'').startsWith(m)&&p.status==='완료');
  }).length);
  const maxVal=Math.max(...regData,...doneData,1);

  // 그리드
  ctx.strokeStyle=getCSSVar('--border')||'#333';ctx.lineWidth=0.5;
  for(let i=0;i<=4;i++){const y=pad.top+cH*(1-i/4);ctx.beginPath();ctx.moveTo(pad.left,y);ctx.lineTo(W-pad.right,y);ctx.stroke();
    ctx.fillStyle=getCSSVar('--t2')||'#888';ctx.font='9px sans-serif';ctx.textAlign='right';ctx.fillText(Math.round(maxVal*i/4),pad.left-4,y+3)}

  // 투입 라인
  ctx.beginPath();ctx.strokeStyle='#6366f1';ctx.lineWidth=2;
  regData.forEach((v,i)=>{const x=pad.left+i*(cW/(months.length-1));const y=pad.top+cH*(1-v/maxVal);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)});
  ctx.stroke();
  // 점
  regData.forEach((v,i)=>{const x=pad.left+i*(cW/(months.length-1));const y=pad.top+cH*(1-v/maxVal);
    ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fillStyle='#6366f1';ctx.fill();
    if(v>0){ctx.fillStyle='#6366f1';ctx.font='9px sans-serif';ctx.textAlign='center';ctx.fillText(v,x,y-8)}
  });

  // 완료 라인
  ctx.beginPath();ctx.strokeStyle='#22c55e';ctx.lineWidth=2;
  doneData.forEach((v,i)=>{const x=pad.left+i*(cW/(months.length-1));const y=pad.top+cH*(1-v/maxVal);i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)});
  ctx.stroke();
  doneData.forEach((v,i)=>{const x=pad.left+i*(cW/(months.length-1));const y=pad.top+cH*(1-v/maxVal);
    ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fillStyle='#22c55e';ctx.fill();
    if(v>0){ctx.fillStyle='#22c55e';ctx.font='9px sans-serif';ctx.textAlign='center';ctx.fillText(v,x,y-8)}
  });

  // X축 라벨
  months.forEach((m,i)=>{const x=pad.left+i*(cW/(months.length-1));
    ctx.fillStyle=getCSSVar('--t2');ctx.font='10px sans-serif';ctx.textAlign='center';ctx.fillText(m.slice(5)+'월',x,H-6)});

  // 범례
  ctx.fillStyle='#6366f1';ctx.fillRect(W-90,4,10,3);ctx.fillStyle=getCSSVar('--t1');ctx.font='9px sans-serif';ctx.textAlign='left';ctx.fillText('투입',W-76,8);
  ctx.fillStyle='#22c55e';ctx.fillRect(W-48,4,10,3);ctx.fillStyle=getCSSVar('--t1');ctx.fillText('완료',W-34,8);
}

function drawLeadtimeChart(){
  const canvas=document.getElementById('leadtimeChart');
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const rect=canvas.getBoundingClientRect();
  canvas.width=rect.width*2;canvas.height=rect.height*2;ctx.scale(2,2);
  const W=rect.width,H=rect.height;
  const pad={top:20,bottom:30,left:40,right:10};
  const cW=W-pad.left-pad.right,cH=H-pad.top-pad.bottom;

  // 공정별 계획 vs 실제 평균
  const procStats={};
  PROC_ORDER.forEach(p=>procStats[p]={planTotal:0,actualTotal:0,count:0});
  D.forEach(d=>{
    const procs=d.processes||{};
    Object.entries(procs).forEach(([name,info])=>{
      if(procStats[name]&&info.planDays){
        procStats[name].planTotal+=info.planDays;
        procStats[name].actualTotal+=(info.actualDays||0);
        procStats[name].count++;
      }
    });
  });

  const procs=PROC_ORDER.filter(p=>procStats[p].count>0);
  if(!procs.length)return;
  const barGroupW=cW/procs.length;
  const maxDays=Math.max(...procs.map(p=>Math.max(procStats[p].planTotal/procStats[p].count,procStats[p].actualTotal/procStats[p].count)),1);

  procs.forEach((p,i)=>{
    const s=procStats[p];
    const avgPlan=s.count?s.planTotal/s.count:0;
    const avgActual=s.count?s.actualTotal/s.count:0;
    const x=pad.left+i*barGroupW;
    const halfW=(barGroupW-16)/2;

    const h1=(avgPlan/maxDays)*cH;
    ctx.fillStyle=PROC_COLORS[p]||'#888';
    ctx.beginPath();ctx.roundRect(x+4,pad.top+cH-h1,halfW,h1,[3,3,0,0]);ctx.fill();

    const h2=(avgActual/maxDays)*cH;
    ctx.fillStyle=(PROC_COLORS[p]||'#888')+'88';
    ctx.beginPath();ctx.roundRect(x+4+halfW+2,pad.top+cH-h2,halfW,h2,[3,3,0,0]);ctx.fill();

    ctx.fillStyle=getCSSVar('--t2');ctx.font='9px sans-serif';ctx.textAlign='center';
    ctx.fillText(p.slice(0,2),x+barGroupW/2,H-6);
  });

  ctx.fillStyle=getCSSVar('--t1');ctx.font='9px sans-serif';ctx.textAlign='left';
  ctx.fillText('■ 계획',W-80,12);ctx.fillStyle=getCSSVar('--t2');ctx.fillText('■ 실제',W-40,12);
}

function drawDefectRateChart(){
  const canvas=document.getElementById('defectRateChart');
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const rect=canvas.getBoundingClientRect();
  canvas.width=rect.width*2;canvas.height=rect.height*2;ctx.scale(2,2);
  const W=rect.width,H=rect.height;
  const pad={top:20,bottom:40,left:40,right:10};
  const cW=W-pad.left-pad.right,cH=H-pad.top-pad.bottom;

  const prodMap={};
  D.forEach(d=>{
    const p=d.productName||'미분류';
    if(!prodMap[p])prodMap[p]={total:0,defect:0};
    prodMap[p].total++;
    if(d.defectType||d.defectProcess)prodMap[p].defect++;
  });
  const entries=Object.entries(prodMap).filter(([,v])=>v.total>=2).sort((a,b)=>(b[1].defect/b[1].total)-(a[1].defect/a[1].total)).slice(0,8);
  if(!entries.length){ctx.fillStyle=getCSSVar('--t2');ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillText('불량 데이터 없음',W/2,H/2);return}

  const maxRate=Math.max(...entries.map(([,v])=>v.defect/v.total*100),1);
  const barW=cW/entries.length;

  entries.forEach(([name,v],i)=>{
    const rate=v.total?v.defect/v.total*100:0;
    const x=pad.left+i*barW;
    const h=(rate/maxRate)*cH;
    ctx.fillStyle=rate>10?'rgba(239,68,68,0.7)':'rgba(251,191,36,0.7)';
    ctx.beginPath();ctx.roundRect(x+4,pad.top+cH-h,barW-8,h,[4,4,0,0]);ctx.fill();
    if(rate>0){ctx.fillStyle='#fff';ctx.font='bold 9px sans-serif';ctx.textAlign='center';ctx.fillText(rate.toFixed(1)+'%',x+barW/2,pad.top+cH-h-5)}
    ctx.fillStyle=getCSSVar('--t2');ctx.font='8px sans-serif';
    const label=name.length>5?name.slice(0,5)+'…':name;
    ctx.save();ctx.translate(x+barW/2,H-5);ctx.rotate(-0.3);ctx.fillText(label,0,0);ctx.restore();
  });
}

function drawDefectProcChart(){
  const canvas=document.getElementById('defectProcChart');
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  const rect=canvas.getBoundingClientRect();
  canvas.width=rect.width*2;canvas.height=rect.height*2;ctx.scale(2,2);
  const W=rect.width,H=rect.height;
  const pad={top:20,bottom:30,left:40,right:10};
  const cW=W-pad.left-pad.right,cH=H-pad.top-pad.bottom;

  const procDefects={};
  D.forEach(d=>{
    if(d.defectProcess){
      procDefects[d.defectProcess]=(procDefects[d.defectProcess]||0)+1;
    }
  });
  const entries=Object.entries(procDefects).sort((a,b)=>b[1]-a[1]);
  if(!entries.length){ctx.fillStyle=getCSSVar('--t2');ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillText('공정별 불량 데이터 없음',W/2,H/2);return}

  const maxVal=Math.max(...entries.map(e=>e[1]),1);
  const barH=(cH-entries.length*4)/entries.length;

  entries.forEach(([proc,cnt],i)=>{
    const y=pad.top+i*(barH+4);
    const w=(cnt/maxVal)*cW;
    ctx.fillStyle=PROC_COLORS[proc]||'rgba(99,102,241,0.7)';
    ctx.beginPath();ctx.roundRect(pad.left,y,w,barH,[0,4,4,0]);ctx.fill();
    ctx.fillStyle=getCSSVar('--t1');ctx.font='10px sans-serif';ctx.textAlign='right';ctx.textBaseline='middle';
    ctx.fillText(proc,pad.left-4,y+barH/2);
    ctx.textAlign='left';ctx.fillText(cnt+'건',pad.left+w+4,y+barH/2);
  });
}

function getCSSVar(name){return getComputedStyle(document.documentElement).getPropertyValue(name).trim()}


/* ══════════════════════════════════════════════
   3-2. AI 어시스턴트 (Gemini API)
   ══════════════════════════════════════════════ */

function buildSystemPrompt(){
  const today=fD(new Date());
  const active=D.filter(d=>d.status!=='완료'&&d.status!=='폐기');
  const delayed=D.filter(d=>d.status==='지연');
  const prodMap={};
  D.forEach(d=>{const p=d.productName||'?';prodMap[p]=(prodMap[p]||0)+1});
  const procDist={};
  active.forEach(d=>{const c=getCurrentProcess(d);if(c)procDist[c]=(procDist[c]||0)+1});

  return`당신은 ESC(정전척) 생산관리 AI 어시스턴트입니다.
오늘: ${today}
전체 LOT: ${D.length}건 | 진행중: ${active.length}건 | 지연: ${delayed.length}건
제품별: ${Object.entries(prodMap).map(([k,v])=>`${k}(${v})`).join(', ')}
공정별 분포(진행중): ${Object.entries(procDist).map(([k,v])=>`${k}(${v})`).join(', ')}
공정순서: ${PROC_ORDER.join('→')}
카테고리: BL, WN, HP
납기 초과: ${D.filter(d=>d.endDate&&new Date(d.endDate)<new Date()&&d.status!=='완료'&&d.status!=='폐기').length}건

한국어로 답변하세요. 마크다운 사용 가능. 간결하고 실용적으로.
S/N 생성 요청 시 JSON 포맷으로 제안하세요.`;
}

async function callGemini(userMsg){
  const key=localStorage.getItem('gemini_api_key');
  if(!key)return'⚠️ Gemini API 키가 설정되지 않았습니다.\n설정 → AI 설정에서 키를 입력하세요.';

  try{
    const resp=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        system_instruction:{parts:[{text:buildSystemPrompt()}]},
        contents:[{parts:[{text:userMsg}]}],
        generationConfig:{temperature:0.7,maxOutputTokens:2048}
      })
    });
    if(!resp.ok){const err=await resp.text();return`❌ API 오류 (${resp.status}): ${err.slice(0,200)}`}
    const data=await resp.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text||'응답을 받지 못했습니다.';
  }catch(e){
    return`❌ 네트워크 오류: ${e.message}`;
  }
}

function addChatBubble(container,role,text){
  const div=document.createElement('div');
  div.className=`chat-bubble ${role}`;
  div.innerHTML=role==='ai'?mdToHtml(text):text;
  container.appendChild(div);
  container.scrollTop=container.scrollHeight;
}

async function askAI(question){
  const container=document.getElementById('chatMessages');
  if(!container)return;
  addChatBubble(container,'user',question);
  addChatBubble(container,'ai','⏳ 분석 중...');
  const answer=await callGemini(question);
  container.lastChild.innerHTML=mdToHtml(answer);
  container.scrollTop=container.scrollHeight;

  // AI 확인 카드 (S/N 생성 제안 등)
  checkAIAction(answer);
}
window.askAI=askAI;

async function sendChat(){
  const input=document.getElementById('chatInput');
  if(!input)return;
  const msg=input.value.trim();
  if(!msg)return;
  input.value='';
  await askAI(msg);
}
window.sendChat=sendChat;

// 미니챗
function toggleMiniChat(){
  const win=document.getElementById('miniChatWin');
  if(win)win.classList.toggle('open');
}
window.toggleMiniChat=toggleMiniChat;

async function sendMiniChat(){
  const input=document.getElementById('miniChatInput');
  const container=document.getElementById('miniChatMessages');
  if(!input||!container)return;
  const msg=input.value.trim();
  if(!msg)return;
  input.value='';
  addChatBubble(container,'user',msg);
  addChatBubble(container,'ai','⏳...');
  const answer=await callGemini(msg);
  container.lastChild.innerHTML=mdToHtml(answer);
  container.scrollTop=container.scrollHeight;
}
window.sendMiniChat=sendMiniChat;

function checkAIAction(text){
  // S/N 생성 제안 감지
  if(text.includes('"product"')&&text.includes('"qty"')){
    try{
      const jsonMatch=text.match(/\{[\s\S]*?"product"[\s\S]*?\}/);
      if(jsonMatch){
        pendingAIAction=JSON.parse(jsonMatch[0]);
        toast('AI가 S/N 생성을 제안했습니다. 확인해주세요.','warn');
      }
    }catch(e){}
  }
}


console.log('✅ Part 3 로드 완료');
// ═══════════════════════════════════════════════════════════
// Part 3 끝 — Part 4는 여기 아래에 이어 붙입니다
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// Part 4-A — 모달 CRUD · 제품등록 · S/N 생성 · 납기역산 · 이슈등록
// ═══════════════════════════════════════════════════════════

/* ── 4A-1. 제품 등록 모달 ── */
function openProductModal(){
  const modal=document.getElementById('productModal');
  if(!modal) return;
  modal.style.display='flex';
  const form=document.getElementById('productForm');
  if(form) form.reset();
}
window.openProductModal=openProductModal;

function closeProductModal(){
  const modal=document.getElementById('productModal');
  if(modal) modal.style.display='none';
}
window.closeProductModal=closeProductModal;

async function saveProduct(){
  const name=document.getElementById('prodName')?.value.trim();
  const cat=document.getElementById('prodCategory')?.value;
  const route=document.getElementById('prodRoute')?.value.trim();
  const customer=document.getElementById('prodCustomer')?.value.trim();
  const note=document.getElementById('prodNote')?.value.trim();

  if(!name){toast('제품명을 입력하세요','err');return;}
  if(!cat){toast('카테고리를 선택하세요','err');return;}

  try{
    const docData={
      name,
      category:cat,
      route:route||PROC_ORDER.join(' > '),
      customer:customer||'',
      note:note||'',
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString()
    };
    const {collection,addDoc}=await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
    await addDoc(collection(db,'products'),docData);
    toast('제품이 등록되었습니다','ok');
    closeProductModal();
  }catch(e){
    console.error('제품 등록 오류:',e);
    toast('등록 실패: '+e.message,'err');
  }
}
window.saveProduct=saveProduct;

/* ── 4A-2. S/N 생성 모달 ── */
function openSNModal(){
  const modal=document.getElementById('snModal');
  if(!modal) return;
  modal.style.display='flex';
  // 제품 목록 로드
  const sel=document.getElementById('snProduct');
  if(sel){
    sel.innerHTML='<option value="">제품 선택</option>';
    PRODS.forEach(p=>{
      sel.innerHTML+=`<option value="${p.id}" data-cat="${p.category||''}" data-route="${p.route||''}">${p.name} (${p.category||'?'})</option>`;
    });
  }
  // 기본값 세팅
  const today=fD(new Date());
  const startEl=document.getElementById('snStartDate');
  if(startEl) startEl.value=today;
  updateSNPreview();
}
window.openSNModal=openSNModal;

function closeSNModal(){
  const modal=document.getElementById('snModal');
  if(modal) modal.style.display='none';
}
window.closeSNModal=closeSNModal;

function updateSNPreview(){
  const cat=document.getElementById('snProduct')?.selectedOptions[0]?.dataset.cat||'XX';
  const qty=parseInt(document.getElementById('snQty')?.value)||1;
  const startDate=document.getElementById('snStartDate')?.value||fD(new Date());
  const preview=document.getElementById('snPreview');
  if(!preview) return;

  // S/N 형식: {카테고리}{YYMMDD}-{3자리순번}
  const ymd=startDate.replace(/-/g,'').slice(2); // YYMMDD
  let html='<div style="font-size:13px;color:var(--t2);margin-bottom:8px">생성될 S/N 미리보기:</div>';

  // 기존 같은 날짜 S/N 개수 확인
  const prefix=`${cat}${ymd}-`;
  const existing=D.filter(d=>(d.sn||'').startsWith(prefix)).length;

  for(let i=0;i<Math.min(qty,10);i++){
    const seq=String(existing+i+1).padStart(3,'0');
    html+=`<div style="font-family:monospace;font-size:14px;padding:2px 0">${prefix}${seq}</div>`;
  }
  if(qty>10) html+=`<div style="color:var(--t3);font-size:12px">... 외 ${qty-10}건</div>`;
  preview.innerHTML=html;
}
window.updateSNPreview=updateSNPreview;

async function generateSN(){
  const prodEl=document.getElementById('snProduct');
  const prodId=prodEl?.value;
  const prodOpt=prodEl?.selectedOptions[0];
  if(!prodId){toast('제품을 선택하세요','err');return;}

  const qty=parseInt(document.getElementById('snQty')?.value)||1;
  const startDate=document.getElementById('snStartDate')?.value||fD(new Date());
  const endDate=document.getElementById('snEndDate')?.value||'';
  const batchId=document.getElementById('snBatchId')?.value.trim()||'';
  const note=document.getElementById('snNote')?.value.trim()||'';

  const cat=prodOpt.dataset.cat||'XX';
  const route=prodOpt.dataset.route||PROC_ORDER.join(' > ');
  const productName=prodOpt.textContent.split('(')[0].trim();
  const ymd=startDate.replace(/-/g,'').slice(2);
  const prefix=`${cat}${ymd}-`;
  const existing=D.filter(d=>(d.sn||'').startsWith(prefix)).length;

  // 공정 맵 초기화
  const procs=route.split(/[→>]/).map(s=>s.trim()).filter(Boolean);
  const processes={};
  procs.forEach(p=>{processes[p]={status:'대기',startDate:'',endDate:'',equipment:'',note:''};});

  const {collection,addDoc}=await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
  const batch=[];

  try{
    for(let i=0;i<qty;i++){
      const seq=String(existing+i+1).padStart(3,'0');
      const sn=`${prefix}${seq}`;
      const docData={
        sn,
        productName,
        category:cat,
        route,
        processes:JSON.parse(JSON.stringify(processes)),
        status:'대기',
        currentProcess:procs[0]||'',
        progress:0,
        startDate,
        endDate:endDate||'',
        batchId,
        note,
        registeredAt:new Date().toISOString(),
        updatedAt:new Date().toISOString(),
        dPlus:0
      };
      batch.push(addDoc(collection(db,'production'),docData));
    }
    await Promise.all(batch);
    toast(`S/N ${qty}건 생성 완료`,'ok');
    closeSNModal();
  }catch(e){
    console.error('S/N 생성 오류:',e);
    toast('생성 실패: '+e.message,'err');
  }
}
window.generateSN=generateSN;

/* ── 4A-3. 납기 역산 계산기 ── */
function openDeadlineCalc(){
  const modal=document.getElementById('deadlineModal');
  if(!modal) return;
  modal.style.display='flex';
  // 기본 납기일: 오늘 + 30일
  const def=new Date();def.setDate(def.getDate()+30);
  const endEl=document.getElementById('calcEndDate');
  if(endEl) endEl.value=fD(def);
  calcDeadline();
}
window.openDeadlineCalc=openDeadlineCalc;

function closeDeadlineCalc(){
  const modal=document.getElementById('deadlineModal');
  if(modal) modal.style.display='none';
}
window.closeDeadlineCalc=closeDeadlineCalc;

function calcDeadline(){
  const endStr=document.getElementById('calcEndDate')?.value;
  const cat=document.getElementById('calcCategory')?.value||'BL';
  const result=document.getElementById('calcResult');
  if(!endStr||!result) return;

  // 공정별 예상 소요일 (영업일 기준)
  const procDaysMap={
    '탈지':2,'소성':5,'환원소성':3,'평탄화':2,'도금':3,'열처리':2,
    '수입검사':1,'래핑':3,'성형':3,'가공':4,'메탈라이징':3,'브레이징':3,
    '후가공':2,'He Leak':1,'최종검사':1,'출하':1
  };

  const procs=PROC_ORDER.slice();
  const endDate=new Date(endStr);
  let cursor=new Date(endDate);
  const schedule=[];

  // 역산: 마지막 공정부터 거꾸로
  for(let i=procs.length-1;i>=0;i--){
    const p=procs[i];
    const days=procDaysMap[p]||2;
    const procEnd=new Date(cursor);
    // 영업일 역산
    let remain=days;
    while(remain>0){
      cursor.setDate(cursor.getDate()-1);
      const dow=cursor.getDay();
      if(dow!==0&&dow!==6) remain--;
    }
    const procStart=new Date(cursor);
    schedule.unshift({proc:p,days,start:fD(procStart),end:fD(procEnd)});
  }

  const latestStart=schedule[0]?.start||'?';
  const totalDays=schedule.reduce((a,s)=>a+s.days,0);

  let html=`
    <div class="card" style="margin-bottom:12px;background:linear-gradient(135deg,rgba(99,102,241,0.1),rgba(129,140,248,0.05))">
      <div style="font-size:18px;font-weight:700;color:var(--ac1)">투입 시작일: ${latestStart}</div>
      <div style="font-size:13px;color:var(--t2);margin-top:4px">총 소요: 영업일 ${totalDays}일 | 납기: ${endStr}</div>
    </div>
    <table style="width:100%;font-size:13px;border-collapse:collapse">
      <tr style="background:var(--bg2)"><th style="padding:6px;text-align:left">공정</th><th>소요(일)</th><th>시작</th><th>종료</th></tr>`;
  schedule.forEach(s=>{
    const color=PROC_COLORS[s.proc]||'var(--t2)';
    html+=`<tr style="border-bottom:1px solid var(--brd)">
      <td style="padding:6px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin-right:6px"></span>${s.proc}</td>
      <td style="text-align:center">${s.days}</td>
      <td style="text-align:center">${s.start}</td>
      <td style="text-align:center">${s.end}</td>
    </tr>`;
  });
  html+=`</table>`;
  result.innerHTML=html;
}
window.calcDeadline=calcDeadline;

/* ── 4A-4. 이슈 등록 모달 ── */
function openIssueModal(lotId){
  const modal=document.getElementById('issueModal');
  if(!modal) return;
  modal.style.display='flex';
  const form=document.getElementById('issueForm');
  if(form) form.reset();

  // LOT 선택 드롭다운
  const sel=document.getElementById('issueLot');
  if(sel){
    sel.innerHTML='<option value="">LOT 선택</option>';
    D.filter(d=>d.status!=='완료'&&d.status!=='폐기').forEach(d=>{
      const selected=d.id===lotId?'selected':'';
      sel.innerHTML+=`<option value="${d.id}" ${selected}>${d.sn} (${d.productName||'?'})</option>`;
    });
  }

  // 공정 드롭다운
  const procSel=document.getElementById('issueProc');
  if(procSel){
    procSel.innerHTML='<option value="">공정 선택</option>';
    PROC_ORDER.forEach(p=>{
      procSel.innerHTML+=`<option value="${p}">${p}</option>`;
    });
  }
}
window.openIssueModal=openIssueModal;

function closeIssueModal(){
  const modal=document.getElementById('issueModal');
  if(modal) modal.style.display='none';
}
window.closeIssueModal=closeIssueModal;

async function saveIssue(){
  const lotId=document.getElementById('issueLot')?.value;
  const proc=document.getElementById('issueProc')?.value;
  const type=document.getElementById('issueType')?.value;
  const severity=document.getElementById('issueSeverity')?.value||'중';
  const desc=document.getElementById('issueDesc')?.value.trim();

  if(!lotId){toast('LOT을 선택하세요','err');return;}
  if(!proc){toast('공정을 선택하세요','err');return;}
  if(!desc){toast('내용을 입력하세요','err');return;}

  try{
    const {collection,addDoc,doc,updateDoc}=await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');

    // 이슈 문서 저장
    await addDoc(collection(db,'issues'),{
      lotId,
      sn:D.find(d=>d.id===lotId)?.sn||'',
      process:proc,
      type:type||'기타',
      severity,
      description:desc,
      status:'open',
      createdAt:new Date().toISOString(),
      createdBy:currentUser?.displayName||currentUser?.email||'unknown'
    });

    // LOT 상태를 '이슈'로 업데이트
    const lotRef=doc(db,'production',lotId);
    await updateDoc(lotRef,{
      status:'이슈',
      updatedAt:new Date().toISOString(),
      [`processes.${proc}.status`]:'이슈',
      [`processes.${proc}.note`]:desc
    });

    toast('이슈가 등록되었습니다','ok');
    closeIssueModal();
  }catch(e){
    console.error('이슈 등록 오류:',e);
    toast('등록 실패: '+e.message,'err');
  }
}
window.saveIssue=saveIssue;

/* ── 4A-5. 일일 리포트 모달 ── */
function openReportModal(){
  const modal=document.getElementById('reportModal');
  if(!modal) return;
  modal.style.display='flex';
  generateDailyReport();
}
window.openReportModal=openReportModal;

function closeReportModal(){
  const modal=document.getElementById('reportModal');
  if(modal) modal.style.display='none';
}
window.closeReportModal=closeReportModal;

function generateDailyReport(){
  const container=document.getElementById('reportContent');
  if(!container) return;

  const today=fD(new Date());
  const active=D.filter(d=>d.status!=='완료'&&d.status!=='폐기');
  const delayed=D.filter(d=>d.status==='지연');
  const inProgress=D.filter(d=>d.status==='진행중');
  const completed=D.filter(d=>d.status==='완료');
  const issues=D.filter(d=>d.status==='이슈');

  // 오늘 등록된 건
  const todayNew=D.filter(d=>d.registeredAt&&d.registeredAt.startsWith(today));
  // 오늘 완료된 건
  const todayDone=D.filter(d=>d.status==='완료'&&d.updatedAt&&d.updatedAt.startsWith(today));

  // 공정별 현황
  const procDist={};
  active.forEach(d=>{
    const c=getCurrentProcess(d);
    if(c) procDist[c]=(procDist[c]||0)+1;
  });

  let html=`
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:18px;font-weight:700">ESC 생산 일일 리포트</div>
      <div style="font-size:13px;color:var(--t2)">${today} | 작성: ${currentUser?.displayName||'관리자'}</div>
    </div>
    <div class="card" style="margin-bottom:12px">
      <div style="font-weight:600;margin-bottom:8px">📊 종합 현황</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;text-align:center">
        <div><div style="font-size:20px;font-weight:700">${D.length}</div><div style="font-size:11px;color:var(--t2)">전체</div></div>
        <div><div style="font-size:20px;font-weight:700;color:var(--ac1)">${inProgress.length}</div><div style="font-size:11px;color:var(--t2)">진행중</div></div>
        <div><div style="font-size:20px;font-weight:700;color:var(--green)">${completed.length}</div><div style="font-size:11px;color:var(--t2)">완료</div></div>
        <div><div style="font-size:20px;font-weight:700;color:var(--err)">${delayed.length}</div><div style="font-size:11px;color:var(--t2)">지연</div></div>
        <div><div style="font-size:20px;font-weight:700;color:var(--warn)">${issues.length}</div><div style="font-size:11px;color:var(--t2)">이슈</div></div>
      </div>
    </div>
    <div class="card" style="margin-bottom:12px">
      <div style="font-weight:600;margin-bottom:8px">📋 오늘의 활동</div>
      <div style="font-size:13px">신규 등록: ${todayNew.length}건 | 완료 처리: ${todayDone.length}건</div>
    </div>
    <div class="card" style="margin-bottom:12px">
      <div style="font-weight:600;margin-bottom:8px">🔧 공정별 분포 (진행중)</div>
      <div style="font-size:13px">`;

  Object.entries(procDist).sort((a,b)=>b[1]-a[1]).forEach(([proc,cnt])=>{
    const color=PROC_COLORS[proc]||'var(--t2)';
    html+=`<div style="display:flex;align-items:center;gap:6px;margin:4px 0">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>
      <span>${proc}</span>
      <span style="font-weight:600">${cnt}건</span>
    </div>`;
  });

  html+=`</div></div>`;

  if(delayed.length>0){
    html+=`<div class="card" style="margin-bottom:12px;border-color:var(--err)">
      <div style="font-weight:600;margin-bottom:8px;color:var(--err)">⚠️ 지연 LOT (${delayed.length}건)</div>
      <div style="font-size:12px;max-height:150px;overflow-y:auto">`;
    delayed.slice(0,10).forEach(d=>{
      html+=`<div style="padding:3px 0;border-bottom:1px solid var(--brd)">${d.sn} | ${d.productName||'?'} | D+${d.dPlus||'?'}</div>`;
    });
    if(delayed.length>10) html+=`<div style="color:var(--t3)">... 외 ${delayed.length-10}건</div>`;
    html+=`</div></div>`;
  }

  container.innerHTML=html;
}

function exportReportText(){
  const container=document.getElementById('reportContent');
  if(!container) return;
  const text=container.innerText;
  const blob=new Blob([text],{type:'text/plain;charset=utf-8'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`ESC_일일리포트_${fD(new Date())}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('리포트 다운로드 완료','ok');
}
window.exportReportText=exportReportText;
window.closeDeadlineModal=closeDeadlineCalc;
window.closeModal=function(id){
  const el=document.getElementById(id);
  if(el) el.style.display='none';
};
window.closeReportModal=closeReportModal;
window.closeProductModal=closeProductModal;
window.closeSNModal=closeSNModal;
window.closeIssueModal=closeIssueModal;
console.log('✅ Part 4-A 로드 완료');
// ═══════════════════════════════════════════════════════════
// Part 4-A 끝 — Part 4-B는 여기 아래에 이어 붙입니다
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// Part 4-B — Excel 내보내기 · QR 코드 · 사이드패널 · 공정 업데이트
// ═══════════════════════════════════════════════════════════

/* ── 4B-1. Excel 내보내기 ── */
function exportExcel(){
  if(typeof XLSX==='undefined'){toast('Excel 라이브러리 로딩 중... 잠시 후 다시 시도','warn');return;}
  
  const rows=D.map(d=>{
    const procs=d.route?d.route.split(/[→>]/).map(s=>s.trim()).filter(Boolean):[];
    const currentProc=getCurrentProcess(d);
    return {
      'S/N':d.sn||'',
      '제품명':d.productName||'',
      '카테고리':d.category||'',
      '상태':d.status||'',
      '현재공정':currentProc||'',
      '진행률(%)':calcProgress(d),
      'D+':d.dPlus||0,
      '시작일':d.startDate||'',
      '납기일':d.endDate||'',
      '배치ID':d.batchId||'',
      '등록일':d.registeredAt?d.registeredAt.slice(0,10):'',
      '비고':d.note||''
    };
  });

  const ws=XLSX.utils.json_to_sheet(rows);
  
  // 열 너비 자동 조정
  const colWidths=Object.keys(rows[0]||{}).map(key=>{
    const maxLen=Math.max(key.length,
      ...rows.map(r=>String(r[key]||'').length));
    return {wch:Math.min(maxLen+2,30)};
  });
  ws['!cols']=colWidths;

  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'생산현황');

  // 이슈 시트 추가
  if(ISSUES.length>0){
    const issueRows=ISSUES.map(iss=>({
      'S/N':iss.sn||'',
      '공정':iss.process||'',
      '유형':iss.type||'',
      '심각도':iss.severity||'',
      '내용':iss.description||'',
      '상태':iss.status||'',
      '등록일':iss.createdAt?iss.createdAt.slice(0,10):'',
      '등록자':iss.createdBy||''
    }));
    const ws2=XLSX.utils.json_to_sheet(issueRows);
    XLSX.utils.book_append_sheet(wb,ws2,'이슈목록');
  }

  const filename=`ESC_생산현황_${fD(new Date())}.xlsx`;
  XLSX.writeFile(wb,filename);
  toast(`${filename} 다운로드 완료`,'ok');
}
window.exportExcel=exportExcel;

/* ── 4B-2. QR 코드 생성 ── */
function openQRModal(sn){
  const modal=document.getElementById('qrModal');
  if(!modal) return;
  modal.style.display='flex';
  
  const container=document.getElementById('qrCanvas')||document.getElementById('qrCode');
  if(!container) return;
  container.innerHTML='';

  const lot=D.find(d=>d.sn===sn);
  const qrData=JSON.stringify({
    sn:sn,
    product:lot?.productName||'',
    category:lot?.category||'',
    status:lot?.status||'',
    process:getCurrentProcess(lot)||'',
    date:fD(new Date())
  });

  if(typeof QRCode!=='undefined'){
    new QRCode(container,{
      text:qrData,
      width:200,
      height:200,
      colorDark:'#1a1a2e',
      colorLight:'#ffffff'
    });
  }else{
    // QRCode 라이브러리 없으면 텍스트 표시
    container.innerHTML=`<div style="padding:20px;background:#fff;border-radius:8px;word-break:break-all;font-size:12px;color:#333">${qrData}</div>`;
  }

  // QR 정보 표시
  const info=document.getElementById('qrInfo');
  if(info&&lot){
    info.innerHTML=`
      <div style="text-align:center;margin-top:12px">
        <div style="font-size:16px;font-weight:700">${sn}</div>
        <div style="font-size:13px;color:var(--t2)">${lot.productName||''} | ${lot.category||''}</div>
        <div style="font-size:12px;color:var(--t3);margin-top:4px">${getCurrentProcess(lot)||''} | ${lot.status||''}</div>
      </div>`;
  }
}
window.openQRModal=openQRModal;

function closeQRModal(){
  const modal=document.getElementById('qrModal');
  if(modal) modal.style.display='none';
}
window.closeQRModal=closeQRModal;
window.closeModal=function(id){
  const el=document.getElementById(id);
  if(el) el.style.display='none';
};

function downloadQR(){
  const container=document.getElementById('qrCanvas')||document.getElementById('qrCode');
  const canvas=container?.querySelector('canvas');
  if(!canvas){toast('QR 코드가 없습니다','warn');return;}
  const a=document.createElement('a');
  a.href=canvas.toDataURL('image/png');
  a.download='QR_'+fD(new Date())+'.png';
  a.click();
  toast('QR 이미지 다운로드','ok');
}
window.downloadQR=downloadQR;

/* ── 4B-3. 사이드패널 (LOT 상세보기) ── */
function openSidePanel(lotId){
  const panel=document.getElementById('sidePanel');
  if(!panel) return;
  
  let lot=D.find(d=>d.id===lotId);
  if(!lot) lot=D.find(d=>d.sn===lotId);
  if(!lot){toast('LOT을 찾을 수 없습니다','err');return;}
  lotId=lot.id;

  panel.classList.add('open');  
  const content=document.getElementById('sidePanelContent')||panel.querySelector('.sp-body');
  if(!content) return;

  const procs=lot.route?lot.route.split(/[→>]/).map(s=>s.trim()).filter(Boolean):[];
  const progress=calcProgress(lot);
  const currentProc=getCurrentProcess(lot);

  let procHTML='';
  procs.forEach((p,i)=>{
    const pData=lot.processes?.[p]||{};
    const st=pData.status||'대기';
    const color=PROC_COLORS[p]||'#888';
    let stIcon='⏳',stColor='var(--t3)';
    if(st==='완료'){stIcon='✅';stColor='var(--green)';}
    else if(st==='진행중'){stIcon='🔄';stColor='var(--ac1)';}
    else if(st==='이슈'){stIcon='⚠️';stColor='var(--err)';}

    procHTML+=`
      <div class="sp-proc-row" style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;margin-bottom:4px;background:var(--bg2);cursor:pointer"
           onclick="openProcUpdate('${lotId}','${p}')">
        <span style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></span>
        <span style="flex:1;font-size:13px">${p}</span>
        <span style="font-size:12px;color:${stColor}">${stIcon} ${st}</span>
        ${pData.equipment?`<span style="font-size:11px;color:var(--t3)">${pData.equipment}</span>`:''}
      </div>`;
  });

  content.innerHTML=`
    <div style="padding:16px">
      <!-- 헤더 -->
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px">
        <div>
          <div style="font-size:18px;font-weight:700">${lot.sn||'?'}</div>
          <div style="font-size:14px;color:var(--t2);margin-top:4px">${lot.productName||'?'}</div>
        </div>
        <button onclick="closeSidePanel()" style="background:none;border:none;color:var(--t2);font-size:20px;cursor:pointer">✕</button>
      </div>

      <!-- 상태 뱃지 -->
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        ${statusBadge(lot.status)}
        <span style="font-size:12px;padding:4px 10px;border-radius:12px;background:var(--bg2);color:var(--t2)">${lot.category||'?'}</span>
        <span style="font-size:12px;padding:4px 10px;border-radius:12px;background:var(--bg2);color:var(--t2)">D+${lot.dPlus||0}</span>
      </div>

      <!-- 진행률 -->
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:13px;font-weight:600">진행률</span>
          <span style="font-size:13px;font-weight:700;color:var(--ac1)">${progress}%</span>
        </div>
        <div style="height:8px;background:var(--bg2);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${progress}%;background:linear-gradient(90deg,var(--ac1),var(--ac2));border-radius:4px;transition:width .3s"></div>
        </div>
        ${currentProc?`<div style="font-size:12px;color:var(--t2);margin-top:6px">현재: <strong>${currentProc}</strong></div>`:''}
      </div>

      <!-- 기본 정보 -->
      <div class="card" style="margin-bottom:12px">
        <div style="font-weight:600;margin-bottom:8px">📋 기본 정보</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px">
          <div><span style="color:var(--t3)">시작일</span><br><strong>${lot.startDate||'-'}</strong></div>
          <div><span style="color:var(--t3)">납기일</span><br><strong style="color:${lot.endDate&&new Date(lot.endDate)<new Date()?'var(--err)':'inherit'}">${lot.endDate||'-'}</strong></div>
          <div><span style="color:var(--t3)">배치ID</span><br><strong>${lot.batchId||'-'}</strong></div>
          <div><span style="color:var(--t3)">등록일</span><br><strong>${lot.registeredAt?lot.registeredAt.slice(0,10):'-'}</strong></div>
        </div>
      </div>

      <!-- 공정 현황 -->
      <div class="card" style="margin-bottom:12px">
        <div style="font-weight:600;margin-bottom:8px">🔧 공정 현황 <span style="font-size:11px;color:var(--t3)">(클릭하여 업데이트)</span></div>
        ${procHTML}
      </div>

      <!-- 액션 버튼 -->
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" onclick="openQRModal('${lot.sn||''}')">📱 QR</button>
        <button class="btn btn-secondary btn-sm" onclick="openIssueModal('${lotId}')">⚠️ 이슈등록</button>
        <button class="btn btn-secondary btn-sm" onclick="deleteLot('${lotId}')">🗑️ 삭제</button>
      </div>
    </div>`;
}
window.openSidePanel=openSidePanel;

function closeSidePanel(){
  const panel=document.getElementById('sidePanel');
  if(panel) panel.classList.remove('open');
}
window.closeSidePanel=closeSidePanel;

/* ── 4B-4. 공정 상태 업데이트 ── */
function openProcUpdate(lotId,proc){
  const lot=D.find(d=>d.id===lotId);
  if(!lot) return;
  
  const pData=lot.processes?.[proc]||{};
  const currentStatus=pData.status||'대기';
  const equipList=EQ_MAP[proc]||[];

  let equipOptions='<option value="">장비 선택 (선택사항)</option>';
  if(Array.isArray(equipList)){
    equipList.forEach(eq=>{
      const sel=pData.equipment===eq?'selected':'';
      equipOptions+=`<option value="${eq}" ${sel}>${eq}</option>`;
    });
  }else if(typeof equipList==='object'){
    Object.entries(equipList).forEach(([line,eqs])=>{
      eqs.forEach(eq=>{
        const sel=pData.equipment===eq?'selected':'';
        equipOptions+=`<option value="${eq}" ${sel}>${line}:${eq}</option>`;
      });
    });
  }

  const html=`
    <div style="padding:20px">
      <div style="font-size:16px;font-weight:700;margin-bottom:4px">${lot.sn}</div>
      <div style="font-size:14px;color:var(--t2);margin-bottom:16px">${proc} 공정 업데이트</div>
      
      <div style="margin-bottom:12px">
        <label style="font-size:13px;color:var(--t2);display:block;margin-bottom:4px">상태</label>
        <select id="procStatusSel" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--brd);background:var(--bg2);color:var(--t1);font-size:14px">
          <option value="대기" ${currentStatus==='대기'?'selected':''}>⏳ 대기</option>
          <option value="진행중" ${currentStatus==='진행중'?'selected':''}>🔄 진행중</option>
          <option value="완료" ${currentStatus==='완료'?'selected':''}>✅ 완료</option>
          <option value="이슈" ${currentStatus==='이슈'?'selected':''}>⚠️ 이슈</option>
        </select>
      </div>

      <div style="margin-bottom:12px">
        <label style="font-size:13px;color:var(--t2);display:block;margin-bottom:4px">장비</label>
        <select id="procEquipSel" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--brd);background:var(--bg2);color:var(--t1);font-size:14px">
          ${equipOptions}
        </select>
      </div>

      <div style="margin-bottom:16px">
        <label style="font-size:13px;color:var(--t2);display:block;margin-bottom:4px">비고</label>
        <textarea id="procNoteTxt" rows="3" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--brd);background:var(--bg2);color:var(--t1);font-size:13px;resize:vertical">${pData.note||''}</textarea>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-secondary btn-sm" onclick="closeModal('procUpdateModal')">취소</button>
        <button class="btn btn-primary btn-sm" onclick="saveProcUpdate('${lotId}','${proc}')">저장</button>
      </div>
    </div>`;

  // 범용 모달 사용
  let modal=document.getElementById('procUpdateModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='procUpdateModal';
    modal.style.cssText='display:flex;position:fixed;inset:0;z-index:9999;align-items:center;justify-content:center;background:rgba(0,0,0,0.6)';
    document.body.appendChild(modal);
  }
  modal.style.display='flex';
  modal.innerHTML=`<div style="background:var(--card);border-radius:16px;max-width:400px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3)">${html}</div>`;
}
window.openProcUpdate=openProcUpdate;

async function saveProcUpdate(lotId,proc){
  const status=document.getElementById('procStatusSel')?.value||'대기';
  const equipment=document.getElementById('procEquipSel')?.value||'';
  const note=document.getElementById('procNoteTxt')?.value.trim()||'';
  const today=fD(new Date());

  try{
    const {doc,updateDoc}=await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
    
    const updates={
      [`processes.${proc}.status`]:status,
      [`processes.${proc}.equipment`]:equipment,
      [`processes.${proc}.note`]:note,
      updatedAt:new Date().toISOString()
    };

    // 진행중으로 바꾸면 시작일 기록
    if(status==='진행중'){
      updates[`processes.${proc}.startDate`]=today;
      updates.status='진행중';
      updates.currentProcess=proc;
    }
    // 완료로 바꾸면 종료일 기록 + 다음 공정 자동 시작
    if(status==='완료'){
      updates[`processes.${proc}.endDate`]=today;
      
      const lot=D.find(d=>d.id===lotId);
      if(lot){
        const procs=lot.route?lot.route.split(/[→>]/).map(s=>s.trim()).filter(Boolean):[];
        const idx=procs.indexOf(proc);
        
        // 다음 공정이 있으면 currentProcess 업데이트
        if(idx>=0&&idx<procs.length-1){
          const nextProc=procs[idx+1];
          updates.currentProcess=nextProc;
          updates[`processes.${nextProc}.status`]='진행중';
          updates[`processes.${nextProc}.startDate`]=today;
        }
        
        // 모든 공정 완료 체크
        const allDone=procs.every((p,i)=>{
          if(p===proc) return status==='완료';
          return lot.processes?.[p]?.status==='완료';
        });
        if(allDone){
          updates.status='완료';
          updates.currentProcess='완료';
          updates.completedAt=new Date().toISOString();
        }
      }
    }
    // 이슈 상태
    if(status==='이슈'){
      updates.status='이슈';
    }

    const lotRef=doc(db,'production',lotId);
    await updateDoc(lotRef,updates);

    toast(`${proc} → ${status} 업데이트 완료`,'ok');
    closeModal('procUpdateModal');
    
    // 사이드패널 갱신
    setTimeout(()=>openSidePanel(lotId),500);
  }catch(e){
    console.error('공정 업데이트 오류:',e);
    toast('업데이트 실패: '+e.message,'err');
  }
}
window.saveProcUpdate=saveProcUpdate;

/* ── 4B-5. LOT 삭제 ── */
async function deleteLot(lotId){
  const lot=D.find(d=>d.id===lotId);
  if(!lot) return;
  
  if(!confirm(`정말 삭제하시겠습니까?\n\n${lot.sn} (${lot.productName})\n\n이 작업은 되돌릴 수 없습니다.`)) return;

  try{
    const {doc,deleteDoc}=await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
    await deleteDoc(doc(db,'production',lotId));
    toast(`${lot.sn} 삭제 완료`,'ok');
    closeSidePanel();
  }catch(e){
    console.error('삭제 오류:',e);
    toast('삭제 실패: '+e.message,'err');
  }
}
window.deleteLot=deleteLot;

/* ── 4B-6. 데이터 새로고침 ── */
function refreshData(){
  toast('데이터 새로고침 중...','info');
  // Firestore onSnapshot이 자동 갱신하므로 렌더만 다시
  setTimeout(()=>{
    renderTab(currentTab);
    toast('새로고침 완료','ok');
  },500);
}
window.refreshData=refreshData;

/* ── 4B-7. 워크스페이스 테이블 클릭 → 사이드패널 연결 ── */
function bindWorkspaceClicks(){
  document.querySelectorAll('[data-lot-id]').forEach(el=>{
    el.style.cursor='pointer';
    el.addEventListener('click',(e)=>{
      e.stopPropagation();
      openSidePanel(el.dataset.lotId);
    });
  });
}
window.bindWorkspaceClicks=bindWorkspaceClicks;

console.log('✅ Part 4-B 로드 완료');
// ═══════════════════════════════════════════════════════════
// Part 4-B 끝 — Part 4-C는 여기 아래에 이어 붙입니다
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
// Part 4-C (최종) — 검색 · 필터 · 테마 · 모바일 · 마무리
// ═══════════════════════════════════════════════════════════

/* ── 4C-1. 사이드패널 헤더 보정 ── */
// openSidePanel에서 S/N, 제품명이 안 보이는 문제 수정
// index.html의 사이드패널 헤더 요소에 직접 바인딩
function updateSidePanelHeader(lot){
  const snEl=document.getElementById('spSN');
  const catEl=document.getElementById('spCat');
  const badgeEl=document.getElementById('spBadge');
  const statusSel=document.getElementById('spStatusSel');
  
  if(snEl) snEl.textContent=lot.sn||'?';
  if(catEl) catEl.textContent=`${lot.category||''} · ${lot.productName||''}`;
  if(badgeEl) badgeEl.innerHTML=statusBadge(lot.status);
  if(statusSel) statusSel.value=lot.status||'대기';
}

// openSidePanel 보강 — 기존 함수 내부에서 호출되도록 패치
const _origOpenSidePanel=openSidePanel;
window.openSidePanel=function(lotId){
  _origOpenSidePanel(lotId);
  // 헤더 바인딩
  let lot=D.find(d=>d.id===lotId);
  if(!lot) lot=D.find(d=>d.sn===lotId);
  if(lot) updateSidePanelHeader(lot);
};

/* ── 4C-2. 상태 일괄 변경 (사이드패널 하단 셀렉트) ── */
async function updateLotStatus(){
  const sel=document.getElementById('spStatusSel');
  if(!sel) return;
  const newStatus=sel.value;
  
  // 현재 열린 LOT 찾기
  const snEl=document.getElementById('spSN');
  const sn=snEl?.textContent;
  if(!sn||sn==='?') return;
  
  const lot=D.find(d=>d.sn===sn);
  if(!lot){toast('LOT을 찾을 수 없습니다','err');return;}

  try{
    const {doc,updateDoc}=await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
    await updateDoc(doc(db,'production',lot.id),{
      status:newStatus,
      updatedAt:new Date().toISOString()
    });
    toast(`상태 → ${newStatus} 변경 완료`,'ok');
  }catch(e){
    toast('상태 변경 실패: '+e.message,'err');
  }
}
window.updateLotStatus=updateLotStatus;

/* ── 4C-3. 워크스페이스 검색 ── */
function setupWorkspaceSearch(){
  const input=document.getElementById('wsSearch')||document.querySelector('[placeholder*="검색"]');
  if(!input) return;
  
  input.addEventListener('input',(e)=>{
    const q=e.target.value.toLowerCase().trim();
    document.querySelectorAll('#workspaceTab tr[data-lot-id], #workspaceTab .ws-row').forEach(row=>{
      const text=row.textContent.toLowerCase();
      row.style.display=text.includes(q)?'':'none';
    });
  });
}

/* ── 4C-4. 워크스페이스 필터 버튼 ── */
function setupWorkspaceFilters(){
  document.querySelectorAll('#workspaceTab .filter-btn, #workspaceTab [data-filter]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const filter=btn.dataset.filter||btn.textContent.trim();
      
      // 활성 상태 토글
      document.querySelectorAll('#workspaceTab .filter-btn, #workspaceTab [data-filter]').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      
      document.querySelectorAll('#workspaceTab tr[data-lot-id], #workspaceTab .ws-row').forEach(row=>{
        if(filter==='전체'){row.style.display='';return;}
        const status=row.dataset.status||row.querySelector('.badge')?.textContent.trim()||'';
        row.style.display=status.includes(filter)?'':'none';
      });
    });
  });
}




/* ── 4C-7. 키보드 단축키 ── */
document.addEventListener('keydown',(e)=>{
  // ESC로 모달/패널 닫기
  if(e.key==='Escape'){
    closeSidePanel();
    document.querySelectorAll('[id$="Modal"]').forEach(m=>{
      if(m.style.display==='flex') m.style.display='none';
    });
  }
  // Ctrl+K 검색 포커스
  if(e.ctrlKey&&e.key==='k'){
    e.preventDefault();
    const search=document.getElementById('wsSearch')||document.querySelector('[placeholder*="검색"]');
    if(search){search.focus();search.select();}
  }
});

/* ── 4C-8. 사이드패널 버튼 바인딩 ── */
function bindSidePanelButtons(){
  // 변경 버튼
  const changeBtn=document.querySelector('#sidePanel [onclick*="updateLotStatus"], #sidePanel .btn-change');
  if(!changeBtn){
    // 하단 버튼들에 이벤트 바인딩
    document.querySelectorAll('#sidePanel button').forEach(btn=>{
      const text=btn.textContent.trim();
      if(text==='변경') btn.onclick=updateLotStatus;
    });
  }
}

/* ── 4C-9. Excel 버튼 바인딩 ── */
function bindExcelButton(){
  const btn=document.querySelector('[onclick*="exportExcel"], .btn-excel');
  if(!btn){
    document.querySelectorAll('#workspaceTab button, #workspaceTab .tb-btn').forEach(b=>{
      if(b.textContent.includes('엑셀')||b.textContent.includes('Excel')){
        b.onclick=exportExcel;
      }
    });
  }
}

/* ── 4C-10. 탭 전환 시 추가 바인딩 ── */
const _origRenderTab=renderTab;
window.renderTab=function(tab){
  _origRenderTab(tab);
  
  // 워크스페이스 탭 전환 후 바인딩
  if(tab==='workspace'){
    setTimeout(()=>{
      setupWorkspaceSearch();
      setupWorkspaceFilters();
      bindWorkspaceClicks();
      bindExcelButton();
    },100);
  }
};

/* ── 4C-11. 설정 탭 — Gemini API 키 저장 ── */
function saveGeminiKey(){
  const input=document.getElementById('geminiKeyInput')||document.getElementById('aiKeyInput');
  if(!input){toast('API 키 입력 필드를 찾을 수 없습니다','err');return;}
  const key=input.value.trim();
  if(!key){toast('API 키를 입력하세요','warn');return;}
  localStorage.setItem('gemini_api_key',key);
  toast('Gemini API 키 저장 완료','ok');
  // 상태 표시 업데이트
  const status=document.getElementById('aiKeyStatus');
  if(status){
    status.textContent='✅ 키 설정됨';
    status.style.color='var(--green)';
  }
}
window.saveGeminiKey=saveGeminiKey;

/* ── 4C-12. 초기화 보강 ── */
const _origInitApp=typeof initApp==='function'?initApp:null;

function initAppEnhanced(){
  // loadTheme(); // Part 1에서 처리됨
  if(_origInitApp) _origInitApp();
  
  setTimeout(()=>{
    bindSidePanelButtons();
  },1000);
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',initAppEnhanced);
}else{
  // loadTheme(); // Part 1에서 처리됨
  setTimeout(bindSidePanelButtons,1000);
}

/* ── 4C-13. 온라인/오프라인 배너 ── */
window.addEventListener('online',()=>{
  const banner=document.getElementById('offlineBanner');
  if(banner) banner.style.display='none';
  toast('온라인 복구','ok');
});
window.addEventListener('offline',()=>{
  const banner=document.getElementById('offlineBanner');
  if(banner) banner.style.display='flex';
  toast('오프라인 상태입니다','warn');
});

console.log('✅ Part 4-C 로드 완료');
console.log('🎉 ESC Manager v9.0 — 전체 로드 완료');
// ═══════════════════════════════════════════════════════════
// 끝 — ESC Manager v9.0 main.js 완성
// ═══════════════════════════════════════════════════════════

