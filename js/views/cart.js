/* ── ตะกร้า / สถานะคำสั่งซื้อของผู้ปกครอง ──────────────── */

import { confirmDialog, toast } from '../ui.js';
import { e, thaiDateTime } from '../utils.js';

const GROUPS = [
  { key: 'pending_payment', label: 'ยังไม่ได้จ่ายเงิน', hint: 'กดชำระเงินต่อได้เลย หรือเอาออกจากตะกร้า' },
  { key: 'pending_confirm', label: 'รอยืนยัน', hint: 'ส่งสลิปแล้ว รอครูตรวจ' },
  { key: 'confirmed', label: 'จ่ายเงินแล้ว', hint: 'ครูยืนยันการชำระเรียบร้อย' },
];


/** ดาวน์โหลดประวัติการซื้อเป็น CSV (เปิดใน Excel ได้) */
function downloadOrdersCsv(rows) {
  const head = ['วันที่', 'คอร์ส', 'ผู้เรียน', 'ยอด (บาท)', 'ส่วนลด', 'โค้ด', 'สถานะ', 'วันยืนยัน'];
  const statusText = { confirmed: 'ยืนยันแล้ว', rejected: 'ไม่ผ่าน', pending_confirm: 'รอตรวจ', pending_payment: 'ยังไม่จ่าย' };
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [head.map(esc).join(',')];
  rows.forEach((o) => {
    lines.push([
      thaiDateTime(o.created_at),
      o.course_title || '',
      o.student_name || '',
      Number(o.amount || 0),
      Number(o.discount || 0),
      o.coupon_code || '',
      statusText[o.status] || o.status,
      o.confirmed_at ? thaiDateTime(o.confirmed_at) : '',
    ].map(esc).join(','));
  });
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ประวัติการซื้อ-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function renderCart(_arg, ctx) {
  if (!ctx.me) { location.hash = '#/login?next=%2Fcart'; return ''; }
  const orders = await ctx.data.listMyOrders();
  const rejected = orders.filter((o) => o.status === 'rejected');
  const historyCount = orders.filter((o) => o.status === 'confirmed' || o.status === 'rejected').length;

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

    root.querySelector('#dl-history')?.addEventListener('click', async () => {
      try {
        const rows = await ctx.data.listMyOrders();
        const done = rows.filter((o) => o.status === 'confirmed' || o.status === 'rejected');
        if (!done.length) { toast('ยังไม่มีประวัติให้ดาวน์โหลด', 'error'); return; }
        downloadOrdersCsv(done);
      } catch (err) { toast(err.message || 'ดาวน์โหลดไม่สำเร็จ', 'error'); }
    });

    root.querySelector('#clear-history')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'ลบประวัติที่จบแล้ว',
        message: 'ลบรายการที่ยืนยันแล้วและไม่ผ่านการตรวจทั้งหมด รวมไฟล์สลิปในระบบ — ลบแล้วกู้คืนไม่ได้ (แนะนำให้ดาวน์โหลดเก็บไว้ก่อน)',
        confirmLabel: 'ลบทั้งหมด', tone: 'danger',
      });
      if (!ok) return;
      try {
        const n = await ctx.data.clearMyOrderHistory();
        toast(`ลบประวัติแล้ว ${n} รายการ`, 'success');
        location.reload();
      } catch (err) { toast(err.message || 'ลบไม่สำเร็จ', 'error'); }
    });
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
    <div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">
      <a class="btn btn-ghost" href="#/courses">ดูคอร์สเพิ่ม</a>
      ${historyCount ? `<button class="btn btn-ghost" id="dl-history">ดาวน์โหลดประวัติ (Excel)</button>
      <button class="btn btn-ghost" id="clear-history" style="color:var(--red)">ลบประวัติที่จบแล้ว (${historyCount})</button>` : ''}
    </div>
  </div>`;
}
