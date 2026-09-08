const express = require('express');
const router = express.Router();
const lineService = require('../services/lineService');
const lineBotService = require('../services/lineBotService');
const dbClient = require('../db/dbClient');

// Webhook handler function
const handleWebhook = async (req, res) => {
  const events = req.body.events || [];
  const { token } = await lineService.getCredentials();

  console.log(`[LINE Webhook Received] Events count: ${events.length}`);

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

    // Auto-register to line_recipients table
    if (targetId) {
      try {
        await dbClient.createRecipient({
          name: `${targetType.split(' ')[0]} ${targetId.slice(0, 4)}...${targetId.slice(-4)}`,
          target_id: targetId,
          type: typeCode,
          is_active: 1
        });
      } catch (err) {
        // Already exists or DB busy
      }
    }

    const isJoin = event.type === 'join';
    const isTextMessage = event.type === 'message' && event.message.type === 'text';

    if (event.replyToken && token) {
      try {
        if (isJoin) {
          // Welcome greeting when bot joins a group
          const webUrl = await lineService.getAppUrl(req.protocol + '://' + req.get('host'));
          const replyRes = await fetch('https://api.line.me/v2/bot/message/reply', {
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
                  text: `👋 สวัสดีครับ! บอท Tracking สต็อก Dairy Queen เข้าร่วมกลุ่มเรียบร้อยแล้วครับ 🎉\n\n📌 Group ID: ${targetId}\n\n💡 สมาชิกในกลุ่มสามารถพิมพ์คำสั่งอัปเดตสต็อกได้ทันที เช่น:\n• "coke ใช้ไป 5"\n• "coke เหลือ 10"\n• "รับ coke 24"\n• "เช็คสต็อก"\n• "สั่งของ"\n• "วิธีใช้"\n\n🔗 ลิงก์ระบบ: ${webUrl}`
                }
              ]
            })
          });
          if (!replyRes.ok) {
            console.error('[LINE Join Reply Error]', replyRes.status, await replyRes.text());
          }
        } else if (isTextMessage) {
          const userText = event.message.text.trim();
          console.log(`[LINE Webhook Message] Text: "${userText}" from ${targetType} (${targetId})`);

          // Special command to check Group/User ID
          if (/^(ไอดี|id|groupid|myid|เช็คไอดี)$/i.test(userText)) {
            const replyRes = await fetch('https://api.line.me/v2/bot/message/reply', {
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
                    text: `📌 ข้อมูลปลายทางของคุณ:\nประเภท: ${targetType}\nID: ${targetId}\n\nสถานะ: ลงทะเบียนรับแจ้งเตือนอัตโนมัติเรียบร้อยแล้วครับ ✅`
                  }
                ]
              })
            });
            if (!replyRes.ok) {
              console.error('[LINE ID Reply Error]', replyRes.status, await replyRes.text());
            }
            continue;
          }

          // Let lineBotService parse and handle conversational stock commands
          const currentUrl = req.protocol + '://' + req.get('host');
          const senderName = event.source.type === 'group' ? 'พนักงานในกลุ่ม' : 'ผู้ใช้งาน';
          let replyMessage = await lineBotService.handleMessage(userText, senderName, currentUrl);

          // In 1-on-1 direct chat, if bot doesn't understand command, provide guidance
          if (!replyMessage && event.source.type === 'user') {
            const webUrl = await lineService.getAppUrl(currentUrl);
            replyMessage = {
              type: 'text',
              text: `🤖 ได้ยินแล้วครับ! แต่บอทยังไม่เข้าใจคำสั่ง "${userText}"\n\n💡 ลองพิมพ์คำว่า "วิธีใช้" เพื่อดูตัวอย่างคำสั่ง เช่น:\n• "coke ใช้ไป 5"\n• "รับ coke 24"\n• "coke เหลือ 10"\n• "สั่งของ"\n\n🔗 หรือเปิดเว็บ: ${webUrl}`
            };
          }

          if (replyMessage) {
            const replyRes = await fetch('https://api.line.me/v2/bot/message/reply', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                replyToken: event.replyToken,
                messages: [replyMessage]
              })
            });
            if (!replyRes.ok) {
              console.error('[LINE Bot Reply Error]', replyRes.status, await replyRes.text());
            } else {
              console.log(`[LINE Bot Reply Success] Replied to "${userText}"`);
            }
          }
        }
      } catch (e) {
        console.error('[LINE Webhook Processing Error]', e.message);
      }
    }
  }

  res.status(200).send('OK');
};

router.post('/webhook', handleWebhook);
router.post('/', handleWebhook);

router.get('/webhook', (req, res) => {
  res.json({ success: true, status: 'active', message: 'LINE Webhook endpoint is active and listening for events!' });
});

router.get('/', (req, res) => {
  res.json({ success: true, status: 'active', message: 'LINE Webhook endpoint is active and listening for events!' });
});

module.exports = router;
