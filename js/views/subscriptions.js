import { DB } from '../db.js';
import { monthlyEquivalent, yearlyEquivalent, nextDueDate, generateDueTransactions } from '../subscription-logic.js';
import { formatMoney, formatDateLong, escapeHtml } from '../format.js';
import { openSubscriptionModal } from '../subscription-form.js';
import { toast } from '../ui.js';
import { icon } from '../icons.js';

export async function render(root) {
  const currency = await DB.getSetting('currency', 'SAR');
  const [categories, accounts] = await Promise.all([DB.listCategories(), DB.listAccounts()]);
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const subs = await DB.listSubscriptions({ includeInactive: true });

  const active = subs.filter((s) => s.active !== false);
  const monthlyTotal = active.reduce((sum, s) => sum + monthlyEquivalent(s), 0);
  const yearlyTotal = active.reduce((sum, s) => sum + yearlyEquivalent(s), 0);

  const sorted = [...subs].sort((a, b) => {
    if ((a.active !== false) !== (b.active !== false)) return a.active !== false ? -1 : 1;
    return nextDueDate(a).localeCompare(nextDueDate(b));
  });

  root.innerHTML = `
    <div class="view-header">
      <h2>Subscriptions</h2>
      <button type="button" class="btn btn-primary" data-action="add">+ Add subscription</button>
    </div>

    <div class="stat-row">
      <div class="stat-card highlight">
        <div class="stat-label">Monthly cost</div>
        <div class="stat-value">${formatMoney(monthlyTotal, currency)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Yearly cost</div>
        <div class="stat-value">${formatMoney(yearlyTotal, currency)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active</div>
        <div class="stat-value">${active.length}</div>
      </div>
    </div>

    <div class="banner">
      Due charges are added to Track and Budget automatically — every time the amount and due date you set actually arrives, without you having to remember to enter it. Since there's no background server, "automatic" means it catches up the next time you open the app on or after the due date.
    </div>

    <section class="panel" style="margin-top:16px">
      <div class="panel-header"><h3>All subscriptions</h3></div>
      <div class="sub-list">
        ${sorted.length ? sorted.map((s) => subRow(s, currency, categoryMap, accountMap)).join('') : `<p class="empty-hint">No subscriptions yet — add your first recurring charge above.</p>`}
      </div>
    </section>
  `;

  root.querySelector('[data-action="add"]').addEventListener('click', () => {
    openSubscriptionModal({ onSaved: () => render(root) });
  });

  root.querySelectorAll('[data-edit-sub]').forEach((el) => {
    el.addEventListener('click', async () => {
      const id = Number(el.dataset.editSub);
      const all = await DB.listSubscriptions({ includeInactive: true });
      const sub = all.find((x) => x.id === id);
      if (sub) openSubscriptionModal({ subscription: sub, onSaved: () => render(root) });
    });
  });

  root.querySelectorAll('[data-toggle-active]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.toggleActive);
      const all = await DB.listSubscriptions({ includeInactive: true });
      const sub = all.find((x) => x.id === id);
      if (!sub) return;
      const nowActive = sub.active === false;
      await DB.saveSubscription({ ...sub, active: nowActive });
      if (nowActive) {
        const generated = await generateDueTransactions();
        const mine = generated.find((g) => g.subscription.id === id);
        if (mine) toast(`Resumed — caught up ${mine.count} due charge${mine.count > 1 ? 's' : ''}`, { type: 'success' });
        else toast('Subscription resumed', { type: 'success' });
      } else {
        toast('Subscription paused', { type: 'success' });
      }
      render(root);
    });
  });
}

function subRow(s, currency, categoryMap, accountMap) {
  const category = categoryMap.get(s.categoryId);
  const account = accountMap.get(s.accountId);
  const paused = s.active === false;
  const cadenceLabel = s.cadence === 'yearly' ? 'Yearly' : 'Monthly';
  const due = paused ? null : nextDueDate(s);

  return `
    <div class="sub-row ${paused ? 'paused' : ''}" data-edit-sub="${s.id}" role="button" tabindex="0">
      <div class="sub-main">
        <span class="sub-name">
          ${category ? `<span class="dot" style="background:${category.color || '#64748b'}"></span>` : ''}
          ${escapeHtml(s.name)}
          <span class="cadence-badge">${cadenceLabel}</span>
        </span>
        <span class="sub-meta">
          ${category ? `${escapeHtml(category.group)} · ${escapeHtml(category.name)} · ` : ''}${escapeHtml(account?.name || '—')}
          ${paused ? ' · Paused' : due ? ` · Next: ${escapeHtml(formatDateLong(due))}` : ''}
        </span>
      </div>
      <div class="sub-right">
        <span class="sub-amount">${formatMoney(s.amount, currency)}</span>
        <button type="button" class="btn btn-ghost btn-sm" data-toggle-active="${s.id}">${paused ? icon('play') + ' Resume' : icon('pause') + ' Pause'}</button>
      </div>
    </div>
  `;
}
