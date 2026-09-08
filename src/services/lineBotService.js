const dbClient = require('../db/dbClient');
const lineService = require('./lineService');

const PRODUCT_ALIASES = [
  // แก้ว & ฝา
  { name: 'แก้วซันเดย์', aliases: ['แก้วซันเดย์', 'ซันเดย์', 'sundae cup', 'cup sundae'] },
  { name: 'แก้ว8oz', aliases: ['แก้ว8oz', 'แก้ว8', 'แก้ว 8 oz', 'แก้ว 8', 'cup 8oz', '8oz'] },
  { name: 'แก้ว12oz', aliases: ['แก้ว12oz', 'แก้ว12', 'แก้ว 12 oz', 'แก้ว 12', 'cup 12oz', '12oz'] },
  { name: 'แก้ว16oz', aliases: ['แก้ว16oz', 'แก้ว16', 'แก้ว 16 oz', 'แก้ว 16', 'cup 16oz', '16oz'] },
  { name: 'แก้ว16oz BZ', aliases: ['แก้ว16oz bz', 'แก้ว16 bz', 'แก้ว 16 bz', '16 bz', '16bz', 'แก้ว bz 16'] },
  { name: 'ฝา BZ.16 oz', aliases: ['ฝา bz.16 oz', 'ฝา bz 16', 'ฝา bz.16', 'ฝา bz', 'ฝา16bz', 'ฝา 16 bz', 'ฝาbz'] },
  { name: 'แก้ว 22 oz', aliases: ['แก้ว 22 oz', 'แก้ว22oz', 'แก้ว22', 'แก้ว 22', '22oz', '22 oz'] },
  { name: 'ฝาแก้ว 22 oz', aliases: ['ฝาแก้ว 22 oz', 'ฝาแก้ว 22', 'ฝาแก้ว22', 'ฝา 22 oz', 'ฝา 22', 'ฝา22'] },
  { name: 'แก้วCoke 32oz', aliases: ['แก้วcoke 32oz', 'แก้ว coke 32', 'แก้วโค้ก 32', 'แก้ว 32', 'แก้ว32oz', 'แก้ว32', '32oz'] },
  { name: 'ฝาแก้ว 32 oz', aliases: ['ฝาแก้ว 32 oz', 'ฝาแก้ว 32', 'ฝาแก้ว32', 'ฝา 32 oz', 'ฝา 32', 'ฝา32'] },

  // ช้อน & หลอด & หีบห่อ
  { name: 'ช้อนสั้น', aliases: ['ช้อนสั้น', 'ช้อนเล็ก', 'short spoon'] },
  { name: 'ช้อนยาว', aliases: ['ช้อนยาว', 'ช้อนบลิซซาร์ด', 'long spoon'] },
  { name: 'หลอด', aliases: ['หลอด', 'หลอดดูด', 'straw'] },
  { name: 'โคน', aliases: ['โคน', 'cone', 'ไอติมโคน'] },
  { name: 'ปอกโคน', aliases: ['ปอกโคน', 'ปลอกโคน', 'cone sleeve'] },
  { name: 'แนปกิ้น', aliases: ['แนปกิ้น', 'แนพกิ้น', 'กระดาษแนปกิ้น', 'ทิชชู่', 'napkin'] },
  { name: 'Box hotdag', aliases: ['box hotdag', 'box hotdog', 'กล่องฮอทดอก', 'กล่องฮอทด็อก', 'กล่อง hotdog', 'กล่องhotdog'] },
  { name: 'Wrap hotdog', aliases: ['wrap hotdog', 'แรปฮอทดอก', 'กระดาษห่อฮอทดอก', 'ห่อ hotdog', 'wrap hotdag'] },
  { name: 'ถุงขาว', aliases: ['ถุงขาว', 'ถุงหิ้วขาว', 'white bag'] },
  { name: 'มีด', aliases: ['มีด', 'knife'] },
  { name: 'ส้อม', aliases: ['ส้อม', 'fork'] },

  // ท็อปปิ้ง & วัตถุดิบ
  { name: 'ผงโกโก้', aliases: ['ผงโกโก้', 'โกโก้', 'cocoa', 'cocoa powder'] },
  { name: 'Oreo', aliases: ['oreo', 'โอริโอ้', 'โอริโอ', 'คุ้กกี้โอริโอ้'] },
  { name: 'นมจืด', aliases: ['นมจืด', 'นมสด', 'นม', 'milk', 'fresh milk'] },
  { name: 'โกโก้ฟัด', aliases: ['โกโก้ฟัด', 'ฟัดจ์', 'โกโก้ฟัดจ์', 'cocoa fudge', 'fudge'] },
  { name: 'ช็อคดิป', aliases: ['ช็อคดิป', 'ช็อกดิป', 'ช็อคโกแลตดิป', 'choc dip', 'dip'] },
  { name: 'คาราเมล', aliases: ['คาราเมล', 'caramel'] },
  { name: 'ช็อคท็อปปิ้ง', aliases: ['ช็อคท็อปปิ้ง', 'ช็อกท็อปปิ้ง', 'ท็อปปิ้งช็อค', 'choc topping'] },
  { name: 'อัลมอนด์', aliases: ['อัลมอนด์', 'อัลมอน', 'almond'] },
  { name: 'ชาเขียว', aliases: ['ชาเขียว', 'ผงชาเขียว', 'green tea', 'matcha'] },
  { name: 'แก๊สบอม', aliases: ['แก๊สบอม', 'แก๊ส', 'บอมบ์', 'gas bomb', 'gas'] },
  { name: 'Kitkat', aliases: ['kitkat', 'คิทแคท', 'คิดแคท'] },

  // ซอส & เครื่องดื่ม
  { name: 'ซอสมะเขือเทศ', aliases: ['ซอสมะเขือเทศ', 'มะเขือเทศ', 'ซอสมะเขือ', 'ketchup', 'tomato sauce'] },
  { name: 'ซอสพริก', aliases: ['ซอสพริก', 'พริก', 'chilli sauce', 'chili sauce'] },
  { name: 'กาแฟ', aliases: ['กาแฟ', 'coffee', 'ผงกาแฟ'] },
  { name: 'Purra', aliases: ['purra', 'เพอร์ร่า', 'น้ำเพอร์ร่า', 'น้ำดื่มเพอร์ร่า'] },
  { name: 'เอเวียงฝาแดง', aliases: ['เอเวียงฝาแดง', 'เอเวียง', 'น้ำเอเวียง', 'evian'] },
  { name: 'ชเวปเขียว', aliases: ['ชเวปเขียว', 'ชเวปส์เขียว', 'schweppes green'] },
  { name: 'ชเวปม่วง', aliases: ['ชเวปม่วง', 'ชเวปส์ม่วง', 'schweppes purple'] },
  { name: 'ชเวปชมพู', aliases: ['ชเวปชมพู', 'ชเวปส์ชมพู', 'schweppes pink'] },
  { name: 'Perrier', aliases: ['perrier', 'เปอริเอ้', 'เพอริเอ้'] },
  { name: 'Perrier Lemon', aliases: ['perrier lemon', 'เปอริเอ้มะนาว', 'เพอริเอ้เลมอน', 'perrier มะนาว'] },
  { name: 'Cokeกด', aliases: ['cokeกด', 'โค้กกด', 'coke กด', 'โค้ก กด', 'น้ำโค้ก', 'coke syrup', 'น้ำหวานโค้ก'] },
  { name: 'Cokeขวดฝาแดง', aliases: ['cokeขวดฝาแดง', 'cokeขวด', 'โค้กขวด', 'โค้กฝาแดง', 'coke ฝาแดง', 'coke', 'โค้ก'] },

  // อุปกรณ์ & ของใช้
  { name: 'วอวิค', aliases: ['วอวิค', 'vorwick', 'warwick'] },
  { name: 'โรล เปปเซฟ', aliases: ['โรล เปปเซฟ', 'เปปเซฟ', 'โรลเปปเซฟ', 'pepsafe', 'roll pepsafe'] },
  { name: 'ถุงขยะใหญ่', aliases: ['ถุงขยะใหญ่', 'ถุงดำใหญ่', 'ถุงขยะดำ'] },
  { name: 'ถุงขยะเล็ก', aliases: ['ถุงขยะเล็ก', 'ถุงดำเล็ก'] },
  { name: 'Hand towel', aliases: ['hand towel', 'แฮนด์ทาวเวล', 'กระดาษเช็ดมือ', 'ผ้าเช็ดมือ', 'ทาวเวล'] },
  { name: 'ถุงมือS', aliases: ['ถุงมือs', 'ถุงมือ s', 'glove s', 'ถุงมือไซส์ s'] },
  { name: 'ถุงมือM', aliases: ['ถุงมือm', 'ถุงมือ m', 'glove m', 'ถุงมือไซส์ m'] },
  { name: 'ถังแดง', aliases: ['ถังแดง', 'red bucket'] },
  { name: 'ขวดใส่ท็อปปิ้ง', aliases: ['ขวดใส่ท็อปปิ้ง', 'ขวดท็อปปิ้ง', 'topping bottle'] },
  { name: 'มัลติ', aliases: ['มัลติ', 'multi'] }
];

