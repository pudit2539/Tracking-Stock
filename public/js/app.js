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

// 4. Render Inventory Table with Filters & Quick Update
function renderInventoryTable() {
  const tbody = document.getElementById('inventory-table-body');
  const searchTerm = (document.getElementById('search-inventory')?.value || '').toLowerCase();
  const selectedCat = document.getElementById('filter-category')?.value || 'ALL';
  const currentFilter = state.inventoryFilter || 'ALL';

  // Update counts in filter chips
  const totalCount = state.products.length;
  const lowCount = state.products.filter(p => p.is_low_stock).length;
  const noExpiryCount = state.products.filter(p => !p.nearest_expiry).length;
  const expiringCount = state.products.filter(p => p.is_expiring_soon || p.is_expired).length;

  const countAllEl = document.getElementById('count-all');
  if (countAllEl) countAllEl.textContent = totalCount;
  const countLowEl = document.getElementById('count-low');
  if (countLowEl) countLowEl.textContent = lowCount;
  const countNoExpEl = document.getElementById('count-no-expiry');
  if (countNoExpEl) countNoExpEl.textContent = noExpiryCount;
  const countExpEl = document.getElementById('count-expiring');
  if (countExpEl) countExpEl.textContent = expiringCount;

  // Update active chip styles
  document.querySelectorAll('.chip-filter').forEach(btn => {
    btn.className = 'chip-filter px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition';
  });
  const activeChipId = {
    'ALL': 'chip-filter-all',
    'LOW': 'chip-filter-low',
    'NO_EXPIRY': 'chip-filter-no-expiry',
    'EXPIRING': 'chip-filter-expiring'
  }[currentFilter] || 'chip-filter-all';
  const activeChip = document.getElementById(activeChipId);
  if (activeChip) {
    if (currentFilter === 'LOW') {
      activeChip.className = 'chip-filter px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-600 text-white transition';
    } else if (currentFilter === 'NO_EXPIRY') {
      activeChip.className = 'chip-filter px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white transition';
    } else if (currentFilter === 'EXPIRING') {
      activeChip.className = 'chip-filter px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-600 text-white transition';
    } else {
      activeChip.className = 'chip-filter px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900 text-white transition';
    }
  }

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

    let matchFilter = true;
    if (currentFilter === 'LOW') matchFilter = p.is_low_stock;
    else if (currentFilter === 'NO_EXPIRY') matchFilter = !p.nearest_expiry;
    else if (currentFilter === 'EXPIRING') matchFilter = p.is_expiring_soon || p.is_expired;

    return matchSearch && matchCat && matchFilter;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="p-8 text-center text-slate-400">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
          <p>ไม่พบรายการสินค้าที่ตรงกับเงื่อนไขการค้นหา/ตัวกรอง</p>
        </td>
      </tr>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    let statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">ปกติ</span>`;
    if (p.is_low_stock) {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800">⚠️ ต่ำกว่าเกณฑ์/หมด</span>`;
    } else if (p.is_expired) {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-800">หมดอายุแล้ว</span>`;
    } else if (p.is_expiring_soon) {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">ใกล้หมดอายุ</span>`;
    }

    const expiryDisplay = p.nearest_expiry 
      ? `
        <div class="flex items-center space-x-1.5">
          <span class="font-medium text-slate-800">${p.nearest_expiry}</span>
          <span class="text-[10px] ${p.days_until_expiry < 0 ? 'text-rose-600 font-bold' : (p.days_until_expiry <= 7 ? 'text-amber-600 font-bold' : 'text-slate-400')}">
            (${p.days_until_expiry < 0 ? 'หมดอายุแล้ว' : `อีก ${p.days_until_expiry} วัน`})
          </span>
          <button onclick="openQuickUpdateModal(${p.id})" title="ปรับวันหมดอายุ" class="p-1 hover:bg-blue-50 text-blue-500 rounded transition">
            <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `
      : `
        <button onclick="openQuickUpdateModal(${p.id})" class="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium text-xs rounded-lg border border-blue-200 transition">
          <i data-lucide="calendar-plus" class="w-3.5 h-3.5"></i>
          <span>+ ใส่วันหมดอายุ</span>
        </button>
      `;

    return `
      <tr class="hover:bg-slate-50/80 transition border-b border-slate-100">
        <td class="p-3.5">
          <div class="font-bold text-slate-900 text-xs">${p.name}</div>
          <span class="text-[10px] text-slate-400">${p.category}</span>
        </td>
        <td class="p-3.5">
          <div class="flex items-center space-x-1.5">
            <span class="font-bold ${p.is_low_stock ? 'text-rose-600 font-extrabold' : 'text-slate-800'} text-sm">${p.current_stock}</span>
            <span class="text-slate-500 text-[11px] font-medium uppercase">${p.unit}</span>
          </div>
        </td>
        <td class="p-3.5">
          <div class="flex items-center space-x-1.5">
            <span class="font-semibold text-slate-700 text-xs">${p.safety_stock} ${p.unit}</span>
            <button onclick="inlineEditSafetyStock(${p.id}, ${p.safety_stock}, '${p.name.replace(/'/g, "\\'")}')" title="คลิกเพื่อแก้จุดสั่งซื้อ" class="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded transition">
              <i data-lucide="edit-2" class="w-3 h-3"></i>
            </button>
          </div>
        </td>
        <td class="p-3.5">${expiryDisplay}</td>
        <td class="p-3.5">${statusBadge}</td>
        <td class="p-3.5 text-center">
          <div class="flex items-center justify-center space-x-1">
            <button onclick="openQuickUpdateModal(${p.id})" class="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs rounded-lg flex items-center space-x-1 shadow-2xs transition" title="อัปเดตด่วน สต็อก & วันหมดอายุ">
              <i data-lucide="zap" class="w-3.5 h-3.5"></i>
              <span>อัปเดตด่วน</span>
            </button>
            <button onclick="openEditProductModal(${p.id})" title="แก้ไขข้อมูลสินค้า" class="p-1.5 hover:bg-slate-100 text-slate-500 rounded-md transition">
              <i data-lucide="more-horizontal" class="w-4 h-4"></i>
            </button>
            <button onclick="handleDeleteProduct(${p.id})" title="ลบสินค้า" class="p-1.5 hover:bg-rose-50 text-rose-500 rounded-md transition">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // 4.2 Render Mobile Cards View (Optimized for Phones & Thumb Interaction)
  const mobileContainer = document.getElementById('inventory-mobile-cards');
  if (mobileContainer) {
    if (filtered.length === 0) {
      mobileContainer.innerHTML = `
        <div class="p-8 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
          <p>ไม่พบรายการสินค้าที่ค้นหา</p>
        </div>
      `;
    } else {
      mobileContainer.innerHTML = filtered.map(p => {
        let statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">ปกติ</span>`;
        if (p.is_low_stock) {
          statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">⚠️ ต่ำกว่าเกณฑ์/หมด</span>`;
        } else if (p.is_expired) {
          statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">หมดอายุแล้ว</span>`;
        } else if (p.is_expiring_soon) {
          statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">ใกล้หมดอายุ</span>`;
        }

        const expiryText = p.nearest_expiry 
          ? `<span class="font-bold text-slate-900">${p.nearest_expiry}</span> <span class="text-[10px] ${p.days_until_expiry < 0 ? 'text-rose-600 font-bold' : (p.days_until_expiry <= 7 ? 'text-amber-600 font-bold' : 'text-slate-400')}">(${p.days_until_expiry < 0 ? 'หมดอายุแล้ว' : `อีก ${p.days_until_expiry} วัน`})</span>`
          : `<span class="text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-md">ยังไม่ระบุ</span>`;

        return `
          <div class="bg-white p-4 rounded-3xl border ${p.is_low_stock ? 'border-rose-200 shadow-rose-100/40' : 'border-slate-200'} shadow-sm space-y-3">
            <!-- Header: Title & Status -->
            <div class="flex items-start justify-between gap-2">
              <div>
                <h4 class="font-extrabold text-slate-900 text-sm leading-snug">${p.name}</h4>
                <span class="inline-block mt-0.5 text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">${p.category}</span>
              </div>
              <div class="shrink-0">${statusBadge}</div>
            </div>

            <!-- Stats 3 Columns -->
            <div class="grid grid-cols-3 gap-2 p-3 bg-slate-50/80 rounded-2xl border border-slate-100 text-xs">
              <div>
                <div class="text-[10px] text-slate-400 font-medium">คงเหลือ</div>
                <div class="font-black ${p.is_low_stock ? 'text-rose-600 text-base' : 'text-slate-900 text-sm'}">
                  ${p.current_stock} <span class="text-[10px] font-normal uppercase text-slate-500">${p.unit}</span>
                </div>
              </div>
              <div>
                <div class="text-[10px] text-slate-400 font-medium">จุดสั่งซื้อ</div>
                <div class="font-bold text-slate-700">
                  ${p.safety_stock} <span class="text-[10px] font-normal uppercase text-slate-500">${p.unit}</span>
                </div>
              </div>
              <div>
                <div class="text-[10px] text-slate-400 font-medium">วันหมดอายุ</div>
                <div class="text-[11px] truncate mt-0.5">${expiryText}</div>
              </div>
            </div>

            <!-- Big Thumb Action Button -->
            <button onclick="openQuickUpdateModal(${p.id})" class="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-xs rounded-2xl shadow-xs flex items-center justify-center space-x-2 transition">
              <i data-lucide="zap" class="w-4 h-4"></i>
              <span>⚡ แตะเพื่อกรอกวันหมดอายุ & สต็อก</span>
            </button>
          </div>
        `;
      }).join('');
    }
  }

  if (window.lucide) lucide.createIcons();
}

