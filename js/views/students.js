/* ── รายชื่อนักเรียน (เจ้าของ/ครู) + ผูกผู้ปกครอง ───────── */

import { closeModal, confirmDialog, openModal, toast } from '../ui.js';
import { e, thaiDate } from '../utils.js';
import { studentOverviewHtml } from './account.js';
import { hydrateMath } from '../latex.js';

export async function renderStudents(studentId, ctx) {
  if (!ctx.me || (ctx.me.role !== 'owner' && ctx.me.role !== 'teacher')) {
    location.hash = '#/'; return '';
  }
  return studentId ? studentDetail(studentId, ctx) : studentList(ctx);
}

/* ── รายการนักเรียน ───────────────────────────────────── */
async function studentList(ctx) {
  const [students, orgs, parents] = await Promise.all([
    ctx.data.studentsOverview().catch(() => []),
    ctx.data.listOrganizations().catch(() => []),
    ctx.data.listParents().catch(() => []),
  ]);

  const myOrg = ctx.me.org_id || '';
  const orgFilter = ctx.route?.query.get('org') || (ctx.me.role === 'teacher' ? myOrg : '');
  const shown = orgFilter ? students.filter((s) => s.orgId === orgFilter) : students;
  const linked = shown.filter((s) => (s.parents || []).length).length;

  const orgName = (id) => orgs.find((o) => o.id === id)?.name || id || '—';

  const rows = shown.map((s) => `
    <div class="student-row">
      <a class="student-row__main" href="#/students/${encodeURIComponent(s.id)}">
        <span class="student-row__avatar">${e((s.name || '?').trim().charAt(0))}</span>
        <span class="student-row__name">
          <b>${e(s.name || s.id)}</b>
          <span class="tiny dim">${e(s.code || '')}${s.class ? ` · ${e(s.class)}` : ''} · ${e(orgName(s.orgId))}</span>
        </span>
      </a>
      <div class="student-row__parents">
        ${(s.parents || []).length
          ? s.parents.map((p) => `<button class="parent-chip" data-parent="${p.user_id}">
              ${e(p.name || p.email)}<span class="tiny dim"> ${e(p.phone || '')}</span></button>`).join('')
          : '<span class="tiny dim">ยังไม่มีผู้ปกครอง</span>'}
      </div>
      <button class="btn btn-ghost btn-sm" data-add-parent="${s.id}">
        ${(s.parents || []).length ? 'เพิ่มผู้ปกครอง' : '+ เพิ่มผู้ปกครอง'}
      </button>
    </div>`).join('');

  setTimeout(() => {
    const root = document.getElementById('app');
    root.querySelector('#org-filter')?.addEventListener('change', (ev) => {
      location.hash = `#/students?org=${encodeURIComponent(ev.currentTarget.value)}`;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    root.querySelectorAll('[data-add-parent]').forEach((btn) => {
      btn.addEventListener('click', () => openLinkModal(btn.dataset.addParent, students, parents, ctx));
    });
    root.querySelectorAll('[data-parent]').forEach((btn) => {
      btn.addEventListener('click', () => openParentDetail(btn.dataset.parent, ctx));
    });
  }, 0);

  return ctx.consoleLayout({
    items: [
      { href: '#/students', label: 'รายชื่อนักเรียน', active: true },
      { href: '#/admin', label: 'หลังบ้าน', hidden: ctx.me.role !== 'owner' },
      { href: '#/account', label: 'บัญชีของฉัน' },
    ].filter((i) => !i.hidden),
    title: 'รายชื่อนักเรียน',
    subtitle: 'กดที่ชื่อนักเรียนเพื่อดูคะแนนและข้อมูล · ด้านขวาคือบัญชีผู้ปกครองที่ผูกอยู่',
    body: `
      <div class="stat-row">
        <div class="stat-card"><div class="k">นักเรียนในระบบ</div><div class="v">${shown.length}<small>คน</small></div></div>
        <div class="stat-card"><div class="k">ผูกผู้ปกครองแล้ว</div><div class="v">${linked}<small>คน</small></div></div>
        <div class="stat-card"><div class="k">ยังไม่มีผู้ปกครอง</div><div class="v">${shown.length - linked}<small>คน</small></div></div>
      </div>

      ${ctx.me.role === 'owner' ? `
      <div class="book-card" style="margin-bottom:14px;padding:14px 16px">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <label class="tiny dim" for="org-filter">กรองตามหน่วยงาน/โรงเรียน</label>
          <select id="org-filter" style="min-width:260px">
            <option value="">ทั้งหมด (${students.length} คน)</option>
            ${orgs.map((o) => `<option value="${o.id}" ${orgFilter === o.id ? 'selected' : ''}>${e(o.name)}</option>`).join('')}
          </select>
        </div>
      </div>` : ''}

      ${shown.length ? `<div class="book-card" style="padding:8px 10px">${rows}</div>`
        : `<div class="empty-soft"><b>ยังไม่มีนักเรียนในหน่วยงานนี้</b>
             <p class="tiny dim" style="margin:0">เพิ่มนักเรียนได้ที่ระบบ 02._.mock แล้วกลับมาโหลดใหม่</p></div>`}
    `,
  });
}

/* ── รายละเอียดนักเรียน 1 คน ───────────────────────────── */
async function studentDetail(studentId, ctx) {
  const [report, students, parents] = await Promise.all([
    ctx.data.studentReport(studentId).catch(() => null),
    ctx.data.studentsOverview().catch(() => []),
    ctx.data.listParents().catch(() => []),
  ]);
  if (!report) {
    return ctx.consoleLayout({
      items: [{ href: '#/students', label: 'รายชื่อนักเรียน', active: true }],
      title: 'ไม่พบนักเรียนคนนี้',
      body: '<a class="btn btn-ghost btn-sm" href="#/students">กลับรายชื่อนักเรียน</a>',
    });
  }

  const row = students.find((s) => s.id === studentId) || {};
  const linked = row.parents || [];

  setTimeout(async () => {
    const root = document.getElementById('app');
    root.querySelector('#d-add-parent')?.addEventListener('click', () => openLinkModal(studentId, students, parents, ctx));
    root.querySelectorAll('[data-parent]').forEach((btn) => {
      btn.addEventListener('click', () => openParentDetail(btn.dataset.parent, ctx));
    });
    root.querySelectorAll('[data-unlink]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'ถอดผู้ปกครองออก',
          message: 'ผู้ปกครองคนนี้จะไม่เห็นคะแนนของนักเรียนคนนี้อีก (บัญชีนักเรียนไม่หาย)',
          confirmLabel: 'ถอดออก', tone: 'danger',
        });
        if (!ok) return;
        try {
          await ctx.data.unlinkStudent(btn.dataset.unlink);
          toast('ถอดผู้ปกครองแล้ว', 'success');
          location.reload();
        } catch (err) { toast(err.message || 'ไม่สำเร็จ', 'error'); }
      });
    });
  }, 0);

  return ctx.consoleLayout({
    items: [
      { href: '#/students', label: 'รายชื่อนักเรียน', active: true },
      { href: '#/account', label: 'บัญชีของฉัน' },
    ],
    title: report.student?.name || '',
    subtitle: `${e(report.student?.code || '')}${report.student?.class ? ` · ${e(report.student.class)}` : ''}${report.student?.orgName ? ` · ${e(report.student.orgName)}` : ''}`,
    body: `
      <div class="detail-2col">
        <div>${studentOverviewHtml(report, ctx, { studentId, backHref: '#/students', backLabel: 'รายชื่อนักเรียน' })}</div>
        <aside class="book-card" style="height:fit-content;position:sticky;top:80px">
          <div style="font-family:var(--brand-font);font-size:16px;margin-bottom:4px">บัญชีผู้ปกครองที่ผูกไว้</div>
          <p class="tiny dim" style="margin:0 0 12px">นักเรียน 1 คนผูกได้มากกว่า 1 บัญชี</p>
          ${linked.length ? linked.map((p) => `
            <div class="parent-line" data-parent="${p.user_id}">
              <div>
                <b>${e(p.name || p.email)}</b>
                <div class="tiny dim">${e(p.email || '')}${p.phone ? ` · ${e(p.phone)}` : ''}</div>
              </div>
              <button class="btn btn-ghost btn-sm" data-unlink="${p.link_id}" style="color:var(--red)">ถอด</button>
            </div>`).join('')
            : '<p class="tiny dim">ยังไม่มีผู้ปกครองผูกกับนักเรียนคนนี้</p>'}
          <button class="btn btn-primary btn-block btn-sm" id="d-add-parent" style="margin-top:12px">+ เพิ่มผู้ปกครอง</button>
        </aside>
      </div>`,
  });
}

