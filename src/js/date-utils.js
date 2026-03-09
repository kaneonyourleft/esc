/**
 * ESC Manager - Date Utilities
 * @module date-utils
 */

/**
 * Returns today's date in YYYY-MM-DD format
 * @returns {string}
 */
export const todayStr = () => new Date().toISOString().split('T')[0];

/**
 * Format Date-like value to YYYY-MM-DD
 * @param {any} val 
 * @param {string} fallback 
 * @returns {string}
 */
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

/**
 * Format Date-like value to YYYY.MM.DD
 * @param {any} val 
 * @returns {string}
 */
export const fmt = (val) => {
  const d = fD(val);
  if (!d || d === '-') return '-';
  const p = d.split('-');
  return p.length === 3 ? `${p[0]}.${p[1]}.${p[2]}` : '-';
};

/**
 * Check if the date is a weekend (Sat/Sun)
 * @param {Date} date 
 * @returns {boolean}
 */
export function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Add business days to a start date
 * @param {string} startDate - YYYY-MM-DD 
 * @param {number} days 
 * @returns {string} YYYY-MM-DD
 */
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

/**
 * Calculate business days difference between two dates
 * @param {string} start - YYYY-MM-DD
 * @param {string} end - YYYY-MM-DD
 * @returns {number}
 */
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

/**
 * Debounce function
 */
export function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}
