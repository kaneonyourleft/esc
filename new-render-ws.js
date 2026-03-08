window.renderWorkspace = function renderWorkspace() {
  const table = document.getElementById('wsTable');
  if (!table) return;
  updateFilterOptions();

  const search = (document.getElementById('wsSearch')?.value || '').toLowerCase();
  const fStatus = document.getElementById('wsFilterStatus')?.value || '';
  const fProduct = document.getElementById('wsFilterProduct')?.value || '';
  const fBatch = document.getElementById('wsFilterBatch')?.value || '';
  const fEquip = document.getElementById('wsFilterEquip')?.value || '';
  const fProc = document.getElementById('wsFilterProc')?.value || '';

  const filtered = Object.entries(DATA).filter(([sn, d]) => {
    const s = d.status || '대기';
    if (fStatus && s !== fStatus) return false;
    if (fProduct && (d.productName || '') !== fProduct) return false;
    if (fBatch && (d.batch || d.batchId || '') !== fBatch) return false;
    if (fEquip) { const route = getRoute(sn, d); if (!route.some(p => (getProc(d, p).equip || '') === fEquip)) return false; }
    if (fProc) { if (!getRoute(sn, d).includes(fProc)) return false; }
    if (search) { const hay = (sn + ' ' + (d.productName||'') + ' ' + (d.batch||d.batchId||'')).toLowerCase(); if (!hay.includes(search)) return false; }
    return true;
  });

  const countEl = document.getElementById('wsSearchCount');
  if (countEl) countEl.textContent = search ? filtered.length + '건' : '';

  const PL = ['탈지','소성','환원소성','평탄화','도금','열처리'];
  const PC = {'탈지':'#06b6d4','소성':'#f97316','환원소성':'#a855f7','평탄화':'#10b981','도금':'#eab308','열처리':'#ef4444'};
  const EBP = {
    '탈지':['1호기','2호기','3호기'],
    '소성':['1호기','4호기','5호기','10호기','11호기','12호기','13호기','14호기','15호기','16호기','17호기','18호기'],
    '환원소성':['2호기'],
    '평탄화':['3호기','6호기','7호기','8호기','9호기'],
    '도금':['외주'],
    '열처리':['GB']
  };

  function snClick(sn) { return ' onclick="openSidePanel(\'' + sn + '\')"'; }
  function grpClick(k) { return ' onclick="toggleGroup(\'' + k + '\')"'; }
  function arrow(k) { return '<span style="font-size:10px;color:#64748b;width:14px;display:inline-block;transition:.2s;transform:rotate(' + (wsGroupState[k] ? '90' : '0') + 'deg)">▶</span>'; }

  if (wsViewMode === 'process') {
    var tree = {};
    PL.forEach(function(p) { tree[p] = {}; (EBP[p]||[]).forEach(function(eq) { tree[p][eq] = {}; }); });
    filtered.forEach(function(entry) {
      var sn = entry[0], d = entry[1];
      var cp = d.currentProcess || '';
      if (!cp) return;
      var s = d.status || '대기';
      if (s === '완료' || s === '폐기') return;
      var procs = d.processes || {};
      var pd = procs[cp] || {};
      var eq = pd.equip || '';
      if (!eq || !tree[cp]) return;
      if (!tree[cp][eq]) tree[cp][eq] = {};
      var prod = d.productName || '기타';
      if (!tree[cp][eq][prod]) tree[cp][eq][prod] = [];
      tree[cp][eq][prod].push(sn);
    });

    var html = '';
    PL.forEach(function(proc) {
      var clr = PC[proc];
      var equips = EBP[proc] || [];
      html += '<div style="margin-bottom:12px">';
      html += '<div style="font-size:14px;font-weight:700;color:' + clr + ';padding:8px 12px;background:#151d35;border:1px solid #1e293b;border-radius:8px 8px 0 0">' + esc(proc) + '</div>';
      html += '<div style="background:#0f1629;border:1px solid #1e293b;border-top:none;border-radius:0 0 8px 8px">';
      equips.forEach(function(eq) {
        var prods = tree[proc][eq] || {};
        var pe = Object.entries(prods);
        var has = pe.length > 0;
        var ek = 'eq_' + proc + '_' + eq;
        html += '<div style="border-bottom:1px solid #1e293b">';
        if (has) {
          html += '<div' + grpClick(ek) + ' style="display:flex;align-items:center;padding:7px 12px;cursor:pointer;user-select:none">';
          html += arrow(ek);
        } else {
          html += '<div style="display:flex;align-items:center;padding:7px 12px">';
          html += '<span style="width:14px;display:inline-block"></span>';
        }
        html += '<span style="font-size:12px;font-weight:600;color:#818cf8;width:60px">' + esc(eq) + '</span>';
        if (!has) html += '<span style="font-size:11px;color:#334155">—</span>';
        html += '</div>';
        if (has && wsGroupState[ek]) {
          pe.forEach(function(pair) {
            var prod = pair[0], snList = pair[1];
            var pk = ek + '_' + prod;
            html += '<div style="padding:0 12px 0 36px;border-top:1px solid rgba(30,41,59,0.5)">';
            html += '<div' + grpClick(pk) + ' style="display:flex;align-items:center;padding:5px 0;cursor:pointer;user-select:none">';
            html += arrow(pk);
            html += '<span style="font-size:12px;color:#e2e8f0">' + esc(prod) + '</span>';
            html += '<span style="font-size:11px;color:#10b981;font-weight:600;margin-left:6px">' + snList.length + '매</span>';
            html += '</div>';
            if (wsGroupState[pk]) {
              html += '<div style="padding:2px 0 6px 28px">';
              snList.sort().forEach(function(sn) {
                html += '<div' + snClick(sn) + ' style="font-size:11px;font-family:monospace;color:#64748b;padding:2px 0;cursor:pointer" onmouseover="this.style.color=\'#818cf8\'" onmouseout="this.style.color=\'#64748b\'">' + esc(sn) + '</div>';
              });
              html += '</div>';
            }
            html += '</div>';
          });
        }
        html += '</div>';
      });
      html += '</div></div>';
    });
    table.innerHTML = html;

  } else if (wsViewMode === 'batch') {
    var batches = {};
    filtered.forEach(function(entry) {
      var sn = entry[0], d = entry[1];
      var b = d.batch || d.batchId || '기타';
      if (!batches[b]) batches[b] = {};
      var prod = d.productName || '기타';
      if (!batches[b][prod]) batches[b][prod] = { sns: [], route: getRoute(sn, d), item: d };
      batches[b][prod].sns.push(sn);
    });

    var html = '';
    Object.keys(batches).sort().forEach(function(batch) {
      var bk = 'b_' + batch;
      var prods = batches[batch];
      var tot = Object.values(prods).reduce(function(s, p) { return s + p.sns.length; }, 0);
      var pc = Object.keys(prods).length;
      html += '<div style="margin-bottom:8px;background:#0f1629;border:1px solid #1e293b;border-radius:8px;overflow:hidden">';
      html += '<div' + grpClick(bk) + ' style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#151d35;cursor:pointer;user-select:none;border-bottom:1px solid #1e293b">';
      html += arrow(bk);
      html += '<span style="font-size:14px;font-weight:600">' + esc(batch) + '</span>';
      html += '<span style="font-size:11px;color:#64748b">' + tot + '매 · ' + pc + '제품</span>';
      html += '</div>';
      if (wsGroupState[bk]) {
        Object.entries(prods).forEach(function(pair) {
          var prod = pair[0], info = pair[1];
          var pk = bk + '_' + prod;
          var route = info.route || [];
          html += '<div style="border-bottom:1px solid rgba(30,41,59,0.5)">';
          html += '<div' + grpClick(pk) + ' style="display:flex;align-items:center;gap:8px;padding:8px 14px 8px 28px;cursor:pointer;user-select:none">';
          html += arrow(pk);
          html += '<span style="font-size:13px;color:#e2e8f0">' + esc(prod) + '</span>';
          html += '<span style="font-size:11px;color:#10b981;font-weight:600">' + info.sns.length + '매</span>';
          html += '<div style="display:flex;gap:2px;margin-left:auto;max-width:250px;flex:1">';
          route.forEach(function(proc) {
            var ps = getProc(info.item, proc).status || '대기';
            var op = ps === '완료' ? '1' : ps === '진행' ? '0.6' : '0.2';
            html += '<div style="flex:1;height:14px;border-radius:3px;background:' + (PROC_COLORS[proc]||'#666') + ';opacity:' + op + ';font-size:8px;color:#fff;display:flex;align-items:center;justify-content:center">' + esc(proc) + '</div>';
          });
          html += '</div></div>';
          if (wsGroupState[pk]) {
            html += '<div style="padding:2px 14px 6px 56px">';
            info.sns.sort().forEach(function(sn) {
              html += '<div' + snClick(sn) + ' style="font-size:11px;font-family:monospace;color:#64748b;padding:2px 0;cursor:pointer" onmouseover="this.style.color=\'#818cf8\'" onmouseout="this.style.color=\'#64748b\'">' + esc(sn) + '</div>';
            });
            html += '</div>';
          }
          html += '</div>';
        });
      }
      html += '</div>';
    });
    table.innerHTML = html;

  } else {
    var products = {};
    filtered.forEach(function(entry) {
      var sn = entry[0], d = entry[1];
      var prod = d.productName || '기타';
      if (!products[prod]) products[prod] = {};
      var b = d.batch || d.batchId || '기타';
      if (!products[prod][b]) products[prod][b] = { sns: [], route: getRoute(sn, d), item: d };
      products[prod][b].sns.push(sn);
    });

    var html = '';
    Object.keys(products).sort().forEach(function(prod) {
      var pk = 'p_' + prod;
      var batches = products[prod];
      var tot = Object.values(batches).reduce(function(s, b) { return s + b.sns.length; }, 0);
      html += '<div style="margin-bottom:8px;background:#0f1629;border:1px solid #1e293b;border-radius:8px;overflow:hidden">';
      html += '<div' + grpClick(pk) + ' style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:#151d35;cursor:pointer;user-select:none;border-bottom:1px solid #1e293b">';
      html += arrow(pk);
      html += '<span style="font-size:14px;font-weight:600">' + esc(prod) + '</span>';
      html += '<span style="font-size:11px;color:#64748b">' + tot + '매</span>';
      html += '</div>';
      if (wsGroupState[pk]) {
        Object.entries(batches).sort().forEach(function(pair) {
          var batch = pair[0], info = pair[1];
          var bk = pk + '_' + batch;
          var route = info.route || [];
          html += '<div style="border-bottom:1px solid rgba(30,41,59,0.5)">';
          html += '<div' + grpClick(bk) + ' style="display:flex;align-items:center;gap:8px;padding:8px 14px 8px 28px;cursor:pointer;user-select:none">';
          html += arrow(bk);
          html += '<span style="font-size:13px;color:#e2e8f0">' + esc(batch) + '</span>';
          html += '<span style="font-size:11px;color:#10b981;font-weight:600">' + info.sns.length + '매</span>';
          html += '<div style="display:flex;gap:2px;margin-left:auto;max-width:250px;flex:1">';
          route.forEach(function(proc) {
            var ps = getProc(info.item, proc).status || '대기';
            var op = ps === '완료' ? '1' : ps === '진행' ? '0.6' : '0.2';
            html += '<div style="flex:1;height:14px;border-radius:3px;background:' + (PROC_COLORS[proc]||'#666') + ';opacity:' + op + ';font-size:8px;color:#fff;display:flex;align-items:center;justify-content:center">' + esc(proc) + '</div>';
          });
          html += '</div></div>';
          if (wsGroupState[bk]) {
            html += '<div style="padding:2px 14px 6px 56px">';
            info.sns.sort().forEach(function(sn) {
              html += '<div' + snClick(sn) + ' style="font-size:11px;font-family:monospace;color:#64748b;padding:2px 0;cursor:pointer" onmouseover="this.style.color=\'#818cf8\'" onmouseout="this.style.color=\'#64748b\'">' + esc(sn) + '</div>';
            });
            html += '</div>';
          }
          html += '</div>';
        });
      }
      html += '</div>';
    });
    table.innerHTML = html;
  }
}
