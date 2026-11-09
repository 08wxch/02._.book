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
  const [allCourses, categories] = await Promise.all([
    ctx.data.listCourses(),
    ctx.data.listCategories().catch(() => []),
  ]);
  const isCoursesPage = ctx.route?.path === '/courses';

  // หน้าแรก: เฉพาะคอร์สที่ครูติ๊ก "แสดงในหน้าแรก"
  const courses = isCoursesPage ? allCourses : allCourses.filter((c) => c.show_on_home !== false);

  const emptyBlock = `<div class="empty-soft" style="grid-column:1/-1"><b>ยังไม่มีคอร์สที่เปิดอยู่</b>
        <p class="tiny dim">ติดต่อ Line : ${e(CONFIG.CONTACT.lineId)} เพื่อสอบถามรอบเรียนที่กำลังจะเปิด</p></div>`;

  const cardOf = (c) => ctx.appCourseCard?.(c) || courseCardMarkup(c, ctx);

  // หน้าคอร์สเรียน: แบ่งตามหมวดหมู่ (เรียงตามที่ตั้งไว้ใน 02._.admin)
  const groupedHtml = (() => {
    if (!isCoursesPage) return `<div class="course-grid">${courses.length ? courses.map(cardOf).join('') : emptyBlock}</div>`;

    const ordered = categories.slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const groups = ordered
      .map((cat) => ({ cat, items: courses.filter((c) => c.category_id === cat.id) }))
      .filter((g) => g.items.length);
    const rest = courses.filter((c) => !c.category_id || !categories.some((x) => x.id === c.category_id));
    if (rest.length) groups.push({ cat: null, items: rest });

    if (!courses.length) return `<div class="course-grid">${emptyBlock}</div>`;

    return groups.map((g) => `
      <section class="cat-section">
        <div class="cat-section__head">
          <h2>${e(g.cat ? g.cat.name : 'คอร์สอื่น ๆ')}</h2>
          <span class="tiny dim">${g.items.length} คอร์ส</span>
        </div>
        <div class="course-grid">${g.items.map(cardOf).join('')}</div>
      </section>`).join('');
  })();

  const cards = groupedHtml;

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
    ${cards}
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
