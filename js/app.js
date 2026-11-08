/* ── 02._.book — จองคอร์สเรียนและดูคะแนนนักเรียน ─────────── */

import { CONFIG } from './config.js';
import * as data from './data.js';
import { badge, confirmDialog, emptyState, escapeAttr, sectionHeading, toast } from './ui.js';
import { e, formatNumber, longThaiDate, percent as pct, thaiDate, thaiDateTime, avatarTone, initials } from './utils.js';
import { renderHome } from './views/home.js';
import { renderCourse } from './views/course.js';
import { renderCheckout } from './views/checkout.js';
import { renderAuth, renderTeacherAuth } from './views/auth.js';
import { renderAccount, renderScores } from './views/account.js';
import { renderAdmin } from './views/admin.js';
import { renderPortal } from './views/portal.js';

const app = document.getElementById('app');
let me = null;
let settings = {};

/* ── helpers ──────────────────────────────────────────── */
export const money = (n) => formatNumber(Number(n || 0));
export const baht = (n) => `฿${money(n)}`;

export function statusBadge(status) {
  const map = {
    pending_payment: ['ยังไม่ชำระ', 'warn'],
    pending_confirm: ['รอยืนยัน', 'info'],
    confirmed: ['ยืนยันแล้ว', 'success'],
    rejected: ['ไม่ผ่าน', 'danger'],
  };
  const [label, tone] = map[status] || ['—', 'neutral'];
  return badge(label, tone, true);
}

export function avatarHtml(user, size = 40) {
  const name = user?.name || user?.email || '?';
  return `<span class="avatar avatar--md tone-${avatarTone(name.length)}" style="width:${size}px;height:${size}px">${e(initials(name))}</span>`;
}

/* ── header / footer ──────────────────────────────────── */
function navLink(path, label) {
  const active = (location.hash.replace(/^#/, '').split('?')[0] || '/').startsWith(path) ? ' is-active' : '';
  return `<a class="nav-link${active}" href="#${path}">${e(label)}</a>`;
}

function renderHeader() {
  const host = document.getElementById('site-header');
  if (!host) return;
  const role = me?.role;
  const links = [
    navLink('/', 'หน้าแรก'),
    navLink('/courses', 'คอร์สเรียน'),
  ];
  if (role === 'parent' || !me) links.push(navLink('/scores', 'คะแนนนักเรียน'));
  if (role === 'owner') links.push(navLink('/admin', 'หลังบ้าน'));
  if (role === 'teacher') links.push(navLink('/portal', 'จัดการนักเรียน'));
  links.push(navLink('/account', 'บัญชีของฉัน'));

  host.innerHTML = `
  <div class="header-inner">
    <a class="brand brand--default" href="#/">
      <span class="brand-mark brand-mark--sm"><img src="./assets/brand/logo-circle.png" alt=""></span>
      <span class="brand__words"><span class="brand__name">02._.book</span>
      <span class="brand__sub">จองคอร์สและดูคะแนน</span></span>
    </a>
    <nav class="main-nav">${links.join('')}</nav>
    <div class="header-actions">
      ${me
        ? `<a class="user-chip" href="#/account">${avatarHtml(me, 30)}
             <span class="user-chip__text"><b>${e(me.name || me.email || '')}</b>
             <span class="tiny dim">${role === 'owner' ? 'เจ้าของระบบ' : role === 'teacher' ? 'ครู' : 'ผู้ปกครอง'}</span></span></a>
           <button class="btn btn-ghost btn-sm" data-signout>ออก</button>`
        : `<a class="btn btn-primary btn-sm" href="#/login">เข้าสู่ระบบ</a>`}
    </div>
  </div>`;

  host.querySelector('[data-signout]')?.addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'ออกจากระบบ', message: 'ต้องการออกจากระบบใช่ไหม?', confirmLabel: 'ออกจากระบบ' });
    if (!ok) return;
    await data.signOut();
    location.hash = '#/';
  });
}

function renderFooter() {
  const host = document.getElementById('site-footer');
  if (!host) return;
  host.innerHTML = `
  <div class="footer-inner">
    <div>
      <div class="brand__name" style="font-size:15px">02._.book</div>
      <div class="tiny dim">จองคอร์สเรียนและติดตามคะแนนนักเรียน</div>
    </div>
    <div class="footer-links">
      <a href="#/courses">คอร์สเรียน</a>
      <a href="#/scores">คะแนนนักเรียน</a>
      <a href="#/account">บัญชีของฉัน</a>
    </div>
    <div class="tiny dim footer-contact">
      <div>IG : ${e(CONFIG.CONTACT.ig)}</div>
      <div>Line : ${e(CONFIG.CONTACT.line)}</div>
      <div>Phone : ${e(CONFIG.CONTACT.phone)}</div>
    </div>
  </div>`;
}

