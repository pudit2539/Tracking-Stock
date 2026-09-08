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
  { name: 'Perrier', aliases: ['perrier', 'เปอริเอ้', 'เพอริเอ้', 'เพอเรีย', 'เปอริเย่'] },
  { name: 'Perrier Lemon', aliases: ['perrier lemon', 'เปอริเอ้มะนาว', 'เพอริเอ้เลมอน', 'perrier มะนาว', 'เพอเรียมะนาว', 'เปอริเย่มะนาว'] },
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

function levenshteinDistance(s1, s2) {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = s1[i - 1] === s2[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function stringSimilarity(s1, s2) {
  s1 = s1.toLowerCase().trim();
  s2 = s2.toLowerCase().trim();
  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.85;
  const maxLen = Math.max(s1.length, s2.length);
  const dist = levenshteinDistance(s1, s2);
  const levScore = 1 - (dist / maxLen);

  const getBigrams = str => {
    const s = new Set();
    for (let i = 0; i < str.length - 1; i++) s.add(str.slice(i, i + 2));
    return s;
  };
  const b1 = getBigrams(s1);
  const b2 = getBigrams(s2);
  let inter = 0;
  b1.forEach(bg => { if (b2.has(bg)) inter++; });
  const dice = (2 * inter) / (b1.size + b2.size || 1);
  return Math.max(levScore, dice);
}

class LineBotService {
  findProduct(text) {
    const clean = text.toLowerCase().trim();
    let bestMatch = null;
    let maxLen = 0;

    for (const item of PRODUCT_ALIASES) {
      for (const alias of item.aliases) {
        const aliasLower = alias.toLowerCase();
        if (clean.includes(aliasLower)) {
          if (aliasLower.length > maxLen) {
            maxLen = aliasLower.length;
            bestMatch = item.name;
          }
        }
      }
    }
    return bestMatch;
  }

  extractQuantity(text) {
    const match = text.match(/(\d+(\.\d+)?)/);
    if (match) {
      return parseFloat(match[1]);
    }
    return null;
  }

  getFuzzyProductSuggestions(candidate, maxSuggestions = 3) {
    if (!candidate) return [];
    const cand = candidate.toLowerCase().trim();
    const scored = [];

    for (const item of PRODUCT_ALIASES) {
      let maxItemScore = 0;
      for (const alias of item.aliases) {
        const score = stringSimilarity(cand, alias.toLowerCase().trim());
        if (score > maxItemScore) {
          maxItemScore = score;
        }
      }
      if (maxItemScore >= 0.45) {
        scored.push({ name: item.name, score: maxItemScore });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const unique = [];
    for (const s of scored) {
      if (!unique.includes(s.name)) {
        unique.push(s.name);
      }
      if (unique.length >= maxSuggestions) break;
    }
    return unique;
  }

  extractCandidateWord(raw) {
    if (!raw) return '';
    let clean = raw
      .replace(/(รับเข้า|รับของ|รับ|เติมสต็อก|เติมของ|เติม|ซื้อมา|add|\+|ใช้ไปแล้ว|ใช้ไป|ใช้|ตัดสต็อก|ตัดของ|ตัด|เบิกใช้|เบิกของ|เบิก|หักสต็อก|หัก|เอาไป|use|minus|-|เหลืออยู่|เหลือ|นับได้|นับสต็อก|นับ|มีอยู่|ปรับเป็น|set|count|เช็คสต็อก|เช็คของ|เช็ค|ตรวจสต็อก|ดูสต็อก|ดู|เหลือเท่าไหร่|มีมั้ย|เท่าไหร่|กี่อัน|กี่ชิ้น)/gi, ' ')
      .replace(/(\d+(\.\d+)?)/g, ' ')
      .replace(/\b(pack|cs|bag|box|can|pcs|btl|ชิ้น|แพ็ค|แพค|กล่อง|ถุง|ลัง|ขวด|กระป๋อง|หลอด|ม้วน|อัน)\b/gi, ' ')
      .replace(/[^\u0E00-\u0E7Fa-zA-Z0-9\s]/g, ' ')
      .trim();

    const words = clean.split(/\s+/).filter(w => w.length >= 2);
    return words.join(' ').trim();
  }

  parseIntent(text, defaultAction = null) {
    const raw = text.toLowerCase().trim();
    if (!raw) return null;

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

    // Fallback if product and number found without explicit verb
    if (prodName && qty !== null) {
      return { action: defaultAction || 'USE', productName: prodName, quantity: qty };
    }

    // 8. TYPO / DID YOU MEAN DETECTION (When product is misspelled but stock intent is clear)
    const isAdd = /^(รับเข้า|รับของ|รับ|เติมสต็อก|เติมของ|เติม|ซื้อมา|add|\+)/i.test(raw);
    const isUse = /^(ใช้ไปแล้ว|ใช้ไป|ใช้|ตัดสต็อก|ตัดของ|ตัด|เบิกใช้|เบิกของ|เบิก|หักสต็อก|หัก|เอาไป|use|minus|-)/i.test(raw);
    const isSet = /^(เหลืออยู่|นับได้|นับสต็อก|ปรับเป็น|set|count)/i.test(raw);
    const isCheck = /^(เช็คสต็อก|เช็คของ|เช็ค|ตรวจสต็อก|ดูสต็อก)/i.test(raw);
    const hasVerb = isAdd || isUse || isSet || isCheck;

    if (hasVerb || (defaultAction && qty !== null) || (qty !== null && /(รับ|เติม|ตัด|ใช้|เบิก)/i.test(raw))) {
      const candidate = this.extractCandidateWord(raw);
      if (candidate && candidate.length >= 2) {
        const suggestions = this.getFuzzyProductSuggestions(candidate);
        let intendedAction = 'USE';
        if (isAdd || defaultAction === 'ADD_STOCK') intendedAction = 'ADD_STOCK';
        else if (isSet || defaultAction === 'SET_STOCK') intendedAction = 'SET_STOCK';
        else if (isCheck) intendedAction = 'CHECK_ITEM';

        return {
          action: 'UNKNOWN_PRODUCT',
          candidate,
          suggestions,
          quantity: qty,
          intendedAction,
          originalVerb: isAdd ? 'รับ' : (isUse ? 'ตัด' : (isSet ? 'นับ' : (isCheck ? 'เช็ค' : ''))),
          rawText: text
        };
      }
    }

    return null;
  }

  parseAllIntents(text) {
    if (!text || typeof text !== 'string') return [];
    const trimmed = text.trim();
    if (!trimmed) return [];

    // General single commands
    const singleRaw = trimmed.toLowerCase();
    if (/^(วิธีใช้|คำสั่ง|คู่มือ|help|เมนู|\?)$/i.test(singleRaw)) {
      return [{ action: 'HELP' }];
    }
    if (/^(สั่งของ|ของหมด|ของใกล้หมด|order|สรุปสั่งของ)$/i.test(singleRaw) || singleRaw.includes('สรุปของหมด') || singleRaw.includes('ต้องสั่งอะไร')) {
      return [{ action: 'ORDER_LIST' }];
    }
    if (/^(เช็คสต็อก|สต็อก|คงเหลือ|เช็คของ|stock)$/i.test(singleRaw)) {
      return [{ action: 'STOCK_OVERVIEW' }];
    }

    // Split by newlines first
    const rawLines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const commands = [];

    for (const line of rawLines) {
      if (line.includes(',') || line.includes(';') || /[\s,]+และ[\s,]+/i.test(line)) {
        const parts = line.split(/[,;]|(?:[\s,]+และ[\s,]+)/).map(p => p.trim()).filter(Boolean);
        commands.push(...parts);
      } else {
        commands.push(line);
      }
    }

    const intents = [];
    let lastAction = null;

    for (const cmd of commands) {
      const intent = this.parseIntent(cmd, lastAction);
      if (intent) {
        intents.push({ ...intent, rawText: cmd });
        if (['USE', 'ADD_STOCK', 'SET_STOCK'].includes(intent.action)) {
          lastAction = intent.action;
        }
      }
    }

    return intents;
  }

  async handleMessage(text, senderName = 'พนักงาน', currentUrl = null) {
    const intents = this.parseAllIntents(text);
    if (!intents || intents.length === 0) return null;

    const webUrl = await lineService.getAppUrl(currentUrl);

    if (intents.length === 1) {
      return this.executeSingleIntent(intents[0], senderName, webUrl);
    }

    return this.executeMultiIntents(intents, senderName, webUrl);
  }

  async executeSingleIntent(intent, senderName, webUrl) {
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

    // ACTION: UNKNOWN PRODUCT (Typo / Did you mean)
    if (intent.action === 'UNKNOWN_PRODUCT') {
      return this.buildUnknownProductFlex(intent, webUrl);
    }

    // PRODUCT ACTIONS
    const allProducts = await dbClient.getAllProducts();
    const product = allProducts.find(p => p.name === intent.productName);

    if (!product) {
      const candidate = intent.productName || intent.candidate || '';
      const suggestions = this.getFuzzyProductSuggestions(candidate);
      return this.buildUnknownProductFlex({
        candidate,
        suggestions,
        quantity: intent.quantity,
        originalVerb: 'รับ'
      }, webUrl);
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
                  action: { type: 'uri', label: '📱 ดูข้อมูลสินค้านี้บนเว็บ', uri: `${webUrl}?tab=inventory&product_id=${product.id}` }
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
                  action: { type: 'uri', label: '📱 ดูประวัติการรับเข้าบนเว็บ', uri: `${webUrl}?tab=usage&subtab=inbound` }
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

  async executeMultiIntents(intents, senderName, webUrl) {
    const allProducts = await dbClient.getAllProducts();
    const results = [];

    for (const item of intents) {
      if (item.action === 'UNKNOWN_PRODUCT') {
        const sugText = (item.suggestions && item.suggestions.length > 0)
          ? `(คุณหมายถึง "${item.suggestions.join('" หรือ "')}" ใช่หรือไม่?)`
          : 'ไม่พบสินค้าในระบบ';
        results.push({
          success: false,
          name: item.candidate || item.rawText || 'สินค้าไม่ระบุ',
          suggestions: item.suggestions || [],
          error: sugText
        });
        continue;
      }

      const product = allProducts.find(p => p.name === item.productName);
      if (!product) {
        const candidate = item.productName || item.candidate || item.rawText;
        const suggestions = this.getFuzzyProductSuggestions(candidate);
        const sugText = (suggestions && suggestions.length > 0)
          ? `(คุณหมายถึง "${suggestions.join('" หรือ "')}" ใช่หรือไม่?)`
          : 'ไม่พบสินค้าในระบบ';
        results.push({
          success: false,
          name: candidate,
          suggestions,
          error: sugText
        });
        continue;
      }

      if (item.action === 'ADD_STOCK') {
        try {
          const updated = await dbClient.addProductStockDirect(product.id, item.quantity, senderName);
          results.push({
            success: true,
            action: 'ADD_STOCK',
            product,
            qty: item.quantity,
            newStock: updated.current_stock,
            unit: product.unit,
            isLow: updated.current_stock <= Number(product.safety_stock)
          });
        } catch (err) {
          results.push({ success: false, name: product.name, error: err.message });
        }
      } else if (item.action === 'USE') {
        try {
          const qty = item.quantity;
          const batches = await dbClient.getBatchesByProductId(product.id);
          const totalAvailable = batches.reduce((sum, b) => sum + Number(b.quantity), 0);

          await dbClient.recordUsage({
            product_id: product.id,
            quantity: Math.min(qty, Math.max(0, totalAvailable)),
            type: 'USE',
            used_by: senderName,
            notes: 'ตัดหลายรายการผ่าน LINE'
          });

          const updated = await dbClient.getProductById(product.id);
          const newStock = updated.current_stock;
          const isLow = newStock <= Number(updated.safety_stock);

          results.push({
            success: true,
            action: 'USE',
            product,
            qty,
            newStock,
            unit: product.unit,
            isLow
          });
        } catch (err) {
          results.push({ success: false, name: product.name, error: err.message });
        }
      } else if (item.action === 'SET_STOCK') {
        try {
          const updated = await dbClient.setProductStockDirect(product.id, item.quantity, senderName);
          const newStock = updated.current_stock;
          const isLow = newStock <= Number(updated.safety_stock);

          results.push({
            success: true,
            action: 'SET_STOCK',
            product,
            qty: item.quantity,
            newStock,
            unit: product.unit,
            isLow
          });
        } catch (err) {
          results.push({ success: false, name: product.name, error: err.message });
        }
      } else if (item.action === 'CHECK_ITEM') {
        results.push({
          success: true,
          action: 'CHECK_ITEM',
          product,
          qty: 0,
          newStock: product.current_stock,
          unit: product.unit,
          isLow: product.is_low_stock
        });
      }
    }

    return this.buildMultiResultFlex(results, senderName, webUrl);
  }

  buildMultiResultFlex(results, senderName, webUrl) {
    const successItems = results.filter(r => r.success);
    const failItems = results.filter(r => !r.success);

    const isAllAdd = successItems.length > 0 && successItems.every(r => r.action === 'ADD_STOCK');
    const isAllUse = successItems.length > 0 && successItems.every(r => r.action === 'USE');

    let headerBg = '#2563EB'; // Blue
    let headerTitle = `⚡ อัปเดตสำเร็จ (${successItems.length} รายการ)`;
    let headerSubtitle = 'ประมวลผลคำสั่งพร้อมกันเรียบร้อยแล้ว';

    if (isAllAdd) {
      headerBg = '#059669'; // Emerald Green
      headerTitle = `📦 รับของเข้าสำเร็จ (${successItems.length} รายการ)`;
      headerSubtitle = 'เพิ่มเข้าสู่ระบบเรียบร้อยแล้ว';
    } else if (isAllUse) {
      headerBg = '#E11D48'; // Rose Red
      headerTitle = `✂️ ตัดสต็อกสำเร็จ (${successItems.length} รายการ)`;
      headerSubtitle = 'ตัดสต็อกตามหลัก FIFO เรียบร้อยแล้ว';
    }

    const itemRows = [];

    successItems.forEach((r, idx) => {
      let actionText = '';
      let actionColor = '#059669';

      if (r.action === 'ADD_STOCK') {
        actionText = `+${r.qty} ${r.unit}`;
        actionColor = '#059669';
      } else if (r.action === 'USE') {
        actionText = `-${r.qty} ${r.unit}`;
        actionColor = '#E11D48';
      } else if (r.action === 'SET_STOCK') {
        actionText = `ปรับเป็น ${r.qty} ${r.unit}`;
        actionColor = '#0284C7';
      } else if (r.action === 'CHECK_ITEM') {
        actionText = `คงเหลือ ${r.newStock} ${r.unit}`;
        actionColor = '#64748B';
      }

      itemRows.push({
        type: 'box',
        layout: 'vertical',
        spacing: 'xs',
        margin: idx === 0 ? 'none' : 'md',
        ...(webUrl && r.product ? { action: { type: 'uri', label: r.product.name, uri: `${webUrl}?tab=inventory&product_id=${r.product.id}` } } : {}),
        contents: [
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: `${idx + 1}. ${r.product.name}`,
                weight: 'bold',
                size: 'sm',
                color: '#0F172A',
                flex: 6
              },
              {
                type: 'text',
                text: actionText,
                weight: 'bold',
                size: 'xs',
                color: actionColor,
                align: 'end',
                flex: 4
              }
            ]
          },
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'text',
                text: `คงเหลือใหม่: ${r.newStock} ${r.unit}`,
                size: 'xs',
                color: r.isLow ? '#DC2626' : '#64748B',
                weight: r.isLow ? 'bold' : 'regular',
                flex: 6
              },
              ...(r.isLow ? [{
                type: 'text',
                text: '⚠️ ต่ำกว่า Safety',
                size: 'xxs',
                color: '#DC2626',
                align: 'end',
                flex: 4
              }] : [])
            ]
          }
        ]
      });

      if (idx < successItems.length - 1) {
        itemRows.push({ type: 'separator', margin: 'md', color: '#F1F5F9' });
      }
    });

    if (failItems.length > 0) {
      itemRows.push({ type: 'separator', margin: 'lg', color: '#CBD5E1' });
      failItems.forEach(f => {
        itemRows.push({
          type: 'box',
          layout: 'horizontal',
          margin: 'sm',
          contents: [
            { type: 'text', text: `⚠️ ${f.name}:`, size: 'xs', color: '#EF4444', weight: 'bold', flex: 4, wrap: true },
            { type: 'text', text: f.error || 'ผิดพลาด', size: 'xs', color: '#64748B', flex: 6, wrap: true }
          ]
        });
      });
    }

    return {
      type: 'flex',
      altText: `${headerTitle} โดย ${senderName}`,
      contents: {
        type: 'bubble',
        size: 'mega',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: headerBg,
          paddingAll: '16px',
          contents: [
            { type: 'text', text: headerTitle, weight: 'bold', color: '#FFFFFF', size: 'md' },
            { type: 'text', text: headerSubtitle, color: '#E2E8F0', size: 'xs', margin: 'xs' }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '16px',
          contents: [
            ...itemRows,
            { type: 'separator', margin: 'lg', color: '#E2E8F0' },
            {
              type: 'box',
              layout: 'horizontal',
              margin: 'md',
              contents: [
                { type: 'text', text: '👤 ผู้บันทึก:', size: 'xs', color: '#94A3B8', flex: 4 },
                { type: 'text', text: senderName, size: 'xs', color: '#475569', align: 'end', flex: 6, weight: 'bold' }
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
              action: { 
                type: 'uri', 
                label: isAllAdd ? '📱 ดูประวัติการรับเข้าบนเว็บ' : (isAllUse ? '📱 ดูประวัติการเบิกใช้บนเว็บ' : '📱 ดูภาพรวมสต็อกบนเว็บ'), 
                uri: isAllAdd ? `${webUrl}?tab=usage&subtab=inbound` : (isAllUse ? `${webUrl}?tab=usage&subtab=outbound` : `${webUrl}?tab=inventory`)
              }
            }
          ]
        }
      }
    };
  }

  buildUnknownProductFlex(intent, webUrl) {
    const candidate = intent.candidate || 'ไม่ทราบชื่อ';
    const suggestions = intent.suggestions || [];
    const verb = intent.originalVerb || (intent.intendedAction === 'ADD_STOCK' ? 'รับ' : (intent.intendedAction === 'SET_STOCK' ? 'นับ' : (intent.intendedAction === 'CHECK_ITEM' ? 'เช็ค' : 'ตัด')));
    const qtyStr = intent.quantity ? ` ${intent.quantity}` : '';

    const suggestionBoxes = suggestions.slice(0, 3).map(sug => ({
      type: 'box',
      layout: 'horizontal',
      backgroundColor: '#FEF3C7',
      cornerRadius: '8px',
      paddingAll: '10px',
      margin: 'sm',
      borderWidth: '1px',
      borderColor: '#FDE68A',
      action: {
        type: 'message',
        label: sug.slice(0, 20),
        text: `${verb} ${sug}${qtyStr}`.trim()
      },
      contents: [
        { type: 'text', text: `👉  ${sug}`, size: 'sm', color: '#92400E', weight: 'bold', flex: 8 },
        { type: 'text', text: 'แตะเพื่อเลือก 👆', size: 'xxs', color: '#B45309', align: 'end', flex: 4 }
      ]
    }));

    const contents = [
      {
        type: 'box',
        layout: 'vertical',
        margin: 'none',
        contents: [
          {
            type: 'text',
            text: `คำที่คุณพิมพ์: "${candidate}"`,
            size: 'sm',
            color: '#64748B',
            weight: 'bold'
          }
        ]
      },
      { type: 'separator', margin: 'md', color: '#E2E8F0' }
    ];

    if (suggestions.length > 0) {
      contents.push(
        {
          type: 'text',
          text: 'คุณหมายถึงสินค้าด้านล่างนี้ใช่หรือไม่? (แตะที่ชื่อเพื่อส่งคำสั่งทันที)',
          size: 'xs',
          color: '#475569',
          wrap: true,
          margin: 'md'
        },
        ...suggestionBoxes,
        {
          type: 'box',
          layout: 'vertical',
          margin: 'lg',
          paddingAll: '10px',
          backgroundColor: '#F8FAFC',
          cornerRadius: '8px',
          contents: [
            {
              type: 'text',
              text: '💡 หรือลองพิมพ์คำสั่งใหม่ เช่น:',
              size: 'xxs',
              color: '#64748B',
              weight: 'bold'
            },
            {
              type: 'text',
              text: `"${verb} ${suggestions[0]}${qtyStr || ' 1'}"`,
              size: 'xs',
              color: '#0284C7',
              weight: 'bold',
              margin: 'xs'
            }
          ]
        }
      );
    } else {
      contents.push(
        {
          type: 'text',
          text: `ไม่พบสินค้า "${candidate}" ในรายการสินค้าของ Dairy Queen`,
          size: 'xs',
          color: '#EF4444',
          wrap: true,
          margin: 'md'
        },
        {
          type: 'text',
          text: 'กรุณาตรวจสอบการสะกดชื่อ หรือพิมพ์ "วิธีใช้" เพื่อดูรายชื่อสินค้าและตัวอย่างคำสั่ง',
          size: 'xs',
          color: '#64748B',
          wrap: true,
          margin: 'sm'
        }
      );
    }

    return {
      type: 'flex',
      altText: `⚠️ ไม่พบสินค้า "${candidate}" ${suggestions.length > 0 ? `(คุณหมายถึง ${suggestions.join(', ')} ใช่หรือไม่?)` : ''}`,
      contents: {
        type: 'bubble',
        size: 'mega',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: '#D97706',
          paddingAll: '16px',
          contents: [
            { type: 'text', text: '⚠️ ไม่พบชื่อสินค้านี้ในระบบ', weight: 'bold', color: '#FFFFFF', size: 'sm' },
            {
              type: 'text',
              text: suggestions.length > 0 ? 'ระบบค้นหาชื่อสินค้าใกล้เคียงมาให้ครับ' : 'โปรดตรวจสอบชื่อสินค้าอีกครั้ง',
              color: '#FEF3C7',
              size: 'xs',
              margin: 'xs'
            }
          ]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '16px',
          contents
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
              action: { type: 'uri', label: '📱 ตรวจสอบรายชื่อสินค้าทั้งหมดบนเว็บ', uri: `${webUrl}?tab=inventory` }
            }
          ]
        }
      }
    };
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
          ...(webUrl ? { action: { type: 'uri', uri: `${webUrl}?tab=inventory&product_id=${product.id}` } } : {}),
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
              action: { 
                type: 'uri', 
                label: isLow ? '📱 ดูสินค้าใกล้หมดบนเว็บ' : '📱 ดูประวัติการเบิกใช้บนเว็บ', 
                uri: isLow ? `${webUrl}?tab=inventory&filter=LOW` : `${webUrl}?tab=usage&subtab=outbound` 
              }
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
          ...(webUrl ? { action: { type: 'uri', uri: `${webUrl}?tab=inventory&product_id=${product.id}` } } : {}),
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
              action: { type: 'uri', label: '📱 ดูรายละเอียดสินค้านี้บนเว็บ', uri: `${webUrl}?tab=inventory&product_id=${product.id}` }
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
              ...(webUrl ? { action: { type: 'uri', uri: `${webUrl}?tab=inventory&filter=ALL` } } : {}),
              contents: [
                { type: 'text', text: '📦 สินค้าทั้งหมด:', color: '#64748B', size: 'xs', flex: 6 },
                { type: 'text', text: `${total} รายการ`, weight: 'bold', color: '#1E293B', size: 'xs', flex: 4, align: 'end' }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              ...(webUrl ? { action: { type: 'uri', uri: `${webUrl}?tab=inventory&filter=LOW` } } : {}),
              contents: [
                { type: 'text', text: '⚠️ ต่ำกว่าเกณฑ์/ของหมด:', color: '#64748B', size: 'xs', flex: 6 },
                { type: 'text', text: `${lowCount} รายการ`, weight: 'bold', color: lowCount > 0 ? '#DC2626' : '#059669', size: 'xs', flex: 4, align: 'end' }
              ]
            },
            {
              type: 'box',
              layout: 'horizontal',
              ...(webUrl ? { action: { type: 'uri', uri: `${webUrl}?tab=inventory&filter=EXPIRING` } } : {}),
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
              action: { type: 'uri', label: '📱 เปิดเช็คสต็อกสินค้าทั้งหมด', uri: `${webUrl}?tab=inventory` }
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
