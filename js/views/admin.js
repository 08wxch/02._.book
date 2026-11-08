/* ── หลังบ้านเจ้าของระบบ ───────────────────────────────── */

import { toast, confirmDialog } from '../ui.js';
import { e, thaiDate, thaiDateTime } from '../utils.js';

export async function renderAdmin(_arg, ctx) {
  const tab = ctx.route?.query.get('tab') || 'orders';
  const editId = ctx.route?.query.get('edit') || '';

  const [orders, courses, accounts, links, roster, coupons, orgs] = await Promise.all([
    ctx.data.listAllOrders(),
    ctx.data.listCourses({ all: true }),
    ctx.data.listAccounts(),
    ctx.data.listAllLinks(),
    ctx.data.listMockRoster().catch(() => ({ students: [], organizations: [] })),
    ctx.data.listCoupons().catch(() => []),
    ctx.data.listOrganizations().catch(() => []),
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
        ? usersHtml(parents, teachers, ctx, orgs)
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
  const open = Boolean(editing) || ctx.route?.query.get('new') === '1';

  const form = open ? `
    <div class="book-card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px">
        <div style="font-family:var(--brand-font);font-size:16px">${editing ? 'แก้ไขคอร์ส' : 'เพิ่มคอร์สใหม่'}</div>
        <a class="btn btn-ghost btn-sm" href="#/admin?tab=courses">ปิด</a>
      </div>
      <input type="hidden" id="c-id" value="${editing ? editing.id : ''}">
      <div class="field-row"><label>ชื่อคอร์ส</label><input id="c-title" value="${e(editing?.title || '')}" placeholder="เช่น คณิตศาสตร์ ม.ปลาย"></div>
      <div class="field-row"><label>คำโปรยสั้น</label><input id="c-sub" value="${e(editing?.subtitle || '')}" placeholder="หนึ่งบรรทัด บอกจุดเด่น"></div>
      <div class="field-row"><label>รายละเอียด</label><textarea id="c-detail" placeholder="อธิบายว่าเรียนอะไร ได้อะไร">${e(editing?.detail || '')}</textarea></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field-row"><label>ราคา (บาท)</label><input id="c-price" type="number" min="0" step="50" value="${Number(editing?.price || 0)}"></div>
        <div class="field-row"><label>ระดับชั้น</label><input id="c-level" value="${e(editing?.level || '')}" placeholder="เช่น ม.4–ม.6"></div>
      </div>
      <div class="field-row">
        <label>จำนวนที่นั่ง</label>
        <label class="check-line">
          <input type="checkbox" id="c-unlimited" ${!editing || !Number(editing?.seats) ? 'checked' : ''}>
          <span>ไม่จำกัดจำนวนคน (เรียนได้เรื่อย ๆ)</span>
        </label>
        <input id="c-seats" type="number" min="1" value="${Number(editing?.seats || 8)}"
          ${!editing || !Number(editing?.seats) ? 'disabled' : ''} placeholder="เช่น 8">
      </div>
      <details style="margin:10px 0">
        <summary class="tiny dim" style="cursor:pointer">รายละเอียดเพิ่มเติม (ไม่บังคับ)</summary>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
          <div class="field-row"><label>ชั่วโมงเรียน</label><input id="c-hours" type="number" min="0" value="${Number(editing?.hours || 0)}"></div>
          <div class="field-row"><label>จำนวนครั้ง/ชุด</label><input id="c-lessons" type="number" min="0" value="${Number(editing?.lessons || 0)}"></div>
        </div>
        <p class="hint">คอร์สแบบขายเป็นชุดแบบฝึกหัดไม่ต้องใส่ก็ได้ — ใส่แค่ชื่อ/รายละเอียด/ราคาก็พอ</p>
      </details>
      <div class="field-row"><label>รูปปก (แนะนำ 1200×675 px)</label>
        <input type="file" id="c-img-file" accept="image/*">
        <div id="c-img-preview" style="margin-top:8px">
          ${editing?.image_url ? `<img src="${e(editing.image_url)}" class="coupon-img-preview" alt="">` : ''}
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-primary" id="c-save">${editing ? 'บันทึกการแก้ไข' : 'บันทึกคอร์ส'}</button>
        <a class="btn btn-ghost" href="#/admin?tab=courses">ยกเลิก</a>
      </div>
    </div>` : '';

  const preview = editing ? `
    <div class="book-card" style="margin-top:14px">
      <div style="font-family:var(--brand-font);font-size:16px;margin-bottom:10px">ตัวอย่างที่ผู้ปกครองเห็น</div>
      ${ctx.courseCard({ ...editing, left: editing.seats ? Math.max(0, editing.seats - (editing.sold || 0)) : null })}
    </div>` : '';

  return `
  <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:14px;flex-wrap:wrap">
    <div class="tiny dim">ทั้งหมด ${courses.length} คอร์ส</div>
    <a class="btn btn-primary btn-sm" href="#/admin?tab=courses&new=1">+ เพิ่มคอร์ส</a>
  </div>

  <div class="${open ? 'book-grid-2' : ''}">
    <div>
      ${courses.length ? `<div class="book-card" style="padding:8px 10px">
        ${courses.map((c) => `
          <div class="student-row">
            <a class="student-row__main" href="#/course/${c.id}">
              <span class="student-row__avatar">${c.image_url ? `<img src="${e(c.image_url)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : e((c.title || '?').charAt(0))}</span>
              <span class="student-row__name">
                <b>${e(c.title)}</b>
                <span class="tiny dim">${ctx.baht(c.price)} · ${c.seats ? `${c.seats} ที่นั่ง` : 'ไม่จำกัดที่นั่ง'}${c.active ? '' : ' · ปิดขาย'}</span>
              </span>
            </a>
            <div style="display:flex;gap:6px">
              <a class="btn btn-ghost btn-sm" href="#/admin?tab=courses&edit=${c.id}">แก้ไข</a>
              <button class="btn btn-ghost btn-sm" data-del-course="${c.id}" style="color:var(--red)">ลบ</button>
            </div>
          </div>`).join('')}
      </div>` : `<div class="empty-soft"><b>ยังไม่มีคอร์ส</b>
        <a class="btn btn-primary btn-sm" href="#/admin?tab=courses&new=1">เพิ่มคอร์สแรก</a></div>`}
    </div>
    ${form}
  </div>
  ${preview}`;
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
          <td>
            ${c.image_url ? `<img src="${e(c.image_url)}" alt="" class="coupon-thumb">` : ''}
            <b>${e(c.title || c.code)}</b>
            <div class="tiny dim">${e(c.code)}${c.note ? ` · ${e(c.note)}` : ''}</div>
          </td>
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
        <div style="display:flex;gap:8px">
          <input id="cp-code" value="${e(editing?.code || '')}" placeholder="MATH100" style="text-transform:uppercase">
          <button class="btn btn-ghost btn-sm" id="cp-rand" type="button">สุ่มโค้ด</button>
        </div>
        <span class="hint">อยากตั้งเองก็พิมพ์ทับได้เลย</span></div>
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
      </div>
      <div class="field-row">
        <label class="check-line">
          <input type="checkbox" id="cp-unlimited" ${!editing || !Number(editing?.max_uses) ? 'checked' : ''}>
          <span>ใช้ได้ไม่จำกัดจำนวนครั้ง</span>
        </label>
        <input id="cp-max" type="number" min="1" value="${Number(editing?.max_uses || 10)}"
          ${!editing || !Number(editing?.max_uses) ? 'disabled' : ''} placeholder="เช่น 10">
      </div>
      <div class="field-row">
        <label>ใช้กับคอร์ส (ไม่เลือกเลย = ใช้ได้ทุกคอร์ส)</label>
        <select id="cp-courses" multiple size="${Math.min(6, Math.max(3, courses.length))}" style="height:auto">
          ${courses.map((c) => `<option value="${c.id}" ${(editing?.course_ids || []).includes(c.id) ? 'selected' : ''}>${e(c.title)}</option>`).join('')}
        </select>
        <div style="display:flex;gap:8px;margin-top:6px">
          <button class="btn btn-ghost btn-sm" type="button" id="cp-clear-courses">ล้างการเลือก (ใช้ทุกคอร์ส)</button>
          <span class="hint" style="align-self:center">กด Ctrl/⌘ ค้างเพื่อเลือกหลายคอร์ส</span>
        </div>
      </div>
      <div class="field-row">
        <label>ชื่อบัตรส่วนลด (แสดงให้ผู้ปกครองเห็น)</label>
        <input id="cp-title" value="${e(editing?.title || '')}" placeholder="เช่น บัตรส่วนลดเปิดเทอม" maxlength="80">
      </div>
      <div class="field-row"><label>รูปบัตร (แนวนอน แนะนำ 1000×560 px · ไม่เกิน 1MB)</label>
        <input type="file" id="cp-image" accept="image/*">
        <div id="cp-img-preview" style="margin-top:8px">
          ${editing?.image_url ? `<img src="${e(editing.image_url)}" alt="" class="coupon-img-preview">` : ''}
        </div>
        ${editing?.image_url ? '<button class="btn btn-ghost btn-sm" type="button" id="cp-img-remove" style="margin-top:6px">ลบรูปบัตร</button>' : ''}
      </div>
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
function usersHtml(parents, teachers, ctx, orgs = []) {
  const orgFilter = ctx.route?.query.get('uorg') || '';
  const orgName = (id) => orgs.find((o) => o.id === id)?.name || id || '';
  const matchOrg = (a) => !orgFilter || (a.org_id === orgFilter) || (a.org_ids || []).includes(orgFilter);
  const pList = parents.filter(matchOrg);
  const tList = teachers.filter(matchOrg);

  return `
  <div class="book-card" style="margin-bottom:14px;padding:14px 16px">
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <label class="tiny dim">กรองตามหน่วยงาน/โรงเรียน</label>
      <select id="user-org" style="min-width:260px">
        <option value="">ทั้งหมด</option>
        ${orgs.map((o) => `<option value="${o.id}" ${orgFilter === o.id ? 'selected' : ''}>${e(o.name)}</option>`).join('')}
      </select>
    </div>
  </div>

  <div class="book-card" style="margin-bottom:18px">
    <div style="font-family:var(--brand-font);font-size:16px;margin-bottom:8px">ผู้ปกครอง (${pList.length})</div>
    ${pList.length ? `<div class="table-wrap"><table class="book-table">
      <thead><tr><th>ชื่อ</th><th>ติดต่อ</th><th>โรงเรียน/หน่วยงานของลูก</th><th></th></tr></thead>
      <tbody>${pList.map((a) => `<tr>
        <td><b>${e(a.name || '—')}</b><div class="tiny dim">${e(a.email || '')}</div></td>
        <td class="tiny">${e(a.phone || '—')}<div class="tiny dim">${e(a.line_id || '')}</div></td>
        <td class="tiny">${(a.org_ids || []).length ? (a.org_ids || []).map((id) => `<span class="chip chip--mute" style="margin-right:4px">${e(orgName(id))}</span>`).join('') : '<span class="dim">ยังไม่เลือก</span>'}</td>
        <td><button class="btn btn-ghost btn-sm" data-open-parent="${a.user_id}">ดูรายละเอียด</button></td>
      </tr>`).join('')}</tbody>
    </table></div>` : '<p class="tiny dim">ไม่มีผู้ปกครองในหน่วยงานนี้</p>'}
  </div>

  <div class="book-card">
    <div style="font-family:var(--brand-font);font-size:16px;margin-bottom:8px">ครู (${tList.length})</div>
    ${tList.length ? `<div class="table-wrap"><table class="book-table">
      <thead><tr><th>ชื่อ</th><th>ติดต่อ</th><th>หน่วยงาน</th></tr></thead>
      <tbody>${tList.map((a) => `<tr>
        <td><b>${e(a.name || '—')}</b><div class="tiny dim">${e(a.email || '')}</div></td>
        <td class="tiny">${e(a.phone || '—')}<div class="tiny dim">${e(a.line_id || '')}</div></td>
        <td class="tiny">${e(orgName(a.org_id) || '—')}</td>
      </tr>`).join('')}</tbody>
    </table></div>` : '<p class="tiny dim">ไม่มีครูในหน่วยงานนี้</p>'}
    <p class="hint" style="margin-top:10px">ข้อมูลครูซิงก์จากรายชื่อบุคลากรใน 02._.mock อัตโนมัติตอนล็อกอิน</p>
  </div>`;
}

/* ── ผูกนักเรียน (ทางลัด: ไปหน้ารายชื่อนักเรียน) ──────── */
function linksHtml(parents, links, roster, ctx) {
  const students = roster?.students || [];
  const byParent = {};
  links.forEach((l) => { (byParent[l.user_id] = byParent[l.user_id] || []).push(l); });

  return `
  <div class="book-card" style="margin-bottom:18px">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
      <div>
        <div style="font-family:var(--brand-font);font-size:16px">ผูกนักเรียนกับผู้ปกครอง</div>
        <p class="tiny dim" style="margin:6px 0 0">แนะนำให้ทำที่หน้า <b>รายชื่อนักเรียน</b> — เลือกหน่วยงานก่อน แล้วค่อยผูกทีละคน</p>
      </div>
      <a class="btn btn-primary btn-sm" href="#/students">ไปที่รายชื่อนักเรียน</a>
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-top:16px">
      <div class="field-row" style="flex:1;min-width:220px;margin:0">
        <label>ผู้ปกครอง</label>
        <select id="link-parent">${parents.map((p) => `<option value="${p.user_id}">${e(p.name || p.email)} · ${e(p.email || '')}</option>`).join('')}</select>
      </div>
      <div class="field-row" style="flex:1;min-width:220px;margin:0">
        <label>นักเรียน</label>
        <select id="link-student">${students.map((s) => `<option value="${s.id}">${e(s.name)} · ${e(s.code)} · ${e(s.orgName || '')}</option>`).join('')}</select>
      </div>
      <button class="btn btn-primary" id="link-add">ผูกให้ผู้ปกครอง</button>
    </div>
  </div>

  <div class="book-card">
    <div style="font-family:var(--brand-font);font-size:16px;margin-bottom:8px">การผูกทั้งหมด (${links.length})</div>
    ${links.length ? `<div class="table-wrap"><table class="book-table">
      <thead><tr><th>ผู้ปกครอง</th><th>นักเรียน</th><th>โรงเรียน/หน่วยงาน</th><th></th></tr></thead>
      <tbody>${links.map((l) => {
        const p = parents.find((x) => x.user_id === l.user_id);
        return `<tr>
          <td><b>${e(p?.name || l.user_id)}</b><div class="tiny dim">${e(p?.email || '')}</div></td>
          <td>${e(l.student_name || l.student_id)}<div class="tiny dim">${e(l.student_code || '')}</div></td>
          <td class="tiny">${e(l.org_id || '—')}</td>
          <td><button class="btn btn-ghost btn-sm" data-unlink="${l.id}" style="color:var(--red)">เอาออก</button></td>
        </tr>`; }).join('')}</tbody>
    </table></div>` : '<p class="tiny dim">ยังไม่มีการผูกนักเรียน</p>'}
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
      let image_url = '';
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
        image_url: image_url || root.querySelector('#c-img-preview')?.querySelector('img')?.getAttribute('src') || '',
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

  // ผู้ใช้งาน
  root.querySelector('#user-org')?.addEventListener('change', (ev) => {
    location.hash = `#/admin?tab=users&uorg=${encodeURIComponent(ev.currentTarget.value)}`;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  root.querySelectorAll('[data-open-parent]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const mod = await import('./students.js');
      mod.openParentDetail(btn.dataset.openParent, ctx);
    });
  });

  // คูปอง
  root.querySelector('#cp-rand')?.addEventListener('click', () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 8; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
    root.querySelector('#cp-code').value = out;
  });
  root.querySelector('#cp-clear-courses')?.addEventListener('click', () => {
    root.querySelectorAll('#cp-courses option').forEach((o) => { o.selected = false; });
  });
  root.querySelector('#cp-unlimited')?.addEventListener('change', (ev) => {
    const max = root.querySelector('#cp-max');
    max.disabled = ev.currentTarget.checked;
    if (ev.currentTarget.checked) max.value = '';
    else if (!max.value) max.value = 10;
  });
  root.querySelector('#cp-img-remove')?.addEventListener('click', (ev) => {
    ev.currentTarget.dataset.removed = '1';
    root.querySelector('#cp-img-preview').innerHTML = '';
    ev.currentTarget.style.display = 'none';
    toast('จะลบรูปเมื่อกดบันทึก', 'success');
  });

  root.querySelector('#cp-save')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    const sel = root.querySelector('#cp-courses');
    btn.disabled = true;
    try {
      const file = root.querySelector('#cp-image')?.files?.[0];
      let image_url = root.querySelector('#cp-img-remove')?.dataset.removed === '1' ? '' : undefined;
      if (file) image_url = await ctx.data.uploadCouponImage(file);
      await ctx.data.saveCoupon({
        id: root.querySelector('#cp-id').value || undefined,
        code: root.querySelector('#cp-code').value,
        title: root.querySelector('#cp-title').value,
        kind: root.querySelector('#cp-kind').value,
        value: root.querySelector('#cp-value').value,
        min_amount: root.querySelector('#cp-min').value,
        max_uses: root.querySelector('#cp-unlimited').checked ? 0 : root.querySelector('#cp-max').value,
        course_ids: [...sel.selectedOptions].map((o) => o.value),
        note: root.querySelector('#cp-note').value,
        image_url,
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
      await ctx.data.linkParentStudent(studentId, parentId);
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
