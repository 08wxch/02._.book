/* ── หน้าแลกบัตรส่วนลด (คูปอง) ของผู้ปกครอง ────────────── */

import { toast } from '../ui.js';
import { e, thaiDate } from '../utils.js';

export async function renderCoupons(_arg, ctx) {
  if (!ctx.me) { location.hash = '#/login?next=%2Fcoupons'; return ''; }

  const [mine, courses] = await Promise.all([
    ctx.data.listMyCoupons().catch(() => []),
    ctx.data.listCourses().catch(() => []),
  ]);
  const courseById = Object.fromEntries(courses.map((c) => [c.id, c]));

  const label = (c) => (c.kind === 'percent' ? `ลด ${c.value}%` : `ลด ${ctx.baht(c.value)}`);
  const scope = (c) => {
    const ids = c.course_ids || [];
    if (!ids.length) return 'ใช้ได้กับทุกคอร์ส';
    const names = ids.map((id) => courseById[id]?.title || 'คอร์สที่ถูกลบ').filter(Boolean);
    return `ใช้กับ: ${names.join(' · ')}`;
  };

  const available = mine.filter((c) => c.status === 'available' && c.active && !isExpired(c));
  const history = mine.filter((c) => !(c.status === 'available' && c.active && !isExpired(c)));

  const card = (c) => `
    <article class="coupon-card ${c.status === 'used' ? 'is-used' : ''} ${c.image_url ? 'has-image' : ''}">
      ${c.image_url
        ? `<img class="coupon-card__img" src="${e(c.image_url)}" alt="${e(c.title || c.code)}" loading="lazy">`
        : `<div class="coupon-card__body">
             <div class="coupon-card__title">${e(c.title || c.code)}</div>
             <div class="coupon-card__value">${c.kind === 'percent' ? `ลด ${c.value}%` : `ลด ${ctx.baht(c.value)}`}</div>
             <div class="tiny dim">${e(scope(c))}</div>
             ${c.min_amount ? `<div class="tiny dim">ยอดขั้นต่ำ ${ctx.baht(c.min_amount)}</div>` : ''}
             ${c.note ? `<div class="tiny dim">${e(c.note)}</div>` : ''}
             <div class="tiny dim">${c.expires_at ? `ใช้ได้ถึง ${e(thaiDate(c.expires_at))}` : 'ไม่มีวันหมดอายุ'}</div>
           </div>`}
      <div class="coupon-card__state">
        ${c.status === 'used'
          ? '<span class="chip chip--mute">ใช้แล้ว</span>'
          : isExpired(c) ? '<span class="chip chip--bad">หมดอายุ</span>'
          : '<span class="chip chip--ok">พร้อมใช้</span>'}
      </div>
    </article>`;

  return `
  <div class="wrap" style="padding-top:30px;max-width:820px">
    <h1 style="font-family:var(--brand-font);font-size:26px;margin:0 0 6px">บัตรส่วนลดของฉัน</h1>
    <p class="tiny dim" style="margin:0 0 20px">
      ได้โค้ดจากครูมาแล้ว? กรอกด้านล่างเพื่อเก็บเข้ากระเป๋า แล้วเลือกใช้ตอนซื้อคอร์ส</p>

    <div class="book-card" style="margin-bottom:22px">
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <div class="field-row" style="flex:1;min-width:220px;margin:0">
          <label>รหัสส่วนลด</label>
          <input id="coupon-code" placeholder="เช่น MATH100" maxlength="24" autocomplete="off"
            style="text-transform:uppercase">
        </div>
        <button class="btn btn-primary" id="coupon-claim">แลกโค้ด</button>
      </div>
      <p class="hint" style="margin-top:10px">
        ถ้าแลกไม่ได้ ให้ตรวจว่าพิมพ์ตรงกับที่ครูส่งมา หรือติดต่อ Line : ${e(ctx.settings?.contact_line || '')}</p>
    </div>

    <h2 style="font-family:var(--brand-font);font-size:18px;margin:0 0 12px">พร้อมใช้ (${available.length})</h2>
    ${available.length ? `<div class="coupon-grid">${available.map(card).join('')}</div>`
      : `<div class="empty-soft" style="margin-bottom:22px"><b>ยังไม่มีบัตรส่วนลดที่ใช้ได้</b>
           <p class="tiny dim" style="margin:0">กรอกรหัสที่ได้รับจากครูด้านบนเพื่อแลกได้เลย</p></div>`}

    ${history.length ? `
      <h2 style="font-family:var(--brand-font);font-size:18px;margin:22px 0 12px">ประวัติ (${history.length})</h2>
      <div class="coupon-grid">${history.map(card).join('')}</div>` : ''}
  </div>`;
}

function isExpired(c) {
  return c.expires_at ? new Date(c.expires_at) < new Date() : false;
}

export function bindCoupons(ctx) {
  const root = document.getElementById('app');
  const input = root?.querySelector('#coupon-code');
  const btn = root?.querySelector('#coupon-claim');
  if (!btn) return;
  const submit = async () => {
    const code = input.value.trim();
    if (!code) { toast('กรุณากรอกรหัสส่วนลด', 'error'); return; }
    btn.disabled = true;
    btn.textContent = 'กำลังแลก…';
    try {
      const res = await ctx.data.claimCoupon(code);
      toast(`แลกโค้ด ${res?.code || code} แล้ว — ใช้ได้ตอนซื้อคอร์ส`, 'success');
      const mod = await import('./coupons.js');
      const html = await mod.renderCoupons(null, ctx);
      root.innerHTML = html;
      bindCoupons(ctx);
    } catch (err) {
      toast(err.message || 'แลกโค้ดไม่สำเร็จ', 'error');
      btn.disabled = false;
      btn.textContent = 'แลกโค้ด';
    }
  };
  btn.addEventListener('click', submit);
  input?.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') submit(); });
}
