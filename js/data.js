/* ── ชั้นข้อมูล: Supabase (โปรเจกต์เดียวกับ 02._.mock) ──── */

import { CONFIG } from './config.js';

let client = null;
let session = null;
let account = null;
const listeners = new Set();

export function sb() {
  if (!client) {
    client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'book02_auth_v1' },
    });
  }
  return client;
}

const notify = () => listeners.forEach((fn) => { try { fn(); } catch (err) { console.error(err); } });

export function onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); }

/* ── auth ─────────────────────────────────────────────── */
export async function init() {
  const { data: s } = await sb().auth.getSession();
  session = s?.session || null;
  await loadAccount();
  // ⚠️ ห้าม await supabase ภายใน callback นี้ (จะ deadlock lock ของ auth)
  sb().auth.onAuthStateChange((_e, next) => {
    session = next;
    setTimeout(async () => {
      try { await loadAccount(); } catch (err) { console.warn(err); }
      notify();
    }, 0);
  });
  notify();
  return session;
}

export function getUser() { return session?.user || null; }
export function getAccount() { return account; }
export function isOwner() { return account?.role === 'owner'; }
export function isTeacher() { return account?.role === 'teacher'; }
export function isParent() { return !account || account.role === 'parent'; }

async function loadAccount(retry = 2) {
  if (!session?.user) { account = null; return null; }
  const { data: row, error } = await sb().from('bk_accounts').select('*').eq('user_id', session.user.id).maybeSingle();
  if (error) {
    console.warn('โหลดบัญชีไม่สำเร็จ', error.message);
    if (retry > 0) {
      await new Promise((r) => setTimeout(r, 1200));
      return loadAccount(retry - 1);
    }
    return account;
  }
  account = row || null;
  return account;
}

export async function refreshAccount() { await loadAccount(); notify(); return account; }

/** สมัครผู้ปกครอง (อีเมล + รหัสผ่าน ไม่ต้องยืนยันอีเมล) */
export async function signUpParent({ email, password, name, phone, lineId }) {
  const clean = String(email || '').trim().toLowerCase();
  const { data: res, error } = await sb().rpc('bk_signup_parent', {
    p_email: clean, p_password: String(password || ''), p_name: String(name || ''),
    p_phone: String(phone || ''), p_line: String(lineId || ''),
  });
  if (error) throw new Error(error.message || 'สมัครไม่สำเร็จ');
  if (!res?.ok) throw new Error('สมัครไม่สำเร็จ');
  const { data: sign, error: e2 } = await sb().auth.signInWithPassword({ email: clean, password: String(password || '') });
  if (e2) throw new Error('สมัครแล้ว แต่เข้าสู่ระบบอัตโนมัติไม่สำเร็จ — กรุณากดเข้าสู่ระบบอีกครั้ง');
  session = sign.session;
  await loadAccount();
  notify();
  return account;
}

export async function signInParent(email, password) {
  const clean = String(email || '').trim().toLowerCase();
  const { data: res, error } = await sb().auth.signInWithPassword({ email: clean, password });
  if (error) throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  session = res.session;
  await loadAccount();
  if (!account) {
    await sb().from('bk_accounts').insert({ user_id: res.user.id, role: 'parent', email: clean, password_plain: String(password || '') });
    await loadAccount();
  }
  notify();
  return account;
}

/** ล็อกอินครู/เจ้าของ — ตรวจรหัสผ่านกับข้อมูลสดของ 02._.mock */
export async function signInTeacher(code, password) {
  const clean = String(code || '').trim();
  const pass = String(password || '');
  if (!clean) throw new Error('กรุณากรอกรหัสครู');
  const { data: res, error } = await sb().rpc('bk_teacher_login', { p_code: clean, p_password: pass });
  if (error) throw new Error(error.message || 'เข้าสู่ระบบไม่สำเร็จ');
  const email = res?.email;
  if (!email) throw new Error('ไม่พบบัญชีครูนี้');
  const sign = await sb().auth.signInWithPassword({ email, password: pass });
  if (sign.error) throw new Error(sign.error.message || 'เข้าสู่ระบบไม่สำเร็จ');
  session = sign.data.session;
  await loadAccount();
  notify();
  return account;
}

