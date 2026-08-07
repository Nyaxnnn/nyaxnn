import { DB } from './db.js';

// Live balance for a cash/bank account, derived from its starting balance
// plus every transaction that touched it. Savings/investment accounts don't
// use this — their balance is whatever the user last entered manually.
export function cashBalance(account, transactions) {
  let balance = account.startingBalance || 0;
  for (const t of transactions) {
    if (t.type === 'income' && t.accountId === account.id) balance += Math.abs(t.amount);
    else if (t.type === 'expense' && t.accountId === account.id) balance -= Math.abs(t.amount);
    else if (t.type === 'transfer') {
      if (t.accountId === account.id) balance -= Math.abs(t.amount);
      if (t.transferAccountId === account.id) balance += Math.abs(t.amount);
    }
  }
  return balance;
}

export function latestSnapshotBalance(accountId, snapshots, account) {
  const relevant = snapshots.filter((s) => s.accountId === accountId).sort((a, b) => (a.date < b.date ? 1 : -1));
  if (relevant.length) return relevant[0].balance;
  return account.startingBalance || 0;
}

// Today's total net worth plus a breakdown per account.
export async function getNetWorthToday() {
  const [accounts, transactions, snapshots] = await Promise.all([
    DB.listAccounts(),
    DB.listTransactions(),
    DB.listSnapshots(),
  ]);

  const breakdown = accounts.map((account) => {
    const balance = account.type === 'cash'
      ? cashBalance(account, transactions)
      : latestSnapshotBalance(account.id, snapshots, account);
    return { account, balance };
  });

  const cashTotal = breakdown.filter((b) => b.account.type === 'cash').reduce((s, b) => s + b.balance, 0);
  const trackedTotal = breakdown.filter((b) => b.account.type !== 'cash').reduce((s, b) => s + b.balance, 0);

  return {
    total: cashTotal + trackedTotal,
    cashTotal,
    trackedTotal,
    breakdown,
  };
}

// Time series of (cash total today, fixed) + (tracked accounts' balance as of
// each snapshot date, carried forward). Honest about only the tracked portion
// having real history.
export async function getTrackedNetWorthTrend() {
  const [accounts, snapshots] = await Promise.all([DB.listAccounts(), DB.listSnapshots()]);
  const trackedAccounts = accounts.filter((a) => a.type !== 'cash');
  if (!trackedAccounts.length) return [];

  const dates = Array.from(new Set(snapshots.map((s) => s.date))).sort();
  if (!dates.length) return [];

  return dates.map((date) => {
    let total = 0;
    for (const account of trackedAccounts) {
      const upToDate = snapshots
        .filter((s) => s.accountId === account.id && s.date <= date)
        .sort((a, b) => (a.date < b.date ? 1 : -1));
      total += upToDate.length ? upToDate[0].balance : (account.startingBalance || 0);
    }
    return { date, total };
  });
}
