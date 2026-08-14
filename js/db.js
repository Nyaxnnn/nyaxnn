// IndexedDB data layer. All data stays on this device — nothing here ever
// makes a network request. See README.md for the backup/restore story.

const DB_NAME = 'mizan';
const DB_VERSION = 2;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains('accounts')) {
        const s = db.createObjectStore('accounts', { keyPath: 'id', autoIncrement: true });
        s.createIndex('archived', 'archived');
      }
      if (!db.objectStoreNames.contains('categories')) {
        const s = db.createObjectStore('categories', { keyPath: 'id', autoIncrement: true });
        s.createIndex('archived', 'archived');
        s.createIndex('group', 'group');
      }
      if (!db.objectStoreNames.contains('transactions')) {
        const s = db.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
        s.createIndex('date', 'date');
        s.createIndex('accountId', 'accountId');
        s.createIndex('categoryId', 'categoryId');
        s.createIndex('month', 'month'); // 'YYYY-MM' derived from date, for fast queries
      }
      if (!db.objectStoreNames.contains('budgetAllocations')) {
        const s = db.createObjectStore('budgetAllocations', { keyPath: 'id', autoIncrement: true });
        s.createIndex('month', 'month');
        s.createIndex('categoryId', 'categoryId');
        s.createIndex('month_category', ['month', 'categoryId'], { unique: true });
      }
      if (!db.objectStoreNames.contains('netWorthSnapshots')) {
        const s = db.createObjectStore('netWorthSnapshots', { keyPath: 'id', autoIncrement: true });
        s.createIndex('accountId', 'accountId');
        s.createIndex('date', 'date');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('subscriptions')) {
        const s = db.createObjectStore('subscriptions', { keyPath: 'id', autoIncrement: true });
        s.createIndex('active', 'active');
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeNames, mode = 'readonly') {
  return openDb().then((db) => db.transaction(storeNames, mode));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getAll(storeName, indexName, query) {
  const t = await tx(storeName);
  const store = indexName ? t.objectStore(storeName).index(indexName) : t.objectStore(storeName);
  const source = query !== undefined ? store.getAll(query) : store.getAll();
  return reqToPromise(source);
}

async function get(storeName, key) {
  const t = await tx(storeName);
  return reqToPromise(t.objectStore(storeName).get(key));
}

async function put(storeName, value) {
  const t = await tx(storeName, 'readwrite');
  const result = await reqToPromise(t.objectStore(storeName).put(value));
  return result;
}

async function del(storeName, key) {
  const t = await tx(storeName, 'readwrite');
  await reqToPromise(t.objectStore(storeName).delete(key));
}

async function clearStore(storeName) {
  const t = await tx(storeName, 'readwrite');
  await reqToPromise(t.objectStore(storeName).clear());
}

// ---- Domain helpers ----

function monthOf(dateStr) {
  return dateStr.slice(0, 7); // 'YYYY-MM'
}

export const DB = {
  // Accounts
  async listAccounts({ includeArchived = false } = {}) {
    const all = await getAll('accounts');
    return all.filter((a) => includeArchived || !a.archived).sort((a, b) => a.name.localeCompare(b.name));
  },
  async saveAccount(account) {
    if (!account.createdAt) account.createdAt = new Date().toISOString();
    return put('accounts', account);
  },
  async deleteAccount(id) {
    return del('accounts', id);
  },

  // Categories
  async listCategories({ includeArchived = false } = {}) {
    const all = await getAll('categories');
    return all
      .filter((c) => includeArchived || !c.archived)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
  },
  async saveCategory(category) {
    return put('categories', category);
  },
  async deleteCategory(id) {
    return del('categories', id);
  },

  // Transactions
  async listTransactions({ month, accountId, categoryId } = {}) {
    let all = await getAll('transactions');
    if (month) all = all.filter((t) => t.month === month);
    if (accountId) all = all.filter((t) => t.accountId === accountId);
    if (categoryId) all = all.filter((t) => t.categoryId === categoryId);
    return all.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.id - a.id)));
  },
  async saveTransaction(t) {
    t.month = monthOf(t.date);
    return put('transactions', t);
  },
  async deleteTransaction(id) {
    return del('transactions', id);
  },

  // Budget allocations (per month, per category)
  async listAllocations(month) {
    return getAll('budgetAllocations', 'month', month);
  },
  async listAllAllocations() {
    return getAll('budgetAllocations');
  },
  async setAllocation(month, categoryId, amount) {
    const existing = (await getAll('budgetAllocations', 'month', month)).find(
      (a) => a.categoryId === categoryId
    );
    const record = existing
      ? { ...existing, amount }
      : { month, categoryId, amount };
    return put('budgetAllocations', record);
  },

  // Net worth snapshots (manual balance entries for investment/savings accounts)
  async listSnapshots({ accountId } = {}) {
    let all = await getAll('netWorthSnapshots');
    if (accountId) all = all.filter((s) => s.accountId === accountId);
    return all.sort((a, b) => (a.date < b.date ? -1 : 1));
  },
  async saveSnapshot(snapshot) {
    return put('netWorthSnapshots', snapshot);
  },
  async deleteSnapshot(id) {
    return del('netWorthSnapshots', id);
  },

  // Recurring subscriptions
  async listSubscriptions({ includeInactive = false } = {}) {
    const all = await getAll('subscriptions');
    return all
      .filter((s) => includeInactive || s.active !== false)
      .sort((a, b) => a.name.localeCompare(b.name));
  },
  async listAllSubscriptions() {
    return getAll('subscriptions');
  },
  async saveSubscription(sub) {
    if (!sub.createdAt) sub.createdAt = new Date().toISOString();
    return put('subscriptions', sub);
  },
  async deleteSubscription(id) {
    return del('subscriptions', id);
  },

  // Settings
  async getSetting(key, fallback) {
    const row = await get('settings', key);
    return row ? row.value : fallback;
  },
  async setSetting(key, value) {
    return put('settings', { key, value });
  },

  // Backup / restore — the whole privacy story hinges on this working reliably.
  async exportAll() {
    const [accounts, categories, transactions, budgetAllocations, netWorthSnapshots, subscriptions, settingsRows] =
      await Promise.all([
        getAll('accounts'),
        getAll('categories'),
        getAll('transactions'),
        getAll('budgetAllocations'),
        getAll('netWorthSnapshots'),
        getAll('subscriptions'),
        getAll('settings'),
      ]);
    return {
      exportedAt: new Date().toISOString(),
      version: DB_VERSION,
      accounts,
      categories,
      transactions,
      budgetAllocations,
      netWorthSnapshots,
      subscriptions,
      settings: settingsRows,
    };
  },
  async importAll(data) {
    const stores = ['accounts', 'categories', 'transactions', 'budgetAllocations', 'netWorthSnapshots', 'subscriptions', 'settings'];
    for (const name of stores) {
      await clearStore(name);
    }
    const db = await openDb();
    const t = db.transaction(stores, 'readwrite');
    for (const name of stores) {
      const rows = data[name] || [];
      const store = t.objectStore(name);
      for (const row of rows) store.put(row);
    }
    await new Promise((resolve, reject) => {
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
    });
  },
  async wipeAll() {
    const stores = ['accounts', 'categories', 'transactions', 'budgetAllocations', 'netWorthSnapshots', 'subscriptions', 'settings'];
    for (const name of stores) await clearStore(name);
  },
};

export { monthOf };
