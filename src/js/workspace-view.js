import { DATA, PRODUCTS, PROC_COLORS, wsSelection, wsFilters, wsViewMode, wsGroups } from './main.js';
import { fD, fmt, todayStr } from './date-utils.js';
import { getProc, getRoute, extractCategory, statusBadge, calcProgress, toast } from './main.js';
import * as WSService from './workspace-service.js';

/**
 * Workspace View Logic
 */

export function renderWorkspace() {
  const q = (document.getElementById('wsSearch')?.value || '').toLowerCase();
  const filters = wsFilters;
  
  let items = Object.values(DATA).filter(d => {
    if (q) {
      const allEquips = Object.values(d.processes || {}).map(p => p.equip || '').join(' ').toLowerCase();
      const match = (d.sn || '').toLowerCase().includes(q) ||
                    (d.productName || '').toLowerCase().includes(q) ||
                    (d.batch || '').toLowerCase().includes(q) ||
                    allEquips.includes(q) ||
                    (d.currentProcess || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filters.includes('전체')) return true;
    return filters.includes(d.status || '대기');
  });

  const countEl = document.getElementById('wsSearchCount');
  if (countEl) {
    if (q) countEl.textContent = `${items.length}건 검색됨`;
    else countEl.textContent = '';
  }

  if (wsViewMode === 'batch') {
    renderWorkspaceBatch(items);
    return;
  }

  const groups = {};
  items.forEach(d => {
    const k = d.productName || '미지정';
    if (!groups[k]) groups[k] = { name: k, items: [] };
    groups[k].items.push(d);
  });

  renderTable(groups);
  updateBatchBar();
}

function renderTable(groups) {
  const html = `
    <table>
      <thead>
        <tr>
          <th style="width:40px"><input type="checkbox" onchange="window.toggleSelectAll(this)"></th>
          <th>S/N</th>
          <th>제품명</th>
          <th>현재공정</th>
          <th>상태</th>
          <th>진행률</th>
          <th class="hide-mobile">설비</th>
          <th class="hide-mobile">일정</th>
          <th class="hide-mobile">작업</th>
        </tr>
      </thead>
      <tbody id="wsBody"></tbody>
    </table>`;
  
  const tableWrap = document.getElementById('wsTable');
  if (!tableWrap) return;
  tableWrap.innerHTML = html;
  
  const tbody = document.getElementById('wsBody');
  Object.values(groups).sort((a,b) => a.name.localeCompare(b.name)).forEach(g => {
    const isOpen = wsGroups[g.name] !== false;
    
    const tr = document.createElement('tr');
    tr.className = 'group-row';
    tr.innerHTML = `
      <td><input type="checkbox" onchange="window.toggleGroupSelect('${g.name}', this)"></td>
      <td colspan="8" onclick="window.toggleGroup('${g.name}')">
        <span style="display:inline-block;width:20px">${isOpen ? '▼' : '▶'}</span>
        <strong>${g.name}</strong> (${g.items.length}매)
      </td>
    `;
    tbody.appendChild(tr);

    if (isOpen) {
      g.items.sort((a,b) => (b.sn||'').localeCompare(a.sn||'')).forEach(it => {
        const prog = calcProgress(it, it.sn);
        const proc = it.currentProcess || '';
        const procColor = PROC_COLORS[proc] || '#666';
        const p = getProc(it, proc);
        
        const itr = document.createElement('tr');
        itr.innerHTML = `
          <td><input type="checkbox" class="sn-check" value="${it.sn}" ${wsSelection.has(it.sn) ? 'checked' : ''} onchange="window.onSNCheck('${it.sn}', this.checked)"></td>
          <td><span class="sn-link" onclick="openSidePanel('${it.sn}')">${it.sn}</span></td>
          <td style="font-size:12px">${it.productName || '-'}</td>
          <td><span class="proc-badge" style="background:${procColor}">${proc}</span></td>
          <td>${statusBadge(it.status)}</td>
          <td>
            <div style="display:flex;align-items:center;gap:6px">
              <div class="prog-mini"><div style="width:${prog}%"></div></div>
              <span style="font-size:10px">${prog}%</span>
            </div>
          </td>
          <td class="hide-mobile" style="font-size:11px">${p.equip || '-'}</td>
          <td class="hide-mobile" style="font-size:11px">${fmt(fD(it.startDate))}~${fmt(fD(it.endDate))}</td>
          <td class="hide-mobile">
            <select class="form-input form-select" style="padding:2px 4px;font-size:11px" onchange="window.quickStatusChange('${it.sn}', this.value)">
              ${['대기', '진행', '완료', '지연', '폐기'].map(s => `<option ${s === it.status ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </td>
        `;
        tbody.appendChild(itr);
      });
    }
  });
}

function renderWorkspaceBatch(items) {
  const groups = {};
  items.forEach(d => {
    const k = d.batch || '미분류';
    if (!groups[k]) groups[k] = { name: k, items: [] };
    groups[k].items.push(d);
  });

  const tbody = document.getElementById('wsBody'); // Assuming skeleton exists
  const tableWrap = document.getElementById('wsTable');
  if (!tableWrap) return;

  tableWrap.innerHTML = `<table><thead><tr><th style="width:40px"><input type="checkbox" onchange="window.toggleSelectAll(this)"></th><th>S/N</th><th>제품명</th><th>현재공정</th><th>상태</th><th>진행률</th><th class="hide-mobile">설비</th><th class="hide-mobile">일정</th><th class="hide-mobile">작업</th></tr></thead><tbody id="wsBody"></tbody></table>`;
  const tb = document.getElementById('wsBody');

  Object.values(groups).sort((a, b) => b.name.localeCompare(a.name)).forEach(g => {
    const isOpen = wsGroups['batch_' + g.name] !== false;
    const tr = document.createElement('tr');
    tr.className = 'group-row';
    tr.innerHTML = `<td><input type="checkbox" onchange="window.toggleGroupSelectBatch('${g.name}', this)"></td><td colspan="8" onclick="window.toggleGroup('batch_${g.name}')"><span>${isOpen ? '▼' : '▶'}</span> <strong>${g.name}</strong> (${g.items.length}매)</td>`;
    tb.appendChild(tr);

    if (isOpen) {
      g.items.forEach(it => {
        // Same row logic as above... omitting for brevity or using a helper
        const prog = calcProgress(it, it.sn);
        const proc = it.currentProcess || '';
        const p = getProc(it, proc);
        const procColor = PROC_COLORS[proc] || '#666';
        const itr = document.createElement('tr');
        itr.innerHTML = `<td><input type="checkbox" class="sn-check" value="${it.sn}" ${wsSelection.has(it.sn) ? 'checked' : ''} onchange="window.onSNCheck('${it.sn}', this.checked)"></td><td><span class="sn-link" onclick="openSidePanel('${it.sn}')">${it.sn}</span></td><td style="font-size:12px">${it.productName || '-'}</td><td><span class="proc-badge" style="background:${procColor}">${proc}</span></td><td>${statusBadge(it.status)}</td><td><div style="display:flex;align-items:center;gap:6px"><div class="prog-mini"><div style="width:${prog}%"></div></div><span style="font-size:10px">${prog}%</span></div></td><td class="hide-mobile">${p.equip || '-'}</td><td class="hide-mobile">${fmt(fD(it.startDate))}</td><td class="hide-mobile"><select onchange="window.quickStatusChange('${it.sn}', this.value)">${['대기','진행','완료','지연','폐기'].map(s => `<option ${s===it.status?'selected':''}>${s}</option>`).join('')}</select></td>`;
        tb.appendChild(itr);
      });
    }
  });
  updateBatchBar();
}

export function updateBatchBar() {
  const bar = document.getElementById('batchBar');
  if (!bar) return;
  const cnt = wsSelection.size;
  if (cnt > 0) {
    bar.classList.add('show');
    document.getElementById('batchCount').textContent = `${cnt}건 선택됨`;
  } else {
    bar.classList.remove('show');
  }
}

const esc = (str) => str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '';
