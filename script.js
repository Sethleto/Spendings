const STORAGE_ENTRIES = 'spending_tracker_entries_v1';
const STORAGE_LIMITS = 'spending_tracker_limits_v1';
const STORAGE_CATEGORIES = 'spending_tracker_categories_v1';

const DEFAULT_CATEGORIES = [
  { key: 'cigarettes', label: 'Cigarettes', color: '#fbbf24' },
  { key: 'uber', label: 'Uber / Lyft', color: '#38bdf8' },
  { key: 'family', label: 'Help Family', color: '#4ade80' }
];

const COLOR_PALETTE = ['#a855f7', '#f472b6', '#fb7185', '#2dd4bf', '#818cf8', '#f97316', '#34d399'];

function loadFromStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed !== null && parsed !== undefined ? parsed : fallback;
  } catch (err) {
    console.warn('Storage read failed for', key, err);
    return fallback;
  }
}

let categories = loadFromStorage(STORAGE_CATEGORIES, null);
if (!Array.isArray(categories) || categories.length === 0) {
  categories = [...DEFAULT_CATEGORIES];
}

let entries = loadFromStorage(STORAGE_ENTRIES, []);
if (!Array.isArray(entries)) entries = [];

let limits = loadFromStorage(STORAGE_LIMITS, {});
if (typeof limits !== 'object' || limits === null || Array.isArray(limits)) {
  limits = {};
}

function syncLimitsStructure() {
  categories.forEach(cat => {
    if (!limits[cat.key]) {
      limits[cat.key] = { week: 0, month: 0, year: 0 };
    }
  });
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_CATEGORIES, JSON.stringify(categories));
    localStorage.setItem(STORAGE_ENTRIES, JSON.stringify(entries));
    localStorage.setItem(STORAGE_LIMITS, JSON.stringify(limits));
  } catch (err) {
    alert('Could not save to browser storage. Make sure Private Browsing is turned off.');
  }
}

syncLimitsStructure();
saveState();

function getTodayString() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now - offset).toISOString().split('T')[0];
}

document.getElementById('entryDate').value = getTodayString();

function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getStartOfWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return d;
}

function isSameWeek(entryDate, now) {
  const start = getStartOfWeek(now);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return entryDate >= start && entryDate < end;
}

function isSameMonth(entryDate, now) {
  return entryDate.getFullYear() === now.getFullYear() &&
         entryDate.getMonth() === now.getMonth();
}

function isSameYear(entryDate, now) {
  return entryDate.getFullYear() === now.getFullYear();
}

function formatMoney(num) {
  return '$' + Number(num || 0).toFixed(2);
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getPillStyle(color) {
  const c = color || '#94a3b8';
  return `background: ${hexToRgba(c, 0.16)}; color: ${c}; border-color: ${hexToRgba(c, 0.35)};`;
}

function updateLimit(catKey, period, value) {
  const parsed = parseFloat(value);
  if (!limits[catKey]) limits[catKey] = { week: 0, month: 0, year: 0 };
  limits[catKey][period] = isNaN(parsed) || parsed < 0 ? 0 : parsed;
  saveState();
  renderSummary();
}

document.getElementById('categoryForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const nameInput = document.getElementById('newCatName');
  const colorInput = document.getElementById('newCatColor');
  const label = nameInput.value.trim();
  const color = colorInput.value;

  if (!label) return;

  const exists = categories.some(c => c.label.toLowerCase() === label.toLowerCase());
  if (exists) {
    alert('A category with that name already exists.');
    return;
  }

  const key = 'cat_' + Date.now();
  categories.push({ key, label, color });
  limits[key] = { week: 0, month: 0, year: 0 };

  saveState();
  colorInput.value = COLOR_PALETTE[categories.length % COLOR_PALETTE.length];
  nameInput.value = '';
  render();
  document.getElementById('entryCategory').value = key;
});

