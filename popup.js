'use strict';

let fields = [];
let editFields = [];
let isEditing = false;
let toastTimer = null;
let dragSrcId = null;
let dragFromHandle = false;
const unlockedGroups = new Set();

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// --- Storage ---
function loadFields() {
  chrome.storage.sync.get(['fields'], (result) => {
    fields = (result.fields || []).map(f => ({ type: 'field', ...f }));
    renderViewMode();
  });
}

function saveFields(data) {
  chrome.storage.sync.set({ fields: data });
}

// --- Toast ---
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

// --- Crypto ---
async function hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- View mode ---
function isGroupHidden(item) {
  if (item.protected && !unlockedGroups.has(item.id)) return true;
  return !!item.collapsed;
}

function renderViewMode() {
  const list = document.getElementById('fields-list');
  const empty = document.getElementById('empty-state');
  list.innerHTML = '';

  if (!fields.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  let hideContent = false;

  fields.forEach(item => {
    const type = item.type || 'field';

    if (type === 'group') {
      hideContent = isGroupHidden(item);
      list.appendChild(buildGroupHeader(item));
    } else if (type === 'divider') {
      if (!hideContent) {
        const hr = document.createElement('div');
        hr.className = 'view-divider';
        list.appendChild(hr);
      }
    } else {
      if (!hideContent) list.appendChild(buildFieldItem(item));
    }
  });
}

function buildGroupHeader(item) {
  const hidden = isGroupHidden(item);
  const locked = item.protected && !unlockedGroups.has(item.id);

  const el = document.createElement('div');
  el.className = 'group-header' + (hidden ? ' collapsed' : '');
  el.dataset.id = item.id;

  el.innerHTML =
    `<svg class="chevron" viewBox="0 0 12 12" fill="none">` +
    `<path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>` +
    `<span class="group-label-text">${escapeHtml(item.label || 'Group')}</span>` +
    (item.protected
      ? `<svg class="lock-icon" viewBox="0 0 14 16" fill="none">` +
        `<rect x="2" y="7" width="10" height="8" rx="1.5" stroke="currentColor" stroke-width="1.3"/>` +
        `<path d="M4.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>` +
        `</svg>`
      : '');

  el.addEventListener('click', () => {
    if (locked) {
      togglePinPrompt(item, el);
    } else {
      item.collapsed = !item.collapsed;
      saveFields(fields);
      renderViewMode();
    }
  });

  return el;
}

function togglePinPrompt(item, headerEl) {
  const existing = document.querySelector('.pin-prompt');
  if (existing) {
    const sameGroup = existing.dataset.groupId === item.id;
    existing.remove();
    if (sameGroup) return;
  }

  const prompt = document.createElement('div');
  prompt.className = 'pin-prompt';
  prompt.dataset.groupId = item.id;
  prompt.innerHTML =
    `<input type="password" class="pin-input" placeholder="Enter PIN" maxlength="32" autocomplete="off">` +
    `<button class="btn-pin-unlock">Unlock</button>` +
    `<span class="pin-error hidden">Wrong PIN</span>`;

  headerEl.insertAdjacentElement('afterend', prompt);
  prompt.querySelector('.pin-input').focus();

  const tryUnlock = async () => {
    const pin = prompt.querySelector('.pin-input').value;
    if (!pin) return;
    const hash = await hashPin(pin);
    if (hash === item.passwordHash) {
      unlockedGroups.add(item.id);
      item.collapsed = false;
      saveFields(fields);
      renderViewMode();
    } else {
      const errEl = prompt.querySelector('.pin-error');
      errEl.classList.remove('hidden');
      prompt.querySelector('.pin-input').value = '';
      prompt.querySelector('.pin-input').focus();
      setTimeout(() => errEl.classList.add('hidden'), 2000);
    }
  };

  prompt.querySelector('.btn-pin-unlock').addEventListener('click', tryUnlock);
  prompt.querySelector('.pin-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') tryUnlock();
    if (e.key === 'Escape') prompt.remove();
  });
}

