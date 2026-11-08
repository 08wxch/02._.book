/* ── ค่าคงที่ของเว็บ 02._.book ──────────────────────────── */

export const CONFIG = {
  // ใช้ฐานข้อมูลเดียวกับ 02._.mock (คนละตารางกัน ไม่ทับกัน)
  SUPABASE_URL: 'https://hqpbvxmrolxhuexzzxgo.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxcGJ2eG1yb2x4aHVleHp6eGdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3Nzc0NjMsImV4cCI6MjEwODM1MzQ2M30.HsBV5_KXdWadINtL17tIIgiHLbi28t_nU6jsJ1qoDD8',
  SLIP_BUCKET: 'bk-slips',
  COVER_BUCKET: 'bk-covers',
  TEACHER_EMAIL: 'pitchonwich@gmail.com',
  TEACHER_NAME: 'Wich Pitchon',
  CONTACT: {
    line: 'buun - nuum',
    lineId: '617806696',
    phone: '061-780-6696',
    ig: '02._.math',
  },
  DEFAULT_RATE: 400,
};

CONFIG.SUPABASE_ANON_KEY = CONFIG.SUPABASE_ANON_KEY.replace(/\s+/g, '');

export const isConfigured = Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
