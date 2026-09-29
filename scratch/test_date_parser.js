function parseFlexibleDate(text, refDate = new Date()) {
  if (!text || typeof text !== 'string') return null;
  const s = text.trim();

  // 1. Relative: +N เดือน / N เดือน / +N m
  const relMonth = s.match(/(?:\+|บวก)?\s*(\d+)\s*(?:เดือน|m|month|months|ด\b)/i);
  if (relMonth) {
    const months = parseInt(relMonth[1], 10);
    const d = new Date(refDate);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split('T')[0];
  }

  // Relative: +N ปี / N ปี
  const relYear = s.match(/(?:\+|บวก)?\s*(\d+)\s*(?:ปี|y|year|years)/i);
  if (relYear) {
    const years = parseInt(relYear[1], 10);
    const d = new Date(refDate);
    d.setFullYear(d.getFullYear() + years);
    return d.toISOString().split('T')[0];
  }

  // Relative: +N วัน / N วัน
  const relDay = s.match(/(?:\+|บวก)?\s*(\d+)\s*(?:วัน|d|days?)/i);
  if (relDay) {
    const days = parseInt(relDay[1], 10);
    const d = new Date(refDate);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  // 2. YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = s.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (isoMatch) {
    let year = parseInt(isoMatch[1], 10);
    let month = parseInt(isoMatch[2], 10);
    let day = parseInt(isoMatch[3], 10);
    if (year >= 2500) year -= 543;
    month = Math.max(1, Math.min(12, month));
    const maxDays = new Date(year, month, 0).getDate();
    day = Math.max(1, Math.min(maxDays, day));
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // 3. DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
  if (dmyMatch) {
    let day = parseInt(dmyMatch[1], 10);
    let month = parseInt(dmyMatch[2], 10);
    let year = parseInt(dmyMatch[3], 10);
    if (year >= 2500) year -= 543;
    month = Math.max(1, Math.min(12, month));
    const maxDays = new Date(year, month, 0).getDate();
    day = Math.max(1, Math.min(maxDays, day));
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  return null;
}

console.log('2026-11-31 ->', parseFlexibleDate('2026-11-31'));
console.log('30/11/2026 ->', parseFlexibleDate('30/11/2026'));
console.log('30/11/2569 ->', parseFlexibleDate('30/11/2569'));
console.log('+1 เดือน ->', parseFlexibleDate('+1 เดือน', new Date('2026-10-06')));
console.log('+6 เดือน ->', parseFlexibleDate('+6 เดือน', new Date('2026-10-06')));
console.log('dq ปรับวันหมดอายุเป็น 2026-11-31 ->', parseFlexibleDate('dq ปรับวันหมดอายุเป็น 2026-11-31'));
console.log('รับ แก๊สบอม 10 หมดอายุ 2026-11-30 ->', parseFlexibleDate('รับ แก๊สบอม 10 หมดอายุ 2026-11-30'));
