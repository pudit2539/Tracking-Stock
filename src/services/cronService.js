const cron = require('node-cron');
const stockService = require('./stockService');
const lineService = require('./lineService');

let scheduledTask = null;

async function setupCron() {
  const alertTime = (await lineService.getSetting('daily_alert_time', '08:00')) || '08:00';
  const parts = String(alertTime).split(':');
  const hour = parseInt(parts[0], 10) || 8;
  const minute = parseInt(parts[1], 10) || 0;

  // Stop previous schedule if any
  if (scheduledTask) {
    scheduledTask.stop();
  }

  // Cron syntax: minute hour day month day-of-week
  const cronExpression = `${minute} ${hour} * * *`;
  console.log(`[Cron] Initializing daily alert schedule at ${alertTime} (cron: ${cronExpression})`);

  scheduledTask = cron.schedule(cronExpression, async () => {
    console.log(`[Cron] Triggering daily stock and expiry alert at ${new Date().toISOString()}`);
    try {
      const alertsData = await stockService.getAlertsData();
      if (alertsData.low_stock_items.length > 0 || alertsData.expiring_batches.length > 0) {
        await lineService.sendStockReport(alertsData);
        console.log('[Cron] Daily alert sent successfully via LINE');
      } else {
        console.log('[Cron] No low stock or expiring items found today. Skipping notification.');
      }
    } catch (err) {
      console.error('[Cron Error] Failed to send scheduled daily alert:', err.message);
    }
  });
}

async function updateSchedule(newTime) {
  await lineService.saveSetting('daily_alert_time', newTime);
  await setupCron();
}

module.exports = {
  setupCron,
  updateSchedule
};
