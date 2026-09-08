// State management
let state = {
  products: [],
  batches: [],
  receivingHistory: [],
  usageLogs: [],
  usageSummary: [],
  alerts: { low_stock_items: [], expiring_batches: [], expired_batches: [] },
  settings: {},
  recipients: [],
  activeTab: 'dashboard',
  historySubTab: 'inbound',
  inventorySort: localStorage.getItem('dq_inventory_sort') || 'UPDATED_DESC',
  inboundSort: localStorage.getItem('dq_inbound_sort') || 'DATE_DESC',
  outboundSort: localStorage.getItem('dq_outbound_sort') || 'DATE_DESC',
  lowStockSort: localStorage.getItem('dq_lowstock_sort') || 'URGENCY_DESC',
  expiringSort: localStorage.getItem('dq_expiring_sort') || 'EXPIRY_ASC',
  planningSort: localStorage.getItem('dq_planning_sort') || 'DAYS_ASC',
  batchModalSort: 'EXPIRY_ASC'
};

// =======================================================
// HAPTIC & SYNTHETIC AUDIO FEEDBACK ENGINE (Feature 4)
// =======================================================
let audioCtx = null;
function playTapFeedback(type = 'click') {
  // 1. Web Vibration API (Mobile Tactile Feedback)
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (type === 'save') {
        navigator.vibrate([35, 45, 35]); // Double confirmation pulse
      } else if (type === 'zero') {
        navigator.vibrate([45, 30, 45]);
      } else if (type === 'alert') {
        navigator.vibrate([60, 50, 60]);
      } else {
        navigator.vibrate(22); // Subtle tactile tap
      }
    }
  } catch (e) {}

  // 2. Web Audio API (Subtle Soft Click Audio, 0ms Latency)
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === 'save') {
      // Pleasant double bell (success chime)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08); // A5
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    } else if (type === 'zero') {
      // Deeper thud for empty / 0
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.05);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'alert') {
      // Low warning tone
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.1);
      gain.gain.setValueAtTime(0.10, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else {
      // Soft high-end tactile click
      osc.type = 'sine';
      osc.frequency.setValueAtTime(750, now);
      osc.frequency.exponentialRampToValueAtTime(380, now + 0.035);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.035);
      osc.start(now);
      osc.stop(now + 0.035);
    }
  } catch (e) {}
}

// Cache configuration for instant 0ms rendering
const CACHE_KEY = 'dq_stock_cache_v2';

function loadCachedState() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return false;
    const cached = JSON.parse(raw);
    if (cached && Array.isArray(cached.products) && cached.products.length > 0) {
      state.products = cached.products;
      state.batches = cached.batches || [];
      state.alerts = cached.alerts || state.alerts;
      state.usageLogs = cached.usageLogs || [];
      state.usageSummary = cached.usageSummary || [];
      state.settings = cached.settings || {};
      state.recipients = cached.recipients || [];
      renderAll();
      populateSettingsForm();
      return true;
    }
  } catch (e) {
    console.warn('Failed to load local cache:', e);
  }
  return false;
}

function saveStateToCache() {
  try {
    const toCache = {
      products: state.products,
      batches: state.batches,
      alerts: state.alerts,
      usageLogs: state.usageLogs,
      usageSummary: state.usageSummary,
      settings: state.settings,
      recipients: state.recipients,
      updated_at: Date.now()
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(toCache));
  } catch (e) {
    // Ignore storage quota limits
  }
}

// Initialize app on DOM loaded
document.addEventListener('DOMContentLoaded', async () => {
  if (window.lucide) lucide.createIcons();
  
  // Set default dates in inputs
  const today = new Date().toISOString().split('T')[0];
  const usageDateEl = document.getElementById('usage-date');
  if (usageDateEl) usageDateEl.value = today;
  const batchReceivedEl = document.getElementById('batch-received');
  if (batchReceivedEl) batchReceivedEl.value = today;

  // 1. Instant 0ms Render from LocalStorage Cache
  const hadCache = loadCachedState();

  // 2. Refresh fresh server data in background
  await loadAllData();
});

// Load all data from API (High speed 1-roundtrip bootstrap)
async function loadAllData() {
  const statusEl = document.getElementById('connection-status');
  try {
    const res = await fetch('/api/bootstrap');
    if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);
    const json = await res.json();
    if (json.success && json.data) {
      state.products = json.data.products || [];
      state.batches = json.data.batches || [];
      state.receivingHistory = json.data.receivingHistory || [];
      state.alerts = json.data.alerts || { low_stock_items: [], expiring_batches: [], expired_batches: [] };
      state.usageLogs = json.data.usageLogs || [];
      state.usageSummary = json.data.usageSummary || [];
      state.settings = json.data.settings || {};
      state.recipients = json.data.recipients || [];

      renderAll();
      populateSettingsForm();
      saveStateToCache();

      if (statusEl) {
        statusEl.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500"></span><span>ข้อมูลล่าสุด</span>';
      }
    } else {
      throw new Error(json.error || 'Failed to parse bootstrap data');
    }
  } catch (err) {
    console.warn('Bootstrap API failed, falling back to legacy multi-fetch:', err.message);
    await fallbackLoadAllData();
  }
}