function buildFieldItem(item) {
  const hasValue = item.value && item.value.trim();
  const el = document.createElement('div');
  el.className = 'field-item' + (hasValue ? '' : ' empty-value');

  el.innerHTML =
    `<span class="field-label">${escapeHtml(item.label || 'Untitled')}</span>` +
    `<span class="field-value">${hasValue ? escapeHtml(item.value) : '<em>No value set</em>'}</span>` +
    `<span class="copy-badge">Copy</span>`;

  if (hasValue) {
    el.addEventListener('click', () => {
      navigator.clipboard.writeText(item.value).then(() => {
        el.classList.add('copied');
        el.querySelector('.copy-badge').textContent = 'Copied!';
        showToast(`Copied: ${item.label}`);
        setTimeout(() => {
          el.classList.remove('copied');
          el.querySelector('.copy-badge').textContent = 'Copy';
        }, 1500);
      }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = item.value;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast(`Copied: ${item.label}`);
      });
    });
  }

  return el;
}

// --- Edit mode ---
function enterEditMode() {
  editFields = fields.map(f => ({ ...f }));
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
  editFields.forEach(item => {
    const type = item.type || 'field';
    const row = type === 'group'   ? buildGroupEditRow(item)
              : type === 'divider' ? buildDividerEditRow(item)
              :                      buildFieldEditRow(item);
    addDragListeners(row);
    list.appendChild(row);
  });
}

function makeDragHandle() {
  const h = document.createElement('div');
  h.className = 'drag-handle';
  h.title = 'Drag to reorder';
  h.innerHTML =
    `<svg viewBox="0 0 10 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">` +
    `<circle cx="3" cy="3.5" r="1.5"/><circle cx="7" cy="3.5" r="1.5"/>` +
    `<circle cx="3" cy="8" r="1.5"/><circle cx="7" cy="8" r="1.5"/>` +
    `<circle cx="3" cy="12.5" r="1.5"/><circle cx="7" cy="12.5" r="1.5"/>` +
    `</svg>`;
  h.addEventListener('mousedown', () => { dragFromHandle = true; });
  return h;
}

function makeDeleteBtn(onClick) {
  const btn = document.createElement('button');
  btn.className = 'btn-delete';
  btn.type = 'button';
  btn.title = 'Remove';
  btn.textContent = '×';
  btn.addEventListener('click', onClick);
  return btn;
}

function buildFieldEditRow(item) {
  const row = document.createElement('div');
  row.className = 'edit-row';
  row.dataset.id = item.id;
  row.setAttribute('draggable', 'true');

  const inputs = document.createElement('div');
  inputs.className = 'edit-inputs';

  const labelInput = document.createElement('input');
  labelInput.className = 'input-label';
  labelInput.type = 'text';
  labelInput.placeholder = 'Field name';
  labelInput.value = item.label || '';
  labelInput.setAttribute('autocomplete', 'off');
  labelInput.setAttribute('spellcheck', 'false');

  const valueInput = document.createElement('input');
  valueInput.className = 'input-value';
  valueInput.type = 'text';
  valueInput.placeholder = 'Value';
  valueInput.value = item.value || '';
  valueInput.setAttribute('autocomplete', 'off');
  valueInput.setAttribute('spellcheck', 'false');

  inputs.appendChild(labelInput);
  inputs.appendChild(valueInput);

  row.appendChild(makeDragHandle());
  row.appendChild(inputs);
  row.appendChild(makeDeleteBtn(() => {
    editFields = editFields.filter(f => f.id !== item.id);
    renderEditMode();
  }));
  return row;
}

