/* ── บัญชีของฉัน + คะแนนนักเรียน ───────────────────────── */

import { CONFIG } from '../config.js';
import { toast } from '../ui.js';
import { e, thaiDate, thaiDateTime } from '../utils.js';
import { hydrateMath, mathAttr, renderMathInHtml } from '../latex.js';

export async function renderAccount(_arg, ctx) {
  const acc = ctx.me;
  const orders = await ctx.data.listMyOrders();
  const links = acc.role === 'parent' ? await ctx.data.listMyStudents() : [];
  const paid = orders.filter((o) => o.status === 'confirmed').reduce((s, o) => s + Number(o.amount || 0), 0);

  const html = `
  <div class="wrap" style="padding-top:30px">
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
        <div class="field-row"><label>ชื่อที่แสดง</label>
          <input id="acc-name" value="${e(acc.name || '')}" maxlength="80"></div>
        <div class="field-row"><label>เบอร์โทร</label>
          <input id="acc-phone" value="${e(acc.phone || '')}" placeholder="089-123-4567" maxlength="32"></div>
        <div class="field-row"><label>LINE ID</label>
          <input id="acc-line" value="${e(acc.line_id || '')}" placeholder="line id" maxlength="60"></div>
        <button class="btn btn-ghost btn-block btn-sm" id="acc-save">บันทึกข้อมูล</button>

        <div style="border-top:1px solid var(--book-line);margin-top:16px;padding-top:14px">
          <div style="font-family:var(--brand-font);font-size:15px;margin-bottom:8px">เปลี่ยนรหัสผ่าน</div>
          <div class="field-row"><label>รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)</label>
            <input id="acc-pass" type="password" placeholder="รหัสผ่านใหม่" autocomplete="new-password"></div>
          <div class="field-row"><label>ยืนยันรหัสผ่านใหม่</label>
            <input id="acc-pass2" type="password" placeholder="พิมพ์ซ้ำ" autocomplete="new-password"></div>
          <button class="btn btn-primary btn-block btn-sm" id="acc-pass-save">เปลี่ยนรหัสผ่าน</button>
        </div>
        <p class="hint" style="margin-top:8px">อีเมล: ${e(acc.email || '')}</p>
      </div>

      <div class="book-card">
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

/* ── หน้าคะแนนนักเรียน (ภาพรวม) ─────────────────────────── */
export async function renderScores(studentId, ctx) {
  if (ctx.me?.role === 'teacher') { location.hash = '#/portal'; return ''; }

  const isParent = ctx.me?.role === 'parent';
  const links = isParent ? await ctx.data.listMyStudents() : [];
  const students = links.map((l) => ({ id: l.student_id, name: l.student_name, code: l.student_code }));

  if (isParent && !students.length) {
    return `<div class="wrap" style="padding-top:44px;max-width:620px">
      <div class="empty-soft">
        <b>ยังไม่มีข้อมูลนักเรียนของท่าน</b>
        <p class="tiny dim" style="line-height:1.9;margin:0">
          ติดต่อ Line : <b>${e(CONFIG.CONTACT.lineId)}</b><br>หรือครูในโรงเรียนเพื่อเพิ่มข้อมูลนักเรียนของท่าน</p>
      </div>
    </div>`;
  }

  if (!studentId) {
    if (isParent) {
      if (students.length === 1) { location.hash = `#/scores/${encodeURIComponent(students[0].id)}`; return ''; }
      return `<div class="wrap" style="padding-top:34px">
        <h1 style="font-family:var(--brand-font);font-size:26px;margin:8px 0 6px">เลือกนักเรียน</h1>
        <p class="tiny dim" style="margin:0 0 18px">ดูคะแนนและข้อที่ผิดของบุตรหลานแต่ละคน</p>
        <div class="course-grid">
          ${students.map((s) => `<a class="course-card" href="#/scores/${encodeURIComponent(s.id)}" style="text-decoration:none;color:inherit">
            <div class="course-card__body" style="padding:20px">
              <div style="font-family:var(--brand-font);font-size:19px">${e(s.name || s.id)}</div>
              <div class="tiny dim">${e(s.code || '')}</div>
              <div class="course-card__foot"><span class="tiny dim">ดูคะแนน &amp; ข้อที่ผิด</span>
                <span class="seat-badge">เปิด</span></div>
            </div>
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

  return `<div class="wrap" style="padding-top:28px">
    <a class="tiny dim" href="#/scores" style="text-decoration:none">← รายชื่อนักเรียน</a>
    <div style="margin-top:12px">${studentOverviewHtml(report, ctx, { studentId })}</div>
  </div>`;
}