/* ── เลือกผู้ปกครองมาผูก ───────────────────────────────── */
function openLinkModal(studentId, students, parents, ctx) {
  if (!parents.length) {
    toast('ยังไม่มีบัญชีผู้ปกครองในระบบ', 'error');
    return;
  }
  const student = students.find((s) => s.id === studentId);
  const linkedIds = new Set((student?.parents || []).map((p) => p.user_id));
  const list = parents.filter((p) => !linkedIds.has(p.user_id));

  openModal({
    title: 'เพิ่มผู้ปกครองให้นักเรียน',
    size: 'sm',
    body: `
      <p class="tiny dim" style="margin:0 0 10px">นักเรียน: <b>${e(student?.name || studentId)}</b></p>
      ${list.length ? `
        <input class="input" id="lp-search" placeholder="ค้นหาชื่อ/อีเมล/เบอร์" style="margin-bottom:10px">
        <div class="school-list" id="lp-list">
          ${list.map((p) => `<button class="pick-row" data-pick="${p.user_id}">
            <b>${e(p.name || p.email)}</b>
            <span class="tiny dim">${e(p.email || '')}${p.phone ? ` · ${e(p.phone)}` : ''}${p.line_id ? ` · ${e(p.line_id)}` : ''}</span>
          </button>`).join('')}
        </div>`
        : '<p class="tiny dim">ผู้ปกครองทุกคนถูกผูกกับนักเรียนคนนี้แล้ว</p>'}
      <p class="hint" style="margin-top:10px">ถ้าผู้ปกครองยังไม่มีบัญชี ให้เขาสมัครที่หน้าเข้าสู่ระบบก่อน แล้วกลับมาเพิ่มที่นี่</p>`,
    onMount: (root) => {
      const search = root.querySelector('#lp-search');
      search?.addEventListener('input', () => {
        const q = search.value.trim().toLowerCase();
        root.querySelectorAll('[data-pick]').forEach((el) => {
          const hit = el.innerText.toLowerCase().includes(q);
          el.style.display = hit ? '' : 'none';
        });
      });
      root.querySelectorAll('[data-pick]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            await ctx.data.linkParentStudent(studentId, btn.dataset.pick);
            toast('ผูกผู้ปกครองแล้ว', 'success');
            closeModal();
            location.reload();
          } catch (err) {
            btn.disabled = false;
            toast(err.message || 'ผูกไม่สำเร็จ', 'error');
          }
        });
      });
    },
  });
}

