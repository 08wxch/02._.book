const BANGKOK = 'Asia/Bangkok';

export function escapeHTML(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export const e = escapeHTML;

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function thaiDate(value, opts = {}) {
  const d = toDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: BANGKOK, ...opts
  }).format(d);
}

export function thaiMonthDay(value) {
  return thaiDate(value, { year: undefined });
}

export function thaiTime(value, withSeconds = false) {
  const d = toDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('th-TH', {
    hour: '2-digit', minute: '2-digit', ...(withSeconds ? { second: '2-digit' } : {}),
    hour12: false, timeZone: BANGKOK
  }).format(d);
}

export function thaiDateTime(value) {
  const d = toDate(value);
  if (!d) return '—';
  return `${thaiDate(d)} เวลา ${thaiTime(d)} น.`;
}

export function longThaiDate(value) {
  const d = toDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: BANGKOK
  }).format(d);
}

export function shortThaiDate(value) {
  const d = toDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    day: 'numeric', month: 'short', timeZone: BANGKOK
  }).format(d);
}

export function relativeTime(value) {
  const d = toDate(value);
  if (!d) return '—';
  const diff = Date.now() - d.getTime();
  if (diff < 0) {
    const future = Math.abs(diff);
    if (future < 60_000) return 'อีกไม่ถึงนาที';
    if (future < 3_600_000) return `อีก ${Math.floor(future / 60_000)} นาที`;
    if (future < 86_400_000) return `อีก ${Math.floor(future / 3_600_000)} ชั่วโมง`;
    return `อีก ${Math.floor(future / 86_400_000)} วัน`;
  }
  if (diff < 45_000) return 'เมื่อสักครู่';
  if (diff < 3_600_000) return `${Math.max(1, Math.floor(diff / 60_000))} นาทีที่แล้ว`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ชั่วโมงที่แล้ว`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)} วันที่แล้ว`;
  return thaiDate(d);
}

export function formatNumber(n, digits = 0) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: digits }).format(n);
}

export function formatDuration(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatCountdownWords(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (d > 0) return `${d} วัน ${h} ชม.`;
  if (h > 0) return `${h} ชม. ${m} น.`;
  return `${m} นาที`;
}

export function formatStopwatch(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')} นาที`;
}

export function percent(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalize(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[=]/g, '');
}

export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/);
  if (!parts[0]) return '?';
  return parts[0].slice(0, 1);
}

const avatarTones = ['sage', 'sky', 'sand', 'rose', 'lilac', 'mint'];
export function avatarTone(seed = 0) {
  const n = typeof seed === 'number' ? seed : [...String(seed)].reduce((a, c) => a + c.charCodeAt(0), 0);
  return avatarTones[Math.abs(n) % avatarTones.length];
}

export function typeLabel(type) {
  return ({ mcq: 'ปรนัย', truefalse: 'ถูก / ผิด', short: 'เติมคำ', essay: 'อัตนัย' })[type] || 'ข้อสอบ';
}

export function typeHint(type) {
  return ({
    mcq: 'เลือกคำตอบที่ถูกต้องเพียงข้อเดียว',
    truefalse: 'เลือกว่าข้อความนี้ถูกหรือผิด',
    short: 'พิมพ์คำตอบสั้น ๆ',
    essay: 'เขียนคำตอบให้ครบถ้วน'
  })[type] || '';
}

export function statusMeta(status) {
  const table = {
    open: { label: 'กำลังเปิดสอบ', tone: 'live', dot: true },
    closed: { label: 'ปิดสอบแล้ว', tone: 'neutral' },
    announced: { label: 'ประกาศผลแล้ว', tone: 'success' },
    saved: { label: 'บันทึกแล้ว', tone: 'info' },
    draft: { label: 'ฉบับร่าง', tone: 'draft' }
  };
  return table[status] || table.draft;
}

export function answerIsEmpty(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

export function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export function downloadFile(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* noop */ }
    ta.remove();
    return true;
  }
}

export function svgRing(percentValue, size = 74, stroke = 7) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamp(percentValue, 0, 100) / 100) * c;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="currentColor" stroke-opacity=".12" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}

export function greetingByHour(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: BANGKOK }).format(date));
  if (hour < 12) return 'สวัสดีตอนเช้า';
  if (hour < 17) return 'สวัสดีตอนบ่าย';
  return 'สวัสดีตอนเย็น';
}

export function examCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function makePrintHeader(title, subtitle = '') {
  return `<div class="print-only print-header">
    <div class="print-brand">02._.mock <span>ระบบสอบออนไลน์</span></div>
    <div class="print-title">${e(title)}</div>
    ${subtitle ? `<div class="print-subtitle">${e(subtitle)}</div>` : ''}
  </div>`;
}
