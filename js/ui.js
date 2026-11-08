import { icon, brandMark } from './icons.js';
import { e, initials, avatarTone, relativeTime, copyText, escapeHTML } from './utils.js';

let toastId = 0;

export function toast(message, type = 'success', duration = 3600) {
  const stack = document.getElementById('toast-stack');
  if (!stack) return;
  const id = `toast_${++toastId}`;
  const icons = { success: 'check-circle', warning: 'alert-triangle', error: 'x-circle', info: 'info' };
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.id = id;
  el.setAttribute('role', 'status');
  el.innerHTML = `<span class="toast__icon">${icon(icons[type] || 'info', 19)}</span><span>${e(message)}</span><button class="toast__close" aria-label="ปิด">${icon('x', 15)}</button>`;
  stack.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-visible'));
  const remove = () => {
    el.classList.remove('is-visible');
    setTimeout(() => el.remove(), 260);
  };
  const timer = setTimeout(remove, duration);
  el.querySelector('.toast__close').addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
}

let currentModal = null;

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (!root) return;
  const overlay = root.querySelector('.modal-overlay');
  if (!overlay) return;
  overlay.classList.remove('is-open');
  document.body.classList.remove('modal-open');
  if (currentModal?.keyHandler) document.removeEventListener('keydown', currentModal.keyHandler);
  if (currentModal?.restoreFocus) {
    try { currentModal.restoreFocus.focus(); } catch { /* noop */ }
  }
  const previous = currentModal;
  currentModal = null;
  setTimeout(() => {
    if (!currentModal) root.innerHTML = '';
  }, 220);
  return previous;
}

export function openModal({
  title = '',
  eyebrow = '',
  body = '',
  footer = '',
  size = 'md',
  tone = 'default',
  onMount = null,
  persistent = false
} = {}) {
  closeModal();
  const root = document.getElementById('modal-root');
  if (!root) return null;
  const restoreFocus = document.activeElement;
  const titleId = `modal_title_${Date.now()}`;
  root.innerHTML = `<div class="modal-overlay ${persistent ? 'is-persistent' : ''}" aria-hidden="true">
    <div class="modal modal--${size} ${tone === 'danger' ? 'modal--danger' : ''}" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
      <div class="modal__head">
        <div>
          ${eyebrow ? `<div class="modal__eyebrow">${e(eyebrow)}</div>` : ''}
          <h2 id="${titleId}">${title}</h2>
        </div>
        ${persistent ? '' : `<button class="icon-btn modal__close" type="button" data-modal-close aria-label="ปิดหน้าต่าง">${icon('x', 19)}</button>`}
      </div>
      <div class="modal__body">${body}</div>
      ${footer ? `<div class="modal__footer">${footer}</div>` : ''}
    </div>
  </div>`;

  const overlay = root.querySelector('.modal-overlay');
  requestAnimationFrame(() => {
    overlay.classList.add('is-open');
    document.body.classList.add('modal-open');
    const focusTarget = overlay.querySelector('[autofocus], input, textarea, select, button:not([data-modal-close])');
    if (focusTarget) setTimeout(() => focusTarget.focus(), 40);
  });

  const keyHandler = (ev) => {
    if (ev.key === 'Escape' && !persistent) closeModal();
    if (ev.key === 'Tab') {
      const focusables = [...overlay.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]')]
        .filter(el => el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault(); last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault(); first.focus();
      }
    }
  };

  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay && !persistent) closeModal();
    if (ev.target.closest('[data-modal-close]')) closeModal();
  });
  document.addEventListener('keydown', keyHandler);
  currentModal = { overlay, keyHandler, restoreFocus };
  if (typeof onMount === 'function') onMount(overlay);
  return { overlay, close: closeModal };
}

