/* ── เข้าสู่ระบบ / สมัคร (ผู้ปกครอง) และล็อกอินครู ──────── */

import { CONFIG } from '../config.js';
import { closeModal, openModal, toast } from '../ui.js';
import { e } from '../utils.js';

export async function renderAuth(_arg, ctx) {
  if (ctx.me) { location.hash = '#/'; return ''; }
  const next = ctx.route?.query.get('next') || '';

  const html = `
  <div class="wrap" style="max-width:520px;padding-top:56px">
    <div class="book-card">
      <div style="text-align:center;margin-bottom:18px">
        <div class="brand-mark brand-mark--lg"><img src="./assets/brand/logo-circle.png" alt=""></div>
        <h1 style="font-family:var(--brand-font);font-size:24px;margin:0 0 6px">เข้าสู่ระบบ / สมัครสมาชิก</h1>
        <p class="tiny dim" style="margin:0">ใช้บัญชีของคุณเพื่อซื้อคอร์สและดูคะแนนนักเรียน</p>
      </div>

      <div class="pill-tabs" id="auth-tabs">
        <button type="button" data-tab="login" class="is-active">เข้าสู่ระบบ</button>
        <button type="button" data-tab="signup">สมัครใหม่</button>
      </div>

      ${ctx.blocked ? `<div class="form-error is-visible"><span>${e(ctx.blocked)}</span></div>` : ''}
      <div id="auth-body"></div>

    </div>
  </div>`;

  setTimeout(() => setupAuth(ctx, next), 0);
  return html;
}

