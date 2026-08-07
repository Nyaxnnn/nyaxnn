// Small shared UI helpers: modal dialogs, toasts, confirmation prompts.
// Kept dependency-free on purpose.

let modalRoot;
let toastRoot;

function ensureRoots() {
  if (!modalRoot) {
    modalRoot = document.getElementById('modal-root');
  }
  if (!toastRoot) {
    toastRoot = document.getElementById('toast-root');
  }
}

export function openModal({ title, bodyHtml, footerHtml = '', onMount, onClose }) {
  ensureRoots();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="modal-header">
        <h3>${title}</h3>
        <button type="button" class="icon-btn modal-close" aria-label="Close">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
    </div>
  `;
  modalRoot.appendChild(overlay);
  overlay.querySelectorAll('form').forEach((f) => f.addEventListener('submit', (e) => e.preventDefault()));

  const close = () => {
    overlay.remove();
    if (onClose) onClose();
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  overlay.querySelector('.modal-close').addEventListener('click', close);
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', escHandler);
    }
  });

  if (onMount) onMount(overlay, close);
  return { close, el: overlay };
}

export function toast(message, { type = 'info', duration = 2600 } = {}) {
  ensureRoots();
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  toastRoot.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast-show'));
  setTimeout(() => {
    el.classList.remove('toast-show');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

export function confirmDialog(message, { confirmLabel = 'Delete', danger = true } = {}) {
  return new Promise((resolve) => {
    const { close } = openModal({
      title: 'Are you sure?',
      bodyHtml: `<p>${message}</p>`,
      footerHtml: `
        <button type="button" class="btn btn-ghost" data-action="cancel">Cancel</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm">${confirmLabel}</button>
      `,
      onMount: (overlay) => {
        overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => {
          close();
          resolve(false);
        });
        overlay.querySelector('[data-action="confirm"]').addEventListener('click', () => {
          close();
          resolve(true);
        });
      },
      onClose: () => resolve(false),
    });
  });
}

export function qs(root, sel) {
  return root.querySelector(sel);
}
export function qsa(root, sel) {
  return Array.from(root.querySelectorAll(sel));
}
