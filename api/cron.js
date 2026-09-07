require('dotenv').config();
const stockService = require('../src/services/stockService');
const lineService = require('../src/services/lineService');

// Vercel Cron Handler: Runs daily to send stock and expiry notifications
module.exports = async (req, res) => {
  console.log('[Vercel Cron] Triggered at:', new Date().toISOString());

  try {
    const alertsData = await stockService.getAlertsData();

    if (alertsData.low_stock_items.length > 0 || alertsData.expiring_batches.length > 0) {
      await lineService.sendStockReport(alertsData);
      return res.status(200).json({
        success: true,
        message: 'Daily LINE alert sent successfully!',
        low_stock_count: alertsData.low_stock_items.length,
        expiring_count: alertsData.expiring_batches.length
      });
    } else {
      return res.status(200).json({
        success: true,
        message: 'Stock is healthy. No alert needed today.'
      });
    }
  } catch (err) {
    console.error('[Vercel Cron Error]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
