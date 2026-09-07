// State management
let state = {
  products: [],
  batches: [],
  usageLogs: [],
  usageSummary: [],
  alerts: { low_stock_items: [], expiring_batches: [], expired_batches: [] },
  settings: {},
  recipients: [],
  activeTab: 'dashboard'
};

// Initialize app on DOM loaded
document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();
  
  // Set default dates in inputs
  const today = new Date().toISOString().split('T')[0];
  const usageDateEl = document.getElementById('usage-date');
  if (usageDateEl) usageDateEl.value = today;
  const batchReceivedEl = document.getElementById('batch-received');
  if (batchReceivedEl) batchReceivedEl.value = today;

  await loadAllData();
});

// Load all data from API
async function loadAllData() {
  try {
    await Promise.all([
      fetchProducts(),
      fetchBatches(),
      fetchAlerts(),
      fetchUsageLogs(),
      fetchUsageSummary(),
      fetchSettings(),
      fetchRecipients()
    ]);
    renderAll();
  } catch (err) {
    showToast('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + err.message, 'error');
  }
}

// API Calls
async function fetchProducts() {
  const res = await fetch('/api/products');
  const json = await res.json();
  if (json.success) state.products = json.data;
}

async function fetchBatches() {
  const res = await fetch('/api/batches');
  const json = await res.json();
  if (json.success) state.batches = json.data;
}

async function fetchAlerts() {
  const res = await fetch('/api/alerts');
  const json = await res.json();
  if (json.success) state.alerts = json.data;
}

async function fetchUsageLogs() {
  const res = await fetch('/api/usage');
  const json = await res.json();
  if (json.success) state.usageLogs = json.data;
}

async function fetchUsageSummary() {
  const res = await fetch('/api/usage/summary?days=30');
  const json = await res.json();
  if (json.success) state.usageSummary = json.data;
}

async function fetchSettings() {
  const res = await fetch('/api/settings');
  const json = await res.json();
  if (json.success) {
    state.settings = json.data;
    populateSettingsForm();
  }
}

async function fetchRecipients() {
  try {
    const res = await fetch('/api/line/recipients');
    const json = await res.json();
    if (json.success) state.recipients = json.data;
  } catch (e) {
    console.error('Error fetching recipients:', e);
  }
}

// Tab Switching
function switchTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('border-rose-600', 'text-rose-600');
    btn.classList.add('border-transparent', 'text-slate-500');
  });

  const activeContent = document.getElementById(`content-${tabName}`);
  const activeBtn = document.getElementById(`tab-${tabName}`);
  if (activeContent) activeContent.classList.remove('hidden');
  if (activeBtn) {
    activeBtn.classList.remove('border-transparent', 'text-slate-500');
    activeBtn.classList.add('border-rose-600', 'text-rose-600');
  }

  if (window.lucide) lucide.createIcons();
}

// Render UI Components
function renderAll() {
  renderStats();
  renderAlertLists();
  renderLineFlexPreview();
  renderInventoryTable();
  renderPlanningTable();
  renderUsageHistoryTable();
  renderRecipientsTable();
  populateProductSelects();
  if (window.lucide) lucide.createIcons();
}

// 1. Render Dashboard Top Stats
function renderStats() {
  const totalProds = state.products.length;
  const lowStockCount = state.alerts.low_stock_items ? state.alerts.low_stock_items.length : 0;
  const expiringCount = state.alerts.expiring_soon_batches ? state.alerts.expiring_soon_batches.length : 0;
  const expiredCount = state.alerts.expired_batches ? state.alerts.expired_batches.length : 0;

  document.getElementById('stat-total-products').textContent = totalProds;
  document.getElementById('stat-low-stock').textContent = lowStockCount;
  document.getElementById('stat-expiring-soon').textContent = expiringCount;
  document.getElementById('stat-expired').textContent = expiredCount;

  document.getElementById('low-stock-badge-count').textContent = `${lowStockCount} รายการ`;
  document.getElementById('expiring-badge-count').textContent = `${expiringCount + expiredCount} รายการ`;
}