function setupAuth(ctx, next) {
  const root = document.getElementById('app');
  const body = root.querySelector('#auth-body');

  const loginForm = `
    <div class="field-row"><label>อีเมล</label>
      <input id="login-email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com"></div>
    <div class="field-row"><label>รหัสผ่าน</label>
      <input id="login-pass" type="password" autocomplete="current-password" placeholder="รหัสผ่าน"></div>
    <button class="btn btn-primary btn-block" id="do-login">เข้าสู่ระบบ</button>
    <p class="hint" style="margin-top:10px">ลืมรหัสผ่าน? ติดต่อ Line : ${e(CONFIG.CONTACT.lineId)} เพื่อรีเซ็ตรหัสผ่านใหม่</p>`;

  const signupForm = `
    <div class="field-row"><label>ชื่อ-นามสกุลผู้ปกครอง</label>
      <input id="su-name" placeholder="เช่น คุณแม่สมศรี ใจดี" maxlength="80"></div>
    <div class="field-row"><label>อีเมล</label>
      <input id="su-email" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com"></div>
    <div class="field-row"><label>รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)</label>
      <input id="su-pass" type="password" autocomplete="new-password" placeholder="ตั้งรหัสผ่าน"></div>
    <div class="field-row"><label>ยืนยันรหัสผ่านอีกครั้ง</label>
      <input id="su-pass2" type="password" autocomplete="new-password" placeholder="พิมพ์รหัสผ่านซ้ำ"></div>
    <div class="field-row"><label>เบอร์โทรติดต่อ</label>
      <input id="su-phone" inputmode="tel" placeholder="089-123-4567" maxlength="32"></div>
    <div class="field-row"><label>LINE ID (จำเป็น)</label>
      <input id="su-line" placeholder="line id ของคุณ" maxlength="60">
      <span class="hint">ถ้าแอดไลน์ด้วยเบอร์ ให้กรอกเบอร์ลงมาอีกครั้งในช่องนี้</span></div>
    <button class="btn btn-primary btn-block" id="do-signup">สมัครและเข้าใช้งาน</button>
    <p class="hint" style="margin-top:10px">ไม่ต้องยืนยันอีเมล — สมัครแล้วเข้าใช้งานได้ทันที
      (ภายหลังสามารถเปลี่ยนรหัสผ่านได้)</p>`;

  const paint = (tab) => {
    root.querySelectorAll('#auth-tabs button').forEach((b) => b.classList.toggle('is-active', b.dataset.tab === tab));
    body.innerHTML = tab === 'signup' ? signupForm : loginForm;
    bind(tab);
  };

  const goNext = () => { location.hash = `#${next || '/'}`; window.dispatchEvent(new HashChangeEvent('hashchange')); };

  function bind(tab) {
    if (tab === 'login') {
      const submit = async () => {
        const email = body.querySelector('#login-email').value.trim();
        const pass = body.querySelector('#login-pass').value;
        if (!email || !pass) { toast('กรอกอีเมลและรหัสผ่าน', 'error'); return; }
        const btn = body.querySelector('#do-login');
        btn.disabled = true; btn.textContent = 'กำลังเข้าสู่ระบบ…';
        try {
          await ctx.data.signInParent(email, pass);
          toast('เข้าสู่ระบบแล้ว', 'success');
          goNext();
        } catch (err) {
          btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ';
          toast(err.message || 'เข้าสู่ระบบไม่สำเร็จ', 'error');
        }
      };
      body.querySelector('#do-login').addEventListener('click', submit);
      body.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') submit(); }));
    } else {
      const submit = async () => {
        const payload = {
          name: body.querySelector('#su-name').value.trim(),
          email: body.querySelector('#su-email').value.trim(),
          password: body.querySelector('#su-pass').value,
          password2: body.querySelector('#su-pass2').value,
          phone: body.querySelector('#su-phone').value.trim(),
          lineId: body.querySelector('#su-line').value.trim(),
        };
        if (!payload.name) { toast('กรอกชื่อผู้ปกครอง', 'error'); return; }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email)) { toast('อีเมลไม่ถูกต้อง', 'error'); return; }
        if (payload.password.length < 6) { toast('รหัสผ่านอย่างน้อย 6 ตัวอักษร', 'error'); return; }
        if (payload.password !== payload.password2) { toast('รหัสผ่านทั้งสองช่องไม่ตรงกัน', 'error'); return; }
        if (!payload.phone) { toast('กรอกเบอร์โทรเพื่อให้ครูติดต่อกลับ', 'error'); return; }
        if (!payload.lineId) { toast('กรอก LINE ID (ถ้าแอดด้วยเบอร์ ให้กรอกเบอร์)', 'error'); return; }
        const btn = body.querySelector('#do-signup');
        btn.disabled = true; btn.textContent = 'กำลังสมัคร…';
        try {
          const acc = await ctx.data.signUpParent(payload);
          toast('สมัครสำเร็จ เข้าใช้งานได้เลย', 'success');
          if (acc && !(acc.org_ids || []).length) await askSchools(ctx);
          goNext();
        } catch (err) {
          btn.disabled = false; btn.textContent = 'สมัครและเข้าใช้งาน';
          toast(err.message || 'สมัครไม่สำเร็จ', 'error');
        }
      };
      body.querySelector('#do-signup').addEventListener('click', submit);
    }
  }

  root.querySelectorAll('#auth-tabs button').forEach((b) => {
    b.addEventListener('click', () => paint(b.dataset.tab));
  });
  paint('login');
}

