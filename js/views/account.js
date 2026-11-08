/* ── บัญชีของฉัน + คะแนนนักเรียน ───────────────────────── */

import { CONFIG } from '../config.js';
import { toast } from '../ui.js';
import { e, thaiDate, thaiDateTime, longThaiDate } from '../utils.js';

export async function renderAccount(_arg, ctx) {
  const acc = ctx.me;
  const orders = await ctx.data.listMyOrders();
  const links = acc.role === 'parent' ? await ctx.data.listMyStudents() : [];
  const paid = orders.filter((o) => o.status === 'confirmed').reduce((s, o) => s + Number(o.amount || 0), 0);

  const html = `
  <div class="wrap" style="padding-top:30px">
    <div class="eyebrow">MY ACCOUNT</div>
    <h1 style="font-family:var(--brand-font);font-size:28px;margin:8px 0 18px">
      ${acc.role === 'parent' ? 'บัญชีของฉัน' : acc.role === 'owner' ? 'บัญชีเจ้าของระบบ' : 'บัญชีครู'}
    </h1>

    <div class="stat-row">
      <div class="stat-card"><div class="k">คำสั่งซื้อทั้งหมด</div><div class="v">${orders.length}<small>รายการ</small></div></div>
      <div class="stat-card"><div class="k">ชำระแล้ว</div><div class="v">${ctx.baht(paid)}</div></div>
      <div class="stat-card"><div class="k">นักเรียนที่ผูกไว้</div><div class="v">${links.length}<small>คน</small></div></div>
    </div>

    <div class="book-grid-2">
      <div class="book-card">
        <div class="eyebrow" style="margin-bottom:12px">ข้อมูลติดต่อ</div>
        <div class="field-row"><label>ชื่อที่แสดง</label>
          <input id="acc-name" value="${e(acc.name || '')}" maxlength="80"></div>
        <div class="field-row"><label>เบอร์โทร</label>
          <input id="acc-phone" value="${e(acc.phone || '')}" placeholder="089-123-4567" maxlength="32"></div>
        <div class="field-row"><label>LINE ID</label>
          <input id="acc-line" value="${e(acc.line_id || '')}" placeholder="line id" maxlength="60"></div>
        <button class="btn btn-ghost btn-block btn-sm" id="acc-save">บันทึกข้อมูล</button>
        <p class="hint" style="margin-top:8px">อีเมล: ${e(acc.email || '')}</p>
      </div>

      <div class="book-card">
        <div class="eyebrow" style="margin-bottom:12px">คอร์สที่ซื้อ</div>
        ${orders.length ? `<div class="table-wrap"><table class="book-table">
          <thead><tr><th>คอร์ส</th><th>ผู้เรียน</th><th>ยอด</th><th>สถานะ</th><th></th></tr></thead>
          <tbody>${orders.map((o) => `<tr>
            <td>${e(o.course_title)}<div class="tiny dim">${e(thaiDate(o.created_at))}</div></td>
            <td>${e(o.student_name || '—')}</td>
            <td>${ctx.baht(o.amount)}</td>
            <td>${ctx.statusBadge(o.status)}</td>
            <td>${o.status === 'pending_payment'
              ? `<a class="btn btn-primary btn-sm" href="#/checkout/${o.id}">ชำระเงิน</a>`
              : `<a class="btn btn-ghost btn-sm" href="#/checkout/${o.id}">ดู</a>`}</td>
          </tr>`).join('')}</tbody>
        </table></div>`
          : `<div class="empty-soft" style="padding:24px"><b>ยังไม่มีคำสั่งซื้อ</b>
              <a class="btn btn-primary btn-sm" href="#/courses">ดูคอร์สที่เปิดอยู่</a></div>`}
      </div>
    </div>

    ${acc.role === 'parent' ? `
    <div class="book-card" style="margin-top:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <div>
          <div class="eyebrow">MY STUDENTS</div>
          <div style="font-family:var(--brand-font);font-size:18px;margin-top:6px">บุตรหลานของฉัน (${links.length})</div>
        </div>
        <a class="btn btn-primary btn-sm" href="#/scores">ดูคะแนนนักเรียน</a>
      </div>
      <div style="margin-top:14px">
        ${links.length
          ? `<div style="display:flex;gap:8px;flex-wrap:wrap">${links.map((l) => `
              <span class="seat-badge">${e(l.student_name || l.student_id)}${l.student_code ? ` · ${e(l.student_code)}` : ''}</span>`).join('')}</div>`
          : `<p class="tiny dim" style="margin:0;line-height:1.8">
              ยังไม่มีข้อมูลนักเรียน — ติดต่อ Line : ${e(CONFIG.CONTACT.lineId)}
              หรือครูในโรงเรียนเพื่อเพิ่มข้อมูลนักเรียนของท่าน</p>`}
      </div>
    </div>` : ''}
  </div>`;

  setTimeout(() => {
    document.getElementById('app').querySelector('#acc-save')?.addEventListener('click', async (ev) => {
      const btn = ev.currentTarget;
      btn.disabled = true;
      try {
        await ctx.data.updateAccount({
          name: document.getElementById('acc-name').value.trim(),
          phone: document.getElementById('acc-phone').value.trim(),
          line_id: document.getElementById('acc-line').value.trim(),
        });
        toast('บันทึกแล้ว', 'success');
        ctx.header();
      } catch (err) {
        toast(err.message || 'บันทึกไม่สำเร็จ', 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }, 0);

  return html;
}

/* ── หน้าคะแนนนักเรียน ─────────────────────────────────── */
export async function renderScores(studentId, ctx) {
  if (ctx.me?.role === 'teacher') { location.hash = '#/portal'; return ''; }

  const isParent = ctx.me?.role === 'parent';
  const links = isParent ? await ctx.data.listMyStudents() : [];
  const students = links.map((l) => ({ id: l.student_id, name: l.student_name, code: l.student_code }));

  if (isParent && !students.length) {
    return `<div class="wrap" style="padding-top:40px"><div class="empty-soft">
      <b>ยังไม่มีข้อมูลนักเรียนของท่าน</b>
      <p class="tiny dim" style="line-height:1.9">ติดต่อ Line : ${e(CONFIG.CONTACT.lineId)}
        หรือครูในโรงเรียนเพื่อเพิ่มข้อมูลนักเรียนของท่าน</p>
    </div></div>`;
  }

  if (!studentId) {
    if (isParent) {
      if (students.length === 1) { location.hash = `#/scores/${encodeURIComponent(students[0].id)}`; return ''; }
      return `<div class="wrap" style="padding-top:34px">
        <div class="eyebrow">SCORES</div>
        <h1 style="font-family:var(--brand-font);font-size:26px;margin:8px 0 18px">เลือกนักเรียน</h1>
        <div class="course-grid">
          ${students.map((s) => `<a class="book-card" href="#/scores/${encodeURIComponent(s.id)}" style="text-decoration:none;color:inherit">
            <div style="font-family:var(--brand-font);font-size:18px">${e(s.name || s.id)}</div>
            <div class="tiny dim">${e(s.code || '')}${s.code ? ' · ' : ''}ดูคะแนนและข้อที่ผิด</div>
          </a>`).join('')}
        </div>
      </div>`;
    }
    return `<div class="wrap" style="padding-top:40px"><div class="empty-soft"><b>ต้องเข้าสู่ระบบก่อน</b>
      <a class="btn btn-primary btn-sm" href="#/login">เข้าสู่ระบบ</a></div></div>`;
  }

  const report = await ctx.data.studentReport(studentId);
  if (!report) {
    return `<div class="wrap" style="padding-top:40px"><div class="empty-soft"><b>ไม่พบข้อมูลนักเรียนคนนี้</b>
      <a class="btn btn-ghost btn-sm" href="#/scores">ย้อนกลับ</a></div></div>`;
  }

  const exams = (report.exams || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const scored = exams.filter((x) => x.percent !== null);
  const avg = scored.length ? Math.round(scored.reduce((s, x) => s + Number(x.percent), 0) / scored.length) : null;
  const first = scored[0];
  const last = scored[scored.length - 1];
  const delta = first && last ? Number(last.percent) - Number(first.percent) : null;
  const maxPct = Math.max(100, ...scored.map((x) => Number(x.percent)));

  const bars = scored.map((x) => `<div class="bar" style="height:${Math.max(6, (Number(x.percent) / maxPct) * 100)}%"
      title="${e(x.title)} · ${x.percent}%"><span>${x.percent}%</span></div>`).join('');

  const rows = exams.slice().reverse().map((x) => `
    <div class="q-row" style="display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap">
      <div>
        <div style="font-family:var(--brand-font);font-size:15px">${e(x.title)}</div>
        <div class="tiny dim">${e(x.subject || '')}${x.topic ? ` · ${e(x.topic)}` : ''}</div>
        <div class="tiny dim">${x.date ? e(thaiDateTime(x.date)) : ''}</div>
      </div>
      <div style="text-align:right">
        ${x.showScore
          ? `<div class="price" style="font-size:20px">${x.score}/${x.max}</div><div class="tiny dim">${x.percent}%</div>`
          : `<div class="tiny dim">ครูยังไม่ประกาศคะแนน</div>`}
        <a class="btn btn-ghost btn-sm" href="#/scores/${encodeURIComponent(studentId)}?exam=${encodeURIComponent(x.examId)}">ดูข้อที่ผิด</a>
      </div>
    </div>`).join('');

  const examParam = ctx.route?.query.get('exam');
  const detail = examParam ? exams.find((x) => x.examId === examParam) : null;

  return `
  <div class="wrap" style="padding-top:30px">
    <a class="tiny dim" href="#/scores" style="text-decoration:none">← ${isParent ? 'รายชื่อนักเรียน' : 'ย้อนกลับ'}</a>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin:14px 0 18px">
      <div>
        <div class="eyebrow">STUDENT SCORES</div>
        <h1 style="font-family:var(--brand-font);font-size:27px;margin:6px 0 4px">${e(report.student?.name || '')}</h1>
        <div class="tiny dim">${e(report.student?.code || '')}${report.student?.class ? ` · ${e(report.student.class)}` : ''}${report.student?.orgName ? ` · ${e(report.student.orgName)}` : ''}</div>
      </div>
      <div class="stat-row" style="margin:0;grid-template-columns:repeat(3,minmax(110px,1fr))">
        <div class="stat-card"><div class="k">ชุดที่ทำแล้ว</div><div class="v">${exams.length}<small>ชุด</small></div></div>
        <div class="stat-card"><div class="k">คะแนนเฉลี่ย</div><div class="v">${avg === null ? '—' : `${avg}%`}</div></div>
        <div class="stat-card"><div class="k">พัฒนาการ</div>
          <div class="v" style="color:${delta === null ? 'inherit' : delta >= 0 ? 'var(--green)' : 'var(--red)'}">
            ${delta === null ? '—' : `${delta >= 0 ? '+' : ''}${delta}%`}</div></div>
      </div>
    </div>

    <div class="book-card" style="margin-bottom:20px">
      <div class="eyebrow" style="margin-bottom:10px">พัฒนาการตามลำดับที่ทำ (เก่าสุด → ล่าสุด)</div>
      ${scored.length ? `<div class="score-spark">${bars}</div>` : `<p class="tiny dim">ยังไม่มีชุดที่ประกาศคะแนน</p>`}
    </div>

    <div class="book-card">
      <div class="eyebrow" style="margin-bottom:6px">ประวัติการทำข้อสอบ</div>
      ${exams.length ? rows : `<p class="tiny dim">ยังไม่มีประวัติการทำข้อสอบ</p>`}
    </div>

    ${detail ? `
    <div class="book-card" style="margin-top:20px">
      <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div>
          <div class="eyebrow">EXAM DETAIL</div>
          <div style="font-family:var(--brand-font);font-size:19px;margin-top:6px">${e(detail.title)}</div>
          <div class="tiny dim">${e(detail.subject || '')}${detail.teacherName ? ` · ${e(detail.teacherName)}` : ''}</div>
        </div>
        ${detail.showScore ? `<div class="price" style="font-size:24px">${detail.score}/${detail.max}</div>` : ''}
      </div>
      <div style="margin-top:14px">
        ${detail.showSolutions
          ? (detail.questions || []).map((q, i) => questionRow(q, i)).join('')
          : `<p class="tiny dim">ครูยังไม่เปิดให้ดูเฉลยของชุดนี้</p>`}
      </div>
    </div>` : ''}
  </div>`;
}

function questionRow(q, i) {
  const ans = String(q.answer ?? '');
  const correct = String(q.correct ?? '');
  const isRight = ans !== '' && correct !== '' && ans.trim().toLowerCase() === correct.trim().toLowerCase();
  const pending = q.manual && Number(q.manual.score) !== undefined && !correct;

  const options = Array.isArray(q.options) && q.options.length
    ? q.options.map((o) => {
        const chosen = String(o.id) === ans;
        const isCorrectOpt = String(o.id) === correct;
        const cls = ['q-opt'];
        if (isCorrectOpt) cls.push('is-correct');
        else if (chosen) cls.push('is-wrong');
        if (chosen) cls.push('is-chosen');
        return `<div class="${cls.join(' ')}">${e(o.id)}. ${e(o.text)}${chosen ? ' ← เลือก' : ''}${isCorrectOpt && !chosen ? ' ✓ เฉลย' : ''}</div>`;
      }).join('')
    : '';

  return `
  <div class="q-row">
    <div class="q-head">
      <span class="seat-badge">ข้อ ${i + 1}</span>
      <span class="seat-badge">${e(q.points)} คะแนน</span>
      <span class="seat-badge" style="${isRight ? 'background:var(--green-soft);color:var(--green)' : ans ? 'background:var(--red-soft);color:var(--red)' : ''}">
        ${isRight ? 'ถูก' : ans ? 'ผิด' : 'ไม่ได้ตอบ'}${pending ? ` (ตรวจแล้ว ${q.manual.score})` : ''}</span>
    </div>
    <div style="line-height:1.8">${e(q.text || '')}</div>
    ${options}
    ${q.type === 'short' ? `<div class="q-answer">ตอบ: <b>${e(ans || '—')}</b>${correct ? ` · เฉลย: ${e(correct)}` : ''}</div>` : ''}
    ${q.explanation ? `<div class="q-answer">คำอธิบาย: ${e(q.explanation)}</div>` : ''}
  </div>`;
}
