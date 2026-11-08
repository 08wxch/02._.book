/* ── 02._.book — จองคอร์สเรียนและดูคะแนนนักเรียน ─────────── */

import { CONFIG } from './config.js';
import * as data from './data.js';
import { badge, closeModal, confirmDialog, emptyState, escapeAttr, openModal, sectionHeading, toast } from './ui.js';
import { e, formatNumber, longThaiDate, percent as pct, thaiDate, thaiDateTime, avatarTone, initials } from './utils.js';
import { renderHome } from './views/home.js';
import { renderCourse } from './views/course.js';
import { renderCheckout } from './views/checkout.js';
import { renderAuth } from './views/auth.js';
import { renderScores, renderExamDetail } from './views/account.js';
import { renderCoupons, bindCoupons } from './views/coupons.js';
import { renderCart } from './views/cart.js';

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
  const here = (location.hash.replace(/^#/, '').split('?')[0] || '/');
  const active = (path === '/' ? here === '/' : here === path || here.startsWith(`${path}/`)) ? ' is-active' : '';
  return `<a class="nav-link${active}" href="#${path}"${active ? ' aria-current="page"' : ''}>${e(label)}</a>`;
}

function renderHeader() {
  const host = document.getElementById('site-header');
  if (!host) return;
  const role = me?.role;
  const links = [];
  links.push(navLink('/', 'หน้าแรก'));
  links.push(navLink('/courses', 'คอร์สเรียน'));
  if (role === 'parent' || !me) {
    links.push(navLink('/scores', 'คะแนนนักเรียน'));
    links.push(navLink('/coupons', 'บัตรส่วนลด'));
    links.push(navLink('/cart', 'ตะกร้า'));
  }

  if (role === 'owner') links.push(navLink('/admin', 'หลังบ้าน'));
  if (role === 'teacher') links.push(navLink('/portal', 'จัดการนักเรียน'));


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
        ? `<button class="user-chip" id="profile-btn" title="ข้อมูลของฉัน">${avatarHtml(me, 30)}
             <span class="user-chip__text"><b>${e(me.name || me.email || '')}</b>
             <span class="tiny dim">ผู้ปกครอง</span></span></button>`
        : `<a class="btn btn-primary btn-sm" href="#/login">เข้าสู่ระบบ</a>`}
    </div>
  </div>`;

  host.querySelector('#profile-btn')?.addEventListener('click', openProfile);

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


/* ── โปรไฟล์ของฉัน (modal) ─────────────────────────────── */
export function openProfile() {
  const acc = data.getAccount() || {};
  const dots = (v) => '•'.repeat(Math.max(6, Math.min(14, String(v || '').length || 8)));

  openModal({
    title: 'ข้อมูลของฉัน',
    size: 'sm',
    body: `
      <div class="kv"><span>อีเมล</span><b>${e(acc.email || '')}</b></div>
      <div class="kv"><span>บทบาท</span><b>ผู้ปกครอง</b></div>
      <div class="field-row" style="margin-top:10px"><label>ชื่อที่แสดง</label>
        <input id="pf-name" value="${e(acc.name || '')}" maxlength="80"></div>
      <div class="field-row"><label>เบอร์โทร</label>
        <input id="pf-phone" value="${e(acc.phone || '')}" maxlength="32" placeholder="089-123-4567"></div>
      <div class="field-row"><label>LINE ID</label>
        <input id="pf-line" value="${e(acc.line_id || '')}" maxlength="60"></div>
      <button class="btn btn-ghost btn-block btn-sm" id="pf-save">บันทึกข้อมูล</button>

      <div style="border-top:1px solid var(--book-line);margin-top:16px;padding-top:14px">
        <div style="font-family:var(--brand-font);font-size:15px;margin-bottom:8px">รหัสผ่าน</div>

        <div class="pass-row">
          <input class="input" id="pf-current" readonly
            data-real="${e(acc.password_plain || '')}" value="${acc.password_plain ? dots(acc.password_plain) : '—'}">
          <button class="icon-btn" id="pf-eye" type="button" title="ดูรหัสผ่าน" aria-label="ดูรหัสผ่าน"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></button>
          <button class="icon-btn" id="pf-pencil" type="button" title="เปลี่ยนรหัสผ่าน" aria-label="เปลี่ยนรหัสผ่าน"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg></button>
        </div>
        <p class="hint" style="margin-top:6px">กดรูปตาเพื่อดูรหัสปัจจุบัน · กดรูปดินสอเมื่อต้องการเปลี่ยน</p>

        <div id="pf-change" style="display:none;margin-top:12px">
          <div class="field-row"><label>รหัสผ่านใหม่</label>
            <input id="pf-pass" type="password" autocomplete="new-password" placeholder="อย่างน้อย 6 ตัวอักษร"></div>
          <div class="field-row"><label>ยืนยันรหัสผ่านใหม่</label>
            <input id="pf-pass2" type="password" autocomplete="new-password" placeholder="พิมพ์รหัสใหม่อีกครั้ง"></div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost btn-sm" id="pf-cancel" style="flex:1">ยกเลิก</button>
            <button class="btn btn-primary btn-sm" id="pf-pass-save" style="flex:1">บันทึก</button>
          </div>
        </div>
      </div>`,
    footer: `<button class="btn btn-ghost" type="button" data-signout>ออกจากระบบ</button>
             <button class="btn btn-ghost" type="button" data-modal-close>ปิด</button>`,
    onMount: (root) => {
      const current = root.querySelector('#pf-current');
      root.querySelector('#pf-eye')?.addEventListener('click', () => {
        const real = current.dataset.real || '';
        if (!real) return;
        current.value = current.value.includes('•') ? real : dots(real);
      });
      root.querySelector('#pf-pencil')?.addEventListener('click', () => {
        const box = root.querySelector('#pf-change');
        box.style.display = box.style.display === 'none' ? '' : 'none';
      });
      root.querySelector('#pf-cancel')?.addEventListener('click', () => {
        root.querySelector('#pf-change').style.display = 'none';
        root.querySelector('#pf-pass').value = '';
        root.querySelector('#pf-pass2').value = '';
      });

      root.querySelector('#pf-save')?.addEventListener('click', async (ev) => {
        ev.currentTarget.disabled = true;
        try {
          await data.updateAccount({
            name: root.querySelector('#pf-name').value.trim(),
            phone: root.querySelector('#pf-phone').value.trim(),
            line_id: root.querySelector('#pf-line').value.trim(),
          });
          toast('บันทึกแล้ว', 'success');
          renderHeader();
        } catch (err) { toast(err.message || 'บันทึกไม่สำเร็จ', 'error'); }
        finally { ev.currentTarget.disabled = false; }
      });

      root.querySelector('#pf-pass-save')?.addEventListener('click', async (ev) => {
        const p1 = root.querySelector('#pf-pass').value;
        const p2 = root.querySelector('#pf-pass2').value;
        if (p1.length < 6) { toast('รหัสผ่านอย่างน้อย 6 ตัวอักษร', 'error'); return; }
        if (p1 !== p2) { toast('รหัสผ่านทั้งสองช่องไม่ตรงกัน', 'error'); return; }
        ev.currentTarget.disabled = true;
        try {
          await data.changePassword(p1);
          current.dataset.real = p1;
          current.value = dots(p1);
          root.querySelector('#pf-pass').value = '';
          root.querySelector('#pf-pass2').value = '';
          root.querySelector('#pf-change').style.display = 'none';
          toast('เปลี่ยนรหัสผ่านแล้ว', 'success');
        } catch (err) { toast(err.message || 'ไม่สำเร็จ', 'error'); }
        finally { ev.currentTarget.disabled = false; }
      });

      root.querySelector('[data-signout]')?.addEventListener('click', async () => {
        const ok = await confirmDialog({ title: 'ออกจากระบบ', message: 'ต้องการออกจากระบบใช่ไหม?', confirmLabel: 'ออกจากระบบ' });
        if (!ok) return;
        await data.signOut();
        closeModal();
        location.hash = '#/';
      });
    },
  });
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
  { test: (p) => p === '/coupons', view: renderCoupons, auth: true, after: (c) => bindCoupons(c) },
  { test: (p) => p === '/cart', view: renderCart, auth: true },
  { test: (p) => p === '/scores', view: renderScores, auth: true },
  { test: (p) => p.startsWith('/scores/') && p.includes('/exam/'), view: renderExamDetail, auth: true },
  { test: (p) => p.startsWith('/scores/'), view: renderScores, key: 1, auth: true },
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
    const allowed = match.role ? (Array.isArray(match.role) ? match.role : [match.role]) : null;
    if (allowed && !allowed.includes(me?.role)) {
      app.innerHTML = `<div class="wrap"><div class="empty"><b>ไม่มีสิทธิ์เข้าหน้านี้</b>
        <a class="btn btn-ghost btn-sm" href="#/">กลับหน้าแรก</a></div></div>`;
      return;
    }
    const arg = match.key ? route.parts[match.key] : null;
    document.body.dataset.role = me?.role || 'anon';
    const consoleish = match.shell === 'console'
      || (route.path === '/account' && (me?.role === 'owner' || me?.role === 'teacher'));
    document.body.dataset.shell = consoleish ? 'console' : 'page';
    const html = await match.view(arg, { ...ctx, me, settings, route });
    if (html) app.innerHTML = html;
    if (typeof match.after === 'function') match.after(ctx);
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="wrap"><div class="empty"><b>โหลดไม่สำเร็จ</b>
      <p class="tiny dim">${e(err.message || '')}</p>
      <a class="btn btn-ghost btn-sm" href="#/">กลับหน้าแรก</a></div></div>`;
  }
  bindConsoleSignout();
  renderFooter();
}

function bindConsoleSignout() {
  document.querySelectorAll('[data-signout]').forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'ออกจากระบบ', message: 'ต้องการออกจากระบบใช่ไหม?', confirmLabel: 'ออกจากระบบ' });
      if (!ok) return;
      await data.signOut();
      location.hash = '#/';
    });
  });
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
