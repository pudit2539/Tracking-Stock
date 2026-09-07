const { createClient } = require('@supabase/supabase-js');
const db = require('../src/db/database');

const categoryMap = {
  // แก้ว & ฝา (10)
  'แก้วซันเดย์': 'แก้ว & ฝา',
  'แก้ว8oz': 'แก้ว & ฝา',
  'แก้ว12oz': 'แก้ว & ฝา',
  'แก้ว16oz': 'แก้ว & ฝา',
  'แก้ว16oz BZ': 'แก้ว & ฝา',
  'ฝา BZ.16 oz': 'แก้ว & ฝา',
  'แก้ว 22 oz': 'แก้ว & ฝา',
  'ฝาแก้ว 22 oz': 'แก้ว & ฝา',
  'แก้วCoke 32oz': 'แก้ว & ฝา',
  'ฝาแก้ว 32 oz': 'แก้ว & ฝา',

  // ช้อน & หลอด & หีบห่อ (11)
  'ช้อนสั้น': 'ช้อน & หลอด & หีบห่อ',
  'ช้อนยาว': 'ช้อน & หลอด & หีบห่อ',
  'หลอด': 'ช้อน & หลอด & หีบห่อ',
  'โคน': 'ช้อน & หลอด & หีบห่อ',
  'ปอกโคน': 'ช้อน & หลอด & หีบห่อ',
  'แนปกิ้น': 'ช้อน & หลอด & หีบห่อ',
  'Box hotdag': 'ช้อน & หลอด & หีบห่อ',
  'Wrap hotdog': 'ช้อน & หลอด & หีบห่อ',
  'ถุงขาว': 'ช้อน & หลอด & หีบห่อ',
  'มีด': 'ช้อน & หลอด & หีบห่อ',
  'ส้อม': 'ช้อน & หลอด & หีบห่อ',

  // ท็อปปิ้ง & วัตถุดิบ (11)
  'ผงโกโก้': 'ท็อปปิ้ง & วัตถุดิบ',
  'Oreo': 'ท็อปปิ้ง & วัตถุดิบ',
  'นมจืด': 'ท็อปปิ้ง & วัตถุดิบ',
  'โกโก้ฟัด': 'ท็อปปิ้ง & วัตถุดิบ',
  'ช็อคดิป': 'ท็อปปิ้ง & วัตถุดิบ',
  'คาราเมล': 'ท็อปปิ้ง & วัตถุดิบ',
  'ช็อคท็อปปิ้ง': 'ท็อปปิ้ง & วัตถุดิบ',
  'อัลมอนด์': 'ท็อปปิ้ง & วัตถุดิบ',
  'ชาเขียว': 'ท็อปปิ้ง & วัตถุดิบ',
  'แก๊สบอม': 'ท็อปปิ้ง & วัตถุดิบ',
  'Kitkat': 'ท็อปปิ้ง & วัตถุดิบ',

  // ซอส & เครื่องดื่ม (12)
  'ซอสมะเขือเทศ': 'ซอส & เครื่องดื่ม',
  'ซอสพริก': 'ซอส & เครื่องดื่ม',
  'กาแฟ': 'ซอส & เครื่องดื่ม',
  'Purra': 'ซอส & เครื่องดื่ม',
  'เอเวียงฝาแดง': 'ซอส & เครื่องดื่ม',
  'ชเวปเขียว': 'ซอส & เครื่องดื่ม',
  'ชเวปม่วง': 'ซอส & เครื่องดื่ม',
  'ชเวปชมพู': 'ซอส & เครื่องดื่ม',
  'Perrier': 'ซอส & เครื่องดื่ม',
  'Perrier Lemon': 'ซอส & เครื่องดื่ม',
  'Cokeกด': 'ซอส & เครื่องดื่ม',
  'Cokeขวดฝาแดง': 'ซอส & เครื่องดื่ม',

  // อุปกรณ์ & ของใช้ (10)
  'วอวิค': 'อุปกรณ์ & ของใช้',
  'โรล เปปเซฟ': 'อุปกรณ์ & ของใช้',
  'ถุงขยะใหญ่': 'อุปกรณ์ & ของใช้',
  'ถุงขยะเล็ก': 'อุปกรณ์ & ของใช้',
  'Hand towel': 'อุปกรณ์ & ของใช้',
  'ถุงมือS': 'อุปกรณ์ & ของใช้',
  'ถุงมือM': 'อุปกรณ์ & ของใช้',
  'ถังแดง': 'อุปกรณ์ & ของใช้',
  'ขวดใส่ท็อปปิ้ง': 'อุปกรณ์ & ของใช้',
  'มัลติ': 'อุปกรณ์ & ของใช้'
};

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jrgcpnenanxbnepcypon.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpyZ2NwbmVuYW54Ym5lcGN5cG9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NjMxNzMsImV4cCI6MjEwNDMzOTE3M30.OJlMiGjB3c0WW_ECTLzMyB9UKWLCcAbFLrIUH4VFAIQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log('Updating categories for 54 Dairy Queen items in SQLite & Supabase...');

  // 1. Update SQLite
  const updateStmt = db.prepare('UPDATE products SET category = ? WHERE name = ?');
  let localUpdated = 0;
  for (const [name, cat] of Object.entries(categoryMap)) {
    const info = updateStmt.run(cat, name);
    if (info.changes > 0) localUpdated++;
  }
  console.log('SQLite updated: ' + localUpdated + ' products.');

  // 2. Remove mock products from Supabase if any
  const mockNames = ['Bread', 'Chicken Slice', 'Ham', 'Cheddar Cheese'];
  const { error: delErr } = await supabase.from('products').delete().in('name', mockNames);
  if (!delErr) console.log('Cleaned mock products from Supabase');

  // 3. Update Supabase
  let supaUpdated = 0;
  for (const [name, cat] of Object.entries(categoryMap)) {
    const { error } = await supabase.from('products').update({ category: cat }).eq('name', name);
    if (error) {
      console.error('Error updating ' + name + ':', error.message);
    } else {
      supaUpdated++;
    }
  }
  console.log('Supabase updated: ' + supaUpdated + ' products.');

  // 4. Verification
  const { data: supaProducts } = await supabase.from('products').select('category');
  const catCounts = {};
  if (supaProducts) {
    supaProducts.forEach(p => {
      catCounts[p.category] = (catCounts[p.category] || 0) + 1;
    });
  }
  console.log('Category Distribution in Supabase:', JSON.stringify(catCounts, null, 2));
}

run().catch(console.error);
