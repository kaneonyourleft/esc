import{initializeApp as $t}from"https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";import{getAuth as kt,GoogleAuthProvider as Dt,signInWithPopup as Et,signInWithRedirect as St,signOut as Mt,getRedirectResult as Lt,onAuthStateChanged as zt}from"https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";import{getFirestore as Tt,getDocs as It,collection as et,onSnapshot as ct,query as At,orderBy as Bt,updateDoc as it,doc as J,setDoc as Ct,deleteDoc as Pt}from"https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))i(s);new MutationObserver(s=>{for(const a of s)if(a.type==="childList")for(const o of a.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&i(o)}).observe(document,{childList:!0,subtree:!0});function e(s){const a={};return s.integrity&&(a.integrity=s.integrity),s.referrerPolicy&&(a.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?a.credentials="include":s.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function i(s){if(s.ep)return;s.ep=!0;const a=e(s);fetch(s.href,a)}})();(function(){const t="data:image/svg+xml,"+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="80" fill="%236366f1"/><text x="256" y="340" font-family="Arial,sans-serif" font-size="240" font-weight="bold" fill="white" text-anchor="middle">ESC</text></svg>'.replace(/%/g,"%25")),e={name:"ESC Manager",short_name:"ESC",description:"세라믹 정전척 생산관리 시스템",start_url:"./",display:"standalone",background_color:"#0a0f1e",theme_color:"#0a0f1e",icons:[{src:t,sizes:"192x192",type:"image/svg+xml"},{src:t,sizes:"512x512",type:"image/svg+xml"}]},i=new Blob([JSON.stringify(e)],{type:"application/json"}),s=document.createElement("link");s.rel="manifest",s.href=URL.createObjectURL(i),document.head.appendChild(s);const a=document.createElement("link");a.rel="apple-touch-icon",a.href=t,document.head.appendChild(a);const o=`
    const CACHE_NAME='esc-v9-cache-v3';
    self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll([self.registration.scope])).then(()=>self.skipWaiting()));});
    self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
    self.addEventListener('fetch',e=>{
      const url=new URL(e.request.url);
      if(url.hostname.includes('gstatic.com')||url.hostname.includes('googleapis.com')||url.hostname.includes('firebase')||url.hostname.includes('cdn.sheetjs.com')||url.hostname.includes('cdn.jsdelivr.net')){
        e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));return;
      }
      e.respondWith(caches.match(e.request).then(cached=>{
        const fetched=fetch(e.request).then(resp=>{if(resp&&resp.status===200){const clone=resp.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,clone));}return resp;}).catch(()=>cached);
        return cached||fetched;
      }));
    });`;if("serviceWorker"in navigator&&navigator.serviceWorker.register(URL.createObjectURL(new Blob([o],{type:"application/javascript"})),{scope:"./"}).catch(()=>{}),window.addEventListener("online",()=>{const d=document.getElementById("offlineBanner");d&&d.classList.remove("show")}),window.addEventListener("offline",()=>{const d=document.getElementById("offlineBanner");d&&d.classList.add("show")}),!navigator.onLine){const d=document.getElementById("offlineBanner");d&&d.classList.add("show")}})();function pt(n){return new Promise((t,e)=>{if(document.querySelector(`script[src="${n}"]`)){t();return}const i=document.createElement("script");i.src=n,i.onload=t,i.onerror=e,document.head.appendChild(i)})}Promise.all([pt("https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js"),pt("https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js")]).catch(()=>console.warn("CDN 라이브러리 일부 로딩 실패"));const jt={apiKey:"AIzaSyAwDS2PigihTH6RKMxzrH-utlaKJbtHBTY",authDomain:"esc-production-management.firebaseapp.com",projectId:"esc-production-management",storageBucket:"esc-production-management.firebasestorage.app",messagingSenderId:"622370430583",appId:"1:622370430583:web:363b6e2f185fddcbd33072"},gt=$t(jt),F=kt(gt),B=Tt(gt),ut=new Dt;let h=[],ft=[],C=null,H="home",st=30,K=new Date,_=!1,A=!1;const S={탈지:"#3b82f6",소성:"#f59e0b",환원소성:"#a855f7",평탄화:"#10b981",도금:"#06b6d4",열처리:"#ec4899"},E=["탈지","소성","환원소성","평탄화","도금","열처리"],Y={탈지:{BL:["1호기","2호기","3호기"],WN:["1호기","2호기","3호기"],HP:["1호기","2호기","3호기"]},소성:{BL:["1호기","4호기"],WN:["5호기","10호기","11호기","12호기","13호기","14호기","15호기","16호기","17호기","18호기"],HP:["5호기","10호기","11호기","12호기","13호기","14호기","15호기","16호기","17호기","18호기"]},환원소성:{BL:["2호기"],WN:[],HP:[]},평탄화:{BL:["3호기"],WN:["6호기","7호기","8호기","9호기"],HP:["6호기","7호기","8호기","9호기"]},도금:{BL:["외주"],WN:["외주"],HP:["외주"]},열처리:{BL:["GB"],WN:["GB"],HP:["GB"]}},vt=[{id:"todayTask",label:"📌 오늘 할 일",enabled:!0,order:1},{id:"preventAlert",label:"🔔 예방적 알림",enabled:!0,order:2},{id:"kpiGrid",label:"📊 KPI 카드",enabled:!0,order:3},{id:"productGroup",label:"📦 제품그룹 현황",enabled:!0,order:4},{id:"pipeline",label:"🔄 라이브 파이프라인",enabled:!0,order:5},{id:"kanban",label:"🎯 드래그 보드",enabled:!1,order:6},{id:"equipStatus",label:"🏭 설비 현황",enabled:!1,order:7},{id:"charts",label:"📈 상태분포/주간완료 차트",enabled:!0,order:8},{id:"recentActivity",label:"🕐 최근 활동",enabled:!0,order:9}];function qt(){try{const n=JSON.parse(localStorage.getItem("esc_widget_config"));if(n&&n.length)return n}catch{}return JSON.parse(JSON.stringify(vt))}let j=qt();function Nt(n){if(!n)return"";const t=n instanceof Date?n:new Date(n);return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0")}function T(n){return Nt(n)}function Ot(n,t){let e=new Date(n);for(let i=0;i<t;){e.setDate(e.getDate()+1);const s=e.getDay();s!==0&&s!==6&&i++}return e}function xt(n,t){let e=new Date(n<t?n:t),i=new Date(n<t?t:n),s=0;for(;e<i;)e.setDate(e.getDate()+1),e.getDay()!==0&&e.getDay()!==6&&s++;return n<t?s:-s}function Ht(n,t,e){const i=["탈지","소성"];return n==="BL"&&i.push("환원소성"),i.push("평탄화"),i.push("도금"),i.join("→")}function _t(n,t,e){return n==="탈지"||n==="소성"?t==="BL"&&e>=9?5:3:n==="환원소성"||n==="평탄화"?3:n==="도금"||n==="열처리"?1:3}function I(n){return`<span class="badge ${{대기:"badge-wait",진행:"badge-prog",진행중:"badge-prog",완료:"badge-done",출하완료:"badge-done",지연:"badge-late",이슈:"badge-late",폐기:"badge-disc"}[n]||"badge-wait"}">${n||"대기"}</span>`}function M(n,t="ok"){const e=document.createElement("div");e.className=`toast toast-${t}`;const i={ok:"✅",err:"❌",warn:"⚠️"};e.innerHTML=`<span>${i[t]||"ℹ️"}</span><span>${n}</span>`;const s=document.getElementById("toastContainer");s&&(s.appendChild(e),setTimeout(()=>e.remove(),3e3))}function w(n){return(n||"").replace(/'/g,"\\'").replace(/"/g,"&quot;")}function Rt(n,t){if(!n||!t)return 0;const e=new Date(n),i=new Date(t);let s=0,a=new Date(e);for(;a<i;)a.setDate(a.getDate()+1),a.getDay()!==0&&a.getDay()!==6&&s++;return Math.max(s,1)}function N(n){const t=n.processes||{},e=(n.route||E.join("→")).split("→").filter(Boolean);for(let i=0;i<e.length;i++){const s=t[e[i]];if(!s||s.status!=="완료")return e[i]}return e[e.length-1]||E[0]}function Q(n){const t=n.processes||{},e=(n.route||E.join("→")).split("→").filter(Boolean);if(!e.length)return 0;const i=e.filter(s=>t[s]&&t[s].status==="완료").length;return Math.round(i/e.length*100)}function Wt(n){if(!n.startDate&&!n.createdAt)return"-";const t=n.startDate||n.createdAt,e=xt(new Date(t),new Date);return e>=0?`D+${e}`:`D${e}`}function O(n){const t=(n.sn||"").toUpperCase();return t.includes("BL")||t.includes("BIPOLAR")?"BL":t.includes("HP")?"HP":"WN"}function P(n,t){let e=document.getElementById(n);if(e||(e=document.createElement("div"),e.id=n,e.className="modal-overlay hidden",e.innerHTML='<div class="modal-content"></div>',e.addEventListener("click",i=>{i.target===e&&e.classList.add("hidden")}),document.body.appendChild(e)),t){const i=e.querySelector(".modal-content");i&&(i.innerHTML=t)}e.classList.remove("hidden")}function q(n){const t=document.getElementById(n);t&&t.classList.add("hidden")}window.openModal=P;window.closeModal=q;window.doLogin=async function(){try{await Et(F,ut)}catch(n){if(n.code==="auth/popup-blocked")try{await St(F,ut)}catch(t){M(t.message,"err")}else M(n.message,"err")}};window.doLogout=async function(){await Mt(F)};Lt(F).catch(()=>{});zt(F,async n=>{const t=document.getElementById("loginScreen")||document.getElementById("login-screen"),e=document.getElementById("app");n?(C=n,t&&(t.style.display="none"),e&&(e.style.display="flex",e.classList.add("visible")),Ut(n),ne(),oe(),await Ft(),W("home")):(C=null,t&&(t.style.display="flex"),e&&(e.style.display="none",e.classList.remove("visible")))});function Ut(n){const t=n.displayName||n.email||"",e=t.split(" ").map(s=>s[0]).join("").toUpperCase().slice(0,2);["sbAvatar","tbAvatar"].forEach(s=>{const a=document.getElementById(s);a&&(n.photoURL?a.innerHTML=`<img src="${n.photoURL}" alt="">`:a.textContent=e)});const i={sbName:t,sbEmail:n.email,settingName:t,settingEmail:n.email};Object.entries(i).forEach(([s,a])=>{const o=document.getElementById(s);o&&(o.textContent=a)})}let nt=null,ot=null;async function Ft(){(await It(et(B,"products"))).docs.map(t=>({id:t.id,...t.data()})),nt&&nt(),nt=ct(et(B,"production"),t=>{h=t.docs.map(e=>({id:e.id,...e.data()})),Yt()}),ot&&ot(),ot=ct(At(et(B,"issues"),Bt("createdAt","desc")),t=>{ft=t.docs.map(e=>({id:e.id,...e.data()})),H==="calendar"&&rt()})}function Yt(){H==="home"?at():H==="workspace"?R():H==="gantt"?V():H==="analysis"&&bt()}function W(n){H=n,document.querySelectorAll(".tab-content").forEach(e=>e.style.display="none");const t=document.getElementById(n+"Tab");t&&(t.style.display=""),document.querySelectorAll(".sb-item,.nav-item").forEach(e=>e.classList.toggle("active",e.dataset.tab===n)),document.querySelectorAll(".bb-item,.bottom-tab").forEach(e=>e.classList.toggle("active",e.dataset.tab===n)),n==="home"?at():n==="workspace"?R():n==="calendar"?rt():n==="gantt"?V():n==="analysis"?bt():n==="ai"?dt():n==="settings"&&ht()}window.switchTab=W;function at(){const n=new Date,t=n.getHours(),e=t<6?"🌙 새벽에도 열심히네요":t<12?"🌅 좋은 아침입니다":t<18?"☀️ 좋은 오후입니다":"🌆 수고하셨습니다",i=h.filter(r=>r.status==="진행"||r.status==="진행중").length,s=ft.filter(r=>r.date===T(n)).length,a=document.getElementById("greetMsg");a&&(a.textContent=`${e}, ${(C?.displayName||"").split(" ")[0]||"관리자"}님!`);const o=document.getElementById("greetSub");o&&(o.textContent=`현재 진행중 ${i}건 · 오늘 이슈 ${s}건`);const d=h.filter(r=>r.status==="지연"),p=document.getElementById("delayAlertCard");if(p)if(d.length>0){p.style.display="";const r=document.getElementById("delayAlertMsg");r&&(r.textContent=`${d.length}건의 생산이 지연 중: ${d.slice(0,3).map(u=>u.sn).join(", ")}${d.length>3?"...":""}`)}else p.style.display="none";const c=document.getElementById("widgetContainer");if(!c)return;c.innerHTML="";const l=[...j].sort((r,u)=>r.order-u.order);l.forEach(r=>{if(!r.enabled)return;const u=document.createElement("div");u.id="widget_"+r.id,u.style.marginBottom="16px",c.appendChild(u)}),l.forEach(r=>{if(!r.enabled)return;const u=document.getElementById("widget_"+r.id);if(u){if(r.id==="todayTask")u.innerHTML='<div class="card"><div class="card-title">📌 오늘 할 일</div><div id="todayTaskContent"></div></div>',Qt();else if(r.id==="preventAlert")u.innerHTML='<div class="card"><div class="card-title">🔔 예방적 알림</div><div id="preventAlertContent"></div></div>',Xt();else if(r.id==="kpiGrid")Gt(u);else if(r.id==="productGroup")Jt(u);else if(r.id==="pipeline")u.innerHTML='<div class="card"><div class="card-title">🔄 라이브 파이프라인</div><div class="pipeline" id="pipelineWrap"></div></div>',Kt();else if(r.id==="kanban")u.innerHTML=`<div class="card"><div class="equip-section-toggle" onclick="toggleKanban()"><span id="kanbanToggleArrow">${A?"▼":"▶"}</span><span>🎯 드래그 보드</span></div><div id="kanbanContent" style="display:${A?"block":"none"};margin-top:12px"></div></div>`,A&&yt();else if(r.id==="equipStatus")u.innerHTML=`<div class="card"><div class="equip-section-toggle" onclick="toggleEquipSection()"><span id="equipToggleArrowInner">${_?"▼":"▶"}</span><span>🏭 설비 현황</span><span style="font-size:12px;font-weight:400;color:var(--t2)" id="equipSummaryTextInner"></span></div><div id="equipStatusContentInner" style="display:${_?"block":"none"};margin-top:12px"></div></div>`,Vt();else if(r.id==="charts")u.innerHTML='<div class="grid2"><div class="card"><div class="card-title">📊 상태 분포</div><div class="chart-wrap"><canvas id="donutChart" height="200"></canvas></div></div><div class="card"><div class="card-title">📈 이번 주 완료</div><div class="chart-wrap"><canvas id="weekBarChart" height="200"></canvas></div></div></div>',Zt("donutChart",{대기:h.filter(y=>y.status==="대기").length,진행:h.filter(y=>y.status==="진행"||y.status==="진행중").length,완료:h.filter(y=>y.status==="완료"||y.status==="출하완료").length,지연:d.length,폐기:h.filter(y=>y.status==="폐기").length}),te();else if(r.id==="recentActivity"){const y=[...h].sort((b,x)=>{const m=typeof x.createdAt=="number"?x.createdAt:new Date(x.createdAt||0).getTime(),f=typeof b.createdAt=="number"?b.createdAt:new Date(b.createdAt||0).getTime();return m-f}).slice(0,8);u.innerHTML=`<div class="card"><div class="card-title">🕐 최근 활동</div><div>${y.map(b=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);flex-wrap:wrap">${I(b.status)}<span style="font-size:13px;font-weight:500;cursor:pointer;color:var(--ac2)" onclick="openSidePanel('${w(b.sn)}')">${b.sn}</span><span style="font-size:12px;color:var(--t2)">${b.productName||b.product||""}</span><span style="font-size:12px;color:var(--t2);margin-left:auto">${N(b)||""}</span></div>`).join("")}</div></div>`}}})}function Jt(n){const t={};h.forEach(s=>{const a=s.productName||s.product||"미분류";t[a]||(t[a]={items:[],done:0,active:0,issue:0,nearDue:null}),t[a].items.push(s);const o=s.status||"";if(o==="완료"||o==="출하완료"?t[a].done++:t[a].active++,s.issues&&s.issues.length&&(t[a].issue+=s.issues.length),s.endDate||s.dueDate){const d=s.endDate||s.dueDate;(!t[a].nearDue||d<t[a].nearDue)&&(t[a].nearDue=d)}});const e=Object.entries(t).sort((s,a)=>a[1].active-s[1].active);if(!e.length){n.innerHTML='<div class="card"><div class="card-title">📦 제품그룹 현황</div><div style="text-align:center;padding:20px;color:var(--t2)">등록된 데이터 없음</div></div>';return}let i='<div class="card"><div class="card-title">📦 제품그룹 현황</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-top:12px">';e.forEach(([s,a])=>{const o=a.items.length,d=o>0?Math.round(a.done/o*100):0,p={};a.items.filter(r=>r.status!=="완료"&&r.status!=="출하완료").forEach(r=>{const u=N(r);u&&(p[u]=(p[u]||0)+1)});const c=Object.entries(p).sort((r,u)=>u[1]-r[1])[0],l=a.nearDue?(()=>{const r=Math.ceil((new Date(a.nearDue)-new Date)/864e5);return r<0?`<span style="color:var(--err)">${Math.abs(r)}일 지연</span>`:r<=3?`<span style="color:var(--warn)">${r}일 남음</span>`:`<span style="color:var(--t2)">${r}일 남음</span>`})():"";i+=`<div style="padding:14px;border-radius:10px;border:1px solid var(--border);background:var(--bg3)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <span style="font-weight:600;font-size:14px">${s}</span>
        <span style="font-size:12px;color:var(--t2)">${o}매</span>
      </div>
      <div class="prog-bar" style="height:6px;margin-bottom:8px"><div class="prog-fill" style="width:${d}%;background:${d===100?"var(--ok)":"var(--ac)"}"></div></div>
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--t2)">
        <span>진행 ${a.active} · 완료 ${a.done}</span>
        <span>${d}%</span>
      </div>
      ${c?`<div style="margin-top:6px;font-size:11px"><span class="proc-dot" style="background:${S[c[0]]||"#666"}"></span> 주요공정: ${c[0]} (${c[1]}건)</div>`:""}
      ${a.issue?`<div style="margin-top:4px;font-size:11px;color:var(--err)">⚠️ 이슈 ${a.issue}건</div>`:""}
      ${l?`<div style="margin-top:4px;font-size:11px">📅 최근납기: ${l}</div>`:""}
    </div>`}),i+="</div></div>",n.innerHTML=i}function Gt(n){const t=h.length,e=h.filter(a=>a.status==="완료"||a.status==="출하완료").length,i=h.filter(a=>a.status==="진행"||a.status==="진행중").length,s=h.filter(a=>a.status==="지연").length;n.innerHTML=`<div class="grid4"><div class="kpi-card"><div class="kpi-label">총 생산</div><div class="kpi-value">${t}</div><div class="kpi-sub">등록된 S/N</div></div><div class="kpi-card"><div class="kpi-label">완료율</div><div class="kpi-value">${t?Math.round(e/t*100):0}%</div><div class="kpi-sub">${e}/${t}</div></div><div class="kpi-card"><div class="kpi-label">진행중</div><div class="kpi-value" style="color:var(--warn)">${i}</div><div class="kpi-sub">현재 생산 중</div></div><div class="kpi-card"><div class="kpi-label">지연</div><div class="kpi-value" style="color:var(--err)">${s}</div><div class="kpi-sub">관리 필요</div></div></div>`}function Kt(){let n="";E.forEach((e,i)=>{let s=0,a=0,o=0;h.forEach(p=>{const c=(p.processes||{})[e];c&&(c.status==="진행"||c.status==="진행중"?s++:c.status==="대기"?a++:c.status==="완료"&&o++)});const d=S[e]||"#666";n+=`<div class="pipe-stage" style="border-top:3px solid ${d}"><div class="pipe-name" style="color:${d}">${e}</div><div class="pipe-counts"><span class="pipe-count" style="background:rgba(245,158,11,0.2);color:#f59e0b">진행${s}</span><span class="pipe-count" style="background:rgba(59,130,246,0.2);color:#3b82f6">대기${a}</span><span class="pipe-count" style="background:rgba(16,185,129,0.2);color:#10b981">완료${o}</span></div></div>`,i<E.length-1&&(n+='<div class="pipe-arrow">→</div>')});const t=document.getElementById("pipelineWrap");t&&(t.innerHTML=n)}function Qt(){const n=T(new Date),t=[],e=[],i=[];h.forEach(o=>{const d=o.processes||{};(o.route||E.join("→")).split("→").filter(Boolean).forEach(c=>{const l=d[c]||{};l.planEnd===n&&l.status!=="완료"&&t.push({sn:o.sn,proc:c,product:o.productName||o.product||"",equip:l.equip||"",status:l.status||"대기"}),l.startDate===n&&l.status!=="완료"&&e.push({sn:o.sn,proc:c,product:o.productName||o.product||"",equip:l.equip||"",status:l.status||"대기"}),l.planEnd&&l.planEnd<n&&l.status!=="완료"&&i.push({sn:o.sn,proc:c,product:o.productName||o.product||"",equip:l.equip||"",status:l.status||"대기",planEnd:l.planEnd})})});const s=document.getElementById("todayTaskContent");if(!s)return;if(!t.length&&!e.length&&!i.length){s.innerHTML='<div style="text-align:center;padding:16px;color:var(--t2);font-size:13px">오늘 예정된 작업이 없습니다 ✨</div>';return}let a="";t.length&&(a+=`<div class="today-section red"><div class="today-section-title"><span style="color:var(--err)">🔴 오늘 완료 예정 (${t.length})</span></div>${t.map(o=>`<div class="today-item"><span style="cursor:pointer;color:var(--ac2);font-family:monospace" onclick="openSidePanel('${w(o.sn)}')">${o.product} ${o.sn}</span><span class="proc-dot" style="background:${S[o.proc]||"#666"}"></span><span>${o.proc}</span><span style="color:var(--t2)">${o.equip}</span>${I(o.status)}</div>`).join("")}</div>`),e.length&&(a+=`<div class="today-section yellow"><div class="today-section-title"><span style="color:var(--warn)">🟡 오늘 투입 예정 (${e.length})</span></div>${e.map(o=>`<div class="today-item"><span style="cursor:pointer;color:var(--ac2);font-family:monospace" onclick="openSidePanel('${w(o.sn)}')">${o.product} ${o.sn}</span><span class="proc-dot" style="background:${S[o.proc]||"#666"}"></span><span>${o.proc}</span><span style="color:var(--t2)">${o.equip}</span>${I(o.status)}</div>`).join("")}</div>`),i.length&&(a+=`<div class="today-section orange"><div class="today-section-title"><span style="color:#f97316">⚠️ 지연 중 (${i.length})</span></div>${i.map(o=>`<div class="today-item"><span style="cursor:pointer;color:var(--ac2);font-family:monospace" onclick="openSidePanel('${w(o.sn)}')">${o.product} ${o.sn}</span><span class="proc-dot" style="background:${S[o.proc]||"#666"}"></span><span>${o.proc}</span><span style="color:var(--t2)">${o.equip}</span>${I(o.status)}<span style="color:var(--err);font-size:11px">예정:${o.planEnd}</span></div>`).join("")}</div>`),s.innerHTML=a}function Xt(){const n=new Date;n.setHours(0,0,0,0);const t=T(n),e=new Date(n);e.setDate(e.getDate()+1);const i=T(e),s=new Date(n);s.setDate(s.getDate()+3);const a=T(s),o=[];h.forEach(r=>{const u=r.processes||{};(r.route||E.join("→")).split("→").filter(Boolean).forEach(b=>{const x=u[b]||{};x.planEnd===i&&x.status!=="완료"&&o.push({sn:r.sn,proc:b,equip:x.equip||""})})});const d=[];h.forEach(r=>{if(r.status==="완료"||r.status==="출하완료"||r.status==="폐기")return;const u=r.endDate||r.dueDate;u&&u>=t&&u<=a&&d.push({sn:r.sn,productName:r.productName||r.product||"",endDate:u,status:r.status})});const p=[];h.forEach(r=>{const u=r.processes||{};(r.route||E.join("→")).split("→").filter(Boolean).forEach(b=>{const x=u[b]||{};if((x.status==="진행"||x.status==="진행중")&&x.startDate&&x.planDays){const m=Ot(new Date(x.startDate),x.planDays);if(m<n){const f=xt(m,n);p.push({sn:r.sn,proc:b,equip:x.equip||"",planDays:x.planDays,overDays:f})}}})});const c=document.getElementById("preventAlertContent");if(!c)return;if(!o.length&&!d.length&&!p.length){c.innerHTML='<div style="text-align:center;padding:16px;color:var(--ok);font-size:13px">현재 특별한 알림이 없습니다 ✅</div>';return}let l="";o.length&&(l+=`<div class="alert-card-section blue"><div class="today-section-title"><span style="color:var(--info)">📅 내일 완료 예정 (${o.length})</span></div>${o.map(r=>`<div class="alert-item"><span class="equip-sn-link" onclick="openSidePanel('${w(r.sn)}')">${r.sn}</span><span class="proc-dot" style="background:${S[r.proc]||"#666"}"></span><span>${r.proc}</span><span style="color:var(--t2)">${r.equip}</span></div>`).join("")}</div>`),d.length&&(l+=`<div class="alert-card-section orange"><div class="today-section-title"><span style="color:#f97316">⏰ 3일 이내 납기 (${d.length})</span></div>${d.map(r=>{const u=Math.ceil((new Date(r.endDate)-n)/864e5);return`<div class="alert-item"><span class="equip-sn-link" onclick="openSidePanel('${w(r.sn)}')">${r.sn}</span><span style="font-size:11px;color:var(--t2)">${r.productName}</span>${I(r.status)}<span style="color:${u<=1?"var(--err)":"#f97316"};font-weight:600;font-size:11px">${u===0?"오늘!":u+"일 남음"}</span></div>`}).join("")}</div>`),p.length&&(l+=`<div class="alert-card-section red"><div class="today-section-title"><span style="color:var(--err)">🔥 공정 지체 감지 (${p.length})</span></div>${p.map(r=>`<div class="alert-item"><span class="equip-sn-link" onclick="openSidePanel('${w(r.sn)}')">${r.sn}</span><span class="proc-dot" style="background:${S[r.proc]||"#666"}"></span><span>${r.proc}</span><span style="color:var(--err);font-size:11px;font-weight:600">계획${r.planDays}일→${r.overDays}일초과</span></div>`).join("")}</div>`),c.innerHTML=l}window.toggleEquipSection=function(){_=!_;const n=document.getElementById("equipStatusContentInner"),t=document.getElementById("equipToggleArrowInner");n&&(n.style.display=_?"":"none"),t&&(t.textContent=_?"▼":"▶")};window.toggleKanban=function(){A=!A;const n=document.getElementById("kanbanContent"),t=document.getElementById("kanbanToggleArrow");n&&(n.style.display=A?"block":"none",A&&yt()),t&&(t.textContent=A?"▼":"▶")};function Vt(){const n={},t=T(new Date);let e=0,i=0;E.forEach(d=>{const p=new Set;Object.values(Y[d]||{}).forEach(c=>c.forEach(l=>p.add(l))),p.forEach(c=>{const l=d+"__"+c;n[l]||(n[l]={proc:d,equip:c,active:[],dueToday:0}),h.forEach(r=>{const u=(r.processes||{})[d];!u||u.equip!==c||((u.status==="진행"||u.status==="진행중")&&n[l].active.push(r.sn),u.planEnd===t&&u.status!=="완료"&&n[l].dueToday++)}),n[l].active.length>0?e++:i++})});const s=document.getElementById("equipSummaryTextInner");s&&(s.textContent=`가동 ${e} · 유휴 ${i}`);let a="";E.forEach(d=>{const p=S[d]||"#666",c=Object.values(n).filter(r=>r.proc===d);if(!c.length)return;const l=c.filter(r=>r.active.length>0).length;a+=`<div style="margin-bottom:14px"><div style="font-size:13px;font-weight:600;margin-bottom:8px;color:${p}">${d} <span style="font-size:11px;color:var(--t2);font-weight:400">(가동 ${l}/${c.length})</span></div><div class="grid3">`,c.forEach(r=>{const u=r.active.length>0;a+=`<div class="equip-card" style="border-top:2px solid ${p}"><div class="equip-card-title"><span>${u?"🟢":"⚪"}</span><span>${r.equip}</span><span style="font-size:10px;color:var(--t2);font-weight:400">${u?"가동중":"유휴"}</span></div><div style="font-size:12px">진행: <strong>${r.active.length}</strong>건</div>${r.dueToday?`<div style="font-size:11px;color:var(--warn)">오늘 완료예정: ${r.dueToday}건</div>`:""}<div class="equip-sn-list">${r.active.slice(0,5).map(y=>`<span class="equip-sn-link" onclick="openSidePanel('${w(y)}')">${y.length>16?"…"+y.slice(-14):y}</span>`).join(", ")}${r.active.length>5?` 외 ${r.active.length-5}건`:""}</div></div>`}),a+="</div></div>"});const o=document.getElementById("equipStatusContentInner");o&&(o.innerHTML=a||'<div style="color:var(--t2);font-size:13px;text-align:center;padding:12px">설비 데이터가 없습니다</div>')}function yt(){const n=document.getElementById("kanbanContent");if(!n)return;const t={};E.forEach(i=>t[i]=[]),h.forEach(i=>{if(i.status==="완료"||i.status==="출하완료"||i.status==="폐기")return;const s=N(i);s&&t[s]!==void 0&&t[s].push(i)});let e='<div class="kanban-board" id="kanbanBoard">';E.forEach(i=>{const s=S[i]||"#666",a=t[i]||[];e+=`<div class="kanban-column" data-proc="${i}"><div class="kanban-header" style="border-bottom-color:${s};color:${s}">${i} (${a.length})</div>`,a.forEach(o=>{const p=(o.processes||{})[i]||{};e+=`<div class="kanban-card" draggable="true" data-sn="${w(o.sn)}" data-proc="${i}" data-route="${w(o.route||E.join("→"))}"><div class="kc-sn" onclick="openSidePanel('${w(o.sn)}')">${o.sn.length>18?"…"+o.sn.slice(-16):o.sn}</div><div class="kc-info">${p.equip||"-"} · ${Wt(o)}</div>${I(p.status||"대기")}</div>`}),e+="</div>"}),e+="</div>",n.innerHTML=e}function Zt(n,t){const e=document.getElementById(n);if(!e)return;const i=e.getContext("2d");e.width=0;const s=e.parentElement.clientWidth||300;e.width=s,e.height=200;const a=[t.대기||0,t.진행||0,t.완료||0,t.지연||0,t.폐기||0],o=["대기","진행","완료","지연","폐기"],d=["#3b82f6","#f59e0b","#10b981","#ef4444","#94a3b8"],p=a.reduce((b,x)=>b+x,0);if(!p){i.fillStyle="#8892b0",i.font="14px sans-serif",i.textAlign="center",i.fillText("데이터 없음",s/2,100);return}const c=Math.min(70,s/4),l=c*.64,r=s<350?s/2:s/2-60,u=100;let y=-Math.PI/2;if(a.forEach((b,x)=>{if(!b)return;const m=b/p*2*Math.PI;i.beginPath(),i.moveTo(r,u),i.arc(r,u,c,y,y+m),i.closePath(),i.fillStyle=d[x],i.fill(),y+=m}),i.beginPath(),i.arc(r,u,l,0,Math.PI*2),i.fillStyle=getComputedStyle(document.body).getPropertyValue("--bg3")||"#131b32",i.fill(),i.fillStyle=getComputedStyle(document.body).getPropertyValue("--t1")||"#f1f5f9",i.font="bold 18px sans-serif",i.textAlign="center",i.fillText(p,r,u+6),i.font="11px sans-serif",i.fillStyle="#8892b0",i.fillText("전체",r,u+22),s>=350){const b=r+c+20;a.forEach((x,m)=>{if(!x)return;const f=40+m*28;i.fillStyle=d[m],i.fillRect(b,f,12,12),i.fillStyle="#f1f5f9",i.font="12px sans-serif",i.textAlign="left",i.fillText(`${o[m]}: ${x}`,b+16,f+10)})}}function te(){const n=document.getElementById("weekBarChart");if(!n)return;const t=n.getContext("2d");n.width=0;const e=n.parentElement.clientWidth||300;n.width=e,n.height=200;const i=new Date,s=i.getDay(),a=new Date(i);a.setDate(i.getDate()-(s===0?6:s-1));const o=["월","화","수","목","금"],d=o.map((y,b)=>{const x=new Date(a);x.setDate(a.getDate()+b);const m=T(x);return h.filter(f=>{const $=f.processes||{};return Object.values($).some(L=>L.actualEnd===m&&L.status==="완료")}).length}),p=Math.max(...d,1),c=30,l=Math.min(40,(e-c*2)/5-10),r=200,u=r-60;t.strokeStyle="rgba(255,255,255,0.08)",[0,p/2,p].forEach(y=>{const b=c+u*(1-y/p);t.beginPath(),t.moveTo(c,b),t.lineTo(e-c,b),t.stroke(),t.fillStyle="#8892b0",t.font="10px sans-serif",t.textAlign="right",t.fillText(Math.round(y),c-4,b+4)}),d.forEach((y,b)=>{const x=c+(e-c*2)/5*b+(e-c*2)/10-l/2,m=y/p*u,f=c+u-m,$=t.createLinearGradient(0,f,0,f+m);$.addColorStop(0,"#818cf8"),$.addColorStop(1,"#6366f1"),t.fillStyle=$,t.beginPath(),t.roundRect?t.roundRect(x,f,l,m,4):t.rect(x,f,l,m),t.fill(),t.fillStyle="#f1f5f9",t.font="11px sans-serif",t.textAlign="center",t.fillText(o[b],x+l/2,r-8),y>0&&t.fillText(y,x+l/2,f-4)})}window.openWidgetSettings=function(){X(),P("widgetModal")};function X(){const n=document.getElementById("widgetSettingsList");if(!n)return;const t=[...j].sort((e,i)=>e.order-i.order);n.innerHTML=t.map((e,i)=>`<div class="widget-item" data-wid="${e.id}"><div class="toggle ${e.enabled?"on":""}" onclick="toggleWidgetEnabled('${e.id}')"></div><div class="wi-name">${e.label}</div><div class="wi-arrows"><button onclick="moveWidget('${e.id}',-1)" ${i===0?"disabled":""}>▲</button><button onclick="moveWidget('${e.id}',1)" ${i===t.length-1?"disabled":""}>▼</button></div></div>`).join("")}window.toggleWidgetEnabled=function(n){const t=j.find(e=>e.id===n);t&&(t.enabled=!t.enabled,X())};window.moveWidget=function(n,t){const e=[...j].sort((o,d)=>o.order-d.order),i=e.findIndex(o=>o.id===n),s=i+t;if(s<0||s>=e.length)return;const a=e[i].order;e[i].order=e[s].order,e[s].order=a,j=e,X()};window.saveWidgetConfig=function(){localStorage.setItem("esc_widget_config",JSON.stringify(j)),M("위젯 설정 저장됨"),q("widgetModal"),at()};window.resetWidgetConfig=function(){j=JSON.parse(JSON.stringify(vt)),X(),M("기본값 초기화")};console.log("✅ Part 1/3 로드 완료 — 초기화·유틸·인증·홈");function R(){const n=document.getElementById("workspaceTab");if(!n)return;const t=window._wsFilterStatus||"all",e=window._wsFilterProduct||"all",i=(window._wsSearch||"").toLowerCase();let s=[...h];t!=="all"&&(t==="active"?s=s.filter(o=>o.status!=="완료"&&o.status!=="출하완료"&&o.status!=="폐기"):t==="done"?s=s.filter(o=>o.status==="완료"||o.status==="출하완료"):t==="issue"?s=s.filter(o=>o.issues&&o.issues.length>0||o.status==="이슈"):t==="delay"&&(s=s.filter(o=>o.status==="지연"))),e!=="all"&&(s=s.filter(o=>(o.productName||o.product)===e)),i&&(s=s.filter(o=>(o.sn||"").toLowerCase().includes(i)||(o.productName||o.product||"").toLowerCase().includes(i)||(o.customer||"").toLowerCase().includes(i))),s.sort((o,d)=>{const p=typeof o.createdAt=="number"?o.createdAt:new Date(o.createdAt||0).getTime();return(typeof d.createdAt=="number"?d.createdAt:new Date(d.createdAt||0).getTime())-p});const a=[...new Set(h.map(o=>o.productName||o.product).filter(Boolean))].sort();n.innerHTML=`
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:16px">
      <div style="flex:1;min-width:200px">
        <input type="text" id="wsSearchInput" placeholder="🔍 S/N, 제품, 고객 검색..." value="${window._wsSearch||""}" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid var(--border);background:var(--bg3);color:var(--t1);font-size:13px">
      </div>
      <select id="wsFilterStatus" style="padding:9px 12px;border-radius:10px;border:1px solid var(--border);background:var(--bg3);color:var(--t1);font-size:13px">
        <option value="all"${t==="all"?" selected":""}>전체 상태</option>
        <option value="active"${t==="active"?" selected":""}>진행중</option>
        <option value="done"${t==="done"?" selected":""}>완료</option>
        <option value="issue"${t==="issue"?" selected":""}>이슈</option>
        <option value="delay"${t==="delay"?" selected":""}>지연</option>
      </select>
      <select id="wsFilterProduct" style="padding:9px 12px;border-radius:10px;border:1px solid var(--border);background:var(--bg3);color:var(--t1);font-size:13px">
        <option value="all">전체 제품</option>
        ${a.map(o=>`<option value="${o}"${e===o?" selected":""}>${o}</option>`).join("")}
      </select>
      <button class="btn-primary" onclick="openNewLotModal()" style="padding:9px 18px;border-radius:10px;font-size:13px;cursor:pointer;border:none;background:var(--ac);color:#fff">+ 새 LOT</button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:16px">
      <div class="kpi-card" style="padding:14px;text-align:center"><div class="kpi-value" style="color:var(--ac)">${h.length}</div><div class="kpi-sub">전체</div></div>
      <div class="kpi-card" style="padding:14px;text-align:center"><div class="kpi-value" style="color:var(--warn)">${h.filter(o=>o.status==="진행"||o.status==="진행중").length}</div><div class="kpi-sub">진행중</div></div>
      <div class="kpi-card" style="padding:14px;text-align:center"><div class="kpi-value" style="color:var(--ok)">${h.filter(o=>o.status==="완료"||o.status==="출하완료").length}</div><div class="kpi-sub">완료</div></div>
      <div class="kpi-card" style="padding:14px;text-align:center"><div class="kpi-value" style="color:var(--err)">${h.filter(o=>o.status==="지연").length}</div><div class="kpi-sub">지연</div></div>
    </div>

    <div class="card" style="overflow-x:auto;padding:0">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:var(--bg3);border-bottom:2px solid var(--border)">
            <th style="padding:12px 10px;text-align:left;white-space:nowrap">S/N</th>
            <th style="padding:12px 10px;text-align:left">제품</th>
            <th style="padding:12px 10px;text-align:left">고객</th>
            <th style="padding:12px 10px;text-align:left">공정 현황</th>
            <th style="padding:12px 10px;text-align:center">현재 설비</th>
            <th style="padding:12px 10px;text-align:center">진행률</th>
            <th style="padding:12px 10px;text-align:center">상태</th>
            <th style="padding:12px 10px;text-align:center">납기</th>
            <th style="padding:12px 10px;text-align:center">작업</th>
          </tr>
        </thead>
        <tbody>
          ${s.length===0?'<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--t2)">데이터가 없습니다</td></tr>':s.map(o=>{const d=Q(o),p=N(o),c=o.processes||{},l=(o.route||E.join("→")).split("→").filter(Boolean),u=(c[p]||{}).equip||"";O(o);const y=o.endDate||o.dueDate||"",b=y&&new Date(y)<new Date?"color:var(--err);font-weight:600":"color:var(--t2)",x=l.map(m=>{const f=c[m]||{},$=f.status==="완료",L=f.status==="진행"||f.status==="진행중",g=m===p,v=S[m]||"#666",k=f.equip?` (${f.equip})`:"";let D="";return $?D=`background:${v};color:#fff;`:L||g?D=`background:${v}33;color:${v};border:1px solid ${v};`:D="background:var(--bg4);color:var(--t2);border:1px solid var(--border);",`<span title="${m}${k} — ${f.status||"대기"}" style="display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:4px;font-size:10px;white-space:nowrap;${D}cursor:pointer" onclick="event.stopPropagation();openProcUpdate('${w(o.sn)}','${w(m)}')">${$?"✓":g?"▶":""} ${m.length>3?m.slice(0,2):m}${k}</span>`}).join('<span style="color:var(--t2);font-size:9px;margin:0 1px">→</span>');return`<tr style="border-bottom:1px solid var(--border);cursor:pointer" onclick="openSidePanel('${w(o.sn)}')">
                <td style="padding:10px;font-weight:600;font-family:monospace;white-space:nowrap;color:var(--ac2)">${o.sn||"-"}</td>
                <td style="padding:10px">${o.productName||o.product||"-"}</td>
                <td style="padding:10px;color:var(--t2)">${o.customer||"-"}</td>
                <td style="padding:10px" onclick="event.stopPropagation()">
                  <div style="display:flex;flex-wrap:wrap;gap:3px;align-items:center">${x}</div>
                </td>
                <td style="padding:10px;text-align:center" onclick="event.stopPropagation()">
                  <div class="equip-picker-wrap" style="position:relative;display:inline-block">
                    <button onclick="toggleEquipDropdown(event,'${w(o.sn)}','${w(p)}')" style="padding:4px 10px;border-radius:6px;border:1px solid ${u?S[p]||"var(--ac)":"var(--border)"};background:${u?"rgba(99,102,241,0.1)":"transparent"};color:${u?"var(--t1)":"var(--t2)"};cursor:pointer;font-size:12px;white-space:nowrap">
                      ${u||"+ 설비"}
                    </button>
                  </div>
                </td>
                <td style="padding:10px;text-align:center">
                  <div style="display:flex;align-items:center;gap:6px;justify-content:center">
                    <div class="prog-bar" style="width:60px;height:6px"><div class="prog-fill" style="width:${d}%;background:${d===100?"var(--ok)":"var(--ac)"}"></div></div>
                    <span style="font-size:11px;min-width:30px">${d}%</span>
                  </div>
                </td>
                <td style="padding:10px;text-align:center">${I(o.status)}</td>
                <td style="padding:10px;text-align:center;font-size:12px;${b}">${y||"-"}</td>
                <td style="padding:10px;text-align:center" onclick="event.stopPropagation()">
                  <button onclick="openProcUpdate('${w(o.sn)}','${w(p)}')" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg3);color:var(--t1);cursor:pointer;font-size:11px">공정입력</button>
                </td>
              </tr>`}).join("")}
        </tbody>
      </table>
    </div>
    <div style="margin-top:12px;font-size:12px;color:var(--t2)">총 ${s.length}건 표시 (전체 ${h.length}건)</div>
  `,document.getElementById("wsSearchInput")?.addEventListener("input",o=>{window._wsSearch=o.target.value,R()}),document.getElementById("wsFilterStatus")?.addEventListener("change",o=>{window._wsFilterStatus=o.target.value,R()}),document.getElementById("wsFilterProduct")?.addEventListener("change",o=>{window._wsFilterProduct=o.target.value,R()})}window.toggleEquipDropdown=function(n,t,e){n.stopPropagation(),document.querySelectorAll(".equip-dropdown-popup").forEach(l=>l.remove());const i=h.find(l=>l.sn===t);if(!i)return;const s=O(i),a=Y[e]&&Y[e][s]||[],o=((i.processes||{})[e]||{}).equip||"";if(a.length===0){M("이 공정/카테고리에 등록된 설비가 없습니다","warn");return}const p=n.currentTarget.getBoundingClientRect(),c=document.createElement("div");c.className="equip-dropdown-popup",c.style.cssText=`position:fixed;top:${p.bottom+4}px;left:${p.left}px;z-index:9999;background:var(--bg2,#1e293b);border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 32px rgba(0,0,0,0.4);padding:8px;min-width:140px;max-height:280px;overflow-y:auto`,c.innerHTML=`
    <div style="font-size:11px;color:var(--t2);padding:4px 8px;margin-bottom:4px">${e} · ${s}</div>
    ${a.map(l=>`
      <div onclick="selectEquip(event,'${w(t)}','${w(e)}','${w(l)}')" 
        style="padding:8px 12px;border-radius:6px;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:8px;
        ${l===o?"background:var(--ac);color:#fff;font-weight:600":""}
        " onmouseover="this.style.background=this.style.background||'var(--bg3)'" onmouseout="if(!this.dataset.sel)this.style.background=''">
        ${l===o?"✓ ":""}${l}
      </div>
    `).join("")}
    <div onclick="selectEquip(event,'${w(t)}','${w(e)}','')" style="padding:8px 12px;border-radius:6px;cursor:pointer;font-size:12px;color:var(--t2);border-top:1px solid var(--border);margin-top:4px">설비 해제</div>
  `,document.body.appendChild(c),setTimeout(()=>{const l=r=>{c.contains(r.target)||(c.remove(),document.removeEventListener("click",l))};document.addEventListener("click",l)},10)};window.selectEquip=async function(n,t,e,i){n.stopPropagation(),document.querySelectorAll(".equip-dropdown-popup").forEach(o=>o.remove());const s=h.find(o=>o.sn===t);if(!s)return;const a=s.id||s.sn;s.processes||(s.processes={}),s.processes[e]||(s.processes[e]={status:"대기"}),i?s.processes[e].equip=i:delete s.processes[e].equip;try{const o={};o[`processes.${e}.equip`]=i||null,await it(J(B,"production",a),o),M(`${t} → ${e}: ${i||"해제"}`,"ok")}catch(o){console.error("설비 저장 실패:",o),M("설비 저장 실패: "+o.message,"err")}R()};window.openProcUpdate=function(n,t){const e=h.find(d=>d.sn===n);if(!e)return;const i=(e.route||E.join("→")).split("→").filter(Boolean),s=e.processes||{},a=O(e);let o=`
    <div class="modal-header">
      <span>공정 입력 — ${n}</span>
      <button class="modal-close" onclick="closeModal('procUpdateModal')">✕</button>
    </div>
    <div class="modal-body" style="max-height:70vh;overflow-y:auto">
      <div style="margin-bottom:16px;padding:12px;background:var(--bg3);border-radius:10px">
        <div style="font-size:14px;font-weight:600">${e.productName||e.product||"-"}</div>
        <div style="font-size:12px;color:var(--t2);margin-top:4px">${e.customer||"-"} · 진행률 ${Q(e)}%</div>
      </div>
      <div style="display:grid;gap:8px">`;i.forEach((d,p)=>{const c=s[d]||{},l=c.status==="완료",r=c.status==="진행"||c.status==="진행중",u=S[d]||"#666",y=Y[d]&&Y[d][a]||[];o+=`<div style="padding:12px;border-radius:10px;border:1px solid ${l?u:"var(--border)"};background:${l?u+"15":"var(--bg3)"}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;background:${l?u:"var(--border)"};color:${l?"#fff":"var(--t2)"}">${l?"✓":p+1}</div>
        <span style="font-weight:600;color:${u}">${d}</span>
        ${l?I("완료"):r?I("진행"):""}
        ${c.equip?`<span style="font-size:11px;background:var(--bg4);padding:2px 8px;border-radius:4px">${c.equip}</span>`:""}
      </div>

      ${l?`
        <div style="font-size:12px;color:var(--t2)">
          ${c.startDate?"시작: "+c.startDate:""} ${c.actualEnd?"→ 완료: "+c.actualEnd:""} ${c.note?"· "+c.note:""}
        </div>
      `:`
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <select id="procEq_${d}" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);color:var(--t1);font-size:12px">
            <option value="">설비 선택</option>
            ${y.map(b=>`<option value="${b}"${c.equip===b?" selected":""}>${b}</option>`).join("")}
          </select>
          <select id="procSt_${d}" style="padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);color:var(--t1);font-size:12px">
            <option value="대기"${!c.status||c.status==="대기"?" selected":""}>대기</option>
            <option value="진행"${c.status==="진행"||c.status==="진행중"?" selected":""}>진행</option>
            <option value="완료"${c.status==="완료"?" selected":""}>완료</option>
            <option value="이슈"${c.status==="이슈"?" selected":""}>이슈</option>
          </select>
          <input type="text" id="procNote_${d}" placeholder="메모" value="${w(c.note||"")}" style="flex:1;min-width:120px;padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);color:var(--t1);font-size:12px">
          <button onclick="saveProcStatus('${w(n)}','${w(d)}')" style="padding:6px 14px;border-radius:6px;border:none;background:${u};color:#fff;cursor:pointer;font-size:12px;font-weight:600">저장</button>
        </div>
      `}
    </div>`}),o+="</div></div>",P("procUpdateModal",o)};window.saveProcStatus=async function(n,t){const e=h.find(u=>u.sn===n);if(!e)return;const i=e.id||e.sn,s=document.getElementById("procEq_"+t),a=document.getElementById("procSt_"+t),o=document.getElementById("procNote_"+t),d=s?s.value:"",p=a?a.value:"대기",c=o?o.value:"",l=T(new Date);e.processes||(e.processes={}),e.processes[t]||(e.processes[t]={});const r=e.processes[t];if(r.equip=d,r.status=p,r.note=c,p==="진행"&&!r.startDate&&(r.startDate=l),p==="완료"){r.actualEnd=l,r.startDate&&(r.actualDays=Rt(r.startDate,l));const u=(e.route||E.join("→")).split("→").filter(Boolean),y=u.indexOf(t);if(y>=0&&y<u.length-1){const x=u[y+1];e.processes[x]||(e.processes[x]={}),e.processes[x].status!=="완료"&&(e.processes[x].status="진행",e.processes[x].startDate||(e.processes[x].startDate=l),e.currentProcess=x)}u.every(x=>(e.processes[x]||{}).status==="완료")&&(e.status="완료",e.completedAt=l)}try{const u={processes:e.processes};e.status==="완료"&&(u.status="완료"),e.currentProcess&&(u.currentProcess=e.currentProcess),await it(J(B,"production",i),u),M(`${n} ${t}: ${p}${d?" ("+d+")":""}`,"ok"),q("procUpdateModal")}catch(u){M("저장 실패: "+u.message,"err")}};function rt(){const n=document.getElementById("calendarTab");if(!n)return;const t=K,e=t.getFullYear(),i=t.getMonth(),s=new Date(e,i,1).getDay(),a=new Date(e,i+1,0).getDate(),o=T(new Date),d={};h.forEach(l=>{const r=l.processes||{};(l.route||E.join("→")).split("→").filter(Boolean).forEach(b=>{const x=r[b]||{};if(x.startDate){const m=new Date(x.startDate);if(m.getFullYear()===e&&m.getMonth()===i){const f=m.getDate();d[f]||(d[f]=[]),d[f].push({sn:l.sn,proc:b,action:"시작",product:l.productName||l.product||"",color:S[b]||"#666"})}}if(x.actualEnd){const m=new Date(x.actualEnd);if(m.getFullYear()===e&&m.getMonth()===i){const f=m.getDate();d[f]||(d[f]=[]),d[f].push({sn:l.sn,proc:b,action:"완료",product:l.productName||l.product||"",color:S[b]||"#666"})}}if(x.planEnd&&x.planEnd!==x.actualEnd){const m=new Date(x.planEnd);if(m.getFullYear()===e&&m.getMonth()===i){const f=m.getDate();d[f]||(d[f]=[]),d[f].push({sn:l.sn,proc:b,action:"예정",product:l.productName||l.product||"",color:S[b]||"#666"})}}});const y=l.endDate||l.dueDate;if(y){const b=new Date(y);if(b.getFullYear()===e&&b.getMonth()===i){const x=b.getDate();d[x]||(d[x]=[]),d[x].push({sn:l.sn,proc:"납기",action:"",product:l.productName||l.product||"",color:"#ef4444",isDue:!0})}}});function p(l){const r={};return l.forEach(u=>{const y=u.isDue?"납기":u.proc+" "+u.action;r[y]||(r[y]={count:0,color:u.color}),r[y].count++}),Object.entries(r).slice(0,3).map(([u,y])=>`<div style="font-size:9px;padding:1px 4px;border-radius:3px;background:${y.color};color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%">${u} ${y.count}</div>`).join("")}let c="";for(let l=0;l<s;l++)c+='<div class="cal-cell" style="min-height:80px;padding:4px;border:1px solid transparent"></div>';for(let l=1;l<=a;l++){const r=`${e}-${String(i+1).padStart(2,"0")}-${String(l).padStart(2,"0")}`,u=r===o,y=d[l]||[],b=new Date(e,i,l).getDay();c+=`<div class="cal-cell" onclick="showCalDay('${r}')" style="min-height:80px;padding:4px;border:1px solid var(--border);border-radius:6px;cursor:pointer;${u?"background:rgba(99,102,241,0.1);border-color:var(--ac);":""}">
      <div style="font-weight:${u?"700":"400"};font-size:13px;margin-bottom:2px;color:${u?"var(--ac)":b===0?"#ef4444":b===6?"#6366f1":"var(--t1)"}">${l}</div>
      ${y.length>0?p(y):""}
      ${y.length>3?`<div style="font-size:9px;color:var(--t2)">+${y.length-3}건</div>`:""}
    </div>`}n.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <button onclick="changeCalMonth(-1)" style="padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--t1);cursor:pointer">◀ 이전</button>
      <h3 style="margin:0">${e}년 ${i+1}월</h3>
      <button onclick="changeCalMonth(1)" style="padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--t1);cursor:pointer">다음 ▶</button>
    </div>
    <div class="card" style="padding:12px">
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center;margin-bottom:6px">
        ${["일","월","화","수","목","금","토"].map((l,r)=>`<div style="font-weight:600;font-size:12px;padding:6px;color:${r===0?"#ef4444":r===6?"#6366f1":"var(--t2)"}">${l}</div>`).join("")}
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">
        ${c}
      </div>
    </div>
    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;font-size:11px">
      ${E.map(l=>`<span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:${S[l]}"></span>${l}</span>`).join("")}
      <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:#ef4444"></span>납기</span>
    </div>
  `}window.changeCalMonth=function(n){K=new Date(K.getFullYear(),K.getMonth()+n,1),rt()};window.showCalDay=function(n){const t=[];if(h.forEach(s=>{const a=s.processes||{};(s.route||E.join("→")).split("→").filter(Boolean).forEach(p=>{const c=a[p]||{};c.startDate&&c.startDate===n&&t.push({sn:s.sn,proc:p,action:"시작",product:s.productName||s.product||"",color:S[p]||"#666"}),c.actualEnd&&c.actualEnd===n&&t.push({sn:s.sn,proc:p,action:"완료",product:s.productName||s.product||"",color:S[p]||"#666"}),c.planEnd&&c.planEnd===n&&c.planEnd!==c.actualEnd&&t.push({sn:s.sn,proc:p,action:"예정",product:s.productName||s.product||"",color:S[p]||"#666"})}),(s.endDate||s.dueDate)===n&&t.push({sn:s.sn,proc:"납기",action:"마감",product:s.productName||s.product||"",color:"#ef4444",isDue:!0})}),t.length===0){M(`${n} — 일정 없음`);return}const e={};t.forEach(s=>{const a=s.isDue?"📅 납기 마감":`${s.proc} ${s.action}`;e[a]||(e[a]={color:s.color,items:[]}),e[a].items.push(s)});let i="";Object.entries(e).forEach(([s,a])=>{i+=`<div style="margin-bottom:12px">
      <div style="font-size:13px;font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:6px">
        <span style="width:12px;height:12px;border-radius:3px;background:${a.color}"></span>${s} (${a.items.length}건)
      </div>
      ${a.items.map(o=>`
        <div onclick="openSidePanel('${w(o.sn)}');closeModal('calDayModal')" style="padding:8px 12px;margin-bottom:4px;border-left:3px solid ${o.color};background:var(--bg3);border-radius:0 8px 8px 0;cursor:pointer;font-size:13px">
          <strong>${o.sn}</strong> <span style="color:var(--t2);font-size:12px">${o.product}</span>
        </div>
      `).join("")}
    </div>`}),P("calDayModal",`
    <div class="modal-header"><span>${n} 상세 (${t.length}건)</span><button class="modal-close" onclick="closeModal('calDayModal')">✕</button></div>
    <div class="modal-body" style="max-height:60vh;overflow-y:auto">${i}</div>
  `)};function V(){const n=document.getElementById("ganttTab");if(!n)return;const t=h.filter(f=>f.status!=="완료"&&f.status!=="출하완료"&&f.status!=="폐기");if(t.length===0){n.innerHTML='<div class="card" style="padding:40px;text-align:center;color:var(--t2)">진행중인 LOT이 없습니다</div>';return}let e=new Date,i=new Date;t.forEach(f=>{if(f.startDate){const g=new Date(f.startDate);g<e&&(e=new Date(g))}if(f.createdAt){const g=typeof f.createdAt=="number"?f.createdAt:new Date(f.createdAt).getTime(),v=new Date(g);v<e&&(e=new Date(v))}const $=f.endDate||f.dueDate;if($){const g=new Date($);g>i&&(i=new Date(g))}const L=f.processes||{};Object.values(L).forEach(g=>{if(g.startDate){const v=new Date(g.startDate);v<e&&(e=new Date(v))}if(g.actualEnd){const v=new Date(g.actualEnd);v>i&&(i=new Date(v))}if(g.planEnd){const v=new Date(g.planEnd);v>i&&(i=new Date(v))}})}),e.setDate(e.getDate()-5),i.setDate(i.getDate()+10);const s=Math.max(Math.ceil((i-e)/864e5),14),a=st,o=s*a,d=180;let p="",c="";for(let f=0;f<s;f++){const $=new Date(e.getTime()+f*864e5),L=$.getFullYear()+"-"+String($.getMonth()+1).padStart(2,"0");if(L!==c){let g=0;for(let v=f;v<s;v++){const k=new Date(e.getTime()+v*864e5);if(k.getFullYear()+"-"+String(k.getMonth()+1).padStart(2,"0")===L)g++;else break}p+=`<div style="min-width:${g*a}px;text-align:center;font-size:11px;font-weight:600;padding:4px 0;border-right:1px solid var(--border)">${$.getFullYear()}년 ${$.getMonth()+1}월</div>`,c=L}}let l="";const r=T(new Date);let u=-1;for(let f=0;f<s;f++){const $=new Date(e.getTime()+f*864e5),g=T($)===r;g&&(u=f);const v=$.getDay();l+=`<div style="min-width:${a}px;max-width:${a}px;text-align:center;font-size:9px;padding:2px 0;${g?"background:var(--ac);color:#fff;border-radius:4px;font-weight:700;":v===0?"color:#ef4444;":v===6?"color:#6366f1;":"color:var(--t2);"}">${$.getDate()}</div>`}let y="";t.forEach((f,$)=>{const L=(f.route||E.join("→")).split("→").filter(Boolean),g=f.processes||{};let v="";L.forEach(D=>{const z=g[D]||{},G=z.startDate;if(!G)return;const Z=new Date(G),wt=Math.floor((Z-e)/864e5);let U=1;z.actualEnd?U=Math.max(1,Math.ceil((new Date(z.actualEnd)-Z)/864e5)):z.planEnd?U=Math.max(1,Math.ceil((new Date(z.planEnd)-Z)/864e5)):z.planDays?U=z.planDays:U=_t(D,O(f),0);const tt=S[D]||"#666",lt=z.status==="완료";v+=`<div style="position:absolute;left:${wt*a}px;width:${U*a-2}px;height:20px;top:50%;transform:translateY(-50%);background:${lt?tt:tt+"99"};border-radius:4px;font-size:8px;color:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;white-space:nowrap;cursor:pointer;${lt?"":"border:1px dashed "+tt}" title="${f.sn} — ${D} (${z.status||"대기"})" onclick="event.stopPropagation();openProcUpdate('${w(f.sn)}','${w(D)}')">${D.length<=3?D:D.slice(0,2)}</div>`});const k=f.endDate||f.dueDate;if(k){const D=Math.floor((new Date(k)-e)/864e5);D>=0&&D<s&&(v+=`<div style="position:absolute;left:${D*a-1}px;width:3px;height:100%;background:#ef4444;top:0;border-radius:1px" title="납기: ${k}"></div>`)}y+=`<div style="display:flex;border-bottom:1px solid var(--border);${$%2===0?"":"background:rgba(255,255,255,0.02)"}">
      <div style="min-width:${d}px;max-width:${d}px;padding:8px 10px;border-right:1px solid var(--border);display:flex;flex-direction:column;justify-content:center;position:sticky;left:0;background:var(--bg2);z-index:1">
        <div style="font-size:12px;font-weight:600;cursor:pointer;color:var(--ac2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" onclick="openSidePanel('${w(f.sn)}')">${f.sn}</div>
        <div style="font-size:10px;color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.productName||f.product||""}</div>
      </div>
      <div style="position:relative;min-width:${o}px;height:36px">${v}</div>
    </div>`});const b=u>=0?`<div style="position:absolute;left:${u*a+d}px;top:0;width:2px;height:100%;background:var(--ac);opacity:0.6;z-index:3;pointer-events:none"></div>`:"";n.innerHTML=`
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
      <h3 style="margin:0;flex:1">간트차트</h3>
      <div style="display:flex;gap:6px;align-items:center">
        <button onclick="ganttZoom(-5)" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg3);color:var(--t1);cursor:pointer;font-size:12px">−</button>
        <span style="font-size:12px;color:var(--t2)">${a}px</span>
        <button onclick="ganttZoom(5)" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg3);color:var(--t1);cursor:pointer;font-size:12px">+</button>
        <button onclick="ganttGoToday()" style="padding:4px 10px;border-radius:6px;border:1px solid var(--ac);background:var(--ac);color:#fff;cursor:pointer;font-size:12px">오늘</button>
      </div>
    </div>

    <div class="card" style="padding:0;position:relative;overflow:hidden">
      <div id="ganttScrollArea" style="overflow:auto;max-height:70vh">

        <!-- Sticky 헤더 -->
        <div style="position:sticky;top:0;z-index:10;background:var(--bg2);border-bottom:2px solid var(--border)">
          <!-- 월 헤더 -->
          <div style="display:flex">
            <div style="min-width:${d}px;max-width:${d}px;border-right:1px solid var(--border)"></div>
            <div style="display:flex">${p}</div>
          </div>
          <!-- 일 헤더 -->
          <div style="display:flex">
            <div style="min-width:${d}px;max-width:${d}px;padding:4px 10px;font-size:11px;font-weight:600;border-right:1px solid var(--border);position:sticky;left:0;background:var(--bg2);z-index:11">LOT (${t.length})</div>
            <div style="display:flex">${l}</div>
          </div>
        </div>

        <!-- 바디 -->
        <div style="position:relative">
          ${y}
          ${b}
        </div>
      </div>

      <!-- 스크롤 날짜 인디케이터 -->
      <div id="ganttDateIndicator" style="position:absolute;top:8px;right:12px;background:var(--ac);color:#fff;padding:4px 12px;border-radius:8px;font-size:12px;font-weight:600;display:none;z-index:20"></div>
    </div>

    <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;font-size:11px">
      ${E.map(f=>`<span style="display:flex;align-items:center;gap:4px"><span style="width:12px;height:12px;border-radius:3px;background:${S[f]}"></span>${f}</span>`).join("")}
      <span style="display:flex;align-items:center;gap:4px"><span style="width:12px;height:2px;background:#ef4444"></span>납기</span>
      <span style="display:flex;align-items:center;gap:4px"><span style="width:12px;height:12px;border-radius:3px;background:var(--ac);opacity:0.6"></span>오늘</span>
    </div>
  `;const x=document.getElementById("ganttScrollArea"),m=document.getElementById("ganttDateIndicator");if(x&&m){let f;x.addEventListener("scroll",()=>{const $=x.scrollLeft,L=Math.floor($/a);if(L>=0&&L<s){const g=new Date(e.getTime()+L*864e5);m.textContent=`📅 ${g.getFullYear()}년 ${g.getMonth()+1}월 ${g.getDate()}일`,m.style.display="block"}clearTimeout(f),f=setTimeout(()=>{m.style.display="none"},1500)}),u>=0&&setTimeout(()=>{x.scrollLeft=Math.max(0,u*a-x.clientWidth/2)},100)}}window.ganttZoom=function(n){st=Math.max(10,Math.min(80,st+n)),V()};window.ganttGoToday=function(){document.getElementById("ganttScrollArea")&&V()};console.log("✅ Part 2/3 로드 완료 — 워크스페이스·캘린더·간트");function bt(){const n=document.getElementById("analysisTab");if(!n)return;const t=h.length,e=h.filter(g=>g.status==="완료"||g.status==="출하완료").length,i=t-e;h.filter(g=>g.issues&&g.issues.length>0||g.status==="이슈").length;const s=t>0?Math.round(e/t*100):0,a=h.filter(g=>g.status==="지연").length,o={};h.forEach(g=>{const v=g.productName||g.product||"미분류";o[v]||(o[v]={total:0,done:0,issue:0}),o[v].total++,(g.status==="완료"||g.status==="출하완료")&&o[v].done++,(g.issues&&g.issues.length>0||g.status==="이슈")&&o[v].issue++});const d={};E.forEach(g=>d[g]=0),h.filter(g=>g.status!=="완료"&&g.status!=="출하완료"&&g.status!=="폐기").forEach(g=>{const v=N(g);v&&d[v]!==void 0&&d[v]++});const p={};for(let g=5;g>=0;g--){const v=new Date;v.setMonth(v.getMonth()-g);const k=`${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,"0")}`;p[k]={registered:0,completed:0}}h.forEach(g=>{const v=g.createdAt;if(v){const D=new Date(v),z=`${D.getFullYear()}-${String(D.getMonth()+1).padStart(2,"0")}`;p[z]&&p[z].registered++}const k=g.completedAt;if(k){const D=new Date(k),z=`${D.getFullYear()}-${String(D.getMonth()+1).padStart(2,"0")}`;p[z]&&p[z].completed++}});let c=[];h.forEach(g=>{if(g.createdAt&&g.completedAt){const v=typeof g.createdAt=="number"?g.createdAt:new Date(g.createdAt).getTime(),D=((typeof g.completedAt=="number"?g.completedAt:new Date(g.completedAt).getTime())-v)/864e5;D>0&&D<365&&c.push(D)}});const l=c.length>0?Math.round(c.reduce((g,v)=>g+v,0)/c.length):0,r=c.length>0?Math.round(Math.min(...c)):0,u=c.length>0?Math.round(Math.max(...c)):0;let y=0,b=0;h.forEach(g=>{if((g.status==="완료"||g.status==="출하완료")&&(g.endDate||g.dueDate)&&g.completedAt){const v=new Date(g.endDate||g.dueDate);new Date((typeof g.completedAt=="number",g.completedAt))<=v?y++:b++}});const x=y+b>0?Math.round(y/(y+b)*100):0,m={};h.forEach(g=>{const v=g.customer||"미지정";m[v]=(m[v]||0)+1});const f=Object.entries(m).sort((g,v)=>v[1]-g[1]).slice(0,8),$={};h.forEach(g=>{g.issues&&g.issues.forEach(v=>{const k=v.type||v.category||"기타";$[k]=($[k]||0)+1})});const L=Object.entries($).sort((g,v)=>v[1]-g[1]);n.innerHTML=`
    <h3 style="margin:0 0 20px 0">생산 분석 대시보드</h3>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:24px">
      <div class="kpi-card" style="padding:20px;text-align:center"><div class="kpi-value" style="color:var(--ac)">${t}</div><div class="kpi-sub">전체 LOT</div></div>
      <div class="kpi-card" style="padding:20px;text-align:center"><div class="kpi-value" style="color:var(--ok)">${s}%</div><div class="kpi-sub">완료율</div></div>
      <div class="kpi-card" style="padding:20px;text-align:center"><div class="kpi-value" style="color:var(--warn)">${l}일</div><div class="kpi-sub">평균 리드타임</div></div>
      <div class="kpi-card" style="padding:20px;text-align:center"><div class="kpi-value" style="color:${x>=80?"var(--ok)":"var(--err)"}">${x}%</div><div class="kpi-sub">납기 준수율</div></div>
      <div class="kpi-card" style="padding:20px;text-align:center"><div class="kpi-value" style="color:var(--err)">${a}</div><div class="kpi-sub">지연</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
      <div class="card" style="padding:20px">
        <div class="card-title">공정별 현황 (진행중)</div>
        ${E.map(g=>{const v=d[g]||0,k=i>0?Math.round(v/i*100):0;return`<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span style="display:flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:2px;background:${S[g]}"></span>${g}</span><span>${v}건 (${k}%)</span></div><div class="prog-bar" style="height:8px"><div class="prog-fill" style="width:${k}%;background:${S[g]}"></div></div></div>`}).join("")}
      </div>

      <div class="card" style="padding:20px">
        <div class="card-title">월별 등록/완료 추이</div>
        <canvas id="analysisMonthlyChart" height="200"></canvas>
      </div>

      <div class="card" style="padding:20px">
        <div class="card-title">제품별 현황</div>
        <div style="overflow-x:auto"><table style="width:100%;font-size:12px;border-collapse:collapse">
          <thead><tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:6px">제품</th><th style="text-align:center;padding:6px">전체</th><th style="text-align:center;padding:6px">완료</th><th style="text-align:center;padding:6px">이슈</th><th style="text-align:center;padding:6px">완료율</th></tr></thead>
          <tbody>
            ${Object.entries(o).sort((g,v)=>v[1].total-g[1].total).map(([g,v])=>{const k=v.total>0?Math.round(v.done/v.total*100):0;return`<tr style="border-bottom:1px solid var(--border)"><td style="padding:6px">${g}</td><td style="text-align:center;padding:6px">${v.total}</td><td style="text-align:center;padding:6px;color:var(--ok)">${v.done}</td><td style="text-align:center;padding:6px;color:var(--err)">${v.issue}</td><td style="text-align:center;padding:6px"><div class="prog-bar" style="height:4px;width:50px;display:inline-block;vertical-align:middle"><div class="prog-fill" style="width:${k}%"></div></div> ${k}%</td></tr>`}).join("")}
          </tbody>
        </table></div>
      </div>

      <div class="card" style="padding:20px">
        <div class="card-title">고객별 LOT 수</div>
        ${f.map(([g,v])=>{const k=t>0?Math.round(v/t*100):0;return`<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px"><span>${g}</span><span>${v}건 (${k}%)</span></div><div class="prog-bar" style="height:6px"><div class="prog-fill" style="width:${k}%;background:var(--ac)"></div></div></div>`}).join("")}
      </div>

      <div class="card" style="padding:20px">
        <div class="card-title">리드타임 분석</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;text-align:center">
          <div><div style="font-size:24px;font-weight:700;color:var(--ok)">${r}일</div><div style="font-size:11px;color:var(--t2)">최소</div></div>
          <div><div style="font-size:24px;font-weight:700;color:var(--ac)">${l}일</div><div style="font-size:11px;color:var(--t2)">평균</div></div>
          <div><div style="font-size:24px;font-weight:700;color:var(--err)">${u}일</div><div style="font-size:11px;color:var(--t2)">최대</div></div>
        </div>
      </div>

      <div class="card" style="padding:20px">
        <div class="card-title">이슈 유형 분포</div>
        ${L.length===0?'<p style="text-align:center;color:var(--t2)">이슈 없음</p>':L.map(([g,v])=>{const k=L.reduce((z,G)=>z+G[1],0),D=Math.round(v/k*100);return`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="min-width:80px;font-size:12px">${g}</span><div class="prog-bar" style="flex:1;height:8px"><div class="prog-fill" style="width:${D}%;background:var(--err)"></div></div><span style="font-size:12px;min-width:50px;text-align:right">${v}건</span></div>`}).join("")}
      </div>
    </div>
  `,ee(p)}function ee(n){const t=document.getElementById("analysisMonthlyChart");if(!t)return;const e=t.getContext("2d"),s=t.parentElement.getBoundingClientRect().width-40;t.width=s*2,t.height=400,e.scale(2,2);const a=200,o=Object.entries(n),d=Math.max(...o.map(([,u])=>Math.max(u.registered,u.completed)),1),c=(s-40)/o.length,l={top:20,bottom:30,left:30},r=a-l.top-l.bottom;o.forEach(([u,y],b)=>{const x=l.left+b*c,m=(c-12)/2,f=y.registered/d*r;e.fillStyle="rgba(99,102,241,0.7)",e.beginPath(),e.roundRect?e.roundRect(x+2,l.top+r-f,m,f,[3,3,0,0]):e.rect(x+2,l.top+r-f,m,f),e.fill(),y.registered>0&&(e.fillStyle="#e2e8f0",e.font="9px sans-serif",e.textAlign="center",e.fillText(y.registered,x+2+m/2,l.top+r-f-3));const $=y.completed/d*r;e.fillStyle="rgba(74,222,128,0.7)",e.beginPath(),e.roundRect?e.roundRect(x+4+m,l.top+r-$,m,$,[3,3,0,0]):e.rect(x+4+m,l.top+r-$,m,$),e.fill(),y.completed>0&&(e.fillStyle="#e2e8f0",e.font="9px sans-serif",e.textAlign="center",e.fillText(y.completed,x+4+m+m/2,l.top+r-$-3)),e.fillStyle="#8892b0",e.font="10px sans-serif",e.textAlign="center",e.fillText(u.slice(5)+"월",x+c/2,a-6)}),e.fillStyle="rgba(99,102,241,0.7)",e.fillRect(s-90,4,10,10),e.fillStyle="#e2e8f0",e.font="10px sans-serif",e.textAlign="left",e.fillText("등록",s-76,13),e.fillStyle="rgba(74,222,128,0.7)",e.fillRect(s-44,4,10,10),e.fillStyle="#e2e8f0",e.fillText("완료",s-30,13)}function dt(){const n=document.getElementById("aiTab");if(!n)return;window._aiMessages||(window._aiMessages=[{role:"ai",text:`안녕하세요! ESC 생산관리 AI 어시스턴트입니다.

