// Shared "add/edit transaction" modal used by the Dashboard (quick add) and
// the Transactions view.

import { DB } from './db.js';
import { openModal, toast } from './ui.js';
import { todayIso, escapeHtml } from './format.js';

export async function openTransactionModal({ transaction = null, onSaved } = {}) {
  const [accounts, categories] = await Promise.all([DB.listAccounts(), DB.listCategories()]);

  if (!accounts.length) {
    toast('Add an account first (Settings → Accounts).', { type: 'error' });
    return;
  }

  const isEdit = !!transaction;
  const t = transaction || {
    date: todayIso(),
    type: 'expense',
    accountId: accounts[0].id,
    categoryId: categories[0]?.id ?? null,
    amount: '',
    payee: '',
    note: '',
    transferAccountId: accounts[1]?.id ?? null,
  };

  const bodyHtml = `
    <form id="tx-form" class="form">
      <div class="segmented" role="tablist">
        <button type="button" class="segmented-btn ${t.type === 'expense' ? 'active' : ''}" data-type="expense">Expense</button>
        <button type="button" class="segmented-btn ${t.type === 'income' ? 'active' : ''}" data-type="income">Income</button>
        <button type="button" class="segmented-btn ${t.type === 'transfer' ? 'active' : ''}" data-type="transfer">Transfer</button>
      </div>

      <label class="field">
        <span>Amount (SAR)</span>
        <input type="number" step="0.01" min="0" name="amount" required value="${t.amount === '' ? '' : Math.abs(t.amount)}" placeholder="0.00" />
      </label>

      <label class="field">
        <span>Date</span>
        <input type="date" name="date" required value="${t.date}" />
      </label>

      <label class="field">
        <span>Account</span>
        <select name="accountId">
          ${accounts.map((a) => `<option value="${a.id}" ${a.id === t.accountId ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
        </select>
      </label>

      <label class="field" data-field="transferAccount" style="display:${t.type === 'transfer' ? 'flex' : 'none'}">
        <span>To account</span>
        <select name="transferAccountId">
          ${accounts.map((a) => `<option value="${a.id}" ${a.id === t.transferAccountId ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
        </select>
      </label>

      <label class="field" data-field="category" style="display:${t.type === 'expense' ? 'flex' : 'none'}">
        <span>Category</span>
        <select name="categoryId">
          ${categories.map((c) => `<option value="${c.id}" ${c.id === t.categoryId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </label>

      <label class="field">
        <span>Payee / note</span>
        <input type="text" name="payee" value="${escapeHtml(t.payee || '')}" placeholder="e.g. Panda, Careem, Salary" />
      </label>
    </form>
  `;

  const footerHtml = `
    ${isEdit ? '<button type="button" class="btn btn-danger" data-action="delete">Delete</button>' : '<span></span>'}
    <button type="button" class="btn btn-primary" data-action="save">${isEdit ? 'Save changes' : 'Add transaction'}</button>
  `;

  openModal({
    title: isEdit ? 'Edit transaction' : 'Add transaction',
    bodyHtml,
    footerHtml,
    onMount: (overlay, close) => {
      const form = overlay.querySelector('#tx-form');
      let currentType = t.type;

      overlay.querySelectorAll('.segmented-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          currentType = btn.dataset.type;
          overlay.querySelectorAll('.segmented-btn').forEach((b) => b.classList.toggle('active', b === btn));
          overlay.querySelector('[data-field="category"]').style.display = currentType === 'expense' ? 'flex' : 'none';
          overlay.querySelector('[data-field="transferAccount"]').style.display = currentType === 'transfer' ? 'flex' : 'none';
        });
      });

      overlay.querySelector('[data-action="save"]').addEventListener('click', async () => {
        const fd = new FormData(form);
        const amount = parseFloat(fd.get('amount'));
        if (!amount || amount <= 0) {
          toast('Enter an amount greater than zero.', { type: 'error' });
          return;
        }
        const record = {
          ...(isEdit ? { id: t.id } : {}),
          date: fd.get('date'),
          type: currentType,
          accountId: Number(fd.get('accountId')),
          categoryId: currentType === 'expense' ? Number(fd.get('categoryId')) : null,
          transferAccountId: currentType === 'transfer' ? Number(fd.get('transferAccountId')) : null,
          amount,
          payee: fd.get('payee') || '',
        };
        if (currentType === 'transfer' && record.accountId === record.transferAccountId) {
          toast('Pick two different accounts for a transfer.', { type: 'error' });
          return;
        }
        await DB.saveTransaction(record);
        toast(isEdit ? 'Transaction updated' : 'Transaction added', { type: 'success' });
        close();
        if (onSaved) onSaved();
      });

      if (isEdit) {
        overlay.querySelector('[data-action="delete"]').addEventListener('click', async () => {
          await DB.deleteTransaction(t.id);
          toast('Transaction deleted', { type: 'success' });
          close();
          if (onSaved) onSaved();
        });
      }
    },
  });
}