/** เปลี่ยนรหัสผ่านของตัวเอง */
export async function changePassword(newPassword) {
  const pass = String(newPassword || '');
  if (pass.length < 6) throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
  const { error } = await sb().auth.updateUser({ password: pass });
  if (error) throw new Error(error.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
  const uid = getUser()?.id;
  if (uid) await sb().from('bk_accounts').update({ password_plain: pass, updated_at: new Date().toISOString() }).eq('user_id', uid);
  return true;
}

/** เจ้าของ/ครู เปลี่ยนรหัสผ่านให้ผู้ปกครอง */
export async function setParentPassword(userId, newPassword) {
  const { data, error } = await sb().rpc('bk_set_parent_password', { p_user: userId, p_password: String(newPassword || '') });
  if (error) throw new Error(error.message || 'ตั้งรหัสใหม่ไม่สำเร็จ');
  return data;
}

/** สร้างบัญชีครูทั้งหมดจากข้อมูลใน 02._.mock (ครั้งแรกเรียกได้ก่อนล็อกอิน) */
export async function syncTeachers() {
  const { data: res, error } = await sb().rpc('bk_sync_teachers');
  if (error) throw error;
  return res;
}

export async function signOut() {
  await sb().auth.signOut();
  session = null; account = null;
  notify();
}

export async function updateAccount(patch) {
  const uid = getUser()?.id;
  if (!uid) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
  const clean = {};
  ['name', 'phone', 'line_id', 'org_id', 'approved', 'org_hint'].forEach((k) => {
    if (patch[k] !== undefined) clean[k] = patch[k];
  });
  clean.updated_at = new Date().toISOString();
  const { error } = await sb().from('bk_accounts').update(clean).eq('user_id', uid);
  if (error) throw error;
  await loadAccount();
  notify();
  return account;
}

/* ── settings ─────────────────────────────────────────── */
export async function getSettings() {
  const { data: row, error } = await sb().from('bk_settings').select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  return row || { id: 1, promptpay_type: 'phone', promptpay_id: '', promptpay_name: '', contact_line: '', contact_phone: '', notice: '' };
}

export async function saveSettings(patch) {
  const { error } = await sb().from('bk_settings').upsert({ id: 1, ...patch, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/* ── courses ──────────────────────────────────────────── */
export async function listCourses({ all = false } = {}) {
  let q = sb().from('bk_courses').select('*').order('sort_order').order('created_at');
  if (!all) q = q.eq('active', true);
  const { data: rows, error } = await q;
  if (error) throw error;
  const courses = rows || [];
  if (!courses.length) return courses;
  let sold = {};
  try {
    const { data: map } = await sb().rpc('bk_course_seats');
    sold = map || {};
  } catch (err) { sold = {}; }
  return courses.map((c) => ({ ...c, sold: Number(sold[c.id] || 0), left: c.seats ? Math.max(0, c.seats - Number(sold[c.id] || 0)) : null }));
}

export async function listCategories() {
  const { data, error } = await sb().from('bk_course_categories').select('*').order('sort_order').order('created_at');
  if (error) throw error;
  return data || [];
}

export async function getCourse(id) {
  const { data: row, error } = await sb().from('bk_courses').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return row;
}

export async function saveCourse(patch) {
  const clean = {
    title: patch.title, subtitle: patch.subtitle || '', detail: patch.detail || '',
    image_url: patch.image_url || '', price: Number(patch.price || 0), hours: Number(patch.hours || 0),
    lessons: Number(patch.lessons || 0), seats: Number(patch.seats || 0), level: patch.level || '',
    subject: patch.subject || 'คณิตศาสตร์', active: patch.active !== false, sort_order: Number(patch.sort_order || 0),
  };
  if (patch.id) {
    const { error } = await sb().from('bk_courses').update(clean).eq('id', patch.id);
    if (error) throw error;
    return patch.id;
  }
  const { data: row, error } = await sb().from('bk_courses').insert(clean).select('id').single();
  if (error) throw error;
  return row.id;
}

export async function deleteCourse(id) {
  const { error } = await sb().from('bk_courses').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadCover(file) {
  const path = `covers/${Date.now()}-${String(file.name || 'cover').replace(/[^\w.-]+/g, '_')}`;
  const up = await sb().storage.from(CONFIG.COVER_BUCKET).upload(path, file, { upsert: true, cacheControl: '31536000' });
  if (up.error) throw up.error;
  const { data: pub } = sb().storage.from(CONFIG.COVER_BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}

/* ── orders ───────────────────────────────────────────── */
export async function createOrder({ courseId, studentName, note, couponCode }) {
  const uid = getUser()?.id;
  if (!uid) throw new Error('กรุณาเข้าสู่ระบบก่อน');
  const { data, error } = await sb().rpc('bk_create_order', {
    p_course_id: courseId,
    p_student_name: String(studentName || ''),
    p_note: String(note || ''),
    p_coupon_code: couponCode ? String(couponCode) : null,
  });
  if (error) throw new Error(error.message || 'สร้างคำสั่งซื้อไม่สำเร็จ');
  return data;
}

/* ── คูปองส่วนลด ──────────────────────────────────────── */
export async function claimCoupon(code) {
  const { data, error } = await sb().rpc('bk_claim_coupon', { p_code: String(code || '').trim() });
  if (error) throw new Error(error.message || 'แลกโค้ดไม่สำเร็จ');
  return data;
}

export async function listMyCoupons() {
  const { data, error } = await sb().rpc('bk_my_coupons');
  if (error) throw error;
  return data || [];
}

export async function listCoupons() {
  const { data, error } = await sb().from('bk_coupons').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  const { data: claims } = await sb().from('bk_coupon_claims').select('coupon_id, status');
  const used = {};
  (claims || []).forEach((c) => { if (c.status === 'used') used[c.coupon_id] = (used[c.coupon_id] || 0) + 1; });
  return (data || []).map((c) => ({ ...c, used: used[c.id] || 0 }));
}

export async function saveCoupon(patch) {
  const clean = {
    code: String(patch.code || '').trim().toUpperCase(),
    title: String(patch.title || ''),
    kind: patch.kind === 'amount' ? 'amount' : 'percent',
    value: Number(patch.value || 0),
    course_ids: Array.isArray(patch.course_ids) ? patch.course_ids : [],
    min_amount: Number(patch.min_amount || 0),
    max_uses: Number(patch.max_uses || 0),
    max_per_user: Number(patch.max_per_user || 1),
    active: patch.active !== false,
    note: String(patch.note || ''),
    expires_at: patch.expires_at || null,
  };
  if (patch.image_url !== undefined) clean.image_url = patch.image_url;
  if (!clean.code) throw new Error('กรุณากรอกโค้ด');
  if (patch.id) {
    const { error } = await sb().from('bk_coupons').update(clean).eq('id', patch.id);
    if (error) throw error;
    return patch.id;
  }
  const { data, error } = await sb().from('bk_coupons').insert(clean).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function uploadCouponImage(file) {
  if (file.size > 1.5 * 1024 * 1024) throw new Error('รูปใหญ่เกิน 1.5MB');
  const path = `coupons/${Date.now()}-${String(file.name || 'coupon').replace(/[^\w.-]+/g, '_')}`;
  const up = await sb().storage.from(CONFIG.COVER_BUCKET).upload(path, file, { upsert: true, cacheControl: '31536000' });
  if (up.error) throw up.error;
  const { data: pub } = sb().storage.from(CONFIG.COVER_BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}

export async function deleteCoupon(id) {
  const { data: row } = await sb().from('bk_coupons').select('image_url').eq('id', id).maybeSingle();
  if (row?.image_url) await removeStorageUrl(row.image_url);
  const { error } = await sb().from('bk_coupons').delete().eq('id', id);
  if (error) throw error;
}

/** ลบไฟล์ใน bucket ออกจาก URL สาธารณะ */
async function removeStorageUrl(url) {
  try {
    const marker = `/${CONFIG.COVER_BUCKET}/`;
    const idx = String(url).indexOf(marker);
    if (idx === -1) return;
    const path = String(url).slice(idx + marker.length);
    await sb().storage.from(CONFIG.COVER_BUCKET).remove([path]);
  } catch (err) { console.warn('ลบไฟล์ไม่สำเร็จ', err); }
}

export async function getOrder(id) {
  const { data: row, error } = await sb().from('bk_orders').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return row;
}

export async function listMyOrders() {
  const { data: rows, error } = await sb().from('bk_orders').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return rows || [];
}

export async function listAllOrders() {
  const { data: rows, error } = await sb().from('bk_orders').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  const { data: accounts } = await sb().from('bk_accounts').select('user_id, name, email, phone, line_id');
  const byId = Object.fromEntries((accounts || []).map((a) => [a.user_id, a]));
  return (rows || []).map((o) => ({ ...o, parent: byId[o.user_id] || {} }));
}

export async function uploadSlip(orderId, file) {
  const uid = getUser()?.id;
  if (!uid) throw new Error('กรุณาเข้าสู่ระบบก่อน');
  const path = `${uid}/order-${orderId}-${Date.now()}.jpg`;
  const up = await sb().storage.from(CONFIG.SLIP_BUCKET).upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
  if (up.error) throw up.error;
  const { error } = await sb().from('bk_orders').update({ slip_path: path, status: 'pending_confirm' }).eq('id', orderId);
  if (error) throw error;
  return path;
}

export async function slipUrl(path) {
  if (!path) return '';
  const { data: signed } = await sb().storage.from(CONFIG.SLIP_BUCKET).createSignedUrl(path, 60 * 30);
  return signed?.signedUrl || '';
}

export async function downloadSlip(orderId, path) {
  const url = await slipUrl(path);
  if (!url) throw new Error('เปิดไฟล์สลิปไม่สำเร็จ');
  const res = await fetch(url);
  if (!res.ok) throw new Error('ดาวน์โหลดสลิปไม่สำเร็จ');
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `slip-${orderId}.jpg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** เจ้าของกดยืนยัน → ลบไฟล์สลิปออกจาก Storage ทันที (ตามที่กำหนด) */
export async function confirmOrder(orderId) {
  const order = await getOrder(orderId);
  if (order?.slip_path) {
    const rm = await sb().storage.from(CONFIG.SLIP_BUCKET).remove([order.slip_path]);
    if (rm.error) console.warn('ลบไฟล์สลิปไม่สำเร็จ', rm.error.message);
  }
  const { error } = await sb().from('bk_orders')
    .update({ status: 'confirmed', slip_path: '', confirmed_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) throw error;
}

export async function rejectOrder(orderId) {
  const order = await getOrder(orderId);
  if (order?.slip_path) await sb().storage.from(CONFIG.SLIP_BUCKET).remove([order.slip_path]);
  const { error } = await sb().from('bk_orders').update({ status: 'rejected', slip_path: '' }).eq('id', orderId);
  if (error) throw error;
}

export async function deleteOrder(orderId) {
  const { error } = await sb().from('bk_orders').delete().eq('id', orderId);
  if (error) throw error;
}

/* ── accounts (เจ้าของ / ครู) ─────────────────────────── */
export async function listAccounts() {
  const { data: rows, error } = await sb().from('bk_accounts').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return rows || [];
}

export async function listParents() {
  const { data: rows, error } = await sb().from('bk_accounts').select('*').eq('role', 'parent').order('created_at', { ascending: false });
  if (error) throw error;
  return rows || [];
}

export async function setParentStudents(userId) {
  const { data: links, error } = await sb().from('bk_parent_students').select('*').eq('user_id', userId);
  if (error) throw error;
  const { data: orders } = await sb().from('bk_orders').select('amount, status').eq('user_id', userId);
  const paid = (orders || []).filter((o) => o.status === 'confirmed').reduce((s, o) => s + Number(o.amount || 0), 0);
  return { links: links || [], paid, orders: (orders || []).length };
}

/* ── นักเรียนที่ผูกไว้ ──────────────────────────────────── */
export async function listMyStudents() {
  const { data: rows, error } = await sb().from('bk_parent_students').select('*').order('created_at');
  if (error) throw error;
  return rows || [];
}

export async function listAllLinks() {
  const { data: rows, error } = await sb().from('bk_parent_students').select('*').order('created_at');
  if (error) throw error;
  return rows || [];
}

/** รายชื่อนักเรียนทั้งหมด (เจ้าของ = ทุกหน่วยงาน / ครู = หน่วยงานตัวเอง) พร้อมผู้ปกครองที่ผูกอยู่ */
export async function studentsOverview() {
  const { data, error } = await sb().rpc('bk_students_overview');
  if (error) throw error;
  return data || [];
}

export async function linkParentStudent(studentId, userId) {
  const { data, error } = await sb().rpc('bk_link_parent_student', { p_student_id: studentId, p_user: userId });
  if (error) throw error;
  return data;
}

export async function unlinkStudent(linkId) {
  const { data, error } = await sb().rpc('bk_teacher_unlink_student', { p_link: linkId });
  if (error) throw error;
  return data;
}

export async function parentDetail(userId) {
  const { data, error } = await sb().rpc('bk_parent_detail', { p_user: userId });
  if (error) throw error;
  return data;
}

export async function setParentOrgs(userId, orgIds) {
  const { data, error } = await sb().rpc('bk_set_parent_orgs', { p_user: userId, p_org_ids: orgIds || [] });
  if (error) throw error;
  return data;
}

export async function deleteParent(userId) {
  const { data, error } = await sb().rpc('bk_delete_parent', { p_user: userId });
  if (error) throw error;
  return data;
}

export async function listOrganizations() {
  const { data, error } = await sb().rpc('bk_organizations');
  if (error) throw error;
  return data || [];
}

export async function setMyOrgs(orgIds) {
  const { data, error } = await sb().rpc('bk_set_my_orgs', { p_org_ids: orgIds || [] });
  if (error) throw error;
  await loadAccount();
  notify();
  return data;
}

/** เจ้าของ/ครู ลบผู้ปกครอง (ลบออเดอร์+การผูก+บัญชี) */
export async function removeParent(userId) {
  return deleteParent(userId);
}

/* ── ข้อมูลชุดสอบ/คะแนนจาก 02._.mock ───────────────────── */
/** รายชื่อนักเรียน+หน่วยงาน (เจ้าของ/ครู ใช้ผูก) */
export async function listMockRoster() {
  const { data: rows, error } = await sb().rpc('bk_roster');
  if (error) throw error;
  return rows || { students: [], organizations: [] };
}

export async function studentReport(studentId) {
  const { data, error } = await sb().rpc('bk_student_report', { p_student_id: studentId });
  if (error) throw error;
  return data;
}
