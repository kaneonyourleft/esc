import{initializeApp}from'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import{getAuth,GoogleAuthProvider,signInWithPopup,signInWithRedirect,getRedirectResult,onAuthStateChanged,signOut}from'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import{getFirestore,collection,doc,setDoc,addDoc,getDoc,getDocs,query,orderBy,limit,where,onSnapshot,writeBatch,updateDoc,deleteDoc,serverTimestamp}from'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import*as S from'./state.js';
import{fD,toast,getWidgetConfig,getSNCode}from'./utils.js';

const FC={apiKey:'AIzaSyAwDS2PigihTH6RKMxzrH-utlaKJbtHBTY',authDomain:'esc-production-management.firebaseapp.com',projectId:'esc-production-management',storageBucket:'esc-production-management.firebasestorage.app',messagingSenderId:'622370430583',appId:'1:622370430583:web:363b6e2f185fddcbd33072'};
const app=initializeApp(FC);
const auth=getAuth(app);
const db=getFirestore(app);
const provider=new GoogleAuthProvider();
S.setAuth(auth);S.setDb(db);

export{auth,db,provider,collection,doc,setDoc,addDoc,getDoc,getDocs,query,orderBy,limit,where,onSnapshot,writeBatch,updateDoc,deleteDoc,serverTimestamp,signInWithPopup,signInWithRedirect,getRedirectResult,onAuthStateChanged,signOut,GoogleAuthProvider};

export async function doLogin(){
document.getElementById('loginSpinner').style.display='block';
document.getElementById('loginError').style.display='none';
try{await signInWithPopup(auth,provider)}
catch(e){if(e.code==='auth/popup-blocked'||e.code==='auth/cancelled-popup-request'){try{await signInWithRedirect(auth,provider)}catch(e2){showLoginError(e2.message)}}else{showLoginError(e.message)}document.getElementById('loginSpinner').style.display='none';}
}
function showLoginError(msg){const el=document.getElementById('loginError');el.textContent=msg;el.style.display='block';document.getElementById('loginSpinner').style.display='none'}
export async function doLogout(){await signOut(auth)}

export async function loadData(onDataUpdate){
const pSnap=await getDocs(collection(db,'products'));
S.setPRODS(pSnap.docs.map(d=>({id:d.id,...d.data()})));
if(S.unsubProd)S.unsubProd();
S.setUnsubProd(onSnapshot(collection(db,'production'),snap=>{S.setD(snap.docs.map(d=>({id:d.id,...d.data()})));onDataUpdate();}));
if(S.unsubIssues)S.unsubIssues();
S.setUnsubIssues(onSnapshot(query(collection(db,'issues'),orderBy('createdAt','desc')),snap=>{S.setISSUES(snap.docs.map(d=>({id:d.id,...d.data()})));if(S.currentTab==='calendar'&&window._renderCalendar)window._renderCalendar();}));
}

export async function refreshData(onDataUpdate){
const pSnap=await getDocs(collection(db,'products'));
S.setPRODS(pSnap.docs.map(d=>({id:d.id,...d.data()})));
toast('데이터 새로고침 완료','ok');onDataUpdate();
}

export async function getMaxSeqFromFirestore(cat,prodName,sheetNo){
let maxLocal=0;
const snCode=getSNCode(cat,prodName);
S.D.forEach(d=>{const sn=(d.sn||'').toUpperCase();if(sheetNo){if(sn.startsWith(`${cat}${sheetNo}-${snCode}-L`)){const match=sn.match(/-L(\d{3})$/);if(match){const num=parseInt(match[1],10);if(num>maxLocal)maxLocal=num;}}}else{if(sn.includes(`-${snCode}-L`)){const match=sn.match(/-L(\d{3})$/);if(match){const num=parseInt(match[1],10);if(num>maxLocal)maxLocal=num;}}}});
let maxRemote=0;
try{const snap=await getDocs(collection(db,'production'));snap.forEach(docSnap=>{const sn=(docSnap.data().sn||'').toUpperCase();if(sn.includes(`-${snCode}-L`)){if(sheetNo){if(!sn.startsWith(`${cat}${sheetNo}`))return;}const match=sn.match(/-L(\d{3})$/);if(match){const num=parseInt(match[1],10);if(num>maxRemote)maxRemote=num;}}});}catch(e){}
return Math.max(maxLocal,maxRemote);
}