/* ── router ───────────────────────────────────────────── */
function parse() {
  const raw = (location.hash || '#/').replace(/^#/, '');
  const [path, query = ''] = raw.split('?');
  return { path: path || '/', query: new URLSearchParams(query), parts: path.split('/').filter(Boolean) };
}

const ctx = {
  data, me: null, settings,
  go: (path) => { location.hash = `#${path}`; },
  money, baht, statusBadge, avatarHtml,
  header: renderHeader,
  courseCard,
};

const ROUTES = [
  { test: (p) => p === '/', view: renderHome },
  { test: (p) => p === '/courses', view: renderHome },
  { test: (p) => p.startsWith('/course/'), view: renderCourse, key: 1 },
  { test: (p) => p.startsWith('/checkout/'), view: renderCheckout, key: 1 },
  { test: (p) => p === '/login', view: renderAuth },
  { test: (p) => p === '/teacher-login', view: renderTeacherAuth },
  { test: (p) => p === '/account', view: renderAccount, auth: true },
  { test: (p) => p === '/scores', view: renderScores, auth: true },
  { test: (p) => p.startsWith('/scores/'), view: renderScores, key: 1, auth: true },
  { test: (p) => p === '/admin', view: renderAdmin, auth: true, role: 'owner' },
  { test: (p) => p === '/portal', view: renderPortal, auth: true, role: 'teacher' },
];

export function courseCard(c) {
  const left = c.seats ? `${c.left} ที่นั่ง` : 'ไม่จำกัด';
  const low = c.seats && c.left <= 2;
  return `
  <a class="course-card" href="#/course/${c.id}">
    <div class="course-card__media">
      ${c.image_url
        ? `<img src="${escapeAttr(c.image_url)}" alt="" loading="lazy">`
        : `<div class="course-card__placeholder">${e((c.subject || 'คอร์ส').slice(0, 12))}</div>`}
    </div>
    <div class="course-card__body">
      <div class="tiny dim">${e(c.level || c.subject || '')}</div>
      <h3>${e(c.title)}</h3>
      <p class="tiny dim">${e(c.subtitle || '')}</p>
      <div class="course-card__foot">
        <span class="price">${baht(c.price)}</span>
        <span class="seat-badge${low ? ' is-low' : ''}">${e(left)}</span>
      </div>
    </div>
  </a>`;
}

async function render() {
  const route = parse();
  const match = ROUTES.find((r) => r.test(route.path)) || ROUTES[0];
  renderHeader();
  app.innerHTML = '<div class="page-loader"><span class="spinner"></span></div>';
  try {
    if (match.auth && !me) {
      // ถ้ามี session อยู่แต่โหลดโปรไฟล์ยังไม่เสร็จ ให้รอแล้วลองใหม่ก่อนเด้งไป login
      if (data.getUser()) {
        app.innerHTML = '<div class="page-loader"><span class="spinner"></span></div>';
        setTimeout(() => { render(); }, 1500);
        return;
      }
      location.hash = `#/login?next=${encodeURIComponent(route.path)}`;
      return;
    }
    if (match.role && me?.role !== match.role) {
      app.innerHTML = `<div class="wrap"><div class="empty"><b>ไม่มีสิทธิ์เข้าหน้านี้</b>
        <a class="btn btn-ghost btn-sm" href="#/">กลับหน้าแรก</a></div></div>`;
      return;
    }
    const arg = match.key ? route.parts[match.key] : null;
    const html = await match.view(arg, { ...ctx, me, settings, route });
    if (html) app.innerHTML = html;
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="wrap"><div class="empty"><b>โหลดไม่สำเร็จ</b>
      <p class="tiny dim">${e(err.message || '')}</p>
      <a class="btn btn-ghost btn-sm" href="#/">กลับหน้าแรก</a></div></div>`;
  }
  renderFooter();
}

/* ── boot ─────────────────────────────────────────────── */
async function boot() {
  try {
    await data.init();
  } catch (err) {
    console.error('เชื่อมต่อฐานข้อมูลไม่สำเร็จ', err);
  }
  me = data.getAccount();
  ctx.me = me;
  try { settings = await data.getSettings(); ctx.settings = settings; } catch (err) { console.warn(err); }

  data.onChange(async () => {
    me = data.getAccount();
    ctx.me = me;
    try { settings = await data.getSettings(); ctx.settings = settings; } catch (err) { /* ignore */ }
    await render();
  });

  window.addEventListener('hashchange', render);
  document.getElementById('site-header')?.addEventListener('click', (ev) => {
    if (ev.target.closest('a[href^="#/"]')) setTimeout(renderHeader, 2);
  });
  window.addEventListener('scroll', () => {
    document.getElementById('site-header')?.classList.toggle('is-scrolled', window.scrollY > 8);
  });
  await render();
}

boot();
