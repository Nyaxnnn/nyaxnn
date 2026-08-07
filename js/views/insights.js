import { DB } from '../db.js';
import { spendingByCategory, incomeExpenseTrend, getMonthSummary } from '../budget-logic.js';
import { donutChart, lineChart, barChart } from '../charts.js';
import { formatMoney, monthLabel, currentMonth, shiftMonth } from '../format.js';

let state = { month: currentMonth() };

export async function render(root) {
  const currency = await DB.getSetting('currency', 'SAR');
  const [byCategory, trend, summary] = await Promise.all([
    spendingByCategory(state.month),
    incomeExpenseTrend(6, state.month),
    getMonthSummary(state.month),
  ]);

  const savingsRate = summary.income > 0 ? Math.round(((summary.income - summary.spentTotal) / summary.income) * 100) : null;

  root.innerHTML = `
    <div class="view-header">
      <div class="month-switcher">
        <button type="button" class="icon-btn" data-action="prev-month" aria-label="Previous month">‹</button>
        <h2>Insights — ${monthLabel(state.month)}</h2>
        <button type="button" class="icon-btn" data-action="next-month" aria-label="Next month">›</button>
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
      <div class="panel-header"><h3>Top categories</h3></div>
      ${barChart(byCategory.slice(0, 8), { currency })}
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Income vs. expenses — last 6 months</h3></div>
      ${lineChart(trend.map((t) => ({ x: monthLabel(t.month).split(' ')[0], y: t.income })), { currency, color: '#10b981' })}
      <div class="chart-caption">Income (green) — expenses below</div>
      ${lineChart(trend.map((t) => ({ x: monthLabel(t.month).split(' ')[0], y: t.expense })), { currency, color: '#ef4444' })}
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Net (income − expenses) trend</h3></div>
      ${lineChart(trend.map((t) => ({ x: monthLabel(t.month).split(' ')[0], y: t.net })), { currency, color: '#3b82f6' })}
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
}
