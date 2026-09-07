const dbClient = require('../db/dbClient');

const LINE_PUSH_API = 'https://api.line.me/v2/bot/message/push';

class LineService {
  async getSetting(key, defaultValue = '') {
    return dbClient.getSetting(key, defaultValue);
  }

  async saveSetting(key, value) {
    return dbClient.saveSetting(key, value);
  }

  async getCredentials() {
    const token = await this.getSetting('line_channel_access_token', process.env.LINE_CHANNEL_ACCESS_TOKEN || '');
    const targetId = await this.getSetting('line_target_id', process.env.LINE_TARGET_ID || '');
    return { token, targetId };
  }

  async sendToSingleTarget(token, targetId, messages) {
    const payload = {
      to: targetId,
      messages: Array.isArray(messages) ? messages : [messages]
    };

    const res = await fetch(LINE_PUSH_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errorBody = await res.text();
      let errorMsg = `LINE API Error (${res.status}): ${res.statusText}`;
      try {
        const json = JSON.parse(errorBody);
        if (json.message) errorMsg += ` - ${json.message}`;
        if (json.details) errorMsg += ` (${JSON.stringify(json.details)})`;
      } catch {
        errorMsg += ` - ${errorBody}`;
      }
      throw new Error(errorMsg);
    }

    return true;
  }

  async sendPushMessage(messages, customTargetId = null, customToken = null) {
    const { token: defaultToken, targetId: defaultTarget } = await this.getCredentials();
    const token = customToken || defaultToken;

    if (!token) {
      throw new Error('กรุณากรอก LINE Channel Access Token ในหน้าตั้งค่า');
    }

    // Case 1: Send to a specific target directly
    if (customTargetId) {
      await this.sendToSingleTarget(token, customTargetId, messages);
      await this.saveSetting('last_alert_sent_at', new Date().toISOString());
      return { success: true, count: 1, targets: [customTargetId] };
    }

    // Case 2: Send to all active recipients in list
    const activeRecipients = await dbClient.getActiveRecipients();

    if (activeRecipients && activeRecipients.length > 0) {
      const results = [];
      const errors = [];

      for (const rec of activeRecipients) {
        try {
          await this.sendToSingleTarget(token, rec.target_id, messages);
          results.push({ id: rec.id, name: rec.name, target_id: rec.target_id, status: 'OK' });
        } catch (err) {
          console.error(`[LINE Error sending to ${rec.name} (${rec.target_id})]:`, err.message);
          errors.push({ id: rec.id, name: rec.name, target_id: rec.target_id, error: err.message });
        }
      }

      if (results.length > 0) {
        await this.saveSetting('last_alert_sent_at', new Date().toISOString());
      }

      if (results.length === 0 && errors.length > 0) {
        throw new Error(`ส่งไม่สำเร็จทุกปลายทาง: ${errors.map(e => `${e.name}: ${e.error}`).join('; ')}`);
      }

      return {
        success: true,
        count: results.length,
        total: activeRecipients.length,
        delivered: results,
        failed: errors
      };
    }

    // Case 3: Fallback to single target in settings
    if (defaultTarget) {
      await this.sendToSingleTarget(token, defaultTarget, messages);
      await this.saveSetting('last_alert_sent_at', new Date().toISOString());
      return { success: true, count: 1, targets: [defaultTarget] };
    }

    throw new Error('ยังไม่มีผู้รับหรือกลุ่มที่เปิดรับการแจ้งเตือน (กรุณาเพิ่มในตารางผู้รับ)');
  }

  // 1. Send Test Notification
  async sendTestMessage(targetId = null, token = null) {
    const message = {
      type: 'text',
      text: '✅ ทดสอบการแจ้งเตือน LINE สำเร็จ\nระบบพร้อมใช้งานสำหรับการแจ้งเตือนสต็อกสินค้าและวันหมดอายุ'
    };
    return this.sendPushMessage(message, targetId, token);
  }

