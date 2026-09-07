const express = require('express');
const router = express.Router();
const lineService = require('../services/lineService');

// Optional Webhook endpoint to easily discover User ID or Group ID
router.post('/webhook', async (req, res) => {
  const events = req.body.events || [];
  const { token } = lineService.getCredentials();

  for (const event of events) {
    let targetId = '';
    let targetType = '';

    if (event.source.type === 'group') {
      targetId = event.source.groupId;
      targetType = 'LINE Group (กลุ่ม)';
    } else if (event.source.type === 'room') {
      targetId = event.source.roomId;
      targetType = 'LINE Room (ห้องสนทนา)';
    } else {
      targetId = event.source.userId;
      targetType = 'LINE User (แชทส่วนตัว)';
    }

    console.log(`[LINE Webhook] Event from ${targetType}: ID = ${targetId}`);

    // Auto-save group ID to settings so user doesn't even need to copy-paste manually!
    if (targetId.startsWith('C') || targetId.startsWith('R')) {
      lineService.saveSetting('line_target_id', targetId);
      console.log(`[LINE Webhook] ✅ Auto-saved Group ID to system settings: ${targetId}`);
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
                text: `📌 ตรวจพบ ${targetType}!\nTarget ID: ${targetId}\n\n(คุณสามารถคัดลอก ID นี้ไปวางในช่อง LINE Target ID ในหน้าตั้งค่าของระบบ Tracking ได้เลยครับ)`
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

