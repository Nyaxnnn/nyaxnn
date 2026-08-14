import { DB } from './db.js';
import { openModal, toast, confirmDialog } from './ui.js';
import { escapeHtml, todayIso } from './format.js';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export async function openSubscriptionModal({ subscription = null, onSaved } = {}) {
  const [accounts, categories] = await Promise.all([DB.listAccounts(), DB.listCategories()]);

  if (!accounts.length || !categories.length) {
    toast('Add an account and a category first (Settings / Budget).', { type: 'error' });
    return;
  }

  const isEdit = !!subscription;
  const s = subscription || {
    name: '',
    amount: '',
    accountId: accounts.find((a) => a.type === 'cash')?.id ?? accounts[0].id,
    categoryId: categories[0].id,
    cadence: 'monthly',
    day: new Date().getDate(),
    month: new Date().getMonth() + 1,
    startDate: todayIso(),
    active: true,
  };

  const bodyHtml = `
    <form id="sub-form" class="form">
      <label class="field">
        <span>Name</span>
        <input type="text" name="name" required value="${escapeHtml(s.name)}" placeholder="e.g. Netflix, Gym membership" />
      </label>

      <label class="field">
        <span>Amount (SAR)</span>
        <input type="number" step="0.01" min="0" name="amount" required value="${s.amount}" placeholder="0.00" />
      </label>

      <div class="segmented" role="tablist">
        <button type="button" class="segmented-btn ${s.cadence === 'monthly' ? 'active' : ''}" data-cadence="monthly">Monthly</button>
        <button type="button" class="segmented-btn ${s.cadence === 'yearly' ? 'active' : ''}" data-cadence="yearly">Yearly</button>
      </div>

      <div class="quick-add-top">
        <label class="field" data-field="month" style="display:${s.cadence === 'yearly' ? 'flex' : 'none'}">
          <span>Month</span>
          <select name="month">
            ${MONTH_NAMES.map((name, i) => `<option value="${i + 1}" ${i + 1 === s.month ? 'selected' : ''}>${name}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span>Day</span>
          <input type="number" name="day" min="1" max="31" required value="${s.day}" />
        </label>
      </div>
      <p class="field-hint">If a month has fewer days than this, it charges on that month's last day instead.</p>

      <label class="field">
        <span>Category</span>
        <select name="categoryId">
          ${categories.map((c) => `<option value="${c.id}" ${c.id === s.categoryId ? 'selected' : ''}>${escapeHtml(c.group)} · ${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </label>

      <label class="field">
        <span>Account</span>
        <select name="accountId">
          ${accounts.map((a) => `<option value="${a.id}" ${a.id === s.accountId ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}
        </select>
      </label>

      <label class="field">
        <span>Starts on</span>
        <input type="date" name="startDate" required value="${s.startDate}" />
      </label>
      <p class="field-hint">Entries are added automatically for every due date from here to today, and again each time you open the app.</p>
    </form>
  `;

  const footerHtml = `
    ${isEdit ? '<button type="button" class="btn btn-danger" data-action="delete">Delete</button>' : '<span></span>'}
    <button type="button" class="btn btn-primary" data-action="save">${isEdit ? 'Save changes' : 'Add subscription'}</button>
  `;

  openModal({
    title: isEdit ? 'Edit subscription' : 'New subscription',
    bodyHtml,
    footerHtml,
    onMount: (overlay, close) => {
      const form = overlay.querySelector('#sub-form');
      let cadence = s.cadence;

      overlay.querySelectorAll('[data-cadence]').forEach((btn) => {
        btn.addEventListener('click', () => {
          cadence = btn.dataset.cadence;
          overlay.querySelectorAll('[data-cadence]').forEach((b) => b.classList.toggle('active', b === btn));
          overlay.querySelector('[data-field="month"]').style.display = cadence === 'yearly' ? 'flex' : 'none';
        });
      });

      overlay.querySelector('[data-action="save"]').addEventListener('click', async () => {
        const fd = new FormData(form);
        const name = (fd.get('name') || '').trim();
        const amount = parseFloat(fd.get('amount'));
        const day = parseInt(fd.get('day'), 10);
        if (!name) { toast('Give the subscription a name.', { type: 'error' }); return; }
        if (!amount || amount <= 0) { toast('Enter an amount greater than zero.', { type: 'error' }); return; }
        if (!day || day < 1 || day > 31) { toast('Day must be between 1 and 31.', { type: 'error' }); return; }

        const cadenceChanged = isEdit && s.cadence !== cadence;
        const record = {
          ...(isEdit ? { id: s.id, createdAt: s.createdAt, active: s.active } : { active: true }),
          name,
          amount,
          cadence,
          day,
          month: cadence === 'yearly' ? Number(fd.get('month')) : null,
          categoryId: Number(fd.get('categoryId')),
          accountId: Number(fd.get('accountId')),
          startDate: fd.get('startDate'),
          lastGeneratedPeriod: cadenceChanged ? null : (isEdit ? s.lastGeneratedPeriod : null),
        };
        await DB.saveSubscription(record);
        toast(isEdit ? 'Subscription updated' : 'Subscription added', { type: 'success' });
        close();
        if (onSaved) onSaved();
      });

      if (isEdit) {
        overlay.querySelector('[data-action="delete"]').addEventListener('click', async () => {
          const ok = await confirmDialog('This stops future auto-charges. Transactions already generated by this subscription stay in your history.', { confirmLabel: 'Delete subscription' });
          if (!ok) return;
          await DB.deleteSubscription(s.id);
          toast('Subscription deleted', { type: 'success' });
          close();
          if (onSaved) onSaved();
        });
      }
    },
  });
}
