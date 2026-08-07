import { DB } from '../db.js';
import { openAccountModal } from '../account-form.js';
import { toast, confirmDialog } from '../ui.js';
import { escapeHtml } from '../format.js';

export async function render(root) {
  const currency = await DB.getSetting('currency', 'SAR');
  const accounts = await DB.listAccounts({ includeArchived: true });

  root.innerHTML = `
    <div class="view-header"><h2>Settings</h2></div>

    <section class="panel">
      <div class="panel-header">
        <h3>Accounts</h3>
        <button type="button" class="btn btn-ghost" data-action="add-account">+ Add account</button>
      </div>
      <div class="account-list">
        ${accounts.map((a) => `
          <div class="account-row">
            <div>
              <button type="button" class="category-name-btn" data-edit-account="${a.id}">${escapeHtml(a.name)}</button>
              <div class="muted small">${a.type}</div>
            </div>
          </div>
        `).join('') || '<p class="empty-hint">No accounts yet.</p>'}
      </div>
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Currency</h3></div>
      <label class="field">
        <span>Displayed currency code</span>
        <input type="text" id="currency-input" value="${escapeHtml(currency)}" maxlength="6" style="max-width:120px" />
      </label>
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Backup & restore</h3></div>
      <p class="field-hint">
        Your data lives only in this browser, on this device — nothing is uploaded anywhere.
        To move it to another device (or just keep a safety copy), export a backup file and
        import it on the other device. Do this after big updates, and before clearing browser data.
      </p>
      <div class="settings-actions">
        <button type="button" class="btn btn-primary" data-action="export">Export backup (.json)</button>
        <label class="btn btn-ghost file-btn">
          Import backup
          <input type="file" id="import-input" accept="application/json" hidden />
        </label>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header"><h3>Danger zone</h3></div>
      <p class="field-hint">Permanently deletes every account, transaction, category, and balance snapshot on this device. Export a backup first if you might want this data again.</p>
      <button type="button" class="btn btn-danger" data-action="wipe">Erase all data</button>
    </section>
  `;

  root.querySelector('[data-action="add-account"]').addEventListener('click', () => {
    openAccountModal({ onSaved: () => render(root) });
  });
  root.querySelectorAll('[data-edit-account]').forEach((el) => {
    el.addEventListener('click', async () => {
      const id = Number(el.dataset.editAccount);
      const a = accounts.find((x) => x.id === id);
      if (a) openAccountModal({ account: a, onSaved: () => render(root) });
    });
  });

  root.querySelector('#currency-input').addEventListener('change', async (e) => {
    const value = e.target.value.trim().toUpperCase() || 'SAR';
    await DB.setSetting('currency', value);
    toast('Currency updated', { type: 'success' });
  });

  root.querySelector('[data-action="export"]').addEventListener('click', async () => {
    const data = await DB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `mizan-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('Backup downloaded', { type: 'success' });
  });

  root.querySelector('#import-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const ok = await confirmDialog('Importing replaces everything currently on this device with the contents of the backup file. This cannot be undone.', { confirmLabel: 'Import & replace' });
    if (!ok) {
      e.target.value = '';
      return;
    }
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await DB.importAll(data);
      toast('Backup restored', { type: 'success' });
      render(root);
    } catch (err) {
      toast('That file could not be read as a Mizan backup.', { type: 'error' });
    }
    e.target.value = '';
  });

  root.querySelector('[data-action="wipe"]').addEventListener('click', async () => {
    const ok = await confirmDialog('This erases every account, transaction, category, and balance on this device permanently.', { confirmLabel: 'Erase everything' });
    if (!ok) return;
    await DB.wipeAll();
    toast('All data erased', { type: 'success' });
    render(root);
  });
}
