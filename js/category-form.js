import { DB } from './db.js';
import { openModal, toast, confirmDialog } from './ui.js';
import { escapeHtml } from './format.js';
import { colorFor } from './charts.js';

const GROUPS = ['Needs', 'Wants', 'Savings', 'Investing'];

export async function openCategoryModal({ category = null, onSaved } = {}) {
  const isEdit = !!category;
  const existing = await DB.listCategories();
  const c = category || {
    name: '',
    group: 'Needs',
    monthlyTarget: '',
    color: colorFor(existing.length),
    sortOrder: existing.length,
  };

  const bodyHtml = `
    <form id="cat-form" class="form">
      <label class="field">
        <span>Name</span>
        <input type="text" name="name" required value="${escapeHtml(c.name)}" placeholder="e.g. Groceries" />
      </label>
      <label class="field">
        <span>Group</span>
        <select name="group">
          ${GROUPS.map((g) => `<option value="${g}" ${g === c.group ? 'selected' : ''}>${g}</option>`).join('')}
        </select>
      </label>
      <label class="field">
        <span>Default monthly target (SAR)</span>
        <input type="number" step="0.01" min="0" name="monthlyTarget" value="${c.monthlyTarget}" placeholder="0.00" />
      </label>
      <label class="field">
        <span>Color</span>
        <input type="color" name="color" value="${c.color}" />
      </label>
    </form>
  `;

  const footerHtml = `
    ${isEdit ? '<button type="button" class="btn btn-danger" data-action="delete">Delete</button>' : '<span></span>'}
    <button type="button" class="btn btn-primary" data-action="save">${isEdit ? 'Save changes' : 'Add category'}</button>
  `;

  openModal({
    title: isEdit ? 'Edit category' : 'New category',
    bodyHtml,
    footerHtml,
    onMount: (overlay, close) => {
      overlay.querySelector('[data-action="save"]').addEventListener('click', async () => {
        const fd = new FormData(overlay.querySelector('#cat-form'));
        const name = (fd.get('name') || '').trim();
        if (!name) {
          toast('Give the category a name.', { type: 'error' });
          return;
        }
        const record = {
          ...(isEdit ? { id: c.id, sortOrder: c.sortOrder, archived: c.archived } : { sortOrder: existing.length }),
          name,
          group: fd.get('group'),
          monthlyTarget: parseFloat(fd.get('monthlyTarget')) || 0,
          color: fd.get('color'),
        };
        await DB.saveCategory(record);
        toast(isEdit ? 'Category updated' : 'Category added', { type: 'success' });
        close();
        if (onSaved) onSaved();
      });

      if (isEdit) {
        overlay.querySelector('[data-action="delete"]').addEventListener('click', async () => {
          const ok = await confirmDialog('This removes the category. Existing transactions keep referencing it, but it will disappear from budgeting.');
          if (!ok) return;
          await DB.deleteCategory(c.id);
          toast('Category deleted', { type: 'success' });
          close();
          if (onSaved) onSaved();
        });
      }
    },
  });
}
