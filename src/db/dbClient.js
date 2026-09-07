const { createClient } = require('@supabase/supabase-js');

const rawSupabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
const isSupabase = Boolean(supabaseUrl && (process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY));

let supabase = null;
let sqliteDb = null;

if (isSupabase) {
  const key = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;
  supabase = createClient(supabaseUrl, key);
  console.log('✅ Connected to Cloud Database (Supabase PostgreSQL):', supabaseUrl);
} else {
  try {
    sqliteDb = require('./database');
    console.log('📦 Connected to Local Database (SQLite)');
  } catch (err) {
    console.warn('⚠️ SQLite not available in this environment:', err.message);
  }
}

const dbClient = {
  isSupabase,
  supabase,
  sqliteDb,

  // 1. SETTINGS
  async getSetting(key, defaultValue = '') {
    if (isSupabase) {
      const { data, error } = await supabase.from('settings').select('value').eq('key', key).maybeSingle();
      if (error || !data) return defaultValue;
      return data.value;
    } else {
      const row = sqliteDb.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      return row ? row.value : defaultValue;
    }
  },

  async getAllSettings() {
    if (isSupabase) {
      const { data, error } = await supabase.from('settings').select('*');
      if (error || !data) return {};
      const map = {};
      data.forEach(r => { map[r.key] = r.value; });
      return map;
    } else {
      const rows = sqliteDb.prepare('SELECT * FROM settings').all();
      const map = {};
      rows.forEach(r => { map[r.key] = r.value; });
      return map;
    }
  },

  async saveSetting(key, value) {
    if (isSupabase) {
      const { error } = await supabase.from('settings').upsert({ key, value: String(value) }, { onConflict: 'key' });
      if (error) throw new Error(error.message);
    } else {
      sqliteDb.prepare(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(key, String(value));
    }
  },

  // 1.1 RECIPIENTS (Multiple Users and Groups)
  async getRecipients() {
    if (isSupabase) {
      const { data, error } = await supabase.from('line_recipients').select('*').order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []).map(r => ({
        ...r,
        is_active: r.is_active ? 1 : 0
      }));
    } else {
      return sqliteDb.prepare('SELECT * FROM line_recipients ORDER BY created_at DESC').all();
    }
  },

  async getActiveRecipients() {
    if (isSupabase) {
      const { data, error } = await supabase.from('line_recipients').select('*').eq('is_active', true);
      if (error) throw new Error(error.message);
      return data || [];
    } else {
      return sqliteDb.prepare('SELECT * FROM line_recipients WHERE is_active = 1').all();
    }
  },

  async createRecipient(data) {
    const targetId = data.target_id.trim();
    const type = (targetId.startsWith('C') || targetId.startsWith('R')) ? 'GROUP' : 'USER';
    const payload = {
      name: data.name?.trim() || (type === 'GROUP' ? 'LINE กลุ่ม' : 'LINE ส่วนตัว'),
      target_id: targetId,
      type,
      is_active: data.is_active !== undefined ? (data.is_active ? 1 : 0) : 1,
      notes: data.notes?.trim() || ''
    };

    if (isSupabase) {
      const { data: res, error } = await supabase.from('line_recipients')
        .upsert({ ...payload, is_active: Boolean(payload.is_active) }, { onConflict: 'target_id' })
        .select().single();
      if (error) throw new Error(error.message);
      return res;
    } else {
      const stmt = sqliteDb.prepare(`
        INSERT INTO line_recipients (name, target_id, type, is_active, notes)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(target_id) DO UPDATE SET
          name = excluded.name,
          type = excluded.type,
          is_active = excluded.is_active,
          notes = excluded.notes
      `);
      stmt.run(payload.name, payload.target_id, payload.type, payload.is_active, payload.notes);
      return sqliteDb.prepare('SELECT * FROM line_recipients WHERE target_id = ?').get(payload.target_id);
    }
  },

  async updateRecipient(id, data) {
    const targetId = data.target_id?.trim();
    const type = targetId ? ((targetId.startsWith('C') || targetId.startsWith('R')) ? 'GROUP' : 'USER') : data.type;
    const payload = {
      name: data.name?.trim(),
      target_id: targetId,
      type,
      notes: data.notes?.trim() || ''
    };

    if (isSupabase) {
      const { data: res, error } = await supabase.from('line_recipients').update(payload).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      return res;
    } else {
      sqliteDb.prepare(`
        UPDATE line_recipients
        SET name = ?, target_id = ?, type = ?, notes = ?
        WHERE id = ?
      `).run(payload.name, payload.target_id, payload.type, payload.notes, id);
      return sqliteDb.prepare('SELECT * FROM line_recipients WHERE id = ?').get(id);
    }
  },

  async toggleRecipient(id, isActive) {
    const val = isActive ? 1 : 0;
    if (isSupabase) {
      await supabase.from('line_recipients').update({ is_active: Boolean(val) }).eq('id', id);
      return true;
    } else {
      sqliteDb.prepare('UPDATE line_recipients SET is_active = ? WHERE id = ?').run(val, id);
      return true;
    }
  },

  async deleteRecipient(id) {
    if (isSupabase) {
      await supabase.from('line_recipients').delete().eq('id', id);
      return true;
    } else {
      sqliteDb.prepare('DELETE FROM line_recipients WHERE id = ?').run(id);
      return true;
    }
  },

  // 2. PRODUCTS
  async getAllProducts() {
    const today = new Date().toISOString().split('T')[0];

    if (isSupabase) {
      const { data: prods, error: pErr } = await supabase.from('products').select('*').order('name');
      if (pErr) throw new Error(pErr.message);

      const { data: batches, error: bErr } = await supabase.from('inventory_batches').select('*').gt('quantity', 0).order('expiry_date');
      if (bErr) throw new Error(bErr.message);

      return (prods || []).map(p => {
        const pBatches = (batches || []).filter(b => b.product_id == p.id);
        const currentStock = pBatches.reduce((sum, b) => sum + Number(b.quantity), 0);
        const nearestBatch = pBatches[0];
        const nearestExpiry = nearestBatch ? nearestBatch.expiry_date : null;

        let daysUntilExpiry = null;
        let isExpired = false;
        let isExpiringSoon = false;

        if (nearestExpiry) {
          const diffTime = new Date(nearestExpiry) - new Date(today);
          daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry < 0) isExpired = true;
          else if (daysUntilExpiry <= (p.expiry_warning_days || 7)) isExpiringSoon = true;
        }

        return {
          ...p,
          safety_stock: Number(p.safety_stock),
          current_stock: currentStock,
          batch_count: pBatches.length,
          nearest_expiry: nearestExpiry,
          days_until_expiry: daysUntilExpiry,
          is_low_stock: currentStock <= Number(p.safety_stock),
          is_expiring_soon: isExpiringSoon,
          is_expired: isExpired
        };
      });
    } else {
      const prods = sqliteDb.prepare(`
        SELECT 
          p.*,
          COALESCE(SUM(b.quantity), 0) AS current_stock,
          COUNT(b.id) AS batch_count,
          MIN(CASE WHEN b.quantity > 0 THEN b.expiry_date ELSE NULL END) AS nearest_expiry
        FROM products p
        LEFT JOIN inventory_batches b ON p.id = b.product_id AND b.quantity > 0
        GROUP BY p.id
        ORDER BY p.name ASC
      `).all();

      return prods.map(p => {
        const isLowStock = p.current_stock <= p.safety_stock;
        let isExpiringSoon = false;
        let isExpired = false;
        let daysUntilExpiry = null;

        if (p.nearest_expiry) {
          const diffTime = new Date(p.nearest_expiry) - new Date(today);
          daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          if (daysUntilExpiry < 0) isExpired = true;
          else if (daysUntilExpiry <= p.expiry_warning_days) isExpiringSoon = true;
        }

        return {
          ...p,
          is_low_stock: isLowStock,
          is_expiring_soon: isExpiringSoon,
          is_expired: isExpired,
          days_until_expiry: daysUntilExpiry
        };
      });
    }
  },

  async getProductById(id) {
    if (isSupabase) {
      const { data: prod, error } = await supabase.from('products').select('*').eq('id', id).single();
      if (error || !prod) return null;

      const batches = await this.getBatchesByProductId(id);
      const currentStock = batches.reduce((sum, b) => sum + Number(b.quantity), 0);

      return {
        ...prod,
        safety_stock: Number(prod.safety_stock),
        current_stock: currentStock,
        batches
      };
    } else {
      const product = sqliteDb.prepare('SELECT * FROM products WHERE id = ?').get(id);
      if (!product) return null;
      const batches = await this.getBatchesByProductId(id);
      const currentStock = batches.reduce((sum, b) => sum + Number(b.quantity), 0);
      return { ...product, current_stock: currentStock, batches };
    }
  },

  async createProduct(data) {
    const payload = {
      name: data.name.trim(),
      category: data.category?.trim() || 'วัตถุดิบ',
      unit: data.unit?.trim() || 'ชิ้น',
      safety_stock: Number(data.safety_stock) || 0,
      expiry_warning_days: Number(data.expiry_warning_days) || 7
    };

    if (isSupabase) {
      const { data: res, error } = await supabase.from('products').insert(payload).select().single();
      if (error) throw new Error(error.message);
      return res;
    } else {
      const stmt = sqliteDb.prepare(`
        INSERT INTO products (name, category, unit, safety_stock, expiry_warning_days)
        VALUES (?, ?, ?, ?, ?)
      `);
      const res = stmt.run(payload.name, payload.category, payload.unit, payload.safety_stock, payload.expiry_warning_days);
      return this.getProductById(res.lastInsertRowid);
    }
  },

  async updateProduct(id, data) {
    const payload = {
      name: data.name.trim(),
      category: data.category?.trim() || 'วัตถุดิบ',
      unit: data.unit?.trim() || 'ชิ้น',
      safety_stock: Number(data.safety_stock) || 0,
      expiry_warning_days: Number(data.expiry_warning_days) || 7,
      updated_at: new Date().toISOString()
    };

    if (isSupabase) {
      const { data: res, error } = await supabase.from('products').update(payload).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      return res;
    } else {
      sqliteDb.prepare(`
        UPDATE products
        SET name = ?, category = ?, unit = ?, safety_stock = ?, expiry_warning_days = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(payload.name, payload.category, payload.unit, payload.safety_stock, payload.expiry_warning_days, id);
      return this.getProductById(id);
    }
  },

  async deleteProduct(id) {
    if (isSupabase) {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    } else {
      sqliteDb.prepare('DELETE FROM products WHERE id = ?').run(id);
      return true;
    }
  },

  async updateSafetyStock(id, safetyStock) {
    const val = Math.max(0, Number(safetyStock) || 0);
    if (isSupabase) {
      await supabase.from('products').update({ safety_stock: val, updated_at: new Date().toISOString() }).eq('id', id);
    } else {
      sqliteDb.prepare('UPDATE products SET safety_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(val, id);
    }
    return this.getProductById(id);
  },

  async quickUpdateProduct(id, data) {
    // 1. Update safety stock if provided
    if (data.safety_stock !== undefined && data.safety_stock !== '') {
      const sVal = Math.max(0, Number(data.safety_stock) || 0);
      if (isSupabase) {
        await supabase.from('products').update({ safety_stock: sVal, updated_at: new Date().toISOString() }).eq('id', id);
      } else {
        sqliteDb.prepare('UPDATE products SET safety_stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(sVal, id);
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const qty = data.quantity !== undefined && data.quantity !== '' ? Number(data.quantity) : null;
    const expiryDate = data.expiry_date ? String(data.expiry_date).trim() : null;

    if (qty !== null && qty <= 0) {
      // Set all existing batches of this product to 0 (mark out of stock)
      if (isSupabase) {
        await supabase.from('inventory_batches').update({ quantity: 0 }).eq('product_id', id);
      } else {
        sqliteDb.prepare('UPDATE inventory_batches SET quantity = 0 WHERE product_id = ?').run(id);
      }
    } else if (qty !== null && qty > 0 && expiryDate) {
      // Find existing active batch or create new batch
      const batches = await this.getBatchesByProductId(id);
      const activeBatches = batches.filter(b => b.quantity > 0);

      if (activeBatches.length === 1) {
        // Update the single batch
        const b = activeBatches[0];
        await this.updateBatch(b.id, {
          quantity: qty,
          expiry_date: expiryDate,
          notes: data.notes || b.notes || 'อัปเดตด่วน'
        });
      } else {
        // Create new batch with this expiry date and quantity
        await this.createBatch({
          product_id: id,
          lot_number: data.lot_number || `LOT-${Date.now().toString().slice(-4)}`,
          quantity: qty,
          initial_quantity: qty,
          expiry_date: expiryDate,
          received_date: todayStr,
          notes: data.notes || 'รับเข้า/อัปเดตด่วน'
        });
      }
    } else if (expiryDate) {
      // Only expiry date was updated
      const batches = await this.getBatchesByProductId(id);
      const activeBatches = batches.filter(b => b.quantity > 0);
      if (activeBatches.length > 0) {
        await this.updateBatch(activeBatches[0].id, {
          expiry_date: expiryDate
        });
      } else {
        const finalQty = (qty !== null && qty > 0) ? qty : 1;
        await this.createBatch({
          product_id: id,
          lot_number: data.lot_number || `LOT-${Date.now().toString().slice(-4)}`,
          quantity: finalQty,
          initial_quantity: finalQty,
          expiry_date: expiryDate,
          received_date: todayStr,
          notes: data.notes || 'บันทึกวันหมดอายุ'
        });
      }
    }

    return this.getProductById(id);
  },

  // 3. BATCHES
  async getAllBatches() {
    const today = new Date().toISOString().split('T')[0];

    if (isSupabase) {
      const { data, error } = await supabase.from('inventory_batches').select('*, products(name, unit, category)').order('expiry_date');
      if (error) throw new Error(error.message);

      return (data || []).map(b => {
        const diffTime = new Date(b.expiry_date) - new Date(today);
        const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return {
          ...b,
          quantity: Number(b.quantity),
          product_name: b.products?.name,
          unit: b.products?.unit,
          category: b.products?.category,
          days_until_expiry: daysUntilExpiry,
          is_expired: daysUntilExpiry < 0,
          is_expiring_soon: daysUntilExpiry >= 0 && daysUntilExpiry <= 7
        };
      });
    } else {
      const batches = sqliteDb.prepare(`
        SELECT b.*, p.name AS product_name, p.unit, p.category
        FROM inventory_batches b
        JOIN products p ON b.product_id = p.id
        ORDER BY b.expiry_date ASC
      `).all();

      return batches.map(b => {
        const diffTime = new Date(b.expiry_date) - new Date(today);
        const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return {
          ...b,
          days_until_expiry: daysUntilExpiry,
          is_expired: daysUntilExpiry < 0,
          is_expiring_soon: daysUntilExpiry >= 0 && daysUntilExpiry <= 7
        };
      });
    }
  },

  async getBatchesByProductId(productId) {
    const today = new Date().toISOString().split('T')[0];

    if (isSupabase) {
      const { data, error } = await supabase.from('inventory_batches').select('*').eq('product_id', productId).order('expiry_date');
      if (error) throw new Error(error.message);

      return (data || []).map(b => {
        const diffTime = new Date(b.expiry_date) - new Date(today);
        const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return {
          ...b,
          quantity: Number(b.quantity),
          days_until_expiry: daysUntilExpiry,
          is_expired: daysUntilExpiry < 0,
          is_expiring_soon: daysUntilExpiry >= 0 && daysUntilExpiry <= 7
        };
      });
    } else {
      const batches = sqliteDb.prepare(`
        SELECT * FROM inventory_batches
        WHERE product_id = ?
        ORDER BY expiry_date ASC
      `).all(productId);

      return batches.map(b => {
        const diffTime = new Date(b.expiry_date) - new Date(today);
        const daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return {
          ...b,
          days_until_expiry: daysUntilExpiry,
          is_expired: daysUntilExpiry < 0,
          is_expiring_soon: daysUntilExpiry >= 0 && daysUntilExpiry <= 7
        };
      });
    }
  },

  async createBatch(data) {
    const qty = Number(data.quantity) || 0;
    const payload = {
      product_id: data.product_id,
      lot_number: data.lot_number?.trim() || `LOT-${Date.now().toString().slice(-4)}`,
      quantity: qty,
      initial_quantity: qty,
      expiry_date: data.expiry_date,
      received_date: data.received_date || new Date().toISOString().split('T')[0],
      cost_per_unit: Number(data.cost_per_unit) || 0,
      notes: data.notes?.trim() || ''
    };

    if (isSupabase) {
      const { data: res, error } = await supabase.from('inventory_batches').insert(payload).select().single();
      if (error) throw new Error(error.message);
      return res.id;
    } else {
      const stmt = sqliteDb.prepare(`
        INSERT INTO inventory_batches (product_id, lot_number, quantity, initial_quantity, expiry_date, received_date, cost_per_unit, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const res = stmt.run(payload.product_id, payload.lot_number, payload.quantity, payload.initial_quantity, payload.expiry_date, payload.received_date, payload.cost_per_unit, payload.notes);
      return res.lastInsertRowid;
    }
  },

  async deleteBatch(id) {
    if (isSupabase) {
      await supabase.from('inventory_batches').delete().eq('id', id);
      return true;
    } else {
      sqliteDb.prepare('DELETE FROM inventory_batches WHERE id = ?').run(id);
      return true;
    }
  },

  // 4. USAGE LOGS & FIFO DEDUCTION
  async recordUsage(data) {
    const { product_id, batch_id, quantity, type, used_date, used_by, purpose, notes } = data;
    const qtyToDeduct = Number(quantity);
    if (qtyToDeduct <= 0) throw new Error('จำนวนที่ใช้ต้องมากกว่า 0');

    const logDate = used_date || new Date().toISOString().split('T')[0];

    if (isSupabase) {
      if (batch_id) {
        const { data: batch, error: bErr } = await supabase.from('inventory_batches').select('*').eq('id', batch_id).single();
        if (bErr || !batch) throw new Error('ไม่พบล็อตสินค้าที่ระบุ');
        if (Number(batch.quantity) < qtyToDeduct) {
          throw new Error(`สต็อกในล็อตนี้มีเพียง ${batch.quantity} ไม่พอตัด ${qtyToDeduct}`);
        }

        await supabase.from('inventory_batches').update({ quantity: Number(batch.quantity) - qtyToDeduct }).eq('id', batch_id);
        await supabase.from('usage_logs').insert({
          product_id,
          batch_id,
          quantity: qtyToDeduct,
          type: type || 'USE',
          used_date: logDate,
          used_by: used_by || '',
          purpose: purpose || '',
          notes: notes || ''
        });
      } else {
        // FIFO deduction in Supabase
        const { data: batches, error: fErr } = await supabase.from('inventory_batches')
          .select('*')
          .eq('product_id', product_id)
          .gt('quantity', 0)
          .order('expiry_date', { ascending: true });

        if (fErr) throw new Error(fErr.message);

        const totalAvailable = (batches || []).reduce((sum, b) => sum + Number(b.quantity), 0);
        if (totalAvailable < qtyToDeduct) {
          throw new Error(`สต็อกคงเหลือรวม (${totalAvailable}) ไม่เพียงพอสำหรับตัด ${qtyToDeduct}`);
        }

        let remaining = qtyToDeduct;
        for (const b of batches) {
          if (remaining <= 0) break;
          const currentQty = Number(b.quantity);
          const deduct = Math.min(currentQty, remaining);

          await supabase.from('inventory_batches').update({ quantity: currentQty - deduct }).eq('id', b.id);
          await supabase.from('usage_logs').insert({
            product_id,
            batch_id: b.id,
            quantity: deduct,
            type: type || 'USE',
            used_date: logDate,
            used_by: used_by || '',
            purpose: purpose || '',
            notes: notes || ''
          });

          remaining -= deduct;
        }
      }
      return true;
    } else {
      // SQLite FIFO transaction
      const transaction = sqliteDb.transaction(() => {
        let remainingToDeduct = qtyToDeduct;

        if (batch_id) {
          const batch = sqliteDb.prepare('SELECT * FROM inventory_batches WHERE id = ?').get(batch_id);
          if (!batch) throw new Error('ไม่พบล็อตสินค้าที่ระบุ');
          if (batch.quantity < qtyToDeduct) {
            throw new Error(`สต็อกในล็อตนี้มีเพียง ${batch.quantity} ไม่พอสำหรับตัด ${qtyToDeduct}`);
          }
          sqliteDb.prepare('UPDATE inventory_batches SET quantity = quantity - ? WHERE id = ?').run(qtyToDeduct, batch_id);
          sqliteDb.prepare(`
            INSERT INTO usage_logs (product_id, batch_id, quantity, type, used_date, used_by, purpose, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(product_id, batch_id, qtyToDeduct, type || 'USE', logDate, used_by || '', purpose || '', notes || '');
        } else {
          const activeBatches = sqliteDb.prepare(`
            SELECT * FROM inventory_batches
            WHERE product_id = ? AND quantity > 0
            ORDER BY expiry_date ASC
          `).all(product_id);

          const totalAvailable = activeBatches.reduce((sum, b) => sum + b.quantity, 0);
          if (totalAvailable < qtyToDeduct) {
            throw new Error(`สต็อกคงเหลือรวม (${totalAvailable}) ไม่เพียงพอสำหรับตัด ${qtyToDeduct}`);
          }

          for (const batch of activeBatches) {
            if (remainingToDeduct <= 0) break;
            const deductFromThisBatch = Math.min(batch.quantity, remainingToDeduct);
            sqliteDb.prepare('UPDATE inventory_batches SET quantity = quantity - ? WHERE id = ?').run(deductFromThisBatch, batch.id);
            sqliteDb.prepare(`
              INSERT INTO usage_logs (product_id, batch_id, quantity, type, used_date, used_by, purpose, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(product_id, batch.id, deductFromThisBatch, type || 'USE', logDate, used_by || '', purpose || '', notes || '');
            remainingToDeduct -= deductFromThisBatch;
          }
        }
      });

      transaction();
      return true;
    }
  },

  async getUsageLogs(limit = 100) {
    if (isSupabase) {
      const { data, error } = await supabase.from('usage_logs')
        .select('*, products(name, unit), inventory_batches(lot_number)')
        .order('used_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw new Error(error.message);

      return (data || []).map(u => ({
        ...u,
        product_name: u.products?.name,
        unit: u.products?.unit,
        lot_number: u.inventory_batches?.lot_number
      }));
    } else {
      return sqliteDb.prepare(`
        SELECT u.*, p.name AS product_name, p.unit, b.lot_number
        FROM usage_logs u
        JOIN products p ON u.product_id = p.id
        LEFT JOIN inventory_batches b ON u.batch_id = b.id
        ORDER BY u.used_date DESC, u.created_at DESC
        LIMIT ?
      `).all(limit);
    }
  },

  async getUsageSummary(days = 30) {
    const products = await this.getAllProducts();
    const logs = await this.getUsageLogs(500);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    return products.map(p => {
      const pLogs = logs.filter(l => l.product_id == p.id && l.used_date >= cutoffStr && l.type === 'USE');
      const totalUsed = pLogs.reduce((sum, l) => sum + Number(l.quantity), 0);
      const avgDaily = Number((totalUsed / days).toFixed(2));

      return {
        product_id: p.id,
        product_name: p.name,
        unit: p.unit,
        safety_stock: p.safety_stock,
        total_used: totalUsed,
        usage_count: pLogs.length,
        avg_daily_use: avgDaily
      };
    }).sort((a, b) => b.total_used - a.total_used);
  },

  async getAlertsData() {
    const today = new Date().toISOString().split('T')[0];
    const products = await this.getAllProducts();
    const batches = await this.getAllBatches();

    const lowStockItems = products.filter(p => p.is_low_stock);
    const activeBatches = batches.filter(b => b.quantity > 0);
    const expiringBatches = activeBatches.filter(b => b.days_until_expiry <= 7);
    const expiredBatches = activeBatches.filter(b => b.days_until_expiry < 0);
    const expiringSoonBatches = activeBatches.filter(b => b.days_until_expiry >= 0 && b.days_until_expiry <= 7);

    return {
      today,
      low_stock_items: lowStockItems,
      expiring_batches: expiringBatches,
      expired_batches: expiredBatches,
      expiring_soon_batches: expiringSoonBatches,
      summary: {
        total_products: products.length,
        low_stock_count: lowStockItems.length,
        expiring_soon_count: expiringSoonBatches.length,
        expired_count: expiredBatches.length
      }
    };
  }
};

module.exports = dbClient;