function buildGroupEditRow(item) {
  const row = document.createElement('div');
  row.className = 'edit-row edit-row--group';
  row.dataset.id = item.id;
  row.setAttribute('draggable', 'true');

  const content = document.createElement('div');
  content.className = 'group-edit-content';

  const mainRow = document.createElement('div');
  mainRow.className = 'group-edit-main';

  const chip = document.createElement('span');
  chip.className = 'group-chip';
  chip.textContent = 'Group';

  const labelInput = document.createElement('input');
  labelInput.className = 'input-group-label';
  labelInput.type = 'text';
  labelInput.placeholder = 'Group name';
  labelInput.value = item.label || '';
  labelInput.setAttribute('autocomplete', 'off');
  labelInput.setAttribute('spellcheck', 'false');

  const lockBtn = document.createElement('button');
  lockBtn.className = 'btn-lock-toggle' + (item.protected ? ' active' : '');
  lockBtn.type = 'button';
  lockBtn.title = item.protected ? 'Remove PIN protection' : 'Add PIN protection';
  lockBtn.innerHTML =
    `<svg viewBox="0 0 14 16" fill="none">` +
    `<rect x="2" y="7" width="10" height="8" rx="1.5" stroke="currentColor" stroke-width="1.3"/>` +
    `<path d="M4.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>` +
    `</svg>`;

  mainRow.appendChild(chip);
  mainRow.appendChild(labelInput);
  mainRow.appendChild(lockBtn);
  content.appendChild(mainRow);

  let pinSection = null;

  function buildPinSection() {
    pinSection = document.createElement('div');
    pinSection.className = 'group-pin-setup';

    const pinInput = document.createElement('input');
    pinInput.type = 'password';
    pinInput.className = 'input-pin';
    pinInput.placeholder = item.passwordHash ? 'New PIN (blank = keep)' : 'Set a PIN';
    pinInput.maxLength = 32;
    pinInput.setAttribute('autocomplete', 'new-password');

    const setBtn = document.createElement('button');
    setBtn.type = 'button';
    setBtn.className = 'btn-set-pin';
    setBtn.textContent = 'Set';

    const confirm = async () => {
      const pin = pinInput.value.trim();
      if (!pin) return;
      item.passwordHash = await hashPin(pin);
      pinInput.value = '';
      pinInput.placeholder = 'New PIN (blank = keep)';
      showToast('PIN updated');
    };

    setBtn.addEventListener('click', confirm);
    pinInput.addEventListener('keydown', e => { if (e.key === 'Enter') confirm(); });

    pinSection.appendChild(pinInput);
    pinSection.appendChild(setBtn);
    content.appendChild(pinSection);
  }

  if (item.protected) buildPinSection();

  lockBtn.addEventListener('click', () => {
    item.protected = !item.protected;
    lockBtn.classList.toggle('active', item.protected);
    lockBtn.title = item.protected ? 'Remove PIN protection' : 'Add PIN protection';
    if (item.protected) {
      if (!pinSection) buildPinSection();
    } else {
      item.passwordHash = null;
      pinSection?.remove();
      pinSection = null;
    }
  });

  row.appendChild(makeDragHandle());
  row.appendChild(content);
  row.appendChild(makeDeleteBtn(() => {
    editFields = editFields.filter(f => f.id !== item.id);
    renderEditMode();
  }));
  return row;
}

function buildDividerEditRow(item) {
  const row = document.createElement('div');
  row.className = 'edit-row edit-row--divider';
  row.dataset.id = item.id;
  row.setAttribute('draggable', 'true');

  const label = document.createElement('div');
  label.className = 'divider-edit-label';
  label.textContent = '— Divider —';

  row.appendChild(makeDragHandle());
  row.appendChild(label);
  row.appendChild(makeDeleteBtn(() => {
    editFields = editFields.filter(f => f.id !== item.id);
    renderEditMode();
  }));
  return row;
}

function collectEditFields() {
  return Array.from(document.querySelectorAll('.edit-row')).map(row => {
    const id = row.dataset.id;
    const original = editFields.find(f => f.id === id);
    if (!original) return null;
    const type = original.type || 'field';

    if (type === 'group') {
      return { ...original, label: row.querySelector('.input-group-label')?.value ?? original.label };
    }
    if (type === 'divider') {
      return { id, type: 'divider' };
    }
    return {
      id,
      type: 'field',
      label: row.querySelector('.input-label')?.value || '',
      value: row.querySelector('.input-value')?.value || '',
    };
  })
  .filter(Boolean)
  .filter(f => f.type === 'group' || f.type === 'divider' || f.label?.trim() || f.value?.trim());
}

// --- Drag and drop ---
function clearDropIndicators() {
  document.querySelectorAll('.edit-row').forEach(r =>
    r.classList.remove('drag-over-top', 'drag-over-bottom')
  );
}

