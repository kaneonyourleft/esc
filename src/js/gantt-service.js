/**
 * Gantt Chart Service Logic
 * @module gantt-service
 */

const G_BATCH_PAL = [
  '#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6',
  '#ec4899','#14b8a6','#f97316','#6366f1','#84cc16',
  '#06b6d4','#e11d48','#7c3aed','#0ea5e9','#d946ef'
];
const G_BATCH_MAP = {};
let gBatchIdx = 0;

export function gBatchColor(bid) {
  if (!bid) return '#666';
  if (!G_BATCH_MAP[bid]) {
    G_BATCH_MAP[bid] = G_BATCH_PAL[gBatchIdx % G_BATCH_PAL.length];
    gBatchIdx++;
  }
  return G_BATCH_MAP[bid];
}

export function resetBatchColors() {
  Object.keys(G_BATCH_MAP).forEach(k => delete G_BATCH_MAP[k]);
  gBatchIdx = 0;
}

export function gDays(a, b) {
  if (!a || !b) return 0;
  return Math.round((new Date(b+'T00:00:00') - new Date(a+'T00:00:00')) / 86400000);
}

export function gDateRange(filtered, getRoute, getProc, fD) {
  let mn = '9999-12-31', mx = '2000-01-01';
  Object.keys(filtered).forEach(sn => {
    const d = filtered[sn];
    const route = getRoute(sn, d);
    route.forEach(proc => {
      const p = getProc(d, proc);
      const s = fD(p.startDate);
      const e = fD(p.actualEnd) || fD(p.planEnd);
      if (s && s < mn) mn = s;
      if (e && e > mx) mx = e;
    });
  });
  if (mn > mx) { const t = new Date(); mn = t.toISOString().slice(0,10); mx = mn; }
  const ds = new Date(mn+'T00:00:00');
  ds.setDate(ds.getDate() - 7);
  const de = new Date(mx+'T00:00:00');
  de.setDate(de.getDate() + 14);
  const arr = [];
  for (let c = new Date(ds); c <= de; c.setDate(c.getDate()+1)) {
    arr.push(c.toISOString().slice(0,10));
  }
  return arr;
}

export function gMakeBar(sn, d, proc, dates, getProc, fD) {
  const p = getProc(d, proc);
  const s = fD(p.startDate);
  const eAct = fD(p.actualEnd);
  const ePlan = fD(p.planEnd);
  const e = eAct || ePlan;
  if (!s || !e) return null;
  const status = p.status || '대기';
  const today = new Date().toISOString().slice(0,10);
  let x1 = dates.indexOf(s);
  let x2 = dates.indexOf(e);
  if (x1 < 0) x1 = 0;
  if (x2 < 0) x2 = dates.length - 1;
  if (x2 < x1) x2 = x1;
  const bar = { x1:x1, x2:x2, proc:proc, sn:sn, status:status,
    bid: d.batchId||'', pname: d.productName||'', s:s, e:e, eAct:eAct, ePlan:ePlan };
  
  if (status !== '완료' && ePlan && today > ePlan) {
    bar.delayed = true;
    bar.delayDays = gDays(ePlan, today);
    const todayIdx = dates.indexOf(today);
    if (todayIdx > x2) bar.x2over = todayIdx;
  }
  return bar;
}

export function gBuildProcess(filtered, dates, G_PROCS, G_CLR, EQ_MAP, getRoute, getProc, ganttExpandState) {
  const rows = [];
  const eqMap = EQ_MAP || {};
  G_PROCS.forEach(proc => {
    rows.push({ type:'procHead', proc:proc, color:G_CLR[proc] });
    const equipMap = {};
    const equipAll = [];
    if (eqMap[proc]) {
      Object.keys(eqMap[proc]).forEach(cat => {
        (eqMap[proc][cat]||[]).forEach(eq => {
          if (equipAll.indexOf(eq) < 0) equipAll.push(eq);
          if (!equipMap[eq]) equipMap[eq] = [];
        });
      });
    }
    Object.keys(filtered).forEach(sn => {
      const d = filtered[sn];
      const route = getRoute(sn, d);
      if (route.indexOf(proc) < 0) return;
      const p = getProc(d, proc);
      const eq = p.equip || '미배정';
      if (!equipMap[eq]) { equipMap[eq] = []; if (equipAll.indexOf(eq)<0) equipAll.push(eq); }
      equipMap[eq].push({ sn:sn, d:d, proc:proc });
    });
    equipAll.sort((a,b) => (parseInt(a) || 999) - (parseInt(b) || 999));
    equipAll.forEach(eq => {
      const items = equipMap[eq] || [];
      const eqKey = proc + '_' + eq;
      if (typeof ganttExpandState[eqKey] === 'undefined') ganttExpandState[eqKey] = items.length > 0;
      const prodMap = {};
      items.forEach(it => {
        const key = (it.d.batchId||'?') + '|' + (it.d.productName||'?');
        if (!prodMap[key]) prodMap[key] = { bid:it.d.batchId||'', pname:it.d.productName||'', sns:[] };
        prodMap[key].sns.push(it);
      });
      const prods = Object.values(prodMap);
      rows.push({ type:'equip', key:eqKey, label:eq, count:items.length, proc:proc,
        expanded:ganttExpandState[eqKey], prods:prods });
      if (ganttExpandState[eqKey]) {
        prods.forEach(pr => {
          const bars = [];
          pr.sns.forEach(it => {
            const b = gMakeBar(it.sn, it.d, proc, dates, getProc, (v)=>v);
            if (b) bars.push(b);
          });
          rows.push({ type:'prodLine', bid:pr.bid, pname:pr.pname, count:pr.sns.length,
            bars:bars, proc:proc });
        });
      }
    });
  });
  return rows;
}

