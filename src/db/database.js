const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'tracker.db');
const db = new Database(dbPath);

// Enable foreign keys and WAL mode for reliability and speed
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      category TEXT DEFAULT 'วัตถุดิบ',
      unit TEXT NOT NULL DEFAULT 'ชิ้น',
      safety_stock REAL NOT NULL DEFAULT 0,
      expiry_warning_days INTEGER NOT NULL DEFAULT 7,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventory_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      lot_number TEXT,
      quantity REAL NOT NULL DEFAULT 0,
      initial_quantity REAL NOT NULL DEFAULT 0,
      expiry_date TEXT NOT NULL,
      received_date TEXT NOT NULL,
      cost_per_unit REAL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      batch_id INTEGER REFERENCES inventory_batches(id) ON DELETE SET NULL,
      quantity REAL NOT NULL,
      type TEXT NOT NULL DEFAULT 'USE',
      used_date TEXT NOT NULL,
      used_by TEXT,
      purpose TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Default settings if not already present
  const defaultSettings = [
    { key: 'line_channel_access_token', value: process.env.LINE_CHANNEL_ACCESS_TOKEN || '' },
    { key: 'line_target_id', value: process.env.LINE_TARGET_ID || '' },
    { key: 'enable_low_stock_alert', value: '1' },
    { key: 'enable_expiry_alert', value: '1' },
    { key: 'daily_alert_time', value: '08:00' },
    { key: 'default_expiry_alert_days', value: '7' },
    { key: 'last_alert_sent_at', value: '' }
  ];

  const insertSetting = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
  for (const s of defaultSettings) {
    insertSetting.run(s.key, s.value);
  }

  // Check if products table is empty, seed demo data matching reference screenshot
  const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  if (productCount === 0) {
    seedDemoData();
  }
}

function seedDemoData() {
  const insertProduct = db.prepare(`
    INSERT INTO products (name, category, unit, safety_stock, expiry_warning_days)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertBatch = db.prepare(`
    INSERT INTO inventory_batches (product_id, lot_number, quantity, initial_quantity, expiry_date, received_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const today = new Date();
  const formatDate = (daysOffset) => {
    const d = new Date(today);
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().split('T')[0];
  };

  // Demo items matching the screenshot reference
  // 1. Bread: Total 110 Fl, Safety 200 Fl
  const breadRes = insertProduct.run('Bread', 'เบเกอรี่', 'Fl', 200, 5);
  insertBatch.run(breadRes.lastInsertRowid, 'LOT-BR01', 50, 100, formatDate(3), formatDate(-2), 'ล็อตแรก');
  insertBatch.run(breadRes.lastInsertRowid, 'LOT-BR02', 60, 100, formatDate(6), formatDate(-1), 'ล็อตสอง');

  // 2. Chicken Slice: Total 1000 Piece, Safety 2000 Piece
  const chickenRes = insertProduct.run('Chicken Slice', 'เนื้อสัตว์', 'Piece', 2000, 7);
  insertBatch.run(chickenRes.lastInsertRowid, 'LOT-CK01', 1000, 2000, formatDate(14), formatDate(-3), 'อกไก่สไลด์แช่เย็น');

  // 3. Ham: Total 1 Kg, Safety 1 Kg (or near threshold)
  const hamRes = insertProduct.run('Ham', 'เนื้อสัตว์', 'Kg', 1, 7);
  insertBatch.run(hamRes.lastInsertRowid, 'LOT-HM01', 1, 5, formatDate(4), formatDate(-5), 'แฮมหมูรมควัน');

  // 4. Cheddar Cheese: Good stock, but expiring soon! (for expiry alert testing)
  const cheeseRes = insertProduct.run('Cheddar Cheese', 'ผลิตภัณฑ์นม', 'Pack', 5, 10);
  insertBatch.run(cheeseRes.lastInsertRowid, 'LOT-CH01', 12, 15, formatDate(2), formatDate(-10), 'ชีสแผ่น ใกล้หมดอายุ');
}

initSchema();

module.exports = db;

