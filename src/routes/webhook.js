const express = require('express');
const router = express.Router();
const lineService = require('../services/lineService');
const dbClient = require('../db/dbClient');

// Webhook endpoint to auto-discover and register User ID or Group ID
router.post('/webhook', async (req, res) => {
  const events = req.body.events || [];
  const { token } = await lineService.getCredentials();

  for (const event of events) {
    let targetId = '';
    let targetType = '';
    let typeCode = 'USER';

    if (event.source.type === 'group') {
      targetId = event.source.groupId;
      targetType = 'LINE กลุ่ม (Group)';
      typeCode = 'GROUP';
    } else if (event.source.type === 'room') {
      targetId = event.source.roomId;
      targetType = 'LINE ห้องแชท (Room)';
      typeCode = 'GROUP';
    } else {
      targetId = event.source.userId;
      targetType = 'LINE ส่วนตัว (User)';
      typeCode = 'USER';
    }

    console.log(`[LINE Webhook] Event from ${targetType}: ID = ${targetId}`);

    // Auto-register to line_recipients table so user doesn't even need to type it!
    if (targetId) {
      try {
        await dbClient.createRecipient({
          name: `${targetType.split(' ')[0]} ${targetId.slice(0, 4)}...${targetId.slice(-4)}`,
          target_id: targetId,
          type: typeCode,
          is_active: 1
        });
        console.log(`[LINE Webhook] ✅ Auto-registered recipient: ${targetId}`);
      } catch (err) {
        console.log(`[LINE Webhook Recipient Exists or Info]:`, err.message);
      }
    }

    const isJoin = event.type === 'join';
    const isMessage = event.type === 'message' && event.message.type === 'text';

    if ((isJoin || isMessage) && event.replyToken && token) {
      try {
        await fetch('https://api.line.me/v2/bot/message/reply', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            replyToken: event.replyToken,
            messages: [
              {
                type: 'text',
                text: `📌 บันทึก ${targetType} เข้าสู่ระบบแล้ว!\nID: ${targetId}\n\nระบบ Tracking ได้เพิ่มปลายทางนี้เข้าสู่รายชื่อรับแจ้งเตือนอัตโนมัติเรียบร้อยครับ 🎉`
              }
            ]
          })
        });
      } catch (e) {
        console.error('[LINE Webhook Reply Error]', e.message);
      }
    }
  }

  res.status(200).send('OK');
});

module.exports = router;