function filterInventory() {
  renderInventoryTable();
}

function setInventoryFilter(type) {
  state.inventoryFilter = type;
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
  if (document.getElementById('setting-app-url')) document.getElementById('setting-app-url').value = s.app_url || window.location.origin;
  if (document.getElementById('setting-alert-time')) document.getElementById('setting-alert-time').value = s.daily_alert_time || '08:00';
  if (document.getElementById('setting-expiry-days')) document.getElementById('setting-expiry-days').value = s.default_expiry_alert_days || '7';
  if (document.getElementById('setting-enable-low-stock')) document.getElementById('setting-enable-low-stock').checked = s.enable_low_stock_alert === '1';
  if (document.getElementById('setting-enable-expiry')) document.getElementById('setting-enable-expiry').checked = s.enable_expiry_alert === '1';
}

async function saveSettings(e) {
  e.preventDefault();
  const payload = {
    line_channel_access_token: document.getElementById('setting-token').value,
    app_url: document.getElementById('setting-app-url')?.value.trim() || window.location.origin,
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
    showToast('บันทึกการตั้งค่า Token & Web URL เรียบร้อยแล้ว');
    await fetchSettings();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
}

// Trigger Manual LINE Notifications (Broadcast to all active recipients)
async function triggerSendTestToRecipient(targetId, name) {
  const appUrl = document.getElementById('setting-app-url')?.value.trim() || window.location.origin;
  showToast(`กำลังส่งข้อความทดสอบไปยัง "${name}"...`);
  try {
    const res = await fetch('/api/line/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: document.getElementById('setting-token')?.value || undefined,
        target_id: targetId,
        app_url: appUrl
      })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    showToast(`ส่งข้อความทดสอบไปยัง "${name}" สำเร็จแล้ว!`);
  } catch (err) {
    showToast('ส่งไม่สำเร็จ: ' + err.message, 'error');
  }
}

