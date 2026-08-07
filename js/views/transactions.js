import { DB } from '../db.js';
import { formatMoney, formatDateLong, currentMonth, monthLabel, shiftMonth, escapeHtml } from '../format.js';
import { openTransactionModal } from '../transaction-form.js';

let state = { month: currentMonth(), accountId: '', categoryId: '', search: '' };

export async function render(root) {
  const currency = await DB.getSetting('currency', 'SAR');
  const [accounts, categories] = await Promise.all([DB.listAccounts(), DB.listCategories()]);
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  let transactions = await DB.listTransactions({
    month: state.month || undefined,
    accountId: state.accountId ? Number(state.accountId) : undefined,
    categoryId: state.categoryId ? Number(state.categoryId) : undefined,
  });
  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    transactions = transactions.filter((t) => (t.payee || '').toLowerCase().includes(q));
  }

  root.innerHTML = `
    <div class="view-header">
      <div class="month-switcher">
        <button type="button" class="icon-btn" data-action="prev-month" aria-label="Previous month">‹</button>
        <h2>${state.month ? monthLabel(state.month) : 'All time'}</h2>
        <button type="button" class="icon-btn" data-action="next-month" aria-label="Next month">›</button>
      </div>
      <button type="button" class="btn btn-primary" data-action="add">+ Add transaction</button>
    </div>

    <div class="filter-row">
      <input type="search" placeholder="Search payee…" value="${escapeHtml(state.search)}" data-filter="search" class="input" />
      <select data-filter="accountId" class="input">
        <option value="">All accounts</option>
        ${accounts.map((a) => `<option value="${a.id}" ${String(a.id) === state.accountId ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
      </select>
      <select data-filter="categoryId" class="input">
        <option value="">All categories</option>
        ${categories.map((c) => `<option value="${c.id}" ${String(c.id) === state.categoryId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
      </select>
      <button type="button" class="btn btn-ghost" data-action="toggle-month">${state.month ? 'Show all time' : 'Show current month'}</button>
    </div>

    ${transactions.length ? renderTable(transactions, accountMap, categoryMap, currency) : `<p class="empty-hint">No transactions match these filters.</p>`}
  `;

  root.querySelector('[data-action="add"]').addEventListener('click', () => {
    openTransactionModal({ onSaved: () => render(root) });
  });
  const prevBtn = root.querySelector('[data-action="prev-month"]');
  const nextBtn = root.querySelector('[data-action="next-month"]');
  if (prevBtn) prevBtn.addEventListener('click', () => { state.month = shiftMonth(state.month, -1); render(root); });
  if (nextBtn) nextBtn.addEventListener('click', () => { state.month = shiftMonth(state.month, 1); render(root); });
  root.querySelector('[data-action="toggle-month"]').addEventListener('click', () => {
    state.month = state.month ? '' : currentMonth();
    render(root);
  });
  root.querySelector('[data-filter="search"]').addEventListener('input', (e) => {
    state.search = e.target.value;
    render(root);
  });
  root.querySelector('[data-filter="accountId"]').addEventListener('change', (e) => {
    state.accountId = e.target.value;
    render(root);
  });
  root.querySelector('[data-filter="categoryId"]').addEventListener('change', (e) => {
    state.categoryId = e.target.value;
    render(root);
  });
  root.querySelectorAll('[data-tx-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = Number(el.dataset.txId);
      const t = transactions.find((x) => x.id === id);
      if (t) openTransactionModal({ transaction: t, onSaved: () => render(root) });
    });
  });
}

function renderTable(transactions, accountMap, categoryMap, currency) {
  const rows = transactions
    .map((t) => {
      const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '';
      const cls = t.type === 'income' ? 'positive' : t.type === 'expense' ? 'negative' : '';
      const account = accountMap.get(t.accountId);
      const category = t.categoryId ? categoryMap.get(t.categoryId) : null;
      const desc = t.type === 'transfer'
        ? `Transfer → ${escapeHtml(accountMap.get(t.transferAccountId)?.name || '—')}`
        : category
          ? escapeHtml(category.name)
          : t.type === 'income' ? 'Income' : 'Uncategorized';
      return `
        <div class="tx-table-row" data-tx-id="${t.id}" role="button" tabindex="0">
          <div class="tx-table-date">${formatDateLong(t.date)}</div>
          <div class="tx-table-main">
            <span class="tx-payee">${escapeHtml(t.payee || desc)}</span>
            <span class="tx-meta">${escapeHtml(account?.name || '—')} · ${desc}</span>
          </div>
          <span class="tx-amount ${cls}">${sign}${formatMoney(Math.abs(t.amount), currency)}</span>
        </div>
      `;
    })
    .join('');
  return `<div class="tx-table">${rows}</div>`;
}
