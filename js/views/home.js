/* ── หน้าแรก / รายการคอร์ส ─────────────────────────────── */

import { CONFIG } from '../config.js';
import { e } from '../utils.js';

const STEPS = [
  ['1', 'สมัคร/เข้าสู่ระบบ', 'ใช้อีเมลของคุณเป็นบัญชี — ใช้ครั้งต่อไปก็เข้าได้เลย'],
  ['2', 'เลือกคอร์สที่ต้องการ', 'ดูรายละเอียด จำนวนชั่วโมง และที่นั่งที่เหลือ'],
  ['3', 'สแกนพร้อมเพย์', 'จ่ายผ่าน QR แล้วอัปโหลดสลิปในหน้าเดียวกัน'],
  ['4', 'รอครูยืนยัน', 'เมื่อยืนยันแล้ว สถานะจะเปลี่ยนเป็น "ยืนยันแล้ว" ทันที'],
];

export async function renderHome(_arg, ctx) {
  const courses = await ctx.data.listCourses();
  const isCoursesPage = ctx.route?.path === '/courses';

  const cards = courses.length
    ? courses.map((c) => ctx.appCourseCard?.(c) || courseCardMarkup(c, ctx)).join('')
    : `<div class="empty-soft" style="grid-column:1/-1"><b>ยังไม่มีคอร์สที่เปิดอยู่</b>
        <p class="tiny dim">ติดต่อ Line : ${e(CONFIG.CONTACT.lineId)} เพื่อสอบถามรอบเรียนที่กำลังจะเปิด</p></div>`;

  return `
  ${isCoursesPage ? '' : `
  <section class="book-hero">
    <div class="wrap">
      <h1>เรียนคณิตกับครูตัวต่อตัว<br>พร้อมเห็นพัฒนาการจริงทุกครั้งที่สอบ</h1>
      <p>เลือกคอร์สที่เหมาะกับน้อง จ่ายผ่านพร้อมเพย์ แล้วครูจะยืนยันที่นั่งให้
         — หลังเรียน ผู้ปกครองดูคะแนนและข้อที่ผิดได้จากชุดข้อสอบจริงของ 02._.mock</p>
      <div class="hero-cta">
        <a class="btn btn-primary" href="#/courses">ดูคอร์สที่เปิดอยู่</a>
        <a class="btn btn-ghost" href="#/scores">ดูคะแนนนักเรียน</a>
      </div>
    </div>
  </section>`}

  <section class="wrap" style="padding-top:${isCoursesPage ? '34px' : '10px'}">
    <div class="section-head" style="display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:18px">
      <div>
        <h2 style="font-family:var(--brand-font); font-size:26px; margin:0">คอร์สที่เปิดอยู่ตอนนี้</h2>
      </div>
      ${isCoursesPage ? '' : '<a class="btn btn-ghost btn-sm" href="#/courses">ดูทั้งหมด</a>'}
    </div>
    <div class="course-grid">${cards}</div>
  </section>

  ${isCoursesPage ? '' : `
  <section class="wrap" style="padding-top:44px">
    <div class="book-card">
      <h2 style="font-family:var(--brand-font);font-size:19px;margin:0 0 16px">ขั้นตอนการจอง</h2>
      <div class="course-grid" style="grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px">
        ${STEPS.map(([n, title, text]) => `
          <div>
            <div class="tiny dim" style="font-family:var(--brand-font);font-size:13px;letter-spacing:.1em">STEP ${n}</div>
            <div style="font-family:var(--brand-font);font-size:16px;margin:6px 0 4px">${e(title)}</div>
            <div class="tiny dim" style="line-height:1.6">${e(text)}</div>
          </div>`).join('')}
      </div>
    </div>
  </section>`}
  `;
}

function courseCardMarkup(c, ctx) {
  const left = c.seats ? `${c.left} ที่นั่ง` : 'ไม่จำกัด';
  const low = c.seats && c.left <= 2;
  return `
  <a class="course-card" href="#/course/${c.id}">
    <div class="course-card__media">
      ${c.image_url
        ? `<img src="${e(c.image_url)}" alt="" loading="lazy">`
        : `<div class="course-card__placeholder">${e((c.subject || 'คอร์ส').slice(0, 12))}</div>`}
    </div>
    <div class="course-card__body">
      <div class="tiny dim">${e(c.level || c.subject || '')}</div>
      <h3>${e(c.title)}</h3>
      <p class="tiny dim" style="margin:0">${e(c.subtitle || '')}</p>
      <div class="course-card__foot">
        <span class="price">${ctx.baht(c.price)}</span>
        <span class="seat-badge${low ? ' is-low' : ''}">${e(left)}</span>
      </div>
    </div>
  </a>`;
}