/* ── รายละเอียดผู้ปกครอง (ดู/แก้รหัส/ลบ) ───────────────── */
export async function openParentDetail(userId, ctx) {
  let data;
  try { data = await ctx.data.parentDetail(userId); } catch (err) {
    toast(err.message || 'โหลดข้อมูลผู้ปกครองไม่สำเร็จ', 'error');
    return;
  }

  openModal({
    title: data.name || data.email || 'ผู้ปกครอง',
    size: 'md',
    body: `
      <div class="kv"><span>อีเมล</span><b>${e(data.email || '—')}</b></div>
      <div class="kv"><span>เบอร์โทร</span><b>${e(data.phone || '—')}</b></div>
      <div class="kv"><span>LINE</span><b>${e(data.line_id || '—')}</b></div>
      <div class="kv"><span>ชำระแล้วรวม</span><b>฿${ctx.money(data.total_paid || 0)}</b></div>

      <div style="margin-top:14px" class="tiny dim">นักเรียนที่ผูกไว้ (${(data.students || []).length})</div>
      <div class="school-list" style="margin-top:6px">
        ${(data.students || []).length ? (data.students || []).map((s) => `
          <div class="parent-line">
            <div><b>${e(s.student_name || s.student_id)}</b>
              <div class="tiny dim">${e(s.student_code || '')} · ${e(s.org_name || s.org_id || '')}</div></div>
            <button class="btn btn-ghost btn-sm" data-unlink="${s.link_id}" style="color:var(--red)">ถอด</button>
          </div>`).join('') : '<span class="tiny dim">ยังไม่มีนักเรียน</span>'}
      </div>

      <div style="margin-top:16px;border-top:1px solid var(--book-line);padding-top:14px">
        <label class="tiny dim">รหัสผ่านของผู้ปกครองคนนี้ (ใช้ตอนล็อกอิน)</label>
        <div style="display:flex;gap:8px;margin-top:6px">
          <input class="input" id="pd-pass" value="${e(data.password || '')}" readonly>
          <button class="btn btn-ghost btn-sm" id="pd-edit">แก้ไข</button>
          <button class="btn btn-primary btn-sm" id="pd-save" style="display:none">บันทึก</button>
        </div>
      </div>`,
    footer: `<button class="btn btn-danger" type="button" data-del>ลบบัญชีผู้ปกครอง</button>
             <button class="btn btn-ghost" type="button" data-modal-close>ปิด</button>`,
    onMount: (root) => {
      const pass = root.querySelector('#pd-pass');
      root.querySelector('#pd-edit')?.addEventListener('click', () => {
        pass.readOnly = false;
        pass.focus();
        root.querySelector('#pd-edit').style.display = 'none';
        root.querySelector('#pd-save').style.display = '';
      });
      root.querySelector('#pd-save')?.addEventListener('click', async () => {
        try {
          await ctx.data.setParentPassword(userId, pass.value.trim());
          toast('เปลี่ยนรหัสผ่านแล้ว', 'success');
          pass.readOnly = true;
        } catch (err) { toast(err.message || 'ไม่สำเร็จ', 'error'); }
      });
      root.querySelectorAll('[data-unlink]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try {
            await ctx.data.unlinkStudent(btn.dataset.unlink);
            toast('ถอดนักเรียนออกแล้ว', 'success');
            closeModal();
            location.reload();
          } catch (err) { toast(err.message || 'ไม่สำเร็จ', 'error'); }
        });
      });
      root.querySelector('[data-del]')?.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'ลบบัญชีผู้ปกครอง',
          message: 'จะลบข้อมูลบัญชี คอร์สที่ซื้อ และการผูกนักเรียนทั้งหมดออกจาก Supabase — บัญชีนักเรียนไม่หาย แต่ผู้ปกครองต้องสมัครใหม่ถ้าจะกลับมาใช้',
          confirmLabel: 'ลบบัญชี', tone: 'danger',
        });
        if (!ok) return;
        try {
          await ctx.data.deleteParent(userId);
          toast('ลบบัญชีผู้ปกครองแล้ว', 'success');
          closeModal();
          location.reload();
        } catch (err) { toast(err.message || 'ลบไม่สำเร็จ', 'error'); }
      });
    },
  });
}
