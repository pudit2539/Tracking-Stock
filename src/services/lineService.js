const dbClient = require('../db/dbClient');

const LINE_PUSH_API = 'https://api.line.me/v2/bot/message/push';

class LineService {
  constructor() {
    this.userCache = new Map();
  }

  async getUserDisplayName(source, token) {
    if (!source || !source.userId || !token) return 'พนักงาน';
    const userId = source.userId;
    const now = Date.now();
    const cached = this.userCache.get(userId);
    if (cached && (now - cached.timestamp < 300000)) {
      return cached.name;
    }

    try {
      let endpoint = `https://api.line.me/v2/bot/profile/${userId}`;
      if (source.type === 'group' && source.groupId) {
        endpoint = `https://api.line.me/v2/bot/group/${source.groupId}/member/${userId}`;
      } else if (source.type === 'room' && source.roomId) {
        endpoint = `https://api.line.me/v2/bot/room/${source.roomId}/member/${userId}`;
      }

      const res = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.displayName) {
          const name = data.displayName.trim();
          this.userCache.set(userId, { name, timestamp: now });
          return name;
        }
      }
    } catch (e) {
      console.warn('[LineService getUserDisplayName Warning]', e.message);
    }

    return source.type === 'group' ? 'พนักงานในกลุ่ม' : 'ผู้ใช้งาน';
  }

  async getSetting(key, defaultValue = '') {
    return dbClient.getSetting(key, defaultValue);
  }

  async saveSetting(key, value) {
    return dbClient.saveSetting(key, value);
  }

  async getAppUrl(currentUrl = null) {
    try {
      const savedUrl = await this.getSetting('app_url', '');
      if (savedUrl && savedUrl.trim()) {
        return savedUrl.trim();
      }
    } catch (e) {
      // ignore
    }
    if (currentUrl && currentUrl.trim()) {
      return currentUrl.trim();
    }
    if (process.env.APP_URL) {
      return process.env.APP_URL.trim();
    }
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
      return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}`;
    }
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL.trim()}`;
    }
    return '';
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
    let activeRecipients = [];
    try {
      activeRecipients = await dbClient.getActiveRecipients();
    } catch (err) {
      console.warn('⚠️ Could not fetch active recipients, fallback to default target:', err.message);
    }

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
  async sendTestMessage(targetId = null, token = null, currentUrl = null) {
    const webUrl = await this.getAppUrl(currentUrl);
    let text = '✅ ทดสอบการแจ้งเตือน LINE สำเร็จ\nระบบพร้อมใช้งานสำหรับการแจ้งเตือนสต็อกสินค้าและวันหมดอายุ';
    if (webUrl) {
      text += `\n\n🌐 แตะเพื่อเปิดเข้าระบบ:\n${webUrl}`;
    }
    const message = {
      type: 'text',
      text: text
    };
    return this.sendPushMessage(message, targetId, token);
  }

  // 2. Build Flex Message for Low Stock
  buildLowStockFlex(items, webUrl = null) {
    if (!items || items.length === 0) return null;

    const bodyContents = [];

    const maxDisplay = 15;
    const displayItems = items.slice(0, maxDisplay);

    displayItems.forEach((item, index) => {
      const itemRow = {
        type: 'box',
        layout: 'horizontal',
        alignItems: 'center',
        ...(webUrl ? { action: { type: 'uri', label: item.name, uri: `${webUrl}?tab=inventory&product_id=${item.id}` } } : {}),
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

      if (index < displayItems.length - 1) {
        bodyContents.push({
          type: 'separator',
          margin: 'md',
          color: '#F3F4F6'
        });
      }
    });

    if (items.length > maxDisplay) {
      bodyContents.push({
        type: 'separator',
        margin: 'md',
        color: '#E5E7EB'
      });
      bodyContents.push({
        type: 'box',
        layout: 'vertical',
        margin: 'md',
        paddingTop: '6px',
        contents: [
          {
            type: 'text',
            text: `... และอีก ${items.length - maxDisplay} รายการ (ตรวจสอบทั้งหมดบนเว็บ)`,
            size: 'xs',
            color: '#6B7280',
            align: 'center',
            weight: 'bold'
          }
        ]
      });
    }

    const bubble = {
      type: 'bubble',
      size: 'mega',
      ...(webUrl ? { action: { type: 'uri', label: 'เปิดระบบสต็อก', uri: `${webUrl}?tab=inventory&filter=LOW` } } : {}),
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#991B1B',
        paddingTop: '18px',
        paddingBottom: '16px',
        paddingStart: '20px',
        paddingEnd: '20px',
        ...(webUrl ? { action: { type: 'uri', label: 'เปิดระบบสต็อก', uri: `${webUrl}?tab=inventory&filter=LOW` } } : {}),
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
        paddingStart: '16px',
        paddingEnd: '16px',
        spacing: 'sm',
        contents: webUrl ? [
          {
            type: 'button',
            style: 'primary',
            color: '#DC2626',
            height: 'sm',
            action: {
              type: 'uri',
              label: '📱 เปิดเช็คสต็อกสินค้าใกล้หมด',
              uri: `${webUrl}?tab=inventory&filter=LOW`
            }
          },
          {
            type: 'text',
            text: '🛒 แตะเพื่อเปิดหน้าระบบสต็อกทันที',
            color: '#6B7280',
            size: 'xxs',
            align: 'center'
          }
        ] : [
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
    };

    return {
      type: 'flex',
      altText: `⚠️ แจ้งเตือนสินค้าใกล้หมด ${items.length} รายการ`,
      contents: bubble
    };
  }

  // 3. Build Flex Message for Expiring Items
  buildExpiringFlex(batches, webUrl = null) {
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
        ...(webUrl ? { action: { type: 'uri', label: batch.product_name || 'ดูข้อมูล', uri: `${webUrl}?tab=inventory&product_id=${batch.product_id || batch.id}` } } : {}),
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

    const bubble = {
      type: 'bubble',
      size: 'mega',
      ...(webUrl ? { action: { type: 'uri', label: 'เปิดระบบสต็อก', uri: `${webUrl}?tab=inventory&filter=EXPIRING` } } : {}),
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#B45309',
        paddingTop: '18px',
        paddingBottom: '16px',
        paddingStart: '20px',
        paddingEnd: '20px',
        ...(webUrl ? { action: { type: 'uri', label: 'เปิดระบบสต็อก', uri: `${webUrl}?tab=inventory&filter=EXPIRING` } } : {}),
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
        paddingStart: '16px',
        paddingEnd: '16px',
        spacing: 'sm',
        contents: webUrl ? [
          {
            type: 'button',
            style: 'primary',
            color: '#D97706',
            height: 'sm',
            action: {
              type: 'uri',
              label: '📱 เปิดเช็ควันหมดอายุสินค้า',
              uri: `${webUrl}?tab=inventory&filter=EXPIRING`
            }
          },
          {
            type: 'text',
            text: '⚡ แตะเพื่อเปิดหน้าระบบและจัดการล็อต',
            color: '#6B7280',
            size: 'xxs',
            align: 'center'
          }
        ] : [
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
    };

    return {
      type: 'flex',
      altText: `⏳ แจ้งเตือนสินค้าใกล้หมดอายุ ${batches.length} รายการ`,
      contents: bubble
    };
  }

  // 4. Send Live Stock & Expiry Report
  async sendStockReport(alertsData, targetId = null, token = null, currentUrl = null) {
    const messages = [];
    const webUrl = await this.getAppUrl(currentUrl);

    const enableLowStock = (await this.getSetting('enable_low_stock_alert', '1')) === '1';
    const enableExpiry = (await this.getSetting('enable_expiry_alert', '1')) === '1';

    if (enableLowStock && alertsData.low_stock_items.length > 0) {
      const lowStockFlex = this.buildLowStockFlex(alertsData.low_stock_items, webUrl);
      if (lowStockFlex) messages.push(lowStockFlex);
    }

    if (enableExpiry && alertsData.expiring_batches.length > 0) {
      const expiringFlex = this.buildExpiringFlex(alertsData.expiring_batches, webUrl);
      if (expiringFlex) messages.push(expiringFlex);
    }

    if (messages.length === 0) {
      let text = '🎉 ข้อมูลสต็อกสินค้าปกติ:\nไม่มีรายการสินค้าที่ต่ำกว่า Safety Stock หรือใกล้หมดอายุในขณะนี้ครับ';
      if (webUrl) {
        text += `\n\n🌐 เข้าสู่ระบบ: ${webUrl}`;
      }
      messages.push({
        type: 'text',
        text: text
      });
    }

    return this.sendPushMessage(messages, targetId, token);
  }

  // 5. Build Flex Message for Order List (One-Click Order Sharing)
  buildOrderListFlex(items, webUrl = null) {
    if (!items || items.length === 0) return null;

    const bodyContents = [];
    const maxDisplay = 20;
    const displayItems = items.slice(0, maxDisplay);

    displayItems.forEach((item, index) => {
      const orderQty = item.order_qty !== undefined ? item.order_qty : Math.max(1, (Number(item.safety_stock || 1) * 2) - Number(item.current_stock || 0));
      const itemRow = {
        type: 'box',
        layout: 'horizontal',
        alignItems: 'center',
        ...(webUrl ? { action: { type: 'uri', label: item.name, uri: `${webUrl}?tab=inventory&product_id=${item.id}` } } : {}),
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            width: '4px',
            backgroundColor: '#2563EB',
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
                color: '#1E293B'
              },
              {
                type: 'text',
                text: `${item.category || 'วัตถุดิบ'} · มีอยู่ ${item.current_stock} ${item.unit}`,
                size: 'xs',
                color: '#64748B',
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
                text: `สั่ง ${orderQty} ${item.unit}`,
                weight: 'bold',
                size: 'sm',
                color: '#059669'
              },
              {
                type: 'text',
                text: `Safety: ${item.safety_stock}`,
                size: 'xxs',
                color: '#94A3B8'
              }
            ]
          }
        ]
      };

      bodyContents.push(itemRow);

      if (index < displayItems.length - 1) {
        bodyContents.push({
          type: 'separator',
          margin: 'md',
          color: '#F1F5F9'
        });
      }
    });

    if (items.length > maxDisplay) {
      bodyContents.push({
        type: 'separator',
        margin: 'md',
        color: '#CBD5E1'
      });
      bodyContents.push({
        type: 'box',
        layout: 'vertical',
        margin: 'md',
        paddingTop: '4px',
        contents: [
          {
            type: 'text',
            text: `... และอีก ${items.length - maxDisplay} รายการ (เปิดดูทั้งหมดบนเว็บ)`,
            size: 'xs',
            color: '#64748B',
            align: 'center',
            weight: 'bold'
          }
        ]
      });
    }

    const bubble = {
      type: 'bubble',
      size: 'mega',
      ...(webUrl ? { action: { type: 'uri', label: 'เปิดระบบสต็อก', uri: `${webUrl}?tab=inventory&filter=LOW` } } : {}),
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#1E3A8A',
        paddingTop: '18px',
        paddingBottom: '16px',
        paddingStart: '20px',
        paddingEnd: '20px',
        ...(webUrl ? { action: { type: 'uri', label: 'เปิดระบบสต็อก', uri: `${webUrl}?tab=inventory&filter=LOW` } } : {}),
        contents: [
          {
            type: 'text',
            text: '🛒 ใบสั่งของ / สรุปรายการสั่งซื้อ',
            weight: 'bold',
            size: 'lg',
            color: '#FFFFFF'
          },
          {
            type: 'text',
            text: `พบ ${items.length} รายการที่ต้องสั่งซื้อเพิ่ม (Dairy Queen SAT)`,
            size: 'xs',
            color: '#93C5FD',
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
        backgroundColor: '#F8FAFC',
        paddingTop: '12px',
        paddingBottom: '12px',
        paddingStart: '16px',
        paddingEnd: '16px',
        spacing: 'sm',
        contents: webUrl ? [
          {
            type: 'button',
            style: 'primary',
            color: '#2563EB',
            height: 'sm',
            action: {
              type: 'uri',
              label: '📱 เปิดตรวจเช็คและรับของเข้าสต็อก',
              uri: `${webUrl}?tab=usage&subtab=inbound`
            }
          },
          {
            type: 'text',
            text: '📦 ตรวจรับสินค้าแล้วแตะเพื่ออัปเดตสต็อกทันที',
            color: '#64748B',
            size: 'xxs',
            align: 'center'
          }
        ] : [
          {
            type: 'text',
            text: '📦 รายการสั่งซื้อวัตถุดิบ Dairy Queen',
            color: '#2563EB',
            size: 'xs',
            align: 'center',
            weight: 'bold'
          }
        ]
      },
      styles: {
        header: { backgroundColor: '#1E3A8A' },
        footer: { separator: true }
      }
    };

    return {
      type: 'flex',
      altText: `🛒 รายการสั่งซื้อวัตถุดิบ ${items.length} รายการ (DQ SAT)`,
      contents: bubble
    };
  }

  // 6. Send Order Report to LINE
  async sendOrderReport(orderItems, targetId = null, token = null, currentUrl = null) {
    const webUrl = await this.getAppUrl(currentUrl);
    if (!orderItems || orderItems.length === 0) {
      return { success: false, error: 'ไม่มีรายการสินค้าที่ต้องสั่งซื้อ' };
    }
    const orderFlex = this.buildOrderListFlex(orderItems, webUrl);
    return this.sendPushMessage(orderFlex, targetId, token);
  }
}

module.exports = new LineService();
