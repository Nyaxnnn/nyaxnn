// Recurring subscriptions: monthly or yearly charges that generate a real
// expense transaction automatically once their due date has passed. Because
// this is a local-first app with no background process, "automatic" means
// "caught up the next time the app is opened" — every due occurrence since
// the last time it ran gets backfilled, none get skipped.

import { DB } from './db.js';
import { todayIso } from './format.js';

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function occurrenceDateForMonth(sub, year, month) {
  const day = Math.min(sub.day, daysInMonth(year, month));
  return `${year}-${pad(month)}-${pad(day)}`;
}

function occurrenceDateForYear(sub, year) {
  const day = Math.min(sub.day, daysInMonth(year, sub.month));
  return `${year}-${pad(sub.month)}-${pad(day)}`;
}

// Every due-but-not-yet-generated occurrence, oldest first.
function dueOccurrences(sub, today) {
  const start = sub.startDate || (sub.createdAt || today).slice(0, 10);
  const results = [];

  if (sub.cadence === 'yearly') {
    const startYear = Number(start.slice(0, 4));
    const fromYear = sub.lastGeneratedPeriod ? Number(sub.lastGeneratedPeriod) + 1 : startYear;
    const currentYear = Number(today.slice(0, 4));
    for (let year = fromYear; year <= currentYear; year++) {
      const date = occurrenceDateForYear(sub, year);
      if (date >= start && date <= today) results.push({ period: String(year), date });
    }
    return results;
  }

  let fromY, fromM;
  if (sub.lastGeneratedPeriod) {
    const [ly, lm] = sub.lastGeneratedPeriod.split('-').map(Number);
    fromY = lm >= 12 ? ly + 1 : ly;
    fromM = lm >= 12 ? 1 : lm + 1;
  } else {
    [fromY, fromM] = start.slice(0, 7).split('-').map(Number);
  }
  const [curY, curM] = today.slice(0, 7).split('-').map(Number);

  let y = fromY;
  let m = fromM;
  while (y < curY || (y === curY && m <= curM)) {
    const date = occurrenceDateForMonth(sub, y, m);
    if (date >= start && date <= today) results.push({ period: `${y}-${pad(m)}`, date });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return results;
}

// Runs on every app load. Generates one expense transaction per due
// occurrence per active subscription, tagged so it can be traced back and
// shown as "recurring" in the UI. Safe to call repeatedly — already-generated
// periods are never regenerated.
export async function generateDueTransactions() {
  const subs = await DB.listSubscriptions();
  const today = todayIso();
  const generated = [];

  for (const sub of subs) {
    const due = dueOccurrences(sub, today);
    if (!due.length) continue;

    for (const occ of due) {
      await DB.saveTransaction({
        date: occ.date,
        type: 'expense',
        accountId: sub.accountId,
        categoryId: sub.categoryId,
        amount: sub.amount,
        payee: sub.name,
        recurring: true,
        subscriptionId: sub.id,
      });
    }

    await DB.saveSubscription({ ...sub, lastGeneratedPeriod: due[due.length - 1].period });
    generated.push({ subscription: sub, count: due.length });
  }

  return generated;
}

export function nextDueDate(sub, fromDate) {
  const today = fromDate || todayIso();
  if (sub.cadence === 'yearly') {
    const year = Number(today.slice(0, 4));
    let date = occurrenceDateForYear(sub, year);
    if (date < today) date = occurrenceDateForYear(sub, year + 1);
    return date;
  }
  let [y, m] = today.slice(0, 7).split('-').map(Number);
  let date = occurrenceDateForMonth(sub, y, m);
  if (date < today) {
    m += 1;
    if (m > 12) { m = 1; y += 1; }
    date = occurrenceDateForMonth(sub, y, m);
  }
  return date;
}

export function monthlyEquivalent(sub) {
  return sub.cadence === 'yearly' ? sub.amount / 12 : sub.amount;
}

export function yearlyEquivalent(sub) {
  return sub.cadence === 'yearly' ? sub.amount : sub.amount * 12;
}