예시:
• "지연 LOT 현황"
• "이번 달 납기"
• "제품별 요약"
• "공정 병목 분석"`}]),n.innerHTML=`
    <div style="display:flex;flex-direction:column;height:calc(100vh - 140px)">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <h3 style="margin:0;flex:1">AI 어시스턴트</h3>
        <button onclick="window._aiMessages=null;renderAI();" style="padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--t1);cursor:pointer;font-size:12px">초기화</button>
      </div>
      <div id="aiChatArea" style="flex:1;overflow-y:auto;padding:16px;background:var(--bg3);border-radius:12px;border:1px solid var(--border);margin-bottom:12px">
        ${window._aiMessages.map(e=>{const i=e.role==="ai";return`<div style="display:flex;justify-content:${i?"flex-start":"flex-end"};margin-bottom:12px"><div style="max-width:80%;padding:12px 16px;border-radius:${i?"4px 16px 16px 16px":"16px 4px 16px 16px"};background:${i?"var(--bg2)":"var(--ac)"};border:${i?"1px solid var(--border)":"none"};color:${i?"var(--t1)":"#fff"};font-size:13px;line-height:1.6;white-space:pre-wrap">${i?'<div style="font-size:10px;color:var(--t2);margin-bottom:4px">🤖 AI</div>':""}${e.text}</div></div>`}).join("")}
      </div>
      <div style="display:flex;gap:8px">
        <input type="text" id="aiInput" placeholder="질문을 입력하세요..." style="flex:1;padding:12px 16px;border-radius:12px;border:1px solid var(--border);background:var(--bg3);color:var(--t1);font-size:14px" onkeydown="if(event.key==='Enter')sendAIMsg()">
        <button onclick="sendAIMsg()" style="padding:12px 24px;border-radius:12px;border:none;background:var(--ac);color:#fff;cursor:pointer;font-weight:600">전송</button>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
        ${["지연 LOT 현황","이번달 납기","제품별 요약","이슈 분석","공정 병목"].map(e=>`<button onclick="quickAI('${e}')" style="padding:4px 10px;border-radius:16px;border:1px solid var(--border);background:var(--bg3);color:var(--t1);cursor:pointer;font-size:11px">${e}</button>`).join("")}
      </div>
    </div>
  `;const t=document.getElementById("aiChatArea");t&&(t.scrollTop=t.scrollHeight)}window.sendAIMsg=function(){const n=document.getElementById("aiInput");if(!n)return;const t=n.value.trim();t&&(window._aiMessages.push({role:"user",text:t}),n.value="",window._aiMessages.push({role:"ai",text:mt(t)}),dt())};window.quickAI=function(n){window._aiMessages.push({role:"user",text:n}),window._aiMessages.push({role:"ai",text:mt(n)}),dt()};function mt(n){const t=n.toLowerCase(),e=new Date,i=h.filter(s=>s.status!=="완료"&&s.status!=="출하완료"&&s.status!=="폐기");if(t.includes("지연")||t.includes("delay")||t.includes("늦")){const s=i.filter(o=>{const d=o.endDate||o.dueDate;return d&&new Date(d)<e});if(!s.length)return"현재 납기 지연된 LOT이 없습니다. 👍";let a=`⚠️ 납기 지연 LOT: ${s.length}건