function deleteCategory(catKey) {
  if (categories.length <= 1) {
    alert('You must keep at least one category.');
    return;
  }

  const cat = categories.find(c => c.key === catKey);
  const count = entries.filter(e => e.category === catKey).length;
  const msg = count > 0
    ? `Delete "${cat.label}"? It has ${count} existing log entr${count === 1 ? 'y' : 'ies'}. Those entries will stay in your log as "(Deleted)" unless you delete them.`
    : `Delete category "${cat.label}"?`;

  if (!confirm(msg)) return;

  categories = categories.filter(c => c.key !== catKey);
  delete limits[catKey];
  saveState();
  render();
}
function renderCategorySelects() {
  const entrySelect = document.getElementById('entryCategory');
  const filterSelect = document.getElementById('filterCategory');

  const currentEntryVal = entrySelect.value;
  const currentFilterVal = filterSelect.value;

  entrySelect.innerHTML = categories
    .map(c => `<option value="${c.key}">${escapeHTML(c.label)}</option>`)
    .join('');

  filterSelect.innerHTML = `<option value="all">All Categories</option>` +
    categories.map(c => `<option value="${c.key}">${escapeHTML(c.label)}</option>`).join('');

  if (categories.some(c => c.key === currentEntryVal)) {
    entrySelect.value = currentEntryVal;
  }
  if (currentFilterVal === 'all' || categories.some(c => c.key === currentFilterVal)) {
    filterSelect.value = currentFilterVal;
  }

  const chipsContainer = document.getElementById('categoryChips');
  chipsContainer.innerHTML = categories.map(c => `
    <div class="cat-chip">
      <span class="cat-dot" style="background:${c.color}"></span>
      <span>${escapeHTML(c.label)}</span>
      <button type="button" class="btn-icon-del" title="Remove category" onclick="deleteCategory('${c.key}')">✕</button>
    </div>
  `).join('');
}

function renderSummary() {
  const now = new Date();
  const grid = document.getElementById('summaryGrid');
  grid.innerHTML = '';

  categories.forEach(cat => {
    let weekTotal = 0;
    let monthTotal = 0;
    let yearTotal = 0;

    entries.forEach(e => {
      if (e.category !== cat.key) return;
      const d = parseLocalDate(e.date);
      if (isSameYear(d, now)) {
        yearTotal += Number(e.amount) || 0;
        if (isSameMonth(d, now)) {
          monthTotal += Number(e.amount) || 0;
        }
      }
      if (isSameWeek(d, now)) {
        weekTotal += Number(e.amount) || 0;
      }
    });

    const periods = [
      { key: 'week', label: 'This Week', total: weekTotal },
      { key: 'month', label: 'This Month', total: monthTotal },
      { key: 'year', label: 'This Year', total: yearTotal }
    ];

    const card = document.createElement('div');
    card.className = 'cat-card';

    let periodsHTML = periods.map(p => {
      const limitVal = limits[cat.key]?.[p.key] || 0;
      const isOver = limitVal > 0 && p.total > limitVal;

      return `
        <div class="period-box ${isOver ? 'over-limit' : ''}">
          <div class="period-top">
            <span>${p.label}</span>
            ${isOver ? '<span class="badge-over">Over Limit</span>' : ''}
          </div>
          <div class="period-amounts">
            <span class="spent-val">${formatMoney(p.total)}</span>
            <div class="limit-control">
              <span>Limit: $</span>
              <input
                type="number"
                inputmode="decimal"
                step="1"
                min="0"
                value="${limitVal || ''}"
                placeholder="None"
                onchange="updateLimit('${cat.key}', '${p.key}', this.value)"
              />
            </div>
          </div>
        </div>
      `;
    }).join('');

    card.innerHTML = `
      <div class="cat-header">
        <div class="cat-header-left">
          <span class="cat-dot" style="background:${cat.color}"></span>
          <h2>${escapeHTML(cat.label)}</h2>
        </div>
        <button type="button" class="btn-icon-del" title="Delete category" onclick="deleteCategory('${cat.key}')">✕</button>
      </div>
      ${periodsHTML}
    `;

    grid.appendChild(card);
  });
}