function addDragListeners(row) {
  row.addEventListener('dragstart', e => {
    if (!dragFromHandle) { e.preventDefault(); return; }
    dragFromHandle = false;
    dragSrcId = row.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragSrcId);
    setTimeout(() => row.classList.add('dragging'), 0);
  });

  row.addEventListener('dragend', () => {
    dragFromHandle = false;
    row.classList.remove('dragging');
    clearDropIndicators();
  });

  row.addEventListener('dragover', e => {
    if (!dragSrcId || row.dataset.id === dragSrcId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    clearDropIndicators();
    const midY = row.getBoundingClientRect().top + row.offsetHeight / 2;
    row.classList.add(e.clientY < midY ? 'drag-over-top' : 'drag-over-bottom');
  });

  row.addEventListener('dragleave', e => {
    if (!row.contains(e.relatedTarget))
      row.classList.remove('drag-over-top', 'drag-over-bottom');
  });

  row.addEventListener('drop', e => {
    e.preventDefault();
    if (!dragSrcId || row.dataset.id === dragSrcId) return;
    const srcIdx = editFields.findIndex(f => f.id === dragSrcId);
    const midY = row.getBoundingClientRect().top + row.offsetHeight / 2;
    const insertBefore = e.clientY < midY;
    const [moved] = editFields.splice(srcIdx, 1);
    const newDst = editFields.findIndex(f => f.id === row.dataset.id);
    editFields.splice(insertBefore ? newDst : newDst + 1, 0, moved);
    renderEditMode();
  });
}

// --- Export / Import ---
function exportFields() {
  const data = isEditing ? collectEditFields() : fields;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'field-paster.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Exported ${data.length} items`);
}

function importFields(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!Array.isArray(parsed)) throw new Error();
      const normalized = parsed.map(item => {
        const type = item.type || 'field';
        if (type === 'group') {
          return { id: item.id || uid(), type: 'group', label: String(item.label || ''), collapsed: !!item.collapsed, protected: !!item.protected, passwordHash: item.passwordHash || null };
        }
        if (type === 'divider') {
          return { id: item.id || uid(), type: 'divider' };
        }
        return { id: item.id || uid(), type: 'field', label: String(item.label || ''), value: String(item.value || '') };
      });
      if (isEditing) {
        editFields = normalized;
        renderEditMode();
      } else {
        fields = normalized;
        saveFields(fields);
        renderViewMode();
      }
      showToast(`Imported ${normalized.length} items`);
    } catch (_) {
      showToast('Invalid JSON file');
    }
  };
  reader.readAsText(file);
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  loadFields();

  document.getElementById('edit-toggle').addEventListener('click', () => {
    if (isEditing) { exitEditMode(); renderViewMode(); }
    else enterEditMode();
  });

  document.getElementById('add-field').addEventListener('click', () => {
    editFields.push({ id: uid(), type: 'field', label: '', value: '' });
    renderEditMode();
    document.querySelectorAll('.edit-row:not(.edit-row--group):not(.edit-row--divider)').forEach((r, i, arr) => {
      if (i === arr.length - 1) r.querySelector('.input-label')?.focus();
    });
  });

  document.getElementById('add-group').addEventListener('click', () => {
    editFields.push({ id: uid(), type: 'group', label: '', collapsed: false, protected: false, passwordHash: null });
    renderEditMode();
    const rows = document.querySelectorAll('.edit-row--group');
    rows[rows.length - 1]?.querySelector('.input-group-label')?.focus();
  });

  document.getElementById('add-divider').addEventListener('click', () => {
    editFields.push({ id: uid(), type: 'divider' });
    renderEditMode();
  });

  document.getElementById('save-btn').addEventListener('click', () => {
    fields = collectEditFields();
    saveFields(fields);
    renderViewMode();
    exitEditMode();
    showToast('Saved');
  });

  document.getElementById('cancel-btn').addEventListener('click', () => {
    exitEditMode();
    renderViewMode();
  });

  document.getElementById('export-btn').addEventListener('click', exportFields);

  document.getElementById('import-input').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) importFields(file);
    e.target.value = '';
  });
});
