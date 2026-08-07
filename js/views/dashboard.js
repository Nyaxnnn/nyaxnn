import { DB } from '../db.js';
import { getMonthSummary } from '../budget-logic.js';
import { formatMoney, monthLabel, currentMonth, shiftMonth, formatDateShort, escapeHtml } from '../format.js';
import { openTransactionModal } from '../transaction-form.js';

let state = { month: currentMonth() };

export async function render(root) {
  const currency = await DB.getSetting('currency', 'SAR');
  const summary = await getMonthSummary(state.month);
  const recent = (await DB.listTransactions({ month: state.month })).slice(0, 6);
  const accounts = await DB.listAccounts();

  const tbb = summary.toBeBudgeted;
  const tbbClass = tbb < 0 ? 'negative' : tbb === 0 ? 'zero' : 'positive';

  root.innerHTML = `
    <div class="view-header">
      <div class="month-switcher">
        <button type="button" class="icon-btn" data-action="prev-month" aria-label="Previous month">‹</button>
        <h2>${monthLabel(state.month)}</h2>
        <button type="button" class="icon-btn" data-action="next-month" aria-label="Next month">›</button>
      </div>
      <button type="button" class="btn btn-primary" data-action="quick-add">+ Add transaction</button>
    </div>

    <div class="tbb-card tbb-${tbbClass}">
      <div class="tbb-label">To Be Budgeted</div>
      <div class="tbb-amount">${formatMoney(tbb, currency)}</div>
      <div class="tbb-hint">${tbb > 0 ? 'Assign this in the Budget tab so every riyal has a job.' : tbb < 0 ? 'You’ve allocated more than you’ve earned this month.' : 'Fully allocated — nice.'}</div>
    </div>

    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-label">Income</div>
        <div class="stat-value">${formatMoney(summary.income, currency)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Allocated</div>
        <div class="stat-value">${formatMoney(summary.allocatedTotal, currency)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Spent</div>
        <div class="stat-value">${formatMoney(summary.spentTotal, currency)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Available</div>
        <div class="stat-value">${formatMoney(summary.availableTotal, currency)}</div>
      </div>
    </div>

    <section class="panel">
      <div class="panel-header">
        <h3>Envelopes</h3>
        <a href="#/budget" class="link">Manage budget →</a>
      </div>
      ${summary.rows.length ? `<div class="envelope-list">${summary.rows.map(envelopeRow(currency)).join('')}</div>` : emptyCategories()}
    </section>

    <section class="panel">
      <div class="panel-header">
        <h3>Recent transactions</h3>
        <a href="#/transactions" class="link">View all →</a>
      </div>
      ${recent.length ? `<div class="tx-list">${recent.map(txRow(currency)).join('')}</div>` : `<p class="empty-hint">No transactions yet this month.</p>`}
    </section>

    ${accounts.length === 0 ? `<div class="banner">Add your first account in <a href="#/settings">Settings</a> to start tracking.</div>` : ''}
  `;

  root.querySelector('[data-action="prev-month"]').addEventListener('click', () => {
    state.month = shiftMonth(state.month, -1);
    render(root);
  });
  root.querySelector('[data-action="next-month"]').addEventListener('click', () => {
    state.month = shiftMonth(state.month, 1);
    render(root);
  });
  root.querySelector('[data-action="quick-add"]').addEventListener('click', () => {
    openTransactionModal({ onSaved: () => render(root) });
  });
  root.querySelectorAll('[data-tx-id]').forEach((el) => {
    el.addEventListener('click', async () => {
      const id = Number(el.dataset.txId);
      const all = await DB.listTransactions();
      const t = all.find((x) => x.id === id);
      if (t) openTransactionModal({ transaction: t, onSaved: () => render(root) });
    });
  });
}

function envelopeRow(currency) {
  return (row) => {
    const pct = row.allocated > 0 ? Math.min(100, Math.round((row.spent / row.allocated) * 100)) : row.spent > 0 ? 100 : 0;
    const over = row.available < 0;
    return `
      <div class="envelope-row">
        <div class="envelope-top">
          <span class="envelope-name">${row.category.color ? `<span class="dot" style="background:${row.category.color}"></span>` : ''}${escapeHtml(row.category.name)}</span>
          <span class="envelope-available ${over ? 'negative' : ''}">${formatMoney(row.available, currency)}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill ${over ? 'over' : ''}" style="width:${pct}%"></div>
        </div>
        <div class="envelope-sub">${formatMoney(row.spent, currency)} of ${formatMoney(row.allocated, currency)}</div>
      </div>
    `;
  };
}

function txRow(currency) {
  return (t) => {
    const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '';
    const cls = t.type === 'income' ? 'positive' : t.type === 'expense' ? 'negative' : '';
    return `
      <div class="tx-row" data-tx-id="${t.id}" role="button" tabindex="0">
        <div class="tx-main">
          <span class="tx-payee">${escapeHtml(t.payee || (t.type === 'transfer' ? 'Transfer' : t.type === 'income' ? 'Income' : 'Expense'))}</span>
          <span class="tx-date">${formatDateShort(t.date)}</span>
        </div>
        <span class="tx-amount ${cls}">${sign}${formatMoney(Math.abs(t.amount), currency)}</span>
      </div>
    `;
  };
}

function emptyCategories() {
  return `<p class="empty-hint">No budget categories yet. Add some in the <a href="#/budget">Budget</a> tab.</p>`;
}
