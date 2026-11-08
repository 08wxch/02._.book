/* ── หลังบ้านเจ้าของระบบ ───────────────────────────────── */

import { toast, confirmDialog } from '../ui.js';
import { e, thaiDate, thaiDateTime } from '../utils.js';

export async function renderAdmin(_arg, ctx) {
  const tab = ctx.route?.query.get('tab') || 'orders';
  const editId = ctx.route?.query.get('edit') || '';

  const [orders, courses, accounts, links, roster, coupons] = await Promise.all([
    ctx.data.listAllOrders(),
    ctx.data.listCourses({ all: true }),
    ctx.data.listAccounts(),
    ctx.data.listAllLinks(),
    ctx.data.listMockRoster().catch(() => ({ students: [], organizations: [] })),
    ctx.data.listCoupons().catch(() => []),
  ]);

  const parents = accounts.filter((a) => a.role === 'parent');
  const teachers = accounts.filter((a) => a.role === 'teacher');
  const pendingCount = orders.filter((o) => o.status === 'pending_confirm').length;
  const paid = orders.filter((o) => o.status === 'confirmed').reduce((s, o) => s + Number(o.amount || 0), 0);

  const items = [
    { id: 'orders', label: 'รอยืนยัน', count: pendingCount || '' },
    { id: 'courses', label: 'คอร์สเรียน' },
    { id: 'coupons', label: 'บัตรส่วนลด' },
    { id: 'users', label: 'ผู้ใช้งาน' },
    { id: 'links', label: 'นักเรียน' },
    { id: 'settings', label: 'ตั้งค่า' },
  ].map((it) => ({ ...it, href: `#/admin?tab=${it.id}`, active: tab === it.id }));

  ctx._roster = roster;

  const body = tab === 'orders'
    ? ordersHtml(orders, ctx)
    : tab === 'courses'
      ? coursesHtml(courses, editId, ctx)
      : tab === 'coupons'
        ? couponsHtml(coupons, courses, editId, ctx)
        : tab === 'users'
        ? usersHtml(parents, teachers, ctx)
        : tab === 'links'
          ? linksHtml(parents, links, roster, ctx)
          : settingsHtml(ctx);

  const html = ctx.consoleLayout({
    items,
    title: 'หลังบ้าน',
    subtitle: 'ยืนยันการชำระเงิน จัดการคอร์ส และผูกนักเรียนให้ผู้ปกครอง',
    body: `
      <div class="stat-row">
        <div class="stat-card"><div class="k">รอยืนยัน</div><div class="v">${pendingCount}<small>รายการ</small></div></div>
        <div class="stat-card"><div class="k">ยืนยันแล้ว</div><div class="v">${orders.filter((o) => o.status === 'confirmed').length}<small>รายการ</small></div></div>
        <div class="stat-card"><div class="k">ยอดรับชำระ</div><div class="v">${ctx.baht(paid)}</div></div>
        <div class="stat-card"><div class="k">ผู้ปกครอง</div><div class="v">${parents.length}<small>คน</small></div></div>
        <div class="stat-card"><div class="k">โค้ดส่วนลดที่เปิด</div><div class="v">${coupons.filter((c) => c.active).length}<small>โค้ด</small></div></div>
      </div>
      ${body}
    `,
  });

  setTimeout(() => bindAdmin(ctx, tab), 0);
  return html;
}