async function triggerSendTestMessage() {
  const activeCount = state.recipients.filter(r => r.is_active).length;
  const appUrl = document.getElementById('setting-app-url')?.value.trim() || window.location.origin;
  showToast(`กำลังส่งข้อความทดสอบไปยัง ${activeCount} ปลายทาง...`);
  try {
    const res = await fetch('/api/line/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: document.getElementById('setting-token')?.value || undefined,
        app_url: appUrl
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
  const appUrl = document.getElementById('setting-app-url')?.value.trim() || window.location.origin;
  showToast(`กำลังส่งรายงานสต็อกไปยัง ${activeCount} ปลายทาง...`);
  try {
    const res = await fetch('/api/line/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: document.getElementById('setting-token')?.value || undefined,
        app_url: appUrl
      })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    showToast(`ส่งรายงานสต็อกสำเร็จ! (${json.result?.count || 1} ปลายทาง)`);
  } catch (err) {
    showToast('ส่งไม่สำเร็จ: ' + err.message, 'error');
  }
}

// Toast Feedback Notification (Auto dismiss + Click to dismiss)
let toastTimeout = null;

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-message');
  const toastIcon = document.getElementById('toast-icon');
  if (!toast || !toastMsg) return;

  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }

  toastMsg.textContent = message;

  // Reveal toast
  toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
  toast.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');

  if (type === 'error') {
    toast.classList.remove('bg-slate-900', 'border-slate-700');
    toast.classList.add('bg-rose-900', 'border-rose-700');
    if (toastIcon) {
      toastIcon.setAttribute('data-lucide', 'alert-circle');
      toastIcon.className = 'w-4 h-4 text-rose-300 shrink-0';
    }
  } else {
    toast.classList.remove('bg-rose-900', 'border-rose-700');
    toast.classList.add('bg-slate-900', 'border-slate-700');
    if (toastIcon) {
      toastIcon.setAttribute('data-lucide', 'check-circle');
      toastIcon.className = 'w-4 h-4 text-emerald-400 shrink-0';
    }
  }

  if (window.lucide) lucide.createIcons();

  toastTimeout = setTimeout(() => {
    hideToast();
  }, 3500);
}

function hideToast() {
  const toast = document.getElementById('toast');
  if (!toast) return;
  if (toastTimeout) {
    clearTimeout(toastTimeout);
    toastTimeout = null;
  }
  toast.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
  toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
}

// ==============================================================
// QUICK STOCK & EXPIRY UPDATE HANDLERS
// ==============================================================
let currentQuickIndex = -1;
let quickProductList = [];

