import { DB } from '../db.js';
import { getMonthSummary } from '../budget-logic.js';
import { formatMoney, monthLabel, currentMonth, shiftMonth, escapeHtml } from '../format.js';
import { openCategoryModal } from '../category-form.js';
import { toast } from '../ui.js';

let state = { month: currentMonth() };

export async function render(root) {
  const currency = await DB.getSetting('currency', 'SAR');
  const summary = await getMonthSummary(state.month);

  const groups = groupRows(summary.rows);
  const tbb = summary.toBeBudgeted;
  const tbbClass = tbb < 0 ? 'negative' : tbb === 0 ? 'zero' : 'positive';

  root.innerHTML = `
    <div class="view-header">
      <div class="month-switcher">
        <button type="button" class="icon-btn" data-action="prev-month" aria-label="Previous month">‹</button>
        <h2>Budget — ${monthLabel(state.month)}</h2>
        <button type="button" class="icon-btn" data-action="next-month" aria-label="Next month">›</button>
      </div>
      <div class="header-actions">
        <button type="button" class="btn btn-ghost" data-action="fill-targets">Fill from targets</button>
        <button type="button" class="btn btn-primary" data-action="add-category">+ Category</button>
      </div>
    </div>

    <div class="tbb-card tbb-${tbbClass} tbb-compact">
      <div class="tbb-label">To Be Budgeted</div>
      <div class="tbb-amount">${formatMoney(tbb, currency)}</div>
    </div>

    ${Object.entries(groups).length ? Object.entries(groups).map(([group, rows]) => groupSection(group, rows, currency)).join('') : `<p class="empty-hint">No categories yet — add one to start budgeting.</p>`}
  `;

  root.querySelector('[data-action="prev-month"]').addEventListener('click', () => {
    state.month = shiftMonth(state.month, -1);
    render(root);
  });
  root.querySelector('[data-action="next-month"]').addEventListener('click', () => {
    state.month = shiftMonth(state.month, 1);
    render(root);
  });
  root.querySelector('[data-action="add-category"]').addEventListener('click', () => {
    openCategoryModal({ onSaved: () => render(root) });
  });
  root.querySelector('[data-action="fill-targets"]').addEventListener('click', async () => {
    const categories = await DB.listCategories();
    for (const c of categories) {
      if (c.monthlyTarget > 0) {
        await DB.setAllocation(state.month, c.id, c.monthlyTarget);
      }
    }
    toast('Allocations filled from each category’s default target.', { type: 'success' });
    render(root);
  });

  root.querySelectorAll('[data-edit-category]').forEach((el) => {
    el.addEventListener('click', async () => {
      const id = Number(el.dataset.editCategory);
      const cats = await DB.listCategories();
      const cat = cats.find((c) => c.id === id);
      if (cat) openCategoryModal({ category: cat, onSaved: () => render(root) });
    });
  });

  root.querySelectorAll('[data-allocate-input]').forEach((input) => {
    input.addEventListener('change', async () => {
      const categoryId = Number(input.dataset.allocateInput);
      const amount = parseFloat(input.value) || 0;
      await DB.setAllocation(state.month, categoryId, amount);
      render(root);
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