// 2. Render Urgent Alert Lists on Dashboard
function renderAlertLists() {
  // Low stock items
  const lowStockContainer = document.getElementById('low-stock-list');
  if (state.alerts.low_stock_items.length === 0) {
    lowStockContainer.innerHTML = `
      <div class="p-6 text-center text-slate-400 text-xs">
        <i data-lucide="check-circle" class="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80"></i>
        <p>สต็อกสินค้าทุกรายการอยู่ในระดับปลอดภัย (ปกติ)</p>
      </div>
    `;
  } else {
    lowStockContainer.innerHTML = state.alerts.low_stock_items.map(item => `
      <div class="p-3 hover:bg-slate-50 flex items-center justify-between transition">
        <div class="flex items-center space-x-3">
          <div class="w-1.5 h-10 bg-rose-600 rounded-full"></div>
          <div>
            <div class="flex items-center space-x-2">
              <span class="font-bold text-slate-900">${item.name}</span>
              <span class="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">${item.category}</span>
            </div>
            <p class="text-[11px] text-slate-500">
              Safety Stock: <span class="font-semibold text-slate-700">${item.safety_stock} ${item.unit}</span>
            </p>
          </div>
        </div>
        <div class="text-right flex items-center space-x-3">
          <div>
            <div class="text-sm font-bold text-rose-600">เหลือ ${item.current_stock} ${item.unit}</div>
            <span class="text-[10px] text-rose-500 font-medium">ต่ำกว่าเกณฑ์</span>
          </div>
          <button onclick="openAddBatchModalFor(${item.id})" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium rounded-lg border border-rose-200 transition">
            + เติมของ
          </button>
        </div>
      </div>
    `).join('');
  }

  // Expiring items
  const expiringContainer = document.getElementById('expiring-batch-list');
  const allExpiring = [...(state.alerts.expired_batches || []), ...(state.alerts.expiring_soon_batches || [])];

  if (allExpiring.length === 0) {
    expiringContainer.innerHTML = `
      <div class="p-6 text-center text-slate-400 text-xs">
        <i data-lucide="shield-check" class="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80"></i>
        <p>ไม่มีสินค้าที่หมดอายุหรือใกล้หมดอายุใน 7 วัน</p>
      </div>
    `;
  } else {
    expiringContainer.innerHTML = allExpiring.map(b => {
      const isExpired = b.days_until_expiry < 0;
      const statusClass = isExpired ? 'bg-rose-500' : (b.days_until_expiry <= 3 ? 'bg-orange-500' : 'bg-amber-500');
      const badgeText = isExpired ? `หมดอายุแล้ว (${Math.abs(b.days_until_expiry)} วัน)` : (b.days_until_expiry === 0 ? 'หมดอายุวันนี้!' : `อีก ${b.days_until_expiry} วัน`);
      const textClass = isExpired ? 'text-rose-600 font-bold' : 'text-amber-700 font-semibold';

      return `
        <div class="p-3 hover:bg-slate-50 flex items-center justify-between transition">
          <div class="flex items-center space-x-3">
            <div class="w-1.5 h-10 ${statusClass} rounded-full"></div>
            <div>
              <div class="flex items-center space-x-2">
                <span class="font-bold text-slate-900">${b.product_name || b.name}</span>
                <span class="text-[10px] text-slate-500 font-mono">ล็อต ${b.lot_number || '-'}</span>
              </div>
              <p class="text-[11px] text-slate-500">
                หมดอายุ: <span class="font-medium text-slate-700">${b.expiry_date}</span> · คงเหลือ: ${b.quantity} ${b.unit || ''}
              </p>
            </div>
          </div>
          <div class="text-right flex items-center space-x-3">
            <span class="text-xs ${textClass}">${badgeText}</span>
            <button onclick="openUsageForBatch(${b.product_id}, ${b.id})" class="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-medium rounded-lg border border-amber-200 transition">
              นำไปใช้
            </button>
          </div>
        </div>
      `;
    }).join('');
  }
}

