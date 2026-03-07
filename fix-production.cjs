const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, getDocs, collection, doc, updateDoc, deleteField } = require('firebase/firestore');
const app = initializeApp({
  apiKey: "AIzaSyAwDS2PigihTH6RKMxzrH-utlaKJbtHBTY",
  authDomain: "esc-production-management.firebaseapp.com",
  projectId: "esc-production-management"
});
const auth = getAuth(app);
const db = getFirestore(app);

function correctRoute(name, dcJoint, heatTreat) {
  const route = ["탈지", "소성"];
  if (name === "BL423" || name === "MINOS 2Z" || name === "NA4ZCC") route.push("환원소성");
  route.push("평탄화");
  if (dcJoint !== "BRAZING") route.push("도금");
  if (heatTreat === true) route.push("열처리");
  return route;
}

async function fixProduction() {
  await signInWithEmailAndPassword(auth, "vba@esc.com", "Esc12345!");
  console.log("로그인 성공\n");

  const pSnap = await getDocs(collection(db, "products"));
  const prodMap = {};
  pSnap.forEach(d => { prodMap[d.id] = d.data(); });

  const dSnap = await getDocs(collection(db, "production"));
  let fixed = 0, skipped = 0;

  for (const d of dSnap.docs) {
    const r = d.data();
    const prod = prodMap[r.productName];
    if (!prod) continue;

    const expected = correctRoute(r.productName, prod.dcJoint, prod.heatTreat);
    const actual = r.processes ? Object.keys(r.processes) : [];
    const expSet = new Set(expected);
    const actSet = new Set(actual);

    // 있어야 하는데 없는 공정 추가
    const toAdd = expected.filter(p => !actSet.has(p));
    // 없어야 하는데 있는 공정 제거
    const toRemove = actual.filter(p => !expSet.has(p));

    if (toAdd.length === 0 && toRemove.length === 0) { skipped++; continue; }

    const updates = {};
    for (const p of toAdd) {
      updates["processes." + p] = {
        order: expected.indexOf(p) + 1,
        equip: "", status: "대기", startDate: "", planEnd: "",
        actualEnd: "", planDays: 0, actualDays: 0, defect: "", remark: ""
      };
    }
    for (const p of toRemove) {
      updates["processes." + p] = deleteField();
    }

    await updateDoc(doc(db, "production", d.id), updates);
    fixed++;
    if (fixed <= 10) {
      let msg = d.id + " | " + r.productName;
      if (toAdd.length > 0) msg += " | +추가:" + JSON.stringify(toAdd);
      if (toRemove.length > 0) msg += " | -제거:" + JSON.stringify(toRemove);
      console.log(msg);
    }
  }

  console.log("\n보정 완료: " + fixed + "건 수정, " + skipped + "건 정상");
  process.exit(0);
}
fixProduction().catch(e => { console.error(e); process.exit(1); });