export function gBuildBatch(filtered, dates, getRoute, getProc, fD, gBatchColor, gDays, ganttExpandState) {
  const rows = [];
  const batchMap = {};
  Object.keys(filtered).forEach(sn => {
    const d = filtered[sn];
    const bid = d.batchId || '미배정';
    if (!batchMap[bid]) batchMap[bid] = {};
    const pname = d.productName || '?';
    if (!batchMap[bid][pname]) batchMap[bid][pname] = [];
    batchMap[bid][pname].push({ sn:sn, d:d });
  });

  const bids = Object.keys(batchMap).sort();
  bids.forEach(bid => {
    const prods = batchMap[bid];
    let total = 0;
    Object.keys(prods).forEach(p => { total += prods[p].length; });
    const bKey = 'batch_' + bid;
    if (typeof ganttExpandState[bKey] === 'undefined') ganttExpandState[bKey] = true;

    rows.push({ type:'batchHead', key:bKey, bid:bid, count:total,
      expanded:ganttExpandState[bKey], color:gBatchColor(bid) });

    if (ganttExpandState[bKey]) {
      Object.keys(prods).sort().forEach(pname => {
        const items = prods[pname];
        const bars = [];
        const route = getRoute(items[0].sn, items[0].d);
        route.forEach(proc => {
          let mn = '9999-12-31', mx = '2000-01-01';
          let sts = '대기', hasProg = false, hasComp = true;
          items.forEach(it => {
            const p = getProc(it.d, proc);
            const s = fD(p.startDate);
            const e = fD(p.actualEnd) || fD(p.planEnd);
            if (s && s < mn) mn = s;
            if (e && e > mx) mx = e;
            const ps = p.status || '대기';
            if (ps === '진행') hasProg = true;
            if (ps !== '완료') hasComp = false;
          });
          if (hasComp) sts = '완료';
          else if (hasProg) sts = '진행';
          if (mn < '9999') {
            let x1 = dates.indexOf(mn), x2 = dates.indexOf(mx);
            if (x1 < 0) x1 = 0;
            if (x2 < 0) x2 = dates.length - 1;
            const bar = { x1:x1, x2:x2, proc:proc, status:sts, bid:bid, pname:pname,
              s:mn, e:mx, sn:items.length+'매' };
            const today = new Date().toISOString().slice(0,10);
            if (sts !== '완료' && today > mx) {
              bar.delayed = true;
              bar.delayDays = gDays(mx, today);
            }
            bars.push(bar);
          }
        });
        rows.push({ type:'batchProd', pname:pname, count:items.length,
          bars:bars, bid:bid });
      });
    }
  });
  return rows;
}

export function gBuildProduct(filtered, dates, getRoute, getProc, fD, gBatchColor, gDays, ganttExpandState) {
  const rows = [];
  const prodMap = {};
  Object.keys(filtered).forEach(sn => {
    const d = filtered[sn];
    const pname = d.productName || '?';
    if (!prodMap[pname]) prodMap[pname] = {};
    const bid = d.batchId || '미배정';
    if (!prodMap[pname][bid]) prodMap[pname][bid] = [];
    prodMap[pname][bid].push({ sn:sn, d:d });
  });

  const pnames = Object.keys(prodMap).sort();
  pnames.forEach(pname => {
    const batches = prodMap[pname];
    let total = 0;
    Object.keys(batches).forEach(b => { total += batches[b].length; });
    const pKey = 'prod_' + pname;
    if (typeof ganttExpandState[pKey] === 'undefined') ganttExpandState[pKey] = true;

    rows.push({ type:'prodHead', key:pKey, pname:pname, count:total,
      expanded:ganttExpandState[pKey] });

    if (ganttExpandState[pKey]) {
      Object.keys(batches).sort().forEach(bid => {
        const items = batches[bid];
        const bars = [];
        const route = getRoute(items[0].sn, items[0].d);
        route.forEach(proc => {
          let mn = '9999-12-31', mx = '2000-01-01';
          let sts = '대기', hasProg = false, hasComp = true;
          items.forEach(it => {
            const p = getProc(it.d, proc);
            const s = fD(p.startDate);
            const e = fD(p.actualEnd) || fD(p.planEnd);
            if (s && s < mn) mn = s;
            if (e && e > mx) mx = e;
            const ps = p.status || '대기';
            if (ps === '진행') hasProg = true;
            if (ps !== '완료') hasComp = false;
          });
          if (hasComp) sts = '완료';
          else if (hasProg) sts = '진행';
          if (mn < '9999') {
            let x1 = dates.indexOf(mn), x2 = dates.indexOf(mx);
            if (x1 < 0) x1 = 0;
            if (x2 < 0) x2 = dates.length - 1;
            const bar = { x1:x1, x2:x2, proc:proc, status:sts, bid:bid, pname:pname,
              s:mn, e:mx, sn:items.length+'매' };
            const today = new Date().toISOString().slice(0,10);
            if (sts !== '완료' && today > mx) {
              bar.delayed = true;
              bar.delayDays = gDays(mx, today);
            }
            bars.push(bar);
          }
        });
        rows.push({ type:'prodBatch', bid:bid, count:items.length,
          bars:bars, pname:pname, color:gBatchColor(bid) });
      });
    }
  });
  return rows;
}