class LineBotService {
  findProduct(text) {
    const clean = text.toLowerCase().trim();
    for (const item of PRODUCT_ALIASES) {
      for (const alias of item.aliases) {
        if (clean.includes(alias.toLowerCase())) {
          return item.name;
        }
      }
    }
    return null;
  }

  extractQuantity(text) {
    const match = text.match(/(\d+(\.\d+)?)/);
    if (match) {
      return parseFloat(match[1]);
    }
    return null;
  }

  parseIntent(text) {
    const raw = text.toLowerCase().trim();

    // 1. HELP / GUIDE
    if (/^(วิธีใช้|คำสั่ง|คู่มือ|help|เมนู|\?)$/i.test(raw)) {
      return { action: 'HELP' };
    }

    // 2. ORDER LIST
    if (/^(สั่งของ|ของหมด|ของใกล้หมด|order|สรุปสั่งของ)$/i.test(raw) || raw.includes('สรุปของหมด') || raw.includes('ต้องสั่งอะไร')) {
      return { action: 'ORDER_LIST' };
    }

    // 3. OVERVIEW CHECK STOCK
    if (/^(เช็คสต็อก|สต็อก|คงเหลือ|เช็คของ|stock)$/i.test(raw)) {
      return { action: 'STOCK_OVERVIEW' };
    }

    const prodName = this.findProduct(raw);
    const qty = this.extractQuantity(raw);

    // 4. DEDUCT / USE (ใช้ไปแล้ว, ใช้, ตัด, เบิก, -)
    if (/(ใช้ไปแล้ว|ใช้ไป|ใช้|ตัด|เบิก|หัก|เอาไป|use|minus|-)/i.test(raw)) {
      if (prodName && qty !== null) {
        return { action: 'USE', productName: prodName, quantity: qty };
      }
    }

    // 5. SET / COUNT (เหลือ, นับได้, ปรับเป็น, มีอยู่)
    if (/(เหลือ|นับได้|นับ|มีอยู่|ปรับเป็น|set|count)/i.test(raw)) {
      if (prodName && qty !== null) {
        return { action: 'SET_STOCK', productName: prodName, quantity: qty };
      }
    }

    // 6. ADD / RECEIVE (รับ, เติม, เข้า, ซื้อมา, +)
    if (/(รับเข้า|รับ|เติม|เข้า|ซื้อมา|add|\+)/i.test(raw)) {
      if (prodName && qty !== null) {
        return { action: 'ADD_STOCK', productName: prodName, quantity: qty };
      }
    }

    // 7. SPECIFIC ITEM CHECK (เช็ค coke, coke เหลือเท่าไหร่)
    if (prodName && /(เช็ค|ดู|เหลือเท่าไหร่|มีมั้ย|เท่าไหร่)/i.test(raw)) {
      return { action: 'CHECK_ITEM', productName: prodName };
    }

    // Fallback if product and number found without explicit verb, assume USE if "coke 5"
    if (prodName && qty !== null) {
      return { action: 'USE', productName: prodName, quantity: qty };
    }

    return null;
  }