`;return s.forEach(o=>{const d=o.endDate||o.dueDate,p=Math.ceil((e-new Date(d))/864e5);a+=`• ${o.sn} (${o.productName||o.product||"-"}) — ${p}일 지연 / 납기: ${d}
`}),a}if(t.includes("납기")||t.includes("이번달")||t.includes("이번 달")){const s=new Date(e.getFullYear(),e.getMonth(),1),a=new Date(e.getFullYear(),e.getMonth()+1,0),o=i.filter(p=>{const c=p.endDate||p.dueDate;if(!c)return!1;const l=new Date(c);return l>=s&&l<=a});if(!o.length)return"이번 달 납기 예정 LOT이 없습니다.";let d=`📅 이번 달 납기 예정: ${o.length}건

`;return o.sort((p,c)=>new Date(p.endDate||p.dueDate)-new Date(c.endDate||c.dueDate)).forEach(p=>{const c=p.endDate||p.dueDate,l=Math.ceil((new Date(c)-e)/864e5),r=l<0?`🔴 ${Math.abs(l)}일 지연`:l<=3?`🟡 ${l}일 남음`:`🟢 ${l}일 남음`;d+=`• ${p.sn} (${p.productName||p.product||"-"}) — ${c} ${r}
`}),d}if(t.includes("제품")||t.includes("요약")){const s={};h.forEach(o=>{const d=o.productName||o.product||"미분류";s[d]||(s[d]={total:0,active:0,done:0}),s[d].total++,o.status==="완료"||o.status==="출하완료"?s[d].done++:s[d].active++});let a=`📊 제품별 생산 현황

