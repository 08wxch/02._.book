/* ── ชำระเงิน: QR พร้อมเพย์ + อัปโหลดสลิป ──────────────── */

import { toast } from '../ui.js';
import { e, thaiDateTime } from '../utils.js';
import { promptPayQrDataUrl } from '../promptpay.js';

export async function renderCheckout(orderId, ctx) {
  const order = await ctx.data.getOrder(orderId);
  if (!order) {
    return `<div class="wrap" style="padding-top:40px"><div class="empty-soft"><b>ไม่พบคำสั่งซื้อนี้</b>
      <a class="btn btn-ghost btn-sm" href="#/account">ไปที่บัญชีของฉัน</a></div></div>`;
  }
  const isMine = Boolean(ctx.me && order.user_id === ctx.me.user_id);
  if (!isMine) {
    return `<div class="wrap" style="padding-top:40px;max-width:560px"><div class="empty-soft">
      <b>คำสั่งซื้อนี้ไม่ใช่ของบัญชีคุณ</b>
      <p class="tiny dim" style="margin:0 0 12px">ผู้ปกครองเจ้าของคำสั่งซื้อเป็นผู้อัปโหลดสลิปและยืนยันการจ่ายเอง
        ${ctx.me?.role === 'owner' ? '— ถ้าต้องการตรวจสลิป ไปที่หลังบ้าน → รอยืนยัน' : ''}</p>
      ${ctx.me?.role === 'owner' ? '<a class="btn btn-primary btn-sm" href="#/admin?tab=orders">ไปที่หลังบ้าน</a>' : '<a class="btn btn-ghost btn-sm" href="#/account">กลับหน้าบัญชี</a>'}
    </div></div>`;
  }

  const s = ctx.settings || {};
  let qr = '';
  let qrError = '';
  try {
    qr = promptPayQrDataUrl({ id: s.promptpay_id, type: s.promptpay_type || 'phone', amount: order.amount }, 4);
  } catch (err) {
    qrError = err.message;
  }

  const done = order.status === 'pending_confirm' || order.status === 'confirmed';
  const slipView = order.slip_path ? await ctx.data.slipUrl(order.slip_path).catch(() => '') : '';

  const html = `
  <div class="wrap" style="padding-top:30px">
    <h1 style="font-family:var(--brand-font);font-size:28px;margin:8px 0 18px">ชำระเงินค่าคอร์ส</h1>

    <div class="book-grid-2">
      <div class="book-card">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div>
            <div style="font-family:var(--brand-font);font-size:18px">${e(order.course_title)}</div>
            <div class="tiny dim">ผู้เรียน ${e(order.student_name || '—')}</div>
            <div class="tiny dim">สร้างเมื่อ ${e(thaiDateTime(order.created_at))}</div>
            <div class="tiny" style="margin-top:6px">
              ${order.coupon_code
                ? `โค้ดส่วนลด <b>${e(order.coupon_title || order.coupon_code)}</b>
                   <span class="chip chip--ok">ประหยัด ${ctx.baht(order.discount || 0)}</span>`
                : '<span class="dim">ไม่ได้ใช้คูปอง</span>'}
            </div>
          </div>
          <div style="text-align:right">
            <div class="price" style="font-size:26px">${ctx.baht(order.amount)}</div>
            ${ctx.statusBadge(order.status)}
          </div>
        </div>

        ${done ? `
          <div class="empty-soft" style="margin-top:20px">
            <b>${order.status === 'confirmed' ? 'ยืนยันการชำระเงินเรียบร้อยแล้ว' : 'ส่งสลิปแล้ว รอครูยืนยัน'}</b>
            <p class="tiny dim">${order.status === 'confirmed'
              ? 'ครูจะติดต่อกลับตามเบอร์/LINE ที่คุณให้ไว้'
              : 'โดยปกติครูจะยืนยันภายใน 24 ชั่วโมง — ตรวจสอบได้ในหน้าประวัติการซื้อ'}</p>
            ${slipView ? `<img class="slip-thumb" src="${e(slipView)}" alt="สลิป" style="margin-top:10px">` : ''}
            <div style="margin-top:14px"><a class="btn btn-ghost btn-sm" href="#/account">ไปที่บัญชีของฉัน</a></div>
          </div>` : `
          <div style="margin-top:20px" id="pay-area">
            ${qr
              ? `<div class="qr-box">
                   <img src="${qr}" alt="PromptPay QR">
                   <div class="tiny dim">สแกนด้วยแอปธนาคาร · ยอด ${ctx.baht(order.amount)}</div>
                   <div class="tiny dim">พร้อมเพย์ ${e(s.promptpay_name || '')} · ${e(s.promptpay_id || '')}</div>
                 </div>`
              : `<div class="empty-soft"><b>ยังตั้งค่าพร้อมเพย์ไม่ได้</b><p class="tiny dim">${e(qrError)}</p></div>`}

            <div style="margin-top:18px">
              <label class="hint">อัปโหลดสลิปการโอน</label>
              <input type="file" accept="image/*" id="slip-file" style="margin-top:6px">
              <div id="slip-preview" style="margin-top:10px"></div>
              <button class="btn btn-green btn-block" id="slip-submit" style="margin-top:12px" disabled>ยืนยันการจ่ายเงิน</button>
            </div>
          </div>`}
      </div>

      <div class="book-card">
        <ol style="padding-left:18px;line-height:1.9;color:var(--muted);font-size:14px;margin:0">
          <li>เปิดแอปธนาคาร แล้วสแกน QR ด้านซ้าย</li>
          <li>โอนตามยอดที่แสดง (ระบบใส่ยอดให้อัตโนมัติ)</li>
          <li>แคปสลิป แล้วอัปโหลดในหน้านี้</li>
          <li>รอครูยืนยัน — สถานะจะขึ้น "ยืนยันแล้ว"</li>
        </ol>
        <div style="margin-top:16px" class="tiny dim">
          ติดปัญหาเรื่องการโอน ติดต่อ Line : ${e(s.contact_line || '')}<br>
          โทร ${e(s.contact_phone || '')}
        </div>
      </div>
    </div>
  </div>`;

  setTimeout(() => {
    const app = document.getElementById('app');
    const input = app.querySelector('#slip-file');
    const submit = app.querySelector('#slip-submit');
    if (!input || !submit) return;
    let file = null;

    input.addEventListener('change', () => {
      file = input.files?.[0] || null;
      const preview = app.querySelector('#slip-preview');
      if (!file) { preview.innerHTML = ''; submit.disabled = true; return; }
      if (!file.type.startsWith('image/')) { toast('กรุณาเลือกไฟล์รูปภาพ', 'error'); file = null; return; }
      if (file.size > 12 * 1024 * 1024) { toast('ไฟล์ใหญ่เกิน 12MB', 'error'); file = null; return; }
      preview.innerHTML = `<img class="slip-thumb" src="${URL.createObjectURL(file)}" alt="สลิป">`;
      submit.disabled = false;
    });

    submit.addEventListener('click', async () => {
      if (!file) return;
      submit.disabled = true;
      submit.textContent = 'กำลังอัปโหลด…';
      try {
        await ctx.data.uploadSlip(order.id, file);
        toast('ส่งสลิปแล้ว รอครูยืนยัน', 'success');
        location.hash = `#/checkout/${order.id}`;
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      } catch (err) {
        submit.disabled = false;
        submit.textContent = 'ยืนยันการจ่ายเงิน';
        toast(err.message || 'อัปโหลดไม่สำเร็จ', 'error');
      }
    });
  }, 0);

  return html;
}
