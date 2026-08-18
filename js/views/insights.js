import { DB } from '../db.js';
import { spendingByCategory, incomeExpenseTrend, getMonthSummary } from '../budget-logic.js';
import { donutChart, lineChart, barChart } from '../charts.js';
import { formatMoney, formatDateShort, monthLabel, currentMonth, shiftMonth, escapeHtml } from '../format.js';
import { icon } from '../icons.js';

let state = { month: currentMonth(), drilldownOpen: false, checked: new Set() };

export async function render(root) {
  const currency = await DB.getSetting('currency', 'SAR');
  const [byCategory, trend, summary, monthTx] = await Promise.all([
    spendingByCategory(state.month),
    incomeExpenseTrend(6, state.month),
    getMonthSummary(state.month),
    DB.listTransactions({ month: state.month }),
  ]);

  const savingsRate = summary.income > 0 ? Math.round(((summary.income - summary.spentTotal) / summary.income) * 100) : null;

  root.innerHTML = `
    <div class="view-header">
      <div class="month-switcher">
        <button type="button" class="icon-btn" data-action="prev-month" aria-label="Previous month">${icon('chevronLeft')}</button>
        <h2>Insights — ${monthLabel(state.month)}</h2>
        <button type="button" class="icon-btn" data-action="next-month" aria-label="Next month">${icon('chevronRight')}</button>
      </div>
    </div>

    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-label">Spent this month</div>
        <div class="stat-value">${formatMoney(summary.spentTotal, currency)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Income this month</div>
        <div class="stat-value">${formatMoney(summary.income, currency)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Savings rate</div>
        <div class="stat-value">${savingsRate === null ? '—' : savingsRate + '%'}</div>
      </div>
    </div>

    <section class="panel">
      <div class="panel-header"><h3>Spending by category</h3></div>
      ${donutChart(byCategory, { currency })}
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Browse by category</h3></div>
      ${renderDrilldown(summary.rows, monthTx, currency)}
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Top categories</h3></div>
      ${barChart(byCategory.slice(0, 8), { currency })}
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Income vs. expenses — last 6 months</h3></div>
      ${lineChart(trend.map((t) => ({ x: monthLabel(t.month).split(' ')[0], y: t.income })), { currency, color: '#15803d' })}
      <div class="chart-caption">Income (green) — expenses below</div>
      ${lineChart(trend.map((t) => ({ x: monthLabel(t.month).split(' ')[0], y: t.expense })), { currency, color: '#dc2626' })}
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Net (income − expenses) trend</h3></div>
      ${lineChart(trend.map((t) => ({ x: monthLabel(t.month).split(' ')[0], y: t.net })), { currency, color: '#2563eb' })}
    </section>
  `;

  root.querySelector('[data-action="prev-month"]').addEventListener('click', () => {
    state.month = shiftMonth(state.month, -1);
    render(root);
  });
  root.querySelector('[data-action="next-month"]').addEventListener('click', () => {
    state.month = shiftMonth(state.month, 1);
    render(root);
  });

  const toggle = root.querySelector('[data-action="toggle-drilldown"]');
  toggle.addEventListener('click', () => {
    state.drilldownOpen = !state.drilldownOpen;
    render(root);
  });
  root.querySelectorAll('[data-toggle-cat]').forEach((item) => {
    const toggle = () => {
      const id = Number(item.dataset.toggleCat);
      if (state.checked.has(id)) state.checked.delete(id);
      else state.checked.add(id);
      render(root);
    };
    item.addEventListener('click', toggle);
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  });
}

function renderDrilldown(rows, monthTx, currency) {
  const checklist = rows
    .map((row) => `
      <li class="drilldown-item ${state.checked.has(row.category.id) ? 'checked' : ''}" data-toggle-cat="${row.category.id}" style="--item-color:${row.category.color || '#64748b'}" role="checkbox" aria-checked="${state.checked.has(row.category.id)}" aria-label="${escapeHtml(row.category.name)}" tabindex="0">
        <span class="drilldown-check">${icon('check')}</span>
        <span class="drilldown-item-label">
          <span class="dot" style="background:${row.category.color || '#64748b'}"></span>
          ${escapeHtml(row.category.name)}
        </span>
        <span class="drilldown-item-amt">${formatMoney(row.spent, currency)}</span>
      </li>
    `)
    .join('');

  const matches = state.checked.size
    ? monthTx
        .filter((t) => t.type === 'expense' && state.checked.has(t.categoryId))
        .sort((a, b) => (a.date < b.date ? 1 : -1))
    : [];

  const side = matches.length
    ? matches
        .map((t) => `
          <div class="drilldown-tx">
            <span class="drilldown-tx-name">${escapeHtml(t.payee || 'Expense')} · ${formatDateShort(t.date)}</span>
            <span class="drilldown-tx-amt">${formatMoney(t.amount, currency)}</span>
          </div>
        `)
        .join('')
    : `<div class="drilldown-side-empty">${state.checked.size ? 'No transactions for the selected categories this month.' : 'Check a category to see its transactions here.'}</div>`;

  return `
    <div class="drilldown">
      <button type="button" class="drilldown-toggle" aria-expanded="${state.drilldownOpen}" data-action="toggle-drilldown">
        <span>${state.checked.size ? `${state.checked.size} categor${state.checked.size > 1 ? 'ies' : 'y'} selected` : 'Select categories to see their transactions'}</span>
        ${icon('chevronDown')}
      </button>
      ${state.drilldownOpen ? `
        <div class="drilldown-body">
          <ul class="drilldown-checklist">${checklist}</ul>
          <div class="drilldown-side">${side}</div>
        </div>
      ` : ''}
    </div>
  `;
}