export function confirmDialog({
  title = 'ยืนยันการทำรายการ',
  message = '',
  confirmLabel = 'ยืนยัน',
  cancelLabel = 'ยกเลิก',
  tone = 'primary',
  iconName = 'alert-triangle'
} = {}) {
  return new Promise(resolve => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      closeModal();
      resolve(value);
    };
    const modal = openModal({
      title: e(title),
      size: 'sm',
      onMount: (overlay) => {
        overlay.querySelector('[data-confirm]').addEventListener('click', () => finish(true));
        overlay.querySelector('[data-cancel]').addEventListener('click', () => finish(false));
        overlay.addEventListener('click', (ev) => {
          if (ev.target === overlay) finish(false);
          if (ev.target.closest('[data-modal-close]')) finish(false);
        });
        overlay.querySelector('.modal__close')?.addEventListener('click', () => finish(false));
      },
      body: `<div class="confirm-copy">
        <span class="confirm-copy__icon tone-${tone}">${icon(iconName, 23)}</span>
        <p>${message}</p>
      </div>`,
      footer: `<button class="btn btn--ghost" type="button" data-cancel>${e(cancelLabel)}</button>
        <button class="btn ${tone === 'danger' ? 'btn--danger' : 'btn--primary'}" type="button" data-confirm>${e(confirmLabel)}</button>`
    });
    if (!modal) resolve(false);
  });
}

export function avatar(name, seed = 0, size = 'md', extra = '') {
  return `<span class="avatar avatar--${avatarTone(seed)} avatar--${size} ${extra}" aria-hidden="true">${e(initials(name))}</span>`;
}

export function brand({ href = '#/login', label = true, subtitle = 'ระบบสอบออนไลน์', variant = 'default' } = {}) {
  return `<a class="brand brand--${variant}" href="${href}" aria-label="02._.mock หน้าหลัก">
    ${brandMark(variant === 'light' ? 38 : 36)}
    ${label ? `<span class="brand__words"><span class="brand__name">02._.mock</span><span class="brand__sub">${e(subtitle)}</span></span>` : ''}
  </a>`;
}

export function badge(label, tone = 'neutral', dot = false, extra = '') {
  return `<span class="badge badge--${tone} ${extra}">${dot ? '<span class="badge__dot"></span>' : ''}${e(label)}</span>`;
}

export function notificationBell({ session, items = [], mode = 'student' } = {}) {
  const count = items.length;
  return `<div class="popover-wrap" data-notice-root>
    <button class="icon-btn icon-btn--badge" type="button" data-notice-toggle aria-expanded="false" aria-label="การแจ้งเตือน${count ? ` ${count} รายการ` : ''}">
      ${icon('bell', 20)}
      ${count ? `<span class="icon-btn__badge">${count > 9 ? '9+' : count}</span>` : ''}
    </button>
    <div class="popover notice-popover" data-notice-panel>
      <div class="popover__head">
        <div><strong>การแจ้งเตือน</strong><span>${count ? `${count} รายการใหม่` : 'ยังไม่มีการแจ้งเตือน'}</span></div>
        ${count ? `<span class="live-dot live-dot--small"><span></span>สด</span>` : ''}
      </div>
      <div class="popover__list">
        ${items.length ? items.map(item => `<a class="notice-item" href="${item.href || (mode === 'teacher' ? '#/teacher/review' : '#/student')}" ${item.id ? `data-notice-id="${e(item.id)}"` : ''}>
          <span class="notice-item__icon notice-item__icon--${item.kind || 'info'}">${icon(item.kind === 'result' ? 'award' : item.kind === 'submission' ? 'file-text' : item.kind === 'review' ? 'clipboard-check' : item.kind === 'warning' ? 'alert-triangle' : 'info', 17)}</span>
          <span class="notice-item__copy"><strong>${e(item.title)}</strong><span>${e(item.body)}</span><small>${relativeTime(item.createdAt)}</small></span>
        </a>`).join('') : `<div class="popover__empty">${icon('bell', 26)}<span>ไม่มีการแจ้งเตือนใหม่</span></div>`}
      </div>
      <div class="popover__foot">${icon('shield-check', 14)} ข้อมูลอัปเดตแบบเรียลไทม์</div>
    </div>
  </div>`;
}

