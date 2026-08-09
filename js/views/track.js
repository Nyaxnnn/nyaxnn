// Fast daily spending entry. Every entry saved here is a normal transaction —
// it automatically counts against its category's envelope (Budget tab) and
// shows up in Insights. This view exists purely to make logging quick.

import { DB } from '../db.js';
import { getMonthSummary, spendingByGroup } from '../budget-logic.js';
import { donutChart } from '../charts.js';
import { formatMoney, todayIso, monthLabel, formatDateShort, escapeHtml } from '../format.js';
import { toast } from '../ui.js';
import { openTransactionModal } from '../transaction-form.js';

let state = { date: todayIso(), categoryId: null, accountId: null };

export async function render(root) {
  const currency = await DB.getSetting('currency', 'SAR');
  const [accounts, categories] = await Promise.all([DB.listAccounts(), DB.listCategories()]);
  const cashAccounts = accounts.filter((a) => a.type === 'cash');

  if (!accounts.length || !categories.length) {
    root.innerHTML = `
      <div class="view-header"><h2>Track spending</h2></div>
      <div class="banner">
        ${!accounts.length ? 'Add an account in <a href="#/settings">Settings</a> first. ' : ''}
        ${!categories.length ? 'Add at least one category in <a href="#/budget">Budget</a> first.' : ''}
      </div>
    `;
    return;
  }

  if (!state.accountId || !accounts.some((a) => a.id === state.accountId)) {
    state.accountId = (cashAccounts[0] || accounts[0]).id;
  }
  if (!state.categoryId || !categories.some((c) => c.id === state.categoryId)) {
    state.categoryId = categories[0].id;
  }

  const month = state.date.slice(0, 7);
  const summary = await getMonthSummary(month);
  const monthTx = await DB.listTransactions({ month });
  const todaySpent = monthTx
    .filter((t) => t.type === 'expense' && t.date === state.date)
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const monthSpent = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0);

  const groupSpend = await spendingByGroup(month);
  const groupTotal = groupSpend.reduce((s, g) => s + g.value, 0);
  const groupChartData = groupSpend.map((g) => ({
    ...g,
    label: groupTotal > 0 ? `${g.label} (${Math.round((g.value / groupTotal) * 100)}%)` : g.label,
  }));

  const days = groupByDay(monthTx);

  root.innerHTML = `
    <div class="view-header">
      <h2>Track spending</h2>
      <span class="muted">${monthLabel(month)}</span>
    </div>

    <section class="panel quick-add-panel">
      <form id="quick-add-form" class="form">
        <div class="quick-add-top">
          <label class="field amount-field">
            <span>Amount (SAR)</span>
            <input type="number" step="0.01" min="0" name="amount" id="track-amount" placeholder="0.00" required autocomplete="off" />
          </label>
          <label class="field date-field">
            <span>Date</span>
            <input type="date" name="date" value="${state.date}" max="${todayIso()}" />
          </label>
        </div>

        <div class="field">
          <span>Category</span>
          <div class="chip-row">
            ${categories.map((c) => `
              <button type="button" class="chip ${c.id === state.categoryId ? 'chip-active' : ''}" data-category-chip="${c.id}" style="--chip-color:${c.color || '#64748b'}">
                <span class="dot" style="background:${c.color || '#64748b'}"></span>${escapeHtml(c.name)}
              </button>
            `).join('')}
          </div>
        </div>

        ${accounts.length > 1 ? `
        <label class="field">
          <span>Account</span>
          <select name="accountId">
            ${accounts.map((a) => `<option value="${a.id}" ${a.id === state.accountId ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
          </select>
        </label>` : `<input type="hidden" name="accountId" value="${state.accountId}" />`}

        <input type="text" name="payee" placeholder="Note (optional) — e.g. Panda, Careem" class="input" />

        <button type="submit" class="btn btn-primary btn-block">+ Add expense</button>
      </form>
    </section>

    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-label">Spent today</div>
        <div class="stat-value">${formatMoney(todaySpent, currency)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Spent this month</div>
        <div class="stat-value">${formatMoney(monthSpent, currency)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Left to allocate</div>
        <div class="stat-value">${formatMoney(summary.toBeBudgeted, currency)}</div>
      </div>
    </div>

    <section class="panel">
      <div class="panel-header"><h3>Needs, Wants & Savings — ${monthLabel(month)}</h3></div>
      ${groupTotal > 0
        ? donutChart(groupChartData, { currency })
        : `<p class="empty-hint">Log a few expenses and this will show how your money splits across needs, wants, and savings.</p>`}
    </section>

    <section class="panel">
      <div class="panel-header">
        <h3>Daily log</h3>
        <a href="#/budget" class="link">See budget impact →</a>
      </div>
      ${days.length ? days.map(dayGroup(currency)).join('') : `<p class="empty-hint">Nothing logged yet this month — add your first expense above.</p>`}
    </section>
  `;

  root.querySelectorAll('[data-category-chip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.categoryId = Number(btn.dataset.categoryChip);
      root.querySelectorAll('[data-category-chip]').forEach((b) => b.classList.toggle('chip-active', b === btn));
    });
  });

  root.querySelector('input[name="date"]')?.addEventListener('change', (e) => {
    state.date = e.target.value || todayIso();
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
    const categoryId = state.categoryId;
    const date = fd.get('date') || state.date;

    await DB.saveTransaction({
      date,
      type: 'expense',
      accountId,
      categoryId,
      amount,
      payee: fd.get('payee') || '',
    });

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

    state.accountId = accountId;
    render(root);
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

function groupByDay(transactions) {
  const map = new Map();
  for (const t of transactions) {
    if (!map.has(t.date)) map.set(t.date, []);
    map.get(t.date).push(t);
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, txs]) => ({
      date,
      txs,
      total: txs.filter((t) => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount), 0),
    }));
}

function dayGroup(currency) {
  return ({ date, txs, total }) => `
    <div class="day-group">
      <div class="day-header">
        <span>${dayLabel(date)}</span>
        <span class="muted">${formatMoney(total, currency)}</span>
      </div>
      <div class="tx-list">
        ${txs.map((t) => txRow(t, currency)).join('')}
      </div>
    </div>
  `;
}

function txRow(t, currency) {
  const sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '';
  const cls = t.type === 'income' ? 'positive' : t.type === 'expense' ? 'negative' : '';
  return `
    <div class="tx-row" data-tx-id="${t.id}" role="button" tabindex="0">
      <div class="tx-main">
        <span class="tx-payee">${escapeHtml(t.payee || (t.type === 'income' ? 'Income' : t.type === 'transfer' ? 'Transfer' : 'Expense'))}</span>
      </div>
      <span class="tx-amount ${cls}">${sign}${formatMoney(Math.abs(t.amount), currency)}</span>
    </div>
  `;
}

function dayLabel(dateStr) {
  if (dateStr === todayIso()) return 'Today';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === yesterday.toISOString().slice(0, 10)) return 'Yesterday';
  return formatDateShort(dateStr);
}