export function studentOverviewHtml(report, ctx, opts = {}) {
  const studentId = opts.studentId || report.student?.id || '';
  const backHref = opts.backHref || '#/scores';
  const backLabel = opts.backLabel || 'ย้อนกลับ';
  const exams = (report.exams || []).slice().sort((a, b) => new Date(a.date) - new Date(b.date));
  const scored = exams.filter((x) => x.percent !== null && x.percent !== undefined);
  const avg = scored.length ? Math.round(scored.reduce((s, x) => s + Number(x.percent), 0) / scored.length) : null;
  const first = scored[0];
  const last = scored[scored.length - 1];
  const delta = first && last && scored.length > 1 ? Math.round(Number(last.percent) - Number(first.percent)) : null;
  const trendWord = delta === null ? '' : delta > 0 ? 'ดีขึ้น' : delta < 0 ? 'ลดลง' : 'คงที่';

  const rows = exams.slice().reverse().map((x) => `
    <div class="exam-item">
      <div>
        <div class="t">${e(x.title)}</div>
        <div class="sub">${e(x.subject || '')}${x.topic ? ` · ${e(x.topic)}` : ''}${x.date ? ` · ${e(thaiDate(x.date))}` : ''}</div>
      </div>
      <div style="display:flex;align-items:center;gap:14px">
        ${x.showScore
          ? `<div class="exam-score">${x.score}/${x.max}<small>${x.percent}%</small></div>`
          : `<div class="tiny dim">ครูยังไม่ประกาศคะแนน</div>`}
        <a class="btn btn-ghost btn-sm" href="#/scores/${encodeURIComponent(studentId)}/exam/${encodeURIComponent(x.examId)}">ดูข้อที่ผิด →</a>
      </div>
    </div>`).join('');

  const heroHtml = opts.hideHero ? '' : `
    <div class="score-hero" style="margin-top:12px">
      <div>
        <h1>${e(report.student?.name || '')}</h1>
        <div class="tiny dim">
          ${report.student?.code ? `รหัส ${e(report.student.code)}` : ''}
          ${report.student?.class ? ` · ${e(report.student.class)}` : ''}
          ${report.student?.orgName ? ` · ${e(report.student.orgName)}` : ''}
        </div>
      </div>
      <div class="score-kpis">
        <div class="score-kpi"><div class="k">ชุดที่ทำแล้ว</div><div class="v">${exams.length}</div></div>
        <div class="score-kpi"><div class="k">คะแนนเฉลี่ย</div><div class="v">${avg === null ? '—' : `${avg}%`}</div></div>
        <div class="score-kpi"><div class="k">${scored.length > 1 ? 'พัฒนาการ (ชุดแรก→ล่าสุด)' : 'พัฒนาการ'}</div>
          <div class="v ${delta === null ? '' : delta > 0 ? 'up' : delta < 0 ? 'down' : ''}">
            ${delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta}%`}</div>
          ${trendWord ? `<div class="tiny dim">${trendWord}</div>` : ''}</div>
      </div>
    </div>`;

  return `
  <div>
    ${heroHtml}

    <div class="book-card line-card" style="margin-bottom:18px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap">
        <div style="font-family:var(--brand-font);font-size:16px">เส้นพัฒนาการ</div>
        <div class="tiny dim">เปอร์เซ็นต์ที่ได้ในแต่ละชุด เรียงจากเก่าสุด → ล่าสุด</div>
      </div>
      ${scored.length
        ? lineChart(scored)
        : `<p class="tiny dim" style="padding:16px 0">ยังไม่มีชุดที่ครูประกาศคะแนน</p>`}
    </div>

    <div class="book-card">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap">
        <div style="font-family:var(--brand-font);font-size:16px">ชุดข้อสอบที่เคยทำ (${exams.length})</div>
        <div class="tiny dim">กด "ดูข้อที่ผิด" เพื่อเปิดดูทีละข้อ</div>
      </div>
      ${exams.length ? `<div class="exam-list" style="margin-top:8px">${rows}</div>` : `<p class="tiny dim">ยังไม่มีประวัติการทำข้อสอบ</p>`}
    </div>
  </div>`;
}

/* ── หน้าโจทย์ของชุดสอบหนึ่งชุด (entry แยก) ───────────── */
export async function renderExamDetail(_arg, ctx) {
  const parts = (ctx.route?.path || '').split('/').filter(Boolean); // scores / :student / exam / :exam
  const studentId = decodeURIComponent(parts[1] || '');
  const examId = decodeURIComponent(parts[3] || '');
  if (!studentId || !examId) { location.hash = '#/scores'; return ''; }

  const report = await ctx.data.studentReport(studentId);
  const exam = (report?.exams || []).find((x) => x.examId === examId);
  if (!report || !exam) {
    return `<div class="wrap" style="padding-top:40px"><div class="empty-soft"><b>ไม่พบชุดข้อสอบนี้</b>
      <a class="btn btn-ghost btn-sm" href="#/scores/${encodeURIComponent(studentId)}">ย้อนกลับ</a></div></div>`;
  }

  const qs = exam.questions || [];
  const right = qs.filter((q) => isAnswerRight(q, exam.showSolutions)).length;
  const blank = qs.filter((q) => String(q.answer ?? '') === '').length;
  const wrong = qs.length - right - blank;

  const runMath = () => hydrateMath(document.getElementById('app') || document);
  setTimeout(runMath, 0);
  setTimeout(runMath, 600);

  return `
  <div class="wrap" style="padding-top:28px">
    <a class="tiny dim" href="#/scores/${encodeURIComponent(studentId)}" style="text-decoration:none">← กลับหน้าคะแนนของ ${e(report.student?.name || 'นักเรียน')}</a>

    ${opts.hideHero ? '' : `<div class="score-hero" style="margin-top:12px">`}
      <div>
        <h1>${e(exam.title)}</h1>
        <div class="tiny dim">
          ${e(exam.subject || '')}${exam.topic ? ` · ${e(exam.topic)}` : ''}
          ${exam.teacherName ? ` · ${e(exam.teacherName)}` : ''}
          ${exam.date ? ` · ส่งเมื่อ ${e(thaiDate(exam.date))}` : ''}
        </div>
      </div>
      ${exam.showScore
        ? `<div class="exam-score" style="font-size:26px">${exam.score}/${exam.max}<small>${exam.percent}%</small></div>`
        : ''}
    </div>

    ${qs.length ? `<div class="q-meta" style="margin-bottom:16px">
      <span class="chip chip--ok">ตอบถูก ${right} ข้อ</span>
      <span class="chip chip--bad">ตอบผิด ${wrong} ข้อ</span>
      <span class="chip chip--mute">ไม่ได้ตอบ ${blank} ข้อ</span>
      <span class="chip chip--mute">ทั้งหมด ${qs.length} ข้อ</span>
    </div>` : ''}

    ${!exam.showSolutions
      ? `<div class="empty-soft"><b>ครูยังไม่เปิดให้ดูเฉลยของชุดนี้</b>
           <p class="tiny dim" style="margin:0">พอครูประกาศผลแล้ว กลับมาดูได้อีกครั้ง</p></div>`
      : `<div id="question-list">${qs.map((q, i) => questionCard(q, i)).join('')}</div>`}
  </div>`;
}

/* ── กราฟเส้น (SVG) ───────────────────────────────────── */
function lineChart(points) {
  const W = 640, H = 190, padL = 40, padR = 26, padTop = 30, padBottom = 30;
  const n = points.length;
  const values = points.map((p) => Number(p.percent));
  const rawMax = Math.max(...values);
  const rawMin = Math.min(...values);

  // ปรับช่วงแกนให้เห็นความเปลี่ยนแปลงชัด ๆ (ไม่ตรึง 0–100)
  let hi = Math.min(100, Math.ceil((rawMax + 8) / 5) * 5);
  let lo = Math.max(0, Math.floor((rawMin - 8) / 5) * 5);
  if (hi - lo < 20) { hi = Math.min(100, lo + 20); lo = Math.max(0, hi - 20); }
  if (hi === lo) hi = Math.min(100, lo + 10);

  const stepX = n > 1 ? (W - padL - padR) / (n - 1) : 0;
  const yOf = (v) => padTop + (1 - (v - lo) / (hi - lo)) * (H - padTop - padBottom);
  const xOf = (i) => padL + i * stepX;

  const pts = points.map((p, i) => ({
    x: xOf(i), y: yOf(Number(p.percent)), v: Number(p.percent),
    label: p.date ? thaiDate(p.date) : '', title: p.title,
  }));

  const best = Math.max(...pts.map((p) => p.v));
  const low = Math.min(...pts.map((p) => p.v));
  const line = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${padL},${(H - padBottom).toFixed(1)} ${line} ${(W - padR).toFixed(1)},${(H - padBottom).toFixed(1)}`;
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const grid = ticks.map((v) => {
    const y = yOf(v);
    return `<line class="grid-line" x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}"/>
      <text class="axis-label" x="${padL - 8}" y="${(y + 3).toFixed(1)}" text-anchor="end">${v}</text>`;
  }).join('');

  const labels = pts.map((p) => {
    const above = p.y > padTop + 16;
    return `<text class="val" x="${p.x.toFixed(1)}" y="${(above ? p.y - 11 : p.y + 18).toFixed(1)}" text-anchor="middle">${p.v}%</text>`;
  }).join('');

  return `
  <svg class="line-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img"
       aria-label="กราฟเส้นพัฒนาการ: ${pts.map((p) => `${p.v}%`).join(', ')}">
    <defs>
      <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#2b2823" stop-opacity=".16"/>
        <stop offset="100%" stop-color="#2b2823" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${grid}
    ${n > 1 ? `<polygon class="line-area" points="${area}"/>` : ''}
    ${n > 1 ? `<polyline class="line-path" points="${line}"/>` : ''}
    ${pts.map((p) => `
      <circle class="dot${p.v === best && n > 1 ? ' is-best' : p.v === low && n > 1 ? ' is-low' : ''}"
        cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5"/>`).join('')}
    ${labels}
  </svg>
  <div class="chart-x">${pts.map((p) => `<span>${e(p.label)}</span>`).join('')}</div>`;
}

/* ── การ์ดคำถาม 1 ข้อ ─────────────────────────────────── */
function isAnswerRight(q, showSolutions) {
  if (!showSolutions) return false;
  const ans = String(q.answer ?? '').trim().toLowerCase();
  const correct = String(q.correct ?? '').trim().toLowerCase();
  return Boolean(ans) && Boolean(correct) && ans === correct;
}

function questionCard(q, i) {
  const ans = String(q.answer ?? '');
  const correct = String(q.correct ?? '');
  const isRight = ans !== '' && correct !== '' && ans.trim().toLowerCase() === correct.trim().toLowerCase();
  const blank = ans === '';
  const cls = blank ? 'is-blank' : isRight ? 'is-right' : 'is-wrong';
  const manual = q.manual && q.manual.score !== undefined && q.manual.score !== null;
  const typeLabel = { mcq: 'เลือกตอบ', truefalse: 'ถูก/ผิด', short: 'ตอบสั้น', essay: 'อัตนัย' }[q.type] || q.type;

  const options = Array.isArray(q.options) && q.options.length
    ? q.options.map((o) => {
        const chosen = String(o.id) === ans;
        const isCorrectOpt = correct !== '' && String(o.id) === correct;
        const c = ['q-opt'];
        if (isCorrectOpt) c.push('is-correct');
        else if (chosen) c.push('is-wrong');
        if (chosen) c.push('is-chosen');
        return `<div class="${c.join(' ')}"><span class="opt-id">${e(o.id)}.</span>
          <span ${mathAttr(o.text)}>${e(o.text)}</span>${
          chosen ? ' <span class="chip chip--mute">เลือก</span>' : ''
        }${isCorrectOpt && !chosen ? ' <span class="chip chip--ok">เฉลย</span>' : ''}</div>`;
      }).join('')
    : '';

  return `
  <div class="q-card ${cls}">
    <div class="q-meta">
      <span class="chip chip--mute">ข้อ ${i + 1}</span>
      <span class="chip chip--mute">${e(typeLabel)}</span>
      <span class="chip chip--mute">${e(q.points)} คะแนน</span>
      <span class="chip ${isRight ? 'chip--ok' : blank ? 'chip--mute' : 'chip--bad'}">${
        isRight ? 'ตอบถูก' : blank ? 'ไม่ได้ตอบ' : 'ตอบผิด'}${manual ? ` · ตรวจแล้ว ${e(String(q.manual.score))}` : ''}</span>
    </div>
    <div class="q-text" ${mathAttr(q.text)}>${e(q.text || '')}</div>
    ${options}
    ${(q.type === 'short' || q.type === 'essay')
      ? `<div class="q-answer">ตอบ: <b ${mathAttr(ans || '—')}>${e(ans || '—')}</b>${
          correct ? ` · เฉลย: <b ${mathAttr(correct)}>${e(correct)}</b>` : ''}</div>` : ''}
    ${q.explanation ? `<div class="q-answer">คำอธิบาย: <span ${mathAttr(q.explanation)}>${e(q.explanation)}</span></div>` : ''}
    ${q.manual && q.manual.comment ? `<div class="q-comment">ความคิดเห็นครู: <span ${mathAttr(q.manual.comment)}>${e(q.manual.comment)}</span></div>` : ''}
  </div>`;
}