/* ── รอยืนยัน ─────────────────────────────────────────── */
function ordersHtml(orders, ctx) {
  const pending = orders.filter((o) => o.status === 'pending_confirm');
  const history = orders.filter((o) => o.status !== 'pending_confirm').slice(0, 30);
  return `
  <div class="book-card" style="margin-bottom:20px">
    <div style="font-family:var(--brand-font);font-size:16px;margin-bottom:10px">รอตรวจสลิป (${pending.length})</div>
    ${pending.length ? pending.map((o) => `
      <div class="q-row" style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start" id="row-${o.id}">
        <div id="thumb-${o.id}">
          <div class="slip-thumb" style="display:grid;place-items:center;font-size:11px;color:var(--muted)">กำลังโหลด…</div>
        </div>
        <div style="flex:1;min-width:220px">
          <div style="font-family:var(--brand-font);font-size:16px">${e(o.course_title)}</div>
          <div class="tiny dim">ผู้เรียน ${e(o.student_name || '—')}</div>
          <div class="tiny dim">ผู้ปกครอง ${e(o.parent?.name || '—')} · ${e(o.parent?.phone || '')} · ${e(o.parent?.line_id || '')}</div>
          <div class="tiny dim">${e(thaiDateTime(o.created_at))}</div>
          <div style="margin-top:6px" class="price">${ctx.baht(o.amount)}</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" data-download="${o.id}">ดาวน์โหลดสลิป</button>
          <button class="btn btn-primary btn-sm" data-confirm="${o.id}">ยืนยัน</button>
          <button class="btn btn-ghost btn-sm" data-reject="${o.id}" style="color:var(--red)">ไม่ผ่าน</button>
        </div>
      </div>`).join('')
      : `<p class="tiny dim">ยังไม่มีรายการรอยืนยัน</p>`}
  </div>

  <div class="book-card">
    <div style="font-family:var(--brand-font);font-size:16px;margin-bottom:10px">ประวัติล่าสุด</div>
    <div class="table-wrap"><table class="book-table">
      <thead><tr><th>วันที่</th><th>ผู้ปกครอง</th><th>คอร์ส</th><th>ผู้เรียน</th><th>ยอด</th><th>สถานะ</th></tr></thead>
      <tbody>${history.map((o) => `<tr>
        <td class="tiny">${e(thaiDate(o.created_at))}</td>
        <td>${e(o.parent?.name || '—')}<div class="tiny dim">${e(o.parent?.email || '')}</div></td>
        <td>${e(o.course_title)}</td>
        <td>${e(o.student_name || '—')}</td>
        <td>${ctx.baht(o.amount)}</td>
        <td>${ctx.statusBadge(o.status)}</td>
      </tr>`).join('') || '<tr><td colspan="6" class="tiny dim">ยังไม่มีประวัติ</td></tr>'}</tbody>
    </table></div>
  </div>`;
}

