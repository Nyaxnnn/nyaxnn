import { DB } from '../db.js';
import { getMonthSummary } from '../budget-logic.js';
import { formatMoney, monthLabel, currentMonth, shiftMonth, escapeHtml } from '../format.js';
import { openCategoryModal } from '../category-form.js';
import { openSubscriptionModal } from '../subscription-form.js';
import { toast } from '../ui.js';
import { icon } from '../icons.js';
import * as subscriptionsSegment from './subscriptions.js';

let state = { month: currentMonth(), segment: 'envelopes' };

export async function render(root) {
  root.innerHTML = `
    <div class="view-header">
      <h2>Budget</h2>
      <div class="header-actions" id="budget-header-actions"></div>
    </div>
    <div class="segmented" style="margin-bottom:18px">
      <button type="button" class="segmented-btn ${state.segment === 'envelopes' ? 'active' : ''}" data-segment="envelopes">Envelopes</button>
      <button type="button" class="segmented-btn ${state.segment === 'subscriptions' ? 'active' : ''}" data-segment="subscriptions">Subscriptions</button>
    </div>
    <div id="budget-segment-content"></div>
  `;

  root.querySelectorAll('[data-segment]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.segment = btn.dataset.segment;
      render(root);
    });
  });

  const actions = root.querySelector('#budget-header-actions');
  const content = root.querySelector('#budget-segment-content');

  if (state.segment === 'subscriptions') {
    actions.innerHTML = `<button type="button" class="btn btn-primary" data-action="add-sub">+ Add subscription</button>`;
    actions.querySelector('[data-action="add-sub"]').addEventListener('click', () => {
      openSubscriptionModal({ onSaved: () => render(root) });
    });
    await subscriptionsSegment.render(content);
    return;
  }

  actions.innerHTML = `
    <button type="button" class="btn btn-ghost" data-action="fill-targets">Fill from targets</button>
    <button type="button" class="btn btn-primary" data-action="add-category">+ Category</button>
  `;
  await renderEnvelopes(content);

  actions.querySelector('[data-action="add-category"]').addEventListener('click', () => {
    openCategoryModal({ onSaved: () => render(root) });
  });
  actions.querySelector('[data-action="fill-targets"]').addEventListener('click', async () => {
    const categories = await DB.listCategories();
    for (const c of categories) {
      if (c.monthlyTarget > 0) {
        await DB.setAllocation(state.month, c.id, c.monthlyTarget);
      }
    }
    toast('Allocations filled from each category’s default target.', { type: 'success' });
    render(root);
  });
}

async function renderEnvelopes(content) {
  const currency = await DB.getSetting('currency', 'SAR');
  const summary = await getMonthSummary(state.month);
  const groups = groupRows(summary.rows);
  const tbb = summary.toBeBudgeted;
  const tbbClass = tbb < 0 ? 'negative' : tbb === 0 ? 'zero' : 'positive';

  content.innerHTML = `
    <div class="month-switcher" style="margin-bottom:16px">
      <button type="button" class="icon-btn" data-action="prev-month" aria-label="Previous month">${icon('chevronLeft')}</button>
      <span style="font-weight:700">${monthLabel(state.month)}</span>
      <button type="button" class="icon-btn" data-action="next-month" aria-label="Next month">${icon('chevronRight')}</button>
    </div>

    <div class="tbb-card tbb-${tbbClass} tbb-compact">
      <div class="tbb-label">To Be Budgeted</div>
      <div class="tbb-amount">${formatMoney(tbb, currency)}</div>
    </div>

    ${Object.entries(groups).length ? Object.entries(groups).map(([group, rows]) => groupSection(group, rows, currency)).join('') : `<p class="empty-hint">No categories yet — add one to start budgeting.</p>`}
  `;

  content.querySelector('[data-action="prev-month"]').addEventListener('click', () => {
    state.month = shiftMonth(state.month, -1);
    renderEnvelopes(content);
  });
  content.querySelector('[data-action="next-month"]').addEventListener('click', () => {
    state.month = shiftMonth(state.month, 1);
    renderEnvelopes(content);
  });
  content.querySelectorAll('[data-edit-category]').forEach((el) => {
    el.addEventListener('click', async () => {
      const id = Number(el.dataset.editCategory);
      const cats = await DB.listCategories();
      const cat = cats.find((c) => c.id === id);
      if (cat) openCategoryModal({ category: cat, onSaved: () => renderEnvelopes(content) });
    });
  });
  content.querySelectorAll('[data-allocate-input]').forEach((input) => {
    input.addEventListener('change', async () => {
      const categoryId = Number(input.dataset.allocateInput);
      const amount = parseFloat(input.value) || 0;
      await DB.setAllocation(state.month, categoryId, amount);
      renderEnvelopes(content);
    });
  });
}

function groupRows(rows) {
  const groups = {};
  for (const row of rows) {
    const g = row.category.group || 'Other';
    if (!groups[g]) groups[g] = [];
    groups[g].push(row);
  }
  return groups;
}

function groupSection(group, rows, currency) {
  const groupAllocated = rows.reduce((s, r) => s + r.allocated, 0);
  return `
    <section class="panel">
      <div class="panel-header">
        <h3>${escapeHtml(group)}</h3>
        <span class="muted">${formatMoney(groupAllocated, currency)} allocated</span>
      </div>
      <div class="budget-rows">
        ${rows.map((row) => budgetRow(row, currency)).join('')}
      </div>
    </section>
  `;
}

function budgetRow(row, currency) {
  const over = row.available < 0;
  return `
    <div class="budget-row">
      <button type="button" class="category-name-btn" data-edit-category="${row.category.id}">
        <span class="dot" style="background:${row.category.color || '#64748b'}"></span>
        ${escapeHtml(row.category.name)}
      </button>
      <div class="budget-inputs">
        <label class="allocate-field">
          <span>Allocated</span>
          <input type="number" step="0.01" min="0" data-allocate-input="${row.category.id}" value="${row.allocated || ''}" placeholder="0.00" />
        </label>
        <div class="budget-figure">
          <span class="muted">Spent</span>
          <strong>${formatMoney(row.spent, currency)}</strong>
        </div>
        <div class="budget-figure">
          <span class="muted">Available</span>
          <strong class="${over ? 'negative' : 'positive'}">${formatMoney(row.available, currency)}</strong>
        </div>
      </div>
    </div>
  `;
}