// 3. Render Live LINE Flex Preview Card (Matches the Reference Photo!)
function renderLineFlexPreview() {
  const itemsContainer = document.getElementById('preview-flex-items');
  const subtitleEl = document.getElementById('preview-flex-subtitle');
  const items = state.alerts.low_stock_items;

  subtitleEl.textContent = `พบ ${items.length} รายการที่ต่ำกว่า Safety Stock`;

  if (items.length === 0) {
    itemsContainer.innerHTML = `
      <div class="py-6 text-center text-slate-400">
        <p>ไม่มีสินค้าที่ต่ำกว่า Safety Stock ในขณะนี้</p>
      </div>
    `;
    return;
  }

  itemsContainer.innerHTML = items.map((item, idx) => `
    <div class="flex items-center justify-between py-1.5 ${idx < items.length - 1 ? 'border-b border-slate-100 pb-2' : ''}">
      <div class="flex items-start space-x-2">
        <div class="w-1 h-7 bg-[#DC2626] rounded-sm mt-0.5"></div>
        <div>
          <h5 class="font-bold text-slate-800 text-xs leading-none">${item.name}</h5>
          <p class="text-[10px] text-slate-400 mt-0.5">ใกล้หมด · Safety ${item.safety_stock} ${item.unit}</p>
        </div>
      </div>
      <div class="text-right">
        <div class="text-xs font-bold text-[#DC2626]">เหลือ ${item.current_stock}</div>
        <div class="text-[9px] text-slate-400 uppercase">${item.unit}</div>
      </div>
    </div>
  `).join('');
}

// 4. Render Inventory Table
function renderInventoryTable() {
  const tbody = document.getElementById('inventory-table-body');
  const searchTerm = (document.getElementById('search-inventory')?.value || '').toLowerCase();
  const selectedCat = document.getElementById('filter-category')?.value || 'ALL';

  // Extract unique categories
  const categories = [...new Set(state.products.map(p => p.category).filter(Boolean))];
  const catSelect = document.getElementById('filter-category');
  if (catSelect && catSelect.options.length <= 1) {
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      catSelect.appendChild(opt);
    });
  }

  const filtered = state.products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm) || (p.category && p.category.toLowerCase().includes(searchTerm));
    const matchCat = selectedCat === 'ALL' || p.category === selectedCat;
    return matchSearch && matchCat;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="p-8 text-center text-slate-400">ไม่พบข้อมูลสินค้าที่ค้นหา</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    let statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">ปกติ</span>`;
    if (p.is_low_stock) {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">สต็อกใกล้หมด</span>`;
    } else if (p.is_expired) {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-800">หมดอายุแล้ว</span>`;
    } else if (p.is_expiring_soon) {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">ใกล้หมดอายุ</span>`;
    }

    const expiryDisplay = p.nearest_expiry 
      ? `${p.nearest_expiry} <span class="text-[10px] text-slate-400">(${p.days_until_expiry < 0 ? 'หมดอายุแล้ว' : `อีก ${p.days_until_expiry} วัน`})</span>`
      : '<span class="text-slate-400">-</span>';

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="p-4">
          <div class="font-bold text-slate-900">${p.name}</div>
          <span class="text-[10px] text-slate-500">${p.category}</span>
        </td>
        <td class="p-4">
          <span class="font-bold ${p.is_low_stock ? 'text-rose-600' : 'text-slate-800'} text-sm">${p.current_stock}</span>
          <span class="text-slate-500 text-xs">${p.unit}</span>
        </td>
        <td class="p-4 text-slate-600 font-medium">${p.safety_stock} ${p.unit}</td>
        <td class="p-4 text-slate-700">${expiryDisplay}</td>
        <td class="p-4">${statusBadge}</td>
        <td class="p-4 text-center">
          <div class="flex items-center justify-center space-x-1">
            <button onclick="openAddBatchModalFor(${p.id})" title="รับเข้าล็อตใหม่" class="p-1.5 hover:bg-blue-50 text-blue-600 rounded-md transition">
              <i data-lucide="plus-circle" class="w-4 h-4"></i>
            </button>
            <button onclick="openEditProductModal(${p.id})" title="แก้ไขสินค้า" class="p-1.5 hover:bg-slate-100 text-slate-600 rounded-md transition">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            <button onclick="handleDeleteProduct(${p.id})" title="ลบสินค้า" class="p-1.5 hover:bg-rose-50 text-rose-600 rounded-md transition">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function filterInventory() {
  renderInventoryTable();
}

