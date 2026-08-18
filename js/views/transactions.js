// One screen for everything transaction-related: a fast quick-add bar up
// top (the old "Track" experience) and a filterable, searchable log below
// (the old "Transactions" table) — merged because they were really the same
// data shown two different ways.

import { DB } from '../db.js';
import { getMonthSummary } from '../budget-logic.js';
import { formatMoney, formatDateLong, todayIso, currentMonth, monthLabel, shiftMonth, escapeHtml } from '../format.js';
import { toast } from '../ui.js';
import { openTransactionModal } from '../transaction-form.js';
import { icon } from '../icons.js';

let quick = { date: todayIso(), categoryId: null, accountId: null };
let filter = { month: currentMonth(), accountId: '', categoryId: '', search: '' };

export async function render(root) {
  const currency = await DB.getSetting('currency', 'SAR');
  const [accounts, categories] = await Promise.all([DB.listAccounts(), DB.listCategories()]);

  if (!accounts.length || !categories.length) {
    root.innerHTML = `
      <div class="view-header"><h2>Transactions</h2></div>
      <div class="banner">
        ${!accounts.length ? 'Add an account in <a href="#/settings">Settings</a> first. ' : ''}
        ${!categories.length ? 'Add at least one category in <a href="#/budget">Budget</a> first.' : ''}
      </div>
    `;
    return;
  }

  const cashAccounts = accounts.filter((a) => a.type === 'cash');
  if (!quick.accountId || !accounts.some((a) => a.id === quick.accountId)) {
    quick.accountId = (cashAccounts[0] || accounts[0]).id;
  }
  if (!quick.categoryId || !categories.some((c) => c.id === quick.categoryId)) {
    quick.categoryId = categories[0].id;
  }

  const quickMonth = quick.date.slice(0, 7);
  const summary = await getMonthSummary(quickMonth);
  const quickMonthTx = await DB.listTransactions({ month: quickMonth });
  const todaySpent = quickMonthTx
    .filter((t) => t.type === 'expense' && t.date === quick.date)
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  let list = await DB.listTransactions({
    month: filter.month || undefined,
    accountId: filter.accountId ? Number(filter.accountId) : undefined,
    categoryId: filter.categoryId ? Number(filter.categoryId) : undefined,
  });
  if (filter.search.trim()) {
    const q = filter.search.trim().toLowerCase();
    list = list.filter((t) => (t.payee || '').toLowerCase().includes(q));
  }

  root.innerHTML = `
    <div class="view-header"><h2>Transactions</h2></div>

    <section class="panel quick-add-panel">
      <form id="quick-add-form" class="form">
        <div class="quick-add-top">
          <label class="field amount-field">
            <span>Amount (SAR)</span>
            <input type="number" step="0.01" min="0" name="amount" placeholder="0.00" required autocomplete="off" />
          </label>
          <label class="field date-field">
            <span>Date</span>
            <input type="date" name="date" value="${quick.date}" max="${todayIso()}" />
          </label>
        </div>
        <div class="field">
          <span>Category</span>
          <div class="chip-row">
            ${categories.map((c) => `
              <button type="button" class="chip ${c.id === quick.categoryId ? 'chip-active' : ''}" data-category-chip="${c.id}" style="--chip-color:${c.color || '#64748b'}">
                <span class="dot" style="background:${c.color || '#64748b'}"></span>${escapeHtml(c.name)}
              </button>
            `).join('')}
          </div>
        </div>
        ${accounts.length > 1 ? `
        <label class="field">
          <span>Account</span>
          <select name="accountId">
            ${accounts.map((a) => `<option value="${a.id}" ${a.id === quick.accountId ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
          </select>
        </label>` : `<input type="hidden" name="accountId" value="${quick.accountId}" />`}
        <input type="text" name="payee" placeholder="Note (optional) — e.g. Panda, Careem" class="input" />
        <div class="quick-add-actions">
          <button type="submit" class="btn btn-primary btn-block">+ Add expense</button>
          <button type="button" class="btn btn-ghost btn-sm" data-action="add-other">Income / transfer…</button>
        </div>
      </form>
    </section>

    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-label">Spent today</div>
        <div class="stat-value">${formatMoney(todaySpent, currency)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Left to allocate</div>
        <div class="stat-value">${formatMoney(summary.toBeBudgeted, currency)}</div>
      </div>
    </div>

    <section class="panel">
      <div class="panel-header">
        <h3>History</h3>
      </div>
      <div class="filter-row">
        <input type="search" placeholder="Search payee…" value="${escapeHtml(filter.search)}" data-filter="search" class="input" />
        <select data-filter="accountId" class="input">
          <option value="">All accounts</option>
          ${accounts.map((a) => `<option value="${a.id}" ${String(a.id) === filter.accountId ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
        </select>
        <select data-filter="categoryId" class="input">
          <option value="">All categories</option>
          ${categories.map((c) => `<option value="${c.id}" ${String(c.id) === filter.categoryId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="month-switcher" style="margin-bottom:14px">
        <button type="button" class="icon-btn" data-action="prev-month" aria-label="Previous month">${icon('chevronLeft')}</button>
        <span style="font-weight:700">${filter.month ? monthLabel(filter.month) : 'All time'}</span>
        <button type="button" class="icon-btn" data-action="next-month" aria-label="Next month">${icon('chevronRight')}</button>
        <button type="button" class="link" data-action="toggle-month" style="margin-left:auto">${filter.month ? 'Show all time' : 'Show this month'}</button>
      </div>
      ${list.length ? renderTable(list, accountMap, categoryMap, categories, currency) : `<p class="empty-hint">No transactions match these filters.</p>`}
    </section>
  `;

  root.querySelectorAll('[data-category-chip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      quick.categoryId = Number(btn.dataset.categoryChip);
      root.querySelectorAll('[data-category-chip]').forEach((b) => b.classList.toggle('chip-active', b === btn));
    });
  });

  root.querySelector('input[name="date"]').addEventListener('change', (e) => {
    quick.date = e.target.value || todayIso();
    render(root);
  });

  root.querySelector('#quick-add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const amount = parseFloat(fd.get('amount'));
    if (!amount || amount <= 0) {
      toast('Enter an amount greater than zero.', { type: 'error' });
      return;
    }
    const accountId = Number(fd.get('accountId'));
    const categoryId = quick.categoryId;
    const date = fd.get('date') || quick.date;

    await DB.saveTransaction({ date, type: 'expense', accountId, categoryId, amount, payee: fd.get('payee') || '' });

    const updated = await getMonthSummary(date.slice(0, 7));
    const row = updated.rows.find((r) => r.category.id === categoryId);
    const category = categories.find((c) => c.id === categoryId);
    if (row && row.allocated > 0) {
      toast(`Added to ${category.name} — ${formatMoney(row.spent, currency)} of ${formatMoney(row.allocated, currency)} used`, {
        type: row.available < 0 ? 'error' : 'success',
      });
    } else {
      toast(`Added to ${category?.name || 'category'}`, { type: 'success' });
    }
    quick.accountId = accountId;
    render(root);
  });

  root.querySelector('[data-action="add-other"]').addEventListener('click', () => {
    openTransactionModal({ onSaved: () => render(root) });
  });

  const prevBtn = root.querySelector('[data-action="prev-month"]');
  const nextBtn = root.querySelector('[data-action="next-month"]');
  if (prevBtn) prevBtn.addEventListener('click', () => { filter.month = shiftMonth(filter.month, -1); render(root); });
  if (nextBtn) nextBtn.addEventListener('click', () => { filter.month = shiftMonth(filter.month, 1); render(root); });
  root.querySelector('[data-action="toggle-month"]').addEventListener('click', () => {
    filter.month = filter.month ? '' : currentMonth();
    render(root);
  });
  root.querySelector('[data-filter="search"]').addEventListener('input', (e) => {
    filter.search = e.target.value;
    render(root);
  });
  root.querySelector('[data-filter="accountId"]').addEventListener('change', (e) => {
    filter.accountId = e.target.value;
    render(root);
  });
  root.querySelector('[data-filter="categoryId"]').addEventListener('change', (e) => {
    filter.categoryId = e.target.value;
    render(root);
  });

  root.querySelectorAll('[data-tx-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const id = Number(el.dataset.txId);
      const t = list.find((x) => x.id === id);
      if (t) openTransactionModal({ transaction: t, onSaved: () => render(root) });
    });
  });

  root.querySelectorAll('[data-tx-recategorize]').forEach((select) => {
    select.addEventListener('click', (e) => e.stopPropagation());
    select.addEventListener('change', async (e) => {
      e.stopPropagation();
      const id = Number(select.dataset.txRecategorize);
      const newCategoryId = Number(select.value);
      const t = list.find((x) => x.id === id);
      if (!t) return;
      await DB.saveTransaction({ ...t, categoryId: newCategoryId });
      const newCategory = categories.find((c) => c.id === newCategoryId);
      toast(`Moved to ${newCategory?.group || ''} — ${newCategory?.name || ''}`, { type: 'success' });
      render(root);
    });
  });
}

function renderTable(transactions, accountMap, categoryMap, categories, currency) {
  const rows = transactions
    .map((t) => {
      const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '';
      const cls = t.type === 'income' ? 'positive' : t.type === 'expense' ? 'negative' : '';
      const account = accountMap.get(t.accountId);
      const category = t.categoryId ? categoryMap.get(t.categoryId) : null;

      const tag = t.type === 'expense'
        ? `<select class="group-tag" data-tx-recategorize="${t.id}" style="--tag-color:${category?.color || '#64748b'}" aria-label="Category and group">
            ${categories.map((c) => `<option value="${c.id}" ${c.id === t.categoryId ? 'selected' : ''}>${escapeHtml(c.group)} · ${escapeHtml(c.name)}</option>`).join('')}
          </select>`
        : `<span class="tx-meta">${t.type === 'transfer' ? `Transfer → ${escapeHtml(accountMap.get(t.transferAccountId)?.name || '—')}` : 'Income'}</span>`;

      return `
        <div class="tx-table-row" data-tx-id="${t.id}" role="button" tabindex="0">
          <div class="tx-table-date">${formatDateLong(t.date)}</div>
          <div class="tx-table-main">
            <span class="tx-payee">
              ${escapeHtml(t.payee || (t.type === 'income' ? 'Income' : t.type === 'transfer' ? 'Transfer' : 'Expense'))}
              ${t.recurring ? `<span class="recurring-mark">${icon('repeat')} auto</span>` : ''}
            </span>
            <span class="tx-meta">${escapeHtml(account?.name || '—')}</span>
            ${tag}
          </div>
          <span class="tx-amount ${cls}">${sign}${formatMoney(Math.abs(t.amount), currency)}</span>
        </div>
      `;
    })
    .join('');
  return `<div class="tx-table">${rows}</div>`;
}
