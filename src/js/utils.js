import { EQ_MAP } from './constants.js';

export const todayStr = () => new Date().toISOString().split('T')[0];

export function fD(val, fallback = '') {
  if (!val) return fallback;
  if (typeof val === 'object' && typeof val.toDate === 'function') {
    try { return val.toDate().toISOString().split('T')[0]; } catch { return fallback; }
  }
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? fallback : val.toISOString().split('T')[0];
  }
  if (typeof val === 'object' && typeof val.seconds === 'number') {
    try { return new Date(val.seconds * 1000).toISOString().split('T')[0]; } catch { return fallback; }
  }
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
    const d = new Date(val);
    return isNaN(d.getTime()) ? fallback : d.toISOString().split('T')[0];
  }
  if (typeof val === 'number') {
    try { return new Date(val).toISOString().split('T')[0]; } catch { return fallback; }
  }
  return fallback;
}

export const fmt = (val) => {
  const d = fD(val);
  if (!d || d === '-') return '-';
  const p = d.split('-');
  return p.length === 3 ? `${p[0]}.${p[1]}.${p[2]}` : '-';
};

export function getProc(item, procName) {
  const blank = {
    status: '대기', planStart: '', planEnd: '', actualStart: '', actualEnd: '',
    planDays: 0, actualDays: 0, equip: '', defect: '', remark: ''
  };
  if (!item || !item.processes || typeof item.processes !== 'object') return { ...blank };
  return item.processes[procName] || { ...blank };
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function addBD(startDate, days) {
  if (!startDate || !days) return '';
  let d = new Date(startDate + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  const dir = days > 0 ? 1 : -1;
  let count = 0;
  const abs = Math.abs(days);
  while (count < abs) {
    d.setDate(d.getDate() + dir);
    if (!isWeekend(d)) count++;
  }
  return d.toISOString().split('T')[0];
}

export function diffBD(start, end) {
  if (!start || !end) return 0;
  let s = new Date(start + 'T00:00:00');
  let e = new Date(end + 'T00:00:00');
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return 0;
  let count = 0;
  let cur = new Date(s);
  while (cur < e) {
    cur.setDate(cur.getDate() + 1);
    if (!isWeekend(cur)) count++;
  }
  return count;
}

  export function getDefaultDays(proc, category, stackQty) {
    switch (proc) {
      case "탈지":     return 6;
      case "소성":     return (stackQty >= 9) ? 5 : 3;
      case "환원소성": return 3;
      case "평탄화":   return 3;
      case "도금":     return 1;
      case "열처리":   return 1;
      default:         return 3;
    }
  }

  export function buildRoute(category, heat, dcJoint) {
    const cat = (category || "").toUpperCase();
    const h = (heat || "N").toUpperCase();
    const dc = (dcJoint || "").toUpperCase();
    const route = ["탈지", "소성"];
    if (cat === "BL") route.push("환원소성");
    route.push("평탄화");
    if (dc !== "BRAZING") route.push("도금");
    if (h === "Y") route.push("열처리");
    return route;
  }

  export function getAvailableFurnaces(category) {
    const all = EQ_MAP["소성"] || [];
    if (category === "BL") return all.filter(e => e === "1호기" || e === "4호기");
    return all.filter(e => e !== "1호기" && e !== "4호기");
  }

export function extractCategory(sn) {
  if (!sn) return '';
  const upper = String(sn).toUpperCase();
  if (upper.startsWith('WN')) return 'WN';
  if (upper.startsWith('BL')) return 'BL';
  if (upper.startsWith('HP')) return 'HP';
  return '';
}

export function extractBatchFromSN(sn) {
  if (!sn) return '';
  const match = String(sn).match(/^([A-Z]{2}\d{4})/i);
  return match ? match[1] : '';
}

export function getInputMonth(item) {
  // 1순위: inputDate 필드
  if (item.inputDate) {
    const d = typeof item.inputDate === 'string' ? item.inputDate : '';
    if (d.length >= 7) return d.slice(0, 7); // "2026-01" 형태
  }
  // 2순위: 배치코드 prefix 파싱
  const batch = item.batchId || item.batch || '';
  if (batch.length >= 4) {
    const yy = batch.slice(0, 2);
    const mm = batch.slice(2, 4);
    const year = 2000 + parseInt(yy);
    const month = parseInt(mm);
    if (!isNaN(year) && month >= 1 && month <= 12) {
      return year + '-' + String(month).padStart(2, '0');
    }
  }
  // 3순위: createdAt
  if (item.createdAt) {
    const d = typeof item.createdAt === 'string' ? item.createdAt.slice(0, 7) : '';
    if (d.length >= 7) return d;
  }
  return '기타';
}

export function formatMonth(monthKey) {
  if (monthKey === '기타') return '기타';
  const [y, m] = monthKey.split('-');
  return y + '년 ' + parseInt(m) + '월';
}

export function getRoute(sn, item) {
  if (item && Array.isArray(item.route) && item.route.length > 0) return item.route;
  if (item && typeof item.route === 'string' && item.route.includes('→')) {
    const parts = item.route.split('→').map(s => s.trim()).filter(Boolean);
    if (parts.length) return parts;
  }
  const cat = extractCategory(sn) || (item && item.category ? item.category : '');
  const heat = item && item.heat ? item.heat : 'N';
  return buildRoute(cat, heat, item && item.dcJoint ? item.dcJoint : "");
}

  export function getEquipList(proc, category) {
    const cat = (category || "").toUpperCase();
    switch (proc) {
      case "탈지": return ["1호기", "2호기", "3호기"];
      case "소성":
        if (cat === "BL") return ["1호기", "4호기"];
        return ["5호기", "10호기", "11호기", "12호기", "13호기", "14호기", "15호기", "16호기", "17호기", "18호기"];
      case "환원소성":
        if (cat === "BL") return ["2호기"];
        return [];
      case "평탄화":
        if (cat === "BL") return ["3호기"];
        return ["6호기", "7호기", "8호기", "9호기"];
      case "도금": return ["외주"];
      case "열처리": return ["GB"];
      default: return EQ_MAP[proc] || [];
    }
  }

export function calcProgress(item, sn) {
  const route = getRoute(sn, item);
  if (!route.length) return 0;
  let done = 0;
  route.forEach(proc => {
    if (getProc(item, proc).status === '완료') done++;
  });
  return Math.round(done / route.length * 100);
}

export function mdToHtml(text) {
  if (!text) return '';
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}


export function positionDropdown(dropdown, anchor) {
  if (!dropdown || !anchor) return;
  const rect = anchor.getBoundingClientRect();
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  dropdown.style.position = 'fixed';
  dropdown.style.left = rect.left + 'px';
  dropdown.style.top = (rect.bottom + 4) + 'px';
  requestAnimationFrame(() => {
    const ddRect = dropdown.getBoundingClientRect();
    if (ddRect.bottom > winH - 10) dropdown.style.top = (rect.top - ddRect.height - 4) + 'px';
    if (ddRect.right > winW - 10) dropdown.style.left = (winW - ddRect.width - 10) + 'px';
    if (parseFloat(dropdown.style.left) < 10) dropdown.style.left = '10px';
  });
}

export function handleEmptyChart(canvas, data, msg = '데이터가 없습니다') {
  if (!canvas) return true;
  const isEmpty = !data || (Array.isArray(data) && data.length === 0) ||
    (typeof data === 'object' && !Array.isArray(data) && Object.keys(data).length === 0);
  if (!isEmpty && typeof data === 'number' && data > 0) return false;
  if (!isEmpty && typeof data === 'object' && !Array.isArray(data) &&
    Object.values(data).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0) > 0) return false;
  if (!isEmpty && !Array.isArray(data)) return false;

  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.parentElement ? canvas.parentElement.clientWidth - 32 : 300;
  const h = canvas.height = 240;
  ctx.clearRect(0, 0, w, h);
  const dark = !document.body.classList.contains('light-mode');
  ctx.fillStyle = dark ? '#666' : '#999';
  ctx.font = '14px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(msg, w / 2, h / 2);
  return true;
}