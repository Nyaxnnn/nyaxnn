import { DB } from './db.js';
import { registerRoute, startRouter } from './router.js';
import * as dashboard from './views/dashboard.js';
import * as track from './views/track.js';
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

const PALETTE = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

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
    link.classList.toggle('active', link.getAttribute('href') === `#${path}`);
  });
}

async function main() {
  registerRoute('/', dashboard.render);
  registerRoute('/track', track.render);
  registerRoute('/transactions', transactions.render);
  registerRoute('/budget', budget.render);
  registerRoute('/insights', insights.render);
  registerRoute('/networth', networth.render);
  registerRoute('/settings', settings.render);

  await seedIfEmpty();

  const root = document.getElementById('app-view');
  await startRouter(root, highlightNav);

  document.getElementById('nav-toggle')?.addEventListener('click', () => {
    document.getElementById('nav')?.classList.toggle('open');
  });
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => document.getElementById('nav')?.classList.remove('open'));
  });

  registerServiceWorker();
}

main();