// 5. Render Planning Table (Consumption Rate & Stock Days Forecast)
function renderPlanningTable() {
  const tbody = document.getElementById('planning-table-body');
  if (!state.usageSummary || state.usageSummary.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="p-6 text-center text-slate-400">ยังไม่มีประวัติการใช้งานบันทึกในระบบ</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.usageSummary.map(item => {
    const product = state.products.find(p => p.id === item.product_id);
    const currentStock = product ? product.current_stock : 0;
    const avgDaily = item.avg_daily_use || 0;

    let daysRemainingText = '-';
    let recommendation = '<span class="text-slate-400">สต็อกเพียงพอ</span>';

    if (avgDaily > 0) {
      const days = Math.floor(currentStock / avgDaily);
      daysRemainingText = `ประมาณ ${days} วัน`;

      if (days <= 3) {
        recommendation = `<span class="text-rose-600 font-bold">⚠️ วิกฤต! ควรเปิดสั่งซื้อทันที</span>`;
      } else if (days <= 7) {
        recommendation = `<span class="text-amber-600 font-semibold">⚡ ใกล้สั่งซื้อ (เตรียมใบสั่ง)</span>`;
      }
    } else if (currentStock <= (product?.safety_stock || 0)) {
      recommendation = `<span class="text-rose-600 font-bold">⚠️ ต่ำกว่า Safety Stock</span>`;
    }

    return `
      <tr class="hover:bg-slate-50 border-b border-slate-100">
        <td class="p-3 font-semibold text-slate-800">${item.product_name}</td>
        <td class="p-3"><span class="font-bold text-slate-900">${currentStock}</span> ${item.unit}</td>
        <td class="p-3 text-slate-600">${item.total_used} ${item.unit}</td>
        <td class="p-3 text-slate-600">${avgDaily} ${item.unit}/วัน</td>
        <td class="p-3 font-medium text-slate-700">${daysRemainingText}</td>
        <td class="p-3">${recommendation}</td>
      </tr>
    `;
  }).join('');
}

// 6. Render Usage History Table
function renderUsageHistoryTable() {
  const tbody = document.getElementById('usage-history-table-body');
  if (state.usageLogs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-6 text-center text-slate-400">ยังไม่มีประวัติการเบิกใช้</td>
      </tr>
    `;
    return;
  }

  const typeLabels = {
    'USE': '<span class="px-2 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 font-medium">เบิกใช้</span>',
    'WASTE': '<span class="px-2 py-0.5 rounded text-[10px] bg-rose-50 text-rose-700 font-medium">ชำรุด/ทิ้ง</span>',
    'ADJUST': '<span class="px-2 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 font-medium">ปรับยอด</span>'
  };

  tbody.innerHTML = state.usageLogs.map(log => `
    <tr class="hover:bg-slate-50 border-b border-slate-100">
      <td class="p-3 text-slate-600 font-mono">${log.used_date}</td>
      <td class="p-3 font-bold text-slate-800">${log.product_name}</td>
      <td class="p-3 font-mono text-slate-500">${log.lot_number || 'FIFO (อัตโนมัติ)'}</td>
      <td class="p-3 font-bold text-amber-700">-${log.quantity} ${log.unit}</td>
      <td class="p-3">${typeLabels[log.type] || log.type}</td>
      <td class="p-3 text-slate-600">${log.purpose || log.notes || '-'}</td>
      <td class="p-3 text-slate-500">${log.used_by || '-'}</td>
    </tr>
  `).join('');
}

// 7. Populate Selects in Modals
function populateProductSelects() {
  const batchProdSelect = document.getElementById('batch-product-id');
  const usageProdSelect = document.getElementById('usage-product-id');

  if (batchProdSelect) {
    batchProdSelect.innerHTML = '<option value="">-- เลือกสินค้า --</option>' + 
      state.products.map(p => `<option value="${p.id}">${p.name} (${p.unit})</option>`).join('');
  }

  if (usageProdSelect) {
    usageProdSelect.innerHTML = '<option value="">-- เลือกสินค้า --</option>' + 
      state.products.map(p => `<option value="${p.id}">${p.name} [คงเหลือ: ${p.current_stock} ${p.unit}]</option>`).join('');
  }
}

// When product changes in Usage Modal, populate active batches
function onUsageProductChange() {
  const prodId = document.getElementById('usage-product-id').value;
  const batchSelect = document.getElementById('usage-batch-id');
  if (!batchSelect) return;

  batchSelect.innerHTML = '<option value="">⚡ แนะนำ: ตัดอัตโนมัติตามล็อตที่ใกล้หมดอายุก่อน (FIFO)</option>';
  if (!prodId) return;

  const batches = state.batches.filter(b => b.product_id == prodId && b.quantity > 0);
  batches.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = `ล็อต ${b.lot_number || '-'} (เหลือ ${b.quantity}, หมดอายุ ${b.expiry_date})`;
    batchSelect.appendChild(opt);
  });
}

// Dialog Helpers
function openDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog) dialog.showModal();
}

function closeDialog(id) {
  const dialog = document.getElementById(id);
  if (dialog) dialog.close();
}

// Modal Handlers
function openAddProductModal() {
  document.getElementById('modal-product-title').textContent = 'เพิ่มสินค้าใหม่';
  document.getElementById('form-product').reset();
  document.getElementById('prod-id').value = '';
  openDialog('modal-product');
}

function openEditProductModal(id) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;

  document.getElementById('modal-product-title').textContent = 'แก้ไขข้อมูลสินค้า';
  document.getElementById('prod-id').value = product.id;
  document.getElementById('prod-name').value = product.name;
  document.getElementById('prod-category').value = product.category;
  document.getElementById('prod-unit').value = product.unit;
  document.getElementById('prod-safety').value = product.safety_stock;
  document.getElementById('prod-warn-days').value = product.expiry_warning_days;

  openDialog('modal-product');
}

async function handleSaveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('prod-id').value;
  const data = {
    name: document.getElementById('prod-name').value,
    category: document.getElementById('prod-category').value,
    unit: document.getElementById('prod-unit').value,
    safety_stock: document.getElementById('prod-safety').value,
    expiry_warning_days: document.getElementById('prod-warn-days').value
  };

  try {
    const url = id ? `/api/products/${id}` : '/api/products';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    closeDialog('modal-product');
    showToast(id ? 'แก้ไขสินค้าสำเร็จ' : 'เพิ่มสินค้าใหม่สำเร็จ');
    await loadAllData();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
}

async function handleDeleteProduct(id) {
  if (!confirm('ยืนยันการลบสินค้านี้พร้อมทุกล็อตในระบบ?')) return;
  try {
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    showToast('ลบสินค้าเรียบร้อย');
    await loadAllData();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
}

function openAddBatchModal() {
  document.getElementById('form-batch').reset();
  document.getElementById('batch-id').value = '';
  document.getElementById('batch-received').value = new Date().toISOString().split('T')[0];
  openDialog('modal-batch');
}

function openAddBatchModalFor(productId) {
  openAddBatchModal();
  document.getElementById('batch-product-id').value = productId;
}

async function handleSaveBatch(e) {
  e.preventDefault();
  const data = {
    product_id: document.getElementById('batch-product-id').value,
    lot_number: document.getElementById('batch-lot').value,
    quantity: document.getElementById('batch-qty').value,
    expiry_date: document.getElementById('batch-expiry').value,
    received_date: document.getElementById('batch-received').value,
    notes: document.getElementById('batch-notes').value
  };

  try {
    const res = await fetch('/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    closeDialog('modal-batch');
    showToast('บันทึกรับเข้าล็อตใหม่สำเร็จ');
    await loadAllData();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
}

function openRecordUsageModal() {
  document.getElementById('form-usage').reset();
  document.getElementById('usage-date').value = new Date().toISOString().split('T')[0];
  populateProductSelects();
  onUsageProductChange();
  openDialog('modal-usage');
}

function openUsageForBatch(productId, batchId) {
  openRecordUsageModal();
  document.getElementById('usage-product-id').value = productId;
  onUsageProductChange();
  document.getElementById('usage-batch-id').value = batchId;
}

async function handleSaveUsage(e) {
  e.preventDefault();
  const data = {
    product_id: document.getElementById('usage-product-id').value,
    batch_id: document.getElementById('usage-batch-id').value || null,
    quantity: document.getElementById('usage-qty').value,
    type: document.getElementById('usage-type').value,
    used_date: document.getElementById('usage-date').value,
    used_by: document.getElementById('usage-by').value,
    purpose: document.getElementById('usage-purpose').value
  };

  try {
    const res = await fetch('/api/usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    closeDialog('modal-usage');
    showToast('บันทึกการใช้งานและตัดสต็อกสำเร็จ');
    await loadAllData();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
}

// Recipients Table & Handlers (Multiple Users & Groups)
function renderRecipientsTable() {
  const tbody = document.getElementById('recipients-table-body');
  const badgeEl = document.getElementById('recipient-count-badge');
  if (!tbody) return;

  const total = state.recipients.length;
  const activeCount = state.recipients.filter(r => r.is_active).length;

  if (badgeEl) {
    badgeEl.textContent = `${total} ปลายทาง (เปิดรับ ${activeCount})`;
  }

  if (state.recipients.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="p-6 text-center text-slate-400">
          <i data-lucide="users" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
          <p>ยังไม่มีรายชื่อผู้รับหรือกลุ่มในระบบ</p>
          <p class="text-[11px] text-slate-400 mt-1">กดปุ่ม <b>"+ เพิ่มผู้รับ / เพิ่มกลุ่ม"</b> เพื่อระบุ User ID หรือ Group ID ได้เลยครับ</p>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = state.recipients.map(r => {
    const isGroup = r.type === 'GROUP' || r.target_id.startsWith('C') || r.target_id.startsWith('R');
    const typeBadge = isGroup
      ? `<span class="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <i data-lucide="users-round" class="w-3 h-3"></i>
          <span>ไลน์กลุ่ม</span>
        </span>`
      : `<span class="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <i data-lucide="user" class="w-3 h-3"></i>
          <span>ส่วนตัว</span>
        </span>`;

    const activeBadge = r.is_active
      ? `<button onclick="handleToggleRecipient(${r.id}, false)" title="คลิกเพื่อปิดรับชั่วคราว" class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition">
          ● เปิดใช้งาน
        </button>`
      : `<button onclick="handleToggleRecipient(${r.id}, true)" title="คลิกเพื่อเปิดรับ" class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 hover:bg-slate-200 transition">
          ○ ปิดชั่วคราว
        </button>`;

    const shortId = r.target_id.length > 16 
      ? `${r.target_id.slice(0, 8)}...${r.target_id.slice(-6)}` 
      : r.target_id;

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100 ${r.is_active ? '' : 'opacity-60'}">
        <td class="p-3">${typeBadge}</td>
        <td class="p-3">
          <div class="font-bold text-slate-800">${r.name}</div>
          ${r.notes ? `<div class="text-[10px] text-slate-400">${r.notes}</div>` : ''}
        </td>
        <td class="p-3">
          <div class="flex items-center space-x-1.5 font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded max-w-fit">
            <span>${shortId}</span>
            <button onclick="copyToClipboard('${r.target_id}')" title="คัดลอก ID เต็ม" class="text-slate-400 hover:text-slate-700">
              <i data-lucide="copy" class="w-3 h-3"></i>
            </button>
          </div>
        </td>
        <td class="p-3 text-center">${activeBadge}</td>
        <td class="p-3 text-center">
          <div class="flex items-center justify-center space-x-1">
            <button onclick="triggerSendTestToRecipient('${r.target_id}', '${r.name}')" title="ทดสอบส่งเฉพาะคนนี้/กลุ่มนี้" class="p-1.5 hover:bg-amber-50 text-amber-600 rounded transition">
              <i data-lucide="bell-ring" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="openEditRecipientModal(${r.id})" title="แก้ไข" class="p-1.5 hover:bg-slate-100 text-slate-600 rounded transition">
              <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="handleDeleteRecipient(${r.id})" title="ลบ" class="p-1.5 hover:bg-rose-50 text-rose-600 rounded transition">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  showToast('คัดลอก ID เรียบร้อยแล้ว!');
}

function openAddRecipientModal() {
  document.getElementById('modal-recipient-title').innerHTML = `
    <i data-lucide="user-plus" class="w-4 h-4 text-blue-600"></i>
    <span>เพิ่มปลายทางรับแจ้งเตือน</span>
  `;
  document.getElementById('form-recipient').reset();
  document.getElementById('rec-id').value = '';
  openDialog('modal-recipient');
  if (window.lucide) lucide.createIcons();
}

function openEditRecipientModal(id) {
  const rec = state.recipients.find(r => r.id === id);
  if (!rec) return;

  document.getElementById('modal-recipient-title').innerHTML = `
    <i data-lucide="edit-3" class="w-4 h-4 text-blue-600"></i>
    <span>แก้ไขปลายทางรับแจ้งเตือน</span>
  `;
  document.getElementById('rec-id').value = rec.id;
  document.getElementById('rec-name').value = rec.name;
  document.getElementById('rec-target-id').value = rec.target_id;
  document.getElementById('rec-notes').value = rec.notes || '';

  openDialog('modal-recipient');
  if (window.lucide) lucide.createIcons();
}

async function handleSaveRecipient(e) {
  e.preventDefault();
  const id = document.getElementById('rec-id').value;
  const targetId = document.getElementById('rec-target-id').value.trim();

  if (!targetId.startsWith('U') && !targetId.startsWith('C') && !targetId.startsWith('R')) {
    showToast('⚠️ Target ID ต้องขึ้นต้นด้วย U (ส่วนตัว) หรือ C/R (กลุ่ม)', 'error');
    return;
  }

  const payload = {
    name: document.getElementById('rec-name').value.trim(),
    target_id: targetId,
    notes: document.getElementById('rec-notes').value.trim()
  };

  try {
    const url = id ? `/api/line/recipients/${id}` : '/api/line/recipients';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    closeDialog('modal-recipient');
    showToast(json.message || 'บันทึกปลายทางสำเร็จ');
    await fetchRecipients();
    renderRecipientsTable();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
}

async function handleToggleRecipient(id, isActive) {
  try {
    const res = await fetch(`/api/line/recipients/${id}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: isActive })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    showToast(json.message);
    await fetchRecipients();
    renderRecipientsTable();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
}

