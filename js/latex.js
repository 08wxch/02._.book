/* ── เรนเดอร์สูตรคณิต (LaTeX) ด้วย KaTeX ───────────────── */

let ready = null;

function loadKatex() {
  if (ready) return ready;
  ready = new Promise((resolve) => {
    if (window.katex) { resolve(window.katex); return; }
    const s = document.createElement('script');
    s.src = './assets/vendor/katex/katex.min.js';
    s.onload = () => resolve(window.katex);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return ready;
}

const DELIMS = [
  { left: '$$', right: '$$', display: true },
  { left: '\\[', right: '\\]', display: true },
  { left: '\\(', right: '\\)', display: false },
  { left: '$', right: '$', display: false },
];

/** แทนที่ข้อความที่มี $...$ ด้วย HTML ที่เรนเดอร์แล้ว (escape ส่วนที่เหลือให้) */
export function renderMathInHtml(raw) {
  const text = String(raw ?? '');
  if (!text) return '';
  if (!/[\\$]/.test(text)) return escapeHtml(text);

  let out = '';
  let i = 0;
  while (i < text.length) {
    let matched = null;
    for (const d of DELIMS) {
      if (text.startsWith(d.left, i)) {
        const start = i + d.left.length;
        const end = text.indexOf(d.right, start);
        if (end !== -1 && end > start) {
          matched = { ...d, body: text.slice(start, end), from: i, to: end + d.right.length };
          break;
        }
      }
    }
    if (!matched) {
      // หาตัวอักษรถัดไปที่อาจเริ่ม delimiter
      const next = text.slice(i + 1).search(/[\\$]/);
      const chunk = next === -1 ? text.slice(i) : text.slice(i, i + 1 + next);
      out += escapeHtml(chunk);
      i += chunk.length;
      continue;
    }
    try {
      const html = window.katex
        ? window.katex.renderToString(matched.body, { throwOnError: false, displayMode: matched.display, output: 'html' })
        : escapeHtml(text.slice(matched.from, matched.to));
      out += `<span class="math${matched.display ? ' math--block' : ''}">${html}</span>`;
    } catch (err) {
      out += escapeHtml(text.slice(matched.from, matched.to));
    }
    i = matched.to;
  }
  return out;
}

/** เรียกหลัง mount เพื่อให้สูตรใน element ถูกเรนเดอร์ (กันกรณี katex ยังไม่โหลด) */
export async function hydrateMath(root = document) {
  const k = await loadKatex();
  if (!k) return;
  root.querySelectorAll('[data-math]').forEach((el) => {
    const src = el.getAttribute('data-math');
    el.innerHTML = renderMathInHtml(src);
  });
}

export function mathAttr(text) {
  return `data-math="${String(text ?? '').replace(/"/g, '&quot;')}"`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
