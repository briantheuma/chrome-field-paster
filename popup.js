'use strict';

const DEFAULT_FIELDS = [
  { id: 'f1', label: 'Portfolio URL', value: '' },
  { id: 'f2', label: 'LinkedIn URL', value: '' },
  { id: 'f3', label: 'Address', value: '' },
  { id: 'f4', label: 'Email', value: '' },
  { id: 'f5', label: 'Phone', value: '' },
];

let fields = [];
let editFields = [];
let isEditing = false;
let toastTimer = null;
let dragSrcId = null;

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// Storage
function loadFields() {
  chrome.storage.sync.get(['fields'], (result) => {
    fields = (result.fields && result.fields.length) ? result.fields : DEFAULT_FIELDS;
    renderViewMode();
  });
}

function saveFields(data) {
  chrome.storage.sync.set({ fields: data });
}

// Toast
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.remove('hidden');
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 220);
  }, 1400);
}

// View mode
function renderViewMode() {
  const list = document.getElementById('fields-list');
  const empty = document.getElementById('empty-state');
  list.innerHTML = '';

  if (!fields.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  fields.forEach((field) => {
    const item = document.createElement('div');
    const hasValue = field.value && field.value.trim();
    item.className = 'field-item' + (hasValue ? '' : ' empty-value');

    item.innerHTML =
      `<span class="field-label">${escapeHtml(field.label || 'Untitled')}</span>` +
      `<span class="field-value">${hasValue ? escapeHtml(field.value) : '<em>No value set</em>'}</span>` +
      `<span class="copy-badge">${'Copy'}</span>`;

    if (hasValue) {
      item.addEventListener('click', () => {
        navigator.clipboard.writeText(field.value).then(() => {
          item.classList.add('copied');
          item.querySelector('.copy-badge').textContent = 'Copied!';
          showToast(`Copied: ${field.label}`);
          setTimeout(() => {
            item.classList.remove('copied');
            item.querySelector('.copy-badge').textContent = 'Copy';
          }, 1500);
        }).catch(() => {
          // Fallback for edge cases
          const ta = document.createElement('textarea');
          ta.value = field.value;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          showToast(`Copied: ${field.label}`);
        });
      });
    }

    list.appendChild(item);
  });
}

// Edit mode
function enterEditMode() {
  editFields = fields.map((f) => ({ ...f }));
  renderEditMode();

  document.getElementById('view-mode').classList.add('hidden');
  document.getElementById('edit-mode').classList.remove('hidden');

  const btn = document.getElementById('edit-toggle');
  btn.classList.add('active');
  document.getElementById('edit-icon').classList.add('hidden');
  document.getElementById('cancel-icon').classList.remove('hidden');
  document.getElementById('edit-label').textContent = 'Cancel';

  isEditing = true;
}

function exitEditMode() {
  document.getElementById('view-mode').classList.remove('hidden');
  document.getElementById('edit-mode').classList.add('hidden');

  const btn = document.getElementById('edit-toggle');
  btn.classList.remove('active');
  document.getElementById('edit-icon').classList.remove('hidden');
  document.getElementById('cancel-icon').classList.add('hidden');
  document.getElementById('edit-label').textContent = 'Edit';

  isEditing = false;
}

function renderEditMode() {
  const list = document.getElementById('edit-fields-list');
  list.innerHTML = '';

  editFields.forEach((field) => {
    const row = document.createElement('div');
    row.className = 'edit-row';
    row.dataset.id = field.id;
    row.setAttribute('draggable', 'true');

    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.title = 'Drag to reorder';
    handle.innerHTML =
      `<svg viewBox="0 0 10 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">` +
      `<circle cx="3" cy="3.5" r="1.5"/><circle cx="7" cy="3.5" r="1.5"/>` +
      `<circle cx="3" cy="8" r="1.5"/><circle cx="7" cy="8" r="1.5"/>` +
      `<circle cx="3" cy="12.5" r="1.5"/><circle cx="7" cy="12.5" r="1.5"/>` +
      `</svg>`;

    const inputs = document.createElement('div');
    inputs.className = 'edit-inputs';

    const labelInput = document.createElement('input');
    labelInput.className = 'input-label';
    labelInput.type = 'text';
    labelInput.placeholder = 'Field name';
    labelInput.value = field.label;
    labelInput.setAttribute('autocomplete', 'off');
    labelInput.setAttribute('spellcheck', 'false');

    const valueInput = document.createElement('input');
    valueInput.className = 'input-value';
    valueInput.type = 'text';
    valueInput.placeholder = 'Value';
    valueInput.value = field.value;
    valueInput.setAttribute('autocomplete', 'off');
    valueInput.setAttribute('spellcheck', 'false');

    inputs.appendChild(labelInput);
    inputs.appendChild(valueInput);

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-delete';
    delBtn.title = 'Remove field';
    delBtn.textContent = '×';
    delBtn.addEventListener('click', () => {
      editFields = editFields.filter((f) => f.id !== field.id);
      renderEditMode();
    });

    row.appendChild(handle);
    row.appendChild(inputs);
    row.appendChild(delBtn);

    addDragListeners(row);
    list.appendChild(row);
  });
}

function clearDropIndicators() {
  document.querySelectorAll('.edit-row').forEach((r) => {
    r.classList.remove('drag-over-top', 'drag-over-bottom');
  });
}

function addDragListeners(row) {
  row.addEventListener('dragstart', (e) => {
    // Only allow drag initiated from the handle
    if (!e.target.closest('.drag-handle')) {
      e.preventDefault();
      return;
    }
    dragSrcId = row.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragSrcId);
    setTimeout(() => row.classList.add('dragging'), 0);
  });

  row.addEventListener('dragend', () => {
    row.classList.remove('dragging');
    clearDropIndicators();
  });

  row.addEventListener('dragover', (e) => {
    if (!dragSrcId || row.dataset.id === dragSrcId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    clearDropIndicators();
    const midY = row.getBoundingClientRect().top + row.offsetHeight / 2;
    row.classList.add(e.clientY < midY ? 'drag-over-top' : 'drag-over-bottom');
  });

  row.addEventListener('dragleave', (e) => {
    if (!row.contains(e.relatedTarget)) {
      row.classList.remove('drag-over-top', 'drag-over-bottom');
    }
  });

  row.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!dragSrcId || row.dataset.id === dragSrcId) return;

    const srcIdx = editFields.findIndex((f) => f.id === dragSrcId);
    const dstIdx = editFields.findIndex((f) => f.id === row.dataset.id);
    const midY = row.getBoundingClientRect().top + row.offsetHeight / 2;
    const insertBefore = e.clientY < midY;

    const [moved] = editFields.splice(srcIdx, 1);
    const newDst = editFields.findIndex((f) => f.id === row.dataset.id);
    editFields.splice(insertBefore ? newDst : newDst + 1, 0, moved);

    renderEditMode();
  });
}

function collectEditFields() {
  return Array.from(document.querySelectorAll('.edit-row')).map((row) => ({
    id: row.dataset.id,
    label: row.querySelector('.input-label').value,
    value: row.querySelector('.input-value').value,
  })).filter((f) => f.label.trim() || f.value.trim());
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  loadFields();

  document.getElementById('edit-toggle').addEventListener('click', () => {
    if (isEditing) {
      exitEditMode();
      renderViewMode();
    } else {
      enterEditMode();
    }
  });

  document.getElementById('add-field').addEventListener('click', () => {
    editFields.push({ id: uid(), label: '', value: '' });
    renderEditMode();
    const rows = document.querySelectorAll('.edit-row');
    const last = rows[rows.length - 1];
    if (last) last.querySelector('.input-label').focus();
  });

  document.getElementById('save-btn').addEventListener('click', () => {
    fields = collectEditFields();
    saveFields(fields);
    renderViewMode();
    exitEditMode();
    showToast('Fields saved');
  });

  document.getElementById('cancel-btn').addEventListener('click', () => {
    exitEditMode();
    renderViewMode();
  });
});