  async handleMessage(text, senderName = 'พนักงาน', currentUrl = null) {
    const intent = this.parseIntent(text);
    if (!intent) return null;

    const webUrl = await lineService.getAppUrl(currentUrl);

    // ACTION: HELP
    if (intent.action === 'HELP') {
      return this.buildHelpFlex(webUrl);
    }

    // ACTION: ORDER LIST
    if (intent.action === 'ORDER_LIST') {
      const alerts = await dbClient.getAlertsData();
      const lowItems = alerts.low_stock_items;
      if (!lowItems || lowItems.length === 0) {
        return {
          type: 'text',
          text: '🎉 สต็อกสินค้าทุกรายการเพียงพอครับ ไม่มีสินค้าที่ต่ำกว่า Safety Stock ในขณะนี้ 👍'
        };
      }
      return lineService.buildOrderListFlex(lowItems, webUrl);
    }

    // ACTION: STOCK OVERVIEW
    if (intent.action === 'STOCK_OVERVIEW') {
      const alerts = await dbClient.getAlertsData();
      const prods = await dbClient.getAllProducts();
      return this.buildOverviewFlex(prods, alerts, webUrl);
    }

    // PRODUCT ACTIONS
    const allProducts = await dbClient.getAllProducts();
    const product = allProducts.find(p => p.name === intent.productName);

    if (!product) {
      return {
        type: 'text',
        text: `⚠️ ไม่พบสินค้า "${intent.productName}" ในระบบ กรุณาพิมพ์ "วิธีใช้" เพื่อดูตัวอย่างคำสั่งครับ`
      };
    }

    // ACTION: CHECK ITEM
    if (intent.action === 'CHECK_ITEM') {
      return this.buildItemDetailFlex(product, webUrl);
    }

    // ACTION: USE (ตัดสต็อก)
    if (intent.action === 'USE') {
      try {
        const qty = intent.quantity;
        const batches = await dbClient.getBatchesByProductId(product.id);
        const totalAvailable = batches.reduce((sum, b) => sum + Number(b.quantity), 0);

        if (totalAvailable <= 0) {
          await dbClient.recordUsage({
            product_id: product.id,
            quantity: qty,
            type: 'USE',
            used_by: senderName,
            notes: 'ตัดผ่านแชต LINE (สต็อกเดิมเป็น 0)'
          }).catch(() => {});
          
          return this.buildDeductionResultFlex(product, qty, 0, true, webUrl);
        }

        await dbClient.recordUsage({
          product_id: product.id,
          quantity: Math.min(qty, totalAvailable),
          type: 'USE',
          used_by: senderName,
          notes: 'ตัดผ่านแชต LINE'
        });

        const updated = await dbClient.getProductById(product.id);
        const newStock = updated.current_stock;
        const isLow = newStock <= Number(updated.safety_stock);

        return this.buildDeductionResultFlex(updated, qty, newStock, isLow, webUrl);
      } catch (err) {
        return {
          type: 'text',
          text: `❌ เกิดข้อผิดพลาดในการตัดสต็อก ${product.name}: ${err.message}`
        };
      }
    }

    // ACTION: SET STOCK (นับสต็อก / ปรับยอด)
    if (intent.action === 'SET_STOCK') {
      try {
        const updated = await dbClient.setProductStockDirect(product.id, intent.quantity, senderName);
        const newStock = updated.current_stock;
        const isLow = newStock <= Number(updated.safety_stock);

        return {
          type: 'flex',
          altText: `📊 ปรับยอดสต็อก ${product.name} เป็น ${newStock} ${product.unit}`,
          contents: {
            type: 'bubble',
            size: 'kilo',
            header: {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#0284C7',
              paddingAll: '16px',
              contents: [
                { type: 'text', text: '📊 ปรับยอดคงเหลือจากการนับ', weight: 'bold', color: '#FFFFFF', size: 'sm' },
                { type: 'text', text: product.name, weight: 'bold', color: '#FFFFFF', size: 'lg', margin: 'xs' }
              ]
            },
            body: {
              type: 'box',
              layout: 'vertical',
              paddingAll: '16px',
              spacing: 'sm',
              contents: [
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    { type: 'text', text: 'ยอดคงเหลือใหม่:', color: '#64748B', size: 'xs', flex: 5 },
                    { type: 'text', text: `${newStock} ${product.unit}`, weight: 'bold', color: isLow ? '#DC2626' : '#059669', size: 'sm', flex: 5, align: 'end' }
                  ]
                },
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    { type: 'text', text: 'จุดสั่งซื้อ (Safety):', color: '#64748B', size: 'xs', flex: 5 },
                    { type: 'text', text: `${product.safety_stock} ${product.unit}`, color: '#1E293B', size: 'xs', flex: 5, align: 'end' }
                  ]
                },
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    { type: 'text', text: 'ผู้บันทึก:', color: '#64748B', size: 'xs', flex: 5 },
                    { type: 'text', text: senderName, color: '#1E293B', size: 'xs', flex: 5, align: 'end' }
                  ]
                },
                ...(isLow ? [{
                  type: 'box',
                  layout: 'vertical',
                  margin: 'md',
                  paddingAll: '8px',
                  backgroundColor: '#FEF2F2',
                  cornerRadius: '8px',
                  contents: [
                    { type: 'text', text: '⚠️ ต่ำกว่าเกณฑ์ Safety Stock! แนะนำสั่งเพิ่ม', color: '#DC2626', size: 'xxs', weight: 'bold', align: 'center' }
                  ]
                }] : [])
              ]
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              paddingAll: '10px',
              contents: [
                {
                  type: 'button',
                  style: 'link',
                  height: 'sm',
                  action: { type: 'uri', label: '📱 ดูภาพรวมบนเว็บ', uri: webUrl }
                }
              ]
            }
          }
        };
      } catch (err) {
        return { type: 'text', text: `❌ ไม่สามารถปรับยอดสต็อกได้: ${err.message}` };
      }
    }

    // ACTION: ADD STOCK (รับเข้า / เติม)
    if (intent.action === 'ADD_STOCK') {
      try {
        const updated = await dbClient.addProductStockDirect(product.id, intent.quantity, senderName);
        return {
          type: 'flex',
          altText: `📦 เติมสต็อก ${product.name} +${intent.quantity} ${product.unit}`,
          contents: {
            type: 'bubble',
            size: 'kilo',
            header: {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#059669',
              paddingAll: '16px',
              contents: [
                { type: 'text', text: '📦 รับของเข้า / เติมสต็อกสำเร็จ', weight: 'bold', color: '#FFFFFF', size: 'sm' },
                { type: 'text', text: product.name, weight: 'bold', color: '#FFFFFF', size: 'lg', margin: 'xs' }
              ]
            },
            body: {
              type: 'box',
              layout: 'vertical',
              paddingAll: '16px',
              spacing: 'sm',
              contents: [
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    { type: 'text', text: 'จำนวนที่รับเข้า:', color: '#64748B', size: 'xs', flex: 5 },
                    { type: 'text', text: `+${intent.quantity} ${product.unit}`, weight: 'bold', color: '#059669', size: 'sm', flex: 5, align: 'end' }
                  ]
                },
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    { type: 'text', text: 'คงเหลือรวมใหม่:', color: '#64748B', size: 'xs', flex: 5 },
                    { type: 'text', text: `${updated.current_stock} ${product.unit}`, weight: 'bold', color: '#1E293B', size: 'sm', flex: 5, align: 'end' }
                  ]
                }
              ]
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              paddingAll: '10px',
              contents: [
                {
                  type: 'button',
                  style: 'link',
                  height: 'sm',
                  action: { type: 'uri', label: '📱 เปิดระบบสต็อก', uri: webUrl }
                }
              ]
            }
          }
        };
      } catch (err) {
        return { type: 'text', text: `❌ ไม่สามารถเติมสต็อกได้: ${err.message}` };
      }
    }

    return null;
  }

  buildDeductionResultFlex(product, deductedQty, newStock, isLow, webUrl) {
    return {
      type: 'flex',
      altText: `✅ ตัดสต็อก ${product.name} ${deductedQty} ${product.unit} (คงเหลือ ${newStock})`,
      contents: {
        type: 'bubble',
        size: 'kilo',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: isLow ? '#DC2626' : '#1E293B',
          paddingAll: '16px',
          contents: [
            { type: 'text', text: isLow ? '⚠️ ตัดสต็อกสำเร็จ (ของใกล้หมด!)' : '✅ บันทึกตัดสต็อกสำเร็จ', weight: 'bold', color: '#FFFFFF', size: 'sm' },
            { type: 'text', text: product.name, weight: 'bold', color: '#FFFFFF', size: 'lg', margin: 'xs' }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '16px',
          spacing: 'sm',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: 'ใช้ไป:', color: '#64748B', size: 'xs', flex: 5 },
                { type: 'text', text: `-${deductedQty} ${product.unit}`, weight: 'bold', color: '#DC2626', size: 'sm', flex: 5, align: 'end' }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: 'คงเหลือปัจจุบัน:', color: '#64748B', size: 'xs', flex: 5 },
                { type: 'text', text: `${newStock} ${product.unit}`, weight: 'bold', color: isLow ? '#DC2626' : '#059669', size: 'sm', flex: 5, align: 'end' }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: 'จุดสั่งซื้อ (Safety):', color: '#64748B', size: 'xs', flex: 5 },
                { type: 'text', text: `${product.safety_stock} ${product.unit}`, color: '#1E293B', size: 'xs', flex: 5, align: 'end' }
              ]
            },
            ...(isLow ? [{
              type: 'box',
              layout: 'vertical',
              margin: 'md',
              paddingAll: '8px',
              backgroundColor: '#FEF2F2',
              cornerRadius: '8px',
              contents: [
                { type: 'text', text: '🛒 แนะนำสั่งซื้อเพิ่ม: พิมพ์ "สั่งของ" เพื่อดูใบสั่ง', color: '#DC2626', size: 'xxs', weight: 'bold', align: 'center' }
              ]
            }] : [])
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '10px',
          contents: [
            {
              type: 'button',
              style: 'link',
              height: 'sm',
              action: { type: 'uri', label: '📱 เปิดเช็คสต็อกทั้งหมด', uri: webUrl }
            }
          ]
        }
      }
    };
  }

  buildItemDetailFlex(product, webUrl) {
    const isLow = product.is_low_stock || product.current_stock <= Number(product.safety_stock);
    return {
      type: 'flex',
      altText: `🔍 ข้อมูลสต็อก: ${product.name}`,
      contents: {
        type: 'bubble',
        size: 'kilo',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#334155',
          paddingAll: '16px',
          contents: [
            { type: 'text', text: `หมวด: ${product.category || 'ทั่วไป'}`, color: '#94A3B8', size: 'xs' },
            { type: 'text', text: product.name, weight: 'bold', color: '#FFFFFF', size: 'lg', margin: 'xs' }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '16px',
          spacing: 'sm',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: 'สต็อกคงเหลือ:', color: '#64748B', size: 'xs', flex: 5 },
                { type: 'text', text: `${product.current_stock} ${product.unit}`, weight: 'bold', color: isLow ? '#DC2626' : '#059669', size: 'sm', flex: 5, align: 'end' }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: 'Safety Stock:', color: '#64748B', size: 'xs', flex: 5 },
                { type: 'text', text: `${product.safety_stock} ${product.unit}`, color: '#1E293B', size: 'xs', flex: 5, align: 'end' }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: 'วันหมดอายุใกล้สุด:', color: '#64748B', size: 'xs', flex: 5 },
                { type: 'text', text: product.nearest_expiry || 'ยังไม่ระบุ', color: '#1E293B', size: 'xs', flex: 5, align: 'end' }
              ]
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '10px',
          contents: [
            {
              type: 'button',
              style: 'link',
              height: 'sm',
              action: { type: 'uri', label: '📱 เปิดดูในระบบ', uri: webUrl }
            }
          ]
        }
      }
    };
  }

  buildOverviewFlex(prods, alerts, webUrl) {
    const total = prods.length;
    const lowCount = alerts.low_stock_items ? alerts.low_stock_items.length : 0;
    const expCount = alerts.expiring_batches ? alerts.expiring_batches.length : 0;

    return {
      type: 'flex',
      altText: `📊 สรุปสต็อก Dairy Queen SAT (${total} รายการ)`,
      contents: {
        type: 'bubble',
        size: 'kilo',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#1E293B',
          paddingAll: '16px',
          contents: [
            { type: 'text', text: '📊 สรุปสต็อกภาพรวม', weight: 'bold', color: '#FFFFFF', size: 'md' },
            { type: 'text', text: 'Dairy Queen SAT', color: '#94A3B8', size: 'xs', margin: 'xs' }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '16px',
          spacing: 'md',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '📦 สินค้าทั้งหมด:', color: '#64748B', size: 'xs', flex: 6 },
                { type: 'text', text: `${total} รายการ`, weight: 'bold', color: '#1E293B', size: 'xs', flex: 4, align: 'end' }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '⚠️ ต่ำกว่าเกณฑ์/ของหมด:', color: '#64748B', size: 'xs', flex: 6 },
                { type: 'text', text: `${lowCount} รายการ`, weight: 'bold', color: lowCount > 0 ? '#DC2626' : '#059669', size: 'xs', flex: 4, align: 'end' }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                { type: 'text', text: '⏳ ใกล้/หมดอายุใน 7 วัน:', color: '#64748B', size: 'xs', flex: 6 },
                { type: 'text', text: `${expCount} รายการ`, weight: 'bold', color: expCount > 0 ? '#D97706' : '#059669', size: 'xs', flex: 4, align: 'end' }
              ]
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'xs',
          paddingAll: '12px',
          contents: [
            {
              type: 'button',
              style: 'primary',
              color: '#2563EB',
              height: 'sm',
              action: { type: 'uri', label: '📱 เปิดระบบสต็อกสินค้า', uri: webUrl }
            }
          ]
        }
      }
    };
  }

  buildHelpFlex(webUrl) {
    return {
      type: 'flex',
      altText: '📖 วิธีสั่งงานบอทสต็อกใน LINE',
      contents: {
        type: 'bubble',
        size: 'mega',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#0F172A',
          paddingAll: '16px',
          contents: [
            { type: 'text', text: '🤖 วิธีสั่งงานบอทสต็อกในแชต LINE', weight: 'bold', color: '#FFFFFF', size: 'md' },
            { type: 'text', text: 'พิมพ์คุยภาษาพูดได้ทันที บอทจะตัดและนับสต็อกให้!', color: '#94A3B8', size: 'xs', margin: 'xs' }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '16px',
          spacing: 'md',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#F8FAFC',
              paddingAll: '10px',
              cornerRadius: '10px',
              contents: [
                { type: 'text', text: '✂️ 1. ตัดสต็อกเมื่อหยิบไปใช้:', weight: 'bold', size: 'xs', color: '#DC2626' },
                { type: 'text', text: '• "coke ใช้ไป 5 pcs"', size: 'xs', color: '#334155', margin: 'xs' },
                { type: 'text', text: '• "ตัด ผงโกโก้ 2"', size: 'xs', color: '#334155' },
                { type: 'text', text: '• "โอริโอ้ ใช้ 3"', size: 'xs', color: '#334155' }
              ]
            },
            {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#F8FAFC',
              paddingAll: '10px',
              cornerRadius: '10px',
              contents: [
                { type: 'text', text: '📊 2. นับสต็อก / ปรับยอดคงเหลือ:', weight: 'bold', size: 'xs', color: '#0284C7' },
                { type: 'text', text: '• "coke เหลือ 12"', size: 'xs', color: '#334155', margin: 'xs' },
                { type: 'text', text: '• "นับ นมจืด ได้ 8"', size: 'xs', color: '#334155' }
              ]
            },
            {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#F8FAFC',
              paddingAll: '10px',
              cornerRadius: '10px',
              contents: [
                { type: 'text', text: '📦 3. รับของเข้าสต็อก:', weight: 'bold', size: 'xs', color: '#059669' },
                { type: 'text', text: '• "รับ coke 24"', size: 'xs', color: '#334155', margin: 'xs' },
                { type: 'text', text: '• "เติม ช้อนสั้น 10 pack"', size: 'xs', color: '#334155' }
              ]
            },
            {
              type: 'box',
              layout: 'vertical',
              backgroundColor: '#F8FAFC',
              paddingAll: '10px',
              cornerRadius: '10px',
              contents: [
                { type: 'text', text: '🛒 4. ดูรายการสั่งของ / เช็คสต็อก:', weight: 'bold', size: 'xs', color: '#D97706' },
                { type: 'text', text: '• พิมพ์ "สั่งของ" หรือ "ของหมด"', size: 'xs', color: '#334155', margin: 'xs' },
                { type: 'text', text: '• พิมพ์ "เช็คสต็อก"', size: 'xs', color: '#334155' }
              ]
            }
          ]
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '10px',
          contents: [
            {
              type: 'button',
              style: 'link',
              height: 'sm',
              action: { type: 'uri', label: '📱 เปิดเว็บไซต์หลัก', uri: webUrl }
            }
          ]
        }
      }
    };
  }
}

module.exports = new LineBotService();