  // 2. Build Flex Message for Low Stock
  buildLowStockFlex(items) {
    if (!items || items.length === 0) return null;

    const bodyContents = [];

    items.forEach((item, index) => {
      const itemRow = {
        type: 'box',
        layout: 'horizontal',
        alignItems: 'center',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            width: '4px',
            backgroundColor: '#DC2626',
            cornerRadius: '2px',
            contents: [{ type: 'filler' }]
          },
          {
            type: 'box',
            layout: 'vertical',
            flex: 6,
            margin: 'md',
            contents: [
              {
                type: 'text',
                text: item.name,
                weight: 'bold',
                size: 'sm',
                color: '#1F2937'
              },
              {
                type: 'text',
                text: `ใกล้หมด · Safety ${item.safety_stock} ${item.unit}`,
                size: 'xs',
                color: '#6B7280',
                margin: 'xs'
              }
            ]
          },
          {
            type: 'box',
            layout: 'vertical',
            flex: 4,
            alignItems: 'flex-end',
            contents: [
              {
                type: 'text',
                text: `เหลือ ${item.current_stock}`,
                weight: 'bold',
                size: 'sm',
                color: '#DC2626'
              },
              {
                type: 'text',
                text: item.unit,
                size: 'xxs',
                color: '#9CA3AF'
              }
            ]
          }
        ]
      };

      bodyContents.push(itemRow);

      if (index < items.length - 1) {
        bodyContents.push({
          type: 'separator',
          margin: 'md',
          color: '#F3F4F6'
        });
      }
    });

    return {
      type: 'flex',
      altText: `⚠️ แจ้งเตือนสินค้าใกล้หมด ${items.length} รายการ`,
      contents: {
        type: 'bubble',
        size: 'mega',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#991B1B',
          paddingTop: '18px',
          paddingBottom: '16px',
          paddingStart: '20px',
          paddingEnd: '20px',
          contents: [
            {
              type: 'text',
              text: '⚠️ แจ้งเตือนสินค้าใกล้หมด',
              weight: 'bold',
              size: 'lg',
              color: '#FFFFFF'
            },
            {
              type: 'text',
              text: `พบ ${items.length} รายการที่ต่ำกว่า Safety Stock`,
              size: 'xs',
              color: '#FECACA',
              margin: 'xs'
            }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          paddingTop: '16px',
          paddingBottom: '16px',
          paddingStart: '20px',
          paddingEnd: '20px',
          spacing: 'md',
          contents: bodyContents
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#F9FAFB',
          paddingTop: '12px',
          paddingBottom: '12px',
          contents: [
            {
              type: 'text',
              text: '🛒 กรุณาสั่งซื้อวัตถุดิบเพิ่มเติม',
              color: '#3B82F6',
              size: 'xs',
              align: 'center',
              weight: 'bold'
            }
          ]
        },
        styles: {
          header: { backgroundColor: '#991B1B' },
          footer: { separator: true }
        }
      }
    };
  }

  // 3. Build Flex Message for Expiring Items
  buildExpiringFlex(batches) {
    if (!batches || batches.length === 0) return null;

    const bodyContents = [];

    batches.forEach((batch, index) => {
      const isExpired = batch.days_until_expiry < 0;
      const statusColor = isExpired ? '#DC2626' : (batch.days_until_expiry <= 3 ? '#EA580C' : '#D97706');
      const statusText = isExpired 
        ? `หมดอายุแล้ว (${Math.abs(batch.days_until_expiry)} วันก่อน)` 
        : (batch.days_until_expiry === 0 ? 'หมดอายุวันนี้!' : `อีก ${batch.days_until_expiry} วันหมดอายุ`);

      const batchRow = {
        type: 'box',
        layout: 'horizontal',
        alignItems: 'center',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            width: '4px',
            backgroundColor: statusColor,
            cornerRadius: '2px',
            contents: [{ type: 'filler' }]
          },
          {
            type: 'box',
            layout: 'vertical',
            flex: 6,
            margin: 'md',
            contents: [
              {
                type: 'text',
                text: batch.product_name || batch.name,
                weight: 'bold',
                size: 'sm',
                color: '#1F2937'
              },
              {
                type: 'text',
                text: `ล็อต ${batch.lot_number || '-'} · คงเหลือ ${batch.quantity} ${batch.unit || ''}`,
                size: 'xs',
                color: '#6B7280',
                margin: 'xs'
              }
            ]
          },
          {
            type: 'box',
            layout: 'vertical',
            flex: 4,
            alignItems: 'flex-end',
            contents: [
              {
                type: 'text',
                text: statusText,
                weight: 'bold',
                size: 'xs',
                color: statusColor
              },
              {
                type: 'text',
                text: batch.expiry_date,
                size: 'xxs',
                color: '#9CA3AF',
                margin: 'xs'
              }
            ]
          }
        ]
      };

      bodyContents.push(batchRow);

      if (index < batches.length - 1) {
        bodyContents.push({
          type: 'separator',
          margin: 'md',
          color: '#F3F4F6'
        });
      }
    });

    return {
      type: 'flex',
      altText: `⏳ แจ้งเตือนสินค้าใกล้หมดอายุ ${batches.length} รายการ`,
      contents: {
        type: 'bubble',
        size: 'mega',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#B45309',
          paddingTop: '18px',
          paddingBottom: '16px',
          paddingStart: '20px',
          paddingEnd: '20px',
          contents: [
            {
              type: 'text',
              text: '⏳ แจ้งเตือนวันหมดอายุสินค้า',
              weight: 'bold',
              size: 'lg',
              color: '#FFFFFF'
            },
            {
              type: 'text',
              text: `พบ ${batches.length} รายการที่ใกล้หรือหมดอายุแล้ว`,
              size: 'xs',
              color: '#FEF3C7',
              margin: 'xs'
            }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          paddingTop: '16px',
          paddingBottom: '16px',
          paddingStart: '20px',
          paddingEnd: '20px',
          spacing: 'md',
          contents: bodyContents
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#F9FAFB',
          paddingTop: '12px',
          paddingBottom: '12px',
          contents: [
            {
              type: 'text',
              text: '⚡ กรุณาตรวจสอบและเร่งนำไปใช้ก่อนหมดอายุ',
              color: '#D97706',
              size: 'xs',
              align: 'center',
              weight: 'bold'
            }
          ]
        },
        styles: {
          header: { backgroundColor: '#B45309' },
          footer: { separator: true }
        }
      }
    };
  }

  // 4. Send Live Stock & Expiry Report
  async sendStockReport(alertsData, targetId = null, token = null) {
    const messages = [];

    const enableLowStock = (await this.getSetting('enable_low_stock_alert', '1')) === '1';
    const enableExpiry = (await this.getSetting('enable_expiry_alert', '1')) === '1';

    if (enableLowStock && alertsData.low_stock_items.length > 0) {
      const lowStockFlex = this.buildLowStockFlex(alertsData.low_stock_items);
      if (lowStockFlex) messages.push(lowStockFlex);
    }

    if (enableExpiry && alertsData.expiring_batches.length > 0) {
      const expiringFlex = this.buildExpiringFlex(alertsData.expiring_batches);
      if (expiringFlex) messages.push(expiringFlex);
    }

    if (messages.length === 0) {
      messages.push({
        type: 'text',
        text: '🎉 ข้อมูลสต็อกสินค้าปกติ:\nไม่มีรายการสินค้าที่ต่ำกว่า Safety Stock หรือใกล้หมดอายุในขณะนี้ครับ'
      });
    }

    return this.sendPushMessage(messages, targetId, token);
  }
}

module.exports = new LineService();
