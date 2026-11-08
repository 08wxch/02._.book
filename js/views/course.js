/* ── รายละเอียดคอร์ส + เริ่มซื้อ ──────────────────────── */

import { toast } from '../ui.js';
import { e } from '../utils.js';

export async function renderCourse(id, ctx) {
  const course = await ctx.data.getCourse(id);
  if (!course) {
    return `<div class="wrap" style="padding-top:40px"><div class="empty-soft">
      <b>ไม่พบคอร์สนี้</b><a class="btn btn-ghost btn-sm" href="#/courses">กลับไปหน้าคอร์ส</a></div></div>`;
  }

  const sold = await countSold(ctx, course.id);
  const left = course.seats ? Math.max(0, course.seats - sold) : null;
  const full = course.seats && left <= 0;
  const isOwner = ctx.me?.role === 'owner';

  // คูปองที่ผู้ปกครองแลกไว้และใช้กับคอร์สนี้ได้
  let coupons = [];
  if (ctx.me?.role === 'parent') {
    try {
      const mine = await ctx.data.listMyCoupons();
      coupons = (mine || []).filter((c) => c.status === 'available' && c.active
        && (!c.expires_at || new Date(c.expires_at) > new Date())
        && ((c.course_ids || []).length === 0 || c.course_ids.includes(course.id)));
    } catch (err) { coupons = []; }
  }

  const html = `
  <div class="wrap" style="padding-top:30px">
    <a class="tiny dim" href="#/courses" style="text-decoration:none">← กลับไปหน้าคอร์ส</a>
    <div class="book-grid-2" style="margin-top:16px">
      <div>
        <div class="book-card" style="padding:0;overflow:hidden">
          <div style="aspect-ratio:16/9;background:var(--mint-soft)">
            ${course.image_url
              ? `<img src="${e(course.image_url)}" alt="" style="width:100%;height:100%;object-fit:cover">`
              : `<div class="course-card__placeholder">${e(course.subject || 'คอร์ส')}</div>`}
          </div>
          <div style="padding:22px">
            <h1 style="font-family:var(--brand-font);font-size:28px;margin:8px 0 10px">${e(course.title)}</h1>
            <p style="color:var(--muted);margin:0 0 16px">${e(course.subtitle || '')}</p>
            ${course.detail ? `<div style="white-space:pre-wrap;line-height:1.75">${e(course.detail)}</div>` : ''}
          </div>
        </div>
      </div>

      <div class="book-card" style="position:sticky;top:84px">
        <div class="stat-card" style="border:0;padding:0;background:transparent">
          <div class="k">ราคาคอร์ส</div>
          <div class="v" style="font-size:32px">${ctx.baht(course.price)}</div>
        </div>
        <div style="margin:14px 0;display:flex;gap:8px;flex-wrap:wrap">
          ${course.hours ? `<span class="seat-badge">${course.hours} ชั่วโมง</span>` : ''}
          ${course.lessons ? `<span class="seat-badge">${course.lessons} ครั้ง</span>` : ''}
          ${course.seats ? `<span class="seat-badge${left <= 2 ? ' is-low' : ''}">เหลือ ${left} ที่นั่ง</span>` : '<span class="seat-badge">ไม่จำกัดที่นั่ง</span>'}
        </div>

        ${isOwner
          ? `<a class="btn btn-primary btn-block" href="#/admin?tab=courses&edit=${course.id}">แก้ไขคอร์สนี้ (เจ้าของระบบ)</a>`
          : full
            ? `<div class="empty-soft" style="padding:20px"><b>ที่นั่งเต็มแล้ว</b>
                 <p class="tiny dim">ติดต่อ Line : ${e(ctx.settings?.contact_line || '')} เพื่อรอรอบถัดไป</p></div>`
            : `<div class="field-row">
                 <label>ชื่อ-นามสกุลจริงของนักเรียน</label>
                 <input id="buy-student" placeholder="เช่น เด็กชายสมชาย ใจดี" maxlength="80">
               </div>
               <div class="field-row">
                 <label>หมายเหตุถึงครู (ไม่บังคับ)</label>
                 <input id="buy-note" placeholder="เช่น สะดวกเรียนวันเสาร์เช้า" maxlength="160">
               </div>
               ${coupons.length ? `<div class="field-row">
                 <label>ใช้บัตรส่วนลด</label>
                 <select id="buy-coupon">
                   <option value="">ไม่ใช้</option>
                   ${coupons.map((c) => `<option value="${e(c.code)}" data-kind="${e(c.kind)}" data-value="${e(String(c.value))}">
                     ${e(c.code)} — ${c.kind === 'percent' ? `ลด ${c.value}%` : `ลด ${ctx.baht(c.value)}`}
                   </option>`).join('')}
                 </select>
                 <div class="tiny dim" id="buy-preview" style="margin-top:4px"></div>
               </div>` : `<p class="hint" style="margin:0 0 10px">
                 <a href="#/coupons" style="color:inherit">มีโค้ดส่วนลด? แลกได้ที่นี่</a></p>`}
               <button class="btn btn-primary btn-block" id="buy-btn">ซื้อคอร์สนี้</button>
               <p class="hint" style="margin-top:10px">ขั้นต่อไปคือสแกน QR พร้อมเพย์และอัปโหลดสลิป</p>`}
      </div>
    </div>
  </div>`;

  setTimeout(() => {
    const app = document.getElementById('app');
    const couponSel = app.querySelector('#buy-coupon');
    couponSel?.addEventListener('change', () => {
      const opt = couponSel.selectedOptions[0];
      const price = Number(course.price || 0);
      const preview = app.querySelector('#buy-preview');
      if (!opt || !opt.value) { preview.textContent = ''; return; }
      const kind = opt.dataset.kind;
      const value = Number(opt.dataset.value || 0);
      const discount = kind === 'percent' ? Math.floor(price * value / 100) : Math.min(value, price);
      preview.innerHTML = `จะจ่าย <b>${ctx.baht(Math.max(price - discount, 0))}</b> (ประหยัด ${ctx.baht(discount)})`;
    });

    app.querySelector('#buy-btn')?.addEventListener('click', async (ev) => {
      if (!ctx.me) {
        location.hash = `#/login?next=${encodeURIComponent(`/course/${course.id}`)}`;
        return;
      }
      const student = app.querySelector('#buy-student')?.value.trim() || '';
      if (!student) { toast('กรุณากรอกชื่อนักเรียน', 'error'); return; }
      const btn = ev.currentTarget;
      btn.disabled = true;
      try {
        const order = await ctx.data.createOrder({
          courseId: course.id,
          studentName: student,
          note: app.querySelector('#buy-note')?.value.trim() || '',
          couponCode: app.querySelector('#buy-coupon')?.value || '',
        });
        location.hash = `#/checkout/${order.id}`;
      } catch (err) {
        btn.disabled = false;
        toast(err.message || 'สร้างคำสั่งซื้อไม่สำเร็จ', 'error');
      }
    });
  }, 0);

  return html;
}

async function countSold(ctx, courseId) {
  try {
    const all = await ctx.data.listAllOrders();
    return all.filter((o) => o.course_id === courseId && ['pending_confirm', 'confirmed'].includes(o.status)).length;
  } catch (err) {
    return 0;
  }
}
