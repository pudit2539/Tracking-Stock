const express = require('express');
const router = express.Router();
const stockService = require('../services/stockService');
const lineService = require('../services/lineService');
const cronService = require('../services/cronService');
const dbClient = require('../db/dbClient');

// 1. PRODUCTS
router.get('/products', async (req, res) => {
  try {
    const products = await stockService.getAllProducts();
    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/products/:id', async (req, res) => {
  try {
    const product = await stockService.getProductById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/products', async (req, res) => {
  try {
    const product = await stockService.createProduct(req.body);
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/products/:id', async (req, res) => {
  try {
    const product = await stockService.updateProduct(req.params.id, req.body);
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete('/products/:id', async (req, res) => {
  try {
    await stockService.deleteProduct(req.params.id);
    res.json({ success: true, message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/products/:id/safety-stock', async (req, res) => {
  try {
    const product = await stockService.updateSafetyStock(req.params.id, req.body.safety_stock);
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/products/:id/quick-update', async (req, res) => {
  try {
    const product = await stockService.quickUpdateProduct(req.params.id, req.body);
    res.json({ success: true, data: product });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 2. BATCHES
router.get('/batches', async (req, res) => {
  try {
    const batches = await stockService.getAllBatches();
    res.json({ success: true, data: batches });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/batches', async (req, res) => {
  try {
    const id = await stockService.createBatch(req.body);
    res.json({ success: true, data: { id } });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/batches/:id', async (req, res) => {
  try {
    await stockService.updateBatch(req.params.id, req.body);
    res.json({ success: true, message: 'Batch updated' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete('/batches/:id', async (req, res) => {
  try {
    await stockService.deleteBatch(req.params.id);
    res.json({ success: true, message: 'Batch deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. USAGE & PLANNING
router.get('/usage', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const logs = await stockService.getUsageLogs(limit);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/usage', async (req, res) => {
  try {
    await stockService.recordUsage(req.body);
    res.json({ success: true, message: 'บันทึกการใช้งานและตัดสต็อกเรียบร้อยแล้ว' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.get('/usage/summary', async (req, res) => {
  try {
    const days = parseInt(req.query.days, 10) || 30;
    const summary = await stockService.getUsageSummary(days);
    res.json({ success: true, data: summary });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. ALERTS & DASHBOARD STATS
router.get('/alerts', async (req, res) => {
  try {
    const alerts = await stockService.getAlertsData();
    res.json({ success: true, data: alerts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. SETTINGS
router.get('/settings', async (req, res) => {
  try {
    const settings = await dbClient.getAllSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const {
      line_channel_access_token,
      line_target_id,
      enable_low_stock_alert,
      enable_expiry_alert,
      daily_alert_time,
      default_expiry_alert_days,
      app_url
    } = req.body;

    if (line_channel_access_token !== undefined) await dbClient.saveSetting('line_channel_access_token', line_channel_access_token.trim());
    if (line_target_id !== undefined) await dbClient.saveSetting('line_target_id', line_target_id.trim());
    if (app_url !== undefined) await dbClient.saveSetting('app_url', app_url.trim());
    if (enable_low_stock_alert !== undefined) await dbClient.saveSetting('enable_low_stock_alert', enable_low_stock_alert ? '1' : '0');
    if (enable_expiry_alert !== undefined) await dbClient.saveSetting('enable_expiry_alert', enable_expiry_alert ? '1' : '0');
    if (default_expiry_alert_days !== undefined) await dbClient.saveSetting('default_expiry_alert_days', default_expiry_alert_days.toString());
    
    if (daily_alert_time !== undefined) {
      await dbClient.saveSetting('daily_alert_time', daily_alert_time);
      if (cronService && cronService.updateSchedule) {
        cronService.updateSchedule(daily_alert_time);
      }
    }

    res.json({ success: true, message: 'บันทึกการตั้งค่าเรียบร้อยแล้ว' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 5.1 LINE RECIPIENTS (Multiple Users & Groups)
router.get('/line/recipients', async (req, res) => {
  try {
    const recipients = await dbClient.getRecipients();
    res.json({ success: true, data: recipients });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/line/recipients', async (req, res) => {
  try {
    const recipient = await dbClient.createRecipient(req.body);
    res.json({ success: true, data: recipient, message: 'เพิ่มผู้รับการแจ้งเตือนสำเร็จ' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put('/line/recipients/:id', async (req, res) => {
  try {
    const recipient = await dbClient.updateRecipient(req.params.id, req.body);
    res.json({ success: true, data: recipient, message: 'แก้ไขข้อมูลผู้รับสำเร็จ' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.patch('/line/recipients/:id/toggle', async (req, res) => {
  try {
    const { is_active } = req.body;
    await dbClient.toggleRecipient(req.params.id, is_active);
    res.json({ success: true, message: 'อัปเดตสถานะผู้รับเรียบร้อยแล้ว' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete('/line/recipients/:id', async (req, res) => {
  try {
    await dbClient.deleteRecipient(req.params.id);
    res.json({ success: true, message: 'ลบผู้รับการแจ้งเตือนเรียบร้อยแล้ว' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. MANUAL LINE TRIGGERS
router.post('/line/test', async (req, res) => {
  try {
    const { target_id, token, app_url } = req.body;
    const host = req.get('host');
    const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const detectedUrl = app_url || (host ? `${protocol}://${host}` : null);
    const result = await lineService.sendTestMessage(target_id, token, detectedUrl);
    res.json({ success: true, message: 'ส่งข้อความทดสอบไปยัง LINE สำเร็จแล้ว!', result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/line/report', async (req, res) => {
  try {
    const { target_id, token, app_url } = req.body;
    const host = req.get('host');
    const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const detectedUrl = app_url || (host ? `${protocol}://${host}` : null);
    const alertsData = await stockService.getAlertsData();
    const result = await lineService.sendStockReport(alertsData, target_id, token, detectedUrl);
    res.json({ success: true, message: 'ส่งรายงานสต็อกและวันหมดอายุไปยัง LINE สำเร็จแล้ว!', result });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
