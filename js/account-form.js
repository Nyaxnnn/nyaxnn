import { DB } from './db.js';
import { openModal, toast, confirmDialog } from './ui.js';
import { escapeHtml, todayIso } from './format.js';

const TYPES = [
  { value: 'cash', label: 'Cash / bank (spending)' },
  { value: 'savings', label: 'Savings (tracked manually)' },
  { value: 'investment', label: 'Investment (tracked manually)' },
];

export async function openAccountModal({ account = null, defaultType = 'cash', onSaved } = {}) {
  const isEdit = !!account;
  const a = account || { name: '', type: defaultType, startingBalance: 0 };

  const bodyHtml = `
    <form id="acc-form" class="form">
      <label class="field">
        <span>Name</span>
        <input type="text" name="name" required value="${escapeHtml(a.name)}" placeholder="e.g. Al Rajhi Checking" />
      </label>
      <label class="field">
        <span>Type</span>
        <select name="type">
          ${TYPES.map((t) => `<option value="${t.value}" ${t.value === a.type ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>
      </label>
      <label class="field">
        <span>${isEdit ? 'Starting balance (SAR)' : 'Current balance (SAR)'}</span>
        <input type="number" step="0.01" name="startingBalance" value="${a.startingBalance}" />
      </label>
      <p class="field-hint">Cash/bank balances update automatically from transactions. Savings and investment balances you update by hand whenever you check them — no bank link needed.</p>
    </form>
  `;

  const footerHtml = `
    ${isEdit ? '<button type="button" class="btn btn-danger" data-action="delete">Delete</button>' : '<span></span>'}
    <button type="button" class="btn btn-primary" data-action="save">${isEdit ? 'Save changes' : 'Add account'}</button>
  `;

  openModal({
    title: isEdit ? 'Edit account' : 'New account',
    bodyHtml,
    footerHtml,
    onMount: (overlay, close) => {
      overlay.querySelector('[data-action="save"]').addEventListener('click', async () => {
        const fd = new FormData(overlay.querySelector('#acc-form'));
        const name = (fd.get('name') || '').trim();
        if (!name) {
          toast('Give the account a name.', { type: 'error' });
          return;
        }
        const record = {
          ...(isEdit ? { id: a.id, createdAt: a.createdAt } : {}),
          name,
          type: fd.get('type'),
          startingBalance: parseFloat(fd.get('startingBalance')) || 0,
        };
        const savedId = await DB.saveAccount(record);
        const type = record.type;
        if (!isEdit && type !== 'cash') {
          await DB.saveSnapshot({ accountId: savedId, date: todayIso(), balance: record.startingBalance });
        }
        toast(isEdit ? 'Account updated' : 'Account added', { type: 'success' });
        close();
        if (onSaved) onSaved();
      });

      if (isEdit) {
        overlay.querySelector('[data-action="delete"]').addEventListener('click', async () => {
          const ok = await confirmDialog('This deletes the account. Its transactions and balance history stay in the database but will no longer show a linked account name.');
          if (!ok) return;
          await DB.deleteAccount(a.id);
          toast('Account deleted', { type: 'success' });
          close();
          if (onSaved) onSaved();
        });
      }
    },
  });
}
