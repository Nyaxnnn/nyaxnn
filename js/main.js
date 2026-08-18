import { DB } from './db.js';
import { registerRoute, startRouter } from './router.js';
import { generateDueTransactions } from './subscription-logic.js';
import { toast } from './ui.js';
import * as home from './views/dashboard.js';
import * as transactions from './views/transactions.js';
import * as budget from './views/budget.js';
import * as insights from './views/insights.js';
import * as networth from './views/networth.js';
import * as settings from './views/settings.js';

const DEFAULT_CATEGORIES = [
  { name: 'Rent / Mortgage', group: 'Needs', monthlyTarget: 0 },
  { name: 'Groceries', group: 'Needs', monthlyTarget: 0 },
  { name: 'Transport', group: 'Needs', monthlyTarget: 0 },
  { name: 'Utilities & Phone', group: 'Needs', monthlyTarget: 0 },
  { name: 'Dining Out', group: 'Wants', monthlyTarget: 0 },
  { name: 'Entertainment', group: 'Wants', monthlyTarget: 0 },
  { name: 'Emergency Fund', group: 'Savings', monthlyTarget: 0 },
  { name: 'Investing', group: 'Investing', monthlyTarget: 0 },
];

const PALETTE = ['#15803d', '#2563eb', '#f59e0b', '#dc2626', '#8b5cf6', '#0891b2', '#db2777', '#65a30d'];

async function seedIfEmpty() {
  const categories = await DB.listCategories();
  if (categories.length > 0) return;
  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    await DB.saveCategory({ ...DEFAULT_CATEGORIES[i], color: PALETTE[i % PALETTE.length], sortOrder: i });
  }
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./service-worker.js');
    } catch (err) {
      console.warn('Service worker registration failed:', err);
    }
  }
}

function highlightNav(path) {
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.path === path);
  });
}

async function main() {
  registerRoute('/', home.render);
  registerRoute('/transactions', transactions.render);
  registerRoute('/budget', budget.render);
  registerRoute('/insights', insights.render);
  registerRoute('/networth', networth.render);
  registerRoute('/settings', settings.render);

  await seedIfEmpty();

  const generated = await generateDueTransactions();
  if (generated.length) {
    const total = generated.reduce((sum, g) => sum + g.count, 0);
    const label = generated.length === 1
      ? generated[0].subscription.name
      : `${generated.length} subscriptions`;
    toast(`${label} — ${total} due charge${total > 1 ? 's' : ''} added automatically`, { type: 'success' });
  }

  const root = document.getElementById('app-view');
  await startRouter(root, highlightNav);

  registerServiceWorker();
}

main();
