const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, '../../data/tracker.db');
const db = new Database(dbPath);

const rawItems = [
  { name: 'ผงโกโก้', category: 'ของแห้ง', unit: 'EA', stock: 0, safety: 1, notes: '' },
  { name: 'ช้อนสั้น', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'ช้อนยาว', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: '' },
  { name: 'นมจืด', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'แก้วซันเดย์', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'หลอด', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: '' },
  { name: 'โคน', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'Oreo', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'แก้ว8oz', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'แก้ว12oz', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: '' },
  { name: 'แก้ว16oz BZ', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'แนปกิ้น', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: '' },
  { name: 'Box hotdag', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'Wrap hotdog', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'กาแฟ', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'ซอสมะเขือเทศ', category: 'ของแห้ง', unit: 'BAG', stock: 0, safety: 1, notes: '' },
  { name: 'ซอสพริก', category: 'ของแห้ง', unit: 'BAG', stock: 0, safety: 1, notes: '' },
  { name: 'โกโก้ฟัด', category: 'ของแห้ง', unit: 'BAG', stock: 0, safety: 1, notes: '' },
  { name: 'ช็อคดิป', category: 'ของแห้ง', unit: 'BAG', stock: 0, safety: 1, notes: '' },
  { name: 'คาราเมล', category: 'ของแห้ง', unit: 'BAG', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'ช็อคท็อปปิ้ง', category: 'ของแห้ง', unit: 'BAG', stock: 0, safety: 1, notes: '' },
  { name: 'อัลมอนด์', category: 'ของแห้ง', unit: 'BAG', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'ชาเขียว', category: 'ของแห้ง', unit: 'BAG', stock: 0, safety: 1, notes: '' },
  { name: 'ถุงขาว', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'แก๊สบอม', category: 'ของแห้ง', unit: 'BOX', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'Kitkat', category: 'ของแห้ง', unit: 'BOX', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'ปอกโคน', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: '' },
  { name: 'Purra', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'มีด', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'ส้อม', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'วอวิค', category: 'ของแห้ง', unit: 'CS', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'โรล เปปเซฟ', category: 'ของแห้ง', unit: 'EA', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'เอเวียงฝาแดง', category: 'ของแห้ง', unit: 'CS', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'ชเวปเขียว', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'ชเวปม่วง', category: 'ของแห้ง', unit: 'CS', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'ชเวปชมพู', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'แก้ว16oz', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: '' },
  { name: 'ฝา BZ.16 oz', category: 'ของแห้ง', unit: 'PACK', stock: 5, safety: 1, notes: 'มีสต็อก 5' },
  { name: 'แก้วCoke 32oz', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'ฝาแก้ว 32 oz', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: '' },
  { name: 'แก้ว 22 oz', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: '' },
  { name: 'ฝาแก้ว 22 oz', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'ถุงขยะใหญ่', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'Hand towel', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'Perrier', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'Perrier Lemon', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'Cokeกด', category: 'ของแห้ง', unit: 'CS', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'Cokeขวดฝาแดง', category: 'ของแห้ง', unit: 'CS', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'ถุงมือS', category: 'ของแห้ง', unit: 'BOX', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'ถุงมือM', category: 'ของแห้ง', unit: 'BOX', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'ถังแดง', category: 'ของแห้ง', unit: 'EA', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'ขวดใส่ท็อปปิ้ง', category: 'ของแห้ง', unit: 'EA', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'มัลติ', category: 'ของแห้ง', unit: 'EA', stock: 0, safety: 1, notes: 'หมด' },
  { name: 'ถุงขยะเล็ก', category: 'ของแห้ง', unit: 'PACK', stock: 0, safety: 1, notes: 'หมด' }
];

console.log(`Starting import of ${rawItems.length} items...`);

const insertOrUpdateProduct = db.prepare(`
  INSERT INTO products (name, category, unit, safety_stock, expiry_warning_days)
  VALUES (@name, @category, @unit, @safety, 7)
  ON CONFLICT(name) DO UPDATE SET
    category = excluded.category,
    unit = excluded.unit,
    safety_stock = excluded.safety_stock
`);

const insertBatch = db.prepare(`
  INSERT INTO inventory_batches (product_id, lot_number, quantity, initial_quantity, expiry_date, received_date, notes)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// Clean old demo data if only Bread, Chicken Slice, Ham, Cheddar Cheese exist
const existingProducts = db.prepare('SELECT id, name FROM products').all();
const demoNames = ['Bread', 'Chicken Slice', 'Ham', 'Cheddar Cheese'];
const isOnlyDemo = existingProducts.length <= 4 && existingProducts.every(p => demoNames.includes(p.name));

if (isOnlyDemo) {
  console.log('Replacing initial demo items with real DQ inventory...');
  db.exec('DELETE FROM inventory_batches');
  db.exec('DELETE FROM usage_logs');
  db.exec('DELETE FROM products');
}

const trans = db.transaction(() => {
  for (const item of rawItems) {
    insertOrUpdateProduct.run({
      name: item.name,
      category: item.category,
      unit: item.unit,
      safety: item.safety
    });

    const p = db.prepare('SELECT id FROM products WHERE name = ?').get(item.name);
    
    // If has initial stock (like ฝา BZ.16 oz = 5)
    if (item.stock > 0) {
      const existingBatch = db.prepare('SELECT id FROM inventory_batches WHERE product_id = ?').get(p.id);
      if (!existingBatch) {
        const d = new Date();
        d.setMonth(d.getMonth() + 6); // default 6 months for dry goods
        const expiryStr = d.toISOString().split('T')[0];
        const todayStr = new Date().toISOString().split('T')[0];
        insertBatch.run(p.id, 'LOT-INIT', item.stock, item.stock, expiryStr, todayStr, item.notes || 'ยอดยกมา');
      }
    }
  }
});

trans();

const total = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
console.log(`✅ Successfully imported! Total products in database: ${total}`);