function renderLog() {
  const filterCat = document.getElementById('filterCategory').value;
  const filterPeriod = document.getElementById('filterPeriod').value;
  const now = new Date();

  const filtered = entries
    .filter(e => {
      if (filterCat !== 'all' && e.category !== filterCat) return false;
      const d = parseLocalDate(e.date);
      if (filterPeriod === 'week' && !isSameWeek(d, now)) return false;
      if (filterPeriod === 'month' && !isSameMonth(d, now)) return false;
      if (filterPeriod === 'year' && !isSameYear(d, now)) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  const totalFiltered = filtered.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  document.getElementById('filteredTotal').textContent = formatMoney(totalFiltered);

  const tbody = document.getElementById('logBody');
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-msg">No entries found for this filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(e => {
    const catObj = categories.find(c => c.key === e.category);
    const label = catObj ? catObj.label : `${e.category} (Deleted)`;
    const color = catObj ? catObj.color : '#94a3b8';

    return `
      <tr>
        <td>${e.date}</td>
        <td><span class="cat-pill" style="${getPillStyle(color)}">${escapeHTML(label)}</span></td>
        <td>${escapeHTML(e.note || '—')}</td>
        <td><strong>${formatMoney(e.amount)}</strong></td>
        <td class="actions-cell">
          <button class="btn-edit" onclick="editEntry(${e.id})">Edit</button>
          <button class="btn-danger" onclick="deleteEntry(${e.id})">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

document.getElementById('entryForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const editId = document.getElementById('editId').value;
  const date = document.getElementById('entryDate').value;
  const category = document.getElementById('entryCategory').value;
  const amount = parseFloat(document.getElementById('entryAmount').value);
  const note = document.getElementById('entryNote').value.trim();

  if (!date || !category || isNaN(amount) || amount <= 0) return;

  if (editId) {
    const idx = entries.findIndex(item => item.id === Number(editId));
    if (idx !== -1) {
      entries[idx] = { ...entries[idx], date, category, amount, note };
    }
  } else {
    entries.push({ id: Date.now(), date, category, amount, note });
  }

  saveState();
  resetForm();
  render();
});

function editEntry(id) {
  const item = entries.find(e => e.id === id);
  if (!item) return;

  document.getElementById('editId').value = item.id;
  document.getElementById('entryDate').value = item.date;
  if (categories.some(c => c.key === item.category)) {
    document.getElementById('entryCategory').value = item.category;
  }
  document.getElementById('entryAmount').value = item.amount;
  document.getElementById('entryNote').value = item.note || '';

  document.getElementById('formTitle').textContent = 'Edit Entry';
  document.getElementById('submitBtn').textContent = 'Save Changes';
  document.getElementById('cancelEditBtn').style.display = 'inline-block';
  document.getElementById('entryForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function deleteEntry(id) {
  if (!confirm('Delete this spending entry?')) return;
  entries = entries.filter(e => e.id !== id);
  if (Number(document.getElementById('editId').value) === id) {
    resetForm();
  }
  saveState();
  render();
}

function resetForm() {
  document.getElementById('entryForm').reset();
  document.getElementById('editId').value = '';
  document.getElementById('entryDate').value = getTodayString();
  document.getElementById('formTitle').textContent = 'Add New Spending Entry';
  document.getElementById('submitBtn').textContent = 'Add Entry';
  document.getElementById('cancelEditBtn').style.display = 'none';
}

function exportData() {
  const data = JSON.stringify({ categories, entries, limits }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spending-backup-${getTodayString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
        categories = parsed.categories;
      }
      if (Array.isArray(parsed.entries)) entries = parsed.entries;
      if (parsed.limits && typeof parsed.limits === 'object') limits = parsed.limits;
      syncLimitsStructure();
      saveState();
      render();
      alert('Backup restored!');
    } catch {
      alert('Invalid backup file.');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function render() {
  renderCategorySelects();
  renderSummary();
  renderLog();
}

window.addEventListener('storage', function() {
  categories = loadFromStorage(STORAGE_CATEGORIES, DEFAULT_CATEGORIES);
  entries = loadFromStorage(STORAGE_ENTRIES, []);
  limits = loadFromStorage(STORAGE_LIMITS, {});
  syncLimitsStructure();
  render();
});

render();
