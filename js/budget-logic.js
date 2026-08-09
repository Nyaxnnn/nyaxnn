// Zero-based envelope budgeting math, shared by the dashboard, budget, and
// insights views. Kept in one place so the rules stay consistent everywhere.

import { DB, monthOf } from './db.js';
import { shiftMonth } from './format.js';

// Computes, for a single category, allocated/spent/available for `month`,
// with unspent (or overspent) amounts rolling forward from prior months.
// allocByMonth / spentByMonth are pre-built maps: Map<month, Map<categoryId, amount>>.
export function categoryAvailable(categoryId, month, allocByMonth, spentByMonth) {
  const allMonths = new Set([...allocByMonth.keys(), ...spentByMonth.keys()]);
  const monthsUpTo = Array.from(allMonths).filter((m) => m <= month).sort();
  let available = 0;
  let allocatedThis = 0;
  let spentThis = 0;
  for (const m of monthsUpTo) {
    const allocated = allocByMonth.get(m)?.get(categoryId) || 0;
    const spent = spentByMonth.get(m)?.get(categoryId) || 0;
    available = available + allocated - spent;
    if (m === month) {
      allocatedThis = allocated;
      spentThis = spent;
    }
  }
  return { allocated: allocatedThis, spent: spentThis, available };
}

// Builds the full picture for one month: income, allocations, per-category
// spent/available (with rollover), and the "To Be Budgeted" pool.
export async function getMonthSummary(month) {
  const [categories, allTransactions, allocRows] = await Promise.all([
    DB.listCategories(),
    DB.listTransactions(),
    DB.listAllAllocations(),
  ]);

  const allocByMonth = new Map();
  for (const row of allocRows) {
    if (!allocByMonth.has(row.month)) allocByMonth.set(row.month, new Map());
    allocByMonth.get(row.month).set(row.categoryId, row.amount);
  }

  const spentByMonth = new Map();
  let incomeThisMonth = 0;
  for (const t of allTransactions) {
    if (t.type === 'expense' && t.categoryId != null) {
      if (!spentByMonth.has(t.month)) spentByMonth.set(t.month, new Map());
      const m = spentByMonth.get(t.month);
      m.set(t.categoryId, (m.get(t.categoryId) || 0) + Math.abs(t.amount));
    }
    if (t.type === 'income' && t.month === month) {
      incomeThisMonth += Math.abs(t.amount);
    }
  }

  const rows = [];
  let allocatedTotal = 0;
  let spentTotal = 0;
  let availableTotal = 0;
  for (const cat of categories) {
    const { allocated, spent, available } = categoryAvailable(cat.id, month, allocByMonth, spentByMonth);
    rows.push({ category: cat, allocated, spent, available });
    allocatedTotal += allocated;
    spentTotal += spent;
    availableTotal += available;
  }

  // "To Be Budgeted" = all income ever recorded minus all allocations ever made,
  // up to and including this month (classic zero-based budgeting pool).
  let incomeCumulative = 0;
  let allocatedCumulative = 0;
  for (const t of allTransactions) {
    if (t.type === 'income' && t.month <= month) incomeCumulative += Math.abs(t.amount);
  }
  for (const row of allocRows) {
    if (row.month <= month) allocatedCumulative += row.amount;
  }
  const toBeBudgeted = incomeCumulative - allocatedCumulative;

  return {
    month,
    income: incomeThisMonth,
    allocatedTotal,
    spentTotal,
    availableTotal,
    toBeBudgeted,
    rows,
  };
}

export async function spendingByCategory(month) {
  const summary = await getMonthSummary(month);
  return summary.rows
    .filter((r) => r.spent > 0)
    .map((r) => ({ label: r.category.name, value: r.spent, color: r.category.color }))
    .sort((a, b) => b.value - a.value);
}

const GROUP_ORDER = ['Needs', 'Wants', 'Savings', 'Investing'];
const GROUP_COLORS = {
  Needs: '#3b82f6',
  Wants: '#f59e0b',
  Savings: '#10b981',
  Investing: '#8b5cf6',
};

export async function spendingByGroup(month) {
  const summary = await getMonthSummary(month);
  const totals = new Map();
  for (const row of summary.rows) {
    const group = row.category.group || 'Other';
    totals.set(group, (totals.get(group) || 0) + row.spent);
  }
  return Array.from(totals.entries())
    .filter(([, value]) => value > 0)
    .sort((a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]))
    .map(([label, value]) => ({ label, value, color: GROUP_COLORS[label] || '#64748b' }));
}

export async function incomeExpenseTrend(monthsBack = 6, endMonth) {
  const end = endMonth || monthOf(new Date().toISOString());
  const months = [];
  let m = end;
  for (let i = 0; i < monthsBack; i++) {
    months.unshift(m);
    m = shiftMonth(m, -1);
  }
  const allTx = await DB.listTransactions();
  return months.map((month) => {
    let income = 0;
    let expense = 0;
    for (const t of allTx) {
      if (t.month !== month) continue;
      if (t.type === 'income') income += Math.abs(t.amount);
      if (t.type === 'expense') expense += Math.abs(t.amount);
    }
    return { month, income, expense, net: income - expense };
  });
}