/* ── ล็อกอินครู/เจ้าของ ด้วยรหัสจาก 02._.mock ──────────── */
export async function renderTeacherAuth(_arg, ctx) {
  if (ctx.me) { location.hash = '#/'; return ''; }

  const html = `
  <div class="wrap" style="max-width:480px;padding-top:56px">
    <div class="book-card">
      <h1 style="font-family:var(--brand-font);font-size:23px;margin:8px 0 6px">เข้าสู่ระบบสำหรับครู</h1>
      <p class="tiny dim" style="margin:0 0 18px">ใช้รหัสครูและรหัสผ่านชุดเดียวกับที่เข้า 02._.mock — ดึงจากรายชื่อบุคลากรโดยตรง</p>

      <div class="field-row"><label>รหัสครู</label>
        <input id="t-code" placeholder="เช่น 02._.math" autocomplete="username"></div>
      <div class="field-row"><label>รหัสผ่าน</label>
        <input id="t-pass" type="password" autocomplete="current-password" placeholder="รหัสผ่าน"></div>
      <button class="btn btn-primary btn-block" id="t-login">เข้าสู่ระบบ</button>

      <div style="border-top:1px solid var(--book-line);margin-top:16px;padding-top:14px;text-align:center">
        <a class="tiny dim" href="#/login">เป็นผู้ปกครอง? เข้าที่นี่</a>
      </div>
    </div>
  </div>`;

  setTimeout(() => {
    const root = document.getElementById('app');
    const submit = async () => {
      const code = root.querySelector('#t-code').value.trim();
      const pass = root.querySelector('#t-pass').value;
      if (!code || !pass) { toast('กรอกรหัสครูและรหัสผ่าน', 'error'); return; }
      const btn = root.querySelector('#t-login');
      btn.disabled = true; btn.textContent = 'กำลังเข้าสู่ระบบ…';
      try {
        const acc = await ctx.data.signInTeacher(code, pass);
        toast('เข้าสู่ระบบแล้ว', 'success');
        location.hash = acc?.role === 'owner' ? '#/admin' : '#/portal';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } catch (err) {
        btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ';
        toast(err.message || 'เข้าสู่ระบบไม่สำเร็จ', 'error');
      }
    };
    root.querySelector('#t-login').addEventListener('click', submit);
    root.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') submit(); }));

  }, 0);

  return html;
}

/** หลังสมัคร: ให้ผู้ปกครองเลือกโรงเรียน/หน่วยงานของลูก (เลือกได้หลายที่) */
export async function askSchools(ctx) {
  let orgs = [];
  try { orgs = await ctx.data.listOrganizations(); } catch (err) { orgs = []; }
  if (!orgs.length) return;

  return new Promise((resolve) => {
    const overlay = openModal({
      title: 'เลือกโรงเรียน/หน่วยงานของบุตรหลาน',
      size: 'sm',
      body: `
        <p class="tiny dim" style="margin:0 0 12px">เลือกได้มากกว่า 1 โรงเรียน — ใช้เพื่อให้ครูในโรงเรียนนั้นเห็นและเพิ่มรายชื่อนักเรียนของท่าน</p>
        <div class="school-list">
          ${orgs.map((o) => `<label class="check-line">
            <input type="checkbox" value="${o.id}">
            <span>${o.name}${o.type ? ` <span class="tiny dim">(${o.type === 'school' ? 'โรงเรียน' : 'หน่วยงาน'})</span>` : ''}</span>
          </label>`).join('')}
        </div>
        <p class="hint" style="margin-top:12px">หลังเลือกแล้ว ติดต่อครูหรือบุคลากรเพื่อเพิ่มรายชื่อนักเรียนของท่าน</p>`,
      footer: `<button class="btn btn-ghost" type="button" data-cancel>ข้ามไปก่อน</button>
               <button class="btn btn-primary" type="button" data-save>บันทึก</button>`,
      onMount: (root) => {
        root.querySelector('[data-save]')?.addEventListener('click', async () => {
          const ids = [...root.querySelectorAll('input[type=checkbox]:checked')].map((i) => i.value);
          try {
            await ctx.data.setMyOrgs(ids);
            if (ids.length) toast('บันทึกโรงเรียนแล้ว — ติดต่อครูเพื่อเพิ่มรายชื่อนักเรียน', 'success');
          } catch (err) {
            toast(err.message || 'บันทึกไม่สำเร็จ', 'error');
          }
          resolve(true);
          closeModal();
        });
        root.querySelector('[data-cancel]')?.addEventListener('click', async () => {
          resolve(false);
          closeModal();
        });
        root.querySelector('.modal__close')?.addEventListener('click', () => resolve(false));
      },
    });
    if (!overlay) resolve(false);
  });
}
