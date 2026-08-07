import { DB } from '../db.js';
import { getNetWorthToday, getTrackedNetWorthTrend } from '../networth-logic.js';
import { lineChart, donutChart } from '../charts.js';
import { formatMoney, formatDateShort, todayIso, escapeHtml } from '../format.js';
import { openAccountModal } from '../account-form.js';
import { openModal, toast } from '../ui.js';

export async function render(root) {
  const currency = await DB.getSetting('currency', 'SAR');
  const [netWorth, trend] = await Promise.all([getNetWorthToday(), getTrackedNetWorthTrend()]);

  const allocationData = netWorth.breakdown
    .filter((b) => b.balance !== 0)
    .map((b) => ({ label: b.account.name, value: Math.abs(b.balance) }));

  root.innerHTML = `
    <div class="view-header">
      <h2>Net worth</h2>
      <button type="button" class="btn btn-primary" data-action="add-account">+ Investment / savings account</button>
    </div>

    <div class="stat-row">
      <div class="stat-card highlight">
        <div class="stat-label">Total net worth (today)</div>
        <div class="stat-value">${formatMoney(netWorth.total, currency)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Cash & bank</div>
        <div class="stat-value">${formatMoney(netWorth.cashTotal, currency)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Investments & savings</div>
        <div class="stat-value">${formatMoney(netWorth.trackedTotal, currency)}</div>
      </div>
    </div>

    <section class="panel">
      <div class="panel-header"><h3>Investments & savings over time</h3></div>
      ${trend.length >= 2
        ? lineChart(trend.map((p) => ({ x: formatDateShort(p.date), y: p.total })), { currency, color: '#8b5cf6' })
        : `<p class="empty-hint">Update a balance a couple of times to see the trend build up here.</p>`}
    </section>

    ${allocationData.length ? `
    <section class="panel">
      <div class="panel-header"><h3>Allocation</h3></div>
      ${donutChart(allocationData, { currency })}
    </section>` : ''}

    <section class="panel">
      <div class="panel-header"><h3>Accounts</h3></div>
      <div class="account-list">
        ${netWorth.breakdown.map(accountRow(currency)).join('') || '<p class="empty-hint">No accounts yet.</p>'}
      </div>
    </section>
  `;

  root.querySelector('[data-action="add-account"]').addEventListener('click', () => {
    openAccountModal({ defaultType: 'investment', onSaved: () => render(root) });
  });
  root.querySelectorAll('[data-edit-account]').forEach((el) => {
    el.addEventListener('click', async () => {
      const id = Number(el.dataset.editAccount);
      const accounts = await DB.listAccounts();
      const account = accounts.find((a) => a.id === id);
      if (account) openAccountModal({ account, onSaved: () => render(root) });
    });
  });
  root.querySelectorAll('[data-update-balance]').forEach((el) => {
    el.addEventListener('click', async () => {
      const id = Number(el.dataset.updateBalance);
      const accounts = await DB.listAccounts();
      const account = accounts.find((a) => a.id === id);
      if (account) openBalanceModal(account, () => render(root));
    });
  });
}

function accountRow(currency) {
  return ({ account, balance }) => `
    <div class="account-row">
      <div>
        <button type="button" class="category-name-btn" data-edit-account="${account.id}">${escapeHtml(account.name)}</button>
        <div class="muted small">${labelForType(account.type)}</div>
      </div>
      <div class="account-row-right">
        <strong>${formatMoney(balance, currency)}</strong>
        ${account.type !== 'cash' ? `<button type="button" class="btn btn-ghost btn-sm" data-update-balance="${account.id}">Update balance</button>` : ''}
      </div>
    </div>
  `;
}

function labelForType(type) {
  if (type === 'cash') return 'Cash / bank — auto-tracked from transactions';
  if (type === 'savings') return 'Savings — manual balance';
  return 'Investment — manual balance';
}

function openBalanceModal(account, onSaved) {
  openModal({
    title: `Update balance — ${account.name}`,
    bodyHtml: `
      <form id="bal-form" class="form">
        <label class="field">
          <span>Current balance (SAR)</span>
          <input type="number" step="0.01" name="balance" required autofocus />
        </label>
        <label class="field">
          <span>As of</span>
          <input type="date" name="date" value="${todayIso()}" required />
        </label>
      </form>
    `,
    footerHtml: `<span></span><button type="button" class="btn btn-primary" data-action="save">Save</button>`,
    onMount: (overlay, close) => {
      overlay.querySelector('[data-action="save"]').addEventListener('click', async () => {
        const fd = new FormData(overlay.querySelector('#bal-form'));
        const balance = parseFloat(fd.get('balance'));
        if (Number.isNaN(balance)) {
          toast('Enter a balance.', { type: 'error' });
          return;
        }
        await DB.saveSnapshot({ accountId: account.id, date: fd.get('date'), balance });
        toast('Balance updated', { type: 'success' });
        close();
        onSaved();
      });
    },
  });
}
