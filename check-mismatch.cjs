const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, getDocs, collection } = require('firebase/firestore');
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

async function check() {
  await signInWithEmailAndPassword(auth, "vba@esc.com", "Esc12345!");
  const pSnap = await getDocs(collection(db, "products"));
  const prodMap = {};
  pSnap.forEach(d => { prodMap[d.id] = d.data(); });

  const dSnap = await getDocs(collection(db, "production"));
  let mismatch = 0, ok = 0, unknown = 0;
  const examples = [];
  dSnap.forEach(d => {
    const r = d.data();
    const prod = prodMap[r.productName];
    if (!prod) { unknown++; return; }
    const expected = correctRoute(r.productName, prod.dcJoint, prod.heatTreat);
    const actual = r.processes ? Object.keys(r.processes).sort() : [];
    const expSorted = [...expected].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expSorted)) {
      mismatch++;
      if (examples.length < 5) examples.push({ sn: d.id, product: r.productName, actual, expected: expSorted });
    } else { ok++; }
  });
  console.log("총 " + dSnap.size + "건 | 정상:" + ok + " | 불일치:" + mismatch + " | 미등록제품:" + unknown);
  if (examples.length > 0) {
    console.log("\n불일치 예시:");
    examples.forEach(e => console.log(e.sn + " | " + e.product + " | 실제:" + JSON.stringify(e.actual) + " | 기대:" + JSON.stringify(e.expected)));
  }
  process.exit(0);
}
check().catch(e => { console.error(e); process.exit(1); });
