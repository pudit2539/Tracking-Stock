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

    CREATE TABLE IF NOT EXISTS line_recipients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target_id TEXT NOT NULL UNIQUE,
      type TEXT DEFAULT 'USER',
      is_active INTEGER DEFAULT 1,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migrate existing line_target_id to line_recipients if recipients table is empty
  const recipientCount = db.prepare('SELECT COUNT(*) as count FROM line_recipients').get().count;
  if (recipientCount === 0) {
    const existingTarget = db.prepare("SELECT value FROM settings WHERE key = 'line_target_id'").get();
    if (existingTarget && existingTarget.value && existingTarget.value.trim().length > 10) {
      const val = existingTarget.value.trim();
      const type = (val.startsWith('C') || val.startsWith('R')) ? 'GROUP' : 'USER';
      const name = type === 'GROUP' ? 'LINE กลุ่มหลัก' : 'LINE ส่วนตัวหลัก';
      db.prepare('INSERT OR IGNORE INTO line_recipients (name, target_id, type, is_active) VALUES (?, ?, ?, 1)')
        .run(name, val, type);
    }
  }

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
    INSERT OR IGNORE INTO products (name, category, unit, safety_stock, expiry_warning_days)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertBatch = db.prepare(`
    INSERT INTO inventory_batches (product_id, lot_number, quantity, initial_quantity, expiry_date, received_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const dqItems = [
    // 🥤 แก้ว & ฝา (10)
    ['แก้วซันเดย์', 'แก้ว & ฝา', 'PACK', 1, 7],
    ['แก้ว8oz', 'แก้ว & ฝา', 'PACK', 1, 7],
    ['แก้ว12oz', 'แก้ว & ฝา', 'PACK', 1, 7],
    ['แก้ว16oz', 'แก้ว & ฝา', 'PACK', 1, 7],
    ['แก้ว16oz BZ', 'แก้ว & ฝา', 'PACK', 1, 7],
    ['ฝา BZ.16 oz', 'แก้ว & ฝา', 'PACK', 1, 7],
    ['แก้ว 22 oz', 'แก้ว & ฝา', 'PACK', 1, 7],
    ['ฝาแก้ว 22 oz', 'แก้ว & ฝา', 'PACK', 1, 7],
    ['แก้วCoke 32oz', 'แก้ว & ฝา', 'PACK', 1, 7],
    ['ฝาแก้ว 32 oz', 'แก้ว & ฝา', 'PACK', 1, 7],

    // 🥄 ช้อน & หลอด & หีบห่อ (11)
    ['ช้อนสั้น', 'ช้อน & หลอด & หีบห่อ', 'PACK', 1, 7],
    ['ช้อนยาว', 'ช้อน & หลอด & หีบห่อ', 'PACK', 1, 7],
    ['หลอด', 'ช้อน & หลอด & หีบห่อ', 'PACK', 1, 7],
    ['โคน', 'ช้อน & หลอด & หีบห่อ', 'PACK', 1, 7],
    ['ปอกโคน', 'ช้อน & หลอด & หีบห่อ', 'PACK', 1, 7],
    ['แนปกิ้น', 'ช้อน & หลอด & หีบห่อ', 'PACK', 1, 7],
    ['Box hotdag', 'ช้อน & หลอด & หีบห่อ', 'PACK', 1, 7],
    ['Wrap hotdog', 'ช้อน & หลอด & หีบห่อ', 'PACK', 1, 7],
    ['ถุงขาว', 'ช้อน & หลอด & หีบห่อ', 'PACK', 1, 7],
    ['มีด', 'ช้อน & หลอด & หีบห่อ', 'PACK', 1, 7],
    ['ส้อม', 'ช้อน & หลอด & หีบห่อ', 'PACK', 1, 7],

    // 🍫 ท็อปปิ้ง & วัตถุดิบ (11)
    ['ผงโกโก้', 'ท็อปปิ้ง & วัตถุดิบ', 'EA', 1, 7],
    ['Oreo', 'ท็อปปิ้ง & วัตถุดิบ', 'PACK', 1, 7],
    ['นมจืด', 'ท็อปปิ้ง & วัตถุดิบ', 'PACK', 1, 7],
    ['โกโก้ฟัด', 'ท็อปปิ้ง & วัตถุดิบ', 'BAG', 1, 7],
    ['ช็อคดิป', 'ท็อปปิ้ง & วัตถุดิบ', 'BAG', 1, 7],
    ['คาราเมล', 'ท็อปปิ้ง & วัตถุดิบ', 'BAG', 1, 7],
    ['ช็อคท็อปปิ้ง', 'ท็อปปิ้ง & วัตถุดิบ', 'BAG', 1, 7],
    ['อัลมอนด์', 'ท็อปปิ้ง & วัตถุดิบ', 'BAG', 1, 7],
    ['ชาเขียว', 'ท็อปปิ้ง & วัตถุดิบ', 'BAG', 1, 7],
    ['แก๊สบอม', 'ท็อปปิ้ง & วัตถุดิบ', 'BOX', 1, 7],
    ['Kitkat', 'ท็อปปิ้ง & วัตถุดิบ', 'BOX', 1, 7],

    // 🌭 ซอส & เครื่องดื่ม (12)
    ['ซอสมะเขือเทศ', 'ซอส & เครื่องดื่ม', 'BAG', 1, 7],
    ['ซอสพริก', 'ซอส & เครื่องดื่ม', 'BAG', 1, 7],
    ['กาแฟ', 'ซอส & เครื่องดื่ม', 'PACK', 1, 7],
    ['Purra', 'ซอส & เครื่องดื่ม', 'PACK', 1, 7],
    ['เอเวียงฝาแดง', 'ซอส & เครื่องดื่ม', 'CS', 1, 7],
    ['ชเวปเขียว', 'ซอส & เครื่องดื่ม', 'PACK', 1, 7],
    ['ชเวปม่วง', 'ซอส & เครื่องดื่ม', 'CS', 1, 7],
    ['ชเวปชมพู', 'ซอส & เครื่องดื่ม', 'PACK', 1, 7],
    ['Perrier', 'ซอส & เครื่องดื่ม', 'PACK', 1, 7],
    ['Perrier Lemon', 'ซอส & เครื่องดื่ม', 'PACK', 1, 7],
    ['Cokeกด', 'ซอส & เครื่องดื่ม', 'CS', 1, 7],
    ['Cokeขวดฝาแดง', 'ซอส & เครื่องดื่ม', 'CS', 1, 7],

    // 🧤 อุปกรณ์ & ของใช้ (10)
    ['วอวิค', 'อุปกรณ์ & ของใช้', 'CS', 1, 7],
    ['โรล เปปเซฟ', 'อุปกรณ์ & ของใช้', 'EA', 1, 7],
    ['ถุงขยะใหญ่', 'อุปกรณ์ & ของใช้', 'PACK', 1, 7],
    ['ถุงขยะเล็ก', 'อุปกรณ์ & ของใช้', 'PACK', 1, 7],
    ['Hand towel', 'อุปกรณ์ & ของใช้', 'PACK', 1, 7],
    ['ถุงมือS', 'อุปกรณ์ & ของใช้', 'BOX', 1, 7],
    ['ถุงมือM', 'อุปกรณ์ & ของใช้', 'BOX', 1, 7],
    ['ถังแดง', 'อุปกรณ์ & ของใช้', 'EA', 1, 7],
    ['ขวดใส่ท็อปปิ้ง', 'อุปกรณ์ & ของใช้', 'EA', 1, 7],
    ['มัลติ', 'อุปกรณ์ & ของใช้', 'EA', 1, 7]
  ];

  for (const item of dqItems) {
    insertProduct.run(item[0], item[1], item[2], item[3], item[4]);
  }

  // Initial batch for 'ฝา BZ.16 oz' with 5 in stock
  const p = db.prepare("SELECT id FROM products WHERE name = 'ฝา BZ.16 oz'").get();
  if (p) {
    const d = new Date();
    d.setMonth(d.getMonth() + 6);
    const expiryStr = d.toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    insertBatch.run(p.id, 'LOT-INIT', 5, 5, expiryStr, todayStr, 'ยอดยกมา 5 แพ็ค');
  }
}

initSchema();

module.exports = db;