/* ── คอร์ส ───────────────────────────────────────────── */
function coursesHtml(courses, editId, ctx) {
  const editing = courses.find((c) => c.id === editId);
  return `
  <div class="book-grid-2">
    <div class="book-card">
      <div style="font-family:var(--brand-font);font-size:16px;margin-bottom:10px">คอร์สทั้งหมด (${courses.length})</div>
      <div class="table-wrap"><table class="book-table">
        <thead><tr><th>คอร์ส</th><th>ราคา</th><th>ที่นั่ง</th><th>สถานะ</th><th></th></tr></thead>
        <tbody>${courses.map((c) => `<tr>
          <td>${e(c.title)}<div class="tiny dim">${e(c.level || '')}</div></td>
          <td>${ctx.baht(c.price)}</td>
          <td>${c.seats ? `${c.seats} ที่นั่ง` : 'ไม่จำกัด'}</td>
          <td>${c.active ? '<span class="seat-badge">เปิดขาย</span>' : '<span class="seat-badge is-low">ปิด</span>'}</td>
          <td style="white-space:nowrap">
            <a class="btn btn-ghost btn-sm" href="#/admin?tab=courses&edit=${c.id}">แก้ไข</a>
            <button class="btn btn-ghost btn-sm" data-del-course="${c.id}" style="color:var(--red)">ลบ</button>
          </td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>

    <div class="book-card">
      <div style="font-family:var(--brand-font);font-size:16px;margin-bottom:10px">${editing ? 'แก้ไขคอร์ส' : 'เพิ่มคอร์สใหม่'}</div>
      <input type="hidden" id="c-id" value="${editing ? editing.id : ''}">
      <div class="field-row"><label>ชื่อคอร์ส</label><input id="c-title" value="${e(editing?.title || '')}"></div>
      <div class="field-row"><label>คำโปรยสั้น</label><input id="c-sub" value="${e(editing?.subtitle || '')}"></div>
      <div class="field-row"><label>รายละเอียด</label><textarea id="c-detail">${e(editing?.detail || '')}</textarea></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field-row"><label>ราคา (บาท)</label><input id="c-price" type="number" min="0" step="50" value="${Number(editing?.price || 0)}"></div>
        <div class="field-row"><label>ชั่วโมง</label><input id="c-hours" type="number" min="0" value="${Number(editing?.hours || 0)}"></div>
        <div class="field-row"><label>จำนวนครั้ง</label><input id="c-lessons" type="number" min="0" value="${Number(editing?.lessons || 0)}"></div>
      </div>
      <div class="field-row">
        <label>จำนวนที่นั่ง</label>
        <label class="check-line">
          <input type="checkbox" id="c-unlimited" ${!editing || !Number(editing?.seats) ? 'checked' : ''}>
          <span>ไม่จำกัดจำนวนคน (เรียนได้เรื่อย ๆ)</span>
        </label>
        <input id="c-seats" type="number" min="1" value="${Number(editing?.seats || 8)}"
          ${!editing || !Number(editing?.seats) ? 'disabled' : ''} placeholder="เช่น 8">
        <div class="tiny dim">ถ้าไม่ติ๊ก "ไม่จำกัด" ระบบจะหยุดรับเมื่อเต็มจำนวน</div>
      </div>
      <div class="field-row"><label>ระดับชั้น</label><input id="c-level" value="${e(editing?.level || '')}" placeholder="เช่น ม.4–ม.6"></div>
      <div class="field-row"><label>รูปปก (URL หรืออัปโหลด)</label>
        <input id="c-img" value="${e(editing?.image_url || '')}" placeholder="https://...">
        <input type="file" id="c-img-file" accept="image/*" style="margin-top:6px">
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-primary" id="c-save">${editing ? 'บันทึกการแก้ไข' : 'เพิ่มคอร์ส'}</button>
        ${editing ? `<a class="btn btn-ghost" href="#/admin?tab=courses">ยกเลิก</a>` : ''}
      </div>
    </div>
  </div>`;
}


/* ── บัตรส่วนลด ───────────────────────────────────────── */
function couponsHtml(coupons, courses, editId, ctx) {
  const editing = coupons.find((c) => c.id === editId);
  const courseName = (id) => courses.find((c) => c.id === id)?.title || '—';
  const scopeText = (c) => ((c.course_ids || []).length
    ? c.course_ids.map(courseName).join(' · ')
    : 'ทุกคอร์ส');
  const valueText = (c) => (c.kind === 'percent' ? `ลด ${c.value}%` : `ลด ${ctx.baht(c.value)}`);

  return `
  <div class="book-grid-2">
    <div class="book-card">
      <div style="font-family:var(--brand-font);font-size:16px;margin-bottom:10px">โค้ดทั้งหมด (${coupons.length})</div>
      ${coupons.length ? `<div class="table-wrap"><table class="book-table coupon-table">
        <thead><tr><th>โค้ด</th><th>ส่วนลด</th><th>ใช้กับ</th><th>ใช้แล้ว</th><th>สถานะ</th><th></th></tr></thead>
        <tbody>${coupons.map((c) => `<tr>
          <td><b>${e(c.code)}</b><div class="tiny dim">${e(c.note || '')}</div></td>
          <td>${e(valueText(c))}</td>
          <td class="tiny">${e(scopeText(c))}</td>
          <td class="num">${c.used || 0}${c.max_uses ? ` / ${c.max_uses}` : ''}</td>
          <td>${c.active ? '<span class="chip chip--ok">เปิด</span>' : '<span class="chip chip--mute">ปิด</span>'}</td>
          <td style="white-space:nowrap">
            <a class="btn btn-ghost btn-sm" href="#/admin?tab=coupons&edit=${c.id}">แก้ไข</a>
            <button class="btn btn-ghost btn-sm" data-del-coupon="${c.id}" style="color:var(--red)">ลบ</button>
          </td>
        </tr>`).join('')}</tbody>
      </table></div>` : `<p class="tiny dim">ยังไม่มีโค้ดส่วนลด</p>`}
    </div>

    <div class="book-card">
      <div style="font-family:var(--brand-font);font-size:16px;margin-bottom:10px">${editing ? 'แก้ไขโค้ด' : 'สร้างโค้ดใหม่'}</div>
      <input type="hidden" id="cp-id" value="${editing ? editing.id : ''}">
      <div class="field-row"><label>โค้ด (ตัวอักษร/ตัวเลข)</label>
        <input id="cp-code" value="${e(editing?.code || '')}" placeholder="MATH100" style="text-transform:uppercase"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field-row"><label>ประเภท</label>
          <select id="cp-kind">
            <option value="percent" ${editing?.kind !== 'amount' ? 'selected' : ''}>เปอร์เซ็นต์</option>
            <option value="amount" ${editing?.kind === 'amount' ? 'selected' : ''}>จำนวนเงิน (บาท)</option>
          </select></div>
        <div class="field-row"><label>มูลค่า</label>
          <input id="cp-value" type="number" min="0" value="${Number(editing?.value || 0)}"></div>
        <div class="field-row"><label>ยอดขั้นต่ำ (บาท)</label>
          <input id="cp-min" type="number" min="0" value="${Number(editing?.min_amount || 0)}"></div>
        <div class="field-row"><label>ใช้ได้สูงสุด (0 = ไม่จำกัด)</label>
          <input id="cp-max" type="number" min="0" value="${Number(editing?.max_uses || 0)}"></div>
      </div>
      <div class="field-row"><label>ใช้กับคอร์ส (ไม่เลือก = ทุกคอร์ส)</label>
        <select id="cp-courses" multiple size="${Math.min(5, Math.max(3, courses.length))}" style="height:auto">
          ${courses.map((c) => `<option value="${c.id}" ${(editing?.course_ids || []).includes(c.id) ? 'selected' : ''}>${e(c.title)}</option>`).join('')}
        </select></div>
      <div class="field-row"><label>หมายเหตุ</label>
        <input id="cp-note" value="${e(editing?.note || '')}" placeholder="เช่น โปรเปิดเทอม"></div>
      <div class="field-row"><label>วันหมดอายุ (ไม่บังคับ)</label>
        <input id="cp-exp" type="date" value="${editing?.expires_at ? String(editing.expires_at).slice(0, 10) : ''}"></div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-primary" id="cp-save">${editing ? 'บันทึกการแก้ไข' : 'สร้างโค้ด'}</button>
        ${editing ? `<a class="btn btn-ghost" href="#/admin?tab=coupons">ยกเลิก</a>` : ''}
      </div>
    </div>
  </div>`;
}

/* ── ผู้ใช้งาน ───────────────────────────────────────── */
function usersHtml(parents, teachers, ctx) {
  const render = (list, kind) => list.length ? `<div class="table-wrap"><table class="book-table">
    <thead><tr><th>ชื่อ</th><th>ติดต่อ</th><th>สมัครเมื่อ</th>${kind === 'parent' ? '<th>รหัสผ่าน</th>' : '<th>รหัสครู</th>'}</tr></thead>
    <tbody>${list.map((a) => `<tr>
      <td>${e(a.name || '—')}<div class="tiny dim">${e(a.email || '')}</div></td>
      <td class="tiny">${e(a.phone || '—')}<div class="tiny dim">${e(a.line_id || '')}</div></td>
      <td class="tiny">${e(thaiDate(a.created_at))}</td>
      <td class="tiny">${kind === 'parent' ? e(a.password_plain || '—') : e(a.teacher_code || '—')}</td>
    </tr>`).join('')}</tbody>
  </table></div>` : `<p class="tiny dim">ยังไม่มีข้อมูล</p>`;

  return `
  <div class="book-card" style="margin-bottom:20px">
    <div style="font-family:var(--brand-font);font-size:16px;margin-bottom:10px">ผู้ปกครอง (${parents.length})</div>
    ${render(parents, 'parent')}
  </div>
  <div class="book-card">
    <div style="font-family:var(--brand-font);font-size:16px;margin-bottom:10px">ครู (${teachers.length})</div>
    ${render(teachers, 'teacher')}
    <p class="hint" style="margin-top:10px">บัญชีครูซิงก์จาก 02._.mock — ครูเข้าด้วยรหัสครูเดิมของตัวเอง</p>
  </div>`;
}

/* ── ผูกนักเรียน ─────────────────────────────────────── */
function linksHtml(parents, links, roster, ctx) {
  const students = roster?.students || [];
  const byParent = {};
  links.forEach((l) => { (byParent[l.user_id] = byParent[l.user_id] || []).push(l); });

  return `
  <div class="book-card" style="margin-bottom:20px">
    <div style="font-family:var(--brand-font);font-size:16px;margin-bottom:10px">ผูกนักเรียนให้ผู้ปกครอง</div>
    <p class="hint" style="margin:0 0 12px">เลือกผู้ปกครอง → เลือกนักเรียนจาก 02._.mock แล้วกดเพิ่ม (นักเรียนจะไปแสดงในหน้าคะแนนของผู้ปกครอง)</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
      <div class="field-row" style="flex:1;min-width:220px;margin:0">
        <label>ผู้ปกครอง</label>
        <select id="link-parent">${parents.map((p) => `<option value="${p.user_id}">${e(p.name || p.email)} · ${e(p.email || '')}</option>`).join('')}</select>
      </div>
      <div class="field-row" style="flex:1;min-width:220px;margin:0">
        <label>นักเรียน</label>
        <select id="link-student">${students.map((s) => `<option value="${s.id}">${e(s.name)} · ${e(s.code)} · ${e(s.orgName || '')}</option>`).join('')}</select>
      </div>
      <button class="btn btn-primary" id="link-add">เพิ่ม</button>
    </div>
  </div>

  <div class="book-card">
    <div style="font-family:var(--brand-font);font-size:16px;margin-bottom:10px">การผูกทั้งหมด (${links.length})</div>
    ${links.length ? `<div class="table-wrap"><table class="book-table">
      <thead><tr><th>ผู้ปกครอง</th><th>นักเรียน</th><th>โรงเรียน/หน่วยงาน</th><th></th></tr></thead>
      <tbody>${links.map((l) => {
        const p = parents.find((x) => x.user_id === l.user_id);
        return `<tr>
          <td>${e(p?.name || l.user_id)}<div class="tiny dim">${e(p?.email || '')}</div></td>
          <td>${e(l.student_name || l.student_id)}<div class="tiny dim">${e(l.student_code || '')}</div></td>
          <td class="tiny">${e(l.org_id || '—')}</td>
          <td><button class="btn btn-ghost btn-sm" data-unlink="${l.id}" style="color:var(--red)">เอาออก</button></td>
        </tr>`; }).join('')}</tbody>
    </table></div>` : `<p class="tiny dim">ยังไม่มีการผูกนักเรียน</p>`}
  </div>`;
}

/* ── ตั้งค่า ─────────────────────────────────────────── */
function settingsHtml(ctx) {
  const s = ctx.settings || {};
  return `
  <div class="book-card" style="max-width:620px">
    <div style="font-family:var(--brand-font);font-size:16px;margin-bottom:10px">ตั้งค่าการรับเงิน</div>
    <div class="field-row"><label>ประเภทพร้อมเพย์</label>
      <select id="s-type">
        <option value="phone" ${s.promptpay_type === 'phone' ? 'selected' : ''}>เบอร์โทร</option>
        <option value="national_id" ${s.promptpay_type === 'national_id' ? 'selected' : ''}>เลขบัตรประชาชน</option>
        <option value="ewallet" ${s.promptpay_type === 'ewallet' ? 'selected' : ''}>e-Wallet</option>
      </select></div>
    <div class="field-row"><label>เลขพร้อมเพย์</label><input id="s-id" value="${e(s.promptpay_id || '')}" placeholder="0617806696"></div>
    <div class="field-row"><label>ชื่อบัญชี</label><input id="s-name" value="${e(s.promptpay_name || '')}"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="field-row"><label>Line ที่ให้ติดต่อ</label><input id="s-line" value="${e(s.contact_line || '')}"></div>
      <div class="field-row"><label>เบอร์โทรติดต่อ</label><input id="s-phone" value="${e(s.contact_phone || '')}"></div>
    </div>
    <button class="btn btn-primary" id="s-save">บันทึกการตั้งค่า</button>
  </div>`;
}

/* ── events ──────────────────────────────────────────── */
function bindAdmin(ctx, tab) {
  const root = document.getElementById('app');

  root.querySelectorAll('[data-confirm]').forEach((btn) => {
    if (btn.closest('[data-preview]')) return;
    btn.addEventListener('click', async () => {
      const id = btn.dataset.confirm;
      const ok = await confirmDialog({
        title: 'ยืนยันการชำระเงิน',
        message: 'เมื่อยืนยันแล้ว สลิปจะถูกลบออกจาก Supabase ทันที (ดาวน์โหลดเก็บไว้ก่อนได้) — ยืนยันหรือไม่?',
        confirmLabel: 'ยืนยัน',
      });
      if (!ok) return;
      btn.disabled = true;
      try {
        await ctx.data.confirmOrder(id);
        toast('ยืนยันแล้ว และลบสลิปออกจาก Storage', 'success');
        location.reload();
      } catch (err) {
        btn.disabled = false;
        toast(err.message || 'ยืนยันไม่สำเร็จ', 'error');
      }
    });
  });

  root.querySelectorAll('[data-download]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.download;
      try {
        const order = (await ctx.data.listAllOrders()).find((o) => o.id === id);
        await ctx.data.downloadSlip(id, order?.slip_path || '');
        toast('ดาวน์โหลดสลิปแล้ว', 'success');
      } catch (err) {
        toast(err.message || 'ดาวน์โหลดไม่สำเร็จ', 'error');
      }
    });
  });

  root.querySelectorAll('[data-reject]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'ไม่ผ่านการชำระเงิน',
        message: 'สลิปจะถูกลบออกจาก Supabase และผู้ปกครองจะเห็นสถานะ "ไม่ผ่าน" — ยืนยันหรือไม่?',
        confirmLabel: 'ยืนยัน', tone: 'danger',
      });
      if (!ok) return;
      try {
        await ctx.data.rejectOrder(btn.dataset.reject);
        toast('ปฏิเสธรายการแล้ว', 'success');
        location.reload();
      } catch (err) { toast(err.message || 'ไม่สำเร็จ', 'error'); }
    });
  });

  // โหลดรูปสลิป
  root.querySelectorAll('[data-confirm]').forEach(async (btn) => {
    const id = btn.dataset.confirm;
    const holder = root.querySelector(`#thumb-${id}`);
    if (!holder) return;
    try {
      const order = (await ctx.data.listAllOrders()).find((o) => o.id === id);
      if (!order?.slip_path) { holder.innerHTML = '<div class="slip-thumb" style="display:grid;place-items:center;font-size:11px">ไม่มีสลิป</div>'; return; }
      const url = await ctx.data.slipUrl(order.slip_path);
      holder.innerHTML = `<img class="slip-thumb" src="${e(url)}" alt="สลิป" data-preview="1">`;
    } catch (err) { holder.innerHTML = '<div class="slip-thumb" style="display:grid;place-items:center;font-size:11px">โหลดไม่ได้</div>'; }
  });

  // คอร์ส
  root.querySelector('#c-save')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    const id = root.querySelector('#c-id').value || undefined;
    btn.disabled = true;
    try {
      let image_url = root.querySelector('#c-img').value.trim();
      const file = root.querySelector('#c-img-file').files?.[0];
      if (file) image_url = await ctx.data.uploadCover(file);
      await ctx.data.saveCourse({
        id, title: root.querySelector('#c-title').value.trim(),
        subtitle: root.querySelector('#c-sub').value.trim(),
        detail: root.querySelector('#c-detail').value.trim(),
        price: Number(root.querySelector('#c-price').value),
        hours: Number(root.querySelector('#c-hours').value),
        lessons: Number(root.querySelector('#c-lessons').value),
        seats: root.querySelector('#c-unlimited').checked ? 0 : Number(root.querySelector('#c-seats').value || 0),
        level: root.querySelector('#c-level').value.trim(),
        image_url,
      });
      toast('บันทึกคอร์สแล้ว', 'success');
      location.hash = '#/admin?tab=courses';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (err) {
      btn.disabled = false;
      toast(err.message || 'บันทึกไม่สำเร็จ', 'error');
    }
  });

  root.querySelectorAll('[data-del-course]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'ลบคอร์ส', message: 'ลบคอร์สนี้ถาวร?', confirmLabel: 'ลบ', tone: 'danger' });
      if (!ok) return;
      try {
        await ctx.data.deleteCourse(btn.dataset.delCourse);
        toast('ลบคอร์สแล้ว', 'success');
        location.reload();
      } catch (err) { toast(err.message || 'ลบไม่สำเร็จ', 'error'); }
    });
  });

  root.querySelector('#c-unlimited')?.addEventListener('change', (ev) => {
    const seats = root.querySelector('#c-seats');
    seats.disabled = ev.currentTarget.checked;
    if (ev.currentTarget.checked) seats.value = '';
    else if (!seats.value) seats.value = 8;
  });

  // คูปอง
  root.querySelector('#cp-save')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    const sel = root.querySelector('#cp-courses');
    btn.disabled = true;
    try {
      await ctx.data.saveCoupon({
        id: root.querySelector('#cp-id').value || undefined,
        code: root.querySelector('#cp-code').value,
        kind: root.querySelector('#cp-kind').value,
        value: root.querySelector('#cp-value').value,
        min_amount: root.querySelector('#cp-min').value,
        max_uses: root.querySelector('#cp-max').value,
        course_ids: [...sel.selectedOptions].map((o) => o.value),
        note: root.querySelector('#cp-note').value,
        expires_at: root.querySelector('#cp-exp').value ? new Date(`${root.querySelector('#cp-exp').value}T23:59:59`).toISOString() : null,
      });
      toast('บันทึกโค้ดแล้ว', 'success');
      location.hash = '#/admin?tab=coupons';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } catch (err) {
      btn.disabled = false;
      toast(err.message || 'บันทึกไม่สำเร็จ', 'error');
    }
  });

  root.querySelectorAll('[data-del-coupon]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'ลบโค้ดส่วนลด', message: 'ลบโค้ดนี้ถาวร? ผู้ที่แลกไว้จะใช้ไม่ได้', confirmLabel: 'ลบ', tone: 'danger' });
      if (!ok) return;
      try {
        await ctx.data.deleteCoupon(btn.dataset.delCoupon);
        toast('ลบโค้ดแล้ว', 'success');
        location.reload();
      } catch (err) { toast(err.message || 'ลบไม่สำเร็จ', 'error'); }
    });
  });

  // ผูกนักเรียน
  root.querySelector('#link-add')?.addEventListener('click', async (ev) => {
    const parentId = root.querySelector('#link-parent').value;
    const studentId = root.querySelector('#link-student').value;
    if (!parentId || !studentId) { toast('เลือกผู้ปกครองและนักเรียน', 'error'); return; }
    const student = ctx._roster?.students?.find((s) => s.id === studentId);
    ev.currentTarget.disabled = true;
    try {
      await ctx.data.ownerLinkStudent(parentId, student || { id: studentId });
      toast('ผูกนักเรียนแล้ว', 'success');
      location.reload();
    } catch (err) {
      ev.currentTarget.disabled = false;
      toast(err.message || 'ผูกไม่สำเร็จ', 'error');
    }
  });

  root.querySelectorAll('[data-unlink]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'เอานักเรียนออก', message: 'เอานักเรียนคนน็ออกจากบัญชีผู้ปกครองนี้?', confirmLabel: 'เอาออก', tone: 'danger' });
      if (!ok) return;
      try {
        await ctx.data.unlinkStudent(btn.dataset.unlink);
        toast('เอาออกแล้ว', 'success');
        location.reload();
      } catch (err) { toast(err.message || 'ไม่สำเร็จ', 'error'); }
    });
  });

  // ตั้งค่า
  root.querySelector('#s-save')?.addEventListener('click', async (ev) => {
    ev.currentTarget.disabled = true;
    try {
      await ctx.data.saveSettings({
        promptpay_type: root.querySelector('#s-type').value,
        promptpay_id: root.querySelector('#s-id').value.trim(),
        promptpay_name: root.querySelector('#s-name').value.trim(),
        contact_line: root.querySelector('#s-line').value.trim(),
        contact_phone: root.querySelector('#s-phone').value.trim(),
      });
      toast('บันทึกการตั้งค่าแล้ว', 'success');
    } catch (err) { toast(err.message || 'บันทึกไม่สำเร็จ', 'error'); }
    finally { ev.currentTarget.disabled = false; }
  });
}