// Fallback to separate endpoints if /api/bootstrap ever fails
async function fallbackLoadAllData() {
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
    saveStateToCache();
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

  if (tabName === 'usage') {
    switchUsageSubTab(state.historySubTab || 'inbound');
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
  renderReceivingHistoryTable();
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

  const totalEl = document.getElementById('stat-total-products');
  if (totalEl) totalEl.textContent = totalProds;
  const lowEl = document.getElementById('stat-low-stock');
  if (lowEl) lowEl.textContent = lowStockCount;
  const expEl = document.getElementById('stat-expiring-soon');
  if (expEl) expEl.textContent = expiringCount;
  const expdEl = document.getElementById('stat-expired');
  if (expdEl) expdEl.textContent = expiredCount;

  const lowBadge = document.getElementById('low-stock-badge-count');
  if (lowBadge) lowBadge.textContent = `${lowStockCount} รายการ`;
  const expBadge = document.getElementById('expiring-badge-count');
  if (expBadge) expBadge.textContent = `${expiringCount + expiredCount} รายการ`;
}

// 2. Render Urgent Alert Lists on Dashboard with Sorting & Timestamps
function changeLowStockSort(sortType) {
  playTapFeedback('click');
  state.lowStockSort = sortType;
  localStorage.setItem('dq_lowstock_sort', sortType);
  renderAlertLists();
}

function changeExpiringSort(sortType) {
  playTapFeedback('click');
  state.expiringSort = sortType;
  localStorage.setItem('dq_expiring_sort', sortType);
  renderAlertLists();
}

function renderAlertLists() {
  // Sync dropdowns
  const selLow = document.getElementById('sort-low-stock');
  if (selLow && selLow.value !== (state.lowStockSort || 'URGENCY_DESC')) {
    selLow.value = state.lowStockSort || 'URGENCY_DESC';
  }
  const selExp = document.getElementById('sort-expiring');
  if (selExp && selExp.value !== (state.expiringSort || 'EXPIRY_ASC')) {
    selExp.value = state.expiringSort || 'EXPIRY_ASC';
  }

  // 1. Low stock items
  const lowStockContainer = document.getElementById('low-stock-list');
  if (state.alerts.low_stock_items.length === 0) {
    lowStockContainer.innerHTML = `
      <div class="p-6 text-center text-slate-400 text-xs">
        <i data-lucide="check-circle" class="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80"></i>
        <p>สต็อกสินค้าทุกรายการอยู่ในระดับปลอดภัย (ปกติ)</p>
      </div>
    `;
  } else {
    const lowSort = state.lowStockSort || 'URGENCY_DESC';
    const lowItems = [...state.alerts.low_stock_items];
    lowItems.sort((a, b) => {
      if (lowSort === 'URGENCY_DESC') {
        const ratioA = Number(a.safety_stock) > 0 ? Number(a.current_stock) / Number(a.safety_stock) : (Number(a.current_stock) === 0 ? 0 : 1);
        const ratioB = Number(b.safety_stock) > 0 ? Number(b.current_stock) / Number(b.safety_stock) : (Number(b.current_stock) === 0 ? 0 : 1);
        return ratioA - ratioB;
      }
      if (lowSort === 'UPDATED_DESC') {
        const timeA = new Date(a.last_updated_at || a.updated_at || a.created_at || 0).getTime();
        const timeB = new Date(b.last_updated_at || b.updated_at || b.created_at || 0).getTime();
        return timeB - timeA;
      }
      if (lowSort === 'NAME_ASC') {
        return a.name.localeCompare(b.name, 'th');
      }
      if (lowSort === 'STOCK_ASC') {
        return Number(a.current_stock) - Number(b.current_stock);
      }
      return 0;
    });

    lowStockContainer.innerHTML = lowItems.map(item => `
      <div class="p-3 hover:bg-slate-50 flex items-center justify-between transition">
        <div class="flex items-center space-x-3">
          <div class="w-1.5 h-10 bg-rose-600 rounded-full"></div>
          <div>
            <div class="flex items-center space-x-2">
              <button type="button" onclick="openProductDetailModal(${item.id})" class="text-left font-bold text-slate-900 hover:text-rose-600 flex items-center space-x-1 group transition" title="ดูรายละเอียดสินค้า">
                <span class="group-hover:underline">${item.name}</span>
                <i data-lucide="info" class="w-3 h-3 text-slate-400 group-hover:text-rose-600 transition"></i>
              </button>
              <span class="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">${item.category}</span>
            </div>
            <p class="text-[11px] text-slate-500">
              Safety: <span class="font-semibold text-slate-700">${item.safety_stock} ${item.unit}</span>
              <span class="text-slate-300 mx-1">•</span>
              <span class="text-slate-400" title="แก้ไขล่าสุด: ${formatFullDateTime(item.last_updated_at || item.updated_at || item.created_at)}">🕒 แก้ ${formatRelativeTime(item.last_updated_at || item.updated_at || item.created_at)}</span>
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

  // 2. Expiring items
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
    const expSort = state.expiringSort || 'EXPIRY_ASC';
    allExpiring.sort((a, b) => {
      if (expSort === 'EXPIRY_ASC') {
        return (a.days_until_expiry ?? 999) - (b.days_until_expiry ?? 999);
      }
      if (expSort === 'DATE_DESC') {
        const timeA = new Date(a.received_date || a.created_at || 0).getTime();
        const timeB = new Date(b.received_date || b.created_at || 0).getTime();
        return timeB - timeA;
      }
      if (expSort === 'NAME_ASC') {
        const nameA = a.product_name || a.name || '';
        const nameB = b.product_name || b.name || '';
        return nameA.localeCompare(nameB, 'th');
      }
      if (expSort === 'QTY_DESC') {
        return Number(b.quantity) - Number(a.quantity);
      }
      return 0;
    });

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
                <button type="button" onclick="openProductDetailModal(${b.product_id || b.id})" class="text-left font-bold text-slate-900 hover:text-amber-700 flex items-center space-x-1 group transition" title="ดูรายละเอียดสินค้า">
                  <span class="group-hover:underline">${b.product_name || b.name}</span>
                  <i data-lucide="info" class="w-3 h-3 text-slate-400 group-hover:text-amber-700 transition"></i>
                </button>
                <span class="text-[10px] text-slate-500 font-mono">ล็อต ${b.lot_number || '-'}</span>
              </div>
              <p class="text-[11px] text-slate-500">
                หมดอายุ: <span class="font-medium text-slate-700">${b.expiry_date}</span> · เหลือ: ${b.quantity} ${b.unit || ''}
                <span class="text-slate-300 mx-1">•</span>
                <span class="text-slate-400" title="รับเข้าเมื่อ: ${formatFullDateTime(b.created_at)}">📅 รับ ${b.received_date || '-'}</span>
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
  if (window.lucide) lucide.createIcons();
}

// 3. Render Live LINE Flex Preview Card (Matches the Reference Photo!)
function renderLineFlexPreview() {
  const itemsContainer = document.getElementById('preview-flex-items');
  const subtitleEl = document.getElementById('preview-flex-subtitle');
  if (!itemsContainer) return;
  const items = (state.alerts && state.alerts.low_stock_items) ? state.alerts.low_stock_items : [];

  if (subtitleEl) subtitleEl.textContent = `พบ ${items.length} รายการที่ต่ำกว่า Safety Stock`;

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

// =======================================================
// ONE-CLICK ORDER LIST ENGINE (Feature 1)
// =======================================================
function getOrderItems() {
  const lowItems = (state.alerts && state.alerts.low_stock_items && state.alerts.low_stock_items.length > 0)
    ? state.alerts.low_stock_items 
    : state.products.filter(p => p.is_low_stock);

  return lowItems.map(item => {
    const safety = Number(item.safety_stock || 1);
    const cur = Number(item.current_stock || 0);
    // Suggest ordering to bring stock up to double safety stock (at least 1 unit)
    const suggested = Math.max(1, (safety * 2) - cur);
    return {
      ...item,
      order_qty: suggested
    };
  });
}

function formatOrderListText(items) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const webUrl = window.location.origin;

  let text = `🛒 ใบสั่งของ / สรุปรายการสั่งซื้อวัตถุดิบ DQ SAT\n`;
  text += `📅 ประจำวันที่: ${dateStr} เวลา ${timeStr} น.\n`;
  text += `----------------------------------------\n`;

  if (!items || items.length === 0) {
    text += `🎉 สต็อกสินค้าทุกรายการเพียงพอ ไม่มีของที่ต้องสั่งเพิ่ม\n`;
  } else {
    items.forEach((it, idx) => {
      text += `${idx + 1}. ${it.name} (${it.category || 'วัตถุดิบ'})\n`;
      text += `   👉 สั่งเพิ่ม: ${it.order_qty} ${it.unit} (คงเหลือ: ${it.current_stock} | จุดเตือน: ${it.safety_stock})\n`;
    });
    text += `----------------------------------------\n`;
    text += `รวมรายการสั่งซื้อทั้งหมด: ${items.length} รายการ\n`;
  }

  text += `🌐 ตรวจเช็คสต็อกหน้าร้าน: ${webUrl}`;
  return text;
}

async function copyOrderListToClipboard() {
  playTapFeedback('click');
  const items = getOrderItems();
  if (items.length === 0) {
    showToast('ไม่มีรายการสินค้าที่ต่ำกว่า Safety Stock ในขณะนี้');
    return;
  }
  const text = formatOrderListText(items);
  try {
    await navigator.clipboard.writeText(text);
    playTapFeedback('save');
    showToast(`📋 คัดลอกรายการสั่งของ ${items.length} รายการสำเร็จ! วางใน LINE ได้ทันที`);
  } catch (err) {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    playTapFeedback('save');
    showToast(`📋 คัดลอกรายการสั่งของ ${items.length} รายการสำเร็จ!`);
  }
}

async function triggerSendOrderReport() {
  playTapFeedback('click');
  const items = getOrderItems();
  if (items.length === 0) {
    showToast('ไม่มีรายการสินค้าที่ต่ำกว่า Safety Stock ในขณะนี้');
    return;
  }

  showToast('⏳ กำลังส่งสรุปรายการสั่งของเข้า LINE กลุ่ม...');
  try {
    const res = await fetch('/api/line/order-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items,
        app_url: window.location.origin
      })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);
    playTapFeedback('save');
    showToast(`📲 ส่งรายการสั่งของ ${items.length} รายการเข้า LINE สำเร็จ!`);
  } catch (err) {
    playTapFeedback('alert');
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
}

function openOrderModal() {
  playTapFeedback('click');
  renderOrderModal();
  openDialog('modal-order-summary');
}

function renderOrderModal() {
  const items = getOrderItems();
  const container = document.getElementById('order-modal-items');
  const countEl = document.getElementById('order-list-count');
  if (countEl) countEl.textContent = items.length;

  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-slate-400 text-xs">
        <i data-lucide="check-circle" class="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80"></i>
        <p>ไม่มีสินค้าที่ต่ำกว่า Safety Stock สต็อกเพียงพอทุกรายการ</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = items.map((it, idx) => `
    <div class="p-2.5 bg-white rounded-xl flex items-center justify-between border border-slate-100 shadow-2xs">
      <div class="flex items-center space-x-2.5">
        <span class="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold text-[11px] flex items-center justify-center shrink-0">${idx + 1}</span>
        <div>
          <div class="font-bold text-slate-900 text-xs">${it.name}</div>
          <div class="text-[10px] text-slate-500">${it.category || 'ทั่วไป'} · เหลือ <span class="font-semibold text-rose-600">${it.current_stock}</span> / เกณฑ์ ${it.safety_stock} ${it.unit}</div>
        </div>
      </div>
      <div class="flex items-center space-x-1.5">
        <span class="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
          +${it.order_qty} ${it.unit}
        </span>
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

// =======================================================
// SHELF & CATEGORY FILTERING (Feature 2)
// =======================================================
function setCategoryFilter(category) {
  playTapFeedback('click');
  const catSelect = document.getElementById('filter-category');
  if (catSelect) catSelect.value = category;
  updateShelfChipsActive(category);
  filterInventory();
}

function updateShelfChipsActive(activeCat) {
  const shelfChipMap = {
    'ALL': 'shelf-chip-all',
    'แก้ว & ฝา': 'shelf-chip-cups',
    'ช้อน & หลอด & หีบห่อ': 'shelf-chip-pack',
    'ท็อปปิ้ง & วัตถุดิบ': 'shelf-chip-topping',
    'ซอส & เครื่องดื่ม': 'shelf-chip-sauce',
    'อุปกรณ์ & ของใช้': 'shelf-chip-tools'
  };

  document.querySelectorAll('.shelf-chip').forEach(btn => {
    btn.className = 'shelf-chip px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition active:scale-95';
  });

  const targetId = shelfChipMap[activeCat];
  const targetEl = document.getElementById(targetId);
  if (targetEl) {
    targetEl.className = 'shelf-chip px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white shadow-xs transition active:scale-95';
  } else {
    const allEl = document.getElementById('shelf-chip-all');
    if (allEl && activeCat === 'ALL') {
      allEl.className = 'shelf-chip px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-900 text-white shadow-xs transition active:scale-95';
    }
  }
}

function filterInventory() {
  renderInventoryTable();
}

function formatRelativeTime(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '-';
  const diffSec = Math.round((Date.now() - d.getTime()) / 1000);
  if (diffSec < 45) return 'เมื่อสักครู่';
  if (diffSec < 3600) return `${Math.max(1, Math.floor(diffSec / 60))} นาทีที่แล้ว`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} ชม. ที่แล้ว`;
  if (diffSec < 172800) return 'เมื่อวานนี้';
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
}

function formatDateOnly(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' });
}

function formatFullDateTime(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('th-TH', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) + ' น.';
}

function changeInventorySort(sortType) {
  playTapFeedback('click');
  state.inventorySort = sortType;
  localStorage.setItem('dq_inventory_sort', sortType);
  const sel = document.getElementById('sort-inventory');
  if (sel && sel.value !== sortType) {
    sel.value = sortType;
  }
  renderInventoryTable();
}

function toggleSortHeader(field) {
  playTapFeedback('click');
  const current = state.inventorySort || 'UPDATED_DESC';
  let next = 'UPDATED_DESC';

  if (field === 'UPDATED') {
    if (current === 'UPDATED_DESC') next = 'CREATED_DESC';
    else if (current === 'CREATED_DESC') next = 'UPDATED_ASC';
    else if (current === 'UPDATED_ASC') next = 'CREATED_ASC';
    else next = 'UPDATED_DESC';
  } else if (field === 'NAME') {
    next = current === 'NAME_ASC' ? 'NAME_DESC' : 'NAME_ASC';
  } else if (field === 'STOCK') {
    next = current === 'STOCK_ASC' ? 'STOCK_DESC' : 'STOCK_ASC';
  } else if (field === 'EXPIRY') {
    next = current === 'EXPIRY_ASC' ? 'UPDATED_DESC' : 'EXPIRY_ASC';
  }
  changeInventorySort(next);
}

// Inbound History Sorting
function changeInboundSort(sortType) {
  playTapFeedback('click');
  state.inboundSort = sortType;
  localStorage.setItem('dq_inbound_sort', sortType);
  const sel = document.getElementById('sort-inbound');
  if (sel && sel.value !== sortType) sel.value = sortType;
  renderReceivingHistoryTable();
}

function toggleInboundSortHeader(field) {
  playTapFeedback('click');
  const current = state.inboundSort || 'DATE_DESC';
  let next = 'DATE_DESC';

  if (field === 'DATE') {
    next = current === 'DATE_DESC' ? 'DATE_ASC' : 'DATE_DESC';
  } else if (field === 'NAME') {
    next = current === 'NAME_ASC' ? 'NAME_DESC' : 'NAME_ASC';
  } else if (field === 'QTY') {
    next = current === 'QTY_DESC' ? 'QTY_ASC' : 'QTY_DESC';
  } else if (field === 'EXPIRY') {
    next = current === 'EXPIRY_ASC' ? 'EXPIRY_DESC' : 'EXPIRY_ASC';
  }
  changeInboundSort(next);
}

// Outbound History Sorting
function changeOutboundSort(sortType) {
  playTapFeedback('click');
  state.outboundSort = sortType;
  localStorage.setItem('dq_outbound_sort', sortType);
  const sel = document.getElementById('sort-outbound');
  if (sel && sel.value !== sortType) sel.value = sortType;
  renderUsageHistoryTable();
}

function toggleOutboundSortHeader(field) {
  playTapFeedback('click');
  const current = state.outboundSort || 'DATE_DESC';
  let next = 'DATE_DESC';

  if (field === 'DATE') {
    next = current === 'DATE_DESC' ? 'DATE_ASC' : 'DATE_DESC';
  } else if (field === 'NAME') {
    next = current === 'NAME_ASC' ? 'NAME_DESC' : 'NAME_ASC';
  } else if (field === 'QTY') {
    next = current === 'QTY_DESC' ? 'QTY_ASC' : 'QTY_DESC';
  } else if (field === 'USER') {
    next = current === 'USER_ASC' ? 'DATE_DESC' : 'USER_ASC';
  }
  changeOutboundSort(next);
}

// Planning Table Sorting
function togglePlanningSortHeader(field) {
  playTapFeedback('click');
  const current = state.planningSort || 'DAYS_ASC';
  let next = 'DAYS_ASC';

  if (field === 'DAYS') {
    next = current === 'DAYS_ASC' ? 'DAYS_DESC' : 'DAYS_ASC';
  } else if (field === 'NAME') {
    next = current === 'NAME_ASC' ? 'DAYS_ASC' : 'NAME_ASC';
  } else if (field === 'STOCK') {
    next = current === 'STOCK_ASC' ? 'STOCK_DESC' : 'STOCK_ASC';
  } else if (field === 'USED') {
    next = current === 'USED_DESC' ? 'DAYS_ASC' : 'USED_DESC';
  }
  state.planningSort = next;
  localStorage.setItem('dq_planning_sort', next);
  renderPlanningTable();
}

// Batch Manager Modal Sorting
function changeBatchModalSort(sortType) {
  playTapFeedback('click');
  state.batchModalSort = sortType;
  const sel = document.getElementById('sort-batch-modal');
  if (sel && sel.value !== sortType) sel.value = sortType;
  renderBatchModalItems();
}

function setInventoryFilter(filter) {
  playTapFeedback('click');
  state.inventoryFilter = filter;
  renderInventoryTable();
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

  const btnInvOrder = document.getElementById('btn-inventory-order-count');
  if (btnInvOrder) btnInvOrder.textContent = lowCount;

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

  // Extract unique categories & update dropdown
  const categories = [...new Set(state.products.map(p => p.category).filter(Boolean))];
  const catSelect = document.getElementById('filter-category');
  if (catSelect) {
    const prevVal = catSelect.value || selectedCat;
    catSelect.innerHTML = '<option value="ALL">ทุกหมวดหมู่ (54)</option>';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      catSelect.appendChild(opt);
    });
    if (categories.includes(prevVal) || prevVal === 'ALL') {
      catSelect.value = prevVal;
    }
    updateShelfChipsActive(catSelect.value);
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

  // Sync sort dropdown if present
  const sortSelect = document.getElementById('sort-inventory');
  if (sortSelect && sortSelect.value !== (state.inventorySort || 'UPDATED_DESC')) {
    sortSelect.value = state.inventorySort || 'UPDATED_DESC';
  }

  // Sort filtered products (Default: UPDATED_DESC)
  const sortBy = state.inventorySort || 'UPDATED_DESC';
  filtered.sort((a, b) => {
    if (sortBy === 'UPDATED_DESC') {
      const timeA = new Date(a.last_updated_at || a.updated_at || a.created_at || 0).getTime();
      const timeB = new Date(b.last_updated_at || b.updated_at || b.created_at || 0).getTime();
      return timeB - timeA;
    }
    if (sortBy === 'UPDATED_ASC') {
      const timeA = new Date(a.last_updated_at || a.updated_at || a.created_at || 0).getTime();
      const timeB = new Date(b.last_updated_at || b.updated_at || b.created_at || 0).getTime();
      return timeA - timeB;
    }
    if (sortBy === 'NAME_ASC') {
      return a.name.localeCompare(b.name, 'th');
    }
    if (sortBy === 'NAME_DESC') {
      return b.name.localeCompare(a.name, 'th');
    }
    if (sortBy === 'CREATED_DESC') {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeB - timeA;
    }
    if (sortBy === 'CREATED_ASC') {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeA - timeB;
    }
    if (sortBy === 'EXPIRY_ASC') {
      if (a.days_until_expiry === null && b.days_until_expiry === null) return 0;
      if (a.days_until_expiry === null) return 1;
      if (b.days_until_expiry === null) return -1;
      return a.days_until_expiry - b.days_until_expiry;
    }
    if (sortBy === 'STOCK_ASC') {
      return Number(a.current_stock) - Number(b.current_stock);
    }
    if (sortBy === 'STOCK_DESC') {
      return Number(b.current_stock) - Number(a.current_stock);
    }
    return 0;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-8 text-center text-slate-400">
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
          <button type="button" onclick="openProductDetailModal('${p.id}')" class="text-left font-bold text-slate-900 hover:text-indigo-600 flex items-center space-x-1.5 group transition" title="คลิกเพื่อดูรายละเอียดสินค้าและประวัติย้อนหลัง">
            <span class="group-hover:underline text-xs">${p.name}</span>
            <i data-lucide="info" class="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition"></i>
          </button>
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
        <td class="p-3.5 whitespace-nowrap">
          <div class="flex flex-col space-y-0.5">
            <div class="flex items-center space-x-1.5 text-slate-700 font-semibold text-xs" title="แก้ไขล่าสุด: ${formatFullDateTime(p.last_updated_at || p.updated_at || p.created_at)}">
              <i data-lucide="clock" class="w-3.5 h-3.5 text-indigo-500"></i>
              <span>${formatRelativeTime(p.last_updated_at || p.updated_at || p.created_at)}</span>
            </div>
            <div class="text-[10px] text-slate-400 flex items-center space-x-1" title="วันที่สร้าง: ${formatFullDateTime(p.created_at)}">
              <i data-lucide="calendar-plus" class="w-3 h-3 text-slate-400"></i>
              <span>สร้าง ${formatDateOnly(p.created_at)}</span>
            </div>
          </div>
        </td>
        <td class="p-3.5">${statusBadge}</td>
        <td class="p-3.5 text-center">
          <div class="flex items-center justify-center space-x-1">
            <button onclick="openProductDetailModal('${p.id}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-lg flex items-center space-x-1 transition" title="ดูรายละเอียดสินค้า">
              <i data-lucide="info" class="w-3.5 h-3.5 text-slate-500"></i>
              <span>ดูข้อมูล</span>
            </button>
            <button onclick="openQuickUpdateModal('${p.id}')" class="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs rounded-lg flex items-center space-x-1 shadow-2xs transition" title="อัปเดตด่วน สต็อก & วันหมดอายุ">
              <i data-lucide="zap" class="w-3.5 h-3.5"></i>
              <span>อัปเดต</span>
            </button>
            <button onclick="openManageBatchesModal('${p.id}')" class="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-xs rounded-lg flex items-center space-x-1 border border-indigo-200 transition" title="จัดการทุกล็อตของสินค้า">
              <i data-lucide="layers" class="w-3.5 h-3.5"></i>
              <span>ล็อต (${p.batch_count || 0})</span>
            </button>
            <button onclick="openEditProductModal('${p.id}')" title="แก้ไขข้อมูลสินค้า" class="p-1.5 hover:bg-slate-100 text-slate-500 rounded-md transition">
              <i data-lucide="edit-3" class="w-4 h-4"></i>
            </button>
            <button onclick="handleDeleteProduct('${p.id}')" title="ลบสินค้า" class="p-1.5 hover:bg-rose-50 text-rose-500 rounded-md transition">
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
                <button type="button" onclick="openProductDetailModal('${p.id}')" class="text-left font-extrabold text-slate-900 text-sm leading-snug hover:text-indigo-600 flex items-center space-x-1 transition">
                  <span>${p.name}</span>
                  <i data-lucide="info" class="w-3.5 h-3.5 text-slate-400"></i>
                </button>
                <div class="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span class="inline-block text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">${p.category}</span>
                  <span class="text-[10px] text-slate-600 font-medium flex items-center space-x-1" title="แก้ไขล่าสุด: ${formatFullDateTime(p.last_updated_at || p.updated_at || p.created_at)}">
                    <i data-lucide="clock" class="w-3 h-3 text-indigo-500"></i>
                    <span>แก้ ${formatRelativeTime(p.last_updated_at || p.updated_at || p.created_at)}</span>
                  </span>
                  <span class="text-slate-300">•</span>
                  <span class="text-[10px] text-slate-400" title="วันที่สร้าง: ${formatFullDateTime(p.created_at)}">สร้าง ${formatDateOnly(p.created_at)}</span>
                </div>
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

            <!-- Primary Thumb Action Button -->
            <button onclick="openQuickUpdateModal('${p.id}')" class="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-xs rounded-2xl shadow-xs flex items-center justify-center space-x-2 transition">
              <i data-lucide="zap" class="w-4 h-4"></i>
              <span>⚡ แตะเพื่อกรอกวันหมดอายุ & สต็อก</span>
            </button>

            <!-- Secondary Actions: Full CRUD on Mobile (Edit / Batches / Delete) -->
            <div class="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-100 text-xs">
              <button onclick="openEditProductModal('${p.id}')" class="py-2 px-1 bg-slate-50 active:bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-semibold flex items-center justify-center space-x-1 transition shadow-2xs">
                <i data-lucide="edit-3" class="w-3.5 h-3.5 text-slate-500"></i>
                <span class="text-[11px]">แก้ไข</span>
              </button>
              <button onclick="openManageBatchesModal('${p.id}')" class="py-2 px-1 bg-indigo-50 active:bg-indigo-100 border border-indigo-200 rounded-xl text-indigo-700 font-semibold flex items-center justify-center space-x-1 transition shadow-2xs">
                <i data-lucide="layers" class="w-3.5 h-3.5 text-indigo-600"></i>
                <span class="text-[11px]">ทุกล็อต (${p.batch_count || 0})</span>
              </button>
              <button onclick="handleDeleteProduct('${p.id}')" class="py-2 px-1 bg-rose-50 active:bg-rose-100 border border-rose-200 rounded-xl text-rose-600 font-semibold flex items-center justify-center space-x-1 transition shadow-2xs">
                <i data-lucide="trash-2" class="w-3.5 h-3.5 text-rose-500"></i>
                <span class="text-[11px]">ลบสินค้า</span>
              </button>
            </div>
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
  if (!tbody) return;

  if (!state.usageSummary || state.usageSummary.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="p-8 text-center text-slate-400">ยังไม่มีประวัติการใช้งานบันทึกในระบบ</td>
      </tr>
    `;
    return;
  }

  const planSort = state.planningSort || 'DAYS_ASC';
  const list = [...state.usageSummary];
  list.sort((a, b) => {
    const prodA = state.products.find(p => p.id === a.product_id);
    const prodB = state.products.find(p => p.id === b.product_id);
    const stockA = prodA ? Number(prodA.current_stock) : 0;
    const stockB = prodB ? Number(prodB.current_stock) : 0;
    const daysA = (Number(a.avg_daily_use) > 0) ? Math.floor(stockA / Number(a.avg_daily_use)) : 99999;
    const daysB = (Number(b.avg_daily_use) > 0) ? Math.floor(stockB / Number(b.avg_daily_use)) : 99999;

    if (planSort === 'DAYS_ASC') return daysA - daysB;
    if (planSort === 'DAYS_DESC') return daysB - daysA;
    if (planSort === 'NAME_ASC') return (a.product_name || '').localeCompare(b.product_name || '', 'th');
    if (planSort === 'STOCK_ASC') return stockA - stockB;
    if (planSort === 'STOCK_DESC') return stockB - stockA;
    if (planSort === 'USED_DESC') return Number(b.total_used) - Number(a.total_used);
    return 0;
  });

  tbody.innerHTML = list.map(item => {
    const product = state.products.find(p => p.id === item.product_id);
    const currentStock = product ? product.current_stock : 0;
    const avgDaily = item.avg_daily_use || 0;

    // Last Inbound Date / Activity
    const pBatches = (state.batches || []).filter(b => b.product_id == item.product_id);
    const latestBatch = [...pBatches].sort((x, y) => new Date(y.received_date || y.created_at || 0) - new Date(x.received_date || x.created_at || 0))[0];
    const lastReceived = latestBatch ? (latestBatch.received_date || formatDateOnly(latestBatch.created_at)) : '-';
    const lastUpdated = product?.updated_at ? formatRelativeTime(product.updated_at) : '-';

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
      <tr class="hover:bg-slate-50 border-b border-slate-100 transition">
        <td class="p-3 font-semibold text-slate-800">
          <button type="button" onclick="openProductDetailModal('${item.product_id}')" class="text-left font-bold text-slate-900 hover:text-indigo-600 flex items-center space-x-1.5 group transition" title="คลิกเพื่อดูรายละเอียดสินค้า">
            <span class="group-hover:underline text-xs">${item.product_name}</span>
            <i data-lucide="external-link" class="w-3 h-3 text-slate-400 group-hover:text-indigo-600 transition"></i>
          </button>
          <span class="text-[10px] text-slate-400">${product?.category || ''}</span>
        </td>
        <td class="p-3"><span class="font-bold text-slate-900">${currentStock}</span> <span class="text-slate-500 uppercase text-[11px]">${item.unit}</span></td>
        <td class="p-3 whitespace-nowrap">
          <div class="font-bold text-slate-800 text-xs">${lastReceived}</div>
          <div class="text-[10px] text-slate-400 mt-0.5 flex items-center space-x-1" title="อัปเดตเมื่อ: ${formatFullDateTime(product?.updated_at)}">
            <i data-lucide="clock" class="w-3 h-3 text-slate-400"></i>
            <span>แก้ ${lastUpdated}</span>
          </div>
        </td>
        <td class="p-3 text-slate-600 font-medium">${item.total_used} <span class="text-[10px] uppercase text-slate-400">${item.unit}</span></td>
        <td class="p-3 text-slate-600">${avgDaily} <span class="text-[10px] text-slate-400">${item.unit}/วัน</span></td>
        <td class="p-3 font-medium text-slate-700">${daysRemainingText}</td>
        <td class="p-3">${recommendation}</td>
        <td class="p-3 text-center">
          <button type="button" onclick="openProductDetailModal('${item.product_id}')" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-semibold flex items-center space-x-1 mx-auto transition active:scale-95 shadow-2xs">
            <i data-lucide="info" class="w-3 h-3"></i>
            <span>ดูข้อมูล</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

// 5.1 Switch Dual History & Planning Sub-Tabs (Inbound vs Outbound vs Planning)
function switchUsageSubTab(tab) {
  state.historySubTab = tab;
  const btnInbound = document.getElementById('subtab-main-inbound') || document.getElementById('subtab-inbound');
  const btnOutbound = document.getElementById('subtab-main-outbound') || document.getElementById('subtab-outbound');
  const btnPlanning = document.getElementById('subtab-main-planning');
  const viewInbound = document.getElementById('history-view-inbound');
  const viewOutbound = document.getElementById('history-view-outbound');
  const viewPlanning = document.getElementById('history-view-planning');

  const inactiveBtn = 'px-4 py-2 rounded-lg text-slate-600 hover:text-slate-900 transition flex items-center space-x-1.5 whitespace-nowrap active:scale-95';
  if (btnInbound) btnInbound.className = inactiveBtn;
  if (btnOutbound) btnOutbound.className = inactiveBtn;
  if (btnPlanning) btnPlanning.className = inactiveBtn;

  if (viewInbound) viewInbound.classList.add('hidden');
  if (viewOutbound) viewOutbound.classList.add('hidden');
  if (viewPlanning) viewPlanning.classList.add('hidden');

  if (tab === 'inbound') {
    if (btnInbound) btnInbound.className = 'px-4 py-2 rounded-lg bg-emerald-600 text-white shadow-xs transition flex items-center space-x-1.5 whitespace-nowrap active:scale-95';
    if (viewInbound) viewInbound.classList.remove('hidden');
  } else if (tab === 'outbound') {
    if (btnOutbound) btnOutbound.className = 'px-4 py-2 rounded-lg bg-amber-600 text-white shadow-xs transition flex items-center space-x-1.5 whitespace-nowrap active:scale-95';
    if (viewOutbound) viewOutbound.classList.remove('hidden');
  } else if (tab === 'planning') {
    if (btnPlanning) btnPlanning.className = 'px-4 py-2 rounded-lg bg-blue-600 text-white shadow-xs transition flex items-center space-x-1.5 whitespace-nowrap active:scale-95';
    if (viewPlanning) viewPlanning.classList.remove('hidden');
  }
  if (window.lucide) lucide.createIcons();
}

function switchHistoryTab(tab) {
  switchUsageSubTab(tab);
}

// 5.2 Render Inbound Receiving History Table (ตรวจเช็ค & ลบ/แก้ รายการรับเข้า)
function renderReceivingHistoryTable() {
  const tbody = document.getElementById('receiving-history-table-body');
  const mobileContainer = document.getElementById('receiving-history-mobile-cards');
  const countEl = document.getElementById('inbound-history-count');

  // Sync dropdown
  const selIn = document.getElementById('sort-inbound');
  if (selIn && selIn.value !== (state.inboundSort || 'DATE_DESC')) {
    selIn.value = state.inboundSort || 'DATE_DESC';
  }

  const inboundSort = state.inboundSort || 'DATE_DESC';
  const list = [...(state.receivingHistory || [])];
  list.sort((a, b) => {
    if (inboundSort === 'DATE_DESC') {
      const timeA = new Date(a.received_date || a.created_at || 0).getTime();
      const timeB = new Date(b.received_date || b.created_at || 0).getTime();
      return timeB - timeA;
    }
    if (inboundSort === 'DATE_ASC') {
      const timeA = new Date(a.received_date || a.created_at || 0).getTime();
      const timeB = new Date(b.received_date || b.created_at || 0).getTime();
      return timeA - timeB;
    }
    if (inboundSort === 'EXPIRY_ASC') {
      const expA = a.expiry_date ? new Date(a.expiry_date).getTime() : 9999999999999;
      const expB = b.expiry_date ? new Date(b.expiry_date).getTime() : 9999999999999;
      return expA - expB;
    }
    if (inboundSort === 'EXPIRY_DESC') {
      const expA = a.expiry_date ? new Date(a.expiry_date).getTime() : 0;
      const expB = b.expiry_date ? new Date(b.expiry_date).getTime() : 0;
      return expB - expA;
    }
    if (inboundSort === 'NAME_ASC') {
      return (a.product_name || '').localeCompare(b.product_name || '', 'th');
    }
    if (inboundSort === 'NAME_DESC') {
      return (b.product_name || '').localeCompare(a.product_name || '', 'th');
    }
    if (inboundSort === 'QTY_DESC') {
      return Number(b.initial_quantity || b.quantity) - Number(a.initial_quantity || a.quantity);
    }
    if (inboundSort === 'QTY_ASC') {
      return Number(a.initial_quantity || a.quantity) - Number(b.initial_quantity || b.quantity);
    }
    return 0;
  });

  if (countEl) countEl.textContent = list.length;

  if (list.length === 0) {
    const emptyHtml = `
      <tr>
        <td colspan="8" class="p-8 text-center text-slate-400">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
          <p class="font-medium text-slate-600">ยังไม่มีประวัติการรับของเข้าสต็อก</p>
          <p class="text-[11px] text-slate-400 mt-0.5">เมื่อรับของเข้าผ่านเว็บหรือพิมพ์ใน LINE เช่น "รับ coke 24" รายการจะแสดงที่นี่</p>
        </td>
      </tr>
    `;
    if (tbody) tbody.innerHTML = emptyHtml;
    if (mobileContainer) {
      mobileContainer.innerHTML = `
        <div class="p-8 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
          <p class="font-medium text-slate-600">ยังไม่มีประวัติการรับของเข้าสต็อก</p>
        </div>
      `;
    }
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Desktop Table Rows
  if (tbody) {
    tbody.innerHTML = list.map(b => {
      const isLine = (b.notes || '').includes('LINE');
      const sourceBadge = isLine 
        ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">📲 LINE</span>`
        : `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">💻 Web</span>`;

      const expBadge = b.is_expired
        ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">หมดอายุ</span>`
        : (b.is_expiring_soon
          ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">อีก ${b.days_until_expiry} วัน</span>`
          : `<span class="text-slate-600 text-xs">${b.expiry_date || '-'}</span>`);

      const initialQty = b.initial_quantity || b.quantity;

      return `
        <tr class="hover:bg-slate-50/80 border-b border-slate-100 transition">
          <td class="p-3 text-slate-700 text-xs whitespace-nowrap">
            <div class="font-bold text-slate-900">📅 ${b.received_date || formatDateOnly(b.created_at) || '-'}</div>
            <div class="text-[10px] text-slate-400 flex items-center space-x-1 mt-0.5" title="บันทึกเมื่อ: ${formatFullDateTime(b.created_at)}">
              <i data-lucide="clock" class="w-3 h-3 text-slate-400"></i>
              <span>${formatRelativeTime(b.created_at)}</span>
              <span class="text-slate-300">•</span>
              <span>${b.created_at ? new Date(b.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : ''}</span>
            </div>
          </td>
          <td class="p-3">
            <button type="button" onclick="openProductDetailModal('${b.product_id}')" class="text-left font-bold text-slate-900 hover:text-emerald-700 flex items-center space-x-1.5 group transition" title="คลิกเพื่อดูรายละเอียดสินค้าและประวัติย้อนหลัง">
              <span class="group-hover:underline text-xs">${b.product_name}</span>
              <i data-lucide="external-link" class="w-3 h-3 text-slate-400 group-hover:text-emerald-700 transition"></i>
            </button>
            <span class="text-[10px] text-slate-400">${b.category || ''}</span>
          </td>
          <td class="p-3 font-black text-emerald-700 text-sm">
            +${initialQty} <span class="text-[10px] font-normal uppercase text-slate-500">${b.unit}</span>
          </td>
          <td class="p-3 font-bold text-slate-800 text-xs">
            ${b.quantity} <span class="text-[10px] font-normal text-slate-400">${b.unit}</span>
          </td>
          <td class="p-3">
            <div class="font-mono text-xs">${b.expiry_date || '-'}</div>
            <div class="mt-0.5">${expBadge}</div>
          </td>
          <td class="p-3 font-mono text-xs text-slate-500">${b.lot_number || '-'}</td>
          <td class="p-3">
            <div class="mb-1">${sourceBadge}</div>
            <div class="text-[11px] text-slate-600 truncate max-w-[180px]">${b.notes || '-'}</div>
          </td>
          <td class="p-3 text-center">
            <div class="flex items-center justify-center space-x-1">
              <button onclick="openProductDetailModal('${b.product_id}')" title="ดูรายละเอียดสินค้า" class="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition">
                <i data-lucide="info" class="w-4 h-4"></i>
              </button>
              <button onclick="handleEditReceivedBatch('${b.id}', ${b.quantity}, '${b.expiry_date || ''}')" title="แก้ไขจำนวน/วันหมดอายุ" class="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg transition">
                <i data-lucide="edit-3" class="w-4 h-4"></i>
              </button>
              <button onclick="handleDeleteReceivedBatch('${b.id}', '${(b.product_name || '').replace(/'/g, "\\'")}', ${b.quantity}, '${b.unit || 'ชิ้น'}')" title="ลบรายการรับเข้านี้ (ปรับลดยอดสต็อก)" class="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg transition">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Mobile Cards View
  if (mobileContainer) {
    mobileContainer.innerHTML = list.map(b => {
      const isLine = (b.notes || '').includes('LINE');
      const sourceBadge = isLine 
        ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">📲 LINE</span>`
        : `<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">💻 Web</span>`;

      const initialQty = b.initial_quantity || b.quantity;

      return `
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3 text-xs">
          <div class="flex items-start justify-between gap-2">
            <div>
              <button type="button" onclick="openProductDetailModal('${b.product_id}')" class="text-left font-extrabold text-slate-900 text-sm hover:text-emerald-700 transition flex items-center space-x-1" title="คลิกเพื่อดูรายละเอียดสินค้า">
                <span>${b.product_name}</span>
                <i data-lucide="info" class="w-3.5 h-3.5 text-slate-400"></i>
              </button>
              <div class="flex items-center space-x-1.5 mt-0.5 text-slate-400 text-[11px]">
                <span title="บันทึกเมื่อ: ${formatFullDateTime(b.created_at)}">📅 ${b.received_date || '-'} (${formatRelativeTime(b.created_at)})</span>
                <span>•</span>
                <span>${sourceBadge}</span>
              </div>
            </div>
            <div class="text-right">
              <span class="font-black text-emerald-700 text-base">+${initialQty}</span>
              <span class="text-[10px] text-slate-500 uppercase"> ${b.unit}</span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-[11px]">
            <div>
              <span class="text-slate-400">คงเหลือในล็อต:</span>
              <span class="font-bold text-slate-800 ml-1">${b.quantity} ${b.unit}</span>
            </div>
            <div>
              <span class="text-slate-400">วันหมดอายุ:</span>
              <span class="font-bold ${b.is_expired ? 'text-rose-600' : 'text-slate-800'} ml-1">${b.expiry_date || '-'}</span>
            </div>
            <div class="col-span-2 text-slate-500 truncate">
              <span class="text-slate-400">หมายเหตุ:</span> ${b.notes || '-'}
            </div>
          </div>

          <div class="flex items-center justify-end space-x-2 pt-1 border-t border-slate-100">
            <button onclick="handleEditReceivedBatch('${b.id}', ${b.quantity}, '${b.expiry_date || ''}')" class="px-3 py-1.5 bg-slate-100 active:bg-slate-200 text-slate-700 rounded-xl font-semibold text-xs flex items-center space-x-1 transition">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
              <span>แก้ไข</span>
            </button>
            <button onclick="handleDeleteReceivedBatch('${b.id}', '${(b.product_name || '').replace(/'/g, "\\'")}', ${b.quantity}, '${b.unit || 'ชิ้น'}')" class="px-3 py-1.5 bg-rose-50 active:bg-rose-100 text-rose-600 rounded-xl font-semibold text-xs flex items-center space-x-1 transition">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              <span>ลบรายการนี้</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  if (window.lucide) lucide.createIcons();
}

async function handleDeleteReceivedBatch(batchId, prodName, qty, unit) {
  if (!confirm(`ยืนยันการลบรายการรับเข้าของ "${prodName}" จำนวน ${qty} ${unit} หรือไม่?\n\n⚠️ ยอดสต็อกรวมของสินค้านี้จะถูกปรับลดลง ${qty} ${unit} ทันที`)) return;

  try {
    const res = await fetch(`/api/batches/${batchId}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    playTapFeedback('alert');
    showToast(`ลบรายการรับเข้า ${prodName} และปรับสต็อกเรียบร้อยแล้ว`);
    await loadAllData();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
}

async function handleEditReceivedBatch(batchId, currentQty, currentExp) {
  const newQtyStr = prompt(`แก้ไขจำนวนคงเหลือในล็อตนี้ (เดิม: ${currentQty}):`, currentQty);
  if (newQtyStr === null) return;
  const newQty = Number(newQtyStr);
  if (isNaN(newQty) || newQty < 0) {
    alert('กรุณาระบุตัวเลขจำนวนที่ถูกต้อง');
    return;
  }
  const newExp = prompt(`แก้วันหมดอายุ (รูปแบบ YYYY-MM-DD):`, currentExp || '');
  if (newExp === null) return;

  try {
    const res = await fetch(`/api/batches/${batchId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: newQty, expiry_date: newExp.trim() })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    playTapFeedback('save');
    showToast('แก้ไขข้อมูลการรับเข้าสำเร็จ');
    await loadAllData();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
}

// 6. Render Usage History Table with Sorting & Timestamps
function renderUsageHistoryTable() {
  const tbody = document.getElementById('usage-history-table-body');
  if (!tbody) return;

  // Sync dropdown
  const selOut = document.getElementById('sort-outbound');
  if (selOut && selOut.value !== (state.outboundSort || 'DATE_DESC')) {
    selOut.value = state.outboundSort || 'DATE_DESC';
  }

  if (state.usageLogs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-6 text-center text-slate-400">ยังไม่มีประวัติการเบิกใช้</td>
      </tr>
    `;
    return;
  }

  const outboundSort = state.outboundSort || 'DATE_DESC';
  const logs = [...state.usageLogs];
  logs.sort((a, b) => {
    if (outboundSort === 'DATE_DESC') {
      const timeA = new Date(a.used_date || a.created_at || 0).getTime();
      const timeB = new Date(b.used_date || b.created_at || 0).getTime();
      return timeB - timeA;
    }
    if (outboundSort === 'DATE_ASC') {
      const timeA = new Date(a.used_date || a.created_at || 0).getTime();
      const timeB = new Date(b.used_date || b.created_at || 0).getTime();
      return timeA - timeB;
    }
    if (outboundSort === 'NAME_ASC') {
      return (a.product_name || '').localeCompare(b.product_name || '', 'th');
    }
    if (outboundSort === 'NAME_DESC') {
      return (b.product_name || '').localeCompare(a.product_name || '', 'th');
    }
    if (outboundSort === 'QTY_DESC') {
      return Number(b.quantity) - Number(a.quantity);
    }
    if (outboundSort === 'QTY_ASC') {
      return Number(a.quantity) - Number(b.quantity);
    }
    if (outboundSort === 'USER_ASC') {
      return (a.used_by || '').localeCompare(b.used_by || '', 'th');
    }
    return 0;
  });

  const typeLabels = {
    'USE': '<span class="px-2 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 font-medium">เบิกใช้</span>',
    'WASTE': '<span class="px-2 py-0.5 rounded text-[10px] bg-rose-50 text-rose-700 font-medium">ชำรุด/ทิ้ง</span>',
    'ADJUST': '<span class="px-2 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 font-medium">ปรับยอด</span>'
  };

  tbody.innerHTML = logs.map(log => `
    <tr class="hover:bg-slate-50 border-b border-slate-100">
      <td class="p-3 text-slate-700 text-xs whitespace-nowrap">
        <div class="font-bold text-slate-900">${log.used_date}</div>
        <div class="text-[10px] text-slate-400 flex items-center space-x-1 mt-0.5" title="บันทึกเมื่อ: ${formatFullDateTime(log.created_at)}">
          <i data-lucide="clock" class="w-3 h-3 text-slate-400"></i>
          <span>${formatRelativeTime(log.created_at)}</span>
          <span class="text-slate-300">•</span>
          <span>${log.created_at ? new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : ''}</span>
        </div>
      </td>
      <td class="p-3 font-bold text-slate-800">
        <button type="button" onclick="openProductDetailModal('${log.product_id}')" class="text-left font-bold text-slate-900 hover:text-amber-700 flex items-center space-x-1.5 group transition" title="คลิกเพื่อดูรายละเอียดสินค้าและประวัติย้อนหลัง">
          <span class="group-hover:underline text-xs">${log.product_name}</span>
          <i data-lucide="external-link" class="w-3 h-3 text-slate-400 group-hover:text-amber-700 transition"></i>
        </button>
      </td>
      <td class="p-3 font-mono text-slate-500">${log.lot_number || 'FIFO (อัตโนมัติ)'}</td>
      <td class="p-3 font-bold text-amber-700">-${log.quantity} ${log.unit}</td>
      <td class="p-3">${typeLabels[log.type] || log.type}</td>
      <td class="p-3 text-slate-600">${log.purpose || log.notes || '-'}</td>
      <td class="p-3 text-slate-500">${log.used_by || '-'}</td>
    </tr>
  `).join('');

  if (window.lucide) lucide.createIcons();
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
function openQuickGuideModal() {
  openDialog('modal-quick-guide');
}

function openAddProductModal() {
  document.getElementById('modal-product-title').textContent = 'เพิ่มสินค้าใหม่';
  document.getElementById('form-product').reset();
  document.getElementById('prod-id').value = '';
  openDialog('modal-product');
}

function openEditProductModal(id) {
  const product = state.products.find(p => p.id == id);
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

// ==============================================================
// MODAL: PRODUCT FULL DETAILS & HISTORY POPUP (ดูรายละเอียดสินค้า & ประวัติย้อนหลัง)
// ==============================================================
let currentDetailProductId = null;
let currentDetailTab = 'batches';

function switchProductDetailTab(tab) {
  currentDetailTab = tab;
  const btnBatches = document.getElementById('detail-tab-btn-batches');
  const btnUsage = document.getElementById('detail-tab-btn-usage');
  const viewBatches = document.getElementById('detail-view-batches');
  const viewUsage = document.getElementById('detail-view-usage');

  if (tab === 'batches') {
    if (btnBatches) btnBatches.className = 'pb-2.5 border-b-2 border-indigo-600 text-indigo-600 flex items-center space-x-1.5 transition font-bold';
    if (btnUsage) btnUsage.className = 'pb-2.5 border-b-2 border-transparent text-slate-400 hover:text-slate-600 flex items-center space-x-1.5 transition font-medium';
    if (viewBatches) viewBatches.classList.remove('hidden');
    if (viewUsage) viewUsage.classList.add('hidden');
  } else {
    if (btnBatches) btnBatches.className = 'pb-2.5 border-b-2 border-transparent text-slate-400 hover:text-slate-600 flex items-center space-x-1.5 transition font-medium';
    if (btnUsage) btnUsage.className = 'pb-2.5 border-b-2 border-amber-600 text-amber-600 flex items-center space-x-1.5 transition font-bold';
    if (viewBatches) viewBatches.classList.add('hidden');
    if (viewUsage) viewUsage.classList.remove('hidden');
  }
  if (window.lucide) lucide.createIcons();
}

async function openProductDetailModal(productId) {
  playTapFeedback('click');
  currentDetailProductId = productId;
  const product = state.products.find(p => p.id == productId);
  if (!product) return;

  // Header & Info
  document.getElementById('product-detail-name').textContent = product.name;
  document.getElementById('product-detail-category').textContent = product.category || 'ทั่วไป';

  // Badges
  const statusEl = document.getElementById('product-detail-status');
  let badges = '';
  if (product.is_expired) {
    badges += `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">🚨 มีล็อตหมดอายุแล้ว</span>`;
  } else if (product.is_expiring_soon) {
    badges += `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">⏳ มีล็อตใกล้หมดอายุ</span>`;
  }
  if (product.is_low_stock) {
    badges += `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">⚠️ ต่ำกว่า Safety Stock</span>`;
  } else {
    badges += `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">✅ สต็อกเพียงพอ</span>`;
  }
  statusEl.innerHTML = badges;

  // 4 Metrics
  document.getElementById('product-detail-stock').innerHTML = `${product.current_stock} <span class="text-xs font-normal text-slate-500 uppercase">${product.unit}</span>`;
  document.getElementById('product-detail-safety').innerHTML = `${product.safety_stock} <span class="text-xs font-normal text-slate-500 uppercase">${product.unit}</span>`;
  
  const expiryText = product.nearest_expiry 
    ? (product.days_until_expiry < 0 
        ? `<span class="text-rose-600 font-bold">หมดอายุแล้ว</span>`
        : `${product.nearest_expiry} <span class="text-[10px] text-slate-400">(${product.days_until_expiry} วัน)</span>`)
    : `<span class="text-slate-400 font-normal">ไม่มีล็อต</span>`;
  document.getElementById('product-detail-expiry').innerHTML = expiryText;

  // Usage 30 Days
  const planInfo = (state.usageSummary || []).find(s => s.product_id == productId);
  if (planInfo && planInfo.total_used > 0) {
    const daysRemaining = (planInfo.avg_daily_use > 0) ? Math.floor(product.current_stock / planInfo.avg_daily_use) : 999;
    document.getElementById('product-detail-usage').innerHTML = `${planInfo.total_used} ${product.unit} <span class="text-[10px] text-slate-400 block font-normal">(เฉลี่ย ${planInfo.avg_daily_use}/วัน • อยู่ได้ ~${daysRemaining} วัน)</span>`;
  } else {
    document.getElementById('product-detail-usage').innerHTML = `0 ${product.unit} <span class="text-[10px] text-slate-400 block font-normal">(ยังไม่มีประวัติใช้ใน 30 วัน)</span>`;
  }

  // Footer Buttons Actions
  const btnAdd = document.getElementById('product-detail-btn-add');
  const btnUse = document.getElementById('product-detail-btn-use');
  const btnEdit = document.getElementById('product-detail-btn-edit');
  if (btnAdd) {
    btnAdd.onclick = () => {
      closeDialog('modal-product-detail');
      openAddBatchModalFor(productId);
    };
  }
  if (btnUse) {
    btnUse.onclick = () => {
      closeDialog('modal-product-detail');
      openRecordUsageModal();
      const sel = document.getElementById('usage-prod-id');
      if (sel) sel.value = productId;
    };
  }
  if (btnEdit) {
    btnEdit.onclick = () => {
      closeDialog('modal-product-detail');
      openEditProductModal(productId);
    };
  }

  // Set active tab
  switchProductDetailTab('batches');
  openDialog('modal-product-detail');

  // Render Batches & Inbound History
  const batchesContainer = document.getElementById('detail-view-batches');
  batchesContainer.innerHTML = `
    <div class="p-6 text-center text-slate-400 text-xs">
      <div class="animate-spin w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
      กำลังดึงประวัติทุกล็อต...
    </div>
  `;

  try {
    const res = await fetch(`/api/products/${productId}/batches`);
    const json = await res.json();
    const batches = json.data || [];

    document.getElementById('product-detail-batches-count').textContent = batches.length;

    if (batches.length === 0) {
      batchesContainer.innerHTML = `
        <div class="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
          <i data-lucide="package-x" class="w-6 h-6 mx-auto mb-1.5 opacity-50"></i>
          <p class="font-medium text-slate-600">ยังไม่มีล็อตในสต็อก (คงเหลือ 0)</p>
          <p class="text-[10px] text-slate-400 mt-0.5">สามารถกดปุ่ม "+ รับเข้าล็อตใหม่" ด้านล่างเพื่อเพิ่มของเข้าได้ทันที</p>
        </div>
      `;
    } else {
      // Sort earliest expiry first
      batches.sort((a, b) => (a.expiry_date || '9999-99-99').localeCompare(b.expiry_date || '9999-99-99'));

      batchesContainer.innerHTML = batches.map((b, idx) => {
        let expBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">ปกติ</span>`;
        if (b.is_expired) {
          expBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">หมดอายุแล้ว</span>`;
        } else if (b.is_expiring_soon) {
          expBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">ใกล้หมด (${b.days_until_expiry} วัน)</span>`;
        }

        const isLine = (b.notes || '').includes('LINE');
        const sourceBadge = isLine 
          ? `<span class="text-[10px] font-bold text-emerald-700">📲 LINE</span>`
          : `<span class="text-[10px] font-semibold text-blue-700">💻 Web</span>`;

        return `
          <div class="p-3 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2 transition">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <span class="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center">${idx + 1}</span>
                <span class="font-mono font-bold text-slate-800 text-xs">${b.lot_number || 'LOT-AUTO'}</span>
                <span class="text-slate-300">•</span>
                ${sourceBadge}
              </div>
              <div>${expBadge}</div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div class="bg-white p-2 rounded-xl border border-slate-200/80">
                <div class="text-[10px] text-slate-400 font-medium">📅 วันที่รับเข้า</div>
                <div class="font-bold text-slate-900 mt-0.5">${b.received_date || formatDateOnly(b.created_at) || '-'}</div>
              </div>
              <div class="bg-white p-2 rounded-xl border border-slate-200/80">
                <div class="text-[10px] text-slate-400 font-medium">⏳ วันหมดอายุ</div>
                <div class="font-bold text-slate-900 mt-0.5">${b.expiry_date || '-'}</div>
              </div>
              <div class="bg-white p-2 rounded-xl border border-slate-200/80 col-span-2 sm:col-span-1">
                <div class="text-[10px] text-slate-400 font-medium">📦 คงเหลือ / รับเข้า</div>
                <div class="font-black text-indigo-700 mt-0.5">${b.quantity} <span class="text-[10px] font-normal text-slate-500">/ ${b.initial_quantity || b.quantity} ${product.unit}</span></div>
              </div>
            </div>

            ${b.notes ? `<div class="text-[10px] text-slate-500 italic">หมายเหตุ: ${b.notes}</div>` : ''}
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    batchesContainer.innerHTML = `<p class="text-rose-500 p-4 text-center text-xs">เกิดข้อผิดพลาด: ${err.message}</p>`;
  }

  // Render Usage Logs for this product
  const usageContainer = document.getElementById('detail-view-usage');
  const productLogs = (state.usageLogs || []).filter(u => u.product_id == productId);
  document.getElementById('product-detail-usage-count').textContent = productLogs.length;

  if (productLogs.length === 0) {
    usageContainer.innerHTML = `
      <div class="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
        <i data-lucide="clipboard-x" class="w-6 h-6 mx-auto mb-1.5 opacity-50"></i>
        <p class="font-medium text-slate-600">ยังไม่มีประวัติการเบิกใช้สินค้านี้</p>
      </div>
    `;
  } else {
    // Sort newest used date first
    productLogs.sort((a, b) => new Date(b.used_date || b.created_at || 0) - new Date(a.used_date || a.created_at || 0));

    usageContainer.innerHTML = productLogs.map(l => {
      const typeBadge = l.type === 'WASTE' 
        ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">ชำรุด/ทิ้ง</span>`
        : (l.type === 'ADJUST' 
            ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">ปรับยอด</span>`
            : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">เบิกใช้</span>`);

      return `
        <div class="p-3 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5 transition">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
              <span class="font-bold text-slate-900">📅 ${l.used_date}</span>
              <span class="text-slate-300">•</span>
              <span class="text-[10px] text-slate-400">${formatRelativeTime(l.created_at)}</span>
            </div>
            <div>${typeBadge}</div>
          </div>
          <div class="flex items-center justify-between text-[11px]">
            <span class="text-slate-600">ตัดจำนวน: <strong class="text-rose-600 font-bold">-${l.quantity} ${product.unit}</strong></span>
            <span class="text-slate-500">โดย: <strong>${l.used_by || 'พนักงาน'}</strong></span>
          </div>
          ${l.purpose || l.notes ? `<div class="text-[10px] text-slate-400 italic">${l.purpose || ''} ${l.notes ? '(' + l.notes + ')' : ''}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  if (window.lucide) lucide.createIcons();
}

let currentBatchProductId = null;
let currentLoadedBatches = [];

async function openManageBatchesModal(productId) {
  currentBatchProductId = productId;
  const product = state.products.find(p => p.id == productId);
  if (!product) return;

  document.getElementById('manage-batches-prod-name').textContent = `📦 จัดการทุกล็อต: ${product.name}`;
  document.getElementById('manage-batches-prod-category').textContent = product.category || 'หมวดหมู่';
  document.getElementById('manage-batches-total-stock').textContent = product.current_stock;
  document.getElementById('manage-batches-prod-unit').textContent = product.unit;

  const sel = document.getElementById('sort-batch-modal');
  if (sel) sel.value = state.batchModalSort || 'EXPIRY_ASC';

  const listContainer = document.getElementById('manage-batches-list');
  listContainer.innerHTML = `
    <div class="p-6 text-center text-slate-400">
      <div class="animate-spin w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2"></div>
      <p>กำลังโหลดข้อมูลทุกล็อต...</p>
    </div>
  `;
  openDialog('modal-manage-batches');

  try {
    const res = await fetch(`/api/products/${productId}/batches`);
    const json = await res.json();
    currentLoadedBatches = json.data || [];

    renderBatchModalItems();
  } catch (err) {
    listContainer.innerHTML = `<p class="text-rose-500 p-4 text-center">เกิดข้อผิดพลาดในการโหลดล็อต: ${err.message}</p>`;
  }
}

function renderBatchModalItems() {
  const listContainer = document.getElementById('manage-batches-list');
  if (!listContainer) return;
  const product = state.products.find(p => p.id == currentBatchProductId);
  if (!product) return;

  const countEl = document.getElementById('manage-batches-count');
  if (countEl) countEl.textContent = currentLoadedBatches.length;

  if (!currentLoadedBatches || currentLoadedBatches.length === 0) {
    listContainer.innerHTML = `
      <div class="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
        <i data-lucide="package-x" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
        <p class="font-medium text-slate-600">สินค้านี้ยังไม่มีล็อตในสต็อก (คงเหลือ 0)</p>
        <p class="text-[11px] text-slate-400 mt-1">กดปุ่ม "+ รับเข้าล็อตใหม่" ด้านบนเพื่อเพิ่มล็อตแรก</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const sortMode = state.batchModalSort || 'EXPIRY_ASC';
  const sortedBatches = [...currentLoadedBatches].sort((a, b) => {
    if (sortMode === 'EXPIRY_ASC') {
      return (a.expiry_date || '9999-99-99').localeCompare(b.expiry_date || '9999-99-99');
    } else if (sortMode === 'EXPIRY_DESC') {
      return (b.expiry_date || '0000-00-00').localeCompare(a.expiry_date || '0000-00-00');
    } else if (sortMode === 'DATE_DESC') {
      return (b.received_date || '').localeCompare(a.received_date || '');
    } else if (sortMode === 'QTY_DESC') {
      return (Number(b.quantity) || 0) - (Number(a.quantity) || 0);
    }
    return 0;
  });

  listContainer.innerHTML = sortedBatches.map((b, idx) => {
    let statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">ปกติ</span>`;
    if (b.is_expired) {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">หมดอายุแล้ว</span>`;
    } else if (b.is_expiring_soon) {
      statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">ใกล้หมด (${b.days_until_expiry} วัน)</span>`;
    }

    return `
      <div class="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <span class="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center">${idx + 1}</span>
            <span class="font-mono font-bold text-slate-800 text-xs">${b.lot_number || 'LOT-AUTO'}</span>
          </div>
          <div>${statusBadge}</div>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <div>
            <label class="block text-[10px] text-slate-500 font-medium mb-1">จำนวนคงเหลือ (${product.unit}):</label>
            <input type="number" step="any" min="0" id="batch-edit-qty-${b.id}" value="${b.quantity}" class="w-full p-2 font-bold text-slate-900 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none">
          </div>
          <div>
            <label class="block text-[10px] text-slate-500 font-medium mb-1">วันหมดอายุ (Expiry):</label>
            <input type="date" id="batch-edit-exp-${b.id}" value="${b.expiry_date || ''}" class="w-full p-2 font-semibold text-slate-900 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none">
          </div>
        </div>

        <div class="flex items-center justify-between pt-1 border-t border-slate-100">
          <span class="text-[10px] text-slate-400 truncate max-w-[150px]">${b.notes ? 'หมายเหตุ: ' + b.notes : 'รับเข้า: ' + (b.received_date || '-')}</span>
          <div class="flex items-center space-x-1.5">
            <button type="button" onclick="deleteBatchItem('${b.id}')" class="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 active:scale-95 rounded-xl font-semibold text-[11px] flex items-center space-x-1 transition">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              <span>ลบล็อตนี้</span>
            </button>
            <button type="button" onclick="saveBatchChanges('${b.id}')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95 rounded-xl font-semibold text-[11px] flex items-center space-x-1 transition shadow-2xs">
              <i data-lucide="save" class="w-3.5 h-3.5"></i>
              <span>บันทึก</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function handleAddBatchFromManager() {
  closeDialog('modal-manage-batches');
  if (currentBatchProductId) {
    openAddBatchModalFor(currentBatchProductId);
  } else {
    openAddBatchModal();
  }
}

async function saveBatchChanges(batchId) {
  const qtyInput = document.getElementById(`batch-edit-qty-${batchId}`);
  const expInput = document.getElementById(`batch-edit-exp-${batchId}`);
  if (!qtyInput || !expInput) return;

  const qty = Number(qtyInput.value);
  const expiry = expInput.value;

  try {
    const res = await fetch(`/api/batches/${batchId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: qty, expiry_date: expiry })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    playTapFeedback('save');
    showToast('อัปเดตข้อมูลล็อตเรียบร้อย');
    await loadAllData();
    if (currentBatchProductId) {
      openManageBatchesModal(currentBatchProductId);
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
}

async function deleteBatchItem(batchId) {
  if (!confirm('ยืนยันการลบล็อตนี้? ยอดสต็อกของสินค้านี้จะลดลงตามจำนวนในล็อต')) return;

  try {
    const res = await fetch(`/api/batches/${batchId}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) throw new Error(json.error);

    playTapFeedback('alert');
    showToast('ลบล็อตเรียบร้อย');
    await loadAllData();
    if (currentBatchProductId) {
      openManageBatchesModal(currentBatchProductId);
    }
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
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
  playTapFeedback('click');
  document.getElementById('quick-safety-stock').value = val;
}

function setQuickQty(val) {
  if (val === 0) playTapFeedback('zero');
  else playTapFeedback('click');
  document.getElementById('quick-quantity').value = val;
}

function adjustQuickQty(delta) {
  playTapFeedback('click');
  const el = document.getElementById('quick-quantity');
  const cur = parseFloat(el.value) || 0;
  el.value = Math.max(0, cur + delta);
}

function applyDatePreset(amount, unit) {
  playTapFeedback('click');
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

    playTapFeedback('save');
    showToast('✅ อัปเดตข้อมูลสินค้าสำเร็จ');
    await loadAllData();
    closeDialog('modal-quick-update');
  } catch (err) {
    playTapFeedback('alert');
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

    playTapFeedback('save');
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
    playTapFeedback('alert');
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  }
}

function navigateQuickProduct(direction) {
  playTapFeedback('click');
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

