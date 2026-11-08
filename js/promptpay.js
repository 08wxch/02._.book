/* ── PromptPay QR (EMVCo) + ตัวสร้างรูป QR ──────────────── */

function tlv(tag, value) {
  const len = String(value.length).padStart(2, '0');
  return `${tag}${len}${value}`;
}

function crc16(input) {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** แปลงเบอร์โทร/เลขบัตรประชาชนให้อยู่ในรูปที่พร้อมเพย์ใช้ */
export function normalizePromptPayId(id, type = 'phone') {
  const digits = String(id || '').replace(/\D+/g, '');
  if (!digits) throw new Error('ยังไม่ได้ตั้งค่าเลขพร้อมเพย์');
  if (type === 'national_id') {
    if (digits.length !== 13) throw new Error('เลขบัตรประชาชนต้องมี 13 หลัก');
    return digits;
  }
  if (type === 'ewallet') {
    if (digits.length !== 15) throw new Error('เบอร์ e-Wallet ต้องมี 15 หลัก');
    return digits;
  }
  // เบอร์โทร: 0066 + เบอร์ที่ตัด 0 นำหน้า
  const local = digits.replace(/^0/, '');
  if (local.length !== 9) throw new Error('เบอร์โทรพร้อมเพย์ต้องมี 10 หลัก');
  return `0066${local}`;
}

/** สร้าง payload พร้อมเพย์ (EMVCo) พร้อมยอดเงิน */
export function promptPayPayload({ id, type = 'phone', amount }) {
  const target = normalizePromptPayId(id, type);
  const merchant = tlv('00', 'A000000677010111') + tlv(type === 'national_id' ? '02' : type === 'ewallet' ? '03' : '01', target);
  const payload =
    tlv('00', '01') +
    tlv('01', amount ? '12' : '11') +
    tlv('29', merchant) +
    tlv('53', '764') +
    (amount ? tlv('54', Number(amount).toFixed(2)) : '') +
    tlv('58', 'TH') +
    '6304';
  return payload + crc16(payload);
}

/** คืน data URL ของรูป QR */
export function promptPayQrDataUrl(opts, size = 4) {
  const payload = promptPayPayload(opts);
  const qr = window.qrcode(0, 'M');
  qr.addData(payload);
  qr.make();
  return qr.createDataURL(size, 8);
}
