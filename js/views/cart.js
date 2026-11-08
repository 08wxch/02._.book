/* ── ตะกร้า / สถานะคำสั่งซื้อของผู้ปกครอง ──────────────── */

import { confirmDialog, toast } from '../ui.js';
import { e, thaiDateTime } from '../utils.js';

const GROUPS = [
  { key: 'pending_payment', label: 'ยังไม่ได้จ่ายเงิน', hint: 'กดชำระเงินต่อได้เลย หรือเอาออกจากตะกร้า' },
  { key: 'pending_confirm', label: 'รอยืนยัน', hint: 'ส่งสลิปแล้ว รอครูตรวจ' },
  { key: 'confirmed', label: 'จ่ายเงินแล้ว', hint: 'ครูยืนยันการชำระเรียบร้อย' },
];

export async function renderCart(_arg, ctx) {
  if (!ctx.me) { location.hash = '#/login?next=%2Fcart'; return ''; }
  const orders = await ctx.data.listMyOrders();
  const rejected = orders.filter((o) => o.status === 'rejected');

  const item = (o) => `
    <div class="cart-item">
      <div style="min-width:0">
        <div style="font-family:var(--brand-font);font-size:15px">${e(o.course_title)}</div>
        <div class="tiny dim">ผู้เรียน ${e(o.student_name || '—')} · ${e(thaiDateTime(o.created_at))}</div>
        ${o.coupon_code ? `<div class="tiny dim">ใช้โค้ด ${e(o.coupon_code)} · ประหยัด ${ctx.baht(o.discount || 0)}</div>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <div class="exam-score">${ctx.baht(o.amount)}</div>
        ${o.status === 'pending_payment'
          ? `<a class="btn btn-primary btn-sm" href="#/checkout/${o.id}">ชำระเงิน</a>
             <button class="btn btn-ghost btn-sm" data-remove="${o.id}" style="color:var(--red)">เอาออก</button>`
          : `<a class="btn btn-ghost btn-sm" href="#/checkout/${o.id}">ดูรายละเอียด</a>`}
      </div>
    </div>`;

  const sections = GROUPS.map((g) => {
    const list = orders.filter((o) => o.status === g.key);
    return `
    <section class="book-card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;flex-wrap:wrap">
        <div style="font-family:var(--brand-font);font-size:16px">${g.label} (${list.length})</div>
        <div class="tiny dim">${g.hint}</div>
      </div>
      ${list.length ? `<div style="margin-top:8px">${list.map(item).join('')}</div>`
        : '<p class="tiny dim" style="margin:8px 0 0">— ไม่มีรายการ —</p>'}
    </section>`;
  }).join('');

  setTimeout(() => {
    const root = document.getElementById('app');
    root.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'เอาออกจากตะกร้า',
          message: 'ลบคำสั่งซื้อที่ยังไม่ได้จ่ายนี้ออก? กดซื้อใหม่ได้ตลอด',
          confirmLabel: 'เอาออก', tone: 'danger',
        });
        if (!ok) return;
        try {
          await ctx.data.deleteOrder(btn.dataset.remove);
          toast('เอาออกจากตะกร้าแล้ว', 'success');
          location.reload();
        } catch (err) { toast(err.message || 'ลบไม่สำเร็จ', 'error'); }
      });
    });
  }, 0);

  return `
  <div class="wrap" style="padding-top:28px;max-width:900px">
    <h1 style="font-family:var(--brand-font);font-size:26px;margin:0 0 6px">ประวัติการซื้อ</h1>
    <p class="tiny dim" style="margin:0 0 18px">ทุกคอร์สที่คุณเลือกไว้ พร้อมสถานะล่าสุด</p>
    ${sections}
    ${rejected.length ? `<section class="book-card">
      <div style="font-family:var(--brand-font);font-size:16px">ไม่ผ่านการตรวจ (${rejected.length})</div>
      <div style="margin-top:8px">${rejected.map(item).join('')}</div>
    </section>` : ''}
    <div style="margin-top:16px"><a class="btn btn-ghost" href="#/courses">ดูคอร์สเพิ่ม</a></div>
  </div>`;
}