export function mountNotificationBell(root = document) {
  const wrap = root.querySelector('[data-notice-root]');
  if (!wrap || wrap.dataset.noticeBound) return;
  wrap.dataset.noticeBound = '1';
  const btn = wrap.querySelector('[data-notice-toggle]');
  const panel = wrap.querySelector('[data-notice-panel]');
  btn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const open = !wrap.classList.contains('is-open');
    document.querySelectorAll('[data-notice-root].is-open').forEach(el => {
      el.classList.remove('is-open');
      el.querySelector('[data-notice-toggle]')?.setAttribute('aria-expanded', 'false');
    });
    wrap.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
  });
  panel?.addEventListener('click', ev => ev.stopPropagation());
  // Global dismissal listeners are installed once per document, not on every view mount.
  if (!window.__examioNoticeDismissBound) {
    window.__examioNoticeDismissBound = true;
    document.addEventListener('click', () => {
      document.querySelectorAll('[data-notice-root].is-open').forEach(el => {
        el.classList.remove('is-open');
        el.querySelector('[data-notice-toggle]')?.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Escape') return;
      document.querySelectorAll('[data-notice-root].is-open').forEach(el => {
        el.classList.remove('is-open');
        el.querySelector('[data-notice-toggle]')?.setAttribute('aria-expanded', 'false');
      });
    });
  }
}

export function mountCopyButtons(root = document) {
  root.querySelectorAll('[data-copy]').forEach(btn => {
    if (btn.dataset.copyBound) return;
    btn.dataset.copyBound = '1';
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const value = btn.getAttribute('data-copy');
      await copyText(value);
      toast('คัดลอกแล้ว', 'success', 2000);
      const original = btn.innerHTML;
      btn.classList.add('is-copied');
      if (btn.dataset.copyLabel) btn.innerHTML = `${icon('check', 16)} <span>คัดลอกแล้ว</span>`;
      setTimeout(() => {
        btn.classList.remove('is-copied');
        if (btn.dataset.copyLabel) btn.innerHTML = original;
      }, 1800);
    });
  });
}

export function mountPrintButtons(root = document) {
  root.querySelectorAll('[data-print]').forEach(btn => {
    if (btn.dataset.printBound) return;
    btn.dataset.printBound = '1';
    btn.addEventListener('click', () => {
      toast('กำลังเปิดหน้าต่างพิมพ์ — เลือก “บันทึกเป็น PDF” ได้เลย', 'info', 3500);
      setTimeout(() => window.print(), 250);
    });
  });
}

export function emptyState({ iconName = 'clipboard-check', title = 'ยังไม่มีข้อมูล', text = '', action = '' } = {}) {
  return `<div class="empty-state">
    <span class="empty-state__icon">${icon(iconName, 25)}</span>
    <h3>${e(title)}</h3>
    ${text ? `<p>${e(text)}</p>` : ''}
    ${action}
  </div>`;
}

export function searchInput({ placeholder = 'ค้นหา', id = '', value = '' } = {}) {
  return `<label class="search-field">
    ${icon('search', 18)}
    <input ${id ? `id="${id}"` : ''} type="search" placeholder="${e(placeholder)}" value="${e(value)}" autocomplete="off">
  </label>`;
}

export function ringScore(percentValue, tone = 'success', size = 68) {
  const safe = Math.max(0, Math.min(100, Number(percentValue) || 0));
  const cls = safe >= 80 ? 'success' : safe >= 60 ? 'info' : safe >= 40 ? 'warning' : 'danger';
  return `<div class="score-ring score-ring--${tone || cls}" style="--ring-size:${size}px;--ring-value:${safe}">
    <div class="score-ring__inner"><strong>${Math.round(safe)}<span>%</span></strong></div>
  </div>`;
}

export function dataBar(label, value, total, tone = 'green') {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return `<div class="data-bar-row">
    <span class="data-bar-row__label">${e(label)}</span>
    <span class="data-bar"><span class="data-bar__fill data-bar__fill--${tone}" style="width:${pct}%"></span></span>
    <span class="data-bar-row__value">${e(value)}</span>
  </div>`;
}

export function sectionHeading({ eyebrow = '', title = '', text = '', action = '' } = {}) {
  return `<div class="section-heading">
    <div>
      ${eyebrow ? `<div class="eyebrow">${e(eyebrow)}</div>` : ''}
      <h2>${e(title)}</h2>
      ${text ? `<p>${e(text)}</p>` : ''}
    </div>
    ${action || ''}
  </div>`;
}

export function escapeAttr(value) {
  return escapeHTML(value);
}