function openQuickUpdateModal(productId) {
  quickProductList = state.products;
  currentQuickIndex = quickProductList.findIndex(p => p.id == productId);
  if (currentQuickIndex === -1) currentQuickIndex = 0;
  populateQuickModal();
  openDialog('modal-quick-update');
}

function populateQuickModal() {
  if (currentQuickIndex < 0 || currentQuickIndex >= quickProductList.length) return;
  const prod = quickProductList[currentQuickIndex];

  document.getElementById('quick-prod-id').value = prod.id;
  document.getElementById('quick-prod-name').textContent = prod.name;
  document.getElementById('quick-prod-category').textContent = prod.category || 'ของแห้ง';
  document.getElementById('quick-unit-label-1').textContent = prod.unit || 'ชิ้น';
  document.getElementById('quick-unit-label-2').textContent = prod.unit || 'ชิ้น';

  document.getElementById('quick-safety-stock').value = prod.safety_stock;
  document.getElementById('quick-quantity').value = prod.current_stock;
  document.getElementById('quick-current-status').textContent = `คงเหลือเดิม: ${prod.current_stock} ${prod.unit}`;

  document.getElementById('quick-expiry-date').value = prod.nearest_expiry || '';

  const btnPrev = document.getElementById('btn-quick-prev');
  const btnNext = document.getElementById('btn-quick-next');
  if (btnPrev) btnPrev.disabled = currentQuickIndex <= 0;
  if (btnNext) btnNext.disabled = currentQuickIndex >= quickProductList.length - 1;

  if (window.lucide) lucide.createIcons();
}

function setQuickSafety(val) {
  document.getElementById('quick-safety-stock').value = val;
}

function setQuickQty(val) {
  document.getElementById('quick-quantity').value = val;
}

function adjustQuickQty(delta) {
  const el = document.getElementById('quick-quantity');
  const cur = parseFloat(el.value) || 0;
  el.value = Math.max(0, cur + delta);
}

function applyDatePreset(amount, unit) {
  const d = new Date();
  if (unit === 'days') {
    d.setDate(d.getDate() + amount);
  } else if (unit === 'months') {
    d.setMonth(d.getMonth() + amount);
  } else if (unit === 'years') {
    d.setFullYear(d.getFullYear() + amount);
  }
  const str = d.toISOString().split('T')[0];
  document.getElementById('quick-expiry-date').value = str;
}

async function handleSaveQuickUpdate(event) {
  if (event) event.preventDefault();
  const prodId = document.getElementById('quick-prod-id').value;
  const safetyStock = document.getElementById('quick-safety-stock').value;
  const quantity = document.getElementById('quick-quantity').value;
  const expiryDate = document.getElementById('quick-expiry-date').value;

  try {
    const res = await fetch(`/api/products/${prodId}/quick-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        safety_stock: safetyStock,
        quantity: quantity,
        expiry_date: expiryDate
      })
    });

    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    showToast('✅ อัปเดตข้อมูลสินค้าสำเร็จ');
    await loadAllData();
    closeDialog('modal-quick-update');
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
}

async function handleSaveAndNextQuickUpdate(event) {
  if (event) event.preventDefault();
  const prodId = document.getElementById('quick-prod-id').value;
  const safetyStock = document.getElementById('quick-safety-stock').value;
  const quantity = document.getElementById('quick-quantity').value;
  const expiryDate = document.getElementById('quick-expiry-date').value;

  try {
    const res = await fetch(`/api/products/${prodId}/quick-update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        safety_stock: safetyStock,
        quantity: quantity,
        expiry_date: expiryDate
      })
    });

    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    showToast('✅ บันทึกแล้ว กำลังไปรายการถัดไป...');
    await loadAllData();

    if (currentQuickIndex < quickProductList.length - 1) {
      currentQuickIndex++;
      populateQuickModal();
    } else {
      closeDialog('modal-quick-update');
      showToast('🎉 บันทึกครบทุกรายการแล้ว!');
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
}

function navigateQuickProduct(direction) {
  const newIdx = currentQuickIndex + direction;
  if (newIdx >= 0 && newIdx < quickProductList.length) {
    currentQuickIndex = newIdx;
    populateQuickModal();
  }
}

async function inlineEditSafetyStock(productId, currentVal, name) {
  const newVal = prompt(`ตั้งค่าจุดสั่งซื้อ (Safety Stock) สำหรับ:\n"${name}"\n(แจ้งเตือนเมื่อสต็อกเหลือ \u2264 ค่านี้)`, currentVal);
  if (newVal === null) return;
  const parsed = parseFloat(newVal);
  if (isNaN(parsed) || parsed < 0) {
    showToast('กรุณาระบุตัวเลขที่ถูกต้อง', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/products/${productId}/safety-stock`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ safety_stock: parsed })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    showToast(`✅ อัปเดตจุดสั่งซื้อของ ${name} เป็น ${parsed} สำเร็จ`);
    await loadAllData();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
}