async function handleDeleteRecipient(id) {
  if (!confirm('ยืนยันการลบปลายทางรับแจ้งเตือนนี้?')) return;
  try {
    const res = await fetch(`/api/line/recipients/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    showToast('ลบปลายทางเรียบร้อย');
    await fetchRecipients();
    renderRecipientsTable();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
}

async function triggerSendTestToRecipient(targetId, name) {
  showToast(`กำลังส่งข้อความทดสอบไปยัง "${name}"...`);
  try {
    const res = await fetch('/api/line/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: document.getElementById('setting-token')?.value || undefined,
        target_id: targetId
      })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    showToast(`ส่งข้อความทดสอบไปยัง "${name}" สำเร็จแล้ว!`);
  } catch (err) {
    showToast('ส่งไม่สำเร็จ: ' + err.message, 'error');
  }
}

// Settings Handlers
function populateSettingsForm() {
  const s = state.settings;
  if (!s) return;
  if (document.getElementById('setting-token')) document.getElementById('setting-token').value = s.line_channel_access_token || '';
  if (document.getElementById('setting-alert-time')) document.getElementById('setting-alert-time').value = s.daily_alert_time || '08:00';
  if (document.getElementById('setting-expiry-days')) document.getElementById('setting-expiry-days').value = s.default_expiry_alert_days || '7';
  if (document.getElementById('setting-enable-low-stock')) document.getElementById('setting-enable-low-stock').checked = s.enable_low_stock_alert === '1';
  if (document.getElementById('setting-enable-expiry')) document.getElementById('setting-enable-expiry').checked = s.enable_expiry_alert === '1';
}

async function saveSettings(e) {
  e.preventDefault();
  const payload = {
    line_channel_access_token: document.getElementById('setting-token').value,
    daily_alert_time: document.getElementById('setting-alert-time').value,
    default_expiry_alert_days: parseInt(document.getElementById('setting-expiry-days').value, 10) || 7,
    enable_low_stock_alert: document.getElementById('setting-enable-low-stock').checked,
    enable_expiry_alert: document.getElementById('setting-enable-expiry').checked
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    showToast('บันทึกการตั้งค่า Token เรียบร้อยแล้ว');
    await fetchSettings();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
}

// Trigger Manual LINE Notifications (Broadcast to all active recipients)
async function triggerSendTestMessage() {
  const activeCount = state.recipients.filter(r => r.is_active).length;
  showToast(`กำลังส่งข้อความทดสอบไปยัง ${activeCount} ปลายทาง...`);
  try {
    const res = await fetch('/api/line/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: document.getElementById('setting-token')?.value || undefined
      })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    showToast(`ส่งข้อความทดสอบสำเร็จ! (${json.result?.count || 1} ปลายทาง)`);
  } catch (err) {
    showToast('ส่งไม่สำเร็จ: ' + err.message, 'error');
  }
}

async function triggerSendLiveReport() {
  const activeCount = state.recipients.filter(r => r.is_active).length;
  showToast(`กำลังส่งรายงานสต็อกไปยัง ${activeCount} ปลายทาง...`);
  try {
    const res = await fetch('/api/line/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: document.getElementById('setting-token')?.value || undefined
      })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    showToast(`ส่งรายงานสต็อกสำเร็จ! (${json.result?.count || 1} ปลายทาง)`);
  } catch (err) {
    showToast('ส่งไม่สำเร็จ: ' + err.message, 'error');
  }
}

// Toast Feedback Notification
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  const toastIcon = document.getElementById('toast-icon');

  toastMsg.textContent = message;
  if (type === 'error') {
    toast.className = 'fixed bottom-5 right-5 z-50 transform translate-y-0 opacity-100 transition-all duration-300 bg-rose-900 text-white text-xs px-4 py-3 rounded-xl shadow-xl flex items-center space-x-2 border border-rose-700';
    toastIcon.setAttribute('data-lucide', 'alert-circle');
    toastIcon.className = 'w-4 h-4 text-rose-300';
  } else {
    toast.className = 'fixed bottom-5 right-5 z-50 transform translate-y-0 opacity-100 transition-all duration-300 bg-slate-900 text-white text-xs px-4 py-3 rounded-xl shadow-xl flex items-center space-x-2 border border-slate-700';
    toastIcon.setAttribute('data-lucide', 'check-circle');
    toastIcon.className = 'w-4 h-4 text-emerald-400';
  }

  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 4000);
}

