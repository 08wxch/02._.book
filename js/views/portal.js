/* ── หน้าครู: จัดการนักเรียนของผู้ปกครองในหน่วยงานตัวเอง ── */

import { toast, confirmDialog } from '../ui.js';
import { e, thaiDate } from '../utils.js';

export async function renderPortal(_arg, ctx) {
  const acc = ctx.me;
  const [accounts, links, roster] = await Promise.all([
    ctx.data.listAccounts(),
    ctx.data.listAllLinks(),
    ctx.data.listMockRoster().catch(() => ({ students: [], organizations: [], orgId: '' })),
  ]);

  const orgId = roster?.orgId || acc.org_id || '';
  const orgName = (roster?.organizations || []).find((o) => o.id === orgId)?.name || acc.org_hint || orgId || 'ยังไม่ได้กำหนดหน่วยงาน';
  const parents = accounts.filter((a) => a.role === 'parent');
  const students = roster?.students || [];

  const byParent = {};
  links.forEach((l) => { (byParent[l.user_id] = byParent[l.user_id] || []).push(l); });

  const body = `
    ${!orgId ? `<div class="book-card" style="margin-bottom:18px">
      <b>ยังไม่ได้ผูกหน่วยงาน</b>
      <p class="tiny dim" style="margin:6px 0 0">ติดต่อเจ้าของระบบเพื่อกำหนดหน่วยงานให้บัญชีของคุณก่อนใช้งาน</p></div>` : ''}

    <div class="stat-row">
      <div class="stat-card"><div class="k">ผู้ปกครองในระบบ</div><div class="v">${parents.length}<small>คน</small></div></div>
      <div class="stat-card"><div class="k">นักเรียนในหน่วยงาน</div><div class="v">${students.length}<small>คน</small></div></div>
      <div class="stat-card"><div class="k">ผูกแล้ว</div><div class="v">${links.filter((l) => l.org_id === orgId).length}<small>รายการ</small></div></div>
    </div>

    <div class="book-card" style="margin-bottom:20px">
      <div style="font-family:var(--brand-font);font-size:16px;margin-bottom:4px">เพิ่มนักเรียนให้ผู้ปกครอง</div>
      <p class="tiny dim" style="margin:0 0 14px">เลือกผู้ปกครอง แล้วเลือกนักเรียนในหน่วยงานของคุณ</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
        <div class="field-row" style="flex:1;min-width:220px;margin:0">
          <label>ผู้ปกครอง</label>
          <select id="p-parent">${parents.map((p) => `<option value="${p.user_id}">${e(p.name || p.email)} · ${e(p.email || '')}</option>`).join('')}</select>
        </div>
        <div class="field-row" style="flex:1;min-width:220px;margin:0">
          <label>นักเรียน (ในหน่วยงานของคุณ)</label>
          <select id="p-student">${students.map((s) => `<option value="${s.id}">${e(s.name)} · ${e(s.code)}</option>`).join('')}</select>
        </div>
        <button class="btn btn-primary" id="p-add" ${students.length ? '' : 'disabled'}>เพิ่ม</button>
      </div>
      ${students.length ? '' : '<p class="hint" style="margin-top:10px">ยังไม่มีนักเรียนในหน่วยงานนี้ — ให้เจ้าของระบบเพิ่มนักเรียนใน 02._.mock ก่อน</p>'}
    </div>

    <div class="book-card">
      <div style="font-family:var(--brand-font);font-size:16px;margin-bottom:10px">ผู้ปกครอง &amp; นักเรียนที่ผูกไว้</div>
      ${parents.length ? `<div class="table-wrap"><table class="book-table">
        <thead><tr><th>ผู้ปกครอง</th><th>ติดต่อ</th><th>นักเรียน</th></tr></thead>
        <tbody>${parents.map((p) => `
          <tr>
            <td>${e(p.name || '—')}<div class="tiny dim">${e(thaiDate(p.created_at))}</div></td>
            <td class="tiny">${e(p.phone || '—')}<div class="tiny dim">${e(p.line_id || '')}</div></td>
            <td>${(byParent[p.user_id] || []).filter((l) => l.org_id === orgId).map((l) => `
              <span class="seat-badge" style="margin:2px 4px 2px 0;display:inline-block">
                ${e(l.student_name || l.student_id)}
                <button data-unlink="${l.id}" aria-label="เอาออก" style="border:0;background:none;cursor:pointer;color:var(--red);padding:0 0 0 4px">✕</button>
              </span>`).join('') || '<span class="tiny dim">ยังไม่มี</span>'}</td>
          </tr>`).join('')}</tbody>
      </table></div>` : `<p class="tiny dim">ยังไม่มีผู้ปกครองในระบบ</p>`}
    </div>`;

  const html = ctx.consoleLayout({
    items: [
      { href: '#/portal', label: 'จัดการนักเรียน', active: true },
      { href: '#/scores', label: 'ดูคะแนนนักเรียน' },
    ],
    title: 'จัดการนักเรียน',
    subtitle: `หน่วยงาน: <b>${e(orgName)}</b> — เห็นและจัดการได้เฉพาะนักเรียนในหน่วยงานนี้`,
    body,
  });

  setTimeout(() => {
    const root = document.getElementById('app');
    root.querySelector('#p-add')?.addEventListener('click', async (ev) => {
      const parentId = root.querySelector('#p-parent')?.value;
      const studentId = root.querySelector('#p-student')?.value;
      if (!parentId || !studentId) { toast('เลือกผู้ปกครองและนักเรียน', 'error'); return; }
      ev.currentTarget.disabled = true;
      try {
        await ctx.data.linkStudent(parentId, studentId);
        toast('เพิ่มนักเรียนให้ผู้ปกครองแล้ว', 'success');
        location.reload();
      } catch (err) {
        ev.currentTarget.disabled = false;
        toast(err.message || 'เพิ่มไม่สำเร็จ', 'error');
      }
    });

    root.querySelectorAll('[data-unlink]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog({ title: 'เอานักเรียนออก', message: 'เอานักเรียนคนนี้ออกจากบัญชีผู้ปกครอง?', confirmLabel: 'เอาออก', tone: 'danger' });
        if (!ok) return;
        try {
          await ctx.data.unlinkStudent(btn.dataset.unlink);
          toast('เอาออกแล้ว', 'success');
          location.reload();
        } catch (err) { toast(err.message || 'ไม่สำเร็จ', 'error'); }
      });
    });
  }, 0);

  return html;
}