`;return Object.entries(s).sort((o,d)=>d[1].total-o[1].total).forEach(([o,d])=>{a+=`📦 ${o}: 전체 ${d.total} / 진행 ${d.active} / 완료 ${d.done}
`}),a}if(t.includes("이슈")||t.includes("문제")){const s=h.filter(p=>p.issues&&p.issues.length>0);if(!s.length)return"등록된 이슈가 없습니다. ✅";const a={};let o=0;s.forEach(p=>p.issues.forEach(c=>{const l=c.type||"기타";a[l]=(a[l]||0)+1,o++}));let d=`🔍 이슈 분석 — ${s.length}개 LOT, 총 ${o}건

유형별:
`;return Object.entries(a).sort((p,c)=>c[1]-p[1]).forEach(([p,c])=>{d+=`• ${p}: ${c}건
`}),d}if(t.includes("병목")||t.includes("공정")){const s={};E.forEach(d=>s[d]=0),i.forEach(d=>{const p=N(d);p&&s[p]!==void 0&&s[p]++});let a=`🏭 공정별 분포 (진행중: ${i.length}건)

`;Object.entries(s).sort((d,p)=>p[1]-d[1]).forEach(([d,p])=>{a+=`${d}: ${"█".repeat(Math.min(p,20))} ${p}건
`});const o=Object.entries(s).sort((d,p)=>p[1]-d[1])[0];return o&&o[1]>0&&(a+=`
⚠️ "${o[0]}" 공정에 LOT이 집중 — 병목 가능성 확인`),a}return`"${n}" 분석은 아직 개발 중입니다.

