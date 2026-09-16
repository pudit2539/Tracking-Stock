-- =======================================================
-- FIX SUPABASE RLS SECURITY WARNING (rls_disabled_in_public)
-- =======================================================
-- คำสั่งแก้ไขปัญหาแจ้งเตือนความปลอดภัยจาก Supabase:
-- "RLS Disabled in Public" บนตาราง products, inventory_batches, usage_logs, settings, line_recipients
--
-- วิธีใช้งาน:
-- 1. เข้าสู่ Supabase Dashboard (https://supabase.com/dashboard)
-- 2. ไปที่โปรเจกต์ของคุณ -> เมนู "SQL Editor" (ไอคอน >_ ทางซ้าย)
-- 3. คัดลอกคำสั่งทั้งหมดด้านล่างนี้ไปวาง แล้วกดปุ่ม "Run"
-- =======================================================

-- 1. เปิดใช้งาน Row Level Security (RLS) บนทั้ง 5 ตาราง
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS line_recipients ENABLE ROW LEVEL SECURITY;

-- 2. เคลียร์ Policy เก่าหากเคยมีสร้างไว้ (ป้องกัน error ชนกัน)
DROP POLICY IF EXISTS "Allow app access to products" ON products;
DROP POLICY IF EXISTS "Allow app access to inventory_batches" ON inventory_batches;
DROP POLICY IF EXISTS "Allow app access to usage_logs" ON usage_logs;
DROP POLICY IF EXISTS "Allow app access to settings" ON settings;
DROP POLICY IF EXISTS "Allow app access to line_recipients" ON line_recipients;

-- 3. กำหนด Policy อนุญาตให้ระบบ Web Application และ LINE Bot สามารถอ่านและจัดการข้อมูลได้ต่อเนื่อง
CREATE POLICY "Allow app access to products" ON products
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow app access to inventory_batches" ON inventory_batches
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow app access to usage_logs" ON usage_logs
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow app access to settings" ON settings
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow app access to line_recipients" ON line_recipients
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