가능한 질문: 지연 LOT, 이번달 납기, 제품별 요약, 이슈 분석, 공정 병목`}function ht(){const n=document.getElementById("settingsTab");if(!n)return;const t=!document.documentElement.hasAttribute("data-theme")||document.documentElement.getAttribute("data-theme")!=="light";n.innerHTML=`
    <h3 style="margin:0 0 20px 0">설정</h3>

    <div class="card" style="padding:24px;margin-bottom:16px">
      <div class="card-title">👤 프로필</div>
      <div style="display:flex;align-items:center;gap:16px;margin-top:12px">
        <div style="width:50px;height:50px;border-radius:50%;background:var(--ac);display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff">${(C?.displayName||"U")[0].toUpperCase()}</div>
        <div><div style="font-weight:600">${C?.displayName||"사용자"}</div><div style="font-size:13px;color:var(--t2)">${C?.email||""}</div></div>
      </div>
    </div>

    <div class="card" style="padding:24px;margin-bottom:16px">
      <div class="card-title">🎨 테마</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px">
        <span>다크 모드</span>
        <div class="toggle ${t?"on":""}" onclick="toggleThemeClick()"></div>
      </div>
    </div>

    <div class="card" style="padding:24px;margin-bottom:16px">
      <div class="card-title">🔧 위젯 설정</div>
      <button onclick="openWidgetSettings()" style="margin-top:12px;padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--t1);cursor:pointer">위젯 구성 변경</button>
    </div>

    <div class="card" style="padding:24px;margin-bottom:16px">
      <div class="card-title">💾 데이터 관리</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px">
        <button onclick="exportAllExcel()" style="padding:8px 16px;border-radius:8px;border:none;background:var(--ac);color:#fff;cursor:pointer">📥 Excel 내보내기</button>
        <button onclick="exportBackupJSON()" style="padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--t1);cursor:pointer">📋 JSON 백업</button>
      </div>
    </div>

    <div class="card" style="padding:24px;margin-bottom:16px">
      <div class="card-title">⚙️ 공정 순서</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:12px">
        ${E.map(e=>`<span style="padding:4px 10px;border-radius:6px;font-size:12px;background:${S[e]};color:#fff">${e}</span>`).join(' <span style="color:var(--t2)">→</span> ')}
      </div>
    </div>

    <div class="card" style="padding:24px;margin-bottom:16px">
      <div class="card-title">ℹ️ 앱 정보</div>
      <div style="font-size:13px;color:var(--t2);line-height:1.8;margin-top:8px">
        ESC Production Manager v9.0<br>
        제작: Kane · Firebase: esc-production-management<br>
        빌드: Vite + Vanilla JS
      </div>
    </div>

    <div style="text-align:center;margin-top:24px">
      <button onclick="doLogout()" style="padding:12px 40px;border-radius:10px;border:none;background:var(--err);color:#fff;cursor:pointer;font-weight:600">로그아웃</button>
    </div>
  `}window.toggleThemeClick=function(){const n=document.documentElement;n.getAttribute("data-theme")==="light"?(n.removeAttribute("data-theme"),localStorage.setItem("esc-theme","dark")):(n.setAttribute("data-theme","light"),localStorage.setItem("esc-theme","light")),ht()};window.openSidePanel=function(n){const t=h.find(p=>p.sn===n);if(!t){M("S/N을 찾을 수 없습니다: "+n,"warn");return}const e=Q(t),i=(t.route||E.join("→")).split("→").filter(Boolean),s=t.processes||{},a=O(t),o=i.map(p=>{const c=s[p]||{},l=c.status==="완료",r=S[p]||"#666";return`<div style="display:flex;gap:12px;margin-bottom:10px">
      <div style="display:flex;flex-direction:column;align-items:center">
        <div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;background:${l?r:"var(--border)"};color:${l?"#fff":"var(--t2)"}">${l?"✓":"·"}</div>
        <div style="width:2px;flex:1;background:${l?r:"var(--border)"}"></div>
      </div>
      <div style="flex:1;padding-bottom:4px">
        <div style="font-size:13px;font-weight:${l?"600":"400"};color:${l?r:"var(--t2)"}">${p} ${c.equip?"("+c.equip+")":""}</div>
        <div style="font-size:11px;color:var(--t2)">${l?(c.startDate||"")+" → "+(c.actualEnd||""):"대기중"} ${c.note?" · "+c.note:""}</div>
      </div>
    </div>`}).join(""),d=(t.issues||[]).map(p=>`<div style="padding:8px 10px;border-left:3px solid ${p.severity==="critical"?"#ef4444":p.severity==="high"?"#f59e0b":"var(--ac)"};background:var(--bg3);border-radius:0 8px 8px 0;margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;font-size:11px">${I(p.type||"기타")}<span style="color:var(--t2)">${p.date||""}</span></div>
      <div style="font-size:12px;margin-top:4px">${p.description||""}</div>
    </div>`).join("")||'<div style="text-align:center;color:var(--t2);font-size:12px;padding:12px">이슈 없음</div>';P("sidePanelModal",`
    <div class="modal-header">
      <span>${t.sn}</span>
      <button class="modal-close" onclick="closeModal('sidePanelModal')">✕</button>
    </div>
    <div class="modal-body" style="max-height:75vh;overflow-y:auto">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
        <div class="kpi-card" style="padding:10px"><div style="font-size:10px;color:var(--t2)">제품</div><div style="font-size:14px;font-weight:600">${t.productName||t.product||"-"}</div></div>
        <div class="kpi-card" style="padding:10px"><div style="font-size:10px;color:var(--t2)">고객</div><div style="font-size:14px;font-weight:600">${t.customer||"-"}</div></div>
        <div class="kpi-card" style="padding:10px"><div style="font-size:10px;color:var(--t2)">카테고리</div><div style="font-size:14px;font-weight:600">${a}</div></div>
        <div class="kpi-card" style="padding:10px"><div style="font-size:10px;color:var(--t2)">납기</div><div style="font-size:14px;font-weight:600;${(t.endDate||t.dueDate)&&new Date(t.endDate||t.dueDate)<new Date?"color:var(--err)":""}">${t.endDate||t.dueDate||"-"}</div></div>
      </div>

      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:13px;font-weight:600">진행률</span><span style="font-weight:700;color:var(--ac)">${e}%</span></div>
        <div class="prog-bar" style="height:10px"><div class="prog-fill" style="width:${e}%"></div></div>
      </div>

      <div style="margin-bottom:16px">
        <div style="font-size:14px;font-weight:600;margin-bottom:10px">공정 타임라인</div>
        ${o}
      </div>

      <div style="margin-bottom:16px">
        <div style="font-size:14px;font-weight:600;margin-bottom:10px">이슈 (${(t.issues||[]).length})</div>
        ${d}
      </div>

      ${t.note?`<div style="margin-bottom:16px"><div style="font-size:14px;font-weight:600;margin-bottom:6px">비고</div><p style="font-size:13px;color:var(--t2);line-height:1.6">${t.note}</p></div>`:""}

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
        <button onclick="closeModal('sidePanelModal');openProcUpdate('${w(t.sn)}','${w(N(t))}')" style="padding:8px 16px;border-radius:8px;border:none;background:var(--ac);color:#fff;cursor:pointer;font-size:13px">공정 입력</button>
        <button onclick="generateQR('${w(t.sn)}')" style="padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--t1);cursor:pointer;font-size:13px">QR</button>
        <button onclick="openIssueModal('${w(t.sn)}')" style="padding:8px 16px;border-radius:8px;border:1px solid var(--warn);background:transparent;color:var(--warn);cursor:pointer;font-size:13px">이슈 등록</button>
        <button onclick="deleteLot('${w(t.id||t.sn)}')" style="padding:8px 16px;border-radius:8px;border:1px solid var(--err);background:transparent;color:var(--err);cursor:pointer;font-size:13px;margin-left:auto">삭제</button>
      </div>
    </div>
  `)};window.openNewLotModal=function(){const n=[...new Set(h.map(o=>o.productName||o.product).filter(Boolean))].sort(),t=[...new Set(h.map(o=>o.customer).filter(Boolean))].sort(),e=new Date,i=`ESC-${String(e.getFullYear()).slice(2)}${String(e.getMonth()+1).padStart(2,"0")}`,s=h.filter(o=>(o.sn||"").startsWith(i)).length,a=`${i}-${String(s+1).padStart(3,"0")}`;P("newLotModal",`
    <div class="modal-header"><span>새 LOT 등록</span><button class="modal-close" onclick="closeModal('newLotModal')">✕</button></div>
    <div class="modal-body" style="max-height:70vh;overflow-y:auto">
      <div style="display:grid;gap:14px">
        <div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">S/N</label><input type="text" id="nlSn" value="${a}" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--t1);font-size:14px"></div>
        <div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">제품</label><input type="text" id="nlProduct" list="nlProductList" placeholder="제품명" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--t1);font-size:14px"><datalist id="nlProductList">${n.map(o=>`<option value="${o}">`).join("")}</datalist></div>
        <div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">고객</label><input type="text" id="nlCustomer" list="nlCustList" placeholder="고객명" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--t1);font-size:14px"><datalist id="nlCustList">${t.map(o=>`<option value="${o}">`).join("")}</datalist></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">카테고리</label><select id="nlCat" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--t1)"><option value="WN">WN</option><option value="BL">BL</option><option value="HP">HP</option></select></div>
          <div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">납기일</label><input type="date" id="nlDue" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--t1)"></div>
        </div>
        <div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">비고</label><textarea id="nlNote" rows="2" placeholder="메모..." style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--t1);font-size:13px;resize:vertical"></textarea></div>
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;padding:16px 24px;border-top:1px solid var(--border)">
      <button onclick="closeModal('newLotModal')" style="padding:10px 20px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--t1);cursor:pointer">취소</button>
      <button onclick="submitNewLot()" style="padding:10px 20px;border-radius:8px;border:none;background:var(--ac);color:#fff;cursor:pointer;font-weight:600">등록</button>
    </div>
  `)};window.submitNewLot=async function(){const n=(document.getElementById("nlSn")?.value||"").trim(),t=(document.getElementById("nlProduct")?.value||"").trim(),e=(document.getElementById("nlCustomer")?.value||"").trim(),i=document.getElementById("nlCat")?.value||"WN",s=document.getElementById("nlDue")?.value||"",a=(document.getElementById("nlNote")?.value||"").trim();if(!n){M("S/N을 입력하세요","warn");return}if(!t){M("제품을 입력하세요","warn");return}if(h.find(c=>c.sn===n)){M("이미 존재하는 S/N","warn");return}const o=Ht(i),d={};o.split("→").forEach(c=>{d[c]={status:"대기"}});const p={sn:n,productName:t,product:t,customer:e,category:i,endDate:s,dueDate:s,note:a,route:o,processes:d,issues:[],status:"진행",currentProcess:o.split("→")[0],startDate:T(new Date),createdAt:Date.now(),createdBy:C?.email||"",registeredAt:T(new Date)};try{await Ct(J(B,"production",n),p),M(`${n} 등록 완료!`,"ok"),q("newLotModal")}catch(c){M("등록 실패: "+c.message,"err")}};window.openIssueModal=function(n){if(!h.find(i=>i.sn===n))return;P("issueModal",`
    <div class="modal-header"><span>⚠️ 이슈 등록 — ${n}</span><button class="modal-close" onclick="closeModal('issueModal')">✕</button></div>
    <div class="modal-body">
      <div style="display:grid;gap:14px">
        <div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">유형</label><select id="issType" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--t1)">${["치수불량","외관불량","크랙","오염","장비고장","자재불량","공정오류","기타"].map(i=>`<option value="${i}">${i}</option>`).join("")}</select></div>
        <div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">공정</label><select id="issProc" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--t1)">${E.map(i=>`<option value="${i}">${i}</option>`).join("")}</select></div>
        <div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">심각도</label><select id="issSev" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--t1)"><option value="low">낮음</option><option value="medium" selected>보통</option><option value="high">높음</option><option value="critical">긴급</option></select></div>
        <div><label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">상세</label><textarea id="issDesc" rows="3" placeholder="이슈 상세..." style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--t1);resize:vertical"></textarea></div>
      </div>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;padding:16px 24px;border-top:1px solid var(--border)">
      <button onclick="closeModal('issueModal')" style="padding:10px 20px;border-radius:8px;border:1px solid var(--border);background:var(--bg3);color:var(--t1);cursor:pointer">취소</button>
      <button onclick="submitIssue('${w(n)}')" style="padding:10px 20px;border-radius:8px;border:none;background:var(--err);color:#fff;cursor:pointer;font-weight:600">등록</button>
    </div>
  `)};window.submitIssue=async function(n){const t=h.find(s=>s.sn===n);if(!t)return;const e=(document.getElementById("issDesc")?.value||"").trim();if(!e){M("내용을 입력하세요","warn");return}const i={type:document.getElementById("issType")?.value||"기타",process:document.getElementById("issProc")?.value||"",severity:document.getElementById("issSev")?.value||"medium",description:e,date:T(new Date),reporter:C?.displayName||"",status:"미해결",timestamp:Date.now()};t.issues||(t.issues=[]),t.issues.push(i);try{await it(J(B,"production",t.id||t.sn),{issues:t.issues}),M("이슈 등록 완료","ok"),q("issueModal")}catch(s){M("실패: "+s.message,"err")}};window.deleteLot=async function(n){if(confirm("정말 삭제하시겠습니까?"))try{await Pt(J(B,"production",n)),M("삭제 완료","ok"),q("sidePanelModal"),q("lotDetailModal")}catch(t){M("삭제 실패: "+t.message,"err")}};window.exportAllExcel=function(){if(typeof XLSX>"u"){M("SheetJS 로딩 중...","warn");return}const n=h.map(i=>{const s={"S/N":i.sn||"",제품:i.productName||i.product||"",고객:i.customer||"",카테고리:O(i),납기:i.endDate||i.dueDate||"",상태:i.status||"",진행률:Q(i)+"%"};return E.forEach(a=>{const o=(i.processes||{})[a]||{};s[a+" 상태"]=o.status||"",s[a+" 설비"]=o.equip||"",s[a+" 시작"]=o.startDate||"",s[a+" 완료"]=o.actualEnd||""}),s.이슈수=(i.issues||[]).length,s}),t=XLSX.utils.json_to_sheet(n),e=XLSX.utils.book_new();XLSX.utils.book_append_sheet(e,t,"생산현황"),XLSX.writeFile(e,`ESC_생산현황_${T(new Date)}.xlsx`),M("Excel 다운로드 완료","ok")};window.exportBackupJSON=function(){const n=new Blob([JSON.stringify(h,null,2)],{type:"application/json"}),t=URL.createObjectURL(n),e=document.createElement("a");e.href=t,e.download=`esc-backup-${T(new Date)}.json`,e.click(),URL.revokeObjectURL(t),M("JSON 백업 완료","ok")};window.generateQR=function(n){const t=h.find(i=>i.sn===n);if(!t)return;const e=JSON.stringify({sn:t.sn,product:t.productName||t.product,customer:t.customer,category:O(t)});P("qrModal",`
    <div class="modal-header"><span>QR — ${t.sn}</span><button class="modal-close" onclick="closeModal('qrModal')">✕</button></div>
    <div class="modal-body" style="text-align:center">
      <div id="qrCanvas" style="display:inline-block;padding:20px;background:#fff;border-radius:12px"></div>
      <div style="margin-top:12px"><strong>${t.sn}</strong><br><span style="color:var(--t2);font-size:13px">${t.productName||t.product||""} / ${t.customer||"-"}</span></div>
      <button onclick="printQR()" style="margin-top:16px;padding:8px 20px;border-radius:8px;border:none;background:var(--ac);color:#fff;cursor:pointer">🖨 인쇄</button>
    </div>
  `),setTimeout(()=>{const i=document.getElementById("qrCanvas");i&&typeof QRCode<"u"&&new QRCode(i,{text:e,width:200,height:200,colorDark:"#000",colorLight:"#fff"})},100)};window.printQR=function(){const n=document.getElementById("qrCanvas");if(!n)return;const t=window.open("","_blank");t.document.write(`<html><body style="text-align:center;padding:40px">${n.innerHTML}</body></html>`),t.document.close(),t.print()};function ne(){const n=document.getElementById("sidebar");if(!n)return;const t=[{id:"home",icon:"🏠",label:"홈"},{id:"workspace",icon:"📋",label:"작업관리"},{id:"calendar",icon:"📅",label:"캘린더"},{id:"gantt",icon:"📊",label:"간트차트"},{id:"analysis",icon:"📈",label:"분석"},{id:"ai",icon:"🤖",label:"AI"},{id:"settings",icon:"⚙️",label:"설정"}],e=n.querySelector(".sb-nav")||n.querySelector("nav")||n,i=n.querySelectorAll(".sb-item");if(i.length>0)i.forEach(s=>{s.onclick=()=>W(s.dataset.tab)});else{const s=document.createElement("div");s.style.cssText="display:flex;flex-direction:column;gap:4px;padding:8px",t.forEach(a=>{const o=document.createElement("div");o.className="sb-item"+(a.id==="home"?" active":""),o.dataset.tab=a.id,o.style.cssText="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:8px;cursor:pointer;font-size:14px;transition:background 0.15s",o.innerHTML=`<span>${a.icon}</span><span class="sb-label">${a.label}</span>`,o.onclick=()=>W(a.id),s.appendChild(o)}),e.appendChild(s)}}function oe(){const n=document.getElementById("bottomBar")||document.getElementById("bottom-bar");if(!n)return;const t=[{id:"home",icon:"🏠",label:"홈"},{id:"workspace",icon:"📋",label:"작업"},{id:"calendar",icon:"📅",label:"일정"},{id:"analysis",icon:"📊",label:"분석"},{id:"settings",icon:"⚙️",label:"설정"}],e=n.querySelectorAll(".bb-item");e.length>0?e.forEach(i=>{i.onclick=()=>W(i.dataset.tab)}):n.innerHTML=t.map(i=>`<div class="bb-item${i.id==="home"?" active":""}" data-tab="${i.id}" onclick="switchTab('${i.id}')" style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px;cursor:pointer;font-size:10px"><span style="font-size:18px">${i.icon}</span><span>${i.label}</span></div>`).join("")}document.addEventListener("keydown",n=>{if(n.key==="Escape"&&(document.querySelectorAll(".modal-overlay:not(.hidden)").forEach(t=>t.classList.add("hidden")),document.querySelectorAll(".equip-dropdown-popup").forEach(t=>t.remove())),n.ctrlKey&&n.key==="k"){n.preventDefault();const t=document.getElementById("wsSearchInput");t&&(W("workspace"),setTimeout(()=>t.focus(),100))}});(function(){localStorage.getItem("esc-theme")==="light"&&document.documentElement.setAttribute("data-theme","light"),console.log("🎉 ESC Manager v9.0 — 전체 로드 완료")})();console.log("✅ Part 3/3 로드 완료 — 분석·AI·설정·모달·Excel·QR·사이드패널");
